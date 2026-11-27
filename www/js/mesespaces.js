// ================= Mes espaces (PR A) : écran d'accueil des espaces d'un même compte =================
//   Espace personnel · Organisations · Business Projects (projets partagés par d'autres organisations) · Invitations · Profil.
//   Additif : réutilise Team.workspaces / switchTo / joinWithCode ; l'ancien sélecteur reste disponible (« Ancien sélecteur » et réglage « Écran Mes espaces »).
//   Aucune donnée nouvelle, aucune règle serveur touchée : lecture seule des listes déjà synchronisées.
const MesEspaces = (() => {
  const KEY = 'st.ui.espaces';
  // actif par défaut ; désactivable (Réglages › Écran Mes espaces) pour revenir exactement à l'ancien sélecteur
  const enabled = () => { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } };
  const setEnabled = (on) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} };

  // ========= Point 17 (demande du propriétaire, 21/11/2026) : catalogue de présentation de l'Entreprise =========
  // Les 7 services qui ont déjà une interface dédiée réelle (SVC_SHELLS, siteteam.js) reprennent leurs volets
  // (Administratif/Terrain/Commun) existants ; les 9 autres (encore « interface standard » dans l'app) reçoivent
  // ici une présentation conçue par cohérence avec le reste (même esprit, même découpage en 3 volets), en
  // attendant leurs outils dédiés. Les intervenants (BET, Architecte…) reprennent leurs propres services (déjà
  // construits, ST.INTERVENANTS) comme liste de volets. Clé → ST.SVC_SHELLS.k pour les 7 services réels.
  const ENT_SHELL_OF = { aut_0: 'qual', aut_1: 'hse', aut_2: 'travaux', aut_5: 'etu', aut_10: 'fin', aut_12: 'topo', aut_13: 'labo' };
  // couleur, émoji, accroche et volets des 9 services encore sans outils dédiés dans l'app (conçus pour ce point 17)
  const ENT_DESC = {
    aut_3: { c: '#9333ea', e: '🧭', tag: 'Modes opératoires, phasage et choix techniques du chantier.',
      vol: [['Administratif', 'Modes opératoires, fiches techniques, phasage'], ['Terrain', 'Validation terrain, retours d\'expérience'], ['Commun', 'Équipe, organigramme, mon espace']] },
    aut_4: { c: '#2563eb', e: '🗓️', tag: 'Plannings, jalons et chemin critique, suivis service par service.',
      vol: [['Administratif', 'Plannings, jalons, chemin critique'], ['Terrain', 'Avancement, retards, alertes'], ['Commun', 'Équipe, organigramme, mon espace']] },
    aut_6: { c: '#b45309', e: '🚜', tag: 'Parc matériel, affectations et maintenance.',
      vol: [['Administratif', 'Parc, affectations, contrats'], ['Terrain', 'Utilisation, pannes, maintenance'], ['Commun', 'Équipe, organigramme, mon espace']] },
    aut_7: { c: '#be123c', e: '🧾', tag: 'Commandes, fournisseurs et bons de livraison.',
      vol: [['Administratif', 'Fournisseurs, commandes, contrats'], ['Terrain', 'Réceptions, bons de livraison'], ['Commun', 'Équipe, organigramme, mon espace']] },
    aut_8: { c: '#0d9488', e: '🚚', tag: 'Approvisionnement de chantier et flux de matériaux.',
      vol: [['Administratif', 'Plannings d\'approvisionnement, flux'], ['Terrain', 'Livraisons, stockage, circulation'], ['Commun', 'Équipe, organigramme, mon espace']] },
    aut_9: { c: '#4d7c0f', e: '👥', tag: 'Effectifs, pointage et affectations du personnel.',
      vol: [['Administratif', 'Effectifs, contrats, paie'], ['Terrain', 'Pointage, présence, affectations'], ['Commun', 'Équipe, organigramme, mon espace']] },
    aut_11: { c: '#0891b2', e: '📏', tag: 'Métrés, quantitatifs et attachements.',
      vol: [['Administratif', 'Métrés, quantitatifs, devis'], ['Terrain', 'Relevés, attachements'], ['Commun', 'Équipe, organigramme, mon espace']] },
    aut_14: { c: '#7c2d12', e: '📊', tag: 'Indicateurs, reporting et contrôle de projet transverse.',
      vol: [['Administratif', 'Indicateurs, reporting, audits'], ['Terrain', 'Contrôles terrain, écarts'], ['Commun', 'Équipe, organigramme, mon espace']] },
    aut_15: { c: '#4f46e5', e: '🧩', tag: 'Ordonnancement, pilotage et coordination (OPC) des lots.',
      vol: [['Administratif', 'Planning général, coordination des lots'], ['Terrain', 'Réunions de chantier, synthèse'], ['Commun', 'Équipe, organigramme, mon espace']] },
  };
  // catalogue unifié (16 services aut_* + intervenants iv_*), avec le contenu de présentation de chacun
  async function entCatalog() {
    let L = []; try { const raw = await (await fetch('assets/studio.json')).json(); L = raw.filter(n => n.kind === 'service' && n.parent === 'autonomous'); } catch (e) {}
    const IV = (typeof ST !== 'undefined' && ST.INTERVENANTS) || [], SH = (typeof ST !== 'undefined' && ST.SVC_SHELLS) || [];
    const cardsA = L.map(n => {
      const shellK = ENT_SHELL_OF[n.id], shell = shellK && SH.find(s => s.k === shellK), d = ENT_DESC[n.id];
      const c = (shell || d || {}).c || '#7c3aed', vol = shell ? Object.entries(shell.ui).map(([, v]) => v) : d ? d.vol.map(x => x[1]) : null;
      const labels = shell ? Object.keys(shell.ui).map(k => ({ adm: 'Administratif', ter: 'Terrain', com: 'Commun' }[k] || k)) : d ? d.vol.map(x => x[0]) : ['Administratif', 'Terrain', 'Commun'];
      return { id: n.id, label: n.label, c, e: (d || {}).e || (shell ? '🧩' : '🧩'),
        tag: (d || {}).tag || (shell ? 'Interface dédiée : ' + Object.values(shell.ui).join(' · ') : 'Interface standard (en attendant sa version dédiée).'),
        volets: vol ? labels.map((l, i) => ({ label: l, desc: vol[i] })) : [{ label: 'Outils', desc: 'Outils standards du pack Pro (projets, plans, tâches, photos, rapports, réceptions…)' }] };
    });
    const cardsB = IV.map(I => ({ id: 'iv_' + I.k, label: I.nom, c: I.c, e: I.e,
      tag: `Organisation partenaire : ${I.services.length} service(s), chacun en 3 volets (Administratif/Terrain/Commun).`,
      volets: I.services.map(s => ({ label: s.nom, desc: Object.values(s.ui || {}).join(' · ') })) }));
    return [...cardsA, ...cardsB];
  }
  // page de présentation d'UN service (titre, description, volets) + action de demande d'accès, au bas de la page
  function presentSheet(svc) {
    return new Promise((resolve) => {
      const html = `<div class="ent-present" style="--c:${svc.c}">
          <div class="ent-ph"><span class="ent-pe">${svc.e}</span><h2>${esc(svc.label)}</h2></div>
          <p class="ent-ptag">${esc(svc.tag)}</p>
          <div class="ent-pv">${svc.volets.map(v => `<div class="ent-pvi"><b>${esc(v.label)}</b><span>${esc(v.desc)}</span></div>`).join('')}</div>
          <button class="btn" data-a="go">Demander l'accès à « ${esc(svc.label)} »</button>
        </div>`;
      let done = false;
      const s = sheet(html, { title: svc.label, onMount: (el) => { ($('[data-a=go]', el)||{}).onclick = async () => { done = true; s.close(); resolve(await Team.requestEntService(svc)); }; } });
      s.onClose = () => { if (!done) resolve(false); };
    });
  }
  // écran « Ajouter un service » : catalogue restant (moins ceux déjà débloqués), + option « Entreprise complète » en haut
  async function openEntAdd() {
    if (!Team.company() || Team.company().kind !== 'entreprise') return;
    if (Team.entHasAll()) { toast('Tous les services sont déjà débloqués ✓'); return; }
    const all = await entCatalog(), left = all.filter(s => !Team.entHasSvc(s.id));
    if (!left.length) { toast('Tous les services sont déjà ajoutés ✓'); return; }
    const entAll = { id: Team.ENT_ALL, label: 'Entreprise complète', c: '#0f172a', e: '🏢',
      tag: 'Débloque en une fois TOUS les services du catalogue pour cette Entreprise.',
      volets: [{ label: 'Tout compris', desc: all.map(s => s.label).join(', ') }] };
    const items = [{ label: '🏢 Entreprise complète — tous les services', icon: 'star', value: '__all' },
      ...left.map(s => ({ label: `${s.e} ${s.label}`, icon: 'layers', value: s.id }))];
    const v = await menu('＋ Ajouter un service', items);
    if (!v) return;
    const svc = v === '__all' ? entAll : left.find(s => s.id === v);
    if (svc) await presentSheet(svc);
  }
  // classement pur (testé) : { perso[], orgs[], invit[] } à partir de la liste des espaces
  // v1.0.3xx (point 17) : « ent » (kind « entreprise ») séparé de « services » (kind « service », espaces autonomes
  // créés avant ce point — demande du propriétaire : pas de migration, ils restent affichés tels quels, à part).
  function classify(L, cur) {
    const out = { perso: [], orgs: [], invit: [], shared: [], services: [], ent: [] };
    for (const w of L || []) {
      if (!w) continue;
      if (w.pending) out.invit.push(w);
      else if (w.role === 'collaborateur') out.shared.push(w);
      else if (w.kind === 'perso') out.perso.push(w);
      else if (w.kind === 'entreprise') out.ent.push(w);
      else if (w.kind === 'service') out.services.push(w);
      else out.orgs.push(w);
    }
    out.cur = cur || '';
    return out;
  }
  const typeOf = (w) => orgTypeOf(w.org || (w.kind === 'perso' ? 'independant' : 'entreprise'));
  // écran de rattachement (côté service : demandes reçues ; côté organisation : services demandés + nouvelle demande)
  async function attachScreen() {
    const A = Team.attach, svc = A.isSvc(), me = (Team.company() || {}).id || Team.cid();
    const back = () => MesEspaces.open();
    let L; try { L = svc ? await A.listIn() : await A.listOrg(); } catch (e) { alertBox('Rattachement indisponible : ' + (e && e.code === 'permission-denied' ? 'les règles serveur « rattachement » ne sont pas encore publiées par le Super Admin.' : errMsg(e))); return back(); }
    const items = L.map(x => ({ label: `${svc ? (x.orgName || x.org) : (x.svc)} — ${A.label(x.status)}`, icon: x.status === 'actif' ? 'check' : 'clock', value: x.id }));
    if (!svc) items.push({ label: '＋ Demander le rattachement d\'un service', icon: 'plus', value: '__new' });
    if (svc) items.unshift({ label: 'Mon code de rattachement : ' + me, icon: 'link', value: '__code' });
    const v = await menu(svc ? 'Demandes de rattachement' : 'Services rattachés', items);
    if (!v) return back();
    if (v === '__code') { try { await navigator.clipboard.writeText(me); toast('Code copié'); } catch (e) { alertBox('Code : ' + me); } return attachScreen(); }
    if (v === '__new') {
      const r = await formSheet('Rattacher un service autonome', [{ name: 'code', label: 'Code de rattachement du service', placeholder: 'Collé depuis l\'espace du service' }], { okLabel: 'Envoyer la demande', intro: 'L\'administrateur du service doit accepter. Le rattachement n\'ouvre aucun accès à ses données.' });
      if (r && r.code) { try { await A.request(r.code); toast('Demande envoyée ✓'); } catch (e) { alertBox(e && e.code === 'permission-denied' ? 'Refusé par le serveur : code inconnu, ce n\'est pas un service, ou règles non publiées.' : errMsg(e)); } }
      return attachScreen();
    }
    const x = L.find(y => y.id === v); if (!x) return back();
    const org = svc ? x.org : me, sv = svc ? me : x.svc;
    const acts = [];
    if (svc && x.status === 'demande') acts.push({ label: 'Accepter', icon: 'check', value: 'yes' }, { label: 'Refuser', icon: 'close', danger: true, value: 'no' });
    if (x.status === 'actif') acts.push({ label: 'Révoquer le rattachement', icon: 'close', danger: true, value: 'rev' });
    if (x.status !== 'actif') acts.push({ label: 'Supprimer cette ligne', icon: 'trash', danger: true, value: 'del' });
    const a = await menu(svc ? (x.orgName || x.org) : x.svc, acts);
    try { if (a === 'yes') await A.answer(x.org, true); else if (a === 'no') await A.answer(x.org, false); else if (a === 'rev') await A.revoke(org, sv); else if (a === 'del') await A.remove(org, sv); if (a) toast('Fait ✓'); } catch (e) { alertBox(errMsg(e)); }
    return attachScreen();
  }
  // Business Project (Étape 3, PR D) : projet partagé multi-organisations = projet de l'organisation porteuse + partenaires (mécanisme existant, règles inchangées).
  // Création réservée au pack Business / Enterprise et à l'administrateur ; l'invitation des organisations passe par « Organisations du projet ».
  const canBP = () => { try { return Team.isAdmin() && (Team.company() || {}).kind !== 'service' && ['business', 'enterprise'].includes(Team.plan().k); } catch (e) { return false; } };
  async function newBP() {
    const r = await formSheet('Nouveau Business Project', [
      { name: 'name', label: 'Nom du projet *', placeholder: 'Ex : Résidence Les Jardins — équipe complète' },
      { name: 'address', label: 'Lieu / ville' },
      { name: 'i', type: 'info', label: 'Collaboration', value: 'Votre organisation porte le projet. Vous invitez ensuite les autres organisations (BET, architecte, contrôle, labo, sous-traitants…) ; chacune ne voit que ce que vous lui partagez.' },
    ], { okLabel: 'Créer' });
    if (!r) return null; if (!r.name) { toast('Le nom du projet est obligatoire'); return null; }
    const p = await DB.put('projects', { name: r.name, address: r.address || '', type: 'bat', bp: true, featOff: {}, team: [] });
    try { Team.noteProject(p); } catch (e) {}
    try { if (typeof Sync !== 'undefined' && Sync.enabled && Sync.enabled()) await Sync.run({ quiet: true }); } catch (e) {}
    toast('Business Project créé ✓'); return p;
  }
  function open(opts = {}) {
    if (!Team.ready()) return null;
    const cur = (Team.company() || {}).id || Team.cid();
    const base = Team.workspaces().length ? Team.workspaces() : [{ cid: cur, name: (Team.company() || {}).name, kind: (Team.company() || {}).kind, org: Team.orgType().k, role: (Team.me() || {}).role, plan: Team.plan().k }];
    const C = classify(base, cur), shared = (Team.shared() || []).filter(x => x && x.status !== 'retire');
    const el = document.createElement('div'); el.className = 'fullpage me-pg';
    // v1.0.3xx : bouton « supprimer » par ligne (demande du propriétaire) — réutilise Team.deleteEspace, déjà construit
    // pour l'ancien sélecteur (wsMenu, « Changer d'espace ») ; même condition (w.role === 'patron', propriétaire de CET
    // espace) que là-bas, qu'il s'agisse de l'espace actif ou d'un autre — deleteEspace gère les deux cas.
    const row = (w) => { const T = typeOf(w), on = w.cid === cur, sv = w.kind === 'service', ent = w.kind === 'entreprise', canDel = w.kind !== 'perso' && w.role === 'patron';
      // v1.0.3xx (point 17) : sous-titre de l'Entreprise = nombre de services débloqués (0 = « vide, aucun accès »)
      const entSub = ent ? (w.cid === cur ? (Team.entHasAll() ? 'Tous les services débloqués' : `${Team.entSvcKeys().length} service(s) débloqué(s)`) : '') : '';
      const [tone,ic] = w.kind === 'perso' ? ['#4ade80','st_helmet'] : stOrgVisual(T.k);
      const btn = `<button class="me-r ${on ? 'on' : ''}" data-ws="${esc(w.cid)}" style="${stVisualStyle(tone)}"><span class="e me-ico">${icon(sv?'layers':ic)}</span><span class="grow"><b>${esc(w.name || '?')}${on ? ' ✓' : ''}</b><small>${[w.kind === 'perso' ? 'Espace personnel' : ent ? ('Entreprise' + (entSub ? ' · ' + entSub : '')) : sv ? 'Service autonome' : T.l,tmRoleOf(w.role).l,ent?'':planOf(w.plan).l].filter(Boolean).map(esc).join(' · ')}</small></span><i>›</i></button>`;
      return canDel ? `<div class="me-rw">${btn}<button class="me-del" data-medel="${esc(w.cid)}" data-nm="${esc(w.name || '')}" title="Supprimer cet espace">${icon('trash')}</button></div>` : btn; };
    const sec = (t, n, body, hint) => `<section class="me-s"><h3>${esc(t)}${n != null ? `<em>${n}</em>` : ''}</h3>${body || `<p class="me-e">${esc(hint || 'Aucun')}</p>`}</section>`;
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1>Mes espaces</h1><button class="iconbtn" data-a="more">${icon('more')}</button></div>
      <div class="me-body">
        <div class="me-intro"><span class="me-ico">${icon('layers')}</span><div><b>Vos espaces de travail</b><small>Un compte · des données séparées</small></div></div>
        <div class="me-act me-main-actions"><button class="btn" data-a="join">${icon('link')} Rejoindre avec un code</button><button class="btn ghost" data-a="new">${icon('plus')} Créer un espace</button></div>
        ${sec('Espace personnel', C.perso.length, C.perso.map(row).join(''), 'Aucun espace personnel')}
        ${sec('Organisations', C.orgs.length, C.orgs.map(row).join(''), 'Aucune organisation — créez-en une ou rejoignez-en avec un code')}
        ${C.ent.length ? sec('Entreprises existantes', C.ent.length, C.ent.map(row).join('') + (C.ent.some(w => w.cid === cur) ? '<button class="btn ghost" data-a="entadd">＋ Ajouter un service</button>' : '')) : ''}
        ${C.services.length ? sec('Services autonomes (historique)', C.services.length, C.services.map(row).join('')) : ''}
        ${sec('Business Projects', shared.length + C.shared.length, shared.map(x => `<div class="me-r bp"><span class="e">🤝</span><span class="grow"><b>${esc(x.name || x.pid)}</b><small>Projet de « ${esc(x.ownerName || '?')} » · ${esc(x.role || 'intervenant')}${x.status && x.status !== 'actif' ? ' · ' + esc(x.status) : ''}</small></span></div>`).join('') + C.shared.map(row).join(''), 'Aucun projet partagé avec vous')}
        ${canBP() ? '<div class="me-act"><button class="btn ghost" data-a="newbp">＋ Créer un Business Project</button></div>' : ''}
        ${sec('Invitations', C.invit.length, C.invit.map(w => `<button class="me-r pend" data-pend="${esc(w.cid)}"><span class="e">⏳</span><span class="grow"><b>${esc(w.name || '?')}</b><small>Demande en attente · toucher pour vérifier</small></span></button>`).join(''), 'Aucune invitation en attente')}
        <section class="me-s"><h3>Profil</h3><button class="me-r" data-a="me"><span class="e">👤</span><span class="grow"><b>${esc((Team.me() || {}).name || 'Mon compte')}</b><small>Mon compte et mes informations</small></span><i>›</i></button></section>
        <p class="me-n">Chaque espace garde ses données à part. Pas besoin de vous reconnecter pour changer d'espace.</p>
      </div>`;
    document.body.appendChild(el);
    let closed = false; const unBack = pushBack(() => shut());
    function shut() { if (closed) return; closed = true; try { unBack(); } catch (e) {} el.remove(); if (opts.onClose) opts.onClose(); }
    const $e = (s) => el.querySelector(s);
    ($e('[data-a=x]') || {}).onclick = shut;
    el.querySelectorAll('[data-ws]').forEach(b => b.onclick = () => { if (b.dataset.ws === cur) return shut(); shut(); Team.switchTo(b.dataset.ws); });
    el.querySelectorAll('[data-medel]').forEach(b => b.onclick = (e) => { e.stopPropagation(); Team.deleteEspace(b.dataset.medel, b.dataset.nm); });
    el.querySelectorAll('[data-pend]').forEach(b => b.onclick = () => { shut(); Team.openSwitcher(true); });
    ($e('[data-a=join]') || {}).onclick = async () => { shut(); const cid = await Team.joinWithCode(); if (cid) Team.switchTo(cid); };
    ($e('[data-a=new]') || {}).onclick = () => { shut(); Team.openSwitcher(true); };
    ($e('[data-a=newbp]') || {}).onclick = async () => { const p = await newBP(); if (!p) return; shut(); try { await Team.openPartners(p); } catch (e) { alertBox(errMsg(e)); } };
    // v1.0.3xx (point 17) : « Nouveau service autonome » (standalone, kind « service ») est retiré — remplacé par
    // « Créer mon Entreprise » (une seule fois) puis « Ajouter un service » à l'intérieur, par cohérence avec le
    // nouveau modèle. Les espaces « service » déjà créés restent affichés ci-dessus, inchangés (pas de migration).
    // La création passe exclusivement par le parcours « Créer un espace » → pack → organisation.
    ($e('[data-a=entadd]') || {}).onclick = async () => { await openEntAdd(); shut(); MesEspaces.open(); };
    ($e('[data-a=me]') || {}).onclick = () => { shut(); Team.openCompany('me'); };
    ($e('[data-a=more]') || {}).onclick = async () => {
      const v = await menu('Mes espaces', [...(Team.attach && Team.attach.ok() ? [{ label: Team.attach.isSvc() ? 'Demandes de rattachement' : 'Rattacher un service autonome', icon: 'link', value: 'attach' }] : []), ...(Team.isSuper() && typeof Studio !== 'undefined' ? [{ label: 'Architecture Studio', icon: 'layers', value: 'studio' }] : []), { label: 'Ancien sélecteur d\'espace', icon: 'undo', value: 'old' }, { label: 'Désactiver cet écran (revenir à l\'ancien)', icon: 'close', danger: true, value: 'off' }]);
      if (v === 'attach') { shut(); attachScreen(); } else if (v === 'studio') { shut(); Studio.open({ onClose: () => MesEspaces.open() }); } else if (v === 'old') { shut(); Team.openSwitcher(true); } else if (v === 'off') { setEnabled(false); toast('Ancien sélecteur rétabli'); shut(); }
    };
    return { el, close: shut, counts: { services: C.services.length, perso: C.perso.length, orgs: C.orgs.length, invit: C.invit.length, shared: shared.length + C.shared.length } };
  }
  return { open, enabled, setEnabled, classify, attachScreen, canBP, openEntAdd, entCatalog, presentSheet };
})();
