// Connecteur serveur uniquement — jamais chargé par l'APK ou www/.
// Meta WhatsApp Cloud API : nécessite un expéditeur Business, un token secret et un template approuvé.
const E164 = /^\+[1-9]\d{7,14}$/;
const ID = /^\d{5,30}$/;
const NAME = /^[a-z0-9_]{1,512}$/;
export function normaliserAlerte({ type, projet, ouvrage, echeance, description } = {}) {
  const clean = x => String(x == null ? '' : x).trim().slice(0, 180);
  const o = { type: clean(type), projet: clean(projet), ouvrage: clean(ouvrage), echeance: clean(echeance), description: clean(description) };
  if (!o.type || !o.projet) throw new Error('Alerte incomplète');
  return o;
}
export function construireTemplate({ destinataire, template, langue = 'fr', variables = [] }) {
  if (!E164.test(destinataire || '')) throw new Error('Numéro E.164 invalide');
  if (!NAME.test(template || '')) throw new Error('Nom du template invalide');
  if (!/^[a-z]{2}(?:_[A-Z]{2})?$/.test(langue)) throw new Error('Code langue invalide');
  if (!Array.isArray(variables) || variables.length > 10 || variables.some(x => typeof x !== 'string' || x.length > 1024)) throw new Error('Paramètres invalides');
  return { messaging_product: 'whatsapp', to: destinataire.slice(1), type: 'template',
    template: { name: template, language: { code: langue },
      ...(variables.length ? { components: [{ type: 'body', parameters: variables.map(text => ({ type: 'text', text })) }] } : {}) } };
}
export async function envoyerWhatsApp({ destinataire, template, langue = 'fr', variables = [], token, phoneNumberId, graphVersion = 'v23.0', fetcher = fetch, simulation = true }) {
  const payload = construireTemplate({ destinataire, template, langue, variables });
  if (simulation) return { simulation: true, accepte: false, payload };
  if (!token || !ID.test(phoneNumberId || '')) throw new Error('Configuration serveur Meta absente');
  if (!/^v\d+\.\d+$/.test(graphVersion)) throw new Error('Version API invalide');
  const response = await fetcher(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Meta WhatsApp: HTTP ${response.status}`);
  const result = await response.json();
  return { simulation: false, accepte: true, messageId: result.messages?.[0]?.id || null,
    // Accepte n'est PAS livré ; vérifier les statuts via webhook signé.
    livre: false };
}
