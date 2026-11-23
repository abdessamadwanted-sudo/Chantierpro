# SiteTeam ModelCore 3D — Architecture et contrat d'import V0

## Objectif

Ajouter un moteur de visualisation BIM au **projet SiteTeam existant**, sans
modifier `main`, les bases IndexedDB, l'identifiant Android, ni les règles
Firebase. Démo autonome derrière `Modèles 3D > SiteTeam ModelCore 3D`.

Le prototype actuel utilise **Three.js r147 et OrbitControls déjà livrés
dans `www/vendor/3d`**. Le chargement est différé au clic; aucune
synchronisation ou écriture projet n'est effectuée.

**Ce qui est opérationnel dans ce PR :** scène WebGL 3D volumétrique de stade,
orbite libre, zoom, vues supérieure/inférieure, Raycaster pour sélectionner
chaque ouvrage, inspecteur, état démonstratif, filtres Zone/Niveau/Type/État,
Isoler, Masquer, Afficher tout, couleurs d'état et import local d'un manifeste
JSON neutre par ouvrage.

**Ce qui n'est PAS opérationnel :** import brut `.rvt`, `.ifc`, `.glb`,
géométrie BIM réelle, modèle fédéré, mise à jour des réceptions SiteTeam,
écriture Firebase/Drive, habilitations d'édition ou intégration PDF 2D. Ne
pas activer chez des clients comme « import IFC » avant implémentation et tests.

## Nom et UX

- Nom technique interne : **SiteTeam ModelCore 3D**
- Nom UX : **Maquette BIM 3D**
- Maquette fictive par défaut, même si l'écran montre le nom du projet
  SiteTeam. Ne jamais faire passer cette géométrie pour le projet réel.
- Éviter toute régression du module actuel `m3d.js`, des PDF A0 et des
  sections `SECTIONS.models3d` / `SECTIONS.maquette`.

## Contrat neutre v1 — géométrie un élément par identifiant

```json
{
  "schema": "siteteam-modelcore-v1",
  "projectType": "stade",
  "elements": [
    {
      "id": "ST-OUVR-00001",
      "type": "Poutre",
      "zone": "Nord",
      "level": "N+4",
      "status": "En attente",
      "progress": 60,
      "sourceFormat": "IFC",
      "sourceId": "IfcGlobalIdDeLaPoutre",
      "modelVersion": "ifc-v1",
      "geometry": {
        "kind": "beam",
        "start": [0, 3.2, 0],
        "end": [6, 4.1, 0],
        "width": 0.4,
        "depth": 0.65
      }
    }
  ]
}
```

Le format accepte `box` (size/position), `beam` (start/end/width/depth),
`mesh` (positions xyz/index triangles) ; `mesh` couvre formes courbes,
escaliers, rampes et poutres à section variable, si le convertisseur fournit
le maillage triangulé. Il s'agit d'un **format d'échange de prototype**,
pas du format BIM principal pour la production.

Limites provisoires : 5 000 objets, 10 Mo par JSON, max. 50 000 sommets
et 100 000 triangles par ouvrage. Un grand stade dépassera ces limites :
la version production devra employer une représentation compactée,
fragmentée, paginée avec streaming, et un cache contrôlé.

## Revit / Archicad / Tekla / autres

1. **Exporter IFC** depuis le logiciel source avec éléments distincts
   (IfcBeam, IfcColumn, IfcWall, IfcSlab, IfcStair, IfcMember etc.).
   Conserver `GlobalId`, `IfcBuildingStorey`, IfcType, IfcPropertySets,
   systèmes, zones, matériaux et placement géoréférencé quand disponibles.
2. Un **convertisseur dédié et versionné** transforme le fichier IFC en
   géométrie optimisée + index métadonnées. Une exportation en GLB seule
   peut fusionner des milliers d'ouvrages; ne pas la considérer comme
   préservant automatiquement l'identité.
3. Créer un `siteTeamElementId` immuable distinct du `IfcGlobalId`.
   Index `sourceModelVersion + IFC GlobalId -> siteTeamElementId`.
   Ne pas confondre CALQUE / LAYER et OUVRAGE : une couche peut contenir
   plusieurs centaines de pièces.
4. Associer explicitement chaque ouvrage au `organisationId`,
   `projectId`, Building/Zone/Level, puis au suivi Qualité/Avancement.
5. Lors d'un réexport, produire un **rapport de rapprochement** :
   `identique / modifié / supprimé / nouvel élément / ambigu`, sans
   écraser l'historique des réceptions.

**RVT** est un format propriétaire : prévoir export IFC au préalable.
**GLB/GLTF** peut être une vue de rendu/aperçu si l'index des éléments
est fourni séparément. **PDF/DWG** relève d'un processus distinct
de modélisation assistée avec contrôle humain, pas d'une conversion
BIM automatique garantie.

## Architecture cible (non implémentée)

```
SiteTeam Projet
  ├─ Plans 2D : PDF.js (invariant)
  ├─ ModelCore 3D : WebGL, sélection, coupe, visibilité
  ├─ IFC Ingestion Worker / Service (sandbox, taille limitée)
  │   ├─ contrôle du fichier + virus + quotas
  │   ├─ extraction entités / GlobalId / hiérarchie
  │   ├─ tessellation par éléments, LOD & fragments
  │   └─ métadonnées et géométrie versionnées
  ├─ Spatial Registry / Element Mapping
  └─ Services Qualité / Planning / HSE / Documents
```

Les droits doivent être appliqués **côté serveur** aux modèles et aux fiches,
pas uniquement via un filtre d'interface. Chiffrement et stockage privés,
liens d'accès courts et audit sont nécessaires avant déploiement.
La construction BIM potentiellement lourde doit s'effectuer sur un serveur/
worker, **pas sur Android 10**.

## Prochaines étapes recommandées

1. Vérifier CI et appareils (Chrome desktop, tablette, Android 10, rotation
   et sélection, fermeture/réouverture sans perte mémoire).
2. Réaliser un convertisseur IFC réel sur fichier anonymisé avec l'autorisation
   du propriétaire, une poutre inclinée et un voile courbe.
3. Tester le rapprochement par GlobalId, BuildingStorey et version.
4. Implémenter le stockage séparé et les règles d'accès multi-organisations.
5. Mettre la fonction derrière un Feature Flag par pack et par appareil.
6. Valider performance mémoire, cache offline limité et PDF A0 non affecté.
7. Demander une validation explicite avant toute fusion/diffusion APK.

## Sécurité de cette PR

Aucune migration, aucune écriture projet, aucun changement des règles
Firestore/Storage, aucun import IFC/RVT sans parseur, aucun Push `main`
ou `siteteam`. Les données et états affichés sont fictifs.
