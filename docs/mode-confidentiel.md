# Mode confidentiel (santé, juridique, dossiers clients)

Pour les personnes qui écrivent des notes sensibles (note évolutive, dossier patient, dossier client).

## Ce qu'il fait

| | Mode normal | Mode confidentiel |
|---|---|---|
| Grammaire | LanguageTool en ligne (le texte y est envoyé) | coupée ; l'orthographe reste, sur l'appareil |
| Traduction | navigateur, sinon MyMemory en ligne | seulement le traducteur du navigateur (sur l'appareil) ou une IA sur l'appareil |
| Copilote (IA) | au choix, y compris ChatGPT web ou une clé API | seulement IA du navigateur, In 1 AI, In 1 AI+, Ollama ou LM Studio (sur l'appareil) |
| Dictée | celle du navigateur (la voix va chez Google ou Microsoft) | Whisper sur l'appareil |
| Nuage (GitHub) | possible | coupé |
| Tout autre envoi | — | bloqué par le garde réseau, noté au journal, message à l'écran |
| Enregistrement auto, Notes, fichiers récents, noms des onglets | en clair dans le navigateur | chiffrés AES-256-GCM |
| Accès | libre | NIP (6 chiffres ou plus), verrouillage auto (1 à 120 min), bouton 🔒 |
| Journal | — | déverrouillages, NIP faux, fichiers ouverts/enregistrés/exportés/imprimés, envois bloqués ; export CSV |

## Comment c'est protégé

- Le NIP passe par PBKDF2-SHA-256 (600 000 tours, recommandation OWASP 2023), qui fabrique la clé protégeant une clé de données aléatoire de 256 bits. Le NIP n'est jamais enregistré.
- Une **clé de secours** (24 caractères) est montrée une seule fois. Sans NIP ni clé de secours, personne ne peut relire les notes, même pas l'équipe d'Office In 1.
- Après 5 NIP faux, l'attente augmente (30 s, 1 min, 2 min… jusqu'à 15 min).
- Quand c'est verrouillé, aucune app n'est ouverte : il n'y a rien à lire derrière l'écran.
- Tout utilise la cryptographie du navigateur (Web Crypto), sans service extérieur.

## Les limites, à dire honnêtement

- Un fichier qu'on enregistre soi-même hors de l'app (Word, PDF dans Téléchargements) n'est pas chiffré par Office In 1. Il faut le garder dans un endroit protégé (disque chiffré : BitLocker, FileVault ou téléphone avec code).
- Le dossier officiel du patient doit rester dans le système certifié de la clinique ou de l'établissement. Office In 1 aide à rédiger, il ne le remplace pas.
- Un appareil déjà infecté (logiciel espion) peut voir l'écran : l'antivirus de l'appareil reste nécessaire.
- Au Québec, la Loi 25 et la Loi sur les renseignements de santé et de services sociaux s'appliquent à l'organisation : ce mode aide (confidentialité, journal des accès), mais il ne remplace pas ses règles et son responsable de la protection des renseignements personnels.

Vérifié automatiquement à chaque changement (`npm run check:confidential`) sur téléphone, tablette (dans les deux sens), PC et Mac.
