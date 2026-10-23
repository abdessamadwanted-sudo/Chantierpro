# CAPACITOR_SETUP — SiteTeam

## Configuration (`capacitor.config.json`, versionné)
```json
{ "appId": "com.siteteam.app", "appName": "SiteTeam", "webDir": "www",
  "android": { "backgroundColor": "#0f172a" } }
```
Aucun `capacitor.config.ts`. Aucune configuration de serveur (l'app charge `www/` embarqué).

## Projet Android
- **Non versionné** (`android/` dans `.gitignore`), recréé par `npx cap add android` à chaque build.
- Une copie du projet généré (v1.0.9) est dans le ZIP de la pré-release `siteteam-backup-4`
  (`SiteTeam-source-1.0.9.zip`), utile pour Android Studio ; elle n'est pas la source de vérité.
- Code natif : uniquement `MainActivity.java` (modèle Capacitor, non modifié). Aucun code Kotlin/Java propre.
- `android/app/build.gradle` généré : `namespace`/`applicationId` `com.siteteam.app`, `release { minifyEnabled false }`,
  plugin google-services appliqué seulement si `google-services.json` existe (**il n'existe pas** : Firebase est
  utilisé via le SDK JavaScript, pas via le SDK Android).

| Élément | Valeur |
|---|---|
| Application ID | `com.siteteam.app` |
| versionCode / versionName | numéro du run GitHub Actions / `1.0.<n>` (injectés au build) |
| minSdk / compileSdk / targetSdk | 22 / 34 / 34 |
| Gradle | 8.2.1 |
| Variante construite | **debug** (`assembleDebug`) — aucune variante release configurée |
| Signature | clé fixe `keystore/debug.keystore` (SHA-256 `E3:EC:F4:31…E0:24`) via `ci/signing.sh` |

## Plugins (`capacitor.plugins.json` généré)
`@capacitor/app`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/local-notifications`,
`@capacitor-community/file-opener` — versions : DEPENDENCIES.md.
`CapacitorHttp` (intégré à Capacitor) est utilisé en repli pour appeler le script Drive.

## Permissions Android
Déclarées dans le manifeste de l'app : `INTERNET` (modèle), `CAMERA` (ajoutée par le workflow).
Les plugins ajoutent leurs propres permissions lors de la fusion du manifeste (ex. notifications) —
**liste fusionnée non vérifiée** dans cet export (`aapt2 dump permissions <apk>` pour la consulter).
`android:allowBackup="true"` (valeur du modèle).

## Icônes et écran de démarrage
Sources : `assets/icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`, `splash-dark.png`.
Génération : `npx @capacitor/assets generate --android` avec fond `#0f172a` (clair et sombre).

## Générer chaque version
| Cible | Commande | État |
|---|---|---|
| Web | servir `www/` | fonctionne (test E2E sur Chromium, viewport 390×800) |
| APK de test | `./gradlew assembleDebug` | fonctionne (builds CI verts, v1.0.9 vérifié signé) |
| AAB de contrôle | `./gradlew bundleDebug` + `jarsigner` | construit le 23/10/2026 ; non installable via Play |
| AAB Google Play | `./gradlew bundleRelease` + clé de publication | **non configuré** (voir BUILD_INSTRUCTIONS.md §4) |
| iOS | `npm i @capacitor/ios && npx cap add ios` (Mac + Xcode) | **absent, jamais essayé** |
