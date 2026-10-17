// ================= Comparaison de deux niveaux ÉLÉMENT PAR ÉLÉMENT (poteaux, voiles, corbeaux…) =================
// 1) on extrait les éléments de structure de chaque plan (contours fermés et hachures pleines du DWG/DXF ; sinon masses du dessin)
// 2) calage par les fils / axes (A, B, C… / 1, 2, 3…), sinon par la trame des poteaux (vote), sinon manuel (toucher le même poteau)
// 3) appariement → continue · nouveau · s'arrête · modifié (section, longueur, déplacement) ; textes et cotes ignorés
const LV_AX_LAY = /ax|fil|grid|trame|quadr|repere/i;
const LV_NAME = /^(CR|PT|PO|P|VL|V|C|PL|R|RD)\s?-?\s?\d{1,3}[a-z]?$/i;
const LV_SECT = /(\d{2,3})\s?[x×*\/]\s?(\d{2,3})/i;
const LV_T = { pot: ['Poteau', 'Poteaux', '#3b82f6'], voile: ['Voile', 'Voiles', '#a855f7'], cor: ['Corbeau', 'Corbeaux', '#f59e0b'], autre: ['Élément', 'Autres éléments', '#64748b'] };
const LV_S = { cont: ['Continue', '#6b7280'], new: ['Nouveau', '#16a34a'], stop: ['S\'arrête', '#dc2626'], mod: ['Modifié', '#f97316'] };

// ---------- géométrie ----------
function lvHull(P) { const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p; const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1)); }
// plus petit rectangle englobant (orienté) : centre, petit côté w, grand côté L, angle
function lvOBB(P) { const H = lvHull(P); if (H.length < 3) { const xs = P.map(q => q[0]), ys = P.map(q => q[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: Math.min(x1 - x0, y1 - y0), L: Math.max(x1 - x0, y1 - y0), ang: x1 - x0 >= y1 - y0 ? 0 : Math.PI / 2, nh: H.length }; }
  let best = null;
  for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length], an = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(an), s = Math.sin(an);
    let u0 = 1e18, u1 = -1e18, v0 = 1e18, v1 = -1e18; for (const q of H) { const u = q[0] * c + q[1] * s, v = -q[0] * s + q[1] * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const A = (u1 - u0) * (v1 - v0); if (!best || A < best.A) { const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2; best = { A, cx: uc * c - vc * s, cy: uc * s + vc * c, du: u1 - u0, dv: v1 - v0, an }; } }
  const L = Math.max(best.du, best.dv), w = Math.min(best.du, best.dv); let ang = best.du >= best.dv ? best.an : best.an + Math.PI / 2; ang = ((ang % Math.PI) + Math.PI) % Math.PI;
  return { cx: best.cx, cy: best.cy, w, L, ang, nh: H.length }; }
const lvArea = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
const lvMed = (v) => { if (!v.length) return 0; const s = v.slice().sort((a, b) => a - b); return s[s.length >> 1]; };
function lvClassify(e) {
  const lab = (e.label || '').toUpperCase(), r = e.L / Math.max(e.w, 1e-6), round = e.nh > 10 && r < 1.15;
  if (/^CR/.test(lab)) return 'cor';
  if (/^(V|VL)\s?-?\d/.test(lab) && r >= 2) return 'voile';
  if (e.m) {   // dimensions réelles en mètres
    if (round || (e.L <= 1.25 && r <= 4)) return /^(P|PT|PO)/.test(lab) || !lab ? (e.L <= 0.6 && /^C\d/.test(lab) ? 'cor' : 'pot') : 'pot';
    if (e.w <= 0.45 && r >= 3) return 'voile';
    return 'autre';
  }
  // image : relatif à la taille typique d'un poteau
  if (round || r <= 3.2) return e.L <= e.ref * 2.6 ? 'pot' : 'autre';
  if (e.w <= e.ref * 1.4 && r >= 3) return 'voile';
  return 'autre';
}

// ---------- extraction : DWG / DXF ----------
async function lvFromCad(plan) {
  const D = await cadOfPlan(plan); if (!D || !D.prims || !D.box) return null;
  const polys = [], texts = [], axl = [];
  for (const p of D.prims) { const L = String(p.layer || '');
    if (p.t === 'tx') { texts.push({ s: String(p.s || '').trim(), x: p.p[0] + String(p.s || '').length * p.h * 0.3, y: p.p[1] + p.h * 0.5, h: p.h, ax: LV_AX_LAY.test(L) }); continue; }
    if (LV_AX_LAY.test(L)) { if (p.t === 'pl') { if (!p.closed && p.pts.length >= 2) axl.push({ a: p.pts[0], b: p.pts[p.pts.length - 1] }); else if (p.closed) texts.push({ bubble: true, pts: p.pts }); } continue; }
    if (NOSTRUCT_LAY.test(L)) continue;
    if (p.t === 'fl') for (const P of p.loops) { if (P.length >= 3) polys.push({ P, L, fill: 1 }); }
    else if (p.t === 'pl' && p.closed && p.pts.length >= 3) polys.push({ P: p.pts, L, st: STRUCT_LAY.test(L) });
  }
  // calques de structure présents → on ne garde qu'eux (le mobilier, les portes… restent dehors)
  const hasSt = polys.some(q => q.st || (q.fill && STRUCT_LAY.test(q.L)));
  let cand = polys.filter(q => !hasSt || q.st || STRUCT_LAY.test(q.L)).map(q => ({ ...q, ...lvOBB(q.P) })).filter(q => q.L > 0);
  // unité du dessin : d'après la section typique des petits éléments (poteaux 20 à 60 cm)
  const small = cand.filter(q => q.L / Math.max(q.w, 1e-9) < 2.5).map(q => q.w), mw = lvMed(small);
  let u = DXF_UNITS[D.ins];
  const guess = mw ? (mw > 100 ? 0.001 : mw > 8 ? 0.01 : 1) : (Math.max(D.box[2] - D.box[0], D.box[3] - D.box[1]) > 2000 ? 0.001 : 1);
  if (!u || (mw && (mw * u < 0.08 || mw * u > 2))) u = guess;
  const s = plan.w / (D.box[2] - D.box[0]), px = (x, y) => [(x - D.box[0]) * s, (D.box[3] - y) * s];
  // en mètres ; on enlève les contours géants (dalle, cadre) et les doublons (contour + hachure)
  let E = cand.map(q => ({ P: q.P.map(p => [p[0] * u, p[1] * u]), cx: q.cx * u, cy: q.cy * u, w: q.w * u, L: q.L * u, ang: q.ang, nh: q.nh, m: true })).filter(e => e.L <= 14 && e.w >= 0.07 && e.L >= 0.12);
  E.sort((a, b) => b.w * b.L - a.w * a.L);
  const keep = [];
  for (const e of E) { if (keep.some(k => Math.hypot(k.cx - e.cx, k.cy - e.cy) < 0.03 && Math.abs(k.L - e.L) < 0.03 && Math.abs(k.w - e.w) < 0.03)) continue;
    // hachure d'un élément déjà retenu (entièrement dedans) → ignorée
    if (keep.some(k => k.L < 3 && Math.abs(e.cx - k.cx) < k.L / 2 && Math.abs(e.cy - k.cy) < k.L / 2 && e.L <= k.L + 0.01 && e.w <= k.w + 0.01 && e.w * e.L > 0.6 * k.w * k.L)) continue;
    keep.push(e); }
  // noms (P12, V3, CR29…) et sections écrites (30x30) : texte le plus proche
  const T = texts.filter(t => !t.bubble && t.s).map(t => ({ ...t, x: t.x * u, y: t.y * u, h: t.h * u }));
  const names = T.filter(t => LV_NAME.test(t.s.replace(/\s+/g, ' ')) || LV_SECT.test(t.s));
  // attribution globale : la paire texte / élément la plus proche d'abord, chaque nom ne sert qu'une fois (un nom qui ne colle pas à la forme coûte plus)
  keep.forEach(e => { e.type = lvClassify(e); });
  const pre = (t) => { const x = t.s.toUpperCase(); return /^CR/.test(x) ? 'cor' : /^V/.test(x) ? 'voile' : /^P/.test(x) ? 'pot' : ''; }, pairs = [];
  names.forEach((t, ti) => keep.forEach((e, ei) => { let d = Math.hypot(e.cx - t.x, e.cy - t.y) - e.L / 2; if (d > Math.max(1.2, t.h * 6)) return; const pf = pre(t); if (pf && pf !== e.type && !(pf === 'cor' && e.type === 'pot')) d += 0.4; if (pf === 'cor') d -= 0.15; pairs.push([d, ti, ei]); }));
  pairs.sort((a, b) => a[0] - b[0]); const ut = new Set(), ue = new Set(), us = new Set();
  for (const [d, ti, ei] of pairs) { const t = names[ti], e = keep[ei];
    if (LV_NAME.test(t.s)) { if (ut.has(ti) || ue.has(ei)) continue; e.label = t.s.replace(/\s+/g, ''); ut.add(ti); ue.add(ei); }
    else if (!us.has(ei) && !ut.has(ti)) { e.sect = t.s.match(LV_SECT)[0]; us.add(ei); ut.add(ti); } }
  keep.forEach((e, i) => { e.id = 'e' + i; e.type = lvClassify(e); });
  // axes : lignes des calques d'axes + étiquettes (bulles)
  const AX = axl.map(l => ({ a: [l.a[0] * u, l.a[1] * u], b: [l.b[0] * u, l.b[1] * u] })).filter(l => Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]) > 2);
  const lab = T.filter(t => t.ax || /^[A-Z]{1,2}'?$|^\d{1,2}'?$/.test(t.s)).filter(t => t.s.length <= 3);
  for (const l of AX) { let best = null; for (const t of lab) for (const q of [l.a, l.b]) { const d = Math.hypot(t.x - q[0], t.y - q[1]); if (d < 2.5 && (!best || d < best.d)) best = { d, s: t.s }; } l.lab = best && best.s; l.dir = Math.abs(l.b[0] - l.a[0]) < Math.abs(l.b[1] - l.a[1]) ? 'v' : 'h'; }
  return { E: keep, axes: AX.filter(l => l.lab), m: true, u, toPx: (x, y) => px(x / u, y / u), fromPx: (X, Y) => [(X / s + D.box[0]) * u, (D.box[3] - Y / s) * u], src: 'cad' };
}
// ---------- extraction : PDF / image (masses du dessin, textes enlevés quand c'est possible) ----------
async function lvFromImage(plan, W, H, k, place, imgData) {
  const m = await structMap(plan, W, H, k, place, imgData), seen = new Uint8Array(m.length), comps = [];
  for (let i = 0; i < m.length; i++) { if (!m[i] || seen[i]) continue; const st = [i], P = []; seen[i] = 1;
    while (st.length) { const c = st.pop(), x = c % W, y = (c / W) | 0; P.push([x, y]); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx; if (m[n] && !seen[n]) { seen[n] = 1; st.push(n); } } }
    if (P.length >= 12) comps.push(P); }
  const iK = 1 / k;   // coordonnées du NOUVEAU plan (pixels de son image)
  let E = comps.map(P => { const H2 = lvHull(P).map(q => [q[0] * iK, q[1] * iK]), o = lvOBB(H2); return { P: H2, ...o, area: P.length * iK * iK }; }).filter(e => e.L > 0);
  const ref = lvMed(E.filter(e => e.L / Math.max(e.w, 1e-6) < 2).map(e => e.w)) || 10;
  // les mots restés dans une image (après fermeture) forment des taches trouées : on garde les masses pleines
  E = E.filter(e => e.L < ref * 60 && e.area / Math.max(1, e.w * e.L) >= (e.L / Math.max(e.w, 1e-6) > 2.5 ? 0.86 : 0.7));
  E.forEach((e, i) => { e.id = 'e' + i; e.ref = ref; e.type = lvClassify(e); });
  return { E, axes: [], m: false, ref, toPx: (x, y) => [x, y], fromPx: (X, Y) => [X, Y], src: 'img' };
}
// ---------- calage ----------
const lvApply = (T, x, y) => [T.c * x - T.s * y + T.tx, T.s * x + T.c * y + T.ty];
function lvInter(l1, l2) { const [x1, y1] = l1.a, [x2, y2] = l1.b, [x3, y3] = l2.a, [x4, y4] = l2.b, d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4); if (Math.abs(d) < 1e-9) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d; return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]; }
function lvAxisCal(A, B) {
  const byL = (X) => { const m = {}; for (const l of X.axes) if (!m[l.lab]) m[l.lab] = l; return m; }, a = byL(A), b = byL(B);
  const com = Object.keys(a).filter(k => b[k] && a[k].dir === b[k].dir), V = com.filter(k => a[k].dir === 'v'), Hh = com.filter(k => a[k].dir === 'h');
  const pairs = []; for (const v of V) for (const h of Hh) { const p = lvInter(a[v], a[h]), q = lvInter(b[v], b[h]); if (p && q) pairs.push([p, q]); }
  if (pairs.length >= 2) {   // rotation + translation (même échelle : mètres)
    const ma = pairs.reduce((s, [p]) => [s[0] + p[0] / pairs.length, s[1] + p[1] / pairs.length], [0, 0]), mb = pairs.reduce((s, [, q]) => [s[0] + q[0] / pairs.length, s[1] + q[1] / pairs.length], [0, 0]);
    let sc = 0, ss = 0; for (const [p, q] of pairs) { const ax = p[0] - ma[0], ay = p[1] - ma[1], bx = q[0] - mb[0], by = q[1] - mb[1]; sc += ax * bx + ay * by; ss += ax * by - ay * bx; }
    let th = Math.atan2(ss, sc); if (Math.abs(th) < 0.003) th = 0; const c = Math.cos(th), s = Math.sin(th);
    return { c, s, tx: mb[0] - (c * ma[0] - s * ma[1]), ty: mb[1] - (s * ma[0] + c * ma[1]), how: `axes ${[...V].sort().join(',')} / ${[...Hh].sort((x, y) => x - y).join(',')}` };
  }
  // une seule direction : décalage perpendiculaire seulement
  if (V.length || Hh.length) { const dx = V.length ? lvMed(V.map(k => ((b[k].a[0] + b[k].b[0]) - (a[k].a[0] + a[k].b[0])) / 2)) : null, dy = Hh.length ? lvMed(Hh.map(k => ((b[k].a[1] + b[k].b[1]) - (a[k].a[1] + a[k].b[1])) / 2)) : null; return { c: 1, s: 0, tx: dx, ty: dy, partial: true, how: `axes ${[...V, ...Hh].join(',')}` }; }
  return null;
}
// trame des poteaux : la translation qui superpose le plus d'éléments (vote)
function lvVoteCal(A, B, tol, fix) {
  const pa = A.E.filter(e => e.type === 'pot' || e.type === 'voile'), pb = B.E.filter(e => e.type === 'pot' || e.type === 'voile');
  if (!pa.length || !pb.length) return null;
  const G = new Map(), key = (x, y) => `${Math.round(x / tol)},${Math.round(y / tol)}`;
  pb.forEach(e => { const k = key(e.cx, e.cy); (G.get(k) || G.set(k, []).get(k)).push(e); });
  const score = (tx, ty) => { let n = 0; for (const e of pa) { const x = e.cx + tx, y = e.cy + ty, gx = Math.round(x / tol), gy = Math.round(y / tol); let ok = false;
    for (let i = -1; i <= 1 && !ok; i++) for (let j = -1; j <= 1 && !ok; j++) for (const f of G.get(`${gx + i},${gy + j}`) || []) if (f.type === e.type && Math.hypot(f.cx - x, f.cy - y) < tol && Math.abs(f.w - e.w) < Math.max(tol, e.w * .5)) { ok = true; break; } if (ok) n++; } return n; };
  let best = { n: score(fix ? fix.tx || 0 : 0, fix ? fix.ty || 0 : 0), tx: fix ? fix.tx || 0 : 0, ty: fix ? fix.ty || 0 : 0 };
  const SA = pa.filter(e => e.type === 'pot').slice(0, 70), SB = pb.filter(e => e.type === 'pot').slice(0, 70);
  for (const a of (SA.length ? SA : pa.slice(0, 40))) for (const b of (SB.length ? SB : pb.slice(0, 40))) { if (a.type !== b.type || Math.abs(a.w - b.w) > Math.max(tol, a.w * .4)) continue;
    let tx = b.cx - a.cx, ty = b.cy - a.cy; if (fix && fix.tx != null) tx = fix.tx; if (fix && fix.ty != null) ty = fix.ty; const n = score(tx, ty); if (n > best.n) best = { n, tx, ty }; }
  // affinage : moyenne des décalages des éléments superposés
  const dx = [], dy = []; for (const e of pa) { let bf = null, bd = tol; for (const f of pb) { if (f.type !== e.type) continue; const d = Math.hypot(f.cx - e.cx - best.tx, f.cy - e.cy - best.ty); if (d < bd) { bd = d; bf = f; } } if (bf) { dx.push(bf.cx - e.cx); dy.push(bf.cy - e.cy); } }
  if (dx.length) { best.tx = lvMed(dx); best.ty = lvMed(dy); }
  return { c: 1, s: 0, tx: best.tx, ty: best.ty, n: best.n, how: `trame des poteaux (${best.n} en commun)` };
}
// ---------- appariement ----------
function lvMatch(A, B, T, m) {
  const tA = A.E.map(e => { const [cx, cy] = lvApply(T, e.cx, e.cy); return { ...e, cx, cy, ang: e.ang + Math.atan2(T.s, T.c), P: e.P.map(q => lvApply(T, q[0], q[1])) }; });
  const ref = m ? 1 : (B.ref || 10), tolC = m ? 0.12 : ref * 0.6, cand = [];
  for (const b of B.E) for (const a of tA) { const d = Math.hypot(a.cx - b.cx, a.cy - b.cy), lim = Math.max(tolC, Math.min(a.L, b.L) * 0.45); if (d > lim) continue;
    cand.push({ a, b, cost: d + Math.abs(a.L - b.L) * .5 + Math.abs(a.w - b.w) + (a.type === b.type ? 0 : ref * .3) }); }
  cand.sort((x, y) => x.cost - y.cost);
  const ua = new Set(), ub = new Set(), R = [];
  const fmt = (v) => m ? (v < 1.2 ? Math.round(v * 100) + '' : (Math.round(v * 100) / 100).toLocaleString('fr-FR')) : '';
  const dims = (e) => m ? (e.type === 'voile' || e.L > 1.2 ? `ép. ${Math.round(e.w * 100)} cm · L ${e.L.toFixed(2).replace('.', ',')} m` : e.nh > 10 && e.L / e.w < 1.15 ? `Ø${Math.round(e.L * 100)}` : `${Math.round(e.w * 100)}×${Math.round(e.L * 100)}`) : '';
  for (const c of cand) { if (ua.has(c.a.id) || ub.has(c.b.id)) continue; ua.add(c.a.id); ub.add(c.b.id);
    const { a, b } = c, dW = Math.abs(a.w - b.w), dL = Math.abs(a.L - b.L), d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
    const th = m ? { s: 0.03, p: 0.05 } : { s: ref * 0.18, p: ref * 0.35 }, chg = [];
    if (dW > th.s || dL > th.s) chg.push(m ? `${dims(a)} → ${dims(b)}` : (b.w * b.L > a.w * a.L ? 'plus grand' : 'plus petit'));
    // un voile raccourci bouge son centre : seul compte le décalage de travers (ou au-delà du raccourcissement)
    let dm = d; if (b.L / Math.max(b.w, 1e-6) >= 2.5) { const nx = -Math.sin(b.ang), ny = Math.cos(b.ang), vx = b.cx - a.cx, vy = b.cy - a.cy, perp = Math.abs(vx * nx + vy * ny), par = Math.abs(vx * ny - vy * nx); dm = Math.max(perp, par - dL / 2 - th.s); }
    if (dm > th.p) chg.push(m ? `déplacé de ${Math.round(dm * 100)} cm` : 'déplacé');
    if (b.type === 'voile' && dW <= th.s && dL > th.s && m) chg[0] = `L ${a.L.toFixed(2).replace('.', ',')} → ${b.L.toFixed(2).replace('.', ',')} m`;
    R.push({ st: chg.length ? 'mod' : 'cont', type: b.type === 'autre' ? a.type : b.type, a, b, label: b.label || a.label || '', txt: chg.join(' · '), dims: dims(b) }); }
  for (const a of tA) if (!ua.has(a.id)) R.push({ st: 'stop', type: a.type, a, label: a.label || '', dims: dims(a), txt: m ? dims(a) : '' });
  for (const b of B.E) if (!ub.has(b.id)) R.push({ st: 'new', type: b.type, b, label: b.label || '', dims: dims(b), txt: m ? dims(b) : '' });
  return R;
}

// ---------- écran ----------
async function openLevelCompare(low, up, opts = {}) {
  const ld = loading('Lecture des éléments de structure…');
  let A, B, T, how = '', mode = 'el';
  try {
    if ((low.dwgFileId || low.dxfFileId) && (up.dwgFileId || up.dxfFileId)) { [A, B] = await Promise.all([lvFromCad(low), lvFromCad(up)]); }
    if (!A || !B || A.E.length < 2 || B.E.length < 2) {   // PDF / image : dans le repère du nouveau plan (recalage par les textes au départ)
      const M = await planAlignMap(low, up), k = Math.min(1, 2600 / Math.max(up.w, up.h)), W = Math.round(up.w * k), H = Math.round(up.h * k);
      const place = { x: M.ox * k, y: M.oy * k, w: low.w * M.sx * k, h: low.h * M.sy * k };
      const [ia, ib] = await Promise.all([planImageData(low, W, H, place), planImageData(up, W, H)]);
      [A, B] = await Promise.all([lvFromImage(low, W, H, k, place, ia), lvFromImage(up, W, H, k, null, ib)]);
    }
    ld.set('Calage par les fils et les axes…');
    const m = A.m && B.m, tol = m ? 0.15 : (B.ref || 10) * 0.7;
    const ax = m ? lvAxisCal(A, B) : null;
    if (ax && !ax.partial) { T = ax; how = ax.how; }
    else { const v = lvVoteCal(A, B, tol, ax && ax.partial ? ax : null); T = v || { c: 1, s: 0, tx: 0, ty: 0 }; how = ax ? ax.how + ' + ' + (v ? v.how : '') : v ? v.how : 'sans calage'; }
  } catch (e) { ld.close(); console.error(e); return alertBox('Comparaison impossible : ' + (e.message || e)); }
  ld.close();
  const m = A.m && B.m;
  let R = lvMatch(A, B, T, m);
  const W = up.w, H = up.h, srcB = await fileURL(up.fileId), iA = opts.la || low.name, iB = opts.lb || up.name;
  const hide = new Set(['cont']); let tf = 'all', pick = null;
  const el = document.createElement('div'); el.className = 'fullpage av-page lvc';
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button>
      <div class="tb-title" style="flex:1"><b>Niveaux ${esc(iA)} ↔ ${esc(iB)}</b><span class="lv-how"></span></div>
      <button class="iconbtn" data-a="cal" title="Calage manuel">🎯</button><button class="iconbtn" data-a="img" title="Superposition des dessins">${icon('layers')}</button><button class="iconbtn" data-a="share">${icon('share')}</button></div>
    <div class="av-chips lv-types"></div>
    <div class="av-view"><div class="av-stage"><img width="${W}" height="${H}" src="${srcB}" class="lv-bg"><svg class="av-ov lv-ov" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"></svg></div><div class="lv-tip"></div></div>
    <div class="lv-leg"></div>`;
  document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  const close = () => { unBack(); el.remove(); };
  $('[data-a=x]', el).onclick = close;
  const view = $('.av-view', el), stage = $('.av-stage', el), ov = $('.lv-ov', el), tip = $('.lv-tip', el);
  const pxB = (x, y) => B.toPx(x, y), poly = (P) => P.map(q => pxB(q[0], q[1]).map(v => v.toFixed(1)).join(',')).join(' ');
  const vis = () => R.filter(r => !hide.has(r.st) && (tf === 'all' || r.type === tf));
  const bbox = (r) => { const P = [...(r.b ? r.b.P : []), ...(r.a ? r.a.P : [])].map(q => pxB(q[0], q[1])); const xs = P.map(q => q[0]), ys = P.map(q => q[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };
  let sNow = 1;
  const draw = () => {
    const s = sNow, lw = 1.6 / s, V = vis(), numbered = V.filter(r => r.st !== 'cont');
    const shape = (r) => { const c = LV_S[r.st][1];
      if (r.st === 'stop') return `<polygon points="${poly(r.a.P)}" fill="${c}" fill-opacity=".28" stroke="${c}" stroke-width="${lw}" stroke-dasharray="${5 / s} ${3 / s}"/>`;
      if (r.st === 'mod') return `<polygon points="${poly(r.a.P)}" fill="none" stroke="#dc2626" stroke-width="${lw}" stroke-dasharray="${4 / s} ${3 / s}"/><polygon points="${poly(r.b.P)}" fill="${c}" fill-opacity=".45" stroke="${c}" stroke-width="${lw}"/>`;
      return `<polygon points="${poly(r.b.P)}" fill="${c}" fill-opacity="${r.st === 'cont' ? .35 : .45}" stroke="${c}" stroke-width="${r.st === 'cont' ? lw * .6 : lw}"/>`; };
    ov.innerHTML = V.map(shape).join('') + numbered.map((r, i) => { const q = bbox(r), pad = 6 / s, c = LV_S[r.st][1];
      return `<rect x="${q.x - pad}" y="${q.y - pad}" width="${q.w + 2 * pad}" height="${q.h + 2 * pad}" fill="none" stroke="${c}" stroke-width="${(pick === r ? 3 : 1.4) / s}" rx="${3 / s}"/>
        <g transform="translate(${q.x - pad},${q.y - pad})"><circle r="${9 / s}" fill="${c}"/><text y="${3.6 / s}" text-anchor="middle" font-size="${10 / s}" font-weight="700" fill="#fff" font-family="Arial">${i + 1}</text></g>
        ${s > 0.6 * pz.st.fit * 4 && (r.label || r.txt) ? `<text x="${q.x + q.w + pad + 3 / s}" y="${q.y + 10 / s}" font-size="${11 / s}" font-weight="700" fill="${c}" font-family="Arial" paint-order="stroke" stroke="#fff" stroke-width="${3 / s}">${esc([r.label, r.txt].filter(Boolean).join(' · '))}</text>` : ''}`; }).join('');
  };
  const pz = panZoom(view, stage, W, H, { onChange: (st) => { sNow = st.s; cancelAnimationFrame(draw._r); draw._r = requestAnimationFrame(draw); }, onTap: ([x, y]) => tapAt(x, y) });
  requestAnimationFrame(() => { pz.fit(); sNow = pz.st.s; draw(); });
  const counts = () => {
    const by = (st) => R.filter(r => r.st === st && (tf === 'all' || r.type === tf)).length;
    $('.lv-how', el).textContent = `Calage : ${how}`;
    $('.lv-types', el).innerHTML = [['all', 'Tous', R.length], ...Object.entries(LV_T).map(([k, v]) => [k, v[1], R.filter(r => r.type === k).length]).filter(x => x[2])].map(([k, l, n]) => `<button data-t="${k}" class="${tf === k ? 'on' : ''}">${l} · ${n}</button>`).join('');
    $('.lv-leg', el).innerHTML = `${['new', 'stop', 'mod', 'cont'].map(st => `<button data-s="${st}" class="${hide.has(st) ? 'off' : ''}"><i style="background:${LV_S[st][1]}"></i>${st === 'new' ? 'Nouveau en ' + esc(iB) : st === 'stop' ? 'S\'arrête en ' + esc(iA) : LV_S[st][0]} · ${by(st)}</button>`).join('')}<button class="btn small" data-a="list">Liste des changements</button>`;
    $$('[data-t]', el).forEach(b => b.onclick = () => { tf = b.dataset.t; counts(); draw(); });
    $$('[data-s]', el).forEach(b => b.onclick = () => { hide.has(b.dataset.s) ? hide.delete(b.dataset.s) : hide.add(b.dataset.s); counts(); draw(); });
    $('[data-a=list]', el).onclick = list;
  };
  const showTip = (r) => { pick = r; tip.innerHTML = r ? `<b style="color:${LV_S[r.st][1]}">${LV_S[r.st][0]}</b> · ${esc(LV_T[r.type][0])}${r.label ? ' ' + esc(r.label) : ''}<br><small>${esc(r.txt || r.dims || '')}</small>` : ''; tip.style.display = r ? 'block' : 'none'; draw(); };
  const zoomTo = (r) => { const q = bbox(r); pz.zoomTo(q.x - q.w, q.y - q.h, q.w * 3 + 40, q.h * 3 + 40); showTip(r); };
  // toucher un élément → sa fiche ; en mode calage : toucher le même poteau sur les deux niveaux
  let calStep = 0, calA = null;
  const tapAt = (x, y) => {
    const [wx, wy] = B.fromPx(x, y);
    const near = (L, get) => { let b = null, bd = 1e18; for (const r of L) { const e = get(r); if (!e) continue; const d = Math.hypot(e.cx - wx, e.cy - wy) - e.L / 2; if (d < bd) { bd = d; b = r; } } return bd < (m ? 0.6 : (B.ref || 10) * 2) ? b : null; };
    if (calStep === 1) { const r = near(R.filter(r => r.a), r => r.a); if (!r) return toast('Touchez un élément rouge (niveau du dessous)'); calA = r.a; calStep = 2; hide.clear(); counts(); draw(); return toast(`Maintenant le même élément sur ${iB}`); }
    if (calStep === 2) { const r = near(R.filter(r => r.b), r => r.b); if (!r) return toast(`Touchez l'élément sur ${iB}`); T = { ...T, tx: T.tx + (r.b.cx - calA.cx), ty: T.ty + (r.b.cy - calA.cy) }; how = 'manuel (1 élément commun)';
      R = lvMatch(A, B, T, m); calStep = 0; hide.add('cont'); counts(); draw(); return toast('Calage appliqué ✓'); }
    const r = near(vis(), r => r.b || r.a); showTip(r);
  };
  $('[data-a=cal]', el).onclick = () => { calStep = 1; hide.clear(); hide.add('new'); hide.add('cont'); counts(); draw(); toast(`Calage : touchez un élément de ${iA} (en rouge)`); };
  $('[data-a=img]', el).onclick = () => openPlanCompare(low, up, { levels: true, la: iA, lb: iB });
  const list = () => {
    const G = Object.keys(LV_T).map(t => [t, R.filter(r => r.type === t && r.st !== 'cont')]).filter(g => g[1].length);
    if (!G.length) return toast('Aucun changement de structure');
    const num = vis().filter(r => r.st !== 'cont');
    const s = sheet(`<div class="cmp-list">${G.map(([t, L]) => `<div class="cmp-h">${LV_T[t][1]} : ${['mod', 'new', 'stop'].map(st => { const n = L.filter(r => r.st === st).length; return n ? `${n} ${n > 1 ? { mod: 'modifiés', new: 'nouveaux', stop: 's\'arrêtent' }[st] : LV_S[st][0].toLowerCase()}` : ''; }).filter(Boolean).join(' · ')}</div>
      ${L.sort((a, b) => ['mod', 'new', 'stop'].indexOf(a.st) - ['mod', 'new', 'stop'].indexOf(b.st)).map(r => `<button class="cmp-it" data-r="${R.indexOf(r)}"><span class="k" style="background:${LV_S[r.st][1]}">${num.indexOf(r) >= 0 ? num.indexOf(r) + 1 : '•'}</span><span class="grow"><b>${esc(LV_S[r.st][0])}${r.label ? ' · ' + esc(r.label) : ''}</b><small>${esc(r.txt || r.dims || '')}</small></span></button>`).join('')}`).join('')}</div>`, { title: `Changements ${iA} → ${iB}` });
    $$('[data-r]', s.el).forEach(b => b.onclick = () => { const r = R[+b.dataset.r]; s.close(); if (hide.has(r.st)) { hide.delete(r.st); counts(); } if (tf !== 'all' && tf !== r.type) { tf = 'all'; counts(); } zoomTo(r); });
  };
  $('[data-a=share]', el).onclick = async () => {
    const v = await menu('Partager', [{ label: 'PDF (plan + liste des changements)', icon: 'pdf', value: 'pdf' }, { label: 'Excel (liste)', icon: 'grid', value: 'xls' }]); if (!v) return;
    const rows = R.filter(r => r.st !== 'cont').map(r => [LV_T[r.type][0], r.label || '', LV_S[r.st][0], r.txt || r.dims || '']);
    const ld2 = loading('Création…');
    try {
      if (v === 'xls') { const b = await xlsxBlob([{ name: `${iA} - ${iB}`.slice(0, 28), head: 0, rows: [['Type', 'Nom', 'Changement', 'Détail'], ...rows], widths: [14, 12, 14, 50] }]); ld2.close(); return shareBlob(b, `Comparaison_${safeName(iA)}_${safeName(iB)}.xlsx`); }
      // image : plan du dessus en clair + éléments colorés
      const k = Math.min(1, 3000 / Math.max(W, H)), c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k); const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.globalAlpha = .35; g.drawImage(await loadImage(srcB), 0, 0, c.width, c.height); g.globalAlpha = 1;
      const fillP = (P, col, a, dash) => { g.beginPath(); P.forEach((q, i) => { const [x, y] = pxB(q[0], q[1]); i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k); }); g.closePath(); if (a) { g.globalAlpha = a; g.fillStyle = col; g.fill(); g.globalAlpha = 1; } g.setLineDash(dash ? [6, 4] : []); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); g.setLineDash([]); };
      const num = R.filter(r => r.st !== 'cont');
      for (const r of R) { const col = LV_S[r.st][1]; if (r.st === 'cont') fillP(r.b.P, col, .3); else if (r.st === 'stop') fillP(r.a.P, col, .3, true); else if (r.st === 'mod') { fillP(r.a.P, '#dc2626', 0, true); fillP(r.b.P, col, .45); } else fillP(r.b.P, col, .45); }
      num.forEach((r, i) => { const q = bbox(r); g.fillStyle = LV_S[r.st][1]; g.beginPath(); g.arc((q.x - 6) * k, (q.y - 6) * k, 11, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 12px Arial'; g.textAlign = 'center'; g.fillText(String(i + 1), (q.x - 6) * k, (q.y - 6) * k + 4); });
      const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a3', orientation: c.width > c.height ? 'landscape' : 'portrait' }), PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(pt(`Comparaison des niveaux ${iA} -> ${iB}`), 12, 14); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100); doc.text(pt(`${App.project ? App.project.name + ' · ' : ''}calage : ${how} · ${fmtDate(todayISO())}`), 12, 20);
      const kk = Math.min((PW - 24) / c.width, (PH - 40) / c.height); doc.addImage(c.toDataURL('image/jpeg', .9), 'JPEG', 12, 26, c.width * kk, c.height * kk);
      doc.setFontSize(9); let lx = 12; for (const st of ['new', 'stop', 'mod', 'cont']) { const col = LV_S[st][1]; doc.setFillColor(parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)); doc.rect(lx, PH - 10, 4, 4, 'F'); doc.setTextColor(40); doc.text(pt(st === 'new' ? 'Nouveau en ' + iB : st === 'stop' ? "S'arrete en " + iA : LV_S[st][0]), lx + 6, PH - 7); lx += 50; }
      doc.addPage('a4', 'portrait'); let y = 16; doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20); doc.text(pt(`Liste des changements (${num.length})`), 12, y); y += 8; doc.setFontSize(9.5);
      num.forEach((r, i) => { if (y > 285) { doc.addPage('a4', 'portrait'); y = 16; } doc.setFont('helvetica', 'bold'); doc.text(`${i + 1}.`, 12, y); doc.text(pt(`${LV_T[r.type][0]}${r.label ? ' ' + r.label : ''} - ${LV_S[r.st][0]}`), 20, y); doc.setFont('helvetica', 'normal'); doc.text(pt(r.txt || r.dims || ''), 80, y); y += 6; });
      ld2.close(); await sharePdf(doc, `Comparaison_${safeName(iA)}_${safeName(iB)}.pdf`);
    } catch (e) { ld2.close(); alertBox('Export impossible : ' + (e.message || e)); }
  };
  counts();
  if (!R.some(r => r.st !== 'cont')) toast('Aucun changement de structure détecté ✓');
}
