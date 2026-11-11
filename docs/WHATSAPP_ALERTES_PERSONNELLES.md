# SiteTeam — Alertes WhatsApp personnelles (plan d'intégration, phase 0)

Statut : **audit et préparation uniquement**. Aucun envoi automatique n'est activé. Cette branche ne doit pas être fusionnée/publiée sans validation du propriétaire.

## Besoin validé
L'utilisateur reçoit **sur son WhatsApp personnel** des alertes SiteTeam automatiques, sans devoir ouvrir l'application : début d'activité, échéance, retard et alerte critique des points du plan. L'expéditeur est un **numéro WhatsApp Business Platform distinct**, rattaché à l'application Meta ; le téléphone personnel est uniquement destinataire.

## Audit ciblé du code (branche `siteteam`, 11 novembre 2026)
- `www/js/app.js` : `shareWhatsApp()` appelle `wa.me/?text=...` → **partage manuel**, pas d'envoi automatique.
- `www/js/app.js` : `pointAlertItems()`, `renderPointAlerts()`, rappels des projets, `dueSchedule()` → signaux existants à réutiliser.
- `www/js/reception.js` : génération de messages de réception et ouverture de WhatsApp manuellement.
- `ci/st.mjs` : tests sur les rappels, alertes de points et notifications locales. Ne pas retirer ces tests.
- `package.json` : `@capacitor/local-notifications` déjà présent.
- `docs/EXISTING_ARCHITECTURE.md` : pas de backend Cloud Functions documenté. Ce document peut dater : vérifier le code et le déploiement réels avant toute migration.
- `docs/SECURITY_NOTES.md` : Firestore partagé avec l'application Chantier. Ne jamais publier des règles incompatibles avec `licences` ou `suivi`.

## Solution officielle à coût limité
**Meta WhatsApp Business Platform — Cloud API en accès direct**. Éviter Twilio/BSP et n8n hébergé payant pour le premier déploiement. Les messages initiés par l'entreprise hors de la fenêtre de conversation exigent normalement des modèles approuvés et un consentement du destinataire. Les tarifs sont variables selon la destination et la catégorie : vérifier directement dans Meta avant la mise en production. Budget et plafond mensuel obligatoires.

### Flux cible
1. Événement métier autorisé créé/modifié dans SiteTeam.
2. Écriture d'un événement réduit et non sensible dans une file serveur **spécifique à l'espace/entreprise** ; validation serveur des droits et de l'appartenance au projet.
3. Scheduler/worker backend dédié : événements à échéance, déclenchement fiable même si Android est éteint.
4. Déduplication avec clé `organisation/projet/type/sourceId/échéance/version` et journal d'état.
5. Contrôle du consentement, du numéro destinataire et du budget.
6. Envoi serveur `POST /{PHONE_NUMBER_ID}/messages` via Cloud API, template validé ; jeton stocké en secret côté serveur exclusivement.
7. Journal : `en_attente`, `envoyé_api`, `livré` (seulement si webhook attesté), `échec`, `annulé`. Ne jamais confondre acceptation API et livraison.
8. Webhook de statut vérifié (signature Meta) ; redaction des données métier et politique de rétention.

## Contraintes critiques
- Ne jamais commiter token, ID secret, numéro personnel, ni fichier de configuration sensible.
- Ne pas mettre le token Cloud API dans JavaScript, Firestore lisible par le client, IndexedDB ou l'APK.
- Aucun envoi déclenché simplement par un timer côté Android ; tout départ autonome doit être programmé côté serveur.
- Principe de moindre privilège : seules les alertes de projets autorisés peuvent être envoyées.
- L'utilisateur doit activer explicitement le canal WhatsApp et accepter les messages.
- Désactivation immédiate, mode test, quotas quotidiens et mensuels, anti-spam et tranche de silence.
- Préserver `main`, `siteteam`, `com.siteteam.app`, bases `chantier` et `chantier_<cid>`.
- Ne pas mélanger les fonctions de SiteTeam et de l'application Chantier.
- URL vers l'élément de plan seulement avec authentification et autorisation, sans document partagé publiquement.
- Pour des alertes de chantier, la catégorie Utility **n'est pas garantie** ; soumettre les modèles à Meta et observer leur classement réel.

## Déploiement progressif

### Étape 0 — audit et conception (ce document)
Aucun comportement de l'application modifié ; aucune facture WhatsApp.

### Étape 1 — configuration / simulation sans Meta
Après validation :
- Ajouter une section de configuration propriétaire **« Alertes WhatsApp personnelles »**, initialement inactive : numéro de réception masqué, consentement, catégories, horaires, quota et bouton de test.
- Concevoir l'adaptateur `WhatsAppTransport` côté serveur, une implémentation `dryRun` sans réseau, et la file d'attente.
- Brancher les alertes déjà présentes, **sans modifier les formats des projets existants sans audit**.
- Protéger la file et les paramètres selon le modèle multi-espace.
- Ajouter tests de non-régression `ci/st.mjs`, contrôles de sécurité `ci/rules-test.mjs` si nouvelles règles.

### Étape 2 — activation Meta en environnement de test
Prérequis à fournir via configuration privée (jamais ici) : Meta Business, application développeur, numéro expéditeur admissible, ID du numéro, token serveur, consentement du numéro personnel, modèle(s) approuvé(s), moyen de paiement si requis.
- Envoyer un **message de test** sur l'appareil personnel (après accord explicite et contrôle des coûts).
- Tester réception, erreurs, quotas, doublons, webhook et changement de numéro.
- Aucun déploiement production sans validation.

### Étape 3 — automatisation réelle
- Déclencheurs : échéance programmée, retard, point critique.
- Scheduler serveur et retries bornés.
- Bouton « suspendre les envois » et historique.
- Monitoring du quota/facturation.

## Critères d'acceptation avant livraison
1. Une même alerte produit au maximum un envoi par version/échéance, même en cas de réessai.
2. Un utilisateur non autorisé ne peut pas créer un message au nom d'une autre organisation.
3. L'appareil Android éteint n'empêche pas l'envoi serveur d'un événement déjà synchronisé.
4. Un événement **non synchronisé hors ligne** ne peut pas être connu du serveur : livraison après synchronisation, pas d'envoi antidaté.
5. Un opt-out interrompt les nouveaux envois.
6. Une absence de secrets ou de budget bloque l'envoi et laisse un diagnostic lisible.
7. Les Tests SiteTeam sont verts ; les règles Firestore/Storage ne cassent pas l'application Chantier.

## Décisions différées
- Fournisseur et mécanisme d'hébergement du worker et du scheduler (comparer le coût avec l'offre Firebase réellement activée).
- Statut des règles en production et version effective du dépôt.
- Numéro expéditeur et numéro récepteur (ne pas publier dans GitHub).
- Templates exacts et catégorie approuvée par Meta.

## Documentation
- Meta WhatsApp Cloud API : https://developers.facebook.com/docs/whatsapp/cloud-api/
- Meta Business Platform pricing : https://developers.facebook.com/docs/whatsapp/pricing/
