// Croquis / tableau de dessin plein écran : colorier, stylo, ligne, flèche, rectangle, zone, cercle, texte, gomme,
// types de trait (continu, tirets, pointillés), couleurs + couleur libre, épaisseur, annuler / rétablir,
// fond blanc, quadrillé, points, photo ou plan. Retourne { data, blob } (data = traits re-modifiables) ou null.
const SKW = 1400, SKH = 1000;
const SK_COLORS = ['#111827', '#e11d48', '#16a34a', '#2563eb', '#f59e0b', '#9333ea', '#0891b2', '#ec4899', '#78350f', '#ffffff'];
const SK_TOOLS = [['hl', 'fill', 'Colorier'], ['pen', 'pen', 'Stylo'], ['line', 'line', 'Ligne'], ['arrow', 'chevright', 'Flèche'], ['box', 'box', 'Cadre'], ['rect', 'grid', 'Zone'], ['circle', 'circle', 'Cercle'], ['text', 'edit', 'Texte'], ['erase', 'eraser', 'Gomme']];
const SK_DASH = { solid: [], dash: [6, 4], dot: [0.1, 3] };

function openSketch({ title = 'Croquis', data = null, projectId = null, board = false } = {}) {
  return new Promise((resolve) => {
    const portrait = window.innerHeight > window.innerWidth * 1.2;
    const st = data ? JSON.parse(JSON.stringify(data)) : { bg: board ? 'white' : 'grid', bgFileId: null, strokes: [], w: portrait ? 1000 : SKW, h: portrait ? 1300 : SKH };
    const W = st.w || SKW, H = st.h || SKH;
    let tool = board ? 'pen' : 'hl', color = board ? '#111827' : '#16a34a', width = board ? 5 : 26, dash = 'solid', bgImg = null, cur = null;
    const redo = [];
    const el = document.createElement('div'); el.className = 'fullpage sketch';
    el.innerHTML = `
      <div class="topbar dark"><button class="iconbtn" data-a="close">${icon('close')}</button><h1 style="flex:1;font-size:17px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title)}</h1>
        <button class="iconbtn" data-a="undo">${icon('undo')}</button><button class="iconbtn" data-a="redo">${icon('redo')}</button><button class="iconbtn" data-a="bg">${icon('image')}</button>
        <button class="btn small" data-a="save" style="flex:none">${icon('check')} OK</button></div>
      <div class="sk-wrap"><canvas class="sk-bg"></canvas><canvas class="sk-ink"></canvas></div>
      <div class="sk-bar">
        <div class="sk-tools">
          ${SK_TOOLS.map(([k, ic, lb]) => `<button data-t="${k}" class="${tool === k ? 'on' : ''}">${icon(ic)}<small>${lb}</small></button>`).join('')}
        </div>
        <div class="sk-colors">${SK_COLORS.map(c => `<button data-c="${c}" style="background:${c}" class="${c === color ? 'on' : ''}"></button>`).join('')}
          <label class="sk-pick" title="Autre couleur"><input type="color" value="${color}" data-cc></label></div>
        <div class="sk-colors sk-row2"><button class="sk-dash" data-dash>━━</button><input type="range" min="1" max="60" value="${width}" data-w><span class="sk-wv">${width}</span>
          <button class="sk-clear" data-a="clear">${icon('trash')}</button></div>
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
      if (st.bg === 'dots') { gb.fillStyle = '#cbd5e1'; for (let x = 25; x < W; x += 50) for (let y = 25; y < H; y += 50) { gb.beginPath(); gb.arc(x, y, 2, 0, 7); gb.fill(); } }
      if (bgImg) { const k = Math.min(W / bgImg.width, H / bgImg.height); const w = bgImg.width * k, h = bgImg.height * k; gb.drawImage(bgImg, (W - w) / 2, (H - h) / 2, w, h); }
    }
    function stroke(g, s) {
      g.save();
      g.globalCompositeOperation = s.t === 'erase' ? 'destination-out' : 'source-over';
      g.globalAlpha = s.t === 'hl' ? 0.45 : 1;
      g.strokeStyle = g.fillStyle = s.c; g.lineWidth = s.w; g.lineCap = g.lineJoin = 'round';
      if (s.d && SK_DASH[s.d] && s.t !== 'erase' && s.t !== 'hl') g.setLineDash(SK_DASH[s.d].map(x => x * Math.max(2, s.w)));
      const p = s.pts, a = p[0], b = p[p.length - 1];
      if (s.t === 'rect' && p.length > 1) { g.globalAlpha = 0.45; g.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); g.globalAlpha = 1; g.lineWidth = 3; g.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); }
      else if (s.t === 'box' && p.length > 1) g.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      else if (s.t === 'circle' && p.length > 1) { g.beginPath(); g.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2 || 1, Math.abs(b[1] - a[1]) / 2 || 1, 0, 0, 7); g.stroke(); }
      else if ((s.t === 'line' || s.t === 'arrow') && p.length > 1) {
        g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke();
        if (s.t === 'arrow') { g.setLineDash([]); const an = Math.atan2(b[1] - a[1], b[0] - a[0]), L = Math.max(18, s.w * 4); g.beginPath(); g.moveTo(b[0] - L * Math.cos(an - 0.45), b[1] - L * Math.sin(an - 0.45)); g.lineTo(...b); g.lineTo(b[0] - L * Math.cos(an + 0.45), b[1] - L * Math.sin(an + 0.45)); g.stroke(); }
      }
      else if (s.t === 'text') { g.font = `bold ${Math.max(14, s.w * 3 + 12)}px sans-serif`; g.textBaseline = 'middle'; String(s.s || '').split('\n').forEach((ln, i) => g.fillText(ln, a[0], a[1] + i * (Math.max(14, s.w * 3 + 12) * 1.2))); }
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
    const SHAPES = ['line', 'arrow', 'rect', 'box', 'circle'];
    cink.addEventListener('pointerdown', async (e) => {
      if (tool === 'text') {
        const p = pos(e); const r = await formSheet('Texte', [{ name: 's', label: 'Texte', type: 'textarea', placeholder: 'Ex : Réservation Ø200' }], { okLabel: 'Ajouter' });
        if (r && r.s) { st.strokes.push({ t: 'text', c: color, w: width, pts: [p], s: r.s }); redo.length = 0; redraw(); }
        return;
      }
      cink.setPointerCapture(e.pointerId); cur = { t: tool, c: color, w: tool === 'erase' ? width * 1.5 : width, d: dash, pts: [pos(e)] }; redraw();
    });
    cink.addEventListener('pointermove', (e) => { if (!cur) return; const p = pos(e); if (SHAPES.includes(cur.t)) cur.pts[1] = p; else cur.pts.push(p); redraw(); });
    const up = () => { if (!cur) return; st.strokes.push(cur); cur = null; redo.length = 0; redraw(); };
    cink.addEventListener('pointerup', up); cink.addEventListener('pointercancel', up);

    const setW = (w) => { width = w; $('[data-w]', el).value = w; $('.sk-wv', el).textContent = w; };
    $$('[data-t]', el).forEach(b => b.onclick = () => { tool = b.dataset.t; $$('[data-t]', el).forEach(x => x.classList.toggle('on', x === b)); if (tool !== 'hl' && tool !== 'rect' && tool !== 'erase' && width > 14) setW(5); if (tool === 'hl' && width < 14) setW(26); });
    const pickColor = (c) => { color = c; $$('[data-c]', el).forEach(x => x.classList.toggle('on', x.dataset.c === c)); if (tool === 'erase') { tool = 'pen'; $$('[data-t]', el).forEach(x => x.classList.toggle('on', x.dataset.t === 'pen')); } };
    $$('[data-c]', el).forEach(b => b.onclick = () => pickColor(b.dataset.c));
    $('[data-cc]', el).oninput = (e) => { pickColor(e.target.value); $('.sk-pick', el).style.background = e.target.value; };
    $('[data-w]', el).oninput = (e) => setW(+e.target.value);
    $('[data-dash]', el).onclick = (e) => { dash = dash === 'solid' ? 'dash' : dash === 'dash' ? 'dot' : 'solid'; e.currentTarget.textContent = { solid: '━━', dash: '╍╍', dot: '┈┈' }[dash]; toast({ solid: 'Trait continu', dash: 'Tirets', dot: 'Pointillés' }[dash]); };
    $('[data-a=undo]', el).onclick = () => { if (st.strokes.length) { redo.push(st.strokes.pop()); redraw(); } };
    $('[data-a=redo]', el).onclick = () => { if (redo.length) { st.strokes.push(redo.pop()); redraw(); } };
    $('[data-a=clear]', el).onclick = async () => { if (st.strokes.length && await confirmBox('Tout effacer ?', 'Effacer')) { redo.push(...st.strokes.reverse()); st.strokes = []; redraw(); } };
    $('[data-a=bg]', el).onclick = async () => {
      const plans = projectId ? await DB.byProject('plans', projectId) : [];
      const v = await menu('Fond', [
        { label: 'Blanc', icon: 'file', value: 'white' }, { label: 'Quadrillé', icon: 'grid', value: 'grid' }, { label: 'Points', icon: 'grid', value: 'dots' },
        { label: 'Photo (caméra / galerie)', icon: 'camera', value: 'photo' },
        ...(plans.length ? [{ label: 'Un plan du projet', icon: 'layers', value: 'plan' }] : [])]);
      if (!v) return;
      if (['grid', 'white', 'dots'].includes(v)) { st.bg = v; st.bgFileId = null; }
      if (v === 'photo') { const recs = await addPhotos(projectId, { source: 'Fond de croquis', role: 'sketchbg' }); if (!recs.length) return; st.bg = 'img'; st.bgFileId = recs[0].id; }
      if (v === 'plan') { const pv = await menu('Choisir le plan', plans.map(p => ({ label: p.name, icon: 'layers', value: p.fileId }))); if (!pv) return; st.bg = 'img'; st.bgFileId = pv; }
      await loadBg();
    };
    async function done(result, fromBack) { if (!fromBack) unBack(); window.removeEventListener('resize', fit); el.remove(); resolve(result); }
    $('[data-a=close]', el).onclick = async () => { if (!st.strokes.length || await confirmBox('Quitter sans enregistrer ?', 'Quitter')) done(null); };
    $('[data-a=save]', el).onclick = async () => {
      const out = document.createElement('canvas'); out.width = W; out.height = H;
      const g = out.getContext('2d'); g.drawImage(cbg, 0, 0); g.drawImage(cink, 0, 0);
      const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.9));
      done({ data: st, blob });
    };
    window.addEventListener('resize', fit);
    requestAnimationFrame(() => { fit(); loadBg().then(redraw); });
  });
}

// ---------- Tableau de dessin (outil) : dessins enregistrés dans le projet ----------
async function openBoardTool() {
  const pid = App.project && App.project.id;
  const p = pid ? await DB.get('projects', pid) : null;
  const boards = (p && p.boards) || [];
  let b = null;
  if (boards.length) {
    const v = await menu('Tableau de dessin', [{ label: 'Nouveau dessin', icon: 'plus', value: '__new' },
      ...boards.slice().sort((x, y) => y.updatedAt - x.updatedAt).map(x => ({ label: `${x.name} · ${fmtDate(x.updatedAt)}`, icon: 'brush', value: x.id }))]);
    if (!v) return; if (v !== '__new') b = boards.find(x => x.id === v);
  }
  const res = await openSketch({ title: b ? b.name : 'Tableau de dessin', data: b ? b.data : null, projectId: pid, board: true });
  if (!res) return;
  if (!pid) { shareBlob(res.blob, `Dessin_${todayISO()}.jpg`); return; }
  if (!b) { const r = await formSheet('Enregistrer le dessin', [{ name: 'n', label: 'Nom', value: `Dessin ${fmtDate(Date.now())}` }], { okLabel: 'Enregistrer' }); b = { id: DB.uid(), name: (r && r.n) || 'Dessin', createdAt: Date.now() }; }
  const pp = await DB.get('projects', pid);
  if (b.fileId) { const old = await DB.get('files', b.fileId); if (old) { old.blob = res.blob; await DB.put('files', old); } else b.fileId = null; }
  if (!b.fileId) { const f = await DB.put('files', { projectId: pid, blob: res.blob, mime: 'image/jpeg', name: b.name + '.jpg', role: 'board' }); b.fileId = f.id; }
  b.data = res.data; b.updatedAt = Date.now();
  pp.boards = (pp.boards || []).filter(x => x.id !== b.id).concat([b]); await DB.put('projects', pp);
  const v = await menu('Dessin enregistré ✓', [{ label: 'Partager (WhatsApp…)', icon: 'share', value: 'sh' }, { label: 'Supprimer ce dessin', icon: 'trash', danger: true, value: 'del' }, { label: 'Fermer', icon: 'check', value: 'ok' }]);
  if (v === 'sh') shareBlob(res.blob, `${safeName(b.name)}.jpg`);
  if (v === 'del' && await confirmBox('Supprimer ce dessin ?')) { const q = await DB.get('projects', pid); q.boards = (q.boards || []).filter(x => x.id !== b.id); await DB.put('projects', q); }
}
