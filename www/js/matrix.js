// ================= Feature Matrix (PR C) : table centrale fonction × pack, versionnée, en lecture =================
//   Source unique de lecture : FLAG_DEFS + FLAG_DEFAULT (valeurs par défaut du code) surchargées par config/app.fp (Centre de contrôle, sans mise à jour de l'app).
//   La matrice NE REMPLACE PAS les contrôles de sécurité (règles Firestore/Storage) et ne modifie pas flag() : c'est la vue documentaire/pilotage de ce qui est déjà en vigueur.
//   Niveaux : dev (Super Admin seul) · test (comptes listés) · pub (tous les comptes du pack) · « - » (absent du pack). Aucune limite chiffrée n'est inventée ici.
const Matrix = (() => {
  const VERSION = 'm1', PACKS = ['basic', 'pro', 'business', 'enterprise'], LV = ['-', 'dev', 'test', 'pub'];
  const LABEL = { '-': 'absent', dev: 'développement', test: 'test', pub: 'publié' };
  // lignes pures (testées) : defs = { clé: libellé }, defaults = { clé: { pack: niveau } }, over = surcharge (config/app.fp)
  function rows(defs, defaults, over) {
    return Object.keys(defs || {}).map(k => {
      const d = (over || {})[k] || (defaults || {})[k] || {};
      return { k, label: String(defs[k]).split(' (')[0], packs: Object.fromEntries(PACKS.map(p => [p, LV.includes(d[p]) ? d[p] : '-'])), custom: !!(over || {})[k] };
    });
  }
  const level = (rs, k, pack) => { const r = (rs || []).find(x => x.k === k); return r ? r.packs[pack] || '-' : '-'; };
  // fonctions ouvertes à un pack : tout niveau autre que « - » (visible au moins pour le Super Admin)
  const inPack = (rs, pack) => (rs || []).filter(r => r.packs[pack] && r.packs[pack] !== '-').map(r => r.k);
  const live = () => rows(Team.FLAG_DEFS, Team.FLAG_DEFAULT, (Team.appCfg() || {}).fp);
  const table = (rs) => `<div class="mx-w"><table class="mx"><thead><tr><th>Fonction</th>${PACKS.map(p => `<th>${p}</th>`).join('')}</tr></thead><tbody>${(rs || []).map(r => `<tr><td>${esc(r.label)}${r.custom ? ' <em>*</em>' : ''}</td>${PACKS.map(p => `<td class="mx-${r.packs[p] === '-' ? 'x' : r.packs[p]}" title="${esc(LABEL[r.packs[p]])}">${r.packs[p] === '-' ? '—' : esc(r.packs[p])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="mx-n">Version ${VERSION} · * = réglage modifié dans le Centre de contrôle · la matrice informe, elle ne remplace pas les règles de sécurité.</p>`;
  return { VERSION, PACKS, LV, rows, level, inPack, live, table };
})();
