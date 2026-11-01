// ================= Avancement second œuvre : lots (maçonnerie, chape, enduit…) → niveaux (plans) → locaux (pins) =================
// Pour chaque local et chaque lot : état, avancement, engagement pris avec le maître d'ouvrage (date limite), date de fin, photos, observations.
// Les locaux sont des pins (store « links », kind = 'local') : ils suivent donc la synchronisation Drive, les sauvegardes,
// le suivi de licence et le report automatique lors d'un nouvel indice de plan.

const AV_DEFAULT_LOTS = [
  { id: 'maconnerie', name: 'Maçonnerie', color: '#b45309' },
  { id: 'chape', name: 'Chape', color: '#0891b2' },
  { id: 'enduit', name: 'Enduit', color: '#7c3aed' },
];
const AV_ST = {
  late: ['En retard', '#ef4444'],
  soon: ['Échéance sous 7 j', '#f59e0b'],
  progress: ['En cours', '#3b82f6'],
  todo: ['À faire', '#94a3b8'],
  done: ['Terminé', '#22c55e'],
  donelate: ['Terminé hors délai', '#0f766e'],
};
const AV_STATES = [['todo', 'À faire', '#94a3b8'], ['progress', 'En cours', '#3b82f6'], ['done', 'Terminé', '#22c55e']];
const AV_LOT_COLORS = ['#b45309', '#0891b2', '#7c3aed', '#db2777', '#16a34a', '#ea580c', '#2563eb', '#475569'];

const avDaysTo = (iso) => Math.round((new Date(iso + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 864e5);
function avStatus(r) {
  r = r || {};
  if (r.state === 'done') return r.due && r.doneAt && r.doneAt > r.due ? 'donelate' : 'done';
  if (r.due) { const d = avDaysTo(r.due); if (d < 0) return 'late'; if (d <= 7) return 'soon'; }
  return r.state === 'progress' ? 'progress' : 'todo';
}
const avIsDone = (s) => s === 'done' || s === 'donelate';
const avPct = (r) => { r = r || {}; return r.state === 'done' ? 100 : r.state === 'progress' ? (+r.pct || 50) : 0; };
function avLots(p) { if (!p.lots || !p.lots.length) p.lots = AV_DEFAULT_LOTS.map(x => ({ ...x })); return p.lots; }
const avLot = (p, id) => avLots(p).find(l => l.id === id) || avLots(p)[0];
const avNameSort = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr', { numeric: true });

async function avData(p) {
  const [links, plans] = await Promise.all([DB.byProject('links', p.id), DB.byProject('plans', p.id)]);
  const locaux = links.filter(l => l.kind === 'local');
  const nivs = [];
  for (const n of p.avNiveaux || []) nivs.push({ ...n, plan: await latestPlanOfSerie(p.id, n.serieId, plans) });
  return { locaux, plans, nivs };
}
// statistiques d'un ensemble de locaux pour un lot
function avStats(locs, lotId) {
  const o = { n: locs.length, late: 0, soon: 0, done: 0, progress: 0, todo: 0, donelate: 0, pct: 0 };
  for (const l of locs) { const r = (l.lots || {})[lotId]; o[avStatus(r)]++; o.pct += avPct(r); }
  o.pct = o.n ? Math.round(o.pct / o.n) : 0; o.fin = o.done + o.donelate;
  return o;
}

// ---------- Section « Avancement » ----------
async function renderAvancement(root) {
  const p = App.project; avLots(p);
  if (typeof avSyncFromPlans === 'function') { try { await avSyncFromPlans(p); } catch (e) { console.warn('sync plans', e); } }   // v1.0.47 : niveaux et plans par lot repris d'Outils › Plans
  const { locaux, nivs: N0 } = await avData(p);
  const nivs = typeof avNivSorted === 'function' ? avNivSorted(p, N0) : N0;   // v1.0.47 : par zone, puis de bas en haut (SSL › RDC › MEZZ › R+1…)
  if (typeof avReminderCheck === 'function') { setTimeout(() => avReminderCheck(p), 1200); avReminderNotif(p); }
  if (App.avTab && App.avTab !== 'dash' && !p.lots.find(l => l.id === App.avTab)) App.avTab = 'dash';
  App.avTab = App.avTab || 'dash';
  const tba = $('#tbActions');
  if (tba) {
    tba.innerHTML = `${typeof openAvTable === 'function' ? `<button class="iconbtn" data-a="avtab" title="Tableau rapide">${icon('grid')}</button>` : ''}<button class="iconbtn" data-a="avjour" title="Avancement du jour">${icon('calendar')}</button><button class="iconbtn" data-a="avpdf" title="Rapport PDF">${icon('pdf')}</button><button class="iconbtn" data-a="avset" title="Lots et réglages">${icon('settings')}</button>`;
    $('[data-a=avjour]').onclick = () => typeof openAvJour === 'function' && openAvJour(p);
    const avt = $('[data-a=avtab]'); if (avt) avt.onclick = () => openAvTable(p, { lotId: App.avTab !== 'dash' ? App.avTab : '', onClose: () => renderAvancement(root) });
    $('[data-a=avpdf]').onclick = () => avReportDialog({});
    $('[data-a=avset]').onclick = () => avSettings(root);
  }
  const tabs = `<div class="av-tabs"><button data-t="dash" class="${App.avTab === 'dash' ? 'on' : ''}">📊 Pro</button>${(typeof avLotsOrdered === 'function' ? avLotsOrdered(p) : p.lots).map(l => `<button data-t="${l.id}" class="${App.avTab === l.id ? 'on' : ''}" style="--c:${l.color}"><i></i>${esc(l.name)}</button>`).join('')}</div>`;
  let body = '';
  if (!nivs.length) {
    body = `<div class="av-empty"><div class="ic">🏗️</div><b>Suivi d'avancement par lot</b>
      <ol><li>Ajoutez un <b>niveau</b> (plan R+1, RDC…) — PDF, image ou AutoCAD DXF.</li><li>Placez les <b>locaux</b> sur le plan (pins).</li><li>Pour chaque lot (${p.lots.map(l => esc(l.name)).join(', ')}), saisissez l'<b>engagement</b> avec le maître d'ouvrage, l'état et les photos.</li></ol>
      <button class="btn" data-a="addniv">${icon('plus')} Ajouter un niveau</button></div>`;
  } else if (App.avTab === 'dash') body = typeof avProDash === 'function' ? '<div class="avp-root"></div>' : avDashboardHTML(p, nivs, locaux);
  else {
    const lot = avLot(p, App.avTab);
    const zh = (n, i) => typeof avZoneOf === 'function' && (i === 0 || avZoneOf(p, nivs[i - 1]) !== avZoneOf(p, n)) ? `<div class="av-zh">${esc(avZoneOf(p, n))}</div>` : '';
    const LL0 = locaux.filter(l => nivs.some(n => n.id === l.nivId)), tl = avStats(LL0, lot.id);
    const QL = typeof avQtyDone === 'function' ? LL0.filter(l => +((l.lots || {})[lot.id] || {}).qtot > 0) : [], qU = [...new Set(QL.map(l => (l.lots[lot.id].unit || 'm²')))];
    const qTxt = QL.length && qU.length === 1 ? ` · ${avFmtQ(QL.reduce((a, l) => a + avQtyDone(l, lot.id), 0))} / ${avFmtQ(QL.reduce((a, l) => a + +l.lots[lot.id].qtot, 0))} ${qU[0]}` : '';
    body = `<div class="av-list"><div class="av-total" style="--c:${lot.color}"><span>Total ${esc(lot.name)}</span><span class="av-tb"><i style="width:${tl.pct}%"></i></span><b>${tl.pct}%</b><small>${tl.fin}/${tl.n} terminé(s)${qTxt}${tl.late ? ` · <em>${tl.late} en retard</em>` : ''}</small></div>${nivs.map((n, i) => { const locs = locaux.filter(l => l.nivId === n.id), s = avStats(locs, lot.id);
      return `${zh(n, i)}<div class="av-niv" data-niv="${n.id}"><div class="av-niv-h"><span class="av-th" data-th="${n.id}"></span><span class="av-niv-n">${esc(n.name)}</span>
          <span class="grow"><b>${s.pct}%</b> <small>${s.fin}/${s.n} local(aux) terminé(s)</small><small class="av-pl" data-pl="${n.id}">${n.plan ? `Plan général · ind. ${esc(planIndice(n.plan))}` : '<span style="color:var(--red)">plan manquant</span>'}</small></span>
          ${typeof avCompareQuick === 'function' ? `<button class="iconbtn sm av-cmpb" data-ncmp="${n.id}" title="Comparer">${icon('swap')}</button>` : ''}<button class="iconbtn sm" data-nmore="${n.id}">${icon('more')}</button></div>
        <div class="av-bar">${['done', 'donelate', 'progress', 'soon', 'late', 'todo'].map(k => s[k] ? `<i style="flex:${s[k]};background:${AV_ST[k][1]}"></i>` : '').join('') || '<i style="flex:1;background:var(--line)"></i>'}</div>
        <div class="av-cnt">${s.late ? `<em class="r">${s.late} en retard</em>` : ''}${s.soon ? `<em class="o">${s.soon} échéance sous 7 j</em>` : ''}${s.progress ? `<em class="b">${s.progress} en cours</em>` : ''}${!s.n ? '<em>Aucun local — touchez pour en placer</em>' : ''}</div></div>`; }).join('')}
      <button class="av-add" data-a="addniv">${icon('plus')} Ajouter un niveau</button></div>`;
  }
  root.innerHTML = tabs + body;
  const pr = $('.avp-root', root); if (pr) avProDash(pr, p, nivs, locaux);
  $$('.av-tabs [data-t]', root).forEach(b => b.onclick = () => { App.avTab = b.dataset.t; renderAvancement(root); });
  $$('[data-a=addniv]', root).forEach(b => b.onclick = async () => { if (await avAddNiveau(p)) renderAvancement(root); });
  $$('[data-ncmp]', root).forEach(b => b.onclick = (e) => { e.stopPropagation(); const n = (p.avNiveaux || []).find(x => x.id === b.dataset.ncmp); if (n) avCompareQuick(p, n, App.avTab); });
  // v1.0.47 : chaque niveau montre le plan DE CE LOT (miniature, nom, indice) ; sinon le plan général et « ＋ Plan <lot> »
  if (App.avTab !== 'dash' && typeof avLotPlan === 'function') (async () => { const lot = avLot(p, App.avTab); let thN = 0;
    for (const n of nivs) { const pn = (p.avNiveaux || []).find(x => x.id === n.id); if (!pn) continue; let L = null; try { L = await avLotPlan(p, pn, lot.id); } catch (e) {} if (!L || !L.plan) continue;
      const lab = $(`[data-pl="${n.id}"]`, root); if (lab) lab.innerHTML = L.id !== 'main' ? `<b style="color:${lot.color}">Plan ${esc(lot.name)}</b> · ${esc(L.plan.name)} · ind. ${esc(planIndice(L.plan))}` : `Plan général · ind. ${esc(planIndice(L.plan))} <button class="av-addpl" data-addpl="${n.id}">＋ Plan ${esc(lot.name)}</button>`;
      const ab = lab && lab.querySelector('[data-addpl]'); if (ab) ab.onclick = async (e) => { e.stopPropagation(); if (await avAddLotPlan(p, pn, lot.id)) renderAvancement(root); };
      // v1.0.51 : miniatures prudentes — déjà gardées : affichées tout de suite ; sinon au plus 2 nouvelles par affichage, au calme
      const th = $(`[data-th="${n.id}"]`, root), ready = (() => { try { return !!localStorage.getItem('th.' + L.plan.fileId + '|240'); } catch (e) { return false; } })();
      if (th && typeof avLiteURL === 'function' && (ready || ++thN <= 2)) { if (!ready) await new Promise(r => (window.requestIdleCallback || setTimeout)(r, { timeout: 800 })); if (!th.isConnected) return; avLiteURL(L.plan.fileId, 240).then(u => { if (u && th.isConnected) th.innerHTML = `<img src="${u}" alt="">`; }).catch(() => {}); } } })();
  $$('[data-niv]', root).forEach(c => c.onclick = (e) => { if (e.target.closest('[data-nmore],[data-ncmp],[data-addpl]')) return; const n = nivs.find(x => x.id === c.dataset.niv); openAvViewer(n.id, App.avTab, () => renderAvancement(root)); });
  $$('[data-nmore]', root).forEach(b => b.onclick = () => avNiveauMenu(p, b.dataset.nmore, () => renderAvancement(root)));
  $$('[data-cell]', root).forEach(c => c.onclick = () => { const [nid, lid] = c.dataset.cell.split('|'); openAvViewer(nid, lid, () => renderAvancement(root)); });
  $$('[data-loc]', root).forEach(c => c.onclick = () => { const [nid, lid, locId] = c.dataset.loc.split('|'); openAvViewer(nid, lid, () => renderAvancement(root), locId); });
  const sh = $('[data-a=avsharetxt]', root); if (sh) sh.onclick = () => shareWhatsApp(avSummaryText(p, nivs, locaux));
  const rp = $('[data-a=avrep]', root); if (rp) rp.onclick = () => avReportDialog({});
}

function avDashboardHTML(p, nivs, locaux) {
  const lots = avLots(p), today = todayISO();
  let pairs = 0, pct = 0, late = 0, soon = 0, fin = 0;
  const lateRows = [], soonRows = [];
  for (const l of locaux) { const n = nivs.find(x => x.id === l.nivId); if (!n) continue;
    for (const lot of lots) { const r = (l.lots || {})[lot.id]; const s = avStatus(r); pairs++; pct += avPct(r); if (avIsDone(s)) fin++;
      if (s === 'late') { late++; lateRows.push({ n, l, lot, r, d: -avDaysTo(r.due) }); }
      if (s === 'soon') { soon++; soonRows.push({ n, l, lot, r, d: avDaysTo(r.due) }); } } }
  lateRows.sort((a, b) => b.d - a.d); soonRows.sort((a, b) => a.d - b.d);
  const row = (x, txt, o) => `<button class="av-lrow" data-loc="${x.n.id}|${x.lot.id}|${x.l.id}"><i style="background:${x.lot.color}"></i><span class="grow"><b>${esc(x.n.name)} · ${esc(x.l.name)}</b><small>${esc(x.lot.name)} · engagement ${fmtDate(x.r.due)}</small></span><em${o ? ' style="color:#fbbf24"' : ''}>${txt}</em></button>`;
  void today;
  return `<div class="av-dash">
    <div class="av-kpis"><div><b>${locaux.filter(l => nivs.some(n => n.id === l.nivId)).length}</b><span>Locaux</span></div><div class="g"><b>${pairs ? Math.round(pct / pairs) : 0}%</b><span>Avancement</span></div>
      <div class="${late ? 'r' : ''}"><b>${late}</b><span>En retard</span></div><div class="${soon ? 'o' : ''}"><b>${soon}</b><span>≤ 7 jours</span></div></div>
    <div class="av-card"><div class="av-h">Avancement par niveau et par lot</div>
      <div class="av-mx-wrap"><table class="av-mx"><tr><th>Niveau</th>${lots.map(l => `<th style="border-bottom:3px solid ${l.color}">${esc(l.name)}</th>`).join('')}</tr>
      ${nivs.map(n => { const locs = locaux.filter(l => l.nivId === n.id); return `<tr><td>${esc(n.name)}<small>${locs.length} loc.</small></td>${lots.map(lot => { const s = avStats(locs, lot.id);
        return `<td data-cell="${n.id}|${lot.id}"><div class="av-cell" style="--p:${s.pct}%;--c:${s.late ? '#ef4444' : s.pct === 100 ? '#22c55e' : lot.color}"><b>${s.n ? s.pct + '%' : '—'}</b>${s.late ? `<small class="r">${s.late} ⚠</small>` : s.soon ? `<small class="o">${s.soon} ⏳</small>` : ''}</div></td>`; }).join('')}</tr>`; }).join('')}</table></div></div>
    <div class="av-card"><div class="av-h">⚠ En retard sur l'engagement <span>${lateRows.length}</span></div>${lateRows.slice(0, 30).map(x => row(x, `${x.d} j`)).join('') || '<div class="muted">Aucun retard 👍</div>'}</div>
    <div class="av-card"><div class="av-h">⏳ Échéances des 7 prochains jours <span>${soonRows.length}</span></div>${soonRows.slice(0, 30).map(x => row(x, x.d === 0 ? "aujourd'hui" : `J-${x.d}`, 1)).join('') || '<div class="muted">Rien à court terme</div>'}</div>
    <div class="av-card"><div class="av-h">Partager</div><div class="btnrow" style="padding:0"><button class="btn ghost" data-a="avsharetxt">${icon('share')} Résumé WhatsApp</button><button class="btn" data-a="avrep">${icon('pdf')} Rapport PDF</button></div></div>
  </div>`;
}

function avSummaryText(p, nivs, locaux) {
  const lots = avLots(p);
  const lines = [`*Avancement — ${p.name}*`, fmtDate(Date.now()), ''];
  for (const n of nivs) { const locs = locaux.filter(l => l.nivId === n.id);
    lines.push(`*${n.name}* (${locs.length} locaux)`);
    for (const lot of lots) { const s = avStats(locs, lot.id); lines.push(`• ${lot.name} : ${s.pct}% · ${s.fin}/${s.n} terminés${s.late ? ` · ⚠ ${s.late} en retard` : ''}`); }
    lines.push(''); }
  return lines.join('\n');
}

// ---------- Niveaux ----------
async function avPickOrImportPlan(p, title = 'Plan du niveau') {
  const v = await menu(title, [{ label: 'Choisir un plan du projet', icon: 'plans', value: 'pick' }, { label: 'Importer un plan (PDF / image / AutoCAD DXF)', icon: 'upload', value: 'imp' }]);
  if (v === 'pick') {
    const plans = (await DB.byProject('plans', p.id)).filter(isCurrentPlan).sort(avNameSort);
    if (!plans.length) { toast('Aucun plan : importez-en un'); return avPickOrImportPlan(p, title); }
    const id = await menu('Choisir le plan', plans.map(x => ({ label: `${x.name} · ind. ${planIndice(x)}`, icon: 'plans', value: x.id })));
    return id ? plans.find(x => x.id === id) : null;
  }
  if (v === 'imp') {
    const [file] = await pickFiles({ accept: '*/*', multiple: false });
    if (!file) return null;
    const ld = loading('Import du plan…');
    try {
      let imgs = await fileToPlanImages(file, p.id, ld);
      if (!imgs.length) return null;
      if (imgs.length > 1) { ld.close(); const pg = await menu('Quelle page du PDF ?', imgs.map((x, i) => ({ label: x.name, value: String(i) }))); if (pg == null) return null; imgs = [imgs[+pg]]; }
      const folders = await DB.byProject('folders', p.id);
      let f = folders.find(x => x.name === 'Plans de niveau (avancement)'); if (!f) f = await DB.put('folders', { projectId: p.id, name: 'Plans de niveau (avancement)' });
      const im = imgs[0];
      return await DB.put('plans', { projectId: p.id, folderId: f.id, fileId: im.fileId, pdfFileId: im.pdfFileId || null, pdfPage: im.pdfPage || null, dxfFileId: im.dxfFileId || null, dwgFileId: im.dwgFileId || null, w: im.w, h: im.h, name: im.name, annotations: [], indice: 'A' });
    } catch (e) { alertBox('Import impossible : ' + (e.message || e)); return null; } finally { ld.close(); }
  }
  return null;
}
async function avAddNiveau(p) {
  const plan = await avPickOrImportPlan(p, 'Ajouter un niveau');
  if (!plan) return false;
  const guess = (String(plan.name).match(/\b(R\s*\+\s*\d+|RDC|SS\s*\d*|Sous[- ]sol\s*\d*|Mezz\w*|Terrasse)\b/i) || [])[1];
  const Z = typeof avZones === 'function' ? avZones(p) : null;
  const r = await formSheet('Nom du niveau', [{ name: 'name', label: 'Niveau', value: guess ? guess.replace(/\s+/g, '').toUpperCase() : plan.name, placeholder: 'Ex : SSL, MEZZ, RDC, R+1…', list: ['SSL', 'SS1', 'MEZZ', 'RDC', 'R+1', 'R+2', 'R+3', 'Terrasse'] },
    ...(Z ? [{ name: 'zone', label: 'Zone', type: 'select', value: App.avF && App.avF.zone || Z[0], options: [...Z.map(z => ({ value: z, label: z })), { value: '__new', label: '➕ Nouvelle zone…' }] }] : [])], { okLabel: 'Ajouter' });
  if (!r || !r.name) return false;
  let zone = r.zone; if (zone === '__new') { const z = await formSheet('Nouvelle zone', [{ name: 'z', label: 'Nom de la zone', value: `Zone ${Z.length + 1}` }], { okLabel: 'Ajouter' }); zone = z && z.z ? z.z.trim() : Z[0]; if (!Z.includes(zone)) Z.push(zone); }
  p.avNiveaux = p.avNiveaux || []; p.avNiveaux.push({ id: DB.uid(), name: r.name, serieId: planSerie(plan), ...(zone ? { zone } : {}) });
  await DB.put('projects', p); toast('Niveau ajouté ✓');
  return true;
}
async function avNiveauMenu(p, nid, done) {
  const n = (p.avNiveaux || []).find(x => x.id === nid); if (!n) return;
  const i = p.avNiveaux.indexOf(n);
  const v = await menu(n.name, [{ label: 'Renommer', icon: 'edit', value: 'ren' }, ...(typeof avZones === 'function' ? [{ label: `Zone : ${avZoneOf(p, n)}`, icon: 'layers', value: 'zone' }] : []), { label: 'Changer de plan', icon: 'plans', value: 'plan' },
    ...(i > 0 ? [{ label: 'Monter', icon: 'chevup', value: 'up' }] : []), ...(i < p.avNiveaux.length - 1 ? [{ label: 'Descendre', icon: 'chevdown', value: 'down' }] : []),
    { label: 'Supprimer le niveau et ses locaux', icon: 'trash', danger: true, value: 'del' }]);
  if (v === 'ren') { const r = await formSheet('Renommer', [{ name: 'name', label: 'Niveau', value: n.name }]); if (r && r.name) n.name = r.name; }
  if (v === 'zone') { const z = await menu('Zone du niveau', avZones(p).map(x => ({ label: x, value: x, checked: avZoneOf(p, n) === x }))); if (z) n.zone = z; }
  if (v === 'plan') { const pl = await avPickOrImportPlan(p, 'Nouveau plan du niveau'); if (pl) { n.serieId = planSerie(pl); toast('Pour une simple mise à jour du même plan, utilisez plutôt « Nouvel indice » (les locaux suivent)'); } }
  if (v === 'up' || v === 'down') { const j = v === 'up' ? i - 1 : i + 1; [p.avNiveaux[i], p.avNiveaux[j]] = [p.avNiveaux[j], p.avNiveaux[i]]; }
  if (v === 'del') { if (!await confirmBox(`Supprimer le niveau ${n.name} et tous ses locaux (le plan reste dans Plans) ?`)) return;
    for (const l of (await DB.byProject('links', p.id)).filter(l => l.kind === 'local' && l.nivId === n.id)) { for (const r of Object.values(l.lots || {})) for (const id of r.photos || []) await DB.del('files', id); await DB.del('links', l.id); }
    p.avNiveaux = p.avNiveaux.filter(x => x.id !== n.id); }
  if (v) { await DB.put('projects', p); done && done(); }
}

// ---------- Lots & réglages ----------
async function avSettings(root) {
  const p = App.project; avLots(p);
  const v = await menu('Avancement — réglages', [
    ...p.lots.map(l => ({ label: `Lot : ${l.name}`, swatch: l.color, value: 'lot:' + l.id })),
    { label: 'Ajouter un lot (ex : Carrelage, Peinture…)', icon: 'plus', value: 'add' },
    ...(typeof avZones === 'function' ? [{ label: `Zones (${avZones(p).join(', ')})`, icon: 'layers', value: 'zones' }, { label: `Équipes & responsables (${avTeams(p).length})`, icon: 'team', value: 'teams' },
      { label: 'Étapes photo du local', icon: 'camera', value: 'etapes' }, { label: 'Types de chape (couleurs)', icon: 'fill', value: 'chapes' },
      ...(typeof avLocTypes === 'function' ? [{ label: 'Types de local (code couleur)', icon: 'fill', value: 'ltypes' }, { label: `Secteurs (${avSecteurs(p).join(', ') || 'aucun'})`, icon: 'layers', value: 'sect' }] : [])] : []),
    { label: 'En-tête des rapports (société, logo)', icon: 'report', value: 'head' },
  ]);
  if (!v) return;
  if (v === 'add') { const r = await formSheet('Nouveau lot', [{ name: 'name', label: 'Nom du lot', placeholder: 'Ex : Carrelage' }], { okLabel: 'Ajouter' }); if (r && r.name) p.lots.push({ id: DB.uid(), name: r.name, color: AV_LOT_COLORS[p.lots.length % AV_LOT_COLORS.length] }); }
  if (v === 'head') await avHeaderSettings(p);
  if (v === 'zones') await avListEdit(p, 'zone');
  if (v === 'teams') await avTeamsMenu(p);
  if (v === 'etapes') await avListEdit(p, 'etape');
  if (v === 'chapes') await avListEdit(p, 'chape');
  if (v === 'ltypes') await avListEdit(p, 'ltype');
  if (v === 'sect') await avSecteursEdit(p);
  if (v.startsWith('lot:')) {
    const lot = p.lots.find(l => 'lot:' + l.id === v), i = p.lots.indexOf(lot);
    const a = await menu(lot.name, [{ label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Couleur', icon: 'fill', value: 'col' }, ...(i > 0 ? [{ label: 'Monter', icon: 'chevup', value: 'up' }] : []), { label: 'Supprimer le lot', icon: 'trash', danger: true, value: 'del' }]);
    if (a === 'ren') { const r = await formSheet('Renommer le lot', [{ name: 'name', label: 'Nom', value: lot.name }]); if (r && r.name) lot.name = r.name; }
    if (a === 'col') { const c = await menu('Couleur', AV_LOT_COLORS.map(x => ({ label: x, swatch: x, value: x, checked: lot.color === x }))); if (c) lot.color = c; }
    if (a === 'up') { [p.lots[i - 1], p.lots[i]] = [p.lots[i], p.lots[i - 1]]; }
    if (a === 'del' && await confirmBox(`Supprimer le lot ${lot.name} ? (les données de ce lot sont retirées des locaux)`)) {
      for (const l of (await DB.byProject('links', p.id)).filter(l => l.kind === 'local' && l.lots && l.lots[lot.id])) { for (const id of l.lots[lot.id].photos || []) await DB.del('files', id); delete l.lots[lot.id]; await DB.put('links', l); }
      p.lots = p.lots.filter(x => x !== lot); p.avLotSkip = [...new Set([...(p.avLotSkip || []), normQ(lot.name)])]; }
  }
  await DB.put('projects', p); renderAvancement(root);
}
async function avHeaderSettings(p) {
  const h = p.reportHead || {};
  const v = await menu('En-tête des rapports PDF', [{ label: `Société / entreprise : ${h.company || '—'}`, icon: 'edit', value: 'co' }, { label: `Sous-titre (ex : lot, marché) : ${h.sub || '—'}`, icon: 'edit', value: 'sub' },
    { label: h.logoId ? 'Changer le logo' : 'Ajouter un logo', icon: 'image', value: 'logo' }, ...(h.logoId ? [{ label: 'Retirer le logo', icon: 'trash', danger: true, value: 'nologo' }] : [])]);
  if (v === 'co' || v === 'sub') { const r = await formSheet('En-tête', [{ name: 'x', label: v === 'co' ? 'Société / entreprise' : 'Sous-titre', value: h[v === 'co' ? 'company' : 'sub'] || '' }]); if (r) h[v === 'co' ? 'company' : 'sub'] = r.x; }
  if (v === 'logo') { const [f] = await pickFiles({ accept: 'image/*', multiple: false }); if (f) { const rec = await saveImageFile(p.id, f, 'logo'); h.logoId = rec.id; } }
  if (v === 'nologo') h.logoId = null;
  p.reportHead = h;
}

// ---------- Visionneuse d'un niveau (locaux colorés selon l'état du lot) ----------
async function openAvViewer(nivId, lotId, onClose, focusLocId) {
  const p = App.project; avLots(p);
  const niv = (p.avNiveaux || []).find(n => n.id === nivId); if (!niv) return;
  let plan = await latestPlanOfSerie(p.id, niv.serieId);
  if (!plan) return alertBox('Le plan de ce niveau est introuvable (supprimé ?). Utilisez « Changer de plan ».');
  if (!lotId || lotId === 'dash' || !p.lots.find(l => l.id === lotId)) lotId = p.lots[0].id;
  const st = { lot: lotId, add: false, moving: null, locs: [], filter: null, zdraw: null, anep: false, anepL: null, sel: null, lasso: null };
  // v1.0.47 : plan affiché = plan du lot sur ce niveau (maçonnerie, chape…) ; les pins restent ceux du niveau, recalés (auto ou 2 points)
  let vplan = plan, VM = null, VMi = null;   // VM : pixel du plan de base → pixel du plan affiché
  const T = (x, y) => VM ? avApply(VM, x, y) : [x, y], Ti = (x, y) => VMi ? avApply(VMi, x, y) : [x, y];
  async function setView(lid) {
    vplan = plan; VM = VMi = null;
    if (typeof avLotPlan !== 'function') return;
    try { const L = await avLotPlan(p, niv, lid); if (L && L.plan && L.id !== 'main' && L.plan.id !== plan.id) { const C = await avPairMatrix(p, niv, { serieId: niv.serieId, plan }, { serieId: L.serieId, plan: L.plan }); vplan = L.plan; VMi = C.m; VM = avInv(C.m); } } catch (e) { console.warn('vue lot', e); vplan = plan; VM = VMi = null; }
  }
  const el = document.createElement('div'); el.className = 'fullpage av-page';
  document.body.appendChild(el);
  let pz = null;
  const teardown = () => { el.remove(); onClose && onClose(); };
  const unBack = pushBack(teardown);
  const close = () => { unBack(); teardown(); };

  async function load() { st.locs = (await DB.byProject('links', p.id)).filter(l => l.kind === 'local' && l.nivId === niv.id).sort(avNameSort); st.res = new Set(typeof avOpenReserves === 'function' ? (await avOpenReserves(p)).map(t => t.localId) : []); }
  async function build() {
    if (typeof planNeedsHeal === 'function' && planNeedsHeal(vplan)) { const hp = vplan; planHeal(hp).then(async ok => { if (ok && el.isConnected && vplan === hp) { const im = $('.av-stage > img', el); if (im) { BlobURL.drop(hp.fileId); im.src = await fileURL(hp.fileId); } toast('Plan A0 : image complète ✓'); } }); }
    const src = await fileURL(vplan.fileId), W = vplan.w, H = vplan.h;
    const vl = vplan !== plan ? avLot(p, st.lot) : null;
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button>
        <div class="tb-title" style="flex:1"><b>${esc(niv.name)}${vl ? ` · <span style="color:${vl.color}">${esc(vl.name)}</span>` : ''}</b><span>${esc(vplan.name)} · ind. ${esc(planIndice(vplan))}</span></div>
        ${typeof avComparePlans === 'function' ? `<button class="iconbtn" data-a="cmpq" title="Comparer deux plans">${icon('swap')}</button>` : ''}
        ${typeof avNivPlansMenu === 'function' ? `<button class="iconbtn" data-a="plans" title="Plans, zones, import">${icon('layers')}</button>` : ''}
        <button class="iconbtn" data-a="ind" title="Indices du plan">${icon('history')}</button>
        <button class="iconbtn" data-a="share" title="Partager">${icon('share')}</button>
        <button class="iconbtn" data-a="more">${icon('more')}</button></div>
      <div class="av-chips lots"></div>
      <div class="av-view"><div class="av-stage"><img src="${src}" width="${W}" height="${H}"><svg class="av-ov" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"></svg></div><div class="av-hint"></div></div>
      <div class="av-bottom"><div class="av-legend"></div><button class="btn small ghost av-selbtn" data-a="sel" title="Sélection de plusieurs pins">${icon('check')}</button><button class="btn small av-addbtn" data-a="add">${icon('plus')} Pin</button></div>`;
    $('[data-a=x]', el).onclick = close;
    const cq = $('[data-a=cmpq]', el); if (cq) cq.onclick = () => avCompareQuick(p, niv, st.lot);
    $('[data-a=sel]', el).onclick = () => { st.sel = st.sel ? null : new Set(); st.add = false; st.moving = null; st.lasso = null; drawUI(); };
    $('[data-a=add]', el).onclick = async () => { if (st.zdraw) return finishZone(); st.add = !st.add; st.moving = null; drawUI(); };
    $('[data-a=share]', el).onclick = shareMenu;
    const plb = $('[data-a=plans]', el); if (plb) plb.onclick = plansMenu;
    $('[data-a=more]', el).onclick = moreMenu;
    $('[data-a=ind]', el).onclick = () => planIndicesMenu(plan, { onNew: async (np) => { plan = np; await load(); await setView(st.lot); await build(); }, onOpen: (old) => openPlanViewer(old, planCtx(() => {})) });
    pz = panZoom($('.av-view', el), $('.av-stage', el), W, H, { onTap, onChange: drawMarkers });
    requestAnimationFrame(() => { pz.fit(); if (focusLocId) { const l = st.locs.find(x => x.id === focusLocId); if (l) { const [fx, fy] = T(l.x, l.y); pz.zoomTo(fx - 60, fy - 60, 120, 120); setTimeout(() => openAvLocal(l, st.lot, refresh), 250); } focusLocId = null; } });
    drawUI();
  }
  const lotObj = () => avLot(p, st.lot);
  function drawUI() {
    $('.av-chips.lots', el).innerHTML = p.lots.map(l => { const s = avStats(st.locs, l.id); return `<button data-l="${l.id}" class="${st.lot === l.id ? 'on' : ''}" style="--c:${l.color}"><i></i>${esc(l.name)} <small>${s.pct}%</small></button>`; }).join('');
    $$('.av-chips.lots [data-l]', el).forEach(b => b.onclick = async () => { st.lot = b.dataset.l; st.filter = null; const old = vplan; await setView(st.lot); if (vplan !== old) await build(); else drawUI(); });
    const s = avStats(st.locs, st.lot);
    const sb = $('[data-a=sel]', el); if (sb) sb.classList.toggle('on', !!st.sel);
    if (st.sel) { avSelBar(el, p, niv, st, { T, pz, redraw: drawUI, refresh }); drawMarkers(); return; }
    if (st.two) { const [la, lb] = st.two.map(id => avLot(p, id)), done = (id) => st.locs.filter(l => avIsDone(avStatus((l.lots || {})[id]))).length, gap = st.locs.filter(l => avIsDone(avStatus((l.lots || {})[la.id])) && avStatus((l.lots || {})[lb.id]) === 'todo').length;
      $('.av-legend', el).innerHTML = `<span class="avt-l"><b style="color:${la.color}">◐ ${esc(la.name)}</b> ${done(la.id)}/${st.locs.length} · <b style="color:${lb.color}">◑ ${esc(lb.name)}</b> ${done(lb.id)}/${st.locs.length}${gap ? ` · <em>${gap} prêt(s) pour ${esc(lb.name)}</em>` : ''}</span><button data-a="twoimg">${icon('share')} Image</button>`;
      $('[data-a=twoimg]', el).onclick = async () => { const ld = loading('Préparation de l\'image…'); try { const c = await avTwoLotsImage(p, plan, st.locs, la, lb, `${niv.name} — ${la.name} / ${lb.name}`); const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9)); ld.close(); await shareBlob(b, avFileName(`${p.name} ${niv.name} ${la.name}-${lb.name}`) + '.jpg'); } catch (e) { ld.close(); alertBox(e.message || String(e)); } };
      const ab2 = $('[data-a=add]', el); ab2.classList.toggle('on', !!st.add); drawMarkers(); return; }
    $('.av-legend', el).innerHTML = Object.entries(AV_ST).filter(([k]) => s[k]).map(([k, [l, c]]) => `<button data-f="${k}" class="${st.filter === k ? 'on' : ''}"><i style="background:${c}"></i>${s[k]} ${l}</button>`).join('') || `<span class="muted">Touchez « + Pin » puis le plan pour placer les locaux</span>`;
    $$('.av-legend [data-f]', el).forEach(b => b.onclick = () => { st.filter = st.filter === b.dataset.f ? null : b.dataset.f; drawUI(); });
    const ab = $('[data-a=add]', el); ab.classList.toggle('on', st.add || !!st.zdraw); ab.innerHTML = st.zdraw ? `${icon('check')} Terminer la zone` : st.add ? `${icon('check')} Terminer` : `${icon('plus')} Pin`;
    const hint = $('.av-hint', el);
    hint.textContent = st.zhint ? st.zhint : st.zdraw ? `Zone : touchez les coins (${st.zdraw.length} point(s)), puis « Terminer la zone »` : st.moving ? `Touchez la nouvelle position de « ${st.moving.name} »` : st.add ? 'Touchez le plan pour placer un pin (plusieurs à la suite)' : '';
    hint.style.display = hint.textContent ? '' : 'none';
    drawMarkers();
  }
  function drawMarkers() {
    if (!pz) return;
    const TD = todayISO(), s = pz.st.s, R = 11 / s, showLbl = s / pz.st.fit > 1.6 || st.locs.length <= 25;
    const ZC = ['#2563eb', '#0d9488', '#7c3aed', '#ea580c', '#db2777', '#16a34a', '#0891b2', '#b45309'], zc = (z) => ZC[Math.abs([...String(z)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % ZC.length];
    const polys = (st.zprev ? st.zprev.polys : null) || (niv.zonePolys || []);
    const zonesSvg = polys.map(z0 => { const z = { ...z0, pts: z0.pts.map(q => T(q[0], q[1])) }, tl = z0.lp ? T(z0.lp[0], z0.lp[1]) : z.pts.slice().sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]))[0], cx = tl[0] + (z0.lp ? 0 : 8 / s), cy = tl[1] + (z0.lp ? 0 : 20 / s);   // nom de la zone dans son coin (ou au milieu du secteur), sans masquer les pins
      return `<polygon points="${z.pts.map(q => q.join(',')).join(' ')}" fill="${zc(z.zone)}" fill-opacity=".10" stroke="${zc(z.zone)}" stroke-width="${2 / s}" stroke-dasharray="${8 / s} ${5 / s}"/><text x="${cx}" y="${cy}" text-anchor="${z0.lp ? 'middle' : 'start'}" font-size="${(z0.lp ? 20 : 16) / s}" font-weight="800" fill="${zc(z.zone)}" font-family="Arial" paint-order="stroke" stroke="#fff" stroke-width="${4 / s}">${esc(z.zone)}</text>`; }).join('');
    const zd = (st.zdraw || []).map(q => T(q[0], q[1])), drawSvg = zd.length ? `<polyline points="${zd.map(q => q.join(',')).join(' ')}" fill="rgba(37,99,235,.12)" stroke="#2563eb" stroke-width="${2.5 / s}"/>${zd.map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="${5 / s}" fill="#2563eb"/>`).join('')}` : '';
    const anepSvg = st.anep && st.anepL ? st.anepL.map(t => { const [ax, ay] = T(t.x, t.y); return `<text x="${ax}" y="${ay}" text-anchor="middle" font-size="${Math.max(t.h, 9 / s)}" font-weight="700" fill="#1d4ed8" font-family="Arial" paint-order="stroke" stroke="#fff" stroke-width="${2.5 / s}">${esc(t.s)}</text>`; }).join('') : '';
    const LT = typeof avLocTypes === 'function' ? avLocTypes(p) : [];
    $('.av-ov', el).innerHTML = zonesSvg + anepSvg + drawSvg + st.locs.map(l => {
      const ltc = l.ltype && (LT.find(t => t.id === l.ltype) || {}).color;
      const k = avStatus((l.lots || {})[st.lot]), c = AV_ST[k][1], dim = st.filter && st.filter !== k, [px, py] = T(l.x, l.y), sel = st.sel && st.sel.has(l.id);
      return `<g transform="translate(${px},${py})" opacity="${dim ? 0.2 : 1}">
        ${sel ? `<circle r="${R * 2}" fill="#facc15" fill-opacity=".35" stroke="#facc15" stroke-width="${3 / s}"/>` : ''}
        ${l.checkIndice ? `<circle r="${R * 1.7}" fill="none" stroke="#f59e0b" stroke-width="${2.5 / s}" stroke-dasharray="${4 / s} ${3 / s}"/>` : ''}
        ${ltc ? `<circle r="${R * 1.45}" fill="none" stroke="${ltc}" stroke-width="${3.5 / s}"/>` : ''}
        ${st.two ? (() => { const [la, lb] = st.two.map(id => avLot(p, id)), ca = AV_ST[avStatus((l.lots || {})[la.id])][1], cb = AV_ST[avStatus((l.lots || {})[lb.id])][1];
          return `<path d="M0,${-R} A${R},${R} 0 0 0 0,${R} Z" fill="${ca}"/><path d="M0,${-R} A${R},${R} 0 0 1 0,${R} Z" fill="${cb}"/><circle r="${R}" fill="none" stroke="#fff" stroke-width="${2.5 / s}"/><line y1="${-R}" y2="${R}" stroke="#fff" stroke-width="${2 / s}"/>`; })() : l.type === 'travail' ? `<rect x="${-R}" y="${-R * 0.75}" width="${R * 2}" height="${R * 1.5}" rx="${R * 0.3}" fill="${c}" stroke="#fff" stroke-width="${2.5 / s}"/>` : `<circle r="${R}" fill="${c}" stroke="#fff" stroke-width="${2.5 / s}"/>`}
        ${(l.journal || []).some(e => e.d === TD) ? `<circle cx="${R * 0.85}" cy="${-R * 0.85}" r="${R * 0.38}" fill="#f59e0b" stroke="#fff" stroke-width="${1.5 / s}"/>` : ''}
        ${st.res && st.res.has(l.id) ? `<text x="${-R * 1.25}" y="${-R * 0.6}" font-size="${R * 1.1}" text-anchor="middle">⚠️</text>` : ''}
        ${avIsDone(k) ? `<path d="M${-R * 0.45},0 L${-R * 0.1},${R * 0.38} L${R * 0.5},${-R * 0.35}" fill="none" stroke="#fff" stroke-width="${2.6 / s}" stroke-linecap="round"/>` : k === 'late' ? `<text y="${R * 0.42}" text-anchor="middle" font-size="${R * 1.3}" font-weight="700" fill="#fff" font-family="Arial">!</text>` : ''}
        ${showLbl ? `<text y="${R * 2.4}" text-anchor="middle" font-size="${12 / s}" font-weight="700" fill="#111" font-family="Arial" paint-order="stroke" stroke="#fff" stroke-width="${3.5 / s}">${esc(l.name)}${l.anep ? ' · ' + esc(l.anep) : ''}</text>` : ''}</g>`;
    }).join('');
  }
  async function refresh() { await load(); if (el.isConnected) drawUI(); }
  async function onTap([vx, vy]) {
    const out = vx < 0 || vy < 0 || vx > vplan.w || vy > vplan.h, [x, y] = Ti(vx, vy);
    if (st.zpick) return st.zpick([x, y], out);
    if (st.sel) { const tol0 = 26 / pz.st.s; let b0 = null, d0 = 1e9; for (const l of st.locs) { const [px, py] = T(l.x, l.y), d = Math.hypot(px - vx, py - vy); if (d < tol0 && d < d0) { d0 = d; b0 = l; } } if (b0) { st.sel.has(b0.id) ? st.sel.delete(b0.id) : st.sel.add(b0.id); drawUI(); } return; }
    if (st.zdraw) { if (!out) { st.zdraw.push([Math.round(x), Math.round(y)]); drawUI(); } return; }
    if (st.moving && !out) { const l = st.moving; l.x = x; l.y = y; delete l.checkIndice; await DB.put('links', l); st.moving = null; toast('Local déplacé ✓'); return refresh(); }
    if (st.add && !out) {
      const lot = lotObj();
      const r = await formSheet('Nouveau pin', [{ name: 'type', label: 'Type', type: 'select', value: st.lastType || 'local', options: [{ value: 'local', label: '● Local technique (n° ANEP, étapes, photos)' }, { value: 'travail', label: '▭ Zone de travail (façade, couloir, gaine…)' }] },
        { name: 'name', label: 'Nom / numéro', placeholder: 'Ex : LT 12, Local TGBT, Couloir B…', value: avNextName(st.locs) },
        { name: 'due', label: `Engagement ${lot.name} (date limite) — optionnel`, type: 'date' }], { okLabel: 'Placer' });
      if (!r || !r.name) return;
      st.lastType = r.type;
      const loc = { projectId: p.id, planId: plan.id, nivId: niv.id, kind: 'local', shape: 'point', x, y, name: r.name, lots: {}, items: [], ...(r.type === 'travail' ? { type: 'travail' } : {}) };
      if (typeof avZoneAt === 'function') { const z = avZoneAt(niv, x, y); if (z) loc.zone = z; }
      if (r.due) loc.lots[lot.id] = { state: 'todo', due: r.due, photos: [] };
      await DB.put('links', loc); return refresh();
    }
    // toucher un local (tolérance ~ 24 px à l'écran)
    const tol = 24 / pz.st.s; let best = null, bd = 1e9;
    for (const l of st.locs) { const [px, py] = T(l.x, l.y), d = Math.hypot(px - vx, py - vy); if (d < tol && d < bd) { bd = d; best = l; } }
    if (best) openAvLocal(best, st.lot, refresh, { onMove: (l) => { st.moving = l; st.add = false; drawUI(); } });
  }
  // v1.0.46 : plans du niveau, zones (joints) dessinées, import des locaux du PDF, calque ANEP, comparaison
  async function plansMenu() {
    const hasAnep = (niv.plans || []).some(x => x.kind === 'anep');
    const v = await menu(`${niv.name} — plans & zones`, [
      ...(typeof avAutoZones === 'function' ? [{ label: '✨ Zones automatiques (axes des joints JD)', icon: 'zone', value: 'auto' }] : []),
      { label: 'Dessiner une zone (joint) sur le plan', icon: 'zone', value: 'zone' },
      ...((niv.zonePolys || []).length ? [{ label: `Zones dessinées (${niv.zonePolys.length})…`, icon: 'layers', value: 'zones' }] : []),
      { label: 'Importer les locaux du plan (textes du PDF)', icon: 'upload', value: 'imp' },
      { label: 'Plans du niveau (ANEP, chape, maçonnerie…)', icon: 'plans', value: 'plans' },
      { label: 'Comparer deux lots (plans calés)', icon: 'swap', value: 'cmpl' },
      { label: 'Comparer deux plans du niveau', icon: 'swap', value: 'cmp' },
      { label: st.two ? 'Arrêter la comparaison d\'avancement' : 'Avancement de deux lots (pins coupés en deux)', icon: 'layers', value: 'two' },
      ...(hasAnep ? [{ label: st.anep ? 'Masquer la numérotation ANEP' : 'Afficher la numérotation ANEP', icon: 'eye', value: 'anep' }, { label: 'Donner aux pins leur numéro ANEP', icon: 'edit', value: 'anepPins' }] : []),
      { label: 'Secteurs et zones…', icon: 'settings', value: 'sect' },
    ]);
    if (v === 'auto') return avAutoZones(p, niv, plan, { st, el, redraw: drawUI, refresh, pz, T });
    if (v === 'zone') { st.zdraw = []; st.add = false; st.moving = null; drawUI(); toast('Touchez les coins de la zone sur le plan'); }
    if (v === 'zones') { if (typeof avZonesManage === 'function') { await avZonesManage(p, niv); await refresh(); return; } const i = await menu('Zones dessinées', niv.zonePolys.map((z, k) => ({ label: `${z.zone} (${z.pts.length} points)`, icon: 'trash', danger: true, value: String(k) }))); if (i != null && await confirmBox(`Effacer le dessin de la zone « ${niv.zonePolys[+i].zone} » ? (les pins gardent leur zone)`)) { niv.zonePolys.splice(+i, 1); await DB.put('projects', p); drawUI(); } }
    if (v === 'imp') { const n = await avImportLocaux(p, niv, plan); if (n) await refresh(); }
    if (v === 'plans') await avNivPlansMenu(p, niv);
    if (v === 'cmp') avComparePlans(p, niv);
    if (v === 'cmpl') avCompareLots(p, niv);
    if (v === 'two') { if (st.two) st.two = null; else { const a = await menu('Lot de gauche ◐', p.lots.map(l => ({ label: l.name, swatch: l.color, value: l.id }))); if (!a) return; const b = await menu('Lot de droite ◑', p.lots.filter(l => l.id !== a).map(l => ({ label: l.name, swatch: l.color, value: l.id }))); if (!b) return; st.two = [a, b]; } drawUI(); }
    if (v === 'anep') { st.anep = !st.anep; if (st.anep && !st.anepL) { const ld = loading('Lecture de la numérotation ANEP…'); try { st.anepL = await avAnepLabels(p, niv, plan) || []; } finally { ld.close(); } if (!st.anepL.length) toast('Aucune numérotation propre au plan ANEP trouvée'); } drawUI(); }
    if (v === 'anepPins') { await avAnepToPins(p, niv, plan); await refresh(); }
    if (v === 'sect') { await avSecteursEdit(p); drawUI(); }
  }
  async function finishZone() {
    const pts = st.zdraw; st.zdraw = null;
    if (!pts || pts.length < 3) { toast('Il faut au moins 3 points'); return drawUI(); }
    const Z = avZones(p), lab = (z) => avSectOf(p, z) ? `${avSectOf(p, z)} · ${z}` : z;
    let z = await menu('Cette zone s\'appelle…', [...Z.map(x => ({ label: lab(x), icon: 'layers', value: x })), { label: '➕ Nouvelle zone (ex : Joint 3)…', value: '__new' }]);
    if (z === '__new') { const r = await formSheet('Nouvelle zone', [{ name: 'z', label: 'Nom', value: `Zone ${Z.length + 1}`, placeholder: 'Ex : Zone 3, Joint 3 (JD03 → JD04)' }, ...(avSecteurs(p).length ? [{ name: 's', label: 'Secteur', type: 'select', options: [{ value: '', label: '—' }, ...avSecteurs(p).map(x => ({ value: x, label: x }))] }] : [])], { okLabel: 'Créer' });
      z = r && r.z ? r.z.trim() : null; if (z && !Z.includes(z)) Z.push(z); if (z && r.s) { p.avZoneSect = p.avZoneSect || {}; p.avZoneSect[z] = r.s; } }
    if (!z) return drawUI();
    niv.zonePolys = niv.zonePolys || []; niv.zonePolys.push({ zone: z, pts });
    await DB.put('projects', p); const n = await avAssignZones(p, niv); await refresh();
    toast(`Zone « ${z} » enregistrée · ${n} pin(s) rattaché(s) ✓`);
    if ((p.avNiveaux || []).length > 1 && await confirmBox(`Recopier cette zone sur les autres niveaux (même cadrage de plan) ?`, 'Recopier')) {
      for (const o of p.avNiveaux) if (o.id !== niv.id) { o.zonePolys = (o.zonePolys || []).filter(q => q.zone !== z); o.zonePolys.push({ zone: z, pts: pts.map(q => q.slice()) }); await avAssignZones(p, o); }
      await DB.put('projects', p); toast('Zone recopiée sur les autres niveaux ✓');
    }
  }
  async function shareMenu() {
    const lot = lotObj();
    const v = await menu(`Partager — ${niv.name} · ${lot.name}`, [
      { label: 'Image du plan coloré (WhatsApp…)', icon: 'image', value: 'img' },
      { label: 'Rapport PDF (plan + photos + dates)', icon: 'pdf', value: 'pdf' },
      { label: 'Rapport PDF — tous les lots de ce niveau', icon: 'pdf', value: 'pdfall' },
    ]);
    if (v === 'img') { const ld = loading('Préparation de l\'image…'); try { const c = await avPlanCanvas(p, plan, st.locs, lot, { title: `${niv.name} — ${lot.name}`, maxSide: 3000 }); const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9)); ld.close(); await shareBlob(b, avFileName(`${p.name} ${niv.name} ${lot.name}`) + '.jpg'); } catch (e) { ld.close(); alertBox(e.message || String(e)); } }
    if (v === 'pdf') avReportDialog({ nivId: niv.id, lotId: lot.id });
    if (v === 'pdfall') avReportDialog({ nivId: niv.id, lotId: '__all' });
  }
  async function moreMenu() {
    const lot = lotObj();
    const v = await menu(`${niv.name} · ${lot.name}`, [
      { label: `Engagement ${lot.name} pour tous les locaux du niveau`, icon: 'calendar', value: 'bulk' },
      { label: 'Mettre à jour le plan (nouvel indice)', icon: 'upload', value: 'ind' },
      { label: 'Ouvrir le plan complet (pins, dessins…)', icon: 'plans', value: 'open' },
      { label: 'Ajuster à l\'écran', icon: 'expand', value: 'fit' },
    ]);
    if (v === 'fit') pz.fit();
    if (v === 'open') openPlanViewer(plan, planCtx(() => {}));
    if (v === 'ind') { const np = await newPlanIndice(plan); if (np) { plan = np; await load(); await setView(st.lot); await build(); } }
    if (v === 'bulk') {
      if (!st.locs.length) return toast('Aucun local sur ce niveau');
      const r = await formSheet(`Engagement ${lot.name} — ${niv.name}`, [{ name: 'due', label: 'Date limite (engagement maître d\'ouvrage)', type: 'date' },
        { name: 'all', label: 'Appliquer à', type: 'select', value: 'empty', options: [{ value: 'empty', label: 'Locaux sans date seulement' }, { value: 'all', label: 'Tous les locaux (remplace les dates)' }] }], { okLabel: 'Appliquer' });
      if (!r || !r.due) return;
      let n = 0; for (const l of st.locs) { l.lots = l.lots || {}; const rr = l.lots[lot.id] = l.lots[lot.id] || { state: 'todo', photos: [] }; if (r.all === 'all' || !rr.due) { rr.due = r.due; n++; await DB.put('links', l); } }
      toast(`${n} local(aux) mis à jour ✓`); refresh();
    }
  }
  await load(); await setView(st.lot); await build();
}
function avNextName(locs) { const last = locs.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]; if (!last) return ''; const m = String(last.name).match(/^(.*?)(\d+)(\D*)$/); return m ? m[1] + (+m[2] + 1) + m[3] : ''; }
const avFileName = (s) => String(s).replace(/[\\/:*?"<>|#]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90);

// ---------- Fiche d'un local ----------
function openAvLocal(loc, lotId, onChange, { onMove } = {}) {
  const p = App.project; avLots(p);
  let cur = lotId; loc.lots = loc.lots || {};
  const niv = (p.avNiveaux || []).find(n => n.id === loc.nivId) || { name: '' };
  let saveT = null;
  const save = (now) => { clearTimeout(saveT); const go = async () => { await DB.put('links', loc); onChange && onChange(); }; if (now) return go(); saveT = setTimeout(go, 400); };
  const s = sheet('<div class="av-loc"></div>', { title: `${loc.name}${niv.name ? ' · ' + niv.name : ''}` });
  s.onClose = () => { if (saveT) { clearTimeout(saveT); DB.put('links', loc).then(() => onChange && onChange()); } };
  const box = $('.av-loc', s.el);
  let mode = 'lot';
  async function render() {
    if (mode !== 'lot' && typeof avEtapesHTML === 'function') return renderX();
    const r = loc.lots[cur] = loc.lots[cur] || { state: 'todo', photos: [] }; r.photos = r.photos || [];
    const k = avStatus(r), files = await loadFiles(r.photos);
    const dueTxt = r.due ? (avIsDone(k) ? '' : avDaysTo(r.due) < 0 ? ` · en retard de ${-avDaysTo(r.due)} j` : avDaysTo(r.due) === 0 ? " · aujourd'hui" : ` · dans ${avDaysTo(r.due)} j`) : '';
    box.innerHTML = `
      ${loc.checkIndice ? `<div class="av-warn">⚠ Zone modifiée à l'indice ${esc(loc.checkIndice)} : vérifiez la position du local.<div><button class="btn small ghost" data-a="okpos">Position OK</button><button class="btn small" data-a="move2">Déplacer</button></div></div>` : ''}
      ${typeof avEtapesHTML === 'function' ? modeBar() : ''}
      <div class="av-lt">${p.lots.map(l => { const kk = avStatus(loc.lots[l.id]); return `<button data-lt="${l.id}" class="${cur === l.id ? 'on' : ''}" style="--c:${l.color}">${esc(l.name)}<i style="background:${AV_ST[kk][1]}"></i></button>`; }).join('')}</div>
      <div class="av-badge" style="--c:${AV_ST[k][1]}">${k === 'late' ? `En retard de ${-avDaysTo(r.due)} j` : AV_ST[k][0] + dueTxt}</div>
      <div class="form">
        <label>État<div class="av-seg">${AV_STATES.map(([v, l, c]) => `<button data-st="${v}" class="${r.state === v || (!r.state && v === 'todo') ? 'on' : ''}" style="--c:${c}">${l}</button>`).join('')}</div></label>
        ${r.state === 'progress' ? `<label>Avancement : <b data-pctv>${+r.pct || 50}%</b><input type="range" min="10" max="90" step="10" value="${+r.pct || 50}" data-in="pct"></label>` : ''}
        <label>Quantité totale du local (le % se calcule à la saisie)<span class="avq"><input type="number" inputmode="decimal" value="${esc(r.qtot || '')}" placeholder="${esc(loc.area || 'Ex : 120')}" data-in="qtot"><select data-in="unit">${(typeof AV_UNITS !== 'undefined' ? AV_UNITS : ['m²']).map(u => `<option ${u === (r.unit || 'm²') ? 'selected' : ''}>${u}</option>`).join('')}</select></span>${typeof avQtyTxt === 'function' && avQtyTxt(loc, cur) ? `<small class="avq-t">Fait : ${esc(avQtyTxt(loc, cur))}</small>` : ''}</label>
        <label>Engagement maître d'ouvrage (date limite)<input type="date" value="${esc(r.due || '')}" data-in="due"></label>
        ${r.state === 'done' ? `<label>Date de fin réelle<input type="date" value="${esc(r.doneAt || '')}" data-in="doneAt"></label>` : ''}
        <label>Observations<textarea data-in="obs" placeholder="Remarques, réserves, entreprise…">${esc(r.obs || '')}</textarea></label>
        <label>Photos (${files.length})</label>${thumbsHTML(files)}
      </div>
      <div class="btnrow wrap"><button class="btn ghost small" data-a="ren">${icon('edit')} Renommer</button><button class="btn ghost small" data-a="move">${icon('move')} Déplacer</button>
        <button class="btn ghost small" data-a="pdf">${icon('pdf')} PDF</button><button class="btn ghost small" data-a="res">⚠️ Réserve</button><button class="btn danger small" data-a="del">${icon('trash')}</button></div>`;
    $$('[data-lt]', box).forEach(b => b.onclick = () => { cur = b.dataset.lt; render(); });
    bindMode();
    $$('[data-st]', box).forEach(b => b.onclick = () => { r.state = b.dataset.st; if (r.state === 'done' && !r.doneAt) r.doneAt = todayISO(); if (r.state !== 'done') delete r.doneAt; save(true); render(); });
    $$('[data-in]', box).forEach(i => i.oninput = i.onchange = () => { r[i.dataset.in] = i.dataset.in === 'pct' || i.dataset.in === 'qtot' ? (i.value === '' ? '' : +i.value) : i.value; if (i.dataset.in === 'pct') $('[data-pctv]', box).textContent = i.value + '%'; save(); if (i.type === 'date') { save(true); render(); } });
    const add = $('[data-a=addphoto]', box); if (add) add.onclick = async () => { const fs = await addPhotos(p.id, { local: loc.id, lot: cur }); if (fs.length) { r.photos.push(...fs.map(f => f.id)); await save(true); render(); } };
    $$('.thumbs .t[data-id]', box).forEach(t => t.onclick = (e) => { if (e.target.closest('[data-del]')) return; const i = files.findIndex(f => f.id === t.dataset.id); showGallery(files.map(f => ({ src: BlobURL.get(f.id, f.blob), caption: `${loc.name} · ${avLot(p, cur).name} · ${fmtDateTime(f.createdAt)}` })), i); });
    $$('[data-del]', box).forEach(b => b.onclick = async (e) => { e.stopPropagation(); if (!await confirmBox('Supprimer cette photo ?')) return; r.photos = r.photos.filter(x => x !== b.dataset.del); await DB.del('files', b.dataset.del); await save(true); render(); });
    $('[data-a=ren]', box).onclick = async () => { const x = await formSheet('Renommer', [{ name: 'n', label: 'Nom du local', value: loc.name }]); if (x && x.n) { loc.name = x.n; await save(true); $('h3', s.el).textContent = loc.name; } };
    const mv = () => { s.close(); if (onMove) onMove(loc); };
    $('[data-a=move]', box).onclick = mv; const m2 = $('[data-a=move2]', box); if (m2) m2.onclick = mv;
    const ok = $('[data-a=okpos]', box); if (ok) ok.onclick = async () => { delete loc.checkIndice; await save(true); render(); };
    $('[data-a=pdf]', box).onclick = () => avReportDialog({ nivId: loc.nivId, lotId: cur, locIds: [loc.id] });
    // v1.0.47 : réserve rattachée au local (le pin affiche ⚠ et le 100 % demande confirmation tant qu'elle est ouverte)
    $('[data-a=res]', box).onclick = async () => { const t = await newTask({ localId: loc.id, title: `${loc.name}${niv.name ? ' · ' + niv.name : ''} · ${avLot(p, cur).name} : `, ...(loc.planId ? { planId: loc.planId, x: loc.x, y: loc.y } : {}) }); s.close(); await openTaskDetail(t); onChange && onChange(); };
    $('[data-a=del]', box).onclick = async () => { if (!await confirmBox(`Supprimer le local ${loc.name} et ses photos ?`)) return; for (const rr of Object.values(loc.lots || {})) for (const id of rr.photos || []) await DB.del('files', id); await DB.del('links', loc.id); clearTimeout(saveT); saveT = null; s.close(); onChange && onChange(); };
  }
  // v1.0.46 : onglets de la fiche — suivi par lot · étapes & photos (local technique) · journal (saisies quotidiennes)
  function infoChips() {
    if (typeof avLocTypes !== 'function') return '';
    const t = avLocTypes(p).find(x => x.id === loc.ltype), z = avPinZone(p, loc, niv);
    return `<div class="avp-info"><button data-a="ltype" style="--c:${t ? t.color : 'var(--muted)'}"><i class="avp-sw"></i>${t ? esc(t.name) : 'Type de local'}</button><button data-a="lzone">${icon('layers')}${avSectOf(p, z) ? esc(avSectOf(p, z)) + ' · ' : ''}${esc(z)}</button>${loc.anep ? `<span>ANEP ${esc(loc.anep)}</span>` : ''}${loc.area ? `<span>${esc(loc.area)} m²</span>` : ''}</div>`;
  }
  function modeBar() { return `${infoChips()}<div class="avp-mode">${[['lot', '📊 Lots'], ['et', '📷 Étapes'], ['jr', `📅 Journal${(loc.journal || []).length ? ' ' + loc.journal.length : ''}`]].map(([k, l]) => `<button data-md="${k}" class="${mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <button class="btn small avp-jbtn" data-a="jour">${icon('plus')} Saisie du jour</button>`; }
  function bindMode() {
    $$('[data-md]', box).forEach(b => b.onclick = () => { mode = b.dataset.md; render(); });
    const lt = $('[data-a=ltype]', box); if (lt) lt.onclick = async () => { const v = await menu('Type de local', [...avLocTypes(p).map(t => ({ label: t.name, swatch: t.color, value: t.id, checked: loc.ltype === t.id })), { label: 'Aucun', value: '__none' }, { label: 'Modifier la liste…', icon: 'edit', value: '__edit' }]);
      if (!v) return; if (v === '__edit') { await avListEdit(p, 'ltype'); return render(); } loc.ltype = v === '__none' ? null : v; await save(true); render(); };
    const lz = $('[data-a=lzone]', box); if (lz) lz.onclick = async () => { const v = await menu('Zone du pin', avZones(p).map(z => ({ label: avSectOf(p, z) ? `${avSectOf(p, z)} · ${z}` : z, value: z, checked: avPinZone(p, loc, niv) === z }))); if (v) { loc.zone = v; await save(true); render(); } };
    const jb = $('[data-a=jour]', box); if (jb) jb.onclick = async () => { clearTimeout(saveT); saveT = null; await DB.put('links', loc); const e = await avJourForm(p, loc, { lot: cur }); if (e) { const L2 = await DB.get('links', loc.id); if (L2) Object.assign(loc, L2); onChange && onChange(); render(); } };
  }
  async function renderX() {
    if (mode === 'et') { box.innerHTML = modeBar() + avEtapesHTML(p, loc); bindMode(); avEtapesBind(box, p, loc, save, render); return; }
    const J = (loc.journal || []).slice().sort((a, b) => (b.d + b.t).localeCompare(a.d + a.t));
    box.innerHTML = modeBar() + (J.length ? `<div class="avp-jl">${J.map(e => { const lot = avLot(p, e.lot), t = avTeam(p, e.eq); return `<div class="avp-je"><i style="background:${lot.color}"></i><span class="grow"><b>${esc(fmtDate(e.d))} · ${esc(lot.name)}</b><small>${e.prev != null ? e.prev + ' → ' : ''}${e.pct} %${t ? ' · ' + esc(t.name) : ''}${e.eff ? ' · ' + e.eff + ' pers.' : ''}${e.qty ? ' · ' + esc(e.qty) : ''}${e.photos && e.photos.length ? ' · 📷 ' + e.photos.length : ''}</small>${e.note ? `<em>${esc(e.note)}</em>` : ''}</span><button class="iconbtn sm" data-jdel="${e.id}">${icon('close')}</button></div>`; }).join('')}</div>` : '<div class="empty">Aucune saisie.<br>Touchez <b>Saisie du jour</b> : lot, équipe, %, effectif, photos.</div>');
    bindMode();
    $$('[data-jdel]', box).forEach(b => b.onclick = async () => { if (!await confirmBox('Supprimer cette saisie ?')) return; loc.journal = (loc.journal || []).filter(x => x.id !== b.dataset.jdel); await save(true); render(); });
  }
  render();
}

// ---------- Dessin du plan coloré (partage image + PDF) ----------
async function avPlanCanvas(p, plan, locs, lot, { title, maxSide = 2600, crop } = {}) {
  const img = await loadImage(await fileURL(plan.fileId));
  const k = Math.min(1, maxSide / Math.max(plan.w, plan.h));
  const [cx, cy, cw, ch] = crop || [0, 0, plan.w, plan.h];
  const W = Math.round(cw * k), H = Math.round(ch * k);
  const head = title ? Math.round(Math.max(56, W * 0.035)) : 0, foot = title ? Math.round(Math.max(44, W * 0.026)) : 0;
  const c = document.createElement('canvas'); c.width = W; c.height = H + head + foot;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, cx * img.naturalWidth / plan.w, cy * img.naturalHeight / plan.h, cw * img.naturalWidth / plan.w, ch * img.naturalHeight / plan.h, 0, head, W, H);
  const R = crop ? Math.max(14, W / 40) : Math.max(9, Math.max(W, H) / 150), fs = Math.round(R * 1.15);
  for (const l of locs) {
    const x = (l.x - cx) * k, y = (l.y - cy) * k + head; if (x < -R || y < head - R || x > W + R || y > H + head + R) continue;
    const st = avStatus((l.lots || {})[lot.id]), col = AV_ST[st][1];
    g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = Math.max(2, R / 4); g.strokeStyle = '#fff'; g.stroke();
    g.font = `bold ${fs}px Arial`; g.textAlign = 'center'; g.lineWidth = Math.max(3, fs / 3.5); g.strokeStyle = '#fff'; g.strokeText(l.name, x, y + R + fs); g.fillStyle = '#111'; g.fillText(l.name, x, y + R + fs);
  }
  if (title) {
    g.textAlign = 'left'; g.fillStyle = '#1f2937'; g.fillRect(0, 0, W, head);
    g.fillStyle = '#fff'; g.font = `bold ${Math.round(head * 0.42)}px Arial`; g.fillText(`${p.name} — ${title}`, head * 0.3, head * 0.64);
    g.textAlign = 'right'; g.font = `${Math.round(head * 0.32)}px Arial`; g.fillText(`${fmtDate(Date.now())} · plan ind. ${planIndice(plan)}`, W - head * 0.3, head * 0.64);
    const s = avStats(locs, lot.id); let x = head * 0.3; const y = H + head + foot * 0.62; g.textAlign = 'left'; g.font = `${Math.round(foot * 0.4)}px Arial`;
    for (const [kk, [lab, col]] of Object.entries(AV_ST)) { if (!s[kk]) continue; g.fillStyle = col; g.beginPath(); g.arc(x + foot * 0.18, y - foot * 0.13, foot * 0.17, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; const t = `${s[kk]} ${lab}`; g.fillText(t, x + foot * 0.45, y); x += g.measureText(t).width + foot * 0.9; }
    g.textAlign = 'right'; g.font = `bold ${Math.round(foot * 0.42)}px Arial`; g.fillText(`${lot.name} : ${s.pct}% · ${s.fin}/${s.n} terminés`, W - head * 0.3, y);
  }
  return c;
}

// ---------- Rapport PDF (sans aucune mention de l'application) ----------
async function avReportDialog({ nivId, lotId, locIds }) {
  const p = App.project; avLots(p);
  const nivs = p.avNiveaux || []; if (!nivs.length) return toast('Ajoutez d\'abord un niveau');
  const r = locIds ? { niv: nivId, lot: lotId, flt: 'all', ph: 'yes' } : await formSheet('Rapport PDF', [
    { name: 'niv', label: 'Niveau', type: 'select', value: nivId || '__all', options: [{ value: '__all', label: 'Tous les niveaux' }, ...nivs.map(n => ({ value: n.id, label: n.name }))] },
    { name: 'lot', label: 'Lot', type: 'select', value: lotId || '__all', options: [{ value: '__all', label: 'Tous les lots' }, ...p.lots.map(l => ({ value: l.id, label: l.name }))] },
    { name: 'flt', label: 'Locaux à inclure', type: 'select', value: 'all', options: [{ value: 'all', label: 'Tous' }, { value: 'late', label: 'En retard seulement' }, { value: 'open', label: 'Non terminés' }, { value: 'done', label: 'Terminés' }, { value: 'photo', label: 'Avec photos' }, { value: 'week', label: 'Mis à jour cette semaine' }] },
    { name: 'ph', label: 'Fiches détaillées avec photos', type: 'select', value: 'yes', options: [{ value: 'yes', label: 'Oui (une fiche par local)' }, { value: 'no', label: 'Non (plan + tableau seulement)' }] },
  ], { okLabel: 'Créer le PDF' });
  if (!r) return;
  const ld = loading('Création du rapport…');
  try {
    const blob = await avBuildPdf(p, { nivIds: r.niv === '__all' ? nivs.map(n => n.id) : [r.niv], lotIds: r.lot === '__all' ? p.lots.map(l => l.id) : [r.lot], flt: r.flt, photos: r.ph !== 'no', locIds }, ld);
    ld.close();
    if (!blob) return toast('Aucun local à inclure avec ce filtre');
    const nv = r.niv === '__all' ? '' : (nivs.find(n => n.id === r.niv) || {}).name, lt = r.lot === '__all' ? '' : avLot(p, r.lot).name;
    await shareBlob(blob, avFileName(`Avancement ${lt} ${nv} ${p.name} ${todayISO()}`) + '.pdf');
  } catch (e) { ld.close(); console.error(e); alertBox('Rapport impossible : ' + (e.message || e)); }
}
const avBlobData = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
async function avBuildPdf(p, { nivIds, lotIds, flt, photos, locIds }, ld) {
  const { jsPDF } = window.jspdf;
  const { locaux, nivs } = await avData(p);
  const head = p.reportHead || {};
  let logo = null; if (head.logoId) { const f = await DB.get('files', head.logoId); if (f) { const im = await loadImage(BlobURL.get(f.id, f.blob)); logo = { d: await avBlobData(f.blob), r: im.naturalWidth / im.naturalHeight }; } }
  const weekAgo = Date.now() - 7 * 864e5;
  const keep = (l, lot) => { if (locIds) return locIds.includes(l.id); const rr = (l.lots || {})[lot.id] || {}, k = avStatus(rr);
    return flt === 'late' ? k === 'late' : flt === 'open' ? !avIsDone(k) : flt === 'done' ? avIsDone(k) : flt === 'photo' ? (rr.photos || []).length > 0 : flt === 'week' ? (l.updatedAt || 0) > weekAgo : true; };
  let doc = null, any = false;
  const page = (o) => { if (!doc) doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: o }); else doc.addPage('a4', o); };
  const header = (title, sub) => {
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(31, 41, 55); doc.rect(0, 0, W, 16, 'F');
    let x = 8; if (logo) { const h = 11, w = Math.min(40, h * logo.r); try { doc.addImage(logo.d, 'PNG', x, 2.5, w, h); } catch (e) { try { doc.addImage(logo.d, 'JPEG', x, 2.5, w, h); } catch (x2) {} } x += w + 4; }
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(title, x, 7.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text([p.name, head.company, head.sub].filter(Boolean).join(' · ') + (sub ? ' · ' + sub : ''), x, 12.5);
    doc.setFontSize(9); doc.text(fmtDate(Date.now()), W - 8, 9.5, { align: 'right' });
    doc.setTextColor(17, 24, 39);
  };
  const fitImg = (data, iw, ih, x, y, mw, mh) => { const k = Math.min(mw / iw, mh / ih), w = iw * k, h = ih * k; doc.addImage(data, 'JPEG', x + (mw - w) / 2, y + (mh - h) / 2, w, h); };
  const hexRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  for (const nid of nivIds) {
    const niv = nivs.find(n => n.id === nid); if (!niv || !niv.plan) continue;
    const nlocs = locaux.filter(l => l.nivId === nid).sort(avNameSort);
    for (const lid of lotIds) {
      const lot = avLot(p, lid), locs = nlocs.filter(l => keep(l, lot));
      if (!locs.length) continue; any = true;
      if (ld) ld.set(`Rapport : ${niv.name} · ${lot.name}…`);
      // 1) plan coloré
      if (!locIds) {
        page('landscape'); header(`Avancement ${lot.name} — ${niv.name}`, `plan ind. ${planIndice(niv.plan)}`);
        const c = await avPlanCanvas(p, niv.plan, nlocs, lot, { maxSide: 3000 });
        fitImg(c.toDataURL('image/jpeg', 0.85), c.width, c.height, 8, 19, 281, 170);
        const s = avStats(nlocs, lot.id); let x = 8; doc.setFontSize(9);
        for (const [k, [lab, col]] of Object.entries(AV_ST)) { if (!s[k]) continue; doc.setFillColor(...hexRGB(col)); doc.circle(x + 1.6, 201.4, 1.6, 'F'); const t = `${s[k]} ${lab}`; doc.text(t, x + 4.5, 202.5); x += doc.getTextWidth(t) + 10; }
        doc.setFont('helvetica', 'bold'); doc.text(`${lot.name} : ${s.pct}% · ${s.fin}/${s.n} terminés`, 289, 202.5, { align: 'right' }); doc.setFont('helvetica', 'normal');
        // 2) tableau
        page('portrait'); header(`Avancement ${lot.name} — ${niv.name}`, 'tableau des locaux');
        const cols = [['Local', 46], ['État', 30], ['Engagement', 24], ['Fin réelle', 22], ['%', 12], ['Observations', 60]];
        let y = 24; const th = () => { doc.setFillColor(36, 52, 77); doc.rect(8, y - 5, 194, 7, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); let cx = 10; cols.forEach(([t, w]) => { doc.text(t, cx, y); cx += w; }); doc.setTextColor(17, 24, 39); doc.setFont('helvetica', 'normal'); y += 6; };
        th();
        for (const l of locs) {
          const rr = (l.lots || {})[lot.id] || {}, k = avStatus(rr), obs = doc.splitTextToSize(rr.obs || '', 58).slice(0, 3), h = Math.max(7, obs.length * 3.8 + 3);
          if (y + h > 285) { page('portrait'); header(`Avancement ${lot.name} — ${niv.name}`, 'tableau (suite)'); y = 24; th(); }
          doc.setDrawColor(229, 231, 235); doc.line(8, y + h - 4, 202, y + h - 4);
          let cx = 10; doc.setFontSize(8.5);
          doc.text(doc.splitTextToSize(l.name, 44)[0], cx, y); cx += 46;
          doc.setFillColor(...hexRGB(AV_ST[k][1])); doc.circle(cx + 1.3, y - 1.1, 1.4, 'F'); doc.text(AV_ST[k][0], cx + 4, y); cx += 30;
          doc.text(rr.due ? fmtDate(rr.due) : '—', cx, y); cx += 24; doc.text(rr.doneAt ? fmtDate(rr.doneAt) : '—', cx, y); cx += 22; doc.text(avPct(rr) + '%', cx, y); cx += 12;
          doc.setFontSize(7.8); doc.text(obs, cx, y); y += h;
        }
      }
      // 3) fiches par local (plan localisé + photos)
      if (photos) for (const l of locs) {
        const rr = (l.lots || {})[lot.id] || {}, k = avStatus(rr);
        page('portrait'); header(`${l.name} — ${lot.name}`, niv.name);
        let y = 25; doc.setFontSize(10);
        const info = [['Niveau', niv.name], ['Local', l.name], ['Lot', lot.name], ['État', AV_ST[k][0] + (rr.state === 'progress' ? ` (${avPct(rr)}%)` : '')], ['Engagement', rr.due ? fmtDate(rr.due) : '—'], ['Fin réelle', rr.doneAt ? fmtDate(rr.doneAt) : '—']];
        info.forEach(([a, b], i) => { const cx = 10 + (i % 2) * 96, cy = y + Math.floor(i / 2) * 7; doc.setFont('helvetica', 'bold'); doc.text(a + ' :', cx, cy); doc.setFont('helvetica', 'normal'); doc.text(String(b), cx + 26, cy); });
        y += 23;
        if (rr.obs) { doc.setFontSize(9.5); const t = doc.splitTextToSize('Observations : ' + rr.obs, 190); doc.text(t, 10, y); y += t.length * 4.5 + 3; }
        // extrait du plan centré sur le local
        const pl = niv.plan, side = Math.max(pl.w, pl.h) * 0.16, cw = Math.min(pl.w, side * 1.4), ch = Math.min(pl.h, side);
        const cx = Math.max(0, Math.min(pl.w - cw, l.x - cw / 2)), cy = Math.max(0, Math.min(pl.h - ch, l.y - ch / 2));
        const cc = await avPlanCanvas(p, pl, nlocs.filter(x => x.id === l.id), lot, { crop: [cx, cy, cw, ch], maxSide: 1200 / (Math.max(cw, ch) / Math.max(pl.w, pl.h)) });
        doc.setFontSize(9); doc.setTextColor(100); doc.text('Localisation sur le plan', 10, y); doc.setTextColor(17, 24, 39); y += 2;
        fitImg(cc.toDataURL('image/jpeg', 0.85), cc.width, cc.height, 10, y, 190, 70); doc.setDrawColor(203, 213, 225); doc.rect(10, y, 190, 70); y += 75;
        const files = await loadFiles(rr.photos || []);
        let col = 0;
        for (const f of files) {
          const im = await loadImage(BlobURL.get(f.id, f.blob)), h = 62;
          if (y + h + 6 > 287) { page('portrait'); header(`${l.name} — ${lot.name}`, `${niv.name} · photos (suite)`); y = 24; col = 0; }
          const x = 10 + col * 97;
          fitImg(await avBlobData(f.blob), im.naturalWidth, im.naturalHeight, x, y, 93, h);
          doc.setFontSize(8); doc.setTextColor(100); doc.text(fmtDateTime(f.createdAt), x, y + h + 4); doc.setTextColor(17, 24, 39);
          col++; if (col === 2) { col = 0; y += h + 8; }
        }
      }
    }
  }
  if (!any || !doc) return null;
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(); doc.setFontSize(8); doc.setTextColor(140); doc.text(`${i} / ${n}`, W - 8, H - 2.5, { align: 'right' }); }
  return doc.output('blob');
}

// ---------- Résumé pour l'accueil ----------
function avHomeStats(p, links) {
  if (!(p.avNiveaux || []).length) return null;
  const ids = new Set(p.avNiveaux.map(n => n.id)), locs = links.filter(l => l.kind === 'local' && l.projectId === p.id && ids.has(l.nivId));
  let pct = 0, n = 0, late = 0;
  for (const l of locs) for (const lot of avLots(p)) { const r = (l.lots || {})[lot.id]; n++; pct += avPct(r); if (avStatus(r) === 'late') late++; }
  return { pct: n ? Math.round(pct / n) : 0, late, locs: locs.length };
}
