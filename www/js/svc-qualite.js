// ================= Service autonome « Qualité » (Pro Service autonome, catalogue aut_0) =================
// Demande du propriétaire : chaque service autonome a sa propre interface. Qualité réutilise le gabarit visuel
// déjà construit pour l'Entreprise (SVC_SHELLS « qual » — volets Administratif / Terrain / Commun, voir
// ST.renderProjectTools dans siteteam.js) : même structure, mêmes couleurs, pour que le propriétaire retrouve
// exactement ce qu'il a déjà validé sur « Outils du projet ». Ici, l'accueil liste les projets du service ; un
// tap ouvre directement ces volets (openProject(p, 'ptools') — ST.renderProjectTools détecte tout seul qu'une
// société « service autonome » dont le pack est Qualité (svcKey aut_0) doit afficher les volets au lieu des
// catégories génériques).
async function renderSvcQualite() {
  App.fromBrief = null; App.homeFocus = null; App.project = null; BackStack.length = 0;
  $('#app').classList.remove('with-bnav');
  const C = Team.company() || {};
  const allP = (await DB.all('projects')).filter(p => App.showAllP || Team.canProject(p.id)).sort((a, b) => b.updatedAt - a.updatedAt);
  const allForms = await DB.all('forms').catch(() => []), allRecs = await DB.all('receptions').catch(() => []);
  const pvEnAttente = allForms.filter(f => allP.some(p => p.id === f.projectId) && f.vst === 'soumis').length;
  const nc = allRecs.filter(d => allP.some(p => p.id === d.projectId)).reduce((a, d) => a + (d.rows || []).filter(r => r.element && r.ok === false).length, 0);
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  $('#app').innerHTML = `
    <div class="svt-home">
      <div class="svt-hero">
        <div class="svt-top"><div class="brand notr"><span class="logo st-lg">${stLogo()}</span><b class="bt">SITETEAM</b></div>
          <div class="h2-acts"><button class="iconbtn h2-quit" data-a="quit" title="Fermer (appui long : verrouiller)">${icon('power')}</button>
          <button class="iconbtn" data-a="homemore">${icon('more')}</button></div></div>
        <div class="svt-badge">🧩 Service autonome · ⭐ Pro</div>
        <div class="svt-id"><span class="svt-av">🛡️</span><div><h1>${esc(C.name || 'Service Qualité')}</h1><small>Documentation, contrôles, réceptions, laboratoire</small></div></div>
      </div>
      <div class="svt-body">
        <div class="svt-kpis">
          <div class="svt-kpi"><b>${allP.length}</b><span>Projet(s)</span></div>
          <div class="svt-kpi ${pvEnAttente ? 'o' : 'g'}"><b>${pvEnAttente}</b><span>PV en attente</span></div>
          <div class="svt-kpi ${nc ? 'r' : 'g'}"><b>${nc}</b><span>Non-conformités</span></div>
        </div>
        <div class="svt-sec"><h3>Projets</h3>
          ${allP.length ? allP.map(p => { const [c1, c2] = [['#0d9488', '#134e4a']][0];
            return `<div class="svt-proj"><button class="svt-pc" data-open="${p.id}" style="--c1:${c1};--c2:${c2}"><span class="av">${esc(initials(p.name))}</span><span class="grow"><b>${esc(p.name || 'Projet sans nom')}</b>${p.address ? `<small>${esc(p.address)}</small>` : ''}</span><i>›</i></button></div>`; }).join('')
            : '<p class="st-of-n">Aucun projet encore — créez-en un pour commencer.</p>'}
          <button class="btn ghost" data-a="newproj">${icon('plus')} Nouveau projet</button>
        </div>
      </div>
    </div>`;
  const $e = (s) => $('#app ' + s);
  ($e('[data-a=quit]') || {}).onclick = async () => { if (await confirmBox('Fermer SiteTeam ?', 'Fermer')) Splash.bye(); };
  ($e('[data-a=homemore]') || {}).onclick = async () => { if (typeof MesEspaces !== 'undefined') MesEspaces.open(); else if (Team.openSwitcher) Team.openSwitcher(true); };
  ($e('[data-a=newproj]') || {}).onclick = () => { if (typeof newProjectDialog === 'function') newProjectDialog(); };
  $$('[data-open]', $('#app')).forEach(b => b.onclick = async () => { const p = allP.find(x => x.id === b.dataset.open); if (p) await openProject(p, 'ptools'); });
}
