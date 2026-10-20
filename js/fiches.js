// ================= Modèles de fiches PDF : on place les champs une fois, l'application remplit pour chaque ouvrage =================
// Chaque modèle = un PDF vierge (page 1) + des cases (position en points PDF). Écriture bleue manuscrite, comme la fiche de contrôle.
const FT_FIELDS = [
  ['date', '📅 Date complète (08/10/2026)'], ['jour', 'Jour (08)'], ['mois', 'Mois (10)'], ['annee', 'Année (2026)'],
  ['ouvrage', 'Ouvrage'], ['axe', 'Axe'], ['file', 'File'], ['niv', 'Niveau'], ['zone', 'Zone'], ['element', 'Élément (intitulé complet)'],
  ['proc', 'Référence de procédure'], ['ferr', 'Plan ferraillage N°'], ['ferrInd', 'Indice ferraillage'], ['coff', 'Plan coffrage N°'], ['coffInd', 'Indice coffrage'],
  ['fiche', 'Fiche N°'], ['nom1', 'Nom · contrôle interne'], ['nom2', 'Nom · contrôle externe'], ['nom3', 'Nom · contrôle extérieur'], ['obs', 'Observation'],
  ['coche', '✓ Coche (case à cocher)'], ['libre', '✏️ Texte libre (à saisir)'],
];
const ftLabel = (f) => f.label || (FT_FIELDS.find(x => x[0] === f.k) || [, f.k])[1];
const ftList = (p) => (p.ficheTpls = p.ficheTpls || []);
// valeurs proposées pour un ouvrage (modifiables avant de générer)
function ftDefaults(p, day, r, tpl) {
  const P = pvgParse(r), C = p.pvCfg || {}, prev = ((r.fv || {})[tpl.id]) || {}, [dd, mm, yy] = pvgDate(day.date);
  const base = { date: `${dd}/${mm}/${yy}`, jour: dd, mois: mm, annee: yy, ouvrage: P.ouvrage, axe: P.axe, file: P.file, niv: r.niv || '', zone: r.zone || '', element: r.element || '',
    proc: C.proc || '', ferr: '', ferrInd: r.indFer || '', coff: '', coffInd: r.indCof || '', fiche: '', nom1: (C.names || [])[0] || '', nom2: (C.names || [])[1] || '', nom3: (C.names || [])[2] || '', obs: '' };
  const v = {}; for (const f of tpl.fields) { const key = f.k === 'coche' || f.k === 'libre' ? f.id : f.k; if (key in v) continue; v[key] = prev[key] ?? (f.k === 'coche' ? (f.def !== false) : f.k === 'libre' ? (f.def || '') : base[f.k] ?? ''); }
  return v;
}
async function ftTemplateBlob(tpl) { const f = await DB.get('files', tpl.fileId); return f && f.blob; }
// ---------- éditeur : placer les champs sur le PDF ----------
async function ftEditor(p, tpl) {
  if (!pdfReady()) return alertBox('Lecteur PDF indisponible');
  const blob = await ftTemplateBlob(tpl); if (!blob) return alertBox('Modèle introuvable');
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise, page = await doc.getPage(1), vp1 = page.getViewport({ scale: 1 });
  tpl.W = vp1.width; tpl.H = vp1.height;
  return new Promise((resolve) => {
    const el = document.createElement('div'); el.className = 'fullpage ft-ed';
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title" style="flex:1"><b>${esc(tpl.name)}</b><span>Placez chaque case · glissez pour déplacer · coin ◢ pour agrandir</span></div><button class="btn small" data-a="ok">Enregistrer</button></div>
      <div class="ft-wrap"><div class="ft-page"><canvas></canvas><div class="ft-boxes"></div></div></div>
      <div class="ft-bar"><button class="btn ghost ft-z" data-z="-1">－</button><button class="btn ghost ft-z" data-z="1">＋</button><button class="btn" data-a="add">${icon('plus')} Case</button><button class="btn ghost" data-a="test">👁 Essai</button></div>`;
    document.body.appendChild(el);
    const unBack = pushBack(() => done(false)); let saved = false;
    const done = async (ok) => { if (ok) { await DB.put('projects', p); saved = true; } el.remove(); resolve(saved); };
    $('[data-a=x]', el).onclick = () => { unBack(); done(false); };
    $('[data-a=ok]', el).onclick = () => { unBack(); done(true); toast('Modèle enregistré ✓'); };
    const pg = $('.ft-page', el), cv = $('canvas', pg), boxes = $('.ft-boxes', pg);
    let Z = 1.6, S = 1, rt = null;   // zoom de l'éditeur (－ / ＋) pour placer les cases précisément
    const layout = () => { const W = Math.min(window.innerWidth - 16, 900) * Z; S = W / tpl.W; const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(tpl.W * S * dpr); cv.height = Math.round(tpl.H * S * dpr); cv.style.width = W + 'px'; cv.style.height = tpl.H * S + 'px'; pg.style.width = W + 'px'; pg.style.height = tpl.H * S + 'px';
      if (rt) try { rt.cancel(); } catch (e) {} rt = page.render({ canvasContext: cv.getContext('2d'), viewport: page.getViewport({ scale: S * dpr }) }); rt.promise.catch(() => {}); };
    layout();
    $$('[data-z]', el).forEach(b => b.onclick = () => { const w = $('.ft-wrap', el), cx = (w.scrollLeft + w.clientWidth / 2) / S, cy = (w.scrollTop + w.clientHeight / 2) / S; Z = Math.max(1, Math.min(4, Z * (b.dataset.z === '1' ? 1.4 : 1 / 1.4))); layout(); draw(); w.scrollLeft = cx * S - w.clientWidth / 2; w.scrollTop = cy * S - w.clientHeight / 2; });
    const draw = () => {
      boxes.innerHTML = tpl.fields.map((f, i) => `<div class="ft-box ${f.k === 'coche' ? 'tick' : ''}" data-i="${i}" style="left:${f.x * S}px;top:${f.y * S}px;width:${f.w * S}px;height:${f.h * S}px"><span>${esc(ftLabel(f))}</span><i data-rs="${i}">◢</i></div>`).join('');
      $$('.ft-box', boxes).forEach(b => {
        const i = +b.dataset.i, f = tpl.fields[i];
        b.onpointerdown = (e) => { if (e.target.dataset.rs != null) return; e.preventDefault(); const sx = e.clientX, sy = e.clientY, ox = f.x, oy = f.y; let moved = false;
          const mv = (ev) => { const dx = (ev.clientX - sx) / S, dy = (ev.clientY - sy) / S; if (Math.hypot(dx, dy) * S > 4) moved = true; f.x = Math.max(0, Math.min(tpl.W - f.w, ox + dx)); f.y = Math.max(0, Math.min(tpl.H - f.h, oy + dy)); b.style.left = f.x * S + 'px'; b.style.top = f.y * S + 'px'; };
          const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (!moved) boxMenu(i); };
          window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); };
        $('[data-rs]', b).onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); const sx = e.clientX, sy = e.clientY, ow = f.w, oh = f.h;
          const mv = (ev) => { f.w = Math.max(8, ow + (ev.clientX - sx) / S); f.h = Math.max(6, oh + (ev.clientY - sy) / S); b.style.width = f.w * S + 'px'; b.style.height = f.h * S + 'px'; };
          const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
          window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); };
      });
    };
    const boxMenu = async (i) => {
      const f = tpl.fields[i], v = await menu(ftLabel(f), [{ label: `Taille d'écriture : ${f.size || 'auto'}`, icon: 'edit', value: 'size' }, { label: f.align === 'left' ? 'Aligner au centre' : 'Aligner à gauche', icon: 'rows', value: 'al' },
        ...(f.k === 'coche' || f.k === 'libre' ? [{ label: 'Renommer / valeur par défaut', icon: 'edit', value: 'ren' }] : []), { label: 'Dupliquer', icon: 'plus', value: 'dup' }, { label: 'Supprimer la case', icon: 'trash', danger: true, value: 'del' }]);
      if (v === 'size') { const r = await formSheet('Taille d\'écriture', [{ name: 's', label: 'Taille en points (vide = automatique)', type: 'number', value: f.size || '' }]); if (r) f.size = +r.s || null; }
      if (v === 'al') f.align = f.align === 'left' ? 'center' : 'left';
      if (v === 'ren') { const r = await formSheet(ftLabel(f), [{ name: 'l', label: 'Nom de la case', value: f.label || '' }, ...(f.k === 'coche' ? [{ name: 'd', label: 'Cochée par défaut', type: 'select', value: f.def === false ? 'n' : 'o', options: [{ value: 'o', label: 'Oui' }, { value: 'n', label: 'Non' }] }] : [{ name: 'd', label: 'Valeur par défaut', value: f.def || '' }])]); if (r) { f.label = r.l; f.def = f.k === 'coche' ? r.d !== 'n' : r.d; } }
      if (v === 'dup') tpl.fields.push({ ...f, id: DB.uid(), y: Math.min(tpl.H - f.h, f.y + f.h + 2) });
      if (v === 'del') tpl.fields.splice(i, 1);
      draw();
    };
    $('[data-a=add]', el).onclick = async () => {
      const k = await menu('Quelle case ?', FT_FIELDS.map(([k2, l]) => ({ label: l + (tpl.fields.some(f => f.k === k2 && k2 !== 'coche' && k2 !== 'libre') ? '  ✓' : ''), value: k2 }))); if (!k) return;
      let label = ''; if (k === 'coche' || k === 'libre') { const r = await formSheet(k === 'coche' ? 'Coche' : 'Texte libre', [{ name: 'l', label: 'Nom (ex : Conforme · ligne 1)', value: '' }]); if (!r) return; label = r.l; }
      const wrap = $('.ft-wrap', el), top = (wrap.scrollTop + wrap.clientHeight / 2) / S - 10, left = (wrap.scrollLeft + wrap.clientWidth / 2) / S;
      const sz = k === 'coche' ? [28, 22] : ['jour', 'mois'].includes(k) ? [34, 20] : [140, 22];
      tpl.fields.push({ id: DB.uid(), k, label, x: Math.max(0, Math.min(tpl.W - sz[0], left - sz[0] / 2)), y: Math.max(0, Math.min(tpl.H - sz[1], top)), w: sz[0], h: sz[1], align: 'center' }); draw();
      toast('Glissez la case à sa place, coin ◢ pour la taille');
    };
    $('[data-a=test]', el).onclick = async () => { const ld = loading('Essai…'); try { const day = { date: todayISO() }, r = { element: 'Plancher Axe D3*D4 fil H*K', niv: 'R+5', zone: '3', indFer: 'PE00', indCof: 'PE01' }; const b = await ftMake(p, tpl, ftDefaults(p, day, r, tpl), 'essai'); ld.close(); openFileRecord({ blob: b, mime: 'application/pdf', name: 'essai.pdf' }, 'Essai'); } catch (e) { ld.close(); alertBox('Essai impossible : ' + (e.message || e)); } };
    draw();
  });
}
// ---------- génération ----------
async function ftMake(p, tpl, vals, seed) {
  const PDFLib = await needPdfLib(), src = await PDFLib.PDFDocument.load(await (await ftTemplateBlob(tpl)).arrayBuffer(), { ignoreEncryption: true });
  const out = await PDFLib.PDFDocument.create(), [pg] = await out.copyPages(src, [0]); out.addPage(pg);
  const { width: PW, height: PH } = pg.getSize();
  const ops = [];
  for (const f of tpl.fields) {
    const key = f.k === 'coche' || f.k === 'libre' ? f.id : f.k, v = vals[key];
    let cv = null;
    if (f.k === 'coche') { if (v === true || v === 'o') cv = pvgTick(f.w, f.h, seed + f.id); }
    else if (v) cv = await pvgInk(String(v), f.w, f.h, f.size || Math.max(9, Math.min(22, f.h * .78)), seed + f.id, f.align === 'left' ? 'left' : 'center');
    if (!cv) continue;
    ops.push({ cv, x: f.x, y: f.y, w: f.w, h: f.h });
  }
  await pvgCompose(out, pg, ops);
  return new Blob([await out.save()], { type: 'application/pdf' });
}
// remplir pour une ligne du programme
async function ftFill(p, day, r, tpl, save) {
  const v = ftDefaults(p, day, r, tpl), seen = new Set(), fields = [];
  for (const f of tpl.fields) { const key = f.k === 'coche' || f.k === 'libre' ? f.id : f.k; if (seen.has(key)) continue; seen.add(key);
    fields.push(f.k === 'coche' ? { name: key, label: ftLabel(f), type: 'select', value: v[key] ? 'o' : 'n', options: [{ value: 'o', label: '✓ Cochée' }, { value: 'n', label: '— vide —' }] } : { name: key, label: ftLabel(f), value: v[key] }); }
  const res = await formSheet(`${tpl.name} · ${pvgParse(r).ouvrage}`, fields, { okLabel: 'Générer (PDF)', danger: (r.fiches || {})[tpl.id] ? 'Supprimer cette fiche' : null });
  if (!res) return;
  r.fiches = r.fiches || {};
  if (res.__danger) { if (await confirmBox('Supprimer cette fiche (aussi dans Drive) ?')) { await DB.del('files', r.fiches[tpl.id]).catch(() => {}); delete r.fiches[tpl.id]; await save(); toast('Fiche supprimée'); } return; }
  const vals = {}; for (const f of fields) vals[f.name] = f.type === 'select' ? res[f.name] === 'o' : res[f.name];
  r.fv = r.fv || {}; r.fv[tpl.id] = vals;
  const C = p.pvCfg = p.pvCfg || {}; if ('proc' in vals) C.proc = vals.proc; if ('nom1' in vals || 'nom2' in vals || 'nom3' in vals) C.names = [vals.nom1 ?? (C.names || [])[0] ?? '', vals.nom2 ?? (C.names || [])[1] ?? '', vals.nom3 ?? (C.names || [])[2] ?? '']; await DB.put('projects', p);
  const ld = loading('Écriture de la fiche…');
  try {
    const blob = await ftMake(p, tpl, vals, r.id || 'x'), nm = safeName(`${pvgParse(r).ouvrage} ${pvgParse(r).axe}`.trim()) || 'ouvrage';
    const rec = await DB.put('files', { projectId: p.id, blob, mime: 'application/pdf', role: 'pvgen', name: `${tpl.name} ${day.date} ${nm}.pdf` });
    if (r.fiches[tpl.id] && r.fiches[tpl.id] !== rec.id) await DB.del('files', r.fiches[tpl.id]).catch(() => {});
    r.fiches[tpl.id] = rec.id; await save(); ld.close(); toast('Fiche générée ✓ (aussi dans Drive)'); openFileRecord(rec, rec.name);
  } catch (e) { ld.close(); alertBox('Fiche impossible : ' + (e.message || e)); }
}
// nouveau modèle : choisir le PDF vierge puis placer les cases
async function ftNew(p) {
  const r = await formSheet('Nouveau modèle de fiche', [{ name: 'n', label: 'Nom du modèle', placeholder: 'Ex : Fiche de contrôle bétonnage' }], { okLabel: 'Choisir le PDF vierge ›' }); if (!r || !r.n) return null;
  const [file] = await pickFiles({ accept: 'application/pdf', multiple: false }); if (!file) return null;
  const rec = await DB.put('files', { projectId: p.id, blob: file, mime: 'application/pdf', role: 'pvtpl', name: `Modèle ${r.n}.pdf` });
  const tpl = { id: DB.uid(), name: r.n, fileId: rec.id, fields: [] }; ftList(p).push(tpl); await DB.put('projects', p);
  await ftEditor(p, tpl); return tpl;
}
// « Fiche » d'une ligne : va directement au modèle choisi pour le projet (changer de modèle : bouton ⇄ à côté)
async function ficheMenu(p, day, r, save, opt = {}) {
  const id = fcSel(p);
  if (opt.change) { if (await fcModelMenu(p)) toast(`Modèle : ${fcName(p, fcSel(p))}`); return; }
  const f = fcFile(r, id);
  if (!f) return fcEdit(p, day, r, id, save);
  const v = await menu(`${fcName(p, id).replace(/\s*\(.*\)/, '')} · ${r.element}`, [{ label: 'Ouvrir la fiche', icon: 'pdf', value: 'open' }, { label: 'Modifier puis réécrire', icon: 'edit', value: 'edit' }, { label: 'Partager (WhatsApp, imprimer…)', icon: 'share', value: 'share' }, { label: 'Supprimer la fiche', icon: 'trash', danger: true, value: 'del' }]);
  if (!v) return;
  if (v === 'open' || v === 'share') { const rec = await DB.get('files', f); if (!rec) { await fcDel(r, id); await save(); return toast('Fiche introuvable'); } return v === 'open' ? openFileRecord(rec, rec.name) : shareBlob(rec.blob, rec.name); }
  if (v === 'del') { if (await confirmBox('Supprimer cette fiche (aussi dans Drive) ?', 'Supprimer')) { await fcDel(r, id); await save(); toast('Fiche supprimée'); } return; }
  return fcEdit(p, day, r, id, save);
}
async function ftManage(p) {
  const L = ftList(p), id = await menu('Modèles de fiches', L.map(t => ({ label: `${t.name} · ${t.fields.length} case(s)`, icon: 'pdf', value: t.id }))); if (!id) return;
  const t = L.find(x => x.id === id), v = await menu(t.name, [{ label: 'Placer / modifier les cases', icon: 'edit', value: 'ed' }, { label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Supprimer le modèle', icon: 'trash', danger: true, value: 'del' }]);
  if (v === 'ed') await ftEditor(p, t);
  if (v === 'ren') { const r = await formSheet('Renommer', [{ name: 'n', label: 'Nom', value: t.name }]); if (r && r.n) { t.name = r.n; await DB.put('projects', p); } }
  if (v === 'del' && await confirmBox(`Supprimer le modèle « ${t.name} » ? (les fiches déjà générées restent)`)) { await DB.del('files', t.fileId).catch(() => {}); p.ficheTpls = L.filter(x => x !== t); await DB.put('projects', p); }
}

// ================= Fiches de contrôle sous le programme de réception : toutes les parties, un modèle au choix =================
// Le PDF du modèle est gardé tel quel (vectoriel, jamais modifié) : on écrit seulement par-dessus, à l'encre bleue manuscrite.
const FC_PV = '__pv';
const fcSel = (p) => p.ftSel && (p.ftSel === FC_PV || ftList(p).some(t => t.id === p.ftSel)) ? p.ftSel : FC_PV;
const fcName = (p, id) => id === FC_PV ? 'Fiche de contrôle ferraillage (intégrée)' : (ftList(p).find(t => t.id === id) || {}).name || '?';
const fcFile = (r, id) => id === FC_PV ? r.pvGenId : (r.fiches || {})[id];
// le modèle est prêt AVANT tout écran d'attente (sinon la question du PDF restait cachée derrière « Écriture… »)
async function fcReady(p, id) {
  if (id === FC_PV) return !!(await pvgTemplate(p));
  const t = ftList(p).find(x => x.id === id); if (!t) return false;
  if (!t.fields.length) { toast('Placez d\'abord les cases du modèle'); await ftEditor(p, t); }
  return t.fields.length > 0;
}
async function fcMakeOne(p, day, r, id) {
  if (id === FC_PV) { const made = await pvgMake(p, day, [r]); return made && made[0]; }
  const t = ftList(p).find(x => x.id === id); if (!t) return null;
  const vals = ftDefaults(p, day, r, t), blob = await ftMake(p, t, vals, r.id || 'x'), nm = safeName(`${pvgParse(r).ouvrage} ${pvgParse(r).axe}`.trim()) || 'ouvrage';
  const rec = await DB.put('files', { projectId: p.id, blob, mime: 'application/pdf', role: 'pvgen', name: `${t.name} ${day.date} ${nm}.pdf` });
  r.fiches = r.fiches || {}; if (r.fiches[id] && r.fiches[id] !== rec.id) await DB.del('files', r.fiches[id]).catch(() => {});
  r.fiches[id] = rec.id; r.fv = r.fv || {}; r.fv[id] = vals; return rec;
}
async function fcDel(r, id) {
  const f = fcFile(r, id); if (f) await DB.del('files', f).catch(() => {});
  if (id === FC_PV) r.pvGenId = null; else if (r.fiches) delete r.fiches[id];
}
async function fcEdit(p, day, r, id, save) {
  if (!(await fcReady(p, id))) return;
  if (id !== FC_PV) return ftFill(p, day, r, ftList(p).find(x => x.id === id), save);
  const e = await pvgEdit(p, day, r); if (!e) return;
  if (e === 'del') { await save(); toast('Fiche supprimée'); return; }
  const ld = loading('Écriture de la fiche…'); let rec;
  try { rec = await fcMakeOne(p, day, r, id); } catch (er) { ld.close(); return alertBox('Fiche impossible : ' + (er.message || er)); }
  ld.close(); if (!rec) return; await save(); toast('Fiche écrite ✓ (aussi dans Drive)'); openFileRecord(rec, rec.name);
}
async function fcModelMenu(p) {
  const L = ftList(p), cur = fcSel(p);
  const v = await menu('Modèle de fiche', [
    { label: `📝 Fiche de contrôle ferraillage (intégrée)${p.pvTpl ? '' : ' · PDF à donner'}`, value: FC_PV, checked: cur === FC_PV },
    ...L.map(t => ({ label: `📄 ${t.name} · ${t.fields.length} case(s)`, value: t.id, checked: cur === t.id })),
    { label: '＋ Donner un nouveau modèle (mon PDF)…', icon: 'plus', value: '__new' },
    { label: 'Changer le PDF de la fiche intégrée', icon: 'upload', value: '__tpl' },
    ...(L.length ? [{ label: 'Gérer mes modèles (cases, nom, supprimer)…', icon: 'settings', value: '__man' }] : [])]);
  if (!v) return false;
  if (v === '__new') { const t = await ftNew(p); if (!t) return false; p.ftSel = t.id; await DB.put('projects', p); return true; }
  if (v === '__tpl') { await pvgTemplate(p, true); p.ftSel = FC_PV; await DB.put('projects', p); return true; }
  if (v === '__man') { await ftManage(p); return true; }
  if (v === FC_PV && !p.pvTpl && !(await pvgTemplate(p))) return false;
  p.ftSel = v; await DB.put('projects', p); return true;
}
// le bloc sous le tableau
async function fcBox(p, day, box, save, rerender) {
  if (!box) return;
  const id = fcSel(p), rows = day.rows.map((r, i) => ({ r, i })).filter(x => x.r.element), done = rows.filter(x => fcFile(x.r, id)).length, miss = rows.length - done;
  let open = false; try { open = localStorage.getItem('fc.open') === '1'; } catch (e) {}
  box.classList.toggle('open', open);
  box.innerHTML = `<button class="fc-h" data-fc="tog">${icon('report')} Fiches de contrôle <span>${done}/${rows.length}</span><u>${icon('chevdown')}</u></button>
    ${!open ? (rows.length && miss ? `<button class="fc-quick" data-fc="all">✍️ Écrire ${done ? `les ${miss} manquante(s)` : `toutes (${rows.length})`}</button>` : '') : `
    <button class="fc-model" data-fc="model"><span class="grow"><small>Modèle</small><b>${esc(fcName(p, id))}</b>${id === FC_PV && !p.pvTpl ? '<i>PDF vierge à donner une fois</i>' : ''}</span><u>Changer ›</u></button>
    ${rows.length ? `<div class="fc-list">${rows.map(({ r, i }) => { const f = fcFile(r, id); return `<div class="fc-r ${f ? 'ok' : ''}" data-fi="${i}"><div class="grow"><b>${esc(r.element)}</b><small>${f ? '✓ fiche écrite' : 'pas encore écrite'}${r.niv ? ' · ' + esc(r.niv) : ''}</small></div>
      ${f ? `<button data-fx="open" title="Ouvrir">${icon('eye')}</button><button data-fx="edit" title="Modifier">${icon('edit')}</button><button data-fx="del" class="d" title="Supprimer">${icon('trash')}</button>` : `<button data-fx="edit" title="Remplir puis écrire">${icon('edit')}</button><button data-fx="gen" class="g">✍️ Écrire</button>`}</div>`; }).join('')}</div>
    <div class="fc-act"><button class="btn" data-fc="all">✍️ ${done ? (miss ? `Écrire les ${miss} manquante(s)…` : 'Réécrire toutes les fiches') : `Écrire toutes les fiches (${rows.length})`}</button>${done ? `<button class="btn ghost" data-fc="pdf">${icon('pdf')} Un seul PDF (${done})</button>` : ''}</div>`
    : '<div class="fc-none">Ajoutez des ouvrages dans le tableau pour écrire leurs fiches</div>'}`}`;
  $('[data-fc=tog]', box).onclick = () => { try { localStorage.setItem('fc.open', open ? '0' : '1'); } catch (e) {} rerender(); };
  const mb = $('[data-fc=model]', box); if (mb) mb.onclick = async () => { if (await fcModelMenu(p)) rerender(); };
  $$('[data-fx]', box).forEach(b => b.onclick = async (e) => {
    e.stopPropagation(); const r = day.rows[+b.closest('[data-fi]').dataset.fi], k = b.dataset.fx;
    if (k === 'open') { const f = await DB.get('files', fcFile(r, id)); if (f) openFileRecord(f, f.name); else { await fcDel(r, id); await save(); rerender(); } return; }
    if (k === 'del') { if (!await confirmBox(`Supprimer la fiche de « ${r.element} » (aussi dans Drive) ?`, 'Supprimer')) return; await fcDel(r, id); await save(); toast('Fiche supprimée'); return rerender(); }
    if (k === 'edit') { await fcEdit(p, day, r, id, save); return rerender(); }
    if (k === 'gen') { if (!(await fcReady(p, id))) return; const ld = loading('Écriture de la fiche…'); try { await fcMakeOne(p, day, r, id); await save(); ld.close(); toast('Fiche écrite ✓'); } catch (er) { ld.close(); alertBox('Fiche impossible : ' + (er.message || er)); } return rerender(); }
  });
  const ab = $('[data-fc=all]', box); if (ab) ab.onclick = async () => {
    let list = rows.map(x => x.r);
    if (!open && miss) list = list.filter(r => !fcFile(r, id));
    else if (done && miss) { const w = await menu('Écrire les fiches', [{ label: `Seulement les manquantes (${miss})`, icon: 'pen', value: 'm' }, { label: `Toutes, en réécrivant (${rows.length})`, icon: 'undo', value: 'a' }]); if (!w) return; if (w === 'm') list = list.filter(r => !fcFile(r, id)); }
    else if (done && !await confirmBox(`Réécrire les ${rows.length} fiches ? (vos modifications sont gardées)`, 'Réécrire')) return;
    if (!(await fcReady(p, id))) return;
    const ld = loading(`Écriture des fiches… 0/${list.length}`); let n = 0;
    try { for (const r of list) { await fcMakeOne(p, day, r, id); n++; ld.set(`Écriture des fiches… ${n}/${list.length}`); } await save(); ld.close(); toast(`${n} fiche(s) écrite(s) ✓ (aussi dans Drive)`); }
    catch (er) { await save(); ld.close(); alertBox(`Arrêt après ${n} fiche(s) : ${er.message || er}`); }
    rerender();
  };
  const pb = $('[data-fc=pdf]', box); if (pb) pb.onclick = async () => {
    const ld = loading('Création du PDF…');
    try { const PDFLib = await needPdfLib(), all = await PDFLib.PDFDocument.create();
      for (const { r } of rows) { const fid = fcFile(r, id); if (!fid) continue; const f = await DB.get('files', fid); if (!f || !f.blob) continue; const d = await PDFLib.PDFDocument.load(await f.blob.arrayBuffer()); (await all.copyPages(d, d.getPageIndices())).forEach(x => all.addPage(x)); }
      const blob = new Blob([await all.save()], { type: 'application/pdf' }), nm = `Fiches ${safeName(fcName(p, id).replace(/\s*\(.*\)/, ''))} ${day.date}.pdf`; ld.close();
      const w = await menu(nm, [{ label: 'Ouvrir', icon: 'pdf', value: 'o' }, { label: 'Partager (WhatsApp, imprimer…)', icon: 'share', value: 's' }]);
      if (w === 'o') openFileRecord({ blob, mime: 'application/pdf', name: nm }, nm); if (w === 's') shareBlob(blob, nm);
    } catch (er) { ld.close(); alertBox('PDF impossible : ' + (er.message || er)); }
  };
}
