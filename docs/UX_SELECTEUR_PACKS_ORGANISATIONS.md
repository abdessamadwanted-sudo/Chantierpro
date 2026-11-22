# SiteTeam — contrat UX du sélecteur interactif (Phase 1)

## Objectif
Reproduire dans l'application mobile et web le parcours interactif validé en conversation : choix progressif, cartes sélectionnables, retour sans perte de choix, résumé réactif, confirmation explicite. Pas un arbre statique.

## Parcours
1. **Formule** : Basic, Pro, Entreprise, Business. Les formules non ouvertes sont visibles et verrouillées ; cliquer ne crée aucun droit.
2. **Organisation** (Entreprise) : cartes visuelles Entreprise BTP, BET, Architecture, Contrôle, Laboratoire, OPC, MOA, Topographie. Sélection unique ; bouton Continuer inactif tant que non sélectionné.
3. **Services** : liste issue de `SiteTeamCatalogueOrganisations.servicesFor(type)`. Cartes à cocher/décocher, compteur et résumé mis à jour immédiatement ; aucune activation facturable implicite.
4. **Récapitulatif** : formule, type d'organisation, services choisis, statut (disponible/verrouillé), confirmation explicite.
5. **Dashboard** : navigation seulement après validation des droits côté serveur ; afficher un état « en préparation » si un module n'existe pas.

## Interactions obligatoires
- Retour entre étapes sans réinitialiser les choix.
- Changement de type : conserver uniquement les services compatibles avec le nouveau type (jamais attribuer des services étrangers).
- Carte entière cliquable, état sélectionné lisible sans couleur seule, focus clavier visible, libellés accessibles.
- Affichage responsive (téléphone, tablette, ordinateur), aucune fenêtre débordante.
- Ne pas créer de société ni modifier les abonnements avant confirmation.
- Conserver les projets, identifiants, données locales et droits existants.

## Intégration sûre
- Réutiliser les composants et helpers actuels de `www/js/team.js` et `www/js/ui.js`, sans framework nouveau.
- Les identifiants métier du catalogue ne sont pas tous les identifiants `TM_SERVICES` historiques : ajouter un mapping explicite et testé avant écriture Firestore.
- Distinguer formule commerciale, service acheté/activé, rôle et permission ; le frontend n'accorde jamais un droit.
- Ne pas renommer l'ancien alias `entreprise -> enterprise` sans migration des données existantes.
- Ne pas modifier la branche `main`, `com.siteteam.app`, la base IndexedDB `chantier` ni les règles sans tests.

## Critères d'acceptation
- Parcours Basic et Pro inchangé pour les utilisateurs existants.
- Tous les types d'organisations sont sélectionnables dans la maquette interactive.
- Sélection/désélection, compteur, retour, changement de type et récapitulatif testés en E2E.
- Aucune écriture Firestore pour une simple navigation.
- Les modules verrouillés restent verrouillés malgré les choix UI.
- La PR cible `siteteam` et la CI est verte avant toute fusion.
