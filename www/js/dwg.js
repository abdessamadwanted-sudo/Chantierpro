// ================= AutoCAD DWG sur le téléphone : lecture (LibreDWG wasm), export DXF, tracé PDF vectoriel (format, épaisseurs, couleurs), fusion / division de PDF =================
// lecture dans un Worker (module) : pas de blocage de l'écran, arrêt si le fichier ne se lit pas
const _lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
function dwgRead(buf, ms = 150000, name = '') {
  _lsSet('dwg.reading', JSON.stringify({ name, at: Date.now() }));   // si le lecteur fait planter l'appli, on le dira au redémarrage
  return new Promise((resolve0, reject0) => {
    const resolve = (v) => { _lsSet('dwg.reading', null); resolve0(v); }, reject = (e) => { _lsSet('dwg.reading', null); reject0(e); };
    let w; try { w = new Worker(new URL('js/dwg-worker.js', location.href), { type: 'module' }); } catch (e) { return reject(new Error('Lecteur DWG non disponible sur ce téléphone')); }
    const t = setTimeout(() => { w.terminate(); reject(new Error('Lecture trop longue : ce DWG n\'a pas pu être lu')); }, ms);
    w.onmessage = (ev) => { clearTimeout(t); w.terminate(); ev.data.ok ? resolve(ev.data.db) : reject(new Error(ev.data.err)); };
    w.onerror = (ev) => { clearTimeout(t); w.terminate(); reject(new Error(ev.message || 'Erreur du lecteur DWG')); };
    w.postMessage(buf, [buf]);
  });
}

// ---------- couleurs AutoCAD (ACI) et épaisseurs ----------
const ACI = (() => {
  const t = ['#000000', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffffff', '#808080', '#c0c0c0'];
  const hx = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  const hsv = (h, s, v) => { const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), u = v * (1 - (1 - f) * s); return [[v, u, p], [q, v, p], [p, v, u], [p, q, v], [u, p, v], [v, p, q]][i % 6]; };
  const V = [1, .8, .6, .5, .3];
  for (let i = 10; i < 250; i++) { const k = i % 10; t[i] = hx(...hsv(((Math.floor(i / 10) - 1) * 15) / 360, k & 1 ? .5 : 1, V[k >> 1])); }
  ['#333333', '#505050', '#696969', '#828282', '#bebebe', '#ffffff'].forEach((c, j) => t[250 + j] = c);
  return t;
})();
const rgbHex = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
const LW_MM = [0, .05, .09, .13, .15, .18, .2, .25, .3, .35, .4, .5, .53, .6, .7, .8, .9, 1, 1.06, 1.2, 1.4, 1.58, 2, 2.11];
// index DWG → mm ; null = défaut, 'L' = du calque, 'B' = du bloc
const lwOfDwg = (v) => v == null || v === 31 ? null : v === 29 ? 'L' : v === 30 ? 'B' : v >= 0 && v < LW_MM.length ? LW_MM[v] : v > 31 ? v / 100 : null;

// ---------- textes AutoCAD ----------
const cadText = (s) => String(s ?? '').replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±').replace(/%%[uUoOkK]/g, '').replace(/%%%/g, '%').replace(/%%(\d{3})/g, (_, n) => String.fromCharCode(+n));
function mtextLines(s) {
  s = cadText(s).replace(/\\\\/g, '\u0001').replace(/\\\{/g, '\u0002').replace(/\\\}/g, '\u0003')
    .replace(/\\P/g, '\n').replace(/\\~/g, ' ').replace(/\\S([^;]*?)[\^#\/]([^;]*);/g, '$1/$2')
    .replace(/\\[ACFfHQTWpc][^;]*;/g, '').replace(/\\[LlOoKkNX]/g, '').replace(/[{}]/g, '')
    .replace(/\u0001/g, '\\').replace(/\u0002/g, '{').replace(/\u0003/g, '}');
  return s.split('\n');
}

// ---------- géométrie ----------
const mMul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const mAp = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
const M_ID = [1, 0, 0, 1, 0, 0];
const mOcs = (e) => (e.extrusionDirection && e.extrusionDirection.z < -0.5) ? [-1, 0, 0, 1, 0, 0] : M_ID;   // objets miroir (extrusion 0,0,-1)
function arcPts2(cx, cy, r, a0, a1, rx) {
  while (a1 <= a0) a1 += Math.PI * 2;
  const sw = a1 - a0, n = Math.max(6, Math.min(120, Math.ceil(sw / (Math.PI / 36))));
  return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + sw * i / n; return [cx + (rx || r) * Math.cos(a), cy + r * Math.sin(a)]; });
}
function bulgePts(V, closed) {
  const out = [], n = V.length;
  for (let i = 0; i < n; i++) {
    const a = V[i], b = V[(i + 1) % n], bu = a.bulge || 0;
    out.push([a.x, a.y]);
    if (i === n - 1 && !closed) break;
    if (Math.abs(bu) > 1e-9) {
      const th = 4 * Math.atan(bu), dx = b.x - a.x, dy = b.y - a.y, c = Math.hypot(dx, dy); if (c < 1e-12) continue;
      const r = c / (2 * Math.sin(th / 2)), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, h = r * Math.cos(th / 2);
      const cx = mx - h * dy / c, cy = my + h * dx / c, a0 = Math.atan2(a.y - cy, a.x - cx), R = Math.abs(r);
      const k = Math.max(2, Math.min(n > 400 ? 6 : 48, Math.ceil(Math.abs(th) / (Math.PI / 18))));
      for (let j = 1; j < k; j++) { const t = a0 + th * j / k; out.push([cx + R * Math.cos(t), cy + R * Math.sin(t)]); }
    }
  }
  return out;
}
function splinePts(e) {
  const P = (e.controlPoints || []).map(p => [p.x, p.y]), K = e.knots || [], d = e.degree || 3, W = e.weights && e.weights.length === P.length ? e.weights : null;
  if (P.length > d && K.length === P.length + d + 1) {
    const t0 = K[d], t1 = K[P.length], n = Math.min(400, P.length * 12), out = [];
    for (let s = 0; s <= n; s++) {
      const t = Math.min(t1 - 1e-12, t0 + (t1 - t0) * s / n);
      let k = d; while (k < P.length - 1 && t >= K[k + 1]) k++;
      const D = []; for (let j = 0; j <= d; j++) { const p = P[k - d + j], w = W ? W[k - d + j] : 1; D.push([p[0] * w, p[1] * w, w]); }
      for (let r = 1; r <= d; r++) for (let j = d; j >= r; j--) { const i = k - d + j, al = (t - K[i]) / ((K[i + d - r + 1] - K[i]) || 1); D[j] = D[j].map((v, q) => (1 - al) * D[j - 1][q] + al * v); }
      out.push([D[d][0] / D[d][2], D[d][1] / D[d][2]]);
    }
    return out;
  }
  const F = (e.fitPoints || []).map(p => [p.x, p.y]);
  if (F.length < 3) return F.length ? F : P;
  const out = [];   // Catmull-Rom par les points de passage
  for (let i = 0; i < F.length - 1; i++) {
    const p0 = F[i - 1] || F[i], p1 = F[i], p2 = F[i + 1], p3 = F[i + 2] || F[i + 1];
    for (let s = 0; s < 10; s++) { const t = s / 10, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(q => .5 * (2 * p1[q] + (-p0[q] + p2[q]) * t + (2 * p0[q] - 5 * p1[q] + 4 * p2[q] - p3[q]) * t2 + (-p0[q] + 3 * p1[q] - 3 * p2[q] + p3[q]) * t3))); }
  }
  out.push(F[F.length - 1]); return out;
}
const ellPts = (c, maj, ratio, a0 = 0, a1 = Math.PI * 2) => {
  const R = Math.hypot(maj.x, maj.y), r = R * ratio, rot = Math.atan2(maj.y, maj.x); if (a1 <= a0) a1 += Math.PI * 2; const n = 64;
  return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n, x = R * Math.cos(a), y = r * Math.sin(a); return [c.x + x * Math.cos(rot) - y * Math.sin(rot), c.y + x * Math.sin(rot) + y * Math.cos(rot)]; });
};

// boucles d'une hachure (en OCS)
function hatchLoops(e) {
  const loops = [];
  for (const bp of e.boundaryPaths || []) {
    if (bp.vertices) { const v = bulgePts(bp.vertices, true); if (v.length > 2) loops.push(v); continue; }
    const pts = [];
    for (const g of bp.edges || []) {
      let seg = [];
      if (g.type === 1) seg = [[g.start.x, g.start.y], [g.end.x, g.end.y]];
      else if (g.type === 2) { seg = g.isCCW === false ? arcPts2(g.center.x, g.center.y, g.radius, Math.PI * 2 - g.endAngle, Math.PI * 2 - g.startAngle).reverse() : arcPts2(g.center.x, g.center.y, g.radius, g.startAngle, g.endAngle); }
      else if (g.type === 3) { seg = ellPts(g.center, g.end, g.lengthOfMinorAxis, g.isCCW === false ? -g.endAngle : g.startAngle, g.isCCW === false ? -g.startAngle : g.endAngle); if (g.isCCW === false) seg.reverse(); }
      else if (g.type === 4) seg = splinePts(g);
      pts.push(...seg);
    }
    if (pts.length > 2) loops.push(pts);
  }
  return loops;
}
// lignes de motif d'une hachure, découpées par les contours (pair-impair), avec pointillés
function hatchPattern(e, loops) {
  const segs = [], MAX = 15000;
  const edges = []; for (const L of loops) for (let i = 0; i < L.length; i++) edges.push([L[i], L[(i + 1) % L.length]]);
  for (const dl of e.definitionLines || []) {
    const th = dl.angle || 0, u = [Math.cos(th), Math.sin(th)], n = [-u[1], u[0]], o = dl.offset || { x: 0, y: 0 }, b = dl.base || { x: 0, y: 0 };
    const dn = o.x * n[0] + o.y * n[1], du = o.x * u[0] + o.y * u[1]; if (Math.abs(dn) < 1e-9) continue;
    let lo = Infinity, hi = -Infinity; for (const L of loops) for (const p of L) { const v = p[0] * n[0] + p[1] * n[1]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const b0 = b.x * n[0] + b.y * n[1], k0 = Math.ceil((lo - b0) / dn), k1 = Math.floor((hi - b0) / dn);
    const ka = Math.min(k0, k1), kb = Math.max(k0, k1); if (kb - ka > 2500) return null;   // motif trop dense : contour seulement
    const dash = (dl.dashLengths || []).filter(x => isFinite(x)), plen = dash.reduce((s, x) => s + Math.abs(x), 0);
    for (let k = ka; k <= kb; k++) {
      const P = [b.x + o.x * k, b.y + o.y * k], ts = [];
      for (const [A, B] of edges) {
        const da = (A[0] - P[0]) * n[0] + (A[1] - P[1]) * n[1], db = (B[0] - P[0]) * n[0] + (B[1] - P[1]) * n[1];
        if ((da > 0) === (db > 0) || da === db) continue;
        const t = da / (da - db), X = A[0] + (B[0] - A[0]) * t, Y = A[1] + (B[1] - A[1]) * t; ts.push((X - P[0]) * u[0] + (Y - P[1]) * u[1]);
      }
      ts.sort((a, c) => a - c);
      for (let i = 0; i + 1 < ts.length; i += 2) {
        const ta = ts[i], tb = ts[i + 1], pt = (t) => [P[0] + u[0] * t, P[1] + u[1] * t];
        if (!dash.length || plen < 1e-9) { segs.push([pt(ta), pt(tb)]); }
        else {
          const sh = du * k; let t = Math.floor((ta - sh) / plen) * plen + sh, j = 0, guard = 0;
          while (t < tb && guard++ < 5000) {
            const d = dash[j % dash.length], len = Math.abs(d);
            if (d > 0) { const s0 = Math.max(t, ta), s1 = Math.min(t + len, tb); if (s1 > s0) segs.push([pt(s0), pt(s1)]); }
            else if (d === 0 && t >= ta) segs.push([pt(t), pt(Math.min(tb, t + plen * .02))]);
            t += len; j++;
          }
        }
        if (segs.length > MAX) return null;
      }
    }
  }
  return segs;
}

// ---------- DWG → primitives à plat (comme dxfFlatten, avec épaisseurs, remplissages et alignements) ----------
function dwgFlatten(db) {
  const prims = [], layers = {};
  const LT = {}; for (const l of (db.tables.LAYER || {}).entries || []) LT[l.name] = l;
  const lay = (n) => {
    if (layers[n]) return layers[n];
    const l = LT[n] || {}, ci = l.colorIndex ?? 7, col = ci === 256 ? rgbHex(l.color) : ACI[Math.abs(ci) % 256] || '#ffffff';
    return (layers[n] = { n: 0, color: col, aci: ci === 256 ? null : Math.abs(ci), off: !!(l.off || l.frozen || ci < 0), noplot: l.plotFlag === 0 || /^defpoints$/i.test(n), lw: lwOfDwg(l.lineweight) === 'L' || lwOfDwg(l.lineweight) === 'B' ? null : lwOfDwg(l.lineweight) });
  };
  const blocks = {}, byH = {}; let ms = null, ps = null;
  for (const b of (db.tables.BLOCK_RECORD || {}).entries || []) { blocks[b.name] = b; byH[b.handle] = b; if (/^\*model_space$/i.test(b.name)) ms = b; if (/^\*paper_space$/i.test(b.name)) ps = b; }
  const tB = Object.values(blocks).filter(b => /^\*T\d/i.test(b.name)).map(b => [parseInt(b.handle, 16), b]).sort((a, b) => a[0] - b[0]);
  const tblBlock = (h) => { const v = parseInt(h, 16); const f = tB.find(x => x[0] > v); return f && f[1]; };   // tableau sans lien : bloc *T qui suit
  const style = (e, C) => {
    const L = (e.layer === '0' && C.L) ? C.L : (e.layer || '0'), li = lay(L); li.n++;
    let col, aci; const ci = e.colorIndex;
    if (e.color != null) col = rgbHex(e.color);
    else if (ci == null || ci === 256) { col = li.color; aci = li.aci; }
    else if (ci === 0) { col = C.col || '#ffffff'; aci = C.aci; }
    else { aci = Math.abs(ci) % 256; col = ACI[aci]; }
    let lw = lwOfDwg(e.lineweight); if (lw === 'L') lw = li.lw; else if (lw === 'B') lw = C.lw ?? null;
    return { L, col, aci, lw, off: li.off };
  };
  const pl = (M, pts, closed, s, h, w) => { if (pts.length > 1) prims.push({ t: 'pl', pts: pts.map(p => mAp(M, p[0], p[1])), closed: !!closed, layer: s.L, col: s.col, aci: s.aci, lw: s.lw, h, w: w > 0 ? w * Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])) : undefined }); };
  const tx = (M, x, y, h, str, rotRad, s, ha = 0, va = 0) => {
    str = String(str || '').trim(); if (!str || !(h > 0)) return;
    const p = mAp(M, x, y), det = M[0] * M[3] - M[1] * M[2], ux = Math.cos(rotRad), uy = Math.sin(rotRad), vx = -uy, vy = ux;
    let r = Math.atan2(M[1] * ux + M[3] * uy, M[0] * ux + M[2] * uy); const hk = Math.hypot(M[0] * vx + M[2] * vy, M[1] * vx + M[3] * vy) || 1;
    if (det < 0) { r += Math.PI; ha = 1 - ha; }   // bloc / objet miroir : texte gardé lisible
    prims.push({ t: 'tx', p, h: h * hk, s: str.slice(0, 200), rot: r * 180 / Math.PI, layer: s.L, col: s.col, aci: s.aci, ha, va });
  };
  const textAlign = (t, e) => {   // TEXT / ATTRIB : point d'insertion selon justification
    const hj = t.halign || 0, vj = t.valign || 0, A = e.alignmentPoint || t.endPoint;
    if ((hj === 0 && vj === 0) || hj === 3 || hj === 5 || !A || (A.x === 0 && A.y === 0 && (t.startPoint.x || t.startPoint.y))) return { x: t.startPoint.x, y: t.startPoint.y, ha: 0, va: 0 };
    return { x: A.x, y: A.y, ha: hj === 1 || hj === 4 ? .5 : hj === 2 ? 1 : 0, va: hj === 4 || vj === 2 ? .5 : vj === 3 ? 1 : 0 };
  };
  function walk(ents, M, C, depth) {
    for (const e of ents || []) {
      if (e.isVisible === false) continue;
      const s = style(e, C); if (s.off) continue;
      const O = mMul(M, mOcs(e));
      try {
        switch (e.type) {
          case 'LINE': pl(M, [[e.startPoint.x, e.startPoint.y], [e.endPoint.x, e.endPoint.y]], false, s); break;
          case 'LWPOLYLINE': pl(O, bulgePts(e.vertices || [], e.flag & 512), e.flag & 512, s, 0, e.constantWidth || ((e.vertices || [])[0] || {}).startWidth); break;
          case 'POLYLINE2D': case 'POLYLINE3D': { const V = (e.vertices || []).filter(v => !(v.flag & 16)); const cl = !!(e.flag & 1); pl(e.type === 'POLYLINE2D' ? O : M, e.type === 'POLYLINE2D' ? bulgePts(V, cl) : V.map(v => [v.x, v.y]), cl, s, 0, e.startWidth || (V[0] || {}).startWidth); break; }
          case 'CIRCLE': pl(O, arcPts2(e.center.x, e.center.y, e.radius, 0, Math.PI * 2), true, s); break;
          case 'ARC': pl(O, arcPts2(e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle), false, s); break;
          case 'ELLIPSE': { const full = Math.abs((e.endAngle || 0) - (e.startAngle || 0) - Math.PI * 2) < 1e-3; pl(M, ellPts(e.center, e.majorAxisEndPoint, e.axisRatio, e.startAngle || 0, e.endAngle || Math.PI * 2), full, s); break; }
          case 'SPLINE': pl(M, splinePts(e), !!(e.flag & 1), s); break;
          case 'SOLID': case 'TRACE': { const c = [e.corner1, e.corner2, e.corner4 || e.corner3, e.corner3].filter(Boolean).map(p => [p.x, p.y]); prims.push({ t: 'fl', loops: [c.map(p => mAp(O, p[0], p[1]))], layer: s.L, col: s.col, aci: s.aci }); break; }
          case '3DFACE': pl(M, [e.corner1, e.corner2, e.corner3, e.corner4].filter(Boolean).map(p => [p.x, p.y]), true, s); break;
          case 'TEXT': { const a = textAlign(e, e); tx(O, a.x, a.y, e.textHeight, cadText(e.text), e.rotation || 0, s, a.ha, a.va); break; }
          case 'MTEXT': {
            const h = e.textHeight || 1, ap = (e.attachmentPoint || 1) - 1, col = ap % 3, row = Math.floor(ap / 3);
            const rot = e.direction && (e.direction.x || e.direction.y) ? Math.atan2(e.direction.y, e.direction.x) : (e.rotation || 0);
            let lines = mtextLines(e.text); const W = e.rectWidth || 0;
            if (W > h * 4) lines = lines.flatMap(l => { const out = []; let cur = ''; for (const w of l.split(' ')) { const t = cur ? cur + ' ' + w : w; if (t.length * h * .62 > W && cur) { out.push(cur); cur = w; } else cur = t; } out.push(cur); return out; });
            const ls = h * 1.666 * (e.lineSpacing || 1), H = (lines.length - 1) * ls + h, top = row === 0 ? 0 : row === 1 ? H / 2 : H;
            const cr = Math.cos(rot), sr = Math.sin(rot), ip = e.insertionPoint;
            lines.forEach((l, i) => { const dy = top - h - i * ls; tx(M, ip.x - sr * dy, ip.y + cr * dy, h, l, rot, s, col / 2, 0); });
            break;
          }
          case 'INSERT': case 'DIMENSION': case 'ACAD_TABLE': case 'ARC_DIMENSION': case 'LARGE_RADIAL_DIMENSION': {
            if (depth > 8) break;
            const B = e.type === 'ACAD_TABLE' ? (byH[e.blockRecordHandle] || blocks[e.name] || tblBlock(e.handle)) : blocks[e.name]; if (!B) break;
            const C2 = { L: s.L, col: s.col, aci: s.aci, lw: s.lw };
            if (e.type !== 'INSERT') { walk(B.entities, M, C2, depth + 1); break; }
            const bp = B.basePoint || { x: 0, y: 0 }, ip = e.insertionPoint || { x: 0, y: 0 }, sx = e.xScale || 1, sy = e.yScale || 1, r = e.rotation || 0;
            const nc = Math.max(1, e.columnCount || 1), nr = Math.max(1, e.rowCount || 1);
            for (let ii = 0; ii < nr && ii < 50; ii++) for (let jj = 0; jj < nc && jj < 50; jj++) {
              const ox = jj * (e.columnSpacing || 0), oy = ii * (e.rowSpacing || 0);
              const T = [Math.cos(r) * sx, Math.sin(r) * sx, -Math.sin(r) * sy, Math.cos(r) * sy, ip.x + Math.cos(r) * ox - Math.sin(r) * oy, ip.y + Math.sin(r) * ox + Math.cos(r) * oy];
              walk(B.entities, mMul(O, mMul(T, [1, 0, 0, 1, -bp.x, -bp.y])), C2, depth + 1);
            }
            for (const a of e.attribs || []) {
              if (a.flags & 1 || a.isVisible === false) continue; const as = style(a, C), t = a.text || {}; if (as.off || !t.startPoint) continue;
              const al = textAlign(t, a); tx(mMul(M, mOcs(t)), al.x, al.y, t.textHeight, cadText(t.text), t.rotation || 0, as, al.ha, al.va);
            }
            break;
          }
          case 'HATCH': case 'MPOLYGON': {
            const loops = hatchLoops(e); if (!loops.length) break;
            if (e.solidFill === 1) { prims.push({ t: 'fl', loops: loops.map(L => L.map(p => mAp(O, p[0], p[1]))), layer: s.L, col: s.col, aci: s.aci }); break; }
            const segs = hatchPattern(e, loops);
            if (segs) for (const sg of segs) pl(O, sg, false, s, 1); else loops.forEach(L => pl(O, L, true, s, 1));
            break;
          }
          case 'LEADER': pl(M, (e.vertices || []).map(v => [v.x, v.y]), false, s); break;
          case 'MULTILEADER': {
            for (const sec of e.leaderSections || []) for (const ln of sec.leaderLines || []) { const v = (ln.vertices || []).map(p => [p.x, p.y]); if (sec.lastLeaderLinePoint) v.push([sec.lastLeaderLinePoint.x, sec.lastLeaderLinePoint.y]); pl(M, v, false, s); }
            if (e.textContent && e.textAnchor) { const h = e.textHeight || 2.5; mtextLines(e.textContent).forEach((l, i) => tx(M, e.textAnchor.x, e.textAnchor.y - h - i * h * 1.666, h, l, e.textRotation || 0, s)); }
            break;
          }
          case 'MLINE': {
            const nl = e.numberOfLines || (e.vertices[0] || {}).numberOfLines || 0;
            for (let li = 0; li < nl; li++) pl(M, (e.vertices || []).map(v => { const off = ((v.lines || [])[li] || {}).segmentParams?.[0] || 0; return [v.vertex.x + v.miterDirection.x * off, v.vertex.y + v.miterDirection.y * off]; }), !!(e.flags & 2), s);
            break;
          }
        }
      } catch (err) { /* entité ignorée */ }
    }
  }
  let ents = ms && ms.entities && ms.entities.length ? ms.entities : (db.entities || []).filter(e => !e.isInPaperSpace && e.type !== 'ATTRIB' && (!ms || !e.ownerBlockRecordSoftId || e.ownerBlockRecordSoftId === ms.handle));
  walk(ents, M_ID, {}, 0);
  if (!prims.length && ps) walk((ps.entities || []).filter(e => e.type !== 'VIEWPORT'), M_ID, {}, 0);   // tout est dans la présentation
  if (!prims.length) throw new Error('Aucun dessin lisible dans ce DWG');
  const ins = db.header && (db.header.INSUNITS ?? db.header.$INSUNITS);
  return { prims, layers, box: cadBox(prims), ins, dwg: true, closed: prims.filter(p => p.t === 'pl' && p.closed && p.pts.length > 2) };
}
function cadBox(prims) {
  const xs = [], ys = [];
  for (const p of prims) { const P = p.pts || (p.loops ? p.loops.flat() : [p.p]); for (let i = 0; i < P.length; i += P.length > 40 ? 4 : 1) { xs.push(P[i][0]); ys.push(P[i][1]); } }
  if (!xs.length) return [0, 0, 1, 1];
  xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
  const q = (A, f) => A[Math.min(A.length - 1, Math.max(0, Math.floor(A.length * f)))];
  // emprise complète, sauf objets isolés très loin (au-delà de 50 % autour du cœur du dessin)
  const a0 = q(xs, .01), a1 = q(xs, .99), b0 = q(ys, .01), b1 = q(ys, .99), ex = Math.max(a1 - a0, b1 - b0) * .5;
  const x0 = Math.max(xs[0], a0 - ex), x1 = Math.min(xs[xs.length - 1], a1 + ex), y0 = Math.max(ys[0], b0 - ex), y1 = Math.min(ys[ys.length - 1], b1 + ex), m = Math.max(x1 - x0, y1 - y0) * .015 || 1;
  return [x0 - m, y0 - m, x1 + m, y1 + m];
}
const _cadCache = {};
async function cadFromDwgFile(blobOrFile, key) {
  if (key && _cadCache[key]) return _cadCache[key];
  const D = dwgFlatten(await dwgRead(await blobOrFile.arrayBuffer(), 150000, blobOrFile.name || ''));
  if (key) _cadCache[key] = D;
  return D;
}
async function cadOfPlan(plan) {
  if (plan.dwgFileId) { const f = await DB.get('files', plan.dwgFileId); if (f && f.blob) return cadFromDwgFile(f.blob, plan.dwgFileId); }
  if (plan.dxfFileId) return dxfLoad(plan.dxfFileId);
  return null;
}

// ---------- export DXF (R12, lisible partout) ----------
function cadToDxf(D) {
  const o = [], w = (c, v) => { o.push(c, v); }, f = (x) => String(Math.round(x * 1e6) / 1e6);
  const enc = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
  const lname = (n) => enc(n).replace(/[<>\/\\":;?*|=`]/g, '_') || '0';
  const aciOf = (hex) => { if (!hex) return 7; let b = 7, bd = 1e9; const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, bl = n & 255; for (let i = 1; i < 256; i++) { const m = parseInt(ACI[i].slice(1), 16), d = (r - (m >> 16)) ** 2 + (g - ((m >> 8) & 255)) ** 2 + (bl - (m & 255)) ** 2; if (d < bd) { bd = d; b = i; if (!d) break; } } return b; };
  const aciCache = {}, A = (p) => p.aci || (aciCache[p.col] ??= aciOf(p.col));
  w(0, 'SECTION'); w(2, 'HEADER'); w(9, '$ACADVER'); w(1, 'AC1009'); if (D.ins != null) { w(9, '$INSUNITS'); w(70, D.ins); } w(0, 'ENDSEC');
  const L = Object.keys(D.layers);
  w(0, 'SECTION'); w(2, 'TABLES'); w(0, 'TABLE'); w(2, 'LAYER'); w(70, L.length);
  for (const n of L) { const li = D.layers[n]; w(0, 'LAYER'); w(2, lname(n)); w(70, 0); w(62, li.aci || aciOf(li.color)); w(6, 'CONTINUOUS'); }
  w(0, 'ENDTAB'); w(0, 'ENDSEC'); w(0, 'SECTION'); w(2, 'ENTITIES');
  for (const p of D.prims) {
    const ln = lname(p.layer), c = A(p);
    if (p.t === 'tx') { w(0, 'TEXT'); w(8, ln); w(62, c); w(10, f(p.p[0])); w(20, f(p.p[1])); w(30, 0); w(40, f(p.h)); w(1, enc(p.s)); if (p.rot) w(50, f(p.rot)); continue; }
    for (const P of p.t === 'fl' ? p.loops : [p.pts]) {
      if (P.length === 2 && p.t === 'pl' && !p.closed) { w(0, 'LINE'); w(8, ln); w(62, c); w(10, f(P[0][0])); w(20, f(P[0][1])); w(30, 0); w(11, f(P[1][0])); w(21, f(P[1][1])); w(31, 0); continue; }
      w(0, 'POLYLINE'); w(8, ln); w(62, c); w(66, 1); w(70, p.closed || p.t === 'fl' ? 1 : 0); w(10, 0); w(20, 0); w(30, 0);
      for (const q of P) { w(0, 'VERTEX'); w(8, ln); w(10, f(q[0])); w(20, f(q[1])); w(30, 0); }
      w(0, 'SEQEND'); w(8, ln);
    }
  }
  w(0, 'ENDSEC'); w(0, 'EOF');
  return o.join('\n') + '\n';
}

// ---------- rendu commun (canevas / PDF) ----------
const PAPER = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841] };
const UNIT_MM = { mm: 1, cm: 10, m: 1000 };
const insUnit = (ins) => ({ 4: 'mm', 5: 'cm', 6: 'm' })[ins] || null;
const CTB_DEF = { '#ff0000': .18, '#ffff00': .25, '#00ff00': .35, '#00ffff': .25, '#0000ff': .5, '#ff00ff': .35, '#ffffff': .25, '#000000': .25, '#808080': .13, '#c0c0c0': .13 };
function plotColor(hex, mode) {
  hex = (hex || '#ffffff').toLowerCase();
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, Y = r * .3 + g * .59 + b * .11;
  if (mode === 'mono') return '#000000';
  if (mode === 'gray') { if (Y > 235) return '#000000'; const v = Math.round(Math.min(150, Y * .6)).toString(16).padStart(2, '0'); return '#' + v + v + v; }
  if (mode === 'screen') return Y > 170 ? '#334155' : hex;
  return Y > 235 ? '#000000' : hex;
}
function plotLw(p, D, o) {
  if (o.lwMode === 'uni') return +o.lwUni || .18;
  if (o.lwMode === 'col') return (o.ctb || {})[(p.col || (D.layers[p.layer] || {}).color || '#ffffff').toLowerCase()] ?? CTB_DEF[(p.col || '').toLowerCase()] ?? .18;
  const v = p.lw ?? (D.layers[p.layer] || {}).lw; return v == null ? (+o.lwDef || .25) : Math.max(.05, v);
}
// T = { x0, y1, k (mm papier / unité), ox, oy, clip:[cx0,cy0,cx1,cy1] }
function cadPaint(dev, D, o, T) {
  const hid = new Set(o.hidden || []), X = (q) => [T.ox + (q[0] - T.x0) * T.k, T.oy + (T.y1 - q[1]) * T.k];
  const [cx0, cy0, cx1, cy1] = T.clip;
  const inside = (P) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const q of P) { if (q[0] < a) a = q[0]; if (q[0] > c) c = q[0]; if (q[1] < b) b = q[1]; if (q[1] > d) d = q[1]; } return !(c < cx0 || a > cx1 || d < cy0 || b > cy1); };
  for (const p of D.prims) {
    const li = D.layers[p.layer] || {};
    if (hid.has(p.layer) || (li.noplot && !o.plotAll)) continue;
    const col = plotColor(p.col || li.color, o.color);
    if (p.t === 'tx') {
      const hm = p.h * T.k; if (hm < .35 || p.p[0] < cx0 - p.h * 80 || p.p[0] > cx1 + p.h * 80 || p.p[1] < cy0 - p.h * 40 || p.p[1] > cy1 + p.h * 40) continue;
      const [x, y] = X(p.p), a = -p.rot * Math.PI / 180, wdt = dev.width(p.s, hm), dx = -(p.ha || 0) * wdt, dy = (p.va || 0) * hm;
      dev.text(p.s, x + dx * Math.cos(a) - dy * Math.sin(a), y + dx * Math.sin(a) + dy * Math.cos(a), hm, p.rot, col);
    } else if (p.t === 'fl') { if (p.loops.some(inside)) dev.fill(col, p.loops.map(L => L.map(X))); }
    else if (inside(p.pts)) { let lw = p.h ? Math.min(plotLw(p, D, o), .13) : plotLw(p, D, o); if (p.w) lw = Math.max(lw, p.w * T.k); dev.stroke(col, lw, p.pts.map(X), p.closed); }
  }
}
function canvasDev(g, sc) {   // sc = px par mm
  return {
    stroke(c, lw, P, cl) { g.strokeStyle = c; g.lineWidth = Math.max(sc < 3 ? .5 : .8, lw * sc); g.beginPath(); P.forEach((q, i) => i ? g.lineTo(q[0] * sc, q[1] * sc) : g.moveTo(q[0] * sc, q[1] * sc)); if (cl) g.closePath(); g.stroke(); },
    fill(c, Ls) { g.fillStyle = c; g.beginPath(); for (const P of Ls) { P.forEach((q, i) => i ? g.lineTo(q[0] * sc, q[1] * sc) : g.moveTo(q[0] * sc, q[1] * sc)); g.closePath(); } g.fill('evenodd'); },
    width(s, hm) { g.font = `${hm / .718 * sc}px Helvetica, Arial, sans-serif`; return g.measureText(s).width / sc; },
    text(s, x, y, hm, rot, c) { if (hm * sc < 2.5) return; g.save(); g.translate(x * sc, y * sc); g.rotate(-rot * Math.PI / 180); g.fillStyle = c; g.font = `${hm / .718 * sc}px Helvetica, Arial, sans-serif`; g.fillText(s, 0, 0); g.restore(); },
  };
}
function pdfDev(doc) {
  let sc = null, sl = null, sf = null, st = null;
  const lat = (s) => s.replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
  return {
    stroke(c, lw, P, cl) { if (c !== sc) { doc.setDrawColor(c); sc = c; } if (lw !== sl) { doc.setLineWidth(lw); sl = lw; } doc.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) doc.lineTo(P[i][0], P[i][1]); if (cl) doc.close(); doc.stroke(); },
    fill(c, Ls) { if (c !== sf) { doc.setFillColor(c); sf = c; } for (const P of Ls) { doc.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) doc.lineTo(P[i][0], P[i][1]); doc.close(); } doc.fillEvenOdd(); },
    width(s, hm) { doc.setFontSize(hm / .718 / .3528); return doc.getTextWidth(lat(s)); },
    text(s, x, y, hm, rot, c) { if (c !== st) { doc.setTextColor(c); st = c; } doc.setFontSize(hm / .718 / .3528); doc.text(lat(s), x, y, rot ? { angle: rot } : undefined); },
  };
}
// image raster (aperçu du plan dans l'appli)
function cadRaster(D, maxPx = 5000, o = {}) {
  const [x0, y0, x1, y1] = D.box, W = x1 - x0, H = y1 - y0, s = maxPx / Math.max(W, H);
  const c = document.createElement('canvas'); c.width = Math.max(10, Math.round(W * s)); c.height = Math.max(10, Math.round(H * s));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.lineJoin = g.lineCap = 'round';
  const k = 841 / Math.max(W, H), sc = s / k;   // comme un A1
  cadPaint(canvasDev(g, sc), D, { color: 'screen', lwMode: 'col', plotAll: true, ...o }, { x0, y1, k, ox: 0, oy: 0, clip: D.box });
  return { canvas: c, s, toWorld: (px, py) => [x0 + px / s, y1 - py / s], toPx: (p) => [(p[0] - x0) * s, (y1 - p[1]) * s] };
}

// cadres de feuilles (cartouches) détectés : grands rectangles non inclus dans un autre
function cadFrames(D) {
  const [bx0, by0, bx1, by1] = D.box, minA = (bx1 - bx0) * (by1 - by0) * .012, R = [];
  for (const p of D.prims) {
    if (p.t !== 'pl' || p.h) continue;
    let P = p.pts; if (P.length === 5 && Math.hypot(P[0][0] - P[4][0], P[0][1] - P[4][1]) < 1e-6) P = P.slice(0, 4); else if (!(p.closed && P.length === 4)) continue;
    const xs = P.map(q => q[0]), ys = P.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), w = x1 - x0, h = y1 - y0, tol = Math.max(w, h) * .002;
    if (w * h < minA || !P.every(q => (Math.abs(q[0] - x0) < tol || Math.abs(q[0] - x1) < tol) && (Math.abs(q[1] - y0) < tol || Math.abs(q[1] - y1) < tol))) continue;
    const ra = Math.max(w, h) / Math.min(w, h); if (ra > 4.5) continue;
    R.push([x0, y0, x1, y1]);
  }
  const ins = (a, b) => a[0] >= b[0] - 1e-6 && a[1] >= b[1] - 1e-6 && a[2] <= b[2] + 1e-6 && a[3] <= b[3] + 1e-6;
  const out = R.filter((r, i) => !R.some((o2, j) => j !== i && ins(r, o2) && !(ins(o2, r) && j > i)));
  const ar = (r) => (r[2] - r[0]) * (r[3] - r[1]);
  if (out.length === 1 && ar(out[0]) > (bx1 - bx0) * (by1 - by0) * .6) return [];   // un seul cadre = tout le dessin
  return out.sort((a, b) => (Math.abs(b[3] - a[3]) > (b[3] - b[1]) * .5 ? b[3] - a[3] : a[0] - b[0]));
}

// ---------- tracé PDF vectoriel ----------
function cadPlotPdf(D, o) {
  const { jsPDF } = window.jspdf; let doc = null, pages = 0;
  const areas = o.area === 'frames' && o.frames && o.frames.length ? o.frames.map(f => { const m = Math.max(f[2] - f[0], f[3] - f[1]) * .005; return [f[0] - m, f[1] - m, f[2] + m, f[3] + m]; }) : [D.box];
  for (const A of areas) {
    const [x0, y0, x1, y1] = A, dw = x1 - x0, dh = y1 - y0;
    let [PW, PH] = PAPER[o.fmt] || PAPER.A3; const land = o.orient === 'l' || (o.orient !== 'p' && dw >= dh); if (!land) [PW, PH] = [PH, PW];
    const M = o.margin ?? 8, aw = PW - 2 * M, ah = PH - 2 * M;
    const k = o.scale === 'fit' ? Math.min(aw / dw, ah / dh) : (UNIT_MM[o.unit] || 1) / +o.scale;
    const nx = Math.max(1, Math.ceil(dw * k / aw - 1e-6)), ny = Math.max(1, Math.ceil(dh * k / ah - 1e-6));
    for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) {
      if (!doc) doc = new jsPDF({ unit: 'mm', format: [PW, PH], orientation: land ? 'l' : 'p', compress: true }); else doc.addPage([PW, PH], land ? 'l' : 'p');
      pages++;
      const cx0 = x0 + tx * aw / k, cy1 = y1 - ty * ah / k, cx1 = Math.min(x1, cx0 + aw / k), cy0 = Math.max(y0, cy1 - ah / k);
      const ox = M + (nx === 1 ? (aw - dw * k) / 2 : 0), oy = M + (ny === 1 ? (ah - dh * k) / 2 : 0);
      doc.setLineCap('round'); doc.setLineJoin('round');
      doc.saveGraphicsState(); doc.rect(M, M, aw, ah, null); doc.clip(); doc.discardPath();
      cadPaint(pdfDev(doc), D, o, { x0: cx0, y1: cy1, k, ox: nx === 1 ? ox : M, oy: ny === 1 ? oy : M, clip: [cx0, cy0, cx1, cy1] });
      doc.restoreGraphicsState();
      if (nx * ny > 1) { doc.setFontSize(7); doc.setTextColor('#64748b'); doc.text(`${o.title || ''} · feuille ${ty * nx + tx + 1}/${nx * ny}${o.scale !== 'fit' ? ' · 1/' + o.scale : ''}`, M, PH - 3); }
    }
  }
  return { doc, pages };
}

// ---------- fenêtre « Tracer » (style AutoCAD) ----------
function plotCfg() { try { return JSON.parse(localStorage.getItem('plot.cfg') || '{}'); } catch (e) { return {}; } }
function plotDialog(D, title) {
  return new Promise((resolve) => {
    const c = { fmt: 'A3', orient: 'auto', scale: 'fit', color: 'mono', lwMode: D.prims.some(p => p.lw != null) ? 'obj' : 'col', lwUni: .18, lwDef: .25, area: 'all', ...plotCfg() };
    c.unit = c.unit && D.ins == null ? c.unit : insUnit(D.ins) || c.unit || 'mm';
    const p = App.project || {}, ctb = { ...CTB_DEF, ...(p.plotCtb || {}) };
    const frames = cadFrames(D), cols = {}, lays = Object.keys(D.layers).filter(n => D.layers[n].n).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    for (const q of D.prims) { const h = (q.col || (D.layers[q.layer] || {}).color || '#ffffff').toLowerCase(); cols[h] = (cols[h] || 0) + 1; }
    const colList = Object.keys(cols).sort((a, b) => cols[b] - cols[a]).slice(0, 24);
    const hidden = new Set(D._hidden || []); let res = null;
    const opt = (n, v, l) => `<option value="${v}" ${String(c[n]) === String(v) ? 'selected' : ''}>${l}</option>`;
    const s = sheet(`<div class="form plot">
      <div class="plot-prev"><canvas></canvas><small></small></div>
      <div class="plot-g">
        <label>Format<select name="fmt">${Object.keys(PAPER).map(f => opt('fmt', f, f)).join('')}</select></label>
        <label>Orientation<select name="orient">${opt('orient', 'auto', 'Auto')}${opt('orient', 'l', 'Paysage')}${opt('orient', 'p', 'Portrait')}</select></label>
        <label>Échelle<select name="scale">${opt('scale', 'fit', 'Ajuster à la feuille')}${[20, 25, 50, 75, 100, 125, 200, 250, 500, 1000].map(v => opt('scale', v, '1/' + v)).join('')}</select></label>
        <label class="pl-unit">Unité du dessin<select name="unit">${opt('unit', 'mm', 'mm')}${opt('unit', 'cm', 'cm')}${opt('unit', 'm', 'm')}</select></label>
        <label>Zone<select name="area">${opt('area', 'all', 'Tout le dessin')}${frames.length ? opt('area', 'frames', `1 page par cadre (${frames.length} cadres)`) : ''}</select></label>
        <label>Couleurs<select name="color">${opt('color', 'mono', 'Noir (monochrome)')}${opt('color', 'color', 'Couleurs')}${opt('color', 'gray', 'Niveaux de gris')}</select></label>
        <label>Épaisseurs<select name="lwMode">${opt('lwMode', 'obj', 'Du dessin (lineweight)')}${opt('lwMode', 'col', 'Par couleur (table CTB)')}${opt('lwMode', 'uni', 'Uniforme')}</select></label>
        <label class="pl-uni">Épaisseur (mm)<input name="lwUni" type="number" step="0.01" min="0.05" value="${c.lwUni}"></label>
        <label class="pl-def">Épaisseur « Défaut » (mm)<input name="lwDef" type="number" step="0.01" min="0.05" value="${c.lwDef}"></label>
      </div>
      <div class="pl-ctb"><b>Table des épaisseurs par couleur (mm)</b>${colList.map(h => `<label class="ctb-r"><span class="sw" style="background:${h}"></span><span>${h.toUpperCase()}${ACI.indexOf(h) > 0 ? ` · ${ACI.indexOf(h)}` : ''}</span><input type="number" step="0.01" min="0.05" data-ctb="${h}" value="${ctb[h] ?? .18}"></label>`).join('')}</div>
      <details class="pl-lay"><summary>Calques (${lays.length}) — décocher pour ne pas tracer</summary>${lays.map(n => `<label class="ly"><input type="checkbox" data-ly="${esc(n)}" ${hidden.has(n) || D.layers[n].noplot ? '' : 'checked'}><span class="sw" style="background:${D.layers[n].color}"></span>${esc(n)}${D.layers[n].noplot ? ' <small>(non imprimable)</small>' : ''}</label>`).join('')}</details>
      <div class="btnrow"><button class="btn ghost" data-a="x">Annuler</button><button class="btn" data-a="ok">🖨 Créer le PDF</button></div></div>`, {
      title: `Tracer en PDF · ${title}`,
      onMount: (el) => {
        const read = () => { $$('[name]', el).forEach(i => c[i.name] = i.value); $$('[data-ctb]', el).forEach(i => ctb[i.dataset.ctb] = +i.value || .18); c.ctb = ctb; c.hidden = $$('[data-ly]', el).filter(i => !i.checked).map(i => i.dataset.ly); c.plotAll = true; c.frames = frames; };
        const vis = () => { $('.pl-unit', el).style.display = c.scale === 'fit' ? 'none' : ''; $('.pl-uni', el).style.display = c.lwMode === 'uni' ? '' : 'none'; $('.pl-def', el).style.display = c.lwMode === 'obj' ? '' : 'none'; $('.pl-ctb', el).style.display = c.lwMode === 'col' ? '' : 'none'; };
        let tm; const prev = () => { clearTimeout(tm); tm = setTimeout(() => {
          const cv = $('.plot-prev canvas', el), A = c.area === 'frames' && frames.length ? frames[0] : D.box, dw = A[2] - A[0], dh = A[3] - A[1];
          let [PW, PH] = PAPER[c.fmt]; if (!(c.orient === 'l' || (c.orient !== 'p' && dw >= dh))) [PW, PH] = [PH, PW];
          const sc = Math.min(560 / PW, 330 / PH); cv.width = PW * sc; cv.height = PH * sc; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.lineCap = g.lineJoin = 'round';
          const M = 8, aw = PW - 16, ah = PH - 16, k = c.scale === 'fit' ? Math.min(aw / dw, ah / dh) : (UNIT_MM[c.unit] || 1) / +c.scale;
          g.save(); g.beginPath(); g.rect(M * sc, M * sc, aw * sc, ah * sc); g.clip();
          const big = c.scale !== 'fit' && (dw * k > aw + 1e-6 || dh * k > ah + 1e-6);
          cadPaint(canvasDev(g, sc), D, { ...c, hidden: c.hidden }, { x0: A[0], y1: A[3], k, ox: big ? M : M + (aw - dw * k) / 2, oy: big ? M : M + (ah - dh * k) / 2, clip: big ? [A[0], A[3] - ah / k, A[0] + aw / k, A[3]] : A });
          g.restore(); g.strokeStyle = '#cbd5e1'; g.strokeRect(.5, .5, cv.width - 1, cv.height - 1);
          const nx = Math.max(1, Math.ceil(dw * k / aw - 1e-6)), ny = Math.max(1, Math.ceil(dh * k / ah - 1e-6));
          $('.plot-prev small', el).textContent = `${c.fmt} ${PW > PH ? 'paysage' : 'portrait'}` + (c.scale === 'fit' ? ` · échelle ≈ 1/${Math.round((UNIT_MM[c.unit] || 1) / k)} (${c.unit})` : ` · 1/${c.scale}`) + (nx * ny > 1 ? ` · ${nx * ny} feuilles` : '') + (c.area === 'frames' ? ` · ${frames.length} pages` : '');
        }, 120); };
        el.addEventListener('input', () => { read(); vis(); prev(); }); el.addEventListener('change', () => { read(); vis(); prev(); });
        read(); vis(); prev();
        $('[data-a=x]', el).onclick = () => s.close();
        $('[data-a=ok]', el).onclick = async () => { read(); res = { ...c }; try { const { ctb: _, frames: __, hidden: ___, ...keep } = c; localStorage.setItem('plot.cfg', JSON.stringify(keep)); } catch (e) {} D._hidden = c.hidden; if (App.project) { App.project.plotCtb = ctb; DB.put('projects', App.project); } s.close(); };
      },
    });
    s.onClose = () => resolve(res);
  });
}

// ---------- après création d'un PDF : partager / ajouter aux plans ----------
async function pickPlanFolder(title = 'Ajouter dans quel dossier (niveau) ?') {
  const pid = App.project.id, all = await DB.byProject('folders', pid), fs = all.map(f => ({ id: f.id, name: folderPath(f, all) })).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
  const v = await menu(title, [...fs.map(f => ({ label: f.name, icon: 'folder', value: f.id })), { label: 'Nouveau dossier…', icon: 'plus', value: '__new' }, { label: 'Sans dossier', icon: 'plans', value: '__none' }]);
  if (!v) return undefined;
  if (v === '__none') return null;
  if (v === '__new') { const r = await formSheet('Nouveau dossier', [{ name: 'n', label: 'Nom du dossier / niveau', placeholder: 'Ex : Plancher R+2' }], { okLabel: 'Créer' }); if (!r || !r.n) return undefined; return (await DB.put('folders', { projectId: pid, name: r.n })).id; }
  return v;
}
async function addPdfAsPlans(blob, name, folderId, extra = {}) {
  const pid = App.project.id, ld = loading('Ajout aux plans…'), out = [];
  try {
    const file = new File([blob], name.replace(/\.pdf$/i, '') + '.pdf', { type: 'application/pdf' });
    for (const im of await fileToPlanImages(file, pid, ld)) out.push(await DB.put('plans', { projectId: pid, folderId, fileId: im.fileId, pdfFileId: im.pdfFileId || null, pdfPage: im.pdfPage || null, w: im.w, h: im.h, name: im.name, annotations: [], indice: 'A', ...extra }));
  } finally { ld.close(); }
  if (folderId) { App.openFolders = App.openFolders || {}; App.openFolders[folderId] = true; const fo = await DB.get('folders', folderId); if (fo && fo.parentId) App.openFolders[fo.parentId] = true; }
  toast(`${out.length} plan${out.length > 1 ? 's' : ''} ajouté${out.length > 1 ? 's' : ''} ✓`);
  return out;
}
async function pdfResultMenu(blob, name, info, onAdded) {
  for (;;) {
    const v = await menu(`PDF prêt · ${name}${info ? ' · ' + info : ''}`, [
      { label: 'Partager (WhatsApp, Gmail, Drive…)', icon: 'share', value: 'share' },
      { label: 'Ajouter aux plans du projet (choisir le niveau)', icon: 'folder', value: 'add' },
      { label: 'Terminé', icon: 'check', value: 'done' },
    ]);
    if (v === 'share') { await shareBlob(blob, safeName(name) + '.pdf'); continue; }
    if (v === 'add') { const fid = await pickPlanFolder(); if (fid === undefined) continue; const r = await addPdfAsPlans(blob, name, fid); if (onAdded) onAdded(r); continue; }
    return;
  }
}

// ---------- actions ----------
async function plotCad(D, name, onAdded) {
  const o = await plotDialog(D, name); if (!o) return;
  const ld = loading('Tracé du PDF vectoriel…');
  await new Promise(r => setTimeout(r, 50));
  let out;
  try { o.title = name; out = cadPlotPdf(D, o); } catch (e) { ld.close(); console.error(e); return alertBox('Erreur de tracé : ' + e.message); }
  const blob = out.doc.output('blob'); ld.close();
  await pdfResultMenu(blob, name, `${out.pages} page${out.pages > 1 ? 's' : ''} ${o.fmt}`, onAdded);
}
async function plotPlan(plan, onAdded) {
  const ld = loading('Lecture du plan AutoCAD…');
  let D; try { D = await cadOfPlan(plan); } catch (e) { ld.close(); return alertBox('Lecture impossible : ' + e.message); }
  ld.close(); if (!D) return alertBox('Ce plan n\'a pas de source AutoCAD (DWG / DXF).');
  return plotCad(D, plan.name + (plan.indice && plan.indice !== 'A' ? ` (ind ${plan.indice})` : ''), onAdded);
}
async function exportDxfOfPlan(plan) {
  const ld = loading('Création du DXF…');
  try {
    if (!plan.dwgFileId && plan.dxfFileId) { const f = await DB.get('files', plan.dxfFileId); ld.close(); return shareBlob(f.blob, safeName(plan.name) + '.dxf'); }
    const D = await cadOfPlan(plan); ld.close();
    await shareBlob(new Blob([cadToDxf(D)], { type: 'application/dxf' }), safeName(plan.name) + '.dxf');
  } catch (e) { ld.close(); alertBox('Erreur : ' + e.message); }
}
async function cadReadPicked(file, ld) {
  if (/\.dwg$/i.test(file.name)) { ld && ld.set('Lecture du DWG…'); return cadFromDwgFile(file); }
  await needDXF(); return dxfFlatten(new DxfParser().parseSync(await file.text()));
}

// ---------- PDF : fusionner / diviser (pdf-lib) ----------
async function needPdfLib() { if (!window.PDFLib) await loadScript('lib/pdf-lib.min.js'); if (!window.PDFLib) throw new Error('Module PDF non disponible'); return window.PDFLib; }
async function planPdfBytes(plan) {
  if (plan.pdfFileId) { const f = await DB.get('files', plan.pdfFileId); if (f && f.blob) return { bytes: await f.blob.arrayBuffer(), page: (plan.pdfPage || 1) - 1 }; }
  if (plan.dwgFileId || plan.dxfFileId) { const D = await cadOfPlan(plan); const o = { fmt: 'A3', orient: 'auto', scale: 'fit', color: 'mono', lwMode: D.prims.some(p => p.lw != null) ? 'obj' : 'col', lwUni: .18, lwDef: .25, ...plotCfg(), area: 'all', ctb: { ...CTB_DEF, ...(App.project.plotCtb || {}) }, hidden: D._hidden || [] }; return { bytes: cadPlotPdf(D, o).doc.output('arraybuffer'), page: 0 }; }
  const f = await DB.get('files', plan.fileId); if (!f || !f.blob) throw new Error('Image du plan introuvable : ' + plan.name);
  const im = await loadImage(URL.createObjectURL(f.blob)); const { jsPDF } = window.jspdf;
  const land = im.width >= im.height, [PW, PH] = land ? [420, 297] : [297, 420], doc = new jsPDF({ unit: 'mm', format: [PW, PH], orientation: land ? 'l' : 'p' });
  const k = Math.min((PW - 10) / im.width, (PH - 10) / im.height); doc.addImage(im, 'JPEG', (PW - im.width * k) / 2, (PH - im.height * k) / 2, im.width * k, im.height * k);
  return { bytes: doc.output('arraybuffer'), page: 0 };
}
async function mergePdfFlow(onAdded) {
  const pid = App.project.id;
  const [plans, folders] = await Promise.all([DB.byProject('plans', pid), DB.byProject('folders', pid)]);
  const cur = plans.filter(isCurrentPlan).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })), fn = (id) => folderPath(folders.find(f => f.id === id), folders) || 'Sans dossier';
  const groups = {}; cur.forEach(p => (groups[fn(p.folderId)] = groups[fn(p.folderId)] || []).push(p));
  const order = [], phone = [];
  const items = await new Promise((resolve) => {
    let ok = false;
    const s = sheet(`<div class="mg-l">${Object.keys(groups).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })).map(g => `<div class="mg-g">📁 ${esc(g)}</div>` + groups[g].map(p => `<button class="mg-it" data-id="${p.id}"><i></i><span class="grow">${esc(p.name)}</span><small>${p.dwgFileId ? 'DWG' : p.dxfFileId ? 'DXF' : p.pdfFileId ? 'PDF' : 'Image'}</small></button>`).join('')).join('') || '<div class="empty">Aucun plan</div>'}</div>
      <button class="btn ghost" data-a="ph" style="width:100%;margin-top:8px">📱 Ajouter des PDF du téléphone</button><div class="mg-ph"></div>
      <div class="btnrow"><button class="btn ghost" data-a="x">Annuler</button><button class="btn" data-a="ok">Fusionner</button></div>`, {
      title: 'Fusionner en un seul PDF — touchez dans l\'ordre voulu',
      onMount: (el) => {
        const upd = () => { $$('.mg-it', el).forEach(b => { const i = order.indexOf(b.dataset.id); b.classList.toggle('on', i >= 0); $('i', b).textContent = i >= 0 ? i + 1 : ''; }); $('.mg-ph', el).innerHTML = phone.map((f, i) => `<div class="mg-it on"><i>${order.length + i + 1}</i><span class="grow">${esc(f.name)}</span></div>`).join(''); $('[data-a=ok]', el).textContent = `Fusionner (${order.length + phone.length})`; };
        $$('.mg-it', el).forEach(b => b.onclick = () => { const i = order.indexOf(b.dataset.id); if (i >= 0) order.splice(i, 1); else order.push(b.dataset.id); upd(); });
        $('[data-a=ph]', el).onclick = async () => { phone.push(...(await pickFiles({ accept: 'application/pdf', multiple: true }))); upd(); };
        $('[data-a=x]', el).onclick = () => s.close();
        $('[data-a=ok]', el).onclick = () => { if (order.length + phone.length < 1) return toast('Choisissez au moins un plan'); ok = true; s.close(); };
        upd();
      },
    });
    s.onClose = () => resolve(ok ? [...order.map(id => ({ plan: cur.find(p => p.id === id) })), ...phone.map(f => ({ file: f }))] : null);
  });
  if (!items) return;
  const ld = loading('Fusion des PDF…');
  try {
    const { PDFDocument } = await needPdfLib(), out = await PDFDocument.create(), cache = {};
    for (let i = 0; i < items.length; i++) {
      ld.set(`Fusion… ${i + 1}/${items.length}`);
      const it = items[i];
      if (it.file) { const src = await PDFDocument.load(await it.file.arrayBuffer(), { ignoreEncryption: true }); (await out.copyPages(src, src.getPageIndices())).forEach(pg => out.addPage(pg)); continue; }
      const { bytes, page } = await planPdfBytes(it.plan), key = it.plan.pdfFileId || it.plan.id;
      const src = cache[key] || (cache[key] = await PDFDocument.load(bytes, { ignoreEncryption: true }));
      const [pg] = await out.copyPages(src, [Math.min(page, src.getPageCount() - 1)]); out.addPage(pg);
    }
    const blob = new Blob([await out.save()], { type: 'application/pdf' }); ld.close();
    const r = await formSheet('Nom du PDF fusionné', [{ name: 'n', label: 'Nom', value: items.length && items[0].plan ? items[0].plan.name + ' + ' + (items.length - 1) : 'Plans fusionnés' }], { okLabel: 'OK' });
    await pdfResultMenu(blob, (r && r.n) || 'Plans fusionnés', `${out.getPageCount()} pages`, onAdded);
  } catch (e) { ld.close(); console.error(e); alertBox('Erreur de fusion : ' + e.message); }
}
const parseRanges = (s, n) => String(s || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean).map(x => { const m = x.match(/^(\d+)\s*(?:-\s*(\d+))?$/); if (!m) return null; const a = Math.max(1, +m[1]), b = Math.min(n, m[2] ? +m[2] : a); return a <= b ? [a, b] : null; }).filter(Boolean);
async function splitPdfFlow(onAdded, srcPlan) {
  let bytes, name;
  if (srcPlan) { const f = await DB.get('files', srcPlan.pdfFileId); if (!f || !f.blob) return alertBox('PDF source introuvable'); bytes = await f.blob.arrayBuffer(); name = srcPlan.name.replace(/ - p\d+$/, ''); }
  else {
    const pid = App.project.id, plans = (await DB.byProject('plans', pid)).filter(p => p.pdfFileId), seen = new Set(), srcs = plans.filter(p => !seen.has(p.pdfFileId) && seen.add(p.pdfFileId));
    const v = await menu('Diviser quel PDF ?', [{ label: 'Un PDF du téléphone…', icon: 'upload', value: '__ph' }, ...srcs.slice(0, 40).map(p => ({ label: p.name.replace(/ - p\d+$/, ''), icon: 'plans', value: p.id }))]);
    if (!v) return;
    if (v === '__ph') { const [f] = await pickFiles({ accept: 'application/pdf', multiple: false }); if (!f) return; bytes = await f.arrayBuffer(); name = f.name.replace(/\.pdf$/i, ''); }
    else return splitPdfFlow(onAdded, srcs.find(p => p.id === v));
  }
  const { PDFDocument } = await needPdfLib(); const src = await PDFDocument.load(bytes, { ignoreEncryption: true }), n = src.getPageCount();
  if (n < 2) return alertBox('Ce PDF n\'a qu\'une page.');
  const r = await formSheet(`Diviser « ${name} » (${n} pages)`, [
    { name: 'mode', label: 'Découpage', type: 'select', value: 'each', options: [{ value: 'each', label: '1 fichier par page' }, { value: 'ranges', label: 'Par plages de pages' }] },
    { name: 'rg', label: 'Plages (si « par plages ») — ex : 1-3, 4, 5-8', placeholder: `1-${Math.ceil(n / 2)}, ${Math.ceil(n / 2) + 1}-${n}` },
  ], { okLabel: 'Diviser' });
  if (!r) return;
  const R = r.mode === 'ranges' ? parseRanges(r.rg, n) : Array.from({ length: n }, (_, i) => [i + 1, i + 1]);
  if (!R.length) return alertBox('Plages invalides (ex : 1-3, 4, 5-8)');
  const ld = loading('Division…'), parts = [];
  try {
    for (const [a, b] of R) { const d = await PDFDocument.create(); (await d.copyPages(src, Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i))).forEach(pg => d.addPage(pg)); const label = `${name} - p${a}${b > a ? '-' + b : ''}`; parts.push({ b: new Blob([await d.save()], { type: 'application/pdf' }), n: safeName(label) + '.pdf', label }); }
  } catch (e) { ld.close(); return alertBox('Erreur : ' + e.message); }
  ld.close();
  for (;;) {
    const v = await menu(`${parts.length} PDF créés`, [{ label: 'Partager tous les fichiers', icon: 'share', value: 'share' }, { label: 'Ajouter aux plans (choisir le niveau)', icon: 'folder', value: 'add' }, { label: 'Terminé', icon: 'check', value: 'done' }]);
    if (v === 'share') { await shareBlobs(parts); continue; }
    if (v === 'add') { const fid = await pickPlanFolder(); if (fid === undefined) continue; const all = []; for (const p of parts) all.push(...await addPdfAsPlans(p.b, p.label, fid)); if (onAdded) onAdded(all); continue; }
    return;
  }
}

// ---------- v1.0.53 : changer le format d'un PDF (A0 → A3, A1 → A4…) en gardant le vectoriel ----------
function convCfg() { try { return JSON.parse(localStorage.getItem('conv.cfg') || '{}'); } catch (e) { return {}; } }
async function pdfToFormat(bytes, o) {
  const { PDFDocument } = await needPdfLib(), src = await PDFDocument.load(bytes, { ignoreEncryption: true }), out = await PDFDocument.create(), MM = 72 / 25.4;
  const idx = o.pages && o.pages.length ? o.pages : src.getPageIndices();
  const emb = await out.embedPages(idx.map(i => src.getPage(i)));
  for (const e of emb) {
    let [PW, PH] = PAPER[o.fmt] || PAPER.A3; const land = o.orient === 'l' || (o.orient !== 'p' && e.width >= e.height); if (!land) [PW, PH] = [PH, PW];
    const W = PW * MM, H = PH * MM, M = (+o.margin || 0) * MM, k = Math.min((W - 2 * M) / e.width, (H - 2 * M) / e.height);
    const pg = out.addPage([W, H]); pg.drawPage(e, { x: (W - e.width * k) / 2, y: (H - e.height * k) / 2, width: e.width * k, height: e.height * k });
  }
  return new Blob([await out.save()], { type: 'application/pdf' });
}
async function convertPdfFlow(onAdded) {
  let bytes, name, pages = null;
  const pid = App.project.id, plans = (await DB.byProject('plans', pid)).filter(p => p.pdfFileId && isCurrentPlan(p)).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
  const v = await menu('Changer le format de quel PDF ?', [{ label: 'Un PDF du téléphone…', icon: 'upload', value: '__ph' }, ...plans.slice(0, 60).map(p => ({ label: p.name, icon: 'plans', value: p.id }))]);
  if (!v) return;
  if (v === '__ph') { const [f] = await pickFiles({ accept: 'application/pdf', multiple: false }); if (!f) return; bytes = await f.arrayBuffer(); name = f.name.replace(/\.pdf$/i, ''); }
  else { const pl = plans.find(p => p.id === v), f = await DB.get('files', pl.pdfFileId); if (!f || !f.blob) return alertBox('PDF source introuvable'); bytes = await f.blob.arrayBuffer(); name = pl.name; pages = [(pl.pdfPage || 1) - 1]; }
  const c = { fmt: 'A3', orient: 'auto', margin: 5, ...convCfg() };
  const r = await formSheet(`Format de « ${name} »`, [
    { name: 'fmt', label: 'Nouveau format', type: 'select', value: c.fmt, options: Object.keys(PAPER).map(k => ({ value: k, label: k })) },
    { name: 'orient', label: 'Orientation', type: 'select', value: c.orient, options: [{ value: 'auto', label: 'Auto (comme le plan)' }, { value: 'l', label: 'Paysage' }, { value: 'p', label: 'Portrait' }] },
    { name: 'margin', label: 'Marge (mm)', type: 'number', value: c.margin },
    ...(pages ? [{ name: 'all', label: 'Pages', type: 'select', value: 'one', options: [{ value: 'one', label: 'Seulement la page de ce plan' }, { value: 'all', label: 'Tout le PDF d\'origine' }] }] : []),
  ], { okLabel: 'Convertir' });
  if (!r) return;
  try { localStorage.setItem('conv.cfg', JSON.stringify({ fmt: r.fmt, orient: r.orient, margin: +r.margin || 0 })); } catch (e) {}
  const ld = loading('Conversion (vectoriel conservé)…');
  try { const blob = await pdfToFormat(bytes, { fmt: r.fmt, orient: r.orient, margin: +r.margin || 0, pages: r.all === 'all' ? null : pages }); ld.close(); await pdfResultMenu(blob, `${name} - ${r.fmt}`, r.fmt, onAdded); }
  catch (e) { ld.close(); console.error(e); alertBox('Conversion impossible : ' + e.message); }
}
// ---------- v1.0.53 : plusieurs DWG → un seul PDF (rangé par niveau puis par lot), réglages du tracé gardés ----------
async function batchPlotFlow(onAdded) {
  const pid = App.project.id, [plans, folders] = await Promise.all([DB.byProject('plans', pid), DB.byProject('folders', pid)]);
  const fname = (id) => { const f = folders.find(x => x.id === id); return f ? folderPath(f, folders) : 'Sans dossier'; };
  const rank = (n) => typeof avNivRank === 'function' ? avNivRank(n) : 0, lotI = (id) => { const i = (typeof LOTS_DEF !== 'undefined' ? LOTS_DEF : []).findIndex(l => l.id === id); return i < 0 ? 99 : i; };
  const cad = plans.filter(p => isCurrentPlan(p) && (p.dwgFileId || p.dxfFileId))
    .sort((a, b) => rank(fname(a.folderId)) - rank(fname(b.folderId)) || fname(a.folderId).localeCompare(fname(b.folderId), 'fr', { numeric: true }) || lotI(a.lotId) - lotI(b.lotId) || a.name.localeCompare(b.name, 'fr', { numeric: true }));
  const sel = new Set(cad.map(p => p.id)), phone = [];
  const ok = await new Promise((resolve) => { let go = false;
    const s = sheet(`<div class="bp"></div><button class="btn ghost" data-a="ph" style="width:100%;margin-top:8px">📱 Ajouter des DWG / DXF du téléphone</button><div class="bp-ph"></div>
      <div class="btnrow"><button class="btn ghost" data-a="x">Annuler</button><button class="btn" data-a="ok">Régler et tracer</button></div>`, { title: 'Plusieurs DWG → un seul PDF (niveau › lot)',
      onMount: (el) => {
        const upd = () => { let last = ''; $('.bp', el).innerHTML = cad.length ? cad.map(p => { const g = fname(p.folderId), h = g !== last ? `<div class="mg-g">📁 ${esc(g)}</div>` : ''; last = g; return h + `<label class="tm-ck"><input type="checkbox" data-bp="${p.id}" ${sel.has(p.id) ? 'checked' : ''}> ${esc(p.name)}</label>`; }).join('') : '<p class="muted">Aucun plan AutoCAD dans le projet : ajoutez des fichiers du téléphone.</p>';
          $('.bp-ph', el).innerHTML = phone.map(f => `<div class="mg-it on"><span class="grow">${esc(f.name)}</span></div>`).join('');
          $$('[data-bp]', el).forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.bp) : sel.delete(c.dataset.bp); }); };
        $('[data-a=ph]', el).onclick = async () => { phone.push(...(await pickFiles({ accept: '*/*', multiple: true })).filter(f => /\.(dwg|dxf)$/i.test(f.name))); upd(); };
        $('[data-a=x]', el).onclick = () => s.close();
        $('[data-a=ok]', el).onclick = () => { if (!sel.size && !phone.length) return toast('Choisissez au moins un plan'); go = true; s.close(); };
        upd(); } });
    s.onClose = () => resolve(go); });
  if (!ok) return;
  const items = [...cad.filter(p => sel.has(p.id)).map(p => ({ plan: p, name: p.name })), ...phone.map(f => ({ file: f, name: f.name.replace(/\.[^.]+$/, '') }))];
  const ld0 = loading('Lecture du premier plan…'); let D0;
  try { D0 = items[0].plan ? await cadOfPlan(items[0].plan) : await cadReadPicked(items[0].file, ld0); } catch (e) { ld0.close(); return alertBox('Lecture impossible : ' + e.message); }
  ld0.close(); const o = await plotDialog(D0, `${items.length} plan(s) — réglages pour tous`); if (!o) return;
  const ld = loading('Tracé…'), { PDFDocument } = await needPdfLib(), out = await PDFDocument.create(), fails = [];
  try {
    for (let i = 0; i < items.length; i++) {
      const it = items[i]; ld.set(`Tracé ${i + 1}/${items.length} · ${it.name}`); await new Promise(r => setTimeout(r, 30));
      try { const D = i === 0 ? D0 : it.plan ? await cadOfPlan(it.plan) : await cadReadPicked(it.file, ld); if (!D) throw new Error('pas de source AutoCAD');
        const r = cadPlotPdf(D, { ...o, title: it.name, frames: i === 0 ? o.frames : cadFrames(D), hidden: i === 0 ? o.hidden : D._hidden || [] }), src = await PDFDocument.load(r.doc.output('arraybuffer'));
        (await out.copyPages(src, src.getPageIndices())).forEach(pg => out.addPage(pg)); } catch (e) { console.warn('tracé', it.name, e); fails.push(it.name); }
    }
    if (!out.getPageCount()) throw new Error('aucun plan tracé');
    const blob = new Blob([await out.save()], { type: 'application/pdf' }); ld.close();
    if (fails.length) await alertBox(`Non tracés (${fails.length}) : ${fails.join(', ')}`);
    const r = await formSheet('Nom du PDF', [{ name: 'n', label: 'Nom', value: `${App.project.name} - Plans ${o.fmt}` }], { okLabel: 'OK' });
    await pdfResultMenu(blob, (r && r.n) || 'Plans', `${out.getPageCount()} pages ${o.fmt}`, onAdded);
  } catch (e) { ld.close(); console.error(e); alertBox('Erreur : ' + e.message); }
}

// ---------- menu « Outils plans » ----------
async function planToolsMenu(root) {
  const re = () => root && renderPlans(root);
  const v = await menu('Outils plans (AutoCAD / PDF)', [
    { label: 'DWG / DXF → PDF vectoriel (tracer : format, épaisseurs)', icon: 'pdf', value: 'plot' },
    { label: 'DWG → DXF (exporter / partager)', icon: 'share', value: 'dxf' },
    { label: 'Plusieurs DWG → un seul PDF (rangé par niveau › lot)', icon: 'pdf', value: 'batch' },
    { label: 'Changer le format d\'un PDF (A0 → A3, A1 → A4…)', icon: 'plans', value: 'conv' },
    { label: 'Fusionner des plans en un PDF', icon: 'layers', value: 'merge' },
    { label: 'Diviser un PDF (pages / plages)', icon: 'plans', value: 'split' },
    ...(typeof openPdfTools === 'function' ? [{ label: 'Atelier PDF (réordonner, supprimer, remplacer des pages)', icon: 'edit', value: 'atelier' }] : []),
  ]);
  if (v === 'atelier') return openPdfTools();
  if (v === 'plot' || v === 'dxf') {
    const src = await menu(v === 'plot' ? 'Tracer quel fichier ?' : 'Convertir quel DWG ?', [{ label: 'Un fichier du téléphone (.dwg / .dxf)', icon: 'upload', value: 'ph' }, { label: 'Un plan AutoCAD du projet', icon: 'plans', value: 'pl' }]);
    if (src === 'pl') {
      const pls = (await DB.byProject('plans', App.project.id)).filter(p => isCurrentPlan(p) && (p.dwgFileId || (v === 'plot' && p.dxfFileId)));
      if (!pls.length) return alertBox('Aucun plan AutoCAD dans ce projet. Importez un .dwg ou .dxf.');
      const id = await menu('Plan AutoCAD', pls.map(p => ({ label: p.name, icon: 'plans', value: p.id }))); const pl = pls.find(p => p.id === id); if (!pl) return;
      return v === 'plot' ? plotPlan(pl, re) : exportDxfOfPlan(pl);
    }
    if (src !== 'ph') return;
    const [file] = await pickFiles({ accept: '*/*', multiple: false }); if (!file) return;
    if (!/\.(dwg|dxf)$/i.test(file.name)) return alertBox('Choisissez un fichier .dwg ou .dxf');
    const ld = loading('Lecture du fichier AutoCAD…'); let D;
    try { D = await cadReadPicked(file, ld); } catch (e) { ld.close(); return alertBox('Lecture impossible : ' + e.message); }
    ld.close(); const base = file.name.replace(/\.[^.]+$/, '');
    if (v === 'dxf') return shareBlob(new Blob([cadToDxf(D)], { type: 'application/dxf' }), safeName(base) + '.dxf');
    return plotCad(D, base, re);
  }
  if (v === 'batch') return batchPlotFlow(re);
  if (v === 'conv') return convertPdfFlow(re);
  if (v === 'merge') return mergePdfFlow(re);
  if (v === 'split') return splitPdfFlow(re);
}

// au démarrage : la lecture d'un DWG a-t-elle fait fermer l'appli ?
function dwgCrashCheck() {
  let r = null; try { r = JSON.parse(localStorage.getItem('dwg.reading') || 'null'); localStorage.removeItem('dwg.reading'); } catch (e) {}
  if (r && Date.now() - (r.at || 0) < 15 * 60000) setTimeout(() => alertBox(`Le fichier DWG ${r.name ? '« ' + r.name + ' » ' : ''}n'a pas pu être lu (l'appli s'est fermée).\n\nVos données sont intactes. Pour ce plan : dans AutoCAD, enregistrez-le en DXF (version 2013 ou 2018) ou tracez-le en PDF, puis importez ce fichier.`), 1500);
}
