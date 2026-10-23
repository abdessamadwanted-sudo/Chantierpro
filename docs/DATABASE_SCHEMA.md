# DATABASE_SCHEMA — SiteTeam

Deux bases, sans backend intermédiaire :

| | Fournisseur | Type | Où |
|---|---|---|---|
| Locale | navigateur / WebView Android | **IndexedDB** (NoSQL clé-valeur) | téléphone uniquement |
| Partagée | **Google Firebase — Cloud Firestore** | NoSQL documentaire | projet Firebase `siteteam` |
| Fichiers | **Google Drive** de chaque entreprise via Apps Script | stockage de fichiers | compte Google de l'entreprise |

Firebase Storage, Realtime Database, Cloud Functions, Hosting, webhooks et tâches programmées : **non utilisés**.

---

## 1. IndexedDB (`www/js/db.js`)

- Base : **`chantier`** (nom hérité de l'app Chantier — ne pas renommer) · **version 4**.
- Magasins (tous `keyPath: 'id'`, index `projectId` sur tous sauf `projects`) :

| Magasin | Contenu | Module de droits (`STORE_MOD`) |
|---|---|---|
| `projects` | projet ; contient aussi des sous-listes (`companies`, `team`, `calc`, `models3d`, `boards`, `rappels`, `quickLinks`…) | projet |
| `folders` | dossiers de plans | plans |
| `plans` | plans (pages, annotations) | plans |
| `links` | éléments/liens posés sur les plans | plans |
| `tasks` | réserves / tâches | reserves |
| `files` | fichiers binaires (`blob`) + `driveId`, `drivePath` | files |
| `forms` | formulaires / PV | forms |
| `reports` | rapports journaliers | rapports |
| `receptions` | tableaux réception / bétonnage | reception |
| `items` | éléments des espaces, champ `kind` : `impl`, `leve`, `cmd`, `bl`, `mat`, `stock`, `pt`, `hse`, `rdt` | selon `kind` (`KIND_MOD`) |
| `tomb` | suppressions en attente de synchronisation | — |

Champs communs constatés : `id` (généré : horodatage base36 + aléatoire), `projectId`, `updatedAt`.
Les autres champs sont définis par chaque écran ; **il n'existe pas de schéma formel** (pas de types, pas de validation).

**Migrations** : uniquement `onupgradeneeded` qui crée les magasins manquants. Règle : augmenter `VERSION`,
ne jamais supprimer un magasin. Pas de migration de contenu.

Autres stockages locaux : `localStorage` (`team.*` cache de session, `sync.cfg` connexion Drive, préférences).

---

## 2. Cloud Firestore

### Collections et documents (écritures constatées dans `team.js`)

```
users/{uid}
  name, email, createdAt, companyId

companies/{cid}
  name, ownerUid, plan, planStatus, createdAt
  members/{uid}
    name, email, role, service, perms{module:0-4}, admin, allProjects, projects[], managerUid, zone, invite?, createdAt
  private/drive
    url, key, folder, by, at                    ← URL + clé du script Drive de l'entreprise
  projects/{pid}
    name, address, deleted, updatedAt, by
    m/{module}/r/{store}__{id}
      store, id, projectId, kind, updatedAt, deleted, data (JSON texte de l'enregistrement local), by, srv (horodatage serveur)

invites/{code}                                  code 8 caractères
  cid, companyName, name, role, service, perms, admin, allProjects, projects, managerUid, zone,
  used, usedBy, usedAt, createdBy, createdAt

shares/{code}                                   partage externe d'un projet
  cid, companyName, pid, projectName, entity, label, contact, scope, ops{view,comment,download},
  dueDate, used, usedBy, usedByName, usedAt, createdBy, createdByName, createdAt, responses[{byName,text,at}]
```

### Relations (par identifiants, sans contraintes d'intégrité côté base)
- `users.companyId` → `companies/{cid}` ; `members/{uid}` = même uid que `users/{uid}`.
- `members.projects[]` → `projects/{pid}` ; `members.managerUid` → autre membre.
- `invites.cid`, `shares.cid` / `shares.pid` → entreprise / projet.
- Enregistrements : `projects/{pid}/m/{module}/r/{store__id}` → magasin local `store`, clé `id`.

### Contraintes et sécurité
Pas de contraintes de schéma : toutes les garanties viennent des **règles de sécurité** —
fichier `docs/firebase/firestore.rules`, source : constante `FIRESTORE_RULES` dans `www/js/team.js`.
Résumé :
- `users/{uid}` : lecture/écriture par l'utilisateur lui-même.
- `companies/{cid}` : création si `ownerUid` = soi ; lecture par les membres ; modification par les admins.
- `members` : lecture par les membres ; création par un admin, par le propriétaire, ou par un invité
  dont **tous** les champs (rôle, droits, projets…) correspondent à l'invitation non utilisée.
- `projects/{pid}` : lecture si membre et projet autorisé ; création si niveau `projet` ≥ 3 ; modification ≥ 2.
- `projects/{pid}/m/{mod}/r/*` : lecture si niveau du module ≥ 1, écriture ≥ 2.
- `private/*` : lecture membres, écriture admins.
- `invites`, `shares` : voir SECURITY_NOTES.md.

**Déploiement des règles** : manuel (copier depuis l'app : Mon entreprise › Réglages › Copier les règles,
puis console Firebase › Firestore › Règles › Publier). **Non vérifié** : que la version publiée en
production soit identique à celle du dépôt (aucun accès à la console Firebase depuis cet export).

### Index
Aucun fichier `firestore.indexes.json`, aucun index composite déclaré. Requêtes utilisées :
`invites where cid ==`, `shares where cid == and pid ==`, `shares where usedBy ==`,
`r where srv >`. Si Firestore exige un index, l'erreur fournit un lien de création (non vérifié en production).

### Données réelles
Aucune donnée utilisateur n'est incluse dans les exports. Les données de production ne sont accessibles
qu'au propriétaire du projet Firebase.

---

## 3. Google Drive (Apps Script)
Code : `docs/apps-script/Code.gs` (clé remplacée par un exemple). Actions : `ping`, `pull`, `push`, `upload`,
`download`. Rangement `Mon Drive/SiteTeam/<Projet>/…` ; fichier `_sync (ne pas toucher)/db.json` utilisé
par le mode hérité sans Firebase. Voir API_DOCUMENTATION.md.
