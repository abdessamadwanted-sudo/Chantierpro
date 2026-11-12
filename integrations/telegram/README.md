# Telegram — phase B (première brique)

## Ce qui est fait
- `rules.mjs` : quels rappels envoyer (heure atteinte, non terminés, sans doublon via une clé stable).
- `bot.mjs` : envoi via l'API Bot. Sans `TELEGRAM_BOT_TOKEN` et `TELEGRAM_ENVOI_REEL=oui`, **simulation** (aucun appel réseau).
- Lecture de `/start CODE` (liaison) — parsing seulement.
- Tests : `node --test integrations/telegram/*.test.mjs`.

## Ce qui n'est PAS fait (à faire avant tout envoi réel)
- Serveur VPS (processus Node, planification, redémarrage) : non déployé.
- Liaison réelle : génération du code à usage unique côté serveur, stockage du `chat_id` (base persistante), authentification des requêtes de l'application.
- Synchronisation des rappels de l'application vers le serveur (avec consentement).
- Déduplication persistante (le `Set` ici est en mémoire).
- Règles de sécurité et journal.

## Secrets
- Le token BotFather n'est jamais dans le code, ni dans Git, ni dans le client. Il va dans les variables d'environnement du VPS uniquement.
- Si le token a été partagé par erreur : le révoquer via `/revoke` dans BotFather.
