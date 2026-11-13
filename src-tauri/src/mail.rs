// In 1 Mail in the installed app (Windows, Mac, Android): real IMAP (RFC 9051/3501) and SMTP (RFC 5321) over TLS,
// what a web page cannot do (it has no raw network connections). For Gmail, Yahoo, iCloud, GMX, Zoho, Fastmail and any
// IMAP mailbox, signed in with an app password. TLS is rustls (memory-safe, audited) with the Mozilla root
// certificates (webpki-roots), so it behaves the same on every system. The password is given for each call by the
// web side (where it is kept encrypted with the device key) and never stored or logged here.

use base64::Engine;
use serde::{Deserialize, Serialize};
use std::net::TcpStream;
use std::sync::Arc;
use std::time::Duration;

#[derive(Deserialize, Clone)]
pub struct Login {
  pub host: String,
  pub port: u16,
  pub user: String,
  pub pass: String,
}

#[derive(Serialize)]
pub struct Remote {
  #[serde(rename = "remoteId")]
  pub remote_id: String,
  /// The whole message, base64 (bytes as they came).
  pub raw: String,
  pub unread: bool,
}

const TIMEOUT: Duration = Duration::from_secs(40);

fn tls_config() -> Arc<rustls::ClientConfig> {
  let roots = rustls::RootCertStore { roots: webpki_roots::TLS_SERVER_ROOTS.to_vec() };
  let provider = Arc::new(rustls::crypto::ring::default_provider());
  Arc::new(
    rustls::ClientConfig::builder_with_provider(provider)
      .with_safe_default_protocol_versions()
      .expect("TLS versions")
      .with_root_certificates(roots)
      .with_no_client_auth(),
  )
}

type Tls = rustls::StreamOwned<rustls::ClientConnection, TcpStream>;

fn connect_tls(host: &str, port: u16) -> Result<Tls, String> {
  if !(host.contains('.') && host.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')) {
    return Err("bad host".into());
  }
  let tcp = TcpStream::connect((host, port)).map_err(|e| format!("net: {e}"))?;
  tcp.set_read_timeout(Some(TIMEOUT)).ok();
  tcp.set_write_timeout(Some(TIMEOUT)).ok();
  let name = rustls::pki_types::ServerName::try_from(host.to_string()).map_err(|e| format!("net: {e}"))?;
  let conn = rustls::ClientConnection::new(tls_config(), name).map_err(|e| format!("net: {e}"))?;
  Ok(rustls::StreamOwned::new(conn, tcp))
}

fn session(l: &Login) -> Result<imap::Session<Tls>, String> {
  let client = imap::Client::new(connect_tls(&l.host, l.port)?);
  let mut client = client;
  client.read_greeting().map_err(|e| format!("net: {e}"))?;
  client.login(&l.user, &l.pass).map_err(|(e, _)| format!("auth: {e}"))
}

/// Checks that the address and app password work (log in, log out).
pub fn imap_check(l: &Login) -> Result<(), String> {
  let mut s = session(l)?;
  s.logout().ok();
  Ok(())
}

/// The newest `max` mails of INBOX that are not in `known` (their UIDs), unread state kept (BODY.PEEK).
pub fn imap_fetch(l: &Login, known: &[String], max: usize) -> Result<Vec<Remote>, String> {
  let mut s = session(l)?;
  let mb = s.select("INBOX").map_err(|e| format!("net: {e}"))?;
  let validity = mb.uid_validity.unwrap_or(0);
  let mut uids: Vec<u32> = s.uid_search("ALL").map_err(|e| format!("net: {e}"))?.into_iter().collect();
  uids.sort_unstable();
  let wanted: Vec<u32> = uids
    .into_iter()
    .rev()
    .take(max)
    .filter(|u| !known.iter().any(|k| k == &format!("{validity}:{u}")))
    .collect();
  let mut out = Vec::new();
  if wanted.is_empty() {
    s.logout().ok();
    return Ok(out);
  }
  let set = wanted.iter().map(|u| u.to_string()).collect::<Vec<_>>().join(",");
  let fetched = s.uid_fetch(&set, "(UID FLAGS BODY.PEEK[])").map_err(|e| format!("net: {e}"))?;
  for f in fetched.iter() {
    let (Some(uid), Some(body)) = (f.uid, f.body()) else { continue };
    let seen = f.flags().iter().any(|fl| matches!(fl, imap::types::Flag::Seen));
    out.push(Remote {
      remote_id: format!("{validity}:{uid}"),
      raw: base64::engine::general_purpose::STANDARD.encode(body),
      unread: !seen,
    });
  }
  s.logout().ok();
  Ok(out)
}

fn uid_of(remote_id: &str) -> Result<String, String> {
  let uid = remote_id.rsplit(':').next().unwrap_or("");
  if uid.is_empty() || !uid.chars().all(|c| c.is_ascii_digit()) {
    return Err("bad id".into());
  }
  Ok(uid.to_string())
}

/// Marks a mail as read on the server.
pub fn imap_seen(l: &Login, remote_id: &str) -> Result<(), String> {
  let uid = uid_of(remote_id)?;
  let mut s = session(l)?;
  s.select("INBOX").map_err(|e| format!("net: {e}"))?;
  s.uid_store(&uid, "+FLAGS (\\Seen)").map_err(|e| format!("net: {e}"))?;
  s.logout().ok();
  Ok(())
}

/// Moves a mail to the server's Trash (the folder marked \Trash, RFC 6154), never erasing it for good.
pub fn imap_trash(l: &Login, remote_id: &str) -> Result<(), String> {
  let uid = uid_of(remote_id)?;
  let mut s = session(l)?;
  let names = s.list(None, Some("*")).map_err(|e| format!("net: {e}"))?;
  let trash = names
    .iter()
    .find(|n| n.attributes().iter().any(|a| format!("{a:?}").contains("Trash")))
    .map(|n| n.name().to_string())
    .or_else(|| names.iter().map(|n| n.name().to_string()).find(|n| {
      let l = n.to_lowercase();
      l == "trash" || l.ends_with("/trash") || l.ends_with("/corbeille") || l == "deleted items" || l == "deleted messages"
    }))
    .ok_or_else(|| "no trash".to_string())?;
  s.select("INBOX").map_err(|e| format!("net: {e}"))?;
  if s.uid_mv(&uid, &trash).is_err() {
    s.uid_copy(&uid, &trash).map_err(|e| format!("net: {e}"))?;
    s.uid_store(&uid, "+FLAGS (\\Deleted)").map_err(|e| format!("net: {e}"))?;
    s.uid_expunge(&uid).ok();
  }
  s.logout().ok();
  Ok(())
}

/// Sends a complete MIME message (built by In 1 Mail, maybe OpenPGP-encrypted) through SMTP with TLS:
/// port 465 = TLS from the start, any other port = STARTTLS (required).
pub fn smtp_send(l: &Login, from: &str, to: &[String], raw_b64: &str) -> Result<(), String> {
  use lettre::address::{Address, Envelope};
  use lettre::transport::smtp::authentication::Credentials;
  use lettre::transport::smtp::client::{Tls as LTls, TlsParameters};
  use lettre::Transport;
  let raw = base64::engine::general_purpose::STANDARD.decode(raw_b64).map_err(|e| format!("bad message: {e}"))?;
  let from: Address = from.parse().map_err(|e| format!("bad address: {e}"))?;
  let to: Vec<Address> = to.iter().map(|a| a.parse()).collect::<Result<_, _>>().map_err(|e| format!("bad address: {e}"))?;
  let envelope = Envelope::new(Some(from), to).map_err(|e| format!("bad address: {e}"))?;
  let tls = TlsParameters::new(l.host.clone()).map_err(|e| format!("net: {e}"))?;
  let builder = lettre::SmtpTransport::builder_dangerous(&l.host)
    .port(l.port)
    .tls(if l.port == 465 { LTls::Wrapper(tls) } else { LTls::Required(tls) })
    .credentials(Credentials::new(l.user.clone(), l.pass.clone()))
    .timeout(Some(TIMEOUT));
  builder.build().send_raw(&envelope, &raw).map_err(|e| {
    let s = e.to_string();
    if e.is_permanent() && (s.contains("535") || s.to_lowercase().contains("auth")) { format!("auth: {s}") } else { format!("net: {s}") }
  })?;
  Ok(())
}

