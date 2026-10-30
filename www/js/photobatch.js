// ================= v1.0.41 — Photos en masse : choisir plusieurs photos d'un coup, les classer, envoi en arrière-plan =================
// Les photos sont enregistrées tout de suite sur le téléphone (rien ne bloque l'écran), puis la synchro les envoie dans Drive
// en arrière-plan, rangées selon la rubrique choisie : Projet › rubrique › mois › jour › niveau › ouvrage.
// La synchro reprend seule au retour du réseau ou à la prochaine ouverture (rien n'est perdu).
const PB_DEST = [['rec', '🔩 Réception ferraillage'], ['bet', '🧱 Bétonnage'], ['res', '⚠️ Réserves'], ['rap', '📝 Rapports journaliers'], ['lot', '📊 Lot & niveau'], ['ph', '📷 Photos générales']];
async function openPhotoBatch(p, pre = {}) {
  p = p || App.project; if (!p) return toast('Ouvrez d\'abord un projet');
  const lots = typeof lsLots === 'function' ? lsLots(p) : [], nivs = typeof lsNiv === 'function' ? lsNiv(p) : [];
  let q = 'opt'; try { q = localStorage.getItem('pb.q') || 'opt'; } catch (e) {}
  const r = await formSheet('📷 Photos en masse', [
    { name: 'info', type: 'info', label: 'Comment ça marche', value: 'Choisissez la rubrique, puis toutes les photos d\'un coup. Elles sont gardées sur le téléphone et partent dans Drive en arrière-plan, rangées automatiquement. Vous pouvez continuer à travailler.' },
    { name: 'dest', label: 'Rubrique', type: 'select', value: pre.dest || 'rec', options: PB_DEST.map(([v, l]) => ({ value: v, label: l })) },
    ...(lots.length ? [{ name: 'lot', label: 'Lot (si « Lot & niveau »)', type: 'select', value: pre.lot || '', options: [{ value: '', label: '—' }, ...lots.map(l => ({ value: l.id, label: l.name }))] }] : []),
    { name: 'niv', label: 'Niveau', value: pre.niv || '', list: nivs, placeholder: 'Ex : R+1' },
    { name: 'ouv', label: 'Ouvrage / élément', value: pre.ouv || '', placeholder: 'Ex : Voile V12, Poteaux P1 à P8' },
    { name: 'date', label: 'Date', type: 'date', value: pre.date || todayISO() },
    { name: 'q', label: 'Qualité', type: 'select', value: q, options: [{ value: 'orig', label: 'Originale (fichiers lourds)' }, { value: 'opt', label: 'Optimisée — 2400 px (conseillé)' }] },
  ], { okLabel: 'Choisir les photos' });
  if (!r) return;
  try { localStorage.setItem('pb.q', r.q); } catch (e) {}
  const files = await pickFiles({ accept: 'image/*', multiple: true }); if (!files.length) return;
  const lot = lots.find(l => l.id === r.lot);
  const grp = { dest: r.dest, lot: lot ? lot.name : '', niv: (r.niv || '').trim(), ouv: (r.ouv || '').trim(), date: r.date || todayISO() };
  const ld = loading(`Enregistrement 0/${files.length}…`); let n = 0;
  try {
    for (const f of files) {
      let blob = f;
      if (r.q === 'opt' && typeof compressImage === 'function') { try { const c = await compressImage(f, 2400, 0.88); blob = (c && c.blob) || f; } catch (e) { blob = f; } }
      n++; await DB.put('files', { projectId: p.id, blob, mime: blob.type || f.type || 'image/jpeg', name: `${grp.ouv || grp.niv || 'photo'} ${n}`.trim() + '.jpg', role: 'photo', grp });
      ld.set(`Enregistrement ${n}/${files.length}…`);
    }
  } finally { ld.close(); }
  toast(`📷 ${n} photo(s) enregistrée(s) — envoi vers Drive en arrière-plan`, { ms: 4000 });
  try { if (typeof Sync !== 'undefined' && Sync.schedule) Sync.schedule(800); } catch (e) {}
  return n;
}
// chemin Drive d'une photo envoyée en masse (utilisé par la synchro)
function pbPath(f, D, P, moisDe, clean) {
  const g = f.grp || {}, base = { rec: D.rec, bet: D.bet, res: D.res, rap: D.rap, ph: D.ph }[g.dest] || (g.dest === 'lot' ? '10 - Lots' : D.ph);
  const segs = [P[f.projectId] || 'Projet', base];
  if (g.dest === 'lot' && g.lot) segs.push(g.lot);
  segs.push(moisDe(g.date), g.date || 'Sans date');
  if (g.niv) segs.push(g.niv); if (g.ouv) segs.push(g.ouv);
  return segs.map(s => clean(s));
}
// v1.0.41 : organisation des dossiers Drive du projet — renommer / renuméroter les rubriques (déplace les fichiers, sans doublon)
async function openDriveNames(p) {
  p = p || App.project; if (!p || typeof Sync === 'undefined' || !Sync.DIRS) return;
  const names = [...new Set([...Object.values(Sync.DIRS), 'Réserves', 'Rapports journaliers', 'Formulaires', '10 - Lots'])];
  const cur = p.driveNames || {};
  const r = await formSheet('🗂 Dossiers Drive du projet', [
    { name: 'info', type: 'info', label: p.name, value: 'Renommez ou renumérotez chaque rubrique (ex. « 02 - PV Réception »). Les fichiers déjà dans Drive sont déplacés automatiquement à la prochaine synchro, sans doublon. Laissez vide pour garder le nom par défaut.' },
    ...names.map((n, i) => ({ name: 'n' + i, label: n, value: cur[n] || '', placeholder: n })),
  ], { okLabel: 'Enregistrer', danger: Object.keys(cur).length ? 'Revenir aux noms par défaut' : null });
  if (!r) return;
  if (r.__danger) delete p.driveNames;
  else { const o = {}; names.forEach((n, i) => { const v = (r['n' + i] || '').trim(); if (v && v !== n) o[n] = v; }); if (Object.keys(o).length) p.driveNames = o; else delete p.driveNames; }
  await DB.put('projects', p); toast('Dossiers Drive enregistrés ✓ — rangement à la prochaine synchro');
  try { Sync.schedule(800); } catch (e) {}
}
