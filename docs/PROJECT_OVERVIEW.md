# PROJECT_OVERVIEW — SiteTeam

> Décrit l'état réel de la branche `siteteam` du dépôt `abdessamadwanted-sudo/Chantierpro` (octobre 2026).
> Ce qui n'a pas été vérifié est marqué « Non vérifié ».

## En une phrase
SiteTeam est une application mobile Android (et page web) de gestion de chantier BTP **en équipe** :
une entreprise, ses services, ses postes et leurs droits, des projets partagés (plans, réserves, PV,
rapports, réception/bétonnage, topographie, centrale à béton, matériel, pointage, HSE…).

## Identité
| Élément | Valeur |
|---|---|
| Nom affiché | SiteTeam |
| applicationId Android | `com.siteteam.app` |
| Dépôt / branche | `github.com/abdessamadwanted-sudo/Chantierpro`, branche **`siteteam`** |
| Application voisine | branche `main` = application *Chantier* (personnelle, autre applicationId) — même dépôt, ne pas mélanger |
| Dernière version publiée | `siteteam-v1.0.9` (versionCode 9) et plus |
| Visibilité du dépôt | **public** (voir SECURITY_NOTES.md) |

## Technologies (réelles)
- **JavaScript « vanilla »** (ES2020, sans framework, sans TypeScript, sans bundler) + HTML + CSS.
- **Capacitor 6.2.2** pour l'APK Android (dossier `android/` généré au build, non versionné).
- **Firebase** (Auth e-mail/mot de passe + Cloud Firestore), SDK JS 10.14.1 *compat*, fourni dans `www/vendor/firebase/`.
- **Google Drive** via un script **Google Apps Script** propre à chaque entreprise (fichiers lourds).
- **IndexedDB** dans le téléphone (fonctionnement hors ligne).
- Bibliothèques embarquées : pdf.js 3.11.174, pdf-lib 1.17.1, jsPDF, three.js (3D), tesseract.js (OCR), dxf-parser.

## Ce qui n'existe pas
Pas de backend propre (pas de serveur Node, pas de Cloud Functions, pas d'API REST maison), pas de
dossier iOS, pas de version web publiée pour SiteTeam (le workflow Pages est désactivé sur cette branche),
pas de paiement, pas de tests unitaires (un seul test de bout en bout contre les émulateurs Firebase).

## Documents
| Document | Contenu |
|---|---|
| EXISTING_ARCHITECTURE.md | architecture, flux de données |
| SOURCE_STRUCTURE.md | arborescence fichier par fichier |
| FEATURES_INVENTORY.md | modules et état réel |
| DATABASE_SCHEMA.md | IndexedDB + Firestore + règles |
| API_DOCUMENTATION.md | API du script Drive, objets globaux JS |
| DEPENDENCIES.md | dépendances et versions exactes |
| BUILD_INSTRUCTIONS.md / CAPACITOR_SETUP.md | build web, APK, AAB |
| ENVIRONMENT_VARIABLES.md | variables et configuration |
| KNOWN_ISSUES.md / SECURITY_NOTES.md | problèmes connus, sécurité |
| MIGRATION_NOTES.md | historique et précautions de migration |
| DEVELOPMENT_ROADMAP.md | travaux identifiés, non commencés |
| REPRISE.md | guide de reprise complet (signature, sauvegarde des données) |
| SiteTeam_Technical_Audit.md | audit en 20 points |
| SiteTeam_GitHub_Setup.md / SiteTeam_Backup_Checklist.md | dépôt privé, liste de contrôle |
