// ================= Briefing du jour : cartes interactives au démarrage (selon le poste) =================
// Toucher une carte l'ouvre en 3D ; le bouton Retour ramène au briefing, au même endroit.
const BriefNotes = {
  get() { try { return JSON.parse(localStorage.getItem('brief.notes') || '[]'); } catch (e) { return []; } },
  set(v) { try { localStorage.setItem('brief.notes', JSON.stringify(v)); } catch (e) {} },
};
// cartes choisies par l'utilisateur : masquées, et raccourcis vers des sections
const BriefCfg = {
  get() { try { return { hide: [], sc: [], ...(JSON.parse(localStorage.getItem('brief.cfg') || '{}') || {}) }; } catch (e) { return { hide: [], sc: [] }; } },
  set(v) { try { localStorage.setItem('brief.cfg', JSON.stringify(v)); } catch (e) {} },
};
const BRIEF_KINDS = [['rap', '🔔 Rappels du jour'], ['pvr', '📥 PV non reçus'], ['pv', '📋 PV non livrés au BET'], ['rec', '🔩 Réception du jour'], ['tasks', '⚠️ Tâches / réserves'], ['pt', '👷 Pointage du jour'], ['plan', '📅 Planning en retard'], ['due', '⏳ Échéances des lots'], ['lab', '🧪 Labo : écrasements'], ['stock', '📦 Stock bas'],
  ['reg:reu', '🗓️ Actions des réunions'], ['reg:rfi', '❓ RFI sans réponse'], ['reg:visa', '🛂 Visas en attente'], ['reg:perm', '🦺 Permis expirés'], ['reg:ess', '🔬 Essais non conformes'], ['reg:st', '🤝 Sous-traitants'], ['valid', '✍️ À valider'], ['job', '💼 Candidatures à relancer']];
const SC_EMO = { dashboard: '📊', plans: '🗺️', reception: '🔩', avancement: '🏗️', planning: '📅', reunions: '🗓️', tasks: '⚠️', reports: '📝', photos: '📷', pointage: '👷', labo: '🧪', forms: '📋', constat: '🚫', clauses: '📚', rfi: '❓', visa: '🛂', hse: '🦺', calc: '📐', models3d: '🧊', maquette: '🏢', finance: '💰', avenants: '📑', gestion: '📦', tce: '🏢', st: '🤝', org: '👥', team: '👷' };
// ordre des cartes selon le service (les autres suivent)
const BRIEF_ORDER = {
  trav: ['valid', 'pt', 'plan', 'rec', 'reg:reu', 'tasks', 'rap', 'due', 'reg:st', 'stock', 'pvr', 'pv'],
  qual: ['pvr', 'pv', 'rec', 'lab', 'reg:ess', 'reg:visa', 'reg:rfi', 'tasks', 'rap', 'valid'],
  labo: ['lab', 'reg:ess', 'rec', 'pvr', 'pv', 'rap'],
  hse: ['reg:perm', 'tasks', 'reg:reu', 'rap'],
  etu: ['reg:rfi', 'reg:visa', 'plan', 'tasks', 'rap'],
  log: ['stock', 'pt', 'rap', 'valid'],
  fin: ['valid', 'reg:st', 'pt', 'rap'],
  ext: ['reg:rfi', 'reg:visa', 'plan', 'tasks', 'rap', 'valid'],
  archi: ['reg:rfi', 'reg:visa', 'plan', 'tasks', 'rap'], bet: ['reg:rfi', 'reg:visa', 'lab', 'tasks', 'rap'], bc: ['reg:visa', 'reg:ess', 'lab', 'tasks', 'rap'], mo: ['plan', 'valid', 'reg:reu', 'rap'],
};
async function briefingData() {
  const today = todayISO(), [ps, recs, tasks] = await Promise.all([DB.all('projects'), DB.all('receptions'), DB.all('tasks')]);
  const P = (id) => ps.find(p => p.id === id) || {}, see = (f) => !f || (featOn(f) && Org.can(f, 'see'));
  const CFG = BriefCfg.get();
  const C = [];
  // rappels
  const rap = ps.flatMap(p => (p.rappels || []).filter(x => !x.done && (!x.at || x.at.slice(0, 10) <= today)).map(x => ({ pid: p.id, label: x.text, sub: `${p.name}${x.at ? ' · ' + fmtDate(x.at.slice(0, 10)) : ''}`, late: x.at && x.at.slice(0, 10) < today })));
  if (rap.length) C.push({ k: 'rap', e: '🔔', t: 'Rappels du jour', c: '#f59e0b', n: rap.length, items: rap, alert: rap.some(x => x.late) });
  // PV à livrer au BET : ouvrages réceptionnés dont le PV n'est pas encore livré (du plus ancien au plus récent)
  if (see('reception')) {
    // deux marques par ouvrage : PV non reçu (à récupérer) et PV non livré (à remettre au BET)
    const pvAll = recs.filter(d => kindOf(d) === 'Ferraillage').flatMap(d => (d.rows || []).filter(r => r.element && (!r.status || r.status === 'ok' || r.status === 'reserve') && (!r.pvLivre || !(r.pvRecu || r.pvExist))).map(r => ({ pid: d.projectId, did: d.id, rid: r.id, date: d.date, label: `${r.niv ? r.niv + ' · ' : ''}${r.element}`, recu: !!(r.pvRecu || r.pvExist), liv: !!r.pvLivre }))).sort((a, b) => a.date.localeCompare(b.date));
    const pvr = pvAll.filter(x => !x.recu).map(x => ({ ...x, sub: `${fmtDate(x.date)} · PV non reçu` })), pv = pvAll.filter(x => !x.liv).map(x => ({ ...x, sub: `${fmtDate(x.date)} · ${x.recu ? 'reçu, non livré' : 'non reçu, non livré'}` }));
    if (pvr.length) C.push({ k: 'pvr', e: '📥', t: 'PV non reçus', c: '#f59e0b', n: pvr.length, items: pvr, alert: pvr.some(x => daysSince(x.date) >= 3), sub: `le plus ancien : ${daysSince(pvr[0].date)} j` });
    if (pv.length) C.push({ k: 'pv', e: '📋', t: 'PV non livrés au BET', c: '#ef4444', n: pv.length, items: pv, alert: pv.some(x => daysSince(x.date) >= 3), sub: `le plus ancien : ${daysSince(pv[0].date)} j` });
    const ds = recs.filter(d => d.date === today && kindOf(d) === 'Ferraillage' && (d.rows || []).some(r => r.element));
    if (ds.length) { const rows = ds.flatMap(d => d.rows.filter(r => r.element).map(r => ({ pid: d.projectId, did: d.id, label: `${r.niv ? r.niv + ' · ' : ''}${r.element}`, done: r.status === 'ok' })));
      C.push({ k: 'rec', e: '🔩', t: 'Réception du jour', c: '#3b82f6', n: rows.length, items: rows, sub: `${rows.filter(x => x.done).length}/${rows.length} réceptionné(s)`, days: ds }); }
  }
  // tâches / réserves
  if (see('tasks')) { const tk = tasks.filter(t => !isLifted(t)).map(t => ({ pid: t.projectId, label: `#${t.num || ''} ${t.title || ''}`, sub: `${P(t.projectId).name || ''}${t.due ? ' · échéance ' + fmtDate(t.due) : ''}`, late: isLate(t) })).sort((a, b) => b.late - a.late);
    if (tk.length) C.push({ k: 'tasks', e: '⚠️', t: 'Tâches / réserves', c: '#fb923c', n: tk.length, items: tk, alert: tk.some(x => x.late), sub: tk.filter(x => x.late).length ? `${tk.filter(x => x.late).length} en retard` : '' }); }
  // pointage du jour à faire
  if (see('pointage') && Org.can('pointage', 'edit')) { const it = ps.filter(p => ((p.pt || {}).w || []).some(w => !w.off) && !Object.keys(((p.pt || {}).d || {})[today] || {}).length).map(p => ({ pid: p.id, label: p.name, sub: `${p.pt.w.filter(w => !w.off).length} ouvrier(s) à pointer` }));
    if (it.length) C.push({ k: 'pt', e: '👷', t: 'Pointage du jour', c: '#0891b2', n: it.length, items: it }); }
  // planning en retard
  if (see('planning')) { const it = ps.flatMap(p => ((p.plan || {}).tasks || []).filter(t => fN(t.av) < 100 && t.fin && t.fin < today).map(t => ({ pid: p.id, label: t.nom, sub: `${p.name} · ${fN(t.av)} % · retard ${daysSince(t.fin)} j`, late: true })));
    if (it.length) C.push({ k: 'plan', e: '📅', t: 'Planning en retard', c: '#dc2626', n: it.length, items: it, alert: true }); }
  // échéances des lots, labo, stock
  const due = [], lab = [], stk = [];
  for (const p of ps) {
    try { if (typeof lotDueList === 'function') for (const x of await lotDueList(p)) if ((x.di && x.di.d <= 7) || x.po.length) due.push({ pid: p.id, label: `${x.L.e} ${x.L.name} · ${x.f.name}`, sub: `${x.di ? x.di.txt : ''}${x.po.length ? ` · 🛑 ${x.po.length} point(s) d'arrêt` : ''}`, late: x.di && x.di.d < 0 }); } catch (e) {}
    const G = p.gs || {};
    for (const e of G.pre || []) for (const j of [7, 28]) { const d = new Date(e.date + 'T12:00:00'); d.setDate(d.getDate() + j); const iso = d.toISOString().slice(0, 10); if (iso <= today && !gsNum(e[j === 7 ? 'r7' : 'r28'])) lab.push({ pid: p.id, label: `${e.ouv || 'Béton'} · écrasement ${j} j`, sub: `${p.name} · prévu le ${fmtDate(iso)}`, late: iso < today }); }
    for (const a of G.art || []) { const q = (G.mv || []).filter(m => m.art === a.id).reduce((s, m) => s + gsNum(m.q), 0); if (a.seuil && q <= gsNum(a.seuil)) stk.push({ pid: p.id, label: a.nom, sub: `${p.name} · reste ${q} ${a.unite}` }); }
  }
  if (due.length && see('avancement')) C.push({ k: 'due', e: '⏳', t: 'Échéances des lots', c: '#a855f7', n: due.length, items: due, alert: due.some(x => x.late) });
  if (lab.length && (see('labo') || see('gestion'))) C.push({ k: 'lab', e: '🧪', t: 'Labo : écrasements', c: '#06b6d4', n: lab.length, items: lab, alert: lab.some(x => x.late) });
  if (stk.length && see('gestion')) C.push({ k: 'stock', e: '📦', t: 'Stock bas', c: '#eab308', n: stk.length, items: stk });
  try { C.push(...regBriefCards(ps)); } catch (e) { console.warn('reg brief', e); }
  try { const n = typeof careerBadge === 'function' && see('career') ? careerBadge() : 0; if (n) C.push({ k: 'job', e: '💼', t: 'Candidatures à relancer', c: '#22c55e', n, items: [{ label: `${n} candidature(s) envoyée(s) il y a plus de 7 jours` }] }); } catch (e) {}
  const me = Org.me(), O = BRIEF_ORDER[me && me.service] || [];
  const rank = (c) => { const i = O.indexOf(c.k); return i < 0 ? 50 + (c.alert ? 0 : 1) : i; };
  C.sort((a, b) => rank(a) - rank(b));
  const out = C.filter(c => !CFG.hide.includes(c.k));
  // raccourcis ajoutés par l'utilisateur
  for (const k of CFG.sc) { const S = SECTIONS[k]; if (!S || (SECTION_FEATURE[k] && !featOn(SECTION_FEATURE[k]))) continue; out.push({ k: 'sc:' + k, e: SC_EMO[k] || '📁', t: S.label.split(' (')[0], c: '#475569', n: '', sc: true, items: ps.map(p => ({ pid: p.id, label: p.name })) }); }
  return { cards: out, ps };
}
// catégories du briefing (repliables) et ordre choisi par l'utilisateur
const BF_CATS = [['rec', '🔩 Réception & PV', ['pvr', 'pv', 'rec', 'lab', 'reg:ess']], ['suivi', '⚠️ Suivi du chantier', ['tasks', 'rap', 'plan', 'due', 'pt', 'reg:perm']], ['docs', '❓ Documents & validations', ['valid', 'reg:rfi', 'reg:visa', 'reg:reu']], ['gest', '📦 Gestion', ['stock', 'reg:st', 'job']], ['sc', '🔗 Raccourcis', []]];
const bfOpen = (k, d) => { try { const v = localStorage.getItem('bf.open.' + k); return v == null ? d : v === '1'; } catch (e) { return d; } };
const bfOpenSet = (k, v) => { try { localStorage.setItem('bf.open.' + k, v ? '1' : '0'); } catch (e) {} };
const bfOrd = () => { try { return { cat: {}, ord: [], cats: [], ...(JSON.parse(localStorage.getItem('bf.ord') || '{}') || {}) }; } catch (e) { return { cat: {}, ord: [], cats: [] }; } };
const bfOrdSet = (o) => { try { localStorage.setItem('bf.ord', JSON.stringify(o)); } catch (e) {} };
const bfCatOf = (c, O) => O.cat[c.k] || (c.sc ? 'sc' : (BF_CATS.find(x => x[2].includes(c.k)) || ['suivi'])[0]);
function bfGroups(cards) {
  const O = bfOrd(), cats = [...O.cats.filter(k => BF_CATS.some(x => x[0] === k)), ...BF_CATS.map(x => x[0]).filter(k => !O.cats.includes(k))];
  const rank = (c) => { const i = O.ord.indexOf(c.k); return i < 0 ? 999 : i; };
  return cats.map(ck => [ck, BF_CATS.find(x => x[0] === ck)[1], cards.map((c, i) => ({ c, i })).filter(({ c }) => bfCatOf(c, O) === ck).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)]).filter(g => g[2].length);
}
async function bfMove(card, cards) {
  const O = bfOrd(), G = bfGroups(cards), g = G.find(x => x[2].some(({ c }) => c === card)), L = g ? g[2].map(({ c }) => c.k) : [];
  const v = await menu(`${card.e} ${card.t}`, [{ label: '⬆️ Monter', value: 'up' }, { label: '⬇️ Descendre', value: 'down' }, { label: '↪ Mettre dans une autre catégorie…', value: 'cat' }, { label: '🗂 Ordre des catégories…', value: 'cats' }, { label: '🙈 Masquer cette carte', value: 'hide' }, { label: '↺ Ordre par défaut', value: 'reset' }]);
  if (!v) return false;
  if (v === 'reset') { try { localStorage.removeItem('bf.ord'); } catch (e) {} return true; }
  if (v === 'hide') { const C = BriefCfg.get(); if (card.k.startsWith('sc:')) C.sc = C.sc.filter(x => 'sc:' + x !== card.k); else if (!C.hide.includes(card.k)) C.hide.push(card.k); BriefCfg.set(C); return true; }
  // ordre global = ordre actuel de toutes les cartes, puis on déplace
  const all = G.flatMap(x => x[2].map(({ c }) => c.k)); O.ord = [...all, ...O.ord.filter(k => !all.includes(k))];
  if (v === 'up' || v === 'down') { const j = L.indexOf(card.k), t = L[j + (v === 'up' ? -1 : 1)]; if (!t) return false; const a = O.ord.indexOf(card.k), b = O.ord.indexOf(t); [O.ord[a], O.ord[b]] = [O.ord[b], O.ord[a]]; }
  if (v === 'cat') { const to = await menu('Vers quelle catégorie ?', BF_CATS.map(x => ({ label: x[1], value: x[0], checked: g && g[0] === x[0] }))); if (!to) return false; O.cat[card.k] = to; }
  if (v === 'cats') { const cs = [...O.cats.filter(k => BF_CATS.some(x => x[0] === k)), ...BF_CATS.map(x => x[0]).filter(k => !O.cats.includes(k))];
    for (;;) { const k = await menu('Ordre des catégories (touchez pour monter)', cs.map((x, n) => ({ label: `${n + 1}. ${BF_CATS.find(y => y[0] === x)[1]}`, value: x })).concat([{ label: '✓ Terminé', value: '__ok' }])); if (!k || k === '__ok') break; const n = cs.indexOf(k); if (n > 0) { cs.splice(n, 1); cs.splice(n - 1, 0, k); } }
    O.cats = cs; }
  bfOrdSet(O); return true;
}
// ouverture d'un projet puis d'une section
async function briefGo(pid, fn) { const p = await DB.get('projects', pid); if (!p) return; await openProject(p); document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); await fn(p); }
async function briefPick(items) { const ids = [...new Set(items.map(x => x.pid).filter(Boolean))]; if (ids.length <= 1) return ids[0]; const ps = await DB.all('projects'); return menu('Quel chantier ?', ids.map(id => ({ label: `${(ps.find(p => p.id === id) || {}).name || id} · ${items.filter(x => x.pid === id).length}`, icon: 'hard', value: id }))); }
function briefAction(card) {
  return async () => {
    if (card.k === 'job') return openCareer();
    if (card.k === 'pv' || card.k === 'pvr') return pvBetPage(App.fromBrief, { filt: card.k === 'pvr' ? 'rec' : 'liv' });
    if (card.k === 'lvs') { let it = card.items[0]; if (card.items.length > 1) { const v = await menu('Quelle paire ?', card.items.map((x, i) => ({ label: `${x.label} · ${x.sub}`, icon: 'layers', value: String(i) }))); it = v == null ? null : card.items[+v]; } if (!it) return; return briefGo(it.pid, () => lvsOpenPair(it.lowId, it.upId)); }
    const pid = await briefPick(card.items); if (!pid) { if (App.fromBrief) briefReopen(); return; }
    const go = (sec, extra) => briefGo(pid, async () => { App.section = sec; App.search = ''; if (extra) extra(); await renderSection(); });
    if (card.k === 'rap') { App.fromBrief = null; App.homeFocus = pid; App.homeRap = App.homeRap || {}; App.homeRap[pid] = true; return renderHome(); }
    if (card.k === 'tasks') return go('tasks', () => { App.taskFilter = 'open'; });
    if (card.k === 'rec') return briefGo(pid, async () => { const d = card.days.find(x => x.projectId === pid); App.section = 'reception'; await renderSection(); if (d) openReceptionDay(d); });
    if (card.k === 'due') return go('dashboard');
    if (card.k === 'pt') return go('pointage', () => { App.ptDay = todayISO(); });
    if (card.k === 'plan') return go('planning');
    if (card.k === 'lab') return go(featOn('labo') && Org.can('labo', 'see') ? 'labo' : 'gestion', () => { App.gsTab = 'labo'; App.rgTab = App.rgTab || {}; App.rgTab.labo = 'epr'; });
    if (card.k === 'stock') return go('gestion', () => { App.gsTab = 'stock'; });
    if (card.k === 'valid') { const it = card.items.find(x => x.pid === pid); return briefGo(pid, () => regGo(it ? it.rk : 'av')); }
    if (card.k.startsWith('reg:')) return briefGo(pid, () => regGo(card.k.slice(4)));
    if (card.k.startsWith('sc:')) return go(card.k.slice(3));
  };
}
// retour au briefing (bouton Retour depuis l'endroit ouvert)
async function briefReopen(fb) { fb = fb || App.fromBrief || {}; App.fromBrief = null; const act = await briefingShow({ scroll: fb.scroll, pid: fb.pid }); if (act) act(); }
// PV : page du briefing (même style) · une date = un volet qui s'ouvre · deux états : PV à récupérer / PV à livrer au BET
async function pvBetPage(fromBrief, keep) {
  fromBrief = fromBrief || {}; keep = keep || {};
  const { cards } = await briefingData(), seen = new Set();
  let items = cards.filter(c => c.k === 'pv' || c.k === 'pvr').flatMap(c => c.items).filter(x => (!fromBrief.pid || x.pid === fromBrief.pid) && !seen.has(x.rid) && seen.add(x.rid)).map(x => ({ ...x })).sort((a, b) => a.date.localeCompare(b.date));
  if (!items.length) { toast('Tous les PV sont reçus et livrés au BET ✓'); if (fromBrief.scroll != null || fromBrief.pid) briefReopen(fromBrief); return; }
  const PJ = fromBrief.pid ? await DB.get('projects', fromBrief.pid) : null;
  let filt = keep.filt || 'all'; const open = new Set(keep.open || []);
  const el = document.createElement('div'); el.className = 'splash brief pvp';
  document.body.appendChild(el);
  const unBack = pushBack(() => leave(true));
  const leave = (reopen) => { el.classList.add('out'); setTimeout(() => el.remove(), 300); if (reopen) briefReopen(fromBrief); };
  const mark = async (pairs, kind) => { const byD = {}; pairs.forEach(([did, rid]) => (byD[did] = byD[did] || []).push(rid));
    for (const [did, rids] of Object.entries(byD)) { const d = await DB.get('receptions', did); if (!d) continue; for (const r of d.rows) if (rids.includes(r.id)) { if (kind === 'recu') { r.pvRecu = true; r.pvRecuAt = todayISO(); } else if (kind === 'unrecu') { r.pvRecu = false; r.pvExist = false; r.pvRecuAt = null; } else if (kind === 'unliv') { r.pvLivre = false; r.pvLivreAt = null; } else { r.pvLivre = true; r.pvLivreAt = todayISO(); } } await DB.put('receptions', d); } };
  const draw = () => {
    const act = items.filter(x => !(x.recu && x.liv)), L = act.filter(x => filt === 'all' || (filt === 'rec' ? !x.recu : !x.liv)), byDate = {};
    L.forEach(x => (byDate[x.date] = byDate[x.date] || []).push(x));
    const nR = act.filter(x => !x.recu).length, nL = act.filter(x => !x.liv).length;
    el.innerHTML = `<div class="bf-head"><small><button class="pvp-x" data-x>‹ Briefing</button>${PJ ? ' · ' + esc(PJ.name) : ''}</small><b>📋 PV des ouvrages</b><span>${nR} non reçu(s) · ${nL} non livré(s)</span></div>
      <div class="pvp-f"><button data-f="all" class="${filt === 'all' ? 'on' : ''}">Tous <i>${act.length}</i></button><button data-f="rec" class="${filt === 'rec' ? 'on' : ''}" style="--c:#f59e0b">Non reçus <i>${nR}</i></button><button data-f="liv" class="${filt === 'liv' ? 'on' : ''}" style="--c:#ef4444">Non livrés <i>${nL}</i></button></div>
      <div class="bf-body pvp-b">${Object.keys(byDate).sort().map(d => { const xs = byDate[d], o = open.has(d), r = xs.filter(x => !x.recu).length, l = xs.filter(x => !x.liv).length;
        return `<div class="pvp-d ${o ? 'open' : ''} ${daysSince(d) >= 3 ? 'old' : ''}"><button class="pvp-dh" data-d="${d}"><b>${fmtDate(d)}</b><span class="pvp-dn">${r ? `<i class="a">${r} non reçu</i>` : ''}${l ? `<i class="b">${l} non livré</i>` : ''}</span><small>${daysSince(d)} j</small><u>${icon('chevdown')}</u></button>
          ${o ? `<table class="pvp-t"><tbody>${xs.map(x => `<tr data-r="${x.did}|${x.rid}" class="${x.recu ? 'liv' : 'rec'}"><td class="pvp-o"><b>${esc(x.label)}</b><small>${x.recu ? 'reçu · à livrer au BET' : x.liv ? 'livré · PV pas encore reçu' : 'à récupérer et à livrer'}</small></td>
            <td class="pvp-a"><button class="pvp-btn ${x.recu ? 'on' : 'r'}" data-k="${x.recu ? 'unrecu' : 'recu'}">${x.recu ? 'Reçu ✓' : 'Non reçu'}</button><button class="pvp-btn ${x.liv ? 'on' : 'l'}" data-k="${x.liv ? 'unliv' : 'liv'}">${x.liv ? 'Livré ✓' : 'Non livré'}</button></td></tr>`).join('')}</tbody></table>` : ''}</div>`; }).join('') || '<div class="pvp-none">Rien ici ✓</div>'}
        <button class="bf-cust" data-all>✓ Marquer livrés au BET jusqu'au…</button></div>
      <div class="bf-foot"><button class="bf-enter" data-x>‹ Retour au briefing</button></div>`;
    $$('[data-x]', el).forEach(b => b.onclick = () => { unBack(); leave(true); });
    $$('[data-f]', el).forEach(b => b.onclick = () => { filt = b.dataset.f; draw(); });
    $$('[data-d]', el).forEach(b => b.onclick = () => { const d = b.dataset.d; open.has(d) ? open.delete(d) : open.add(d); const sc = $('.pvp-b', el).scrollTop; draw(); $('.pvp-b', el).scrollTop = sc; });
    $$('.pvp-btn', el).forEach(b => b.onclick = async (e) => { e.stopPropagation(); const tr = b.closest('[data-r]'), [did, rid] = tr.dataset.r.split('|'), x = items.find(y => y.did === did && y.rid === rid);
      const k = b.dataset.k; await mark([[did, rid]], k); try { navigator.vibrate && navigator.vibrate(10); } catch (er) {}
      if (k === 'recu') x.recu = true; else if (k === 'liv') x.liv = true; else if (k === 'unrecu') x.recu = false; else x.liv = false;
      if (x.recu && x.liv) { tr.classList.add('done'); b.disabled = true; setTimeout(() => { const sc = $('.pvp-b', el).scrollTop; draw(); $('.pvp-b', el).scrollTop = sc; }, 450); }
      else { const sc = $('.pvp-b', el).scrollTop; draw(); $('.pvp-b', el).scrollTop = sc; } });
    // toucher un ouvrage : ouvrir sa réception (le retour revient au briefing)
    // toucher un ouvrage : sa réception s'ouvre, la ligne exacte surlignée ; le retour revient ici (même volets ouverts)
    $$('tr[data-r]', el).forEach(tr => tr.onclick = async () => { const [did, rid] = tr.dataset.r.split('|'), x = items.find(y => y.did === did && y.rid === rid), sc = $('.pvp-b', el).scrollTop;
      unBack(); el.remove();
      if (!App.project || App.project.id !== x.pid) { const pj = await DB.get('projects', x.pid); if (pj) { App.project = pj; App.section = 'reception'; App.search = ''; await renderSection(); } }   // sans les rappels d'ouverture du projet
      const d = await DB.get('receptions', did); if (d) await openReceptionDay(d, { focus: rid });
      const again = await pvBetPage(fromBrief, { filt, open: [...open], scroll: sc }); });
    $('[data-all]', el).onclick = async () => {
      const ds = [...new Set(items.filter(x => !x.liv).map(x => x.date))].sort(); const r = await formSheet('Marquer livrés au BET', [{ name: 'd', label: 'Tous les PV jusqu\'au (inclus)', type: 'date', value: ds[0] }], { okLabel: 'Marquer livrés' });
      if (!r || !r.d) return; const L2 = items.filter(x => !x.liv && x.date <= r.d); if (!L2.length) return toast('Aucun PV avant cette date');
      if (!await confirmBox(`Marquer ${L2.length} PV comme livrés au BET (jusqu'au ${fmtDate(r.d)}) ?`, 'Marquer livrés')) return;
      await mark(L2.map(x => [x.did, x.rid]), 'liv'); L2.forEach(x => { x.liv = true; }); toast(`${L2.length} PV marqué(s) livré(s) ✓`); draw(); };
  };
  // la date la plus ancienne est ouverte
  const first = items.map(x => x.date).sort()[0]; if (first && !keep.open) open.add(first);
  draw(); if (keep.scroll) $('.pvp-b', el).scrollTop = keep.scroll;
}
// ancien nom (ailleurs dans l'application)
const pvBetSheet = (fb) => pvBetPage(fb || {});
// écran du briefing : renvoie une action (carte touchée) ou null (entrer normalement)
function briefingShow(opts = {}) {
  return new Promise(async (resolve) => {
    let { cards } = await briefingData();
    const PJ = opts.pid ? await DB.get('projects', opts.pid) : null;
    if (PJ) cards = cards.filter(c => c.k !== 'job').map(c => { if (c.sc) return { ...c, items: [{ pid: PJ.id, label: PJ.name }] }; const items = (c.items || []).filter(x => x.pid === PJ.id); if (!items.length) return null;
      const r = { ...c, items, n: items.length }; if (c.k === 'pv' || c.k === 'pvr') r.sub = `le plus ancien : ${daysSince(items[0].date)} j`; if (c.k === 'rec') r.sub = `${items.filter(x => x.done).length}/${items.length} réceptionné(s)`; r.alert = items.some(x => x.late); return r; }).filter(Boolean);
    const GS = await gameStrip().catch((e) => { console.warn('game', e); return null; });
    const notes = BriefNotes.get();
    const el = document.createElement('div'); el.className = 'splash brief';
    const name = (() => { try { return localStorage.getItem('userName') || ''; } catch (e) { return ''; } })();
    const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const drawNotes = () => { const N = BriefNotes.get(); return `${N.map((x, i) => `<label class="bn-i ${x.done ? 'done' : ''}"><input type="checkbox" data-n="${i}" ${x.done ? 'checked' : ''}><span>${esc(x.t)}</span><button data-nd="${i}">✕</button></label>`).join('')}<div class="bn-add"><input placeholder="Ajouter une chose à faire aujourd'hui…"><button>＋</button></div>`; };
    const anim = !opts.scroll;
    el.innerHTML = `<div class="bf-head"><small>${esc(d.charAt(0).toUpperCase() + d.slice(1))}${Org.label() ? ' · ' + esc(Org.label()) : ''}</small><b>${PJ ? `Briefing · ${esc(PJ.name)}` : `Briefing du jour${name ? ', ' + esc(name) : ''}`}</b><span>${(() => { const n = cards.filter(c => !c.sc).reduce((a, c) => a + (+c.n || 0), 0); return n ? `${n} point(s) à voir` : 'Tout est à jour ✓'; })()}</span></div>
      <div class="bf-body">
        <div class="bf-sec bf-top ${bfOpen('top', false) ? 'open' : ''}" data-sec="top"><button class="bf-sh" data-st="top"><span class="grow">${GS ? esc(GS.sum) : '🎮 Progression'} · 📝 ${notes.filter(x => !x.done).length} note(s)</span>${icon('chevdown')}</button>
          <div class="bf-sb">${GS ? `<div class="gm">${GS.html}</div>` : ''}
          <div class="bf-notes"><div class="bf-ch"><span>📝</span><b>Mes notes · à cocher</b><i>${notes.filter(x => !x.done).length || ''}</i></div><div class="bn">${drawNotes()}</div></div></div></div>
        ${bfGroups(cards).map(([ck, cl, L]) => { const n = L.filter(({ c }) => !c.sc).reduce((a, { c }) => a + (+c.n || 0), 0), al = L.some(({ c }) => c.alert), o = bfOpen(ck, true);
          return `<div class="bf-sec ${o ? 'open' : ''}" data-sec="${ck}"><button class="bf-sh" data-st="${ck}"><span class="grow">${cl}</span>${n ? `<i class="${al ? 'al' : ''}">${n}</i>` : ''}${icon('chevdown')}</button>
          <div class="bf-sb"><div class="bf-grid">${L.map(({ c, i }) => `<button class="bf-card ${anim ? '' : 'noanim'} ${c.alert ? 'bf-alert' : ''}" data-c="${i}" style="--c:${c.c};animation-delay:${.1 + i * .06}s"><div class="bf-ch"><span>${c.e}</span><b>${esc(c.t)}</b></div>${c.sc ? `<div class="bf-n bf-sc">${c.e}</div>` : `<div class="bf-n" data-n="${c.n}">${anim ? 0 : c.n}</div>`}${c.sub ? `<small class="bf-s">${esc(c.sub)}</small>` : ''}<div class="bf-l">${c.sc ? '<div>Raccourci</div>' : c.items.slice(0, 2).map(x => `<div>${x.late ? '🔴 ' : ''}${esc(x.label)}</div>`).join('')}</div><span class="bf-go">Ouvrir ›</span></button>`).join('')}</div></div></div>`; }).join('')}
        <button class="bf-cust">＋ Ajouter / masquer des cartes</button>
      </div>
      <div class="bf-foot"><button class="bf-enter">${PJ ? 'Entrer ›' : 'Entrer au chantier ›'}</button></div>`;
    document.body.appendChild(el);
    const body = $('.bf-body', el); if (opts.scroll) body.scrollTop = opts.scroll;
    const gm = $('[data-gm]', el); if (gm) gm.onclick = () => gameSheet();
    if (GS && GS.news.length) setTimeout(() => { confetti(); GS.news.forEach((m, i) => setTimeout(() => toast(m), i * 1800)); }, 700);
    // les chiffres comptent jusqu'à leur valeur
    if (anim) { const t0 = performance.now(), ns = $$('.bf-n[data-n]', el); const step = (t) => { const k = Math.min(1, (t - t0 - 250) / 700), e = k < 0 ? 0 : 1 - Math.pow(1 - k, 3); ns.forEach(n => n.textContent = Math.round(+n.dataset.n * e)); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
    // effet de profondeur : la grille s'incline avec le téléphone
    // relief : chaque carte s'incline À L'INVERSE du téléphone (elle « regarde » l'utilisateur) ; au repos elle redevient nette
    const grid = $('.bf-body', el); let base = null, tiltT = 0;
    setTimeout(() => $$('.bf-card', grid).forEach(c => c.classList.add('noanim')), 1300);   // fin de l'entrée animée : on peut piloter la carte
    const tilt = (e) => { if (e.gamma == null || !Fx.on('tilt')) return; if (!base) base = { b: e.beta || 0, g: e.gamma || 0 };
      const db = (e.beta || 0) - base.b, dg = (e.gamma || 0) - base.g; base.b += db * .02; base.g += dg * .02;   // la position de repos suit doucement
      const rx = Math.max(-10, Math.min(10, db / 2.2)), ry = Math.max(-10, Math.min(10, dg / 2.2)), q = (v) => Math.round(v * 2) / 2;
      grid.style.setProperty('--mx', (50 - ry * 4) + '%'); grid.style.setProperty('--my', (40 - rx * 4) + '%');
      $$('.bf-card.noanim', grid).forEach((c, i) => { const k = 1 + (i % 3) * .25, X = q(rx * k), Y = q(-ry * k);
        c.style.transform = Math.abs(X) < 1 && Math.abs(Y) < 1 ? '' : `perspective(800px) rotateX(${X}deg) rotateY(${Y}deg)`; c.style.setProperty('--px', (-ry * k * .5).toFixed(1) + 'px'); c.style.setProperty('--py', (-rx * k * .5).toFixed(1) + 'px'); });
      clearTimeout(tiltT); tiltT = setTimeout(() => $$('.bf-card.noanim', grid).forEach(c => { c.style.transform = ''; }), 2500); };
    window.addEventListener('deviceorientation', tilt);
    const done = (act) => { window.removeEventListener('deviceorientation', tilt); el.classList.add('out'); setTimeout(() => { el.remove(); resolve(act); }, 350); };
    const bindNotes = () => { const box = $('.bn', el);
      $$('[data-n]', box).forEach(c => c.onchange = () => { const N = BriefNotes.get(); N[+c.dataset.n].done = c.checked; BriefNotes.set(N); c.closest('.bn-i').classList.toggle('done', c.checked); });
      $$('[data-nd]', box).forEach(b => b.onclick = (e) => { e.preventDefault(); const N = BriefNotes.get(); N.splice(+b.dataset.nd, 1); BriefNotes.set(N); box.innerHTML = drawNotes(); bindNotes(); });
      const inp = $('.bn-add input', box), add = () => { const t = inp.value.trim(); if (!t) return; const N = BriefNotes.get(); N.push({ t, done: false, at: todayISO() }); BriefNotes.set(N); box.innerHTML = drawNotes(); bindNotes(); $('.bn-add input', box).focus(); };
      $('.bn-add button', box).onclick = add; inp.onkeydown = (e) => { if (e.key === 'Enter') add(); }; };
    bindNotes();
    // les notes cochées depuis plus d'un jour disparaissent
    BriefNotes.set(BriefNotes.get().filter(x => !(x.done && x.doneAt && x.doneAt < todayISO())).map(x => x.done && !x.doneAt ? { ...x, doneAt: todayISO() } : x));
    // ouverture douce : la carte s'enfonce légèrement puis s'ouvre
    $$('[data-st]', el).forEach(h => h.onclick = () => { const S = h.parentElement, o = !S.classList.contains('open'); S.classList.toggle('open', o); bfOpenSet(h.dataset.st, o); });
    // appui long sur une carte : la déplacer (monter, descendre, autre catégorie) ou la masquer
    $$('[data-c]', el).forEach(b => b.oncontextmenu = async (e) => { e.preventDefault(); b._lp = Date.now(); const ok = await bfMove(cards[+b.dataset.c], cards); if (ok) done(async () => { const a = await briefingShow({ scroll: body.scrollTop, pid: opts.pid }); if (a) a(); }); });
    $$('[data-c]', el).forEach(b => b.onclick = () => {
      if (b._lp && Date.now() - b._lp < 900) return;
      if (el._going) return; el._going = true;
      const card = cards[+b.dataset.c], fb = { scroll: body.scrollTop, pid: opts.pid }, act = briefAction(card);
      try { navigator.vibrate && navigator.vibrate(10); } catch (e) {}
      try { b.animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(.96)', filter: 'brightness(1.25)' }, { transform: 'scale(1.02)', filter: 'brightness(1.1)' }], { duration: 240, easing: 'ease-out', fill: 'forwards' }); } catch (e) {}
      setTimeout(() => done(async () => { App.fromBrief = fb; await act(); }), 230);
    });
    $('.bf-cust', el).onclick = async () => { const ok = await briefCustomize(cards); if (ok) { done(async () => { const a = await briefingShow({ scroll: body.scrollTop, pid: opts.pid }); if (a) a(); }); } };
    $('.bf-enter', el).onclick = () => done(null);
  });
}

// choisir les cartes du briefing : cartes du jour (afficher / masquer) + raccourcis vers les sections
function briefCustomize() {
  return new Promise((resolve) => {
    const C = BriefCfg.get(); let ok = false;
    const secs = Object.entries(SECTIONS).filter(([k, S]) => !S.hidden && k !== 'settings' && (!SECTION_FEATURE[k] || featOn(SECTION_FEATURE[k])));
    const row = (on, k, l, grp) => `<button class="ft-r ${on ? 'on' : ''}" data-${grp}="${k}"><span class="grow">${esc(l)}</span><i class="ft-sw"><u></u></i></button>`;
    const s = sheet(`<div class="ft-w"><div class="ft"><p class="ft-sub">Cartes du jour (elles apparaissent quand il y a quelque chose à voir)</p>
      ${BRIEF_KINDS.map(([k, l]) => row(!C.hide.includes(k), k, l, 'h')).join('')}
      <p class="ft-sub" style="margin-top:10px">Raccourcis (toujours affichés, un toucher ouvre la section)</p>
      ${secs.map(([k, S]) => row(C.sc.includes(k), k, `${SC_EMO[k] || '📁'} ${S.label}`, 'sc')).join('')}
      <button class="btn ft-ok" data-ok>Enregistrer</button></div></div>`, { title: 'Cartes du briefing' });
    $$('[data-h]', s.el).forEach(b => b.onclick = () => { const k = b.dataset.h, i = C.hide.indexOf(k); i >= 0 ? C.hide.splice(i, 1) : C.hide.push(k); b.classList.toggle('on', i >= 0); });
    $$('[data-sc]', s.el).forEach(b => b.onclick = () => { const k = b.dataset.sc, i = C.sc.indexOf(k); i >= 0 ? C.sc.splice(i, 1) : C.sc.push(k); b.classList.toggle('on', i < 0); });
    $('[data-ok]', s.el).onclick = () => { BriefCfg.set(C); ok = true; s.close(); };
    s.onClose = () => resolve(ok);
  });
}
