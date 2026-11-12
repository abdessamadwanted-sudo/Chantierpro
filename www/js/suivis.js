// ================= Suivis personnalisés (Document Studio, phase 2) =================
// Form Builder + saisie de lignes, 100 % local (IndexedDB : tables dsmodeles / dsdossiers, jamais synchronisées).
// S'appuie sur DocumentStudio (document-studio.js) pour valider modèles et valeurs. Pas de signature ni d'envoi ici.
(function () {
  const TYPES = [['texte', 'Texte'], ['nombre', 'Nombre'], ['date', 'Date'], ['liste', 'Liste de choix'], ['case', 'Case à cocher (oui/non)']];
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'champ';
  // identifiant d'entreprise : celui de l'espace Team connecté, sinon « local » (suivis privés à ce téléphone)
  const entId = () => { let c = ''; try { const co = typeof Team !== 'undefined' && Team.company && Team.company(); c = (co && (co.id || co.cid)) || ''; } catch (e) {} return 'e_' + (String(c || 'local').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) || 'local'); };
  const projId = (p) => 'p_' + String(p.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
  const ctxOf = (p) => ({ entrepriseId: entId(), projetId: projId(p) });
  // écriture « synchronisable » : chaque enregistrement porte son projet (projectId) et une date de modification (updatedAt),
  // ce que le moteur de synchro (Drive / équipe) utilise ; une suppression laisse une trace (tomb) pour être propagée aux autres appareils
  const projDe = (o) => o.projectId || String(o.projetId || '').replace(/^p_/, '');
  async function sput(store, o) { const r = { ...o, projectId: projDe(o), updatedAt: Date.now() }; await DB.putRaw(store, r); return r; }
  async function sdel(store, id) {
    let old = null; try { old = await DB.get(store, id); } catch (e) {}
    await DB.delRaw(store, id);
    if (old) await DB.putRaw('tomb', { id: store + ':' + id, store, rid: id, projectId: projDe(old), kind: null, driveId: null, sref: null, at: Date.now() });
  }
  // suivis créés avant la synchro : leur donner projectId + updatedAt pour qu'ils partent au prochain envoi
  async function rattraper() {
    let n = 0;
    for (const store of ['dsmodeles', 'dsdossiers']) for (const o of await DB.all(store)) {
      if (o.projectId && o.updatedAt) continue;
      await DB.putRaw(store, { ...o, projectId: projDe(o), updatedAt: o.modifieLe || o.creeLe || Date.now() }); n++;
    }
    return n;
  }
  const mine = async (p) => (await DB.all('dsmodeles')).filter(m => m.entrepriseId === entId() && m.projetId === projId(p) && m.categorie === 'suivi').sort((a, b) => a.nom.localeCompare(b.nom));
  // archivage : un suivi archivé disparaît des onglets mais garde toutes ses lignes (restaurable depuis « + »)
  const actifs = async (p) => (await mine(p)).filter(m => !m.archive);
  async function archiver(m, val) { const cur = (await mine({ id: m.projetId.slice(2) })).find(x => x.id === m.id) || m; await sput('dsmodeles', { ...cur, archive: val ? Date.now() : null }); }
  const lignesOf = async (m) => (await DB.all('dsdossiers')).filter(d => d.modeleId === m.id && d.entrepriseId === m.entrepriseId).sort((a, b) => (b.creeLe || 0) - (a.creeLe || 0));
  const unique = (base, taken) => { let id = base, i = 2; while (taken.has(id)) id = base + '_' + i++; return id; };

  // ---------- liste des suivis du projet ----------
  // point d'entrée (Outils) : le suivi s'ouvre comme un onglet de l'écran Réception / Bétonnage ; sinon, liste en feuille
  const dispo = (k) => { try { return !!SECTIONS[k] && sectionOn(k) && Team.canSection(k); } catch (e) { return false; } };
  async function openSuivis(p) {
    if (typeof DocumentStudio === 'undefined') return toast('Module non chargé');
    const sec = dispo('reception') ? 'reception' : dispo('beton') ? 'beton' : null;
    if (!sec) return listeFeuille(p);
    let list = await actifs(p);
    if (!list.length) { const m = await nouveauSuivi(p); if (!m) return; list = [m]; }
    App.recTab = { pid: p.id, id: list[0].id }; App.section = sec; renderSection();
  }
  async function listeFeuille(p) {
    const list = await actifs(p), counts = {};
    for (const m of list) counts[m.id] = (await lignesOf(m)).length;
    const s = sheet(`<div class="form">
      ${list.length ? list.map(m => `<button class="menu-item" data-open="${esc(m.id)}"><b>${esc(m.nom)}</b><small>${m.champs.length} colonne(s) · ${counts[m.id]} ligne(s)</small></button>`).join('')
        : '<p class="muted" style="margin:6px 0">Aucun suivi pour ce projet. Créez votre premier tableau de suivi (colonnes de votre choix).</p>'}
      <div class="btnrow"><button class="btn" data-a="new">${icon('plus')} Nouveau suivi</button></div></div>`, {
      title: 'Suivis personnalisés',
      onMount: (el) => {
        ($('[data-a=new]', el) || {}).onclick = async () => { s.close(); await nouveauSuivi(p); listeFeuille(p); };
        el.querySelectorAll('[data-open]').forEach(b => b.onclick = async () => { s.close(); await suiviOpen(p, list.find(m => m.id === b.dataset.open)); listeFeuille(p); });
      },
    });
  }

  // ---------- modèle visuel : photo / PDF du bon, cases liées aux colonnes ----------
  async function visuelNouveau(p, nom) {
    const v = await menu('Modèle visuel', [{ label: '📄 Un PDF', value: 'pdf' }, { label: '📷 Photo du bon (recadrée et nettoyée)', value: 'scan' }, { label: '🖼️ Photo telle quelle', value: 'img' }]);
    if (!v) return null;
    let [file] = await pickFiles({ accept: v === 'pdf' ? 'application/pdf' : 'image/*', multiple: false, capture: false }); if (!file) return null;
    if (v === 'scan' && typeof scanDocuments === 'function') { const L = await scanDocuments([file]); if (!L || !L[0]) return null; file = L[0]; }
    const ld = loading('Préparation du modèle…');
    try {
      const blob = v === 'pdf' ? file : await bnImageToPdf(file), name = (nom || 'Suivi').trim() || 'Suivi';
      const rec = await DB.put('files', { projectId: p.id, blob, mime: 'application/pdf', role: 'bontpl', name: `Modèle suivi ${name}.pdf` });
      return { id: DB.uid(), name, fileId: rec.id, fields: [] };
    } finally { ld.close(); }
  }
  // ouvre l'éditeur de cases existant (fiches.js) ; les cases sont des colonnes du suivi
  async function visuelEditer(p, visuel, champs) {
    const tpl = { ...visuel, cols: champs.filter(c => ['texte', 'nombre', 'date', 'liste', 'case'].includes(c.type)), fields: visuel.fields || [] };
    tpl.onSave = async () => { Object.assign(visuel, { fields: tpl.fields, W: tpl.W, H: tpl.H }); };
    await ftEditor(p, tpl);
  }
  // valeurs d'une ligne → texte (dates en JJ/MM/AAAA) pour ftMake
  const valeursPdf = (m, d) => { const o = {}; for (const c of m.champs) { const v = d.valeurs[c.id]; if (v === undefined || v === null || v === '') continue;
    o[c.id] = c.type === 'case' ? !!v : c.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : String(v); } return o; };
  async function lignePdf(p, m, d) {
    const ld = loading('Écriture sur le bon…');
    try { const blob = await ftMake(p, m.visuel, valeursPdf(m, d), d.id); ld.close(); const k = window.QualiteDocs ? await menu(m.nom, [{ label: 'Ouvrir le PDF', icon: 'pdf', value: 'o' }, { label: 'Envoyer à la documentation', icon: 'file', value: 'd' }]) : 'o';
      if (k === 'd') await QualiteDocs.sendToDocs(p, [{ name: `${m.nom} ${d.date || ''}.pdf`.trim(), blob, mime: 'application/pdf', srcKind: 'suivi', srcId: d.id }]); else if (k) openFileRecord({ blob, mime: 'application/pdf', name: `${m.nom}.pdf` }, m.nom); }
    catch (e) { ld.close(); alertBox('PDF impossible : ' + (e.message || e)); }
  }


  // ---------- colonne : création / modification (l'identifiant ne change jamais : les valeurs déjà saisies sont gardées) ----------
  async function colForm(c, taken) {
    const r = await formSheet(c ? 'Modifier la colonne' : 'Nouvelle colonne', [
      { name: 'libelle', label: 'Nom de la colonne', placeholder: 'Ex. Code finition', value: c ? c.libelle : '' },
      { name: 'type', label: 'Type', type: 'select', options: TYPES.map(([v, l]) => ({ value: v, label: l })), value: c ? c.type : 'texte' },
      { name: 'options', label: 'Choix possibles (séparés par des virgules, pour le type « Liste »)', placeholder: 'ST01, ST02, ST03', value: c && c.options ? c.options.join(', ') : '' },
      { name: 'obligatoire', label: 'Obligatoire ?', type: 'select', options: [{ value: 'non', label: 'Non' }, { value: 'oui', label: 'Oui' }], value: c && c.obligatoire ? 'oui' : 'non' },
    ], { okLabel: c ? 'Enregistrer' : 'Ajouter' });
    if (!r || !String(r.libelle || '').trim()) return null;
    const o = { id: c ? c.id : unique(slug(r.libelle), taken), libelle: r.libelle.trim().slice(0, 160), type: r.type, obligatoire: r.obligatoire === 'oui' };
    if (r.type === 'liste') { o.options = String(r.options || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 100); if (!o.options.length) { toast('Une liste doit avoir au moins un choix'); return null; } }
    return o;
  }
  async function supprimerSuivi(m) {
    for (const d of await lignesOf(m)) await sdel('dsdossiers', d.id);
    if (m.visuel) await DB.del('files', m.visuel.fileId).catch(() => {});
    await sdel('dsmodeles', m.id);
  }

  // ---------- modèles prêts à l'emploi, classés selon le type de projet (p.type) ----------
  // colonne : 'Nom|type|choix1,choix2' (type : t texte, n nombre, d date, l liste, c case)
  const PRESETS = [
    { nom: 'Gradins', ico: '🏟️', types: ['equip', 'indus'], svc: ['travaux', 'ferraillage'], cols: ['Secteur|t', 'Gradin n°|t', 'Axe / file|t', 'Coffrage|c', 'Ferraillage|c', 'Bétonnage|d', 'Décoffrage|d', 'Observation|t'] },
    { nom: 'Chape', ico: '🧱', types: ['bat', 'villa', 'reno', 'so', 'equip'], svc: ['travaux', 'ferraillage'], cols: ['Niveau|t', 'Local|t', 'Surface m²|n', 'Type|l|Ciment,Autolissante,Fluide,Allégée', 'Épaisseur cm|n', 'Date de coulage|d', 'Planéité|l|Conforme,Non conforme', 'Observation|t'] },
    { nom: 'Maçonnerie', ico: '🏗️', types: ['bat', 'villa', 'reno', 'equip'], svc: ['travaux', 'ferraillage'], cols: ['Niveau|t', 'Zone / axe|t', 'Type de mur|l|Cloison 7,Cloison 10,Mur 15,Mur 20,Mur 25', 'Longueur m|n', 'Hauteur m|n', 'Date|d', 'État|l|À faire,En cours,Terminé', 'Observation|t'] },
    { nom: 'Étanchéité', ico: '💧', types: ['bat', 'equip', 'reno', 'hydro', 'ga', 'villa'], svc: ['travaux'], cols: ['Zone|t', 'Support|t', 'Surface m²|n', 'Revêtement|l|Bicouche,Monocouche,Membrane,Résine', 'Date|d', 'Essai à l\'eau|l|Conforme,Non conforme,Non fait', 'PV|c'] },
    { nom: 'Enduit & plâtre', ico: '🪣', types: ['bat', 'villa', 'reno', 'so', 'equip'], svc: ['travaux'], cols: ['Niveau|t', 'Local|t', 'Surface m²|n', 'Type|l|Enduit ciment,Plâtre,Projeté', 'Date|d', 'État|l|À faire,En cours,Terminé'] },
    { nom: 'Carrelage', ico: '🔲', types: ['bat', 'villa', 'reno', 'so', 'equip'], svc: ['travaux'], cols: ['Niveau|t', 'Local|t', 'Référence|t', 'Surface m²|n', 'Date de pose|d', 'Joints|c', 'Réception|l|Acceptée,Réserves,Refusée'] },
    { nom: 'Peinture', ico: '🎨', types: ['bat', 'villa', 'reno', 'so', 'equip'], svc: ['travaux'], cols: ['Niveau|t', 'Local|t', 'Couche|l|Impression,1re couche,2e couche,Finition', 'Surface m²|n', 'Date|d', 'Réception|l|Acceptée,Réserves'] },
    { nom: 'Faux plafond', ico: '⬜', types: ['bat', 'equip', 'so', 'reno'], svc: ['travaux'], cols: ['Niveau|t', 'Local|t', 'Type|t', 'Surface m²|n', 'Ossature|c', 'Plaques|c', 'Finition|c'] },
    { nom: 'Menuiserie', ico: '🚪', types: ['bat', 'villa', 'reno', 'so', 'equip'], svc: ['travaux'], cols: ['Niveau|t', 'Repère|t', 'Type|l|Porte,Fenêtre,Baie,Garde-corps', 'Matière|l|Alu,PVC,Bois,Acier', 'Dimensions|t', 'Pose|d', 'Réception|l|Acceptée,Réserves'] },
    { nom: 'Plomberie', ico: '🚰', types: ['bat', 'villa', 'reno', 'equip'], svc: ['travaux', 'maintenance'], cols: ['Niveau|t', 'Zone|t', 'Réseau|l|EU,EV,EF,ECS,Incendie', 'Diamètre|t', 'Longueur m|n', 'Essai de pression|l|Conforme,Non conforme,Non fait', 'Date|d'] },
    { nom: 'Électricité', ico: '⚡', types: ['bat', 'villa', 'reno', 'equip', 'indus'], svc: ['travaux', 'maintenance'], cols: ['Niveau|t', 'Zone|t', 'Lot|l|Gaines,Câblage,Appareillage,Tableaux', 'Quantité|n', 'Date|d', 'Contrôle|l|Conforme,Non conforme,Non fait'] },
    { nom: 'Tranchées & réseaux', ico: '🛣️', types: ['vrd', 'route', 'ext'], svc: ['travaux', 'topo'], cols: ['Tronçon|t', 'PK début|t', 'PK fin|t', 'Longueur m|n', 'Diamètre|t', 'Profondeur m|n', 'Lit de pose|c', 'Remblai|c', 'Essai|l|Conforme,Non conforme,Non fait', 'Date|d'] },
    { nom: 'Chaussée (couches)', ico: '🛤️', types: ['route', 'vrd'], svc: ['travaux', 'topo'], cols: ['PK début|t', 'PK fin|t', 'Couche|l|Terrassement,Forme,GNT,Base,Roulement', 'Épaisseur cm|n', 'Compactage %|n', 'Date|d', 'Contrôle|l|Conforme,Non conforme,Non fait'] },
    { nom: 'Appuis & tabliers', ico: '🌉', types: ['ga', 'pont'], svc: ['travaux', 'ferraillage'], cols: ['Ouvrage|t', 'Élément|l|Fondation,Pile,Culée,Chevêtre,Tablier', 'Ferraillage|c', 'Coffrage|c', 'Bétonnage|d', 'Éprouvettes|t', 'Observation|t'] },
    { nom: 'Ferraillage', ico: '🔩', types: ['bat', 'villa', 'equip', 'indus', 'ga', 'pont'], svc: ['ferraillage', 'travaux', 'qualite'], cols: ['Niveau|t', 'Zone / axe|t', 'Élément|t', 'Diamètres|t', 'Espacement cm|n', 'Enrobage|c', 'Date|d', 'Réception|l|Acceptée,Réserves,Refusée', 'Observation|t'] },
    { nom: 'Coffrage', ico: '🪵', types: ['bat', 'villa', 'equip', 'indus', 'ga', 'pont'], svc: ['travaux', 'ferraillage'], cols: ['Niveau|t', 'Zone / axe|t', 'Élément|t', 'Aplomb|c', 'Étanchéité du coffrage|c', 'Date|d', 'Décoffrage|d', 'Observation|t'] },
    { nom: 'Contrôle qualité', ico: '✅', types: [], svc: ['qualite', 'labo'], cols: ['Zone|t', 'Point de contrôle|t', 'Référence|t', 'Date|d', 'Résultat|l|Conforme,Non conforme,À reprendre', 'Action corrective|t', 'Levée|c'] },
    { nom: 'Essais béton', ico: '🧪', types: [], svc: ['qualite', 'labo', 'centrale'], cols: ['N° BL|t', 'Élément|t', 'Classe|t', 'Affaissement cm|n', 'Éprouvettes|t', 'Date|d', 'Résistance 28 j MPa|n', 'Conforme|c'] },
    { nom: 'Implantation & levés', ico: '📐', types: [], svc: ['topo'], cols: ['Point|t', 'X|n', 'Y|n', 'Z|n', 'Écart mm|n', 'Date|d', 'Contrôle|l|Conforme,Non conforme,Non fait'] },
    { nom: 'Contrôles HSE', ico: '🦺', types: [], svc: ['hse'], cols: ['Zone|t', 'Point de contrôle|t', 'Conforme|c', 'Action|t', 'Responsable|t', 'Échéance|d'] },
    { nom: 'Livraisons béton', ico: '🚛', types: [], svc: ['centrale', 'travaux'], cols: ['N° BL|t', 'Classe|t', 'Volume m³|n', 'Camion|t', 'Heure|t', 'Affaissement cm|n', 'Ouvrage|t'] },
    { nom: 'Suivi libre', ico: '📋', types: [], cols: ['Élément|t', 'Date|d', 'État|l|À faire,En cours,Terminé', 'Observation|t'] },
  ];
  function colsOfPreset(pr) {
    const taken = new Set(), TY = { t: 'texte', n: 'nombre', d: 'date', l: 'liste', c: 'case' };
    return pr.cols.map(x => { const [lib, t, opt] = x.split('|'), c = { id: unique(slug(lib), taken), libelle: lib, type: TY[t] || 'texte', obligatoire: false }; taken.add(c.id); if (c.type === 'liste') c.options = String(opt || '').split(',').map(z => z.trim()).filter(Boolean); return c; });
  }
  // service de l'utilisateur connecté (espace Team) : sert à proposer d'abord les modèles de son métier
  function monService() {
    try {
      const me = typeof Team !== 'undefined' && Team.me && Team.me(); if (!me) return {};
      const k = me.service || (typeof tmRoleOf === 'function' ? tmRoleOf(me.role).s : '');
      const sv = typeof TM_SERVICES !== 'undefined' ? TM_SERVICES.find(x => x.k === k) : null;
      return k ? { k, l: sv ? sv.l : k } : {};
    } catch (e) { return {}; }
  }
  // proposer : d'abord les modèles qui correspondent au type du projet, puis les autres ; ou un suivi vide
  async function nouveauSuivi(p) {
    const ty = p.type, mon = monService(), poste = (x) => !!mon.k && (x.svc || []).includes(mon.k);
    // d'abord les modèles du poste de l'utilisateur, puis ceux du type de projet, puis les autres
    const ordre = PRESETS.map((x, i) => ({ x, i, pos: poste(x), rel: !poste(x) && !!(ty && x.types.includes(ty)) })).sort((a, b) => (b.pos - a.pos) || (b.rel - a.rel) || (a.i - b.i));
    const T = typeof projTypeOf === 'function' && projTypeOf(ty), arch = (await mine(p)).filter(m => m.archive);
    const v = await new Promise((resolve) => {
      let pick = null;
      const card = (o) => `<button class="sv-card ${o.rel || o.pos ? 'rel' : ''}" data-i="${o.i}"><i>${o.x.ico}</i><b>${esc(o.x.nom)}</b><small>${o.x.cols.length} colonnes</small>${o.pos ? '<em>👤 votre poste</em>' : o.rel ? '<em>⭐ conseillé</em>' : ''}</button>`;
      const s = sheet(`<div class="sv-gal">
        <p class="sv-sub">${T ? `${T.e} Projet : ${esc(T.n.replace(/\s*\(.*\)/, ''))}. ` : ''}Choisissez un modèle prêt, vous pourrez tout modifier ensuite.</p>
        ${arch.length ? `<button class="sv-card sv-blank" data-i="arch"><i>🗄️</i><span><b>Suivis archivés (${arch.length})</b><small>Restaurer un suivi</small></span></button>` : ''}
        <button class="sv-card sv-blank" data-i="-1"><i>✏️</i><span><b>Suivi vide</b><small>Je choisis moi-même les colonnes</small></span></button>
        ${ordre.some(o => o.pos) ? `<h4>Pour votre poste${mon.l ? ' (' + esc(mon.l) + ')' : ''}</h4><div class="sv-grid">${ordre.filter(o => o.pos).map(card).join('')}</div>` : ''}
        ${ordre.some(o => o.rel) ? `<h4>Conseillés pour ce projet</h4><div class="sv-grid">${ordre.filter(o => o.rel).map(card).join('')}</div>` : ''}
        <h4>${ordre.some(o => o.rel || o.pos) ? 'Autres modèles' : 'Modèles'}</h4><div class="sv-grid">${ordre.filter(o => !o.rel && !o.pos).map(card).join('')}</div></div>`, {
        title: 'Nouveau suivi',
        onMount: (el) => el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { pick = b.dataset.i; s.close(); }),
      });
      s.onClose = () => resolve(pick);
    });
    if (v == null || v === '') return null;
    if (v === 'arch') {
      const r = await menu('Suivis archivés', arch.map(m => ({ label: m.nom, icon: 'folder', value: m.id })));
      if (!r) return null; const m = arch.find(x => x.id === r); await archiver(m, false); toast('Suivi restauré'); return m;
    }
    const m = await suiviBuilder(p, null, +v >= 0 ? PRESETS[+v] : null);
    return m && m !== 'supprime' ? m : null;
  }

  // ---------- Form Builder ----------
  async function suiviBuilder(p, existing, preset) {
    return new Promise((resolve) => {
      let nom = existing ? existing.nom : preset ? preset.nom : '', champs = existing ? JSON.parse(JSON.stringify(existing.champs)) : preset ? colsOfPreset(preset) : [], visuel = existing && existing.visuel ? JSON.parse(JSON.stringify(existing.visuel)) : null;
      const draw = () => {
        const s = sheet(`<div class="form">
          <label>Nom du suivi<input name="nom" value="${esc(nom)}" placeholder="Ex. Suivi finitions sols" maxlength="160"></label>
          <div class="fs-info"><b>Colonnes (${champs.length})</b>${champs.length ? champs.map((c, i) => `<div class="ds-col"><em>${i + 1}</em><span><b>${esc(c.libelle)}</b><small>${esc(c.type === 'case' ? 'Oui / non' : c.type === 'liste' ? 'Liste de choix' : (TYPES.find(t => t[0] === c.type) || [, c.type])[1])}${c.obligatoire ? ' · obligatoire' : ''}</small></span><span class="ds-cb"><button class="btn ghost" data-up="${i}" ${i ? '' : 'disabled'}>↑</button><button class="btn ghost" data-dn="${i}" ${i < champs.length - 1 ? '' : 'disabled'}>↓</button><button class="btn ghost" data-ced="${i}">${icon('edit')}</button><button class="btn ghost" data-del="${i}">${icon('close')}</button></span></div>`).join('') : '<div class="muted">Aucune colonne</div>'}</div>
          <div class="fs-info"><b>Modèle visuel (bon / fiche)</b>${visuel ? `<div class="ds-col"><span>${esc(visuel.name)} <small>· ${visuel.fields.length} case(s) placée(s)</small></span></div>` : '<small class="muted">Optionnel : une photo ou un PDF du bon. Chaque ligne pourra être écrite dessus (PDF).</small>'}</div>
          <div class="btnrow"><button class="btn ghost" data-a="visuel">${visuel ? 'Placer / modifier les cases' : '📷 Ajouter un modèle visuel'}</button>${visuel ? '<button class="btn ghost" data-a="novisuel">Retirer</button>' : ''}</div>
          <div class="btnrow"><button class="btn ghost" data-a="addcol">${icon('plus')} Ajouter une colonne</button></div>
          <div class="btnrow"><button class="btn ghost" data-a="cancel">Annuler</button><button class="btn" data-a="save">Enregistrer</button></div>
          ${existing ? '<div class="btnrow"><button class="btn danger" data-a="rmsuivi">Supprimer ce suivi</button></div>' : ''}</div>`, {
          title: existing ? 'Modifier le suivi' : 'Nouveau suivi',
          onMount: (el) => {
            const keep = () => { nom = ($('[name=nom]', el) || {}).value || ''; };
            ($('[data-a=cancel]', el) || {}).onclick = () => { s.close(); resolve(null); };
            ($('[data-a=novisuel]', el) || {}).onclick = () => { keep(); visuel = null; s.close(); draw(); };
            ($('[data-a=visuel]', el) || {}).onclick = async () => {
              keep(); if (!champs.length) return toast('Ajoutez d\'abord au moins une colonne');
              s.close();
              try { if (!visuel) visuel = await visuelNouveau(p, nom); if (visuel) await visuelEditer(p, visuel, champs); } catch (e) { toast(String(e.message || e)); }
              draw();
            };
            ($('[data-a=addcol]', el) || {}).onclick = async () => {
              keep(); s.close();
              const c = await colForm(null, new Set(champs.map(x => x.id)));
              if (c) champs.push(c);
              draw();
            };
            el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { keep(); champs.splice(+b.dataset.del, 1); s.close(); draw(); });
            el.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { keep(); const i = +b.dataset.up; if (i > 0) [champs[i - 1], champs[i]] = [champs[i], champs[i - 1]]; s.close(); draw(); });
            el.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => { keep(); const i = +b.dataset.dn; if (i < champs.length - 1) [champs[i + 1], champs[i]] = [champs[i], champs[i + 1]]; s.close(); draw(); });
            el.querySelectorAll('[data-ced]').forEach(b => b.onclick = async () => { keep(); s.close(); const i = +b.dataset.ced, c = await colForm(champs[i], new Set(champs.map(x => x.id))); if (c) champs[i] = c; draw(); });
            ($('[data-a=rmsuivi]', el) || {}).onclick = async () => {
              if (!(await confirmBox('Supprimer ce suivi et toutes ses lignes ?'))) return;
              await supprimerSuivi(existing); s.close(); toast('Suivi supprimé'); resolve('supprime');
            };
            ($('[data-a=save]', el) || {}).onclick = async () => {
              keep();
              try {
                const base = { id: existing ? existing.id : 's_' + DB.uid(), nom: nom.trim(), entrepriseId: entId(), serviceId: 'general', projetId: projId(p), categorie: 'suivi', champs };
                const m = DocumentStudio.modele({ ...base, version: existing ? existing.version + 1 : 1 });
                if (visuel) visuel.fields = visuel.fields.filter(f => champs.some(c => c.id === f.col));   // case liée à une colonne supprimée : retirée
                await sput('dsmodeles', { ...m, ...(visuel ? { visuel } : {}), creeLe: existing ? existing.creeLe : Date.now(), modifieLe: Date.now() });
                s.close(); toast('Suivi enregistré'); resolve(m);
              } catch (e) { toast(String(e.message || e)); }
            };
          },
        });
        s.onClose = s.onClose || (() => {});
      };
      draw();
    });
  }

  // ---------- saisie / consultation ----------
  const show = (c, v) => v === undefined || v === null || v === '' ? '' : c.type === 'case' ? (v ? '✓' : '✗') : String(v);
  async function suiviOpen(p, m) {
    if (!m) return;
    return new Promise(async (resolve) => {
      const lignes = await lignesOf(m);
      let nav = false;   // true quand on referme la feuille pour naviguer ailleurs (pas pour revenir à la liste)
      const s = sheet(`<div class="form">
        <div class="ds-scroll"><table class="ds-tab"><thead><tr><th>#</th>${m.champs.map(c => `<th>${esc(c.libelle)}</th>`).join('')}<th></th></tr></thead>
        <tbody>${lignes.length ? lignes.map((d, i) => `<tr>${'<td>' + (lignes.length - i) + '</td>'}${m.champs.map(c => `<td>${esc(show(c, d.valeurs[c.id]))}</td>`).join('')}<td>${m.visuel && m.visuel.fields.length ? `<button class="btn ghost" data-pdf="${esc(d.id)}">PDF</button>` : ''}<button class="btn ghost" data-del="${esc(d.id)}">${icon('trash')}</button></td></tr>`).join('') : `<tr><td colspan="${m.champs.length + 2}" class="muted">Aucune ligne</td></tr>`}</tbody></table></div>
        <div class="btnrow"><button class="btn ghost" data-a="edit">Modifier les colonnes</button><button class="btn" data-a="add">${icon('plus')} Nouvelle ligne</button></div>
        <div class="btnrow"><button class="btn danger" data-a="rm">Supprimer ce suivi</button></div></div>`, {
        title: m.nom,
        onMount: (el) => {
          ($('[data-a=add]', el) || {}).onclick = async () => { nav = true; s.close(); await ligneForm(p, m); resolve(suiviOpen(p, m)); };
          ($('[data-a=edit]', el) || {}).onclick = async () => { nav = true; s.close(); const nm = await suiviBuilder(p, m); resolve(suiviOpen(p, nm ? (await mine(p)).find(x => x.id === m.id) : m)); };
          ($('[data-a=rm]', el) || {}).onclick = async () => {
            if (!(await confirmBox('Supprimer ce suivi et toutes ses lignes ?'))) return;
            for (const d of lignes) await sdel('dsdossiers', d.id);
            if (m.visuel) await DB.del('files', m.visuel.fileId).catch(() => {});
            await sdel('dsmodeles', m.id); s.close(); toast('Suivi supprimé'); resolve();
          };
          el.querySelectorAll('[data-pdf]').forEach(b => b.onclick = () => { const d = lignes.find(x => x.id === b.dataset.pdf); if (d) lignePdf(p, m, d); });
          el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
            if (!(await confirmBox('Supprimer cette ligne ?'))) return;
            await sdel('dsdossiers', b.dataset.del); nav = true; s.close(); resolve(suiviOpen(p, m));
          });
        },
      });
      s.onClose = () => { if (!nav) resolve(); };
    });
  }

  async function ligneForm(p, m, existing, opt = {}) {
    const champs = m.champs.filter(c => ['texte', 'nombre', 'date', 'liste', 'case'].includes(c.type));
    const vx = (c, v) => v === undefined || v === null ? '' : c.type === 'case' ? (v ? 'oui' : 'non') : v;
    const jourInit = existing ? (existing.jour || new Date(existing.creeLe || Date.now()).toISOString().slice(0, 10)) : (opt.jour || todayISO());
    const r = await formSheet(existing ? 'Modifier la ligne' : 'Nouvelle ligne', [{ name: '__jour', label: 'Date', type: 'date', value: jourInit }, ...champs.map(c => ({
      name: c.id, label: c.libelle + (c.obligatoire ? ' *' : ''), value: existing ? vx(c, existing.valeurs[c.id]) : '',
      type: c.type === 'nombre' ? 'number' : c.type === 'date' ? 'date' : c.type === 'liste' ? 'select' : c.type === 'case' ? 'select' : 'text',
      options: c.type === 'liste' ? [{ value: '', label: '—' }, ...c.options.map(o => ({ value: o, label: o }))] : c.type === 'case' ? [{ value: '', label: '—' }, { value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }] : undefined,
    }))], { okLabel: existing ? 'Enregistrer' : 'Ajouter', danger: existing ? 'Supprimer cette ligne' : null });
    if (!r) return null;
    if (r.__danger) { if (await confirmBox('Supprimer cette ligne ?')) { await sdel('dsdossiers', existing.id); toast('Ligne supprimée'); return 'supprimee'; } return null; }
    const valeurs = {};
    for (const c of champs) {
      const v = r[c.id]; if (v === '' || v === undefined) continue;
      valeurs[c.id] = c.type === 'nombre' ? Number(v) : c.type === 'case' ? v === 'oui' : v;
    }
    try {
      const d = DocumentStudio.remplir(m, valeurs, ctxOf(p));
      const jour = /^\d{4}-\d{2}-\d{2}$/.test(r.__jour || '') ? r.__jour : jourInit;
      await sput('dsdossiers', existing ? { ...d, id: existing.id, creeLe: existing.creeLe, jour, modifieLe: Date.now() } : { ...d, id: 'd_' + DB.uid(), creeLe: Date.now(), jour });
      toast(existing ? 'Ligne modifiée' : 'Ligne ajoutée'); return d;
    } catch (e) { toast(String(e.message || e)); return null; }
  }


  // ---------- onglets dans l'écran Réception / Bétonnage ----------
  const jour = (t) => { try { return new Date(t).toLocaleDateString('fr-FR'); } catch (e) { return ''; } };
  async function tabsHtml(p) {
    if (typeof DocumentStudio === 'undefined') return '';
    const list = await actifs(p), act = App.recTab && App.recTab.pid === p.id ? App.recTab.id : null;
    return list.map(m => `<button class="${act === m.id ? 'on' : ''}" data-sv="${esc(m.id)}">${icon('grid')} ${esc(m.nom)}</button>`).join('') + `<button class="sv-plus" data-sv-new title="Nouveau suivi">＋</button>`;
  }
  function bindTabs(root, p) {
    const go = (id) => { App.recTab = id ? { pid: p.id, id } : null; renderSection(); };
    root.querySelectorAll('.kseg [data-sv]').forEach(b => b.onclick = () => go(b.dataset.sv));
    ($('.kseg [data-sv-new]', root) || {}).onclick = async () => { const m = await nouveauSuivi(p); if (m) go(m.id); };
  }
  // ---------- vue d'un suivi : même structure que Réception / Bétonnage (filtres, mois repliables → jours, bouton +, partage) ----------
  const jourOf = (d) => d.jour || new Date(d.creeLe || Date.now()).toISOString().slice(0, 10);
  const colDe = (m, re) => m.champs.find(c => re.test(AutoNorm(c.libelle)));
  const AutoNorm = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const texteLigne = (m, d) => m.champs.map(c => { const v = show(c, d.valeurs[c.id]); return v ? `${c.libelle} : ${v}` : ''; }).filter(Boolean).join(' · ');
  // choisir la date d'une nouvelle ligne (aujourd'hui / date passée), comme pour un tableau de réception
  async function choisirJour() {
    const t0 = todayISO(), pick = await menu('Nouvelle ligne', [{ label: `Aujourd'hui (${fmtDate(t0)})`, icon: 'calendar', value: 'today' }, { label: 'Une date passée…', icon: 'history', value: 'past' }]);
    if (!pick) return null;
    if (pick === 'today') return t0;
    const r = await formSheet('Choisir la date', [{ name: 'date', label: 'Date', type: 'date', value: t0 }], { okLabel: 'Continuer' });
    return r && r.date ? r.date : null;
  }
  // page d'un jour : même présentation que le tableau de Réception / Bétonnage
  // (entête date + projet, résumé, tableau clair, « Ajouter une ligne », « Coller un texte », Plans, PV du jour)
  const joursAvec = async (m) => [...new Set((await lignesOf(m)).map(jourOf))].sort();
  const pvOf = (m, jour) => ((m.jours || {})[jour] || {}).pvIds || [];
  async function setPv(m, jour, ids) { const cur = (await mine({ id: m.projetId.slice(2) })).find(x => x.id === m.id) || m; await sput('dsmodeles', { ...cur, jours: { ...(cur.jours || {}), [jour]: { ...((cur.jours || {})[jour] || {}), pvIds: ids } } }); }
  // « Coller un texte » : une ligne par ligne de texte ; colonnes séparées par tabulation, « ; » ou « | »
  const lignesDeTexte = (m, txt) => String(txt || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
    const parts = (/[\t;|]/.test(l) ? l.split(/[\t;|]/) : l.split(/\s{2,}/)).map(x => x.trim());
    const v = {}; m.champs.forEach((c, i) => { let x = parts[i]; if (x === undefined || x === '') return; if (c.type === 'case') v[c.id] = /^(oui|yes|1|x|ok|✓|✔)/i.test(x); else if (c.type === 'nombre') { const n = Number(String(x).replace(',', '.')); if (!isNaN(n)) v[c.id] = n; } else v[c.id] = x; });
    return v;
  }).filter(v => Object.keys(v).length);
  // signatures du jour : toujours dessinées à la main, une par rôle, avec case de consentement ; aucune signature mémorisée ni réutilisée
  const SIGS = [['redige', 'Rédigé par'], ['controle', 'Contrôlé par'], ['visa', 'Visa / Approuvé']];
  const sigsOf = (m, jour) => ((m.jours || {})[jour] || {}).sigs || {};
  async function setSig(m, jour, key, val) {
    const cur = (await mine({ id: m.projetId.slice(2) })).find(x => x.id === m.id) || m, j = (cur.jours || {})[jour] || {}, sigs = { ...(j.sigs || {}) };
    if (val) sigs[key] = val; else delete sigs[key];
    await sput('dsmodeles', { ...cur, jours: { ...(cur.jours || {}), [jour]: { ...j, sigs } } });
  }
  async function signer(m, jour, key, label) {
    let nomMem = ''; try { nomMem = localStorage.getItem('sv.signNom') || ''; } catch (e) {}
    return new Promise((resolve) => {
      let img = '', done = false;
      const s = sheet(`<div class="form"><p class="muted" style="margin:0 0 8px">${esc(label)} · ${esc(m.nom)} · ${fmtDate(jour)}</p>
        <label>Nom et prénom<input name="nom" value="${esc(nomMem)}" placeholder="Ex : Abdessamad D."></label>
        <label>Fonction<input name="fn" placeholder="Ex : Technicien qualité"></label>
        <div class="fld">Signature (à la main)<div class="sigbox"></div></div>
        <label class="chk" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" name="ok"> <span>Je confirme avoir contrôlé ces lignes et je signe sous mon nom. Je comprends que la signature est liée à ce suivi et à cette date.</span></label>
        <div class="btnrow"><button class="btn" data-a="ok" disabled>Enregistrer la signature</button></div></div>`, {
        title: 'Signer : ' + label,
        onMount: (el) => {
          const ok = $('[data-a=ok]', el), nom = $('[name=nom]', el), chk = $('[name=ok]', el);
          const maj = () => { ok.disabled = !(img && chk.checked && nom.value.trim()); };
          signaturePad($('.sigbox', el), '', (v) => { img = v; maj(); }); chk.onchange = maj; nom.oninput = maj;
          ok.onclick = async () => {
            try { localStorage.setItem('sv.signNom', nom.value.trim()); } catch (e) {}
            let uid = ''; try { uid = (typeof Team !== 'undefined' && Team.uid && Team.uid()) || ''; } catch (e) {}
            done = true; s.close(); resolve({ img, nom: nom.value.trim(), fn: $('[name=fn]', el).value.trim(), at: Date.now(), uid, consent: true });
          };
        },
      });
      s.onClose = () => { if (!done) resolve(null); };
    });
  }
  async function jourPage(p, m0, jour0) {
    return new Promise(async (resolve) => {
      let jour = jour0, m = m0;
      const el = document.createElement('div'); el.className = 'fullpage sv-dayr'; document.body.appendChild(el);
      const unBack = pushBack(() => { el.remove(); resolve(); }); const close = () => { unBack(); el.remove(); resolve(); };
      const pdf = !!(m.visuel && m.visuel.fields && m.visuel.fields.length);
      let jours = await joursAvec(m); if (!jours.includes(jour)) jours = [...jours, jour].sort();
      const sib = (dir) => { const i = jours.indexOf(jour); return i < 0 ? null : jours[i + dir] || null; };
      const draw = async () => {
        m = (await mine(p)).find(x => x.id === m.id) || m; jours = await joursAvec(m); if (!jours.includes(jour)) jours = [...jours, jour].sort();
        const L = (await lignesOf(m)).filter(d => jourOf(d) === jour).sort((a, b) => (a.creeLe || 0) - (b.creeLe || 0));
        const cases = m.champs.filter(c => c.type === 'case').slice(0, 2);
        const stats = `<span><b>${L.length}</b> ligne${L.length > 1 ? 's' : ''}</span>` + cases.map((c, i) => { const n = L.filter(d => d.valeurs[c.id]).length; return `<span style="color:${i ? '#f59e0b' : '#22c55e'}"><b>${n}</b> ${esc(c.libelle)}</span>`; }).join('');
        el.innerHTML = `<div class="topbar"><button class="iconbtn" data-a="back">${icon('back')}</button>
            <div class="dnav"><button data-dn="-1" ${sib(-1) ? '' : 'disabled'}>‹</button><h1>${fmtDate(jour)}</h1><button data-dn="1" ${sib(1) ? '' : 'disabled'}>›</button></div>
            <button class="iconbtn" data-a="share">${icon('share')}</button><button class="iconbtn" data-a="more">${icon('more')}</button></div>
          <div class="rec-sum">${stats}</div>
          <div class="rec-info"><b>${fmtDate(jour)}</b><span class="rp">${esc(p.pdfTitle || p.name)}</span><span class="rt">${esc(m.nom)}</span>${jour !== todayISO() ? `<button class="kswitch ktoday" data-a="today">📅 Aujourd'hui</button>` : ''}</div>
          <div class="rec-wrap">
            <table class="rec"><thead><tr><th>#</th>${m.champs.map(c => `<th>${esc(c.libelle)}</th>`).join('')}${pdf ? '<th>PDF</th>' : ''}</tr></thead>
            <tbody>${L.map((d, i) => `<tr data-l="${esc(d.id)}"><td class="c">${i + 1}</td>${m.champs.map(c => c.type === 'case' ? `<td class="c">${d.valeurs[c.id] ? '<span class="sv-ok">✓</span>' : '<span class="sv-no">—</span>'}</td>` : `<td class="${c.type === 'nombre' ? 'c' : ''}">${esc(show(c, d.valeurs[c.id]))}</td>`).join('')}${pdf ? `<td class="c"><button class="sv-pdf" data-pdf="${esc(d.id)}">PDF</button></td>` : ''}</tr>`).join('')}
              <tr class="addrow"><td colspan="${m.champs.length + 1 + (pdf ? 1 : 0)}"><div class="addrow-in"><button data-a="add">${icon('plus')} Ajouter une ligne</button><button data-a="paste">${icon('edit')} Coller un texte</button></div></td></tr>
            </tbody></table>
            ${typeof openRecBox === 'function' ? `<div class="rec-dplans"><button data-a="dayplans">📚 Plans des ouvrages du jour <b>${L.length}</b>${icon('chevright')}</button></div>` : ''}
            <div class="pv-day"><div class="pv-h">${icon('report')} PV du jour <span>${pvOf(m, jour).length || ''}</span></div><div class="thumbs" id="svPv"></div></div>
            <div class="pv-day sv-sigs"><div class="pv-h">${icon('pen')} Signatures</div><div class="sv-sigrow">${SIGS.map(([k, l]) => { const g = sigsOf(m, jour)[k], modif = g && L.some(d => (d.updatedAt || d.modifieLe || 0) > g.at + 1000);
              return `<button class="sv-sig ${g ? 'on' : ''}" data-sig="${k}"><small>${esc(l)}</small>${g ? `<img src="${g.img}" alt=""><b>${esc(g.nom)}</b><small>${esc(g.fn || '')}${g.fn ? ' · ' : ''}${new Date(g.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</small>${modif ? '<em>⚠ lignes modifiées après signature</em>' : ''}` : '<span>＋ Signer</span>'}</button>`; }).join('')}</div></div>
          </div>`;
        ($('[data-a=back]', el) || {}).onclick = close;
        el.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => { const j = sib(+b.dataset.dn); if (j) { jour = j; draw(); } });
        ($('[data-a=today]', el) || {}).onclick = () => { jour = todayISO(); draw(); };
        ($('[data-a=add]', el) || {}).onclick = async () => { await ligneForm(p, m, null, { jour }); draw(); };
        ($('[data-a=paste]', el) || {}).onclick = async () => {
          const r = await formSheet('Coller un texte', [{ name: 't', label: 'Une ligne par ligne · colonnes séparées par tabulation, « ; » ou « | »', type: 'textarea', value: '' }], { okLabel: 'Ajouter', intro: `<p class="muted" style="margin:0 0 8px">Ordre des colonnes : ${esc(m.champs.map(c => c.libelle).join(' · '))}</p>` });
          if (!r || !r.t) return; const lots = lignesDeTexte(m, r.t); if (!lots.length) return toast('Rien à ajouter');
          try { for (const v of lots) { const d = DocumentStudio.remplir(m, v, ctxOf(p)); await sput('dsdossiers', { ...d, id: 'd_' + DB.uid(), creeLe: Date.now(), jour }); } toast(lots.length + ' ligne(s) ajoutée(s)'); } catch (e) { toast(String(e.message || e)); }
          draw();
        };
        el.querySelectorAll('[data-sig]').forEach(b => b.onclick = async () => {
          const k = b.dataset.sig, lab = (SIGS.find(x => x[0] === k) || [])[1], g = sigsOf(m, jour)[k];
          if (g) { const o = await menu(lab + ' : ' + g.nom, [{ label: 'Retirer cette signature', icon: 'trash', danger: true, value: 'del' }]); if (o === 'del' && await confirmBox('Retirer la signature ?')) { await setSig(m, jour, k, null); draw(); } return; }
          const v = await signer(m, jour, k, lab); if (v) { await setSig(m, jour, k, v); toast('Signature enregistrée ✓'); draw(); }
        });
        const dp = $('[data-a=dayplans]', el); if (dp) dp.onclick = () => openRecBox(p.id);
        ($('[data-a=share]', el) || {}).onclick = () => { const t = `*${p.pdfTitle || p.name}*\n*${m.nom} — ${fmtDate(jour)}*\n\n` + (L.length ? L.map((d, i) => `${i + 1}. ${texteLigne(m, d)}`).join('\n') : 'Aucune ligne') + (Object.keys(sigsOf(m, jour)).length ? '\n\n✍️ Signé : ' + SIGS.filter(([k]) => sigsOf(m, jour)[k]).map(([k, l]) => `${l} ${sigsOf(m, jour)[k].nom}`).join(' · ') : ''); try { shareText(t); } catch (e) { toast('Partage impossible'); } };
        ($('[data-a=more]', el) || {}).onclick = async () => {
          const o = await menu(m.nom, [{ label: 'Modifier les colonnes', icon: 'edit', value: 'cols' }, ...(L.length ? [{ label: 'Supprimer les lignes de ce jour', icon: 'trash', danger: true, value: 'del' }] : [])]);
          if (o === 'cols') { await suiviBuilder(p, m); draw(); }
          if (o === 'del' && await confirmBox(`Supprimer les ${L.length} ligne(s) du ${fmtDate(jour)} ?`)) { for (const d of L) await sdel('dsdossiers', d.id); toast('Lignes supprimées'); draw(); }
        };
        el.querySelectorAll('[data-pdf]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const d = L.find(x => x.id === b.dataset.pdf); if (d) lignePdf(p, m, d); });
        el.querySelectorAll('tr[data-l]').forEach(tr => tr.onclick = async () => { const d = L.find(x => x.id === tr.dataset.l); if (d) { await ligneForm(p, m, d); draw(); } });
        pvBox();
      };
      // PV du jour : photos/scans du procès-verbal rattachés à ce suivi et à ce jour
      const pvBox = async () => {
        const box = $('#svPv', el); if (!box) return;
        const ids = pvOf(m, jour); let fs = []; try { fs = await loadFiles(ids); } catch (e) {}
        box.innerHTML = fs.map(f => `<div class="t" data-pv="${f.id}"><img src="${BlobURL.get(f.id, f.blob)}"><button class="x" data-pvdel="${f.id}">×</button></div>`).join('') + `<button class="t add" data-a="addpv">${icon('camera')}</button>`;
        ($('[data-a=addpv]', box) || {}).onclick = async () => {
          const src = await pickSource('Ajouter un PV'); if (!src) return;
          let files = await pickImages(src); if (!files.length) return;
          try { const sc = typeof scanDocuments === 'function' ? await scanDocuments(files) : files; if (!sc || !sc.length) return; files = sc; } catch (e) {}
          const ld = loading('Enregistrement…'); const recs = [];
          try { for (const f of files) recs.push(await saveImageFile(p.id, f, 'photo', { source: `PV ${m.nom} ${fmtDate(jour)}`, hq: true })); await setPv(m, jour, [...ids, ...recs.map(x => x.id)]); } finally { ld.close(); }
          toast(recs.length + ' PV ajouté(s) ✓'); draw();
        };
        box.querySelectorAll('[data-pv]').forEach(t => t.onclick = async (e) => {
          const id = t.dataset.pv;
          if (e.target.closest('[data-pvdel]')) { if (await confirmBox('Retirer ce PV ?')) { await setPv(m, jour, ids.filter(x => x !== id)); DB.del('files', id).catch(() => {}); draw(); } return; }
          showGallery(fs.map((f, k) => ({ src: BlobURL.get(f.id, f.blob), caption: `PV du ${fmtDate(jour)} (${k + 1})`, fileId: f.id })), fs.findIndex(x => x.id === id));
        });
      };
      draw();
    });
  }
  async function renderTab(root, p, kind) {
    const m = (await mine(p)).find(x => x.id === App.recTab.id);
    if (!m) { App.recTab = null; return false; }
    App.svF = App.svF || {}; const F = App.svF[m.id] = App.svF[m.id] || { niv: '', zone: '', q: '' }, openM = (App.svOpen = App.svOpen || {});
    const cN = colDe(m, /^(niv|niveau)\b/), cZ = colDe(m, /^zone\b/);
    const toutes = await lignesOf(m), q = AutoNorm(F.q);
    const val = (d, c) => c ? String(d.valeurs[c.id] ?? '').trim() : '';
    const nivs = cN ? [...new Set(toutes.map(d => val(d, cN)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })) : [], zones = cZ ? [...new Set(toutes.map(d => val(d, cZ)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })) : [];
    const L = toutes.filter(d => (!F.niv || val(d, cN) === F.niv) && (!F.zone || val(d, cZ) === F.zone) && (!q || AutoNorm(texteLigne(m, d)).includes(q)));
    const jours = [...new Set(L.map(jourOf))].sort().reverse(), mois = [...new Set(jours.map(j => j.slice(0, 7)))];
    const seg = `<div class="kseg sv"><button data-k="reception" ${dispo('reception') ? '' : 'hidden'}>${icon('layers')} Réception</button><button data-k="beton" ${dispo('beton') ? '' : 'hidden'}>${icon('calendar')} Bétonnage</button>${await tabsHtml(p)}</div>`;
    const fsel = (f, lab, cur, all) => `<button class="fsel ${cur ? 'on' : ''}" data-f="${f}"><small>${lab}</small><b>${esc(cur || all)}</b>${icon('chevdown')}</button>`;
    root.innerHTML = `${seg}
      <div class="search">${icon('search')}<input placeholder="Rechercher dans « ${esc(m.nom)} »…" value="${esc(F.q)}"></div>
      <div class="fbar">${cN ? fsel('niv', 'Niveau', F.niv, 'Tous') : ''}${cZ ? fsel('zone', 'Zone', F.zone, 'Toutes') : ''}<button class="fsel sv-cfgb" data-a="cfg"><small>${m.champs.length} colonnes</small><b>${icon('edit')} Modifier</b></button>${F.niv || F.zone ? `<button class="fclear" data-f="clear" title="Effacer">${icon('close')}</button>` : ''}</div>
      <div id="svBody"></div>`;
    const body = $('#svBody', root);
    if (!L.length) body.innerHTML = `<div class="empty">${toutes.length ? '🔍 Aucun résultat avec ces filtres.' : `Aucune ligne pour le moment.<br>Appuyez sur <b>+</b> pour ajouter la première.`}</div>`;
    for (const mo of mois) {
      const key = m.id + mo; if (openM[key] === undefined) openM[key] = mo === mois[0];
      const jm = jours.filter(j => j.slice(0, 7) === mo), n = L.filter(d => jourOf(d).slice(0, 7) === mo).length, open = openM[key];
      const card = document.createElement('div'); card.className = 'card mcard';
      card.innerHTML = `<div class="folder-head"><span class="fh-ic">${icon('calendar')}</span><div class="grow"><div class="title">${monthLabel(mo)}</div><div class="sub">${jm.length} jour(s) · ${n} ligne(s)</div></div><span class="fh-chev" style="transform:rotate(${open ? 180 : 0}deg)">${icon('chevdown')}</span></div>
        ${open ? `<div class="plan-rows">${jm.map(j => { const nj = L.filter(d => jourOf(d) === j).length;
          return `<div class="prow" data-j="${j}"><span class="daybox"><b>${j.slice(8, 10)}</b><small>${MONTHS[+j.slice(5, 7) - 1].slice(0, 3)}</small></span><div class="nm"><div style="font-size:16px">${fmtDate(j)}</div><div style="font-size:13px;color:var(--muted);margin-top:2px">${nj} ligne${nj > 1 ? 's' : ''}</div></div></div>`; }).join('')}</div>` : ''}`;
      body.appendChild(card);
      ($('.folder-head', card) || {}).onclick = () => { openM[key] = !open; renderSection(); };
      card.querySelectorAll('.prow[data-j]').forEach(r => r.onclick = async () => { await jourPage(p, m, r.dataset.j); renderSection(); });
    }
    root.querySelectorAll('.kseg [data-k]').forEach(b => b.onclick = () => { App.recTab = null; App.section = b.dataset.k; renderSection(); });
    bindTabs(root, p);
    const kb = $('.kseg', root), on = $('.kseg .on', root); if (kb && on) kb.scrollLeft = Math.max(0, on.offsetLeft - 60);   // l'onglet actif reste visible
    const inp = $('.search input', root);
    inp.oninput = () => { F.q = inp.value; clearTimeout(inp._t); inp._t = setTimeout(async () => { const pos = inp.selectionStart; await renderTab(root, p, kind); const i = $('.search input', root); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (x) {} } }, 250); };
    root.querySelectorAll('[data-f]').forEach(b => b.onclick = async () => {
      const f = b.dataset.f; if (f === 'clear') { F.niv = ''; F.zone = ''; return renderSection(); }
      const list = f === 'niv' ? nivs : zones, v = await menu(f === 'niv' ? 'Filtrer par niveau' : 'Filtrer par zone', [{ label: f === 'niv' ? 'Tous les niveaux' : 'Toutes les zones', icon: 'check', value: '__all' }, ...list.map(x => ({ label: f === 'niv' ? x : 'Zone ' + x, icon: 'layers', value: x }))]);
      if (v == null) return; F[f] = v === '__all' ? '' : v; renderSection();
    });
    ($('[data-a=cfg]', root) || {}).onclick = async () => { const r = await suiviBuilder(p, m); if (r === 'supprime') App.recTab = null; renderSection(); };
    // partage : un jour (texte) via WhatsApp, comme la barre verte de Réception
    const sb = document.createElement('div'); sb.className = 'sharebar'; sb.innerHTML = `<button data-sb>${icon('share')} Partager ${esc(m.nom)}…</button>`; root.appendChild(sb);
    ($('[data-sb]', sb) || {}).onclick = async () => {
      const js = [...new Set(toutes.map(jourOf))].sort().reverse(); if (!js.length) return toast('Aucune ligne');
      const j = await menu('Quel jour ?', js.slice(0, 12).map(x => ({ label: `${fmtDate(x)} · ${toutes.filter(d => jourOf(d) === x).length} ligne(s)`, icon: 'calendar', value: x })));
      if (!j) return;
      shareWhatsApp(`${m.nom} · ${p.name}\n${fmtDate(j)}\n` + toutes.filter(d => jourOf(d) === j).map((d, i) => `${i + 1}. ${texteLigne(m, d)}`).join('\n'));
    };
    fab(root, async () => { const j = await choisirJour(); if (!j) return; const d = await ligneForm(p, m, null, { jour: j }); if (d && d !== 'supprimee') { openM[m.id + j.slice(0, 7)] = true; await jourPage(p, m, j); } renderSection(); });
    return true;
  }
  window.openSuivis = openSuivis;
  window.SuivisTabs = { tabsHtml, bind: bindTabs, render: renderTab };
  window.SuivisPerso = { sigsOf, setSig, rattraper, sput, sdel, monService, actifs, archiver, mine, lignesOf, ctxOf, visuelEditer, PRESETS, colsOfPreset };
})();
