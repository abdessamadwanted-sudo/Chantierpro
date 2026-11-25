# ModelCore X — première livraison du cockpit
## Référence validée par le propriétaire
Dark Navy / Cyan, viewport prioritaire, outils compacts, Explorer, Import Studio, AI Geometry Studio, Maquette. Résidence Horizon : 2 blocs R+6. Conserver Three.js local et le chargement différé depuis Modèles 3D, accessible Pro et supérieur selon le contrôle existant.
## Réalisé dans le code
- Refonte du module existant, sans changement des données SiteTeam, du framework ni des règles.
- Vues perspective, zénithale et hybride (deux projections de la même maquette, pas un PDF lié); sélection par raycast, contour cyan indépendant de la couleur, isolation, masquage, filtres, calques, éclaté, masquage d'une moitié (pas une vraie coupe géométrique).
- Aucun sélecteur de service métier. Inventaire géométrique par type, raccourcis de filtrage et fiche géométrique (dimensions des boîtes, longueurs et sections des poutres, statistiques de maillage). Les états et avancements de démonstration historiques du format v1 restent locaux, sans signification de validation chantier. Les services existants pourront utiliser ce moteur plus tard via des interfaces autorisées, sans duplication.
- Import JSON v1 local et pilote IFC direct WebIFC, sans envoi du fichier. AI Studio : lecture PDF native ou OCR neuronal local avec Tesseract, propositions de cotes explicites et génération paramétrique illustrative après confirmation. Raccourcis géométriques déterministes par type.
- Deux bâtiments de démonstration R+6 avec dalles, poutres, poteaux, voiles, escaliers, façades, vitrages, balcons, fondations et lots techniques simplifiés. Aucun calcul structurel.
## Limites / étapes suivantes
IFC direct limité et non encore validé sur Android; pas d'IA générative connectée, pas de reconnaissance géométrique complète, pas de PDF calibré, pas de liaison Firebase/Drive, pas de persistance des modifications de démo, pas de streaming, pas de planning 4D/5D réel. Les géométries et états métier sont illustratifs. Les données importées restent locales et ne sont jamais envoyées à un tiers.
## Validation obligatoire avant fusion
- CI ModelCore3D et Tests SiteTeam vertes; ne pas désactiver de tests.
- Tester sur Android 10 réel : ouverture Pro, Basic verrouillé, navigation 4 onglets, rotation/pincement, clic sur chacune des deux vues hybrides, couleurs et contour, filtres, absence de sélecteur de service, fiches géométriques, génération AI paramétrique, import JSON/IFC invalide et valide, OCR image et PDF, fermeture/réouverture sans fuite.
- Vérifier sur mobile portrait et tablette que le viewport reste dominant, textes lisibles, contrôles utilisables, captures comparées aux références validées.
- Aucune publication ou fusion sans accord du propriétaire.
## Suite proposée
1. Affiner le graphisme après validation des captures et tests réels.
2. Valider le pilote IFC réel, ajouter identité stable interversions et propriétés BIM complètes.
3. Liaison métier sécurisée et PDF/3D calibré.
4. Fragments, streaming, LOD, cache.
5. Reconnaissance réelle des plans, validation humaine, géométrie complexe.
6. Planning 4D/5D, mesures, clash, navigation HSE, réalité capturée.

## Pilotes IFC / IA locale
- WebIFC 0.0.77, MPL-2.0, source https://github.com/ThatOpen/engine_web-ifc ; distribution officielle non modifiée, licence embarquée par npm run copy-libs. Worker mono-thread, 8 Mo par IFC, 5 000 objets et 200 000 triangles agrégés au maximum, limite de coordonnées 600 000 valeurs, délai 120 s. Les limites sont provisoires et ne garantissent pas la mémoire disponible. Annulation locale. Pas de téléchargement dynamique depuis un CDN.
- Le convertisseur conserve le GlobalId si présent et la hiérarchie IFC disponible, agrège les sous-maillages par ouvrage et applique les transformations. Recentrage pour visualisation; pas de garantie de géoréférencement exact, d'exhaustivité, de matériaux ou de propriétés BIM complètes. Espaces et ouvertures exclus. Classification des lots indicative. Ne pas utiliser les quantités dérivées pour des décisions techniques sans contrôle.
- Le pilote OCR utilise le moteur Tesseract déjà livré (langue eng, français non garanti) et PDF.js pour la première page uniquement; image ramenée à 2200 pixels au maximum. Extraction de texte et propositions déterministes de cotes explicitement libellées avec unités; conflits ignorés. Aucune dimension manquante renseignée automatiquement. Trame générée = exemple paramétrique, pas reproduction du plan. Aucune clé IA ni appel distant.
- Tests ajoutés : IFC4 synthétique avec poteau extrudé 40 × 40 × 300 cm, GlobalId et contenant; tests d'extraction de cotes. CI et test navigateur/Android réel à confirmer. Le build doit inclure les actifs WASM avant utilisation. Pas de fusion avant validation.
