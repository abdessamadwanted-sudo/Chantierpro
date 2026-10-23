// ================= Phase 4 : rôles, packs, types de projet, équipe (hiérarchie), verrouillage par code PIN =================
// Rôle = métier de la personne (ce qu'elle voit par défaut). Pack = ce que la licence inclut. Fonctions finales = rôle ∩ pack (modifiables une par une).
const ROLES = [
  { k: 'directeur', e: '🎯', n: 'Directeur / Directeur qualité', d: 'Voit tout + le suivi de son équipe', f: null, team: true },
  { k: 'conducteur', e: '🏗️', n: 'Conducteur de travaux', d: 'Plans, réception & bétonnage, réserves, rapports, avancement', f: null, team: true },
  { k: 'chef', e: '👷', n: 'Chef de chantier', d: 'Plans, réception & bétonnage, réserves, photos, rapports, gestion', f: ['reception', 'tasks', 'photos', 'reports', 'forms', 'calc', 'gestion', 'planning', 'reunions', 'pointage', 'hse', 'labo', 'org'] },
  { k: 'qualite', e: '✅', n: 'Technicien / TS qualité', d: 'Réception, PV, constats, formulaires QC, clauses CPS', f: ['reception', 'tasks', 'photos', 'forms', 'constat', 'clauses', 'reports', 'gestion', 'labo', 'rfi', 'visa', 'reunions'] },
  { k: 'topo', e: '📐', n: 'Topographe', d: 'Plans, calculs & topo, photos', f: ['calc', 'photos', 'tasks', 'models3d', 'rfi'] },
  { k: 'second', e: '🎨', n: 'Chef d\'équipe second œuvre', d: 'Avancement des lots, réserves, photos', f: ['avancement', 'tasks', 'photos', 'reports', 'pointage', 'planning'] },
  { k: 'st', e: '🤝', n: 'Sous-traitant', d: 'Ses réserves et ses photos seulement', f: ['tasks', 'photos', 'st'] },
];
const PACKS = [
  { k: 'decouverte', n: 'Découverte', d: 'Gratuit : plans, réserves, photos', f: ['tasks', 'photos', 'career'] },
  { k: 'essentiel', n: 'Essentiel', d: '+ rapports, réception, formulaires, planning, réunions, pointage', f: ['tasks', 'photos', 'reports', 'career', 'reception', 'forms', 'planning', 'reunions', 'pointage'] },
  { k: 'pro', n: 'Pro', d: '+ qualité, labo, HSE, RFI, visas, financier, TCE, sous-traitants', f: ['tasks', 'photos', 'reports', 'career', 'reception', 'forms', 'planning', 'reunions', 'pointage', 'constat', 'clauses', 'avancement', 'calc', 'gestion', 'rfi', 'visa', 'hse', 'labo', 'finance', 'tce', 'st'] },
  { k: 'entreprise', n: 'Entreprise', d: 'Tout : + 3D, organigramme et hiérarchie, suivi d\'équipe', f: null },
];
const roleOf = (k) => ROLES.find(r => r.k === k);
// couleur de profil (selon le rôle de la licence ; le propriétaire = directeur)
const ROLE_COLORS = { directeur: '#d4a537', conducteur: '#3b82f6', chef: '#f97316', qualite: '#22c55e', topo: '#06b6d4', second: '#ec4899', st: '#94a3b8' };
function myRole() { const L = (typeof Lic !== 'undefined' && Lic.get()) || {}; let r = L.mode === 'owner' ? 'directeur' : L.role || null; try { r = localStorage.getItem('myRole') || r; } catch (e) {} return r; }
function applyRoleColor() { const r = myRole(), c = ROLE_COLORS[r]; if (c) document.documentElement.style.setProperty('--role', c); else document.documentElement.style.removeProperty('--role'); return r; }
const packOf = (k) => PACKS.find(p => p.k === k);
// fonctions d'une licence : true / false pour chaque fonction
function featuresFor(role, pack) {
  const R = roleOf(role), P = packOf(pack) || PACKS[3];
  return Object.fromEntries(FEATURES.map(([k]) => [k, (k === 'career' || !R || !R.f || R.f.includes(k)) && (!P.f || P.f.includes(k))]));
}

// ---------- types de projet : sections proposées par défaut ----------
const PROJ_TYPES = [
  { k: 'bat', e: '🏢', n: 'Bâtiment (logements, bureaux, R+n)', off: [] },
  { k: 'equip', e: '🏟️', n: 'Équipement (stade, hôpital, école…)', off: [] },
  { k: 'ga', e: '🌉', n: 'Génie civil / ouvrage d\'art', off: ['avancement'] },
  { k: 'so', e: '🎨', n: 'Second œuvre / finitions', off: ['reception', 'models3d'] },
  { k: 'vrd', e: '🛣️', n: 'VRD / infrastructure / réseaux', off: ['avancement', 'models3d'] },
  { k: 'reno', e: '🔧', n: 'Réhabilitation / rénovation', off: ['models3d'] },
  { k: 'villa', e: '🏡', n: 'Villa / maison individuelle', off: ['models3d', 'avancement'] },
  { k: 'pont', e: '🌁', n: 'Pont / viaduc', off: ['avancement'] },
  { k: 'route', e: '🛣️', n: 'Route / autoroute', off: ['avancement', 'models3d', 'reception'] },
  { k: 'indus', e: '🏭', n: 'Industriel / hangar / charpente', off: ['avancement'] },
  { k: 'hydro', e: '💧', n: 'Hydraulique (barrage, réservoir, station)', off: ['avancement'] },
  { k: 'ext', e: '🌳', n: 'Aménagements extérieurs / espaces verts', off: ['reception', 'models3d'] },
];
const projTypeOf = (k) => PROJ_TYPES.find(t => t.k === k);
// section visible : licence + choix du téléphone + fonctions du projet
function sectionOn(key) {
  const f = SECTION_FEATURE[key]; if (!f) return true;
  if (!featOn(f)) return false;
  const p = App.project; return !(p && p.featOff && p.featOff[f]);
}
async function projectFeaturesDialog(p) {
  const T = projTypeOf(p.type);
  for (;;) {
    const v = await menu(`Fonctions du projet${T ? ' · ' + T.e + ' ' + T.n : ''}`, [
      { label: 'Changer le type de projet…', icon: 'hard', value: '__type' },
      { label: `Organisation technique (lots)…${(p.catLots || []).length ? ' · ' + p.catLots.length : ''}`, icon: 'grid', value: '__cat' },
      ...FEATURES.filter(([k]) => k !== 'career' && featOn(k)).map(([k, l]) => ({ label: l, value: k, checked: !(p.featOff || {})[k] })),
      { label: 'Terminé', icon: 'check', value: '__ok' }]);
    if (!v || v === '__ok') break;
    if (v === '__type') { const t = await pickProjType(p.type); if (t) { p.type = t; p.featOff = Object.fromEntries(projTypeOf(t).off.map(k => [k, true])); } }
    else if (v === '__cat') { if (typeof openProjectCatalogue === 'function') await openProjectCatalogue(p); }
    else { p.featOff = p.featOff || {}; p.featOff[v] = !p.featOff[v]; }
    await DB.put('projects', p);
  }
  renderSection();
}
async function pickProjType(cur) { return menu('Type de projet', PROJ_TYPES.map(t => ({ label: `${t.e} ${t.n}`, value: t.k, checked: t.k === cur }))); }
async function newProjectDialog() {
  const r = await formSheet('Nouveau projet', [
    { name: 'name', label: 'Nom du projet', placeholder: 'Ex : Grand stade Hassan II Benslimane' },
    { name: 'type', label: 'Type de projet (sections proposées)', type: 'select', value: 'bat', options: PROJ_TYPES.map(t => ({ value: t.k, label: `${t.e} ${t.n}` })) },
    { name: 'address', label: 'Adresse / ville (optionnel)' },
  ], { okLabel: 'Créer' });
  if (!r || !r.name) return;
  const T = projTypeOf(r.type) || PROJ_TYPES[0];
  const p = await DB.put('projects', { name: r.name, address: r.address, type: T.k, featOff: Object.fromEntries(T.off.map(k => [k, true])), team: [] });
  openProject(p);
}

// ---------- équipe : un directeur / conducteur voit le suivi des licences rattachées à lui ----------
async function openMyTeam() {
  const st = Lic.get() || {};
  const team = st.team || [];
  if (!team.length) return alertBox('Aucune personne rattachée à vous pour le moment.\nLe titulaire de l\'application peut rattacher des licences à la vôtre (Licences › ⋮ › Rattacher à…).');
  const id = await menu(`👥 Mon équipe (${team.length})`, team.map(m => ({ label: `${(roleOf(m.role) || {}).e || '👤'} ${m.name}${m.role ? ' · ' + ((roleOf(m.role) || {}).n || '') : ''}`, icon: 'team', value: m.code })));
  if (!id) return;
  const m = team.find(x => x.code === id);
  try { await openSuivi({ code: m.code, name: m.name }); }
  catch (e) { alertBox(e && /permission/i.test(e.message || e.code || '') ? 'Accès refusé par le serveur : le titulaire doit autoriser la lecture du suivi d\'équipe.' : (e.message || String(e))); }
}

// ---------- verrouillage par code PIN (bouton ⏻) ----------
const AppLock = {
  get() { try { return JSON.parse(localStorage.getItem('lock') || 'null'); } catch (e) { return null; } },
  set(v) { try { v ? localStorage.setItem('lock', JSON.stringify(v)) : localStorage.removeItem('lock'); } catch (e) {} },
  async hash(pin) { return licHash('chantier-pin|' + pin); },
};
// empreinte / visage (plugin natif) — le code PIN reste toujours possible
const Bio = {
  P: () => window.Capacitor?.Plugins?.NativeBiometric,
  async available() { try { const P = Bio.P(); if (!P) return false; const r = await P.isAvailable(); return !!(r && r.isAvailable); } catch (e) { return false; } },
  async verify() { try { await Bio.P().verifyIdentity({ reason: 'Déverrouiller SiteTeam', title: 'SiteTeam', subtitle: 'Empreinte ou visage', description: '' }); return true; } catch (e) { return false; } },
};
let _lockHiddenAt = 0;
function lockScreen() {
  return new Promise((resolve) => {
    if (document.querySelector('.lock-page')) return resolve();
    const L = AppLock.get(); if (!L) return resolve();
    const el = document.createElement('div'); el.className = 'fullpage lock-page';
    const name = (() => { try { return localStorage.getItem('userName') || ''; } catch (e) { return ''; } })();
    let pin = '', tries = 0;
    const draw = (msg = '') => {
      el.innerHTML = `<div class="lk-in"><div class="lk-logo">${icon('hard')}</div><b>${esc(name ? 'Bonjour ' + name : 'SiteTeam')}</b><span>${esc(msg || 'Entrez votre code PIN')}</span>
        <div class="lk-dots">${Array.from({ length: L.len || 4 }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('')}</div>
        <div class="lk-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => `<button data-k="${k}" ${k === '' ? 'disabled' : ''}>${k}</button>`).join('')}</div>
        ${L.bio ? '<button class="lk-bio" data-a="bio">👆 Empreinte / visage</button>' : ''}<button class="linkbtn" data-a="forgot">Code oublié ?</button></div>`;
      const bb = $('[data-a=bio]', el); if (bb) bb.onclick = tryBio;
      $$('[data-k]', el).forEach(b => b.onclick = async () => {
        const k = b.dataset.k; if (k === '⌫') pin = pin.slice(0, -1); else if (k !== '' && pin.length < (L.len || 4)) pin += k;
        if (pin.length === (L.len || 4)) {
          if (await AppLock.hash(pin) === L.h) { el.remove(); resolve(); return; }
          tries++; pin = ''; if (navigator.vibrate) navigator.vibrate(200);
          if (tries >= 5) { draw('Trop d\'essais — attendez 30 s'); $$('[data-k]', el).forEach(x => x.disabled = true); setTimeout(() => { tries = 3; draw(); }, 30000); return; }
          return draw('Code incorrect');
        }
        draw();
      });
      $('[data-a=forgot]', el).onclick = async () => {
        const st = Lic.get() || {};
        if (st.mode === 'user') {   // licence : on prouve son identité avec son code de licence
          const r = await formSheet('Code PIN oublié', [{ name: 'c', label: 'Votre code de licence (CH-XXXX-XXXX)' }], { okLabel: 'Retirer le PIN' });
          if (r && r.c && r.c.toUpperCase().replace(/[^A-Z0-9-]/g, '') === st.code) { AppLock.set(null); el.remove(); toast('Code PIN retiré ✓'); resolve(); } else if (r) alertBox('Code de licence incorrect.');
          return;
        }
        if (!await confirmBox('Code PIN oublié ?\nConnectez-vous au compte propriétaire (e-mail + mot de passe) pour le retirer. Vos données ne sont pas effacées.', 'Se connecter')) return;
        try { const u = await licOwnerLogin(); if (u) { AppLock.set(null); el.remove(); toast('Code PIN retiré ✓'); resolve(); } } catch (e) { alertBox(e.message || String(e)); }
      };
    };
    const tryBio = async () => { if (await Bio.verify()) { el.remove(); resolve(); } };
    draw(); document.body.appendChild(el);
    if (L.bio) Bio.available().then(ok => ok && setTimeout(tryBio, 300));
  });
}
async function setPinDialog() {
  const cur = AppLock.get();
  const v = await menu('Verrouillage par code PIN', [
    { label: cur ? 'Changer le code PIN' : 'Créer un code PIN', icon: 'edit', value: 'set' },
    ...(cur ? [{ label: cur.bio ? '👆 Empreinte / visage : activé (désactiver)' : '👆 Déverrouiller avec l\'empreinte / le visage', icon: 'check', value: 'bio' }, { label: `Verrouiller après ${cur.after || 5} min en arrière-plan`, icon: 'history', value: 'after' }, { label: 'Retirer le code PIN', icon: 'close', danger: true, value: 'del' }] : []),
  ]);
  if (v === 'set') {
    const r = await formSheet('Code PIN', [{ name: 'a', label: 'Nouveau code (4 à 6 chiffres)', type: 'password', placeholder: '••••' }, { name: 'b', label: 'Confirmez le code', type: 'password' }], { okLabel: 'Enregistrer' });
    if (!r) return; if (!/^\d{4,6}$/.test(r.a || '')) return alertBox('Le code doit contenir 4 à 6 chiffres.'); if (r.a !== r.b) return alertBox('Les deux codes sont différents.');
    AppLock.set({ h: await AppLock.hash(r.a), len: r.a.length, after: (cur && cur.after) || 5, bio: !!(cur && cur.bio) }); toast('🔒 Code PIN enregistré');
    if (!cur && await Bio.available() && (await menu('Utiliser aussi l\'empreinte / le visage pour déverrouiller ?', [{ label: '👆 Oui, activer', value: 'y' }, { label: 'Non, le code PIN suffit', icon: 'close', value: 'n' }])) === 'y') { if (await Bio.verify()) { const c2 = AppLock.get(); c2.bio = true; AppLock.set(c2); toast('👆 Empreinte activée'); } }
  }
  if (v === 'bio') {
    if (cur.bio) { cur.bio = false; AppLock.set(cur); return toast('Empreinte désactivée'); }
    if (!(await Bio.available())) return alertBox('Empreinte / visage non disponible : enregistrez une empreinte dans les réglages du téléphone, puis réessayez.');
    if (!(await Bio.verify())) return toast('Annulé');
    cur.bio = true; AppLock.set(cur); toast('👆 Empreinte activée');
  }
  if (v === 'after') { const m = await menu('Verrouiller après', [0, 1, 5, 15, 60].map(n => ({ label: n ? `${n} min en arrière-plan` : 'Immédiatement', value: String(n), checked: cur.after === n }))); if (m != null) { cur.after = +m; AppLock.set(cur); } }
  if (v === 'del') { if (!cur) return; await lockScreen(); AppLock.set(null); toast('Code PIN retiré'); }
}
async function powerMenu() {
  const L = AppLock.get();
  const v = await menu('SiteTeam', [
    ...(L ? [{ label: '🔒 Verrouiller maintenant', value: 'lock' }] : []),
    { label: L ? 'Code PIN (changer / retirer)' : 'Protéger par un code PIN', icon: 'settings', value: 'pin' },
    { label: 'Fermer l\'application', icon: 'power', value: 'quit' }]);
  if (v === 'lock') lockScreen();
  if (v === 'pin') setPinDialog();
  if (v === 'quit') Splash.bye();
}
document.addEventListener('visibilitychange', () => {
  const L = AppLock.get(); if (!L) return;
  if (document.visibilityState === 'hidden') _lockHiddenAt = Date.now();
  else if (_lockHiddenAt && Date.now() - _lockHiddenAt >= (L.after ?? 5) * 60000) lockScreen();
});
