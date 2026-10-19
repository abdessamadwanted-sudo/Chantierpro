// ================= Poutre 3D : lecture d'un plan de ferraillage (Arche / Graitec) ou saisie, puis modèle 3D fidèle =================
// Une poutre : section b×h, portée L entre appuis aL / aR, enrobages, nomenclature (positions) et répartition des cadres « 5 + 12x12 + 5x30… ».
// Enregistrées dans project.poutres (synchronisées avec le projet).
const PT_COL = ['#a855f7', '#ef4444', '#f59e0b', '#ec4899', '#22c55e', '#3b82f6', '#06b6d4', '#84cc16', '#f97316', '#14b8a6'];
const ptList = (p) => (p.poutres = p.poutres || []);
const ptKg = (b) => (+b.n || 0) * (+b.lg || 0) / 100 * (+b.d) ** 2 * 0.00617;
const ptTotKg = (P) => (P.bars || []).reduce((a, b) => a + ptKg(b), 0);
const ptVol = (P) => (+P.b / 100) * (+P.h / 100) * ((+P.L + (+P.aL || 0) + (+P.aR || 0)) / 100);
const ptTypeL = { droite: 'Droite', crochet: 'Avec retour', cadre: 'Cadre', epingle: 'Épingle' };
// « 5 + 12x12 + 5x30 + 3x21 + 5x30 + 13x11 + 5 » → abscisses des cadres depuis le nu de l'appui gauche
function ptEspPos(esp) {
  const t = String(esp || '').replace(/[×*]/g, 'x').split(/[\s+;]+/).filter(Boolean), out = []; let x = 0, first = true;
  for (const k of t) { const m = k.match(/^(\d+)x(\d+(?:[.,]\d+)?)$/i); if (m) { for (let i = 0; i < +m[1]; i++) { x += +m[2].replace(',', '.'); out.push(x); } first = false; continue; }
    const v = parseFloat(k.replace(',', '.')); if (!isFinite(v)) continue; if (first) { x += v; out.push(x); first = false; } }
  return out;
}

// ---------- Lecture du PDF (texte du plan : section, nomenclature, formes, cotes, répartition) ----------
// texte d'une page dans le sens de lecture (page tournée comprise), doublons retirés (PDF « imprimés » répètent le texte)
async function ptPageItems(doc, n) {
  const page = await doc.getPage(n), tc = await page.getTextContent(), vp = page.getViewport({ scale: 1 }), seen = new Set(), items = [];
  for (const it of tc.items) { const s = String(it.str).trim(); if (!s) continue; const t = pdfjsLib.Util.transform(vp.transform, it.transform), x = t[4], y = t[5], k = s + '|' + Math.round(x) + '|' + Math.round(y);
    if (seen.has(k)) continue; seen.add(k); const horiz = Math.abs(t[1]) < Math.abs(t[0]); items.push({ s, x, y, w: horiz ? (it.width || 0) * vp.scale : 0 }); }
  return { items, vp };
}
const ptDocOf = async (file) => { if (!pdfReady()) throw new Error('Lecteur PDF indisponible'); return file._doc || (file._doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise); };
// liste des poutres du PDF (une par page) : repère, niveau, section
async function ptScanPdf(file) {
  const doc = await ptDocOf(file), out = [];
  for (let n = 1; n <= doc.numPages; n++) { const { items, vp } = await ptPageItems(doc, n), all = items.map(i => i.s).join(' '), sec = all.match(/Section\s*:?\s*(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/);
    if (!sec || !/Barre/i.test(all)) continue; const nm = items.find(i => /^P[A-Z]{0,3}\s?\d{1,4}(?:[-_ ]?[A-Z0-9]{1,3})?$/.test(i.s) && i.y < vp.height * .2);
    out.push({ page: n, name: nm ? nm.s : `Page ${n}`, sec: `${sec[1]}×${sec[2]}` }); }
  return out;
}
async function ptReadPdf(file, pageNo = 1) {
  const doc = await ptDocOf(file);
  const { items, vp } = await ptPageItems(doc, Math.min(pageNo, doc.numPages));
  const all = items.map(i => i.s).join(' ');
  const num = (s) => parseFloat(String(s).replace(',', '.'));
  const P = { id: DB.uid(), name: '', niv: '', b: 0, h: 0, L: 0, aL: 0, aR: 0, cb: 3, ch: 3, cl: 3, fck: '', vol: 0, kg: 0, esp: '', bars: [], pages: doc.numPages };
  const sec = all.match(/Section\s*:?\s*(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/); if (sec) { P.b = num(sec[1]); P.h = num(sec[2]); }
  const g = (re) => { const m = all.match(re); return m ? num(m[1]) : 0; };
  P.vol = g(/B[ée]ton\s*=\s*(\d+(?:[.,]\d+)?)\s*m/i); P.kg = g(/Acier\s*=\s*(\d+(?:[.,]\d+)?)\s*kg/i);
  P.cb = g(/Eb\s*=\s*(\d+(?:[.,]\d+)?)/) || 3; P.ch = g(/Eh\s*=\s*(\d+(?:[.,]\d+)?)/) || P.cb; P.cl = g(/El\s*=\s*(\d+(?:[.,]\d+)?)/) || P.cb;
  const fk = all.match(/fck\s*=\s*(\d+)/i); if (fk) P.fck = 'C' + fk[1];
  const nm = items.find(i => /^P[A-Z]{0,3}\s?\d{1,4}(?:[-_ ]?[A-Z0-9]{1,3})?$/.test(i.s) && i.y < vp.height * .2); if (nm) P.name = nm.s; else P.name = `Poutre p.${pageNo}`;
  const nv = all.match(/\b((?:PH|PB|Niv\.?)?\s*(?:R\s?\+\s?\d+|RDC|SS\s?\d?|Mezz\w*))\b/i); if (nv) P.niv = nv[1].replace(/\s+/g, ' ').trim();
  // tableau des barres
  const hB = items.find(i => /^Barre$/i.test(i.s) && i.y < vp.height * .3), hL = items.find(i => /^Lg$/i.test(i.s) && hB && Math.abs(i.y - hB.y) < 6), hF = items.find(i => /^Forme$/i.test(i.s) && hB && Math.abs(i.y - hB.y) < 6);
  const tableX0 = hB ? hB.x - 40 : vp.width * .7;
  if (hB) {
    const rows = items.filter(i => i.y > hB.y + 2 && /^(\d{1,3})\s*(?:HA|T|Ø|RL)\s*(\d{1,2})$/i.test(i.s.replace(/\s/g, '')) && Math.abs(i.x - hB.x) < 40).sort((a, b) => a.y - b.y);
    rows.forEach((r, k) => {
      const m = r.s.replace(/\s/g, '').match(/^(\d{1,3})(?:HA|T|Ø|RL)(\d{1,2})$/i), y0 = r.y - 3, y1 = (rows[k + 1] ? rows[k + 1].y : r.y + 40) - 3;
      const posIt = items.find(i => /^\d{1,2}$/.test(i.s) && i.x < r.x - 5 && i.x > tableX0 && Math.abs(i.y - r.y) < 5);
      const lgIt = hL && items.find(i => /^\d{2,4}$/.test(i.s) && Math.abs(i.x + i.w / 2 - (hL.x + hL.w / 2)) < 25 && Math.abs(i.y - r.y) < 5);
      const fx0 = hF ? hF.x - 30 : (lgIt ? lgIt.x + 25 : r.x + 60);
      const fn = items.filter(i => i.x >= fx0 && i.y >= y0 && i.y < y1 && /^\d{1,4}$/.test(i.s)).map(i => ({ v: +i.s, x: i.x + i.w / 2, y: i.y }));
      const b = { pos: posIt ? +posIt.s : k + 1, n: +m[1], d: +m[2], lg: lgIt ? +lgIt.s : 0, type: 'droite', main: 0, leg: 0, side: 'g', face: 'inf', align: 'c', ca: 0, cb2: 0 };
      const vals = fn.map(f => f.v), big = fn.length ? fn.reduce((a, f) => f.v > a.v ? f : a, fn[0]) : null;
      if (fn.length >= 2 && b.lg && fn.every(f => f.v < b.lg * .6) && fn.length <= 3) {
        // cadre (2 côtés) ou épingle
        const s = vals.sort((a, c) => c - a); if (Math.abs(2 * (s[0] + s[1]) - b.lg) < b.lg * .35) { b.type = 'cadre'; b.cb2 = s[0]; b.ca = s[1]; } else { b.type = 'epingle'; b.main = s[0]; }
      } else if (fn.length === 1 && b.lg && fn[0].v < b.lg * .85) { b.type = 'epingle'; b.main = fn[0].v; }
      else if (big && b.lg) {
        b.main = big.v; const legs = fn.filter(f => f !== big && f.v < big.v * .6);
        let best = null; for (const l of legs) { const e = big.v + l.v - b.lg; if (e >= -3 && e <= 16 && (!best || Math.abs(e - 5) < Math.abs(best.e - 5))) best = { ...l, e }; }
        if (best) { b.type = 'crochet'; b.leg = best.v; b.side = best.x < big.x ? 'g' : 'd'; } else b.main = b.lg;
      } else { b.main = b.lg; }
      P.bars.push(b);
    });
  }
  // élévation : cotes (appui · portée · appui), répartition des cadres, repères ① ② ③…
  const elev = items.filter(i => i.x < tableX0 - 5);
  const spc = elev.filter(i => /^\d{1,3}\s*x\s*\d{1,3}(?:[.,]\d)?$/i.test(i.s)); let bandA = 1e9, bandB = -1e9;
  if (spc.length) {
    const ys = spc.map(i => i.y), yA = Math.min(...ys) - 14, yB = Math.max(...ys) + 14; bandA = yA; bandB = yB;
    const toks = elev.filter(i => i.y >= yA && i.y <= yB && (/^\d{1,3}\s*x\s*\d{1,3}(?:[.,]\d)?$/i.test(i.s) || (/^\d{1,2}$/.test(i.s) && +i.s <= 15))).sort((a, b) => a.x - b.x);
    P.esp = toks.map(t => t.s.replace(/\s/g, '')).join(' + ');
  }
  const big = elev.filter(i => /^\d{3,4}$/.test(i.s)).sort((a, b) => +b.s - +a.s)[0];
  if (big) { P.L = +big.s; const row = elev.filter(i => /^\d{1,3}$/.test(i.s) && Math.abs(i.y - big.y) < 4 && i !== big); const l = row.filter(i => i.x < big.x).sort((a, b) => b.x - a.x)[0], r = row.filter(i => i.x > big.x).sort((a, b) => a.x - b.x)[0]; if (l) P.aL = +l.s; if (r) P.aR = +r.s; }
  const sec2 = elev.filter(i => /Coupe|Elévation|Élévation/i.test(i.s));
  const coupeY = (sec2.find(i => /Coupe/i.test(i.s)) || {}).y || vp.height * .65;
  const labs = elev.filter(i => /^\d{1,2}$/.test(i.s) && i.y < coupeY - 10 && !(i.y >= bandA && i.y <= bandB) && !(big && Math.abs(i.y - big.y) < 4) && P.bars.some(b => b.pos === +i.s && (b.type === 'droite' || b.type === 'crochet')));
  if (labs.length >= 2) {
    const xs = elev.filter(i => /^\d{2,4}$/.test(i.s) && big && Math.abs(i.y - big.y) < 4), x0 = xs.length ? Math.min(...xs.map(i => i.x)) : 0, x1 = xs.length ? Math.max(...xs.map(i => i.x + i.w)) : vp.width;
    const ly = labs.map(i => i.y), mid = (Math.min(...ly) + Math.max(...ly)) / 2;
    for (const l of labs) { const b = P.bars.find(x => x.pos === +l.s); if (!b) continue; if (Math.max(...ly) - Math.min(...ly) > 12) b.face = l.y < mid ? 'sup' : 'inf'; const f = (l.x - x0) / Math.max(1, x1 - x0); b.align = f < .38 ? 'g' : f > .62 ? 'd' : 'c'; }
  }
  // retour : vers l'intérieur de la poutre (barre du bas → vers le haut). Barre droite presque de la longueur totale : centrée.
  const tot = P.L + P.aL + P.aR;
  P.bars.forEach(b => { if ((b.type === 'droite' || b.type === 'crochet') && (b.main > tot * .85 || Math.abs(b.main - P.L) < P.L * .06)) b.align = 'c'; if (b.type === 'crochet' && b.align === 'c') b.align = b.side; });
  return P;
}

// ---------- Modèle 3D ----------
function ptBuild(T, P, opt = {}) {
  const grp = new T.Group(), cm = (v) => v / 100, V = (x, y, z) => new T.Vector3(cm(x), cm(y), cm(z));
  const b = +P.b, h = +P.h, L = +P.L, aL = +P.aL || 0, aR = +P.aR || 0, cb = +P.cb || 3, ch = +P.ch || cb, cl = +P.cl || cb, X0 = -aL, X1 = L + aR;
  const conc = new T.Mesh(new T.BoxGeometry(cm(X1 - X0), cm(h), cm(b)), new T.MeshStandardMaterial({ color: '#94a3b8', transparent: true, opacity: opt.solid ? .55 : .13, depthWrite: false }));
  conc.position.set(cm((X0 + X1) / 2), cm(h / 2), cm(b / 2)); conc.userData.conc = true; grp.add(conc);
  const ed = new T.LineSegments(new T.EdgesGeometry(conc.geometry), new T.LineBasicMaterial({ color: '#475569' })); ed.position.copy(conc.position); grp.add(ed);
  const sup = (xa, xb) => { const m = new T.Mesh(new T.BoxGeometry(cm(xb - xa), cm(120), cm(b)), new T.MeshStandardMaterial({ color: '#cbd5e1', transparent: true, opacity: .35, depthWrite: false })); m.position.set(cm((xa + xb) / 2), cm(-60), cm(b / 2)); grp.add(m);
    const e2 = new T.LineSegments(new T.EdgesGeometry(m.geometry), new T.LineBasicMaterial({ color: '#94a3b8' })); e2.position.copy(m.position); grp.add(e2); };
  if (aL) sup(X0, 0); if (aR) sup(L, X1);
  const mats = {}; const mat = (c) => mats[c] || (mats[c] = new T.MeshStandardMaterial({ color: c, roughness: .45, metalness: .35 }));
  const tube = (pts, r, col, tag) => { const g2 = new T.Group(); g2.userData.pos = tag; for (let i = 0; i < pts.length - 1; i++) { const A = pts[i], B = pts[i + 1], len = A.distanceTo(B); if (len < 1e-6) continue;
      const cy = new T.Mesh(new T.CylinderGeometry(r, r, len, 10), mat(col)); cy.position.copy(A).add(B).multiplyScalar(.5); cy.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize()); g2.add(cy);
      if (i) { const sp = new T.Mesh(new T.SphereGeometry(r, 10, 8), mat(col)); sp.position.copy(A); g2.add(sp); } } return g2; };
  const st = (P.bars || []).find(x => x.type === 'cadre'), ds = st ? +st.d / 10 : .8, xs = ptEspPos(P.esp);   // ds en cm
  const col = (bar) => PT_COL[((+bar.pos || 1) - 1) % PT_COL.length];
  const hidden = new Set(opt.hidden || []);
  // armatures longitudinales : rangées par face, lits successifs
  const lit = { inf: 0, sup: 0 }, litY = { inf: cb + ds, sup: h - ch - ds };
  for (const bar of (P.bars || []).filter(x => x.type === 'droite' || x.type === 'crochet')) {
    const d = +bar.d, r = d / 20, n = Math.max(1, Math.min(+bar.n || 1, 30)), f = bar.face === 'sup' ? 'sup' : 'inf';
    const y = f === 'inf' ? litY.inf + r + lit.inf : litY.sup - r - lit.sup; lit[f] += d / 10 + 2.5;
    const len = Math.min(+bar.main || +bar.lg || L, X1 - X0 - 2 * cl);
    const xa = bar.align === 'g' ? X0 + cl : bar.align === 'd' ? X1 - cl - len : (len <= L + 5 ? L / 2 : (X0 + X1) / 2) - len / 2, xb = xa + len;
    const z0 = cl + ds + r, z1 = b - cl - ds - r;
    if (hidden.has(+bar.pos)) continue;
    for (let j = 0; j < n; j++) {
      const z = n === 1 ? b / 2 : z0 + j * (z1 - z0) / (n - 1), up = f === 'inf' ? 1 : -1, leg = +bar.leg || 0;
      let pts = [V(xa, y, z), V(xb, y, z)];
      if (bar.type === 'crochet' && leg) { if (bar.side === 'g' || bar.side === '2') pts.unshift(V(xa, y + up * leg, z)); if (bar.side === 'd' || bar.side === '2') pts.push(V(xb, y + up * leg, z)); }
      grp.add(tube(pts, cm(r), col(bar), +bar.pos));
    }
  }
  // cadres et épingles aux abscisses de la répartition
  for (const bar of (P.bars || []).filter(x => x.type === 'cadre' || x.type === 'epingle')) {
    if (hidden.has(+bar.pos)) continue;
    const r = +bar.d / 20, pos = xs.length ? xs : Array.from({ length: Math.min(+bar.n || 0, 200) }, (_, i) => (i + 1) * L / ((+bar.n || 1) + 1));
    for (const x of pos.slice(0, 200)) {
      const zl = cl + r, zr = b - cl - r, yb = cb + r, yt = h - ch - r;
      const pts = bar.type === 'cadre' ? [V(x, yb, zl), V(x, yb, zr), V(x, yt, zr), V(x, yt, zl), V(x, yb, zl), V(x, yb + 5, zl + 4)] : [V(x + r * 2, yb - 0.5, b / 2 - 3), V(x + r * 2, yb - 0.5, b / 2), V(x + r * 2, yt + 0.5, b / 2), V(x + r * 2, yt + 0.5, b / 2 + 3)];
      grp.add(tube(pts, cm(r), col(bar), +bar.pos));
    }
  }
  grp.userData = { X0, X1, b, h };
  return grp;
}
// coupe transversale (SVG) à l'abscisse x
function ptCoupeSVG(P, x) {
  const b = +P.b, h = +P.h, cb = +P.cb || 3, ch = +P.ch || cb, cl = +P.cl || cb, K = 160 / Math.max(b, h), W = b * K + 40, H = h * K + 40;
  const st = (P.bars || []).find(q => q.type === 'cadre'), ds = st ? +st.d / 10 : .8; let out = '';
  out += `<rect x="20" y="20" width="${b * K}" height="${h * K}" fill="#cbd5e1" fill-opacity=".35" stroke="#475569" stroke-width="1.5"/>`;
  if (st) out += `<rect x="${20 + cl * K}" y="${20 + ch * K}" width="${(b - 2 * cl) * K}" height="${(h - cb - ch) * K}" rx="3" fill="none" stroke="${PT_COL[(st.pos - 1) % PT_COL.length]}" stroke-width="${Math.max(1.5, ds * K)}"/>`;
  const lit = { inf: 0, sup: 0 }, tot = +P.L + (+P.aL || 0) + (+P.aR || 0), X0 = -(+P.aL || 0), X1 = +P.L + (+P.aR || 0);
  for (const bar of (P.bars || []).filter(q => q.type === 'droite' || q.type === 'crochet')) {
    const d = +bar.d, r = d / 20, n = Math.max(1, Math.min(+bar.n || 1, 30)), f = bar.face === 'sup' ? 'sup' : 'inf', len = Math.min(+bar.main || +bar.lg || tot, tot - 2 * cl);
    const xa = bar.align === 'g' ? X0 + cl : bar.align === 'd' ? X1 - cl - len : (len <= +P.L + 5 ? +P.L / 2 : (X0 + X1) / 2) - len / 2;
    const y = f === 'inf' ? cb + ds + r + lit.inf : h - ch - ds - r - lit.sup; lit[f] += d / 10 + 2.5;
    if (x < xa || x > xa + len) continue;
    for (let j = 0; j < n; j++) { const z = n === 1 ? b / 2 : cl + ds + r + j * (b - 2 * (cl + ds + r)) / (n - 1); out += `<circle cx="${20 + z * K}" cy="${20 + (h - y) * K}" r="${Math.max(2.5, r * K)}" fill="${PT_COL[(bar.pos - 1) % PT_COL.length]}" stroke="#111" stroke-width=".6"/>`; }
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${out}<text x="20" y="14" font-size="11" fill="currentColor">x = ${Math.round(x)} cm</text></svg>`;
}

// ---------- Formulaires ----------
async function ptEditMain(P) {
  const r = await formSheet('Poutre · dimensions', [
    { name: 'name', label: 'Nom (repère)', value: P.name, placeholder: 'Ex : PT01' }, { name: 'niv', label: 'Niveau', value: P.niv, placeholder: 'Ex : PH R+5' },
    { name: 'b', label: 'Largeur b (cm)', type: 'number', value: P.b }, { name: 'h', label: 'Hauteur h (cm)', type: 'number', value: P.h },
    { name: 'L', label: 'Portée entre appuis (cm)', type: 'number', value: P.L }, { name: 'aL', label: 'Appui gauche (cm)', type: 'number', value: P.aL }, { name: 'aR', label: 'Appui droit (cm)', type: 'number', value: P.aR },
    { name: 'cb', label: 'Enrobage bas (cm)', type: 'number', value: P.cb }, { name: 'ch', label: 'Enrobage haut (cm)', type: 'number', value: P.ch }, { name: 'cl', label: 'Enrobage latéral (cm)', type: 'number', value: P.cl },
    { name: 'esp', label: 'Répartition des cadres (cm)', value: P.esp, placeholder: 'Ex : 5 + 12x12 + 5x30 + 3x21 + 5x30 + 13x11 + 5' },
    { name: 'fck', label: 'Béton', value: P.fck, placeholder: 'Ex : C30' }, { name: 'vol', label: 'Béton du plan (m³, pour contrôle)', type: 'number', value: P.vol || '' }, { name: 'kg', label: 'Acier du plan (kg, pour contrôle)', type: 'number', value: P.kg || '' }], { okLabel: 'Enregistrer' });
  if (!r) return false;
  ['b', 'h', 'L', 'aL', 'aR', 'cb', 'ch', 'cl', 'vol', 'kg'].forEach(k => { P[k] = parseFloat(String(r[k]).replace(',', '.')) || 0; }); P.name = r.name; P.niv = r.niv; P.esp = r.esp; P.fck = r.fck; return true;
}
async function ptEditBar(P, bar) {
  const isNew = !bar; bar = bar || { pos: (P.bars || []).reduce((a, x) => Math.max(a, +x.pos || 0), 0) + 1, n: 3, d: 12, lg: 0, type: 'droite', main: 0, leg: 0, side: 'g', face: 'inf', align: 'c', ca: 0, cb2: 0 };
  const r = await formSheet(isNew ? 'Nouvelle position' : `Position ${bar.pos}`, [
    { name: 'pos', label: 'N° de position', type: 'number', value: bar.pos }, { name: 'n', label: 'Nombre', type: 'number', value: bar.n },
    { name: 'd', label: 'Diamètre HA (mm)', type: 'select', value: bar.d, options: [6, 8, 10, 12, 14, 16, 20, 25, 32, 40].map(v => ({ value: v, label: 'HA' + v })) },
    { name: 'type', label: 'Forme', type: 'select', value: bar.type, options: Object.entries(ptTypeL).map(([v, l]) => ({ value: v, label: l })) },
    { name: 'lg', label: 'Longueur développée Lg (cm)', type: 'number', value: bar.lg },
    { name: 'main', label: 'Partie droite (cm) — barres', type: 'number', value: bar.main || '' }, { name: 'leg', label: 'Retour (cm)', type: 'number', value: bar.leg || '' },
    { name: 'side', label: 'Retour côté', type: 'select', value: bar.side, options: [{ value: 'g', label: 'Gauche' }, { value: 'd', label: 'Droite' }, { value: '2', label: 'Les deux' }] },
    { name: 'face', label: 'Position', type: 'select', value: bar.face, options: [{ value: 'inf', label: 'En bas (inférieure)' }, { value: 'sup', label: 'En haut (supérieure / chapeau)' }] },
    { name: 'align', label: 'Placée', type: 'select', value: bar.align, options: [{ value: 'c', label: 'Au centre' }, { value: 'g', label: 'Depuis la gauche' }, { value: 'd', label: 'Depuis la droite' }] },
    { name: 'cb2', label: 'Cadre : hauteur (cm)', type: 'number', value: bar.cb2 || '' }, { name: 'ca', label: 'Cadre : largeur (cm)', type: 'number', value: bar.ca || '' }], { okLabel: 'Enregistrer', danger: isNew ? null : 'Supprimer' });
  if (!r) return false;
  P.bars = P.bars || [];
  if (r.__danger) { P.bars = P.bars.filter(x => x !== bar); return true; }
  Object.assign(bar, { pos: +r.pos || bar.pos, n: +r.n || 0, d: +r.d, type: r.type, lg: +r.lg || 0, main: +r.main || 0, leg: +r.leg || 0, side: r.side, face: r.face, align: r.align, cb2: +r.cb2 || 0, ca: +r.ca || 0 });
  if (isNew) P.bars.push(bar); P.bars.sort((a, c) => a.pos - c.pos); return true;
}

// ---------- Visionneuse ----------
async function ptOpen(p, P) {
  await need3D(); const T = THREE;
  return new Promise((resolve) => {
    const el = document.createElement('div'); el.className = 'fullpage v3page pt3'; document.body.appendChild(el);
    let renderer, raf, ro, ctl, grp, hidden = new Set(), cutX = (+P.L || 0) / 2, solid = false;
    const close = () => { cancelAnimationFrame(raf); ro && ro.disconnect(); renderer && renderer.dispose(); el.remove(); resolve(); }, unBack = pushBack(close);
    const save = async () => { const L = ptList(p), i = L.findIndex(x => x.id === P.id); if (i >= 0) L[i] = P; else L.push(P); await DB.put('projects', p); };
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:17px">${esc(P.name || 'Poutre')}${P.niv ? ` <small style="opacity:.7">${esc(P.niv)}</small>` : ''}</h1>
        <button class="iconbtn" data-a="snap" title="Image">${icon('camera')}</button><button class="iconbtn" data-a="more">${icon('more')}</button></div>
      <div class="v3-stage"><div class="v3-views"><button data-v="3d">3D</button><button data-v="front">Élévation</button><button data-v="side">Bout</button><button data-v="top">Dessus</button><button data-v="solid">Béton</button></div></div>
      <div class="v3-panel pt-panel"></div>`;
    const stage = $('.v3-stage', el), scene = new T.Scene(); scene.background = new T.Color(document.documentElement.classList.contains('th-net') ? '#f1f5f9' : '#e9edf2');
    const cam = new T.PerspectiveCamera(40, 1, 0.01, 500);
    renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); stage.prepend(renderer.domElement);
    scene.add(new T.AmbientLight(0xffffff, .75)); const dl = new T.DirectionalLight(0xffffff, .8); dl.position.set(3, 6, 4); scene.add(dl); const dl2 = new T.DirectionalLight(0xffffff, .35); dl2.position.set(-4, 2, -3); scene.add(dl2);
    ctl = new T.OrbitControls(cam, renderer.domElement); ctl.enableDamping = true;
    const cutPlane = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: '#2563eb', transparent: true, opacity: .18, side: T.DoubleSide, depthWrite: false })); scene.add(cutPlane);
    const rebuild = () => { if (grp) scene.remove(grp); grp = ptBuild(T, P, { hidden: [...hidden], solid }); scene.add(grp); placeCut(); };
    const placeCut = () => { const u = grp.userData; cutPlane.scale.set(u.b / 100 * 1.25, u.h / 100 * 1.25, 1); cutPlane.rotation.y = Math.PI / 2; cutPlane.position.set(cutX / 100, u.h / 200, u.b / 200); };
    // cadrage : toute la poutre tient dans l'écran (portrait ou paysage)
    const view = (v) => { const u = grp.userData, cx = (u.X0 + u.X1) / 200, len = (u.X1 - u.X0) / 100, H = u.h / 100, B = u.b / 100, f = Math.tan(cam.fov * Math.PI / 360);
      const dist = (w, h) => Math.max(h / 2 / f, w / 2 / f / Math.max(.2, cam.aspect)) * 1.08; ctl.target.set(cx, H / 2, B / 2);
      if (v === 'front') cam.position.set(cx, H / 2, B / 2 + dist(len, H * 3));
      else if (v === 'side') cam.position.set(u.X1 / 100 + dist(B * 2.4, H * 2.4), H / 2, B / 2);
      else if (v === 'top') cam.position.set(cx, H + dist(len, B * 3), B / 2 + .001);
      else { const d = dist(len * .62, len * .3), n = new THREE.Vector3(.42, .38, .82).normalize(); cam.position.set(cx + n.x * d, H / 2 + n.y * d, B / 2 + n.z * d); }
      ctl.update(); };
    const fitR = () => { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); };
    ro = new ResizeObserver(fitR); ro.observe(stage);
    const loop = () => { raf = requestAnimationFrame(loop); ctl.update(); renderer.render(scene, cam); };
    const panel = () => {
      const kg = ptTotKg(P), vol = ptVol(P), dk = P.kg ? (kg - P.kg) / P.kg * 100 : null, dv = P.vol ? (vol - P.vol) / P.vol * 100 : null;
      const byD = {}; (P.bars || []).forEach(b => { const o = byD[b.d] = byD[b.d] || { lg: 0, kg: 0 }; o.lg += (+b.n || 0) * (+b.lg || 0) / 100; o.kg += ptKg(b); });
      const xs = ptEspPos(P.esp), nCad = ((P.bars || []).find(b => b.type === 'cadre') || {}).n;
      $('.pt-panel', el).innerHTML = `
        <div class="pt-kpi"><div><small>Section</small><b>${P.b} × ${P.h}</b></div><div><small>Portée</small><b>${P.L} cm</b></div><div class="${dv != null && Math.abs(dv) > 8 ? 'w' : ''}"><small>Béton</small><b>${nfx(vol)} m³</b>${P.vol ? `<i>plan ${nfx(P.vol)}</i>` : ''}</div><div class="${dk != null && Math.abs(dk) > 3 ? 'w' : 'ok'}"><small>Acier</small><b>${nfx(kg, 1)} kg</b>${P.kg ? `<i>plan ${nfx(P.kg, 1)} ${Math.abs(dk) <= 3 ? '✓' : '⚠'}</i>` : ''}</div></div>
        <div class="pt-cut"><span>Coupe</span><input type="range" min="${-(+P.aL || 0)}" max="${+P.L + (+P.aR || 0)}" value="${cutX}" data-a="cut"><b data-a="cutv">${Math.round(cutX)} cm</b></div>
        <div class="pt-row2"><div class="pt-coupe">${ptCoupeSVG(P, cutX)}</div>
          <div class="pt-meta"><div><small>Enrobages</small> ${P.cb} / ${P.ch} / ${P.cl} cm</div><div><small>Cadres</small> ${xs.length || '—'}${nCad && xs.length && nCad !== xs.length ? ` <span class="w">≠ ${nCad} dans la nomenclature</span>` : ''}</div><div class="pt-esp">${esc(P.esp || 'répartition non saisie')}</div>
          ${Object.keys(byD).sort((a, c) => a - c).map(d => `<div><small>HA${d}</small> ${nfx(byD[d].lg, 1)} m · ${nfx(byD[d].kg, 1)} kg</div>`).join('')}</div></div>
        <div class="pt-bars">${(P.bars || []).map((b, i) => `<div class="pt-b ${hidden.has(+b.pos) ? 'off' : ''}"><button class="pt-eye" data-hide="${b.pos}" style="--c:${PT_COL[(b.pos - 1) % PT_COL.length]}">${b.pos}</button>
          <button class="grow pt-bt" data-bi="${i}"><b>${b.n} HA${b.d}</b> <span>· ${ptTypeL[b.type] || b.type} · Lg ${b.lg}${b.type === 'cadre' ? ` · ${b.ca}×${b.cb2}` : b.type === 'crochet' ? ` · ${b.main}+${b.leg} ${b.side === 'g' ? '⟵' : b.side === 'd' ? '⟶' : '⟷'}` : ''}${b.type === 'droite' || b.type === 'crochet' ? ` · ${b.face === 'sup' ? 'haut' : 'bas'} · ${b.align === 'g' ? 'gauche' : b.align === 'd' ? 'droite' : 'centre'}` : ''}</span></button><small>${nfx(ptKg(b), 1)} kg</small></div>`).join('')}
          <div class="pt-acts"><button class="btn ghost small" data-a="addbar">${icon('plus')} Position</button><button class="btn ghost small" data-a="dims">${icon('edit')} Dimensions</button></div></div>`;
      $('[data-a=cut]', el).oninput = (e) => { cutX = +e.target.value; $('[data-a=cutv]', el).textContent = Math.round(cutX) + ' cm'; $('.pt-coupe', el).innerHTML = ptCoupeSVG(P, cutX); placeCut(); };
      $$('[data-hide]', el).forEach(b2 => b2.onclick = () => { const k = +b2.dataset.hide; hidden.has(k) ? hidden.delete(k) : hidden.add(k); rebuild(); panel(); });
      $$('[data-bi]', el).forEach(b2 => b2.onclick = async () => { if (await ptEditBar(P, P.bars[+b2.dataset.bi])) { await save(); rebuild(); panel(); } });
      $('[data-a=addbar]', el).onclick = async () => { if (await ptEditBar(P, null)) { await save(); rebuild(); panel(); } };
      $('[data-a=dims]', el).onclick = async () => { if (await ptEditMain(P)) { await save(); $('h1', el).textContent = P.name || 'Poutre'; rebuild(); view('3d'); panel(); } };
    };
    $$('[data-v]', el).forEach(b2 => b2.onclick = () => { if (b2.dataset.v === 'solid') { solid = !solid; b2.classList.toggle('on', solid); return rebuild(); } view(b2.dataset.v); });
    $('[data-a=x]', el).onclick = () => { unBack(); close(); };
    $('[data-a=snap]', el).onclick = () => { renderer.render(scene, cam); renderer.domElement.toBlob(bl => shareBlob(bl, `${safeName(P.name || 'poutre')}_3D.png`), 'image/png'); };
    $('[data-a=more]', el).onclick = async () => {
      const v = await menu(P.name || 'Poutre', [{ label: 'Dimensions et répartition', icon: 'edit', value: 'dims' }, { label: 'Ajouter une position', icon: 'plus', value: 'add' }, { label: 'Fiche PDF (3D + coupe + nomenclature)', icon: 'pdf', value: 'pdf' }, ...(P.pdfFileId ? [{ label: 'Voir le plan d\'origine', icon: 'plans', value: 'src' }] : []), { label: 'Supprimer la poutre', icon: 'trash', danger: true, value: 'del' }]);
      if (v === 'dims') $('[data-a=dims]', el).click(); if (v === 'add') $('[data-a=addbar]', el).click();
      if (v === 'src') { const f = await DB.get('files', P.pdfFileId); if (f) openFileRecord(f, f.name); }
      if (v === 'pdf') { renderer.render(scene, cam); await ptPdf(P, renderer.domElement); }
      if (v === 'del' && await confirmBox(`Supprimer la poutre ${P.name || ''} ?`, 'Supprimer')) { p.poutres = ptList(p).filter(x => x.id !== P.id); await DB.put('projects', p); unBack(); close(); }
    };
    rebuild(); fitR(); view('3d'); panel(); loop();
  });
}
async function ptPdf(P, canvas) {
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });
  doc.setFontSize(15); doc.text(`${P.name || 'Poutre'}${P.niv ? ' · ' + P.niv : ''} — ${P.b}×${P.h} · portée ${P.L} cm`, 12, 14);
  const im = canvas.toDataURL('image/jpeg', .92), k = Math.min(180 / canvas.width, 110 / canvas.height); doc.addImage(im, 'JPEG', 12, 20, canvas.width * k, canvas.height * k);
  doc.setFontSize(10); let y = 24; const x2 = 200;
  doc.text(`Béton ${nfx(ptVol(P))} m³${P.vol ? ' (plan ' + nfx(P.vol) + ')' : ''} · Acier ${nfx(ptTotKg(P), 1)} kg${P.kg ? ' (plan ' + nfx(P.kg, 1) + ')' : ''}`, x2, y); y += 6;
  doc.text(`Enrobages ${P.cb}/${P.ch}/${P.cl} cm · Cadres : ${P.esp || '—'}`, x2, y, { maxWidth: 88 }); y += 12;
  for (const b of P.bars || []) { doc.text(`${b.pos}. ${b.n} HA${b.d} · ${ptTypeL[b.type] || b.type} · Lg ${b.lg} cm · ${nfx(ptKg(b), 1)} kg`, x2, y); y += 5.5; }
  // coupe
  const svg = ptCoupeSVG(P, (+P.L || 0) / 2).replace('currentColor', '#111'), url = URL.createObjectURL(new Blob([svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')], { type: 'image/svg+xml' }));
  try { const img = await loadImage(url), c = document.createElement('canvas'); c.width = img.width * 3; c.height = img.height * 3; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); doc.addImage(c.toDataURL('image/png'), 'PNG', x2, Math.max(y + 4, 120), 50, 50 * c.height / c.width); } catch (e) {} finally { URL.revokeObjectURL(url); }
  await sharePdf(doc, `${safeName(P.name || 'poutre')}_3D.pdf`);
}

// ---------- Liste + création ----------
async function ptNew(p) {
  const v = await menu('Nouvelle poutre 3D', [{ label: '📄 Lire un plan de ferraillage (PDF Arche / Graitec)', icon: 'pdf', value: 'pdf' }, { label: '✏️ Saisir à la main', icon: 'edit', value: 'man' }]);
  if (!v) return null;
  let P;
  if (v === 'pdf') {
    const [file] = await pickFiles({ accept: 'application/pdf', multiple: false }); if (!file) return null;
    const ld = loading('Lecture du plan…');
    try {
      const L = await ptScanPdf(file); let pg = L.length ? String(L[0].page) : '1';
      if (L.length > 1) { ld.close(); pg = await menu(`${L.length} poutres dans ce PDF`, [{ label: `⬇ Importer les ${L.length} poutres`, icon: 'layers', value: 'all' }, ...L.map(x => ({ label: `🧱 ${x.name} · ${x.sec} (p. ${x.page})`, value: String(x.page) }))]); if (!pg) return null; }
      const rec = await DB.put('files', { projectId: p.id, blob: file, mime: 'application/pdf', role: 'doc', name: file.name });
      if (pg === 'all') { const ld2 = loading('Lecture des poutres…'); let first = null;
        for (const [k, x] of L.entries()) { ld2.set(`Lecture des poutres… ${k + 1}/${L.length}`); const Q = await ptReadPdf(file, x.page); Q.pdfFileId = rec.id; Q.page = x.page; ptList(p).push(Q); first = first || Q; }
        ld2.close(); ld.close(); await DB.put('projects', p); toast(`${L.length} poutres importées ✓`); return first; }
      P = await ptReadPdf(file, +pg); P.pdfFileId = rec.id; P.page = +pg;
    } catch (e) { ld.close(); alertBox('Lecture impossible : ' + (e.message || e) + '\nVous pouvez saisir la poutre à la main.'); return null; }
    ld.close();
    if (!P.b || !P.h || !P.bars.length) { toast('Plan lu en partie : complétez les dimensions'); if (!await ptEditMain(P)) return null; }
    else toast(`${P.name || 'Poutre'} lue ✓ ${P.bars.length} positions · vérifiez puis corrigez si besoin`);
  } else {
    P = { id: DB.uid(), name: '', niv: '', b: 30, h: 60, L: 500, aL: 30, aR: 30, cb: 3, ch: 3, cl: 3, fck: 'C30', vol: 0, kg: 0, esp: '5 + 10x15 + 5x25 + 10x15 + 5', bars: [
      { pos: 1, n: 3, d: 14, lg: 0, type: 'droite', main: 0, leg: 0, side: 'g', face: 'inf', align: 'c' }, { pos: 2, n: 3, d: 12, lg: 0, type: 'droite', main: 0, leg: 0, side: 'g', face: 'sup', align: 'c' },
      { pos: 3, n: 26, d: 8, lg: 0, type: 'cadre', ca: 24, cb2: 54 }] };
    if (!await ptEditMain(P)) return null;
    const tot = P.L + P.aL + P.aR - 2 * P.cl; P.bars.forEach(b => { if (b.type === 'droite') { b.main = tot; b.lg = Math.round(tot); } if (b.type === 'cadre') { b.ca = P.b - 2 * P.cl; b.cb2 = P.h - P.cb - P.ch; b.lg = 2 * (b.ca + b.cb2) + 10; b.n = ptEspPos(P.esp).length || b.n; } });
  }
  ptList(p).push(P); await DB.put('projects', p); return P;
}
async function ptListPage(p) {
  p = await DB.get('projects', (p || App.project).id);
  const L = ptList(p);
  if (!L.length) { const P = await ptNew(p); if (P) return ptOpen(p, P); return; }
  const v = await menu('Poutres 3D', [...L.map(P => ({ label: `🧱 ${P.name || 'Poutre'}${P.niv ? ' · ' + P.niv : ''} · ${P.b}×${P.h} · ${(P.bars || []).length} pos.`, value: P.id })), { label: '＋ Nouvelle poutre (PDF ou saisie)', icon: 'plus', value: '__new' }]);
  if (!v) return;
  if (v === '__new') { const P = await ptNew(p); if (P) await ptOpen(p, P); return; }
  const P = L.find(x => x.id === v); if (P) await ptOpen(p, P);
}
