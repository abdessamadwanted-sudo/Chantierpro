## SiteTeam : fichiers partagés (plans, photos, PDF)
- Fichiers partagés : les plans, photos, PDF et documents d'un projet sont envoyés dans Firebase Storage. Ils arrivent sur les téléphones de l'équipe et des organisations partenaires, selon leurs droits.
- Mêmes droits que les données : il faut « Voir » pour télécharger et « Modifier » pour envoyer ou supprimer. Ces droits sont vérifiés par le serveur.
- Hors connexion : tout continue de fonctionner sur le téléphone. L'envoi se fait à la prochaine synchronisation.
- Espace du téléphone : les fichiers déjà envoyés peuvent être libérés (réglage « Stockage »). Ils se retéléchargent à l'ouverture.
- Un fichier supprimé dans l'application est aussi retiré du stockage en ligne.
- Taille maximale : 50 Mo par fichier.
- Désactivé par défaut. Le Super Admin l'active (Super Admin › Stockage) après avoir mis en place la formule Blaze, une alerte de budget et les règles Storage.
- À publier : règles Firestore (Réglages › Copier les règles) et règles Storage (Réglages › Copier les règles Storage).
