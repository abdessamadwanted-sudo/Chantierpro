// Test des règles Firestore unifiées (SiteTeam + licences de l'application Chantier) contre l'émulateur.
// Lancé par .github/workflows/st-test.yml (branche siteteam-ci). Résultat : ci-out/rules-test.txt
import fs from 'fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

const O = 'ci-out'; fs.mkdirSync(O, { recursive: true });
const out = []; let fails = 0;
const log = (s) => { console.log(s); out.push(s); };
async function t(name, fn) {
  try { await fn(); log('OK   ' + name); } catch (e) { fails++; log('FAIL ' + name + ' :: ' + (e && e.message ? e.message.split('\n')[0] : e)); }
}

const env = await initializeTestEnvironment({
  projectId: 'siteteam',
  firestore: { rules: fs.readFileSync('ci/firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
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
const inv = (who, extra) => ({ cid: 'c2', companyName: 'Business SARL', name: 'X', role: 'chefequipe', service: 'travaux', perms: { projet: 1, reserves: 2, equipe: 1 }, admin: false, allProjects: false, projects: ['p1'], used: false, createdBy: who, ...extra });
await t('code : personne autorisée (Équipe = Valider) crée un code dans ses droits', () => assertSucceeds(chef2.collection('invites').doc('CHEFOK01').set(inv('chef2'))));
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

log(`\n${fails ? fails + ' ÉCHEC(S)' : 'TOUT OK'} — ${out.length} vérifications`);
fs.writeFileSync(O + '/rules-test.txt', out.join('\n') + '\n');
await env.cleanup();
process.exit(fails ? 1 : 0);
