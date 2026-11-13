# In 1 Mail : vrais comptes de courriel, en sécurité

## Ce que fait In 1 Mail

| | Comment |
|---|---|
| **Outlook.com, Hotmail, Live** | Microsoft Graph, connexion OAuth 2.0 « code + PKCE » (RFC 7636), locataire `consumers` : comptes personnels seulement. Jeton de 1 h, renouvelé 24 h sans redemander. |
| **Gmail** | Gmail API, connexion OAuth 2.0 navigateur (aucun secret dans la page). Jeton de 1 h, redemandé en silence. Portée `gmail.modify` (lire, envoyer, corbeille ; jamais d'effacement définitif). |
| **Yahoo, iCloud, IMAP** | Impossible depuis une page web (il faut une connexion TCP directe). Prévu dans l'appli installée (Tauri) Windows/Android. |
| **Mot de passe** | Jamais vu ni gardé : la personne se connecte chez Microsoft ou Google. |
| **Sur l'appareil** | Jetons et boîte aux lettres chiffrés AES-256-GCM avec une clé `CryptoKey` non exportable (W3C Web Crypto). Le Mode confidentiel ajoute sa couche NIP et coupe les comptes. |
| **Anti-hameçonnage** | Sur l'appareil : DMARC/SPF/DKIM (RFC 8601), nom d'expéditeur trompeur, marque imitée, domaines sosies (Unicode TR #39 simplifié, punycode), Reply-To différent, liens dont le texte ≠ la destination, liens IP / raccourcis / http, formulaires, pièces jointes dangereuses (exe, macros, double extension, html, archives verrouillées), mots de pression. Les liens douteux ouvrent une fenêtre de vérification ; les images à distance (pixels espions) sont bloquées jusqu'au clic. |
| **Bout en bout** | OpenPGP (RFC 9580/4880, PGP/MIME RFC 3156) avec OpenPGP.js (Proton, LGPL, chargé seulement au besoin), en-têtes protégés (sujet chiffré), signature vérifiée, échange de clés Autocrypt. Compatible Thunderbird, Proton Mail, K-9/FairEmail, Delta Chat, GnuPG. |

Hors champ, volontairement : les courriels de travail ou d'école (Microsoft 365 / Google Workspace d'un employeur, réseaux de la santé ou du gouvernement). Ils restent dans les outils fournis par l'employeur (Loi 25, politiques TI).

Code : `src/modules/mail/secure/` (accounts.ts, vault.ts, phish.ts, pgp.ts, SecureUi.tsx, strings.ts), `public/oauth.html`.
Tests : `src/modules/mail/__tests__/secure.test.ts`, `npm run check:mailsecure` (port 4245 ; Microsoft et Google rejoués, 6 écrans).

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

### Google (gratuit en mode test)

1. Va sur https://console.cloud.google.com → **Nouveau projet** → nom `In 1 Mail`.
2. **API et services** → **Bibliothèque** → cherche **Gmail API** → **Activer**.
3. **Google Auth Platform** (écran de consentement OAuth) → **Commencer** :
   - Nom de l'appli : `In 1 Mail` ; e-mail d'assistance : le tien.
   - Audience : **Externe**.
   - Page d'accueil : `https://fisbal.github.io/oi1/` ; confidentialité : `https://fisbal.github.io/oi1/privacy.html` ; conditions : `https://fisbal.github.io/oi1/terms.html`.
4. **Audience** → laisse **En test** → **Utilisateurs test** → ajoute ton adresse Gmail (et jusqu'à 100 testeurs).
5. **Accès aux données** → **Ajouter des champs d'application** → `https://www.googleapis.com/auth/gmail.modify` → **Enregistrer**.
6. **Clients** → **Créer un client** → type **Application Web** :
   - Origines JavaScript autorisées : `https://fisbal.github.io`
   - URI de redirection autorisés : `https://fisbal.github.io/oi1/oauth.html`
7. **Créer**. Copie l'**ID client** (finit par `.apps.googleusercontent.com`) et envoie-le moi.

Plus tard, pour ouvrir la lecture Gmail à tout le monde : passer l'appli « En production » ; Google exige alors une vérification et un audit de sécurité annuel (CASA) payant pour la portée Gmail. Décision de Martin (2026-11-13) : rester en mode test d'abord.
