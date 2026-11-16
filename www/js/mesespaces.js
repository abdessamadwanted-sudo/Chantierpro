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
    const out = { perso: [], orgs: [], invit: [], shared: [], services: [] };
    for (const w of L || []) {
      if (!w) continue;
      if (w.pending) out.invit.push(w);
      else if (w.role === 'collaborateur') out.shared.push(w);
      else if (w.kind === 'perso') out.perso.push(w);
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
  function open(opts = {}) {
    if (!Team.ready()) return null;
    const cur = (Team.company() || {}).id || Team.cid();
    const base = Team.workspaces().length ? Team.workspaces() : [{ cid: cur, name: (Team.company() || {}).name, kind: (Team.company() || {}).kind, org: Team.orgType().k, role: (Team.me() || {}).role, plan: Team.plan().k }];
    const C = classify(base, cur), shared = (Team.shared() || []).filter(x => x && x.status !== 'retire');
    const el = document.createElement('div'); el.className = 'fullpage me-pg';
    const row = (w) => { const T = typeOf(w), on = w.cid === cur, sv = w.kind === 'service';
      return `<button class="me-r ${on ? 'on' : ''}" data-ws="${esc(w.cid)}"><span class="e">${w.kind === 'perso' ? '👷' : sv ? '🧩' : T.e}</span><span class="grow"><b>${esc(w.name || '?')}${on ? ' ✓' : ''}</b><small>${w.kind === 'perso' ? 'Espace personnel' : sv ? 'Service autonome' : esc(T.l)} · ${esc(tmRoleOf(w.role).l)} · ${esc(planOf(w.plan).l)}</small></span><i>›</i></button>`; };
    const sec = (t, n, body, hint) => `<section class="me-s"><h3>${esc(t)}${n != null ? `<em>${n}</em>` : ''}</h3>${body || `<p class="me-e">${esc(hint || 'Aucun')}</p>`}</section>`;
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1>Mes espaces</h1><button class="iconbtn" data-a="more">${icon('more')}</button></div>
      <div class="me-body">
        ${sec('Espace personnel', C.perso.length, C.perso.map(row).join(''), 'Aucun espace personnel')}
        ${sec('Organisations', C.orgs.length, C.orgs.map(row).join(''), 'Aucune organisation — créez-en une ou rejoignez-en avec un code')}
        ${sec('Services autonomes', C.services.length, C.services.map(row).join('') + '<button class="btn ghost" data-a="newsvc">＋ Nouveau service autonome</button>', 'Un service peut vivre seul (Qualité, HSE…), avec ses propres données et son propre abonnement')}
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
    ($e('[data-a=newsvc]') || {}).onclick = async () => {
      let L = []; try { const raw = await (await fetch('assets/studio.json')).json(); L = raw.filter(n => n.kind === 'service' && n.parent === 'autonomous'); } catch (e) {}
      if (!L.length) return toast('Catalogue indisponible');
      const v = await menu('Nouveau service autonome', L.map(n => ({ label: n.label, icon: 'layers', value: n.id })));
      const n = L.find(x => x.id === v); if (!n) return;
      shut(); const cid = await Team.createService(n.label, n.id); if (cid) Team.switchTo(cid); else MesEspaces.open();
    };
    ($e('[data-a=me]') || {}).onclick = () => { shut(); Team.openCompany('me'); };
    ($e('[data-a=more]') || {}).onclick = async () => {
      const v = await menu('Mes espaces', [...(Team.attach && Team.attach.ok() ? [{ label: Team.attach.isSvc() ? 'Demandes de rattachement' : 'Rattacher un service autonome', icon: 'link', value: 'attach' }] : []), ...(Team.isSuper() && typeof Studio !== 'undefined' ? [{ label: 'Architecture Studio', icon: 'layers', value: 'studio' }] : []), { label: 'Ancien sélecteur d\'espace', icon: 'undo', value: 'old' }, { label: 'Désactiver cet écran (revenir à l\'ancien)', icon: 'close', danger: true, value: 'off' }]);
      if (v === 'attach') { shut(); attachScreen(); } else if (v === 'studio') { shut(); Studio.open({ onClose: () => MesEspaces.open() }); } else if (v === 'old') { shut(); Team.openSwitcher(true); } else if (v === 'off') { setEnabled(false); toast('Ancien sélecteur rétabli'); shut(); }
    };
    return { el, close: shut, counts: { services: C.services.length, perso: C.perso.length, orgs: C.orgs.length, invit: C.invit.length, shared: shared.length + C.shared.length } };
  }
  return { open, enabled, setEnabled, classify, attachScreen };
})();
