// ================= SiteTeam : adaptation des outils de Chantier + interfaces par service, poste et formule =================
// Les outils viennent de l'application Chantier. Ici, tout est piloté par le compte SiteTeam :
//  - le POSTE (invitation SiteTeam) choisit l'interface : ordre du menu, tableau de bord, cartes du briefing ;
//  - les DROITS du poste (modules 0-4) décident de ce qui est visible / modifiable / validable ;
//  - le TYPE D'ORGANISATION (entreprise, BET, MOA, labo…) choisit l'interface : les outils hors métier sont masqués ;
//  - le PACK de l'organisation (Basic, Pro, Business, Enterprise) décide des outils disponibles (🔒 sinon).
// Limite connue (v1) : la formule est appliquée dans l'application ; la vérification côté serveur viendra avec la facturation.

// poste SiteTeam → service / poste de l'organisation Chantier (interface, ordre du menu, briefing)
const ST_POSTE = {
  patron: ['trav', 'dirproj'], dirprojet: ['trav', 'dirproj'],
  dirtravaux: ['trav', 'dirtrav'], conducteur: ['trav', 'conduct'], techtravaux: ['trav', 'ingtrav'], chefchantier: ['trav', 'chef'], chefequipe: ['trav', 'cheq'], caporal: ['trav', 'cheq'],
  condferraillage: ['trav', 'conduct'], techferraillage: ['trav', 'ingtrav'], chefchantierfer: ['trav', 'chef'], chefequipefer: ['trav', 'cheq'], caporalfer: ['trav', 'cheq'],
  respcentrale: ['log', 'dirlog'], pilotecentrale: ['log', 'logi'], laborantin: ['labo', 'techlab'], chefparc: ['log', 'logi'], chauffeur: ['log', 'logi'], pompiste: ['log', 'logi'],
  respmateriel: ['log', 'dirlog'], magmateriel: ['log', 'mag'], mecanicien: ['log', 'logi'], conducteurengin: ['log', 'logi'],
  cheftopo: ['etu', 'topo'], techtopo: ['etu', 'topo'], topoext: ['etu', 'topo'],
  dirqualite: ['qual', 'dirq'], ingqualite: ['qual', 'ingq'], respqualite: ['qual', 'respq'], techqualite: ['qual', 'tsq'], ctrlqualite: ['qual', 'ctrl'],
  resphse: ['hse', 'resphse'], animhse: ['hse', 'anim'],
  metreur: ['etu', 'metreur'], bimmanager: ['etu', 'meth'], projeteur: ['etu', 'proj'],
  magasinier: ['log', 'mag'], resppointage: ['log', 'logi'], pointeur: ['log', 'logi'],
  respachats: ['log', 'respach'], acheteur: ['log', 'ach'],
  chefmagasin: ['log', 'mag'], magasinierstock: ['log', 'mag'],
  responsablerh: ['fin', 'daf'], gestionnairepersonnel: ['fin', 'assist'],
  responsablepointage: ['log', 'logi'], agentpointage: ['log', 'logi'],
  chefmaintenance: ['log', 'dirlog'], technicienmaintenance: ['log', 'logi'],
  responsablemethodes: ['etu', 'meth'], planificateur: ['etu', 'meth'],
  ingetudes: ['etu', 'ingstr'], gestionnairecontrats: ['fin', 'gest'],
  responsabletransport: ['log', 'logi'],
  respdoc: ['etu', 'proj'], agentdoc: ['etu', 'proj'],
  resplabo: ['labo', 'resplab'], techlabo: ['labo', 'techlab'], respadmin: ['fin', 'daf'], comptable: ['fin', 'compta'],
  mo: ['mo', 'mo'], mod: ['mo', 'amo'], architecte: ['archi', 'archi'], bet: ['bet', 'bet'], bcontrole: ['bc', 'bc'], labo: ['labo', 'resplab'], soustraitant: ['ext', 'gerst'],
};
const ST_LEVELS = { see: 1, edit: 2, valid: 3 };

const ST = (() => {
  // ---------- aperçu « Tester une interface » (administrateur) : n'affecte que l'affichage ----------
  const PV = {
    get() { try { return JSON.parse(sessionStorage.getItem('st.preview') || 'null'); } catch (e) { return null; } },
    set(v) { try { v ? sessionStorage.setItem('st.preview', JSON.stringify(v)) : sessionStorage.removeItem('st.preview'); } catch (e) {} },
  };
  const ready = () => typeof Team !== 'undefined' && Team.ready();
  // espace personnel : c'est le MÉTIER (profil du compte) qui choisit l'interface — jamais un poste ni des droits
  const perso = () => !PV.get() && ready() && Team.isPerso();
  const roleKey = () => { const p = PV.get(); if (p) return p.role; if (perso()) return Team.profil().metier || 'conducteur'; return ((ready() && Team.me()) || {}).role; };
  const planKey = () => { const p = PV.get(); return p ? p.plan : ((ready() && Team.company()) || {}).plan || PLAN_DEFAULT_COMPANY; };
  const plan = () => planOf(planKey());
  const org = () => { const p = PV.get(); return p && p.org ? orgTypeOf(p.org) : (ready() ? Team.orgType() : orgTypeOf('entreprise')); };
  // interface de la jiha : un module hors du métier de l'organisation est masqué (pas verrouillé)
  const orgHas = (mod) => { const m = org().mods; return m === '*' || !mod || m.includes(mod); };
  // niveau (0-4) du poste courant sur un module SiteTeam ; avant connexion : rien n'est restreint
  const _lvl = Team.lvl, _canSection = Team.canSection;
  function lvl(mod) {
    const p = PV.get();
    if (p) { const R = tmRoleOf(p.role); return R.admin ? 4 : (R.perms[mod] || 0); }
    return _lvl(mod);
  }
  const planHas = (mod) => { const m = plan().modules; return m === '*' || !mod || m.includes(mod); };
  // fonction (Chantier) → module SiteTeam, d'après les rubriques
  const FEAT_MOD = {};
  for (const [sec, f] of Object.entries(SECTION_FEATURE)) if (!FEAT_MOD[f]) FEAT_MOD[f] = SECTION_MOD[sec] || 'projet';
  FEAT_MOD.career = null;   // emploi & carrière : hors SiteTeam

  function applyRole() {
    if (typeof Org === 'undefined') return;
    const k = roleKey(), m = ST_POSTE[k] || ST_POSTE[(tmRoleOf(k) || {}).like];
    // pas de correspondance (ex. collaborateur) : pas d'ancien poste d'un autre espace
    if (!m) { try { localStorage.removeItem('org.me'); } catch (e) {} Org.apply && Org.apply(); return; }
    const cur = Org.me(); if (!cur || cur.service !== m[0] || cur.poste !== m[1]) Org.set({ service: m[0], poste: m[1], at: todayISO(), st: roleKey() });
  }
  function banner() {
    let b = document.getElementById('stPreview'); const p = PV.get();
    if (!p) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'stPreview'; document.body.appendChild(b); }
    b.innerHTML = `<span>👁 Aperçu : <b>${esc(tmRoleOf(p.role).l)}</b> · ${esc(planOf(p.plan).l)}${p.org ? ' · ' + esc(orgTypeOf(p.org).l) : ''}</span><button data-x>Quitter</button>`;
    b.querySelector('[data-x]').onclick = () => stopPreview();
  }
  function refresh() { banner(); try { App.project ? renderSection() : renderHome(); } catch (e) {} }

  async function startPreview() {
    if (!ready() || !Team.isAdmin()) return toast('Réservé aux administrateurs');
    const svc = await menu('Tester une interface : quel service ?', TM_SERVICES.filter(s => !SERVICES_LEGACY.includes(s.k)).map(s => ({ label: s.l, swatch: s.c, value: s.k })));
    if (!svc) return;
    const role = await menu(`${(TM_SERVICES.find(s => s.k === svc) || {}).l} : quel poste ?`, TM_ROLES.filter(r => r.s === svc && !ROLE_LEGACY[r.k]).map(r => ({ label: r.l, value: r.k })));
    if (!role) return;
    const pl = await menu('Avec quel pack ?', Object.values(PLANS).map(P => ({ label: `${P.e || ''} ${P.l} · ${planPrice(P)}`, value: P.k, checked: P.k === planOf((Team.company() || {}).plan || PLAN_DEFAULT_COMPANY).k })));
    if (!pl) return;
    const og = await menu('Dans quel type d\'organisation ?', ORG_TYPES.map(t => ({ label: `${t.e} ${t.l}`, value: t.k, checked: t.k === Team.orgType().k })));
    if (!og) return;
    PV.set({ role, plan: pl, org: og }); applyRole();
    toast('Aperçu : seul l\'affichage change, vos droits réels restent les mêmes');
    App.project = null; refresh();
  }
  function stopPreview() { PV.set(null); applyRole(); refresh(); }

  // ---------- tableau de bord du poste (accueil) : les cartes du briefing, dans l'ordre du service ----------
  // ---------- tableau de bord de l'espace personnel : métier + pack, sans direction, service ni poste ----------
  const METIER_TOOLS = {
    travaux: ['reports', 'tasks', 'reception', 'calc', 'photos', 'planning'], ferraillage: ['reports', 'tasks', 'reception', 'calc', 'photos', 'planning'],
    topo: ['calc', 'plans', 'photos', 'reports', 'tasks', 'models3d'], qualite: ['forms', 'tasks', 'reception', 'constat', 'photos', 'reports'],
    hse: ['hse', 'tasks', 'photos', 'reports', 'forms', 'constat'], metre: ['calc', 'plans', 'finance', 'reports', 'photos', 'tasks'],
    bim: ['plans', 'models3d', 'maquette', 'calc', 'reports', 'photos'], centrale: ['reception', 'gestion', 'reports', 'photos', 'tasks', 'pointage'],
    materiel: ['gestion', 'reports', 'photos', 'tasks', 'pointage', 'plans'], logistique: ['gestion', 'pointage', 'reports', 'photos', 'tasks', 'plans'],
    doc: ['plans', 'reports', 'forms', 'photos', 'tasks', 'constat'], labo: ['labo', 'reception', 'forms', 'photos', 'reports', 'tasks'],
    admin: ['finance', 'pointage', 'reports', 'tasks', 'photos', 'plans'],
  };
  const DEF_TOOLS = ['reports', 'tasks', 'plans', 'photos', 'calc', 'forms'];
  function persoTools() {
    const M = metierOf(Team.profil().metier), L = [...(METIER_TOOLS[M ? M.s : ''] || DEF_TOOLS)];
    for (const k of ['plans', 'tasks', 'reports', 'photos']) if (!L.includes(k)) L.push(k);
    return L.filter(k => SECTIONS[k]).map(k => ({ k, on: Team.canSection(k), label: SECTIONS[k].label.split(' (')[0], icon: SECTIONS[k].icon }));
  }
  function persoHTML() {
    const M = metierOf(Team.profil().metier), P = Team.plan(), stt = Team.planState(), multi = Team.workspaces().length > 1;
    const T = persoTools().slice(0, 8);
    return `<div class="st-ctx"><button class="st-wsc" data-a="st-ws"><span class="e">👷</span><b>Espace personnel</b><i>${multi ? '▾ changer' : '＋ espaces'}</i></button>
        <div class="st-chips"><span>${esc(M ? M.l : 'Métier à choisir')}</span><span class="st-state" style="--c:${stt.c}">${esc(P.l)} · ${esc(stt.l)}</span></div></div>
      <div class="st-pstats" data-pstats>${['Tâches à faire', 'Projets', 'Documents', 'Échéances 7 jours'].map(l => `<div class="st-ps"><b>…</b><small>${l}</small></div>`).join('')}</div>
      <div class="h2-sec"><span>Mes outils professionnels</span><small>${esc(M ? M.l : '')}</small></div>
      <div class="st-ptools">${T.map(t => `<button class="st-pt ${t.on ? '' : 'off'}" data-pt="${t.k}" ${t.on ? '' : 'data-locked="1"'}>${icon(t.icon)}<span>${esc(t.label)}</span>${t.on ? '' : '<small>avec Pro</small>'}</button>`).join('')}</div>
      <div class="h2-sec"><span>Activité récente</span></div><div class="st-pact" data-pact><div class="st-ok">…</div></div>`;
  }
  async function pickPersoProject() {
    const L = (await DB.all('projects')).filter(p => !p.deleted).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!L.length) { toast('Créez d\'abord un projet personnel'); newProject(); return null; }
    if (L.length === 1) return L[0];
    const id = await menu('Dans quel projet ?', L.map(p => ({ label: `${(projTypeOf(p.type) || {}).e || '🏗️'} ${p.name}`, value: p.id })));
    return L.find(p => p.id === id) || null;
  }
  async function persoBind(root) {
    $$('[data-pt]', root).forEach(b => b.onclick = async () => {
      if (b.dataset.locked) { const v = await menu(`« ${b.querySelector('span').textContent} » est inclus dans le pack Pro.`, [{ label: 'Voir mon abonnement', icon: 'settings', value: 'abo' }, { label: 'Fermer', icon: 'check', value: 'x' }]); if (v === 'abo') Team.openCompany('abo'); return; }
      const p = await pickPersoProject(); if (!p) return; await openProject(p); App.section = b.dataset.pt; App.search = ''; renderSection();
    });
    const [projects, tasks, files, reports, forms] = await Promise.all(['projects', 'tasks', 'files', 'reports', 'forms'].map(st => DB.all(st).catch(() => [])));
    const live = projects.filter(p => !p.deleted), pids = new Set(live.map(p => p.id)), P = Team.plan(), soon = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const open = tasks.filter(t => pids.has(t.projectId) && t.status !== 'done' && t.status !== 'closed');
    const vals = [open.length, `${live.length}${P.projects ? ' / ' + P.projects : ''}`, files.filter(f => pids.has(f.projectId)).length, open.filter(t => t.due && t.due <= soon).length];
    const box = root.querySelector('[data-pstats]'); if (box) $$('.st-ps b', box).forEach((b, i) => { b.textContent = vals[i]; });
    const pn = (id) => (live.find(p => p.id === id) || {}).name || '';
    const ev = [...reports.map(r => ({ t: r.updatedAt, l: `Rapport${r.date ? ' du ' + r.date : ''}`, p: r.projectId })), ...tasks.map(r => ({ t: r.updatedAt, l: r.title || 'Tâche', p: r.projectId })),
      ...files.map(r => ({ t: r.updatedAt, l: r.name || 'Fichier', p: r.projectId })), ...forms.map(r => ({ t: r.updatedAt, l: r.title || r.type || 'Formulaire', p: r.projectId }))]
      .filter(x => x.t && pids.has(x.p)).sort((a, b) => b.t - a.t).slice(0, 5);
    const ab = root.querySelector('[data-pact]'); if (ab && ab.isConnected) ab.innerHTML = ev.length ? ev.map(x => `<div class="st-pa"><span>${esc(x.l)}</span><small>${esc(pn(x.p))} · ${new Date(x.t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</small></div>`).join('')
      : '<div class="st-ok">Aucune activité pour le moment. Créez un projet avec le bouton +.</div>';
  }

  function dashHTML() {
    if (!ready()) return '';
    if (perso()) return persoHTML();
    const R = tmRoleOf(roleKey()), T = org(), C = Team.company() || {}, me = Team.me() || {};
    const team = (Team.members() || []).filter(m => m.managerUid && m.managerUid === me.uid).length, multi = Team.workspaces().length > 1;
    // contexte : où l'on travaille (espace · service · poste · projet) — le Dashboard se lit à partir de là
    return `<div class="st-ctx"><button class="st-wsc" data-a="st-ws"><span class="e">${esc(T.e)}</span><b>${esc(C.name || '')}</b><i>${multi ? '▾ changer' : '＋ espaces'}</i></button>
        <div class="st-chips">${Team.isCollab() && !PV.get() ? '<span>🤝 Projet partagé</span><span>Collaborateur</span>' : `<span>${esc(serviceOf(PV.get() ? R.s : (me.service || R.s)).l)}</span><span>${esc(R.l)}</span>`}<button data-a="st-proj">Projet ▾</button></div></div>
      ${team ? `<button class="st-team" data-a="st-team"><b>Mon équipe : ${team} personne(s)</b><small>sous ma responsabilité</small></button>` : ''}
      ${(me.missions || []).length && !PV.get() ? `<div class="st-mbox"><b>Mes missions</b>${me.missions.map(x => `<div class="st-mis">• ${esc(x.t)}</div>`).join('')}</div>` : ''}
      ${R.s === 'qualite' || Team.lvl('forms') >= 2 ? `<div class="st-qual" data-stq><div class="h2-sec"><span>Validation des PV</span></div><div class="st-qtiles">${['À valider', 'À corriger', 'Brouillons', 'Validés (7 j)'].map(l => `<div class="st-ps"><b>…</b><small>${l}</small></div>`).join('')}</div></div>` : ''}
      <div class="st-dash" data-stdash><div class="h2-sec"><span>Mon tableau de bord</span><small>${esc(T.e)} ${esc(R.l)}</small></div><div class="st-tiles"><div class="st-load">…</div></div></div>`;
  }
  async function dashBind(root) {
    if (root && perso()) { const ws = root.querySelector('[data-a=st-ws]'); if (ws) ws.onclick = () => Team.openSwitcher(); return persoBind(root); }
    if (root) {
      const ws = root.querySelector('[data-a=st-ws]'); if (ws) ws.onclick = () => Team.openSwitcher();
      const tm = root.querySelector('[data-a=st-team]'); if (tm) tm.onclick = () => Team.openCompany('org');
      const pj = root.querySelector('[data-a=st-proj]'); if (pj) pj.onclick = async () => {
        const L = (await DB.all('projects')).filter(p => !p.deleted && Team.canProject(p.id)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        if (!L.length) return toast('Aucun projet pour le moment');
        const id = await menu('Ouvrir un projet', L.map(p => ({ label: `${(projTypeOf(p.type) || {}).e || '🏗️'} ${p.name}`, value: p.id })));
        const p = L.find(x => x.id === id); if (p) openProject(p);
      };
    }
    // validation des PV : compteurs du poste (ce que je dois valider, corriger, envoyer)
    const qb = root && root.querySelector('[data-stq]');
    if (qb) { DB.all('forms').then(F => { const me = Team.uid(), wk = Date.now() - 7 * 864e5;
      const v = [F.filter(f => f.vst === 'soumis' && Team.canValidateForm(f)).length, F.filter(f => f.aut === me && f.vst === 'refuse').length, F.filter(f => f.aut === me && (!f.vst || f.vst === 'brouillon')).length, F.filter(f => f.vst === 'valide' && (f.vat || 0) > wk).length];
      $$('.st-ps b', qb).forEach((b, i) => { b.textContent = v[i]; }); }).catch(() => {}); }
    const box = root && root.querySelector('[data-stdash] .st-tiles'); if (!box || typeof briefingData !== 'function') return;
    let cards = [];
    try { cards = (await briefingData()).cards.filter(c => !c.sc); } catch (e) { console.warn('dash', e); }
    if (!box.isConnected) return;
    if (!cards.length) { box.innerHTML = '<div class="st-ok">✓ Rien d\'urgent pour votre poste aujourd\'hui</div>'; return; }
    box.innerHTML = cards.slice(0, 8).map((c, i) => `<button class="st-tile ${c.alert ? 'al' : ''}" data-i="${i}" style="--c:${c.c || '#3b82f6'}"><span class="e">${c.e || '•'}</span><b>${esc(String(c.n ?? ''))}</b><small>${esc(c.t)}</small></button>`).join('')
      + (cards.length > 8 ? `<button class="st-tile more" data-i="-1"><span class="e">＋</span><b>${cards.length - 8}</b><small>autres</small></button>` : '');
    box.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => { if (typeof briefingShow !== 'function') return; const act = await briefingShow(); if (act) act(); });
  }

  // ---------- branchements sur le code de Chantier ----------
  // droits : le poste SiteTeam remplace les postes de Chantier (voir / modifier / valider = niveaux 1 / 2 / 3)
  if (typeof Org !== 'undefined') {
    Org.owner = () => false;
    Org.can = (f, lv = 'edit') => {
      if (!f) return true; if (!ready()) return true;
      if (!(f in FEAT_MOD)) return lvl('projet') >= (ST_LEVELS[lv] || 2);
      const m = FEAT_MOD[f]; if (!m) return false;
      // menu de tous les jours : seulement les outils réellement autorisés (organisation + pack + poste) ; pas de 🔒 ici, le catalogue est à part
      if (!(orgHas(m) && planHas(m) && lvl(m) >= (ST_LEVELS[lv] || 2))) return false;
      // chaque poste a SON menu : les outils de son métier (sauf administrateur de l'organisation) — pour l'instant le service Qualité ;
      // les autres services gardent leur menu actuel jusqu'à leur ouverture
      if ((PV.get() || !Team.isAdmin()) && (tmRoleOf(roleKey()) || {}).s === 'qualite') { const P = Org.poste && Org.poste(); if (P && P.f !== '*' && Array.isArray(P.f) && !P.f.includes(f)) return false; }
      return true;
    };
  }
  // formule : une fonction hors formule apparaît avec 🔒 (si le poste y a droit), sinon elle est masquée
  window.featAllowed = (k) => !ready() || planHas(FEAT_MOD[k]);
  window.featLocked = async (f) => {
    const P = plan(), up = Object.values(PLANS).filter(x => x.modules === '*' || x.modules.includes(FEAT_MOD[f])).map(x => x.l);
    const admin = Team.isAdmin() && !PV.get();
    const v = await menu(`🔒 « ${typeof featName === 'function' ? featName(f) : f} » n'est pas inclus dans le pack ${P.l}.\nDisponible avec : ${up.join(', ') || '—'}.`,
      [...(admin ? [{ label: 'Voir les packs', icon: 'settings', value: 'plans' }] : []), { label: admin ? 'Fermer' : 'OK — demandez à votre administrateur', icon: 'check', value: 'ok' }]);
    if (v === 'plans') Team.openCompany('set');
  };
  // rubriques : droits du poste + formule + réglages du téléphone
  if (typeof sectionOn === 'function') {
    const so = sectionOn;
    window.sectionOn = (k) => so(k) && Team.canSection(k);
  }
  // espaces (topo, centrale, pointage…) et boutons : un outil hors du métier de l'organisation ou hors pack n'apparaît pas
  Team.lvl = (mod) => (orgHas(mod) && planHas(mod)) ? lvl(mod) : 0;
  // espace personnel : pas d'organigramme d'entreprise
  Team.canSection = (k) => !(k === 'org' && perso()) && (PV.get() ? lvl(SECTION_MOD[k] || 'projet') >= 1 : _canSection(k)) && orgHas(SECTION_MOD[k]) && planHas(SECTION_FEATURE[k] ? FEAT_MOD[SECTION_FEATURE[k]] : null);
  // le poste est appliqué après la connexion (et à chaque démarrage)
  const _boot = Team.boot;
  Team.boot = async () => { await _boot(); applyRole(); banner(); };

  // 1er démarrage : pas d'écran « service → poste » de Chantier (le poste vient de l'invitation SiteTeam)
  if (typeof orgOnboard === 'function') { const ob = orgOnboard; window.orgOnboard = (force) => (force ? ob(force) : Promise.resolve()); }

  // identité : pas l'écran d'ouverture animé de Chantier ; verrouillage PIN / empreinte conservé ; « Fermer » quitte
  if (typeof Splash !== 'undefined') {
    Splash.boot = async () => { try { if (typeof AppLock !== 'undefined' && AppLock.get() && typeof lockScreen === 'function') await lockScreen(); } catch (e) { console.warn(e); } };
    Splash.bye = () => { try { if (typeof Sync !== 'undefined' && Sync.enabled()) Sync.run({ quiet: true }).catch(() => {}); } catch (e) {}
      const A = window.Capacitor?.Plugins?.App; if (A && A.exitApp) A.exitApp(); };
  }

  // ---------- nouveau projet : catalogue des types (cartes) puis fiche projet légère ----------
  const FAMILIES = [
    { k: 'route', e: '🛣️', l: 'Routes & Terrassement', d: 'Routes, autoroutes, pistes, terrassements', c: '#b45309', types: ['route'] },
    { k: 'bat', e: '🏢', l: 'Bâtiment', d: 'Villa, immeuble, hôpital, école, stade…', c: '#2563eb', types: ['bat', 'villa', 'equip', 'so'] },
    { k: 'vrd', e: '🚧', l: 'VRD & Réseaux', d: 'Assainissement, AEP, EP, réseaux secs', c: '#0891b2', types: ['vrd'] },
    { k: 'oa', e: '🌉', l: "Ouvrages d'art", d: 'Ponts, viaducs, passages…', c: '#475569', types: ['pont', 'ga'] },
    { k: 'hydro', e: '💧', l: 'Hydraulique', d: 'Barrages, réservoirs, stations', c: '#0284c7', types: ['hydro'] },
    { k: 'indus', e: '🏭', l: 'Projets industriels', d: 'Usines, hangars, charpente', c: '#7c3aed', types: ['indus'] },
    { k: 'reno', e: '🔧', l: 'Réhabilitation', d: 'Rénovation, renforcement', c: '#ca8a04', types: ['reno'] },
    { k: 'ext', e: '🌳', l: 'Aménagements extérieurs', d: 'Espaces verts, places, parcs', c: '#16a34a', types: ['ext'] },
  ];
  function pickType() {
    return new Promise((resolve) => {
      const s = sheet(`<div class="st-types">${FAMILIES.map(F => `<button data-f="${F.k}" style="--c:${F.c}"><span class="e">${F.e}</span><b>${esc(F.l)}</b><small>${esc(F.d)}</small></button>`).join('')}</div>`, { title: 'Créer un projet : quel type ?' });
      s.onClose = () => resolve(null);
      $$('[data-f]', s.el).forEach(b => b.onclick = async () => {
        const F = FAMILIES.find(x => x.k === b.dataset.f); let t = F.types[0];
        if (F.types.length > 1) { t = await menu(F.l, F.types.map(k => projTypeOf(k)).filter(Boolean).map(T => ({ label: `${T.e} ${T.n}`, value: T.k }))); if (!t) return; }
        s.onClose = null; s.close(); resolve(t);
      });
    });
  }
  async function newProject() {
    if (ready() && !(await Team.checkLimit('projects'))) return;
    const t = await pickType(); if (!t) return;
    const T = projTypeOf(t) || PROJ_TYPES[0];
    const r = await formSheet(`${T.e} Fiche projet · essentiel`, [
      { name: 'name', label: 'Nom du projet *', placeholder: 'Ex : Grand stade Hassan II Benslimane' },
      { name: 'address', label: 'Lieu / ville' },
      { name: 'moa', label: "Maître d'ouvrage (MOA)" },
      { name: 'debut', label: 'Date de début', type: 'date' },
      { name: 'duree', label: 'Durée (mois)', type: 'number' },
      { name: 'i', label: 'La suite', type: 'info', value: 'Intervenants, marché, lots et localisation : Paramètres du projet › Fiche projet (avancé), quand vous voulez.' },
    ], { okLabel: 'Créer le projet' });
    if (!r) return;
    if (!r.name) return toast('Le nom du projet est obligatoire');
    const p = await DB.put('projects', { name: r.name, address: r.address || '', moa: r.moa || '', dateDebut: r.debut || '', dureeMois: +r.duree || null, type: T.k, featOff: Object.fromEntries(T.off.map(k => [k, true])), team: [] });
    openProject(p);
  }
  window.newProjectDialog = newProject;
  // fiche projet complète : essentiel + sections avancées (le marché seulement pour qui a accès au financier)
  const FICHE = [
    ['Essentiel', 'projet', [['name', 'Nom du projet'], ['address', 'Lieu / ville'], ['moa', "Maître d'ouvrage"], ['dateDebut', 'Date de début', 'date'], ['dureeMois', 'Durée (mois)', 'number']]],
    ['Intervenants', 'projet', [['moe', "Maître d'œuvre / architecte"], ['bet', 'BET'], ['bc', 'Bureau de contrôle'], ['labo', 'Laboratoire'], ['sousTraitants', 'Sous-traitants', 'textarea']]],
    ['Marché', 'finance', [['numMarche', 'N° de marché'], ['montantHT', 'Montant HT (MAD)', 'number'], ['avance', 'Avance (%)', 'number'], ['retenue', 'Retenue de garantie (%)', 'number'], ['delaiContractuel', 'Délai contractuel (mois)', 'number'], ['dateOS', "Date de l'ordre de service", 'date']]],
    ['Organisation', 'projet', [['lots', 'Lots (un par ligne)', 'textarea'], ['zones', 'Zones / blocs / niveaux', 'textarea'], ['responsable', 'Responsable du projet']]],
    ['Localisation', 'projet', [['gps', 'Coordonnées GPS (lat, long)']]],
  ];
  async function projectFiche(p) {
    const secs = FICHE.filter(([, mod]) => lvl(mod) >= 1), ro = (mod) => lvl(mod) < 2;
    const filled = secs.flatMap(([, , F]) => F).filter(([k]) => p[k] != null && p[k] !== '').length, total = secs.flatMap(([, , F]) => F).length;
    const v = await menu(`Fiche projet · ${filled}/${total} renseignés`, secs.map(([t, mod, F]) => ({ label: t, sub: `${F.filter(([k]) => p[k] != null && p[k] !== '').length}/${F.length}${ro(mod) ? ' · lecture seule' : ''}`, icon: 'edit', value: t })));
    if (!v) return;
    const [t, mod, F] = secs.find(x => x[0] === v);
    if (ro(mod)) return alertBox(F.map(([k, l]) => `${l} : ${p[k] ?? '—'}`).join('\n'));
    const r = await formSheet(`${t} · ${p.name}`, F.map(([k, l, type]) => ({ name: k, label: l, type: type || 'text', value: p[k] ?? '' })));
    if (!r) return;
    F.forEach(([k, , type]) => { p[k] = type === 'number' ? (r[k] === '' ? null : +r[k]) : r[k]; });
    if (!p.name) p.name = 'Projet';
    await DB.put('projects', p); toast('Fiche projet enregistrée ✓'); return projectFiche(p);
  }

  // ---------- validation d'un PV : Brouillon → Soumis → Validé / Refusé (motif) → corrigé et renvoyé ----------
  const VST = { brouillon: ['Brouillon', '#94a3b8'], soumis: ['Soumis — à valider', '#f59e0b'], valide: ['Validé', '#22c55e'], refuse: ['Refusé — à corriger', '#ef4444'] };
  const nameOf = (uid) => ((Team.members() || []).find(m => m.uid === uid) || {}).name || '';
  function vChip(f) { const [l, c] = VST[f.vst || 'brouillon'] || VST.brouillon; return `<span class="st-state" style="--c:${c}">${l}</span>`; }
  function vBox(f) {
    if (!ready() || perso()) return '';
    const me = Team.uid(), st = f.vst || 'brouillon', mine = !f.aut || f.aut === me, canV = Team.canValidateForm(f);
    return `<div class="st-vbox">${vChip(f)}
      ${f.vst === 'valide' ? `<small>Validé par ${esc(nameOf(f.vby) || '—')} le ${f.vat ? new Date(f.vat).toLocaleDateString('fr-FR') : ''}</small>` : ''}
      ${f.vst === 'refuse' ? `<small>Refusé par ${esc(nameOf(f.vby) || '—')} : ${esc(f.vmotif || '')}</small>` : ''}
      ${f.aut ? `<small>Auteur : ${esc(nameOf(f.aut) || '—')}</small>` : ''}
      <div class="btnrow" style="padding:0">${mine && (st === 'brouillon' || st === 'refuse') ? '<button class="btn small" data-v="soumettre">Soumettre pour validation</button>' : ''}
        ${canV && st === 'soumis' ? '<button class="btn small" data-v="valider">Valider</button><button class="btn ghost small" data-v="refuser">Refuser</button>' : ''}</div></div>`;
  }
  function vBind(el, f, save) {
    if (!ready() || perso()) return;
    const me = Team.uid(), canV = Team.canValidateForm(f);
    // PV validé : en lecture seule pour qui ne peut pas valider
    if (f.vst === 'valide' && !canV) $$('.content input, .content select, .content textarea, .content [data-res], .content [data-r]', el).forEach(x => { x.disabled = true; x.style.pointerEvents = 'none'; });
    $$('[data-v]', el).forEach(b => b.onclick = async () => {
      const a = b.dataset.v; f.vhist = f.vhist || [];
      if (a === 'soumettre') { if (!f.aut) f.aut = me; f.vst = 'soumis'; f.vhist.push({ a: 'soumis', by: me, at: Date.now() }); }
      if (a === 'valider') { if (!(await confirmBox('Valider ce PV ?', 'Valider'))) return; f.vst = 'valide'; f.vby = me; f.vat = Date.now(); f.vmotif = ''; f.vhist.push({ a: 'valide', by: me, at: f.vat }); }
      if (a === 'refuser') { const r = await formSheet('Refuser le PV', [{ name: 'm', label: 'Motif (ce qu\'il faut corriger)', type: 'textarea' }], { okLabel: 'Refuser' }); if (!r || !r.m) return; f.vst = 'refuse'; f.vby = me; f.vat = Date.now(); f.vmotif = r.m; f.vhist.push({ a: 'refuse', by: me, at: f.vat, m: r.m }); }
      await save(); toast(a === 'soumettre' ? 'PV envoyé pour validation ✓' : a === 'valider' ? 'PV validé ✓' : 'PV refusé — renvoyé à l\'auteur');
      try { Sync.run({ quiet: true }).catch(() => {}); } catch (e) {}
    });
  }
  // ---------- Archive & Documentation (qualité) : classement des documents du projet ----------
  const DOC_CATS = [['paq', 'PAQ — Plan d\'assurance qualité', '📘'], ['proc', 'Procédures', '📑'], ['pc', 'Plans de contrôle', '🗂️'], ['ft', 'Fiches techniques et agréments', '🧾'],
    ['pv', 'PV de réception', '✅'], ['labo', 'Rapports d\'essais labo', '🧪'], ['nc', 'NC et actions correctives', '⚠️'], ['visa', 'Visas', '🖋️'], ['audit', 'Audits', '🔍'], ['autre', 'Divers', '📎'], ['archive', 'Archives', '🗄️']];
  async function renderDocs(root) {
    const pid = App.project.id, all = (await DB.byProject('files', pid)).filter(f => f.role === 'doc' && f.docCat), cat = App.docCat;
    const canW = Team.lvl('files') >= 2, inCat = (k) => all.filter(f => k === 'archive' ? f.archived : (!f.archived && f.docCat === k));
    if (!cat) {
      root.innerHTML = `<div class="pagehead"><h2>Documentation & archives</h2><p>Classement des documents du projet</p></div>
        <div class="st-docs">${DOC_CATS.map(([k, l, e]) => `<button class="st-doc" data-c="${k}"><span class="e">${e}</span><b>${esc(l)}</b><small>${inCat(k).length} document(s)</small></button>`).join('')}</div>`;
      $$('[data-c]', root).forEach(b => b.onclick = () => { App.docCat = b.dataset.c; renderDocs(root); });
      return;
    }
    const C = DOC_CATS.find(x => x[0] === cat) || DOC_CATS[0], L = inCat(cat).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    root.innerHTML = `<div class="pagehead"><button class="linkbtn" data-a="up">← Tous les classements</button><h2>${C[2]} ${esc(C[1])}</h2></div>
      ${L.length ? `<div class="list">${L.map(f => `<div class="row" data-id="${f.id}"><span>${icon('file')}</span><div class="grow"><div class="title">${esc(f.name || 'Document')}</div><div class="sub">${new Date(f.updatedAt || Date.now()).toLocaleDateString('fr-FR')}${f.archived ? ' · archivé' : ''}</div></div></div>`).join('')}</div>`
        : `<div class="empty">Aucun document ici.${canW && cat !== 'archive' ? '<br>Appuyez sur <b>+</b> pour ajouter un PDF, une photo, un Word ou un Excel.' : ''}</div>`}`;
    $('[data-a=up]', root).onclick = () => { App.docCat = null; renderDocs(root); };
    $$('.row[data-id]', root).forEach(r => r.onclick = async () => { const f = L.find(x => x.id === r.dataset.id);
      const v = await menu(f.name || 'Document', [{ label: 'Ouvrir', icon: 'file', value: 'open' }, ...(canW ? [{ label: f.archived ? 'Sortir des archives' : 'Archiver', icon: 'folder', value: 'arc' }, { label: 'Changer de classement', icon: 'edit', value: 'mv' }, { label: 'Supprimer', icon: 'trash', danger: true, value: 'del' }] : [])]);
      if (v === 'open') return openFileRecord(f, f.name);
      if (v === 'arc') { f.archived = !f.archived; await DB.put('files', f); }
      if (v === 'mv') { const c = await menu('Classer dans', DOC_CATS.filter(x => x[0] !== 'archive').map(([k, l, e]) => ({ label: `${e} ${l}`, value: k, checked: k === f.docCat }))); if (c) { f.docCat = c; await DB.put('files', f); } }
      if (v === 'del' && await confirmBox(`Supprimer « ${f.name} » ?`, 'Supprimer')) await DB.del('files', f.id);
      renderDocs(root); });
    if (canW && cat !== 'archive') fab(root, async () => {
      const files = await pickFiles({ accept: '*/*', multiple: true }); if (!files || !files.length) return;
      for (const file of files) await DB.put('files', { projectId: pid, blob: file, mime: mimeFromName(file.name, file.type), name: file.name, role: 'doc', docCat: cat, by: Team.uid() });
      toast(`${files.length} document(s) ajouté(s) ✓`); renderDocs(root);
    });
  }

  function refreshRole() { applyRole(); try { App.project ? renderSection() : renderHome(); } catch (e) {} }
  return { dashHTML, dashBind, startPreview, stopPreview, preview: () => PV.get(), plan, lvl, org, newProject, projectFiche, refreshRole, isPerso: perso, vBox, vBind, vChip, renderDocs };
})();
