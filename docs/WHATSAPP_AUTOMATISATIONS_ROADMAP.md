# SiteTeam — Mise à jour « Alertes & Automatisations WhatsApp » (préparation)

> État au 11/11/2026 : **préparation uniquement**, sans déploiement ni envoi réel. L'activation Meta et la livraison OTA nécessitent une validation distincte du propriétaire.

## Objectif produit
Transformer les alertes déjà présentes sur les plans, points d'intérêt, tâches, réceptions et échéances en **événements métier** réutilisables. Ajouter progressivement plusieurs canaux sans dépendre de WhatsApp pour faire fonctionner SiteTeam : notifications locales, inbox interne, WhatsApp Cloud API, futur email et webhook/n8n.

## Trois incréments recommandés

### A — Fonctionnement indépendant de Meta (livraison possible après validation)
- Audit des modèles existants dans `www/js/app.js`, `www/js/reception.js`, modules de points/planning et de notification ; ne pas dupliquer des alertes.
- Ajouter un **Centre d'alertes** avec liste, type, priorité, source (plan/ouvrage/projet), échéance, statut (ouverte/acquittée/terminée), lien interne sécurisé, historique et réglages.
- Les rappels locaux restent fonctionnels sans internet ; les événements hors ligne sont synchronisés plus tard. Ne jamais annoncer qu'un WhatsApp a été envoyé depuis le téléphone sans confirmation serveur.
- Ajouter panneau **Canaux** : `Application` actif par défaut ; `WhatsApp` désactivé/indiqué comme non configuré jusqu'à connexion backend et consentement ; `Email` et `n8n` à venir.
- Prévoir `Activer/Désactiver`, `Pause`, plage silencieuse, niveaux critiques, catégories, fréquence et quota.
- Tester les flux existants et les droits de projet, l'absence de doubles notifications et la restauration offline.

### B — WhatsApp officiel personnel, en test contrôlé
Pré-requis Meta : Business Portfolio du propriétaire, WhatsApp Business Platform, numéro émetteur ou numéro Meta de test, WhatsApp du propriétaire ajouté comme destinataire de test, modèle validé adapté au contenu, consentement explicite.

- Déployer un **backend indépendant** qui vérifie l'identité, l'organisation et le projet, prépare et stocke la notification et conserve les secrets Meta hors APK.
- Stocker en serveur les événements et statuts ; exécuter un scheduler serveur pour les rappels, hors du téléphone.
- Mettre en place file d'attente persistante + idempotence atomique, verrou de traitement, contrôle budget/quota, délais de retry bornés et webhook Meta authentifié.
- Réutiliser `integrations/whatsapp/send.mjs` et `rules.mjs` comme briques **non finales**, audit sécurité avant activation ; pas de POST réel sans paramètres secrets et accord.
- Uniquement après succès des tests, faire un envoi test au numéro personnel explicitement opt-in.

### C — Multi-utilisateurs et n8n (évolution ultérieure)
- Un numéro officiel SiteTeam expéditeur ; plusieurs numéros destinataires vérifiés et volontaires.
- Une règle peut cibler l'auteur, le responsable désigné ou les membres autorisés d'une organisation/projet, jamais « tous les utilisateurs » par défaut.
- Chaque entreprise conserve ses permissions et les scopes de projet, y compris en groupement.
- Déclencheurs : démarrage prévu, échéance, retard, réception, NC critique ; actions : notification interne, WhatsApp, email futur, escalade.
- n8n **n'est pas le détenteur des secrets et décisions de sécurité du client** : un backend SiteTeam émet seulement des webhooks signés, minimisés et autorisés.
- Offres : notifications internes Basic ; quota WhatsApp selon plan (à définir après coût réel). Plafond global pour éviter une facture imprévue.

## Exemples de règles à implémenter
| Déclencheur | Condition | Action | Particularité |
|---|---|---|---|
| Début prévu | J-0 à H-1, non annulé | Rappel responsable | Zone horaire du chantier |
| Échéance de tâche | H-1, ouverte | Rappel | Ne pas répéter si état changé |
| Réception planifiée | J-1 puis H-1 | Rappel qualité | Exclure autres services non autorisés |
| Non-conformité critique | Nouvelle / escaladée | Urgence | Throttle pour éviter spam |
| Retard | Dépasse seuil configuré | Escalade au supérieur | Au maximum 1 envoi par étape |

## Exigences de sécurité, de confidentialité et coût
- Consentement WhatsApp traçable, désinscription simple, numéro masqué dans les écrans, pas de numéro réel dans le dépôt.
- Modèles WhatsApp approuvés et classification déterminée par Meta, pas par le développeur. Les alertes WhatsApp peuvent être facturées.
- Ne transmettre que des informations minimales ; toute photo, PDF, lien vers plan ou non-conformité détaillée reste derrière authentification/autorisation SiteTeam.
- Anti-doublon **persistant côté serveur**, non seulement une clé calculée en JS.
- Observabilité : `créée`, `planifiée`, `refusée`, `transmise_à_meta`, `livrée`, `échouée`, `annulée`. `Livrée` uniquement après statut webhook.
- Pas de modification de `main`, pas de déploiement de nouvelles règles Firebase sans vérification de compatibilité avec `licences` et `suivi` de Chantier.
- Conserver `com.siteteam.app`, IndexedDB, stack vanilla, tests existants. PR `agent/*` vers `siteteam` ; tests verts avant toute fusion.
- OTA web peut porter les changements JS/UI **compatibles avec le conteneur Android actuel** ; changement de plugin natif, permission Android ou configuration native nécessite un **nouvel APK**.

## Avant d'envoyer une mise à jour
- [ ] Audit du dernier code et correction des conflits avec l'évolution récente de SiteTeam.
- [ ] Implémentation réelle du Centre d'alertes, sans doublons ni dégradation.
- [ ] Tests `ci/st.mjs` et `ci/rules-test.mjs` pour les nouveaux droits.
- [ ] Validation des coûts / quotas / modèles Meta.
- [ ] Test sur Android réel (notification ouverte, app fermée, offline puis sync).
- [ ] Consentement du propriétaire pour la fusion et publication.

## Ce que le propriétaire fera quand il sera chez lui
1. Se connecter avec son compte Facebook personnel à Meta Business ; **ne pas changer le nom du profil personnel**.
2. Créer le Business Portfolio SiteTeam et une application développeur WhatsApp ; utiliser d'abord le numéro de test.
3. Vérifier son WhatsApp personnel comme destinataire de test.
4. Fournir seulement les informations non secrètes nécessaires à la configuration (les secrets restent dans les outils de secrets, jamais dans la conversation ou GitHub).
5. Confirmer le premier envoi d'essai, les frais et l'activation graduelle.

Aucun abonnement n8n ni numéro Business réel n'est nécessaire pour préparer l'interface et le mode simulation.
