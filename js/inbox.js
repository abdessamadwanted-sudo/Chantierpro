// ================= Partager → Chantier : photos reçues depuis la galerie, rangées dans une partie d'ouvrage =================
// Android ouvre l'application (activité « SendIntent ») avec les photos partagées ; on choisit projet → jour → ouvrage → type.
async function checkSharedIntent() {
  if (!isNative() || !window.Capacitor || !Capacitor.registerPlugin) return false;
  const SI = Capacitor.registerPlugin('SendIntent');
  let r; try { r = await SI.checkSendIntentReceived(); } catch (e) { return false; }
  if (!r || !r.url) return false;
  const items = [r, ...((r.additionalItems || []))].filter(x => x && x.url && /^image\//.test(x.type || 'image/'));
  const files = [];
  for (const [i, x] of items.entries()) {
    const path = decodeURIComponent(x.url);
    try {
      const blob = await (await fetch(Capacitor.convertFileSrc(path))).blob();
      files.push(new File([blob], x.title || `photo_${i + 1}.jpg`, { type: blob.type || 'image/jpeg' }));
    } catch (e) {
      try { const FS = Capacitor.Plugins.Filesystem; const d = await FS.readFile({ path }); files.push(new File([base64ToBlob(d.data, 'image/jpeg')], x.title || `photo_${i + 1}.jpg`, { type: 'image/jpeg' })); } catch (e2) { console.warn('share read', e2); }
    }
    try { await Capacitor.Plugins.Filesystem.deleteFile({ path }); } catch (e) {}
  }
  if (!files.length) { toast('Aucune photo reçue'); try { SI.finish(); } catch (e) {} return true; }
  await attachSharedPhotos(files);
  try { SI.finish(); } catch (e) {}
  return true;
}

function attachSharedPhotos(files) {
  return new Promise(async (resolve) => {
    const el = document.createElement('div'); el.className = 'fullpage inbox'; document.body.appendChild(el);
    const urls = files.map(f => URL.createObjectURL(f));
    const projects = (await DB.all('projects')).sort((a, b) => (b.lastOpened || b.updatedAt || 0) - (a.lastOpened || a.updatedAt || 0));
    let pid = localStorage.getItem('inbox.pid') || (projects[0] || {}).id, kind = localStorage.getItem('inbox.kind') || 'Ferraillage', dayId = null, q = '';
    const done = (msg) => { urls.forEach(u => URL.revokeObjectURL(u)); el.remove(); if (msg) toast(msg); resolve(); };
    const draw = async () => {
      if (!projects.find(p => p.id === pid)) pid = (projects[0] || {}).id;
      const days = pid ? (await DB.byProject('receptions', pid)).filter(d => kindOf(d) === kind).sort((a, b) => (b.date || '').localeCompare(a.date || '')) : [];
      if (!days.find(d => d.id === dayId)) dayId = (days.find(d => d.date === todayISO()) || days[0] || {}).id || null;
      const day = days.find(d => d.id === dayId);
      const rows = day ? day.rows.map((r, i) => ({ r, i })).filter(({ r }) => r.element && (!q || fuzzyHas(`${r.zone} ${r.niv} ${r.element}`, q))) : [];
      el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('close')}</button><h1 style="flex:1;font-size:17px">Ajouter ${files.length} photo(s)</h1></div>
        <div class="ib-thumbs">${urls.map(u => `<img src="${u}">`).join('')}</div>
        <div class="ib-body">
          <div class="ib-l">Projet</div><select data-pid>${projects.map(p => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
          <div class="kseg ib-k"><button data-k="Ferraillage" class="${kind === 'Ferraillage' ? 'on' : ''}">Réception ferraillage</button><button data-k="Bétonnage" class="${kind === 'Bétonnage' ? 'on' : ''}">Bétonnage</button></div>
          <div class="ib-l">Jour</div>${days.length ? `<select data-day>${days.slice(0, 60).map(d => `<option value="${d.id}" ${d.id === dayId ? 'selected' : ''}>${fmtDate(d.date)}${d.date === todayISO() ? " · aujourd'hui" : ''} · ${(d.rows || []).filter(r => r.element).length} ouvrage(s)</option>`).join('')}</select>` : '<div class="cr-none">Aucun tableau pour ce projet.</div>'}
          ${day && kind === 'Ferraillage' ? `<button class="ib-pv" data-a="pv">${icon('report')} <span class="grow">Ajouter comme <b>PV du jour</b></span>${icon('chevright')}</button>` : ''}
          ${day ? `<div class="ib-l">Partie d'ouvrage</div><div class="search">${icon('search')}<input placeholder="Rechercher (ex : CR 78, voile…)" value="${esc(q)}"></div>
            <div class="ib-rows">${rows.map(({ r, i }) => `<button class="ib-row" data-i="${i}"><span class="ib-z">${esc(r.zone || '–')}</span><span class="ib-n">${esc(r.niv || '')}</span><span class="grow">${esc(r.element)}</span><span class="ib-c">${(r.photoIds || []).length + (r.retourIds || []).length ? '📷 ' + ((r.photoIds || []).length + (r.retourIds || []).length) : ''}</span></button>`).join('') || '<div class="cr-none">Aucun ouvrage trouvé.</div>'}</div>` : ''}
          <button class="btn ghost small" data-a="gen" style="margin-top:10px">${icon('camera')} Photos du projet (sans ouvrage)</button>
        </div>`;
      $('[data-a=x]', el).onclick = () => done();
      const ps = $('[data-pid]', el); if (ps) ps.onchange = () => { pid = ps.value; localStorage.setItem('inbox.pid', pid); dayId = null; draw(); };
      $$('[data-k]', el).forEach(b => b.onclick = () => { kind = b.dataset.k; localStorage.setItem('inbox.kind', kind); dayId = null; draw(); });
      const ds = $('[data-day]', el); if (ds) ds.onchange = () => { dayId = ds.value; draw(); };
      const si = $('.search input', el); if (si) si.oninput = (e) => { q = e.target.value; clearTimeout(el._t); el._t = setTimeout(() => { draw().then(() => { const n = $('.search input', el); if (n) { n.focus(); n.setSelectionRange(q.length, q.length); } }); }, 250); };
      const save = async (opts) => { const ld = loading('Enregistrement…'); try { const out = []; for (const f of files) out.push(await saveImageFile(pid, f, 'photo', { ...opts })); return out; } finally { ld.close(); } };
      const pv = $('[data-a=pv]', el); if (pv) pv.onclick = async () => {
        const scan = await menu('PV du jour', [{ label: 'Recadrer comme un scan (conseillé)', icon: 'pdf', value: 'scan' }, { label: 'Garder les photos telles quelles', icon: 'image', value: 'raw' }]); if (!scan) return;
        let fl = files; if (scan === 'scan') { const sc = await scanDocuments(files); if (!sc || !sc.length) return; fl = sc; }
        const ld = loading('Enregistrement…'); const recs = []; try { for (const f of fl) recs.push(await saveImageFile(pid, f, 'photo', { source: `PV ${fmtDate(day.date)}`, hq: scan === 'scan' })); } finally { ld.close(); }
        day.pvIds = [...(day.pvIds || []), ...recs.map(x => x.id)]; if (day.pvPdfId) { await DB.del('files', day.pvPdfId); day.pvPdfId = null; }
        await DB.put('receptions', day); done(`${recs.length} PV ajouté(s) au ${fmtDate(day.date)} ✓`);
      };
      $$('[data-i]', el).forEach(b => b.onclick = async () => {
        const r = day.rows[+b.dataset.i], B = kind === 'Bétonnage';
        const v = await menu(r.element, [{ label: 'Photos', icon: 'camera', value: 'photo' }, { label: B ? 'Défaut (ségrégation…) — photos' : 'Réserve — photos', icon: 'report', value: 'res' }, { label: B ? 'Réparation — photos' : 'Retour / levée de réserve — photos', icon: 'check', value: 'ret' }]);
        if (!v) return;
        const recs = await save({ source: `${B ? 'Bétonnage' : 'Réception'} ${fmtDate(day.date)} · ${r.element}` });
        if (v === 'ret') { r.retourIds = [...(r.retourIds || []), ...recs.map(x => x.id)]; if (r.status === 'reserve' && !r.liftedAt && await confirmBox(B ? 'Marquer comme réparé aujourd\'hui ?' : 'Marquer la réserve comme levée aujourd\'hui ?', 'Oui')) r.liftedAt = todayISO(); }
        else { r.photoIds = [...(r.photoIds || []), ...recs.map(x => x.id)]; if (v === 'res') r.status = 'reserve'; }
        await DB.put('receptions', day); done(`${recs.length} photo(s) ajoutée(s) à « ${r.element} » ✓`);
      });
      $('[data-a=gen]', el).onclick = async () => { const recs = await save({ source: 'Partage galerie' }); done(`${recs.length} photo(s) ajoutée(s) aux photos du projet ✓`); };
    };
    draw();
  });
}

// ---------- Rappel : photos déjà sauvegardées dans Drive depuis plus de 3 jours → libérer le téléphone (Drive garde tout) ----------
const isPhotoFile = (f) => f && f.blob && f.driveId && f.drivePath && /^image\//.test(f.mime || f.blob.type || '') && !['plan', 'plansrc', 'croquis', 'doc', 'career', 'board', 'sketchbg', 'sig'].includes(f.role);
async function oldDrivePhotos() {
  const lim = Date.now() - 3 * 864e5;
  return (await DB.all('files')).filter(f => isPhotoFile(f) && (f.createdAt || 0) < lim && !(f.lastUsed && f.lastUsed > lim));
}
async function freeOldPhotos() {
  const list = await oldDrivePhotos(); if (!list.length) return toast('Rien à libérer');
  const mb = list.reduce((a, f) => a + (f.blob.size || 0), 0) / 1048576;
  if (!await confirmBox(`Libérer ${list.length} photo(s) (${mb.toFixed(1)} Mo) du téléphone ?\nElles restent dans Google Drive, rangées par ouvrage, et se téléchargent toutes seules quand vous les ouvrez.`, 'Libérer')) return;
  const ld = loading('Libération…');
  try { for (const f of list) { f.blob = null; BlobURL.drop(f.id); await DB.putRaw('files', f); } } finally { ld.close(); }
  try { localStorage.setItem('photoFreeAt', String(Date.now())); } catch (e) {}
  toast(`${mb.toFixed(1)} Mo libérés ✓`); renderHome();
}
async function photoReminder() {
  if (!Sync.enabled()) return null;
  const list = await oldDrivePhotos(); if (list.length < 5) return null;
  const mb = list.reduce((a, f) => a + (f.blob.size || 0), 0) / 1048576;
  // notification une fois par jour au plus
  try {
    const last = +localStorage.getItem('photoNotifAt') || 0, LN = window.Capacitor?.Plugins?.LocalNotifications;
    if (LN && Date.now() - last > 864e5) {
      localStorage.setItem('photoNotifAt', String(Date.now()));
      await LN.schedule({ notifications: [{ id: 1999000001, title: '📷 Photos sauvegardées dans Drive', body: `${list.length} photos (${mb.toFixed(0)} Mo) ont plus de 3 jours — libérez de l'espace sur le téléphone`, schedule: { at: new Date(Date.now() + 2000) }, channelId: 'rappels', extra: { action: 'freephotos' } }] });
    }
  } catch (e) {}
  return { n: list.length, mb };
}

// ---------- Libérer des photos choisies (ouvrage, jour…) : vérifiées dans Drive puis retirées du téléphone ----------
// Les photos restent dans Google Drive (rangées par ouvrage) ; une miniature reste visible ; la photo complète se re-télécharge si on l'ouvre.
async function freeFilesUI(ids, title = 'Photos') {
  ids = [...new Set((ids || []).filter(Boolean))];
  if (!Sync.enabled()) return alertBox('Connectez d\'abord Google Drive (Paramètres › Google Drive) : les photos doivent être sauvegardées avant d\'être retirées du téléphone.');
  const ld = loading('Sauvegarde dans Drive…');
  try { await Promise.race([Sync.run({ quiet: true }), new Promise(r => setTimeout(r, 60000))]); } catch (e) {}
  ld.set('Vérification…');
  const recs = []; for (const id of ids) { const f = await DB.peek('files', id); if (f) recs.push(f); }
  ld.close();
  const ok = recs.filter(f => f.blob && f.driveId && f.drivePath), wait = recs.filter(f => f.blob && !(f.driveId && f.drivePath)), done = recs.filter(f => !f.blob && f.driveId);
  if (!ok.length) return alertBox(wait.length ? `${wait.length} photo(s) pas encore dans Drive (connexion ?). Réessayez quand l\'envoi est terminé.` : done.length ? `✅ Ces ${done.length} photo(s) sont déjà libérées : elles sont uniquement dans Drive.` : 'Aucune photo.');
  const sel = new Set(ok.map(f => f.id));
  const s = sheet(`<div class="form fr-sheet"></div>`, { title: `Libérer · ${title}` });
  const box = $('.fr-sheet', s.el);
  const draw = () => {
    const mb = ok.filter(f => sel.has(f.id)).reduce((a, f) => a + (f.blob.size || 0), 0) / 1048576;
    box.innerHTML = `<div class="fr-info">☁ <b>${ok.length}</b> photo(s) vérifiée(s) dans Drive${wait.length ? ` · <span class="w">${wait.length} pas encore envoyée(s)</span>` : ''}${done.length ? ` · ${done.length} déjà libérée(s)` : ''}</div>
      <div class="fr-tools"><button type="button" class="btn ghost small" data-fa="all">Tout</button><button type="button" class="btn ghost small" data-fa="none">Aucune</button></div>
      <div class="fr-grid">${ok.map(f => `<button type="button" class="fr-t ${sel.has(f.id) ? 'on' : ''}" data-f="${f.id}"><img src="${BlobURL.get(f.id, f.blob)}"><i>✓</i><small>☁</small></button>`).join('')}</div>
      <div class="fr-note">Elles restent dans <b>Google Drive</b> (dossier de l'ouvrage). Une miniature reste dans l'application ; la photo complète se télécharge si vous l'ouvrez.</div>
      <button class="btn" data-fa="go" ${sel.size ? '' : 'disabled'}>☁ Libérer ${sel.size} photo(s) · ${mb.toFixed(1)} Mo</button>`;
    $$('[data-f]', box).forEach(b => b.onclick = () => { sel.has(b.dataset.f) ? sel.delete(b.dataset.f) : sel.add(b.dataset.f); draw(); });
    $('[data-fa=all]', box).onclick = () => { ok.forEach(f => sel.add(f.id)); draw(); };
    $('[data-fa=none]', box).onclick = () => { sel.clear(); draw(); };
    $('[data-fa=go]', box).onclick = async () => {
      const l2 = loading('Libération…'); let n = 0, freed = 0;
      try { for (const f of ok.filter(x => sel.has(x.id))) { try { await Thumbs.get(f.id); } catch (e) {} freed += f.blob.size || 0; f.blob = null; f.freed = true; f.freedAt = Date.now(); delete f.lastUsed; BlobURL.drop(f.id); await DB.putRaw('files', f); n++; } }
      finally { l2.close(); }
      s.close(); toast(`☁ ${n} photo(s) libérée(s) · ${(freed / 1048576).toFixed(1)} Mo gagnés`);
      if (typeof freeFilesUI.onDone === 'function') freeFilesUI.onDone();
    };
  };
  draw();
  return new Promise(res => { s.onClose = res; });
}
// miniature d'un fichier (sans re-télécharger une photo libérée)
function fileThumbHTML(f) { return f.blob ? `<img src="${BlobURL.get(f.id, f.blob)}">` : `<img data-thumb="${f.id}" alt=""><span class="cloud-b">☁</span>`; }
