# FEATURES_INVENTORY — inventaire fonctionnel réel de SiteTeam

## Phase 2c — Basic / Pro, bibliothèque métier et organigramme

La bibliothèque métier utilise maintenant un écran unique sur téléphone, tablette et ordinateur. En Basic, elle
présente le socle commun (plans, tâches, photos, rapports et équipe). À partir de Pro, le même écran classe les
outils selon le service ou le métier, puis applique le pack, le poste et les droits. Un administrateur peut parcourir
les bibliothèques des services actifs de son organisation. La bibliothèque est accessible depuis les outils d'un
projet et depuis le menu Équipe / Mon espace ; un outil s'ouvre toujours dans un projet autorisé.

L'organigramme propose deux vues complémentaires : hiérarchie globale (y compris lorsqu'un responsable et son
collaborateur appartiennent à des services différents) et regroupement par service. Il affiche les totaux membres,
services et postes, la recherche, le service de chaque personne et le nombre de collaborateurs directs. Les anciennes
données comportant un responsable absent ou une boucle restent visibles au lieu de faire disparaître un membre.

Validation locale : syntaxe JavaScript, extraction des règles et `git diff --check`. Le scénario E2E v1.0.45 et la CI
de la Pull Request font foi pour la livraison complète.

## Phase 2a — reprise du 27/10/2026

### Phase 2b — équipe projet et affectations

Business/Enterprise : écran Affectations depuis l'accueil et Équipe projet. Affectation nominative avec poste
et date de début, remplacement, fin et transfert atomique vers un autre projet ; les affectations terminées
restent visibles et chaque opération produit une ligne d'audit serveur immuable. Les droits du poste dans
l'organisation continuent à limiter les actions ; le poste d'affectation est une mission, pas une promotion.

L'activation initiale marque les anciens projets comme ouverts. Seuls les projets dont l'équipe a été définie
deviennent nominatifs. Firestore et Storage vérifient l'équipe en plus des droits existants ; l'administrateur
garde l'accès. Les règles doivent être publiées ensemble. La synchro recharge la politique et le cache des
projets accessibles ; hors ligne, la dernière politique reçue est utilisée. Aucune donnée passée n'est supprimée.
Les modifications concurrentes d'équipe sont rejetées par transaction. Tests : errors v1.0.32 et règles serveur.

Accueil entreprise indépendant du projet : quatre compteurs calculés sur les projets autorisés, activités récentes,
trois projets puis « Voir tous les projets », accès Équipe / Organisation / Réglages. Taille déduite du pack :
Basic et Pro = petite ; Business = moyenne ; Enterprise = grande. Aucun champ taille ni migration IndexedDB.
Fil d'Ariane cliquable dans les écrans du projet. Le poste principal et les postes supplémentaires sont enregistrés
dans le membre et son invitation ; les droits proposés sont leur union, plafonnée à Valider. La carte `perms`
reste l'autorité côté serveur ; l'ajout de postes ne confère jamais automatiquement le statut administrateur.
Les nouveaux modèles Conducteur ne donnent plus Finance par défaut ; les droits déjà enregistrés sont conservés.

Protection Android : réglage d'organisation, désactivé par défaut, forçable dans le panneau Super Admin.
Méthode native `setScreenProtection` dans le plugin déjà embarqué, utilisant FLAG_SECURE et une préférence locale.
Nécessite un nouvel APK. L'effet sur un appareil Android réel reste à vérifier. Enterprise affiche
« Serveur privé — Contactez-nous » ; aucun serveur privé n'est provisionné.

Validation : syntaxe JS et affichage local avec données fictives ; parcours et refus serveur ajoutés à
`ci/st.mjs` (errors v1.0.31) et `ci/rules-test.mjs`. Le résultat CI fait foi pour la livraison.
Les sections historiques ci-dessous décrivent un inventaire antérieur et ne remplacent pas ce point de reprise.

> **v1.0.12** : SiteTeam reprend tous les outils et corrections de l'application Chantier (avancement, planning, registres, financier & TCE, gestion, bons de bétonnage, fiches PDF, poutre 3D, DWG/DXF, indices de plans, scanner, studio photo, notes vocales, clauses CPS/CCTP, briefing, thèmes, PIN, stockage) et la mise à jour depuis l'application. Ces outils fonctionnent comme dans Chantier ; ils ne sont pas encore couverts par le test E2E SiteTeam. Les interfaces par service / pack viendront ensuite.

Légende de l'**état réel** :
- **Fonctionnel (testé)** : couvert par le test E2E `ci/st.mjs` (dernière exécution enregistrée : 14/10/2026, branche `siteteam-ci`, « errors [] »).
- **Fonctionnel (non testé auto)** : code présent et relié à l'interface ; utilisé, mais sans test automatique.
- **Partiel** : présent mais incomplet.
- **Simulé** : affiché sans effet réel.
- **Absent** : n'existe pas dans le code (même s'il a été discuté).

Le test E2E vérifie notamment : inscription, création d'entreprise, invitation d'un conducteur et d'un
maître d'ouvrage, projet partagé, réserve créée/reprise, réception, éléments des espaces (implantation,
commande béton, pointage, rendement), et **refus serveur** (`permission-denied`) : auto-promotion admin,
création d'invitation par un non-admin, écriture de tâche par un rôle en lecture, commande béton par un topographe.

| Module | Objectif | Fichiers | Écrans | Données | État | Problèmes / améliorations |
|---|---|---|---|---|---|---|
| Comptes / authentification | Connexion obligatoire, création de compte, mot de passe oublié | team.js (`loginScreen`) | Écran de connexion responsive téléphone / tablette / ordinateur | Firebase Auth, `users/{uid}` | Fonctionnel (testé, y compris suppression de compte) | E-mail/mot de passe seulement ; page web de suppression à faire |
| Entreprise / organisation | Créer ou rejoindre une entreprise | team.js (`onboardScreen`, `openCompany`) | Onboarding, « Mon entreprise » (onglets Organigramme, Membres, Invitations, Réglages, Mon compte) | `companies/{cid}` | Fonctionnel (testé) | Un utilisateur = une entreprise à la fois |
| Services, postes, hiérarchie | 12 services, 43 postes, responsable direct, zone | team.js (`SERVICES`, `ROLES`, `memberForm`) | Organigramme, fiche membre | `members/{uid}` (`role`, `service`, `managerUid`, `zone`) | Fonctionnel (testé) | — |
| Permissions | 16 modules × 5 niveaux, projets autorisés, admin | team.js (`lvl`, `canSection`, règles) | Droits détaillés, bandeau lecture seule | `members.perms`, règles Firestore | Fonctionnel (testé, refus serveur vérifiés) | Côté client `lvl()` retourne 4 avant connexion (sans effet serveur) |
| Invitations | Code à usage unique, envoi WhatsApp | team.js (`createInvite`, `inviteFlow`) | Inviter, onglet Invitations | `invites/{code}` | Fonctionnel (testé) | Pas d'expiration des codes |
| Formules commerciales | Basic / Personnel / Pro / Entreprise, quota de comptes | team.js (`PLANS`, onglet Réglages) | Encadré « Abonnement » | `companies.plan`, `planStatus` | **Simulé** (affichage seul) | Aucun paiement, aucune limite appliquée côté serveur |
| Partage externe | Accès limité d'une entité tierce à UN projet, journal de réponses | team.js (`shareFlow`, `openProjectShares`, `claimShare`) ; app.js (`renderTeam`) | Projet › Équipe › Intervenants externes ; Mon compte › Accès externe reçu | `shares/{code}` | **Partiel** — non couvert par le test E2E | Périmètre en texte libre (aucun accès réel aux documents du projet) ; pas de circuit d'approbation ; règle Firestore permettant de réécrire tout le tableau `responses` |
| Projets | Créer, ouvrir, paramétrer, supprimer | app.js | Accueil, Paramètres | `projects`, `companies/{cid}/projects/{pid}` | Fonctionnel (testé) | — |
| Entreprises (lots) du projet | Liste des entreprises/lots pour affecter les réserves | app.js (`renderTeam`), pro.js | Équipe | `project.companies` | Fonctionnel (non testé auto) | Simple liste nom + lot. Le « catalogue technique BTP » (familles → lots) existe **uniquement sur la branche `main`**, **absent** de SiteTeam |
| Intervenants du projet | Personnes nommées responsables | app.js (`renderTeam`) | Équipe | `project.team` | Fonctionnel (non testé auto) | Liste locale, distincte des membres Firebase |
| Plans | Import PDF/image, dossiers, visionneuse, pins, annotations, liens | app.js, viewer.js, ui.js | Plans, visionneuse | `folders`, `plans`, `links`, `files` | Fonctionnel (non testé auto) | — |
| Ouvrages (éléments liés) | Pin/zone d'élément avec coffrage, ferraillage, coupe, PV, photos | app.js (« Lien / élément d'ouvrage »), viewer.js | Visionneuse | `links` | Fonctionnel (non testé auto) | Pas de référentiel d'ouvrages structuré |
| Réserves / tâches | Statut, priorité, responsable, échéance, photos | app.js | Réserves / Tâches | `tasks` | Fonctionnel (testé) | — |
| Photos | Galerie du projet | app.js, ui.js | Photos | `files` | Fonctionnel (non testé auto) | Photos réduites à l'import |
| Formulaires / PV qualité | Réception ferraillage, coffrage, bétonnage, maçonnerie, étanchéité ; signature ; PDF | app.js, pro.js | Formulaires | `forms` | Fonctionnel (non testé auto) | — |
| Rapports journaliers | Météo, effectif, travaux, livraisons, PDF | app.js, pro.js | Rapports | `reports` | Fonctionnel (non testé auto) | — |
| Réception & bétonnage | Tableaux journaliers, messages WhatsApp, exports, rappel PV | reception.js | Réception & Bétonnage | `receptions` | Fonctionnel (testé) | Synchro Google Sheets par script séparé (non testée auto) |
| Constats / non-conformités | Bibliothèque problème → solution | tools.js | Constats / NC | `project` | Fonctionnel (non testé auto) | — |
| Topographie | Demandes d'implantation, levés/récolements ; calculs topo | espace.js, calc.js | Espace topo, Calculs & Topo | `items` (`impl`, `leve`), `project.calc` | Fonctionnel (testé pour `impl`) | — |
| Centrale à béton | Commandes béton, bons de livraison | espace.js | Espace centrale | `items` (`cmd`, `bl`) | Fonctionnel (testé pour `cmd`) | — |
| Matériel & stock | Parc, affectations, stock | espace.js | Espace matériel | `items` (`mat`, `stock`) | Fonctionnel (testé : création) | — |
| Pointage & effectifs | Pointage, rendement | espace.js | Espace, tableau de bord équipes | `items` (`pt`, `rdt`) | Fonctionnel (testé : création) | — |
| HSE | Éléments HSE | espace.js | Espace HSE | `items` (`hse`) | Fonctionnel (non testé auto) | — |
| Laboratoire | — | rôle `labo` / `laborantin` seulement | — | — | **Absent** comme module | Seuls des postes existent |
| Dashboards | Tableau de bord projet ; tableau de bord des équipes | pro.js, espace.js (`openBoardEquipes`) | Tableau de bord | toutes | Fonctionnel (non testé auto) | Pas de tableau de bord multi-projets entreprise |
| Documents / fichiers | Fichiers du projet, ouverture DWG/DXF externe, outils PDF | app.js, tools.js, sync.js | Plans, Outils PDF | `files` + Drive | Fonctionnel (non testé auto) | Quota de stockage non contrôlé |
| 3D, ferraillage, DXF | Modèles 3D coffrage/ferraillage, OCR nomenclature, barres, plans DXF | m3d.js, fer.js, dxf.js, vendor/3d | Modèles 3D, Maquette 3D | `project.models3d` | Fonctionnel (non testé auto) | Bibliothèques lourdes (≈ 12 Mo) |
| Calculs | Métré, béton, acier, pente, nivellement, coordonnées | calc.js | Calculs & Topo | `project.calc` | Fonctionnel (non testé auto) | — |
| Croquis / dessin | Tableau de dessin | sketch.js | Outil | `project.boards` | Fonctionnel (non testé auto) | — |
| Points d'intérêt (plan) | Marqueur gyrophare 3D (dôme, lampe qui tourne, halo qui pulse) ; échéance modifiable (ordre du maître d'ouvrage, historique) ; attente client (arrêt qui repousse l'échéance) ; couleur du dôme réglable par état | viewer.js (`pointAlert`, `pillColor`, `choosePillColors`), app.js (`editLocalDue`, `toggleLocalHold`) | Plan › Point d'intérêt ; Filtres › Couleurs des états | `links` (`due`, `dueLog`, `hold`, `holdDays`, `look`) ; couleurs dans `localStorage.pillColors` | Fonctionnel (logique testée hors navigateur, rendu vérifié ; non testé de bout en bout) | Les couleurs d'état sont propres à l'appareil ; début et échéance avec date + heure ; un point dont le moment n'est pas venu est masqué puis apparaît tout seul (début atteint ou échéance à moins de N jours, N réglable, défaut 3) ; « Afficher tout » et « Masquer pas encore actifs » dans Filtres ; carré 🔔 (alertes du plan) dans la barre du plan et total sur Outils du projet ; dossier 📁 Data (sous-dossiers Alertes, Photos) ; 📍 d'un tableau d'alertes ouvre le plan centré sur le point. Testé : logique (ptActive/pointAlert) ; non testé sur appareil. ; v2 : dates sans heure (Début, Fin objectif société, Échéance maître d'ouvrage) ; « Démarré » ne coupe plus l'alerte (retard affiché jusqu'à « Terminé » → vert) ; liaison à une tâche du Planning dans les deux sens ; menu ⋯ réduit en sous-menus (Dates et Planning, État) ; icône dôme dans la barre d'outils ; dôme réduit de 35 % ; accueil : seul le carré 🔔 N → Data (Alertes, Points d'intérêt, Photos) ; tableau avec dôme cliquable, filtres niveau / lot / plan / état, avancement. Testé : logique ; non testé sur appareil. |
| Notifications | Rappels locaux programmés | app.js (`LocalNotifications`) | Rappels | `project.rappels` | **Partiel** | Pas de notifications push entre utilisateurs |
| Messages | — | — | — | — | **Absent** | Partage via liens WhatsApp uniquement |
| Planning | — | — | — | — | **Absent** sur SiteTeam (un `planning.js` existe sur `main` seulement) | — |
| Gestion administrative | — | — | — | — | **Absent** | — |
| Synchronisation | Firestore (données) + Drive (fichiers) | sync.js, team.js | Pastille de synchro, Paramètres | toutes | Fonctionnel (testé : synchro Firestore) | Voir KNOWN_ISSUES (IndexedDB) |
| Sauvegarde .chantier | Export/import d'un projet complet | backup.js, app.js | Paramètres ; Accueil › ⋮ › Restaurer | toutes | Fonctionnel (non testé auto) | — |
| Import depuis Chantier | Récupérer les projets de l'app Chantier | team.js (`importChantier`) | Réglages | Drive de Chantier | Fonctionnel (non testé auto) | — |
| Langues | FR / العربية / EN | i18n.js | Menu › Langue | — | Fonctionnel (non testé auto) | Traduction par remplacement de libellés |
| Emploi & carrière | Recherche d'offres, dossier de candidature | career.js | — | — | **Présent dans le dépôt mais non chargé** (absent de index.html, aucun appel à `openCareer`) | À retirer ou à relier |
| Sauvegarde Drive d'un projet | Un seul zip « <projet>.chantier.zip » dans le dossier du projet, mis à jour sur place (même fichier Drive) + copie « (précédente) » ; reconstruit depuis l'état actuel (les éléments supprimés disparaissent) ; anciens zips datés restent restaurables puis passent à la corbeille Drive | gdrive.js (`projectBackupSave`, `projectBackupList`), app.js (`restoreFromDrive`) | Projet › Sauvegarde Drive ; Restaurer | Drive | Fonctionnel (code ; test CI limité à la forme ; non testé contre le vrai Drive) | Le projet reste aussi sur le téléphone (IndexedDB) ; Drive = copie en plus |
| Outils du projet : tableaux et barre | Tableau des points = recherche d'abord (rien listé sans recherche/filtre) ; lot et niveau propres à chaque point (menu ⋯ › Lot et niveau), plus de « premier lot » par défaut ; barre de raccourcis plus basse et colorée ; Bibliothèque métier rangée comme un groupe | app.js (`ptLotName`, `openAlertsTable`), siteteam.js, styles.css | Outils du projet ; Data ; point d'intérêt | `links.lotId` | Fonctionnel (testé : ptLotName ; rendu non testé sur appareil) | Un point sans lot reprend le lot de son plan |
| Tableau des échéances + points d'intérêt ; PDF annoté vectoriel | Les points (échéance, fin objectif, début) apparaissent dans le Tableau des échéances (compteurs, filtres niveau/lot, clic → plan sur le point) ; le maître d'ouvrage est écrit dans chaque ligne, plus dans le titre ; PDF annoté d'un plan PDF : dessins écrits en vectoriel (option sans pins ; pins vectoriels prêts dans pinsPdfDraw) (texte non latin retiré) ; JPEG de base à 98 % pour les plans image/DWG | lots.js (`openDueTable`), viewer.js (`pinsPdfDraw`, `annotatedPlanPdf`) | Tableaux › Échéances ; Plan › Partager | `links` | Fonctionnel (testé : forme du code, PDF généré sans image ; rendu visuel non vérifié, page tournée toujours en calque image) | Les plans DWG/DXF restent en image dans le PDF annoté (utiliser « PDF vectoriel à l'échelle ») |
| Envoi des fichiers partagés (Cloud Storage) | Si 2 envois de suite échouent (ex. expirent), l'envoi est suspendu 6 h au lieu de reprendre les 44 fichiers à chaque ouverture ; « Envoyer » (Stockage) force un nouvel essai ; un seul message d'erreur | sync.js (`cloudPause`) | Pastille de synchro ; Paramètres › Stockage | `localStorage.cloudPause` | Fonctionnel (testé : présence de la logique ; cause réseau/règles Storage non confirmée, non testé sur appareil) | Ne corrige pas la cause (Storage qui ne répond pas) : à vérifier règles Storage et connexion |
| Tableaux : filtre « Tous » | Dans Points d'intérêt et Alertes, « Tous » (lot, niveau, plan, état) affiche tous les points sans rien taper ; le message « Tapez un nom… » est retiré ; cartes « Tableaux » plus petites et sobres | app.js (`openAlertsTable`), styles.css | Outils du projet › Tableaux | — | Partiel (testé : code ; rendu sur appareil non vérifié) | Restent à faire : fiche point (nom plus petit, retard échéance, dôme plus petit), Tableau des échéances (filtres fixes), Réception (sélection puis ouverture), Outils PDF (aperçu), démarrage (mode secours) |
| Fiche point, dôme, Tableau des échéances (partie 2) | Fiche : ligne « Retard échéance » (jours et type), nom et lignes plus petits ; dôme plus petit et libellé plus petit ; Tableau des échéances : cartes de statut, recherche et filtres restent en haut pendant le défilement | app.js (fiche), viewer.js (dôme), lots.js (`openDueTable`), styles.css | Plan › point ; Tableaux › Échéances | — | Partiel (testé : présence du code ; rendu sur appareil non vérifié) | Restent : Réception (sélection puis ouverture), Outils PDF (aperçu), démarrage (mode secours) |
| Réception : sélection puis ouverture ; Outils PDF : aperçu plein écran | Réception ferraillage/Bétonnage : 1er appui sélectionne la ligne, 2e appui sur la même ligne ouvre les données ; Outils PDF : appui sur une page = aperçu plein écran haute résolution (zoom au pincement) avec Avant/Tourner/Retirer/Après | reception.js, tools.js, styles.css | Réception › jour ; Outils PDF | — | Partiel (testé : présence du code ; rendu sur appareil non vérifié) | Reste : démarrage et mode secours |
| Groupe « Tableaux » dans Outils du projet | Nouveau groupe Tableaux : Alertes, Points d'intérêt, Photos, Anomalies, Échéances (ouverture directe du tableau) ; le groupe Outils ne garde que les outils (Bons, DWG, Outils PDF, Studio photo, Tableau de dessin) | siteteam.js, app.js (`openTableTool`) | Outils du projet | — | Fonctionnel (testé : présence du code ; rendu non vérifié sur appareil) | Les raccourcis de la barre (⋯) gardent leurs noms d'origine |
| Démarrage et mode secours (diagnostic) | Envoi des photos en attente lancé 25 s après le démarrage (au lieu de 2,5 s) ; chaque étape du démarrage note la mémoire JS ; les erreurs « promesse » gardent le début de leur pile d'appels | app.js (`bootTrail`, `unhandledrejection`), photoq.js | Rapport de diagnostic (mode secours) | — | Partiel (testé : présence du code ; effet sur la fermeture forcée non vérifié) | Ne règle pas la cause de fond (mémoire : toute la table files est chargée au démarrage) |
| Plan : glissement et zoom plus fluides | Les pastilles/dômes ne sont plus redessinés à chaque déplacement du doigt (seulement quand le zoom change) ; le calque du plan est promu dès le 1er doigt ; zone HD limitée à 6 millions de pixels (moins de mémoire, moins de carrés noirs) | viewer.js (`applyT`, `renderHD`, gestes) | Plans › ouvrir un plan | — | Partiel (testé : présence du code ; fluidité et carrés noirs NON vérifiés sur appareil — dépend du GPU du téléphone) | Si des carrés noirs restent : envoyer une vidéo après cette version |
| Démarrage léger : table de drapeaux séparée | Petite table IndexedDB `fflags` (à préparer / confié au téléphone / pas encore envoyé) tenue à jour à chaque écriture de fichier ; le démarrage (préparation photo, envoi arrière-plan) ne charge plus tous les fichiers avec leurs blobs ; remplie une fois, fichier par fichier, au premier usage | db.js (`flagged`, `fflags`, version 5), photoq.js, bgup.js |
| Liste des plans : replier / déplier tout | Deux boutons « Replier tout » et « Déplier tout » au-dessus de la liste des niveaux (état partagé avec le toggle de chaque niveau) | app.js (`openPlansQuick`), styles.css (`.pq-tools`) |
| Drive : anomalies et réparations de réception par ouvrage | Anomalies et réparations rangées dans des dossiers de catégorie au niveau de « Photos » (Réception / Bétonnage › date › Anomalies › ouvrage), au lieu d'être sous Photos › ouvrage | sync.js (`buildPaths`) |
| Pas de doublon des photos de tableaux dans « 10 - Photos » | Une photo de réception/bétonnage déjà rangée dans un tableau (même taille et même date de prise) n'est plus envoyée dans « 10 - Photos » ; la copie déjà envoyée est mise à la corbeille Drive | sync.js (`isDup`, `sigOf`) |
| Sauvegarde complète : 2 copies seulement | Une seule sauvegarde par espace « Espace-<nom>.chantier.zip » (mise à jour sur place) + copie « (précédente) » ; le manifeste est mis à jour sur place ; les anciennes sauvegardes datées vont à la corbeille | gdrive.js (`backupSaveDated`, `espaceBackupList`) |
| Drive : arborescence des plans = dossiers de l'application | Un plan dans « mezz › gros œuvre » est rangé dans Drive en vrais dossiers (01 - Plans › mezz › gros œuvre) au lieu d'un seul dossier « mezz - gros œuvre » ; les fichiers déjà envoyés sont déplacés | sync.js (`buildPaths`, `FC`) |
| Document Studio — socle (phase 1) | Noyau `DocumentStudio` (modèles, champs, positions PDF normalisées, périmètre entreprise côté client, circuit brouillon→archivé) chargé au démarrage ; deux tables IndexedDB locales `dsmodeles` et `dsdossiers` (non synchronisées) ; correction de la validation des dates. Pas encore d'interface | document-studio.js, db.js (v6), index.html |
| Suivis personnalisés (Document Studio, phase 2) | Outils › « Suivis personnalisés » : Form Builder (colonnes texte, nombre, date, liste, case, obligatoire), saisie de lignes, tableau, suppression ; 100 % local (tables dsmodeles / dsdossiers, non synchronisées). Pas de signature ni de circuit de validation dans l'interface | suivis.js, siteteam.js, document-studio.js |
| Telegram (phase B, première brique) | Logique des rappels à envoyer, envoi Bot API en simulation par défaut, lecture de /start CODE ; pas de serveur déployé, pas de liaison réelle | integrations/telegram/ |
| Suivis personnalisés — modèle visuel (Document Studio, phase 3) | Dans le Form Builder : ajouter une photo/PDF de bon, placer les cases avec l'éditeur existant (`ftEditor`) en les liant aux colonnes du suivi ; chaque ligne a un bouton « PDF » qui écrit les valeurs (écriture manuscrite) sur le bon. Local (le PDF est régénéré à la demande, non archivé). Limites : 1re page seulement, pas de signature ni de circuit, non testé sur téléphone. | `suivis.js`, `fiches.js` (cases `k:'col'`) |
| Détection automatique des cases (Document Studio, phase 5 partielle) | Dans l'éditeur de cases (bons, fiches, suivis) : « ✨ Détecter » repère les intitulés imprimés (DATE, ZONE, OUVRAGE, NOM, VISA…) dans le texte du PDF ou, pour une photo/scan, par OCR hors ligne (tesseract local), et propose une case à côté de chacun, à vérifier. Pour un suivi, seules les cases qui correspondent à une colonne sont gardées. Limites : l'écriture à la main n'est pas lue ; OCR anglais seulement (intitulés en capitales) ; page 1 ; les cases sont à ajuster ; pas de suppression de l'ancienne écriture. | `autocases.js`, `fiches.js` |
| Suivis personnalisés dans Réception / Bétonnage (onglets) | Les suivis (Gradins, Chape, Maçonnerie…) s'ajoutent comme onglets à côté de Réception et Bétonnage (dont l'écran reste inchangé) avec un bouton ＋. 15 modèles prêts (classés selon le type de projet, « conseillé ») ou suivi vide. Colonnes modifiables (nom, type, choix, ordre, suppression, les valeurs saisies restent), lignes modifiables/supprimables, recherche, PDF par ligne si modèle visuel, suppression du suivi. Données locales au téléphone (non synchronisées). | `suivis.js`, `reception.js` (3 points d'accroche), `app.js`, `styles.css` |
| Suivis personnalisés : design soigné | Galerie de modèles en cartes (⭐ conseillés selon le type de projet), en-tête avec compteur et bouton Modifier, tableau arrondi (en-têtes discrets, lignes alternées, ✓ vert, nombres alignés), bouton « Nouvelle ligne » fixe en bas, colonnes du constructeur en cartes avec ↑ ↓ ✎ ✕ alignés, onglet actif toujours visible. | `suivis.js`, `styles.css` |
