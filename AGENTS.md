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

## Comment livrer (OBLIGATOIRE — ChatGPT, Codex, Claude, tout agent)
1. Crée une branche à partir de `siteteam` : `agent/<sujet>` (ex. `agent/services-achats-rh`).
2. **Ne pousse jamais directement sur `siteteam`, ni sur `main`.** Ouvre une **Pull Request vers `siteteam`**.
3. La Pull Request lance **Tests SiteTeam** (`.github/workflows/siteteam-tests.yml`) : syntaxe JS, règles Firestore
   et Storage (émulateurs), base locale, parcours complet dans un navigateur (`ci/st.mjs`). Le verdict est dans le
   résumé du workflow ; captures et journaux dans l'artefact `resultats-tests`.
4. Si un test est rouge : corrige sur ta branche. Ne désactive pas un test, ne modifie pas `ci/verdict.mjs` pour le faire passer.
5. Pour une fonctionnalité nouvelle, **ajoute ses tests** : règles dans `ci/rules-test.mjs`, parcours dans `ci/st.mjs`
   (une section `// ---- v1.0.x : …` qui se termine par `log('errors v1.0.x', [...])`).
6. Le propriétaire fusionne la Pull Request quand elle est verte. Le push sur `siteteam` relance les tests, puis
   **Build SiteTeam** construit l'APK et la mise à jour rapide (OTA) **seulement si les tests passent**.

## Stack (ne pas changer)
- Vanilla JS + Capacitor 6 + Firebase (Auth, Firestore, Storage) + IndexedDB. Pas de React, Vite, TypeScript, Flutter,
  NestJS, PostgreSQL ou microservices sans demande explicite du propriétaire.
- Règles de sécurité : `FIRESTORE_RULES` et `STORAGE_RULES` dans `www/js/team.js` (extraites par `ci/rules.mjs`).
- Services fermés 🔒 : `SERVICES_OPEN` / `config/services` ; un service s'ouvre quand il est terminé et testé.

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
- Le propriétaire travaille depuis son téléphone : chaque livraison = une Pull Request verte vers `siteteam` ;
  après la fusion, la release `siteteam-v1.0.<n>` est publiée. Donne-lui le lien et ce qui a changé.
- Mise à jour rapide (OTA) : une version qui ne s'affiche pas en 25 s est abandonnée automatiquement
  (`www/index.html`, `otaBoot` dans `modules.js`) — ne retire pas cette sécurité.

## Vérifications avant chaque push
```bash
for f in www/js/*.js; do node --check "$f" || exit 1; done
node ci/rules.mjs            # les règles s'extraient toujours
```
Puis la Pull Request : **Tests SiteTeam** doit être vert. Après la fusion : **Build SiteTeam** doit être vert
(il échoue si la signature n'est pas `E3:EC:F4:31…`).

## Style
- Code et commentaires en français, comme le code existant ; messages de commit en français.
- Réutiliser les helpers de `ui.js` (`sheet`, `menu`, `formSheet`, `toast`, `loading`, `icon`, `esc`, `$`, `$$`).
- Mettre à jour `docs/FEATURES_INVENTORY.md` et `docs/KNOWN_ISSUES.md` quand l'état d'un module change.
