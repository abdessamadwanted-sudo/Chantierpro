// Croquis : petit éditeur de dessin plein écran (stylo, surligneur pour colorier la partie réceptionnée,
// ligne, rectangle plein, gomme, annuler) sur fond blanc, quadrillé, photo ou plan.
// Retourne { data, blob } (data = traits re-modifiables, blob = image PNG/JPEG finale) ou null.
const SKW = 1400, SKH = 1000;
const SK_COLORS = ['#111827', '#e11d48', '#16a34a', '#2563eb', '#f59e0b', '#9333ea', '#ffffff'];

function openSketch({ title = 'Croquis', data = null, projectId = null } = {}) {
  return new Promise((resolve) => {
    const portrait = window.innerHeight > window.innerWidth * 1.2;
    const st = data ? JSON.parse(JSON.stringify(data)) : { bg: 'grid', bgFileId: null, strokes: [], w: portrait ? 1000 : SKW, h: portrait ? 1300 : SKH };
    const W = st.w || SKW, H = st.h || SKH;
    let tool = 'hl', color = '#16a34a', width = 26, bgImg = null, cur = null;
    const redo = [];
    const el = document.createElement('div'); el.className = 'fullpage sketch';
    el.innerHTML = `
      <div class="topbar dark"><button class="iconbtn" data-a="close">${icon('close')}</button><h1 style="flex:1;font-size:18px">${esc(title)}</h1>
        <button class="iconbtn" data-a="undo">${icon('undo')}</button><button class="iconbtn" data-a="bg">${icon('image')}</button>
        <button class="btn small" data-a="save" style="flex:none">${icon('check')} OK</button></div>
      <div class="sk-wrap"><canvas class="sk-bg"></canvas><canvas class="sk-ink"></canvas></div>
      <div class="sk-bar">
        <div class="sk-tools">
          ${[['hl', 'fill', 'Colorier'], ['pen', 'pen', 'Stylo'], ['line', 'line', 'Ligne'], ['rect', 'box', 'Zone'], ['erase', 'eraser', 'Gomme']].map(([k, ic, lb]) => `<button data-t="${k}" class="${tool === k ? 'on' : ''}">${icon(ic)}<small>${lb}</small></button>`).join('')}
        </div>
        <div class="sk-colors">${SK_COLORS.map(c => `<button data-c="${c}" style="background:${c}" class="${c === color ? 'on' : ''}"></button>`).join('')}
          <input type="range" min="2" max="60" value="${width}" data-w></div>
      </div>`;
    ($('#sheet-root') || document.body).appendChild(el);   // au-dessus de la fiche ouverte, sous les menus suivants
    const unBack = pushBack(() => done(null, true));
    const wrap = $('.sk-wrap', el), cbg = $('.sk-bg', el), cink = $('.sk-ink', el);
    [cbg, cink].forEach(c => { c.width = W; c.height = H; });
    const gb = cbg.getContext('2d'), gi = cink.getContext('2d');

    function fit() {
      const r = wrap.getBoundingClientRect(); const k = Math.min(r.width / W, r.height / H);
      [cbg, cink].forEach(c => { c.style.width = W * k + 'px'; c.style.height = H * k + 'px'; });
    }
    function drawBg() {
      gb.fillStyle = '#fff'; gb.fillRect(0, 0, W, H);
      if (st.bg === 'grid') {
        gb.strokeStyle = '#e5e7eb'; gb.lineWidth = 1;
        for (let x = 0; x <= W; x += 50) { gb.beginPath(); gb.moveTo(x, 0); gb.lineTo(x, H); gb.stroke(); }
        for (let y = 0; y <= H; y += 50) { gb.beginPath(); gb.moveTo(0, y); gb.lineTo(W, y); gb.stroke(); }
      }
      if (bgImg) { const k = Math.min(W / bgImg.width, H / bgImg.height); const w = bgImg.width * k, h = bgImg.height * k; gb.drawImage(bgImg, (W - w) / 2, (H - h) / 2, w, h); }
    }
    function stroke(g, s) {
      g.save();
      g.globalCompositeOperation = s.t === 'erase' ? 'destination-out' : 'source-over';
      g.globalAlpha = s.t === 'hl' ? 0.45 : 1;
      g.strokeStyle = g.fillStyle = s.c; g.lineWidth = s.w; g.lineCap = g.lineJoin = 'round';
      const p = s.pts;
      if (s.t === 'rect' && p.length > 1) { const [a, b] = [p[0], p[p.length - 1]]; g.globalAlpha = 0.45; g.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); g.globalAlpha = 1; g.lineWidth = 3; g.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); }
      else if (s.t === 'line' && p.length > 1) { g.beginPath(); g.moveTo(...p[0]); g.lineTo(...p[p.length - 1]); g.stroke(); }
      else if (p.length) { g.beginPath(); g.moveTo(...p[0]); for (const q of p.slice(1)) g.lineTo(...q); if (p.length === 1) g.lineTo(p[0][0] + 0.1, p[0][1]); g.stroke(); }
      g.restore();
    }
    function redraw() { gi.clearRect(0, 0, W, H); for (const s of st.strokes) stroke(gi, s); if (cur) stroke(gi, cur); }
    async function loadBg() {
      bgImg = null;
      if (st.bgFileId) { const f = await DB.get('files', st.bgFileId); if (f && f.blob) { try { bgImg = await createImageBitmap(f.blob); } catch (e) {} } }
      drawBg();
    }
    const pos = (e) => { const r = cink.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    cink.addEventListener('pointerdown', (e) => { cink.setPointerCapture(e.pointerId); cur = { t: tool, c: color, w: tool === 'erase' ? width * 1.5 : width, pts: [pos(e)] }; redraw(); });
    cink.addEventListener('pointermove', (e) => { if (!cur) return; const p = pos(e); if (cur.t === 'line' || cur.t === 'rect') cur.pts[1] = p; else cur.pts.push(p); redraw(); });
    const up = () => { if (!cur) return; st.strokes.push(cur); cur = null; redo.length = 0; redraw(); };
    cink.addEventListener('pointerup', up); cink.addEventListener('pointercancel', up);

    $$('[data-t]', el).forEach(b => b.onclick = () => { tool = b.dataset.t; $$('[data-t]', el).forEach(x => x.classList.toggle('on', x === b)); if (tool === 'pen' && width > 14) { width = 5; $('[data-w]', el).value = 5; } if (tool === 'hl' && width < 14) { width = 26; $('[data-w]', el).value = 26; } });
    $$('[data-c]', el).forEach(b => b.onclick = () => { color = b.dataset.c; $$('[data-c]', el).forEach(x => x.classList.toggle('on', x === b)); if (tool === 'erase') { tool = 'pen'; $$('[data-t]', el).forEach(x => x.classList.toggle('on', x.dataset.t === 'pen')); } });
    $('[data-w]', el).oninput = (e) => { width = +e.target.value; };
    $('[data-a=undo]', el).onclick = () => { if (st.strokes.length) { redo.push(st.strokes.pop()); redraw(); } };
    $('[data-a=bg]', el).onclick = async () => {
      const plans = projectId ? await DB.byProject('plans', projectId) : [];
      const v = await menu('Fond du croquis', [
        { label: 'Quadrillé', icon: 'grid', value: 'grid' }, { label: 'Blanc', icon: 'file', value: 'white' },
        { label: 'Photo (caméra / galerie)', icon: 'camera', value: 'photo' },
        ...(plans.length ? [{ label: 'Un plan du projet', icon: 'layers', value: 'plan' }] : [])]);
      if (!v) return;
      if (v === 'grid' || v === 'white') { st.bg = v; st.bgFileId = null; }
      if (v === 'photo') { const recs = await addPhotos(projectId, { source: 'Fond de croquis', role: 'sketchbg' }); if (!recs.length) return; st.bg = 'img'; st.bgFileId = recs[0].id; }
      if (v === 'plan') { const pv = await menu('Choisir le plan', plans.map(p => ({ label: p.name, icon: 'layers', value: p.fileId }))); if (!pv) return; st.bg = 'img'; st.bgFileId = pv; }
      await loadBg();
    };
    async function done(result, fromBack) { if (!fromBack) unBack(); window.removeEventListener('resize', fit); el.remove(); resolve(result); }
    $('[data-a=close]', el).onclick = async () => { if (!st.strokes.length || await confirmBox('Quitter sans enregistrer le croquis ?', 'Quitter')) done(null); };
    $('[data-a=save]', el).onclick = async () => {
      const out = document.createElement('canvas'); out.width = W; out.height = H;
      const g = out.getContext('2d'); g.drawImage(cbg, 0, 0); g.drawImage(cink, 0, 0);
      const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.88));
      done({ data: st, blob });
    };
    window.addEventListener('resize', fit);
    requestAnimationFrame(() => { fit(); loadBg().then(redraw); });
  });
}
