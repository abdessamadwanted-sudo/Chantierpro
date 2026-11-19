// ================= Service autonome « Travaux » (Pro Service autonome, catalogue aut_2) =================
// Interface dédiée à ce service — demande explicite du propriétaire : chaque service autonome construit, un par
// un, sa propre interface (pas l'accueil générique de renderHome). Travaux est le premier, construit autour de son
// outil phare : Matériaux (ferraillage). Les autres écrans du service (projets, équipe…) restent ceux déjà testés
// de l'application (openProject, newProjectDialog…) — seule la page d'accueil est entièrement nouvelle.
async function renderSvcTravaux() {
  App.fromBrief = null; App.homeFocus = null; App.project = null; BackStack.length = 0;
  const C = Team.company() || {};
  const allP = (await DB.all('projects')).filter(p => App.showAllP || Team.canProject(p.id)).sort((a, b) => b.updatedAt - a.updatedAt);
  // alertes Matériaux agrégées sur tous les projets du service (écart ≥3% ou stock ≤10%) — même calcul que le module
  let mat = { ecarts: 0, stocks: 0 };
  if (typeof Materiaux !== 'undefined' && typeof Materiaux.calcAlertes === 'function') {
    for (const p of allP) {
      try {
        const items = await DB.byProject('items', p.id);
        const arts = items.filter(x => x.kind === 'mta'), dls = items.filter(x => x.kind === 'mtd'), moves = items.filter(x => x.kind === 'mtm');
        const al = Materiaux.calcAlertes(arts, dls, moves);
        mat.ecarts += al.filter(a => a.type === 'ecart').length; mat.stocks += al.filter(a => a.type === 'stock').length;
      } catch (e) {}
    }
  }
  const allTasks = await DB.all('tasks');
  const openT = allTasks.filter(x => allP.some(p => p.id === x.projectId) && !isLifted(x)).length;
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  $('#app').innerHTML = `
    <div class="svt-home trav">
      <div class="svt-hero">
        <div class="svt-top"><div class="brand notr"><span class="logo st-lg">${stLogo()}</span><b class="bt">SITETEAM</b></div>
          <div class="h2-acts"><button class="iconbtn h2-quit" data-a="quit" title="Fermer (appui long : verrouiller)">${icon('power')}</button>
          <button class="iconbtn" data-a="homemore">${icon('more')}</button></div></div>
        <div class="svt-badge">🧩 Service autonome · ⭐ Pro</div>
        <div class="svt-id"><span class="svt-av">🏗️</span><div><h1>${esc(C.name || 'Service Travaux')}</h1><small>Direction travaux · conducteurs · chefs de chantier · équipes</small></div></div>
      </div>
      <div class="svt-body">
        <div class="svt-kpis">
          <div class="svt-kpi"><b>${allP.length}</b><span>Projet(s)</span></div>
          <div class="svt-kpi ${mat.ecarts ? 'r' : 'g'}"><b>${mat.ecarts}</b><span>Écart(s) ferraillage</span></div>
          <div class="svt-kpi ${mat.stocks ? 'o' : 'g'}"><b>${mat.stocks}</b><span>Stock(s) bas</span></div>
          <div class="svt-kpi ${openT ? 'o' : 'g'}"><b>${openT}</b><span>Réserves ouvertes</span></div>
        </div>
        <button class="svt-feat" data-a="materiaux"><span class="e">⚖️</span><span class="grow"><b>Matériaux · Ferraillage</b><small>Tonnage théorique/réel, écarts, stock — tableau de bord dédié</small></span><i>›</i></button>
        <div class="svt-sec"><h3>Projets</h3>
          ${allP.length ? allP.map(p => { const [c1, c2] = [['#2563eb', '#1e3a8a']][0];
            return `<div class="svt-proj"><button class="svt-pc" data-open="${p.id}" style="--c1:${c1};--c2:${c2}"><span class="av">${esc(initials(p.name))}</span><span class="grow"><b>${esc(p.name || 'Projet sans nom')}</b>${p.address ? `<small>${esc(p.address)}</small>` : ''}</span><i>›</i></button>
              <button class="svt-pm" data-mat="${p.id}" title="Matériaux">${icon('box') || '⚖️'}</button></div>`; }).join('')
            : '<p class="st-of-n">Aucun projet encore — créez-en un pour commencer.</p>'}
          <button class="btn ghost" data-a="newproj">${icon('plus')} Nouveau projet</button>
        </div>
      </div>
    </div>`;
  const $e = (s) => $('#app ' + s);
  ($e('[data-a=quit]') || {}).onclick = async () => { if (await confirmBox('Fermer SiteTeam ?', 'Fermer')) Splash.bye(); };
  ($e('[data-a=homemore]') || {}).onclick = async () => { if (typeof MesEspaces !== 'undefined') MesEspaces.open(); else if (Team.openSwitcher) Team.openSwitcher(true); };
  ($e('[data-a=newproj]') || {}).onclick = () => { if (typeof newProjectDialog === 'function') newProjectDialog(); };
  $$('[data-open]', $('#app')).forEach(b => b.onclick = async () => { const p = allP.find(x => x.id === b.dataset.open); if (p) await openProject(p); });
  $$('[data-mat]', $('#app')).forEach(b => b.onclick = async () => { const p = allP.find(x => x.id === b.dataset.mat); if (p) await openProject(p, 'materiaux'); });
  ($e('[data-a=materiaux]') || {}).onclick = async () => {
    if (allP.length === 1) return openProject(allP[0], 'materiaux');
    if (!allP.length) return toast('Créez d\'abord un projet');
    const v = await menu('Matériaux · quel projet ?', allP.map(p => ({ label: p.name || 'Projet sans nom', icon: 'box', value: p.id })));
    const p = allP.find(x => x.id === v); if (p) await openProject(p, 'materiaux');
  };
  // v1.0.3xx : barre du bas (Projets/Pro/Équipe/Réglages) — manquait sur cet écran dédié, donc pas d'accès direct
  // aux Réglages (compte, email) depuis l'accueil du service Travaux (demande du propriétaire, même correction déjà
  // faite pour Qualité). Le bouton « Réglages » réutilise le même menu que le bouton ⋮ déjà présent (data-a=homemore).
  if (typeof ST !== 'undefined' && ST.bottomNav) ST.bottomNav();
}
