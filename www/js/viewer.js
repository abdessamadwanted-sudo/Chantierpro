// Visionneuse de plan : zoom, déplacement, pins de tâches, liens (éléments) et annotations
const STATUS = {
  open: { label: 'Ouvert', color: '#ef4444' },
  progress: { label: 'En cours', color: '#f59e0b' },
  done: { label: 'Terminé', color: '#3b82f6' },
  verified: { label: 'Vérifié', color: '#22c55e' },
};
const PALETTE = ['#ff0000', '#008000', '#0000ff', '#ff00ff', '#ff8000', '#ffff00', '#00ff00', '#00ffff', '#ffffff', '#000000'];
const HUES = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#8e24aa', '#d81b60', '#212121'];
// nuance : -1 = très foncé … 0 = normal … +1 = très clair
function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = k < 0 ? 0 : 255, f = Math.abs(k) * 0.75;
  r = Math.round(r + (t - r) * f); g = Math.round(g + (t - g) * f); b = Math.round(b + (t - b) * f);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
const TEXT_SIZES = [8, 12, 16, 22, 30];

function cloudPath(x1, y1, x2, y2, bump) {
  const L = Math.min(x1, x2), R = Math.max(x1, x2), T = Math.min(y1, y2), B = Math.max(y1, y2);
  const pts = [];
  const edge = (ax, ay, bx, by) => {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(len / bump));
    for (let i = 0; i < n; i++) pts.push([ax + (bx - ax) * i / n, ay + (by - ay) * i / n]);
  };
  edge(L, T, R, T); edge(R, T, R, B); edge(R, B, L, B); edge(L, B, L, T);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
    const r = Math.hypot(bx - ax, by - ay) / 2 || 1;
    d += ` A${r},${r} 0 0 1 ${bx},${by}`;
  }
  return d + 'Z';
}

function annotSVG(a) {
  const sw = a.sw;
  const common = `stroke="${a.color}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const [p, q] = a.pts;
  switch (a.type) {
    case 'pen': case 'poly': return `<polyline points="${a.pts.map(pt => pt.join(',')).join(' ')}" ${common}/>`;
    case 'rect': return `<rect x="${Math.min(p[0], q[0])}" y="${Math.min(p[1], q[1])}" width="${Math.abs(q[0] - p[0])}" height="${Math.abs(q[1] - p[1])}" ${common}/>`;
    case 'polygon': return `<polygon points="${a.pts.map(pt => pt.join(',')).join(' ')}" fill="${a.color}" fill-opacity=".55" stroke="${a.color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    case 'disc': { const r = Math.hypot(q[0] - p[0], q[1] - p[1]); return `<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${a.color}" fill-opacity=".8" stroke="${a.color}" stroke-width="${sw / 2}"/>`; }
    case 'box': return `<rect x="${Math.min(p[0], q[0])}" y="${Math.min(p[1], q[1])}" width="${Math.abs(q[0] - p[0])}" height="${Math.abs(q[1] - p[1])}" fill="${a.color}" fill-opacity=".8" stroke="${a.color}" stroke-width="${sw / 2}"/>`;
    case 'ellipse': return `<ellipse cx="${(p[0] + q[0]) / 2}" cy="${(p[1] + q[1]) / 2}" rx="${Math.abs(q[0] - p[0]) / 2}" ry="${Math.abs(q[1] - p[1]) / 2}" ${common}/>`;
    case 'cloud': return `<path d="${cloudPath(p[0], p[1], q[0], q[1], sw * 6)}" ${common}/>`;
    case 'line': return `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" ${common}/>`;
    case 'arrow': {
      const ang = Math.atan2(q[1] - p[1], q[0] - p[0]), h = sw * 5;
      const a1 = [q[0] - h * Math.cos(ang - 0.45), q[1] - h * Math.sin(ang - 0.45)];
      const a2 = [q[0] - h * Math.cos(ang + 0.45), q[1] - h * Math.sin(ang + 0.45)];
      return `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" ${common}/><polygon points="${q.join(',')} ${a1.join(',')} ${a2.join(',')}" fill="${a.color}" stroke="${a.color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    }
    case 'text': return `<text x="${p[0]}" y="${p[1]}" fill="${a.color}" font-size="${a.fs}" font-family="Arial, sans-serif" font-weight="600" paint-order="stroke" stroke="rgba(255,255,255,.7)" stroke-width="${a.fs / 8}">${esc(a.text)}</text>`;
  }
  return '';
}

function annotBBox(a) {
  if (a.type === 'disc') { const [c, e] = a.pts, r = Math.hypot(e[0] - c[0], e[1] - c[1]); return [c[0] - r, c[1] - r, c[0] + r, c[1] + r]; }
  if (a.type === 'text') {
    const w = a.text.length * a.fs * 0.6;
    return [a.pts[0][0], a.pts[0][1] - a.fs, a.pts[0][0] + w, a.pts[0][1] + a.fs * 0.2];
  }
  const xs = a.pts.map(p => p[0]), ys = a.pts.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function hitAnnot(a, x, y, tol) {
  const [x1, y1, x2, y2] = annotBBox(a);
  if (x < x1 - tol || x > x2 + tol || y < y1 - tol || y > y2 + tol) return false;
  if (a.type === 'pen' || a.type === 'poly') {
    for (let i = 1; i < a.pts.length; i++) if (distToSeg(x, y, ...a.pts[i - 1], ...a.pts[i]) < tol) return true;
    return a.pts.length === 1;
  }
  if (a.type === 'line' || a.type === 'arrow') return distToSeg(x, y, ...a.pts[0], ...a.pts[1]) < tol;
  if (a.type === 'text' || a.type === 'box') return true;
  if (a.type === 'polygon') {
    let inside = false;
    for (let i = 0, j = a.pts.length - 1; i < a.pts.length; j = i++) {
      const [xi, yi] = a.pts[i], [xj, yj] = a.pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
    for (let i = 0; i < a.pts.length; i++) if (distToSeg(x, y, ...a.pts[i], ...a.pts[(i + 1) % a.pts.length]) < tol) return true;
    return false;
  }
  if (a.type === 'disc') { const [c, e] = a.pts; return Math.hypot(x - c[0], y - c[1]) <= Math.hypot(e[0] - c[0], e[1] - c[1]) + tol; }
  // formes : proche du contour
  const nearEdge = Math.min(Math.abs(x - x1), Math.abs(x - x2), Math.abs(y - y1), Math.abs(y - y2)) < tol * 1.5;
  return nearEdge || (x2 - x1 < tol * 4) || (y2 - y1 < tol * 4);
}

async function openPlanViewer(plan, ctx) {
  const file = await DB.get('files', plan.fileId);
  const src = file ? BlobURL.get(file.id, file.blob) : '';
  const W = plan.w, H = plan.h;
  const base = Math.max(W, H);
  if (!plan.annotations) plan.annotations = [];
  plan.lastOpened = Date.now(); DB.put('plans', plan);

  const st = {
    scale: 1, tx: 0, ty: 0,
    tool: 'pan', color: '#ff0000', textSize: 16,
    filters: { tasks: true, links: true, annots: true },
    tasks: [], links: [], undo: [], flyout: null, fitScale: 1,
    toolsOpen: true, shape: 'free', pend: null, sel: -1, hue: '#e53935', shade: 0, thick: 4,
    pinSize: (() => { try { return +localStorage.getItem('pinSize') || 1; } catch (e) { return 1; } })(),
  };
  // Taille des pins : proportionnelle au zoom (petits quand on dézoome, limités quand on zoome)
  const strokeW = () => base * st.thick / 1600;
  const pinM = () => Math.max(0.1, Math.min(0.8, Math.pow(st.scale / st.fitScale, 1.15) * 0.18 * st.pinSize));

  const el = document.createElement('div');
  el.className = 'fullpage';
  el.innerHTML = `
    <div class="topbar">
      <button class="iconbtn" data-a="back">${icon('back')}</button>
      <h1>${esc(plan.name)}${plan.supersededBy ? ' <span class="ind-tag old">ancien</span>' : ''}</h1>
      <button class="iconbtn" data-a="ind" title="Indices / mise à jour du plan">${icon('history')}</button>
      <button class="iconbtn" data-a="cmpb" title="Comparer (niveaux / indices)">${icon('layers')}</button>
      <button class="iconbtn" data-a="meas" title="Mesurer (distance · surface)">${icon('ruler')}</button>
      <button class="iconbtn" data-a="filters">${icon('eye')}</button>
      <button class="iconbtn" data-a="more">${icon('more')}</button>
    </div>
    <div class="viewer">
      <div class="stage"><img src="${src}" width="${W}" height="${H}"><canvas class="hd"></canvas><svg class="ov" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <g class="g-annots"></g><g class="g-preview"></g><g class="g-links"></g><g class="g-tasks"></g><g class="g-meas"></g></svg></div>
      <div class="tools"></div>
      <div class="loupe"><div class="lst"><img src="${src}" width="${W}" height="${H}"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g class="l-ann"></g><g class="l-prev"></g></svg></div><div class="cross"></div></div>
    </div>
    <div class="viewer-bottom"><span class="vb-info"></span></div>`;
  document.body.appendChild(el);

  const viewer = $('.viewer', el), stage = $('.stage', el);
  const gAnn = $('.g-annots', el), gPrev = $('.g-preview', el), gLinks = $('.g-links', el), gTasks = $('.g-tasks', el);

  const teardown = () => { window.removeEventListener('resize', fit); el.remove(); ctx.onClose && ctx.onClose(); };
  const close = () => { unBack(); teardown(); };
  const unBack = pushBack(teardown);
  $('[data-a=back]', el).onclick = close;
  if (!ctx.place && typeof planIndiceBar === 'function') planIndiceBar(el, plan, ctx, close).catch(() => {});
  // mode « placer un ouvrage » : un appui sur le plan donne l'emplacement
  if (ctx.place) { const pb = document.createElement('div'); pb.className = 'place-ban'; pb.innerHTML = `<span>📍 Touchez l\u2019emplacement de <b>${esc(ctx.place.label)}</b></span><button>Annuler</button>`; el.appendChild(pb); pb.querySelector('button').onclick = close; }

  // ---------- Transform ----------
  function fit() {
    const vw = viewer.clientWidth, vh = viewer.clientHeight;
    st.scale = Math.min(vw / W, vh / H) * 0.98;
    st.fitScale = st.scale;
    st.tx = (vw - W * st.scale) / 2; st.ty = (vh - H * st.scale) / 2;
    applyT();
  }
  // Empêche le plan de "partir" : centré quand il est plus petit que l'écran, bords tenus sinon
  function clampT() {
    const vw = viewer.clientWidth, vh = viewer.clientHeight, M = 40;
    const pw = W * st.scale, ph = H * st.scale;
    st.tx = pw <= vw ? (vw - pw) / 2 : Math.min(M, Math.max(vw - pw - M, st.tx));
    st.ty = ph <= vh ? (vh - ph) / 2 : Math.min(M, Math.max(vh - ph - M, st.ty));
  }
  let rafPending = false;
  function applyT() {
    clampT();
    scheduleHD();
    stage.style.transform = `translate(${st.tx}px,${st.ty}px) scale(${st.scale})`;
    if (!rafPending) { rafPending = true; requestAnimationFrame(() => { rafPending = false; renderMarkers(); if (typeof renderMeas === 'function') renderMeas(); }); }
  }
  function toImg(cx, cy) {
    const r = viewer.getBoundingClientRect();
    return [(cx - r.left - st.tx) / st.scale, (cy - r.top - st.ty) / st.scale];
  }
  function zoomAt(cx, cy, factor) {
    const r = viewer.getBoundingClientRect();
    const ns = Math.max(st.fitScale, Math.min(st.fitScale * 40, st.scale * factor));
    const k = ns / st.scale;
    st.tx = (cx - r.left) - k * ((cx - r.left) - st.tx);
    st.ty = (cy - r.top) - k * ((cy - r.top) - st.ty);
    st.scale = ns; applyT();
  }

  // ---------- Rendu HD (plans PDF : redessin net de la zone visible) ----------
  const hd = $('.hd', el);
  let pdfPage = null, hdTimer = null, hdTask = null;
  async function loadPdfPage() {
    if (!plan.pdfFileId || !pdfReady()) return null;
    if (pdfPage) return pdfPage;
    try {
      const f = await DB.get('files', plan.pdfFileId);
      if (!f) return null;
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await f.blob.arrayBuffer()) }).promise;
      pdfPage = await doc.getPage(plan.pdfPage || 1);
    } catch (e) { console.error(e); }
    return pdfPage;
  }
  const isCad = !!(plan.dwgFileId || plan.dxfFileId);
  let cad = null, cadP = null;
  async function loadCad() {
    if (!isCad) return null; if (cad) return cad;
    if (!cadP) cadP = (async () => { try { const D = await cadOfPlan(plan); const [x0, y0, x1, y1] = D.box; cad = { D, x0, y0, x1, y1, s: W / (x1 - x0), hidden: plan.hiddenLayers || [] }; } catch (e) { console.warn('cad', e); } return cad; })();
    return cadP;
  }
  // DWG / DXF : la zone visible est redessinée en vectoriel → traits et textes nets à tous les zooms
  async function renderCadHD() {
    const C = await loadCad(); if (!C || g || !el.isConnected) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5), vw = viewer.clientWidth, vh = viewer.clientHeight, sc = st.scale, tx = st.tx, ty = st.ty;
    if (sc * dpr <= 1.05 && !C.hidden.length) { hd.style.display = 'none'; return; }
    const c = document.createElement('canvas'); c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr);
    const gg = c.getContext('2d'); gg.fillStyle = '#fff'; gg.fillRect(0, 0, c.width, c.height); gg.lineJoin = gg.lineCap = 'round';
    const ix0 = -tx / sc, iy0 = -ty / sc, ix1 = (vw - tx) / sc, iy1 = (vh - ty) / sc;
    const clip = [C.x0 + ix0 / C.s, C.y1 - iy1 / C.s, C.x0 + ix1 / C.s, C.y1 - iy0 / C.s];
    cadPaint(canvasDev(gg, sc * dpr), C.D, { color: 'screen', lwMode: 'col', plotAll: true, hidden: C.hidden }, { x0: C.x0, y1: C.y1, k: C.s, ox: tx / sc, oy: ty / sc, clip });
    if (st.scale !== sc || st.tx !== tx || st.ty !== ty) return;
    const ctx2 = hd.getContext('2d'); hd.width = c.width; hd.height = c.height; ctx2.drawImage(c, 0, 0);
    Object.assign(hd.style, { display: 'block', left: ix0 + 'px', top: iy0 + 'px', width: (vw / sc) + 'px', height: (vh / sc) + 'px' });
  }
  function scheduleHD() {
    if (isCad) { clearTimeout(hdTimer); hdTimer = setTimeout(renderCadHD, 180); return; }
    if (!plan.pdfFileId) return;
    clearTimeout(hdTimer);
    hdTimer = setTimeout(renderHD, 220);
  }
  async function renderHD() {
    if (g || !el.isConnected) return scheduleHD();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (st.scale * dpr <= 1.05) { hd.style.display = 'none'; return; } // l'image de base suffit
    const page = await loadPdfPage();
    if (!page) return;
    const vw = viewer.clientWidth, vh = viewer.clientHeight;
    const r0 = W / page.getViewport({ scale: 1 }).width;
    const sc = st.scale, tx = st.tx, ty = st.ty;
    const vp = page.getViewport({ scale: r0 * sc * dpr, offsetX: tx * dpr, offsetY: ty * dpr });
    const c = document.createElement('canvas');
    c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr);
    if (hdTask) { try { hdTask.cancel(); } catch (e) {} }
    hdTask = page.render({ canvasContext: c.getContext('2d'), viewport: vp, background: 'white' });
    try { await hdTask.promise; } catch (e) { return; }
    hdTask = null;
    const ctx2 = hd.getContext('2d');
    hd.width = c.width; hd.height = c.height; ctx2.drawImage(c, 0, 0);
    Object.assign(hd.style, { display: 'block', left: (-tx / sc) + 'px', top: (-ty / sc) + 'px', width: (vw / sc) + 'px', height: (vh / sc) + 'px' });
  }

  // ---------- Mesures : distance, surface, périmètre, coordonnées (aimantation sur les extrémités des DWG/DXF) ----------
  const gMeas = $('.g-meas', el);
  const M = { on: false, mode: 'dist', pts: [], calib: null, snapPts: null };
  const unitM = async () => {   // mètres par pixel de l'image
    if (isCad) { const C = await loadCad(); if (C) { const span = Math.max(C.x1 - C.x0, C.y1 - C.y0), u = DXF_UNITS[C.D.ins] || (span > 2000 ? 0.001 : 1); return u / C.s; } }
    return plan.calib || null;
  };
  async function buildSnap() {
    if (M.snapPts || !isCad) return; const C = await loadCad(); if (!C) return;
    const hid = new Set(C.hidden), arr = [];
    for (const p of C.D.prims) { if (p.t !== 'pl' || hid.has(p.layer)) continue; const P = p.pts; for (let i = 0; i < P.length; i++) { arr.push((P[i][0] - C.x0) * C.s, (C.y1 - P[i][1]) * C.s); if (i && P.length < 6) arr.push(((P[i][0] + P[i - 1][0]) / 2 - C.x0) * C.s, (C.y1 - (P[i][1] + P[i - 1][1]) / 2) * C.s); } }
    M.snapPts = new Float32Array(arr);
  }
  function snap(x, y) {
    const A = M.snapPts; if (!A) return [x, y, false]; const tol = 16 / st.scale; let bd = tol * tol, bx = x, by = y, hit = false;
    for (let i = 0; i < A.length; i += 2) { const dx = A[i] - x, dy = A[i + 1] - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; bx = A[i]; by = A[i + 1]; hit = true; } }
    return [bx, by, hit];
  }
  const fmtL = (m) => m >= 1000 ? (m / 1000).toFixed(3) + ' km' : m >= 1 ? m.toFixed(2) + ' m' : (m * 100).toFixed(1) + ' cm';
  const fmtA = (a) => a >= 1e4 ? (a / 1e4).toFixed(2) + ' ha' : a.toFixed(2) + ' m²';
  let measK = null;
  function renderMeas() {
    if (!M.on) { gMeas.innerHTML = ''; return; }
    const k = 1 / st.scale, P = M.pts, fs = 13 * k, sw = 2.2 * k, r = 5 * k, mk = measK || 0;
    let h = '';
    if (P.length > 1) { const pts = (M.mode === 'area' && P.length > 2 ? [...P, P[0]] : P).map(q => q.join(',')).join(' ');
      if (M.mode === 'area' && P.length > 2) h += `<polygon points="${P.map(q => q.join(',')).join(' ')}" fill="rgba(37,99,235,.18)" stroke="none"/>`;
      h += `<polyline points="${pts}" fill="none" stroke="#fff" stroke-width="${sw * 2.2}" stroke-linejoin="round"/><polyline points="${pts}" fill="none" stroke="${M.calib ? '#f59e0b' : '#2563eb'}" stroke-width="${sw}" stroke-linejoin="round" ${M.mode === 'area' ? '' : ''}/>`;
      if (mk) for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]) * mk, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        h += `<g transform="translate(${mx},${my})"><rect x="${-fs * 2.4}" y="${-fs * 0.85}" width="${fs * 4.8}" height="${fs * 1.5}" rx="${fs * .4}" fill="#111827" opacity=".85"/><text y="${fs * .35}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#fff" font-family="Arial">${fmtL(L)}</text></g>`; } }
    h += P.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="${r}" fill="${i === P.length - 1 ? '#f59e0b' : '#2563eb'}" stroke="#fff" stroke-width="${1.6 * k}"/>`).join('');
    gMeas.innerHTML = h;
  }
  function measResult() {
    const P = M.pts, mk = measK; if (!mk) return { txt: M.calib ? 'Touchez les 2 extrémités d’une cote connue' : 'Échelle inconnue : étalonnez d’abord', v: '' };
    let len = 0; for (let i = 1; i < P.length; i++) len += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    if (M.mode === 'dist') return { txt: P.length < 2 ? 'Touchez les points à mesurer' : `📏 ${fmtL(len * mk)}${P.length > 2 ? ` (${P.length - 1} segments)` : ''}`, v: fmtL(len * mk) };
    if (P.length < 3) return { txt: 'Touchez les sommets de la surface', v: '' };
    let a = 0; for (let i = 0; i < P.length; i++) { const p1 = P[i], p2 = P[(i + 1) % P.length]; a += p1[0] * p2[1] - p2[0] * p1[1]; }
    const per = len + Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]);
    return { txt: `⬛ ${fmtA(Math.abs(a) / 2 * mk * mk)} · périmètre ${fmtL(per * mk)}`, v: `${fmtA(Math.abs(a) / 2 * mk * mk)} (périmètre ${fmtL(per * mk)})` };
  }
  async function measBar() {
    let b = $('.meas-bar', el);
    if (!M.on) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.className = 'meas-bar'; el.appendChild(b); }
    measK = M.calib ? null : await unitM();
    const R = measResult(), C = isCad && cad, last = M.pts[M.pts.length - 1];
    const xy = C && last ? `X ${(C.x0 + last[0] / C.s).toFixed(2)} · Y ${(C.y1 - last[1] / C.s).toFixed(2)}` : '';
    b.innerHTML = `<div class="mb-seg"><button data-m="dist" class="${M.mode === 'dist' ? 'on' : ''}">📏 Distance</button><button data-m="area" class="${M.mode === 'area' ? 'on' : ''}">⬛ Surface</button>${isCad ? '' : `<button data-m="cal" class="${M.calib ? 'on' : ''}">📐 Étalonner</button>`}</div>
      <div class="mb-v">${R.txt}${xy ? `<small>${xy}</small>` : ''}</div>
      <div class="mb-act"><button data-x="undo" ${M.pts.length ? '' : 'disabled'}>↶</button><button data-x="clr" ${M.pts.length ? '' : 'disabled'}>Effacer</button><button data-x="cp" ${R.v ? '' : 'disabled'}>Copier</button><button data-x="end">Fermer</button></div>`;
    $$('[data-m]', b).forEach(x => x.onclick = () => { const m = x.dataset.m; if (m === 'cal') { M.calib = M.calib ? null : 'pick'; M.pts = []; if (M.calib) toast('Touchez les 2 extrémités d’une cote dont vous connaissez la longueur'); } else { if (M.mode !== m) M.pts = []; M.mode = m; M.calib = null; } measBar(); renderMeas(); });
    $$('[data-x]', b).forEach(x => x.onclick = async () => { const a = x.dataset.x; if (a === 'undo') M.pts.pop(); if (a === 'clr') M.pts = []; if (a === 'cp') { try { await navigator.clipboard.writeText(R.v); toast('Copié ✓'); } catch (e) { toast(R.v); } } if (a === 'end') return measToggle(false); measBar(); renderMeas(); });
  }
  async function measToggle(on) {
    M.on = on; M.pts = []; M.calib = null; st.tool = on ? 'measure' : 'pan'; renderTools();
    if (on) { buildSnap(); if (!isCad && !plan.calib) { M.calib = 'pick'; toast('Étalonnage : touchez les 2 extrémités d’une cote connue'); } }
    $('[data-a=meas]', el).classList.toggle('on', on); await measBar(); renderMeas();
  }
  async function measTap(x, y) {
    const [sx, sy, hit] = snap(x, y); if (hit) { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} }
    M.pts.push([sx, sy]);
    if (M.calib && M.pts.length === 2) {
      const px = Math.hypot(M.pts[1][0] - M.pts[0][0], M.pts[1][1] - M.pts[0][1]);
      const r = await formSheet('Étalonnage', [{ name: 'l', label: 'Longueur réelle de ce segment (en mètres)', type: 'number', placeholder: 'Ex : 5.40' }], { okLabel: 'Valider' });
      const L = r && parseFloat(String(r.l).replace(',', '.'));
      if (L > 0 && px > 0) { plan.calib = L / px; await DB.put('plans', plan); toast('Échelle enregistrée pour ce plan ✓'); }
      M.calib = null; M.pts = [];
    }
    await measBar(); renderMeas();
  }
  $('[data-a=meas]', el).onclick = () => measToggle(!M.on);
  // calques (DWG / DXF)
  async function cadLayers() {
    const C = await loadCad(); if (!C) return toast('Plan AutoCAD illisible');
    const names = Object.keys(C.D.layers).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    for (;;) {
      const v = await menu('Calques (toucher pour afficher / masquer)', [{ label: 'Tout afficher', icon: 'eye', value: '__all' }, ...names.map(n => ({ label: `${C.hidden.includes(n) ? '◻' : '☑'} ${n}`, value: n, swatch: C.D.layers[n].color || undefined }))]);
      if (!v) break;
      if (v === '__all') C.hidden = []; else C.hidden = C.hidden.includes(v) ? C.hidden.filter(x => x !== v) : [...C.hidden, v];
    }
    plan.hiddenLayers = C.hidden; await DB.put('plans', plan); M.snapPts = null; if (M.on) buildSnap();
    const ld = loading('Mise à jour du plan…');
    try { const { canvas } = cadRaster(C.D, Math.max(W, H), { hidden: C.hidden }); const url = URL.createObjectURL(await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9))); $$('img', stage).concat($$('.lst img', el)).forEach(im => im.src = url); } finally { ld.close(); }
    renderCadHD();
  }
  async function cadFind() {
    const C = await loadCad(); if (!C) return;
    const r = await formSheet('Rechercher dans le plan', [{ name: 'q', label: 'Texte (repère, cote, nom de local…)', placeholder: 'Ex : P12, R+3, V14' }], { okLabel: 'Chercher' }); if (!r || !r.q) return;
    const q = normQ(r.q), hits = C.D.prims.filter(p => p.t === 'tx' && normQ(p.s).includes(q)).slice(0, 40);
    if (!hits.length) return toast('Aucun texte trouvé');
    const i = hits.length === 1 ? 0 : await menu(`${hits.length} résultat(s)`, hits.map((p, k) => ({ label: p.s, icon: 'search', value: String(k) })));
    if (i == null) return; const p = hits[+i], ix = (p.p[0] - C.x0) * C.s, iy = (C.y1 - p.p[1]) * C.s;
    const vw = viewer.clientWidth, vh = viewer.clientHeight; st.scale = Math.max(st.fitScale * 6, st.scale); st.tx = vw / 2 - ix * st.scale; st.ty = vh / 2 - iy * st.scale; applyT();
    gPrev.innerHTML = `<circle cx="${ix}" cy="${iy}" r="${40 / st.scale}" fill="none" stroke="#f59e0b" stroke-width="${4 / st.scale}"><animate attributeName="r" values="${20 / st.scale};${60 / st.scale};${20 / st.scale}" dur="1.2s" repeatCount="3"/></circle>`; setTimeout(() => { gPrev.innerHTML = ''; }, 3800);
  }

  // ---------- Loupe (voir sous le doigt pendant le dessin) ----------
  const loupe = $('.loupe', el), lst = $('.lst', el), lAnn = $('.l-ann', el), lPrev = $('.l-prev', el);
  function showLoupe(cx, cy) {
    const r = viewer.getBoundingClientRect();
    const [x, y] = toImg(cx, cy);
    const Z = st.scale * 2.5, R = 65;
    lst.style.transform = `translate(${R - x * Z}px,${R - y * Z}px) scale(${Z})`;
    lPrev.innerHTML = gPrev.innerHTML;
    if (loupe.style.display !== 'block') { lAnn.innerHTML = gAnn.innerHTML; loupe.style.display = 'block'; }
    const nearTopLeft = (cx - r.left) < 170 && (cy - r.top) < 190;
    loupe.style.left = nearTopLeft ? 'auto' : '10px';
    loupe.style.right = nearTopLeft ? '74px' : 'auto';
  }
  function hideLoupe() { loupe.style.display = 'none'; }

  // ---------- Rendering ----------
  function renderAnnots() {
    gAnn.style.display = st.filters.annots ? '' : 'none';
    gAnn.innerHTML = plan.annotations.map(annotSVG).join('');
  }
  function renderMarkers() {
    const m = pinM();
    const s = m / st.scale;
    const showLabel = m >= 0.45, showCount = m >= 0.3;
    gTasks.style.display = st.filters.tasks ? '' : 'none';
    gLinks.style.display = st.filters.links ? '' : 'none';
    gTasks.innerHTML = st.tasks.filter(t => t.planId === plan.id && t.x != null).map(t => {
      const c = (STATUS[t.status] || STATUS.open).color;
      return `<g transform="translate(${t.x},${t.y}) scale(${s})">
        <path d="M0,0 C-4,-10 -14,-14 -14,-26 A14,14 0 1 1 14,-26 C14,-14 4,-10 0,0Z" fill="${c}" stroke="#fff" stroke-width="2"/>
        ${m >= 0.25 ? `<text x="0" y="-21" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="Arial">${t.num}</text>` : ''}</g>`;
    }).join('');
    gLinks.innerHTML = st.links.filter(l => l.planId === plan.id).map(l => {
      const n = showCount ? (l.kind === 'plansbox' ? plansboxCount(l) : l.kind === 'photonote' ? (l.photos || []).length + (l.notes || []).length : (l.items || []).length) : 0;
      const ls = 1 / st.scale;
      const [px, py] = linkXY(l);
      if (l.kind === 'planlink') return `<g transform="translate(${px},${py}) scale(${s})">
        <rect x="-15" y="-15" width="30" height="30" rx="7" fill="#1e88e5" stroke="#fff" stroke-width="2"/>
        <g transform="translate(-9,-9) scale(.75)" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${ICONS.section}</g>
        ${showLabel ? `<text x="0" y="29" text-anchor="middle" font-size="12" fill="#1e88e5" font-weight="700" font-family="Arial" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(l.name)}</text>` : ''}</g>`;
      if (l.kind === 'plansbox') { const P = pinLook(l); return `<g transform="translate(${px},${py}) scale(${s})">
        <rect x="-17" y="-17" width="34" height="34" rx="9" fill="${P.c}" stroke="#fff" stroke-width="2.4"/><text x="0" y="6.5" text-anchor="middle" font-size="18">${P.e}</text>
        ${n ? `<circle cx="16" cy="-16" r="9" fill="#111" stroke="#fff" stroke-width="1.5"/><text x="16" y="-12" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Arial">${n}</text>` : ''}
        ${showLabel ? `<text x="0" y="32" text-anchor="middle" font-size="12" fill="${P.c}" font-weight="700" font-family="Arial" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(l.name)}</text>` : ''}</g>`; }
      const P = pinLook(l);
      return `<g transform="translate(${px},${py}) scale(${s})">${linkPin(P.c, n, P.e)}
        ${showLabel ? `<text x="0" y="16" text-anchor="middle" font-size="12" fill="${P.c}" font-weight="700" font-family="Arial" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(l.name)}</text>` : ''}</g>`;
    }).join('');
    if (typeof drawPending === 'function' && st.pend) drawPending();
    if (typeof renderSel === 'function' && (st.sel >= 0 || st.selPin)) renderSel();
    const info = $('.vb-info', el);
    const nt = st.tasks.filter(t => t.planId === plan.id).length, nl = st.links.filter(l => l.planId === plan.id).length;
    info.textContent = `${nt} tâche(s) · ${nl} lien(s) · ${plan.annotations.length} annotation(s)`;
  }
  const linkXY = (l) => l.shape === 'zone' ? [l.x + l.w / 2, l.y + l.h / 2] : [l.x, l.y];
  function linkPin(color, n, emoji) {
    return `<path d="M0,0 C-5,-12 -17,-17 -17,-31 A17,17 0 1 1 17,-31 C17,-17 5,-12 0,0Z" fill="${color}" stroke="#fff" stroke-width="2"/>
      ${emoji ? `<text x="0" y="-25" text-anchor="middle" font-size="17">${emoji}</text>` : `<g transform="translate(-8,-39) scale(.67)" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">${ICONS.link}</g>`}
      ${n ? `<circle cx="15" cy="-44" r="9" fill="#111" stroke="#fff" stroke-width="1.5"/><text x="15" y="-40" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Arial">${n}</text>` : ''}`;
  }
  function linkBadge(color, n) {
    return `<rect x="-15" y="-15" width="30" height="30" rx="8" fill="${color}" stroke="#fff" stroke-width="2"/>
      <g transform="translate(-9,-9) scale(.75)" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round">${ICONS.link}</g>
      ${n ? `<circle cx="14" cy="-14" r="9" fill="#111" stroke="#fff" stroke-width="1.5"/><text x="14" y="-10" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Arial">${n}</text>` : ''}`;
  }

  async function reloadData() {
    st.tasks = await DB.byProject('tasks', plan.projectId);
    st.links = (await DB.byProject('links', plan.projectId)).filter(l => l.kind !== 'local');   // les locaux (avancement) ont leur propre écran
    renderMarkers();
  }

  let saveT = null;
  function saveAnnots() {
    clearTimeout(saveT);
    saveT = setTimeout(() => DB.put('plans', plan), 300);
  }
  function pushUndo() {
    st.undo.push(JSON.stringify(plan.annotations));
    if (st.undo.length > 50) st.undo.shift();
  }

  // ---------- Outils (barre compacte façon Fieldwire) ----------
  const SHAPES = [
    ['free', 'pen', 'Main levée'], ['line', 'line', 'Ligne'], ['poly', 'poly', 'Polyligne'], ['rect', 'rect', 'Rectangle'],
    ['ellipse', 'circle', 'Cercle'], ['disc', 'disc', 'Cercle plein'], ['box', 'box', 'Rect. plein'], ['cloud', 'cloud', 'Nuage'],
    ['arrow', 'arrow', 'Flèche'], ['text', 'text', 'Texte'],
  ];
  const TOOLS = [
    ['pan', 'hand', 'Déplacer'], ['pin', 'pin', 'Tâche'], ['link', 'link', 'Élément'], ['planlink', 'section', 'Lien plan / coupe'], ['plansbox', 'plans', 'Plans de l\'ouvrage'], ['photonote', 'camera', 'Photos / note'],
    ['draw', 'pen', 'Dessin'], ['select', 'cursor', 'Modifier'], ['erase', 'eraser', 'Gomme'],
  ];
  const shapeInfo = () => SHAPES.find(x => x[0] === st.shape) || SHAPES[0];
  const TWO_PT = ['line', 'rect', 'ellipse', 'cloud', 'arrow', 'disc', 'box'];
  Object.defineProperty(st, 'color', { get: () => shadeHex(st.hue, st.shade), set: (v) => { st.hue = v; st.shade = 0; }, configurable: true });
  function hintText() {
    if (st.tool === 'pin') return 'Touchez pour placer une tâche';
    if (st.tool === 'link') return 'Touchez pour placer un élément';
    if (st.tool === 'photonote') return 'Touchez pour placer un pin photos / note';
    if (st.tool === 'plansbox') return 'Touchez pour placer un pin « Plans » (zones → parties d\'ouvrage → PDF)';
    if (st.tool === 'planlink') return 'Touchez pour placer un lien (PDF de coupe, plan…)';
    if (st.tool === 'erase') return 'Touchez un dessin pour l\'effacer';
    if (st.tool === 'select') return st.selPin ? '' : st.sel >= 0 ? 'Glissez les points · glissez le dessin pour le déplacer' : 'Touchez un pin ou un dessin pour le modifier / déplacer / supprimer';
    if (st.tool === 'draw') {
      if (st.shape === 'free') return 'Dessinez · 2 doigts pour zoomer / bouger';
      if (st.shape === 'text') return 'Touchez pour placer le texte';
      if (st.shape === 'disc') return st.pend ? 'Centre posé · zoomez puis touchez le bord (diamètre)' : 'Posez le doigt au centre et glissez jusqu\'au bord · ou touchez centre puis bord';
      if (st.shape === 'poly') return st.pend ? 'Continuez depuis le dernier point · « Colorer » ferme et remplit la zone · ✓ termine' : 'Glissez du 1er au 2e point · levez le doigt, zoomez, puis continuez';
      return st.pend ? 'Touchez le point d\'arrivée' : 'Glissez pour dessiner · ou touchez départ puis arrivée';
    }
    return '';
  }
  function renderTools() {
    const t = $('.tools', el);
    const ic = (k, i) => icon(k === 'draw' ? shapeInfo()[1] : i);
    const cur = TOOLS.find(x => x[0] === st.tool) || TOOLS[0];
    t.className = 'tools fw';
    t.innerHTML = st.toolsOpen ? `
      <div class="grp">${TOOLS.map(([k, i, l]) => `<button class="tool ${st.tool === k ? 'on' : ''}" data-t="${k === 'pan' ? 'hand' : k}" title="${l}">${ic(k, i)}${k === 'draw' ? '<i class="tri"></i>' : ''}</button>`).join('')}</div>
      <div class="grp"><button class="tool" data-t="undo" title="Annuler">${icon('undo')}</button></div>`
      : `<div class="grp"><button class="tool ${st.tool === 'pan' ? 'on' : ''}" data-t="hand">${icon('hand')}</button>
           ${st.tool !== 'pan' ? `<button class="tool on" data-t="${st.tool === 'draw' ? 'draw' : st.tool}">${ic(cur[0], cur[1])}</button>` : ''}</div>
         ${['draw', 'select', 'erase'].includes(st.tool) ? `<div class="grp"><button class="tool" data-t="undo">${icon('undo')}</button></div>` : ''}`;
    $$('.tool', t).forEach(b => b.onclick = (e) => { e.stopPropagation(); if (M.on) { M.on = false; M.pts = []; measBar(); renderMeas(); $('[data-a=meas]', el).classList.remove('on'); } onTool(b.dataset.t, b); });
    let hint = $('.hint', viewer);
    const msg = hintText();
    if (msg) { if (!hint) { hint = document.createElement('div'); hint.className = 'hint'; viewer.appendChild(hint); } hint.textContent = msg; }
    else if (hint) hint.remove();
    renderPBar();
  }
  // Barre de propriétés : couleur, intensité (foncé ↔ clair), épaisseur
  function renderPBar() {
    let bar = $('.pbar', el);
    if (st.tool === 'select' && st.selPin) {
      if (!bar) { bar = document.createElement('div'); bar.className = 'pbar'; viewer.appendChild(bar); }
      const { kind, obj } = st.selPin;
      const label = kind === 'task' ? `Tâche #${obj.num} ${obj.title || ''}` : kind === 'planlink' ? `Lien : ${obj.name}` : kind === 'plansbox' ? `Plans : ${obj.name}` : kind === 'photonote' ? `Photos : ${obj.name}` : `Élément : ${obj.name}`;
      bar.innerHTML = `<div class="pb-row"><span class="pb-t" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${icon(kind === 'task' ? 'pin' : kind === 'planlink' ? 'section' : 'link')} ${esc(label)}</span>
        <button class="pb" data-p="open">${icon('edit')}<span>Modifier</span></button><button class="pb danger" data-p="delpin">${icon('trash')}</button><button class="pb ok" data-p="unsel">${icon('check')}</button></div>
        <div class="muted" style="font-size:12px">Glissez le pin pour le déplacer</div>`;
      $('[data-p=unsel]', bar).onclick = () => { st.selPin = null; renderSel(); renderTools(); };
      $('[data-p=open]', bar).onclick = async () => {
        if (kind === 'task') await ctx.openTask(obj); else if (kind === 'planlink') await editPlanLink(obj); else if (kind === 'plansbox') await openPlansBox(obj, ctx); else if (kind === 'photonote') await openPhotoNote(obj, ctx); else await ctx.openLink(obj);
        st.selPin = null; await reloadData(); renderSel(); renderTools();
      };
      $('[data-p=delpin]', bar).onclick = async () => {
        if (!await confirmBox(kind === 'task' ? 'Retirer cette tâche du plan ? (la tâche reste dans la liste)' : 'Supprimer ce pin et ses documents ?')) return;
        if (kind === 'task') { obj.planId = null; obj.x = obj.y = null; await DB.put('tasks', obj); }
        else { for (const it of obj.items || []) if (it.fileId) await DB.del('files', it.fileId); for (const z of obj.zones || []) for (const pt of z.parts || []) for (const dd of pt.docs || []) if (dd.fileId) await DB.del('files', dd.fileId); for (const id of [...(obj.photos || []), ...(obj.notes || []).flatMap(n => [...(n.photos || []), n.audio].filter(Boolean))]) await DB.del('files', id); if (obj.fileId) await DB.del('files', obj.fileId); await DB.del('links', obj.id); }
        st.selPin = null; await reloadData(); renderSel(); renderTools(); toast('Supprimé ✓');
      };
      return;
    }
    const selA = st.tool === 'select' && st.sel >= 0 ? plan.annotations[st.sel] : null;
    if (!(st.tool === 'draw' || selA)) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.className = 'pbar'; viewer.appendChild(bar); }
    const hue = selA ? (selA.hue || selA.color) : st.hue, shade = selA ? (selA.shade || 0) : st.shade;
    const isText = selA ? selA.type === 'text' : st.shape === 'text';
    const thick = selA ? (selA.type === 'text' ? 0 : Math.round(selA.sw * 1600 / base)) : st.thick;
    const tsize = selA && selA.type === 'text' ? Math.round(selA.fs * 500 / base) : st.textSize;
    const col = shadeHex(hue, shade);
    bar.innerHTML = `
      <div class="pb-row">
        ${st.tool === 'draw' ? `<button class="pb shape" data-p="shape">${icon(shapeInfo()[1])}<span>${shapeInfo()[2]}</span>${icon('chevdown')}</button>` : `<span class="pb-t">${icon('cursor')} Modifier</span>`}
        <span class="pb-prev"><span style="background:${col};height:${isText ? 14 : Math.max(2, Math.min(14, thick))}px"></span></span>
        <span style="flex:1"></span>
        ${st.pend ? `<button class="pb" data-p="cancel">${icon('close')}</button>${st.shape === 'poly' && st.pend.pts.length >= 3 ? `<button class="pb" data-p="fillfinish" title="Fermer et colorer la zone">${icon('fill')}<span>Colorer</span></button>` : ''}<button class="pb ok" data-p="finish">${icon('check')}</button>` : ''}
        ${selA && (selA.type === 'poly' || selA.type === 'polygon') && selA.pts.length >= 3 ? `<button class="pb" data-p="togglefill">${icon('fill')}<span>${selA.type === 'polygon' ? 'Sans couleur' : 'Colorer'}</span></button>` : ''}
        ${selA ? `<button class="pb danger" data-p="delsel">${icon('trash')}</button><button class="pb ok" data-p="unsel">${icon('check')}</button>` : ''}
      </div>
      <div class="pb-colors">${HUES.map(c => `<button class="sw2 ${c === hue ? 'on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
      <div class="pb-sliders">
        <label><span>Intensité</span><input type="range" min="-100" max="100" step="5" value="${Math.round(shade * 100)}" data-r="shade"
          style="background:linear-gradient(90deg, ${shadeHex(hue, -1)}, ${hue}, ${shadeHex(hue, 1)})"></label>
        ${isText ? `<label><span>Taille</span><input type="range" min="6" max="40" value="${tsize}" data-r="ts"></label>`
          : `<label><span>Épaisseur</span><input type="range" min="1" max="16" value="${thick}" data-r="thick"></label>`}
      </div>`;
    const apply = (fn) => { if (selA) { if (!bar._undo) { pushUndo(); bar._undo = true; } fn(selA); selA.color = shadeHex(selA.hue || selA.color, selA.shade || 0); renderAnnots(); saveAnnots(); renderSel(); } };
    $$('[data-c]', bar).forEach(b => b.onclick = () => {
      if (selA) apply(a => { a.hue = b.dataset.c; a.shade = a.shade || 0; }); else st.hue = b.dataset.c;
      bar._undo = false; renderPBar(); drawPending();
    });
    $$('[data-r]', bar).forEach(r => r.oninput = () => {
      const v = +r.value, k = r.dataset.r;
      if (k === 'shade') { if (selA) apply(a => { a.hue = a.hue || a.color; a.shade = v / 100; }); else st.shade = v / 100; }
      if (k === 'thick') { if (selA) apply(a => { a.sw = base * v / 1600; }); else st.thick = v; }
      if (k === 'ts') { if (selA) apply(a => { a.fs = v * base / 500; }); else st.textSize = v; }
      const pv = $('.pb-prev span', bar); pv.style.background = selA ? selA.color : st.color;
      if (k === 'thick') pv.style.height = Math.max(2, Math.min(14, v)) + 'px';
      if (k === 'shade') $$('[data-c]', bar).forEach(() => {});
      drawPending();
    });
    $$('[data-r]', bar).forEach(r => r.onchange = () => { bar._undo = false; });
    const pb = (k) => $(`[data-p=${k}]`, bar);
    if (pb('shape')) pb('shape').onclick = () => openShapePicker($('.tool[data-t=draw]', el) || $('.tool[data-t=toggle]', el));
    if (pb('finish')) pb('finish').onclick = finishPending;
    if (pb('fillfinish')) pb('fillfinish').onclick = () => finishPending(true);
    if (pb('togglefill')) pb('togglefill').onclick = () => { pushUndo(); selA.type = selA.type === 'polygon' ? 'poly' : 'polygon'; renderAnnots(); saveAnnots(); renderSel(); renderPBar(); };
    if (pb('cancel')) pb('cancel').onclick = () => { st.pend = null; drawPending(); renderTools(); };
    if (pb('delsel')) pb('delsel').onclick = () => { pushUndo(); plan.annotations.splice(st.sel, 1); st.sel = -1; renderAnnots(); saveAnnots(); renderSel(); renderTools(); };
    if (pb('unsel')) pb('unsel').onclick = () => { st.sel = -1; renderSel(); renderTools(); };
  }
  // Petit menu horizontal des formes (s'ouvre à gauche du bouton Dessin)
  function openShapePicker(btn) {
    closeFly();
    const f = document.createElement('div');
    f.className = 'flyout shapes';
    f.innerHTML = SHAPES.map(([k, ic, l]) => `<button class="${st.tool === 'draw' && st.shape === k ? 'on' : ''}" data-s="${k}">${icon(ic)}<small>${l}</small></button>`).join('');
    viewer.appendChild(f);
    const vr = viewer.getBoundingClientRect(), tb = (btn || viewer).getBoundingClientRect();
    f.style.top = Math.max(6, Math.min(vr.height - f.offsetHeight - 6, tb.top - vr.top)) + 'px';
    $$('[data-s]', f).forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      st.tool = 'draw'; st.shape = b.dataset.s; st.pend = null; st.sel = -1; st.selPin = null; st.toolsOpen = false;
      closeFly(); drawPending(); renderSel(); renderTools();
    });
    st.flyout = f;
  }
  function closeFly() { if (st.flyout) { st.flyout.remove(); st.flyout = null; } }
  function onTool(t, btn) {
    if (t === 'toggle') { closeFly(); st.toolsOpen = !st.toolsOpen; return renderTools(); }
    // la main : ouvre / referme la barre (et revient en mode déplacement)
    if (t === 'hand') { closeFly(); st.toolsOpen = !st.toolsOpen; st.tool = 'pan'; st.pend = null; st.sel = -1; st.selPin = null; drawPending(); renderSel(); return renderTools(); }
    if (t === 'draw') { if (st.flyout) return closeFly(); return openShapePicker(btn); }
    closeFly();
    if (t === 'undo') {
      if (!st.undo.length) return toast('Rien à annuler');
      plan.annotations = JSON.parse(st.undo.pop()); st.sel = -1; renderAnnots(); saveAnnots(); renderSel(); renderMarkers(); return renderTools();
    }
    st.tool = st.tool === t && t !== 'pan' ? 'pan' : t; st.pend = null; st.sel = -1; st.selPin = null;
    if (st.tool !== 'pan') st.toolsOpen = false;
    drawPending(); renderSel(); renderTools();
  }

  // ---------- Liens vers un autre plan / une coupe ----------
  async function pickPlan(title) {
    const [plans, folders] = await Promise.all([DB.byProject('plans', plan.projectId), DB.byProject('folders', plan.projectId)]);
    const others = plans.filter(p => p.id !== plan.id);
    if (!others.length) { toast('Importez d\'abord la coupe / le plan dans « Plans »'); return null; }
    const fname = (id) => folderPath(folders.find(f => f.id === id), folders);
    others.sort((a, b) => `${fname(a.folderId) || ''} ${a.name}`.localeCompare(`${fname(b.folderId) || ''} ${b.name}`, 'fr', { numeric: true }));
    const id = await menu(title, others.map(p => ({ label: (fname(p.folderId) ? fname(p.folderId) + ' / ' : '') + p.name, icon: 'plans', value: p.id })));
    return id ? others.find(p => p.id === id) : null;
  }
  // Choisit la cible du lien : plan du projet, PDF/image du téléphone, ou lien Drive
  async function pickLinkTarget() {
    const how = await menu('Lien vers quoi ?', [
      { label: 'PDF / image du téléphone (coupe…)', icon: 'phone', value: 'file' },
      { label: 'Plan / coupe déjà dans le projet', icon: 'plans', value: 'plan' },
      { label: 'Lien Google Drive', icon: 'drive', value: 'url' },
    ]);
    if (how === 'plan') { const t = await pickPlan('Choisir le plan / la coupe'); return t ? { targetPlanId: t.id, fileId: null, url: null, defName: t.name } : null; }
    if (how === 'file') {
      const [file] = await pickFiles({ accept: '*/*', multiple: false });
      if (!file) return null;
      const ld = loading('Enregistrement…');
      try {
        const rec = isRasterImage(file) ? await saveImageFile(plan.projectId, file, 'doc', { name: file.name })
          : await DB.put('files', { projectId: plan.projectId, blob: file, mime: mimeFromName(file.name, file.type), name: file.name, role: 'doc' });
        return { fileId: rec.id, targetPlanId: null, url: null, defName: file.name.replace(/\.[^.]+$/, '') };
      } finally { ld.close(); }
    }
    if (how === 'url') {
      const r = await formSheet('Lien Google Drive', [{ name: 'url', label: 'Coller le lien du fichier', type: 'url', placeholder: 'https://drive.google.com/…' }], { okLabel: 'OK' });
      if (!r || !r.url) return null;
      if (driveFileId(r.url) && isNative()) {
        const ld = loading('Téléchargement depuis Drive…');
        try {
          const file = await downloadFromDrive(r.url);
          const rec = await DB.put('files', { projectId: plan.projectId, blob: file, mime: file.type, name: file.name, role: 'doc' });
          return { fileId: rec.id, url: r.url, targetPlanId: null, defName: file.name.replace(/\.[^.]+$/, '') };
        } catch (e) { toast(e.message); } finally { ld.close(); }
      }
      return { url: r.url, fileId: null, targetPlanId: null, defName: 'Coupe' };
    }
    return null;
  }
  async function createPlanLink(x, y) {
    const t = await pickLinkTarget();
    if (!t) return;
    const r = await formSheet('Nom du lien', [{ name: 'name', label: 'Nom affiché sur le plan (ex : Coupe A-A)', value: t.defName }], { okLabel: 'Créer' });
    if (!r) return;
    const { defName, ...target } = t;
    await DB.put('links', { projectId: plan.projectId, planId: plan.id, kind: 'planlink', shape: 'point', x, y, ...target, name: r.name || defName, color: '#1e88e5', items: [] });
    await reloadData();
    toast('Lien créé ✓ — touchez-le pour l\'ouvrir');
  }
  // Ouverture directe (pas de menu)
  async function openPlanLink(l) {
    if (l.fileId) {
      const f = await DB.get('files', l.fileId);
      if (f) return openFileRecord(f, l.name);
    }
    if (l.targetPlanId) {
      const target = await DB.get('plans', l.targetPlanId);
      if (target) return openPlanViewer(target, { ...ctx, onClose: () => {} });
    }
    if (l.url) return openUrl(l.url);
    toast('Fichier introuvable — modifiez le lien (outil Modifier)');
  }
  async function editPlanLink(l) {
    const v = await menu(l.name, [
      { label: 'Ouvrir', icon: 'section', value: 'open' }, { label: 'Changer le fichier / plan lié', icon: 'plans', value: 'change' },
      { label: 'Renommer', icon: 'edit', value: 'rename' }, { label: 'Supprimer le lien', icon: 'trash', danger: true, value: 'del' },
    ]);
    if (v === 'open') return openPlanLink(l);
    if (v === 'change') { const t = await pickLinkTarget(); if (t) { const { defName, ...tg } = t; if (l.fileId && l.fileId !== tg.fileId) await DB.del('files', l.fileId); Object.assign(l, tg); await DB.put('links', l); toast('Lien modifié ✓'); } }
    if (v === 'rename') { const r = await formSheet('Renommer', [{ name: 'name', label: 'Nom', value: l.name }]); if (r && r.name) { l.name = r.name; await DB.put('links', l); } }
    if (v === 'del' && await confirmBox('Supprimer ce lien ?')) { if (l.fileId) await DB.del('files', l.fileId); await DB.del('links', l.id); }
  }

  // ---------- Dessin en plusieurs touchers (ligne / polyligne) ----------
  const gPend = (() => { const g2 = document.createElementNS('http://www.w3.org/2000/svg', 'g'); $('svg.ov', el).insertBefore(g2, gLinks); return g2; })();
  const gSel = (() => { const g2 = document.createElementNS('http://www.w3.org/2000/svg', 'g'); $('svg.ov', el).appendChild(g2); return g2; })();
  function drawPending() {
    if (!st.pend) { gPend.innerHTML = ''; return; }
    const pts = st.pend.pts, r = 5 / st.scale;
    const type = st.shape === 'poly' ? 'poly' : 'line';
    gPend.innerHTML = (pts.length > 1 ? annotSVG({ type, pts, color: st.color, sw: strokeW() }) : '') +
      pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="#fff" stroke="${st.color}" stroke-width="${2 / st.scale}"/>`).join('');
  }
  function addAnnot(a) { pushUndo(); plan.annotations.push({ id: DB.uid(), color: st.color, hue: st.hue, shade: st.shade, sw: strokeW(), ...a }); renderAnnots(); saveAnnots(); renderMarkers(); }
  function finishPending(fill) {
    const pd = st.pend; st.pend = null;
    if (pd && pd.pts.length >= 2) addAnnot({ type: st.shape === 'poly' ? (fill === true && pd.pts.length >= 3 ? 'polygon' : 'poly') : st.shape, pts: pd.pts.map(p => [...p]) });
    drawPending(); renderTools();
  }

  // ---------- Sélection / modification ----------
  function handlesOf(a) {
    if (a.type === 'pen' || a.type === 'text') return [];
    return a.pts;
  }
  function renderSel() {
    if (st.tool === 'select' && st.selPin) {
      const o = st.selPin.obj, [ox, oy] = st.selPin.kind === 'task' ? [o.x, o.y] : linkXY(o);
      const r = 26 / st.scale;
      gSel.innerHTML = `<circle cx="${ox}" cy="${oy}" r="${r}" fill="rgba(91,141,239,.18)" stroke="#5b8def" stroke-width="${2.5 / st.scale}" stroke-dasharray="${5 / st.scale} ${4 / st.scale}"/>
        <path d="M${ox - r * 1.5},${oy}h${r * 0.6}M${ox + r * 0.9},${oy}h${r * 0.6}M${ox},${oy - r * 1.5}v${r * 0.6}M${ox},${oy + r * 0.9}v${r * 0.6}" stroke="#5b8def" stroke-width="${2.5 / st.scale}" stroke-linecap="round"/>`;
      return;
    }
    const a = st.tool === 'select' && st.sel >= 0 ? plan.annotations[st.sel] : null;
    if (!a) { gSel.innerHTML = ''; return; }
    const [x1, y1, x2, y2] = annotBBox(a), pad = 6 / st.scale;
    gSel.innerHTML = `<rect x="${x1 - pad}" y="${y1 - pad}" width="${x2 - x1 + 2 * pad}" height="${y2 - y1 + 2 * pad}" fill="rgba(91,141,239,.08)" stroke="#5b8def" stroke-width="${1.5 / st.scale}" stroke-dasharray="${5 / st.scale} ${4 / st.scale}"/>` +
      handlesOf(a).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${9 / st.scale}" fill="#fff" stroke="#5b8def" stroke-width="${3 / st.scale}"/>`).join('');
  }
  function annotAt(x, y) {
    const tol = 16 / st.scale;
    for (let i = plan.annotations.length - 1; i >= 0; i--) if (hitAnnot(plan.annotations[i], x, y, tol)) return i;
    return -1;
  }

  // ---------- Gestes ----------
  const ptrs = new Map();
  let g = null; // geste en cours
  viewer.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.tools') || e.target.closest('.flyout') || e.target.closest('.dpanel') || e.target.closest('.pbar')) return;
    closeFly();
    viewer.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) {
      if (g && g.edit && g.moved) { /* on garde la modification déjà faite */ }
      const [a, b] = [...ptrs.values()];
      if (g) clearTimeout(g.lpTimer);
      g = { type: 'pinch', d: Math.hypot(a[0] - b[0], a[1] - b[1]), cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 };
      gPrev.innerHTML = ''; hideLoupe();
      return;
    }
    if (ptrs.size > 2) return;
    const p = toImg(e.clientX, e.clientY);
    g = { type: 'one', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, t0: Date.now(), moved: false, start: p, pts: [p] };
    // mode du geste
    if (st.tool === 'select' && st.selPin) {
      const o = st.selPin.obj, [ox, oy] = st.selPin.kind === 'task' ? [o.x, o.y] : linkXY(o);
      if (Math.hypot(p[0] - ox, p[1] - oy) < 40 / st.scale || hitMarker(p[0], p[1])?.obj === o) g.edit = { kind: 'pin' };
    }
    if (st.tool === 'select' && st.sel >= 0) {
      const a = plan.annotations[st.sel];
      const hi = handlesOf(a).findIndex(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 22 / st.scale);
      if (hi >= 0) g.edit = { kind: 'handle', i: hi };
      else if (hitAnnot(a, p[0], p[1], 18 / st.scale)) g.edit = { kind: 'move' };
    }
    // un appui (court ou long) sur un pin l'ouvre ; on ne déplace un pin qu'avec l'outil « Sélection »
    if (['pan', 'pin', 'link', 'planlink', 'plansbox', 'photonote'].includes(st.tool) && !g.edit && hitMarker(p[0], p[1])) g.onPin = true;
    const dragDraw = st.tool === 'draw' && !st.pend && (st.shape === 'free' || TWO_PT.includes(st.shape));
    g.mode = g.edit ? 'edit' : (dragDraw || (st.tool === 'draw' && st.shape === 'poly') || ['pin', 'link', 'planlink', 'plansbox', 'photonote'].includes(st.tool)) ? 'draw' : 'pan';
  });
  viewer.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (!g) return;
    if (g.type === 'pinch' && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
      st.tx += cx - g.cx; st.ty += cy - g.cy;
      zoomAt(cx, cy, d / g.d);
      g.d = d; g.cx = cx; g.cy = cy;
      return;
    }
    if (g.type !== 'one') return;
    const slop = g.mode === 'draw' && st.tool === 'draw' ? 6 : (g.mode === 'edit' ? 4 : g.onPin ? 28 : 14);
    if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > slop) g.moved = true;
    if (!g.moved) { g.lx = e.clientX; g.ly = e.clientY; return; }
    const p = toImg(e.clientX, e.clientY);
    if (g.mode === 'pan') {
      st.tx += e.clientX - g.lx; st.ty += e.clientY - g.ly; applyT();
    } else if (g.mode === 'edit' && g.edit.kind === 'pin') {
      const o = st.selPin.obj;
      if (o.shape === 'zone') { o.x = p[0] - o.w / 2; o.y = p[1] - o.h / 2; } else { o.x = p[0]; o.y = p[1]; }
      renderMarkers(); renderSel(); showLoupe(e.clientX, e.clientY);
    } else if (g.mode === 'edit') {
      const a = plan.annotations[st.sel];
      if (!g.undone) { pushUndo(); g.undone = true; }
      if (g.edit.kind === 'handle') a.pts[g.edit.i] = [p[0], p[1]];
      else { const lp = toImg(g.lx, g.ly), dx = p[0] - lp[0], dy = p[1] - lp[1]; a.pts = a.pts.map(q => [q[0] + dx, q[1] + dy]); }
      renderAnnots(); renderSel();
      if (g.edit.kind === 'handle') showLoupe(e.clientX, e.clientY);
    } else {
      g.end = p;
      if (st.tool === 'draw' && st.shape === 'poly') { const anc = st.pend ? st.pend.pts[st.pend.pts.length - 1] : g.start; gPrev.innerHTML = annotSVG({ type: 'line', pts: [anc, p], color: st.color, sw: strokeW() }); }
      else if (st.tool === 'draw' && st.shape === 'free') { g.pts.push(p); gPrev.innerHTML = annotSVG({ type: 'pen', pts: g.pts, color: st.color, sw: strokeW() }); }
      else if (st.tool === 'draw') gPrev.innerHTML = annotSVG({ type: st.shape, pts: [g.start, p], color: st.color, sw: strokeW() });
      else gPrev.innerHTML = `<circle cx="${p[0]}" cy="${p[1]}" r="${4 / st.scale}" fill="${st.tool === 'pin' ? STATUS.open.color : st.color}" stroke="#fff" stroke-width="${1.5 / st.scale}"/>`;
      showLoupe(e.clientX, e.clientY);
    }
    g.lx = e.clientX; g.ly = e.clientY;
  });
  const endPtr = async (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (!g) return;
    hideLoupe();
    if (g.type === 'pinch') { if (ptrs.size === 0) { g = null; scheduleHD(); drawPending(); renderSel(); } else g = { type: 'idle' }; return; }
    if (g.type !== 'one') { if (ptrs.size === 0) g = null; return; }
    const cur = g; g = null; gPrev.innerHTML = '';
    scheduleHD();
    clearTimeout(cur.lpTimer);
    if (cur.lp && !cur.moved) return;
    if (cur.mode === 'edit' && cur.edit.kind === 'pin') {
      if (cur.moved) { const o = st.selPin.obj; await DB.put(st.selPin.kind === 'task' ? 'tasks' : 'links', o); toast('Pin déplacé ✓'); }
      else onTap(cur.start);
      return;
    }
    if (cur.mode === 'edit' && cur.moved) { saveAnnots(); renderSel(); return; }
    if (!cur.moved) return onTap(cur.start);
    if (cur.onPin && Date.now() - cur.t0 < 700 && Math.hypot(e.clientX - cur.sx, e.clientY - cur.sy) < 44) return onTap(cur.start);
    if (cur.mode !== 'draw' || !cur.end) return;
    if (['pin', 'link', 'planlink', 'plansbox', 'photonote'].includes(st.tool)) return onTap(cur.end, true);
    if (st.tool === 'draw' && st.shape === 'poly') {
      if (!st.pend) st.pend = { pts: [cur.start, cur.end] }; else st.pend.pts.push(cur.end);
      drawPending(); renderTools(); return;
    }
    if (st.shape === 'free' && cur.pts.length > 1) addAnnot({ type: 'pen', pts: simplify(cur.pts, 1 / st.scale) });
    else if (TWO_PT.includes(st.shape)) addAnnot({ type: st.shape, pts: [cur.start, cur.end] });
  };
  viewer.addEventListener('pointerup', endPtr);
  viewer.addEventListener('pointercancel', endPtr);
  viewer.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
  let lastTap = 0;

  function simplify(pts, tol) {
    const out = [pts[0]];
    for (const p of pts) { const l = out[out.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > tol * 2) out.push(p); }
    if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
    return out.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
  }

  function hitMarker(x, y) {
    const m = pinM();
    const tol = Math.max(24, 28 * m) / st.scale;      // zone de toucher (px écran → plan)
    const head = (h) => h * m / st.scale;              // décalage de la tête du pin
    let best = null, bestD = Infinity;
    const consider = (d, hit) => { if (d < tol && d < bestD) { bestD = d; best = hit; } };
    if (st.filters.tasks) {
      for (const t of st.tasks) {
        if (t.planId !== plan.id || t.x == null) continue;
        consider(Math.min(Math.hypot(x - t.x, y - (t.y - head(26))), Math.hypot(x - t.x, y - t.y)), { kind: 'task', obj: t });
      }
    }
    if (st.filters.links) {
      for (const l of st.links) {
        if (l.planId !== plan.id) continue;
        const [lx, ly] = linkXY(l);
        // le pin ET son nom sont touchables (un simple appui ouvre)
        if (l.kind === 'planlink' || l.kind === 'plansbox') consider(Math.min(Math.hypot(x - lx, y - ly) * 0.8, Math.hypot((x - lx) * 0.5, y - (ly + head(l.kind === 'plansbox' ? 32 : 29)))), { kind: l.kind, obj: l });
        else consider(Math.min(Math.hypot(x - lx, y - (ly - head(31))) * 0.8, Math.hypot(x - lx, y - ly), Math.hypot((x - lx) * 0.5, y - (ly + head(16)))), { kind: l.kind === 'photonote' ? 'photonote' : l.kind === 'recpin' ? 'recpin' : 'link', obj: l });
      }
    }
    return best;
  }

  async function onTap([x, y], aimed = false) {
    if (ctx.place) { const ok = await ctx.place.onPlace(x, y, plan); if (ok !== false) close(); return; }
    // double-tap = zoom
    const now = Date.now();
    if (!aimed && st.tool === 'pan' && now - lastTap < 300 && !hitMarker(x, y)) {
      const r = viewer.getBoundingClientRect();
      zoomAt(r.left + x * st.scale + st.tx, r.top + y * st.scale + st.ty, 2); lastTap = 0; return;
    }
    lastTap = now;
    if (st.tool === 'measure') return measTap(x, y);
    if (st.tool === 'select') {
      const hp = hitMarker(x, y);
      if (hp) { st.selPin = hp; st.sel = -1; renderSel(); renderTools(); return; }
      st.selPin = null;
      st.sel = annotAt(x, y); renderSel(); renderTools();
      if (st.sel < 0) toast('Rien à modifier ici');
      return;
    }
    if (st.tool === 'draw' && st.shape !== 'text') {
      if (st.shape === 'free') return;
      if (!st.pend) st.pend = { pts: [[x, y]] };
      else {
        st.pend.pts.push([x, y]);
        if (st.shape !== 'poly') return finishPending();
      }
      drawPending(); renderTools(); return;
    }
    if (st.tool === 'erase') {
      const tol = 14 / st.scale;
      for (let i = plan.annotations.length - 1; i >= 0; i--) {
        if (hitAnnot(plan.annotations[i], x, y, tol)) {
          pushUndo(); plan.annotations.splice(i, 1); renderAnnots(); saveAnnots(); renderMarkers(); return;
        }
      }
      return toast('Aucune annotation ici');
    }
    const hit = aimed ? null : hitMarker(x, y);
    if (hit && hit.kind === 'recpin' && st.tool !== 'select') {
      const d = await DB.get('receptions', hit.obj.recDay);
      if (!d) return toast('Ce tableau a été supprimé');
      await openReceptionDay(d, { focus: hit.obj.recRow }); await reloadData(); return;
    }
    if (hit && hit.kind === 'photonote' && ['pan', 'pin', 'link', 'planlink', 'plansbox', 'photonote'].includes(st.tool)) {
      await openPhotoNote(hit.obj, ctx);
      await reloadData(); return;
    }
    if (hit && hit.kind === 'plansbox' && ['pan', 'pin', 'link', 'planlink', 'plansbox', 'photonote'].includes(st.tool)) {
      await openPlansBox(hit.obj, ctx);
      await reloadData(); return;
    }
    if (hit && hit.kind === 'planlink' && ['pan', 'pin', 'link', 'planlink', 'plansbox', 'photonote'].includes(st.tool)) {
      await openPlanLink(hit.obj);
      await reloadData(); return;
    }
    if (!hit && st.tool === 'pan' && !aimed) {
      const ai = annotAt(x, y);
      if (ai >= 0) { st.tool = 'select'; st.sel = ai; st.selPin = null; st.toolsOpen = false; renderSel(); renderTools(); return; }
    }
    if (hit && ['pan', 'pin', 'link'].includes(st.tool)) {
      if (hit.kind === 'task') await ctx.openTask(hit.obj);
      else await ctx.openLink(hit.obj);
      await reloadData();
      return;
    }
    if (x < 0 || y < 0 || x > W || y > H) return;
    if (st.tool === 'pin') {
      await ctx.createTask({ planId: plan.id, x, y });
      await reloadData();
    } else if (st.tool === 'link') {
      createLink({ shape: 'point', x, y });
    } else if (st.tool === 'planlink') {
      createPlanLink(x, y);
    } else if (st.tool === 'photonote') {
      const r = await formSheet('Pin photos / note', [{ name: 'name', label: 'Titre', placeholder: 'Ex : Fissure voile V12, réservation manquante…' }], { okLabel: 'Créer' });
      if (!r) return;
      const l = await DB.put('links', { projectId: plan.projectId, planId: plan.id, kind: 'photonote', shape: 'point', x, y, name: r.name || 'Photos', photos: [], notes: [], items: [] });
      await reloadData(); await openPhotoNote(l, ctx); await reloadData();
    } else if (st.tool === 'plansbox') {
      const r = await formSheet('Pin « Plans »', [{ name: 'name', label: 'Nom affiché sur le plan', placeholder: 'Ex : Plans R+5 · Zone 1' }], { okLabel: 'Créer' });
      if (!r) return;
      const src = await menu('Contenu du pin', [{ label: 'Vide — j\u2019ajoute zones et parties moi-même', icon: 'plus', value: 'empty' }, { label: 'Depuis le programme de réception…', icon: 'calendar', value: 'rec' }]);
      if (!src) return;
      const l = await DB.put('links', { projectId: plan.projectId, planId: plan.id, kind: 'plansbox', shape: 'point', x, y, name: r.name || 'Plans', zones: [], items: [] });
      if (src === 'rec' && await pbChooseRec(l)) await DB.put('links', l);
      await reloadData(); await openPlansBox(l, ctx); await reloadData();
    } else if (st.tool === 'draw' && st.shape === 'text') {
      const r = await formSheet('Texte', [{ name: 'text', label: 'Texte à afficher sur le plan' }], { okLabel: 'Ajouter' });
      if (r && r.text) {
        pushUndo();
        plan.annotations.push({ id: DB.uid(), type: 'text', pts: [[x, y]], text: r.text, color: st.color, hue: st.hue, shade: st.shade, fs: st.textSize * base / 500 });
        renderAnnots(); saveAnnots(); renderMarkers();
      }
    }
  }

  async function createLink(geom) {
    const r = await formSheet('Nouvel élément', [
      { name: 'name', label: 'Nom de l\'élément (ex : Poteau P12, Voile V3, Dalle zone A)', placeholder: 'Poteau P12' },
    ], { okLabel: 'Créer' });
    if (!r) return;
    const link = await DB.put('links', { projectId: plan.projectId, planId: plan.id, ...geom, name: r.name || 'Élément', color: st.color === '#ffffff' ? '#5b8def' : st.color, items: [] });
    await reloadData();
    await ctx.openLink(link);
    await reloadData();
  }

  // ---------- Menus ----------
  $('[data-a=filters]', el).onclick = async () => {
    const v = await menu('Filtres', [
      { label: 'Tâches', icon: 'pin', checked: st.filters.tasks, value: 'tasks' },
      { label: 'Liens / éléments', icon: 'link', checked: st.filters.links, value: 'links' },
      { label: 'Annotations', icon: 'pen', checked: st.filters.annots, value: 'annots' },
      { label: `Taille des pins : ${{ 0.6: 'Petit', 1: 'Normal', 1.6: 'Grand' }[st.pinSize] || 'Normal'}`, icon: 'pin', value: 'size' },
    ]);
    if (v === 'size') {
      const sz = await menu('Taille des pins', [
        { label: 'Petit', value: 0.6, checked: st.pinSize === 0.6 },
        { label: 'Normal', value: 1, checked: st.pinSize === 1 },
        { label: 'Grand', value: 1.6, checked: st.pinSize === 1.6 },
      ]);
      if (sz) { st.pinSize = sz; try { localStorage.setItem('pinSize', sz); } catch (e) {} renderMarkers(); }
    } else if (v) { st.filters[v] = !st.filters[v]; renderAnnots(); renderMarkers(); }
  };
  const openIndMenu = () => planIndicesMenu(plan, { onNew: (np) => { close(); openPlanViewer(np, ctx); }, onOpen: (p2) => { if (p2.id !== plan.id) { close(); openPlanViewer(p2, ctx); } } });
  $('[data-a=ind]', el).onclick = openIndMenu;
  $('[data-a=cmpb]', el).onclick = () => compareMenu(plan);
  $('[data-a=more]', el).onclick = async () => {
    const v = await menu(plan.name, [
      { label: 'Mettre à jour le plan (nouvel indice)', icon: 'upload', value: 'indice' },
      { label: 'Indices : historique · comparer', icon: 'history', value: 'indmenu' },
      { label: 'Comparer : deux niveaux · deux indices', icon: 'layers', value: 'lvl' },
      { label: 'Partager…', icon: 'share', value: 'share' },
      { label: 'Mesurer (distance · surface)', icon: 'ruler', value: 'meas' },
      ...(isCad ? [{ label: 'Calques (afficher / masquer)', icon: 'layers', value: 'layers' }, { label: 'Rechercher un texte dans le plan', icon: 'search', value: 'find' }] : []),
      ...(plan.dwgFileId || plan.dxfFileId ? [{ label: 'Tracer en PDF vectoriel (A0 → A4, épaisseurs)', icon: 'pdf', value: 'plot' }] : []),
      ...(plan.dwgFileId ? [{ label: 'Exporter en DXF', icon: 'share', value: 'dxf' }] : []),
      ...(plan.pdfFileId ? [{ label: 'Diviser ce PDF (pages / plages)', icon: 'plans', value: 'split' }] : []),
      { label: 'Renommer', icon: 'edit', value: 'rename' },
      { label: 'Ajuster à l\'écran', icon: 'plans', value: 'fit' },
      { label: 'Supprimer le plan', icon: 'trash', danger: true, value: 'del' },
    ]);
    if (v === 'fit') fit();
    if (v === 'meas') measToggle(true);
    if (v === 'lvl') compareMenu(plan);
    if (v === 'layers') cadLayers();
    if (v === 'find') cadFind();
    if (v === 'share') sharePlanMenu(plan, { tasks: st.tasks, links: st.links });
    if (v === 'plot') plotPlan(plan);
    if (v === 'dxf') exportDxfOfPlan(plan);
    if (v === 'split') splitPdfFlow(null, plan);
    if (v === 'pdfsh' || v === 'dwgsh') { const f = await DB.get('files', v === 'pdfsh' ? plan.pdfFileId : plan.dwgFileId); if (f && f.blob) shareBlob(f.blob, safeName(plan.name.replace(/ - p\d+$/, '')) + (v === 'pdfsh' ? '.pdf' : '.dwg')); else toast('Fichier introuvable (synchronisez)'); }
    if (v === 'indice') { const np = await newPlanIndice(plan); if (np) { close(); openPlanViewer(np, ctx); } }
    if (v === 'indmenu') openIndMenu();
    if (v === 'rename') {
      const r = await formSheet('Renommer', [{ name: 'name', label: 'Nom du plan', value: plan.name }]);
      if (r && r.name) { plan.name = r.name; await DB.put('plans', plan); $('h1', el).textContent = plan.name; }
    }
    if (v === 'del' && await confirmBox('Supprimer ce plan et ses annotations ?')) {
      await DB.del('plans', plan.id); await DB.del('files', plan.fileId);
      if (plan.prevId) { const prev = await DB.get('plans', plan.prevId); if (prev && prev.supersededBy === plan.id) { delete prev.supersededBy; await DB.put('plans', prev); } }   // l'indice précédent redevient le plan actuel
      if (plan.pdfFileId && !(await DB.byProject('plans', plan.projectId)).some(p => p.pdfFileId === plan.pdfFileId)) await DB.del('files', plan.pdfFileId);
      for (const l of st.links.filter(l => l.planId === plan.id)) await DB.del('links', l.id);
      for (const t of st.tasks.filter(t => t.planId === plan.id)) { t.planId = null; t.x = t.y = null; await DB.put('tasks', t); }
      close();
    }
  };

  renderTools();
  renderAnnots();
  await reloadData();
  requestAnimationFrame(fit);
  window.addEventListener('resize', fit);
}

// ---------- Apparence des pins d'éléments : emoji + couleur selon le contenu (ou choix manuel) ----------
const PIN_LOOKS = {
  coffrage: ['📐', '#2563eb', 'Plan coffrage'], ferraillage: ['🔩', '#dc2626', 'Plan ferraillage'], coupe: ['✂️', '#7c3aed', 'Coupe'],
  photo: ['📷', '#16a34a', 'Photos'], pv: ['📝', '#475569', 'PV'], note: ['🗒️', '#475569', 'Notes'], doc: ['📄', '#475569', 'Document'],
  cad: ['🧊', '#0891b2', 'AutoCAD / 3D'], url: ['🔗', '#ea580c', 'Lien web / Drive'], custom: ['📁', '#d97706', 'Rubrique'], mix: ['📎', '#ca8a04', 'Plusieurs types'],
};
const PIN_EMOJIS = ['📐', '🔩', '✂️', '📷', '📄', '📝', '🧊', '🔗', '📁', '📎', '🏗️', '🧱', '🪜', '🚪', '🪟', '⚡', '💧', '🔥', '⚠️', '✅', '⭐', '📌', '🎯', '🧰', '🛗', '🌀', '🏛️', '🔷'];
const PIN_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#475569', '#0f766e', '#1e3a8a', '#111827'];
function pinLook(l) {
  if (l.kind === 'plansbox') return { e: l.emoji || '📚', c: l.pinColor || '#1e3a8a' };
  if (l.kind === 'recpin') return { e: l.recKind === 'Bétonnage' ? '🧱' : '🔩', c: ({ ok: '#16a34a', reserve: '#f59e0b', pending: '#64748b', progress: '#2563eb' })[l.recStatus] || '#64748b' };
  if (l.kind === 'photonote') return l.state === 'done' ? { e: '✅', c: '#16a34a' } : { e: l.emoji || '📷', c: l.pinColor || '#0d9488' };
  if (l.emoji) return { e: l.emoji, c: l.pinColor || l.color || '#2563eb' };
  const cats = [...new Set((l.items || []).map(i => i.kind === 'url' && !LINK_CATS.some(c => c.key === i.cat) ? 'url' : i.cat))];
  if (!cats.length) return { e: '', c: l.pinColor || l.color || '#5b8def' };
  if (cats.length > 1) return { e: PIN_LOOKS.mix[0], c: l.pinColor || PIN_LOOKS.mix[1] };
  const k = PIN_LOOKS[cats[0]] ? cats[0] : String(cats[0]).startsWith('x_') ? 'custom' : 'doc';
  return { e: PIN_LOOKS[k][0], c: l.pinColor || PIN_LOOKS[k][1] };
}
async function choosePinLook(l) {
  const v = await menu('Icône du pin', [{ label: 'Automatique (selon les documents)', icon: 'check', value: '__auto', checked: !l.emoji }, ...PIN_EMOJIS.map(e => ({ label: `${e}`, value: e, checked: l.emoji === e }))]);
  if (!v) return false;
  l.emoji = v === '__auto' ? null : v;
  const c = await menu('Couleur du pin', [{ label: 'Automatique', icon: 'check', value: '__auto', checked: !l.pinColor }, ...PIN_COLORS.map(x => ({ label: x, swatch: x, value: x, checked: l.pinColor === x }))]);
  if (c) l.pinColor = c === '__auto' ? null : c;
  await DB.put('links', l); return true;
}
const plansboxCount = (l) => (l.zones || []).reduce((a, z) => a + (z.parts || []).reduce((b, p) => b + (p.docs || []).length, 0), 0);

// ---------- Partager un plan : fichier d'origine (PDF / DWG / DXF / image) ou PDF annoté (dessins, couleurs, pins) ----------
async function planOverlayCanvas(plan, tasks, links, outW) {
  const W = plan.w, H = plan.h, k = outW / W, base = Math.max(W, H), pr = base / 90;
  const pins = [
    ...tasks.filter(t => t.planId === plan.id && t.x != null).map(t => { const c = (STATUS[t.status] || STATUS.open).color; return `<g transform="translate(${t.x},${t.y})"><path d="M0,0 C${-pr * .3},${-pr * .7} ${-pr},${-pr} ${-pr},${-pr * 1.85} A${pr},${pr} 0 1 1 ${pr},${-pr * 1.85} C${pr},${-pr} ${pr * .3},${-pr * .7} 0,0Z" fill="${c}" stroke="#fff" stroke-width="${pr * .14}"/><text x="0" y="${-pr * 1.5}" text-anchor="middle" font-size="${pr * .95}" font-weight="700" fill="#fff" font-family="Arial">${t.num || ''}</text></g>`; }),
    ...links.filter(l => l.planId === plan.id).map(l => { const x = l.shape === 'zone' ? l.x + l.w / 2 : l.x, y = l.shape === 'zone' ? l.y + l.h / 2 : l.y, P = pinLook(l);
      return `<g transform="translate(${x},${y})"><circle r="${pr * .8}" fill="${P.c}" stroke="#fff" stroke-width="${pr * .12}"/>${l.name ? `<text y="${pr * 1.9}" text-anchor="middle" font-size="${pr * .8}" font-weight="700" fill="${P.c}" stroke="#fff" stroke-width="${pr * .18}" paint-order="stroke" font-family="Arial">${esc(String(l.name).slice(0, 30))}</text>` : ''}</g>`; }),
  ].join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * k)}" height="${Math.round(H * k)}" viewBox="0 0 ${W} ${H}">${(plan.annotations || []).map(annotSVG).join('')}${pins}</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try { const im = await loadImage(url); const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c; }
  finally { URL.revokeObjectURL(url); }
}
async function annotatedPlanPdf(plan, tasks, links, fmt) {
  // 1) plan PDF d'origine : la page reste vectorielle, les annotations sont posées par-dessus
  if (plan.pdfFileId && window.PDFLib) {
    const f = await DB.get('files', plan.pdfFileId);
    if (f && f.blob) { try {
      const src = await PDFLib.PDFDocument.load(await f.blob.arrayBuffer(), { ignoreEncryption: true }), out = await PDFLib.PDFDocument.create();
      const [pg] = await out.copyPages(src, [(plan.pdfPage || 1) - 1]); out.addPage(pg);
      const rot = ((pg.getRotation().angle % 360) + 360) % 360;
      if (rot === 0) { const { width, height } = pg.getSize(); const ov = await planOverlayCanvas(plan, tasks, links, Math.min(6000, plan.w));
        const png = await out.embedPng(await new Promise(r => ov.toBlob(b => b.arrayBuffer().then(r), 'image/png')));
        const mb = pg.getMediaBox(); pg.drawImage(png, { x: mb.x, y: mb.y, width, height }); return new Blob([await out.save()], { type: 'application/pdf' }); }
    } catch (e) { console.warn('pdf annot', e); } }
  }
  // 2) DWG / DXF / image : rendu haute définition + annotations, mis en page sur le format choisi
  let base;
  if (plan.dwgFileId || plan.dxfFileId) { const D = await cadOfPlan(plan); base = cadRaster(D, 7000, { hidden: plan.hiddenLayers || [] }).canvas; }
  else { const f = await DB.get('files', plan.fileId); base = document.createElement('canvas'); const im = await loadImage(BlobURL.get(f.id, f.blob)); base.width = im.naturalWidth; base.height = im.naturalHeight; base.getContext('2d').drawImage(im, 0, 0); }
  const ov = await planOverlayCanvas(plan, tasks, links, base.width); base.getContext('2d').drawImage(ov, 0, 0, base.width, base.height);
  const { jsPDF } = window.jspdf; let [PW, PH] = PAPER[fmt] || PAPER.A3; const land = base.width >= base.height; if (!land) [PW, PH] = [PH, PW];
  const doc = new jsPDF({ orientation: land ? 'l' : 'p', unit: 'mm', format: [PW, PH], compress: true });
  const M = 6, k = Math.min((PW - 2 * M) / base.width, (PH - 2 * M) / base.height), w = base.width * k, h = base.height * k;
  doc.addImage(base.toDataURL('image/jpeg', 0.9), 'JPEG', (PW - w) / 2, (PH - h) / 2, w, h, undefined, 'FAST');
  doc.setFontSize(8); doc.setTextColor(90); doc.text(pt(`${plan.name}${plan.indice ? ' · Ind. ' + planIndice(plan) : ''} · annoté le ${fmtDate(todayISO())}`), M, PH - 2.5);
  return doc.output('blob');
}
async function sharePlanMenu(plan, { tasks = [], links = [] } = {}) {
  const orig = plan.pdfFileId ? ['pdf', 'PDF'] : plan.dwgFileId ? ['dwg', 'DWG'] : plan.dxfFileId ? ['dxf', 'DXF'] : ['img', 'image'];
  const nA = (plan.annotations || []).length + tasks.filter(t => t.planId === plan.id && t.x != null).length + links.filter(l => l.planId === plan.id).length;
  const v = await menu('Partager le plan', [
    { label: `📄 Original (${orig[1]} tel que reçu)`, icon: 'share', value: 'orig' },
    { label: `✏️ PDF annoté (dessins, couleurs, pins${nA ? ' · ' + nA : ''})`, icon: 'pdf', value: 'annot' },
    ...(plan.dwgFileId ? [{ label: '📐 DXF (pour AutoCAD)', icon: 'share', value: 'dxf' }] : []),
    ...(plan.dwgFileId || plan.dxfFileId ? [{ label: '🖨️ PDF vectoriel à l\'échelle (A0 → A4)', icon: 'pdf', value: 'plot' }] : []),
  ]);
  if (!v) return;
  const nm = safeName(plan.name.replace(/ - p\d+$/, ''));
  if (v === 'orig') {
    const id = plan.pdfFileId || plan.dwgFileId || plan.dxfFileId || plan.fileId, f = await DB.get('files', id);
    if (!f || !f.blob) return toast('Fichier introuvable (synchronisez)');
    return shareBlob(f.blob, nm + '.' + (orig[0] === 'img' ? ((f.mime || '').includes('png') ? 'png' : 'jpg') : orig[0]));
  }
  if (v === 'dxf') return exportDxfOfPlan(plan);
  if (v === 'plot') return plotPlan(plan);
  const fmt = plan.pdfFileId ? 'A3' : await menu('Format du PDF annoté', ['A0', 'A1', 'A2', 'A3', 'A4'].map(x => ({ label: x, value: x, checked: x === 'A3' })));
  if (!fmt) return;
  const ld = loading('Création du PDF annoté…');
  try { const b = await annotatedPlanPdf(plan, tasks, links, fmt); ld.close(); await shareBlob(b, nm + '_annote.pdf'); }
  catch (e) { ld.close(); console.error(e); alertBox('Erreur : ' + (e.message || e)); }
}
