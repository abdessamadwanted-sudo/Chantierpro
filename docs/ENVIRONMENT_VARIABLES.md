# ENVIRONMENT_VARIABLES — SiteTeam

L'application elle-même **ne lit aucune variable d'environnement** (pas de bundler, pas de `.env` chargé).
Les variables ci-dessous servent **uniquement au build Android** (`ci/signing.sh` → `android/app/build.gradle`).
Modèle : `.env.example` (valeurs fictives).

| Variable | Utilisée par | Rôle | Valeur actuelle en CI |
|---|---|---|---|
| `ST_KEYSTORE` | build.gradle (généré) | chemin du keystore ; défaut `keystore/debug.keystore` | non définie (défaut) |
| `ST_KS_PASS` | build.gradle | mot de passe du keystore | défaut public des clés debug Android |
| `ST_KEY_ALIAS` | build.gradle | alias de la clé | `androiddebugkey` |
| `ST_KEY_PASS` | build.gradle | mot de passe de la clé | défaut public des clés debug Android |

Une future clé de publication Google Play devra être fournie par des **secrets GitHub Actions**
(Settings › Secrets and variables › Actions), jamais en clair dans un workflow ou un fichier.

## Configuration intégrée au code (non secrète)
| Où | Quoi | Remarque |
|---|---|---|
| `www/js/team.js` → `FB_CONFIG` | configuration client Firebase (apiKey, authDomain, projectId `siteteam`, appId…) | publique par conception ; la sécurité dépend des règles Firestore. Pour changer de projet Firebase : remplacer ces valeurs |
| `www/js/team.js` → `SUPPORT_EMAIL` | `contact@chantierpro.ma` | adresse provisoire |
| `www/js/team.js` → `apkLink()` | lien de téléchargement des releases GitHub | dépend du dépôt **public** |
| `capacitor.config.json` | appId, nom, couleur | — |

## Configuration saisie dans l'app (stockée côté utilisateur, pas dans le code)
| Donnée | Où elle vit |
|---|---|
| URL + clé du script Drive de l'entreprise | `companies/{cid}/private/drive` (Firestore) et `localStorage['sync.cfg']` |
| URL du script Google Sheets (réception) | `project.sheetsUrl` (IndexedDB, synchronisé avec le projet) |

Aucun secret serveur (service account, clé admin Firebase, token) n'est utilisé par le projet.
