// ================= Fiche de contrôle (PV) remplie « à la main » à partir du programme de réception =================
// Le modèle PDF de l'entreprise est gardé tel quel (vectoriel) ; on écrit dessus à l'encre bleue manuscrite (comme le bon de bétonnage).
// Les cases VISA restent vides : chaque contrôleur signe lui-même la fiche imprimée.
const PVG_CTRL = ['Réception des approvisionnements des armatures', 'Conformité des armatures aux plans d\'exécution', 'Panneaux de coffrage (parements, propreté, étanchéité)', 'Limites du coffrage et niveaux de bétonnage', 'Contrôle du circuit de mise à la terre', 'Contrôle des réservations et inserts', 'Ferraillage et coffrage conformes pour le bétonnage'];
const PVG_DEF = ['c', 'c', 'c', 'c', 'na', 'c', 'c'];
// géométrie du modèle (points PDF, origine en haut à gauche) — page A4 596,5 × 843
const PVG = {
  W: 596.52, H: 843,
  fiche: [262, 34, 84, 16],
  date: [[91, 210, 36, 22], [127, 210, 36, 22], [163, 210, 73, 22]],
  ouvrage: [91, 232, 145, 22.5], axe: [91, 254.5, 145, 30.5], file: [91, 285, 145, 25],
  proc: [380, 210, 145, 22], refs: [380, 232, 145, 22.5], ind: [525, 232, 39, 22.5],
  rows: [379, 416, 454.5, 493.5, 524, 554, 585, 616.5], cols: { c: [345, 417], nc: [417, 489], na: [489, 564] },
  obs: [[18.5, 662.5, 181.5, 77], [200, 662.5, 181, 77], [381, 662.5, 183, 77]],
  dates: [[[54.5, 739.5, 36.5, 22.5], [91, 739.5, 36, 22.5], [127, 739.5, 73, 22.5]], [[200, 739.5, 36, 22.5], [236, 739.5, 36, 22.5], [272, 739.5, 109, 22.5]], [[381, 739.5, 36, 22.5], [417, 739.5, 36, 22.5], [453, 739.5, 111, 22.5]]],
  names: [[54.5, 762, 145.5, 22.5], [200, 762, 181, 22.5], [381, 762, 183, 22.5]],
};
const PVG_K = 3.6;   // pixels par point pour l'écriture (≈ 260 dpi, net à l'impression)
function pvgParse(r) {
  const el = String(r.element || '').trim(), grab = (re) => ((el.match(re) || [])[1] || '');
  const nice = (s) => s.replace(/\s*[*+]\s*/g, ' & ').replace(/\s*,\s*/g, ' & ').replace(/\s+et\s+/gi, ' & ').trim();
  const ax = grab(/\baxes?\s+([^\s]+(?:\s*(?:[*+&,]|et)\s*[^\s]+)*)/i), fi = grab(/\bfils?\s+([^\s]+(?:\s*(?:[*+&,]|et)\s*[^\s]+)*)/i);
  let base = el.replace(/\s+(?:entre\s+)?(?:axes?|fils?)\s+.*$/i, '').trim();
  if (r.niv && !new RegExp(r.niv.replace(/\+/g, '\\+'), 'i').test(base)) base += ' ' + r.niv;
  return { ouvrage: base, axe: nice(ax), file: nice(fi) };
}
// une écriture manuscrite dans une case → PNG transparent
async function pvgInk(text, w, h, size, seed, align = 'center') {
  await bonFont();
  const c = document.createElement('canvas'); c.width = Math.ceil(w * PVG_K); c.height = Math.ceil(h * PVG_K); const g = c.getContext('2d');
  text = String(text || '').trim(); if (!text) return null;
  const px = size * PVG_K; g.font = `600 ${px}px BonHand, cursive`;
  const tw = Math.min(c.width - 8, g.measureText(text).width * 1.07 + (text.split(' ').length - 1) * px * 0.12);
  const x = align === 'center' ? Math.max(4, (c.width - tw) / 2) : 3 * PVG_K, y = c.height / 2 + px * 0.3;
  bonHand(g, text, x, y, c.width - x - 4, px, seed);
  return c;
}
// coche dessinée au stylo
function pvgTick(w, h, seed) {
  const c = document.createElement('canvas'); c.width = Math.ceil(w * PVG_K); c.height = Math.ceil(h * PVG_K); const g = c.getContext('2d'), R = bonRand('tick' + seed);
  const s = Math.min(c.width, c.height) * .78, cx = c.width / 2 + (R() - .5) * s * .25, cy = c.height / 2 + (R() - .5) * s * .15;
  g.strokeStyle = BON_INK; g.lineCap = g.lineJoin = 'round'; g.lineWidth = 2 * PVG_K; g.globalAlpha = .92;
  g.beginPath(); g.moveTo(cx - s * .42, cy - s * .02); g.quadraticCurveTo(cx - s * .2, cy + s * .18, cx - s * .1, cy + s * .42);
  g.quadraticCurveTo(cx + s * .12, cy - s * .1, cx + s * (.45 + R() * .08), cy - s * (.5 + R() * .1)); g.stroke();
  return c;
}
const pvgDate = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? [m[3], m[2], m[1]] : ['', '', '']; };
// une page remplie (ajoutée à `out`)
async function pvgPage(PDFLib, out, src, d) {
  const [pg] = await out.copyPages(src, [0]); out.addPage(pg);
  const { width: PW, height: PH } = pg.getSize(), sx = PW / PVG.W, sy = PH / PVG.H;
  // toutes les écritures sont posées sur UNE image transparente de la page (une seule compression PNG au lieu d'une trentaine)
  const big = document.createElement('canvas'); big.width = Math.ceil(PVG.W * PVG_K); big.height = Math.ceil(PVG.H * PVG_K); const G = big.getContext('2d');
  const put = async (cv, [x, y, w, h]) => { if (cv) G.drawImage(cv, x * PVG_K, y * PVG_K, w * PVG_K, h * PVG_K); };
  const seed = d.seed || d.ouvrage;
  if (d.fiche) await put(await pvgInk(d.fiche, PVG.fiche[2], PVG.fiche[3], 12, seed + 'f'), PVG.fiche);
  const [dd, mm, yy] = pvgDate(d.date);
  for (const [i, t] of [dd, mm, yy].entries()) await put(await pvgInk(t, PVG.date[i][2], PVG.date[i][3], 19, seed + 'd' + i), PVG.date[i]);
  await put(await pvgInk(d.ouvrage, PVG.ouvrage[2], PVG.ouvrage[3], 18.5, seed + 'o'), PVG.ouvrage);
  await put(await pvgInk(d.axe, PVG.axe[2], PVG.axe[3], 21, seed + 'a'), PVG.axe);
  await put(await pvgInk(d.file, PVG.file[2], PVG.file[3], 21, seed + 'fi'), PVG.file);
  await put(await pvgInk(d.proc, PVG.proc[2] - 40, PVG.proc[3], 14, seed + 'p'), PVG.proc);
  // références des plans : deux lignes (ferraillage, coffrage) avec l'indice
  const [rx, ry, rw, rh] = PVG.refs, half = rh / 2 + 1;
  const ferr = d.ferr ? `ferr ${d.ferr}` : '', coff = d.coff ? `coff ${d.coff}` : '', [ix, , iw] = PVG.ind;
  await put(await pvgInk(ferr, rw - 6, half, 13.5, seed + 'rf', 'left'), [rx + 6, ry - 2, rw - 6, half]);
  await put(await pvgInk(coff, rw - 6, half, 13.5, seed + 'rc', 'left'), [rx + 6, ry + rh / 2 - .5, rw - 6, half]);
  await put(await pvgInk(d.ferrInd, iw, half, 12.5, seed + 'if'), [ix, ry - 2, iw, half]);
  await put(await pvgInk(d.coffInd, iw, half, 12.5, seed + 'ic'), [ix, ry + rh / 2 - .5, iw, half]);
  // coches
  for (let i = 0; i < 7; i++) { const k = (d.ctrl || PVG_DEF)[i]; if (!PVG.cols[k]) continue; const [x0, x1] = PVG.cols[k], y0 = PVG.rows[i], y1 = PVG.rows[i + 1]; await put(pvgTick(x1 - x0, y1 - y0, seed + i), [x0, y0, x1 - x0, y1 - y0]); }
  // observations, dates et noms (interne · externe · extérieur) — VISA laissé vide
  for (let j = 0; j < 3; j++) {
    const o = (d.obs || [])[j]; if (o) await put(await pvgInk(o, PVG.obs[j][2] - 8, 18, 14, seed + 'ob' + j, 'left'), [PVG.obs[j][0] + 4, PVG.obs[j][1] + 6, PVG.obs[j][2] - 8, 18]);
    const dt = (d.dates || [])[j]; if (dt) { const parts = pvgDate(dt); for (let i = 0; i < 3; i++) await put(await pvgInk(parts[i], PVG.dates[j][i][2], PVG.dates[j][i][3], 17.5, seed + 'dt' + j + i), PVG.dates[j][i]); }
    const nm = (d.names || [])[j]; if (nm) await put(await pvgInk(nm, PVG.names[j][2], PVG.names[j][3], 17.5, seed + 'n' + j), PVG.names[j]);
  }
  const png = await out.embedPng(await new Promise(r => big.toBlob(b => b.arrayBuffer().then(r), 'image/png')));
  pg.drawImage(png, { x: 0, y: 0, width: PW, height: PH }); big.width = big.height = 0;
}
async function pvgTemplate(p, replace) {
  if (p.pvTpl && !replace) { const f = await DB.get('files', p.pvTpl); if (f && f.blob) return f.blob; }
  if (!replace && !(await confirmBox('Choisissez une fois le modèle PDF vierge de la « Fiche de contrôle de ferraillage, coffrage, réservations et inserts ». Il sera gardé pour tout le projet (et dans Drive).', 'Choisir le PDF'))) return null;
  const [file] = await pickFiles({ accept: 'application/pdf', multiple: false }); if (!file) return null;
  const rec = await DB.put('files', { projectId: p.id, blob: file, mime: 'application/pdf', role: 'pvtpl', name: 'Modèle fiche de contrôle.pdf' });
  if (p.pvTpl && p.pvTpl !== rec.id) await DB.del('files', p.pvTpl).catch(() => {});
  p.pvTpl = rec.id; await DB.put('projects', p); toast('Modèle enregistré ✓'); return file;
}
// données d'une fiche (gardées dans la ligne : on peut les modifier et regénérer)
function pvgData(p, day, r) {
  const C = p.pvCfg = p.pvCfg || {}, P = pvgParse(r), o = r.pv || {};
  return { fiche: o.fiche || '', date: o.date || day.date, ouvrage: o.ouvrage ?? P.ouvrage, axe: o.axe ?? P.axe, file: o.file ?? P.file, proc: o.proc ?? (C.proc || ''),
    ferr: o.ferr ?? '', ferrInd: o.ferrInd ?? (r.indFer || ''), coff: o.coff ?? '', coffInd: o.coffInd ?? (r.indCof || ''),
    ctrl: o.ctrl || [...(C.ctrl || PVG_DEF)], obs: o.obs || ['', '', ''], names: o.names || [...(C.names || ['', '', ''])], dates: o.dates || [day.date, day.date, ''], seed: r.id };
}
async function pvgEdit(p, day, r) {
  const d = pvgData(p, day, r), O = [{ value: 'c', label: 'Conforme' }, { value: 'nc', label: 'Non conforme' }, { value: 'na', label: 'Non applicable' }, { value: '', label: '— vide —' }];
  const res = await formSheet(`Fiche de contrôle · ${d.ouvrage || r.element}`, [
    { name: 'date', label: 'Date de contrôle', type: 'date', value: d.date }, { name: 'fiche', label: 'Fiche N° (optionnel)', value: d.fiche },
    { name: 'ouvrage', label: 'Ouvrage', value: d.ouvrage }, { name: 'axe', label: 'Axe', value: d.axe, placeholder: 'Ex : D3 & D4' }, { name: 'file', label: 'File', value: d.file, placeholder: 'Ex : H & K' },
    { name: 'proc', label: 'Référence de procédure', value: d.proc },
    { name: 'ferr', label: 'Plan de ferraillage N°', value: d.ferr, placeholder: 'Ex : 067452' }, { name: 'ferrInd', label: 'Indice ferraillage', value: d.ferrInd, placeholder: 'Ex : PE00' },
    { name: 'coff', label: 'Plan de coffrage N°', value: d.coff, placeholder: 'Ex : 066274' }, { name: 'coffInd', label: 'Indice coffrage', value: d.coffInd, placeholder: 'Ex : PE01' },
    ...PVG_CTRL.map((t, i) => ({ name: 'c' + i, label: t, type: 'select', value: d.ctrl[i] || '', options: O })),
    { name: 'n0', label: 'Contrôle interne · nom', value: d.names[0] }, { name: 'd0', label: 'Contrôle interne · date', type: 'date', value: d.dates[0] }, { name: 'o0', label: 'Contrôle interne · observation', value: d.obs[0] },
    { name: 'n1', label: 'Contrôle externe · nom', value: d.names[1] }, { name: 'd1', label: 'Contrôle externe · date', type: 'date', value: d.dates[1] }, { name: 'o1', label: 'Contrôle externe · observation', value: d.obs[1] },
    { name: 'n2', label: 'Contrôle extérieur · nom', value: d.names[2] }, { name: 'd2', label: 'Contrôle extérieur · date', type: 'date', value: d.dates[2] }, { name: 'o2', label: 'Contrôle extérieur · observation', value: d.obs[2] },
  ], { okLabel: 'Générer la fiche (PDF)', danger: r.pvGenId ? 'Supprimer la fiche' : null });
  if (!res) return null;
  if (res.__danger) { if (!(await confirmBox('Supprimer cette fiche générée (aussi dans Drive) ?'))) return null; if (r.pvGenId) await DB.del('files', r.pvGenId).catch(() => {}); r.pvGenId = null; return 'del'; }
  r.pv = { fiche: res.fiche, date: res.date, ouvrage: res.ouvrage, axe: res.axe, file: res.file, proc: res.proc, ferr: res.ferr, ferrInd: res.ferrInd, coff: res.coff, coffInd: res.coffInd,
    ctrl: PVG_CTRL.map((_, i) => res['c' + i]), names: [res.n0, res.n1, res.n2], dates: [res.d0, res.d1, res.d2], obs: [res.o0, res.o1, res.o2] };
  const C = p.pvCfg = p.pvCfg || {}; C.proc = res.proc; C.names = [res.n0, res.n1, res.n2]; C.ctrl = r.pv.ctrl; await DB.put('projects', p);
  return 'ok';
}
// génère (ou regénère) la fiche d'une ligne → fichier PDF gardé dans le projet (et Drive)
async function pvgMake(p, day, rows) {
  const PDFLib = await needPdfLib(), tb = await pvgTemplate(p); if (!tb) return null;
  const src = await PDFLib.PDFDocument.load(await tb.arrayBuffer(), { ignoreEncryption: true });
  const made = [];
  for (const r of rows) {
    const out = await PDFLib.PDFDocument.create(); await pvgPage(PDFLib, out, src, pvgData(p, day, r));
    const blob = new Blob([await out.save()], { type: 'application/pdf' }), nm = safeName(`${pvgData(p, day, r).ouvrage} ${pvgData(p, day, r).axe}`.trim()) || 'ouvrage';
    const rec = await DB.put('files', { projectId: p.id, blob, mime: 'application/pdf', role: 'pvgen', name: `Fiche ${day.date} ${nm}.pdf` });
    if (r.pvGenId && r.pvGenId !== rec.id) await DB.del('files', r.pvGenId).catch(() => {});
    r.pvGenId = rec.id; made.push(rec);
  }
  return made;
}
// depuis la ligne du programme : modifier → générer → ouvrir / partager / supprimer
async function pvgOpen(p, day, r, save) {
  for (;;) {
    const v = r.pvGenId ? await menu(`Fiche · ${pvgData(p, day, r).ouvrage}`, [{ label: 'Ouvrir la fiche', icon: 'pdf', value: 'open' }, { label: 'Modifier puis regénérer', icon: 'edit', value: 'edit' }, { label: 'Partager (WhatsApp, imprimer…)', icon: 'share', value: 'share' }, { label: 'Supprimer la fiche', icon: 'trash', danger: true, value: 'del' }]) : 'edit';
    if (!v) return;
    if (v === 'open' || v === 'share') { const f = await DB.get('files', r.pvGenId); if (!f) { r.pvGenId = null; continue; } if (v === 'open') openFileRecord(f, f.name); else shareBlob(f.blob, f.name); return; }
    if (v === 'del') { if (await confirmBox('Supprimer cette fiche (aussi dans Drive) ?')) { await DB.del('files', r.pvGenId).catch(() => {}); r.pvGenId = null; await save(); toast('Fiche supprimée'); } return; }
    const e = await pvgEdit(p, day, r); if (!e) return;
    if (e === 'del') { await save(); toast('Fiche supprimée'); return; }
    const ld = loading('Écriture de la fiche…'); let made; try { made = await pvgMake(p, day, [r]); } catch (er) { ld.close(); return alertBox('Fiche impossible : ' + (er.message || er)); } ld.close();
    if (!made) return; await save(); toast('Fiche générée ✓ (aussi dans Drive)'); openFileRecord(made[0], made[0].name); return;
  }
}
// toutes les fiches du jour en un seul PDF (et une fiche par ouvrage gardée)
async function pvgDay(p, day, save) {
  const rows = day.rows.filter(r => r.element); if (!rows.length) return toast('Aucun ouvrage');
  const ld = loading('Écriture des fiches…');
  try {
    const made = await pvgMake(p, day, rows); if (!made) { ld.close(); return; }
    const PDFLib = await needPdfLib(), all = await PDFLib.PDFDocument.create();
    for (const f of made) { const d = await PDFLib.PDFDocument.load(await f.blob.arrayBuffer()); const pgs = await all.copyPages(d, d.getPageIndices()); pgs.forEach(x => all.addPage(x)); }
    await save(); ld.close();
    const blob = new Blob([await all.save()], { type: 'application/pdf' });
    await shareBlob(blob, `Fiches de controle ${day.date}.pdf`);
  } catch (e) { ld.close(); alertBox('Fiches impossibles : ' + (e.message || e)); }
}
