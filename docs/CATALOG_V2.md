# Catalogue fonctionnel v2 (Control Center, PR 1)

Fichier : `www/assets/catalog.json` (`schemaVersion: 2`). Lecture : `www/js/catalog.js` (`Catalog`). Vue : Architecture Studio › Matrice › « Fonctions ».
**Le catalogue décrit, il n'applique rien.** `PLANS`, `planHas`, les règles Firestore/Storage et les données ne sont pas modifiés par cette PR. Le pack minimum (`packMin`) est une CIBLE.

## Schéma d'une fonctionnalité
| Champ | Sens |
|---|---|
| `id` | stable, unique, jamais réutilisé (`finance.adv.tce`) |
| `tier` | `base` · `avancee` (Finance) · `individuel` · `collaboratif` (HSE) |
| `packMin` | `basic` · `pro` · `business` · `enterprise` (cible) |
| `status` | `fonctionnel` (prouvé) · `partiel` · `a_developper` |
| `evidence` | fichiers du dépôt qui le prouvent (obligatoire sauf `a_developper`, qui n'en cite pas) |
| `kinds`, `perm`, `collab`, `hostPays`, `downgrade`, `since` | préparent PR 3 (règles serveur), PR 5 (menus/dashboards) et PR 6 (downgrade lecture seule) |
Le catalogue porte `catalogVersion` (semver) et `history`.

## Garde-fous (CI)
- `ci/guards.mjs` : preuves existantes, ids uniques, Finance avancée = Enterprise, HSE collaboratif = Business.
- `ci/st.mjs` (« catalogue v2 ») : mêmes règles + disponibilité par pack, « à développer » jamais disponible, aucune modification des droits.
- Un statut ne passe à `fonctionnel` qu'avec une preuve dans le dépôt (et un test dans la PR qui le change).

## Décisions appliquées (16/11)
- **Finance** : *base* (synthèse, factures, encaissements, export) = Pro ; *avancée* (situations, attachements, métrés liés à la facturation, avenants/OS, TCE, sous-traitants) = Enterprise, une ligne par fonction.
- **HSE** : *individuel* (fiches, plans, calques, alerte indicative) = Pro ; *collaboratif* (signalements invités, incidents assignés, validation/graphe/routage, permissions granulaires) = Business, tout « à développer ». L'alerte incendie reste **indicative** et ne remplace aucun système réglementaire.

## Divergences catalogue ↔ code (état au commit de cette PR ; rien n'est corrigé en silence)
| Sujet | Code actuel | Cible catalogue v2 | Conséquence |
|---|---|---|---|
| Finance avancée | `PLANS.pro.modules` contient `finance` : TOUT le module est ouvert dès Pro (situations, attachements, avenants, TCE, sous-traitants inclus) | Enterprise | Aucune coupure dans cette PR ; organisations concernées à recenser (PR 2) puis grandfathering via `modsOn` |
| HSE | `hse` ouvert dès Pro (individuel) | Pro (individuel) / Business (collaboratif) | Conforme pour l'individuel ; le collaboratif n'existe pas encore |
| HSE (v1 du catalogue) | `zipMin` HSE = Business | Pro (individuel) | écart de l'ancien schéma, tranché par la décision du 16/11 |
| Planning | outil `planning.js` existant, aucun module serveur | Pro, `partiel` | périmètre à vérifier avant tout `fonctionnel` |
| Laboratoire | rubrique de gestion + rôle, pas de module serveur | Business, `partiel` | idem |
| OPC, RH | absents | Business / Enterprise, `a_developper` | jamais affichés comme disponibles |
| Stockage des données finance | à vérifier : les écrans Finance lisent/écrivent des champs du projet (`p.tce`, `p.st`, `p.gs`, `p.fin`) | — | À VÉRIFIER avant PR 3 : si ces champs ne passent pas par `m/{mod}/r`, une règle `modOpen` sur ce chemin ne les protégerait pas |
