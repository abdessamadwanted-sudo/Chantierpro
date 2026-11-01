// ================= v1.0.53 : pins photos par dossiers (Porte provisoire, Brique, Nettoyage…), dans la barre des lots de chaque niveau,
// partage modifiable avant l'envoi (choix des photos, nom du PDF) et PDF « 4 grandes photos par page » =================
const PN_PRESETS = ['Porte provisoire', 'Brique', 'Nettoyage', 'Enduit', 'Étanchéité', 'Réservations', 'Ferraillage', 'Coffrage', 'Électricité', 'Plomberie', 'Peinture', 'Avant travaux', 'Après travaux'];
const pnFolders = (l) => (l.folders = Array.isArray(l.folders) ? l.folders : []);
const pnCount = (l) => (l.photos || []).length + pnFolders(l).reduce((a, d) => a + (d.photos || []).length, 0);
// noms de dossiers déjà utilisés dans le projet : proposés en premier
async function pnPresets(projectId) {
  const used = new Map();
  for (const x of await DB.byProject('links', projectId)) if (x.kind === 'photonote') for (const d of x.folders || []) used.set(d.name, (used.get(d.name) || 0) + 1);
  const mine = [...used.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  return [...new Set([...mine, ...PN_PRESETS])];
}
// contexte du pin : projet, niveau (dossier de plans), lot, plan — pour le titre et le nom du PDF
async function pnContext(l) {
  const p = App.project && App.project.id === l.projectId ? App.project : await DB.get('projects', l.projectId);
  const plan = l.planId ? await DB.get('plans', l.planId) : null, f = plan && plan.folderId ? await DB.get('folders', plan.folderId) : null;
  const lot = plan && plan.lotId && typeof LOTS_DEF !== 'undefined' ? ((typeof planLots === 'function' && p ? planLots(p) : LOTS_DEF).find(x => x.id === plan.lotId) || null) : null;
  return { p, plan, niv: f ? (typeof nivOfFolder === 'function' && nivOfFolder(f.name)) || f.name : '', lot };
}

// ---------- dossiers dans la fiche du pin ----------
async function pnFoldersHTML(l) {
  const F = pnFolders(l); let h = '';
  for (const d of F) {
    const th = []; for (const id of (d.photos || []).slice(0, 8)) { const f = await DB.get('files', id); if (f && f.blob) th.push({ id, src: BlobURL.get(id, f.blob) }); }
    h += `<div class="pnf" data-fd="${d.id}"><div class="pnf-h"><button class="pnf-n" data-fren="${d.id}">📁 <b>${esc(d.name)}</b> <small>${(d.photos || []).length}</small></button>
      <button class="iconbtn sm" data-fadd="${d.id}" title="Ajouter des photos">${icon('camera')}</button><button class="iconbtn sm" data-fmore="${d.id}">${icon('more')}</button></div>
      ${th.length ? `<div class="pnf-th">${th.map(t => `<img src="${t.src}" data-fv="${d.id}|${t.id}">`).join('')}${(d.photos || []).length > 8 ? `<span class="pnf-more">+${d.photos.length - 8}</span>` : ''}</div>` : '<div class="pnf-e">Aucune photo — touchez 📷</div>'}</div>`;
  }
  return `<div class="nt-sec"><span>📁 Dossiers photos${F.length ? ` (${F.length})` : ''}</span><button class="btn small ghost" data-a="fnew">${icon('plus')} Dossier</button></div>${h}`;
}
function pnBindFolders(box, l, save, draw) {
  const F = pnFolders(l), find = (id) => F.find(d => d.id === id);
  const nb = $('[data-a=fnew]', box); if (nb) nb.onclick = async () => {
    const L = await pnPresets(l.projectId), have = new Set(F.map(d => d.name));
    const v = await menu('Nouveau dossier photos', [...L.filter(n => !have.has(n)).slice(0, 14).map(n => ({ label: n, icon: 'folder', value: 'n:' + n })), { label: 'Autre nom…', icon: 'edit', value: 'own' }]);
    if (!v) return; let name = v.startsWith('n:') ? v.slice(2) : '';
    if (v === 'own') { const r = await formSheet('Nouveau dossier', [{ name: 'n', label: 'Nom', placeholder: 'Ex : Porte provisoire' }], { okLabel: 'Créer' }); if (!r || !r.n) return; name = r.n.trim(); }
    const d = { id: DB.uid(), name, photos: [] }; F.push(d); await save();
    const recs = await addPhotos(l.projectId, { source: `${l.name} · ${name}` }); if (recs.length) { d.photos.push(...recs.map(r => r.id)); await save(); }
    draw();
  };
  $$('[data-fadd]', box).forEach(b => b.onclick = async () => { const d = find(b.dataset.fadd); if (!d) return; const recs = await addPhotos(l.projectId, { source: `${l.name} · ${d.name}` }); if (recs.length) { d.photos.push(...recs.map(r => r.id)); await save(); draw(); } });
  const ren = async (d) => { const r = await formSheet('Renommer le dossier', [{ name: 'n', label: 'Nom', value: d.name }]); if (r && r.n) { d.name = r.n.trim(); await save(); draw(); } };
  $$('[data-fren]', box).forEach(b => b.onclick = () => { const d = find(b.dataset.fren); if (d) ren(d); });
  $$('[data-fmore]', box).forEach(b => b.onclick = async () => { const d = find(b.dataset.fmore); if (!d) return; const i = F.indexOf(d);
    const v = await menu(d.name, [{ label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Envoyer ce dossier (PDF ou photos)', icon: 'share', value: 'sh' }, ...(i > 0 ? [{ label: 'Monter', icon: 'chevup', value: 'up' }] : []), { label: 'Supprimer le dossier et ses photos', icon: 'trash', danger: true, value: 'del' }]);
    if (v === 'ren') return ren(d);
    if (v === 'sh') return pnShare(l, { only: d.id });
    if (v === 'up') { F.splice(i, 1); F.splice(i - 1, 0, d); await save(); draw(); }
    if (v === 'del' && await confirmBox(`Supprimer le dossier « ${d.name} » et ses ${(d.photos || []).length} photo(s) ?`)) { for (const id of d.photos || []) await DB.del('files', id); F.splice(i, 1); await save(); draw(); } });
  $$('[data-fv]', box).forEach(img => img.onclick = async () => { const [did, pid] = img.dataset.fv.split('|'), d = find(did); if (!d) return;
    const L = []; for (const id of d.photos) { const f = await DB.get('files', id); if (f && f.blob) L.push({ id, src: BlobURL.get(id, f.blob) }); }
    showGallery(L.map(x => ({ src: x.src })), Math.max(0, L.findIndex(x => x.id === pid))); });
}

// ---------- envoi : on choisit les photos, le nom du PDF, puis PDF (4 grandes photos par page) ou photos ----------
async function pnShare(l, opt = {}) {
  const C = await pnContext(l), F = pnFolders(l);
  const groups = [...((l.photos || []).length ? [{ id: '_g', name: 'Général', photos: l.photos }] : []), ...F].filter(d => (d.photos || []).length && (!opt.only || d.id === opt.only));
  const notes = (l.notes || []).flatMap(n => n.photos || []); if (notes.length && !opt.only) groups.push({ id: '_n', name: 'Notes', photos: notes });
  if (!groups.length) return toast('Aucune photo à envoyer');
  const dt = todayISO().split('-').reverse().join('-'), one = opt.only ? groups[0].name : '';
  const defName = avFileName([C.p && C.p.name, C.niv, C.lot && C.lot.name, l.name, one, dt].filter(Boolean).join(' - '));
  const off = new Set();   // photos retirées de l'envoi (touchées)
  const th = {}; for (const g of groups) for (const id of g.photos) { const f = await DB.get('files', id); if (f && f.blob) th[id] = BlobURL.get(id, f.blob); }
  return new Promise((resolve) => {
    const s = sheet(`<div class="form pns"></div>`, { title: 'Envoyer les photos' }); s.onClose = () => resolve();
    const drawS = () => {
      const n = groups.reduce((a, g) => a + g.photos.filter(id => th[id] && !off.has(id)).length, 0);
      $('.pns', s.el).innerHTML = `<label>Nom du fichier (WhatsApp)<input name="fn" value="${esc(defName)}"></label>
        <label>Titre en haut du PDF<input name="tt" value="${esc(l.name)}"></label>
        <label>Photos par page<select name="pp"><option value="4" selected>4 grandes photos</option><option value="2">2 très grandes</option><option value="6">6 photos</option><option value="1">1 photo pleine page</option></select></label>
        <p class="muted" style="margin:0">Touchez une photo pour la retirer de l'envoi · ${n} photo(s) retenue(s)</p>
        ${groups.map(g => `<div class="pns-g"><label class="ck"><input type="checkbox" data-gk="${g.id}" ${g.photos.some(id => !off.has(id)) ? 'checked' : ''}> <b>📁 ${esc(g.name)}</b> <small>${g.photos.filter(id => th[id] && !off.has(id)).length}/${g.photos.filter(id => th[id]).length}</small></label>
          <div class="pns-th">${g.photos.filter(id => th[id]).map(id => `<img src="${th[id]}" data-tg="${id}" class="${off.has(id) ? 'off' : ''}">`).join('')}</div></div>`).join('')}
        <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="ph">${icon('camera')} Photos</button><button class="btn" data-a="pdf">${icon('pdf')} PDF</button></div>`;
      $$('[data-tg]', s.el).forEach(im => im.onclick = () => { const id = im.dataset.tg; off.has(id) ? off.delete(id) : off.add(id); keep(); drawS(); });
      $$('[data-gk]', s.el).forEach(c => c.onchange = () => { const g = groups.find(x => x.id === c.dataset.gk); g.photos.forEach(id => c.checked ? off.delete(id) : off.add(id)); keep(); drawS(); });
      const val = (k) => ($(`[name=${k}]`, s.el) || {}).value || '';
      const sel = () => groups.map(g => ({ name: g.name, photos: g.photos.filter(id => th[id] && !off.has(id)) })).filter(g => g.photos.length);
      $('[data-a=ph]', s.el).onclick = async () => { const G = sel(); if (!G.length) return toast('Aucune photo retenue'); const fn = avFileName(val('fn') || defName); s.close(); await sharePhotos(G.flatMap(g => g.photos), `*${val('tt') || l.name}*${C.niv ? ' · ' + C.niv : ''}\n${G.map(g => `📁 ${g.name} : ${g.photos.length}`).join('\n')}`, fn); };
      $('[data-a=pdf]', s.el).onclick = async () => { const G = sel(); if (!G.length) return toast('Aucune photo retenue'); const fn = avFileName(val('fn') || defName), tt = val('tt') || l.name, pp = +val('pp') || 4;
        const ld = loading('Préparation du PDF…'); try { const b = await pnPdf(C, tt, G, pp, (t) => ld.set && ld.set(t)); ld.close(); s.close(); await shareBlob(b, fn.replace(/\.pdf$/i, '') + '.pdf', { ask: false }); } catch (e) { ld.close(); alertBox('PDF impossible : ' + (e.message || e)); } };
    };
    // les valeurs tapées restent quand on retire une photo
    let memo = {}; const keep = () => { for (const k of ['fn', 'tt', 'pp']) { const i = $(`[name=${k}]`, s.el); if (i) memo[k] = i.value; } setTimeout(() => { for (const [k, v] of Object.entries(memo)) { const i = $(`[name=${k}]`, s.el); if (i) i.value = v; } }, 0); };
    drawS();
  });
}
// image → JPEG réduit pour le PDF (≤ 1600 px), avec ses dimensions
async function pnImg(id) {
  const f = await DB.get('files', id); if (!f || !f.blob) return null;
  const im = await loadImage(BlobURL.get(id, f.blob)), k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  return { d: c.toDataURL('image/jpeg', 0.82), w: c.width, h: c.height, at: f.createdAt || f.at || null };
}
async function pnPdf(C, title, G, per = 4, prog) {
  if (!window.jspdf && window.__late) await window.__late;
  if (!window.jspdf) throw new Error('module PDF indisponible');
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' }), W = 210, H = 297, M = 10;
  const cols = per >= 4 ? 2 : 1, rows = per === 6 ? 3 : per === 1 ? 1 : 2, top = 30, cap = 6, gw = (W - 2 * M - (cols - 1) * 6) / cols, gh = (H - top - 14 - (rows - 1) * 6) / rows - cap;
  const sub = [C.p && C.p.name, C.niv, C.lot && C.lot.name].filter(Boolean).join(' · '), date = fmtDate(todayISO());
  let first = true, n = 0; const total = G.reduce((a, g) => a + g.photos.length, 0);
  const head = (gname, cont) => {
    doc.setFillColor(15, 37, 64); doc.rect(0, 0, W, 22, 'F'); doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(String(title).slice(0, 70), M, 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`${sub}${sub ? ' · ' : ''}${date}`.slice(0, 110), M, 16.5);
    doc.setTextColor(15, 37, 64); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(`${gname}${cont ? ' (suite)' : ''}`.slice(0, 80), M, 28 - 1);
  };
  for (const g of G) {
    for (let i = 0; i < g.photos.length; i += per) {
      if (!first) doc.addPage('a4', 'p'); first = false; head(g.name, i > 0);
      const chunk = g.photos.slice(i, i + per);
      for (let j = 0; j < chunk.length; j++) {
        prog && prog(`Préparation du PDF… ${++n}/${total}`);
        const im = await pnImg(chunk[j]); if (!im) continue;
        const cx = M + (j % cols) * (gw + 6), cy = top + Math.floor(j / cols) * (gh + cap + 6), k = Math.min(gw / im.w, gh / im.h), w = im.w * k, h = im.h * k;
        doc.setDrawColor(220, 226, 236); doc.rect(cx, cy, gw, gh);
        doc.addImage(im.d, 'JPEG', cx + (gw - w) / 2, cy + (gh - h) / 2, w, h);
        doc.setTextColor(60, 70, 85); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        doc.text(`${g.name} · ${i + j + 1}/${g.photos.length}${im.at ? ' · ' + fmtDate(new Date(im.at).toISOString().slice(0, 10)) : ''}`.slice(0, 80), cx, cy + gh + 4);
      }
    }
  }
  const N = doc.getNumberOfPages();
  for (let i = 1; i <= N; i++) { doc.setPage(i); doc.setTextColor(140, 150, 165); doc.setFontSize(8); doc.text(`SiteTeam · ${title}`.slice(0, 90), M, H - 6); doc.text(`${i} / ${N}`, W - M, H - 6, { align: 'right' }); }
  return doc.output('blob');
}

// ---------- barre des lots (Plans › niveau › lot) : les pins photos des plans de ce niveau et de ce lot ----------
function pnLotBlock(p, L, f, redraw) {
  const el = document.createElement('div'); el.className = 'pnl';
  (async () => {
    const plans = (await DB.byProject('plans', p.id)).filter(x => x.folderId === f.id && !x.archived && (x.lotId === L.id || !x.lotId));
    const ids = new Set(plans.map(x => x.id)), pins = (await DB.byProject('links', p.id)).filter(x => x.kind === 'photonote' && ids.has(x.planId));
    el.innerHTML = `<div class="pnl-h"><span>📷 Photos · ${esc(L.name)}</span><button class="btn small ghost" data-a="pnnew">${icon('plus')} Pin photos</button></div>
      ${pins.length ? `<div class="pnl-l">${pins.map(x => `<button data-pn="${x.id}"><b>${esc(x.name)}</b><small>${pnFolders(x).length ? pnFolders(x).map(d => esc(d.name)).slice(0, 3).join(' · ') + ' · ' : ''}${pnCount(x)} photo(s)</small></button>`).join('')}</div>` : '<div class="pnl-e">Placez un pin photos sur un plan de ce niveau (Porte provisoire, Brique, Nettoyage…).</div>'}`;
    $$('[data-pn]', el).forEach(b => b.onclick = async () => { const x = pins.find(y => y.id === b.dataset.pn); await openPhotoNote(x, typeof planCtx === 'function' ? planCtx(() => {}) : {}); redraw(); });
    $('[data-a=pnnew]', el).onclick = async () => {
      const L2 = plans.filter(x => x.lotId === L.id).length ? plans.filter(x => x.lotId === L.id) : plans;
      if (!L2.length) return toast('Ajoutez d\'abord un plan à ce niveau');
      const id = L2.length === 1 ? L2[0].id : await menu('Sur quel plan ?', L2.map(x => ({ label: x.name, icon: 'plans', value: x.id }))); if (!id) return;
      const pl = L2.find(x => x.id === id); toast('Touchez le plan à l\'endroit du pin photos');
      await openPlanViewer(pl, { ...(typeof planCtx === 'function' ? planCtx(() => {}) : {}), startTool: 'photonote' }); redraw();
    };
  })();
  return el;
}
