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
  if (a.type === 'text') return true;
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
      <h1>${esc(plan.name)}</h1>
      <button class="iconbtn" data-a="filters">${icon('eye')}</button>
      <button class="iconbtn" data-a="more">${icon('more')}</button>
    </div>
    <div class="viewer">
      <div class="stage"><img src="${src}" width="${W}" height="${H}"><canvas class="hd"></canvas><svg class="ov" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <g class="g-annots"></g><g class="g-preview"></g><g class="g-links"></g><g class="g-tasks"></g></svg></div>
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
    if (!rafPending) { rafPending = true; requestAnimationFrame(() => { rafPending = false; renderMarkers(); }); }
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
  function scheduleHD() {
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
      const n = showCount ? (l.items || []).length : 0;
      const ls = 1 / st.scale;
      const [px, py] = linkXY(l);
      if (l.kind === 'planlink') return `<g transform="translate(${px},${py}) scale(${s})">
        <rect x="-15" y="-15" width="30" height="30" rx="7" fill="#1e88e5" stroke="#fff" stroke-width="2"/>
        <g transform="translate(-9,-9) scale(.75)" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${ICONS.section}</g>
        ${showLabel ? `<text x="0" y="29" text-anchor="middle" font-size="12" fill="#1e88e5" font-weight="700" font-family="Arial" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(l.name)}</text>` : ''}</g>`;
      return `<g transform="translate(${px},${py}) scale(${s})">${linkPin(l.color, n)}
        ${showLabel ? `<text x="0" y="16" text-anchor="middle" font-size="12" fill="${l.color}" font-weight="700" font-family="Arial" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(l.name)}</text>` : ''}</g>`;
    }).join('');
    if (typeof drawPending === 'function' && st.pend) drawPending();
    if (typeof renderSel === 'function' && st.sel >= 0) renderSel();
    const info = $('.vb-info', el);
    const nt = st.tasks.filter(t => t.planId === plan.id).length, nl = st.links.filter(l => l.planId === plan.id).length;
    info.textContent = `${nt} tâche(s) · ${nl} lien(s) · ${plan.annotations.length} annotation(s)`;
  }
  const linkXY = (l) => l.shape === 'zone' ? [l.x + l.w / 2, l.y + l.h / 2] : [l.x, l.y];
  function linkPin(color, n) {
    return `<path d="M0,0 C-5,-12 -17,-17 -17,-31 A17,17 0 1 1 17,-31 C17,-17 5,-12 0,0Z" fill="${color}" stroke="#fff" stroke-width="2"/>
      <g transform="translate(-8,-39) scale(.67)" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">${ICONS.link}</g>
      ${n ? `<circle cx="15" cy="-44" r="9" fill="#111" stroke="#fff" stroke-width="1.5"/><text x="15" y="-40" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Arial">${n}</text>` : ''}`;
  }
  function linkBadge(color, n) {
    return `<rect x="-15" y="-15" width="30" height="30" rx="8" fill="${color}" stroke="#fff" stroke-width="2"/>
      <g transform="translate(-9,-9) scale(.75)" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round">${ICONS.link}</g>
      ${n ? `<circle cx="14" cy="-14" r="9" fill="#111" stroke="#fff" stroke-width="1.5"/><text x="14" y="-10" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Arial">${n}</text>` : ''}`;
  }

  async function reloadData() {
    st.tasks = await DB.byProject('tasks', plan.projectId);
    st.links = await DB.byProject('links', plan.projectId);
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
    ['ellipse', 'circle', 'Cercle'], ['cloud', 'cloud', 'Nuage'], ['arrow', 'arrow', 'Flèche'], ['text', 'text', 'Texte'],
  ];
  const TOOLS = [
    ['pan', 'hand', 'Déplacer'], ['pin', 'pin', 'Tâche'], ['link', 'link', 'Élément'], ['planlink', 'section', 'Lien plan / coupe'],
    ['draw', 'pen', 'Dessin'], ['select', 'cursor', 'Modifier'], ['erase', 'eraser', 'Gomme'],
  ];
  const shapeInfo = () => SHAPES.find(x => x[0] === st.shape) || SHAPES[0];
  const TWO_PT = ['line', 'rect', 'ellipse', 'cloud', 'arrow'];
  Object.defineProperty(st, 'color', { get: () => shadeHex(st.hue, st.shade), set: (v) => { st.hue = v; st.shade = 0; }, configurable: true });
  function hintText() {
    if (st.tool === 'pin') return 'Touchez pour placer une tâche';
    if (st.tool === 'link') return 'Touchez pour placer un élément';
    if (st.tool === 'planlink') return 'Touchez pour placer un lien vers un plan / une coupe';
    if (st.tool === 'erase') return 'Touchez un dessin pour l\'effacer';
    if (st.tool === 'select') return st.sel >= 0 ? 'Glissez les points · glissez le dessin pour le déplacer' : 'Touchez un dessin (ou un lien de plan) pour le modifier';
    if (st.tool === 'draw') {
      if (st.shape === 'free') return 'Dessinez · 2 doigts pour zoomer / bouger';
      if (st.shape === 'text') return 'Touchez pour placer le texte';
      if (st.shape === 'poly') return st.pend ? 'Glissez (ou touchez) pour continuer depuis le dernier point · 2 doigts = zoom' : 'Glissez du 1er au 2e point · levez le doigt, zoomez, puis continuez';
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
      <div class="grp">${TOOLS.map(([k, i, l]) => `<button class="tool ${st.tool === k ? 'on' : ''}" data-t="${k}" title="${l}">${ic(k, i)}${k === 'draw' ? '<i class="tri"></i>' : ''}</button>`).join('')}</div>
      <div class="grp"><button class="tool" data-t="undo" title="Annuler">${icon('undo')}</button><button class="tool" data-t="toggle" title="Réduire">${icon('chevright')}</button></div>`
      : `<div class="grp"><button class="tool on" data-t="toggle">${ic(cur[0], cur[1])}</button></div>
         ${['draw', 'select', 'erase'].includes(st.tool) ? `<div class="grp"><button class="tool" data-t="undo">${icon('undo')}</button></div>` : ''}`;
    $$('.tool', t).forEach(b => b.onclick = (e) => { e.stopPropagation(); onTool(b.dataset.t, b); });
    let hint = $('.hint', viewer);
    const msg = hintText();
    if (msg) { if (!hint) { hint = document.createElement('div'); hint.className = 'hint'; viewer.appendChild(hint); } hint.textContent = msg; }
    else if (hint) hint.remove();
    renderPBar();
  }
  // Barre de propriétés : couleur, intensité (foncé ↔ clair), épaisseur
  function renderPBar() {
    let bar = $('.pbar', el);
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
        ${st.pend ? `<button class="pb" data-p="cancel">${icon('close')}</button><button class="pb ok" data-p="finish">${icon('check')}</button>` : ''}
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
      st.tool = 'draw'; st.shape = b.dataset.s; st.pend = null; st.sel = -1;
      closeFly(); drawPending(); renderSel(); renderTools();
    });
    st.flyout = f;
  }
  function closeFly() { if (st.flyout) { st.flyout.remove(); st.flyout = null; } }
  function onTool(t, btn) {
    if (t === 'toggle') { closeFly(); st.toolsOpen = !st.toolsOpen; return renderTools(); }
    if (t === 'draw') { if (st.flyout) return closeFly(); return openShapePicker(btn); }
    closeFly();
    if (t === 'undo') {
      if (!st.undo.length) return toast('Rien à annuler');
      plan.annotations = JSON.parse(st.undo.pop()); st.sel = -1; renderAnnots(); saveAnnots(); renderSel(); renderMarkers(); return renderTools();
    }
    st.tool = st.tool === t && t !== 'pan' ? 'pan' : t; st.pend = null; st.sel = -1;
    drawPending(); renderSel(); renderTools();
  }

  // ---------- Liens vers un autre plan / une coupe ----------
  async function pickPlan(title) {
    const [plans, folders] = await Promise.all([DB.byProject('plans', plan.projectId), DB.byProject('folders', plan.projectId)]);
    const others = plans.filter(p => p.id !== plan.id);
    if (!others.length) { toast('Importez d\'abord la coupe / le plan dans « Plans »'); return null; }
    const fname = (id) => (folders.find(f => f.id === id) || {}).name;
    others.sort((a, b) => `${fname(a.folderId) || ''} ${a.name}`.localeCompare(`${fname(b.folderId) || ''} ${b.name}`, 'fr', { numeric: true }));
    const id = await menu(title, others.map(p => ({ label: (fname(p.folderId) ? fname(p.folderId) + ' / ' : '') + p.name, icon: 'plans', value: p.id })));
    return id ? others.find(p => p.id === id) : null;
  }
  async function createPlanLink(x, y) {
    const target = await pickPlan('Lier à quel plan / coupe ?');
    if (!target) return;
    const r = await formSheet('Nom du lien', [{ name: 'name', label: 'Nom affiché sur le plan (ex : Coupe A-A)', value: target.name }], { okLabel: 'Créer' });
    if (!r) return;
    await DB.put('links', { projectId: plan.projectId, planId: plan.id, kind: 'planlink', shape: 'point', x, y, targetPlanId: target.id, name: r.name || target.name, color: '#1e88e5', items: [] });
    await reloadData();
  }
  async function openPlanLink(l) {
    const target = await DB.get('plans', l.targetPlanId);
    if (!target) { if (await confirmBox('Le plan lié a été supprimé. Supprimer ce lien ?')) await DB.del('links', l.id); return; }
    openPlanViewer(target, { ...ctx, onClose: () => {} });
  }
  async function editPlanLink(l) {
    const v = await menu(l.name, [
      { label: 'Ouvrir le plan lié', icon: 'section', value: 'open' }, { label: 'Changer le plan lié', icon: 'plans', value: 'change' },
      { label: 'Renommer', icon: 'edit', value: 'rename' }, { label: 'Supprimer le lien', icon: 'trash', danger: true, value: 'del' },
    ]);
    if (v === 'open') return openPlanLink(l);
    if (v === 'change') { const t = await pickPlan('Nouveau plan lié'); if (t) { l.targetPlanId = t.id; await DB.put('links', l); } }
    if (v === 'rename') { const r = await formSheet('Renommer', [{ name: 'name', label: 'Nom', value: l.name }]); if (r && r.name) { l.name = r.name; await DB.put('links', l); } }
    if (v === 'del' && await confirmBox('Supprimer ce lien ?')) await DB.del('links', l.id);
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
  function finishPending() {
    const pd = st.pend; st.pend = null;
    if (pd && pd.pts.length >= 2) addAnnot({ type: st.shape === 'poly' ? 'poly' : st.shape, pts: pd.pts.map(p => [...p]) });
    drawPending(); renderTools();
  }

  // ---------- Sélection / modification ----------
  function handlesOf(a) {
    if (a.type === 'pen' || a.type === 'text') return [];
    return a.pts;
  }
  function renderSel() {
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
      g = { type: 'pinch', d: Math.hypot(a[0] - b[0], a[1] - b[1]), cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 };
      gPrev.innerHTML = ''; hideLoupe();
      return;
    }
    if (ptrs.size > 2) return;
    const p = toImg(e.clientX, e.clientY);
    g = { type: 'one', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, t0: Date.now(), moved: false, start: p, pts: [p] };
    // mode du geste
    if (st.tool === 'select' && st.sel >= 0) {
      const a = plan.annotations[st.sel];
      const hi = handlesOf(a).findIndex(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 22 / st.scale);
      if (hi >= 0) g.edit = { kind: 'handle', i: hi };
      else if (hitAnnot(a, p[0], p[1], 18 / st.scale)) g.edit = { kind: 'move' };
    }
    const dragDraw = st.tool === 'draw' && !st.pend && (st.shape === 'free' || TWO_PT.includes(st.shape));
    g.mode = g.edit ? 'edit' : (dragDraw || (st.tool === 'draw' && st.shape === 'poly') || ['pin', 'link', 'planlink'].includes(st.tool)) ? 'draw' : 'pan';
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
    const slop = g.mode === 'draw' && st.tool === 'draw' ? 6 : (g.mode === 'edit' ? 4 : 14);
    if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > slop) g.moved = true;
    if (!g.moved) { g.lx = e.clientX; g.ly = e.clientY; return; }
    const p = toImg(e.clientX, e.clientY);
    if (g.mode === 'pan') {
      st.tx += e.clientX - g.lx; st.ty += e.clientY - g.ly; applyT();
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
  const endPtr = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (!g) return;
    hideLoupe();
    if (g.type === 'pinch') { if (ptrs.size === 0) { g = null; scheduleHD(); drawPending(); renderSel(); } else g = { type: 'idle' }; return; }
    if (g.type !== 'one') { if (ptrs.size === 0) g = null; return; }
    const cur = g; g = null; gPrev.innerHTML = '';
    scheduleHD();
    if (cur.mode === 'edit' && cur.moved) { saveAnnots(); renderSel(); return; }
    if (!cur.moved) return onTap(cur.start);
    if (cur.mode !== 'draw' || !cur.end) return;
    if (st.tool === 'pin' || st.tool === 'link' || st.tool === 'planlink') return onTap(cur.end, true);
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
        if (l.kind === 'planlink') consider(Math.hypot(x - lx, y - ly) * 0.9, { kind: 'planlink', obj: l });
        else consider(Math.min(Math.hypot(x - lx, y - (ly - head(31))), Math.hypot(x - lx, y - ly)), { kind: 'link', obj: l });
      }
    }
    return best;
  }

  async function onTap([x, y], aimed = false) {
    // double-tap = zoom
    const now = Date.now();
    if (!aimed && st.tool === 'pan' && now - lastTap < 300) {
      const r = viewer.getBoundingClientRect();
      zoomAt(r.left + x * st.scale + st.tx, r.top + y * st.scale + st.ty, 2); lastTap = 0; return;
    }
    lastTap = now;
    if (st.tool === 'select') {
      st.sel = annotAt(x, y); renderSel(); renderTools();
      if (st.sel < 0) toast('Aucun dessin ici');
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
    if (hit && hit.kind === 'planlink' && ['pan', 'pin', 'link', 'planlink', 'select'].includes(st.tool)) {
      if (st.tool === 'select') await editPlanLink(hit.obj); else await openPlanLink(hit.obj);
      await reloadData(); return;
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
  $('[data-a=more]', el).onclick = async () => {
    const v = await menu(plan.name, [
      { label: 'Renommer', icon: 'edit', value: 'rename' },
      { label: 'Ajuster à l\'écran', icon: 'plans', value: 'fit' },
      { label: 'Supprimer le plan', icon: 'trash', danger: true, value: 'del' },
    ]);
    if (v === 'fit') fit();
    if (v === 'rename') {
      const r = await formSheet('Renommer', [{ name: 'name', label: 'Nom du plan', value: plan.name }]);
      if (r && r.name) { plan.name = r.name; await DB.put('plans', plan); $('h1', el).textContent = plan.name; }
    }
    if (v === 'del' && await confirmBox('Supprimer ce plan et ses annotations ?')) {
      await DB.del('plans', plan.id); await DB.del('files', plan.fileId);
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
