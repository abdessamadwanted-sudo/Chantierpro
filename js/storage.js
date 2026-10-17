// ================= Stockage & sauvegarde : ce qui prend de la place, ce qui est déjà dans Drive, libérer, sauvegarder =================
const ST_CATS = [
  ['photo', '📷', 'Photos', (f) => /^image\//.test(f.mime || (f.blob && f.blob.type) || '') && !['plan', 'plansrc', 'croquis', 'doc', 'career', 'board', 'sketchbg', 'sig'].includes(f.role)],
  ['plan', '🗺️', 'Plans (aperçus, PDF, DWG)', (f) => f.role === 'plan' || f.role === 'plansrc' || f.role === 'dxf'],
  ['doc', '📄', 'Documents (CPS, PV, PDF…)', (f) => ['doc', 'career', 'pv', 'report'].includes(f.role) || /pdf/.test(f.mime || '')],
  ['sig', '✍️', 'Signatures', (f) => f.role === 'sig'],
  ['other', '📦', 'Autres (croquis, dessins…)', () => true],
];
const mbTxt = (b) => b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' Go' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' Mo' : Math.max(0, Math.round(b / 1024)) + ' Ko';

async function storageStats() {
  const files = await DB.all('files'), projects = await DB.all('projects');
  const cat = (f) => ST_CATS.find(c => c[3](f))[0];
  const S = { cats: {}, proj: {}, total: 0, local: 0, onDrive: 0, notSent: 0, notSentB: 0, freed: 0, files };
  ST_CATS.forEach(([k]) => S.cats[k] = { n: 0, b: 0, drive: 0, driveB: 0, freed: 0, wait: 0 });
  for (const f of files) {
    const k = cat(f), C = S.cats[k], sz = f.blob ? (f.blob.size || 0) : 0; f._cat = k;
    if (f.blob) { C.n++; C.b += sz; S.local += sz; S.proj[f.projectId] = (S.proj[f.projectId] || 0) + sz; }
    if (f.driveId) { C.drive++; if (f.blob) C.driveB += sz; S.onDrive++; }
    if (!f.blob && f.driveId) { C.freed++; S.freed++; }
    if (f.blob && !f.driveId) { C.wait++; S.notSent++; S.notSentB += sz; }
  }
  S.projects = projects.map(p => ({ p, b: S.proj[p.id] || 0 })).sort((a, b) => b.b - a.b);
  try { if (navigator.storage && navigator.storage.estimate) S.est = await navigator.storage.estimate(); } catch (e) {}
  return S;
}

async function openStorage() {
  const el = document.createElement('div'); el.className = 'fullpage st-page'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove()), close = () => { unBack(); el.remove(); };
  const draw = async () => {
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:18px">Stockage & sauvegarde</h1></div><div class="st-body"><div class="empty">Calcul…</div></div>`;
    $('[data-a=x]', el).onclick = close;
    const S = await storageStats(), on = Sync.enabled(), body = $('.st-body', el);
    const usage = S.est && S.est.usage, quota = S.est && S.est.quota;
    const photosDrive = S.files.filter(f => f._cat === 'photo' && f.blob && f.driveId && f.drivePath);
    const docsDrive = S.files.filter(f => f._cat === 'doc' && f.blob && f.driveId && f.role !== 'sig');
    const maxB = Math.max(1, ...ST_CATS.map(([k]) => S.cats[k].b));
    body.innerHTML = `
      <div class="st-hero"><div><b>${mbTxt(S.local)}</b><span>dans le téléphone (fichiers)</span></div>
        ${usage ? `<div><b>${mbTxt(usage)}</b><span>espace total utilisé par l'appli${quota ? ` · max ${mbTxt(quota)}` : ''}</span></div>` : ''}</div>
      <div class="st-sync ${on ? (S.notSent ? 'w' : 'ok') : 'off'}">
        <span class="ic">${on ? (S.notSent ? '⏳' : '✅') : '⚠️'}</span>
        <div class="grow">${on ? (S.notSent ? `<b>${S.notSent} fichier(s) pas encore dans Drive</b><small>${mbTxt(S.notSentB)} · envoi automatique avec internet</small>` : `<b>Tout est sauvegardé dans Google Drive</b><small>${S.onDrive} fichier(s) · ${S.freed} libéré(s) du téléphone</small>`)
          : `<b>Google Drive non connecté</b><small>Vos données sont seulement dans ce téléphone</small>`}<small data-syncstate>${Sync.statusLine()}</small></div>
        <button class="btn small" data-a="${on ? 'send' : 'connect'}">${on ? '☁ Envoyer' : 'Connecter'}</button></div>
      <div class="st-sec">Ce qui prend de la place</div>
      <div class="st-cats">${ST_CATS.filter(([k]) => S.cats[k].n || S.cats[k].freed).map(([k, e, l]) => { const C = S.cats[k]; return `<div class="st-cat"><span class="e">${e}</span><div class="grow"><div class="t"><b>${l}</b><span>${mbTxt(C.b)}</span></div>
        <div class="bar"><i style="width:${Math.round(C.b / maxB * 100)}%"></i><u style="width:${Math.round(C.driveB / maxB * 100)}%"></u></div>
        <small>${C.n} sur le téléphone · ${C.drive} dans Drive${C.freed ? ` · ${C.freed} libéré(s) (Drive seulement)` : ''}${C.wait ? ` · <em>${C.wait} à envoyer</em>` : ''}</small></div></div>`; }).join('')}</div>
      <div class="st-sec">Libérer de l'espace <small>(les fichiers restent dans Drive)</small></div>
      <div class="st-acts">
        <button data-a="ph3" ${photosDrive.length ? '' : 'disabled'}><span>🧹</span><div class="grow"><b>Photos de plus de 3 jours</b><small>${photosDrive.filter(f => Date.now() - (f.createdAt || 0) > 3 * 864e5).length} photo(s) déjà dans Drive</small></div>${icon('chevright')}</button>
        <button data-a="phall" ${photosDrive.length ? '' : 'disabled'}><span>📷</span><div class="grow"><b>Choisir des photos</b><small>${photosDrive.length} photo(s) dans Drive · ${mbTxt(photosDrive.reduce((a, f) => a + f.blob.size, 0))}</small></div>${icon('chevright')}</button>
        <button data-a="docs" ${docsDrive.length ? '' : 'disabled'}><span>📄</span><div class="grow"><b>Documents PDF déjà dans Drive</b><small>${docsDrive.length} fichier(s) · ${mbTxt(docsDrive.reduce((a, f) => a + f.blob.size, 0))} — se re-téléchargent à l'ouverture</small></div>${icon('chevright')}</button>
      </div>
      <div class="st-sec">Par projet</div>
      <div class="st-proj">${S.projects.map(({ p, b }) => `<div class="st-p"><div class="grow"><b>${esc(p.name)}</b><small>${mbTxt(b)} sur le téléphone${p.lastBackup ? ` · sauvegarde fichier le ${fmtDate(new Date(p.lastBackup).toISOString().slice(0, 10))}` : ''}</small></div><button class="btn ghost small" data-bk="${p.id}">💾 Sauvegarder</button></div>`).join('') || '<div class="empty">Aucun projet</div>'}</div>
      <div class="st-sec">Rangement dans Google Drive</div>
      <div class="st-tree">📁 <b>Chantier</b> › 📁 <b>Nom du projet</b><div>01 - Plans › <i>niveau</i> › (Aperçus · Anciens indices)</div><div>02 - Réception ferraillage › <i>mois</i> › <i>jour</i> › Ouvrages</div><div>03 - Bétonnage · 04 - Réserves · 05 - Rapports journaliers</div><div>06 - Formulaires · 07 - Constats · 08 - Clauses techniques</div><div>09 - Documents · 10 - Photos · 11 - Avancement</div></div>
      <div class="st-note">💡 Ne désinstallez jamais l'application pour la mettre à jour : utilisez ⋮ › Rechercher une mise à jour. Après un changement de téléphone, reconnectez Google Drive avec votre code : tout revient.</div>`;
    const b = (a) => $(`[data-a=${a}]`, body);
    if (b('send')) b('send').onclick = async () => { const ld = loading('Envoi vers Drive…'); try { await Sync.run({ force: true }); } finally { ld.close(); } draw(); };
    if (b('connect')) b('connect').onclick = () => Sync.openSyncSettings();
    freeFilesUI.onDone = () => { if (el.isConnected) draw(); };
    b('ph3').onclick = () => freeFilesUI(photosDrive.filter(f => Date.now() - (f.createdAt || 0) > 3 * 864e5 && !(f.lastUsed && Date.now() - f.lastUsed < 3 * 864e5)).map(f => f.id), 'photos de plus de 3 jours');
    b('phall').onclick = () => freeFilesUI(photosDrive.map(f => f.id), 'toutes les photos');
    b('docs').onclick = async () => {
      const mb = docsDrive.reduce((a, f) => a + f.blob.size, 0);
      if (!await confirmBox(`Retirer ${docsDrive.length} document(s) (${mbTxt(mb)}) du téléphone ?\nIls restent dans Google Drive et se re-téléchargent quand vous les ouvrez (internet nécessaire).`, 'Libérer')) return;
      const ld = loading('Libération…'); let n = 0;
      try { for (const f of docsDrive) { const r = await DB.peek('files', f.id); if (!r || !r.blob || !r.driveId) continue; r.blob = null; r.freed = true; r.freedAt = Date.now(); delete r.lastUsed; BlobURL.drop(r.id); await DB.putRaw('files', r); n++; } } finally { ld.close(); }
      toast(`☁ ${n} document(s) libéré(s) · ${mbTxt(mb)}`); draw();
    };
    $$('[data-bk]', body).forEach(x => x.onclick = async () => {
      const p = await DB.get('projects', x.dataset.bk), ld = loading('Préparation de la sauvegarde…');
      try { await Backup.exportProject(p.id, (i, n) => ld.set(`Sauvegarde… ${i}/${n}`)); p.lastBackup = Date.now(); await DB.put('projects', p); }
      catch (e) { alertBox('Erreur de sauvegarde : ' + (e.message || e)); } finally { ld.close(); }
      draw();
    });
  };
  draw();
}
