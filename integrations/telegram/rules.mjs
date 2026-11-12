// SiteTeam — Telegram (phase B, première brique) : logique pure, sans réseau ni secret.
// Décide quels rappels doivent être envoyés, sans jamais envoyer deux fois le même.

const DATE_RE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/;

// Clé stable d'un rappel envoyé : évite les doublons même si le rappel est resynchronisé
export function cleEnvoi(projetId, rappel) {
  return `${String(projetId)}|${String(rappel.id)}|${String(rappel.at)}`;
}

// Instant (ms) d'un rappel : date seule = fin de journée ; date+heure = heure exacte
export function instantRappel(at) {
  if (typeof at !== 'string' || !DATE_RE.test(at)) return NaN;
  return new Date(at.length === 10 ? at + 'T23:59:59' : at).getTime();
}

// Rappels à envoyer maintenant : non terminés, datés, dont l'heure est atteinte, et pas encore envoyés
export function rappelsAEnvoyer({ projetId, rappels, maintenant, dejaEnvoyes = new Set(), fenetreMs = 60 * 60 * 1000 }) {
  const base = new Date(maintenant).getTime();
  if (!Number.isFinite(base) || !Array.isArray(rappels)) return [];
  return rappels
    .filter(r => r && !r.done && r.id)
    .map(r => ({ r, t: instantRappel(r.at), cle: cleEnvoi(projetId, r) }))
    .filter(x => Number.isFinite(x.t) && x.t <= base && base - x.t <= fenetreMs && !dejaEnvoyes.has(x.cle))
    .sort((a, b) => a.t - b.t)
    .map(x => ({ cle: x.cle, texte: `🔔 ${String(x.r.text || 'Rappel').slice(0, 300)}\n${x.r.at}` }));
}

// Chat Telegram valide (identifiant numérique, éventuellement négatif pour un groupe)
export function chatValide(id) {
  return /^-?\d{1,20}$/.test(String(id));
}
