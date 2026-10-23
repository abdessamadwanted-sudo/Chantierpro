# SiteTeam — guide de sauvegarde et de reprise

Ce document permet à un autre développeur de reconstruire **le même SiteTeam** (même identifiant
d'application, même signature) sans dépendre d'aucune conversation. Il décrit l'état réel du dépôt
à la date de l'export ; ce qui n'est pas vérifié est signalé comme tel.

---

## 1. Ce qu'est SiteTeam

- Application hybride : HTML/CSS/JavaScript (dossier `www/`) emballée en APK Android par **Capacitor 6**.
- Identifiant Android (`applicationId`) : **`com.siteteam.app`** — nom affiché : **SiteTeam** (`capacitor.config.json`).
- Dépôt : `github.com/abdessamadwanted-sudo/Chantierpro`, **branche `siteteam`**
  (la branche `main` est une autre application, *Chantier*, `applicationId` différent).
- Comptes, entreprises, rôles, données partagées : **Firebase** (Auth + Cloud Firestore), projet `siteteam`.
- Fichiers lourds (plans, photos, PDF) : **Google Drive de chaque entreprise**, via un script Google Apps Script.
- Fonctionne hors connexion : les données sont d'abord dans le téléphone (IndexedDB), puis synchronisées.

### Point important : il n'y a pas de dossier `android/` versionné

`android/` est dans `.gitignore`. Il est **régénéré à chaque build** par `npx cap add android`, puis modifié
par les étapes du workflow (`.github/workflows/build-siteteam.yml`). Il n'existe **aucun code Java/Kotlin
écrit à la main** : tout le code natif vient des modèles officiels de Capacitor et de ses plugins.
Le ZIP de sauvegarde contient une copie du dossier `android/` tel que généré par le dernier build, pour
référence et pour ouverture directe dans Android Studio — mais la source de vérité reste la procédure ci-dessous.

Modifications appliquées au projet Android généré (dans cet ordre) :
1. `npx cap add android`
2. icônes et écran de démarrage : `npx @capacitor/assets generate --android …` (sources dans `assets/`)
3. `versionCode` = numéro du build, `versionName` = `1.0.<numéro>` (dans `android/app/build.gradle`)
4. ajout de la permission `android.permission.CAMERA` dans `AndroidManifest.xml`
5. `npx cap sync android`
6. `bash ci/signing.sh` : déclare la clé de signature fixe dans `android/app/build.gradle`

---

## 2. Versions requises

| Outil | Version utilisée par le build officiel |
|---|---|
| Node.js | 20 (`actions/setup-node`, `node-version: 20`) |
| npm | celle livrée avec Node 20 |
| Java (JDK) | 17, distribution Temurin |
| Capacitor | 6.x (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli` ^6.1.2 — version exacte dans `package-lock.json`) |
| Android SDK / Gradle / AGP | ceux du modèle Capacitor 6 : voir `android/variables.gradle` et `android/gradle/wrapper/gradle-wrapper.properties` dans le ZIP |

Les valeurs exactes constatées lors de l'export (`minSdk`, `compileSdk`, `targetSdk`, Gradle, versions des
plugins) sont dans **`BUILD-INFO.txt`**, généré par le même build que le ZIP.

Plugins Capacitor (voir `package.json`, versions exactes dans `package-lock.json`) :
`@capacitor/app`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/local-notifications`,
`@capacitor-community/file-opener`. Bibliothèques web : `pdfjs-dist 3.11.174`, `pdf-lib 1.17.1`
(copiées dans `www/lib/` par `npm run copy-libs`), Firebase JS SDK **10.14.1 (compat)** et jsPDF
fournis dans `www/vendor/`.

---

## 3. Reconstruire l'application

### 3.1 Installation

```bash
git clone https://github.com/abdessamadwanted-sudo/Chantierpro.git
cd Chantierpro
git checkout siteteam
npm ci                 # installe exactement package-lock.json (ou: npm install s'il n'y a pas de lock)
npm run copy-libs      # copie pdf.js et pdf-lib dans www/lib/
```

À partir du ZIP : décompresser, puis `npm ci && npm run copy-libs` dans le dossier `SiteTeam-source`.

### 3.2 Tester dans un navigateur (sans Android)

```bash
cd www && python3 -m http.server 8765
# ouvrir http://localhost:8765
```

### 3.3 Construire l'APK

Pré-requis : JDK 17 et Android SDK (Android Studio l'installe ; définir `ANDROID_HOME`).

```bash
rm -rf android                      # repartir du modèle, comme le build officiel
npx cap add android
npx @capacitor/assets generate --android --iconBackgroundColor '#0f172a' --iconBackgroundColorDark '#0f172a' --splashBackgroundColor '#0f172a' --splashBackgroundColorDark '#0f172a'
N=10   # numéro de version : TOUJOURS supérieur à celui déjà installé
sed -i -E "s/versionCode [0-9]+/versionCode $N/; s/versionName \"[^\"]*\"/versionName \"1.0.$N\"/" android/app/build.gradle
sed -i 's#<uses-permission android:name="android.permission.INTERNET" />#&\n    <uses-permission android:name="android.permission.CAMERA" />#' android/app/src/main/AndroidManifest.xml
npx cap sync android
bash ci/signing.sh

# variables de signature (voir .env.example et la section 4)
export ST_KEYSTORE=/chemin/absolu/vers/debug.keystore
export ST_KS_PASS=…  ST_KEY_ALIAS=…  ST_KEY_PASS=…

cd android && ./gradlew assembleDebug     # → app/build/outputs/apk/debug/app-debug.apk
            ./gradlew bundleDebug         # → app/build/outputs/bundle/debug/app-debug.aab
```

Vérifier la signature avant toute diffusion :

```bash
$ANDROID_HOME/build-tools/<version>/apksigner verify --print-certs app/build/outputs/apk/debug/app-debug.apk
# doit afficher SHA-256 : e3ecf43100a66eb4e55ef18aa18236a4374f56d0e3651ef30b62d9d058bee024
```

### 3.4 Build automatique (GitHub Actions)

- Chaque `push` sur `siteteam` (hors docs) lance **Build SiteTeam** → release `siteteam-v1.0.<n>` avec `SiteTeam.apk`.
- **Export source snapshot** (lancement manuel, onglet Actions) → pré-release `siteteam-backup-<n>` avec
  ZIP source, APK, AAB de contrôle, `package-lock.json`, `BUILD-INFO.txt`.
- **SiteTeam test (emulators)** (branche `siteteam-ci`) : test automatisé avec les émulateurs Firebase
  (`ci/st.mjs`, `ci/rules.mjs`, `ci/firebase.json`).

---

## 4. Signature et identité de l'application

Android n'accepte une mise à jour que si elle a **le même `applicationId` et le même certificat de signature**.

### 4.1 Situation réelle constatée (vérifiée sur les APK publiés)

| Version | Certificat SHA-256 |
|---|---|
| siteteam-v1.0.1 | `30:DD:BF:EC:…:75:FE:59:D8` |
| siteteam-v1.0.5 | `C1:D0:D3:47:…:DB:9E:EA:88` |
| siteteam-v1.0.6 | `A3:90:DD:1A:…:27:F7:6E:9C` |
| **à partir de siteteam-v1.0.9** | **`E3:EC:F4:31:00:A6:6E:B4:E5:5E:F1:8A:A1:82:36:A4:37:4F:56:D0:E3:65:1E:F3:0B:62:D9:D0:58:BE:E0:24`** |

Jusqu'à la v1.0.6 (et les builds intermédiaires), chaque APK SiteTeam a été signé par une **clé debug
aléatoire, créée puis jetée par le serveur de build** : la copie de `keystore/debug.keystore` vers
`~/.android/` n'était pas prise en compte par Gradle. **Ces anciennes clés n'existent plus nulle part
et ne peuvent pas être récupérées.** Conséquence : un téléphone qui a une ancienne version de SiteTeam
doit **désinstaller** l'application pour installer la v1.0.9 ou suivante (une seule fois). Les données
déjà synchronisées dans Firestore et Drive sont récupérées en se reconnectant ; les données restées
uniquement dans le téléphone sont perdues à la désinstallation, d'où la sauvegarde `.chantier` à faire
avant (section 5.3).

Depuis la v1.0.9, la clé est déclarée dans Gradle (`ci/signing.sh`) et le build **échoue** si l'empreinte
n'est pas `E3:EC:F4:31…`. Les mises à jour suivantes s'installent par-dessus sans désinstaller.

### 4.2 La clé actuelle

- Fichier : `keystore/debug.keystore` (dépôt GitHub, branche `siteteam` et `main`).
- Type : keystore **debug** Android standard. Alias `androiddebugkey`, propriétaire `CN=Android Debug, O=Android, C=US`,
  valide jusqu'en 2054. Mots de passe : les valeurs par défaut publiques de toute clé debug Android.
- C'est la **même clé que l'application Chantier** (branche `main`), qui l'utilise depuis le début.
- **Elle n'est volontairement pas dans le ZIP source.**

Elle est **publique** (le dépôt est public) : elle garantit la continuité des mises à jour par APK, mais
**pas** l'authenticité — n'importe qui peut signer un APK avec. Elle convient pour la distribution directe
d'APK, **pas pour Google Play**.

Sauvegarde privée : télécharger `keystore/debug.keystore` depuis GitHub et le ranger, avec la note
« alias androiddebugkey, empreinte E3:EC:F4:31… », dans un stockage personnel (gestionnaire de mots de
passe, Drive privé). Ne jamais générer une nouvelle clé « debug » pour la remplacer : les téléphones
existants refuseraient la mise à jour.

### 4.3 Avant Google Play (non fait)

Google Play refuse les builds signés avec une clé debug ou marqués *debuggable*. Il faudra :

1. Créer une **clé de publication** (upload key) avec `keytool -genkeypair`, la garder **hors de GitHub**,
   la sauvegarder à deux endroits privés avec ses mots de passe. La perte de cette clé bloque les mises à
   jour sur Play (récupérable seulement via la procédure de réinitialisation de clé d'importation de Google,
   si Play App Signing est activé).
2. Activer **Play App Signing** dans la Play Console.
3. Ajouter un `signingConfigs.release` lu depuis des **secrets GitHub Actions** et construire avec
   `./gradlew bundleRelease`.
4. Vérifier le `targetSdk` exigé par Google Play au moment de la publication (valeur actuelle dans `BUILD-INFO.txt`).
5. Préparer : politique de confidentialité (URL), formulaire « Sécurité des données », et une
   **suppression de compte** depuis l'app et par lien web (obligatoire pour une app avec création de compte —
   **absente aujourd'hui**).

Note : une app installée par APK (clé debug) et la même app installée depuis Play (autre clé) ne peuvent
pas se mettre à jour l'une l'autre ; les utilisateurs passeront une fois par une désinstallation.

---

## 5. Données : où elles sont, comment les sauvegarder

### 5.1 Uniquement dans le téléphone

| Emplacement | Contenu |
|---|---|
| IndexedDB, base **`chantier`**, **version 4** | magasins : `projects, folders, plans, tasks, links, files, forms, reports, receptions, items, tomb` (clé `id`, index `projectId` sauf `projects`) |
| IndexedDB `files` | fichiers binaires (plans, photos, PDF) en `Blob` — envoyés au Drive seulement si Drive est connecté |
| localStorage `team.*` | cache de session : entreprise, membre, droits, dernière synchro |
| localStorage `sync.cfg` | URL + clé du script Drive de l'entreprise |

Migrations IndexedDB : il n'y a pas de script de migration ; à l'ouverture, `onupgradeneeded`
(`www/js/db.js`) crée les magasins manquants. Toute nouvelle version doit **augmenter `VERSION`** et
**ne jamais supprimer** un magasin existant.

### 5.2 Dans le cloud

**Cloud Firestore** (projet Firebase `siteteam`) — règles complètes : `docs/firebase/firestore.rules`
(source de vérité : constante `FIRESTORE_RULES` dans `www/js/team.js`, copiable depuis l'app :
Mon entreprise › Réglages › Copier les règles).

```
users/{uid}                                   profil, entreprise courante
invites/{code}                                invitations d'équipe (code à usage unique)
shares/{code}                                 partages externes d'un projet (accès limité + journal)
companies/{cid}                               entreprise (nom, propriétaire, formule)
companies/{cid}/members/{uid}                 rôle, droits par module, projets autorisés
companies/{cid}/private/drive                 URL + clé du script Drive de l'entreprise
companies/{cid}/projects/{pid}                nom, adresse
companies/{cid}/projects/{pid}/m/{module}/r/{store__id}   chaque enregistrement (JSON) synchronisé
```

Index Firestore : aucun index composite n'est déclaré. Si Firestore en exige un pour une requête,
le message d'erreur (console du navigateur / logs) contient un lien direct pour le créer.
Fonctions serveur (Cloud Functions) : **aucune**. Hébergement Firebase : non utilisé.

**Google Drive** (compte Google de chaque entreprise) : dossier `SiteTeam/` créé par le script
`docs/apps-script/Code.gs`. Ce code est généré par l'app avec la clé de l'entreprise
(Mon entreprise › Réglages › Google Drive).

Configuration Drive : script.google.com → Nouveau projet → coller le code fourni par l'app →
Déployer → Nouveau déploiement → *Application Web* → Exécuter en tant que : **Moi**, Accès : **Tout le
monde** → copier l'URL `…/exec` dans l'app.

### 5.3 Sauvegarder et restaurer

| Quoi | Sauvegarde | Restauration |
|---|---|---|
| Un projet complet (données + photos + plans du téléphone) | Projet › Paramètres › **Sauvegarder ce projet** → fichier `.chantier` (à mettre dans Drive ou envoyer) | Accueil › ⋮ › **Restaurer une sauvegarde** |
| Données Firestore (toute l'entreprise) | Console Firebase / `gcloud firestore export gs://<bucket>` (nécessite la formule payante Blaze et un bucket) | `gcloud firestore import` |
| Fichiers Drive | Télécharger le dossier `SiteTeam/` depuis Drive (ou Google Takeout) | Re-déposer le dossier dans le Drive relié au script |
| Code + règles + script | Ce dépôt / le ZIP `siteteam-backup-*` | Section 3 |

Avant de désinstaller l'application (changement de clé, changement de téléphone) : faire une sauvegarde
`.chantier` de chaque projet.

---

## 6. Comptes et services dont le propriétaire doit avoir le contrôle

| Service | Usage | À vérifier |
|---|---|---|
| GitHub `abdessamadwanted-sudo/Chantierpro` | code, builds, releases | propriétaire du compte ; protection de branche active sur `main` |
| Firebase, projet `siteteam` | comptes, entreprises, données | console.firebase.google.com → le compte Google du propriétaire doit être **Owner** du projet |
| Compte Google + Apps Script | Drive de chaque entreprise | chaque entreprise possède son propre script et son Drive |
| Google Play Console | publication future | à créer (frais d'inscription uniques) |
| Domaine `chantierpro.ma` | adresse de contact `contact@chantierpro.ma` dans le code | provisoire : vérifier qu'il est acheté avant d'afficher l'adresse publiquement |

Configuration Firebase côté client : `FB_CONFIG` dans `www/js/team.js`. Ces valeurs ne sont pas secrètes ;
la protection vient des règles Firestore. Pour reprendre la main sur un autre projet Firebase : créer le
projet, activer Authentication (e-mail/mot de passe) et Firestore, publier `docs/firebase/firestore.rules`,
remplacer `FB_CONFIG`.

---

## 7. État fonctionnel

Terminé et en service :
- comptes Firebase, création/rejoindre une entreprise, organigramme, rôles par service (direction, travaux, ferraillage, centrale, topo, qualité, HSE, intervenants externes…), droits par module (0–4), invitations par code ;
- synchronisation des données par Firestore, fichiers par le Drive de l'entreprise ;
- projets, plans, réserves/tâches, photos, formulaires/PV, rapports journaliers, réception & bétonnage, constats, calculs/topo, espaces ;
- import des projets de l'application Chantier ;
- affichage de la formule commerciale (Basic/Personnel/Pro/Entreprise) et quota de comptes — **sans paiement** ;
- partage externe d'un projet (maître d'ouvrage, BET, sous-traitant…) par code, avec journal de réponses.

Limites connues / manquant :
- pas de facturation ni de paiement ; les formules sont affichées seulement ;
- partage externe : le périmètre est un texte libre, pas une restriction document par document ; pas de circuit d'approbation séquentiel/parallèle ;
- pas de suppression de compte dans l'app (requis par Google Play) ;
- pas de build *release* ni de clé de publication Google Play ;
- pas de notifications WhatsApp automatiques (envoi manuel via lien WhatsApp) ;
- aucun index Firestore ni fonction serveur déclarés ; aucun export automatique des données Firestore ;
- robustesse IndexedDB : en cas de fermeture de la connexion par le système pendant une longue synchro,
  l'erreur « database connection is closing » peut apparaître (connue sur Chantier) — à surveiller.
