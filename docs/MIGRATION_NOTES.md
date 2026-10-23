# MIGRATION_NOTES — SiteTeam

## Historique (d'après l'historique Git)
1. **Chantier** (branche `main`) : app personnelle hors ligne, données dans IndexedDB + Drive personnel (Apps Script, `db.json`).
2. **SiteTeam** (branche `siteteam`, à partir d'octobre 2026) : copie de Chantier transformée en app d'équipe :
   - ajout de Firebase (comptes, entreprise, rôles, droits, Firestore remplace `db.json` pour les enregistrements) ;
   - Drive conservé pour les fichiers, mais **un script propre à SiteTeam** (`app: 'siteteam'`) — l'app refuse le script de Chantier ;
   - import des projets de Chantier par leur code de connexion Drive ;
   - espaces par service (topo, centrale, matériel, pointage, HSE, rendement) — magasin `items` (IndexedDB v4) ;
   - formules commerciales (affichage) ; partage externe d'un projet (`shares`) ;
   - 23/10/2026 : signature fixe réellement appliquée (v1.0.9), workflow d'export, documentation.
3. Des fonctions de `main` **ne sont pas** dans SiteTeam : catalogue technique BTP (`catalogue.js`), planning,
   mises à jour OTA (`modules.js`), etc. Les deux branches ont divergé : **ne pas fusionner** sans revue fichier par fichier.

## Migrations de données existantes
| Où | Mécanisme |
|---|---|
| IndexedDB | `onupgradeneeded` crée les magasins manquants (v3 → v4 a ajouté `items`) |
| Firestore `members.perms` | `migratePerms()` : à la connexion d'un admin, ajoute les modules manquants selon le rôle |
| Firestore `companies.plan` | `migrateCompanyPlan()` : formule par défaut pour les entreprises antérieures |

## Précautions pour toute évolution
- **Ne jamais** changer `appId` (`com.siteteam.app`), le nom de base IndexedDB (`chantier`) ni la clé de signature.
- Toujours **augmenter** `versionCode` (géré par le numéro de run CI).
- Nouvelle donnée Firestore : ajouter la règle correspondante dans `FIRESTORE_RULES`, la tester avec
  `ci/st.mjs` (émulateurs), puis la **publier manuellement** dans la console Firebase.
- Changement de structure des enregistrements : les anciens documents `data` (JSON) restent ; prévoir une
  lecture tolérante plutôt qu'une réécriture massive.
- Migration vers un framework (React/Vite/TypeScript…) ou vers un backend : **non commencée**, hors périmètre actuel.
- Passage à Capacitor ≥ version ciblant l'API 36 : à faire avant Google Play ; vérifier chaque plugin
  (app, filesystem, share, local-notifications, file-opener) et retester l'APK.
