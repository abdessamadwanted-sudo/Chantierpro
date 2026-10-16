// ================= Lots dans les dossiers de niveau (Plans) =================
// Barre de lots colorés au-dessus des plans d'un niveau ; chaque lot a ses plans, ses raccourcis et sa check-list,
// la même pour tous les niveaux (on ajoute un point une fois → il apparaît partout).
const LOTS_DEF = [
  { id: 'go', name: 'Gros œuvre', e: '🏗️', c: '#f59e0b' }, { id: 'mac', name: 'Maçonnerie', e: '🧱', c: '#ef4444' },
  { id: 'chape', name: 'Chape', e: '🪣', c: '#a855f7' }, { id: 'enduit', name: 'Enduit', e: '🎨', c: '#06b6d4' },
  { id: 'etan', name: 'Étanchéité', e: '💧', c: '#3b82f6' }, { id: 'elec', name: 'Électricité', e: '⚡', c: '#eab308' },
  { id: 'plomb', name: 'Plomberie', e: '🚿', c: '#14b8a6' }, { id: 'menu', name: 'Menuiserie', e: '🚪', c: '#b45309' },
  { id: 'peint', name: 'Peinture', e: '🖌️', c: '#ec4899' }, { id: 'carr', name: 'Carrelage', e: '🔲', c: '#64748b' },
];
const LOT_GO_POINTS = ['Plans de coffrage au dernier indice', 'Plans de ferraillage au dernier indice', 'Réception ferraillage faite', 'PV de réception signé', 'Bon de bétonnage validé', 'Décoffrage / étaiement contrôlé'];
function planLots(p) {
  if (!p.planLots) p.planLots = LOTS_DEF.map(l => ({ ...l, points: l.id === 'go' ? LOT_GO_POINTS.map(t => ({ id: DB.uid(), t })) : [] }));
  return p.planLots;
}
const lotSelOf = (fid) => (App.lotSel || {})[fid] || '';
const nivOfFolder = (name) => { const m = String(name || '').match(/\b(R\s?\+\s?\d+|RDC|SSL|SS\s?\d?|Mezz\w*|Terrasse|Fondations?)\b/i); return m ? m[1].replace(/\s+/g, '').replace(/^mezz\w*/i, 'Mezz') : ''; };
const tint = (c, a) => c + Math.round(a * 255).toString(16).padStart(2, '0');

// barre de lots + panneau du lot choisi, insérés dans la carte du dossier
function lotBarInto(card, f, ps, root) {
  const p = App.project, lots = planLots(p), sel = lotSelOf(f.id);
  const cnt = (id) => ps.filter(x => x.lotId === id).length;
  const bar = document.createElement('div'); bar.className = 'lot-bar';
  bar.innerHTML = `<button class="lot-c ${!sel ? 'on' : ''}" data-l="" style="--c:#64748b">📁 Tous <small>${ps.length}</small></button>`
    + lots.map(l => `<button class="lot-c ${sel === l.id ? 'on' : ''}" data-l="${l.id}" style="--c:${l.c};--t:${tint(l.c, .16)}">${l.e} ${esc(l.name)}${cnt(l.id) ? ` <small>${cnt(l.id)}</small>` : ''}</button>`).join('')
    + `<button class="lot-c add" data-l="__add">＋</button>`;
  const head = $('.folder-head', card); head.after(bar);
  $$('[data-l]', bar).forEach(b => {
    b.onclick = async () => {
      if (b.dataset.l === '__add') { const r = await formSheet('Nouveau lot', [{ name: 'n', label: 'Nom', placeholder: 'Ex : Faux plafond' }, { name: 'e', label: 'Emoji', value: '🔧' }], { okLabel: 'Ajouter' }); if (r && r.n) { lots.push({ id: DB.uid(), name: r.n, e: r.e || '🔧', c: ['#0ea5e9', '#22c55e', '#f97316', '#8b5cf6', '#e11d48'][lots.length % 5], points: [] }); await DB.put('projects', p); renderPlans(root); } return; }
      App.lotSel = App.lotSel || {}; App.lotSel[f.id] = b.dataset.l; renderPlans(root);
    };
    if (b.dataset.l && b.dataset.l !== '__add') b.oncontextmenu = (e) => { e.preventDefault(); lotMenu(lots.find(l => l.id === b.dataset.l), root); };
  });
  const on = bar.querySelector('.lot-c.on'); if (on) requestAnimationFrame(() => on.scrollIntoView({ inline: 'center', block: 'nearest' }));
  if (sel) { const L = lots.find(l => l.id === sel); if (L) bar.after(lotPanel(L, f, root)); }
}
const lotFilter = (ps, f) => { const s = lotSelOf(f.id); return s ? ps.filter(p => p.lotId === s) : ps; };

function lotPanel(L, f, root) {
  const p = App.project, niv = nivOfFolder(f.name);
  f.lotData = f.lotData || {}; const D = f.lotData[L.id] = f.lotData[L.id] || {};
  const av = (p.lots || []).find(x => normQ(x.name) === normQ(L.name));
  const done = (L.points || []).filter(x => (D[x.id] || {}).done).length;
  const el = document.createElement('div'); el.className = 'lot-panel'; el.style.setProperty('--c', L.c); el.style.setProperty('--t', tint(L.c, .12));
  el.innerHTML = `<div class="lp-h"><span class="lp-e">${L.e}</span><div class="grow"><b>${esc(L.name)}</b><small>${esc(f.name)}${(L.points || []).length ? ` · ${done}/${L.points.length} points` : ''}</small></div><button class="iconbtn sm" data-a="lm">${icon('more')}</button></div>
    <div class="lp-links">
      ${L.id === 'go' ? `<button data-go="rec">🔩 Réception ferraillage${niv ? ' · ' + esc(niv) : ''}</button><button data-go="bet">🧱 Bétonnage${niv ? ' · ' + esc(niv) : ''}</button><button data-go="dec">⏱️ Suivi décoffrage</button>` : ''}
      ${av ? `<button data-go="av">📊 Avancement ${esc(L.name)}</button>` : ''}
      <button data-go="tasks">⚠️ Réserves${niv ? ' · ' + esc(niv) : ''}</button>
    </div>
    <details class="lp-det" ${App.lotDet ? 'open' : ''}><summary>☑ Points de contrôle ${done}/${(L.points || []).length} · notes</summary>
    <div class="lp-pts">${(L.points || []).map(x => { const v = D[x.id] || {}; return `<button class="lp-pt ${v.done ? 'on' : ''}" data-pt="${x.id}"><i>${v.done ? '☑' : '☐'}</i><span class="grow">${esc(x.t)}${v.at ? `<small>${fmtDate(v.at)}</small>` : ''}</span></button>`; }).join('')}
      <button class="lp-add" data-a="addpt">${icon('plus')} Point de contrôle (pour tous les niveaux)</button></div>
    <label class="lp-note">Notes ${esc(L.name)} · ${esc(f.name)}<textarea placeholder="Remarques, besoins, matériel…">${esc(D._note || '')}</textarea></label></details>`;
  const save = () => DB.put('folders', f);
  $('.lp-det', el).ontoggle = (e) => { App.lotDet = e.target.open; };
  $$('[data-pt]', el).forEach(b => b.onclick = async () => { const v = D[b.dataset.pt] = D[b.dataset.pt] || {}; v.done = !v.done; v.at = v.done ? todayISO() : null; await save(); renderPlans(root); });
  $('[data-a=addpt]', el).onclick = async () => { const r = await formSheet(`Point de contrôle · ${L.name}`, [{ name: 't', label: 'Intitulé (ajouté à tous les niveaux)', placeholder: 'Ex : Réservations vérifiées' }], { okLabel: 'Ajouter' }); if (r && r.t) { L.points = L.points || []; L.points.push({ id: DB.uid(), t: r.t }); await DB.put('projects', p); renderPlans(root); } };
  const ta = $('textarea', el); ta.oninput = () => { D._note = ta.value; clearTimeout(ta._t); ta._t = setTimeout(save, 500); };
  $('[data-a=lm]', el).onclick = () => lotMenu(L, root);
  $$('[data-go]', el).forEach(b => b.onclick = async () => {
    const g = b.dataset.go;
    if (g === 'rec' || g === 'bet') { const k = g === 'rec' ? 'Ferraillage' : 'Bétonnage'; App.recNiv = App.recNiv || {}; App.recNiv[k] = niv; App.section = g === 'rec' ? 'reception' : 'beton'; return renderSection(); }
    if (g === 'dec') return openDecof(p);
    if (g === 'av') { App.avTab = av.id; App.section = 'avancement'; return renderSection(); }
    if (g === 'tasks') { App.section = 'tasks'; App.search = niv || ''; return renderSection(); }
  });
  return el;
}
async function lotMenu(L, root) {
  const p = App.project, lots = planLots(p), i = lots.indexOf(L);
  const v = await menu(`${L.e} ${L.name}`, [{ label: 'Renommer / emoji', icon: 'edit', value: 'ren' }, { label: 'Couleur', icon: 'brush', value: 'col' }, { label: '← Déplacer à gauche', icon: 'back', value: 'l' }, { label: 'Déplacer à droite →', icon: 'chevright', value: 'r' }, { label: 'Points de contrôle…', icon: 'check', value: 'pts' }, { label: 'Supprimer le lot', icon: 'trash', danger: true, value: 'del' }]);
  if (v === 'ren') { const r = await formSheet('Lot', [{ name: 'n', label: 'Nom', value: L.name }, { name: 'e', label: 'Emoji', value: L.e }]); if (r && r.n) { L.name = r.n; L.e = r.e || L.e; } }
  if (v === 'col') { const c = await menu('Couleur', ['#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#3b82f6', '#eab308', '#14b8a6', '#b45309', '#ec4899', '#64748b', '#22c55e', '#0ea5e9'].map(c => ({ label: c, swatch: c, value: c }))); if (c) L.c = c; }
  if ((v === 'l' && i > 0) || (v === 'r' && i < lots.length - 1)) { const j = v === 'l' ? i - 1 : i + 1; [lots[i], lots[j]] = [lots[j], lots[i]]; }
  if (v === 'pts') { const id = await menu('Supprimer un point ?', (L.points || []).map(x => ({ label: x.t, icon: 'trash', value: x.id }))); if (id && await confirmBox('Supprimer ce point de tous les niveaux ?')) L.points = L.points.filter(x => x.id !== id); }
  if (v === 'del' && await confirmBox(`Supprimer le lot « ${L.name} » ? Les plans restent dans le dossier.`)) lots.splice(i, 1);
  if (v) { await DB.put('projects', p); renderPlans(root); }
}
async function planLotMenu(plan, root) {
  const lots = planLots(App.project);
  const v = await menu(`Lot du plan « ${plan.name} »`, [...lots.map(l => ({ label: `${l.e} ${l.name}`, icon: plan.lotId === l.id ? 'check' : 'layers', value: l.id })), { label: 'Aucun lot', icon: 'close', value: '__none' }]);
  if (!v) return;
  plan.lotId = v === '__none' ? null : v; await DB.put('plans', plan);
  // les anciens indices suivent
  for (const x of await DB.byProject('plans', plan.projectId)) if (x.id !== plan.id && planSerie(x) === planSerie(plan)) { x.lotId = plan.lotId; await DB.put('plans', x); }
  renderPlans(root);
}
async function tagNewPlans(projectId, folderId, lotId, since) {
  for (const x of await DB.byProject('plans', projectId)) if (x.folderId === folderId && (x.createdAt || 0) >= since && !x.lotId) { x.lotId = lotId; await DB.put('plans', x); }
}
