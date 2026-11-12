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
  async function openSuivis(p) {
    if (typeof DocumentStudio === 'undefined') return toast('Module non chargé');
    const list = await mine(p), counts = {};
    for (const m of list) counts[m.id] = (await lignesOf(m)).length;
    const s = sheet(`<div class="form">
      ${list.length ? list.map(m => `<button class="menu-item" data-open="${esc(m.id)}"><b>${esc(m.nom)}</b><small>${m.champs.length} colonne(s) · ${counts[m.id]} ligne(s)</small></button>`).join('')
        : '<p class="muted" style="margin:6px 0">Aucun suivi pour ce projet. Créez votre premier tableau de suivi (colonnes de votre choix).</p>'}
      <div class="btnrow"><button class="btn" data-a="new">${icon('plus')} Nouveau suivi</button></div></div>`, {
      title: 'Suivis personnalisés',
      onMount: (el) => {
        ($('[data-a=new]', el) || {}).onclick = async () => { s.close(); await suiviBuilder(p, null); openSuivis(p); };
        el.querySelectorAll('[data-open]').forEach(b => b.onclick = async () => { s.close(); await suiviOpen(p, list.find(m => m.id === b.dataset.open)); openSuivis(p); });
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

  // ---------- Form Builder ----------
  async function suiviBuilder(p, existing) {
    return new Promise((resolve) => {
      let nom = existing ? existing.nom : '', champs = existing ? JSON.parse(JSON.stringify(existing.champs)) : [], visuel = existing && existing.visuel ? JSON.parse(JSON.stringify(existing.visuel)) : null;
      const draw = () => {
        const s = sheet(`<div class="form">
          <label>Nom du suivi<input name="nom" value="${esc(nom)}" placeholder="Ex. Suivi finitions sols" maxlength="160"></label>
          <div class="fs-info"><b>Colonnes (${champs.length})</b>${champs.length ? champs.map((c, i) => `<div class="ds-col"><span>${i + 1}. ${esc(c.libelle)} <small>· ${esc((TYPES.find(t => t[0] === c.type) || [, c.type])[1])}${c.obligatoire ? ' · obligatoire' : ''}</small></span><button class="btn ghost" data-del="${i}">${icon('close')}</button></div>`).join('') : '<div class="muted">Aucune colonne</div>'}</div>
          <div class="fs-info"><b>Modèle visuel (bon / fiche)</b>${visuel ? `<div class="ds-col"><span>${esc(visuel.name)} <small>· ${visuel.fields.length} case(s) placée(s)</small></span></div>` : '<small class="muted">Optionnel : une photo ou un PDF du bon. Chaque ligne pourra être écrite dessus (PDF).</small>'}</div>
          <div class="btnrow"><button class="btn ghost" data-a="visuel">${visuel ? 'Placer / modifier les cases' : '📷 Ajouter un modèle visuel'}</button>${visuel ? '<button class="btn ghost" data-a="novisuel">Retirer</button>' : ''}</div>
          <div class="btnrow"><button class="btn ghost" data-a="addcol">${icon('plus')} Ajouter une colonne</button></div>
          <div class="btnrow"><button class="btn ghost" data-a="cancel">Annuler</button><button class="btn" data-a="save">Enregistrer</button></div></div>`, {
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
              const r = await formSheet('Nouvelle colonne', [
                { name: 'libelle', label: 'Nom de la colonne', placeholder: 'Ex. Code finition' },
                { name: 'type', label: 'Type', type: 'select', options: TYPES.map(([v, l]) => ({ value: v, label: l })), value: 'texte' },
                { name: 'options', label: 'Choix possibles (séparés par des virgules, pour le type « Liste »)', placeholder: 'ST01, ST02, ST03' },
                { name: 'obligatoire', label: 'Obligatoire ?', type: 'select', options: [{ value: 'non', label: 'Non' }, { value: 'oui', label: 'Oui' }], value: 'non' },
              ], { okLabel: 'Ajouter' });
              if (r && r.libelle) {
                const c = { id: unique(slug(r.libelle), new Set(champs.map(x => x.id))), libelle: r.libelle.slice(0, 160), type: r.type, obligatoire: r.obligatoire === 'oui' };
                if (r.type === 'liste') c.options = r.options.split(',').map(x => x.trim()).filter(Boolean).slice(0, 100);
                if (r.type === 'liste' && !c.options.length) toast('Une liste doit avoir au moins un choix'); else champs.push(c);
              }
              draw();
            };
            el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { keep(); champs.splice(+b.dataset.del, 1); s.close(); draw(); });
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

  async function ligneForm(p, m) {
    const champs = m.champs.filter(c => ['texte', 'nombre', 'date', 'liste', 'case'].includes(c.type));
    const r = await formSheet('Nouvelle ligne', champs.map(c => ({
      name: c.id, label: c.libelle + (c.obligatoire ? ' *' : ''),
      type: c.type === 'nombre' ? 'number' : c.type === 'date' ? 'date' : c.type === 'liste' ? 'select' : c.type === 'case' ? 'select' : 'text',
      options: c.type === 'liste' ? [{ value: '', label: '—' }, ...c.options.map(o => ({ value: o, label: o }))] : c.type === 'case' ? [{ value: '', label: '—' }, { value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }] : undefined,
    })), { okLabel: 'Ajouter' });
    if (!r) return null;
    const valeurs = {};
    for (const c of champs) {
      const v = r[c.id]; if (v === '' || v === undefined) continue;
      valeurs[c.id] = c.type === 'nombre' ? Number(v) : c.type === 'case' ? v === 'oui' : v;
    }
    try {
      const d = DocumentStudio.remplir(m, valeurs, ctxOf(p));
      await DB.putRaw('dsdossiers', { ...d, id: 'd_' + DB.uid(), creeLe: Date.now() });
      toast('Ligne ajoutée'); return d;
    } catch (e) { toast(String(e.message || e)); return null; }
  }

  window.openSuivis = openSuivis;
  window.SuivisPerso = { mine, lignesOf, ctxOf, visuelEditer };
})();
