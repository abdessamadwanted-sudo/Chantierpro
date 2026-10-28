# FEATURES_INVENTORY — inventaire fonctionnel réel de SiteTeam

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
| Comptes / authentification | Connexion obligatoire, création de compte, mot de passe oublié | team.js (`loginScreen`) | Écran de connexion | Firebase Auth, `users/{uid}` | Fonctionnel (testé, y compris suppression de compte) | E-mail/mot de passe seulement ; page web de suppression à faire |
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
| Notifications | Rappels locaux programmés | app.js (`LocalNotifications`) | Rappels | `project.rappels` | **Partiel** | Pas de notifications push entre utilisateurs |
| Messages | — | — | — | — | **Absent** | Partage via liens WhatsApp uniquement |
| Planning | — | — | — | — | **Absent** sur SiteTeam (un `planning.js` existe sur `main` seulement) | — |
| Gestion administrative | — | — | — | — | **Absent** | — |
| Synchronisation | Firestore (données) + Drive (fichiers) | sync.js, team.js | Pastille de synchro, Paramètres | toutes | Fonctionnel (testé : synchro Firestore) | Voir KNOWN_ISSUES (IndexedDB) |
| Sauvegarde .chantier | Export/import d'un projet complet | backup.js, app.js | Paramètres ; Accueil › ⋮ › Restaurer | toutes | Fonctionnel (non testé auto) | — |
| Import depuis Chantier | Récupérer les projets de l'app Chantier | team.js (`importChantier`) | Réglages | Drive de Chantier | Fonctionnel (non testé auto) | — |
| Langues | FR / العربية / EN | i18n.js | Menu › Langue | — | Fonctionnel (non testé auto) | Traduction par remplacement de libellés |
| Emploi & carrière | Recherche d'offres, dossier de candidature | career.js | — | — | **Présent dans le dépôt mais non chargé** (absent de index.html, aucun appel à `openCareer`) | À retirer ou à relier |

## v1.0.35 — Accueil, lots & équipes (ce lot de changements)

Accueil : les cartes « Tableau de bord des équipes » / « Rendement journalier » utilisent les modules déjà actifs
(permissions par poste) ; le contenu identique sur tous les espaces d'une même société vient des niveaux de
permission des postes (voir « Gérer les postes »), pas d'un bug d'affichage — non modifié, à vérifier avec le
propriétaire si un contenu différencié par espace est attendu. En-tête de l'accueil (« Bonjour, … ») : réduction
douce au défilement, carte « Mon dossier pro » déplacée dans l'en-tête. Barre de navigation basse (`.st-bnav`) :
désormais pleine largeur, fixée, masquée automatiquement derrière un plein écran ou une feuille modale (CSS
`:has()`), contenu de l'accueil avec marge basse suffisante. Bouton « Affectations » retiré du tableau de bord
Direction (fonction conservée au niveau du projet) ; remplacé par une liste déroulante « Tous les projets ▾ »
stylée. Pastille de synchro (`sync.js`) : messages d'erreur Firestore/réseau traduits en français au lieu du texte
brut (ex. « Missing or insufficient permissions » → « Synchro refusée (règles Firestore à publier) »). Délégation
d'équipe : texte d'aide ajouté sur le module « Équipe du projet » rappelant que le niveau « Valider » permet de
créer des codes d'accès et d'inviter d'autres personnes sous sa responsabilité (fonction `delegate()` déjà
existante, plafonnée au niveau du délégant). Lots (plans) : actions du lot regroupées par catégorie (Suivi /
Gestion / Rubriques / Raccourcis) au lieu d'une rangée unique ; nouvelle section « Équipes & sous-traitants » par
lot et par niveau (`folders.lotData[lotId]._eq`, tableau d'entrées zone/responsable/effectif/coût/consommation/
rendement journalier) ; alerte « En retard sur le planning » dans l'échéance du lot quand l'écart temps écoulé /
avancement réel dépasse 15 points. Fonctionnel (non testé auto) — à ajouter à `ci/st.mjs`.
