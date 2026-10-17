// ================= Calage à la règle : la même règle (① ②) posée sur deux croisements de fils, sur chaque niveau =================
// La règle reste fixe à l'écran : on déplace le plan dessous. Une fois « fixée », elle suit le plan (zoom avant / arrière sans bouger).
// Deux points → décalage + rotation + échelle exacts entre les deux niveaux.
function openRulerCalage(low, up, opts = {}) {
  return new Promise(async (resolve) => {
    const la = opts.la || low.name, lb = opts.lb || up.name, plans = [low, up], names = [la, lb];
    const srcs = await Promise.all([fileURL(low.fileId), fileURL(up.fileId)]);
    const el = document.createElement('div'); el.className = 'fullpage rl';
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title" style="flex:1"><b>Calage à la règle</b><span class="rl-step"></span></div>
        <button class="iconbtn rl-lockb" data-a="lock" title="Plan fixe">${icon('lock')}</button><button class="iconbtn" data-a="reset" title="Remettre la règle">${icon('undo')}</button></div>
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
    el._rl = { get pz() { return pz; }, H, pts, get draw() { return draw; } };
    const resetRuler = () => { const r = wrap.getBoundingClientRect(); H[0] = { x: r.width * .22, y: r.height * .5 }; H[1] = { x: r.width * .78, y: r.height * .5 }; };
    const toScr = (p) => [p[0] * pz.st.s + pz.st.tx, p[1] * pz.st.s + pz.st.ty];
    const draw = () => {
      if (anchored) pts[step].forEach((p, i) => { const [x, y] = toScr(p); H[i] = { x, y }; });
      const [a, b] = H, cross = (h, c, n) => `<g class="rl-h" data-h="${n}"><circle cx="${h.x}" cy="${h.y}" r="26" fill="transparent"/>
          <line x1="${h.x - 46}" y1="${h.y}" x2="${h.x + 46}" y2="${h.y}" stroke="${c}" stroke-width="1.4"/><line x1="${h.x}" y1="${h.y - 46}" x2="${h.x}" y2="${h.y + 46}" stroke="${c}" stroke-width="1.4"/>
          <circle cx="${h.x}" cy="${h.y}" r="13" fill="none" stroke="${c}" stroke-width="2.2"/><circle cx="${h.x}" cy="${h.y}" r="2.2" fill="${c}"/>
          <g transform="translate(${h.x + 16},${h.y - 16})"><circle r="11" fill="${c}"/><text y="4.5" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" font-family="Arial">${n + 1}</text></g></g>`;
      ov.innerHTML = `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#f59e0b" stroke-width="3" stroke-dasharray="10 6" opacity=".9"/>${cross(a, '#ef4444', 0)}${cross(b, '#2563eb', 1)}`;
      $$('.rl-h', ov).forEach(g => g.onpointerdown = (e) => drag(e, +g.dataset.h));
    };
    // glisser une poignée ① ou ② (le plan ne bouge pas)
    const drag = (e, i) => {
      e.preventDefault(); e.stopPropagation(); const r = wrap.getBoundingClientRect(), off = [H[i].x - (e.clientX - r.left), H[i].y - (e.clientY - r.top)];
      const mv = (ev) => { H[i] = { x: ev.clientX - r.left + off[0], y: ev.clientY - r.top + off[1] }; if (anchored) pts[step][i] = pz.toImg([H[i].x, H[i].y]); draw(); };
      const upf = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upf); window.removeEventListener('pointercancel', upf); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upf); window.addEventListener('pointercancel', upf);
    };
    const setLock = (v) => { locked = v; block.style.display = v ? 'block' : 'none'; $('.rl-lockb', el).classList.toggle('on', v); $('.rl-pill', el).textContent = v ? '🔒 Plan fixe' : ''; $('.rl-pill', el).style.display = v ? '' : 'none'; };
    $('[data-a=lock]', el).onclick = () => setLock(!locked);
    $('[data-a=reset]', el).onclick = () => { anchored = false; pts[step] = []; resetRuler(); ui(); draw(); };
    // charge le plan de l'étape : la règle garde sa place à l'écran
    const load = (i) => {
      if (view) view.remove(); view = document.createElement('div'); view.className = 'av-view rl-v'; $('.rl-view', el).appendChild(view);
      const P = plans[i]; view.innerHTML = `<div class="av-stage"><img width="${P.w}" height="${P.h}" src="${srcs[i]}"></div>`;
      pz = panZoom(view, $('.av-stage', view), P.w, P.h, { onChange: () => { cancelAnimationFrame(draw._r); draw._r = requestAnimationFrame(draw); } });
      requestAnimationFrame(() => { if (opts.keep && opts.keep[i]) { Object.assign(pz.st, opts.keep[i]); pz.apply(); } else pz.fit(); draw(); });
    };
    const ui = () => {
      $('.rl-step', el).textContent = `Étape ${step + 1}/2 · ${names[step]}`;
      $('.rl-hint', el).innerHTML = anchored ? `Règle fixée sur <b>${esc(names[step])}</b> ✓ — zoomez pour vérifier ; vous pouvez encore glisser ① ou ②.`
        : step === 0 ? `Déplacez le plan <b>${esc(la)}</b> pour mettre <b style="color:#ef4444">①</b> et <b style="color:#2563eb">②</b> sur deux croisements de fils (ex. A/1 et E/1). Vous pouvez aussi glisser ① et ②.`
        : `Même chose sur <b>${esc(lb)}</b> : mettez <b style="color:#ef4444">①</b> et <b style="color:#2563eb">②</b> sur <b>les mêmes croisements</b> que sur ${esc(la)}.`;
      const B = $('.rl-btns', el);
      if (!anchored) B.innerHTML = `${step ? `<button class="btn ghost" data-b="back">‹ ${esc(la)}</button>` : ''}<button class="btn" data-b="fix">📌 Fixer sur ${esc(names[step])}</button>`;
      else B.innerHTML = `<button class="btn ghost" data-b="adj">Déplacer la règle</button><button class="btn" data-b="next">${step ? '✓ Comparer' : `Suivant : ${esc(lb)} ›`}</button>`;
      const b = (k) => $(`[data-b=${k}]`, B);
      if (b('fix')) b('fix').onclick = () => { pts[step] = H.map(h => pz.toImg([h.x, h.y])); anchored = true; try { navigator.vibrate && navigator.vibrate(15); } catch (e) {} ui(); draw(); };
      if (b('adj')) b('adj').onclick = () => { anchored = false; ui(); draw(); };
      if (b('back')) b('back').onclick = () => { step = 0; anchored = true; load(0); ui(); };
      if (b('next')) b('next').onclick = () => {
        if (step === 0) { step = 1; anchored = false; setLock(false); load(1); ui(); return; }   // la règle reste à la même place à l'écran
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
