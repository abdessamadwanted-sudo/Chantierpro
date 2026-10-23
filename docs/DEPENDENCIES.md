# DEPENDENCIES — SiteTeam

Versions **constatées** lors du build d'export du 23/10/2026 (fichier `BUILD-INFO.txt` de la pré-release
`siteteam-backup-4`), installées depuis `package.json` (plages `^`). Le fichier `package-lock.json`
correspondant est fourni à la racine pour réinstaller exactement ces versions (`npm ci`).

## npm — dépendances (package.json)
| Paquet | Plage déclarée | Version installée | Rôle |
|---|---|---|---|
| @capacitor/core | ^6.1.2 | 6.2.2 | runtime Capacitor |
| @capacitor/android | ^6.1.2 | 6.2.2 | plateforme Android |
| @capacitor/app | ^6.0.1 | 6.0.3 | bouton retour, cycle de vie |
| @capacitor/filesystem | ^6.0.1 | 6.0.4 | écriture de fichiers (export, partage) |
| @capacitor/share | ^6.0.2 | 6.0.4 | partage système (WhatsApp…) |
| @capacitor/local-notifications | ^6.1.0 | 6.1.3 | rappels |
| @capacitor-community/file-opener | ^6.0.0 | 6.0.1 | ouvrir PDF/DWG avec une autre app |
| pdfjs-dist | 3.11.174 | 3.11.174 | lecture/rendu PDF (copié dans www/lib) |
| pdf-lib | 1.17.1 | 1.17.1 | fusion/division PDF (copié dans www/lib) |

## npm — dépendances de développement
| Paquet | Plage | Installé | Rôle |
|---|---|---|---|
| @capacitor/cli | ^6.1.2 | 6.2.2 | `npx cap add/sync` |
| @capacitor/assets | ^3.0.5 | 3.0.5 | génération icônes/splash |

Outils utilisés seulement par le test E2E (installés à la volée, hors package.json) :
`firebase-tools@13`, `playwright@1.47.2` (Chromium).

## Bibliothèques embarquées dans `www/vendor/` (versionnées, hors npm)
| Bibliothèque | Version | Usage |
|---|---|---|
| Firebase JS SDK *compat* (app, auth, firestore) | 10.14.1 | comptes et données partagées |
| jsPDF (UMD) | non vérifié (pas d'en-tête de version relevé) | génération PDF |
| three.js + OrbitControls | non vérifié | 3D |
| tesseract.js + modèle `eng` | non vérifié | OCR des nomenclatures |
| dxf-parser | non vérifié | lecture DXF |

## Android (projet généré)
| Élément | Valeur |
|---|---|
| minSdkVersion / compileSdkVersion / targetSdkVersion | 22 / 34 / 34 |
| Gradle wrapper | 8.2.1 |
| AndroidX | activity 1.8.0, appcompat 1.6.1, coordinatorlayout 1.2.0, core 1.12.0, fragment 1.6.2, core-splashscreen 1.0.1, webkit 1.9.0 |
| cordova-android (compat plugins) | 10.1.1 |

## Outils de build
Node 20 (20.20.2), npm 10.8.2, JDK 17 Temurin (17.0.20.1), Android SDK du runner `ubuntu-latest` de GitHub.

## Services externes (hors code)
Firebase (Auth, Firestore), Google Apps Script + Google Drive, GitHub (dépôt, Actions, Releases), WhatsApp (liens `wa.me`).
