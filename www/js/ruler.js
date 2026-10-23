// ================= Calage à la règle : une équerre (règle horizontale + règle verticale) posée sur un fil horizontal et un fil vertical =================
// L'équerre reste fixe à l'écran : on déplace le plan dessous pour coller ses deux règles sur deux fils (ex. fil 1 et fil A).
// Une fois « fixée », elle suit le plan (zoom avant / arrière sans bouger). Même chose sur l'autre niveau → calage exact.
// Échelle : lue dans le PDF / DWG (même échelle de dessin) ; mode « 2 croisements » pour la mesurer aussi.
async function lvPxScale(low, up) {
  try { const [A, B] = await Promise.all([planPdfPage(low), planPdfPage(up)]); if (A && B) return B.k / A.k; } catch (e) {}
  try { if ((low.dwgFileId || low.dxfFileId) && (up.dwgFileId || up.dxfFileId)) { const [A, B] = await Promise.all([cadOfPlan(low), cadOfPlan(up)]); if (A && B) return (up.w / (B.box[2] - B.box[0])) / (low.w / (A.box[2] - A.box[0])); } } catch (e) {}
  return up.w / low.w;
}
function openRulerCalage(low, up, opts = {}) {
  return new Promise(async (resolve) => {
    const la = opts.la || low.name, lb = opts.lb || up.name, plans = [low, up], names = [la, lb];
    const [srcs, SC] = await Promise.all([Promise.all([fileURL(low.fileId), fileURL(up.fileId)]), lvPxScale(low, up)]);
    let mode = 'eq';   // 'eq' = équerre (1 croisement + direction des fils) · 'pts' = 2 croisements
    const el = document.createElement('div'); el.className = 'fullpage rl';
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title" style="flex:1"><b>Calage à la règle</b><span class="rl-step"></span></div>
        <button class="iconbtn rl-mode" data-a="mode" title="Équerre / 2 croisements">①②</button><button class="iconbtn rl-lockb" data-a="lock" title="Plan fixe">${icon('lock')}</button><button class="iconbtn" data-a="reset" title="Remettre la règle">${icon('undo')}</button></div>
      <div class="rl-wrap"><div class="rl-view"></div><div class="rl-block"></div><svg class="rl-ov"></svg><div class="rl-pill"></div></div>
      <div class="rl-bar"><p class="rl-hint"></p><div class="rl-btns"></div></div>`;
    document.body.appendChild(el);
    let done = false; const finish = (v) => { if (done) return; done = true; unBack(); el.remove(); resolve(v); };
    const unBack = pushBack(() => { done = true; el.remove(); resolve(null); });
    $('[data-a=x]', el).onclick = () => finish(null);
    const wrap = $('.rl-wrap', el), ov = $('.rl-ov', el), block = $('.rl-block', el);
    let step = 0, anchored = false, locked = false, pz = null, view = null;
    const pts = [[], []];
    const H = [{ x: 0, y: 0 }, { x: 0, y: 0 }];             // poignées à l'écran
    const Q = { x: 0, y: 0, ang: 0 }, EQ = [null, null];        // équerre : centre à l'écran + angle ; fixée : point du plan + angle
    el._rl = { get pz() { return pz; }, H, pts, Q, EQ, get draw() { return draw; } };
    const resetRuler = () => { const r = wrap.getBoundingClientRect(); H[0] = { x: r.width * .22, y: r.height * .5 }; H[1] = { x: r.width * .78, y: r.height * .5 }; Q.x = r.width * .5; Q.y = r.height * .5; Q.ang = 0; };
    const toScr = (p) => [p[0] * pz.st.s + pz.st.tx, p[1] * pz.st.s + pz.st.ty];
    const draw = () => {
      if (mode === 'eq') return drawEq();
      if (anchored) pts[step].forEach((p, i) => { const [x, y] = toScr(p); H[i] = { x, y }; });
      const [a, b] = H, cross = (h, c, n) => `<g class="rl-h" data-h="${n}"><circle cx="${h.x}" cy="${h.y}" r="26" fill="transparent"/>
          <line x1="${h.x - 46}" y1="${h.y}" x2="${h.x + 46}" y2="${h.y}" stroke="${c}" stroke-width="1.4"/><line x1="${h.x}" y1="${h.y - 46}" x2="${h.x}" y2="${h.y + 46}" stroke="${c}" stroke-width="1.4"/>
          <circle cx="${h.x}" cy="${h.y}" r="13" fill="none" stroke="${c}" stroke-width="2.2"/><circle cx="${h.x}" cy="${h.y}" r="2.2" fill="${c}"/>
          <g transform="translate(${h.x + 16},${h.y - 16})"><circle r="11" fill="${c}"/><text y="4.5" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" font-family="Arial">${n + 1}</text></g></g>`;
      ov.innerHTML = `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#f59e0b" stroke-width="3" stroke-dasharray="10 6" opacity=".9"/>${cross(a, '#ef4444', 0)}${cross(b, '#2563eb', 1)}`;
      $$('.rl-h', ov).forEach(g => g.onpointerdown = (e) => drag(e, +g.dataset.h));
    };
    // équerre : règle horizontale (rouge) + règle verticale (bleue) sur toute la largeur / hauteur, centre déplaçable, bouton pour tourner
    const drawEq = () => {
      if (anchored && EQ[step]) { const [x, y] = toScr(EQ[step].p); Q.x = x; Q.y = y; Q.ang = EQ[step].ang; }
      const L = 3000, c = Math.cos(Q.ang), sn = Math.sin(Q.ang), kx = Q.x + 112 * c, ky = Q.y + 112 * sn;
      ov.innerHTML = `<line x1="${Q.x - L * c}" y1="${Q.y - L * sn}" x2="${Q.x + L * c}" y2="${Q.y + L * sn}" stroke="#ef4444" stroke-width="2.2"/>
        <line x1="${Q.x + L * sn}" y1="${Q.y - L * c}" x2="${Q.x - L * sn}" y2="${Q.y + L * c}" stroke="#2563eb" stroke-width="2.2"/>
        <line x1="${Q.x - L * c}" y1="${Q.y - L * sn}" x2="${Q.x + L * c}" y2="${Q.y + L * sn}" stroke="#ef4444" stroke-width="9" opacity=".12"/>
        <line x1="${Q.x + L * sn}" y1="${Q.y - L * c}" x2="${Q.x - L * sn}" y2="${Q.y + L * c}" stroke="#2563eb" stroke-width="9" opacity=".12"/>
        <g class="rl-h" data-q="c"><circle cx="${Q.x}" cy="${Q.y}" r="30" fill="transparent"/><circle cx="${Q.x}" cy="${Q.y}" r="15" fill="rgba(245,158,11,.15)" stroke="#f59e0b" stroke-width="2.4"/><circle cx="${Q.x}" cy="${Q.y}" r="2.4" fill="#f59e0b"/></g>
        <g class="rl-h" data-q="r"><circle cx="${kx}" cy="${ky}" r="22" fill="transparent"/><circle cx="${kx}" cy="${ky}" r="13" fill="#ef4444"/><text x="${kx}" y="${ky + 5}" text-anchor="middle" font-size="15" font-weight="800" fill="#fff" font-family="Arial">⟲</text></g>
        <g font-family="Arial" font-size="11.5" font-weight="700"><text x="${Q.x - 150 * c + 6}" y="${Q.y - 150 * sn - 8}" fill="#ef4444" paint-order="stroke" stroke="#fff" stroke-width="3">fil horizontal (1, 2, 3…)</text>
        <text x="${Q.x + 150 * sn + 8}" y="${Q.y - 150 * c}" fill="#2563eb" paint-order="stroke" stroke="#fff" stroke-width="3">fil vertical (A, B…)</text></g>`;
      $$('[data-q]', ov).forEach(g => g.onpointerdown = (e) => dragEq(e, g.dataset.q));
    };
    const dragEq = (e, what) => {
      e.preventDefault(); e.stopPropagation(); const r = wrap.getBoundingClientRect(), off = [Q.x - (e.clientX - r.left), Q.y - (e.clientY - r.top)];
      const mv = (ev) => { const X = ev.clientX - r.left, Y = ev.clientY - r.top;
        if (what === 'c') { Q.x = X + off[0]; Q.y = Y + off[1]; } else { let a = Math.atan2(Y - Q.y, X - Q.x); const deg = a * 180 / Math.PI; if (Math.abs(deg) < 1.5) a = 0; Q.ang = a; }
        if (anchored) EQ[step] = { p: pz.toImg([Q.x, Q.y]), ang: Q.ang }; drawEq(); };
      const upf = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upf); window.removeEventListener('pointercancel', upf); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upf); window.addEventListener('pointercancel', upf);
    };
    $('[data-a=mode]', el).onclick = () => { mode = mode === 'eq' ? 'pts' : 'eq'; anchored = false; EQ[step] = null; pts[step] = []; $('.rl-mode', el).textContent = mode === 'eq' ? '①②' : '✚'; toast(mode === 'eq' ? 'Équerre : un croisement + la direction des fils' : '2 croisements : mesure aussi l\'échelle'); ui(); draw(); };
    // glisser une poignée ① ou ② (le plan ne bouge pas)
    const drag = (e, i) => {
      e.preventDefault(); e.stopPropagation(); const r = wrap.getBoundingClientRect(), off = [H[i].x - (e.clientX - r.left), H[i].y - (e.clientY - r.top)];
      const mv = (ev) => { H[i] = { x: ev.clientX - r.left + off[0], y: ev.clientY - r.top + off[1] }; if (anchored) pts[step][i] = pz.toImg([H[i].x, H[i].y]); draw(); };
      const upf = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upf); window.removeEventListener('pointercancel', upf); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upf); window.addEventListener('pointercancel', upf);
    };
    const setLock = (v) => { locked = v; block.style.display = v ? 'block' : 'none'; $('.rl-lockb', el).classList.toggle('on', v); $('.rl-pill', el).textContent = v ? '🔒 Plan fixe' : ''; $('.rl-pill', el).style.display = v ? '' : 'none'; };
    $('[data-a=lock]', el).onclick = () => setLock(!locked);
    $('[data-a=reset]', el).onclick = () => { anchored = false; pts[step] = []; EQ[step] = null; resetRuler(); ui(); draw(); };
    // charge le plan de l'étape : la règle garde sa place à l'écran
    const load = (i) => {
      if (view) view.remove(); view = document.createElement('div'); view.className = 'av-view rl-v'; $('.rl-view', el).appendChild(view);
      const P = plans[i]; view.innerHTML = `<div class="av-stage"><img width="${P.w}" height="${P.h}" src="${srcs[i]}"></div>`;
      pz = panZoom(view, $('.av-stage', view), P.w, P.h, { onChange: () => { cancelAnimationFrame(draw._r); draw._r = requestAnimationFrame(draw); } });
      const fit = () => { if (!view.clientWidth) return setTimeout(fit, 80); if (opts.keep && opts.keep[i]) { Object.assign(pz.st, opts.keep[i]); pz.apply(); } else pz.fit(); draw(); };
      requestAnimationFrame(fit);
      // le plan peut arriver après (Drive) : on recadre quand l'image est prête
      const im = $('img', view); im.onload = () => { if (!anchored) fit(); }; im.onerror = () => toast('Image du plan introuvable (connexion ?)');
    };
    const ui = () => {
      $('.rl-step', el).textContent = `Étape ${step + 1}/2 · ${names[step]}`;
      if (mode === 'eq') $('.rl-hint', el).innerHTML = anchored ? `Équerre fixée sur <b>${esc(names[step])}</b> ✓ — zoomez pour vérifier ; vous pouvez encore la glisser ou la tourner (⟲).`
        : step === 0 ? `Déplacez le plan <b>${esc(la)}</b> pour coller la <b style="color:#ef4444">règle horizontale</b> sur un fil horizontal (ex. fil 1) et la <b style="color:#2563eb">règle verticale</b> sur un fil vertical (ex. fil A). Le centre ◎ tombe sur leur croisement.`
        : `Sur <b>${esc(lb)}</b>, collez l'équerre sur <b>les mêmes fils</b> (même fil horizontal, même fil vertical) que sur ${esc(la)}.`;
      else $('.rl-hint', el).innerHTML = anchored ? `Règle fixée sur <b>${esc(names[step])}</b> ✓ — zoomez pour vérifier ; vous pouvez encore glisser ① ou ②.`
        : step === 0 ? `Déplacez le plan <b>${esc(la)}</b> pour mettre <b style="color:#ef4444">①</b> et <b style="color:#2563eb">②</b> sur deux croisements de fils (ex. A/1 et E/1). Vous pouvez aussi glisser ① et ②.`
        : `Même chose sur <b>${esc(lb)}</b> : mettez <b style="color:#ef4444">①</b> et <b style="color:#2563eb">②</b> sur <b>les mêmes croisements</b> que sur ${esc(la)}.`;
      const B = $('.rl-btns', el);
      if (!anchored) B.innerHTML = `${step ? `<button class="btn ghost" data-b="back">‹ ${esc(la)}</button>` : ''}<button class="btn" data-b="fix">📌 Fixer sur ${esc(names[step])}</button>`;
      else B.innerHTML = `<button class="btn ghost" data-b="adj">Déplacer la règle</button><button class="btn" data-b="next">${step ? '✓ Comparer' : `Suivant : ${esc(lb)} ›`}</button>`;
      const b = (k) => $(`[data-b=${k}]`, B);
      if (b('fix')) b('fix').onclick = () => { if (mode === 'eq') EQ[step] = { p: pz.toImg([Q.x, Q.y]), ang: Q.ang }; else pts[step] = H.map(h => pz.toImg([h.x, h.y])); anchored = true; try { navigator.vibrate && navigator.vibrate(15); } catch (e) {} ui(); draw(); };
      if (b('adj')) b('adj').onclick = () => { anchored = false; ui(); draw(); };
      if (b('back')) b('back').onclick = () => { step = 0; anchored = true; load(0); ui(); };
      if (b('next')) b('next').onclick = () => {
        if (step === 0) { step = 1; anchored = false; setLock(false); load(1); ui(); return; }   // la règle reste à la même place à l'écran
        if (mode === 'eq') {   // équerre : croisement + direction des fils ; échelle de dessin lue dans les fichiers
          const A = EQ[0], B = EQ[1]; if (!A || !B) return toast('Fixez l\'équerre sur les deux niveaux');
          let rot = B.ang - A.ang; rot = Math.atan2(Math.sin(rot), Math.cos(rot)); if (Math.abs(rot) < 0.002) rot = 0; const c = Math.cos(rot), s = Math.sin(rot), sc = SC;
          const M = { sx: sc, sy: sc, rot, ox: B.p[0] - sc * (c * A.p[0] - s * A.p[1]), oy: B.p[1] - sc * (s * A.p[0] + c * A.p[1]), rule: true, at: Date.now() };
          up.lvCal = up.lvCal || {}; up.lvCal[low.id] = M; DB.put('plans', up).catch(() => {}); return finish(M);
        }
        const [a1, a2] = pts[0], [b1, b2] = pts[1], va = [a2[0] - a1[0], a2[1] - a1[1]], vb = [b2[0] - b1[0], b2[1] - b1[1]], la_ = Math.hypot(...va), lb_ = Math.hypot(...vb);
        if (la_ < 5 || lb_ < 5) return toast('Écartez ① et ② (deux croisements éloignés)');
        let sc = lb_ / la_, rot = Math.atan2(vb[1], vb[0]) - Math.atan2(va[1], va[0]); rot = Math.atan2(Math.sin(rot), Math.cos(rot)); if (Math.abs(rot) < 0.002) rot = 0;
        const c = Math.cos(rot), s = Math.sin(rot), M = { sx: sc, sy: sc, rot, ox: b1[0] - sc * (c * a1[0] - s * a1[1]), oy: b1[1] - sc * (s * a1[0] + c * a1[1]), rule: true, at: Date.now() };
        up.lvCal = up.lvCal || {}; up.lvCal[low.id] = M; DB.put('plans', up).catch(() => {});
        finish(M);
      };
    };
    setLock(false); requestAnimationFrame(() => { resetRuler(); load(0); ui(); });
  });
}
// Équerre en plusieurs étapes : un repère par plan (croisement de deux fils + direction), enregistré dans le plan (plan.lvRef).
// Ensuite toutes les paires (R+3→R+4, R+4→R+5…) se calent toutes seules à partir de ces repères.
function openEquerreSteps(plans, names, refPlan) {
  return new Promise(async (resolve) => {
    const srcs = await Promise.all(plans.map(p => fileURL(p.fileId)));
    const el = document.createElement('div'); el.className = 'fullpage rl';
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title" style="flex:1"><b>Calage à l'équerre</b><span class="rl-step"></span></div>
        <button class="iconbtn rl-lockb" data-a="lock" title="Plan fixe">${icon('lock')}</button><button class="iconbtn" data-a="reset" title="Remettre l'équerre">${icon('undo')}</button></div>
      <div class="rl-wrap"><div class="rl-view"></div><div class="rl-block"></div><svg class="rl-ov"></svg><div class="rl-pill"></div></div>
      <div class="rl-bar"><p class="rl-hint"></p><div class="rl-btns"></div></div>`;
    document.body.appendChild(el);
    let done = false; const finish = (v) => { if (done) return; done = true; unBack(); el.remove(); resolve(v); };
    const unBack = pushBack(() => { done = true; el.remove(); resolve(null); });
    $('[data-a=x]', el).onclick = () => finish(null);
    const wrap = $('.rl-wrap', el), ov = $('.rl-ov', el), block = $('.rl-block', el), N = plans.length;
    let step = 0, anchored = false, locked = false, pz = null, view = null;
    const Q = { x: 0, y: 0, ang: 0 }, EQ = plans.map(() => null);
    const ref = refPlan && refPlan.lvRef && !plans.includes(refPlan) ? refPlan : null;   // un plan déjà calé sert de modèle (mêmes fils)
    el._rl = { get pz() { return pz; }, Q, EQ, get draw() { return draw; } };
    const resetRuler = () => { const r = wrap.getBoundingClientRect(); Q.x = r.width * .5; Q.y = r.height * .5; Q.ang = 0; };
    const toScr = (p) => [p[0] * pz.st.s + pz.st.tx, p[1] * pz.st.s + pz.st.ty];
    const draw = () => {
      if (anchored && EQ[step]) { const [x, y] = toScr(EQ[step].p); Q.x = x; Q.y = y; Q.ang = EQ[step].ang; }
      const L = 3000, c = Math.cos(Q.ang), sn = Math.sin(Q.ang), kx = Q.x + 112 * c, ky = Q.y + 112 * sn;
      ov.innerHTML = `<line x1="${Q.x - L * c}" y1="${Q.y - L * sn}" x2="${Q.x + L * c}" y2="${Q.y + L * sn}" stroke="#ef4444" stroke-width="2.2"/>
        <line x1="${Q.x + L * sn}" y1="${Q.y - L * c}" x2="${Q.x - L * sn}" y2="${Q.y + L * c}" stroke="#2563eb" stroke-width="2.2"/>
        <line x1="${Q.x - L * c}" y1="${Q.y - L * sn}" x2="${Q.x + L * c}" y2="${Q.y + L * sn}" stroke="#ef4444" stroke-width="9" opacity=".12"/>
        <line x1="${Q.x + L * sn}" y1="${Q.y - L * c}" x2="${Q.x - L * sn}" y2="${Q.y + L * c}" stroke="#2563eb" stroke-width="9" opacity=".12"/>
        <g class="rl-h" data-q="c"><circle cx="${Q.x}" cy="${Q.y}" r="30" fill="transparent"/><circle cx="${Q.x}" cy="${Q.y}" r="15" fill="rgba(245,158,11,.15)" stroke="#f59e0b" stroke-width="2.4"/><circle cx="${Q.x}" cy="${Q.y}" r="2.4" fill="#f59e0b"/></g>
        <g class="rl-h" data-q="r"><circle cx="${kx}" cy="${ky}" r="22" fill="transparent"/><circle cx="${kx}" cy="${ky}" r="13" fill="#ef4444"/><text x="${kx}" y="${ky + 5}" text-anchor="middle" font-size="15" font-weight="800" fill="#fff" font-family="Arial">⟲</text></g>
        <g font-family="Arial" font-size="11.5" font-weight="700"><text x="${Q.x - 150 * c + 6}" y="${Q.y - 150 * sn - 8}" fill="#ef4444" paint-order="stroke" stroke="#fff" stroke-width="3">fil horizontal</text>
        <text x="${Q.x + 150 * sn + 8}" y="${Q.y - 150 * c}" fill="#2563eb" paint-order="stroke" stroke="#fff" stroke-width="3">fil vertical</text></g>`;
      $$('[data-q]', ov).forEach(g => g.onpointerdown = (e) => dragEq(e, g.dataset.q));
    };
    const dragEq = (e, what) => {
      e.preventDefault(); e.stopPropagation(); const r = wrap.getBoundingClientRect(), off = [Q.x - (e.clientX - r.left), Q.y - (e.clientY - r.top)];
      const mv = (ev) => { const X = ev.clientX - r.left, Y = ev.clientY - r.top;
        if (what === 'c') { Q.x = X + off[0]; Q.y = Y + off[1]; } else { let a = Math.atan2(Y - Q.y, X - Q.x); if (Math.abs(a * 180 / Math.PI) < 1.5) a = 0; Q.ang = a; }
        if (anchored) EQ[step] = { p: pz.toImg([Q.x, Q.y]), ang: Q.ang }; draw(); };
      const upf = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upf); window.removeEventListener('pointercancel', upf); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upf); window.addEventListener('pointercancel', upf);
    };
    const setLock = (v) => { locked = v; block.style.display = v ? 'block' : 'none'; $('.rl-lockb', el).classList.toggle('on', v); $('.rl-pill', el).textContent = v ? '🔒 Plan fixe' : ''; $('.rl-pill', el).style.display = v ? '' : 'none'; };
    $('[data-a=lock]', el).onclick = () => setLock(!locked);
    $('[data-a=reset]', el).onclick = () => { anchored = false; EQ[step] = null; resetRuler(); ui(); draw(); };
    // le plan arrive : on le cadre de façon que le repère (s'il existe) tombe sous l'équerre
    const load = (i) => {
      if (view) view.remove(); view = document.createElement('div'); view.className = 'av-view rl-v'; $('.rl-view', el).appendChild(view);
      const P = plans[i]; view.innerHTML = `<div class="av-stage"><img width="${P.w}" height="${P.h}" src="${srcs[i]}" decoding="async"></div>`;
      pz = panZoom(view, $('.av-stage', view), P.w, P.h, { onChange: () => { cancelAnimationFrame(draw._r); draw._r = requestAnimationFrame(draw); } });
      const fit = () => { if (!view.clientWidth) return setTimeout(fit, 80); pz.fit();
        const R0 = EQ[i] || P.lvRef; if (R0) { const s = pz.st.s * 3; pz.st.s = s; pz.st.tx = Q.x - R0.p[0] * s; pz.st.ty = Q.y - R0.p[1] * s; pz.apply(); if (EQ[i]) anchored = true; }
        draw(); };
      requestAnimationFrame(fit);
      const im = $('img', view); im.onload = () => { if (!anchored) fit(); }; im.onerror = () => toast('Image du plan introuvable (connexion ?)');
    };
    const ui = () => {
      $('.rl-step', el).textContent = `Plan ${step + 1}/${N} · ${names[step]}`;
      const first = step === 0 && !ref;
      $('.rl-hint', el).innerHTML = anchored ? `Équerre fixée sur <b>${esc(names[step])}</b> ✓ — zoomez pour vérifier ; vous pouvez encore la glisser ou la tourner (⟲).`
        : first ? `Déplacez le plan <b>${esc(names[0])}</b> pour coller la <b style="color:#ef4444">règle horizontale</b> sur un fil horizontal (ex. fil 1) et la <b style="color:#2563eb">règle verticale</b> sur un fil vertical (ex. fil A). Retenez ces deux fils.`
        : `Sur <b>${esc(names[step])}</b>, collez l'équerre sur <b>les mêmes fils</b> que sur ${esc(step ? names[step - 1] : refPlan.name)}.`;
      const B = $('.rl-btns', el), last = step === N - 1;
      if (!anchored) B.innerHTML = `${step ? `<button class="btn ghost" data-b="back">‹ ${esc(names[step - 1])}</button>` : ''}<button class="btn" data-b="fix">📌 Fixer sur ${esc(names[step])}</button>`;
      else B.innerHTML = `<button class="btn ghost" data-b="adj">Déplacer</button><button class="btn" data-b="next">${last ? '✓ Comparer' : `Suivant : ${esc(names[step + 1])} ›`}</button>`;
      const b = (k) => $(`[data-b=${k}]`, B);
      if (b('fix')) b('fix').onclick = () => { EQ[step] = { p: pz.toImg([Q.x, Q.y]), ang: Q.ang }; anchored = true; try { navigator.vibrate && navigator.vibrate(15); } catch (e) {} ui(); draw(); };
      if (b('adj')) b('adj').onclick = () => { anchored = false; ui(); draw(); };
      if (b('back')) b('back').onclick = () => { step--; anchored = !!EQ[step]; load(step); ui(); };
      if (b('next')) b('next').onclick = async () => {
        if (!last) { step++; anchored = false; setLock(false); load(step); ui(); return; }   // l'équerre garde sa place à l'écran
        const at = Date.now(); for (let i = 0; i < N; i++) { plans[i].lvRef = { p: EQ[i].p, ang: EQ[i].ang, at }; await DB.put('plans', plans[i]).catch(() => {}); }
        finish(true);
      };
    };
    setLock(false); requestAnimationFrame(() => { resetRuler(); load(0); ui(); });
  });
}
