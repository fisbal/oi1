// Office In 1 as an app for Windows and Android: the same web suite in the system's web view,
// plus what a web page cannot do there: the native save dialog (Android), opening links in the browser,
// and, on Windows, updating itself from the newest GitHub Release.
mod mail;

// In 1 Mail's IMAP / SMTP (see mail.rs). Each runs off the UI thread; errors come back as "auth: …" or "net: …".
async fn blocking<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
  tauri::async_runtime::spawn_blocking(f).await.map_err(|e| format!("net: {e}"))?
}
#[tauri::command]
async fn mail_imap_check(login: mail::Login) -> Result<(), String> { blocking(move || mail::imap_check(&login)).await }
#[tauri::command]
async fn mail_imap_fetch(login: mail::Login, known: Vec<String>, max: usize) -> Result<Vec<mail::Remote>, String> {
  blocking(move || mail::imap_fetch(&login, &known, max.min(200))).await
}
#[tauri::command]
async fn mail_imap_seen(login: mail::Login, remote_id: String) -> Result<(), String> { blocking(move || mail::imap_seen(&login, &remote_id)).await }
#[tauri::command]
async fn mail_imap_trash(login: mail::Login, remote_id: String) -> Result<(), String> { blocking(move || mail::imap_trash(&login, &remote_id)).await }
#[tauri::command]
async fn mail_smtp_send(login: mail::Login, from: String, to: Vec<String>, raw: String) -> Result<(), String> {
  blocking(move || mail::smtp_send(&login, &from, &to, &raw)).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![mail_imap_check, mail_imap_fetch, mail_imap_seen, mail_imap_trash, mail_smtp_send]);
  #[cfg(desktop)]
  let builder = builder
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init());
  builder
    .run(tauri::generate_context!())
    .expect("error while running Office In 1");
}
