// ================= Plans : lecture du PDF (texte, cartouche), recalage, comparaison nette (vectorielle) =================
// La superposition est recalculée à partir du PDF pour la zone affichée : nette à tout zoom.
// Les textes (cotes, repères, noms) sont comparés un par un → liste écrite des modifications.

const _pdfDocs = new Map();
async function pdfDocOfFile(fileId) {
  if (!fileId || !pdfReady()) return null;
  if (_pdfDocs.has(fileId)) return _pdfDocs.get(fileId);
  const f = await DB.get('files', fileId); if (!f || !f.blob) return null;
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await f.blob.arrayBuffer()) }).promise;
  _pdfDocs.set(fileId, doc); return doc;
}
// page PDF d'un plan + k = pixels de l'image du plan par unité PDF
async function planPdfPage(plan) {
  try {
    const doc = await pdfDocOfFile(plan.pdfFileId); if (!doc) return null;
    const page = await doc.getPage(plan.pdfPage || 1), v1 = page.getViewport({ scale: 1 });
    return { page, k: plan.w / v1.width, v1 };
  } catch (e) { console.warn('pdf', e); return null; }
}
async function pageTexts(page, k) {
  const vp = page.getViewport({ scale: k }), tc = await page.getTextContent();
  return tc.items.filter(i => i.str && i.str.trim()).map(i => {
    const [x, y] = vp.convertToViewportPoint(i.transform[4], i.transform[5]);
    const h = Math.max(4, Math.hypot(i.transform[2], i.transform[3]) * k);
    return { s: i.str.trim().replace(/\s+/g, ' '), x, y, w: Math.max(4, (i.width || 0) * k), h };
  });
}
async function planTexts(plan) { const P = await planPdfPage(plan); return P ? pageTexts(P.page, P.k) : null; }

// ---------- Cartouche : « SUIVI DES MODIFICATIONS » → dernier indice, date, objet ----------
function cartoucheFromTexts(T) {
  if (!T || !T.length) return null;
  const DRX = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/;
  const IRX = /^(?:[A-Z]{1,3}\s?\d{0,3}|\d{1,3}|IND\.?\s?[A-Z0-9]{1,3})$/;
  const out = [];
  for (const d of T) {
    const m = d.s.match(DRX); if (!m) continue;
    let [, dd, mm, yy] = m; if (yy.length === 2) yy = '20' + yy; if (+mm > 12 || +dd > 31) continue;
    const iso = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    const line = T.filter(t => t !== d && Math.abs(t.y - d.y) < d.h * 0.7);
    const left = line.filter(t => t.x < d.x && d.x - t.x < d.h * 25 && IRX.test(t.s) && !/^(DATE|INDICE|IND)$/i.test(t.s)).sort((a, b) => b.x - a.x)[0];
    if (!left) continue;
    const desc = line.filter(t => t.x > d.x + d.w * 0.5 && t.x - d.x < d.h * 60 && !DRX.test(t.s)).sort((a, b) => a.x - b.x).map(t => t.s).join(' ').trim();
    out.push({ indice: left.s.replace(/^IND\.?\s?/i, '').replace(/\s+/g, ''), date: iso, desc: desc.slice(0, 120) });
  }
  if (!out.length) return null;
  out.sort((a, b) => b.date.localeCompare(a.date) || b.indice.localeCompare(a.indice, 'fr', { numeric: true }));
  return out[0];
}
async function cartoucheFromFile(file, pageNo = 1) {
  if (!pdfReady()) return null;
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const page = await doc.getPage(Math.min(pageNo, doc.numPages));
  return cartoucheFromTexts(await pageTexts(page, 1));
}
async function cartoucheOfPlan(plan) { const T = await planTexts(plan); return cartoucheFromTexts(T); }

// ---------- Recalage ancien → nouveau (textes identiques) ----------
// renvoie { sx, sy, ox, oy } : position de l'ancien plan dans les pixels du nouveau
async function planAlignMap(oldPlan, newPlan) {
  const base = { sx: newPlan.w / oldPlan.w, sy: newPlan.h / oldPlan.h, ox: 0, oy: 0 };
  try {
    const [A, B] = await Promise.all([planTexts(oldPlan), planTexts(newPlan)]);
    if (!A || !B) return base;
    const kx = base.sx, ky = base.sy;
    const cnt = (L) => { const m = new Map(); L.forEach(t => m.set(t.s, (m.get(t.s) || 0) + 1)); return m; };
    const ca = cnt(A), cb = cnt(B), dx = [], dy = [];
    for (const a of A) { if (a.s.length < 2 || ca.get(a.s) !== 1 || cb.get(a.s) !== 1) continue; const b = B.find(t => t.s === a.s); dx.push(b.x - a.x * kx); dy.push(b.y - a.y * ky); }
    if (dx.length < 4) return base;
    const med = (v) => v.sort((p, q) => p - q)[v.length >> 1];
    const ox = med(dx), oy = med(dy);
    return Math.abs(ox) < 2 && Math.abs(oy) < 2 ? base : { ...base, ox, oy };
  } catch (e) { return base; }
}

// ---------- Comparaison des textes : modifié / ajouté / supprimé / déplacé ----------
function textDiff(A, B, M) {
  const P = (a) => [a.x * M.sx + M.ox, a.y * M.sy + M.oy];
  const used = new Set(), out = [], ua = [];
  for (const a of A) {
    const [x, y] = P(a), tol = Math.max(6, a.h * M.sy * 0.6);
    const b = B.find(t => !used.has(t) && t.s === a.s && Math.abs(t.x - x) < tol && Math.abs(t.y - y) < tol);
    if (b) used.add(b); else ua.push(a);
  }
  const ub = B.filter(t => !used.has(t));
  const ub2 = new Set(ub);
  for (const a of ua) {
    const [x, y] = P(a), r = Math.max(10, a.h * M.sy * 1.6);
    const near = ub.filter(b => ub2.has(b) && Math.abs(b.y - y) < r && Math.abs(b.x - x) < Math.max(r * 2, a.w * M.sx));
    if (near.length) { const b = near.sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y))[0]; ub2.delete(b); out.push({ t: 'mod', a: a.s, b: b.s, x: b.x, y: b.y, w: Math.max(b.w, a.w * M.sx), h: b.h }); continue; }
    const mv = ub.find(b => ub2.has(b) && b.s === a.s && a.s.length >= 2);
    if (mv) { ub2.delete(mv); out.push({ t: 'mov', a: a.s, x: mv.x, y: mv.y, w: mv.w, h: mv.h, fx: x, fy: y }); continue; }
    out.push({ t: 'del', a: a.s, x, y, w: a.w * M.sx, h: a.h * M.sy });
  }
  for (const b of ub2) out.push({ t: 'add', b: b.s, x: b.x, y: b.y, w: b.w, h: b.h });
  out.sort((p, q) => (p.y - q.y) || (p.x - q.x));
  return out.slice(0, 400);
}
const TXT_LBL = { mod: '✏️ Modifié', add: '🟢 Ajouté', del: '🔴 Supprimé', mov: '↔ Déplacé' };
const txtLine = (c) => c.t === 'mod' ? `« ${c.a} » → « ${c.b} »` : c.t === 'add' ? `« ${c.b} »` : `« ${c.a} »`;

// ---------- Rendu net d'une zone d'un plan (PDF vectoriel si possible, sinon image pleine résolution) ----------
async function renderPlanRegion(plan, P, x0, y0, w, h, outW, outH, M, gpu) {
  const c = document.createElement('canvas'); c.width = outW; c.height = outH;
  const g = c.getContext('2d', gpu ? {} : { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, outW, outH);
  // (x0,y0,w,h) sont en pixels du NOUVEAU plan ; M place ce plan dans ce repère
  const s = outW / w;                                   // pixels écran par pixel du nouveau plan
  if (P) {
    const S = P.k * M.sx * s;                           // pixels écran par unité PDF de CE plan
    const vp = P.page.getViewport({ scale: S });
    const ox = (x0 - M.ox) * s, oy = (y0 - M.oy) * s;   // décalage dans le viewport
    await P.page.render({ canvasContext: g, viewport: vp, transform: [1, 0, 0, 1, -ox, -oy], background: 'white' }).promise;
  } else {
    const src = await fileURL(plan.fileId); const img = await loadImage(src);
    g.drawImage(img, (x0 - M.ox) / M.sx, (y0 - M.oy) / M.sy, w / M.sx, h / M.sy, 0, 0, outW, outH);
  }
  return c;
}
// superposition rapide (carte graphique) : supprimé en rouge, ajouté en vert (traits épais), inchangé en gris clair
function overlayCanvases(ca, cb) {
  const W = ca.width, H = ca.height, k = Math.max(1, Math.round(W / 1100)), tmp = [];
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; tmp.push(c); return c; };
  const cp = (src) => { const c = mk(); c.getContext('2d').drawImage(src, 0, 0); return c; };
  const op = (c, mode, fn) => { const g = c.getContext('2d'); g.globalCompositeOperation = mode; fn(g); g.globalCompositeOperation = 'source-over'; return c; };
  const thick = (c, r) => op(c, 'darken', g => { for (let i = 1; i <= r; i++) for (const [dx, dy] of [[i, 0], [-i, 0], [0, i], [0, -i]]) g.drawImage(c, dx, dy); });
  const fill = (c, mode, col) => op(c, mode, g => { g.fillStyle = col; g.fillRect(0, 0, W, H); });
  const mul = (dst, src) => op(dst, 'multiply', g => g.drawImage(src, 0, 0));
  const only = (a, b, col) => {   // traits de a absents de b (tolérance : b épaissi), en couleur sur fond blanc
    const m = fill(cp(a), 'difference', '#fff'); mul(m, thick(cp(b), k + 1));
    fill(m, 'difference', '#fff'); fill(m, 'color-dodge', '#808080'); for (let i = 0; i < 2; i++) mul(m, m);   // seuil : restes gris clairs → blanc, traits → noir
    thick(m, k); return fill(m, 'screen', col);
  };
  const rem = only(ca, cb, '#dc1f1f'), add = only(cb, ca, '#0a9a4a');
  fill(cb, 'screen', '#c4c4c4'); mul(cb, rem); mul(cb, add);
  tmp.forEach(c => { c.width = c.height = 0; }); ca.width = ca.height = 0;
  return cb;
}
function diffCanvases(ca, cb, mode) {
  const W = ca.width, H = ca.height, A = ca.getContext('2d').getImageData(0, 0, W, H).data, B = cb.getContext('2d').getImageData(0, 0, W, H).data;
  const n = W * H, a = new Uint8Array(n), b = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) { a[i] = (A[j] * 0.3 + A[j + 1] * 0.59 + A[j + 2] * 0.11) < 175 ? 1 : 0; b[i] = (B[j] * 0.3 + B[j + 1] * 0.59 + B[j + 2] * 0.11) < 175 ? 1 : 0; }
  const da = dilate(a, W, H, 1), db = dilate(b, W, H, 1);
  const rem = new Uint8Array(n), add = new Uint8Array(n);
  for (let i = 0; i < n; i++) { if (a[i] && !db[i]) rem[i] = 1; else if (b[i] && !da[i]) add[i] = 1; }
  const R = dilate(rem, W, H, 1), G = dilate(add, W, H, 1);   // traits rouges / verts épaissis pour être bien visibles
  const out = new ImageData(W, H), o = out.data;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    let r = 255, g = 255, bb = 255;
    if (R[i]) { r = 220; g = 30; bb = 30; } else if (G[i]) { r = 16; g = 160; bb = 70; } else if (a[i] || b[i]) { r = g = bb = mode === 'dim' ? 200 : 140; }
    o[j] = r; o[j + 1] = g; o[j + 2] = bb; o[j + 3] = 255;
  }
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(out, 0, 0); return c;
}

// ---------- Écran de comparaison (remplace la version image) ----------
// ---------- structure seule (comparaison de niveaux) ----------
const STRUCT_LAY = /voil|pot|corb|pout|b[eé]ton|(^|[^a-z])ba([^a-z]|$)|struct|coffr|(^|[^a-z])mur|dall|acrot|longr|semel|raid|chain|lint|escal|palier|gradin|radier/i;
const NOSTRUCT_LAY = /cot|dim|txt|text|axe|axis|cart|cadre|titre|mob|meub|plomb|elec|sanit|fen|port|menuis|legend|nomencl|grille|hab|annot/i;
function bErode(m, W, H, r) { const n = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) n[i] = m[i] ? 0 : 1; const d = dilate(n, W, H, r); for (let i = 0; i < m.length; i++) d[i] = d[i] ? 0 : 1; return d; }
const bClose = (m, W, H, r) => bErode(dilate(m, W, H, r), W, H, r), bOpen = (m, W, H, r) => dilate(bErode(m, W, H, r), W, H, r);
async function structMap(plan, W, H, k, place, imgData) {
  const sc = place ? place.w / plan.w : k, ox = place ? place.x : 0, oy = place ? place.y : 0;
  const cv = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); return [c, g]; };
  // 1) plans AutoCAD : hachures pleines + contours fermés des calques de structure
  if (plan.dwgFileId || plan.dxfFileId) { try { const D = await cadOfPlan(plan);
    if (D && D.prims && D.box) { const s = plan.w / (D.box[2] - D.box[0]), T = (q) => [ox + (q[0] - D.box[0]) * s * sc, oy + (D.box[3] - q[1]) * s * sc];
      const [c, g] = cv(); g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineWidth = 1.6; let n = 0;
      const path = (P) => { g.beginPath(); P.forEach((q, i) => { const [x, y] = T(q); i ? g.lineTo(x, y) : g.moveTo(x, y); }); };
      for (const p of D.prims) { const L = String(p.layer || ''); if (p.t === 'tx' || NOSTRUCT_LAY.test(L)) continue; const st = STRUCT_LAY.test(L);
        if (p.t === 'fl') { for (const P of p.loops) { path(P); g.closePath(); g.fill(); } n++; }
        else if (p.t === 'pl' && st) { path(p.pts); if (p.closed) { g.closePath(); g.fill(); } else g.stroke(); n++; } }
      if (n > 3) return bClose(inkMap(g.getImageData(0, 0, W, H)), W, H, Math.max(1, Math.round(W / 900)));
      // calques sans nom de structure : tout le dessin SAUF textes et cotes, puis on garde les masses
      const [c2, g2] = cv(); g2.fillStyle = g2.strokeStyle = '#000'; g2.lineWidth = 1.2; 
      for (const p of D.prims) { if (p.t === 'tx' || NOSTRUCT_LAY.test(String(p.layer || ''))) continue;
        if (p.t === 'fl') for (const P of p.loops) { g2.beginPath(); P.forEach((q, i) => { const [x, y] = T(q); i ? g2.lineTo(x, y) : g2.moveTo(x, y); }); g2.closePath(); g2.fill(); }
        else if (p.t === 'pl') { g2.beginPath(); p.pts.forEach((q, i) => { const [x, y] = T(q); i ? g2.lineTo(x, y) : g2.moveTo(x, y); }); if (p.closed) g2.closePath(); g2.stroke(); } }
      const r0 = Math.max(1, Math.round(W / 700)); return bOpen(bClose(inkMap(g2.getImageData(0, 0, W, H)), W, H, r0 + 1), W, H, r0); } } catch (e) { console.warn('struct cad', e); } }
  // 2) PDF vectoriel : rendu sans les textes, puis on garde les masses (hachures remplies, traits fins enlevés)
  let m = null;
  try { const P = await planPdfPage(plan); if (P) { const [c, g] = cv(); g.fillText = g.strokeText = () => {};
    await P.page.render({ canvasContext: g, viewport: P.page.getViewport({ scale: P.k * sc }), transform: [1, 0, 0, 1, ox, oy], background: 'white' }).promise; m = inkMap(g.getImageData(0, 0, W, H)); } } catch (e) { console.warn('struct pdf', e); }
  // 3) image : même traitement (les textes peuvent rester en partie)
  if (!m) m = inkMap(imgData);
  const r = Math.max(1, Math.round(W / 700));
  return bOpen(bClose(m, W, H, r + 1), W, H, r);
}
async function openPlanCompare(oldPlan, newPlan, opts = {}) {
  if (!oldPlan || !newPlan) return;
  const LV = !!opts.levels;   // comparaison entre deux niveaux (étage du dessous → étage du dessus)
  const ld = loading(LV ? 'Superposition des deux niveaux…' : 'Comparaison des indices…');
  let D, M, PA, PB, TX = [];
  let sens = +(localStorage.getItem('cmp.sens') || 1);
  try {
    [PA, PB] = await Promise.all([planPdfPage(oldPlan), planPdfPage(newPlan)]);
    M = (LV && await cadAlignMap(oldPlan, newPlan)) || await planAlignMap(oldPlan, newPlan);
    ld.set(LV ? 'Recherche de ce qui continue / s\'arrête…' : 'Recherche des modifications…');
    D = await planDiff(oldPlan, newPlan, LV ? 2600 : 2000, { map: M, sens, struct: LV });
    if (PA && PB && !LV) { ld.set('Lecture des textes et des cotes…'); const [A, B] = await Promise.all([pageTexts(PA.page, PA.k), pageTexts(PB.page, PB.k)]); TX = textDiff(A, B, M); }
  } catch (e) { ld.close(); return alertBox('Comparaison impossible : ' + (e.message || e)); }
  const [srcOld, srcNew] = await Promise.all([fileURL(oldPlan.fileId), fileURL(newPlan.fileId)]);
  ld.close();
  let diffURL = URL.createObjectURL(await new Promise(r => D.canvas.toBlob(r, 'image/png'))); D.canvas.width = D.canvas.height = 0;
  const W = newPlan.w, H = newPlan.h, vec = !!(PA && PB);
  let mode = 'diff', boxes = true, hdT = 0, hdSeq = 0;
  const iA = LV ? opts.la : planIndice(oldPlan), iB = LV ? opts.lb : planIndice(newPlan);
  const el = document.createElement('div'); el.className = 'fullpage av-page';
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button>
      <div class="tb-title" style="flex:1"><b>${LV ? `Niveaux ${esc(iA)} ↔ ${esc(iB)}` : esc(newPlan.name)}</b><span>${LV ? `${esc(oldPlan.name)} sous ${esc(newPlan.name)}` : `Comparaison indice ${esc(iA)} → ${esc(iB)}`}${vec ? ' · vectoriel' : ''}</span></div>
      ${LV ? `<button class="iconbtn" data-a="recal" title="Recaler (1 point commun)">🎯</button>` : ''}
      <button class="iconbtn" data-a="sens" title="Sensibilité">${icon('settings')}</button><button class="iconbtn" data-a="share" title="Partager">${icon('share')}</button></div>
    <div class="av-chips cmp-modes"><button data-m="diff" class="on">Superposition</button><button data-m="old">${LV ? '' : 'Ind. '}${esc(iA)}</button><button data-m="new">${LV ? '' : 'Ind. '}${esc(iB)}</button><button data-m="box" class="on">▢ Zones</button></div>
    <div class="av-view"><div class="av-stage"><img width="${W}" height="${H}" src="${diffURL}"><canvas class="cmp-hd"></canvas><svg class="av-ov" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"></svg></div></div>
    <div class="cmp-legend">${LV ? `<span><i style="background:#dc2626"></i>S'arrête en ${esc(iA)}</span><span><i style="background:#16a34a"></i>Nouveau en ${esc(iB)}</span><span><i style="background:#5f5f5f"></i>Continue</span><span><i style="background:#d7d7d7"></i>Textes, cotes (ignorés)</span>` : `<span><i style="background:#dc2626"></i>Supprimé</span><span><i style="background:#16a34a"></i>Ajouté</span><span><i style="background:#8c8c8c"></i>Inchangé</span>`}
      <button class="btn small" data-a="list">${D.rects.length} zone(s)${TX.length ? ' · ' + TX.length + ' texte(s)' : ''}</button></div>`;
  document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); try { URL.revokeObjectURL(diffURL); hd.width = hd.height = 0; } catch (e) {} };
  const view = $('.av-view', el), stage = $('.av-stage', el), img = $('img', stage), ov = $('.av-ov', el), hd = $('.cmp-hd', el);
  hd.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;display:none';
  let focusI = -1;
  const drawBoxes = (s) => {
    const lw = 2.5 / s, fs = 14 / s;
    ov.innerHTML = !boxes ? '' : D.rects.map((q, i) => `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="none" stroke="#ef4444" stroke-width="${lw}" stroke-dasharray="${6 / s} ${4 / s}" rx="${4 / s}"/>
      <g transform="translate(${q.x},${q.y})"><circle r="${11 / s}" fill="#ef4444"/><text y="${4.5 / s}" text-anchor="middle" font-size="${fs * 0.85}" font-weight="700" fill="#fff" font-family="Arial">${i + 1}</text></g>`).join('')
      + TX.map((c, i) => `<rect x="${c.x - 3 / s}" y="${c.y - c.h - 3 / s}" width="${c.w + 6 / s}" height="${c.h + 6 / s}" fill="none" stroke="${c.t === 'add' ? '#16a34a' : c.t === 'del' ? '#dc2626' : '#f59e0b'}" stroke-width="${(focusI === i ? 4 : 1.8) / s}" rx="${3 / s}"/>`).join('');
  };
  // rendu net de la zone visible (avec une marge : un petit déplacement ne relance pas le rendu)
  let last = null, busy = false, again = false;
  const visible = () => { const r = view.getBoundingClientRect(), [ax, ay] = pz.toImg([0, 0]), [bx, by] = pz.toImg([r.width, r.height]); return { x0: Math.max(0, ax), y0: Math.max(0, ay), x1: Math.min(W, bx), y1: Math.min(H, by), s: pz.st.s }; };
  const covered = (v) => last && last.mode === mode && v.x0 >= last.x0 && v.y0 >= last.y0 && v.x1 <= last.x1 && v.y1 <= last.y1 && Math.abs(Math.log(v.s / last.s)) < 0.22;
  const renderHD = async () => {
    if (busy) { again = true; return; }
    if (LV && mode === 'diff') { hd.style.display = 'none'; last = null; return; }   // niveaux : la superposition « structure seule » reste affichée
    const v = visible(), st = pz.st;
    if (v.x1 - v.x0 < 4 || v.y1 - v.y0 < 4 || st.s < st.fit * 1.15) { hd.style.display = 'none'; last = null; return; }   // vue d'ensemble : l'image suffit
    if (covered(v)) { hd.style.display = ''; return; }
    busy = true; const seq = ++hdSeq;
    const mw = (v.x1 - v.x0) * 0.3, mh = (v.y1 - v.y0) * 0.3;
    const x0 = Math.max(0, v.x0 - mw), y0 = Math.max(0, v.y0 - mh), x1 = Math.min(W, v.x1 + mw), y1 = Math.min(H, v.y1 + mh);
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let outW = Math.round((x1 - x0) * st.s * dpr), outH = Math.round((y1 - y0) * st.s * dpr);
    const cap = Math.min(1, 2000 / Math.max(outW, outH), Math.sqrt(2.4e6 / (outW * outH))); if (cap < 1) { outW = Math.round(outW * cap); outH = Math.round(outH * cap); }
    try {
      const I = { sx: 1, sy: 1, ox: 0, oy: 0 };
      let c;
      if (mode === 'old') c = await renderPlanRegion(oldPlan, PA, x0, y0, x1 - x0, y1 - y0, outW, outH, M, true);
      else if (mode === 'new') c = await renderPlanRegion(newPlan, PB, x0, y0, x1 - x0, y1 - y0, outW, outH, I, true);
      else { const ca = await renderPlanRegion(oldPlan, PA, x0, y0, x1 - x0, y1 - y0, outW, outH, M, true); const cb = await renderPlanRegion(newPlan, PB, x0, y0, x1 - x0, y1 - y0, outW, outH, I, true); c = overlayCanvases(ca, cb); }
      if (seq === hdSeq && el.isConnected) {
        hd.width = c.width; hd.height = c.height; hd.getContext('2d').drawImage(c, 0, 0);
        hd.style.left = x0 + 'px'; hd.style.top = y0 + 'px'; hd.style.width = (x1 - x0) + 'px'; hd.style.height = (y1 - y0) + 'px'; hd.style.display = '';
        last = { mode, x0, y0, x1, y1, s: st.s };
      }
      c.width = c.height = 0;
    } catch (e) { console.warn('hd', e); }
    finally { busy = false; if (again) { again = false; clearTimeout(hdT); hdT = setTimeout(renderHD, 120); } }
  };
  const pz = panZoom(view, stage, W, H, { onChange: (st) => { drawBoxes(st.s); clearTimeout(hdT); const v = visible(); if (!covered(v)) { if (last && Math.abs(Math.log(st.s / last.s)) >= 0.22) hd.style.display = 'none'; hdT = setTimeout(renderHD, 350); } } });
  requestAnimationFrame(pz.fit);
  const setMode = (m) => { mode = m; last = null; hd.style.display = 'none'; img.src = m === 'old' ? srcOld : m === 'new' ? srcNew : diffURL; $$('[data-m]', el).forEach(b => b.classList.toggle('on', b.dataset.m === mode || (b.dataset.m === 'box' && boxes))); clearTimeout(hdT); hdT = setTimeout(renderHD, 50); };
  $$('[data-m]', el).forEach(b => b.onclick = () => { if (b.dataset.m === 'box') { boxes = !boxes; drawBoxes(pz.st.s); setMode(mode); } else setMode(b.dataset.m); });
  $('[data-a=list]', el).onclick = () => {
    if (!D.rects.length && !TX.length) return toast('Aucune modification détectée');
    const s = sheet(`<div class="cmp-list">${TX.length ? `<div class="cmp-h">Textes et cotes (${TX.length})</div>${TX.map((c, i) => `<button class="cmp-it" data-t="${i}"><span class="k k-${c.t}">${TXT_LBL[c.t]}</span><span class="grow">${esc(txtLine(c))}</span></button>`).join('')}` : ''}
      ${D.rects.length ? `<div class="cmp-h">Zones de dessin modifiées (${D.rects.length})</div>${D.rects.map((q, i) => `<button class="cmp-it" data-z="${i}"><span class="k k-z">${i + 1}</span><span class="grow">Zone ${i + 1}</span></button>`).join('')}` : ''}</div>`, { title: `Modifications ${iA} → ${iB}` });
    $$('[data-t]', s.el).forEach(b => b.onclick = () => { const c = TX[+b.dataset.t]; focusI = +b.dataset.t; s.close(); pz.zoomTo(c.x - c.h * 3, c.y - c.h * 3, c.w + c.h * 6, c.h * 7); });
    $$('[data-z]', s.el).forEach(b => b.onclick = () => { const q = D.rects[+b.dataset.z]; focusI = -1; s.close(); pz.zoomTo(q.x, q.y, q.w, q.h); });
  };
  $('[data-a=sens]', el).onclick = async () => {
    const v = await menu('Sensibilité de la détection', [{ label: 'Tout (même les petits détails)', value: '0.45', checked: sens === 0.45 }, { label: 'Normale', value: '1', checked: sens === 1 }, { label: 'Seulement les grosses modifications', value: '2', checked: sens === 2 }]);
    if (!v) return; sens = +v; try { localStorage.setItem('cmp.sens', v); } catch (e) {}
    const l2 = loading('Recherche des modifications…'); try { D = await planDiff(oldPlan, newPlan, LV ? 2600 : 2000, { map: M, sens, struct: LV }); } finally { l2.close(); }
    try { URL.revokeObjectURL(diffURL); } catch (e) {} diffURL = URL.createObjectURL(await new Promise(r => D.canvas.toBlob(r, 'image/png'))); D.canvas.width = D.canvas.height = 0; if (mode === 'diff') img.src = diffURL;
    $('[data-a=list]', el).textContent = `${D.rects.length} zone(s)${TX.length ? ' · ' + TX.length + ' texte(s)' : ''}`; drawBoxes(pz.st.s);
  };
  const rc = $('[data-a=recal]', el); if (rc) rc.onclick = async () => {
    // toucher un repère (croisement d'axes, angle de poteau…) sur le niveau du dessous, puis le même sur celui du dessus
    const tapOn = (m, msg) => new Promise(res => { setMode(m); toast(msg); const h = (e) => { if (e.target.closest('.topbar, .cmp-legend, .cmp-modes')) return; view.removeEventListener('click', h, true); e.stopPropagation(); const r = view.getBoundingClientRect(); res(pz.toImg([e.clientX - r.left, e.clientY - r.top])); }; setTimeout(() => view.addEventListener('click', h, true), 50); });
    const A = await tapOn('old', `1/2 · Touchez un repère sur ${iA} (croisement d'axes…)`);
    const B = await tapOn('new', `2/2 · Touchez le même repère sur ${iB}`);
    const ax = A[0] * oldPlan.w / W, ay = A[1] * oldPlan.h / H;
    M = { ...M, ox: B[0] - ax * M.sx, oy: B[1] - ay * M.sy };
    const l2 = loading('Nouvelle superposition…'); try { D = await planDiff(oldPlan, newPlan, LV ? 2600 : 2000, { map: M, sens, struct: LV }); } finally { l2.close(); }
    try { URL.revokeObjectURL(diffURL); } catch (e) {} diffURL = URL.createObjectURL(await new Promise(r => D.canvas.toBlob(r, 'image/png'))); D.canvas.width = D.canvas.height = 0;
    $('[data-a=list]', el).textContent = `${D.rects.length} zone(s)${TX.length ? ' · ' + TX.length + ' texte(s)' : ''}`; setMode('diff'); drawBoxes(pz.st.s); toast('Recalé ✓');
  };
  $('[data-a=share]', el).onclick = async () => {
    const l3 = loading('Préparation…');
    try {
      const k = Math.min(1, 3200 / Math.max(W, H)), ow = Math.round(W * k), oh = Math.round(H * k);
      const [ca, cb] = await Promise.all([renderPlanRegion(oldPlan, PA, 0, 0, W, H, ow, oh, M), renderPlanRegion(newPlan, PB, 0, 0, W, H, ow, oh, { sx: 1, sy: 1, ox: 0, oy: 0 })]);
      const d = diffCanvases(ca, cb);
      const c = document.createElement('canvas'); c.width = ow; c.height = oh + 70; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(d, 0, 70);
      g.fillStyle = '#111'; g.font = 'bold 30px Arial'; g.fillText(LV ? `Niveaux ${iA} (dessous) → ${iB} (dessus) — rouge : s'arrête · vert : nouveau` : `${newPlan.name} — indice ${iA} → ${iB}`, 16, 44);
      g.strokeStyle = '#ef4444'; g.lineWidth = 3; g.fillStyle = '#ef4444'; g.font = 'bold 22px Arial';
      D.rects.forEach((q, i) => { g.strokeRect(q.x * k, q.y * k + 70, q.w * k, q.h * k); g.fillText(String(i + 1), q.x * k + 4, q.y * k + 70 + 22); });
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
      l3.close();
      await shareBlob(blob, `${newPlan.name} - comparaison ${iA}-${iB}.jpg`.replace(/[\\/:*?"<>|]+/g, '-'));
      if (TX.length) shareWhatsApp(`*${newPlan.name}* — modifications indice ${iA} → ${iB}\n` + TX.slice(0, 60).map(c => `${TXT_LBL[c.t]} : ${txtLine(c)}`).join('\n'));
    } catch (e) { l3.close(); alertBox('Partage impossible : ' + (e.message || e)); }
  };
}

// ---------- Barre « indice » en bas du plan ----------
async function planIndiceBar(el, plan, ctx, close) {
  if (typeof planHistory !== 'function') return;
  // indice lu automatiquement dans le cartouche (une seule fois par plan)
  if (!plan.cartRead && (plan.pdfFileId || plan.dxfFileId) && (!plan.indiceDate || !plan.indice || plan.indice === 'A')) {
    plan.cartRead = true;
    cartoucheOfPlan(plan).then(async c => { if (c) { if (c.indice) plan.indice = c.indice; if (c.date) plan.indiceDate = c.date; if (c.desc && !plan.indiceNote) plan.indiceNote = c.desc; } await DB.put('plans', plan); if (c && el.isConnected) { const o = $('.ind-pill', el); if (o) o.remove(); planIndiceBar(el, plan, ctx, close); } }).catch(() => DB.put('plans', plan).catch(() => {}));
  }
  const hist = await planHistory(plan); if (!el.isConnected) return;
  const lab = (p) => `${planIndice(p)}${p.indiceDate ? '  ' + fmtDate(p.indiceDate) : ''}`;
  const viewer = $('.viewer', el); if (!viewer) return;
  const pill = document.createElement('div'); pill.className = 'ind-pill' + (isCurrentPlan(plan) ? '' : ' old');
  pill.innerHTML = `<button class="ip-t">${esc(lab(plan))}</button><button class="ip-a">${icon('chevup')}</button>`;
  viewer.appendChild(pill);
  ['pointerdown', 'pointerup', 'click'].forEach(ev => pill.addEventListener(ev, e => e.stopPropagation()));
  pill.onclick = async () => {
    const v = await menu('Indices du plan', [
      ...hist.slice().reverse().map(p => ({ label: `${lab(p)}${p.indiceNote ? ' · ' + p.indiceNote : ''}`, icon: p.id === plan.id ? 'check' : 'plans', value: 'o:' + p.id, checked: p.id === plan.id })),
      ...(hist.length > 1 ? [{ label: 'Comparer avec l’indice précédent', icon: 'layers', value: 'cmp' }] : []),
      { label: 'Nouvel indice, modifier, lire les cartouches…', icon: 'more', value: 'more' }]);
    if (!v) return;
    if (v === 'cmp') { const prev = hist.find(p => p.id === plan.prevId) || hist[hist.length - 2]; return openPlanCompare(prev, plan); }
    if (v === 'more') return planIndicesMenu(plan, { onNew: (np) => { close(); openPlanViewer(np, ctx); }, onOpen: (p2) => { if (p2.id !== plan.id) { close(); openPlanViewer(p2, ctx); } } });
    const p2 = hist.find(p => 'o:' + p.id === v); if (p2 && p2.id !== plan.id) { close(); openPlanViewer(p2, ctx); }
  };
}

// ---------- Superposition de deux niveaux : recalage par les coordonnées AutoCAD (même origine) ----------
async function cadAlignMap(oldPlan, newPlan) {
  if (!(oldPlan.dwgFileId || oldPlan.dxfFileId) || !(newPlan.dwgFileId || newPlan.dxfFileId)) return null;
  try {
    const [A, B] = await Promise.all([cadOfPlan(oldPlan), cadOfPlan(newPlan)]);
    const sa = oldPlan.w / (A.box[2] - A.box[0]), sb = newPlan.w / (B.box[2] - B.box[0]);
    const M = { sx: sb / sa, sy: sb / sa, ox: (A.box[0] - B.box[0]) * sb, oy: (B.box[3] - A.box[3]) * sb };
    // dessins sans origine commune (très éloignés) → on garde le recalage par les textes
    const far = Math.abs(M.ox) > newPlan.w * 0.9 || Math.abs(M.oy) > newPlan.h * 0.9; return far ? null : M;
  } catch (e) { return null; }
}
async function levelCompareFrom(plan) {
  const all = (await DB.byProject('plans', plan.projectId)).filter(p => p.id !== plan.id && (typeof isCurrentPlan !== 'function' || isCurrentPlan(p)));
  const folders = await DB.byProject('folders', plan.projectId), fn = (p) => (folders.find(f => f.id === p.folderId) || {}).name || '';
  const niv = (p) => nivOfFolder(fn(p)) || nivOfFolder(p.name) || '';
  const rank = (n) => { const m = String(n).match(/R\+?(\d+)/i); return /ssl|ss\d*|sous/i.test(n) ? -2 : /fond/i.test(n) ? -3 : /rdc/i.test(n) ? 0 : /mezz/i.test(n) ? -1 : /terr/i.test(n) ? 99 : m ? +m[1] : null; };
  const me = niv(plan), rm = rank(me);
  const sim = (p) => { const a = normQ(plan.name).replace(/r\s?\+?\s?\d+|rdc|ssl|mezz\w*|niveau|niv/g, ''), b = normQ(p.name).replace(/r\s?\+?\s?\d+|rdc|ssl|mezz\w*|niveau|niv/g, ''); let k = 0; for (const w of a.split(/\W+/)) if (w.length > 2 && b.includes(w)) k++; return k; };
  const cand = all.filter(p => niv(p) !== me || !me).sort((x, y) => (rm != null && rank(niv(x)) != null ? Math.abs(rank(niv(x)) - rm) : 9) - (rm != null && rank(niv(y)) != null ? Math.abs(rank(niv(y)) - rm) : 9) || sim(y) - sim(x) || (x.name || '').localeCompare(y.name || '', 'fr', { numeric: true }));
  if (!cand.length) return toast('Aucun autre plan dans le projet');
  const id = await menu(`Comparer ${me || plan.name} avec…`, cand.slice(0, 40).map(p => ({ label: `${niv(p) ? niv(p) + ' · ' : ''}${p.name}`, icon: p.dwgFileId || p.dxfFileId ? 'cad' : 'plans', value: p.id })));
  const other = cand.find(p => p.id === id); if (!other) return;
  const ro = rank(niv(other));
  let low = plan, up = other;
  if (rm != null && ro != null) { if (ro < rm) { low = other; up = plan; } }
  else { const v = await menu('Lequel est en dessous ?', [{ label: `${niv(plan) || plan.name} (dessous)`, value: 'a' }, { label: `${niv(other) || other.name} (dessous)`, value: 'b' }]); if (!v) return; if (v === 'b') { low = other; up = plan; } }
  return openLevelCompare(low, up, { la: niv(low) || low.name, lb: niv(up) || up.name });
}
