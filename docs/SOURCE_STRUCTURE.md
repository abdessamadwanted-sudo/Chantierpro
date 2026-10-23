# SOURCE_STRUCTURE — arborescence réelle (branche `siteteam`)

Seuls les fichiers versionnés sont listés. Les dossiers de la liste-type « src/, components/, hooks/,
contexts/, stores/, routes/, api/, backend/, database/, migrations/, types/, tests/ » **n'existent pas** :
le projet n'utilise ni framework ni TypeScript. Leurs équivalents réels sont indiqués à droite.

```
.
├── .github/workflows/
│   ├── build-siteteam.yml          build APK à chaque push sur siteteam → release siteteam-v1.0.<n>
│   ├── export-source-snapshot.yml  export manuel : ZIP source + APK + AAB + lock → pré-release siteteam-backup-<n>
│   ├── st-test.yml                 test E2E (Playwright + émulateurs Firebase), branche siteteam-ci
│   └── pages.yml                   site web — déclenché seulement sur une branche inexistante (désactivé)
├── .gitignore
├── .env.example                    variables (valeurs fictives)
├── AGENTS.md                       consignes pour Codex
├── README.md
├── capacitor.config.json           appId com.siteteam.app, webDir www
├── package.json                    dépendances
├── package-lock.json               versions exactes (produit par le build CI du 23/10/2026)
├── assets/                         sources des icônes et splash (@capacitor/assets)
├── keystore/debug.keystore         clé de signature fixe (PRIVÉE — exclue des ZIP, voir SECURITY_NOTES.md)
├── ci/
│   ├── signing.sh                  déclare la clé fixe dans le Gradle généré
│   ├── rules.mjs                   extrait FIRESTORE_RULES de team.js → ci/firestore.rules
│   ├── firebase.json               config émulateurs (auth 9099, firestore 8080)
│   └── st.mjs                      scénario de test E2E (≈ « tests/ »)
├── docs/                           documentation (ce dossier) + firebase/firestore.rules + apps-script/Code.gs
└── www/                            ≈ « public/ » + « src/ » : application complète
    ├── index.html                  point d'entrée (ordre des scripts significatif)
    ├── styles.css                  tous les styles (954 lignes, thème clair/sombre)
    ├── icon.png
    ├── lib/                        NON versionné : pdf.js + pdf-lib copiés par `npm run copy-libs`
    ├── vendor/                     bibliothèques embarquées (versionnées)
    │   ├── firebase/               firebase-app/auth/firestore-compat.js (10.14.1)
    │   ├── jspdf.umd.min.js
    │   ├── 3d/                     three.min.js, OrbitControls.js, tesseract (OCR) + eng.traineddata.gz
    │   └── dxf/                    dxf-parser
    └── js/
        ├── app.js        (1363) écrans : accueil, projet, plans, tâches, photos, formulaires, rapports, équipe, paramètres ; démarrage
        ├── team.js       (755)  comptes, entreprise, rôles/permissions, invitations, formules, partage externe, push/pull Firestore, règles
        ├── reception.js  (811)  réception ferraillage / programme de bétonnage, exports, Google Sheets, rappels PV
        ├── viewer.js     (837)  visionneuse de plan : zoom, pins, liens, annotations
        ├── i18n.js       (523)  traduction de l'interface FR / AR / EN
        ├── m3d.js        (491)  modèles 3D coffrage + ferraillage (OCR nomenclature)
        ├── sync.js       (466)  synchronisation Drive (Apps Script) + orchestration Firestore
        ├── ui.js         (445)  composants UI partagés (sheet, menu, formSheet, photos, PDF)
        ├── pro.js        (433)  entreprises/lots, tableau de bord, signatures, rapports PDF
        ├── tools.js      (316)  outils PDF (fusion/division) + constats / non-conformités
        ├── calc.js       (266)  métré, béton, acier, pente, nivellement, coordonnées
        ├── fer.js        (261)  ferraillage détaillé par élément + dessin de barre
        ├── espace.js     (242)  espaces par service : topo, centrale, matériel, pointage, HSE, rendement
        ├── dxf.js        (179)  plans DXF vectoriels, zones colorées, 3D
        ├── sketch.js     (147)  tableau de dessin / croquis
        ├── backup.js     (104)  sauvegarde / restauration d'un projet (.chantier)
        ├── career.js      (88)  emploi & carrière — NON CHARGÉ par index.html (code mort)
        └── db.js          (88)  IndexedDB (« database/ ») — base `chantier` v4
```

## Correspondances avec la liste demandée
| Demandé | Réalité |
|---|---|
| components / pages | fonctions `render*` / `open*` dans `www/js/*.js` |
| hooks / contexts / stores | état global : objets `App`, `Team` (état `S`), `DB`, `localStorage` |
| services / api | `sync.js` (Drive), `team.js` (Firestore) |
| types / models | structures décrites dans DATABASE_SCHEMA.md (pas de types formels) |
| routes | `SECTIONS` dans `app.js` |
| backend | aucun ; script Apps Script (`docs/apps-script/Code.gs`) et règles Firestore |
| migrations | `onupgradeneeded` dans `db.js` ; `migratePerms` / `migrateCompanyPlan` dans `team.js` |
| tests | `ci/st.mjs` (E2E) uniquement |
| traductions | `www/js/i18n.js` |
| android / ios | `android/` généré au build (copie dans le ZIP d'export `siteteam-backup-*`) ; iOS absent |
