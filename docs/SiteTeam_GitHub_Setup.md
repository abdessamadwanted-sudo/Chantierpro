# SiteTeam — Dépôt GitHub privé et accès Codex (pas à pas, faisable depuis un téléphone)

Situation actuelle : le code est dans `github.com/abdessamadwanted-sudo/Chantierpro` (**public**), branche `siteteam`.
Objectif : une **copie privée** complète (historique compris) sur laquelle Codex travaille, sans casser
les téléchargements d'APK qui dépendent du dépôt public (voir SECURITY_NOTES.md §1).

## Option recommandée : importer le dépôt (historique complet, sans PC)
1. Ouvrir **github.com/new/import** dans le navigateur du téléphone (connecté au compte `abdessamadwanted-sudo`).
2. *Your old repository's clone URL* : `https://github.com/abdessamadwanted-sudo/Chantierpro.git`
3. *Repository name* : `SiteTeam` (par exemple) — cocher **Private** — *Begin import*.
4. Attendre l'e-mail « import complete ». Toutes les branches sont copiées (`main`, `siteteam`…).
5. Dans le nouveau dépôt : *Settings › General › Default branch* → `siteteam`.
6. *Settings › Branches* → règle de protection sur `siteteam` : interdire *force push* et suppression.
7. Vérifier que `keystore/debug.keystore` est présent (nécessaire aux builds) — le dépôt étant privé, il n'est plus public dans cette copie.

Les workflows GitHub Actions fonctionnent dans un dépôt privé (minutes gratuites limitées par mois).
Les releases d'un dépôt privé ne sont **pas** téléchargeables sans connexion : continuer à distribuer
l'APK depuis le dépôt public tant qu'une autre solution n'est pas choisie.

## Variante : à partir du ZIP (sur un ordinateur)
```bash
unzip SiteTeam_Source_Code.zip && cd SiteTeam_Source_Code
git init -b siteteam && git add . && git commit -m "Import SiteTeam (sauvegarde du 23/10/2026)"
git remote add origin https://github.com/<compte>/SiteTeam.git   # dépôt privé créé vide sur github.com/new
git push -u origin siteteam
```
Puis remettre la clé à sa place (`keystore/debug.keystore`, fichier fourni séparément) et la commiter
**seulement** dans le dépôt privé si les builds CI doivent continuer à signer avec elle. L'historique Git
n'est pas conservé avec cette variante.

## Donner l'accès à Codex
1. Dans ChatGPT › Codex › paramètres : connecter GitHub et autoriser l'application **sur le dépôt privé** choisi
   (accès limité à ce dépôt plutôt qu'à tous).
2. Indiquer à Codex de travailler sur la branche **`siteteam`** et de lire `AGENTS.md` en premier.
3. Lui demander des **pull requests** plutôt que des pushs directs sur `siteteam` ; activer
   *Require a pull request before merging* sur `siteteam`.
4. Ne jamais lui donner de clé de publication ni d'accès propriétaire Firebase.

## Garder les deux dépôts cohérents
Choisir un seul dépôt de travail (le privé). Pour publier une version téléchargeable publiquement, pousser
ensuite la branche vers le dépôt public :
```bash
git remote add public https://github.com/abdessamadwanted-sudo/Chantierpro.git
git push public siteteam
```
