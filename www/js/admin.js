// Panneau d'administration SiteTeam (Super Admin seulement). Les droits sont vérifiés par les règles Firestore (licOwner),
// cette page ne fait qu'afficher et envoyer les décisions : packs, organisations, comptes, services, version, annonces, erreurs.
(() => {
  'use strict';
  const SUPER = 'abdessamad.daga94@gmail.com';
  const emu = /[?&]emu=1/.test(location.search);
  const fb = firebase.apps.length ? firebase.app() : firebase.initializeApp(FB_CONFIG);
  const auth = firebase.auth(), db = firebase.firestore();
  try { db.settings(emu ? { experimentalForceLongPolling: true, merge: true } : { experimentalAutoDetectLongPolling: true, merge: true }); } catch (e) {}
  if (emu) { auth.useEmulator('http://127.0.0.1:9099'); db.useEmulator('127.0.0.1', 8080); }
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ms = (t) => (t && t.toMillis ? t.toMillis() : (typeof t === 'number' ? t : 0));
  const ago = (t) => { const m = ms(t); if (!m) return '—'; const d = (Date.now() - m) / 60000; if (d < 2) return 'à l\'instant'; if (d < 60) return `il y a ${Math.round(d)} min`; if (d < 1440) return `il y a ${Math.round(d / 60)} h`; return new Date(m).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' }); };
  const dt = (t) => { const m = ms(t); return m ? new Date(m).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'; };
  const app = $('#app');
  let toastT; const toast = (m) => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); };
  const fail = (e) => { console.error(e); toast('Erreur : ' + (e.code === 'permission-denied' ? 'accès refusé (règles Firestore publiées ?)' : (e.message || e))); };
  // fenêtre (dialog) : html + boutons ; renvoie la valeur du bouton choisi et les champs
  function modal(title, html, buttons = [['Fermer', null, 'ghost']]) {
    return new Promise((resolve) => {
      const d = document.createElement('dialog');
      d.innerHTML = `<h3>${esc(title)}</h3><div class="mb">${html}</div><div class="btns" style="margin-top:14px">${buttons.map(([l, v, c], i) => `<button class="btn ${c || ''}" data-i="${i}">${esc(l)}</button>`).join('')}</div>`;
      document.body.appendChild(d); d.showModal();
      const vals = () => Object.fromEntries($$('[name]', d).map(x => [x.name, x.type === 'checkbox' ? x.checked : x.value.trim()]));
      $$('[data-i]', d).forEach(b => b.onclick = () => { const v = buttons[+b.dataset.i][1], f = vals(); d.close(); d.remove(); resolve(v == null ? null : { v, ...f }); });
      d.addEventListener('cancel', () => { d.remove(); resolve(null); });
    });
  }
  const PLAN_L = (k) => { const P = planOf(k); return `${P.e || ''} ${P.l}`; };
  const STATUS = { gratuit: ['Gratuit', 'acc'], essai: ['Essai', 'warn'], actif: ['Actif', 'ok'], suspendu: ['Suspendu', 'bad'] };
  const stPill = (s) => { const x = STATUS[s] || [s || '—', '']; return `<span class="pill ${x[1]}">${esc(x[0])}</span>`; };

  // ---------- données ----------
  const D = { users: [], orgs: [], members: [], projects: [], errors: [], reqs: [], annonces: [], codes: [], cfg: { plans: {}, services: {}, app: {} }, at: 0 };
  async function load(force) {
    if (!force && Date.now() - D.at < 60000) return D;
    const [u, c, m, p, e, r, a, cp, cs, ca, pk] = await Promise.all([
      db.collection('users').get(), db.collection('companies').get(), db.collectionGroup('members').get(), db.collectionGroup('projects').get(),
      db.collection('errors').orderBy('at', 'desc').limit(400).get().catch(() => ({ docs: [] })), db.collection('packRequests').orderBy('at', 'desc').limit(200).get().catch(() => ({ docs: [] })),
      db.collection('annonces').get().catch(() => ({ docs: [] })), db.collection('config').doc('plans').get(), db.collection('config').doc('services').get(), db.collection('config').doc('app').get(),
      db.collection('packCodes').get().catch(() => ({ docs: [] }))]);
    D.users = u.docs.map(d => ({ uid: d.id, ...d.data() }));
    D.orgs = c.docs.map(d => ({ id: d.id, ...d.data() }));
    D.members = m.docs.filter(d => d.ref.parent.parent && d.ref.parent.parent.parent.id === 'companies').map(d => ({ uid: d.id, cid: d.ref.parent.parent.id, ...d.data() }));
    D.projects = p.docs.filter(d => d.ref.parent.parent && d.ref.parent.parent.parent.id === 'companies').map(d => ({ id: d.id, cid: d.ref.parent.parent.id, ...d.data() })).filter(x => !x.deleted);
    D.errors = e.docs.map(d => ({ id: d.id, ...d.data() })); D.reqs = r.docs.map(d => ({ id: d.id, ...d.data() })); D.annonces = a.docs.map(d => ({ id: d.id, ...d.data() }));
    D.cfg = { plans: cp.exists ? cp.data() : {}, services: cs.exists ? cs.data() : {}, app: ca.exists ? ca.data() : {} };
    D.codes = pk.docs.map(d => ({ code: d.id, ...d.data() }));
    D.at = Date.now(); return D;
  }
  const userOf = (uid) => D.users.find(x => x.uid === uid) || {};
  const orgOf = (cid) => D.orgs.find(x => x.id === cid) || {};

  // ---------- écrans ----------
  const TABS = [['dash', 'Tableau de bord'], ['users', 'Utilisateurs'], ['orgs', 'Organisations'], ['reqs', 'Demandes'], ['codes', 'Codes pack'], ['ctrl', 'Contrôle de l\'app'], ['ann', 'Annonces'], ['err', 'Erreurs']];
  let tab = (location.hash || '').slice(1); if (!TABS.some(t => t[0] === tab)) tab = 'dash';
  function shell(user) {
    app.innerHTML = `<header><div class="hd"><div class="grow"><b>🛡 SiteTeam Admin</b><br><small>${esc(user.email)}</small></div>
        <button class="btn ghost" data-a="reload" title="Actualiser">↻</button><a class="btn ghost" href="index.html${emu ? '?emu=1' : ''}">Application</a><button class="btn ghost" data-a="out">Sortir</button></div>
      <nav>${TABS.map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</nav></header><main id="main"><div class="empty">Chargement…</div></main>`;
    $('[data-a=out]').onclick = () => auth.signOut();
    $('[data-a=reload]').onclick = () => draw(true);
    $$('nav [data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; location.hash = tab; $$('nav [data-t]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
    draw();
  }
  async function draw(force) {
    const M = $('#main'); if (!M) return;
    try { await load(force); } catch (e) { M.innerHTML = `<div class="card"><b>Impossible de charger les données</b><p class="muted">${esc(e.code === 'permission-denied' ? 'Accès refusé : publiez les dernières règles Firestore (application › Réglages › Copier les règles).' : (e.message || e))}</p></div>`; return; }
    ({ dash, users, orgs, reqs, codes, ctrl, ann, err })[tab](M);
  }

  function dash(M) {
    const now = Date.now(), act = (h) => D.users.filter(u => now - ms(u.lastSeen) < h * 3600e3).length;
    const org = D.orgs.filter(o => o.kind !== 'perso'), perso = D.orgs.filter(o => o.kind === 'perso');
    const byPlan = {}; D.orgs.forEach(o => { const k = planOf(o.plan || 'enterprise').k; byPlan[k] = (byPlan[k] || 0) + 1; });
    const vers = {}; D.users.forEach(u => { if (u.appVersion) vers[u.appVersion] = (vers[u.appVersion] || 0) + 1; });
    const err7 = D.errors.filter(e => now - ms(e.at) < 7 * 864e5).length, pend = D.reqs.filter(r => r.status === 'attente').length;
    const bars = (o) => { const L = Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8), mx = Math.max(1, ...L.map(x => x[1])); return L.length ? `<div class="bars">${L.map(([k, v]) => `<div><span>${esc(k)}</span><i style="width:${Math.max(4, v / mx * 100)}%"></i><em>${v}</em></div>`).join('')}</div>` : '<div class="empty">Aucune donnée</div>'; };
    M.innerHTML = `<h2>Tableau de bord</h2>
      <div class="tiles">
        <div class="tile"><b>${D.users.length}</b><small>Comptes</small></div>
        <div class="tile"><b>${act(24)}</b><small>Actifs (24 h)</small></div>
        <div class="tile"><b>${act(24 * 7)}</b><small>Actifs (7 jours)</small></div>
        <div class="tile"><b>${org.length}</b><small>Organisations</small></div>
        <div class="tile"><b>${perso.length}</b><small>Espaces personnels</small></div>
        <div class="tile"><b>${D.projects.length}</b><small>Projets</small></div>
        <div class="tile"><b>${pend}</b><small>Demandes en attente</small></div>
        <div class="tile"><b>${err7}</b><small>Erreurs (7 jours)</small></div>
      </div>
      <div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
        <div class="card"><h3>Packs utilisés</h3>${bars(Object.fromEntries(Object.entries(byPlan).map(([k, v]) => [PLAN_L(k), v])))}</div>
        <div class="card"><h3>Versions de l'application</h3>${bars(vers)}</div>
      </div>
      <p class="muted">Les comptes apparaissent avec leur e-mail et leur version à leur prochaine ouverture de l'application (version 1.0.24 ou plus récente).</p>`;
  }

  function users(M) {
    const memOf = (uid) => D.members.filter(m => m.uid === uid);
    M.innerHTML = `<h2>Utilisateurs (${D.users.length})</h2><div class="card"><input id="q-users" type="search" placeholder="Rechercher : nom, e-mail…"><div id="ul"></div></div>`;
    const list = () => { const q = $('#q-users').value.toLowerCase();
      const L = D.users.filter(u => !q || `${u.name || ''} ${u.email || ''} ${u.uid}`.toLowerCase().includes(q)).sort((a, b) => ms(b.lastSeen) - ms(a.lastSeen));
      $('#ul').innerHTML = L.length ? L.slice(0, 300).map(u => `<div class="row" data-u="${esc(u.uid)}"><div class="t grow"><b>${esc(u.name || u.email || u.uid)}</b><small>${esc(u.email || 'e-mail inconnu (ancienne version)')} · ${memOf(u.uid).length} espace(s) · ${esc(u.appVersion || '—')}</small></div>
        ${u.blocked ? '<span class="pill bad">Bloqué</span>' : `<span class="pill">${esc(ago(u.lastSeen))}</span>`}</div>`).join('') : '<div class="empty">Aucun compte</div>';
      $$('[data-u]', $('#ul')).forEach(r => r.onclick = () => userCard(r.dataset.u)); };
    $('#q-users').oninput = list; list();
  }
  async function userCard(uid) {
    const u = userOf(uid), ms_ = D.members.filter(m => m.uid === uid);
    const r = await modal(u.name || u.email || uid, `<div class="kv"><span>E-mail</span><b>${esc(u.email || '—')}</b><span>Dernière ouverture</span><b>${esc(dt(u.lastSeen))}</b><span>Version</span><b>${esc(u.appVersion || '—')} · ${esc(u.platform || '')}</b><span>Identifiant</span><b style="overflow-wrap:anywhere">${esc(uid)}</b></div>
      <h3 style="margin-top:12px">Espaces</h3>${ms_.length ? ms_.map(m => { const o = orgOf(m.cid); return `<div class="row"><div class="t grow"><b>${esc(o.name || m.cid)}</b><small>${esc(m.role || '')}${m.admin ? ' · administrateur' : ''} · ${PLAN_L(o.plan || 'enterprise')}</small></div>${stPill(o.planStatus)}</div>`; }).join('') : '<div class="empty">Aucun</div>'}
      ${u.blocked ? `<p class="muted">Bloqué le ${esc(dt(u.blockedAt))}${u.blockedWhy ? ' : ' + esc(u.blockedWhy) : ''}</p>` : '<label>Motif du blocage (visible par la personne)<input name="why" placeholder="Ex : non-respect des conditions"></label>'}`,
      [[u.blocked ? 'Débloquer' : 'Bloquer le compte', u.blocked ? 'unblock' : 'block', u.blocked ? '' : 'bad'], ['Annonce à cette personne', 'ann', 'ghost'], ['Fermer', null, 'ghost']]);
    if (!r) return;
    try {
      if (r.v === 'block' || r.v === 'unblock') {
        if (uid === (auth.currentUser || {}).uid) return toast('Impossible de bloquer votre propre compte');
        await db.collection('users').doc(uid).update(r.v === 'block' ? { blocked: true, blockedAt: ts(), blockedWhy: r.why || '' } : { blocked: false, blockedAt: null, blockedWhy: '' });
        toast(r.v === 'block' ? 'Compte bloqué ✓' : 'Compte débloqué ✓'); draw(true);
      }
      if (r.v === 'ann') annForm({ target: uid, label: u.email || u.name || uid });
    } catch (e) { fail(e); }
  }

  function orgs(M) {
    M.innerHTML = `<h2>Organisations et espaces (${D.orgs.length})</h2><div class="card"><div class="bar"><input id="q-orgs" type="search" placeholder="Rechercher une organisation…">
      <select id="f-orgs"><option value="">Toutes</option><option value="org">Organisations</option><option value="perso">Espaces personnels</option><option value="suspendu">Suspendues</option><option value="essai">En essai</option></select></div><div id="ol"></div></div>`;
    const list = () => { const q = $('#q-orgs').value.toLowerCase(), f = $('#f-orgs').value;
      const L = D.orgs.filter(o => (!q || (o.name || '').toLowerCase().includes(q)) && (!f || (f === 'org' ? o.kind !== 'perso' : f === 'perso' ? o.kind === 'perso' : o.planStatus === f)))
        .sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
      $('#ol').innerHTML = L.length ? L.map(o => `<div class="row" data-o="${esc(o.id)}"><div class="t grow"><b>${esc(o.name || o.id)}</b><small>${o.kind === 'perso' ? 'Espace personnel' : esc(orgTypeOf(o.orgType || 'entreprise').l)} · ${PLAN_L(o.plan || 'enterprise')} · ${D.members.filter(m => m.cid === o.id).length} membre(s) · ${D.projects.filter(p => p.cid === o.id).length} projet(s)</small></div>${stPill(o.planStatus)}</div>`).join('') : '<div class="empty">Aucune</div>';
      $$('[data-o]', $('#ol')).forEach(r => r.onclick = () => orgCard(r.dataset.o)); };
    $('#q-orgs').oninput = list; $('#f-orgs').onchange = list; list();
  }
  async function orgCard(cid) {
    const o = orgOf(cid), mem = D.members.filter(m => m.cid === cid), own = userOf(o.ownerUid);
    const r = await modal(o.name || cid, `<div class="kv"><span>Type</span><b>${o.kind === 'perso' ? 'Espace personnel' : esc(orgTypeOf(o.orgType || 'entreprise').l)}</b><span>Créée</span><b>${esc(dt(o.createdAt))}</b><span>Propriétaire</span><b>${esc(own.email || own.name || o.ownerUid || '—')}</b>${o.trialEndsAt ? `<span>Fin d'essai</span><b>${esc(dt(o.trialEndsAt))}</b>` : ''}</div>
      <label>Pack<select name="plan">${Object.values(PLANS).map(P => `<option value="${P.k}" ${planOf(o.plan || 'enterprise').k === P.k ? 'selected' : ''}>${esc(PLAN_L(P.k))} · ${esc(planPrice(P))}</option>`).join('')}</select></label>
      <label>Statut<select name="st">${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}" ${o.planStatus === k ? 'selected' : ''}>${esc(l)}${k === 'essai' ? ' (14 jours de plus)' : ''}${k === 'suspendu' ? ' — bloque l\'accès aux projets' : ''}</option>`).join('')}</select></label>
      <h3 style="margin-top:6px">Membres (${mem.length})</h3>${mem.map(m => `<div class="row"><div class="t grow"><b>${esc(m.name || m.email || m.uid)}</b><small>${esc(m.email || '')} · ${esc(tmRoleOf(m.role).l)}${m.admin ? ' · admin' : ''}</small></div></div>`).join('') || '<div class="empty">Aucun</div>'}`,
      [['Enregistrer', 'save'], ['Annonce à l\'organisation', 'ann', 'ghost'], ['Fermer', null, 'ghost']]);
    if (!r) return;
    try {
      if (r.v === 'save') {
        if (r.st === 'suspendu' && o.planStatus !== 'suspendu' && !(await modal('Suspendre ?', `<p>« ${esc(o.name)} » n'aura plus accès à ses projets et fichiers. Rien n'est effacé ; vous pourrez rétablir l'accès.</p>`, [['Suspendre', 'ok', 'bad'], ['Annuler', null, 'ghost']]))) return;
        const extra = r.st === 'essai' ? { trialEndsAt: firebase.firestore.Timestamp.fromMillis(Date.now() + 14 * 864e5) } : {};
        await db.collection('companies').doc(cid).update({ plan: r.plan, planStatus: r.st, ...extra }); toast('Enregistré ✓'); draw(true);
      }
      if (r.v === 'ann') annForm({ cid, label: o.name || cid });
    } catch (e) { fail(e); }
  }

  function reqs(M) {
    const L = D.reqs;
    M.innerHTML = `<h2>Demandes de pack (${L.filter(x => x.status === 'attente').length} en attente)</h2><div class="card" id="rl">${L.length ? L.map(x => `<div class="row" data-r="${esc(x.id)}"><div class="t grow"><b>${esc(x.name || x.email)} → ${esc(PLAN_L(x.plan))}</b><small>${esc(x.email)} · ${esc(x.cname || (x.perso ? 'espace personnel' : '—'))} · ${esc(dt(x.at))}${x.msg ? ' · « ' + esc(x.msg.slice(0, 80)) + ' »' : ''}</small></div>
      <span class="pill ${x.status === 'attente' ? 'warn' : x.status === 'acceptee' ? 'ok' : 'bad'}">${esc({ attente: 'En attente', acceptee: 'Acceptée', refusee: 'Refusée' }[x.status] || x.status)}</span></div>`).join('') : '<div class="empty">Aucune demande</div>'}</div>`;
    $$('[data-r]', M).forEach(row => row.onclick = async () => {
      const x = L.find(i => i.id === row.dataset.r), o = orgOf(x.cid);
      const r = await modal(`Demande : ${PLAN_L(x.plan)}`, `<div class="kv"><span>Personne</span><b>${esc(x.name || '')} · ${esc(x.email)}</b><span>Téléphone</span><b>${esc(x.tel || '—')}</b><span>Espace</span><b>${esc(x.cname || '—')}</b><span>Pack actuel</span><b>${x.cid ? esc(PLAN_L(o.plan || 'enterprise')) : '—'}</b></div>${x.msg ? `<pre>${esc(x.msg)}</pre>` : ''}
        ${x.cid ? '<p class="muted">Accepter active ce pack sur cet espace (statut « Actif »).</p>' : '<p class="muted">Pas encore d\'espace : accepter crée un code pack pour cette personne (1 utilisation, valable 30 jours) et le lui envoie en annonce.</p>'}`,
        x.status === 'attente' ? [['Accepter', 'ok'], ['Refuser', 'no', 'bad'], ['Fermer', null, 'ghost']] : [['Supprimer', 'del', 'ghost'], ['Fermer', null, 'ghost']]);
      if (!r) return;
      try {
        if (r.v === 'ok') {
          let code = '';
          if (x.cid) await db.collection('companies').doc(x.cid).update({ plan: x.plan, planStatus: 'actif' });
          else code = await makeCode({ plan: x.plan, days: 0, maxUses: 1, validDays: 30, note: `Demande de ${x.email}` });
          await db.collection('packRequests').doc(x.id).update({ status: 'acceptee', doneAt: ts(), ...(code ? { code } : {}) });
          await db.collection('annonces').add({ target: x.uid, title: 'Pack accepté', text: x.cid ? `Votre demande « ${planOf(x.plan).l} » est acceptée : le pack est actif sur « ${x.cname || ''} ».`
            : `Votre demande « ${planOf(x.plan).l} » est acceptée. Votre code pack : ${code}\nEntrez-le à la création de votre espace (🎟 J'ai un code pack) ou dans Mon abonnement.`, at: ts(), by: auth.currentUser.uid }); }
        if (r.v === 'no') { await db.collection('packRequests').doc(x.id).update({ status: 'refusee', doneAt: ts() }); }
        if (r.v === 'del') await db.collection('packRequests').doc(x.id).delete();
        toast('Enregistré ✓'); draw(true);
      } catch (e) { fail(e); }
    });
  }

  // ---------- codes pack ----------
  const PREFIX = { basic: 'BAS', pro: 'PRO', business: 'BUS', enterprise: 'ENT' };
  async function makeCode({ plan, days, maxUses, validDays, note }) {
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => A[b % A.length]).join('');
    for (let i = 0; i < 5; i++) {
      const code = `${PREFIX[plan] || 'SIT'}-${rnd()}`, ref = db.collection('packCodes').doc(code);
      if ((await ref.get()).exists) continue;
      await ref.set({ plan, days: Math.max(0, +days || 0), maxUses: Math.max(1, +maxUses || 1), uses: 0, usedBy: [], status: 'valide', note: note || '',
        expiresAt: +validDays > 0 ? firebase.firestore.Timestamp.fromMillis(Date.now() + validDays * 864e5) : null, createdAt: ts(), by: auth.currentUser.uid });
      return code;
    }
    throw new Error('Impossible de créer un code unique, réessayez');
  }
  const codeTxt = (c) => `${PLAN_L(c.plan)} · ${c.days > 0 ? c.days + ' jours' : 'sans limite'} · ${c.uses || 0}/${c.maxUses} utilisation(s)`;
  const shareTxt = (c) => `Bonjour,\nVoici votre code pour SiteTeam : *${c.code}*\nPack : ${planOf(c.plan).l}${c.days > 0 ? ` pendant ${c.days} jours` : ''}.\n\n1️⃣ Installez SiteTeam\n2️⃣ Créez votre compte\n3️⃣ Au choix du pack : « 🎟 J'ai un code pack » (ou Mon abonnement › Code pack si votre espace existe déjà)`;
  function codes(M) {
    const L = [...D.codes].sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
    M.innerHTML = `<h2>Codes pack</h2>
      <div class="card"><p class="muted">Un code ouvre un pack à la personne qui l'entre (à la création de son espace ou dans « Mon abonnement »), sans passer par une demande.</p>
        <div class="cks"><label>Pack<select name="plan">${Object.values(PLANS).map(P => `<option value="${P.k}" ${P.k === 'pro' ? 'selected' : ''}>${esc(PLAN_L(P.k))}</option>`).join('')}</select></label>
        <label>Durée du pack (jours, 0 = sans limite)<input name="days" type="number" min="0" value="30"></label>
        <label>Nombre d'utilisations<input name="max" type="number" min="1" value="1"></label>
        <label>Code valable (jours, 0 = toujours)<input name="valid" type="number" min="0" value="30"></label></div>
        <label>Note (pour qui ?)<input name="note" placeholder="Ex : Bureau d'études Atlas — essai"></label>
        <div class="btns"><button class="btn" data-a="mk">Créer le code</button></div></div>
      <div class="card">${L.length ? L.map(c => `<div class="row" data-c="${esc(c.code)}"><div class="t grow"><b>${esc(c.code)}</b><small>${esc(codeTxt(c))}${c.note ? ' · ' + esc(c.note) : ''}${c.expiresAt ? ' · valable jusqu\'au ' + esc(dt(c.expiresAt)) : ''}</small></div>
        <span class="pill ${c.status !== 'valide' ? 'bad' : (c.uses || 0) >= c.maxUses ? '' : 'ok'}">${c.status !== 'valide' ? 'Annulé' : (c.uses || 0) >= c.maxUses ? 'Utilisé' : 'Valide'}</span></div>`).join('') : '<div class="empty">Aucun code</div>'}</div>`;
    const v = (n) => $(`[name=${n}]`, M).value;
    $('[data-a=mk]', M).onclick = async () => {
      try { const code = await makeCode({ plan: v('plan'), days: v('days'), maxUses: v('max'), validDays: v('valid'), note: v('note').trim() }); D.at = 0; await load(true); codes(M); codeCard(code); }
      catch (e) { fail(e); }
    };
    $$('[data-c]', M).forEach(r => r.onclick = () => codeCard(r.dataset.c));
  }
  async function codeCard(code) {
    const c = D.codes.find(x => x.code === code); if (!c) return;
    const who = (c.usedBy || []).map(u => userOf(u).email || u);
    const r = await modal(c.code, `<div class="kv"><span>Pack</span><b>${esc(codeTxt(c))}</b><span>Note</span><b>${esc(c.note || '—')}</b><span>Créé le</span><b>${esc(dt(c.createdAt))}</b><span>Utilisé par</span><b>${who.length ? who.map(esc).join('<br>') : '—'}</b></div>
      <label>Message à envoyer<textarea readonly>${esc(shareTxt(c))}</textarea></label>`,
      [['Copier le message', 'copy'], ['WhatsApp', 'wa', 'ghost'], ...(c.status === 'valide' ? [['Annuler le code', 'rev', 'bad']] : []), ['Fermer', null, 'ghost']]);
    if (!r) return;
    try {
      if (r.v === 'copy') { try { await navigator.clipboard.writeText(shareTxt(c)); toast('Message copié ✓'); } catch (e) { toast('Copie impossible : sélectionnez le texte'); } }
      if (r.v === 'wa') window.open('https://wa.me/?text=' + encodeURIComponent(shareTxt(c)), '_blank');
      if (r.v === 'rev') { await db.collection('packCodes').doc(c.code).update({ status: 'revoque' }); toast('Code annulé ✓'); draw(true); }
    } catch (e) { fail(e); }
  }

  function ctrl(M) {
    const C = D.cfg, A = C.app || {}, open = Array.isArray(C.services.open) ? C.services.open : SERVICES_OPEN, off = A.off || [];
    const svcs = TM_SERVICES.filter(s => s.k !== 'externe' && !SERVICES_LEGACY.includes(s.k));
    M.innerHTML = `<h2>Contrôle de l'application</h2>
      <div class="card"><h3>Packs ouverts au public</h3><p class="muted">Un pack fermé reste visible avec 🔒 « Sur demande ». Vous (Super Admin) les voyez et les choisissez tous.</p>
        <div class="cks">${Object.values(PLANS).map(P => `<label class="ck"><input type="checkbox" data-pk="${P.k}" ${P.k === 'basic' || (C.plans[P.k] || {}).open ? 'checked' : ''} ${P.k === 'basic' ? 'disabled' : ''}> ${esc(PLAN_L(P.k))}</label>`).join('')}</div>
        <div class="btns"><button class="btn" data-a="packs">Enregistrer</button></div></div>
      <div class="card"><h3>Services ouverts</h3><p class="muted">Un service fermé 🔒 n'est plus proposé ; ses membres existants continuent.</p>
        <div class="cks">${svcs.map(s => `<label class="ck"><input type="checkbox" data-sv="${s.k}" ${open.includes('*') || open.includes(s.k) ? 'checked' : ''}> ${esc(s.l)}</label>`).join('')}</div>
        <div class="btns"><button class="btn" data-a="svcs">Enregistrer</button></div></div>
      <div class="card"><h3>Fonctions coupées</h3><p class="muted">Cachées pour tout le monde (sauf vous), sans effacer les données.</p>
        <div class="cks">${MODS.filter(([k]) => k !== 'projet').map(([k, l]) => `<label class="ck"><input type="checkbox" data-off="${k}" ${off.includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>
        <div class="btns"><button class="btn" data-a="off">Enregistrer</button></div></div>
      <div class="card"><h3>Version et maintenance</h3>
        <label>Version minimale (X.Y.Z) — en dessous, l'application demande la mise à jour<input name="minv" value="${esc(A.minVersion || '')}" placeholder="Ex : 1.0.24" inputmode="decimal"></label>
        <label class="ck"><input type="checkbox" name="mon" ${A.maintenance && A.maintenance.on ? 'checked' : ''}> Mode maintenance (application fermée pour tous, sauf vous)</label>
        <label>Texte de maintenance<input name="mtext" value="${esc((A.maintenance || {}).text || '')}" placeholder="SiteTeam est en maintenance. Revenez dans quelques minutes."></label>
        <div class="btns"><button class="btn" data-a="ver">Enregistrer</button></div></div>
      <div class="card"><h3>Message sur l'accueil</h3>
        <label class="ck"><input type="checkbox" name="gon" ${A.message && A.message.on ? 'checked' : ''}> Afficher le message</label>
        <label>Niveau<select name="glev"><option value="info">Information</option><option value="alerte" ${(A.message || {}).level === 'alerte' ? 'selected' : ''}>Alerte</option></select></label>
        <label>Texte<textarea name="gtext" placeholder="Ex : Nouvelle version disponible…">${esc((A.message || {}).text || '')}</textarea></label>
        <div class="btns"><button class="btn" data-a="msg">Enregistrer</button></div></div>
      <div class="card"><h3>Fichiers partagés (Cloud Storage)</h3>
        <label class="ck"><input type="checkbox" name="son" ${C.services.storage ? 'checked' : ''}> Envoi des fichiers activé (formule Blaze, alerte de budget et règles Storage en place)</label>
        <label>Taille maximale par fichier (Mo)<input name="smax" type="number" min="1" max="50" value="${esc(C.services.maxMb || 50)}"></label>
        <div class="btns"><button class="btn" data-a="sto">Enregistrer</button></div></div>`;
    const val = (n) => $(`[name=${n}]`, M), save = async (doc, data, msg) => { try { await db.collection('config').doc(doc).set(data, { merge: true }); toast(msg || 'Enregistré ✓'); D.at = 0; } catch (e) { fail(e); } };
    $('[data-a=packs]', M).onclick = () => save('plans', Object.fromEntries($$('[data-pk]', M).filter(x => x.dataset.pk !== 'basic').map(x => [x.dataset.pk, { open: x.checked }])), 'Packs enregistrés ✓');
    $('[data-a=svcs]', M).onclick = () => save('services', { open: [...new Set(['direction', 'externe', 'perso', ...$$('[data-sv]', M).filter(x => x.checked).map(x => x.dataset.sv)])] }, 'Services enregistrés ✓');
    $('[data-a=off]', M).onclick = () => save('app', { off: $$('[data-off]', M).filter(x => x.checked).map(x => x.dataset.off) }, 'Fonctions enregistrées ✓');
    $('[data-a=ver]', M).onclick = () => { const v = val('minv').value.trim(); if (v && !/^\d+\.\d+\.\d+$/.test(v)) return toast('Version au format X.Y.Z (ex : 1.0.24)');
      save('app', { minVersion: v, maintenance: { on: val('mon').checked, text: val('mtext').value.trim() } }); };
    $('[data-a=msg]', M).onclick = () => save('app', { message: { on: val('gon').checked, level: val('glev').value, text: val('gtext').value.trim(), id: String(Date.now()) } });
    $('[data-a=sto]', M).onclick = () => save('services', { storage: val('son').checked, maxMb: Math.min(50, Math.max(1, +val('smax').value || 50)) });
  }

  async function annForm(pre = {}) {
    const r = await modal('Nouvelle annonce', `${pre.label ? `<p class="muted">Pour : <b>${esc(pre.label)}</b></p>` : `<label>Destinataires<select name="to"><option value="all">Tout le monde</option>${D.orgs.filter(o => o.kind !== 'perso').map(o => `<option value="org:${esc(o.id)}">Organisation : ${esc(o.name || o.id)}</option>`).join('')}</select></label>`}
      <label>Titre<input name="title" placeholder="Ex : Nouvelle version 1.0.24"></label><label>Texte<textarea name="text" placeholder="Le message qui s'affiche dans l'application et en notification."></textarea></label>`, [['Envoyer', 'send'], ['Annuler', null, 'ghost']]);
    if (!r || !r.text) return;
    const to = pre.cid ? 'org:' + pre.cid : pre.target || r.to || 'all', doc = { title: r.title || 'SiteTeam', text: r.text, at: ts(), by: auth.currentUser.uid };
    try {
      if (to.startsWith('org:')) await db.collection('companies').doc(to.slice(4)).collection('annonces').add({ ...doc, target: to.slice(4) });
      else await db.collection('annonces').add({ ...doc, target: to });
      toast('Annonce envoyée ✓'); D.at = 0; if (tab === 'ann') draw(true);
    } catch (e) { fail(e); }
  }
  function ann(M) {
    const L = [...D.annonces].sort((a, b) => ms(b.at) - ms(a.at));
    M.innerHTML = `<h2>Annonces</h2><div class="card"><p class="muted">Elles s'affichent dans l'application (et en notification sur le téléphone) à la prochaine ouverture.</p><div class="btns"><button class="btn" data-a="new">Nouvelle annonce</button></div></div>
      <div class="card">${L.length ? L.map(x => `<div class="row" data-n="${esc(x.id)}"><div class="t grow"><b>${esc(x.title || 'SiteTeam')}</b><small>${x.target === 'all' ? 'Tout le monde' : esc(userOf(x.target).email || x.target)} · ${esc(dt(x.at))} · ${esc((x.text || '').slice(0, 90))}</small></div><span class="pill">Supprimer</span></div>`).join('') : '<div class="empty">Aucune annonce générale</div>'}</div>`;
    $('[data-a=new]', M).onclick = () => annForm();
    $$('[data-n]', M).forEach(r => r.onclick = async () => { if (!(await modal('Supprimer l\'annonce ?', '<p>Elle ne s\'affichera plus pour ceux qui ne l\'ont pas encore vue.</p>', [['Supprimer', 'ok', 'bad'], ['Annuler', null, 'ghost']]))) return;
      try { await db.collection('annonces').doc(r.dataset.n).delete(); toast('Supprimée ✓'); draw(true); } catch (e) { fail(e); } });
  }

  function err(M) {
    const G = {}; D.errors.forEach(e => { const g = G[e.msg] || (G[e.msg] = { msg: e.msg, n: 0, vers: new Set(), users: new Set(), last: 0, src: e.src, stack: e.stack }); g.n++; if (e.ver) g.vers.add(e.ver); g.users.add(e.uid); g.last = Math.max(g.last, ms(e.at)); });
    const L = Object.values(G).sort((a, b) => b.last - a.last);
    M.innerHTML = `<h2>Erreurs de l'application (${D.errors.length})</h2><div class="card"><p class="muted">Envoyées automatiquement par les téléphones (message, fichier, version — sans données de chantier).</p>
      ${D.errors.length ? '<div class="btns"><button class="btn ghost" data-a="clear">Tout effacer</button></div>' : ''}</div>
      <div class="card">${L.length ? L.map((g, i) => `<div class="row" data-g="${i}"><div class="t grow"><b>${esc(g.msg)}</b><small>${g.n} fois · ${g.users.size} personne(s) · ${esc([...g.vers].join(', ') || '—')} · ${esc(ago(g.last))}</small></div></div>`).join('') : '<div class="empty">Aucune erreur 🎉</div>'}</div>`;
    $$('[data-g]', M).forEach(r => r.onclick = () => { const g = L[+r.dataset.g]; modal('Erreur', `<pre>${esc(g.msg)}\n\n${esc(g.src || '')}\n${esc(g.stack || '')}</pre>`); });
    const c = $('[data-a=clear]', M); if (c) c.onclick = async () => { if (!(await modal('Effacer les erreurs ?', `<p>${D.errors.length} erreur(s) seront effacées.</p>`, [['Effacer', 'ok', 'bad'], ['Annuler', null, 'ghost']]))) return;
      try { for (let i = 0; i < D.errors.length; i += 400) { const b = db.batch(); D.errors.slice(i, i + 400).forEach(e => b.delete(db.collection('errors').doc(e.id))); await b.commit(); } toast('Effacées ✓'); draw(true); } catch (e) { fail(e); } };
  }

  // ---------- connexion ----------
  function login(msg) {
    app.innerHTML = `<form class="login" id="lg"><b style="font-size:20px">🛡 SiteTeam Admin</b><p class="muted">Réservé au Super Admin.</p>${msg ? `<p class="pill bad" style="white-space:normal">${esc(msg)}</p>` : ''}
      <label>E-mail<input id="lg-email" name="email" type="email" autocomplete="username" required></label><label>Mot de passe<input id="lg-pw" name="pw" type="password" autocomplete="current-password" required></label>
      <button class="btn" type="submit">Se connecter</button><a class="muted" href="index.html${emu ? '?emu=1' : ''}">← Retour à l'application</a></form>`;
    $('#lg').onsubmit = async (e) => { e.preventDefault(); try { await auth.signInWithEmailAndPassword($('#lg-email').value.trim(), $('#lg-pw').value); } catch (x) { login('Connexion impossible : ' + (x.code || x.message)); } };
  }
  auth.onAuthStateChanged((u) => {
    if (!u) return login();
    if ((u.email || '').toLowerCase() !== SUPER) { app.innerHTML = `<div class="login"><b>Accès réservé</b><p class="muted">Ce panneau est réservé au Super Admin SiteTeam (${esc(u.email || '')}).</p><button class="btn ghost" id="lo">Se déconnecter</button><a class="muted" href="index.html${emu ? '?emu=1' : ''}">← Retour à l'application</a></div>`; $('#lo').onclick = () => auth.signOut(); return; }
    shell(u);
  });
  window.__admin = { load, D };
})();
