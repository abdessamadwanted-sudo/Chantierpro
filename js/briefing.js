// ================= Briefing du jour : cartes interactives au démarrage (notes, rappels, tâches, PV à livrer, réception, bétonnage…) =================
const BriefNotes = {
  get() { try { return JSON.parse(localStorage.getItem('brief.notes') || '[]'); } catch (e) { return []; } },
  set(v) { try { localStorage.setItem('brief.notes', JSON.stringify(v)); } catch (e) {} },
};
async function briefingData() {
  const today = todayISO(), [ps, recs, tasks] = await Promise.all([DB.all('projects'), DB.all('receptions'), DB.all('tasks')]);
  const P = (id) => ps.find(p => p.id === id) || {};
  const C = [];
  // rappels
  const rap = ps.flatMap(p => (p.rappels || []).filter(x => !x.done && (!x.at || x.at.slice(0, 10) <= today)).map(x => ({ pid: p.id, label: x.text, sub: `${p.name}${x.at ? ' · ' + fmtDate(x.at.slice(0, 10)) : ''}`, late: x.at && x.at.slice(0, 10) < today })));
  if (rap.length) C.push({ k: 'rap', e: '🔔', t: 'Rappels du jour', c: '#f59e0b', n: rap.length, items: rap, alert: rap.some(x => x.late) });
  // PV à livrer au BET (ouvrages réceptionnés dont le PV n'est pas encore livré), du plus ancien au plus récent
  const pv = recs.filter(d => kindOf(d) === 'Ferraillage').flatMap(d => (d.rows || []).filter(r => r.element && (!r.status || r.status === 'ok' || r.status === 'reserve') && !r.pvLivre).map(r => ({ pid: d.projectId, did: d.id, rid: r.id, date: d.date, label: `${r.niv ? r.niv + ' · ' : ''}${r.element}`, sub: `${fmtDate(d.date)} · ${r.pvRecu || r.pvExist ? 'PV reçu, à livrer' : 'PV pas encore reçu'}`, recu: !!(r.pvRecu || r.pvExist) }))).sort((a, b) => a.date.localeCompare(b.date));
  if (pv.length) C.push({ k: 'pv', e: '📋', t: 'PV à livrer au BET', c: '#ef4444', n: pv.length, items: pv, alert: pv.some(x => daysSince(x.date) >= 3) });
  // tâches / réserves
  const tk = tasks.filter(t => !isLifted(t)).map(t => ({ pid: t.projectId, label: `#${t.num || ''} ${t.title || ''}`, sub: `${P(t.projectId).name || ''}${t.due ? ' · échéance ' + fmtDate(t.due) : ''}`, late: isLate(t) })).sort((a, b) => b.late - a.late);
  if (tk.length) C.push({ k: 'tasks', e: '⚠️', t: 'Tâches / réserves', c: '#fb923c', n: tk.length, items: tk, alert: tk.some(x => x.late), sub: tk.filter(x => x.late).length ? `${tk.filter(x => x.late).length} en retard` : '' });
  // réception du jour (le bétonnage n'est pas rappelé ici)
  for (const [k, kind, e, t, c] of [['rec', 'Ferraillage', '🔩', 'Réception du jour', '#3b82f6']]) {
    const ds = recs.filter(d => d.date === today && kindOf(d) === kind && (d.rows || []).some(r => r.element));
    if (!ds.length) continue;
    const rows = ds.flatMap(d => d.rows.filter(r => r.element).map(r => ({ pid: d.projectId, did: d.id, label: `${r.niv ? r.niv + ' · ' : ''}${r.element}`, sub: r.status === 'ok' ? '✓ fait' : r.status === 'reserve' ? 'réserve' : 'en attente', done: r.status === 'ok' })));
    C.push({ k, e, t, c, n: rows.length, items: rows, sub: `${rows.filter(x => x.done).length}/${rows.length} ${kind === 'Bétonnage' ? 'bétonné(s)' : 'réceptionné(s)'}`, days: ds });
  }
  // échéances des lots, labo, stock
  const due = [], lab = [], stk = [];
  for (const p of ps) {
    try { if (typeof lotDueList === 'function') for (const x of await lotDueList(p)) if ((x.di && x.di.d <= 7) || x.po.length) due.push({ pid: p.id, label: `${x.L.e} ${x.L.name} · ${x.f.name}`, sub: `${x.di ? x.di.txt : ''}${x.po.length ? ` · 🛑 ${x.po.length} point(s) d'arrêt` : ''}`, late: x.di && x.di.d < 0 }); } catch (e) {}
    const G = p.gs || {};
    for (const e of G.pre || []) for (const j of [7, 28]) { const d = new Date(e.date + 'T12:00:00'); d.setDate(d.getDate() + j); const iso = d.toISOString().slice(0, 10); if (iso <= today && !gsNum(e[j === 7 ? 'r7' : 'r28'])) lab.push({ pid: p.id, label: `${e.ouv || 'Béton'} · écrasement ${j} j`, sub: `${p.name} · prévu le ${fmtDate(iso)}`, late: iso < today }); }
    for (const a of G.art || []) { const q = (G.mv || []).filter(m => m.art === a.id).reduce((s, m) => s + gsNum(m.q), 0); if (a.seuil && q <= gsNum(a.seuil)) stk.push({ pid: p.id, label: a.nom, sub: `${p.name} · reste ${q} ${a.unite}` }); }
  }
  if (due.length) C.push({ k: 'due', e: '⏳', t: 'Échéances des lots', c: '#a855f7', n: due.length, items: due, alert: due.some(x => x.late) });
  if (lab.length) C.push({ k: 'lab', e: '🧪', t: 'Labo : écrasements', c: '#06b6d4', n: lab.length, items: lab, alert: lab.some(x => x.late) });
  if (stk.length) C.push({ k: 'stock', e: '📦', t: 'Stock bas', c: '#eab308', n: stk.length, items: stk });
  try { const n = typeof careerBadge === 'function' ? careerBadge() : 0; if (n) C.push({ k: 'job', e: '💼', t: 'Candidatures à relancer', c: '#22c55e', n, items: [{ label: `${n} candidature(s) envoyée(s) il y a plus de 7 jours` }] }); } catch (e) {}
  return { cards: C, ps };
}
// ouverture d'un projet puis d'une section
async function briefGo(pid, fn) { const p = await DB.get('projects', pid); if (!p) return; await openProject(p); document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); await fn(p); }
async function briefPick(items) { const ids = [...new Set(items.map(x => x.pid).filter(Boolean))]; if (ids.length <= 1) return ids[0]; const ps = await DB.all('projects'); return menu('Quel chantier ?', ids.map(id => ({ label: `${(ps.find(p => p.id === id) || {}).name || id} · ${items.filter(x => x.pid === id).length}`, icon: 'hard', value: id }))); }
function briefAction(card) {
  return async () => {
    if (card.k === 'job') return openCareer();
    if (card.k === 'pv') return pvBetSheet();
    const pid = await briefPick(card.items); if (!pid) return;
    if (card.k === 'rap') { App.homeOpen = App.homeOpen || {}; App.homeOpen[pid] = true; App.homeRap = App.homeRap || {}; App.homeRap[pid] = true; return renderHome(); }
    if (card.k === 'tasks') return briefGo(pid, () => { App.section = 'tasks'; App.taskFilter = 'open'; App.search = ''; renderSection(); });
    if (card.k === 'rec' || card.k === 'bet') return briefGo(pid, async () => { const d = card.days.find(x => x.projectId === pid); App.section = card.k === 'rec' ? 'reception' : 'beton'; await renderSection(); if (d) openReceptionDay(d); });
    if (card.k === 'due') return briefGo(pid, () => { App.section = 'dashboard'; renderSection(); });
    if (card.k === 'lab' || card.k === 'stock') return briefGo(pid, () => { App.section = 'gestion'; App.gsTab = card.k === 'lab' ? 'labo' : 'stock'; renderSection(); });
  };
}
// liste interactive des PV à livrer : cocher « Livré » directement
async function pvBetSheet() {
  const { cards } = await briefingData(), C = cards.find(c => c.k === 'pv');
  if (!C) return toast('Tous les PV sont livrés au BET ✓');
  const byDate = {}; C.items.forEach(x => (byDate[x.date] = byDate[x.date] || []).push(x));
  const s = sheet(`<div class="pvb">${Object.keys(byDate).sort().map(d => `<div class="pvb-d"><b>${fmtDate(d)}</b><span>${daysSince(d)} j</span></div>${byDate[d].map(x => `<div class="pvb-r ${x.recu ? '' : 'nr'}" data-r="${x.did}|${x.rid}"><span class="grow"><b>${esc(x.label)}</b><small>${x.recu ? 'PV reçu · à livrer au BET' : 'PV pas encore reçu'}</small></span><button class="pvb-ok">Livré ✓</button></div>`).join('')}`).join('')}</div>`, { title: `📋 PV à livrer au BET · ${C.n}` });
  $$('.pvb-ok', s.el).forEach(b => b.onclick = async () => {
    const row = b.closest('[data-r]'), [did, rid] = row.dataset.r.split('|'), d = await DB.get('receptions', did); if (!d) return;
    const r = d.rows.find(x => x.id === rid); if (!r) return; r.pvLivre = true; if (!r.pvRecu && !r.pvExist) r.pvRecu = true; r.pvLivreAt = todayISO(); await DB.put('receptions', d);
    row.classList.add('done'); b.textContent = '✓'; b.disabled = true; try { navigator.vibrate && navigator.vibrate(10); } catch (e) {}
  });
}
// écran du briefing : renvoie une action (carte touchée) ou null (entrer normalement)
function briefingShow() {
  return new Promise(async (resolve) => {
    const { cards } = await briefingData();
    const notes = BriefNotes.get();
    const el = document.createElement('div'); el.className = 'splash brief';
    const name = (() => { try { return localStorage.getItem('userName') || ''; } catch (e) { return ''; } })();
    const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const drawNotes = () => { const N = BriefNotes.get(); return `${N.map((x, i) => `<label class="bn-i ${x.done ? 'done' : ''}"><input type="checkbox" data-n="${i}" ${x.done ? 'checked' : ''}><span>${esc(x.t)}</span><button data-nd="${i}">✕</button></label>`).join('')}<div class="bn-add"><input placeholder="Ajouter une chose à faire aujourd'hui…"><button>＋</button></div>`; };
    el.innerHTML = `<div class="bf-head"><small>${esc(d.charAt(0).toUpperCase() + d.slice(1))}</small><b>Briefing du jour${name ? ', ' + esc(name) : ''}</b><span>${cards.length ? `${cards.reduce((a, c) => a + c.n, 0)} point(s) à voir` : 'Tout est à jour ✓'}</span></div>
      <div class="bf-body">
        <div class="bf-card bf-notes" style="--c:#22c55e;animation-delay:.05s"><div class="bf-ch"><span>📝</span><b>Mes notes · à cocher</b><i>${notes.filter(x => !x.done).length || ''}</i></div><div class="bn">${drawNotes()}</div></div>
        <div class="bf-grid">${cards.map((c, i) => `<button class="bf-card ${c.alert ? 'alert' : ''}" data-c="${i}" style="--c:${c.c};animation-delay:${.1 + i * .06}s"><div class="bf-ch"><span>${c.e}</span><b>${esc(c.t)}</b></div><div class="bf-n">${c.n}</div>${c.sub ? `<small class="bf-s">${esc(c.sub)}</small>` : ''}<div class="bf-l">${c.items.slice(0, 2).map(x => `<div>${x.late ? '🔴 ' : ''}${esc(x.label)}</div>`).join('')}</div><span class="bf-go">Ouvrir ›</span></button>`).join('')}</div>
      </div>
      <div class="bf-foot"><button class="bf-enter">Entrer au chantier ›</button></div>`;
    document.body.appendChild(el);
    const done = (act) => { el.classList.add('out'); setTimeout(() => { el.remove(); resolve(act); }, 350); };
    const bindNotes = () => { const box = $('.bn', el);
      $$('[data-n]', box).forEach(c => c.onchange = () => { const N = BriefNotes.get(); N[+c.dataset.n].done = c.checked; BriefNotes.set(N); c.closest('.bn-i').classList.toggle('done', c.checked); });
      $$('[data-nd]', box).forEach(b => b.onclick = (e) => { e.preventDefault(); const N = BriefNotes.get(); N.splice(+b.dataset.nd, 1); BriefNotes.set(N); box.innerHTML = drawNotes(); bindNotes(); });
      const inp = $('.bn-add input', box), add = () => { const t = inp.value.trim(); if (!t) return; const N = BriefNotes.get(); N.push({ t, done: false, at: todayISO() }); BriefNotes.set(N); box.innerHTML = drawNotes(); bindNotes(); $('.bn-add input', box).focus(); };
      $('.bn-add button', box).onclick = add; inp.onkeydown = (e) => { if (e.key === 'Enter') add(); }; };
    bindNotes();
    // les notes cochées depuis plus d'un jour disparaissent
    BriefNotes.set(BriefNotes.get().filter(x => !(x.done && x.doneAt && x.doneAt < todayISO())).map(x => x.done && !x.doneAt ? { ...x, doneAt: todayISO() } : x));
    $$('[data-c]', el).forEach(b => b.onclick = () => done(briefAction(cards[+b.dataset.c])));
    $('.bf-enter', el).onclick = () => done(null);
  });
}
