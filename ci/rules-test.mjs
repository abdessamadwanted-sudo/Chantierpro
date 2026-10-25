// Test des règles Firestore unifiées (SiteTeam + licences de l'application Chantier) contre l'émulateur.
// Lancé par .github/workflows/st-test.yml (branche siteteam-ci). Résultat : ci-out/rules-test.txt
import fs from 'fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const O = 'ci-out'; fs.mkdirSync(O, { recursive: true });
const out = []; let fails = 0;
const log = (s) => { console.log(s); out.push(s); };
async function t(name, fn) {
  try { await fn(); log('OK   ' + name); } catch (e) { fails++; log('FAIL ' + name + ' :: ' + (e && e.message ? e.message.split('\n')[0] : e)); }
}

const env = await initializeTestEnvironment({
  projectId: 'siteteam',
  firestore: { rules: fs.readFileSync('ci/firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  storage: { rules: fs.readFileSync('ci/storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
});
await env.clearFirestore();

const OWNER = { uid: 'owner1', email: 'abdessamad.daga94@gmail.com' };
const OTHER = { uid: 'other1', email: 'quelquun@test.ma' };
const owner = env.authenticatedContext(OWNER.uid, { email: OWNER.email }).firestore();
const other = env.authenticatedContext(OTHER.uid, { email: OTHER.email }).firestore();
const anon = env.unauthenticatedContext().firestore();

// données de départ (règles désactivées)
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await db.collection('licences').doc('CH-ACTIVE01').set({ ownerUid: OWNER.uid, status: 'active', name: 'Ami', device: null });
  await db.collection('licences').doc('CH-USED0001').set({ ownerUid: OWNER.uid, status: 'active', name: 'Ami 2', device: { id: 'tel-A', model: 'X' } });
  await db.collection('licences').doc('CH-OFF00001').set({ ownerUid: OWNER.uid, status: 'disabled', name: 'Ami 3' });
  await db.collection('licences').doc('CH-ACTIVE01').collection('suivi').doc('projects__p1').set({ store: 'projects', updatedAt: 1 });
  await db.collection('companies').doc('c1').set({ name: 'BTP', ownerUid: 'x' });
  await db.collection('companies').doc('c1').collection('members').doc('m1').set({ name: 'Membre 1', admin: false, perms: {}, allProjects: false, projects: [] });
  await db.collection('companies').doc('c1').collection('members').doc('m2').set({ name: 'Membre 2', admin: false, perms: {}, allProjects: false, projects: [] });
  await db.collection('shares').doc('SHARE001').set({ cid: 'c1', pid: 'p1', used: true, usedBy: 'ext1', ops: { view: true, comment: true }, responses: [{ byName: 'Admin', text: 'Bonjour', at: 1 }] });
  await db.collection('shares').doc('SHARE002').set({ cid: 'c1', pid: 'p1', used: true, usedBy: 'ext1', ops: { view: true, comment: false }, responses: [] });
});

// --- téléphone activé par code (sans compte Firebase)
await t('code : lecture de la licence sans compte', () => assertSucceeds(anon.collection('licences').doc('CH-ACTIVE01').get()));
await t('code : activation (device, accepted, lastSeen, version)', () => assertSucceeds(anon.collection('licences').doc('CH-ACTIVE01').update({ device: { id: 'tel-1', model: 'M' }, accepted: true, lastSeen: 1, version: '1.0.123' })));
await t('code : vérification périodique (même téléphone)', () => assertSucceeds(anon.collection('licences').doc('CH-USED0001').update({ lastSeen: 2, version: '1.0.123', device: { id: 'tel-A', model: 'X' } })));
await t('code : REFUS de prendre une licence déjà liée à un autre téléphone', () => assertFails(anon.collection('licences').doc('CH-USED0001').update({ device: { id: 'tel-B', model: 'Y' }, lastSeen: 3 })));
await t('code : REFUS de se réactiver soi-même (status)', () => assertFails(anon.collection('licences').doc('CH-OFF00001').update({ status: 'active' })));
await t('code : REFUS de changer ses fonctions', () => assertFails(anon.collection('licences').doc('CH-ACTIVE01').update({ features: { all: true } })));
await t('code : envoi du suivi (licence active)', () => assertSucceeds(anon.collection('licences').doc('CH-ACTIVE01').collection('suivi').doc('tasks__t1').set({ store: 'tasks', updatedAt: 5 })));
await t('code : REFUS d\'envoi du suivi (licence suspendue)', () => assertFails(anon.collection('licences').doc('CH-OFF00001').collection('suivi').doc('tasks__t1').set({ store: 'tasks' })));
await t('code : REFUS de lire le suivi', () => assertFails(anon.collection('licences').doc('CH-ACTIVE01').collection('suivi').get()));
await t('sans compte : REFUS de lister toutes les licences', () => assertFails(anon.collection('licences').get()));
await t('sans compte : REFUS de créer une licence', () => assertFails(anon.collection('licences').doc('CH-NEW00001').set({ ownerUid: 'x', status: 'active' })));

// --- propriétaire
await t('propriétaire : créer une licence', () => assertSucceeds(owner.collection('licences').doc('CH-NEW00002').set({ ownerUid: OWNER.uid, status: 'active', name: 'Nouveau' })));
await t('propriétaire : lister ses licences', () => assertSucceeds(owner.collection('licences').where('ownerUid', '==', OWNER.uid).get()));
await t('propriétaire : suspendre / modifier', () => assertSucceeds(owner.collection('licences').doc('CH-ACTIVE01').update({ status: 'disabled', features: { a: 1 } })));
await t('propriétaire : lire le suivi', () => assertSucceeds(owner.collection('licences').doc('CH-ACTIVE01').collection('suivi').get()));
await t('propriétaire : supprimer le suivi puis la licence', async () => {
  await assertSucceeds(owner.collection('licences').doc('CH-ACTIVE01').collection('suivi').doc('projects__p1').delete());
  await assertSucceeds(owner.collection('licences').doc('CH-NEW00002').delete());
});

// --- autre compte connecté (ex. utilisateur SiteTeam)
await t('autre compte : REFUS de créer une licence', () => assertFails(other.collection('licences').doc('CH-NEW00003').set({ ownerUid: OTHER.uid, status: 'active' })));
await t('autre compte : REFUS de lister les licences du propriétaire', () => assertFails(other.collection('licences').where('ownerUid', '==', OWNER.uid).get()));
await t('autre compte : REFUS de modifier une licence', () => assertFails(other.collection('licences').doc('CH-USED0001').update({ status: 'revoked' })));
await t('autre compte : REFUS de lire le suivi', () => assertFails(other.collection('licences').doc('CH-USED0001').collection('suivi').get()));

// --- SiteTeam reste protégé
await t('sans compte : REFUS de lire une entreprise SiteTeam', () => assertFails(anon.collection('companies').doc('c1').get()));
await t('autre compte : REFUS de lire une entreprise SiteTeam dont il n\'est pas membre', () => assertFails(other.collection('companies').doc('c1').get()));
await t('Super Admin (propriétaire) : lecture d\'une organisation', () => assertSucceeds(owner.collection('companies').doc('c1').get()));

// --- suppression de compte : un membre peut retirer sa propre appartenance, pas celle d'un autre
const m1 = env.authenticatedContext('m1', { email: 'm1@test.ma' }).firestore();
await t('membre : REFUS de supprimer un autre membre', () => assertFails(m1.collection('companies').doc('c1').collection('members').doc('m2').delete()));
await t('membre : supprimer sa propre appartenance (suppression de compte)', () => assertSucceeds(m1.collection('companies').doc('c1').collection('members').doc('m1').delete()));

// --- partage externe : le destinataire ajoute une réponse, sans effacer les précédentes
const ext = env.authenticatedContext('ext1', { email: 'ext@test.ma' }).firestore();
const R0 = { byName: 'Admin', text: 'Bonjour', at: 1 };
await t('partage : ajouter une réponse', () => assertSucceeds(ext.collection('shares').doc('SHARE001').update({ responses: [R0, { byName: 'BET', text: 'Vu', at: 2 }] })));
await t('partage : REFUS d\'effacer l\'historique des réponses', () => assertFails(ext.collection('shares').doc('SHARE001').update({ responses: [{ byName: 'BET', text: 'remplacé', at: 3 }] })));
await t('partage : REFUS de modifier une réponse existante', () => assertFails(ext.collection('shares').doc('SHARE001').update({ responses: [{ byName: 'Admin', text: 'modifié', at: 1 }, { byName: 'BET', text: 'Vu', at: 2 }, { byName: 'BET', text: 'x', at: 4 }] })));
await t('partage : REFUS de répondre si « répondre » n\'est pas autorisé', () => assertFails(ext.collection('shares').doc('SHARE002').update({ responses: [{ byName: 'BET', text: 'x', at: 2 }] })));
await t('partage : REFUS de changer le périmètre', () => assertFails(ext.collection('shares').doc('SHARE001').update({ scope: 'tout le projet' })));

// --- v1.0.14 : codes d'accès par une personne autorisée, expiration, pack verrouillé, config Super Admin
const ALL4 = { projet: 4, plans: 4, reserves: 4, reception: 4, photos: 4, forms: 4, rapports: 4, constats: 4, calc: 4, equipe: 4, files: 4, topo: 4, centrale: 4, materiel: 4, pointage: 4, hse: 4, finance: 4 };
const CHEF = { projet: 2, plans: 2, reserves: 3, reception: 2, photos: 2, forms: 2, rapports: 2, constats: 2, calc: 1, equipe: 3, files: 2, topo: 0, centrale: 0, materiel: 0, pointage: 2, hse: 1, finance: 0 };
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore(), co = db.collection('companies').doc('c2');
  await co.set({ name: 'Business SARL', ownerUid: 'adm2', plan: 'business', planStatus: 'essai' });
  await co.collection('members').doc('adm2').set({ name: 'Admin', admin: true, perms: ALL4, allProjects: true, projects: [] });
  await co.collection('members').doc('chef2').set({ name: 'Chef', admin: false, perms: CHEF, allProjects: false, projects: ['p1'] });
  await co.collection('members').doc('low2').set({ name: 'Ouvrier', admin: false, perms: { ...CHEF, equipe: 2 }, allProjects: false, projects: ['p1'] });
  const base = { cid: 'c2', role: 'chefequipe', service: 'travaux', perms: { projet: 1 }, admin: false, allProjects: false, projects: [], used: false };
  await db.collection('invites').doc('EXPIRED1').set({ ...base, expiresAt: new Date(Date.now() - 864e5) });
  await db.collection('invites').doc('LIVE0001').set({ ...base, expiresAt: new Date(Date.now() + 864e5) });
  await db.collection('invites').doc('OLDNOEXP').set({ ...base });
});
const adm2 = env.authenticatedContext('adm2', { email: 'adm2@test.ma' }).firestore();
const chef2 = env.authenticatedContext('chef2', { email: 'chef2@test.ma' }).firestore();
const low2 = env.authenticatedContext('low2', { email: 'low2@test.ma' }).firestore();
const inv = (who, extra) => ({ cid: 'c2', companyName: 'Business SARL', name: 'X', role: 'chefequipe', service: 'travaux', perms: { projet: 1, reserves: 2, equipe: 1 }, admin: false, allProjects: false, projects: ['p1'], used: false, needsApproval: true, createdBy: who, ...extra });
await t('code : personne autorisée (Équipe = Valider) crée un code dans ses droits', () => assertSucceeds(chef2.collection('invites').doc('CHEFOK01').set(inv('chef2'))));
await t('code : REFUS d\'un code sans approbation créé par un non-administrateur', () => assertFails(chef2.collection('invites').doc('CHEFKO09').set(inv('chef2', { needsApproval: false }))));
await t('code : REFUS de donner plus de droits que les siens', () => assertFails(chef2.collection('invites').doc('CHEFKO01').set(inv('chef2', { perms: { projet: 4 } }))));
await t('code : REFUS de créer un administrateur', () => assertFails(chef2.collection('invites').doc('CHEFKO02').set(inv('chef2', { admin: true }))));
await t('code : REFUS de donner un projet qu\'on n\'a pas', () => assertFails(chef2.collection('invites').doc('CHEFKO03').set(inv('chef2', { projects: ['p9'] }))));
await t('code : REFUS de donner « tous les projets » sans les avoir', () => assertFails(chef2.collection('invites').doc('CHEFKO04').set(inv('chef2', { allProjects: true, projects: [] }))));
await t('code : REFUS de clés de droits inconnues', () => assertFails(chef2.collection('invites').doc('CHEFKO05').set(inv('chef2', { perms: { projet: 1, superpouvoir: 1 } }))));
await t('code : REFUS si « Équipe » < Valider', () => assertFails(low2.collection('invites').doc('LOWKO001').set(inv('low2'))));
await t('code : REFUS de signer au nom d\'un autre (createdBy)', () => assertFails(chef2.collection('invites').doc('CHEFKO06').set(inv('adm2'))));
await t('code : l\'administrateur donne tous les droits', () => assertSucceeds(adm2.collection('invites').doc('ADMOK001').set(inv('adm2', { perms: ALL4, admin: true, allProjects: true, projects: [] }))));
await t('code : la personne autorisée liste ses propres codes', () => assertSucceeds(chef2.collection('invites').where('cid', '==', 'c2').where('createdBy', '==', 'chef2').get()));
await t('code : REFUS de lister les codes des autres', () => assertFails(chef2.collection('invites').where('cid', '==', 'c2').get()));
await t('code : supprimer son propre code', () => assertSucceeds(chef2.collection('invites').doc('CHEFOK01').delete()));
const nu = (uid) => env.authenticatedContext(uid, { email: uid + '@test.ma' }).firestore();
const join = (uid, code) => nu(uid).collection('companies').doc('c2').collection('members').doc(uid).set({ name: uid, role: 'chefequipe', perms: { projet: 1 }, admin: false, allProjects: false, projects: [], invite: code });
await t('rejoindre : REFUS avec un code expiré', () => assertFails(join('newA', 'EXPIRED1')));
await t('rejoindre : code valide', () => assertSucceeds(join('newB', 'LIVE0001')));
await t('rejoindre : ancien code sans date d\'expiration accepté', () => assertSucceeds(join('newC', 'OLDNOEXP')));
await t('code expiré : REFUS de le marquer utilisé', () => assertFails(nu('newA').collection('invites').doc('EXPIRED1').update({ used: true, usedBy: 'newA', usedAt: 1 })));
await t('pack : REFUS que l\'admin change son pack', () => assertFails(adm2.collection('companies').doc('c2').update({ plan: 'enterprise' })));
await t('pack : REFUS que l\'admin change le statut du pack', () => assertFails(adm2.collection('companies').doc('c2').update({ planStatus: 'actif' })));
await t('pack : l\'admin change le nom / type / services', () => assertSucceeds(adm2.collection('companies').doc('c2').update({ name: 'Business SA', orgType: 'bet', services: ['direction'] })));
await t('Super Admin : changer le pack d\'une organisation', () => assertSucceeds(owner.collection('companies').doc('c2').update({ plan: 'enterprise', planStatus: 'actif' })));
await t('Super Admin : lister les organisations', () => assertSucceeds(owner.collection('companies').get()));
await t('autre compte : REFUS de lister les organisations', () => assertFails(other.collection('companies').get()));
await t('config : tout compte connecté lit les packs', () => assertSucceeds(other.collection('config').doc('plans').get()));
await t('config : REFUS d\'écriture (non Super Admin)', () => assertFails(adm2.collection('config').doc('plans').set({ basic: { users: 999 } })));
await t('config : le Super Admin modifie les packs', () => assertSucceeds(owner.collection('config').doc('plans').set({ basic: { users: 5 } }, { merge: true })));
await t('config : REFUS de lecture sans compte', () => assertFails(anon.collection('config').doc('plans').get()));
await t('création : REFUS de créer une organisation déjà « actif » (payé)', () => assertFails(nu('newE').collection('companies').doc('c4').set({ name: 'X', ownerUid: 'newE', plan: 'enterprise', planStatus: 'actif' })));
await t('pack : REFUS que l\'admin prolonge son essai', () => assertFails(adm2.collection('companies').doc('c2').update({ trialEndsAt: new Date(Date.now() + 99 * 864e5) })));
await t('création : une organisation avec type et services', () => assertSucceeds(nu('newD').collection('companies').doc('c3').set({ name: 'Labo', ownerUid: 'newD', plan: 'basic', planStatus: 'essai', kind: 'org', orgType: 'labo', services: ['direction', 'labo'] })));

// --- v1.0.17 : révocation, demandes avec approbation, collaborateurs d'un espace personnel Pro
const ALL0 = Object.fromEntries(Object.keys(ALL4).map(k => [k, 0]));
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  const base = { cid: 'c2', role: 'chefequipe', service: 'travaux', perms: { projet: 1 }, admin: false, allProjects: false, projects: [], used: false };
  await db.collection('invites').doc('REVOKED1').set({ ...base, status: 'revoque' });
  await db.collection('invites').doc('APPRV001').set({ ...base, needsApproval: true, expiresAt: new Date(Date.now() + 864e5) });
  await db.collection('companies').doc('pro1').set({ name: 'Espace de Hamid', ownerUid: 'own3', plan: 'pro', planStatus: 'essai', kind: 'perso' });
  await db.collection('companies').doc('pro1').collection('members').doc('own3').set({ name: 'Hamid', admin: true, perms: ALL4, allProjects: true, projects: [], role: 'proprietaire' });
  await db.collection('companies').doc('bas1').set({ name: 'Espace de Karim', ownerUid: 'own4', plan: 'basic', planStatus: 'gratuit', kind: 'perso' });
  await db.collection('companies').doc('bas1').collection('members').doc('own4').set({ name: 'Karim', admin: true, perms: ALL4, allProjects: true, projects: [], role: 'proprietaire' });
});
await t('révoquer : le créateur révoque son propre code', async () => { await assertSucceeds(chef2.collection('invites').doc('CHEFRV01').set(inv('chef2'))); await assertSucceeds(chef2.collection('invites').doc('CHEFRV01').update({ status: 'revoque', revokedAt: 1 })); });
await t('révoquer : REFUS par un autre membre', async () => { await assertSucceeds(chef2.collection('invites').doc('CHEFRV02').set(inv('chef2'))); await assertFails(low2.collection('invites').doc('CHEFRV02').update({ status: 'revoque', revokedAt: 1 })); });
await t('rejoindre : REFUS avec un code révoqué', () => assertFails(join('newG', 'REVOKED1')));
await t('approbation : REFUS d\'entrer directement avec un code « avec approbation »', () => assertFails(join('newF', 'APPRV001')));
const nf = nu('newF');
await t('approbation : déposer sa demande', () => assertSucceeds(nf.collection('companies').doc('c2').collection('requests').doc('newF').set({ code: 'APPRV001', status: 'attente', name: 'F' })));
await t('approbation : REFUS de s\'accepter soi-même', () => assertFails(nf.collection('companies').doc('c2').collection('requests').doc('newF').update({ status: 'acceptee' })));
await t('approbation : REFUS d\'une demande « acceptée » dès la création', () => assertFails(nu('newH').collection('companies').doc('c2').collection('requests').doc('newH').set({ code: 'APPRV001', status: 'acceptee' })));
await t('approbation : l\'administrateur accepte', () => assertSucceeds(adm2.collection('companies').doc('c2').collection('requests').doc('newF').update({ status: 'acceptee' })));
await t('approbation : l\'administrateur crée le membre', () => assertSucceeds(adm2.collection('companies').doc('c2').collection('members').doc('newF').set({ name: 'F', role: 'chefequipe', perms: { projet: 1 }, admin: false, allProjects: false, projects: [] })));
const own3 = env.authenticatedContext('own3', { email: 'own3@test.ma' }).firestore(), own4 = env.authenticatedContext('own4', { email: 'own4@test.ma' }).firestore();
const col = (who, cid, extra) => ({ cid, role: 'collaborateur', service: 'perso', perms: { ...ALL0, projet: 1, reserves: 2, photos: 2 }, admin: false, allProjects: false, projects: ['pp1'], used: false, status: 'valide', needsApproval: false, createdBy: who, ...extra });
await t('collaborateur (Pro) : code sur un projet, au plus Modifier', () => assertSucceeds(own3.collection('invites').doc('COLLOK01').set(col('own3', 'pro1'))));
await t('collaborateur : REFUS du niveau Valider', () => assertFails(own3.collection('invites').doc('COLLKO01').set(col('own3', 'pro1', { perms: { ...ALL0, reserves: 3 } }))));
await t('collaborateur : REFUS de deux projets', () => assertFails(own3.collection('invites').doc('COLLKO02').set(col('own3', 'pro1', { projects: ['pp1', 'pp2'] }))));
await t('collaborateur : REFUS de tous les projets', () => assertFails(own3.collection('invites').doc('COLLKO03').set(col('own3', 'pro1', { allProjects: true, projects: [] }))));
await t('collaborateur : REFUS d\'un administrateur', () => assertFails(own3.collection('invites').doc('COLLKO04').set(col('own3', 'pro1', { admin: true }))));
await t('collaborateur : REFUS d\'un autre poste qu\'« collaborateur »', () => assertFails(own3.collection('invites').doc('COLLKO05').set(col('own3', 'pro1', { role: 'conducteur' }))));
await t('collaborateur : REFUS en pack Basic', () => assertFails(own4.collection('invites').doc('COLLKO06').set(col('own4', 'bas1'))));

// --- v1.0.18 : service Qualité — délégation en cascade, postes, validation des PV
const Q = (f, e) => ({ ...ALL0, projet: 2, forms: f, equipe: e, files: 2 });
await env.withSecurityRulesDisabled(async (c) => {
  const co = c.firestore().collection('companies').doc('c5');
  await co.set({ name: 'Qualité SA', ownerUid: 'adq', plan: 'enterprise', planStatus: 'essai' });
  const M = (uid, d) => co.collection('members').doc(uid).set({ name: uid, admin: false, allProjects: false, projects: ['p5'], ...d });
  await M('adq', { admin: true, perms: ALL4, allProjects: true, projects: [] });
  await M('dq', { role: 'dirqualite', perms: Q(4, 4) });
  await M('rq', { role: 'respqualite', perms: Q(3, 3), managerUid: 'dq' });
  await M('rq2', { role: 'respqualite', perms: Q(3, 3), managerUid: 'dq' });
  await M('tq', { role: 'techqualite', perms: Q(2, 1), managerUid: 'rq' });
});
const [adq, dq, rq, rq2, tq] = ['adq', 'dq', 'rq', 'rq2', 'tq'].map(nu);
const pv = (db, id) => db.collection('companies').doc('c5').collection('projects').doc('p5').collection('m').doc('forms').collection('r').doc(id);
const mb = (db, uid) => db.collection('companies').doc('c5').collection('members').doc(uid);
const F0 = { t: 'PV béton', aut: 'tq', vst: 'brouillon' };
await t('PV : le technicien crée un brouillon', () => assertSucceeds(pv(tq, 'pv1').set(F0)));
await t('PV : le technicien soumet', () => assertSucceeds(pv(tq, 'pv1').set({ ...F0, vst: 'soumis' })));
await t('PV : REFUS que l\'auteur valide son propre PV', () => assertFails(pv(tq, 'pv1').set({ ...F0, vst: 'valide', vby: 'tq' })));
await t('PV : REFUS de créer un PV déjà validé', () => assertFails(pv(tq, 'pv9').set({ ...F0, vst: 'valide', vby: 'tq' })));
await t('PV : REFUS de validation par un responsable qui n\'est pas le sien', () => assertFails(pv(rq2, 'pv1').set({ ...F0, vst: 'valide', vby: 'rq2' })));
await t('PV : le responsable direct valide', () => assertSucceeds(pv(rq, 'pv1').set({ ...F0, vst: 'valide', vby: 'rq' })));
await t('PV validé : REFUS de modification par l\'auteur', () => assertFails(pv(tq, 'pv1').set({ ...F0, vst: 'valide', vby: 'rq', t: 'modifié' })));
await t('PV validé : REFUS de le remettre en brouillon par l\'auteur', () => assertFails(pv(tq, 'pv1').set({ ...F0, vst: 'brouillon' })));
await t('PV : REFUS de changer l\'auteur', () => assertFails(pv(rq2, 'pv1').set({ ...F0, aut: 'rq2', vst: 'valide', vby: 'rq' })));
await t('PV : le responsable direct refuse (motif)', async () => { await assertSucceeds(pv(tq, 'pv2').set({ ...F0, vst: 'soumis' })); await assertSucceeds(pv(rq, 'pv2').set({ ...F0, vst: 'refuse', vby: 'rq', vmotif: 'Photos manquantes' })); });
await t('PV refusé : l\'auteur corrige et resoumet', () => assertSucceeds(pv(tq, 'pv2').set({ ...F0, vst: 'soumis', vmotif: 'Photos manquantes' })));
await t('PV : le Directeur qualité (Administrer) valide', () => assertSucceeds(pv(dq, 'pv2').set({ ...F0, vst: 'valide', vby: 'dq' })));
await t('PV : l\'administrateur valide', async () => { await assertSucceeds(pv(tq, 'pv3').set({ ...F0, vst: 'soumis' })); await assertSucceeds(pv(adq, 'pv3').set({ ...F0, vst: 'valide', vby: 'adq' })); });
await t('PV : REFUS de valider au nom d\'un autre (vby)', async () => { await assertSucceeds(pv(tq, 'pv4').set({ ...F0, vst: 'soumis' })); await assertFails(pv(rq, 'pv4').set({ ...F0, vst: 'valide', vby: 'dq' })); });
await t('délégation : le responsable ajuste les droits de son technicien (dans ses limites)', () => assertSucceeds(mb(rq, 'tq').update({ perms: Q(3, 1), missions: [{ t: 'Contrôle ferraillage', at: 1 }] })));
await t('délégation : REFUS de donner plus que ses propres droits', () => assertFails(mb(rq, 'tq').update({ perms: Q(4, 1) })));
await t('délégation : REFUS de nommer administrateur', () => assertFails(mb(rq, 'tq').update({ admin: true })));
await t('délégation : REFUS de changer le poste', () => assertFails(mb(rq, 'tq').update({ role: 'respqualite' })));
await t('délégation : REFUS de donner tous les projets', () => assertFails(mb(rq, 'tq').update({ allProjects: true })));
await t('délégation : REFUS par un responsable qui n\'est pas le sien', () => assertFails(mb(rq2, 'tq').update({ missions: [{ t: 'x', at: 1 }] })));
await t('délégation : REFUS de modifier ses propres droits', () => assertFails(mb(rq, 'rq').update({ perms: Q(4, 4) })));
await t('délégation : le directeur délègue à son responsable', () => assertSucceeds(mb(dq, 'rq').update({ missions: [{ t: 'Plan de contrôle lot GO', at: 1 }] })));
await t('postes : le Directeur qualité crée un poste', () => assertSucceeds(dq.collection('companies').doc('c5').collection('postes').doc('labq').set({ label: 'Laborantin', s: 'qualite', under: 'ingqualite' })));
await t('postes : l\'administrateur renomme un poste', () => assertSucceeds(adq.collection('companies').doc('c5').collection('postes').doc('techqualite').set({ label: 'Technicien contrôle' })));
await t('postes : REFUS par un technicien', () => assertFails(tq.collection('companies').doc('c5').collection('postes').doc('x').set({ label: 'X' })));
await t('postes : un membre lit les postes', () => assertSucceeds(tq.collection('companies').doc('c5').collection('postes').get()));

// --- v1.0.19 : projet multi-organisations (partenaires), groupement (JV), historique
const SRV = () => firebase.firestore.FieldValue.serverTimestamp();
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore(), A = db.collection('companies').doc('c6'), B = db.collection('companies').doc('c7');
  await A.set({ name: 'Entreprise Titulaire', ownerUid: 'own6', plan: 'enterprise', planStatus: 'essai' });
  await A.collection('members').doc('own6').set({ name: 'Own', admin: true, perms: ALL4, allProjects: true, projects: [] });
  await A.collection('members').doc('m6').set({ name: 'Cond', admin: false, perms: { ...ALL0, projet: 2, reserves: 2, equipe: 3 }, allProjects: true, projects: [] });
  await A.collection('projects').doc('p6').set({ name: 'Hôpital', by: 'own6' });
  await A.collection('projects').doc('p6').collection('m').doc('reserves').collection('r').doc('tasks__t1').set({ store: 'tasks', id: 't1', projectId: 'p6', data: '{}' });
  await A.collection('projects').doc('p6').collection('m').doc('finance').collection('r').doc('items__f1').set({ store: 'items', id: 'f1', projectId: 'p6', data: '{}' });
  await B.set({ name: 'BET Partenaire', ownerUid: 'pa7', plan: 'business', planStatus: 'essai', orgType: 'bet' });
  await B.collection('members').doc('pa7').set({ name: 'Admin BET', admin: true, perms: ALL4, allProjects: true, projects: [] });
  await B.collection('members').doc('pm7').set({ name: 'Ing BET', admin: false, perms: { ...ALL0, projet: 1, plans: 1, reserves: 2 }, allProjects: true, projects: [] });
  await B.collection('members').doc('px7').set({ name: 'Autre BET', admin: false, perms: { ...ALL0, projet: 1, reserves: 2 }, allProjects: false, projects: [] });
  await db.collection('companies').doc('c8').set({ name: 'Étrangère', ownerUid: 'ad8', plan: 'business', planStatus: 'essai' });
  await db.collection('companies').doc('c8').collection('members').doc('ad8').set({ name: 'Ad8', admin: true, perms: ALL4, allProjects: true, projects: [] });
  for (const [u, cid] of [['pa7', 'c7'], ['pm7', 'c7'], ['px7', 'c7'], ['ad8', 'c8'], ['own6', 'c6'], ['m6', 'c6']]) await db.collection('users').doc(u).set({ companyId: cid });
});
const [own6, m6, pa7, pm7, px7, ad8] = ['own6', 'm6', 'pa7', 'pm7', 'px7', 'ad8'].map(nu);
const PM = { projet: 1, plans: 2, reserves: 2 };
const pinv = (who, code, extra) => who.collection('invites').doc(code).set({ kind: 'partner', cid: 'c6', pid: 'p6', pname: 'Hôpital', ownerName: 'Entreprise Titulaire', prole: 'bet', mods: PM, used: false, status: 'valide', createdBy: who === own6 ? 'own6' : who === m6 ? 'm6' : who === pa7 ? 'pa7' : 'pm7', expiresAt: new Date(Date.now() + 864e5), ...extra });
const P6 = (db) => db.collection('companies').doc('c6').collection('projects').doc('p6');
const part = (db, o, code, extra) => P6(db).collection('partners').doc(o).set({ orgName: 'X', role: 'bet', mods: PM, status: 'actif', code, ...extra });
await t('partenaire : l\'administrateur du titulaire crée un code partenaire', () => assertSucceeds(pinv(own6, 'PART0001')));
await t('partenaire : REFUS d\'un code au-delà de « Modifier »', () => assertFails(pinv(own6, 'PARTKO01', { mods: { projet: 1, plans: 3 } })));
await t('partenaire : REFUS d\'un code par un non-administrateur', () => assertFails(pinv(m6, 'PARTKO02')));
await t('partenaire : REFUS d\'utiliser un code partenaire pour devenir membre', () => assertFails(pm7.collection('companies').doc('c6').collection('members').doc('pm7').set({ name: 'x', role: 'bet', perms: PM, admin: false, allProjects: false, projects: [], invite: 'PART0001' })));
await t('partenaire : REFUS d\'accepter par un non-administrateur', () => assertFails(part(pm7, 'c7', 'PART0001')));
await t('partenaire : REFUS avec des accès modifiés', () => assertFails(part(pa7, 'c7', 'PART0001', { mods: { projet: 1, plans: 2, reserves: 2, finance: 2 } })));
await t('partenaire : l\'administrateur du partenaire accepte', async () => { await assertSucceeds(part(pa7, 'c7', 'PART0001')); await assertSucceeds(pa7.collection('companies').doc('c7').collection('shared').doc('p6').set({ cid: 'c6', name: 'Hôpital', mods: PM })); await assertSucceeds(pa7.collection('invites').doc('PART0001').update({ used: true, usedBy: 'pa7', usedAt: 1 })); });
await t('partenaire : REFUS de réutiliser le code', () => assertFails(part(ad8, 'c8', 'PART0001')));
const R6 = (db, mod, id) => P6(db).collection('m').doc(mod).collection('r').doc(id);
await t('partenaire : un membre lit le projet partagé', () => assertSucceeds(P6(pm7).get()));
await t('partenaire : un membre lit les réserves accordées', () => assertSucceeds(R6(pm7, 'reserves', 'tasks__t1').get()));
await t('partenaire : un membre ajoute une réserve', () => assertSucceeds(R6(pm7, 'reserves', 'tasks__t2').set({ store: 'tasks', id: 't2', projectId: 'p6', data: '{}' })));
await t('partenaire : REFUS au-delà de ses propres droits (plans : voir)', () => assertFails(R6(pm7, 'plans', 'plans__x').set({ store: 'plans', id: 'x', projectId: 'p6', data: '{}' })));
await t('partenaire : REFUS d\'un module non accordé (finance)', () => assertFails(R6(pm7, 'finance', 'items__f1').get()));
await t('partenaire : REFUS pour un membre sans ce projet', () => assertFails(R6(px7, 'reserves', 'tasks__t1').get()));
await t('partenaire : REFUS de lire l\'équipe du titulaire', () => assertFails(pm7.collection('companies').doc('c6').collection('members').get()));
await t('partenaire : REFUS de lire l\'organisation du titulaire', () => assertFails(pm7.collection('companies').doc('c6').get()));
await t('partenaire : REFUS pour une organisation étrangère', () => assertFails(R6(ad8, 'reserves', 'tasks__t1').get()));
await t('partenaire : REFUS de modifier ses propres accès', () => assertFails(P6(pm7).collection('partners').doc('c7').update({ mods: { ...PM, finance: 2 } })));
await t('partenaire : REFUS depuis un autre espace actif', async () => { await env.withSecurityRulesDisabled(c => c.firestore().collection('users').doc('pm7').set({ companyId: 'c8' })); await assertFails(R6(pm7, 'reserves', 'tasks__t1').get()); await env.withSecurityRulesDisabled(c => c.firestore().collection('users').doc('pm7').set({ companyId: 'c7' })); });
await t('historique : le partenaire ajoute une ligne', () => assertSucceeds(P6(pm7).collection('audit').doc('a1').set({ act: 'ajout', store: 'tasks', by: 'pm7', srv: SRV() })));
await t('historique : REFUS au nom d\'un autre', () => assertFails(P6(pm7).collection('audit').doc('a2').set({ act: 'ajout', by: 'own6', srv: SRV() })));
await t('historique : REFUS de modifier une ligne', () => assertFails(P6(own6).collection('audit').doc('a1').update({ act: 'suppr' })));
await t('historique : REFUS d\'effacer une ligne', () => assertFails(P6(own6).collection('audit').doc('a1').delete()));
await t('historique : le titulaire lit', () => assertSucceeds(P6(own6).collection('audit').get()));
await t('historique : REFUS pour une organisation étrangère', () => assertFails(P6(ad8).collection('audit').get()));
await t('titulaire : REFUS d\'accorder plus que « Modifier »', () => assertFails(P6(own6).collection('partners').doc('c7').update({ mods: { projet: 1, plans: 3 } })));
await t('titulaire : ajuste les accès du partenaire', () => assertSucceeds(P6(own6).collection('partners').doc('c7').update({ mods: { projet: 1, plans: 1, reserves: 2 } })));
await t('groupement : REFUS par un membre non administrateur', () => assertFails(P6(m6).update({ jv: { name: 'G', mand: 'c7' } })));
await t('groupement : l\'administrateur déclare le groupement et le mandataire', () => assertSucceeds(P6(own6).update({ jv: { name: 'Groupement Atlas', mand: 'c7' } })));
await t('groupement : le mandataire invite une organisation', () => assertSucceeds(pinv(pa7, 'PART0003', { prole: 'labo' })));
await t('groupement : REFUS par un membre du mandataire non administrateur', () => assertFails(pinv(pm7, 'PARTKO03')));
await t('titulaire : suspendre l\'accès du partenaire', () => assertSucceeds(P6(own6).collection('partners').doc('c7').update({ status: 'suspendu' })));
await t('partenaire suspendu : REFUS de lecture', () => assertFails(R6(pm7, 'reserves', 'tasks__t1').get()));
await t('partenaire : quitter le projet', () => assertSucceeds(P6(pa7).collection('partners').doc('c7').delete()));
await t('partenaire retiré : REFUS de lecture du projet', () => assertFails(P6(pm7).get()));

// --- v1.0.20 : fichiers partagés (Cloud Storage) — mêmes droits que les données, lus dans Firestore
const BK = 'gs://siteteam.firebasestorage.app';
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await db.collection('companies').doc('c6').collection('projects').doc('p6').collection('partners').doc('c7').set({ orgName: 'BET Partenaire', role: 'bet', mods: { projet: 1, plans: 1, files: 2 }, status: 'actif' });
  await db.collection('companies').doc('c7').collection('members').doc('pm7').update({ perms: { ...ALL0, projet: 1, plans: 1, reserves: 2, files: 2 } });
});
const stg = (uid) => (uid ? env.authenticatedContext(uid, { email: uid + '@test.ma' }) : env.unauthenticatedContext()).storage(BK);
const F6 = (uid, f) => stg(uid).ref(`companies/c6/projects/p6/files/${f}`);
const BYTES = new Uint8Array([37, 80, 68, 70, 45, 49]);
await t('fichiers : le titulaire envoie un plan', () => assertSucceeds(F6('own6', 'plan1').put(BYTES, { contentType: 'application/pdf' })));
await t('fichiers : le titulaire lit le fichier', () => assertSucceeds(F6('own6', 'plan1').getMetadata()));
await t('fichiers : REFUS pour un membre sans droit fichiers', () => assertFails(F6('m6', 'plan1').getMetadata()));
await t('fichiers : REFUS d\'envoi sans droit fichiers', () => assertFails(F6('m6', 'x1').put(BYTES)));
await t('fichiers : le partenaire lit le fichier', () => assertSucceeds(F6('pm7', 'plan1').getMetadata()));
await t('fichiers : le partenaire envoie un fichier (Modifier)', () => assertSucceeds(F6('pm7', 'note1').put(BYTES, { contentType: 'application/pdf' })));
await t('fichiers : REFUS pour un membre du partenaire sans ce projet', () => assertFails(F6('px7', 'plan1').getMetadata()));
await t('fichiers : REFUS pour une organisation étrangère', () => assertFails(F6('ad8', 'plan1').getMetadata()));
await t('fichiers : REFUS sans compte', () => assertFails(F6(null, 'plan1').getMetadata()));
await t('fichiers : REFUS d\'un fichier de plus de 50 Mo', () => assertFails(F6('own6', 'big1').put(new Uint8Array(51 * 1024 * 1024))));
await t('fichiers : REFUS en dehors des projets', () => assertFails(stg('own6').ref('autre/chemin.pdf').put(BYTES)));
await t('fichiers : le partenaire suspendu perd l\'accès', async () => { await env.withSecurityRulesDisabled(c => c.firestore().collection('companies').doc('c6').collection('projects').doc('p6').collection('partners').doc('c7').update({ status: 'suspendu' })); await assertFails(F6('pm7', 'plan1').getMetadata()); });
await t('fichiers : le titulaire supprime', () => assertSucceeds(F6('own6', 'plan1').delete()));

// --- v1.0.24 : panneau d'administration — packs fermés, comptes bloqués, organisations suspendues, erreurs, demandes, annonces
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await db.collection('users').doc('blk1').set({ companyId: 'c6', name: 'Bloqué' });
  await db.collection('companies').doc('c6').collection('members').doc('blk1').set({ name: 'Bloqué', admin: false, perms: { ...ALL0, projet: 2, reserves: 2 }, allProjects: true, projects: [] });
  await db.collection('companies').doc('c9').set({ name: 'Suspendue SA', ownerUid: 'own9', plan: 'business', planStatus: 'actif' });
  await db.collection('companies').doc('c9').collection('members').doc('own9').set({ name: 'Own9', admin: true, perms: ALL4, allProjects: true, projects: [] });
  await db.collection('companies').doc('c9').collection('projects').doc('p9').set({ name: 'Projet 9' });
  await db.collection('companies').doc('c9').collection('projects').doc('p9').collection('m').doc('reserves').collection('r').doc('tasks__a').set({ store: 'tasks', id: 'a', projectId: 'p9', data: '{}' });
});
const [blk1, own9, nw1, nw2] = ['blk1', 'own9', 'nw1', 'nw2'].map(nu);
const R6b = (db) => db.collection('companies').doc('c6').collection('projects').doc('p6').collection('m').doc('reserves').collection('r').doc('tasks__t1');
await t('compte : la personne modifie son profil', () => assertSucceeds(blk1.collection('users').doc('blk1').update({ name: 'Nouveau nom', lastSeen: SRV() })));
await t('compte : lecture des projets avant blocage', () => assertSucceeds(R6b(blk1).get()));
await t('blocage : REFUS qu\'une personne se bloque / débloque elle-même', () => assertFails(blk1.collection('users').doc('blk1').update({ blocked: false })));
await t('blocage : REFUS par un autre compte', () => assertFails(other.collection('users').doc('blk1').update({ blocked: true })));
await t('blocage : le Super Admin bloque le compte', () => assertSucceeds(owner.collection('users').doc('blk1').update({ blocked: true, blockedAt: SRV(), blockedWhy: 'test' })));
await t('blocage : le compte bloqué perd l\'accès aux projets', () => assertFails(R6b(blk1).get()));
await t('blocage : le compte bloqué perd l\'accès à l\'organisation', () => assertFails(blk1.collection('companies').doc('c6').get()));
await t('blocage : REFUS que le Super Admin change autre chose que le blocage', () => assertFails(owner.collection('users').doc('blk1').update({ companyId: 'c9' })));
await t('blocage : le Super Admin débloque', async () => { await assertSucceeds(owner.collection('users').doc('blk1').update({ blocked: false })); await assertSucceeds(R6b(blk1).get()); });
await t('profil : création par la personne (non bloqué)', () => assertSucceeds(nw1.collection('users').doc('nw1').set({ name: 'N1' })));
await t('suspension : avant, le propriétaire lit ses réserves', () => assertSucceeds(own9.collection('companies').doc('c9').collection('projects').doc('p9').collection('m').doc('reserves').collection('r').doc('tasks__a').get()));
await t('suspension : REFUS que l\'admin se suspende / réactive lui-même', () => assertFails(own9.collection('companies').doc('c9').update({ planStatus: 'actif', name: 'x' }).then(() => own9.collection('companies').doc('c9').update({ planStatus: 'gratuit' }))));
await t('suspension : le Super Admin suspend l\'organisation', () => assertSucceeds(owner.collection('companies').doc('c9').update({ planStatus: 'suspendu' })));
await t('suspension : REFUS de lecture des projets', () => assertFails(own9.collection('companies').doc('c9').collection('projects').doc('p9').collection('m').doc('reserves').collection('r').doc('tasks__a').get()));
await t('suspension : REFUS d\'écriture', () => assertFails(own9.collection('companies').doc('c9').collection('projects').doc('p9').collection('m').doc('reserves').collection('r').doc('tasks__b').set({ store: 'tasks', id: 'b', projectId: 'p9', data: '{}' })));
await t('suspension : l\'organisation reste lisible (message « suspendue »)', () => assertSucceeds(own9.collection('companies').doc('c9').get()));
await t('suspension : le Super Admin rétablit', async () => { await assertSucceeds(owner.collection('companies').doc('c9').update({ planStatus: 'actif' })); await assertSucceeds(own9.collection('companies').doc('c9').collection('projects').doc('p9').get()); });
const newCo = (db, id, uid, plan) => db.collection('companies').doc(id).set({ name: 'N', ownerUid: uid, plan, planStatus: 'essai', kind: 'org' });
await t('packs : création en Basic', () => assertSucceeds(newCo(nw1, 'cn1', 'nw1', 'basic')));
await t('packs : REFUS d\'un pack fermé (Business)', () => assertFails(newCo(nw2, 'cn2', 'nw2', 'business')));
await t('packs : le Super Admin crée avec n\'importe quel pack', () => assertSucceeds(newCo(owner, 'cn3', OWNER.uid, 'enterprise')));
await t('packs : le Super Admin ouvre Business au public', () => assertSucceeds(owner.collection('config').doc('plans').set({ business: { open: true } }, { merge: true })));
await t('packs : création en Business une fois ouvert', () => assertSucceeds(newCo(nw2, 'cn4', 'nw2', 'business')));
await t('packs : REFUS de Pro (toujours fermé)', () => assertFails(newCo(nw2, 'cn5', 'nw2', 'pro')));
await t('erreurs : un compte envoie une erreur', () => assertSucceeds(nw1.collection('errors').add({ uid: 'nw1', cid: '', msg: 'TypeError: x', src: 'app.js:1', stack: '', ver: '1.0.24', platform: 'web', at: SRV() })));
await t('erreurs : REFUS au nom d\'un autre', () => assertFails(nw1.collection('errors').add({ uid: 'nw2', msg: 'x', at: SRV() })));
await t('erreurs : REFUS de lecture par un compte', () => assertFails(nw1.collection('errors').get()));
await t('erreurs : le Super Admin lit', () => assertSucceeds(owner.collection('errors').get()));
await t('demandes : un compte demande un pack', () => assertSucceeds(nw1.collection('packRequests').doc('rq1').set({ uid: 'nw1', email: 'nw1@test.ma', plan: 'pro', status: 'attente' })));
await t('demandes : REFUS d\'une demande déjà « acceptée »', () => assertFails(nw1.collection('packRequests').doc('rq2').set({ uid: 'nw1', plan: 'pro', status: 'acceptee' })));
await t('demandes : la personne lit sa demande', () => assertSucceeds(nw1.collection('packRequests').doc('rq1').get()));
await t('demandes : REFUS qu\'elle l\'accepte elle-même', () => assertFails(nw1.collection('packRequests').doc('rq1').update({ status: 'acceptee' })));
await t('demandes : REFUS de lecture par un autre compte', () => assertFails(nw2.collection('packRequests').doc('rq1').get()));
await t('demandes : le Super Admin accepte', () => assertSucceeds(owner.collection('packRequests').doc('rq1').update({ status: 'acceptee' })));
await t('annonces : le Super Admin publie à tous et à une personne', async () => { await assertSucceeds(owner.collection('annonces').doc('an1').set({ target: 'all', title: 'T', text: 'x', at: SRV() })); await assertSucceeds(owner.collection('annonces').doc('an2').set({ target: 'nw1', title: 'T', text: 'perso', at: SRV() })); });
await t('annonces : un compte lit les annonces pour lui', () => assertSucceeds(nw1.collection('annonces').where('target', 'in', ['all', 'nw1']).get()));
await t('annonces : REFUS de lire l\'annonce d\'un autre', () => assertFails(nw2.collection('annonces').doc('an2').get()));
await t('annonces : REFUS de publier', () => assertFails(nw1.collection('annonces').add({ target: 'all', text: 'spam' })));
await t('annonces : organisation (membre lit)', async () => { await assertSucceeds(owner.collection('companies').doc('c9').collection('annonces').doc('a1').set({ target: 'c9', text: 'x', at: SRV() })); await assertSucceeds(own9.collection('companies').doc('c9').collection('annonces').get()); await assertFails(nw1.collection('companies').doc('c9').collection('annonces').get()); });
await t('panneau : le Super Admin liste comptes, membres et projets', async () => { await assertSucceeds(owner.collection('users').get()); await assertSucceeds(owner.collectionGroup('members').get()); await assertSucceeds(owner.collectionGroup('projects').get()); });
await t('panneau : REFUS pour un autre compte', async () => { await assertFails(other.collection('users').get()); await assertFails(other.collectionGroup('members').get()); });

// --- v1.0.27 : codes pack (le Super Admin ouvre un pack à une personne, sans demande)
const [nw3, nw4] = ['nw3', 'nw4'].map(nu);
const futur = (d) => new Date(Date.now() + d * 864e5);
await t('code pack : le Super Admin crée des codes', async () => {
  await assertSucceeds(owner.collection('packCodes').doc('PRO-TEST01').set({ plan: 'pro', days: 30, maxUses: 2, uses: 0, usedBy: [], status: 'valide', expiresAt: futur(30) }));
  await assertSucceeds(owner.collection('packCodes').doc('ENT-TEST01').set({ plan: 'enterprise', days: 0, maxUses: 1, uses: 0, usedBy: [], status: 'valide', expiresAt: null }));
  await assertSucceeds(owner.collection('packCodes').doc('BUS-REVOK1').set({ plan: 'business', days: 0, maxUses: 5, uses: 0, usedBy: [], status: 'revoque', expiresAt: null })); });
await t('code pack : REFUS de création par un compte', () => assertFails(nw3.collection('packCodes').doc('PRO-HACK01').set({ plan: 'pro', days: 0, maxUses: 99, uses: 0, usedBy: [], status: 'valide' })));
await t('code pack : REFUS de lister les codes', () => assertFails(nw3.collection('packCodes').get()));
await t('code pack : un compte lit un code précis', () => assertSucceeds(nw3.collection('packCodes').doc('PRO-TEST01').get()));
const coCode = (db, id, uid, plan, code, extra) => db.collection('companies').doc(id).set({ name: 'C', ownerUid: uid, plan, planStatus: 'essai', trialEndsAt: futur(30), kind: 'perso', packCode: code, ...extra });
await t('code pack : création d\'un espace Pro avec le code', () => assertSucceeds(coCode(nw3, 'cc1', 'nw3', 'pro', 'PRO-TEST01')));
await t('code pack : la personne enregistre l\'utilisation', () => assertSucceeds(nw3.collection('packCodes').doc('PRO-TEST01').update({ uses: 1, usedBy: ['nw3'], lastUsedAt: SRV() })));
await t('code pack : REFUS de réutiliser son code', () => assertFails(coCode(nw3, 'cc2', 'nw3', 'pro', 'PRO-TEST01')));
await t('code pack : REFUS d\'une durée plus longue que le code', () => assertFails(coCode(nw4, 'cc3', 'nw4', 'pro', 'PRO-TEST01', { trialEndsAt: futur(120) })));
await t('code pack : REFUS d\'un autre pack que celui du code', () => assertFails(coCode(nw4, 'cc4', 'nw4', 'enterprise', 'PRO-TEST01')));
await t('code pack : REFUS d\'un code annulé', () => assertFails(coCode(nw4, 'cc5', 'nw4', 'business', 'BUS-REVOK1', { planStatus: 'actif' })));
await t('code pack : REFUS de remettre le compteur à zéro', () => assertFails(nw4.collection('packCodes').doc('PRO-TEST01').update({ uses: 0, usedBy: [] })));
await t('code pack : REFUS « actif » pour un code limité dans le temps', () => assertFails(coCode(nw4, 'cc6', 'nw4', 'pro', 'PRO-TEST01', { planStatus: 'actif' })));
await t('code pack : l\'administrateur passe son organisation au pack du code', () => assertSucceeds(own9.collection('companies').doc('c9').update({ plan: 'enterprise', planStatus: 'actif', packCode: 'ENT-TEST01' })));
await t('code pack : REFUS sans code (changement de pack)', () => assertFails(nw1.collection('companies').doc('cn1').update({ plan: 'enterprise', planStatus: 'actif' })));

log(`\n${fails ? fails + ' ÉCHEC(S)' : 'TOUT OK'} — ${out.length} vérifications`);
fs.writeFileSync(O + '/rules-test.txt', out.join('\n') + '\n');
await env.cleanup();
process.exit(fails ? 1 : 0);
