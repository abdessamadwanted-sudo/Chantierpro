// ================= v1.0.63 : Bons & modèles à remplir =================
// On ajoute un bon (PDF, ou photo du bon papier) : il reste comme modèle de référence, jamais modifié.
// Chaque remplissage est une copie : cases placées une fois (texte au clavier) + texte libre + stylo, en gros traits bien visibles.
// Le PDF final garde la qualité du modèle (on écrit par-dessus, en vectoriel).
const bnTpls = (p) => (p.bonTpls = Array.isArray(p.bonTpls) ? p.bonTpls : []);
const bnDocs = (p) => (p.bonDocs = Array.isArray(p.bonDocs) ? p.bonDocs : []);
const BN_COL = [['#1d3fbf', 'Bleu'], ['#111827', 'Noir'], ['#dc2626', 'Rouge'], ['#15803d', 'Vert']];
const bnAsk = async (msg, ok, no = 'Plus tard') => (await menu(msg, [{ label: ok, icon: 'check', value: 'ok' }, { label: no, icon: 'close', value: 'no' }])) === 'ok';
const BN_W = [[1.2, 'Fin'], [2.2, 'Moyen'], [3.4, 'Gras']];

// photo du bon → PDF d'une page (image gardée en pleine résolution)
async function bnImageToPdf(file) {
  const PDFLib = await needPdfLib(), im = await loadImage(URL.createObjectURL(file));
  const c = document.createElement('canvas'), k = Math.min(1, 4000 / Math.max(im.naturalWidth, im.naturalHeight)); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
  const jpg = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.93)); c.width = c.height = 0;
  const doc = await PDFLib.PDFDocument.create(), img = await doc.embedJpg(await jpg.arrayBuffer()), s = 842 / Math.max(img.width, img.height);
  const pg = doc.addPage([img.width * s, img.height * s]); pg.drawImage(img, { x: 0, y: 0, width: img.width * s, height: img.height * s });
  return new Blob([await doc.save()], { type: 'application/pdf' });
}
async function bnNewTpl(p) {
  const v = await menu('Ajouter un bon / PDF', [{ label: '📄 Un PDF (bon, fiche, formulaire…)', value: 'pdf' }, { label: '📷 Photo du bon papier (recadrée et nettoyée)', value: 'scan' }, { label: '🖼️ Photo telle quelle', value: 'img' }]);
  if (!v) return null;
  let [file] = await pickFiles({ accept: v === 'pdf' ? 'application/pdf' : 'image/*', multiple: false, capture: false }); if (!file) return null;
  if (v === 'scan' && typeof scanDocuments === 'function') { const L = await scanDocuments([file]); if (!L || !L[0]) return null; file = L[0]; }
  const r = await formSheet('Nom du modèle', [{ name: 'n', label: 'Nom', value: String(file.name || '').replace(/\.[a-z0-9]+$/i, '').slice(0, 60), placeholder: 'Ex : Bon de bétonnage' }], { okLabel: 'Enregistrer' }); if (!r || !r.n) return null;
  const ld = loading('Préparation du modèle…');
  try {
    const blob = v === 'pdf' ? file : await bnImageToPdf(file);
    const rec = await DB.put('files', { projectId: p.id, blob, mime: 'application/pdf', role: 'bontpl', name: `Modèle ${r.n}.pdf` });
    const tpl = { id: DB.uid(), name: r.n.trim(), fileId: rec.id, fields: [], at: Date.now() }; bnTpls(p).push(tpl); await DB.put('projects', p); ld.close();
    if (await bnAsk('Placer maintenant les cases à remplir (date, ouvrage, noms…) ? Vous pourrez aussi écrire n\'importe où au moment de remplir.', 'Placer les cases')) await ftEditor(p, tpl);
    return tpl;
  } catch (e) { ld.close(); alertBox('Modèle impossible : ' + (e.message || e)); return null; }
}

// ---------- bibliothèque ----------
async function openBons(p) {
  p = p || App.project; if (!p) return;
  const el = document.createElement('div'); el.className = 'fullpage bn-lib'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  const draw = () => {
    const T = bnTpls(p), D = bnDocs(p).slice().sort((a, b) => (b.at || 0) - (a.at || 0));
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title" style="flex:1"><b>Bons & modèles</b><span>${esc(p.name)}</span></div></div>
      <div class="bn-body">
        <button class="bn-add" data-a="new"><i>＋</i><span><b>Ajouter un bon ou un PDF</b><small>Il reste comme modèle : chaque remplissage est une copie</small></span></button>
        <h3 class="bn-h">Modèles <small>${T.length}</small></h3>
        ${T.length ? `<div class="bn-grid">${T.map(t => `<button class="bn-card" data-t="${t.id}"><i>📄</i><b>${esc(t.name)}</b><small>${(t.fields || []).length} case(s) · ${D.filter(d => d.tplId === t.id).length} rempli(s)</small><span class="bn-go">Remplir ›</span></button>`).join('')}</div>` : '<div class="empty">Aucun modèle. Ajoutez votre bon (PDF ou photo).</div>'}
        <h3 class="bn-h">Documents remplis <small>${D.length}</small></h3>
        ${D.length ? `<div class="bn-list">${D.map(d => `<button class="bn-doc" data-d="${d.id}"><i>✍️</i><span><b>${esc(d.name)}</b><small>${esc((T.find(t => t.id === d.tplId) || {}).name || 'Modèle supprimé')} · ${fmtDateTime(d.at)}</small></span></button>`).join('')}</div>` : '<div class="empty">Rien encore.</div>'}
      </div>`;
    ($('[data-a=x]', el)||{}).onclick = () => { unBack(); el.remove(); };
    ($('[data-a=new]', el)||{}).onclick = async () => { const t = await bnNewTpl(p); draw(); if (t && await bnAsk(`Remplir « ${t.name} » maintenant ?`, 'Remplir')) { await bnFill(p, t); draw(); } };
    $$('[data-t]', el).forEach(b => b.onclick = async () => { const t = bnTpls(p).find(x => x.id === b.dataset.t); if (!t) return;
      const v = await menu(t.name, [{ label: 'Remplir une copie', icon: 'edit', value: 'f' }, { label: 'Placer / modifier les cases', icon: 'grid', value: 'ed' }, { label: 'Voir le modèle', icon: 'eye', value: 'see' }, { label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Supprimer le modèle', icon: 'trash', danger: true, value: 'del' }]);
      if (v === 'f') await bnFill(p, t);
      if (v === 'ed') await ftEditor(p, t);
      if (v === 'see') { const f = await DB.get('files', t.fileId); if (f) openFileRecord(f, t.name); }
      if (v === 'ren') { const r = await formSheet('Renommer', [{ name: 'n', label: 'Nom', value: t.name }]); if (r && r.n) { t.name = r.n.trim(); await DB.put('projects', p); } }
      if (v === 'del' && await confirmBox(`Supprimer le modèle « ${t.name} » ? Les documents déjà remplis restent.`, 'Supprimer')) { await DB.del('files', t.fileId).catch(() => {}); p.bonTpls = bnTpls(p).filter(x => x !== t); await DB.put('projects', p); }
      draw(); });
    $$('[data-d]', el).forEach(b => b.onclick = async () => { const d = bnDocs(p).find(x => x.id === b.dataset.d); if (!d) return; const t = bnTpls(p).find(x => x.id === d.tplId);
      const v = await menu(d.name, [{ label: 'Ouvrir le PDF', icon: 'pdf', value: 'o' }, { label: 'Partager (WhatsApp…)', icon: 'share', value: 's' }, ...(t ? [{ label: 'Modifier', icon: 'edit', value: 'e' }, { label: 'Dupliquer (nouvelle copie)', icon: 'plus', value: 'dup' }] : []), { label: 'Supprimer', icon: 'trash', danger: true, value: 'del' }]);
      const f = d.fileId && await DB.get('files', d.fileId);
      if (v === 'o') { if (f) openFileRecord(f, d.name); else toast('PDF introuvable'); }
      if (v === 's') { if (f && f.blob) shareBlob(f.blob, d.name.replace(/\.pdf$/i, '') + '.pdf', { ask: false }); else toast('PDF introuvable'); }
      if (v === 'e') await bnFill(p, t, d);
      if (v === 'dup') await bnFill(p, t, { ...d, id: null, fileId: null, name: '' });
      if (v === 'del' && await confirmBox(`Supprimer « ${d.name} » ?`, 'Supprimer')) { if (d.fileId) await DB.del('files', d.fileId).catch(() => {}); p.bonDocs = bnDocs(p).filter(x => x !== d); await DB.put('projects', p); }
      draw(); });
  };
  draw();
}

// ---------- valeurs proposées pour les cases ----------
function bnDefaults(p, tpl, prev) {
  const [y, m, d] = todayISO().split('-'), last = (p.bonLast || {})[tpl.id] || {}, base = { date: `${d}/${m}/${y}`, jour: d, mois: m, annee: y };
  const v = {}; for (const f of tpl.fields || []) { const key = f.k === 'coche' || f.k === 'libre' ? f.id : f.k; if (key in v) continue;
    v[key] = prev && key in prev ? prev[key] : key in base ? base[key] : /^nom/.test(f.k) || f.k === 'proc' ? (last[key] || '') : f.k === 'coche' ? f.def !== false : f.k === 'libre' ? (f.def || '') : ''; }
  return v;
}

// ---------- remplissage ----------
async function bnFill(p, tpl, doc0) {
  if (!tpl) return toast('Modèle introuvable');
  if (!(await pdfReadyA())) return alertBox('Lecteur PDF indisponible');
  const src = await DB.get('files', tpl.fileId); if (!src || !src.blob) return alertBox('Modèle introuvable sur ce téléphone (ouvrez-le une fois avec du réseau)');
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await src.blob.arrayBuffer()) }).promise, N = Math.min(pdf.numPages, 20), sizes = [];
  for (let i = 1; i <= N; i++) { const v = (await pdf.getPage(i)).getViewport({ scale: 1 }); sizes.push([v.width, v.height]); }
  const st = { vals: bnDefaults(p, tpl, doc0 && doc0.vals), items: JSON.parse(JSON.stringify((doc0 && doc0.items) || [])), strokes: JSON.parse(JSON.stringify((doc0 && doc0.strokes) || [])) };
  let tool = 'hand', color = (() => { try { return localStorage.getItem('bn.c') || BN_COL[0][0]; } catch (e) { return BN_COL[0][0]; } })(), wid = +(localStorage.getItem('bn.w') || 2.2), Z = 1, dirty = false;
  const undo = [], snap = () => { undo.push(JSON.stringify({ items: st.items, strokes: st.strokes })); if (undo.length > 40) undo.shift(); dirty = true; };
  return new Promise((resolve) => {
    const el = document.createElement('div'); el.className = 'fullpage bn-fill'; document.body.appendChild(el);
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title" style="flex:1"><b>${esc(tpl.name)}</b><span>Remplir une copie · le modèle ne change pas</span></div><button class="btn small" data-a="ok">${icon('pdf')} PDF</button></div>
      <div class="bn-wrap"></div>
      <div class="bn-bar">
        <div class="bn-tools">${[['hand', '✋', 'Défiler'], ['text', 'T', 'Texte'], ['pen', '✏️', 'Stylo'], ['erase', '⌫', 'Gomme']].map(([k, i, l]) => `<button data-tool="${k}"><b>${i}</b><small>${l}</small></button>`).join('')}<button data-a="undo"><b>↶</b><small>Annuler</small></button></div>
        <div class="bn-opts"><span class="bn-cols">${BN_COL.map(([c, l]) => `<button data-col="${c}" title="${l}" style="--c:${c}"></button>`).join('')}</span>
          <span class="bn-ws">${BN_W.map(([w, l]) => `<button data-w="${w}">${l}</button>`).join('')}</span>
          <span class="bn-z"><button data-z="-1">－</button><button data-z="1">＋</button></span></div>
      </div>`;
    const wrap = $('.bn-wrap', el), canv = [];
    let S = 1;   // pixels écran par point PDF
    const close = (v) => { unBack(); canv.forEach(c => { c.width = c.height = 0; }); try { pdf.destroy(); } catch (e) {} el.remove(); resolve(v); };
    const unBack = pushBack(async () => { el.remove(); try { pdf.destroy(); } catch (e) {} resolve(null); });
    ($('[data-a=x]', el)||{}).onclick = async () => { if (dirty && !await bnAsk('Quitter sans créer le PDF ? Ce que vous avez écrit sera perdu.', 'Quitter', 'Continuer à écrire')) return; close(null); };
    const layout = async () => {
      S = (Math.min(window.innerWidth, 1000) - 16) * Z / sizes[0][0]; const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      wrap.innerHTML = sizes.map(([w, h], i) => `<div class="bn-page" data-pg="${i}" style="width:${w * S}px;height:${h * S}px"><canvas></canvas><svg viewBox="0 0 ${w} ${h}"></svg><div class="bn-layer"></div></div>`).join('');
      canv.forEach(c => { c.width = c.height = 0; }); canv.length = 0;
      for (let i = 0; i < sizes.length; i++) { const pgEl = $(`.bn-page[data-pg="${i}"]`, wrap), c = $('canvas', pgEl); canv.push(c); c.width = Math.round(sizes[i][0] * S * dpr); c.height = Math.round(sizes[i][1] * S * dpr); c.style.width = '100%'; c.style.height = '100%';
        (async () => { try { const pg = await pdf.getPage(i + 1); await pg.render({ canvasContext: c.getContext('2d'), viewport: pg.getViewport({ scale: S * dpr }), background: 'white' }).promise; } catch (e) {} })(); }
      paint(); bindPages();
    };
    const fit = (f) => f.size || Math.max(8, Math.min(16, f.h * .72));
    const paint = () => {
      $$('.bn-page', wrap).forEach(pgEl => { const i = +pgEl.dataset.pg, svg = $('svg', pgEl), lay = $('.bn-layer', pgEl);
        svg.innerHTML = st.strokes.map((s, k) => s.pg === i ? `<polyline data-sk="${k}" points="${s.pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="${s.c}" stroke-width="${s.w}" stroke-linecap="round" stroke-linejoin="round"/>` : '').join('');
        lay.innerHTML = (i === 0 ? (tpl.fields || []).map(f => { const key = f.k === 'coche' || f.k === 'libre' ? f.id : f.k, v = st.vals[key];
          return f.k === 'coche' ? `<button class="bn-f bn-ck ${v ? 'on' : ''}" data-fk="${esc(key)}" style="left:${f.x * S}px;top:${f.y * S}px;width:${f.w * S}px;height:${f.h * S}px">${v ? '✓' : ''}</button>`
            : `<input class="bn-f" data-fk="${esc(key)}" value="${esc(v == null ? '' : v)}" placeholder="${esc(ftLabel(f))}" style="left:${f.x * S}px;top:${f.y * S}px;width:${f.w * S}px;height:${f.h * S}px;font-size:${fit(f) * S}px;text-align:${f.align === 'left' ? 'left' : 'center'}">`; }).join('') : '')
          + st.items.map((t, k) => t.pg === i ? `<div class="bn-t" data-ik="${k}" style="left:${t.x * S}px;top:${t.y * S}px;font-size:${t.s * S}px;color:${t.c}">${esc(t.t).replace(/\n/g, '<br>')}</div>` : '').join('');
        $$('input.bn-f', lay).forEach(inp => inp.oninput = () => { st.vals[inp.dataset.fk] = inp.value; dirty = true; });
        $$('.bn-ck', lay).forEach(b => b.onclick = () => { st.vals[b.dataset.fk] = !st.vals[b.dataset.fk]; dirty = true; paint(); });
        $$('.bn-t', lay).forEach(d => bindItem(d));
        $$('polyline', svg).forEach(pl => pl.onclick = () => { if (tool !== 'erase') return; snap(); st.strokes.splice(+pl.dataset.sk, 1); paint(); });
      });
      el.dataset.tool = tool;
      $$('[data-tool]', el).forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
      $$('[data-col]', el).forEach(b => b.classList.toggle('on', b.dataset.col === color));
      $$('[data-w]', el).forEach(b => b.classList.toggle('on', +b.dataset.w === wid));
    };
    const pt = (pgEl, e) => { const r = pgEl.getBoundingClientRect(); return [+((e.clientX - r.left) / S).toFixed(1), +((e.clientY - r.top) / S).toFixed(1)]; };
    const editText = async (t, isNew) => {
      const r = await formSheet(isNew ? 'Texte' : 'Modifier le texte', [{ name: 't', label: 'Texte', type: 'textarea', value: t.t || '' }, { name: 's', label: 'Taille', type: 'select', value: String(t.s || 12), options: [9, 11, 12, 14, 16, 20, 26].map(x => ({ value: String(x), label: x + ' pt' })) }], { okLabel: 'OK', danger: isNew ? null : 'Supprimer' });
      if (!r) return false; snap();
      if (r.__danger) { st.items.splice(st.items.indexOf(t), 1); paint(); return true; }
      if (!String(r.t || '').trim()) { if (!isNew) st.items.splice(st.items.indexOf(t), 1); paint(); return true; }
      t.t = String(r.t); t.s = +r.s || 12; if (isNew) st.items.push(t); paint(); return true;
    };
    const bindItem = (d) => { const t = st.items[+d.dataset.ik];
      d.onpointerdown = (e) => { if (tool === 'pen') return; e.stopPropagation(); if (tool === 'erase') { snap(); st.items.splice(st.items.indexOf(t), 1); paint(); return; }
        const sx = e.clientX, sy = e.clientY, ox = t.x, oy = t.y; let moved = false; d.setPointerCapture && d.setPointerCapture(e.pointerId);
        const mv = (ev) => { const dx = (ev.clientX - sx) / S, dy = (ev.clientY - sy) / S; if (!moved && Math.hypot(dx, dy) * S > 6) { moved = true; snap(); } if (moved) { t.x = ox + dx; t.y = oy + dy; d.style.left = t.x * S + 'px'; d.style.top = t.y * S + 'px'; } };
        const up = () => { d.removeEventListener('pointermove', mv); d.removeEventListener('pointerup', up); if (!moved) editText(t, false); };
        d.addEventListener('pointermove', mv); d.addEventListener('pointerup', up); };
    };
    const bindPages = () => $$('.bn-page', wrap).forEach(pgEl => {
      const i = +pgEl.dataset.pg; let cur = null;
      pgEl.onpointerdown = (e) => {
        if (e.target.closest('.bn-f, .bn-t')) return;
        if (tool === 'text') { const [x, y] = pt(pgEl, e); editText({ pg: i, x, y: y - 6, s: 12, c: color, t: '' }, true); return; }
        if (tool !== 'pen') return;
        e.preventDefault(); snap(); cur = { pg: i, c: color, w: wid, pts: [pt(pgEl, e)] }; st.strokes.push(cur); pgEl.setPointerCapture && pgEl.setPointerCapture(e.pointerId);
        const svg = $('svg', pgEl), pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', color); pl.setAttribute('stroke-width', wid); pl.setAttribute('stroke-linecap', 'round'); pl.setAttribute('stroke-linejoin', 'round'); svg.appendChild(pl);
        const mv = (ev) => { const q = pt(pgEl, ev), l = cur.pts[cur.pts.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) < 0.6) return; cur.pts.push(q); pl.setAttribute('points', cur.pts.map(a => a.join(',')).join(' ')); };
        const up = () => { pgEl.removeEventListener('pointermove', mv); pgEl.removeEventListener('pointerup', up); pgEl.removeEventListener('pointercancel', up); if (cur.pts.length === 1) cur.pts.push([cur.pts[0][0] + 0.3, cur.pts[0][1] + 0.3]); cur = null; paint(); };
        pgEl.addEventListener('pointermove', mv); pgEl.addEventListener('pointerup', up); pgEl.addEventListener('pointercancel', up);
      };
    });
    $$('[data-tool]', el).forEach(b => b.onclick = () => { tool = b.dataset.tool; if (tool === 'text') toast('Touchez la feuille là où écrire'); if (tool === 'pen') toast('Écrivez au doigt · ✋ pour défiler'); paint(); });
    $$('[data-col]', el).forEach(b => b.onclick = () => { color = b.dataset.col; try { localStorage.setItem('bn.c', color); } catch (e) {} paint(); });
    $$('[data-w]', el).forEach(b => b.onclick = () => { wid = +b.dataset.w; try { localStorage.setItem('bn.w', wid); } catch (e) {} paint(); });
    ($('[data-a=undo]', el)||{}).onclick = () => { const s = undo.pop(); if (!s) return toast('Rien à annuler'); const o = JSON.parse(s); st.items = o.items; st.strokes = o.strokes; paint(); };
    $$('[data-z]', el).forEach(b => b.onclick = () => { const cy = (wrap.scrollTop + wrap.clientHeight / 2) / S; Z = Math.max(1, Math.min(3.5, Z * (b.dataset.z === '1' ? 1.35 : 1 / 1.35))); layout(); wrap.scrollTop = cy * S - wrap.clientHeight / 2; });
    ($('[data-a=ok]', el)||{}).onclick = async () => {
      const dt = todayISO().split('-').reverse().join('-'), first = Object.values(st.vals).find(v => typeof v === 'string' && v.trim() && !/^\d{2}\/\d{2}\/\d{4}$/.test(v)) || '';
      const r = await formSheet('Créer le PDF', [{ name: 'n', label: 'Nom du fichier', value: (doc0 && doc0.name) || avFileName([tpl.name, first, dt].filter(Boolean).join(' - ')) }], { okLabel: 'Créer' }); if (!r) return;
      const ld = loading('Écriture du PDF…');
      try {
        const blob = await bnMakePdf(src.blob, tpl, st), name = avFileName(r.n || tpl.name).replace(/\.pdf$/i, '');
        const old = doc0 && doc0.id && bnDocs(p).find(x => x.id === doc0.id);
        const rec = await DB.put('files', { ...(old && old.fileId ? { id: old.fileId } : {}), projectId: p.id, blob, mime: 'application/pdf', role: 'bonfill', name: name + '.pdf' });
        const d = old || { id: DB.uid(), tplId: tpl.id }; Object.assign(d, { name, fileId: rec.id, at: Date.now(), vals: st.vals, items: st.items, strokes: st.strokes }); if (!old) bnDocs(p).push(d);
        const last = (p.bonLast = p.bonLast || {})[tpl.id] = {}; for (const f of tpl.fields || []) if (/^nom/.test(f.k) || f.k === 'proc') last[f.k] = st.vals[f.k] || '';
        await DB.put('projects', p); ld.close(); dirty = false; close(d);
        const v = await menu(`✓ ${name}.pdf`, [{ label: 'Partager (WhatsApp…)', icon: 'share', value: 's' }, { label: 'Ouvrir', icon: 'eye', value: 'o' }, { label: 'Fermer', icon: 'close', value: 'x' }]);
        if (v === 's') shareBlob(blob, name + '.pdf', { ask: false }); if (v === 'o') openFileRecord(rec, rec.name);
      } catch (e) { ld.close(); alertBox('PDF impossible : ' + (e.message || e)); }
    };
    layout();
  });
}

// PDF final : le modèle d'origine (vectoriel) + l'écriture par-dessus
async function bnMakePdf(blob, tpl, st) {
  const PDFLib = await needPdfLib(), { rgb, StandardFonts } = PDFLib;
  const doc = await PDFLib.PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true }), font = await doc.embedFont(StandardFonts.HelveticaBold), pages = doc.getPages();
  const col = (h) => { const n = parseInt(String(h || '#1d3fbf').slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
  // texte : police vectorielle ; si un caractère n'existe pas (arabe…), le texte est dessiné en image nette
  const text = async (pg, str, x, yTop, size, c, maxW, align) => {
    const H = pg.getHeight(); let s = size;
    try { let w = font.widthOfTextAtSize(str, s); if (maxW && w > maxW) { s = Math.max(5, s * maxW / w); w = font.widthOfTextAtSize(str, s); }
      const dx = align === 'center' && maxW ? (maxW - w) / 2 : 0; pg.drawText(str, { x: x + dx, y: H - yTop - s * 0.85, size: s, font, color: col(c) }); }
    catch (e) { const cv = document.createElement('canvas'), k = 4, g0 = cv.getContext('2d'); g0.font = `bold ${s * k}px sans-serif`; const w = g0.measureText(str).width; cv.width = Math.ceil(w) + 4; cv.height = Math.ceil(s * k * 1.3);
      const g = cv.getContext('2d'); g.font = `bold ${s * k}px sans-serif`; g.fillStyle = c; g.textBaseline = 'top'; g.fillText(str, 2, 0);
      const png = await doc.embedPng(await (await new Promise(r => cv.toBlob(r, 'image/png'))).arrayBuffer()); let W = cv.width / k, Hh = cv.height / k; if (maxW && W > maxW) { Hh *= maxW / W; W = maxW; }
      pg.drawImage(png, { x: x + (align === 'center' && maxW ? (maxW - W) / 2 : 0), y: H - yTop - Hh, width: W, height: Hh }); }
  };
  const p0 = pages[0];
  for (const f of tpl.fields || []) { const key = f.k === 'coche' || f.k === 'libre' ? f.id : f.k, v = st.vals[key];
    if (f.k === 'coche') { if (v) { const H = p0.getHeight(), s = Math.min(f.w, f.h) * 0.8; p0.drawSvgPath(`M ${f.x + f.w * .2} ${f.y + f.h * .55} L ${f.x + f.w * .42} ${f.y + f.h * .8} L ${f.x + f.w * .82} ${f.y + f.h * .2}`, { x: 0, y: H, borderColor: col('#1d3fbf'), borderWidth: Math.max(1.4, s * 0.14) }); } continue; }
    if (v == null || String(v).trim() === '') continue;
    const s = f.size || Math.max(8, Math.min(16, f.h * .72)); await text(p0, String(v), f.x + 1, f.y + (f.h - s) / 2, s, '#1d3fbf', f.w - 2, f.align === 'left' ? 'left' : 'center'); }
  for (const t of st.items || []) { const pg = pages[t.pg]; if (!pg) continue; const L = String(t.t).split('\n'); for (let i = 0; i < L.length; i++) if (L[i]) await text(pg, L[i], t.x, t.y + i * t.s * 1.2, t.s, t.c); }
  for (const s of st.strokes || []) { const pg = pages[s.pg]; if (!pg || s.pts.length < 2) continue;
    const d = 'M ' + s.pts.map(q => q[0] + ' ' + q[1]).join(' L ');
    const o = { x: 0, y: pg.getHeight(), borderColor: col(s.c), borderWidth: s.w }; try { if (PDFLib.LineCapStyle) o.borderLineCap = PDFLib.LineCapStyle.Round; } catch (e) {}
    pg.drawSvgPath(d, o); }
  return new Blob([await doc.save()], { type: 'application/pdf' });
}
