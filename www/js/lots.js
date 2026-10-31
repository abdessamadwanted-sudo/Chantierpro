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
// points d'arrêt (🛑 la suite attend la levée) et points critiques (⚠️ à surveiller), modèles par lot
const PA_TPL = {
  go: [['a', 'Réception du ferraillage avant bétonnage'], ['a', 'Implantation / axes vérifiés (topo)'], ['a', 'Réception du fond de fouille'], ['c', 'Enrobage et cales en place'], ['c', 'Réservations et attentes'], ['c', 'Éprouvettes prélevées']],
  mac: [['a', 'Implantation des cloisons validée'], ['c', 'Chaînages et raidisseurs'], ['c', 'Linteaux et appuis']],
  chape: [['a', 'Support propre et réseaux sous chape réceptionnés'], ['c', 'Niveaux / trait de niveau'], ['c', 'Joints de fractionnement']],
  enduit: [['a', 'Réseaux encastrés réceptionnés'], ['c', 'Grillage aux jonctions béton / agglos'], ['c', 'Planéité (règle 2 m)']],
  etan: [['a', 'Réception du support (pente, propreté)'], ['a', 'Essai d\'étanchéité (mise en eau 48 h)'], ['c', 'Relevés et engravures']],
  elec: [['a', 'Réception des fourreaux avant coulage / enduit'], ['c', 'Essais de continuité / isolement'], ['c', 'Mise à la terre']],
  plomb: [['a', 'Essai de pression avant fermeture'], ['c', 'Pentes des évacuations'], ['c', 'Fourreaux en traversée']],
  menu: [['a', 'Validation des échantillons / fiches techniques'], ['c', 'Aplomb et calage'], ['c', 'Jeu de fonctionnement']],
  peint: [['a', 'Support sec et enduit réceptionné'], ['a', 'Validation de la teinte (échantillon)'], ['c', 'Couche d\'impression appliquée'], ['c', 'Aspect final (lumière rasante)']],
  carr: [['a', 'Validation du calepinage et des échantillons'], ['c', 'Planéité et pente du support'], ['c', 'Joints et plinthes']],
};
const PA_BY = ['Maître d\'ouvrage', 'BET', 'Bureau de contrôle', 'Laboratoire', 'Topographe', 'Entreprise', 'Architecte'];
const dueInfo = (D) => { if (!D || !D._due) return null; const d = Math.round((new Date(D._due + 'T12:00:00') - new Date(todayISO() + 'T12:00:00')) / 864e5); return { d, cls: d < 0 ? 'late' : d <= 7 ? 'soon' : 'ok', txt: d < 0 ? `Retard ${-d} j` : d === 0 ? 'Aujourd\'hui' : `J-${d}` }; };
const paOpen = (L, D) => (L.pa || []).filter(x => x.k === 'a' && ((D.pa || {})[x.id] || {}).st !== 'ok');
const lotStarted = (L, D) => !!(D._due || D._start || Object.keys(D).some(k => !k.startsWith('_') && k !== 'pa' && (D[k] || {}).done) || Object.values(D.pa || {}).some(v => v.st));
function planLots(p) {
  if (!p.planLots) p.planLots = LOTS_DEF.map(l => ({ ...l, points: l.id === 'go' ? LOT_GO_POINTS.map(t => ({ id: DB.uid(), t })) : [] }));
  return p.planLots;
}
const lotSelOf = (fid) => (App.lotSel || {})[fid] || '';
const nivOfFolder = (name) => { const m = String(name || '').replace(/_/g, ' ').replace(/niveau|niv\.?(?=\s*[rR\d])/gi, ' ').match(/\b(R\s?\+\s?\d+|RDC|SSL|SS\s?\d?|Mezz\w*|Terrasse|Fondations?)\b/i); return m ? m[1].replace(/\s+/g, '').replace(/^mezz\w*/i, 'Mezz') : ''; };
const tint = (c, a) => c + Math.round(a * 255).toString(16).padStart(2, '0');

// barre de lots + panneau du lot choisi, insérés dans la carte du dossier
function lotBarInto(card, f, ps, root) {
  const p = App.project, lots = planLots(p), sel = lotSelOf(f.id);
  const cnt = (id) => ps.filter(x => x.lotId === id).length;
  const avB = (L) => { try { return typeof avLotBadge === 'function' && App._avLinks ? avLotBadge(p, L, f, App._avLinks) : ''; } catch (e) { return ''; } };
  const bar = document.createElement('div'); bar.className = 'lot-bar';
  bar.innerHTML = `<button class="lot-c ${!sel ? 'on' : ''}" data-l="" style="--c:#64748b">📁 Tous <small>${ps.length}</small></button>`
    + lots.map(l => { const D = (f.lotData || {})[l.id] || {}, di = dueInfo(D), po = lotStarted(l, D) ? paOpen(l, D).length : 0;
      return `<button class="lot-c ${sel === l.id ? 'on' : ''}" data-l="${l.id}" style="--c:${l.c};--t:${tint(l.c, .16)}">${l.e} ${esc(l.name)}${cnt(l.id) ? ` <small>${cnt(l.id)}</small>` : ''}${po ? `<i class="lc-pa">🛑${po}</i>` : ''}${di && di.cls !== 'ok' ? `<i class="lc-due ${di.cls}">⏳</i>` : ''}${avB(l)}</button>`; }).join('')
    + `<button class="lot-c add" data-l="__add">＋</button>`;
  const head = $('.folder-head', card); head.after(bar);
  $$('[data-l]', bar).forEach(b => {
    b.onclick = async () => {
      if (b.dataset.l === '__add') { const r = await formSheet('Nouveau lot', [{ name: 'n', label: 'Nom', placeholder: 'Ex : Faux plafond' }, { name: 'e', label: 'Emoji', value: '🔧' }], { okLabel: 'Ajouter' }); if (r && r.n) { lots.push({ id: DB.uid(), name: r.n, e: r.e || '🔧', c: ['#0ea5e9', '#22c55e', '#f97316', '#8b5cf6', '#e11d48'][lots.length % 5], points: [] }); await DB.put('projects', p); renderPlans(root); } return; }
      App.lotSel = App.lotSel || {}; App.lotSel[f.id] = b.dataset.l; App.scrollFolder = f.id; renderPlans(root);
    };
    if (b.dataset.l && b.dataset.l !== '__add') b.oncontextmenu = (e) => { e.preventDefault(); lotMenu(lots.find(l => l.id === b.dataset.l), root); };
  });
  const on = bar.querySelector('.lot-c.on'); if (on) requestAnimationFrame(() => on.scrollIntoView({ inline: 'center', block: 'nearest' }));
  if (sel) { const L = lots.find(l => l.id === sel); if (L) bar.after(lotPanel(L, f, root)); }
}
const lotFilter = (ps, f) => { const s = lotSelOf(f.id); return s ? ps.filter(p => p.lotId === s) : ps; };

// panneau du lot : replié par défaut (une ligne), on l'ouvre au toucher ; « ＋ Ajouter » pour y mettre ce qu'il faut
const lotOpenK = (L) => { try { return (JSON.parse(localStorage.getItem('lot.open') || '{}'))[L.id]; } catch (e) { return false; } };
const lotOpenSet = (L, v) => { try { const o = JSON.parse(localStorage.getItem('lot.open') || '{}'); o[L.id] = v; localStorage.setItem('lot.open', JSON.stringify(o)); } catch (e) {} };
const LOT_GS = [['bpu', '📑 BPU'], ['att', '📐 Attachements'], ['dec', '🧾 Décompte'], ['stock', '📦 Stock']];
function lotPanel(L, f, root) {
  const p = App.project, niv = nivOfFolder(f.name);
  f.lotData = f.lotData || {}; const D = f.lotData[L.id] = f.lotData[L.id] || {};
  const av = (p.lots || []).find(x => normQ(x.name) === normQ(L.name));
  const done = (L.points || []).filter(x => (D[x.id] || {}).done).length, open = !!lotOpenK(L), po = paOpen(L, D).length, di = dueInfo(D);
  const sc = L.sc || [], docs = D._docs || [];
  const el = document.createElement('div'); el.className = 'lot-panel' + (open ? ' open' : ''); el.style.setProperty('--c', L.c); el.style.setProperty('--t', tint(L.c, .12));
  el.innerHTML = `<div class="lp-h" data-a="tog"><span class="lp-e">${L.e}</span><div class="grow"><b>${esc(L.name)}</b><small>${esc(f.name)}${(L.points || []).length ? ` · ${done}/${L.points.length} points` : ''}${po ? ` · 🛑 ${po}` : ''}${di ? ` · ⏳ ${di.txt}` : ''}</small></div><button class="iconbtn sm" data-a="lm">${icon('more')}</button><span class="lp-chev">${icon('chevdown')}</span></div>
    ${!open ? '' : `<div class="lp-body">
    <div class="lp-avslot"></div>
    ${lotDueHTML(L, D, f)}
    ${lotPaHTML(L, D)}
    <div class="lp-links">
      ${L.id === 'go' ? `<button data-go="rec">🔩 Réception ferraillage${niv ? ' · ' + esc(niv) : ''}</button><button data-go="bet">🧱 Bétonnage${niv ? ' · ' + esc(niv) : ''}</button><button data-go="dec">⏱️ Suivi décoffrage</button>` : ''}
      ${av ? `<button data-go="av">📊 Avancement ${esc(L.name)}</button>` : ''}
      <button data-go="tasks">⚠️ Réserves${niv ? ' · ' + esc(niv) : ''}</button>
      <button data-go="suivi">📊 Suivi du lot · équipes</button>
      ${(L.rub || []).map(R => `<button data-rub="${R.id}">${esc(R.e)} ${esc(R.name)}${(((f.lotData || {})[L.id] || {})._rub || {})[R.id] && f.lotData[L.id]._rub[R.id].length ? ` <small>${f.lotData[L.id]._rub[R.id].length}</small>` : ''}</button>`).join('')}
      <button data-a="rubnew" class="lp-rubnew">＋ Rubrique</button>
      ${sc.map((x, i) => `<button data-sc="${i}">${SC_EMO && SC_EMO[x.sec] ? SC_EMO[x.sec] + ' ' : '🔗 '}${esc(x.label)}</button>`).join('')}
    </div>
    ${docs.length ? `<div class="lp-docs">${docs.map((d, i) => `<div class="lp-doc"><button class="grow" data-doc="${i}">${icon(d.url && !d.fileId ? 'drive' : d.planId ? 'plans' : 'pdf')}<span>${esc(d.name)}</span></button><button class="iconbtn sm" data-docm="${i}">${icon('more')}</button></div>`).join('')}</div>` : ''}
    <details class="lp-det" ${App.lotDet ? 'open' : ''}><summary>☑ Points de contrôle ${done}/${(L.points || []).length} · notes</summary>
    <div class="lp-pts">${(L.points || []).map(x => { const v = D[x.id] || {}; return `<button class="lp-pt ${v.done ? 'on' : ''}" data-pt="${x.id}"><i>${v.done ? '☑' : '☐'}</i><span class="grow">${esc(x.t)}${v.at ? `<small>${fmtDate(v.at)}</small>` : ''}</span></button>`; }).join('')}
      <button class="lp-add" data-a="addpt">${icon('plus')} Point de contrôle (pour tous les niveaux)</button></div>
    <label class="lp-note">Notes ${esc(L.name)} · ${esc(f.name)}<textarea placeholder="Remarques, besoins, matériel…">${esc(D._note || '')}</textarea></label></details>
    <button class="lp-plus" data-a="plus">${icon('plus')} Ajouter dans ${esc(L.name)}</button></div>`}`;
  const save = () => DB.put('folders', f), redraw = () => renderPlans(root);
  $('[data-a=tog]', el).onclick = (e) => { if (e.target.closest('[data-a=lm]')) return; lotOpenSet(L, !open); App.scrollFolder = f.id; redraw(); };
  $('[data-a=lm]', el).onclick = (e) => { e.stopPropagation(); lotMenu(L, root); };
  if (!open) return el;
  // v1.0.47 : lien direct vers l'avancement de CE lot sur CE niveau (alertes, dates, équipes, saisies, ✓ terminé)
  { const sl = $('.lp-avslot', el); if (sl && typeof avLotPanelBlock === 'function') sl.replaceWith(avLotPanelBlock(p, L, f, redraw)); }
  $('.lp-det', el).ontoggle = (e) => { App.lotDet = e.target.open; };
  $$('[data-pt]', el).forEach(b => b.onclick = async () => { const v = D[b.dataset.pt] = D[b.dataset.pt] || {}; v.done = !v.done; v.at = v.done ? todayISO() : null; await save(); redraw(); });
  const addPt = async () => { const r = await formSheet(`Point de contrôle · ${L.name}`, [{ name: 't', label: 'Intitulé (ajouté à tous les niveaux)', placeholder: 'Ex : Réservations vérifiées' }], { okLabel: 'Ajouter' }); if (r && r.t) { L.points = L.points || []; L.points.push({ id: DB.uid(), t: r.t }); App.lotDet = true; await DB.put('projects', p); redraw(); } };
  $('[data-a=addpt]', el).onclick = addPt;
  const ta = $('textarea', el); ta.oninput = () => { D._note = ta.value; clearTimeout(ta._t); ta._t = setTimeout(save, 500); };
  bindLotDue(el, L, D, f, save, redraw);
  $$('[data-go]', el).forEach(b => b.onclick = async () => {
    const g = b.dataset.go;
    if (g === 'rec' || g === 'bet') { const k = g === 'rec' ? 'Ferraillage' : 'Bétonnage'; App.recNiv = App.recNiv || {}; App.recNiv[k] = niv; App.section = g === 'rec' ? 'reception' : 'beton'; return renderSection(); }
    if (g === 'dec') return openDecof(p);
    if (g === 'av') { App.avTab = av.id; App.section = 'avancement'; return renderSection(); }
    if (g === 'tasks') { App.section = 'tasks'; App.search = niv || ''; return renderSection(); }
    if (g === 'suivi') { App.section = 'lotsuivi'; return renderSection(); }   // v1.0.35 : attachements / décomptes → Gestion & finance
  });
  $$('[data-gs]', el).forEach(b => b.onclick = () => { App.gsTab = b.dataset.gs; App.gsLot = b.dataset.gs === 'stock' ? '' : L.id; App.section = 'gestion'; renderSection(); });
  $$('[data-sc]', el).forEach(b => { const x = sc[+b.dataset.sc]; b.onclick = () => { if (!SECTIONS[x.sec]) return toast('Section introuvable'); App.section = x.sec; App.search = x.q || ''; renderSection(); };
    b.oncontextmenu = async (e) => { e.preventDefault(); if (await confirmBox(`Retirer le raccourci « ${x.label} » de ${L.name} ?`)) { sc.splice(+b.dataset.sc, 1); await DB.put('projects', p); redraw(); } }; });
  $$('[data-rub]', el).forEach(b => { const R = (L.rub || []).find(x => x.id === b.dataset.rub); if (!R) return;
    b.onclick = async () => { await rubOpen(p, L, f, R); redraw(); };
    let t = null; b.addEventListener('touchstart', () => { t = setTimeout(() => { t = 'done'; rubMenu(p, L, R, redraw); }, 550); }, { passive: true });
    b.addEventListener('touchend', (e) => { if (t === 'done') e.preventDefault(); clearTimeout(t); t = null; }); b.addEventListener('touchmove', () => { clearTimeout(t); t = null; }, { passive: true });
    b.oncontextmenu = (e) => { e.preventDefault(); rubMenu(p, L, R, redraw); }; });
  $('[data-a=rubnew]', el).onclick = async () => { const R = await rubNew(p, L); if (R) { await rubOpen(p, L, f, R); redraw(); } };
  $$('[data-doc]', el).forEach(b => b.onclick = () => pbOpenDoc(docs[+b.dataset.doc], { projectId: p.id }, planCtx(() => {})));
  $$('[data-docm]', el).forEach(b => b.onclick = async () => { const i = +b.dataset.docm, d = docs[i];
    const v = await menu(d.name, [{ label: 'Ouvrir', icon: 'pdf', value: 'open' }, { label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Monter', icon: 'chevup', value: 'up' }, { label: 'Retirer', icon: 'trash', danger: true, value: 'del' }]);
    if (v === 'open') pbOpenDoc(d, { projectId: p.id }, planCtx(() => {}));
    if (v === 'ren') { const r = await formSheet('Renommer', [{ name: 'n', label: 'Nom', value: d.name }]); if (r && r.n) { d.name = r.n; await save(); redraw(); } }
    if (v === 'up' && i > 0) { [docs[i - 1], docs[i]] = [docs[i], docs[i - 1]]; await save(); redraw(); }
    if (v === 'del' && await confirmBox('Retirer ce document ?')) { if (d.fileId) await DB.del('files', d.fileId); docs.splice(i, 1); await save(); redraw(); } });
  // ＋ Ajouter : ce qu'il faut dans ce lot
  $('[data-a=plus]', el).onclick = async () => {
    const v = await menu(`Ajouter dans ${L.e} ${L.name}`, [{ label: '☑ Point de contrôle (tous les niveaux)', icon: 'check', value: 'pt' }, { label: '🛑 Point d\'arrêt', icon: 'close', value: 'pa' }, { label: '⚠️ Point critique', icon: 'ask', value: 'pc' },
      { label: '🗂 Nouvelle rubrique (tableau + Excel)', icon: 'grid', value: 'rub' }, { label: '🔗 Raccourci vers une section', icon: 'layers', value: 'sc' }, { label: `📄 Document / plan (${f.name})`, icon: 'pdf', value: 'doc' }, { label: '📝 Note', icon: 'edit', value: 'note' }]);
    if (v === 'pt') addPt();
    if (v === 'rub') { const R = await rubNew(p, L); if (R) { await rubOpen(p, L, f, R); redraw(); } }
    if (v === 'pa' || v === 'pc') { const b = $(v === 'pa' ? '[data-a=addpa]' : '[data-a=addpc]', el); if (b) b.click(); }
    if (v === 'sc') { const secs = Object.entries(SECTIONS).filter(([k, S]) => !S.hidden && k !== 'settings' && (!SECTION_FEATURE[k] || featOn(SECTION_FEATURE[k])));
      const k = await menu('Raccourci vers…', secs.map(([k2, S]) => ({ label: `${(SC_EMO && SC_EMO[k2]) || '📁'} ${S.label}`, value: k2 }))); if (!k) return;
      L.sc = L.sc || []; L.sc.push({ sec: k, label: SECTIONS[k].label.split(' (')[0] }); await DB.put('projects', p); toast('Raccourci ajouté (pour tous les niveaux) ✓'); redraw(); }
    if (v === 'doc') { const ds = await pbPickDocs(p.id); if (ds.length) { D._docs = [...docs, ...ds]; await save(); redraw(); } }
    if (v === 'note') { App.lotDet = true; redraw(); setTimeout(() => { const t = document.querySelector(`.lot-panel.open textarea`); if (t) { t.focus(); t.scrollIntoView({ block: 'center' }); } }, 200); }
  };
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

// ---------- Échéance du maître d'ouvrage (par lot et par niveau) + points d'arrêt / critiques ----------
function lotDueHTML(L, D, f) {
  const p = App.project, di = dueInfo(D), done = (L.points || []).filter(x => (D[x.id] || {}).done).length, nP = (L.points || []).length;
  const pa = L.pa || [], paOk = pa.filter(x => ((D.pa || {})[x.id] || {}).st === 'ok').length;
  const prog = nP + pa.length ? Math.round((done + paOk) / (nP + pa.length) * 100) : 0;
  let tp = 0; if (D._due) { const a = new Date((D._start || D._dueSet || todayISO()) + 'T12:00:00'), b = new Date(D._due + 'T12:00:00'), n = new Date(todayISO() + 'T12:00:00'); tp = b > a ? Math.max(0, Math.min(100, Math.round((n - a) / (b - a) * 100))) : 100; }
  if (!di) return `<button class="lp-due none" data-a="due">⏳ <span class="grow">Échéance ${esc(D._dueBy || 'du maître d\'ouvrage')} <small>non fixée · toucher pour la fixer</small></span>${icon('plus')}</button>`;
  return `<button class="lp-due ${di.cls}" data-a="due"><span class="lp-dd">${di.txt}</span><span class="grow"><b>Échéance ${esc(D._dueBy || 'MO')} · ${fmtDate(D._due)}</b><small>${esc(p.mo || 'Maître d\'ouvrage : toucher pour le nommer')}${(D._dueHist || []).length ? ` · modifiée ${(D._dueHist || []).length} fois` : ''}</small>
    <span class="lp-bars"><span><i style="width:${tp}%"></i></span><em>temps ${tp}%</em><span class="pr"><i style="width:${prog}%"></i></span><em>fait ${prog}%</em></span></span></button>`;
}
function lotPaHTML(L, D) {
  const pa = L.pa || [], st = D.pa || {};
  const open = paOpen(L, D).length, ko = pa.filter(x => (st[x.id] || {}).st === 'ko').length;
  const pill = (x) => { const v = st[x.id] || {}; return v.st === 'ok' ? '<i class="pa-s ok">✓ levé</i>' : v.st === 'ko' ? '<i class="pa-s ko">✗ refusé</i>' : '<i class="pa-s w">⏳ en attente</i>'; };
  return `<details class="lp-det lp-pa" ${App.lotPaDet ? 'open' : ''}><summary>🛑 Points d'arrêt & critiques ${pa.length ? `<b class="${open || ko ? 'r' : 'g'}">${pa.filter(x => (st[x.id] || {}).st === 'ok').length}/${pa.length}</b>` : ''}</summary>
    <div class="lp-pts">${pa.map(x => { const v = st[x.id] || {}; return `<button class="pa-row ${x.k}" data-pa="${x.id}"><span class="pa-k">${x.k === 'a' ? '🛑' : '⚠️'}</span><span class="grow">${esc(x.t)}<small>${x.k === 'a' ? 'Point d\'arrêt' : 'Point critique'}${v.at ? ` · ${fmtDate(v.at)}` : ''}${v.by ? ` · ${esc(v.by)}` : ''}${(v.ph || []).length ? ` · 📷 ${(v.ph || []).length}` : ''}${v.note ? ' · 📝' : ''}</small></span>${pill(x)}</button>`; }).join('') || '<div class="lp-none">Aucun point. Ajoutez-en, ou chargez le modèle du lot.</div>'}
      <div class="pa-acts"><button class="lp-add" data-a="addpa">${icon('plus')} Point d'arrêt</button><button class="lp-add" data-a="addpc">${icon('plus')} Point critique</button>${PA_TPL[L.id] ? `<button class="lp-add" data-a="tplpa">📋 Modèle ${esc(L.name)}</button>` : ''}</div></div></details>`;
}
function bindLotDue(el, L, D, f, save, redraw) {
  const p = App.project;
  const pd = $('.lp-pa', el); if (pd) pd.ontoggle = (e) => { App.lotPaDet = e.target.open; };
  $('[data-a=due]', el).onclick = async () => {
    const r = await formSheet(`Échéance · ${L.name} · ${f.name}`, [
      { name: 'due', label: 'Date limite fixée', type: 'date', value: D._due || '' },
      { name: 'by', label: 'Fixée par', type: 'select', value: D._dueBy || 'MO', options: [['MO', 'Maître d\'ouvrage'], ['BET', 'BET'], ['BC', 'Bureau de contrôle'], ['Archi', 'Architecte'], ['Entreprise', 'Entreprise / planning interne']].map(([value, label]) => ({ value, label })) },
      { name: 'start', label: 'Début du lot (pour la barre de temps)', type: 'date', value: D._start || '' },
      { name: 'mo', label: 'Nom du maître d\'ouvrage (pour tout le projet)', value: p.mo || '', placeholder: 'Ex : SONARGES, ONEE, Commune…' },
      ...(D._due ? [{ name: 'why', label: 'Motif du changement (si la date change)', placeholder: 'Ex : avenant n°2, intempéries…' }] : []),
      ...((D._dueHist || []).length ? [{ name: '_h', type: 'info', label: 'Historique', value: D._dueHist.map(h => `${fmtDate(h.from)} → ${fmtDate(h.to)}${h.why ? ' (' + h.why + ')' : ''} · le ${fmtDate(h.at)}`).join('\n') }] : []),
    ], { okLabel: 'Enregistrer', danger: D._due ? 'Retirer l\'échéance' : null });
    if (!r) return;
    if (r.__danger) { delete D._due; delete D._dueBy; }
    else {
      if (D._due && r.due && r.due !== D._due) (D._dueHist = D._dueHist || []).push({ from: D._due, to: r.due, why: r.why || '', at: todayISO() });
      if (r.due && !D._due) D._dueSet = todayISO();
      D._due = r.due || null; D._dueBy = r.by; D._start = r.start || D._start || null;
      if ((r.mo || '') !== (p.mo || '')) { p.mo = r.mo; await DB.put('projects', p); }
    }
    await save(); redraw();
  };
  const addPa = async (k) => { const r = await formSheet(k === 'a' ? '🛑 Point d\'arrêt' : '⚠️ Point critique', [{ name: 't', label: 'Intitulé (ajouté à tous les niveaux)', placeholder: k === 'a' ? 'Ex : Réception ferraillage avant bétonnage' : 'Ex : Enrobage' }], { okLabel: 'Ajouter' }); if (r && r.t) { L.pa = L.pa || []; L.pa.push({ id: DB.uid(), k, t: r.t }); await DB.put('projects', p); App.lotPaDet = true; redraw(); } };
  $('[data-a=addpa]', el).onclick = () => addPa('a');
  $('[data-a=addpc]', el).onclick = () => addPa('c');
  const tp = $('[data-a=tplpa]', el); if (tp) tp.onclick = async () => { L.pa = L.pa || []; let n = 0; for (const [k, t] of PA_TPL[L.id]) if (!L.pa.some(x => normQ(x.t) === normQ(t))) { L.pa.push({ id: DB.uid(), k, t }); n++; } await DB.put('projects', p); App.lotPaDet = true; toast(`${n} point(s) ajouté(s) pour tous les niveaux`); redraw(); };
  $$('[data-pa]', el).forEach(b => b.onclick = async () => {
    const x = (L.pa || []).find(y => y.id === b.dataset.pa); if (!x) return; D.pa = D.pa || {}; const v = D.pa[x.id] = D.pa[x.id] || {};
    const c = await menu(`${x.k === 'a' ? '🛑' : '⚠️'} ${x.t}`, [
      { label: '✓ Levé (accepté)', icon: 'check', value: 'ok', checked: v.st === 'ok' }, { label: '✗ Refusé', icon: 'close', value: 'ko', checked: v.st === 'ko' }, { label: '⏳ En attente', icon: 'calendar', value: 'w', checked: !v.st || v.st === 'w' },
      { label: 'Ajouter une photo / le PV', icon: 'camera', value: 'ph' }, ...((v.ph || []).length ? [{ label: `Voir les photos (${v.ph.length})`, icon: 'image', value: 'see' }] : []),
      { label: 'Note', icon: 'edit', value: 'note' }, { label: 'Supprimer ce point (tous les niveaux)', icon: 'trash', danger: true, value: 'del' }]);
    if (!c) return;
    if (c === 'ok' || c === 'ko') { const r = await formSheet(c === 'ok' ? 'Point levé' : 'Point refusé', [{ name: 'by', label: 'Par', type: 'select', value: v.by || PA_BY[0], options: PA_BY.map(z => ({ value: z, label: z })) }, { name: 'at', label: 'Date', type: 'date', value: todayISO() }, { name: 'note', label: 'Observation', value: v.note || '' }], { okLabel: 'Enregistrer' }); if (!r) return; Object.assign(v, { st: c, by: r.by, at: r.at, note: r.note }); }
    if (c === 'w') { v.st = 'w'; v.at = null; }
    if (c === 'ph') { const files = await pickFiles({ accept: 'image/*,application/pdf', multiple: true }); for (const fl of files) { const rec = isRasterImage(fl) ? await saveImageFile(p.id, fl, 'photo', { source: `${L.name} · ${x.t}` }) : await DB.put('files', { projectId: p.id, blob: fl, mime: mimeFromName(fl.name, fl.type), name: fl.name, role: 'pv' }); (v.ph = v.ph || []).push(rec.id); } }
    if (c === 'see') { const items = []; for (const id of v.ph) { const fr = await DB.get('files', id); if (fr && fr.blob) { if (/image/.test(fr.mime || fr.blob.type)) items.push({ src: BlobURL.get(fr.id, fr.blob), caption: x.t }); else openFileRecord(fr, x.t); } } if (items.length) showGallery(items, 0); return; }
    if (c === 'note') { const r = await formSheet('Note', [{ name: 'n', label: x.t, type: 'textarea', value: v.note || '' }]); if (r) v.note = r.n; }
    if (c === 'del') { if (!await confirmBox('Supprimer ce point de tous les niveaux ?')) return; L.pa = L.pa.filter(y => y.id !== x.id); await DB.put('projects', p); }
    await save(); App.lotPaDet = true; redraw();
  });
}
// liste pour le tableau de bord / rapport hebdo
async function lotDueList(p) {
  const out = [];
  for (const f of await DB.byProject('folders', p.id)) for (const L of planLots(p)) { const D = (f.lotData || {})[L.id]; if (!D) continue; const di = dueInfo(D), po = paOpen(L, D);
    if (di || (lotStarted(L, D) && po.length)) out.push({ f, L, D, di, po }); }
  return out.sort((a, b) => (a.di ? a.di.d : 9999) - (b.di ? b.di.d : 9999));
}
