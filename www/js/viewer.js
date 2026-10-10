// Visionneuse de plan : zoom, déplacement, pins de tâches, liens (éléments) et annotations
const STATUS = {
  open: { label: 'Ouvert', color: '#ef4444' },
  progress: { label: 'En cours', color: '#f59e0b' },
  done: { label: 'Terminé', color: '#3b82f6' },
  verified: { label: 'Vérifié', color: '#22c55e' },
};
const PALETTE = ['#ff0000', '#008000', '#0000ff', '#ff00ff', '#ff8000', '#ffff00', '#00ff00', '#00ffff', '#ffffff', '#000000'];
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
    case 'pen': return `<polyline points="${a.pts.map(pt => pt.join(',')).join(' ')}" ${common}/>`;
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
  if (a.type === 'pen') {
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

  const st = {
    scale: 1, tx: 0, ty: 0,
    tool: 'pan', shape: 'cloud', color: '#ff0000', textSize: 16,
    filters: { tasks: true, links: true, annots: true },
    tasks: [], links: [], undo: [], flyout: null, fitScale: 1,
    pinSize: (() => { try { return +localStorage.getItem('pinSize') || 1; } catch (e) { return 1; } })(),
  };
  // Taille des pins : proportionnelle au zoom (petits quand on dézoome, limités quand on zoome)
  const pinM = () => Math.max(0.12, Math.min(0.8, (st.scale / st.fitScale) * 0.26 * st.pinSize));

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
      <div class="stage"><img src="${src}" width="${W}" height="${H}"><svg class="ov" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <g class="g-annots"></g><g class="g-preview"></g><g class="g-links"></g><g class="g-tasks"></g></svg></div>
      <div class="tools"></div>
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
    const vw = viewer.clientWidth - 64, vh = viewer.clientHeight; // laisse la place à la barre d'outils
    st.scale = Math.min(vw / W, vh / H) * 0.96;
    st.fitScale = st.scale;
    st.tx = (vw - W * st.scale) / 2; st.ty = (vh - H * st.scale) / 2;
    applyT();
  }
  let rafPending = false;
  function applyT() {
    stage.style.transform = `translate(${st.tx}px,${st.ty}px) scale(${st.scale})`;
    if (!rafPending) { rafPending = true; requestAnimationFrame(() => { rafPending = false; renderMarkers(); }); }
  }
  function toImg(cx, cy) {
    const r = viewer.getBoundingClientRect();
    return [(cx - r.left - st.tx) / st.scale, (cy - r.top - st.ty) / st.scale];
  }
  function zoomAt(cx, cy, factor) {
    const r = viewer.getBoundingClientRect();
    const minS = Math.min(viewer.clientWidth / W, viewer.clientHeight / H) * 0.5;
    const ns = Math.max(minS, Math.min(8, st.scale * factor));
    const k = ns / st.scale;
    st.tx = (cx - r.left) - k * ((cx - r.left) - st.tx);
    st.ty = (cy - r.top) - k * ((cy - r.top) - st.ty);
    st.scale = ns; applyT();
  }

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
      if (l.shape === 'zone') {
        return `<g><rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" fill="${l.color}" fill-opacity=".18" stroke="${l.color}" stroke-width="${1.5 * ls}" stroke-dasharray="${6 * ls} ${4 * ls}"/>
          <g transform="translate(${l.x + l.w / 2},${l.y + l.h / 2}) scale(${s})">${linkBadge(l.color, n)}</g>
          ${showLabel ? `<text x="${l.x + 3 * ls}" y="${l.y - 4 * ls}" font-size="${11 * ls}" fill="${l.color}" font-weight="700" font-family="Arial" paint-order="stroke" stroke="#fff" stroke-width="${3 * ls}">${esc(l.name)}</text>` : ''}</g>`;
      }
      return `<g transform="translate(${l.x},${l.y}) scale(${s})">${linkPin(l.color, n)}
        ${showLabel ? `<text x="0" y="16" text-anchor="middle" font-size="12" fill="${l.color}" font-weight="700" font-family="Arial" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(l.name)}</text>` : ''}</g>`;
    }).join('');
    const info = $('.vb-info', el);
    const nt = st.tasks.filter(t => t.planId === plan.id).length, nl = st.links.filter(l => l.planId === plan.id).length;
    info.textContent = `${nt} tâche(s) · ${nl} lien(s) · ${plan.annotations.length} annotation(s)`;
  }
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

  // ---------- Toolbar ----------
  const TOOLS_HINT = {
    pan: '', pin: 'Touchez le plan pour placer une tâche',
    link: 'Toucher = pin · Glisser = zone',
    pen: 'Dessinez avec le doigt', shape: 'Glissez pour dessiner la forme',
    text: 'Touchez pour ajouter du texte', erase: 'Touchez une annotation pour l\'effacer',
  };
  function renderTools() {
    const t = $('.tools', el);
    const shapeIcon = { cloud: 'cloud', rect: 'rect', ellipse: 'circle', arrow: 'arrow', line: 'line' }[st.shape];
    t.innerHTML = `
      <div class="grp">
        <button class="tool ${st.tool === 'pin' ? 'on' : ''}" data-t="pin">${icon('pin')}</button>
        <button class="tool ${st.tool === 'link' ? 'on' : ''}" data-t="link">${icon('link')}</button>
        <button class="tool ${st.tool === 'pen' ? 'on' : ''}" data-t="pen">${icon('pen')}</button>
        <button class="tool ${st.tool === 'shape' ? 'on' : ''}" data-t="shape">${icon(shapeIcon)}</button>
        <button class="tool ${st.tool === 'text' ? 'on' : ''}" data-t="text"><span style="font-size:26px;font-family:Georgia,serif">a</span></button>
        <button class="tool ${st.tool === 'erase' ? 'on' : ''}" data-t="erase">${icon('eraser')}</button>
      </div>
      <div class="grp"><button class="tool" data-t="color"><span class="swatch" style="background:${st.color}"></span></button></div>
      <div class="grp">
        <button class="tool ${st.tool === 'pan' ? 'on' : ''}" data-t="pan">${icon('move')}</button>
        <button class="tool" data-t="undo">${icon('undo')}</button>
        <button class="tool del" data-t="clear">${icon('trash')}</button>
      </div>`;
    $$('.tool', t).forEach(b => b.onclick = (e) => { e.stopPropagation(); onTool(b.dataset.t, b); });
    let hint = $('.hint', viewer);
    const msg = TOOLS_HINT[st.tool];
    if (msg) { if (!hint) { hint = document.createElement('div'); hint.className = 'hint'; viewer.appendChild(hint); } hint.textContent = msg; }
    else if (hint) hint.remove();
  }
  function closeFly() { if (st.flyout) { st.flyout.remove(); st.flyout = null; } }
  function flyout(btn, html, onPick) {
    closeFly();
    const f = document.createElement('div');
    f.className = 'flyout';
    f.innerHTML = html;
    const tb = btn.getBoundingClientRect(), vr = viewer.getBoundingClientRect();
    f.style.top = (tb.top - vr.top) + 'px';
    viewer.appendChild(f);
    // garde la flyout dans l'écran
    const fr = f.getBoundingClientRect();
    if (fr.bottom > vr.bottom - 4) f.style.top = Math.max(4, (tb.bottom - vr.top) - fr.height) + 'px';
    $$('button', f).forEach(b => b.onclick = (e) => { e.stopPropagation(); onPick(b.dataset.v); closeFly(); renderTools(); });
    st.flyout = f;
  }
  function onTool(t, btn) {
    if (t === 'color') {
      return flyout(btn, PALETTE.map(c => `<button data-v="${c}" class="${c === st.color ? 'on' : ''}"><span class="sw" style="background:${c}"></span></button>`).join(''), v => st.color = v);
    }
    if (t === 'shape' && (st.tool === 'shape' || st.flyout == null)) {
      const opts = [['cloud', 'cloud'], ['rect', 'rect'], ['ellipse', 'circle'], ['arrow', 'arrow'], ['line', 'line']];
      st.tool = 'shape';
      return flyout(btn, opts.map(([v, i]) => `<button data-v="${v}" class="${v === st.shape ? 'on' : ''}">${icon(i)}</button>`).join(''), v => st.shape = v);
    }
    if (t === 'text') {
      st.tool = 'text';
      return flyout(btn, TEXT_SIZES.map(s => `<button data-v="${s}" class="${s === st.textSize ? 'on' : ''}">${s}</button>`).join(''), v => st.textSize = +v);
    }
    closeFly();
    if (t === 'undo') {
      if (!st.undo.length) return toast('Rien à annuler');
      plan.annotations = JSON.parse(st.undo.pop()); renderAnnots(); saveAnnots(); renderMarkers(); return;
    }
    if (t === 'clear') {
      if (!plan.annotations.length) return toast('Aucune annotation');
      confirmBox('Effacer toutes les annotations de ce plan ?', 'Tout effacer').then(ok => {
        if (!ok) return; pushUndo(); plan.annotations = []; renderAnnots(); saveAnnots(); renderMarkers();
      });
      return;
    }
    st.tool = (st.tool === t && t !== 'pan') ? 'pan' : t;
    renderTools();
  }

  // ---------- Gestes ----------
  const ptrs = new Map();
  let g = null; // geste en cours
  viewer.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.tools') || e.target.closest('.flyout')) return;
    closeFly();
    viewer.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      g = { type: 'pinch', d: Math.hypot(a[0] - b[0], a[1] - b[1]), cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 };
      gPrev.innerHTML = '';
      return;
    }
    if (ptrs.size > 2) return;
    const p = toImg(e.clientX, e.clientY);
    g = { type: 'one', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, t0: Date.now(), moved: false, start: p, pts: [p] };
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
    if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 8) g.moved = true;
    const drawTool = ['pen', 'shape', 'link'].includes(st.tool);
    if (!drawTool) {
      st.tx += e.clientX - g.lx; st.ty += e.clientY - g.ly; applyT();
    } else if (g.moved) {
      const p = toImg(e.clientX, e.clientY);
      if (st.tool === 'pen') { g.pts.push(p); gPrev.innerHTML = annotSVG({ type: 'pen', pts: g.pts, color: st.color, sw: base / 350 }); }
      else if (st.tool === 'shape') { g.end = p; gPrev.innerHTML = annotSVG({ type: st.shape, pts: [g.start, p], color: st.color, sw: base / 350 }); }
      else if (st.tool === 'link') {
        g.end = p;
        const x = Math.min(g.start[0], p[0]), y = Math.min(g.start[1], p[1]);
        gPrev.innerHTML = `<rect x="${x}" y="${y}" width="${Math.abs(p[0] - g.start[0])}" height="${Math.abs(p[1] - g.start[1])}" fill="${st.color}" fill-opacity=".15" stroke="${st.color}" stroke-width="${2 / st.scale}" stroke-dasharray="${8 / st.scale} ${5 / st.scale}"/>`;
      }
    }
    g.lx = e.clientX; g.ly = e.clientY;
  });
  const endPtr = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (!g) return;
    if (g.type === 'pinch') { if (ptrs.size === 0) g = null; else g = { type: 'idle' }; return; }
    if (g.type !== 'one') { if (ptrs.size === 0) g = null; return; }
    const cur = g; g = null; gPrev.innerHTML = '';
    if (!cur.moved) return onTap(cur.start);
    const sw = base / 350;
    if (st.tool === 'pen' && cur.pts.length > 1) {
      pushUndo(); plan.annotations.push({ id: DB.uid(), type: 'pen', pts: simplify(cur.pts, 1 / st.scale), color: st.color, sw });
      renderAnnots(); saveAnnots(); renderMarkers();
    } else if (st.tool === 'shape' && cur.end) {
      pushUndo(); plan.annotations.push({ id: DB.uid(), type: st.shape, pts: [cur.start, cur.end], color: st.color, sw });
      renderAnnots(); saveAnnots(); renderMarkers();
    } else if (st.tool === 'link' && cur.end) {
      const x = Math.min(cur.start[0], cur.end[0]), y = Math.min(cur.start[1], cur.end[1]);
      const w = Math.abs(cur.end[0] - cur.start[0]), h = Math.abs(cur.end[1] - cur.start[1]);
      if (w * st.scale < 20 || h * st.scale < 20) return onTap(cur.start);
      createLink({ shape: 'zone', x, y, w, h });
    }
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
    const tol = Math.max(16, 26 * m) / st.scale;      // zone de toucher (px écran → plan)
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
        if (l.shape === 'zone') { if (x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h) consider(tol * 0.99, { kind: 'link', obj: l }); }
        else consider(Math.min(Math.hypot(x - l.x, y - (l.y - head(31))), Math.hypot(x - l.x, y - l.y)), { kind: 'link', obj: l });
      }
    }
    return best;
  }

  async function onTap([x, y]) {
    // double-tap = zoom
    const now = Date.now();
    if (st.tool === 'pan' && now - lastTap < 300) {
      const r = viewer.getBoundingClientRect();
      zoomAt(r.left + x * st.scale + st.tx, r.top + y * st.scale + st.ty, 2); lastTap = 0; return;
    }
    lastTap = now;
    if (st.tool === 'erase') {
      const tol = 14 / st.scale;
      for (let i = plan.annotations.length - 1; i >= 0; i--) {
        if (hitAnnot(plan.annotations[i], x, y, tol)) {
          pushUndo(); plan.annotations.splice(i, 1); renderAnnots(); saveAnnots(); renderMarkers(); return;
        }
      }
      return toast('Aucune annotation ici');
    }
    const hit = hitMarker(x, y);
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
    } else if (st.tool === 'text') {
      const r = await formSheet('Texte', [{ name: 'text', label: 'Texte à afficher sur le plan' }], { okLabel: 'Ajouter' });
      if (r && r.text) {
        pushUndo();
        plan.annotations.push({ id: DB.uid(), type: 'text', pts: [[x, y]], text: r.text, color: st.color, fs: st.textSize * base / 500 });
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
