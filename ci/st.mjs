// Test complet SiteTeam contre les émulateurs Firebase (auth + firestore + règles)
import { chromium } from 'playwright';
import fs from 'fs';
const O = 'ci-out'; fs.mkdirSync(O, { recursive: true });
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); fs.appendFileSync(O + '/log.txt', s + '\n'); };
const URL = 'http://127.0.0.1:8765/?emu=1';
const b = await chromium.launch();
async function newUser(tag) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(tag + ' pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push(tag + ' console: ' + m.text().slice(0, 300)); });
  pg.on('dialog', d => d.accept());
  await pg.addInitScript(() => localStorage.setItem('askedName', '1'));
  await pg.goto(URL); await pg.waitForSelector('.tm-login', { timeout: 20000 });
  return { pg, errs, ctx };
}
async function signup(pg, name, email) {
  await pg.click('[data-m=up]'); await pg.fill('[name=name]', name); await pg.fill('[name=email]', email); await pg.fill('[name=pw]', 'secret123');
  await pg.click('[data-a=go]'); await pg.waitForSelector('.tm-choice', { timeout: 20000 });
}
const shot = (pg, n) => pg.screenshot({ path: `${O}/${n}.png` });
try {
  // ---- patron
  const A = await newUser('A');
  await shot(A.pg, '01_login');
  await signup(A.pg, 'Abdessamad Patron', 'patron@test.ma');
  await shot(A.pg, '02_onboard');
  await A.pg.click('[data-a=create]'); await A.pg.fill('[name=name]', 'BTP Test SARL'); await A.pg.click('.sheet [data-a=ok]');
  await A.pg.waitForSelector('.home2', { timeout: 20000 }); await A.pg.waitForTimeout(800);
  await A.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  await shot(A.pg, '03_home_patron');
  // créer un projet
  await A.pg.click('.fab'); await A.pg.fill('[name=name]', 'Grand stade Benslimane'); await A.pg.click('.sheet [data-a=ok]'); await A.pg.waitForTimeout(1500);
  await A.pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); renderHome(); });
  await A.pg.evaluate(() => Sync.run({ force: true })); await A.pg.waitForTimeout(2000);
  log('A sync state', await A.pg.evaluate(() => Sync.statusLine()));
  // ajouter une réserve dans le projet (données partagées)
  await A.pg.evaluate(async () => { const p = (await DB.all('projects'))[0]; await DB.put('tasks', { projectId: p.id, title: 'Enrobage insuffisant voile V12', status: 'open', num: 1 }); await DB.put('receptions', { projectId: p.id, type: 'Ferraillage', date: '2026-10-13', rows: [{ id: 'r1', element: 'Voile CR 75', niv: 'R+5', zone: '11', status: 'ok' }] }); });
  await A.pg.evaluate(() => Sync.run({ force: true })); await A.pg.waitForTimeout(2000);
  // invitation conducteur (tous les projets)
  await A.pg.evaluate(() => Team.openCompany()); await A.pg.waitForTimeout(1200); await shot(A.pg, '04_company_org');
  await A.pg.click('.tm-page [data-a=invite]'); await A.pg.waitForTimeout(400);
  await A.pg.fill('[data-f=name]', 'Youssef'); await A.pg.selectOption('[data-f=role]', 'conducteur'); await A.pg.fill('[data-f=zone]', 'Zone 11');
  await shot(A.pg, '05_invite_form');
  await A.pg.click('.tm-form [data-a=ok]'); await A.pg.waitForSelector('.sheet h3', { timeout: 15000 }); await A.pg.waitForTimeout(500);
  const t1 = await A.pg.textContent('.sheet h3'); const code1 = t1.split(':').pop().trim(); log('code conducteur', code1);
  await shot(A.pg, '06_invite_code');
  await A.pg.click('.opt:has-text("Fermer")'); await A.pg.waitForTimeout(300);
  // invitation MO (lecture seule, projet précis)
  await A.pg.click('.tm-page [data-a=invite]'); await A.pg.waitForTimeout(400);
  await A.pg.fill('[data-f=name]', 'MO Client'); await A.pg.selectOption('[data-f=role]', 'mo');
  await A.pg.uncheck('[data-all]'); await A.pg.check('[data-p]');
  await A.pg.click('.tm-form [data-a=ok]'); await A.pg.waitForSelector('.sheet h3', { timeout: 15000 }); await A.pg.waitForTimeout(500);
  const code2 = (await A.pg.textContent('.sheet h3')).split(':').pop().trim(); log('code MO', code2);
  await A.pg.click('.opt:has-text("Fermer")'); await A.pg.waitForTimeout(300);
  await A.pg.click('[data-t=inv]'); await A.pg.waitForTimeout(1500); await shot(A.pg, '07_invites');
  await A.pg.click('[data-t=set]'); await A.pg.waitForTimeout(400); await shot(A.pg, '08_settings');

  // ---- conducteur
  const B = await newUser('B');
  await signup(B.pg, 'Youssef Conducteur', 'youssef@test.ma');
  await B.pg.click('[data-a=join]'); await B.pg.fill('[name=code]', code1); await B.pg.click('.sheet [data-a=ok]');
  await B.pg.waitForSelector('.home2', { timeout: 20000 });
  await B.pg.evaluate(() => Sync.run({ force: true })); await B.pg.waitForTimeout(2500);
  await B.pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); renderHome(); }); await B.pg.waitForTimeout(600);
  await shot(B.pg, '09_home_conducteur');
  log('B projects', await B.pg.evaluate(async () => (await DB.all('projects')).map(p => p.name)));
  log('B tasks', await B.pg.evaluate(async () => (await DB.all('tasks')).map(p => p.title)));
  log('B receptions', await B.pg.evaluate(async () => (await DB.all('receptions')).length));
  // B modifie une réserve → A la reçoit
  await B.pg.evaluate(async () => { const t = (await DB.all('tasks'))[0]; t.status = 'progress'; t.title += ' (repris)'; await DB.put('tasks', t); });
  await B.pg.evaluate(() => Sync.run({ force: true })); await B.pg.waitForTimeout(1500);
  await A.pg.evaluate(() => Sync.run({ force: true })); await A.pg.waitForTimeout(1500);
  log('A sees task', await A.pg.evaluate(async () => (await DB.all('tasks')).map(t => t.title + ' / ' + t.status)));
  // ouvre le projet + menu
  await B.pg.evaluate(async () => openProject((await DB.all('projects'))[0])); await B.pg.waitForTimeout(800);
  await B.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  await B.pg.evaluate(() => openDrawer()); await B.pg.waitForTimeout(600); await shot(B.pg, '10_drawer_conducteur');
  // sécurité : B essaie de se donner des droits admin → refusé
  log('B self-admin', await B.pg.evaluate(async () => { try { const u = firebase.auth().currentUser.uid, cid = Team.company().id; await firebase.firestore().collection('companies').doc(cid).collection('members').doc(u).update({ admin: true }); return 'ALLOWED (BAD)'; } catch (e) { return 'denied OK: ' + e.code; } }));
  log('B invite create', await B.pg.evaluate(async () => { try { await firebase.firestore().collection('invites').doc('HACK1234').set({ cid: Team.company().id, role: 'patron', used: false }); return 'ALLOWED (BAD)'; } catch (e) { return 'denied OK: ' + e.code; } }));

  // ---- MO (lecture seule)
  const C = await newUser('C');
  await signup(C.pg, 'Client MO', 'mo@test.ma');
  await C.pg.click('[data-a=join]'); await C.pg.fill('[name=code]', code2); await C.pg.click('.sheet [data-a=ok]');
  await C.pg.waitForSelector('.home2', { timeout: 20000 });
  await C.pg.evaluate(() => Sync.run({ force: true })); await C.pg.waitForTimeout(2500);
  await C.pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); renderHome(); }); await C.pg.waitForTimeout(600);
  await shot(C.pg, '11_home_mo');
  log('C fab', await C.pg.locator('.fab').count(), 'projects', await C.pg.evaluate(async () => (await DB.all('projects')).map(p => p.name)));
  await C.pg.evaluate(async () => { const p = (await DB.all('projects'))[0]; await openProject(p); App.section = 'tasks'; renderSection(); }); await C.pg.waitForTimeout(800);
  await C.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  await shot(C.pg, '12_mo_tasks_readonly');
  log('C write task', await C.pg.evaluate(async () => { try { const pid = (await DB.all('projects'))[0].id; await firebase.firestore().collection('companies').doc(Team.company().id).collection('projects').doc(pid).collection('m').doc('reserves').collection('r').doc('tasks__x').set({ a: 1 }); return 'ALLOWED (BAD)'; } catch (e) { return 'denied OK: ' + e.code; } }));
  // ---- organigramme final
  await A.pg.click('[data-t=org]'); await A.pg.waitForTimeout(1500); await shot(A.pg, '13_org_final');
  await A.pg.click('[data-t=mem]'); await A.pg.waitForTimeout(500); await shot(A.pg, '14_members');
  await A.pg.click('[data-t=org]'); await A.pg.waitForTimeout(500);
  await A.pg.click('.tm-mem:has-text("Youssef")'); await A.pg.waitForTimeout(400); await A.pg.click('.opt:has-text("Poste")'); await A.pg.waitForTimeout(500);
  await A.pg.click('[data-a=perms]'); await A.pg.waitForTimeout(300); await shot(A.pg, '15_edit_member');
  log('errors', [...A.errs, ...B.errs, ...C.errs]);
} catch (e) { log('FAIL', e.message, e.stack); }
await b.close();
