// ================= Comparer les niveaux (v3) : plan de base → niveaux au-dessus → équerre (une fois par plan) → rideau / clignotement / transparence =================
// Les plans restent nets et à leurs couleurs (pas de superposition colorée) ; un cercle et une flèche montrent chaque changement de structure.
// Calage : chaque plan garde son repère (croisement de deux fils + direction) → toutes les paires sont calées sans recommencer.
async function lvsLevels(projectId) {
  const [plans, folders] = await Promise.all([DB.byProject('plans', projectId), DB.byProject('folders', projectId)]);
  const fn = (p) => (folders.find(f => f.id === p.folderId) || {}).name || '';
  const niv = (p) => (typeof nivOfFolder === 'function' && (nivOfFolder(fn(p)) || nivOfFolder(p.name))) || '';
  const rank = (n) => { const m = String(n).match(/R\+?(\d+)/i); return /ssl|ss\d*|sous/i.test(n) ? -2 : /fond/i.test(n) ? -3 : /rdc/i.test(n) ? 0 : /mezz/i.test(n) ? -1 : /terr/i.test(n) ? 99 : m ? +m[1] : null; };
  return plans.filter(p => p.fileId && (typeof isCurrentPlan !== 'function' || isCurrentPlan(p))).map(p => { const n = niv(p); return { p, niv: n, rank: rank(n || p.name), label: `${n ? n + ' · ' : ''}${p.name}` }; })
    .sort((a, b) => (a.rank ?? 50) - (b.rank ?? 50) || a.label.localeCompare(b.label, 'fr', { numeric: true }));
}
// feuille de choix avec interrupteurs (plusieurs niveaux)
function lvsPick(title, items, pre, { sub, multi = true, okLabel = 'Suivant ›', extra } = {}) {
  return new Promise((resolve) => {
    const on = new Set(pre); let res = null;
    const s = sheet(`<div class="ft-w"><div class="ft">${sub ? `<p class="ft-sub">${sub}</p>` : ''}${extra || ''}
      ${items.map(it => `<button class="ft-r ${on.has(it.p.id) ? 'on' : ''}" data-id="${it.p.id}"><span class="grow">${esc(it.label)}${it.p.lvRef ? ' <small style="color:#22c55e">📏 calé</small>' : ''}</span><i class="ft-sw"><u></u></i></button>`).join('') || '<div class="fn-empty">Aucun plan</div>'}
      <button class="btn ft-ok" data-ok>${okLabel}</button></div></div>`, { title });
    const sync = () => $$('[data-id]', s.el).forEach(b => b.classList.toggle('on', on.has(b.dataset.id)));
    $$('[data-id]', s.el).forEach(b => b.onclick = () => { const id = b.dataset.id; if (!multi) on.clear(); on.has(id) ? on.delete(id) : on.add(id); sync(); });
    const all = $('[data-all]', s.el); if (all) all.onclick = () => { items.forEach(it => on.add(it.p.id)); sync(); };
    $('[data-ok]', s.el).onclick = () => { if (!on.size) return toast('Choisissez au moins un plan'); res = items.filter(it => on.has(it.p.id)); s.close(); };
    s.onClose = () => resolve(res);
  });
}
// choix : niveau de base puis niveau supérieur (toujours deux niveaux), puis le plan de chaque niveau si besoin
const lvsSim = (a, b) => { const w = (x) => new Set(String(x).toLowerCase().replace(/r\s?\+\s?\d+|rdc|ssl|niveau|niv/g, ' ').split(/[^a-zà-ü0-9]+/).filter(t => t.length > 2)); const A = w(a), B = w(b); let n = 0; A.forEach(t => B.has(t) && n++); return n; };
function lvsGroups(L) {
  const G = new Map(); for (const x of L) { const k = x.niv || 'Sans niveau'; if (!G.has(k)) G.set(k, { niv: k, rank: x.niv ? x.rank : 999, items: [] }); G.get(k).items.push(x); }
  return [...G.values()].sort((a, b) => (a.rank ?? 50) - (b.rank ?? 50) || a.niv.localeCompare(b.niv, 'fr', { numeric: true }));
}
async function lvsPlanOf(g, title, like) {
  if (g.items.length === 1) return g.items[0];
  const its = like ? [...g.items].sort((a, b) => lvsSim(like, b.p.name) - lvsSim(like, a.p.name)) : g.items;
  const id = await menu(title, its.map((x, i) => ({ label: `${x.p.name}${like && i === 0 && lvsSim(like, x.p.name) ? '  · proposé' : ''}${x.p.lvRef ? '  📏' : ''}`, icon: 'plans', value: x.p.id })));
  return id ? g.items.find(x => x.p.id === id) : null;
}
async function lvsChoosePair(L, startPlan) {
  const G = lvsGroups(L);
  const g0 = startPlan ? G.find(g => g.items.some(x => x.p.id === startPlan.id)) : null;
  const v1 = await menu('1 · Niveau de base (dessous)', G.map((g, i) => ({ label: `${g.niv}${g.items.length > 1 ? `  (${g.items.length} plans)` : ' · ' + g.items[0].p.name}`, icon: 'layers', value: String(i), checked: g === g0 })));
  if (v1 == null) return null; const gb = G[+v1];
  const base = startPlan && gb === g0 ? g0.items.find(x => x.p.id === startPlan.id) : await lvsPlanOf(gb, `Plan de ${gb.niv}`); if (!base) return null;
  const others = G.filter(g => g !== gb), above = others.filter(g => gb.rank === 999 || g.rank === 999 || g.rank > gb.rank), restG = others.filter(g => !above.includes(g)), ord = [...above, ...restG];
  if (!ord.length) { toast('Aucun autre niveau'); return null; }
  const v2 = await menu(`2 · Niveau supérieur (au-dessus de ${gb.niv})`, ord.map((g, i) => ({ label: `${g.niv}${i === 0 && above.length ? '  · proposé' : ''}${restG.includes(g) ? '  (en dessous)' : ''}${g.items.length > 1 ? `  (${g.items.length} plans)` : ' · ' + g.items[0].p.name}`, icon: 'layers', value: String(i) })));
  if (v2 == null) return null; const gu = ord[+v2];
  const up = await lvsPlanOf(gu, `Plan de ${gu.niv}`, base.p.name); if (!up) return null;
  return [base, up];
}
async function openLevelStack(startPlan) {
  const pid = (startPlan && startPlan.projectId) || App.project.id, L = await lvsLevels(pid);
  if (L.length < 2) return toast('Il faut au moins deux plans (deux niveaux)');
  const pr = await lvsChoosePair(L, startPlan); if (!pr) return;
  // calage à l'équerre : une fois par plan (enregistré dans le plan)
  let todo = pr.filter(x => !x.p.lvRef);
  if (!todo.length) { const v = await menu('Les deux plans sont déjà calés ✓', [{ label: 'Comparer avec ces calages', icon: 'check', value: 'use' }, { label: 'Refaire le calage à l\'équerre', icon: 'ruler', value: 'all' }]); if (!v) return; if (v === 'all') todo = pr; }
  if (todo.length) { const ok = await openEquerreSteps(todo.map(x => x.p), todo.map(x => x.niv || x.p.name), pr[0].p); if (!ok) return; }
  openStackView(pr);
}
// image allégée pour l'écran (le zoom net vient du rendu HD de la zone visible)
const _lvsLite = new Map();
async function lvsLiteURL(fileId, max = 2400) {
  if (_lvsLite.has(fileId)) return _lvsLite.get(fileId);
  const pr = (async () => { const f = await DB.get('files', fileId); if (!f || !f.blob) return fileURL(fileId);
    try { const bm = await createImageBitmap(f.blob), k = Math.min(1, max / Math.max(bm.width, bm.height)); if (k >= 1) { bm.close && bm.close(); return BlobURL.get(f.id, f.blob); }
      const c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bm, 0, 0, c.width, c.height); bm.close && bm.close();
      const b = await new Promise(r => c.toBlob(r, 'image/jpeg', .9)); c.width = c.height = 0; return URL.createObjectURL(b); } catch (e) { return BlobURL.get(f.id, f.blob); } })();
  _lvsLite.set(fileId, pr); return pr;
}
// matrice niveau du dessous → niveau du dessus, à partir des deux repères (équerre)
async function lvsMap(low, up) {
  const A = low.lvRef, B = up.lvRef, sc = await lvPxScale(low, up);
  let rot = B.ang - A.ang; rot = Math.atan2(Math.sin(rot), Math.cos(rot)); if (Math.abs(rot) < 0.002) rot = 0;
  const c = Math.cos(rot), s = Math.sin(rot);
  return { sx: sc, sy: sc, rot, ox: B.p[0] - sc * (c * A.p[0] - s * A.p[1]), oy: B.p[1] - sc * (s * A.p[0] + c * A.p[1]) };
}
const _lvsDiff = new Map();
async function lvsChanges(low, up, M) {
  const key = `${low.id}|${up.id}|${[M.sx, M.rot, M.ox, M.oy].map(v => Math.round(v * 100)).join(',')}`;
  if (!_lvsDiff.has(key)) _lvsDiff.set(key, planDiff(low, up, 1800, { map: M, struct: true }).then(D => { D.canvas.width = D.canvas.height = 0; return D.rects; }));
  return _lvsDiff.get(key);
}
const lvsShort = (n) => { n = String(n || ''); if (n.length <= 16) return n; const t = n.split(/[-_ ]+/).filter(Boolean); return '…' + t.slice(-2).join('-'); };
const lvsKey = (q) => `${Math.round((q.x + q.w / 2) / 20)},${Math.round((q.y + q.h / 2) / 20)}`;
async function openStackView(chain) {
  chain = [...chain];
  let hdSeq = 0, hdLast = null, hdBusy = false, hdAgain = false, hdT = 0, k = 0, mode = 'curtain', marks = true, M = null, R = [], blinkT = 0, split = .5, op = .55, pz = null;
  const el = document.createElement('div'); el.className = 'fullpage av-page lvs';
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title" style="flex:1"><b class="lvs-t"></b><span class="lvs-s"></span></div>
      <button class="iconbtn" data-a="cal" title="Refaire le calage de cette paire">${icon('ruler')}</button><button class="iconbtn" data-a="share">${icon('share')}</button></div>
    <div class="av-chips lvs-modes"><button data-m="curtain">🎚️ Rideau</button><button data-m="blink">👁️ Clignoter</button><button data-m="fade">🔆 Transparence</button><button data-m="marks" class="on">◯ Repères</button></div>
    <div class="lvs-wrap"><div class="lvs-v"></div><div class="lvs-split"><i></i><b class="l"></b><b class="r"></b></div><div class="lvs-pill"></div></div>
    <div class="lvs-bar"><input type="range" min="0" max="100" class="lvs-op"><div class="lvs-nav"><button class="btn small ghost" data-a="chg">⇅ Changer les niveaux</button><button class="btn small" data-a="list">Changements</button></div></div>`;
  document.body.appendChild(el);
  const unBack = pushBack(() => close()); const close = () => { clearInterval(blinkT); clearTimeout(hdT); hdSeq++; el.remove(); };
  $('[data-a=x]', el).onclick = () => { unBack(); close(); };
  const wrap = $('.lvs-wrap', el), splitEl = $('.lvs-split', el), pill = $('.lvs-pill', el), opEl = $('.lvs-op', el);
  let imgLow, imgUp, ov, view;
  const pair = () => [chain[k].p, chain[k + 1].p], nm = (i) => chain[i].niv || lvsShort(chain[i].p.name);
  // rideau : on déplace seulement une « fenêtre » (pas de re-dessin du plan) → fluide, sans zones blanches
  const applySplit = () => { if (!imgUp) return; const r = wrap.getBoundingClientRect(), X = mode === 'curtain' ? split * r.width : 0; splitEl.style.left = split * r.width + 'px';
    imgUp.style.left = X + 'px'; imgUp.firstElementChild.style.left = -X + 'px'; };
  const drawMarks = () => { if (!ov || !pz) return; const s = pz.st.s, [, up] = pair(), seen = ((up.lvSeen || {})[chain[k].p.id]) || [];
    ov.innerHTML = !marks ? '' : R.map((q, i) => { const cx = q.x + q.w / 2, cy = q.y + q.h / 2, Rr = Math.max(q.w, q.h) / 2 * 1.25 + 8 / s, ok = seen.includes(lvsKey(q)), c = ok ? '#22c55e' : '#f97316';
      const ax = cx - Rr * .707, ay = cy - Rr * .707, bx = ax - 44 / s, by = ay - 44 / s, h = 11 / s;
      return `<g data-q="${i}"><circle cx="${cx}" cy="${cy}" r="${Rr}" fill="${c}" fill-opacity=".07" stroke="${c}" stroke-width="${2.6 / s}" ${ok ? `stroke-dasharray="${6 / s} ${4 / s}"` : ''}/>
        ${ok ? `<text x="${cx}" y="${cy - Rr - 4 / s}" text-anchor="middle" font-size="${14 / s}" fill="${c}" font-weight="800">✓</text>` : `<line x1="${bx}" y1="${by}" x2="${ax - 3 / s}" y2="${ay - 3 / s}" stroke="${c}" stroke-width="${3 / s}" stroke-linecap="round"/><path d="M${ax} ${ay} l${-h} ${-h * .35} l${h * .65} ${-h * .65} z" fill="${c}"/>`}</g>`; }).join(''); };
  const setMode = (m) => {
    if (m === 'marks') { marks = !marks; $('[data-m=marks]', el).classList.toggle('on', marks); return drawMarks(); }
    mode = m; clearInterval(blinkT); $$('.lvs-modes [data-m]', el).forEach(b => b.dataset.m !== 'marks' && b.classList.toggle('on', b.dataset.m === m));
    splitEl.style.display = m === 'curtain' ? '' : 'none'; opEl.style.display = m === 'fade' ? '' : 'none'; pill.style.display = m === 'blink' ? '' : 'none';
    if (!imgUp) return; imgUp.style.opacity = m === 'fade' ? op : 1; imgUp.style.visibility = 'visible'; applySplit();
    if (m === 'blink') { let on = true; const tick = () => { on = !on; imgUp.style.visibility = on ? 'visible' : 'hidden'; pill.textContent = on ? `▲ ${nm(k + 1)}` : `▼ ${nm(k)}`; }; pill.textContent = `▲ ${nm(k + 1)}`; blinkT = setInterval(tick, 950);
      pill.onclick = () => { if (blinkT) { clearInterval(blinkT); blinkT = 0; pill.textContent += ' ⏸'; } else setMode('blink'); }; }
  };
  $$('.lvs-modes [data-m]', el).forEach(b => b.onclick = () => setMode(b.dataset.m));
  opEl.value = op * 100; opEl.oninput = () => { op = opEl.value / 100; if (imgUp) imgUp.style.opacity = op; };
  // rideau : la barre se glisse au doigt
  splitEl.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); const r = wrap.getBoundingClientRect();
    const mv = (ev) => { split = Math.max(.03, Math.min(.97, (ev.clientX - r.left) / r.width)); applySplit(); };
    const upf = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upf); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upf); };
  const load = async () => {
    const [low, up] = pair(); M = await lvsMap(low, up); R = [];
    $('.lvs-t', el).textContent = `${nm(k)} → ${nm(k + 1)}`; $('.lvs-s', el).textContent = `base ${nm(k)} · supérieur ${nm(k + 1)}`;
    $('.lvs-split .l', el).textContent = `◀ ${nm(k)}`; $('.lvs-split .r', el).textContent = `${nm(k + 1)} ▶`;
    const [sl, su] = await Promise.all([lvsLiteURL(low.fileId), lvsLiteURL(up.fileId)]);
    if (view) view.remove(); view = document.createElement('div'); view.className = 'av-view lvs-vv'; $('.lvs-v', el).appendChild(view);
    const c = Math.cos(M.rot), s = Math.sin(M.rot);
    view.innerHTML = `<div class="av-stage lvs-sl"><div class="lvs-L lo"><img class="lo" width="${low.w}" height="${low.h}" src="${sl}" decoding="async" style="transform-origin:0 0;transform:matrix(${M.sx * c},${M.sx * s},${-M.sx * s},${M.sx * c},${M.ox},${M.oy})"><canvas class="lvs-hd"></canvas></div></div>
      <div class="lvs-cw"><div class="av-stage lvs-su"><div class="lvs-L hi" style="width:${up.w}px;height:${up.h}px"><img width="${up.w}" height="${up.h}" src="${su}" decoding="async"><canvas class="lvs-hd"></canvas></div></div></div>
      <div class="av-stage lvs-so"><svg class="av-ov" width="${up.w}" height="${up.h}" viewBox="0 0 ${up.w} ${up.h}"></svg></div>`;
    imgLow = $('img.lo', view); imgUp = $('.lvs-cw', view); ov = $('svg', view);
    // les trois calques (dessous, dessus, repères) bougent ensemble, dans la même image
    const layers = [$('.lvs-sl', view), $('.lvs-su', view), $('.lvs-so', view)], stageProxy = { style: {} };
    Object.defineProperty(stageProxy.style, 'transform', { set(v) { for (const l of layers) l.style.transform = v; }, get() { return layers[0].style.transform; } });
    const [hdLo, hdHi] = $$('.lvs-hd', view), seqL = ++hdSeq; hdLast = null;
    const PP = Promise.all([planPdfPage(low), planPdfPage(up)]).catch(() => [null, null]);
    // rendu net (PDF / image) de la zone visible quand on zoome : les deux niveaux, au même endroit
    const renderHD = async () => {
      if (hdBusy) { hdAgain = true; return; }
      const st = pz.st, r = view.getBoundingClientRect(), [ax, ay] = pz.toImg([0, 0]), [bx, by] = pz.toImg([r.width, r.height]);
      const v = { x0: Math.max(0, ax), y0: Math.max(0, ay), x1: Math.min(up.w, bx), y1: Math.min(up.h, by), s: st.s };
      if (v.x1 - v.x0 < 4 || v.y1 - v.y0 < 4 || st.s < st.fit * 1.3) { hdLo.style.display = hdHi.style.display = 'none'; hdLast = null; return; }
      if (hdLast && v.x0 >= hdLast.x0 && v.y0 >= hdLast.y0 && v.x1 <= hdLast.x1 && v.y1 <= hdLast.y1 && Math.abs(Math.log(v.s / hdLast.s)) < .25) return;
      hdBusy = true;
      const mw = (v.x1 - v.x0) * .25, mh = (v.y1 - v.y0) * .25, x0 = Math.max(0, v.x0 - mw), y0 = Math.max(0, v.y0 - mh), x1 = Math.min(up.w, v.x1 + mw), y1 = Math.min(up.h, v.y1 + mh);
      const dpr = Math.min(1.5, window.devicePixelRatio || 1); let oW = Math.round((x1 - x0) * st.s * dpr), oH = Math.round((y1 - y0) * st.s * dpr);
      const cap = Math.min(1, 1800 / Math.max(oW, oH), Math.sqrt(2e6 / (oW * oH))); if (cap < 1) { oW = Math.round(oW * cap); oH = Math.round(oH * cap); }
      try {
        const [PA, PB] = await PP;
        const [ca, cb] = await Promise.all([renderPlanRegion(low, PA, x0, y0, x1 - x0, y1 - y0, oW, oH, M, true), renderPlanRegion(up, PB, x0, y0, x1 - x0, y1 - y0, oW, oH, { sx: 1, sy: 1, ox: 0, oy: 0 }, true)]);
        if (seqL === hdSeq && el.isConnected) for (const [cv, src] of [[hdLo, ca], [hdHi, cb]]) {
          cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0);
          Object.assign(cv.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px', display: '' }); }
        hdLast = { x0, y0, x1, y1, s: st.s }; ca.width = ca.height = cb.width = cb.height = 0;
      } catch (e) { console.warn('hd', e); } finally { hdBusy = false; if (hdAgain) { hdAgain = false; clearTimeout(hdT); hdT = setTimeout(renderHD, 120); } }
    };
    pz = panZoom(view, stageProxy, up.w, up.h, { onChange: (st) => { cancelAnimationFrame(drawMarks._r); drawMarks._r = requestAnimationFrame(drawMarks);
      if (hdLast && Math.abs(Math.log(st.s / hdLast.s)) >= .25) { hdLo.style.display = hdHi.style.display = 'none'; hdLast = null; } clearTimeout(hdT); hdT = setTimeout(renderHD, 450); }, onTap: ([x, y]) => tapAt(x, y) });
    requestAnimationFrame(() => { pz.fit(); setMode(mode); drawMarks(); });
    pill.style.display = mode === 'blink' ? '' : 'none';
    const busy = document.createElement('div'); busy.className = 'lvs-busy'; busy.textContent = 'Recherche des changements…'; wrap.appendChild(busy);
    await new Promise(r => setTimeout(r, 700)); if (pair()[1] !== up || !el.isConnected) { busy.remove(); return; }   // les plans s'affichent d'abord
    try { const r = await lvsChanges(low, up, M); if (pair()[1] === up) { R = r; drawMarks(); up.lvChk = up.lvChk || {}; const o = up.lvChk[low.id] || {}; if (o.n !== R.length || !o.lowName) { up.lvChk[low.id] = { n: R.length, at: Date.now(), lowName: nm(k), upName: nm(k + 1) }; DB.put('plans', up).catch(() => {}); } } } catch (e) { console.warn(e); } finally { busy.remove(); }
  };
  $('[data-a=chg]', el).onclick = async () => { const L = await lvsLevels(chain[0].p.projectId), pr = await lvsChoosePair(L, chain[0].p); if (!pr) return;
    const todo = pr.filter(x => !x.p.lvRef); if (todo.length && !(await openEquerreSteps(todo.map(x => x.p), todo.map(x => x.niv || x.p.name), pr[0].p))) return;
    chain = pr; k = 0; load(); };
  $('[data-a=cal]', el).onclick = async () => { const [low, up] = pair(); if (await openEquerreSteps([low, up], [nm(k), nm(k + 1)], low)) load(); };
  // toucher un cercle : zoomer, vu, réserve, RFI
  const setSeen = async (q, v) => { const [low, up] = pair(); up.lvSeen = up.lvSeen || {}; const L = new Set(up.lvSeen[low.id] || []); v ? L.add(lvsKey(q)) : L.delete(lvsKey(q)); up.lvSeen[low.id] = [...L];
    up.lvChk = up.lvChk || {}; up.lvChk[low.id] = { n: R.length, at: Date.now(), lowName: nm(k), upName: nm(k + 1) }; await DB.put('plans', up); drawMarks(); };
  const where = (q) => { const [, up] = pair(), cx = (q.x + q.w / 2) / up.w, cy = (q.y + q.h / 2) / up.h; return `${cy < .34 ? 'en haut' : cy > .66 ? 'en bas' : 'au milieu'}${cx < .34 ? ' à gauche' : cx > .66 ? ' à droite' : ''}`; };
  const crop = async (q) => {   // photo de la zone sur les deux niveaux, côte à côte
    const [low, up] = pair(), pad = Math.max(q.w, q.h) * .8 + 40, x0 = q.x - pad, y0 = q.y - pad, w = q.w + 2 * pad, h = q.h + 2 * pad, S = Math.min(1, 900 / w);
    const cv = document.createElement('canvas'); cv.width = Math.round(w * S) * 2 + 12; cv.height = Math.round(h * S) + 40; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    const [il, iu] = await Promise.all([fileURL(low.fileId).then(loadImage), fileURL(up.fileId).then(loadImage)]), c = Math.cos(M.rot), s = Math.sin(M.rot), W1 = Math.round(w * S);
    g.save(); g.beginPath(); g.rect(0, 40, W1, cv.height); g.clip(); g.translate(-x0 * S, 40 - y0 * S); g.scale(S, S); g.transform(M.sx * c, M.sx * s, -M.sx * s, M.sx * c, M.ox, M.oy); g.drawImage(il, 0, 0); g.restore();
    g.save(); g.beginPath(); g.rect(W1 + 12, 40, W1, cv.height); g.clip(); g.translate(W1 + 12 - x0 * S, 40 - y0 * S); g.scale(S, S); g.drawImage(iu, 0, 0); g.restore();
    g.fillStyle = '#111'; g.font = 'bold 22px Arial'; g.fillText(nm(k), 8, 28); g.fillText(nm(k + 1), W1 + 20, 28);
    g.strokeStyle = '#f97316'; g.lineWidth = 3; for (const ox of [0, W1 + 12]) { g.beginPath(); g.arc(ox + (q.x + q.w / 2 - x0) * S, 40 + (q.y + q.h / 2 - y0) * S, Math.max(q.w, q.h) / 2 * S * 1.25 + 8, 0, 7); g.stroke(); }
    return new Promise(r => cv.toBlob(r, 'image/jpeg', .9));
  };
  const actOn = async (i) => {
    const q = R[i], [low, up] = pair(), seen = ((up.lvSeen || {})[low.id] || []).includes(lvsKey(q));
    const v = await menu(`Changement ${where(q)}`, [{ label: 'Zoomer dessus', icon: 'search', value: 'zoom' }, { label: seen ? 'Remettre « à vérifier »' : '✅ Marquer vu', icon: 'check', value: 'seen' },
      { label: '📌 Créer une réserve ici', icon: 'tasks', value: 'task' }, { label: '❓ Demande (RFI) au BET avec photo', icon: 'ask', value: 'rfi' }]);
    if (v === 'zoom') pz.zoomTo(q.x - q.w * 2.5, q.y - q.h * 2.5, q.w * 6, q.h * 6);
    if (v === 'seen') setSeen(q, !seen);
    if (v === 'task') { const t = await newTask({ planId: up.id, x: q.x + q.w / 2, y: q.y + q.h / 2, title: `Changement ${nm(k)} → ${nm(k + 1)} (${where(q)})` }); await openTaskDetail(t); setSeen(q, true); }
    if (v === 'rfi') { const p = App.project, L2 = REG.rfi.store(p), b = await crop(q), f = await saveImageFile(p.id, new File([b], 'changement.jpg', { type: 'image/jpeg' }), 'photo', { hq: true });
      const x = { id: DB.uid(), n: regNum(L2, REG.rfi.pre), date: todayISO(), obj: `Changement de structure ${nm(k)} → ${nm(k + 1)} (${where(q)})`, q: `Entre ${nm(k)} et ${nm(k + 1)}, la structure change ${where(q)} (voir photo). Merci de confirmer.`, dest: 'BET structure', loc: `${nm(k + 1)} · ${where(q)}`, st: 'env', ph: [f.id], at: Date.now(), by: myName() };
      L2.push(x); await DB.put('projects', p); setSeen(q, true); regOpen(p, 'rfi', x, null); }
  };
  const tapAt = (x, y) => { if (!marks) return; for (let i = R.length - 1; i >= 0; i--) { const q = R[i], cx = q.x + q.w / 2, cy = q.y + q.h / 2, Rr = Math.max(q.w, q.h) / 2 * 1.25 + 30 / pz.st.s; if (Math.hypot(x - cx, y - cy) <= Rr) return actOn(i); } };
  $('[data-a=list]', el).onclick = () => {
    if (!R.length) return toast('Aucun changement de structure détecté ✓');
    const [low, up] = pair(), seen = (up.lvSeen || {})[low.id] || [];
    const s = sheet(`<div class="cmp-list">${R.map((q, i) => { const ok = seen.includes(lvsKey(q)); return `<button class="cmp-it" data-i="${i}"><span class="k" style="background:${ok ? '#22c55e' : '#f97316'}">${ok ? '✓' : '➜'}</span><span class="grow"><b>Changement ${where(q)}</b><small>${ok ? 'vu' : 'à vérifier'} · touchez pour agir</small></span></button>`; }).join('')}</div>`, { title: `${nm(k)} → ${nm(k + 1)}` });
    $$('[data-i]', s.el).forEach(b => b.onclick = () => { s.close(); const q = R[+b.dataset.i]; pz.zoomTo(q.x - q.w * 2.5, q.y - q.h * 2.5, q.w * 6, q.h * 6); setTimeout(() => actOn(+b.dataset.i), 350); });
  };
  // PDF de toutes les paires : à gauche le niveau du dessous (calé), à droite celui du dessus, mêmes cercles
  $('[data-a=share]', el).onclick = async () => {
    const ld = loading('Création du PDF…');
    try {
      const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a3', orientation: 'landscape' }), PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight();
      for (let i = 0; i < chain.length - 1; i++) {
        ld.set(`Création du PDF… ${i + 1}/${chain.length - 1}`);
        const low = chain[i].p, up = chain[i + 1].p, MM = await lvsMap(low, up), rr = await lvsChanges(low, up, MM), [il, iu] = await Promise.all([fileURL(low.fileId).then(loadImage), fileURL(up.fileId).then(loadImage)]);
        const S = Math.min(1, 1500 / Math.max(up.w, up.h)), W = Math.round(up.w * S), H = Math.round(up.h * S), cv = document.createElement('canvas'); cv.width = W * 2 + 30; cv.height = H; const g = cv.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); const c = Math.cos(MM.rot), s = Math.sin(MM.rot);
        g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip(); g.scale(S, S); g.transform(MM.sx * c, MM.sx * s, -MM.sx * s, MM.sx * c, MM.ox, MM.oy); g.drawImage(il, 0, 0); g.restore();
        g.drawImage(iu, W + 30, 0, W, H);
        g.strokeStyle = '#f97316'; g.lineWidth = 3; for (const q of rr) for (const ox of [0, W + 30]) { g.beginPath(); g.arc(ox + (q.x + q.w / 2) * S, (q.y + q.h / 2) * S, Math.max(q.w, q.h) / 2 * S * 1.25 + 8, 0, 7); g.stroke(); }
        if (i) doc.addPage('a3', 'landscape');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(20); doc.text(pt(`${nm(i)}  ->  ${nm(i + 1)}`), 12, 14); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110);
        doc.text(pt(`${App.project ? App.project.name + ' · ' : ''}gauche : ${nm(i)} (dessous) · droite : ${nm(i + 1)} (dessus) · cercles : changements de structure · ${fmtDate(todayISO())}`), 12, 20);
        const kk = Math.min((PW - 24) / cv.width, (PH - 32) / cv.height); doc.addImage(cv.toDataURL('image/jpeg', .88), 'JPEG', 12, 26, cv.width * kk, cv.height * kk);
      }
      ld.close(); await sharePdf(doc, `Niveaux_${safeName(nm(0))}_${safeName(nm(chain.length - 1))}.pdf`);
    } catch (e) { ld.close(); alertBox('PDF impossible : ' + (e.message || e)); }
  };
  splitEl.style.display = ''; setMode('curtain'); load();
}
// ouvrir directement une paire (depuis le briefing)
async function lvsOpenPair(lowId, upId) {
  const [low, up] = await Promise.all([DB.get('plans', lowId), DB.get('plans', upId)]); if (!low || !up) return toast('Plan introuvable');
  if (!low.lvRef || !up.lvRef) { if (!(await openEquerreSteps([low, up], [low.name, up.name], low))) return; }
  const L = await lvsLevels(up.projectId), f = (p) => L.find(x => x.p.id === p.id) || { p, niv: '', label: p.name };
  openStackView([f(low), f(up)]);
}
