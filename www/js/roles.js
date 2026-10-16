// ================= Phase 4 : rôles, packs, types de projet, équipe (hiérarchie), verrouillage par code PIN =================
// Rôle = métier de la personne (ce qu'elle voit par défaut). Pack = ce que la licence inclut. Fonctions finales = rôle ∩ pack (modifiables une par une).
const ROLES = [
  { k: 'directeur', e: '🎯', n: 'Directeur / Directeur qualité', d: 'Voit tout + le suivi de son équipe', f: null, team: true },
  { k: 'conducteur', e: '🏗️', n: 'Conducteur de travaux', d: 'Plans, réception & bétonnage, réserves, rapports, avancement', f: null, team: true },
  { k: 'chef', e: '👷', n: 'Chef de chantier', d: 'Plans, réception & bétonnage, réserves, photos, rapports', f: ['reception', 'tasks', 'photos', 'reports', 'forms', 'calc'] },
  { k: 'qualite', e: '✅', n: 'Technicien / TS qualité', d: 'Réception, PV, constats, formulaires QC, clauses CPS', f: ['reception', 'tasks', 'photos', 'forms', 'constat', 'clauses', 'reports'] },
  { k: 'topo', e: '📐', n: 'Topographe', d: 'Plans, calculs & topo, photos', f: ['calc', 'photos', 'tasks', 'models3d'] },
  { k: 'second', e: '🎨', n: 'Chef d\'équipe second œuvre', d: 'Avancement des lots, réserves, photos', f: ['avancement', 'tasks', 'photos', 'reports'] },
  { k: 'st', e: '🤝', n: 'Sous-traitant', d: 'Ses réserves et ses photos seulement', f: ['tasks', 'photos'] },
];
const PACKS = [
  { k: 'essentiel', n: 'Essentiel', d: 'Plans, réserves, photos, rapports', f: ['tasks', 'photos', 'reports', 'career'] },
  { k: 'pro', n: 'Pro', d: '+ réception & bétonnage, PV, formulaires, constats, CPS, avancement', f: ['tasks', 'photos', 'reports', 'career', 'reception', 'forms', 'constat', 'clauses', 'avancement', 'calc'] },
  { k: 'entreprise', n: 'Entreprise', d: 'Tout : + 3D, calculs, suivi d\'équipe', f: null },
];
const roleOf = (k) => ROLES.find(r => r.k === k);
const packOf = (k) => PACKS.find(p => p.k === k);
// fonctions d'une licence : true / false pour chaque fonction
function featuresFor(role, pack) {
  const R = roleOf(role), P = packOf(pack) || PACKS[2];
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
      ...FEATURES.filter(([k]) => k !== 'career' && featOn(k)).map(([k, l]) => ({ label: l, value: k, checked: !(p.featOff || {})[k] })),
      { label: 'Terminé', icon: 'check', value: '__ok' }]);
    if (!v || v === '__ok') break;
    if (v === '__type') { const t = await pickProjType(p.type); if (t) { p.type = t; p.featOff = Object.fromEntries(projTypeOf(t).off.map(k => [k, true])); } }
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
let _lockHiddenAt = 0;
function lockScreen() {
  return new Promise((resolve) => {
    if (document.querySelector('.lock-page')) return resolve();
    const L = AppLock.get(); if (!L) return resolve();
    const el = document.createElement('div'); el.className = 'fullpage lock-page';
    const name = (() => { try { return localStorage.getItem('userName') || ''; } catch (e) { return ''; } })();
    let pin = '', tries = 0;
    const draw = (msg = '') => {
      el.innerHTML = `<div class="lk-in"><div class="lk-logo">${icon('hard')}</div><b>${esc(name ? 'Bonjour ' + name : 'Chantier')}</b><span>${esc(msg || 'Entrez votre code PIN')}</span>
        <div class="lk-dots">${Array.from({ length: L.len || 4 }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('')}</div>
        <div class="lk-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => `<button data-k="${k}" ${k === '' ? 'disabled' : ''}>${k}</button>`).join('')}</div>
        <button class="linkbtn" data-a="forgot">Code oublié ?</button></div>`;
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
    draw(); document.body.appendChild(el);
  });
}
async function setPinDialog() {
  const cur = AppLock.get();
  const v = await menu('Verrouillage par code PIN', [
    { label: cur ? 'Changer le code PIN' : 'Créer un code PIN', icon: 'edit', value: 'set' },
    ...(cur ? [{ label: `Verrouiller après ${cur.after || 5} min en arrière-plan`, icon: 'history', value: 'after' }, { label: 'Retirer le code PIN', icon: 'close', danger: true, value: 'del' }] : []),
  ]);
  if (v === 'set') {
    const r = await formSheet('Code PIN', [{ name: 'a', label: 'Nouveau code (4 à 6 chiffres)', type: 'password', placeholder: '••••' }, { name: 'b', label: 'Confirmez le code', type: 'password' }], { okLabel: 'Enregistrer' });
    if (!r) return; if (!/^\d{4,6}$/.test(r.a || '')) return alertBox('Le code doit contenir 4 à 6 chiffres.'); if (r.a !== r.b) return alertBox('Les deux codes sont différents.');
    AppLock.set({ h: await AppLock.hash(r.a), len: r.a.length, after: (cur && cur.after) || 5 }); toast('🔒 Code PIN enregistré');
  }
  if (v === 'after') { const m = await menu('Verrouiller après', [0, 1, 5, 15, 60].map(n => ({ label: n ? `${n} min en arrière-plan` : 'Immédiatement', value: String(n), checked: cur.after === n }))); if (m != null) { cur.after = +m; AppLock.set(cur); } }
  if (v === 'del') { if (!cur) return; await lockScreen(); AppLock.set(null); toast('Code PIN retiré'); }
}
async function powerMenu() {
  const L = AppLock.get();
  const v = await menu('Chantier', [
    ...(L ? [{ label: '🔒 Verrouiller maintenant', value: 'lock' }] : []),
    { label: L ? 'Code PIN (changer / retirer)' : 'Protéger par un code PIN', icon: 'settings', value: 'pin' },
    { label: 'Fermer l\'application', icon: 'power', value: 'quit' }]);
  if (v === 'lock') lockScreen();
  if (v === 'pin') setPinDialog();
  if (v === 'quit') { const A = window.Capacitor?.Plugins?.App; if (A && A.exitApp) A.exitApp(); else toast('Fermez l\'onglet du navigateur'); }
}
document.addEventListener('visibilitychange', () => {
  const L = AppLock.get(); if (!L) return;
  if (document.visibilityState === 'hidden') _lockHiddenAt = Date.now();
  else if (_lockHiddenAt && Date.now() - _lockHiddenAt >= (L.after ?? 5) * 60000) lockScreen();
});
