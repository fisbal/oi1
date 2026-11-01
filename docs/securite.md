# Sécurité et droits d'auteur d'Office In 1

## Ce que le code fait déjà

| Risque | Protection | Où |
|---|---|---|
| Un document piégé (diapo, en-tête, réponse d'IA) qui exécute du code | HTML nettoyé par DOMPurify avant affichage ; test unitaire | `src/shell/safeHtml.ts` |
| Lettres et classeurs importés (.docx, .xlsx, collage) | L'éditeur (ProseMirror/TipTap) ne garde que les éléments de son schéma ; les cellules sont du texte | `src/modules/letter`, `src/modules/class` |
| Code de l'utilisateur dans Code+ | Aperçus dans des iframes `sandbox` sans `allow-same-origin` : ils ne peuvent pas lire les clés ni les documents | `src/modules/code` |
| Injection de plug-ins ou de `<base>` | Content-Security-Policy `object-src 'none'; base-uri 'self'` | `index.html` |
| Bibliothèques avec failles connues | Dependabot (npm, Actions, Rust). `npm audit` signale seulement nanoid 2 dans le correcteur Hunspell : appelé avec une taille fixe (45), il n’est pas touché par ces failles ; la mise à jour casserait le correcteur | `.github/dependabot.yml` |
| Erreurs de sécurité dans le code | CodeQL (security-extended) à chaque PR et chaque semaine | `.github/workflows/codeql.yml` |
| Note globale de sécurité | OpenSSF Scorecard chaque semaine | `.github/workflows/scorecard.yml` |
| Jeton de CI trop puissant | Lecture seule par défaut ; écriture seulement pour publier | `.github/workflows/build.yml` |
| Installateur modifié après la compilation | APK et mises à jour Windows/Mac signés (clés en secrets GitHub) + attestation de provenance SLSA | `build.yml` (job release) |
| Mise à jour du Store | Le Store charge https://fisbal.github.io/oi1/ en HTTPS ; le service worker ne met en cache que ce site | `public/sw.js` |

## Réglages à cliquer (une seule fois, par Martin)

1. **Secret scanning + push protection** : github.com/fisbal/oi1 → Settings → *Advanced Security* (ou *Code security*) →
   activer *Secret Protection* / *Secret scanning* et *Push protection*. Gratuit pour un dépôt public. GitHub bloque alors
   tout envoi qui contient une clé.
2. **Dependabot alerts + security updates** : même page → *Dependabot alerts* : Enable, *Dependabot security updates* : Enable.
3. **Private vulnerability reporting** : même page → *Private vulnerability reporting* : Enable.
4. **Code scanning** : rien à faire, le fichier `codeql.yml` l'active. (Ne pas choisir « Default setup » en plus, sinon deux analyses se gênent.)
5. **Protéger la branche main** : Settings → *Rules* → *Rulesets* → *New ruleset* → *New branch ruleset* :
   - Name : `main` ; Enforcement status : **Active** ; Target branches → *Add target* → *Include default branch*.
   - Cocher **Restrict deletions** et **Block force pushes**.
   - Cocher **Require a pull request before merging** avec *Required approvals* = **0**
     (sinon Claude ne peut plus fusionner les PR comme tu l'as demandé).
   - Cocher **Require status checks to pass** → *Add checks* → `web`.
   - Bypass list : laisser vide. → **Create**.
6. **Compte GitHub** : activer la double authentification (Settings du compte → *Password and authentication* →
   *Two-factor authentication*, avec une clé d'accès / passkey ou une appli). C'est la protection n° 1 : quiconque vole
   ton mot de passe peut sinon tout changer.

## Droits d'auteur

- Le droit d'auteur naît automatiquement à la création (Convention de Berne, art. 5(2) ; au Canada, Loi sur le droit
  d'auteur, art. 5 ; en France, CPI art. L111-1). Aucun dépôt n'est obligatoire.
- Un dépôt public **sans licence** = tous droits réservés, mais personne ne le sait. Le fichier `LICENSE` le dit clairement
  et `THIRD-PARTY-NOTICES.md` respecte les licences des bibliothèques utilisées (obligation des licences MIT/Apache/OFL/MPL).
- Le code généré par une IA pour toi : ton apport (choix, demandes, assemblage, corrections) est protégé ; la part
  purement générée l'est moins selon les pays (U.S. Copyright Office, *Copyright and Artificial Intelligence, Part 2*, 2025).
  D'où l'importance du nom et de la marque.
- Pour une preuve d'antériorité forte : l'historique Git daté sur GitHub en est déjà une ; on peut ajouter un enregistrement
  à l'OPIC (Canada, environ 50 à 65 $) ou une enveloppe e-Soleau à l'INPI (France, 15 €).
- Le **nom** « Office In 1 » n'est protégé que par une marque déposée (OPIC/INPI/EUIPO). Attention : « Office » est une
  marque de Microsoft ; un avis d'un professionnel avant de déposer est conseillé.

## Sources

OWASP Top 10 (2021) et XSS Prevention / Content Security Policy Cheat Sheets ; Cure53 DOMPurify ;
GitHub Docs (secret scanning, push protection, Dependabot, CodeQL, rulesets, artifact attestations) ;
OpenSSF Scorecard ; SLSA v1.0 (Build L2) ; Convention de Berne ; Loi sur le droit d'auteur (Canada) ; Code de la propriété
intellectuelle (France) ; U.S. Copyright Office 2025.

## Le Bouclier (antivirus et anti-arnaques intégré)

Bouton 🛡 sur l'accueil et dans la barre de chaque appli (sur PC). Il travaille en arrière-plan, sans rien envoyer :

| Ce qu'il fait | Comment | Fichier |
|---|---|---|
| Regarde dans chaque fichier avant de l'ouvrir | Macros VBA, objets OLE/ActiveX, modèles et liens distants (CVE-2017-0199, CVE-2021-40444, « Follina » CVE-2022-30190), champs DDE, RTF `\objdata`, PDF `/JavaScript` `/Launch` `/EmbeddedFile`, programmes déguisés (« facture.pdf » qui est un .exe, double extension), bombes zip, chemins `../` | `src/shell/shield/scan.ts` |
| Copie désinfectée en un clic | Retire macros, objets, ActiveX, liens distants et DDE ; garde texte, tableaux, images, styles (principe CDR) | `vaccine.ts` |
| Vérifie chaque lien cliqué dans un document | Schémas dangereux (`javascript:`), astuce « @ », lettres sosies (punycode), marques imitées (paypa1, paypal.com.faux.xyz), texte du lien qui ment, raccourcisseurs, extensions à risque | `links.ts` |
| Liste mondiale de sites dangereux, mise à jour chaque jour | ~510 000 sites (Phishing.Database MIT, Block List Project, URLhaus CC0), publiés en empreintes SHA-256 réparties en 256 petits fichiers : l'appli ne télécharge que celui dont elle a besoin, le site visité n'est jamais envoyé (comme Google Safe Browsing) | `feed.ts`, `.github/workflows/shield-feed.yml`, `scripts/shield-feed.py` |
| Anti-arnaque du texte collé | 16 familles (cartes-cadeaux, crypto, « nouveau RIB », code SMS demandé, faux support technique, colis, héritage, sextorsion…) en 5 langues ; plusieurs signes ensemble, jamais un mot seul | `scam.ts` |
| Vaccin | Toute menace « danger » devient un anticorps (empreinte du fichier ou nom du site) : bloquée tout de suite la prochaine fois, même hors ligne. « Partager avec tous » ouvre un ticket GitHub (empreinte seulement) ; quand Martin ajoute l'étiquette `approved`, l'antidote part dans la liste du lendemain pour tous les Office In 1 | `feed.ts`, onglet Vaccins |

Limites honnêtes : ce n'est pas un antivirus système (une page web ou une appli Store ne peut pas analyser tout l'ordinateur). Garder Windows Defender / la protection du téléphone. Un PDF dont le JavaScript est caché dans un flux compressé peut échapper à l'analyse rapide, mais Office In 1 n'exécute jamais ce code.

Sources : MITRE ATT&CK (T1204.002, T1221, T1559.002), oletools (P. Lagadec), pdfid (D. Stevens), APWG, Unicode TR #39, FBI IC3 2024, Centre antifraude du Canada, cybermalveillance.gouv.fr, Forrest et al. 1994 (systèmes immunitaires artificiels).
