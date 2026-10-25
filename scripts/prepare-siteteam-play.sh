#!/usr/bin/env bash
# Prépare le projet Android généré (npx cap add android) pour la version Google Play de SiteTeam :
# version, signature avec la clé d'upload Play (secrets GitHub), API 36, pas d'installation d'APK ni de mise à jour hors Play.
set -euo pipefail
VERSION_NAME="${1:?version X.Y.Z}"; VERSION_CODE="${2:?versionCode}"; SIGNED="${3:-1}"
[[ "$VERSION_NAME" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Version X.Y.Z attendue" >&2; exit 2; }
python3 - "$VERSION_NAME" "$VERSION_CODE" "$SIGNED" <<'PY'
import re, sys, hashlib
from pathlib import Path
vn, vc, signed = sys.argv[1], sys.argv[2], sys.argv[3] == '1'
def sub(path, pat, rep, what, flags=0):
    p = Path(path); s = p.read_text(); s2, n = re.subn(pat, rep, s, count=1, flags=flags)
    if n != 1: raise SystemExit(f'Impossible de modifier {what} ({path})')
    p.write_text(s2)
g = 'android/app/build.gradle'
sub(g, r'versionCode\s+\d+', f'versionCode {vc}', 'versionCode')
sub(g, r'versionName\s+"[^"]*"', f'versionName "{vn}"', 'versionName')
if signed:
    sub(g, r'(android\s*\{)', r'''\1
    signingConfigs {
        release {
            storeFile file(System.getenv('PLAY_UPLOAD_KEYSTORE_PATH'))
            storePassword System.getenv('PLAY_UPLOAD_STORE_PASSWORD')
            keyAlias System.getenv('PLAY_UPLOAD_KEY_ALIAS')
            keyPassword System.getenv('PLAY_UPLOAD_KEY_PASSWORD')
        }
    }''', 'signingConfigs')
    sub(g, r'(buildTypes\s*\{\s*release\s*\{)', r'\1\n            signingConfig signingConfigs.release', 'signingConfig release')
sub('android/build.gradle', r'com\.android\.tools\.build:gradle:[0-9.]+', 'com.android.tools.build:gradle:8.10.1', 'Android Gradle Plugin')
sub('android/gradle/wrapper/gradle-wrapper.properties', r'gradle-[0-9.]+-all\.zip', 'gradle-8.11.1-all.zip', 'Gradle')
sub('android/variables.gradle', r'compileSdkVersion\s*=\s*\d+', 'compileSdkVersion = 36', 'compileSdk')
sub('android/variables.gradle', r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = 36', 'targetSdk')
m = Path('android/app/src/main/AndroidManifest.xml'); s = m.read_text()
for perm in ('android.permission.CAMERA', 'android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS'):
    line = f'    <uses-permission android:name="{perm}" />'
    if line not in s: s = s.replace('    <uses-permission android:name="android.permission.INTERNET" />', '    <uses-permission android:name="android.permission.INTERNET" />\n' + line, 1)
if 'REQUEST_INSTALL_PACKAGES' in s: raise SystemExit('La version Play ne doit pas demander REQUEST_INSTALL_PACKAGES')
m.write_text(s)
sub('www/js/modules.js', r"const PLAY_STORE_BUILD = false;", "const PLAY_STORE_BUILD = true;", 'PLAY_STORE_BUILD')
sub('www/js/app.js', r"const APP_VERSION = '__APP_VERSION__';", f"const APP_VERSION = '{vn}';", 'APP_VERSION')
sub('www/js/modules.js', r"const NATIVE_ID = '__NATIVE_ID__';", "const NATIVE_ID = 'play-" + hashlib.sha1(f'{vn}:{vc}'.encode()).hexdigest()[:10] + "';", 'NATIVE_ID')
PY
echo "Version Play prête : $VERSION_NAME (code $VERSION_CODE), API 36, signée=$SIGNED"
