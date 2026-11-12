// SiteTeam — Telegram (phase B, première brique) : envoi via l'API Bot.
// Le token ne vient JAMAIS du code ni du client : il est lu dans la variable d'environnement TELEGRAM_BOT_TOKEN (secrets du serveur).
// Par défaut : mode simulation (aucun appel réseau).
import { chatValide } from './rules.mjs';

export function configBot(env = process.env) {
  const token = env.TELEGRAM_BOT_TOKEN || '';
  const reel = env.TELEGRAM_ENVOI_REEL === 'oui' && token.length > 20;
  return { token, reel };
}

// Construit la requête (sans l'exécuter) : utile pour les tests et la simulation
export function requeteEnvoi(chatId, texte, token) {
  if (!chatValide(chatId)) throw new Error('chat_id invalide');
  if (typeof texte !== 'string' || !texte.trim()) throw new Error('message vide');
  return { url: `https://api.telegram.org/bot${token || 'SIMULATION'}/sendMessage`, corps: { chat_id: String(chatId), text: texte.slice(0, 4000), disable_notification: false } };
}

// Envoi réel seulement si la config le permet ; sinon simulation qui ne touche pas au réseau
export async function envoyer(chatId, texte, { env = process.env, fetchFn = globalThis.fetch } = {}) {
  const { token, reel } = configBot(env);
  const req = requeteEnvoi(chatId, texte, token);
  if (!reel) return { simule: true, ok: true, url: req.url.replace(/bot[^/]+\//, 'bot<masqué>/') };
  const r = await fetchFn(req.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.corps) });
  const j = await r.json().catch(() => ({}));
  return { simule: false, ok: !!j.ok, description: j.ok ? '' : String(j.description || 'erreur Telegram').slice(0, 200) };
}

// Traite une mise à jour Telegram « /start CODE » : lie un chat au code de liaison (le code est à usage unique, géré par le serveur)
export function codeDepuisMiseAJour(update) {
  const m = update && update.message;
  if (!m || !m.chat || typeof m.text !== 'string') return null;
  const x = /^\/start(?:\s+([A-Za-z0-9_-]{6,64}))?$/.exec(m.text.trim());
  if (!x) return null;
  return { chatId: String(m.chat.id), code: x[1] || null };
}
