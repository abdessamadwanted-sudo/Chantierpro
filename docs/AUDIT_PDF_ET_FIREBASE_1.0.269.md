# Audit PDF & Firebase — v1.0.269 (branche `agent/fix-pdf-rendering-firebase-audit`)

## Mission 1 — Moteur PDF

### Moteurs en présence
| Écran | Code | Rendu |
|---|---|---|
| Lecteur de documents PDF (coupes, fichiers) | `ui.js › showPdf` | pdf.js → un `<canvas>` par page, zoom CSS (`.pdf-zoom` largeur = zoom × 100 %) |
| Plan (viewer) | `viewer.js › renderHD` | image de base + 2 calques HD (double tampon) redessinés depuis pdf.js |

### Causes probables des écrans noirs / découpages (sans pouvoir tester sur le téléphone du propriétaire)
1. **Pages non encore dessinées** : canvas transparent sur fond sombre → « noir » (corrigé : fond blanc).
2. **Plafond de résolution uniquement global** (14 Mpx, 8192 px) mais aucun plafond adapté aux téléphones à peu de mémoire : un canvas refusé par la WebView donne une page vide (corrigé : 6 Mpx / 4096 px si `deviceMemory ≤ 2`).
3. **Échec de rendu sans reprise** : le rendu échouait en silence, la page restait grise/noire (corrigé : le dernier rendu valide reste affiché, 2 reprises à résolution réduite).
4. **Pages éloignées jamais libérées** : mémoire qui monte sur les longs documents (corrigé : canvas réduit à 60 px au-delà de 2,5 écrans, redessiné au retour).
5. **Retour au premier plan** : Android peut libérer les bitmaps des canvas → bloc noir (corrigé : redessin des pages visibles / calque HD masqué puis refait à `visibilitychange`).
6. **Zoom limité par le plafond 14 Mpx** (flou/« découpé » sur A0) : tuile haute résolution sur la zone visible (v1.0.267).

### Déjà en place avant cette PR (conservé)
Rendu hors écran puis échange (aucun vide pendant la remise au net), double tampon HD du viewer avec fondu, marge de 25 % autour de l'écran, annulation du rendu précédent.

### Tiled Rendering (A0)
Évalué : la « tuile » du lecteur (zone visible + 25 %, résolution écran) suffit ; pas de grille de tuiles ni de réécriture. Le viewer de plans avait déjà son rendu de zone visible.

### Tests (ci/st.mjs, bloc « moteur PDF » — pdf.js simulé, donc exécuté aussi en CI)
A0 (budget pur 1×/6×/24×), zoom répété + déplacements rapides (aucune page vide, canvas ≤ 14 Mpx / 8192 px), échecs injectés (dernier rendu conservé + reprise), faible mémoire (≤ 6 Mpx), document de 30 pages (pages lointaines libérées, pages visibles nettes), fond blanc.

### Non testé (honnêteté)
Android 10 réel / WebView du Huawei, mode hors ligne réel (le lecteur lit un fichier local : pas de réseau), changement de niveaux sous mémoire saturée. À valider sur téléphone.

## Mission 2 — Firebase

### Constats
1. **« Règles du serveur à publier »** s'affichait pour *toute* erreur `permission-denied`, y compris un accès légitimement refusé (compte bloqué, espace suspendu ou échu, membre expiré `until`, projet non affecté à l'équipe, droits insuffisants). Le message cite maintenant les deux causes et le contexte (projet(s), modules, nombre d'enregistrements).
2. `docs/firebase/firestore.rules` était **périmé** (97 lignes vs 311) ; une publication depuis ce fichier aurait réellement provoqué le refus. Il est désormais régénéré depuis `team.js` (`ci/rules.mjs` copie aussi `storage.rules`).
3. **Données d'équipes non synchronisées** : les enregistrements `items` de l'organigramme (`ogt/ogw/ogh/oga/ogm`) n'avaient pas de module (`KIND_MOD`) → jamais envoyés en mode équipe. Rattachés au module « Équipe » (`equipe`).
4. Les règles (lecture de `ci/firestore.rules`) sont cohérentes avec les modules de l'application (17 clés identiques dans `MODS`, `maxLvl2`, `permsWithin`). Aucun trou d'isolation entre organisations trouvé.

### Tests de refus ajoutés (ci/rules-test.mjs)
Isolation entre organisations (projets, réserves, membres, audit, profils), invité sans compte / hors connexion, matrice partenaires : MOA (lecture seule), BET (plans), Entreprise (réserves), Bureau de contrôle (PV brouillon oui, validation non), partenaire ne modifie ni le projet, ni son périmètre, ni un autre partenaire, administrateur, membre limité à un autre projet, accès expiré (`until`, `accessUntil`).

### Règles : aucune publication
Aucune règle n'a été modifiée ni publiée. Seules `docs/firebase/*` (copies de référence) et les tests changent.
