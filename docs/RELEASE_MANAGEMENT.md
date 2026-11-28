# SiteTeam — Release Management

## Développement et intégration
- Branche d'intégration : `siteteam`. `main` reste Chantier et n'est pas modifiée.
- Chaque lot passe par une branche `agent/<sujet>`, une PR vers `siteteam` et les tests. Le propriétaire approuve les fusions.
- Fusionner une PR fonctionnelle ne publie plus d'APK, de bundle OTA ou de pointeur latest.json.
- Le code intégré peut servir de base de validation avant publication. Ce n'est pas encore un environnement Staging isolé : pas de Firebase de test distant ni d'APK Staging distribué.

## Production Android / OTA
1. Vérifier les PR intégrées, les tests et la dernière release réelle, puis décider d'une version X.Y.Z supérieure à toutes les releases SiteTeam existantes.
2. Ouvrir une PR de publication séparée qui modifie `release/siteteam.json` (exemple : {"version":"1.1.0"}) et `RELEASE_NOTES_SITETEAM.md`. Ne pas changer ce manifeste dans les PR fonctionnelles.
3. Après approbation explicite, fusionner. Le workflow Build SiteTeam vérifie les tags, exécute la CI, construit l'APK, vérifie la signature existante, crée le ZIP/manifest OTA et publie la release puis latest.json.
4. Vérifier les trois assets et le pointeur latest.json ainsi que l'installation sur un appareil de test. Une release créée n'est pas à elle seule une preuve de disponibilité OTA.

Le manifeste initial vaut null : la fusion de la PR de configuration n'émet aucune version. Le versionCode Android reste github.run_number du même workflow (croissant) ; la version visible et les noms de tags/OTA utilisent X.Y.Z. Pas de retour à une version inférieure ; en cas de régression, préparer un correctif ou une nouvelle version avec le code corrigé. La première publication après cette modification peut demander une installation APK, car l'empreinte native historique inclut le fichier du workflow.

## Cadence et incidents
- Regrouper les améliorations stables, idéalement toutes les une à deux semaines selon besoin ; les corrections urgentes peuvent être publiées seules.
- MAJOR : changement incompatible, MINOR : évolution compatible, PATCH : correction compatible. Pas de suffixes beta dans le canal officiel.
- Une seule publication à la fois. Ne pas relancer une publication dont le tag existe déjà. Si les assets ont été publiés mais pas latest.json, contrôler le tag, le commit et les assets puis réparer uniquement le pointeur via une intervention dédiée approuvée ; ne pas écraser le tag.
- Les workflows web/admin et Play restent distincts et inchangés. La séparation complète des environnements, le canal beta, les protections de branche et les approbations GitHub Environments restent à configurer.

## Vérification
Tests de version : `node --test ci/release-version.test.mjs`. La CI de PR ne publie rien ; le parcours réel de publication sera vérifié lors de la première PR de version approuvée.
