# EXISTING_ARCHITECTURE — SiteTeam

## Vue d'ensemble

```
 Téléphone Android (APK Capacitor)  ou  navigateur
 ┌──────────────────────────────────────────────────────────┐
 │ www/index.html  →  scripts chargés dans l'ordre (globaux) │
 │   db.js (IndexedDB) · ui.js · viewer.js · backup.js       │
 │   Firebase compat (app/auth/firestore)                    │
 │   sync.js (Sync) · team.js (Team) · modules métier         │
 │   app.js (écrans, navigation, démarrage)                  │
 └───────────────┬───────────────────────────┬──────────────┘
                 │ enregistrements (JSON)    │ fichiers (Blob → base64)
                 ▼                           ▼
       Cloud Firestore (projet Firebase   Script Google Apps Script
       « siteteam ») — règles serveur      de l'entreprise → Google Drive
       dans www/js/team.js                 « Mon Drive / SiteTeam / <Projet> / … »
```

Il n'y a **aucun serveur applicatif** : la logique est dans le client, la sécurité des données
partagées repose sur les **règles Firestore**, et l'accès au Drive sur une **clé partagée** du script.

## Chargement
- Aucun bundler, aucun module ES : chaque fichier `www/js/*.js` déclare des fonctions/constantes **globales**
  ou un objet module (IIFE) : `DB`, `Sync`, `Team`, `Backup`, `Lang`…
- L'ordre des `<script>` dans `www/index.html` est donc significatif.
- Démarrage : `app.js` (ligne ~1280) → `Team.boot()` (connexion obligatoire, chargement de l'entreprise et des droits)
  → `renderHome()` → `Sync.start()`.
- Navigation : rendu par `innerHTML` dans `#app` ; feuilles du bas dans `#sheet-root` ; pile « retour »
  (`pushBack`) reliée au bouton retour Android (`@capacitor/app`).

## Données
1. **Local d'abord** : chaque écran lit/écrit IndexedDB (`DB.put/all/byProject…`), base `chantier` v4.
2. **Synchronisation** (`sync.js`, `Sync.run`) :
   - fichiers binaires (`files`) → `call('upload')` vers le script Apps Script de l'entreprise (si Drive connecté) ;
   - enregistrements → `Team.push()` vers Firestore, filtrés par les droits du membre ;
   - réception → `Team.pull()` depuis Firestore (incrémental par horodatage serveur `srv`, par projet et par module).
   - Sans connexion SiteTeam (`Team` non prêt), `sync.js` sait encore parler au `db.json` du script Drive
     (mode hérité de l'application Chantier).
3. **Suppressions** : magasin `tomb` puis enregistrement `deleted: true` côté Firestore.

## Sécurité / droits
- **Rôles** (43) répartis en **12 services** ; **16 modules** ; **5 niveaux** (0 aucun · 1 voir · 2 modifier · 3 valider · 4 administrer).
- Un membre = `{ role, service, perms{module:niveau}, admin, allProjects, projects[] }` dans
  `companies/{cid}/members/{uid}`.
- Côté client : `Team.lvl(mod)`, `Team.canSection()`, `Team.canProject()` masquent les écrans / passent en lecture seule.
- Côté serveur : règles Firestore (`FIRESTORE_RULES` dans `team.js`) — appartenance, admin, projet autorisé, niveau ≥ 1 pour lire, ≥ 2 pour écrire.
- **Formule commerciale** (`PLANS`) : affichage et quota de comptes seulement ; **non appliquée** côté serveur, pas de paiement.

## Fichiers et Drive
- Le script Apps Script (`docs/apps-script/Code.gs`, généré par l'app avec une clé aléatoire) est déployé
  par l'administrateur sur **son** compte Google ; URL + clé stockées dans `companies/{cid}/private/drive`
  et distribuées automatiquement aux membres.
- Rangement : `SiteTeam/<Projet>/<section>/…` ; PDF automatiques rangés par date.

## Natif (Android)
- Projet Android **généré** à chaque build (`npx cap add android`) ; seul code natif : `MainActivity.java`
  par défaut de Capacitor. Plugins : app, filesystem, share, local-notifications, file-opener.
- Modifications de build : version, permission CAMERA, icônes/splash, signature fixe (`ci/signing.sh`).

## Points d'architecture à connaître avant de modifier
- Tout est global : un nom de fonction en double écrase l'autre silencieusement.
- `app.js` contient l'essentiel des écrans (1 363 lignes) ; `team.js` toute la partie comptes/droits/Firestore.
- `__APP_VERSION__` (app.js) est remplacé par le workflow de build ; ne pas le remplacer à la main.
- Le nom de base IndexedDB est `chantier` (hérité) : ne pas le renommer, sinon les données locales sont perdues.
