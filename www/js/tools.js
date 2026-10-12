// Outils : fusion de PDF (accueil) + constats de non-conformité (par projet)

// ================= Fusion de PDF =================
// Chaque page des PDF (et chaque image) est rendue puis assemblée dans un seul PDF, dans l'ordre choisi.
async function openPdfMerger() {
  const items = [];   // { id, name, kind: 'pdf'|'image', blob, pages }
  const el = document.createElement('div'); el.className = 'fullpage toolpage'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  const close = () => { unBack(); el.remove(); };
  async function add() {
    const files = await pickFiles({ accept: 'application/pdf,image/*', multiple: true });
    if (!files.length) return;
    const ld = loading('Lecture des fichiers…');
    try {
      for (const f of files) {
        const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
        let pages = 1;
        if (isPdf && pdfReady()) { try { const d = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise; pages = d.numPages; d.destroy(); } catch (e) { toast('PDF illisible : ' + f.name); continue; } }
        items.push({ id: DB.uid(), name: f.name.replace(/\.[^.]+$/, ''), kind: isPdf ? 'pdf' : 'image', blob: f, pages });
      }
    } finally { ld.close(); }
    draw();
  }
  function draw() {
    const total = items.reduce((a, x) => a + x.pages, 0);
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('close')}</button><h1 style="flex:1">Fusionner des PDF</h1></div>
      <div class="tool-body">
        <div class="tool-intro">${icon('pdf')}<div><b>Assemblez plusieurs PDF et photos en un seul fichier</b><small>Ajoutez les fichiers, mettez-les dans l'ordre avec ▲ ▼, puis « Générer ».</small></div></div>
        ${items.length ? `<div class="mg-list">${items.map((it, i) => `<div class="mg-row" data-i="${i}">
            <span class="mg-n">${i + 1}</span><span class="mg-ic ${it.kind}">${icon(it.kind === 'pdf' ? 'pdf' : 'image')}</span>
            <div class="grow"><b>${esc(it.name)}</b><small>${it.kind === 'pdf' ? `PDF · ${it.pages} page(s)` : 'Image · 1 page'}</small></div>
            <button class="iconbtn sm" data-up="${i}" ${i ? '' : 'disabled'}>▲</button><button class="iconbtn sm" data-dn="${i}" ${i < items.length - 1 ? '' : 'disabled'}>▼</button><button class="iconbtn sm" data-rm="${i}">${icon('close')}</button></div>`).join('')}</div>` : '<div class="empty">Aucun fichier pour le moment.</div>'}
        <button class="btn ghost" data-a="add" style="width:100%">${icon('plus')} Ajouter des PDF / photos</button>
        ${items.length ? `<label class="mg-name"><small>Nom du fichier final</small><input data-a="name" value="${esc(items._name || 'Document fusionné')}"></label>
          <button class="btn" data-a="go" style="width:100%">${icon('check')} Générer le PDF (${total} page${total > 1 ? 's' : ''})</button>` : ''}
      </div>`;
    $('[data-a=x]', el).onclick = close;
    $('[data-a=add]', el).onclick = add;
    $$('[data-up]', el).forEach(b => b.onclick = () => { const i = +b.dataset.up; [items[i - 1], items[i]] = [items[i], items[i - 1]]; draw(); });
    $$('[data-dn]', el).forEach(b => b.onclick = () => { const i = +b.dataset.dn; [items[i + 1], items[i]] = [items[i], items[i + 1]]; draw(); });
    $$('[data-rm]', el).forEach(b => b.onclick = () => { items.splice(+b.dataset.rm, 1); draw(); });
    const nm = $('[data-a=name]', el); if (nm) nm.oninput = () => { items._name = nm.value; };
    const go = $('[data-a=go]', el); if (go) go.onclick = generate;
  }
  async function generate() {
    const { jsPDF } = window.jspdf; let doc = null;
    const ld = loading('Création du PDF…');
    const addImg = (url, w, h) => {   // page à la taille de l'image (A4 portrait ou paysage)
      const land = w > h, W = land ? 297 : 210, H = land ? 210 : 297;
      if (!doc) doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: land ? 'l' : 'p' }); else doc.addPage('a4', land ? 'l' : 'p');
      const k = Math.min(W / w, H / h); doc.addImage(url, 'JPEG', (W - w * k) / 2, (H - h * k) / 2, w * k, h * k);
    };
    try {
      let n = 0; const total = items.reduce((a, x) => a + x.pages, 0);
      for (const it of items) {
        if (it.kind === 'image') { const im = await blobToJpegURL(it.blob, 2200); addImg(im.url, im.w, im.h); ld.set(`Page ${++n} / ${total}`); continue; }
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await it.blob.arrayBuffer()) }).promise;
        for (let pg = 1; pg <= pdf.numPages; pg++) {
          const page = await pdf.getPage(pg), vp1 = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: Math.min(2.5, 2400 / Math.max(vp1.width, vp1.height)) });
          const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
          await page.render({ canvasContext: g, viewport: vp }).promise;
          addImg(c.toDataURL('image/jpeg', 0.85), c.width, c.height); ld.set(`Page ${++n} / ${total}`);
        }
        pdf.destroy();
      }
      const blob = doc.output('blob');
      ld.close();
      const fname = `${safeName(items._name || 'Document fusionné')}.pdf`;
      const v = await menu(`PDF prêt · ${(blob.size / 1048576).toFixed(1)} Mo`, [
        { label: 'Voir le PDF', icon: 'eye', value: 'see' }, { label: 'Envoyer / enregistrer', icon: 'share', value: 'share' }]);
      if (v === 'see') showPdf(blob, fname); if (v === 'share') shareBlob(blob, fname);
    } catch (e) { ld.close(); alertBox('Erreur : ' + (e.message || e)); }
  }
  draw(); add();
}

// ================= Constats / non-conformités =================
// Bibliothèque de problèmes courants → solution proposée automatiquement (sans internet)
const NC_LIB = [
  ['enrobage', 'Enrobage insuffisant des armatures', 'Mettre en place des cales d\'enrobage conformes (épaisseur selon plan / classe d\'exposition), espacement max. 1 m, contrôle avant bétonnage.'],
  ['cale', 'Cales d\'enrobage manquantes ou mal positionnées', 'Poser des cales béton ou plastique homologuées sur toutes les faces, vérifier l\'enrobage au mètre avant coulage.'],
  ['ligature', 'Armatures mal ligaturées / cage instable', 'Reprendre les ligatures à chaque croisement en zone courante et à tous les croisements en about, rigidifier la cage.'],
  ['recouvrement', 'Longueur de recouvrement insuffisante', 'Rallonger les recouvrements selon le plan de ferraillage (≥ 40 Ø ou valeur BET) ou ajouter des barres de couture validées par le BET.'],
  ['espacement', 'Espacement des armatures non conforme au plan', 'Redistribuer les barres / cadres selon l\'espacement du plan, ajouter les barres manquantes.'],
  ['diametre', 'Diamètre d\'armature non conforme', 'Remplacer les barres par le diamètre prévu au plan, ou faire valider une équivalence de section par le BET.'],
  ['cadre', 'Cadres / épingles manquants', 'Compléter les cadres et épingles selon le plan (zones critiques resserrées), refermer les crochets à 135°.'],
  ['attente', 'Aciers en attente absents ou mal positionnés', 'Mettre en place les attentes par scellement chimique (procédé validé BET) ou les repositionner avant bétonnage.'],
  ['rouille', 'Armatures oxydées / sales (boue, huile)', 'Brosser les armatures, éliminer la rouille non adhérente, nettoyer boue et huile avant bétonnage.'],
  ['segregation', 'Ségrégation du béton', 'Purger les parties ségrégées jusqu\'au béton sain, reprendre au mortier de réparation (type R3/R4) après validation BET.'],
  ['nid', 'Nid de cailloux', 'Piquer jusqu\'au béton sain, humidifier, appliquer un primaire d\'accrochage et ragréer au mortier de réparation fibré.'],
  ['fissure', 'Fissuration du béton', 'Relever (ouverture, longueur, évolution). Fissures < 0,3 mm : calfeutrement ; au-delà : injection résine époxy après avis BET.'],
  ['aplomb', 'Défaut d\'aplomb / verticalité', 'Mesurer l\'écart ; si hors tolérance (> 1 cm/étage), avis BET : ragréage, reprise ou démolition partielle.'],
  ['niveau', 'Défaut de niveau / altimétrie', 'Contrôle topo, correction par ragréage ou rabotage selon l\'écart et la tolérance du lot suivant.'],
  ['coffrage', 'Coffrage non étanche / mal calé', 'Reprendre les joints de coffrage (mousse, bande), renforcer étaiement et serrage avant coulage.'],
  ['huile', 'Absence d\'huile de décoffrage', 'Appliquer l\'huile de décoffrage uniformément avant mise en place des armatures.'],
  ['etai', 'Étaiement insuffisant', 'Compléter l\'étaiement selon la note de calcul / plan d\'étaiement, contrôler la verticalité des étais.'],
  ['reservation', 'Réservation oubliée ou mal placée', 'Réaliser le carottage / sciage après accord BET, ou repositionner la réservation avant bétonnage.'],
  ['vibration', 'Béton mal vibré (bullage, vides)', 'Vibrer par couches de 30-50 cm avec aiguille adaptée ; reprise des parements au mortier si nécessaire.'],
  ['cure', 'Cure du béton non réalisée', 'Mettre en œuvre la cure (arrosage, produit de cure, film) pendant au moins 3 à 7 jours selon la température.'],
  ['epaufrure', 'Épaufrures / arêtes cassées', 'Reprendre au mortier de réparation après nettoyage et primaire d\'accrochage.'],
  ['corrosion', 'Aciers apparents / corrodés', 'Dégager les aciers, traiter (passivation), reconstituer l\'enrobage au mortier de réparation.'],
  ['proprete', 'Fond de coffrage non nettoyé', 'Nettoyer le fond de coffrage (déchets, ligatures, eau) par soufflage avant coulage.'],
  ['joint', 'Joint de reprise non traité', 'Piquer / désactiver la surface, nettoyer, humidifier et appliquer une barbotine ou un produit de reprise avant coulage.'],
  ['securite', 'Garde-corps / protection collective absente', 'Installer immédiatement les protections collectives (garde-corps, filets), baliser la zone.'],
  ['epi', 'Port des EPI non respecté', 'Rappel des consignes, arrêt de la tâche jusqu\'à mise en conformité (casque, gilet, chaussures, harnais).'],
  ['maconnerie', 'Maçonnerie hors alignement / joints irréguliers', 'Démonter et remonter la partie défectueuse au cordeau, joints réguliers 1 cm.'],
  ['etancheite', 'Défaut d\'étanchéité', 'Localiser la fuite, reprendre le relevé / la membrane selon DTU, test à l\'eau après réparation.'],
];
const ncSuggest = (txt) => {
  const n = normQ(txt); if (n.length < 3) return [];
  const words = String(txt).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3);
  return NC_LIB.map(([k, p, s]) => { const pn = normQ(p); let sc = 0; if (n.includes(k) || pn.includes(n)) sc += 3; for (const w of words) if (pn.includes(w) || k.includes(w) || w.includes(k)) sc++; return { p, s, sc }; })
    .filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 4);
};

async function renderConstats(root) {
  const p = await DB.get('projects', App.project.id);
  const list = (p.constats || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  root.innerHTML = `<div class="pagehead"><h2>Constats</h2><p>Non-conformités avec photo, problème et solution</p></div>
    ${list.length ? `<div class="list">${list.map(c => `<div class="row" data-id="${c.id}"><span class="cst-ic">${icon('report')}</span>
      <div class="grow"><div class="title">${esc(c.title || 'Constat')}</div><div class="sub">${fmtDate(c.date)}${c.entreprise ? ' · ' + esc(c.entreprise) : ''} · ${(c.items || []).length} point(s)</div></div>${icon('chevright')}</div>`).join('')}</div>`
    : `<div class="empty">Aucun constat.<br>Appuyez sur <b>+</b> pour créer un constat de non-conformité.</div>`}`;
  $$('[data-id]', root).forEach(r => r.onclick = async () => { await openConstat(r.dataset.id); renderConstats(root); });
  fab(root, async () => {
    const pr = await DB.get('projects', App.project.id);
    const last = (pr.constats || [])[(pr.constats || []).length - 1] || {};
    const c = { id: DB.uid(), title: 'Constat de non-conformité', date: todayISO(), projet: pr.name, entreprise: last.entreprise || '', lot: last.lot || '', lieu: '', redacteur: last.redacteur || '', destinataire: last.destinataire || '', ref: `NC-${String((pr.constats || []).length + 1).padStart(3, '0')}`, items: [] };
    pr.constats = [...(pr.constats || []), c]; await DB.put('projects', pr);
    await openConstat(c.id); renderConstats(root);
  });
}

function openConstat(id) {
  return new Promise(async (resolve) => {
    let pr = await DB.get('projects', App.project.id);
    const C = () => pr.constats.find(x => x.id === id);
    const el = document.createElement('div'); el.className = 'fullpage toolpage'; document.body.appendChild(el);
    const finish = () => { el.remove(); resolve(); };
    const unBack = pushBack(finish);
    let saveT = null;
    const save = () => { clearTimeout(saveT); saveT = setTimeout(async () => { const cur = await DB.get('projects', pr.id); const i = cur.constats.findIndex(x => x.id === id); cur.constats[i] = C(); await DB.put('projects', cur); pr = cur; }, 300); };
    const H = [['title', 'Titre'], ['ref', 'Référence'], ['date', 'Date', 'date'], ['projet', 'Projet'], ['entreprise', 'Entreprise'], ['lot', 'Lot'], ['lieu', 'Localisation (zone, niveau, axe)'], ['redacteur', 'Rédigé par'], ['destinataire', 'Destinataire']];
    async function draw() {
      const c = C();
      const photos = {}; for (const it of c.items) for (const fid of it.photoIds || []) { const f = await DB.get('files', fid); if (f && f.blob) photos[fid] = BlobURL.get(f.id, f.blob); }
      el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="back">${icon('back')}</button><h1 style="flex:1">${esc(c.ref || 'Constat')}</h1>
          <button class="iconbtn" data-a="pdf">${icon('pdf')}</button><button class="iconbtn" data-a="more">${icon('more')}</button></div>
        <div class="tool-body">
          <details class="cst-head" ${c.items.length ? '' : 'open'}><summary>${icon('edit')} <b>En-tête</b><span>${esc(c.projet || '')} · ${fmtDate(c.date)}${c.entreprise ? ' · ' + esc(c.entreprise) : ''}</span></summary>
            <div class="cst-grid">${H.map(([k, l, t]) => `<label><small>${l}</small><input data-h="${k}" ${t ? `type="${t}"` : ''} value="${esc(c[k] || '')}"></label>`).join('')}</div></details>
          <div class="cst-items">${c.items.map((it, i) => `<div class="cst-item" data-i="${i}">
              <div class="ci-top"><span class="ci-n">${i + 1}</span><select data-f="gravite"><option value="mineure" ${it.gravite === 'mineure' ? 'selected' : ''}>Mineure</option><option value="majeure" ${it.gravite === 'majeure' ? 'selected' : ''}>Majeure</option><option value="critique" ${it.gravite === 'critique' ? 'selected' : ''}>Critique</option></select>
                <button class="iconbtn sm" data-del="${i}">${icon('trash')}</button></div>
              <div class="thumbs">${(it.photoIds || []).map(fid => `<div class="t" data-ph="${fid}"><img src="${photos[fid] || ''}"><button class="x" data-phdel="${fid}">×</button></div>`).join('')}<button class="t add" data-addph="${i}">${icon('camera')}</button></div>
              <label><small>Localisation</small><input data-f="loc" value="${esc(it.loc || '')}" placeholder="Ex : Zone 11, R+5, axe C21"></label>
              <label><small>Constat / problème</small><textarea data-f="probleme" placeholder="Ex : enrobage insuffisant côté axe C">${esc(it.probleme || '')}</textarea></label>
              <div class="ci-sug" data-sug="${i}"></div>
              <label><small>Solution</small><textarea data-f="solution" placeholder="La solution proposée s'affiche ici — modifiable">${esc(it.solution || '')}</textarea></label>
            </div>`).join('')}</div>
          <button class="btn" data-a="add" style="width:100%">${icon('plus')} Ajouter un point de non-conformité</button>
          ${c.items.length ? `<button class="btn ghost" data-a="pdf2" style="width:100%;margin-top:10px">${icon('pdf')} Générer le PDF du constat</button>` : ''}
        </div>`;
      $('[data-a=back]', el).onclick = () => { unBack(); finish(); };
      $$('[data-h]', el).forEach(i => i.oninput = () => { c[i.dataset.h] = i.value; save(); });
      const sug = (i) => {
        const it = c.items[i], box = $(`[data-sug="${i}"]`, el); if (!box) return;
        const l = ncSuggest(it.probleme);
        box.innerHTML = l.length ? `<small>💡 Solutions proposées :</small>${l.map((x, j) => `<button data-pick="${j}"><b>${esc(x.p)}</b><span>${esc(x.s)}</span></button>`).join('')}` : '';
        $$('[data-pick]', box).forEach(b => b.onclick = () => { const x = l[+b.dataset.pick]; it.solution = x.s; if (!it.probleme || it.probleme.length < 6) it.probleme = x.p; save(); draw(); });
      };
      $$('.cst-item', el).forEach(ie => {
        const i = +ie.dataset.i, it = c.items[i];
        $$('[data-f]', ie).forEach(inp => inp[inp.tagName === 'SELECT' ? 'onchange' : 'oninput'] = () => { it[inp.dataset.f] = inp.value; save(); if (inp.dataset.f === 'probleme') sug(i); });
        if (!it.solution) sug(i);
      });
      $$('[data-addph]', el).forEach(b => b.onclick = async () => { const recs = await addPhotos(pr.id, { source: `Constat ${c.ref || ''}` }); if (recs.length) { const it = c.items[+b.dataset.addph]; it.photoIds = [...(it.photoIds || []), ...recs.map(x => x.id)]; save(); draw(); } });
      $$('[data-ph]', el).forEach(t => t.onclick = async (e) => {
        const fid = t.dataset.ph, it = c.items[+t.closest('.cst-item').dataset.i];
        if (e.target.closest('[data-phdel]')) { it.photoIds = it.photoIds.filter(x => x !== fid); save(); return draw(); }
        showGallery(it.photoIds.filter(x => photos[x]).map(x => ({ src: photos[x], caption: it.probleme || 'Constat', fileId: x })), it.photoIds.indexOf(fid));
      });
      $$('[data-del]', el).forEach(b => b.onclick = async () => { if (await confirmBox('Supprimer ce point ?')) { c.items.splice(+b.dataset.del, 1); save(); draw(); } });
      $('[data-a=add]', el).onclick = async () => {
        const it = { id: DB.uid(), gravite: 'majeure', loc: c.lieu || '', probleme: '', solution: '', photoIds: [] };
        c.items.push(it); save();
        const recs = await addPhotos(pr.id, { source: `Constat ${c.ref || ''}` });
        if (recs.length) it.photoIds = recs.map(x => x.id);
        save(); await draw(); $$('.cst-item').pop()?.scrollIntoView({ block: 'start' });
      };
      const pdfGo = async () => { clearTimeout(saveT); const cur = await DB.get('projects', pr.id); cur.constats[cur.constats.findIndex(x => x.id === id)] = C(); await DB.put('projects', cur); pr = cur; constatPdf(pr, C()); };
      $('[data-a=pdf]', el).onclick = pdfGo; const p2 = $('[data-a=pdf2]', el); if (p2) p2.onclick = pdfGo;
      $('[data-a=more]', el).onclick = async () => {
        const v = await menu(c.ref || 'Constat', [{ label: 'Générer le PDF', icon: 'pdf', value: 'pdf' }, { label: 'Supprimer ce constat', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'pdf') pdfGo();
        if (v === 'del' && await confirmBox('Supprimer ce constat ?')) { clearTimeout(saveT); const cur = await DB.get('projects', pr.id); cur.constats = cur.constats.filter(x => x.id !== id); await DB.put('projects', cur); unBack(); finish(); }
      };
    }
    draw();
  });
}

async function constatPdf(p, c) {
  const ld = loading('Création du PDF…');
  try {
    const R = newDoc(c.title || 'Constat', p); const { doc, M, W } = R;
    // titre + en-tête
    doc.setFillColor(185, 28, 28); doc.rect(M, R.y, W - 2 * M, 12, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(pt((c.title || 'Constat de non-conformité').toUpperCase()), M + 4, R.y + 8); doc.setFontSize(10); doc.text(pt(c.ref || ''), W - M - 4, R.y + 8, { align: 'right' });
    R.y += 16;
    const info = [['Projet', c.projet || p.name], ['Date', fmtDate(c.date)], ['Entreprise', c.entreprise], ['Lot', c.lot], ['Localisation', c.lieu], ['Rédigé par', c.redacteur], ['Destinataire', c.destinataire]].filter(x => x[1]);
    const half = Math.ceil(info.length / 2), colW = (W - 2 * M) / 2;
    doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.2); doc.rect(M, R.y, W - 2 * M, half * 7 + 3);
    info.forEach(([k, v], i) => { const x = M + 3 + (i >= half ? colW : 0), y = R.y + 6 + (i % half) * 7; doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(100, 100, 100); doc.text(pt(k + ' :'), x, y); doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20); doc.text(pt(String(v)), x + 26, y, { maxWidth: colW - 30 }); });
    R.y += half * 7 + 9;
    const GC = { mineure: [22, 163, 74], majeure: [234, 88, 12], critique: [185, 28, 28] };
    for (const [i, it] of c.items.entries()) {
      const imgs = [];
      for (const fid of (it.photoIds || []).slice(0, 2)) { const f = await DB.get('files', fid); if (f && f.blob) imgs.push(await blobToJpegURL(f.blob, 900)); }
      const photoW = 72, textX = M + photoW + 6, textW = W - M - textX - 2;
      doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
      const pl = doc.splitTextToSize(pt(it.probleme || '—'), textW), sl = doc.splitTextToSize(pt(it.solution || '—'), textW);
      const imgH = imgs.reduce((a, im) => a + Math.min(54, im.h * (photoW / im.w)) + 2, 0);
      const txtH = 22 + pl.length * 4.2 + sl.length * 4.2;
      const h = Math.max(imgH + 10, txtH, 40);
      R.need(h + 4);
      const g = GC[it.gravite] || GC.majeure;
      doc.setFillColor(245, 247, 250); doc.rect(M, R.y, W - 2 * M, 8, 'F'); doc.setDrawColor(200, 200, 200); doc.rect(M, R.y, W - 2 * M, h);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(20, 20, 20); doc.text(pt(`Point ${i + 1}${it.loc ? '  -  ' + it.loc : ''}`), M + 3, R.y + 5.5);
      doc.setFillColor(...g); doc.roundedRect(W - M - 26, R.y + 1.5, 23, 5, 1, 1, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.text(pt((it.gravite || 'majeure').toUpperCase()), W - M - 14.5, R.y + 5, { align: 'center' });
      let iy = R.y + 10;
      for (const im of imgs) { const hh = Math.min(54, im.h * (photoW / im.w)), ww = im.w * (hh / im.h); doc.addImage(im.url, 'JPEG', M + 2 + (photoW - ww) / 2, iy, ww, hh); iy += hh + 2; }
      if (!imgs.length) { doc.setTextColor(150, 150, 150); doc.setFontSize(9); doc.text('(sans photo)', M + 4, R.y + 16); }
      let ty = R.y + 14;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(185, 28, 28); doc.text('CONSTAT', textX, ty); ty += 4.5;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20); pl.forEach(l => { doc.text(l, textX, ty); ty += 4.2; }); ty += 3;
      doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 120, 60); doc.text('SOLUTION', textX, ty); ty += 4.5;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20); sl.forEach(l => { doc.text(l, textX, ty); ty += 4.2; });
      R.y += h + 4;
    }
    R.need(30); R.y += 6;
    doc.setFontSize(9.5); doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'bold');
    doc.text(pt('Rédacteur'), M + 10, R.y); doc.text(pt('Entreprise (prise en compte)'), W / 2 + 10, R.y);
    doc.setDrawColor(180, 180, 180); doc.rect(M, R.y + 2, (W - 2 * M) / 2 - 4, 22); doc.rect(W / 2 + 2, R.y + 2, (W - 2 * M) / 2 - 2, 22);
    R.y += 26;
    R.finish();
    ld.close();
    await sharePdf(doc, `${safeName(c.ref || 'Constat')}_${c.date || todayISO()}.pdf`);
  } catch (e) { ld.close(); console.error(e); alertBox('Erreur PDF : ' + (e.message || e)); }
}
