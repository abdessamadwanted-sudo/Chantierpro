// ================= Scanner de documents (façon CamScanner) : détection de la feuille, recadrage en perspective, filtre =================
// scanDocuments(files) → Promise<File[]|null> : chaque photo est détectée automatiquement, ajustable aux 4 coins, redressée et nettoyée.
async function scanLoad(file) {
  // décodage natif (orientation EXIF comprise) puis réduction directe à 2400 px : pas de réencodage JPEG intermédiaire
  try {
    const full = await createImageBitmap(file, { imageOrientation: 'from-image' }), M = 2400, k = Math.min(1, M / Math.max(full.width, full.height));
    if (k >= 1) return full;
    const c = document.createElement('canvas'); c.width = Math.round(full.width * k); c.height = Math.round(full.height * k);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(full, 0, 0, c.width, c.height); full.close && full.close();
    return createImageBitmap(c);
  } catch (e) { const { blob } = await compressImage(file, 2400, 0.92); return createImageBitmap(blob); }
}
// détection de la feuille : seuil d'Otsu sur une image réduite, plus grande zone claire, puis 4 coins extrêmes
function scanDetect(bmp) {
  const S = 420 / Math.max(bmp.width, bmp.height), w = Math.max(8, Math.round(bmp.width * S)), h = Math.max(8, Math.round(bmp.height * S));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
  g.filter = 'blur(2px)'; g.drawImage(bmp, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, L = new Uint8Array(w * h), hist = new Array(256).fill(0);
  for (let i = 0; i < w * h; i++) { const v = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) | 0; L[i] = v; hist[v]++; }
  // Otsu
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = 0, th = 128; const N = w * h;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = N - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = t; } }
  // plus grande composante claire (4-connexité)
  const lab = new Int32Array(N).fill(-1); let bestC = -1, bestN = 0, cid = 0; const st = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    if (L[i] <= th || lab[i] >= 0) continue;
    let sp = 0, n = 0; st[sp++] = i; lab[i] = cid;
    while (sp) { const k = st[--sp]; n++; const x = k % w, y = (k / w) | 0;
      if (x > 0 && lab[k - 1] < 0 && L[k - 1] > th) { lab[k - 1] = cid; st[sp++] = k - 1; }
      if (x < w - 1 && lab[k + 1] < 0 && L[k + 1] > th) { lab[k + 1] = cid; st[sp++] = k + 1; }
      if (y > 0 && lab[k - w] < 0 && L[k - w] > th) { lab[k - w] = cid; st[sp++] = k - w; }
      if (y < h - 1 && lab[k + w] < 0 && L[k + w] > th) { lab[k + w] = cid; st[sp++] = k + w; } }
    if (n > bestN) { bestN = n; bestC = cid; } cid++;
  }
  const fallback = [[0.03, 0.03], [0.97, 0.03], [0.97, 0.97], [0.03, 0.97]].map(([x, y]) => [x * bmp.width, y * bmp.height]);
  if (bestN < N * 0.15 || bestN > N * 0.985) return fallback;
  // bord de la feuille : premier et dernier pixel de chaque ligne et colonne → enveloppe convexe → 4 coins
  const pts = [];
  for (let y = 0; y < h; y++) { let a = -1, b = -1; for (let x = 0; x < w; x++) if (lab[y * w + x] === bestC) { if (a < 0) a = x; b = x; } if (a >= 0) { pts.push([a, y], [b + 1, y]); } }
  for (let x = 0; x < w; x++) { let a = -1, b = -1; for (let y = 0; y < h; y++) if (lab[y * w + x] === bestC) { if (a < 0) a = y; b = y; } if (a >= 0) { pts.push([x, a], [x, b + 1]); } }
  const q = scanQuad(pts).map(([x, y]) => [x / S, y / S]);
  // quadrilatère trop petit ou dégénéré → image entière
  const area = Math.abs(q.reduce((a, p, i) => { const r = q[(i + 1) % 4]; return a + p[0] * r[1] - r[0] * p[1]; }, 0)) / 2;
  return area < bmp.width * bmp.height * 0.12 ? fallback : q;
}
// quadrilatère d'aire maximale inscrit dans l'enveloppe convexe des points, rangé haut-gauche → haut-droit → bas-droit → bas-gauche
function scanQuad(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  let H = lo.slice(0, -1).concat(up.slice(0, -1));
  if (H.length > 60) { const st = H.length / 60; H = Array.from({ length: 60 }, (_, i) => H[Math.floor(i * st)]); }
  const n = H.length; if (n < 4) return [[0, 0], [1, 0], [1, 1], [0, 1]];
  const ar = (a, b, c) => Math.abs(cr(a, b, c)) / 2; let best = -1, Q = null;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {        // diagonale i-j, meilleur point de chaque côté
    let m1 = -1, a1 = -1, m2 = -1, a2 = -1;
    for (let k = i + 1; k < j; k++) { const v = ar(H[i], H[j], H[k]); if (v > a1) { a1 = v; m1 = k; } }
    for (let k = j + 1; k < n + i; k++) { const v = ar(H[i], H[j], H[k % n]); if (v > a2) { a2 = v; m2 = k % n; } }
    if (m1 >= 0 && m2 >= 0 && a1 + a2 > best) { best = a1 + a2; Q = [H[i], H[m1], H[j], H[m2]]; } }
  if (!Q) return [[0, 0], [1, 0], [1, 1], [0, 1]];
  const cx = Q.reduce((s, p) => s + p[0], 0) / 4, cy = Q.reduce((s, p) => s + p[1], 0) / 4;
  Q.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));     // sens horaire (y vers le bas)
  let s0 = 0; Q.forEach((p, i) => { if (p[0] + p[1] < Q[s0][0] + Q[s0][1]) s0 = i; });
  return [0, 1, 2, 3].map(i => Q[(s0 + i) % 4]);
}
// homographie (4 points → 4 points), résolue par élimination de Gauss
function scanHomography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
  for (let i = 0; i < 8; i++) { let m = i; for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r; [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
    for (let r = i + 1; r < 8; r++) { const f = A[r][i] / A[i][i]; for (let k = i; k < 8; k++) A[r][k] -= f * A[i][k]; b[r] -= f * b[i]; } }
  const h = new Array(8); for (let i = 7; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < 8; k++) s -= A[i][k] * h[k]; h[i] = s / A[i][i]; }
  return [...h, 1];
}
function scanWarp(bmp, quad, rot, filter) {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let W = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2])), H = Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]));
  const k = Math.min(1, 2000 / Math.max(W, H)); W = Math.round(W * k); H = Math.round(H * k);
  const sc = document.createElement('canvas'); sc.width = bmp.width; sc.height = bmp.height; const sg = sc.getContext('2d', { willReadFrequently: true }); sg.drawImage(bmp, 0, 0);
  const sd = sg.getImageData(0, 0, bmp.width, bmp.height).data, SW = bmp.width, SH = bmp.height;
  const Hm = scanHomography([[0, 0], [W, 0], [W, H], [0, H]], quad);         // sortie → source
  const out = new ImageData(W, H), od = out.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const z = Hm[6] * x + Hm[7] * y + 1, sx = (Hm[0] * x + Hm[1] * y + Hm[2]) / z, sy = (Hm[3] * x + Hm[4] * y + Hm[5]) / z;
    const x0 = Math.max(0, Math.min(SW - 2, sx | 0)), y0 = Math.max(0, Math.min(SH - 2, sy | 0)), fx = sx - x0, fy = sy - y0, o = (y * W + x) * 4;
    const i00 = (y0 * SW + x0) * 4, i10 = i00 + 4, i01 = i00 + SW * 4, i11 = i01 + 4;
    for (let c = 0; c < 3; c++) od[o + c] = (sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx) * (1 - fy) + (sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx) * fy;
    od[o + 3] = 255;
  }
  scanFilter(od, filter);
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(out, 0, 0);
  if (!rot) return c;
  const r = document.createElement('canvas'), q = rot % 2; r.width = q ? H : W; r.height = q ? W : H; const rg = r.getContext('2d');
  rg.translate(r.width / 2, r.height / 2); rg.rotate(rot * Math.PI / 2); rg.drawImage(c, -W / 2, -H / 2); return r;
}
// filtres : original · document (fond blanc, couleurs conservées) · noir & blanc
function scanFilter(d, f) {
  if (f === 'orig') return;
  const hist = new Array(256).fill(0), n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) hist[(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) | 0]++;
  const pct = (p) => { let a = 0; for (let i = 0; i < 256; i++) { a += hist[i]; if (a >= n * p) return i; } return 255; };
  const lo = pct(0.03), hi = Math.max(lo + 30, pct(f === 'bw' ? 0.6 : 0.75)), span = hi - lo;
  for (let i = 0; i < d.length; i += 4) {
    if (f === 'bw') { const g = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 - lo) / span; const v = Math.max(0, Math.min(255, 255 * Math.pow(Math.max(0, g), 1.8))); d[i] = d[i + 1] = d[i + 2] = v; }
    else for (let c = 0; c < 3; c++) { const g = (d[i + c] - lo) / span; d[i + c] = Math.max(0, Math.min(255, 255 * Math.pow(Math.max(0, g), 1.25))); }
  }
}

function scanDocuments(files) {
  return new Promise(async (resolve) => {
    const el = document.createElement('div'); el.className = 'fullpage scanpage'; document.body.appendChild(el);
    const unBack = pushBack(() => { el.remove(); resolve(null); });
    const docs = []; let i = 0, filter = localStorage.getItem('scan.filter') || 'doc';
    const ld = loading('Détection des documents…');
    try { for (const f of files) { const bmp = await scanLoad(f); docs.push({ f, bmp, quad: scanDetect(bmp), rot: 0 }); ld.set(`Détection des documents… ${docs.length}/${files.length}`); } } catch (e) { console.error(e); }
    ld.close();
    if (!docs.length) { unBack(); el.remove(); return resolve(files); }
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('close')}</button><h1 style="flex:1;font-size:17px">Recadrer <span data-n></span></h1>
        <button class="btn small" data-a="ok" style="flex:none">${icon('check')} <span data-okl>Valider</span></button></div>
      <div class="sc-hint">Ajustez les 4 coins sur les bords de la feuille</div>
      <div class="sc-stage"><canvas class="sc-cv"></canvas><svg class="sc-ov"></svg><canvas class="sc-loupe"></canvas></div>
      <div class="sc-bar"><div class="sc-f">${[['orig', 'Original'], ['doc', 'Document'], ['bw', 'Noir & blanc']].map(([k, l]) => `<button data-f="${k}">${l}</button>`).join('')}</div>
        <div class="sc-act"><button data-a="prev">‹</button><button data-a="rotl" title="Tourner à gauche"><svg class="i" viewBox="0 0 24 24"><path d="M3 4v5h5"/><path d="M3.5 9a9 9 0 1 1-.3 5"/></svg></button><button data-a="rot" title="Tourner à droite"><svg class="i" viewBox="0 0 24 24"><path d="M21 4v5h-5"/><path d="M20.5 9a9 9 0 1 0 .3 5"/></svg></button><button data-a="full">⛶ Page entière</button><button data-a="auto">✨ Auto</button><button data-a="next">›</button></div></div>`;
    const stage = $('.sc-stage', el), cv = $('.sc-cv', el), ov = $('.sc-ov', el), lp = $('.sc-loupe', el);
    let k = 1, ox = 0, oy = 0;
    const D = () => docs[i];
    const layout = () => {
      const b = D().bmp, r = stage.getBoundingClientRect(); k = Math.min((r.width - 24) / b.width, (r.height - 24) / b.height);
      cv.width = Math.round(b.width * k * devicePixelRatio); cv.height = Math.round(b.height * k * devicePixelRatio);
      cv.style.width = b.width * k + 'px'; cv.style.height = b.height * k + 'px';
      ox = (r.width - b.width * k) / 2; oy = (r.height - b.height * k) / 2; cv.style.left = ox + 'px'; cv.style.top = oy + 'px';
      cv.getContext('2d').drawImage(b, 0, 0, cv.width, cv.height); drawOv();
    };
    const toS = (p) => [ox + p[0] * k, oy + p[1] * k];
    const drawOv = () => {
      const q = D().quad.map(toS);
      ov.innerHTML = `<polygon points="${q.map(p => p.join(',')).join(' ')}" fill="rgba(37,99,235,.18)" stroke="#3b82f6" stroke-width="2.5"/>${q.map((p, j) => `<circle cx="${p[0]}" cy="${p[1]}" r="13" fill="rgba(255,255,255,.9)" stroke="#2563eb" stroke-width="3" data-h="${j}"/>`).join('')}`;
      $('[data-n]', el).textContent = docs.length > 1 ? `${i + 1}/${docs.length}` : '';
      $('[data-okl]', el).textContent = i < docs.length - 1 ? 'Suivant' : 'Valider';
      $$('[data-f]', el).forEach(b => b.classList.toggle('on', b.dataset.f === filter));
      $('[data-a=prev]', el).disabled = i === 0; $('[data-a=next]', el).disabled = i === docs.length - 1;
    };
    // déplacement des coins (le plus proche du doigt) + loupe
    let drag = -1;
    const pt = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    stage.addEventListener('pointerdown', (e) => { const p = pt(e), q = D().quad.map(toS); let m = -1, md = 48; q.forEach((h, j) => { const dd = Math.hypot(h[0] - p[0], h[1] - p[1]); if (dd < md) { md = dd; m = j; } }); drag = m; if (m >= 0) { stage.setPointerCapture(e.pointerId); loupe(p); } });
    stage.addEventListener('pointermove', (e) => { if (drag < 0) return; const p = pt(e), b = D().bmp; D().quad[drag] = [Math.max(0, Math.min(b.width, (p[0] - ox) / k)), Math.max(0, Math.min(b.height, (p[1] - oy) / k))]; drawOv(); loupe(p); });
    const up = () => { drag = -1; lp.style.display = 'none'; };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    function loupe(p) {
      const S = 110, Z = 2.5, b = D().bmp, g = lp.getContext('2d'); lp.width = lp.height = S * devicePixelRatio; lp.style.display = 'block';
      lp.style.left = (p[0] < stage.clientWidth / 2 ? stage.clientWidth - S - 10 : 10) + 'px'; lp.style.top = '10px';
      const sx = (p[0] - ox) / k, sy = (p[1] - oy) / k, half = S / (2 * Z * k);
      g.drawImage(b, sx - half, sy - half, half * 2, half * 2, 0, 0, lp.width, lp.height);
      g.strokeStyle = '#ef4444'; g.lineWidth = 2 * devicePixelRatio; g.beginPath(); g.moveTo(lp.width / 2, 0); g.lineTo(lp.width / 2, lp.height); g.moveTo(0, lp.height / 2); g.lineTo(lp.width, lp.height / 2); g.stroke();
    }
    $$('[data-f]', el).forEach(b => b.onclick = () => { filter = b.dataset.f; try { localStorage.setItem('scan.filter', filter); } catch (e) {} drawOv(); toast(b.textContent + ' — appliqué à l\'enregistrement'); });
    const rotV = () => { cv.style.transition = 'transform .25s'; cv.style.transform = `rotate(${D().rot * 90}deg)`; };
    $('[data-a=rot]', el).onclick = () => { D().rot = (D().rot + 1) % 4; rotV(); };
    $('[data-a=rotl]', el).onclick = () => { D().rot = (D().rot + 3) % 4; rotV(); };
    $('[data-a=full]', el).onclick = () => { const b = D().bmp; D().quad = [[0, 0], [b.width, 0], [b.width, b.height], [0, b.height]]; drawOv(); };
    $('[data-a=auto]', el).onclick = () => { D().quad = scanDetect(D().bmp); drawOv(); };
    $('[data-a=prev]', el).onclick = () => { if (i > 0) { i--; layout(); } };
    $('[data-a=next]', el).onclick = () => { if (i < docs.length - 1) { i++; layout(); } };
    $('[data-a=x]', el).onclick = async () => { if (await confirmBox('Garder les photos sans recadrage ?', 'Sans recadrage')) { unBack(); el.remove(); resolve(files); } };
    $('[data-a=ok]', el).onclick = async () => {
      if (i < docs.length - 1) { i++; layout(); return; }
      const ld2 = loading('Traitement…'), out = [];
      try {
        for (const [j, d] of docs.entries()) { ld2.set(`Traitement… ${j + 1}/${docs.length}`); await new Promise(r => setTimeout(r, 20));
          const c = scanWarp(d.bmp, d.quad, d.rot, filter); const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
          const nf = new File([blob], (d.f.name || 'scan').replace(/\.\w+$/, '') + '_scan.jpg', { type: 'image/jpeg' }); nf._w = c.width; nf._h = c.height; out.push(nf); c.width = c.height = 0; }
      } catch (e) { console.error(e); ld2.close(); alertBox('Traitement impossible : ' + (e.message || e)); return; }
      ld2.close(); unBack(); el.remove(); resolve(out);
    };
    window.addEventListener('resize', () => el.isConnected && layout());
    requestAnimationFrame(layout);
  });
}

// recadrage automatique sans écran (photo prise → feuille détectée, redressée, nettoyée)
async function scanAuto(files) {
  const filter = (() => { try { return localStorage.getItem('scan.filter') || 'doc'; } catch (e) { return 'doc'; } })(), out = [];
  for (const f of files) {
    try { const bmp = await scanLoad(f), c = scanWarp(bmp, scanDetect(bmp), 0, filter); const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
      out.push(new File([blob], (f.name || 'pv').replace(/\.\w+$/, '') + '_scan.jpg', { type: 'image/jpeg' })); }
    catch (e) { console.warn('scanAuto', e); out.push(f); }
  }
  return out;
}
