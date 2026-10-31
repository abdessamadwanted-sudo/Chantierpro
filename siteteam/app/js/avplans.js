// ================= v1.0.46 — Avancement : secteurs → zones (joints) dessinées sur le plan, import automatique des locaux du PDF,
// types de local (code couleur des plant rooms), plusieurs plans par niveau (archi, ANEP, chape…), calque numérotation ANEP, comparaison.
// Exemple : Grand Stade — secteurs Nord / Ouest…, chaque secteur découpé par les joints (JD01 → JD02 = Zone 1 / Joint 1…).

const AVP_LTYPES = [['Disponible', '#e879f9'], ['Électrique', '#facc15'], ['Technologie', '#22d3ee'], ['Mécanique', '#6366f1'], ['Plomberie (public health)', '#4ade80'], ['Riser / gaine', '#f97316'], ['Wet room', '#1d4ed8']];
const avLocTypes = (p) => { if (!Array.isArray(p.locTypes) || !p.locTypes.length) p.locTypes = AVP_LTYPES.map(([n, c]) => ({ id: DB.uid(), name: n, color: c })); return p.locTypes; };
const avSecteurs = (p) => { if (!Array.isArray(p.avSecteurs)) p.avSecteurs = []; return p.avSecteurs; };
// secteur d'une zone (Nord, Ouest…) — p.avZoneSect = { 'Zone 1': 'Nord', … }
const avSectOf = (p, zone) => (p.avZoneSect || {})[zone] || '';
// zone d'un pin : celle du pin (dessinée sur le plan), sinon celle du niveau
const avPinZone = (p, loc, niv) => (loc && loc.zone && avZones(p).includes(loc.zone)) ? loc.zone : avZoneOf(p, niv);
const avInPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) c = !c; } return c; };
function avZoneAt(niv, x, y) { for (const z of (niv && niv.zonePolys) || []) if (avInPoly(x, y, z.pts)) return z.zone; return null; }
async function avAssignZones(p, niv) {
  const L = (await DB.byProject('links', p.id)).filter(l => l.kind === 'local' && l.nivId === niv.id); let n = 0;
  for (const l of L) { const z = avZoneAt(niv, l.x, l.y); if (z && l.zone !== z) { l.zone = z; await DB.put('links', l); n++; } }
  return n;
}
// secteurs : liste + rattachement des zones
async function avSecteursEdit(p) {
  for (;;) {
    const v = await menu('Secteurs (Nord, Ouest…) et leurs zones', [
      ...avSecteurs(p).map(s => ({ label: `${s} — ${avZones(p).filter(z => avSectOf(p, z) === s).join(', ') || 'aucune zone'}`, icon: 'layers', value: 's:' + s })),
      { label: 'Ajouter un secteur', icon: 'plus', value: '__add' }, { label: 'Zones (joints)…', icon: 'edit', value: '__zones' }]);
    if (!v) break;
    if (v === '__zones') { await avListEdit(p, 'zone'); continue; }
    if (v === '__add') { const r = await formSheet('Nouveau secteur', [{ name: 'n', label: 'Nom', placeholder: 'Ex : Nord, Ouest, Tribune Est…', list: ['Nord', 'Sud', 'Est', 'Ouest', 'Nord-Est', 'Nord-Ouest', 'Sud-Est', 'Sud-Ouest'] }], { okLabel: 'Ajouter' }); if (r && r.n && !avSecteurs(p).includes(r.n.trim())) avSecteurs(p).push(r.n.trim()); continue; }
    const s = v.slice(2), a = await menu(s, [{ label: 'Zones de ce secteur', icon: 'check', value: 'zones' }, { label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Supprimer', icon: 'trash', danger: true, value: 'del' }]);
    if (a === 'zones') { for (;;) { const z = await menu(`${s} — zones`, [...avZones(p).map(z => ({ label: z + (avSectOf(p, z) && avSectOf(p, z) !== s ? ` (${avSectOf(p, z)})` : ''), value: z, checked: avSectOf(p, z) === s })), { label: '✓ Terminé', value: '__ok' }]); if (!z || z === '__ok') break; p.avZoneSect = p.avZoneSect || {}; p.avZoneSect[z] = avSectOf(p, z) === s ? '' : s; } }
    if (a === 'ren') { const r = await formSheet('Renommer le secteur', [{ name: 'n', label: 'Nom', value: s }]); if (r && r.n) { p.avSecteurs = avSecteurs(p).map(x => x === s ? r.n.trim() : x); for (const z in (p.avZoneSect || {})) if (p.avZoneSect[z] === s) p.avZoneSect[z] = r.n.trim(); } }
    if (a === 'del') { p.avSecteurs = avSecteurs(p).filter(x => x !== s); for (const z in (p.avZoneSect || {})) if (p.avZoneSect[z] === s) p.avZoneSect[z] = ''; }
  }
  await DB.put('projects', p);
}

// ---------- plusieurs plans par niveau ----------
// niv.plans = [{ id, serieId, label, kind }] (en plus du plan principal niv.serieId = plan architecte) ; niv.lotPlan = { lotId: id }
const AVP_PKINDS = [['archi', 'Architecte'], ['anep', 'Numérotation ANEP'], ['chape', 'Chape'], ['maconnerie', 'Maçonnerie'], ['autre', 'Autre']];
// v1.0.48 : la liste des plans du projet est lue une seule fois (avant : une lecture complète par plan et par niveau)
let _avPlC = null;
async function avAllPlans(pid) { if (_avPlC && _avPlC.pid === pid && Date.now() - _avPlC.t < 3000) return _avPlC.L; const L = await DB.byProject('plans', pid); _avPlC = { pid, t: Date.now(), L }; return L; }
try { const _P = DB.put.bind(DB), _D = DB.del.bind(DB); DB.put = (st, o) => { if (st === 'plans') _avPlC = null; return _P(st, o); }; DB.del = (st, id) => { if (st === 'plans') _avPlC = null; return _D(st, id); }; } catch (e) {}
async function avNivPlans(p, niv) {
  const all = await avAllPlans(p.id);
  const base = await latestPlanOfSerie(p.id, niv.serieId, all), out = base ? [{ id: 'main', serieId: niv.serieId, label: 'Architecte', kind: 'archi', plan: base }] : [];
  for (const x of niv.plans || []) { const pl = await latestPlanOfSerie(p.id, x.serieId, all); if (pl) out.push({ ...x, plan: pl }); }
  return out;
}
async function avNivPlansMenu(p, niv) {
  avLots(p);
  for (;;) {
    const L = await avNivPlans(p, niv);
    const v = await menu(`${niv.name} — plans`, [...L.map(x => ({ label: `${x.label} · ${x.plan.name}${Object.entries(niv.lotPlan || {}).filter(([, id]) => id === x.id).map(([lid]) => ' · ' + avLot(p, lid).name).join('')}`, icon: 'plans', value: x.id })),
      { label: 'Ajouter un plan (ANEP, chape, maçonnerie…)', icon: 'plus', value: '__add' }]);
    if (!v) break;
    if (v === '__add') {
      const pl = await avPickOrImportPlan(p, 'Plan à ajouter au niveau'); if (!pl) continue;
      const r = await formSheet('Type de plan', [{ name: 'kind', label: 'Type', type: 'select', value: 'anep', options: AVP_PKINDS.map(([k, l]) => ({ value: k, label: l })) }, { name: 'label', label: 'Nom affiché', value: '', placeholder: 'Ex : Chape architecte, Chape exécution' }], { okLabel: 'Ajouter' });
      if (!r) continue; niv.plans = niv.plans || []; niv.plans.push({ id: DB.uid(), serieId: planSerie(pl), kind: r.kind, label: r.label || (AVP_PKINDS.find(k => k[0] === r.kind) || [])[1] || 'Plan' });
      await DB.put('projects', p); continue;
    }
    const x = L.find(z => z.id === v); if (!x) continue;
    const a = await menu(x.label, [{ label: 'Plan affiché pour un lot…', icon: 'layers', value: 'lot' }, ...(x.id !== 'main' ? [{ label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Retirer du niveau', icon: 'trash', danger: true, value: 'del' }] : [])]);
    if (a === 'lot') { const lid = await menu('Pour quel lot ?', avLots(p).map(l => ({ label: l.name, swatch: l.color, value: l.id, checked: (niv.lotPlan || {})[l.id] === x.id }))); if (lid) { niv.lotPlan = niv.lotPlan || {}; if (niv.lotPlan[lid] === x.id || x.id === 'main') delete niv.lotPlan[lid]; else niv.lotPlan[lid] = x.id; } }
    if (a === 'ren') { const r = await formSheet('Renommer', [{ name: 'n', label: 'Nom', value: x.label }]); if (r && r.n) niv.plans.find(z => z.id === x.id).label = r.n; }
    if (a === 'del') { niv.plans = niv.plans.filter(z => z.id !== x.id); for (const k in niv.lotPlan || {}) if (niv.lotPlan[k] === x.id) delete niv.lotPlan[k]; }
    await DB.put('projects', p);
  }
}

// ---------- textes du PDF → blocs (étiquettes de locaux) ----------
function avTextBlocks(T) {
  T = (T || []).slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const t of T) { const l = lines.find(L => Math.abs(L.y - t.y) < Math.max(L.h, t.h) * 0.45 && t.x - (L.x + L.w) < Math.max(L.h, t.h) * 1.1 && t.x + t.w > L.x - L.h);
    if (l) { const x2 = Math.max(l.x + l.w, t.x + t.w); l.s += (t.x > l.x + l.w - 1 ? ' ' : '') + t.s; l.x = Math.min(l.x, t.x); l.w = x2 - l.x; l.h = Math.max(l.h, t.h); }
    else lines.push({ s: t.s, x: t.x, y: t.y, w: t.w, h: t.h }); }
  lines.forEach(l => { l.s = l.s.replace(/\s+/g, ' ').trim(); l.cx = l.x + l.w / 2; });
  const blocks = [];
  for (const l of lines.sort((a, b) => a.y - b.y)) {
    const b = blocks.find(B => { const last = B.L[B.L.length - 1]; return l.y - last.y > 0 && l.y - last.y < Math.max(last.h, l.h) * 2.1 && Math.abs(l.cx - last.cx) < Math.max(last.w, l.w) * 0.75 + l.h; });
    if (b) b.L.push(l); else blocks.push({ L: [l] });
  }
  return blocks.map(B => { const xs = B.L.map(l => l.x), xe = B.L.map(l => l.x + l.w), ys = B.L.map(l => l.y - l.h), ye = B.L.map(l => l.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xe), y0 = Math.min(...ys), y1 = Math.max(...ye);
    const area = (B.L.map(l => l.s).join(' ').match(/(\d+(?:[.,]\d+)?)\s*m[²2]/i) || [])[1];
    const name = B.L.map(l => l.s).filter(s => !/^\d+(?:[.,]\d+)?\s*m[²2]$/i.test(s)).join(' · ');
    return { name, area: area ? area.replace(',', '.') : '', x: (x0 + x1) / 2, y: (y0 + y1) / 2, h: B.L[0].h, key: avKeyOf(B.L[0].s) }; }).filter(b => b.name);
}
// famille d'une étiquette : « CORE 01 » → CORE, « RISER LT » → RISER LT, « LIFT C33-L1 » → LIFT
const avKeyOf = (s) => String(s).toUpperCase().replace(/\b[A-Z]?\d+[A-Z\d.\-]*\b/g, ' ').replace(/[^A-ZÀ-Ü ]+/g, ' ').replace(/\s+/g, ' ').trim();
const AVP_KEEP = /CORE|RISER|LOCAL|\bLT\b|ELEC|TGBT|TGB|HVAC|CTA|SAS|GAINE|TECH|\bPH\b|PLOMB|SPRINK|SSI|ONDUL|TRANSFO|POMPE|VENTIL|CLIM|TELECOM|COURANT/;
async function avImportLocaux(p, niv, plan) {
  const ld = loading('Lecture des textes du plan…'); let T = null;
  try { T = await planTexts(plan); } catch (e) { console.warn(e); } finally { ld.close(); }
  if (!T || !T.length) return alertBox('Ce plan n\'a pas de texte lisible (PDF scanné ou image). Placez les locaux à la main.');
  const B = avTextBlocks(T), fam = {};
  for (const b of B) { if (!b.key || b.key.length < 2 || b.key.split(' ').every(w => w.length < 2) || /^(M|M²|DE|LA|LE|ET|DES|DU|ET|A|B|C|D|JD|AXE|DATE|ECHELLE|ÉCHELLE|INDICE|PLAN|NIVEAU)$/.test(b.key)) continue; (fam[b.key] = fam[b.key] || []).push(b); }
  const F = Object.entries(fam).filter(([, L]) => L.length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 30);
  if (!F.length) return alertBox('Aucun groupe d\'étiquettes répétées trouvé sur ce plan.');
  const types = avLocTypes(p), tOf = (re) => (types.find(t => re.test(t.name)) || {}).id || '';
  // type deviné d'après l'étiquette : RISER / GAINE → riser, HVAC → mécanique, PH → plomberie, ELEC / TGBT → électrique, TECH / TELECOM → technologie
  const guessType = (k) => { k = String(k).toUpperCase(); return /RISER|GAINE/.test(k) ? tOf(/riser|gaine/i) : /HVAC|CTA|MECA|VENTIL|CLIM/.test(k) ? tOf(/canique/i) : /\bPH\b|PLOMB|SANIT/.test(k) ? tOf(/plomb/i) : /ELEC|TGBT|\bTR\b|TRANSFO/.test(k) ? tOf(/lectr/i) : /TECH|TELECOM|COURANT/.test(k) ? tOf(/techno/i) : ''; };
  const sel = await new Promise((resolve) => {
    let out = null;
    const s = sheet(`<div class="avi"><p class="muted">Étiquettes trouvées sur « ${esc(plan.name)} ». Cochez les familles à placer comme pins (nom et surface repris du plan).</p>
      ${F.map(([k, L], i) => `<label class="avi-r"><input type="checkbox" data-i="${i}" ${AVP_KEEP.test(k) ? 'checked' : ''}><span class="grow"><b>${esc(k)}</b><small>${L.length} · ex : ${esc(L.slice(0, 3).map(b => b.name).join(' / ')).slice(0, 90)}</small></span>
        <select data-t="${i}"><option value="">Type…</option>${types.map(t => `<option value="${t.id}" ${guessType(k) === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>`).join('')}
      <button class="btn" data-a="go">Placer les locaux</button></div>`, { title: '📥 Importer les locaux du plan' });
    $('[data-a=go]', s.el).onclick = () => { out = F.map(([k, L], i) => ({ k, L, on: $(`[data-i="${i}"]`, s.el).checked, t: $(`[data-t="${i}"]`, s.el).value })).filter(x => x.on); s.close(); };
    s.onClose = () => resolve(out);
  });
  if (!sel || !sel.length) return 0;
  const ex = (await DB.byProject('links', p.id)).filter(l => l.kind === 'local' && l.nivId === niv.id); let n = 0;
  const ld2 = loading('Placement des locaux…');
  try {
    for (const g of sel) for (const b of g.L) {
      if (ex.some(l => l.name === b.name && Math.hypot(l.x - b.x, l.y - b.y) < Math.max(40, b.h * 4))) continue;
      const loc = { projectId: p.id, planId: plan.id, nivId: niv.id, kind: 'local', shape: 'point', x: Math.round(b.x), y: Math.round(b.y), name: b.name.slice(0, 60), lots: {}, items: [], src: 'pdf', ...(b.area ? { area: b.area } : {}), ...((g.t || guessType(b.name)) ? { ltype: g.t || guessType(b.name) } : {}) };
      const z = avZoneAt(niv, loc.x, loc.y); if (z) loc.zone = z;
      await DB.put('links', loc); ex.push(loc); n++;
    }
  } finally { ld2.close(); }
  await DB.put('projects', p); toast(`${n} local(aux) placé(s) ✓`);
  return n;
}

// ---------- calque « numérotation ANEP » sur le plan architecte ----------
const _anepCache = new Map();
async function avAnepLabels(p, niv, basePlan) {
  const A = (niv.plans || []).find(x => x.kind === 'anep'); if (!A) return null;
  const ap = await latestPlanOfSerie(p.id, A.serieId); if (!ap) return null;
  const C = await avPairMatrix(p, niv, { serieId: niv.serieId, plan: basePlan }, { serieId: A.serieId, plan: ap }), m = C.m, ks = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  const key = ap.id + '>' + basePlan.id + JSON.stringify(m); if (_anepCache.has(key)) return _anepCache.get(key);
  const [TA, TB] = await Promise.all([planTexts(ap), planTexts(basePlan)]), M = { sx: ks, sy: ks };
  if (!TA) { _anepCache.set(key, []); return []; }
  const base = TB || [], out = [];
  for (const t of TA) {   // seulement ce que l'ANEP ajoute (sa numérotation) : les textes communs avec l'architecte sont ignorés
    const [x, y] = avApply(m, t.x, t.y), tol = Math.max(8, t.h * M.sy * 1.2);
    if (base.some(b => b.s === t.s && Math.abs(b.x - x) < tol && Math.abs(b.y - y) < tol)) continue;
    out.push({ s: t.s, x: x + t.w * M.sx / 2, y: y - t.h * M.sy / 2, h: t.h * M.sy });
  }
  _anepCache.set(key, out); return out;
}
// donner aux pins le numéro ANEP le plus proche
async function avAnepToPins(p, niv, basePlan) {
  const L = await avAnepLabels(p, niv, basePlan); if (!L || !L.length) return toast('Ajoutez d\'abord le plan ANEP du niveau (Plans du niveau › Ajouter › Numérotation ANEP)');
  const pins = (await DB.byProject('links', p.id)).filter(l => l.kind === 'local' && l.nivId === niv.id); let n = 0;
  for (const l of pins) { let best = null, bd = 1e9; for (const t of L) { const d = Math.hypot(t.x - l.x, t.y - l.y); if (d < bd) { bd = d; best = t; } }
    if (best && bd < Math.max(80, best.h * 8) && l.anep !== best.s) { l.anep = best.s; await DB.put('links', l); n++; } }
  toast(`${n} pin(s) numéroté(s) ANEP ✓`);
}

// ---------- calage entre deux plans : automatique (textes communs : axes, joints…) ou manuel (2 points) ----------
// matrice {a,b,c,d,e,f} : pixel du plan B → pixel du plan A ; le calage manuel est gardé par niveau (niv.cal)
const avMat = (M) => ({ a: M.sx, b: 0, c: 0, d: M.sy, e: M.ox, f: M.oy });
const avApply = (m, x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
const avInv = (m) => { const det = m.a * m.d - m.b * m.c || 1e-9; return { a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det, e: (m.c * m.f - m.d * m.e) / det, f: (m.b * m.e - m.a * m.f) / det }; };
// similitude (échelle + rotation + translation) qui envoie b1→a1 et b2→a2
function avSim(b1, b2, a1, a2) {
  const vb = [b2[0] - b1[0], b2[1] - b1[1]], va = [a2[0] - a1[0], a2[1] - a1[1]], nb = vb[0] ** 2 + vb[1] ** 2 || 1e-9;
  const k = (va[0] * vb[0] + va[1] * vb[1]) / nb, r = (va[1] * vb[0] - va[0] * vb[1]) / nb;   // k = s·cosθ, r = s·sinθ
  return { a: k, b: r, c: -r, d: k, e: a1[0] - (k * b1[0] - r * b1[1]), f: a1[1] - (r * b1[0] + k * b1[1]) };
}
async function avPairMatrix(p, niv, A, B) {
  const key = A.serieId + '>' + B.serieId, man = (niv.cal || {})[key];
  if (man) return { m: man, manual: true };
  return { m: avMat(await planAlignMap(B.plan, A.plan)), manual: false };
}
// plan d'un lot sur un niveau (plan attribué au lot, sinon le plan architecte)
async function avLotPlan(p, niv, lotId) { const L = await avNivPlans(p, niv), id = (niv.lotPlan || {})[lotId]; return L.find(x => x.id === id) || L[0]; }

// ---------- comparer deux plans du même niveau : rideau / transparence / clignotement, calage auto + manuel ----------
async function avComparePlans(p, niv, preA, preB) {
  const L = await avNivPlans(p, niv); if (L.length < 2 && !(preA && preB)) return toast('Ajoutez au moins un 2e plan à ce niveau (Plans du niveau › Ajouter)');
  const lotsOf = (x) => Object.entries(niv.lotPlan || {}).filter(([, id]) => id === x.id).map(([lid]) => avLot(p, lid).name).join(', ');
  const pick = async (t, ex) => { const id = await menu(t, L.filter(x => x.id !== ex).map(x => ({ label: `${x.label}${lotsOf(x) ? ' (' + lotsOf(x) + ')' : ''} · ${x.plan.name}`, icon: 'plans', value: x.id }))); return L.find(x => x.id === id); };
  const A = preA || await pick('Plan de base', null); if (!A) return; const Bx = preB || await pick('Comparer avec', A.id); if (!Bx) return;
  if (A.serieId === Bx.serieId) return toast('Les deux lots utilisent le même plan : attribuez un plan à chaque lot (Plans du niveau › plan › « Plan affiché pour un lot »)');
  const ld = loading('Calage des deux plans…'); let C;
  try { C = await avPairMatrix(p, niv, A, Bx); } finally { ld.close(); }
  const el = document.createElement('div'); el.className = 'fullpage av-page avc-page'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  const lite = (id) => typeof avLiteURL === 'function' ? avLiteURL(id, 3000) : fileURL(id);   // v1.0.47 : images allégées → comparaison rapide même en A0
  const [sa, sb] = await Promise.all([lite(A.plan.fileId), lite(Bx.plan.fileId)]), W = A.plan.w, H = A.plan.h;
  let mode = 'rideau', v = 50, cal = null;   // cal = { pts: [[b,a],…], step }
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title" style="flex:1"><b>${esc(niv.name)} — comparaison</b><span>${esc(A.label)} ↔ ${esc(Bx.label)}</span></div><button class="iconbtn" data-a="cal" title="Calage">${icon('move')}</button></div>
    <div class="av-view"><div class="av-stage avc-stage"><img class="avc-a" src="${sa}" width="${W}" height="${H}"><div class="avc-b"><img src="${sb}" width="${Bx.plan.w}" height="${Bx.plan.h}" style="position:absolute;left:0;top:0;transform-origin:0 0"></div><i class="avc-line"></i><svg class="avc-ov" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"></svg></div><div class="av-hint"></div></div>
    <div class="avc-bar"><div class="avp-seg">${[['rideau', 'Rideau'], ['trans', 'Transparence'], ['blink', 'Clignoter']].map(([k, l]) => `<button data-m="${k}" class="${k === mode ? 'on' : ''}">${l}</button>`).join('')}</div><input type="range" min="0" max="100" value="${v}" data-a="v"><small class="avc-lab"><b>${esc(A.label)}</b><span class="avc-cs">${C.manual ? 'calage manuel' : 'calage automatique'}</span><b>${esc(Bx.label)}</b></small></div>`;
  const bx = $('.avc-b', el), bim = $('img', bx), aim = $('.avc-a', el), line = $('.avc-line', el), stage = $('.avc-stage', el), hint = $('.av-hint', el), ov = $('.avc-ov', el);
  const setM = () => { const m = C.m; bim.style.transform = `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`; $('.avc-cs', el).textContent = C.manual ? 'calage manuel' : 'calage automatique'; };
  let blinkT = null;
  const apply = () => { clearInterval(blinkT); bx.style.opacity = 1; bx.style.clipPath = ''; line.style.display = 'none'; aim.style.visibility = 'visible'; bx.style.visibility = 'visible';
    if (cal) { const st2 = cal.done.length, onB = cal.step === 'b'; aim.style.visibility = onB ? 'hidden' : 'visible'; bx.style.visibility = onB ? 'visible' : 'hidden';
      hint.textContent = `Calage manuel — point ${st2 + 1}/2 : touchez ${onB ? `le même point sur « ${Bx.label} »` : `un repère net sur « ${A.label} » (croisement d'axes, angle de poteau…)`}`; hint.style.display = '';
      ov.innerHTML = cal.done.map(([, q]) => `<circle cx="${q[0]}" cy="${q[1]}" r="${10 / pz.st.s}" fill="none" stroke="#ef4444" stroke-width="${3 / pz.st.s}"/>`).join('') + (cal.a ? `<circle cx="${cal.a[0]}" cy="${cal.a[1]}" r="${10 / pz.st.s}" fill="#ef4444" fill-opacity=".4"/>` : ''); return; }
    hint.style.display = 'none'; ov.innerHTML = '';
    if (mode === 'rideau') { bx.style.clipPath = `inset(0 0 0 ${v}%)`; line.style.display = 'block'; line.style.left = (W * v / 100) + 'px'; }
    if (mode === 'trans') bx.style.opacity = v / 100;
    if (mode === 'blink') { let on = true; blinkT = setInterval(() => { on = !on; bx.style.opacity = on ? 1 : 0; }, 700); } };
  const onTap = async ([x, y]) => {
    if (!cal) return;
    if (cal.step === 'a') { cal.a = [x, y]; cal.step = 'b'; return apply(); }
    const bpt = avApply(avInv(C.m), x, y); cal.done.push([bpt, cal.a]); cal.a = null; cal.step = 'a';
    if (cal.done.length === 2) { const [[b1, a1], [b2, a2]] = cal.done; C = { m: avSim(b1, b2, a1, a2), manual: true }; niv.cal = niv.cal || {}; niv.cal[A.serieId + '>' + Bx.serieId] = C.m; await DB.put('projects', p); cal = null; setM(); toast('Calage manuel enregistré ✓'); }
    apply();
  };
  const pz = panZoom($('.av-view', el), stage, W, H, { onTap, onChange: () => { if (cal) apply(); } }); requestAnimationFrame(() => pz.fit());
  $('[data-a=x]', el).onclick = () => { clearInterval(blinkT); unBack(); el.remove(); };
  $('[data-a=v]', el).oninput = (e) => { v = +e.target.value; apply(); };
  $$('[data-m]', el).forEach(b => b.onclick = () => { mode = b.dataset.m; $$('[data-m]', el).forEach(x => x.classList.toggle('on', x === b)); apply(); });
  $('[data-a=cal]', el).onclick = async () => { const w = await menu('Calage des deux plans', [{ label: 'Caler à la main (2 points)', icon: 'move', value: 'man' }, { label: 'Calage automatique (textes communs)', icon: 'undo', value: 'auto' }]);
    if (w === 'man') { cal = { step: 'a', done: [], a: null }; apply(); }
    if (w === 'auto') { if (niv.cal) { delete niv.cal[A.serieId + '>' + Bx.serieId]; await DB.put('projects', p); } const ld2 = loading('Calage automatique…'); try { C = { m: avMat(await planAlignMap(Bx.plan, A.plan)), manual: false }; } finally { ld2.close(); } setM(); apply(); } };
  Object.assign(bx.style, { position: 'absolute', left: 0, top: 0, width: W + 'px', height: H + 'px', overflow: 'hidden' });
  setM(); apply();
  return el;
}
// comparer les plans de deux lots du même niveau (ex : gros œuvre ↔ enduit)
async function avCompareLots(p, niv) {
  const lots = avLots(p); const a = await menu('Lot de base', lots.map(l => ({ label: l.name, swatch: l.color, value: l.id }))); if (!a) return;
  const b = await menu('Comparer avec le lot', lots.filter(l => l.id !== a).map(l => ({ label: l.name, swatch: l.color, value: l.id }))); if (!b) return;
  const [A, B] = await Promise.all([avLotPlan(p, niv, a), avLotPlan(p, niv, b)]);
  return avComparePlans(p, niv, { ...A, label: avLot(p, a).name }, { ...B, label: avLot(p, b).name });
}

// ---------- planning des lots : dates prévues par niveau, réel, prévision, alertes ----------
// p.avPlan = { 'nivId|lotId': { deb, fin } } ; réel = 1re saisie > 0 % → dernier pin terminé ; prévision au rythme constaté
function avLotPlanning(p, niv, lot, locs) {
  const P = ((p.avPlan || {})[niv.id + '|' + lot.id]) || {}, today = todayISO(), s = avStats(locs, lot.id);
  const J = locs.flatMap(l => (l.journal || []).filter(e => e.lot === lot.id && +e.pct > 0)).map(e => e.d).sort();
  const dones = locs.map(l => (l.lots || {})[lot.id]).filter(r => r && r.state === 'done').map(r => r.doneAt).filter(Boolean).sort();
  // v1.0.47 : « ✓ Terminé » posé à la main (P.done) = le lot de ce niveau est fini, quelle que soit la saisie des pins
  let debR = J[0] || (s.pct > 0 ? dones[0] || '' : ''), finR = P.done || (s.n && s.fin === s.n ? dones[dones.length - 1] || today : '');
  if (P.done && !debR) debR = P.deb && P.deb <= P.done ? P.deb : P.done;
  let prev = '';
  if (!finR && debR && s.pct > 0 && s.pct < 100) { const el = Math.max(1, avDaysBetween(debR, today)), rate = s.pct / el; prev = avAddDays(today, Math.ceil((100 - s.pct) / rate)); }
  const al = [];
  if (!finR) {   // toutes les alertes, la plus grave en premier (les écrans n'en montrent qu'une par lot et par niveau)
    if (P.fin && today > P.fin) al.push(['r', `En retard de ${avDaysBetween(P.fin, today)} j · fin prévue le ${fmtDate(P.fin)}${s.n ? ` (${s.pct} %)` : ''}`, 4]);
    if (P.deb && !debR && today > P.deb) al.push(['r', `Pas démarré · prévu le ${fmtDate(P.deb)} (${avDaysBetween(P.deb, today)} j)`, 3]);
    if (P.fin && today <= P.fin && prev && prev > P.fin) al.push(['o', `Au rythme actuel : fin le ${fmtDate(prev)} (${avDaysBetween(P.fin, prev)} j de retard)`, 2]);
    if (P.fin && today <= P.fin && avDaysBetween(today, P.fin) <= 7) al.push(['y', avDaysBetween(today, P.fin) === 0 ? `Fin prévue aujourd'hui${s.n ? ` (${s.pct} %)` : ''}` : `Fin dans ${avDaysBetween(today, P.fin)} j${s.n ? ` (${s.pct} %)` : ''}`, 1.5]);
    if (P.deb && !debR && today <= P.deb && avDaysBetween(today, P.deb) <= 7) al.push(['y', avDaysBetween(today, P.deb) === 0 ? 'Démarre aujourd\'hui' : `Démarre dans ${avDaysBetween(today, P.deb)} j`, 1]);
    al.sort((a, b) => b[2] - a[2]);
  } else if (P.fin && finR > P.fin) al.push(['o', `Terminé le ${fmtDate(finR)} avec ${avDaysBetween(P.fin, finR)} j de retard`, 1]);
  else if (P.fin || P.done) al.push(['g', `Terminé le ${fmtDate(finR)}${P.fin ? ' · dans les délais' : ''}`, 0]);
  return { P, s, debR, finR, prev, al, late: !finR && P.fin && today > P.fin ? avDaysBetween(P.fin, today) : 0 };
}
// v1.0.47 : marquer un lot terminé sur un niveau (ou le rouvrir)
async function avLotDone(p, niv, lot, on = true) {
  p.avPlan = p.avPlan || {}; const k = niv.id + '|' + lot.id, P = p.avPlan[k] = p.avPlan[k] || {};
  if (on) { const r = await formSheet(`✓ ${niv.name} · ${lot.name} terminé`, [{ name: 'd', label: 'Date de fin', type: 'date', value: todayISO() }], { okLabel: 'Terminé' }); if (!r) return false; P.done = r.d || todayISO(); }
  else delete P.done;
  await DB.put('projects', p); toast(on ? `✓ ${niv.name} · ${lot.name} terminé` : `${niv.name} · ${lot.name} rouvert`); return true;
}
// toutes les alertes de lots d'un projet (Plans, briefing, tableau de bord)
async function avAllAlerts(p) {
  const L = (await DB.byProject('links', p.id)).filter(l => l.kind === 'local'), out = [];
  for (const n of p.avNiveaux || []) for (const lot of avLots(p)) { if (!(p.avPlan || {})[n.id + '|' + lot.id]) continue;
    const x = avLotPlanning(p, n, lot, L.filter(l => l.nivId === n.id)), a = x.al[0]; if (a && a[0] !== 'g') out.push({ n, lot, a, x }); }
  return out.sort((a, b) => b.a[2] - a.a[2] || (b.x.late || 0) - (a.x.late || 0));
}
const avDaysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
async function avPlanningEdit(p, niv, lot, nivs) {
  const k = niv.id + '|' + lot.id, P = (p.avPlan || {})[k] || {};
  const r = await formSheet(`📅 ${niv.name} · ${lot.name}`, [{ name: 'deb', label: 'Début prévu', type: 'date', value: P.deb || '' }, { name: 'fin', label: 'Fin prévue', type: 'date', value: P.fin || '' }, { name: 'done', label: '✓ Terminé le (vide = pas encore fini)', type: 'date', value: P.done || '' },
    { name: 'all', label: 'Appliquer à', type: 'select', value: 'one', options: [{ value: 'one', label: `${niv.name} seulement` }, { value: 'zone', label: `Tous les niveaux de ${avZoneOf(p, niv)}` }, { value: 'all', label: 'Tous les niveaux' }] }], { okLabel: 'Enregistrer' });
  if (!r) return false;
  p.avPlan = p.avPlan || {};
  for (const n of r.all === 'all' ? nivs : r.all === 'zone' ? nivs.filter(x => avZoneOf(p, x) === avZoneOf(p, niv)) : [niv]) { const o = p.avPlan[n.id + '|' + lot.id] = { ...(p.avPlan[n.id + '|' + lot.id] || {}), deb: r.deb || '', fin: r.fin || '' }; if (n === niv) { if (r.done) o.done = r.done; else delete o.done; } }
  await DB.put('projects', p); return true;
}
// grand tableau : niveaux (par zone) × lots — % · début → fin prévus · réel · prévision · alertes
function avPlanningHTML(p, nivs, L, lots, opt = {}) {
  const AC = { r: '#ef4444', o: '#f97316', y: '#eab308', g: '#16a34a' }, all = [];
  const rows = nivs.map(n => { const locs = L.filter(l => l.nivId === n.id); return { n, cells: lots.map(lot => { const x = avLotPlanning(p, n, lot, locs); if (x.al[0]) all.push({ a: x.al[0], n, lot }); return { lot, x, locs }; }) }; });
  all.sort((a, b) => b.a[2] - a.a[2]);
  const dt = (d) => d ? fmtDate(d).slice(0, 5) : '—';
  return `${opt.noAlerts ? '' : `<div class="avp-card"><div class="avp-h">🚨 Alertes des lots <span>${all.filter(x => x.a[0] !== 'g').length}</span></div>
      ${all.filter(x => x.a[0] !== 'g').slice(0, 20).map(({ a, n, lot }) => `<button class="avp-al" data-pl="${n.id}|${lot.id}" style="--c:${AC[a[0]]}"><i></i><span class="grow"><b>${esc(n.name)} · ${esc(lot.name)}</b><small>${esc(a[1])}</small></span></button>`).join('') || '<div class="muted avp-pad">Aucune alerte ✓ — indiquez les dates prévues dans le tableau ci-dessous</div>'}</div>`}
    <div class="avp-card"><div class="avp-h">📅 Planning des lots <small class="muted">toucher une case pour les dates</small></div>
      <div class="avp-mxw"><table class="avp-pt"><tr><th></th>${lots.map(l => `<th style="--c:${l.color}">${esc(l.name)}</th>`).join('')}</tr>
      ${rows.map((r, i) => `${i === 0 || avZoneOf(p, nivs[i - 1]) !== avZoneOf(p, r.n) ? `<tr class="avp-pz"><td colspan="${lots.length + 1}">${esc(avZoneOf(p, r.n))}</td></tr>` : ''}<tr><td class="avp-rh"><b>${esc(r.n.name)}</b></td>${r.cells.map(({ lot, x }) => { const w = x.al.filter(a => a[0] !== 'g').sort((a, b) => b[2] - a[2])[0];
        return `<td data-pl="${r.n.id}|${lot.id}"><div class="avp-pc" style="--c:${lot.color};--p:${x.s.pct}%">${w ? `<em style="background:${AC[w[0]]}">!</em>` : x.finR ? '<em style="background:#16a34a">✓</em>' : ''}
          <b>${x.s.n ? x.s.pct + '%' : '—'}</b><span class="avp-pb"><i></i></span><small>${dt(x.P.deb)} → ${dt(x.P.fin)}</small>${x.debR || x.prev || x.finR ? `<small class="r">${x.debR ? 'réel ' + dt(x.debR) : ''}${x.finR ? ' → ' + dt(x.finR) : x.prev ? ' · prév. ' + dt(x.prev) : ''}</small>` : ''}</div></td>`; }).join('')}</tr>`).join('')}</table></div></div>`;
}

// ---------- comparer l'avancement de deux lots sur le même plan (pins coupés en deux) ----------
async function avTwoLotsImage(p, plan, locs, la, lb, title) {
  const img = await loadImage(await fileURL(plan.fileId)), k = Math.min(1, 3000 / Math.max(plan.w, plan.h)), W = Math.round(plan.w * k), H = Math.round(plan.h * k), head = 70;
  const c = document.createElement('canvas'); c.width = W; c.height = H + head; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, head, W, H);
  g.fillStyle = '#0f172a'; g.font = `bold ${Math.round(head * 0.38)}px Arial`; g.fillText(title, 16, head * 0.45);
  g.font = `${Math.round(head * 0.26)}px Arial`; g.fillStyle = la.color; g.fillText('◐ ' + la.name, 16, head * 0.85); g.fillStyle = lb.color; g.fillText('◑ ' + lb.name, 16 + g.measureText('◐ ' + la.name + '     ').width, head * 0.85);
  const R = Math.max(9, W / 140);
  for (const l of locs) { const x = l.x * k, y = l.y * k + head;
    [[la, Math.PI / 2, Math.PI * 1.5], [lb, -Math.PI / 2, Math.PI / 2]].forEach(([lot, a0, a1]) => { g.beginPath(); g.moveTo(x, y); g.arc(x, y, R, a0, a1); g.closePath(); g.fillStyle = AV_ST[avStatus((l.lots || {})[lot.id])][1]; g.fill(); });
    g.lineWidth = 2; g.strokeStyle = '#fff'; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(x, y - R); g.lineTo(x, y + R); g.stroke(); }
  return c;
}
