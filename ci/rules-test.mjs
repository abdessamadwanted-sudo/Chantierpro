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
await t('propriétaire Chantier : REFUS de lire une entreprise SiteTeam dont il n\'est pas membre', () => assertFails(owner.collection('companies').doc('c1').get()));

log(`\n${fails ? fails + ' ÉCHEC(S)' : 'TOUT OK'} — ${out.length} vérifications`);
fs.writeFileSync(O + '/rules-test.txt', out.join('\n') + '\n');
await env.cleanup();
process.exit(fails ? 1 : 0);
