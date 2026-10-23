#!/usr/bin/env bash
# Déclare la clé de signature fixe dans le projet Android généré (android/ n'est pas versionné :
# il est recréé à chaque build par « npx cap add android »).
# La clé (keystore/debug.keystore) et ses mots de passe sont fournis par variables d'environnement :
#   ST_KEYSTORE   chemin du keystore (défaut : keystore/debug.keystore à la racine du dépôt)
#   ST_KS_PASS    mot de passe du keystore
#   ST_KEY_ALIAS  alias de la clé
#   ST_KEY_PASS   mot de passe de la clé
set -euo pipefail
F=android/app/build.gradle
grep -q "SiteTeam : signature fixe" "$F" && { echo "déjà configuré"; exit 0; }
cat >> "$F" <<'EOF'

// SiteTeam : signature fixe (même certificat pour toutes les versions → mise à jour sans désinstaller)
android {
    signingConfigs {
        debug {
            storeFile file(System.getenv('ST_KEYSTORE') ?: '../../keystore/debug.keystore')
            storePassword System.getenv('ST_KS_PASS')
            keyAlias System.getenv('ST_KEY_ALIAS')
            keyPassword System.getenv('ST_KEY_PASS')
        }
    }
}
EOF
echo "signature fixe ajoutée à $F"
