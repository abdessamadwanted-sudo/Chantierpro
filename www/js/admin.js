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
    const lg = await db.collection('adminLog').orderBy('at', 'desc').limit(200).get().catch(() => ({ docs: [] }));
    D.log = lg.docs.map(d => ({ id: d.id, ...d.data() }));
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
  const TABS = [['dash', 'Tableau de bord'], ['acces', 'Centre de contrôle'], ['packs', 'Packs & fonctions'], ['users', 'Utilisateurs'], ['orgs', 'Organisations'], ['reqs', 'Demandes'], ['codes', 'Codes pack'], ['ctrl', 'Contrôle de l\'app'], ['ann', 'Annonces'], ['err', 'Erreurs']];
  let tab = (location.hash || '').slice(1).split('/')[0]; if (!TABS.some(t => t[0] === tab)) tab = 'dash';
  function shell(user) {
    app.innerHTML = `<header><div class="hd"><div class="grow"><b>🛡 SiteTeam Admin</b><br><small>${esc(user.email)}</small></div>
        <button class="btn ghost" data-a="reload" title="Actualiser">↻</button><a class="btn ghost" href="index.html${emu ? '?emu=1' : ''}">Application</a><button class="btn ghost" data-a="out">Sortir</button></div>
      <nav>${TABS.map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</nav></header><main id="main"><div class="empty">Chargement…</div></main>`;
    $('[data-a=out]').onclick = () => auth.signOut();
    $('[data-a=reload]').onclick = () => draw(true);
    $$('nav [data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; location.hash = tab; $$('nav [data-t]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
    draw();
  }
  // lien direct vers un onglet (admin.html#codes) : suivi aussi quand l'adresse change sans recharger
  window.addEventListener('hashchange', () => { const t = (location.hash || '').slice(1).split('/')[0]; if (t === 'acces' && tab === 'acces') return draw(); if (t !== tab && TABS.some(x => x[0] === t)) { tab = t; $$('nav [data-t]').forEach(x => x.classList.toggle('on', x.dataset.t === t)); draw(); } });
  async function draw(force) {
    const M = $('#main'); if (!M) return;
    try { await load(force); } catch (e) { M.innerHTML = `<div class="card"><b>Impossible de charger les données</b><p class="muted">${esc(e.code === 'permission-denied' ? 'Accès refusé : publiez les dernières règles Firestore (application › Réglages › Copier les règles).' : (e.message || e))}</p></div>`; return; }
    ({ dash, acces, packs, users, orgs, reqs, codes, ctrl, ann, err })[tab](M);
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

  // ---------- v1.0.53 : Centre de contrôle — accès des espaces personnels et des membres, avec durée ; historique ----------
  const DAY = 864e5;
  // journal du Super Admin : qui a fait quoi, sur qui, quand (lecture et écriture réservées au Super Admin)
  const logA = (action, target, detail = '') => db.collection('adminLog').add({ at: ts(), by: (auth.currentUser || {}).email || '', action, target: target || '', detail: String(detail || '').slice(0, 300) }).catch(e => console.warn('journal', e));
  const untilOf = (x, k) => ms(x && x[k]);
  const left = (u) => { if (!u) return '<span class="pill ok">Illimité</span>'; const d = Math.ceil((u - Date.now()) / DAY); return d <= 0 ? `<span class="pill bad">Expiré le ${esc(new Date(u).toLocaleDateString('fr-FR'))}</span>` : `<span class="pill ${d <= 7 ? 'warn' : 'ok'}">Reste ${d} j · ${esc(new Date(u).toLocaleDateString('fr-FR'))}</span>`; };
  const DUR = [['7', '7 j'], ['30', '1 mois'], ['90', '3 mois'], ['365', '1 an'], ['inf', 'Illimité'], ['stop', 'Arrêter']];
  const durBtns = (key) => `<div class="cc-d">${DUR.map(([k, l]) => `<button class="btn ${k === 'stop' ? 'bad' : 'ghost'}" data-dur="${k}" data-k="${esc(key)}">${l}</button>`).join('')}</div>`;
  // à partir de la date de fin actuelle si elle est encore à venir (prolonger), sinon d'aujourd'hui
  const newUntil = (k, cur) => k === 'inf' ? null : k === 'stop' ? Date.now() : Math.max(Date.now(), cur || 0) + (+k) * DAY;
  const permTxt = (m) => { const P = m.perms || {}; const L = MODS.filter(([k]) => (P[k] || 0) > 0).map(([k, l]) => `${l.split(' (')[0]} : ${LEVELS[P[k]] || P[k]}`); return L.length ? L.join(' · ') : 'aucun droit'; };
  const projTxt = (m) => m.allProjects ? 'Tous les projets' : ((m.projects || []).map(id => (D.projects.find(p => p.id === id && p.cid === m.cid) || {}).name).filter(Boolean).join(', ') || 'aucun projet');
  function acces(M) {
    const perso = D.orgs.filter(o => o.kind === 'perso'), now = Date.now();
    const mems = D.members.filter(m => { const o = orgOf(m.cid); return o.kind !== 'perso' && o.ownerUid !== m.uid; });
    const soon = [...perso.filter(o => o.allowed && untilOf(o, 'accessUntil')), ...mems.filter(m => untilOf(m, 'until'))].filter(x => { const u = untilOf(x, 'accessUntil') || untilOf(x, 'until'); return u > now && u - now < 7 * DAY; }).length;
    const sub = (location.hash.split('/')[1] || 'perso');
    M.innerHTML = `<h2>Centre de contrôle</h2>
      <div class="tiles"><div class="tile"><b>${perso.filter(o => o.allowed && (!untilOf(o, 'accessUntil') || untilOf(o, 'accessUntil') > now)).length}</b><small>Espaces perso actifs</small></div>
        <div class="tile"><b>${mems.length}</b><small>Membres d'organisations</small></div><div class="tile"><b>${soon}</b><small>Accès qui finissent dans 7 j</small></div>
        <div class="tile"><b>${D.cfg.app.inviteOnly ? 'Oui' : 'Non'}</b><small>Accès sur code uniquement</small></div></div>
      <nav class="cc-tabs">${[['perso', '👤 Espaces personnels'], ['mem', '👥 Membres et projets'], ['hist', '🕘 Historique']].map(([k, l]) => `<button data-cc="${k}" class="${sub === k ? 'on' : ''}">${l}</button>`).join('')}</nav>
      <div class="card" id="cc"><input id="q-cc" type="search" placeholder="Rechercher : nom, e-mail, organisation…"><div id="ccl"></div></div>`;
    $$('[data-cc]', M).forEach(b => b.onclick = () => { location.hash = 'acces/' + b.dataset.cc; });
    const q = () => ($('#q-cc').value || '').toLowerCase();
    const draw1 = () => {
      const box = $('#ccl');
      if (sub === 'perso') {
        const L = perso.filter(o => { const u = userOf(o.ownerUid); return !q() || `${o.name} ${u.email || ''} ${u.name || ''}`.toLowerCase().includes(q()); })
          .sort((a, b) => (b.allowed ? 1 : 0) - (a.allowed ? 1 : 0) || ms(b.createdAt) - ms(a.createdAt));
        // v1.0.55 : comptes inscrits sans aucun espace (accès sur code uniquement) : le Super Admin leur crée leur espace personnel, avec une durée
        const noSpace = D.users.filter(u => !D.members.some(m => m.uid === u.uid) && !u.blocked && (!q() || `${u.name || ''} ${u.email || ''}`.toLowerCase().includes(q()))).sort((a, b) => ms(b.lastSeen) - ms(a.lastSeen));
        const nsHTML = noSpace.length ? `<h3 class="cc-o">🆕 Inscrits sans espace <small>${noSpace.length} — touchez une durée pour créer leur espace personnel</small></h3>` + noSpace.map(u => `<div class="cc-r"><div class="t grow"><b>${esc(u.name || u.email || u.uid)}</b><small>${esc(u.email || '—')} · inscrit ${esc(ago(u.lastSeen))}</small><div><span class="pill warn">Sans espace</span></div></div>${durBtns('n:' + u.uid).replace(/<button class="btn bad"[^>]*>Arrêter<\/button>/, '')}</div>`).join('') + '<h3 class="cc-o">👤 Espaces personnels</h3>' : '';
        box.innerHTML = `<p class="muted">Donnez l'accès à un espace personnel pour une durée : il se ferme tout seul à la date de fin (écran « Accès expiré »). Prolonger part de la date de fin actuelle.</p>` + nsHTML + (L.map(o => { const u = userOf(o.ownerUid), un = untilOf(o, 'accessUntil');
          return `<div class="cc-r"><div class="t grow"><b>${esc(u.name || o.name || o.id)}</b><small>${esc(u.email || '—')} · ${esc(o.name || '')} · vu ${esc(ago(u.lastSeen))}</small><div>${o.allowed ? left(un) : '<span class="pill">Non autorisé</span>'}${o.planStatus === 'suspendu' ? ' <span class="pill bad">Suspendu</span>' : ''}</div></div>
            ${durBtns('o:' + o.id)}${u.email ? `<button class="btn ghost cc-wa" data-wa="${esc(o.id)}">WhatsApp</button>` : ''}</div>`; }).join('') || '<div class="empty">Aucun espace personnel</div>');
      } else if (sub === 'mem') {
        const byOrg = {}; mems.filter(m => !q() || `${m.name || ''} ${m.email || ''} ${orgOf(m.cid).name || ''}`.toLowerCase().includes(q())).forEach(m => (byOrg[m.cid] = byOrg[m.cid] || []).push(m));
        box.innerHTML = `<p class="muted">Ce que chaque membre voit et fait (droits par service) et sur quels projets. Les droits se modifient dans l'application : Équipe › la personne › « Poste, projets et droits ». Ici : la durée d'accès.</p>` + (Object.entries(byOrg).map(([cid, L]) => `<h3 class="cc-o">${esc(orgOf(cid).name || cid)} <small>${L.length} membre(s)</small></h3>` + L.map(m => `<div class="cc-r"><div class="t grow"><b>${esc(m.name || m.email || m.uid)}${m.admin ? ' <span class="pill acc">admin</span>' : ''}</b><small>${esc(m.email || '')} · ${esc(tmRoleOf(m.role).l)}</small>
            <small>📁 ${esc(projTxt(m))}</small><small>🔑 ${esc(permTxt(m))}</small><div>${left(untilOf(m, 'until'))}</div></div>${m.admin ? '<small class="muted">Administrateur : accès sans fin</small>' : durBtns('m:' + cid + ':' + m.uid)}</div>`).join('')).join('') || '<div class="empty">Aucun membre</div>');
      } else {
        const seen = D.users.filter(u => ms(u.lastSeen)).sort((a, b) => ms(b.lastSeen) - ms(a.lastSeen)).slice(0, 40);
        box.innerHTML = `<h3>Actions du Super Admin</h3>${(D.log || []).filter(x => !q() || JSON.stringify(x).toLowerCase().includes(q())).map(x => `<div class="row"><div class="t grow"><b>${esc(x.action)}</b><small>${esc(x.target)}${x.detail ? ' · ' + esc(x.detail) : ''}</small></div><span class="pill">${esc(dt(x.at))}</span></div>`).join('') || '<div class="empty">Rien pour l\'instant</div>'}
          <h3 style="margin-top:14px">Dernières ouvertures de l'application</h3>${seen.filter(u => !q() || `${u.name || ''} ${u.email || ''}`.toLowerCase().includes(q())).map(u => `<div class="row"><div class="t grow"><b>${esc(u.name || u.email || u.uid)}</b><small>${esc(u.email || '')} · ${esc(u.appVersion || '—')}</small></div><span class="pill">${esc(ago(u.lastSeen))}</span></div>`).join('')}`;
      }
      $$('[data-dur]', box).forEach(b => b.onclick = async () => {
        const [kind, a, c] = b.dataset.k.split(':'), k = b.dataset.dur, lbl = DUR.find(x => x[0] === k)[1];
        try {
          if (kind === 'n') { const u = userOf(a), nu = newUntil(k, 0), nm = (u.name || (u.email || '').split('@')[0] || 'moi').trim();
            if (!(await modal('Créer son espace ?', `<p>Un espace personnel est créé pour <b>${esc(u.email || nm)}</b>, ouvert ${nu ? 'jusqu\'au ' + esc(new Date(nu).toLocaleDateString('fr-FR')) : 'sans limite'}.<br>La personne ferme puis rouvre l'application : elle arrive dans son espace.</p>`, [['Créer', 'ok'], ['Annuler', null, 'ghost']]))) return;
            const ref = db.collection('companies').doc();
            await ref.set({ name: `Espace de ${nm}`, ownerUid: a, plan: 'basic', planStatus: 'gratuit', kind: 'perso', orgType: 'independant', services: [], allowed: true, createdAt: ts(), ...(nu ? { accessUntil: firebase.firestore.Timestamp.fromMillis(nu) } : {}) });
            await ref.collection('members').doc(a).set({ name: nm, email: u.email || '', role: ROLE_PROPRIO.k, service: 'perso', perms: Object.fromEntries(MODS.map(([m]) => [m, 4])), admin: true, allProjects: true, projects: [], managerUid: null, zone: '', createdAt: ts() });
            await db.collection('users').doc(a).update({ companyId: ref.id, workspaces: [{ cid: ref.id, name: `Espace de ${nm}`, kind: 'perso', org: 'independant', role: ROLE_PROPRIO.k, plan: 'basic' }] });
            logA('Espace personnel créé', u.email || nm, nu ? `${lbl} → ${new Date(nu).toLocaleDateString('fr-FR')}` : 'illimité');
          } else if (kind === 'o') { const o = orgOf(a), u = userOf(o.ownerUid), nu = newUntil(k, untilOf(o, 'accessUntil'));
            if (k === 'stop' && !(await modal('Arrêter l\'accès ?', `<p>${esc(u.email || o.name)} n'ouvrira plus son espace (ses données restent).</p>`, [['Arrêter', 'ok', 'bad'], ['Annuler', null, 'ghost']]))) return;
            await db.collection('companies').doc(a).update({ allowed: true, accessUntil: nu ? firebase.firestore.Timestamp.fromMillis(nu) : firebase.firestore.FieldValue.delete() });
            logA(k === 'stop' ? 'Accès arrêté' : 'Accès espace personnel', u.email || o.name, k === 'stop' ? '' : nu ? `${lbl} → ${new Date(nu).toLocaleDateString('fr-FR')}` : 'illimité');
          } else { const m = D.members.find(x => x.cid === a && x.uid === c), nu = newUntil(k, untilOf(m, 'until'));
            await db.collection('companies').doc(a).collection('members').doc(c).update({ until: nu ? firebase.firestore.Timestamp.fromMillis(nu) : firebase.firestore.FieldValue.delete() });
            logA(k === 'stop' ? 'Accès membre arrêté' : 'Accès membre', `${m.email || m.name} · ${orgOf(a).name || a}`, k === 'stop' ? '' : nu ? `${lbl} → ${new Date(nu).toLocaleDateString('fr-FR')}` : 'illimité'); }
          toast(k === 'stop' ? 'Accès arrêté ✓' : `Accès : ${lbl} ✓`); await draw(true);
        } catch (e) { fail(e); } });
      $$('[data-wa]', box).forEach(b => b.onclick = () => { const o = orgOf(b.dataset.wa), u = userOf(o.ownerUid), un = untilOf(o, 'accessUntil');
        const txt = `Bonjour ${u.name || ''},\nVotre accès à SiteTeam est ${o.allowed && (!un || un > Date.now()) ? 'activé' + (un ? ` jusqu'au ${new Date(un).toLocaleDateString('fr-FR')}` : '') : 'arrêté'}.\nOuvrez l'application avec ${u.email || 'votre e-mail'}.`;
        window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank'); });
    };
    $('#q-cc').oninput = draw1; draw1();
  }
  // ---------- v1.0.57 : Packs & fonctions — ce que chaque pack ouvre (outils, fonctions premium, essai gratuit) ----------
  const PK = () => Object.values(PLANS).map(P => ({ ...P, ...((D.cfg.plans || {})[P.k] || {}), k: P.k }));
  const featsOf = (P) => P.feats == null || P.feats === '*' ? PREMIUM.map(x => x[0]) : P.feats;
  const modsOf = (P) => P.modules === '*' ? MODS.map(x => x[0]) : (P.modules || []);
  function packs(M) {
    const L = PK();
    const head = `<tr><th></th>${L.map(P => `<th>${esc(P.e || '')}<br>${esc(P.l)}</th>`).join('')}</tr>`;
    const row = (kind, k, l) => `<tr><td>${esc(l)}</td>${L.map(P => `<td><input type="checkbox" data-${kind}="${P.k}|${k}" ${(kind === 'f' ? featsOf(P) : modsOf(P)).includes(k) ? 'checked' : ''}></td>`).join('')}</tr>`;
    M.innerHTML = `<h2>Packs & fonctions</h2>
      <div class="card pk-help"><b>Comment ça marche</b>
        <ol><li><b>Cochez</b> ce que chaque pack ouvre. Ce qui n'est pas coché apparaît avec un 🔒 et un bouton « Demander un pack ».</li>
        <li><b>Essai gratuit</b> : pendant N jours après la création de l'espace, toutes les fonctions premium sont ouvertes, puis elles se ferment seules.</li>
        <li><b>Un espace en particulier</b> (offrir une fonction, ajouter ou retirer un outil) : onglet <b>Organisations</b> › l'espace › « Pour cet espace ».</li></ol>
        <p class="muted">Vous (Super Admin) voyez toujours tout. Les changements arrivent à la prochaine ouverture de l'application.</p></div>
      <div class="card"><h3>⭐ Fonctions premium</h3><div class="pk-t"><table>${head}${PREMIUM.map(([k, l]) => row('f', k, l)).join('')}
        <tr class="pk-trial"><td>🎁 Essai gratuit (jours)</td>${L.map(P => `<td><input type="number" min="0" max="365" inputmode="numeric" data-tr="${P.k}" value="${+P.featTrial || 0}"></td>`).join('')}</tr></table></div></div>
      <div class="card"><h3>🧰 Outils de chaque pack</h3><div class="pk-t"><table>${head}${MODS.filter(([k]) => k !== 'projet').map(([k, l]) => row('m', k, l.split(' (')[0])).join('')}</table></div></div>
      <div class="btns pk-save"><button class="btn" data-a="pksave">Enregistrer</button><span class="muted">Basic sans essai et Pro avec 14 jours, par exemple.</span></div>`;
    $('[data-a=pksave]', M).onclick = async () => {
      const out = {};
      for (const P of L) {
        const f = $$(`[data-f^="${P.k}|"]`, M).filter(x => x.checked).map(x => x.dataset.f.split('|')[1]);
        const m = $$(`[data-m^="${P.k}|"]`, M).filter(x => x.checked).map(x => x.dataset.m.split('|')[1]);
        const allM = m.length >= MODS.length - 1;
        out[P.k] = { feats: f.length === PREMIUM.length ? '*' : f, featTrial: Math.max(0, Math.min(365, +($(`[data-tr="${P.k}"]`, M).value) || 0)), modules: allM ? '*' : ['projet', ...m] };
      }
      try { await db.collection('config').doc('plans').set(out, { merge: true }); logA('Packs & fonctions', 'tous les packs', Object.entries(out).map(([k, v]) => `${k}: ${v.feats === '*' ? 'tout' : v.feats.length + ' fonction(s)'}${v.featTrial ? ', essai ' + v.featTrial + ' j' : ''}`).join(' · ')); toast('Enregistré ✓'); await draw(true); } catch (e) { fail(e); }
    };
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
        toast(r.v === 'block' ? 'Compte bloqué ✓' : 'Compte débloqué ✓'); logA(r.v === 'block' ? 'Compte bloqué' : 'Compte débloqué', u.email || uid, r.why || ''); draw(true);
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
      ${o.kind === 'perso' ? `<label class="ck"><input type="checkbox" name="allow" ${o.allowed ? 'checked' : ''}> Autoriser cet espace personnel (même en « accès sur code uniquement »)</label>` : ''}
      <details class="pk-org"><summary>🎛 Pour cet espace : fonctions offertes et outils</summary>
        <p class="muted">Au-dessus du pack. Fonction offerte : ouverte jusqu'à la date choisie.</p>
        ${PREMIUM.map(([k, l]) => { const g = (o.featGrant || {})[k], u = ms(g); return `<label class="pk-l"><span>${esc(l)}</span><select name="fg_${k}"><option value="">Selon le pack</option>${[['7', '7 jours'], ['30', '1 mois'], ['90', '3 mois'], ['365', '1 an'], ['inf', 'Toujours']].map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}${g === true ? '<option value="keep" selected>Toujours (déjà offert)</option>' : u > Date.now() ? `<option value="keep" selected>Offert jusqu'au ${new Date(u).toLocaleDateString('fr-FR')}</option>` : ''}</select></label>`; }).join('')}
        <p class="muted" style="margin-top:10px">Outils :</p>
        ${MODS.filter(([k]) => k !== 'projet').map(([k, l]) => `<label class="pk-l"><span>${esc(l.split(' (')[0])}</span><select name="md_${k}"><option value="">Selon le pack</option><option value="on" ${(o.modsOn || []).includes(k) ? 'selected' : ''}>Oui</option><option value="off" ${(o.modsOff || []).includes(k) ? 'selected' : ''}>Non</option></select></label>`).join('')}
      </details>
      <h3 style="margin-top:6px">Membres (${mem.length})</h3>${mem.map(m => `<div class="row"><div class="t grow"><b>${esc(m.name || m.email || m.uid)}</b><small>${esc(m.email || '')} · ${esc(tmRoleOf(m.role).l)}${m.admin ? ' · admin' : ''}</small></div></div>`).join('') || '<div class="empty">Aucun</div>'}`,
      [['Enregistrer', 'save'], ['Annonce à l\'organisation', 'ann', 'ghost'], ['Fermer', null, 'ghost']]);
    if (!r) return;
    try {
      if (r.v === 'save') {
        if (r.st === 'suspendu' && o.planStatus !== 'suspendu' && !(await modal('Suspendre ?', `<p>« ${esc(o.name)} » n'aura plus accès à ses projets et fichiers. Rien n'est effacé ; vous pourrez rétablir l'accès.</p>`, [['Suspendre', 'ok', 'bad'], ['Annuler', null, 'ghost']]))) return;
        const extra = r.st === 'essai' ? { trialEndsAt: firebase.firestore.Timestamp.fromMillis(Date.now() + 14 * 864e5) } : {};
        if (o.kind === 'perso') extra.allowed = !!r.allow;
        // v1.0.57 : fonctions offertes et outils de cet espace
        const fg = {}; for (const [k] of PREMIUM) { const v = r['fg_' + k]; if (v === 'keep') fg[k] = (o.featGrant || {})[k]; else if (v === 'inf') fg[k] = true; else if (v) fg[k] = firebase.firestore.Timestamp.fromMillis(Date.now() + (+v) * 864e5); }
        extra.featGrant = fg; extra.modsOn = MODS.map(x => x[0]).filter(k => r['md_' + k] === 'on'); extra.modsOff = MODS.map(x => x[0]).filter(k => r['md_' + k] === 'off');
        await db.collection('companies').doc(cid).update({ plan: r.plan, planStatus: r.st, ...extra }); toast('Enregistré ✓'); logA('Organisation modifiée', o.name || cid, `${r.plan} · ${r.st}${o.kind === 'perso' ? (r.allow ? ' · autorisé' : ' · non autorisé') : ''}`); draw(true);
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
      <div class="card"><h3>🔑 Accès sur code uniquement</h3><p class="muted">Activé : une personne qui installe l'application ne peut rien faire sans un code d'accès que vous lui donnez (Équipe › Codes d'accès). Les espaces personnels sont bloqués, sauf ceux que vous autorisez (Organisations › ouvrir › « Autoriser »). Pour arrêter quelqu'un : retirez-le de l'organisation, révoquez son code ou bloquez son compte.</p>
        <label class="ck"><input type="checkbox" name="inv" ${A.inviteOnly ? 'checked' : ''}> Accès sur code uniquement</label>
        <div class="btns"><button class="btn" data-a="inv">Enregistrer</button></div></div>
      <div class="card"><h3>Version et maintenance</h3>
        <label>Version minimale (X.Y.Z) — en dessous, l'application demande la mise à jour<input name="minv" value="${esc(A.minVersion || '')}" placeholder="Ex : 1.0.24" inputmode="decimal"></label>
        <label class="ck"><input type="checkbox" name="mon" ${A.maintenance && A.maintenance.on ? 'checked' : ''}> Mode maintenance (application fermée pour tous, sauf vous)</label>
        <label>Texte de maintenance<input name="mtext" value="${esc((A.maintenance || {}).text || '')}" placeholder="SiteTeam est en maintenance. Revenez dans quelques minutes."></label>
        <div class="btns"><button class="btn" data-a="ver">Enregistrer</button></div></div>
      <div class="card"><h3>Anti-capture d'écran</h3><p class="muted">Interdit les captures et l'enregistrement d'écran dans l'application Android, pour toutes les organisations (chaque organisation peut aussi l'activer pour elle-même).</p>
        <label class="ck"><input type="checkbox" name="secall" ${A.secureAll ? 'checked' : ''}> Imposer l'anti-capture à tous</label>
        <div class="btns"><button class="btn" data-a="sec">Enregistrer</button></div></div>
      <div class="card"><h3>Message sur l'accueil</h3>
        <label class="ck"><input type="checkbox" name="gon" ${A.message && A.message.on ? 'checked' : ''}> Afficher le message</label>
        <label>Niveau<select name="glev"><option value="info">Information</option><option value="alerte" ${(A.message || {}).level === 'alerte' ? 'selected' : ''}>Alerte</option></select></label>
        <label>Texte<textarea name="gtext" placeholder="Ex : Nouvelle version disponible…">${esc((A.message || {}).text || '')}</textarea></label>
        <div class="btns"><button class="btn" data-a="msg">Enregistrer</button></div></div>
      <div class="card"><h3>Fichiers partagés (Cloud Storage)</h3>
        <label class="ck"><input type="checkbox" name="son" ${C.services.storage ? 'checked' : ''}> Envoi des fichiers activé (formule Blaze, alerte de budget et règles Storage en place)</label>
        <label>Taille maximale par fichier (Mo)<input name="smax" type="number" min="1" max="50" value="${esc(C.services.maxMb || 50)}"></label>
        <div class="btns"><button class="btn" data-a="sto">Enregistrer</button></div></div>`;
    const val = (n) => $(`[name=${n}]`, M), save = async (doc, data, msg) => { try { await db.collection('config').doc(doc).set(data, { merge: true }); toast(msg || 'Enregistré ✓'); logA('Contrôle de l\'app', doc, msg || Object.keys(data).join(', ')); D.at = 0; } catch (e) { fail(e); } };
    $('[data-a=packs]', M).onclick = () => save('plans', Object.fromEntries($$('[data-pk]', M).filter(x => x.dataset.pk !== 'basic').map(x => [x.dataset.pk, { open: x.checked }])), 'Packs enregistrés ✓');
    $('[data-a=svcs]', M).onclick = () => save('services', { open: [...new Set(['direction', 'externe', 'perso', ...$$('[data-sv]', M).filter(x => x.checked).map(x => x.dataset.sv)])] }, 'Services enregistrés ✓');
    $('[data-a=off]', M).onclick = () => save('app', { off: $$('[data-off]', M).filter(x => x.checked).map(x => x.dataset.off) }, 'Fonctions enregistrées ✓');
    $('[data-a=ver]', M).onclick = () => { const v = val('minv').value.trim(); if (v && !/^\d+\.\d+\.\d+$/.test(v)) return toast('Version au format X.Y.Z (ex : 1.0.24)');
      save('app', { minVersion: v, maintenance: { on: val('mon').checked, text: val('mtext').value.trim() } }); };
    $('[data-a=inv]', M).onclick = () => save('app', { inviteOnly: val('inv').checked }, val('inv').checked ? 'Accès sur code uniquement ✓' : 'Accès libre ✓');
    $('[data-a=sec]', M).onclick = () => save('app', { secureAll: val('secall').checked }, val('secall').checked ? 'Anti-capture imposé ✓' : 'Anti-capture libre ✓');
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
    const SG = D.errors.filter(e => /^signalement/.test(e.src || '')).sort((a, b) => ms(b.at) - ms(a.at));   // v1.0.53 : « Signaler un problème »
    const G = {}; D.errors.filter(e => !/^signalement/.test(e.src || '')).forEach(e => { const g = G[e.msg] || (G[e.msg] = { msg: e.msg, n: 0, vers: new Set(), users: new Set(), last: 0, src: e.src, stack: e.stack }); g.n++; if (e.ver) g.vers.add(e.ver); g.users.add(e.uid); g.last = Math.max(g.last, ms(e.at)); });
    const L = Object.values(G).sort((a, b) => b.last - a.last);
    M.innerHTML = `<h2>Erreurs de l'application (${D.errors.length})</h2><div class="card"><p class="muted">Envoyées automatiquement par les téléphones (message, fichier, version — sans données de chantier).</p>
      ${D.errors.length ? '<div class="btns"><button class="btn ghost" data-a="clear">Tout effacer</button></div>' : ''}</div>
      <div class="card">${L.length ? L.map((g, i) => `<div class="row" data-g="${i}"><div class="t grow"><b>${esc(g.msg)}</b><small>${g.n} fois · ${g.users.size} personne(s) · ${esc([...g.vers].join(', ') || '—')} · ${esc(ago(g.last))}</small></div></div>`).join('') : '<div class="empty">Aucune erreur 🎉</div>'}</div>`;
    if (SG.length) { const c = document.createElement('div'); c.className = 'card'; c.innerHTML = `<h3>📣 Signalements (${SG.length})</h3>${SG.map((e, i) => `<div class="row" data-sg="${i}"><div class="t grow"><b>${esc(e.msg)}</b><small>${esc(String(e.src || '').replace(/^signalement · /, ''))} · ${esc(e.ver || '')} · ${esc(e.platform || '')}</small></div><span class="pill">${esc(ago(e.at))}</span></div>`).join('')}`;
      const first = M.querySelector('.card'); first ? first.after(c) : M.appendChild(c);
      $$('[data-sg]', c).forEach(r => r.onclick = () => { const e = SG[+r.dataset.sg]; modal('Signalement', `<p><b>${esc(e.msg)}</b></p><p class="muted">${esc(e.src || '')} · ${esc(dt(e.at))}</p><pre>${esc(e.stack || '')}</pre>`); }); }
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
