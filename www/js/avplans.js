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
async function avNivPlans(p, niv) {
  const base = await latestPlanOfSerie(p.id, niv.serieId), out = base ? [{ id: 'main', serieId: niv.serieId, label: 'Architecte', kind: 'archi', plan: base }] : [];
  for (const x of niv.plans || []) { const pl = await latestPlanOfSerie(p.id, x.serieId); if (pl) out.push({ ...x, plan: pl }); }
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
  const key = ap.id + '>' + basePlan.id; if (_anepCache.has(key)) return _anepCache.get(key);
  const [TA, TB, M] = await Promise.all([planTexts(ap), planTexts(basePlan), planAlignMap(ap, basePlan)]);
  if (!TA) { _anepCache.set(key, []); return []; }
  const base = TB || [], out = [];
  for (const t of TA) {   // seulement ce que l'ANEP ajoute (sa numérotation) : les textes communs avec l'architecte sont ignorés
    const x = t.x * M.sx + M.ox, y = t.y * M.sy + M.oy, tol = Math.max(8, t.h * M.sy * 1.2);
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

// ---------- comparer deux plans du même niveau (rideau / transparence), calage automatique par les textes communs ----------
async function avComparePlans(p, niv) {
  const L = await avNivPlans(p, niv); if (L.length < 2) return toast('Ajoutez au moins un 2e plan à ce niveau (Plans du niveau › Ajouter)');
  const pick = async (t, ex) => { const id = await menu(t, L.filter(x => x.id !== ex).map(x => ({ label: `${x.label} · ${x.plan.name}`, icon: 'plans', value: x.id }))); return L.find(x => x.id === id); };
  const A = await pick('Plan de base', null); if (!A) return; const Bx = await pick('Comparer avec', A.id); if (!Bx) return;
  const ld = loading('Calage des deux plans…'); let M;
  try { M = await planAlignMap(Bx.plan, A.plan); } finally { ld.close(); }
  const el = document.createElement('div'); el.className = 'fullpage av-page avc-page'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  const [sa, sb] = await Promise.all([fileURL(A.plan.fileId), fileURL(Bx.plan.fileId)]), W = A.plan.w, H = A.plan.h;
  let mode = 'rideau', v = 50;
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title" style="flex:1"><b>${esc(niv.name)} — comparaison</b><span>${esc(A.label)} ↔ ${esc(Bx.label)}</span></div></div>
    <div class="av-view"><div class="av-stage avc-stage"><img src="${sa}" width="${W}" height="${H}"><div class="avc-b"><img src="${sb}" style="position:absolute;left:${M.ox}px;top:${M.oy}px;width:${Bx.plan.w * M.sx}px;height:${Bx.plan.h * M.sy}px"></div><i class="avc-line"></i></div></div>
    <div class="avc-bar"><div class="avp-seg">${[['rideau', 'Rideau'], ['trans', 'Transparence'], ['blink', 'Clignoter']].map(([k, l]) => `<button data-m="${k}" class="${k === mode ? 'on' : ''}">${l}</button>`).join('')}</div><input type="range" min="0" max="100" value="${v}" data-a="v"><small class="avc-lab"><b>${esc(A.label)}</b><b>${esc(Bx.label)}</b></small></div>`;
  const bx = $('.avc-b', el), line = $('.avc-line', el), stage = $('.avc-stage', el);
  let blinkT = null;
  const apply = () => { clearInterval(blinkT); bx.style.opacity = 1; bx.style.clipPath = ''; line.style.display = 'none';
    if (mode === 'rideau') { bx.style.clipPath = `inset(0 0 0 ${v}%)`; line.style.display = 'block'; line.style.left = (W * v / 100) + 'px'; }
    if (mode === 'trans') bx.style.opacity = v / 100;
    if (mode === 'blink') { let on = true; blinkT = setInterval(() => { on = !on; bx.style.opacity = on ? 1 : 0; }, 700); } };
  const pz = panZoom($('.av-view', el), stage, W, H, {}); requestAnimationFrame(() => pz.fit());
  $('[data-a=x]', el).onclick = () => { clearInterval(blinkT); unBack(); el.remove(); };
  $('[data-a=v]', el).oninput = (e) => { v = +e.target.value; apply(); };
  $$('[data-m]', el).forEach(b => b.onclick = () => { mode = b.dataset.m; $$('[data-m]', el).forEach(x => x.classList.toggle('on', x === b)); apply(); });
  Object.assign(bx.style, { position: 'absolute', left: 0, top: 0, width: W + 'px', height: H + 'px', overflow: 'hidden' });
  apply();
  return el;
}
