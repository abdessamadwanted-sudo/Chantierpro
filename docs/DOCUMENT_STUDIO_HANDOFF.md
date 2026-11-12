# Document Studio — socle technique (PR de préparation)

## Ce que contient cette PR
- Noyau autonome `www/js/document-studio.js` compatible JS vanilla : modèles de PV, bons, fiches et suivis.
- Schéma versionné et champs texte, nombre, date, liste, case, signature-référence, photo-référence.
- Positions PDF normalisées par page pour garder le placement malgré le zoom.
- Validation des valeurs et périmètre entreprise/projet (défense côté client, **pas une autorisation serveur**).
- Transitions contrôlées brouillon → soumis → validé/rejeté → archivé ; historique non probant juridiquement.
- Test autonome : `node ci/document-studio-test.mjs`.

## État réel
**Socle de code uniquement, non intégré à la navigation ou au stockage.**
L'application contient déjà `fiches.js` (éditeur de cases PDF), `pvgen.js`, `bon.js`, `bons.js`, des composants de signature et les bibliothèques PDF/OCR.
Il faut les réutiliser, pas recréer un second éditeur sans raison.

## Intégration confiée à Claude (après revue)
1. Charger `document-studio.js` avant les modules métier dans `www/index.html` après avoir vérifié les dépendances et collisions de noms.
2. Relier l'éditeur `ftEditor` aux champs/pages du modèle ; gérer tous les feuillets PDF, positions au zoom, dates et listes. Préserver le PDF vectoriel avec pdf-lib. Pour OCR, proposer des champs **avec correction manuelle**, sans déclarer de fiabilité automatique.
3. Construire Form Builder + modèles de suivis réutilisables dans les services, projet/organisation. Utiliser IndexedDB existant avec migration additive uniquement ; ne jamais changer `chantier`.
4. Relier Workflow, permissions et approbations aux niveaux Team ; **ajouter les règles Firestore/Storage et tests émulateurs** avant toute synchronisation partagée. Éviter des documents multi-entreprises et ne pas réutiliser aveuglément un droit « voir » pour signer.
5. Signature dessinée à l'écran : recueillir l'accord explicite de chaque signataire ; horodatage serveur, identité, vérification et audit. **Ne pas présenter une image manuscrite comme une signature numérique certifiée.**
6. Garder les modèles et versions historiques pour que le changement de PV ne réécrive pas une réception passée. Couvrir import, gros PDF, multi-page, offline, reprise sync et exports.
7. Ajouter section E2E `// ---- v1.0.x : Document Studio` dans `ci/st.mjs` se terminant par `log('errors v1.0.x', [...])`, ajouter les tests de règles, mettre à jour l'inventaire et les problèmes connus.
8. Ne pas ouvrir les services fermés avant la CI verte et la validation propriétaire.

## Vérifications / limites
Test pur Node indépendant de Firebase et du navigateur. Pas encore de tests Playwright / émulateur sur cette intégration.
Aucun changement `main`, `siteteam` direct, identifiant Android, clés, IndexedDB ou règle serveur dans cette PR.
