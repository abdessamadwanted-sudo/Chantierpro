# ModelCore X — première livraison du cockpit
## Référence validée par le propriétaire
Dark Navy / Cyan, viewport prioritaire, outils compacts, Explorer, Import Studio, AI Geometry Studio, Maquette. Résidence Horizon : 2 blocs R+6. Conserver Three.js local et le chargement différé depuis Modèles 3D, accessible Pro et supérieur selon le contrôle existant.
## Réalisé dans le code
- Refonte du module existant, sans changement des données SiteTeam, du framework ni des règles.
- Vues perspective, zénithale et hybride (deux projections de la même maquette, pas un PDF lié); sélection par raycast, contour cyan indépendant de la couleur, isolation, masquage, filtres, calques, éclaté, masquage d'une moitié (pas une vraie coupe géométrique).
- Aucun sélecteur de service métier. Inventaire géométrique par type, raccourcis de filtrage et fiche géométrique (dimensions des boîtes, longueurs et sections des poutres, statistiques de maillage). Les états et avancements de démonstration historiques du format v1 restent locaux, sans signification de validation chantier. Les services existants pourront utiliser ce moteur plus tard via des interfaces autorisées, sans duplication.
- Import JSON v1 local existant. AI Studio : détection illustrative et génération paramétrique réelle d'une trame fictive après confirmation. Raccourcis géométriques déterministes par type.
- Deux bâtiments de démonstration R+6 avec dalles, poutres, poteaux, voiles, escaliers, façades, vitrages, balcons, fondations et lots techniques simplifiés. Aucun calcul structurel.
## Limites / étapes suivantes
Pas d'import IFC direct, pas d'IA connectée, pas de PDF calibré, pas de liaison Firebase/Drive, pas de persistance des modifications de démo, pas de streaming, pas de planning 4D/5D réel. Les géométries et états métier sont illustratifs. Les données importées restent locales et ne sont jamais envoyées à un tiers.
## Validation obligatoire avant fusion
- CI ModelCore3D et Tests SiteTeam vertes; ne pas désactiver de tests.
- Tester sur Android 10 réel : ouverture Pro, Basic verrouillé, navigation 4 onglets, rotation/pincement, clic sur chacune des deux vues hybrides, couleurs et contour, filtres, absence de sélecteur de service, fiches géométriques, génération AI paramétrique, import JSON invalide et valide, fermeture/réouverture sans fuite.
- Vérifier sur mobile portrait et tablette que le viewport reste dominant, textes lisibles, contrôles utilisables, captures comparées aux références validées.
- Aucune publication ou fusion sans accord du propriétaire.
## Suite proposée
1. Affiner le graphisme après validation des captures et tests réels.
2. Import IFC réel, identité stable et versions.
3. Liaison métier sécurisée et PDF/3D calibré.
4. Fragments, streaming, LOD, cache.
5. Reconnaissance réelle des plans, validation humaine, géométrie complexe.
6. Planning 4D/5D, mesures, clash, navigation HSE, réalité capturée.
