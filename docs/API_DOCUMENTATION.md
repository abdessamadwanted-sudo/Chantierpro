# API_DOCUMENTATION — SiteTeam

SiteTeam n'expose **aucune API REST maison** et n'a **aucun serveur**. Les « API » réelles sont :
1. le SDK Firebase (Auth + Firestore) appelé depuis le client — voir DATABASE_SCHEMA.md ;
2. l'**application Web Google Apps Script** de chaque entreprise (Drive) ;
3. les objets JavaScript globaux qui servent d'interfaces internes entre fichiers.

Webhooks, Edge/Server Functions, tâches programmées côté serveur : **aucun**.

---

## 1. Script Google Apps Script (Drive)

Code : `docs/apps-script/Code.gs` (généré par l'app, `www/js/sync.js` › `script(key)`).
Déploiement : Application Web, exécuter en tant que « Moi », accès « Tout le monde ».

- `GET <url>` → `{ ok: true, app: "siteteam" }`
- `POST <url>` (corps texte JSON, `Content-Type: text/plain`) — champ commun `key` (doit égaler `KEY` du script, sinon `{ ok:false, error:"Clé invalide" }`)

| `action` | Entrée | Sortie |
|---|---|---|
| `ping` | `code?` (code de connexion, écrit une fois dans le Drive) | `{ ok, app:"siteteam", folder:<url du dossier>, now }` |
| `pull` | `since` (ms) | `{ ok, now, records:[…] }` — mode hérité `db.json` |
| `push` | `records:[{_store,id,updatedAt,_deleted?,…}]` | `{ ok, now }` — le plus récent (`updatedAt`) gagne ; suppression → fichier Drive mis à la corbeille |
| `upload` | `path:[segments]`, `name`, `mime`, `b64` **ou** `driveId` (déplacer/renommer) | `{ ok, id }` |
| `download` | `id` | `{ ok, mime, b64 }` |

Appel côté app : `Sync._call(action, body)` (fetch, puis repli `CapacitorHttp` sur Android).
Sécurité : uniquement la clé partagée — voir SECURITY_NOTES.md.

## 2. Synchronisation Google Sheets (réception)
`www/js/reception.js` génère un **second** script Apps Script (« Chantier → Google Sheets ») pour envoyer
les tableaux de réception dans une feuille Google. Fonctionnement non couvert par un test automatique.

## 3. Interfaces internes (objets globaux)

| Objet | Fichier | Fonctions publiques |
|---|---|---|
| `DB` | db.js | `uid`, `get`, `all`, `byProject`, `put`, `del`, `putRaw`, `delRaw`, `deleteProject`, `onChange` (IndexedDB) |
| `Sync` | sync.js | `start`, `run`, `schedule`, `enabled`, `hasDrive`, `openSyncSettings`, `statusLine`, `cfg`, `buildPaths`, `pathFor` |
| `Team` | team.js | `boot`, `push`, `pull`, `resetPull`, `lvl`, `canSection`, `canProject`, `isAdmin`, `openCompany`, `inviteFlow`, `logout`, `decorateSection`, `removeMember`, `refreshMembers`, `openProjectShares`, `claimShare`, `ready`, `me`, `uid`, `company`, `members`, `rules` |
| `Backup` | backup.js | `exportProject(projectId, onProgress)`, `importFile(file, onProgress)` |
| UI | ui.js | `sheet`, `menu`, `formSheet`, `alertBox`, `confirmBox`, `pickFiles`, `toast`, `loading`, `icon`, `esc`, `$`, `$$`, `pushBack`, `openUrl` |

Format de sauvegarde `.chantier` (backup.js) : une ligne JSON par enregistrement, fichiers encodés en base64.
