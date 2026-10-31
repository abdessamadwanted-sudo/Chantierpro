// ================= Espaces par service : chaque poste voit ses outils (topo, centrale, matériel, pointage, HSE, rendement…) =================
// Tous les éléments sont dans le magasin « items » (un type = kind), synchronisés par projet et protégés par module.
const BETON_CLASSES = ['B20', 'B25', 'B30', 'B35', 'B40', 'B45', 'Béton de propreté', 'Gros béton', 'Autre'];
const RDT_TASKS = [['Coffrage', 'm²'], ['Ferraillage', 'kg'], ['Bétonnage', 'm³'], ['Maçonnerie', 'm²'], ['Enduit', 'm²'], ['Décoffrage', 'm²'], ['Étanchéité', 'm²'], ['Terrassement', 'm³'], ['Autre', 'u']];
const MAT_CATS = ['Coffrage', 'Étaiement', 'Échafaudage', 'Engin', 'Outillage', 'Sécurité', 'Autre'];
const nowHM = () => new Date().toTimeString().slice(0, 5);

// statuts : [clé, libellé, couleur, services autorisés à mettre ce statut (vide = tous ceux qui peuvent modifier)]
const ES_KINDS = {
  impl: { mod: 'topo', l: "Demandes d'implantation", one: "Demande d'implantation", ic: 'pin',
    f: [['ouvrage', 'Ouvrage / élément', 'text', 'Ex : Voile V12'], ['zone', 'Zone', 'text'], ['niveau', 'Niveau', 'text', 'Ex : R+3'], ['axes', 'Axes / repères', 'text', 'Ex : axes C-D / 4-6'],
      ['date', 'Pour le', 'date'], ['heure', 'Heure souhaitée', 'time'], ['resp', 'Demandeur', 'member'], ['topo', 'Topographe', 'member'], ['note', 'Remarque', 'textarea']],
    st: [['demandee', 'Demandée', '#f59e0b'], ['planifiee', 'Planifiée', '#3b82f6', ['topo', 'direction']], ['implantee', 'Implantée', '#22c55e', ['topo', 'direction']], ['verifiee', 'Vérifiée', '#15803d'], ['refusee', 'Refusée', '#ef4444', ['topo', 'direction']]],
    t: r => `${r.ouvrage || 'Implantation'}${r.niveau ? ' · ' + r.niveau : ''}`, s: r => [r.zone && 'Zone ' + r.zone, r.axes, r.date && fmtDate(r.date) + (r.heure ? ' ' + r.heure : '')].filter(Boolean).join(' · ') },
  leve: { mod: 'topo', l: 'Levés & récolements', one: 'Levé', ic: 'ruler',
    f: [['objet', 'Objet', 'text', 'Ex : Récolement voiles R+2'], ['type', 'Type', 'select', ['Implantation', 'Levé', 'Récolement', 'Contrôle', 'Nivellement']], ['date', 'Date', 'date'],
      ['ecart', 'Écart max (mm)', 'num'], ['resp', 'Topographe', 'member'], ['note', 'Observations', 'textarea']],
    st: [['encours', 'En cours', '#3b82f6'], ['conforme', 'Conforme', '#22c55e'], ['nonconforme', 'Non conforme', '#ef4444']],
    t: r => r.objet || r.type || 'Levé', s: r => [r.type, r.date && fmtDate(r.date), r.ecart != null && r.ecart !== '' && `écart ${r.ecart} mm`].filter(Boolean).join(' · ') },
  cmd: { mod: 'centrale', l: 'Commandes béton', one: 'Commande béton', ic: 'calendar',
    f: [['date', 'Date', 'date'], ['heure', 'Heure', 'time'], ['ouvrage', 'Ouvrage', 'text', 'Ex : Dalle R+4 zone 11'], ['classe', 'Classe béton', 'select', BETON_CLASSES],
      ['vol', 'Volume (m³)', 'num'], ['mise', 'Mise en place', 'select', ['Pompe', 'Benne / grue', 'Goulotte', 'Direct']], ['resp', 'Demandeur', 'member'], ['note', 'Remarque', 'textarea']],
    st: [['demandee', 'Demandée', '#f59e0b'], ['acceptee', 'Acceptée', '#3b82f6', ['centrale', 'direction']], ['production', 'En production', '#8b5cf6', ['centrale', 'direction']], ['livree', 'Livrée', '#22c55e', ['centrale', 'direction']], ['annulee', 'Annulée', '#ef4444']],
    t: r => `${r.ouvrage || 'Commande'} · ${r.vol || '?'} m³ ${r.classe || ''}`, s: r => [r.date && fmtDate(r.date), r.heure, r.mise].filter(Boolean).join(' · ') },
  bl: { mod: 'centrale', l: 'Bons de livraison (toupies)', one: 'Bon de livraison', ic: 'file',
    f: [['cmd', 'Commande', 'cmd'], ['num', 'N° BL', 'text'], ['toupie', 'Toupie (matricule)', 'text'], ['chauffeur', 'Chauffeur', 'text'], ['vol', 'Volume (m³)', 'num'],
      ['depart', 'Départ centrale', 'time'], ['arrivee', 'Arrivée chantier', 'time'], ['fin', 'Fin déchargement', 'time'], ['slump', 'Slump (cm)', 'num'], ['eprouv', 'Éprouvettes', 'num'], ['note', 'Remarque', 'textarea']],
    st: [['route', 'En route', '#3b82f6'], ['decharge', 'Déchargée', '#22c55e'], ['refusee', 'Refusée', '#ef4444']],
    t: r => `BL ${r.num || ''} · ${r.vol || '?'} m³`, s: r => [r.toupie, r.depart && 'départ ' + r.depart, r.slump && 'slump ' + r.slump].filter(Boolean).join(' · ') },
  mat: { mod: 'materiel', l: 'Matériel (parc et affectations)', one: 'Matériel', ic: 'cube',
    f: [['nom', 'Désignation', 'text', 'Ex : Banche 2,70 m / Étai 3 m / Grue GT…'], ['cat', 'Catégorie', 'select', MAT_CATS], ['qte', 'Quantité totale', 'num'], ['unite', 'Unité', 'text', 'u, m², ml…'], ['etat', 'État', 'select', ['Bon', 'À réparer', 'Hors service']], ['note', 'Remarque', 'textarea']],
    st: [], t: r => `${r.nom || 'Matériel'}`, s: r => { const a = matAlloc(r); return `${r.cat || ''} · ${r.qte || 0} ${r.unite || 'u'} · au parc ${a.parc}${a.out ? ` · affecté ${a.out}` : ''}`; } },
  stock: { mod: 'materiel', l: 'Stock consommables', one: 'Article', ic: 'layers',
    f: [['nom', 'Article', 'text', 'Ex : Huile de décoffrage, fil à ligaturer, ciment…'], ['unite', 'Unité', 'text', 'l, kg, sac…'], ['qte', 'Quantité en stock', 'num'], ['seuil', "Seuil d'alerte", 'num']],
    st: [], t: r => r.nom || 'Article', s: r => `${r.qte || 0} ${r.unite || ''}${+r.qte <= +r.seuil ? ' · ⚠ stock bas' : ''}` },
  pt: { mod: 'pointage', l: 'Pointage des équipes', one: 'Feuille de pointage', ic: 'team',
    f: [['date', 'Date', 'date'], ['resp', "Chef d'équipe / chantier", 'member'], ['equipe', 'Équipe', 'text', 'Ex : Coffreurs zone 11'], ['note', 'Remarque', 'textarea']],
    st: [], t: r => `${r.equipe || 'Équipe'} · ${fmtDate(r.date)}`, s: r => { const L = r.lines || []; return `${L.filter(x => x.p).length} présent(s) / ${L.length} · ${L.filter(x => x.p).reduce((a, x) => a + (+x.h || 0), 0)} h`; } },
  hse: { mod: 'hse', l: 'HSE : inspections, incidents, causeries', one: 'Fiche HSE', ic: 'report',
    f: [['type', 'Type', 'select', ['Inspection', 'Incident', 'Presque-accident', 'Causerie sécurité', 'Non-conformité HSE', 'Permis de travail']], ['date', 'Date', 'date'], ['lieu', 'Lieu / zone', 'text'],
      ['desc', 'Description', 'textarea'], ['grav', 'Gravité', 'select', ['Faible', 'Moyenne', 'Grave']], ['actions', 'Actions / mesures', 'textarea'], ['resp', 'Responsable', 'member']],
    st: [['ouvert', 'Ouvert', '#f59e0b'], ['encours', 'En cours', '#3b82f6'], ['clos', 'Clos', '#22c55e', ['hse', 'direction']]],
    t: r => `${r.type || 'HSE'}${r.lieu ? ' · ' + r.lieu : ''}`, s: r => [r.date && fmtDate(r.date), r.grav, (r.desc || '').slice(0, 50)].filter(Boolean).join(' · ') },
  rdt: { mod: 'rapports', l: 'Rendement journalier', one: 'Rendement', ic: 'ruler',
    f: [['date', 'Date', 'date'], ['tache', 'Tâche', 'select', RDT_TASKS.map(x => x[0])], ['qte', 'Quantité réalisée', 'num'], ['eff', 'Effectif (ouvriers)', 'num'], ['h', 'Heures / ouvrier', 'num'], ['ouvrage', 'Ouvrage / zone', 'text'], ['resp', 'Équipe de', 'member']],
    st: [], t: r => `${r.tache || 'Tâche'} · ${r.qte || 0} ${rdtUnit(r)}`, s: r => `${fmtDate(r.date)} · ${r.eff || 0} ouvr. · ${nf(rdtVal(r), 2)} ${rdtUnit(r)}/h·homme${r.ouvrage ? ' · ' + r.ouvrage : ''}` },
};
const nf = (n, d = 1) => (isFinite(n) ? n : 0).toLocaleString('fr-FR', { maximumFractionDigits: d });
const rdtUnit = (r) => (RDT_TASKS.find(x => x[0] === r.tache) || [, 'u'])[1];
const rdtVal = (r) => (+r.qte || 0) / Math.max(1, (+r.eff || 1) * (+r.h || 8));
function matAlloc(r) { const out = Object.values(r.alloc || {}).reduce((a, q) => a + (+q || 0), 0); return { out, parc: (+r.qte || 0) - out - (+r.lost || 0) }; }

// outils mis en avant selon le service
const SERVICE_TOOLS = {
  direction: ['board', 'cmd', 'impl', 'mat', 'pt', 'rdt', 'hse', 'stock', 'leve', 'bl'], travaux: ['board', 'pt', 'rdt', 'impl', 'cmd', 'mat', 'stock', 'hse'],
  ferraillage: ['board', 'pt', 'rdt', 'impl', 'mat', 'stock'], centrale: ['cmd', 'bl', 'stock', 'pt'], materiel: ['mat', 'stock', 'pt'],
  topo: ['impl', 'leve'], qualite: ['impl', 'leve', 'bl', 'hse'], hse: ['hse', 'pt'], metre: ['rdt', 'board', 'leve'], bim: ['impl'], logistique: ['pt', 'stock', 'mat'], externe: ['board', 'hse'],
};
const TOOL_LBL = { board: ['Tableau de bord des équipes', 'layers', 'Effectifs, rendement, matériel par conducteur'] };
const esLvl = (k) => k === 'board' ? Math.max(Team.lvl('pointage'), Team.lvl('rapports')) : Team.lvl(ES_KINDS[k].mod);
const myService = () => (Team.me() || {}).service || tmRoleOf((Team.me() || {}).role).s;

// ---------- bloc « Mon espace » sur l'accueil ----------
function espaceHome() {
  if (!Team.ready()) return '';
  const svc = myService(), main = (SERVICE_TOOLS[svc] || ['board']).filter(k => esLvl(k) >= 1);
  const others = Object.keys(ES_KINDS).filter(k => !main.includes(k) && esLvl(k) >= 1);
  if (!main.length && !others.length) return '';
  const tile = (k) => { const [l, ic] = k === 'board' ? TOOL_LBL.board : [ES_KINDS[k].l, ES_KINDS[k].ic]; return `<button class="es-tile" data-es="${k}" style="--c:${serviceOf(svc).c}">${icon(ic)}<span>${esc(l)}</span><i data-esn="${k}"></i></button>`; };
  return `<div class="es-wrap"><div class="h2-sec"><span>Espace ${esc(serviceOf(svc).l)}</span><small>${esc(tmRoleOf((Team.me() || {}).role).l)}</small></div>
    <div class="es-grid">${main.map(tile).join('')}</div>
    ${others.length ? `<details class="es-more"><summary>Autres outils (${others.length})</summary><div class="es-grid">${others.map(tile).join('')}</div></details>` : ''}</div>`;
}
async function espaceBind(root) {
  $$('[data-es]', root).forEach(b => b.onclick = () => b.dataset.es === 'board' ? openBoardEquipes() : openKind(b.dataset.es));
  // compteurs « à traiter » selon le service
  const items = await DB.all('items'), svc = myService(), me = Team.uid();
  const todo = { impl: x => x.kind === 'impl' && (svc === 'topo' ? ['demandee', 'planifiee'].includes(x.status) : x.status === 'implantee' && x.resp === me),
    cmd: x => x.kind === 'cmd' && (svc === 'centrale' ? ['demandee', 'acceptee', 'production'].includes(x.status) : false),
    stock: x => x.kind === 'stock' && +x.qte <= +x.seuil, hse: x => x.kind === 'hse' && x.status !== 'clos' };
  Object.entries(todo).forEach(([k, f]) => { const n = items.filter(x => Team.canProject(x.projectId) && f(x)).length; const el = $(`[data-esn=${k}]`, root); if (el && n) { el.textContent = n; el.classList.add('on'); } });
}

// ---------- liste d'un type ----------
async function pickProjectId() {
  const projects = (await DB.all('projects')).filter(p => Team.canProject(p.id)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return projects;
}
async function openKind(kind, opts = {}) {
  const K = ES_KINDS[kind], L = esLvl(kind), svc = myService();
  const el = document.createElement('div'); el.className = 'fullpage es-page'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  let pid = opts.pid || localStorage.getItem('es.pid') || '', filt = 'all', q = '';
  const draw = async () => {
    const projects = await pickProjectId();
    if (!projects.find(p => p.id === pid)) pid = (projects[0] || {}).id || '';
    const all = (await DB.byProject('items', pid)).filter(x => x.kind === kind);
    const list = all.filter(x => (filt === 'all' || x.status === filt || (filt === 'mine' && (x.resp === Team.uid() || x.by === Team.uid()))) && (!q || fuzzyHas(K.t(x) + ' ' + K.s(x), q)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:17px">${esc(K.l)}</h1></div>
      <div class="es-bar">${projects.length > 1 ? `<select data-pid>${projects.map(p => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>` : `<b>${esc((projects[0] || {}).name || 'Aucun projet')}</b>`}
        <div class="search">${icon('search')}<input placeholder="Rechercher" value="${esc(q)}"></div></div>
      <div class="es-filt"><button data-f="all" class="${filt === 'all' ? 'on' : ''}">Tout (${all.length})</button><button data-f="mine" class="${filt === 'mine' ? 'on' : ''}">Les miens</button>
        ${K.st.map(([k, l, c]) => `<button data-f="${k}" class="${filt === k ? 'on' : ''}" style="--c:${c}">${l} (${all.filter(x => x.status === k).length})</button>`).join('')}</div>
      ${L === 1 ? '<div class="tm-ro">👁 Lecture seule</div>' : ''}
      <div class="es-list">${list.length ? list.map(x => { const S = K.st.find(s => s[0] === x.status);
        return `<button class="es-row" data-id="${x.id}">${S ? `<i class="es-dot" style="background:${S[2]}"></i>` : `<span class="es-ic">${icon(K.ic)}</span>`}<span class="grow"><b>${esc(K.t(x))}</b><small>${esc(K.s(x))}</small>${x.resp ? `<small class="es-who">👤 ${esc(memberName(x.resp))}</small>` : ''}</span>${S ? `<em style="--c:${S[2]}">${S[1]}</em>` : ''}</button>`; }).join('')
        : `<div class="empty">${pid ? 'Rien pour le moment.' + (L >= 2 ? '<br>Touchez <b>+</b> pour ajouter.' : '') : 'Aucun projet accessible.'}</div>`}</div>
      ${kind === 'stock' && list.length ? '' : ''}`;
    $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
    const ps = $('[data-pid]', el); if (ps) ps.onchange = () => { pid = ps.value; localStorage.setItem('es.pid', pid); draw(); };
    $('.search input', el).oninput = (e) => { q = e.target.value; clearTimeout(el._t); el._t = setTimeout(() => { draw().then(() => { const i = $('.search input', el); i.focus(); i.setSelectionRange(q.length, q.length); }); }, 300); };
    $$('[data-f]', el).forEach(b => b.onclick = () => { filt = b.dataset.f; draw(); });
    $$('[data-id]', el).forEach(b => b.onclick = async () => { await openItem(await DB.get('items', b.dataset.id)); draw(); });
    if (L >= 2 && pid) fab(el, async () => { const x = await editItem(kind, { projectId: pid }); if (x) { await openItem(x); } draw(); });
  };
  draw();
}
const memberName = (uid) => { const m = (Team.members() || []).find(x => x.uid === uid); return m ? (m.name || m.email) : '—'; };

// ---------- formulaire ----------
async function editItem(kind, base) {
  const K = ES_KINDS[kind], isNew = !base.id, me = Team.uid();
  const cmds = K.f.some(f => f[2] === 'cmd') ? (await DB.byProject('items', base.projectId)).filter(x => x.kind === 'cmd' && x.status !== 'annulee') : [];
  const def = { date: todayISO(), heure: nowHM(), resp: me, h: 8, ...base };
  const fields = K.f.map(([n, l, t, opt]) => {
    if (t === 'member') return { name: n, label: l, type: 'select', value: def[n] || '', options: [{ value: '', label: '—' }, ...(Team.members() || []).map(m => ({ value: m.uid, label: `${m.name || m.email} · ${tmRoleOf(m.role).l}` }))] };
    if (t === 'select') return { name: n, label: l, type: 'select', value: def[n] || opt[0], options: opt };
    if (t === 'cmd') return { name: n, label: l, type: 'select', value: def[n] || '', options: [{ value: '', label: '—' }, ...cmds.map(c => ({ value: c.id, label: ES_KINDS.cmd.t(c) + ' · ' + fmtDate(c.date) }))] };
    return { name: n, label: l, type: t === 'num' ? 'number' : t, value: def[n] ?? '', placeholder: opt || '' };
  });
  const r = await formSheet(isNew ? K.one : 'Modifier', fields, { okLabel: isNew ? 'Ajouter' : 'Enregistrer', danger: isNew ? null : 'Supprimer' });
  if (!r) return null;
  if (r.__danger) { if (await confirmBox('Supprimer définitivement ?')) { await DB.del('items', base.id); toast('Supprimé ✓'); } return null; }
  const x = { ...def, ...r, kind }; K.f.forEach(([n, , t]) => { if (t === 'num') x[n] = r[n] === '' ? '' : num(r[n]); });
  if (isNew) { x.by = me; x.status = K.st.length ? K.st[0][0] : ''; x.hist = [{ at: Date.now(), by: me, st: x.status, txt: 'Créé' }]; if (kind === 'pt') x.lines = await lastLines(base.projectId, x.resp); }
  return DB.put('items', x);
}
async function lastLines(pid, resp) { const prev = (await DB.byProject('items', pid)).filter(x => x.kind === 'pt' && x.resp === resp).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]; return prev ? prev.lines.map(l => ({ ...l, p: true })) : []; }

// ---------- fiche détaillée ----------
async function openItem(x) {
  if (!x) return;
  const K = ES_KINDS[x.kind], L = esLvl(x.kind), svc = myService();
  return new Promise((resolve) => {
    const s = sheet('<div class="es-det"></div>', { title: K.one });
    s.onClose = () => resolve();
    const draw = async () => {
      x = await DB.get('items', x.id); if (!x) return s.close();
      const S = K.st.find(z => z[0] === x.status), photos = [];
      for (const id of x.photoIds || []) { const f = await DB.get('files', id); if (f && f.blob) photos.push({ id, src: BlobURL.get(id, f.blob) }); }
      const canSt = (st) => L >= 2 && (!st[3] || st[3].includes(svc) || Team.isAdmin());
      let extra = '';
      if (x.kind === 'mat') { const a = matAlloc(x); extra = `<div class="es-sub">Répartition</div><div class="es-kv"><span>Au parc</span><b>${a.parc} ${esc(x.unite || 'u')}</b></div>${Object.entries(x.alloc || {}).filter(([, q]) => +q).map(([u, q]) => `<div class="es-kv"><span>👤 ${esc(memberName(u))}</span><b>${q} ${esc(x.unite || 'u')}</b></div>`).join('')}${x.lost ? `<div class="es-kv"><span>Perdu / cassé</span><b style="color:#ef4444">${x.lost}</b></div>` : ''}
        ${L >= 2 ? `<div class="btnrow" style="padding:0"><button class="btn small" data-m="give">Affecter / transférer</button><button class="btn ghost small" data-m="back">Retour au parc</button><button class="btn ghost small" data-m="lost">Perte / casse</button></div>` : ''}
        ${(x.log || []).length ? `<div class="es-sub">Mouvements</div>${x.log.slice(-15).reverse().map(l => `<div class="es-log">${fmtDate(l.at)} · ${esc(l.txt)}</div>`).join('')}` : ''}`; }
      if (x.kind === 'stock') extra = `${L >= 2 ? `<div class="btnrow" style="padding:0"><button class="btn small" data-m="in">+ Entrée</button><button class="btn ghost small" data-m="out">− Sortie</button></div>` : ''}${(x.log || []).length ? `<div class="es-sub">Mouvements</div>${x.log.slice(-15).reverse().map(l => `<div class="es-log">${fmtDate(l.at)} · ${esc(l.txt)}</div>`).join('')}` : ''}`;
      if (x.kind === 'pt') extra = `<div class="es-sub">Ouvriers (${(x.lines || []).filter(l => l.p).length} présents)</div><div class="es-lines">${(x.lines || []).map((l, i) => `<div class="es-line"><button data-pp="${i}" class="${l.p ? 'on' : ''}">${l.p ? 'P' : 'A'}</button><span class="grow">${esc(l.n)}<small>${esc(l.poste || '')}</small></span><input data-ph="${i}" inputmode="decimal" value="${l.h ?? 8}" ${L >= 2 ? '' : 'disabled'}><span>h</span>${L >= 2 ? `<button class="iconbtn sm" data-pd="${i}">${icon('close')}</button>` : ''}</div>`).join('') || '<div class="cr-none">Aucun ouvrier — ajoutez la liste une fois, elle est reprise les jours suivants.</div>'}</div>
        ${L >= 2 ? '<button class="btn ghost small" data-m="addl">+ Ajouter des ouvriers</button>' : ''}`;
      if (x.kind === 'cmd') { const bls = (await DB.byProject('items', x.projectId)).filter(b => b.kind === 'bl' && b.cmd === x.id); const v = bls.reduce((a, b) => a + (+b.vol || 0), 0);
        extra = `<div class="es-sub">Livraisons : ${nf(v)} / ${x.vol || 0} m³ (${bls.length} toupie(s))</div>${bls.map(b => `<div class="es-log">${esc(ES_KINDS.bl.t(b))} · ${esc(ES_KINDS.bl.s(b))}</div>`).join('')}${esLvl('bl') >= 2 && ['centrale', 'direction'].includes(svc) ? '<button class="btn ghost small" data-m="bl">+ Bon de livraison</button>' : ''}`; }
      if (x.kind === 'rdt') extra = `<div class="es-kv"><span>Rendement</span><b style="color:#16a34a">${nf(rdtVal(x), 2)} ${rdtUnit(x)} / h·homme</b></div><div class="es-kv"><span>Par jour et par ouvrier</span><b>${nf(rdtVal(x) * (+x.h || 8), 1)} ${rdtUnit(x)}</b></div>`;
      $('.es-det', s.el).innerHTML = `<div class="es-head"><b>${esc(K.t(x))}</b>${S ? `<em style="--c:${S[2]}">${S[1]}</em>` : ''}</div>
        ${K.f.filter(([n, , t]) => t !== 'cmd' && x[n] !== undefined && x[n] !== '' && x[n] !== null).map(([n, l, t]) => `<div class="es-kv"><span>${esc(l)}</span><b>${esc(t === 'member' ? memberName(x[n]) : t === 'date' ? fmtDate(x[n]) : t === 'cmd' ? '…' : String(x[n]))}</b></div>`).join('')}
        ${extra}
        ${K.st.length ? `<div class="es-sub">Changer l'état</div><div class="es-sts">${K.st.map(st => `<button data-st="${st[0]}" class="${x.status === st[0] ? 'on' : ''}" style="--c:${st[2]}" ${canSt(st) ? '' : 'disabled'}>${st[1]}</button>`).join('')}</div>` : ''}
        ${photos.length ? `<div class="es-ph">${photos.map(p => `<img src="${p.src}" data-ph="${p.id}">`).join('')}</div>` : ''}
        ${(x.hist || []).length ? `<div class="es-sub">Historique</div>${x.hist.slice(-8).reverse().map(h => `<div class="es-log">${fmtDateTime(h.at)} · ${esc(memberName(h.by))} · ${esc(h.txt)}</div>`).join('')}` : ''}
        ${L >= 2 ? `<div class="btnrow" style="padding:0"><button class="btn ghost small" data-m="photo">${icon('camera')} Photo / PV</button><button class="btn ghost small" data-m="edit">${icon('edit')} Modifier</button>${x.kind === 'impl' || x.kind === 'cmd' ? `<button class="btn ghost small" data-m="wa">${icon('share')}</button>` : ''}</div>` : ''}`;
      const E = $('.es-det', s.el);
      $$('[data-st]', E).forEach(b => b.onclick = async () => { const st = K.st.find(z => z[0] === b.dataset.st); x.status = st[0]; x.hist = [...(x.hist || []), { at: Date.now(), by: Team.uid(), st: st[0], txt: st[1] }];
        if (x.kind === 'impl' && st[0] === 'planifiee') { const r = await formSheet('Planifier', [{ name: 'd', label: 'Date prévue', type: 'date', value: x.date || todayISO() }, { name: 'h', label: 'Heure', type: 'time', value: x.heure || '' }]); if (r) { x.date = r.d; x.heure = r.h; x.topo = x.topo || Team.uid(); } }
        await DB.put('items', x); toast(st[1] + ' ✓'); draw(); });
      const on = (k, f) => { const b = $(`[data-m=${k}]`, E); if (b) b.onclick = f; };
      on('edit', async () => { const r = await editItem(x.kind, { ...x }); if (r === null && !(await DB.get('items', x.id))) { s.close(); return; } draw(); });
      on('photo', async () => { const recs = await addPhotos(x.projectId, { source: K.one, role: 'item' }); if (recs.length) { x.photoIds = [...(x.photoIds || []), ...recs.map(r => r.id)]; await DB.put('items', x); draw(); } });
      $$('[data-ph]', E).forEach(img => { if (img.tagName === 'IMG') img.onclick = () => showGallery(photos.map(p => ({ src: p.src })), photos.findIndex(p => p.id === img.dataset.ph)); });
      on('wa', () => { const txt = x.kind === 'impl' ? `*Demande d'implantation*\n📍 ${x.ouvrage || ''}${x.niveau ? ' · ' + x.niveau : ''}${x.zone ? ' · Zone ' + x.zone : ''}\n${x.axes ? 'Axes : ' + x.axes + '\n' : ''}📅 ${fmtDate(x.date)} ${x.heure || ''}\nÉtat : ${(K.st.find(z => z[0] === x.status) || [])[1] || ''}`
        : `*Commande béton*\n🏗️ ${x.ouvrage || ''}\n🧱 ${x.classe || ''} · ${x.vol || '?'} m³ · ${x.mise || ''}\n📅 ${fmtDate(x.date)} ${x.heure || ''}\nÉtat : ${(K.st.find(z => z[0] === x.status) || [])[1] || ''}`;
        openUrl('https://wa.me/?text=' + encodeURIComponent(txt)); });
      // matériel
      const logm = (txt) => { x.log = [...(x.log || []), { at: Date.now(), by: Team.uid(), txt }]; };
      on('give', async () => { const a = matAlloc(x), holders = Object.entries(x.alloc || {}).filter(([, q]) => +q);
        const r = await formSheet('Affecter / transférer', [{ name: 'from', label: 'De', type: 'select', value: '', options: [{ value: '', label: `Parc (${a.parc} dispo)` }, ...holders.map(([u, q]) => ({ value: u, label: `${memberName(u)} (${q})` }))] },
          { name: 'to', label: 'Vers', type: 'select', value: '', options: (Team.members() || []).map(m => ({ value: m.uid, label: `${m.name || m.email} · ${tmRoleOf(m.role).l}` })) }, { name: 'q', label: 'Quantité', type: 'number' }], { okLabel: 'Valider' });
        if (!r || !r.to || !num(r.q)) return; const qn = num(r.q), avail = r.from ? +(x.alloc || {})[r.from] || 0 : a.parc; if (qn > avail) return alertBox(`Quantité disponible : ${avail}`);
        x.alloc = { ...(x.alloc || {}) }; if (r.from) x.alloc[r.from] = (+x.alloc[r.from] || 0) - qn; x.alloc[r.to] = (+x.alloc[r.to] || 0) + qn;
        logm(`${qn} ${x.unite || 'u'} : ${r.from ? memberName(r.from) : 'Parc'} → ${memberName(r.to)}`); await DB.put('items', x); draw(); });
      on('back', async () => { const holders = Object.entries(x.alloc || {}).filter(([, q]) => +q); if (!holders.length) return toast('Rien d\'affecté');
        const r = await formSheet('Retour au parc', [{ name: 'from', label: 'De', type: 'select', options: holders.map(([u, q]) => ({ value: u, label: `${memberName(u)} (${q})` })) }, { name: 'q', label: 'Quantité', type: 'number' }], { okLabel: 'Valider' });
        if (!r || !num(r.q)) return; const qn = Math.min(num(r.q), +x.alloc[r.from] || 0); x.alloc = { ...x.alloc, [r.from]: (+x.alloc[r.from] || 0) - qn }; logm(`${qn} retour parc de ${memberName(r.from)}`); await DB.put('items', x); draw(); });
      on('lost', async () => { const holders = Object.entries(x.alloc || {}).filter(([, q]) => +q);
        const r = await formSheet('Perte / casse', [{ name: 'from', label: 'Chez', type: 'select', options: [{ value: '', label: 'Parc' }, ...holders.map(([u, q]) => ({ value: u, label: `${memberName(u)} (${q})` }))] }, { name: 'q', label: 'Quantité', type: 'number' }, { name: 'n', label: 'Motif' }], { okLabel: 'Valider' });
        if (!r || !num(r.q)) return; const qn = num(r.q); if (r.from) x.alloc = { ...x.alloc, [r.from]: Math.max(0, (+x.alloc[r.from] || 0) - qn) }; x.lost = (+x.lost || 0) + qn; x.qte = (+x.qte || 0);
        logm(`${qn} perdu(s)/cassé(s)${r.from ? ' chez ' + memberName(r.from) : ''}${r.n ? ' — ' + r.n : ''}`); await DB.put('items', x); draw(); });
      // stock
      const mv = async (sign) => { const r = await formSheet(sign > 0 ? 'Entrée en stock' : 'Sortie de stock', [{ name: 'q', label: `Quantité (${x.unite || ''})`, type: 'number' }, { name: 'n', label: sign > 0 ? 'Fournisseur / BL' : 'Pour (équipe, ouvrage…)' }], { okLabel: 'Valider' });
        if (!r || !num(r.q)) return; x.qte = (+x.qte || 0) + sign * num(r.q); logm(`${sign > 0 ? '+' : '−'}${num(r.q)} ${x.unite || ''}${r.n ? ' · ' + r.n : ''}`); await DB.put('items', x); draw(); if (+x.qte <= +x.seuil) toast('⚠ Stock bas'); };
      on('in', () => mv(1)); on('out', () => mv(-1));
      // pointage
      $$('[data-pp]', E).forEach(b => b.onclick = async () => { if (L < 2) return; const l = x.lines[+b.dataset.pp]; l.p = !l.p; await DB.put('items', x); draw(); });
      $$('input[data-ph]', E).forEach(i => i.onchange = async () => { x.lines[+i.dataset.ph].h = num(i.value); await DB.put('items', x); });
      $$('[data-pd]', E).forEach(b => b.onclick = async () => { x.lines.splice(+b.dataset.pd, 1); await DB.put('items', x); draw(); });
      on('addl', async () => { const r = await formSheet('Ajouter des ouvriers', [{ name: 't', label: 'Un ouvrier par ligne (Nom - poste)', type: 'textarea', placeholder: 'Ahmed - coffreur\nRachid - ferrailleur\n…' }], { okLabel: 'Ajouter' });
        if (!r || !r.t) return; x.lines = [...(x.lines || []), ...r.t.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [n, p] = l.split(/\s+-\s+/); return { n, poste: p || '', p: true, h: 8 }; })]; await DB.put('items', x); draw(); });
      on('bl', async () => { const b = await editItem('bl', { projectId: x.projectId, cmd: x.id, depart: nowHM() }); if (b) { if (x.status === 'acceptee' || x.status === 'demandee') { x.status = 'production'; await DB.put('items', x); } draw(); } });
    };
    draw();
  });
}

// ---------- tableau de bord des équipes (effectifs, rendement, matériel par conducteur) ----------
async function openBoardEquipes() {
  const el = document.createElement('div'); el.className = 'fullpage es-page'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  const M = Team.members() || [], kids = (uid) => M.filter(m => m.managerUid === uid).map(m => m.uid);
  const tree = (uid) => { const out = [uid], st = [uid]; while (st.length) { const u = st.pop(); for (const k of kids(u)) if (!out.includes(k)) { out.push(k); st.push(k); } } return out; };
  const items = (await DB.all('items')).filter(x => Team.canProject(x.projectId)), today = todayISO(), wk = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const heads = M.filter(m => ['dirtravaux', 'conducteur', 'condferraillage'].includes(m.role) || (m.service === 'travaux' && !m.managerUid));
  const stat = (uids) => {
    const pt = items.filter(x => x.kind === 'pt' && uids.includes(x.resp)), ptT = pt.filter(x => x.date === today);
    const eff = ptT.reduce((a, x) => a + (x.lines || []).filter(l => l.p).length, 0), effT = ptT.reduce((a, x) => a + (x.lines || []).length, 0);
    const rd = items.filter(x => x.kind === 'rdt' && uids.includes(x.resp) && x.date >= wk);
    const byTask = {}; rd.forEach(r => { const t = r.tache || 'Autre'; byTask[t] = byTask[t] || { q: 0, hh: 0, u: rdtUnit(r) }; byTask[t].q += +r.qte || 0; byTask[t].hh += (+r.eff || 1) * (+r.h || 8); });
    const mats = items.filter(x => x.kind === 'mat').map(x => [x, uids.reduce((a, u) => a + (+(x.alloc || {})[u] || 0), 0)]).filter(([, q]) => q);
    const cm = items.filter(x => x.kind === 'cmd' && uids.includes(x.resp) && x.date >= wk);
    const imp = items.filter(x => x.kind === 'impl' && uids.includes(x.resp) && !['verifiee', 'refusee'].includes(x.status));
    return { eff, effT, byTask, mats, m3: cm.filter(x => x.status !== 'annulee').reduce((a, x) => a + (+x.vol || 0), 0), imp: imp.length };
  };
  const card = (m) => { const s = stat(tree(m.uid));
    return `<div class="eb-card"><div class="eb-h"><b>${esc(m.name || m.email)}</b><small>${esc(tmRoleOf(m.role).l)}${m.zone ? ' · ' + esc(m.zone) : ''}</small></div>
      <div class="eb-kpi"><div><b>${s.eff}</b><span>présents aujourd'hui${s.effT ? ` / ${s.effT}` : ''}</span></div><div><b>${nf(s.m3, 0)}</b><span>m³ commandés (7 j)</span></div><div><b>${s.imp}</b><span>implantations en cours</span></div></div>
      ${Object.keys(s.byTask).length ? `<div class="es-sub">Rendement (7 jours)</div>${Object.entries(s.byTask).map(([t, v]) => `<div class="es-kv"><span>${esc(t)} · ${nf(v.q, 0)} ${v.u}</span><b>${nf(v.q / Math.max(1, v.hh), 2)} ${v.u}/h·h</b></div>`).join('')}` : ''}
      ${s.mats.length ? `<div class="es-sub">Matériel affecté</div>${s.mats.map(([x, q]) => `<div class="es-kv"><span>${esc(x.nom)}</span><b>${q} ${esc(x.unite || 'u')}</b></div>`).join('')}` : ''}</div>`; };
  const tot = stat(M.map(m => m.uid));
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:17px">Tableau de bord des équipes</h1></div>
    <div class="es-body"><div class="eb-card eb-tot"><div class="eb-h"><b>Tout le chantier</b><small>${fmtDate(today)}</small></div>
      <div class="eb-kpi"><div><b>${tot.eff}</b><span>présents</span></div><div><b>${nf(tot.m3, 0)}</b><span>m³ (7 j)</span></div><div><b>${tot.imp}</b><span>implantations</span></div></div></div>
      ${heads.length ? heads.map(card).join('') : '<div class="empty">Aucun conducteur dans l\'équipe pour le moment.</div>'}
      <div class="cr-none" style="margin-top:10px">Les chiffres viennent du pointage, des fiches de rendement, des commandes béton et du matériel affecté de chaque conducteur et de son équipe (organigramme).</div></div>`;
  $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
}
