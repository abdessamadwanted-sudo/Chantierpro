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
async function renderPlanRegion(plan, P, x0, y0, w, h, outW, outH, M) {
  const c = document.createElement('canvas'); c.width = outW; c.height = outH;
  const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, outW, outH);
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
async function openPlanCompare(oldPlan, newPlan) {
  if (!oldPlan || !newPlan) return;
  const ld = loading('Comparaison des indices…');
  let D, M, PA, PB, TX = [];
  let sens = +(localStorage.getItem('cmp.sens') || 1);
  try {
    [PA, PB] = await Promise.all([planPdfPage(oldPlan), planPdfPage(newPlan)]);
    M = await planAlignMap(oldPlan, newPlan);
    ld.set('Recherche des modifications…');
    D = await planDiff(oldPlan, newPlan, 2600, { map: M, sens });
    if (PA && PB) { ld.set('Lecture des textes et des cotes…'); const [A, B] = await Promise.all([pageTexts(PA.page, PA.k), pageTexts(PB.page, PB.k)]); TX = textDiff(A, B, M); }
  } catch (e) { ld.close(); return alertBox('Comparaison impossible : ' + (e.message || e)); }
  const [srcOld, srcNew] = await Promise.all([fileURL(oldPlan.fileId), fileURL(newPlan.fileId)]);
  ld.close();
  const diffURL = D.canvas.toDataURL('image/png');
  const W = newPlan.w, H = newPlan.h, vec = !!(PA && PB);
  let mode = 'diff', boxes = true, hdT = 0, hdSeq = 0;
  const iA = planIndice(oldPlan), iB = planIndice(newPlan);
  const el = document.createElement('div'); el.className = 'fullpage av-page';
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button>
      <div class="tb-title" style="flex:1"><b>${esc(newPlan.name)}</b><span>Comparaison indice ${esc(iA)} → ${esc(iB)}${vec ? ' · vectoriel' : ''}</span></div>
      <button class="iconbtn" data-a="sens" title="Sensibilité">${icon('settings')}</button><button class="iconbtn" data-a="share" title="Partager">${icon('share')}</button></div>
    <div class="av-chips cmp-modes"><button data-m="diff" class="on">Superposition</button><button data-m="old">Ind. ${esc(iA)}</button><button data-m="new">Ind. ${esc(iB)}</button><button data-m="box" class="on">▢ Zones</button></div>
    <div class="av-view"><div class="av-stage"><img width="${W}" height="${H}" src="${diffURL}"><canvas class="cmp-hd"></canvas><svg class="av-ov" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"></svg></div></div>
    <div class="cmp-legend"><span><i style="background:#dc2626"></i>Supprimé</span><span><i style="background:#16a34a"></i>Ajouté</span><span><i style="background:#8c8c8c"></i>Inchangé</span>
      <button class="btn small" data-a="list">${D.rects.length} zone(s)${TX.length ? ' · ' + TX.length + ' texte(s)' : ''}</button></div>`;
  document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
  const view = $('.av-view', el), stage = $('.av-stage', el), img = $('img', stage), ov = $('.av-ov', el), hd = $('.cmp-hd', el);
  hd.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;display:none';
  let focusI = -1;
  const drawBoxes = (s) => {
    const lw = 2.5 / s, fs = 14 / s;
    ov.innerHTML = !boxes ? '' : D.rects.map((q, i) => `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="none" stroke="#ef4444" stroke-width="${lw}" stroke-dasharray="${6 / s} ${4 / s}" rx="${4 / s}"/>
      <g transform="translate(${q.x},${q.y})"><circle r="${11 / s}" fill="#ef4444"/><text y="${4.5 / s}" text-anchor="middle" font-size="${fs * 0.85}" font-weight="700" fill="#fff" font-family="Arial">${i + 1}</text></g>`).join('')
      + TX.map((c, i) => `<rect x="${c.x - 3 / s}" y="${c.y - c.h - 3 / s}" width="${c.w + 6 / s}" height="${c.h + 6 / s}" fill="none" stroke="${c.t === 'add' ? '#16a34a' : c.t === 'del' ? '#dc2626' : '#f59e0b'}" stroke-width="${(focusI === i ? 4 : 1.8) / s}" rx="${3 / s}"/>`).join('');
  };
  // rendu net de la zone visible
  const renderHD = async () => {
    const seq = ++hdSeq, st = pz.st, r = view.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const [ax, ay] = pz.toImg([0, 0]), [bx, by] = pz.toImg([r.width, r.height]);
    const x0 = Math.max(0, ax), y0 = Math.max(0, ay), x1 = Math.min(W, bx), y1 = Math.min(H, by);
    if (x1 - x0 < 4 || y1 - y0 < 4 || st.s < st.fit * 1.15) { hd.style.display = 'none'; return; }   // vue d'ensemble : l'image suffit
    let outW = Math.round((x1 - x0) * st.s * dpr), outH = Math.round((y1 - y0) * st.s * dpr);
    const cap = 2600 / Math.max(outW, outH); if (cap < 1) { outW = Math.round(outW * cap); outH = Math.round(outH * cap); }
    try {
      const I = { sx: 1, sy: 1, ox: 0, oy: 0 };
      let c;
      if (mode === 'old') c = await renderPlanRegion(oldPlan, PA, x0, y0, x1 - x0, y1 - y0, outW, outH, M);
      else if (mode === 'new') c = await renderPlanRegion(newPlan, PB, x0, y0, x1 - x0, y1 - y0, outW, outH, I);
      else { const [ca, cb] = await Promise.all([renderPlanRegion(oldPlan, PA, x0, y0, x1 - x0, y1 - y0, outW, outH, M), renderPlanRegion(newPlan, PB, x0, y0, x1 - x0, y1 - y0, outW, outH, I)]); c = diffCanvases(ca, cb); }
      if (seq !== hdSeq) return;
      hd.width = c.width; hd.height = c.height; hd.getContext('2d').drawImage(c, 0, 0);
      hd.style.left = x0 + 'px'; hd.style.top = y0 + 'px'; hd.style.width = (x1 - x0) + 'px'; hd.style.height = (y1 - y0) + 'px'; hd.style.display = '';
    } catch (e) { console.warn('hd', e); }
  };
  const pz = panZoom(view, stage, W, H, { onChange: (st) => { drawBoxes(st.s); clearTimeout(hdT); hd.style.display = 'none'; hdT = setTimeout(renderHD, 220); } });
  requestAnimationFrame(pz.fit);
  const setMode = (m) => { mode = m; img.src = m === 'old' ? srcOld : m === 'new' ? srcNew : diffURL; $$('[data-m]', el).forEach(b => b.classList.toggle('on', b.dataset.m === mode || (b.dataset.m === 'box' && boxes))); clearTimeout(hdT); hdT = setTimeout(renderHD, 50); };
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
    const l2 = loading('Recherche des modifications…'); try { D = await planDiff(oldPlan, newPlan, 2600, { map: M, sens }); } finally { l2.close(); }
    $('[data-a=list]', el).textContent = `${D.rects.length} zone(s)${TX.length ? ' · ' + TX.length + ' texte(s)' : ''}`; drawBoxes(pz.st.s);
  };
  $('[data-a=share]', el).onclick = async () => {
    const l3 = loading('Préparation…');
    try {
      const k = Math.min(1, 3200 / Math.max(W, H)), ow = Math.round(W * k), oh = Math.round(H * k);
      const [ca, cb] = await Promise.all([renderPlanRegion(oldPlan, PA, 0, 0, W, H, ow, oh, M), renderPlanRegion(newPlan, PB, 0, 0, W, H, ow, oh, { sx: 1, sy: 1, ox: 0, oy: 0 })]);
      const d = diffCanvases(ca, cb);
      const c = document.createElement('canvas'); c.width = ow; c.height = oh + 70; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(d, 0, 70);
      g.fillStyle = '#111'; g.font = 'bold 30px Arial'; g.fillText(`${newPlan.name} — indice ${iA} → ${iB}`, 16, 44);
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
  const hist = await planHistory(plan); if (!el.isConnected) return;
  const cur = hist.find(isCurrentPlan) || plan, old = !isCurrentPlan(plan);
  const lab = (p) => `Indice ${planIndice(p)}${p.indiceDate ? ' · ' + fmtDate(p.indiceDate) : ''}`;
  const bar = document.createElement('button'); bar.className = 'ind-bar' + (old ? ' old' : '');
  bar.innerHTML = old ? `⚠️ <span class="grow"><span>Ancien ${esc(lab(plan))}</span><small>Touchez pour revenir à l’indice actuel ${esc(planIndice(cur))}</small></span>`
    : `📐 <span class="grow"><span>${esc(lab(plan))} <i>(actuel)</i></span>${hist.length > 1 ? `<small>${hist.length} indices · touchez pour voir les anciens</small>` : ''}</span>${hist.length > 1 ? icon('chevup') : ''}`;
  const bottom = $('.viewer-bottom', el); if (!bottom) return;
  bottom.parentNode.insertBefore(bar, bottom);
  bar.onclick = async () => {
    if (old) { close(); return openPlanViewer(cur, ctx); }
    if (hist.length < 2) return planIndicesMenu(plan, { onNew: (np) => { close(); openPlanViewer(np, ctx); } });
    const v = await menu('Indices du plan', [
      ...hist.slice().reverse().map(p => ({ label: `${lab(p)}${isCurrentPlan(p) ? ' (actuel)' : ''}${p.indiceNote ? ' · ' + p.indiceNote : ''}`, icon: isCurrentPlan(p) ? 'check' : 'history', value: 'o:' + p.id })),
      { label: 'Comparer avec l’indice précédent', icon: 'layers', value: 'cmp' },
      { label: 'Autres actions (nouvel indice, modifier, cartouches)…', icon: 'more', value: 'more' }]);
    if (!v) return;
    if (v === 'cmp') { const prev = hist.find(p => p.id === plan.prevId) || hist[hist.length - 2]; return openPlanCompare(prev, plan); }
    if (v === 'more') return planIndicesMenu(plan, { onNew: (np) => { close(); openPlanViewer(np, ctx); }, onOpen: (p2) => { if (p2.id !== plan.id) { close(); openPlanViewer(p2, ctx); } } });
    const p2 = hist.find(p => 'o:' + p.id === v); if (p2 && p2.id !== plan.id) { close(); openPlanViewer(p2, ctx); }
  };
}
