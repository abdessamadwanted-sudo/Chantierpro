// ================= Plans : indices (mises à jour), comparaison entre indices, import AutoCAD (DXF) =================
// Un plan mis à jour devient un nouvel « indice » (A → B → C…) : les pins, tâches, locaux et dessins
// sont reportés automatiquement sur le nouvel indice ; l'ancien reste consultable dans l'historique.

const planIndice = (p) => (p && p.indice) || 'A';
const planSerie = (p) => (p && (p.serieId || p.id));
const nextIndice = (i) => { i = String(i || 'A').trim().toUpperCase(); if (/^[A-Y]$/.test(i)) return String.fromCharCode(i.charCodeAt(0) + 1); if (/^\d+$/.test(i)) return String(+i + 1); return i + '1'; };
const isCurrentPlan = (p) => !p.supersededBy;

async function planHistory(plan) {
  const all = await DB.byProject('plans', plan.projectId);
  return all.filter(p => planSerie(p) === planSerie(plan)).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}
// dernier indice d'une série (plan de niveau)
async function latestPlanOfSerie(projectId, serieId, plans) {
  const all = plans || await DB.byProject('plans', projectId);
  const s = all.filter(p => planSerie(p) === serieId);
  return s.find(isCurrentPlan) || s.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null;
}

// ---------- Fichier → image de plan (PDF, image, AutoCAD DXF) ----------
// renvoie [{ fileId, pdfFileId, pdfPage, dxfFileId, w, h, name }]
async function fileToPlanImages(file, projectId, ld, onlyPage) {
  const base = file.name.replace(/\.[^.]+$/, '');
  if (/\.dwg$/i.test(file.name)) {
    await alertBox('Le format DWG est fermé et ne peut pas être lu sur le téléphone.\n\nDans AutoCAD : « Enregistrer sous… » → AutoCAD DXF (ou demandez le DXF au bureau d\'études), puis importez le fichier .dxf — il s\'affiche comme un plan, avec pins et indices.');
    return [];
  }
  if (/\.dxf$/i.test(file.name)) {
    if (ld) ld.set('Lecture du plan AutoCAD (DXF)…');
    await needDXF();
    const D = dxfFlatten(new DxfParser().parseSync(await file.text()));
    const { canvas } = dxfRender(D, [], 5000);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
    const src = await DB.put('files', { projectId, blob: file, mime: 'application/dxf', role: 'plansrc', name: file.name });
    const f = await DB.put('files', { projectId, blob, mime: 'image/jpeg', role: 'plan', w: canvas.width, h: canvas.height, name: file.name });
    return [{ fileId: f.id, dxfFileId: src.id, w: canvas.width, h: canvas.height, name: base }];
  }
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    let pages = await pdfToImages(file, 5000, (p, n) => ld && ld.set(`Conversion PDF… page ${p}/${n}`));
    if (onlyPage) pages = pages.filter(pg => pg.page === onlyPage).concat(pages).slice(0, 1);
    const src = await DB.put('files', { projectId, blob: file, mime: 'application/pdf', role: 'plansrc', name: file.name });
    const out = [];
    for (const pg of pages) {
      const f = await DB.put('files', { projectId, blob: pg.blob, mime: 'image/jpeg', role: 'plan', w: pg.w, h: pg.h, name: file.name });
      out.push({ fileId: f.id, pdfFileId: src.id, pdfPage: pg.page, w: pg.w, h: pg.h, name: pages.length > 1 && !onlyPage ? `${base} - p${pg.page}` : base });
    }
    return out;
  }
  if (isRasterImage(file)) {
    const f = await saveImageFile(projectId, file, 'plan');
    return [{ fileId: f.id, w: f.w, h: f.h, name: base }];
  }
  await alertBox(`Format non pris en charge : ${file.name}`);
  return [];
}

// ---------- Nouvel indice ----------
const scalePts = (pts, kx, ky) => (pts || []).map(p => [p[0] * kx, p[1] * ky]);
function scaleAnnot(a, kx, ky) {
  const k = Math.sqrt(kx * ky), b = { ...a, id: DB.uid() };
  if (a.pts) b.pts = scalePts(a.pts, kx, ky);
  if (a.sw) b.sw = a.sw * k; if (a.fs) b.fs = a.fs * k;
  return b;
}
function scaleGeom(o, kx, ky) {
  if (o.x != null) o.x *= kx; if (o.y != null) o.y *= ky;
  if (o.w != null) o.w *= kx; if (o.h != null) o.h *= ky;
  if (Array.isArray(o.pts)) o.pts = scalePts(o.pts, kx, ky);
}

async function newPlanIndice(plan) {
  const [file] = await pickFiles({ accept: 'image/*,application/pdf,.dxf,.dwg,application/dxf,application/octet-stream', multiple: false });
  if (!file) return null;
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const r = await formSheet(`Nouvel indice — ${plan.name}`, [
    { name: 'ind', label: `Indice (actuel : ${planIndice(plan)})`, value: nextIndice(planIndice(plan)) },
    ...(isPdf ? [{ name: 'page', label: 'Page du PDF (si le PDF a plusieurs pages)', type: 'number', value: String(plan.pdfPage || 1) }] : []),
    { name: 'note', label: 'Objet de la modification (optionnel)', type: 'textarea', placeholder: 'Ex : déplacement cloison local 12, ajout porte…' },
  ], { okLabel: 'Mettre à jour le plan' });
  if (!r) return null;
  const ld = loading('Import du nouvel indice…');
  let np, moved = { links: 0, tasks: 0, locaux: 0 }, flagged = [];
  try {
    const [img] = await fileToPlanImages(file, plan.projectId, ld, isPdf ? (+r.page || 1) : undefined);
    if (!img) { ld.close(); return null; }
    const kx = img.w / plan.w, ky = img.h / plan.h;
    np = await DB.put('plans', {
      projectId: plan.projectId, folderId: plan.folderId, fileId: img.fileId, pdfFileId: img.pdfFileId || null, pdfPage: img.pdfPage || null, dxfFileId: img.dxfFileId || null,
      w: img.w, h: img.h, name: plan.name, annotations: (plan.annotations || []).map(a => scaleAnnot(a, kx, ky)),
      indice: (r.ind || nextIndice(planIndice(plan))).toUpperCase(), serieId: planSerie(plan), prevId: plan.id, indiceNote: r.note || '', indiceDate: todayISO(),
    });
    if (!plan.indice) plan.indice = 'A';
    if (!plan.serieId) plan.serieId = plan.id;
    plan.supersededBy = np.id; await DB.put('plans', plan);
    // zones modifiées entre les deux indices (pour signaler les pins à vérifier)
    ld.set('Recherche des modifications…');
    let diff = null; try { diff = await planDiff(plan, np, 1400); } catch (e) { console.warn('diff', e); }
    const inChange = (x, y) => diff && diff.rects.some(q => x >= q.x - q.pad && x <= q.x + q.w + q.pad && y >= q.y - q.pad && y <= q.y + q.h + q.pad);
    ld.set('Report des pins sur le nouvel indice…');
    for (const l of await DB.byProject('links', plan.projectId)) {
      let ch = false;
      if (l.planId === plan.id) {
        scaleGeom(l, kx, ky); l.planId = np.id; ch = true;
        if (l.kind === 'local') moved.locaux++; else moved.links++;
        const cx = l.w != null ? l.x + l.w / 2 : l.x, cy = l.h != null ? l.y + l.h / 2 : l.y;
        if (inChange(cx, cy)) { l.checkIndice = np.indice; flagged.push(l.name || 'Pin'); } else delete l.checkIndice;
      }
      if (l.targetPlanId === plan.id) { l.targetPlanId = np.id; ch = true; }
      for (const z of l.zones || []) for (const pt of z.parts || []) for (const d of pt.docs || []) if (d.planId === plan.id) { d.planId = np.id; ch = true; }
      for (const it of l.items || []) if (it.planId === plan.id) { it.planId = np.id; ch = true; }
      if (ch) await DB.put('links', l);
    }
    for (const t of await DB.byProject('tasks', plan.projectId)) {
      if (t.planId !== plan.id) continue;
      if (t.x != null) { t.x *= kx; t.y *= ky; }
      t.planId = np.id; moved.tasks++;
      if (t.x != null && inChange(t.x, t.y)) flagged.push(`Tâche #${t.num || ''}`);
      await DB.put('tasks', t);
    }
    np.changeCount = diff ? diff.rects.length : null; await DB.put('plans', np);
  } catch (e) { ld.close(); console.error(e); alertBox('Mise à jour impossible : ' + (e.message || e)); return null; }
  ld.close();
  const v = await menu(`Indice ${np.indice} créé ✓\n${moved.locaux + moved.links} pin(s) et ${moved.tasks} tâche(s) reportés automatiquement.${np.changeCount != null ? `\n${np.changeCount} zone(s) modifiée(s) détectée(s).` : ''}${flagged.length ? `\n⚠ ${flagged.length} pin(s) dans une zone modifiée : vérifiez leur position (${flagged.slice(0, 6).join(', ')}${flagged.length > 6 ? '…' : ''}).` : ''}`, [
    { label: `Voir les modifications (Ind. ${planIndice(plan)} → ${np.indice})`, icon: 'layers', value: 'cmp' },
    { label: 'OK', icon: 'check', value: 'ok' },
  ]);
  if (v === 'cmp') await openPlanCompare(plan, np);
  return np;
}

// menu « Indices » d'un plan (historique, comparer, nouvel indice)
async function planIndicesMenu(plan, { onNew, onOpen } = {}) {
  const hist = await planHistory(plan);
  const prev = hist.find(p => p.id === plan.prevId) || null;
  const v = await menu(`${plan.name} · Indice ${planIndice(plan)}`, [
    { label: 'Mettre à jour le plan (nouvel indice)', icon: 'upload', value: 'new' },
    ...(prev ? [{ label: `Comparer avec l'indice ${planIndice(prev)}`, icon: 'layers', value: 'cmp' }] : []),
    ...(hist.length > 2 ? [{ label: 'Comparer deux indices au choix', icon: 'layers', value: 'cmp2' }] : []),
    ...(hist.length > 1 ? [{ label: `Historique des indices (${hist.length})`, icon: 'history', value: 'hist' }] : []),
  ]);
  if (v === 'new') { const np = await newPlanIndice(plan); if (np && onNew) onNew(np); }
  if (v === 'cmp') openPlanCompare(prev, plan);
  if (v === 'cmp2') {
    const opts = hist.map(p => ({ label: `Indice ${planIndice(p)}${p.indiceDate ? ' · ' + fmtDate(p.indiceDate) : ''}${p.indiceNote ? ' · ' + p.indiceNote : ''}`, value: p.id }));
    const a = await menu('Ancien indice', opts); if (!a) return;
    const b = await menu('Nouvel indice', opts.filter(o => o.value !== a)); if (!b) return;
    openPlanCompare(hist.find(p => p.id === a), hist.find(p => p.id === b));
  }
  if (v === 'hist') {
    const id = await menu('Historique des indices', hist.slice().reverse().map(p => ({ label: `Indice ${planIndice(p)}${isCurrentPlan(p) ? ' (actuel)' : ''}${p.indiceDate ? ' · ' + fmtDate(p.indiceDate) : ''}${p.indiceNote ? ' · ' + p.indiceNote : ''}`, icon: 'plans', value: p.id, checked: p.id === plan.id })));
    if (id && onOpen) onOpen(hist.find(p => p.id === id));
  }
}

// ---------- Détection des modifications entre deux indices ----------
// encre (traits sombres) de chaque plan → « supprimé » (rouge) / « ajouté » (vert), puis regroupement en zones encadrées
async function planImageData(plan, W, H) {
  const src = await fileURL(plan.fileId); if (!src) throw new Error('Image du plan introuvable');
  const img = await loadImage(src);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
  return g.getImageData(0, 0, W, H);
}
function inkMap(id) {
  const d = id.data, n = id.width * id.height, m = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) m[i] = (d[j] * 0.3 + d[j + 1] * 0.59 + d[j + 2] * 0.11) < 170 ? 1 : 0;
  return m;
}
function dilate(m, W, H, r) {
  const t = new Uint8Array(m.length), o = new Uint8Array(m.length);
  for (let y = 0; y < H; y++) { const row = y * W; let run = -1e9; for (let x = 0; x < W; x++) { if (m[row + x]) run = x; if (x - run <= r) t[row + x] = 1; } run = 1e9; for (let x = W - 1; x >= 0; x--) { if (m[row + x]) run = x; if (run - x <= r) t[row + x] = 1; } }
  for (let x = 0; x < W; x++) { let run = -1e9; for (let y = 0; y < H; y++) { if (t[y * W + x]) run = y; if (y - run <= r) o[y * W + x] = 1; } run = 1e9; for (let y = H - 1; y >= 0; y--) { if (t[y * W + x]) run = y; if (run - y <= r) o[y * W + x] = 1; } }
  return o;
}
// rects en coordonnées du NOUVEAU plan (pixels de son image)
async function planDiff(oldPlan, newPlan, maxSide = 1800) {
  const k = Math.min(1, maxSide / Math.max(newPlan.w, newPlan.h));
  const W = Math.max(50, Math.round(newPlan.w * k)), H = Math.max(50, Math.round(newPlan.h * k));
  const [A, B] = await Promise.all([planImageData(oldPlan, W, H), planImageData(newPlan, W, H)]);
  const a = inkMap(A), b = inkMap(B), r = Math.max(1, Math.round(W / 900));
  const da = dilate(a, W, H, r), db = dilate(b, W, H, r);
  const out = new ImageData(W, H), o = out.data;
  const CELL = Math.max(8, Math.round(W / 110)), CW = Math.ceil(W / CELL), CH = Math.ceil(H / CELL), cells = new Uint16Array(CW * CH);
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const j = i * 4; let R = 255, G = 255, Bc = 255;
    if (a[i] && !db[i]) { R = 220; G = 38; Bc = 38; cells[((y / CELL) | 0) * CW + ((x / CELL) | 0)]++; }        // supprimé (ancien seulement)
    else if (b[i] && !da[i]) { R = 22; G = 163; Bc = 74; cells[((y / CELL) | 0) * CW + ((x / CELL) | 0)]++; }   // ajouté (nouveau seulement)
    else if (a[i] || b[i]) { R = G = Bc = 150; }                                                                 // inchangé
    o[j] = R; o[j + 1] = G; o[j + 2] = Bc; o[j + 3] = 255;
  }
  // zones : cellules significatives voisines regroupées
  const TH = Math.max(4, CELL * 0.35), seen = new Uint8Array(CW * CH), rects = [];
  for (let s = 0; s < cells.length; s++) {
    if (seen[s] || cells[s] < TH) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, tot = 0; const q = [s]; seen[s] = 1;
    while (q.length) { const c = q.pop(), cx = c % CW, cy = (c / CW) | 0; tot += cells[c]; x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= CW || ny >= CH) continue; const n = ny * CW + nx; if (!seen[n] && cells[n] >= TH) { seen[n] = 1; q.push(n); } } }
    if (tot < CELL * 1.5) continue;
    const iK = 1 / k; rects.push({ x: x0 * CELL * iK, y: y0 * CELL * iK, w: (x1 - x0 + 1) * CELL * iK, h: (y1 - y0 + 1) * CELL * iK, pad: CELL * 2 * iK, n: tot });
  }
  rects.sort((p, q) => (p.y - q.y) || (p.x - q.x));
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(out, 0, 0);
  return { canvas: c, rects, W, H, k };
}

// ---------- Zoom / déplacement générique (plan + calque SVG) ----------
function panZoom(viewport, stage, W, H, { onTap, onChange } = {}) {
  const st = { s: 1, tx: 0, ty: 0, fit: 1 };
  const P = new Map(); let pinch = null, start = null, raf = 0;
  const clamp = () => { const vw = viewport.clientWidth, vh = viewport.clientHeight, M = 60, pw = W * st.s, ph = H * st.s;
    st.tx = pw <= vw ? (vw - pw) / 2 : Math.min(M, Math.max(vw - pw - M, st.tx)); st.ty = ph <= vh ? (vh - ph) / 2 : Math.min(M, Math.max(vh - ph - M, st.ty)); };
  const apply = () => { clamp(); stage.style.transform = `translate(${st.tx}px,${st.ty}px) scale(${st.s})`; if (onChange && !raf) raf = requestAnimationFrame(() => { raf = 0; onChange(st); }); };
  const fit = () => { const vw = viewport.clientWidth, vh = viewport.clientHeight; st.s = st.fit = Math.min(vw / W, vh / H) * 0.97; st.tx = (vw - W * st.s) / 2; st.ty = (vh - H * st.s) / 2; apply(); };
  const rel = (e) => { const r = viewport.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const toImg = ([x, y]) => [(x - st.tx) / st.s, (y - st.ty) / st.s];
  const zoomAt = ([x, y], ns) => { ns = Math.max(st.fit * 0.8, Math.min(st.fit * 40, ns)); const ix = (x - st.tx) / st.s, iy = (y - st.ty) / st.s; st.s = ns; st.tx = x - ix * ns; st.ty = y - iy * ns; apply(); };
  viewport.style.touchAction = 'none';
  viewport.addEventListener('pointerdown', (e) => {
    try { viewport.setPointerCapture(e.pointerId); } catch (x) {}
    P.set(e.pointerId, rel(e));
    if (P.size === 1) start = { p: rel(e), t: Date.now(), tx: st.tx, ty: st.ty, moved: false };
    if (P.size === 2) { const [p1, p2] = [...P.values()]; pinch = { d: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) || 1, s: st.s, img: toImg([(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]) }; if (start) start.moved = true; }
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!P.has(e.pointerId)) return; P.set(e.pointerId, rel(e));
    if (P.size >= 2 && pinch) { const [p1, p2] = [...P.values()], m = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      const ns = Math.max(st.fit * 0.8, Math.min(st.fit * 40, pinch.s * Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) / pinch.d));
      st.s = ns; st.tx = m[0] - pinch.img[0] * ns; st.ty = m[1] - pinch.img[1] * ns; apply(); return; }
    if (P.size === 1 && start) { const p = rel(e), dx = p[0] - start.p[0], dy = p[1] - start.p[1];
      if (!start.moved && Math.hypot(dx, dy) > 8) start.moved = true;
      if (start.moved) { st.tx = start.tx + dx; st.ty = start.ty + dy; apply(); } }
  });
  const up = (e) => {
    if (!P.has(e.pointerId)) return; const p = P.get(e.pointerId); P.delete(e.pointerId);
    if (P.size < 2) pinch = null;
    if (P.size === 1) { const q = [...P.values()][0]; start = { p: q, t: Date.now(), tx: st.tx, ty: st.ty, moved: true }; return; }
    if (P.size === 0 && start && !start.moved && Date.now() - start.t < 500 && e.type === 'pointerup' && onTap) {
      const now = Date.now();
      if (api._lastTap && now - api._lastTap.t < 300 && Math.hypot(p[0] - api._lastTap.p[0], p[1] - api._lastTap.p[1]) < 30) { api._lastTap = null; zoomAt(p, st.s * 2.2); }
      else { api._lastTap = { t: now, p }; onTap(toImg(p), p); }
    }
    start = null;
  };
  viewport.addEventListener('pointerup', up); viewport.addEventListener('pointercancel', up);
  viewport.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(rel(e), st.s * (e.deltaY < 0 ? 1.2 : 1 / 1.2)); }, { passive: false });
  const api = {
    st, fit, apply, toImg, zoomAt,
    zoomTo(x, y, w, h) { const vw = viewport.clientWidth, vh = viewport.clientHeight; st.s = Math.max(st.fit, Math.min(st.fit * 40, Math.min(vw / (w * 1.6), vh / (h * 1.6)))); st.tx = vw / 2 - (x + w / 2) * st.s; st.ty = vh / 2 - (y + h / 2) * st.s; apply(); },
  };
  return api;
}

// ---------- Écran de comparaison ----------
async function openPlanCompare(oldPlan, newPlan) {
  if (!oldPlan || !newPlan) return;
  const ld = loading('Comparaison des indices…');
  let D; try { D = await planDiff(oldPlan, newPlan, 2200); } catch (e) { ld.close(); return alertBox('Comparaison impossible : ' + (e.message || e)); }
  const [srcOld, srcNew] = await Promise.all([fileURL(oldPlan.fileId), fileURL(newPlan.fileId)]);
  ld.close();
  const diffURL = D.canvas.toDataURL('image/png');
  const W = newPlan.w, H = newPlan.h;
  let mode = 'diff', boxes = true;
  const el = document.createElement('div'); el.className = 'fullpage av-page';
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button>
      <div class="tb-title" style="flex:1"><b>${esc(newPlan.name)}</b><span>Comparaison indice ${esc(planIndice(oldPlan))} → ${esc(planIndice(newPlan))}</span></div>
      <button class="iconbtn" data-a="share" title="Partager">${icon('share')}</button></div>
    <div class="av-chips cmp-modes"><button data-m="diff" class="on">Superposition</button><button data-m="old">Ind. ${esc(planIndice(oldPlan))}</button><button data-m="new">Ind. ${esc(planIndice(newPlan))}</button><button data-m="box" class="on">▢ Zones</button></div>
    <div class="av-view"><div class="av-stage"><img width="${W}" height="${H}" src="${diffURL}"><svg class="av-ov" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"></svg></div></div>
    <div class="cmp-legend"><span><i style="background:#dc2626"></i>Supprimé (ancien)</span><span><i style="background:#16a34a"></i>Ajouté (nouveau)</span><span><i style="background:#969696"></i>Inchangé</span>
      <button class="btn small" data-a="list">${D.rects.length} modification(s)</button></div>`;
  document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
  const view = $('.av-view', el), stage = $('.av-stage', el), img = $('img', stage), ov = $('.av-ov', el);
  const drawBoxes = (s) => {
    const lw = 2.5 / s, fs = 14 / s;
    ov.innerHTML = !boxes ? '' : D.rects.map((q, i) => `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="rgba(239,68,68,.06)" stroke="#ef4444" stroke-width="${lw}" stroke-dasharray="${6 / s} ${4 / s}" rx="${4 / s}"/>
      <g transform="translate(${q.x},${q.y})"><circle r="${11 / s}" fill="#ef4444"/><text y="${4.5 / s}" text-anchor="middle" font-size="${fs * 0.85}" font-weight="700" fill="#fff" font-family="Arial">${i + 1}</text></g>`).join('');
  };
  const pz = panZoom(view, stage, W, H, { onChange: (st) => drawBoxes(st.s) });
  requestAnimationFrame(pz.fit);
  const setMode = (m) => { mode = m; img.src = m === 'old' ? srcOld : m === 'new' ? srcNew : diffURL; $$('[data-m]', el).forEach(b => b.classList.toggle('on', b.dataset.m === mode || (b.dataset.m === 'box' && boxes))); };
  $$('[data-m]', el).forEach(b => b.onclick = () => { if (b.dataset.m === 'box') { boxes = !boxes; drawBoxes(pz.st.s); setMode(mode); } else setMode(b.dataset.m); });
  $('[data-a=list]', el).onclick = async () => {
    if (!D.rects.length) return toast('Aucune modification détectée');
    const i = await menu('Modifications détectées', D.rects.map((q, i) => ({ label: `Zone ${i + 1}`, icon: 'zone', value: String(i) })));
    if (i != null) { const q = D.rects[+i]; pz.zoomTo(q.x, q.y, q.w, q.h); }
  };
  $('[data-a=share]', el).onclick = async () => {
    const c = document.createElement('canvas'); c.width = D.W; c.height = D.H + 60; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(D.canvas, 0, 60);
    g.fillStyle = '#111'; g.font = 'bold 26px Arial'; g.fillText(`${newPlan.name} — indice ${planIndice(oldPlan)} → ${planIndice(newPlan)}`, 16, 38);
    g.strokeStyle = '#ef4444'; g.lineWidth = 3; g.fillStyle = '#ef4444'; g.font = 'bold 18px Arial';
    D.rects.forEach((q, i) => { g.strokeRect(q.x * D.k, q.y * D.k + 60, q.w * D.k, q.h * D.k); g.fillText(String(i + 1), q.x * D.k + 4, q.y * D.k + 60 + 18); });
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    shareBlob(blob, `${newPlan.name} - comparaison ${planIndice(oldPlan)}-${planIndice(newPlan)}.jpg`.replace(/[\\/:*?"<>|]+/g, '-'));
  };
}
