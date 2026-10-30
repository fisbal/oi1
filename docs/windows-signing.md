# Installer Office In 1 sur Windows sans avertissement

## Pourquoi Windows avertit

`OfficeIn1-Setup.exe` n'a pas de signature numérique. Edge et SmartScreen disent alors
« n'est pas téléchargé fréquemment » et « éditeur inconnu ». Le fichier est sain : c'est le
même code que sur GitHub, construit par GitHub Actions.

## Installer aujourd'hui

1. **Sans .exe (le plus simple)** : ouvre https://fisbal.github.io/oi1/ dans Edge →
   menu **…** → **Applications** → **Installer ce site en tant qu'application**.
   L'app va dans le menu Démarrer et se met à jour toute seule.
2. **Installateur (10 Mo)** : https://github.com/fisbal/oi1/releases/latest/download/OfficeIn1-Setup.exe
   - Edge, Téléchargements : **…** → **Conserver** → **Afficher plus** → **Conserver quand même**.
   - SmartScreen : **Informations complémentaires** → **Exécuter quand même**.
   - Si Windows 11 bloque sans bouton « Exécuter quand même », c'est le *Contrôle intelligent
     des applications*. Ne le désactive pas (il ne se réactive pas sans réinstaller Windows) :
     utilise la méthode 1.

Une fois installée, l'app se met à jour toute seule (Tauri updater, `latest.json`).

## Supprimer l'avertissement pour de bon : signer le .exe

Le workflow `build.yml` signe déjà le .exe, le .msi et l'app **dès que les secrets ci-dessous
existent**. Sans eux, le build reste non signé et affiche une notice.

Service : **Azure Artifact Signing** (ex-Trusted Signing), environ 9,99 $ US / mois.
Ouvert aux particuliers au **Canada** et aux États-Unis.

Ce que Martin doit faire (une seule fois) :

1. Créer un compte Azure (https://portal.azure.com) avec une carte de crédit.
2. Créer une ressource **Artifact Signing account** (région proche, ex. *Canada Central* ou
   *East US*). Noter son **URL de point de terminaison** (ex. `https://eus.codesigning.azure.net`)
   et son **nom**.
3. **Identity validation** → *Individual* : vérification avec une pièce d'identité (quelques jours).
4. Créer un **Certificate profile** de type *Public Trust* (noter son nom).
5. Dans **Microsoft Entra ID** → *App registrations* : créer une app « oi1-signing », puis un
   *client secret*. Noter *Application (client) ID*, *Directory (tenant) ID* et le secret.
6. Sur le compte Artifact Signing → *Access control (IAM)* : donner à « oi1-signing » le rôle
   **Trusted Signing Certificate Profile Signer** (appelé aussi *Artifact Signing Certificate Profile Signer*).
7. Dans GitHub → `fisbal/oi1` → *Settings → Secrets and variables → Actions*, ajouter :

| Secret | Valeur |
| --- | --- |
| `AZURE_CLIENT_ID` | Application (client) ID |
| `AZURE_CLIENT_SECRET` | le secret |
| `AZURE_TENANT_ID` | Directory (tenant) ID |
| `AZURE_SIGNING_ENDPOINT` | ex. `https://eus.codesigning.azure.net` |
| `AZURE_SIGNING_ACCOUNT` | nom du compte Artifact Signing |
| `AZURE_SIGNING_PROFILE` | nom du certificate profile |

Les mêmes secrets servent pour toutes les apps de Martin (NavalOS, MarbleOS, DownloadOS…).

Note : même signé, un tout nouvel éditeur peut voir SmartScreen pendant quelques jours, le temps
que Microsoft apprenne la réputation de « Martin Balla ». Elle se garde ensuite d'une version à l'autre.

## Autre voie gratuite : Microsoft Store

Le compte développeur Microsoft Store est gratuit pour les particuliers depuis septembre 2025.
Une app publiée en **MSIX** est signée par Microsoft et s'installe sans aucun avertissement.
Inconvénients : chaque mise à jour passe une certification (1 à 3 jours) et les mises à jour
viennent du Store, pas de notre updater. À faire plus tard, quand Office In 1 sera public.

Sources : [Microsoft, options de signature](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options),
[Artifact Signing, prix](https://azure.microsoft.com/pricing/details/trusted-signing/),
[Store gratuit pour les particuliers](https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/),
[artifact-signing-cli](https://github.com/Levminer/trusted-signing-cli).
