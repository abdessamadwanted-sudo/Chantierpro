# SiteTeam — Feature Matrix V2 (cahier de réalisation pour Claude)

**Statut de cette PR : fondation en lecture seule + tests + cahier d'intégration. Ne PAS merger tant que l'implémentation UI/sécurité/tests n'est pas ajoutée et validée.**

## 0. Point de départ vérifié
- Base : branche `siteteam`, PR #209 déjà fusionnée ; conserver sa fonctionnalité « fenêtres par pack ».
- `www/js/team.js` : `PLANS` (Basic, Pro, Business, Enterprise), `MODS` (17 modules), `PREMIUM` (7 fonctionnalités), `Team.FLAG_DEFS` (6 mises en service), `Team.flag()`, `Team.featInfo()`, `Team.lvl()`.
- `www/js/admin.js` : onglet **Packs & fonctions** pour modules/premium ; **Centre de contrôle → Mises en service** pour les 6 flags.
- `config/plans` contient les autorisations commerciales modules/premium ; `config/app.fp` les niveaux de déploiement.
- Le stockage Drive, Firebase/Firestore, IndexedDB, les permissions et les mises à jour OTA doivent rester compatibles.

## 1. Conception de l'interface (une vue, pas un 2e moteur de droits)
Dans le panneau Super Admin, créer **Feature Matrix**, un tableau à onglets [Modules] [Premium] [Mises en service], avec filtres [Personnel / Organisation], recherche, lignes et 4 colonnes de Packs.

| Famille | Colonnes | Valeurs/états | Source autoritative |
| --- | --- | --- | --- |
| 17 modules (Projet, Plans, Réserves, Réception, Photos, Forms, Rapports, Constats, Calculs, Équipe, Fichiers, Topo, Centrale, Matériel, Pointage, HSE, Financier) | Basic/Pro/Business/Enterprise | Inclus / Exclu | `PLANS` + `config/plans.*.modules` |
| 7 premium (cmp, pdf, dwg, report, plansend, plansendhq, photopdf) | mêmes | Inclus / Exclu + essai/grant | `PREMIUM`, `config/plans.*.feats`, `featTrial`, `featGrant` |
| 6 flags existants (svcqual, monespace, missionzone, terraindoc, qdocs, orgq) | mêmes | Absent / Dev / Test / Publié | `Team.FLAG_DEFS`, `config/app.fp` |

Les colonnes **Personnel/Organisation** doivent respecter `perso` / `orgOffer`. Les quotas Basic perso/org (users/projects/services/storage) doivent être présentés séparément, sans les écraser. `*` conserve sa sémantique « tous » ; afficher l'état réellement calculé (override Firestore pris en compte), pas les valeurs codées en dur. Aucune mutation de `PLANS` pour la simple visualisation.

**Légende UI :** ✅ Inclus/Publié, 🔒 Exclu/Dev, 🧪 Test, — Absent ; les couleurs seules ne suffisent pas. Les nouveaux modules doivent être détectés depuis les registres existants (pas une liste copiée). Afficher les changements non enregistrés et demander confirmation avant sauvegarde.

### Important
Le module fourni `www/js/feature-matrix-v2.js` calcule **un modèle de lecture** à partir de ces 3 sources ; il ne prend aucune décision serveur. Claude doit l'intégrer sans dupliquer les composants ou le moteur existants, ou l'adapter directement aux fonctions existantes si plus cohérent.

## 2. Correctifs de sécurité impératifs avant tout déploiement

### S1 — Preview non autorisé (priorité critique)
`Team.packPreview()` lit `sessionStorage['st.preview']` même pour un compte normal ; `packNow()` et `Team.flag()` utilisent ce pack. Ne jamais prendre la valeur client comme abonnement réel. Autoriser l'aperçu UNIQUEMENT pour `Team.isSuper()` et UNIQUEMENT pour afficher l'UI. Les membres normaux doivent résoudre le pack du **workspace** actif, pas d'une variable sessionStorage. Corriger et couvrir le test CI qui simule aujourd'hui un non-super via preview.

Ne pas réutiliser le pack preview dans `featInfo`, règles Firestore/Storage, quotas, droits de lecture/écriture ou endpoints ; le preview n'accorde jamais un droit ni un accès aux données.

### S2 — Composite permission model
Pour chaque action sensible: **pack réel actif + statut abonnement + module autorisé + flag de mise en service + poste/perms + projet autorisé + organisation + règles serveur**.
- Distinguer UI: `canViewFeature` vs `canExecuteFeature`. Si un module est Exclu, le flag Publié ne doit JAMAIS donner accès à l'action/donnée premium.
- Supprimer les accès par URL directe/écran interne et vérifier les handlers des actions, pas uniquement masquer les boutons.
- Ne jamais inférer une permission de `Team.isSuper()` côté serveur à partir d'un simple email fourni par le client ; vérifier l'identité authentifiée côté règles/backend.

### S3 — Firestore / Drive / offline
Auditer les règles pour `config/plans`, `config/app`, entreprises, invitations, espaces partenaires, projets, service Qualité et fichiers. Les quotas `checkLimit()` sont commentés comme **côté client**, donc ne pas annoncer une protection serveur complète. Éviter tout effacement de données lors du changement de pack ou d'une fermeture d'option. En mode hors ligne, préserver les écritures valides et refuser proprement les actions non autorisées en attente de synchronisation. Protéger les données partagées Drive, pas seulement les documents Firestore.

## 3. Testers indépendants et rollout
Conserver la configuration existante `config/app.fp`. Ajouter éventuellement `config/app.testersByPack = { basic: [], pro: [], business: [], enterprise: [] }` (migration progressive de `testers` global), ou mieux une liste par **fonction + pack**, après validation du modèle. Ne pas casser les testeurs existants. À `test`, seule l'email authentifiée et autorisée pour la fonction/pack courant doit accéder à la feature. Valider les emails, retirer doublons et empêcher une publication involontaire.

États déterministes : `absent` (jamais visible, même Super Admin en preview), `dev` (Super Admin hors preview utilisateur), `test` (testeurs autorisés), `pub` (utilisateurs du bon pack, sous autres règles). En dehors du serveur, présenter les flags comme un **contrôle d'affichage et de rollout**, pas comme barrière de sécurité.

## 4. « Ce qui est nouveau » et livraison
`config/app.news[pack]` existe. Lors de plusieurs packs, mémoriser l'acquittement de l'annonce avec `pack + news.id` (la clé unique `st.newsOff` risque de masquer les annonces d'autres packs qui ont le même id). Distinguer **publication d'une feature sans nouvel APK** et **livraison d'un APK/OTA** : le JS du pack non concerné peut être distribué dans l'APK commun ; ne pas promettre de téléchargements de code totalement séparés.
Ajouter contrôle de version minimale/compatibilité avant d'activer une feature nécessitant du code absent des anciennes versions ; pas d'activation d'une fonction qui n'est pas déjà dans le client.

## 5. Critères d'acceptation obligatoires
1. 4 packs x Personnel/Organisation (lorsqu'éligible) ; changements de workspace, multi-postes, Groupement et projets privés.
2. Basic ne peut ni voir ni déclencher une feature Business/Enterprise non incluse ; falsifier `sessionStorage['st.preview']` ne change pas les droits.
3. Business reçoit une feature publiée uniquement dans Business, Basic/Pro inchangés.
4. Tester Business n'ouvre jamais Enterprise ; un non-test ne voit pas `test`.
5. Déploiement/rollback `pub → dev/absent` : pas de perte de données, UI cohérente, reload/offline/sync OK.
6. `config/app` et `config/plans` modifiables uniquement par admin authentifié ; les règles empêchent l'élévation par modification de company.plan et grants.
7. Toutes les 17+7+6 fonctionnalités réelles apparaissent dans Matrix, avec regroupement/catégorie/recherche. L'insertion d'un nouveau FLAG_DEFS apparaît automatiquement.
8. Tests `node ci/feature-matrix-v2.test.mjs`, `ci/st.mjs`, `ci/rules-test.mjs` et Tests SiteTeam verts ; tester un APK réel Android avant publication.

## 6. Ordre d'implémentation
P0: S1 + tests anti-bypass ; P1: UI Matrix en lecture seule branchée aux registres ; P2: édition & validation/rollout par pack avec audit log ; P3: testers par pack, notifications, version gating ; P4: E2E + émulateurs + Android réel. PR petites si nécessaire, base `siteteam`; **jamais push/merge sur main/siteteam ni publication automatique**.

## 7. PR parallèles
- #210 : fondation alternative non branchée ; **ne pas fusionner les deux moteurs**. Réutiliser les bons tests si utile, puis fermer la PR devenue inutile avec accord du propriétaire.
- #211 : Service Qualité distinct ; rebaser/tester après l'intégration de la matrice, conserver les droits Qualité actuels.
