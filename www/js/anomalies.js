// ================= v1.0.65 : Tableau des anomalies — réception, bétonnage, non-conformités (constats), réserves =================
// Une ligne par anomalie : date, niveau, zone, lot, élément, description, photo de l'anomalie, photo après traitement,
// responsable, statut (ouverte / en cours / traitée), délai. Filtres, recherche, PDF et Excel (CSV). Ouvert aussi depuis un lot (niveau + lot).
const AN_ST = { ouverte: ['🔴', 'Ouverte', '#dc2626'], cours: ['🟠', 'En cours', '#f59e0b'], traitee: ['🟢', 'Traitée', '#16a34a'] };
const anK = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9+]/g, '');
async function anCollect(p) {
  const [recs, tasks, links] = await Promise.all(['receptions', 'tasks', 'links'].map(s => DB.byProject(s, p.id).catch(() => [])));
  const L = new Map(links.map(l => [l.id, l])), nivN = (id) => ((p.avNiveaux || []).find(n => n.id === id) || {}).name || '', today = todayISO(), R = [];
  const days = (a, b) => a ? Math.max(0, Math.round((new Date((b || today) + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5)) : 0;
  for (const d of recs) { const bet = d.type === 'Bétonnage';
    (d.rows || []).forEach((r, i) => { if (!r.element || !(r.status === 'reserve' || (r.anomIds || []).length)) return;
      const st = r.liftedAt ? 'traitee' : (r.retourIds || []).length ? 'cours' : 'ouverte';
      R.push({ k: 'rec:' + d.id + ':' + (r.id || i), src: bet ? 'Bétonnage' : 'Réception', date: d.date, niv: r.niv || '', zone: r.zone ? 'Zone ' + r.zone : '', lot: 'Gros œuvre', el: r.element, desc: r.obs || '', ph: (r.anomIds || [])[0] || (r.photoIds || [])[0] || '', phT: (r.retourIds || [])[0] || '', st, doneAt: r.liftedAt || '', resp: r.avec || '', delay: days(d.date, r.liftedAt), ref: { rec: d.id, row: r.id || i }, pin: !!r.pinId }); }); }
  for (const c of p.constats || []) (c.items || []).forEach((it, i) => { const st = it.done ? 'traitee' : (it.solution || '').trim() ? 'cours' : 'ouverte';
    R.push({ k: 'nc:' + c.id + ':' + (it.id || i), src: 'Non-conformité', date: c.date, niv: it.niv || '', zone: it.loc || c.lieu || '', lot: c.lot || '', el: c.ref || 'Constat', desc: it.probleme || '', sol: it.solution || '', ph: (it.photoIds || [])[0] || '', phT: (it.retourIds || [])[0] || '', st, doneAt: it.doneAt || '', resp: c.entreprise || '', grav: it.gravite || '', delay: days(c.date, it.doneAt), ref: { nc: c.id, item: it.id || i }, pin: !!it.pinId }); });
  for (const t of tasks) { const l = t.localId && L.get(t.localId), lifted = typeof isLifted === 'function' ? isLifted(t) : t.status === 'done';
    const comp = typeof companyOf === 'function' ? companyOf(p, t.companyId) : null, d0 = t.date || (t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : '');
    R.push({ k: 'res:' + t.id, src: 'Réserve', date: d0, niv: t.niv || (l ? nivN(l.nivId) : ''), zone: t.zone || (l ? l.zone || '' : ''), lot: t.lotName || (t.lot && typeof avLot === 'function' ? avLot(p, t.lot).name : '') || '', el: `#${t.num || ''} ${l ? l.name : ''}`.trim(), desc: t.title || '', ph: (t.photoIds || [])[0] || '', phT: (t.liftPhotoIds || [])[0] || '', st: lifted ? 'traitee' : t.status === 'progress' ? 'cours' : 'ouverte', doneAt: lifted ? (t.liftedAt || (t.updatedAt ? new Date(t.updatedAt).toISOString().slice(0, 10) : '')) : '', resp: comp ? comp.name : '', delay: days(d0, lifted ? (t.liftedAt || '') || today : ''), ref: { task: t.id }, pin: !!(t.planId && t.x != null) }); }
  return R.sort((a, b) => (a.st === 'traitee') - (b.st === 'traitee') || String(b.date).localeCompare(String(a.date)));
}
async function openAnomalies(p, pre = {}) {
  p = p || App.project; if (!p) return;
  let R = await anCollect(p);
  const F = { niv: pre.niv || '', zone: '', lot: pre.lot || '', src: '', st: '', q: '' };
  const EMB = pre.embed || null, el = EMB || document.createElement('div'); if (EMB) { EMB.classList.add('an-page', 'emb'); EMB.innerHTML = ''; } else { el.className = 'fullpage an-page'; document.body.appendChild(el); }
  const unBack = EMB ? () => {} : pushBack(() => el.remove()); const close = EMB ? () => {} : () => { unBack(); el.remove(); };
  const th = new Map(); const thumb = async (id) => { if (!id) return ''; if (th.has(id)) return th.get(id); const f = await DB.get('files', id); const u = f && (f.blob || f.driveId) ? BlobURL.get(f.id, f.blob) : ''; th.set(id, u); return u; };
  const uniq = (fn) => { const m = new Map(); for (const r of R) { const v = fn(r); if (v && !m.has(anK(v))) m.set(anK(v), v); } return [...m.values()].sort((a, b) => String(a).localeCompare(String(b), 'fr', { numeric: true })); };
  const shown = () => R.filter(r => (!F.niv || anK(r.niv) === anK(F.niv)) && (!F.zone || anK(r.zone) === anK(F.zone)) && (!F.lot || anK(r.lot) === anK(F.lot) || (anK(F.lot).includes('gros') && r.src !== 'Réserve' && r.src !== 'Non-conformité')) && (!F.src || r.src === F.src) && (!F.st || r.st === F.st)
    && (!F.q || anK(`${r.el} ${r.desc} ${r.zone} ${r.niv} ${r.lot} ${r.resp} ${r.src}`).includes(anK(F.q))));
  const draw = async () => {
    const S = shown(), n = (k) => S.filter(r => r.st === k).length, tr = S.filter(r => r.st === 'traitee'), avg = tr.length ? Math.round(tr.reduce((a, r) => a + r.delay, 0) / tr.length) : 0;
    const sel = (k, lab, L) => `<label class="avf-s ${F[k] ? 'on' : ''}"><small>${lab}</small><select data-f="${k}"><option value="">Tous</option>${L.map(x => { const [v, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${F[k] && anK(v) === anK(F[k]) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>`;
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title" style="flex:1"><b>Anomalies</b><span>${esc([p.name, F.niv, F.lot].filter(Boolean).join(' · '))}</span></div><button class="iconbtn" data-a="csv" title="Excel">${icon('sheet')}</button><button class="iconbtn" data-a="pdf" title="PDF">${icon('pdf')}</button></div>
      <div class="due-body">
        <div class="due-k an-k">${['ouverte', 'cours', 'traitee'].map(k => `<button data-st="${k}" class="${F.st === k ? 'on' : ''}"><b style="color:${AN_ST[k][2]}">${n(k)}</b><small>${AN_ST[k][0]} ${AN_ST[k][1]}s</small></button>`).join('')}<button disabled><b>${avg} j</b><small>délai moyen de traitement</small></button></div>
        <input class="due-q" type="search" placeholder="🔍 Élément, description, zone, entreprise…" value="${esc(F.q)}">
        <div class="avf-bar">${sel('niv', 'Niveau', uniq(r => r.niv))}${sel('zone', 'Zone', uniq(r => r.zone))}${sel('lot', 'Lot', uniq(r => r.lot))}${sel('src', 'Type', [...new Set(R.map(r => r.src))])}</div>
        <div class="an-l">${S.map(r => `<button class="an-r ${r.st}" data-k="${esc(r.k)}"><span class="an-ph"><img data-ph="${r.ph}" alt="">${r.phT ? `<img class="t" data-ph="${r.phT}" alt="">` : ''}</span>
          <span class="grow"><b>${esc(r.el)}${r.desc ? ' — ' + esc(r.desc) : ''}</b><small>${r.pin ? '📍 ' : ''}${esc(r.src)} · ${fmtDate(r.date)}${r.niv ? ' · ' + esc(r.niv) : ''}${r.zone ? ' · ' + esc(r.zone) : ''}${r.lot ? ' · ' + esc(r.lot) : ''}${r.resp ? ' · ' + esc(r.resp) : ''}</small>
          <i class="an-st" style="--c:${AN_ST[r.st][2]}">${AN_ST[r.st][0]} ${AN_ST[r.st][1]}${r.st === 'traitee' ? ` le ${fmtDate(r.doneAt)} · ${r.delay} j` : ` · depuis ${r.delay} j`}</i></span></button>`).join('') || '<div class="empty">Aucune anomalie pour ce choix 👍</div>'}</div></div>`;
    $$('img[data-ph]', el).forEach(async im => { const u = await thumb(im.dataset.ph); if (u) im.src = u; else im.remove(); });
    ($('[data-a=x]', el)||{}).onclick = close;
    $$('[data-f]', el).forEach(s => s.onchange = () => { F[s.dataset.f] = s.value; draw(); });
    $$('[data-st]', el).forEach(b => b.onclick = () => { F.st = F.st === b.dataset.st ? '' : b.dataset.st; draw(); });
    const qi = $('.due-q', el); let t; qi.oninput = () => { clearTimeout(t); t = setTimeout(async () => { F.q = qi.value.trim(); await draw(); const q2 = $('.due-q', el); if (q2) { q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); } }, 350); };
    $$('[data-k]', el).forEach(b => b.onclick = () => anRow(p, R.find(r => r.k === b.dataset.k), async () => { R = await anCollect(p); draw(); }, close));
    ($('[data-a=csv]', el)||{}).onclick = () => { const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = '﻿' + [['Type', 'Date', 'Niveau', 'Zone', 'Lot', 'Élément', 'Description', 'Responsable', 'Statut', 'Traitée le', 'Délai (j)'].join(';'), ...shown().map(r => [r.src, fmtDate(r.date), r.niv, r.zone, r.lot, r.el, r.desc, r.resp, AN_ST[r.st][1], r.doneAt ? fmtDate(r.doneAt) : '', r.delay].map(q).join(';'))].join('\n');
      shareBlob(new Blob([csv], { type: 'text/csv' }), avFileName(`Anomalies ${p.name} ${todayISO()}`) + '.csv'); };
    ($('[data-a=pdf]', el)||{}).onclick = () => anPdf(p, shown(), [F.niv, F.lot, F.zone].filter(Boolean).join(' · '));
  };
  draw();
}
async function anRow(p, r, refresh, closeAll) {
  if (!r) return;
  const v = await menu(`${r.el}${r.desc ? ' — ' + r.desc.slice(0, 50) : ''}`, [{ label: 'Ouvrir la fiche', icon: 'eye', value: 'open' }, ...(r.ph || r.phT ? [{ label: 'Voir les photos', icon: 'image', value: 'ph' }] : []), { label: r.pin ? '📍 Voir sur le plan' : '📍 Placer sur un plan', icon: 'pin', value: 'loc' },
    ...(r.st !== 'traitee' ? [{ label: '📷 Photo après traitement', icon: 'camera', value: 'phT' }, { label: '✓ Marquer traitée aujourd\'hui', icon: 'check', value: 'done' }] : [{ label: 'Rouvrir (pas traitée)', icon: 'undo', value: 'reopen' }])]);
  if (!v) return;
  if (v === 'open') { closeAll();
    if (r.ref.rec) { App.section = 'reception'; await renderSection(); const d = await DB.get('receptions', r.ref.rec); if (d && typeof openReceptionDay === 'function') openReceptionDay(d, { focus: r.ref.row }); }
    else if (r.ref.task) { const t = await DB.get('tasks', r.ref.task); if (t) openTaskDetail(t); }
    else { App.section = 'constat'; renderSection(); } return; }
  if (v === 'ph') { const L = []; for (const id of [r.ph, r.phT].filter(Boolean)) { const f = await DB.get('files', id); if (f) L.push({ src: BlobURL.get(f.id, f.blob), fileId: f.id, caption: id === r.phT ? 'Après traitement' : 'Anomalie' }); } return showGallery(L, 0); }
  if (v === 'loc') return anLocate(p, r, refresh, closeAll);
  const now = todayISO();
  if (r.ref.rec) { const d = await DB.get('receptions', r.ref.rec); const row = d && (d.rows || []).find((x, i) => (x.id || i) === r.ref.row); if (!row) return toast('Ligne introuvable');
    if (v === 'phT') { const fs = await addPhotos(p.id, { source: `Traitement · ${row.element}` }); if (!fs.length) return; row.retourIds = [...(row.retourIds || []), ...fs.map(f => f.id)]; }
    if (v === 'done') row.liftedAt = now; if (v === 'reopen') row.liftedAt = null;
    await DB.put('receptions', d); await recPinSync(row); }
  else if (r.ref.task) { const t = await DB.get('tasks', r.ref.task); if (!t) return;
    if (v === 'phT') { const fs = await addPhotos(p.id, { source: `Levée · #${t.num || ''}` }); if (!fs.length) return; t.liftPhotoIds = [...(t.liftPhotoIds || []), ...fs.map(f => f.id)]; t.photoIds = [...(t.photoIds || []), ...fs.map(f => f.id)]; if (t.status === 'open') t.status = 'progress'; }
    if (v === 'done') { t.status = 'done'; t.liftedAt = now; } if (v === 'reopen') { t.status = 'open'; t.liftedAt = null; }
    await DB.put('tasks', t); }
  else if (r.ref.nc) { const pr = await DB.get('projects', p.id), c = (pr.constats || []).find(x => x.id === r.ref.nc), it = c && (c.items || []).find((x, i) => (x.id || i) === r.ref.item); if (!it) return;
    if (v === 'phT') { const fs = await addPhotos(p.id, { source: `Traitement · ${c.ref || 'NC'}` }); if (!fs.length) return; it.retourIds = [...(it.retourIds || []), ...fs.map(f => f.id)]; }
    if (v === 'done') { it.done = true; it.doneAt = now; } if (v === 'reopen') { it.done = false; it.doneAt = null; }
    await DB.put('projects', pr); Object.assign(p, pr); if (it.pinId) { const L = await DB.get('links', it.pinId); if (L) { L.recLifted = !!it.done; await DB.put('links', L); } } }
  toast('✓ Enregistré'); refresh();
}
// v1.0.71 : 📍 de l'anomalie — voir / placer sur le plan du même niveau (réception, bétonnage, non-conformité) ou ouvrir la réserve
async function anLocate(p, r, refresh, closeAll) {
  if (r.ref.rec) { const d = await DB.get('receptions', r.ref.rec); const row = d && (d.rows || []).find((x, i) => (x.id || i) === r.ref.row); if (!row) return toast('Ligne introuvable');
    closeAll(); return recPinFlow(d, row, typeof kindOf === 'function' ? kindOf(d) : d.type, { save: () => DB.put('receptions', d), refresh }); }
  if (r.ref.task) { const t = await DB.get('tasks', r.ref.task); const pl = t && t.planId && t.x != null && await DB.get('plans', t.planId); if (!pl) return toast('Cette réserve n\'est pas placée sur un plan');
    closeAll(); return openPlanViewer(pl, { ...(typeof planCtx === 'function' ? planCtx(() => {}) : {}), focus: { x: t.x, y: t.y } }); }
  if (r.ref.nc) { const pr = await DB.get('projects', p.id), c = (pr.constats || []).find(x => x.id === r.ref.nc), it = c && (c.items || []).find((x, i) => (x.id || i) === r.ref.item); if (!it) return toast('Constat introuvable');
    const L = it.pinId ? await DB.get('links', it.pinId) : null;
    if (L) { const v = await menu(r.el, [{ label: 'Voir sur le plan', icon: 'plans', value: 'open' }, { label: 'Changer l\u2019emplacement', icon: 'pin', value: 'move' }, { label: 'Retirer du plan', icon: 'trash', danger: true, value: 'del' }]); if (!v) return;
      if (v === 'del') { await DB.del('links', L.id); it.pinId = null; await DB.put('projects', pr); Object.assign(p, pr); return refresh(); }
      if (v === 'open') { const pl = await DB.get('plans', L.planId); if (!pl) return toast('Plan supprimé'); closeAll(); return openPlanViewer(pl, { ...(typeof planCtx === 'function' ? planCtx(() => {}) : {}), focus: { x: L.x, y: L.y } }); } }
    const pl = await pickPlanFor(p.id, it.niv || r.niv); if (!pl) return; closeAll(); toast('📍 Touchez le plan à l\u2019endroit de la non-conformité');
    return openPlanViewer(pl, { ...(typeof planCtx === 'function' ? planCtx(() => {}) : {}), place: { label: r.el, onPlace: async (x, y, plan) => {
      if (L) await DB.del('links', L.id);
      const nl = await DB.put('links', { projectId: p.id, planId: plan.id, kind: 'recpin', shape: 'point', x, y, name: String(r.el).slice(0, 60), ncRef: { c: c.id, item: it.id || null }, recKind: 'Non-conformité', recLifted: !!it.done, niv: it.niv || '', items: [] });
      const pr2 = await DB.get('projects', p.id), c2 = (pr2.constats || []).find(x => x.id === c.id), it2 = c2 && (c2.items || []).find((y, i) => (y.id || i) === r.ref.item); if (it2) { it2.pinId = nl.id; await DB.put('projects', pr2); Object.assign(p, pr2); }
      toast('📍 Placé sur le plan ✓'); } } }); }
}
async function anPdf(p, S, scope) {
  if (!window.jspdf && window.__late) await window.__late; if (!window.jspdf) return toast('Module PDF indisponible');
  const ld = loading('Préparation du PDF…');
  try {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' }), W = 297, H = 210, M = 10; let y = 0;
    const head = () => { doc.setFillColor(15, 37, 64); doc.rect(0, 0, W, 18, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(`Suivi des anomalies · ${p.name}`.slice(0, 80), M, 9); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`${scope || 'Tout le projet'} · ${fmtDate(todayISO())} · ${S.length} anomalie(s)`, M, 14.5); y = 24; doc.setTextColor(30); };
    head();
    const img = async (id, mm) => { if (!id) return null; const f = await DB.get('files', id); if (!f || !f.blob) return null; try { const bm = await createImageBitmap(f.blob, { resizeWidth: 360, resizeQuality: 'medium' }), c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0); bm.close && bm.close(); const d = c.toDataURL('image/jpeg', 0.75), r = c.height / c.width; c.width = c.height = 0; return { d, h: mm * r }; } catch (e) { return null; } };
    for (const r of S) {
      const a = await img(r.ph, 34), b = await img(r.phT, 34), rh = Math.max(24, (a ? a.h : 0) + 2, (b ? b.h : 0) + 2);
      if (y + rh > H - 10) { doc.addPage(); head(); }
      if (a) doc.addImage(a.d, 'JPEG', M, y, 34, Math.min(a.h, rh - 2)); if (b) doc.addImage(b.d, 'JPEG', M + 36, y, 34, Math.min(b.h, rh - 2));
      const x = M + 74, c = AN_ST[r.st][2]; doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text(doc.splitTextToSize(`${r.el}${r.desc ? ' — ' + r.desc : ''}`, 150).slice(0, 2), x, y + 4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80); doc.text(`${r.src} · ${fmtDate(r.date)}${r.niv ? ' · ' + r.niv : ''}${r.zone ? ' · ' + r.zone : ''}${r.lot ? ' · ' + r.lot : ''}${r.resp ? ' · ' + r.resp : ''}`.slice(0, 130), x, y + 13);
      doc.setTextColor(...[parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]); doc.setFont('helvetica', 'bold'); doc.text(`${AN_ST[r.st][1]}${r.st === 'traitee' ? ' le ' + fmtDate(r.doneAt) + ' · ' + r.delay + ' j' : ' · depuis ' + r.delay + ' j'}`, x, y + 19); doc.setTextColor(30);
      doc.setDrawColor(226); doc.line(M, y + rh, W - M, y + rh); y += rh + 3;
    }
    const n = doc.getNumberOfPages(); for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(140); doc.text(`SiteTeam · ${i}/${n}`, W - M, H - 5, { align: 'right' }); }
    ld.close(); await shareBlob(doc.output('blob'), avFileName(`Anomalies ${p.name} ${scope || ''} ${todayISO()}`) + '.pdf');
  } catch (e) { ld.close(); alertBox('PDF impossible : ' + (e.message || e)); }
}
