// ================= Modèles 3D : coffrage (tracé sur plan) + ferraillage (nomenclature → cage) =================
// Les modèles sont enregistrés dans project.models3d (synchronisés avec le projet).
const M3D_STATUS = [
  { k: 'todo', l: 'Non commencé', c: '#94a3b8' }, { k: 'coffre', l: 'Coffré', c: '#f59e0b' },
  { k: 'recept', l: 'Réceptionné', c: '#22c55e' }, { k: 'coule', l: 'Coulé', c: '#3b82f6' }, { k: 'reserve', l: 'Avec réserve', c: '#ef4444' },
];
const DIA_COLORS = { 6: '#a3e635', 8: '#facc15', 10: '#fb923c', 12: '#f97316', 14: '#f472b6', 16: '#ef4444', 20: '#a855f7', 25: '#3b82f6', 32: '#06b6d4', 40: '#14b8a6' };
const kgm = (d) => (+d) ** 2 * 0.00617;
const nfx = (n, d = 2) => (isFinite(n) ? n : 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

const _scripts = {};
function loadScript(src) { return _scripts[src] || (_scripts[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Module non chargé : ' + src)); document.head.appendChild(s); })); }
async function need3D() { await loadScript('vendor/3d/three.min.js'); await loadScript('vendor/3d/OrbitControls.js'); }
async function needOCR() { await loadScript('vendor/3d/tesseract.min.js'); }

const m3colors = (p) => Object.fromEntries(M3D_STATUS.map(s => [s.k, (p.colors3d || {})[s.k] || s.c]));
async function saveModel(pid, m) {
  const p = await DB.get('projects', pid); p.models3d = p.models3d || [];
  const i = p.models3d.findIndex(x => x.id === m.id); m.updatedAt = Date.now();
  if (i >= 0) p.models3d[i] = m; else p.models3d.push(m);
  await DB.put('projects', p); return p;
}

// ---------- Liste des modèles (section du projet) ----------
async function renderModels3D(root, filter) {
  const p = await DB.get('projects', App.project.id);
  const C = m3colors(p);
  const list = (p.models3d || []).filter(m => !filter || m.linkId === filter).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const PT = (p.poutres || []);
  root.innerHTML = `<div class="pagehead"><h2>Modèles 3D</h2><p>Coffrage tracé sur plan · ferraillage depuis la nomenclature</p></div>
    <button class="pt-entry" data-a="pt3"><span>🧱</span><div class="grow"><b>Poutres 3D</b><small>${PT.length ? `${PT.length} poutre(s) · ` : ''}depuis le plan de ferraillage (Arche / Graitec) ou saisie</small></div>${icon('chevright')}</button>
    ${PT.length ? `<div class="list">${PT.map(P => `<div class="row" data-pt="${P.id}"><span class="m3-ic" style="background:linear-gradient(135deg,#a855f7,#4c1d95)">🧱</span><div class="grow"><div class="title">${esc(P.name || 'Poutre')}${P.niv ? ' · ' + esc(P.niv) : ''}</div><div class="sub">${P.b}×${P.h} · portée ${P.L} cm · ${(P.bars || []).length} positions · ${nfx(ptTotKg(P), 1)} kg</div></div></div>`).join('')}</div>` : ''}
    ${list.length ? `<div class="list">${list.map(m => `<div class="row" data-id="${m.id}"><span class="m3-ic" style="background:${m.type === 'ferraillage' ? 'linear-gradient(135deg,#ef4444,#7f1d1d)' : m.type === 'dxf' ? 'linear-gradient(135deg,#22c55e,#14532d)' : 'linear-gradient(135deg,#60a5fa,#1e40af)'}">${icon(m.type === 'ferraillage' ? 'rows' : m.type === 'dxf' ? 'layers' : 'cube')}</span>
      <div class="grow"><div class="title">${esc(m.name)}</div><div class="sub">${m.type === 'dxf' ? `Plan AutoCAD · ${(m.zones || []).length} partie(s) d'ouvrage` : m.type === 'ferraillage' ? `Ferraillage${m.mode === 'elem' ? ' ' + FER_ELEMS[m.elem.kind].l.toLowerCase() : ''} · ${(m.bars || []).length} repère(s) · ${nfx(ferTotalKg(m), 0)} kg` : `Coffrage · ${nfx(cofCalc(m).vol)} m³`} · <span style="color:${C[m.status || 'todo']}">● ${(M3D_STATUS.find(s => s.k === (m.status || 'todo')) || {}).l}</span></div></div>${icon('chevright')}</div>`).join('')}</div>`
    : `<div class="empty">Aucun modèle 3D.<br>Appuyez sur <b>+</b> : coffrage tracé sur un plan, ou ferraillage lu depuis le plan PDF.</div>`}`;
  $$('.row[data-id]', root).forEach(r => r.onclick = async () => { await openAnyModel(list.find(m => m.id === r.dataset.id)); renderModels3D(root, filter); });
  $$('.row[data-pt]', root).forEach(r => r.onclick = async () => { const P = PT.find(x => x.id === r.dataset.pt); if (P) await ptOpen(p, P); renderModels3D(root, filter); });
  $('[data-a=pt3]', root).onclick = async () => { const P = await ptNew(p); if (P) await ptOpen(p, P); renderModels3D(root, filter); };
  fab(root, async () => { const m = await newModelFlow(); if (m) { await openAnyModel(m); renderModels3D(root, filter); } });
}

const openAnyModel = (m) => m.type === 'dxf' ? openDxfPlan(m) : openModel(m);
async function newModelFlow(preset = {}) {
  const v = await menu('Nouveau modèle 3D', [
    { label: 'Coffrage — tracer sur un plan', icon: 'cube', value: 'cof' },
    { label: 'Coffrage — dimensions (rectangle)', icon: 'edit', value: 'cofr' },
    { label: 'Ferraillage — lire la nomenclature du plan PDF', icon: 'pdf', value: 'ferocr' },
    { label: 'Ferraillage détaillé par élément (semelle, poteau, poutre, dalle, voile)', icon: 'rows', value: 'ferelem' },
    { label: 'Ferraillage — saisie manuelle', icon: 'rows', value: 'ferman' },
    { label: 'Plan AutoCAD (DXF) — parties d\'ouvrage colorées par état', icon: 'layers', value: 'dxf' },
  ]);
  if (!v) return null;
  const pid = App.project.id;
  const base = { id: DB.uid(), projectId: pid, name: preset.name || '', linkId: preset.linkId || null, status: 'todo', createdAt: Date.now() };
  if (v === 'ferelem') return newElemModel(base);
  if (v === 'dxf') return newDxfModel(base);
  if (v === 'cofr') {
    const r = await formSheet('Coffrage — dimensions', [{ name: 'name', label: 'Ouvrage', value: base.name, placeholder: 'Ex : Poteau P12 R+5' },
      { name: 'kind', label: 'Type', type: 'select', value: 'poteau', options: [{ value: 'poteau', label: 'Poteau / voile' }, { value: 'dalle', label: 'Dalle / radier' }, { value: 'poutre', label: 'Poutre' }] },
      { name: 'L', label: 'Longueur (m)', type: 'number', placeholder: '0,40' }, { name: 'l', label: 'Largeur / épaisseur (m)', type: 'number', placeholder: '0,60' },
      { name: 'h', label: 'Hauteur (m)', type: 'number', placeholder: '3,00' }], { okLabel: 'Créer en 3D' });
    if (!r) return null;
    const L = num(r.L), l = num(r.l), h = num(r.h); if (!(L > 0 && l > 0 && h > 0)) { toast('Dimensions incomplètes'); return null; }
    const m = { ...base, type: 'coffrage', kind: r.kind, name: r.name || 'Coffrage', poly: [[0, 0], [L, 0], [L, l], [0, l]], h };
    await saveModel(pid, m); return m;
  }
  if (v === 'cof') {
    const src = await pickPlanSource(preset.planId); if (!src) return null;
    const res = await traceOnPlan(src); if (!res) return null;
    const m = { ...base, type: 'coffrage', kind: res.kind, name: res.name || base.name || 'Coffrage', poly: res.poly, h: res.h, planId: src.planId || null };
    await saveModel(pid, m); return m;
  }
  if (v === 'ferocr') {
    const src = await pickPlanSource(preset.planId, true); if (!src) return null;
    const bars = await ocrNomenclature(src); if (!bars) return null;
    const m = { ...base, type: 'ferraillage', name: base.name || src.name || 'Ferraillage', bars, member: { kind: 'poutre', b: 40, h: 60, L: 6, c: 3, incl: 0 } };
    autoPlace(m); await saveModel(pid, m); return m;
  }
  if (v === 'ferman') {
    const r = await formSheet('Ferraillage', [{ name: 'name', label: 'Ouvrage', value: base.name, placeholder: 'Ex : Poteau P12 R+5' },
      { name: 'kind', label: 'Élément', type: 'select', value: 'poteau', options: [{ value: 'poteau', label: 'Poteau' }, { value: 'poutre', label: 'Poutre' }, { value: 'voile', label: 'Voile' }] },
      { name: 'b', label: 'Section b (cm)', type: 'number', value: '40' }, { name: 'h', label: 'Section h (cm)', type: 'number', value: '60' },
      { name: 'L', label: 'Longueur / hauteur (m)', type: 'number', value: '3' }, { name: 'long', label: 'Filantes (ex : 6 HA16)', value: '6 HA16' },
      { name: 'cad', label: 'Cadres (ex : HA8 e=15)', value: 'HA8 e=15' }], { okLabel: 'Créer en 3D' });
    if (!r) return null;
    const L = num(r.L) || 3, bars = [];
    const ml = String(r.long).match(/(\d+)\s*HA\s*(\d+)/i); if (ml) bars.push({ rep: '001', dia: +ml[2], nb: +ml[1], long: Math.round(L * 100 + 80), code: '0.00', dims: '', place: 'long' });
    const mc = String(r.cad).match(/HA\s*(\d+).*?e\s*=?\s*(\d+)/i); if (mc) bars.push({ rep: '002', dia: +mc[1], nb: Math.max(1, Math.floor(L * 100 / +mc[2])), long: 0, code: '5.20', dims: '', place: 'cadre' });
    const m = { ...base, type: 'ferraillage', name: r.name || 'Ferraillage', bars, member: { kind: r.kind, b: num(r.b) || 40, h: num(r.h) || 60, L, c: 3, incl: 0 } };
    await saveModel(pid, m); return m;
  }
}

// Choisir un plan du projet ou un fichier (PDF / image)
async function pickPlanSource(planId, preferPdf) {
  const pid = App.project.id;
  if (planId) { const pl = await DB.get('plans', planId); if (pl) return planSrc(pl, preferPdf); }
  const plans = await DB.byProject('plans', pid);
  const v = await menu('Quel plan ?', [{ label: 'Fichier du téléphone (PDF / image)', icon: 'phone', value: '__file' }, ...plans.slice(0, 40).map(p => ({ label: p.name, icon: 'plans', value: p.id }))]);
  if (!v) return null;
  if (v === '__file') { const [f] = await pickFiles({ accept: 'application/pdf,image/*', multiple: false }); if (!f) return null; return { name: f.name.replace(/\.[^.]+$/, ''), blob: f, isPdf: /pdf/i.test(f.type) || /\.pdf$/i.test(f.name) }; }
  return planSrc(plans.find(p => p.id === v), preferPdf);
}
async function planSrc(pl, preferPdf) {
  const pdf = preferPdf && pl.pdfFileId ? await DB.get('files', pl.pdfFileId) : null;
  if (pdf && pdf.blob) return { name: pl.name, blob: pdf.blob, isPdf: true, planId: pl.id };
  const f = await DB.get('files', pl.fileId); return { name: pl.name, blob: f.blob, isPdf: false, planId: pl.id };
}
// Rend une source en image (canvas). PDF : 1re page, résolution choisie.
async function renderSource(src, maxPx = 2400, crop) {
  if (src.isPdf) {
    await pdfReadyA();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await src.blob.arrayBuffer()) }).promise;
    const page = await pdf.getPage(1), vp1 = page.getViewport({ scale: 1 });
    let scale = maxPx / Math.max(vp1.width, vp1.height), ox = 0, oy = 0, W = vp1.width, H = vp1.height;
    if (crop) { scale = maxPx / Math.max(crop.w * vp1.width, crop.h * vp1.height); ox = crop.x * vp1.width; oy = crop.y * vp1.height; W = crop.w * vp1.width; H = crop.h * vp1.height; }
    const c = document.createElement('canvas'); c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, viewport: page.getViewport({ scale, offsetX: -ox * scale, offsetY: -oy * scale }) }).promise;
    pdf.destroy(); return c;
  }
  const bmp = await createImageBitmap(src.blob);
  const sx = crop ? crop.x * bmp.width : 0, sy = crop ? crop.y * bmp.height : 0, sw = crop ? crop.w * bmp.width : bmp.width, sh = crop ? crop.h * bmp.height : bmp.height;
  const k = Math.min(crop ? 3 : 1, maxPx / Math.max(sw, sh));
  const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  c.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height); return c;
}

// ---------- Visionneuse de plan avec zoom / déplacement + outils (étalonnage, tracé, sélection) ----------
function planStage(el, canvas) {
  const stage = $('.ps-stage', el), cv = $('.ps-cv', el), ov = $('.ps-ov', el);
  cv.width = canvas.width; cv.height = canvas.height; cv.getContext('2d').drawImage(canvas, 0, 0);
  ov.width = canvas.width; ov.height = canvas.height;
  let k = Math.min(stage.clientWidth / canvas.width, stage.clientHeight / canvas.height), tx = 0, ty = 0;
  const fit = () => { tx = (stage.clientWidth - canvas.width * k) / 2; ty = (stage.clientHeight - canvas.height * k) / 2; };
  fit();
  const apply = () => { [cv, ov].forEach(c => c.style.transform = `translate(${tx}px,${ty}px) scale(${k})`); };
  apply();
  const pts = new Map(); let last = null, d0 = 0, k0 = 1, moved = 0, onTap = null, onDrag = null, dragStart = null;
  const toImg = (x, y) => { const r = stage.getBoundingClientRect(); return [(x - r.left - tx) / k, (y - r.top - ty) / k]; };
  stage.addEventListener('pointerdown', e => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; last = [e.clientX, e.clientY];
    if (pts.size === 2) { const [a, b] = [...pts.values()]; d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); k0 = k; dragStart = null; }
    else if (onDrag) dragStart = toImg(e.clientX, e.clientY); });
  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]), cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2; const r = stage.getBoundingClientRect();
      const nk = Math.max(0.05, Math.min(8, k0 * d / d0)); tx = cx - r.left - (cx - r.left - tx) * nk / k; ty = cy - r.top - (cy - r.top - ty) * nk / k; k = nk; apply(); moved = 99; return; }
    moved += Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]);
    if (dragStart && onDrag) { onDrag(dragStart, toImg(e.clientX, e.clientY), false); return; }
    tx += e.clientX - prev[0]; ty += e.clientY - prev[1]; apply();
  });
  const up = e => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (dragStart && onDrag && moved > 6) onDrag(dragStart, toImg(e.clientX, e.clientY), true);
    else if (moved < 8 && onTap && !pts.size) onTap(toImg(e.clientX, e.clientY));
    dragStart = null; };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', e => { e.preventDefault(); const r = stage.getBoundingClientRect(), nk = Math.max(0.05, Math.min(8, k * (e.deltaY < 0 ? 1.15 : 0.87))); tx = e.clientX - r.left - (e.clientX - r.left - tx) * nk / k; ty = e.clientY - r.top - (e.clientY - r.top - ty) * nk / k; k = nk; apply(); }, { passive: false });
  return { ov, g: ov.getContext('2d'), scale: () => k, set tap(f) { onTap = f; }, set drag(f) { onDrag = f; }, fit: () => { k = Math.min(stage.clientWidth / canvas.width, stage.clientHeight / canvas.height); fit(); apply(); } };
}
function planPage(title) {
  const el = document.createElement('div'); el.className = 'fullpage ps-page';
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('close')}</button><h1 style="flex:1;font-size:17px">${esc(title)}</h1></div>
    <div class="ps-step"></div><div class="ps-stage"><canvas class="ps-cv"></canvas><canvas class="ps-ov"></canvas></div><div class="ps-bar"></div>`;
  document.body.appendChild(el); return el;
}

// ---------- Coffrage : étalonnage + tracé ----------
function traceOnPlan(src) {
  return new Promise(async (resolve) => {
    const el = planPage(`Coffrage · ${src.name}`);
    const unBack = pushBack(() => { el.remove(); resolve(null); });
    $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); resolve(null); };
    const ld = loading('Ouverture du plan…'); let canvas; try { canvas = await renderSource(src, 3000); } finally { ld.close(); }
    const S = planStage(el, canvas);
    let step = 'cal', cal = [], mpp = 0, poly = [];
    const lw = () => 3 / S.scale();
    const draw = () => {
      const g = S.g; g.clearRect(0, 0, S.ov.width, S.ov.height);
      if (cal.length) { g.strokeStyle = '#2563eb'; g.lineWidth = lw(); g.beginPath(); g.moveTo(...cal[0]); if (cal[1]) g.lineTo(...cal[1]); g.stroke(); cal.forEach(p => { g.fillStyle = '#2563eb'; g.beginPath(); g.arc(p[0], p[1], lw() * 2.5, 0, 7); g.fill(); }); }
      if (poly.length) { g.strokeStyle = '#ef4444'; g.fillStyle = 'rgba(239,68,68,.18)'; g.lineWidth = lw(); g.beginPath(); g.moveTo(...poly[0]); poly.slice(1).forEach(p => g.lineTo(...p)); if (step === 'done') g.closePath(); g.fill(); g.stroke();
        poly.forEach((p, i) => { g.fillStyle = i ? '#ef4444' : '#fff'; g.strokeStyle = '#ef4444'; g.beginPath(); g.arc(p[0], p[1], lw() * 2.6, 0, 7); g.fill(); g.stroke(); }); }
    };
    const ui = () => {
      const st = $('.ps-step', el), bar = $('.ps-bar', el);
      if (step === 'cal') { st.innerHTML = `<b>① Étalonnage</b> — touchez les 2 extrémités d'une cote connue (ex : entre 2 axes). Zoom à 2 doigts.`;
        bar.innerHTML = `<button data-b="reset">Effacer</button>`; }
      if (step === 'trace') { st.innerHTML = `<b>② Tracé</b> — touchez les angles de l'ouvrage, dans l'ordre. ${poly.length} point(s).`;
        bar.innerHTML = `<button data-b="undo">↶ Annuler</button><button data-b="close" class="ok" ${poly.length < 3 ? 'disabled' : ''}>✓ Fermer le contour</button>`; }
      $$('[data-b]', bar).forEach(b => b.onclick = () => act(b.dataset.b));
    };
    const act = async (a) => {
      if (a === 'reset') { cal = []; draw(); }
      if (a === 'undo') { poly.pop(); draw(); ui(); }
      if (a === 'close') {
        step = 'done'; draw();
        const r = await formSheet('Créer en 3D', [{ name: 'name', label: 'Ouvrage', placeholder: 'Ex : Voile CR 75 R+5' },
          { name: 'kind', label: 'Type', type: 'select', value: 'poteau', options: [{ value: 'poteau', label: 'Voile / poteau (hauteur)' }, { value: 'dalle', label: 'Dalle / radier (épaisseur)' }] },
          { name: 'h', label: 'Hauteur / épaisseur (m)', type: 'number', value: '3' }], { okLabel: 'Créer en 3D' });
        if (!r) { step = 'trace'; draw(); return; }
        const o = poly[0], pm = poly.map(p => [+((p[0] - o[0]) * mpp).toFixed(3), +(-(p[1] - o[1]) * mpp).toFixed(3)]);
        unBack(); el.remove(); resolve({ poly: pm, h: num(r.h) || 3, kind: r.kind, name: r.name });
      }
    };
    S.tap = async (p) => {
      if (step === 'cal') {
        cal.push(p); if (cal.length > 2) cal = [p]; draw();
        if (cal.length === 2) {
          const r = await formSheet('Longueur de cette cote', [{ name: 'd', label: 'Distance réelle (m)', type: 'number', placeholder: 'Ex : 5,00' }], { okLabel: 'Valider' });
          const d = r && num(r.d); if (!d) { cal = []; draw(); return; }
          mpp = d / Math.hypot(cal[1][0] - cal[0][0], cal[1][1] - cal[0][1]); step = 'trace'; cal = []; draw(); ui(); toast('Échelle enregistrée ✓');
        }
      } else if (step === 'trace') { poly.push(p); draw(); ui(); }
    };
    draw(); ui();
  });
}
const polyArea = (P) => Math.abs(P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const polyPerim = (P) => P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]; return a + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0);
function cofCalc(m) {
  if (m.type !== 'coffrage') return { vol: 0 };
  const A = polyArea(m.poly), P = polyPerim(m.poly), h = m.h;
  return { A, P, vol: A * h, surf: m.kind === 'dalle' ? A + P * h : P * h };
}

// ---------- Ferraillage : lecture de la nomenclature (OCR) ----------
function ocrNomenclature(src) {
  return new Promise(async (resolve) => {
    const el = planPage(`Nomenclature · ${src.name}`);
    const unBack = pushBack(() => { el.remove(); resolve(null); });
    $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); resolve(null); };
    const ld = loading('Ouverture du plan…'); let canvas; try { canvas = await renderSource(src, 2600); } finally { ld.close(); }
    const S = planStage(el, canvas);
    let rect = null;
    $('.ps-step', el).innerHTML = `<b>Encadrez le tableau des barres</b> (Rep. · Dia. · Nb · Long. · Forme) : appuyez sur « Encadrer » puis glissez le doigt. Zoom à 2 doigts.`;
    $('.ps-bar', el).innerHTML = `<button data-b="sel">▭ Encadrer</button><button data-b="go" class="ok" disabled>🔍 Lire le tableau</button>`;
    const draw = () => { const g = S.g; g.clearRect(0, 0, S.ov.width, S.ov.height); if (!rect) return; g.fillStyle = 'rgba(37,99,235,.15)'; g.strokeStyle = '#2563eb'; g.lineWidth = 3 / S.scale(); g.fillRect(rect.x, rect.y, rect.w, rect.h); g.strokeRect(rect.x, rect.y, rect.w, rect.h); };
    $('[data-b=sel]', el).onclick = (e) => { e.target.classList.toggle('on'); S.drag = e.target.classList.contains('on') ? (a, b, end) => { rect = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) }; draw(); if (end) { $('[data-b=go]', el).disabled = false; $('[data-b=sel]', el).classList.remove('on'); S.drag = null; } } : null; };
    $('[data-b=go]', el).onclick = async () => {
      if (!rect || rect.w < 20) return toast('Encadrez d\'abord le tableau');
      const crop = { x: rect.x / canvas.width, y: rect.y / canvas.height, w: rect.w / canvas.width, h: rect.h / canvas.height };
      const ld2 = loading('Lecture du tableau… (quelques secondes)');
      try {
        await needOCR();
        const base = new URL('vendor/3d/', location.href).href;
        const worker = await Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true, logger: (m) => { if (m.status === 'recognizing text') ld2.set(`Lecture du tableau… ${Math.round(m.progress * 100)} %`); } });
        await worker.setParameters({ tessedit_pageseg_mode: '6' });
        // tableaux souvent côte à côte : lecture de l'ensemble + de bandes verticales, puis fusion
        const parts = [crop]; const nStrip = crop.w > crop.h * 1.3 ? 3 : crop.w > crop.h * 0.8 ? 2 : 0;
        for (let i = 0; i < nStrip; i++) parts.push({ x: crop.x + crop.w * Math.max(0, i / nStrip - 0.04), y: crop.y, w: crop.w * (1 / nStrip + 0.08), h: crop.h });
        let txt = '';
        for (const [i, c] of parts.entries()) { ld2.set(`Lecture du tableau… ${i + 1}/${parts.length}`); const img = await renderSource(src, i ? 3400 : 4600, c); const { data } = await worker.recognize(img); txt += '\n' + data.text; }
        await worker.terminate();
        ld2.close();
        const bars = parseNomenclature(txt);
        if (!bars.length) { alertBox('Aucune barre reconnue. Encadrez seulement le tableau (avec les lignes 001, 002…), en zoomant plus.'); return; }
        const ok = await editBars(bars, `${bars.length} repère(s) lus — vérifiez`);
        if (ok) { unBack(); el.remove(); resolve(ok); }
      } catch (e) { ld2.close(); console.error(e); alertBox('Lecture impossible : ' + (e.message || e)); }
    };
  });
}
function parseNomenclature(txt) {
  const out = [];
  for (let line of String(txt).split(/\n/)) {
    line = line.replace(/[|\[\]{}]/g, ' ').replace(/H\s*A/g, 'HA').replace(/HA\s*Z(\d)/gi, 'HA2$1').replace(/HA\s*[Il](\d)/g, 'HA1$1').replace(/\b[O0]([O0-9]{2})\b/g, (m) => m.replace(/O/g, '0')).replace(/\bO(\d\d)/g, '0$1');
    // plusieurs barres peuvent être sur la même ligne (tableaux côte à côte)
    const re = /\b(\d{3})\s*[\/)(]?\s*HA\s?(\d{1,2})\D{1,6}(\d{1,3})\D{1,6}(\d{1,3})\D{1,6}(\d{1,3})\D{1,6}(\d{2,4})\D{1,4}(\d)[.,](\d{2})/g;
    let m; while ((m = re.exec(line))) {
      const rest = line.slice(m.index + m[0].length, m.index + m[0].length + 60);
      const dims = (rest.match(/[ABCDE]\s*[=\-:]\s*\d{1,4}/gi) || []).map(x => x.replace(/\s/g, '').replace(/[-:]/, '=').toUpperCase()).join(' ');
      const al = (rest.match(/(\d{2,3})\s*°/) || [])[1];
      out.push({ rep: m[1], dia: +m[2], nbElem: +m[3], nbBar: +m[4], nb: +m[5], long: +m[6], code: `${m[7]}.${m[8]}`, dims: dims + (al ? ` α=${al}` : ''), place: '' });
    }
  }
  const seen = new Set(); return out.filter(b => !seen.has(b.rep) && seen.add(b.rep)).sort((a, b) => a.rep.localeCompare(b.rep));
}
const DIAS = [6, 8, 10, 12, 14, 16, 20, 25, 32, 40];
const PLACES = [['long-inf', 'Filantes inférieures'], ['long-sup', 'Filantes supérieures'], ['long', 'Filantes réparties'], ['cadre', 'Cadres'], ['epingle', 'Épingles'], ['libre', 'Barre seule (affichage)']];
function editBars(bars, title) {
  return new Promise((resolve) => {
    const s = sheet(`<div class="fb-wrap"><div class="fb-head"><span>Rep</span><span>Ø</span><span>Nb</span><span>Long cm</span><span>Forme</span><span></span></div><div class="fb-list"></div>
      <button class="btn ghost small" data-a="add">${icon('plus')} Ajouter un repère</button>
      <div class="fb-tot"></div>
      <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="ok">${icon('check')} Valider</button></div></div>`, { title });
    s.onClose = () => resolve(null);
    const draw = () => {
      $('.fb-list', s.el).innerHTML = bars.map((b, i) => `<div class="fb-row" data-i="${i}"><input data-f="rep" value="${esc(b.rep)}"><select data-f="dia">${DIAS.map(d => `<option ${+b.dia === d ? 'selected' : ''}>${d}</option>`).join('')}</select>
        <input data-f="nb" inputmode="numeric" value="${b.nb}"><input data-f="long" inputmode="numeric" value="${b.long}"><input data-f="code" value="${esc(b.code)}"><button class="iconbtn sm" data-del="${i}">${icon('close')}</button>
        <input class="fb-dims" data-f="dims" value="${esc(b.dims || '')}" placeholder="Dimensions : A=… B=… α=…"><button class="iconbtn sm fb-draw" data-draw="${i}" title="Dessiner la forme">✎</button></div>`).join('');
      const kg = bars.reduce((a, b) => a + (+b.nb) * (+b.long) / 100 * kgm(b.dia), 0);
      $('.fb-tot', s.el).innerHTML = `Total : <b>${nfx(kg, 1)} kg</b> · ${bars.length} repère(s) — comparez avec le « total » du plan`;
      $$('.fb-row', s.el).forEach(r => { const b = bars[+r.dataset.i]; $$('[data-f]', r).forEach(inp => inp.onchange = () => { b[inp.dataset.f] = ['dia', 'nb', 'long'].includes(inp.dataset.f) ? num(inp.value) : inp.value; draw(); }); });
      $$('[data-del]', s.el).forEach(x => x.onclick = () => { bars.splice(+x.dataset.del, 1); draw(); });
      $$('[data-draw]', s.el).forEach(x => x.onclick = async () => { const b = bars[+x.dataset.draw]; const r = await drawBarShape({ path: b.path, dia: b.dia }); if (r) { b.path = r.pts; b.dims = r.dims; b.long = r.long; b.dia = r.dia; b.code = 'dessin'; draw(); } });
    };
    $('[data-a=add]', s.el).onclick = () => { bars.push({ rep: String(bars.length + 1).padStart(3, '0'), dia: 12, nb: 1, long: 100, code: '0.00', dims: '', place: '' }); draw(); };
    $('[data-a=c]', s.el).onclick = () => s.close();
    $('[data-a=ok]', s.el).onclick = () => { s.onClose = null; s.close(); resolve(bars); };
    draw();
  });
}
// placement automatique : cadres (forme 5.xx / A,B petits), sinon filantes alternées
function autoPlace(m) {
  let t = 0;
  for (const b of m.bars) {
    if (b.place) continue;
    const d = dimsOf(b);
    if (/^5\./.test(b.code) || (d.A && d.B && b.long < 400 && /^[25]\./.test(b.code))) b.place = 'cadre';
    else b.place = (t++ % 2) ? 'long-sup' : 'long-inf';
  }
  const longest = Math.max(...m.bars.map(b => +b.long || 0)); if (longest > 0) m.member.L = +(longest / 100).toFixed(2);
}
const dimsOf = (b) => { const o = {}; String(b.dims || '').replace(/([ABCDE])\s*=\s*(\d+)/gi, (_, k, v) => { o[k.toUpperCase()] = +v; }); const a = String(b.dims || '').match(/α\s*=?\s*(\d+)/); if (a) o.alpha = +a[1]; return o; };
const ferTotalKg = (m) => (m.bars || []).reduce((a, b) => a + (+b.nb || 0) * (+b.long || 0) / 100 * kgm(b.dia), 0);

// ---------- Vue 3D ----------
async function openModel(m) {
  await need3D();
  const p = await DB.get('projects', m.projectId);
  const C = m3colors(p);
  return new Promise((resolve) => {
    const el = document.createElement('div'); el.className = 'fullpage v3page'; document.body.appendChild(el);
    const unBack = pushBack(() => close());
    let renderer, raf, ro;
    const close = () => { cancelAnimationFrame(raf); ro && ro.disconnect(); renderer && renderer.dispose(); el.remove(); resolve(); };
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:17px">${esc(m.name)}</h1>
        <button class="iconbtn" data-a="snap" title="Capture">${icon('camera')}</button><button class="iconbtn" data-a="more">${icon('more')}</button></div>
      <div class="v3-stage"><div class="v3-views"><button data-v="3d">3D</button><button data-v="top">Dessus</button><button data-v="front">Face</button><button data-v="side">Côté</button></div><button class="v3-full" data-a="full" title="Plein écran">${icon('expand')}</button></div>
      <div class="v3-panel"></div>`;
    $('[data-a=x]', el).onclick = () => { unBack(); close(); };
    const stage = $('.v3-stage', el);
    const T = THREE;
    const scene = new T.Scene(); scene.background = new T.Color('#e9edf2');
    const cam = new T.PerspectiveCamera(45, 1, 0.01, 2000);
    renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    stage.prepend(renderer.domElement);
    const ctl = new T.OrbitControls(cam, renderer.domElement); ctl.enableDamping = true;
    scene.add(new T.HemisphereLight('#ffffff', '#64748b', 0.9)); const dl = new T.DirectionalLight('#ffffff', 0.7); dl.position.set(5, 10, 7); scene.add(dl);
    const grp = new T.Group(); scene.add(grp);
    let info = '';
    if (m.type === 'dxf') {
      buildDxfZones(T, grp, m, C);
      info = `<div class="v3-bars">${m.zones.map((z, i) => `<button class="v3-bar" data-zi="${i}"><i style="background:${C[z.status || 'todo']}"></i><b>${esc(z.name)}</b> ${z.kind === 'dalle' ? 'ép.' : 'h'} ${nfx(z.h)} m<span>${(M3D_STATUS.find(s => s.k === (z.status || 'todo')) || {}).l}</span></button>`).join('')}</div>`;
    } else if (m.mode === 'elem') {
      buildElem(T, grp, m);
      const kg = ferTotalKg(m), E = FER_ELEMS[m.elem.kind];
      info = `<div class="v3-bars">${m.groups.map((g, i) => { const b = m.bars[i] || {}; return `<button class="v3-bar" data-gi="${i}"><i style="background:${DIA_COLORS[g.dia] || '#888'}"></i><div class="v3-bt"><b>${esc((E.roles[g.role] || [g.role])[0])}</b>${g.zone ? ' · ' + esc(g.zone) : ''}<br><small>${b.nb} HA${g.dia}${g.esp && !g.nb && g.role !== 'long' ? ' e=' + g.esp : ''} · ${b.long} cm${g.start ? ' · début ' + g.start : ''}</small></div><span>${nfx(b.nb * b.long / 100 * kgm(g.dia), 1)} kg</span></button>`; }).join('')}</div>
        <div class="v3-kv"><span>Poids total acier</span><b style="color:#15803d">${nfx(kg, 1)} kg</b></div>
        <div class="v3-kv"><span>${esc(E.l)}</span><b>${ferElemDims(m)} cm</b></div>
        <div class="btnrow" style="padding:0;margin-top:8px"><button class="btn ghost small" data-a="groups">${icon('edit')} Modifier les barres et dimensions</button></div>`;
    } else if (m.type === 'coffrage') {
      const sh = new T.Shape(m.poly.map(([x, y]) => new T.Vector2(x, y)));
      const geo = new T.ExtrudeGeometry(sh, { depth: m.h, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
      const mat = new T.MeshStandardMaterial({ color: C[m.status || 'todo'], roughness: .7, metalness: .05 });
      const mesh = new T.Mesh(geo, mat); grp.add(mesh);
      grp.add(new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: '#1e293b' })));
      const r = cofCalc(m);
      info = `<div class="v3-kv"><span>Volume béton</span><b style="color:#15803d">${nfx(r.vol)} m³</b></div><div class="v3-kv"><span>Surface coffrage</span><b style="color:#1d4ed8">${nfx(r.surf, 1)} m²</b></div>
        <div class="v3-kv"><span>Section</span><b>${nfx(r.A)} m² · périmètre ${nfx(r.P)} m</b></div><div class="v3-kv"><span>${m.kind === 'dalle' ? 'Épaisseur' : 'Hauteur'}</span><b>${nfx(m.h)} m</b></div>`;
      mesh.userData.mat = mat;
      grp.userData.recolor = (c) => mat.color.set(c);
    } else {
      buildCage(T, grp, m);
      const kg = ferTotalKg(m);
      info = `<div class="v3-bars">${m.bars.map((b, i) => `<button class="v3-bar" data-bi="${i}"><i style="background:${DIA_COLORS[b.dia] || '#888'}"></i><b>${esc(b.rep)}</b> ${b.nb} HA${b.dia} · ${b.long} cm · ${PLACES.find(x => x[0] === b.place)?.[1] || ''}<span>${nfx(b.nb * b.long / 100 * kgm(b.dia), 1)} kg</span></button>`).join('')}</div>
        <div class="v3-kv"><span>Poids total acier</span><b style="color:#15803d">${nfx(kg, 1)} kg</b></div>
        <div class="v3-kv"><span>Élément</span><b>${m.member.kind} ${m.member.b}×${m.member.h} cm · L ${nfx(m.member.L)} m${m.member.incl ? ` · ${m.member.incl}°` : ''}</b></div>
        <div class="btnrow" style="padding:0;margin-top:8px"><button class="btn ghost small" data-a="editbars">${icon('edit')} Repères</button><button class="btn ghost small" data-a="member">${icon('box')} Section / position</button></div>`;
    }
    $('.v3-panel', el).innerHTML = m.type === 'dxf' ? `<div class="v3-hint">Touchez une partie pour changer son état</div>${info}` : `<div class="v3-st">${M3D_STATUS.map(s => `<button data-st="${s.k}" class="${(m.status || 'todo') === s.k ? 'on' : ''}" style="--c:${C[s.k]}"><i></i>${s.l}</button>`).join('')}</div>${info}`;
    // cadrage
    const box = new T.Box3().setFromObject(grp), ctr = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3()).length() || 1;
    const view = (v) => { const d = size * (m.type === 'ferraillage' ? 0.75 : 1.4); const off = { '3d': [1, .8, 1.2], top: [0, 1, 0.0001], front: [0, 0, 1], side: [1, 0, 0] }[v].map(x => x * d);
      cam.position.set(ctr.x + off[0], ctr.y + off[1], ctr.z + off[2]); ctl.target.copy(ctr); ctl.update(); };
    const grid = new T.GridHelper(Math.ceil(size * 3), Math.ceil(size * 3), '#94a3b8', '#cbd5e1'); grid.position.y = box.min.y - 0.001; scene.add(grid);
    view('3d');
    $$('[data-v]', el).forEach(b => b.onclick = () => view(b.dataset.v));
    const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    ro = new ResizeObserver(resize); ro.observe(stage); resize();
    const loop = () => { raf = requestAnimationFrame(loop); ctl.update(); renderer.render(scene, cam); }; loop();
    $$('[data-st]', el).forEach(b => b.onclick = async () => { m.status = b.dataset.st; $$('[data-st]', el).forEach(x => x.classList.toggle('on', x === b)); if (grp.userData.recolor) grp.userData.recolor(C[m.status]); await saveModel(m.projectId, m); toast('État : ' + b.textContent.trim()); });
    $$('[data-bi]', el).forEach(b => b.onclick = () => showBarShape(m.bars[+b.dataset.bi]));
    let selG = null;
    $$('[data-gi]', el).forEach(b => b.onclick = () => { const i = +b.dataset.gi; selG = selG === i ? null : i; $$('[data-gi]', el).forEach(x => x.classList.toggle('on', +x.dataset.gi === selG)); grp.userData.highlight(selG);
      const g = m.groups[i]; if (selG != null && g.role === 'forme' && g.path) showBarShape({ ...m.bars[i], path: g.path }); });
    $$('[data-zi]', el).forEach(b => b.onclick = async () => { const z = m.zones[+b.dataset.zi];
      const v = await menu(z.name, M3D_STATUS.map(s => ({ label: s.l, swatch: C[s.k], value: s.k, checked: (z.status || 'todo') === s.k }))); if (!v) return;
      z.status = v; await saveModel(m.projectId, m); grp.children.forEach(o => { if (o.userData.zone === z) o.material.color.set(C[v]); }); b.querySelector('i').style.background = C[v]; b.querySelector('span').textContent = M3D_STATUS.find(s => s.k === v).l; });
    const gb = $('[data-a=groups]', el); if (gb) gb.onclick = async () => { if (await editGroups(m)) { await saveModel(m.projectId, m); unBack(); close(); openModel(m); } };
    $('[data-a=full]', el).onclick = () => { el.classList.toggle('v3full'); $('[data-a=full]', el).innerHTML = icon(el.classList.contains('v3full') ? 'shrink' : 'expand'); };
    const eb = $('[data-a=editbars]', el); if (eb) eb.onclick = async () => { const r = await editBars(m.bars.map(x => ({ ...x })), 'Repères'); if (r) { m.bars = r; autoPlace(m); await saveModel(m.projectId, m); unBack(); close(); openModel(m); } };
    const mb = $('[data-a=member]', el); if (mb) mb.onclick = async () => { if (await editMember(m)) { await saveModel(m.projectId, m); unBack(); close(); openModel(m); } };
    $('[data-a=snap]', el).onclick = () => { renderer.render(scene, cam); renderer.domElement.toBlob(b => shareBlob(b, `${safeName(m.name)}_3D.png`), 'image/png'); };
    $('[data-a=more]', el).onclick = async () => {
      const v = await menu(m.name, [{ label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Couleurs des états', icon: 'fill', value: 'col' }, ...(m.type === 'coffrage' ? [{ label: 'Hauteur / épaisseur', icon: 'ruler', value: 'h' }] : []), ...(m.mode === 'elem' ? [{ label: 'Nomenclature (repères)', icon: 'rows', value: 'nom' }] : []), { label: 'Supprimer', icon: 'trash', danger: true, value: 'del' }]);
      if (v === 'nom') { await editBars(m.bars.map(x => ({ ...x })), 'Nomenclature calculée'); }
      if (v === 'ren') { const r = await formSheet('Renommer', [{ name: 'n', label: 'Nom', value: m.name }]); if (r && r.n) { m.name = r.n; await saveModel(m.projectId, m); $('h1', el).textContent = m.name; } }
      if (v === 'h') { const r = await formSheet('Hauteur', [{ name: 'h', label: 'Hauteur / épaisseur (m)', type: 'number', value: String(m.h) }]); if (r && num(r.h)) { m.h = num(r.h); await saveModel(m.projectId, m); unBack(); close(); openModel(m); } }
      if (v === 'col') { const st = await menu('Quel état ?', M3D_STATUS.map(s => ({ label: s.l, swatch: C[s.k], value: s.k }))); if (!st) return;
        const pal = ['#94a3b8', '#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#a855f7', '#14b8a6', '#f97316', '#0ea5e9', '#84cc16'];
        const c = await menu('Couleur', pal.map(x => ({ label: x, swatch: x, value: x }))); if (!c) return;
        const pp = await DB.get('projects', m.projectId); pp.colors3d = { ...(pp.colors3d || {}), [st]: c }; await DB.put('projects', pp); unBack(); close(); openModel(m); }
      if (v === 'del' && await confirmBox('Supprimer ce modèle 3D ?')) { const pp = await DB.get('projects', m.projectId); pp.models3d = (pp.models3d || []).filter(x => x.id !== m.id); await DB.put('projects', pp); unBack(); close(); }
    };
  });
}
async function editMember(m) {
  const M = m.member;
  const r = await formSheet('Section et position des barres', [
    { name: 'kind', label: 'Élément', type: 'select', value: M.kind, options: [{ value: 'poutre', label: 'Poutre (horizontale)' }, { value: 'poteau', label: 'Poteau (vertical)' }, { value: 'voile', label: 'Voile' }] },
    { name: 'b', label: 'Largeur b (cm)', type: 'number', value: String(M.b) }, { name: 'h', label: 'Hauteur h (cm)', type: 'number', value: String(M.h) },
    { name: 'L', label: 'Longueur (m)', type: 'number', value: String(M.L) }, { name: 'c', label: 'Enrobage (cm)', type: 'number', value: String(M.c) },
    { name: 'incl', label: 'Inclinaison (°) — ex : crémaillère 33', type: 'number', value: String(M.incl || 0) },
    ...m.bars.map((b, i) => ({ name: 'p' + i, label: `${b.rep} · ${b.nb} HA${b.dia}`, type: 'select', value: b.place, options: PLACES.map(([v, l]) => ({ value: v, label: l })) })),
  ], { okLabel: 'Appliquer' });
  if (!r) return false;
  Object.assign(M, { kind: r.kind, b: num(r.b) || M.b, h: num(r.h) || M.h, L: num(r.L) || M.L, c: num(r.c) || M.c, incl: num(r.incl) || 0 });
  m.bars.forEach((b, i) => { b.place = r['p' + i] || b.place; });
  return true;
}
// segments d'une barre façonnée (en cm, dans un plan) à partir des dimensions A, B, C… et angles
function barPath(b) {
  if (b.path && b.path.length > 1) return b.path.map(p => [p[0], p[1]]);
  const d = dimsOf(b), keys = ['A', 'B', 'C', 'D', 'E'].filter(k => d[k]);
  if (/^5\./.test(b.code) && d.A && d.B) return [[0, 0], [d.A, 0], [d.A, d.B], [0, d.B], [0, 0], [6, 6]];
  if (!keys.length) return [[0, 0], [+b.long || 100, 0]];
  const pts = [[0, 0]]; let ang = 0;
  keys.forEach((k, i) => { if (i) ang += (i === 1 && d.alpha ? d.alpha : 90) * Math.PI / 180 * (i % 2 ? 1 : -1); const p = pts[pts.length - 1]; pts.push([p[0] + Math.cos(ang) * d[k], p[1] + Math.sin(ang) * d[k]]); });
  return pts;
}
function tube(T, pts, r, color) {
  const g = new T.Group(), mat = new T.MeshStandardMaterial({ color, roughness: .5, metalness: .3 });
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], len = a.distanceTo(b); if (len < 1e-6) continue;
    const cy = new T.Mesh(new T.CylinderGeometry(r, r, len, 8), mat);
    cy.position.copy(a).add(b).multiplyScalar(.5); cy.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(cy);
  }
  return g;
}
function buildCage(T, grp, m) {
  const M = m.member, b = M.b / 100, h = M.h / 100, L = M.L, c = M.c / 100;
  const cage = new T.Group();
  // béton transparent
  const conc = new T.Mesh(new T.BoxGeometry(L, h, b), new T.MeshStandardMaterial({ color: '#94a3b8', transparent: true, opacity: .12 }));
  conc.position.set(L / 2, h / 2, b / 2); cage.add(conc);
  const ed = new T.LineSegments(new T.EdgesGeometry(conc.geometry), new T.LineBasicMaterial({ color: '#64748b' })); ed.position.copy(conc.position); cage.add(ed);
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const longs = m.bars.filter(x => x.place.startsWith('long'));
  for (const bar of m.bars) {
    const r = bar.dia / 2000, col = DIA_COLORS[bar.dia] || '#888', n = Math.max(1, Math.min(+bar.nb || 1, 400));
    const len = Math.min((+bar.long || L * 100) / 100, L * 1.3);
    if (bar.place === 'cadre' || bar.place === 'epingle') {
      const sp = L / (n + 1);
      for (let i = 1; i <= Math.min(n, 120); i++) {
        const x = i * sp;
        const pts = bar.place === 'cadre' ? [V(x, c, c), V(x, c, b - c), V(x, h - c, b - c), V(x, h - c, c), V(x, c, c)] : [V(x, c, b / 2), V(x, h - c, b / 2)];
        cage.add(tube(T, pts, r, col));
      }
    } else if (bar.place === 'libre') {
      // affichée à côté de l'élément
      const pp = barPath(bar).map(([u, v]) => V(u / 100, v / 100 - 0.4 - m.bars.indexOf(bar) * 0.25, -0.3));
      cage.add(tube(T, pp, r, col));
    } else {
      const lay = bar.place === 'long-sup' ? [h - c - r] : bar.place === 'long-inf' ? [c + r] : [c + r, h - c - r];
      const per = Math.max(1, Math.ceil(n / lay.length));
      lay.forEach((y, li) => {
        const k = Math.min(per, n - li * per); if (k <= 0) return;
        for (let j = 0; j < k; j++) {
          const z = k === 1 ? b / 2 : c + r + j * (b - 2 * c - 2 * r) / (k - 1);
          const x0 = Math.max(0, (L - len) / 2);
          cage.add(tube(T, [V(x0, y, z), V(x0 + len, y, z)], r, col));
        }
      });
    }
  }
  if (M.kind === 'poteau' || M.kind === 'voile') cage.rotation.z = Math.PI / 2, cage.position.x = h;
  if (M.incl) cage.rotation.z = M.incl * Math.PI / 180;
  grp.add(cage);
}
// forme d'une barre seule (repère) en 3D
async function showBarShape(bar) {
  await need3D();
  const T = THREE;
  const s = sheet(`<div class="bs-stage"></div><div class="bs-info"><b>${esc(bar.rep)} · ${bar.nb} HA${bar.dia}</b> · L ${bar.long} cm · forme ${esc(bar.code)}<br><small>${esc(bar.dims || '')}</small></div>`, { title: 'Forme de la barre' });
  const st = $('.bs-stage', s.el);
  const sc = new T.Scene(); sc.background = new T.Color('#f1f5f9');
  const cam = new T.PerspectiveCamera(45, 1, 0.01, 100), rd = new T.WebGLRenderer({ antialias: true }); st.appendChild(rd.domElement);
  sc.add(new T.HemisphereLight('#fff', '#64748b', 1));
  const pts = barPath(bar).map(([u, v]) => new T.Vector3(u / 100, v / 100, 0));
  const g = tube(T, pts, Math.max(0.01, bar.dia / 1000), DIA_COLORS[bar.dia] || '#888'); sc.add(g);
  const bx = new T.Box3().setFromObject(g), ct = bx.getCenter(new T.Vector3()), sz = bx.getSize(new T.Vector3()).length() || 1;
  const ctl = new T.OrbitControls(cam, rd.domElement); cam.position.set(ct.x + sz * .3, ct.y + sz * .4, ct.z + sz * 1.2); ctl.target.copy(ct); ctl.update();
  const w = st.clientWidth || 340, h = 260; rd.setSize(w, h); rd.setPixelRatio(Math.min(2, devicePixelRatio)); cam.aspect = w / h; cam.updateProjectionMatrix();
  let raf; const loop = () => { raf = requestAnimationFrame(loop); ctl.update(); rd.render(sc, cam); }; loop();
  const oc = s.onClose; s.onClose = () => { cancelAnimationFrame(raf); rd.dispose(); oc && oc(); };
}
