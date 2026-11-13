# SiteTeam — Pack Manager (phase 1)

## But
Un seul noyau SiteTeam (connexion, synchronisation, données), avec quatre espaces commerciaux : Basic, Pro, Business et Enterprise. Le pack de l'espace sélectionné définit les modules et quotas affichés ; les rôles/postes déterminent ensuite les opérations autorisées. Ne pas confondre abonnement personnel et abonnement organisation.

## État existant vérifié sur `siteteam`
- `www/js/team.js` possède déjà `PLANS`, `planOf`, `planFor`, `offersFor` et la liste `MODS`.
- Les packs payants sont fermés par défaut ; leur activation est pilotée par l'administration.
- Le pack Basic possède des quotas distincts pour l'espace personnel et une organisation.
- `ci/st.mjs` teste plusieurs parcours avec émulateurs Firebase.

## Ce que contient cette première PR
- `www/js/pack-manager.js` : moteur pur et sans dépendance de lecture des packs (alias historiques, liste de modules, matrice d'accès, quotas contextuels).
- `ci/pack-manager.test.mjs` : tests autonomes exécutables avec `node ci/pack-manager.test.mjs`.
- **Aucune modification de l'interface ou des règles de production**. Cette fondation ne change pas les fonctionnalités visibles des utilisateurs.

## Étapes suivantes avant activation
1. Brancher la matrice à `PLANS` / `MODS` sans dupliquer le catalogue, dans l'admin Super Admin.
2. Établir une matrice explicite des modules, rôles et packs par espace (personnel/organisation) ; confirmer les choix commerciaux, sans considérer les exemples UX comme des droits acquis.
3. Protéger les accès aux données et actions côté serveur (règles Firestore/Storage ou backend), pas uniquement par des boutons masqués. Vérifier notamment la résistance aux modifications locales du pack.
4. Ajouter tests multi-comptes, multi-organisations, tests de régression et tests de migrations.
5. Déploiement contrôlé après validation humaine et CI verte.

## Modèle de livraison
Une seule application est conservée. Les changements communs peuvent être distribués à tous, et les modules sont révélés par droits/flags au pack ciblé. Une livraison APK/OTA totalement distincte par pack n'est pas implémentée ici.

## Sécurité
Le module JavaScript sert uniquement à la présentation et aux tests de contrat. Ne jamais le considérer comme une protection d'accès. Pas de migration IndexedDB, pas de changement d'applicationId, pas de secrets ni de données réelles.
