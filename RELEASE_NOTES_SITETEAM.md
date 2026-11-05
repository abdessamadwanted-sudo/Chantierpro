## SiteTeam : v1.0.85
- Sous-dossier créé dans un lot (avec « ＋ sous-dossier » du niveau) : il n'apparaît que dans ce lot. Les anciens sous-dossiers restent visibles partout.

## SiteTeam : v1.0.84
- Synchro Drive : les fichiers déjà envoyés sont mémorisés à part, donc la synchro ne repart plus de zéro.

## SiteTeam : v1.0.82 et v1.0.83
- Démarrage : la synchronisation attend 2 minutes après l'ouverture, et se reporte si la mémoire est pleine (moins de redémarrages et de mode secours).
- Base locale : les erreurs « transaction was aborted » sont réessayées automatiquement.
- Synchro : les fichiers partent un par un, et les gros fichiers sont libérés de la mémoire après envoi (moins de redémarrages).
- Non fait ici : réduction de la résolution des plans PDF (à valider sur téléphone).

## SiteTeam : v1.0.81
- Plan : le pin 3D de focus (ouvert depuis le tableau) a la même taille que les autres pins et suit le zoom ; il reste jusqu'à la fermeture du plan (puis disparaît), le pin permanent reste.

## SiteTeam : v1.0.80
- Lots : le bandeau ne montre plus que le lot choisi ; « ▾ Lots » ouvre la liste (lots, Sans lot, ＋ Nouveau lot). Toucher le lot choisi ouvre aussi la liste.

## SiteTeam : v1.0.79
- Paramètres du projet : « Sauvegarder dans Drive (même fichier) » met à jour toujours le même fichier du projet dans SiteTeam / Sauvegardes / Projets, au lieu de créer un nouveau fichier.
- « Envoyer / enregistrer le fichier » garde l'envoi (WhatsApp, email…) en un seul geste.

## SiteTeam : v1.0.78
- Tableaux Réception / Bétonnage / Anomalies : colonne 📍 dédiée (le bouton n'est plus dans la cellule de l'élément).
- Sur le plan, un point réception/bétonnage est un pin rouge simple (plus d'emoji), qui grandit et rétrécit avec le zoom comme le pin photo.
- Barre des lots : recherche supprimée ; bouton « ☰ Choisir un lot » (liste) dès 5 lots.
- Intensité du dessin : une seule direction, de la couleur (à gauche) vers une couleur pâle (à droite).
- Non fait dans cette version : séparation des tableaux photos par lot (besoin d'un champ lot), poteaux absents du PDF partagé, suppression d'espace, optimisation du démarrage (mémoire des plans R+2).

## SiteTeam : lots par niveau
- Barre des lots : recherche de lot (apparaît dès 5 lots).
- En choisissant un lot ou en ouvrant son panneau, la page reste à la même place (plus de remontée puis redescente).

## SiteTeam : pin photo sur le plan
- Les pins des photos : pointe rouge avec une icône appareil photo (plus de cercle autour), chiffre si plusieurs photos ; ils restent lisibles quand on dézoome (taille minimale).

## SiteTeam : chargement du plan avec pourcentage, connexion
- Ouverture d'un plan : barre de chargement avec le **pourcentage réel** de lecture du fichier (il disparaît dès que le plan s'affiche, et au plus tard après 30 s).
- Connexion : Android ne propose plus les adresses Google enregistrées dans le champ e-mail en mode « Se connecter », ni le mot de passe enregistré (création de compte inchangée).

## SiteTeam : sauvegarde complète dans Google Drive (un seul fichier)
- Une seule sauvegarde complète de tous les projets, dans **Mon Drive › SiteTeam › Sauvegardes** (fichier « SiteTeam-sauvegarde-complete.chantier.zip »), mise à jour à chaque fois : plus de fichier en double.
- Automatique : au plus une fois toutes les 12 h, si Google Drive est connecté. Manuelle : ⋮ › « Sauvegarde complète dans Drive ».
- Garde-fou : la sauvegarde Drive n'est jamais remplacée automatiquement par une version qui a moins de projets ; en manuel, une confirmation est demandée.
- Restauration : « Restaurer une sauvegarde » › « Depuis Google Drive » (remplace les projets du téléphone par la sauvegarde complète).

## SiteTeam : projets jamais « disparus » sans explication
- Si des projets sont sur le téléphone mais masqués par le contrôle d'accès (compte / connexion non confirmés), l'application le dit : « N projet(s) sont sur ce téléphone », avec « Afficher mes projets quand même », « Réessayer la connexion » et l'envoi du rapport (la cause est notée dans le journal de démarrage).

## SiteTeam : Photos — un pin = un dossier
- Photos : chaque pin photos est un seul dossier (à son nom, avec le niveau) ; ses dossiers (Nettoyage, Porte provisoire…) sont des sous-dossiers à l'intérieur — plus de groupes séparés.
- Réception / Bétonnage : le bouton 📍 « Placer cet ouvrage sur le plan » est maintenant sous le champ Élément, y compris dans « Nouvelle ligne » (la ligne est enregistrée puis le plan s'ouvre).
- « Sur le plan » : le plan s'ouvre zoomé avec un pin 3D rouge (bille et tige) planté à l'endroit exact.

## SiteTeam : le plan s'ouvre de nouveau normalement
- Photos : « Toutes les photos » depuis un plan s'ouvre déjà filtrée sur ce lot et ce niveau — un niveau est reconnu quelle que soit son écriture (0-SSL / Sous-sol, 1-MEZZ / Mezzanine…) ; si le lot n'a aucune photo à ce niveau, un message clair et « Voir tous les niveaux ».
- Photos : 📍 « Plan du niveau » (groupe ou photo ouverte) pour les photos sans pin (réception, bétonnage, anomalies…) : ouvre le plan du même niveau et du même lot ; les photos avec pin gardent le zoom sur l'endroit exact.
- Réception / Bétonnage : 📍 directement sur chaque ligne du tableau — ouvre le plan du niveau de la ligne (direct s'il n'y en a qu'un), on touche la partie d'ouvrage pour placer le pin ; retouchez 📍 pour voir, déplacer ou retirer. Pin rouge ⚠️ = anomalie ouverte, vert ✅ = traitée ; mis à jour automatiquement avec la réserve levée / réparation.
- Tableau des anomalies : action 📍 « Voir / Placer sur un plan » (réception, bétonnage, non-conformité ; réserve : ouvre le pin sur le plan). Les photos d'une ligne placée ouvrent le plan avec zoom exact sur son pin.
- Retrait du bouton ◐ « Plan noir et blanc » (visionneuse et Avancement) et du choix de version à l'export : le PDF annoté et l'image du plan sortent toujours en couleurs d'origine. Ce réglage pouvait réduire la visionneuse à une petite case (seul l'en-tête restait visible) ou fermer l'application sur les grands plans A0.

## SiteTeam : bibliothèque métier unifiée et organigramme complet
- Basic et Pro : une bibliothèque unique qui adapte automatiquement son contenu au pack, au service et aux droits de l'utilisateur.
- Accès direct depuis les outils du projet et depuis Team Hub / Mon espace.
- Recherche et filtres par service, avec regroupement clair des outils disponibles et indication des fonctions Pro.
- Organigramme global hiérarchique complété, avec vue par service, responsables, collaborateurs directs, statistiques et recherche.
- Les bibliothèques et l'organigramme restent cohérents sur téléphone, tablette et ordinateur.
- Correction visuelle du sélecteur Hiérarchie / Services dans l'organigramme.

## SiteTeam : rappel d'échéance du jour qui n'était pas reçu
- Échéance aujourd'hui avec une heure déjà passée : la notification « dans 1 minute » est gardée avec son heure et reprogrammée jusqu'à ce qu'elle parte (avant, la reprogrammation suivante l'annulait sans la remettre). Changer l'heure ou le rappel d'une échéance en reprogramme une nouvelle.
- 🔔 Réglages : « Choisir une sonnerie du téléphone » (sonneries, alarmes, notifications, ou silencieux) pour les rappels d'échéances, retour à la sonnerie par défaut, et accès aux réglages Android du canal (vibration, écran verrouillé).
- Tableau des échéances : chaque ligne montre la prochaine notification programmée (🔔 date et heure).

## SiteTeam : les notifications des échéances arrivent vraiment
- Le canal « Rappels de chantier » est créé et l'autorisation demandée avant de programmer (avant, sans ce réglage, Android n'affichait rien).
- Échéance proche : si l'heure du rappel « avant » est déjà passée, le rappel arrive le jour même à l'heure choisie ; échéance aujourd'hui avec heure passée → notification dans 1 minute (une fois par jour).
- 🔔 Réglages : « Notification d'essai dans 10 secondes » et liste des notifications programmées (date, heure, titre) ; rappel du réglage batterie Huawei.

## SiteTeam : Photos sans fermeture de l'application
- Notifications des échéances sur le téléphone (même application fermée) : Tableau des échéances › 🔔 — activées ou non, heure, rappel par défaut (le jour même, 1, 2, 3 jours ou 1 semaine avant), rappel si la date est dépassée, types d'alertes à notifier. Chaque échéance peut avoir son propre rappel et son heure. Toucher la notification ouvre le tableau des échéances.
- Photos, dossiers des pins photos, dossier d'une case et tableau photos : les miniatures sont des images légères (≈ 360 px), préparées une à une et seulement quand elles apparaissent à l'écran. Avant, ouvrir plusieurs groupes décodait chaque photo entière (12 Mpx) et Android pouvait fermer l'application.

## SiteTeam : Photos rangées par lot, sous-dossiers, « 📍 Sur le plan »
- Photos › Catégorie : la liste montre les lots du projet (Gros œuvre, Maçonnerie, Chape, Local technique…) plus Réception, Bétonnage, Non-conformités, Anomalies ; les dossiers (Nettoyage, Porte provisoire…) sont des sous-dossiers dans chaque lot (filtre « Dossier »). Un pin posé sur le plan « Chape mezz » est rangé dans Chape.
- Réception, Bétonnage et Anomalies sont trois catégories séparées (toujours dans la liste) : Réception / Bétonnage = photos des ouvrages ; Anomalies = photos des anomalies et de leur traitement, rangées en sous-dossiers Réception / Bétonnage.
- Fiche du lot plus courte : une seule section à la fois (Avancement, Photos, Échéance + ses alertes, Points d'arrêt, Accès rapides, Contrôle) — avant, la liste des échéances et la grille des accès rapides restaient affichées.
- « 📍 Sur le plan » : sur chaque groupe de photos, dans la galerie, et à côté de chaque pin photos d'un lot — le plan s'ouvre zoomé à l'endroit exact, avec un cercle jaune qui clignote.

## SiteTeam : liens intelligents niveau + lot, quantités Global, échéances, anomalies, plan noir et blanc
- Plans : les dessins (ligne, polyligne…) restent toujours visibles au-dessus du rendu net du plan ; zoom au pincement sans carrés noirs.
- Plan noir et blanc : bouton ◐ (plan et plan d'avancement) — le plan passe en gris, vos dessins, pins et couleurs d'avancement ressortent. Partager : « Couleurs d'origine », « Noir et blanc » ou « Les deux (2 fichiers) ».
- Plans › niveau › lot : chaque bouton s'ouvre sur CE niveau et CE lot — Avancement (tableau de bord filtré), Photos (« Toutes les photos · MEZZ · Chape »), Suivi du lot · équipes (le bon lot), Réserves, et nouveau « Suivi des anomalies ». Un pin photos posé depuis un lot garde ce niveau et ce lot.
- Accès rapides rangés en grille (Contrôle · Suivi · Qualité · Rubriques).
- Avancement par quantités : « 📏 Quantités » — quantité globale (m², m³, ml, nombre…) par niveau × lot (ou zone), quantité faite chaque jour, équipe, effectif → %, reste, rythme / jour, fin estimée. Les tableaux pondèrent par les quantités (un grand niveau pèse plus) et affichent « fait / Global ».
- Échéances : objet (de quoi il s'agit), zone, état fait ; plusieurs échéances / alertes par lot et niveau (type : Échéance MO, Réception, Livraison, Point d'arrêt, Essai, Plan à recevoir, Rappel). Le badge et le briefing montrent la plus urgente avec son objet.
- Tableau des échéances (Outils du projet › Outils, ou depuis un lot) : en retard / bientôt / à venir / fait, filtres niveau, lot, zone, type, recherche, PDF ; toucher une ligne ouvre le lot.
- Tableau des anomalies (Outils du projet › Outils, ou « Suivi des anomalies » d'un lot) : réception, bétonnage, non-conformités, réserves — photo de l'anomalie et après traitement, statut ouverte / en cours / traitée, délai, filtres, recherche, PDF avec photos, Excel ; ajouter la photo de traitement et marquer traitée en un geste.
- Tableau photos : chaque case s'ouvre comme un dossier — photos rangées par catégorie (Avancement, Nettoyage, Avant / Après travaux, Anomalie…), ajout avec catégorie, choisir, déplacer, supprimer, envoyer en PDF ou en photos.

## SiteTeam : Photos — catégories Réception, Bétonnage, Non-conformités, Anomalies & traitement, lots
- Liste « Catégorie » : ⚠️ Anomalies & traitement (anomalies, retours / réparations, non-conformités, réserves), Réception, Bétonnage, Non-conformités, Réserves, PV, puis chaque lot (Étanchéité, Maçonnerie, Local technique…).
- Les photos des constats de non-conformité (Constats / NC) sont rangées dans « Non-conformités », avec « Ouvrir › ».

## SiteTeam : bons à remplir, tableau d'avancement en photos, outils déplaçables, nouveau design
- Bons & modèles (Outils du projet › Outils) : ajoutez un bon en PDF ou en photo (recadrée et nettoyée) ; il reste comme modèle de référence. Chaque remplissage est une copie : cases placées une fois (date, ouvrage, noms…), texte n'importe où, stylo au doigt (bleu, noir, rouge, vert · fin, moyen, gras), gomme, annuler, zoom. Le PDF garde la qualité du modèle (écriture vectorielle, bien visible) ; documents remplis gardés, modifiables, dupliquables, partageables.
- Tableau d'avancement : nouvelle vue 📷 — chaque case local × lot montre ses photos (nombre, dernière photo) ; toucher pour voir, ajouter ou faire le PDF ; « ＋ Colonne » pour ajouter Nettoyage, Chape, Porte provisoire… ; PDF de toutes les photos du niveau / de la zone.
- Photos : la catégorie suit l'origine — un pin photos posé sur un plan « Local technique » ou « Chape » est rangé dans Local technique / Chape, avec ses dossiers (Porte provisoire, Étanchéité…) en sous-groupes, et un filtre « Dossier ».
- Photos : Réception et Bétonnage séparent Photos ouvrage / Anomalie / Traitée (+ filtre « État ») ; bouton « Ouvrir le tableau › » ; dans la galerie, 👁 ouvre la fiche d'où vient la photo.
- Outils du projet : appui long sur un outil (ou « Organiser ») pour le déplacer vers une autre catégorie (ex. Réception & Bétonnage → Chantier) — le menu ☰ suit le même rangement.
- Nouveau design des Outils du projet : actions rapides en couleurs, catégories teintées, pictogrammes pleins et lisibles.
- Comparer les niveaux : pour choisir l'autre plan, deux listes déroulantes Lot et Niveau (le lot du plan de départ est proposé : Local technique ↔ Local technique), plans rangés par niveau.
- Panneau d'administration › Centre de contrôle : bouton « 🎛 Ce qu'il voit » sur chaque utilisateur — espace personnel : outils oui / non et fonctions offertes ; membre d'une organisation : pour chaque outil Aucun accès (masqué) / Voir / Modifier / Valider / Administrer, avec « Tout masquer », « Tout en lecture », « Tout modifier » (règles Firestore à publier).
- Packs & fonctions : le nom de chaque ligne reste visible quand on fait défiler le tableau sur le côté.
- Plans A0 : fini le plan qui clignote ou devient noir — l'écran utilise une image allégée (la netteté au zoom vient du PDF / DWG), la loupe ne charge l'image que si on s'en sert, les calques nets sont limités et vidés après usage.
- Plans : le clavier (titre d'un pin, d'une note) ne remet plus le zoom à zéro.

## SiteTeam : démarrage plus léger, rapport de diagnostic plus précis
- Les PDF des tableaux (réception, réserves avec photos, rapports) ne sont plus créés pour Drive dans les 3 premières minutes après l'ouverture, et 3 au plus à la fois : le démarrage reste léger.
- 2 fichiers à la fois (au lieu de 3 à 4) pour l'envoi et le téléchargement avec Drive : moins de mémoire avec les plans A0.
- Rapport de diagnostic : il note ce que faisait la synchro (envoi, téléchargement, PDF, taille du fichier, mémoire) et la préparation des photos — si Android ferme l'application, on voit sur quoi.

## SiteTeam : Photos — tout regroupé par catégorie, niveau et zone, recherche et PDF au choix
- Photos : toutes les photos du projet réunies — pins photos (Porte provisoire, Nettoyage, Brique…), locaux / avancement, réception, bétonnage, anomalies, retours / réparations, PV, réserves, rapports.
- Barre de recherche (porte, chape, R+1, zone 4, anomalie…) et filtres : Catégorie, Niveau, Zone, Source, Période (aujourd'hui, 7 j, 30 j, 3 mois).
- Regrouper par Catégorie (ex. Porte provisoire › MEZZ · Zone 4), par Emplacement ou par Date.
- PDF : une catégorie entière (bouton à côté du titre), un seul groupe (niveau · zone), ou tout ce qui est filtré (bouton PDF en haut) ; nom du fichier et titre modifiables.
- PDF plus beau : les catégories se suivent (plus de page presque vide pour 1 photo) et chaque photo garde sa forme (paysage large, portrait haut), en grand, sans cadre vide ni recadrage.
- Les photos des dossiers des pins photos ne tombent plus dans « À classer ».

## SiteTeam : l'envoi des photos vers Drive ne reste plus figé
- Un envoi bloqué (réseau de chantier qui gèle, réponse Google qui n'arrive pas, autorisation Google restée sans réponse) est abandonné après un délai et repris à la prochaine synchro : les autres photos continuent (avant : « 3/59 vers Drive » ne bougeait plus).
- Si des photos n'ont pas pu partir, la pastille passe en « problème(s) de synchro — touchez pour voir » au lieu de tourner sans fin.
- Une seule pastille d'envoi : la petite roue en haut à droite se cache quand « vers Drive » est affichée en bas.

## SiteTeam : l'application ne se ferme plus après l'ouverture de plusieurs plans
- Fermer un plan libère maintenant sa mémoire (PDF ouvert, calques nets du zoom, image du plan). Avant, chaque plan A0 ouvert restait en mémoire et, après quelques plans, Android fermait l'application (puis « mode secours »).
- Même nettoyage pour le lecteur PDF, l'import de plans PDF et la lecture du cartouche ; le comparateur garde 2 PDF au lieu de 4.
- Rapport de diagnostic : indique le plan ouvert (taille, mémoire) juste avant une fermeture.

## SiteTeam : Packs & fonctions — contrôle total de ce que chaque pack ouvre
- Panneau d'administration › nouvel onglet « Packs & fonctions » : pour chaque pack, cochez les fonctions premium (comparer, outils PDF, DWG → PDF, rapports PDF, envoyer un plan annoté, PDF des pins photos) et les outils ; « Essai gratuit (jours) » par pack.
- Organisations › un espace › « Pour cet espace » : offrir une fonction (7 j, 1 mois… ou toujours) et ajouter / retirer un outil, au-dessus du pack.
- Dans l'application : une fonction non incluse affiche 🔒 avec le pack qui la contient et « Voir mon abonnement / demander un pack ».
- Tracer en PDF : bouton « ⚡ Comme AutoCAD » (A0 pleine page, paysage, ajusté, couleurs, traits fins) et marges « Pleine page (full bleed) ».
- Règles de sécurité visibles par le Super Admin seulement.
- Serveur (règles à publier) : un espace dont l'accès a pris fin, ou un espace personnel non autorisé (accès sur code uniquement), n'ouvre plus ses projets ; un administrateur d'espace ne peut pas s'offrir de fonctions ni d'outils.

## SiteTeam : « accès sur code uniquement » sans faille au premier lancement
- Nouveau compte : l'écran de création d'espace n'apparaît qu'après lecture des réglages SiteTeam ; réseau lent ou réglages illisibles → « Connexion nécessaire » (avant : la personne pouvait créer un espace Basic sans code).
- À chaque ouverture, le contrôle d'accès est refait dès que les réglages sont à jour : un espace créé sans code est arrêté (écran « Code d'accès ») tant que le Super Admin ne l'autorise pas (Centre de contrôle).

## SiteTeam : créer l'espace d'un inscrit, fiche du lot en boutons, textes lisibles
- Centre de contrôle › Espaces personnels : « 🆕 Inscrits sans espace » — touchez une durée (7 j, 1 mois…) pour créer son espace personnel, sans couper « Accès sur code uniquement ». La personne rouvre l'application et arrive dans son espace.
- Plans › niveau › lot : la fiche est rangée en boutons (Avancement, Photos, Échéance, Points d'arrêt, Accès rapides, Contrôle) ; une section ouverte à la fois, gardée en mémoire.
- Fiche du lot : textes des blocs Avancement et Photos lisibles (texte sombre sur fond clair).
- Connexion : le texte tapé (e-mail, mot de passe) reste visible avec le thème clair.
- Règles Firestore : le Super Admin peut créer l'espace personnel d'un compte (à publier).

## SiteTeam : pin photos plus visible, image de plan à refaire
- Visionneuse de plan : l'outil 📷 s'appelle « Pin photos (dossiers) » et le menu ⋮ propose « Pin photos (dossiers) : placer sur le plan ».
- Avancement › ⋮ : « Pins photos (dossiers) de ce plan » — ouvrir un pin ou en placer un nouveau sur le plan du lot.
- Plan coupé ou à moitié blanc : ⋮ › « Refaire l'image du plan » (depuis le PDF d'origine, pins et annotations gardés).
- Pins photos : la photo touchée s'ouvre tout de suite devant la fiche (avant : seulement après l'avoir fermée), 🗑 pour supprimer la photo affichée, et ⋮ du dossier › « Supprimer des photos (choisir) ».
- Pins photos : plus de « À traiter / Traité ».
- Outils du projet : nouvelle tuile « DWG → PDF · plans » (tracer, plusieurs DWG en un PDF, changer le format, fusionner, diviser).
- PDF des photos : photos centrées (une seule photo = pleine page), titre en gras et bien visible « Porte provisoire · Local 1 » sur chaque page.

## SiteTeam : pins photos par dossiers, Centre de contrôle des accès, outils PDF
- Pins photos : dossiers nommés dans chaque pin (Porte provisoire, Brique, Nettoyage… ou votre nom), renommer, monter, supprimer ; les noms déjà utilisés sont proposés.
- Plans › niveau › lot : bloc « 📷 Photos » avec les pins photos des plans de ce niveau et « + Pin photos » (ouvre le plan prêt à placer le pin).
- Envoi : on choisit les dossiers et on retire des photos avant l'envoi, on écrit le nom du fichier et le titre ; PDF avec 4 grandes photos par page (ou 1, 2, 6), nom du pin et du dossier sur chaque page.
- Tout PDF envoyé depuis le téléphone : on peut corriger son nom avant WhatsApp.
- Centre de contrôle (panneau Super Admin) : espaces personnels avec durée d'accès (7 j, 1 mois, 3 mois, 1 an, illimité, arrêter), membres et projets avec leurs droits, historique des actions et des ouvertures.
- Équipe › membre › « Durée d'accès » : l'accès se ferme seul à la date (règles + écran « Accès terminé »), rappel 3 jours avant.
- Outils plans : plusieurs DWG → un seul PDF rangé par niveau puis par lot ; changer le format d'un PDF (A0 → A3, A1 → A4…) en gardant le vectoriel ; réglages gardés.
- Réglages › Application : « Signaler un problème » (arrive dans le panneau avec le diagnostic) et « Stockage du téléphone » (alerte au-delà de 80 %).
- Avancement : le plan se recadre quand son image est prête.
- Google Drive : chaque échange a un délai maximum (plus de pastille « 3/49 vers Drive » figée ni d'icône Drive qui tourne sans fin) ; un fichier qui ne passe pas est repris à la synchro suivante.
- Mon dossier pro : un profil par compte (deux comptes sur le même téléphone ne voient plus le même dossier).

## SiteTeam : membre retiré = accès coupé tout de suite
- « Retirer de l'entreprise » s'applique immédiatement sur le téléphone du membre, même application ouverte ou réseau lent (avant : le téléphone gardait l'accès grâce au cache).
- Les projets, plans et photos de l'organisation sont effacés de son téléphone ; il revient à son propre espace (ou à la création d'un espace).
- Compte bloqué ou organisation suspendue par le Super Admin : appliqué en direct, sans attendre le prochain démarrage.

## SiteTeam : fermetures au démarrage — nettoyage côté Android et diagnostic
- Au lancement, avant même la page, l'application retire côté Android les anciens rappels (17 h, robot emploi) qui pouvaient se redéclencher en boucle et la faire fermer au bout de 20 s.
- Diagnostic : un plantage Android (Java) ou un arrêt du moteur web (mémoire) est enregistré et ajouté au rapport. Réglages › Application › « Rapport de diagnostic » (WhatsApp) à tout moment.
- Mode secours : aucun rappel programmé.
- Avancement : changer de lot ne décode plus plusieurs plans d'un coup (miniatures déjà gardées affichées tout de suite, au plus 2 nouvelles à chaque affichage, rien pour les images très lourdes).

## SiteTeam : comparaison sur le même niveau, équerre stable, avancement par quantité
- Comparer deux plans du MÊME niveau (lots, archi, ANEP…) : même écran que « Comparer deux niveaux » (rideau fluide, plan entier net), rideau seul ; seuls les plans de ce niveau sont proposés ; « Avec un autre niveau » à part. Calage à l'équerre comme entre deux niveaux (une fois par plan).
- Calage à l'équerre : le plan reste immobile pendant qu'on tire l'équerre (plus de tremblement).
- Plans : plus de bouton « Tous » dans la barre des lots — le premier lot qui a des plans est choisi ; « Sans lot » n'apparaît que s'il reste des plans sans lot.
- Cartouche : les indices avec point ou tiret (PE02.5, DCE01…) sont reconnus → le dernier indice et sa date sont justes (avant : PE00 31/10/2025 au lieu de PE02.5 28/08/2026). Indice suivant proposé : PE02.5 → PE02.6.
- Démarrage : logo vectoriel immobile (plus de tremblement), les trois casques se remplissent par le bas comme une batterie, un trait en dégradé fait le tour de l'écran au rythme du chargement, pourcentage affiché.
- Pastille d'envoi des photos : anneau de progression (1/2…) au lieu d'une roue qui tourne sans arrêt.
- Avancement par quantité : quantité totale du local par lot (m², ml, m³, unités, portes, kg) ; on saisit la quantité faite → % calculé (45 / 120 m² = 37 %). Dans la saisie du jour, la fiche du local et le tableau rapide (appui long › valeur). Total du lot en quantité dans son onglet.

## SiteTeam : correction urgente — vibrations en boucle et fermeture
- Le rappel « Saisie d'avancement » de 17 h (v1.0.47) était programmé d'une façon qui, après 17 h, se redéclenchait sans arrêt sur certains téléphones (vibrations en continu, puis fermeture de l'application). Il est supprimé à l'ouverture et remplacé par une notification unique à 17 h, reprogrammée à chaque ouverture.
- Le robot emploi utilisait le même type de rappel : corrigé aussi.
- Mode secours : si l'application se ferme 2 fois de suite au démarrage, l'ouverture suivante se fait sans synchro ni envoi des photos et propose d'envoyer un rapport (dernières étapes + erreurs) par WhatsApp.

## SiteTeam : application plus fluide
- Tableau de bord Avancement : calcul de l'historique beaucoup plus rapide (journal trié une seule fois par local et par lot).
- Miniatures des plans de lot : une seule image décodée à la fois et miniatures gardées sur le téléphone (avant : tous les plans A0 décodés en même temps à chaque ouverture d'un onglet de lot → téléphone saturé).
- Réparation des anciens plans A0 : une seule tentative par plan, un plan à la fois, 4 s après l'ouverture (l'écran reste fluide).
- Plans d'un niveau lus une seule fois (avant : une lecture complète de tous les plans pour chaque plan de chaque niveau).
- Rappel de saisie (17 h) programmé une fois par jour, et non à chaque affichage ; vérification du rangement Drive une fois par session ; page Photos sans accumulation d'observateurs.

## SiteTeam : Avancement relié aux Plans, zones par joints, saisie rapide, équipes & sous-traitants, photos classées
- Plans ↔ Avancement : les dossiers de niveau (2-RDC, 1-MEZZ…) et les plans de chaque lot (Outils › Plans) apparaissent tout seuls dans Avancement. L'onglet Maçonnerie montre tous les niveaux avec LEUR plan de maçonnerie (miniature, nom, indice) ; « ＋ Plan maçonnerie » s'il manque. Les pins d'un niveau sont communs à tous ses plans (recalés automatiquement).
- Dans Plans › lot › niveau : bloc « Avancement » dépliable (%, alerte, dates prévues / réelles / prévision, équipes, saisies du jour, plan + pins, saisie, ✓ Terminé, PDF). Pastille d'alerte sur la barre des lots.
- Lot terminé : bouton « ✓ Terminé » (date de fin) → plus d'alerte rouge ; sinon « En retard de N j ». Une seule alerte par lot et par niveau, aussi dans le Briefing du jour.
- Comparer : bouton ⇄ sur chaque niveau et dans le plan (lot ↔ plan général, deux lots, deux plans, avec un autre niveau). Dans Plans : ⋮ du dossier › « Comparer deux plans ». S'il n'y a qu'un plan, l'ajout s'ouvre directement.
- Plans A0 : image faite par tuiles (plus de plan coupé à moitié blanc) ; les anciens plans coupés sont réparés tout seuls à l'ouverture. Textes et calages gardés en mémoire, images allégées : comparaison beaucoup plus rapide.
- Zones automatiques par les axes des joints (JD01…JD12) : secteurs autour d'un centre (stade) ou bandes (bâtiment), aperçu, centre déplaçable, nom Zone / Joint / JD01 → JD02, secteur, pins rattachés, recopie sur tous les niveaux (calage automatique). Zones : renommer, fusionner, secteur.
- Pro : barre de choix en listes déroulantes (Zone › Niveau › Lot › Équipe › Période : aujourd'hui, hier, cette semaine, semaine dernière, ce mois, total, du … au …), choix mémorisé. Résumé : total + points gagnés sur la période. Sections dépliables et ordonnées : alertes, évolution, détail zone › niveau › lot, équipes, saisies, matrice avec colonne et ligne TOTAL, planning. Total de chaque lot en tête de son onglet.
- Équipes & sous-traitants : type (interne, sous-traitant, tâcheron), société ; part de l'avancement, points gagnés, effectif, jours-homme, rendement, retards, m² ; comparaison interne / sous-traitants ; fiche (courbe, où, photos, historique, rapport PDF / WhatsApp).
- Saisie intelligente : tableau rapide (locaux × lots, toucher 0 › 25 › 50 › 75 › 100, toute une ligne / colonne, historique et suppression), sélection de plusieurs pins sur le plan (toucher ou entourer au doigt), saisie express (texte ou message WhatsApp collé). PV reçu → lot à 100 % ; réserve ouverte sur un local → ⚠ et confirmation avant 100 % ; « Ajouter l'avancement du jour » dans le rapport journalier ; rappel à 17 h si un lot en cours n'a pas de saisie. Les chefs d'équipe ne saisissent que leur lot.
- Ordre partout : niveaux de bas en haut (SSL › RDC › MEZZ › R+1…), lots dans l'ordre des travaux.
- Photos : plus d'album en vrac. Les photos sont rangées par niveau, ouvrage, pin et lot ; « À classer » pour les anciennes (classer vers un pin, une partie d'ouvrage ou une réserve, suppression, captures d'écran repérées). La tuile « Photos » quitte Chantier.
- « Plans des ouvrages du jour » quitte le haut de Plans : il est sous le tableau de réception du jour (option « Afficher aussi dans Plans »).
- Drive intelligent : Plans › Niveau › NN Lot › Niveau_Lot_Ind-X_date, anciens indices dans « _Anciens indices », avancement par Zone › Niveau › Lot › Local. Nouveaux projets directement ; projets existants : « Réorganiser Drive » avec aperçu (rien n'est supprimé ni renvoyé).
- Menus : Outils PDF, Studio photo et Tableau de dessin dans Outils du projet ; Briefing dans Équipe › Pilotage ; menus plus compacts avec recherche et groupes repliables.

## SiteTeam : avancement « Pro Macro » par zone, niveau, lot et équipe ; outils du projet rangés ; zoom fluide
- Outils du projet : actions rapides en une rangée (Avancement du jour, Nouveau PV, Photos en masse, Dossiers Drive). Les catégories se déplient au toucher, et l'application se souvient de celles que vous gardez ouvertes.
- Avancement : zones (Zone 1, Zone 2…). Chaque niveau (SSL, MEZZ, RDC, R+1…) appartient à une zone.
- Deux types de pins sur le plan : local technique (●) et zone de travail (▭ : façade, couloir, gaine…).
- Saisie du jour sur chaque pin : lot, équipe/responsable, % atteint, effectif, quantité, note, photos. Elle met à jour l'avancement du lot et garde l'historique jour par jour. Une pastille orange sur le plan marque les pins saisis aujourd'hui.
- « Avancement du jour » : toutes les saisies d'une journée par zone, avec effectif et équipes. Navigation jour par jour et partage WhatsApp.
- Tableau de bord Pro Macro :
  - anneau global et anneaux par lot ;
  - progression sur 7, 30 ou 90 jours ;
  - matrice zones × lots ou niveaux × lots en couleurs (toucher une zone pour descendre aux niveaux, toucher une case pour ouvrir le plan) ;
  - saisies du jour ;
  - classement des équipes (points gagnés, pins, effectif) ;
  - filtres par zone, niveau, lot et équipe.
- Rapports : PDF (barres par lot, matrice, équipes, journal sur 7 jours), Excel (état et journal), WhatsApp.
- Local technique :
  - étapes photo (Maçonnerie, Chape, Nettoyage, Porte provisoire), cochées et datées ;
  - type de chape en couleur ;
  - dossier complet en PDF (extrait du plan entouré, lots, étapes, photos, journal) à envoyer par WhatsApp ;
  - listes modifiables : zones, équipes, étapes, types de chape.
- Secteurs et zones : secteurs (Nord, Ouest…) découpés en zones par les joints (JD01 → JD02 = Zone 1 / Joint 1…). La zone se dessine sur le plan (coins touchés au doigt) : les pins à l'intérieur s'y rattachent, et la zone peut être recopiée sur les autres niveaux. Le tableau de bord descend secteur → zone → niveau.
- Import automatique des locaux : les étiquettes du PDF (CORE 01, RISER LT, RISER PH, LT HVAC, SAS, LT ELEC…) deviennent des pins, avec leur nom et leur surface (m²). Vous choisissez les familles à importer. Testé sur le plan R+1 locaux techniques du Grand Stade : 55 CORE, 30 RISER LT, 22 RISER PH, 13 LT HVAC…
- Types de local avec le code couleur des plant rooms : Disponible, Électrique, Technologie, Mécanique, Plomberie, Riser / gaine, Wet room. Anneau de couleur sur le pin, et filtre et matrice par type dans le tableau de bord.
- Plusieurs plans par niveau (architecte, numérotation ANEP, chape, maçonnerie…), avec un plan par lot.
- Calque ANEP sur le plan architecte : seuls les numéros propres à l'ANEP s'affichent (calage automatique par les textes communs). « Donner aux pins leur numéro ANEP » remplit le numéro de chaque local.
- Comparaison de deux plans du même niveau (ex. chape architecte ↔ chape exécution) : rideau, transparence ou clignotement, calés automatiquement.
- Comparaison entre lots du même niveau (ex. RDC : gros œuvre ↔ enduit, ou ↔ chape) : chaque lot a son plan. Calage automatique (textes communs : axes, joints) ou manuel (2 points touchés sur chaque plan, mémorisé). Le calage manuel sert aussi au calque ANEP.
- Avancement de deux lots sur le même plan : chaque pin est coupé en deux (◐ lot 1, ◑ lot 2). Le nombre de locaux prêts pour le lot suivant s'affiche (ex. maçonnerie finie, enduit pas commencé). L'image se partage par WhatsApp.
- Planning des lots, grand tableau niveaux × lots (par zone) avec, pour chaque case : %, début et fin prévus, début et fin réels (tirés des saisies) et date de fin prévue au rythme actuel.
- Alertes : pas démarré, démarrage dans 7 jours, fin dépassée, fin dans 7 jours, retard prévu au rythme actuel, terminé dans les délais ou en retard. Les dates s'appliquent à un niveau, à une zone ou à tous les niveaux. Le planning et les alertes sont aussi dans le PDF.
- Plans : zoom sans tremblement. La partie nette apparaît en fondu, et une marge autour de l'écran reste nette quand on déplace le plan.
