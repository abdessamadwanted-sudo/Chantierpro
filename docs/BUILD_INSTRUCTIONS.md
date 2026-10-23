# BUILD_INSTRUCTIONS — SiteTeam

Pré-requis : Git, Node 20, npm 10. Pour Android : JDK 17 + Android SDK (Android Studio), `ANDROID_HOME` défini.

## 1. Récupérer le projet
```bash
git clone https://github.com/abdessamadwanted-sudo/Chantierpro.git
cd Chantierpro && git checkout siteteam
# ou : décompresser SiteTeam_Source_Code.zip
npm ci              # versions exactes de package-lock.json
npm run copy-libs   # copie pdf.js et pdf-lib dans www/lib/ (obligatoire, www/lib n'est pas versionné)
```

## 2. Version web
Aucune compilation : `www/` est servi tel quel.
```bash
cd www && python3 -m http.server 8765      # puis http://localhost:8765
```
- `?emu=1` dans l'URL connecte l'app aux émulateurs Firebase locaux (tests).
- Publication web : non configurée pour SiteTeam (`pages.yml` désactivé sur cette branche). Tout hébergement
  statique (Firebase Hosting, GitHub Pages, Netlify…) conviendrait — **non fait, non testé**.
- La valeur `__APP_VERSION__` reste affichée telle quelle hors build CI.

## 3. APK de test
Voir CAPACITOR_SETUP.md pour le détail. Résumé :
```bash
rm -rf android && npx cap add android
npx @capacitor/assets generate --android --iconBackgroundColor '#0f172a' --iconBackgroundColorDark '#0f172a' --splashBackgroundColor '#0f172a' --splashBackgroundColorDark '#0f172a'
N=10   # > dernier versionCode installé
sed -i -E "s/versionCode [0-9]+/versionCode $N/; s/versionName \"[^\"]*\"/versionName \"1.0.$N\"/" android/app/build.gradle
sed -i 's#<uses-permission android:name="android.permission.INTERNET" />#&\n    <uses-permission android:name="android.permission.CAMERA" />#' android/app/src/main/AndroidManifest.xml
npx cap sync android
bash ci/signing.sh
export ST_KEYSTORE=/chemin/absolu/debug.keystore ST_KS_PASS=… ST_KEY_ALIAS=… ST_KEY_PASS=…
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```
Sur GitHub : chaque push sur `siteteam` → workflow **Build SiteTeam** → release `siteteam-v1.0.<n>` (`SiteTeam.apk`).

## 4. AAB
- AAB de contrôle (même clé debug) : `./gradlew bundleDebug` puis signature
  `jarsigner -keystore <keystore> <aab> <alias>` (Gradle ne signe pas le bundle debug). Fait automatiquement
  par le workflow **Export source snapshot**. **Non accepté par Google Play.**
- **AAB pour Google Play : pas encore possible en l'état.** Il faut d'abord : clé de publication privée,
  `signingConfigs.release` lue depuis des secrets, `./gradlew bundleRelease`, `targetSdk` 36 (Capacitor
  à migrer), suppression de compte dans l'app. Détails : REPRISE.md §4.3 et DEVELOPMENT_ROADMAP.md.

## 5. Vérifications après build
```bash
$ANDROID_HOME/build-tools/<v>/apksigner verify --print-certs app-debug.apk   # SHA-256 attendu : e3ecf431…e024
$ANDROID_HOME/build-tools/<v>/aapt2 dump badging app-debug.apk | grep -E "package:|targetSdk"
node --check www/js/*.js    # syntaxe JS (à lancer fichier par fichier)
```

## 6. Test E2E (émulateurs Firebase)
Workflow `st-test.yml` sur la branche `siteteam-ci` ; en local :
```bash
npm i -g firebase-tools@13 && npm i --no-save playwright@1.47.2 && npx playwright install chromium
node ci/rules.mjs
(cd ci && firebase emulators:start --only auth,firestore --project siteteam) &
(cd www && python3 -m http.server 8765) &
node ci/st.mjs        # résultats dans ci-out/
```
