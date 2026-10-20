// ================= Licences : partager l'application avec un ami, la suspendre ou retirer l'accès, suivi de ses projets =================
// Le propriétaire (ce téléphone, ou connexion avec son compte) crée des codes de licence. Le téléphone de l'ami s'active avec un code ;
// l'application vérifie la licence à chaque ouverture (7 jours sans internet au maximum) et partage ses projets en lecture seule.
const LIC_FB = { apiKey: 'AIzaSyAgrScRnLf1Itfnqpg8Z9Hs0cmmJQ_6yC0', authDomain: 'siteteam.firebaseapp.com', projectId: 'siteteam', storageBucket: 'siteteam.firebasestorage.app', messagingSenderId: '1060672691635', appId: '1:1060672691635:web:bfded73f3a1d10481a7fc6' };
const LIC_GRACE = 7 * 864e5;
const LIC_OWNERS = ['abdessamad.daga94@gmail.com'];   // seuls comptes autorisés comme « propriétaire »
const LIC_APK = 'https://github.com/abdessamadwanted-sudo/Chantierpro/releases/latest/download/Chantier.apk';
const licApk = (L) => L && L.ver ? `https://github.com/abdessamadwanted-sudo/Chantierpro/releases/download/v${L.ver}/Chantier.apk` : LIC_APK;
const Lic = {
  get() { try { return JSON.parse(localStorage.getItem('lic') || 'null'); } catch (e) { return null; } },
  set(v) { try { localStorage.setItem('lic', JSON.stringify(v)); } catch (e) {} },
  dev() { let d = localStorage.getItem('lic.dev'); if (!d) { d = Array.from(crypto.getRandomValues(new Uint8Array(10)), b => b.toString(16).padStart(2, '0')).join(''); try { localStorage.setItem('lic.dev', d); } catch (e) {} } return d; },
  model() { const m = navigator.userAgent.match(/Android [\d.]+; ([^;)]+)/); return m ? m[1].trim() : (navigator.platform || 'Appareil'); },
};
let _licFb = null;
async function licFb() {
  if (_licFb) return _licFb;
  await loadScript('vendor/firebase/firebase-app-compat.js'); await loadScript('vendor/firebase/firebase-auth-compat.js'); await loadScript('vendor/firebase/firebase-firestore-compat.js');
  const app = firebase.apps.find(a => a.name === 'lic') || firebase.initializeApp(LIC_FB, 'lic');
  const fs = app.firestore(); try { fs.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (e) {}
  return (_licFb = { app, fs, auth: app.auth(), ts: () => firebase.firestore.FieldValue.serverTimestamp() });
}
const licTimeout = (p, ms = 12000) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('Pas de réponse (internet ?)')), ms))]);
const licExpired = (L) => L.expires && Date.now() > L.expires;

// ---------- démarrage ----------
async function licBoot() {
  let st = Lic.get();
  if (!st) {
    // téléphone déjà utilisé (projets ou Drive connecté) = propriétaire : rien ne change pour lui
    const owner = (await DB.all('projects')).length > 0 || !!localStorage.getItem('sync.cfg');
    if (owner) { Lic.set({ mode: 'owner' }); return; }
    await licActivateScreen(); st = Lic.get();
  }
  if (st.mode === 'owner') return;
  await licVerify(true);
  setInterval(() => licVerify(false), 6 * 3600e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - (Lic.get().checkedAt || 0) > 3600e3) licVerify(false); });
  setTimeout(() => licPush().catch(e => console.warn('suivi', e)), 4000);
  // (Sync remplace DB.onChange : il appelle licOnChange) — sans Sync, on se branche directement
  if (!DB.onChange) DB.onChange = (s) => licOnChange(s);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') licPush().catch(() => {}); });
}
// vérifie la licence ; bloque l'application si elle n'est plus valable
async function licVerify(blocking) {
  const st = Lic.get(); if (!st || st.mode !== 'user') return;
  let L = null, err = null;
  try { const { fs } = await licFb(); const d = await licTimeout(fs.collection('licences').doc(st.code).get()); L = d.exists ? d.data() : { status: 'revoked' }; }
  catch (e) { err = e; }
  if (L) {
    st.status = L.status; st.expires = L.expires || null; st.checkedAt = Date.now(); st.name = L.name; st.ownerName = L.ownerName || ''; st.block = L.block || null; st.role = L.role || null; st.suiviPhotos = L.suiviPhotos !== false; st.pack = L.pack || null; st.team = L.team || []; licGuardSync();
    const vOld = st.ver || null; st.ver = L.ver || null;
    if (st.ver && st.ver !== vOld && typeof pinnedUpdate === 'function') setTimeout(() => pinnedUpdate(st.ver, APP_VERSION, false).catch(() => {}), 1500);
    const fOld = JSON.stringify(st.features || null); st.features = L.features || null;
    if (!blocking && fOld !== JSON.stringify(st.features)) setTimeout(() => { try { Lic.set(st); App.project ? renderSection() : renderHome(); toast('Fonctions mises à jour par le titulaire'); } catch (e) {} }, 0);
    if (L.device && L.device.id && L.device.id !== Lic.dev()) st.status = 'moved';
    if (st.status === 'active' && !licExpired(L)) { st.lastOk = Date.now(); Lic.set(st);
      try { const { fs, ts } = await licFb(); fs.collection('licences').doc(st.code).update({ lastSeen: ts(), version: APP_VERSION, device: { id: Lic.dev(), model: Lic.model() } }).catch(() => {}); } catch (e) {}
      return; }
    Lic.set(st);
    return licLock(licExpired(L) && st.status === 'active' ? 'expired' : st.status);
  }
  // hors connexion : 7 jours de tolérance
  if (Date.now() - (st.lastOk || 0) > LIC_GRACE) return licLock('offline');
  if (st.status && st.status !== 'active') return licLock(st.status);
  if (st.expires && Date.now() > st.expires) return licLock('expired');
}
const LIC_MSG = {
  disabled: ['⏸️', 'Licence suspendue', 'L\'accès à l\'application est suspendu pour le moment.'],
  revoked: ['🔒', 'Accès retiré', 'Cette licence n\'est plus valable. Vous pouvez désinstaller l\'application.'],
  expired: ['⌛', 'Licence expirée', 'La durée de votre licence est terminée.'],
  moved: ['📱', 'Licence utilisée sur un autre téléphone', 'Ce code est déjà activé sur un autre appareil.'],
  offline: ['📶', 'Vérification nécessaire', 'Connectez-vous à internet pour vérifier votre licence (plus de 7 jours sans vérification).'],
};
function licLock(kind) {
  return new Promise(() => {
    document.querySelectorAll('.lic-lock').forEach(x => x.remove());
    const [ic, t, m] = LIC_MSG[kind] || LIC_MSG.revoked;
    const el = document.createElement('div'); el.className = 'fullpage lic-page lic-lock';
    el.innerHTML = `<div class="lic-in"><div class="lic-ic">${ic}</div><h1>${t}</h1><p>${m}</p>
      <button class="btn" data-a="retry">${icon('undo')} Réessayer</button><button class="linkbtn" data-a="other">J'ai un autre code</button></div>`;
    document.body.appendChild(el);
    $('[data-a=retry]', el).onclick = async () => { const ld = loading('Vérification…'); el.remove(); ld.close(); await licVerify(true); if (!document.querySelector('.lic-lock')) { toast('Licence valable ✓'); renderHome(); } };
    $('[data-a=other]', el).onclick = async () => { el.remove(); await licActivateScreen(true); location.reload(); };
  });
}

// ---------- activation (téléphone de l'ami) ----------
function licActivateScreen(again) {
  return new Promise((resolve) => {
    const el = document.createElement('div'); el.className = 'fullpage lic-page';
    el.innerHTML = `<div class="lic-in"><div class="lic-logo">${icon('hard')}</div><h1>Chantier</h1><p>Entrez le code de licence reçu (Gmail ou WhatsApp) et votre adresse Gmail.</p>
      <div class="form"><label>Code de licence<input name="code" autocapitalize="characters" placeholder="CH-XXXX-XXXX" style="text-transform:uppercase;letter-spacing:1px"></label>
      <label>Votre adresse Gmail<input name="email" type="email" inputmode="email" autocapitalize="none" placeholder="prenom.nom@gmail.com"></label>
      <button class="btn" data-a="go">Activer</button></div>
      <button class="linkbtn" data-a="owner">Je suis le propriétaire de l'application</button></div>`;
    document.body.appendChild(el);
    $('[data-a=go]', el).onclick = async () => {
      const code = $('[name=code]', el).value.toUpperCase().replace(/[^A-Z0-9-]/g, '').replace(/^CH(?!-)/, 'CH-');
      if (code.length < 8) return toast('Code incomplet');
      const ld = loading('Vérification du code…');
      try {
        const { fs, ts } = await licFb(); const ref = fs.collection('licences').doc(code); const d = await licTimeout(ref.get());
        if (!d.exists) throw new Error('Code introuvable — vérifiez-le');
        const L = d.data();
        if (L.status !== 'active') throw new Error(L.status === 'disabled' ? 'Cette licence est suspendue' : 'Cette licence n\'est plus valable');
        if (licExpired(L)) throw new Error('Cette licence est expirée');
        if (L.device && L.device.id && L.device.id !== Lic.dev()) throw new Error('Ce code est déjà utilisé sur un autre téléphone');
        const em = ($('[name=email]', el).value || '').trim().toLowerCase();
        if (L.email && em !== String(L.email).toLowerCase()) throw new Error(em ? 'Ce code est lié à une autre adresse Gmail. Utilisez l\'adresse à laquelle le code a été envoyé.' : 'Entrez votre adresse Gmail (celle qui a reçu le code).');
        ld.close();
        const ok = await licNotice(L); if (!ok) return;
        const ld2 = loading('Activation…');
        try { await licTimeout(ref.update({ device: { id: Lic.dev(), model: Lic.model() }, accepted: true, lastSeen: ts(), version: APP_VERSION })); } finally { ld2.close(); }
        Lic.set({ mode: 'user', code, email: em || L.email || '', status: 'active', lastOk: Date.now(), checkedAt: Date.now(), name: L.name, ownerName: L.ownerName || '', expires: L.expires || null, block: L.block || null, features: L.features || null, pushAt: 0 });
        el.remove(); toast('Application activée ✓'); resolve();
      } catch (e) { ld.close(); alertBox(e.message || String(e)); }
    };
    $('[data-a=owner]', el).onclick = async () => { if (await licOwnerLogin()) { Lic.set({ mode: 'owner' }); el.remove(); toast('Bienvenue ✓'); resolve(); } };
    void again;
  });
}
// message de partage de suivi (une seule fois, à l'activation)
function licNotice(L) {
  return new Promise((resolve) => {
    const s = sheet(`<div class="form"><div class="lic-note">🤝 <b>Partage de suivi</b><br>Les projets créés avec cette licence sont partagés en lecture seule avec <b>${esc(L.ownerName || 'le titulaire de la licence')}</b>, pour le suivi du travail.</div>
      <button class="btn" data-a="ok">OK</button></div>`, { title: 'Activation' });
    s.onClose = () => resolve(false);
    $('[data-a=ok]', s.el).onclick = () => { s.onClose = null; s.close(); resolve(true); };
  });
}

// ---------- propriétaire : connexion ----------
async function licOwnerLogin() {
  const { auth, fs } = await licFb();
  // seul le propriétaire (son adresse, ou un compte qui a déjà créé des licences) peut entrer
  const allowed = async (u) => { if (!u) return false; if (LIC_OWNERS.includes(String(u.email || '').toLowerCase())) return true;
    try { const q = await licTimeout(fs.collection('licences').where('ownerUid', '==', u.uid).limit(1).get()); return !q.empty; } catch (e) { return false; } };
  if (auth.currentUser) { if (await allowed(auth.currentUser)) return auth.currentUser; await auth.signOut().catch(() => {}); }
  const r = await formSheet('Compte propriétaire', [{ name: 'email', label: 'E-mail du propriétaire', type: 'email' }, { name: 'pw', label: 'Mot de passe', type: 'password' }], { okLabel: 'Se connecter', danger: 'Mot de passe oublié' });
  if (!r) return null;
  if (r.__danger) {
    const m = await formSheet('Mot de passe oublié', [{ name: 'email', label: 'E-mail du propriétaire', type: 'email' }], { okLabel: 'Envoyer le lien' });
    if (m && m.email) { if (!LIC_OWNERS.includes(m.email.trim().toLowerCase())) { alertBox('Cette adresse n\'est pas celle du propriétaire.'); return null; } try { await auth.sendPasswordResetEmail(m.email.trim()); alertBox('📧 Lien envoyé : ouvrez Gmail et choisissez un nouveau mot de passe.'); } catch (e) { alertBox(e.message || String(e)); } }
    return null;
  }
  if (!r.email || !r.pw) return null;
  const ld = loading('Connexion…');
  try {
    const c = await auth.signInWithEmailAndPassword(r.email.trim(), r.pw);
    if (!(await allowed(c.user))) { await auth.signOut().catch(() => {}); alertBox('🔒 Accès réservé au propriétaire de l\'application.\nSi on vous a donné un code de licence, entrez-le sur l\'écran d\'activation.'); return null; }
    return c.user;
  }
  catch (e) { alertBox(({ 'auth/invalid-credential': 'E-mail ou mot de passe incorrect', 'auth/invalid-login-credentials': 'E-mail ou mot de passe incorrect', 'auth/user-not-found': 'E-mail ou mot de passe incorrect', 'auth/wrong-password': 'E-mail ou mot de passe incorrect', 'auth/too-many-requests': 'Trop d\'essais : réessayez plus tard', 'auth/network-request-failed': 'Pas de connexion internet' })[e.code] || e.message); return null; }
  finally { ld.close(); }
}

// ---------- propriétaire : gestion des licences ----------
const licCode = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', r = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => A[b % A.length]).join(''); return `CH-${r.slice(0, 4)}-${r.slice(4)}`; };
const LIC_ST = { active: ['Active', '#22c55e'], disabled: ['Suspendue', '#f59e0b'], revoked: ['Accès retiré', '#ef4444'] };
async function openLicences() {
  const st = Lic.get(); if (st && st.mode === 'user') return toast('Réservé au propriétaire');
  let user; try { user = await licOwnerLogin(); } catch (e) { return alertBox('Connexion impossible : ' + (e.message || e)); }
  if (!user) return;
  const { fs, ts, auth } = await licFb();
  const el = document.createElement('div'); el.className = 'fullpage lic-admin'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  let list = [];
  const draw = async () => {
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:17px">Licences</h1><button class="btn small" data-a="new" style="flex:none">${icon('plus')} Nouvelle</button></div><div class="lic-list"><div class="empty">Chargement…</div></div>`;
    $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
    $('[data-a=new]', el).onclick = () => newLic();
    list = [];
    try { const q = await licTimeout(fs.collection('licences').where('ownerUid', '==', user.uid).get()); list = q.docs.map(d => ({ code: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      const bl = await licOwnerBlock(); if (bl) list.filter(x => x.block !== bl).forEach(x => { x.block = bl; fs.collection('licences').doc(x.code).update({ block: bl }).catch(() => {}); }); }
    catch (e) { $('.lic-list', el).innerHTML = `<div class="empty">${esc(e.code === 'permission-denied' ? 'Accès refusé : les règles Firestore doivent être mises à jour (voir les instructions).' : (e.message || e))}</div>`; return; }
    const ago = (t) => { const ms = t?.toMillis ? Date.now() - t.toMillis() : null; if (ms == null) return 'jamais'; const h = ms / 3600e3; return h < 1 ? 'il y a moins d\'1 h' : h < 48 ? `il y a ${Math.round(h)} h` : `il y a ${Math.round(h / 24)} j`; };
    $('.lic-list', el).innerHTML = list.length ? list.map(L => { const S = licExpired(L) && L.status === 'active' ? ['Expirée', '#94a3b8'] : LIC_ST[L.status] || ['?', '#94a3b8'];
      const R = roleOf(L.role), chefN = L.chef && (list.find(x => x.code === L.chef) || {}).name;
      return `<button class="lic-row" data-c="${L.code}"><span class="lic-av">${R ? R.e : esc((L.name || '?')[0].toUpperCase())}</span><span class="grow"><b>${esc(L.name || 'Sans nom')}${R ? ` <span class="lic-role">${esc(R.n)}${L.pack ? ' · ' + esc((packOf(L.pack) || {}).n || '') : ''}</span>` : ''}</b>${chefN || (L.team || []).length ? `<small>${chefN ? '↳ équipe de ' + esc(chefN) : ''}${(L.team || []).length ? `👥 chef de ${L.team.length} personne(s)` : ''}</small>` : ''}
        <small>${L.ver ? `📌 v${esc(L.ver)} · ` : ''}${L.code}${L.email ? ' · ' + esc(L.email) : ''} · ${L.device ? esc(L.device.model || 'téléphone') + ' · vu ' + ago(L.lastSeen) : 'pas encore activée'}${L.version ? ' · v' + esc(L.version) : ''}</small>
        <small>${L.expires ? 'Expire le ' + fmtDate(L.expires) : 'Sans expiration'}${L.features && Object.values(L.features).some(v => v === false) ? ` · ${Object.values(L.features).filter(v => v === false).length} fonction(s) masquée(s)` : ''}</small></span><em style="--c:${S[1]}">${S[0]}</em></button>`; }).join('')
      : '<div class="empty">Aucune licence.<br>Touchez <b>Nouvelle</b> pour partager l\'application avec quelqu\'un.</div>';
    $$('[data-c]', el).forEach(b => b.onclick = () => licMenu(list.find(x => x.code === b.dataset.c)));
  };
  const shareCode = (L) => openUrl('https://wa.me/?text=' + encodeURIComponent(`Bonjour ${L.name || ''},\nVoici l'application *Chantier* pour le suivi de chantier :\n\n1️⃣ Téléchargez et installez : ${licApk(L)}\n2️⃣ Ouvrez l'application et entrez le code : *${L.code}*${L.email ? `\n3️⃣ Avec votre adresse Gmail : ${L.email}` : ''}`));
  const mailCode = (L) => {
    const sub = `Votre licence Chantier : ${L.code}`;
    const body = `Bonjour ${L.name || ''},\n\nVoici votre accès à l'application Chantier (suivi de chantier).\n\n1) Téléchargez et installez l'application :\n${licApk(L)}\n(si Android le demande : autoriser l'installation)\n\n2) Ouvrez Chantier et entrez :\n   - Code de licence : ${L.code}\n   - Votre adresse Gmail : ${L.email || '(cette adresse)'}\n\n3) Les mises à jour se font ensuite depuis l'application (⋮ › Rechercher une mise à jour), sans désinstaller.\n\nCe code ne fonctionne que sur un seul téléphone.${L.expires ? `\nValable jusqu'au ${fmtDate(L.expires)}.` : ''}\n\n${L.ownerName || ''}`;
    openUrl(`mailto:${encodeURIComponent(L.email || '')}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`);
  };
  const DUR = [['0', 'Sans expiration'], ['30', '1 mois'], ['90', '3 mois'], ['180', '6 mois'], ['365', '1 an']];
  async function newLic() {
    const r = await formSheet('Nouvelle licence', [{ name: 'name', label: 'Pour qui ?', placeholder: 'Ex : Youssef' }, { name: 'email', label: 'Son adresse Gmail (le code lui sera lié)', type: 'email', placeholder: 'youssef@gmail.com' }, { name: 'd', label: 'Durée', type: 'select', value: '0', options: DUR.map(([v, l]) => ({ value: v, label: l })) },
      { name: 'me', label: 'Votre nom (affiché à l\'activation)', value: localStorage.getItem('userName') || '' },
      { name: 'role', label: 'Rôle (métier)', type: 'select', value: 'chef', options: ROLES.map(x => ({ value: x.k, label: `${x.e} ${x.n}` })) },
      { name: 'f', label: 'Fonctions', type: 'select', value: 'all', options: [{ value: 'all', label: 'Toutes les fonctions (activées)' }, { value: 'pick', label: 'Activer / désactiver une par une…' }] }], { okLabel: 'Créer' });
    if (!r || !r.name) return;
    r.pack = 'entreprise';   // tout est inclus ; le titulaire active / désactive chaque fonction
    let features = null;
    if (r.f === 'pick') { features = await editLicFeatures({ name: r.name, features: {} }); if (!features) return; }
    const code = licCode(), L = { features, block: await licOwnerBlock(), name: r.name, email: (r.email || '').trim().toLowerCase() || null, role: r.role, pack: r.pack, ownerUid: user.uid, ownerName: r.me || '', status: 'active', expires: +r.d ? Date.now() + (+r.d) * 864e5 : null, device: null, accepted: false, createdAt: ts() };
    const ld = loading('Création…'); try { await licTimeout(fs.collection('licences').doc(code).set(L)); } catch (e) { ld.close(); return alertBox(e.code === 'permission-denied' ? 'Accès refusé : mettez à jour les règles Firestore (voir les instructions).' : (e.message || e)); } ld.close();
    const v = await menu(`Code : ${code}`, [...(L.email ? [{ label: `Envoyer par Gmail à ${L.email}`, icon: 'external', value: 'mail' }] : []), { label: 'Envoyer par WhatsApp (lien + code)', icon: 'share', value: 'wa' }, { label: 'Copier le code', icon: 'file', value: 'cp' }, { label: 'Fermer', icon: 'check', value: 'ok' }]);
    if (v === 'wa') shareCode({ ...L, code }); if (v === 'mail') mailCode({ ...L, code }); if (v === 'cp') navigator.clipboard.writeText(code).then(() => toast('Copié ✓'), () => alertBox(code));
    draw();
  }
  async function licMenu(L) {
    const ref = fs.collection('licences').doc(L.code);
    const v = await menu(`${L.name} · ${L.code}`, [
      { label: 'Voir ses projets (suivi)', icon: 'layers', value: 'see' },
      { label: 'Fonctions : activer / désactiver', icon: 'grid', value: 'feat' },
      { label: L.suiviPhotos === false ? '📷 Photos dans le suivi : non (activer)' : '📷 Photos dans le suivi : oui, 30 jours (désactiver)', icon: 'image', value: 'ph' },
      { label: `Rôle${L.role ? ' · ' + ((roleOf(L.role) || {}).n || '') : ''}`, icon: 'team', value: 'role' },
      { label: `Version : ${L.ver ? '📌 v' + L.ver + ' (figée)' : 'toujours la dernière'}`, icon: 'upload', value: 'ver' },
      { label: L.chef ? `Rattaché à : ${(list.find(x => x.code === L.chef) || {}).name || L.chef} (changer)` : 'Rattacher à un chef (équipe)…', icon: 'layers', value: 'chef' },
      L.status === 'active' ? { label: 'Suspendre (temporaire)', icon: 'calendar', value: 'disable' } : { label: 'Réactiver', icon: 'check', value: 'enable' },
      { label: 'Prolonger / changer la durée', icon: 'calendar', value: 'exp' },
      { label: 'Renvoyer par WhatsApp', icon: 'share', value: 'share' },
      { label: L.email ? `Renvoyer par Gmail (${L.email})` : 'Envoyer par Gmail…', icon: 'external', value: 'mail' },
      { label: 'Libérer le téléphone (changement de téléphone)', icon: 'phone', value: 'free' },
      ...(L.status !== 'revoked' ? [{ label: 'Retirer l\'accès définitivement', icon: 'close', danger: true, value: 'revoke' }] : []),
      { label: 'Supprimer la licence', icon: 'trash', danger: true, value: 'del' }]);
    try {
      if (v === 'see') return openSuivi(L);
      if (v === 'feat') { const f = await editLicFeatures(L); if (!f) return; await ref.update({ features: f }); }
      if (v === 'ph') await ref.update({ suiviPhotos: L.suiviPhotos === false });
      if (v === 'ver') { const nv = await licPickVersion(L); if (nv !== undefined) { await ref.update({ ver: nv }); toast(nv ? `${L.name} passera sur la v${nv} (dans les 15 min ou à l'ouverture)` : `${L.name} suivra toujours la dernière version`); } }
      if (v === 'role') {
        const r = await formSheet(`Rôle · ${L.name}`, [{ name: 'role', label: 'Rôle', type: 'select', value: L.role || 'chef', options: ROLES.map(x => ({ value: x.k, label: `${x.e} ${x.n}` })) }], { okLabel: 'Appliquer' });
        if (r) await ref.update({ role: r.role });   // le rôle ne retire aucune fonction : elles se règlent avec les interrupteurs
      }
      if (v === 'chef') {
        const chefs = list.filter(x => x.code !== L.code && (roleOf(x.role) || {}).team);
        const c = await menu(`${L.name} est rattaché à…`, [{ label: 'Moi seulement (titulaire)', icon: 'check', value: '__none', checked: !L.chef }, ...chefs.map(x => ({ label: `${(roleOf(x.role) || {}).e || ''} ${x.name}`, value: x.code, checked: L.chef === x.code }))]);
        if (c) {
          const me = { code: L.code, name: L.name, role: L.role || null };
          if (L.chef) { const old = list.find(x => x.code === L.chef); if (old) await fs.collection('licences').doc(old.code).update({ team: (old.team || []).filter(m => m.code !== L.code) }); }
          if (c !== '__none') { const ch = list.find(x => x.code === c); await fs.collection('licences').doc(c).update({ team: [...(ch.team || []).filter(m => m.code !== L.code), me] }); }
          await ref.update({ chef: c === '__none' ? null : c });
          if (!chefs.length && c === '__none') toast('Astuce : donnez le rôle Directeur ou Conducteur à une licence pour en faire un chef d\'équipe');
        }
      }
      if (v === 'disable') await ref.update({ status: 'disabled' });
      if (v === 'enable') await ref.update({ status: 'active' });
      if (v === 'revoke' && await confirmBox(`Retirer l'accès de ${L.name} ? L'application se bloquera sur son téléphone à la prochaine ouverture avec internet.`, 'Retirer l\'accès')) await ref.update({ status: 'revoked' });
      if (v === 'exp') { const r = await formSheet('Durée', [{ name: 'd', label: 'À partir d\'aujourd\'hui', type: 'select', value: '0', options: DUR.map(([x, l]) => ({ value: x, label: l })) }], { okLabel: 'Appliquer' }); if (r) await ref.update({ expires: +r.d ? Date.now() + (+r.d) * 864e5 : null }); }
      if (v === 'share') shareCode(L);
      if (v === 'mail') { let e = L.email; if (!e) { const r = await formSheet('Adresse Gmail', [{ name: 'e', label: 'Gmail de ' + (L.name || 'la personne'), type: 'email' }], { okLabel: 'Lier et envoyer' }); if (!r || !r.e) return; e = r.e.trim().toLowerCase(); await ref.update({ email: e }); } mailCode({ ...L, email: e }); return; }
      if (v === 'free' && await confirmBox('Libérer ce code ? Il pourra être activé sur un nouveau téléphone (l\'ancien sera bloqué).', 'Libérer')) await ref.update({ device: null });
      if (v === 'del' && await confirmBox(`Supprimer la licence de ${L.name} ? Son application sera bloquée et son suivi effacé.`)) { const q = await ref.collection('suivi').get(); for (let i = 0; i < q.docs.length; i += 400) { const b = fs.batch(); q.docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); } await ref.delete(); }
      if (v && v !== 'share') { toast('Enregistré ✓'); draw(); }
    } catch (e) { alertBox(e.message || String(e)); }
  }
  draw();
  void auth;
}

// ---------- suivi : envoi des projets de l'ami (texte + miniatures des photos) ----------
const SUIVI_STORES = ['projects', 'folders', 'plans', 'links', 'receptions', 'tasks', 'reports', 'forms'];
async function licPush() {
  const st = Lic.get(); if (!st || st.mode !== 'user' || st.status !== 'active' || navigator.onLine === false) return;
  if (licPush.busy) return; licPush.busy = true;
  try {
    const { fs } = await licFb(), col = fs.collection('licences').doc(st.code).collection('suivi'), since = st.pushAt || 0, start = Date.now(), out = [];
    for (const s of SUIVI_STORES) for (const r of await DB.all(s).catch(() => [])) if ((r.updatedAt || 0) > since) { const { blob, croquis, data, annotations, ...rest } = r; out.push({ id: `${s}__${r.id}`, store: s, projectId: s === 'projects' ? r.id : r.projectId, updatedAt: r.updatedAt || 0, deleted: false, data: JSON.stringify(rest).slice(0, 900000) }); }
    for (const t of await DB.all('tomb')) if (t.at > since && SUIVI_STORES.includes(t.store)) out.push({ id: `${t.store}__${t.rid}`, store: t.store, projectId: t.projectId, updatedAt: t.at, deleted: true, data: '' });
    // miniatures (photos, PV, croquis) créées depuis le dernier envoi
    const lim30 = Date.now() - 30 * 864e5;   // Firebase léger : miniatures des 30 derniers jours seulement, si le titulaire l'autorise
    const imgs = st.suiviPhotos === false ? [] : (await DB.all('files')).filter(f => f.blob && (f.createdAt || 0) > Math.max(since, lim30) && /^image\//.test(f.mime || f.blob.type || '') && !['plan', 'plansrc', 'sig', 'board', 'sketchbg'].includes(f.role)).slice(0, 100);
    for (const f of imgs) { try { out.push({ id: `thumb__${f.id}`, store: 'thumb', projectId: f.projectId, updatedAt: f.createdAt || 0, deleted: false, data: await licThumb(f.blob) }); } catch (e) {} }
    for (let i = 0; i < out.length; i += 300) { const b = fs.batch(); out.slice(i, i + 300).forEach(o => b.set(col.doc(o.id), o)); await licTimeout(b.commit(), 60000); }
    const cur = Lic.get(); cur.pushAt = start; cur.pushN = (cur.pushN || 0) + out.length; Lic.set(cur);
    // nettoyage (1 fois par jour) : miniatures de plus de 30 jours retirées de Firebase
    if (Date.now() - (cur.cleanAt || 0) > 864e5) { try { const old = await licTimeout(col.where('updatedAt', '<', lim30).limit(300).get(), 30000); const th = old.docs.filter(d => d.data().store === 'thumb'); for (let i = 0; i < th.length; i += 300) { const b = fs.batch(); th.slice(i, i + 300).forEach(d => b.delete(d.ref)); await b.commit(); } } catch (e) {} const c2 = Lic.get(); c2.cleanAt = Date.now(); Lic.set(c2); }
  } finally { licPush.busy = false; }
}
async function licThumb(blob) {
  const bmp = await createImageBitmap(blob), k = Math.min(1, 240 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.5);
}

// ---------- suivi : lecture (propriétaire) ----------
async function openSuivi(L) {
  const { fs } = await licFb();
  const ld = loading('Chargement des projets…'); let docs = [];
  try { docs = (await licTimeout(fs.collection('licences').doc(L.code).collection('suivi').get(), 60000)).docs.map(d => d.data()).filter(d => !d.deleted); } catch (e) { ld.close(); return alertBox(e.message || String(e)); }
  ld.close();
  const recs = {}; docs.forEach(d => { if (d.store === 'thumb') return; try { (recs[d.store] = recs[d.store] || []).push(JSON.parse(d.data)); } catch (e) {} });
  const thumbs = Object.fromEntries(docs.filter(d => d.store === 'thumb').map(d => [d.id.slice(7), d]));
  const projects = (recs.projects || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const el = document.createElement('div'); el.className = 'fullpage lic-admin'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  let pid = null, tab = (recs.links || []).some(l => l.kind === 'local') ? 'av' : 'rec';
  const last = docs.reduce((a, d) => Math.max(a, d.updatedAt || 0), 0);
  const draw = () => {
    const P = projects.find(p => p.id === pid);
    const head = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:16px">${esc(P ? P.name : 'Projets de ' + L.name)}</h1></div>`;
    if (!P) {
      const nTh = docs.filter(d => d.store === 'thumb').length, kb = Math.round(docs.reduce((a, d) => a + (d.data || '').length, 0) / 1024);
      el.innerHTML = head + `<div class="lic-list"><div class="lic-sub">👁 Lecture seule · dernière mise à jour ${last ? fmtDateTime(last) : '—'}</div>
        <div class="lic-sub">☁ Firebase : ${docs.length - nTh} élément(s) · ${nTh} miniature(s) · ≈ ${kb > 1024 ? (kb / 1024).toFixed(1) + ' Mo' : kb + ' Ko'} <button class="linkbtn" data-a="purge">Effacer les miniatures > 30 j</button></div>${projects.map(p => {
        const nRec = (recs.receptions || []).filter(r => r.projectId === p.id).length, nRes = (recs.tasks || []).filter(t => t.projectId === p.id).length;
        return `<button class="lic-row" data-p="${p.id}"><span class="lic-av">${esc((p.name || '?')[0])}</span><span class="grow"><b>${esc(p.name)}</b><small>${nRec} tableau(x) · ${nRes} réserve(s)</small></span>${icon('chevright')}</button>`; }).join('') || '<div class="empty">Aucun projet pour le moment.</div>'}</div>`;
      $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
      $$('[data-p]', el).forEach(b => b.onclick = () => { pid = b.dataset.p; draw(); });
      $('[data-a=purge]', el).onclick = async () => { const lim = Date.now() - 30 * 864e5, ld = loading('Nettoyage…'); let n = 0;
        try { const q = await licTimeout(fs.collection('licences').doc(L.code).collection('suivi').where('updatedAt', '<', lim).get(), 60000); const th = q.docs.filter(d => d.data().store === 'thumb'); for (let i = 0; i < th.length; i += 400) { const b = fs.batch(); th.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); n += th.slice(i, i + 400).length; } }
        catch (e) { ld.close(); return alertBox(e.message || String(e)); } ld.close(); toast(`${n} miniature(s) effacée(s)`); };
      return;
    }
    const days = (recs.receptions || []).filter(r => r.projectId === pid).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const tasks = (recs.tasks || []).filter(t => t.projectId === pid), reps = (recs.reports || []).filter(r => r.projectId === pid).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const photoIds = days.flatMap(d => (d.rows || []).flatMap(r => [...(r.photoIds || []), ...(r.retourIds || [])]).concat(d.pvIds || [])).concat(tasks.flatMap(t => t.photoIds || [])).concat((recs.links || []).filter(l => l.kind === 'local' && l.projectId === pid).flatMap(l => Object.values(l.lots || {}).flatMap(r => r.photos || []))).filter(id => thumbs[id]);
    const stc = (s) => ({ ok: '#22c55e', reserve: '#f59e0b', progress: '#3b82f6', pending: '#94a3b8' })[s] || '#94a3b8';
    let body = '';
    if (tab === 'rec') body = days.map(d => `<div class="sv-day"><div class="sv-dh"><b>${fmtDate(d.date)}</b><span>${d.type === 'Bétonnage' ? 'Bétonnage' : 'Réception ferraillage'} · ${(d.rows || []).filter(r => r.element).length} ouvrage(s)${(d.pvIds || []).length ? ` · ${d.pvIds.length} PV` : ''}</span></div>
      ${(d.rows || []).filter(r => r.element).map(r => `<div class="sv-row"><i style="background:${stc(r.status)}"></i><span class="z">${esc(r.zone || '')}</span><span class="n">${esc(r.niv || '')}</span><span class="grow">${esc(r.element)}${r.obs ? `<small>${esc(r.obs)}</small>` : ''}</span>${(r.photoIds || []).length ? '📷' + r.photoIds.length : ''}</div>`).join('')}</div>`).join('') || '<div class="empty">Aucun tableau.</div>';
    if (tab === 'av') {
      const locs = (recs.links || []).filter(l => l.kind === 'local' && l.projectId === pid), lots = (P.lots && P.lots.length) ? P.lots : AV_DEFAULT_LOTS;
      body = (P.avNiveaux || []).map(n => { const ls = locs.filter(l => l.nivId === n.id).sort(avNameSort); if (!ls.length) return '';
        return `<div class="sv-day"><div class="sv-dh"><b>${esc(n.name)}</b><span>${lots.map(lot => `${esc(lot.name)} ${avStats(ls, lot.id).pct}%`).join(' · ')}</span></div>
          ${ls.map(l => `<div class="sv-row"><span class="grow">${esc(l.name)}<small>${lots.map(lot => { const r = (l.lots || {})[lot.id], k = avStatus(r); return `<b style="color:${AV_ST[k][1]}">●</b> ${esc(lot.name)} : ${AV_ST[k][0]}${r && r.due ? ' (eng. ' + fmtDate(r.due) + ')' : ''}`; }).join('<br>')}</small></span>${lots.reduce((a, lot) => a + (((l.lots || {})[lot.id] || {}).photos || []).length, 0) ? '📷' : ''}</div>`).join('')}</div>`; }).join('') || '<div class="empty">Aucun local.</div>';
    }
    if (tab === 'res') body = tasks.map(t => `<div class="sv-row"><i style="background:${(STATUS[t.status] || STATUS.open).color}"></i><span class="grow">#${t.num || ''} ${esc(t.title || '')}<small>${(STATUS[t.status] || STATUS.open).label}${t.due ? ' · échéance ' + fmtDate(t.due) : ''}</small></span></div>`).join('') || '<div class="empty">Aucune réserve.</div>';
    if (tab === 'rap') body = reps.map(r => `<div class="sv-day"><div class="sv-dh"><b>${fmtDate(r.date)}</b></div><div class="sv-txt">${esc([r.travaux, r.problemes, r.obs].filter(Boolean).join('\n')).replace(/\n/g, '<br>') || '—'}</div></div>`).join('') + ((P.rappels || []).length ? `<div class="sv-dh"><b>Rappels</b></div>${P.rappels.map(x => `<div class="sv-row"><span class="grow">${x.done ? '✅' : '🔔'} ${esc(x.text)}<small>${x.at ? fmtDate(x.at.slice(0, 10)) : ''}</small></span></div>`).join('')}` : '') || '<div class="empty">Aucun rapport.</div>';
    if (tab === 'ph') body = photoIds.length ? `<div class="sv-ph">${photoIds.map(id => `<img src="${thumbs[id].data}" data-ph="${id}">`).join('')}</div><div class="lic-sub">Miniatures — les photos complètes sont dans son Google Drive.</div>` : '<div class="empty">Aucune photo.</div>';
    el.innerHTML = head + `<div class="tm-tabs">${[['av', 'Avancement'], ['rec', 'Réception & bétonnage'], ['res', 'Réserves'], ['rap', 'Rapports & rappels'], ['ph', 'Photos']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="lic-list">${body}</div>`;
    $('[data-a=x]', el).onclick = () => { pid = null; draw(); };
    $$('[data-t]', el).forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
    $$('[data-ph]', el).forEach(img => img.onclick = () => showGallery(photoIds.map(id => ({ src: thumbs[id].data })), photoIds.indexOf(img.dataset.ph)));
  };
  draw();
}

// ---------- Séparation des données : l'application d'une licence ne peut JAMAIS se connecter au Google Drive du propriétaire ----------
async function licHash(t) { try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(t || '').trim())); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32); } catch (e) { return null; } }
async function licOwnerBlock() { const c = Sync.cfg && Sync.cfg(); return c && c.url ? await licHash(c.url) : null; }
// true si cette URL de script est celle du propriétaire (interdit en mode licence)
async function licIsOwnerScript(url) { const st = Lic.get(); if (!st || st.mode !== 'user' || !st.block) return false; return (await licHash(url)) === st.block; }
async function licGuardSync() { const c = Sync.cfg && Sync.cfg(); if (c && c.url && await licIsOwnerScript(c.url)) { Sync.disconnect(); toast('Google Drive du titulaire refusé — connectez votre propre Drive'); } }

// envoi du suivi 20 s après une modification (et dès qu'on quitte l'application)
function licOnChange() { const st = Lic.get(); if (!st || st.mode !== 'user') return; clearTimeout(licPush._t); licPush._t = setTimeout(() => licPush().catch(() => {}), 20000); }

// choisir la version d'une licence : la dernière, ou une version figée (seulement celles qui s'installent sans réinstaller)
async function licPickVersion(L) {
  const ld = loading('Liste des versions…'); let rels = [];
  try { const r = await fetch('https://api.github.com/repos/abdessamadwanted-sudo/Chantierpro/releases?per_page=60', { headers: { Accept: 'application/vnd.github+json' } }); if (r.ok) rels = await r.json(); } catch (e) {} finally { ld.close(); }
  if (!rels.length) { toast('Impossible de lire les versions (internet ?)'); return undefined; }
  const ok = rels.filter(r => (r.assets || []).some(a => a.name === 'www.zip') && (r.assets || []).some(a => a.name === 'ota.json'));
  const v = await menu(`Version de ${L.name}`, [{ label: '🔄 Toujours la dernière version', value: '__last', checked: !L.ver },
    ...ok.map(r => { const n = r.tag_name.replace(/^v/, ''), first = String(r.body || '').split('\n').map(x => x.replace(/^[-*#\s]+/, '').replace(/\*\*/g, '')).find(x => x.trim()) || ''; return { label: `📌 v${n} · ${new Date(r.published_at).toLocaleDateString('fr-FR')}${first ? ' — ' + first.slice(0, 60) : ''}`, value: n, checked: L.ver === n }; })]);
  if (!v) return undefined;
  if (v === '__last') return null;
  const latest = ok[0] && ok[0].tag_name.replace(/^v/, '');
  if (latest && v !== latest && verCmp(v, latest) < 0 && !await confirmBox(`Figer ${L.name} sur la v${v} ?\nIl ne recevra plus les nouveautés ni les corrections tant que vous ne changez pas.`, 'Figer cette version')) return undefined;
  return v;
}
