# SiteTeam

Application de gestion de chantier BTP **en équipe** : entreprise, services, postes et droits, projets partagés,
plans, réserves, PV qualité, rapports, réception & bétonnage, topographie, centrale à béton, matériel,
pointage, HSE. Fonctionne hors connexion et se synchronise (Firebase + Google Drive de l'entreprise).

- Android : `com.siteteam.app` (Capacitor 6) · web : dossier `www/` (JavaScript sans framework)
- Branche de travail : **`siteteam`** — la branche `main` est l'application *Chantier*, distincte
- APK : onglet **Releases** → `siteteam-v1.0.<n>` → `SiteTeam.apk`

## Installation rapide
```bash
git checkout siteteam
npm ci                  # versions exactes (package-lock.json)
npm run copy-libs       # pdf.js + pdf-lib → www/lib/
cd www && python3 -m http.server 8765    # http://localhost:8765
```
APK / AAB : `docs/BUILD_INSTRUCTIONS.md`.

## Documentation
| | |
|---|---|
| Vue d'ensemble | `docs/PROJECT_OVERVIEW.md` |
| Architecture / arborescence | `docs/EXISTING_ARCHITECTURE.md`, `docs/SOURCE_STRUCTURE.md` |
| Fonctionnalités et état réel | `docs/FEATURES_INVENTORY.md` |
| Données | `docs/DATABASE_SCHEMA.md`, `docs/firebase/firestore.rules`, `docs/apps-script/Code.gs` |
| API, dépendances, variables | `docs/API_DOCUMENTATION.md`, `docs/DEPENDENCIES.md`, `docs/ENVIRONMENT_VARIABLES.md`, `.env.example` |
| Build Android | `docs/BUILD_INSTRUCTIONS.md`, `docs/CAPACITOR_SETUP.md` |
| Problèmes, sécurité | `docs/KNOWN_ISSUES.md`, `docs/SECURITY_NOTES.md` |
| Historique, suite | `docs/MIGRATION_NOTES.md`, `docs/DEVELOPMENT_ROADMAP.md` |
| Reprise complète (signature, sauvegarde des données) | `docs/REPRISE.md` |
| Audit, GitHub privé, liste de contrôle | `docs/SiteTeam_Technical_Audit.md`, `docs/SiteTeam_GitHub_Setup.md`, `docs/SiteTeam_Backup_Checklist.md` |
| Consignes pour Codex | `AGENTS.md` |

## Services externes nécessaires
Firebase (projet `siteteam` : Authentication + Firestore), un compte Google par entreprise pour le script
Drive (Apps Script), GitHub (Actions + Releases). Ils ne sont pas contenus dans le code : le propriétaire
doit en garder l'accès.
