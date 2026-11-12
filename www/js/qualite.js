// ================= Service Qualité : documentation par partie d'ouvrage (v1.0.2xx) =================
// Les parties d'ouvrage (Terrassement et fondation, Gros œuvre…) et leurs rubriques (fond de fouille, compactage, PV laboratoire, réception coulage…)
// sont gardées dans le projet (p.qualParties, synchronisé). Chaque pièce est un fichier « doc » (store files, déjà synchronisé) marqué partId + rubrique,
// avec son historique (qui, quand, quoi). Un responsable (membre de l'organigramme) peut être désigné par partie.
(function () {
  const DEF = [
    { id: 'terr', nom: 'Terrassement et fondation', rub: ['Fond de fouille', 'Compactage', 'PV laboratoire sol', 'Béton de propreté', 'Réception ferraillage', 'Réception coulage'] },
    { id: 'go', nom: 'Gros œuvre', rub: ['Réception ferraillage', 'Réception coffrage', 'Réception coulage', 'PV laboratoire béton', 'Décoffrage'] },
    { id: 'etan', nom: 'Étanchéité', rub: ['Support', 'Essai à l\'eau', 'PV réception'] },
    { id: 'so', nom: 'Second œuvre', rub: ['Contrôle de réalisation', 'PV réception'] },
    { id: 'fin', nom: 'Finitions', rub: ['Contrôle de réalisation', 'PV réception'] },
    { id: 'tech', nom: 'Lots techniques (plomberie, électricité, CVC)', rub: ['Essais et tests', 'Contrôle de conformité', 'PV réception'] },
    { id: 'vrd', nom: 'VRD et réseaux', rub: ['Fond de tranchée', 'Lit de pose', 'Remblai et compactage', 'Essais', 'PV réception'] },
    { id: 'chauss', nom: 'Chaussée', rub: ['Plate-forme', 'Couche de forme', 'Couche de base', 'Enrobé', 'Essais laboratoire'] },
    { id: 'oa', nom: 'Ouvrages d\'art', rub: ['Fondations', 'Ferraillage', 'Coulage', 'PV laboratoire béton', 'PV réception'] },
  ];
  const partsOf = (p) => (p.qualParties && p.qualParties.length ? p.qualParties : DEF.map(x => ({ ...x, rub: [...x.rub] }))).filter(x => !x.archive);
  const allParts = (p) => (p.qualParties && p.qualParties.length ? p.qualParties : DEF.map(x => ({ ...x, rub: [...x.rub] })));
  // catégorie de l'ancien classement « par type » : la pièce reste visible aussi là-bas
  const catOf = (rub) => /laborat|essai/i.test(rub) ? 'labo' : /pv|réception|reception/i.test(rub) ? 'pv' : 'autre';
  const docsOf = (files, partId, rub) => files.filter(f => f.role === 'doc' && f.partId === partId && !f.archived && (rub === undefined || f.rubrique === rub));
  // avancement d'une partie : rubriques couvertes (au moins une pièce) / total, pièces au total
  function stat(part, files) {
    const L = docsOf(files, part.id), cov = part.rub.filter(r => L.some(f => f.rubrique === r));
    return { total: part.rub.length, cov: cov.length, manque: part.rub.filter(r => !cov.includes(r)), n: L.length };
  }
  const nomUser = () => { try { return localStorage.getItem('userName') || ''; } catch (e) { return ''; } };
  const uid = () => { try { return (typeof Team !== 'undefined' && Team.uid && Team.uid()) || ''; } catch (e) { return ''; } };
  // historique : qui a fait quoi et quand (jamais effacé, même si la pièce est retirée ou archivée)
  function addHist(f, act, note) { f.hist = [...(f.hist || []), { at: Date.now(), by: uid(), nom: nomUser(), act, note: note || '' }]; return f; }
  const fmtH = (t) => new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const respNom = (p, part) => { const m = (p.team || []).find(x => x.id === part.resp); return m ? m.name : ''; };
  // missions de l'organigramme (aplaties) et zones du projet : chaque pièce peut être rattachée à une mission et à une zone
  const missionsOf = (p) => (p.team || []).flatMap(m => (m.missions || []).map(x => ({ ...x, memId: m.id, memNom: m.name })));
  const zonesOf = (p, files) => { let Z = []; try { Z = typeof avZones === 'function' ? [...avZones(p)] : []; } catch (e) {} (files || []).forEach(f => { if (f.zone && !Z.includes(f.zone)) Z.push(f.zone); }); return Z; };
  const docsAll = (files) => files.filter(f => f.role === 'doc' && !f.archived);
  const refTxt = (p, f) => { const m = f.missionId && missionsOf(p).find(x => x.id === f.missionId); return [m ? '🎯 ' + m.titre : '', f.zone ? '📍 ' + f.zone : ''].filter(Boolean).join(' · '); };
  // question « mission / zone » avant d'ajouter ou pour corriger une pièce
  async function askRef(p, files, cur) {
    cur = cur || {}; const M = missionsOf(p), Z = zonesOf(p, files);
    const r = await formSheet('Rattacher à…', [
      { name: 'missionId', label: 'Mission', type: 'select', value: cur.missionId || '', options: [{ value: '', label: '— aucune mission —' }, ...M.map(x => ({ value: x.id, label: x.titre + (x.memNom ? ' · ' + x.memNom : '') }))] },
      { name: 'zone', label: 'Zone', type: 'select', value: cur.zone || '', options: [{ value: '', label: '— aucune zone —' }, ...Z.map(z => ({ value: z, label: z }))] },
      { name: 'zoneNew', label: 'Autre zone (si absente de la liste)', placeholder: 'Ex : Bloc B – Niveau 2' }], { okLabel: 'Valider' });
    if (!r) return null;
    return { missionId: r.missionId || '', zone: String(r.zoneNew || '').trim() || r.zone || '' };
  }
  // dossier Drive de la pièce : <Projet>/Qualité/<partie>/<rubrique>/<zone> (la synchro déplace le fichier si le classement change)
  const qPathOf = (part, rub, zone) => ['Qualité', part && part.nom || 'Hors partie', rub && rub !== '__autres' ? rub : 'Autres pièces', zone || ''].filter(Boolean);
  const canW = () => { try { return Team.lvl('files') >= 2; } catch (e) { return true; } };

  const isEnt = () => { try { return !!(window.ST && ST.isEnt && ST.isEnt()); } catch (e) { return false; } };
  const tabsHtml = (cur) => `<div class="qd-tabs">${[['parties', "🧱 Partie d'ouvrage"], ...(isEnt() ? [['mz', '🎯 Mission / zone']] : []), ['type', '🗂️ Type']].map(([k, l]) => `<button class="${k === cur ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div>`;
  // vue par mission ou par zone : pièces regroupées selon la mission et la zone auxquelles elles sont rattachées
  // alertes : missions en retard, missions sans pièce, parties d'ouvrage incomplètes
  const alertes = (p, files) => {
    const M = missionsOf(p), D = docsAll(files), today = new Date().toISOString().slice(0, 10), open = M.filter(m => m.statut !== 'done');
    const late = open.filter(m => m.echeance && m.echeance < today), vide = open.filter(m => !D.some(f => f.missionId === m.id));
    const inc = partsOf(p).filter(x => stat(x, files).manque.length);
    return { late, vide, inc, n: late.length + vide.length + inc.length };
  };
  const alertesHtml = (a) => a.n ? `<div class="qd-al"><b>⚠ À traiter</b>${a.late.length ? `<span>⏰ ${a.late.length} mission(s) en retard</span>` : ''}${a.vide.length ? `<span>📎 ${a.vide.length} mission(s) sans pièce</span>` : ''}${a.inc.length ? `<span>🧱 ${a.inc.length} partie(s) d'ouvrage incomplète(s)</span>` : ''}</div>` : '';
  async function renderMZ(root) {
    const p = App.project, S = (App.mzSt = App.mzSt || { mode: 'mission', key: null }), W = canW();
    const files = docsAll(await DB.byProject('files', p.id)), M = missionsOf(p);
    const bindTabs = () => $$('[data-v]', root).forEach(b => b.onclick = () => { App.docView = b.dataset.v; App.docCat = null; renderSection(); });
    const groups = S.mode === 'mission'
      ? [...M.map(m => ({ k: m.id, t: m.titre, sub: m.memNom || '', L: files.filter(f => f.missionId === m.id) })), { k: '__none', t: 'Sans mission', sub: '', L: files.filter(f => !f.missionId || !M.some(m => m.id === f.missionId)) }]
      : [...zonesOf(p, files).map(z => ({ k: z, t: z, sub: '', L: files.filter(f => f.zone === z) })), { k: '__none', t: 'Sans zone', sub: '', L: files.filter(f => !f.zone) }];
    const g = S.key && groups.find(x => x.k === S.key);
    const head = `<div class="pagehead"><h2>Documentation & archives</h2><p>Les pièces rangées par mission ou par zone</p></div>${tabsHtml('mz')}${alertesHtml(alertes(p, files))}`;
    if (!g) {
      root.innerHTML = `${head}<div class="qd-tabs qd-sub"><button class="${S.mode === 'mission' ? 'on' : ''}" data-m="mission">🎯 Par mission</button><button class="${S.mode === 'zone' ? 'on' : ''}" data-m="zone">📍 Par zone</button></div>
        <div class="qd-list">${groups.map(x => `<button class="qd-card" data-k="${esc(x.k)}"><div class="qd-h"><b>${esc(x.t)}</b><span class="qd-n">${x.L.length} pièce${x.L.length > 1 ? 's' : ''}</span></div><small>${esc(x.sub)}${x.sub && !x.L.length ? ' · ' : ''}${!x.L.length && x.k !== '__none' ? '⚠ aucune pièce' : ''}</small></button>`).join('')}</div>`;
      bindTabs();
      $$('[data-m]', root).forEach(b => b.onclick = () => { S.mode = b.dataset.m; S.key = null; renderMZ(root); });
      $$('[data-k]', root).forEach(b => b.onclick = () => { S.key = b.dataset.k; renderMZ(root); });
      return;
    }
    const L = g.L.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    root.innerHTML = `<div class="pagehead"><button class="linkbtn" data-a="up">← ${S.mode === 'mission' ? 'Missions' : 'Zones'}</button><h2>${esc(g.t)}</h2><p>${L.length} pièce(s)</p></div>
      ${L.length ? `<div class="list">${L.map(f => `<div class="row" data-id="${f.id}"><span>${icon(/^image\//.test(f.mime || '') ? 'image' : 'file')}</span><div class="grow"><div class="title">${esc(f.name || 'Pièce')}</div><div class="sub">${esc([f.rubrique, refTxt(p, f)].filter(Boolean).join(' · '))}</div></div>${icon('chevright')}</div>`).join('')}</div>` : '<div class="empty">Aucune pièce rattachée.<br>Ajoutez-en depuis « Partie d\'ouvrage » : l\'app demande la mission et la zone.</div>'}`;
    ($('[data-a=up]', root) || {}).onclick = () => { S.key = null; renderMZ(root); };
    $$('.row[data-id]', root).forEach(r => r.onclick = async () => {
      const f = L.find(x => x.id === r.dataset.id); if (!f) return;
      const v = await menu(f.name || 'Pièce', [{ label: 'Ouvrir', icon: 'file', value: 'open' }, { label: 'Historique', icon: 'history', value: 'hist' }, ...(W ? [{ label: 'Mission / zone…', icon: 'edit', value: 'ref' }] : [])]);
      if (v === 'open') { addHist(f, 'consultation'); await DB.put('files', f); return openFileRecord(f, f.name); }
      if (v === 'hist') { const H = [...(f.hist || [])].reverse(); return sheet(`<div class="form">${H.length ? H.map(h => `<div class="qd-hi"><b>${esc(h.act)}</b><small>${fmtH(h.at)}${h.nom ? ' · ' + esc(h.nom) : ''}${h.note ? '<br>' + esc(h.note) : ''}</small></div>`).join('') : '<p class="muted">Aucun historique.</p>'}</div>`); }
      if (v === 'ref') { const q = await askRef(p, files, f); if (q) { addHist(f, 'rattachée', refTxt(p, { ...f, ...q }) || 'sans mission ni zone'); Object.assign(f, q); if (f.partId) f.qPath = qPathOf(allParts(p).find(x => x.id === f.partId), f.rubrique, f.zone); await DB.put('files', f); } renderMZ(root); } });
  }
  async function render(root) {
    if (App.docView === 'mz' && isEnt()) return renderMZ(root);
    const p = App.project, S = (App.qSt = App.qSt || {});
    if (S.pid !== p.id) { S.pid = p.id; S.part = null; S.rub = null; }
    const files = (await DB.byProject('files', p.id)), parts = partsOf(p);
    const W = canW();
    const tabs = tabsHtml('parties');
    const bindTabs = () => $$('[data-v]', root).forEach(b => b.onclick = () => { App.docView = b.dataset.v; App.docCat = null; renderSection(); });
    const part = S.part && parts.find(x => x.id === S.part);
    if (!part) {
      root.innerHTML = `<div class="pagehead"><h2>Documentation & archives</h2><p>Les pièces du service qualité, rangées par partie d'ouvrage</p></div>${tabs}
        <div class="qd-list">${parts.map(x => { const st = stat(x, files), pc = st.total ? Math.round(st.cov / st.total * 100) : 0, rn = respNom(p, x);
          return `<button class="qd-card" data-p="${x.id}"><div class="qd-h"><b>${esc(x.nom)}</b><span class="qd-n">${st.n} pièce${st.n > 1 ? 's' : ''}</span></div>
            <div class="qd-bar"><i style="width:${pc}%"></i></div>
            <small>${st.cov}/${st.total} rubriques couvertes${st.manque.length ? ` · <u>manque : ${esc(st.manque.slice(0, 2).join(', '))}${st.manque.length > 2 ? '…' : ''}</u>` : ' · ✅ complet'}${rn ? ` · 👤 ${esc(rn)}` : ''}</small></button>`; }).join('')}
          ${W ? `<button class="qd-add" data-a="pnew">${icon('plus')} Partie d'ouvrage</button>` : ''}</div>`;
      bindTabs();
      $$('[data-p]', root).forEach(b => b.onclick = () => { S.part = b.dataset.p; S.rub = null; render(root); });
      ($('[data-a=pnew]', root) || {}).onclick = async () => {
        const r = await formSheet('Nouvelle partie d\'ouvrage', [{ name: 'nom', label: 'Nom', placeholder: 'Ex : Dalle de compression' }], { okLabel: 'Créer' }); if (!r || !String(r.nom || '').trim()) return;
        p.qualParties = [...allParts(p), { id: 'q' + DB.uid(), nom: r.nom.trim(), rub: ['PV réception', 'Fiches de contrôle'] }]; await DB.put('projects', p); render(root); };
      return;
    }
    const st = stat(part, files), rn = respNom(p, part), orph = docsOf(files, part.id).filter(f => !part.rub.includes(f.rubrique));
    const saveParts = async (fn) => { const L = allParts(p).map(x => x.id === part.id ? fn({ ...x, rub: [...x.rub] }) : x); p.qualParties = L; await DB.put('projects', p); };
    if (S.rub === null || S.rub === undefined) {
      root.innerHTML = `<div class="pagehead"><button class="linkbtn" data-a="up">← Toutes les parties</button><h2>🧱 ${esc(part.nom)}</h2><p>${st.cov}/${st.total} rubriques couvertes · ${st.n} pièce(s)${rn ? ` · 👤 ${esc(rn)}` : ''}</p></div>
        <div class="qd-list">${part.rub.map(r => { const n = docsOf(files, part.id, r).length; return `<button class="qd-rub ${n ? 'ok' : 'no'}" data-r="${esc(r)}"><i>${n ? '✓' : '○'}</i><span class="grow"><b>${esc(r)}</b><small>${n ? n + ' pièce' + (n > 1 ? 's' : '') : 'Manquant'}</small></span>${icon('chevright')}</button>`; }).join('')}
          ${orph.length ? `<button class="qd-rub ok" data-r="__autres"><i>…</i><span class="grow"><b>Autres pièces</b><small>${orph.length} hors rubrique</small></span>${icon('chevright')}</button>` : ''}
          ${W ? `<div class="qd-acts"><button class="btn small ghost" data-a="rnew">${icon('plus')} Rubrique</button><button class="btn small ghost" data-a="pmore">${icon('more')} Gérer la partie</button></div>` : ''}</div>`;
      ($('[data-a=up]', root) || {}).onclick = () => { S.part = null; render(root); };
      $$('[data-r]', root).forEach(b => b.onclick = () => { S.rub = b.dataset.r; render(root); });
      ($('[data-a=rnew]', root) || {}).onclick = async () => { const r = await formSheet('Nouvelle rubrique', [{ name: 'nom', label: 'Nom', placeholder: 'Ex : Essai de plaque' }], { okLabel: 'Ajouter' });
        if (!r || !String(r.nom || '').trim() || part.rub.includes(r.nom.trim())) return; await saveParts(x => ({ ...x, rub: [...x.rub, r.nom.trim()] })); render(root); };
      ($('[data-a=pmore]', root) || {}).onclick = async () => {
        const v = await menu(part.nom, [{ label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Désigner le responsable', icon: 'users', value: 'resp' }, { label: 'Retirer une rubrique', icon: 'trash', value: 'rdel' }, { label: 'Archiver cette partie', icon: 'folder', value: 'arch', danger: true }]); if (!v) return;
        if (v === 'ren') { const r = await formSheet('Renommer', [{ name: 'nom', label: 'Nom', value: part.nom }]); if (r && String(r.nom || '').trim()) await saveParts(x => ({ ...x, nom: r.nom.trim() })); }
        if (v === 'resp') { const r = await formSheet('Responsable de la partie', [{ name: 'resp', label: 'Responsable', type: 'select', value: part.resp || '', options: [{ value: '', label: '— personne —' }, ...(p.team || []).map(m => ({ value: m.id, label: m.name }))] }]); if (r) await saveParts(x => ({ ...x, resp: r.resp || '' })); }
        if (v === 'rdel') { const r = await menu('Retirer quelle rubrique ?', part.rub.map(x => ({ label: x, value: x }))); if (r && await confirmBox(`Retirer « ${r} » ? Les pièces restent, classées dans « Autres pièces ».`, 'Retirer')) await saveParts(x => ({ ...x, rub: x.rub.filter(y => y !== r) })); }
        if (v === 'arch' && await confirmBox(`Archiver « ${part.nom} » ? Les pièces sont gardées.`, 'Archiver')) { await saveParts(x => ({ ...x, archive: Date.now() })); S.part = null; }
        render(root); };
      return;
    }
    const rub = S.rub, L = (rub === '__autres' ? orph : docsOf(files, part.id, rub)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    root.innerHTML = `<div class="pagehead"><button class="linkbtn" data-a="up">← ${esc(part.nom)}</button><h2>${rub === '__autres' ? 'Autres pièces' : esc(rub)}</h2><p>${L.length} pièce(s)</p></div>
      ${L.length ? `<div class="list">${L.map(f => `<div class="row" data-id="${f.id}"><span>${icon(/^image\//.test(f.mime || '') ? 'image' : 'file')}</span><div class="grow"><div class="title">${esc(f.name || 'Pièce')}</div><div class="sub">${esc(refTxt(p, f) ? refTxt(p, f) + ' · ' : '')}${esc(f.docDate ? fmtDate(f.docDate) : fmtH(f.updatedAt || Date.now()))}${f.byName ? ' · ' + esc(f.byName) : ''}${(f.hist || []).length ? ` · ${(f.hist || []).length} action(s)` : ''}</div></div>${icon('more')}</div>`).join('')}</div>`
        : `<div class="empty">Aucune pièce ici.${W ? '<br>Appuyez sur <b>+</b> pour scanner une photo ou ajouter un fichier.' : ''}</div>`}`;
    ($('[data-a=up]', root) || {}).onclick = () => { S.rub = null; render(root); };
    $$('.row[data-id]', root).forEach(r => r.onclick = async () => {
      const f = L.find(x => x.id === r.dataset.id); if (!f) return;
      const v = await menu(f.name || 'Pièce', [{ label: 'Ouvrir', icon: 'file', value: 'open' }, { label: 'Historique', icon: 'history', value: 'hist' }, ...(W ? [{ label: 'Mission / zone…', icon: 'edit', value: 'ref' }, { label: 'Changer de rubrique', icon: 'folder', value: 'mv' }, { label: 'Archiver la pièce', icon: 'folder', value: 'arc' }, { label: 'Supprimer', icon: 'trash', danger: true, value: 'del' }] : [])]);
      if (v === 'open') { addHist(f, 'consultation'); await DB.put('files', f); return openFileRecord(f, f.name); }
      if (v === 'hist') { const H = [...(f.hist || [])].reverse(); return sheet(`<div class="form">${H.length ? H.map(h => `<div class="qd-hi"><b>${esc(h.act)}</b><small>${fmtH(h.at)}${h.nom ? ' · ' + esc(h.nom) : ''}${h.note ? '<br>' + esc(h.note) : ''}</small></div>`).join('') : '<p class="muted">Aucun historique.</p>'}</div>`, { title: 'Historique · ' + (f.name || '') }); }
      if (v === 'ref') { const q = await askRef(p, files, f); if (q) { addHist(f, 'rattachée', refTxt(p, { ...f, ...q }) || 'sans mission ni zone'); Object.assign(f, q); f.qPath = qPathOf(part, f.rubrique, f.zone); await DB.put('files', f); } }
      if (v === 'mv') { const t = await menu('Déplacer vers', part.rub.map(x => ({ label: x, value: x, checked: x === f.rubrique }))); if (t && t !== f.rubrique) { addHist(f, 'déplacée', `${f.rubrique || '—'} → ${t}`); f.rubrique = t; f.docCat = catOf(t); f.qPath = qPathOf(part, t, f.zone); await DB.put('files', f); } }
      if (v === 'arc') { addHist(f, 'archivée'); f.archived = true; await DB.put('files', f); }
      if (v === 'del' && await confirmBox(`Supprimer « ${f.name} » ? (aussi dans Drive)`, 'Supprimer')) await DB.del('files', f.id);
      render(root); });
    if (W) fab(root, async () => {
      const k = await menu('Ajouter une pièce', [{ label: 'Photo / scan', icon: 'camera', value: 'img' }, { label: 'Fichier (PDF, Word, Excel)', icon: 'file', value: 'file' }]); if (!k) return;
      const ref = await askRef(p, files, S.lastRef); if (!ref) return; S.lastRef = ref;
      const rubName = rub === '__autres' ? '' : rub, base = { ...ref, qPath: qPathOf(part, rubName, ref.zone), projectId: p.id, role: 'doc', docCat: catOf(rubName), partId: part.id, rubrique: rubName, docDate: todayISO(), by: uid(), byName: nomUser() };
      let n = 0;
      if (k === 'file') {
        const fl = await pickFiles({ accept: '*/*', multiple: true }); if (!fl || !fl.length) return;
        for (const file of fl) { await DB.put('files', addHist({ ...base, blob: file, mime: mimeFromName(file.name, file.type), name: file.name }, 'ajoutée', `${part.nom} › ${rubName || 'autres'}`)); n++; }
      } else {
        const src = await pickSource('Ajouter une pièce'); if (!src) return;
        let imgs = await pickImages(src); if (!imgs.length) return;
        try { if (typeof scanDocuments === 'function') { const sc = await scanDocuments(imgs); if (!sc || !sc.length) return; imgs = sc; } } catch (e) {}
        const ld = loading('Enregistrement…');
        try { for (const [i, f] of imgs.entries()) { const r = await saveImageFile(p.id, f, 'doc', { ...base, name: `${rubName || part.nom} ${fmtDate(todayISO())}${imgs.length > 1 ? ' (' + (i + 1) + ')' : ''}.jpg`, hq: true }); const rec = await DB.get('files', r.id); await DB.put('files', addHist(rec, 'ajoutée', `${part.nom} › ${rubName || 'autres'}`)); n++; } } finally { ld.close(); }
      }
      toast(n + ' pièce(s) ajoutée(s) ✓'); render(root);
    });
  }
  window.QualiteDocs = { qPathOf, render, renderMZ, alertes, missionsOf, zonesOf, refTxt, partsOf, stat, addHist, catOf, DEF };
})();
