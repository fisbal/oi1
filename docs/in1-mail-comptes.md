# In 1 Mail : vrais comptes de courriel, en sécurité

## Ce que fait In 1 Mail

| | Comment |
|---|---|
| **Outlook.com, Hotmail, Live** | Microsoft Graph, connexion OAuth 2.0 « code + PKCE » (RFC 7636), locataire `consumers` : comptes personnels seulement. Jeton de 1 h, renouvelé 24 h sans redemander. |
| **Gmail sur le site et l'appli du Store** | **Envoi seulement.** Gmail API, connexion OAuth 2.0 navigateur (aucun secret dans la page), portées `openid email gmail.send`. `gmail.send` est « sensible », pas « restreinte » : pas d'audit CASA payant. Jeton de 1 h, redemandé en silence. |
| **Gmail, Yahoo, iCloud, AOL, GMX, Zoho, Fastmail, tout IMAP (appli installée Windows/Mac/Android)** | **Lecture et envoi** par IMAP (RFC 9051/3501) et SMTP (RFC 5321) en TLS, avec un **mot de passe d'application** du fournisseur. Moteur en Rust (`src-tauri/src/mail.rs` : crates `imap`, `lettre`, TLS `rustls` + racines Mozilla). Lecture sans changer « non lu » (BODY.PEEK), « lu » renvoyé au serveur, Corbeille = déplacement vers le dossier \Trash (RFC 6154), jamais d'effacement définitif. Une page web ne peut pas faire d'IMAP (pas de connexion TCP directe). |
| **Mot de passe** | Microsoft et Google (site) : jamais vu ni gardé, la personne se connecte chez eux. IMAP (appli) : mot de passe d'application seulement (jamais le vrai mot de passe), chiffré sur l'appareil, révocable en un clic chez le fournisseur. |
| **Sur l'appareil** | Jetons et boîte aux lettres chiffrés AES-256-GCM avec une clé `CryptoKey` non exportable (W3C Web Crypto). Le Mode confidentiel ajoute sa couche NIP et coupe les comptes. |
| **Anti-hameçonnage** | Sur l'appareil : DMARC/SPF/DKIM (RFC 8601), nom d'expéditeur trompeur, marque imitée, domaines sosies (Unicode TR #39 simplifié, punycode), Reply-To différent, liens dont le texte ≠ la destination, liens IP / raccourcis / http, formulaires, pièces jointes dangereuses (exe, macros, double extension, html, archives verrouillées), mots de pression. Les liens douteux ouvrent une fenêtre de vérification ; les images à distance (pixels espions) sont bloquées jusqu'au clic. |
| **Bout en bout** | OpenPGP (RFC 9580/4880, PGP/MIME RFC 3156) avec OpenPGP.js (Proton, LGPL, chargé seulement au besoin), en-têtes protégés (sujet chiffré), signature vérifiée, échange de clés Autocrypt. Compatible Thunderbird, Proton Mail, K-9/FairEmail, Delta Chat, GnuPG. |

Hors champ, volontairement : les courriels de travail ou d'école (Microsoft 365 / Google Workspace d'un employeur, réseaux de la santé ou du gouvernement). Ils restent dans les outils fournis par l'employeur (Loi 25, politiques TI).

Code : `src/modules/mail/secure/` (accounts.ts, vault.ts, phish.ts, pgp.ts, SecureUi.tsx, strings.ts), `public/oauth.html`.
Code de l'appli installée : `src-tauri/src/mail.rs` + commandes `mail_imap_*`, `mail_smtp_send` dans `src-tauri/src/lib.rs`.
Tests : `src/modules/mail/__tests__/secure.test.ts`, `npm run check:mailsecure` (port 4245 ; Microsoft, Google et le moteur IMAP/SMTP rejoués via `window.__oi1Imap`, 6 écrans).

## Étapes pour Martin (une seule fois)

Les identifiants obtenus (« client ID ») ne sont pas secrets : envoie-les simplement dans le fil, je les mets dans l'appli.

### Microsoft (gratuit, environ 5 minutes)

1. Va sur https://entra.microsoft.com et connecte-toi avec ton compte Microsoft personnel. Si Microsoft demande de créer un compte Azure ou un annuaire, choisis l'option **gratuite**.
2. **Applications** → **Inscriptions d'applications** → **Nouvelle inscription**.
3. Nom : `In 1 Mail`.
4. Types de comptes : **Comptes Microsoft personnels uniquement**.
5. URI de redirection : plateforme **Application monopage (SPA)**, adresse `https://fisbal.github.io/oi1/oauth.html`.
6. **Inscrire**. Copie l'**ID d'application (client)** et envoie-le moi.
7. **Autorisations d'API** → **Ajouter une autorisation** → **Microsoft Graph** → **Autorisations déléguées** : coche `Mail.ReadWrite`, `Mail.Send`, `User.Read`, `offline_access` → **Ajouter**.

### Google, envoi seulement (gratuit, sans audit CASA)

1. Va sur https://console.cloud.google.com → **Nouveau projet** → nom `In 1 Mail`.
2. **API et services** → **Bibliothèque** → cherche **Gmail API** → **Activer**.
3. **Google Auth Platform** (écran de consentement OAuth) → **Commencer** :
   - Nom de l'appli : `In 1 Mail` ; e-mail d'assistance : le tien.
   - Audience : **Externe**.
   - Page d'accueil : `https://fisbal.github.io/oi1/` ; confidentialité : `https://fisbal.github.io/oi1/privacy.html` ; conditions : `https://fisbal.github.io/oi1/terms.html`.
4. **Accès aux données** → **Ajouter des champs d'application** → coche `openid`, `.../auth/userinfo.email` et `https://www.googleapis.com/auth/gmail.send` (et **rien d'autre** : surtout pas `gmail.modify` ni `gmail.readonly`, qui sont « restreintes » et demandent l'audit payant) → **Enregistrer**.
5. **Clients** → **Créer un client** → type **Application Web** :
   - Origines JavaScript autorisées : `https://fisbal.github.io`
   - URI de redirection autorisés : `https://fisbal.github.io/oi1/oauth.html`
6. **Créer**. Copie l'**ID client** (finit par `.apps.googleusercontent.com`) et envoie-le moi.
7. Pour commencer : **Audience** → **En test** → ajoute ton Gmail en **Utilisateur test**.
8. Pour tout le monde : **Audience** → **Publier l'application** (« En production »), puis **Vérification** → **Préparer la vérification**. Pour une portée « sensible » c'est **gratuit** (pas de CASA) : Google demande la page de confidentialité (déjà prête), une courte vidéo qui montre l'envoi depuis In 1 Mail et la preuve que le site est à toi (Google Search Console, propriété « préfixe d'URL » `https://fisbal.github.io/oi1/`, je peux ajouter le fichier de vérification). Compte quelques jours à quelques semaines. En attendant, jusqu'à 100 personnes peuvent l'utiliser avec un avertissement « appli non vérifiée ».

### Lire Gmail dans l'appli installée (mot de passe d'application, 2 minutes)

1. Active la **validation en deux étapes** sur ton compte Google (obligatoire pour les mots de passe d'application).
2. Va sur https://myaccount.google.com/apppasswords → nom `In 1 Mail` → **Créer**. Google affiche 16 lettres (ex. `abcd efgh ijkl mnop`).
3. Dans l'appli Office In 1 installée (Windows, Mac ou Android) : **In 1 Mail** → onglet **Envoi** → **Comptes** → partie « Autre boîte (IMAP) » → Fournisseur **Gmail**, ton adresse, colle les 16 lettres → **Connecter**. Puis **Recevoir**.
4. Pour couper l'accès : supprime le mot de passe d'application sur la même page Google (ou retire le compte dans In 1 Mail).

Même chose pour Yahoo, iCloud, AOL, GMX, Zoho, Fastmail (le lien vers leur page « mot de passe d'application » est dans la fenêtre).

Décision de Martin (2026-11-13) : éviter l'audit CASA (≈ 500 à 75 000 $ US par an) avec ces deux voies ; Outlook.com reste lecture + envoi partout.
