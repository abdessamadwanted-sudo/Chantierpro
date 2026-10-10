// Tableau de réception journalier (programme de bétonnage / réception de ferraillage)
const REC_STATUS = {
  ok: { label: 'Réceptionné', short: 'OK', color: '#22c55e', mark: '✅' },
  reserve: { label: 'Avec réserve', short: 'Réserve', color: '#f59e0b', mark: '⚠️' },
  pending: { label: 'Non réceptionné', short: 'En attente', color: '#9aa3b2', mark: '⏳' },
};
const REC_TYPES = ['Ferraillage', 'Coffrage', 'Bétonnage'];
const NIVEAUX = ['Fondations', 'SSL', 'Mezz', 'RDC', 'R+1', 'R+2', 'R+3', 'R+4', 'R+5', 'R+6', 'R+7', 'R+8', 'Terrasse'];
const recDateLabel = (d) => d ? d.split('-').reverse().join('/') : '';

// ---------- Liste des jours ----------
async function renderReceptions(root) {
  const p = App.project;
  const days = (await DB.byProject('receptions', p.id)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  root.innerHTML = `
    <div class="plans-head"><div class="ttl"><h2>Tableau de réception</h2><p>Programme de bétonnage et réception (par jour)</p></div>
      <button class="iconbtn" data-a="sync" title="Google Sheets">${icon('grid')}</button></div>
    ${days.length ? `<div class="list">${days.map(d => {
      const n = d.rows.filter(r => r.element).length, ok = d.rows.filter(r => r.status === 'ok').length, rs = d.rows.filter(r => r.status === 'reserve').length;
      return `<div class="row" data-id="${d.id}"><span class="tasknum" style="background:var(--accent);font-size:12px">${recDateLabel(d.date).slice(0, 5)}</span>
        <div class="grow"><div class="title">${esc(d.type || 'Ferraillage')} · ${fmtDate(d.date)}</div>
        <div class="sub">${n} élément(s) · <span style="color:#22c55e">${ok} réceptionné(s)</span>${rs ? ` · <span style="color:#f59e0b">${rs} réserve(s)</span>` : ''}${d.syncedAt ? ' · ☁ envoyé' : ''}</div></div>
        <span class="icon-muted">${icon('chevright')}</span></div>`;
    }).join('')}</div>`
    : `<div class="empty">Aucun tableau pour le moment.<br>Appuyez sur <b>+</b> pour créer le tableau du jour.</div>`}`;
  $$('.row[data-id]', root).forEach(r => r.onclick = async () => { await openReceptionDay(days.find(d => d.id === r.dataset.id)); renderReceptions(root); });
  $('[data-a=sync]', root).onclick = () => sheetsSetup();
  fab(root, async () => {
    const today = todayISO();
    const prev = days[0];
    const type = await menu('Nouveau tableau du jour', REC_TYPES.map(t => ({ label: `Réception ${t.toLowerCase()}`, icon: 'grid', value: t })));
    if (!type) return;
    let rows = [];
    const lastSame = days.find(d => (d.type || 'Ferraillage') === type);
    if (lastSame && lastSame.rows.some(r => r.status !== 'ok' && r.element)) {
      const v = await menu('Reprendre les éléments non réceptionnés / avec réserve du ' + fmtDate(lastSame.date) + ' ?', [
        { label: 'Oui, les reprendre', icon: 'check', value: 'yes' }, { label: 'Non, tableau vide', icon: 'close', value: 'no' }]);
      if (v === 'yes') rows = lastSame.rows.filter(r => r.status !== 'ok' && r.element).map(r => ({ ...r, id: DB.uid(), status: 'pending', photoIds: [], obs: r.status === 'reserve' ? `Réserve du ${recDateLabel(lastSame.date).slice(0, 5)} : ${r.obs || ''}` : r.obs }));
    }
    const d = await DB.put('receptions', { projectId: p.id, date: today, type, rows });
    await openReceptionDay(d); renderReceptions(root);
  });
}

// ---------- Tableau d'un jour ----------
function openReceptionDay(day) {
  return new Promise(async (resolve) => {
    const p = await DB.get('projects', day.projectId);
    const el = document.createElement('div'); el.className = 'fullpage'; document.body.appendChild(el);
    const save = () => DB.put('receptions', day);
    const finish = async () => { await save(); el.remove(); resolve(); };
    const unBack = pushBack(finish);

    function render() {
      const n = day.rows.filter(r => r.element).length, ok = day.rows.filter(r => r.status === 'ok').length, rs = day.rows.filter(r => r.status === 'reserve').length;
      el.innerHTML = `
        <div class="topbar"><button class="iconbtn" data-a="back">${icon('back')}</button>
          <h1>${esc(day.type || 'Ferraillage')} · ${fmtDate(day.date)}</h1>
          <button class="iconbtn" data-a="share">${icon('share')}</button><button class="iconbtn" data-a="more">${icon('more')}</button></div>
        <div class="rec-sum"><span><b>${n}</b> éléments</span><span style="color:#22c55e"><b>${ok}</b> réceptionnés</span><span style="color:#f59e0b"><b>${rs}</b> réserves</span><span style="color:var(--muted)"><b>${n - ok - rs}</b> en attente</span></div>
        <div class="rec-wrap">
          <table class="rec">
            <thead>
              <tr><th colspan="6" class="rt1">${esc(p.name)}</th></tr>
              <tr><th colspan="5" class="rt2">Programme de bétonnage et réception de ${esc((day.type || 'Ferraillage').toLowerCase())}</th><th class="rt2 date">Date ${recDateLabel(day.date).slice(0, 5)}</th></tr>
              <tr><th>Zone</th><th>NIV</th><th class="el">${esc(day.type || 'Ferraillage')} réceptionné</th><th>Statut</th><th class="ob">Observation</th><th>Photo</th></tr>
            </thead>
            <tbody>
              ${day.rows.map((r, i) => `<tr data-i="${i}" class="st-${r.status}">
                <td class="c">${esc(r.zone)}</td><td class="c">${esc(r.niv)}</td><td class="el">${esc(r.element)}</td>
                <td class="c"><span class="rs" style="background:${REC_STATUS[r.status].color}">${REC_STATUS[r.status].short}</span></td>
                <td class="ob">${esc(r.obs)}</td><td class="c">${(r.photoIds || []).length ? `📷 ${r.photoIds.length}` : ''}</td></tr>`).join('')}
              <tr class="addrow"><td colspan="6"><button data-a="add">${icon('plus')} Ajouter une ligne</button></td></tr>
            </tbody>
          </table>
        </div>`;
      $('[data-a=back]', el).onclick = () => { unBack(); finish(); };
      $('[data-a=add]', el).onclick = () => editRow(null);
      $$('tbody tr[data-i]', el).forEach(tr => tr.onclick = () => editRow(+tr.dataset.i));
      $('[data-a=share]', el).onclick = async () => {
        const v = await menu('Partager', [
          { label: 'Texte WhatsApp (réceptionnés + réserves)', icon: 'share', value: 'txt' },
          { label: 'PDF du tableau', icon: 'report', value: 'pdf' },
          { label: 'Fichier Excel (CSV)', icon: 'grid', value: 'csv' },
          { label: 'Envoyer vers Google Sheets (Drive)', icon: 'drive', value: 'sheets' },
        ]);
        if (v === 'txt') shareWhatsApp(receptionText(p, day));
        if (v === 'pdf') receptionPdf(p, day);
        if (v === 'csv') receptionCsv(p, day);
        if (v === 'sheets') { await save(); await sendToSheets(p, day); render(); }
      };
      $('[data-a=more]', el).onclick = async () => {
        const v = await menu('Tableau', [
          { label: 'Changer la date', icon: 'calendar', value: 'date' },
          { label: 'Supprimer ce tableau', icon: 'trash', danger: true, value: 'del' },
        ]);
        if (v === 'date') { const r = await formSheet('Date', [{ name: 'date', label: 'Date', type: 'date', value: day.date }]); if (r && r.date) { day.date = r.date; await save(); render(); } }
        if (v === 'del' && await confirmBox('Supprimer ce tableau ?')) {
          for (const r of day.rows) for (const id of r.photoIds || []) await DB.del('files', id);
          await DB.del('receptions', day.id); unBack(); el.remove(); resolve();
        }
      };
    }

    // Éditeur d'une ligne
    function editRow(i) {
      const isNew = i === null;
      const last = day.rows[day.rows.length - 1] || {};
      const r = isNew ? { id: DB.uid(), zone: last.zone || '', niv: last.niv || '', element: '', status: 'ok', obs: '', photoIds: [] } : { ...day.rows[i], photoIds: [...(day.rows[i].photoIds || [])] };
      const s = sheet(`<div class="form" id="rowf"></div>`, { title: isNew ? 'Nouvelle ligne' : 'Modifier la ligne' });
      const f = $('#rowf', s.el);
      async function draw() {
        const photos = await loadFiles(r.photoIds);
        f.innerHTML = `
          <div class="kv"><label>Zone<input name="zone" value="${esc(r.zone)}" inputmode="numeric" placeholder="11"></label>
            <label>Niveau<input name="niv" list="dl-niv" value="${esc(r.niv)}" placeholder="R+5"></label></div>
          <datalist id="dl-niv">${NIVEAUX.map(n => `<option value="${n}">`).join('')}</datalist>
          <label>Élément<input name="element" value="${esc(r.element)}" placeholder="Ex : Voile CR 77 Axe D2"></label>
          <div class="fld">Statut<div class="seg seg3">${Object.entries(REC_STATUS).map(([k, v]) => `<button type="button" data-st="${k}" class="${r.status === k ? 'on' : ''}" style="${r.status === k ? `background:${v.color}` : ''}">${v.label}</button>`).join('')}</div></div>
          <label>Observation ${r.status === 'reserve' ? '/ réserve' : ''}<textarea name="obs" style="min-height:64px" placeholder="${r.status === 'reserve' ? 'Ex : cales manquantes côté axe D2' : 'Optionnel'}">${esc(r.obs)}</textarea></label>
          <label>Photos</label>${thumbsHTML(photos)}
          <div class="btnrow" style="padding:0">${!isNew ? `<button class="btn danger" data-a="del" style="flex:none;padding:14px 16px">${icon('trash')}</button>` : ''}
            <button class="btn ghost" data-a="cancel">Annuler</button><button class="btn" data-a="ok">${isNew ? 'Ajouter' : 'Enregistrer'}</button></div>
          ${isNew ? `<button class="btn ghost" data-a="okmore" style="margin-top:-4px">Ajouter et ligne suivante</button>` : ''}`;
        $$('[name]', f).forEach(inp => inp.oninput = () => { r[inp.name] = inp.value; });
        $$('[data-st]', f).forEach(b => b.onclick = () => { r.status = b.dataset.st; draw(); });
        $('[data-a=addphoto]', f).onclick = async (e) => { e.preventDefault(); const recs = await addPhotos(day.projectId, { source: `Réception ${recDateLabel(day.date)} · ${r.element || ''}` }); if (recs.length) { r.photoIds.push(...recs.map(x => x.id)); draw(); } };
        $$('.thumbs .t[data-id]', f).forEach(t => t.onclick = async (e) => {
          const id = t.dataset.id;
          if (e.target.closest('[data-del]')) { e.preventDefault(); r.photoIds = r.photoIds.filter(x => x !== id); draw(); return; }
          const ph = photos.find(x => x.id === id); showImage(BlobURL.get(ph.id, ph.blob), r.element);
        });
        const commit = async () => {
          if (!r.element.trim()) { toast('Écrivez l\'élément'); return false; }
          if (isNew) day.rows.push(r); else day.rows[i] = r;
          await save(); return true;
        };
        $('[data-a=cancel]', f).onclick = () => s.close();
        $('[data-a=ok]', f).onclick = async () => { if (await commit()) { s.close(); render(); } };
        const om = $('[data-a=okmore]', f); if (om) om.onclick = async () => { if (await commit()) { s.close(); render(); editRow(null); } };
        const del = $('[data-a=del]', f); if (del) del.onclick = async () => { if (await confirmBox('Supprimer cette ligne ?')) { day.rows.splice(i, 1); await save(); s.close(); render(); } };
        if (isNew && !r.element) setTimeout(() => $('[name=element]', f)?.focus(), 250);
      }
      draw();
    }
    render();
  });
}

// ---------- Exports ----------
function receptionText(p, day) {
  const rows = day.rows.filter(r => r.element);
  const line = (r) => `${REC_STATUS[r.status].mark} ${[r.zone && 'Zone ' + r.zone, r.niv].filter(Boolean).join(' · ')}${r.zone || r.niv ? ' — ' : ''}${r.element}${r.obs ? `\n     ↳ ${r.status === 'reserve' ? 'Réserve : ' : ''}${r.obs}` : ''}`;
  const ok = rows.filter(r => r.status === 'ok'), rs = rows.filter(r => r.status === 'reserve'), pd = rows.filter(r => r.status === 'pending');
  return `*${p.name}*\n*Réception ${(day.type || 'ferraillage').toLowerCase()} du ${fmtDate(day.date)}*\n` +
    (ok.length ? `\n*Réceptionné (${ok.length}) :*\n${ok.map(line).join('\n')}\n` : '') +
    (rs.length ? `\n*Avec réserve (${rs.length}) :*\n${rs.map(line).join('\n')}\n` : '') +
    (pd.length ? `\n*Non réceptionné (${pd.length}) :*\n${pd.map(line).join('\n')}\n` : '');
}

async function receptionPdf(p, day) {
  const ld = loading('Création du PDF…');
  try {
    const R = newDoc(`Réception ${recDateLabel(day.date)}`, p); const { doc, M, W } = R;
    // bandeau titre façon tableau
    doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.3);
    doc.rect(M, R.y, W - 2 * M, 10); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 20, 20);
    doc.text(pt(p.name), W / 2, R.y + 6.8, { align: 'center' }); R.y += 10;
    doc.setFillColor(201, 218, 248); doc.rect(M, R.y, W - 2 * M, 8, 'FD');
    doc.setFontSize(10); doc.text(pt(`Programme de bétonnage et réception de ${(day.type || 'ferraillage').toLowerCase()}`), M + 3, R.y + 5.5);
    doc.setTextColor(220, 30, 30); doc.setFontSize(12); doc.text(`Date ${recDateLabel(day.date)}`, W - M - 3, R.y + 5.8, { align: 'right' }); R.y += 8;
    // en-têtes
    const cols = [{ t: 'Zone', w: 13 }, { t: 'NIV', w: 15 }, { t: `${day.type || 'Ferraillage'} réceptionné`, w: 80 }, { t: 'Statut', w: 26 }, { t: 'Observation', w: W - 2 * M - 134 }];
    const head = () => {
      doc.setFillColor(201, 218, 248); doc.rect(M, R.y, W - 2 * M, 8, 'FD');
      doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      let x = M; cols.forEach(c => { doc.text(pt(c.t), x + c.w / 2, R.y + 5.4, { align: 'center' }); x += c.w; doc.line(x, R.y, x, R.y + 8); });
      R.y += 8;
    };
    head();
    const rows = day.rows.filter(r => r.element);
    for (const r of rows) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const el = doc.splitTextToSize(pt(r.element), cols[2].w - 3), ob = doc.splitTextToSize(pt(r.obs || ''), cols[4].w - 3);
      const h = Math.max(8, Math.max(el.length, ob.length) * 4.4 + 3.5);
      if (R.y + h > 297 - 18) { doc.addPage(); R.header(); head(); }
      if (r.status === 'reserve') { doc.setFillColor(255, 243, 224); doc.rect(M, R.y, W - 2 * M, h, 'F'); }
      doc.rect(M, R.y, W - 2 * M, h);
      let x = M; cols.forEach(c => { x += c.w; doc.line(x, R.y, x, R.y + h); });
      doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold');
      doc.text(pt(r.zone || ''), M + cols[0].w / 2, R.y + 5.5, { align: 'center' });
      doc.text(pt(r.niv || ''), M + cols[0].w + cols[1].w / 2, R.y + 5.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      el.forEach((l, j) => doc.text(l, M + cols[0].w + cols[1].w + 1.5, R.y + 5.5 + j * 4.4));
      const st = REC_STATUS[r.status], c = hexRGB(st.color);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...c);
      doc.text(pt(st.label), M + 108 + cols[3].w / 2, R.y + 5.5, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(r.status === 'reserve' ? 190 : 60, r.status === 'reserve' ? 90 : 60, r.status === 'reserve' ? 0 : 60);
      ob.forEach((l, j) => doc.text(l, M + 134 + 1.5, R.y + 5.5 + j * 4.4));
      R.y += h;
    }
    R.y += 5;
    const ok = rows.filter(r => r.status === 'ok').length, rs = rows.filter(r => r.status === 'reserve').length;
    R.text(`Total : ${rows.length} élément(s) · ${ok} réceptionné(s) · ${rs} avec réserve · ${rows.length - ok - rs} non réceptionné(s)`, { size: 10, bold: true, gap: 4 });
    // photos
    const withPh = rows.filter(r => (r.photoIds || []).length);
    if (withPh.length) {
      R.text('Photos', { size: 12, bold: true, gap: 2 });
      for (const r of withPh) {
        R.text(`${r.zone ? 'Zone ' + r.zone + ' · ' : ''}${r.niv ? r.niv + ' · ' : ''}${r.element}`, { size: 9.5, bold: true, gap: 1 });
        let x = M; const bh = 50; R.need(bh + 3);
        for (const id of r.photoIds.slice(0, 4)) {
          const f = await DB.get('files', id); if (!f) continue;
          const im = await blobToJpegURL(f.blob, 700);
          let w = im.w * (bh / im.h), h = bh; if (w > 85) { w = 85; h = im.h * (85 / im.w); }
          if (x + w > W - M) { R.y += bh + 3; x = M; R.need(bh + 3); }
          doc.addImage(im.url, 'JPEG', x, R.y, w, h); x += w + 3;
        }
        R.y += bh + 5;
      }
    }
    R.finish();
    await sharePdf(doc, `Reception_${safeName(day.type || 'ferraillage')}_${day.date}.pdf`);
  } catch (e) { console.error(e); alertBox('Erreur PDF : ' + (e.message || e)); }
  finally { ld.close(); }
}

async function receptionCsv(p, day) {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = [[p.name], [`Programme de bétonnage et réception de ${(day.type || 'ferraillage').toLowerCase()}`, '', '', '', `Date ${recDateLabel(day.date)}`], ['Zone', 'NIV', `${day.type || 'Ferraillage'} réceptionné`, 'Statut', 'Observation'],
    ...day.rows.filter(r => r.element).map(r => [r.zone, r.niv, r.element, REC_STATUS[r.status].label, r.obs])];
  const csv = '﻿' + lines.map(l => l.map(q).join(';')).join('\r\n');
  const fname = `Reception_${day.date}.csv`;
  const P = window.Capacitor?.Plugins || {};
  if (P.Filesystem && P.Share) {
    await P.Filesystem.writeFile({ path: fname, data: csv, directory: 'CACHE', encoding: 'utf8' });
    const { uri } = await P.Filesystem.getUri({ path: fname, directory: 'CACHE' });
    try { await P.Share.share({ title: fname, files: [uri], dialogTitle: 'Envoyer le tableau' }); } catch (e) {}
  } else {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = fname; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

// ---------- Synchronisation Google Sheets (Drive) ----------
function sheetsScript(sheetId) {
  return `// Chantier → Google Sheets : à coller dans script.google.com
const SHEET_ID = '${sheetId || 'COLLER_ICI_L_ID_DU_FICHIER'}';
function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.openById(SHEET_ID);
  // 1 onglet par jour (ex : "09-10 Ferraillage"), réécrit à chaque envoi
  const sh = ss.getSheetByName(d.sheet) || ss.insertSheet(d.sheet);
  sh.clear();
  sh.getRange(1, 1, 1, 5).merge().setValue(d.project).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(2, 1, 1, 4).merge().setValue(d.title).setBackground('#c9daf8').setFontWeight('bold');
  sh.getRange(2, 5).setValue('Date ' + d.dateLabel).setFontColor('#e00000').setFontWeight('bold').setBackground('#c9daf8');
  sh.getRange(3, 1, 1, 5).setValues([d.head]).setBackground('#c9daf8').setFontWeight('bold').setHorizontalAlignment('center');
  if (d.rows.length) sh.getRange(4, 1, d.rows.length, 5).setValues(d.rows).setVerticalAlignment('middle').setWrap(true);
  sh.getRange(3, 1, d.rows.length + 1, 5).setBorder(true, true, true, true, true, true);
  sh.setColumnWidth(3, 380); sh.setColumnWidth(5, 220);
  // historique de toutes les lignes
  const h = ss.getSheetByName('Historique') || ss.insertSheet('Historique');
  if (h.getLastRow() === 0) h.appendRow(['Date', 'Type', 'Zone', 'NIV', 'Élément', 'Statut', 'Observation']);
  const old = h.getDataRange().getValues();
  for (let i = old.length - 1; i >= 1; i--) if (old[i][0] === d.dateLabel && old[i][1] === d.type) h.deleteRow(i + 1);
  d.rows.forEach(r => h.appendRow([d.dateLabel, d.type, r[0], r[1], r[2], r[3], r[4]]));
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}`;
}
const sheetIdFrom = (url) => (String(url || '').match(/\/spreadsheets\/d\/([\w-]{20,})/) || String(url || '').match(/\/d\/([\w-]{20,})/) || [])[1] || '';

async function sheetsSetup() {
  const p = await DB.get('projects', App.project.id);
  const rec = (p.quickLinks || []).find(q => q.id === 'reception');
  const sid = sheetIdFrom(rec && rec.url);
  const s = sheet(`<div class="form">
    <div class="muted" style="font-size:14px;line-height:1.6">
      Pour remplir automatiquement votre fichier Google Sheets (Drive) depuis l'application :<br>
      <b>1.</b> Le fichier doit être au format <b>Google Sheets</b> (si c'est un .xlsx : Fichier → Enregistrer au format Google Sheets).<br>
      <b>2.</b> Ouvrez <b>script.google.com</b> dans Chrome (mode ordinateur) → <b>Nouveau projet</b>.<br>
      <b>3.</b> Effacez tout et collez le code (bouton Copier ci-dessous)${sid ? '' : ', puis remplacez COLLER_ICI_L_ID_DU_FICHIER par l\'ID du fichier (la partie après /d/ dans le lien)'}.<br>
      <b>4.</b> <b>Déployer → Nouveau déploiement → Application Web</b> · Exécuter en tant que : <b>Moi</b> · Accès : <b>Tout le monde</b> → Autoriser.<br>
      <b>5.</b> Copiez l'<b>URL de l'application Web</b> et collez-la ici.
    </div>
    <button class="btn ghost" data-a="copy">${icon('file')} Copier le code du script</button>
    <label>URL de l'application Web (Apps Script)<input name="url" type="url" value="${esc(p.sheetsUrl || '')}" placeholder="https://script.google.com/macros/s/…/exec"></label>
    <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="cancel">Fermer</button><button class="btn" data-a="ok">Enregistrer</button></div>
  </div>`, { title: 'Liaison Google Sheets' });
  $('[data-a=copy]', s.el).onclick = async () => {
    const code = sheetsScript(sid);
    try { await navigator.clipboard.writeText(code); toast('Code copié ✓'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Code copié ✓'); }
  };
  $('[data-a=cancel]', s.el).onclick = () => s.close();
  $('[data-a=ok]', s.el).onclick = async () => { p.sheetsUrl = $('[name=url]', s.el).value.trim(); await DB.put('projects', p); App.project = p; s.close(); toast(p.sheetsUrl ? 'Liaison enregistrée ✓' : 'Liaison supprimée'); };
}

async function sendToSheets(p0, day) {
  const p = await DB.get('projects', p0.id);
  if (!p.sheetsUrl) { toast('Configurez d\'abord la liaison Google Sheets'); return sheetsSetup(); }
  const payload = {
    project: p.name, type: day.type || 'Ferraillage', dateLabel: recDateLabel(day.date),
    sheet: `${recDateLabel(day.date).slice(0, 5).replace('/', '-')} ${day.type || 'Ferraillage'}`,
    title: `Programme de bétonnage et réception de ${(day.type || 'ferraillage').toLowerCase()}`,
    head: ['Zone', 'NIV', `${day.type || 'Ferraillage'} réceptionné`, 'Statut', 'Observation'],
    rows: day.rows.filter(r => r.element).map(r => [r.zone || '', r.niv || '', r.element, REC_STATUS[r.status].label, r.obs || '']),
  };
  const ld = loading('Envoi vers Google Sheets…');
  try {
    const http = window.Capacitor?.Plugins?.CapacitorHttp;
    if (http) {
      const res = await http.post({ url: p.sheetsUrl, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, data: JSON.stringify(payload) });
      if (res.status >= 400) throw new Error('Erreur ' + res.status + ' (vérifiez l\'accès « Tout le monde »)');
    } else {
      await fetch(p.sheetsUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    }
    day.syncedAt = Date.now(); await DB.put('receptions', day);
    toast('Envoyé vers Google Sheets ✓');
  } catch (e) { console.error(e); alertBox('Envoi impossible : ' + (e.message || e) + '\nVérifiez internet et l\'URL du script.'); }
  finally { ld.close(); }
}
