// ================= Organisation : service → poste (1er démarrage), permissions, packs 🔒, hiérarchie et organigramme dessiné =================
// Fonctions finales d'un téléphone = pack de la licence ∩ poste choisi. Niveaux par fonction : voir · modifier · valider.
Object.assign(ICONS, {
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3.5 5.5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/>',
  meet: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M7 9h10M7 12h6"/>',
  ask: '<path d="M4 5h16v11H9l-5 4z"/><path d="M10 9a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.3M12 14h.01"/>',
  stamp: '<path d="M9 3h6l-1 7h3a2 2 0 0 1 2 2v3H5v-3a2 2 0 0 1 2-2h3z"/><path d="M5 19h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gantt: '<path d="M3 4v16h18"/><rect x="6" y="6" width="8" height="3" rx="1"/><rect x="9" y="11" width="9" height="3" rx="1"/><rect x="7" y="16" width="6" height="2.5" rx="1"/>',
  hands: '<path d="M2 12l4-4 4 3 3-3 4 1 5 3"/><path d="M6 8v5l5 5 2-1 2 1 3-3"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>',
  sign: '<path d="M4 20h16"/><path d="M5 16c3-6 5-9 7-9s-1 7 1 7 3-3 4-3 1 2 2 2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  org: '<rect x="9" y="3" width="6" height="4" rx="1"/><rect x="3" y="16" width="6" height="4" rx="1"/><rect x="15" y="16" width="6" height="4" rx="1"/><path d="M12 7v4M6 16v-3h12v3"/>',
  kpi: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
});

const ALL_F = '*';
// hiérarchie de chaque service, du plus haut au plus bas (lv = niveau dans l'organigramme)
const F_TRAV = ['avancement', 'reception', 'tasks', 'photos', 'forms', 'reports', 'constat', 'calc', 'gestion', 'planning', 'reunions', 'rfi', 'visa', 'pointage', 'hse', 'labo', 'finance', 'tce', 'st', 'org', 'models3d', 'career'];
const F_QUAL = ['reception', 'tasks', 'photos', 'forms', 'reports', 'constat', 'clauses', 'labo', 'rfi', 'visa', 'reunions', 'planning', 'org', 'career'];
const F_LABO = ['labo', 'reception', 'photos', 'reports', 'rfi', 'forms', 'org', 'career'];
const F_HSE = ['hse', 'tasks', 'photos', 'reports', 'reunions', 'forms', 'constat', 'org', 'career'];
const F_ETU = ['calc', 'models3d', 'planning', 'rfi', 'visa', 'tasks', 'photos', 'reports', 'reunions', 'avancement', 'tce', 'gestion', 'org', 'career'];
const F_LOG = ['gestion', 'pointage', 'photos', 'reports', 'planning', 'finance', 'st', 'org', 'career'];
const F_FIN = ['finance', 'tce', 'st', 'pointage', 'gestion', 'planning', 'org', 'career'];
const SERVICES = [
  { k: 'trav', e: '🏗️', n: 'Travaux', d: 'Exécution, planning, équipes, réception', c: '#3b82f6', postes: [
    { k: 'dirproj', n: 'Directeur de projet', lv: 1, f: ALL_F, va: ALL_F },
    { k: 'dirtrav', n: 'Directeur de travaux', lv: 2, f: ALL_F, va: ALL_F },
    { k: 'ingtrav', n: 'Ingénieur travaux', lv: 3, f: F_TRAV, va: ['pointage', 'st', 'finance', 'visa', 'gestion', 'labo'] },
    { k: 'conduct', n: 'Conducteur de travaux', lv: 4, f: F_TRAV, va: ['pointage', 'st', 'finance', 'visa', 'gestion'] },
    { k: 'chef', n: 'Chef de chantier', lv: 5, f: ['reception', 'tasks', 'photos', 'forms', 'reports', 'calc', 'gestion', 'planning', 'reunions', 'pointage', 'hse', 'labo', 'org', 'career'], ro: ['planning', 'labo', 'org'] },
    { k: 'cheq', n: 'Chef d\'équipe', lv: 6, f: ['tasks', 'photos', 'reports', 'pointage', 'avancement'] },
  ] },
  { k: 'qual', e: '✅', n: 'Qualité', d: 'Réception, PV, contrôles, non-conformités', c: '#22c55e', postes: [
    { k: 'dirq', n: 'Directeur qualité', lv: 1, f: ALL_F, va: ALL_F },
    { k: 'ingq', n: 'Ingénieur qualité', lv: 2, f: F_QUAL, va: ['labo', 'visa', 'constat', 'rfi', 'reception'] },
    { k: 'respq', n: 'Responsable qualité', lv: 3, f: F_QUAL, ro: ['planning'], va: ['labo', 'visa', 'constat'] },
    { k: 'tsq', n: 'TS / Technicien qualité', lv: 4, f: F_QUAL, ro: ['planning', 'org'] },
    { k: 'ctrl', n: 'Contrôleur qualité', lv: 5, f: ['reception', 'tasks', 'photos', 'forms', 'constat', 'labo'] },
  ] },
  { k: 'labo', e: '🧪', n: 'Laboratoire', d: 'Essais béton, sols, granulats, aciers', c: '#8b5cf6', postes: [
    { k: 'dirlab', n: 'Directeur du laboratoire', lv: 1, f: ALL_F, va: ALL_F },
    { k: 'inglab', n: 'Ingénieur laboratoire', lv: 2, f: F_LABO, ro: ['reception'], va: ['labo'] },
    { k: 'resplab', n: 'Responsable laboratoire', lv: 3, f: F_LABO, ro: ['reception'], va: ['labo'] },
    { k: 'techlab', n: 'Technicien laboratoire', lv: 4, f: ['labo', 'photos', 'reception', 'reports'], ro: ['reception'] },
    { k: 'oper', n: 'Opérateur d\'essais', lv: 5, f: ['labo', 'photos'] },
  ] },
  { k: 'hse', e: '🦺', n: 'HSE', d: 'Sécurité, causeries, EPI, permis', c: '#f97316', postes: [
    { k: 'dirhse', n: 'Directeur HSE', lv: 1, f: ALL_F, va: ALL_F },
    { k: 'inghse', n: 'Ingénieur HSE', lv: 2, f: F_HSE, va: ['hse'] },
    { k: 'resphse', n: 'Responsable HSE', lv: 3, f: F_HSE, va: ['hse'] },
    { k: 'suphse', n: 'HSE Supervisor', lv: 4, f: F_HSE, ro: ['org'] },
    { k: 'anim', n: 'Animateur HSE', lv: 5, f: ['hse', 'tasks', 'photos', 'reports', 'forms'] },
    { k: 'secu', n: 'Secouriste / agent sécurité', lv: 6, f: ['hse', 'photos', 'tasks'] },
  ] },
  { k: 'etu', e: '📐', n: 'Études & méthodes · Topo', d: 'Plans, métrés, calculs, 3D', c: '#06b6d4', postes: [
    { k: 'dirtech', n: 'Directeur technique', lv: 1, f: ALL_F, va: ALL_F },
    { k: 'ingstr', n: 'Ingénieur structure', lv: 2, f: F_ETU, va: ['visa', 'rfi'] },
    { k: 'meth', n: 'Ingénieur méthodes', lv: 2, f: F_ETU, va: ['visa'] },
    { k: 'proj', n: 'Projeteur / dessinateur', lv: 3, f: ['calc', 'models3d', 'rfi', 'visa', 'tasks', 'photos', 'career'] },
    { k: 'metreur', n: 'Métreur', lv: 3, f: ['calc', 'gestion', 'finance', 'avancement', 'photos', 'career'], ro: ['finance'] },
    { k: 'topo', n: 'Topographe', lv: 3, f: ['calc', 'models3d', 'photos', 'tasks', 'career'] },
  ] },
  { k: 'log', e: '📦', n: 'Logistique / Magasin', d: 'Stock, commandes, livraisons, engins', c: '#eab308', postes: [
    { k: 'dirlog', n: 'Directeur logistique', lv: 1, f: ALL_F, va: ALL_F },
    { k: 'respach', n: 'Responsable achats', lv: 2, f: F_LOG, va: ['gestion', 'st'] },
    { k: 'logi', n: 'Logisticien', lv: 3, f: F_LOG, ro: ['planning', 'finance', 'st'], va: ['gestion'] },
    { k: 'ach', n: 'Acheteur', lv: 3, f: ['gestion', 'finance', 'st', 'career'], ro: ['st'] },
    { k: 'mag', n: 'Magasinier', lv: 4, f: ['gestion', 'photos'] },
  ] },
  { k: 'fin', e: '💰', n: 'Administration & finance', d: 'Marché, factures, sous-traitants, paie', c: '#a855f7', postes: [
    { k: 'daf', n: 'Directeur administratif et financier (DAF)', lv: 1, f: ALL_F, va: ALL_F },
    { k: 'gest', n: 'Contrôleur de gestion', lv: 2, f: F_FIN, ro: ['planning'], va: ['finance', 'st', 'pointage'] },
    { k: 'compta', n: 'Comptable chantier', lv: 3, f: ['finance', 'st', 'pointage', 'org'], ro: ['pointage', 'org'] },
    { k: 'assist', n: 'Assistant(e) administratif', lv: 4, f: ['finance', 'pointage', 'reports', 'photos'], ro: ['finance'] },
  ] },
  { k: 'archi', e: '🏛️', n: 'Architecture', d: 'Conception, plans, suivi architectural', c: '#ec4899', postes: [
    { k: 'archic', n: 'Architecte en chef / associé', lv: 1, f: ['rfi', 'visa', 'tasks', 'photos', 'avancement', 'reunions', 'planning', 'reports', 'org'], ro: ['planning', 'org'], va: ['visa', 'rfi'] },
    { k: 'archi', n: 'Architecte', lv: 2, f: ['rfi', 'visa', 'tasks', 'photos', 'avancement', 'reunions', 'reports'], ro: ['avancement', 'reunions'], va: ['visa'] },
    { k: 'archint', n: 'Architecte d\'intérieur', lv: 3, f: ['rfi', 'visa', 'tasks', 'photos', 'avancement'], ro: ['avancement'] },
    { k: 'dessar', n: 'Dessinateur / projeteur archi', lv: 4, f: ['rfi', 'visa', 'tasks', 'photos', 'calc'] },
  ] },
  { k: 'bet', e: '🧮', n: 'Bureau d\'études (BET)', d: 'Structure, fluides, notes de calcul', c: '#0ea5e9', postes: [
    { k: 'dirbet', n: 'Directeur BET', lv: 1, f: ['rfi', 'visa', 'tasks', 'photos', 'reception', 'labo', 'reunions', 'calc', 'models3d', 'planning', 'org'], ro: ['reception', 'labo', 'planning'], va: ['visa', 'rfi', 'labo'] },
    { k: 'bet', n: 'Ingénieur BET structure', lv: 2, f: ['rfi', 'visa', 'tasks', 'photos', 'reception', 'labo', 'reunions', 'calc', 'models3d'], ro: ['reception', 'labo', 'reunions'], va: ['visa', 'rfi'] },
    { k: 'betflu', n: 'Ingénieur BET fluides / électricité', lv: 2, f: ['rfi', 'visa', 'tasks', 'photos', 'reunions', 'calc'], ro: ['reunions'], va: ['visa', 'rfi'] },
    { k: 'projbet', n: 'Projeteur BET', lv: 3, f: ['rfi', 'visa', 'tasks', 'photos', 'calc', 'models3d'] },
  ] },
  { k: 'bc', e: '🔍', n: 'Bureau de contrôle', d: 'Contrôle technique, visites, avis', c: '#14b8a6', postes: [
    { k: 'dirbc', n: 'Directeur du bureau de contrôle', lv: 1, f: ['rfi', 'visa', 'tasks', 'photos', 'reception', 'labo', 'constat', 'reunions', 'org'], ro: ['reception', 'labo', 'org'], va: ['visa', 'constat'] },
    { k: 'bc', n: 'Ingénieur contrôleur', lv: 2, f: ['rfi', 'visa', 'tasks', 'photos', 'reception', 'labo', 'constat', 'reunions'], ro: ['reception', 'labo', 'reunions'], va: ['visa'] },
    { k: 'ctbc', n: 'Contrôleur technique', lv: 3, f: ['tasks', 'photos', 'reception', 'constat', 'labo'], ro: ['reception', 'labo'] },
  ] },
  { k: 'mo', e: '🏢', n: 'Maître d\'ouvrage', d: 'Client, AMO, suivi du projet', c: '#f43f5e', postes: [
    { k: 'mo', n: 'Directeur de projet (MO)', lv: 1, f: ['planning', 'avancement', 'photos', 'reports', 'tasks', 'reunions', 'finance', 'tce', 'org'], ro: ['planning', 'avancement', 'reports', 'tce', 'org', 'reunions'], va: ['finance'] },
    { k: 'cpmo', n: 'Chef de projet (MO)', lv: 2, f: ['planning', 'avancement', 'photos', 'reports', 'tasks', 'reunions', 'finance', 'tce', 'org'], ro: ['planning', 'avancement', 'reports', 'tce', 'org'], va: ['finance'] },
    { k: 'amo', n: 'AMO (assistance au maître d\'ouvrage)', lv: 2, f: ['planning', 'avancement', 'photos', 'reports', 'tasks', 'reunions', 'tce', 'rfi', 'visa', 'org'], ro: ['planning', 'avancement', 'reports', 'tce', 'org'], va: ['visa'] },
    { k: 'repmo', n: 'Représentant du maître d\'ouvrage', lv: 3, f: ['avancement', 'photos', 'reports', 'tasks', 'reunions'], ro: ['avancement', 'reports', 'reunions'] },
  ] },
  { k: 'ext', e: '🤝', n: 'Sous-traitance', d: 'Entreprises sous-traitantes, équipes', c: '#94a3b8', postes: [
    { k: 'gerst', n: 'Gérant sous-traitant', lv: 2, f: ['tasks', 'photos', 'st', 'reports', 'pointage'], ro: ['st'] },
    { k: 'sst', n: 'Chef d\'équipe sous-traitant', lv: 3, f: ['tasks', 'photos', 'st', 'reports'], ro: ['st'] },
  ] },
];
const svcOf = (k) => SERVICES.find(s => s.k === k);
const posteOf = (k) => { for (const s of SERVICES) { const p = s.postes.find(x => x.k === k); if (p) return { ...p, svc: s }; } return null; };

const Org = {
  me() { try { return JSON.parse(localStorage.getItem('org.me') || 'null'); } catch (e) { return null; } },
  set(v) { try { localStorage.setItem('org.me', JSON.stringify(v)); } catch (e) {} Org.apply(); },
  poste() { const m = Org.me(); return m && posteOf(m.poste); },
  // niveau d'accès d'une fonction : 'see' (visible), 'edit' (modifier), 'valid' (valider)
  can(f, lvl = 'edit') {
    const P = Org.poste(); if (!P || !f) return true;
    if (Org.owner()) return true;   // le titulaire voit et fait tout sur son compte (le poste ne règle que l'ordre et l'accueil)
    const vis = P.f === ALL_F || P.f.includes(f);
    if (lvl === 'see') return vis;
    if (lvl === 'edit') return vis && !(P.ro || []).includes(f);
    return vis && (P.va === ALL_F || (P.va || []).includes(f));   // valider suppose de voir la fonction
  },
  owner() { const L = (typeof Lic !== 'undefined' && Lic.get()) || {}; return L.mode === 'owner'; },
  apply() { const P = Org.poste(); if (P) document.documentElement.style.setProperty('--role', P.svc.c); },
  label() { const P = Org.poste(); return P ? `${P.svc.e} ${P.n}` : ''; },
};
// le titulaire de la licence peut tout faire ; sinon c'est le poste qui décide
function orgEdit(f) { return Org.can(f, 'edit'); }
function orgValid(f) { return Org.can(f, 'valid'); }

// ---------- 1er démarrage : service → poste → récapitulatif ----------
function orgOnboard(force) {
  return new Promise((resolve) => {
    if (!force && Org.me()) return resolve();
    const el = document.createElement('div'); el.className = 'fullpage ob';
    let svc = null, step = 0;
    const name = (() => { try { return localStorage.getItem('userName') || ''; } catch (e) { return ''; } })();
    const dots = (i) => `<div class="ob-dots">${[0, 1, 2].map(k => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>`;
    const draw = () => {
      if (step === 0) el.innerHTML = `<div class="ob-in">${dots(0)}<h1>${name ? 'Bienvenue ' + esc(name) : 'Bienvenue'} 👋</h1><p>Dans quel <b>service</b> travaillez-vous ?</p>
        ${force ? '' : `<label class="ob-name">Votre prénom<input value="${esc(name)}" placeholder="Ex : Abdessamad"></label>`}
        <div class="ob-grid">${SERVICES.map((s, i) => `<button class="ob-c" data-s="${s.k}" style="--c:${s.c};animation-delay:${i * .04}s"><span>${s.e}</span><b>${esc(s.n)}</b><small>${esc(s.d)}</small></button>`).join('')}</div>
        ${force ? '<button class="linkbtn ob-x" data-x>Annuler</button>' : ''}</div>`;
      if (step === 1) el.innerHTML = `<div class="ob-in">${dots(1)}<button class="ob-back" data-b>${icon('back')}</button><h1>${svc.e} ${esc(svc.n)}</h1><p>Quel est votre <b>poste</b> ?</p>
        <div class="ob-list">${svc.postes.map((p, i) => `<button class="ob-p" data-p="${p.k}" style="--c:${svc.c};animation-delay:${i * .05}s"><b>${esc(p.n)}</b><small>${p.f === ALL_F ? 'Toutes les fonctions' : p.f.slice(0, 6).map(f => featName(f)).join(' · ') + (p.f.length > 6 ? '…' : '')}</small>${icon('chevright')}</button>`).join('')}</div></div>`;
      if (step === 2) { const P = Org.poste(), fs = FEATURES.map(([k]) => k).filter(k => P.f === ALL_F || P.f.includes(k));
        el.innerHTML = `<div class="ob-in">${dots(2)}<button class="ob-back" data-b>${icon('back')}</button><h1>Votre espace est prêt ✓</h1><p>${P.svc.e} <b>${esc(P.n)}</b> · ${esc(P.svc.n)}</p>
          <div class="ob-sum">${fs.map(k => `<div class="${featAllowed(k) ? '' : 'lk'}"><span>${featAllowed(k) ? (orgEdit(k) ? '✓' : '👁') : '🔒'}</span>${esc(featName(k))}${orgValid(k) && P.va !== ALL_F ? ' <i>valide</i>' : ''}</div>`).join('')}</div>
          <small class="ob-leg">✓ modifier · 👁 consulter · 🔒 désactivé par le titulaire · <i>valide</i> = vous validez</small>
          <button class="btn ob-go" data-go>Entrer ›</button></div>`; }
      // toucher : onde lumineuse, la carte se soulève et vibre, les autres s'effacent, puis on passe à l'étape suivante
      const pressFx = (b, e, go) => { if (el._busy) return; el._busy = true; try { navigator.vibrate && navigator.vibrate([12, 30, 18]); } catch (x) {}
        const r = b.getBoundingClientRect(), w = document.createElement('i'); w.className = 'ob-wave'; w.style.left = ((e && e.clientX) ? e.clientX - r.left : r.width / 2) + 'px'; w.style.top = ((e && e.clientY) ? e.clientY - r.top : r.height / 2) + 'px'; b.appendChild(w);
        b.classList.add('ob-pick'); el.classList.add('ob-picking'); setTimeout(() => { el._busy = false; el.classList.remove('ob-picking'); go(); }, 520); };
      $$('[data-s]', el).forEach(b => b.onclick = (e) => pressFx(b, e, () => { const n = $('.ob-name input', el); if (n) try { localStorage.setItem('userName', n.value.trim()); localStorage.setItem('askedName', '1'); } catch (x) {} svc = svcOf(b.dataset.s); step = 1; draw(); }));
      $$('[data-p]', el).forEach(b => b.onclick = (e) => pressFx(b, e, () => { const P = posteOf(b.dataset.p);
        Org.set({ service: svc.k, poste: P.k, at: todayISO() });
        if (!Org.owner()) try { localStorage.setItem('myFeatures', JSON.stringify(Object.fromEntries(FEATURES.map(([k]) => [k, P.f === ALL_F || P.f.includes(k)])))); } catch (e) {}
        step = 2; draw(); }));
      const bk = $('[data-b]', el); if (bk) bk.onclick = () => { step--; draw(); };
      const x = $('[data-x]', el); if (x) x.onclick = () => { el.remove(); resolve(); };
      const go = $('[data-go]', el); if (go) go.onclick = () => { el.classList.add('out'); setTimeout(() => { el.remove(); resolve(); if (App.project) renderSection(); else if (typeof renderHome === 'function') renderHome(); }, 300); };
    };
    draw(); document.body.appendChild(el);
  });
}
const featName = (k) => ({ planning: 'Planning', reunions: 'Réunions', rfi: 'RFI', visa: 'Visas', pointage: 'Pointage', hse: 'HSE', labo: 'Laboratoire', finance: 'Financier & avenants', tce: 'TCE', st: 'Sous-traitants', org: 'Organigramme', reception: 'Réception', tasks: 'Réserves', photos: 'Photos', forms: 'Formulaires', reports: 'Rapports', constat: 'Constats', clauses: 'CPS', models3d: '3D', calc: 'Calculs', gestion: 'Stock & gestion', career: 'Emploi', avancement: 'Avancement' })[k] || ((FEATURES.find(f => f[0] === k) || [])[1] || k);

// ---------- menu latéral rangé par groupes (le groupe de votre service en premier) ----------
const DR_GROUPS = [
  ['trav', '🏗️ Chantier', ['dashboard', 'plans', 'reception', 'avancement', 'planning', 'reunions', 'tasks', 'reports', 'photos', 'pointage']],
  ['qual', '✅ Qualité & laboratoire', ['labo', 'forms', 'constat', 'clauses', 'rfi', 'visa']],
  ['hse', '🦺 Sécurité (HSE)', ['hse']],
  ['etu', '📐 Études & 3D', ['calc', 'models3d', 'maquette']],
  ['fin', '💰 Finance, stock & contrats', ['finance', 'avenants', 'gestion', 'tce', 'st']],
  ['org', '👥 Organisation', ['org', 'team']],
];
const SVC_GROUP = { trav: 'trav', qual: 'qual', labo: 'qual', hse: 'hse', etu: 'etu', log: 'fin', fin: 'fin', ext: 'trav', archi: 'trav', bet: 'etu', bc: 'qual', mo: 'trav' };
// ordre du menu choisi par l'utilisateur (groupes et rubriques) : { g: [groupe…], k: { groupe: [rubrique…] } }
const drOrd = () => { try { return JSON.parse(localStorage.getItem('dr.ord') || 'null'); } catch (e) { return null; } };
const drOrdSet = (o) => { try { localStorage.setItem('dr.ord', JSON.stringify(o)); } catch (e) {} };
function drLayout(groups) {
  const O = drOrd(); if (!O) return groups;
  const all = new Map(groups.map(g => [g[0], g])), taken = new Set();
  const out = (O.g || []).filter(k => all.has(k)).map(k => all.get(k)); groups.forEach(g => { if (!out.includes(g)) out.push(g); });
  const res = out.map(([gk, gl, keys]) => { const mine = ((O.k || {})[gk] || []).filter(k => SECTIONS[k]); mine.forEach(k => taken.add(k)); return [gk, gl, mine, keys]; });
  return res.map(([gk, gl, mine, keys]) => [gk, gl, [...mine, ...keys.filter(k => !taken.has(k) && !mine.includes(k))]]);
}
// déplacer une rubrique (appui long dans le menu) ou organiser tout le menu
async function drMove(k, redraw) {
  const placed = new Set(DR_GROUPS.flatMap(g => g[2])), base = DR_GROUPS.map(g => g[0] === 'trav' ? [g[0], g[1], [...g[2], ...Object.keys(SECTIONS).filter(x => !placed.has(x))]] : g);
  const L = drLayout(base), gi = L.findIndex(g => g[2].includes(k)); if (gi < 0) return;
  const vis = (g) => g[2].filter(x => SECTIONS[x] && !SECTIONS[x].hidden && x !== 'settings' && sectionOn(x));
  const v = await menu(`${SECTIONS[k].label}`, [{ label: '⬆️ Monter', value: 'up' }, { label: '⬇️ Descendre', value: 'down' }, { label: '⏫ Tout en haut du groupe', value: 'top' }, { label: '↪ Déplacer vers un autre groupe…', value: 'mv' }, { label: '🗂 Organiser les groupes…', value: 'grp' }, { label: '↺ Ordre par défaut', value: 'reset' }]);
  if (!v) return;
  if (v === 'reset') { try { localStorage.removeItem('dr.ord'); } catch (e) {} return redraw(); }
  const O = { g: L.map(g => g[0]), k: Object.fromEntries(L.map(g => [g[0], [...g[2]]])) }, arr = O.k[L[gi][0]], i = arr.indexOf(k);
  if (v === 'up' || v === 'down') { const V = vis(L[gi]), j = V.indexOf(k), t = V[j + (v === 'up' ? -1 : 1)]; if (!t) return; const ti = arr.indexOf(t); arr.splice(i, 1); arr.splice(arr.indexOf(t) + (v === 'down' ? 1 : 0), 0, k); void ti; }
  if (v === 'top') { arr.splice(i, 1); arr.unshift(k); }
  if (v === 'mv') { const to = await menu('Vers quel groupe ?', L.filter((_, x) => x !== gi).map(g => ({ label: g[1], value: g[0] }))); if (!to) return; arr.splice(i, 1); O.k[to].unshift(k); }
  if (v === 'grp') { for (;;) { const g = await menu('Ordre des groupes (touchez pour monter)', O.g.map((x, n) => ({ label: `${n + 1}. ${(L.find(y => y[0] === x) || [])[1] || x}`, value: x })).concat([{ label: '✓ Terminé', value: '__ok' }])); if (!g || g === '__ok') break; const n = O.g.indexOf(g); if (n > 0) { O.g.splice(n, 1); O.g.splice(n - 1, 0, g); } } }
  drOrdSet(O); redraw();
}
function drawerSections(itemHtml) {
  const me = Org.me(), first = SVC_GROUP[me && me.service] || 'trav';
  const placed = new Set(DR_GROUPS.flatMap(g => g[2]));
  const groups = drLayout(DR_GROUPS.map(g => g[0] === 'trav' ? [g[0], g[1], [...g[2], ...Object.keys(SECTIONS).filter(k => !placed.has(k))]] : g).sort((a, b) => (b[0] === first) - (a[0] === first)));
  const st = (k) => { try { const v = localStorage.getItem('dr.g.' + k); return v == null ? null : v === '1'; } catch (e) { return null; } };
  return groups.map(([gk, gl, keys]) => {
    const items = keys.filter(k => SECTIONS[k] && !SECTIONS[k].hidden && k !== 'settings').map(k => { const f = SECTION_FEATURE[k];
      if (sectionOn(k)) return itemHtml(k);
      if (f && !featAllowed(f) && Org.can(f, 'see')) return `<button class="item lk" data-lock="${f}">${icon(SECTIONS[k].icon)}<span>${SECTIONS[k].label}</span><span class="count">${icon('lock', 'style="width:16px;height:16px"')}</span></button>`;
      return ''; }).filter(Boolean);
    if (!items.length) return '';
    const act = keys.includes(App.section) || (App.section === 'beton' && keys.includes('reception')), o = st(gk) ?? (gk === first || act);
    return `<div class="dr-g ${o ? 'open' : ''}" data-g="${gk}"><button class="group dr-gh" data-gt="${gk}"><span>${gl}</span><i>${items.length}</i>${icon('chevdown', 'style="width:16px;height:16px"')}</button><div class="dr-gb">${items.join('')}</div></div>`;
  }).join('');
}
function drawerGroupsBind(d, close) {
  $$('[data-gt]', d).forEach(b => b.onclick = () => { const g = b.parentElement, o = !g.classList.contains('open'); g.classList.toggle('open', o); try { localStorage.setItem('dr.g.' + b.dataset.gt, o ? '1' : '0'); } catch (e) {} });
  $$('[data-lock]', d).forEach(b => b.onclick = () => { close(); featLocked(b.dataset.lock); });
}

// fonction désactivée par le titulaire de la licence : on peut lui demander de l'activer
async function featLocked(f) {
  const L = (typeof Lic !== 'undefined' && Lic.get()) || {};
  const v = await menu(`🔒 « ${featName(f)} » est désactivé pour votre compte.\n${L.ownerName || 'Le titulaire de la licence'} peut l'activer.`, [{ label: 'Demander l\'activation (WhatsApp)', icon: 'share', value: 'wa' }, { label: 'Fermer', icon: 'close', value: 'x' }]);
  if (v === 'wa') openUrl('https://wa.me/?text=' + encodeURIComponent(`Bonjour${L.ownerName ? ' ' + L.ownerName : ''}, pouvez-vous activer « ${featName(f)} » sur mon application Chantier ?${L.code ? '\nMon code : ' + L.code : ''}`));
}
// ---------- packs : comparer et demander (pour plus tard) ----------
function openPacks(feat) {
  const L = (typeof Lic !== 'undefined' && Lic.get()) || {}, cur = L.mode === 'owner' ? 'entreprise' : L.pack || (L.mode === 'user' ? 'pro' : 'entreprise');
  const has = (P, k) => !P.f || P.f.includes(k);
  const keys = FEATURES.map(([k]) => k).filter(k => k !== 'career');
  const s = sheet(`<div class="pk">${feat ? `<div class="pk-why">🔒 <b>${esc(featName(feat))}</b> n'est pas dans votre pack actuel.</div>` : ''}
    <div class="pk-row">${PACKS.map(P => `<div class="pk-c ${P.k === cur ? 'cur' : ''} ${feat && has(P, feat) && !has(packOf(cur) || PACKS[3], feat) ? 'hl' : ''}"><b>${esc(P.n)}</b><small>${esc(P.d)}</small>
      <ul>${keys.map(k => `<li class="${has(P, k) ? '' : 'no'}">${has(P, k) ? '✓' : '—'} ${esc(featName(k))}</li>`).join('')}</ul>
      ${P.k === cur ? '<span class="pk-cur">Votre pack</span>' : `<button class="btn small" data-pk="${P.k}">Demander</button>`}</div>`).join('')}</div>
    <p class="muted" style="font-size:12px">Paiement par virement, CashPlus ou Wafacash. Le titulaire vous envoie ensuite un code : le pack s'active tout seul.</p></div>`, { title: 'Packs Chantier' });
  setTimeout(() => { const t = $('.pk-c.hl', s.el) || $('.pk-c.cur', s.el); if (t) t.parentElement.scrollLeft = t.offsetLeft - 14; }, 50);
  $$('[data-pk]', s.el).forEach(b => b.onclick = () => { const P = packOf(b.dataset.pk);
    openUrl('https://wa.me/?text=' + encodeURIComponent(`Bonjour${L.ownerName ? ' ' + L.ownerName : ''}, je souhaite passer au pack *${P.n}* de l'application Chantier.${L.code ? `\nMon code actuel : ${L.code}` : ''}${Org.label() ? `\nPoste : ${Org.label()}` : ''}`)); });
}

// ---------- hiérarchie : l'équipe du projet (p.team) devient un organigramme ----------
function orgMembers(p) {
  p.team = p.team || []; let ch = false;
  p.team.forEach(m => { if (!m.id) { m.id = DB.uid(); ch = true; } });
  const me = Org.me(), P = Org.poste(), myName = (() => { try { return localStorage.getItem('userName') || ''; } catch (e) { return ''; } })();
  if (P && !p.team.some(m => m.me)) { p.team.unshift({ id: DB.uid(), me: true, name: myName || 'Moi', poste: P.k, service: me.service, role: P.n }); ch = true; }
  return ch;
}
const memPoste = (m) => posteOf(m.poste);
const memLv = (m) => (memPoste(m) || {}).lv || 5;
const memColor = (m) => ((memPoste(m) || {}).svc || svcOf(m.service) || { c: '#64748b' }).c;
// N+1 : choisi, sinon le plus proche au-dessus (même service d'abord)
function memParent(L, m) {
  if (m.parent === '__none') return null;
  if (m.parent && L.some(x => x.id === m.parent) && m.parent !== m.id) return m.parent;
  const up = L.filter(x => x.id !== m.id && memLv(x) < memLv(m)), same = up.filter(x => x.service && x.service === m.service);
  const pick = (A) => A.sort((a, b) => memLv(b) - memLv(a))[0];
  return (pick(same) || pick(up) || {}).id || null;
}
function orgTree(L) {
  const par = new Map(L.map(m => [m.id, memParent(L, m)]));
  // pas de boucle : si A → B → A, on coupe
  for (const m of L) { const seen = new Set([m.id]); let c = par.get(m.id); while (c) { if (seen.has(c)) { par.set(m.id, null); break; } seen.add(c); c = par.get(c); } }
  const kids = (id) => L.filter(m => par.get(m.id) === id).sort((a, b) => memLv(a) - memLv(b) || String(a.service || '').localeCompare(String(b.service || '')));
  return { roots: kids(null), kids, par };
}
function orgLayout(L, collapsed) {
  const { roots, kids, par } = orgTree(L), CW = 168, CH = 70, GX = 18, GY = 56, pos = new Map(); let x = 0, maxD = 0;
  const place = (m, d) => { maxD = Math.max(maxD, d); const ks = collapsed.has(m.id) ? [] : kids(m.id);
    if (!ks.length) { pos.set(m.id, { x, y: d * (CH + GY), m, n: kids(m.id).length }); x += CW + GX; return; }
    ks.forEach(k => place(k, d + 1)); const a = pos.get(ks[0].id), b = pos.get(ks[ks.length - 1].id);
    pos.set(m.id, { x: (a.x + b.x) / 2, y: d * (CH + GY), m, n: ks.length }); };
  roots.forEach(r => place(r, 0));
  return { pos, par, CW, CH, W: Math.max(CW, x - GX) + 40, H: (maxD + 1) * (CH + GY) - GY + 40 };
}
function orgSvg(p, collapsed, { forExport } = {}) {
  const L = p.team, Ly = orgLayout(L, collapsed), { pos, par, CW, CH } = Ly, O = 20;
  const X = (s) => esc(String(s || ''));
  const lines = [...pos.values()].filter(q => par.get(q.m.id) && pos.has(par.get(q.m.id))).map(q => { const a = pos.get(par.get(q.m.id)), x1 = a.x + O + CW / 2, y1 = a.y + O + CH, x2 = q.x + O + CW / 2, y2 = q.y + O, my = (y1 + y2) / 2;
    return `<path d="M${x1} ${y1} V${my} H${x2} V${y2}" fill="none" stroke="${forExport ? '#94a3b8' : 'rgba(148,163,184,.55)'}" stroke-width="1.6"/>`; }).join('');
  const cards = [...pos.values()].map(({ x, y, m, n }) => { const c = memColor(m), P = memPoste(m), x0 = x + O, y0 = y + O;
    return `<g data-m="${m.id}" style="cursor:pointer"><rect x="${x0}" y="${y0}" width="${CW}" height="${CH}" rx="12" fill="${forExport ? '#ffffff' : '#1e293b'}" stroke="${c}" stroke-width="1.6"/>
      <rect x="${x0}" y="${y0}" width="6" height="${CH}" rx="3" fill="${c}"/>
      <circle cx="${x0 + 28}" cy="${y0 + CH / 2}" r="15" fill="${c}"/><text x="${x0 + 28}" y="${y0 + CH / 2 + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">${X((m.name || '?')[0].toUpperCase())}</text>
      <text x="${x0 + 50}" y="${y0 + 26}" font-size="13" font-weight="700" fill="${forExport ? '#0f172a' : '#f1f5f9'}">${X((m.name || '').slice(0, 17))}${m.me ? ' (moi)' : ''}</text>
      <text x="${x0 + 50}" y="${y0 + 43}" font-size="10.5" fill="${forExport ? '#475569' : '#94a3b8'}">${X(((P && P.n) || m.role || '').slice(0, 24))}</text>
      <text x="${x0 + 50}" y="${y0 + 58}" font-size="10" fill="${c}">${X(((P && P.svc.n) || '').slice(0, 24))}${m.interim ? ' · intérim' : ''}</text>
      ${n ? `<g data-cl="${m.id}"><circle cx="${x0 + CW / 2}" cy="${y0 + CH}" r="9" fill="${c}"/><text x="${x0 + CW / 2}" y="${y0 + CH + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${collapsed.has(m.id) ? '+' : '−'}</text></g>` : ''}</g>`; }).join('');
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${Ly.W}" height="${Ly.H}" viewBox="0 0 ${Ly.W} ${Ly.H}" font-family="Roboto, Arial, sans-serif">${forExport ? `<rect width="100%" height="100%" fill="#fff"/>` : ''}${lines}${cards}</svg>`, W: Ly.W, H: Ly.H, pos: Ly.pos, CW, CH, O };
}
async function orgImage(p, collapsed) {
  const { svg, W, H } = orgSvg(p, collapsed, { forExport: true }), k = Math.min(3, 4000 / Math.max(W, H));
  const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  return { canvas: c, W, H };
}
async function renderOrg(root) {
  const p = App.project; if (orgMembers(p)) await DB.put('projects', p);
  const collapsed = new Set(p.orgCollapsed || []), canE = orgEdit('org');
  const save = () => DB.put('projects', p), redraw = () => renderOrg(root);
  root.innerHTML = `<div class="og"><div class="og-bar"><b>Organigramme</b><small>${p.team.length} personne(s)</small><span class="grow"></span>
      ${canE ? `<button class="btn small" data-a="add">${icon('plus')} Personne</button>` : ''}<button class="iconbtn" data-a="exp">${icon('share')}</button></div>
    <div class="og-vp"><div class="og-st"></div></div><div class="og-hint">Pincez pour zoomer · touchez une carte · ± pour plier une branche</div></div>`;
  const vp = $('.og-vp', root), stg = $('.og-st', root); let G;
  const build = () => { G = orgSvg(p, collapsed); stg.innerHTML = G.svg; stg.style.width = G.W + 'px'; stg.style.height = G.H + 'px'; };
  build();
  const pz = panZoom(vp, stg, G.W, G.H, { onTap: ([x, y]) => {
    for (const q of G.pos.values()) { const x0 = q.x + G.O, y0 = q.y + G.O;
      if (q.n && Math.hypot(x - (x0 + G.CW / 2), y - (y0 + G.CH)) < 14) { collapsed.has(q.m.id) ? collapsed.delete(q.m.id) : collapsed.add(q.m.id); p.orgCollapsed = [...collapsed]; save(); build(); return; }
      if (x >= x0 && x <= x0 + G.CW && y >= y0 && y <= y0 + G.CH) return orgFiche(p, q.m, canE, save, redraw); } } });
  setTimeout(() => { pz.fit(); if (pz.st.s > 1) { pz.st.s = 1; pz.apply(); } }, 30);
  if (canE) $('[data-a=add]', root).onclick = () => orgEditMember(p, null, save, redraw);
  $('[data-a=exp]', root).onclick = async () => {
    const v = await menu('Organigramme', [{ label: 'PDF (A4 / A3 paysage)', icon: 'pdf', value: 'pdf' }, { label: 'Image (WhatsApp)', icon: 'image', value: 'png' }]); if (!v) return;
    const ld = loading('Création…');
    try { const { canvas, W, H } = await orgImage(p, collapsed);
      if (v === 'png') { const b = await new Promise(r => canvas.toBlob(r, 'image/png')); ld.close(); return shareBlob(b, `Organigramme_${safeName(p.name)}.png`); }
      const fmt = W > 1400 ? 'a3' : 'a4', doc = new window.jspdf.jsPDF({ unit: 'mm', format: fmt, orientation: 'landscape' }), PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(pt(`Organigramme — ${p.name}`), 12, 14); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110); doc.text(pt(`Mis à jour le ${fmtDate(todayISO())}`), 12, 20);
      const k = Math.min((PW - 24) / W, (PH - 34) / H); doc.addImage(canvas.toDataURL('image/jpeg', .92), 'JPEG', (PW - W * k) / 2, 26, W * k, H * k);
      ld.close(); await sharePdf(doc, `Organigramme_${safeName(p.name)}.pdf`);
    } catch (e) { ld.close(); alertBox('Export impossible : ' + (e.message || e)); }
  };
}
async function orgEditMember(p, m, save, redraw) {
  const others = p.team.filter(x => !m || x.id !== m.id);
  const r = await formSheet(m ? 'Modifier' : 'Nouvelle personne', [
    { name: 'name', label: 'Nom', value: m?.name },
    { name: 'poste', label: 'Poste', type: 'select', value: m?.poste || '', options: [{ value: '', label: '— autre —' }, ...SERVICES.flatMap(s => s.postes.map(x => ({ value: x.k, label: `${s.e} ${x.n}` })))] },
    { name: 'role', label: 'Fonction / entreprise (texte libre)', value: m?.role },
    { name: 'phone', label: 'Téléphone', type: 'tel', value: m?.phone },
    { name: 'parent', label: 'Supérieur direct (N+1)', type: 'select', value: m?.parent || '', options: [{ value: '', label: 'Automatique (selon le poste)' }, { value: '__none', label: 'Personne (tout en haut)' }, ...others.map(x => ({ value: x.id, label: x.name }))] },
    { name: 'interim', label: 'Intérim : remplacé(e) par… (congé)', type: 'select', value: m?.interim || '', options: [{ value: '', label: 'Non' }, ...others.map(x => ({ value: x.id, label: x.name }))] },
    { name: 'interimTo', label: 'Intérim jusqu\'au', type: 'date', value: m?.interimTo || '' },
  ], { danger: m && !m.me ? 'Retirer' : null });
  if (!r) return;
  if (r.__danger) p.team.splice(p.team.indexOf(m), 1);
  else { const P = posteOf(r.poste); const o = { ...r, service: P ? P.svc.k : (m && m.service) || '' }; if (m) Object.assign(m, o); else p.team.push({ id: DB.uid(), ...o }); }
  await save(); redraw();
}
async function orgFiche(p, m, canE, save, redraw) {
  const P = memPoste(m), L = p.team, par = L.find(x => x.id === memParent(L, m)), sub = L.filter(x => memParent(L, x) === m.id), it = m.interim && L.find(x => x.id === m.interim);
  const s = sheet(`<div class="og-f" style="--c:${memColor(m)}"><div class="og-fa">${esc((m.name || '?')[0].toUpperCase())}</div><b>${esc(m.name || '')}${m.me ? ' (moi)' : ''}</b><span>${esc(P ? P.svc.e + ' ' + P.n : m.role || '')}</span>
    ${par ? `<small>N+1 : ${esc(par.name)}</small>` : ''}${sub.length ? `<small>Équipe : ${sub.map(x => esc(x.name)).join(', ')}</small>` : ''}
    ${it && (!m.interimTo || m.interimTo >= todayISO()) ? `<small class="og-int">🔁 En congé · intérim : ${esc(it.name)}${m.interimTo ? ' jusqu\'au ' + fmtDate(m.interimTo) : ''}</small>` : ''}
    <div class="og-fb">${m.phone ? `<a class="btn small" href="tel:${esc(m.phone)}">${icon('phone')} Appeler</a><button class="btn small ghost" data-wa>WhatsApp</button>` : ''}${canE ? `<button class="btn small ghost" data-ed>${icon('edit')} Modifier</button>` : ''}</div></div>`, { title: 'Fiche' });
  const wa = $('[data-wa]', s.el); if (wa) wa.onclick = () => openUrl('https://wa.me/' + String(m.phone).replace(/\D/g, '').replace(/^0/, '212'));
  const ed = $('[data-ed]', s.el); if (ed) ed.onclick = () => { s.close(); orgEditMember(p, m, save, redraw); };
}
// le titulaire voit toutes ses fonctions (Maquette 3D, Modèles 3D, Calculs…) : on annule une seule fois le masquage fait par le choix du poste
try { if (Org.owner() && !localStorage.getItem('feat.reset2')) { localStorage.removeItem('myFeatures'); localStorage.setItem('feat.reset2', '1'); } } catch (e) {}
