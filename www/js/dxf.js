// ================= Plans AutoCAD (DXF) : affichage vectoriel, sélection / tracé de parties d'ouvrage, couleurs par état, 3D =================
// Le DWG est lu sur le téléphone (js/dwg.js, LibreDWG) puis converti en DXF.
async function needDXF() { await loadScript('vendor/dxf/dxf-parser.js'); }
const _dxfCache = {};
async function dxfLoad(fileId) {
  if (_dxfCache[fileId]) return _dxfCache[fileId];
  const f = await DB.get('files', fileId); if (!f || !f.blob) throw new Error('Fichier DXF introuvable (synchronisez)');
  await needDXF();
  const txt = await f.blob.text();
  const d = new DxfParser().parseSync(txt);
  return (_dxfCache[fileId] = dxfFlatten(d));
}
// entités → primitives à plat (polylignes + textes) en coordonnées du dessin, blocs (INSERT) développés
function dxfFlatten(d) {
  const prims = [], layers = {};
  const lay = (d.tables && d.tables.layer && d.tables.layer.layers) || {};
  const colOf = (e) => { const c = e.color ?? (lay[e.layer] || {}).color; return typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : null; };
  const arcPts = (cx, cy, r, a0, a1) => { if (a1 < a0) a1 += Math.PI * 2; const n = Math.max(8, Math.min(72, Math.ceil((a1 - a0) / (Math.PI / 24)))); return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }); };
  function walk(ents, tf, depth, inhLayer) {
    for (const e of ents || []) {
      const L = (e.layer === '0' && inhLayer) ? inhLayer : (e.layer || '0'); layers[L] = layers[L] || { n: 0, color: colOf({ layer: L }) }; layers[L].n++;
      const col = colOf(e), add = (pts, closed) => { if (pts.length > 1) prims.push({ t: 'pl', pts: pts.map(tf), closed: !!closed, layer: L, col }); };
      switch (e.type) {
        case 'LINE': add(e.vertices.map(v => [v.x, v.y])); break;
        case 'LWPOLYLINE': case 'POLYLINE': { const v = (e.vertices || []).map(p => [p.x, p.y]); const closed = e.shape || (v.length > 2 && Math.hypot(v[0][0] - v[v.length - 1][0], v[0][1] - v[v.length - 1][1]) < 1e-6); add(v, closed); break; }
        case 'CIRCLE': add(arcPts(e.center.x, e.center.y, e.radius, 0, Math.PI * 2), true); break;
        case 'ARC': add(arcPts(e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle)); break;
        case 'ELLIPSE': { const mx = e.majorAxisEndPoint.x, my = e.majorAxisEndPoint.y, R = Math.hypot(mx, my), r = R * e.axisRatio, rot = Math.atan2(my, mx); const a0 = e.startAngle || 0, a1 = e.endAngle || Math.PI * 2; const n = 48;
          add(Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n, x = R * Math.cos(a), y = r * Math.sin(a); return [e.center.x + x * Math.cos(rot) - y * Math.sin(rot), e.center.y + x * Math.sin(rot) + y * Math.cos(rot)]; }), Math.abs(a1 - a0 - Math.PI * 2) < 1e-3); break; }
        case 'SOLID': case '3DFACE': { const v = (e.points || e.vertices || []).map(p => [p.x, p.y]); add(v, true); break; }
        case 'TEXT': case 'MTEXT': { const p = e.startPoint || e.position; if (!p) break; const t = String(e.text || '').replace(/\\[A-Za-z][^;]*;/g, '').replace(/\\P/g, ' ').replace(/[{}]/g, '').trim(); if (t) prims.push({ t: 'tx', p: tf([p.x, p.y]), h: (e.textHeight || e.height || 1) * (tf.k || 1), s: t.slice(0, 60), rot: (e.rotation || 0) + (tf.r || 0), layer: L, col }); break; }
        case 'INSERT': { if (depth > 4) break; const B = d.blocks && d.blocks[e.name]; if (!B) break;
          const sx = e.xScale || 1, sy = e.yScale || 1, rot = (e.rotation || 0) * Math.PI / 180, bp = B.position || { x: 0, y: 0 }, P = e.position || { x: 0, y: 0 };
          const t2 = ([x, y]) => { const u = (x - bp.x) * sx, v = (y - bp.y) * sy; return tf([P.x + u * Math.cos(rot) - v * Math.sin(rot), P.y + u * Math.sin(rot) + v * Math.cos(rot)]); };
          t2.k = (tf.k || 1) * Math.abs(sx); t2.r = (tf.r || 0) + (e.rotation || 0);
          walk(B.entities, t2, depth + 1, L); break; }
      }
    }
  }
  const id = (p) => p; id.k = 1; id.r = 0;
  walk(d.entities, id, 0, null);
  // emprise robuste (ignore les objets isolés très loin)
  const xs = [], ys = []; prims.forEach(p => (p.pts || [p.p]).forEach(q => { xs.push(q[0]); ys.push(q[1]); }));
  if (!xs.length) throw new Error('Aucun dessin lisible dans ce DXF');
  xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
  const q = (A, f) => A[Math.min(A.length - 1, Math.max(0, Math.floor(A.length * f)))];
  let x0 = q(xs, .005), x1 = q(xs, .995), y0 = q(ys, .005), y1 = q(ys, .995); const m = Math.max(x1 - x0, y1 - y0) * .03 || 1; x0 -= m; x1 += m; y0 -= m; y1 += m;
  const ins = (d.header || {}).$INSUNITS;
  return { prims, layers, box: [x0, y0, x1, y1], ins, closed: prims.filter(p => p.t === 'pl' && p.closed && p.pts.length > 2) };
}
const DXF_UNITS = { 4: 0.001, 5: 0.01, 6: 1, 1: 0.0254 };
// rendu raster du DXF (fond blanc, traits sombres)
function dxfRender(D, hidden = [], maxPx = 3200) {
  const [x0, y0, x1, y1] = D.box, s = maxPx / Math.max(x1 - x0, y1 - y0);
  const c = document.createElement('canvas'); c.width = Math.max(10, Math.round((x1 - x0) * s)); c.height = Math.max(10, Math.round((y1 - y0) * s));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  const X = (p) => [(p[0] - x0) * s, (y1 - p[1]) * s];
  const dark = (col) => { if (!col) return '#1f2937'; const n = parseInt(col.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255; return (r * .3 + gg * .59 + b * .11) > 170 ? '#334155' : col; };
  g.lineWidth = Math.max(2, maxPx / 1100); g.lineJoin = g.lineCap = 'round';
  for (const p of D.prims) {
    if (hidden.includes(p.layer)) continue;
    const col = dark(p.col || (D.layers[p.layer] || {}).color);
    if (p.t === 'pl') { g.strokeStyle = col; g.beginPath(); p.pts.forEach((q, i) => { const [a, b] = X(q); i ? g.lineTo(a, b) : g.moveTo(a, b); }); if (p.closed) g.closePath(); g.stroke(); }
    else if (p.t === 'tx') { const fs = p.h * s; if (fs < 3) continue; const [a, b] = X(p.p); g.save(); g.translate(a, b); g.rotate(-p.rot * Math.PI / 180); g.fillStyle = col; g.font = `${fs}px sans-serif`; g.fillText(p.s, 0, 0); g.restore(); }
  }
  return { canvas: c, s, toWorld: (px, py) => [x0 + px / s, y1 - py / s], toPx: (p) => X(p) };
}
const ptInPoly = (pt, P) => { let ins = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) ins = !ins; } return ins; };

// ---------- Création : importer un DXF ----------
async function newDxfModel(base) {
  const [f] = await pickFiles({ accept: '.dxf,.dwg,application/dxf,image/vnd.dxf,application/acad,application/octet-stream,*/*', multiple: false }); if (!f) return null;
  const ld = loading('Lecture du plan AutoCAD…'); let D, rec;
  try {
    const dwg = /\.dwg$/i.test(f.name), blob = dwg ? new Blob([cadToDxf(await cadFromDwgFile(f))], { type: 'application/dxf' }) : f;   // DWG → DXF sur le téléphone
    rec = await DB.put('files', { projectId: base.projectId, blob, mime: 'application/dxf', name: dwg ? f.name.replace(/\.dwg$/i, '.dxf') : f.name, role: 'dxf' });
    D = await dxfLoad(rec.id);
  } catch (e) { ld.close(); alertBox('DXF illisible : ' + (e.message || e)); return null; } ld.close();
  const u0 = DXF_UNITS[D.ins] || (Math.max(D.box[2] - D.box[0], D.box[3] - D.box[1]) > 2000 ? 0.001 : 1);
  const r = await formSheet('Plan AutoCAD', [{ name: 'name', label: 'Nom', value: base.name || f.name.replace(/\.[^.]+$/, '') },
    { name: 'u', label: 'Unité du dessin', type: 'select', value: String(u0), options: [{ value: '0.001', label: 'Millimètres' }, { value: '0.01', label: 'Centimètres' }, { value: '1', label: 'Mètres' }] }], { okLabel: 'Ouvrir' });
  if (!r) return null;
  const m = { ...base, type: 'dxf', name: r.name || 'Plan AutoCAD', fileId: rec.id, fileName: f.name, unit: +r.u || 1, zones: [], hidden: [] };
  await saveModel(base.projectId, m); return m;
}

// ---------- Plan DXF : zones colorées par état ----------
async function openDxfPlan(m) {
  const p = await DB.get('projects', m.projectId), C = m3colors(p);
  let D; const ld = loading('Ouverture du plan AutoCAD…');
  try { D = await dxfLoad(m.fileId); } catch (e) { ld.close(); alertBox(e.message || String(e)); return; }
  let R = dxfRender(D, m.hidden || []); ld.close();
  return new Promise((resolve) => {
    const el = planPage(m.name); el.classList.add('dxfpage');
    const unBack = pushBack(() => fin(true));
    function fin(fromBack) { if (!fromBack) unBack(); el.remove(); resolve(); }
    $('[data-a=x]', el).onclick = () => fin();
    let S = planStage(el, R.canvas), mode = null, tr = [], pick = null;
    const lw = () => 3 / S.scale();
    const draw = () => {
      const g = S.g; g.clearRect(0, 0, S.ov.width, S.ov.height);
      for (const z of m.zones) {
        const P = z.poly.map(R.toPx), col = C[z.status || 'todo'];
        g.fillStyle = col + '88'; g.strokeStyle = col; g.lineWidth = lw(); g.beginPath(); P.forEach((q, i) => i ? g.lineTo(...q) : g.moveTo(...q)); g.closePath(); g.fill(); g.stroke();
        const cx = P.reduce((a, q) => a + q[0], 0) / P.length, cy = P.reduce((a, q) => a + q[1], 0) / P.length, fs = Math.max(12 / S.scale(), 10);
        g.font = `bold ${fs}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = fs / 4; g.strokeStyle = '#fff'; g.strokeText(z.name, cx, cy); g.fillStyle = '#0f172a'; g.fillText(z.name, cx, cy);
      }
      if (pick) { g.strokeStyle = '#2563eb'; g.lineWidth = lw() * 2; g.beginPath(); pick.map(R.toPx).forEach((q, i) => i ? g.lineTo(...q) : g.moveTo(...q)); g.closePath(); g.stroke(); }
      if (tr.length) { g.strokeStyle = '#ef4444'; g.fillStyle = 'rgba(239,68,68,.15)'; g.lineWidth = lw(); g.beginPath(); tr.map(R.toPx).forEach((q, i) => i ? g.lineTo(...q) : g.moveTo(...q)); g.fill(); g.stroke(); tr.map(R.toPx).forEach(q => { g.fillStyle = '#ef4444'; g.beginPath(); g.arc(q[0], q[1], lw() * 2.5, 0, 7); g.fill(); }); }
    };
    const ui = () => {
      const st = $('.ps-step', el), bar = $('.ps-bar', el);
      const cnt = M3D_STATUS.map(s => [s, m.zones.filter(z => (z.status || 'todo') === s.k).length]).filter(x => x[1]);
      st.innerHTML = mode === 'sel' ? `<b>Sélection</b> — touchez l'intérieur d'un contour fermé du plan (voile, poteau, dalle…)`
        : mode === 'trace' ? `<b>Tracé</b> — touchez les angles (accroche aux sommets du DXF). ${tr.length} point(s)`
        : (m.zones.length ? `<span class="dxf-leg">${cnt.map(([s, n]) => `<i style="background:${C[s.k]}"></i>${s.l} ${n}`).join(' · ')}</span>` : `Touchez <b>Sélectionner</b> puis un contour, ou <b>Tracer</b> une partie d'ouvrage.`);
      bar.innerHTML = mode === 'trace' ? `<button data-b="undo">↶</button><button data-b="cancel">Annuler</button><button data-b="close" class="ok" ${tr.length < 3 ? 'disabled' : ''}>✓ Fermer</button>`
        : `<button data-b="sel" class="${mode === 'sel' ? 'on' : ''}">⬚ Sélectionner</button><button data-b="trace">✎ Tracer</button><button data-b="lay">☰ Calques</button><button data-b="3d" class="ok" ${m.zones.length ? '' : 'disabled'}>3D</button>`;
      $$('[data-b]', bar).forEach(b => b.onclick = () => act(b.dataset.b));
    };
    const save = () => saveModel(m.projectId, m);
    const newZone = async (poly) => {
      const r = await formSheet('Partie d\'ouvrage', [{ name: 'name', label: 'Nom', placeholder: 'Ex : Voile V12 R+3' },
        { name: 'kind', label: 'Type', type: 'select', value: 'poteau', options: [{ value: 'poteau', label: 'Voile / poteau (hauteur)' }, { value: 'dalle', label: 'Dalle / radier (épaisseur)' }] },
        { name: 'h', label: 'Hauteur / épaisseur (m)', type: 'number', value: '3' },
        { name: 'st', label: 'État', type: 'select', value: 'todo', options: M3D_STATUS.map(s => ({ value: s.k, label: s.l })) }], { okLabel: 'Ajouter' });
      if (!r) return;
      m.zones.push({ id: DB.uid(), name: r.name || `Zone ${m.zones.length + 1}`, poly, kind: r.kind, h: num(r.h) || 3, status: r.st }); await save(); toast('Ajouté ✓');
    };
    const zoneMenu = async (z) => {
      const v = await menu(z.name, [...M3D_STATUS.map(s => ({ label: s.l, swatch: C[s.k], value: 'st:' + s.k, checked: (z.status || 'todo') === s.k })),
        { label: 'Renommer / hauteur', icon: 'edit', value: 'ed' }, { label: 'Créer le ferraillage de cette partie', icon: 'rows', value: 'fer' }, { label: 'Supprimer la zone', icon: 'trash', danger: true, value: 'del' }]);
      if (!v) return;
      if (v.startsWith('st:')) { z.status = v.slice(3); await save(); toast('État : ' + M3D_STATUS.find(s => s.k === z.status).l); }
      if (v === 'ed') { const r = await formSheet('Zone', [{ name: 'name', label: 'Nom', value: z.name }, { name: 'h', label: 'Hauteur / épaisseur (m)', type: 'number', value: String(z.h) }]); if (r) { z.name = r.name || z.name; z.h = num(r.h) || z.h; await save(); } }
      if (v === 'fer') { const base = { id: DB.uid(), projectId: m.projectId, name: z.name, linkId: m.linkId || null, status: z.status || 'todo', createdAt: Date.now() }; const fm = await newElemModel(base); if (fm) await openModel(fm); }
      if (v === 'del' && await confirmBox('Supprimer cette zone ?')) { m.zones = m.zones.filter(x => x !== z); await save(); }
      draw(); ui();
    };
    const act = async (a) => {
      if (a === 'sel') { mode = mode === 'sel' ? null : 'sel'; }
      if (a === 'trace') { mode = 'trace'; tr = []; }
      if (a === 'cancel') { mode = null; tr = []; }
      if (a === 'undo') tr.pop();
      if (a === 'close') { const P = tr.slice(); mode = null; tr = []; draw(); ui(); await newZone(P); }
      if (a === 'lay') {
        const names = Object.keys(D.layers).sort(); if (!names.length) return;
        const v = await menu('Calques (toucher pour masquer / afficher)', names.map(n => ({ label: `${n} (${D.layers[n].n})`, swatch: D.layers[n].color || '#334155', value: n, checked: !(m.hidden || []).includes(n) })));
        if (v) { m.hidden = (m.hidden || []).includes(v) ? m.hidden.filter(x => x !== v) : [...(m.hidden || []), v]; await save();
          const ld2 = loading('Mise à jour…'); R = dxfRender(D, m.hidden); ld2.close(); $('.ps-stage', el).replaceWith(Object.assign(document.createElement('div'), { className: 'ps-stage', innerHTML: '<canvas class="ps-cv"></canvas><canvas class="ps-ov"></canvas>' })); S = planStage(el, R.canvas); S.tap = onTap; }
      }
      if (a === '3d') { await openModel(m); }
      draw(); ui();
    };
    const snapPt = (w) => { let best = null, bd = 14 / S.scale() / R.s; for (const p of D.prims) if (p.t === 'pl' && !(m.hidden || []).includes(p.layer)) for (const q of p.pts) { const d = Math.hypot(q[0] - w[0], q[1] - w[1]); if (d < bd) { bd = d; best = q; } } return best ? [best[0], best[1]] : w; };
    const onTap = async ([px, py]) => {
      const w = R.toWorld(px, py);
      if (mode === 'trace') { tr.push(snapPt(w)); draw(); ui(); return; }
      if (mode === 'sel') {
        const cand = D.closed.filter(p => !(m.hidden || []).includes(p.layer) && ptInPoly(w, p.pts)).map(p => ({ p, a: polyArea(p.pts) })).sort((a, b) => a.a - b.a);
        if (!cand.length) { toast('Aucun contour fermé ici — utilisez ✎ Tracer'); return; }
        pick = cand[0].p.pts; draw(); await newZone(pick.map(q => [q[0], q[1]])); pick = null; mode = null; draw(); ui(); return;
      }
      const z = m.zones.slice().reverse().find(z => ptInPoly(w, z.poly)); if (z) zoneMenu(z);
    };
    S.tap = onTap; draw(); ui();
  });
}
// 3D des zones (extrusion), couleur par état
function buildDxfZones(T, grp, m, C) {
  if (!m.zones.length) return;
  const u = m.unit || 1, o = m.zones[0].poly[0];
  m.zones.forEach(z => {
    const pts = z.poly.map(([x, y]) => new T.Vector2((x - o[0]) * u, (y - o[1]) * u)); if (pts.length < 3) return;
    const geo = new T.ExtrudeGeometry(new T.Shape(pts), { depth: z.h || 3, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    const mesh = new T.Mesh(geo, new T.MeshStandardMaterial({ color: C[z.status || 'todo'], roughness: .7 })); mesh.userData.zone = z; grp.add(mesh);
    grp.add(new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: '#1e293b' })));
  });
}
