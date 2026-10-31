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
  const { locaux, nivs } = await avData(p);
  if (typeof avZoneOf === 'function') nivs.sort((a, b) => avZones(p).indexOf(avZoneOf(p, a)) - avZones(p).indexOf(avZoneOf(p, b)));   // v1.0.46 : niveaux rangés par zone
  if (App.avTab && App.avTab !== 'dash' && !p.lots.find(l => l.id === App.avTab)) App.avTab = 'dash';
  App.avTab = App.avTab || 'dash';
  const tba = $('#tbActions');
  if (tba) {
    tba.innerHTML = `<button class="iconbtn" data-a="avjour" title="Avancement du jour">${icon('calendar')}</button><button class="iconbtn" data-a="avpdf" title="Rapport PDF">${icon('pdf')}</button><button class="iconbtn" data-a="avset" title="Lots et réglages">${icon('settings')}</button>`;
    $('[data-a=avjour]').onclick = () => typeof openAvJour === 'function' && openAvJour(p);
    $('[data-a=avpdf]').onclick = () => avReportDialog({});
    $('[data-a=avset]').onclick = () => avSettings(root);
  }
  const tabs = `<div class="av-tabs"><button data-t="dash" class="${App.avTab === 'dash' ? 'on' : ''}">📊 Pro</button>${p.lots.map(l => `<button data-t="${l.id}" class="${App.avTab === l.id ? 'on' : ''}" style="--c:${l.color}"><i></i>${esc(l.name)}</button>`).join('')}</div>`;
  let body = '';
  if (!nivs.length) {
    body = `<div class="av-empty"><div class="ic">🏗️</div><b>Suivi d'avancement par lot</b>
      <ol><li>Ajoutez un <b>niveau</b> (plan R+1, RDC…) — PDF, image ou AutoCAD DXF.</li><li>Placez les <b>locaux</b> sur le plan (pins).</li><li>Pour chaque lot (${p.lots.map(l => esc(l.name)).join(', ')}), saisissez l'<b>engagement</b> avec le maître d'ouvrage, l'état et les photos.</li></ol>
      <button class="btn" data-a="addniv">${icon('plus')} Ajouter un niveau</button></div>`;
  } else if (App.avTab === 'dash') body = typeof avProDash === 'function' ? '<div class="avp-root"></div>' : avDashboardHTML(p, nivs, locaux);
  else {
    const lot = avLot(p, App.avTab);
    const zh = (n, i) => typeof avZoneOf === 'function' && (i === 0 || avZoneOf(p, nivs[i - 1]) !== avZoneOf(p, n)) ? `<div class="av-zh">${esc(avZoneOf(p, n))}</div>` : '';
    body = `<div class="av-list">${nivs.map((n, i) => { const locs = locaux.filter(l => l.nivId === n.id), s = avStats(locs, lot.id);
      return `${zh(n, i)}<div class="av-niv" data-niv="${n.id}"><div class="av-niv-h"><span class="av-niv-n">${esc(n.name)}</span>
          <span class="grow"><b>${s.pct}%</b> <small>${s.fin}/${s.n} local(aux) terminé(s)${n.plan ? ` · plan ind. ${esc(planIndice(n.plan))}` : ' · <span style="color:var(--red)">plan manquant</span>'}</small></span>
          <button class="iconbtn sm" data-nmore="${n.id}">${icon('more')}</button></div>
        <div class="av-bar">${['done', 'donelate', 'progress', 'soon', 'late', 'todo'].map(k => s[k] ? `<i style="flex:${s[k]};background:${AV_ST[k][1]}"></i>` : '').join('') || '<i style="flex:1;background:var(--line)"></i>'}</div>
        <div class="av-cnt">${s.late ? `<em class="r">${s.late} en retard</em>` : ''}${s.soon ? `<em class="o">${s.soon} échéance sous 7 j</em>` : ''}${s.progress ? `<em class="b">${s.progress} en cours</em>` : ''}${!s.n ? '<em>Aucun local — touchez pour en placer</em>' : ''}</div></div>`; }).join('')}
      <button class="av-add" data-a="addniv">${icon('plus')} Ajouter un niveau</button></div>`;
  }
  root.innerHTML = tabs + body;
  const pr = $('.avp-root', root); if (pr) avProDash(pr, p, nivs, locaux);
  $$('.av-tabs [data-t]', root).forEach(b => b.onclick = () => { App.avTab = b.dataset.t; renderAvancement(root); });
  $$('[data-a=addniv]', root).forEach(b => b.onclick = async () => { if (await avAddNiveau(p)) renderAvancement(root); });
  $$('[data-niv]', root).forEach(c => c.onclick = (e) => { if (e.target.closest('[data-nmore]')) return; const n = nivs.find(x => x.id === c.dataset.niv); openAvViewer(n.id, App.avTab, () => renderAvancement(root)); });
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
      { label: 'Étapes photo du local', icon: 'camera', value: 'etapes' }, { label: 'Types de chape (couleurs)', icon: 'fill', value: 'chapes' }] : []),
    { label: 'En-tête des rapports (société, logo)', icon: 'report', value: 'head' },
  ]);
  if (!v) return;
  if (v === 'add') { const r = await formSheet('Nouveau lot', [{ name: 'name', label: 'Nom du lot', placeholder: 'Ex : Carrelage' }], { okLabel: 'Ajouter' }); if (r && r.name) p.lots.push({ id: DB.uid(), name: r.name, color: AV_LOT_COLORS[p.lots.length % AV_LOT_COLORS.length] }); }
  if (v === 'head') await avHeaderSettings(p);
  if (v === 'zones') await avListEdit(p, 'zone');
  if (v === 'teams') await avTeamsMenu(p);
  if (v === 'etapes') await avListEdit(p, 'etape');
  if (v === 'chapes') await avListEdit(p, 'chape');
  if (v.startsWith('lot:')) {
    const lot = p.lots.find(l => 'lot:' + l.id === v), i = p.lots.indexOf(lot);
    const a = await menu(lot.name, [{ label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Couleur', icon: 'fill', value: 'col' }, ...(i > 0 ? [{ label: 'Monter', icon: 'chevup', value: 'up' }] : []), { label: 'Supprimer le lot', icon: 'trash', danger: true, value: 'del' }]);
    if (a === 'ren') { const r = await formSheet('Renommer le lot', [{ name: 'name', label: 'Nom', value: lot.name }]); if (r && r.name) lot.name = r.name; }
    if (a === 'col') { const c = await menu('Couleur', AV_LOT_COLORS.map(x => ({ label: x, swatch: x, value: x, checked: lot.color === x }))); if (c) lot.color = c; }
    if (a === 'up') { [p.lots[i - 1], p.lots[i]] = [p.lots[i], p.lots[i - 1]]; }
    if (a === 'del' && await confirmBox(`Supprimer le lot ${lot.name} ? (les données de ce lot sont retirées des locaux)`)) {
      for (const l of (await DB.byProject('links', p.id)).filter(l => l.kind === 'local' && l.lots && l.lots[lot.id])) { for (const id of l.lots[lot.id].photos || []) await DB.del('files', id); delete l.lots[lot.id]; await DB.put('links', l); }
      p.lots = p.lots.filter(x => x !== lot); }
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
  const st = { lot: lotId, add: false, moving: null, locs: [], filter: null };
  const el = document.createElement('div'); el.className = 'fullpage av-page';
  document.body.appendChild(el);
  let pz = null;
  const teardown = () => { el.remove(); onClose && onClose(); };
  const unBack = pushBack(teardown);
  const close = () => { unBack(); teardown(); };

  async function load() { st.locs = (await DB.byProject('links', p.id)).filter(l => l.kind === 'local' && l.nivId === niv.id).sort(avNameSort); }
  async function build() {
    const src = await fileURL(plan.fileId), W = plan.w, H = plan.h;
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button>
        <div class="tb-title" style="flex:1"><b>${esc(niv.name)}</b><span>${esc(plan.name)} · ind. ${esc(planIndice(plan))}</span></div>
        <button class="iconbtn" data-a="ind" title="Indices du plan">${icon('history')}</button>
        <button class="iconbtn" data-a="share" title="Partager">${icon('share')}</button>
        <button class="iconbtn" data-a="more">${icon('more')}</button></div>
      <div class="av-chips lots"></div>
      <div class="av-view"><div class="av-stage"><img src="${src}" width="${W}" height="${H}"><svg class="av-ov" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"></svg></div><div class="av-hint"></div></div>
      <div class="av-bottom"><div class="av-legend"></div><button class="btn small av-addbtn" data-a="add">${icon('plus')} Local</button></div>`;
    $('[data-a=x]', el).onclick = close;
    $('[data-a=add]', el).onclick = () => { st.add = !st.add; st.moving = null; drawUI(); };
    $('[data-a=share]', el).onclick = shareMenu;
    $('[data-a=more]', el).onclick = moreMenu;
    $('[data-a=ind]', el).onclick = () => planIndicesMenu(plan, { onNew: async (np) => { plan = np; await load(); await build(); }, onOpen: (old) => openPlanViewer(old, planCtx(() => {})) });
    pz = panZoom($('.av-view', el), $('.av-stage', el), W, H, { onTap, onChange: drawMarkers });
    requestAnimationFrame(() => { pz.fit(); if (focusLocId) { const l = st.locs.find(x => x.id === focusLocId); if (l) { pz.zoomTo(l.x - 60, l.y - 60, 120, 120); setTimeout(() => openAvLocal(l, st.lot, refresh), 250); } focusLocId = null; } });
    drawUI();
  }
  const lotObj = () => avLot(p, st.lot);
  function drawUI() {
    $('.av-chips.lots', el).innerHTML = p.lots.map(l => { const s = avStats(st.locs, l.id); return `<button data-l="${l.id}" class="${st.lot === l.id ? 'on' : ''}" style="--c:${l.color}"><i></i>${esc(l.name)} <small>${s.pct}%</small></button>`; }).join('');
    $$('.av-chips.lots [data-l]', el).forEach(b => b.onclick = () => { st.lot = b.dataset.l; st.filter = null; drawUI(); });
    const s = avStats(st.locs, st.lot);
    $('.av-legend', el).innerHTML = Object.entries(AV_ST).filter(([k]) => s[k]).map(([k, [l, c]]) => `<button data-f="${k}" class="${st.filter === k ? 'on' : ''}"><i style="background:${c}"></i>${s[k]} ${l}</button>`).join('') || `<span class="muted">Touchez « + Local » puis le plan pour placer les locaux</span>`;
    $$('.av-legend [data-f]', el).forEach(b => b.onclick = () => { st.filter = st.filter === b.dataset.f ? null : b.dataset.f; drawUI(); });
    const ab = $('[data-a=add]', el); ab.classList.toggle('on', st.add); ab.innerHTML = st.add ? `${icon('check')} Terminer` : `${icon('plus')} Local`;
    const hint = $('.av-hint', el);
    hint.textContent = st.moving ? `Touchez la nouvelle position de « ${st.moving.name} »` : st.add ? 'Touchez le plan pour placer un local (plusieurs à la suite)' : '';
    hint.style.display = hint.textContent ? '' : 'none';
    drawMarkers();
  }
  function drawMarkers() {
    if (!pz) return;
    const s = pz.st.s, R = 11 / s, showLbl = s / pz.st.fit > 1.6 || st.locs.length <= 25;
    $('.av-ov', el).innerHTML = st.locs.map(l => {
      const k = avStatus((l.lots || {})[st.lot]), c = AV_ST[k][1], dim = st.filter && st.filter !== k;
      return `<g transform="translate(${l.x},${l.y})" opacity="${dim ? 0.2 : 1}">
        ${l.checkIndice ? `<circle r="${R * 1.7}" fill="none" stroke="#f59e0b" stroke-width="${2.5 / s}" stroke-dasharray="${4 / s} ${3 / s}"/>` : ''}
        ${l.type === 'travail' ? `<rect x="${-R}" y="${-R * 0.75}" width="${R * 2}" height="${R * 1.5}" rx="${R * 0.3}" fill="${c}" stroke="#fff" stroke-width="${2.5 / s}"/>` : `<circle r="${R}" fill="${c}" stroke="#fff" stroke-width="${2.5 / s}"/>`}
        ${(l.journal || []).some(e => e.d === todayISO()) ? `<circle cx="${R * 0.85}" cy="${-R * 0.85}" r="${R * 0.38}" fill="#f59e0b" stroke="#fff" stroke-width="${1.5 / s}"/>` : ''}
        ${avIsDone(k) ? `<path d="M${-R * 0.45},0 L${-R * 0.1},${R * 0.38} L${R * 0.5},${-R * 0.35}" fill="none" stroke="#fff" stroke-width="${2.6 / s}" stroke-linecap="round"/>` : k === 'late' ? `<text y="${R * 0.42}" text-anchor="middle" font-size="${R * 1.3}" font-weight="700" fill="#fff" font-family="Arial">!</text>` : ''}
        ${showLbl ? `<text y="${R * 2.4}" text-anchor="middle" font-size="${12 / s}" font-weight="700" fill="#111" font-family="Arial" paint-order="stroke" stroke="#fff" stroke-width="${3.5 / s}">${esc(l.name)}</text>` : ''}</g>`;
    }).join('');
  }
  async function refresh() { await load(); if (el.isConnected) drawUI(); }
  async function onTap([x, y]) {
    const out = x < 0 || y < 0 || x > plan.w || y > plan.h;
    if (st.moving && !out) { const l = st.moving; l.x = x; l.y = y; delete l.checkIndice; await DB.put('links', l); st.moving = null; toast('Local déplacé ✓'); return refresh(); }
    if (st.add && !out) {
      const lot = lotObj();
      const r = await formSheet('Nouveau pin', [{ name: 'type', label: 'Type', type: 'select', value: st.lastType || 'local', options: [{ value: 'local', label: '● Local technique (n° ANEP, étapes, photos)' }, { value: 'travail', label: '▭ Zone de travail (façade, couloir, gaine…)' }] },
        { name: 'name', label: 'Nom / numéro', placeholder: 'Ex : LT 12, Local TGBT, Couloir B…', value: avNextName(st.locs) },
        { name: 'due', label: `Engagement ${lot.name} (date limite) — optionnel`, type: 'date' }], { okLabel: 'Placer' });
      if (!r || !r.name) return;
      st.lastType = r.type;
      const loc = { projectId: p.id, planId: plan.id, nivId: niv.id, kind: 'local', shape: 'point', x, y, name: r.name, lots: {}, items: [], ...(r.type === 'travail' ? { type: 'travail' } : {}) };
      if (r.due) loc.lots[lot.id] = { state: 'todo', due: r.due, photos: [] };
      await DB.put('links', loc); return refresh();
    }
    // toucher un local (tolérance ~ 24 px à l'écran)
    const tol = 24 / pz.st.s; let best = null, bd = 1e9;
    for (const l of st.locs) { const d = Math.hypot(l.x - x, l.y - y); if (d < tol && d < bd) { bd = d; best = l; } }
    if (best) openAvLocal(best, st.lot, refresh, { onMove: (l) => { st.moving = l; st.add = false; drawUI(); } });
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
    if (v === 'ind') { const np = await newPlanIndice(plan); if (np) { plan = np; await load(); await build(); } }
    if (v === 'bulk') {
      if (!st.locs.length) return toast('Aucun local sur ce niveau');
      const r = await formSheet(`Engagement ${lot.name} — ${niv.name}`, [{ name: 'due', label: 'Date limite (engagement maître d\'ouvrage)', type: 'date' },
        { name: 'all', label: 'Appliquer à', type: 'select', value: 'empty', options: [{ value: 'empty', label: 'Locaux sans date seulement' }, { value: 'all', label: 'Tous les locaux (remplace les dates)' }] }], { okLabel: 'Appliquer' });
      if (!r || !r.due) return;
      let n = 0; for (const l of st.locs) { l.lots = l.lots || {}; const rr = l.lots[lot.id] = l.lots[lot.id] || { state: 'todo', photos: [] }; if (r.all === 'all' || !rr.due) { rr.due = r.due; n++; await DB.put('links', l); } }
      toast(`${n} local(aux) mis à jour ✓`); refresh();
    }
  }
  await load(); await build();
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
        <label>Engagement maître d'ouvrage (date limite)<input type="date" value="${esc(r.due || '')}" data-in="due"></label>
        ${r.state === 'done' ? `<label>Date de fin réelle<input type="date" value="${esc(r.doneAt || '')}" data-in="doneAt"></label>` : ''}
        <label>Observations<textarea data-in="obs" placeholder="Remarques, réserves, entreprise…">${esc(r.obs || '')}</textarea></label>
        <label>Photos (${files.length})</label>${thumbsHTML(files)}
      </div>
      <div class="btnrow wrap"><button class="btn ghost small" data-a="ren">${icon('edit')} Renommer</button><button class="btn ghost small" data-a="move">${icon('move')} Déplacer</button>
        <button class="btn ghost small" data-a="pdf">${icon('pdf')} PDF</button><button class="btn danger small" data-a="del">${icon('trash')}</button></div>`;
    $$('[data-lt]', box).forEach(b => b.onclick = () => { cur = b.dataset.lt; render(); });
    bindMode();
    $$('[data-st]', box).forEach(b => b.onclick = () => { r.state = b.dataset.st; if (r.state === 'done' && !r.doneAt) r.doneAt = todayISO(); if (r.state !== 'done') delete r.doneAt; save(true); render(); });
    $$('[data-in]', box).forEach(i => i.oninput = () => { r[i.dataset.in] = i.dataset.in === 'pct' ? +i.value : i.value; if (i.dataset.in === 'pct') $('[data-pctv]', box).textContent = i.value + '%'; save(); if (i.type === 'date') { save(true); render(); } });
    const add = $('[data-a=addphoto]', box); if (add) add.onclick = async () => { const fs = await addPhotos(p.id, { local: loc.id, lot: cur }); if (fs.length) { r.photos.push(...fs.map(f => f.id)); await save(true); render(); } };
    $$('.thumbs .t[data-id]', box).forEach(t => t.onclick = (e) => { if (e.target.closest('[data-del]')) return; const i = files.findIndex(f => f.id === t.dataset.id); showGallery(files.map(f => ({ src: BlobURL.get(f.id, f.blob), caption: `${loc.name} · ${avLot(p, cur).name} · ${fmtDateTime(f.createdAt)}` })), i); });
    $$('[data-del]', box).forEach(b => b.onclick = async (e) => { e.stopPropagation(); if (!await confirmBox('Supprimer cette photo ?')) return; r.photos = r.photos.filter(x => x !== b.dataset.del); await DB.del('files', b.dataset.del); await save(true); render(); });
    $('[data-a=ren]', box).onclick = async () => { const x = await formSheet('Renommer', [{ name: 'n', label: 'Nom du local', value: loc.name }]); if (x && x.n) { loc.name = x.n; await save(true); $('h3', s.el).textContent = loc.name; } };
    const mv = () => { s.close(); if (onMove) onMove(loc); };
    $('[data-a=move]', box).onclick = mv; const m2 = $('[data-a=move2]', box); if (m2) m2.onclick = mv;
    const ok = $('[data-a=okpos]', box); if (ok) ok.onclick = async () => { delete loc.checkIndice; await save(true); render(); };
    $('[data-a=pdf]', box).onclick = () => avReportDialog({ nivId: loc.nivId, lotId: cur, locIds: [loc.id] });
    $('[data-a=del]', box).onclick = async () => { if (!await confirmBox(`Supprimer le local ${loc.name} et ses photos ?`)) return; for (const rr of Object.values(loc.lots || {})) for (const id of rr.photos || []) await DB.del('files', id); await DB.del('links', loc.id); clearTimeout(saveT); saveT = null; s.close(); onChange && onChange(); };
  }
  // v1.0.46 : onglets de la fiche — suivi par lot · étapes & photos (local technique) · journal (saisies quotidiennes)
  function modeBar() { return `<div class="avp-mode">${[['lot', '📊 Lots'], ['et', '📷 Étapes'], ['jr', `📅 Journal${(loc.journal || []).length ? ' ' + loc.journal.length : ''}`]].map(([k, l]) => `<button data-md="${k}" class="${mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <button class="btn small avp-jbtn" data-a="jour">${icon('plus')} Saisie du jour</button>`; }
  function bindMode() {
    $$('[data-md]', box).forEach(b => b.onclick = () => { mode = b.dataset.md; render(); });
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
