// ================= Mes espaces (PR A) : écran d'accueil des espaces d'un même compte =================
//   Espace personnel · Organisations · Business Projects (projets partagés par d'autres organisations) · Invitations · Profil.
//   Additif : réutilise Team.workspaces / switchTo / joinWithCode ; l'ancien sélecteur reste disponible (« Ancien sélecteur » et réglage « Écran Mes espaces »).
//   Aucune donnée nouvelle, aucune règle serveur touchée : lecture seule des listes déjà synchronisées.
const MesEspaces = (() => {
  const KEY = 'st.ui.espaces';
  // actif par défaut ; désactivable (Réglages › Écran Mes espaces) pour revenir exactement à l'ancien sélecteur
  const enabled = () => { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } };
  const setEnabled = (on) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} };
  // classement pur (testé) : { perso[], orgs[], invit[] } à partir de la liste des espaces
  function classify(L, cur) {
    const out = { perso: [], orgs: [], invit: [], shared: [] };
    for (const w of L || []) {
      if (!w) continue;
      if (w.pending) out.invit.push(w);
      else if (w.role === 'collaborateur') out.shared.push(w);
      else if (w.kind === 'perso') out.perso.push(w);
      else out.orgs.push(w);
    }
    out.cur = cur || '';
    return out;
  }
  const typeOf = (w) => orgTypeOf(w.org || (w.kind === 'perso' ? 'independant' : 'entreprise'));
  function open(opts = {}) {
    if (!Team.ready()) return null;
    const cur = (Team.company() || {}).id || Team.cid();
    const base = Team.workspaces().length ? Team.workspaces() : [{ cid: cur, name: (Team.company() || {}).name, kind: (Team.company() || {}).kind, org: Team.orgType().k, role: (Team.me() || {}).role, plan: Team.plan().k }];
    const C = classify(base, cur), shared = (Team.shared() || []).filter(x => x && x.status !== 'retire');
    const el = document.createElement('div'); el.className = 'fullpage me-pg';
    const row = (w) => { const T = typeOf(w), on = w.cid === cur;
      return `<button class="me-r ${on ? 'on' : ''}" data-ws="${esc(w.cid)}"><span class="e">${w.kind === 'perso' ? '👷' : T.e}</span><span class="grow"><b>${esc(w.name || '?')}${on ? ' ✓' : ''}</b><small>${w.kind === 'perso' ? 'Espace personnel' : esc(T.l)} · ${esc(tmRoleOf(w.role).l)} · ${esc(planOf(w.plan).l)}</small></span><i>›</i></button>`; };
    const sec = (t, n, body, hint) => `<section class="me-s"><h3>${esc(t)}${n != null ? `<em>${n}</em>` : ''}</h3>${body || `<p class="me-e">${esc(hint || 'Aucun')}</p>`}</section>`;
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1>Mes espaces</h1><button class="iconbtn" data-a="more">${icon('more')}</button></div>
      <div class="me-body">
        ${sec('Espace personnel', C.perso.length, C.perso.map(row).join(''), 'Aucun espace personnel')}
        ${sec('Organisations', C.orgs.length, C.orgs.map(row).join(''), 'Aucune organisation — créez-en une ou rejoignez-en avec un code')}
        ${sec('Business Projects', shared.length + C.shared.length, shared.map(x => `<div class="me-r bp"><span class="e">🤝</span><span class="grow"><b>${esc(x.name || x.pid)}</b><small>Projet de « ${esc(x.ownerName || '?')} » · ${esc(x.role || 'intervenant')}${x.status && x.status !== 'actif' ? ' · ' + esc(x.status) : ''}</small></span></div>`).join('') + C.shared.map(row).join(''), 'Aucun projet partagé avec vous')}
        ${sec('Invitations', C.invit.length, C.invit.map(w => `<button class="me-r pend" data-pend="${esc(w.cid)}"><span class="e">⏳</span><span class="grow"><b>${esc(w.name || '?')}</b><small>Demande en attente · toucher pour vérifier</small></span></button>`).join(''), 'Aucune invitation en attente')}
        <div class="me-act"><button class="btn" data-a="join">＋ Rejoindre avec un code</button><button class="btn ghost" data-a="new">＋ Créer un espace</button></div>
        <section class="me-s"><h3>Profil</h3><button class="me-r" data-a="me"><span class="e">👤</span><span class="grow"><b>${esc((Team.me() || {}).name || 'Mon compte')}</b><small>Mon compte et mes informations</small></span><i>›</i></button></section>
        <p class="me-n">Chaque espace garde ses données à part. Pas besoin de vous reconnecter pour changer d'espace.</p>
      </div>`;
    document.body.appendChild(el);
    let closed = false; const unBack = pushBack(() => shut());
    function shut() { if (closed) return; closed = true; try { unBack(); } catch (e) {} el.remove(); if (opts.onClose) opts.onClose(); }
    const $e = (s) => el.querySelector(s);
    ($e('[data-a=x]') || {}).onclick = shut;
    el.querySelectorAll('[data-ws]').forEach(b => b.onclick = () => { if (b.dataset.ws === cur) return shut(); shut(); Team.switchTo(b.dataset.ws); });
    el.querySelectorAll('[data-pend]').forEach(b => b.onclick = () => { shut(); Team.openSwitcher(true); });
    ($e('[data-a=join]') || {}).onclick = async () => { shut(); const cid = await Team.joinWithCode(); if (cid) Team.switchTo(cid); };
    ($e('[data-a=new]') || {}).onclick = () => { shut(); Team.openSwitcher(true); };
    ($e('[data-a=me]') || {}).onclick = () => { shut(); Team.openCompany('me'); };
    ($e('[data-a=more]') || {}).onclick = async () => {
      const v = await menu('Mes espaces', [...(Team.isSuper() && typeof Studio !== 'undefined' ? [{ label: 'Architecture Studio', icon: 'layers', value: 'studio' }] : []), { label: 'Ancien sélecteur d\'espace', icon: 'undo', value: 'old' }, { label: 'Désactiver cet écran (revenir à l\'ancien)', icon: 'close', danger: true, value: 'off' }]);
      if (v === 'studio') { shut(); Studio.open({ onClose: () => MesEspaces.open() }); } else if (v === 'old') { shut(); Team.openSwitcher(true); } else if (v === 'off') { setEnabled(false); toast('Ancien sélecteur rétabli'); shut(); }
    };
    return { el, close: shut, counts: { perso: C.perso.length, orgs: C.orgs.length, invit: C.invit.length, shared: shared.length + C.shared.length } };
  }
  return { open, enabled, setEnabled, classify };
})();
