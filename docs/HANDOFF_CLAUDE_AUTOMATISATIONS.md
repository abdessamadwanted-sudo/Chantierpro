# Passage à Claude — PR #177 (SiteTeam)

## Mission
Examiner, corriger et intégrer **uniquement la première étape utilisable** du Centre « Alertes & automatisations » dans SiteTeam, sans confondre simulation et envoi réel.

**PR :** https://github.com/abdessamadwanted-sudo/Chantierpro/pull/177
**Branche source :** `agent/whatsapp-alertes-personnelles`
**Branche cible :** `siteteam`, jamais `main`.

## État réel du développement
- `www/js/autoalerts.js` : écran d'aperçu sans envoi externe, scénarios simulés et lecture seule des rappels du projet ouvert.
- `www/js/app.js` : entrée du menu Réglages.
- `www/index.html` : chargement du nouveau script avant `app.js`.
- `ci/st.mjs` : scénario de test ajouté.
- `integrations/whatsapp/send.mjs`, `rules.mjs` et tests Node : **briques serveur non déployées**.
- `docs/WHATSAPP_ALERTES_PERSONNELLES.md` + `docs/WHATSAPP_AUTOMATISATIONS_ROADMAP.md` : plan et contraintes.

## Contrôles obligatoires avant la fusion
1. Lire `AGENTS.md` puis vérifier les docs techniques ; mettre à jour la branche de travail depuis la toute dernière `origin/siteteam` sans toucher `main`.
2. Vérifier les conflits et les ajouts concurrents sur alertes, échéances, UI et tests.
3. Corriger les bugs et vérifier la lecture de rappels réels (date avec/sans heure), absence d'écriture, et l'isolation par projet et entreprise.
4. Exécuter : `node --check www/js/autoalerts.js`, les vérifications JS existantes, `node --test integrations/whatsapp/*.test.mjs`, `node ci/rules.mjs`, `ci/rules-test.mjs` si applicable, et le parcours `ci/st.mjs`.
5. Vérifier le rendu Android, navigation retour, thèmes clair/sombre, données fictives et mode hors ligne.
6. Consulter l'état final **Tests SiteTeam** sur la PR : merge uniquement si vert et si le propriétaire confirme.
7. En cas de modification des permissions ou règles : conserver les accès de l'autre app Chantier et ne pas publier les règles en production avant une revue séparée.
8. Ne jamais stocker de clés Meta ou Telegram côté client, committer de secrets, ni activer un envoi réel sur cette PR.

## Périmètre du merge demandé
**Phase A** : interface, affichage lecture seule, simulations et documentation. **NE PAS déclarer que WhatsApp/Telegram/Email automatiques fonctionnent après fusion.**

Pour **Phase B**, créer une PR distincte : authentification serveur, file persistante, scheduler, déduplication atomique, journal, quotas, consentement, validation des numéros, secrets, webhooks, tests et configuration Meta/Telegram. La partie client n'a pas le droit d'envoyer directement des messages.

## Livraison attendue
- Liste des fichiers modifiés, tests réellement exécutés et leurs résultats, limites de la Phase A.
- Validation explicite de compatibilité OTA ou nécessité d'un APK.
- Une PR verte et prête à être fusionnée **après autorisation du propriétaire**. Pas de publication automatique manuelle, pas de fusion dans `main`.
