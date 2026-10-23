# AGENTS.md — consignes pour Codex (et tout agent) travaillant sur SiteTeam

## Lire d'abord
1. `docs/PROJECT_OVERVIEW.md` puis `docs/EXISTING_ARCHITECTURE.md`
2. `docs/FEATURES_INVENTORY.md` (état réel de chaque module)
3. `docs/KNOWN_ISSUES.md`, `docs/SECURITY_NOTES.md`
4. Pour le build : `docs/BUILD_INSTRUCTIONS.md`, `docs/CAPACITOR_SETUP.md`, `docs/REPRISE.md`

## Contexte indispensable
- Branche de travail : **`siteteam`**. La branche `main` est une autre application (*Chantier*) : n'y pousse rien
  pour SiteTeam et ne fusionne pas les deux branches.
- JavaScript vanilla, fichiers globaux chargés par `www/index.html` (l'ordre compte). Pas de framework, pas de bundler.
- `android/` est généré au build : ne le commite pas, modifie plutôt le workflow ou `ci/*.sh`.

## Règles absolues
- **Préserver toutes les fonctionnalités existantes.** Pas de suppression, pas de réécriture globale, pas de
  changement d'architecture ou de framework sans demande explicite du propriétaire.
- Ne jamais modifier : `appId` `com.siteteam.app`, le nom de base IndexedDB `chantier`, `keystore/debug.keystore`,
  le mécanisme `__APP_VERSION__`.
- IndexedDB : augmenter `VERSION` pour ajouter un magasin, ne jamais en supprimer.
- Firestore : toute nouvelle collection/champ sensible ⇒ mettre à jour `FIRESTORE_RULES` (team.js), tester avec
  les émulateurs, et signaler au propriétaire qu'il doit **publier les règles** dans la console.
- Ne jamais commiter de secret (clé de publication, mot de passe, compte de service, `.env`).
- Ne jamais déclarer une fonctionnalité terminée sans l'avoir exécutée ; distinguer « testé » / « non testé ».
- Le propriétaire travaille depuis son téléphone : chaque livraison = un push sur `siteteam` qui produit
  `siteteam-v1.0.<n>` ; donne-lui le lien de la release et ce qui a changé.

## Vérifications avant chaque push
```bash
for f in www/js/*.js; do node --check "$f" || exit 1; done
node ci/rules.mjs            # les règles s'extraient toujours
```
Après le push : le workflow **Build SiteTeam** doit être vert (il échoue si la signature n'est pas `E3:EC:F4:31…`).
Pour un changement de règles ou de droits : lancer le test E2E (`st-test.yml`, branche `siteteam-ci`).

## Style
- Code et commentaires en français, comme le code existant ; messages de commit en français.
- Réutiliser les helpers de `ui.js` (`sheet`, `menu`, `formSheet`, `toast`, `loading`, `icon`, `esc`, `$`, `$$`).
- Mettre à jour `docs/FEATURES_INVENTORY.md` et `docs/KNOWN_ISSUES.md` quand l'état d'un module change.
