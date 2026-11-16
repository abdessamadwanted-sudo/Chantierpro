// ================= HSE spatial (PR 1) : calques HSE sur un plan, outils manuels non destructifs =================
//   Un plan par niveau (voir HsePlans) + des objets HSE dessinés À LA MAIN en coordonnées du plan (points, lignes, polylignes, polygones).
//   Stockage : table « items », kind « hseo » (module serveur « hse ») — aucun fichier, aucun plan n'est modifié (non destructif).
//   Garde-fous du modèle : une dalle n'est praticable qu'après validation HSE (PR 2) ; mur = bloquant ; réservation = exclue ; garde-corps = protection ;
//   rien n'est déduit automatiquement (escaliers : liens explicites en PR 2) ; aucune route n'est calculée ici (PR 3) : le tracé « route » est un croquis indicatif.
//   Outil d'aide à la planification : il ne remplace ni les procédures de secours ni les contrôles de sécurité sur site.
const HseSp = (() => {
  const IC = (n) => 'img/hse/' + n + '.svg';
  // geo : pt = un point · line = polyligne ouverte (≥ 2 points) · poly = polygone fermé (≥ 3 points)
  const GROUPS = [['str', 'Structure'], ['acc', 'Accès & circulation'], ['sec', 'Sécurité & secours']];
  const T = [
    { k: 'dalle', l: 'Dalle', g: 'str', geo: 'poly', ic: 'dalle', c: '#16a34a', st: [['prevue', 'Prévue'], ['coulee', 'Coulée'], ['attente', 'En attente de validation'], ['fermee', 'Fermée']], d: 'prevue' },
    { k: 'mur', l: 'Mur', g: 'str', geo: 'line', ic: 'mur', c: '#475569', st: [['prevu', 'Prévu'], ['construction', 'En construction'], ['construit', 'Construit'], ['modifie', 'Modifié']], d: 'prevu' },
    { k: 'reservation', l: 'Réservation / trémie', g: 'str', geo: 'poly', ic: 'reservation', c: '#dc2626', st: [['ouverte', 'Ouverte'], ['protegee', 'Protégée'], ['bouchee', 'Rebouchée']], d: 'ouverte' },
    { k: 'gardecorps', l: 'Garde-corps', g: 'str', geo: 'line', ic: 'garde-corps', c: '#ea580c', st: [['prevu', 'Prévu'], ['installe', 'Installé'], ['inspecte', 'Inspecté'], ['nonconforme', 'Non conforme']], d: 'prevu' },
    { k: 'escalier', l: 'Escalier', g: 'acc', geo: 'pt', ic: 'escalier', c: '#2563eb', st: [['prevu', 'Prévu'], ['construit', 'Construit'], ['ferme', 'Fermé']], d: 'prevu' },
    { k: 'porte', l: 'Porte / passage', g: 'acc', geo: 'pt', ic: 'porte', c: '#7c3aed', st: [['prevue', 'Prévue'], ['posee', 'Posée'], ['ferme', 'Fermée']], d: 'prevue' },
    { k: 'acces', l: 'Accès provisoire', g: 'acc', geo: 'pt', ic: 'passerelle', c: '#d97706', st: [['prevu', 'Prévu'], ['installe', 'Installé'], ['inspecte', 'Inspecté'], ['interdit', 'Interdit']], d: 'prevu' },
    { k: 'route', l: 'Tracé de route (croquis)', g: 'acc', geo: 'line', ic: 'route', c: '#0891b2', st: [['croquis', 'Croquis — non vérifié']], d: 'croquis' },
    { k: 'risque', l: 'Risque', g: 'sec', geo: 'pt', ic: 'risque', c: '#f59e0b', st: [['actif', 'Actif'], ['maitrise', 'Maîtrisé']], d: 'actif' },
    { k: 'incident', l: 'Incident', g: 'sec', geo: 'pt', ic: 'incident', c: '#b91c1c', st: [['signale', 'Signalé'], ['traite', 'Traité'], ['clos', 'Clos']], d: 'signale' },
    { k: 'secours', l: 'Secours', g: 'sec', geo: 'pt', ic: 'secours', c: '#e11d48', st: [['actif', 'En place'], ['inactif', 'Hors service']], d: 'actif' },
    { k: 'rassemblement', l: 'Point de rassemblement', g: 'sec', geo: 'pt', ic: 'rassemblement', c: '#15803d', st: [['actif', 'Actif'], ['inactif', 'Inactif']], d: 'actif' },
    { k: 'sortie', l: 'Sortie', g: 'sec', geo: 'pt', ic: 'sortie', c: '#16a34a', st: [['actif', 'Actif'], ['inactif', 'Inactif']], d: 'actif' },
    { k: 'inspection', l: 'Inspection', g: 'sec', geo: 'pt', ic: 'inspection', c: '#0ea5e9', st: [['aplanifier', 'À planifier'], ['faite', 'Faite']], d: 'aplanifier' },
    { k: 'qr', l: 'QR de position', g: 'sec', geo: 'pt', ic: 'qr', c: '#334155', st: [['prevu', 'Prévu'], ['pose', 'Posé']], d: 'prevu' },
  ];
  const TK = new Map(T.map(t => [t.k, t]));
  const MIN = { pt: 1, line: 2, poly: 3 };

  // ---------- modèle pur (testé) ----------
  const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; };
  const okPts = (geo, pts) => Array.isArray(pts) && pts.length >= MIN[geo] && pts.every(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) && (geo === 'pt' ? pts.length === 1 : true) && (geo !== 'poly' || area(pts) > 1);
  // enregistrement d'un nouvel objet (null si la géométrie est invalide)
  function make(type, pts, ctx) {
    const t = TK.get(type); if (!t || !okPts(t.geo, pts)) return null;
    const me = ctx.uid || '';
    return { projectId: ctx.projectId, kind: 'hseo', planId: ctx.planId, serieId: ctx.serieId || ctx.planId, indice: ctx.indice || '', type, geom: { t: t.geo, pts: pts.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]) },
      status: t.d, note: '', source: 'manuel', createdBy: me, hist: [{ at: Date.now(), by: me, act: 'créé' }] };
  }
  const visible = (o, hiddenGroups) => { const t = TK.get(o.type); return !!t && !hiddenGroups.includes(t.g); };
  // aimantation : le sommet existant le plus proche dans la tolérance (unités du plan)
  function snap(pt, objs, tol, skipId) {
    let best = null, bd = tol * tol;
    for (const o of objs) { if (o.id === skipId || !o.geom) continue; for (const p of o.geom.pts) { const d = (p[0] - pt[0]) ** 2 + (p[1] - pt[1]) ** 2; if (d <= bd) { bd = d; best = p; } } }
    return best ? [best[0], best[1]] : pt;
  }
  const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0; return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)); };
  const inPoly = (p, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > p[1]) !== (P[j][1] > p[1]) && p[0] < (P[j][0] - P[i][0]) * (p[1] - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
  // distance (unités du plan) d'un point à un objet ; 0 si dans un polygone
  function dist(o, p) { const P = o.geom.pts; if (o.geom.t === 'pt') return Math.hypot(p[0] - P[0][0], p[1] - P[0][1]); if (o.geom.t === 'poly' && inPoly(p, P)) return 0;
    let d = Infinity; for (let i = 0; i < P.length - (o.geom.t === 'line' ? 1 : 0); i++) d = Math.min(d, segD(p, P[i], P[(i + 1) % P.length])); return d; }
  function pick(objs, p, tol) { let best = null, bd = Infinity; for (const o of objs) { const d = dist(o, p), w = d + (o.geom.t === 'poly' ? tol * 0.5 : 0); if (d <= tol && w < bd) { bd = w; best = o; } } return best; }
  // praticabilité (utilisée par le futur graphe, PR 3) : jamais déduite — seule une dalle explicitement validée par un responsable HSE (PR 2) l'est
  const walkable = (o) => !!o && o.type === 'dalle' && o.status === 'praticable_validee' && !!o.verifiedBy;
  const blocks = (o) => !!o && (o.type === 'mur' && o.status !== 'prevu' || o.type === 'reservation' && o.status === 'ouverte');
  // historique annuler / rétablir (opérations réversibles par clé locale)
  function history() {
    const U = [], R = [];
    return { push(op) { U.push(op); R.length = 0; }, can: () => [U.length > 0, R.length > 0],
      async undo() { const op = U.pop(); if (!op) return false; await op.undo(); R.push(op); return true; },
      async redo() { const op = R.pop(); if (!op) return false; await op.redo(); U.push(op); return true; }, size: () => [U.length, R.length] };
  }

  // ---------- éditeur ----------
  async function open(plan, opts = {}) {
    const p = App.project, W = plan.w, H = plan.h;
    if (!W || !H) { toast('Plan sans dimensions : ouvrez-le d\'abord dans « Plans »'); return null; }
    const canW = opts.readOnly ? false : (typeof Team === 'undefined' || !Team.ready || !Team.ready() ? true : (Team.lvl ? Team.lvl('hse') >= 2 : true));
    const ctx = { projectId: p.id, planId: plan.id, serieId: typeof planSerie === 'function' ? planSerie(plan) : plan.id, indice: plan.indice || '', uid: (typeof Team !== 'undefined' && Team.uid && Team.uid()) || '' };
    let hidden = []; try { hidden = JSON.parse(localStorage.getItem('hs.hidden') || '[]'); } catch (e) {}
    const hist = history(), S = { k: 1, x: 0, y: 0, tool: 'pan', sel: null, draft: [], snap: true };
    let objs = [], closed = false;
    const el = document.createElement('div'); el.className = 'fullpage hs-ed';
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 class="hs-ti"></h1>
      <button class="iconbtn" data-a="undo" title="Annuler">${icon('undo')}</button><button class="iconbtn" data-a="redo" title="Rétablir">${icon('redo')}</button><button class="iconbtn" data-a="more">${icon('more')}</button></div>
      <div class="hs-vp"><svg class="hs-svg" xmlns="http://www.w3.org/2000/svg"><g class="hs-world"><image class="hs-img" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/><image class="hs-hd" x="0" y="0" width="0" height="0" preserveAspectRatio="none"/><g class="hs-l"></g><g class="hs-d"></g><g class="hs-h"></g></g></svg>
        <div class="hs-hint"></div></div>
      <div class="hs-bar" style="display:none"><button data-a="fin">✓ Terminer</button><button data-a="pop">↶ Point</button><button data-a="can">✕ Annuler</button></div>
      <div class="hs-pal">${canW ? '' : '<span class="hs-ro">Lecture seule</span>'}<button class="hs-t on" data-t="pan" title="Déplacer / sélectionner">✋<b>Choisir</b></button>${canW ? '<button class="hs-lst">☰ Liste des outils</button>' : ''}${canW ? GROUPS.map(([g, gl]) => T.filter(t => t.g === g).map(t => `<button class="hs-t" data-t="${t.k}" title="${esc(t.l)}"><img src="${IC(t.ic)}" alt="${esc(t.l)}"><b>${esc(t.l.split(' / ')[0].replace('Tracé de route (croquis)', 'Route').replace('Point de rassemblement', 'Rassemblt').replace('Accès provisoire', 'Accès'))}</b></button>`).join('')).join('<i></i>') : ''}</div>`;
    document.body.appendChild(el);
    const unBack = typeof pushBack === 'function' ? pushBack(() => shut()) : () => {};
    const $e = (s) => el.querySelector(s), svg = $e('.hs-svg'), world = $e('.hs-world'), gL = $e('.hs-l'), gD = $e('.hs-d'), gH = $e('.hs-h'), vp = $e('.hs-vp');
    $e('.hs-ti').textContent = `${(plan.name || 'Plan')}${plan.indice ? ' · ' + plan.indice : ''}`;
    // image de base : A0 → version allégée (mémoire), les coordonnées restent celles du plan
    try { const lite = Math.max(W, H) > 3600 && typeof avLiteURL === 'function'; const f = await DB.get('files', plan.fileId); const u = lite ? await avLiteURL(plan.fileId, 3200, { viewer: true }) : (f ? BlobURL.get(f.id, f.blob) : ''); if (u) $e('.hs-img').setAttribute('href', u); } catch (e) { console.warn('hse img', e); }
    const hint = (t) => { $e('.hs-hint').textContent = t || ''; $e('.hs-hint').style.display = t ? '' : 'none'; };
    // plan net en zoom (HD) : au repos, on découpe la zone visible dans l'image d'origine (pleine résolution) et on la pose par-dessus la version allégée
    let hdT = 0, hdU = '', hdN = 0;
    const hdOff = () => { const i = $e('.hs-hd'); if (i) { i.setAttribute('width', 0); i.setAttribute('height', 0); } };
    const hdUpdate = async () => {
      const my = ++hdN; try {
        if (S.k < S.k0 * 2.5) return hdOff();
        const r = vp.getBoundingClientRect(), x0 = Math.max(0, -S.x / S.k), y0 = Math.max(0, -S.y / S.k), x1 = Math.min(W, (r.width - S.x) / S.k), y1 = Math.min(H, (r.height - S.y) / S.k);
        if (x1 <= x0 || y1 <= y0) return hdOff();
        const f = await DB.get('files', plan.fileId); if (!f || !f.blob || my !== hdN) return;
        const sw = x1 - x0, sh = y1 - y0, kk = Math.min(1, 2048 / Math.max(sw, sh)), bm = await createImageBitmap(f.blob, Math.round(x0), Math.round(y0), Math.max(1, Math.round(sw)), Math.max(1, Math.round(sh)), { resizeWidth: Math.max(1, Math.round(sw * kk)), resizeQuality: 'high' });
        if (my !== hdN) { bm.close && bm.close(); return; }
        const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0); bm.close && bm.close();
        const b = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.88)); c.width = c.height = 0; if (!b || my !== hdN) return;
        const u = URL.createObjectURL(b), i = $e('.hs-hd'); if (!i || closed) { URL.revokeObjectURL(u); return; }
        i.setAttribute('href', u); i.setAttribute('x', Math.round(x0)); i.setAttribute('y', Math.round(y0)); i.setAttribute('width', Math.round(sw)); i.setAttribute('height', Math.round(sh));
        if (hdU) URL.revokeObjectURL(hdU); hdU = u;
      } catch (e) { hdOff(); }
    };
    const hdSoon = () => { clearTimeout(hdT); hdT = setTimeout(hdUpdate, 280); };
    const apply = () => { world.setAttribute('transform', `translate(${S.x} ${S.y}) scale(${S.k})`); draw(); if (S.k < S.k0 * 2.5) hdOff(); hdSoon(); };
    const fit = () => { const r = vp.getBoundingClientRect(); S.k = Math.min(r.width / W, r.height / H) * 0.98 || 1; S.x = (r.width - W * S.k) / 2; S.y = (r.height - H * S.k) / 2; S.k0 = S.k; };
    const toPlan = (cx, cy) => { const r = vp.getBoundingClientRect(); return [(cx - r.left - S.x) / S.k, (cy - r.top - S.y) / S.k]; };
    const zoomAt = (cx, cy, f) => { const r = vp.getBoundingClientRect(), nk = Math.max(S.k0 * 0.8, Math.min(S.k0 * 60, S.k * f)), px = cx - r.left, py = cy - r.top; S.x = px - (px - S.x) * nk / S.k; S.y = py - (py - S.y) * nk / S.k; S.k = nk; apply(); };
    async function load() { objs = (await DB.byProject('items', p.id)).filter(o => o.kind === 'hseo' && o.planId === plan.id || o.kind === 'hseo' && ctx.serieId && o.serieId === ctx.serieId && o.planId !== plan.id && false); draw(); }
    const selObj = () => objs.find(o => o.id === S.sel);

    // ---------- dessin ----------
    const px = (n) => n / S.k;
    function drawObj(o, sel) {
      const t = TK.get(o.type), P = o.geom.pts, dash = /^(prev|croquis|attente|aplanifier)/.test(o.status) ? ` stroke-dasharray="${px(7)} ${px(5)}"` : '', sw = px(sel ? 3.6 : 2.4);
      if (o.geom.t === 'poly') return `<polygon points="${P.map(q => q.join(',')).join(' ')}" fill="${t.c}" fill-opacity="${sel ? .38 : .24}" stroke="${t.c}" stroke-width="${sw}"${dash} stroke-linejoin="round"/>`;
      if (o.geom.t === 'line') return `<polyline points="${P.map(q => q.join(',')).join(' ')}" fill="none" stroke="${t.c}" stroke-width="${px(sel ? 5 : 3.6)}"${dash} stroke-linecap="round" stroke-linejoin="round"/>`;
      const s = px(34); return `<g transform="translate(${P[0][0]} ${P[0][1]})">${sel ? `<circle r="${px(25)}" fill="none" stroke="#2563eb" stroke-width="${px(3)}"/>` : ''}<image href="${IC(t.ic)}" x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}"/></g>`;
    }
    // nom affiché sur chaque objet (type + note) : on sait toujours ce qu'on touche
    const cen = (o) => { const P = o.geom.pts; if (o.geom.t === 'pt') return [P[0][0], P[0][1] + 24 / S.k]; if (o.geom.t === 'line') { const m = P[Math.floor((P.length - 1) / 2)], n = P[Math.ceil((P.length - 1) / 2)]; return [(m[0] + n[0]) / 2, (m[1] + n[1]) / 2 - 8 / S.k]; } return [P.reduce((a, q) => a + q[0], 0) / P.length, P.reduce((a, q) => a + q[1], 0) / P.length]; };
    const label = (o) => { const t = TK.get(o.type), c = cen(o), st = (t.st.find(x => x[0] === o.status) || [])[1] || '', tx = t.l.split(' / ')[0] + (o.note ? ' · ' + o.note : '');
      return `<text x="${c[0]}" y="${c[1]}" text-anchor="middle" font-size="${px(13)}" font-weight="700" fill="#0f172a" stroke="#fff" stroke-width="${px(3.5)}" paint-order="stroke" stroke-linejoin="round" pointer-events="none">${esc(tx)}<tspan x="${c[0]}" dy="${px(14)}" font-size="${px(11)}" font-weight="500" fill="#334155">${esc(st)}</tspan></text>`; };
    function draw() {
      if (!gL) return;
      const vis = objs.filter(o => visible(o, hidden)), order = { poly: 0, line: 1, pt: 2 };
      gL.innerHTML = vis.sort((a, b) => order[a.geom.t] - order[b.geom.t]).map(o => `<g data-id="${o.id}">${drawObj(o, o.id === S.sel)}${label(o)}</g>`).join('');
      const so = selObj(), r = px(7);
      gH.innerHTML = so && canW && visible(so, hidden) && so.geom.t !== 'pt' ? so.geom.pts.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="${r}" fill="#fff" stroke="#2563eb" stroke-width="${px(2.4)}" data-v="${i}"/>`).join('') : '';
      const tt = TK.get(S.tool), D = S.draft;
      gD.innerHTML = tt && D.length ? (tt.geo === 'poly' ? `<polyline points="${D.map(q => q.join(',')).join(' ')}" fill="${tt.c}" fill-opacity=".15" stroke="${tt.c}" stroke-width="${px(2.4)}" stroke-dasharray="${px(6)} ${px(4)}"/>` : `<polyline points="${D.map(q => q.join(',')).join(' ')}" fill="none" stroke="${tt.c}" stroke-width="${px(3.6)}" stroke-dasharray="${px(6)} ${px(4)}"/>`) + D.map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="${px(5)}" fill="${tt.c}" stroke="#fff" stroke-width="${px(1.6)}"/>`).join('') : '';
      const [cu, cr] = hist.can(); ($e('[data-a=undo]') || {}).disabled = !cu; ($e('[data-a=redo]') || {}).disabled = !cr;
      $e('.hs-bar').style.display = tt && tt.geo !== 'pt' && D.length ? '' : 'none';
      const fin = $e('[data-a=fin]'); if (fin) fin.disabled = !tt || D.length < MIN[tt.geo];
    }

    // ---------- persistance + historique ----------
    const stamp = (o, act) => { o.hist = [...(o.hist || []), { at: Date.now(), by: ctx.uid, act }].slice(-20); o.updatedBy = ctx.uid; };
    async function create(type, pts) {
      const rec = make(type, pts, ctx); if (!rec) { toast('Géométrie invalide'); return null; }
      const keep = { rec: await DB.put('items', rec) }; objs.push(keep.rec); S.sel = keep.rec.id;
      hist.push({ undo: async () => { await DB.del('items', keep.rec.id); objs = objs.filter(o => o.id !== keep.rec.id); if (S.sel === keep.rec.id) S.sel = null; draw(); },
        redo: async () => { const c = { ...keep.rec }; delete c.id; delete c.createdAt; keep.rec = await DB.put('items', c); objs.push(keep.rec); S.sel = keep.rec.id; draw(); } });
      draw(); return keep.rec;
    }
    async function update(o, patch, act) {   // patch : champs à changer (geom, status, note)
      const before = JSON.parse(JSON.stringify(o)), ref = { id: o.id };
      const apply1 = async (vals, a) => { const cur = objs.find(x => x.id === ref.id); if (!cur) return; Object.assign(cur, JSON.parse(JSON.stringify(vals))); stamp(cur, a); await DB.put('items', cur); draw(); };
      await apply1(patch, act);
      hist.push({ undo: () => apply1({ geom: before.geom, status: before.status, note: before.note }, 'annulé'), redo: () => apply1(patch, act) });
    }
    async function remove(o) {
      const ref = { rec: JSON.parse(JSON.stringify(o)) }; await DB.del('items', o.id); objs = objs.filter(x => x.id !== o.id); if (S.sel === o.id) S.sel = null;
      hist.push({ undo: async () => { const c = { ...ref.rec }; delete c.id; delete c.createdAt; ref.cur = await DB.put('items', c); objs.push(ref.cur); S.sel = ref.cur.id; draw(); },
        redo: async () => { const id = (ref.cur || ref.rec).id; await DB.del('items', id); objs = objs.filter(x => x.id !== id); if (S.sel === id) S.sel = null; draw(); } });
      draw();
    }
    async function finish() {
      const tt = TK.get(S.tool); if (!tt || S.draft.length < MIN[tt.geo]) return;
      const r = await create(S.tool, S.draft); S.draft = []; if (r) hint(''); draw();
    }
    const addPoint = (pt) => { const tt = TK.get(S.tool); if (!tt) return; const q = S.snap ? snap(pt, objs.filter(o => visible(o, hidden)), px(14), null) : pt;
      if (tt.geo === 'pt') return create(S.tool, [q]); S.draft = [...S.draft, q]; hint(tt.geo === 'poly' ? 'Touchez les sommets, puis « Terminer »' : 'Touchez les points, puis « Terminer »'); draw(); };

    // ---------- fiche d'un objet ----------
    async function sheetOf(o) {
      const t = TK.get(o.type);
      const v = await menu(`${t.l}${o.note ? ' · ' + o.note : ''}`, [
        { label: 'Statut : ' + ((t.st.find(s => s[0] === o.status) || [])[1] || o.status), icon: 'check', value: 'st' }, { label: 'Note', icon: 'edit', value: 'note' },
        ...(canW ? [{ label: 'Dupliquer', icon: 'plus', value: 'dup' }, { label: 'Supprimer', icon: 'trash', danger: true, value: 'del' }] : [])]);
      if (v === 'st' && canW) { const s = await menu('Statut — ' + t.l, t.st.map(s => ({ label: s[1] + (s[0] === o.status ? '  ✓' : ''), value: s[0] }))); if (s && s !== o.status) await update(o, { status: s }, 'statut ' + s); }
      else if (v === 'note' && canW) { const r = await formSheet('Note', [{ name: 'n', label: 'Note (≤ 120 caractères)', value: o.note || '' }]); if (r) await update(o, { note: String(r.n || '').slice(0, 120) }, 'note'); }
      else if (v === 'dup') { const sh = o.geom.pts.map(q => [q[0] + px(30), q[1] + px(30)]); await create(o.type, sh); }
      else if (v === 'del' && await confirmBox('Supprimer cet objet ?')) await remove(o);
    }
    async function layersMenu() {
      for (;;) {
        const v = await menu('Calques HSE', [...GROUPS.map(([g, gl]) => ({ label: `${hidden.includes(g) ? '☐' : '☑'} ${gl} (${objs.filter(o => (TK.get(o.type) || {}).g === g).length})`, value: g })), { label: 'Fermer', value: '' }]);
        if (!v) break; hidden = hidden.includes(v) ? hidden.filter(x => x !== v) : [...hidden, v]; try { localStorage.setItem('hs.hidden', JSON.stringify(hidden)); } catch (e) {} draw();
      }
    }

    // ---------- gestes ----------
    const ptrs = new Map(); let g = null;
    // zoom de travail : choisir un outil de dessin sur un plan « en entier » rapproche la vue (centre de l'écran) pour placer avec précision
    const workZoom = (cx, cy) => { if (S.k >= S.k0 * 3) return; const r = vp.getBoundingClientRect(); const f = Math.min(3.5, (S.k0 * 4) / S.k); zoomAt(cx == null ? r.left + r.width / 2 : cx, cy == null ? r.top + r.height / 2 : cy, f); };
    const setTool = (k) => { const was = S.tool; S.tool = k; S.draft = []; if (k !== 'pan') S.sel = null; el.querySelectorAll('.hs-t').forEach(b => b.classList.toggle('on', b.dataset.t === k)); const t = TK.get(k); const ls = $e('.hs-lst'); if (ls) ls.textContent = '☰ ' + (t ? t.l : 'Liste des outils');
      hint(t ? (t.geo === 'pt' ? `Touchez le plan pour placer : ${t.l}` : `${t.l} : touchez le 1er point`) : ''); if (k !== 'pan' && was !== k) workZoom(); draw(); };
    svg.addEventListener('pointerdown', (e) => {
      try { svg.setPointerCapture(e.pointerId); } catch (x) {} ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; g = { type: 'pinch', d: Math.hypot(a[0] - b[0], a[1] - b[1]), cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 }; return; }
      if (ptrs.size > 2) return;
      const pt = toPlan(e.clientX, e.clientY); g = { type: 'one', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, pt };
      const so = selObj();
      if (canW && so && S.tool === 'pan' && visible(so, hidden)) { const tol = px(18); const i = so.geom.t === 'pt' ? (Math.hypot(pt[0] - so.geom.pts[0][0], pt[1] - so.geom.pts[0][1]) < tol ? 0 : -1) : so.geom.pts.findIndex(q => Math.hypot(pt[0] - q[0], pt[1] - q[1]) < tol); if (i >= 0) g.drag = { o: so, i, before: JSON.parse(JSON.stringify(so.geom)) }; }
    });
    svg.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (!g) return;
      if (g.type === 'pinch' && ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2; S.x += cx - g.cx; S.y += cy - g.cy; if (g.d) zoomAt(cx, cy, d / g.d); else apply(); g.d = d; g.cx = cx; g.cy = cy; return; }
      if (g.type !== 'one') return;
      if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 8) return; g.moved = true;
      if (g.drag) { const q = toPlan(e.clientX, e.clientY), s2 = S.snap ? snap(q, objs.filter(o => o !== g.drag.o && visible(o, hidden)), px(14), g.drag.o.id) : q; g.drag.o.geom.pts[g.drag.i] = [Math.round(s2[0] * 10) / 10, Math.round(s2[1] * 10) / 10]; draw(); }
      else { S.x += e.clientX - g.lx; S.y += e.clientY - g.ly; apply(); }
      g.lx = e.clientX; g.ly = e.clientY;
    });
    const up = async (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if (!g) return;
      if (g.type === 'pinch') { if (!ptrs.size) g = null; else g = { type: 'idle' }; return; }
      const cur = g; g = null; if (cur.type !== 'one') return;
      if (cur.drag && cur.moved) { const o = cur.drag.o, after = JSON.parse(JSON.stringify(o.geom)); o.geom = cur.drag.before; await update(o, { geom: after }, 'déplacé'); return; }
      if (cur.moved) return;
      if (S.tool === 'pan') { const o = pick(objs.filter(x => visible(x, hidden)), cur.pt, px(20)); S.sel = o ? o.id : null; draw(); if (o) sheetOf(o); }
      else if (canW) { const first = !S.draft.length; addPoint(cur.pt); if (first && S.k < S.k0 * 3) workZoom(e.clientX, e.clientY); }
    };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 0.83); }, { passive: false });

    // ---------- barre / menus ----------
    el.querySelectorAll('.hs-t').forEach(b => b.onclick = () => setTool(b.dataset.t));
    ($e('.hs-lst') || {}).onclick = async () => {
      const v = await menu('Outils HSE', [{ label: 'Choisir / déplacer (sans dessiner)', icon: 'edit', value: 'pan' }, ...GROUPS.flatMap(([g, gl]) => T.filter(t => t.g === g).map(t => ({ label: `${gl} · ${t.l}${t.geo === 'pt' ? '' : t.geo === 'line' ? ' (ligne)' : ' (zone)'}`, swatch: t.c, value: t.k })))]);
      if (v) setTool(v);
    };
    ($e('[data-a=fin]') || {}).onclick = finish; ($e('[data-a=pop]') || {}).onclick = () => { S.draft = S.draft.slice(0, -1); draw(); }; ($e('[data-a=can]') || {}).onclick = () => { S.draft = []; hint(''); draw(); };
    ($e('[data-a=undo]') || {}).onclick = () => hist.undo(); ($e('[data-a=redo]') || {}).onclick = () => hist.redo();
    ($e('[data-a=more]') || {}).onclick = async () => {
      const v = await menu('Plan HSE', [{ label: 'Calques', icon: 'layers', value: 'lay' }, { label: `Aimantation aux sommets : ${S.snap ? 'oui' : 'non'}`, icon: 'check', value: 'snap' }, { label: 'Ouvrir le plan (visionneuse)', icon: 'plans', value: 'viewer' }]);
      if (v === 'lay') layersMenu(); else if (v === 'snap') { S.snap = !S.snap; toast('Aimantation ' + (S.snap ? 'activée' : 'désactivée')); } else if (v === 'viewer') openPlanViewer(plan, planCtx(() => {}));
    };
    function shut() { if (closed) return; closed = true; clearTimeout(hdT); if (hdU) { try { URL.revokeObjectURL(hdU); } catch (e) {} } try { unBack(); } catch (e) {} el.remove(); if (opts.onClose) opts.onClose(); }
    ($e('[data-a=x]') || {}).onclick = shut;
    fit(); apply(); await load(); if (!canW) hint('Lecture seule (droits HSE insuffisants)'); else if (!objs.length) hint('Choisissez un outil en bas, puis touchez le plan');
    // contrôleur (tests et futures PR)
    return { add: (type, pts) => create(type, pts), update, remove, objs: () => objs, undo: () => hist.undo(), redo: () => hist.redo(), hide: (gs) => { hidden = gs; draw(); }, select: (id) => { S.sel = id; draw(); }, close: shut, el, state: S, setTool, finish, addPoint };
  }
  return { open, T, TK, GROUPS, make, snap, pick, dist, okPts, area, walkable, blocks, visible, history };
})();
