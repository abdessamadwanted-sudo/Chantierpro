// ================= SiteTeam : comptes, entreprise, organigramme, rôles et permissions (Firebase) =================
// Comptes et données partagées (projets, tableaux, réserves…) : Firebase (Auth + Firestore), protégés par les règles
// de sécurité côté serveur. Fichiers (plans, photos, PDF) : Google Drive de l'entreprise (script Apps Script).
const FB_CONFIG = {
  apiKey: 'AIzaSyAgrScRnLf1Itfnqpg8Z9Hs0cmmJQ_6yC0',
  authDomain: 'siteteam.firebaseapp.com',
  projectId: 'siteteam',
  storageBucket: 'siteteam.firebasestorage.app',
  messagingSenderId: '1060672691635',
  appId: '1:1060672691635:web:bfded73f3a1d10481a7fc6',
};

// ---------- Formules commerciales (séparées des rôles/permissions : la formule limite l'accès aux fonctionnalités et au nombre de comptes,
// le rôle/les droits limitent ce que chacun voit et peut faire une fois dans l'entreprise). Prix et quotas provisoires, à ajuster avant lancement.
const PLANS = {
  basic:      { k: 'basic', l: 'Basic', price: 0, period: 'mois', users: 1, storageGb: 1, ads: true, modules: ['projet', 'plans', 'reserves', 'photos'] },
  personnel:  { k: 'personnel', l: 'Personnel', price: 39, period: 'mois', users: 1, storageGb: 10, ads: false, modules: '*' },
  pro:        { k: 'pro', l: 'Pro', price: 99, period: 'mois', users: 1, storageGb: 30, ads: false, modules: '*' },
  entreprise: { k: 'entreprise', l: 'Entreprise', price: 990, period: 'mois', users: 15, extraUserPrice: 49, storageGb: 200, ads: false, modules: '*' },
};
const planOf = (k) => PLANS[k] || PLANS.basic;
// une entreprise (branche SiteTeam) démarre sur la formule Entreprise, en essai — à brancher sur une vraie facturation avant tout lancement public
const PLAN_DEFAULT_COMPANY = 'entreprise';
// contact à remplacer par l'adresse définitive (support@votredomaine) avant tout lancement public
const SUPPORT_EMAIL = 'contact@chantierpro.ma';

// ---------- Partage externe : donner à une entreprise/personne d'une AUTRE entreprise SiteTeam un accès limité à UN projet précis.
// L'intervenant garde son propre compte et sa propre entreprise (son « espace ») : il ne devient pas membre de l'entreprise qui partage,
// et ne voit que ce projet, selon les opérations cochées (consulter / répondre / télécharger). v1 : le périmètre exact (documents/lots) est
// décrit en texte libre par l'administrateur qui partage et consulté par l'intervenant — pas encore de restriction automatique document par
// document. Les échanges (réponses, avis, réserves) sont journalisés sur le partage lui-même.
const SHARE_ENTITIES = [
  ['mo', "Maître d'ouvrage"], ['mod', "Maître d'ouvrage délégué"], ['architecte', 'Architecte'], ['bet', "BET (bureau d'études)"],
  ['bcontrole', 'Bureau de contrôle'], ['labo', 'Laboratoire'], ['topoext', 'Topographe externe'], ['soustraitant', 'Sous-traitant'],
  ['entreprise', 'Entreprise (lot)'], ['autre', 'Autre'],
];
const shareEntityLabel = (k) => (SHARE_ENTITIES.find(x => x[0] === k) || [k, k])[1];

// ---------- Services, rôles, permissions ----------
const SERVICES = [
  { k: 'direction', l: 'Direction', c: '#334155' }, { k: 'travaux', l: 'Travaux', c: '#2563eb' }, { k: 'ferraillage', l: 'Ferraillage', c: '#dc2626' },
  { k: 'centrale', l: 'Centrale à béton', c: '#64748b' }, { k: 'materiel', l: 'Matériel', c: '#ca8a04' }, { k: 'topo', l: 'Topographie', c: '#0d9488' },
  { k: 'qualite', l: 'Qualité', c: '#16a34a' }, { k: 'hse', l: 'HSE', c: '#ea580c' }, { k: 'metre', l: 'Métré', c: '#7c3aed' },
  { k: 'bim', l: 'Méthodes / BIM', c: '#0891b2' }, { k: 'logistique', l: 'Logistique', c: '#a16207' }, { k: 'externe', l: 'Intervenants externes', c: '#db2777' },
];
// modules (= droits) : projet (infos, rappels, constats, 3D…), plans, réserves, réception & bétonnage, photos, formulaires, rapports, constats, calculs, équipe, fichiers
const MODS = [['projet', 'Projet (infos, rappels, 3D)'], ['plans', 'Plans & maquettes'], ['reserves', 'Réserves / tâches'], ['reception', 'Réception & bétonnage'], ['photos', 'Photos'],
  ['forms', 'Formulaires / PV'], ['rapports', 'Rapports journaliers'], ['constats', 'Constats / NC'], ['calc', 'Calculs & topo'], ['equipe', 'Équipe du projet'], ['files', 'Fichiers'],
  ['topo', 'Topographie (implantations, levés)'], ['centrale', 'Centrale à béton (commandes, BL)'], ['materiel', 'Matériel & stock'], ['pointage', 'Pointage & effectifs'], ['hse', 'HSE (sécurité)']];
const LEVELS = ['Aucun accès', 'Voir', 'Modifier', 'Valider', 'Administrer'];
// droits par rôle : chiffres dans l'ordre de MODS (0 aucun · 1 voir · 2 modifier · 3 valider · 4 administrer)
const ROLES = [
  ['patron', 'Patron / Gérant', 'direction', '4444444444444444', 1], ['dirprojet', 'Directeur de projet', 'direction', '4444444444444444', 1],
  ['dirtravaux', 'Directeur travaux', 'travaux', '3333333333333333'], ['conducteur', 'Conducteur de travaux', 'travaux', '2233223222222232'],
  ['techtravaux', 'Technicien travaux', 'travaux', '2122222221222222'], ['chefchantier', 'Chef de chantier', 'travaux', '2122212221222222'],
  ['chefequipe', "Chef d'équipe", 'travaux', '1111201011211121'], ['caporal', 'Caporal', 'travaux', '1111201011211121'],
  ['condferraillage', 'Conducteur travaux ferraillage', 'ferraillage', '2233223222222232'], ['techferraillage', 'Technicien ferraillage', 'ferraillage', '2122222221222222'],
  ['chefchantierfer', 'Chef de chantier ferraillage', 'ferraillage', '2122212221222222'], ['chefequipefer', "Chef d'équipe ferrailleurs", 'ferraillage', '1111201011211121'],
  ['caporalfer', 'Caporal ferraillage', 'ferraillage', '1111201011211121'],
  ['respcentrale', 'Responsable centrale à béton', 'centrale', '1102102020204221'], ['pilotecentrale', 'Pilote centrale', 'centrale', '1001201010203011'],
  ['laborantin', 'Laborantin centrale', 'centrale', '1002222010202011'], ['chefparc', 'Chef de parc toupies', 'centrale', '1001201010203021'],
  ['chauffeur', 'Chauffeur toupie', 'centrale', '1001200000202001'], ['pompiste', 'Pompiste', 'centrale', '1001200000202001'],
  ['respmateriel', 'Responsable matériel', 'materiel', '1100202010200421'], ['magmateriel', 'Magasinier matériel', 'materiel', '1000201000200311'],
  ['mecanicien', 'Mécanicien', 'materiel', '1000201000200201'], ['conducteurengin', "Conducteur d'engins", 'materiel', '1000201000200101'],
  ['cheftopo', 'Chef topographe', 'topo', '2211222030241011'], ['techtopo', 'Technicien topographe', 'topo', '2100222020231011'], ['topoext', 'Topographe extérieur', 'topo', '1100220020221001'],
  ['respqualite', 'Responsable qualité', 'qualite', '2233231310221112'], ['techqualite', 'Technicien qualité', 'qualite', '2133221210221111'],
  ['resphse', 'Responsable HSE', 'hse', '2120231300211114'], ['animhse', 'Animateur HSE', 'hse', '2120220200211113'],
  ['metreur', 'Métreur', 'metre', '1211111130211110'], ['bimmanager', 'BIM manager', 'bim', '2300100020210000'], ['projeteur', 'Projeteur', 'bim', '1200000010210000'],
  ['magasinier', 'Magasinier', 'logistique', '1000201000200311'], ['resppointage', 'Responsable pointage', 'logistique', '1000102002200041'], ['pointeur', 'Pointeur', 'logistique', '1000102002200031'],
  ['mo', "Maître d'ouvrage", 'externe', '1111111101111001'], ['mod', "Maître d'ouvrage délégué", 'externe', '1111111101111001'], ['architecte', 'Architecte', 'externe', '1221101101110000'],
  ['bet', "BET (bureau d'études)", 'externe', '1221111211111001'], ['bcontrole', 'Bureau de contrôle', 'externe', '1121111201111001'], ['labo', 'Laboratoire', 'externe', '1001220000102000'],
  ['soustraitant', 'Sous-traitant', 'externe', '1120201001211011'],
].map(([k, l, s, p, adm]) => ({ k, l, s, perms: Object.fromEntries(MODS.map(([m], i) => [m, +p[i] || 0])), admin: !!adm }));
const roleOf = (k) => ROLES.find(r => r.k === k) || { k, l: k, s: 'externe', perms: {}, admin: false };
const serviceOf = (k) => SERVICES.find(s => s.k === k) || SERVICES[SERVICES.length - 1];
// magasin local → module (sous-collection Firestore)
const STORE_MOD = { projects: 'projet', folders: 'plans', plans: 'plans', links: 'plans', tasks: 'reserves', receptions: 'reception', forms: 'forms', reports: 'rapports', files: 'files', items: '*' };
// éléments des espaces (store « items ») : module selon le type
const KIND_MOD = { impl: 'topo', leve: 'topo', cmd: 'centrale', bl: 'centrale', mat: 'materiel', stock: 'materiel', pt: 'pointage', hse: 'hse', rdt: 'rapports' };
const modOf = (store, rec) => store === 'items' ? KIND_MOD[(rec || {}).kind] : STORE_MOD[store];
// section de l'application → module
const SECTION_MOD = { dashboard: 'projet', plans: 'plans', tasks: 'reserves', reception: 'reception', beton: 'reception', photos: 'photos', forms: 'forms', reports: 'rapports',
  constat: 'constats', models3d: 'plans', maquette: 'plans', calc: 'calc', team: 'equipe', settings: 'projet' };

const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signed() { return request.auth != null; }
    function memPath(cid) { return /databases/$(db)/documents/companies/$(cid)/members/$(request.auth.uid); }
    function isMem(cid) { return signed() && exists(memPath(cid)); }
    function mem(cid) { return get(memPath(cid)).data; }
    function isAdmin(cid) { return isMem(cid) && mem(cid).admin == true; }
    function lvl(cid, m) { return mem(cid).perms.get(m, 0); }
    function canProj(cid, pid) { return mem(cid).allProjects == true || pid in mem(cid).projects; }
    function inv(code) { return get(/databases/$(db)/documents/invites/$(code)).data; }

    match /users/{uid} { allow read, write: if signed() && request.auth.uid == uid; }

    match /invites/{code} {
      allow get: if signed();
      allow list: if signed() && isAdmin(resource.data.cid);
      allow create: if signed() && isAdmin(request.resource.data.cid);
      allow update: if signed() && (isAdmin(resource.data.cid) || (resource.data.used == false
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['used', 'usedBy', 'usedAt'])
        && request.resource.data.usedBy == request.auth.uid));
      allow delete: if signed() && isAdmin(resource.data.cid);
    }

    // partage externe (projet précis, accès limité) : créé/géré par l'entreprise propriétaire du projet ; l'intervenant externe
    // (compte d'une autre entreprise, ou sans entreprise) le récupère par code puis ne peut qu'ajouter des réponses, pas modifier le périmètre.
    match /shares/{code} {
      allow get: if signed();
      allow list: if signed() && (isAdmin(resource.data.cid) || resource.data.usedBy == request.auth.uid);
      allow create: if signed() && isAdmin(request.resource.data.cid);
      allow update: if signed() && (isAdmin(resource.data.cid)
        || (resource.data.used == false
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['used', 'usedBy', 'usedByName', 'usedAt'])
            && request.resource.data.usedBy == request.auth.uid)
        || (resource.data.usedBy == request.auth.uid && resource.data.ops.comment == true
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['responses'])));
      allow delete: if signed() && isAdmin(resource.data.cid);
    }

    // ---- Application Chantier (ma.chantier.app) : licences « CH- » et suivi, dans le MÊME projet Firebase.
    // Ces règles reproduisent exactement ce que fait www/js/licence.js (branche main) : les téléphones activés
    // par code n'ont pas de compte Firebase (le code sert de secret) ; seul le propriétaire crée et gère les licences.
    function licOwner() { return signed() && request.auth.token.get('email', '').lower() == 'abdessamad.daga94@gmail.com'; }
    function licOf(code) { return get(/databases/$(db)/documents/licences/$(code)).data; }
    match /licences/{code} {
      allow get: if true;
      allow list: if signed() && resource.data.ownerUid == request.auth.uid;
      allow create: if licOwner() && request.resource.data.ownerUid == request.auth.uid;
      allow update: if (signed() && resource.data.ownerUid == request.auth.uid)
        || (resource.data.status == 'active'
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['device', 'accepted', 'lastSeen', 'version'])
            && (resource.data.get('device', null) == null || resource.data.device.id == request.resource.data.device.id));
      allow delete: if signed() && resource.data.ownerUid == request.auth.uid;
      match /suivi/{id} {
        allow read: if signed() && licOf(code).ownerUid == request.auth.uid;
        allow write: if (signed() && licOf(code).ownerUid == request.auth.uid) || licOf(code).status == 'active';
      }
    }

    match /companies/{cid} {
      allow create: if signed() && request.resource.data.ownerUid == request.auth.uid;
      allow read: if isMem(cid);
      allow update: if isAdmin(cid);

      match /members/{uid} {
        allow read: if isMem(cid);
        allow create: if signed() && (isAdmin(cid) || (uid == request.auth.uid && (
          (get(/databases/$(db)/documents/companies/$(cid)).data.ownerUid == request.auth.uid)
          || (request.resource.data.invite is string
              && inv(request.resource.data.invite).cid == cid
              && inv(request.resource.data.invite).used == false
              && request.resource.data.role == inv(request.resource.data.invite).role
              && request.resource.data.perms == inv(request.resource.data.invite).perms
              && request.resource.data.admin == inv(request.resource.data.invite).admin
              && request.resource.data.allProjects == inv(request.resource.data.invite).allProjects
              && request.resource.data.projects == inv(request.resource.data.invite).projects))));
        allow update, delete: if isAdmin(cid);
      }
      match /private/{doc} {
        allow read: if isMem(cid);
        allow write: if isAdmin(cid);
      }
      match /projects/{pid} {
        allow read: if isMem(cid) && canProj(cid, pid);
        allow create: if isMem(cid) && lvl(cid, 'projet') >= 3;
        allow update: if isMem(cid) && canProj(cid, pid) && lvl(cid, 'projet') >= 2;
        allow delete: if isAdmin(cid);
        match /m/{mod}/r/{rid} {
          allow read: if isMem(cid) && canProj(cid, pid) && lvl(cid, mod) >= 1;
          allow write: if isMem(cid) && canProj(cid, pid) && lvl(cid, mod) >= 2;
        }
      }
    }
  }
}`;

const Team = (() => {
  const LS = {
    get(k, d = null) { try { const v = localStorage.getItem('team.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('team.' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('team.' + k); } catch (e) {} },
  };
  let fb = null, auth = null, fs = null;
  const S = { user: null, cid: LS.get('cid'), company: LS.get('company'), me: LS.get('me'), members: LS.get('members', []), ready: false };

  function init() {
    if (fb) return true;
    if (!window.firebase) return false;
    fb = firebase.apps.length ? firebase.app() : firebase.initializeApp(FB_CONFIG);
    auth = firebase.auth(); fs = firebase.firestore();
    const emu = /[?&]emu=1/.test(location.search);
    try { fs.settings(emu ? { experimentalForceLongPolling: true, merge: true } : { experimentalAutoDetectLongPolling: true, merge: true }); } catch (e) {}
    if (emu) { auth.useEmulator('http://127.0.0.1:9099'); fs.useEmulator('127.0.0.1', 8080); }
    return true;
  }
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();
  const withTimeout = (p, ms = 30000, msg = 'Délai dépassé (connexion lente ?)') => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
  const errMsg = (e) => {
    const c = (e && e.code) || '';
    return ({ 'auth/invalid-email': 'Adresse e-mail invalide', 'auth/user-not-found': 'Compte introuvable', 'auth/wrong-password': 'Mot de passe incorrect',
      'auth/invalid-credential': 'E-mail ou mot de passe incorrect', 'auth/invalid-login-credentials': 'E-mail ou mot de passe incorrect',
      'auth/email-already-in-use': 'Un compte existe déjà avec cet e-mail — connectez-vous', 'auth/weak-password': 'Mot de passe trop court (6 caractères minimum)',
      'auth/network-request-failed': 'Pas de connexion internet', 'auth/too-many-requests': 'Trop d\'essais, réessayez dans quelques minutes',
      'permission-denied': 'Accès refusé (droits insuffisants ou règles Firestore non installées)', 'unavailable': 'Serveur injoignable (internet ?)' })[c] || (e && e.message) || String(e);
  };

  // ---------- état ----------
  const lvl = (mod) => { if (!S.ready) return 4; if (!S.me) return 0; return (S.me.perms || {})[mod] ?? 0; };
  const canSection = (k) => lvl(SECTION_MOD[k] || 'projet') >= 1;
  const isAdmin = () => !S.ready || !!(S.me && S.me.admin);
  const myPlan = () => planOf((S.company || {}).plan || PLAN_DEFAULT_COMPANY);
  const canProject = (pid) => !S.ready || !!(S.me && (S.me.allProjects || (S.me.projects || []).includes(pid)));

  // ---------- démarrage : connexion obligatoire ----------
  async function boot() {
    if (!init()) { toast('Module de connexion absent — mode local'); return; }
    const user = await new Promise((res) => { const un = auth.onAuthStateChanged(u => { un(); res(u); }); });
    if (!user) { await loginScreen(); }
    S.user = auth.currentUser;
    await loadMembership();
    auth.onAuthStateChanged(u => { if (!u && S.ready) { S.ready = false; location.reload(); } });
  }
  async function loadMembership() {
    // profil + entreprise (cache local si hors connexion)
    let prof = null;
    try { const d = await withTimeout(fs.collection('users').doc(S.user.uid).get(), 15000); prof = d.exists ? d.data() : {}; LS.set('profile', prof); }
    catch (e) { prof = LS.get('profile'); if (!prof) { await alertBox('Connexion internet nécessaire pour la première ouverture.'); return loadMembership(); } }
    if (!prof.companyId) { await onboardScreen(); return loadMembership(); }
    S.cid = prof.companyId; LS.set('cid', S.cid);
    try {
      const [c, m] = await withTimeout(Promise.all([fs.collection('companies').doc(S.cid).get(), fs.collection('companies').doc(S.cid).collection('members').doc(S.user.uid).get()]), 15000);
      if (!m.exists) { await fs.collection('users').doc(S.user.uid).set({ companyId: null }, { merge: true }); await alertBox('Vous ne faites plus partie de cette entreprise.'); return loadMembership(); }
      S.company = { id: c.id, ...c.data() }; S.me = { uid: S.user.uid, ...m.data() };
      LS.set('company', S.company); LS.set('me', S.me);
    } catch (e) { if (!S.me || S.me.uid !== S.user.uid) { await alertBox('Connexion impossible : ' + errMsg(e)); return loadMembership(); } }
    S.ready = true;
    try { if (!localStorage.getItem('userName') && S.me.name) localStorage.setItem('userName', S.me.name.split(' ')[0]); localStorage.setItem('askedName', '1'); } catch (e) {}
    await refreshMembers();
    migratePerms();
    migrateCompanyPlan();
    syncDriveCfg();
  }
  async function refreshMembers() {
    try { const q = await fs.collection('companies').doc(S.cid).collection('members').get(); S.members = q.docs.map(d => ({ uid: d.id, ...d.data() })); LS.set('members', S.members);
      const me = S.members.find(x => x.uid === S.user.uid); if (me) { const changed = JSON.stringify(me.perms) !== JSON.stringify(S.me.perms) || me.role !== S.me.role || me.allProjects !== S.me.allProjects || JSON.stringify(me.projects) !== JSON.stringify(S.me.projects); S.me = me; LS.set('me', me); if (changed && !document.querySelector('.fullpage, .sheet-bg')) { try { App.project ? renderSection() : renderHome(); } catch (e) {} } } }
    catch (e) { console.warn('members', e); }
    return S.members;
  }
  // nouveaux modules (topo, centrale, matériel, pointage, HSE) : l'administrateur complète les droits de chacun selon son poste
  async function migratePerms() {
    if (!isAdmin()) return;
    for (const m of S.members) {
      const P = m.perms || {}, miss = MODS.filter(([k]) => !(k in P)).map(([k]) => k); if (!miss.length) continue;
      const R = roleOf(m.role), np = { ...P }; miss.forEach(k => { np[k] = m.admin ? 4 : (R.perms[k] || 0); });
      try { await fs.collection('companies').doc(S.cid).collection('members').doc(m.uid).update({ perms: np }); m.perms = np; if (m.uid === S.user.uid) { S.me.perms = np; LS.set('me', S.me); } } catch (e) { console.warn('migrate', e); }
    }
    LS.set('members', S.members);
  }
  // entreprises créées avant l'ajout des formules : leur donner une formule par défaut (une seule fois, par l'administrateur)
  async function migrateCompanyPlan() {
    if (!isAdmin() || S.company.plan) return;
    try { await fs.collection('companies').doc(S.cid).update({ plan: PLAN_DEFAULT_COMPANY, planStatus: 'essai' }); S.company.plan = PLAN_DEFAULT_COMPANY; S.company.planStatus = 'essai'; LS.set('company', S.company); } catch (e) { console.warn('plan migrate', e); }
  }
  // Drive de l'entreprise : l'administrateur connecte son script, les membres le reçoivent automatiquement
  async function syncDriveCfg() {
    try {
      const ref = fs.collection('companies').doc(S.cid).collection('private').doc('drive');
      const d = await ref.get(), remote = d.exists ? d.data() : null, local = Sync.cfg();
      const same = remote && local && local.url === remote.url && local.key === remote.key;
      // l'administrateur : son Drive (vérifié SiteTeam) fait foi ; les membres : celui de l'entreprise
      if (isAdmin() && local && local.url && !same) { if (await isSiteTeamScript(local)) await ref.set({ url: local.url, key: local.key, folder: local.folder || '', by: S.user.uid, at: ts() }); }
      else if (remote && remote.url && !same && await isSiteTeamScript(remote)) { localStorage.setItem('sync.cfg', JSON.stringify({ url: remote.url, key: remote.key, folder: remote.folder || '' })); Sync.start(); }
      // ancien code de Chantier connecté par erreur : on le retire de SiteTeam (les données de Chantier ne sont pas touchées)
      if (local && local.url && !(await isSiteTeamScript(local))) { localStorage.removeItem('sync.cfg'); if (isAdmin() && remote && remote.url === local.url) await ref.delete(); toast('Drive de Chantier détaché de SiteTeam — connectez le script SiteTeam'); }
    } catch (e) { console.warn('drive cfg', e); }
  }
  const _chk = {};
  async function isSiteTeamScript(c) {
    if (c.url in _chk) return _chk[c.url];
    try { const r = await fetch(c.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key: c.key, action: 'ping' }) }); const j = JSON.parse(await r.text()); _chk[c.url] = j.ok && j.app === 'siteteam'; }
    catch (e) { const http = window.Capacitor?.Plugins?.CapacitorHttp; if (!http) return true;
      try { const x = await http.post({ url: c.url, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, data: JSON.stringify({ key: c.key, action: 'ping' }), responseType: 'text' }); const j = JSON.parse(typeof x.data === 'string' ? x.data : JSON.stringify(x.data)); _chk[c.url] = j.ok && j.app === 'siteteam'; } catch (e2) { return true; } }
    return _chk[c.url];
  }
  async function shareDrive() {
    const c = Sync.cfg(); if (!c || !c.url) return alertBox('Connectez d\'abord Google Drive (Paramètres › Google Drive).');
    await fs.collection('companies').doc(S.cid).collection('private').doc('drive').set({ url: c.url, key: c.key, folder: c.folder || '', by: S.user.uid, at: ts() });
    toast('Drive partagé avec l\'équipe ✓');
  }

  // ---------- écran de connexion ----------
  function loginScreen() {
    return new Promise((resolve) => {
      const el = document.createElement('div'); el.className = 'fullpage tm-login';
      let mode = 'in';
      const draw = () => {
        el.innerHTML = `<div class="tm-lg-in"><div class="tm-logo">${icon('hard')}</div><h1>SiteTeam</h1><p>Toute l'équipe du chantier, au même endroit.</p>
          <div class="seg tm-seg"><button data-m="in" class="${mode === 'in' ? 'on' : ''}">Se connecter</button><button data-m="up" class="${mode === 'up' ? 'on' : ''}">Créer un compte</button></div>
          <div class="form">
            ${mode === 'up' ? `<label>Nom et prénom<input name="name" autocomplete="name" placeholder="Ex : Abdessamad …"></label>` : ''}
            <label>E-mail<input name="email" type="email" autocomplete="email" inputmode="email" placeholder="vous@exemple.com"></label>
            <label>Mot de passe<input name="pw" type="password" autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}" placeholder="6 caractères minimum"></label>
            <button class="btn" data-a="go">${mode === 'up' ? 'Créer mon compte' : 'Se connecter'}</button>
            ${mode === 'in' ? '<button class="linkbtn" data-a="reset">Mot de passe oublié ?</button>' : ''}
          </div></div>`;
        $$('[data-m]', el).forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
        $('[data-a=go]', el).onclick = go;
        const r = $('[data-a=reset]', el); if (r) r.onclick = async () => { const em = $('[name=email]', el).value.trim(); if (!em) return toast('Tapez d\'abord votre e-mail');
          try { await auth.sendPasswordResetEmail(em); alertBox('Un e-mail de réinitialisation a été envoyé à ' + em); } catch (e) { alertBox(errMsg(e)); } };
      };
      async function go() {
        const em = $('[name=email]', el).value.trim(), pw = $('[name=pw]', el).value, nm = mode === 'up' ? $('[name=name]', el).value.trim() : '';
        if (mode === 'up' && !nm) return toast('Tapez votre nom');
        const ld = loading(mode === 'up' ? 'Création du compte…' : 'Connexion…');
        try {
          if (mode === 'up') { const c = await auth.createUserWithEmailAndPassword(em, pw); await c.user.updateProfile({ displayName: nm }); await fs.collection('users').doc(c.user.uid).set({ name: nm, email: em, createdAt: ts() }, { merge: true }); }
          else await auth.signInWithEmailAndPassword(em, pw);
          ld.close(); el.remove(); resolve();
        } catch (e) { ld.close(); alertBox(errMsg(e)); }
      }
      draw(); document.body.appendChild(el);
    });
  }

  // ---------- créer ou rejoindre une entreprise ----------
  function onboardScreen() {
    return new Promise((resolve) => {
      const el = document.createElement('div'); el.className = 'fullpage tm-login';
      const nm = (auth.currentUser.displayName || '').split(' ')[0];
      el.innerHTML = `<div class="tm-lg-in"><div class="tm-logo">${icon('team')}</div><h1>Bienvenue${nm ? ' ' + esc(nm) : ''}</h1><p>Rejoignez l'équipe de votre entreprise, ou créez-la si vous êtes le responsable.</p>
        <div class="tm-choice"><button data-a="join"><b>🔑 J'ai un code d'invitation</b><span>Donné par votre responsable</span></button>
        <button data-a="create"><b>🏢 Créer mon entreprise</b><span>Patron, directeur de projet… vous invitez ensuite l'équipe</span></button></div>
        <button class="linkbtn" data-a="out">Se déconnecter (${esc(auth.currentUser.email || '')})</button></div>`;
      document.body.appendChild(el);
      const done = () => { el.remove(); resolve(); };
      $('[data-a=out]', el).onclick = async () => { await auth.signOut(); LS.del('me'); LS.del('cid'); location.reload(); };
      $('[data-a=create]', el).onclick = async () => {
        const r = await formSheet('Créer mon entreprise', [{ name: 'name', label: 'Nom de l\'entreprise', placeholder: 'Ex : Entreprise BTP …' },
          { name: 'me', label: 'Votre nom', value: auth.currentUser.displayName || '' },
          { name: 'role', label: 'Votre poste', type: 'select', value: 'patron', options: ROLES.filter(x => x.admin).map(x => ({ value: x.k, label: x.l })) }], { okLabel: 'Créer' });
        if (!r || !r.name) return;
        const ld = loading('Création de l\'entreprise…');
        try {
          const uid = auth.currentUser.uid, ref = fs.collection('companies').doc();
          await withTimeout(ref.set({ name: r.name, ownerUid: uid, plan: PLAN_DEFAULT_COMPANY, planStatus: 'essai', createdAt: ts() }));
          const R = roleOf(r.role);
          await withTimeout(ref.collection('members').doc(uid).set({ name: r.me || auth.currentUser.displayName || '', email: auth.currentUser.email, role: R.k, service: R.s, perms: R.perms, admin: true, allProjects: true, projects: [], managerUid: null, zone: '', createdAt: ts() }));
          await withTimeout(fs.collection('users').doc(uid).set({ companyId: ref.id, name: r.me || '' }, { merge: true }));
          ld.close(); toast('Entreprise créée ✓'); done();
        } catch (e) { ld.close(); alertBox(errMsg(e) + (e.code === 'permission-denied' ? '\n\nLes règles de sécurité Firestore sont-elles installées ?' : '')); }
      };
      $('[data-a=join]', el).onclick = async () => {
        const r = await formSheet('Rejoindre l\'entreprise', [{ name: 'code', label: 'Code d\'invitation', placeholder: 'Ex : K7M2QX9P' }], { okLabel: 'Rejoindre' });
        if (!r || !r.code) return;
        const code = r.code.toUpperCase().replace(/[^A-Z0-9]/g, ''), ld = loading('Vérification du code…');
        try {
          const iv = await withTimeout(fs.collection('invites').doc(code).get());
          if (!iv.exists) throw new Error('Code introuvable');
          const I = iv.data(); if (I.used) throw new Error('Ce code a déjà été utilisé — demandez un nouveau code');
          const uid = auth.currentUser.uid;
          await withTimeout(fs.collection('companies').doc(I.cid).collection('members').doc(uid).set({ name: auth.currentUser.displayName || I.name || '', email: auth.currentUser.email, role: I.role, service: I.service, perms: I.perms, admin: I.admin, allProjects: I.allProjects, projects: I.projects, managerUid: I.managerUid || null, zone: I.zone || '', invite: code, createdAt: ts() }));
          await withTimeout(fs.collection('invites').doc(code).update({ used: true, usedBy: uid, usedAt: ts() }));
          await withTimeout(fs.collection('users').doc(uid).set({ companyId: I.cid }, { merge: true }));
          ld.close(); toast(`Bienvenue chez ${I.companyName || 'votre entreprise'} ✓`); done();
        } catch (e) { ld.close(); alertBox(errMsg(e)); }
      };
    });
  }

  // ---------- synchronisation des données (remplace db.json de Drive) ----------
  const projRef = (pid) => fs.collection('companies').doc(S.cid).collection('projects').doc(pid);
  async function push(records) {
    if (!S.ready) return;
    const ok = records.filter(r => { const m = modOf(r._store, r); return m && lvl(m) >= 2 && (r._store === 'projects' ? (canProject(r.id) || lvl('projet') >= 3) : canProject(r.projectId)); });
    const skipped = records.length - ok.length;
    for (let i = 0; i < ok.length; i += 400) {
      const b = fs.batch();
      for (const r of ok.slice(i, i + 400)) {
        const { _store, _deleted, ...rec } = r, mod = modOf(_store, r), pid = _store === 'projects' ? rec.id : rec.projectId;
        if (!pid) continue;
        const doc = projRef(pid).collection('m').doc(mod).collection('r').doc(`${_store}__${rec.id}`);
        b.set(doc, { store: _store, id: rec.id, projectId: pid, kind: rec.kind || null, updatedAt: rec.updatedAt || Date.now(), deleted: !!_deleted, data: _deleted ? '' : JSON.stringify(rec), by: S.user.uid, srv: ts() });
        if (_store === 'projects') b.set(projRef(pid), { name: rec.name || '', address: rec.address || '', deleted: !!_deleted, updatedAt: rec.updatedAt || Date.now(), by: S.user.uid }, { merge: true });
      }
      await withTimeout(b.commit(), 45000);
    }
    return { skipped };
  }
  async function projectIds() {
    if (S.me.allProjects) { const q = await fs.collection('companies').doc(S.cid).collection('projects').get(); return q.docs.filter(d => !d.data().deleted).map(d => d.id); }
    return S.me.projects || [];
  }
  async function pull() {
    if (!S.ready) return { records: [], now: Date.now() };
    await refreshMembers();
    const since = LS.get('pullAt', {}), out = [];
    const pids = await withTimeout(projectIds(), 30000);
    const mods = [...new Set([...Object.values(STORE_MOD), ...Object.values(KIND_MOD)])].filter(m => m !== '*' && lvl(m) >= 1);
    for (const pid of pids) for (const mod of mods) {
      const key = pid + '/' + mod, t = since[key] || 0;
      let q = projRef(pid).collection('m').doc(mod).collection('r');
      if (t) q = q.where('srv', '>', firebase.firestore.Timestamp.fromMillis(t));
      const snap = await withTimeout(q.get(), 45000);
      let mx = t;
      snap.forEach(d => { const x = d.data(); const s = x.srv ? x.srv.toMillis() : 0; if (s > mx) mx = s;
        if (x.deleted) out.push({ _store: x.store, id: x.id, projectId: x.projectId, kind: x.kind, _deleted: true, updatedAt: x.updatedAt });
        else { try { out.push({ ...JSON.parse(x.data), _store: x.store }); } catch (e) {} } });
      since[key] = mx;
    }
    LS.set('pullAt', since);
    return { records: out, now: Date.now() };
  }
  function resetPull() { LS.del('pullAt'); }

  // ---------- invitations ----------
  const newCode = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; return Array.from(crypto.getRandomValues(new Uint8Array(8)), b => A[b % A.length]).join(''); };
  const apkLink = () => `https://github.com/abdessamadwanted-sudo/Chantierpro/releases/download/siteteam-v${APP_VERSION.startsWith('__') ? '1.0.1' : APP_VERSION}/SiteTeam.apk`;
  async function createInvite(o) {
    const R = roleOf(o.role), code = newCode();
    const inv = { cid: S.cid, companyName: S.company.name, name: o.name || '', role: R.k, service: R.s, perms: o.perms || R.perms, admin: !!o.admin, allProjects: !!o.allProjects, projects: o.allProjects ? [] : (o.projects || []),
      managerUid: o.managerUid || null, zone: o.zone || '', used: false, createdBy: S.user.uid, createdAt: ts() };
    await withTimeout(fs.collection('invites').doc(code).set(inv));
    return code;
  }
  function shareInvite(code, o) {
    const R = roleOf(o.role);
    const txt = `Bonjour${o.name ? ' ' + o.name : ''},\nRejoignez l'équipe *${S.company.name}* sur SiteTeam (${R.l}).\n\n1️⃣ Installez l'application : ${apkLink()}\n2️⃣ Créez votre compte\n3️⃣ « J'ai un code d'invitation » → *${code}*`;
    openUrl('https://wa.me/?text=' + encodeURIComponent(txt));
  }

  // ---------- partage externe (projet précis, accès limité) ----------
  async function createShare(p, o) {
    const code = newCode();
    const sh = { cid: S.cid, companyName: S.company.name, pid: p.id, projectName: p.name, entity: o.entity, label: o.label || '', contact: o.contact || '',
      scope: o.scope || '', ops: o.ops, dueDate: o.dueDate || '', used: false, createdBy: S.user.uid, createdByName: (S.me || {}).name || '', createdAt: ts(), responses: [] };
    await withTimeout(fs.collection('shares').doc(code).set(sh));
    return code;
  }
  function shareMsg(code, sh) {
    const opsTxt = [sh.ops.view && 'consulter', sh.ops.comment && 'répondre', sh.ops.download && 'télécharger'].filter(Boolean).join(', ');
    const txt = `Bonjour${sh.label ? ' ' + sh.label : ''},\n${S.company.name} vous donne un accès limité au projet *${sh.projectName}* sur SiteTeam (${shareEntityLabel(sh.entity)}).\n` +
      `Accès autorisé : ${opsTxt || '—'}${sh.scope ? `\nContenu partagé : ${sh.scope}` : ''}${sh.dueDate ? `\nJusqu'au : ${sh.dueDate}` : ''}\n\n` +
      `1️⃣ Installez l'application : ${apkLink()}\n2️⃣ Créez votre compte (ou connectez-vous avec le vôtre)\n3️⃣ Mon compte › « Accès externe reçu » → code *${code}*`;
    openUrl('https://wa.me/?text=' + encodeURIComponent(txt));
  }
  function shareForm(o = {}) {
    return new Promise((resolve) => {
      const ops0 = { view: true, comment: true, download: false, ...(o.ops || {}) };
      const s = sheet(`<div class="form tm-form">
        <label>Type d'intervenant<select data-f="entity">${SHARE_ENTITIES.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label>
        <label>Nom (entreprise / personne)<input data-f="label" value="${esc(o.label || '')}" placeholder="Ex : BET Structura"></label>
        <label>Téléphone / e-mail (optionnel)<input data-f="contact" value="${esc(o.contact || '')}"></label>
        <label>Contenu partagé (documents, lots…)<textarea data-f="scope" placeholder="Ex : Plans du lot gros œuvre, PV de réception du 3e étage">${esc(o.scope || '')}</textarea></label>
        <label>Date limite (optionnel)<input data-f="dueDate" type="date" value="${esc(o.dueDate || '')}"></label>
        <div class="fld">Opérations autorisées</div>
        <label class="tm-ck"><input type="checkbox" data-op="view"> Consulter le projet</label>
        <label class="tm-ck"><input type="checkbox" data-op="comment"> Répondre / commenter</label>
        <label class="tm-ck"><input type="checkbox" data-op="download"> Télécharger les fichiers</label>
        <p style="font-size:12.5px;color:var(--muted)">L'intervenant garde son propre compte SiteTeam : il ne devient pas membre de votre entreprise et ne voit que ce projet, selon ce qui est coché ici.</p>
        <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="ok">Créer le partage</button></div></div>`,
        { title: 'Partager avec un intervenant externe' });
      s.onClose = () => resolve(null);
      const E = s.el, f = (k) => $(`[data-f=${k}]`, E);
      f('entity').value = o.entity || 'entreprise';
      $$('[data-op]', E).forEach(c => c.checked = !!ops0[c.dataset.op]);
      $('[data-a=c]', E).onclick = () => s.close();
      $('[data-a=ok]', E).onclick = () => {
        const out = { entity: f('entity').value, label: f('label').value.trim(), contact: f('contact').value.trim(), scope: f('scope').value.trim(), dueDate: f('dueDate').value,
          ops: Object.fromEntries($$('[data-op]', E).map(c => [c.dataset.op, c.checked])) };
        if (!out.label) return alertBox('Indiquez le nom de l\'entreprise ou de la personne.');
        s.onClose = null; s.close(); resolve(out);
      };
    });
  }
  async function shareFlow(p) {
    const o = await shareForm();
    if (!o) return null;
    const ld = loading('Création du partage…');
    try {
      const code = await createShare(p, o); ld.close();
      const v = await menu(`Code : ${code}`, [{ label: 'Envoyer par WhatsApp', icon: 'share', value: 'wa' }, { label: 'Copier le code', icon: 'file', value: 'cp' }, { label: 'Fermer', icon: 'check', value: 'ok' }]);
      if (v === 'wa') shareMsg(code, { ...o, projectName: p.name });
      if (v === 'cp') copyText(code);
      return code;
    } catch (e) { ld.close(); alertBox(errMsg(e)); return null; }
  }
  async function projectShares(pid) {
    try { const q = await fs.collection('shares').where('cid', '==', S.cid).where('pid', '==', pid).get(); return q.docs.map(d => ({ code: d.id, ...d.data() })); }
    catch (e) { console.warn('shares', e); return []; }
  }
  async function revokeShare(code) {
    if (!await confirmBox('Révoquer ce partage ? L\'intervenant externe perdra l\'accès.', 'Révoquer')) return false;
    await fs.collection('shares').doc(code).delete(); toast('Partage révoqué ✓'); return true;
  }
  function viewShareLog(x) {
    sheet(`<div class="tm-box"><b>${esc(x.label || shareEntityLabel(x.entity))}</b><small>${esc(shareEntityLabel(x.entity))}${x.contact ? ' · ' + esc(x.contact) : ''}</small></div>
      ${x.scope ? `<div class="tm-box"><b>Contenu partagé</b><p>${esc(x.scope)}</p></div>` : ''}
      <div class="tm-box"><b>Réponses / journal</b>${(x.responses || []).length ? (x.responses || []).map(r => `<p style="margin:6px 0"><b>${esc(r.byName || '?')}</b> — ${esc(r.text)}</p>`).join('') : '<p>Aucune réponse pour l\'instant.</p>'}</div>`,
      { title: 'Journal du partage' });
  }
  async function openProjectShares(p) {
    if (!isAdmin() && lvl('equipe') < 3) return alertBox('Droit insuffisant pour gérer le partage externe (niveau « Valider » sur Équipe du projet requis).');
    const s = sheet('<div class="shr-wrap"></div>', { title: 'Intervenants externes' });
    const wrap = $('.shr-wrap', s.el);
    const draw = async () => {
      const L = await projectShares(p.id);
      wrap.innerHTML = `<p style="font-size:13px;color:var(--muted);margin:0 0 10px">Donnez un accès limité et journalisé à ce projet à une entreprise ou personne externe (maître d'ouvrage, BET, sous-traitant…), sans l'ajouter à votre entreprise.</p>
        <button class="btn" data-a="add">${icon('plus')} Partager avec un intervenant</button>
        <div class="list" style="margin-top:12px">${L.map(x => `<div class="tm-inv" data-code="${esc(x.code)}"><b class="tm-code">${esc(x.code)}</b><span class="grow">${esc(x.label || shareEntityLabel(x.entity))}
          <small>${esc(shareEntityLabel(x.entity))}${x.dueDate ? ' · jusqu\'au ' + esc(x.dueDate) : ''}${x.used ? ' · utilisé par ' + esc(x.usedByName || '?') : ' · pas encore utilisé'}${(x.responses || []).length ? ' · ' + x.responses.length + ' réponse(s)' : ''}</small></span>
          <button class="iconbtn sm" data-sh="${esc(x.code)}">${icon('share')}</button><button class="iconbtn sm" data-del="${esc(x.code)}">${icon('trash')}</button></div>`).join('') || '<div class="empty">Aucun partage externe pour ce projet.</div>'}</div>`;
      $('[data-a=add]', wrap).onclick = async () => { if (await shareFlow(p)) draw(); };
      $$('[data-sh]', wrap).forEach(b => b.onclick = () => { const x = L.find(i => i.code === b.dataset.sh); if (x) shareMsg(x.code, x); });
      $$('[data-del]', wrap).forEach(b => b.onclick = async () => { if (await revokeShare(b.dataset.del)) draw(); });
      $$('[data-code]', wrap).forEach(r => r.onclick = (e) => { if (e.target.closest('[data-sh],[data-del]')) return; const x = L.find(i => i.code === r.dataset.code); if (x) viewShareLog(x); });
    };
    await draw();
  }

  // ---------- accès externe reçu (soi-même intervenant sur le projet d'une autre entreprise) ----------
  async function claimShare() {
    const r = await formSheet('Accès externe reçu', [{ name: 'code', label: 'Code reçu (WhatsApp, e-mail…)', placeholder: 'Ex : AB3K9XYZ' }], { okLabel: 'Accéder' });
    if (!r || !r.code) return;
    const code = r.code.trim().toUpperCase();
    const ld = loading('Vérification…');
    let d; try { d = await withTimeout(fs.collection('shares').doc(code).get()); } catch (e) { ld.close(); return alertBox(errMsg(e)); }
    if (!d.exists) { ld.close(); return alertBox('Code introuvable.'); }
    const sh = d.data();
    if (sh.used && sh.usedBy !== S.user.uid) { ld.close(); return alertBox('Ce code a déjà été utilisé par quelqu\'un d\'autre.'); }
    try {
      if (!sh.used) { await fs.collection('shares').doc(code).update({ used: true, usedBy: S.user.uid, usedByName: (S.me || {}).name || S.user.email || '', usedAt: ts() }); sh.used = true; sh.usedBy = S.user.uid; }
      ld.close(); viewSharedAccess(code, sh);
    } catch (e) { ld.close(); alertBox(errMsg(e)); }
  }
  async function myShares() {
    try { const q = await fs.collection('shares').where('usedBy', '==', S.user.uid).get(); return q.docs.map(d => ({ code: d.id, ...d.data() })); }
    catch (e) { console.warn('myShares', e); return []; }
  }
  function viewSharedAccess(code, sh) {
    const opsTxt = [sh.ops.view && 'Consulter', sh.ops.comment && 'Répondre', sh.ops.download && 'Télécharger'].filter(Boolean).join(' · ');
    const s = sheet('<div class="shr-wrap"></div>', { title: sh.projectName || 'Projet partagé' });
    const wrap = $('.shr-wrap', s.el);
    const draw = () => {
      wrap.innerHTML = `<div class="tm-box"><b>${esc(sh.companyName || '')}</b><small>${esc(sh.projectName || '')} · ${esc(shareEntityLabel(sh.entity))}</small>
          <small>Opérations autorisées : ${opsTxt || '—'}</small>${sh.dueDate ? `<small>Jusqu'au ${esc(sh.dueDate)}</small>` : ''}</div>
        ${sh.scope ? `<div class="tm-box"><b>Contenu partagé</b><p>${esc(sh.scope)}</p></div>` : ''}
        <div class="tm-box"><b>Échanges</b>${(sh.responses || []).length ? sh.responses.map(r => `<p style="margin:6px 0"><b>${esc(r.byName || '?')}</b> — ${esc(r.text)}</p>`).join('') : '<p>Aucun échange pour l\'instant.</p>'}</div>
        ${sh.ops.comment ? `<div class="form"><label>Votre réponse<textarea data-reply placeholder="Écrire une réponse, un avis, une réserve…"></textarea></label><button class="btn" data-a="send">${icon('check')} Envoyer</button></div>`
          : '<p style="font-size:12.5px;color:var(--muted)">Vous ne pouvez que consulter ce projet (réponse non autorisée).</p>'}`;
      const send = $('[data-a=send]', wrap); if (send) send.onclick = async () => {
        const t = $('[data-reply]', wrap).value.trim(); if (!t) return;
        const entry = { byName: (S.me || {}).name || S.user.email || '', text: t, at: Date.now() };
        try { await fs.collection('shares').doc(code).update({ responses: firebase.firestore.FieldValue.arrayUnion(entry) }); sh.responses = [...(sh.responses || []), entry]; draw(); toast('Envoyé ✓'); }
        catch (e) { alertBox(errMsg(e)); }
      };
    };
    draw();
  }

  // ---------- page « Mon entreprise » ----------
  async function openCompany(tab = 'org') {
    if (!S.ready) return;
    const el = document.createElement('div'); el.className = 'fullpage tm-page';
    document.body.appendChild(el);
    const unBack = pushBack(() => el.remove());
    const projects = (await DB.all('projects')).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const pname = (id) => (projects.find(p => p.id === id) || {}).name || '?';
    const draw = async () => {
      const M = S.members, byUid = Object.fromEntries(M.map(m => [m.uid, m]));
      const tabs = [['org', 'Organigramme'], ['mem', 'Membres'], ...(isAdmin() ? [['inv', 'Invitations'], ['set', 'Réglages']] : []), ['me', 'Mon compte']];
      el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:17px">${esc(S.company.name)}</h1>
          ${isAdmin() ? `<button class="btn small" data-a="invite" style="flex:none">${icon('plus')} Inviter</button>` : ''}</div>
        <div class="tm-tabs">${tabs.map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="tm-body"></div>`;
      $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
      $$('[data-t]', el).forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
      const inv = $('[data-a=invite]', el); if (inv) inv.onclick = () => inviteFlow().then(c => { if (c) { tab = 'inv'; draw(); } });
      const body = $('.tm-body', el);
      const av = (m) => `<span class="tm-av" style="background:${serviceOf(m.service).c}">${esc(String(m.name || m.email || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase())}</span>`;
      const card = (m) => `<button class="tm-mem" data-uid="${m.uid}">${av(m)}<span class="grow"><b>${esc(m.name || m.email)}</b><small>${esc(roleOf(m.role).l)}${m.zone ? ' · ' + esc(m.zone) : ''}${m.admin ? ' · admin' : ''}</small></span>${m.uid === S.user.uid ? '<i class="tm-me">moi</i>' : ''}</button>`;
      if (tab === 'org') {
        const rIdx = (m) => ROLES.findIndex(r => r.k === m.role);
        const tree = (list, parent, depth) => list.filter(m => (m.managerUid || null) === parent || (depth === 0 && m.managerUid && !list.some(x => x.uid === m.managerUid)))
          .sort((a, b) => rIdx(a) - rIdx(b)).map(m => `<div class="tm-node" style="--d:${depth}">${card(m)}</div>${tree(list, m.uid, depth + 1)}`).join('');
        body.innerHTML = SERVICES.map(s => { const L = M.filter(m => (m.service || roleOf(m.role).s) === s.k); if (!L.length) return '';
          return `<div class="tm-svc"><div class="tm-svc-h" style="--c:${s.c}"><i></i>${s.l}<span>${L.length}</span></div>${tree(L, null, 0)}</div>`; }).join('') || '<div class="empty">Aucun membre.</div>';
      }
      if (tab === 'mem') body.innerHTML = `<div class="list">${M.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(m => `<div class="tm-row">${card(m)}<div class="tm-sub">${m.allProjects ? 'Tous les projets' : (m.projects || []).map(pname).join(', ') || 'Aucun projet'}${m.managerUid && byUid[m.managerUid] ? ' · sous ' + esc(byUid[m.managerUid].name) : ''}</div></div>`).join('')}</div>`;
      if (tab === 'inv') {
        let L = []; try { const q = await fs.collection('invites').where('cid', '==', S.cid).get(); L = q.docs.map(d => ({ code: d.id, ...d.data() })).filter(x => !x.used); } catch (e) { body.innerHTML = `<div class="empty">${esc(errMsg(e))}</div>`; return; }
        body.innerHTML = L.length ? `<div class="list">${L.map(x => `<div class="tm-inv"><b class="tm-code">${x.code}</b><span class="grow">${esc(x.name || '—')}<small>${esc(roleOf(x.role).l)} · ${x.allProjects ? 'tous les projets' : (x.projects || []).map(pname).join(', ')}</small></span>
          <button class="iconbtn sm" data-sh="${x.code}">${icon('share')}</button><button class="iconbtn sm" data-del="${x.code}">${icon('trash')}</button></div>`).join('')}</div>`
          : '<div class="empty">Aucune invitation en attente.<br>Touchez <b>Inviter</b> pour ajouter un membre.</div>';
        $$('[data-sh]', body).forEach(b => b.onclick = () => { const x = L.find(i => i.code === b.dataset.sh); shareInvite(x.code, x); });
        $$('[data-del]', body).forEach(b => b.onclick = async () => { if (await confirmBox('Annuler cette invitation ?', 'Annuler l\'invitation')) { await fs.collection('invites').doc(b.dataset.del).delete(); draw(); } });
      }
      if (tab === 'set') {
        const c = Sync.cfg(), P = myPlan(), nUsers = S.members.length, over = nUsers > P.users;
        body.innerHTML = `<div class="form">
          <div class="tm-box"><b>📦 Abonnement</b>
            <p>Formule <b>${esc(P.l)}</b>${P.price ? ` · ${P.price} MAD/${P.period}` : ' · gratuite'} · ${P.users} compte(s) inclus${P.extraUserPrice ? ` (puis ${P.extraUserPrice} MAD/mois par compte supplémentaire)` : ''} · ${P.storageGb} Go de stockage.</p>
            <div style="color:${over ? '#ef4444' : 'var(--muted)'}">${nUsers} / ${P.users} compte(s) utilisé(s)${over ? ' — au-delà du quota inclus' : ''}</div>
            <p style="font-size:12.5px;color:var(--muted)">La facturation en ligne n'est pas encore activée — ceci affiche la formule prévue. Un membre invité par l'entreprise n'a pas besoin d'un abonnement personnel : seule l'entreprise est facturée.</p>
            <div class="btnrow" style="padding:0"><button class="btn ghost small" data-a="planchange">Demander un changement de formule</button></div></div>
          <div class="tm-box"><b>☁ Google Drive de l'entreprise</b><p>Les plans, photos et PDF de toute l'équipe sont rangés dans ce Drive. Les membres le reçoivent automatiquement.</p>
            <div>${c && c.url ? '<span style="color:#22c55e">✓ Connecté</span>' : '<span style="color:#f59e0b">Non connecté — les fichiers restent sur chaque téléphone</span>'}</div>
            <div class="btnrow" style="padding:0"><button class="btn ghost small" data-a="drive">${c && c.url ? 'Réglages Drive' : 'Connecter Google Drive'}</button>${c && c.url ? '<button class="btn ghost small" data-a="share">Partager avec l\'équipe</button>' : ''}</div></div>
          <div class="tm-box"><b>📥 Importer depuis l'application Chantier</b><p>Récupère vos projets (tableaux, réserves, plans, photos…) depuis le code de connexion Drive de Chantier.</p>
            <button class="btn ghost small" data-a="import">Importer des projets</button></div>
          <div class="tm-box"><b>🔒 Règles de sécurité Firestore</b><p>À coller une seule fois dans la console Firebase › Firestore Database › Règles › Publier.</p>
            <button class="btn ghost small" data-a="rules">Copier les règles</button></div>
          <div class="tm-box"><b>🏢 Entreprise</b><button class="btn ghost small" data-a="ren">Renommer l'entreprise</button></div></div>`;
        $('[data-a=drive]', body).onclick = () => Sync.openSyncSettings();
        const sh = $('[data-a=share]', body); if (sh) sh.onclick = shareDrive;
        $('[data-a=import]', body).onclick = () => importChantier();
        $('[data-a=rules]', body).onclick = () => copyText(FIRESTORE_RULES);
        $('[data-a=ren]', body).onclick = async () => { const r = await formSheet('Entreprise', [{ name: 'n', label: 'Nom', value: S.company.name }]); if (r && r.n) { await fs.collection('companies').doc(S.cid).update({ name: r.n }); S.company.name = r.n; LS.set('company', S.company); draw(); } };
        $('[data-a=planchange]', body).onclick = () => { const body2 = encodeURIComponent(`Bonjour, je souhaite changer la formule de « ${S.company.name} » (actuellement ${myPlan().l}).`); openUrl(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Changement de formule SiteTeam')}&body=${body2}`); };
      }
      if (tab === 'me') {
        const R = roleOf(S.me.role), mine = await myShares();
        body.innerHTML = `<div class="tm-box tm-mecard">${av(S.me)}<div><b>${esc(S.me.name || '')}</b><small>${esc(S.user.email || '')}</small><small>${esc(R.l)} · ${esc(serviceOf(S.me.service).l)}</small></div></div>
          <div class="tm-box"><b>Mes droits</b>${permTable(S.me.perms)}</div>
          <div class="tm-box"><b>📨 Accès externe reçu</b><p>Un client, un BET ou une autre entreprise vous a envoyé un code pour accéder à un seul de leurs projets ? Entrez-le ici — cela ne touche pas à « ${esc(S.company.name)} ».</p>
            <div class="btnrow" style="padding:0"><button class="btn ghost small" data-a="claim">Entrer un code</button></div>
            ${mine.length ? `<div class="list" style="margin-top:4px">${mine.map(x => `<div class="tm-inv" data-shcode="${esc(x.code)}"><span class="grow">${esc(x.projectName || '?')}<small>${esc(x.companyName || '')} · ${esc(shareEntityLabel(x.entity))}</small></span></div>`).join('')}</div>` : ''}</div>
          <button class="btn ghost" data-a="name">${icon('edit')} Modifier mon nom</button>
          <button class="btn danger" data-a="out">Se déconnecter</button>`;
        $('[data-a=out]', body).onclick = logout;
        $('[data-a=claim]', body).onclick = async () => { await claimShare(); draw(); };
        $$('[data-shcode]', body).forEach(r => r.onclick = () => { const x = mine.find(i => i.code === r.dataset.shcode); if (x) viewSharedAccess(x.code, x); });
        $('[data-a=name]', body).onclick = async () => { const r = await formSheet('Mon nom', [{ name: 'n', label: 'Nom et prénom', value: S.me.name || '' }]); if (r && r.n) { try { await auth.currentUser.updateProfile({ displayName: r.n }); if (isAdmin()) await fs.collection('companies').doc(S.cid).collection('members').doc(S.user.uid).update({ name: r.n }); S.me.name = r.n; LS.set('me', S.me); toast('Enregistré ✓'); draw(); } catch (e) { alertBox(errMsg(e)); } } };
      }
      $$('[data-uid]', body).forEach(b => b.onclick = async () => {
        const m = S.members.find(x => x.uid === b.dataset.uid); if (!isAdmin()) return showMember(m);
        const v = m.uid === S.user.uid ? 'edit' : await menu(m.name || m.email, [{ label: 'Poste, projets et droits', icon: 'edit', value: 'edit' }, { label: 'Voir ses droits', icon: 'team', value: 'see' }, { label: 'Retirer de l\'entreprise', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'see') showMember(m);
        if (v === 'edit' && await editMember(m, projects)) { await refreshMembers(); draw(); }
        if (v === 'del' && await removeMember(m)) { await refreshMembers(); draw(); }
      });
    };
    await refreshMembers(); draw();
  }
  const permTable = (P = {}) => `<div class="tm-perms">${MODS.filter(([m]) => m !== 'files').map(([m, l]) => `<div><span>${l}</span><b class="lv${P[m] || 0}">${LEVELS[P[m] || 0]}</b></div>`).join('')}</div>`;
  function showMember(m) { const R = roleOf(m.role); sheet(`<div class="tm-box tm-mecard"><div><b>${esc(m.name || '')}</b><small>${esc(m.email || '')}</small><small>${esc(R.l)} · ${esc(serviceOf(m.service).l)}${m.zone ? ' · ' + esc(m.zone) : ''}</small></div></div>${permTable(m.perms)}`, { title: m.name || 'Membre' }); }
  function copyText(t) { navigator.clipboard.writeText(t).then(() => toast('Copié ✓'), () => alertBox(t)); }

  // formulaire commun : rôle, responsable, projets, zone, droits
  function memberForm(title, o, projects, okLabel) {
    return new Promise((resolve) => {
      const st = { role: o.role || 'conducteur', managerUid: o.managerUid || '', allProjects: o.allProjects !== false && !(o.projects || []).length, projects: [...(o.projects || [])], zone: o.zone || '', name: o.name || '', admin: !!o.admin, perms: { ...(o.perms || roleOf(o.role || 'conducteur').perms) }, custom: false };
      const s = sheet(`<div class="form tm-form">
        ${o.withName ? '<label>Nom (optionnel)<input data-f="name" placeholder="Ex : Youssef (chef de chantier zone 11)"></label>' : ''}
        <label>Poste<select data-f="role">${SERVICES.map(sv => `<optgroup label="${esc(sv.l)}">${ROLES.filter(r => r.s === sv.k).map(r => `<option value="${r.k}">${esc(r.l)}</option>`).join('')}</optgroup>`).join('')}</select></label>
        <label>Responsable direct<select data-f="managerUid"><option value="">— aucun —</option>${S.members.filter(m => m.uid !== o.uid).map(m => `<option value="${m.uid}">${esc(m.name || m.email)} · ${esc(roleOf(m.role).l)}</option>`).join('')}</select></label>
        <label>Zone / lot / niveau (périmètre)<input data-f="zone" placeholder="Ex : Zone 11, Lot gros œuvre…"></label>
        <div class="fld">Projets</div><label class="tm-ck"><input type="checkbox" data-all> Tous les projets (actuels et futurs)</label>
        <div class="tm-projs">${projects.map(p => `<label class="tm-ck"><input type="checkbox" data-p="${p.id}"> ${esc(p.name)}</label>`).join('') || '<small class="muted">Aucun projet pour le moment</small>'}</div>
        <label class="tm-ck"><input type="checkbox" data-admin> Administrateur (gère les membres et les invitations)</label>
        <button type="button" class="btn ghost small" data-a="perms">Droits détaillés…</button><div class="tm-pedit" hidden></div>
        <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="ok">${esc(okLabel)}</button></div></div>`, { title });
      s.onClose = () => resolve(null);
      const E = s.el, f = (k) => $(`[data-f=${k}]`, E);
      if (f('name')) f('name').value = st.name;
      f('role').value = st.role; f('managerUid').value = st.managerUid; f('zone').value = st.zone;
      $('[data-admin]', E).checked = st.admin;
      const syncP = () => { $('[data-all]', E).checked = st.allProjects; $$('[data-p]', E).forEach(c => { c.checked = st.allProjects || st.projects.includes(c.dataset.p); c.disabled = st.allProjects; }); };
      syncP();
      $('[data-all]', E).onchange = (e) => { st.allProjects = e.target.checked; syncP(); };
      $$('[data-p]', E).forEach(c => c.onchange = () => { st.projects = $$('[data-p]', E).filter(x => x.checked).map(x => x.dataset.p); });
      const pedit = () => { const pe = $('.tm-pedit', E); pe.innerHTML = MODS.map(([m, l]) => `<label class="tm-pl"><span>${l}</span><select data-pm="${m}">${LEVELS.map((x, i) => `<option value="${i}" ${+st.perms[m] === i ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`).join('');
        $$('[data-pm]', pe).forEach(sel => sel.onchange = () => { st.perms[sel.dataset.pm] = +sel.value; st.custom = true; }); };
      f('role').onchange = () => { st.role = f('role').value; st.perms = { ...roleOf(st.role).perms }; st.admin = roleOf(st.role).admin; $('[data-admin]', E).checked = st.admin; pedit(); };
      $('[data-a=perms]', E).onclick = () => { const pe = $('.tm-pedit', E); pe.hidden = !pe.hidden; pedit(); };
      $('[data-a=c]', E).onclick = () => s.close();
      $('[data-a=ok]', E).onclick = () => {
        const out = { name: f('name') ? f('name').value.trim() : undefined, role: f('role').value, managerUid: f('managerUid').value || null, zone: f('zone').value.trim(), allProjects: st.allProjects, projects: st.allProjects ? [] : st.projects, admin: $('[data-admin]', E).checked, perms: st.perms };
        if (!out.allProjects && !out.projects.length && !confirm('Aucun projet coché : la personne ne verra aucun projet. Continuer ?')) return;
        s.onClose = null; s.close(); resolve(out);
      };
    });
  }
  async function inviteFlow() {
    const projects = (await DB.all('projects')).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const o = await memberForm('Inviter un membre', { withName: true, allProjects: true }, projects, 'Créer l\'invitation');
    if (!o) return null;
    const ld = loading('Création de l\'invitation…');
    try { const code = await createInvite(o); ld.close();
      const v = await menu(`Code : ${code}`, [{ label: 'Envoyer par WhatsApp', icon: 'share', value: 'wa' }, { label: 'Copier le code', icon: 'file', value: 'cp' }, { label: 'Fermer', icon: 'check', value: 'ok' }]);
      if (v === 'wa') shareInvite(code, o); if (v === 'cp') copyText(code);
      return code;
    } catch (e) { ld.close(); alertBox(errMsg(e)); return null; }
  }
  async function editMember(m, projects) {
    const o = await memberForm(m.name || m.email, { ...m }, projects, 'Enregistrer');
    if (!o) return false;
    const ref = fs.collection('companies').doc(S.cid).collection('members').doc(m.uid);
    if (m.uid === S.user.uid && !o.admin && !S.members.some(x => x.uid !== m.uid && x.admin)) { alertBox('Il faut au moins un administrateur.'); return false; }
    const R = roleOf(o.role);
    try {
      await withTimeout(ref.update({ role: R.k, service: R.s, managerUid: o.managerUid, zone: o.zone, allProjects: o.allProjects, projects: o.projects, admin: o.admin, perms: o.perms }));
      toast('Enregistré ✓');
      return true;
    } catch (e) { alertBox(errMsg(e)); return false; }
  }
  async function removeMember(m) {
    if (!await confirmBox(`Retirer ${m.name || m.email} de l'entreprise ?`, 'Retirer')) return false;
    await fs.collection('companies').doc(S.cid).collection('members').doc(m.uid).delete(); toast('Retiré ✓'); return true;
  }

  // ---------- importer les projets de l'application Chantier (code de connexion Drive) ----------
  async function importChantier() {
    const r = await formSheet('Importer depuis Chantier', [{ name: 'code', label: 'Code de connexion de Chantier', type: 'textarea', placeholder: 'https://script.google.com/macros/s/…/exec#k=…' }], { okLabel: 'Lire les projets' });
    if (!r || !r.code) return;
    const old = Sync._parse(r.code); if (!old || !old.key) return alertBox('Code invalide : copiez-le dans Chantier › Google Drive › Copier le code de connexion.');
    const callOld = async (action, body = {}) => {
      const res = await fetch(old.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key: old.key, action, ...body }) }).catch(async () => {
        const http = window.Capacitor?.Plugins?.CapacitorHttp; if (!http) throw new Error('Connexion impossible');
        const x = await http.post({ url: old.url, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, data: JSON.stringify({ key: old.key, action, ...body }), responseType: 'text', readTimeout: 300000 });
        return { text: async () => (typeof x.data === 'string' ? x.data : JSON.stringify(x.data)) }; });
      const j = JSON.parse(await res.text()); if (!j.ok) throw new Error(j.error || 'Erreur'); return j;
    };
    const ld = loading('Lecture des données de Chantier…');
    let recs; try { recs = (await callOld('pull', { since: 0 })).records.filter(x => !x._deleted); } catch (e) { ld.close(); return alertBox('Lecture impossible : ' + (e.message || e)); }
    ld.close();
    const projs = recs.filter(x => x._store === 'projects');
    if (!projs.length) return alertBox('Aucun projet trouvé.');
    const pick = await new Promise((res) => {
      const s = sheet(`<div class="form">${projs.map(p => `<label class="tm-ck"><input type="checkbox" data-p="${p.id}" checked> ${esc(p.name)}</label>`).join('')}
        <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="ok">Importer</button></div></div>`, { title: 'Projets à importer' });
      s.onClose = () => res(null); $('[data-a=c]', s.el).onclick = () => s.close();
      $('[data-a=ok]', s.el).onclick = () => { const ids = $$('[data-p]', s.el).filter(c => c.checked).map(c => c.dataset.p); s.onClose = null; s.close(); res(ids); };
    });
    if (!pick || !pick.length) return;
    const cur = Sync.cfg(), sameDrive = cur && cur.url === old.url;
    const sel = recs.filter(x => pick.includes(x._store === 'projects' ? x.id : x.projectId));
    const ld2 = loading('Import…'); let n = 0, nf = 0;
    try {
      for (const x of sel) {
        const { _store, _srv, ...rec } = x; if (!STORE_MOD[_store] || _store === 'items') continue;
        rec.updatedAt = Date.now();
        if (_store === 'files' && rec.driveId && !sameDrive) {
          try { const d = await callOld('download', { id: rec.driveId }); const bin = atob(d.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); rec.blob = new Blob([u], { type: rec.mime || d.mime }); nf++; } catch (e) { console.warn('import file', e); }
          rec.driveId = null; rec.drivePath = null;
        }
        await DB.putRaw(_store, rec); n++; ld2.set(`Import… ${n}/${sel.length}`);
      }
      // nouveaux projets : accès des membres « tous les projets » ; les autres sont ajoutés par l'administrateur
      ld2.close(); toast(`${n} élément(s) importé(s)${nf ? ` · ${nf} fichier(s)` : ''} ✓`);
      Sync.schedule(500); renderHome();
    } catch (e) { ld2.close(); alertBox('Import interrompu : ' + (e.message || e)); }
  }

  async function logout() {
    if (!await confirmBox('Se déconnecter de SiteTeam sur ce téléphone ?', 'Se déconnecter')) return;
    await auth.signOut(); ['me', 'cid', 'company', 'members', 'profile', 'pullAt'].forEach(LS.del); location.reload();
  }

  // bandeau de lecture seule
  function decorateSection(sec, root) {
    if (!S.ready) return;
    const L = lvl(SECTION_MOD[sec] || 'projet');
    if (L === 1) { $$('.fab', document).forEach(f => f.remove()); const c = $('#content'); if (c && !$('.tm-ro', c)) c.insertAdjacentHTML('afterbegin', '<div class="tm-ro">👁 Lecture seule — votre poste permet de consulter cette partie</div>'); }
  }

  return {
    boot, push, pull, resetPull, lvl, canSection, canProject, isAdmin, openCompany, inviteFlow, logout, decorateSection, removeMember, refreshMembers,
    openProjectShares, claimShare,
    ready: () => S.ready, me: () => S.me, uid: () => S.user && S.user.uid, company: () => S.company, members: () => S.members, rules: FIRESTORE_RULES,
  };
})();
