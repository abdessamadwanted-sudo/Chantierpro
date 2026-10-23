# DEVELOPMENT_ROADMAP — SiteTeam

Travaux **identifiés**, aucun n'est commencé sauf mention. Ordre proposé ; à valider par le propriétaire.

## 0. Sauvegarde (en cours / fait)
- [x] Signature APK fixe (v1.0.9)
- [x] Export source + documentation
- [ ] Copie dans un dépôt GitHub privé + copie hors ligne (SiteTeam_GitHub_Setup.md)
- [ ] Vérifier la propriété du projet Firebase `siteteam` et y ajouter un second propriétaire de confiance

## 1. Stabilité
- [ ] db.js : rouvrir la connexion IndexedDB si elle se ferme (KNOWN_ISSUES #2)
- [ ] Règle `shares` : n'autoriser que l'ajout d'une réponse (KNOWN_ISSUES #3)
- [ ] Ajouter `ci/st.mjs` : scénario partage externe
- [ ] Retirer ou relier `career.js`

## 2. Pré-requis Google Play
- [ ] Migrer Capacitor vers une version ciblant l'API 36 ; retester tous les plugins
- [ ] Clé de publication privée + Play App Signing + `bundleRelease` via secrets GitHub
- [ ] Suppression de compte (app + page web), politique de confidentialité, formulaire « Sécurité des données »
- [ ] Liste fusionnée des permissions vérifiée

## 3. Sécurité
- [ ] Restriction de la clé d'API Firebase + App Check
- [ ] Clé du script Drive non lisible par tous les membres (ou proxy serveur)
- [ ] Expiration des invitations / partages ; validation de schéma dans les règles
- [ ] Sauvegarde planifiée de Firestore (nécessite formule Blaze)

## 4. Produit (discuté, **non programmé**)
- Facturation réelle des formules et application des quotas
- Partage externe v2 : accès réel à des documents choisis, circuits de validation séquentiels/parallèles
- Notifications (push, WhatsApp Business API)
- Catalogue technique BTP (existe sur `main`) à porter dans SiteTeam
- Planning, laboratoire, gestion administrative, messagerie
- Version web publiée ; iOS (Mac + compte Apple Developer requis)
