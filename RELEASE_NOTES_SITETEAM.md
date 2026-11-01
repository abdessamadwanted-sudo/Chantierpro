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
