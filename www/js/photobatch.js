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
    ...(typeof BgUp !== 'undefined' && BgUp.on() ? [{ name: 'net', label: 'Envoi vers Drive (même application fermée)', type: 'select', value: BgUp.wifi() ? 'wifi' : 'all', options: [{ value: 'all', label: '4G et Wi-Fi' }, { value: 'wifi', label: 'Wi-Fi seulement' }] }] : []),
  ], { okLabel: 'Choisir les photos' });
  if (!r) return;
  try { localStorage.setItem('pb.q', r.q); if (r.net) localStorage.setItem('bg.wifi', r.net === 'wifi' ? '1' : '0'); } catch (e) {}
  const files = await pickFiles({ accept: 'image/*', multiple: true }); if (!files.length) return;
  const lot = lots.find(l => l.id === r.lot);
  const grp = { dest: r.dest, lot: lot ? lot.name : '', niv: (r.niv || '').trim(), ouv: (r.ouv || '').trim(), date: r.date || todayISO() };
  // v1.0.44 : rien ne bloque — enregistrement immédiat, réduction puis envoi en arrière-plan (pastille d'envoi en bas)
  let n = files.length;
  if (typeof PhotoQ !== 'undefined') await PhotoQ.save(p.id, files.map((f, i) => { try { Object.defineProperty(f, 'name', { value: `${grp.ouv || grp.niv || 'photo'} ${i + 1}`.trim() + '.jpg' }); } catch (e) {} return f; }), { grp, hq: true });
  else n = 0;
  toast(`📷 ${n} photo(s) — envoi vers Drive en arrière-plan${typeof BgUp !== 'undefined' && BgUp.on() ? ', même application fermée' : ''}`, { ms: 4000 });
  try { if (!localStorage.getItem('bg.notifAsked') && window.Capacitor && window.Capacitor.Plugins.BgUpload) { localStorage.setItem('bg.notifAsked', '1'); window.Capacitor.Plugins.BgUpload.notifPermission({ ask: true }); } } catch (e) {}
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
  // v1.0.47 : rangement intelligent (Zone › Niveau › Lot › Indice / Date) — aperçu avant de déplacer les fichiers déjà dans Drive
  const w = await menu('🗂 Dossiers Drive du projet', [
    { label: p.driveV2 ? '✓ Rangement intelligent actif' : '✨ Réorganiser Drive (aperçu)', sub: 'Plans › Niveau › Lot › Niveau_Lot_Ind_date · anciens indices à part', icon: 'folder', value: 'v2' },
    { label: 'Renommer / renuméroter les rubriques', icon: 'edit', value: 'names' }]);
  if (w === 'v2') return driveReorg(p);
  if (w !== 'names') return;
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

// v1.0.47 : aperçu du rangement intelligent — rien n'est supprimé ni renvoyé : les fichiers déjà dans Drive sont seulement déplacés
async function driveReorg(p) {
  if (p.driveV2) { if (await confirmBox('Le rangement intelligent est actif. Revenir à l\'ancien rangement ? (les fichiers seront redéplacés)', 'Revenir')) { p.driveV2 = false; await DB.put('projects', p); try { Sync.schedule(800); } catch (e) {} toast('Ancien rangement rétabli à la prochaine synchro'); } return; }
  const ld = loading('Préparation de l\'aperçu…'); let moves = [];
  try {
    const was = p.driveV2; p.driveV2 = true; await DB.put('projects', p);
    const paths = await Sync.buildPaths(), files = (await DB.byProject('files', p.id)).filter(f => f.driveId);
    for (const f of files) { const np = Sync.pathFor(f, paths), k = JSON.stringify(np); if (f.drivePath && f.drivePath !== k) moves.push({ f, np }); }
    p.driveV2 = was; await DB.put('projects', p);
  } finally { ld.close(); }
  const by = {}; for (const m of moves) { const k = m.np.segs.slice(1).join(' › '); by[k] = (by[k] || 0) + 1; }
  const L = Object.entries(by).sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true }));
  const ok = await confirmBox(moves.length ? `${moves.length} fichier(s) déjà dans Drive seront déplacés (rien n'est supprimé ni renvoyé) :\n\n${L.slice(0, 18).map(([k, n]) => `• ${k} (${n})`).join('\n')}${L.length > 18 ? `\n… et ${L.length - 18} autre(s) dossier(s)` : ''}` : 'Aucun fichier à déplacer : les nouveaux fichiers seront rangés directement.', 'Réorganiser');
  if (!ok) return;
  p.driveV2 = true; await DB.put('projects', p); toast('Rangement intelligent activé ✓ — déplacement à la synchro');
  try { Sync.schedule(500); } catch (e) {}
}
