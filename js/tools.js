// Outils : fusion de PDF (accueil) + constats de non-conformité (par projet)

// ================= Outils PDF : fusionner, diviser, modifier les pages =================
// pdf-lib copie les pages telles quelles (qualité d'origine, texte et traits vectoriels conservés).
async function openPdfTools() {
  if (!window.PDFLib) return alertBox('Module PDF non disponible — mettez l\'application à jour.');
  const { PDFDocument } = PDFLib;
  const sources = [];          // { name, kind: 'pdf'|'image', bytes, mime, pdfjs? }
  let pages = [];              // { id, s: index source, p: index page (0..), thumb }
  let sel = new Set(), result = null, name = 'Document';
  const el = document.createElement('div'); el.className = 'fullpage toolpage pdft'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  const close = async () => { if (result || !pages.length || await confirmBox('Quitter ? Le travail en cours sera perdu.', 'Quitter')) { unBack(); el.remove(); } };

  async function readFiles(files) {
    const out = [];
    for (const f of files) {
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      const bytes = new Uint8Array(await f.arrayBuffer());
      const src = { name: f.name.replace(/\.[^.]+$/, ''), kind: isPdf ? 'pdf' : 'image', bytes, mime: f.type || (isPdf ? 'application/pdf' : 'image/jpeg') };
      let n = 1;
      if (isPdf) { try { src.pdfjs = await pdfjsLib.getDocument({ data: bytes.slice() }).promise; n = src.pdfjs.numPages; } catch (e) { toast('PDF illisible : ' + f.name); continue; } }
      sources.push(src); const si = sources.length - 1;
      for (let i = 0; i < n; i++) out.push({ id: DB.uid(), s: si, p: i, thumb: '' });
    }
    return out;
  }
  async function thumb(pg) {
    if (pg.thumb) return pg.thumb;
    const src = sources[pg.s];
    if (src.kind === 'image') return (pg.thumb = URL.createObjectURL(new Blob([src.bytes], { type: src.mime })));
    const page = await src.pdfjs.getPage(pg.p + 1), vp1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: 320 / Math.max(vp1.width, vp1.height) });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, viewport: vp }).promise;
    return (pg.thumb = c.toDataURL('image/jpeg', 0.75));
  }
  async function add() {
    const files = await pickFiles({ accept: 'application/pdf,image/*', multiple: true }); if (!files.length) return;
    const ld = loading('Lecture…'); try { pages.push(...await readFiles(files)); if (name === 'Document' && sources[0]) name = sources[0].name; } finally { ld.close(); }
    result = null; draw();
  }
  async function replace(i) {
    const files = await pickFiles({ accept: 'application/pdf,image/*', multiple: false }); if (!files.length) return;
    const np = await readFiles(files); if (!np.length) return;
    let pick = np[0];
    if (np.length > 1) { const v = await menu('Quelle page utiliser ?', np.map((x, k) => ({ label: `Page ${k + 1}`, icon: 'file', value: String(k) }))); if (v == null) return; pick = np[+v]; }
    pages[i] = pick; result = null; draw(); toast('Page remplacée ✓');
  }
  // construit un PDF avec les pages données (qualité d'origine)
  async function build(list) {
    const out = await PDFDocument.create(), cache = new Map();
    for (const pg of list) {
      const src = sources[pg.s];
      if (src.kind === 'pdf') {
        if (!cache.has(pg.s)) cache.set(pg.s, await PDFDocument.load(src.bytes, { ignoreEncryption: true }));
        const [cp] = await out.copyPages(cache.get(pg.s), [pg.p]); out.addPage(cp);
      } else {
        let img;
        if (/png/i.test(src.mime)) img = await out.embedPng(src.bytes);
        else if (/jpe?g/i.test(src.mime)) img = await out.embedJpg(src.bytes);
        else { const j = await blobToJpegURL(new Blob([src.bytes], { type: src.mime }), 4000); img = await out.embedJpg(await (await fetch(j.url)).arrayBuffer()); }
        const land = img.width > img.height, W = land ? 841.89 : 595.28, H = land ? 595.28 : 841.89, k = Math.min(W / img.width, H / img.height);
        const page = out.addPage([W, H]); page.drawImage(img, { x: (W - img.width * k) / 2, y: (H - img.height * k) / 2, width: img.width * k, height: img.height * k });
      }
    }
    return new Blob([await out.save()], { type: 'application/pdf' });
  }
  const mo = (b) => (b.size / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Mo';
  async function generate() {
    const ld = loading('Création du PDF…');
    try { result = { blob: await build(pages), name: `${safeName(name)}.pdf`, n: pages.length }; } catch (e) { alertBox('Erreur : ' + (e.message || e)); } finally { ld.close(); }
    draw(); el.querySelector('.tool-body').scrollTop = 0;
  }
  async function split() {
    const list = sel.size ? pages.filter(p => sel.has(p.id)) : pages;
    const v = await menu(`Diviser (${list.length} page${list.length > 1 ? 's' : ''}${sel.size ? ' sélectionnées' : ''})`, [
      { label: 'Un PDF par page', icon: 'layers', value: 'each' }, ...(sel.size ? [{ label: 'Extraire la sélection en un PDF', icon: 'pdf', value: 'one' }] : [])]);
    if (!v) return;
    const ld = loading('Création…');
    try {
      if (v === 'one') { const b = await build(list); ld.close(); return shareBlob(b, `${safeName(name)}_extrait.pdf`); }
      const blobs = []; for (const [k, pg] of list.entries()) { ld.set(`Page ${k + 1} / ${list.length}`); blobs.push({ b: await build([pg]), n: `${safeName(name)}_p${pages.indexOf(pg) + 1}.pdf` }); }
      ld.close(); await shareBlobs(blobs);
    } catch (e) { ld.close(); alertBox('Erreur : ' + (e.message || e)); }
  }
  function draw() {
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('close')}</button><h1 style="flex:1">Outils PDF</h1>${pages.length ? `<button class="iconbtn" data-a="add">${icon('plus')}</button>` : ''}</div>
      <div class="tool-body">
        ${result ? `<div class="pt-res"><span class="pp-ic">${icon('pdf')}</span><div class="grow"><b>${esc(result.name)}</b><small>${result.n} page(s) · ${mo(result.blob)} · qualité d'origine</small></div>
          <div class="pt-res-a"><button data-a="see">${icon('eye')} Voir</button><button data-a="send">${icon('share')} Envoyer</button></div></div>` : ''}
        ${!pages.length ? `<div class="tool-intro">${icon('pdf')}<div><b>Fusionner, diviser, modifier des pages</b><small>Ajoutez un ou plusieurs PDF / photos : chaque page s'affiche, vous pouvez la déplacer, la remplacer ou la supprimer.</small></div></div>
          <button class="btn" data-a="add" style="width:100%">${icon('plus')} Ajouter des PDF / photos</button>` : `
        <label class="mg-name"><small>Nom du fichier</small><input data-a="name" value="${esc(name)}"></label>
        <div class="pt-bar"><span>${pages.length} page(s)${sel.size ? ` · ${sel.size} sélectionnée(s)` : ''}</span>${sel.size ? `<button data-a="unsel">Désélectionner</button><button data-a="delsel" class="d">${icon('trash')} Supprimer</button>` : '<small>Appui long = sélectionner</small>'}</div>
        <div class="pt-grid">${pages.map((pg, i) => `<div class="pt-pg ${sel.has(pg.id) ? 'sel' : ''}" data-i="${i}">
            <div class="pt-im"><img data-th="${i}" alt=""><span class="pt-n">${i + 1}</span>${sel.has(pg.id) ? `<span class="pt-ck">${icon('check')}</span>` : ''}</div>
            <div class="pt-src">${esc(sources[pg.s].name)}${sources[pg.s].kind === 'pdf' ? ' · p' + (pg.p + 1) : ''}</div>
            <div class="pt-act"><button data-l="${i}" ${i ? '' : 'disabled'}>◀</button><button data-r="${i}" title="Remplacer">⇄</button><button data-d="${i}" class="d">✕</button><button data-rt="${i}" ${i < pages.length - 1 ? '' : 'disabled'}>▶</button></div></div>`).join('')}</div>
        <div class="pt-foot"><button class="btn ghost" data-a="split">${icon('layers')} Diviser</button><button class="btn" data-a="go">${icon('check')} ${pages.length > 1 ? 'Fusionner' : 'Générer'} (${pages.length} p.)</button></div>`}
      </div>`;
    $('[data-a=x]', el).onclick = close;
    $$('[data-a=add]', el).forEach(b => b.onclick = add);
    const nm = $('[data-a=name]', el); if (nm) nm.oninput = () => { name = nm.value; };
    const g = $('[data-a=go]', el); if (g) g.onclick = generate;
    const sp = $('[data-a=split]', el); if (sp) sp.onclick = split;
    const se = $('[data-a=see]', el); if (se) se.onclick = () => showPdf(result.blob, result.name);
    const sd = $('[data-a=send]', el); if (sd) sd.onclick = () => shareBlob(result.blob, result.name);
    const us = $('[data-a=unsel]', el); if (us) us.onclick = () => { sel.clear(); draw(); };
    const ds = $('[data-a=delsel]', el); if (ds) ds.onclick = () => { pages = pages.filter(p => !sel.has(p.id)); sel.clear(); result = null; draw(); };
    const mv = (i, j) => { [pages[i], pages[j]] = [pages[j], pages[i]]; result = null; draw(); };
    $$('[data-l]', el).forEach(b => b.onclick = () => mv(+b.dataset.l, +b.dataset.l - 1));
    $$('[data-rt]', el).forEach(b => b.onclick = () => mv(+b.dataset.rt, +b.dataset.rt + 1));
    $$('[data-d]', el).forEach(b => b.onclick = () => { pages.splice(+b.dataset.d, 1); result = null; draw(); });
    $$('[data-r]', el).forEach(b => b.onclick = () => replace(+b.dataset.r));
    $$('.pt-im', el).forEach(im => {
      const i = +im.parentNode.dataset.i; let t = null;
      im.addEventListener('pointerdown', () => { t = setTimeout(() => { t = 'long'; const id = pages[i].id; sel.has(id) ? sel.delete(id) : sel.add(id); draw(); }, 450); });
      const cancel = () => { if (t && t !== 'long') clearTimeout(t); };
      im.addEventListener('pointerup', async () => { if (t === 'long') { t = null; return; } cancel(); t = null;
        if (sel.size) { const id = pages[i].id; sel.has(id) ? sel.delete(id) : sel.add(id); return draw(); }
        const pg = pages[i]; const b = await build([pg]); showPdf(b, `Page ${i + 1}`); });
      im.addEventListener('pointerleave', cancel); im.addEventListener('pointercancel', cancel);
    });
    $$('img[data-th]', el).forEach(async img => { const u = await thumb(pages[+img.dataset.th]); if (img.isConnected) img.src = u; });
  }
  draw();
}
const openPdfMerger = openPdfTools;
async function shareBlobs(list) {
  const P = window.Capacitor?.Plugins || {};
  if (P.Filesystem && P.Share) {
    const uris = [];
    for (const { b, n } of list) {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(b); });
      await P.Filesystem.writeFile({ path: n, data: b64, directory: 'CACHE' }); uris.push((await P.Filesystem.getUri({ path: n, directory: 'CACHE' })).uri);
    }
    try { await P.Share.share({ files: uris, dialogTitle: 'Envoyer' }); } catch (e) {}
    return;
  }
  for (const { b, n } of list) await shareBlob(b, n);
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
