// ================= Motivation : série de jours, niveaux et XP, badges, objectifs du jour, bilan de la semaine, astuce du jour =================
// Tout est calculé à partir du travail réellement fait (PV livrés, réceptions, réserves levées, rapports, pointage, registres) : rien à saisir en plus.
const GAME_LV = [[0, 'Stagiaire', '🪪'], [100, 'Apprenti', '🧱'], [300, 'Technicien', '🔧'], [700, 'Chef d\'équipe', '👷'], [1500, 'Conducteur', '🏗️'], [3000, 'Ingénieur', '📐'], [6000, 'Directeur', '🎯'], [10000, 'Maître bâtisseur', '🏆']];
const GAME_XP = { pv: 10, rec: 3, lift: 5, rep: 15, reg: 8, pt: 4, note: 2 };
const TIPS = [
  'Béton : le slump se mesure dans les 5 minutes après l\'arrivée de la toupie, jamais après ajout d\'eau.',
  'Enrobage des aciers : vérifiez les cales avant le bétonnage, pas après — un oubli coûte une démolition.',
  'Les éprouvettes se démoulent après 24 h et se conservent dans l\'eau à 20 °C jusqu\'à l\'écrasement.',
  'Ferraillage : les recouvrements se décalent ; jamais tous dans la même section.',
  'Un PV signé et livré au BET le jour même évite 90 % des litiges de fin de chantier.',
  'Vibrer le béton par couches de 30 à 50 cm, aiguille verticale, sans toucher les aciers.',
  'Par temps chaud, arrosez le béton frais au moins 7 jours : la cure fait la résistance.',
  'Décoffrage des dalles : jamais avant que le béton n\'ait atteint la résistance prévue par le BET.',
  'Harnais : point d\'ancrage au-dessus de la tête, longe la plus courte possible.',
  'Une causerie sécurité de 10 minutes le matin réduit nettement les presque-accidents.',
  'Photos de réception : une vue d\'ensemble + un détail des aciers + le repère du niveau.',
  'Avant de couler un voile, vérifiez les réservations (gaines, fourreaux) avec le plan des lots techniques.',
  'Chaînages et poteaux : les cadres se ferment avec des crochets à 135°.',
  'Le béton n\'aime pas attendre : au-delà de 1 h 30 après fabrication, demandez l\'avis du labo.',
  'Une réserve photographiée, localisée sur le plan et datée se lève deux fois plus vite.',
  'Échafaudage : garde-corps, lisse, sous-lisse et plinthe sur chaque plancher de travail.',
  'Stock de ciment : sur palettes, à l\'abri, premier entré premier sorti.',
  'Un planning mis à jour chaque semaine vaut mieux qu\'un planning parfait jamais suivi.',
  'Les cotes d\'implantation se vérifient toujours depuis les axes, pas depuis un poteau déjà coulé.',
  'Mesurer deux fois, couler une fois.',
  'Les attentes des poteaux doivent dépasser d\'au moins la longueur de recouvrement prévue.',
  'Cure des dalles : film plastique, toile humide ou produit de cure dès que la surface le permet.',
  'Les fers en attente se protègent (bouchons) : sécurité et propreté.',
  'Un compte rendu de réunion envoyé le jour même devient la référence de tout le monde.',
  'Pointage du matin = moins de litiges en fin de mois avec les équipes.',
  'Un essai non conforme se signale immédiatement au BET, avec la localisation exacte du béton.',
  'Ordre et propreté : un chantier rangé est un chantier plus sûr et plus rapide.',
  'Les joints de reprise se préparent : surface rugueuse, propre et humidifiée avant le nouveau béton.',
  'Port des EPI : casque, chaussures, gilet — l\'exemple vient du chef.',
  'Un bon de livraison vérifié à l\'arrivée (quantité, classe, heure) évite les mauvaises surprises.',
];
const Game = {
  seen() { try { return JSON.parse(localStorage.getItem('game.seen') || '{}'); } catch (e) { return {}; } },
  save(v) { try { localStorage.setItem('game.seen', JSON.stringify(v)); } catch (e) {} },
  level(xp) { let L = GAME_LV[0], N = null; for (let i = 0; i < GAME_LV.length; i++) if (xp >= GAME_LV[i][0]) { L = GAME_LV[i]; N = GAME_LV[i + 1] || null; } return { n: L[1], e: L[2], min: L[0], next: N, pct: N ? Math.round((xp - L[0]) / (N[0] - L[0]) * 100) : 100 }; },
  async stats() {
    const [ps, recs, tasks, reports] = await Promise.all([DB.all('projects'), DB.all('receptions'), DB.all('tasks'), DB.all('reports').catch(() => [])]);
    const days = new Map(), add = (d, k, n = 1) => { if (!d) return; d = String(d).slice(0, 10); const o = days.get(d) || {}; o[k] = (o[k] || 0) + n; days.set(d, o); };
    let c = { pv: 0, rec: 0, lift: 0, rep: 0, reg: 0, pt: 0, note: 0 };
    for (const d of recs) for (const r of d.rows || []) { if (!r.element) continue; if (r.status === 'ok' || r.status === 'reserve') { c.rec++; add(d.date, 'rec'); } if (r.pvLivre) { c.pv++; add(r.pvLivreAt || d.date, 'pv'); } }
    for (const t of tasks) if (isLifted(t)) { c.lift++; const l = (t.log || []).slice(-1)[0]; add(l ? new Date(l.t).toISOString() : null, 'lift'); }
    for (const r of reports) { c.rep++; add(r.date, 'rep'); }
    for (const p of ps) {
      for (const L of Object.values(p.reg || {})) for (const x of L || []) { c.reg++; add(x.date || (x.at && new Date(x.at).toISOString()), 'reg'); }
      for (const d of Object.keys(((p.pt || {}).d) || {})) if (Object.keys(p.pt.d[d] || {}).length) { c.pt++; add(d, 'pt'); }
    }
    try { c.note = BriefNotes.get().filter(x => x.done).length; } catch (e) {}
    const xp = Object.entries(c).reduce((s, [k, n]) => s + n * (GAME_XP[k] || 0), 0);
    // série : jours d'activité consécutifs jusqu'à aujourd'hui (ou hier, la journée n'est pas finie)
    let streak = 0, d = new Date(todayISO() + 'T12:00:00'); if (!days.has(todayISO())) d.setDate(d.getDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
    let best = 0, run = 0, prev = null; for (const k of [...days.keys()].sort()) { const t = new Date(k + 'T12:00:00'); run = prev && (t - prev) / 864e5 === 1 ? run + 1 : 1; best = Math.max(best, run); prev = t; }
    const late = tasks.filter(t => !isLifted(t) && isLate(t)).length;
    return { c, xp, days, streak, best: Math.max(best, streak), late, nTasks: tasks.length, ps, recs, tasks };
  },
  badges(S) {
    const B = [['pv10', '📋', '10 PV livrés', S.c.pv >= 10], ['pv50', '📦', '50 PV livrés', S.c.pv >= 50], ['pv100', '🏅', '100 PV livrés', S.c.pv >= 100],
      ['rec50', '🔩', '50 réceptions', S.c.rec >= 50], ['rec200', '🏗️', '200 réceptions', S.c.rec >= 200], ['lift25', '✅', '25 réserves levées', S.c.lift >= 25],
      ['rep20', '📝', '20 rapports', S.c.rep >= 20], ['reg10', '🗂️', '10 fiches (réunions, RFI, visas…)', S.c.reg >= 10], ['pt20', '👷', '20 jours pointés', S.c.pt >= 20],
      ['s7', '🔥', '7 jours de suite', S.best >= 7], ['s30', '🌋', '30 jours de suite', S.best >= 30], ['zero', '🛡️', 'Zéro réserve en retard', S.nTasks >= 5 && S.late === 0]];
    return B.map(([k, e, n, ok]) => ({ k, e, n, ok }));
  },
  // objectifs du jour : 3 petites choses utiles, selon ce qui attend
  goals(S) {
    const t = todayISO(), td = S.days.get(t) || {}, G = [];
    const pvWait = S.recs.flatMap(d => (d.rows || []).filter(r => r.element && (r.status === 'ok' || r.status === 'reserve') && !r.pvLivre)).length;
    if (pvWait) G.push({ k: 'pv', e: '📋', t: `Livrer ${Math.min(3, pvWait)} PV au BET`, need: Math.min(3, pvWait), have: td.pv || 0 });
    if (S.ps.some(p => ((p.pt || {}).w || []).some(w => !w.off))) G.push({ k: 'pt', e: '👷', t: 'Faire le pointage du jour', need: 1, have: td.pt ? 1 : 0 });
    if (S.tasks.some(x => !isLifted(x))) G.push({ k: 'lift', e: '✅', t: 'Lever une réserve', need: 1, have: td.lift || 0 });
    G.push({ k: 'rep', e: '📝', t: 'Remplir le rapport du jour', need: 1, have: td.rep ? 1 : 0 });
    G.push({ k: 'rec', e: '🔩', t: 'Réceptionner 3 ouvrages', need: 3, have: td.rec || 0 });
    return G.slice(0, 3).map(g => ({ ...g, done: g.have >= g.need }));
  },
  week(S) {
    const mon = (off) => { const d = new Date(todayISO() + 'T12:00:00'), w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w - off * 7); return d.toISOString().slice(0, 10); };
    const sum = (from, to) => { const o = { pv: 0, rec: 0, lift: 0, rep: 0, xp: 0 }; for (const [d, v] of S.days) if (d >= from && d < to) for (const k of Object.keys(v)) { if (k in o) o[k] += v[k]; o.xp += v[k] * (GAME_XP[k] || 0); } return o; };
    return { cur: sum(mon(0), '9999'), prev: sum(mon(1), mon(0)) };
  },
  tip() { const d = new Date(), n = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); return TIPS[n % TIPS.length]; },
};
// confettis (fête : niveau, badge, objectifs du jour terminés)
function confetti(n = 90) {
  const c = document.createElement('canvas'), W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1); c.width = W * dpr; c.height = H * dpr; c.className = 'confetti'; document.body.appendChild(c);
  const g = c.getContext('2d'); g.scale(dpr, dpr); const cols = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#facc15'];
  const P = Array.from({ length: n }, () => ({ x: W / 2 + (Math.random() - .5) * 80, y: H * .35, vx: (Math.random() - .5) * 11, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - .5) * .4, col: cols[(Math.random() * cols.length) | 0] }));
  let t0 = performance.now(); const step = (t) => { const k = (t - t0) / 1000; g.clearRect(0, 0, W, H);
    for (const p of P) { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalAlpha = Math.max(0, 1 - k / 2.6); g.fillStyle = p.col; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); g.restore(); }
    if (k < 2.6) requestAnimationFrame(step); else c.remove(); };
  requestAnimationFrame(step); try { Fx.bubble(); } catch (e) {}
}
// bandeau du briefing : niveau + XP + série ; renvoie aussi les fêtes à faire
async function gameStrip() {
  const S = await Game.stats(), L = Game.level(S.xp), seen = Game.seen(), B = Game.badges(S), news = [];
  if (seen.lv && seen.lv !== L.n) news.push(`${L.e} Nouveau niveau : ${L.n} !`);
  for (const b of B) if (b.ok && !(seen.b || []).includes(b.k) && seen.lv) news.push(`${b.e} Badge : ${b.n}`);
  Game.save({ ...seen, lv: L.n, b: B.filter(b => b.ok).map(b => b.k) });
  const G = Game.goals(S), allDone = G.length && G.every(g => g.done), goalKey = 'g' + todayISO();
  if (allDone && !seen[goalKey]) { news.push('🎯 Objectifs du jour terminés !'); Game.save({ ...Game.seen(), [goalKey]: 1 }); }
  const done = G.filter(g => g.done).length, R = 17, C = 2 * Math.PI * R;
  const html = `<button class="gm-strip" data-gm>
      <span class="gm-lv"><b>${L.e}</b><span><b>${esc(L.n)}</b><small>${S.xp} XP${L.next ? ` · ${L.next[0] - S.xp} pour ${esc(L.next[1])}` : ''}</small><i><u style="width:${L.pct}%"></u></i></span></span>
      <span class="gm-st ${S.streak ? 'on' : ''}"><b>🔥 ${S.streak}</b><small>jour${S.streak > 1 ? 's' : ''}</small></span></button>
    <div class="gm-goals"><svg viewBox="0 0 40 40" class="gm-ring"><circle cx="20" cy="20" r="${R}" class="bg"/><circle cx="20" cy="20" r="${R}" class="fg" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - done / Math.max(1, G.length))}"/><text x="20" y="24" text-anchor="middle">${done}/${G.length}</text></svg>
      <div class="gm-gl"><b>🎯 Objectifs du jour</b>${G.map(g => `<div class="${g.done ? 'ok' : ''}">${g.done ? '✓' : g.e} ${esc(g.t)}${g.need > 1 ? ` <small>${Math.min(g.have, g.need)}/${g.need}</small>` : ''}</div>`).join('')}</div></div>
    <div class="gm-tip">💡 <b>Le saviez-vous ?</b> ${esc(Game.tip())}</div>`;
  return { html, news, S };
}
// écran « Mon parcours » : niveau, badges, bilan de la semaine, record
async function gameSheet() {
  const S = await Game.stats(), L = Game.level(S.xp), B = Game.badges(S), W = Game.week(S);
  const cmp = (a, b) => b ? `<i class="${a >= b ? 'up' : 'dn'}">${a >= b ? '▲' : '▼'} ${Math.abs(a - b)}</i>` : '';
  sheet(`<div class="gm-sh"><div class="gm-big"><span>${L.e}</span><b>${esc(L.n)}</b><small>${S.xp} XP${L.next ? ` — encore ${L.next[0] - S.xp} XP pour ${L.next[2]} ${esc(L.next[1])}` : ' — niveau maximum !'}</small><i><u style="width:${L.pct}%"></u></i></div>
    <div class="gm-row"><div><b>🔥 ${S.streak}</b><small>série actuelle</small></div><div><b>🏆 ${S.best}</b><small>meilleure série</small></div><div><b>${B.filter(b => b.ok).length}/${B.length}</b><small>badges</small></div></div>
    <h4>📊 Bilan de la semaine</h4>
    <div class="gm-wk"><div><b>${W.cur.pv}</b><small>PV livrés</small>${cmp(W.cur.pv, W.prev.pv)}</div><div><b>${W.cur.rec}</b><small>réceptions</small>${cmp(W.cur.rec, W.prev.rec)}</div><div><b>${W.cur.lift}</b><small>réserves levées</small>${cmp(W.cur.lift, W.prev.lift)}</div><div><b>+${W.cur.xp}</b><small>XP</small>${cmp(W.cur.xp, W.prev.xp)}</div></div>
    <h4>🏅 Badges</h4><div class="gm-bd">${B.map(b => `<div class="${b.ok ? 'ok' : ''}"><span>${b.ok ? b.e : '🔒'}</span><small>${esc(b.n)}</small></div>`).join('')}</div>
    <h4>⭐ Comment gagner des XP</h4><div class="gm-xp">${[['📋 PV livré au BET', GAME_XP.pv], ['📝 Rapport journalier', GAME_XP.rep], ['🗂️ Fiche (réunion, RFI, visa, HSE…)', GAME_XP.reg], ['✅ Réserve levée', GAME_XP.lift], ['👷 Jour pointé', GAME_XP.pt], ['🔩 Ouvrage réceptionné', GAME_XP.rec], ['📝 Note cochée', GAME_XP.note]].map(([l, x]) => `<div><span>${l}</span><b>+${x}</b></div>`).join('')}</div>
    <h4>🎖️ Niveaux</h4><div class="gm-lvs">${GAME_LV.map(([x, n, e]) => `<div class="${S.xp >= x ? 'ok' : ''}"><span>${e}</span><b>${esc(n)}</b><small>${x} XP</small></div>`).join('')}</div></div>`, { title: 'Mon parcours' });
}
