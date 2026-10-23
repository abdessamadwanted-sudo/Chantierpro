# SiteTeam — Audit technique (état au 23/10/2026)

Branche `siteteam`, dernier build vérifié : **v1.0.9** (APK et AAB téléchargés et signatures contrôlées).
Méthode : lecture du code versionné, des workflows, des APK publiés et du dernier rapport de test E2E.
« Non vérifié » = non contrôlable depuis cet environnement (pas d'accès à la console Firebase, ni aux Drive, ni à un appareil).

| # | Sujet | Constat |
|---|---|---|
| 1 | **Framework** | Aucun framework front. Capacitor 6.2.2 pour l'emballage Android. |
| 2 | **Langages** | JavaScript (ES2020, 7 815 lignes dans `www/js`), HTML, CSS ; Google Apps Script (JS) ; YAML/Bash pour la CI. Pas de TypeScript, pas de Java/Kotlin propre. |
| 3 | **Architecture** | Client « local d'abord » (IndexedDB) + Firestore pour les données partagées + Drive (Apps Script) pour les fichiers. Aucun serveur applicatif. → EXISTING_ARCHITECTURE.md |
| 4 | **Repository** | Dépôt `abdessamadwanted-sudo/Chantierpro` **public**, deux applications sur deux branches (`main` = Chantier, `siteteam` = SiteTeam). `android/`, `www/lib/`, `node_modules/` non versionnés ; `package-lock.json` versionné depuis le 23/10/2026. → SOURCE_STRUCTURE.md |
| 5 | **Frontend** | Rendu par `innerHTML`, fonctions globales, `app.js` (1 363 lignes) concentre les écrans. 3 langues (FR/AR/EN). Bibliothèques lourdes (3D, OCR) chargées à la demande. |
| 6 | **Backend** | Aucun. Logique serveur limitée aux règles Firestore et au script Apps Script. Pas de Cloud Functions, webhooks ni tâches programmées. |
| 7 | **Database** | IndexedDB `chantier` v4 (11 magasins) ; Firestore (`users`, `companies` + sous-collections, `invites`, `shares`). Pas de schéma formel ni d'index déclaré. → DATABASE_SCHEMA.md |
| 8 | **Authentication** | Firebase Auth e-mail/mot de passe, connexion obligatoire, réinitialisation par e-mail. Pas de suppression de compte, pas de connexion Google/téléphone. |
| 9 | **Fichiers** | Blobs dans IndexedDB, envoyés vers le Drive de l'entreprise via Apps Script (base64, 3 envois parallèles). Pas de quota contrôlé. Firebase Storage non utilisé. |
| 10 | **Permissions** | 12 services, 43 postes, 16 modules × 5 niveaux, projets autorisés, admins. Appliquées côté serveur par les règles Firestore (refus vérifiés par le test E2E). Fichiers Drive hors de ce contrôle (clé partagée). |
| 11 | **Capacitor** | `com.siteteam.app`, minSdk 22, target/compile 34, Gradle 8.2.1, variante **debug** uniquement, signature fixe depuis v1.0.9. 5 plugins. → CAPACITOR_SETUP.md |
| 12 | **Dépendances** | 9 paquets npm + 2 de dev (versions exactes dans package-lock.json) ; Firebase 10.14.1, jsPDF, three.js, tesseract, dxf-parser embarqués (versions de ces 4 dernières non vérifiées). → DEPENDENCIES.md |
| 13 | **Scripts de build** | `npm run copy-libs` ; workflows `build-siteteam.yml` (APK + release), `export-source-snapshot.yml` (ZIP/APK/AAB), `st-test.yml` (E2E), `pages.yml` (désactivé). `ci/signing.sh`, `ci/rules.mjs`. |
| 14 | **Tests** | Un scénario E2E Playwright contre émulateurs Firebase (`ci/st.mjs`) — dernier résultat 14/10/2026 sans erreur. Aucun test unitaire. Le partage externe (20/10) n'est pas couvert. |
| 15 | **Performances** | APK ≈ 12,7 Mo. La réception (`Team.pull`) fait une requête par projet × module, séquentiellement : coût croissant avec le nombre de projets. Rendu `innerHTML` complet des listes. Mesures sur appareil : **non vérifié**. |
| 16 | **Sécurité** | Dépôt public avec clé de signature debug ; clé Drive lisible par tous les membres ; règles publiées manuellement (version en production non vérifiée) ; `responses` réécrivable ; pas d'App Check. → SECURITY_NOTES.md |
| 17 | **Bugs** | Signatures aléatoires jusqu'à v1.0.8 (corrigé) ; connexion IndexedDB non rouverte ; index éventuel pour `shares` (non vérifié) ; `career.js` non chargé. → KNOWN_ISSUES.md |
| 18 | **Dette technique** | Globaux sans modules ; gros fichiers (`app.js`, `team.js`, `reception.js`) ; deux branches divergentes partageant beaucoup de code ; règles Firestore stockées dans une chaîne JS ; pas de schéma de données ; `android/` régénéré par des `sed`. |
| 19 | **Multi-plateforme** | Android téléphone : utilisé. Navigateur (Chromium, format téléphone) : testé en E2E. Tablette Android, navigateurs desktop (Windows/macOS/Linux) : **non vérifié** — l'interface est conçue pour un téléphone. iPhone/iPad : **pas de projet iOS** ; nécessiterait `@capacitor/ios`, un Mac, Xcode, un compte Apple Developer, et une vérification des plugins et du SDK Firebase compat dans WKWebView. **Rien n'est prêt pour iOS.** |
| 20 | **Fonctionnalités manquantes** | Paiement/quotas réels, suppression de compte, build release Google Play (targetSdk 36), notifications push, messagerie, planning, laboratoire, gestion administrative, catalogue technique (présent seulement sur `main`), partage externe avec accès réel aux documents, version web publiée, iOS. → DEVELOPMENT_ROADMAP.md |

## Validation de la sauvegarde (effectuée le 23/10/2026)
1. Fichiers principaux : présents (`package.json`, `package-lock.json`, `capacitor.config.json`, `www/index.html`, 18 fichiers `www/js`, `styles.css`, `vendor/`, `assets/`, workflows, `ci/`).
2. Arborescence : identique au dépôt Git (archive produite par `git archive`).
3. Dépendances : `npm install` exécuté sur GitHub Actions le 23/10/2026, sans erreur ; lock produit à ce moment.
4. Manquants volontaires : `keystore/` (clé privée), `www/lib/` et `android/` (générés), `node_modules/`.
5. Installation : `npm install` + `cap add android` + build réussis en CI. **Non exécutable dans l'environnement de cet export** (pas d'accès au registre npm ni au SDK Android) : seules des vérifications de syntaxe (`node --check`) y ont été faites.
6. Builds : APK v1.0.9 et AAB v1.0.9 construits en CI ; signatures contrôlées (SHA-256 E3:EC:F4:31…E0:24).
7. Erreurs : premier workflow d'export en échec (YAML, corrigé) ; artefacts Actions non téléchargeables depuis cet environnement (contourné par une pré-release).
8. Plateformes testées : Chromium (E2E, 14/10) ; Android (usage réel du propriétaire, pas de test automatisé).
9. À récupérer manuellement : voir SiteTeam_Backup_Checklist.md (clé de signature, accès Firebase, scripts Drive et leurs Drive, données Firestore).
10. Restauration sur une autre machine : BUILD_INSTRUCTIONS.md + REPRISE.md.
