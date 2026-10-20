#!/usr/bin/env bash
set -euo pipefail

VERSION_NAME="${1:-}"
VERSION_CODE="${2:-}"

if [[ ! "$VERSION_NAME" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Version name must use the format X.Y.Z (for example 1.0.0)." >&2
  exit 2
fi
if [[ ! "$VERSION_CODE" =~ ^[1-9][0-9]*$ ]]; then
  echo "Version code must be a positive integer." >&2
  exit 2
fi

APP_GRADLE="android/app/build.gradle"
ROOT_GRADLE="android/build.gradle"
WRAPPER="android/gradle/wrapper/gradle-wrapper.properties"
VARS="android/variables.gradle"
MANIFEST="android/app/src/main/AndroidManifest.xml"

for path in "$APP_GRADLE" "$ROOT_GRADLE" "$WRAPPER" "$VARS" "$MANIFEST"; do
  [[ -f "$path" ]] || { echo "Expected generated Android file not found: $path" >&2; exit 3; }
done

python3 - "$VERSION_NAME" "$VERSION_CODE" "$APP_GRADLE" "$ROOT_GRADLE" "$WRAPPER" "$VARS" "$MANIFEST" <<'PY'
import re
import sys
from pathlib import Path

version_name, version_code, app_gradle, root_gradle, wrapper, vars_gradle, manifest = sys.argv[1:]

p = Path(app_gradle)
s = p.read_text()
s, n_code = re.subn(r'versionCode\s+\d+', f'versionCode {version_code}', s, count=1)
s, n_name = re.subn(r'versionName\s+"[^"]*"', f'versionName "{version_name}"', s, count=1)
if n_code != 1 or n_name != 1:
    raise SystemExit('Could not set Android versionCode/versionName in generated build.gradle')
if 'signingConfigs {' in s:
    raise SystemExit('Generated build.gradle already has signingConfigs; refusing to patch ambiguously')
s, n = re.subn(
    r'(android\s*\{)',
    r'''\1
    signingConfigs {
        release {
            storeFile file(System.getenv('PLAY_UPLOAD_KEYSTORE_PATH'))
            storePassword System.getenv('PLAY_UPLOAD_STORE_PASSWORD')
            keyAlias System.getenv('PLAY_UPLOAD_KEY_ALIAS')
            keyPassword System.getenv('PLAY_UPLOAD_KEY_PASSWORD')
        }
    }
''', s, count=1)
if n != 1:
    raise SystemExit('Could not add release signing configuration')
s, n = re.subn(r'(buildTypes\s*\{\s*release\s*\{)', r'\1\n            signingConfig signingConfigs.release', s, count=1)
if n != 1:
    raise SystemExit('Could not attach the upload-key signing configuration to the release build')
p.write_text(s)

p = Path(root_gradle)
s = p.read_text()
s, n = re.subn(r"com\.android\.tools\.build:gradle:[0-9.]+", "com.android.tools.build:gradle:8.9.1", s, count=1)
if n != 1:
    raise SystemExit('Could not upgrade Android Gradle Plugin for API 36')
p.write_text(s)

p = Path(wrapper)
s = p.read_text()
s, n = re.subn(r'gradle-[0-9.]+-all\.zip', 'gradle-8.11.1-all.zip', s, count=1)
if n != 1:
    raise SystemExit('Could not upgrade the Gradle wrapper')
p.write_text(s)

p = Path(vars_gradle)
s = p.read_text()
s, n_compile = re.subn(r'compileSdkVersion\s*=\s*\d+', 'compileSdkVersion = 36', s, count=1)
s, n_target = re.subn(r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = 36', s, count=1)
if n_compile != 1 or n_target != 1:
    raise SystemExit('Could not set compileSdkVersion/targetSdkVersion to 36')
p.write_text(s)

p = Path(manifest)
s = p.read_text()
for permission in (
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.MODIFY_AUDIO_SETTINGS',
):
    line = f'    <uses-permission android:name="{permission}" />'
    if line not in s:
        anchor = '    <uses-permission android:name="android.permission.INTERNET" />'
        if anchor not in s:
            raise SystemExit('Could not find INTERNET permission in generated manifest')
        s = s.replace(anchor, anchor + '\n' + line, 1)
if 'android.permission.REQUEST_INSTALL_PACKAGES' in s:
    raise SystemExit('Play Store manifest must not request REQUEST_INSTALL_PACKAGES')
p.write_text(s)

p = Path('www/js/modules.js')
s = p.read_text()
old = 'const PLAY_STORE_BUILD = false;'
if s.count(old) != 1:
    raise SystemExit('Could not identify the Play Store build flag')
p.write_text(s.replace(old, 'const PLAY_STORE_BUILD = true;', 1))

p = Path('www/js/app.js')
s = p.read_text()
if s.count("const APP_VERSION = '__APP_VERSION__';") != 1:
    raise SystemExit('Could not identify the app version placeholder')
p.write_text(s.replace("const APP_VERSION = '__APP_VERSION__';", f"const APP_VERSION = '{version_name}';", 1))

p = Path('www/js/modules.js')
s = p.read_text()
if s.count("const NATIVE_ID = '__NATIVE_ID__';") != 1:
    raise SystemExit('Could not identify the native fingerprint placeholder')
import hashlib
fingerprint = hashlib.sha1((version_name + ':' + version_code).encode()).hexdigest()[:16]
p.write_text(s.replace("const NATIVE_ID = '__NATIVE_ID__';", f"const NATIVE_ID = '{fingerprint}';", 1))
PY

# Keep the upload key outside version control and ensure it is not accidentally committed.
cat >> .gitignore <<'EOF'

# Google Play upload signing key (never commit)
android/app/play-upload-key.jks
EOF

echo "Prepared Play Store Android build: version ${VERSION_NAME} (code ${VERSION_CODE}), target API 36."
