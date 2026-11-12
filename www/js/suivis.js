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
  const mine = async (p) => (await DB.all('dsmodeles')).filter(m => m.entrepriseId === entId() && m.projetId === projId(p) && m.categorie === 'suivi').sort((a, b) => a.nom.localeCompare(b.nom));
  const lignesOf = async (m) => (await DB.all('dsdossiers')).filter(d => d.modeleId === m.id && d.entrepriseId === m.entrepriseId).sort((a, b) => (b.creeLe || 0) - (a.creeLe || 0));
  const unique = (base, taken) => { let id = base, i = 2; while (taken.has(id)) id = base + '_' + i++; return id; };

  // ---------- liste des suivis du projet ----------
  // point d'entrée (Outils) : le suivi s'ouvre comme un onglet de l'écran Réception / Bétonnage ; sinon, liste en feuille
  const dispo = (k) => { try { return !!SECTIONS[k] && sectionOn(k) && Team.canSection(k); } catch (e) { return false; } };
  async function openSuivis(p) {
    if (typeof DocumentStudio === 'undefined') return toast('Module non chargé');
    const sec = dispo('reception') ? 'reception' : dispo('beton') ? 'beton' : null;
    if (!sec) return listeFeuille(p);
    let list = await mine(p);
    if (!list.length) { const m = await nouveauSuivi(p); if (!m) return; list = [m]; }
    App.recTab = { pid: p.id, id: list[0].id }; App.section = sec; renderSection();
  }
  async function listeFeuille(p) {
    const list = await mine(p), counts = {};
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
    try { const blob = await ftMake(p, m.visuel, valeursPdf(m, d), d.id); ld.close(); openFileRecord({ blob, mime: 'application/pdf', name: `${m.nom}.pdf` }, m.nom); }
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
    for (const d of await lignesOf(m)) await DB.delRaw('dsdossiers', d.id);
    if (m.visuel) await DB.del('files', m.visuel.fileId).catch(() => {});
    await DB.delRaw('dsmodeles', m.id);
  }

  // ---------- modèles prêts à l'emploi, classés selon le type de projet (p.type) ----------
  // colonne : 'Nom|type|choix1,choix2' (type : t texte, n nombre, d date, l liste, c case)
  const PRESETS = [
    { nom: 'Gradins', ico: '🏟️', types: ['equip', 'indus'], cols: ['Secteur|t', 'Gradin n°|t', 'Axe / file|t', 'Coffrage|c', 'Ferraillage|c', 'Bétonnage|d', 'Décoffrage|d', 'Observation|t'] },
    { nom: 'Chape', ico: '🧱', types: ['bat', 'villa', 'reno', 'so', 'equip'], cols: ['Niveau|t', 'Local|t', 'Surface m²|n', 'Type|l|Ciment,Autolissante,Fluide,Allégée', 'Épaisseur cm|n', 'Date de coulage|d', 'Planéité|l|Conforme,Non conforme', 'Observation|t'] },
    { nom: 'Maçonnerie', ico: '🏗️', types: ['bat', 'villa', 'reno', 'equip'], cols: ['Niveau|t', 'Zone / axe|t', 'Type de mur|l|Cloison 7,Cloison 10,Mur 15,Mur 20,Mur 25', 'Longueur m|n', 'Hauteur m|n', 'Date|d', 'État|l|À faire,En cours,Terminé', 'Observation|t'] },
    { nom: 'Étanchéité', ico: '💧', types: ['bat', 'equip', 'reno', 'hydro', 'ga', 'villa'], cols: ['Zone|t', 'Support|t', 'Surface m²|n', 'Revêtement|l|Bicouche,Monocouche,Membrane,Résine', 'Date|d', 'Essai à l\'eau|l|Conforme,Non conforme,Non fait', 'PV|c'] },
    { nom: 'Enduit & plâtre', ico: '🪣', types: ['bat', 'villa', 'reno', 'so', 'equip'], cols: ['Niveau|t', 'Local|t', 'Surface m²|n', 'Type|l|Enduit ciment,Plâtre,Projeté', 'Date|d', 'État|l|À faire,En cours,Terminé'] },
    { nom: 'Carrelage', ico: '🔲', types: ['bat', 'villa', 'reno', 'so', 'equip'], cols: ['Niveau|t', 'Local|t', 'Référence|t', 'Surface m²|n', 'Date de pose|d', 'Joints|c', 'Réception|l|Acceptée,Réserves,Refusée'] },
    { nom: 'Peinture', ico: '🎨', types: ['bat', 'villa', 'reno', 'so', 'equip'], cols: ['Niveau|t', 'Local|t', 'Couche|l|Impression,1re couche,2e couche,Finition', 'Surface m²|n', 'Date|d', 'Réception|l|Acceptée,Réserves'] },
    { nom: 'Faux plafond', ico: '⬜', types: ['bat', 'equip', 'so', 'reno'], cols: ['Niveau|t', 'Local|t', 'Type|t', 'Surface m²|n', 'Ossature|c', 'Plaques|c', 'Finition|c'] },
    { nom: 'Menuiserie', ico: '🚪', types: ['bat', 'villa', 'reno', 'so', 'equip'], cols: ['Niveau|t', 'Repère|t', 'Type|l|Porte,Fenêtre,Baie,Garde-corps', 'Matière|l|Alu,PVC,Bois,Acier', 'Dimensions|t', 'Pose|d', 'Réception|l|Acceptée,Réserves'] },
    { nom: 'Plomberie', ico: '🚰', types: ['bat', 'villa', 'reno', 'equip'], cols: ['Niveau|t', 'Zone|t', 'Réseau|l|EU,EV,EF,ECS,Incendie', 'Diamètre|t', 'Longueur m|n', 'Essai de pression|l|Conforme,Non conforme,Non fait', 'Date|d'] },
    { nom: 'Électricité', ico: '⚡', types: ['bat', 'villa', 'reno', 'equip', 'indus'], cols: ['Niveau|t', 'Zone|t', 'Lot|l|Gaines,Câblage,Appareillage,Tableaux', 'Quantité|n', 'Date|d', 'Contrôle|l|Conforme,Non conforme,Non fait'] },
    { nom: 'Tranchées & réseaux', ico: '🛣️', types: ['vrd', 'route', 'ext'], cols: ['Tronçon|t', 'PK début|t', 'PK fin|t', 'Longueur m|n', 'Diamètre|t', 'Profondeur m|n', 'Lit de pose|c', 'Remblai|c', 'Essai|l|Conforme,Non conforme,Non fait', 'Date|d'] },
    { nom: 'Chaussée (couches)', ico: '🛤️', types: ['route', 'vrd'], cols: ['PK début|t', 'PK fin|t', 'Couche|l|Terrassement,Forme,GNT,Base,Roulement', 'Épaisseur cm|n', 'Compactage %|n', 'Date|d', 'Contrôle|l|Conforme,Non conforme,Non fait'] },
    { nom: 'Appuis & tabliers', ico: '🌉', types: ['ga', 'pont'], cols: ['Ouvrage|t', 'Élément|l|Fondation,Pile,Culée,Chevêtre,Tablier', 'Ferraillage|c', 'Coffrage|c', 'Bétonnage|d', 'Éprouvettes|t', 'Observation|t'] },
    { nom: 'Suivi libre', ico: '📋', types: [], cols: ['Élément|t', 'Date|d', 'État|l|À faire,En cours,Terminé', 'Observation|t'] },
  ];
  function colsOfPreset(pr) {
    const taken = new Set(), TY = { t: 'texte', n: 'nombre', d: 'date', l: 'liste', c: 'case' };
    return pr.cols.map(x => { const [lib, t, opt] = x.split('|'), c = { id: unique(slug(lib), taken), libelle: lib, type: TY[t] || 'texte', obligatoire: false }; taken.add(c.id); if (c.type === 'liste') c.options = String(opt || '').split(',').map(z => z.trim()).filter(Boolean); return c; });
  }
  // proposer : d'abord les modèles qui correspondent au type du projet, puis les autres ; ou un suivi vide
  async function nouveauSuivi(p) {
    const ty = p.type, ordre = PRESETS.map((x, i) => ({ x, i, rel: ty && x.types.includes(ty) })).sort((a, b) => (b.rel - a.rel) || (a.i - b.i));
    const T = typeof projTypeOf === 'function' && projTypeOf(ty);
    const v = await menu('Nouveau suivi' + (T ? ` · ${T.e} ${T.n.replace(/\s*\(.*\)/, '')}` : ''), [{ label: '✏️ Suivi vide (je choisis les colonnes)', value: '-1' }, ...ordre.map(o => ({ label: `${o.x.ico} ${o.x.nom}${o.rel ? '  ⭐ conseillé' : ''}`, value: String(o.i) }))]);
    if (v == null || v === '') return null;
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
          <div class="fs-info"><b>Colonnes (${champs.length})</b>${champs.length ? champs.map((c, i) => `<div class="ds-col"><span>${i + 1}. ${esc(c.libelle)} <small>· ${esc((TYPES.find(t => t[0] === c.type) || [, c.type])[1])}${c.obligatoire ? ' · obligatoire' : ''}</small></span><span class="ds-cb"><button class="btn ghost" data-up="${i}" ${i ? '' : 'disabled'}>↑</button><button class="btn ghost" data-dn="${i}" ${i < champs.length - 1 ? '' : 'disabled'}>↓</button><button class="btn ghost" data-ced="${i}">${icon('edit')}</button><button class="btn ghost" data-del="${i}">${icon('close')}</button></span></div>`).join('') : '<div class="muted">Aucune colonne</div>'}</div>
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
                await DB.putRaw('dsmodeles', { ...m, ...(visuel ? { visuel } : {}), creeLe: existing ? existing.creeLe : Date.now(), modifieLe: Date.now() });
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
            for (const d of lignes) await DB.delRaw('dsdossiers', d.id);
            if (m.visuel) await DB.del('files', m.visuel.fileId).catch(() => {});
            await DB.delRaw('dsmodeles', m.id); s.close(); toast('Suivi supprimé'); resolve();
          };
          el.querySelectorAll('[data-pdf]').forEach(b => b.onclick = () => { const d = lignes.find(x => x.id === b.dataset.pdf); if (d) lignePdf(p, m, d); });
          el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
            if (!(await confirmBox('Supprimer cette ligne ?'))) return;
            await DB.delRaw('dsdossiers', b.dataset.del); nav = true; s.close(); resolve(suiviOpen(p, m));
          });
        },
      });
      s.onClose = () => { if (!nav) resolve(); };
    });
  }

  async function ligneForm(p, m, existing) {
    const champs = m.champs.filter(c => ['texte', 'nombre', 'date', 'liste', 'case'].includes(c.type));
    const vx = (c, v) => v === undefined || v === null ? '' : c.type === 'case' ? (v ? 'oui' : 'non') : v;
    const r = await formSheet(existing ? 'Modifier la ligne' : 'Nouvelle ligne', champs.map(c => ({
      name: c.id, label: c.libelle + (c.obligatoire ? ' *' : ''), value: existing ? vx(c, existing.valeurs[c.id]) : '',
      type: c.type === 'nombre' ? 'number' : c.type === 'date' ? 'date' : c.type === 'liste' ? 'select' : c.type === 'case' ? 'select' : 'text',
      options: c.type === 'liste' ? [{ value: '', label: '—' }, ...c.options.map(o => ({ value: o, label: o }))] : c.type === 'case' ? [{ value: '', label: '—' }, { value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }] : undefined,
    })), { okLabel: existing ? 'Enregistrer' : 'Ajouter', danger: existing ? 'Supprimer cette ligne' : null });
    if (!r) return null;
    if (r.__danger) { if (await confirmBox('Supprimer cette ligne ?')) { await DB.delRaw('dsdossiers', existing.id); toast('Ligne supprimée'); return 'supprimee'; } return null; }
    const valeurs = {};
    for (const c of champs) {
      const v = r[c.id]; if (v === '' || v === undefined) continue;
      valeurs[c.id] = c.type === 'nombre' ? Number(v) : c.type === 'case' ? v === 'oui' : v;
    }
    try {
      const d = DocumentStudio.remplir(m, valeurs, ctxOf(p));
      await DB.putRaw('dsdossiers', existing ? { ...d, id: existing.id, creeLe: existing.creeLe, modifieLe: Date.now() } : { ...d, id: 'd_' + DB.uid(), creeLe: Date.now() });
      toast(existing ? 'Ligne modifiée' : 'Ligne ajoutée'); return d;
    } catch (e) { toast(String(e.message || e)); return null; }
  }


  // ---------- onglets dans l'écran Réception / Bétonnage ----------
  const jour = (t) => { try { return new Date(t).toLocaleDateString('fr-FR'); } catch (e) { return ''; } };
  async function tabsHtml(p) {
    if (typeof DocumentStudio === 'undefined') return '';
    const list = await mine(p), act = App.recTab && App.recTab.pid === p.id ? App.recTab.id : null;
    return list.map(m => `<button class="${act === m.id ? 'on' : ''}" data-sv="${esc(m.id)}">${icon('grid')} ${esc(m.nom)}</button>`).join('') + `<button data-sv-new title="Nouveau suivi">＋</button>`;
  }
  function bindTabs(root, p) {
    const go = (id) => { App.recTab = id ? { pid: p.id, id } : null; renderSection(); };
    root.querySelectorAll('.kseg [data-sv]').forEach(b => b.onclick = () => go(b.dataset.sv));
    ($('.kseg [data-sv-new]', root) || {}).onclick = async () => { const m = await nouveauSuivi(p); if (m) go(m.id); };
  }
  // affiche le suivi choisi à la place du contenu Réception / Bétonnage ; retourne false si le suivi n'existe plus
  async function renderTab(root, p, kind) {
    const m = (await mine(p)).find(x => x.id === App.recTab.id);
    if (!m) { App.recTab = null; return false; }
    const lignes = await lignesOf(m), q = (App.recSearchSv || '').trim().toLowerCase();
    const txt = (d) => m.champs.map(c => show(c, d.valeurs[c.id])).join(' ').toLowerCase();
    const L = q ? lignes.filter(d => txt(d).includes(q)) : lignes, pdf = !!(m.visuel && m.visuel.fields && m.visuel.fields.length);
    const seg = `<div class="kseg sv"><button data-k="reception" ${dispo('reception') ? '' : 'hidden'}>${icon('layers')} Réception</button><button data-k="beton" ${dispo('beton') ? '' : 'hidden'}>${icon('calendar')} Bétonnage</button>${await tabsHtml(p)}</div>`;
    root.innerHTML = `${seg}
      <div class="search">${icon('search')}<input placeholder="Rechercher dans « ${esc(m.nom)} »…" value="${esc(App.recSearchSv || '')}"></div>
      <div class="sv-head"><span><b>${esc(m.nom)}</b> <small>${lignes.length} ligne(s)${q ? ` · ${L.length} affichée(s)` : ''}</small></span><button class="btn ghost" data-a="cfg">${icon('edit')} Modifier</button></div>
      <div class="ds-scroll" style="margin:0 16px"><table class="ds-tab"><thead><tr><th>Date</th>${m.champs.map(c => `<th>${esc(c.libelle)}</th>`).join('')}${pdf ? '<th></th>' : ''}</tr></thead>
        <tbody>${L.length ? L.map(d => `<tr data-l="${esc(d.id)}"><td>${esc(jour(d.creeLe))}</td>${m.champs.map(c => `<td>${esc(show(c, d.valeurs[c.id]))}</td>`).join('')}${pdf ? `<td><button class="btn ghost" data-pdf="${esc(d.id)}">PDF</button></td>` : ''}</tr>`).join('') : `<tr><td colspan="${m.champs.length + 2}" class="muted">${q ? 'Aucun résultat' : 'Aucune ligne : touchez « Nouvelle ligne »'}</td></tr>`}</tbody></table></div>
      <div class="btnrow" style="margin:12px 16px"><button class="btn" data-a="add">${icon('plus')} Nouvelle ligne</button></div>`;
    root.querySelectorAll('.kseg [data-k]').forEach(b => b.onclick = () => { App.recTab = null; App.section = b.dataset.k; renderSection(); });
    bindTabs(root, p);
    const rr = () => renderSection();
    ($('.search input', root) || {}).oninput = (e) => { App.recSearchSv = e.target.value; clearTimeout(renderTab._t); renderTab._t = setTimeout(async () => { const pos = e.target.selectionStart; await renderTab(root, p, kind); const i = $('.search input', root); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (x) {} } }, 250); };
    ($('[data-a=add]', root) || {}).onclick = async () => { await ligneForm(p, m); rr(); };
    ($('[data-a=cfg]', root) || {}).onclick = async () => { const r = await suiviBuilder(p, m); if (r === 'supprime') App.recTab = null; rr(); };
    root.querySelectorAll('[data-pdf]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const d = lignes.find(x => x.id === b.dataset.pdf); if (d) lignePdf(p, m, d); });
    root.querySelectorAll('tr[data-l]').forEach(tr => tr.onclick = async () => { const d = lignes.find(x => x.id === tr.dataset.l); if (d) { await ligneForm(p, m, d); rr(); } });
    return true;
  }

  window.openSuivis = openSuivis;
  window.SuivisTabs = { tabsHtml, bind: bindTabs, render: renderTab };
  window.SuivisPerso = { mine, lignesOf, ctxOf, visuelEditer, PRESETS, colsOfPreset };
})();
