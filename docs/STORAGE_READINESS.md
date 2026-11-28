# SiteTeam — préparation du stockage

## Étape 1 : observabilité locale
L'inventaire utilise DB.fileMetadata() pour parcourir les fichiers sans conserver les blobs. Il distingue les octets locaux, les références Drive et SiteTeam Cloud, les tailles distantes inconnues et les fichiers sans référence distante. Ces chiffres ne sont ni des volumes facturables, ni une preuve de sauvegarde distante. Aucun changement de schéma ou de droits. Tests ajoutés, CI et appareil réel à vérifier.

## Étapes suivantes
1. Mesurer l'usage Firebase de production et comparer les règles déployées avec celles du dépôt.
2. Auditer les opérations qui chargent encore tous les fichiers et vérifier les restaurations sur appareil distinct.
3. Concevoir une comptabilité de stockage côté serveur par organisation, avec réservation atomique avant upload, finalisation idempotente et réconciliation des objets.
4. Tester le cloisonnement entre organisations, l'accès révocable, la reprise des uploads et la charge progressive.
5. N'annoncer des quotas garantis qu'après validation de ces étapes.

Les quotas des packs restent indicatifs. Aucune nouvelle infrastructure provisionnée ni facturation activée. Voir aussi FEATURES_INVENTORY.md, KNOWN_ISSUES.md et SECURITY_NOTES.md.
