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
  if (typeof Team !== 'undefined' && Team.featGate && !(await Team.featGate('cmp'))) return;   // v1.0.57 : fonction premium
    const pid = (startPlan && startPlan.projectId) || App.project.id, L = await lvsLevels(pid);
  if (L.length < 2) return toast('Il faut au moins deux plans (deux niveaux)');
  const pr = await lvsChoosePair(L, startPlan); if (!pr) return;
  // calage à l'équerre : une fois par plan (enregistré dans le plan)
  let todo = pr.filter(x => !x.p.lvRef);
  if (!todo.length) { const v = await menu('Les deux plans sont déjà calés ✓', [{ label: 'Comparer avec ces calages', icon: 'check', value: 'use' }, { label: 'Refaire le calage à l\'équerre', icon: 'ruler', value: 'all' }]); if (!v) return; if (v === 'all') todo = pr; }
  if (todo.length) { const ok = await openEquerreSteps(todo.map(x => x.p), todo.map(x => x.niv || x.p.name), pr[0].p); if (!ok) return; }
  openStackView(pr);
}
// niveau du dessous déjà tourné / décalé dans le repère du dessus (une seule fois) : les deux calques bougent pareil, sans lag
const _lvsWarp = new Map();
async function lvsWarpURL(low, up, M, max = 2400) {
  const key = `${low.id}|${up.id}|${[M.sx, M.rot, M.ox, M.oy].map(v => Math.round(v * 100)).join(',')}`;
  if (_lvsWarp.has(key)) return _lvsWarp.get(key);
  const pr = (async () => { const img = await loadImage(await lvsLiteURL(low.fileId, max)), kU = Math.min(1, max / Math.max(up.w, up.h)), kL = img.naturalWidth / low.w;
    const c = document.createElement('canvas'); c.width = Math.round(up.w * kU); c.height = Math.round(up.h * kU); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    const co = Math.cos(M.rot), si = Math.sin(M.rot); g.imageSmoothingQuality = 'high'; g.scale(kU, kU); g.transform(M.sx * co, M.sx * si, -M.sx * si, M.sx * co, M.ox, M.oy); g.scale(1 / kL, 1 / kL); g.drawImage(img, 0, 0);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', .92)); c.width = c.height = 0; return URL.createObjectURL(b); })();
  _lvsWarp.set(key, pr); return pr;
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
async function openStackView(chain, opts = {}) {
  chain = [...chain];
  // v1.0.49 : opts.same = nom du niveau → deux plans du MÊME niveau (lots, archi / ANEP…) : rideau seul, choix limité à ce niveau
  const SAME = opts.same || '', sameList = opts.list || null;
  let hdSeq = 0, hdTick = 0, hdT = 0, k = 0, mode = 'curtain', M = null, show = 'up', split = .5, pz = null;
  const el = document.createElement('div'); el.className = 'fullpage av-page lvs';
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title" style="flex:1"><b class="lvs-t"></b><span class="lvs-s"></span></div>
      <button class="iconbtn" data-a="cal" title="Refaire le calage de cette paire">${icon('ruler')}</button><button class="iconbtn" data-a="share">${icon('share')}</button></div>
    <div class="av-chips lvs-modes"><button data-m="curtain">🎚️ Rideau</button><button data-m="swap">👁️ Un niveau à la fois</button></div><div class="lvs-sw"><button data-s="low"></button><button data-s="up"></button></div>
    <div class="lvs-wrap"><div class="lvs-v"></div><div class="lvs-split"><i></i><b class="l"></b><b class="r"></b></div><div class="lvs-pill"></div><button class="lvs-sd l" data-side="0"></button><button class="lvs-sd r" data-side="1"></button></div>
    <div class="lvs-bar"><div class="lvs-nav"><button class="btn small ghost" data-a="chg">⇅ Changer les niveaux</button><span class="lvs-tip">Touchez le plan : réserve / RFI</span></div></div>`;
  document.body.appendChild(el);
  const unBack = pushBack(() => close()); const close = () => { clearTimeout(hdT); hdSeq++; el.remove(); };
  $('[data-a=x]', el).onclick = () => { unBack(); close(); };
  const wrap = $('.lvs-wrap', el), splitEl = $('.lvs-split', el), pill = $('.lvs-pill', el), swEl = $('.lvs-sw', el);
  let imgLow, imgUp, ov, view;
  const pair = () => [chain[k].p, chain[k + 1].p], nm = (i) => chain[i].niv || lvsShort(chain[i].p.name);
  // rideau : on déplace seulement une « fenêtre » (pas de re-dessin du plan) → fluide, sans zones blanches
  const applySplit = () => { if (!imgUp) return; const r = wrap.getBoundingClientRect(), X = mode === 'curtain' ? split * r.width : 0; splitEl.style.left = split * r.width + 'px';
    imgUp.style.left = X + 'px'; imgUp.firstElementChild.style.left = -X + 'px'; };
  const setMode = (m) => {
    mode = m; $$('.lvs-modes [data-m]', el).forEach(b => b.classList.toggle('on', b.dataset.m === m));
    splitEl.style.display = m === 'curtain' ? '' : 'none'; swEl.style.display = m === 'swap' ? '' : 'none'; pill.style.display = 'none';
    if (!imgUp) return; imgUp.style.visibility = m === 'swap' && show === 'low' ? 'hidden' : 'visible'; applySplit();
    $$('[data-s]', swEl).forEach(b => b.classList.toggle('on', b.dataset.s === show));
  };
  // « un niveau à la fois » : deux boutons côte à côte, on touche le niveau à voir
  $$('[data-s]', swEl).forEach(b => b.onclick = () => { show = b.dataset.s; if (imgUp) imgUp.style.visibility = show === 'low' ? 'hidden' : 'visible'; $$('[data-s]', swEl).forEach(x => x.classList.toggle('on', x === b)); try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} });
  $$('.lvs-modes [data-m]', el).forEach(b => b.onclick = () => setMode(b.dataset.m));
  // rideau : la barre se glisse au doigt
  splitEl.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); const r = wrap.getBoundingClientRect();
    const mv = (ev) => { split = Math.max(.03, Math.min(.97, (ev.clientX - r.left) / r.width)); applySplit(); };
    const upf = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upf); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upf); };
  const load = async () => {
    const [low, up] = pair(); M = await lvsMap(low, up);
    $('.lvs-t', el).textContent = `${nm(k)} → ${nm(k + 1)}`; $('.lvs-s', el).textContent = `base ${nm(k)} · supérieur ${nm(k + 1)}`;
    $('[data-s=low]', swEl).textContent = `▼ ${nm(k)}`; $('[data-s=up]', swEl).textContent = `▲ ${nm(k + 1)}`; $('[data-side="0"]', el).innerHTML = `▼ ${esc(nm(k))} <i>⌄</i>`; $('[data-side="1"]', el).innerHTML = `▲ ${esc(nm(k + 1))} <i>⌄</i>`; $('.lvs-split .l', el).textContent = `◀ ${nm(k)}`; $('.lvs-split .r', el).textContent = `${nm(k + 1)} ▶`;
    if (SAME) { $('.lvs-t', el).textContent = `${SAME} — ${nm(k)} ↔ ${nm(k + 1)}`; $('.lvs-s', el).textContent = 'Comparaison sur le même niveau · rideau'; }
    const [sl, su] = await Promise.all([lvsWarpURL(low, up, M), lvsLiteURL(up.fileId)]);
    if (view) view.remove(); view = document.createElement('div'); view.className = 'av-view lvs-vv'; $('.lvs-v', el).appendChild(view);
    const c = Math.cos(M.rot), s = Math.sin(M.rot);
    view.innerHTML = `<div class="av-stage lvs-sl"><div class="lvs-L lo"><img class="lo" width="${up.w}" height="${up.h}" src="${sl}" decoding="async"><canvas class="lvs-hd"></canvas></div></div>
      <div class="lvs-cw"><div class="av-stage lvs-su"><div class="lvs-L hi" style="width:${up.w}px;height:${up.h}px"><img width="${up.w}" height="${up.h}" src="${su}" decoding="async"><canvas class="lvs-hd"></canvas></div></div></div>
      <div class="av-stage lvs-so"><svg class="av-ov" width="${up.w}" height="${up.h}" viewBox="0 0 ${up.w} ${up.h}"></svg></div>`;
    imgLow = $('img.lo', view); imgUp = $('.lvs-cw', view); ov = $('svg', view);
    // les trois calques (dessous, dessus, repères) bougent ensemble, dans la même image
    const layers = [$('.lvs-sl', view), $('.lvs-su', view), $('.lvs-so', view)], stageProxy = { style: {} };
    Object.defineProperty(stageProxy.style, 'transform', { set(v) { for (const l of layers) l.style.transform = v; }, get() { return layers[0].style.transform; } });
    const [hdLo, hdHi] = $$('.lvs-hd', view), seqL = ++hdSeq;
    const PP = Promise.all([planPdfPage(low), planPdfPage(up)]).catch(() => [null, null]);
    // rendu net (PDF / image) de la zone visible quand on zoome : les deux niveaux, au même endroit
    // rendu net de l'écran visible, comme la page Plans : le PDF lui-même, à la résolution exacte de l'écran ; un rendu en cours est annulé dès qu'on bouge
    let tasks = [];
    const renderHD = async () => {
      tasks.forEach(t => { try { t.cancel(); } catch (e) {} }); tasks = [];
      const st = pz.st, dpr = Math.min(3, window.devicePixelRatio || 1), vw = view.clientWidth, vh = view.clientHeight; if (!vw || !vh) return;
      const x0 = -st.tx / st.s, y0 = -st.ty / st.s, S = st.s * dpr, W = Math.round(vw * dpr), H = Math.round(vh * dpr), my = ++hdTick;
      const [PA, PB] = await PP;
      const one = async (P, plan, MM) => {
        const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
        const co = Math.cos(MM.rot || 0), si = Math.sin(MM.rot || 0);
        if (P) { const t = P.page.render({ canvasContext: g, viewport: P.page.getViewport({ scale: P.k * MM.sx * S }), transform: [co, si, -si, co, S * (MM.ox - x0), S * (MM.oy - y0)], background: 'white' }); tasks.push(t); await t.promise; }
        else { const img = await rprImg(plan.fileId); g.setTransform(S, 0, 0, S, -x0 * S, -y0 * S); g.transform(MM.sx * co, MM.sx * si, -MM.sx * si, MM.sx * co, MM.ox, MM.oy); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, plan.w, plan.h); }
        return c;
      };
      try {
        const [ca, cb] = await Promise.all([one(PA, low, M), one(PB, up, { sx: 1, sy: 1, ox: 0, oy: 0, rot: 0 })]);
        if (my !== hdTick || seqL !== hdSeq || !el.isConnected) return;
        for (const [cv, src] of [[hdLo, ca], [hdHi, cb]]) { cv.width = W; cv.height = H; cv.getContext('2d').drawImage(src, 0, 0); src.width = src.height = 0;
          Object.assign(cv.style, { left: x0 + 'px', top: y0 + 'px', width: (vw / st.s) + 'px', height: (vh / st.s) + 'px', display: 'block' }); }
      } catch (e) { if (!/cancel/i.test(String(e && (e.name || e.message)))) console.warn('hd', e); }
    };
    pz = panZoom(view, stageProxy, up.w, up.h, { onChange: (st) => {
      clearTimeout(hdT); tasks.forEach(t => { try { t.cancel(); } catch (e) {} }); hdT = setTimeout(renderHD, 140); }, onTap: ([x, y]) => tapAt(x, y) });
    requestAnimationFrame(() => { pz.fit(); setMode(mode); clearTimeout(hdT); hdT = setTimeout(renderHD, 60); });
  };
  // toucher le niveau de gauche ou de droite : en choisir un autre (calé une fois à l'équerre, ensuite on change en un toucher)
  $$('[data-side]', el).forEach(b => b.onclick = async (e) => { e.stopPropagation(); const i = +b.dataset.side, other = chain[1 - i], L = (sameList || await lvsLevels(other.p.projectId)).filter(x => x.p.id !== other.p.id);
    if (SAME) { const v2 = await menu(`Plan ${i ? 'de droite' : 'de gauche'} · ${SAME}`, L.map(x => ({ label: `${x.niv || x.p.name}${x.p.lvRef ? '  📏' : '  (à caler)'}`, icon: 'plans', value: x.p.id, checked: x.p.id === chain[i].p.id }))); const x2 = L.find(y => y.p.id === v2); if (!x2) return;
      if (!x2.p.lvRef && !(await openEquerreSteps([x2.p], [x2.niv || x2.p.name], other.p))) return; chain[i] = x2; return load(); }
    const v = await menu(i ? 'Niveau supérieur (à droite)' : 'Niveau de base (à gauche)', [...L.map(x => ({ label: `${x.niv ? x.niv + ' · ' : ''}${x.p.name}${x.p.lvRef ? '  📏' : '  (à caler)'}`, icon: 'layers', value: x.p.id, checked: x.p.id === chain[i].p.id })),
      { label: '📏 Caler plusieurs plans d\'avance…', icon: 'ruler', value: '__many' }]);
    if (!v) return;
    if (v === '__many') { const todo = L.filter(x => !x.p.lvRef); if (!todo.length) return toast('Tous les plans sont déjà calés ✓');
      const sel = await lvsPick('Plans à caler', todo, [], { sub: `Calage à l'équerre sur les mêmes fils que ${esc(nm(1 - i))}. Ensuite vous changez de niveau en un toucher.`, okLabel: 'Caler ›' }); if (!sel) return;
      if (await openEquerreSteps(sel.map(x => x.p), sel.map(x => x.niv || x.p.name), other.p)) toast(`${sel.length} plan(s) calé(s) ✓`); return; }
    const x = L.find(y => y.p.id === v); if (!x) return;
    if (!x.p.lvRef && !(await openEquerreSteps([x.p], [x.niv || x.p.name], other.p))) return;
    chain[i] = x; load(); });
  $('[data-a=chg]', el).onclick = async () => { const L = await lvsLevels(chain[0].p.projectId), pr = await lvsChoosePair(L, chain[0].p); if (!pr) return;
    const todo = pr.filter(x => !x.p.lvRef); if (todo.length && !(await openEquerreSteps(todo.map(x => x.p), todo.map(x => x.niv || x.p.name), pr[0].p))) return;
    chain = pr; k = 0; load(); };
  $('[data-a=cal]', el).onclick = async () => { const [low, up] = pair(); if (await openEquerreSteps([low, up], [nm(k), nm(k + 1)], low)) load(); };
  // toucher le plan : réserve ou RFI à cet endroit
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
  const tapAt = async (x, y) => {
    const [low, up] = pair(), d = 70 / pz.st.s, q = { x: x - d / 2, y: y - d / 2, w: d, h: d };
    if (x < 0 || y < 0 || x > up.w || y > up.h) return;
    const v = await menu(`${nm(k)} → ${nm(k + 1)} · ${where(q)}`, [{ label: '📌 Créer une réserve ici', icon: 'tasks', value: 'task' }, { label: '❓ Demande (RFI) au BET avec photo', icon: 'ask', value: 'rfi' }]);
    if (v === 'task') { const t = await newTask({ planId: up.id, x, y, title: `${nm(k)} → ${nm(k + 1)} (${where(q)})` }); await openTaskDetail(t); }
    if (v === 'rfi') { const p = App.project, L2 = REG.rfi.store(p), b = await crop(q), f = await saveImageFile(p.id, new File([b], 'niveaux.jpg', { type: 'image/jpeg' }), 'photo', { hq: true });
      const it = { id: DB.uid(), n: regNum(L2, REG.rfi.pre), date: todayISO(), obj: `Structure ${nm(k)} → ${nm(k + 1)} (${where(q)})`, q: `Entre ${nm(k)} et ${nm(k + 1)}, merci de confirmer la structure ${where(q)} (voir photo).`, dest: 'BET structure', loc: `${nm(k + 1)} · ${where(q)}`, st: 'env', ph: [f.id], at: Date.now(), by: myName() };
      L2.push(it); await DB.put('projects', p); regOpen(p, 'rfi', it, null); }
  };
  // PDF : à gauche le niveau du dessous (calé), à droite celui du dessus
  $('[data-a=share]', el).onclick = async () => {
    const ld = loading('Création du PDF…');
    try {
      const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a3', orientation: 'landscape' }), PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight();
      for (let i = 0; i < chain.length - 1; i++) {
        ld.set(`Création du PDF… ${i + 1}/${chain.length - 1}`);
        const low = chain[i].p, up = chain[i + 1].p, MM = await lvsMap(low, up), [il, iu] = await Promise.all([fileURL(low.fileId).then(loadImage), fileURL(up.fileId).then(loadImage)]);
        const S = Math.min(1, 1500 / Math.max(up.w, up.h)), W = Math.round(up.w * S), H = Math.round(up.h * S), cv = document.createElement('canvas'); cv.width = W * 2 + 30; cv.height = H; const g = cv.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); const c = Math.cos(MM.rot), s = Math.sin(MM.rot);
        g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip(); g.scale(S, S); g.transform(MM.sx * c, MM.sx * s, -MM.sx * s, MM.sx * c, MM.ox, MM.oy); g.drawImage(il, 0, 0); g.restore();
        g.drawImage(iu, W + 30, 0, W, H);
        if (i) doc.addPage('a3', 'landscape');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(20); doc.text(pt(`${nm(i)}  ->  ${nm(i + 1)}`), 12, 14); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110);
        doc.text(pt(`${App.project ? App.project.name + ' · ' : ''}gauche : ${nm(i)} (dessous) · droite : ${nm(i + 1)} (dessus) · ${fmtDate(todayISO())}`), 12, 20);
        const kk = Math.min((PW - 24) / cv.width, (PH - 32) / cv.height); doc.addImage(cv.toDataURL('image/jpeg', .88), 'JPEG', 12, 26, cv.width * kk, cv.height * kk);
      }
      ld.close(); await sharePdf(doc, `Niveaux_${safeName(nm(0))}_${safeName(nm(chain.length - 1))}.pdf`);
    } catch (e) { ld.close(); alertBox('PDF impossible : ' + (e.message || e)); }
  };
  if (SAME) { const md = $('.lvs-modes', el); if (md) md.style.display = 'none'; const cg = $('[data-a=chg]', el); if (cg) cg.style.display = 'none'; el.classList.add('lvs-same'); }
  splitEl.style.display = ''; setMode('curtain'); load();
}
// ouvrir directement une paire (depuis le briefing)
async function lvsOpenPair(lowId, upId) {
  const [low, up] = await Promise.all([DB.get('plans', lowId), DB.get('plans', upId)]); if (!low || !up) return toast('Plan introuvable');
  if (!low.lvRef || !up.lvRef) { if (!(await openEquerreSteps([low, up], [low.name, up.name], low))) return; }
  const L = await lvsLevels(up.projectId), f = (p) => L.find(x => x.p.id === p.id) || { p, niv: '', label: p.name };
  openStackView([f(low), f(up)]);
}
// ================= Bouton « Comparer » : deux niveaux ou deux indices =================
async function compareMenu(plan) {
  if (typeof Team !== 'undefined' && Team.featGate && !(await Team.featGate('cmp'))) return;   // v1.0.57 : fonction premium
    const v = await menu('Comparer', [{ label: '🏢 Comparer deux niveaux (R+3 ↔ R+4…)', icon: 'layers', value: 'niv' }, { label: '📑 Comparer deux indices (A ↔ B…)', icon: 'history', value: 'ind' }]);
  if (v === 'niv') return openLevelStack(plan);
  if (v === 'ind') return compareIndices(plan);
}
async function compareIndices(plan) {
  if (!plan) {   // depuis la liste : choisir un plan qui a plusieurs indices
    const all = await DB.byProject('plans', App.project.id), cur = all.filter(p => p.fileId && (typeof isCurrentPlan !== 'function' || isCurrentPlan(p)));
    const multi = cur.filter(p => p.prevId);
    if (!multi.length) return alertBox('Aucun plan n\'a encore plusieurs indices.\nOuvrez un plan › ⋮ › « Mettre à jour le plan (nouvel indice) ».');
    const id = await menu('Quel plan ?', multi.map(p => ({ label: `${p.name} · indice ${planIndice(p)}`, icon: 'plans', value: p.id }))); if (!id) return;
    plan = multi.find(p => p.id === id);
  }
  const hist = await planHistory(plan);
  if (hist.length < 2) return alertBox(`« ${plan.name} » n'a qu'un indice.\nPour comparer, ajoutez d'abord le nouvel indice : ⋮ › « Mettre à jour le plan (nouvel indice) ».`);
  if (hist.length === 2) return openPlanCompare(hist[0], hist[1]);
  const opts = hist.map(p => ({ label: `Indice ${planIndice(p)}${p.indiceDate ? ' · ' + fmtDate(p.indiceDate) : ''}${p.indiceNote ? ' · ' + p.indiceNote : ''}`, value: p.id }));
  const a = await menu('Ancien indice', opts); if (!a) return;
  const b = await menu('Nouvel indice', opts.filter(o => o.value !== a)); if (!b) return;
  openPlanCompare(hist.find(p => p.id === a), hist.find(p => p.id === b));
}
