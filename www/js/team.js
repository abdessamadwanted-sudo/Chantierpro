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
  // modules inclus (voir MODS) : la formule limite les outils disponibles, le poste limite ce que chacun voit et fait
  // users / projects : quotas (0 = illimité) · storageGb : indicatif (pas encore mesuré) · hier : hiérarchie avancée · shares : groupements / partage externe
  // org : limites quand le pack sert à une organisation (petite entreprise) plutôt qu'à un espace personnel
  basic:      { k: 'basic', l: 'Basic', orgLabel: 'Basic Organisation', e: '🌱', open: true, price: 0, period: 'mois', users: 1, projects: 1, storageGb: 1, perso: true, org: { users: 5, projects: 2, services: 3, storageGb: 2 }, for: 'Fonctions essentielles, pour démarrer', orgFor: 'Petite entreprise : quelques utilisateurs, fonctions essentielles',
                modules: ['projet', 'plans', 'reserves', 'photos', 'rapports', 'equipe'] },
  pro:        { k: 'pro', l: 'Pro', e: '⭐', price: 99, period: 'mois', trialDays: 14, users: 1, projects: 0, storageGb: 30, perso: true, orgOffer: false, highlight: true, for: 'Professionnel indépendant — outils avancés',
                modules: ['projet', 'plans', 'reserves', 'photos', 'rapports', 'equipe', 'reception', 'forms', 'constats', 'calc', 'files', 'topo', 'centrale', 'materiel', 'pointage', 'hse', 'finance'] },
  business:   { k: 'business', l: 'Business', e: '🏢', price: 990, period: 'mois', trialDays: 14, highlight: true, users: 15, extraUserPrice: 49, projects: 0, storageGb: 200, hier: true, for: 'Entreprise — plusieurs utilisateurs, services et projets', modules: '*' },
  enterprise: { k: 'enterprise', l: 'Enterprise', e: '🏛️', price: null, period: 'mois', trialDays: 14, users: 0, projects: 0, storageGb: 1000, hier: true, shares: true, for: 'Grandes entreprises — hiérarchie et groupements avancés', modules: '*' },
};
// packs ouverts au public : Basic seulement par défaut ; les autres s'ouvrent depuis le panneau d'administration (config/plans.<pack>.open).
// Le Super Admin les voit et les choisit tous. Le serveur refuse la création d'un espace avec un pack fermé.
let ST_SUPER = false;
const planOpen = (P) => !!P && (P.k === 'basic' || (PLANS[P.k] || {}).open === true);
// anciennes formules (avant v1.0.14) : « personnel » → Pro, « entreprise » → Enterprise (aucun outil perdu)
const PLAN_ALIAS = { personnel: 'pro', entreprise: 'enterprise' };
const planOf = (k) => PLANS[PLAN_ALIAS[k] || k] || PLANS.basic;
const planPrice = (P) => P.price == null ? 'sur devis' : P.price ? `${P.price} MAD/${P.period}` : 'gratuite';
const planUsers = (P) => P.users ? `${P.users} compte(s)` : 'comptes illimités';
// limites effectives selon l'espace : personnel (valeurs de base) ou organisation (valeurs « org » si le pack en a)
const planFor = (P, perso) => (!perso ? { ...P, ...(P.org || {}), l: P.orgLabel || P.l, for: P.orgFor || P.for } : P);
// listes séparées : l'abonnement personnel (Basic, Pro) et l'abonnement d'une organisation (Basic Organisation, Business, Enterprise)
const offersFor = (perso) => Object.values(PLANS).filter(P => P.visible !== false && (perso ? P.perso : P.orgOffer !== false)).map(P => planFor(P, perso));
const MOD_LABEL = (m) => ((MODS.find(x => x[0] === m) || [m, m])[1]).split(' (')[0];
const qty = (n, unit) => n ? `${n}${unit ? ' ' + unit : ''}` : 'Illimités';
const storageL = (g) => (g >= 1000 ? g / 1000 + ' To' : g + ' Go') + ' (indicatif)';
// carte d'offre : utilisateurs inclus, projets actifs, services, stockage, outils (liste détaillée), prix et essai
function offerCard(P, perso, btn = true) {
  const mods = P.modules === '*' ? MODS.map(([m]) => m) : P.modules, price = P.price == null ? 'Sur devis' : P.price ? `${P.price} MAD / ${P.period}` : 'Gratuit';
  const act = P.price == null ? 'Demander un devis · essai' : P.price ? `Démarrer l'essai ${P.trialDays || 14} jours` : 'Commencer gratuitement';
  const locked = btn && !planOpen(P) && !ST_SUPER;
  return `<div class="st-offer ${P.highlight && !locked ? 'hl' : ''} ${locked ? 'lk' : ''}" data-offer="${P.k}"><div class="st-of-h"><b>${locked ? '🔒 ' : ''}${esc(P.e || '')} ${esc(P.l)}</b>${P.highlight && !locked ? '<i>Recommandé</i>' : ''}${locked ? '<i class="soon">Sur demande</i>' : ''}<em class="${P.price === 0 ? 'free' : ''}">${esc(price)}</em></div>
    ${P.price && P.trialDays ? `<small class="st-of-t">Essai gratuit ${P.trialDays} jours, sans paiement</small>` : ''}<small class="st-of-f">${esc(P.for || '')}</small>
    <div class="st-of-r"><span>Utilisateurs inclus</span><b>${P.users ? (perso && P.users === 1 ? '1 (vous)' : P.users) + (P.extraUserPrice ? ` (+${P.extraUserPrice} MAD / pers.)` : '') : 'Selon contrat'}</b></div>
    <div class="st-of-r"><span>Projets actifs</span><b>${qty(P.projects)}</b></div>
    ${perso ? '' : `<div class="st-of-r"><span>Services</span><b>${qty(P.services)}</b></div>`}
    <div class="st-of-r"><span>Stockage</span><b>${storageL(P.storageGb)}</b></div>
    <details class="st-of-d"><summary><span>Outils inclus</span><b>${mods.length} sur ${MODS.length}${P.hier ? ' + hiérarchie' : ''}${P.shares ? ' + groupements' : ''}</b></summary>
      <div>${MODS.map(([m]) => `<i class="${mods.includes(m) ? 'on' : ''}">${mods.includes(m) ? '✓' : '—'} ${esc(MOD_LABEL(m))}</i>`).join('')}</div></details>
    ${P.k === 'enterprise' && !perso ? '<div class="st-of-r st-of-srv"><span>🖥️ Serveur privé (vos données chez vous)</span><b>Contactez-nous</b></div>' : ''}
    ${btn ? (locked ? `<button class="btn ghost" data-req="${P.k}">Demander l'accès</button>` : `<button class="btn ${P.highlight ? '' : 'ghost'}" data-p="${P.k}">${act}</button>`) : ''}</div>`;
}
// état de l'abonnement (la facturation n'existe pas encore : l'activation est faite par le Super Admin)
function planStateOf(c) {
  const st = (c || {}).planStatus, P = planOf((c || {}).plan || PLAN_DEFAULT_COMPANY), end = c && c.trialEndsAt && c.trialEndsAt.toMillis ? c.trialEndsAt.toMillis() : null;
  const days = end ? Math.ceil((end - Date.now()) / 864e5) : null;
  if (st === 'actif') return { k: 'actif', l: 'Actif', c: '#22c55e' };
  if (st === 'suspendu') return { k: 'expire', l: 'Suspendu', c: '#ef4444' };
  if (st === 'gratuit' || P.price === 0) return { k: 'gratuit', l: 'Gratuit', c: '#22c55e' };
  if (end && days <= 0) return { k: 'expire', l: 'Essai terminé', c: '#ef4444', days };
  if (end && days <= 7) return { k: 'paiement', l: `Paiement requis · ${days} j`, c: '#f59e0b', days };
  return { k: 'essai', l: end ? `Essai · ${days} j` : 'Essai', c: '#3b82f6', days };
}
// entreprises existantes sans formule : Enterprise (rien ne change pour elles) — facturation réelle à brancher avant tout lancement public
const PLAN_DEFAULT_COMPANY = 'enterprise';

// ---------- Type d'organisation (« jiha ») : choisit l'interface (outils mis en avant) et le modèle de services proposé ----------
// mods : modules affichés pour ce type d'organisation ('*' = tous) · svcs : services proposés à la création · owner : poste du créateur
const ORG_TYPES = [
  { k: 'entreprise', e: '🏗️', l: 'Entreprise BTP', d: 'Entreprise générale, gros œuvre, travaux', owner: 'patron', mods: '*',
    svcs: ['direction', 'travaux', 'hse', 'qualite', 'labo', 'topo', 'methodes', 'etudes', 'achats', 'magasin', 'materiel', 'maintenance', 'transport', 'pointage', 'rh', 'contrats', 'admin'] },
  { k: 'soustraitant', e: '🤝', l: 'Sous-traitant / tâcheron', d: 'Un lot : ferraillage, coffrage, finitions…', owner: 'soustraitant',
    mods: ['projet', 'plans', 'reserves', 'reception', 'photos', 'forms', 'rapports', 'constats', 'calc', 'equipe', 'files', 'materiel', 'pointage', 'hse', 'finance'],
    svcs: ['direction', 'travaux', 'ferraillage', 'materiel', 'hse'] },
  { k: 'bet', e: '🧮', l: "Bureau d'études (BET)", d: 'Structure, fluides, notes de calcul, visas', owner: 'bet',
    mods: ['projet', 'plans', 'reserves', 'photos', 'forms', 'rapports', 'constats', 'calc', 'equipe', 'files', 'finance'], svcs: ['direction', 'bim', 'metre', 'doc', 'admin'] },
  { k: 'archi', e: '🏛️', l: 'Architecte / MOE', d: 'Conception, plans, visas, suivi architectural', owner: 'architecte',
    mods: ['projet', 'plans', 'reserves', 'photos', 'forms', 'rapports', 'constats', 'calc', 'equipe', 'files'], svcs: ['direction', 'bim', 'doc', 'admin'] },
  { k: 'moa', e: '🏢', l: "Maître d'ouvrage", d: 'Client, AMO : suivi, validations, budget', owner: 'mo',
    mods: ['projet', 'plans', 'reserves', 'photos', 'forms', 'rapports', 'constats', 'equipe', 'files', 'finance'], svcs: ['direction', 'qualite', 'doc', 'admin'] },
  { k: 'bc', e: '🔍', l: 'Bureau de contrôle', d: 'Contrôle technique, visites, avis, PV', owner: 'bcontrole',
    mods: ['projet', 'plans', 'reserves', 'reception', 'photos', 'forms', 'rapports', 'constats', 'equipe', 'files'], svcs: ['direction', 'qualite', 'doc'] },
  { k: 'labo', e: '🧪', l: 'Laboratoire', d: 'Essais béton, sols, granulats, aciers', owner: 'labo',
    mods: ['projet', 'plans', 'reception', 'photos', 'forms', 'rapports', 'constats', 'calc', 'equipe', 'files'], svcs: ['direction', 'labo', 'doc'] },
  { k: 'topo', e: '📍', l: 'Cabinet de topographie', d: 'Implantations, levés, récolements', owner: 'cheftopo',
    mods: ['projet', 'plans', 'photos', 'forms', 'rapports', 'calc', 'equipe', 'files', 'topo', 'materiel'], svcs: ['direction', 'topo', 'materiel'] },
];
// espace personnel (professionnel indépendant) : tous les outils de sa formule, interface de son métier
ORG_TYPES.push(
  { k: 'artisan', e: '🧰', l: 'Artisan', d: 'Maçon, électricien, plombier, peintre…', owner: 'patron',
    mods: ['projet', 'plans', 'reserves', 'photos', 'rapports', 'calc', 'equipe', 'files', 'pointage', 'finance'], svcs: ['direction', 'travaux'] },
  { k: 'fournisseur', e: '🧱', l: 'Fournisseur / commerçant', d: 'Matériaux, outillage, équipements', owner: 'patron',
    mods: ['projet', 'plans', 'photos', 'rapports', 'equipe', 'files', 'materiel', 'finance'], svcs: ['direction', 'logistique', 'admin'] },
  { k: 'loueur', e: '🏗', l: 'Loueur de matériel', d: 'Grues, engins, nacelles, coffrages', owner: 'patron',
    mods: ['projet', 'plans', 'photos', 'rapports', 'equipe', 'files', 'materiel', 'pointage', 'finance'], svcs: ['direction', 'materiel', 'logistique', 'admin'] },
  { k: 'promoteur', e: '🏘️', l: 'Promoteur immobilier', d: 'Programmes immobiliers et commerciaux', owner: 'mo',
    mods: ['projet', 'plans', 'reserves', 'reception', 'photos', 'forms', 'rapports', 'constats', 'equipe', 'files', 'finance'], svcs: ['direction', 'qualite', 'doc', 'admin'] },
  { k: 'formation', e: '🎓', l: 'Établissement de formation', d: 'Écoles, centres de formation BTP', owner: 'patron',
    mods: ['projet', 'plans', 'photos', 'rapports', 'calc', 'equipe', 'files'], svcs: ['direction', 'doc', 'admin'] },
);
const ORG_PERSO = { k: 'independant', e: '👷', l: 'Espace personnel', d: 'Professionnel indépendant', owner: null, mods: '*', svcs: [] };
const orgTypeOf = (k) => ORG_TYPES.find(t => t.k === k) || (k === 'independant' ? ORG_PERSO : ORG_TYPES[0]);
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
// projet multi-organisations (v1.0.19) : rôle d'une organisation partenaire dans le projet
const PARTNER_ROLES = [['jv', 'Membre du groupement (JV)'], ...SHARE_ENTITIES.filter(x => x[0] !== 'autre'), ['fournisseur', 'Fournisseur'], ['loueur', 'Loueur de matériel'], ['autre', 'Autre']];
const partnerRoleLabel = (k) => (PARTNER_ROLES.find(x => x[0] === k) || [k, k || '—'])[1];
// accès proposés par défaut selon le rôle (le titulaire ajuste ; au plus « Modifier »)
const PARTNER_DEF = {
  jv: { plans: 2, reserves: 2, reception: 2, photos: 2, forms: 2, rapports: 2, constats: 2, calc: 1, files: 2, topo: 1, hse: 1 },
  mo: { plans: 1, reserves: 1, reception: 1, photos: 1, forms: 1, rapports: 1, files: 1 }, mod: { plans: 1, reserves: 2, reception: 1, photos: 1, forms: 1, rapports: 1, files: 1 },
  architecte: { plans: 2, reserves: 2, photos: 1, rapports: 1, files: 2 }, bet: { plans: 2, reserves: 2, photos: 1, forms: 1, rapports: 1, calc: 1, files: 2 },
  bcontrole: { plans: 1, reserves: 2, reception: 1, photos: 1, forms: 1, rapports: 1, constats: 2, files: 1 }, labo: { plans: 1, reception: 1, photos: 1, forms: 2, rapports: 1, files: 2 },
  topoext: { plans: 2, photos: 1, topo: 2, files: 1 }, soustraitant: { plans: 1, reserves: 2, photos: 2, rapports: 1, files: 1 }, entreprise: { plans: 1, reserves: 2, photos: 2, rapports: 1, files: 1 },
};

// ---------- Services, rôles, permissions ----------
const TM_SERVICES = [
  { k: 'direction', l: 'Direction', c: '#334155' }, { k: 'travaux', l: 'Travaux', c: '#2563eb' }, { k: 'ferraillage', l: 'Ferraillage', c: '#dc2626' },
  { k: 'centrale', l: 'Centrale à béton', c: '#64748b' }, { k: 'materiel', l: 'Matériel', c: '#ca8a04' }, { k: 'topo', l: 'Topographie', c: '#0d9488' },
  { k: 'qualite', l: 'Qualité', c: '#16a34a' }, { k: 'hse', l: 'HSE', c: '#ea580c' }, { k: 'metre', l: 'Métré', c: '#7c3aed' },
  { k: 'bim', l: 'Méthodes / Planning / BIM', c: '#0891b2' }, { k: 'logistique', l: 'Logistique', c: '#a16207' }, { k: 'doc', l: 'Documentation', c: '#0ea5e9' },
  { k: 'labo', l: 'Laboratoire', c: '#8b5cf6' }, { k: 'admin', l: 'Administration & finance', c: '#a855f7' },
  { k: 'achats', l: 'Achats & approvisionnement', c: '#b45309' },
  { k: 'magasin', l: 'Magasin & stocks', c: '#92400e' },
  { k: 'rh', l: 'Ressources humaines & personnel', c: '#7c3aed' },
  { k: 'pointage', l: 'Pointage & effectifs', c: '#0891b2' },
  { k: 'maintenance', l: 'Maintenance & parc matériel', c: '#ca8a04' },
  { k: 'methodes', l: 'Méthodes & planification', c: '#0e7490' },
  { k: 'etudes', l: 'Études techniques', c: '#0369a1' },
  { k: 'contrats', l: 'Marchés, métrés & contrats', c: '#6d28d9' },
  { k: 'transport', l: 'Transport & logistique', c: '#a16207' },
  { k: 'externe', l: 'Intervenants externes', c: '#db2777' },
];
// services remplacés par des services plus précis (v1.0.21) : gardés pour les membres existants, plus proposés aux nouvelles organisations
const SERVICES_LEGACY = ['logistique'];
// modules (= droits) : projet (infos, rappels, constats, 3D…), plans, réserves, réception & bétonnage, photos, formulaires, rapports, constats, calculs, équipe, fichiers
const MODS = [['projet', 'Projet (infos, rappels, 3D)'], ['plans', 'Plans & maquettes'], ['reserves', 'Réserves / tâches'], ['reception', 'Réception & bétonnage'], ['photos', 'Photos'],
  ['forms', 'Formulaires / PV'], ['rapports', 'Rapports journaliers'], ['constats', 'Constats / NC'], ['calc', 'Calculs & topo'], ['equipe', 'Équipe du projet'], ['files', 'Fichiers'],
  ['topo', 'Topographie (implantations, levés)'], ['centrale', 'Centrale à béton (commandes, BL)'], ['materiel', 'Matériel & stock'], ['pointage', 'Pointage & effectifs'], ['hse', 'HSE (sécurité)'],
  ['finance', 'Financier, TCE, avenants & sous-traitants']];
const LEVELS = ['Aucun accès', 'Voir', 'Modifier', 'Valider', 'Administrer'];
// droits par rôle : chiffres dans l'ordre de MODS (0 aucun · 1 voir · 2 modifier · 3 valider · 4 administrer)
const TM_ROLES = [
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
  ['dirqualite', 'Directeur qualité', 'qualite', '3234343424311002'], ['ingqualite', 'Ingénieur qualité', 'qualite', '2233232323211001'],
  ['respqualite', 'Responsable qualité', 'qualite', '2233231310221112'], ['techqualite', 'Technicien qualité', 'qualite', '2133221210221111'],
  ['ctrlqualite', 'Contrôleur qualité', 'qualite', '1122220100100001'],
  ['resphse', 'Responsable HSE', 'hse', '2120231300211114'], ['animhse', 'Animateur HSE', 'hse', '2120220200211113'],
  ['metreur', 'Métreur', 'metre', '1211111130211110'], ['bimmanager', 'BIM manager', 'bim', '2300100020210000'], ['projeteur', 'Projeteur', 'bim', '1200000010210000'],
  ['respachats', 'Responsable achats', 'achats', '1100201000200311'],
  ['acheteur', 'Acheteur', 'achats', '1000201000200211'],
  ['chefmagasin', 'Chef magasin', 'magasin', '1100201000200311'],
  ['magasinierstock', 'Magasinier stock', 'magasin', '1000201000200211'],
  ['responsablerh', 'Responsable RH', 'rh', '1100102002200041'],
  ['gestionnairepersonnel', 'Gestionnaire du personnel', 'rh', '1000102002200031'],
  ['responsablepointage', 'Responsable pointage', 'pointage', '1000102002200041'],
  ['agentpointage', 'Pointeur chantier', 'pointage', '1000102002200031'],
  ['chefmaintenance', 'Responsable maintenance', 'maintenance', '1100202010200421'],
  ['technicienmaintenance', 'Technicien maintenance', 'maintenance', '1000201000200201'],
  ['responsablemethodes', 'Responsable méthodes', 'methodes', '2300100020210000'],
  ['planificateur', 'Planificateur', 'methodes', '1200100020210000'],
  ['ingetudes', 'Ingénieur études', 'etudes', '2300100020210000'],
  ['gestionnairecontrats', 'Gestionnaire contrats', 'contrats', '1211111130211110'],
  ['responsabletransport', 'Responsable transport', 'transport', '1100202010200421'],
  ['magasinier', 'Magasinier', 'logistique', '1000201000200311'], ['resppointage', 'Responsable pointage', 'logistique', '1000102002200041'], ['pointeur', 'Pointeur', 'logistique', '1000102002200031'],
  ['mo', "Maître d'ouvrage", 'externe', '1111111101111001'], ['mod', "Maître d'ouvrage délégué", 'externe', '1111111101111001'], ['architecte', 'Architecte', 'externe', '1221101101110000'],
  ['bet', "BET (bureau d'études)", 'externe', '1221111211111001'], ['bcontrole', 'Bureau de contrôle', 'externe', '1121111201111001'], ['labo', 'Laboratoire', 'externe', '1001220000102000'],
  ['soustraitant', 'Sous-traitant', 'externe', '1120201001211011'],
  ['respdoc', 'Responsable documentation', 'doc', '2311131101300000'], ['agentdoc', 'Agent documentation', 'doc', '1211121101200000'],
  ['resplabo', 'Responsable laboratoire', 'labo', '2113232221202001'], ['techlabo', 'Technicien laboratoire', 'labo', '1112221121201001'],
  ['respadmin', 'Responsable administratif & financier', 'admin', '2110111012200131'], ['comptable', 'Comptable / RH', 'admin', '1000011011200120'],
].map(([k, l, s, p, adm]) => ({ k, l, s, perms: Object.fromEntries(MODS.map(([m], i) => [m, +p[i] || 0])), admin: !!adm }));
// module « finance » (ajouté avec les outils de Chantier) : accès par défaut selon le poste (les administrateurs ont tout)
{ const FIN = { dirqualite: 1, respadmin: 3, comptable: 2, dirtravaux: 3, conducteur: 1, condferraillage: 1, metreur: 3, respmateriel: 1, resppointage: 1, mo: 1, mod: 1, bet: 1,
    respachats: 2, acheteur: 1, chefmagasin: 1, responsablerh: 2, responsablepointage: 1, chefmaintenance: 1, gestionnairecontrats: 3, responsabletransport: 1 };
  TM_ROLES.forEach(r => { r.perms.finance = r.admin ? 4 : (FIN[r.k] || 0); }); }
// rang hiérarchique dans le service (1 = le plus haut) : sert à l'organigramme, à la délégation et à la validation
const ROLE_RANK = { dirqualite: 1, ingqualite: 2, respqualite: 3, techqualite: 4, ctrlqualite: 5,
  respachats: 1, acheteur: 2, chefmagasin: 1, magasinierstock: 2, responsablerh: 1, gestionnairepersonnel: 2, responsablepointage: 1, agentpointage: 2,
  chefmaintenance: 1, technicienmaintenance: 2, responsablemethodes: 1, planificateur: 2, ingetudes: 1, gestionnairecontrats: 1, responsabletransport: 1 };
// postes remplacés par ceux des nouveaux services (même métier) : un membre existant garde son poste, mais ils ne sont plus proposés
const ROLE_LEGACY = { magasinier: 'magasinierstock', resppointage: 'responsablepointage', pointeur: 'agentpointage' };
TM_ROLES.forEach(r => { r.rank = ROLE_RANK[r.k] || (r.admin ? 1 : 3); });
// services ouverts : on travaille service par service, les autres restent fermés (🔒) — liste modifiable par le Super Admin (config/services)
let SERVICES_OPEN = ['direction', 'qualite', 'externe', 'perso'];
const svcOpen = (k) => SERVICES_OPEN.includes('*') || SERVICES_OPEN.includes(k);
// postes de l'organisation : postes de base (renommables, désactivables) + postes créés par l'organisation (companies/{cid}/postes)
let ROLE_CFG = {}, ROLE_CUSTOM = [];
const allRoles = () => [...TM_ROLES.filter(r => !(ROLE_CFG[r.k] || {}).disabled).map(r => (ROLE_CFG[r.k] && ROLE_CFG[r.k].l ? { ...r, l: ROLE_CFG[r.k].l } : r)), ...ROLE_CUSTOM.filter(r => !r.disabled)];
const ROLE_PROPRIO = { k: 'proprietaire', l: 'Propriétaire de l\'espace', s: 'perso', perms: {}, admin: true };
const ROLE_COLLAB = { k: 'collaborateur', l: 'Collaborateur (projet partagé)', s: 'perso', perms: {}, admin: false };
const tmRoleOf = (k) => { if (k === 'proprietaire') return ROLE_PROPRIO; if (k === 'collaborateur') return ROLE_COLLAB;
  const c = ROLE_CUSTOM.find(r => r.k === k); if (c) return c;
  const b = TM_ROLES.find(r => r.k === k); if (b) return ROLE_CFG[k] && ROLE_CFG[k].l ? { ...b, l: ROLE_CFG[k].l } : b;
  return { k, l: k, s: 'externe', perms: {}, admin: false, rank: 9 }; };
const metierOf = (k) => TM_ROLES.find(r => r.k === k) || null;
const serviceOf = (k) => TM_SERVICES.find(s => s.k === k) || TM_SERVICES[TM_SERVICES.length - 1];
// magasin local → module (sous-collection Firestore)
const STORE_MOD = { projects: 'projet', folders: 'plans', plans: 'plans', links: 'plans', tasks: 'reserves', receptions: 'reception', forms: 'forms', reports: 'rapports', files: 'files', items: '*' };
// éléments des espaces (store « items ») : module selon le type
const KIND_MOD = { impl: 'topo', leve: 'topo', cmd: 'centrale', bl: 'centrale', mat: 'materiel', stock: 'materiel', pt: 'pointage', hse: 'hse', rdt: 'rapports' };
const modOf = (store, rec) => store === 'items' ? KIND_MOD[(rec || {}).kind] : STORE_MOD[store];
// section de l'application → module
// rubriques issues de Chantier : rattachées au module SiteTeam le plus proche (visibilité selon le poste)
const SECTION_MOD = { avancement: 'projet', clauses: 'forms', gestion: 'materiel', finance: 'finance', tce: 'finance', avenants: 'finance', st: 'finance',
  planning: 'projet', reunions: 'forms', pointage: 'pointage', rfi: 'forms', visa: 'forms', labo: 'reception', hse: 'hse', org: 'equipe',
  dashboard: 'projet', plans: 'plans', tasks: 'reserves', reception: 'reception', beton: 'reception', photos: 'photos', forms: 'forms', reports: 'rapports',
  constat: 'constats', models3d: 'plans', maquette: 'plans', calc: 'calc', team: 'equipe', settings: 'projet', docq: 'files', histo: 'projet', orgs: 'projet' };

const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signed() { return request.auth != null; }
    function memPath(cid) { return /databases/$(db)/documents/companies/$(cid)/members/$(request.auth.uid); }
    // compte bloqué par le Super Admin (users/{uid}.blocked) : plus aucun accès aux organisations, projets et fichiers
    function okUser() { return !exists(/databases/$(db)/documents/users/$(request.auth.uid)) || get(/databases/$(db)/documents/users/$(request.auth.uid)).data.get('blocked', false) != true; }
    function isMem(cid) { return signed() && exists(memPath(cid)) && okUser(); }
    function mem(cid) { return get(memPath(cid)).data; }
    function isAdmin(cid) { return isMem(cid) && mem(cid).admin == true; }
    function lvl(cid, m) { return mem(cid).perms.get(m, 0); }
    // organisation suspendue par le Super Admin : ses projets ne sont plus accessibles (rien n'est effacé)
    function live(cid) { return !exists(/databases/$(db)/documents/companies/$(cid)) || get(/databases/$(db)/documents/companies/$(cid)).data.get('planStatus', '') != 'suspendu'; }
    function canProj(cid, pid) { return (mem(cid).allProjects == true || pid in mem(cid).projects) && live(cid); }
    function inv(code) { return get(/databases/$(db)/documents/invites/$(code)).data; }
    function invLive(code) { return inv(code).used == false && inv(code).get('status', 'valide') == 'valide' && (inv(code).get('expiresAt', null) == null || inv(code).expiresAt > request.time); }
    function memOf(cid, u) { return get(/databases/$(db)/documents/companies/$(cid)/members/$(u)).data; }
    // validation des PV (module forms) : brouillon → soumis par l'auteur ; validé / refusé seulement par un responsable
    // (administrateur, niveau Administrer, ou niveau Valider ET responsable direct de l'auteur) — jamais par l'auteur lui-même
    function validator(cid, d) {
      return d.get('aut', '') != request.auth.uid && (isAdmin(cid) || lvl(cid, 'forms') >= 4
        || (lvl(cid, 'forms') >= 3 && d.get('aut', '') != '' && exists(/databases/$(db)/documents/companies/$(cid)/members/$(d.aut))
            && memOf(cid, d.aut).get('managerUid', '') == request.auth.uid));
    }
    function vOk(cid) {
      let d = request.resource.data;
      let n = d.get('vst', 'brouillon');
      let o = resource == null ? 'brouillon' : resource.data.get('vst', 'brouillon');
      return (resource == null || d.get('aut', '') == resource.data.get('aut', ''))
        && ((o != 'valide' && (n == o || n == 'brouillon' || n == 'soumis'))
          || (n in ['valide', 'refuse'] && d.get('vby', '') == request.auth.uid && validator(cid, d)));
    }
    function co(cid) { return get(/databases/$(db)/documents/companies/$(cid)).data; }
    // code pack (créé par le Super Admin) : ouvre un pack à la personne qui l'entre, une fois par personne, dans la limite des utilisations
    function pc(code) { return get(/databases/$(db)/documents/packCodes/$(code)).data; }
    function codeOk(code) {
      return code is string && exists(/databases/$(db)/documents/packCodes/$(code)) && pc(code).status == 'valide' && pc(code).uses < pc(code).maxUses
        && !(request.auth.uid in pc(code).usedBy) && (pc(code).get('expiresAt', null) == null || pc(code).expiresAt > request.time);
    }
    function codePlanOk(d) {
      return codeOk(d.packCode) && d.plan == pc(d.packCode).plan
        && ((pc(d.packCode).days == 0 && d.planStatus == 'actif')
          || (pc(d.packCode).days > 0 && d.planStatus == 'essai' && d.trialEndsAt <= request.time + duration.value(pc(d.packCode).days + 1, 'd')));
    }
    function maxLvl2(p) { return p.keys().hasOnly(['projet', 'plans', 'reserves', 'reception', 'photos', 'forms', 'rapports', 'constats', 'calc', 'equipe', 'files', 'topo', 'centrale', 'materiel', 'pointage', 'hse', 'finance']) && p.get('projet', 0) <= 2 && p.get('plans', 0) <= 2 && p.get('reserves', 0) <= 2 && p.get('reception', 0) <= 2 && p.get('photos', 0) <= 2 && p.get('forms', 0) <= 2 && p.get('rapports', 0) <= 2 && p.get('constats', 0) <= 2 && p.get('calc', 0) <= 2 && p.get('equipe', 0) <= 2 && p.get('files', 0) <= 2 && p.get('topo', 0) <= 2 && p.get('centrale', 0) <= 2 && p.get('materiel', 0) <= 2 && p.get('pointage', 0) <= 2 && p.get('hse', 0) <= 2 && p.get('finance', 0) <= 2; }
    // espace personnel : seulement des « collaborateurs » sur UN projet, au plus « Modifier », jamais admin, et seulement en pack Pro
    function persoOK(d) { return co(d.cid).get('kind', 'org') != 'perso' || (d.admin == false && d.allProjects == false && d.projects.size() == 1
      && d.role == 'collaborateur' && co(d.cid).get('plan', '') == 'pro' && maxLvl2(d.perms)); }
    // personne autorisée à créer un code d'accès : administrateur, ou poste avec « Équipe » au niveau Valider (3) ou plus,
    // qui ne peut donner ni plus de droits ni plus de projets qu'elle n'en a, ni le statut d'administrateur
    function canInvite(cid) { return isMem(cid) && (mem(cid).admin == true || lvl(cid, 'equipe') >= 3); }
    function permsWithin(cid, p) {
      let m = mem(cid).perms;
      return p.keys().hasOnly(['projet', 'plans', 'reserves', 'reception', 'photos', 'forms', 'rapports', 'constats', 'calc', 'equipe', 'files', 'topo', 'centrale', 'materiel', 'pointage', 'hse', 'finance'])
        && p.get('projet', 0) <= m.get('projet', 0) && p.get('plans', 0) <= m.get('plans', 0) && p.get('reserves', 0) <= m.get('reserves', 0)
        && p.get('reception', 0) <= m.get('reception', 0) && p.get('photos', 0) <= m.get('photos', 0) && p.get('forms', 0) <= m.get('forms', 0)
        && p.get('rapports', 0) <= m.get('rapports', 0) && p.get('constats', 0) <= m.get('constats', 0) && p.get('calc', 0) <= m.get('calc', 0)
        && p.get('equipe', 0) <= m.get('equipe', 0) && p.get('files', 0) <= m.get('files', 0) && p.get('topo', 0) <= m.get('topo', 0)
        && p.get('centrale', 0) <= m.get('centrale', 0) && p.get('materiel', 0) <= m.get('materiel', 0) && p.get('pointage', 0) <= m.get('pointage', 0)
        && p.get('hse', 0) <= m.get('hse', 0) && p.get('finance', 0) <= m.get('finance', 0);
    }
    function projWithin(cid, d) { return mem(cid).allProjects == true || (d.allProjects == false && d.projects.hasOnly(mem(cid).projects)); }
    // projet multi-organisations : une organisation partenaire (BET, MOA, architecte, labo, membre du groupement…) accède au projet
    // d'une autre organisation, seulement aux modules accordés (au plus « Modifier ») et seulement depuis son espace actif ;
    // chaque membre du partenaire garde en plus ses propres droits dans sa propre organisation (le plus petit des deux s'applique)
    function wsOf() { return get(/databases/$(db)/documents/users/$(request.auth.uid)).data.get('companyId', ''); }
    function partOf(cid, pid, o) { return get(/databases/$(db)/documents/companies/$(cid)/projects/$(pid)/partners/$(o)).data; }
    function pOk(cid, pid, mod, n) {
      let o = wsOf();
      return signed() && o != '' && o != cid && okUser() && live(cid) && exists(/databases/$(db)/documents/companies/$(o)/members/$(request.auth.uid))
        && exists(/databases/$(db)/documents/companies/$(cid)/projects/$(pid)/partners/$(o))
        && partOf(cid, pid, o).get('status', '') == 'actif' && partOf(cid, pid, o).mods.get(mod, 0) >= n
        && memOf(o, request.auth.uid).perms.get(mod, 0) >= n
        && (memOf(o, request.auth.uid).allProjects == true || pid in memOf(o, request.auth.uid).projects);
    }
    // groupement (JV) : l'administrateur de l'organisation « mandataire » gère aussi les partenaires du projet
    function mandAdmin(cid, pid) {
      let o = wsOf();
      return signed() && o != '' && o != cid && get(/databases/$(db)/documents/companies/$(cid)/projects/$(pid)).data.get('jv', {}).get('mand', '') == o
        && isAdmin(o) && exists(/databases/$(db)/documents/companies/$(cid)/projects/$(pid)/partners/$(o));
    }
    function projAcc(cid, pid) { return (isMem(cid) && canProj(cid, pid)) || pOk(cid, pid, 'projet', 1); }

    // profil : la personne elle-même ; le blocage (blocked) ne se change que par le Super Admin
    match /users/{uid} {
      allow read: if (signed() && request.auth.uid == uid) || licOwner();
      allow create: if signed() && request.auth.uid == uid && request.resource.data.get('blocked', false) == false;
      allow update: if (signed() && request.auth.uid == uid && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['blocked', 'blockedAt', 'blockedWhy']))
        || (licOwner() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['blocked', 'blockedAt', 'blockedWhy']));
      allow delete: if signed() && request.auth.uid == uid;
    }
    // panneau d'administration (Super Admin) : vues globales en lecture
    match /{path=**}/projects/{pid} { allow read: if licOwner(); }
    match /{path=**}/members/{uid} { allow read: if licOwner(); }
    // erreurs de l'application : chacun envoie les siennes (sans données personnelles), le Super Admin les lit
    match /errors/{id} {
      allow create: if signed() && request.resource.data.uid == request.auth.uid && request.resource.data.msg is string && request.resource.data.msg.size() <= 300
        && request.resource.data.keys().hasOnly(['uid', 'cid', 'msg', 'src', 'stack', 'ver', 'platform', 'at']);
      allow read, delete: if licOwner();
    }
    // codes pack : lus un par un par tout compte connecté ; une utilisation = +1 et son propre identifiant, rien d'autre
    match /packCodes/{code} {
      allow get: if signed();
      allow list, create, delete: if licOwner();
      allow update: if licOwner() || (signed() && resource.data.status == 'valide' && resource.data.uses < resource.data.maxUses
        && !(request.auth.uid in resource.data.usedBy)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['uses', 'usedBy', 'lastUsedAt'])
        && request.resource.data.uses == resource.data.uses + 1 && request.resource.data.usedBy == resource.data.usedBy.concat([request.auth.uid]));
    }
    // demandes de pack (la facturation n'est pas en ligne) : la personne dépose, le Super Admin traite
    match /packRequests/{id} {
      allow create: if signed() && request.resource.data.uid == request.auth.uid && request.resource.data.status == 'attente';
      allow read: if licOwner() || (signed() && resource.data.uid == request.auth.uid);
      allow update, delete: if licOwner();
    }
    // annonces du Super Admin : à tous (target = 'all') ou à une personne (target = uid)
    match /annonces/{id} {
      allow read: if licOwner() || (signed() && (resource.data.target == 'all' || resource.data.target == request.auth.uid));
      allow write: if licOwner();
    }

    match /invites/{code} {
      allow get: if signed();
      allow list: if signed() && (isAdmin(resource.data.cid) || resource.data.createdBy == request.auth.uid);
      // un code créé par une personne autorisée (non administrateur) passe toujours par l'approbation d'un administrateur
      allow create: if signed() && request.resource.data.createdBy == request.auth.uid
        && (request.resource.data.get('kind', '') != 'partner' || (request.resource.data.pid is string && request.resource.data.used == false
            && maxLvl2(request.resource.data.mods) && request.resource.data.mods.get('projet', 0) == 1
            && (isAdmin(request.resource.data.cid) || mandAdmin(request.resource.data.cid, request.resource.data.pid))))
        && (request.resource.data.get('kind', '') == 'partner' || persoOK(request.resource.data)) && (request.resource.data.get('kind', '') == 'partner' || isAdmin(request.resource.data.cid)
        || (canInvite(request.resource.data.cid) && request.resource.data.admin == false && request.resource.data.get('needsApproval', false) == true
            && permsWithin(request.resource.data.cid, request.resource.data.perms) && projWithin(request.resource.data.cid, request.resource.data)));
      allow update: if signed() && (isAdmin(resource.data.cid)
        || (resource.data.createdBy == request.auth.uid && request.resource.data.status == 'revoque'
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'revokedAt']))
        || (invLive(code)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['used', 'usedBy', 'usedAt'])
        && request.resource.data.usedBy == request.auth.uid));
      allow delete: if signed() && (isAdmin(resource.data.cid) || resource.data.createdBy == request.auth.uid);
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
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['responses'])
            && request.resource.data.responses.size() == resource.data.responses.size() + 1
            && request.resource.data.responses[0:resource.data.responses.size()] == resource.data.responses));
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

    // réglages globaux SiteTeam (packs et limites, catalogue) : lus par tous les comptes, modifiés par le Super Admin seulement
    match /config/{doc} {
      allow read: if signed();
      allow write: if licOwner();
    }

    match /companies/{cid} {
      allow create: if signed() && request.resource.data.ownerUid == request.auth.uid
        && ((request.resource.data.get('planStatus', 'essai') in ['essai', 'gratuit']
            && (request.resource.data.get('plan', 'basic') == 'basic' || licOwner()
              || get(/databases/$(db)/documents/config/plans).data.get(request.resource.data.get('plan', 'basic'), {}).get('open', false) == true))
          || (request.resource.data.get('packCode', null) != null && codePlanOk(request.resource.data)));
      allow read: if isMem(cid) || licOwner();
      // la formule (pack) ne change que par le Super Admin SiteTeam (plus tard : la facturation)
      allow update: if (isAdmin(cid) && request.resource.data.get('plan', null) == resource.data.get('plan', null)
          && request.resource.data.get('planStatus', null) == resource.data.get('planStatus', null)
          && request.resource.data.get('trialEndsAt', null) == resource.data.get('trialEndsAt', null)) || licOwner()
        || (isAdmin(cid) && request.resource.data.get('packCode', null) != resource.data.get('packCode', null) && codePlanOk(request.resource.data));

      match /members/{uid} {
        allow read: if isMem(cid) || licOwner();
        allow create: if signed() && (isAdmin(cid) || (uid == request.auth.uid && (
          (get(/databases/$(db)/documents/companies/$(cid)).data.ownerUid == request.auth.uid)
          || (request.resource.data.invite is string
              && inv(request.resource.data.invite).get('kind', '') != 'partner'
              && inv(request.resource.data.invite).cid == cid
              && invLive(request.resource.data.invite)
              && inv(request.resource.data.invite).get('needsApproval', false) == false
              && request.resource.data.role == inv(request.resource.data.invite).role
              && request.resource.data.perms == inv(request.resource.data.invite).perms
              && request.resource.data.admin == inv(request.resource.data.invite).admin
              && request.resource.data.allProjects == inv(request.resource.data.invite).allProjects
              && request.resource.data.projects == inv(request.resource.data.invite).projects))));
        // délégation en cascade : le responsable direct ajuste les droits, projets, zone et missions de son équipe, sans dépasser les siens
        allow update: if isAdmin(cid) || (isMem(cid) && uid != request.auth.uid && resource.data.get('managerUid', '') == request.auth.uid
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['perms', 'missions', 'projects', 'allProjects', 'zone'])
          && permsWithin(cid, request.resource.data.perms) && projWithin(cid, request.resource.data));
        allow delete: if isAdmin(cid) || (signed() && uid == request.auth.uid);
      }
      // demandes d'accès (codes « avec approbation ») : la personne dépose sa demande, un administrateur accepte ou refuse
      match /requests/{uid} {
        allow create: if signed() && uid == request.auth.uid && request.resource.data.status == 'attente'
          && request.resource.data.code is string && inv(request.resource.data.code).cid == cid
          && invLive(request.resource.data.code) && inv(request.resource.data.code).get('needsApproval', false) == true;
        allow read: if signed() && (uid == request.auth.uid || isAdmin(cid));
        allow update, delete: if isAdmin(cid);
      }
      // postes de l'organisation : administrateur ou niveau « Administrer » sur l'équipe (ex. Directeur qualité)
      // annonces du Super Admin à une organisation
      match /annonces/{id} {
        allow read: if isMem(cid) || licOwner();
        allow write: if licOwner();
      }
      match /postes/{pk} {
        allow read: if isMem(cid);
        allow write: if isAdmin(cid) || (isMem(cid) && lvl(cid, 'equipe') >= 4);
      }
      match /private/{doc} {
        allow read: if isMem(cid);
        allow write: if isAdmin(cid);
      }
      // projets d'autres organisations auxquels cette organisation participe (liste locale, gérée par son administrateur)
      match /shared/{pid} {
        allow read: if isMem(cid);
        allow write: if isAdmin(cid);
      }
      match /projects/{pid} {
        allow read: if projAcc(cid, pid);
        allow create: if isMem(cid) && lvl(cid, 'projet') >= 3;
        // le groupement (jv : nom, mandataire) ne change que par l'administrateur de l'organisation titulaire du projet
        allow update: if isMem(cid) && canProj(cid, pid) && lvl(cid, 'projet') >= 2
          && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['jv']) || isAdmin(cid));
        allow delete: if isAdmin(cid);
        match /m/{mod}/r/{rid} {
          allow read: if (isMem(cid) && canProj(cid, pid) && lvl(cid, mod) >= 1) || pOk(cid, pid, mod, 1);
          allow create, update: if ((isMem(cid) && canProj(cid, pid) && lvl(cid, mod) >= 2) || pOk(cid, pid, mod, 2)) && (mod != 'forms' || vOk(cid));
          allow delete: if (isMem(cid) && canProj(cid, pid) && lvl(cid, mod) >= 2) || pOk(cid, pid, mod, 2);
        }
        // organisations partenaires du projet : entrée par code « partenaire » (administrateur du partenaire), gérées par le titulaire ou le mandataire
        match /partners/{o} {
          allow read: if projAcc(cid, pid) || isMem(o);
          allow create: if isAdmin(o) && o != cid && request.resource.data.code is string
            && inv(request.resource.data.code).get('kind', '') == 'partner' && inv(request.resource.data.code).cid == cid
            && inv(request.resource.data.code).pid == pid && invLive(request.resource.data.code)
            && request.resource.data.mods == inv(request.resource.data.code).mods && request.resource.data.role == inv(request.resource.data.code).prole
            && request.resource.data.status == 'actif';
          allow update: if (isAdmin(cid) || mandAdmin(cid, pid)) && maxLvl2(request.resource.data.mods) && request.resource.data.mods.get('projet', 0) == 1;
          allow delete: if isAdmin(cid) || mandAdmin(cid, pid) || isAdmin(o);
        }
        // historique du projet : on ajoute (qui, quoi, quand — heure du serveur), personne ne modifie ni n'efface
        match /audit/{aid} {
          allow read: if projAcc(cid, pid);
          allow create: if projAcc(cid, pid) && request.resource.data.by == request.auth.uid && request.resource.data.srv == request.time;
        }
      }
    }
  }
}`;

// Règles Cloud Storage (fichiers partagés : plans, photos, PDF). Elles lisent Firestore (membres, partenaires) : mêmes droits que les données.
// À publier dans la console Firebase › Storage › Règles (la console demande d'autoriser l'accès à Firestore : accepter).
const STORAGE_RULES = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function signed() { return request.auth != null; }
    function memPath(cid) { return /databases/(default)/documents/companies/$(cid)/members/$(request.auth.uid); }
    function mem(cid) { return firestore.get(memPath(cid)).data; }
    function lv(p, n) { return p.get('files', 0) >= n || p.get('plans', 0) >= n || p.get('photos', 0) >= n; }
    // compte bloqué / organisation suspendue par le Super Admin : plus d'accès aux fichiers
    function okUser() { let u = /databases/(default)/documents/users/$(request.auth.uid); return !firestore.exists(u) || firestore.get(u).data.get('blocked', false) != true; }
    function live(cid) { let c = /databases/(default)/documents/companies/$(cid); return !firestore.exists(c) || firestore.get(c).data.get('planStatus', '') != 'suspendu'; }
    function ownOk(cid, pid, n) {
      return signed() && firestore.exists(memPath(cid)) && okUser() && live(cid) && (mem(cid).allProjects == true || pid in mem(cid).projects) && lv(mem(cid).perms, n);
    }
    function partOk(cid, pid, n) {
      let o = firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.get('companyId', '');
      let pp = /databases/(default)/documents/companies/$(cid)/projects/$(pid)/partners/$(o);
      return signed() && o != '' && o != cid && okUser() && live(cid) && firestore.exists(memPath(o)) && firestore.exists(pp)
        && firestore.get(pp).data.get('status', '') == 'actif' && lv(firestore.get(pp).data.mods, n) && lv(mem(o).perms, n)
        && (mem(o).allProjects == true || pid in mem(o).projects);
    }
    // fichiers d'un projet : lecture = « Voir », envoi / suppression = « Modifier » ; 50 Mo au plus par fichier
    match /companies/{cid}/projects/{pid}/files/{fid} {
      allow read: if ownOk(cid, pid, 1) || partOk(cid, pid, 1);
      allow create, update: if (ownOk(cid, pid, 2) || partOk(cid, pid, 2)) && request.resource.size < 50 * 1024 * 1024;
      allow delete: if ownOk(cid, pid, 2) || partOk(cid, pid, 2);
    }
  }
}`;

const Team = (() => {
  const LS = {
    get(k, d = null) { try { const v = localStorage.getItem('team.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('team.' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('team.' + k); } catch (e) {} },
  };
  let fb = null, auth = null, fs = null, st = null;
  const S = { user: null, cid: LS.get('cid'), company: LS.get('company'), me: LS.get('me'), members: LS.get('members', []), ready: false };

  function init() {
    if (fb) return true;
    if (!window.firebase) return false;
    fb = firebase.apps.length ? firebase.app() : firebase.initializeApp(FB_CONFIG);
    auth = firebase.auth(); fs = firebase.firestore();
    const emu = /[?&]emu=1/.test(location.search);
    try { fs.settings(emu ? { experimentalForceLongPolling: true, merge: true } : { experimentalAutoDetectLongPolling: true, merge: true }); } catch (e) {}
    if (emu) { auth.useEmulator('http://127.0.0.1:9099'); fs.useEmulator('127.0.0.1', 8080); }
    try { if (firebase.storage) { st = firebase.storage(); if (emu) st.useEmulator('127.0.0.1', 9199); } } catch (e) { console.warn('storage', e); st = null; }
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
  const lvl0 = (mod) => { if (!S.ready) return 4; if (!S.me) return 0; return (S.me.perms || {})[mod] ?? 0; };
  // projet d'une organisation partenaire : droits = le plus petit entre ce que le titulaire accorde et le poste de la personne
  const sharedOf = (pid) => pid ? (S.shared || []).find(x => x.pid === pid) || null : null;
  const lvlFor = (mod, pid) => { const sh = sharedOf(pid); return sh ? (sh.status && sh.status !== 'actif' ? 0 : Math.min(+((sh.mods || {})[mod]) || 0, lvl0(mod))) : lvl0(mod); };
  const curPid = () => { try { return (typeof App !== 'undefined' && App.project && App.project.id) || null; } catch (e) { return null; } };
  const lvl = (mod) => lvlFor(mod, curPid());
  // réglages généraux décidés dans le panneau d'administration (config/app) : version minimale, maintenance, message, fonctions coupées
  const appCfg = () => LS.get('appCfg') || {};
  // anti-capture d'écran (Android FLAG_SECURE) : option de l'organisation, ou imposée à tous par le Super Admin (config/app.secureAll)
  const secureOn = () => !!(appCfg().secureAll || (S.ready && (S.company || {}).secureScreen && !isPerso()));
  let _sec = null;
  function secureApply() { const on = secureOn(); if (on === _sec) return; _sec = on; const P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SecureScreen; if (P && P.set) P.set({ on }).catch(() => {}); document.documentElement.classList.toggle('st-secure', on); }
  const isOff = (mod) => !!mod && Array.isArray(appCfg().off) && appCfg().off.includes(mod) && !isSuper();
  const canSection = (k) => !isOff(SECTION_MOD[k] || 'projet') && lvl(SECTION_MOD[k] || 'projet') >= 1;
  const isAdmin = () => !S.ready || !!(S.me && S.me.admin);
  const myPlan = () => planFor(planOf((S.company || {}).plan || PLAN_DEFAULT_COMPANY), (S.company || {}).kind === 'perso');
  // Super Admin SiteTeam (le même compte que le propriétaire des licences Chantier dans les règles)
  const SUPER_EMAIL = 'abdessamad.daga94@gmail.com';
  const isSuper = () => !!(S.user && (S.user.email || '').toLowerCase() === SUPER_EMAIL);
  const orgType = () => orgTypeOf((S.company || {}).orgType || ((S.company || {}).kind === 'perso' ? 'independant' : 'entreprise'));
  // espace personnel vu par son propriétaire ; un collaborateur invité sur un projet voit seulement ce projet
  const isPerso = () => (S.company || {}).kind === 'perso' && (S.me || {}).role !== 'collaborateur';
  // taille d'entreprise (décision du 27/10) : elle suit le pack — Basic = petite · Business = moyenne · Enterprise = grande
  const taille = () => { if ((S.company || {}).kind === 'perso') return 'perso'; const k = myPlan().k; return k === 'enterprise' ? 'grande' : k === 'business' ? 'moyenne' : 'petite'; };
  const isCollab = () => (S.me || {}).role === 'collaborateur';
  // services de l'organisation : ceux choisis à la création (+ externes + ceux déjà utilisés par un membre) ; anciennes entreprises : tous
  const companyServices = () => { const c = S.company || {}; if (!Array.isArray(c.services)) return TM_SERVICES.filter(x => !SERVICES_LEGACY.includes(x.k) || (S.members || []).some(m => m.service === x.k));
    const keep = new Set([...c.services, 'externe', ...(S.members || []).map(m => m.service)]); return TM_SERVICES.filter(x => keep.has(x.k)); };
  // créer un code d'accès : administrateur, ou poste avec « Équipe » au niveau Valider
  const canInvite = () => S.ready && !!S.me && !isPerso() && (S.me.admin || lvl('equipe') >= 3);
  // packs modifiables par le Super Admin : config/plans (Firestore) remplace les valeurs par défaut du code
  function applyPlanCfg(cfg) { if (!cfg) return; for (const [k, v] of Object.entries(cfg)) { if (!v || typeof v !== 'object') continue; PLANS[k] = { ...(PLANS[k] || {}), ...v, k }; } }
  async function loadPlanCfg() {
    applyPlanCfg(LS.get('plansCfg'));
    const so = LS.get('svcOpen'); if (Array.isArray(so)) SERVICES_OPEN = so;
    try { const [d, sv, ap] = await withTimeout(Promise.all([fs.collection('config').doc('plans').get(), fs.collection('config').doc('services').get(), fs.collection('config').doc('app').get().catch(() => null)]), 10000);
      if (d.exists) { LS.set('plansCfg', d.data()); applyPlanCfg(d.data()); }
      if (ap) LS.set('appCfg', ap.exists ? ap.data() : {});
      if (sv.exists && Array.isArray(sv.data().open)) { SERVICES_OPEN = sv.data().open; LS.set('svcOpen', SERVICES_OPEN); }
      if (sv.exists) LS.set('cloud', { on: sv.data().storage === true, maxMb: +sv.data().maxMb || 50 }); } catch (e) { console.warn('plans cfg', e); }
  }
  // postes de l'organisation (renommés, désactivés, créés)
  async function loadPostes() {
    const apply = (L) => { ROLE_CFG = {}; ROLE_CUSTOM = []; for (const x of L || []) { if (TM_ROLES.some(r => r.k === x.k)) ROLE_CFG[x.k] = x;
      else { const B = tmRoleOf(x.like) || {}; ROLE_CUSTOM.push({ k: x.k, l: x.l, s: x.s, rank: x.rank || 9, like: x.like, perms: x.perms || B.perms || {}, admin: false, disabled: !!x.disabled, custom: true }); } } };
    apply(LS.get('postes'));
    try { const q = await withTimeout(fs.collection('companies').doc(S.cid).collection('postes').get(), 10000); const L = q.docs.map(d => ({ k: d.id, ...d.data() })); LS.set('postes', L); apply(L); } catch (e) { console.warn('postes', e); }
  }
  // limites du pack (appliquées dans l'application ; la vérification serveur viendra avec la facturation)
  async function checkLimit(kind) {
    const P = myPlan();
    if (kind === 'users') {
      if (!P.users) return true;
      let pending = 0; try { const q = await fs.collection('invites').where('cid', '==', S.cid).get(); pending = q.docs.filter(d => !d.data().used).length; } catch (e) {}
      const n = S.members.length + pending; if (n < P.users) return true;
      if (P.extraUserPrice) return confirmBox(`Votre pack ${P.l} inclut ${P.users} comptes (${n} utilisés ou en attente).\nChaque compte supplémentaire : ${P.extraUserPrice} MAD/mois.`, 'Continuer');
      await limitBox(`Le pack ${P.l} est limité à ${P.users} compte(s) (${n} utilisés ou en attente).`); return false;
    }
    if (kind === 'projects') {
      if (!P.projects) return true;
      const n = (await DB.all('projects')).filter(p => !p.deleted).length; if (n < P.projects) return true;
      await limitBox(`Le pack ${P.l} est limité à ${P.projects} projet(s).`); return false;
    }
    return true;
  }
  async function limitBox(msg) {
    const up = Object.values(PLANS).filter(x => x.k !== myPlan().k && (x.price == null || x.price > (myPlan().price || 0))).map(x => x.l).join(', ');
    const v = await menu(`🔒 ${msg}\nPour aller plus loin : ${up || '—'}.`, [...(isAdmin() ? [{ label: 'Voir les packs', icon: 'settings', value: 'plans' }] : []), { label: 'Fermer', icon: 'check', value: 'ok' }]);
    if (v === 'plans') openCompany('set');
  }
  const canProject = (pid) => !S.ready || !!(S.me && (S.me.allProjects || (S.me.projects || []).includes(pid)));
  // ---------- code pack : entré par la personne, il ouvre le pack choisi par le Super Admin (création d'espace ou changement de pack) ----------
  async function readPackCode(raw) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9-]/g, ''); if (!code) return null;
    const d = await withTimeout(fs.collection('packCodes').doc(code).get());
    if (!d.exists) throw new Error('Code introuvable — vérifiez les lettres et les chiffres');
    const C = { code, ...d.data() };
    if (C.status !== 'valide') throw new Error('Ce code a été annulé');
    if (C.expiresAt && C.expiresAt.toMillis && C.expiresAt.toMillis() < Date.now()) throw new Error('Ce code a expiré');
    if ((C.usedBy || []).includes(S.user.uid)) throw new Error('Vous avez déjà utilisé ce code');
    if ((C.uses || 0) >= (C.maxUses || 1)) throw new Error('Ce code a déjà été utilisé le nombre de fois prévu');
    return C;
  }
  const codeSub = (C) => C.days > 0 ? { planStatus: 'essai', trialEndsAt: firebase.firestore.Timestamp.fromMillis(Date.now() + C.days * 864e5) } : { planStatus: 'actif' };
  const codeLabel = (C) => `${planOf(C.plan).e || ''} ${planOf(C.plan).l}${C.days > 0 ? ` pendant ${C.days} jours` : ' (sans limite de durée)'}`;
  const useCode = (C) => fs.collection('packCodes').doc(C.code).update({ uses: (C.uses || 0) + 1, usedBy: [...(C.usedBy || []), S.user.uid], lastUsedAt: ts() });
  async function askPackCode() {
    const r = await formSheet('Code pack', [{ name: 'code', label: 'Code reçu de SiteTeam', placeholder: 'Ex : PRO-7K2M9Q' }], { okLabel: 'Vérifier' });
    if (!r || !r.code) return null;
    const ld = loading('Vérification du code…');
    try { const C = await readPackCode(r.code); ld.close(); return C; } catch (e) { ld.close(); alertBox(e.message || errMsg(e)); return null; }
  }
  // espace déjà créé : l'administrateur passe au pack du code
  async function applyPackCode() {
    if (!S.cid || !isAdmin()) return alertBox('Seul un administrateur de l\'espace peut entrer un code pack.');
    const C = await askPackCode(); if (!C) return false;
    if (!(await confirmBox(`Activer ${codeLabel(C)} sur « ${S.company.name} » ?`, 'Activer'))) return false;
    const ld = loading('Activation…');
    try {
      const sub = codeSub(C);
      await withTimeout(fs.collection('companies').doc(S.cid).update({ plan: C.plan, ...sub, packCode: C.code }));
      await withTimeout(useCode(C)).catch(e => console.warn('code', e));
      S.company = { ...S.company, plan: C.plan, ...sub, packCode: C.code }; LS.set('company', S.company); ld.close();
      await alertBox(`Pack ${planOf(C.plan).l} activé ✓`); location.reload(); return true;
    } catch (e) { ld.close(); alertBox(errMsg(e)); return false; }
  }
  // ---------- demande de pack (la facturation n'est pas en ligne : la demande arrive dans le panneau d'administration) ----------
  async function requestPack(k, perso) {
    // Super Admin : pas de demande, le pack s'applique tout de suite à l'espace ouvert (les règles l'autorisent pour lui seul)
    if (isSuper() && S.cid && S.company) {
      const P0 = planFor(planOf(k), (S.company || {}).kind === 'perso');
      if (!(await confirmBox(`Passer « ${S.company.name} » au pack ${P0.l} (actif) ?`, 'Activer'))) return false;
      try { await withTimeout(fs.collection('companies').doc(S.cid).update({ plan: k, planStatus: 'actif' })); S.company = { ...S.company, plan: k, planStatus: 'actif' }; LS.set('company', S.company);
        toast(`Pack ${P0.l} activé ✓`); setTimeout(() => location.reload(), 600); return true; } catch (e) { alertBox(errMsg(e)); return false; }
    }
    const P = planFor(planOf(k), perso), r = await formSheet(`Demander ${P.l}`, [{ name: 'msg', label: 'Message (optionnel)', type: 'textarea', placeholder: 'Ex : nombre d\'utilisateurs, besoin particulier…' }, { name: 'tel', label: 'Téléphone (optionnel)', type: 'tel' }], { okLabel: 'Envoyer la demande' });
    if (!r) return false;
    try {
      await withTimeout(fs.collection('packRequests').add({ uid: S.user.uid, email: S.user.email || '', name: (S.me || {}).name || S.user.displayName || '', cid: S.cid || '', cname: (S.company || {}).name || '',
        plan: k, perso: !!perso, msg: (r.msg || '').slice(0, 1000), tel: (r.tel || '').slice(0, 40), status: 'attente', at: ts() }));
      await alertBox(`Demande envoyée ✓\nSiteTeam vous répond et active le pack « ${P.l} ».`); return true;
    } catch (e) { alertBox(errMsg(e)); return false; }
  }
  // ---------- fichiers partagés (Cloud Storage) : activés par le Super Admin (config/services.storage), jamais sans son accord ----------
  const cloudCfg = () => LS.get('cloud') || { on: false, maxMb: 50 };
  const cloudOn = () => !!(S.ready && st && S.cid && cloudCfg().on && (myPlan().storageGb || 0) > 0);
  const canCloud = (f, n = 1) => !!(f && f.projectId && canProject(f.projectId) && lvlFor('files', f.projectId) >= n);
  const cloudPath = (f) => `companies/${(sharedOf(f.projectId) || {}).cid || S.cid}/projects/${f.projectId}/files/${f.id}`;
  async function cloudUpload(f) {
    if (!f.blob) throw new Error('fichier absent du téléphone');
    if (f.blob.size > cloudCfg().maxMb * 1048576) throw new Error(`fichier trop lourd (plus de ${cloudCfg().maxMb} Mo)`);
    const path = cloudPath(f);
    await withTimeout(st.ref(path).put(f.blob, { contentType: f.mime || f.blob.type || 'application/octet-stream', customMetadata: { by: S.user.uid, name: String(f.name || '').slice(0, 200) } }), 180000, 'Envoi trop long (connexion lente ?)');
    return { sref: path, ssize: f.blob.size };
  }
  async function cloudDownload(f) {
    const url = await withTimeout(st.ref(f.sref).getDownloadURL(), 20000), type = f.mime || 'application/octet-stream';
    const H = window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() && Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp;
    if (H) {   // téléphone : requête native (pas de restriction CORS)
      const r = await withTimeout(H.request({ url, method: 'GET', responseType: 'blob' }), 180000);
      if (r.status && r.status >= 400) throw new Error('téléchargement refusé (' + r.status + ')');
      const bin = atob(String(r.data || '')), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return new Blob([u], { type });
    }
    const r = await withTimeout(fetch(url), 180000); if (!r.ok) throw new Error('téléchargement refusé (' + r.status + ')');
    const b = await r.blob(); return b.type ? b : new Blob([b], { type });
  }
  async function cloudRemove(sref) { if (st && sref) { try { await st.ref(sref).delete(); } catch (e) { if (e.code !== 'storage/object-not-found') console.warn('cloud del', e); } } }
  // projets partagés par d'autres organisations (companies/{moi}/shared)
  async function loadShared() {
    S.shared = LS.get('shared') || [];
    try {
      const q = await withTimeout(fs.collection('companies').doc(S.cid).collection('shared').get(), 10000); const L = q.docs.map(d => ({ pid: d.id, ...d.data() }));
      // accès à jour (le titulaire peut changer les modules, suspendre ou retirer l'organisation)
      await Promise.all(L.map(async (x) => { try { const d = await fs.collection('companies').doc(x.cid).collection('projects').doc(x.pid).collection('partners').doc(S.cid).get();
        if (d.exists) { x.mods = d.data().mods || {}; x.status = d.data().status || 'actif'; x.role = d.data().role || x.role; } else { x.mods = {}; x.status = 'retire'; } } catch (e) {} }));
      S.shared = L; LS.set('shared', S.shared);
    } catch (e) { console.warn('shared', e); }
    return S.shared;
  }

  // ---------- démarrage : connexion obligatoire ----------
  async function boot() {
    if (!init()) { toast('Module de connexion absent — mode local'); return; }
    const user = await new Promise((res) => { const un = auth.onAuthStateChanged(u => { un(); res(u); }); });
    if (!user) { await loginScreen(); }
    S.user = auth.currentUser; ST_SUPER = isSuper();
    await loadMembership();
    await gate();
    setTimeout(() => askPoste().catch(e => console.warn('poste', e)), 1500);
    setTimeout(() => checkAnnonces().catch(e => console.warn('annonces', e)), 3000);
    setInterval(() => { if (document.visibilityState === 'visible') checkAnnonces().catch(() => {}); }, 10 * 60000);
    auth.onAuthStateChanged(u => { if (!u && S.ready) { S.ready = false; location.reload(); } });
  }
  // ---------- espace personnel : Basic = Free (sans poste) ; Pro et plus = service + poste choisis une fois ----------
  const isFree = () => isPerso() && myPlan().k === 'basic';
  async function askPoste(force) {
    if (!S.ready || !isPerso() || isFree() || (!force && metierOf((S.profil || {}).metier))) return false;
    // poste verrouillé (v1.0.30) : une fois choisi, l'utilisateur ne le change plus lui-même (seul le Super Admin peut le refaire)
    if (metierOf((S.profil || {}).metier) && !isSuper()) { toast('Votre poste est fixé. Pour le changer, contactez SiteTeam.'); return false; }
    const opts = TM_SERVICES.filter(x => x.k !== 'direction' && x.k !== 'externe' && x.k !== 'perso' && !SERVICES_LEGACY.includes(x.k))
      .flatMap(sv => TM_ROLES.filter(r => r.s === sv.k && !ROLE_LEGACY[r.k]).map(r => ({ value: r.k, label: `${sv.l} › ${r.l}` })));
    const r = await formSheet('Votre service et votre poste', [{ name: 'info', type: 'info', label: `Pack ${myPlan().l}`, value: 'L\'application s\'adapte à votre poste : tableau de bord, outils et recommandations.' },
      { name: 'm', label: 'Service › poste', type: 'select', options: opts, value: (S.profil || {}).metier || 'conducteur' }], { okLabel: 'Enregistrer' });
    if (!r || !r.m) return false;
    S.profil = { ...(S.profil || {}), metier: r.m }; LS.set('profile', { ...(LS.get('profile') || {}), profil: S.profil });
    try { await withTimeout(fs.collection('users').doc(S.user.uid).set({ profil: S.profil }, { merge: true })); } catch (e) { console.warn('profil', e); }
    toast('Poste enregistré ✓'); try { ST.refreshRole(); } catch (e) {} return true;
  }
  // ---------- décisions du panneau d'administration appliquées dans l'application ----------
  // écran bloquant (compte bloqué, organisation suspendue, maintenance, version trop ancienne) : l'application s'arrête là
  function gateScreen(title, text, opts = {}) {
    document.querySelectorAll('.st-gate').forEach(x => x.remove());
    const el = document.createElement('div'); el.className = 'fullpage st-gate';
    el.innerHTML = `<div class="st-gate-in"><div class="st-gate-logo">${typeof stLogo === 'function' ? stLogo() : ''}</div><h1>${esc(title)}</h1><p>${esc(text).replace(/\n/g, '<br>')}</p>
      <div class="st-gate-b">${opts && opts.update ? `<button class="btn" data-g="upd">${icon('upload')} Mettre à jour</button>` : ''}${opts && opts.switcher && (S.workspaces || []).length > 1 ? '<button class="btn ghost" data-g="ws">Changer d\'espace</button>' : ''}
      ${opts && opts.retry ? '<button class="btn ghost" data-g="retry">Réessayer</button>' : ''}<button class="btn ghost" data-g="out">Se déconnecter</button></div></div>`;
    document.body.appendChild(el);
    const on = (k, f) => { const b = $(`[data-g=${k}]`, el); if (b) b.onclick = f; };
    on('upd', () => { try { typeof PLAY_STORE_BUILD !== 'undefined' && PLAY_STORE_BUILD ? openUrl('https://play.google.com/store/apps/details?id=com.siteteam.app') : checkUpdate(true); } catch (e) {} });
    on('ws', () => openSwitcher()); on('retry', () => location.reload()); on('out', () => logout());
    return new Promise(() => {});
  }
  async function gate() {
    if (isSuper()) return;
    const C = appCfg(), V = typeof APP_VERSION === 'string' ? APP_VERSION : '';
    if (C.maintenance && C.maintenance.on) return gateScreen('🛠 Maintenance', C.maintenance.text || 'SiteTeam est en maintenance. Revenez dans quelques minutes.', { retry: true });
    if (C.minVersion && /^\d+\.\d+\.\d+$/.test(V) && typeof verCmp === 'function' && verCmp(V, C.minVersion) < 0)
      return gateScreen('⬆️ Mise à jour obligatoire', `Cette version (${V}) n'est plus prise en charge. Installez la version ${C.minVersion} ou plus récente pour continuer. Vos données restent sur le téléphone.`, { update: true });
    if (S.company && S.company.planStatus === 'suspendu')
      return gateScreen('⏸ Organisation suspendue', `L'accès à « ${S.company.name || 'cette organisation'} » est suspendu par SiteTeam.\nVos données ne sont pas effacées. Contact : ${SUPPORT_EMAIL}`, { switcher: true });
  }
  // présence : e-mail, dernière ouverture, version (pour le panneau d'administration), au plus une fois par heure
  function presence(prof) {
    try { if (Date.now() - (+localStorage.getItem('st.seenAt') || 0) < 3600e3 && prof.appVersion === APP_VERSION) return; localStorage.setItem('st.seenAt', String(Date.now())); } catch (e) {}
    fs.collection('users').doc(S.user.uid).set({ email: S.user.email || '', name: prof.name || S.user.displayName || '', lastSeen: ts(), appVersion: typeof APP_VERSION === 'string' ? APP_VERSION : '',
      platform: (window.Capacitor && Capacitor.getPlatform && Capacitor.getPlatform()) || 'web' }, { merge: true }).catch(e => console.warn('presence', e));
  }
  // annonces envoyées depuis le panneau : à tous, à une personne, ou à une organisation ; notification sur le téléphone
  async function checkAnnonces() {
    if (!S.ready || !S.user) return [];
    const seen = +(LS.get('annSeen') || 0), out = [];
    const q1 = await withTimeout(fs.collection('annonces').where('target', 'in', ['all', S.user.uid]).limit(50).get(), 15000).catch(e => { console.warn('annonces', e); return null; });
    if (q1) q1.forEach(d => out.push({ id: d.id, ...d.data() }));
    if (S.cid) { const q2 = await withTimeout(fs.collection('companies').doc(S.cid).collection('annonces').orderBy('at', 'desc').limit(10).get(), 15000).catch(() => null); if (q2) q2.forEach(d => out.push({ id: d.id, ...d.data() })); }
    const ms = (x) => (x.at && x.at.toMillis ? x.at.toMillis() : 0), fresh = out.filter(x => ms(x) > seen).sort((a, b) => ms(b) - ms(a));
    if (!fresh.length) return [];
    LS.set('annSeen', Math.max(...fresh.map(ms)));
    try { const N = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications; if (N && N.schedule) await N.schedule({ notifications: [{ id: Math.floor(Math.random() * 1e6), title: fresh[0].title || 'SiteTeam', body: String(fresh[0].text || '').slice(0, 200) }] }); } catch (e) {}
    if (!document.querySelector('.st-gate')) sheet(`<div class="st-ann">${fresh.map(x => `<div class="tm-box"><b>📣 ${esc(x.title || 'SiteTeam')}</b><p>${esc(x.text || '').replace(/\n/g, '<br>')}</p><small class="muted">${new Date(ms(x)).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div>`).join('')}</div>`, { title: 'Annonces SiteTeam' });
    return fresh;
  }
  // erreurs de l'application envoyées au panneau (sans données personnelles : message, fichier, version) — 10 au plus par ouverture
  const errSent = new Set();
  function logError(msg, src, stack) {
    try {
      msg = String(msg || '').slice(0, 300); if (!msg || /ResizeObserver|Script error|Load failed|NetworkError|Failed to fetch/i.test(msg)) return;
      if (!fs || !S.user || errSent.size >= 10 || errSent.has(msg)) return; errSent.add(msg);
      fs.collection('errors').add({ uid: S.user.uid, cid: S.cid || '', msg, src: String(src || '').slice(0, 200), stack: String(stack || '').split('\n').slice(0, 4).join('\n').slice(0, 600),
        ver: typeof APP_VERSION === 'string' ? APP_VERSION : '', platform: (window.Capacitor && Capacitor.getPlatform && Capacitor.getPlatform()) || 'web', at: ts() }).catch(() => {});
    } catch (e) {}
  }
  window.addEventListener('error', (e) => logError(e.message, (e.filename || '') + ':' + (e.lineno || ''), e.error && e.error.stack));
  window.addEventListener('unhandledrejection', (e) => { const r = e.reason || {}; logError(r.message || String(r), 'promise', r.stack); });
  // ---------- validation des PV ----------
  function canValidateForm(f) {
    if (!S.ready || !S.me || !f || f.aut === S.user.uid || sharedOf(f.projectId)) return false;
    if (S.me.admin || lvl('forms') >= 4) return true;
    const a = (S.members || []).find(m => m.uid === f.aut);
    return lvl('forms') >= 3 && !!a && a.managerUid === S.user.uid;
  }
  // ---------- Workspace Switcher : un compte, plusieurs espaces (espace personnel, organisations) ----------
  // Sur le téléphone, chaque espace a sa propre base IndexedDB et ses propres repères de synchronisation (Drive, envoi, réception),
  // rangés à part quand on change d'espace : rien n'est déplacé, rien n'est mélangé.
  const WS = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    put: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} },
    dbFor(cid) { const leg = WS.get('st.wsLegacy'); return !leg || leg === cid ? 'chantier' : 'chantier_' + cid; },
    keys() { try { return Object.keys(localStorage).filter(k => k.startsWith('sync.') || k === 'team.pullAt'); } catch (e) { return []; } },
    save(cid) { if (!cid) return; const o = {}; WS.keys().forEach(k => { o[k] = WS.get(k); }); WS.put('ws.' + cid, JSON.stringify(o)); WS.keys().forEach(k => WS.put(k, null)); },
    restore(cid) { let o = {}; try { o = JSON.parse(WS.get('ws.' + cid) || '{}'); } catch (e) {} for (const [k, v] of Object.entries(o)) WS.put(k, v); },
    // vrai = on recharge l'application pour ouvrir la base de cet espace
    bind(cid) {
      if (!WS.get('st.wsLegacy')) { WS.put('st.wsLegacy', cid); WS.put('st.wsCid', cid); }   // 1re ouverture : les données déjà présentes appartiennent à cet espace
      const cur = WS.get('st.wsCid');
      if (cur !== cid) { WS.save(cur); WS.restore(cid); WS.put('st.wsCid', cid); ['company', 'me', 'members', 'postes', 'shared'].forEach(LS.del); }
      const want = WS.dbFor(cid);
      if ((WS.get('st.db') || 'chantier') !== want || (typeof DB !== 'undefined' && DB.name && DB.name() !== want)) {
        WS.put('st.db', want === 'chantier' ? null : want);
        if (typeof DB !== 'undefined' && DB.name && DB.name() === want) return false;
        location.reload(); return true;
      }
      return false;
    },
  };
  // la liste des espaces du compte (users/{uid}.workspaces) est tenue à jour à chaque ouverture
  async function saveWorkspace() {
    const T = orgType(), w = { cid: S.cid, name: S.company.name || '', kind: S.company.kind || 'org', org: T.k, role: S.me.role || '', plan: myPlan().k };
    const L = (S.workspaces || []).filter(x => x.cid !== S.cid), cur = (S.workspaces || []).find(x => x.cid === S.cid);
    const next = [w, ...L];
    if (cur && JSON.stringify(cur) === JSON.stringify(w) && (S.workspaces || [])[0] && S.workspaces[0].cid === S.cid) return;
    try { await fs.collection('users').doc(S.user.uid).set({ workspaces: next }, { merge: true }); S.workspaces = next; } catch (e) { console.warn('ws', e); }
  }
  async function switchTo(cid) {
    if (cid === S.cid) return;
    const ld = loading('Changement d\'espace…');
    try { if (typeof Sync !== 'undefined' && Sync.enabled && Sync.enabled()) await Sync.run({ quiet: true }); } catch (e) { console.warn('sync avant changement', e); }
    try { await withTimeout(fs.collection('users').doc(S.user.uid).set({ companyId: cid }, { merge: true })); } catch (e) { ld.close(); return alertBox(errMsg(e)); }
    try { sessionStorage.removeItem('st.preview'); } catch (e) {}
    location.reload();
  }
  function openSwitcher() {
    if (!S.ready) return;
    const L = (S.workspaces || []).length ? S.workspaces : [{ cid: S.cid, name: S.company.name, kind: S.company.kind, org: orgType().k, role: S.me.role, plan: myPlan().k }];
    const row = (w) => { const T = orgTypeOf(w.org || (w.kind === 'perso' ? 'independant' : 'entreprise')), on = w.cid === S.cid;
      if (w.pending) return `<button class="st-ws pend" data-pend="${esc(w.cid)}"><span class="e">⏳</span><span class="grow"><b>${esc(w.name || '?')}</b><small>Demande en attente d'approbation · toucher pour vérifier</small></span></button>`;
      if (w.role === 'collaborateur') return `<button class="st-ws ${on ? 'on' : ''}" data-ws="${esc(w.cid)}"><span class="e">🤝</span><span class="grow"><b>${esc(w.name || '?')}${on ? ' ✓' : ''}</b><small>Projet partagé · Collaborateur</small></span></button>`;
      return `<button class="st-ws ${on ? 'on' : ''}" data-ws="${esc(w.cid)}"><span class="e">${T.e}</span><span class="grow"><b>${esc(w.name || '?')}${on ? ' ✓' : ''}</b><small>${w.kind === 'perso' ? 'Espace personnel' : esc(T.l)} · ${esc(tmRoleOf(w.role).l)} · ${esc(planOf(w.plan).l)}</small></span></button>`; };
    const sh = sheet(`<div class="st-wsl">${L.map(row).join('')}</div>
      <div class="st-wsa"><button class="linkbtn" data-a="join">＋ Rejoindre avec un code</button><button class="linkbtn" data-a="new">＋ Créer un espace personnel ou une organisation</button></div>
      <p class="muted" style="padding:0 16px 14px;font-size:12.5px">Chaque espace garde ses données à part sur ce téléphone. Pas besoin de se reconnecter.</p>`, { title: 'Changer d\'espace' });
    $$('[data-ws]', sh.el).forEach(b => b.onclick = () => { sh.close(); switchTo(b.dataset.ws); });
    $$('[data-pend]', sh.el).forEach(b => b.onclick = async () => { const cid = b.dataset.pend;
      try { const r = await withTimeout(fs.collection('companies').doc(cid).collection('requests').doc(S.user.uid).get()); const st = r.exists ? r.data().status : 'attente';
        if (st === 'acceptee') { sh.close(); return switchTo(cid); }
        if (st === 'refusee') { sh.close(); const L2 = (S.workspaces || []).filter(x => x.cid !== cid); await fs.collection('users').doc(S.user.uid).set({ workspaces: L2 }, { merge: true }); S.workspaces = L2; return alertBox('Votre demande a été refusée par l\'organisation.'); }
        toast('Toujours en attente d\'approbation'); } catch (e) { alertBox(errMsg(e)); } });
    $('[data-a=join]', sh.el).onclick = async () => { sh.close(); const cid = await joinWithCode(); if (cid) switchTo(cid); };
    $('[data-a=new]', sh.el).onclick = async () => { sh.close(); const ok = await onboardScreen({ add: true }); if (ok) { try { if (typeof Sync !== 'undefined' && Sync.enabled && Sync.enabled()) await Sync.run({ quiet: true }); } catch (e) {} location.reload(); } };
  }

  async function loadMembership() {
    // profil + entreprise (cache local si hors connexion)
    let prof = null;
    try { const d = await withTimeout(fs.collection('users').doc(S.user.uid).get(), 15000); prof = d.exists ? d.data() : {}; LS.set('profile', prof); }
    catch (e) { prof = LS.get('profile'); if (!prof) { await alertBox('Connexion internet nécessaire pour la première ouverture.'); return loadMembership(); } }
    if (prof.blocked === true && !isSuper()) return gateScreen('⛔ Compte bloqué', `Ce compte a été bloqué par SiteTeam.${prof.blockedWhy ? '\nMotif : ' + prof.blockedWhy : ''}\nPour toute question : ${SUPPORT_EMAIL}`, false);
    presence(prof);
    if (!prof.companyId) { await loadPlanCfg(); await onboardScreen(); return loadMembership(); }
    S.workspaces = Array.isArray(prof.workspaces) ? prof.workspaces : [];
    S.profil = prof.profil || {};
    // espace de travail : chaque organisation a sa base locale ; si l'espace a changé (ici ou sur un autre téléphone), on bascule puis on recharge
    if (WS.bind(prof.companyId)) return new Promise(() => {});
    S.cid = prof.companyId; LS.set('cid', S.cid);
    try {
      const [c, m] = await withTimeout(Promise.all([fs.collection('companies').doc(S.cid).get(), fs.collection('companies').doc(S.cid).collection('members').doc(S.user.uid).get()]), 15000);
      if (!m.exists) {
        const rest = S.workspaces.filter(w => w.cid !== S.cid);
        await fs.collection('users').doc(S.user.uid).set({ companyId: rest.length ? rest[0].cid : null, workspaces: rest }, { merge: true });
        await alertBox('Vous ne faites plus partie de « ' + ((c.exists && c.data().name) || 'cette organisation') + ' ».' + (rest.length ? '\nOuverture de « ' + rest[0].name + ' ».' : ''));
        return loadMembership();
      }
      S.company = { id: c.id, ...c.data() }; S.me = { uid: S.user.uid, ...m.data() };
      LS.set('company', S.company); LS.set('me', S.me);
    } catch (e) { if (!S.me || S.me.uid !== S.user.uid) { await alertBox('Connexion impossible : ' + errMsg(e)); return loadMembership(); } }
    S.ready = true;
    await loadPlanCfg();
    await loadPostes();
    await loadShared();
    try { if (!localStorage.getItem('userName') && S.me.name) localStorage.setItem('userName', S.me.name.split(' ')[0]); localStorage.setItem('askedName', '1'); } catch (e) {}
    await refreshMembers();
    saveWorkspace();
    // espaces personnels créés avant v1.0.16 : le métier était rangé comme « poste » ; on le recopie dans le profil (rien n'est effacé)
    if (isPerso() && !S.profil.metier && metierOf(S.me.role)) { S.profil = { ...S.profil, metier: S.me.role }; fs.collection('users').doc(S.user.uid).set({ profil: S.profil }, { merge: true }).catch(e => console.warn('profil', e)); }
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
      const R = tmRoleOf(m.role), np = { ...P }; miss.forEach(k => { np[k] = m.admin ? 4 : (R.perms[k] || 0); });
      try { await fs.collection('companies').doc(S.cid).collection('members').doc(m.uid).update({ perms: np }); m.perms = np; if (m.uid === S.user.uid) { S.me.perms = np; LS.set('me', S.me); } } catch (e) { console.warn('migrate', e); }
    }
    LS.set('members', S.members);
  }
  // entreprises créées avant l'ajout des formules : leur donner une formule par défaut (une seule fois, par l'administrateur)
  // anciennes entreprises sans formule, ou « entreprise » / « personnel » : lues comme Enterprise / Pro (planOf), sans écriture
  // (depuis v1.0.14 seul le Super Admin change la formule)
  function migrateCompanyPlan() {}
  // Drive de l'entreprise : l'administrateur connecte son script, les membres le reçoivent automatiquement
  async function syncDriveCfg() {
    try {
      const ref = fs.collection('companies').doc(S.cid).collection('private').doc('drive');
      const d = await ref.get(), remote = d.exists ? d.data() : null, local = Sync.cfg();
      const same = remote && local && local.url === remote.url && local.key === remote.key;
      // l'administrateur : son Drive (vérifié SiteTeam) fait foi ; les membres : celui de l'entreprise
      if (isAdmin() && local && local.url && !same) { if (await isSiteTeamScript(local)) await ref.set({ url: local.url, key: local.key, folder: local.folder || '', by: S.user.uid, at: ts() }); }
      else if (remote && remote.url && !same && !(local && local.mode === 'g') && await isSiteTeamScript(remote)) { localStorage.setItem('sync.cfg', JSON.stringify({ url: remote.url, key: remote.key, folder: remote.folder || '' })); Sync.start(); }
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
        el.innerHTML = `<div class="tm-lg-in"><div class="tm-logo st-lg">${stLogo()}</div><h1>SiteTeam</h1><p>Toute l'équipe du chantier, au même endroit.</p>
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

  // ---------- rejoindre une organisation avec un code d'accès (parcours court : ni pack, ni création) ----------
  // l'écran de confirmation montre exactement où la personne entre ; retourne l'id de l'organisation, ou null
  function confirmJoin(I) {
    return new Promise((resolve) => {
      const T = orgTypeOf(I.orgType || 'entreprise'), P = I.perms || {}, lv = MODS.filter(([m]) => (P[m] || 0) > 0);
      const days = I.expiresAt && I.expiresAt.toMillis ? Math.max(0, Math.ceil((I.expiresAt.toMillis() - Date.now()) / 864e5)) : null;
      const sh = sheet(`<div class="st-join">
          <div class="st-join-h"><span class="e">${T.e}</span><div><b>${esc(I.companyName || 'Organisation')}</b><small>vous invite à rejoindre son espace</small></div></div>
          <div class="st-join-r"><span>Service</span><b>${esc(serviceOf(I.service).l)}</b></div>
          <div class="st-join-r"><span>Poste</span><b>${esc(tmRoleOf(I.role).l)}</b></div>
          <div class="st-join-r"><span>Projets</span><b>${I.allProjects ? 'Tous les projets' : (I.projects || []).length + ' projet(s)'}</b></div>
          <div class="st-join-r"><span>Outils</span><b>${lv.length} outil(s)${I.admin ? ' · administrateur' : ''}</b></div>
          <div class="st-join-l">${lv.map(([m, l]) => `<i>${esc(l.split(' (')[0])} · ${LEVELS[P[m]]}</i>`).join('')}</div>
          ${days != null ? `<small class="muted">Code valable encore ${days} jour(s), une seule fois.</small>` : ''}
          ${I.needsApproval ? '<small class="muted">⏳ Un administrateur de l\'organisation doit accepter votre demande avant l\'accès.</small>' : ''}
          <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="no">Annuler</button><button class="btn" data-a="join-ok">Rejoindre</button></div></div>`, { title: 'Confirmer le code' });
      sh.onClose = () => resolve(false);
      $('[data-a=no]', sh.el).onclick = () => sh.close();
      $('[data-a=join-ok]', sh.el).onclick = () => { sh.onClose = null; sh.close(); resolve(true); };
    });
  }
  async function joinWithCode() {
    const r = await formSheet('Rejoindre avec un code', [{ name: 'code', label: 'Code d\'accès', placeholder: 'Ex : K7M2QX9P' }], { okLabel: 'Continuer' });
    if (!r || !r.code) return null;
    const code = r.code.toUpperCase().replace(/[^A-Z0-9]/g, ''); let ld = loading('Vérification du code…');
    try {
      const iv = await withTimeout(fs.collection('invites').doc(code).get());
      if (!iv.exists) throw new Error('Code introuvable');
      const I = iv.data(); if (I.used) throw new Error('Ce code a déjà été utilisé — demandez un nouveau code');
      if (I.expiresAt && I.expiresAt.toMillis && I.expiresAt.toMillis() < Date.now()) throw new Error('Ce code a expiré — demandez un nouveau code');
      if (I.status && I.status !== 'valide') throw new Error('Ce code a été révoqué — demandez un nouveau code');
      ld.close();
      if (I.kind === 'partner') { await joinPartner(code, I); return null; }
      if (!(await confirmJoin(I))) return null;
      const uid = auth.currentUser.uid;
      if (I.needsApproval) {
        // code « avec approbation » : on dépose une demande ; l'accès n'existe qu'après l'accord d'un administrateur
        ld = loading('Envoi de la demande…');
        await withTimeout(fs.collection('companies').doc(I.cid).collection('requests').doc(uid).set({ code, status: 'attente', name: auth.currentUser.displayName || I.name || '', email: auth.currentUser.email, role: I.role, at: ts() }));
        await withTimeout(fs.collection('invites').doc(code).update({ used: true, usedBy: uid, usedAt: ts() }));
        const W2 = [...(S.workspaces || []).filter(x => x.cid !== I.cid), { cid: I.cid, name: I.companyName || '', kind: 'org', org: I.orgType || 'entreprise', role: I.role, pending: true }];
        await withTimeout(fs.collection('users').doc(uid).set({ workspaces: W2 }, { merge: true })); S.workspaces = W2;
        ld.close(); await alertBox(`Demande envoyée à « ${I.companyName || 'l\'organisation'} ».\nVous aurez accès dès qu'un administrateur l'aura acceptée (Changer d'espace › toucher la demande).`); return null;
      }
      ld = loading('Connexion à l\'organisation…');
      await withTimeout(fs.collection('companies').doc(I.cid).collection('members').doc(uid).set({ name: auth.currentUser.displayName || I.name || '', email: auth.currentUser.email, role: I.role, service: I.service, perms: I.perms, admin: I.admin, allProjects: I.allProjects, projects: I.projects, managerUid: I.managerUid || null, zone: I.zone || '', invite: code, createdAt: ts() }));
      await withTimeout(fs.collection('invites').doc(code).update({ used: true, usedBy: uid, usedAt: ts() }));
      await withTimeout(fs.collection('users').doc(uid).set({ companyId: I.cid }, { merge: true }));
      ld.close(); toast(`Bienvenue chez ${I.companyName || 'votre organisation'} ✓`); return I.cid;
    } catch (e) { ld.close(); alertBox(errMsg(e)); return null; }
  }

  // ---------- parcours d'entrée : espace → formule → type d'organisation → services → (projet → tableau de bord) ----------
  function onboardScreen(opt = {}) {
    return new Promise((resolve) => {
      const el = document.createElement('div'); el.className = 'fullpage tm-login st-onb';
      const nm = (auth.currentUser.displayName || '').split(' ')[0];
      const W = { espace: null, plan: null, org: null, svcs: [] };
      document.body.appendChild(el);
      const done = () => { el.remove(); resolve(true); };
      const steps = (n, tot) => `<div class="st-steps">${Array.from({ length: tot }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
      const back = (fn) => { const b = $('[data-a=back]', el); if (b) b.onclick = fn; };
      const tot = () => W.espace === 'perso' ? 4 : 6;
      // 1 · choix de l'espace
      function stepEspace() {
        el.innerHTML = `<div class="tm-lg-in"><div class="tm-logo st-lg">${stLogo()}</div><h1>Bienvenue${nm ? ' ' + esc(nm) : ''}</h1><p>Comment voulez-vous utiliser SiteTeam ?</p>
          <div class="tm-choice">
            <button data-a="perso"><b>👷 Espace personnel</b><span>Professionnel indépendant : vos outils et vos projets</span></button>
            <button data-a="create"><b>🏢 Créer une organisation</b><span>Entreprise, BET, architecte, labo, MOA… vous invitez ensuite l'équipe</span></button>
            <button data-a="join"><b>🔑 Rejoindre avec un code</b><span>Code d'accès donné par votre responsable</span></button></div>
          ${opt.add ? '<button class="linkbtn" data-a="cancel">← Retour à mon espace</button>' : `<button class="linkbtn" data-a="out">Se déconnecter (${esc(auth.currentUser.email || '')})</button>`}</div>`;
        const out = $('[data-a=out]', el); if (out) out.onclick = async () => { await auth.signOut(); LS.del('me'); LS.del('cid'); location.reload(); };
        const cc = $('[data-a=cancel]', el); if (cc) cc.onclick = () => { el.remove(); resolve(false); };
        $('[data-a=perso]', el).onclick = () => { W.espace = 'perso'; W.org = 'independant'; stepPlan(); };
        $('[data-a=create]', el).onclick = () => { W.espace = 'org'; stepPlan(); };
        $('[data-a=join]', el).onclick = join;
      }
      // 2 · formule
      function stepPlan() {
        const perso = W.espace === 'perso', L = offersFor(perso);
        el.innerHTML = `<div class="tm-lg-in">${steps(2, tot())}<h1>Choisir un pack · ${perso ? 'Espace personnel' : 'Organisation'}</h1>
          <p>${perso ? 'Pour vous seul. Une organisation a son propre pack, payé par elle.' : 'Payé par l\'organisation, il couvre tous ses membres.'} La facturation n'est pas encore activée : rien n'est payé aujourd'hui.</p>
          <div class="st-offers">${L.map(P => offerCard(P, perso)).join('')}</div>
          <button class="btn ghost st-codebtn" data-a="pcode">🎟 J'ai un code pack</button>
          ${perso ? '<p class="st-of-n">Invité par une organisation ? Pas de pack : c\'est elle qui paie pour vous.</p>' : ''}
          <button class="linkbtn" data-a="back">← Retour</button></div>`;
        $$('[data-p]', el).forEach(b => b.onclick = () => { W.plan = b.dataset.p; W.espace === 'perso' ? stepMetier() : stepOrg(); });
        $$('[data-req]', el).forEach(b => b.onclick = () => requestPack(b.dataset.req, perso));
        $('[data-a=pcode]', el).onclick = async () => { const C = await askPackCode(); if (!C) return; W.code = C; W.plan = C.plan; toast(`Code accepté : ${codeLabel(C)} ✓`); W.espace === 'perso' ? stepMetier() : stepOrg(); };
        back(stepEspace);
      }
      // 3 · type d'organisation (= interface)
      function stepOrg() {
        el.innerHTML = `<div class="tm-lg-in">${steps(3, tot())}<h1>Type d'organisation</h1><p>Chaque type a son interface : les outils de votre métier passent en premier.</p>
          <div class="st-orgs">${ORG_TYPES.map(t => `<button data-o="${t.k}"><span class="e">${t.e}</span><b>${esc(t.l)}</b><small>${esc(t.d)}</small></button>`).join('')}</div>
          <button class="linkbtn" data-a="back">← Retour</button></div>`;
        $$('[data-o]', el).forEach(b => b.onclick = () => { W.org = b.dataset.o; W.svcs = [...orgTypeOf(W.org).svcs]; stepSvcs(); });
        back(stepPlan);
      }
      // 4 · services (modèle modifiable : on ne force pas 12 services à un petit entrepreneur)
      function stepSvcs() {
        const T = orgTypeOf(W.org), L = TM_SERVICES.filter(s => s.k !== 'externe' && !SERVICES_LEGACY.includes(s.k));
        W.svcs = W.svcs.filter(svcOpen); if (!W.svcs.includes('direction')) W.svcs.unshift('direction');
        el.innerHTML = `<div class="tm-lg-in">${steps(4, tot())}<h1>${T.e} ${esc(T.l)}</h1><p>Vos services : gardez seulement ceux que vous avez (modifiable plus tard dans Réglages).</p>
          <div class="seg st-tpl"><button data-tpl="petite">Petite entreprise</button><button data-tpl="grande">Grande entreprise</button></div>
          <div class="st-svcs">${L.map(s => svcOpen(s.k) ? `<button data-s="${s.k}" class="${W.svcs.includes(s.k) ? 'on' : ''}" style="--c:${s.c}">${esc(s.l)}</button>` : `<button class="lk" data-lk="${s.k}" style="--c:${s.c}">🔒 ${esc(s.l)}</button>`).join('')}</div>
          <small class="st-lknote">🔒 Services en préparation : ils s'ouvriront un par un.</small>
          <div class="form"><label>Nom de l'organisation<input name="cname" placeholder="Ex : ${T.k === 'entreprise' ? 'Entreprise BTP …' : esc(T.l) + ' …'}"></label>
          <label>Votre nom<input name="me" value="${esc(auth.currentUser.displayName || '')}"></label>
          ${T.k === 'entreprise' ? `<label>Votre poste<select name="role">${TM_ROLES.filter(x => x.admin).map(x => `<option value="${x.k}">${esc(x.l)}</option>`).join('')}</select></label>` : ''}
          <button class="btn" data-a="go">Créer l'organisation</button></div>
          <button class="linkbtn" data-a="back">← Retour</button></div>`;
        const maxS = planFor(planOf(W.plan), false).services || 0;
        if (maxS && W.svcs.length > maxS) W.svcs = W.svcs.slice(0, maxS);
        $$('[data-s]', el).forEach(b => { b.classList.toggle('on', W.svcs.includes(b.dataset.s)); b.onclick = () => { const k = b.dataset.s;
          if (!W.svcs.includes(k) && maxS && W.svcs.length >= maxS) return toast(`Pack ${planOf(W.plan).l} : ${maxS} services au maximum`);
          W.svcs = W.svcs.includes(k) ? W.svcs.filter(x => x !== k) : [...W.svcs, k]; b.classList.toggle('on'); }; });
        // modèles : petite entreprise (3 services de base) ou grande entreprise (tout le modèle du type d'organisation) — modifiables ensuite
        $$('[data-lk]', el).forEach(b => b.onclick = () => toast('🔒 Ce service ouvrira bientôt'));
        $$('[data-tpl]', el).forEach(b => b.onclick = () => { const full = orgTypeOf(W.org).svcs.filter(svcOpen); W.svcs = b.dataset.tpl === 'petite' ? full.slice(0, 3) : [...full]; if (maxS && W.svcs.length > maxS) { W.svcs = W.svcs.slice(0, maxS); toast(`Pack ${planOf(W.plan).l} : ${maxS} services au maximum`); }
          $$('[data-s]', el).forEach(x => x.classList.toggle('on', W.svcs.includes(x.dataset.s))); $$('[data-tpl]', el).forEach(x => x.classList.toggle('on', x === b)); });
        back(stepOrg);
        $('[data-a=go]', el).onclick = () => { const cn = $('[name=cname]', el).value.trim(); if (!cn) return toast('Tapez le nom de l\'organisation');
          const rs = $('[name=role]', el); create({ name: cn, me: $('[name=me]', el).value.trim(), role: rs ? rs.value : T.owner }); };
      }
      // espace personnel : le métier choisit l'interface
      function stepMetier() {
        // Basic = « Free » : interface générale, sans poste ; le service et le poste se choisissent avec Pro (l'application s'adapte au poste)
        if (planOf(W.plan).k === 'basic') {
          el.innerHTML = `<div class="tm-lg-in">${steps(3, tot())}<h1>Espace Free</h1><p>Pack Basic gratuit : les outils essentiels (projets, plans, tâches, photos, rapports), sans poste.<br>Avec Pro, vous choisissez votre service et votre poste, et l'application s'adapte à votre métier.</p>
            <div class="form"><label>Votre nom<input name="me" value="${esc(auth.currentUser.displayName || '')}"></label><button class="btn" data-a="go">Créer mon espace Free</button></div>
            <button class="linkbtn" data-a="back">← Retour</button></div>`;
          back(stepPlan);
          $('[data-a=go]', el).onclick = () => { const me = $('[name=me]', el).value.trim() || auth.currentUser.displayName || ''; create({ name: `Espace de ${me || 'moi'}`, me, metier: '', spec: '' }); };
          return;
        }
        el.innerHTML = `<div class="tm-lg-in">${steps(3, tot())}<h1>Votre service et votre poste</h1><p>L'application s'adapte à votre poste : tableau de bord, outils et recommandations. Ce n'est pas un droit dans une organisation.</p>
          <div class="form"><label>Service › poste<select name="role">${TM_SERVICES.filter(s => s.k !== 'direction' && !SERVICES_LEGACY.includes(s.k)).map(sv => `<optgroup label="${esc(sv.l)}">${TM_ROLES.filter(r => r.s === sv.k && !ROLE_LEGACY[r.k]).map(r => `<option value="${r.k}" ${r.k === 'conducteur' ? 'selected' : ''}>${esc(r.l)}</option>`).join('')}</optgroup>`).join('')}</select></label>
          <label>Spécialités (facultatif)<input name="spec" placeholder="Ex : ferraillage, gros œuvre"></label>
          <label>Votre nom<input name="me" value="${esc(auth.currentUser.displayName || '')}"></label>
          <button class="btn" data-a="go">Créer mon espace</button></div>
          <button class="linkbtn" data-a="back">← Retour</button></div>`;
        back(stepPlan);
        $('[data-a=go]', el).onclick = () => { const me = $('[name=me]', el).value.trim() || auth.currentUser.displayName || ''; create({ name: `Espace de ${me || 'moi'}`, me, metier: $('[name=role]', el).value, spec: $('[name=spec]', el).value.trim() }); };
      }
      async function create(r) {
        const ld = loading(W.espace === 'perso' ? 'Création de votre espace…' : 'Création de l\'organisation…');
        try {
          const uid = auth.currentUser.uid, ref = fs.collection('companies').doc(), perso = W.espace === 'perso', R = perso ? ROLE_PROPRIO : tmRoleOf(r.role), P = planOf(W.plan);
          // nouvel espace : « gratuit » ou « essai » (avec date de fin) ; « actif » ne se donne que par le Super Admin
          const viaCode = W.code && W.code.plan === W.plan;
          const sub = viaCode ? { ...codeSub(W.code), packCode: W.code.code } : P.price === 0 ? { planStatus: 'gratuit' } : { planStatus: 'essai', trialEndsAt: firebase.firestore.Timestamp.fromMillis(Date.now() + (P.trialDays || 14) * 864e5) };
          await withTimeout(ref.set({ name: r.name, ownerUid: uid, plan: W.plan, ...sub, kind: W.espace, orgType: W.org, services: W.svcs, createdAt: ts() }));
          if (viaCode) await withTimeout(useCode(W.code)).catch(e => console.warn('code', e));
          // espace personnel : « propriétaire » (pas un poste, pas de service) ; organisation : le créateur est l'administrateur initial, de CETTE organisation seulement
          const all = Object.fromEntries(MODS.map(([m]) => [m, 4]));
          await withTimeout(ref.collection('members').doc(uid).set({ name: r.me || auth.currentUser.displayName || '', email: auth.currentUser.email, role: R.k, service: perso ? 'perso' : (R.admin ? R.s : 'direction'), perms: all, admin: true, allProjects: true, projects: [], managerUid: null, zone: '', createdAt: ts() }));
          await withTimeout(fs.collection('users').doc(uid).set({ companyId: ref.id, name: r.me || '', ...(perso ? { profil: { metier: r.metier, specialites: r.spec || '' } } : {}) }, { merge: true }));
          ld.close(); toast(W.espace === 'perso' ? 'Espace créé ✓' : 'Organisation créée ✓'); done();
        } catch (e) { ld.close(); alertBox(errMsg(e) + (e.code === 'permission-denied' ? '\n\nLes règles de sécurité Firestore sont-elles installées ?' : '')); }
      }
      async function join() { const cid = await joinWithCode(); if (cid) done(); }
      stepEspace();
    });
  }

  // ---------- synchronisation des données (remplace db.json de Drive) ----------
  const projRef = (pid) => fs.collection('companies').doc((sharedOf(pid) || {}).cid || S.cid).collection('projects').doc(pid);
  // historique : une ligne par enregistrement envoyé (qui, quelle organisation, quoi, heure du serveur)
  const AUD_STORE = { projects: 'Projet', folders: 'Dossier', plans: 'Plan', links: 'Lien', tasks: 'Réserve / tâche', receptions: 'Réception', forms: 'Formulaire / PV', reports: 'Rapport', files: 'Document', items: 'Fiche' };
  function auditOf(r, pid) {
    const { _store, _deleted, ...rec } = r, t = rec.title || rec.name || rec.type || rec.ouvrage || rec.tache || rec.equipe || rec.label || '';
    const act = _deleted ? 'suppr' : (rec.createdAt && rec.updatedAt && rec.updatedAt - rec.createdAt < 3000 ? 'ajout' : (_store === 'forms' && rec.vst && rec.vst !== 'brouillon' ? 'pv_' + rec.vst : 'modif'));
    return { pid, store: _store, kind: rec.kind || null, rid: rec.id, t: String(t).slice(0, 120), act, by: S.user.uid, byName: (S.me || {}).name || S.user.email || '', org: S.cid, orgName: (S.company || {}).name || '', srv: ts() };
  }
  async function push(records) {
    if (!S.ready) return;
    // un PV validé ne se renvoie que par un responsable (sinon le serveur refuserait tout le lot)
    const ok = records.filter(r => { const m = modOf(r._store, r), pid = r._store === 'projects' ? r.id : r.projectId;
      if (r._store === 'projects' && sharedOf(pid)) return false;   // la fiche du projet appartient au titulaire
      return m && lvlFor(m, pid) >= 2 && (r._store === 'projects' ? (canProject(r.id) || lvl0('projet') >= 3) : canProject(r.projectId))
      && !(r._store === 'forms' && (r.vst === 'valide' || r.vst === 'refuse') && r.vby !== S.user.uid && !canValidateForm(r)); });
    const skipped = records.length - ok.length;
    for (let i = 0; i < ok.length; i += 150) {
      const b = fs.batch();
      for (const r of ok.slice(i, i + 150)) {
        const { _store, _deleted, ...rec } = r, mod = modOf(_store, r), pid = _store === 'projects' ? rec.id : rec.projectId;
        if (!pid) continue;
        const doc = projRef(pid).collection('m').doc(mod).collection('r').doc(`${_store}__${rec.id}`);
        b.set(doc, { store: _store, id: rec.id, projectId: pid, kind: rec.kind || null, updatedAt: rec.updatedAt || Date.now(), deleted: !!_deleted, data: _deleted ? '' : JSON.stringify(rec), by: S.user.uid, srv: ts(),
          ...(_store === 'forms' ? { vst: rec.vst || 'brouillon', vby: rec.vby || '', aut: rec.aut || '' } : {}) });
        if (_store === 'projects') b.set(projRef(pid), { name: rec.name || '', address: rec.address || '', deleted: !!_deleted, updatedAt: rec.updatedAt || Date.now(), by: S.user.uid }, { merge: true });
        else b.set(projRef(pid).collection('audit').doc(), auditOf(r, pid));
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
    await loadShared();
    const own = await withTimeout(projectIds(), 30000), shp = (S.shared || []).filter(x => x.status === 'actif' && canProject(x.pid)).map(x => x.pid);
    const pids = [...own, ...shp.filter(x => !own.includes(x))];
    const allMods = [...new Set([...Object.values(STORE_MOD), ...Object.values(KIND_MOD)])].filter(m => m !== '*');
    for (const pid of pids) for (const mod of allMods.filter(m => lvlFor(m, pid) >= 1)) {
      const key = pid + '/' + mod, t = since[key] || 0;
      let q = projRef(pid).collection('m').doc(mod).collection('r');
      if (t) q = q.where('srv', '>', firebase.firestore.Timestamp.fromMillis(t));
      let snap; try { snap = await withTimeout(q.get(), 45000); }
      catch (e) { if (sharedOf(pid) && e.code === 'permission-denied') { console.warn('projet partagé retiré', pid); continue; } throw e; }
      let mx = t;
      snap.forEach(d => { const x = d.data(); const s = x.srv ? x.srv.toMillis() : 0; if (s > mx) mx = s;
        if (x.deleted) out.push({ _store: x.store, id: x.id, projectId: x.projectId, kind: x.kind, _deleted: true, updatedAt: x.updatedAt });
        else { try { out.push({ ...JSON.parse(x.data), _store: x.store }); } catch (e) {} } });
      since[key] = mx;
    }
    // le repère n'est enregistré qu'après l'écriture réussie des données dans le téléphone (commitPull),
    // sinon des enregistrements reçus mais non sauvegardés seraient sautés à la synchro suivante
    return { records: out, now: Date.now(), commit: () => LS.set('pullAt', since) };
  }
  function resetPull() { LS.del('pullAt'); }

  // ---------- invitations ----------
  const newCode = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; return Array.from(crypto.getRandomValues(new Uint8Array(8)), b => A[b % A.length]).join(''); };
  const apkLink = () => `https://github.com/abdessamadwanted-sudo/Chantierpro/releases/download/siteteam-v${APP_VERSION.startsWith('__') ? '1.0.1' : APP_VERSION}/SiteTeam.apk`;
  async function createInvite(o) {
    const R = tmRoleOf(o.role), code = newCode();
    const inv = { cid: S.cid, companyName: S.company.name, name: o.name || '', role: R.k, service: R.s, perms: o.perms || R.perms, admin: !!o.admin, allProjects: !!o.allProjects, projects: o.allProjects ? [] : (o.projects || []),
      managerUid: o.managerUid || null, zone: o.zone || '', orgType: orgType().k, used: false, status: 'valide', needsApproval: !isAdmin(), createdBy: S.user.uid, createdAt: ts(),
      expiresAt: firebase.firestore.Timestamp.fromMillis(Date.now() + 7 * 864e5) };
    await withTimeout(fs.collection('invites').doc(code).set(inv));
    return code;
  }
  // ---------- espace personnel Pro : inviter un collaborateur sur UN projet (au plus « Modifier », jamais admin) ----------
  async function collabFlow(p) {
    if (!isPerso()) return;
    const P = myPlan();
    if (P.k !== 'pro') return limitBox('Travailler à plusieurs sur un projet personnel est inclus dans le pack Pro.');
    let n = S.members.filter(m => m.role === 'collaborateur' && (m.projects || []).includes(p.id)).length;
    try { const q = await fs.collection('invites').where('cid', '==', S.cid).get(); n += q.docs.map(d => d.data()).filter(x => !x.used && (x.status || 'valide') === 'valide' && (x.projects || []).includes(p.id)).length; } catch (e) {}
    if (n >= 3) return alertBox('Ce projet a déjà 3 collaborateurs (ou codes en cours). Révoquez un code ou retirez un collaborateur.');
    const mods = (P.modules === '*' ? MODS.map(([m]) => m) : P.modules).filter(m => m !== 'equipe');
    const def = { projet: 1, plans: 1, reserves: 2, photos: 2, rapports: 1 };
    const r = await new Promise((resolve) => {
      const sh = sheet(`<div class="form tm-form"><p class="muted" style="margin:0;font-size:12.5px">La personne verra seulement « ${esc(p.name)} », avec les outils cochés. Elle ne pourra ni valider, ni administrer, ni voir vos autres projets.</p>
        <label>Nom (facultatif)<input data-f="name" placeholder="Ex : Youssef, chef d'équipe"></label>
        <div class="fld">Outils et niveau</div>${mods.map(m => `<label class="tm-pl"><span>${esc(MOD_LABEL(m))}</span><select data-cm="${m}"><option value="0">Aucun accès</option><option value="1" ${def[m] === 1 ? 'selected' : ''}>Voir</option><option value="2" ${def[m] === 2 ? 'selected' : ''}>Modifier</option></select></label>`).join('')}
        <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="ok">Créer le code</button></div></div>`, { title: 'Inviter un collaborateur' });
      sh.onClose = () => resolve(null);
      $('[data-a=c]', sh.el).onclick = () => sh.close();
      $('[data-a=ok]', sh.el).onclick = () => { const perms = Object.fromEntries(MODS.map(([m]) => [m, 0])); $$('[data-cm]', sh.el).forEach(x => { perms[x.dataset.cm] = Math.min(2, +x.value); });
        if (!perms.projet) perms.projet = 1; sh.onClose = null; sh.close(); resolve({ name: $('[data-f=name]', sh.el).value.trim(), perms }); };
    });
    if (!r) return;
    const ld = loading('Création du code…');
    try { const code = await createInvite({ name: r.name, role: 'collaborateur', perms: r.perms, admin: false, allProjects: false, projects: [p.id] }); ld.close();
      const v = await menu(`Code : ${code}`, [{ label: 'Envoyer par WhatsApp', icon: 'share', value: 'wa' }, { label: 'Copier le code', icon: 'file', value: 'cp' }, { label: 'Fermer', icon: 'check', value: 'ok' }]);
      if (v === 'wa') shareInvite(code, { name: r.name, role: 'collaborateur' }); if (v === 'cp') copyText(code); return code;
    } catch (e) { ld.close(); alertBox(errMsg(e) + (e.code === 'permission-denied' ? '\n\nLes règles Firestore v1.0.17 sont-elles publiées ?' : '')); }
  }
  function shareInvite(code, o) {
    const R = tmRoleOf(o.role);
    const txt = `Bonjour${o.name ? ' ' + o.name : ''},\nRejoignez l'équipe *${S.company.name}* sur SiteTeam (${R.l}).\n\n1️⃣ Installez l'application : ${apkLink()}\n2️⃣ Créez votre compte\n3️⃣ « Rejoindre avec un code » → *${code}*\n(code valable 7 jours)`;
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
    if (!myPlan().shares) { await limitBox('Le partage avec d\'autres organisations (groupements, intervenants externes) est inclus dans le pack Enterprise.'); return null; }
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

  // ---------- projet multi-organisations : partenaires, groupement (JV), historique ----------
  const PMODS = () => MODS.filter(([k]) => k !== 'projet' && k !== 'equipe');
  const modsTxt = (m) => { const L = PMODS().filter(([k]) => (m || {})[k] > 0).map(([k, l]) => `${l.split(' (')[0].split(' / ')[0]} : ${m[k] >= 2 ? 'modifier' : 'voir'}`); return L.length ? L.join(' · ') : 'aucun module'; };
  function partnerForm(o = {}) {
    return new Promise((resolve) => {
      const M = { ...(o.mods || PARTNER_DEF[o.role || 'bet'] || {}) };
      const s = sheet(`<div class="form tm-form st-pform">
        <label>Rôle de l'organisation dans le projet<select data-f="role">${PARTNER_ROLES.map(([k, l]) => `<option value="${k}" ${k === (o.role || 'bet') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        ${o.edit ? '' : `<label>Nom de l'organisation (pour vous retrouver)<input data-f="label" value="${esc(o.label || '')}" placeholder="Ex : BET Structures Atlas"></label>`}
        <div class="fld">Ce qu'elle voit dans ce projet <small class="muted">(au plus « Modifier » ; elle ne voit jamais votre équipe ni vos autres projets)</small></div>
        <div class="st-pmods">${PMODS().map(([k, l]) => `<label class="tm-pl"><span>${esc(l)}</span><select data-pm="${k}">${['Aucun accès', 'Voir', 'Modifier'].map((x, i) => `<option value="${i}" ${(+M[k] || 0) === i ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`).join('')}</div>
        <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="ok">${o.edit ? 'Enregistrer' : 'Créer le code'}</button></div></div>`, { title: o.edit ? `Accès · ${o.orgName || ''}` : 'Inviter une organisation' });
      s.onClose = () => resolve(null);
      const role = $('[data-f=role]', s.el);
      role.onchange = () => { const D = PARTNER_DEF[role.value] || {}; $$('[data-pm]', s.el).forEach(x => { x.value = String(D[x.dataset.pm] || 0); }); };
      $('[data-a=c]', s.el).onclick = () => s.close();
      $('[data-a=ok]', s.el).onclick = () => {
        const mods = { projet: 1 }; $$('[data-pm]', s.el).forEach(x => { const v = Math.min(2, +x.value || 0); if (v) mods[x.dataset.pm] = v; });
        if (Object.keys(mods).length < 2) return alertBox('Choisissez au moins un module à partager.');
        const lb = $('[data-f=label]', s.el); s.onClose = null; s.close(); resolve({ role: role.value, label: lb ? lb.value.trim() : '', mods });
      };
    });
  }
  async function partnerInvite(p, jv) {
    const sh = sharedOf(p.id), mand = !!(sh && jv && jv.mand === S.cid && isAdmin());
    if (!sh && !myPlan().shares) { await limitBox('Inviter d\'autres organisations dans un projet (BET, maître d\'ouvrage, groupement…) est inclus dans le pack Enterprise.'); return null; }
    const o = await partnerForm(); if (!o) return null;
    const code = newCode(), ld = loading('Création du code…');
    try {
      await withTimeout(fs.collection('invites').doc(code).set({ kind: 'partner', cid: sh ? sh.cid : S.cid, pid: p.id, pname: p.name || '', ownerName: sh ? (sh.ownerName || '') : (S.company.name || ''),
        prole: o.role, label: o.label, mods: o.mods, used: false, status: 'valide', needsApproval: false, createdBy: S.user.uid, createdByName: (S.me || {}).name || '', viaMand: mand,
        createdAt: ts(), expiresAt: firebase.firestore.Timestamp.fromMillis(Date.now() + 14 * 864e5) }));
      ld.close();
      const txt = `Bonjour${o.label ? ' ' + o.label : ''},\nVotre organisation est invitée sur le projet *${p.name || ''}* (${partnerRoleLabel(o.role)}) dans SiteTeam.\n\n1️⃣ Ouvrez SiteTeam dans l'espace de votre organisation (administrateur)\n2️⃣ Changer d'espace › Rejoindre avec un code : *${code}*\n\nAccès : ${modsTxt(o.mods)}. Code valable 14 jours, une seule fois.`;
      const v = await menu(`Code partenaire : ${code}`, [{ label: 'Envoyer par WhatsApp', icon: 'share', value: 'wa' }, { label: 'Copier le code', icon: 'file', value: 'cp' }, { label: 'Fermer', icon: 'check', value: 'ok' }]);
      if (v === 'wa') openUrl('https://wa.me/?text=' + encodeURIComponent(txt)); if (v === 'cp') copyText(code);
      return code;
    } catch (e) { ld.close(); alertBox(errMsg(e)); return null; }
  }
  // l'administrateur d'une organisation accepte l'invitation : son organisation devient partenaire du projet (ses données restent chez elle)
  async function joinPartner(code, I) {
    if (!S.ready || !S.cid || !S.company) return alertBox('Ce code invite une organisation sur un projet.\nCréez ou ouvrez d\'abord l\'espace de votre organisation, puis entrez le code.');
    if (I.cid === S.cid) return alertBox('Ce projet appartient déjà à « ' + S.company.name + ' ».');
    if (!isAdmin()) return alertBox(`Seul un administrateur de « ${S.company.name} » peut accepter cette invitation.`);
    if (sharedOf(I.pid)) return alertBox('Votre organisation participe déjà à ce projet.');
    const ok = await new Promise((resolve) => {
      const sh = sheet(`<div class="tm-box"><b>${esc(I.pname || 'Projet')}</b><small>Projet de « ${esc(I.ownerName || '')} »</small><small>Rôle de « ${esc(S.company.name)} » : <b>${esc(partnerRoleLabel(I.prole))}</b></small></div>
        <div class="tm-box"><b>Accès accordé</b><p>${esc(modsTxt(I.mods))}</p></div>
        <p class="muted" style="font-size:12.5px">Vos membres verront ce projet dans « ${esc(S.company.name)} », selon leurs propres droits. Votre équipe, votre organigramme et vos autres projets restent privés.</p>
        <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="no">Annuler</button><button class="btn" data-a="pj-ok">Rejoindre le projet</button></div>`, { title: 'Projet partenaire' });
      sh.onClose = () => resolve(false);
      $('[data-a=no]', sh.el).onclick = () => sh.close();
      $('[data-a=pj-ok]', sh.el).onclick = () => { sh.onClose = null; sh.close(); resolve(true); };
    });
    if (!ok) return null;
    const ld = loading('Connexion au projet…');
    try {
      const b = fs.batch(), uid = S.user.uid;
      b.set(fs.collection('companies').doc(I.cid).collection('projects').doc(I.pid).collection('partners').doc(S.cid), { orgName: S.company.name || '', orgType: orgType().k, role: I.prole, mods: I.mods, status: 'actif', code, by: uid, byName: (S.me || {}).name || '', at: ts() });
      b.set(fs.collection('companies').doc(S.cid).collection('shared').doc(I.pid), { cid: I.cid, ownerName: I.ownerName || '', name: I.pname || '', role: I.prole, mods: I.mods, status: 'actif', at: ts() });
      b.update(fs.collection('invites').doc(code), { used: true, usedBy: uid, usedAt: ts() });
      await withTimeout(b.commit());
      await loadShared(); ld.close(); toast(`Projet « ${I.pname || ''} » ajouté ✓`);
      try { if (typeof Sync !== 'undefined' && Sync.enabled && Sync.enabled()) { resetPullFor(I.pid); await Sync.run({ quiet: true }); } } catch (e) {}
      try { App.project = null; renderHome(); } catch (e) {}
      return I.pid;
    } catch (e) { ld.close(); alertBox(errMsg(e)); return null; }
  }
  function resetPullFor(pid) { const since = LS.get('pullAt', {}); Object.keys(since).filter(k => k.startsWith(pid + '/')).forEach(k => delete since[k]); LS.set('pullAt', since); }
  async function openPartners(p, root) {
    if (!S.ready && root) { root.innerHTML = '<div class="empty">Les organisations partenaires sont disponibles avec un compte SiteTeam.</div>'; return; }
    if (!S.ready) return alertBox('Connectez-vous à SiteTeam pour partager un projet avec d\'autres organisations.');
    const sh0 = sharedOf(p.id), ownerCid = sh0 ? sh0.cid : S.cid, ref = projRef(p.id);
    let s = null, wrap;
    if (root) { root.innerHTML = `<div class="pagehead"><h2>Organisations du projet</h2><p>Titulaire, partenaires et groupement</p></div><div class="st-pt" style="padding:0 16px 24px"><div class="empty">Chargement…</div></div>`; wrap = $('.st-pt', root); }
    else { s = sheet('<div class="st-pt"><div class="empty">Chargement…</div></div>', { title: 'Organisations du projet' }); wrap = $('.st-pt', s.el); }
    const draw = async () => {
      let L = [], jv = null;
      try { const [q, d] = await withTimeout(Promise.all([ref.collection('partners').get(), ref.get().catch(() => null)]), 15000); L = q.docs.map(x => ({ o: x.id, ...x.data() })); jv = (d && d.exists && d.data().jv) || null; }
      catch (e) { wrap.innerHTML = `<div class="empty">${esc(errMsg(e))}<br>Connexion internet nécessaire.</div>`; return; }
      const owner = !sh0 && isAdmin(), mand = !!(sh0 && jv && jv.mand === S.cid && isAdmin()), canManage = owner || mand;
      const ownerName = sh0 ? (sh0.ownerName || 'Titulaire') : (S.company.name || '');
      const nameOf = (cid) => cid === ownerCid ? ownerName : ((L.find(x => x.o === cid) || {}).orgName || '?');
      wrap.innerHTML = `<p class="muted" style="font-size:12.5px;margin:0 0 10px">Chaque organisation garde ses données privées (équipe, organigramme, autres projets). Ici, elle voit seulement les modules accordés sur ce projet.</p>
        <div class="tm-box st-jv"><b>🤝 Groupement d'entreprises (JV)</b>${jv && jv.name ? `<p><b>${esc(jv.name)}</b><br>Mandataire : ${esc(nameOf(jv.mand))}</p>` : '<p>Aucun groupement déclaré pour ce projet.</p>'}
          ${owner ? `<div class="btnrow" style="padding:0"><button class="btn ghost small" data-a="jv">${jv && jv.name ? 'Modifier le groupement' : 'Déclarer un groupement'}</button></div>` : ''}</div>
        <div class="section-label">Organisations (${L.length + 1})</div>
        <div class="list">
          <div class="tm-inv"><span class="grow"><b>${esc(ownerName)}${!sh0 ? ' (vous)' : ''}</b><small>👑 Titulaire du projet${jv && jv.mand === ownerCid ? ' · Mandataire' : ''}</small></span></div>
          ${L.map(x => `<div class="tm-inv" data-o="${esc(x.o)}"><span class="grow"><b>${esc(x.orgName || '?')}${x.o === S.cid ? ' (vous)' : ''}</b><small>${esc(partnerRoleLabel(x.role))}${jv && jv.mand === x.o ? ' · Mandataire' : ''}${x.status !== 'actif' ? ' · suspendu' : ''}</small><small>${esc(modsTxt(x.mods))}</small></span>${canManage ? icon('more') : ''}</div>`).join('')}
        </div>
        ${canManage ? `<button class="btn" data-a="inv" style="margin-top:12px">${icon('plus')} Inviter une organisation</button>` : ''}
        ${sh0 && isAdmin() ? `<button class="btn ghost danger" data-a="leave" style="margin-top:12px">Quitter ce projet</button>` : ''}
        ${!canManage && !isAdmin() ? '<small class="muted">Seul un administrateur gère les organisations du projet.</small>' : ''}`;
      const inv = $('[data-a=inv]', wrap); if (inv) inv.onclick = async () => { if (await partnerInvite(p, jv)) draw(); };
      const jb = $('[data-a=jv]', wrap); if (jb) jb.onclick = async () => {
        const opts = [{ value: ownerCid, label: ownerName + ' (titulaire)' }, ...L.map(x => ({ value: x.o, label: `${x.orgName || '?'} · ${partnerRoleLabel(x.role)}` }))];
        const r = await formSheet('Groupement d\'entreprises (JV)', [{ name: 'name', label: 'Nom du groupement', value: (jv && jv.name) || '', placeholder: 'Ex : Groupement Atlas – Sahara' },
          { name: 'mand', label: 'Mandataire (entreprise chef de file)', type: 'select', options: opts, value: (jv && jv.mand) || ownerCid }], { danger: jv && jv.name ? 'Supprimer le groupement' : null });
        if (!r) return;
        try { await withTimeout(ref.set({ jv: r.__danger ? { name: '', mand: '' } : { name: r.name || 'Groupement', mand: r.mand || ownerCid } }, { merge: true })); toast('Groupement enregistré ✓'); draw(); } catch (e) { alertBox(errMsg(e)); }
      };
      $$('[data-o]', wrap).forEach(row => row.onclick = async () => {
        if (!canManage) return; const x = L.find(i => i.o === row.dataset.o); if (!x || x.o === S.cid) return;
        const v = await menu(x.orgName || 'Organisation', [{ label: 'Modifier les accès', icon: 'edit', value: 'ed' }, { label: x.status === 'actif' ? 'Suspendre l\'accès' : 'Rétablir l\'accès', icon: 'close', value: 'st' }, { label: 'Retirer du projet', icon: 'trash', danger: true, value: 'rm' }]);
        try {
          if (v === 'ed') { const o = await partnerForm({ ...x, edit: true }); if (o) { await withTimeout(ref.collection('partners').doc(x.o).update({ role: o.role, mods: o.mods })); toast('Accès mis à jour ✓'); } }
          if (v === 'st') { await withTimeout(ref.collection('partners').doc(x.o).update({ status: x.status === 'actif' ? 'suspendu' : 'actif' })); }
          if (v === 'rm' && await confirmBox(`Retirer « ${x.orgName} » du projet ? Elle perd l'accès tout de suite. L'historique reste.`, 'Retirer')) await withTimeout(ref.collection('partners').doc(x.o).delete());
          if (v) draw();
        } catch (e) { alertBox(errMsg(e)); }
      });
      const lv = $('[data-a=leave]', wrap); if (lv) lv.onclick = async () => {
        if (!await confirmBox(`« ${S.company.name} » quitte le projet « ${p.name || ''} » ? Vos membres n'y auront plus accès.`, 'Quitter')) return;
        try { await withTimeout(ref.collection('partners').doc(S.cid).delete()); await withTimeout(fs.collection('companies').doc(S.cid).collection('shared').doc(p.id).delete()); await loadShared(); if (s) s.close(); toast('Projet quitté'); try { App.project = null; renderHome(); } catch (e) {} }
        catch (e) { alertBox(errMsg(e)); }
      };
    };
    await draw();
  }
  // ---------- historique du projet (qui a fait quoi, quand, dans quelle organisation) ----------
  const ACT = { ajout: ['Ajout', '#22c55e'], modif: ['Modification', '#3b82f6'], suppr: ['Suppression', '#ef4444'], pv_soumis: ['PV soumis', '#f59e0b'], pv_valide: ['PV validé', '#22c55e'], pv_refuse: ['PV refusé', '#ef4444'] };
  async function renderHistory(root) {
    const p = App.project;
    root.innerHTML = `<div class="pagehead"><h2>Historique</h2><p>Qui a ajouté, modifié ou supprimé — et quand</p></div><div class="st-hist"><div class="empty">Chargement…</div></div>`;
    const box = $('.st-hist', root);
    if (!S.ready) { box.innerHTML = '<div class="empty">L\'historique partagé est disponible avec un compte SiteTeam.</div>'; return; }
    let L = [];
    try { const q = await withTimeout(projRef(p.id).collection('audit').orderBy('srv', 'desc').limit(200).get(), 15000); L = q.docs.map(d => d.data()); }
    catch (e) { box.innerHTML = `<div class="empty">${esc(errMsg(e))}<br>Connexion internet nécessaire pour l'historique.</div>`; return; }
    let f = 'all';
    const draw = () => {
      const R = L.filter(x => f === 'all' || (f === 'me' ? x.org === S.cid : x.org !== S.cid));
      let day = '';
      box.innerHTML = `<div class="st-hf">${[['all', 'Tout'], ['me', 'Mon organisation'], ['ext', 'Autres organisations']].map(([k, l]) => `<button data-hf="${k}" class="${f === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${R.length ? R.map(x => { const d = x.srv && x.srv.toDate ? x.srv.toDate() : new Date(), dl = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }), a = ACT[x.act] || ACT.modif;
          const head = dl !== day ? `<div class="section-label">${esc(dl)}</div>` : ''; day = dl;
          return `${head}<div class="st-hrow"><span class="st-state" style="--c:${a[1]}">${a[0]}</span><div class="grow"><b>${esc(AUD_STORE[x.store] || x.store || '')}${x.t ? ' · ' + esc(x.t) : ''}</b><small>${esc(x.byName || '?')} · ${esc(x.orgName || '')} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small></div></div>`; }).join('')
        : '<div class="empty">Aucune opération enregistrée pour l\'instant.<br>Les ajouts et modifications apparaissent ici après la synchronisation.</div>'}`;
      $$('[data-hf]', box).forEach(b => b.onclick = () => { f = b.dataset.hf; draw(); });
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
    // espace personnel : ni organigramme, ni membres, ni codes — profil professionnel, abonnement, paramètres, compte
    const perso = isPerso(), collab = isCollab();
    if (perso && ['org', 'mem', 'inv'].includes(tab)) tab = 'prof';
    if (collab) tab = 'me';
    const draw = async () => {
      const M = S.members, byUid = Object.fromEntries(M.map(m => [m.uid, m]));
      const tabs = collab ? [['me', 'Mon compte']] : perso ? [['prof', 'Mon profil'], ['abo', 'Mon abonnement'], ['set', 'Paramètres'], ['me', 'Mon compte']]
        : [['org', 'Organigramme'], ['mem', 'Membres'], ...(canInvite() ? [['inv', 'Codes d\'accès']] : []), ...(isAdmin() ? [['set', 'Réglages']] : []), ['me', 'Mon compte']];
      el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:17px">${perso ? 'Mon espace personnel' : esc(S.company.name)}</h1>
          ${canInvite() ? `<button class="btn small" data-a="invite" style="flex:none">${icon('plus')} Inviter</button>` : ''}</div>
        <div class="tm-tabs">${tabs.map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="tm-body"></div>`;
      $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
      $$('[data-t]', el).forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
      const inv = $('[data-a=invite]', el); if (inv) inv.onclick = () => inviteFlow().then(c => { if (c) { tab = 'inv'; draw(); } });
      const body = $('.tm-body', el);
      const av = (m) => `<span class="tm-av" style="background:${serviceOf(m.service).c}">${esc(String(m.name || m.email || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase())}</span>`;
      const card = (m) => `<button class="tm-mem" data-uid="${m.uid}">${av(m)}<span class="grow"><b>${esc(m.name || m.email)}</b><small>${esc([m.role, ...(m.postes || [])].map(k => tmRoleOf(k).l).join(' + '))}${m.zone ? ' · ' + esc(m.zone) : ''}${m.admin ? ' · admin' : ''}</small></span>${m.uid === S.user.uid ? '<i class="tm-me">moi</i>' : ''}</button>`;
      if (tab === 'org') {
        const rIdx = (m) => (tmRoleOf(m.role).rank || 9) * 1000 + TM_ROLES.findIndex(r => r.k === m.role);
        const tree = (list, parent, depth) => list.filter(m => (m.managerUid || null) === parent || (depth === 0 && m.managerUid && !list.some(x => x.uid === m.managerUid)))
          .sort((a, b) => rIdx(a) - rIdx(b)).map(m => `<div class="tm-node" style="--d:${depth}">${card(m)}</div>${tree(list, m.uid, depth + 1)}`).join('');
        const canPostes = isAdmin() || lvl('equipe') >= 4;
        body.innerHTML = (canPostes && !perso ? `<div class="btnrow" style="padding:0 0 8px"><button class="btn ghost small" data-a="postes">${icon('settings')} Gérer les postes</button></div>` : '') + companyServices().map(s => { const L = M.filter(m => (m.service || tmRoleOf(m.role).s) === s.k); if (!L.length) return '';
          return `<div class="tm-svc"><div class="tm-svc-h" style="--c:${s.c}"><i></i>${s.l}<span>${L.length}</span></div>${tree(L, null, 0)}</div>`; }).join('') || '<div class="empty">Aucun membre.</div>';
      }
      if (tab === 'mem') body.innerHTML = `<div class="list">${M.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(m => `<div class="tm-row">${card(m)}<div class="tm-sub">${m.allProjects ? 'Tous les projets' : (m.projects || []).map(pname).join(', ') || 'Aucun projet'}${m.managerUid && byUid[m.managerUid] ? ' · sous ' + esc(byUid[m.managerUid].name) : ''}</div></div>`).join('')}</div>`;
      if (tab === 'inv') {
        let L = [], Rq = []; try { const q = await (isAdmin() ? fs.collection('invites').where('cid', '==', S.cid) : fs.collection('invites').where('cid', '==', S.cid).where('createdBy', '==', S.user.uid)).get(); L = q.docs.map(d => ({ code: d.id, ...d.data() })).filter(x => !x.used && (x.status || 'valide') === 'valide');
          if (isAdmin()) { const rq = await fs.collection('companies').doc(S.cid).collection('requests').where('status', '==', 'attente').get(); Rq = rq.docs.map(d => ({ uid: d.id, ...d.data() })); } } catch (e) { body.innerHTML = `<div class="empty">${esc(errMsg(e))}</div>`; return; }
        const reqHTML = Rq.length ? `<div class="tm-box"><b>⏳ Demandes à approuver (${Rq.length})</b>${Rq.map(r => `<div class="tm-inv"><span class="grow">${esc(r.name || r.email || '?')}<small>${esc(r.email || '')} · ${esc(tmRoleOf(r.role).l)} · code ${esc(r.code)}</small></span>
          <button class="btn small" data-acc="${esc(r.uid)}">Accepter</button><button class="btn ghost small" data-ref="${esc(r.uid)}">Refuser</button></div>`).join('')}</div>` : '';
        body.innerHTML = reqHTML + (L.length ? `<div class="list">${L.map(x => `<div class="tm-inv"><b class="tm-code">${x.code}</b><span class="grow">${esc(x.name || '—')}<small>${esc(tmRoleOf(x.role).l)} · ${x.allProjects ? 'tous les projets' : (x.projects || []).map(pname).join(', ')}${x.expiresAt && x.expiresAt.toMillis ? (x.expiresAt.toMillis() < Date.now() ? ' · <b style="color:#ef4444">expiré</b>' : ` · expire dans ${Math.ceil((x.expiresAt.toMillis() - Date.now()) / 864e5)} j`) : ''}</small></span>
          <button class="iconbtn sm" data-sh="${x.code}">${icon('share')}</button><button class="iconbtn sm" data-del="${x.code}">${icon('trash')}</button></div>`).join('')}</div>`
          : '<div class="empty">Aucun code d\'accès en cours.<br>Touchez <b>Inviter</b> pour ajouter un membre.</div>');
        $$('[data-sh]', body).forEach(b => b.onclick = () => { const x = L.find(i => i.code === b.dataset.sh); shareInvite(x.code, x); });
        // révoquer : le code reste dans l'historique avec l'état « révoqué » et ne peut plus servir
        $$('[data-del]', body).forEach(b => b.onclick = async () => { if (await confirmBox('Révoquer ce code ? Il ne pourra plus servir.', 'Révoquer le code')) { try { await fs.collection('invites').doc(b.dataset.del).update({ status: 'revoque', revokedAt: ts() }); toast('Code révoqué ✓'); } catch (e) { alertBox(errMsg(e)); } draw(); } });
        $$('[data-acc]', body).forEach(b => b.onclick = async () => { const r = Rq.find(x => x.uid === b.dataset.acc); try {
            const iv = await fs.collection('invites').doc(r.code).get(); const I = iv.data();
            if (!(await confirmBox(`Accepter ${r.name || r.email} comme ${tmRoleOf(I.role).l} ?`, 'Accepter'))) return;
            await fs.collection('companies').doc(S.cid).collection('members').doc(r.uid).set({ name: r.name || I.name || '', email: r.email || '', role: I.role, service: I.service, perms: I.perms, admin: false, allProjects: I.allProjects, projects: I.projects, managerUid: I.managerUid || null, zone: I.zone || '', invite: r.code, createdAt: ts() });
            await fs.collection('companies').doc(S.cid).collection('requests').doc(r.uid).update({ status: 'acceptee', by: S.user.uid, at: ts() }); toast('Accès accordé ✓'); await refreshMembers(); draw(); } catch (e) { alertBox(errMsg(e)); } });
        $$('[data-ref]', body).forEach(b => b.onclick = async () => { if (!(await confirmBox('Refuser cette demande ?', 'Refuser'))) return; try { await fs.collection('companies').doc(S.cid).collection('requests').doc(b.dataset.ref).update({ status: 'refusee', by: S.user.uid, at: ts() }); toast('Demande refusée'); draw(); } catch (e) { alertBox(errMsg(e)); } });
      }
      if (tab === 'set') {
        const c = Sync.cfg(), P = myPlan(), nUsers = S.members.length, over = P.users && nUsers > P.users, T = orgType();
        const nProj = projects.filter(p => !p.deleted).length;
        body.innerHTML = `<div class="form">
          ${isSuper() ? `<div class="tm-box st-super"><b>🛡 Super Admin SiteTeam</b><p>Panneau d'administration : utilisateurs, organisations, packs, demandes, annonces, version, erreurs.</p><div class="btnrow" style="padding:0"><button class="btn small" data-a="admin">Panneau d'administration</button><button class="btn ghost small" data-a="super">Console rapide</button></div></div>` : ''}
          <div class="tm-box"><b>📦 Pack ${esc(P.e || '')} ${esc(P.l)}</b>
            <p>${esc(planPrice(P))} · ${esc(planUsers(P))}${P.extraUserPrice ? ` (puis ${P.extraUserPrice} MAD/mois par compte)` : ''} · ${P.projects ? P.projects + ' projet(s)' : 'projets illimités'} · ${P.storageGb} Go${P.modules === '*' ? ' · tous les outils' : ` · ${P.modules.length} outils`}${P.hier ? ' · hiérarchie' : ''}${P.shares ? ' · groupements' : ''}</p>
            <div style="color:${over ? '#ef4444' : 'var(--muted)'}">${nUsers}${P.users ? ' / ' + P.users : ''} compte(s) · ${nProj}${P.projects ? ' / ' + P.projects : ''} projet(s)${over ? ' — au-delà du pack' : ''}</div>
            <p style="font-size:12.5px;color:var(--muted)">Essai — la facturation n'est pas encore activée. Un membre invité par code n'a pas besoin de pack : seule l'organisation est facturée.</p>
            <div class="btnrow" style="padding:0"><button class="btn ghost small" data-a="catalog">Catalogue des outils</button><button class="btn ghost small" data-a="planchange">Demander un changement de pack</button><button class="btn ghost small" data-a="pcode">🎟 Code pack</button></div></div>
          ${isPerso() ? '' : `<div class="tm-box"><b>${T.e} Type d'organisation : ${esc(T.l)}</b><p>Le type choisit l'interface (outils mis en avant). Services actifs : ${companyServices().filter(x => x.k !== 'externe').map(x => esc(x.l)).join(', ')}.</p>
            <div class="btnrow" style="padding:0"><button class="btn ghost small" data-a="otype">Changer le type</button><button class="btn ghost small" data-a="svcs">Services…</button></div></div>`}
          <div class="tm-box"><b>☁ Google Drive de l'entreprise</b><p>Les plans, photos et PDF de toute l'équipe sont rangés dans ce Drive. Les membres le reçoivent automatiquement.</p>
            <div>${c && c.mode === 'g' ? `<span style="color:#22c55e">✓ Connecté avec Google${c.email ? ' (' + esc(c.email) + ')' : ''}</span><br><span style="font-size:12.5px;color:var(--muted)">Drive personnel de ce compte (chaque membre peut connecter le sien).</span>` : c && c.url ? '<span style="color:#22c55e">✓ Connecté</span>' : '<span style="color:#f59e0b">Non connecté — les fichiers restent sur chaque téléphone</span>'}</div>
            <div class="btnrow" style="padding:0"><button class="btn ghost small" data-a="drive">${c && (c.url || c.mode === 'g') ? 'Réglages Drive' : 'Connecter Google Drive'}</button>${c && c.url ? '<button class="btn ghost small" data-a="share">Partager avec l\'équipe</button>' : ''}</div></div>
          <div class="tm-box"><b>📥 Importer depuis l'application Chantier</b><p>Récupère vos projets (tableaux, réserves, plans, photos…) depuis le code de connexion Drive de Chantier.</p>
            <button class="btn ghost small" data-a="import">Importer des projets</button></div>
          <div class="tm-box"><b>🔒 Règles de sécurité Firestore</b><p>À coller une seule fois dans la console Firebase › Firestore Database › Règles › Publier.</p>
            <button class="btn ghost small" data-a="rules">Copier les règles</button></div>
          <div class="tm-box"><b>🗂 Règles Cloud Storage (fichiers partagés)</b><p>À coller dans la console Firebase › Storage › Règles › Publier (accepter l'accès à Firestore si la console le demande).</p>
            <button class="btn ghost small" data-a="srules">Copier les règles Storage</button></div>
          <div class="tm-box"><b>🔒 Confidentialité de l'écran</b><p>Interdire les captures et l'enregistrement de l'écran pour tous les membres (l'application apparaît noire dans les applications récentes). Une photo de l'écran avec un autre téléphone reste possible.</p>
            <label class="tm-ck"><input type="checkbox" data-a="secure" ${(S.company || {}).secureScreen ? 'checked' : ''} ${appCfg().secureAll ? 'disabled' : ''}> Anti-capture d'écran${appCfg().secureAll ? ' (imposé par SiteTeam)' : ''}</label></div>
          <div class="tm-box"><b>🏢 Entreprise</b><button class="btn ghost small" data-a="ren">Renommer l'entreprise</button></div></div>`;
        $('[data-a=drive]', body).onclick = () => Sync.openSyncSettings();
        const sc = $('[data-a=secure]', body); if (sc) sc.onchange = async () => { try { await fs.collection('companies').doc(S.cid).update({ secureScreen: sc.checked }); S.company.secureScreen = sc.checked; LS.set('company', S.company); secureApply(); toast(sc.checked ? 'Anti-capture activé ✓' : 'Anti-capture désactivé'); } catch (e) { sc.checked = !sc.checked; alertBox(errMsg(e)); } };
        const sup = $('[data-a=super]', body); if (sup) sup.onclick = () => superConsole();
        const adm = $('[data-a=admin]', body); if (adm) adm.onclick = () => { location.href = 'admin.html' + (/[?&]emu=1/.test(location.search) ? '?emu=1' : ''); };
        $('[data-a=catalog]', body).onclick = () => openCatalogue();
        const ot = $('[data-a=otype]', body); if (ot) ot.onclick = async () => {
          const k = await menu('Type d\'organisation', ORG_TYPES.map(t => ({ label: `${t.e} ${t.l}`, value: t.k, checked: t.k === T.k })));
          if (!k || k === T.k) return; try { await fs.collection('companies').doc(S.cid).update({ orgType: k }); S.company.orgType = k; LS.set('company', S.company); toast('Interface mise à jour ✓'); draw(); } catch (e) { alertBox(errMsg(e)); } };
        const sv = $('[data-a=svcs]', body); if (sv) sv.onclick = async () => { const L = await pickServices(Array.isArray(S.company.services) ? S.company.services : TM_SERVICES.map(x => x.k));
          if (!L) return; try { await fs.collection('companies').doc(S.cid).update({ services: L }); S.company.services = L; LS.set('company', S.company); toast('Services enregistrés ✓'); draw(); } catch (e) { alertBox(errMsg(e)); } };
        const sh = $('[data-a=share]', body); if (sh) sh.onclick = shareDrive;
        $('[data-a=import]', body).onclick = () => importChantier();
        $('[data-a=rules]', body).onclick = () => copyText(FIRESTORE_RULES);
        $('[data-a=srules]', body).onclick = () => copyText(STORAGE_RULES);
        $('[data-a=ren]', body).onclick = async () => { const r = await formSheet('Entreprise', [{ name: 'n', label: 'Nom', value: S.company.name }]); if (r && r.n) { await fs.collection('companies').doc(S.cid).update({ name: r.n }); S.company.name = r.n; LS.set('company', S.company); draw(); } };
        { const pcb = $('[data-a=pcode]', body); if (pcb) pcb.onclick = () => applyPackCode(); }
        $('[data-a=planchange]', body).onclick = async () => { const L = offersFor(false).filter(x => x.k !== myPlan().k); const k = await menu('Quel pack demander ?', L.map(x => ({ label: `${x.e || ''} ${x.l} · ${planPrice(x)}`, value: x.k }))); if (k) requestPack(k, false); };
      }
      if (tab === 'prof') {
        const F = S.profil || {}, M2 = metierOf(F.metier);
        body.innerHTML = `<div class="form st-prof">
          <p class="muted" style="margin:0;font-size:12.5px">Votre métier personnalise vos outils et vos recommandations. Ce n'est pas un poste : il ne donne aucun droit dans une organisation.</p>
          <label>Métier principal<select data-f="metier">${TM_SERVICES.filter(x => x.k !== 'direction' && (!SERVICES_LEGACY.includes(x.k) || tmRoleOf(F.metier).s === x.k)).map(sv => `<optgroup label="${esc(sv.l)}">${TM_ROLES.filter(r => r.s === sv.k && (!ROLE_LEGACY[r.k] || r.k === F.metier)).map(r => `<option value="${r.k}" ${r.k === F.metier ? 'selected' : ''}>${esc(r.l)}</option>`).join('')}</optgroup>`).join('')}</select></label>
          <label>Spécialités<input data-f="specialites" value="${esc(F.specialites || '')}" placeholder="Ex : ferraillage, gros œuvre"></label>
          <label>Expérience (années)<input data-f="experience" type="number" min="0" value="${esc(F.experience ?? '')}"></label>
          <label>Compétences<textarea data-f="competences" placeholder="Une par ligne">${esc(F.competences || '')}</textarea></label>
          <label>Diplômes et certifications<textarea data-f="diplomes" placeholder="Une par ligne">${esc(F.diplomes || '')}</textarea></label>
          <label>Langues<input data-f="langues" value="${esc(F.langues || '')}" placeholder="Ex : arabe, français"></label>
          <label>Téléphone (facultatif)<input data-f="telephone" type="tel" value="${esc(F.telephone || '')}"></label>
          <label>Confidentialité<select data-f="visibilite"><option value="prive" ${F.visibilite !== 'orgs' ? 'selected' : ''}>Privé : visible par moi seulement</option><option value="orgs" ${F.visibilite === 'orgs' ? 'selected' : ''}>Visible par les organisations dont je suis membre</option></select></label>
          <button class="btn" data-a="psave">Enregistrer mon profil</button></div>`;
        $('[data-a=psave]', body).onclick = async () => {
          const v = {}; $$('[data-f]', body).forEach(x => { v[x.dataset.f] = x.value.trim(); }); v.experience = v.experience === '' ? null : +v.experience;
          try { await withTimeout(fs.collection('users').doc(S.user.uid).set({ profil: v }, { merge: true })); S.profil = { ...S.profil, ...v }; LS.set('profile', { ...(LS.get('profile') || {}), profil: S.profil }); toast('Profil enregistré ✓'); try { if (typeof ST !== 'undefined') ST.refreshRole(); } catch (e) {} } catch (e) { alertBox(errMsg(e)); }
        };
      }
      if (tab === 'abo') {
        const P = myPlan(), stt = planStateOf(S.company), nProj = projects.filter(p => !p.deleted).length, up = offersFor(true).filter(x => x.k !== P.k);
        body.innerHTML = `<div class="form">
          <div class="tm-box"><b>Mon abonnement <span class="st-state" style="--c:${stt.c}">${esc(stt.l)}</span></b>
            <div class="st-of-r"><span>Projets actifs</span><b>${nProj}${P.projects ? ' / ' + P.projects : ''}</b></div></div>
          ${offerCard(P, true, false)}
          ${up.length ? `<div class="tm-box"><b>Passer à un autre pack</b>${up.map(x => offerCard(x, true, false)).join('')}<button class="btn" data-a="askup">${isSuper() ? 'Activer' : 'Demander'} ${esc(up[0].l)}</button><button class="btn ghost" data-a="pcode">🎟 J'ai un code pack</button>
            <small class="muted">La facturation n'est pas encore en ligne : la demande part à SiteTeam, qui active le pack.</small></div>` : ''}</div>`;
        const pcb = $('[data-a=pcode]', body); if (pcb) pcb.onclick = () => applyPackCode();
        const a = $('[data-a=askup]', body); if (a) a.onclick = async () => { const k = isSuper() && up.length > 1 ? await menu('Quel pack ?', up.map(x => ({ label: `${x.e || ''} ${x.l} · ${planPrice(x)}`, value: x.k }))) : up[0].k; if (k) requestPack(k, true); };
      }
      if (tab === 'me') {
        const R = tmRoleOf(S.me.role), mine = await myShares();
        body.innerHTML = `<div class="tm-box tm-mecard">${av(S.me)}<div><b>${esc(S.me.name || '')}</b><small>${esc(S.user.email || '')}</small><small>${perso ? 'Propriétaire de cet espace personnel' + (metierOf((S.profil || {}).metier) ? ' · ' + esc(metierOf(S.profil.metier).l) + ' (métier)' : '') : esc(R.l) + ' · ' + esc(serviceOf(S.me.service).l)}</small></div></div>
          ${perso ? `<div class="tm-box"><b>Mes outils</b><p>Tous les outils de votre pack ${esc(myPlan().l)}, dans vos projets personnels. Dans une organisation, vos droits viennent de votre poste.</p></div>` : `<div class="tm-box"><b>Mes droits</b>${permTable(S.me.perms)}</div>`}
          <div class="tm-box"><b>📨 Accès externe reçu</b><p>Un client, un BET ou une autre entreprise vous a envoyé un code pour accéder à un seul de leurs projets ? Entrez-le ici — cela ne touche pas à « ${esc(S.company.name)} ».</p>
            <div class="btnrow" style="padding:0"><button class="btn ghost small" data-a="claim">Entrer un code</button></div>
            ${mine.length ? `<div class="list" style="margin-top:4px">${mine.map(x => `<div class="tm-inv" data-shcode="${esc(x.code)}"><span class="grow">${esc(x.projectName || '?')}<small>${esc(x.companyName || '')} · ${esc(shareEntityLabel(x.entity))}</small></span></div>`).join('')}</div>` : ''}</div>
          <button class="btn ghost" data-a="name">${icon('edit')} Modifier mon nom</button>
          <button class="btn danger" data-a="out">Se déconnecter</button>
          <button class="linkbtn tm-delacc" data-a="delacc">Supprimer mon compte…</button>`;
        $('[data-a=out]', body).onclick = logout;
        $('[data-a=delacc]', body).onclick = deleteAccount;
        $('[data-a=claim]', body).onclick = async () => { await claimShare(); draw(); };
        $$('[data-shcode]', body).forEach(r => r.onclick = () => { const x = mine.find(i => i.code === r.dataset.shcode); if (x) viewSharedAccess(x.code, x); });
        $('[data-a=name]', body).onclick = async () => { const r = await formSheet('Mon nom', [{ name: 'n', label: 'Nom et prénom', value: S.me.name || '' }]); if (r && r.n) { try { await auth.currentUser.updateProfile({ displayName: r.n }); if (isAdmin()) await fs.collection('companies').doc(S.cid).collection('members').doc(S.user.uid).update({ name: r.n }); S.me.name = r.n; LS.set('me', S.me); toast('Enregistré ✓'); draw(); } catch (e) { alertBox(errMsg(e)); } } };
      }
      const pb = $('[data-a=postes]', body); if (pb) pb.onclick = () => managePostes().then(draw);
      $$('[data-uid]', body).forEach(b => b.onclick = async () => {
        const m = S.members.find(x => x.uid === b.dataset.uid);
        // responsable direct (pas administrateur) : délégation de droits, missions
        if (!isAdmin()) { if (m.managerUid !== S.user.uid) return showMember(m);
          const v2 = await menu(m.name || m.email, [{ label: 'Missions', sub: 'ce dont la personne est chargée', icon: 'file', value: 'mis' }, { label: 'Droits et projets (délégation)', sub: 'sans dépasser les vôtres', icon: 'edit', value: 'del' }, { label: 'Voir', icon: 'team', value: 'see' }]);
          if (v2 === 'see') showMember(m); if (v2 === 'mis' && await editMissions(m)) draw(); if (v2 === 'del' && await delegate(m, projects)) { await refreshMembers(); draw(); } return; }
        const v = m.uid === S.user.uid ? 'edit' : await menu(m.name || m.email, [{ label: 'Poste, projets et droits', icon: 'edit', value: 'edit' }, { label: 'Missions', icon: 'file', value: 'mis' }, { label: 'Voir ses droits', icon: 'team', value: 'see' }, { label: 'Retirer de l\'entreprise', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'see') showMember(m);
        if (v === 'mis' && await editMissions(m)) draw();
        if (v === 'edit' && await editMember(m, projects)) { await refreshMembers(); draw(); }
        if (v === 'del' && await removeMember(m)) { await refreshMembers(); draw(); }
      });
    };
    await refreshMembers(); draw();
  }
  const permTable = (P = {}) => `<div class="tm-perms">${MODS.filter(([m]) => m !== 'files').map(([m, l]) => `<div><span>${l}</span><b class="lv${P[m] || 0}">${LEVELS[P[m] || 0]}</b></div>`).join('')}</div>`;
  const missionsHTML = (m) => (m.missions || []).length ? `<div class="tm-box"><b>Missions</b>${m.missions.map(x => `<div class="st-mis">• ${esc(x.t)}${x.by ? `<small>${esc((S.members.find(y => y.uid === x.by) || {}).name || '')}</small>` : ''}</div>`).join('')}</div>` : '';
  function showMember(m) { const R = tmRoleOf(m.role), boss = S.members.find(x => x.uid === m.managerUid); sheet(`<div class="tm-box tm-mecard"><div><b>${esc(m.name || '')}</b><small>${esc(m.email || '')}</small><small>${esc(R.l)} · ${esc(serviceOf(m.service).l)}${m.zone ? ' · ' + esc(m.zone) : ''}</small>${boss ? `<small>Sous la responsabilité de ${esc(boss.name || boss.email)}</small>` : ''}</div></div>${missionsHTML(m)}${permTable(m.perms)}`, { title: m.name || 'Membre' }); }
  // missions confiées par le responsable direct (ou un administrateur)
  async function editMissions(m) {
    let L = [...(m.missions || [])];
    for (;;) {
      const v = await menu(`Missions de ${m.name || m.email}`, [...L.map((x, i) => ({ label: x.t, icon: 'check', value: 'i' + i })), { label: 'Ajouter une mission', icon: 'plus', value: 'add' }, { label: 'Terminé', icon: 'close', value: 'ok' }]);
      if (!v || v === 'ok') break;
      if (v === 'add') { const r = await formSheet('Nouvelle mission', [{ name: 't', label: 'Mission', placeholder: 'Ex : Réception ferraillage Bloc A, suivi des essais labo…' }]); if (r && r.t) L.push({ t: r.t.trim(), by: S.user.uid, at: Date.now() }); continue; }
      const i = +v.slice(1); if (await confirmBox(`Retirer « ${L[i].t} » ?`, 'Retirer')) L.splice(i, 1);
    }
    if (JSON.stringify(L) === JSON.stringify(m.missions || [])) return false;
    try { await withTimeout(fs.collection('companies').doc(S.cid).collection('members').doc(m.uid).update({ missions: L })); m.missions = L; toast('Missions enregistrées ✓'); return true; } catch (e) { alertBox(errMsg(e)); return false; }
  }
  // délégation : le responsable ajuste les droits et projets de son équipe, sans dépasser les siens (le serveur vérifie)
  async function delegate(m, projects) {
    const mine = S.me.perms || {}, P = { ...(m.perms || {}) };
    const r = await new Promise((resolve) => {
      const sh = sheet(`<div class="form tm-form"><p class="muted" style="margin:0;font-size:12.5px">Vous pouvez donner jusqu'à votre propre niveau. Le poste ne change pas.</p>
        ${MODS.map(([k, l]) => `<label class="tm-pl"><span>${esc(l)}</span><select data-dm="${k}">${LEVELS.map((x, i) => `<option value="${i}" ${(+P[k] || 0) === i ? 'selected' : ''} ${i > (mine[k] || 0) ? 'disabled' : ''}>${x}</option>`).join('')}</select></label>`).join('')}
        <div class="fld">Projets</div>${projects.filter(p => S.me.allProjects || (S.me.projects || []).includes(p.id)).map(p => `<label class="tm-ck"><input type="checkbox" data-dp="${p.id}" ${m.allProjects || (m.projects || []).includes(p.id) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('')}
        <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="ok">Enregistrer</button></div></div>`, { title: `Délégation · ${m.name || m.email}` });
      sh.onClose = () => resolve(null);
      $('[data-a=c]', sh.el).onclick = () => sh.close();
      $('[data-a=ok]', sh.el).onclick = () => { const np = { ...P }; $$('[data-dm]', sh.el).forEach(x => { np[x.dataset.dm] = Math.min(+x.value, mine[x.dataset.dm] || 0); });
        sh.onClose = null; sh.close(); resolve({ perms: np, projects: $$('[data-dp]', sh.el).filter(x => x.checked).map(x => x.dataset.dp) }); };
    });
    if (!r) return false;
    try { await withTimeout(fs.collection('companies').doc(S.cid).collection('members').doc(m.uid).update({ perms: r.perms, allProjects: false, projects: r.projects })); toast('Droits mis à jour ✓'); return true; } catch (e) { alertBox(errMsg(e)); return false; }
  }
  // postes : renommer / désactiver les postes de base, créer des postes (sous un poste existant) — services ouverts seulement
  async function managePostes() {
    for (;;) {
      const L = [...TM_ROLES.filter(r => svcOpen(r.s) && r.s !== 'externe' && companyServices().some(x => x.k === r.s)).map(r => ({ ...r, ...(ROLE_CFG[r.k] || {}), base: true })), ...ROLE_CUSTOM.filter(r => svcOpen(r.s))]
        .sort((a, b) => (a.s || '').localeCompare(b.s || '') || (a.rank || 9) - (b.rank || 9));
      const v = await menu('Postes de l\'organisation', [...L.map(r => ({ label: `${'· '.repeat(Math.max(0, (r.rank || 3) - 1))}${r.l}${r.disabled ? ' (désactivé)' : ''}`, sub: `${serviceOf(r.s).l} · niveau ${r.rank || '—'}${r.custom ? ' · créé' : ''}`, icon: 'edit', value: r.k })), { label: 'Ajouter un poste', icon: 'plus', value: '__add' }, { label: 'Terminé', icon: 'close', value: '__ok' }]);
      if (!v || v === '__ok') return;
      const ref = (k) => fs.collection('companies').doc(S.cid).collection('postes').doc(k);
      try {
        if (v === '__add') {
          const svs = companyServices().filter(x => svcOpen(x.k) && x.k !== 'externe' && x.k !== 'perso');
          const r = await formSheet('Nouveau poste', [{ name: 'l', label: 'Nom du poste', placeholder: 'Ex : Chef de brigade qualité' },
            { name: 's', label: 'Service', type: 'select', value: svs.some(x => x.k === 'qualite') ? 'qualite' : (svs[0] || {}).k, options: svs.map(x => ({ value: x.k, label: x.l })) },
            { name: 'like', label: 'Sous le poste / interface de', type: 'select', value: 'respqualite', options: allRoles().filter(x => svcOpen(x.s) && !x.admin).map(x => ({ value: x.k, label: `${x.l} (niveau ${x.rank || '—'})` })) }], { okLabel: 'Créer le poste' });
          if (!r || !r.l) continue;
          const B = tmRoleOf(r.like), k = 'cp_' + Date.now().toString(36);
          const perms = Object.fromEntries(MODS.map(([m]) => [m, Math.min((B.perms || {})[m] || 0, 3)]));
          await ref(k).set({ l: r.l.trim(), s: r.s, like: r.like, rank: (B.rank || 3) + 1, perms, by: S.user.uid, at: ts() }); toast('Poste créé ✓');
        } else {
          const R = L.find(x => x.k === v), used = S.members.some(m => m.role === v);
          const a = await menu(R.l, [{ label: 'Renommer', icon: 'edit', value: 'ren' }, { label: R.disabled ? 'Réactiver' : 'Désactiver (plus proposé aux invitations)', icon: 'eye', value: 'dis' }, ...(R.custom && !used ? [{ label: 'Supprimer', icon: 'trash', danger: true, value: 'rm' }] : [])]);
          if (a === 'ren') { const r = await formSheet('Renommer le poste', [{ name: 'l', label: 'Nom', value: R.l }]); if (r && r.l) await ref(v).set({ l: r.l.trim() }, { merge: true }); }
          if (a === 'dis') await ref(v).set({ disabled: !R.disabled }, { merge: true });
          if (a === 'rm' && await confirmBox(`Supprimer le poste « ${R.l} » ?`, 'Supprimer')) await ref(v).delete();
        }
        await loadPostes();
      } catch (e) { alertBox(errMsg(e)); }
    }
  }
  function copyText(t) { navigator.clipboard.writeText(t).then(() => toast('Copié ✓'), () => alertBox(t)); }

  // formulaire commun : rôle, responsable, projets, zone, droits
  function memberForm(title, o, projects, okLabel) {
    return new Promise((resolve) => {
      const lim = !isAdmin(), P = myPlan(), svcs = companyServices(), mine = S.me || {};
      const cap = (pp) => lim ? Object.fromEntries(MODS.map(([m]) => [m, Math.min(+pp[m] || 0, (mine.perms || {})[m] || 0)])) : pp;
      if (lim && !mine.allProjects) { projects = projects.filter(p => (mine.projects || []).includes(p.id)); if (o.allProjects) { o = { ...o, allProjects: false }; } }
      const roles = allRoles().filter(r => !(lim && r.admin) && (!ROLE_LEGACY[r.k] || r.k === o.role));
      // le poste PROPOSE des droits, plafonnés à « Valider » : « Administrer » et le statut d'administrateur se donnent à part, avec confirmation
      const tpl = (k) => cap(Object.fromEntries(MODS.map(([m]) => [m, Math.min(tmRoleOf(k).perms[m] || 0, 3)])));
      if (!o.role) o = { ...o, role: (roles.find(r => svcOpen(r.s) && svcs.some(x => x.k === r.s) && r.k === 'techqualite') || roles.find(r => svcOpen(r.s) && svcs.some(x => x.k === r.s) && !r.admin) || roles[0]).k };
      if (lim && o.managerUid == null) o = { ...o, managerUid: mine.uid };
      const st = { role: o.role || 'conducteur', managerUid: o.managerUid || '', allProjects: o.allProjects !== false && !(o.projects || []).length, projects: [...(o.projects || [])], zone: o.zone || '', name: o.name || '', admin: !lim && !!o.admin, perms: o.perms ? cap({ ...o.perms }) : tpl(o.role || 'conducteur'), custom: false, postes: [...(o.postes || [])] };
      // plusieurs postes (v1.0.30) : poste principal + postes supplémentaires ; les droits proposés = le maximum de chaque poste
      const tplAll = () => [st.role, ...st.postes].reduce((a, k) => { const t = tpl(k); for (const m in t) a[m] = Math.max(a[m] || 0, t[m] || 0); return a; }, {});
      const s = sheet(`<div class="form tm-form">
        ${o.withName ? '<label>Nom (optionnel)<input data-f="name" placeholder="Ex : Youssef (chef de chantier zone 11)"></label>' : ''}
        <label>Poste<select data-f="role">${svcs.map(sv => `<optgroup label="${svcOpen(sv.k) ? '' : '🔒 '}${esc(sv.l)}">${roles.filter(r => r.s === sv.k).sort((a, b) => (a.rank || 9) - (b.rank || 9)).map(r => `<option value="${r.k}" ${!svcOpen(sv.k) && r.k !== o.role ? 'disabled' : ''}>${esc(r.l)}</option>`).join('')}</optgroup>`).join('')}</select></label>
        ${o.uid ? '<div class="fld">Postes supplémentaires</div><div class="tm-extra" data-extra></div><button type="button" class="btn ghost small" data-a="addposte">＋ Ajouter un poste</button>' : ''}
        <div ${P.hier ? '' : 'hidden'}><label>Responsable direct<select data-f="managerUid"><option value="">— aucun —</option>${S.members.filter(m => m.uid !== o.uid).map(m => `<option value="${m.uid}">${esc(m.name || m.email)} · ${esc(tmRoleOf(m.role).l)}</option>`).join('')}</select></label>
        <label>Zone / lot / niveau (périmètre)<input data-f="zone" placeholder="Ex : Zone 11, Lot gros œuvre…"></label></div>
        <div class="fld">Projets</div><label class="tm-ck" ${lim && !mine.allProjects ? 'hidden' : ''}><input type="checkbox" data-all> Tous les projets (actuels et futurs)</label>
        <div class="tm-projs">${projects.map(p => `<label class="tm-ck"><input type="checkbox" data-p="${p.id}"> ${esc(p.name)}</label>`).join('') || '<small class="muted">Aucun projet pour le moment</small>'}</div>
        <label class="tm-ck" ${lim ? 'hidden' : ''}><input type="checkbox" data-admin> Administrateur (gère les membres et les invitations)</label>
        ${lim ? '<small class="muted">Vous ne pouvez pas donner plus de droits ni plus de projets que les vôtres.</small>' : ''}
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
        $$('[data-pm]', pe).forEach(sel => sel.onchange = async () => { const m = sel.dataset.pm, v = +sel.value, was = +st.perms[m] || 0;
          if (v === 4 && was < 4 && !(await confirmBox(`Donner « Administrer » sur « ${(MODS.find(x => x[0] === m) || [m, m])[1]} » ?\nLa personne pourra tout modifier et supprimer dans cet outil.`, 'Donner Administrer'))) { sel.value = was; return; }
          st.perms[m] = v; st.perms = cap(st.perms); sel.value = st.perms[m]; st.custom = true; }); };
      const drawX = () => { const x = $('[data-extra]', E); if (!x) return; x.innerHTML = st.postes.length ? st.postes.map(k => `<span class="tm-xp">${esc(tmRoleOf(k).l)}<button type="button" data-xrm="${k}">✕</button></span>`).join('') : '<small class="muted">Aucun — la personne n\'a que son poste principal</small>';
        $$('[data-xrm]', x).forEach(b => b.onclick = () => { st.postes = st.postes.filter(k => k !== b.dataset.xrm); if (!st.custom) st.perms = tplAll(); drawX(); pedit(); }); };
      drawX();
      const ap = $('[data-a=addposte]', E); if (ap) ap.onclick = async () => { const L = roles.filter(r => !r.admin && r.k !== st.role && !st.postes.includes(r.k) && svcOpen(r.s) && svcs.some(x => x.k === r.s));
        const k = await menu('Poste supplémentaire', L.map(r => ({ label: `${(svcs.find(x => x.k === r.s) || {}).l || ''} › ${r.l}`, value: r.k }))); if (!k) return; st.postes.push(k); if (!st.custom) st.perms = tplAll(); drawX(); pedit(); };
      f('role').onchange = () => { st.role = f('role').value; st.postes = st.postes.filter(k => k !== st.role); st.perms = tplAll(); drawX(); pedit(); };
      $('[data-admin]', E).onchange = async (e) => { if (e.target.checked && !st.admin) { const ok = await confirmBox('Donner le statut Administrateur ?\nLa personne pourra gérer les membres, les codes d\'accès, les droits et les réglages de l\'organisation.', 'Donner le statut'); e.target.checked = ok; } st.admin = e.target.checked; };
      $('[data-a=perms]', E).onclick = () => { const pe = $('.tm-pedit', E); pe.hidden = !pe.hidden; pedit(); };
      $('[data-a=c]', E).onclick = () => s.close();
      $('[data-a=ok]', E).onclick = () => {
        const out = { name: f('name') ? f('name').value.trim() : undefined, role: f('role').value, managerUid: f('managerUid').value || null, zone: f('zone').value.trim(), allProjects: st.allProjects, projects: st.allProjects ? [] : st.projects, admin: !lim && $('[data-admin]', E).checked, perms: cap(st.perms), postes: st.postes };
        if (!out.allProjects && !out.projects.length && !confirm('Aucun projet coché : la personne ne verra aucun projet. Continuer ?')) return;
        s.onClose = null; s.close(); resolve(out);
      };
    });
  }
  async function inviteFlow() {
    if (!canInvite()) return null;
    if (!(await checkLimit('users'))) return null;
    const projects = (await DB.all('projects')).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const o = await memberForm('Inviter un membre', { withName: true, allProjects: true }, projects, 'Continuer');
    if (!o) return null;
    // récapitulatif : ce que la personne pourra voir et faire, avant de créer le code
    const R = tmRoleOf(o.role), on = MODS.filter(([m]) => (o.perms[m] || 0) > 0), pn = (id) => (projects.find(p => p.id === id) || {}).name || '?';
    const recap = `${o.name ? o.name + ' — ' : ''}${R.l} (${serviceOf(R.s).l})\nProjets : ${o.allProjects ? 'tous' : o.projects.map(pn).join(', ') || 'aucun'}\n${o.admin ? '⚠ Administrateur de l\'organisation\n' : ''}Outils (${on.length}) : ${on.map(([m, l]) => `${l.split(' (')[0]} ${['', 'voir', 'modifier', 'valider', 'ADMINISTRER'][o.perms[m]]}`).join(' · ') || 'aucun'}\nCode valable 7 jours, une seule fois.`;
    if (!(await confirmBox(recap, 'Créer le code'))) return null;
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
    const R = tmRoleOf(o.role);
    try {
      await withTimeout(ref.update({ role: R.k, service: R.s, managerUid: o.managerUid, zone: o.zone, allProjects: o.allProjects, projects: o.projects, admin: o.admin, perms: o.perms, ...(isAdmin() ? { postes: (o.postes || []).filter(k => k !== R.k) } : {}) }));
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

  // ---------- suppression du compte (exigée par Google Play pour une app avec création de compte) ----------
  // Supprime : l'accès (compte Firebase), le profil users/{uid}, l'appartenance à l'entreprise (nom, e-mail, droits).
  // Conserve : les données de chantier déjà partagées avec l'entreprise (elles appartiennent à l'entreprise).
  async function deleteAccount() {
    const others = S.members.filter(m => m.uid !== S.user.uid), otherAdmins = others.filter(m => m.admin);
    if (isAdmin() && others.length && !otherAdmins.length) return alertBox('Vous êtes le seul administrateur de « ' + S.company.name + ' ». Nommez d\'abord un autre administrateur (Membres › poste et droits), puis supprimez votre compte.');
    const ok = await confirmBox('Supprimer définitivement votre compte SiteTeam ?\n\n• Vous ne pourrez plus vous connecter avec ' + (S.user.email || 'cet e-mail') + '.\n• Votre profil et votre place dans « ' + S.company.name + ' » sont effacés.\n• Les réserves, PV, photos… déjà partagés restent à l\'entreprise.\n\nPensez à sauvegarder vos projets (Paramètres › Sauvegarder ce projet) avant.', 'Supprimer mon compte');
    if (!ok) return;
    const r = await formSheet('Confirmez avec votre mot de passe', [{ name: 'pw', label: 'Mot de passe', type: 'password' }], { okLabel: 'Supprimer définitivement' });
    if (!r || !r.pw) return;
    const ld = loading('Suppression du compte…');
    try {
      const u = auth.currentUser;
      await withTimeout(u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, r.pw)));
      if (!others.length) { try { await fs.collection('companies').doc(S.cid).update({ deleted: true, deletedAt: ts() }); } catch (e) { console.warn('company', e); } }
      await withTimeout(fs.collection('companies').doc(S.cid).collection('members').doc(u.uid).delete());
      // les autres espaces du compte (organisations rejointes) : on retire aussi sa place
      for (const w of (S.workspaces || []).filter(x => x.cid !== S.cid)) { try { await withTimeout(fs.collection('companies').doc(w.cid).collection('members').doc(u.uid).delete()); } catch (e) { console.warn('ws delete', e); } }
      await withTimeout(fs.collection('users').doc(u.uid).delete());
      S.ready = false;   // évite le rechargement automatique à la déconnexion, pour afficher la confirmation
      await withTimeout(u.delete());
      ['me', 'cid', 'company', 'members', 'profile', 'pullAt'].forEach(LS.del);
      ld.close(); await alertBox('Votre compte a été supprimé.'); location.reload();
    } catch (e) { ld.close(); alertBox('Suppression impossible : ' + errMsg(e)); }
  }

  // ---------- catalogue des outils (administrateurs) : ce qui est inclus, ce qui est disponible dans d'autres packs ----------
  // le menu de tous les jours ne montre que les outils autorisés ; les outils « disponibles ailleurs » ne se voient qu'ici
  function openCatalogue() {
    const P = myPlan(), T = orgType(), has = (Q, m) => Q.modules === '*' || Q.modules.includes(m), perso = isPerso();
    const rows = MODS.map(([m, l]) => { const inP = has(P, m), inT = T.mods === '*' || T.mods.includes(m);
      const where = Object.values(PLANS).filter(Q => has(Q, m)).map(Q => Q.l).join(', ');
      return `<div class="st-cat ${inP && inT ? 'on' : ''}"><span class="grow"><b>${esc(l)}</b><small>${inP ? (inT ? 'Inclus — visible selon le poste de chacun' : `Inclus, masqué pour « ${esc(T.l)} »`) : 'Disponible avec : ' + esc(where)}</small></span><i>${inP && inT ? '✓' : inP ? '–' : '🔒'}</i></div>`; }).join('');
    sheet(`<div class="st-catl"><p class="muted" style="margin:0 0 8px;font-size:12.5px">Pack ${esc(P.l)} · ${perso ? 'espace personnel' : esc(T.l)}. Les membres ne voient jamais les outils verrouillés : seulement ceux de leur poste.</p>${rows}</div>`, { title: 'Catalogue des outils' });
  }

  // ---------- services de l'organisation (cases à cocher) ----------
  function pickServices(cur) {
    return new Promise((resolve) => {
      let L = [...cur];
      const sh = sheet(`<div class="form"><div class="st-svcs">${TM_SERVICES.filter(x => x.k !== 'externe' && (!SERVICES_LEGACY.includes(x.k) || L.includes(x.k))).map(x => `<button data-s="${x.k}" class="${L.includes(x.k) ? 'on' : ''}" style="--c:${x.c}">${esc(x.l)}</button>`).join('')}</div>
        <small class="muted">Un service retiré reste visible tant qu'un membre y est rattaché.</small>
        <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="ok">Enregistrer</button></div></div>`, { title: 'Services de l\'organisation' });
      sh.onClose = () => resolve(null);
      const maxS = myPlan().services || 0;
      $$('[data-s]', sh.el).forEach(b => b.onclick = () => { const k = b.dataset.s;
        if (!L.includes(k) && maxS && L.filter(x => x !== 'externe').length >= maxS) return toast(`Pack ${myPlan().l} : ${maxS} services au maximum`);
        L = L.includes(k) ? L.filter(x => x !== k) : [...L, k]; b.classList.toggle('on'); });
      $('[data-a=c]', sh.el).onclick = () => sh.close();
      $('[data-a=ok]', sh.el).onclick = () => { sh.onClose = null; sh.close(); resolve(L); };
    });
  }

  // ---------- console Super Admin SiteTeam : packs, limites, pack de chaque organisation ----------
  async function superConsole() {
    if (!isSuper()) return;
    const el = document.createElement('div'); el.className = 'fullpage tm-page'; document.body.appendChild(el);
    const unBack = pushBack(() => el.remove());
    let tab = 'packs', orgs = null;
    const draw = async () => {
      el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:17px">🛡 Super Admin SiteTeam</h1></div>
        <div class="tm-tabs"><button data-t="packs" class="${tab === 'packs' ? 'on' : ''}">Packs & limites</button><button data-t="orgs" class="${tab === 'orgs' ? 'on' : ''}">Organisations</button><button data-t="cloud" class="${tab === 'cloud' ? 'on' : ''}">Stockage</button></div><div class="tm-body"></div>`;
      $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
      $$('[data-t]', el).forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
      const body = $('.tm-body', el);
      if (tab === 'packs') {
        body.innerHTML = `<div class="list">${Object.values(PLANS).map(P => `<button class="tm-mem" data-p="${P.k}"><span class="grow"><b>${esc(P.e || '')} ${esc(P.l)}</b><small>${esc(planPrice(P))} · ${esc(planUsers(P))} · ${P.projects ? P.projects + ' projet(s)' : 'projets illimités'} · ${P.storageGb} Go · ${P.modules === '*' ? 'tous les outils' : P.modules.length + ' outils'}${P.hier ? ' · hiérarchie' : ''}${P.shares ? ' · groupements' : ''}</small></span>${icon('edit')}</button>`).join('')}</div>
          <p class="muted" style="padding:0 16px;font-size:12.5px">Les changements s'appliquent à tous les téléphones à leur prochaine ouverture, sans nouvelle version.</p>`;
        $$('[data-p]', body).forEach(b => b.onclick = async () => { if (await editPack(PLANS[b.dataset.p])) draw(); });
      }
      if (tab === 'cloud') {
        const C = cloudCfg();
        body.innerHTML = `<div class="tm-box"><b>🗂 Fichiers partagés (Cloud Storage)</b>
            <p>Quand c'est activé, les plans, photos et PDF sont envoyés dans Firebase Storage et arrivent sur les téléphones de l'équipe et des organisations partenaires (selon leurs droits).</p>
            <p>Avant d'activer : projet Firebase en formule <b>Blaze</b> avec une alerte de budget, Storage créé, règles Storage publiées.</p>
            <label class="tm-ck"><input type="checkbox" data-c="on" ${C.on ? 'checked' : ''}> Activer l'envoi des fichiers</label>
            <label>Taille maximale par fichier (Mo)<input type="number" inputmode="numeric" min="1" max="50" data-c="max" value="${C.maxMb || 50}"></label>
            <div class="btnrow" style="padding:0"><button class="btn" data-a="csave">Enregistrer</button><button class="btn ghost small" data-a="crules">Copier les règles Storage</button></div></div>`;
        $('[data-a=crules]', body).onclick = () => copyText(STORAGE_RULES);
        $('[data-a=csave]', body).onclick = async () => {
          const v = { storage: $('[data-c=on]', body).checked, maxMb: Math.min(50, Math.max(1, +$('[data-c=max]', body).value || 50)) };
          if (v.storage && !C.on && !await confirmBox('Activer l\'envoi des fichiers vers Firebase Storage ?\nVérifiez que la formule Blaze, l\'alerte de budget et les règles Storage sont en place.', 'Activer')) return;
          try { await withTimeout(fs.collection('config').doc('services').set(v, { merge: true })); LS.set('cloud', { on: v.storage, maxMb: v.maxMb }); toast(v.storage ? 'Fichiers partagés activés ✓' : 'Fichiers partagés désactivés'); draw(); }
          catch (e) { alertBox(errMsg(e)); }
        };
      }
      if (tab === 'orgs') {
        if (!orgs) { body.innerHTML = '<div class="empty">Chargement…</div>'; try { const q = await withTimeout(fs.collection('companies').limit(300).get(), 20000); orgs = q.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')); } catch (e) { body.innerHTML = `<div class="empty">${esc(errMsg(e))}<br>Les règles Firestore v1.0.14 sont-elles publiées ?</div>`; return; } }
        body.innerHTML = orgs.length ? `<div class="list">${orgs.map(o => { const T = orgTypeOf(o.orgType || (o.kind === 'perso' ? 'independant' : 'entreprise')); return `<button class="tm-mem" data-o="${o.id}"><span class="grow"><b>${esc(o.name || '?')}</b><small>${o.kind === 'perso' ? 'Espace personnel' : T.e + ' ' + esc(T.l)} · pack ${esc(planOf(o.plan || PLAN_DEFAULT_COMPANY).l)} · ${esc(planStateOf(o).l)}</small></span>${icon('edit')}</button>`; }).join('')}</div>` : '<div class="empty">Aucune organisation.</div>';
        $$('[data-o]', body).forEach(b => b.onclick = async () => {
          const o = orgs.find(x => x.id === b.dataset.o), cur = planOf(o.plan || PLAN_DEFAULT_COMPANY).k;
          const k = await menu(`${o.name} : pack`, Object.values(PLANS).map(P => ({ label: `${P.e || ''} ${P.l} · ${planPrice(P)}`, value: P.k, checked: P.k === cur })));
          if (!k) return; const stt = await menu('Statut', [{ label: 'Gratuit', value: 'gratuit' }, { label: 'Essai (14 jours de plus)', value: 'essai' }, { label: 'Actif (payé)', value: 'actif' }, { label: 'Suspendu', value: 'suspendu' }]); if (!stt) return;
          try { const extra = stt === 'essai' ? { trialEndsAt: firebase.firestore.Timestamp.fromMillis(Date.now() + 14 * 864e5) } : {}; Object.assign(o, extra); await fs.collection('companies').doc(o.id).update({ plan: k, planStatus: stt, ...extra }); o.plan = k; o.planStatus = stt; if (o.id === S.cid) { S.company.plan = k; S.company.planStatus = stt; LS.set('company', S.company); } toast('Pack mis à jour ✓'); draw(); } catch (e) { alertBox(errMsg(e)); }
        });
      }
    };
    draw();
  }
  function editPack(P) {
    return new Promise((resolve) => {
      const all = P.modules === '*', mods = all ? MODS.map(([m]) => m) : [...P.modules];
      const num = (k, l, v, ph = '') => `<label>${l}<input type="number" inputmode="numeric" min="0" data-n="${k}" value="${v == null ? '' : v}" placeholder="${ph}"></label>`;
      const sh = sheet(`<div class="form">
        <label>Nom affiché<input data-f="l" value="${esc(P.l)}"></label>
        <label>Pour qui<input data-f="for" value="${esc(P.for || '')}"></label>
        ${num('price', 'Prix (MAD/mois) — vide = sur devis', P.price, 'sur devis')}
        ${num('users', 'Comptes inclus (0 = illimité)', P.users)}${num('extraUserPrice', 'Prix par compte supplémentaire (vide = bloqué)', P.extraUserPrice)}
        ${num('projects', 'Projets (0 = illimité)', P.projects)}${num('storageGb', 'Stockage (Go)', P.storageGb)}
        <div class="fld">Si utilisé par une organisation (vide = mêmes valeurs)</div>
        ${num('orgUsers', 'Comptes (organisation)', (P.org || {}).users)}${num('orgProjects', 'Projets (organisation)', (P.org || {}).projects)}${num('orgServices', 'Services max (organisation, 0 = illimité)', (P.org || {}).services)}
        <label class="tm-ck"><input type="checkbox" data-b="perso" ${P.perso ? 'checked' : ''}> Proposé pour l'espace personnel</label>
        <label class="tm-ck"><input type="checkbox" data-b="hier" ${P.hier ? 'checked' : ''}> Hiérarchie (responsable direct, zones)</label>
        <label class="tm-ck"><input type="checkbox" data-b="shares" ${P.shares ? 'checked' : ''}> Groupements / partage avec d'autres organisations</label>
        <div class="fld">Outils inclus</div><label class="tm-ck"><input type="checkbox" data-all ${all ? 'checked' : ''}> Tous les outils (y compris les futurs)</label>
        <div class="tm-projs">${MODS.map(([m, l]) => `<label class="tm-ck"><input type="checkbox" data-m="${m}" ${mods.includes(m) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>
        <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="ok">Enregistrer</button></div></div>`, { title: `Pack ${P.l}` });
      sh.onClose = () => resolve(false);
      const E = sh.el, sync = () => $$('[data-m]', E).forEach(c => { c.disabled = $('[data-all]', E).checked; });
      sync(); $('[data-all]', E).onchange = sync;
      $('[data-a=c]', E).onclick = () => sh.close();
      $('[data-a=ok]', E).onclick = async () => {
        const n = (k) => { const v = $(`[data-n=${k}]`, E).value.trim(); return v === '' ? null : Math.max(0, +v || 0); };
        const v = { l: $('[data-f=l]', E).value.trim() || P.l, for: $('[data-f=for]', E).value.trim(), e: P.e || '', period: P.period || 'mois',
          price: n('price'), users: n('users') || 0, extraUserPrice: n('extraUserPrice'), projects: n('projects') || 0, storageGb: n('storageGb') || 0,
          perso: $('[data-b=perso]', E).checked, hier: $('[data-b=hier]', E).checked, shares: $('[data-b=shares]', E).checked,
          modules: $('[data-all]', E).checked ? '*' : $$('[data-m]', E).filter(c => c.checked).map(c => c.dataset.m) };
        if (v.extraUserPrice == null) delete v.extraUserPrice;
        const og = { users: n('orgUsers'), projects: n('orgProjects'), services: n('orgServices') }; Object.keys(og).forEach(k => og[k] == null && delete og[k]);
        v.org = Object.keys(og).length ? og : null;
        try { await withTimeout(fs.collection('config').doc('plans').set({ [P.k]: v }, { merge: true })); applyPlanCfg({ [P.k]: v }); LS.set('plansCfg', { ...(LS.get('plansCfg') || {}), [P.k]: v });
          toast('Pack enregistré ✓'); sh.onClose = null; sh.close(); resolve(true); } catch (e) { alertBox(errMsg(e) + (e.code === 'permission-denied' ? '\n\nPubliez d\'abord les règles Firestore v1.0.14.' : '')); }
      };
    });
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
    boot, push, pull, resetPull, lvl, canSection, canProject, isAdmin, openCompany, taille, secureApply, secureOn, inviteFlow, logout, decorateSection, removeMember, refreshMembers,
    isSuper, superConsole, orgType, isPerso, companyServices, canInvite, checkLimit, plan: myPlan, openCatalogue, openSwitcher, switchTo, workspaces: () => S.workspaces || [],
    profil: () => S.profil || {}, planState: () => planStateOf(S.company), collabFlow, isCollab, canValidateForm, svcOpen,
    openProjectShares, claimShare, openPartners, renderHistory, sharedOf, joinWithCode,
    cloudOn, canCloud, cloudUpload, cloudDownload, cloudRemove, cloudCfg, storageRules: STORAGE_RULES,
    appCfg, isOff, checkAnnonces, requestPack, logError, applyPackCode, isFree, askPoste,
    ready: () => S.ready, me: () => S.me, uid: () => S.user && S.user.uid, company: () => S.company, members: () => S.members, rules: FIRESTORE_RULES,
  };
})();
