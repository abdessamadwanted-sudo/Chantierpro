# ModelCore X — première livraison du cockpit
## Référence validée par le propriétaire
Dark Navy / Cyan, viewport prioritaire, outils compacts, Explorer, Import Studio, AI Geometry Studio, Maquette. Résidence Horizon : 2 blocs R+6. Conserver Three.js local et le chargement différé depuis Modèles 3D, accessible Pro et supérieur selon le contrôle existant.
## Réalisé dans le code
- Refonte du module existant, sans changement des données SiteTeam, du framework ni des règles.
- Vues perspective, zénithale et hybride (deux projections de la même maquette, pas un PDF lié); sélection par raycast, contour cyan indépendant de la couleur, isolation, masquage, filtres, calques, éclaté, coupes visuelles continues H/V par clipping WebGL.
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

## Navigation tactile centrée
- Un doigt : orbite autour du centre de la boîte englobante du projet. Deux doigts : zoom par pincement (sans déplacement implicite du pivot). Le pivot reste stable pendant sélection, filtrage, isolation et zoom. Le bouton Ajuster recalcule le centre de la maquette; en vue éclatée, il prend en compte l'éclatement.
- Les vues dessus/dessous utilisent le même pivot, y compris pour un IFC décentré. Le zoom est partagé entre 3D et projection zénithale; en 2D, la rotation est désactivée.
- Les gestes multipoints, déplacements dépassant le seuil et annulations ne déclenchent pas la sélection. Tests unitaires des garde-fous ajoutés. Essai tactile réel Android requis avant fusion.

## Coupe interactive H/V
Le bouton ◫ ouvre un panneau compact superposé au viewport. H = axe Y vertical, haut vers bas. V = axe X du modèle, +X vers −X (droite/gauche en vue de référence). Glisser chaque curseur découpe les triangles en temps réel; les deux axes peuvent être activés simultanément. Les boutons d'inversion changent le côté supprimé. Reset désactive les plans. Replier le panneau conserve les coupes actives.
Les plans Three.js sont globaux et non destructifs : ils s'appliquent aux géométries importées IFC/JSON et aux maquettes paramétriques, ainsi qu'aux vues 2D zénithale et hybride. La position du pivot reste indépendante de la coupe; les bornes sont recalculées à l'ajustement et en vue éclatée. Le raycast ignore les intersections masquées par les plans. Les coupes n'affectent pas les volumes, identifiants ou données stockés.
Limite : pas de capuchon ni de hachure sur les surfaces coupées (coupe visuelle ouverte). Les axes restent fixes au modèle pendant la rotation, pas à l'écran. Essais sur Android et validation graphique nécessaires.

## Retour utilisateur sur Android — viewport et navigation
- Le panneau Outils/Filtres remonte en feuille superposée, fermé par défaut. Il regroupe le choix de famille, les compteurs, Structure/Architecture/États, Filtres, Calques, Vue, Éclaté et Toiture. Le viewport ne rétrécit pas lorsque le tiroir s'ouvre; la fiche d'ouvrage est masquée tant qu'aucun ouvrage n'est sélectionné.
- Deux doigts : le pincement conserve le zoom OrbitControls; le déplacement du milieu des doigts translate la projection à l'écran sans modifier le pivot 3D. La vue zénithale reçoit le même décalage. Ajuster annule le décalage et recentre le projet.
- Première correction visuelle après photographie de l'application : exposition ACES réduite, lumières moins fortes, grille atténuée et couleurs géométriques par défaut. Pas encore de matériaux texturés, de Section Caps ni de refonte détaillée de tous les modèles.
- Test de calcul du déplacement et parcours navigateur du tiroir ajoutés; contrôle tactile et rendu Android réel non encore validés.

## Rendu V3 — retour du propriétaire
- Modes Fluide (par défaut) / Détaillé (ombres PCF 1024, relief procédural partagé 64 × 64 sur primitives béton avec UV, densité de pixels limitée à 1,5). Pas d'actif distant. Matériaux indicatifs différenciés béton, vitrage, acier, métal, enduit, réseaux. Vitrage teinté opaque, pas de reflets physiques ni de matériau IFC certifié.
- Contour cyan non soumis au tone mapping, surbrillance légère conservant la couleur de base; réutilisation pendant la sélection, libération à la fermeture. Cadrage par projection des huit coins de la boîte englobante; légende masquée en mode matériaux.
- Maquettes fictives enrichies (résidence, bâtiment, villa, hôpital) : menuiseries, garde-corps, cloisons, portes, locaux de toiture. Les anciens identifiants de démo restent inchangés. Pas de validation structurelle.
- Coupe : fermeture visuelle exacte des primitives pleines box/beam, intersection de leurs arêtes orientées avec le plan de coupe. Maillage de fermeture groupé, maximum 1 500 primitives visibles examinées; pas de fermeture des maillages IFC arbitraires ni de hachure, pas de sélection directe de la surface de fermeture. La source reste intacte.
- Tests unitaires ajoutés; vérifier CI, rendu et fluidité Android, notamment ombres en mode Détaillé, sélection, coupe et navigation simultanées.

### Fiche flottante et cadrage
- L'inspecteur apparaît en surimpression sans redimensionner la maquette. Identité, localisation, géométrie, état local, avancement et actions; fermeture et restauration des éléments masqués indépendamment des coupes et filtres.
- Si la fiche est ouverte, les réglages de coupe se placent en haut de la vue. Le recalcul de cadrage après import attend le retour au viewport. La projection 2D réutilise les bornes déjà calculées au lieu de parcourir le modèle à chaque rendu.
- API locale selectById limitée aux éléments visibles pour le futur lien plan/maquette. Le parcours navigateur vérifie la fiche, l'isolation et la restauration. Validation Android réelle encore nécessaire.

### Mode Plancher — empreintes géométriques
- Bouton Plancher dans la barre rapide, puis choix du niveau et des empreintes : dessous (trait bleu foncé), dessus (pointillé ocre) ou les deux. Les dalles restent visibles; les appuis ne sont pas affichés en volume.
- Les contacts sont recherchés sur la géométrie chargée, dans le même bâtiment, indépendamment du nom du niveau des appuis. Tolérance indicative de 3 cm; section des primitives orientées ou intersection des triangles de maillage, puis découpage des traits à l'emprise de la dalle. Les filtres de dalle et les masquages d'appuis restent appliqués.
- Dalles horizontales uniquement : rectangle pour les boîtes, triangles horizontaux supérieurs pour les maillages. Les dalles non traitées et les limites de calcul sont indiquées. Les contacts sont indicatifs, pas une vérification de portance ni un plan de coffrage d'exécution; les contours des maillages complexes peuvent être incomplets. Mode éclaté incompatible.
- Tests de contact, découpe de segments et parcours navigateur ajoutés. Contrôle visuel des traits et du rendu sur Android réel encore requis.

### Studio Render — troisième profil graphique
- Fluide : profil par défaut, densité de pixels plafonnée à 1. Détaillé : ombres 1024, reflets et relief léger. Studio : résolution jusqu'à 2 fois la densité logique, ombres jusqu'à 2048, fond dégradé et socle de présentation.
- Environnement PBR local (panorama procédural 256 × 128, préfiltré PMREM), reflets indicatifs sur les matériaux. Vitrage physique teinté avec clearcoat, mais opaque : pas de transmission ni de réfraction. Aucun actif externe.
- Arêtes des primitives regroupées en un seul objet de rendu; ombres recalculées après modifications de visibilité/géométrie, pas à chaque orbite. Ombres désactivées pendant les coupes et le mode Plancher. Au-delà de 1 800 objets, les profils coûteux sont allégés; la limite est indicative et non un benchmark.
- Le profil graphique ne modifie ni géométrie BIM, ni identifiants, ni données. En cas d'échec de l'environnement, le moteur reste en éclairage direct.
- Tests des profils, panorama et changements en navigateur; deux captures réelles du rendu Studio (structure et architecture) prévues dans les artefacts CI. Le résultat visuel et la fluidité sur Android doivent être évalués, sans assimiler ce moteur temps réel à un rendu photoréaliste hors ligne.

## PDF Stack — superposition de plans réels
- Entrée PDF dans Explorer et Import Studio. Import local de 8 pages au maximum, fichiers PDF <=25 Mo; choix de page, altitude, visibilité et opacité globale. Pas de transfert serveur.
- Premier plan de référence. Repérer A et B (axes homologues) et renseigner leur distance réelle en mètres, puis répéter les deux repères sur les autres pages. La similitude conserve les proportions et corrige translation, rotation et échelle. Validation explicite avant affichage; orientation arbitraire A–B = axe X du repère local. Vérifier un troisième point indépendant.
- WebGL : plans horizontaux avec leurs textures, vue 3D ou dessus, écart réel ou multiplié, navigation tactile, calage par aperçu et loupe locale de région PDF à haute résolution. Aucun volume BIM inféré.
- Limites : session temporaire, pas de liaison aux fichiers déjà enregistrés ni de persistance. Texture générale 1536 px max; scans déformés et pages obliques non rectifiés. Import et rendu réels à valider sur Android et PDF A0 de chantier. Tests de similitude et scénario navigateur avec deux PDF générés ajoutés.


### PDF Stack — import depuis les niveaux du projet (correctif en validation)
Sélecteur des plans PDF courants avec dossier/niveau et page d’origine, recherche, récupération locale/Drive à la demande via DB.get, refus d'un document d’un autre projet. Import téléphone accepte les fournisseurs Android génériques et vérifie l'en-tête PDF; 60 Mo maximum par fichier, 8 plans par session, résolution bornée et réduite à partir du cinquième. Initialisation du worker avec `pdfReadyA`, accès au calage directement après chaque import et erreurs explicites. Test navigateur avec PDF multipage, niveau IndexedDB, démarrage à froid et isolation. Pas de persistance du calage ni d'essai sur téléphone réel.


### ModelCore X — projet réel et niveaux (en validation)
- Entrée « Mon projet » indépendante des démonstrations BIM : création d'un espace PDF vide associé au projet SiteTeam, sans géométrie fictive. Aucune dépendance aux dossiers de niveaux existants.
- Barre latérale Tous / RDC / R+…; création de 1 à 16 niveaux, ajout de niveaux personnalisés et réglage de leur altitude. Un PDF par niveau (60 Mo maximum), depuis le téléphone ou les plans du projet. Calage A/B et distance réelle requis avant affichage; sélectionner Tous superpose les plans aux altitudes définies.
- Magasin local IndexedDB `mcworkspaces` (migration additive v7, isolé par base d'espace et id projet). Sauvegarde des PDF, pages, niveaux et repères, restauration à la réouverture. Suppression avec le projet SiteTeam. Pas de synchronisation, de partage serveur ni de sauvegarde Drive de cet espace local; garder les originaux. Les imports IFC/JSON et maquettes fictives restent accessibles via l'entrée BIM séparée. Limite mémoire des gros PDF et validation sur Android réel encore ouvertes.
- Parcours CI : formulaire de création, barre de niveaux, import PDF par le champ fichier, calage, filtrage, superposition, réouverture et nettoyage. Les tests doivent passer avant livraison.


### Vue en plan PDF du niveau (en validation)
Depuis un niveau avec PDF importé, bouton « Vue en plan » ou PDF dans la liste : ouvre le lecteur SiteTeam `showPdf` plein écran au-dessus de ModelCore, sur la page exacte du PDF original, même sans calage. Zoom tactile, double tap, déplacement, rendu HD par tuiles et recherche textuelle sur cette page. Fermer le lecteur revient au niveau sélectionné sans modifier le calage ni la caméra; la vue Dessus 3D reste distincte. Le lecteur suspend les nouveaux rendus de la scène sous-jacente et libère ses ressources à la fermeture. Test navigateur : ouverture de la page 2 d'un PDF multipage, présence d'encre et retour à l'état précédent. Qualité/performances sur Android et grands PDF réels encore à valider.


### Extension des niveaux personnalisés
Mon projet accepte désormais 16 niveaux (session PDF Stack historique : 8). Saisie facultative de noms du bas vers le haut, par exemple SSL, Mezz, RDC, R+1… R+9; renommage et altitude éditables. Si RDC est nommé, il sert de zéro provisoire; les altitudes initiales déduites du pas choisi doivent être corrigées d'après les plans réels. Textures 3D limitées à 768 px pour un projet configuré à plus de 8 niveaux; le lecteur Vue en plan conserve le PDF original. Le test unitaire couvre les 12 noms du stade, mais le chargement de 12 PDF A0 réels en simultané et la mémoire Android ne sont pas encore validés.


### Navigation continue en Vue en plan
Barre latérale des niveaux dans le lecteur PDF lui-même, niveaux non importés désactivés, zoom tactile et boutons +/−/ajuster, retour 3D. Changement direct de PDF/page, sans repasser par la scène. Si les deux plans sont calés, transfert du point au centre du viewport et de l'échelle métrique par similitude commune, sous réserve des bords du papier et de la plage de zoom disponible. Sans calage ou si le point tombe hors de la page cible, la nouvelle page s'ouvre ajustée. Une seule page PDF est lue à la fois. Tests unitaires du transfert (rotation/échelle) et parcours navigateur de navigation/zoom ajoutés. Essai tactile et performance sur les PDF réels Android encore nécessaires.


### Calage par point commun (en validation)
Le projet réel utilise par défaut un point homologue A par niveau. Le premier plan fixe l'origine et l'échelle papier commune, saisie une seule fois (1:N, conversion depuis les points PDF). Les autres plans se placent par translation sur le même point à leur altitude. Même échelle papier et orientation indispensables; vérifier un second repère indépendant, car le mode ne déduit ni rotation ni déformation. Si échelle/orientation diffèrent, choisir le mode avancé deux points; le changement de méthode exige confirmation et recalage des plans, sans supprimer fichiers ni repères. Les sessions PDF Stack historiques restent en deux points. Persistance locale de la méthode et de l'échelle, compatibilité des sauvegardes précédentes. Tests unitaires et navigateur ajoutés. Le dernier scénario de navigation PDF avait échoué (zoom transféré et sélecteur CSS du bouton 3D); correctifs en validation. Pas de validation sur les PDF du chantier ni sur Android réel.


### Calage HD interactif (en validation)
Zoom tactile par pincement et boutons +/− (1 à 64×), déplacement par glissement sans poser de repère, clic/toucher simple pour choisir A/B, loupe autour du repère ou du centre et retour au plan entier. Le PDF original reste inchangé : le rendu PDF.js de la zone visible suit le zoom, à la résolution de l'écran (plafond 3 Mpx), avec aperçu immédiat, délai court et annulation des rendus obsolètes. Les coordonnées des repères restent dans le PDF à l'échelle 1, indépendamment de la densité de pixels et du zoom. Le mode Vue en plan conserve son lecteur PDF HD. Les plans vectoriels ne sont pas convertis en images de stockage; les scans ne deviennent pas vectoriels. Le rendu 3D reste une texture raster plafonnée pour protéger la mémoire. Tests unitaires de viewport et parcours navigateur (rendu HD, zoom, point et pan), essai tactile réel Android/PDF A0 encore nécessaire.


### Précision et détail 3D par niveau
Viseur fixe au centre du plan : déplacer/zoomer le PDF puis « Placer au viseur » pour enregistrer le repère sans le masquer par le doigt. Le bouton « HD niveau » recrée à la demande la texture du PDF original du niveau isolé, au maximum 3072 px de côté et 6 Mpx; une seule texture HD supplémentaire en mémoire, libérée en changeant de niveau ou en fermant le module. La texture légère reste disponible en cas d'échec. Les coordonnées et le fichier source restent inchangés. Il s'agit d'une texture raster HD en 3D, pas d'un moteur vectoriel 3D. Tests navigateur du viseur, de la texture HD et de sa libération ajoutés; validation sur téléphone et A0 réels encore nécessaire.


### Parcours d'ajout des niveaux
Bouton Niveaux : liste de tous les niveaux avec altitude, nom du PDF et état (vide, à caler, calé), progression des imports et raccourcis pour importer/ouvrir/caler. « Valider + suivant » ouvre le prochain niveau sans PDF, puis le premier plan non calé, puis la 3D globale. Le bouton « 3D · Tous », y compris depuis le lecteur PDF, sélectionne Tous et réaffiche l'ensemble des plans calibrés à leur altitude (les masques manuels sont réinitialisés). Les PDF non calés restent signalés, sans placement géométrique fictif. Tests navigateur ajoutés. Un PDF par niveau, stockage local et limites antérieures inchangés.


### Mes projets ModelCore X (en validation)
Dans chaque projet SiteTeam, création de plusieurs espaces ModelCore indépendants et ouverture depuis « Mes projets » (ou le bouton Projets dans la scène). Chaque espace conserve ses propres PDF, niveaux, altitudes, repères et échelle. Les anciens espaces à identifiant égal au projet SiteTeam restent lisibles; les nouveaux utilisent un identifiant préfixé par le chantier et ne modifient pas l'ancien espace. La liste utilise les clés IndexedDB et ne crée pas de nouvelle base; les données restent locales au workspace SiteTeam. La suppression du projet SiteTeam supprime tous ses espaces ModelCore locaux associés. Pas de partage cloud ni de suppression individuelle ajoutée. Tests de création d'un second espace vide, réouverture du premier avec ses calages et nettoyage ajoutés.


### Intégration chantier et Data 3D (en validation)
Création à partir des dossiers racines Plans, ou niveaux indépendants. Jusqu’à 32 PDF par espace et 16 niveaux; import du plan d'origine par identifiant, type et lot, navigation dans le lecteur PDF par lot/type et filtres 3D. Les plans superposés d'un même niveau utilisent une légère séparation visuelle de 2,5 cm et une transparence pour éviter le conflit de textures (altitude métier inchangée). Le mode Data 3D lit les annotations, tâches et alertes de la base SiteTeam du projet; repères cliquables ouvrant le plan chantier au point correspondant, tracés simples des annotations, résumé d'avancement du lot si celui-ci est relié au module Avancement. Les formes complexes restent accessibles dans le lecteur natif; maximum 300 repères. Pas de projection si la page ou le fichier source a changé. Actualisation à la demande et au retour du lecteur natif. Pas de modification des données originales ni d'inférence automatique de géométrie BIM. Le PDF d'origine est conservé dans le stockage local ModelCore, les liens de données utilisent les identifiants SiteTeam. Tests ajoutés; CI finale et essais Android réels requis.
