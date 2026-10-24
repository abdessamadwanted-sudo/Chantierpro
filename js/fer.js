// ================= Ferraillage détaillé par élément (semelle, poteau, poutre, dalle, voile) =================
// Chaque groupe de barres a : Ø, nombre ou espacement, début exact, longueur, recouvrement, retour (crochet),
// ou une forme dessinée à la main. Les barres sont générées en 3D (unités : cm) + nomenclature et poids.
const FER_FIELDS = {
  dia: 'Ø (mm)', nb: 'Nombre (0 = selon espacement)', esp: 'Espacement (cm)', start: 'Début (cm)', len: 'Longueur (cm)',
  rec: 'Recouvrement / attentes (cm)', ret: 'Retour / crochet (cm)', pb: 'Poteau b (cm)', ph: 'Poteau h (cm)',
};
const FER_ELEMS = {
  semelle: { l: 'Semelle isolée', dims: [['Lx', 'Longueur X (cm)', 150], ['Ly', 'Largeur Y (cm)', 150], ['H', 'Hauteur (cm)', 50], ['c', 'Enrobage (cm)', 5]],
    roles: { infX: ['Nappe inférieure X', 'dia nb esp start len ret'], infY: ['Nappe inférieure Y', 'dia nb esp start len ret'], supX: ['Nappe supérieure X', 'dia nb esp start len ret'], supY: ['Nappe supérieure Y', 'dia nb esp start len ret'],
      att: ['Attentes poteau', 'dia nb start len ret pb ph'], cadre: ['Cadres d\'attente', 'dia nb esp start len pb ph'], forme: ['Barre façonnée (dessin)', 'dia nb esp start'] },
    def: (D) => [{ role: 'infX', dia: 12, nb: 0, esp: 15, start: D.c, len: D.Lx - 2 * D.c, ret: Math.max(0, D.H - 2 * D.c - 5) }, { role: 'infY', dia: 12, nb: 0, esp: 15, start: D.c, len: D.Ly - 2 * D.c, ret: Math.max(0, D.H - 2 * D.c - 5) },
      { role: 'att', dia: 14, nb: 4, start: D.c + 3, len: D.H + 60, ret: 25, pb: 30, ph: 30 }, { role: 'cadre', dia: 8, nb: 2, esp: 15, start: 15, len: D.H, pb: 30, ph: 30 }] },
  poteau: { l: 'Poteau', dims: [['b', 'Largeur b (cm)', 30], ['h', 'Profondeur h (cm)', 30], ['H', 'Hauteur (cm)', 300], ['c', 'Enrobage (cm)', 3]],
    roles: { long: ['Barres longitudinales', 'dia nb start len rec ret'], cadre: ['Cadres', 'dia nb esp start len'], epingle: ['Épingles', 'dia nb esp start len'], forme: ['Barre façonnée (dessin)', 'dia nb esp start'] },
    def: (D) => [{ role: 'long', dia: 14, nb: 4, start: 0, len: D.H, rec: 50, ret: 0 }, { role: 'cadre', dia: 8, nb: 0, esp: 10, start: 5, len: 60, zone: 'Zone critique pied' },
      { role: 'cadre', dia: 8, nb: 0, esp: 15, start: 65, len: Math.max(0, D.H - 130) }, { role: 'cadre', dia: 8, nb: 0, esp: 10, start: D.H - 60, len: 55, zone: 'Zone critique tête' }] },
  poutre: { l: 'Poutre', dims: [['L', 'Longueur (cm)', 500], ['b', 'Largeur b (cm)', 25], ['h', 'Hauteur h (cm)', 50], ['c', 'Enrobage (cm)', 3]],
    roles: { inf: ['Filantes inférieures', 'dia nb start len ret'], sup: ['Filantes supérieures', 'dia nb start len ret'], chapG: ['Chapeaux appui gauche', 'dia nb start len ret'], chapD: ['Chapeaux appui droit', 'dia nb start len ret'],
      cadre: ['Cadres', 'dia nb esp start len'], epingle: ['Épingles', 'dia nb esp start len'], forme: ['Barre façonnée / relevée (dessin)', 'dia nb esp start'] },
    def: (D) => [{ role: 'inf', dia: 14, nb: 3, start: -20, len: D.L + 40, ret: 15 }, { role: 'sup', dia: 12, nb: 2, start: -20, len: D.L + 40, ret: 15 },
      { role: 'chapG', dia: 12, nb: 2, start: -20, len: Math.round(D.L / 4) + 20, ret: 15 }, { role: 'chapD', dia: 12, nb: 2, start: D.L - Math.round(D.L / 4), len: Math.round(D.L / 4) + 20, ret: 15 },
      { role: 'cadre', dia: 8, nb: 0, esp: 10, start: 5, len: 2 * D.h, zone: 'Zone critique gauche' }, { role: 'cadre', dia: 8, nb: 0, esp: 20, start: 5 + 2 * D.h, len: Math.max(0, D.L - 10 - 4 * D.h) },
      { role: 'cadre', dia: 8, nb: 0, esp: 10, start: D.L - 5 - 2 * D.h, len: 2 * D.h, zone: 'Zone critique droite' }] },
  dalle: { l: 'Dalle', dims: [['Lx', 'Portée X (cm)', 500], ['Ly', 'Portée Y (cm)', 400], ['e', 'Épaisseur (cm)', 20], ['c', 'Enrobage (cm)', 3]],
    roles: { infX: ['Nappe inférieure X', 'dia nb esp start len ret'], infY: ['Nappe inférieure Y', 'dia nb esp start len ret'], supX: ['Nappe supérieure X', 'dia nb esp start len ret'], supY: ['Nappe supérieure Y', 'dia nb esp start len ret'],
      chapX: ['Chapeaux (barres // X)', 'dia nb esp start len ret'], chapY: ['Chapeaux (barres // Y)', 'dia nb esp start len ret'], forme: ['Renfort façonné (dessin)', 'dia nb esp start'] },
    def: (D) => [{ role: 'infX', dia: 10, nb: 0, esp: 15, start: -10, len: D.Lx + 20, ret: 0 }, { role: 'infY', dia: 10, nb: 0, esp: 20, start: -10, len: D.Ly + 20, ret: 0 },
      { role: 'chapX', dia: 10, nb: 0, esp: 20, start: -15, len: Math.round(D.Lx / 4) + 15, ret: D.e - 2 * D.c, zone: 'Rive gauche' }, { role: 'chapX', dia: 10, nb: 0, esp: 20, start: D.Lx - Math.round(D.Lx / 4), len: Math.round(D.Lx / 4) + 15, ret: D.e - 2 * D.c, zone: 'Rive droite' }] },
  voile: { l: 'Voile', dims: [['L', 'Longueur (cm)', 400], ['H', 'Hauteur (cm)', 300], ['e', 'Épaisseur (cm)', 20], ['c', 'Enrobage (cm)', 3]],
    roles: { vert1: ['Verticales face 1', 'dia nb esp start len rec ret'], vert2: ['Verticales face 2', 'dia nb esp start len rec ret'], hor1: ['Horizontales face 1', 'dia nb esp start len ret'], hor2: ['Horizontales face 2', 'dia nb esp start len ret'],
      epingle: ['Épingles', 'dia esp'], cadre: ['Cadres d\'about (potelet)', 'dia nb esp start len'], forme: ['Barre façonnée (dessin)', 'dia nb esp start'] },
    def: (D) => [{ role: 'vert1', dia: 10, nb: 0, esp: 20, start: 0, len: D.H, rec: 50, ret: 0 }, { role: 'vert2', dia: 10, nb: 0, esp: 20, start: 0, len: D.H, rec: 50, ret: 0 },
      { role: 'hor1', dia: 8, nb: 0, esp: 20, start: -10, len: D.L + 20, ret: D.e - 2 * D.c }, { role: 'hor2', dia: 8, nb: 0, esp: 20, start: -10, len: D.L + 20, ret: D.e - 2 * D.c }, { role: 'epingle', dia: 6, esp: 50 }] },
};
const FER_ROLE_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];

// positions réparties sur [a, b] : nb barres (si nb > 0) sinon selon l'espacement
function ferDist(a, b, nb, esp) {
  if (b < a) [a, b] = [b, a];
  if (+nb > 0) { const n = Math.min(+nb, 600); return n === 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + i * (b - a) / (n - 1)); }
  const e = Math.max(2, +esp || 20), out = []; for (let x = a; x <= b + 0.01 && out.length < 600; x += e) out.push(x); return out;
}
// points répartis sur le périmètre d'un rectangle (coins d'abord)
function ferPerim(x0, z0, x1, z1, n) {
  const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; if (n <= 4) return pts.slice(0, Math.max(1, n));
  const rest = n - 4, w = x1 - x0, d = z1 - z0, per = 2 * (w + d), sides = [[w, (t) => [x0 + t, z0]], [d, (t) => [x1, z0 + t]], [w, (t) => [x1 - t, z1]], [d, (t) => [x0, z1 - t]]];
  let left = rest; sides.forEach(([len, f], i) => { const k = i === 3 ? left : Math.round(rest * len / per); left -= k; for (let j = 1; j <= k; j++) pts.push(f(len * j / (k + 1))); });
  return pts;
}
// génère les barres d'un groupe : liste de polylignes [[x,y,z], …] en cm (y = vertical)
function ferGen(kind, D, g) {
  const out = [], d = (+g.dia || 10) / 10, s = +g.start || 0, len = +g.len || 0, ret = +g.ret || 0, rec = +g.rec || 0;
  const c = +D.c || 3, cad = 0.8;
  const line = (p, q, retDir) => { const r = [p, q]; if (ret && retDir) { r.unshift([p[0] + retDir[0] * ret, p[1] + retDir[1] * ret, p[2] + retDir[2] * ret]); r.push([q[0] + retDir[0] * ret, q[1] + retDir[1] * ret, q[2] + retDir[2] * ret]); } out.push(r); };
  const rect = (pts) => { const r = pts.concat([pts[0]]); const a = pts[0], b = pts[1]; const k = 6 / (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1); r.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + 0.01, a[2] + (b[2] - a[2]) * k]); out.push(r); };
  const shape = (pos, plane) => { const P = (g.path && g.path.length > 1) ? g.path : [[0, 0], [100, 0]]; out.push(P.map(([u, v]) => plane(pos, u, v))); };
  const R = g.role;
  if (kind === 'poutre') {
    const L = D.L, b = D.b, h = D.h, e = c + cad + d / 2, zs = ferDist(e, b - e, Math.max(1, +g.nb || 2));
    if (R === 'inf') zs.forEach(z => line([s, e, z], [s + len, e, z], [0, 1, 0]));
    if (R === 'sup') zs.forEach(z => line([s, h - e, z], [s + len, h - e, z], [0, -1, 0]));
    if (R === 'chapG' || R === 'chapD') zs.forEach(z => line([s, h - e - d - 0.5, z], [s + len, h - e - d - 0.5, z], [0, -1, 0]));
    if (R === 'cadre') ferDist(s, s + len, g.nb, g.esp).forEach(x => rect([[x, c, c], [x, c, b - c], [x, h - c, b - c], [x, h - c, c]]));
    if (R === 'epingle') ferDist(s, s + len, g.nb, g.esp).forEach(x => out.push([[x, c, b / 2], [x, h - c, b / 2]]));
    if (R === 'forme') ferDist(s, s + Math.max(0, (+g.nb || 1) - 1) * (+g.esp || 0), g.nb || 1, g.esp).forEach((x, i) => shape(x, (x0, u, v) => [x0 + u, e + v, b / 2 + (i % 2 ? 2 : -2)]));
    void L;
  }
  if (kind === 'poteau') {
    const b = D.b, h = D.h, e = c + cad + d / 2;
    if (R === 'long') ferPerim(e, e, b - e, h - e, Math.max(1, +g.nb || 4)).forEach(([x, z]) => { const r = [[x, s, z], [x, s + len + rec, z]]; if (ret) { const cx = b / 2 - x, cz = h / 2 - z, k = ret / (Math.hypot(cx, cz) || 1); r.unshift([x + cx * k, s, z + cz * k]); } out.push(r); });
    if (R === 'cadre') ferDist(s, s + len, g.nb, g.esp).forEach(y => rect([[c, y, c], [b - c, y, c], [b - c, y, h - c], [c, y, h - c]]));
    if (R === 'epingle') ferDist(s, s + len, g.nb, g.esp).forEach(y => out.push([[c, y, h / 2], [b - c, y, h / 2]]));
    if (R === 'forme') ferDist(s, s + Math.max(0, (+g.nb || 1) - 1) * (+g.esp || 0), g.nb || 1, g.esp).forEach(y => shape(y, (y0, u, v) => [e + v, y0 + u, h / 2]));
  }
  if (kind === 'semelle' || kind === 'dalle') {
    const Lx = D.Lx, Ly = D.Ly, T = kind === 'dalle' ? D.e : D.H;
    const yInf = c + d / 2, ySup = T - c - d / 2;
    const alongX = (y, dirY) => ferDist(kind === 'dalle' ? c : c, Ly - c, g.nb, g.esp).forEach(z => line([s, y, z], [s + len, y, z], [0, dirY, 0]));
    const alongY = (y, dirY) => ferDist(c, Lx - c, g.nb, g.esp).forEach(x => line([x, y, s], [x, y, s + len], [0, dirY, 0]));
    if (R === 'infX') alongX(yInf, 1); if (R === 'infY') alongY(yInf + d, 1);
    if (R === 'supX') alongX(ySup, -1); if (R === 'supY') alongY(ySup - d, -1);
    if (R === 'chapX') alongX(ySup, -1); if (R === 'chapY') alongY(ySup - d, -1);
    if (R === 'att' || R === 'cadre') {
      const pb = +g.pb || 30, ph = +g.ph || 30, x0 = (Lx - pb) / 2, z0 = (Ly - ph) / 2, ee = c + cad + d / 2;
      if (R === 'att') ferPerim(x0 + ee, z0 + ee, x0 + pb - ee, z0 + ph - ee, Math.max(1, +g.nb || 4)).forEach(([x, z]) => { const r = [[x, s, z], [x, s + len, z]]; if (ret) { const cx = x - Lx / 2, cz = z - Ly / 2, k = ret / (Math.hypot(cx, cz) || 1); r.unshift([x + cx * k, s, z + cz * k]); } out.push(r); });
      else ferDist(s, s + len, g.nb, g.esp).forEach(y => rect([[x0 + c, y, z0 + c], [x0 + pb - c, y, z0 + c], [x0 + pb - c, y, z0 + ph - c], [x0 + c, y, z0 + ph - c]]));
    }
    if (R === 'forme') ferDist(s, s + Math.max(0, (+g.nb || 1) - 1) * (+g.esp || 0), g.nb || 1, g.esp).forEach(z => shape(z, (z0, u, v) => [c + u, yInf + v, z0]));
  }
  if (kind === 'voile') {
    const L = D.L, H = D.H, ep = D.e, z1 = c + d / 2, z2 = ep - c - d / 2;
    if (R === 'vert1' || R === 'vert2') { const z = R === 'vert1' ? z1 : z2, dz = R === 'vert1' ? 1 : -1; ferDist(c, L - c, g.nb, g.esp).forEach(x => { const r = [[x, s, z], [x, s + len + rec, z]]; if (ret) r.unshift([x, s, z + dz * ret]); out.push(r); }); }
    if (R === 'hor1' || R === 'hor2') { const z = R === 'hor1' ? z1 + d : z2 - d, dz = R === 'hor1' ? 1 : -1; ferDist(c, H - c, g.nb, g.esp).forEach(y => line([s, y, z], [s + len, y, z], [0, 0, dz])); }
    if (R === 'epingle') { const e = Math.max(20, +g.esp || 50); for (let x = c + e / 2; x < L - c; x += e) for (let y = c + e / 2; y < H - c; y += e) if (out.length < 400) out.push([[x, y, c], [x, y, ep - c]]); }
    if (R === 'cadre') ferDist(s, s + len, g.nb, g.esp).forEach(y => rect([[c, y, c], [Math.min(L, 40) - c, y, c], [Math.min(L, 40) - c, y, ep - c], [c, y, ep - c]]));
    if (R === 'forme') ferDist(s, s + Math.max(0, (+g.nb || 1) - 1) * (+g.esp || 0), g.nb || 1, g.esp).forEach(x => shape(x, (x0, u, v) => [x0 + v, c + u, ep / 2]));
  }
  return out;
}
const polyLen = (P) => P.reduce((a, p, i) => i ? a + Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1], p[2] - P[i - 1][2]) : 0, 0);
// nomenclature calculée depuis les groupes (pour les listes / poids)
function ferElemBars(m) {
  const E = FER_ELEMS[m.elem.kind];
  return (m.groups || []).map((g, i) => {
    const L = ferGen(m.elem.kind, m.elem, g), ln = L.length ? Math.round(L.reduce((a, P) => a + polyLen(P), 0) / L.length) : 0;
    return { rep: String(i + 1).padStart(3, '0'), dia: +g.dia, nb: L.length, long: ln, code: g.role === 'cadre' ? '5.20' : g.role === 'forme' ? 'dessin' : '0.00', dims: (E.roles[g.role] || [g.role])[0] + (g.zone ? ' · ' + g.zone : ''), place: 'elem', path: g.path };
  });
}
function ferElemDims(m) { const E = FER_ELEMS[m.elem.kind]; return E.dims.map(([k]) => `${k}=${m.elem[k]}`).join(' · '); }

// ---------- Création ----------
async function newElemModel(base) {
  const kind = await menu('Quel élément ?', Object.entries(FER_ELEMS).map(([k, e]) => ({ label: e.l, icon: k === 'dalle' ? 'layers' : k === 'poutre' ? 'rows' : 'box', value: k })));
  if (!kind) return null;
  const E = FER_ELEMS[kind];
  const r = await formSheet(`${E.l} — dimensions`, [{ name: 'name', label: 'Ouvrage', value: base.name || '', placeholder: 'Ex : ' + E.l + ' R+2 axe B' },
    ...E.dims.map(([k, l, v]) => ({ name: k, label: l, type: 'number', value: String(v) }))], { okLabel: 'Suivant' });
  if (!r) return null;
  const D = { kind }; E.dims.forEach(([k, , v]) => { D[k] = num(r[k]) || v; });
  const m = { ...base, type: 'ferraillage', mode: 'elem', name: r.name || E.l, elem: D, groups: E.def(D).map(g => ({ id: DB.uid(), ...g })) };
  const ok = await editGroups(m); if (!ok) return null;
  m.bars = ferElemBars(m);
  await saveModel(base.projectId, m); return m;
}

// ---------- Éditeur des groupes de barres ----------
function editGroups(m) {
  return new Promise((resolve) => {
    const E = FER_ELEMS[m.elem.kind], G = m.groups.map(g => ({ ...g }));
    const s = sheet(`<div class="fg-wrap"><div class="fg-dims"></div><div class="fg-list"></div>
      <button class="btn ghost small" data-a="add">${icon('plus')} Ajouter des barres</button><div class="fb-tot fg-tot"></div>
      <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="ok">${icon('check')} Voir en 3D</button></div></div>`, { title: `${E.l} · ${m.name}` });
    s.onClose = () => resolve(false);
    const field = (g, i, f) => f === 'dia' ? `<label>Ø<select data-f="dia">${DIAS.map(x => `<option ${+g.dia === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`
      : `<label>${FER_FIELDS[f].replace(/ \(.*\)/, '')}<input data-f="${f}" inputmode="decimal" value="${g[f] ?? ''}"></label>`;
    const draw = () => {
      $('.fg-dims', s.el).innerHTML = `<div class="fg-dl">${E.dims.map(([k, l]) => `<label>${l.replace(/ \(cm\)/, '')}<input data-d="${k}" inputmode="decimal" value="${m.elem[k]}"></label>`).join('')}</div>`;
      $('.fg-list', s.el).innerHTML = G.map((g, i) => {
        const [lb, fs] = E.roles[g.role] || [g.role, 'dia nb'];
        const n = ferGen(m.elem.kind, m.elem, g).length;
        return `<div class="fg-card" data-i="${i}" style="--c:${FER_ROLE_COLORS[i % FER_ROLE_COLORS.length]}"><div class="fg-h"><i></i><b>${esc(lb)}</b><input class="fg-zone" data-f="zone" value="${esc(g.zone || '')}" placeholder="Zone / note"><span>${n} barre(s)</span><button class="iconbtn sm" data-del="${i}">${icon('trash')}</button></div>
          <div class="fg-f">${fs.split(' ').map(f => field(g, i, f)).join('')}${g.role === 'forme' ? `<button class="btn small ghost fg-draw" data-draw="${i}">✎ ${g.path ? 'Modifier la forme' : 'Dessiner la forme'}</button>` : ''}</div></div>`;
      }).join('');
      const tmp = { ...m, groups: G }, bars = ferElemBars(tmp), kg = bars.reduce((a, b) => a + b.nb * b.long / 100 * kgm(b.dia), 0);
      $('.fg-tot', s.el).innerHTML = `Total : <b>${nfx(kg, 1)} kg</b> · ${bars.reduce((a, b) => a + b.nb, 0)} barres`;
      $$('[data-d]', s.el).forEach(inp => inp.onchange = () => { m.elem[inp.dataset.d] = num(inp.value) || m.elem[inp.dataset.d]; draw(); });
      $$('.fg-card', s.el).forEach(card => { const g = G[+card.dataset.i]; $$('[data-f]', card).forEach(inp => inp.onchange = () => { g[inp.dataset.f] = inp.dataset.f === 'zone' ? inp.value : num(inp.value); draw(); }); });
      $$('[data-del]', s.el).forEach(b => b.onclick = () => { G.splice(+b.dataset.del, 1); draw(); });
      $$('[data-draw]', s.el).forEach(b => b.onclick = async () => { const g = G[+b.dataset.draw]; const r = await drawBarShape({ path: g.path, dia: g.dia }); if (r) { g.path = r.pts; g.dims = r.dims; draw(); } });
    };
    $('[data-a=add]', s.el).onclick = async () => {
      const role = await menu('Quelles barres ?', Object.entries(E.roles).map(([k, [l]]) => ({ label: l, icon: 'plus', value: k }))); if (!role) return;
      const g = { id: DB.uid(), role, dia: 10, nb: role === 'long' || role === 'att' ? 4 : 0, esp: 20, start: 0, len: +(m.elem.L || m.elem.Lx || m.elem.H || 100), rec: 0, ret: 0, pb: 30, ph: 30 };
      if (role === 'forme') { const r = await drawBarShape({ dia: 12 }); if (!r) return; g.path = r.pts; g.dims = r.dims; g.nb = 1; g.dia = 12; }
      G.push(g); draw();
    };
    $('[data-a=c]', s.el).onclick = () => s.close();
    $('[data-a=ok]', s.el).onclick = () => { m.groups = G; m.bars = ferElemBars(m); s.onClose = null; s.close(); resolve(true); };
    draw();
  });
}

// ---------- 3D : barres générées ----------
function buildElem(T, grp, m, sel) {
  const D = m.elem, k = m.elem.kind, cm = (p) => new T.Vector3(p[0] / 100, p[1] / 100, p[2] / 100);
  const box = { semelle: [D.Lx, D.H, D.Ly], dalle: [D.Lx, D.e, D.Ly], poteau: [D.b, D.H, D.h], poutre: [D.L, D.h, D.b], voile: [D.L, D.H, D.e] }[k];
  const conc = new T.Mesh(new T.BoxGeometry(box[0] / 100, box[1] / 100, box[2] / 100), new T.MeshStandardMaterial({ color: '#94a3b8', transparent: true, opacity: .1, depthWrite: false }));
  conc.position.set(box[0] / 200, box[1] / 200, box[2] / 200); grp.add(conc);
  const ed = new T.LineSegments(new T.EdgesGeometry(conc.geometry), new T.LineBasicMaterial({ color: '#64748b' })); ed.position.copy(conc.position); grp.add(ed);
  const meshes = [];
  (m.groups || []).forEach((g, i) => {
    const col = DIA_COLORS[g.dia] || '#888', gg = new T.Group(); gg.userData.gi = i;
    const r = Math.max(0.003, (+g.dia || 10) / 2000);
    for (const P of ferGen(k, D, g)) gg.add(tube(T, P.map(cm), r, col));
    grp.add(gg); meshes.push(gg);
  });
  grp.userData.highlight = (gi) => meshes.forEach((gg, i) => gg.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = gi != null && i !== gi; o.material.opacity = gi != null && i !== gi ? 0.12 : 1; } }));
  if (sel != null) grp.userData.highlight(sel);
}

// ---------- Dessiner la forme d'une barre ----------
// Le trait à main levée est simplifié, les angles sont accrochés (90° / 45°), puis chaque côté reçoit sa cote en cm.
function drawBarShape({ path = null, dia = 12 } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div'); el.className = 'fullpage sketch bsd';
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('close')}</button><h1 style="flex:1;font-size:17px">Forme de la barre</h1>
        <button class="iconbtn" data-a="undo">${icon('undo')}</button><button class="btn small" data-a="ok" style="flex:none">${icon('check')} OK</button></div>
      <div class="bsd-hint">Dessinez la barre d'un seul trait avec le doigt. Les angles sont redressés automatiquement, puis tapez les cotes.</div>
      <div class="sk-wrap"><canvas class="bsd-cv"></canvas></div>
      <div class="sk-bar"><div class="bsd-snap"><button data-s="90" class="on">90°</button><button data-s="45">45°</button><button data-s="15">15°</button><button data-s="0">Libre</button>
        <select data-dia>${DIAS.map(d => `<option ${d === +dia ? 'selected' : ''}>${d}</option>`).join('')}</select></div><div class="bsd-segs"></div></div>`;
    ($('#sheet-root') || document.body).appendChild(el);
    const unBack = pushBack(() => fin(null, true));
    const cv = $('.bsd-cv', el), g = cv.getContext('2d'), wrap = $('.sk-wrap', el);
    let snap = 90, raw = [], segs = path && path.length > 1 ? pathToSegs(path) : [];   // segs : [{len (cm), ang (deg)}]
    const SC = 3; // px par cm sur la grille (avant mise à l'échelle)
    const fit = () => { const w = wrap.clientWidth - 16, h = wrap.clientHeight - 16; cv.width = Math.round(w * devicePixelRatio); cv.height = Math.round(h * devicePixelRatio); cv.style.width = w + 'px'; cv.style.height = h + 'px'; draw(); };
    function pts() { const P = [[0, 0]]; let a = 0; segs.forEach(s => { a = s.ang; const p = P[P.length - 1]; P.push([p[0] + Math.cos(a * Math.PI / 180) * s.len, p[1] + Math.sin(a * Math.PI / 180) * s.len]); }); return P; }
    function draw() {
      const W = cv.width, H = cv.height, dpr = devicePixelRatio; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#eef2f7'; g.lineWidth = 1; for (let x = 0; x < W; x += 30 * dpr) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 30 * dpr) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      if (raw.length) { g.strokeStyle = '#94a3b8'; g.lineWidth = 4 * dpr; g.lineCap = g.lineJoin = 'round'; g.beginPath(); raw.forEach((p, i) => i ? g.lineTo(p[0] * dpr, p[1] * dpr) : g.moveTo(p[0] * dpr, p[1] * dpr)); g.stroke(); return; }
      if (!segs.length) { g.fillStyle = '#94a3b8'; g.font = `${15 * dpr}px sans-serif`; g.textAlign = 'center'; g.fillText('Dessinez ici ✎', W / 2, H / 2); return; }
      // mise à l'échelle de la forme cotée dans la zone
      const P = pts(), xs = P.map(p => p[0]), ys = P.map(p => p[1]), mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
      const k = Math.min((W - 90 * dpr) / Math.max(1, mxx - mnx), (H - 90 * dpr) / Math.max(1, mxy - mny));
      const tr = ([x, y]) => [(x - mnx) * k + (W - (mxx - mnx) * k) / 2, H - ((y - mny) * k + (H - (mxy - mny) * k) / 2)];
      g.strokeStyle = DIA_COLORS[dia] || '#ef4444'; g.lineWidth = 7 * dpr; g.lineCap = g.lineJoin = 'round'; g.beginPath(); P.forEach((p, i) => { const q = tr(p); i ? g.lineTo(...q) : g.moveTo(...q); }); g.stroke();
      g.font = `bold ${14 * dpr}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      segs.forEach((s, i) => { const a = tr(P[i]), b = tr(P[i + 1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = -(b[1] - a[1]), ny = b[0] - a[0], nl = Math.hypot(nx, ny) || 1;
        const lx = mx + nx / nl * 20 * dpr, ly = my + ny / nl * 20 * dpr, t = `${String.fromCharCode(65 + i)}=${Math.round(s.len)}`;
        g.fillStyle = 'rgba(255,255,255,.9)'; const tw = g.measureText(t).width + 10 * dpr; g.fillRect(lx - tw / 2, ly - 11 * dpr, tw, 22 * dpr); g.fillStyle = '#0f172a'; g.fillText(t, lx, ly); });
    }
    function list() {
      const tot = segs.reduce((a, s) => a + s.len, 0);
      $('.bsd-segs', el).innerHTML = segs.length ? segs.map((s, i) => `<label>${String.fromCharCode(65 + i)}<input data-sl="${i}" inputmode="decimal" value="${Math.round(s.len)}"><small>${i ? Math.round(((s.ang - segs[i - 1].ang) % 360 + 540) % 360 - 180) + '°' : ''}</small></label>`).join('') +
        `<div class="bsd-tot">L développée <b>${Math.round(tot)} cm</b> · ${nfx(tot / 100 * kgm(dia), 2)} kg/barre</div>` : '';
      $$('[data-sl]', el).forEach(inp => inp.onchange = () => { segs[+inp.dataset.sl].len = Math.max(1, num(inp.value) || 1); draw(); list(); });
    }
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); raw = [pos(e)]; draw(); });
    cv.addEventListener('pointermove', (e) => { if (!raw.length) return; raw.push(pos(e)); draw(); });
    const up = () => { if (raw.length < 3) { raw = []; draw(); return; }
      const simp = rdp(raw, Math.max(8, Math.hypot(...[0, 1].map(i => Math.max(...raw.map(p => p[i])) - Math.min(...raw.map(p => p[i])))) * 0.06));
      raw = []; segs = [];
      for (let i = 1; i < simp.length; i++) {
        const dx = simp[i][0] - simp[i - 1][0], dy = -(simp[i][1] - simp[i - 1][1]); let a = Math.atan2(dy, dx) * 180 / Math.PI;
        if (snap) a = Math.round(a / snap) * snap;
        const l = Math.hypot(dx, dy) / SC; if (l < 2) continue;
        const roundTo = l > 50 ? 5 : 1; segs.push({ len: Math.round(l / roundTo) * roundTo, ang: a });
      }
      // fusion des côtés consécutifs de même direction
      segs = segs.reduce((o, s) => { const p = o[o.length - 1]; if (p && Math.abs(p.ang - s.ang) < 0.5) p.len += s.len; else o.push(s); return o; }, []);
      draw(); list(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    $$('[data-s]', el).forEach(b => b.onclick = () => { snap = +b.dataset.s; $$('[data-s]', el).forEach(x => x.classList.toggle('on', x === b)); });
    $('[data-dia]', el).onchange = (e) => { dia = +e.target.value; draw(); list(); };
    $('[data-a=undo]', el).onclick = () => { segs.pop(); draw(); list(); };
    function fin(r, fromBack) { if (!fromBack) unBack(); window.removeEventListener('resize', fit); el.remove(); resolve(r); }
    $('[data-a=x]', el).onclick = () => fin(null);
    $('[data-a=ok]', el).onclick = () => { if (!segs.length) return toast('Dessinez d\'abord la barre'); const P = pts().map(p => [+p[0].toFixed(1), +p[1].toFixed(1)]);
      fin({ pts: P, dia, dims: segs.map((s, i) => `${String.fromCharCode(65 + i)}=${Math.round(s.len)}`).join(' '), long: Math.round(segs.reduce((a, s) => a + s.len, 0)) }); };
    window.addEventListener('resize', fit); requestAnimationFrame(() => { fit(); list(); });
  });
}
function pathToSegs(P) { const o = []; for (let i = 1; i < P.length; i++) { const dx = P[i][0] - P[i - 1][0], dy = P[i][1] - P[i - 1][1]; o.push({ len: Math.hypot(dx, dy), ang: Math.atan2(dy, dx) * 180 / Math.PI }); } return o; }
// simplification Ramer–Douglas–Peucker
function rdp(P, eps) {
  if (P.length < 3) return P.slice();
  const [a, b] = [P[0], P[P.length - 1]]; let dm = 0, im = 0;
  for (let i = 1; i < P.length - 1; i++) { const d = Math.abs((b[1] - a[1]) * P[i][0] - (b[0] - a[0]) * P[i][1] + b[0] * a[1] - b[1] * a[0]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1); if (d > dm) { dm = d; im = i; } }
  return dm > eps ? rdp(P.slice(0, im + 1), eps).slice(0, -1).concat(rdp(P.slice(im), eps)) : [a, b];
}
// Outil autonome : dessiner une barre → forme cotée + poids
async function openBarTool() {
  const r = await drawBarShape({ dia: 12 }); if (!r) return;
  const f = await formSheet('Barre façonnée', [{ name: 'nb', label: 'Nombre de barres', type: 'number', value: '1' }], { okLabel: 'Voir' });
  const nb = (f && num(f.nb)) || 1;
  showBarShape({ rep: 'Forme', dia: r.dia, nb, long: r.long, code: 'dessin', dims: r.dims + ` · ${nfx(nb * r.long / 100 * kgm(r.dia), 2)} kg`, path: r.pts });
}
