// ================= v1.0.47 — Avancement relié aux Plans, zones par joints, saisie intelligente, équipes & sous-traitants =================
// · Plans ↔ Avancement : les dossiers de niveau (2-RDC, 1-MEZZ…) et leurs plans par lot (Outils › Plans) alimentent l'avancement
//   tout seuls : chaque lot montre SON plan sur chaque niveau ; les pins du niveau sont partagés (recalés sur chaque plan).
// · Zones automatiques par les axes des joints (JD01…JD12) : secteurs autour d'un centre (stade) ou bandes (bâtiment).
// · Saisie : tableau rapide (locaux × lots), sélection de plusieurs pins sur le plan (doigt), saisie express (texte / WhatsApp).
// · Ordre partout : niveaux de bas en haut (SSL › RDC › MEZZ › R+1…), lots dans l'ordre des travaux.

// ---------- images réduites (miniatures, comparaison rapide) — cache par taille ----------
// v1.0.48 : une seule image décodée à la fois (un plan A0 = 12 Mpx en mémoire) ; les miniatures (≤ 400 px) sont gardées
// sur le téléphone (localStorage) → plus jamais recalculées à chaque ouverture d'un onglet de lot
const _avLite = new Map(); let _avLiteQ = Promise.resolve();
const avLiteQ = (fn) => { const r = _avLiteQ.then(fn, fn); _avLiteQ = r.catch(() => {}); return r; };
function avLiteURL(fileId, max) {
  const k = fileId + '|' + max; if (_avLite.has(k)) return _avLite.get(k);
  if (max <= 400) { try { const d = localStorage.getItem('th.' + k); if (d) { const pr0 = Promise.resolve(d); _avLite.set(k, pr0); return pr0; } } catch (e) {} }
  const pr = avLiteQ(async () => { const f = await DB.get('files', fileId); if (!f || !f.blob) return fileURL(fileId);
    if (max <= 400) { try { const bm = await createImageBitmap(f.blob, { resizeWidth: max, resizeQuality: 'medium' }), c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0); bm.close && bm.close();
      const d = c.toDataURL('image/jpeg', 0.72); c.width = c.height = 0; try { localStorage.setItem('th.' + k, d); } catch (e) {} return d; } catch (e) { /* ancien navigateur : chemin normal */ } }
    try { const bm = await createImageBitmap(f.blob), r = Math.min(1, max / Math.max(bm.width, bm.height)); if (r >= 1) { bm.close && bm.close(); return BlobURL.get(f.id, f.blob); }
      const c = document.createElement('canvas'); c.width = Math.round(bm.width * r); c.height = Math.round(bm.height * r); const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bm, 0, 0, c.width, c.height); bm.close && bm.close();
      const b = await new Promise(res => c.toBlob(res, 'image/jpeg', max <= 400 ? 0.8 : 0.9)); c.width = c.height = 0; return URL.createObjectURL(b); } catch (e) { return BlobURL.get(f.id, f.blob); } });
  _avLite.set(k, pr); if (_avLite.size > 60) _avLite.delete(_avLite.keys().next().value); return pr;
}

// ---------- ordre ----------
function avNivRank(name) {
  const s = String(name || '').toUpperCase().replace(/[\s_]+/g, '').replace(/^\d+-/, '');
  if (/FOND/.test(s)) return -20;
  if (/^(SS|SSL|SOUS-?SOL|S\/S|SB)/.test(s)) { const m = s.match(/\d+/); return -(m ? +m[0] : 1); }
  if (/RDC|REZ/.test(s)) return 0;
  if (/MEZZ/.test(s)) return 0.5;
  let m = s.match(/R\+(\d+)/); if (m) return +m[1];
  if (/TERR|TOIT|COMBLE/.test(s)) return 90;
  m = s.match(/^N?(-?\d+)$/); if (m) return +m[1];
  return 50;
}
const avNivKey = (n) => String(n || '').toUpperCase().replace(/[\s_]+/g, '').replace(/^\d+-/, '').replace(/^MEZZ\w*/, 'MEZZ').replace(/^R(\d+)$/, 'R+$1');
function avNivSorted(p, nivs) {
  const Z = typeof avZones === 'function' ? avZones(p) : [];
  return nivs.slice().sort((a, b) => (Z.indexOf(typeof avZoneOf === 'function' ? avZoneOf(p, a) : '') - Z.indexOf(typeof avZoneOf === 'function' ? avZoneOf(p, b) : '')) || (avNivRank(a.name) - avNivRank(b.name)) || String(a.name).localeCompare(String(b.name), 'fr', { numeric: true }));
}
const AV_WORK = [/gros|^g\.?o\.?$/, /terrass/, /ma[cç]on/, /cloison|placo|doublage/, /enduit/, /chape/, /[ée]tanch/, /local|technique/, /[ée]lec/, /plomb|sanit/, /cvc|clim|ventil|hvac/, /menuis|porte/, /faux|plafond/, /carrel|rev[eê]t/, /peint/, /nettoy/];
const avWorkIdx = (name) => { const n = String(name || '').toLowerCase(); const i = AV_WORK.findIndex(r => r.test(n)); return i < 0 ? 99 : i; };
function avLotsOrdered(p) { const L = avLots(p); return L.slice().sort((a, b) => (avWorkIdx(a.name) - avWorkIdx(b.name)) || (L.indexOf(a) - L.indexOf(b))); }

// ---------- lien Plans → Avancement ----------
// dossier de niveau (Plans) ↔ niveau d'avancement ; lot du plan ↔ lot d'avancement (même nom) ; un plan par lot et par niveau
const avLotOfPlanLot = (p, L) => L && avLots(p).find(x => normQ(x.name) === normQ(L.name) || x.fromPlans === L.id);
const avNivOfFolder = (p, f) => { const nn = typeof nivOfFolder === 'function' ? nivOfFolder(f.name) : ''; return (p.avNiveaux || []).find(n => n.folderId === f.id) || (nn ? (p.avNiveaux || []).find(n => !n.folderId && avNivKey(n.name) === avNivKey(nn)) : null); };
let _avSyncAt = 0;
async function avSyncFromPlans(p, force) {
  if (!p || (!force && Date.now() - _avSyncAt < 1500)) return false; _avSyncAt = Date.now();
  if (typeof planLots !== 'function' || typeof nivOfFolder !== 'function') return false;
  const [folders, plans] = await Promise.all([DB.byProject('folders', p.id), DB.byProject('plans', p.id)]);
  const cur = plans.filter(isCurrentPlan), PL = planLots(p), skip = new Set(p.avLotSkip || []); avLots(p); let ch = false;
  for (const f of folders) {
    const nn = nivOfFolder(f.name); if (!nn) continue;
    const ps = cur.filter(x => x.folderId === f.id).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); if (!ps.length) continue;
    const withLot = ps.filter(x => x.lotId && PL.some(l => l.id === x.lotId));
    let niv = avNivOfFolder(p, f);
    if (!niv) {
      if (!withLot.length) continue;   // un dossier de niveau sans plan de lot n'est pas créé tout seul
      const base = ps.find(x => !x.lotId) || withLot.find(x => x.lotId === 'go') || withLot[0];
      niv = { id: DB.uid(), name: avNivKey(nn) === 'MEZZ' ? 'MEZZ' : nn.toUpperCase(), serieId: planSerie(base), folderId: f.id, auto: 1 };
      p.avNiveaux = p.avNiveaux || []; p.avNiveaux.push(niv); ch = true;
    } else if (!niv.folderId) { niv.folderId = f.id; ch = true; }
    for (const pl of withLot) {
      const L = PL.find(x => x.id === pl.lotId); if (!L || skip.has(normQ(L.name))) continue;
      let al = avLotOfPlanLot(p, L);
      if (!al) { al = { id: DB.uid(), name: L.name, color: L.c || AV_LOT_COLORS[avLots(p).length % AV_LOT_COLORS.length], fromPlans: L.id }; p.lots.push(al); ch = true; }
      const sid = planSerie(pl); niv.lotPlan = niv.lotPlan || {};
      if (sid === niv.serieId) { if (niv.lotPlan[al.id]) { delete niv.lotPlan[al.id]; ch = true; } continue; }
      niv.plans = niv.plans || []; let e = niv.plans.find(x => x.serieId === sid);
      if (!e) { e = { id: DB.uid(), serieId: sid, kind: 'lot', label: L.name, auto: 1 }; niv.plans.push(e); ch = true; }
      if (!niv.lotPlan[al.id]) { niv.lotPlan[al.id] = e.id; ch = true; }
    }
  }
  if (ch) await DB.put('projects', p);
  return ch;
}
// ajouter le plan d'un lot à un niveau (choisir parmi les plans du projet ou importer) — rangé aussi dans le dossier du niveau
async function avAddLotPlan(p, niv, lotId) {
  const lot = avLot(p, lotId), pl = await avPickOrImportPlan(p, `Plan ${lot.name} · ${niv.name}`); if (!pl) return false;
  const sid = planSerie(pl);
  if (sid === niv.serieId) { toast('C\'est déjà le plan général du niveau'); return false; }
  niv.plans = niv.plans || []; let e = niv.plans.find(x => x.serieId === sid);
  if (!e) { e = { id: DB.uid(), serieId: sid, kind: 'lot', label: lot.name }; niv.plans.push(e); }
  niv.lotPlan = niv.lotPlan || {}; niv.lotPlan[lot.id] = e.id;
  // rangement dans Plans : dossier du niveau + lot du plan (le lien marche dans les deux sens)
  try { if (niv.folderId && !pl.folderId) pl.folderId = niv.folderId; const PLx = typeof planLots === 'function' ? planLots(p).find(l => normQ(l.name) === normQ(lot.name)) : null; if (PLx && !pl.lotId) pl.lotId = PLx.id; await DB.put('plans', pl); } catch (e2) {}
  await DB.put('projects', p); toast(`Plan ${lot.name} ajouté à ${niv.name} ✓`); return true;
}

// ---------- comparer (bouton ⇄) ----------
async function avCompareQuick(p, niv, lotId) {
  const L = await avNivPlans(p, niv);
  if (L.length < 2) { toast('Un seul plan sur ce niveau : ajoutez le plan à comparer'); if (await avAddLotPlan(p, niv, lotId)) return avCompareQuick(p, niv, lotId); return; }
  const lot = avLot(p, lotId), lp = await avLotPlan(p, niv, lotId), main = L[0];
  const others = (p.avNiveaux || []).filter(n => n.id !== niv.id);
  const v = await menu(`⇄ Comparer — ${niv.name}`, [
    ...(lp && lp.id !== 'main' ? [{ label: `${main.label} ↔ ${lot.name}`, icon: 'swap', value: 'lot' }] : []),
    { label: 'Deux lots de ce niveau…', icon: 'layers', value: 'lots' },
    { label: 'Choisir deux plans du niveau…', icon: 'plans', value: 'two' },
    ...(others.length ? [{ label: 'Avec un autre niveau…', icon: 'swap', value: 'niv' }] : []),
    { label: 'Ajouter un plan à ce niveau', icon: 'plus', value: 'add' }]);
  if (v === 'lot') return avComparePlans(p, niv, { ...main, label: main.label }, { ...lp, label: lot.name });
  if (v === 'lots') return avCompareLots(p, niv);
  if (v === 'two') return avComparePlans(p, niv);
  if (v === 'add') { if (await avAddLotPlan(p, niv, lotId)) return avCompareQuick(p, niv, lotId); return; }
  if (v === 'niv') { const nid = await menu('Comparer avec le niveau', avNivSorted(p, others).map(n => ({ label: n.name, icon: 'plans', value: n.id }))); const o = others.find(n => n.id === nid); if (!o) return;
    const [A, B] = await Promise.all([avLotPlan(p, niv, lotId), avLotPlan(p, o, lotId)]); if (!A || !B) return toast('Plan introuvable');
    return avComparePlans(p, niv, { ...A, label: `${niv.name} · ${A.label}` }, { ...B, id: 'x' + B.id, label: `${o.name} · ${B.label}` }); }
}
// comparer deux plans quelconques du projet (Outils › Plans)
async function avCompareAnyPlans(p, folderId) {
  const [plans, folders] = await Promise.all([DB.byProject('plans', p.id), DB.byProject('folders', p.id)]);
  const cur = plans.filter(isCurrentPlan), fn = (pl) => (folders.find(f => f.id === pl.folderId) || {}).name || 'Sans dossier';
  const lots = typeof planLots === 'function' ? planLots(p) : [], ln = (pl) => (lots.find(l => l.id === pl.lotId) || {}).name || '';
  const sorted = cur.slice().sort((a, b) => ((b.folderId === folderId) - (a.folderId === folderId)) || fn(a).localeCompare(fn(b), 'fr', { numeric: true }) || avNameSort(a, b));
  if (sorted.length < 2) { toast('Il faut au moins deux plans : ajoutez un plan'); return; }
  const pick = async (t, ex) => { const id = await menu(t, sorted.filter(x => x.id !== ex).map(x => ({ label: `${fn(x)} · ${ln(x) ? ln(x) + ' · ' : ''}${x.name} · ind. ${planIndice(x)}`, icon: 'plans', value: x.id }))); return sorted.find(x => x.id === id); };
  const A = await pick('⇄ Plan de base', null); if (!A) return; const B = await pick('Comparer avec', A.id); if (!B) return;
  p.cmpHold = p.cmpHold || { name: 'Plans', cal: {} };
  return avComparePlans(p, p.cmpHold, { id: 'a', serieId: planSerie(A), plan: A, label: ln(A) || A.name }, { id: 'b', serieId: planSerie(B), plan: B, label: ln(B) || B.name });
}

// ---------- zones automatiques par les joints (JD01…) ----------
function avJointsOf(T) {
  const J = {};
  for (const t of T || []) { const m = String(t.s).toUpperCase().replace(/\s+/g, '').match(/^(?:JD|JOINT|J\.D\.?)[-_.]?(\d{1,3})$/); if (!m) continue;
    const k = 'JD' + String(+m[1]).padStart(2, '0'); (J[k] = J[k] || []).push([t.x + t.w / 2, t.y - t.h / 2]); }
  return Object.entries(J).map(([k, P]) => ({ k, n: +k.slice(2), P })).sort((a, b) => a.n - b.n);
}
// centre : intersection (moindres carrés) des lignes des joints repérés deux fois ; sinon centre des repères
function avJointsCenter(J, W, H) {
  const lines = J.filter(j => j.P.length >= 2).map(j => { let a = j.P[0], b = j.P[1], d = 0; for (const q of j.P) for (const r of j.P) { const e = Math.hypot(q[0] - r[0], q[1] - r[1]); if (e > d) { d = e; a = q; b = r; } } return d > Math.max(W, H) * 0.03 ? { a, u: [(b[0] - a[0]) / d, (b[1] - a[1]) / d] } : null; }).filter(Boolean);
  if (lines.length >= 2) { let A11 = 0, A12 = 0, A22 = 0, b1 = 0, b2 = 0;
    for (const { a, u } of lines) { const n = [-u[1], u[0]], c = n[0] * a[0] + n[1] * a[1]; A11 += n[0] * n[0]; A12 += n[0] * n[1]; A22 += n[1] * n[1]; b1 += n[0] * c; b2 += n[1] * c; }
    const det = A11 * A22 - A12 * A12; if (Math.abs(det) > 1e-6) { const x = (A22 * b1 - A12 * b2) / det, y = (A11 * b2 - A12 * b1) / det; if (x > -W && x < 2 * W && y > -H && y < 2 * H) return [x, y]; } }
  const all = J.flatMap(j => j.P); return all.length ? [all.reduce((s, q) => s + q[0], 0) / all.length, all.reduce((s, q) => s + q[1], 0) / all.length] : [W / 2, H / 2];
}
function avZoneName(fmt, i, a, b) { return fmt === 'joint' ? `Joint ${i}` : fmt === 'jd' ? `${a} → ${b}` : `Zone ${i}`; }
// secteurs autour du centre : un par intervalle entre deux joints consécutifs (en tournant)
function avRadialZones(J, C, W, H, fmt, start) {
  const ang = J.map(j => { const m = [j.P.reduce((s, q) => s + q[0], 0) / j.P.length, j.P.reduce((s, q) => s + q[1], 0) / j.P.length]; return { ...j, a: Math.atan2(m[1] - C[1], m[0] - C[0]), r: Math.hypot(m[0] - C[0], m[1] - C[1]) }; }).sort((x, y) => x.a - y.a);
  if (ang.length < 2) return [];
  const gaps = ang.map((j, i) => { const nx = ang[(i + 1) % ang.length]; let g = nx.a - j.a; if (g <= 0) g += Math.PI * 2; return g; });
  const big = Math.max(...gaps), cyc = big < Math.PI * 0.9, R = Math.hypot(W, H) * 1.5, out = [];
  // départ : le joint au plus petit numéro (JD01) ; on tourne dans le sens des numéros
  let i0 = ang.findIndex(j => j.n === Math.min(...ang.map(x => x.n)));
  const dir = (() => { const n0 = ang[i0].n, nn = ang.filter(j => j.n > n0).sort((a, b) => a.n - b.n)[0]; if (!nn) return 1; const nx = ang[(i0 + 1) % ang.length], pv = ang[(i0 - 1 + ang.length) % ang.length];
    if (nx === nn) return 1; if (pv === nn) return -1; const d = (j) => { let g = j.a - ang[i0].a; while (g < 0) g += Math.PI * 2; return g; }; return d(nn) <= Math.PI ? 1 : -1; })();
  const N = cyc ? ang.length : ang.length - 1; if (!cyc) i0 = dir > 0 ? (gaps.indexOf(big) + 1) % ang.length : gaps.indexOf(big);
  for (let k = 0; k < N; k++) {
    const a = ang[(i0 + dir * k + ang.length * 4) % ang.length], b = ang[(i0 + dir * (k + 1) + ang.length * 4) % ang.length];
    let a0 = dir > 0 ? a.a : b.a, a1 = dir > 0 ? b.a : a.a; if (a1 <= a0) a1 += Math.PI * 2;
    const pts = [[Math.round(C[0]), Math.round(C[1])]]; for (let s = 0; s <= 16; s++) { const t = a0 + (a1 - a0) * s / 16; pts.push([Math.round(C[0] + R * Math.cos(t)), Math.round(C[1] + R * Math.sin(t))]); }
    const am = (a0 + a1) / 2, rl = (a.r + b.r) / 2 || Math.min(W, H) / 3;
    out.push({ zone: avZoneName(fmt, start + k, a.k, b.k), pts, lp: [Math.round(C[0] + rl * Math.cos(am)), Math.round(C[1] + rl * Math.sin(am))], auto: 1 });
  }
  return out;
}
// bandes parallèles (bâtiment) : les joints coupent le plan en tranches, de part et d'autre
function avStripZones(J, W, H, fmt, start) {
  const dirs = J.filter(j => j.P.length >= 2).map(j => { const [a, b] = j.P; return Math.abs(b[0] - a[0]) < Math.abs(b[1] - a[1]) ? 'v' : 'h'; });
  const vert = dirs.length ? dirs.filter(d => d === 'v').length >= dirs.length / 2 : (Math.max(...J.map(j => j.P[0][0])) - Math.min(...J.map(j => j.P[0][0]))) >= (Math.max(...J.map(j => j.P[0][1])) - Math.min(...J.map(j => j.P[0][1])));
  const pos = J.map(j => ({ ...j, s: j.P.reduce((s, q) => s + q[vert ? 0 : 1], 0) / j.P.length })).sort((a, b) => a.s - b.s);
  const cuts = [-W * 0.5, ...pos.map(j => j.s), (vert ? W : H) * 1.5], names = ['début', ...pos.map(j => j.k), 'fin'], out = [];
  for (let i = 0; i < cuts.length - 1; i++) { const a = cuts[i], b = cuts[i + 1], m = (Math.max(a, 0) + Math.min(b, vert ? W : H)) / 2;
    const pts = vert ? [[a, -H * 0.5], [b, -H * 0.5], [b, H * 1.5], [a, H * 1.5]] : [[-W * 0.5, a], [W * 1.5, a], [W * 1.5, b], [-W * 0.5, b]];
    out.push({ zone: avZoneName(fmt, start + i, names[i], names[i + 1]), pts: pts.map(q => q.map(Math.round)), lp: vert ? [Math.round(m), Math.round(H * 0.08)] : [Math.round(W * 0.08), Math.round(m)], auto: 1 }); }
  return out;
}
async function avAutoZones(p, niv, plan, V) {
  const ld = loading('Lecture des joints (JD) du plan…'); let T = null;
  try { T = await planTexts(plan); } catch (e) { console.warn(e); } finally { ld.close(); }
  let J = avJointsOf(T);
  const spread = J.length >= 3 ? (() => { const C = avJointsCenter(J, plan.w, plan.h), A = J.map(j => Math.atan2(j.P[0][1] - C[1], j.P[0][0] - C[0])).sort((a, b) => a - b); return A[A.length - 1] - A[0]; })() : 0;
  const r = await formSheet('✨ Zones automatiques par les joints', [
    { name: 'info', type: 'info', label: J.length ? `${J.length} joint(s) lu(s) sur le plan` : 'Aucun repère JD lisible sur ce plan', value: J.length ? J.map(j => j.k).join(' · ') : 'Vous pouvez toucher les joints vous-même sur le plan (centre puis un point par joint).' },
    { name: 'mode', label: 'Découpage', type: 'select', value: spread > Math.PI * 0.6 ? 'radial' : 'strip', options: [{ value: 'radial', label: '◔ Secteurs autour d\'un centre (stade, bâtiment rond)' }, { value: 'strip', label: '▥ Bandes parallèles (bâtiment)' }] },
    { name: 'src', label: 'Joints', type: 'select', value: J.length >= 2 ? 'pdf' : 'tap', options: [...(J.length >= 2 ? [{ value: 'pdf', label: 'Repères JD lus sur le plan' }] : []), { value: 'tap', label: 'Je touche les joints sur le plan' }] },
    { name: 'fmt', label: 'Nom des zones', type: 'select', value: 'zone', options: [{ value: 'zone', label: 'Zone 1, Zone 2…' }, { value: 'joint', label: 'Joint 1, Joint 2…' }, { value: 'jd', label: 'JD01 → JD02…' }] },
    { name: 'start', label: 'Numéro de la première zone', type: 'number', value: 1 },
  ], { okLabel: 'Aperçu' });
  if (!r) return;
  const st = V.st, start = Math.max(1, +r.start || 1);
  let C = null;
  const bar = document.createElement('div'); bar.className = 'avz-bar'; V.el.appendChild(bar);
  const end = () => { st.zprev = null; st.zpick = null; st.zhint = ''; bar.remove(); V.redraw(); };
  const build = () => { st.zprev = { polys: r.mode === 'radial' ? avRadialZones(J, C || (C = avJointsCenter(J, plan.w, plan.h)), plan.w, plan.h, r.fmt, start) : avStripZones(J, plan.w, plan.h, r.fmt, start) };
    st.zhint = `Aperçu : ${st.zprev.polys.length} zone(s)${r.mode === 'radial' ? ' · « Centre » pour le déplacer' : ''}`; V.redraw(); drawBar(); };
  const drawBar = () => {
    bar.innerHTML = `<button data-z="x">${icon('close')} Annuler</button>${r.mode === 'radial' && st.zprev ? `<button data-z="c">${icon('move')} Centre</button>` : ''}${r.src === 'tap' && !st.zprev ? '' : `<button data-z="ok" class="pri" ${st.zprev && st.zprev.polys.length ? '' : 'disabled'}>${icon('check')} Valider</button>`}${r.src === 'tap' && !st.zprev ? `<button data-z="fin" class="pri" ${J.length >= 2 ? '' : 'disabled'}>${icon('check')} Aperçu (${J.length})</button>` : ''}`;
    $('[data-z=x]', bar).onclick = end;
    const cb = $('[data-z=c]', bar); if (cb) cb.onclick = () => { st.zhint = 'Touchez le nouveau centre'; V.redraw(); st.zpick = ([x, y]) => { C = [x, y]; st.zpick = null; build(); }; };
    const fb = $('[data-z=fin]', bar); if (fb) fb.onclick = () => { st.zpick = null; build(); };
    const ok = $('[data-z=ok]', bar); if (ok) ok.onclick = () => validate();
  };
  if (r.src === 'tap') {
    J = []; C = null; let n = 0;
    st.zhint = r.mode === 'radial' ? 'Touchez le CENTRE (milieu du terrain / du rond)' : 'Touchez un point sur le joint 1 (2 points par joint)';
    let half = null;
    st.zpick = ([x, y]) => {
      if (r.mode === 'radial' && !C) { C = [x, y]; st.zhint = 'Touchez maintenant un point sur chaque joint, dans l\'ordre (JD01, JD02…)'; V.redraw(); return; }
      if (r.mode === 'strip') { if (!half) { half = [x, y]; st.zhint = `Joint ${n + 1} : touchez un 2e point`; V.redraw(); return; } n++; J.push({ k: 'JD' + String(n).padStart(2, '0'), n, P: [half, [x, y]] }); half = null; }
      else { n++; J.push({ k: 'JD' + String(n).padStart(2, '0'), n, P: [[x, y]] }); }
      st.zhint = `${J.length} joint(s) touché(s) — continuez, puis « Aperçu »`; st.zprev = null; V.redraw(); drawBar();
      // petits repères des joints touchés
      st.zprev = { polys: J.flatMap(j => j.P.map(q => ({ zone: j.k, pts: [[q[0] - 6, q[1] - 6], [q[0] + 6, q[1] - 6], [q[0] + 6, q[1] + 6], [q[0] - 6, q[1] + 6]], lp: [q[0], q[1] - 14] }))) }; V.redraw(); st.zprev = null;
    };
    V.redraw(); drawBar(); return;
  }
  if (J.length < 2) { end(); return alertBox('Il faut au moins 2 joints.'); }
  build();
  async function validate() {
    const polys = st.zprev.polys;
    const Z = avZones(p), sect = avSecteurs(p).length ? await menu('Secteur de ces zones (Nord, Ouest…) ?', [{ label: '— Aucun secteur', value: '__none' }, ...avSecteurs(p).map(s => ({ label: s, icon: 'layers', value: s })), { label: '➕ Nouveau secteur…', value: '__new' }]) : '__none';
    if (sect == null) return;
    let sc = sect; if (sc === '__new') { const x = await formSheet('Nouveau secteur', [{ name: 'n', label: 'Nom', list: ['Nord', 'Sud', 'Est', 'Ouest', 'Nord-Ouest', 'Nord-Est', 'Sud-Ouest', 'Sud-Est'] }], { okLabel: 'Créer' }); sc = x && x.n ? x.n.trim() : '__none'; if (sc !== '__none' && !avSecteurs(p).includes(sc)) avSecteurs(p).push(sc); }
    const replace = (niv.zonePolys || []).length ? await confirmBox(`Ce niveau a déjà ${niv.zonePolys.length} zone(s) dessinée(s). Les remplacer ?`, 'Remplacer') : true;
    niv.zonePolys = replace ? [] : (niv.zonePolys || []);
    for (const z of polys) { niv.zonePolys.push({ zone: z.zone, pts: z.pts, lp: z.lp, auto: 1 }); if (!Z.includes(z.zone)) Z.push(z.zone); if (sc !== '__none') { p.avZoneSect = p.avZoneSect || {}; p.avZoneSect[z.zone] = sc; } }
    // la zone « Zone 1 » par défaut, vide, disparaît
    await DB.put('projects', p); const n = await avAssignZones(p, niv); end(); await V.refresh();
    toast(`${polys.length} zone(s) créée(s) · ${n} pin(s) rattaché(s) ✓`);
    const others = (p.avNiveaux || []).filter(o => o.id !== niv.id);
    if (others.length && await confirmBox(`Recopier ces ${polys.length} zones sur les ${others.length} autre(s) niveau(x) ? (calage automatique d'un plan à l'autre)`, 'Recopier')) {
      const ld2 = loading('Recopie des zones…'); let k = 0;
      try { for (const o of others) { const op = await latestPlanOfSerie(p.id, o.serieId); if (!op) continue;
        let m = null; try { m = (await avPairMatrix(p, o, { serieId: o.serieId, plan: op }, { serieId: niv.serieId, plan })).m; } catch (e) { m = avMat({ sx: op.w / plan.w, sy: op.h / plan.h, ox: 0, oy: 0 }); }
        o.zonePolys = (o.zonePolys || []).filter(q => !polys.some(z => z.zone === q.zone));
        for (const z of polys) o.zonePolys.push({ zone: z.zone, pts: z.pts.map(q => avApply(m, q[0], q[1]).map(Math.round)), lp: avApply(m, z.lp[0], z.lp[1]).map(Math.round), auto: 1 });
        await avAssignZones(p, o); k++; } await DB.put('projects', p); } finally { ld2.close(); }
      toast(`Zones recopiées sur ${k} niveau(x) ✓`);
    }
  }
}
// zones dessinées : renommer, fusionner, secteur, effacer
async function avZonesManage(p, niv) {
  for (;;) {
    const names = [...new Set((niv.zonePolys || []).map(z => z.zone))]; if (!names.length) return;
    const v = await menu(`${niv.name} — zones dessinées`, names.map(z => ({ label: `${avSectOf(p, z) ? avSectOf(p, z) + ' · ' : ''}${z}`, icon: 'layers', value: z }))); if (!v) return;
    const a = await menu(v, [{ label: 'Renommer (tous les niveaux)', icon: 'edit', value: 'ren' }, ...(names.length > 1 ? [{ label: 'Fusionner avec une autre zone…', icon: 'layers', value: 'mer' }] : []), { label: `Secteur : ${avSectOf(p, v) || '—'}`, icon: 'layers', value: 'sec' }, { label: 'Effacer le dessin sur ce niveau', icon: 'trash', danger: true, value: 'del' }]);
    const renameAll = async (from, to) => { for (const n of p.avNiveaux || []) { (n.zonePolys || []).forEach(z => { if (z.zone === from) z.zone = to; }); if (n.zone === from) n.zone = to; }
      const Z = avZones(p); if (!Z.includes(to)) Z[Z.indexOf(from)] = to; p.avZones = [...new Set(avZones(p).filter(z => z !== from || z === to))];
      if (p.avZoneSect && p.avZoneSect[from] && !p.avZoneSect[to]) p.avZoneSect[to] = p.avZoneSect[from]; if (p.avZoneSect) delete p.avZoneSect[from];
      for (const l of (await DB.byProject('links', p.id)).filter(l => l.kind === 'local' && l.zone === from)) { l.zone = to; await DB.put('links', l); } };
    if (a === 'ren') { const r = await formSheet('Renommer la zone', [{ name: 'n', label: 'Nom', value: v }]); if (r && r.n && r.n.trim() !== v) await renameAll(v, r.n.trim()); }
    if (a === 'mer') { const t = await menu(`Fusionner « ${v} » dans…`, names.filter(z => z !== v).map(z => ({ label: z, value: z }))); if (t) { await renameAll(v, t); toast(`« ${v} » fusionnée dans « ${t} » ✓`); } }
    if (a === 'sec') { const s = await menu('Secteur', [{ label: '— Aucun', value: '__none' }, ...avSecteurs(p).map(x => ({ label: x, value: x, checked: avSectOf(p, v) === x }))]); if (s) { p.avZoneSect = p.avZoneSect || {}; p.avZoneSect[v] = s === '__none' ? '' : s; } }
    if (a === 'del' && await confirmBox(`Effacer le dessin de « ${v} » sur ${niv.name} ? (les pins gardent leur zone)`)) niv.zonePolys = niv.zonePolys.filter(z => z.zone !== v);
    await DB.put('projects', p); await avAssignZones(p, niv);
  }
}

// ---------- une saisie (journal) : commune au formulaire, au tableau rapide, à la sélection et à la saisie express ----------
async function avOpenReserves(p) { try { return (await DB.byProject('tasks', p.id)).filter(t => t.localId && typeof isLifted === 'function' && !isLifted(t)); } catch (e) { return []; } }
function avEntryOn(p, loc, o) {
  const e = { id: DB.uid(), d: o.d || todayISO(), t: Date.now() + (o.k || 0), lot: o.lot, eq: o.eq || '', pct: Math.max(0, Math.min(100, +o.pct || 0)), eff: +o.eff || 0, qty: o.qty || '', note: o.note || '', photos: [], src: o.src || '', by: Team.ready() ? ((Team.me() || {}).name || '') : '', ...(o.g ? { g: o.g } : {}) };
  e.prev = avPctAt(loc, e.lot, avAddDays(e.d, -1));
  loc.journal = [...(loc.journal || []), e]; avApplyEntry(loc, e);
  return e;
}
// lots que l'utilisateur peut saisir (chef d'équipe : seulement les lots de son équipe)
function avMyLots(p) {
  try { if (!Team.ready() || Team.isAdmin()) return null; const me = normQ((Team.me() || {}).name || ''); if (!me) return null;
    const L = avTeams(p).filter(t => t.lot && (normQ(t.resp || '') === me || normQ(t.name) === me)).map(t => t.lot); return L.length ? new Set(L) : null; } catch (e) { return null; }
}
// 100 % alors qu'une réserve est ouverte sur le local → confirmation
async function avCheckReserves(p, pairs) {
  const R = await avOpenReserves(p); if (!R.length) return pairs;
  const bad = pairs.filter(x => +x.pct >= 100 && R.some(t => t.localId === x.loc.id)); if (!bad.length) return pairs;
  const force = await confirmBox(`⚠ ${bad.length} local(aux) ont une réserve ouverte : ${[...new Set(bad.map(x => x.loc.name))].slice(0, 6).join(', ')}.\nLes mettre quand même à 100 % ?`, 'Forcer 100 %');
  return force ? pairs : pairs.filter(x => !bad.includes(x));
}

// ---------- sélection de plusieurs pins sur le plan (toucher ou entourer au doigt) ----------
function avSelBar(el, p, niv, st, ctx) {
  const lg = $('.av-legend', el), n = st.sel.size, hint = $('.av-hint', el);
  lg.innerHTML = `<span class="avs-n"><b>${n}</b> pin(s)</span><button data-s="lasso" class="${st.lasso ? 'on' : ''}">✏️ Entourer</button><button data-s="all">Tout</button>${n ? '<button data-s="none">Aucun</button>' : ''}<button data-s="go" class="avs-go" ${n ? '' : 'disabled'}>Appliquer…</button>`;
  hint.textContent = st.lasso ? 'Dessinez autour des pins avec le doigt' : 'Touchez les pins à sélectionner, ou « Entourer »'; hint.style.display = '';
  const view = $('.av-view', el);
  let ov = $('.av-lasso', el);
  if (st.lasso && !ov) {
    ov = document.createElement('div'); ov.className = 'av-lasso'; ov.innerHTML = '<svg><polyline/></svg>'; view.appendChild(ov);
    const pl = $('polyline', ov), pts = []; let on = false;
    const pos = (e) => { const r = view.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    ov.addEventListener('pointerdown', (e) => { e.stopPropagation(); on = true; pts.length = 0; pts.push(pos(e)); try { ov.setPointerCapture(e.pointerId); } catch (x) {} });
    ov.addEventListener('pointermove', (e) => { if (!on) return; e.stopPropagation(); pts.push(pos(e)); pl.setAttribute('points', pts.map(q => q.join(',')).join(' ')); });
    ov.addEventListener('pointerup', (e) => { if (!on) return; e.stopPropagation(); on = false;
      if (pts.length > 4) { const s = ctx.pz.st, P = pts.map(([x, y]) => [(x - s.tx) / s.s, (y - s.ty) / s.s]); let k = 0;
        for (const l of st.locs) { const [vx, vy] = ctx.T(l.x, l.y); if (avInPoly(vx, vy, P)) { st.sel.add(l.id); k++; } } toast(`${k} pin(s) ajouté(s) à la sélection`); }
      st.lasso = false; ov.remove(); ctx.redraw(); });
  }
  if (!st.lasso && ov) ov.remove();
  $('[data-s=lasso]', lg).onclick = () => { st.lasso = !st.lasso; ctx.redraw(); };
  $('[data-s=all]', lg).onclick = () => { st.locs.forEach(l => st.sel.add(l.id)); ctx.redraw(); };
  const nb = $('[data-s=none]', lg); if (nb) nb.onclick = () => { st.sel.clear(); ctx.redraw(); };
  $('[data-s=go]', lg).onclick = async () => { const L = st.locs.filter(l => st.sel.has(l.id)); if (!L.length) return; if (await avBulkJour(p, L, st.lot)) { st.sel = null; st.lasso = false; const o = $('.av-lasso', el); if (o) o.remove(); await ctx.refresh(); } };
}
async function avBulkJour(p, L, lotId) {
  const lots = avLotsOrdered(p), teams = avTeams(p), my = avMyLots(p);
  const r = await formSheet(`📅 ${L.length} pin(s) — saisie groupée`, [
    { name: 'info', type: 'info', label: 'Pins', value: L.slice(0, 12).map(l => l.name).join(', ') + (L.length > 12 ? ` … +${L.length - 12}` : '') },
    { name: 'd', label: 'Date', type: 'date', value: todayISO() },
    { name: 'lot', label: 'Lot', type: 'select', value: my && !my.has(lotId) ? [...my][0] : lotId, options: lots.filter(l => !my || my.has(l.id)).map(l => ({ value: l.id, label: l.name })) },
    { name: 'mode', label: 'Avancement', type: 'select', value: 'set', options: [{ value: 'set', label: 'Mettre tous les pins à…' }, { value: 'add', label: 'Ajouter à chacun…' }] },
    { name: 'pct', label: '%', type: 'select', value: '100', options: Array.from({ length: 20 }, (_, i) => String((i + 1) * 5)).map(v => ({ value: v, label: v + ' %' })) },
    { name: 'eq', label: 'Équipe / sous-traitant', type: 'select', value: '', options: [{ value: '', label: '—' }, ...teams.map(t => ({ value: t.id, label: `${t.name}${t.type === 'st' ? ' (sous-traitant)' : t.type === 'tach' ? ' (tâcheron)' : ''}` }))] },
    { name: 'eff', label: 'Effectif de la journée (personnes)', type: 'number', value: '' },
    { name: 'note', label: 'Note', value: '', placeholder: 'Ce qui a été fait…' },
  ], { okLabel: 'Enregistrer' });
  if (!r) return false;
  let pairs = L.map(loc => { const cur = avPctAt(loc, r.lot, r.d || todayISO()); return { loc, pct: r.mode === 'add' ? Math.min(100, cur + (+r.pct || 0)) : +r.pct || 0 }; });
  pairs = await avCheckReserves(p, pairs); if (!pairs.length) return false;
  const g = DB.uid(); let k = 0;
  for (const x of pairs) { const fresh = await DB.get('links', x.loc.id) || x.loc; avEntryOn(p, fresh, { d: r.d, lot: r.lot, pct: x.pct, eq: r.eq, eff: k === 0 ? r.eff : 0, note: r.note, g, k, src: 'sel' }); await DB.put('links', fresh); k++; }
  await DB.put('projects', p);
  toast(`✓ ${k} pin(s) · ${avLot(p, r.lot).name}`, { action: '📷 Photos', ms: 5000, onAction: async () => { const fs = await addPhotos(p.id, { local: pairs[0].loc.id, lot: r.lot, source: `${avLot(p, r.lot).name} · ${fmtDate(r.d)}` }); if (fs.length) { const l0 = await DB.get('links', pairs[0].loc.id); const e = (l0.journal || []).find(z => z.g === g); if (e) { e.photos.push(...fs.map(f => f.id)); await DB.put('links', l0); toast('Photos ajoutées ✓'); } } } });
  return true;
}

// ---------- tableau rapide : locaux × lots ----------
async function openAvTable(p, o = {}) {
  p = p || App.project; avLots(p);
  const { locaux, nivs: N0 } = await avData(p), nivs = avNivSorted(p, N0);
  if (!nivs.length) return toast('Ajoutez d\'abord un niveau dans Avancement');
  const lots = avLotsOrdered(p), my = avMyLots(p);
  const S = { niv: o.nivId && nivs.some(n => n.id === o.nivId) ? o.nivId : nivs[0].id, zone: o.zone || '', d: todayISO(), eq: '', eff: '', ch: new Map(), focus: o.lotId || '' };
  const el = document.createElement('div'); el.className = 'fullpage avt-page'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove()); const close = () => { unBack(); el.remove(); o.onClose && o.onClose(); };
  const STEPS = [0, 25, 50, 75, 100];
  const locsOf = () => { const n = nivs.find(x => x.id === S.niv); return locaux.filter(l => l.nivId === S.niv && (!S.zone || avPinZone(p, l, n) === S.zone)).sort(avNameSort); };
  const cur = (l, lot) => S.ch.has(l.id + '|' + lot.id) ? S.ch.get(l.id + '|' + lot.id) : avPctAt(l, lot.id, S.d);
  const col = (v) => v >= 100 ? '#22c55e' : v > 0 ? '#3b82f6' : 'transparent';
  function draw() {
    const n = nivs.find(x => x.id === S.niv), L = locsOf(), Z = [...new Set(locaux.filter(l => l.nivId === S.niv).map(l => avPinZone(p, l, n)))];
    const LC = S.focus ? [lots.find(l => l.id === S.focus), ...lots.filter(l => l.id !== S.focus)].filter(Boolean) : lots;
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title" style="flex:1"><b>Tableau rapide</b><span>${esc(p.name)}</span></div><button class="iconbtn" data-a="exp" title="Saisie express">${icon('edit')}</button></div>
      <div class="avt-ctl">
        <select data-k="niv">${nivs.map(x => `<option value="${x.id}" ${x.id === S.niv ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        ${Z.length > 1 ? `<select data-k="zone"><option value="">Toutes zones</option>${Z.map(z => `<option ${z === S.zone ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select>` : ''}
        <input type="date" data-k="d" value="${S.d}">
        <select data-k="eq"><option value="">Équipe…</option>${avTeams(p).map(t => `<option value="${t.id}" ${t.id === S.eq ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
        <input type="number" data-k="eff" placeholder="Effectif" value="${esc(S.eff)}" min="0">
      </div>
      <div class="avt-wrap">${L.length ? `<table class="avt"><thead><tr><th class="avt-c0">${L.length} pin(s)</th>${LC.map(l => `<th data-col="${l.id}" style="--c:${l.color}" class="${my && !my.has(l.id) ? 'ro' : ''}">${esc(l.name)}</th>`).join('')}</tr></thead>
        <tbody>${L.map(l => `<tr><th data-row="${l.id}" class="avt-c0"><b>${esc(l.name)}</b>${l.anep ? `<small>${esc(l.anep)}</small>` : ''}</th>${LC.map(lot => { const v = cur(l, lot), ch = S.ch.has(l.id + '|' + lot.id);
          return `<td data-c="${l.id}|${lot.id}" class="${ch ? 'ch' : ''} ${my && !my.has(lot.id) ? 'ro' : ''}" style="--v:${v}%;--k:${col(v)}"><b>${v}</b></td>`; }).join('')}</tr>`).join('')}</tbody></table>`
        : '<div class="empty">Aucun pin sur ce niveau.<br>Placez les locaux sur le plan (Avancement › niveau › + Pin) ou importez-les du PDF.</div>'}</div>
      <div class="avt-foot"><span><b>${S.ch.size}</b> modification(s)</span><small>Toucher : 0 › 25 › 50 › 75 › 100 · appui long : valeur, historique</small><button class="btn" data-a="save" ${S.ch.size ? '' : 'disabled'}>${icon('check')} Enregistrer</button></div>`;
    $('[data-a=x]', el).onclick = async () => { if (S.ch.size && !await confirmBox(`${S.ch.size} modification(s) non enregistrée(s). Quitter ?`, 'Quitter')) return; close(); };
    $('[data-a=exp]', el).onclick = () => avExpress(p, () => { close(); openAvTable(p, { ...o, nivId: S.niv }); });
    $$('[data-k]', el).forEach(i => i.onchange = async () => { const k = i.dataset.k;
      if ((k === 'niv' || k === 'd') && S.ch.size && !await confirmBox('Changer de niveau / de date annule les modifications non enregistrées.', 'Continuer')) return draw();
      S[k] = i.value; if (k === 'niv') { S.zone = ''; S.ch.clear(); } if (k === 'd') S.ch.clear(); if (k === 'niv' || k === 'zone' || k === 'd') draw(); });
    const LCx = LC;
    $$('td[data-c]', el).forEach(td => {
      const [lid, lotId] = td.dataset.c.split('|'), l = L.find(x => x.id === lid), lot = lots.find(x => x.id === lotId);
      let t = null, lp = false;
      td.addEventListener('pointerdown', () => { lp = false; clearTimeout(t); t = setTimeout(() => { lp = true; cellMenu(l, lot); }, 520); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => td.addEventListener(ev, () => clearTimeout(t)));
      td.onclick = () => { if (lp) return; if (my && !my.has(lotId)) return toast('Lot d\'une autre équipe'); const v = cur(l, lot), nx = STEPS.find(s => s > v); set(l, lot, nx == null ? 0 : nx); };
      td.oncontextmenu = (e) => e.preventDefault();
    });
    $$('th[data-col]', el).forEach(th => th.onclick = async () => { const lot = lots.find(x => x.id === th.dataset.col); if (my && !my.has(lot.id)) return;
      const v = await menu(`${lot.name} — tous les pins affichés`, [...[100, 75, 50, 25].map(x => ({ label: `Tout à ${x} %`, value: String(x) })), { label: 'Annuler les modifications de la colonne', icon: 'undo', value: 'undo' }]); if (!v) return;
      for (const l of L) { if (v === 'undo') S.ch.delete(l.id + '|' + lot.id); else if (+v > cur(l, lot)) S.ch.set(l.id + '|' + lot.id, +v); } draw(); });
    $$('th[data-row]', el).forEach(th => th.onclick = async () => { const l = L.find(x => x.id === th.dataset.row);
      const v = await menu(`${l.name} — tous les lots`, [...[100, 75, 50, 25].map(x => ({ label: `Tous les lots à ${x} %`, value: String(x) })), { label: 'Ouvrir la fiche du local', icon: 'eye', value: 'open' }, { label: 'Annuler les modifications de la ligne', icon: 'undo', value: 'undo' }]); if (!v) return;
      if (v === 'open') return openAvLocal(l, S.focus || lots[0].id, () => {});
      for (const lot of LCx) { if (my && !my.has(lot.id)) continue; if (v === 'undo') S.ch.delete(l.id + '|' + lot.id); else if (+v > cur(l, lot)) S.ch.set(l.id + '|' + lot.id, +v); } draw(); });
    const sv = $('[data-a=save]', el); if (sv) sv.onclick = save;
  }
  function set(l, lot, v) { const k = l.id + '|' + lot.id; if (v === avPctAt(l, lot.id, S.d)) S.ch.delete(k); else S.ch.set(k, v); try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} draw(); }
  async function cellMenu(l, lot) {
    const J = (l.journal || []).filter(e => e.lot === lot.id).sort((a, b) => (b.d + b.t).localeCompare(a.d + a.t));
    const v = await menu(`${l.name} · ${lot.name}`, [{ label: 'Saisir une valeur…', icon: 'edit', value: 'val' }, ...(S.ch.has(l.id + '|' + lot.id) ? [{ label: 'Remettre comme avant', icon: 'undo', value: 'undo' }] : []),
      ...J.slice(0, 12).map(e => ({ label: `${fmtDate(e.d)} · ${e.prev != null ? e.prev + ' → ' : ''}${e.pct} %${avTeam(p, e.eq) ? ' · ' + avTeam(p, e.eq).name : ''}${e.by ? ' · ' + e.by : ''}  (supprimer)`, icon: 'history', value: 'h:' + e.id }))]);
    if (v === 'val') { if (my && !my.has(lot.id)) return toast('Lot d\'une autre équipe'); const r = await formSheet(`${l.name} · ${lot.name}`, [{ name: 'v', label: 'Avancement (%)', type: 'number', value: cur(l, lot) }]); if (r && r.v !== '') set(l, lot, Math.max(0, Math.min(100, Math.round(+r.v)))); }
    if (v === 'undo') { S.ch.delete(l.id + '|' + lot.id); draw(); }
    if (v && v.startsWith('h:') && await confirmBox('Supprimer cette saisie de l\'historique ?')) { const fresh = await DB.get('links', l.id); fresh.journal = (fresh.journal || []).filter(e => e.id !== v.slice(2)); const last = fresh.journal.filter(e => e.lot === lot.id).sort((a, b) => (b.d + b.t).localeCompare(a.d + a.t))[0];
      if (last) { const keep = last; avApplyEntry(fresh, keep); } await DB.put('links', fresh); Object.assign(l, fresh); toast('Saisie supprimée'); draw(); }
  }
  async function save() {
    let pairs = [...S.ch.entries()].map(([k, v]) => { const [lid, lotId] = k.split('|'); return { loc: locaux.find(l => l.id === lid), lot: lotId, pct: v }; }).filter(x => x.loc);
    pairs = await avCheckReserves(p, pairs); if (!pairs.length) return;
    const g = DB.uid(); let k = 0; const by = {}; for (const x of pairs) (by[x.loc.id] = by[x.loc.id] || []).push(x);
    for (const [lid, X] of Object.entries(by)) { const fresh = await DB.get('links', lid); if (!fresh) continue; for (const x of X) { avEntryOn(p, fresh, { d: S.d, lot: x.lot, pct: x.pct, eq: S.eq, eff: k === 0 ? S.eff : 0, g, k, src: 'tab', note: '' }); k++; } await DB.put('links', fresh); Object.assign(locaux.find(l => l.id === lid), fresh); }
    await DB.put('projects', p); S.ch.clear(); toast(`✓ ${k} saisie(s) enregistrée(s)`); draw();
  }
  draw();
  return el;
}

// ---------- saisie express : une ligne par saisie (texte libre, message WhatsApp collé) ----------
function avParseLine(p, line, nivs, locaux) {
  const raw = String(line || '').trim(); if (!raw) return null;
  let toks = raw.replace(/[,;]+/g, ' ').split(/\s+/).filter(Boolean); const out = { raw };
  // niveau
  for (let i = 0; i < toks.length; i++) { const k = avNivKey(toks[i]); const n = nivs.find(x => avNivKey(x.name) === k); if (n) { out.niv = n; toks.splice(i, 1); break; } }
  // pin : plus longue suite de mots qui donne le nom d'un pin (espaces ignorés)
  const pool = locaux.filter(l => !out.niv || l.nivId === out.niv.id), key = (s) => normQ(s);
  let best = null;
  for (let i = 0; i < toks.length; i++) for (let j = Math.min(toks.length, i + 8); j > i; j--) { const s = key(toks.slice(i, j).join('')); if (s.length < 2) continue;
    const m = pool.filter(l => key(l.name) === s || (l.anep && key(l.anep) === s)); if (m.length === 1 && (!best || j - i > best.j - best.i)) best = { i, j, l: m[0] }; }
  if (best) { out.loc = best.l; toks.splice(best.i, best.j - best.i); if (!out.niv) out.niv = nivs.find(n => n.id === best.l.nivId); }
  for (let i = 0; i < toks.length; i++) { const t = normQ(toks[i]); if (t.length < 3) continue; const l = avLots(p).find(x => normQ(x.name).startsWith(t)); if (l) { out.lot = l; toks.splice(i, 1); break; } }
  for (let i = 0; i < toks.length; i++) { const t = normQ(toks[i]); if (t.length < 3) continue; const m = avTeams(p).find(x => normQ(x.name) === t || normQ(x.name).startsWith(t)); if (m) { out.eq = m; toks.splice(i, 1); break; } }
  for (let i = 0; i < toks.length; i++) { const m = toks[i].match(/^(\d{1,3})(p|pers|personnes?|ouvriers?)$/i); if (m) { out.eff = +m[1]; toks.splice(i, 1); break; } }
  for (let i = toks.length - 1; i >= 0; i--) { const m = toks[i].match(/^(\d{1,3})\s?%?$/); if (m && +m[1] <= 100) { out.pct = +m[1]; toks.splice(i, 1); break; } }
  out.rest = toks.join(' ');
  out.err = !out.loc ? 'pin introuvable' : !out.lot ? 'lot ?' : out.pct == null ? '% ?' : '';
  return out;
}
async function avExpress(p, after) {
  const { locaux, nivs } = await avData(p);
  const r = await formSheet('⚡ Saisie express', [
    { name: 'info', type: 'info', label: 'Une ligne par saisie', value: 'Niveau · lot · local · % · équipe · effectif, dans n\'importe quel ordre.\nEx : RDC maç CORE 12 80 sgtm 6p\nVous pouvez coller le message WhatsApp d\'un chef d\'équipe.' },
    { name: 'd', label: 'Date', type: 'date', value: todayISO() },
    { name: 't', label: 'Saisies', type: 'textarea', value: '', placeholder: 'RDC maçonnerie CORE 12 80 sgtm 6p\nMEZZ chape RISER LT 3 100' },
  ], { okLabel: 'Vérifier' });
  if (!r || !r.t) return;
  const P = r.t.split(/\n+/).map(x => avParseLine(p, x, nivs, locaux)).filter(Boolean);
  const okL = P.filter(x => !x.err);
  const go = await confirmBox(`${okL.length}/${P.length} ligne(s) comprise(s) :\n\n${P.map(x => x.err ? `✗ ${x.raw} — ${x.err}` : `✓ ${x.niv ? x.niv.name + ' · ' : ''}${x.loc.name} · ${x.lot.name} : ${x.pct} %${x.eq ? ' · ' + x.eq.name : ''}${x.eff ? ' · ' + x.eff + ' pers.' : ''}`).join('\n')}`, okL.length ? `Enregistrer ${okL.length}` : 'OK');
  if (!go || !okL.length) return;
  let pairs = await avCheckReserves(p, okL.map(x => ({ loc: x.loc, pct: x.pct, x })));
  const g = DB.uid(); let k = 0;
  for (const { x } of pairs) { const fresh = await DB.get('links', x.loc.id); if (!fresh) continue; avEntryOn(p, fresh, { d: r.d, lot: x.lot.id, pct: x.pct, eq: x.eq ? x.eq.id : '', eff: x.eff || 0, note: x.rest, g, k, src: 'exp' }); await DB.put('links', fresh); k++; }
  await DB.put('projects', p); toast(`✓ ${k} saisie(s) enregistrée(s)`); after && after();
}

// ---------- rappel : lots en cours sans saisie aujourd'hui (après 17 h) ----------
async function avReminderCheck(p) {
  try {
    p = p || App.project; if (!p || !(p.avNiveaux || []).length) return;
    const now = new Date(), today = todayISO(), k = 'avRem.' + p.id + '.' + today; if (now.getHours() < 17 || localStorage.getItem(k)) return;
    const L = (await DB.byProject('links', p.id)).filter(l => l.kind === 'local'), miss = [];
    for (const n of p.avNiveaux || []) for (const lot of avLots(p)) { const P = (p.avPlan || {})[n.id + '|' + lot.id]; if (!P || P.done || !P.deb || P.deb > today) continue;
      const locs = L.filter(l => l.nivId === n.id), x = avLotPlanning(p, n, lot, locs); if (x.finR) continue;
      if (!locs.some(l => (l.journal || []).some(e => e.d === today && e.lot === lot.id))) miss.push(`${n.name} · ${lot.name}`); }
    localStorage.setItem(k, '1');
    if (miss.length) toast(`🔔 Saisie du jour non faite : ${miss.slice(0, 3).join(', ')}${miss.length > 3 ? ` +${miss.length - 3}` : ''}`, { action: 'Saisir', ms: 8000, onAction: () => openAvTable(p) });
  } catch (e) {}
}
// notification quotidienne à 17 h (téléphone) tant que des lots sont en cours
async function avReminderNotif(p) {
  const LN = window.Capacitor?.Plugins?.LocalNotifications; if (!LN) return;
  try { const k = 'avRemN.' + p.id; if (localStorage.getItem(k) === todayISO()) return; localStorage.setItem(k, todayISO()); } catch (e) {}   // v1.0.48 : une fois par jour, pas à chaque affichage
  try {
    const today = todayISO(), on = (p.avNiveaux || []).some(n => avLots(p).some(lot => { const P = (p.avPlan || {})[n.id + '|' + lot.id]; return P && !P.done && P.deb && P.deb <= today && (!P.fin || avDaysBetween(P.fin, today) < 30); }));
    const id = 1999000302; await LN.cancel({ notifications: [{ id }, { id: 1999000301 }] }).catch(() => {});
    if (!on) return;
    // v1.0.48 : une seule notification à une date précise (« at »), reprogrammée à l'ouverture suivante — jamais de répétition automatique
    const d = new Date(); d.setHours(17, 0, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1);
    await LN.schedule({ notifications: [{ id, title: '📊 Saisie d\'avancement', body: `${p.name} : pensez à la saisie du jour (lots en cours)`, channelId: 'rappels', schedule: { at: d, allowWhileIdle: true } }] });
  } catch (e) { console.warn('rappel av', e); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && App.project && App.section === 'avancement') avReminderCheck(App.project); });

// ---------- Plans › lot › niveau : bloc « Avancement » (lien direct, alertes, dates, équipes, saisies) ----------
function avLotPanelBlock(p, L, f, redraw) {
  const box = document.createElement('div'); box.className = 'lp-av';
  const niv = avNivOfFolder(p, f), lot = avLotOfPlanLot(p, L);
  let open = false; try { open = localStorage.getItem('lpav.open') !== '0'; } catch (e) {}
  if (!niv || !lot) {
    box.innerHTML = `<div class="lpa-h"><span>📊</span><span class="grow"><b>Avancement ${esc(L.name)}</b><small>${!niv ? 'Ce niveau n\'est pas encore suivi dans Avancement' : 'Ce lot n\'est pas encore suivi dans Avancement'}</small></span><button class="btn small" data-a="link">Relier</button></div>`;
    $('[data-a=link]', box).onclick = async () => {
      if (!lot) { p.avLotSkip = (p.avLotSkip || []).filter(x => x !== normQ(L.name)); avLots(p).push({ id: DB.uid(), name: L.name, color: L.c, fromPlans: L.id }); }
      if (!niv) { const ps = (await DB.byProject('plans', p.id)).filter(x => x.folderId === f.id && isCurrentPlan(x)); if (!ps.length) { await DB.put('projects', p); return toast('Ajoutez d\'abord un plan dans ce dossier'); }
        const base = ps.find(x => !x.lotId) || ps.find(x => x.lotId === 'go') || ps[0], nn = nivOfFolder(f.name) || f.name;
        p.avNiveaux = p.avNiveaux || []; p.avNiveaux.push({ id: DB.uid(), name: avNivKey(nn) === 'MEZZ' ? 'MEZZ' : nn.toUpperCase(), serieId: planSerie(base), folderId: f.id }); }
      await DB.put('projects', p); await avSyncFromPlans(p, true); toast('Relié à Avancement ✓'); redraw && redraw(); };
    return box;
  }
  box.innerHTML = `<details class="lpa" ${open ? 'open' : ''}><summary class="lpa-h"><span>📊</span><span class="grow"><b>Avancement · ${esc(niv.name)}</b><small class="lpa-sum">…</small></span><i class="lpa-chev">${icon('chevdown')}</i></summary><div class="lpa-b"><div class="muted">Chargement…</div></div></details>`;
  $('details', box).addEventListener('toggle', (e) => { try { localStorage.setItem('lpav.open', e.target.open ? '1' : '0'); } catch (x) {} });
  (async () => {
    const all = (await DB.byProject('links', p.id)).filter(l => l.kind === 'local' && l.nivId === niv.id), x = avLotPlanning(p, niv, lot, all), s = x.s, today = todayISO();
    const AC = { r: '#ef4444', o: '#f97316', y: '#eab308', g: '#16a34a' };
    const J = all.flatMap(l => (l.journal || []).filter(e => e.lot === lot.id).map(e => ({ e, l }))).sort((a, b) => (b.e.d + b.e.t).localeCompare(a.e.d + a.e.t));
    const TT = {}; for (const { e } of J) { if (!e.eq) continue; const t = TT[e.eq] = TT[e.eq] || { n: 0, last: '', eff: 0 }; t.n++; if (e.d > t.last) { t.last = e.d; } if (e.eff && e.d === t.last) t.eff = Math.max(t.eff, +e.eff); }
    const tod = J.filter(z => z.e.d === today), lp = await avLotPlan(p, niv, lot.id);
    const sumTxt = `${s.n ? s.pct + ' %' : 'aucun pin'}${x.finR ? ' · ✓ terminé' : x.late ? ` · 🔴 retard ${x.late} j` : ''}`;
    $('.lpa-sum', box).textContent = sumTxt;
    $('.lpa-b', box).innerHTML = `
      <div class="lpa-pct"><span class="lpa-bar" style="--c:${lot.color}"><i style="width:${s.pct}%"></i></span><b>${s.pct}%</b><small>${s.fin}/${s.n} pin(s) terminé(s)</small></div>
      ${x.al.length ? x.al.slice(0, 1).map(a => `<div class="lpa-al" style="--c:${AC[a[0]]}"><i></i><span>${esc(a[1])}</span></div>`).join('') : ''}
      <button class="lpa-dates" data-a="dates"><span><small>Début prévu</small><b>${x.P.deb ? fmtDate(x.P.deb) : '—'}</b></span><span><small>Fin prévue</small><b>${x.P.fin ? fmtDate(x.P.fin) : '—'}</b></span><span><small>${x.finR ? 'Terminé' : x.prev ? 'Prévision' : 'Réel'}</small><b>${x.finR ? fmtDate(x.finR) : x.prev ? fmtDate(x.prev) : x.debR ? 'depuis ' + fmtDate(x.debR) : '—'}</b></span>${icon('edit')}</button>
      ${Object.keys(TT).length ? `<div class="lpa-eq">${Object.entries(TT).map(([id, t]) => { const tm = avTeam(p, id) || { name: '?', color: '#64748b' }; return `<span style="--c:${tm.color}"><i>${esc(dpIni(tm.name))}</i><b>${esc(tm.name)}</b><small>${t.eff ? t.eff + ' pers. · ' : ''}${t.last === today ? 'auj.' : fmtDate(t.last).slice(0, 5)}</small></span>`; }).join('')}</div>` : ''}
      <div class="lpa-today">☀️ ${tod.length ? `${tod.length} saisie(s) aujourd'hui : ${tod.slice(0, 4).map(z => `${esc(z.l.name)} ${z.e.pct}%`).join(' · ')}` : 'Aucune saisie aujourd\'hui'}</div>
      <div class="lpa-acts"><button data-a="plan">${icon('plans')} Plan + pins${lp && lp.id !== 'main' ? '' : ' (général)'}</button><button data-a="tab">${icon('grid')} Saisie</button><button data-a="done" class="${x.finR ? 'on' : ''}">${icon('check')} ${x.P.done ? 'Terminé ✓' : 'Terminé'}</button><button data-a="pdf">${icon('pdf')} PDF</button></div>`;
    $('[data-a=dates]', box).onclick = async () => { if (await avPlanningEdit(p, niv, lot, p.avNiveaux)) redraw && redraw(); };
    $('[data-a=plan]', box).onclick = () => openAvViewer(niv.id, lot.id, () => redraw && redraw());
    $('[data-a=tab]', box).onclick = () => openAvTable(p, { nivId: niv.id, lotId: lot.id, onClose: () => redraw && redraw() });
    $('[data-a=done]', box).onclick = async () => { if (await avLotDone(p, niv, lot, !x.P.done)) redraw && redraw(); };
    $('[data-a=pdf]', box).onclick = () => avReportDialog({ nivId: niv.id, lotId: lot.id });
  })().catch(e => { console.warn('lpav', e); $('.lpa-b', box).innerHTML = '<div class="muted">Avancement indisponible</div>'; });
  return box;
}
// pastille d'alerte sur la barre des lots (Plans) : rouge = retard, jaune = proche, ✓ = terminé
function avLotBadge(p, L, f, all) {
  const niv = avNivOfFolder(p, f), lot = avLotOfPlanLot(p, L); if (!niv || !lot || !(p.avPlan || {})[niv.id + '|' + lot.id]) return '';
  const x = avLotPlanning(p, niv, lot, all.filter(l => l.nivId === niv.id)), a = x.al[0];
  if (x.finR) return '<i class="lc-av ok">✓</i>';
  if (!a) return ''; return `<i class="lc-av ${a[0]}">${x.late ? x.late + 'j' : '!'}</i>`;
}

// ---------- équipes & sous-traitants ----------
const AV_TTYPES = [['int', 'Interne'], ['st', 'Sous-traitant'], ['tach', 'Tâcheron']];
const avTType = (t) => (AV_TTYPES.find(x => x[0] === ((t && t.type) || 'int')) || AV_TTYPES[0]);
function avPeriod(F) {
  const t = todayISO(), d = new Date(t + 'T12:00:00'), mon = avAddDays(t, -((d.getDay() + 6) % 7));
  switch (F.pk || 'week') {
    case 'today': return { a: t, b: t, l: 'Aujourd\'hui' };
    case 'yday': { const y = avAddDays(t, -1); return { a: y, b: y, l: 'Hier' }; }
    case 'week': return { a: mon, b: t, l: 'Cette semaine' };
    case 'lweek': return { a: avAddDays(mon, -7), b: avAddDays(mon, -1), l: 'Semaine dernière' };
    case 'month': return { a: t.slice(0, 8) + '01', b: t, l: 'Ce mois' };
    case 'custom': { const a = F.from || mon, b = F.to || t; return { a: a <= b ? a : b, b: a <= b ? b : a, l: `Du ${fmtDate(a)} au ${fmtDate(b)}` }; }
    default: return { a: '', b: t, l: 'Total' };
  }
}
function avTeamStats2(p, L, lots, a, b) {
  const ls = new Set(lots.map(l => l.id)), den = Math.max(1, L.length * lots.length), T = {};
  for (const l of L) for (const e of l.journal || []) { if (!e.eq || !ls.has(e.lot) || (a && e.d < a) || e.d > b) continue;
    const t = T[e.eq] = T[e.eq] || { n: 0, gain: 0, days: {}, lots: new Set(), pins: new Set(), nivs: {}, last: '', m2: 0, E: [] };
    const g = Math.max(0, (+e.pct || 0) - (+e.prev || 0)); t.n++; t.gain += g; t.lots.add(e.lot); t.pins.add(l.id); t.nivs[l.nivId] = (t.nivs[l.nivId] || 0) + 1; if (e.d > t.last) t.last = e.d;
    t.days[e.d] = Math.max(t.days[e.d] || 0, +e.eff || 0); if (l.area) t.m2 += (+l.area || 0) * g / 100; t.E.push({ e, l }); }
  const tot = Object.values(T).reduce((s, t) => s + t.gain, 0) || 1;
  return Object.entries(T).map(([id, t]) => { const jh = Object.values(t.days).reduce((s, v) => s + v, 0), nd = Object.keys(t.days).length;
    const late = L.filter(l => lots.some(lot => { const r = (l.lots || {})[lot.id]; return r && r.eq === id && avStatus(r) === 'late'; })).length;
    return { id, t: avTeam(p, id) || { name: '?', color: '#64748b' }, ...t, pts: t.gain / den, part: Math.round(t.gain / tot * 100), jh, nd, effM: nd ? Math.round(jh / nd) : 0, rend: jh ? t.gain / jh : 0, late }; })
    .sort((x, y) => y.gain - x.gain);
}
const avF1 = (v) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');
async function avTeamFiche(p, id, nivs, L, lots, per) {
  const TS = avTeamStats2(p, L, lots, per.a, per.b), x = TS.find(z => z.id === id), t = avTeam(p, id) || { name: '?' }, tt = avTType(t);
  if (!x) return toast('Aucune saisie de cette équipe sur la période');
  const days = Object.keys(x.days).sort(); let cum = 0; const den = Math.max(1, L.length * lots.length);
  const series = days.map(d => { cum += x.E.filter(z => z.e.d === d).reduce((s, z) => s + Math.max(0, z.e.pct - (+z.e.prev || 0)), 0) / den; return { d, v: Math.round(cum * 10) / 10 }; });
  const ph = x.E.flatMap(z => z.e.photos || []);
  const s = sheet(`<div class="avtf"><div class="avtf-h" style="--c:${t.color || '#64748b'}"><span class="avp-ta">${esc(dpIni(t.name))}</span><span class="grow"><b>${esc(t.name)}</b><small>${tt[1]}${t.soc ? ' · ' + esc(t.soc) : ''}${t.resp ? ' · ' + esc(t.resp) : ''}${t.tel ? ' · ' + esc(t.tel) : ''}</small></span></div>
    <div class="avtf-k"><div><b>${x.part}%</b><span>part</span></div><div><b>+${avF1(x.pts)}</b><span>pts</span></div><div><b>${x.effM}</b><span>pers./j</span></div><div><b>${x.jh}</b><span>jours-h.</span></div><div><b>${avF1(x.rend)}</b><span>rendement</span></div><div class="${x.late ? 'r' : ''}"><b>${x.late}</b><span>en retard</span></div></div>
    <small class="muted">${esc(per.l)} · ${x.n} saisie(s) · ${x.pins.size} pin(s)${x.m2 ? ` · ${Math.round(x.m2)} m²` : ''}</small>
    ${series.length > 1 ? `<div class="avp-card">${avCurve(series.map(z => ({ d: z.d, v: Math.min(100, z.v) })))}</div>` : ''}
    <div class="avtf-w"><b>Où</b>${Object.entries(x.nivs).map(([nid, n]) => `<span>${esc((nivs.find(v => v.id === nid) || {}).name || '?')} · ${n}</span>`).join('')}</div>
    ${ph.length ? `<div class="avtf-ph">${ph.slice(0, 12).map(id => `<span data-ph="${id}"></span>`).join('')}</div>` : ''}
    <div class="avtf-j">${x.E.sort((a, b) => (b.e.d + b.e.t).localeCompare(a.e.d + a.e.t)).slice(0, 40).map(({ e, l }) => `<div><span>${esc(fmtDate(e.d).slice(0, 5))}</span><b>${esc((nivs.find(n => n.id === l.nivId) || {}).name || '')} · ${esc(l.name)}</b><small>${esc(avLot(p, e.lot).name)} ${e.prev != null ? e.prev + '→' : ''}${e.pct}%${e.eff ? ' · ' + e.eff + 'p' : ''}</small></div>`).join('')}</div>
    <div class="btnrow"><button class="btn ghost" data-a="wa">${icon('share')} WhatsApp</button><button class="btn" data-a="pdf">${icon('pdf')} Rapport PDF</button></div></div>`, { title: `👷 ${t.name}` });
  (async () => { for (const sp of $$('[data-ph]', s.el)) { const f = await DB.get('files', sp.dataset.ph); if (f && f.blob) { sp.innerHTML = `<img src="${BlobURL.get(f.id, f.blob)}">`; sp.onclick = async () => { const fs = await loadFiles(ph); showGallery(fs.map(f2 => ({ src: BlobURL.get(f2.id, f2.blob), caption: t.name, fileId: f2.id })), fs.findIndex(f2 => f2.id === f.id)); }; } } })();
  const txt = () => `*${p.name}* — ${t.name} (${tt[1]})\n${per.l}\nPart : *${x.part} %* · +${avF1(x.pts)} pts · ${x.effM} pers./j · ${x.jh} jours-homme · rendement ${avF1(x.rend)}${x.late ? ` · ⚠ ${x.late} en retard` : ''}\n\n` + x.E.slice(0, 30).map(({ e, l }) => `• ${fmtDate(e.d)} ${(nivs.find(n => n.id === l.nivId) || {}).name || ''} · ${l.name} — ${avLot(p, e.lot).name} ${e.pct} %`).join('\n');
  $('[data-a=wa]', s.el).onclick = () => shareWhatsApp(txt());
  $('[data-a=pdf]', s.el).onclick = async () => { const ld = loading('Rapport…'); try { if (!window.jspdf && window.__late) await window.__late; const R = newDoc('Rapport équipe', p), { doc } = R; void doc;
    R.text(`${t.name} — ${tt[1]}`, { size: 17, bold: true, gap: 1 }); R.text(`${per.l}${t.soc ? ' · ' + t.soc : ''}${t.resp ? ' · ' + t.resp : ''}`, { size: 10, color: [90, 90, 90], gap: 4 });
    R.text(`Part de l'avancement : ${x.part} % · +${avF1(x.pts)} pts · effectif moyen ${x.effM} · ${x.jh} jours-homme · rendement ${avF1(x.rend)} · ${x.late} en retard${x.m2 ? ' · ' + Math.round(x.m2) + ' m²' : ''}`, { size: 11, bold: true, gap: 3 });
    for (const { e, l } of x.E) R.text(`${fmtDate(e.d)} · ${(nivs.find(n => n.id === l.nivId) || {}).name || ''} · ${l.name} — ${avLot(p, e.lot).name} ${e.prev != null ? e.prev + ' → ' : ''}${e.pct} %${e.eff ? ' · ' + e.eff + ' pers.' : ''}${e.note ? ' — ' + e.note : ''}`, { size: 9, gap: 0.4 });
    R.finish(); ld.close(); await sharePdf(R.doc, avFileName(`Equipe ${t.name} ${p.name} ${todayISO()}`) + '.pdf'); } catch (e) { ld.close(); alertBox('Rapport impossible : ' + (e.message || e)); } };
}

// ---------- tableau de bord « Pro » : barre de choix (Zone › Niveau › Lot › Équipe › Période), ordonné, dépliable ----------
const avSecOpen = (k, def) => { try { const v = localStorage.getItem('avsec.' + k); return v == null ? def : v === '1'; } catch (e) { return def; } };
function avProFilter(p, nivs, locaux) {
  let F = App.avF && App.avF._p === p.id ? App.avF : null;
  if (!F) { try { F = JSON.parse(localStorage.getItem('avF.' + p.id) || 'null'); } catch (e) {} F = { sect: '', zone: '', niv: '', lot: '', eq: '', lt: '', pk: 'week', from: '', to: '', by: 'zone', ts: 'gain', ...(F || {}), _p: p.id }; App.avF = F; }
  const nv = (l) => nivs.find(n => n.id === l.nivId), pz = (l) => avPinZone(p, l, nv(l));
  const N = avNivSorted(p, nivs).filter(n => !F.niv || n.id === F.niv);
  const L = locaux.filter(l => nv(l) && (!F.niv || l.nivId === F.niv) && (!F.zone || pz(l) === F.zone) && (!F.sect || avSectOf(p, pz(l)) === F.sect) && (!F.lt || l.ltype === F.lt)
    && (!F.eq || Object.values(l.lots || {}).some(r => r.eq === F.eq) || (l.journal || []).some(e => e.eq === F.eq)));
  const lots = avLotsOrdered(p).filter(l => !F.lot || l.id === F.lot);
  F.per = (() => { const P = avPeriod(F); return P.a ? Math.max(1, avDaysBetween(P.a, P.b) + 1) : 30; })();
  return { F, N, L, lots, pz };
}
const avSaveF = (p, F) => { try { const o = { ...F }; delete o._p; localStorage.setItem('avF.' + p.id, JSON.stringify(o)); } catch (e) {} };
async function avProDash(root, p, nivs, locaux) {
  const { F, N, L, lots, pz } = avProFilter(p, nivs, locaux), today = todayISO(), per = avPeriod(F);
  const allZ = avZones(p).filter(z => locaux.some(l => pz(l) === z) || nivs.some(n => avZoneOf(p, n) === z)), SE = avSecteurs(p).filter(s => allZ.some(z => avSectOf(p, z) === s));
  const zones = allZ.filter(z => !F.sect || avSectOf(p, z) === F.sect);
  const nivOpts = avNivSorted(p, nivs).filter(n => !F.zone || locaux.some(l => l.nivId === n.id && pz(l) === F.zone) || avZoneOf(p, n) === F.zone);
  const glob = avAvg(L, lots), g0 = per.a ? avAvg(L, lots, avAddDays(per.a, -1)) : 0, g1 = per.b === today ? glob : avAvg(L, lots, per.b), gain = g1 - g0;
  const inP = (e) => (!per.a || e.d >= per.a) && e.d <= per.b && (!F.lot || e.lot === F.lot) && (!F.eq || e.eq === F.eq);
  const E = L.flatMap(l => (l.journal || []).filter(inP).map(e => ({ e, l, n: nivs.find(n => n.id === l.nivId) })));
  const TS = avTeamStats2(p, L, lots, per.a, per.b), jhT = TS.reduce((s, x) => s + x.jh, 0);
  let late = 0, done = 0, pairs = 0; for (const l of L) for (const lot of lots) { const s = avStatus((l.lots || {})[lot.id]); pairs++; if (s === 'late') late++; if (avIsDone(s)) done++; }
  // évolution sur la période (total : depuis la 1re saisie, au plus 120 points)
  const first = per.a || (L.flatMap(l => (l.journal || []).map(e => e.d)).sort()[0] || avAddDays(today, -29));
  const span = Math.max(1, avDaysBetween(first, per.b) + 1), step = Math.max(1, Math.ceil(span / 120));
  const days = []; for (let i = 0; i < span; i += step) days.push(avAddDays(first, i)); if (days[days.length - 1] !== per.b) days.push(per.b);
  const series = days.map(d => ({ d, v: avAvg(L, lots, d) }));
  // alertes : planning des lots + pins en retard
  const AC = { r: '#ef4444', o: '#f97316', y: '#eab308', g: '#16a34a' }, AL = [];
  for (const n of N) { const LL = L.filter(l => l.nivId === n.id); for (const lot of lots) { if (!(p.avPlan || {})[n.id + '|' + lot.id] && !LL.length) continue; const x = avLotPlanning(p, n, lot, LL), a = x.al[0]; if (a && a[0] !== 'g') AL.push({ a, n, lot, x }); } }
  AL.sort((a, b) => b.a[2] - a.a[2] || (b.x.late || 0) - (a.x.late || 0));
  const sel = (k, opts, cur, lab) => `<label class="avf-s ${cur ? 'on' : ''}"><small>${lab}</small><select data-fk="${k}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const scope = [F.sect, F.zone, F.niv ? (nivs.find(n => n.id === F.niv) || {}).name : '', F.lot ? avLot(p, F.lot).name : '', F.eq ? (avTeam(p, F.eq) || {}).name : '', F.lt ? (avLocTypes(p).find(t => t.id === F.lt) || {}).name : ''].filter(Boolean);
  const sec = (k, title, n, body, def = true) => `<details class="avp-card avp-sec" data-sec="${k}" ${avSecOpen(k, def) ? 'open' : ''}><summary class="avp-h">${title}${n !== '' && n != null ? ` <span>${n}</span>` : ''}<i class="avp-chev">${icon('chevdown')}</i></summary>${body}</details>`;
  // détail : Zone › Niveau › Lot
  const detZ = (F.zone ? [F.zone] : zones).map(z => { const NZ = N.filter(n => L.some(l => l.nivId === n.id && pz(l) === z)); if (!NZ.length) return '';
    return `<div class="avd-z"><div class="avd-zh">${esc(avSectOf(p, z) ? avSectOf(p, z) + ' · ' : '')}${esc(z)}<b>${avAvg(L.filter(l => pz(l) === z), lots)}%</b></div>${NZ.map(n => { const LL = L.filter(l => l.nivId === n.id && pz(l) === z);
      return `<div class="avd-n"><div class="avd-nh"><b>${esc(n.name)}</b><small>${LL.length} pin(s)</small><em>${avAvg(LL, lots)}%</em></div>${lots.map(lot => { const s = avStats(LL, lot.id), d = per.a ? s.pct - avAvg(LL, [lot], avAddDays(per.a, -1)) : 0;
        return `<button class="avd-l" data-open="${n.id}|${lot.id}" style="--c:${s.late ? '#ef4444' : s.pct === 100 ? '#22c55e' : lot.color}"><span>${esc(lot.name)}</span><span class="avd-b"><i style="width:${s.pct}%"></i></span><b>${s.pct}%</b>${d > 0 ? `<small>+${d}</small>` : '<small></small>'}</button>`; }).join('')}</div>`; }).join('')}</div>`; }).join('');
  // équipes : interne / sous-traitants / tâcherons
  const byT = {}; for (const x of TS) { const k = avTType(x.t)[0]; byT[k] = (byT[k] || 0) + x.gain; } const totG = Object.values(byT).reduce((s, v) => s + v, 0) || 1;
  const TC = { int: '#2563eb', st: '#f97316', tach: '#a855f7' };
  const TSs = TS.slice().sort((a, b) => F.ts === 'rend' ? b.rend - a.rend : b.gain - a.gain);
  const teamsHTML = TS.length ? `<div class="avte-cmp">${AV_TTYPES.filter(([k]) => byT[k]).map(([k, l]) => `<i style="flex:${byT[k]};background:${TC[k]}"></i>`).join('')}</div>
      <div class="avte-lg">${AV_TTYPES.filter(([k]) => byT[k]).map(([k, l]) => `<span><i style="background:${TC[k]}"></i>${l} <b>${Math.round(byT[k] / totG * 100)}%</b></span>`).join('')}<span class="avp-seg"><button class="${F.ts !== 'rend' ? 'on' : ''}" data-ts="gain">Avancement</button><button class="${F.ts === 'rend' ? 'on' : ''}" data-ts="rend">Rendement</button></span></div>
      <div class="avte">${TSs.map((x, i) => { const tt = avTType(x.t); return `<button class="avte-c" data-team="${x.id}" style="--c:${x.t.color || '#64748b'}"><span class="avte-r">${i + 1}</span><span class="avp-ta">${esc(dpIni(x.t.name))}</span>
        <span class="grow"><b>${esc(x.t.name)}</b><small><em style="--k:${TC[tt[0]]}">${tt[1]}</em>${x.t.lot ? ' · ' + esc(avLot(p, x.t.lot).name) : ''}</small><span class="avp-tb"><i style="width:${x.part}%"></i></span>
        <span class="avte-m"><span><b>${x.part}%</b>part</span><span><b>+${avF1(x.pts)}</b>pts</span><span><b>${x.effM}</b>pers./j</span><span><b>${x.jh}</b>j-h</span><span><b>${avF1(x.rend)}</b>rend.</span>${x.late ? `<span class="r"><b>${x.late}</b>retard</span>` : ''}${x.m2 ? `<span><b>${Math.round(x.m2)}</b>m²</span>` : ''}</span></span></button>`; }).join('')}</div>`
    : `<div class="muted avp-pad">${avTeams(p).length ? 'Aucune saisie d\'équipe sur la période' : 'Ajoutez vos équipes et sous-traitants, puis choisissez-les à chaque saisie'}</div>`;
  const rows = F.by === 'type' ? avLocTypes(p).map(t => ({ k: 't:' + t.id, label: t.name, sub: '', c: t.color, L: L.filter(l => l.ltype === t.id) })).filter(r => r.L.length)
    : F.by === 'niv' || F.zone ? N.map(n => ({ k: 'n:' + n.id, label: n.name, sub: F.zone ? '' : [...new Set(L.filter(l => l.nivId === n.id).map(pz))].join(', '), L: L.filter(l => l.nivId === n.id) })).filter(r => r.L.length || !F.zone)
    : SE.length && !F.sect ? [...SE.map(s => ({ k: 's:' + s, label: s, sub: `${allZ.filter(z => avSectOf(p, z) === s).length} zone(s)`, L: L.filter(l => avSectOf(p, pz(l)) === s) })), ...(L.some(l => !avSectOf(p, pz(l))) ? [{ k: 's:', label: 'Sans secteur', sub: '', L: L.filter(l => !avSectOf(p, pz(l))) }] : [])]
    : zones.map(z => ({ k: 'z:' + z, label: z, sub: `${new Set(L.filter(l => pz(l) === z).map(l => l.nivId)).size} niv.`, L: L.filter(l => pz(l) === z) }));
  root.innerHTML = `<div class="avp">
    <div class="avf-bar">
      ${SE.length ? sel('sect', [['', 'Tous'], ...SE.map(s => [s, s])], F.sect, 'Secteur') : ''}
      ${sel('zone', [['', 'Toutes'], ...zones.map(z => [z, z])], F.zone, 'Zone')}
      ${sel('niv', [['', 'Tous'], ...nivOpts.map(n => [n.id, n.name])], F.niv, 'Niveau')}
      ${sel('lot', [['', 'Tous'], ...avLotsOrdered(p).map(l => [l.id, l.name])], F.lot, 'Lot')}
      ${avTeams(p).length ? sel('eq', [['', 'Toutes'], ...avTeams(p).map(t => [t.id, t.name])], F.eq, 'Équipe') : ''}
      ${locaux.some(l => l.ltype) ? sel('lt', [['', 'Tous'], ...avLocTypes(p).filter(t => locaux.some(l => l.ltype === t.id)).map(t => [t.id, t.name])], F.lt, 'Type') : ''}
      ${sel('pk', [['today', 'Aujourd\'hui'], ['yday', 'Hier'], ['week', 'Cette semaine'], ['lweek', 'Semaine dernière'], ['month', 'Ce mois'], ['total', 'Total'], ['custom', 'Du … au …']], F.pk, 'Période')}
      ${scope.length || F.pk !== 'week' ? `<button class="avf-rst" data-a="rst" title="Tout">↺</button>` : ''}
    </div>
    ${F.pk === 'custom' ? `<div class="avf-cus"><label>Du <input type="date" data-fk="from" value="${esc(F.from || per.a)}"></label><label>au <input type="date" data-fk="to" value="${esc(F.to || per.b)}"></label></div>` : ''}
    <div class="avf-scope">${esc([...(scope.length ? scope : ['Tout le projet']), per.l].join(' · '))}</div>
    <div class="avp-hero"><div class="avp-hero-l">${avDonut(glob, 'var(--accent)', 108, 'total')}</div>
      <div class="avp-hero-r"><div class="avp-gain ${gain > 0 ? 'up' : ''}"><b>${gain > 0 ? '+' : ''}${gain}</b><span>pts · ${esc(per.l.toLowerCase())}</span></div>
        <div class="avp-k"><div><b>${done}/${pairs}</b><span>terminés</span></div><div class="${late ? 'r' : ''}"><b>${late}</b><span>en retard</span></div><div><b>${E.length}</b><span>saisies</span></div><div><b>${jhT || E.reduce((a, x) => a + (+x.e.eff || 0), 0)}</b><span>jours-h.</span></div></div></div></div>
    <div class="avp-lots">${lots.map(lot => { const v = avAvg(L, [lot]); return `<button class="avp-lot" data-f="lot|${F.lot === lot.id ? '' : lot.id}">${avDonut(v, lot.color, 72)}<span>${esc(lot.name)}</span></button>`; }).join('')}</div>
    ${sec('al', '🚨 Alertes', AL.length, AL.length ? AL.slice(0, 25).map(({ a, n, lot, x }) => `<div class="avp-al2" style="--c:${AC[a[0]]}"><i></i><button class="grow" data-pl="${n.id}|${lot.id}"><b>${esc(n.name)} · ${esc(lot.name)}</b><small>${esc(a[1])}</small></button><button class="avp-ok" data-done="${n.id}|${lot.id}" title="Terminé">${icon('check')}</button></div>`).join('') : '<div class="muted avp-pad">Aucune alerte ✓ — fixez les dates prévues dans « Planning des lots »</div>', AL.length > 0)}
    ${sec('evo', '📈 Évolution', '', avCurve(series))}
    ${sec('det', '🧱 Détail · zone › niveau › lot', '', detZ || '<div class="muted avp-pad">Aucun pin dans ce choix</div>', false)}
    ${sec('eq', '👷 Équipes & sous-traitants', TS.length || '', teamsHTML + `<button class="avp-lnk2" data-a="teams">${icon('settings')} Gérer les équipes</button>`)}
    ${sec('jr', '☀️ Saisies de la période', E.length, E.length ? E.sort((a, b) => (b.e.d + b.e.t).localeCompare(a.e.d + a.e.t)).slice(0, 30).map(({ e, l, n }) => { const lot = avLot(p, e.lot), t = avTeam(p, e.eq); return `<div class="avp-today"><i style="background:${lot.color}"></i><span class="grow"><b>${esc(n ? n.name : '')} · ${esc(l.name)}</b><small>${esc(fmtDate(e.d).slice(0, 5))} · ${esc(lot.name)}${t ? ' · ' + esc(t.name) : ''}${e.eff ? ' · ' + e.eff + ' pers.' : ''}</small></span><b>${e.pct}%</b></div>`; }).join('') : '<div class="muted avp-pad">Aucune saisie sur la période</div>', false)}
    ${sec('mx', '📊 Total · matrice & planning', `${glob}%`, `<div class="avp-h2"><span class="avp-seg">${F.zone ? '' : `<button class="${F.by === 'zone' ? 'on' : ''}" data-by="zone">Zones</button>`}<button class="${F.by === 'niv' ? 'on' : ''}" data-by="niv">Niveaux</button>${locaux.some(l => l.ltype) ? `<button class="${F.by === 'type' ? 'on' : ''}" data-by="type">Types</button>` : ''}</span></div>
      <div class="avp-mxw"><table class="avp-mx"><tr><th></th><th class="avp-tc">Total</th>${lots.map(l => `<th style="--c:${l.color}">${esc(l.name)}</th>`).join('')}</tr>
      ${rows.map(r => `<tr><td class="avp-rh" data-row="${r.k}"${r.c ? ` style="box-shadow:inset 4px 0 0 ${r.c}"` : ''}><b>${esc(r.label)}</b><small>${esc(r.sub || '')} · ${r.L.length} pin(s)</small></td><td class="avp-tc"><b class="avp-tot">${avAvg(r.L, lots)}%</b></td>${lots.map(lot => { const s = avStats(r.L, lot.id), c = s.late ? '#ef4444' : s.pct === 100 ? '#22c55e' : lot.color;
        return `<td data-cell="${r.k}|${lot.id}"><div class="avp-cell" style="--p:${s.pct}%;--c:${c}"><b>${s.n ? s.pct + '%' : '—'}</b>${s.late ? `<i>${s.late}⚠</i>` : ''}</div></td>`; }).join('')}</tr>`).join('') || `<tr><td colspan="${lots.length + 2}" class="muted">Aucun niveau dans ce choix</td></tr>`}
      ${rows.length ? `<tr class="avp-totr"><td class="avp-rh"><b>TOTAL</b><small>${L.length} pin(s)</small></td><td class="avp-tc"><b class="avp-tot big">${glob}%</b></td>${lots.map(lot => `<td><div class="avp-cell" style="--p:${avAvg(L, [lot])}%;--c:${lot.color}"><b>${avAvg(L, [lot])}%</b></div></td>`).join('')}</tr>` : ''}</table></div>
      ${typeof avPlanningHTML === 'function' ? avPlanningHTML(p, N.filter(n => L.some(l => l.nivId === n.id) || (!F.zone && !F.sect && !F.lt && !F.eq)), L, lots, { noAlerts: true }) : ''}`, true)}
    <div class="avp-card avp-exp"><div class="avp-h">📤 Rapports <small class="muted">${esc(per.l)}</small></div><div class="avp-ex">
      <button data-x="pdf">${icon('pdf')}<span>PDF</span></button><button data-x="csv">${icon('sheet')}<span>Excel</span></button><button data-x="wa">${icon('share')}<span>WhatsApp</span></button><button data-x="plan">${icon('plans')}<span>Plans</span></button></div></div>
  </div>`;
  const redraw = () => { avSaveF(p, F); avProDash(root, p, nivs, locaux); };
  $$('[data-fk]', root).forEach(s => s.onchange = () => { const k = s.dataset.fk; F[k] = s.value; if (k === 'sect') { F.zone = ''; F.niv = ''; } if (k === 'zone' && F.niv && !locaux.some(l => l.nivId === F.niv && pz(l) === F.zone) && F.zone) F.niv = ''; if (k === 'pk' && s.value === 'custom' && !F.from) { F.from = avAddDays(todayISO(), -6); F.to = todayISO(); } redraw(); });
  const rs = $('[data-a=rst]', root); if (rs) rs.onclick = () => { Object.assign(F, { sect: '', zone: '', niv: '', lot: '', eq: '', lt: '', pk: 'week' }); redraw(); };
  $$('details.avp-sec', root).forEach(d => d.addEventListener('toggle', () => { try { localStorage.setItem('avsec.' + d.dataset.sec, d.open ? '1' : '0'); } catch (e) {} }));
  $$('[data-f]', root).forEach(b => b.onclick = () => { const [k, v] = b.dataset.f.split('|'); F[k] = v; redraw(); });
  $$('[data-ts]', root).forEach(b => b.onclick = () => { F.ts = b.dataset.ts; redraw(); });
  $$('[data-by]', root).forEach(b => b.onclick = () => { F.by = b.dataset.by; redraw(); });
  $$('[data-open]', root).forEach(b => b.onclick = () => { const [nid, lid] = b.dataset.open.split('|'); openAvViewer(nid, lid, () => renderAvancement(root.closest('#content') || root)); });
  $$('[data-team]', root).forEach(b => b.onclick = () => avTeamFiche(p, b.dataset.team, nivs, L, lots, per));
  $$('[data-row]', root).forEach(b => b.onclick = () => { const [t, id] = b.dataset.row.split(/:(.*)/s);
    if (t === 's') { F.sect = id; F.zone = ''; F.niv = ''; } else if (t === 'z') { F.zone = id; F.niv = ''; } else if (t === 't') F.lt = F.lt === id ? '' : id; else F.niv = F.niv === id ? '' : id; redraw(); });
  $$('[data-cell]', root).forEach(c => c.onclick = () => { const [rk, lid] = c.dataset.cell.split('|'), [t, id] = rk.split(/:(.*)/s);
    if (t === 's') { F.sect = id; F.lot = lid; redraw(); } else if (t === 'z') { F.zone = id; F.lot = lid; redraw(); } else if (t === 't') { F.lt = id; F.lot = lid; redraw(); } else openAvViewer(id, lid, () => renderAvancement(root.closest('#content') || root)); });
  const tb = $('[data-a=teams]', root); if (tb) tb.onclick = async () => { await avTeamsMenu(p); redraw(); };
  $$('[data-x]', root).forEach(b => b.onclick = () => avProExport(b.dataset.x, p, nivs, locaux));
  $$('[data-pl]', root).forEach(b => b.onclick = async () => { const [nid, lid] = b.dataset.pl.split('|'); if (await avPlanningEdit(p, nivs.find(n => n.id === nid), avLot(p, lid), nivs)) redraw(); });
  $$('[data-done]', root).forEach(b => b.onclick = async () => { const [nid, lid] = b.dataset.done.split('|'); const n = (p.avNiveaux || []).find(x => x.id === nid); if (n && await avLotDone(p, n, avLot(p, lid), true)) redraw(); });
}

// ---------- photos : classement (Photos du projet) ----------
// où est rangée chaque photo : pin / lot, réception, réserve, PV, rapport, photos en masse ; sinon « À classer »
async function phIndex(p) {
  const [links, recs, tasks, forms, reps] = await Promise.all(['links', 'receptions', 'tasks', 'forms', 'reports'].map(s => DB.byProject(s, p.id).catch(() => [])));
  const M = new Map(), put = (id, g) => { if (id && !M.has(id)) M.set(id, g); };
  const nivs = p.avNiveaux || [];
  for (const l of links) {
    if (l.kind === 'local') { const n = nivs.find(x => x.id === l.nivId), z = n ? avPinZone(p, l, n) : '';
      const g = (lotN) => ({ k: 'pin', z, niv: n ? n.name : '', nr: n ? avNivRank(n.name) : 99, lot: lotN, label: `${n ? n.name + ' · ' : ''}${l.name}`, sub: lotN, go: { pin: l.id, niv: l.nivId } });
      for (const [lid, r] of Object.entries(l.lots || {})) for (const id of r.photos || []) put(id, g(avLot(p, lid).name));
      for (const [eid, x] of Object.entries(l.etapes || {})) for (const id of x.photos || []) put(id, g(((avEtapes(p).find(e => e.id === eid)) || {}).name || 'Étape'));
      for (const e of l.journal || []) for (const id of e.photos || []) put(id, g(avLot(p, e.lot).name)); }
    else for (const id of l.photos || []) put(id, { k: 'pin', z: '', niv: '', nr: 99, lot: '', label: l.name || 'Élément du plan', sub: 'Plan', go: { link: l.id } });
  }
  for (const d of recs) for (const r of d.rows || []) for (const id of [...(r.photoIds || []), ...(r.anomIds || []), ...(r.retourIds || [])]) put(id, { k: 'rec', z: r.zone ? 'Zone ' + r.zone : '', niv: r.niv || '', nr: avNivRank(r.niv), lot: d.type === 'Bétonnage' ? 'Bétonnage' : 'Réception', label: `${r.niv ? r.niv + ' · ' : ''}${r.element || 'Ouvrage'}`, sub: `${d.type === 'Bétonnage' ? 'Bétonnage' : 'Réception'} · ${fmtDate(d.date)}`, go: { rec: d.id } });
  for (const t of tasks) for (const id of t.photoIds || []) put(id, { k: 'res', z: '', niv: '', nr: 99, lot: 'Réserves', label: `#${t.num || ''} ${t.title || 'Réserve'}`, sub: 'Réserve', go: { task: t.id } });
  for (const f of forms) for (const id of f.photoIds || []) put(id, { k: 'pv', z: '', niv: f.niv || '', nr: avNivRank(f.niv), lot: 'PV', label: f.title || 'PV', sub: `PV · ${fmtDate(f.date)}`, go: { form: f.id } });
  for (const r of reps) for (const id of r.photoIds || []) put(id, { k: 'rap', z: '', niv: '', nr: 99, lot: 'Rapports', label: `Rapport du ${fmtDate(r.date)}`, sub: 'Rapport journalier', go: { rep: r.id } });
  return M;
}
const phIsShot = (f) => /screenshot|capture|screen|scr_/i.test(f.name || '');
const phIsDoc = (f) => /\b(bon|bl|pv|plan|scan|doc|facture|devis|fiche)\b/i.test(String(f.name || '').replace(/[_\-.]/g, ' '));
async function renderPhotosV2(root) {
  const p = App.project, pid = p.id;
  const files = (await DB.byProject('files', pid)).filter(f => f.role === 'photo').sort((a, b) => b.createdAt - a.createdAt);
  const M = await phIndex(p), G = new Map(), todo = [];
  for (const f of files) {
    let g = M.get(f.id);
    if (!g && f.grp) { const gg = f.grp; g = { k: 'grp', z: '', niv: gg.niv || '', nr: avNivRank(gg.niv), lot: gg.lot || ({ rec: 'Réception', bet: 'Bétonnage', res: 'Réserves', rap: 'Rapports', ph: 'Photos' })[gg.dest] || '', label: `${gg.niv ? gg.niv + ' · ' : ''}${gg.ouv || ({ rec: 'Réception ferraillage', bet: 'Bétonnage', res: 'Réserves', rap: 'Rapports', lot: 'Lot & niveau', ph: 'Photos générales' })[gg.dest] || 'Photos'}`, sub: `${gg.lot ? gg.lot + ' · ' : ''}${fmtDate(gg.date)}` }; }
    if (!g && f.local) { const l = await DB.get('links', f.local); if (l) { const n = (p.avNiveaux || []).find(x => x.id === l.nivId); g = { k: 'pin', z: '', niv: n ? n.name : '', nr: n ? avNivRank(n.name) : 99, lot: f.lot ? avLot(p, f.lot).name : '', label: `${n ? n.name + ' · ' : ''}${l.name}`, sub: f.lot ? avLot(p, f.lot).name : '', go: { pin: l.id, niv: l.nivId } }; } }
    if (!g) { todo.push(f); continue; }
    const key = g.k + '|' + g.label + '|' + (g.sub || ''); if (!G.has(key)) G.set(key, { ...g, files: [] }); G.get(key).files.push(f);
  }
  const F = App.phF = App.phF || { niv: '', lot: '' };
  const groups = [...G.values()].filter(g => (!F.niv || g.niv === F.niv) && (!F.lot || g.lot === F.lot)).sort((a, b) => (a.nr - b.nr) || String(a.niv).localeCompare(String(b.niv), 'fr', { numeric: true }) || a.label.localeCompare(b.label, 'fr', { numeric: true }));
  const nivL = [...new Set([...G.values()].map(g => g.niv).filter(Boolean))].sort((a, b) => avNivRank(a) - avNivRank(b)), lotL = [...new Set([...G.values()].map(g => g.lot).filter(Boolean))];
  const th = (f) => `<div class="ph" data-id="${f.id}"><img src="${BlobURL.get(f.id, f.blob)}" loading="lazy">${phIsShot(f) ? '<span class="tag">📱 capture</span>' : phIsDoc(f) ? '<span class="tag">📄 document ?</span>' : ''}</div>`;
  let opened = {}; try { opened = JSON.parse(localStorage.getItem('ph.open.' + pid) || '{}'); } catch (e) {}
  const KE = { pin: '📍', rec: '🔩', res: '⚠️', pv: '📋', rap: '📝', grp: '🏗️' };
  root.innerHTML = `<div class="pagehead"><h2>Photos</h2><p>${files.length} photo(s) · classées par niveau, ouvrage et lot</p></div>
    ${nivL.length || lotL.length ? `<div class="avf-bar ph-f">${nivL.length ? `<label class="avf-s ${F.niv ? 'on' : ''}"><small>Niveau</small><select data-pf="niv"><option value="">Tous</option>${nivL.map(n => `<option ${n === F.niv ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>` : ''}${lotL.length ? `<label class="avf-s ${F.lot ? 'on' : ''}"><small>Lot / rubrique</small><select data-pf="lot"><option value="">Tous</option>${lotL.map(n => `<option ${n === F.lot ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>` : ''}</div>` : ''}
    ${todo.length ? `<details class="ph-g ph-todo" open><summary><span>📥</span><b>À classer</b><small>${todo.length}</small></summary>
      <p class="muted ph-help">Appui long sur une photo pour en choisir plusieurs, puis <b>Classer vers…</b> ou <b>Supprimer</b>.${todo.some(phIsShot) ? ' Les « captures » d\'écran peuvent sûrement être supprimées.' : ''}</p>
      <div class="ph-acts"><button class="btn small" data-a="classall">${icon('folder')} Classer vers…</button>${todo.some(phIsShot) ? '<button class="btn small danger" data-a="shots">Supprimer les captures</button>' : ''}</div>
      <div class="photo-grid">${todo.map(th).join('')}</div></details>` : ''}
    ${groups.map((g, i) => { const k = g.k + '|' + g.label + '|' + (g.sub || ''); return `<details class="ph-g" data-gk="${esc(k)}" ${opened[k] ? 'open' : ''}><summary><span>${KE[g.k] || '📷'}</span><span class="grow"><b>${esc(g.label)}</b><small>${esc(g.sub || '')}</small></span><small>${g.files.length}</small></summary>
      ${g.go ? `<button class="ph-go" data-go="${i}">Ouvrir ›</button>` : ''}<div class="photo-grid">${g.files.map(th).join('')}</div></details>`; }).join('')}
    ${!files.length ? '<div class="empty">Aucune photo.<br>Les photos se prennent dans chaque ouvrage, réception, réserve ou pin.</div>' : ''}`;
  const all = [...todo, ...groups.flatMap(g => g.files)];
  $$('[data-pf]', root).forEach(s => s.onchange = () => { F[s.dataset.pf] = s.value; renderPhotosV2(root); });
  $$('details.ph-g[data-gk]', root).forEach(d => d.addEventListener('toggle', () => { opened[d.dataset.gk] = d.open; try { localStorage.setItem('ph.open.' + pid, JSON.stringify(opened)); } catch (e) {} }));
  $$('.ph[data-id]', root).forEach(t => t.onclick = () => { const box = t.parentElement, L = [...box.querySelectorAll('.ph[data-id]')].map(x => all.find(f => f.id === x.dataset.id)).filter(Boolean);
    showGallery(L.map(f => ({ src: BlobURL.get(f.id, f.blob), caption: `${f.source || (M.get(f.id) || {}).label || 'Photo'} · ${fmtDateTime(f.createdAt)}`, fileId: f.id })), L.findIndex(f => f.id === t.dataset.id), { onDelete: async (it) => { const ok = await PhotoQ.remove([it.fileId], { ask: false }); if (ok) setTimeout(() => renderPhotosV2(root), 300); return ok; } }); });
  $$('[data-go]', root).forEach(b => b.onclick = async () => { const g = groups[+b.dataset.go].go;
    if (g.pin) { const l = await DB.get('links', g.pin); if (l) openAvViewer(l.nivId, null, () => renderPhotosV2(root), l.id); }
    else if (g.rec) { App.section = 'reception'; await renderSection(); const d = await DB.get('receptions', g.rec); if (d && typeof openReceptionDay === 'function') openReceptionDay(d); }
    else if (g.task) { const t = await DB.get('tasks', g.task); if (t) openTaskDetail(t); }
    else if (g.form) { const f = await DB.get('forms', g.form); if (f) openFormDetail(f); }
    else if (g.rep) { App.section = 'reports'; renderSection(); } });
  const selIds = () => [...root.querySelectorAll('.ph-todo .ph-sel')].map(x => x.dataset.id);
  const ca = $('[data-a=classall]', root); if (ca) ca.onclick = async () => { let ids = selIds(); if (!ids.length) ids = todo.map(f => f.id); if (await phClassify(p, ids)) { if (typeof PhotoQ !== 'undefined') PhotoQ.endSel(); renderPhotosV2(root); } };
  const sh = $('[data-a=shots]', root); if (sh) sh.onclick = async () => { if (await PhotoQ.remove(todo.filter(phIsShot).map(f => f.id))) renderPhotosV2(root); };
  // barre de sélection : ajoute « Classer vers… »
  const mo = new MutationObserver(() => { const bar = document.getElementById('selBar'); if (!bar || bar.querySelector('[data-a=cls]') || !root.isConnected) return;
    const b = document.createElement('button'); b.dataset.a = 'cls'; b.innerHTML = `${icon('folder')} Classer`; bar.insertBefore(b, bar.querySelector('[data-a=del]'));
    b.onclick = async () => { const ids = [...document.querySelectorAll('.ph-sel')].map(x => x.dataset.id); if (ids.length && await phClassify(p, ids)) { PhotoQ.endSel(); renderPhotosV2(root); } }; });
  if (window.__phMO) { window.__phMO.disconnect(); clearInterval(window.__phIV); }   // v1.0.48 : un seul observateur (avant : un de plus à chaque affichage)
  mo.observe(document.body, { childList: true }); window.__phMO = mo; const tok = root.querySelector('.pagehead');
  window.__phIV = setInterval(() => { if (!tok.isConnected) { mo.disconnect(); clearInterval(window.__phIV); window.__phMO = null; } }, 3000);
  fab(root, async () => { const v = await menu('Ajouter des photos', [{ label: '📍 Sur un pin / local technique', value: 'pin' }, { label: '🏗️ Photos en masse (ouvrage, niveau, rubrique)', value: 'batch' }]);
    if (v === 'batch') { await openPhotoBatch(p); renderPhotosV2(root); }
    if (v === 'pin') { const { locaux, nivs } = await avData(p); const loc = await avPickPin(p, nivs, locaux); if (!loc) return; const lid = await menu('Lot', avLotsOrdered(p).map(l => ({ label: l.name, swatch: l.color, value: l.id }))); if (!lid) return;
      const fs = await addPhotos(pid, { local: loc.id, lot: lid, source: `${loc.name} · ${avLot(p, lid).name}` }); if (fs.length) { const L2 = await DB.get('links', loc.id); L2.lots = L2.lots || {}; const r = L2.lots[lid] = L2.lots[lid] || { state: 'todo', photos: [] }; r.photos = [...(r.photos || []), ...fs.map(f => f.id)]; await DB.put('links', L2); renderPhotosV2(root); } } });
}
// classer des photos : pin + lot (avancement), ouvrage (niveau, rubrique), réserve
async function phClassify(p, ids) {
  const v = await menu(`Classer ${ids.length} photo(s) vers…`, [{ label: '📍 Pin / local technique (avancement)', value: 'pin' }, { label: '🏗️ Partie d\'ouvrage (niveau, ouvrage, rubrique)', value: 'ouv' }, { label: '⚠️ Une réserve', value: 'res' }]);
  if (!v) return false;
  const files = (await Promise.all(ids.map(id => DB.get('files', id)))).filter(Boolean);
  const strip = async () => { for (const f of files) { delete f.grp; delete f.local; delete f.lot; } };
  if (v === 'pin') {
    const { locaux, nivs } = await avData(p); const loc = await avPickPin(p, nivs, locaux); if (!loc) return false;
    const lid = await menu('Lot', avLotsOrdered(p).map(l => ({ label: l.name, swatch: l.color, value: l.id }))); if (!lid) return false;
    const L = await DB.get('links', loc.id); L.lots = L.lots || {}; const r = L.lots[lid] = L.lots[lid] || { state: 'todo', photos: [] }; r.photos = [...new Set([...(r.photos || []), ...ids])];
    await DB.put('links', L); await strip(); for (const f of files) { f.local = loc.id; f.lot = lid; f.source = `${loc.name} · ${avLot(p, lid).name}`; await DB.put('files', f); }
    toast(`${ids.length} photo(s) classée(s) dans ${loc.name} ✓`, { action: 'Mettre à jour l\'avancement', ms: 7000, onAction: async () => { const L2 = await DB.get('links', loc.id); await avJourForm(p, L2, { lot: lid }); } });
    return true;
  }
  if (v === 'ouv') {
    const lots = typeof lsLots === 'function' ? lsLots(p) : [], nv = typeof lsNiv === 'function' ? lsNiv(p) : (p.avNiveaux || []).map(n => n.name);
    const r = await formSheet('🏗️ Partie d\'ouvrage', [{ name: 'dest', label: 'Rubrique', type: 'select', value: 'rec', options: PB_DEST.map(([x, l]) => ({ value: x, label: l })) },
      ...(lots.length ? [{ name: 'lot', label: 'Lot', type: 'select', value: '', options: [{ value: '', label: '—' }, ...lots.map(l => ({ value: l.id, label: l.name }))] }] : []),
      { name: 'niv', label: 'Niveau', list: nv, placeholder: 'Ex : RDC' }, { name: 'ouv', label: 'Ouvrage / élément', placeholder: 'Ex : Voile V12, Plancher R+1' }, { name: 'date', label: 'Date', type: 'date', value: todayISO() }], { okLabel: 'Classer' });
    if (!r) return false; const lot = lots.find(l => l.id === r.lot);
    for (const f of files) { await strip(); f.grp = { dest: r.dest, lot: lot ? lot.name : '', niv: (r.niv || '').trim(), ouv: (r.ouv || '').trim(), date: r.date || todayISO() }; f.source = [f.grp.niv, f.grp.ouv].filter(Boolean).join(' · ') || f.source; await DB.put('files', f); }
    toast(`${ids.length} photo(s) classée(s) ✓`); return true;
  }
  if (v === 'res') {
    const T = (await DB.byProject('tasks', p.id)).filter(t => typeof isLifted !== 'function' || !isLifted(t)).sort((a, b) => (b.num || 0) - (a.num || 0));
    const id = await menu('Réserve', T.slice(0, 60).map(t => ({ label: `#${t.num || ''} ${t.title || ''}`, value: t.id }))); const t = T.find(x => x.id === id); if (!t) return false;
    t.photoIds = [...new Set([...(t.photoIds || []), ...ids])]; await DB.put('tasks', t); await strip(); for (const f of files) await DB.put('files', f);
    toast(`${ids.length} photo(s) ajoutée(s) à la réserve #${t.num || ''} ✓`); return true;
  }
  return false;
}

// ---------- rapport journalier : texte de l'avancement du jour ----------
async function avDayText(p, day) {
  const { locaux, nivs } = await avData(p);
  const E = locaux.flatMap(l => (l.journal || []).filter(e => e.d === day).map(e => ({ e, l, n: nivs.find(n => n.id === l.nivId) }))).filter(x => x.n);
  if (!E.length) return '';
  const T = {}; for (const x of E) if (x.e.eq) T[x.e.eq] = Math.max(T[x.e.eq] || 0, +x.e.eff || 0);
  return `Avancement du ${fmtDate(day)} :\n` + avNivSorted(p, [...new Set(E.map(x => x.n))]).map(n => `${n.name} : ` + E.filter(x => x.n === n).map(({ e, l }) => `${l.name} ${avLot(p, e.lot).name} ${e.prev != null ? e.prev + '→' : ''}${e.pct}%`).join(', ')).join('\n')
    + (Object.keys(T).length ? `\nÉquipes : ${Object.entries(T).map(([id, n]) => `${(avTeam(p, id) || {}).name || '?'}${n ? ' (' + n + ' pers.)' : ''}`).join(', ')}` : '');
}
// réception / PV reçu → le lot du local passe à 100 % (si le local est retrouvé : niveau + nom de l'ouvrage)
async function avFromReception(p, row, type, day) {
  try {
    if (!p || !row || !row.element || !(p.avNiveaux || []).length) return;
    const lot = avLots(p).find(l => type === 'Bétonnage' || type === 'Ferraillage' ? /gros/i.test(l.name) : normQ(type || '').includes(normQ(l.name))); if (!lot) return;
    const n = (p.avNiveaux || []).find(x => row.niv && avNivKey(x.name) === avNivKey(row.niv)); if (!n) return;
    const el = normQ(row.element), loc = (await DB.byProject('links', p.id)).find(l => l.kind === 'local' && l.nivId === n.id && normQ(l.name).length >= 3 && el.includes(normQ(l.name)));
    if (!loc || avPctAt(loc, lot.id, day || todayISO()) >= 100) return;
    avEntryOn(p, loc, { d: day || todayISO(), lot: lot.id, pct: 100, note: `PV ${type || ''} reçu`, src: 'pv' }); await DB.put('links', loc); await DB.put('projects', p);
    toast(`📊 ${n.name} · ${loc.name} · ${lot.name} → 100 % (PV reçu)`);
  } catch (e) { console.warn('av pv', e); }
}

