// Accueil de l'organisation : aucune donnée nouvelle, uniquement les projets autorisés de l'espace courant.
const Entreprise = (() => {
  const active = () => Team.ready() && !ST.isPerso() && !Team.isCollab();
  const taille = (pack = ST.plan().k) => ({ business: 'moyenne', enterprise: 'grande' })[planOf(pack).k] || 'petite';
  const label = () => ({ petite: 'Petite organisation', moyenne: 'Moyenne organisation', grande: 'Grande organisation' })[taille()];
  function navHTML() {
    if (!active()) return '';
    return `<nav class="ent-nav" aria-label="Organisation"><button data-ent="accueil" class="${App.entView !== 'projets' ? 'on' : ''}">${icon('home')} Accueil</button><button data-ent="projets" class="${App.entView === 'projets' ? 'on' : ''}">${icon('plans')} Projets</button><button data-ent="equipe">${icon('team')} Équipe</button>${taille() !== 'petite' ? '<button data-ent="org">Organisation</button>' : ''}${Team.isAdmin() ? '<button data-ent="reglages">Réglages</button>' : ''}</nav>`;
  }
  function dashboardHTML() {
    if (!active()) return '';
    return `${navHTML()}<section class="ent-dashboard" aria-label="Tableau de bord entreprise"><div class="ent-heading"><div><small>${esc(label())} · ${esc(ST.plan().l)}</small><h2>${taille() === 'grande' ? 'Direction générale' : 'Accueil entreprise'}</h2></div><span class="ent-online" data-ent-online>${navigator.onLine ? 'En ligne' : 'Hors ligne · données locales'}</span></div><div class="ent-kpis" data-ent-kpis>${['Réserves ouvertes', 'PV à valider', 'Tâches du jour', 'Projets'].map(l => `<div><b>…</b><span>${l}</span></div>`).join('')}</div>${Team.isAdmin() ? '<div class="ent-actions"><button class="btn small" data-ent="nouveau">+ Nouveau projet</button><button class="btn ghost small" data-ent="inviter">Inviter un membre</button></div>' : ''}<div class="ent-activity" data-ent-activity></div></section>`;
  }
  async function bind(root) {
    if (!active()) return;
    $$('[data-ent]', root).forEach(b => b.onclick = () => {
      const k = b.dataset.ent;
      if (k === 'nouveau') return newProject();
      if (k === 'inviter') return Team.inviteFlow();
      if (k === 'equipe' || k === 'org' || k === 'reglages') return Team.openCompany({ equipe: 'mem', org: 'org', reglages: 'set' }[k]);
      App.entView = k; renderHome();
    });
    const [all, tasks, forms, reports] = await Promise.all(['projects', 'tasks', 'forms', 'reports'].map(k => DB.all(k)));
    if (!root.isConnected) return;
    const projects = all.filter(p => !p.deleted && Team.canProject(p.id)), ids = new Set(projects.map(p => p.id));
    const t = Team.lvl('reserves') > 0 ? tasks.filter(x => ids.has(x.projectId)) : [], f = Team.lvl('forms') > 0 ? forms.filter(x => ids.has(x.projectId)) : [];
    const vals = [t.filter(x => !isLifted(x)).length, f.filter(x => x.vst === 'soumis' && Team.canValidateForm(x)).length, t.filter(x => !isLifted(x) && x.due === todayISO()).length, projects.length];
    $$('[data-ent-kpis] b', root).forEach((b, i) => { b.textContent = vals[i]; });
    const pn = id => (projects.find(p => p.id === id) || {}).name || '';
    const events = [...t.map(x => ({ ...x, label: x.title || 'Réserve' })), ...f.map(x => ({ ...x, label: x.title || 'PV qualité' })), ...(Team.lvl('rapports') > 0 ? reports.filter(x => ids.has(x.projectId)).map(x => ({ ...x, label: 'Rapport du ' + (x.date || '') })) : [])].filter(x => x.updatedAt).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
    const box = $('[data-ent-activity]', root);
    if (box) box.innerHTML = `<h3>Dernières activités</h3>${events.length ? events.map(x => `<div><span>${esc(x.label)}</span><small>${esc(pn(x.projectId))} · ${new Date(x.updatedAt).toLocaleDateString('fr-FR')}</small></div>`).join('') : '<p class="muted">Aucune activité pour le moment.</p>'}`;
    const online = $('[data-ent-online]', root);
    const update = () => { if (online && online.isConnected) online.textContent = navigator.onLine ? 'En ligne' : 'Hors ligne · données locales'; };
    window.ononline = update; window.onoffline = update;
  }
  function breadcrumbHTML() {
    if (!active() || !App.project) return '';
    const s = SECTIONS[App.section], group = DR_GROUPS.find(g => g[2].includes(App.section));
    return `<nav class="ent-crumb" aria-label="Fil d'Ariane"><button data-ent-home>${esc((Team.company() || {}).name || 'Entreprise')}</button><span>›</span><button data-ent-project>${esc(App.project.name)}</button>${taille() !== 'petite' && group ? `<span>›</span><button data-ent-service>${esc(group[1])}</button>` : ''}<span>›</span><span aria-current="page">${esc(s.title || s.label)}</span></nav>`;
  }
  function bindBreadcrumb(root) {
    const home = $('[data-ent-home]', root), project = $('[data-ent-project]', root), service = $('[data-ent-service]', root);
    if (home) home.onclick = () => { App.entView = 'accueil'; renderHome(); };
    if (project) project.onclick = () => { App.section = 'dashboard'; renderSection(); };
    if (service) service.onclick = () => openDrawer();
  }
  return { active, taille, label, dashboardHTML, bind, breadcrumbHTML, bindBreadcrumb };
})();
