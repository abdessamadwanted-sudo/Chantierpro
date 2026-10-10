// Application principale : écrans et navigation
const CATEGORIES = ['Gros œuvre', 'Coffrage', 'Ferraillage', 'Béton', 'Maçonnerie', 'Étanchéité', 'Électricité', 'Plomberie', 'Menuiserie', 'Finitions', 'Sécurité', 'Qualité'];
const LINK_CATS = [
  { key: 'coffrage', label: 'Plan coffrage', icon: 'plans' },
  { key: 'ferraillage', label: 'Plan ferraillage', icon: 'layers' },
  { key: 'coupe', label: 'Coupe', icon: 'ruler' },
  { key: 'pv', label: 'PV', icon: 'report' },
  { key: 'photo', label: 'Photos', icon: 'camera' },
  { key: 'note', label: 'Notes', icon: 'edit' },
  { key: 'autre', label: 'Autre', icon: 'file' },
];
const FORM_TEMPLATES = [
  { id: 'ferraillage', title: 'Réception ferraillage', items: ['Diamètres conformes au plan', 'Espacement des armatures', 'Nombre de barres', 'Longueurs de recouvrement', 'Enrobage (cales en place)', 'Ligatures / stabilité de la cage', 'Propreté des armatures', 'Attentes en place', 'Cadres et épingles'] },
  { id: 'coffrage', title: 'Réception coffrage', items: ['Implantation / axes', 'Dimensions conformes', 'Aplomb / verticalité', 'Niveau / altimétrie', 'Étanchéité des joints', 'Huile de décoffrage', 'Étaiement et stabilité', 'Réservations en place', 'Propreté du fond'] },
  { id: 'betonnage', title: 'Contrôle bétonnage', items: ['Bon de livraison conforme', 'Classe de béton conforme', 'Slump test (affaissement)', 'Prélèvement éprouvettes', 'Vibration correcte', 'Hauteur de chute respectée', 'Cure du béton', 'Météo compatible'] },
  { id: 'maconnerie', title: 'Contrôle maçonnerie', items: ['Implantation', 'Aplomb', 'Niveau', 'Épaisseur des joints', 'Chaînages', 'Linteaux', 'Harpage / liaison', 'Propreté'] },
  { id: 'etancheite', title: 'Contrôle étanchéité', items: ['Support propre et sec', 'Primaire appliqué', 'Recouvrement des lés', 'Relevés', 'Évacuations EP', 'Essai d\'eau (mise en eau)', 'Protection'] },
  { id: 'vide', title: 'Formulaire vide', items: [] },
];
const WEATHER = ['Ensoleillé', 'Nuageux', 'Pluie', 'Vent fort', 'Chaleur', 'Froid'];

const APP_VERSION = '__APP_VERSION__';
const App = { project: null, section: 'plans', taskFilter: 'all', search: '' };

// ---------- Helpers données ----------
async function fileURL(fileId) {
  const f = await DB.get('files', fileId);
  return f ? BlobURL.get(f.id, f.blob) : '';
}
async function saveImageFile(projectId, file, role = 'photo', extra = {}) {
  const { blob, w, h } = await compressImage(file, role === 'plan' ? 5000 : 1600, role === 'plan' ? 0.93 : 0.82);
  return DB.put('files', { projectId, blob, mime: 'image/jpeg', name: file.name, role, w, h, ...extra });
}
async function addPhotos(projectId, extra = {}) {
  const src = await menu('Ajouter des photos', [
    { label: 'Prendre une photo', icon: 'camera', value: 'cam' },
    { label: 'Choisir dans la galerie', icon: 'image', value: 'gal' },
  ]);
  if (!src) return [];
  const files = await pickFiles({ accept: 'image/*', multiple: src === 'gal', capture: src === 'cam' });
  if (!files.length) return [];
  const ld = loading('Enregistrement…');
  try {
    const out = [];
    for (const f of files) out.push(await saveImageFile(projectId, f, 'photo', extra));
    return out;
  } finally { ld.close(); }
}
function thumbsHTML(files, editable = true) {
  return `<div class="thumbs">${files.map(f => `<div class="t" data-id="${f.id}"><img src="${BlobURL.get(f.id, f.blob)}">${editable ? `<button class="x" data-del="${f.id}">×</button>` : ''}</div>`).join('')}
    ${editable ? `<button class="t add" data-a="addphoto">${icon('camera')}</button>` : ''}</div>`;
}
async function loadFiles(ids = []) {
  const out = [];
  for (const id of ids) { const f = await DB.get('files', id); if (f) out.push(f); }
  return out;
}
function shareWhatsApp(text) {
  openUrl('https://wa.me/?text=' + encodeURIComponent(text));
}

// ---------- Accueil : projets ----------
async function renderHome() {
  App.project = null;
  BackStack.length = 0;
  const projects = (await DB.all('projects')).sort((a, b) => b.updatedAt - a.updatedAt);
  $('#app').innerHTML = `
    <div class="topbar">
      <div class="brand"><span class="logo">${icon('hard')}</span>CHANTIER</div>
      <button class="iconbtn" data-a="homemore">${icon('more')}</button>
    </div>
    <div class="content">
      <div class="section-label">Projets sur l'appareil</div>
      ${projects.length ? `<div class="list">${projects.map(p => `
        <div class="row" data-id="${p.id}"><span class="icon-muted">${icon('hard')}</span>
          <div class="grow"><div class="title">${esc(p.name)}</div>${p.address ? `<div class="sub">${esc(p.address)}</div>` : ''}</div>
          <span class="icon-muted">${icon('chevright')}</span></div>`).join('')}</div>`
      : `<div class="empty">Aucun projet pour le moment.<br>Appuyez sur <b>+</b> pour créer votre premier chantier.<br><br><button class="btn ghost" data-a="restore2" style="flex:none">${icon('undo')} Restaurer une sauvegarde</button></div>`}
    </div>
    <button class="fab" data-a="new">${icon('plus')}</button>`;
  $$('.row[data-id]').forEach(r => r.onclick = async () => openProject(await DB.get('projects', r.dataset.id)));
  $('[data-a=homemore]').onclick = async () => {
    const v = await menu('Chantier', [
      { label: 'Restaurer une sauvegarde', icon: 'undo', value: 'restore' },
      { label: `Version ${APP_VERSION.startsWith('__') ? 'dev' : APP_VERSION}`, icon: 'settings', value: null },
    ]);
    if (v === 'restore') restoreBackup();
  };
  const r2 = $('[data-a=restore2]'); if (r2) r2.onclick = restoreBackup;
  $('[data-a=new]').onclick = async () => {
    const r = await formSheet('Nouveau projet', [
      { name: 'name', label: 'Nom du projet', placeholder: 'Ex : Grand stade Hassan II Benslimane' },
      { name: 'address', label: 'Adresse / ville (optionnel)' },
    ], { okLabel: 'Créer' });
    if (r && r.name) { const p = await DB.put('projects', { name: r.name, address: r.address, team: [] }); openProject(p); }
  };
}

async function openProject(p) {
  App.project = p; App.section = 'plans'; App.search = '';
  p.updatedAt = Date.now(); await DB.put('projects', p);
  renderSection();
}

// ---------- Structure d'un projet ----------
const SECTIONS = {
  plans: { label: 'Plans', icon: 'plans', render: renderPlans },
  tasks: { label: 'Tâches', icon: 'tasks', render: renderTasks },
  photos: { label: 'Photos', icon: 'camera', render: renderPhotos },
  forms: { label: 'Formulaires', icon: 'form', render: renderForms },
  reports: { label: 'Rapports journaliers', icon: 'report', render: renderReports },
  team: { label: 'Équipe', icon: 'team', render: renderTeam },
  settings: { label: 'Paramètres', icon: 'settings', render: renderSettings },
};

async function renderSection() {
  BackStack.length = 0;
  pushBack(() => renderHome());
  const s = SECTIONS[App.section];
  $('#app').innerHTML = `
    <div class="topbar dark">
      <button class="iconbtn" data-a="drawer">${icon('menu')}</button>
      <h1>${esc(App.project.name)}</h1>
      <button class="iconbtn" data-a="home">${icon('home')}</button>
    </div>
    <div class="content" id="content"></div>`;
  $('[data-a=drawer]').onclick = openDrawer;
  $('[data-a=home]').onclick = renderHome;
  await s.render($('#content'));
}

async function openDrawer() {
  const tasks = await DB.byProject('tasks', App.project.id);
  const cnt = (st) => tasks.filter(t => st === 'all' || t.status === st).length;
  const bg = document.createElement('div'); bg.className = 'drawer-bg';
  const d = document.createElement('div'); d.className = 'drawer';
  d.innerHTML = `
    <div class="drawer-head"><h3>${esc(App.project.name)}</h3><button class="iconbtn" data-home>${icon('home')}</button></div>
    ${Object.entries(SECTIONS).map(([k, s]) => `<button class="item ${App.section === k ? 'active' : ''}" data-s="${k}">${icon(s.icon)}<span>${s.label}</span></button>`).join('')}
    <div class="group">Tâches</div>
    ${[['all', 'Toutes les tâches'], ['open', 'Ouvertes'], ['progress', 'En cours'], ['done', 'Terminées'], ['verified', 'Vérifiées']].map(([k, l]) =>
      `<button class="item" data-f="${k}">${k === 'all' ? icon('tasks') : `<span class="dot" style="background:${STATUS[k].color};margin:0 5px"></span>`}<span>${l}</span><span class="count">${cnt(k)}</span></button>`).join('')}`;
  document.body.append(bg, d);
  const close = () => { unBack(); bg.remove(); d.remove(); };
  const unBack = pushBack(() => { bg.remove(); d.remove(); });
  bg.onclick = close;
  $('[data-home]', d).onclick = () => { close(); renderHome(); };
  $$('[data-s]', d).forEach(b => b.onclick = () => { close(); App.section = b.dataset.s; App.search = ''; renderSection(); });
  $$('[data-f]', d).forEach(b => b.onclick = () => { close(); App.section = 'tasks'; App.taskFilter = b.dataset.f; renderSection(); });
}

function fab(root, onClick) {
  const b = document.createElement('button');
  b.className = 'fab'; b.innerHTML = icon('plus'); b.onclick = onClick;
  root.appendChild(b);
}

// ---------- Plans ----------
async function renderPlans(root) {
  const pid = App.project.id;
  const [folders, plans, tasks] = await Promise.all([DB.byProject('folders', pid), DB.byProject('plans', pid), DB.byProject('tasks', pid)]);
  folders.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
  plans.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
  const q = App.search.toLowerCase();
  const shown = plans.filter(p => !q || p.name.toLowerCase().includes(q));
  const openCount = (planId) => tasks.filter(t => t.planId === planId && t.status !== 'verified').length;
  App.openFolders = App.openFolders || {};

  const groups = [...folders.map(f => ({ f, plans: shown.filter(p => p.folderId === f.id) }))];
  const loose = shown.filter(p => !p.folderId || !folders.find(f => f.id === p.folderId));
  if (loose.length) groups.push({ f: { id: '_none', name: 'Sans dossier' }, plans: loose });

  root.innerHTML = `
    <div class="pagehead"><h2>Plans</h2><p>Toutes les tâches sur les plans</p></div>
    <div class="search">${icon('search')}<input placeholder="Rechercher des plans" value="${esc(App.search)}"></div>
    ${groups.length ? '' : `<div class="empty">Aucun plan.<br>Appuyez sur <b>+</b> pour importer un plan (PDF ou image).</div>`}
    <div id="folders"></div>`;
  const box = $('#folders', root);
  for (const { f, plans: ps } of groups) {
    const open = q ? true : App.openFolders[f.id];
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="folder-head"><span class="icon-muted">${icon('folder')}</span>
      <div class="grow"><div class="title" style="font-size:18px">${esc(f.name)}</div><div class="sub" style="color:var(--muted);margin-top:3px">${ps.length} plan${ps.length > 1 ? 's' : ''}</div></div>
      ${f.id !== '_none' ? `<button class="iconbtn" data-more>${icon('more')}</button>` : ''}
      <span class="icon-muted" style="transform:rotate(${open ? 180 : 0}deg)">${icon('chevdown')}</span></div>
      ${open ? `<div class="plan-grid"></div>` : ''}`;
    box.appendChild(card);
    $('.folder-head', card).onclick = (e) => {
      if (e.target.closest('[data-more]')) return;
      App.openFolders[f.id] = !open; renderPlans(root);
    };
    const more = $('[data-more]', card);
    if (more) more.onclick = () => folderMenu(f, root);
    if (open) {
      const grid = $('.plan-grid', card);
      for (const p of ps) {
        const t = document.createElement('div');
        t.className = 'plan-thumb';
        const n = openCount(p.id);
        t.innerHTML = `<img src="${await fileURL(p.fileId)}" loading="lazy"><div class="name">${esc(p.name)}</div>${n ? `<span class="badge">${n}</span>` : ''}`;
        t.onclick = () => openPlanViewer(p, planCtx(() => renderPlans(root)));
        grid.appendChild(t);
      }
    }
  }
  const inp = $('.search input', root);
  inp.oninput = () => { App.search = inp.value; clearTimeout(inp._t); inp._t = setTimeout(() => { renderPlans(root).then(() => { const i = $('.search input', root); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 300); };

  fab(root, async () => {
    const v = await menu('Ajouter', [
      { label: 'Importer un plan (PDF / image)', icon: 'plans', value: 'plan' },
      { label: 'Importer depuis Google Drive (lien)', icon: 'drive', value: 'drive' },
      { label: 'Nouveau dossier', icon: 'folder', value: 'folder' },
    ]);
    if (v === 'folder') {
      const r = await formSheet('Nouveau dossier', [{ name: 'name', label: 'Nom du dossier', placeholder: 'Ex : 1-Poteaux + voiles' }], { okLabel: 'Créer' });
      if (r && r.name) { const f = await DB.put('folders', { projectId: pid, name: r.name }); App.openFolders[f.id] = true; renderPlans(root); }
    }
    if (v === 'plan' || v === 'drive') importPlans(folders, root, v === 'drive');
  });
}

async function folderMenu(f, root) {
  const v = await menu(f.name, [{ label: 'Renommer', icon: 'edit', value: 'rename' }, { label: 'Supprimer le dossier', icon: 'trash', danger: true, value: 'del' }]);
  if (v === 'rename') {
    const r = await formSheet('Renommer', [{ name: 'name', label: 'Nom du dossier', value: f.name }]);
    if (r && r.name) { f.name = r.name; await DB.put('folders', f); renderPlans(root); }
  }
  if (v === 'del' && await confirmBox('Supprimer le dossier ? (les plans iront dans « Sans dossier »)')) {
    const plans = await DB.byProject('plans', App.project.id);
    for (const p of plans.filter(p => p.folderId === f.id)) { p.folderId = null; await DB.put('plans', p); }
    await DB.del('folders', f.id); renderPlans(root);
  }
}

async function importPlans(folders, root, fromDrive = false) {
  const pid = App.project.id;
  let folderId = null;
  if (folders.length) {
    folderId = await menu('Dans quel dossier ?', [...folders.map(f => ({ label: f.name, icon: 'folder', value: f.id })), { label: 'Sans dossier', icon: 'plans', value: '_none' }]);
    if (!folderId) return;
    if (folderId === '_none') folderId = null;
  }
  let files = [];
  if (fromDrive) {
    const r = await formSheet('Plan depuis Google Drive', [
      { name: 'url', label: 'Coller le lien du fichier (PDF ou image)', type: 'url', placeholder: 'https://drive.google.com/file/d/…' },
    ], { okLabel: 'Importer' });
    if (!r || !r.url) return;
    const ld0 = loading('Téléchargement depuis Drive…');
    try { files = [await downloadFromDrive(r.url)]; }
    catch (e) { ld0.close(); return alertBox(e.message); }
    ld0.close();
  } else {
    files = await pickFiles({ accept: 'image/*,application/pdf', multiple: true });
  }
  if (!files.length) return;
  const ld = loading('Import du plan…');
  try {
    for (const file of files) {
      const base = file.name.replace(/\.[^.]+$/, '');
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        const pages = await pdfToImages(file, 5000, (p, n) => ld.set(`Conversion PDF… page ${p}/${n}`));
        // on garde le PDF original pour un affichage net quand on zoome
        const src = await DB.put('files', { projectId: pid, blob: file, mime: 'application/pdf', role: 'plansrc', name: file.name });
        for (const pg of pages) {
          const f = await DB.put('files', { projectId: pid, blob: pg.blob, mime: 'image/jpeg', role: 'plan', w: pg.w, h: pg.h, name: file.name });
          await DB.put('plans', { projectId: pid, folderId, fileId: f.id, pdfFileId: src.id, pdfPage: pg.page, w: pg.w, h: pg.h, name: pages.length > 1 ? `${base} - p${pg.page}` : base, annotations: [] });
        }
      } else {
        const f = await saveImageFile(pid, file, 'plan');
        await DB.put('plans', { projectId: pid, folderId, fileId: f.id, w: f.w, h: f.h, name: base, annotations: [] });
      }
    }
    if (folderId) App.openFolders[folderId] = true; else App.openFolders._none = true;
    toast('Plan importé ✓');
  } catch (e) {
    console.error(e); toast('Erreur d\'import : ' + e.message);
  } finally { ld.close(); renderPlans(root); }
}

function planCtx(onClose) {
  return {
    onClose,
    openTask: (t) => openTaskDetail(t),
    createTask: async (pos) => { const t = await newTask(pos); return openTaskDetail(t); },
    openLink: (l) => openLinkDetail(l),
  };
}

// ---------- Lien / élément d'ouvrage ----------
function openLinkDetail(link) {
  return new Promise(async (resolve) => {
    const pid = link.projectId;
    if (!link.items) link.items = [];
    const openCats = new Set();
    const s = sheet('<div id="lk"></div>', {});
    s.onClose = () => resolve();
    const save = () => DB.put('links', link);

    async function render() {
      const box = $('#lk', s.el);
      const files = {};
      const plansById = {};
      for (const it of link.items) {
        if (it.fileId) files[it.fileId] = await DB.get('files', it.fileId);
        if (it.planId) {
          const pl = await DB.get('plans', it.planId);
          if (pl) { plansById[pl.id] = pl; files[pl.fileId] = await DB.get('files', pl.fileId); }
        }
      }
      box.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;padding:4px 8px 10px 16px">
          <span class="dot" style="background:${link.color};width:18px;height:18px;border-radius:5px"></span>
          <h3 style="margin:0;flex:1;color:var(--text)">${esc(link.name)}</h3>
          <button class="iconbtn" data-a="more">${icon('more')}</button>
        </div>
        ${LINK_CATS.map(c => {
          const items = link.items.filter(i => i.cat === c.key);
          return `<div class="acc ${openCats.has(c.key) ? 'open' : ''}" data-c="${c.key}">
            <button class="acc-head">${icon(c.icon)}<span>${c.label}</span><span class="n">${items.length || ''}</span><span class="chev">${icon('chevdown')}</span></button>
            <div class="acc-body">
              ${items.map(it => {
                const pl = it.kind === 'plan' ? plansById[it.planId] : null;
                const f = pl ? files[pl.fileId] : files[it.fileId];
                const isImg = f && f.mime && f.mime.startsWith('image/');
                const th = it.kind === 'note' ? icon('edit') : it.kind === 'url' ? icon('drive') : isImg ? `<img src="${BlobURL.get(f.id, f.blob)}">` : icon(it.kind === 'plan' ? 'plans' : 'pdf');
                const nm = it.kind === 'note' ? it.text : it.kind === 'plan' ? (pl ? pl.name : 'Plan supprimé') : (it.name || (it.kind === 'url' ? it.url : 'Fichier'));
                const kindLbl = { url: 'Lien Drive · ', plan: 'Plan du projet · ', note: 'Note · ' }[it.kind] || '';
                return `<div class="att" data-it="${it.id}"><div class="thumb">${th}</div>
                  <div class="grow"><div class="nm">${esc(nm)}</div>
                  <div class="meta">${kindLbl}${fmtDate(it.date)}</div></div>
                  <button class="iconbtn" data-del="${it.id}">${icon('trash')}</button></div>`;
              }).join('') || `<div class="meta" style="color:var(--muted);padding:4px 0 10px">Rien pour le moment</div>`}
              <div class="acc-actions">
                ${c.key === 'photo' ? `<button class="btn small" data-add="cam">${icon('camera')} Photo</button>` : ''}
                ${c.key === 'note' ? `<button class="btn small" data-add="note">${icon('edit')} Écrire une note</button>` : ''}
                ${c.key !== 'photo' && c.key !== 'note' ? `<button class="btn small" data-add="plan">${icon('plans')} Plan du projet</button>` : ''}
                ${c.key !== 'note' ? `<button class="btn small ghost" data-add="file">${icon('image')} ${c.key === 'photo' ? 'Galerie' : 'Image / PDF'}</button>
                <button class="btn small ghost" data-add="url">${icon('drive')} Lien Drive</button>` : ''}
              </div>
            </div></div>`;
        }).join('')}`;

      $$('.acc', box).forEach(acc => {
        const cat = acc.dataset.c;
        $('.acc-head', acc).onclick = () => { openCats.has(cat) ? openCats.delete(cat) : openCats.add(cat); render(); };
        $$('[data-add]', acc).forEach(b => b.onclick = () => addItem(cat, b.dataset.add));
      });
      $$('.att', box).forEach(a => a.onclick = async (e) => {
        const it = link.items.find(i => i.id === a.dataset.it);
        if (e.target.closest('[data-del]')) {
          if (await confirmBox('Supprimer cet élément ?')) {
            link.items = link.items.filter(i => i !== it);
            if (it.fileId) await DB.del('files', it.fileId);
            await save(); render();
          }
          return;
        }
        if (it.kind === 'url') return openUrl(it.url);
        if (it.kind === 'note') {
          const r = await formSheet('Note', [{ name: 'text', label: 'Note', type: 'textarea', value: it.text }]);
          if (r && r.text) { it.text = r.text; it.date = Date.now(); await save(); render(); }
          return;
        }
        if (it.kind === 'plan') {
          const pl = plansById[it.planId];
          if (!pl) return toast('Ce plan a été supprimé');
          s.close();
          return openPlanViewer(pl, planCtx(() => {}));
        }
        const f = files[it.fileId];
        if (!f) return;
        if (f.mime.startsWith('image/')) showImage(BlobURL.get(f.id, f.blob), it.name);
        else if (f.mime === 'application/pdf') showPdf(f.blob, it.name);
        else toast('Type de fichier non affichable');
      });
      $('[data-a=more]', box).onclick = async () => {
        const v = await menu(link.name, [
          { label: 'Renommer', icon: 'edit', value: 'rename' },
          { label: 'Changer la couleur', icon: 'layers', value: 'color' },
          { label: 'Supprimer l\'élément', icon: 'trash', danger: true, value: 'del' },
        ]);
        if (v === 'rename') {
          const r = await formSheet('Renommer', [{ name: 'name', label: 'Nom', value: link.name }]);
          if (r && r.name) { link.name = r.name; await save(); render(); }
        }
        if (v === 'color') {
          const c = await menu('Couleur', PALETTE.filter(c => c !== '#ffffff').map(c => ({ label: c, value: c, checked: c === link.color })));
          if (c) { link.color = c; await save(); render(); }
        }
        if (v === 'del' && await confirmBox('Supprimer cet élément et tous ses fichiers ?')) {
          for (const it of link.items) if (it.fileId) await DB.del('files', it.fileId);
          await DB.del('links', link.id); s.close();
        }
      };
    }

    async function addItem(cat, how) {
      openCats.add(cat);
      if (how === 'note') {
        const r = await formSheet('Nouvelle note', [{ name: 'text', label: 'Note', type: 'textarea', placeholder: 'Ex : Enrobage insuffisant côté axe C, à reprendre avant coulage' }], { okLabel: 'Ajouter' });
        if (r && r.text) { link.items.push({ id: DB.uid(), cat, kind: 'note', text: r.text, date: Date.now() }); await save(); }
        return render();
      }
      if (how === 'plan') {
        const [plans, folders] = await Promise.all([DB.byProject('plans', pid), DB.byProject('folders', pid)]);
        const others = plans.filter(p => p.id !== link.planId);
        if (!others.length) { toast('Importez d\'abord ce plan dans « Plans »'); return; }
        const fname = (id) => (folders.find(f => f.id === id) || {}).name;
        others.sort((a, b) => `${fname(a.folderId) || ''} ${a.name}`.localeCompare(`${fname(b.folderId) || ''} ${b.name}`, 'fr', { numeric: true }));
        const planId = await menu('Choisir le plan', others.map(p => ({ label: (fname(p.folderId) ? fname(p.folderId) + ' / ' : '') + p.name, icon: 'plans', value: p.id })));
        if (planId) { link.items.push({ id: DB.uid(), cat, kind: 'plan', planId, date: Date.now() }); await save(); }
        return render();
      }
      if (how === 'url') {
        const r = await formSheet('Lien Google Drive', [
          { name: 'url', label: 'Coller le lien (Drive, Dropbox, …)', type: 'url', placeholder: 'https://drive.google.com/…' },
          { name: 'name', label: 'Nom (optionnel)', placeholder: LINK_CATS.find(c => c.key === cat).label },
        ], { okLabel: 'Ajouter' });
        if (!r || !r.url) return render();
        const label = r.name || LINK_CATS.find(c => c.key === cat).label;
        if (/drive\.google\.com|docs\.google\.com/.test(r.url) && driveFileId(r.url) && isNative()) {
          const ld = loading('Téléchargement depuis Drive…');
          try {
            const file = await downloadFromDrive(r.url);
            let rec;
            if (file.type.startsWith('image/')) rec = await saveImageFile(pid, file, cat === 'photo' ? 'photo' : 'doc', { source: link.name });
            else rec = await DB.put('files', { projectId: pid, blob: file, mime: file.type, name: file.name, role: 'doc' });
            link.items.push({ id: DB.uid(), cat, kind: 'file', fileId: rec.id, url: r.url, name: r.name || file.name.replace(/\.[^.]+$/, ''), date: Date.now() });
            await save(); toast('Fichier Drive enregistré ✓');
            return render();
          } catch (e) {
            toast(e.message);
          } finally { ld.close(); }
        }
        link.items.push({ id: DB.uid(), cat, kind: 'url', url: r.url, name: label, date: Date.now() }); await save();
        return render();
      }
      const files = await pickFiles({ accept: cat === 'photo' ? 'image/*' : 'image/*,application/pdf', multiple: how !== 'cam', capture: how === 'cam' });
      if (!files.length) return;
      const ld = loading('Enregistrement…');
      try {
        for (const file of files) {
          let rec;
          if (file.type.startsWith('image/')) rec = await saveImageFile(pid, file, cat === 'photo' ? 'photo' : 'doc', { source: link.name });
          else rec = await DB.put('files', { projectId: pid, blob: file, mime: file.type || 'application/pdf', name: file.name, role: 'doc' });
          link.items.push({ id: DB.uid(), cat, kind: 'file', fileId: rec.id, name: file.name.replace(/\.[^.]+$/, ''), date: Date.now() });
        }
        await save();
      } finally { ld.close(); render(); }
    }
    render();
  });
}

// ---------- Tâches ----------
async function newTask(extra = {}) {
  const tasks = await DB.byProject('tasks', App.project.id);
  const num = tasks.reduce((m, t) => Math.max(m, t.num || 0), 0) + 1;
  return DB.put('tasks', { projectId: App.project.id, num, title: '', status: 'open', priority: 2, assignee: '', category: '', due: '', description: '', photoIds: [], log: [{ t: Date.now(), msg: 'Tâche créée' }], ...extra });
}

async function renderTasks(root) {
  const pid = App.project.id;
  const [tasks, plans] = await Promise.all([DB.byProject('tasks', pid), DB.byProject('plans', pid)]);
  const planName = (id) => (plans.find(p => p.id === id) || {}).name || '';
  const q = App.search.toLowerCase();
  const list = tasks.filter(t => (App.taskFilter === 'all' || t.status === App.taskFilter) &&
    (!q || `${t.num} ${t.title} ${t.assignee} ${t.category}`.toLowerCase().includes(q)))
    .sort((a, b) => b.num - a.num);
  root.innerHTML = `
    <div class="pagehead"><h2>Tâches</h2><p>${tasks.length} tâche(s) au total</p></div>
    <div class="search">${icon('search')}<input placeholder="Rechercher une tâche" value="${esc(App.search)}"></div>
    <div class="chips">${[['all', 'Toutes'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])].map(([k, l]) =>
      `<button class="chip ${App.taskFilter === k ? 'on' : ''}" data-f="${k}">${l} (${tasks.filter(t => k === 'all' || t.status === k).length})</button>`).join('')}</div>
    ${list.length ? `<div class="list">${list.map(t => `
      <div class="row" data-id="${t.id}"><span class="tasknum" style="background:${STATUS[t.status].color}">${t.num}</span>
        <div class="grow"><div class="title">${esc(t.title || 'Sans titre')}</div>
        <div class="sub">${[t.category, t.assignee, planName(t.planId) && '📍 ' + planName(t.planId), t.due && '⏰ ' + fmtDate(t.due)].filter(Boolean).map(esc).join(' · ') || STATUS[t.status].label}</div></div>
        <span style="color:${['', '#ef4444', '#f59e0b', '#9aa3b2'][t.priority]};font-weight:700;font-size:13px">P${t.priority}</span></div>`).join('')}</div>`
    : `<div class="empty">Aucune tâche ici.<br>Créez une tâche avec <b>+</b> ou placez un pin sur un plan.</div>`}`;
  $$('[data-f]', root).forEach(b => b.onclick = () => { App.taskFilter = b.dataset.f; renderTasks(root); });
  $$('.row[data-id]', root).forEach(r => r.onclick = async () => { await openTaskDetail(tasks.find(t => t.id === r.dataset.id)); renderTasks(root); });
  const inp = $('.search input', root);
  inp.oninput = () => { App.search = inp.value; clearTimeout(inp._t); inp._t = setTimeout(() => renderTasks(root).then(() => { const i = $('.search input', root); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 300); };
  fab(root, async () => { const t = await newTask(); await openTaskDetail(t); renderTasks(root); });
}

function openTaskDetail(task) {
  return new Promise(async (resolve) => {
    const pid = task.projectId;
    const project = await DB.get('projects', pid);
    const team = (project.team || []).map(m => m.name);
    const plan = task.planId ? await DB.get('plans', task.planId) : null;
    const el = document.createElement('div');
    el.className = 'fullpage';
    document.body.appendChild(el);
    const done = () => { el.remove(); resolve(); };
    const unBack = pushBack(async () => { await flush(); done(); });

    let saveT;
    const save = () => { clearTimeout(saveT); saveT = setTimeout(() => DB.put('tasks', task), 400); };
    const flush = async () => { clearTimeout(saveT); if (!task.title) task.title = 'Nouvelle tâche'; await DB.put('tasks', task); };
    const log = (msg) => { task.log = task.log || []; task.log.push({ t: Date.now(), msg }); };

    async function render() {
      const photos = await loadFiles(task.photoIds);
      el.innerHTML = `
        <div class="topbar">
          <button class="iconbtn" data-a="back">${icon('back')}</button>
          <span class="tasknum" style="background:${STATUS[task.status].color};margin-left:6px">${task.num}</span>
          <h1>Tâche #${task.num}</h1>
          <button class="iconbtn" data-a="share">${icon('share')}</button>
          <button class="iconbtn" data-a="more">${icon('more')}</button>
        </div>
        <div class="content"><div class="form" style="padding-top:16px">
          <label>Titre<input name="title" value="${esc(task.title)}" placeholder="Ex : Reprise enrobage poteau P12"></label>
          <div class="fld">Statut<div class="seg">${Object.entries(STATUS).map(([k, v]) => `<button data-st="${k}" class="${task.status === k ? 'on' : ''}" style="${task.status === k ? `background:${v.color}` : ''}">${v.label}</button>`).join('')}</div></div>
          <div class="fld">Priorité<div class="seg seg3">${[1, 2, 3].map(p => `<button data-pr="${p}" class="${task.priority === p ? 'on' : ''}" style="${task.priority === p ? `background:${['', '#ef4444', '#f59e0b', '#6b7280'][p]}` : ''}">Priorité ${p}</button>`).join('')}</div></div>
          <div class="kv">
            <label>Responsable<input name="assignee" list="dl-team" value="${esc(task.assignee)}" placeholder="Nom"></label>
            <label>Échéance<input name="due" type="date" value="${esc(task.due)}"></label>
          </div>
          <label>Catégorie<input name="category" list="dl-cat" value="${esc(task.category)}" placeholder="Gros œuvre, Ferraillage…"></label>
          <label>Description<textarea name="description" placeholder="Détails, localisation, axe…">${esc(task.description)}</textarea></label>
          ${plan ? `<button class="btn ghost" data-a="plan">${icon('pin')} Voir sur le plan : ${esc(plan.name)}</button>` : ''}
          <label>Photos</label>${thumbsHTML(photos)}
          <div class="fld">Commentaire<div style="display:flex;gap:8px"><input name="_comment" placeholder="Ajouter un commentaire…"><button class="btn small" data-a="comment">OK</button></div></div>
          <div class="log">${(task.log || []).slice().reverse().map(l => `<div><b>${fmtDateTime(l.t)}</b> — ${esc(l.msg)}</div>`).join('')}</div>
        </div></div>
        <datalist id="dl-team">${team.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        <datalist id="dl-cat">${CATEGORIES.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;

      $('[data-a=back]', el).onclick = async () => { unBack(); await flush(); done(); };
      $$('input[name]:not([name=_comment]), textarea[name]', el).forEach(i => i.oninput = () => { task[i.name] = i.value; save(); });
      $$('[data-st]', el).forEach(b => b.onclick = (e) => {
        e.preventDefault(); if (task.status === b.dataset.st) return;
        log(`Statut : ${STATUS[task.status].label} → ${STATUS[b.dataset.st].label}`); task.status = b.dataset.st; save(); render();
      });
      $$('[data-pr]', el).forEach(b => b.onclick = (e) => { e.preventDefault(); task.priority = +b.dataset.pr; save(); render(); });
      $('[data-a=addphoto]', el).onclick = async (e) => {
        e.preventDefault();
        const recs = await addPhotos(pid, { source: `Tâche #${task.num}` });
        if (recs.length) { task.photoIds.push(...recs.map(r => r.id)); log(`${recs.length} photo(s) ajoutée(s)`); await DB.put('tasks', task); render(); }
      };
      $$('.thumbs .t[data-id]', el).forEach(t => t.onclick = async (e) => {
        const id = t.dataset.id;
        if (e.target.closest('[data-del]')) {
          e.preventDefault();
          if (await confirmBox('Supprimer cette photo ?')) { task.photoIds = task.photoIds.filter(x => x !== id); await DB.del('files', id); await DB.put('tasks', task); render(); }
          return;
        }
        const f = photos.find(p => p.id === id); showImage(BlobURL.get(f.id, f.blob), `Tâche #${task.num}`);
      });
      $('[data-a=comment]', el).onclick = (e) => {
        e.preventDefault(); const i = $('[name=_comment]', el);
        if (i.value.trim()) { log('💬 ' + i.value.trim()); save(); render(); }
      };
      const pb = $('[data-a=plan]', el);
      if (pb) pb.onclick = async (e) => { e.preventDefault(); await flush(); openPlanViewer(await DB.get('plans', plan.id), planCtx(() => {})); };
      $('[data-a=share]', el).onclick = () => shareWhatsApp(
        `*${project.name}*\nTâche #${task.num} : ${task.title}\nStatut : ${STATUS[task.status].label} · Priorité ${task.priority}\n` +
        (task.assignee ? `Responsable : ${task.assignee}\n` : '') + (task.due ? `Échéance : ${fmtDate(task.due)}\n` : '') +
        (plan ? `Plan : ${plan.name}\n` : '') + (task.description ? `\n${task.description}` : ''));
      $('[data-a=more]', el).onclick = async () => {
        const v = await menu(`Tâche #${task.num}`, [{ label: 'Supprimer la tâche', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'del' && await confirmBox('Supprimer cette tâche ?')) {
          clearTimeout(saveT);
          for (const id of task.photoIds) await DB.del('files', id);
          await DB.del('tasks', task.id); unBack(); done();
        }
      };
      if (!task.title) setTimeout(() => $('[name=title]', el)?.focus(), 200);
    }
    render();
  });
}

// ---------- Photos ----------
async function renderPhotos(root) {
  const pid = App.project.id;
  const files = (await DB.byProject('files', pid)).filter(f => f.role === 'photo').sort((a, b) => b.createdAt - a.createdAt);
  root.innerHTML = `<div class="pagehead"><h2>Photos</h2><p>${files.length} photo(s)</p></div>
    ${files.length ? `<div class="photo-grid">${files.map(f => `<div class="ph" data-id="${f.id}"><img src="${BlobURL.get(f.id, f.blob)}" loading="lazy">${f.source ? `<span class="tag">${esc(f.source)}</span>` : ''}</div>`).join('')}</div>`
    : `<div class="empty">Aucune photo.<br>Prenez des photos du chantier avec <b>+</b>.</div>`}`;
  $$('.ph', root).forEach(p => p.onclick = () => { const f = files.find(x => x.id === p.dataset.id); showImage(BlobURL.get(f.id, f.blob), `${f.source || 'Photo'} · ${fmtDateTime(f.createdAt)}`); });
  fab(root, async () => { const r = await addPhotos(pid); if (r.length) { toast(`${r.length} photo(s) ajoutée(s)`); renderPhotos(root); } });
}

// ---------- Formulaires (contrôle qualité) ----------
function formStats(f) {
  const n = f.items.length, ok = f.items.filter(i => i.res === 'ok').length, nok = f.items.filter(i => i.res === 'nok').length, na = f.items.filter(i => i.res === 'na').length;
  const answered = ok + nok + na;
  const status = n && answered === n ? (nok ? 'Non conforme' : 'Conforme') : 'En cours';
  return { n, ok, nok, na, answered, status, color: status === 'Conforme' ? 'var(--green)' : status === 'Non conforme' ? 'var(--red)' : 'var(--orange)' };
}
async function renderForms(root) {
  const forms = (await DB.byProject('forms', App.project.id)).sort((a, b) => b.createdAt - a.createdAt);
  root.innerHTML = `<div class="pagehead"><h2>Formulaires</h2><p>Fiches de contrôle qualité</p></div>
    ${forms.length ? `<div class="list">${forms.map(f => { const s = formStats(f); return `
      <div class="row" data-id="${f.id}"><span style="color:${s.color}">${icon('form')}</span>
        <div class="grow"><div class="title">${esc(f.title)}${f.location ? ' — ' + esc(f.location) : ''}</div>
        <div class="sub"><span style="color:${s.color}">${s.status}</span> · ${s.answered}/${s.n} · ${fmtDate(f.date)}</div>
        <div class="progress"><div style="width:${s.n ? s.answered / s.n * 100 : 0}%;background:${s.color}"></div></div></div></div>`; }).join('')}</div>`
    : `<div class="empty">Aucun formulaire.<br>Appuyez sur <b>+</b> pour une fiche de réception (ferraillage, coffrage, bétonnage…).</div>`}`;
  $$('.row[data-id]', root).forEach(r => r.onclick = async () => { await openFormDetail(forms.find(f => f.id === r.dataset.id)); renderForms(root); });
  fab(root, async () => {
    const tid = await menu('Nouveau formulaire', FORM_TEMPLATES.map(t => ({ label: t.title, icon: 'form', value: t.id })));
    if (!tid) return;
    const t = FORM_TEMPLATES.find(x => x.id === tid);
    const f = await DB.put('forms', { projectId: App.project.id, templateId: t.id, title: t.title, location: '', date: todayISO(), inspector: '', notes: '',
      items: t.items.map(label => ({ label, res: null, comment: '' })), photoIds: [] });
    await openFormDetail(f); renderForms(root);
  });
}

function openFormDetail(form) {
  return new Promise(async (resolve) => {
    const project = await DB.get('projects', form.projectId);
    const el = document.createElement('div'); el.className = 'fullpage'; document.body.appendChild(el);
    let saveT; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => DB.put('forms', form), 400); };
    const finish = async () => { clearTimeout(saveT); await DB.put('forms', form); el.remove(); resolve(); };
    const unBack = pushBack(finish);
    if (!form.photoIds) form.photoIds = [];

    async function render() {
      const s = formStats(form);
      const photos = await loadFiles(form.photoIds);
      el.innerHTML = `
        <div class="topbar"><button class="iconbtn" data-a="back">${icon('back')}</button><h1>${esc(form.title)}</h1>
          <button class="iconbtn" data-a="share">${icon('share')}</button><button class="iconbtn" data-a="more">${icon('more')}</button></div>
        <div class="content"><div class="form" style="padding-top:16px">
          <div style="color:${s.color};font-weight:600">${s.status} · ✔ ${s.ok} · ✘ ${s.nok} · N/A ${s.na}</div>
          <label>Localisation (ouvrage / axe / niveau)<input name="location" value="${esc(form.location)}" placeholder="Ex : Poteaux SSL axes C10–C15"></label>
          <div class="kv"><label>Date<input name="date" type="date" value="${esc(form.date)}"></label>
          <label>Contrôlé par<input name="inspector" value="${esc(form.inspector)}"></label></div>
          <div>${form.items.map((it, i) => `<div class="check-item" data-i="${i}"><div class="lbl">${i + 1}. ${esc(it.label)}</div>
            <div class="seg seg3">${[['ok', 'Conforme'], ['nok', 'Non conf.'], ['na', 'N/A']].map(([k, l]) => `<button data-r="${k}" class="${it.res === k ? 'on ' + k : ''}">${l}</button>`).join('')}</div>
            ${it.res === 'nok' || it.comment ? `<input data-c value="${esc(it.comment)}" placeholder="Commentaire / réserve">` : ''}</div>`).join('')}</div>
          <button class="btn ghost" data-a="additem">${icon('plus')} Ajouter un point de contrôle</button>
          <label>Observations<textarea name="notes">${esc(form.notes)}</textarea></label>
          <label>Photos</label>${thumbsHTML(photos)}
        </div></div>`;
      $('[data-a=back]', el).onclick = () => { unBack(); finish(); };
      $$('input[name], textarea[name]', el).forEach(i => i.oninput = () => { form[i.name] = i.value; save(); });
      $$('.check-item', el).forEach(ci => {
        const it = form.items[+ci.dataset.i];
        $$('[data-r]', ci).forEach(b => b.onclick = () => { it.res = it.res === b.dataset.r ? null : b.dataset.r; save(); render(); });
        const c = $('[data-c]', ci); if (c) c.oninput = () => { it.comment = c.value; save(); };
      });
      $('[data-a=additem]', el).onclick = async () => {
        const r = await formSheet('Point de contrôle', [{ name: 'label', label: 'Libellé' }], { okLabel: 'Ajouter' });
        if (r && r.label) { form.items.push({ label: r.label, res: null, comment: '' }); save(); render(); }
      };
      $('[data-a=addphoto]', el).onclick = async () => {
        const recs = await addPhotos(form.projectId, { source: form.title });
        if (recs.length) { form.photoIds.push(...recs.map(r => r.id)); save(); render(); }
      };
      $$('.thumbs .t[data-id]', el).forEach(t => t.onclick = async (e) => {
        const id = t.dataset.id;
        if (e.target.closest('[data-del]')) { if (await confirmBox('Supprimer cette photo ?')) { form.photoIds = form.photoIds.filter(x => x !== id); await DB.del('files', id); save(); render(); } return; }
        const f = photos.find(p => p.id === id); showImage(BlobURL.get(f.id, f.blob), form.title);
      });
      $('[data-a=share]', el).onclick = () => {
        const mark = { ok: '✅', nok: '❌', na: '➖' };
        shareWhatsApp(`*${project.name}*\n*${form.title}*${form.location ? ' — ' + form.location : ''}\nDate : ${fmtDate(form.date)}${form.inspector ? ' · ' + form.inspector : ''}\nRésultat : *${s.status}*\n\n` +
          form.items.map((it, i) => `${mark[it.res] || '⬜'} ${i + 1}. ${it.label}${it.comment ? ' — ' + it.comment : ''}`).join('\n') +
          (form.notes ? `\n\nObservations : ${form.notes}` : ''));
      };
      $('[data-a=more]', el).onclick = async () => {
        const v = await menu(form.title, [{ label: 'Supprimer le formulaire', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'del' && await confirmBox('Supprimer ce formulaire ?')) {
          clearTimeout(saveT); for (const id of form.photoIds) await DB.del('files', id);
          await DB.del('forms', form.id); unBack(); el.remove(); resolve();
        }
      };
    }
    render();
  });
}

// ---------- Rapports journaliers ----------
async function renderReports(root) {
  const reports = (await DB.byProject('reports', App.project.id)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  root.innerHTML = `<div class="pagehead"><h2>Rapports journaliers</h2><p>Suivi quotidien du chantier</p></div>
    ${reports.length ? `<div class="list">${reports.map(r => `
      <div class="row" data-id="${r.id}"><span class="icon-muted">${icon('calendar')}</span>
        <div class="grow"><div class="title">${fmtDate(r.date)}</div>
        <div class="sub">${[r.weather, r.workers && `${r.workers} ouvriers`, (r.works || '').split('\n')[0]].filter(Boolean).map(esc).join(' · ')}</div></div></div>`).join('')}</div>`
    : `<div class="empty">Aucun rapport.<br>Appuyez sur <b>+</b> pour le rapport d'aujourd'hui.</div>`}`;
  $$('.row[data-id]', root).forEach(r => r.onclick = async () => { await openReportDetail(reports.find(x => x.id === r.dataset.id)); renderReports(root); });
  fab(root, async () => {
    const r = await DB.put('reports', { projectId: App.project.id, date: todayISO(), weather: 'Ensoleillé', temp: '', workers: '', equipment: '', works: '', deliveries: '', issues: '', photoIds: [] });
    await openReportDetail(r); renderReports(root);
  });
}

function openReportDetail(rep) {
  return new Promise(async (resolve) => {
    const project = await DB.get('projects', rep.projectId);
    const el = document.createElement('div'); el.className = 'fullpage'; document.body.appendChild(el);
    let saveT; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => DB.put('reports', rep), 400); };
    const finish = async () => { clearTimeout(saveT); await DB.put('reports', rep); el.remove(); resolve(); };
    const unBack = pushBack(finish);
    async function render() {
      const photos = await loadFiles(rep.photoIds);
      el.innerHTML = `
        <div class="topbar"><button class="iconbtn" data-a="back">${icon('back')}</button><h1>Rapport du ${fmtDate(rep.date)}</h1>
          <button class="iconbtn" data-a="share">${icon('share')}</button><button class="iconbtn" data-a="more">${icon('more')}</button></div>
        <div class="content"><div class="form" style="padding-top:16px">
          <div class="kv"><label>Date<input name="date" type="date" value="${esc(rep.date)}"></label>
            <label>Météo<select name="weather">${WEATHER.map(w => `<option ${w === rep.weather ? 'selected' : ''}>${w}</option>`).join('')}</select></label></div>
          <div class="kv"><label>Effectif (ouvriers)<input name="workers" type="number" inputmode="numeric" value="${esc(rep.workers)}"></label>
            <label>Température (°C)<input name="temp" type="number" inputmode="numeric" value="${esc(rep.temp)}"></label></div>
          <label>Engins / matériel<input name="equipment" value="${esc(rep.equipment)}" placeholder="Grue, pompe à béton…"></label>
          <label>Travaux réalisés<textarea name="works" placeholder="- Coulage poteaux SSL axes C10–C15&#10;- Ferraillage voiles V3">${esc(rep.works)}</textarea></label>
          <label>Livraisons<textarea name="deliveries" style="min-height:60px" placeholder="Béton 24 m³, acier HA12…">${esc(rep.deliveries)}</textarea></label>
          <label>Problèmes / observations<textarea name="issues" style="min-height:60px">${esc(rep.issues)}</textarea></label>
          <label>Photos</label>${thumbsHTML(photos)}
        </div></div>`;
      $('[data-a=back]', el).onclick = () => { unBack(); finish(); };
      $$('[name]', el).forEach(i => i.oninput = i.onchange = () => { rep[i.name] = i.value; save(); if (i.name === 'date') $('h1', el).textContent = 'Rapport du ' + fmtDate(rep.date); });
      $('[data-a=addphoto]', el).onclick = async () => {
        const recs = await addPhotos(rep.projectId, { source: 'Rapport ' + fmtDate(rep.date) });
        if (recs.length) { rep.photoIds.push(...recs.map(r => r.id)); save(); render(); }
      };
      $$('.thumbs .t[data-id]', el).forEach(t => t.onclick = async (e) => {
        const id = t.dataset.id;
        if (e.target.closest('[data-del]')) { if (await confirmBox('Supprimer cette photo ?')) { rep.photoIds = rep.photoIds.filter(x => x !== id); await DB.del('files', id); save(); render(); } return; }
        const f = photos.find(p => p.id === id); showImage(BlobURL.get(f.id, f.blob), 'Rapport');
      });
      $('[data-a=share]', el).onclick = () => shareWhatsApp(
        `*${project.name}*\n*Rapport journalier du ${fmtDate(rep.date)}*\nMétéo : ${rep.weather}${rep.temp ? ` (${rep.temp}°C)` : ''}\n` +
        (rep.workers ? `Effectif : ${rep.workers} ouvriers\n` : '') + (rep.equipment ? `Engins : ${rep.equipment}\n` : '') +
        (rep.works ? `\n*Travaux réalisés :*\n${rep.works}\n` : '') + (rep.deliveries ? `\n*Livraisons :*\n${rep.deliveries}\n` : '') +
        (rep.issues ? `\n*Problèmes :*\n${rep.issues}` : ''));
      $('[data-a=more]', el).onclick = async () => {
        const v = await menu('Rapport', [{ label: 'Supprimer le rapport', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'del' && await confirmBox('Supprimer ce rapport ?')) {
          clearTimeout(saveT); for (const id of rep.photoIds) await DB.del('files', id);
          await DB.del('reports', rep.id); unBack(); el.remove(); resolve();
        }
      };
    }
    render();
  });
}

// ---------- Équipe ----------
async function renderTeam(root) {
  const p = App.project; p.team = p.team || [];
  root.innerHTML = `<div class="pagehead"><h2>Équipe</h2><p>Intervenants du chantier</p></div>
    ${p.team.length ? `<div class="list">${p.team.map((m, i) => `
      <div class="row" data-i="${i}"><span class="tasknum" style="background:var(--accent)">${esc((m.name || '?')[0].toUpperCase())}</span>
        <div class="grow"><div class="title">${esc(m.name)}</div><div class="sub">${[m.role, m.phone].filter(Boolean).map(esc).join(' · ')}</div></div></div>`).join('')}</div>`
    : `<div class="empty">Ajoutez les intervenants (chef de chantier, ferrailleur, sous-traitants…) pour les assigner aux tâches.</div>`}`;
  const edit = async (m, i) => {
    const r = await formSheet(m ? 'Modifier' : 'Nouveau membre', [
      { name: 'name', label: 'Nom', value: m?.name }, { name: 'role', label: 'Fonction / entreprise', value: m?.role }, { name: 'phone', label: 'Téléphone', type: 'tel', value: m?.phone },
    ], { danger: m ? 'Retirer de l\'équipe' : null });
    if (!r) return;
    if (r.__danger) p.team.splice(i, 1);
    else if (r.name) { if (m) p.team[i] = r; else p.team.push(r); }
    await DB.put('projects', p); renderTeam(root);
  };
  $$('.row[data-i]', root).forEach(r => r.onclick = () => edit(p.team[+r.dataset.i], +r.dataset.i));
  fab(root, () => edit(null));
}

// ---------- Paramètres ----------
async function renderSettings(root) {
  const p = App.project;
  root.innerHTML = `<div class="pagehead"><h2>Paramètres</h2></div>
    <div class="form" style="padding-top:12px">
      <label>Nom du projet<input name="name" value="${esc(p.name)}"></label>
      <label>Adresse / ville<input name="address" value="${esc(p.address)}"></label>
      <button class="btn" data-a="save">Enregistrer</button>
      <div style="height:12px"></div>
      <div class="card" style="margin:0;padding:16px">
        <div style="font-weight:600;margin-bottom:6px">Sauvegarde</div>
        <div style="color:var(--muted);font-size:14px;line-height:1.5;margin-bottom:12px">Crée un fichier <b>.chantier</b> avec tout le projet (plans, pins, tâches, photos, formulaires, rapports). Enregistrez-le dans Google Drive ou envoyez-le sur WhatsApp. Pour le récupérer : accueil → ⋮ → Restaurer une sauvegarde.</div>
        <button class="btn" data-a="backup" style="width:100%">${icon('share')} Sauvegarder ce projet</button>
      </div>
      <div style="height:20px"></div>
      <button class="btn danger" data-a="del">${icon('trash')} Supprimer le projet</button>
      <p style="color:var(--muted);font-size:13px;line-height:1.5">Les données sont enregistrées sur ce téléphone uniquement (fonctionne sans internet). Si vous désinstallez l'application, les données seront perdues : faites une sauvegarde régulièrement.<br>Version ${APP_VERSION.startsWith('__') ? 'dev' : APP_VERSION}</p>
    </div>`;
  $('[data-a=save]', root).onclick = async () => { p.name = $('[name=name]', root).value.trim() || p.name; p.address = $('[name=address]', root).value.trim(); await DB.put('projects', p); toast('Enregistré ✓'); renderSection(); };
  $('[data-a=backup]', root).onclick = async () => {
    const ld = loading('Préparation de la sauvegarde…');
    try {
      await Backup.exportProject(p.id, (i, n) => ld.set(`Sauvegarde… ${i}/${n}`));
      p.lastBackup = Date.now(); await DB.put('projects', p);
    } catch (e) { console.error(e); alertBox('Erreur de sauvegarde : ' + (e.message || e)); }
    finally { ld.close(); }
  };
  $('[data-a=del]', root).onclick = async () => {
    if (await confirmBox(`Supprimer « ${p.name} » et toutes ses données ?`)) { await DB.deleteProject(p.id); renderHome(); }
  };
}

// ---------- Restauration ----------
async function restoreBackup() {
  const files = await pickFiles({ accept: '*/*', multiple: false });
  if (!files.length) return;
  const ld = loading('Restauration…');
  try {
    const p = await Backup.importFile(files[0], (n) => ld.set(`Restauration… ${n} éléments`));
    ld.close();
    if (p) { toast('Projet restauré ✓'); openProject(await DB.get('projects', p.id)); }
  } catch (e) {
    ld.close(); console.error(e); alertBox('Restauration impossible : ' + (e.message || e));
  }
}

// ---------- Démarrage ----------
(function init() {
  // Bouton retour Android
  const capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (capApp) capApp.addListener('backButton', () => { if (!goBack()) capApp.exitApp(); });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  renderHome();
})();
