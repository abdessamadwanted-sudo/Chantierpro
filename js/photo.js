// ================= Studio photo : améliorer une photo (auto, document, lumière, contraste, couleurs, netteté, recadrage, rotation) =================
// openPhotoStudio({ blob, name, fileId }) → nouveau Blob JPEG (ou null). Avec fileId : la photo du projet est remplacée (et renvoyée vers Drive).
const PS_DEF = { b: 0, c: 0, s: 0, t: 0, sh: 0, sd: 0, mode: '' };
const PS_PRESETS = [['auto', '✨ Auto'], ['doc', '📄 Document'], ['bw', '⚫ Noir & blanc'], ['light', '🔆 Éclaircir'], ['sharp', '🎯 Plus net'], ['orig', '↺ Original']];
const PS_SLIDERS = [['b', '☀️ Luminosité', -100, 100], ['c', '◐ Contraste', -100, 100], ['s', '🎨 Couleurs', -100, 100], ['t', '🌡 Chaleur', -100, 100], ['sd', '🌗 Ombres', 0, 100], ['sh', '🔍 Netteté', 0, 100]];
// niveaux automatiques : 0,5 % des pixels les plus sombres → noir, les plus clairs → blanc (canal par canal léger pour corriger la dominante)
function psAutoLevels(d) {
  const hs = [0, 1, 2].map(() => new Uint32Array(256)), n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { hs[0][d[i]]++; hs[1][d[i + 1]]++; hs[2][d[i + 2]]++; }
  const pct = (h, p) => { let a = 0; for (let v = 0; v < 256; v++) { a += h[v]; if (a >= n * p) return v; } return 255; };
  const lo = hs.map(h => pct(h, .005)), hi = hs.map(h => pct(h, .995)), Lo = Math.min(...lo), Hi = Math.max(...hi);
  const lut = [0, 1, 2].map(c => { const l = lo[c] * .5 + Lo * .5, h = Math.max(l + 20, hi[c] * .5 + Hi * .5), t = new Uint8ClampedArray(256); for (let v = 0; v < 256; v++) t[v] = (v - l) * 255 / (h - l); return t; });
  for (let i = 0; i < d.length; i += 4) { d[i] = lut[0][d[i]]; d[i + 1] = lut[1][d[i + 1]]; d[i + 2] = lut[2][d[i + 2]]; }
}
function psSharpen(img, amt) {   // masque flou (unsharp) 3×3
  const { width: w, height: h, data: d } = img, src = new Uint8ClampedArray(d), k = amt / 100 * 1.6;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) { const v = src[i + c], bl = (src[i - 4 + c] + src[i + 4 + c] + src[i - w * 4 + c] + src[i + w * 4 + c]) / 4; d[i + c] = v + (v - bl) * k; } }
}
// applique les réglages sur une image source → canvas
function psRender(src, P, maxSide) {
  const k = Math.min(1, maxSide / Math.max(src.width, src.height)), W = Math.round(src.width * k), H = Math.round(src.height * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true });
  g.filter = `brightness(${1 + P.b / 160}) contrast(${1 + P.c / 140}) saturate(${Math.max(0, 1 + P.s / 100)})`; g.drawImage(src, 0, 0, W, H); g.filter = 'none';
  if (P.mode || P.t || P.sd || P.sh) {
    const img = g.getImageData(0, 0, W, H), d = img.data;
    if (P.mode === 'auto') psAutoLevels(d);
    if (P.mode === 'doc' || P.mode === 'bw') scanFilter(d, P.mode);
    if (P.t) { const t = P.t * .45; for (let i = 0; i < d.length; i += 4) { d[i] += t; d[i + 2] -= t; } }
    if (P.sd) { const a = P.sd / 100; for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) { const v = d[i + j] / 255; d[i + j] = 255 * (v + a * .55 * (1 - v) * (1 - v) * v * 4 * (v < .5 ? 1 : .3)); } }
    if (P.sh) psSharpen(img, P.sh);
    g.putImageData(img, 0, 0);
  }
  return c;
}
function openPhotoStudio({ blob, name = 'photo', fileId = null } = {}) {
  return new Promise(async (resolve) => {
    if (!blob) { const [f] = await pickFiles({ accept: 'image/*', multiple: false }); if (!f) return resolve(null); blob = f; name = f.name || name; }
    let src = await scanLoad(blob), P = { ...PS_DEF }, raf = 0, busy = false;
    const el = document.createElement('div'); el.className = 'fullpage pst-page'; document.body.appendChild(el);
    const done = (v) => { unBack(); el.remove(); resolve(v); }, unBack = pushBack(() => { el.remove(); resolve(null); });
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('close')}</button><h1 style="flex:1;font-size:17px">Studio photo</h1>
        <button class="iconbtn" data-a="rotl" title="Tourner">⟲</button><button class="iconbtn" data-a="crop" title="Recadrer / redresser">✂️</button><button class="btn small" data-a="ok" style="flex:none">${icon('check')} ${fileId ? 'Enregistrer' : 'Terminer'}</button></div>
      <div class="pst-stage"><canvas class="pst-cv"></canvas><small class="pst-hold">Appui long = voir l'original</small></div>
      <div class="pst-bar"><div class="pst-pre">${PS_PRESETS.map(([k, l]) => `<button data-pre="${k}">${l}</button>`).join('')}</div>
        <div class="pst-sl">${PS_SLIDERS.map(([k, l, a, b]) => `<label><span>${l}</span><input type="range" min="${a}" max="${b}" value="0" data-k="${k}"><i data-v="${k}">0</i></label>`).join('')}</div></div>`;
    const cv = $('.pst-cv', el), stage = $('.pst-stage', el);
    const fitSide = () => Math.round(Math.max(stage.clientWidth, stage.clientHeight) * Math.min(2, devicePixelRatio || 1));
    const draw = (orig) => { const out = orig ? psRender(src, PS_DEF, fitSide()) : psRender(src, P, fitSide()); cv.width = out.width; cv.height = out.height; cv.getContext('2d').drawImage(out, 0, 0); };
    const later = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
    const sync = () => { PS_SLIDERS.forEach(([k]) => { $(`[data-k=${k}]`, el).value = P[k]; $(`[data-v=${k}]`, el).textContent = P[k]; }); $$('[data-pre]', el).forEach(b => b.classList.toggle('on', b.dataset.pre === (P.mode || (P.b > 0 && !P.sh ? 'light' : P.sh && !P.b ? 'sharp' : '')))); };
    $$('[data-k]', el).forEach(r => r.oninput = () => { P[r.dataset.k] = +r.value; $(`[data-v=${r.dataset.k}]`, el).textContent = r.value; later(); });
    $$('[data-pre]', el).forEach(b => b.onclick = () => { const k = b.dataset.pre;
      P = k === 'orig' ? { ...PS_DEF } : k === 'auto' ? { ...PS_DEF, mode: 'auto', s: 12, sh: 25 } : k === 'doc' ? { ...PS_DEF, mode: 'doc', sh: 30 } : k === 'bw' ? { ...PS_DEF, mode: 'bw', sh: 20 } : k === 'light' ? { ...PS_DEF, b: 35, sd: 35 } : { ...PS_DEF, sh: 55, c: 10 };
      sync(); draw(); });
    // appui long : comparer avec l'original
    let ht = null; stage.addEventListener('pointerdown', () => { ht = setTimeout(() => { ht = 'on'; draw(true); }, 300); });
    const rel = () => { if (ht === 'on') draw(); clearTimeout(ht); ht = null; }; stage.addEventListener('pointerup', rel); stage.addEventListener('pointercancel', rel); stage.addEventListener('pointerleave', rel);
    $('[data-a=rotl]', el).onclick = async () => { const c = document.createElement('canvas'); c.width = src.height; c.height = src.width; const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate(-Math.PI / 2); g.drawImage(src, -src.width / 2, -src.height / 2); src = await createImageBitmap(c); draw(); };
    $('[data-a=crop]', el).onclick = async () => { const c0 = document.createElement('canvas'); c0.width = src.width; c0.height = src.height; c0.getContext('2d').drawImage(src, 0, 0);
      const f0 = new File([await new Promise(r => c0.toBlob(r, 'image/jpeg', .95))], 'p.jpg', { type: 'image/jpeg' }); let keep = null; try { keep = localStorage.getItem('scan.filter'); localStorage.setItem('scan.filter', 'orig'); } catch (e) {}
      const out = await scanDocuments([f0]); try { if (keep != null) localStorage.setItem('scan.filter', keep); } catch (e) {}
      if (out && out[0]) { src = await scanLoad(out[0]); draw(); } };
    $('[data-a=x]', el).onclick = async () => { if (JSON.stringify(P) === JSON.stringify(PS_DEF) || await confirmBox('Quitter sans enregistrer ?', 'Quitter')) done(null); };
    $('[data-a=ok]', el).onclick = async () => { if (busy) return; busy = true; const ld = loading('Enregistrement…');
      try { const out = psRender(src, P, 2400), b = await new Promise(r => out.toBlob(r, 'image/jpeg', .9));
        if (fileId) { const f = await DB.get('files', fileId); if (f) { f.blob = b; f.mime = 'image/jpeg'; f.w = out.width; f.h = out.height; f.driveId = null; f.drivePath = null; BlobURL.drop(fileId); if (window.Thumbs) Thumbs.drop(fileId); await DB.put('files', f); } }
        ld.close(); toast('Photo améliorée ✓'); done(b); } catch (e) { ld.close(); busy = false; alertBox('Impossible : ' + (e.message || e)); } };
    requestAnimationFrame(() => { sync(); draw(); });
  });
}
// outil autonome : choisir une photo, l'améliorer, l'envoyer
async function photoStudioTool() { const b = await openPhotoStudio({}); if (b) { const v = await menu('Photo améliorée', [{ label: 'Envoyer (WhatsApp…)', icon: 'share', value: 's' }, { label: 'Ajouter aux photos du chantier', icon: 'camera', value: 'p' }]); if (v === 's') shareBlob(b, 'photo.jpg'); if (v === 'p' && App.project) { await DB.put('files', { projectId: App.project.id, blob: b, mime: 'image/jpeg', name: 'photo.jpg', role: 'photo', source: 'Studio photo' }); toast('Ajoutée aux photos ✓'); } } }
