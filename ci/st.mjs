// Test complet SiteTeam contre les émulateurs Firebase (auth + firestore + règles)
import { chromium } from 'playwright';
import fs from 'fs';
import { fakeDrive } from './fake-drive.mjs';
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
  await pg.addInitScript(() => { localStorage.setItem('askedName', '1'); localStorage.setItem('splash.sched', JSON.stringify({ mode: 'off' })); });
  // le bandeau « emulator mode » de Firebase (absent en production) recouvrirait la barre du bas, collée en bas depuis v1.0.35
  await pg.addInitScript(() => { const add = () => { const s = document.createElement('style'); s.textContent = '.firebase-emulator-warning{display:none!important}'; document.head.appendChild(s); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); });
  await pg.goto(URL); await pg.waitForSelector('.tm-login', { timeout: 20000 });
  return { pg, errs, ctx };
}
async function signup(pg, name, email) {
  await pg.click('[data-m=up]'); await pg.fill('[name=name]', name); await pg.fill('[name=email]', email); await pg.fill('[name=pw]', 'secret123');
  await pg.click('[data-a=go]'); await pg.waitForSelector('.tm-choice', { timeout: 20000 });
}
const shot = (pg, n) => pg.screenshot({ path: `${O}/${n}.png` });
// services ouverts (config/services, écrite par le Super Admin) : tous ouverts pour les parcours existants, puis la valeur par défaut pour v1.0.18
const SVC = 'http://127.0.0.1:8080/v1/projects/siteteam/databases/(default)/documents/config/services';
const setSvcs = (L, storage = false) => fetch(SVC, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { open: { arrayValue: { values: L.map(v => ({ stringValue: v })) } }, storage: { booleanValue: storage }, maxMb: { integerValue: '50' } } }) }).then(r => r.status);
log('services ouverts (test)', await setSvcs(['*']));
// packs (v1.0.24 : seul Basic est ouvert par défaut) : ouverts pour les parcours existants, refermés plus bas pour tester le verrou
const CFG = 'http://127.0.0.1:8080/v1/projects/siteteam/databases/(default)/documents/config/';
const setPacks = (open) => fetch(CFG + 'plans?updateMask.fieldPaths=pro.open&updateMask.fieldPaths=business.open&updateMask.fieldPaths=enterprise.open', { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: Object.fromEntries(['pro', 'business', 'enterprise'].map(k => [k, { mapValue: { fields: { open: { booleanValue: open } } } }])) }) }).then(r => r.status);
log('packs ouverts (test)', await setPacks(true));
// annonces laissées par le test des règles : retirées, sinon elles s'affichent à l'ouverture de chaque compte
for (const id of ['an1', 'an2']) await fetch(CFG.replace('config/', 'annonces/') + id, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
let A, B, C, D;
try {
  // ---- patron
  A = await newUser('A');
  await shot(A.pg, '01_login');
  await signup(A.pg, 'Abdessamad Patron', 'patron@test.ma');
  await shot(A.pg, '02_onboard');
  await A.pg.click('[data-a=create]'); await A.pg.waitForSelector('.st-offers'); await shot(A.pg, '02b_packs');
  log('A offres organisation', await A.pg.evaluate(() => [...document.querySelectorAll('.st-offers [data-offer]')].map(b => b.dataset.offer + ':' + b.querySelector('.st-of-h b').textContent.trim())));
  await A.pg.click('[data-p=business]'); await A.pg.waitForSelector('.st-orgs'); await shot(A.pg, '02c_orgs');
  await A.pg.click('[data-o=entreprise]'); await A.pg.waitForSelector('.st-svcs'); await shot(A.pg, '02d_services');
  await A.pg.fill('[name=cname]', 'BTP Test SARL'); await A.pg.click('[data-a=go]');
  await A.pg.waitForSelector('.home2', { timeout: 20000 }); await A.pg.waitForTimeout(800);
  await A.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  await shot(A.pg, '03_home_patron');
  // créer un projet
  log('A pack/type', await A.pg.evaluate(() => [Team.plan().k, Team.orgType().k, Team.company().services.length, Team.canInvite()]));
  await A.pg.click('.fab'); await A.pg.waitForSelector('.st-types'); await shot(A.pg, '03b_types');
  await A.pg.click('.st-types [data-f=bat]'); await A.pg.waitForTimeout(400); await A.pg.click('.opt:has-text("Équipement")'); await A.pg.waitForTimeout(400);
  await A.pg.fill('[name=name]', 'Grand stade Benslimane'); await A.pg.fill('[name=moa]', 'Ministère'); await shot(A.pg, '03c_fiche'); await A.pg.click('.sheet [data-a=ok]'); await A.pg.waitForTimeout(1500);
  log('A projet', await A.pg.evaluate(async () => (await DB.all('projects')).map(p => [p.name, p.type, p.moa])));
  await A.pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); renderHome(); });
  await A.pg.evaluate(() => Sync.run({ force: true })); await A.pg.waitForTimeout(2000);
  log('A sync state', await A.pg.evaluate(() => Sync.statusLine()));
  // ajouter une réserve dans le projet (données partagées)
  await A.pg.evaluate(async () => { const p = (await DB.all('projects'))[0]; await DB.put('tasks', { projectId: p.id, title: 'Enrobage insuffisant voile V12', status: 'open', num: 1 }); await DB.put('receptions', { projectId: p.id, type: 'Ferraillage', date: '2026-10-13', rows: [{ id: 'r1', element: 'Voile CR 75', niv: 'R+5', zone: '11', status: 'ok' }] }); });
  await A.pg.evaluate(() => Sync.run({ force: true })); await A.pg.waitForTimeout(2000);
  // invitation conducteur (tous les projets)
  await A.pg.evaluate(() => Team.openCompany()); await A.pg.waitForTimeout(1200); await shot(A.pg, '04_company_org');
  await A.pg.click('.tm-page [data-a=invite]'); await A.pg.waitForTimeout(400);
  await A.pg.selectOption('[data-f=role]', 'dirprojet'); await A.pg.click('[data-a=perms]'); await A.pg.waitForTimeout(200);
  log('A poste Directeur de projet : admin auto / max droit', await A.pg.evaluate(() => [document.querySelector('[data-admin]').checked, Math.max(...[...document.querySelectorAll('[data-pm]')].map(x => +x.value))]));
  await A.pg.click('[data-a=perms]');
  await A.pg.fill('[data-f=name]', 'Youssef'); await A.pg.selectOption('[data-f=role]', 'conducteur'); await A.pg.fill('[data-f=zone]', 'Zone 11');
  await shot(A.pg, '05_invite_form');
  await A.pg.click('.tm-form [data-a=ok]'); await A.pg.waitForSelector('.opt:has-text("Créer le code")', { timeout: 15000 }); await A.pg.click('.opt:has-text("Créer le code")'); await A.pg.waitForSelector('.opt:has-text("Fermer")', { timeout: 15000 }); await A.pg.waitForTimeout(500);
  const t1 = await A.pg.textContent('.sheet:has(.opt:has-text("Fermer")) h3'); const code1 = t1.split(':').pop().trim(); log('code conducteur', code1);
  await shot(A.pg, '06_invite_code');
  await A.pg.click('.opt:has-text("Fermer")'); await A.pg.waitForTimeout(300);
  // invitation MO (lecture seule, projet précis)
  await A.pg.click('.tm-page [data-a=invite]'); await A.pg.waitForTimeout(400);
  await A.pg.fill('[data-f=name]', 'MO Client'); await A.pg.selectOption('[data-f=role]', 'mo');
  await A.pg.uncheck('[data-all]'); await A.pg.check('[data-p]');
  await A.pg.click('.tm-form [data-a=ok]'); await A.pg.waitForSelector('.opt:has-text("Créer le code")', { timeout: 15000 }); await A.pg.click('.opt:has-text("Créer le code")'); await A.pg.waitForSelector('.opt:has-text("Fermer")', { timeout: 15000 }); await A.pg.waitForTimeout(500);
  const code2 = (await A.pg.textContent('.sheet:has(.opt:has-text("Fermer")) h3')).split(':').pop().trim(); log('code MO', code2);
  await A.pg.click('.opt:has-text("Fermer")'); await A.pg.waitForTimeout(300);
  await A.pg.click('[data-t=inv]'); await A.pg.waitForTimeout(1500); await shot(A.pg, '07_invites');
  await A.pg.click('[data-t=set]'); await A.pg.waitForTimeout(400); await shot(A.pg, '08_settings');

  // ---- conducteur
  B = await newUser('B');
  await signup(B.pg, 'Youssef Conducteur', 'youssef@test.ma');
  await B.pg.click('[data-a=join]'); await B.pg.fill('[name=code]', code1); await B.pg.click('.sheet [data-a=ok]');
  await B.pg.waitForSelector('[data-a=join-ok]', { timeout: 15000 }); await shot(B.pg, 'B_confirm_code'); await B.pg.click('[data-a=join-ok]');
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
  C = await newUser('C');
  await signup(C.pg, 'Client MO', 'mo@test.ma');
  await C.pg.click('[data-a=join]'); await C.pg.fill('[name=code]', code2); await C.pg.click('.sheet [data-a=ok]');
  await C.pg.waitForSelector('[data-a=join-ok]', { timeout: 15000 }); await shot(C.pg, 'C_confirm_code'); await C.pg.click('[data-a=join-ok]');
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
  // ---- ESPACES ----
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); renderHome(); }); await A.pg.waitForTimeout(800);
  await shot(A.pg, '16_home_patron_espace');
  // invitation topographe
  await A.pg.evaluate(() => Team.openCompany()); await A.pg.waitForTimeout(800);
  await A.pg.click('.tm-page [data-a=invite]'); await A.pg.waitForTimeout(400);
  await A.pg.fill('[data-f=name]', 'Karim Topo'); await A.pg.selectOption('[data-f=role]', 'cheftopo');
  await A.pg.click('.tm-form [data-a=ok]'); await A.pg.waitForSelector('.opt:has-text("Créer le code")', { timeout: 15000 }); await A.pg.click('.opt:has-text("Créer le code")'); await A.pg.waitForSelector('.opt:has-text("Fermer")', { timeout: 15000 }); await A.pg.waitForTimeout(400);
  const code3 = (await A.pg.textContent('.sheet:has(.opt:has-text("Fermer")) h3')).split(':').pop().trim(); await A.pg.click('.opt:has-text("Fermer")');
  D = await newUser('D'); await signup(D.pg, 'Karim Topo', 'topo@test.ma');
  await D.pg.click('[data-a=join]'); await D.pg.fill('[name=code]', code3); await D.pg.click('.sheet [data-a=ok]');
  await D.pg.waitForSelector('[data-a=join-ok]', { timeout: 15000 }); await D.pg.click('[data-a=join-ok]'); await D.pg.waitForSelector('.home2', { timeout: 20000 });
  // conducteur B : demande d'implantation + commande béton + rendement + pointage (via l'interface pour la 1re)
  await B.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); renderHome(); }); await B.pg.waitForTimeout(800);
  await shot(B.pg, '17_home_conducteur_espace');
  await B.pg.evaluate(async () => { App.homeTab = 'tools'; await renderHome(); const c = document.querySelector('.h2-pane.on [data-cat=esp]'); if (c && !c.classList.contains('on')) c.click(); }); await B.pg.waitForTimeout(300);
  await B.pg.click('[data-es=impl]'); await B.pg.evaluate(() => { App.homeTab = 'home'; }); await B.pg.waitForTimeout(500); await B.pg.click('.es-page .fab'); await B.pg.waitForTimeout(400);
  await B.pg.fill('[name=ouvrage]', 'Voile V12'); await B.pg.fill('[name=niveau]', 'R+3'); await B.pg.fill('[name=zone]', '11'); await B.pg.fill('[name=axes]', 'C-D / 4-6');
  await B.pg.click('.sheet [data-a=ok]'); await B.pg.waitForTimeout(800); await shot(B.pg, '18_impl_detail');
  await B.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove())); await B.pg.waitForTimeout(300); await shot(B.pg, '19_impl_list');
  await B.pg.evaluate(async () => { const pid = (await DB.all('projects'))[0].id, me = Team.uid();
    const c = await DB.put('items', { kind: 'cmd', projectId: pid, date: todayISO(), heure: '08:00', ouvrage: 'Dalle R+4 zone 11', classe: 'B30', vol: 42, mise: 'Pompe', resp: me, by: me, status: 'demandee' });
    await DB.put('items', { kind: 'rdt', projectId: pid, date: todayISO(), tache: 'Coffrage', qte: 120, eff: 6, h: 8, resp: me, by: me });
    await DB.put('items', { kind: 'pt', projectId: pid, date: todayISO(), equipe: 'Coffreurs Z11', resp: me, by: me, lines: [{ n: 'Ahmed', poste: 'coffreur', p: true, h: 8 }, { n: 'Rachid', poste: 'coffreur', p: true, h: 8 }, { n: 'Said', poste: 'manœuvre', p: false, h: 0 }] }); });
  await B.pg.evaluate(() => Sync.run({ force: true })); await B.pg.waitForTimeout(2500);
  // patron : matériel affecté au conducteur
  await A.pg.evaluate(async () => { const pid = (await DB.all('projects'))[0].id; const b = Team.members().find(m => m.role === 'conducteur').uid;
    await DB.put('items', { kind: 'mat', projectId: pid, nom: 'Banche 2,70 m', cat: 'Coffrage', qte: 40, unite: 'u', etat: 'Bon', alloc: { [b]: 24 }, log: [] });
    await DB.put('items', { kind: 'stock', projectId: pid, nom: 'Huile de décoffrage', unite: 'l', qte: 15, seuil: 20 }); });
  await A.pg.evaluate(() => Sync.run({ force: true })); await A.pg.waitForTimeout(2500);
  // topo : reçoit la demande et la passe en implantée
  await D.pg.evaluate(() => Sync.run({ force: true })); await D.pg.waitForTimeout(3000);
  await D.pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); renderHome(); }); await D.pg.waitForTimeout(800);
  await shot(D.pg, '20_home_topo');
  log('D items', await D.pg.evaluate(async () => (await DB.all('items')).map(x => x.kind + ':' + (x.status || ''))));
  await D.pg.evaluate(async () => { App.homeTab = 'tools'; await renderHome(); const c = document.querySelector('.h2-pane.on [data-cat=esp]'); if (c && !c.classList.contains('on')) c.click(); }); await D.pg.waitForTimeout(300);
  await D.pg.click('[data-es=impl]'); await D.pg.evaluate(() => { App.homeTab = 'home'; }); await D.pg.waitForTimeout(500); await D.pg.click('.es-row'); await D.pg.waitForTimeout(500);
  await D.pg.click('[data-st=implantee]'); await D.pg.waitForTimeout(500); await shot(D.pg, '21_topo_implantee');
  await D.pg.evaluate(() => Sync.run({ force: true })); await D.pg.waitForTimeout(2000);
  log('D topo write cmd', await D.pg.evaluate(async () => { try { const pid = (await DB.all('projects'))[0].id; await firebase.firestore().collection('companies').doc(Team.company().id).collection('projects').doc(pid).collection('m').doc('centrale').collection('r').doc('items__x').set({ a: 1 }); return 'ALLOWED (BAD)'; } catch (e) { return 'denied OK: ' + e.code; } }));
  // patron : tableau de bord
  await A.pg.evaluate(() => Sync.run({ force: true })); await A.pg.waitForTimeout(2500);
  log('A items', await A.pg.evaluate(async () => (await DB.all('items')).map(x => x.kind + ':' + (x.status || ''))));
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); openBoardEquipes(); }); await A.pg.waitForTimeout(800);
  await shot(A.pg, '22_board');
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage').forEach(x => x.remove()); openKind('mat'); }); await A.pg.waitForTimeout(600); await A.pg.click('.es-row'); await A.pg.waitForTimeout(500); await shot(A.pg, '23_mat');
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); openKind('pt'); }); await A.pg.waitForTimeout(600); await A.pg.click('.es-row'); await A.pg.waitForTimeout(500); await shot(A.pg, '24_pointage');
  // ---- interfaces par poste et formule
  log('B poste', await B.pg.evaluate(() => JSON.stringify(Org.me())), 'C poste', await C.pg.evaluate(() => JSON.stringify(Org.me())), 'D poste', await D.pg.evaluate(() => JSON.stringify(Org.me())));
  await B.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); App.project = null; renderHome(); }); await B.pg.waitForTimeout(1500);
  log('B tableau de bord', await B.pg.evaluate(() => [...document.querySelectorAll('.st-tile small, .st-ok')].map(x => x.textContent)));
  await shot(B.pg, '26_dash_conducteur');
  log('C sections finance/reception', await C.pg.evaluate(() => [sectionOn('finance'), sectionOn('reception'), Org.can('reception', 'edit'), Org.can('reception', 'see')]));
  // aperçu administrateur : technicien qualité en formule Basic
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); sessionStorage.setItem('st.preview', JSON.stringify({ role: 'techqualite', plan: 'basic' })); });
  log('A aperçu basic', await A.pg.evaluate(() => [Team.canSection('reception'), sectionOn('reception'), featAllowed('reception'), Org.can('reception', 'see'), sectionOn('tasks'), Team.canSection('finance')]));
  await A.pg.evaluate(async () => { const p = (await DB.all('projects'))[0]; await openProject(p); document.querySelectorAll('.sheet-bg,.fullpage').forEach(x => x.remove()); openDrawer(); }); await A.pg.waitForTimeout(900);
  log('A aperçu tiroir', await A.pg.evaluate(() => ({ lock: document.querySelectorAll('.drawer [data-lock]').length, items: [...document.querySelectorAll('.drawer [data-s]')].map(b => b.dataset.s) })));
  await shot(A.pg, '27_apercu_basic_tiroir');
  await A.pg.evaluate(() => { sessionStorage.removeItem('st.preview'); document.querySelectorAll('.drawer,.drawer-bg').forEach(x => x.remove()); });
  log('A sans aperçu', await A.pg.evaluate(() => [Team.canSection('reception'), sectionOn('finance')]));
  log('B peut créer un code', await B.pg.evaluate(() => Team.canInvite()));
  // ---- v1.0.14 : espace personnel (pack Basic, métier) + limites ; organisation BET (interface de la jiha)
  let E, F;
  E = await newUser('E'); await signup(E.pg, 'Hamid Indep', 'hamid@test.ma');
  await E.pg.click('[data-a=perso]'); await E.pg.waitForSelector('.st-offers'); log('E packs proposés', await E.pg.evaluate(() => [...document.querySelectorAll('.st-offers [data-p]')].map(b => b.dataset.p)));
  await E.pg.click('[data-p=basic]'); await E.pg.waitForSelector('[name=me]'); log('E Basic = Free (sans poste)', await E.pg.evaluate(() => [!document.querySelector('[name=role]'), document.querySelector('h1').textContent])); await shot(E.pg, '30_perso_free');
  await E.pg.click('[data-a=go]'); await E.pg.waitForSelector('.home2', { timeout: 20000 }); await E.pg.waitForTimeout(800);
  await E.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove())); await shot(E.pg, '31_perso_home');
  log('E espace', await E.pg.evaluate(() => [Team.isPerso(), Team.plan().k, Team.company().name, Team.me().role, Team.isAdmin(), Org.me() && Org.me().poste]));
  await E.pg.evaluate(() => { App.project = null; renderHome(); }); await E.pg.waitForTimeout(1200); await shot(E.pg, '31b_perso_dash');
  log('E dashboard perso', await E.pg.evaluate(() => { const t = document.querySelector('.h2-body').innerText; return { outils: t.includes('Mes outils professionnels'), direction: /Direction/.test(t), espaceDir: t.includes('Espace Direction'), stats: [...document.querySelectorAll('.st-ps b')].map(b => b.textContent), tools: [...document.querySelectorAll('[data-pt]')].map(b => b.dataset.pt + (b.dataset.locked ? '🔒' : '')), role: (document.querySelector('.h2-role') || {}).textContent }; }));
  log('E profil / metier', await E.pg.evaluate(() => [Team.profil().metier, Team.canInvite(), Team.canSection('org')]));
  await E.pg.evaluate(() => Team.openCompany()); await E.pg.waitForTimeout(1200); await shot(E.pg, '31c_mon_espace');
  log('E mon espace onglets', await E.pg.evaluate(() => [...document.querySelectorAll('.tm-tabs [data-t]')].map(b => b.textContent)));
  await E.pg.click('[data-t=abo]'); await E.pg.waitForTimeout(500); await shot(E.pg, '31d_abonnement');
  log('E abonnement', await E.pg.evaluate(() => [Team.planState().l, (document.querySelector('.st-state') || {}).textContent]));
  await E.pg.evaluate(() => document.querySelectorAll('.fullpage').forEach(x => x.remove()));
  log('E outils basic', await E.pg.evaluate(() => [Team.canSection('tasks'), Team.canSection('reception'), featAllowed('reception')]));
  await E.pg.evaluate(async () => { await DB.put('projects', { name: 'Villa Hamid', type: 'villa', team: [] }); });
  await E.pg.evaluate(() => { window.__lim = Team.checkLimit('projects'); }); await E.pg.waitForTimeout(600);
  log('E limite projets', await E.pg.evaluate(() => (document.querySelector('.sheet h3') || {}).textContent || 'pas de message')); await shot(E.pg, '32_limite_basic');
  await E.pg.click('.opt:has-text("Fermer")'); log('E limite résultat', await E.pg.evaluate(() => window.__lim));
  F = await newUser('F'); await signup(F.pg, 'Sara BET', 'sara@test.ma');
  await F.pg.click('[data-a=create]'); await F.pg.waitForSelector('.st-offers'); await F.pg.click('[data-p=business]'); await F.pg.waitForSelector('.st-orgs');
  await F.pg.click('[data-o=bet]'); await F.pg.waitForSelector('.st-svcs'); log('F services proposés', await F.pg.evaluate(() => [...document.querySelectorAll('.st-svcs .on')].map(b => b.dataset.s)));
  await F.pg.fill('[name=cname]', 'BET Structures'); await F.pg.click('[data-a=go]'); await F.pg.waitForSelector('.home2', { timeout: 20000 }); await F.pg.waitForTimeout(800);
  await F.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove())); await shot(F.pg, '33_bet_home');
  log('F espaces BET', await F.pg.evaluate(() => [...document.querySelectorAll('[data-es]')].map(b => b.dataset.es)));
  log('E espaces basic', await E.pg.evaluate(() => { App.project = null; renderHome(); return [...document.querySelectorAll('[data-es]')].map(b => b.dataset.es); }));
  log('F interface BET', await F.pg.evaluate(() => [Team.orgType().k, Team.me().role, Org.me() && Org.me().service, Team.canSection('plans'), Team.canSection('calc'), Team.canSection('pointage'), Team.canSection('beton'), Org.can('pointage', 'see')]));
  await F.pg.evaluate(() => Team.openCompany('org')); await F.pg.waitForTimeout(1000); await F.pg.click('.tm-page [data-a=invite]'); await F.pg.waitForTimeout(500);
  log('F postes proposés (services)', await F.pg.evaluate(() => [...document.querySelectorAll('[data-f=role] optgroup')].map(g => g.label)));
  await shot(F.pg, '34_bet_invite'); await F.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  log('errors v1.0.14', [...E.errs, ...F.errs]);
  // ---- v1.0.15 : Workspace Switcher (F : son BET + rejoint BTP Test SARL avec un code), données séparées sur le téléphone
  await F.pg.evaluate(async () => { await DB.put('projects', { name: 'Pont BET', type: 'pont', team: [] }); await Sync.run({ force: true }); }); await F.pg.waitForTimeout(1500);
  const betCid = await F.pg.evaluate(() => Team.company().id);
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); Team.openCompany('org'); }); await A.pg.waitForTimeout(1200);
  await A.pg.click('.tm-page [data-a=invite]'); await A.pg.waitForTimeout(400);
  await A.pg.fill('[data-f=name]', 'Sara BET'); await A.pg.selectOption('[data-f=role]', 'bet'); await A.pg.uncheck('[data-all]'); await A.pg.check('[data-p]');
  await A.pg.click('.tm-form [data-a=ok]'); await A.pg.waitForSelector('.opt:has-text("Créer le code")', { timeout: 15000 }); await shot(A.pg, '40_recap_code');
  await A.pg.click('.opt:has-text("Créer le code")'); await A.pg.waitForSelector('.opt:has-text("Fermer")', { timeout: 15000 }); await A.pg.waitForTimeout(400);
  const code5 = (await A.pg.textContent('.sheet:has(.opt:has-text("Fermer")) h3')).split(':').pop().trim(); await A.pg.click('.opt:has-text("Fermer")'); log('code BET', code5);
  await F.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.project = null; renderHome(); }); await F.pg.waitForTimeout(800);
  await shot(F.pg, '41_dash_contexte');
  await F.pg.click('[data-a=wsmenu]'); await F.pg.waitForSelector('.ws-dd [data-wm=switch]'); await F.pg.click('.ws-dd [data-wm=switch]'); await F.pg.waitForSelector('.st-wsl'); await shot(F.pg, '42_switcher');
  await F.pg.click('.st-wsa [data-a=join]'); await F.pg.fill('[name=code]', code5); await F.pg.click('.sheet [data-a=ok]');
  await F.pg.waitForSelector('[data-a=join-ok]', { timeout: 15000 }); await shot(F.pg, '43_confirm_code'); await F.pg.click('[data-a=join-ok]');
  await F.pg.waitForTimeout(3000); await F.pg.waitForSelector('.home2', { timeout: 30000 }); await F.pg.waitForTimeout(1500);
  await F.pg.evaluate(() => Sync.run({ force: true })); await F.pg.waitForTimeout(2500);
  log('F espace 2', await F.pg.evaluate(async () => [Team.company().name, DB.name(), Team.workspaces().length, (await DB.all('projects')).map(p => p.name), Team.me().role]));
  await F.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.project = null; renderHome(); }); await F.pg.waitForTimeout(800); await shot(F.pg, '44_espace_btp');
  try { await F.pg.evaluate((c) => Team.switchTo(c), betCid); } catch (e) {}
  await F.pg.waitForTimeout(3000); await F.pg.waitForSelector('.home2', { timeout: 30000 }); await F.pg.waitForTimeout(1500);
  log('F retour espace 1', await F.pg.evaluate(async () => [Team.company().name, DB.name(), (await DB.all('projects')).map(p => p.name)]));
  log('errors v1.0.15', [...F.errs]);
  // ---- v1.0.17 : logo d'origine, collaborateur sur un projet personnel Pro, révocation de code
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); App.project = null; renderHome(); }); await A.pg.waitForTimeout(800);
  log('logo', await A.pg.evaluate(() => { const c = document.querySelector('.h2-top .st-logo circle'); return [!!c, c ? c.getAttribute('fill') : null]; })); await shot(A.pg, '49_logo_header');
  let G = await newUser('G'); log('logo connexion', await G.pg.evaluate(() => !!document.querySelector('.tm-logo .st-logo'))); await shot(G.pg, '50_logo_connexion');
  await signup(G.pg, 'Nadia Pro', 'nadia@test.ma');
  await G.pg.click('[data-a=perso]'); await G.pg.waitForSelector('.st-offers'); await G.pg.click('[data-p=pro]'); await G.pg.waitForSelector('[name=role]'); await G.pg.selectOption('[name=role]', 'cheftopo');
  await G.pg.click('[data-a=go]'); await G.pg.waitForSelector('.home2', { timeout: 20000 }); await G.pg.waitForTimeout(800);
  await G.pg.evaluate(async () => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); await DB.put('projects', { name: 'Lotissement Nadia', type: 'vrd', team: [] }); await Sync.run({ force: true }); }); await G.pg.waitForTimeout(1500);
  log('G pro', await G.pg.evaluate(() => [Team.plan().k, Team.planState().l, Team.isPerso()]));
  await G.pg.evaluate(async () => { const p = (await DB.all('projects'))[0]; window.__cc = Team.collabFlow(p); }); await G.pg.waitForSelector('[data-cm]', { timeout: 15000 }); await shot(G.pg, '51_collab_form');
  await G.pg.selectOption('[data-cm=reserves]', '2'); await G.pg.click('.tm-form [data-a=ok]'); await G.pg.waitForSelector('.opt:has-text("Fermer")', { timeout: 15000 });
  const code6 = (await G.pg.textContent('.sheet:has(.opt:has-text("Fermer")) h3')).split(':').pop().trim(); await G.pg.click('.opt:has-text("Fermer")'); log('code collaborateur', code6);
  await C.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); Team.openSwitcher(); }); await C.pg.waitForSelector('.st-wsa [data-a=join]');
  await C.pg.click('.st-wsa [data-a=join]'); await C.pg.fill('[name=code]', code6); await C.pg.click('.sheet [data-a=ok]');
  await C.pg.waitForSelector('[data-a=join-ok]', { timeout: 15000 }); await shot(C.pg, '52_collab_confirm'); await C.pg.click('[data-a=join-ok]');
  await C.pg.waitForTimeout(3000); await C.pg.waitForSelector('.home2', { timeout: 30000 }); await C.pg.waitForTimeout(1500);
  await C.pg.evaluate(() => Sync.run({ force: true })); await C.pg.waitForTimeout(2500);
  log('C collaborateur', await C.pg.evaluate(async () => [Team.company().name, Team.me().role, Team.isPerso(), Team.isCollab(), (await DB.all('projects')).map(p => p.name), Team.lvl('reserves'), Team.lvl('reception'), Team.canInvite()]));
  await C.pg.evaluate(() => { App.project = null; renderHome(); }); await C.pg.waitForTimeout(800); await shot(C.pg, '53_collab_home');
  log('C collaborateur : écriture d\'une réserve sur un autre projet refusée', await C.pg.evaluate(async () => { try { await firebase.firestore().collection('companies').doc(Team.company().id).collection('projects').doc('autre').collection('m').doc('reserves').collection('r').doc('tasks__x').set({ store: 'tasks', id: 'x', projectId: 'autre', data: '{}' }); return 'ALLOWED (BAD)'; } catch (e) { return 'denied OK: ' + e.code; } }));
  // révocation d'un code par l'administrateur
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); Team.openCompany('org'); }); await A.pg.waitForTimeout(1200);
  await A.pg.click('.tm-page [data-a=invite]'); await A.pg.waitForTimeout(400); await A.pg.fill('[data-f=name]', 'A révoquer');
  await A.pg.click('.tm-form [data-a=ok]'); await A.pg.waitForSelector('.opt:has-text("Créer le code")', { timeout: 15000 }); await A.pg.click('.opt:has-text("Créer le code")');
  await A.pg.waitForSelector('.opt:has-text("Fermer")', { timeout: 15000 }); await A.pg.waitForTimeout(300);
  const code7 = (await A.pg.textContent('.sheet:has(.opt:has-text("Fermer")) h3')).split(':').pop().trim(); await A.pg.click('.opt:has-text("Fermer")');
  await A.pg.click('[data-t=inv]'); await A.pg.waitForTimeout(1500); await A.pg.click(`[data-del="${code7}"]`); await A.pg.waitForTimeout(400); await A.pg.click('.opt:has-text("Révoquer le code")'); await A.pg.waitForTimeout(1500);
  log('code révoqué', await A.pg.evaluate(async (c) => (await firebase.firestore().collection('invites').doc(c).get()).data().status, code7));
  log('errors v1.0.17', [...G.errs, ...C.errs]);
  // ---- v1.0.18 : service Qualité — services fermés, organigramme qualité, missions, validation des PV, documentation
  log('services par défaut', await setSvcs(['direction', 'qualite', 'externe', 'perso']));
  const H = await newUser('H'); await signup(H.pg, 'Karima Qualité', 'karima@test.ma');
  await H.pg.click('[data-a=create]'); await H.pg.waitForSelector('.st-offers'); await H.pg.click('[data-p=enterprise]'); await H.pg.waitForSelector('.st-orgs');
  await H.pg.click('[data-o=entreprise]'); await H.pg.waitForSelector('.st-svcs'); await shot(H.pg, '60_services_fermes');
  log('H services ouverts / fermés', await H.pg.evaluate(() => [[...document.querySelectorAll('.st-svcs [data-s]')].map(b => b.dataset.s + (b.classList.contains('on') ? '+' : '')), [...document.querySelectorAll('.st-svcs .lk')].map(b => b.dataset.lk)]));
  await H.pg.click('.st-svcs .lk'); await H.pg.waitForTimeout(300);
  log('H service fermé reste fermé', await H.pg.evaluate(() => document.querySelectorAll('.st-svcs .on.lk').length));
  await H.pg.fill('[name=cname]', 'Qualité Maroc SA'); await H.pg.click('[data-a=go]'); await H.pg.waitForSelector('.home2', { timeout: 20000 }); await H.pg.waitForTimeout(800);
  await H.pg.evaluate(async () => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); await DB.put('projects', { name: 'Viaduc Oued Bouregreg', type: 'pont', team: [] }); await Sync.run({ force: true }); }); await H.pg.waitForTimeout(1500);
  log('H organisation', await H.pg.evaluate(() => [Team.plan().k, Team.company().services]));
  await H.pg.evaluate(() => Team.openCompany('org')); await H.pg.waitForTimeout(1200); await H.pg.click('.tm-page [data-a=invite]'); await H.pg.waitForTimeout(500);
  log('H postes qualité proposés', await H.pg.evaluate(() => [...document.querySelectorAll('[data-f=role] option')].filter(o => !o.disabled && o.closest('optgroup') && /qualit/i.test(o.closest('optgroup').label)).map(o => o.value)));
  log('H postes fermés (désactivés)', await H.pg.evaluate(() => [...document.querySelectorAll('[data-f=role] option')].filter(o => o.disabled).length));
  await H.pg.fill('[data-f=name]', 'Omar Technicien'); await H.pg.selectOption('[data-f=role]', 'techqualite'); await shot(H.pg, '61_invite_qualite');
  await H.pg.click('.tm-form [data-a=ok]'); await H.pg.waitForSelector('.opt:has-text("Créer le code")', { timeout: 15000 }); await H.pg.click('.opt:has-text("Créer le code")'); await H.pg.waitForSelector('.opt:has-text("Fermer")', { timeout: 15000 }); await H.pg.waitForTimeout(300);
  const codeQ = (await H.pg.textContent('.sheet:has(.opt:has-text("Fermer")) h3')).split(':').pop().trim(); await H.pg.click('.opt:has-text("Fermer")'); log('code technicien qualité', codeQ);
  const I = await newUser('I'); await signup(I.pg, 'Omar Technicien', 'omar@test.ma');
  await I.pg.click('[data-a=join]'); await I.pg.fill('[name=code]', codeQ); await I.pg.click('.sheet [data-a=ok]');
  await I.pg.waitForSelector('[data-a=join-ok]', { timeout: 15000 }); await I.pg.click('[data-a=join-ok]'); await I.pg.waitForSelector('.home2', { timeout: 20000 });
  await I.pg.evaluate(() => Sync.run({ force: true })); await I.pg.waitForTimeout(2500);
  // missions : l'administrateur charge le technicien
  await H.pg.evaluate(() => Team.refreshMembers()); await H.pg.waitForTimeout(800);
  log('H mission', await H.pg.evaluate(async () => { const m = Team.members().find(x => x.name === 'Omar Technicien'); await firebase.firestore().collection('companies').doc(Team.company().id).collection('members').doc(m.uid).update({ missions: [{ t: 'Réception ferraillage pile P2', at: Date.now() }] }); return m.role; }));
  await H.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); Team.openCompany('org'); }); await H.pg.waitForTimeout(1200); await shot(H.pg, '62_organigramme_qualite');
  log('H gérer les postes', await H.pg.evaluate(() => !!document.querySelector('.tm-page [data-a=postes]')));
  await I.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); location.reload(); }); await I.pg.waitForSelector('.home2', { timeout: 30000 }); await I.pg.waitForTimeout(1500);
  await I.pg.evaluate(async () => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); App.project = null; await renderHome(); ST.openDash(); }); await I.pg.waitForTimeout(800); await shot(I.pg, '63_dash_technicien');
  log('I tableau de bord', await I.pg.evaluate(() => [Team.me().role, [...document.querySelectorAll('.st-mis')].map(x => x.textContent.trim()), !!document.querySelector('[data-stq]')]));
  // PV : le technicien rédige et soumet, l'administrateur valide
  await I.pg.evaluate(async () => { const p = (await DB.all('projects'))[0]; window.__pv = await DB.put('forms', { projectId: p.id, templateId: 'x', title: 'Réception ferraillage P2', location: 'Pile P2', date: todayISO(), inspector: '', notes: '', aut: Team.uid(), vst: 'brouillon', items: [{ label: 'Diamètres conformes', res: 'ok', comment: '' }], photoIds: [] }); openFormDetail(window.__pv); });
  await I.pg.waitForSelector('[data-v=soumettre]', { timeout: 10000 }); await shot(I.pg, '64_pv_brouillon');
  log('I peut valider son PV', await I.pg.evaluate(() => !!document.querySelector('[data-v=valider]')));
  await I.pg.click('[data-v=soumettre]'); await I.pg.waitForTimeout(2500); await I.pg.evaluate(() => Sync.run({ force: true })); await I.pg.waitForTimeout(2000);
  await H.pg.evaluate(() => Sync.run({ force: true })); await H.pg.waitForTimeout(2500);
  await H.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.project = null; await renderHome(); ST.openDash(); }); await H.pg.waitForTimeout(1500); await shot(H.pg, '65_dash_validation');
  log('H tuiles validation', await H.pg.evaluate(() => [...document.querySelectorAll('[data-stq] .st-ps')].map(x => x.textContent.trim())));
  await H.pg.evaluate(async () => { const f = (await DB.all('forms'))[0]; openFormDetail(f); }); await H.pg.waitForSelector('[data-v=valider]', { timeout: 10000 }); await shot(H.pg, '66_pv_a_valider');
  await H.pg.click('[data-v=valider]'); await H.pg.click('.opt:has-text("Valider")'); await H.pg.waitForTimeout(2500); await H.pg.evaluate(() => Sync.run({ force: true })); await H.pg.waitForTimeout(2000);
  await I.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); return Sync.run({ force: true }); }); await I.pg.waitForTimeout(2500);
  log('I PV après validation', await I.pg.evaluate(async () => { const f = (await DB.all('forms'))[0]; return [f.vst, f.vby === f.aut, (f.vhist || []).map(h => h.a)]; }));
  await I.pg.evaluate(async () => { openFormDetail((await DB.all('forms'))[0]); }); await I.pg.waitForTimeout(1200); await shot(I.pg, '67_pv_valide_lecture');
  log('I PV validé en lecture seule', await I.pg.evaluate(() => [...document.querySelectorAll('.fullpage .content input, .fullpage .content textarea')].every(x => x.disabled)));
  log('I modification serveur refusée', await I.pg.evaluate(async () => { const pid = (await DB.all('projects'))[0].id, f = (await DB.all('forms'))[0]; try { await firebase.firestore().collection('companies').doc(Team.company().id).collection('projects').doc(pid).collection('m').doc('forms').collection('r').doc('forms__' + f.id).set({ store: 'forms', id: f.id, projectId: pid, aut: f.aut, vst: 'brouillon', data: '{}' }); return 'ALLOWED (BAD)'; } catch (e) { return 'denied OK: ' + e.code; } }));
  // Documentation & archives
  await H.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); await openProject((await DB.all('projects'))[0]); App.section = 'docq'; renderSection(); }); await H.pg.waitForTimeout(1000);
  await H.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove())); await shot(H.pg, '68_documentation');
  log('H classements', await H.pg.evaluate(() => [...document.querySelectorAll('.st-doc b')].map(x => x.textContent)));
  log('errors v1.0.18', [...H.errs, ...I.errs]);
  // ---- v1.0.19 : projet multi-organisations (le BET de F devient partenaire du projet de H), groupement, historique
  await H.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); await openProject((await DB.all('projects')).find(p => p.name.startsWith('Viaduc'))); document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); App.section = 'orgs'; renderSection(); });
  await H.pg.waitForSelector('.st-pt [data-a=inv]', { timeout: 15000 }); await shot(H.pg, '70_orgs_titulaire');
  await H.pg.click('.st-pt [data-a=inv]'); await H.pg.waitForSelector('.st-pform'); await H.pg.fill('.st-pform [data-f=label]', 'BET Structures'); await shot(H.pg, '71_invite_partenaire');
  await H.pg.click('.st-pform [data-a=ok]'); await H.pg.waitForSelector('.sheet h3:has-text("Code partenaire")', { timeout: 15000 });
  const codeP = (await H.pg.textContent('.sheet h3:has-text("Code partenaire")')).split(':').pop().trim(); await H.pg.click('.opt:has-text("Fermer")'); log('code partenaire', codeP);
  await F.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); Team.openSwitcher(); }); await F.pg.waitForSelector('.st-wsa [data-a=join]');
  await F.pg.click('.st-wsa [data-a=join]'); await F.pg.fill('[name=code]', codeP); await F.pg.click('.sheet [data-a=ok]');
  await F.pg.waitForSelector('[data-a=pj-ok]', { timeout: 15000 }); await shot(F.pg, '72_confirm_partenaire'); await F.pg.click('[data-a=pj-ok]');
  await F.pg.waitForTimeout(3000); await F.pg.evaluate(() => Sync.run({ force: true })); await F.pg.waitForTimeout(3000);
  const vPid = await F.pg.evaluate(async () => { const p = (await DB.all('projects')).find(x => x.name.startsWith('Viaduc')); return p && p.id; });
  log('F projet partenaire', await F.pg.evaluate(async (pid) => { const sh = Team.sharedOf(pid); return [Team.company().name, (await DB.all('projects')).map(p => p.name), sh && sh.role, sh && sh.ownerName]; }, vPid));
  await F.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.project = null; renderHome(); }); await F.pg.waitForTimeout(800); await shot(F.pg, '73_home_partenaire');
  log('F droits dans le projet', await F.pg.evaluate(async (pid) => { await openProject(await DB.get('projects', pid)); document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); return [Team.lvl('reserves'), Team.lvl('projet'), Team.lvl('finance'), Team.canSection('team')]; }, vPid));
  await F.pg.evaluate(async (pid) => { await DB.put('tasks', { projectId: pid, title: 'Avis BET : enrobage pile P2', status: 'open', num: 1 }); await Sync.run({ force: true }); }, vPid); await F.pg.waitForTimeout(2500);
  log('F lecture équipe du titulaire', await F.pg.evaluate(async (pid) => { try { await firebase.firestore().collection('companies').doc(Team.sharedOf(pid).cid).collection('members').get(); return 'ALLOWED (BAD)'; } catch (e) { return 'denied OK: ' + e.code; } }, vPid));
  log('F modifier la fiche du projet refusé', await F.pg.evaluate(async (pid) => { try { await firebase.firestore().collection('companies').doc(Team.sharedOf(pid).cid).collection('projects').doc(pid).update({ name: 'piraté' }); return 'ALLOWED (BAD)'; } catch (e) { return 'denied OK: ' + e.code; } }, vPid));
  await H.pg.evaluate(() => Sync.run({ force: true })); await H.pg.waitForTimeout(2500);
  log('H reçoit la réserve du BET', await H.pg.evaluate(async () => (await DB.all('tasks')).map(t => t.title)));
  await H.pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); App.section = 'orgs'; renderSection(); }); await H.pg.waitForSelector('.st-pt [data-a=jv]', { timeout: 15000 });
  await H.pg.click('.st-pt [data-a=jv]'); await H.pg.waitForSelector('.sheet [name=mand]'); await H.pg.fill('.sheet [name=name]', 'Groupement Qualité Maroc – BET Structures');
  await H.pg.selectOption('.sheet [name=mand]', { index: 1 }); await H.pg.click('.sheet [data-a=ok]'); await H.pg.waitForTimeout(2500); await shot(H.pg, '74_groupement');
  log('H organisations', await H.pg.evaluate(() => [...document.querySelectorAll('.st-pt .tm-inv b')].map(x => x.textContent.trim()).concat([...document.querySelectorAll('.st-jv p')].map(x => x.textContent.trim()))));
  await H.pg.evaluate(() => { App.section = 'histo'; renderSection(); }); await H.pg.waitForTimeout(3000); await shot(H.pg, '75_historique');
  log('H historique', await H.pg.evaluate(() => [...document.querySelectorAll('.st-hrow')].slice(0, 6).map(x => x.textContent.replace(/\s+/g, ' ').trim())));
  await F.pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); App.section = 'orgs'; renderSection(); }); await F.pg.waitForTimeout(2500); await shot(F.pg, '76_orgs_partenaire');
  log('F voit le groupement', await F.pg.evaluate(() => [...document.querySelectorAll('.st-jv p')].map(x => x.textContent.trim()).concat([!!document.querySelector('.st-pt [data-a=inv]'), !!document.querySelector('.st-pt [data-a=leave]')])));
  log('types d\'organisation', await H.pg.evaluate(() => ORG_TYPES.map(t => t.k)));
  log('errors v1.0.19', [...H.errs, ...F.errs]);
  // ---- v1.0.20 : fichiers partagés (Cloud Storage) entre le titulaire (H) et le BET partenaire (F)
  log('stockage activé (Super Admin)', await setSvcs(['direction', 'qualite', 'externe', 'perso'], true));
  log('stockage désactivé par défaut', await H.pg.evaluate(() => Team.cloudOn()));
  for (const X of [H, F]) await X.pg.evaluate(() => { localStorage.setItem('team.cloud', JSON.stringify({ on: true, maxMb: 50 })); });
  log('stockage actif', [await H.pg.evaluate(() => Team.cloudOn()), await F.pg.evaluate(() => Team.cloudOn())]);
  log('H envoie un plan', await H.pg.evaluate(async () => { const p = (await DB.all('projects')).find(x => x.name.startsWith('Viaduc'));
    const f = await DB.put('files', { projectId: p.id, blob: new Blob(['%PDF-1.4 plan de controle pile P2'], { type: 'application/pdf' }), mime: 'application/pdf', name: 'Plan de contrôle pile P2.pdf', role: 'doc', docCat: 'pc', by: Team.uid() });
    await Sync.run({ force: true }); const g = await DB.peek('files', f.id); window.__fid = f.id; return [!!g.sref, g.ssize, (JSON.parse(localStorage.getItem('sync.fails') || '[]'))]; }));
  await F.pg.evaluate(() => Sync.run({ force: true })); await F.pg.waitForTimeout(3500);
  const fid = await H.pg.evaluate(() => window.__fid);
  log('F reçoit le plan', await F.pg.evaluate(async (id) => { const g = await DB.peek('files', id); return g ? [g.name, !!g.blob, g.blob ? await g.blob.text() : null] : 'absent'; }, fid));
  log('F envoie une note', await F.pg.evaluate(async (pid) => { const f = await DB.put('files', { projectId: pid, blob: new Blob(['%PDF-1.4 visa BET'], { type: 'application/pdf' }), mime: 'application/pdf', name: 'Visa BET pile P2.pdf', role: 'doc', docCat: 'visa', by: Team.uid() });
    await Sync.run({ force: true }); const g = await DB.peek('files', f.id); window.__fid2 = f.id; return [!!g.sref, (g.sref || '').split('/').slice(0, 2).join('/') === 'companies/' + Team.sharedOf(pid).cid]; }, vPid));
  await H.pg.evaluate(() => Sync.run({ force: true })); await H.pg.waitForTimeout(3500);
  const fid2 = await F.pg.evaluate(() => window.__fid2);
  log('H reçoit la note du BET', await H.pg.evaluate(async (id) => { const g = await DB.peek('files', id); return g ? [g.name, !!g.blob, g.blob ? await g.blob.text() : null] : 'absent'; }, fid2));
  log('A (autre organisation) : lecture refusée', await A.pg.evaluate(async (path) => { try { await firebase.storage().ref(path).getDownloadURL(); return 'ALLOWED (BAD)'; } catch (e) { return 'denied OK: ' + e.code; } }, await H.pg.evaluate(async (id) => (await DB.peek('files', id)).sref, fid)));
  await F.pg.evaluate(async (pid) => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); await openProject(await DB.get('projects', pid)); document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); App.docCat = null; App.section = 'docq'; renderSection(); }, vPid);
  await F.pg.waitForTimeout(1500); await shot(F.pg, '80_docs_partenaire');
  log('F classements', await F.pg.evaluate(() => [...document.querySelectorAll('.st-doc')].filter(b => !/^0 /.test(b.querySelector('small').textContent)).map(b => b.querySelector('b').textContent + ' : ' + b.querySelector('small').textContent)));
  log('H supprime le plan → fichier retiré du cloud', await H.pg.evaluate(async (id) => { const sref = (await DB.peek('files', id)).sref; await DB.del('files', id); await Sync.run({ force: true }); try { await firebase.storage().ref(sref).getMetadata(); return 'encore présent'; } catch (e) { return e.code; } }, fid));
  log('errors v1.0.20', [...H.errs, ...F.errs]);
  // ---- v1.0.23 : intégration des changements de ChatGPT (services spécialisés, validation, version)
  log('versions comparées', await H.pg.evaluate(() => [verCmp('1.0.10', '1.0.9') > 0, verCmp('1.0.22', '1.0.22') === 0, verCmp('1.0.2', '1.0.10') < 0]));
  log('nouveaux services (entreprise)', await H.pg.evaluate(() => orgTypeOf('entreprise').svcs.filter(k => ['achats', 'magasin', 'rh', 'pointage', 'maintenance', 'methodes', 'etudes', 'contrats', 'transport'].includes(k)).length));
  log('postes : finance et rang', await H.pg.evaluate(() => [tmRoleOf('respachats').perms.finance, tmRoleOf('gestionnairecontrats').perms.finance, tmRoleOf('respachats').rank, tmRoleOf('acheteur').rank]));
  // règle des postes Chantier (org.js, utilisée hors compte SiteTeam) : valider suppose de voir — testée sur la fonction d'origine
  log('valider suppose de voir', await H.pg.evaluate(async () => { const src = await (await fetch('js/org.js')).text(); const body = src.slice(src.indexOf('  can(f, lvl'), src.indexOf('  owner()'));
    const can = new Function('Org', 'ALL_F', 'return ({' + body + '}).can;')({ poste: () => ({ f: ['plans'], va: ['tasks'], ro: [] }), owner: () => false }, '*');
    const O = { poste: () => ({ f: ['plans'], va: ['tasks'], ro: [] }), owner: () => false }; const c = can.bind(O);
    return [c('tasks', 'valid'), c('plans', 'see'), c('plans', 'edit')]; }));
  await H.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); Team.openCompany('org'); }); await H.pg.waitForTimeout(1200);
  await H.pg.click('.tm-page [data-a=invite]'); await H.pg.waitForTimeout(500);
  log('postes remplacés non proposés', await H.pg.evaluate(() => [...document.querySelectorAll('[data-f=role] option')].map(o => o.value).filter(v => ['magasinier', 'resppointage', 'pointeur'].includes(v))));
  await H.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); showVersion(); }); await H.pg.waitForSelector('.ver-box .tm-box', { timeout: 10000 }); await shot(H.pg, '90_version');
  log('écran version', await H.pg.evaluate(() => document.querySelector('.ver-box').innerText.replace(/\s+/g, ' ').slice(0, 160)));
  log('errors v1.0.23', [...H.errs]);
  // ---- v1.0.24 : panneau d'administration et décisions appliquées dans l'application
  log('packs refermés (Basic seul)', await setPacks(false));
  const J = await newUser('J'); await signup(J.pg, 'Jamal Invité', 'jamal@test.ma');
  await J.pg.click('[data-a=create]'); await J.pg.waitForSelector('.st-offers'); await shot(J.pg, '91_packs_fermes');
  log('J packs : ouverts / sur demande', await J.pg.evaluate(() => [[...document.querySelectorAll('.st-offers [data-p]')].map(b => b.dataset.p), [...document.querySelectorAll('.st-offers [data-req]')].map(b => b.dataset.req)]));
  const pdv = await J.pg.evaluate(() => ['business', 'enterprise', 'basic'].map(k => { const c = document.querySelector('.st-offers [data-offer=' + k + ']'); return k + ':' + (c ? (/En cours de développement/.test(c.textContent) ? 'dev' : 'prix') + (/MAD/.test(c.textContent) ? '+MAD' : '') : 'absent'); }));
  log('Packs en développement (aucun prix)', pdv);
  if (pdv.join() !== 'business:dev,enterprise:dev,basic:prix') throw new Error('packs en développement KO ' + pdv.join());
  await J.pg.click('[data-req=business]'); await J.pg.waitForSelector('.sheet [name=msg]'); await J.pg.fill('.sheet [name=msg]', '12 utilisateurs, 3 chantiers'); await J.pg.click('.sheet [data-a=ok]');
  await J.pg.waitForSelector('.opt:has-text("OK")', { timeout: 15000 }); log('J demande envoyée', await J.pg.textContent('.sheet h3')); await J.pg.click('.opt:has-text("OK")');
  log('J refus serveur d\'un pack fermé', await J.pg.evaluate(async () => { try { await firebase.firestore().collection('companies').doc('jx1').set({ name: 'X', ownerUid: firebase.auth().currentUser.uid, plan: 'business', planStatus: 'essai' }); return 'ALLOWED (BAD)'; } catch (e) { return 'denied OK: ' + e.code; } }));
  await J.pg.click('[data-p=basic]'); await J.pg.waitForSelector('.st-orgs'); await J.pg.click('[data-o=entreprise]'); await J.pg.waitForSelector('.st-svcs');
  await J.pg.fill('[name=cname]', 'Jamal BTP'); await J.pg.click('[data-a=go]'); await J.pg.waitForSelector('.home2', { timeout: 20000 });
  // Super Admin (compte du propriétaire)
  const SA = await newUser('SA'); await signup(SA.pg, 'Super Admin', 'abdessamad.daga94@gmail.com');
  await SA.pg.click('[data-a=create]'); await SA.pg.waitForSelector('.st-offers');
  log('Super Admin : tous les packs ouverts', await SA.pg.evaluate(() => [document.querySelectorAll('.st-offers [data-p]').length, document.querySelectorAll('.st-offers [data-req]').length]));
  await SA.pg.goto('http://127.0.0.1:8765/admin.html?emu=1'); await SA.pg.waitForSelector('.tile', { timeout: 30000 }); await SA.pg.waitForTimeout(800); await shot(SA.pg, '92_admin_tableau');
  log('admin tableau de bord', await SA.pg.evaluate(() => [...document.querySelectorAll('.tile')].map(t => t.innerText.replace(/\s+/g, ' '))));
  const tabA = async (k) => { await SA.pg.click(`nav [data-t=${k}]`); await SA.pg.waitForTimeout(900); };
  await tabA('users'); await shot(SA.pg, '93_admin_utilisateurs');
  log('admin utilisateurs', await SA.pg.evaluate(() => document.querySelectorAll('#ul .row').length));
  await SA.pg.fill('#q-users', 'jamal'); await SA.pg.waitForTimeout(300); await SA.pg.click('#ul .row'); await SA.pg.waitForSelector('dialog [name=why]');
  await SA.pg.fill('dialog [name=why]', 'Test du blocage'); await SA.pg.click('dialog button:has-text("Bloquer le compte")'); await SA.pg.waitForTimeout(1500);
  await J.pg.reload(); await J.pg.waitForSelector('.st-gate, .home2', { timeout: 30000 }); await shot(J.pg, '94_compte_bloque');
  log('J après blocage', await J.pg.evaluate(() => (document.querySelector('.st-gate h1') || {}).textContent || 'pas bloqué'));
  log('J données refusées', await J.pg.evaluate(async () => { try { await firebase.firestore().collection('companies').doc(JSON.parse(localStorage.getItem('team.cid'))).get(); return 'ALLOWED (BAD)'; } catch (e) { return 'denied OK: ' + e.code; } }));
  await SA.pg.fill('#q-users', 'jamal'); await SA.pg.waitForTimeout(300); await SA.pg.click('#ul .row'); await SA.pg.waitForSelector('dialog'); await SA.pg.click('dialog button:has-text("Débloquer")'); await SA.pg.waitForTimeout(1500);
  await J.pg.reload(); await J.pg.waitForSelector('.st-gate, .home2', { timeout: 30000 }); log('J après déblocage', await J.pg.evaluate(() => !!document.querySelector('.home2') && !document.querySelector('.st-gate')));
  await tabA('orgs'); await shot(SA.pg, '95_admin_organisations');
  await SA.pg.fill('#q-orgs', 'Qualité Maroc'); await SA.pg.waitForTimeout(300); await SA.pg.click('#ol .row'); await SA.pg.waitForSelector('dialog [name=st]');
  await SA.pg.selectOption('dialog [name=st]', 'suspendu'); await SA.pg.click('dialog button:has-text("Enregistrer")'); await SA.pg.waitForSelector('dialog button:has-text("Suspendre")'); await SA.pg.click('dialog button:has-text("Suspendre")'); await SA.pg.waitForTimeout(1500);
  await H.pg.goto('http://127.0.0.1:8765/?emu=1'); await H.pg.waitForSelector('.st-gate, .home2', { timeout: 30000 }); await shot(H.pg, '96_org_suspendue');
  log('H organisation suspendue', await H.pg.evaluate(() => (document.querySelector('.st-gate h1') || {}).textContent || 'pas suspendue'));
  await SA.pg.fill('#q-orgs', 'Qualité Maroc'); await SA.pg.waitForTimeout(300); await SA.pg.click('#ol .row'); await SA.pg.waitForSelector('dialog [name=st]'); await SA.pg.selectOption('dialog [name=st]', 'actif'); await SA.pg.click('dialog button:has-text("Enregistrer")'); await SA.pg.waitForTimeout(1500);
  await tabA('reqs'); await shot(SA.pg, '97_admin_demandes');
  log('admin demandes', await SA.pg.evaluate(() => [...document.querySelectorAll('#rl .row')].map(r => r.innerText.replace(/\s+/g, ' ').slice(0, 90))));
  await SA.pg.click('#rl .row'); await SA.pg.waitForSelector('dialog'); await SA.pg.click('dialog button:has-text("Accepter")'); await SA.pg.waitForTimeout(1500);
  await tabA('ctrl'); await shot(SA.pg, '98_admin_controle');
  await SA.pg.check('[name=gon]'); await SA.pg.fill('[name=gtext]', 'Bienvenue sur SiteTeam 1.0.24 : nouveau panneau de contrôle.'); await SA.pg.click('[data-a=msg]'); await SA.pg.waitForTimeout(1200);
  await SA.pg.check('[data-off=finance]'); await SA.pg.click('[data-a=off]'); await SA.pg.waitForTimeout(1200);
  await tabA('ann'); await SA.pg.click('[data-a=new]'); await SA.pg.waitForSelector('dialog [name=text]'); await SA.pg.fill('dialog [name=title]', 'Maintenance prévue'); await SA.pg.fill('dialog [name=text]', 'Dimanche 22 h : mise à jour de 10 minutes.');
  await SA.pg.click('dialog button:has-text("Envoyer")'); await SA.pg.waitForTimeout(1500);
  await H.pg.goto('http://127.0.0.1:8765/?emu=1'); await H.pg.waitForSelector('.home2', { timeout: 30000 }); await H.pg.waitForTimeout(4500); await shot(H.pg, '99_message_annonce');
  log('H message accueil', await H.pg.evaluate(() => (document.querySelector('.st-msg p') || {}).textContent || 'aucun'));
  log('H annonce reçue', await H.pg.evaluate(() => [...document.querySelectorAll('.st-ann b')].map(b => b.textContent)));
  log('H fonction coupée (finance)', await H.pg.evaluate(() => [Team.isOff('finance'), Team.canSection('fin')]));
  await H.pg.evaluate(() => { setTimeout(() => { throw new Error('Erreur de test SiteTeam 1.0.24'); }, 10); }); await H.pg.waitForTimeout(2000);
  await SA.pg.click('[data-a=reload]'); await SA.pg.waitForTimeout(1500); await tabA('err'); await shot(SA.pg, '100_admin_erreurs');
  log('admin erreurs', await SA.pg.evaluate(() => [...document.querySelectorAll('main .row b')].map(b => b.textContent).filter(t => /Erreur de test/.test(t))));
  await tabA('ctrl'); await SA.pg.check('[name=mon]'); await SA.pg.fill('[name=mtext]', 'Maintenance de test'); await SA.pg.click('[data-a=ver]'); await SA.pg.waitForTimeout(1200);
  await G.pg.goto('http://127.0.0.1:8765/?emu=1'); await G.pg.waitForSelector('.st-gate, .home2', { timeout: 30000 });
  log('G maintenance', await G.pg.evaluate(() => (document.querySelector('.st-gate h1') || {}).textContent || 'pas de maintenance'));
  await SA.pg.uncheck('[name=mon]'); await SA.pg.click('[data-a=ver]'); await SA.pg.waitForTimeout(1000); await SA.pg.uncheck('[data-off=finance]'); await SA.pg.click('[data-a=off]'); await SA.pg.waitForTimeout(800);
  log('errors v1.0.24', [...J.errs, ...SA.errs].filter(x => !/Erreur de test|403|permission/i.test(x)));
  // codes pack : le Super Admin crée un code Business, une nouvelle personne l'entre à la création de son organisation
  await SA.pg.goto('http://127.0.0.1:8765/admin.html?emu=1#codes'); await SA.pg.waitForSelector('[data-a=mk]', { timeout: 30000 });
  await SA.pg.selectOption('[name=plan]', 'business'); await SA.pg.fill('[name=days]', '30'); await SA.pg.fill('[name=note]', 'Test parcours'); await SA.pg.click('[data-a=mk]');
  await SA.pg.waitForSelector('dialog h3', { timeout: 15000 }); const codeB = (await SA.pg.textContent('dialog h3')).trim(); await shot(SA.pg, '101_admin_code'); log('code pack créé', codeB);
  await SA.pg.click('dialog button:has-text("Fermer")');
  const K = await newUser('K'); await signup(K.pg, 'Karim Code', 'karim@test.ma');
  await K.pg.click('[data-a=create]'); await K.pg.waitForSelector('[data-a=pcode]'); await K.pg.click('[data-a=pcode]'); await K.pg.fill('.sheet [name=code]', codeB.toLowerCase()); await K.pg.click('.sheet [data-a=ok]');
  await K.pg.waitForSelector('.st-orgs', { timeout: 15000 }); await K.pg.click('[data-o=entreprise]'); await K.pg.waitForSelector('.st-svcs'); await K.pg.fill('[name=cname]', 'Karim Travaux'); await K.pg.click('[data-a=go]');
  await K.pg.waitForSelector('.home2', { timeout: 30000 });
  log('K pack par code', await K.pg.evaluate(() => [Team.plan().k, Team.company().planStatus, Team.company().packCode ? 'code' : '']));
  log('K utilisation enregistrée', await K.pg.evaluate(async (c) => { try { const d = await firebase.firestore().collection('packCodes').doc(c).get(); return [d.data().uses, d.data().usedBy.length]; } catch (e) { return e.code; } }, codeB));
  // l'administratrice de « Jamal BTP » (Basic) passe à Enterprise avec un code
  await SA.pg.goto('http://127.0.0.1:8765/admin.html?emu=1#codes'); await SA.pg.waitForSelector('[data-a=mk]', { timeout: 30000 });
  await SA.pg.selectOption('[name=plan]', 'enterprise'); await SA.pg.fill('[name=days]', '0'); await SA.pg.click('[data-a=mk]'); await SA.pg.waitForSelector('dialog h3');
  const codeE = (await SA.pg.textContent('dialog h3')).trim(); await SA.pg.click('dialog button:has-text("Fermer")');
  await J.pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); Team.applyPackCode(); }); await J.pg.waitForSelector('.sheet [name=code]'); await J.pg.fill('.sheet [name=code]', codeE); await J.pg.click('.sheet [data-a=ok]');
  await J.pg.waitForSelector('.opt:has-text("Activer")', { timeout: 15000 }); await J.pg.click('.opt:has-text("Activer")'); await J.pg.waitForSelector('.opt:has-text("OK")', { timeout: 15000 }); await J.pg.click('.opt:has-text("OK")');
  await J.pg.waitForSelector('.home2', { timeout: 30000 }); log('J passage par code', await J.pg.evaluate(() => [Team.plan().k, Team.company().planStatus]));
  log('errors v1.0.27', [...K.errs, ...J.errs].filter(x => !/403|permission/i.test(x)));
  // le Super Admin choisit un pack fermé pour son propre espace, puis change de pack sans demande
  await SA.pg.goto('http://127.0.0.1:8765/?emu=1'); await SA.pg.waitForSelector('.tm-choice', { timeout: 30000 });
  await SA.pg.click('[data-a=perso]'); await SA.pg.waitForSelector('.st-offers'); log('Super Admin : Pro choisissable', await SA.pg.evaluate(() => [!!document.querySelector('[data-p=pro]'), !!document.querySelector('[data-req]')]));
  await SA.pg.click('[data-p=pro]'); await SA.pg.waitForSelector('[name=role]'); await SA.pg.click('[data-a=go]'); await SA.pg.waitForSelector('.home2', { timeout: 30000 });
  log('Super Admin : espace en Pro', await SA.pg.evaluate(() => Team.plan().k));
  await SA.pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); Team.requestPack('basic', true); }); await SA.pg.waitForSelector('.opt:has-text("Activer"), .sheet [data-a=ok]', { timeout: 10000 });
  await SA.pg.click('.opt:has-text("Activer"), .sheet [data-a=ok]'); await SA.pg.waitForTimeout(2500); await SA.pg.waitForSelector('.home2', { timeout: 30000 });
  log('Super Admin : changement direct (sans demande)', await SA.pg.evaluate(() => [Team.plan().k, Team.company().planStatus]));
  log('packs rouverts (test)', await setPacks(true));
  // ---- v1.0.28 : menus réorganisés, espace Free, écran des packs défilable
  log('E accueil Free', await E.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.project = null; renderHome(); return [Team.isFree(), !!document.querySelector('.st-promo'), (document.querySelector('.h2-role') || {}).textContent]; }));
  await E.pg.waitForTimeout(500); await shot(E.pg, '102_free_accueil');
  log('G Pro : poste choisi', await G.pg.evaluate(() => [Team.isFree(), Team.profil().metier]));
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.project = null; renderHome(); }); await A.pg.waitForTimeout(600);
  await A.pg.evaluate(() => document.querySelector('[data-a=homemore]').click()); await A.pg.waitForSelector('.gm'); await shot(A.pg, '103_menu_accueil');
  log('menu ⋮ (groupes · rubriques)', await A.pg.evaluate(() => [[...document.querySelectorAll('.gm-g')].map(x => x.textContent), document.querySelectorAll('.gm-i').length]));
  await A.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  await A.pg.evaluate(async () => { await openProject((await DB.all('projects'))[0]); document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); openDrawer(); }); await A.pg.waitForTimeout(700); await shot(A.pg, '104_menu_projet');
  log('menu projet (groupes)', await A.pg.evaluate(() => [...document.querySelectorAll('.drawer .dr-gh span')].map(x => x.textContent + ' ' + x.nextElementSibling.textContent)));
  await A.pg.evaluate(() => document.querySelectorAll('.drawer,.drawer-bg').forEach(x => x.remove()));
  const Z = await newUser('Z'); await signup(Z.pg, 'Zineb Scroll', 'zineb@test.ma'); await Z.pg.click('[data-a=create]'); await Z.pg.waitForSelector('.st-offers');
  log('packs : haut de l\'écran visible', await Z.pg.evaluate(() => { const el = document.querySelector('.tm-login'); el.scrollTop = 0; const h = document.querySelector('.tm-lg-in h1').getBoundingClientRect(); return [Math.round(h.top) >= 0, el.scrollHeight > el.clientHeight]; }));
  log('errors v1.0.28', [...E.errs, ...Z.errs, ...A.errs].filter(x => !/403|400|permission/i.test(x)));
  // ---- v1.0.29 : Google Drive connecté depuis l'application (sans script.google.com), avec un faux Drive
  const FD = fakeDrive(); await E.ctx.route('https://www.googleapis.com/**', FD.handle);
  log('Drive : sans plugin (web) → méthode avancée seule', await E.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); Sync.openSyncSettings(); return [!!document.querySelector('[data-a=google]'), !!document.querySelector('.gd-adv[open]')]; }));
  await E.pg.evaluate(() => {
    document.querySelectorAll('.sheet-bg').forEach(x => x.remove());
    window.Capacitor = window.Capacitor || {}; window.Capacitor.Plugins = window.Capacitor.Plugins || {};
    window.__gd = { n: 0, cleared: [] };
    window.Capacitor.Plugins.GDriveAuth = { authorize: async (o) => { window.__gd.n++; window.__gd.last = o; return { accessToken: 'tok' + window.__gd.n, scopes: o.scopes }; }, clearToken: async (o) => { window.__gd.cleared.push(o.token); } };
    Sync.openSyncSettings();
  });
  await E.pg.waitForSelector('[data-a=google]'); await shot(E.pg, '105_drive_connecter');
  await E.pg.evaluate(async () => { let p = (await DB.all('projects'))[0]; if (!p) { await DB.put('projects', { name: 'Villa Hamid' }); p = (await DB.all('projects'))[0]; } await DB.put('files', { projectId: p.id, name: 'photo.jpg', mime: 'image/jpeg', role: 'photo', blob: new Blob([new Uint8Array(3000)], { type: 'image/jpeg' }) }); });
  await E.pg.click('[data-a=google]'); await E.pg.waitForFunction(() => Sync.cfg() && Sync.cfg().mode === 'g' && !document.querySelector('.loading'), null, { timeout: 30000 }); await E.pg.waitForTimeout(3000);
  log('Drive : connecté avec Google', await E.pg.evaluate(() => [Sync.cfg().mode, Sync.cfg().email, /drive\.google\.com\/drive\/folders\//.test(Sync.cfg().folder), Sync.hasDrive(), window.__gd.last.interactive, window.__gd.last.scopes]));
  await E.pg.evaluate(() => Sync.run({ force: true })); await E.pg.waitForTimeout(4000);
  log('Drive : fichiers rangés', FD.tree().filter(x => !/db\.json/.test(x)).slice(0, 6));
  log('Drive : photo envoyée', await E.pg.evaluate(async () => (await DB.all('files')).filter(f => f.name === 'photo.jpg').map(f => [!!f.driveId, !!f.drivePath])));
  log('Drive : push/pull (base de synchro)', await E.pg.evaluate(async () => {
    await Sync._call('push', { records: [{ _store: 'tasks', id: 't1', title: 'A', updatedAt: 10 }, { _store: 'tasks', id: 't2', title: 'B', updatedAt: 10 }] });
    await Sync._call('push', { records: [{ _store: 'tasks', id: 't1', title: 'ancien', updatedAt: 5 }] });   // plus ancien : ignoré
    const a = await Sync._call('pull', { since: 0 }), b = await Sync._call('pull', { since: a.now });
    return [a.records.map(r => r.id + ':' + r.title).sort().join(','), b.records.length, a.now > 0];
  }));
  log('Drive : envoi / lecture / gros fichier / contrôle', await E.pg.evaluate(async () => {
    const up = await Sync._call('upload', { path: ['Test', 'Sous'], name: 'a.bin', mime: 'application/octet-stream', blob: new Blob([new Uint8Array(1234)]) });
    const mv = await Sync._call('upload', { driveId: up.id, path: ['Test', 'Autre'], name: 'b.bin' });
    const d = await Sync._call('download', { id: up.id });
    const big = await Sync._call('upload', { path: ['Test'], name: 'plan.pdf', mime: 'application/pdf', blob: new Blob([new Uint8Array(5 * 1048576)], { type: 'application/pdf' }) });
    const ck = await Sync._call('check', { ids: [up.id, 'inexistant'] });
    const oc = await Sync._call('ocr', { b64: btoa('img'), mime: 'image/jpeg' });
    return [mv.id === up.id, d.blob.size, !!big.id, ck.missing, /Voile V12/.test(oc.text)];
  }));
  log('Drive : arborescence', FD.tree().filter(x => /Test\//.test(x)));
  FD.fail401.add('tok1');
  log('Drive : jeton expiré → renouvelé', await E.pg.evaluate(async () => { GDrive._reset(); const r = await Sync._call('pull', { since: 0 }).then(() => 'ok', e => e.message); return [r, window.__gd.cleared.length > 0, window.__gd.n]; }));
  log('Drive : dossiers en double fusionnés', await E.pg.evaluate(async () => (await Sync._call('dedupe', {})).ok));
  await E.pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); Sync.openSyncSettings(); }); await E.pg.waitForTimeout(800); await shot(E.pg, '106_drive_connecte');
  log('Drive : écran connecté (sans bouton script)', await E.pg.evaluate(() => [!!document.querySelector('[data-a=script]'), !!document.querySelector('[data-a=code]'), document.querySelector('.sync-card').textContent.includes('hamid@gmail.com')]));
  await E.pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); Sync.disconnect(); });
  log('Drive : déconnecté', await E.pg.evaluate(() => [Sync.cfg(), localStorage.getItem('gd.root')]));
  log('errors v1.0.29', E.errs.filter(x => !/401|403|400|permission/i.test(x)));   // 401 = jeton expiré simulé
  // ---- v1.0.30 : SiteTeam UI Kit, tableau de bord « Vue Direction », taille selon le pack, fil d'Ariane, plusieurs postes, anti-capture
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); App.project = null; renderHome().then(() => ST.openDash()); }); await A.pg.waitForSelector('.st-dir', { timeout: 15000 });
  await A.pg.waitForFunction(() => !document.querySelector('.st-kpi b') || document.querySelector('.st-kpi b').textContent !== '…', null, { timeout: 15000 }); await A.pg.waitForTimeout(600);
  await shot(A.pg, '107_vue_direction');
  log('Vue Direction (A, Business)', await A.pg.evaluate(() => [Team.taille(), document.querySelector('.st-hd b').textContent, document.querySelectorAll('.st-kpi').length, [...document.querySelectorAll('.st-kpi b')].every(b => b.textContent !== '…'), !!document.querySelector('.st-perf-c svg'), document.querySelectorAll('.st-svc2').length > 0, document.documentElement.classList.contains('th-st'), document.querySelectorAll('.st-bnav button').length]));
  await A.pg.evaluate(() => document.querySelector('.st-dashc').scrollTo(0, 99999)); await A.pg.waitForTimeout(400); await shot(A.pg, '108_vue_direction_bas');
  log('Free (E) : pas de Vue Direction, barre du bas', await E.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.project = null; renderHome(); return new Promise(r => setTimeout(() => r([Team.taille(), !!document.querySelector('.st-dir'), [...document.querySelectorAll('.st-bnav span')].map(x => x.textContent)]), 800)); }));
  await shot(E.pg, '109_free_ui_kit');
  // fil d'Ariane : Entreprise › Projet, retour au tableau de bord
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage').forEach(x => x.remove()); await openProject((await DB.all('projects'))[0]); document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); App.section = 'tasks'; await renderSection(); }); await A.pg.waitForTimeout(600);
  log('fil d\'Ariane', await A.pg.evaluate(() => [!!document.querySelector('.tb-crumb a'), (document.querySelector('.tb-crumb') || {}).textContent, document.getElementById('app').classList.contains('with-bnav')]));
  await shot(A.pg, '110_fil_ariane');
  await A.pg.click('.tb-crumb a'); await A.pg.waitForSelector('.h2-pane.on', { timeout: 10000 }); log('fil d\'Ariane → tableau de bord', await A.pg.evaluate(() => !App.project));
  // plusieurs postes : l'administrateur ajoute un poste Qualité au conducteur B
  const bUid = await B.pg.evaluate(() => Team.uid()), bBefore = await B.pg.evaluate(() => ({ ...(Team.me() || {}).perms }));
  await A.pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); Team.openCompany('mem'); }); await A.pg.waitForSelector(`[data-uid="${bUid}"]`, { timeout: 15000 });
  await A.pg.click(`[data-uid="${bUid}"]`); await A.pg.click('.opt:has-text("Poste, projets et droits")'); await A.pg.waitForSelector('[data-a=addposte]', { timeout: 10000 });
  await A.pg.click('[data-a=addposte]'); await A.pg.waitForTimeout(400); await A.pg.locator('.opt:has-text("Qualité ›")').first().click(); await A.pg.waitForTimeout(400);
  await shot(A.pg, '111_plusieurs_postes');
  await A.pg.locator('.sheet [data-a=ok]').last().click(); await A.pg.waitForTimeout(2500);
  await B.pg.evaluate(() => Team.refreshMembers()); await B.pg.waitForTimeout(1500);
  log('plusieurs postes (B)', await B.pg.evaluate((before) => { const m = Team.me() || {}, P = m.perms || {}; return [(m.postes || []).length, Object.keys(P).some(k => (P[k] || 0) > (before[k] || 0))]; }, bBefore));
  log('liste équipe : postes affichés', await A.pg.evaluate((u) => { const b = document.querySelector(`[data-uid="${u}"] small`); return b ? b.textContent.includes('+') : null; }, bUid));
  // anti-capture : option de l'organisation (sur Android FLAG_SECURE ; ici la classe témoin)
  await A.pg.evaluate(() => { document.querySelectorAll('.sheet-bg,.fullpage').forEach(x => x.remove()); Team.openCompany('set'); }); await A.pg.waitForSelector('[data-a=secure]', { timeout: 15000 });
  await A.pg.click('[data-a=secure]'); await A.pg.waitForTimeout(1500);
  log('anti-capture', await A.pg.evaluate(() => [Team.secureOn(), document.documentElement.classList.contains('st-secure'), Team.company().secureScreen]));
  await A.pg.click('[data-a=secure]'); await A.pg.waitForTimeout(1200); log('anti-capture désactivé', await A.pg.evaluate(() => Team.secureOn()));
  log('Enterprise : serveur privé', await Z.pg.evaluate(() => !!document.querySelector('[data-offer=enterprise] .st-of-srv')));
  await A.pg.evaluate(() => { document.querySelectorAll('.sheet-bg,.fullpage').forEach(x => x.remove()); App.project = null; renderHome(); });
  // poste et service verrouillés : un membre d'organisation n'a aucun moyen de changer son poste ; un Pro ne change plus le sien
  log('poste verrouillé (membre B)', await B.pg.evaluate(async () => { const before = Team.me().role; document.querySelectorAll('.sheet-bg,.fullpage').forEach(x => x.remove()); await Team.openCompany('me'); await new Promise(r => setTimeout(r, 800));
    const ui = !!document.querySelector('.fullpage select[data-f=role], .sheet select[data-f=role], [data-a=st-poste]'); document.querySelectorAll('.sheet-bg,.fullpage').forEach(x => x.remove()); return [before, ui]; }));
  log('poste verrouillé (Pro G)', await G.pg.evaluate(async () => [Team.profil().metier, await Team.askPoste(true), Team.profil().metier]));
  // tableau de bord du service (membre B) + outils par catégorie
  await B.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); App.project = null; App.homeTab = 'home'; renderHome().then(() => ST.openDash()); }); await B.pg.waitForSelector('[data-stsvc]', { timeout: 15000 });
  await B.pg.waitForFunction(() => [...document.querySelectorAll('[data-stsvc] .st-kpi b')].every(b => b.textContent !== '…'), null, { timeout: 15000 }); await B.pg.waitForTimeout(500);
  await shot(B.pg, '112_service_dashboard');
  log('tableau de bord service (B)', await B.pg.evaluate(() => [document.querySelector('[data-stsvc] .st-hd b').textContent, document.querySelectorAll('[data-stsvc] .st-kpi').length, document.querySelectorAll('.st-tcat').length > 0, document.querySelectorAll('.st-tool').length > 0]));
  await B.pg.evaluate(() => { document.querySelectorAll('.fullpage').forEach(x => x.remove()); App.homeTab = 'tools'; renderHome(); }); await B.pg.waitForTimeout(600); await shot(B.pg, '113_outils_categories');
  await B.pg.evaluate(async () => { App.homeTab = 'tools'; await renderHome(); }); await B.pg.waitForTimeout(300);
  await B.pg.evaluate(() => { const c = document.querySelector('.h2-pane.on .st-tcats [data-cat]:not([data-cat=esp])'); if (c && !c.classList.contains('on')) c.click(); }); await B.pg.waitForTimeout(300);   // v1.0.35 : outils visibles après le toucher d'une catégorie
  await B.pg.locator('.h2-pane.on .st-tcat:not([style*="display: none"]) .st-tool').first().click(); await B.pg.waitForTimeout(800); const sel = await B.pg.$('.opt'); if (sel) { await sel.click(); await B.pg.waitForTimeout(1200); }
  log('outil → projet ouvert', await B.pg.evaluate(() => !!App.project));
  await B.pg.evaluate(() => { App.homeTab = 'home'; });
  await B.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); App.project = null; renderHome(); });
  log('errors v1.0.30', [...A.errs, ...B.errs, ...E.errs, ...Z.errs].filter(x => !/401|403|400|permission/i.test(x)));
  // ---- v1.0.31 : assistant de création de projet (type → fiche → caractéristiques → lots suggérés → zones → services → récap)
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); App.project = null; renderHome(); }); await A.pg.waitForTimeout(500);
  await A.pg.click('.fab'); await A.pg.waitForSelector('.wz .st-types'); await shot(A.pg, '114_wizard_type');
  await A.pg.click('.wz [data-f=bat]'); await A.pg.waitForTimeout(400); await A.pg.click('.opt:has-text("Bâtiment (logements")'); await A.pg.waitForSelector('.wz [data-fi=name]');
  await A.pg.fill('.wz [data-fi=name]', 'Tour Casa Marina'); await A.pg.fill('.wz [data-fi=code]', 'TCM-01'); await A.pg.fill('.wz [data-fi=address]', 'Casablanca'); await shot(A.pg, '115_wizard_fiche');
  await A.pg.click('.wz [data-a=next]'); await A.pg.waitForSelector('.wz [data-ca=niv]');
  await A.pg.click('.wz [data-env=grand]'); await A.pg.fill('.wz [data-ca=niv]', '6'); await A.pg.fill('.wz [data-ca=ss]', '2'); await A.pg.fill('.wz [data-ca=blocs]', 'A, B'); await A.pg.check('.wz [data-ca=parking]'); await shot(A.pg, '116_wizard_carac');
  await A.pg.click('.wz [data-a=next]'); await A.pg.waitForSelector('.wz .wz-sug'); await shot(A.pg, '117_wizard_lots');
  log('wizard : suggestions expliquées', await A.pg.evaluate(() => [...document.querySelectorAll('.wz-sug label')].map(l => l.textContent.trim()).slice(0, 6)));
  await A.pg.click('.wz [data-a=next]'); await A.pg.waitForSelector('.wz [data-zones]'); await shot(A.pg, '118_wizard_zones');
  log('wizard : zones générées', await A.pg.evaluate(() => { const z = document.querySelector('[data-zones]').value.split('\n'); return [z.length, z[0], z[z.length - 1]]; }));
  await A.pg.click('.wz [data-a=next]'); await A.pg.waitForTimeout(400);
  log('wizard : étape services (entreprise moyenne)', await A.pg.evaluate(() => [document.querySelector('.wz-h b').textContent, document.querySelectorAll('[data-svc]').length > 0]));
  await A.pg.click('.wz [data-a=next]'); await A.pg.waitForSelector('.wz-rec'); await shot(A.pg, '119_wizard_recap');
  await A.pg.click('.wz [data-a=next]'); await A.pg.waitForTimeout(2000);
  log('wizard : projet créé', await A.pg.evaluate(async () => { const p = (await DB.all('projects')).find(x => x.name === 'Tour Casa Marina'); return p ? [p.code, p.envergure, p.catLots.length > 10, p.zones.split('\n').length, (p.services || []).length > 0, !!App.project] : null; }));
  log('wizard : suggestion → lot coché', await A.pg.evaluate(async () => { const p = (await DB.all('projects')).find(x => x.name === 'Tour Casa Marina'); return p.catLots.some(([f, l]) => /Rabattement/.test(l)) && p.catLots.some(([f, l]) => l === 'Ascenseurs'); }));
  log('wizard : moteur', await A.pg.evaluate(() => [Wizard.suggest({ type: 'villa', env: 'petit', carac: { piscine: true } }).map(x => x.lot), Wizard.zonesOf({ type: 'bat', carac: { niv: 2, ss: 0, blocs: '' } })]));
  log('errors v1.0.31', A.errs.filter(x => !/401|403|400|permission/i.test(x)));
  // ---- v1.0.32 : accueil en onglets (Accueil · Projets · Outils), catégories en boutons, anti-capture fiable, organigramme zoomable
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); App.project = null; App.homeTab = 'home'; renderHome(); }); await A.pg.waitForSelector('.st-bnav'); await A.pg.waitForTimeout(1200);
  await shot(A.pg, '120_onglet_accueil');
  log('onglets : accueil', await A.pg.evaluate(() => [document.querySelector('.h2-pane.on').dataset.tab, document.querySelectorAll('.h2-pane.on .h2-card').length <= 2, [...document.querySelectorAll('.st-bnav span')].map(x => x.textContent)]));
  await A.pg.click('.st-bnav [data-n=home]'); await A.pg.waitForTimeout(400); await shot(A.pg, '121_onglet_projets');
  log('onglets : projets', await A.pg.evaluate(() => [document.querySelector('.h2-pane.on').dataset.tab, document.querySelectorAll('.h2-pane.on .h2-card').length]));
  await A.pg.evaluate(async () => { App.homeTab = 'tools'; await renderHome(); }); await A.pg.waitForTimeout(400); await shot(A.pg, '122_onglet_outils');
  const cat = await A.pg.evaluate(() => document.querySelectorAll('.h2-pane.on .st-tcats [data-cat]')[2].dataset.cat);
  await A.pg.click(`.h2-pane.on .st-tcats [data-cat="${cat}"]`); await A.pg.waitForTimeout(300); await shot(A.pg, '123_outils_categorie');
  log('outils : catégorie en boutons', await A.pg.evaluate(() => [...document.querySelectorAll('.h2-pane.on .st-tcat')].filter(t => t.style.display !== 'none').length, cat));
  // anti-capture : activer puis désactiver — l'état du téléphone suit à chaque fois
  await A.pg.evaluate(() => { Team.openCompany('set'); }); await A.pg.waitForSelector('[data-a=secure]', { timeout: 15000 });
  await A.pg.click('[data-a=secure]'); await A.pg.waitForTimeout(1500); const s1 = await A.pg.evaluate(() => [Team.secureOn(), document.querySelector('[data-secstate]').textContent]);
  await A.pg.click('[data-a=secure]'); await A.pg.waitForTimeout(1500); const s2 = await A.pg.evaluate(() => [Team.secureOn(), document.querySelector('[data-secstate]').textContent, document.documentElement.classList.contains('st-secure')]);
  log('anti-capture activer / désactiver', [s1, s2]);
  // organigramme du projet : commandes de zoom et plein écran
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.homeTab = 'home'; await openProject((await DB.all('projects')).find(p => p.name === 'Grand stade Benslimane')); document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); App.section = 'org'; await renderSection(); }); await A.pg.waitForSelector('.og-zc', { timeout: 10000 }); await A.pg.waitForTimeout(500);
  const z0 = await A.pg.evaluate(() => document.querySelector('.og-st').style.transform);
  await A.pg.click('[data-z=in]'); await A.pg.click('[data-z=in]'); await A.pg.waitForTimeout(200); const z1 = await A.pg.evaluate(() => document.querySelector('.og-st').style.transform);
  await A.pg.click('[data-z=full]'); await A.pg.waitForTimeout(300); await shot(A.pg, '124_organigramme_plein_ecran');
  log('organigramme : zoom + plein écran', await A.pg.evaluate(([a, b]) => [a !== b, !!document.querySelector('.og.full')], [z0, z1]));
  await A.pg.click('[data-z=full]'); await A.pg.evaluate(() => { App.project = null; renderHome(); });
  log('errors v1.0.32', A.errs.filter(x => !/401|403|400|permission/i.test(x)));
  // ---- v1.0.33 : affecter, terminer et conserver l’historique du projet
  const affStart = A.errs.length, affErrors = [];
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); App.project = null; });
  const affResult = await A.pg.evaluate(async () => {
    const p = (await DB.all('projects'))[0], uid = Team.members().find(m => !m.admin)?.uid || Team.uid();
    const list = [{ id: 'ci-aff32', uid, role: 'techqualite', debut: todayISO(), fin: null }];
    await Team.saveAffectations(p, list, 'affectation', uid);
    const initial = [p.teamEnabled, p.teamUids.includes(uid), p.affectations.length];
    await Team.saveAffectations(p, list.map(a => ({ ...a, fin: todayISO() })), 'fin_affectation', uid);
    const ended = [p.teamUids.length, p.affectations[0].fin, p.affectations.length];
    return { initial, ended };
  });
  if (!affResult.initial[0] || !affResult.initial[1] || affResult.initial[2] !== 1 || affResult.ended[0] !== 0 || !affResult.ended[1] || affResult.ended[2] !== 1) affErrors.push('Affectation ou historique incorrect');
  await A.pg.evaluate(() => { localStorage.removeItem('aff.rules'); Affectations.open(); }); await A.pg.waitForSelector('.opt:has-text("OK")', { timeout: 10000 });
  log('Affectations : rappel des règles à la 1re ouverture', await A.pg.evaluate(() => /publiez les nouvelles règles/.test(document.body.innerText)));
  await A.pg.click('.opt:has-text("OK")'); await A.pg.waitForSelector('[data-aff-project]'); await shot(A.pg, '125_affectations');
  await A.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  log('Affectations : début / fin / historique', affResult);
  // organigramme accessible en Free (espace personnel)
  log('organigramme en Free', await E.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.project = null; App.homeTab = 'home'; await renderHome();
    const tile = !!document.querySelector('[data-pt=org]'); const p = (await DB.all('projects'))[0]; if (!p) return [tile, 'pas de projet']; await openProject(p); document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); App.section = 'org'; await renderSection(); await new Promise(r => setTimeout(r, 600));
    return [tile, App.section, !!document.querySelector('.og-zc'), !!document.querySelector('.og-empty')]; }));
  await shot(E.pg, '126_organigramme_free');
  await E.pg.evaluate(() => { App.project = null; renderHome(); });
  log('E erreurs brutes (diagnostic)', E.errs.slice(-8));
  log('errors v1.0.33', [...affErrors, ...A.errs.slice(affStart)]);
  // ---- v1.0.34 : bibliothèque par service, interface Basic unique, Mon dossier pro, palette professionnelle (clair / sombre)
  const v34 = [], a34 = A.errs.length, e34 = E.errs.length, clean34 = (pg) => pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); App.project = null; });
  // le conducteur peut cumuler un poste Qualité (test des postes multiples) : la réception suit alors l'union des bibliothèques
  const libB = await B.pg.evaluate(() => { const q = [Team.me().role, ...(Team.me().postes || [])].some(k => tmRoleOf(k).s === 'qualite');
    return [!!Team.svcLib(), Team.canSection('reception'), Team.canSection('beton'), Team.canSection('tasks'), q, Team.svcLib() ? Team.svcLib().has('finance') : null]; });
  log('bibliothèque Travaux (conducteur) [lib, réception, bétonnage, réserves, poste qualité cumulé, finance]', libB);
  if (!libB[0] || libB[1] !== libB[4] || !libB[2] || !libB[3] || libB[5]) v34.push('bibliothèque Travaux incorrecte');
  // conducteur seul (sans poste qualité) : la réception disparaît, le bétonnage reste
  const libB2 = await B.pg.evaluate(() => { const me = Team.me(), sv = me.postes; me.postes = []; const r = [Team.canSection('reception'), Team.canSection('beton'), secShown('beton')]; me.postes = sv; return r; });
  log('bibliothèque Travaux seule [réception, bétonnage, rubrique bétonnage]', libB2); if (libB2[0] || !libB2[1] || !libB2[2]) v34.push('Travaux seul : réception visible');
  const libI = await I.pg.evaluate(() => [!!Team.svcLib(), Team.canSection('reception'), Team.canSection('tasks')]);
  log('bibliothèque Qualité (technicien)', libI); if (!libI[0] || !libI[1] || !libI[2]) v34.push('bibliothèque Qualité incorrecte');
  const libA = await A.pg.evaluate(() => [Team.svcLib(), Team.canSection('reception')]);
  log('administrateur : aucune restriction', libA); if (libA[0] !== null || !libA[1]) v34.push('administrateur restreint à tort');
  for (const [U, n] of [[B, '127_outils_travaux'], [I, '128_outils_qualite']]) { await clean34(U.pg); await U.pg.evaluate(async () => { App.homeTab = 'tools'; await renderHome(); }); await U.pg.waitForTimeout(900); await shot(U.pg, n); }
  log('outils Travaux', await B.pg.evaluate(() => [...document.querySelectorAll('.h2-pane.on [data-tool]')].map(b => b.dataset.tool)));
  log('outils Qualité', await I.pg.evaluate(() => [...document.querySelectorAll('.h2-pane.on [data-tool]')].map(b => b.dataset.tool)));
  // PV de réception : la Qualité garde la réception ; les Travaux arrivent sur le programme de bétonnage
  log('réception côté Qualité', await I.pg.evaluate(async () => { const p = (await DB.all('projects')).find(x => !x.deleted && Team.canProject(x.id)); if (!p) return 'pas de projet'; await openProject(p); document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); App.section = 'reception'; await renderSection(); await new Promise(r => setTimeout(r, 500)); return [App.section, !!document.querySelector('.kseg [data-k=reception]:not([hidden])')]; }));
  await shot(I.pg, '129_reception_qualite');
  // espace personnel : carte « Mon dossier pro », profil, CV PDF
  const dp = await E.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.project = null; App.homeTab = 'home'; await renderHome();
    const card = !!document.querySelector('.st-bnav [data-n=pro]');   // v1.0.44 : le dossier pro est dans l'onglet « Pro »
    Dossier.set({ name: 'Rachid Alami', titre: 'Technicien qualité BTP', ville: 'Casablanca', tel: '+212 600 000 000', dispo: 'ouvert', about: 'Technicien qualité, 6 ans sur des chantiers de bâtiment et d\'ouvrages d\'art : réception de ferraillage, essais béton, PV.',
      exp: [{ id: 'x1', poste: 'Technicien qualité', co: 'Entreprise Atlas BTP', lieu: 'Tanger', de: '2021-03', cur: true, desc: 'Réception ferraillage, PV, suivi des essais béton.' }, { id: 'x2', poste: 'Technicien travaux', co: 'Bâtir Maroc', lieu: 'Rabat', de: '2018-09', a: '2021-02' }],
      form: [{ id: 'f1', dip: 'Technicien spécialisé gros œuvre', ecole: 'ISTA', an: '2018' }], skills: ['Lecture de plans', 'Béton armé', 'Contrôle qualité', 'AutoCAD'],
      langs: [{ l: 'Arabe', niv: 'Bilingue / natif' }, { l: 'Français', niv: 'Courant' }], certs: [{ id: 'c1', n: 'Sauveteur secouriste du travail', org: 'OFPPT', an: '2022' }] });
    await openDossier(); await new Promise(r => setTimeout(r, 400));
    const sp = sharePdf; let cv = null; sharePdf = async (doc, n) => { cv = [n, doc.getNumberOfPages(), doc.output('arraybuffer').byteLength > 3000]; }; await dpCv(); sharePdf = sp;
    return { card, score: Dossier.score(Dossier.get()), secs: document.querySelectorAll('.dp-page .dp-sec').length, items: document.querySelectorAll('.dp-page .dp-it').length, cv }; });
  log('Mon dossier pro', dp); if (!dp.card || dp.score < 80 || dp.secs < 6 || !dp.cv || !dp.cv[2]) v34.push('dossier pro incomplet');
  await shot(E.pg, '130_dossier_pro');
  await E.pg.evaluate(() => { const b = document.querySelector('.dp-page [data-a=career]'); if (b) b.click(); }); await E.pg.waitForTimeout(600); await shot(E.pg, '131_dossier_candidatures');
  // thème sombre professionnel : aucune carte blanche
  await clean34(A.pg);
  const dark = await A.pg.evaluate(async () => { localStorage.setItem('theme', 'siteteam-dark'); applyTheme('siteteam-dark'); App.homeTab = 'home'; await renderHome(); await new Promise(r => setTimeout(r, 900));
    const white = [...document.querySelectorAll('.st-kpi,.h2-card,.h2-proj,.st-perf,.topbar,.h2-hero')].filter(x => getComputedStyle(x).backgroundColor === 'rgb(255, 255, 255)').map(x => x.className);
    return [document.documentElement.classList.contains('th-std'), white]; });
  log('thème sombre (classe, cartes blanches)', dark); if (!dark[0] || dark[1].length) v34.push('thème sombre : cartes blanches ' + dark[1].join(','));
  await shot(A.pg, '132_sombre_accueil');
  await A.pg.evaluate(async () => { App.homeTab = 'tools'; await renderHome(); }); await A.pg.waitForTimeout(400); await shot(A.pg, '133_sombre_outils');
  await A.pg.evaluate(async () => { localStorage.setItem('theme', 'siteteam'); applyTheme('siteteam'); App.homeTab = 'tools'; await renderHome(); }); await A.pg.waitForTimeout(700); await shot(A.pg, '134_clair_outils');
  await A.pg.evaluate(async () => { App.homeTab = 'home'; await renderHome(); }); await A.pg.waitForTimeout(700); await shot(A.pg, '135_clair_accueil');
  await E.pg.evaluate(() => { document.querySelectorAll('.fullpage').forEach(x => x.remove()); localStorage.setItem('theme', 'siteteam-dark'); applyTheme('siteteam-dark'); openDossier(); }); await E.pg.waitForTimeout(600); await shot(E.pg, '136_sombre_dossier');
  await E.pg.evaluate(async () => { document.querySelectorAll('.fullpage').forEach(x => x.remove()); App.homeTab = 'home'; await renderHome(); }); await E.pg.waitForTimeout(700); await shot(E.pg, '137_sombre_perso');
  await E.pg.evaluate(async () => { localStorage.setItem('theme', 'siteteam'); applyTheme('siteteam'); await renderHome(); }); await E.pg.waitForTimeout(700); await shot(E.pg, '138_clair_perso');
  // petite entreprise (Basic) : une seule grille d'outils, sans catégories de services
  log('Basic : interface unique (diagnostic)', await J.pg.evaluate(async () => { try { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.homeTab = 'tools'; await renderHome(); return [Team.taille(), !!document.querySelector('.h2-pane.on .st-tcats'), document.querySelectorAll('.h2-pane.on [data-tool]').length]; } catch (e) { return String(e); } }));
  await shot(J.pg, '139_basic_outils');
  log('errors v1.0.34', [...v34, ...A.errs.slice(a34), ...E.errs.slice(e34).filter(x => !/401/.test(x))]);
  // ---- v1.0.35 : en-tête compact (dossier pro + menu de l'espace), accueil court, barre du bas fixe, outils au toucher, Lots & équipes, codes délégués
  const v35 = [], a35 = A.errs.length, cl35 = (pg) => pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg,.ws-dd').forEach(x => x.remove()); App.project = null; });
  await cl35(A.pg); await A.pg.evaluate(async () => { App.homeTab = 'home'; await renderHome(); }); await A.pg.waitForTimeout(800);
  const hd = await A.pg.evaluate(() => { const nav = document.querySelector('.st-bnav'), cs = nav && getComputedStyle(nav), r = nav && nav.getBoundingClientRect();
    return { me: !!document.querySelector('.h2-hero [data-a=dossier]'), ws: !!document.querySelector('.h2-hero [data-a=wsmenu]'), aff: !!document.querySelector('[data-a=dir-aff]'), kpis: document.querySelectorAll('.st-kpis.k4 .st-kpi').length,
      navBottom: r ? Math.round(innerHeight - r.bottom) : null, navBg: cs ? cs.backgroundColor : '', heroH: Math.round(document.querySelector('.h2-hero').getBoundingClientRect().height) }; });
  log('en-tête & accueil', hd); if (hd.me || !hd.ws || hd.aff || hd.kpis !== 0 || hd.navBottom > 1 || /rgba\(.*, 0(\.\d+)?\)$/.test(hd.navBg)) v35.push('en-tête / barre du bas incorrects');
  await shot(A.pg, '140_accueil_compact');
  await A.pg.evaluate(() => { const b = document.querySelector('.h2-body'); b.scrollTop = 400; b.dispatchEvent(new Event('scroll')); }); await A.pg.waitForTimeout(300);
  log('en-tête réduit au défilement', await A.pg.evaluate(() => [document.querySelector('.h2-hero').classList.contains('mini'), Math.round(document.querySelector('.h2-hero').getBoundingClientRect().height)]));
  await shot(A.pg, '141_accueil_defile');
  await A.pg.click('[data-a=wsmenu]'); await A.pg.waitForSelector('.ws-dd .ws-pn');
  const wm = await A.pg.evaluate(() => [...document.querySelectorAll('.ws-dd [data-wm]')].map(b => b.dataset.wm)); log('menu de l\'espace', wm);
  if (!wm.includes('switch') || wm.some(k => ['org', 'dossier', 'aff', 'me', 'look'].includes(k))) v35.push('menu de l\'espace : seulement les espaces (v1.0.44)');
  await shot(A.pg, '142_menu_espace'); await A.pg.click('.ws-dd .ws-bg', { position: { x: 20, y: 20 } });
  // outils : pas de « Tous », rien d'ouvert avant le toucher
  await A.pg.evaluate(async () => { App.homeTab = 'tools'; await renderHome(); }); await A.pg.waitForTimeout(400);
  const tl = await A.pg.evaluate(() => { App.toolCat = ''; return null; }); void tl;
  await A.pg.evaluate(async () => { App.homeTab = 'tools'; await renderHome(); }); await A.pg.waitForTimeout(500);
  const tc = await A.pg.evaluate(() => { const P = document.querySelector('.h2-pane.on'); return { tous: !!P.querySelector('[data-cat="*"]'), cats: [...P.querySelectorAll('[data-cat]')].map(b => b.dataset.cat), open: [...P.querySelectorAll('.st-tcat')].filter(t => t.style.display !== 'none').length, espRepete: P.querySelectorAll('.es-wrap').length }; });
  log('outils : catégories au toucher', tc); if (tc.tous || tc.open !== 0 || tc.espRepete > 1) v35.push('outils : catégories incorrectes');
  await shot(A.pg, '143_outils_categories');
  await A.pg.click(`.h2-pane.on [data-cat="${tc.cats[0]}"]`); await A.pg.waitForTimeout(300);
  log('catégorie ouverte', await A.pg.evaluate(() => [...document.querySelectorAll('.h2-pane.on .st-tcat')].filter(t => t.style.display !== 'none').map(t => t.dataset.g)));
  await shot(A.pg, '144_outils_categorie_ouverte');
  await A.pg.evaluate(() => { App.toolCat = ''; App.homeTab = 'home'; });
  // Lots & équipes : dates, équipe sous-traitante, saisies → rendement et alertes
  const lsr = await A.pg.evaluate(async () => { const p = (await DB.all('projects')).find(x => !x.deleted); await openProject(p); document.querySelectorAll('.sheet-bg').forEach(x => x.remove());
    const L = lsLots(p), l = L[0], D = lsData(p, l.id), t = todayISO(), d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    D.deb = d(-10); D.fin = d(20); D.zones = ['Bloc A', 'Bloc B'];
    D.eq.push({ id: 'eq1', kind: 'st', nom: 'Ste Atlas Coffrage', chef: 'Hassan', tel: '0600000000', eff: 8, mis: 'Coffrage des voiles R+1', u: 'm²', eng: '1 grue', j: [{ d: d(-2), eff: 8, q: 96, av: 20, c: [{ m: 'Béton', q: 12, u: 'm³' }], n: '' }, { d: d(-1), eff: 10, q: 130, av: 30, c: [], n: 'Bloc A' }] });
    D.eq.push({ id: 'eq2', kind: 'int', nom: 'Équipe ferrailleurs 2', chef: 'Youssef', eff: 6, u: 'kg', j: [{ d: d(-5), eff: 6, q: 1800, av: 15, c: [] }] });
    await DB.put('projects', p); App.section = 'lotsuivi'; await renderSection(); await new Promise(r => setTimeout(r, 500));
    const S = lsState(D);
    return { lots: L.length, real: S.real, prev: S.prev, alertes: S.al.map(x => x[1]), rend: Math.round(lsRendAvg(D.eq[0]) * 10) / 10, cartes: document.querySelectorAll('.ls-lot').length }; });
  log('Lots & équipes', lsr); if (!lsr.lots || lsr.rend !== 12.5 || !lsr.cartes || !lsr.alertes.some(x => /aucune saisie/.test(x))) v35.push('suivi des lots incorrect');
  await shot(A.pg, '145_lots_equipes');
  await A.pg.click('.ls-lot'); await A.pg.waitForSelector('.ls-page'); await A.pg.waitForTimeout(300); await shot(A.pg, '146_lot_detail');
  await A.pg.click('.ls-page [data-eq=eq1]'); await A.pg.waitForSelector('.ls-eqs'); await A.pg.waitForTimeout(300); await shot(A.pg, '147_equipe_rendement');
  await A.pg.evaluate(() => document.querySelectorAll('.sheet-bg,.fullpage').forEach(x => x.remove()));
  await A.pg.evaluate(() => lsSousTraitants(App.project)); await A.pg.waitForTimeout(300); await shot(A.pg, '148_sous_traitants');
  log('lot (plans) : plus d\'attachement / décompte', await A.pg.evaluate(() => !/data-gs=/.test(String(lotPanel))));
  await cl35(A.pg);
  // codes d'accès délégués : l'administrateur autorise le conducteur
  const dlg = await A.pg.evaluate(async () => { const m = Team.members().find(x => x.name && /Youssef/.test(x.name)); if (!m) return 'membre introuvable';
    await firebase.firestore().collection('companies').doc(Team.company().id).collection('members').doc(m.uid).update({ canInvite: true }); return true; });
  await B.pg.waitForTimeout(1500);
  log('codes délégués (diagnostic) [admin a autorisé, conducteur peut partager]', [dlg, await B.pg.evaluate(async () => { try { await Team.refreshMembers(); } catch (e) {} return Team.canInvite(); })]);
  // thème « Classique » (sombre) : aucune zone blanche dans l'accueil perso et organisation
  for (const [U, n] of [[A, '149_classique_org'], [E, '150_classique_perso']]) {
    await cl35(U.pg);
    const w = await U.pg.evaluate(async () => { applyTheme('dark'); App.homeTab = 'home'; await renderHome(); await new Promise(r => setTimeout(r, 800));
      return [...document.querySelectorAll('.h2-body, .h2-pane.on, .h2-pane.on *')].filter(x => x.offsetHeight > 30 && getComputedStyle(x).backgroundColor === 'rgb(255, 255, 255)').map(x => x.className).slice(0, 5); });
    log('thème Classique : zones blanches ' + n, w); if (w.length) v35.push('Classique : blanc ' + w.join(','));
    await shot(U.pg, n); await U.pg.evaluate(() => { applyTheme(localStorage.getItem('theme') || 'siteteam'); });
  }
  log('errors v1.0.35', [...v35, ...A.errs.slice(a35)]);
  // ---- v1.0.36 : démarrage — écran de démarrage immédiat (plus d'écran noir), scripts chargés après le premier affichage, temps mesuré
  const v36 = [];
  const bt = await A.pg.evaluate(() => [!!document.getElementById('boot'), JSON.parse(localStorage.getItem('boot.t') || 'null'), typeof window.jspdf, document.querySelectorAll('script[data-src]').length]);
  log('démarrage [écran encore là, temps mesurés, jsPDF chargé, scripts différés]', bt); if (bt[0] || !bt[1] || bt[2] !== 'object') v36.push('démarrage incorrect');
  { const P = H.pg; const t0 = Date.now(); await P.goto('http://127.0.0.1:8765/?emu=1', { waitUntil: 'commit' }); await P.waitForSelector('#boot', { timeout: 5000 }).catch(() => {}); const first = Date.now() - t0;
    await P.waitForSelector('.home2', { timeout: 30000 }); const t1 = Date.now(); await P.waitForTimeout(1200);
    log('démarrage mesuré (navigateur de test) [ms avant l\'écran de démarrage, ms jusqu\'à l\'accueil, écran retiré, temps enregistrés]', [first, t1 - t0, !(await P.$('#boot')), await P.evaluate(() => localStorage.getItem('boot.t'))]); await shot(P, '151_demarrage_accueil'); }
  // en-tête : pas d'oscillation (réduit / agrandi en boucle) en faisant défiler une page courte
  const osc = await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg,.ws-dd').forEach(x => x.remove()); App.project = null; App.homeTab = 'proj'; await renderHome(); await new Promise(r => setTimeout(r, 400));
    const he = document.querySelector('.h2-hero'), hb = document.querySelector('.h2-body'); let n = 0; const o = new MutationObserver(() => n++); o.observe(he, { attributes: true, attributeFilter: ['class'] });
    for (let i = 0; i < 30; i++) { hb.scrollTop = hb.scrollHeight; hb.dispatchEvent(new Event('scroll')); await new Promise(r => setTimeout(r, 40)); }
    await new Promise(r => setTimeout(r, 600)); o.disconnect(); App.homeTab = 'home'; return n; });
  log('en-tête : changements pendant le défilement (≤ 2 attendu)', osc); if (osc > 2) v36.push('en-tête : oscillation');
  log('errors v1.0.36', v36);
  // ---- v1.0.38 : barre du bas à 4 onglets (sans Outils), projet ouvert sur ses outils, Réglages = menu ⋮, fins de ligne LF
  const v38 = [];
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg,.ws-dd').forEach(x => x.remove()); App.project = null; App.homeTab = 'proj'; await renderHome(); });
  await A.pg.waitForTimeout(500);
  const nav = await A.pg.evaluate(() => [...document.querySelectorAll('.st-bnav [data-n]')].map(b => b.dataset.n));
  log('barre du bas', nav); if (nav.includes('tools') || nav.length !== 4) v38.push('barre du bas incorrecte');
  await A.pg.click('.h2-pane.on .h2-card[data-id]'); await A.pg.waitForTimeout(900);
  const pt = await A.pg.evaluate(() => [App.section, document.querySelectorAll('.st-ptools-p [data-tool]').length, document.querySelectorAll('.st-ptools-p .st-tcat').length]);
  log('projet ouvert sur ses outils [section, outils, catégories]', pt); if (pt[0] !== 'ptools' || !pt[1]) v38.push('projet : outils absents');
  await shot(A.pg, '152_outils_du_projet');
  await A.pg.click('.st-ptools-p [data-tool]'); await A.pg.waitForTimeout(600);
  log('outil ouvert depuis le projet', await A.pg.evaluate(() => App.section));
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.project = null; App.homeTab = 'home'; await renderHome(); }); await A.pg.waitForTimeout(500);
  await A.pg.click('.st-bnav [data-n=set]'); await A.pg.waitForTimeout(600);
  const rg = await A.pg.evaluate(() => [!!document.querySelector('.sheet-bg'), (document.querySelector('.sheet h3, .sheet .sh-title') || {}).textContent || '']);
  log('Réglages = menu ⋮', rg); if (!rg[0]) v38.push('Réglages : menu absent');
  await shot(A.pg, '153_reglages_menu'); await A.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  log('errors v1.0.38', v38);
  // ---- v1.0.40 : outils du projet compacts ; lots : répartition par niveau (qui tient quelle partie), matrice, alertes de réception
  const v40 = [];
  await A.pg.evaluate(() => document.querySelectorAll('.fullpage,.sheet-bg,.ws-dd').forEach(x => x.remove()));
  const lp = await A.pg.evaluate(async () => { const p = (await DB.all('projects')).find(x => !x.deleted); await openProject(p, 'ptools'); await new Promise(r => setTimeout(r, 500));
    const h = Math.round(document.querySelector('#content').scrollHeight);
    const L = lsLots(p), l = L[0], D = lsData(p, l.id); D.eq = D.eq && D.eq.length ? D.eq : [];
    D.eq.push({ id: 'st1', kind: 'st', nom: 'Ste Atlas Maçonnerie', chef: 'Hassan', eff: 8, u: 'm²', j: [] }, { id: 'in1', kind: 'int', nom: 'Équipe maçons 1', chef: 'Said', eff: 5, u: 'm²', j: [] });
    const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    D.parts = { 'RDC': { eq: 'st1', st: 'rec', av: 100 }, 'R+1': { eq: 'st1', st: 'done', av: 100 }, 'R+2': { eq: 'in1', st: 'run', av: 40, fin: d(-2) }, 'R+3': { eq: '', st: 'todo', av: 0 } };
    await DB.put('projects', p); App.lsView = 'mx'; App.section = 'lotsuivi'; await renderSection(); await new Promise(r => setTimeout(r, 400));
    const S = lsState(D);
    return { hauteurOutils: h, cellules: document.querySelectorAll('.ls-mx td:not(.vide)').length, avancement: S.real, alertes: S.al.map(x => x[1]) }; });
  log('lots par niveau [hauteur outils, cellules matrice, avancement, alertes]', lp);
  if (lp.cellules !== 4 || lp.avancement !== 60 || !lp.alertes.some(x => /réception à faire/.test(x)) || !lp.alertes.some(x => /aucune équipe/.test(x))) v40.push('répartition par niveau incorrecte');
  await shot(A.pg, '154_lots_matrice');
  await A.pg.evaluate(() => { App.lsView = 'actifs'; }); await A.pg.click('.ls-mx td[data-lot]'); await A.pg.waitForSelector('.ls-parts'); await A.pg.waitForTimeout(300); await shot(A.pg, '155_lot_niveaux');
  await A.pg.evaluate(() => document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()));
  await A.pg.evaluate(() => lsSousTraitants(App.project)); await A.pg.waitForTimeout(300);
  log('sous-traitants : parties tenues', await A.pg.evaluate(() => [...document.querySelectorAll('.ls-sts p')].map(x => x.textContent).slice(0, 3)));
  await shot(A.pg, '156_sous_traitants_parties'); await A.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  await A.pg.evaluate(async () => { App.section = 'ptools'; await renderSection(); }); await A.pg.waitForTimeout(400); await shot(A.pg, '157_outils_compacts');
  log('errors v1.0.40', v40);
  // ---- v1.0.41 : photos en masse — rangement Drive selon la rubrique (projet › rubrique › mois › jour › niveau › ouvrage)
  const v41 = [];
  const pbr = await A.pg.evaluate(async () => { const p = App.project || (await DB.all('projects')).find(x => !x.deleted);
    const id = await DB.put('files', { projectId: p.id, blob: new Blob(['x'], { type: 'image/jpeg' }), mime: 'image/jpeg', name: 'Voile V12 1.jpg', role: 'photo', grp: { dest: 'rec', niv: 'R+1', ouv: 'Voile V12', date: '2026-10-28' } });
    const f = (await DB.all('files')).find(x => x.grp && x.grp.ouv === 'Voile V12'); const paths = await Sync.buildPaths(); const r = Sync.pathFor(f, paths);
    await DB.del('files', f.id); void id; return r.segs; });
  log('photos en masse : dossier Drive', pbr); if (!pbr || pbr[1] !== '02 - Réception ferraillage' || !pbr.includes('R+1') || !pbr.includes('Voile V12') || !pbr.includes('2026-10-28')) v41.push('photos en masse : rangement Drive incorrect');
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.section = 'ptools'; await renderSection(); }); await A.pg.waitForTimeout(300);
  log('photos en masse : bouton dans les outils du projet', await A.pg.evaluate(() => !!document.querySelector('.st-ptools-p [data-a=pbatch]')));
  await A.pg.click('.st-ptools-p [data-a=pbatch]'); await A.pg.waitForSelector('.sheet [name=dest]'); await shot(A.pg, '158_photos_en_masse'); await A.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  const dn = await A.pg.evaluate(async () => { const p = App.project || (await DB.all('projects')).find(x => !x.deleted); p.driveNames = { '02 - Réception ferraillage': '02 - PV Réception' };
    const f = { id: 'tmpf', projectId: p.id, role: 'photo', name: 'x.jpg', mime: 'image/jpeg', grp: { dest: 'rec', date: '2026-10-28' } };
    const paths = await Sync.buildPaths(); paths.PR[p.id] = p; const r = Sync.pathFor(f, paths).segs; delete p.driveNames; return r; });
  log('dossiers Drive renommés', dn); if (!dn || dn[1] !== '02 - PV Réception') v41.push('renommage des dossiers Drive incorrect');
  log('errors v1.0.41', v41);
  // ---- v1.0.42 : PV de réception intelligents (modèles par service, mesures + tolérances, verdict, réserves, contre-visite)
  const v42 = [];
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.section = 'ptools'; await renderSection(); }); await A.pg.waitForTimeout(300);
  log('PV : bouton dans les outils du projet', await A.pg.evaluate(() => !!document.querySelector('.st-ptools-p [data-a=newpv]')));
  await A.pg.evaluate(() => { window.__pvp = pvCreate(App.project); }); await A.pg.waitForSelector('.pv-pick'); await shot(A.pg, '160_pv_choix_modele');
  log('PV : modèles proposés', await A.pg.evaluate(() => document.querySelectorAll('.pv-tc[data-t]').length));
  await A.pg.click('.pv-tc[data-t=pv_fer]'); await A.pg.waitForTimeout(300);
  const pf = await A.pg.evaluate(async () => { const f = await window.__pvp; return { ref: f.ref, n: f.items.length, mes: f.mes.length, secs: [...new Set(f.items.map(i => i.sec))].length }; });
  log('PV ferraillage créé', pf); if (!pf || !/^PV-FER-\d{3}$/.test(pf.ref) || pf.n < 10 || pf.mes !== 3) v42.push('création PV ferraillage');
  await A.pg.evaluate(async () => { const f = await window.__pvp; f.niv = 'R+1'; f.location = 'Voiles V1 à V6'; await DB.put('forms', f); window.__pvo = openFormDetail(f); }); await A.pg.waitForSelector('.pv-verdict');
  await shot(A.pg, '161_pv_detail');
  await A.pg.click('[data-a=allok]'); await A.pg.waitForTimeout(250);
  log('PV verdict tout conforme', await A.pg.evaluate(() => document.querySelector('.pv-verdict b').textContent));
  await A.pg.click('.pv-it[data-i="0"] [data-r=res]'); await A.pg.waitForTimeout(250);
  await A.pg.fill('.pv-m[data-m="0"] [data-v]', '18'); await A.pg.dispatchEvent('.pv-m[data-m="0"] [data-v]', 'change'); await A.pg.waitForTimeout(300);
  const vd = await A.pg.evaluate(() => ({ v: document.querySelector('.pv-verdict b').textContent, bad: document.querySelectorAll('.pv-m.bad').length }));
  log('PV verdict réserve + enrobage 18 mm (< 25)', vd); if (vd.v !== 'Non conforme' || vd.bad !== 1) v42.push('verdict / tolérance');
  await A.pg.evaluate(() => document.querySelector('.pv-act').scrollIntoView()); await shot(A.pg, '162_pv_mesures_verdict');
  await A.pg.click('[data-a=res]'); await A.pg.waitForTimeout(600);
  const rs = await A.pg.evaluate(async () => (await DB.byProject('tasks', App.project.id)).filter(t => t.pvId).map(t => t.title));
  log('PV réserves créées', rs); if (rs.length !== 2) v42.push('réserves depuis PV');
  await A.pg.click('[data-a=cv]'); await A.pg.waitForTimeout(700);
  const cv = await A.pg.evaluate(async () => { const F = (await DB.byProject('forms', App.project.id)).filter(f => f.parent); return F.map(f => ({ n: f.items.length, mes: f.mes.length, t: f.title })); });
  log('PV contre-visite', cv); if (cv.length !== 1 || cv[0].n !== 1 || cv[0].mes !== 1) v42.push('contre-visite');
  await shot(A.pg, '163_pv_contre_visite');
  const ss = await A.pg.evaluate(() => formStats({ items: [{ res: 'ok' }, { res: 'res' }], mes: [] }).status); log('statut avec réserve', ss); if (ss !== 'Conforme avec réserves') v42.push('statut réserves');
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.section = 'forms'; await renderSection(); }); await A.pg.waitForTimeout(400);
  log('PV liste : filtres', await A.pg.evaluate(() => [...document.querySelectorAll('.pv-kpi button')].map(b => b.textContent.trim())));
  await shot(A.pg, '164_pv_liste');
  const dj = await A.pg.evaluate(async () => { const f = (await DB.byProject('forms', App.project.id)).find(f => f.v2 && !f.parent); window.PdfCapture = []; await formPdf(f); const ok = window.PdfCapture.length === 1 && window.PdfCapture[0].fname; delete window.PdfCapture; return ok; });
  log('PV PDF', dj); if (!dj || !/^PV-FER-/.test(dj)) v42.push('PDF PV');
  log('errors v1.0.42', v42);
  // ---- v1.0.43 : envoi en arrière-plan (WorkManager) — plugin Android simulé : file, résultats, pas de double envoi
  const v43 = await A.pg.evaluate(async () => {
    const E = [], Q = new Map(), DONE = []; let started = 0;
    window.Capacitor = window.Capacitor || {}; window.Capacitor.Plugins = window.Capacitor.Plugins || {};
    window.Capacitor.Plugins.BgUpload = { enqueue: async (o) => { Q.set(o.id, o); }, start: async () => { started++; }, status: async () => ({ pendingIds: [...Q.keys()], done: DONE.slice(), running: false, lastError: '' }),
      ack: async ({ ids }) => { for (const id of ids) { const i = DONE.findIndex(d => d.id === id); if (i >= 0) DONE.splice(i, 1); } }, notifPermission: async () => ({ granted: true }), cancel: async () => {} };
    const old = localStorage.getItem('sync.cfg'); localStorage.setItem('sync.cfg', JSON.stringify({ mode: 'g' }));
    try {
      if (!BgUp.on()) E.push('BgUp.on() faux');
      const p = App.project || (await DB.all('projects')).find(x => !x.deleted);
      const f1 = await DB.putRaw('files', { id: 'bgt1', projectId: p.id, blob: new Blob(['abc'], { type: 'image/jpeg' }), mime: 'image/jpeg', name: 'V12 1.jpg', role: 'photo', grp: { dest: 'rec', niv: 'R+1', ouv: 'Voile V12', date: '2026-10-30' } });
      const f2 = await DB.putRaw('files', { id: 'bgt2', projectId: p.id, blob: new Blob(['def'], { type: 'image/jpeg' }), mime: 'image/jpeg', name: 'V12 2.jpg', role: 'photo', grp: { dest: 'rec', niv: 'R+1', ouv: 'Voile V12', date: '2026-10-30' } });
      const n = await BgUp.hand([f1, f2]);
      if (n !== 2 || Q.size !== 2 || !started) E.push('mise en file ' + n + '/' + Q.size);
      const q1 = Q.get('bgt1'); if (!q1 || q1.segs[1] !== '02 - Réception ferraillage' || !q1.segs.includes('Voile V12') || atob(q1.data) !== 'abc') E.push('contenu de la file ' + JSON.stringify(q1 && q1.segs));
      const again = await BgUp.hand([await DB.get('files', 'bgt1')]); if (again !== 0) E.push('double mise en file');
      // le téléphone a envoyé bgt1 ; bgt2 en attente
      Q.delete('bgt1'); DONE.push({ id: 'bgt1', driveId: 'DRV123' });
      const st = await BgUp.settle();
      const a = await DB.get('files', 'bgt1'), b = await DB.get('files', 'bgt2');
      if (a.driveId !== 'DRV123' || a.bgq || !a.drivePath) E.push('résultat non relu');
      if (!b.bgq || st.pending !== 1) E.push('en attente perdu');
      if (DONE.length) E.push('résultats non acquittés');
      // perdu par le téléphone : l'application le reprend
      Q.delete('bgt2'); await BgUp.settle(); if ((await DB.get('files', 'bgt2')).bgq) E.push('reprise par l\'application');
      await DB.delRaw('files', 'bgt1'); await DB.delRaw('files', 'bgt2');
    } catch (e) { E.push('exception ' + e.message); }
    finally { if (old) localStorage.setItem('sync.cfg', old); else localStorage.removeItem('sync.cfg'); delete window.Capacitor.Plugins.BgUpload; }
    return E;
  });
  log('errors v1.0.43', v43);
  // ---- v1.0.43 : accueil = projets, barre Projets · Réseau · Emploi · Mon dossier · Plus, plus de bouton organisation en haut
  const u43 = [];
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg,.ws-dd').forEach(x => x.remove()); App.project = null; App.homeTab = 'home'; await renderHome(); }); await A.pg.waitForTimeout(700);
  const h43 = await A.pg.evaluate(() => ({ nav: [...document.querySelectorAll('.st-bnav span')].map(x => x.textContent), dir: !!document.querySelector('.h2-pane.on .st-dir, .h2-pane.on [data-stq], .h2-pane.on [data-stdash]'), org: !!document.querySelector('.h2-hero [data-a=company]'), cards: document.querySelectorAll('.h2-pane.on .h2-card').length, title: (document.querySelector('.h2-pane.on .h2-sec span') || {}).textContent }));
  log('accueil v1.0.43', h43); if (h43.nav.join('|') !== 'Projets|Pro|Équipe|Réglages' || h43.dir || h43.org || !h43.cards) u43.push('accueil / barre');
  await shot(A.pg, '170_accueil_projets');
  await A.pg.evaluate(() => ST.openPro('net')); await A.pg.waitForSelector('.rs-page', { timeout: 8000 }); await A.pg.waitForTimeout(400);
  const rs43 = await A.pg.evaluate(() => ({ rows: document.querySelectorAll('.rs-row').length, f: [...document.querySelectorAll('.rs-f button')].map(b => b.textContent.trim()) }));
  log('réseau', rs43); await shot(A.pg, '171_reseau');
  await A.pg.evaluate(() => { localStorage.setItem('reseau.contacts', JSON.stringify([{ name: 'Youssef Ferrailleur', sub: 'Tâcheron ferraillage', tel: '0612345678', email: '' }])); document.querySelector('.rs-page [data-a=back]').click(); openReseau(); }); await A.pg.waitForTimeout(500);
  const rs2 = await A.pg.evaluate(() => ({ me: [...document.querySelectorAll('.rs-row b')].some(b => b.textContent === 'Youssef Ferrailleur'), wa: !!document.querySelector('.rs-row a[href="https://wa.me/212612345678"]') }));
  log('réseau : contact perso + WhatsApp', rs2); if (!rs2.me || !rs2.wa) u43.push('réseau contacts');
  await A.pg.fill('.rs-page [data-q]', 'youssef'); await A.pg.waitForTimeout(300);
  log('réseau : recherche', await A.pg.evaluate(() => document.querySelectorAll('.rs-row').length));
  await A.pg.evaluate(() => { localStorage.removeItem('reseau.contacts'); document.querySelectorAll('.fullpage').forEach(x => x.remove()); });
  await A.pg.click('.st-bnav [data-n=team]'); await A.pg.waitForTimeout(400);
  const more = await A.pg.evaluate(() => [...document.querySelectorAll('.sheet .gm-i b')].map(o => o.textContent.trim())); log('Équipe', more); await shot(A.pg, '172_equipe');
  await A.pg.click('.gm-i:has-text("Tableau de bord")'); await A.pg.waitForSelector('.st-dashp', { timeout: 8000 }); await A.pg.waitForTimeout(800);
  log('tableau de bord (Plus)', await A.pg.evaluate(() => !!document.querySelector('.st-dashp .st-dir')));
  await shot(A.pg, '173_tableau_de_bord');
  await A.pg.evaluate(() => document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()));
  await A.pg.evaluate(() => localStorage.setItem('pro.tab', 'cv')); await A.pg.click('.st-bnav [data-n=pro]'); await A.pg.waitForTimeout(700); log('Mon dossier ouvert', await A.pg.evaluate(() => !!document.querySelector('.fullpage'))); await A.pg.evaluate(() => document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()));
  log('errors v1.0.43 ui', u43);
  // ---- v1.0.44 : Pro à onglets, Équipe, profil dans Réglages, carte projet selon le service, photos sans attente + suppression, démarrage, verre
  const v44 = [];
  await A.pg.evaluate(() => document.querySelectorAll('.fullpage,.sheet-bg,.ws-dd').forEach(x => x.remove()));
  await A.pg.evaluate(() => { localStorage.setItem('pro.tab', 'cv'); }); await A.pg.click('.st-bnav [data-n=pro]'); await A.pg.waitForSelector('.pro-tabs', { timeout: 8000 });
  const pt44 = await A.pg.evaluate(() => [...document.querySelectorAll('.pro-tabs button')].map(b => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')));
  log('Pro : onglets', pt44); await shot(A.pg, '180_pro_dossier'); if (pt44.join('|') !== 'Mon dossier*|Réseau|Emploi') v44.push('onglets Pro');
  await A.pg.click('.pro-tabs [data-pt=net]'); await A.pg.waitForSelector('.rs-page .pro-tabs', { timeout: 8000 }); await A.pg.waitForTimeout(400);
  log('Pro → Réseau', await A.pg.evaluate(() => [document.querySelectorAll('.fullpage').length, document.querySelector('.pro-tabs .on').textContent.trim()])); await shot(A.pg, '181_pro_reseau');
  await A.pg.click('.pro-tabs [data-pt=job]'); await A.pg.waitForSelector('.cr-page .pro-tabs', { timeout: 8000 }); await A.pg.waitForTimeout(400); await shot(A.pg, '182_pro_emploi');
  const n44 = await A.pg.evaluate(() => document.querySelectorAll('.fullpage').length); log('Pro → Emploi : pages ouvertes', n44); if (n44 !== 1) v44.push('Pro : pages empilées');
  await A.pg.evaluate(() => document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()));
  await A.pg.click('.st-bnav [data-n=set]'); await A.pg.waitForTimeout(500);
  const rg44 = await A.pg.evaluate(() => ({ card: !!document.querySelector('.sheet .pf-card'), ws: [...document.querySelectorAll('.sheet .gm-i b')].some(b => /Changer d'espace|Mon organisation/.test(b.textContent)) }));
  log('Réglages : profil en tête, sans doublon', rg44); await shot(A.pg, '183_reglages_profil'); if (!rg44.card || rg44.ws) v44.push('Réglages');
  await A.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  await A.pg.click('.h2-hero [data-a=wsmenu]'); await A.pg.waitForTimeout(400);
  const ws44 = await A.pg.evaluate(() => [...document.querySelectorAll('.ws-dd .ws-it b, .ws-dd .ws-h')].map(x => x.textContent.trim()));
  log('menu espace (seulement les espaces)', ws44); await shot(A.pg, '184_menu_espace'); if (ws44.some(t => /Organigramme|Mon dossier|Apparence|Mon compte/.test(t))) v44.push('menu espace : doublons');
  await A.pg.evaluate(() => document.querySelectorAll('.ws-dd').forEach(x => x.remove()));
  // carte projet selon le service : qualité (par défaut admin = direction) puis choix personnel
  const hb = await A.pg.evaluate(async () => { localStorage.removeItem('home.blocks'); const a = [...homeBlocks()]; localStorage.setItem('home.blocks', JSON.stringify(['lots', 'rap'])); const b = [...homeBlocks()];
    App.homeOpen = {}; const p = (await DB.all('projects')).find(x => !x.deleted); App.homeOpen[p.id] = true; await renderHome();
    const r = { def: a, perso: b, table: !!document.querySelector('.h2-pane.on .h2-tab'), cust: !!document.querySelector('[data-a=hblocks]') }; localStorage.removeItem('home.blocks'); App.homeOpen = {}; return r; });
  log('carte projet (défaut direction, choix lots+rappels)', hb); if (hb.table || !hb.cust || hb.def.includes('rec')) v44.push('carte projet selon le service');
  const hbq = await B.pg.evaluate(() => [...homeBlocks()]); log('carte projet du conducteur B (travaux)', hbq);
  await A.pg.evaluate(async () => { await renderHome(); }); await A.pg.waitForTimeout(400); await shot(A.pg, '185_accueil_verre');
  // photos : enregistrement immédiat (sans écran bloquant), préparation en arrière-plan, puis suppression avec nettoyage des références
  const ph = await A.pg.evaluate(async () => {
    const p = (await DB.all('projects')).find(x => !x.deleted);
    const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; c.getContext('2d').fillRect(0, 0, 50, 50);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95)); const files = [0, 1, 2].map(i => new File([blob], `ph${i}.jpg`, { type: 'image/jpeg' }));
    const t0 = performance.now(); const recs = await PhotoQ.save(p.id, files, { source: 'Test' }); const ms = Math.round(performance.now() - t0);
    const blocked = !!document.querySelector('.loading'); const pill = !!document.getElementById('phPill');
    const task = await DB.put('tasks', { projectId: p.id, num: 999, kind: 'reserve', title: 'Test photos', status: 'open', photoIds: recs.map(r => r.id), log: [] });
    for (let i = 0; i < 60 && PhotoQ.pending(); i++) await new Promise(r => setTimeout(r, 200));
    const f0 = await DB.get('files', recs[0].id), prep = !!f0.prep, small = f0.blob.size < blob.size || f0.w <= 2000;
    await PhotoQ.remove([recs[0].id, recs[1].id], { ask: false });
    const t2 = await DB.get('tasks', task.id), gone = !(await DB.get('files', recs[0].id));
    await PhotoQ.remove([recs[2].id], { ask: false }); await DB.del('tasks', task.id);
    return { ms, blocked, pill, prep, small, left: t2.photoIds.length, gone };
  });
  log('photos sans attente + suppression', ph); if (ph.blocked || !ph.pill || ph.prep || ph.left !== 1 || !ph.gone) v44.push('photos');
  // sélection multiple par appui long
  const sel44 = await A.pg.evaluate(async () => { const box = document.createElement('div'); box.className = 'thumbs'; box.innerHTML = '<div class="t" data-id="zz1"></div><div class="t" data-id="zz2"></div>'; document.body.appendChild(box);
    const t = box.firstChild, ev = (type) => t.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: 5, clientY: 5 }));
    ev('pointerdown'); await new Promise(r => setTimeout(r, 700)); ev('pointerup'); t.click(); box.children[1].click();
    const r = { mode: box.classList.contains('sel-mode'), n: box.querySelectorAll('.ph-sel').length, bar: !!document.getElementById('selBar') }; PhotoQ.endSel(); box.remove(); return r; });
  log('sélection multiple (appui long)', sel44); if (!sel44.mode || sel44.n !== 2 || !sel44.bar) v44.push('sélection multiple');
  // écran de démarrage : logo et têtes colorées
  { const P = A.pg; await P.reload({ waitUntil: 'commit' }); await P.waitForSelector('#boot .hb', { timeout: 8000 }).catch(() => {}); await P.waitForTimeout(350); await shot(P, '186_demarrage_logo');
    const bt = await P.evaluate(() => ({ heads: document.querySelectorAll('#boot .hb').length, on: document.querySelectorAll('#bootb rect.p').length, letters: document.querySelectorAll('#boot b span').length }));
    log('démarrage : logo', bt); if (bt.heads !== 3 || bt.letters !== 8) v44.push('écran de démarrage');
    await P.waitForSelector('.home2', { timeout: 30000 }); await P.waitForTimeout(1500);
    const stray = await P.evaluate(() => !!document.getElementById('boot') || !!document.getElementById('bootb') || [...document.querySelectorAll('body *:not(script)')].some(e => !e.children.length && /Ouverture…/.test(e.textContent))); log('démarrage : rien ne reste à l\'écran', !stray); if (stray) v44.push('texte du démarrage resté'); }
  log('errors v1.0.44', v44);
  // ---- v1.0.45 : accès sur code uniquement (côté application) + démarrage sans attendre le réseau
  const v45 = [];
  await E.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.ws-dd').forEach(x => x.remove()); localStorage.setItem('team.appCfg', JSON.stringify({ inviteOnly: true })); Team.openSwitcher(); });
  await E.pg.waitForSelector('.sheet [data-a=new]', { timeout: 8000 }).catch(() => {}); await E.pg.click('.sheet [data-a=new]').catch(() => {}); await E.pg.waitForSelector('.st-onb', { timeout: 8000 }).catch(() => {});
  const ob = await E.pg.evaluate(() => ({ perso: !!document.querySelector('.st-onb [data-a=perso]'), create: !!document.querySelector('.st-onb [data-a=create]'), join: !!document.querySelector('.st-onb [data-a=join]'), txt: (document.querySelector('.st-onb p') || {}).textContent }));
  log('code uniquement : choix à l\'inscription', ob); await shot(E.pg, '190_code_uniquement_inscription'); if (ob.perso || ob.create || !ob.join) v45.push('inscription sans code possible');
  await E.pg.reload({ waitUntil: 'commit' }); await E.pg.waitForSelector('.st-gate, .home2', { timeout: 30000 }).catch(() => {}); await E.pg.waitForTimeout(800);
  const gt = await E.pg.evaluate(() => ({ gate: !!document.querySelector('.st-gate'), title: (document.querySelector('.st-gate h1') || {}).textContent, code: !!document.querySelector('.st-gate [data-g=code]') }));
  log('code uniquement : espace personnel bloqué', gt); await shot(E.pg, '191_code_uniquement_ecran'); if (!gt.gate || !gt.code) v45.push('espace personnel non bloqué');
  await E.pg.evaluate(() => localStorage.setItem('team.appCfg', JSON.stringify({}))); await E.pg.reload({ waitUntil: 'commit' }); await E.pg.waitForSelector('.home2', { timeout: 30000 }).catch(() => {});
  log('code uniquement désactivé : accès rétabli', await E.pg.evaluate(() => !!document.querySelector('.home2') && !document.querySelector('.st-gate')));
  // démarrage : l'accueil s'affiche depuis le cache même si le réseau est très lent
  { const P = A.pg; await P.route('http://127.0.0.1:8080/**', async r => { await new Promise(x => setTimeout(x, 6000)); r.continue().catch(() => {}); }).catch(() => {});
    const t0 = Date.now(); await P.reload({ waitUntil: 'commit' }); await P.waitForSelector('.home2', { timeout: 30000 }).catch(() => {}); const ms = Date.now() - t0;
    log('démarrage avec réseau lent (ms jusqu\'à l\'accueil)', ms); await P.unroute('http://127.0.0.1:8080/**').catch(() => {}); await P.waitForTimeout(1500); }
  log('errors v1.0.45', v45);
  // ---- v1.0.46 : outils du projet dépliables, avancement Pro Macro (zones, saisie du jour, équipes, tableau de bord, rapports), local technique
  const v46 = [];
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg,.ws-dd').forEach(x => x.remove()); localStorage.removeItem('ptools.open'); const p = (await DB.all('projects')).find(x => !x.deleted && Team.canProject(x.id)); await openProject(p, 'ptools'); });
  await A.pg.waitForSelector('.st-ptools-p', { timeout: 10000 }); await A.pg.waitForTimeout(400);
  const pt46 = await A.pg.evaluate(() => ({ qa: [...document.querySelectorAll('.st-qa-b span')].map(x => x.textContent), cats: document.querySelectorAll('.st-acc[data-g]').length, open: document.querySelectorAll('.st-acc[data-g][open]').length }));
  log('outils du projet : actions rapides + catégories dépliables', pt46); await shot(A.pg, '200_outils_depliables'); if (!pt46.qa.length || pt46.open !== 1 || pt46.cats < 2) v46.push('outils du projet');
  await A.pg.click('.st-acc[data-g]:not([open]) > summary'); await A.pg.waitForTimeout(250);
  log('catégorie ouverte mémorisée', await A.pg.evaluate(() => JSON.parse(localStorage.getItem('ptools.open') || '[]').length));
  // données : 2 zones, 2 niveaux avec plan, pins, équipes, journal
  const av46 = await A.pg.evaluate(async () => {
    const p = App.project; avLots(p);
    const c = document.createElement('canvas'); c.width = 1200; c.height = 800; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1200, 800); g.strokeStyle = '#333'; g.lineWidth = 6; g.strokeRect(50, 50, 1100, 700); g.beginPath(); g.moveTo(600, 50); g.lineTo(600, 750); g.stroke();
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9)); const f = await DB.put('files', { projectId: p.id, blob, mime: 'image/jpeg', name: 'plan.jpg', role: 'plan' });
    const mk = async (name) => DB.put('plans', { projectId: p.id, fileId: f.id, w: 1200, h: 800, name, annotations: [], indice: 'A' });
    const pl1 = await mk('RDC zone 1'), pl2 = await mk('R+1 zone 2');
    p.avZones = ['Zone 1', 'Zone 2']; p.avNiveaux = [{ id: 'n1', name: 'RDC', serieId: planSerie(pl1), zone: 'Zone 1' }, { id: 'n2', name: 'R+1', serieId: planSerie(pl2), zone: 'Zone 2' }];
    p.avTeams = [{ id: 't1', name: 'Équipe Rachid', resp: 'Rachid', color: '#2563eb', lot: p.lots[0].id }, { id: 't2', name: 'STE Atlas', resp: 'Karim', color: '#0d9488', lot: p.lots[1].id }];
    await DB.put('projects', p);
    const L1 = await DB.put('links', { projectId: p.id, planId: pl1.id, nivId: 'n1', kind: 'local', shape: 'point', x: 300, y: 300, name: 'LT 01', lots: {}, items: [] });
    const L2 = await DB.put('links', { projectId: p.id, planId: pl1.id, nivId: 'n1', kind: 'local', shape: 'point', x: 800, y: 300, name: 'Couloir A', type: 'travail', lots: {}, items: [] });
    const L3 = await DB.put('links', { projectId: p.id, planId: pl2.id, nivId: 'n2', kind: 'local', shape: 'point', x: 500, y: 500, name: 'LT 12', lots: {}, items: [] });
    const t = todayISO(), y = avAddDays(t, -3);
    const add = async (L, d, lot, eq, pct, eff) => { const e = { id: DB.uid(), d, t: Date.now() + Math.random(), lot, eq, pct, eff, photos: [], prev: avPctAt(L, lot, avAddDays(d, -1)) }; L.journal = [...(L.journal || []), e]; avApplyEntry(L, e); await DB.put('links', L); };
    await add(L1, y, p.lots[0].id, 't1', 40, 4); await add(L1, t, p.lots[0].id, 't1', 100, 5); await add(L2, t, p.lots[0].id, 't1', 50, 3); await add(L3, t, p.lots[1].id, 't2', 30, 6);
    const l1 = await DB.get('links', L1.id);
    return { state: l1.lots[p.lots[0].id].state, pctY: avPctAt(l1, p.lots[0].id, y), pctT: avPctAt(l1, p.lots[0].id, t) };
  });
  log('journal → état du lot [état, % il y a 3 j, % aujourd\'hui]', av46); if (av46.state !== 'done' || av46.pctY !== 40 || av46.pctT !== 100) v46.push('journal / état');
  await A.pg.evaluate(async () => { App.avTab = 'dash'; App.avF = null; try { localStorage.removeItem('avF.' + App.project.id); } catch (e) {} App.section = 'avancement'; await renderSection(); }); await A.pg.waitForSelector('.avp-hero', { timeout: 10000 }); await A.pg.waitForTimeout(500);
  const d46 = await A.pg.evaluate(() => ({ glob: (document.querySelector('.avp-hero .avp-dn text') || {}).textContent, rows: [...document.querySelectorAll('.avp-mx tr:not(.avp-totr) .avp-rh b')].map(b => b.textContent), today: document.querySelectorAll('.avp-today').length, teams: [...document.querySelectorAll('.avte-c .grow > b')].map(b => b.textContent), curve: !!document.querySelector('.avp-curve polyline') }));
  log('tableau de bord Pro Macro', d46); await shot(A.pg, '201_pro_macro'); if (d46.rows.join('|') !== 'Zone 1|Zone 2' || d46.today < 3 || d46.teams.length !== 2 || !d46.curve) v46.push('tableau de bord');
  await A.pg.evaluate(() => document.querySelector('.avp-mx').scrollIntoView()); await shot(A.pg, '202_matrice_zones');
  await A.pg.click('.avp-rh[data-row="z:Zone 1"]'); await A.pg.waitForTimeout(400);
  const z46 = await A.pg.evaluate(() => ({ rows: [...document.querySelectorAll('.avp-mx tr:not(.avp-totr) .avp-rh b')].map(b => b.textContent), zone: App.avF.zone }));
  log('filtre zone → niveaux', z46); await shot(A.pg, '203_zone1_niveaux'); if (z46.rows.join('|') !== 'RDC' || z46.zone !== 'Zone 1') v46.push('filtre zone');
  await A.pg.evaluate(() => { App.avF = null; try { localStorage.removeItem('avF.' + App.project.id); } catch (e) {} });
  // rapports : CSV + PDF
  const ex46 = await A.pg.evaluate(async () => { const p = App.project, { locaux, nivs } = await avData(p); let csv = null; const sb = window.shareBlob; window.shareBlob = async (b, n) => { csv = [n, (await b.text()).split('\n').length]; }; await avProExport('csv', p, nivs, locaux); window.shareBlob = sb;
    window.PdfCapture = []; await avProExport('pdf', p, nivs, locaux); const pdf = window.PdfCapture.length && window.PdfCapture[0].fname; const L = locaux.find(l => l.name === 'LT 01'); window.PdfCapture = []; await avDossierLocal(p, L); const dos = window.PdfCapture.length && window.PdfCapture[0].fname; delete window.PdfCapture; return { csv, pdf, dos }; });
  log('rapports [CSV, PDF, dossier du local]', ex46); if (!ex46.csv || ex46.csv[1] < 8 || !ex46.pdf || !ex46.dos) v46.push('rapports');
  // saisie du jour depuis l'interface
  await A.pg.evaluate(async () => { const p = App.project, L = (await DB.byProject('links', p.id)).find(l => l.name === 'LT 12'); window.__aj = avJourForm(p, L, { lot: p.lots[0].id }); });
  await A.pg.waitForSelector('.sheet [name=pct]'); await shot(A.pg, '204_saisie_du_jour');
  await A.pg.selectOption('.sheet [name=pct]', '60'); await A.pg.selectOption('.sheet [name=eq]', 't2'); await A.pg.fill('.sheet [name=eff]', '7'); await A.pg.click('.sheet [data-a=ok]'); await A.pg.waitForTimeout(600);
  const j46 = await A.pg.evaluate(async () => { const p = App.project, L = (await DB.byProject('links', p.id)).find(l => l.name === 'LT 12'), r = L.lots[p.lots[0].id]; return { n: (L.journal || []).length, state: r.state, pct: r.pct, eq: r.eq }; });
  log('saisie du jour (interface)', j46); if (j46.n !== 2 || j46.pct !== 60 || j46.eq !== 't2') v46.push('saisie du jour');
  await A.pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); openAvJour(App.project); }); await A.pg.waitForSelector('.avj-page .avj-row', { timeout: 8000 }); await A.pg.waitForTimeout(300);
  log('page avancement du jour [lignes, zones]', await A.pg.evaluate(() => [document.querySelectorAll('.avj-row').length, document.querySelectorAll('.avj-z').length])); await shot(A.pg, '205_avancement_du_jour');
  // fiche du local : étapes photo + type de chape
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); const p = App.project, L = (await DB.byProject('links', p.id)).find(l => l.name === 'LT 01'); openAvLocal(L, p.lots[0].id, () => {}); });
  await A.pg.waitForSelector('.avp-mode [data-md=et]'); await A.pg.click('.avp-mode [data-md=et]'); await A.pg.waitForSelector('.avp-etr');
  await A.pg.click('.avp-etr [data-etok]'); await A.pg.waitForTimeout(300);
  const et46 = await A.pg.evaluate(async () => { const p = App.project, L = (await DB.byProject('links', p.id)).find(l => l.name === 'LT 01'); return { etapes: [...document.querySelectorAll('.avp-etr b')].map(b => b.textContent), done: Object.values(L.etapes || {}).filter(x => x.done).length }; });
  log('local technique : étapes', et46); await shot(A.pg, '206_local_etapes'); if (et46.etapes.length !== 4 || et46.done !== 1) v46.push('étapes du local');
  await A.pg.click('.avp-mode [data-md=jr]'); await A.pg.waitForTimeout(250); await shot(A.pg, '207_local_journal');
  await A.pg.evaluate(() => document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()));
  // zoom du plan : deux calques HD (fondu)
  log('plan : double calque HD', await A.pg.evaluate(async () => { const pl = (await DB.byProject('plans', App.project.id))[0]; openPlanViewer(pl, planCtx(() => {})); await new Promise(r => setTimeout(r, 900)); const n = document.querySelectorAll('.stage canvas.hd').length; document.querySelectorAll('.viewer, .fullpage').forEach(x => x.remove()); return n; }));
  // ---- v1.0.46 (suite) : secteurs → zones dessinées (joints), import des locaux du PDF, types de local, calque ANEP, comparaison
  const zp46 = await A.pg.evaluate(async () => {
    const p = App.project, niv = p.avNiveaux.find(n => n.id === 'n1');
    niv.zonePolys = [{ zone: 'Zone 1', pts: [[0, 0], [600, 0], [600, 800], [0, 800]] }]; p.avSecteurs = ['Ouest', 'Nord']; p.avZoneSect = { 'Zone 1': 'Ouest', 'Zone 2': 'Nord' }; await DB.put('projects', p);
    const n = await avAssignZones(p, niv), L = (await DB.byProject('links', p.id)).filter(l => l.nivId === 'n1');
    return { n, zones: L.map(l => l.name + '=' + (l.zone || '-')) };
  });
  log('zone dessinée → pins rattachés', zp46); if (!zp46.zones.includes('LT 01=Zone 1') || zp46.zones.includes('Couloir A=Zone 1')) v46.push('zones dessinées');
  await A.pg.evaluate(async () => { App.avTab = 'dash'; App.avF = null; try { localStorage.removeItem('avF.' + App.project.id); } catch (e) {} await renderSection(); }); await A.pg.waitForSelector('.avp-hero'); await A.pg.waitForTimeout(300);
  const s46 = await A.pg.evaluate(() => ({ rows: [...document.querySelectorAll('.avp-mx tr:not(.avp-totr) .avp-rh b')].map(b => b.textContent), sect: !!document.querySelector('.avf-bar select[data-fk=sect]') }));
  log('tableau de bord : secteurs', s46); await shot(A.pg, '208_secteurs'); if (!s46.rows.includes('Ouest') || !s46.rows.includes('Nord') || !s46.sect) v46.push('secteurs');
  // import des locaux depuis les textes du PDF (textes simulés comme ceux du plan du Grand Stade)
  await A.pg.evaluate(async () => {
    window.__pt = window.planTexts; const T = [];
    const lab = (x, y, a, b, m) => { T.push({ s: a, x, y, w: a.length * 7, h: 10 }); T.push({ s: b, x, y: y + 13, w: b.length * 7, h: 10 }); if (m) T.push({ s: m, x, y: y + 26, w: 50, h: 10 }); };
    lab(100, 100, 'CORE 01', 'RISER LT', '10.23 m²'); lab(400, 100, 'CORE 02', 'RISER LT', '16.32 m²'); lab(700, 100, 'CORE 03', 'RISER PH', '');
    lab(100, 500, 'CORE 04', 'RISER LT', '9.80 m²'); T.push({ s: 'A1', x: 50, y: 30, w: 14, h: 10 }, { s: 'A2', x: 300, y: 30, w: 14, h: 10 }, { s: 'JD01', x: 900, y: 30, w: 28, h: 10 });
    window.planTexts = async () => T;
    const p = App.project, niv = p.avNiveaux.find(n => n.id === 'n2'), plan = await latestPlanOfSerie(p.id, niv.serieId);
    window.__imp = avImportLocaux(p, niv, plan);
  });
  await A.pg.waitForSelector('.avi [data-a=go]', { timeout: 8000 }); await shot(A.pg, '209_import_locaux');
  const fam46 = await A.pg.evaluate(() => [...document.querySelectorAll('.avi-r b')].map(b => b.textContent));
  await A.pg.click('.avi [data-a=go]'); await A.pg.waitForTimeout(800);
  const im46 = await A.pg.evaluate(async () => { const n = await window.__imp; window.planTexts = window.__pt; const p = App.project; const L = (await DB.byProject('links', p.id)).filter(l => l.nivId === 'n2' && l.src === 'pdf');
    return { n, names: L.map(l => l.name), areas: L.map(l => l.area || ''), typed: L.filter(l => l.ltype).length }; });
  log('import des locaux [familles, pins]', fam46, im46); if (!fam46.includes('CORE') || im46.n !== 4 || !im46.areas.includes('16.32') || !im46.typed) v46.push('import des locaux');
  // calque ANEP : seuls les numéros propres au plan ANEP, puis numérotation des pins
  const an46 = await A.pg.evaluate(async () => {
    const p = App.project, niv = p.avNiveaux.find(n => n.id === 'n2'), base = await latestPlanOfSerie(p.id, niv.serieId);
    const ap = await DB.put('plans', { projectId: p.id, fileId: base.fileId, w: base.w, h: base.h, name: 'R+1 ANEP', annotations: [], indice: 'A' });
    niv.plans = [{ id: 'pa', serieId: planSerie(ap), kind: 'anep', label: 'Numérotation ANEP' }]; await DB.put('projects', p);
    const common = [{ s: 'A1', x: 50, y: 30, w: 14, h: 10 }, { s: 'JD01', x: 900, y: 30, w: 28, h: 10 }, { s: 'CORE 01', x: 100, y: 100, w: 49, h: 10 }];
    const pt = window.planTexts, pm = window.planAlignMap; window.planTexts = async (pl) => pl.id === ap.id ? [...common, { s: 'R1-E-014', x: 110, y: 160, w: 60, h: 10 }, { s: 'R1-E-015', x: 410, y: 160, w: 60, h: 10 }] : common;
    window.planAlignMap = async () => ({ sx: 1, sy: 1, ox: 0, oy: 0 });
    const L = await avAnepLabels(p, niv, base); await avAnepToPins(p, niv, base); window.planTexts = pt; window.planAlignMap = pm;
    const pins = (await DB.byProject('links', p.id)).filter(l => l.nivId === 'n2' && l.anep);
    return { labels: L.map(t => t.s), pins: pins.map(l => l.name.split(' · ')[0] + '=' + l.anep) };
  });
  log('calque ANEP [numéros, pins numérotés]', an46); if (an46.labels.join() !== 'R1-E-014,R1-E-015' || !an46.pins.some(x => x.startsWith('CORE 01=R1-E-014'))) v46.push('calque ANEP');
  // visionneuse : zone dessinée + pins colorés par type, puis comparaison
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); openAvViewer('n1', null, () => {}); }); await A.pg.waitForSelector('.av-page .av-ov', { timeout: 8000 }); await A.pg.waitForTimeout(600);
  log('visionneuse : zones dessinées, bouton plans', await A.pg.evaluate(() => [document.querySelectorAll('.av-ov polygon').length, !!document.querySelector('.av-page [data-a=plans]')])); await shot(A.pg, '210_plan_zones');
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); const p = App.project; window.__cmp = avComparePlans(p, p.avNiveaux.find(n => n.id === 'n2')); });
  await A.pg.waitForSelector('.sheet .opt'); await A.pg.locator('.sheet .opt').first().click(); await A.pg.waitForTimeout(300); await A.pg.locator('.sheet .opt').first().click();
  // v1.0.50 : même écran que « Comparer deux niveaux » → d'abord le calage à l'équerre (une fois par plan)
  await A.pg.waitForSelector('.fullpage.rl', { timeout: 8000 }); await A.pg.waitForTimeout(500); await shot(A.pg, '211_comparaison_plans_equerre');
  log('comparaison de plans du même niveau → calage à l\'équerre', await A.pg.evaluate(() => [!!document.querySelector('.rl-ov'), !!document.querySelector('.rl-btns [data-b=fix]')]));
  await A.pg.evaluate(() => document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()));
  // planning des lots : dates prévues → alertes ; calage manuel 2 points ; avancement de deux lots
  const pl46 = await A.pg.evaluate(async () => { const p = App.project, lot = p.lots[1], n2 = p.avNiveaux.find(n => n.id === 'n2'), n1 = p.avNiveaux.find(n => n.id === 'n1');
    p.avPlan = { ['n1|' + p.lots[0].id]: { deb: avAddDays(todayISO(), -20), fin: avAddDays(todayISO(), -2) }, ['n2|' + lot.id]: { deb: avAddDays(todayISO(), -10), fin: avAddDays(todayISO(), 3) }, ['n1|' + p.lots[2].id]: { deb: avAddDays(todayISO(), -5), fin: avAddDays(todayISO(), 30) } }; await DB.put('projects', p);
    const L = (await DB.byProject('links', p.id)).filter(l => l.kind === 'local');
    const a = avLotPlanning(p, n1, p.lots[0], L.filter(l => l.nivId === 'n1')), b = avLotPlanning(p, n2, lot, L.filter(l => l.nivId === 'n2')), c = avLotPlanning(p, n1, p.lots[2], L.filter(l => l.nivId === 'n1'));
    const m = avSim([0, 0], [100, 0], [10, 20], [10, 220]), q = avApply(m, 100, 0), back = avApply(avInv(m), 10, 220);
    return { a: a.al.map(x => x[1]), b: b.al.map(x => x[1]), c: c.al.map(x => x[1]), sim: [Math.round(q[0]), Math.round(q[1]), Math.round(back[0]), Math.round(back[1])] }; });
  log('planning des lots : alertes [lot fini en retard ?, fin proche, pas démarré] + calage 2 points', pl46);
  if (!pl46.c.some(x => /Pas démarré/.test(x)) || !pl46.b.some(x => /Fin dans|rythme/.test(x)) || pl46.sim.join() !== '10,220,100,0') v46.push('planning / calage');
  await A.pg.evaluate(async () => { App.avTab = 'dash'; App.avF = null; try { localStorage.removeItem('avF.' + App.project.id); } catch (e) {} await renderSection(); }); await A.pg.waitForSelector('.avp-pt', { timeout: 8000 });
  await A.pg.evaluate(() => document.querySelector('.avp-pt').scrollIntoView()); await A.pg.waitForTimeout(300); await shot(A.pg, '212_planning_des_lots');
  log('planning : cases, alertes', await A.pg.evaluate(() => [document.querySelectorAll('.avp-pt td[data-pl]').length, document.querySelectorAll('.avp-al').length]));
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); openAvViewer('n1', null, () => {}); }); await A.pg.waitForSelector('.av-page [data-a=plans]');
  await A.pg.click('.av-page [data-a=plans]'); await A.pg.click('.opt:has-text("Avancement de deux lots")'); await A.pg.locator('.sheet .opt').first().click(); await A.pg.waitForTimeout(250); await A.pg.locator('.sheet .opt').first().click(); await A.pg.waitForTimeout(500);
  log('avancement de deux lots (pins coupés)', await A.pg.evaluate(() => [document.querySelectorAll('.av-ov path').length, !!document.querySelector('[data-a=twoimg]')])); await shot(A.pg, '213_deux_lots');
  await A.pg.evaluate(() => document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()));
  log('errors v1.0.46', v46);
  // ---- v1.0.47 : plans A0 par tuiles, ordre des niveaux, lien Plans ↔ Avancement, zones par joints, Pro (choix, période, total, équipes), saisie intelligente, photos classées
  const v47 = [];
  const b47 = await A.pg.evaluate(async () => {
    const o = {};
    o.tiles = [typeof pdfPageToBlob, PDF_MAXSIDE, planNeedsHeal({ pdfFileId: 'x', w: 5000, h: 3535 }), planNeedsHeal({ pdfFileId: 'x', w: 4000, h: 2800 })];
    o.order = ['R+1', 'RDC', 'SSL', '2-MEZZ', 'R+2', 'Terrasse', 'SS2'].map(n => ({ name: n })).sort((a, b) => avNivRank(a.name) - avNivRank(b.name)).map(x => x.name).join(',');
    const p = App.project; o.lots = avLotsOrdered({ lots: [{ id: 'p', name: 'Peinture' }, { id: 'c', name: 'Chape' }, { id: 'm', name: 'Maçonnerie' }, { id: 'e', name: 'Enduit' }] }).map(l => l.name).join(',');
    // lien Plans → Avancement : dossier « 3-R+2 » avec un plan général et un plan maçonnerie
    const f = await DB.put('folders', { projectId: p.id, name: '3-R+2' }), base = await latestPlanOfSerie(p.id, p.avNiveaux[0].serieId);
    const g = await DB.put('plans', { projectId: p.id, folderId: f.id, fileId: base.fileId, w: base.w, h: base.h, name: 'R+2 général', annotations: [], indice: 'A' });
    const m = await DB.put('plans', { projectId: p.id, folderId: f.id, lotId: 'mac', fileId: base.fileId, w: base.w, h: base.h, name: 'R+2 maçonnerie', annotations: [], indice: 'B', indiceDate: '2026-10-20' });
    await avSyncFromPlans(p, true); const n = p.avNiveaux.find(x => x.folderId === f.id), mac = p.lots.find(l => /ma[cç]on/i.test(l.name));
    o.sync = n ? [n.name, n.serieId === planSerie(g), !!(n.lotPlan || {})[mac.id], (n.plans || []).length] : null;
    const lp = n && await avLotPlan(p, n, mac.id); o.lotPlan = lp ? lp.plan.name : '';
    // zones par joints : stade (secteurs) et bâtiment (bandes)
    const T = [], C = [500, 400]; for (let k = 1; k <= 8; k++) { const a = (k - 1) * Math.PI / 4; T.push({ s: 'JD' + String(k).padStart(2, '0'), x: C[0] + 300 * Math.cos(a), y: C[1] + 300 * Math.sin(a), w: 30, h: 10 }); T.push({ s: 'JD ' + k, x: C[0] + 150 * Math.cos(a), y: C[1] + 150 * Math.sin(a), w: 30, h: 10 }); }
    const J = avJointsOf(T), c = avJointsCenter(J, 1000, 800), R = avRadialZones(J, c, 1000, 800, 'zone', 1);
    const S = avStripZones([{ k: 'JD01', n: 1, P: [[300, 10], [300, 700]] }, { k: 'JD02', n: 2, P: [[650, 10], [650, 700]] }], 1000, 800, 'joint', 1);
    o.joints = [J.length, Math.abs(c[0] - 500) < 30 ? 50 : c[0], Math.abs(c[1] - 400) < 30 ? 40 : c[1], R.length, R[0].zone, avZoneAt({ zonePolys: R }, C[0] + 200 * Math.cos(Math.PI / 8), C[1] + 200 * Math.sin(Math.PI / 8)), S.length, avZoneAt({ zonePolys: S }, 500, 300)];
    // saisie express
    const { locaux, nivs } = await avData(p), pin = locaux.find(l => l.nivId === 'n1'), nv = nivs.find(x => x.id === 'n1');
    const x = avParseLine(p, `${nv.name} ${mac.name.slice(0, 4)} ${pin.name} 80 6p`, nivs, locaux); o.express = x ? [x.loc && x.loc.id === pin.id, x.lot && x.lot.id, x.pct, x.eff, x.err] : null;
    // lot terminé → plus d'alerte rouge ; retard en jours sinon
    p.avPlan = p.avPlan || {}; p.avPlan['n1|' + mac.id] = { deb: avAddDays(todayISO(), -9), fin: avAddDays(todayISO(), -4) };
    const L = locaux.filter(l => l.nivId === 'n1'), a1 = avLotPlanning(p, nv, mac, L); p.avPlan['n1|' + mac.id].done = avAddDays(todayISO(), -1); const a2 = avLotPlanning(p, nv, mac, L); delete p.avPlan['n1|' + mac.id].done; await DB.put('projects', p);
    o.done = [a1.late, (a1.al[0] || [])[1], !!a2.finR, (a2.al[0] || [''])[0]];
    o.period = ['today', 'week', 'total'].map(k => avPeriod({ pk: k }).l).join('|');
    return o; });
  log('v1.0.47 : tuiles A0, ordre, lien plans, joints, express, terminé', b47);
  if (b47.tiles[0] !== 'function' || b47.tiles[1] !== 4096 || !b47.tiles[2] || b47.tiles[3]) v47.push('tuiles A0');
  if (b47.order !== 'SS2,SSL,RDC,2-MEZZ,R+1,R+2,Terrasse') v47.push('ordre des niveaux');
  if (b47.lots !== 'Maçonnerie,Enduit,Chape,Peinture') v47.push('ordre des lots');
  if (!b47.sync || b47.sync[0] !== 'R+2' || !b47.sync[1] || !b47.sync[2] || b47.lotPlan !== 'R+2 maçonnerie') v47.push('lien Plans → Avancement');
  if (b47.joints[0] !== 8 || b47.joints[1] !== 50 || b47.joints[2] !== 40 || b47.joints[3] !== 8 || b47.joints[4] !== 'Zone 1' || b47.joints[5] !== 'Zone 1' || b47.joints[6] !== 3 || b47.joints[7] !== 'Joint 2') v47.push('zones par joints');
  if (!b47.express || !b47.express[0] || b47.express[2] !== 80 || b47.express[3] !== 6 || b47.express[4]) v47.push('saisie express');
  if (b47.done[0] !== 4 || !/En retard de 4 j/.test(b47.done[1]) || !b47.done[2] || b47.done[3] !== 'o') v47.push('lot terminé / retard');
  // Pro : barre de choix (listes déroulantes), période, total, équipes & sous-traitants
  await A.pg.evaluate(async () => { const p = App.project; for (const t of [{ id: 't1', name: 'Sgtm', type: 'int', color: '#2563eb' }, { id: 't2', name: 'STE Atlas', type: 'st', soc: 'Atlas SARL', color: '#ea580c' }]) if (!avTeam(p, t.id)) avTeams(p).push(t); else Object.assign(avTeam(p, t.id), { type: t.type, ...(t.soc ? { soc: t.soc } : {}) });
    const L = (await DB.byProject('links', p.id)).filter(l => l.kind === 'local' && l.nivId === 'n1'); const lot = p.lots[0];
    for (const [i, l] of L.slice(0, 2).entries()) { avEntryOn(p, l, { d: todayISO(), lot: lot.id, pct: 50 + i * 25, eq: i ? 't2' : 't1', eff: 4 + i }); await DB.put('links', l); }
    await DB.put('projects', p); document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.avTab = 'dash'; App.avF = null; try { localStorage.removeItem('avF.' + App.project.id); } catch (e) {} try { localStorage.removeItem('avF.' + p.id); } catch (e) {} await renderSection(); });
  await A.pg.waitForSelector('.avf-bar select[data-fk=pk]', { timeout: 8000 });
  await A.pg.selectOption('.avf-bar select[data-fk=pk]', 'today'); await A.pg.waitForTimeout(400);
  const pro47 = await A.pg.evaluate(() => ({ sel: [...document.querySelectorAll('.avf-bar select')].map(s => s.dataset.fk).join(','), scope: (document.querySelector('.avf-scope') || {}).textContent, gain: (document.querySelector('.avp-gain b') || {}).textContent,
    total: !!document.querySelector('.avp-totr .avp-tot.big'), teams: document.querySelectorAll('.avte-c').length, st: [...document.querySelectorAll('.avte-c em')].some(e => /Sous-traitant/.test(e.textContent)) }));
  log('Pro : choix, période, total, équipes', pro47); await shot(A.pg, '220_pro_choix_periode');
  if (!/zone,niv,lot,eq.*pk/.test(pro47.sel) || !/Aujourd'hui/.test(pro47.scope) || !pro47.total || pro47.teams < 2 || !pro47.st) v47.push('Pro : barre de choix / équipes');
  await A.pg.evaluate(() => { const t = document.querySelector('.avte-c'); t.scrollIntoView(); }); await A.pg.waitForTimeout(200); await shot(A.pg, '221_equipes_sous_traitants');
  await A.pg.click('.avte-c'); await A.pg.waitForSelector('.avtf', { timeout: 5000 }); await shot(A.pg, '222_fiche_equipe');
  log('fiche équipe', await A.pg.evaluate(() => [...document.querySelectorAll('.avtf-k b')].map(b => b.textContent).join(' | ')));
  // tableau rapide : toucher une case → 25 %, enregistrer → journal
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); openAvTable(App.project, { nivId: 'n1' }); });
  await A.pg.waitForSelector('.avt td[data-c]', { timeout: 8000 });
  const c47 = await A.pg.evaluate(() => { const td = [...document.querySelectorAll('.avt td[data-c]')].find(t => t.textContent.trim() === '0'); return td ? td.dataset.c : ''; });
  await A.pg.click(`.avt td[data-c="${c47}"]`); await A.pg.waitForTimeout(200); await shot(A.pg, '223_tableau_rapide');
  const t47a = await A.pg.evaluate(() => [document.querySelector('.avt-foot b').textContent, document.querySelector('.avt td.ch') ? document.querySelector('.avt td.ch').textContent.trim() : '']);
  await A.pg.click('.avt-foot [data-a=save]'); await A.pg.waitForTimeout(600);
  const t47 = await A.pg.evaluate(async (c) => { const [lid, lot] = c.split('|'), l = await DB.get('links', lid); const e = (l.journal || []).filter(x => x.lot === lot).pop(); return [e ? e.pct : null, e ? e.src : '', document.querySelector('.avt-foot b').textContent]; }, c47);
  log('tableau rapide [modif, case, journal]', t47a, t47); if (t47a[0] !== '1' || t47a[1] !== '25' || t47[0] !== 25 || t47[1] !== 'tab' || t47[2] !== '0') v47.push('tableau rapide');
  // visionneuse : plan du lot affiché, bouton comparer, sélection plusieurs pins
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); const p = App.project, n = p.avNiveaux.find(x => x.name === 'R+2'); const mac = p.lots.find(l => /ma[cç]on/i.test(l.name)); openAvViewer(n.id, mac.id, () => {}); });
  await A.pg.waitForSelector('.av-page .av-ov', { timeout: 8000 }); await A.pg.waitForTimeout(400);
  const vw47 = await A.pg.evaluate(() => [document.querySelector('.av-page .tb-title').textContent.trim(), !!document.querySelector('.av-page [data-a=cmpq]'), !!document.querySelector('.av-page [data-a=sel]')]);
  await A.pg.click('.av-page [data-a=sel]'); await A.pg.waitForTimeout(200);
  const sl47 = await A.pg.evaluate(() => [!!document.querySelector('.av-legend [data-s=lasso]'), !!document.querySelector('.av-legend [data-s=go]')]); await shot(A.pg, '224_selection_pins');
  log('visionneuse : plan du lot, comparer, sélection', vw47, sl47); if (!/R\+2/.test(vw47[0]) || !/ma[cç]onnerie/i.test(vw47[0]) || !vw47[1] || !sl47[0] || !sl47[1]) v47.push('visionneuse lot / sélection');
  // Plans › lot › niveau : bloc avancement (lien direct, dates, terminé)
  const lp47 = await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); const p = App.project, f = (await DB.byProject('folders', p.id)).find(x => x.name === '3-R+2'), L = planLots(p).find(l => l.id === 'mac');
    const el = avLotPanelBlock(p, L, f, () => {}); el.id = 'lp47'; const host = document.createElement('div'); host.className = 'fullpage'; host.style.cssText = 'padding:16px;overflow:auto'; host.innerHTML = '<div class="lot-panel open" style="--c:#ef4444"></div>'; host.firstChild.appendChild(el); document.body.appendChild(host);
    await new Promise(r => setTimeout(r, 900)); return [!!el.querySelector('details.lpa'), !!el.querySelector('[data-a=plan]'), !!el.querySelector('[data-a=done]'), !!el.querySelector('.lpa-dates'), (el.querySelector('.lpa-sum') || {}).textContent]; });
  await shot(A.pg, '225_plans_lot_avancement'); log('Plans › lot : bloc avancement', lp47); if (!lp47.slice(0, 4).every(Boolean)) v47.push('bloc avancement dans Plans');
  // Photos classées : « À classer » + groupes ; menu Réglages compact avec recherche
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); const p = App.project, c = document.createElement('canvas'); c.width = 60; c.height = 120; c.getContext('2d').fillRect(0, 0, 30, 30);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg')); await DB.put('files', { projectId: p.id, blob: b, mime: 'image/jpeg', name: 'Screenshot_2026.jpg', role: 'photo' }); App.section = 'photos'; await renderSection(); });
  await A.pg.waitForSelector('.ph-todo', { timeout: 8000 }); await shot(A.pg, '226_photos_classees');
  const ph47 = await A.pg.evaluate(() => [document.querySelector('.ph-todo summary small').textContent, !!document.querySelector('[data-a=classall]'), !!document.querySelector('[data-a=shots]'), typeof DR_GROUPS !== 'undefined' && DR_GROUPS[0][2].includes('photos')]);
  log('photos classées [à classer, classer, captures, photos dans Chantier ?]', ph47); if (!+ph47[0] || !ph47[1] || !ph47[2] || ph47[3]) v47.push('photos classées');
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); window.__gm = groupMenu('Réglages', [{ title: 'Compte', color: '#2563eb', items: Array.from({ length: 4 }, (_, i) => ({ label: 'Item ' + i, icon: 'edit', value: 'a' + i })) }, { title: 'Données', color: '#0ea5e9', items: [{ label: 'Drive', icon: 'cloud', value: 'd' }, { label: 'Stockage', icon: 'cloud', value: 's' }, { label: 'Corbeille', icon: 'trash', value: 't' }] }]); });
  await A.pg.waitForSelector('.gm-sr input'); await A.pg.fill('.gm-sr input', 'corb'); await A.pg.waitForTimeout(150);
  const gm47 = await A.pg.evaluate(() => [...document.querySelectorAll('.gm-i')].filter(b => b.style.display !== 'none').map(b => b.textContent.trim()));
  await shot(A.pg, '227_menu_recherche'); log('menu compact : recherche', gm47); if (gm47.length !== 1 || !/Corbeille/.test(gm47[0])) v47.push('menu recherche');
  const ot47 = await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); return null; });
  void ot47;
  await A.pg.evaluate(() => document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()));
  log('errors v1.0.47', v47);
  // ---- v1.0.48 : fluidité — tableau de bord sur un gros chantier (400 pins × 5 lots × 40 jours de saisies) + miniatures gardées
  const v48 = [];
  const pf48 = await A.pg.evaluate(async () => {
    const p = { id: 'perf', name: 'Perf', lots: ['A', 'B', 'C', 'D', 'E'].map(k => ({ id: k, name: 'Lot ' + k, color: '#2563eb' })), avNiveaux: Array.from({ length: 8 }, (_, i) => ({ id: 'pn' + i, name: i ? 'R+' + i : 'RDC', serieId: 'x' })), avZones: ['Zone 1', 'Zone 2'] };
    const nivs = p.avNiveaux, t = todayISO(), loc = [];
    for (let i = 0; i < 400; i++) { const l = { id: 'pl' + i, nivId: nivs[i % 8].id, name: 'L' + i, kind: 'local', lots: {}, journal: [] };
      for (let d = 40; d >= 0; d -= 3) for (const lot of p.lots) l.journal.push({ id: i + lot.id + d, d: avAddDays(t, -d), t: d, lot: lot.id, pct: Math.min(100, (40 - d) * 2.5), prev: 0, eq: '' }); loc.push(l); }
    const host = document.createElement('div'); document.body.appendChild(host);
    const t0 = performance.now(); App.avF = { _p: 'perf', pk: 'total', sect: '', zone: '', niv: '', lot: '', eq: '', lt: '', by: 'zone' }; await avProDash(host, p, nivs, loc); const ms = Math.round(performance.now() - t0);
    host.remove(); App.avF = null;
    return { ms, pct: avPctAt(loc[0], 'A', avAddDays(t, -20)) };
  });
  log('v1.0.48 : tableau de bord 400 pins × 5 lots × 40 j [ms, % à J-20]', pf48); if (pf48.ms > 4000 || pf48.pct !== 45) v48.push('tableau de bord lent / % faux');
  const nt48 = await A.pg.evaluate(async () => { const got = []; window.Capacitor = window.Capacitor || {}; const old = window.Capacitor.Plugins; window.Capacitor.Plugins = { ...(old || {}), LocalNotifications: { cancel: async () => {}, createChannel: async () => {}, schedule: async (o) => { got.push(o); } } };
    const p = App.project; try { localStorage.removeItem('avRemN.' + p.id); } catch (e) {} p.avPlan = p.avPlan || {}; const n = p.avNiveaux[0], lot = p.lots[0]; const k = n.id + '|' + lot.id, keep = p.avPlan[k]; p.avPlan[k] = { deb: avAddDays(todayISO(), -2), fin: avAddDays(todayISO(), 10) };
    await avReminderNotif(p); p.avPlan[k] = keep; window.Capacitor.Plugins = old; const sc = got[0] && got[0].notifications[0].schedule; return sc ? { on: !!sc.on, at: !!sc.at, future: sc.at > new Date(), hour: new Date(sc.at).getHours() } : null; });
  log('rappel 17 h : une seule notification datée (jamais « on » répétitif)', nt48); if (!nt48 || nt48.on || !nt48.at || !nt48.future || nt48.hour !== 17) v48.push('rappel 17 h');
  const q49 = await A.pg.evaluate(async () => { const p = App.project, L = (await DB.byProject('links', p.id)).find(l => l.kind === 'local'), lot = p.lots[0];
    L.lots = L.lots || {}; const r = L.lots[lot.id] = L.lots[lot.id] || { state: 'todo', photos: [] }; r.qtot = 120; r.unit = 'm²'; L.journal = (L.journal || []).filter(e => e.lot !== lot.id);
    const e1 = avEntryOn(p, L, { d: avAddDays(todayISO(), -1), lot: lot.id, pct: 0, qc: 45 }); const e2 = avEntryOn(p, L, { d: todayISO(), lot: lot.id, pct: 0, qc: 90 });
    return [e1.pct, e2.pct, e2.qd, avQtyTxt(L, lot.id), typeof openStackView === 'function' && typeof avCompareSame === 'function']; });
  log('quantités [% J-1, % J, qté du jour, texte] + comparaison même niveau', q49); if (q49[0] !== 38 || q49[1] !== 75 || q49[2] !== 45 || !/90 \/ 120 m² = 75 %/.test(q49[3]) || !q49[4]) v48.push('quantités');
  const ct50 = await A.pg.evaluate(() => { const rows = [['APD00', '04/10/24'], ['DCE01', '20/03/25'], ['PE00', '31/10/25'], ['PE02.2', '17/04/26'], ['PE02.3', '07/05/26'], ['PE02.4', '31/07/26'], ['PE02.5', '28/08/26']];
    const T = []; rows.forEach(([i, d], k) => { const y = 100 + k * 12; T.push({ s: i, x: 10, y, w: 30, h: 10 }, { s: d, x: 60, y, w: 40, h: 10 }, { s: 'RENDU ' + i, x: 120, y, w: 60, h: 10 }); });
    const c = cartoucheFromTexts(T); return [c && c.indice, c && c.date, nextIndice('PE02.5'), nextIndice('DCE01'), nextIndice('B')]; });
  log('cartouche : dernier indice et date [indice, date, suivants]', ct50); if (ct50.join() !== 'PE02.5,2026-08-28,PE02.6,DCE02,C') v48.push('cartouche');
  log('errors v1.0.48', v48);
  // ---- v1.0.52 : membre retiré par l'organisation → sorti tout de suite (application ouverte) et projets de l'organisation effacés du téléphone
  const v52 = [];
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg,.st-gate').forEach(x => x.remove()); App.project = null; renderHome(); Team.openCompany('org'); }); await A.pg.waitForTimeout(1200);
  await A.pg.click('.tm-page [data-a=invite]'); await A.pg.waitForTimeout(400);
  await A.pg.fill('[data-f=name]', 'Ami test'); await A.pg.selectOption('[data-f=role]', 'mo');
  await A.pg.click('.tm-form [data-a=ok]'); await A.pg.waitForSelector('.opt:has-text("Créer le code")', { timeout: 15000 }); await A.pg.click('.opt:has-text("Créer le code")');
  await A.pg.waitForSelector('.opt:has-text("Fermer")', { timeout: 15000 }); await A.pg.waitForTimeout(400);
  const code52 = (await A.pg.textContent('.sheet:has(.opt:has-text("Fermer")) h3')).split(':').pop().trim(); await A.pg.click('.opt:has-text("Fermer")');
  const R52 = await newUser('R52'); await signup(R52.pg, 'Ami Retire', 'ami@test.ma');
  const c52 = []; R52.pg.on('console', m => { if (/accès|sortie|watch/i.test(m.text())) c52.push(m.text().slice(0, 200)); });
  await R52.pg.click('[data-a=join]'); await R52.pg.fill('[name=code]', code52); await R52.pg.click('.sheet [data-a=ok]');
  await R52.pg.waitForSelector('[data-a=join-ok]', { timeout: 15000 }); await R52.pg.click('[data-a=join-ok]'); await R52.pg.waitForSelector('.home2', { timeout: 20000 });
  await R52.pg.evaluate(() => Sync.run({ force: true })); await R52.pg.waitForTimeout(4000);
  const h1 = await R52.pg.evaluate(async () => ({ uid: firebase.auth().currentUser.uid, cid: Team.company().id, db: DB.name(), n: (await DB.all('projects')).length }));
  log('H dans l\'organisation [base, projets]', [h1.db, h1.n]); if (!h1.n) v52.push('H sans projet');
  log('R52 surveillance', await R52.pg.evaluate(() => [window.__stWatch, Team.company().id]));
  await R52.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  log('A retire le membre', await A.pg.evaluate(async (u) => { const r = firebase.firestore().collection('companies').doc(Team.company().id).collection('members').doc(u); await r.delete(); return [(await r.get({ source: 'server' })).exists, Team.company().id]; }, h1.uid));
  let msg52 = '';
  try { await R52.pg.waitForSelector('.sheet h3:has-text("plus partie")', { timeout: 20000 }); msg52 = await R52.pg.textContent('.sheet h3:has-text("plus partie")'); await R52.pg.click('.opt:has-text("OK")'); } catch (e) { v52.push('pas de sortie en direct'); }
  log('R52 console', c52);
  log('H message de retrait', msg52); if (!/plus partie/.test(msg52)) v52.push('message de retrait');
  await R52.pg.waitForSelector('.tm-choice', { timeout: 30000 }).catch(() => v52.push('pas de retour à l\'accueil'));
  const h2 = await R52.pg.evaluate(async (old) => ({ db: DB.name(), bases: indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : null, cid: (await firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).get()).data().companyId || null, old }), h1.db);
  log('H après retrait [base ouverte, bases du téléphone, espace]', h2); if (h2.db === h1.db || (h2.bases && h2.bases.includes(h1.db)) || h2.cid === h1.cid) v52.push('données de l\'organisation encore là');
  await shot(R52.pg, '52_retire');
  log('errors v1.0.52', [...v52, ...R52.errs]);
  await R52.ctx.close();
  // ---- v1.0.53 : pins photos par dossiers (PDF 4 photos / page, barre des lots) + accès limité dans le temps + Centre de contrôle
  const v53 = [];
  const pn53 = await A.pg.evaluate(async () => {
    document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove());
    const p = App.project || (await DB.all('projects'))[0]; App.project = p;
    const mk = async (c) => { const cv = document.createElement('canvas'); cv.width = 800; cv.height = 600; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 800, 600); g.fillStyle = '#fff'; g.font = '80px Arial'; g.fillText('SiteTeam', 200, 320);
      const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.8)); return (await DB.put('files', { projectId: p.id, blob: b, mime: 'image/jpeg', name: 'ph.jpg', createdAt: Date.now() })).id; };
    const ids = []; for (let i = 0; i < 8; i++) ids.push(await mk(['#2563eb', '#16a34a', '#ef4444', '#f59e0b'][i % 4]));
    const plan = (await DB.byProject('plans', p.id))[0];
    const l = await DB.put('links', { projectId: p.id, planId: plan ? plan.id : null, kind: 'photonote', shape: 'point', x: 10, y: 10, name: 'Local technique Lt 13', photos: [], notes: [], items: [],
      folders: [{ id: 'f1', name: 'Porte provisoire', photos: ids.slice(0, 6) }, { id: 'f2', name: 'Nettoyage', photos: ids.slice(6) }] });
    const C = await pnContext(l), b = await pnPdf(C, l.name, l.folders.map(d => ({ name: d.name, photos: d.photos })), 4);
    const txt = await b.text(), pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length;
    window.__pn = l.id; openPhotoNote(l, {}); await new Promise(r => setTimeout(r, 1200));
    const sh = document.querySelector('.pn'); const folders = sh ? [...sh.querySelectorAll('.pnf .pnf-n b')].map(x => x.textContent) : [];
    document.querySelectorAll('.sheet-bg').forEach(x => x.remove());
    let lot = null; if (plan && plan.folderId) { const f = await DB.get('folders', plan.folderId), el = pnLotBlock(p, { id: plan.lotId || 'go', name: 'Gros œuvre' }, f, () => {}); document.body.appendChild(el); await new Promise(r => setTimeout(r, 800)); lot = el.textContent.includes('Local technique Lt 13'); el.remove(); }
    return { pages, size: b.size, folders, count: pnCount(l), lot };
  });
  log('pins photos : PDF [pages pour 6+2 photos à 4/page — v1.0.61 : rubriques qui se suivent → 2], dossiers, total, barre du lot', pn53);
  if (pn53.pages !== 2 || pn53.folders.join() !== 'Porte provisoire,Nettoyage' || pn53.count !== 8 || pn53.lot === false) v53.push('pins photos');
  // accès d'un membre limité dans le temps : B (conducteur) expire → écran « Accès terminé » en direct + règles qui refusent ; puis prolongé
  const bUid53 = await B.pg.evaluate(() => firebase.auth().currentUser.uid);
  await A.pg.evaluate(async (u) => firebase.firestore().collection('companies').doc(Team.company().id).collection('members').doc(u).update({ until: firebase.firestore.Timestamp.fromMillis(Date.now() - 60000) }), bUid53);
  let g53 = ''; try { await B.pg.waitForSelector('.st-gate h1', { timeout: 20000 }); g53 = await B.pg.textContent('.st-gate h1'); } catch (e) {}
  const den53 = await B.pg.evaluate(async () => { try { await firebase.firestore().collection('companies').doc(Team.company().id).collection('projects').get({ source: 'server' }); return 'lu'; } catch (e) { return e.code; } });
  log('accès expiré : écran, lecture de l\'organisation', [g53, den53]); if (!/Accès terminé/.test(g53) || den53 !== 'permission-denied') v53.push('accès expiré');
  await A.pg.evaluate(async (u) => firebase.firestore().collection('companies').doc(Team.company().id).collection('members').doc(u).update({ until: firebase.firestore.Timestamp.fromMillis(Date.now() + 30 * 864e5) }), bUid53);
  await B.pg.waitForTimeout(2500); await B.pg.reload(); await B.pg.waitForSelector('.home2', { timeout: 30000 }).catch(() => v53.push('B pas revenu'));
  log('accès prolongé : B revient', await B.pg.evaluate(() => [!!document.querySelector('.st-gate'), !!document.querySelector('.home2')]));
  // Centre de contrôle (Super Admin) : durée d'un espace personnel + journal
  await SA.pg.goto('http://127.0.0.1:8765/admin.html?emu=1#acces'); await SA.pg.waitForSelector('#ccl', { timeout: 30000 }); await SA.pg.waitForTimeout(800); await shot(SA.pg, '53_centre_controle');
  const cc1 = await SA.pg.evaluate(() => document.querySelectorAll('#ccl .cc-r').length);
  if (cc1) { await SA.pg.click('#ccl .cc-r [data-k^="o:"][data-dur="30"]'); await SA.pg.waitForTimeout(2000); }
  const cc2 = await SA.pg.evaluate(() => [...document.querySelectorAll('#ccl .cc-r')].filter(r => r.querySelector('[data-k^="o:"]')).map(r => (r.querySelector('.pill') || {}).textContent).slice(0, 3));
  await SA.pg.goto('http://127.0.0.1:8765/admin.html?emu=1#acces/mem'); await SA.pg.waitForTimeout(2500); await shot(SA.pg, '53_centre_membres');
  const cc3 = await SA.pg.evaluate(() => [document.querySelectorAll('#ccl .cc-r').length, (document.querySelector('#ccl') || {}).textContent.includes('🔑')]);
  await SA.pg.goto('http://127.0.0.1:8765/admin.html?emu=1#acces/hist'); await SA.pg.waitForTimeout(2500);
  const cc4 = await SA.pg.evaluate(() => (document.querySelector('#ccl') || {}).textContent || '');
  log('Centre de contrôle [espaces perso, après +1 mois, membres, journal]', [cc1, cc2, cc3, /Accès espace personnel/.test(cc4)]);
  if (!cc1 || !cc2.some(x => /Reste 3\d j/.test(x)) || !cc3[0] || !cc3[1] || !/Accès espace personnel/.test(cc4)) v53.push('centre de contrôle');
  const t53 = await A.pg.evaluate(async () => {
    if (!window.jspdf && window.__late) await window.__late;
    const d = new window.jspdf.jsPDF({ unit: 'mm', format: [841, 594], orientation: 'l' }); d.setLineWidth(1); d.line(10, 10, 800, 500); d.text('Plan A1', 20, 20); d.addPage([841, 594], 'l'); d.text('page 2', 20, 20);
    let o = null, sz = { width: 842, height: 595 }, nolib = false;
    try { await needPdfLib(); } catch (e) { nolib = true; }   // pdf-lib n'est copié dans www/lib qu'au build : ici on vérifie seulement que l'outil existe
    if (!nolib) { const b = await pdfToFormat(d.output('arraybuffer'), { fmt: 'A4', orient: 'auto', margin: 5 }); o = await PDFLib.PDFDocument.load(await b.arrayBuffer()); sz = o.getPage(0).getSize(); }
    let rep = 'ok'; try { await Team.reportIssue('Test signalement CI', 'diagnostic'); } catch (e) { rep = e.code || e.message; }
    const q = await storageInfo(false);
    return { pages: o ? o.getPageCount() : 2, nolib, w: Math.round(sz.width), h: Math.round(sz.height), rep, quota: !!(q && q.quota), tools: typeof batchPlotFlow === 'function' && typeof convertPdfFlow === 'function' };
  });
  log('outils : A1 → A4 vectoriel [pages, largeur, hauteur], signalement, stockage', t53);
  if (t53.pages !== 2 || t53.w !== 842 || t53.h !== 595 || t53.rep !== 'ok' || !t53.tools) v53.push('outils PDF / signalement');
  log('v1.0.54 : refaire l\'image du plan + pins photos dans l\'avancement', await A.pg.evaluate(() => [typeof planRebuild === 'function', typeof pnCount === 'function']));
  if (!(await A.pg.evaluate(() => typeof planRebuild === 'function'))) v53.push('planRebuild');
  log('errors v1.0.53', v53);
  // ---- v1.0.55 : Centre de contrôle › inscrit sans espace → le Super Admin crée son espace personnel avec une durée ; fiche du lot en boutons
  const v55 = [];
  await SA.pg.goto('http://127.0.0.1:8765/admin.html?emu=1#acces/perso'); await SA.pg.waitForSelector('#ccl', { timeout: 30000 }); await SA.pg.waitForTimeout(1200);
  await SA.pg.fill('#q-cc', 'ami@test.ma'); await SA.pg.waitForTimeout(400); await shot(SA.pg, '55_sans_espace');
  const ns55 = await SA.pg.evaluate(() => (document.querySelector('#ccl') || {}).textContent || '');
  try { await SA.pg.click('#ccl [data-k^="n:"][data-dur="30"]'); await SA.pg.waitForSelector('dialog button:has-text("Créer")'); await SA.pg.click('dialog button:has-text("Créer")'); await SA.pg.waitForTimeout(2500); } catch (e) { v55.push('bouton créer son espace'); }
  const cr55 = await SA.pg.evaluate(async () => { const db = firebase.firestore(), u = (await db.collection('users').where('email', '==', 'ami@test.ma').get()).docs[0]; if (!u) return null; const cid = u.data().companyId; if (!cid) return { cid: null };
    const c = (await db.collection('companies').doc(cid).get()).data(), m = await db.collection('companies').doc(cid).collection('members').doc(u.id).get(); return { kind: c.kind, allowed: c.allowed, until: !!c.accessUntil, member: m.exists && m.data().admin }; });
  log('créer son espace [sans espace listé, espace créé]', [/Sans espace/.test(ns55), cr55]);
  if (!/Sans espace/.test(ns55) || !cr55 || cr55.kind !== 'perso' || !cr55.allowed || !cr55.until || !cr55.member) v55.push('créer son espace');
  log('errors v1.0.55', v55);
  // ---- v1.0.57 : Packs & fonctions — fonction premium fermée par pack, offerte à un espace ; écran du panneau
  const v57 = [];
  const eCid = await E.pg.evaluate(() => Team.company().id), ePlan = await E.pg.evaluate(() => Team.plan().k);
  log('E : espace et pack', [eCid ? 'ok' : null, ePlan, await E.pg.evaluate(() => Team.featInfo('cmp').ok)]);
  await SA.pg.goto('http://127.0.0.1:8765/admin.html?emu=1#packs'); await SA.pg.waitForSelector('[data-a=pksave]', { timeout: 30000 }); await SA.pg.waitForTimeout(600); await shot(SA.pg, '57_packs_fonctions');
  const pk57 = await SA.pg.evaluate(() => [document.querySelectorAll('[data-f]').length, document.querySelectorAll('[data-m]').length, document.querySelectorAll('[data-tr]').length]);
  await SA.pg.evaluate(async (k) => firebase.firestore().collection('config').doc('plans').set({ [k]: { feats: ['pdf'], featTrial: 0 } }, { merge: true }), ePlan);
  await E.pg.reload(); await E.pg.waitForSelector('.home2', { timeout: 30000 }); await E.pg.waitForTimeout(2500);
  const f1 = await E.pg.evaluate(() => [Team.featInfo('cmp').ok, Team.featInfo('pdf').ok]);
  await SA.pg.evaluate(async (c) => firebase.firestore().collection('companies').doc(c).update({ featGrant: { cmp: true } }), eCid);
  await E.pg.reload(); await E.pg.waitForSelector('.home2', { timeout: 30000 }); await E.pg.waitForTimeout(2500);
  const f2 = await E.pg.evaluate(() => Team.featInfo('cmp').ok);
  await SA.pg.evaluate(async (k) => firebase.firestore().collection('config').doc('plans').set({ [k]: { feats: '*', featTrial: 0 } }, { merge: true }), ePlan);
  log('packs & fonctions [cases fonctions, outils, essai] · fermé par le pack [cmp, pdf] · offert', [pk57, f1, f2]);
  if (!pk57[0] || !pk57[1] || !pk57[2] || f1[0] !== false || f1[1] !== true || f2 !== true) v57.push('fonctions premium');
  const ac57 = await A.pg.evaluate(() => typeof batchPlotFlow === 'function' && /Comme AutoCAD/.test(plotDialog.toString()));
  log('tracé : bouton « Comme AutoCAD »', ac57); if (!ac57) v57.push('préréglage AutoCAD');
  log('errors v1.0.57', v57);
  // ---- v1.0.61 : Photos — catégories (dossiers des pins photos, anomalies de réception), recherche, filtres, PDF par catégorie
  const v61 = [];
  const ph61 = await A.pg.evaluate(async () => {
    document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove());
    const p = App.project || (await DB.all('projects'))[0]; App.project = p;
    const mk = async (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').fillRect(0, 0, w / 2, h / 2); const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.8)); return (await DB.put('files', { projectId: p.id, blob: b, mime: 'image/jpeg', name: 'p.jpg', role: 'photo', createdAt: Date.now() })).id; };
    const a1 = await mk(800, 600), a2 = await mk(600, 800), a3 = await mk(800, 600);
    await DB.put('receptions', { projectId: p.id, type: 'Réception', date: todayISO(), rows: [{ id: 'r61', zone: '4', niv: 'R+1', element: 'Voile V12', photoIds: [a3], anomIds: [a2] }] });
    const pin = (await DB.byProject('links', p.id)).find(x => x.kind === 'photonote'); pin.folders.push({ id: 'f61', name: 'Porte provisoire', photos: [a1] }); await DB.put('links', pin);
    App.phF = null; App.section = 'photos'; await renderSection(); await new Promise(r => setTimeout(r, 900));
    const cats = [...document.querySelectorAll('.ph-cat')].map(x => x.firstChild.textContent.trim());
    const subs = [...document.querySelectorAll('.ph-list .ph-g summary b, .ph-list .ph-sub b')].map(x => x.textContent);   // v1.0.72 : dossiers du pin = sous-dossiers
    const anomZ = [...document.querySelectorAll('.ph-g[data-gk="cat|Anomalies|Réception|R+1|Zone 4|Anomalie"] summary b')].map(x => x.textContent);
    const q = document.querySelector('[data-a=q]'); q.value = 'anomalie'; q.oninput(); await new Promise(r => setTimeout(r, 600));
    const afterQ = document.querySelectorAll('.ph-list .ph-g').length, scope = document.querySelector('.ph-scope').textContent;
    App.phF.q = ''; const b = await pnPdf({ p }, 'Test', [{ name: 'Porte provisoire', sub: 'MEZZ', photos: [a1, a2, a3] }, { name: 'Anomalies', sub: 'R+1 · Zone 4', photos: [a2] }], 4);
    const txt = await b.text(), pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length;
    return { cats, subs, anomZ, afterQ, scope, pages, pdf: typeof phPdf === 'function', search: !!q };
  });
  await shot(A.pg, '61_photos_categories'); log('Photos v1.0.61/63 [catégories, Réception › R+1·Zone 4·Anomalie, recherche « anomalie », pages PDF 3+1 photos = 2]', ph61);
  if (!ph61.subs.some(x => x.startsWith('Porte provisoire')) || !ph61.cats.includes('Réception') || ph61.anomZ[0] !== 'Réception · R+1 · Zone 4 · Anomalie' || ph61.afterQ !== 1 || ph61.pages !== 2 || !ph61.pdf) v61.push('photos catégories / recherche / PDF');
  await A.pg.evaluate(() => { App.phF = null; document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); });
  log('errors v1.0.61', v61);
  // ---- v1.0.63 : tableau d'avancement en photos (+ colonne), bons à remplir, outils déplaçables
  const v63 = [];
  const t63 = await A.pg.evaluate(async () => {
    document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); const p = App.project;
    let tab = null; try { const el = await openAvTable(p, { view: 'ph' }); await new Promise(r => setTimeout(r, 500)); tab = el ? { ph: el.querySelectorAll('td.avt-ph').length, add: !!el.querySelector('th.avt-add'), title: (el.querySelector('.tb-title b') || {}).textContent, empty: !!el.querySelector('.empty') } : null; } catch (e) { tab = 'ERR ' + e.message; }
    document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove());
    let nolib = false; try { await needPdfLib(); } catch (e) { nolib = true; }
    let pdf = 'nolib';
    if (!nolib) { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 800); g.fillStyle = '#000'; g.fillRect(50, 50, 500, 4);
      const f = new File([await new Promise(r => c.toBlob(r, 'image/jpeg'))], 'bon.jpg', { type: 'image/jpeg' }), b = await bnImageToPdf(f);
      const tpl = { id: 't', name: 'Bon', fields: [{ id: 'a', k: 'libre', x: 40, y: 40, w: 200, h: 20 }, { id: 'b', k: 'coche', x: 300, y: 40, w: 20, h: 20 }] };
      const out = await bnMakePdf(b, tpl, { vals: { a: 'Voile V12 R+1', b: true }, items: [{ pg: 0, x: 60, y: 200, s: 14, c: '#1d3fbf', t: 'Zone 4\nبيتون' }], strokes: [{ pg: 0, c: '#111827', w: 3.4, pts: [[50, 300], [200, 340], [300, 300]] }] });
      const d = await PDFLib.PDFDocument.load(await out.arrayBuffer()); pdf = { pages: d.getPageCount(), grew: out.size > b.size }; }
    localStorage.setItem('dr.ord', JSON.stringify({ g: ['trav', 'qual', 'etu', 'fin', 'org'], k: { trav: ['reception'] } }));
    App.section = 'ptools'; await renderSection(); await new Promise(r => setTimeout(r, 600));
    const moved = !!document.querySelector('.st-tcat[data-g="trav"] [data-tool="reception"]'), notQual = !document.querySelector('.st-tcat[data-g="qual"] [data-tool="reception"]'), bons = !!document.querySelector('[data-xtool="bons"]');
    localStorage.removeItem('dr.ord');
    return { tab, pdf, moved, notQual, bons, fns: [typeof openBons, typeof bnFill].join() };
  });
  await shot(A.pg, '63_outils_projet'); log('v1.0.63 [tableau photos, PDF bon rempli, Réception déplacée dans Chantier, tuile Bons]', t63);
  if (!t63.tab || typeof t63.tab === 'string' || !(t63.tab.ph > 0 || t63.tab.empty) || !t63.tab.add || (t63.pdf !== 'nolib' && (!t63.pdf.grew || t63.pdf.pages !== 1)) || !t63.moved || !t63.notQual || !t63.bons || t63.fns !== 'function,function') v63.push('v1.0.63');
  log('errors v1.0.63', v63);
  // ---- v1.0.65 : % pondéré par quantités, échéances multiples, tableaux anomalies / échéances, noir et blanc, dossier d'une case
  const v65 = [];
  const t65 = await A.pg.evaluate(async () => {
    document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); const p = App.project;
    const l1 = { lots: { X: { state: 'done', qtot: 100 } }, journal: [] }, l2 = { lots: { X: { state: 'todo', qtot: 300 } }, journal: [] }, l3 = { lots: { X: { state: 'todo' } }, journal: [] };
    const w = avAvg([l1, l2], [{ id: 'X' }]), u = avAvg([l1, l3], [{ id: 'X' }]);
    const D = { _due: '2020-01-01', _dueObj: 'Coulage', _al: [{ id: 'a', d: '2019-06-01', obj: 'Plan à recevoir', type: 'Rappel' }, { id: 'b', d: '2018-01-01', obj: 'Fait', type: 'Rappel', done: true }] };
    const di = dueInfo(D), al = lotAlerts(D).length;
    await openAnomalies(p); await new Promise(r => setTimeout(r, 700)); const an = { page: !!document.querySelector('.an-page'), rows: document.querySelectorAll('.an-r').length, k: document.querySelectorAll('.an-k button').length };
    document.querySelectorAll('.fullpage').forEach(x => x.remove());
    await openDueTable(p); await new Promise(r => setTimeout(r, 400)); const due = !!document.querySelector('.due-page'); document.querySelectorAll('.fullpage').forEach(x => x.remove());
    return { w, u, di: di && di.a.obj, n: di && di.n, al, an, due, bw: typeof PLAN_BW_FILTER === 'undefined' && typeof planBW === 'undefined' && !document.querySelector('[data-a=bw]'), fns: [typeof avQtyDialog, typeof avCellDossier, typeof avGlobalPin].join() };
  });
  log('v1.0.65 [% pondéré 25 / simple 50, échéance la plus urgente, tableau anomalies, tableau échéances, N&B, fonctions]', t65);
  if (t65.w !== 25 || t65.u !== 50 || t65.di !== 'Plan à recevoir' || t65.n !== 2 || t65.al !== 3 || !t65.an.page || t65.an.rows < 1 || t65.an.k !== 4 || !t65.due || !t65.bw || t65.fns !== 'function,function,function') v65.push('v1.0.65');
  log('errors v1.0.65', v65);
  const t66 = await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.phF = null; App.section = 'photos'; await renderSection(); await new Promise(r => setTimeout(r, 800));
    const cats = [...document.querySelectorAll('[data-pf=cat] option')].map(o => o.value), loc = document.querySelectorAll('[data-loc]').length; return { cats: cats.length, gros: cats.some(c => /gros/i.test(c)), loc, fn: typeof phLocate }; });
  log('v1.0.66 [catégories = lots, boutons « Sur le plan », phLocate]', t66); if (!t66.gros || t66.fn !== 'function') v65.push('v1.0.66');
  const t67 = await A.pg.evaluate(async () => { const p = App.project, c = dueNCfg(p); return { c: [c.on, c.time, c.before, c.late].join(), s: await dueSchedule(p), id: dueNId('x') > 1.6e9 && dueNId('x') < 2147483647, th: typeof lazyThumbs }; });
  log('v1.0.67 [notifications : réglages par défaut, sans plugin → 0, id valide, miniatures légères]', t67); log('errors v1.0.67', (t67.c !== 'true,08:00,1,true' || t67.s !== 0 || !t67.id || t67.th !== 'function') ? ['v1.0.67'] : []);
  log('errors v1.0.66', t66.gros && t66.fn === 'function' ? [] : ['v1.0.66']);
  const t71 = await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.phF = { niv: '1-MEZZ', cat: 'Local technique', z: '', dos: '', st: '', src: '', per: '', q: '', mode: 'cat' }; App.section = 'photos'; await renderSection(); await new Promise(r => setTimeout(r, 700));
    return { same: [phNK('0-SSL') === phNK('Sous-sol'), phNK('1-MEZZ') === phNK('Mezzanine'), phNK('R+1') === phNK('1-R+1'), phNK('R+1') !== phNK('R+2')].join(), fn: typeof phNivPlan, page: !!document.querySelector('.ph-search'), bw: typeof planBW, bwb: !!document.querySelector('[data-a=bw]'), viewers: document.querySelectorAll('.viewer, .fullpage').length, pins: [typeof recPinFlow, typeof recPinSync, typeof anLocate, pinLook({ kind: 'recpin', recStatus: 'reserve' }).c, pinLook({ kind: 'recpin', recStatus: 'reserve', recLifted: true }).c, pinLook({ kind: 'recpin', recKind: 'Non-conformité' }).c].join() }; });
  log('v1.0.71 [niveau reconnu quelle que soit l\'écriture, 📍 plan du niveau, ◐ retiré, filtre lot + niveau]', t71);
  const t72 = await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.phF = null; App.section = 'photos'; await renderSection(); await new Promise(r => setTimeout(r, 700)); const css = [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => /\.ph-sub/.test(r.selectorText || '')); } catch (e) { return false; } }); return { page: !!document.querySelector('.ph-search'), css }; });
  log('v1.0.72 [pin photos = un dossier + sous-dossiers, pin 3D]', t72); log('errors v1.0.72', t72.page && t72.css ? [] : ['v1.0.72']);
  const t74 = await A.pg.evaluate(() => ({ build: typeof Backup.buildAllBlob, save: typeof GDrive.backupSave, info: typeof GDrive.backupInfo, get: typeof GDrive.backupGet, restore: typeof restoreFromDrive, auto: typeof cloudAutoCheck, cloud: typeof cloudSaveAll }));
  log('v1.0.74 [sauvegarde complète Drive : fonctions présentes]', t74); log('errors v1.0.74', Object.values(t74).every(x => x === 'function') ? [] : ['v1.0.74']);
  const t75 = await A.pg.evaluate(() => ({ viewer: typeof openPlanViewer }));
  log('v1.0.75 [chargement plan %, connexion sans suggestions]', t75);
  const t76 = await A.pg.evaluate(() => ({ pin: typeof photoPinSVG === 'function' ? photoPinSVG(2).includes('#dc2626') : false }));
  log('v1.0.76 [pin photo rouge]', t76);
  const t77 = await A.pg.evaluate(() => ({ keep: typeof renderPlans === 'function' && typeof lotBarInto === 'function' }));
  log('v1.0.77 [barre des lots, position conservée]', t77);
  const t78 = await A.pg.evaluate(() => ({ red: typeof redPinSVG === 'undefined' ? 'x' : 'ok', lots: typeof lotBarInto === 'function' }));
  log('v1.0.78 [pin 📍 colonne, pin rouge plan, choix de lot, intensité]', t78); log('errors v1.0.78', t78.lots ? [] : ['v1.0.78']);
  const t80 = await A.pg.evaluate(() => ({ lots: typeof lotBarInto === 'function' }));
  log('v1.0.80 [lots en liste déroulante]', t80); log('errors v1.0.80', t80.lots ? [] : ['v1.0.80']);
  // ---- v1.0.x : début/échéance avec heure, activation automatique, alertes, dossier Data ----
  const tAl = await A.pg.evaluate(() => {
    const iso = (ms) => { const d = new Date(Date.now() + ms); const p = (n) => String(n).padStart(2, '0'); return { d: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, t: `${p(d.getHours())}:${p(d.getMinutes())}` }; };
    const H = 36e5, D = 24 * H, mk = (o) => ({ kind: 'local', ...o });
    const far = iso(20 * D), soon = iso(2 * D), past = iso(-3 * H), fut = iso(5 * H), pastS = iso(-1 * H);
    return {
      far: [ptActive(mk({ due: far.d })), pointAlert(mk({ due: far.d }))].join(),
      soon: [ptActive(mk({ due: soon.d })), pointAlert(mk({ due: soon.d }))].join(),
      late: [ptActive(mk({ due: past.d, dueTime: past.t })), pointAlert(mk({ due: past.d, dueTime: past.t }))].join(),
      startFut: ptActive(mk({ start: fut.d, startTime: fut.t, due: far.d })) + '',
      startPast: ptActive(mk({ start: pastS.d, startTime: pastS.t, due: far.d })) + '',
      none: ptActive(mk({})) + '',
      started: ptActive(mk({ due: far.d, started: '2026-01-01' })) + '',
      co: [pointAlert(mk({ due: far.d, dueCo: past.d, dueCoTime: past.t })), pointAlert(mk({ due: past.d, dueTime: past.t, dueCo: past.d, dueCoTime: past.t })), pointAlert(mk({ dueCo: far.d })) + '', pillColor('co')].join(),
      tk: [pointAlert(mk({ start: iso(-2 * D).d })), pointAlert(mk({ start: iso(-2 * D).d, started: '2026-01-01' })) + '', pointAlert(mk({ dueCo: iso(-2 * D).d, started: '2026-01-01' })), pointAlert(mk({ due: iso(-2 * D).d, started: '2026-01-01' })), pointAlert(mk({ dueCo: iso(-2 * D).d, started: '2026-01-01', finished: '2026-02-01' })) + '', typeof linkPinToTask, typeof taskPatchFromPin, typeof domeIconSVG].join(),
      days: ptAlertDays(), data: typeof openDataFolder, tbl: typeof openAlertsTable, items: typeof pointAlertItems,
    };
  });
  log('v1.0.x [alertes : heure, activation auto, réglages]', tAl);
  log('errors v1.0.x alertes', (tAl.far === 'false,' || tAl.far === 'false,null') && tAl.soon === 'true,green' && tAl.late === 'true,red' && tAl.startFut === 'false' && tAl.startPast === 'true' && tAl.none === 'true' && tAl.tk === 'co,null,co,red,null,function,function,function' && tAl.co === 'co,red,null,#eab308' && tAl.started === 'true' && tAl.days === 3 && tAl.data === 'function' && tAl.tbl === 'function' && tAl.items === 'function' ? [] : ['v1.0.x alertes']);
  // ---- v1.0.x : Accueil (maison blanche) et Paramètres en haut à droite de « Outils du projet » ----
  const tTb = await A.pg.evaluate(() => ({ css: !![...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => r.selectorText === '.tb-home'); } catch (e) { return false; } }) }));
  log('v1.0.x [barre Outils du projet : accueil + paramètres]', tTb); log('errors v1.0.x barre', tTb.css ? [] : ['v1.0.x barre']);
  // ---- v1.0.x : lien Google Maps du projet + partage WhatsApp ----
  const tMap = await A.pg.evaluate(() => ({ a: projectMapUrl({ mapsUrl: 'https://maps.app.goo.gl/abc' }), b: projectMapUrl({ gps: '33.5731, -7.5898' }), c: projectMapUrl({ address: 'Casablanca' }), d: projectMapUrl({}), f: typeof shareProjectWhatsApp }));
  log('v1.0.x [lien Google Maps / WhatsApp]', tMap); log('errors v1.0.x maps', tMap.a === 'https://maps.app.goo.gl/abc' && tMap.b === 'https://www.google.com/maps?q=33.5731,-7.5898' && tMap.c.includes('query=Casablanca') && tMap.d === '' && tMap.f === 'function' ? [] : ['v1.0.x maps']);
  // ---- v1.0.176 : PDF annoté — pins en vectoriel (aucune image dans la page) ----
  const tPdf = await A.pg.evaluate(async () => { try {
    await needPdfLib(); const d = await PDFLib.PDFDocument.create(); d.addPage([600, 400]); const bytes = await d.save();
    const f = await DB.put('files', { projectId: 'T', role: 'plan', name: 't.pdf', blob: new Blob([bytes], { type: 'application/pdf' }) });
    const plan = { id: 'pT', w: 600, h: 400, pdfFileId: f.id, pdfPage: 1, annotations: [{ type: 'line', pts: [[10, 10], [200, 100]], color: '#e11d48', sw: 3 }] };
    const out = await annotatedPlanPdf(plan, [{ planId: 'pT', x: 100, y: 100, num: 3, status: 'open' }], [{ planId: 'pT', x: 300, y: 200, name: 'Local 1', kind: 'local' }], 'A3', true, true);
    const txt = new TextDecoder('latin1').decode(new Uint8Array(await out.arrayBuffer()));
    return { size: out.size, img: /\/Subtype\s*\/Image/.test(txt) };
  } catch (e) { return { err: String(e && e.message || e) }; } });
  log('v1.0.176 [PDF annoté : pins vectoriels]', tPdf); log('errors v1.0.176 pdf', tPdf.size > 500 && tPdf.img === false ? [] : ['v1.0.176 pdf ' + JSON.stringify(tPdf)]);
  // ---- v1.0.236 : annotations — page PDF tournée en vectoriel, polyligne fermée reliée, hachures/opacité sur formes fermées ----
  const tAn = await A.pg.evaluate(async () => { try {
    await needPdfLib(); const r = {};
    for (const rot of [90, 180, 270]) {
      const d = await PDFLib.PDFDocument.create(), pg = d.addPage([600, 400]); pg.setRotation(PDFLib.degrees(rot));
      const f = await DB.put('files', { projectId: 'T', role: 'plan', name: 'r.pdf', blob: new Blob([await d.save()], { type: 'application/pdf' }) });
      const dw = rot === 180 ? 600 : 400, dh = rot === 180 ? 400 : 600;
      const plan = { id: 'pR' + rot, w: dw, h: dh, pdfFileId: f.id, pdfPage: 1, annotations: [{ type: 'rect', pts: [[10, 10], [200, 100]], hue: '#e11d48', color: '#e11d48', sw: 2, fill: 'hatch', angle: 45, gap: 8, hsw: 1 }] };
      const out = await annotatedPlanPdf(plan, [], [], 'A3', false, true), txt = new TextDecoder('latin1').decode(new Uint8Array(await out.arrayBuffer()));
      r['rot' + rot] = { img: /\/Subtype\s*\/Image/.test(txt), size: out.size };
    }
    const poly = { type: 'poly', pts: [[0, 0], [10, 0], [10, 10], [0, 0]] }; normAnnot(poly);
    r.close = [poly.type, poly.fill, poly.pts.length];
    const mk = (t, o) => annotSVG({ type: t, pts: [[0, 0], [40, 30]], hue: '#f00', color: '#f00', sw: 2, ...o });
    r.hatch = ['rect', 'ellipse', 'disc', 'box', 'polygon'].map(t => /<path d="M/.test(mk(t, { fill: 'hatch', gap: 4, hsw: 0.7, ...(t === 'polygon' ? { pts: [[0, 0], [40, 0], [40, 30]] } : {}) })) && /stroke-width="0.7"/.test(mk(t, { fill: 'hatch', gap: 4, hsw: 0.7, ...(t === 'polygon' ? { pts: [[0, 0], [40, 0], [40, 30]] } : {}) })));
    r.op0 = /fill-opacity="0"/.test(mk('disc', { fo: 0 })); r.rectNone = /fill="none"/.test(mk('rect', {})) && fillMode({ type: 'rect' }) === 'none';
    return r;
  } catch (e) { return { err: String(e && e.message || e) }; } });
  log('v1.0.236 [annotations : PDF tourné vectoriel, polyligne fermée, hachures]', tAn);
  log('errors v1.0.236 annot', tAn.rot90 && !tAn.rot90.img && !tAn.rot180.img && !tAn.rot270.img && tAn.close.join() === 'polygon,none,3' && tAn.hatch.every(Boolean) && tAn.op0 && tAn.rectNone ? [] : ['v1.0.236 annot ' + JSON.stringify(tAn)]);
  // ---- v1.0.237 : changer de plan en glissant sur l'en-tête (← → même niveau, ↑ ↓ même type) ----
  const tNav = await A.pg.evaluate(() => { try {
    const fo = [{ id: 'f1', name: 'R+1' }, { id: 'f0', name: 'RDC' }, { id: 'fs', name: 'SSL' }, { id: 'fr', name: 'Terrasse' }, { id: 'fm', name: 'Mezzanine' }, { id: 'fx', name: 'Sous', parentId: 'f0' }];
    const pl = [{ id: 'a', folderId: 'f0', disc: 'STR', name: 'B' }, { id: 'b', folderId: 'f0', disc: 'ARCH', name: 'A' }, { id: 'c', folderId: 'fx', disc: 'STR', name: 'C' },
      { id: 'd', folderId: 'f1', disc: 'STR', name: 'D' }, { id: 'e', folderId: 'fs', disc: 'ARCH', name: 'E' }, { id: 'g', folderId: 'f1', disc: 'STR', name: 'G', supersededBy: 'x' }];
    const n = planNavInfo(pl[0], fo, pl, {}), m = planNavInfo(pl[1], fo, pl, {});
    return { row: n.row.map(x => x.id).join(), idx: n.idx, up: n.up && n.up.id, down: n.down && n.down.id, archUp: m.up && m.up.id, archDown: m.down && m.down.id, lv: n.levels.map(f => f.name).join(), rk: [navLevelRank('SSL'), navLevelRank('RDC'), navLevelRank('R+2'), navLevelRank('Terrasse')].join() };
  } catch (e) { return { err: String(e.message || e) }; } });
  log('v1.0.237 [navigation plans par glissement]', tNav);
  log('errors v1.0.237 nav', tNav.row === 'b,a,c' && tNav.idx === 1 && tNav.up === 'd' && !tNav.down && !tNav.archUp && tNav.archDown === 'e' && tNav.lv === 'SSL,Mezzanine,RDC,R+1,Terrasse' ? [] : ['v1.0.237 nav ' + JSON.stringify(tNav)]);
  // ---- v1.0.240 : glissement réel (événements tactiles) sur la barre du haut d'un plan ouvert : change de plan ----
  const tSw = await A.pg.evaluate(async () => { try {
    const p = App.project, c = document.createElement('canvas'); c.width = 300; c.height = 200; c.getContext('2d').fillRect(0, 0, 300, 200);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8)), f = await DB.put('files', { projectId: p.id, blob, mime: 'image/jpeg', name: 'sw.jpg', role: 'plan' });
    const fR = await DB.put('folders', { projectId: p.id, name: 'RDC' }), fU = await DB.put('folders', { projectId: p.id, name: 'R+1' });
    const mk = (name, fo, disc) => DB.put('plans', { projectId: p.id, fileId: f.id, folderId: fo.id, disc, w: 300, h: 200, name, annotations: [], indice: 'A' });
    const a = await mk('SW A', fR, 'STR'), b2 = await mk('SW B', fR, 'STR'), u = await mk('SW U', fU, 'STR');
    await openPlanViewer(a, planCtx(() => {})); await new Promise(r => setTimeout(r, 900));
    const title = () => { const e = document.querySelector('.fullpage .pv-h1'); return e ? e.title : ''; };
    const swipe = async (dx, dy) => { const bar = document.querySelector('.fullpage .topbar'), r = bar.getBoundingClientRect(), x0 = r.left + r.width * 0.45, y0 = r.top + r.height / 2;
      const tc = (x, y) => new Touch({ identifier: 7, target: bar, clientX: x, clientY: y }), ev = (t, x, y) => new TouchEvent(t, { bubbles: true, cancelable: true, touches: t === 'touchend' ? [] : [tc(x, y)], changedTouches: [tc(x, y)] });
      bar.dispatchEvent(ev('touchstart', x0, y0)); for (let i = 1; i <= 4; i++) bar.dispatchEvent(ev('touchmove', x0 + dx * i / 4, y0 + dy * i / 4)); bar.dispatchEvent(ev('touchend', x0 + dx, y0 + dy)); await new Promise(r2 => setTimeout(r2, 1200)); };
    const t0 = title(); await swipe(-90, 0); const t1 = title(); await swipe(0, 90); const t2 = title();
    return { t0, t1, t2, n: document.querySelectorAll('.fullpage .pv-h1').length };
  } catch (e) { return { err: String(e && e.message || e) }; } });
  log('v1.0.240 [glissement tactile en-tête]', tSw);
  log('errors v1.0.240 swipe', tSw.t0 === 'SW A' && tSw.t1 === 'SW B' && tSw.t2 === 'SW U' && tSw.n === 1 ? [] : ['v1.0.240 swipe ' + JSON.stringify(tSw)]);
  // balayage direct sur le plan (entier, outil Main) : change aussi de plan
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage').forEach(x => x.remove()); const p = App.project; const a = (await DB.byProject('plans', p.id)).find(x => x.name === 'SW A'); await openPlanViewer(a, planCtx(() => {})); await new Promise(r => setTimeout(r, 900)); });
  const vb = await A.pg.evaluate(() => { const r = document.querySelector('.fullpage .viewer').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await A.pg.mouse.move(vb.x + 70, vb.y); await A.pg.mouse.down(); for (let i = 1; i <= 8; i++) await A.pg.mouse.move(vb.x + 70 - i * 18, vb.y + 2); await A.pg.mouse.up(); await A.pg.waitForTimeout(1200);
  const tSw2 = await A.pg.evaluate(() => { const e = document.querySelector('.fullpage .pv-h1'); return e ? e.title : ''; });
  log('v1.0.240 [balayage sur le plan]', tSw2); log('errors v1.0.240 swipe plan', tSw2 === 'SW B' ? [] : ['v1.0.240 swipe plan ' + tSw2]);
  const tDue = await A.pg.evaluate(() => ({ s: String(openDueTable).includes('Point · échéance') && !String(openDueTable).includes("p.mo ? ' · ' + esc(p.mo) : ''}</span></div>") }));
  log('v1.0.176 [échéances + points]', tDue); log('errors v1.0.176 échéances', tDue.s ? [] : ['v1.0.176 échéances']);
  // ---- v1.0.176 : sauvegarde Drive d'un projet = un seul zip mis à jour sur place (+ « précédente ») ----
  const tBk = await A.pg.evaluate(() => ({ save: typeof GDrive.projectBackupSave, list: typeof GDrive.projectBackupList, src: String(GDrive.projectBackupSave).includes('/copy') && String(GDrive.projectBackupSave).includes('PREV') && !String(GDrive.projectBackupSave).includes("stamp() + '.chantier.zip'") }));
  log('v1.0.176 [sauvegarde Drive : zip unique]', tBk); log('errors v1.0.176 backup', tBk.save === 'function' && tBk.list === 'function' && tBk.src ? [] : ['v1.0.176 backup']);
  // ---- v1.0.176 (outils) : lot exact d'un point, recherche d'abord ----
  const tPt = await A.pg.evaluate(() => { const p = { lots: [{ id: 'L1', name: 'Gros œuvre' }, { id: 'L2', name: 'Maçonnerie' }], planLots: [] }; return { f: typeof ptLotName, a: ptLotName(p, { lotId: 'L1' }, null), b: ptLotName(p, {}, { lotId: 'inconnu' }), s: String(openAlertsTable).includes('data-q') && String(openAlertsTable).includes('hid') }; });
  log('v1.0.176 [lot exact / recherche]', tPt); log('errors v1.0.176 outils', tPt.f === 'function' && tPt.a === 'Gros œuvre' && tPt.b === '' && tPt.s ? [] : ['v1.0.176 outils']);
  const tTb2 = await A.pg.evaluate(() => ({ f: typeof openDataFolder, s: String(openDataFolder).includes('tb-card') && String(openDataFolder).includes('Tableaux') }));
  log('v1.0.176 [application Tableaux]', tTb2); log('errors v1.0.176 tableaux', tTb2.f === 'function' && tTb2.s ? [] : ['v1.0.176 tableaux']);
  const tSy = await A.pg.evaluate(async () => { const r = await fetch('js/sync.js').then(x => x.text()); return { s: r.includes('cloudPause') && r.includes('cfail >= 2') && r.includes('!force && Date.now() < pauseTil') }; });
  log('v1.0.176 [envoi Cloud : pause après 2 échecs]', tSy); log('errors v1.0.176 sync', tSy.s ? [] : ['v1.0.176 sync']);
  const tUx = await A.pg.evaluate(async () => { const r = await fetch('js/app.js').then(x => x.text()); return { s: r.includes('const hid = false') && !r.includes('Tapez un nom ou choisissez') }; });
  log('v1.0.177 [Tous affiche tout]', tUx); log('errors v1.0.177 tous', tUx.s ? [] : ['v1.0.177 tous']);
  const tFe = await A.pg.evaluate(async () => { const a = await fetch('js/app.js').then(x => x.text()), l = await fetch('js/lots.js').then(x => x.text()), v = await fetch('js/viewer.js').then(x => x.text()); return { ret: a.includes('Retard échéance'), top: l.includes('due-top'), dome: v.includes('scale(${s * bk * 0.45})') }; });
  log('v1.0.177 [fiche, échéances, dôme]', tFe); log('errors v1.0.177 fiche', tFe.ret && tFe.top && tFe.dome ? [] : ['v1.0.177 fiche']);
  const tRp = await A.pg.evaluate(async () => { const r = await fetch('js/reception.js').then(x => x.text()), p = await fetch('js/tools.js').then(x => x.text()); return { sel: r.includes('1er appui = sélection'), prev: p.includes('openPagePreview') && p.includes('max-width') || p.includes('openPagePreview(i)') }; });
  log('v1.0.177 [Réception 2 appuis, aperçu PDF]', tRp); log('errors v1.0.177 reception-pdf', tRp.sel && tRp.prev ? [] : ['v1.0.177 reception-pdf']);
  const tTg = await A.pg.evaluate(async () => { const s = await fetch('js/siteteam.js').then(x => x.text()); return { g: s.includes('data-g="tableaux"') && s.includes('data-tabtool') && s.includes('openTableTool(p, b.dataset.tabtool)') && !s.includes("['anom', 'alert', 'Tableau des anomalies'], ['due'") }; });
  log('v1.0.177 [groupe Tableaux]', tTg); log('errors v1.0.177 groupe', tTg.g ? [] : ['v1.0.177 groupe']);
  const tBt = await A.pg.evaluate(async () => { const a = await fetch('js/app.js').then(x => x.text()), p = await fetch('js/photoq.js').then(x => x.text()); return { mem: a.includes('performance.memory') && a.includes('pile d\'appels'), pq: p.includes('}, 25000)') }; });
  log('v1.0.177 [démarrage : mémoire, pile, photos différées]', tBt); log('errors v1.0.177 demarrage', tBt.mem && tBt.pq ? [] : ['v1.0.177 demarrage']);
  const tFl = await A.pg.evaluate(async () => { const v = await fetch('js/viewer.js').then(x => x.text()); return { f: v.includes('mkScale !== st.scale') && v.includes("stage.style.willChange = 'transform';   // v1.0.177") && v.includes('> 6e6') }; });
  log('v1.0.177 [plan fluide]', tFl); log('errors v1.0.177 fluide', tFl.f ? [] : ['v1.0.177 fluide']);
  const t82 = await A.pg.evaluate(() => ({ db: typeof DB.get === 'function' }));
  log('v1.0.82 [démarrage : synchro différée, IndexedDB réessaie]', t82); log('errors v1.0.82', t82.db ? [] : ['v1.0.82']);
  const t79 = await A.pg.evaluate(() => ({ proj: typeof GDrive.projectSave, file: typeof Backup.exportProject }));
  log('v1.0.79 [sauvegarde projet Drive : même fichier]', t79); log('errors v1.0.79', t79.proj === 'function' && t79.file === 'function' ? [] : ['v1.0.79']);
  log('errors v1.0.71', (t71.same !== 'true,true,true,true' || t71.fn !== 'function' || t71.pins !== 'function,function,function,#dc2626,#16a34a,#dc2626' || !t71.page || t71.bw !== 'undefined' || t71.bwb) ? ['v1.0.71'] : []);
  // ---- v1.0.45 : bibliothèque unifiée Basic / Pro + organigramme global / par service
  const v45lib = [];
  const lib45 = await A.pg.evaluate(() => {
    document.querySelectorAll('.fullpage,.sheet-bg,.ws-dd').forEach(x => x.remove());
    const c = Team.company(), old = c.plan, out = {};
    c.plan = 'basic'; ST.openServiceLibrary();
    out.basic = { title: (document.querySelector('.st-libhero h2') || {}).textContent, pack: (document.querySelector('.st-lib-pack') || {}).textContent, tools: document.querySelectorAll('.st-libtool').length, upgrade: !!document.querySelector('.st-libupgrade') };
    document.querySelectorAll('.st-libpage').forEach(x => x.remove());
    c.plan = 'pro'; ST.openServiceLibrary();
    out.pro = { title: (document.querySelector('.st-libhero h2') || {}).textContent, pack: (document.querySelector('.st-lib-pack') || {}).textContent, groups: document.querySelectorAll('.st-libgroup').length, services: document.querySelectorAll('[data-svc]').length };
    c.plan = old; return out;
  });
  log('bibliothèque Basic / Pro', lib45); await shot(A.pg, '190_bibliotheque_metier');
  if (!/essentiels/i.test(lib45.basic.title || '') || !/Basic/.test(lib45.basic.pack || '') || !lib45.basic.tools || !lib45.basic.upgrade || !/Pro/.test(lib45.pro.pack || '') || !lib45.pro.groups) v45lib.push('bibliothèque Basic / Pro');
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); Team.openCompany('org'); });
  await A.pg.waitForSelector('.tm-orghead', { timeout: 12000 }); await A.pg.waitForTimeout(500);
  const org45 = await A.pg.evaluate(() => ({ stats: [...document.querySelectorAll('.tm-orgstats b')].map(x => x.textContent), modes: [...document.querySelectorAll('[data-om]')].map(x => x.textContent.trim()), nodes: document.querySelectorAll('.tm-orgtree .tm-node').length, services: document.querySelectorAll('.tm-orgcard em').length, reports: document.querySelectorAll('.tm-reports').length }));
  log('organigramme hiérarchique', org45); await shot(A.pg, '191_organigramme_hierarchie');
  if (org45.stats.length !== 3 || org45.modes.join('|') !== 'Hiérarchie|Par service' || !org45.nodes || !org45.services) v45lib.push('organigramme hiérarchique');
  await A.pg.click('[data-om=service]'); await A.pg.waitForTimeout(350);
  const svc45 = await A.pg.evaluate(() => ({ groups: document.querySelectorAll('.tm-svc').length, nodes: document.querySelectorAll('.tm-svc .tm-node').length, search: !!document.querySelector('[data-orgq]') }));
  log('organigramme par service', svc45); await shot(A.pg, '192_organigramme_services');
  if (!svc45.groups || !svc45.nodes || !svc45.search) v45lib.push('organigramme par service');
  await A.pg.evaluate(() => document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()));
  log('errors bibliothèque / organigramme', v45lib);
  // ---- v1.0.15 : tablette et ordinateur
  for (const [w, h, n] of [[820, 1180, '45_tablette'], [1280, 800, '46_desktop']]) {
    await A.pg.setViewportSize({ width: w, height: h }); await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); App.project = null; renderHome(); }); await A.pg.waitForTimeout(1200); await shot(A.pg, n);
  }
  await A.pg.setViewportSize({ width: 390, height: 800 });
  // ---- v1.0.187 : démarrage léger — table séparée de drapeaux (fflags)
  const ff = await A.pg.evaluate(async () => {
    const id = 'ff' + Date.now(), blob = new Blob(['x']);
    await DB.put('files', { id, projectId: 'p', role: 'photo', blob, prep: true });
    const a = (await DB.flagged('prep')).some(f => f.id === id), b = (await DB.flagged('pend')).some(f => f.id === id);
    const f = await DB.get('files', id); delete f.prep; f.driveId = 'd1'; await DB.put('files', f);
    const c = (await DB.flagged('prep')).some(x => x.id === id), d = (await DB.flagged('pend')).some(x => x.id === id);
    await DB.del('files', id); const e = (await DB.flagged('pend')).some(x => x.id === id);
    return { a, b, c, d, e };
  });
  log('flags fichiers', ff); if (!ff.a || !ff.b || ff.c || ff.d || ff.e) throw new Error('fflags incorrect ' + JSON.stringify(ff));
  // ---- v1.0.189 : bouton « Replier tout » / « Déplier tout » dans la liste des plans
  const pqt = await A.pg.evaluate(async () => {
    const pr0 = (await DB.all('projects'))[0]; if (!pr0) return { tools: false, noProject: true }; App.project = pr0;
    await openPlansQuick(); await new Promise(r => setTimeout(r, 400));
    const ok = { tools: !!document.querySelector('.pq-tools [data-a=pqfold]') && !!document.querySelector('.pq-tools [data-a=pqunfold]') };
    const groups = document.querySelectorAll('.pq-h').length;
    document.querySelector('[data-a=pqfold]').click(); await new Promise(r => setTimeout(r, 100));
    ok.allShut = groups > 0 && [...document.querySelectorAll('.pq-h')].every(h => h.classList.contains('shut'));
    document.querySelector('[data-a=pqunfold]').click(); await new Promise(r => setTimeout(r, 100));
    ok.allOpen = groups > 0 && [...document.querySelectorAll('.pq-h')].every(h => !h.classList.contains('shut'));
    return { ...ok, groups };
  });
  log('plans replier/déplier tout', pqt);
  if (!pqt.tools || (pqt.groups && (!pqt.allShut || !pqt.allOpen))) throw new Error('replier tout KO ' + JSON.stringify(pqt));
  await A.pg.evaluate(() => document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()));
  // ---- Alertes & automatisations : aperçu client sans envoi externe ----
  const waDemo = await A.pg.evaluate(() => {
    const loaded = typeof AutoAlerts !== 'undefined';
    if (!loaded) return { loaded: false };
    const mock = { rappels: [
      { id: 'a', text: 'En cours', at: '2026-11-15T10:00', done: false },
      { id: 'b', text: 'Terminé', at: '2026-11-15T10:00', done: true },
      { id: 'c', text: 'Ancien', at: '2026-11-10T10:00', done: false }
    ] };
    const rappels = AutoAlerts.rappelsDuProjet(mock, new Date('2026-11-11T10:00:00'));
    const rappelOk = rappels.length === 2 && rappels[0].texte === 'Ancien' && rappels[0].statut === 'retard';
    const c = AutoAlerts.canaux(), demo = AutoAlerts.simuler('critique'), sh = AutoAlerts.open();
    const visibles = sh.el.querySelectorAll('[data-auto-sim]').length;
    const wa = sh.el.textContent.includes('WhatsApp') && sh.el.textContent.includes('Non configuré');
    const b = sh.el.querySelector('[data-auto-sim=critique]'); b.click();
    const result = sh.el.querySelector('[data-auto-result]').textContent;
    sh.close();
    return { loaded, visibles, wa, rappelOk, noSend: demo.reel === false && demo.whatsapp === 'désactivé', result: result.includes('désactivés'), canaux: c.length };
  });
  log('Alertes & automatisations (simulation, sans envoi)', waDemo);
  log('errors v1.0.190 autoalerts', waDemo.loaded && waDemo.visibles === 4 && waDemo.wa && waDemo.rappelOk && waDemo.noSend && waDemo.result && waDemo.canaux === 4 ? [] : ['autoalerts']);
  // ---- v1.0.x : Document Studio — socle (modèles, dates, périmètre entreprise, tables locales)
  const ds = await A.pg.evaluate(async () => {
    if (typeof DocumentStudio === 'undefined') return { loaded: false };
    const S = DocumentStudio, o = {};
    const m = S.nouveauSuivi('suivi_t', 'entreprise_1', 'qualite', 'Suivi test', [
      { id: 'jour', libelle: 'Date', type: 'date' }, { id: 'code', libelle: 'Code', type: 'liste', options: ['A', 'B'] }]);
    o.date = S.remplir(m, { jour: '2026-11-11', code: 'A' }, { entrepriseId: 'entreprise_1' }).valeurs.jour === '2026-11-11';
    try { S.remplir(m, { jour: '11/11/2026' }, { entrepriseId: 'entreprise_1' }); o.dateKo = false; } catch (e) { o.dateKo = true; }
    try { S.remplir(m, { code: 'A' }, { entrepriseId: 'autre' }); o.isole = false; } catch (e) { o.isole = true; }
    await DB.putRaw('dsmodeles', { id: 'm_test', ...m });
    const back = await DB.get('dsmodeles', 'm_test');
    o.stocke = !!back && back.nom === 'Suivi test';
    await DB.delRaw('dsmodeles', 'm_test');
    o.supprime = !(await DB.get('dsmodeles', 'm_test'));
    o.tables = (await DB.all('dsdossiers')).length >= 0;
    return { loaded: true, ...o };
  });
  log('Document Studio (socle)', ds);
  log('errors v1.0.x document-studio', ds.loaded && ds.date && ds.dateKo && ds.isole && ds.stocke && ds.supprime && ds.tables ? [] : ['document-studio']);
  // ---- Mises en service : les fonctions récentes sont ouvertes pour les tests (le blocage est vérifié plus bas)
  await A.pg.evaluate(() => { Team.applyFlags(Team.allFlags('pub')); });
  // ---- Suivis personnalisés : onglets dans l'écran Réception / Bétonnage, modèles prêts, colonnes et lignes modifiables
  const sv = await A.pg.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms)), o = {};
    const pr0 = (await DB.all('projects'))[0]; if (!pr0) return { noProject: true };
    pr0.type = 'bat'; delete pr0.featOff; App.project = pr0;   // (en mémoire seulement) type bâtiment : Réception / Bétonnage disponibles
    const top = () => [...document.querySelectorAll('.sheet-bg')].pop();
    const need = async (sel, root) => { for (let i = 0; i < 100; i++) { const e = (root || top() || document).querySelector(sel); if (e) return e; await wait(100); } throw new Error('absent ' + sel + ' | ' + (top() ? top().textContent.slice(0, 100) : document.body.textContent.slice(0, 60))); };
    const click = async (sel, root) => { (await need(sel, root)).click(); await wait(300); };
    const byText = async (re) => { for (let i = 0; i < 100; i++) { const e = top() && [...top().querySelectorAll('button')].find(b => re.test(b.textContent)); if (e) return e; await wait(100); } throw new Error('texte absent ' + re); };
    const until = async (f) => { for (let i = 0; i < 80 && !f(); i++) await wait(100); return f(); };
    try {
      App.section = 'reception'; App.recTab = null;
      // modèles selon le poste : le service de l'utilisateur est lu depuis Team, chaque modèle a des colonnes valides
      { const me0 = Team.me; Team.me = () => ({ service: 'topo' }); o.poste = SuivisPerso.monService().k === 'topo' && SuivisPerso.PRESETS.some(x => (x.svc || []).includes('topo')) && SuivisPerso.PRESETS.every(x => SuivisPerso.colsOfPreset(x).length === x.cols.length); Team.me = me0; }
      openSuivis(pr0);
      o.galerie = /conseillé/.test((await byText(/Chape/)) && top().textContent);
      (await byText(/Chape/)).click(); await wait(400);
      o.preNom = (await need('[name=nom]')).value === 'Chape' && top().querySelectorAll('.ds-col').length === 8;
      await click('[data-a=save]');
      await until(() => App.recTab);
      o.onglet = !!App.recTab && /Chape/.test(((await need('.kseg [data-sv].on', document)) || {}).textContent || '');
      await need('.fab', document);
      o.structure = !!document.querySelector('.search input') && !!document.querySelector('.fbar') && !!document.querySelector('.fab') && !!document.querySelector('.sharebar');
      // + : nouvelle ligne (aujourd'hui) → page du jour
      await click('.fab', document); await (await byText(/Aujourd/)).click(); await wait(500);
      (await need('[name=Niveau]')).value = 'R+1'; top().querySelector('[name=Surface_m]').value = '42'; await click('[data-a=ok]');
      await need('.sv-dayr', document); o.entete = /Surface m²/.test(document.querySelector('.sv-dayr table.rec thead').textContent);
      o.ligne = await until(() => /R\+1/.test((document.querySelector('.sv-dayr table.rec') || {}).textContent || ''));
      // modifier la ligne
      await click('.sv-dayr tr[data-l]', document);
      (await need('[name=Niveau]')).value = 'R+2'; await click('[data-a=ok]');
      await until(() => /R\+2/.test((document.querySelector('.sv-dayr table.rec') || {}).textContent || ''));
      o.edit = /R\+2/.test(document.querySelector('.sv-dayr table.rec').textContent) && (await DB.all('dsdossiers')).length === 1 && /^\d{4}-\d{2}-\d{2}$/.test((await DB.all('dsdossiers'))[0].jour || '');
      // entête comme Réception : date + nom du projet + nom du suivi, résumé, boutons Ajouter / Coller
      const inf = (document.querySelector('.sv-dayr .rec-info') || {}).textContent || '';
      o.entetePro = inf.includes((window.App && App.projects && (App.projects.find(x => x.id === App.recTab.pid) || {}).name) || '') && !!document.querySelector('.sv-dayr .rec-sum') && !!document.querySelector('.sv-dayr [data-a=paste]') && !!document.querySelector('.sv-dayr [data-a=add]');
      o.sigUi = document.querySelectorAll('.sv-dayr [data-sig]').length === 3;
      // Coller un texte : une ligne par ligne
      await click('.sv-dayr [data-a=paste]', document);
      top().querySelector('textarea[name=t]').value = 'R+9;12'; await click('[data-a=ok]');
      await until(async () => (await DB.all('dsdossiers')).length === 2);
      o.coller = (await DB.all('dsdossiers')).some(d => Object.values(d.valeurs).includes('R+9'));
      for (const d of (await DB.all('dsdossiers'))) if (Object.values(d.valeurs).includes('R+9')) await DB.delRaw('dsdossiers', d.id);
      document.querySelector('.sv-dayr [data-a=back]').click(); await wait(600);
      // filtre Niveau (colonne « Niveau » présente) + recherche
      o.filtre = !!document.querySelector('.fsel[data-f=niv]') && !!document.querySelector('.mcard .prow');
      // renommer une colonne + déplacer : les valeurs restent
      await click('[data-a=cfg]', document);
      await click('[data-ced="0"]'); (await need('[name=libelle]')).value = 'Étage'; await click('[data-a=ok]');
      await click('[data-dn="0"]'); await click('[data-a=save]');
      await until(() => !document.querySelector('.sheet-bg'));
      await wait(600); await click('.mcard .prow', document); await need('.sv-dayr', document);
      const heads = [...document.querySelectorAll('.sv-dayr table.rec thead th')].map(x => x.textContent);
      o.rename = heads.includes('Étage') && heads.indexOf('Étage') > heads.indexOf('Local') && /R\+2/.test(document.querySelector('.sv-dayr table.rec tbody').textContent);
      document.querySelector('.sv-dayr [data-a=back]').click(); await wait(600);
      // archivage : le suivi disparaît des onglets (lignes gardées), puis il revient
      { const m0 = (await SuivisPerso.mine(pr0))[0], n0 = (await SuivisPerso.actifs(pr0)).length; await SuivisPerso.archiver(m0, true); const a1 = (await SuivisPerso.actifs(pr0)).length, t1 = (await SuivisPerso.mine(pr0)).length, l1 = (await SuivisPerso.lignesOf(m0)).length; await SuivisPerso.archiver(m0, false);
        o.archive = a1 === n0 - 1 && t1 === n0 && l1 > 0 && (await SuivisPerso.actifs(pr0)).length === n0; }
      // synchro : chaque suivi/ligne porte projectId + updatedAt ; une suppression laisse une trace (tomb) ; les anciens suivis sont rattrapés
      { const m0 = (await SuivisPerso.mine(pr0))[0], L0 = (await SuivisPerso.lignesOf(m0))[0];
        const stamped = !!m0.projectId && m0.projectId === pr0.id && (await DB.all('dsdossiers')).every(d => d.projectId === pr0.id && d.updatedAt > 0);
        await DB.putRaw('dsdossiers', { ...L0, projectId: undefined, updatedAt: undefined }); const n = await SuivisPerso.rattraper(); const back = (await DB.get('dsdossiers', L0.id));
        const tmp = await SuivisPerso.sput('dsdossiers', { ...L0, id: 'd_tmp_sync' }); await SuivisPerso.sdel('dsdossiers', 'd_tmp_sync'); const tomb = (await DB.all('tomb')).some(t => t.id === 'dsdossiers:d_tmp_sync' && t.projectId === pr0.id);
        o.syncSuivis = stamped && n >= 1 && back.projectId === pr0.id && back.updatedAt > 0 && !!tmp.updatedAt && tomb && !(await DB.get('dsdossiers', 'd_tmp_sync')); }
      // signatures manuelles du jour : enregistrées dans le suivi (synchronisable), retirables
      { const m0 = (await SuivisPerso.mine(pr0))[0]; await SuivisPerso.setSig(m0, '2026-01-01', 'redige', { img: 'data:image/png;base64,AA', nom: 'Test', at: Date.now(), consent: true });
        const m1 = (await SuivisPerso.mine(pr0))[0]; const okA = SuivisPerso.sigsOf(m1, '2026-01-01').redige.nom === 'Test' && m1.updatedAt > 0 && m1.projectId === pr0.id;
        await SuivisPerso.setSig(m1, '2026-01-01', 'redige', null); o.signature = okA && !SuivisPerso.sigsOf((await SuivisPerso.mine(pr0))[0], '2026-01-01').redige; }
      const inp = document.querySelector('.search input'); inp.value = 'zzz'; inp.dispatchEvent(new Event('input')); await wait(900);
      o.recherche = /Aucun résultat/.test(document.querySelector('#svBody').textContent);
      document.querySelector('.kseg [data-k=reception]').click(); await wait(800);
      o.retour = !App.recTab && !!document.querySelector('.kseg [data-sv]');
      o.sync = !(await DB.all('tomb')).some(x => /^(s_|d_)/.test(String(x.id || '')));
    } catch (e) { o.err = String(e.message || e); }
    for (const d of await DB.all('dsdossiers')) await DB.delRaw('dsdossiers', d.id); for (const m of await DB.all('dsmodeles')) await DB.delRaw('dsmodeles', m.id);
    App.recTab = null; document.querySelectorAll('.sheet-bg').forEach(x => x.remove());
    return o;
  });
  log('Suivis personnalisés', sv);
  if (!sv.noProject && !(sv.galerie && sv.poste && sv.preNom && sv.onglet && sv.structure && sv.entete && sv.ligne && sv.edit && sv.entetePro && sv.coller && sv.filtre && sv.rename && sv.archive && sv.syncSuivis && sv.signature && sv.sigUi && sv.recherche && sv.retour && sv.sync)) throw new Error('suivis personnalisés KO ' + JSON.stringify(sv));
  // ---- Organigramme Service Qualité : branches Administratif / Chantier, missions, code d'accès (local seulement)
  const og = await A.pg.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms)), o = {};
    const pr0 = (await DB.all('projects'))[0]; if (!pr0) return { noProject: true };
    const bak = JSON.stringify(pr0.team || null);
    try {
      pr0.team = [{ id: 'og1', name: 'Directeur', poste: 'dirq', service: 'qual', branche: 'admin' }, { id: 'og2', name: 'Resp', poste: 'respq', service: 'qual', parent: 'og1', branche: 'admin' }, { id: 'og3', name: 'Chef', poste: 'chef', service: 'trav', parent: 'og1', branche: 'chantier' }];
      App.project = pr0; App.orgBr = '';
      const root = document.createElement('div'); document.body.appendChild(root);
      await renderOrg(root); await wait(300);
      o.chips = root.querySelectorAll('[data-br]').length === 3;
      const n0 = root.querySelectorAll('g[data-m]').length;
      root.querySelector('[data-br=chantier]').click(); await wait(400);
      const n1 = root.querySelectorAll('g[data-m]').length;   // Chef + son supérieur
      o.filtre = n0 >= 3 && n1 < n0 && !!root.querySelector('g[data-m="og3"]') && !root.querySelector('g[data-m="og2"]');
      App.orgBr = '';
      const m = pr0.team.find(x => x.id === 'og2'); m.missions = [{ id: 'a', titre: 'Fiches fond de fouille', partie: 'Terrassement et fondation', statut: 'doing' }, { id: 'b', titre: 'PV labo', statut: 'done' }];
      o.stats = OrgQ.missionStats(m).open === 1 && OrgQ.missionStats(m).done === 1;
      o.role = OrgQ.roleOfMember(m) === 'respqualite' && OrgQ.roleOfMember({ poste: 'zzz', service: 'hse' }) === 'animhse';
      OrgQ.ogCodeSet(m, { code: 'ABCD2345', at: Date.now(), role: 'respqualite' }); o.code = OrgQ.ogCodeGet(m).code === 'ABCD2345' && !JSON.stringify(pr0).includes('ABCD2345'); OrgQ.ogCodeSet(m, null);
      orgFiche(pr0, m, true, async () => {}, () => {}); await wait(300);
      const sh = [...document.querySelectorAll('.sheet-bg')].pop();
      o.fiche = !!sh && sh.querySelectorAll('[data-ms]').length === 2 && /Fiches fond de fouille/.test(sh.textContent) && !!sh.querySelector('[data-a=msnew]');
      document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); root.remove();
    } catch (e) { o.err = String(e.message || e); }
    pr0.team = JSON.parse(bak); await DB.put('projects', pr0);
    return o;
  });
  log('Organigramme Qualité', og);
  if (!og.noProject && !(og.chips && og.filtre && og.stats && og.role && og.code && og.fiche)) throw new Error('organigramme qualité KO ' + JSON.stringify(og));
  // ---- Mon espace : rôle, missions, accès de la personne
  const me1 = await A.pg.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms)), o = {}; const pr0 = (await DB.all('projects'))[0]; if (!pr0) return { noProject: true };
    const bak = JSON.stringify(pr0.team || []);
    try {
      pr0.team = [{ id: 'me1', name: 'Directeur', poste: 'dirq', service: 'qual', branche: 'admin' }, { id: 'me2', name: 'Chef labo', poste: 'respq', service: 'qual', parent: 'me1', branche: 'chantier', missions: [{ id: 'm1', titre: 'PV labo béton', statut: 'todo', echeance: '2020-01-01' }, { id: 'm2', titre: 'Fiches fond de fouille', statut: 'done' }] }];
      App.project = pr0; MonEspace.setMap(pr0, '');
      const root = document.createElement('div'); document.body.appendChild(root);
      await MonEspace.render(root); await wait(300);
      o.ask = root.querySelectorAll('.me-pick').length === 2;
      root.querySelector('[data-id=me2]').click(); await wait(500);
      o.card = /Chef labo/.test(root.querySelector('.me-card').textContent);
      o.missions = root.querySelectorAll('[data-ms]').length === 2 && !!root.querySelector('.me-ms.late');
      root.querySelector('[data-ms=m1]').click(); await wait(500);
      o.avance = (pr0.team.find(x => x.id === 'me2').missions[0].statut === 'doing');
      await DB.put('files', { id: 'fmz1', projectId: pr0.id, role: 'doc', name: 'Fiche test', missionId: 'm1', zone: 'Zone 1', rubrique: 'Fond de fouille', updatedAt: Date.now() });
      await MonEspace.render(root); await wait(400);
      o.pieces = /1 pièce/.test(root.querySelector('[data-ms=m2]') ? root.querySelector('[data-ms=m2]').textContent : '') === false && /1 pièce/.test(root.querySelector('[data-ms=m1]').textContent) && /Zone 1/.test(root.textContent);
      App.docView = 'mz'; App.mzSt = { mode: 'mission', key: null };
      const r2 = document.createElement('div'); document.body.appendChild(r2); await QualiteDocs.renderMZ(r2); await wait(400);
      o.vueMz = !!r2.querySelector('[data-m=zone]') && /PV labo béton/.test(r2.textContent);
      r2.querySelector('[data-m=zone]').click(); await wait(400);
      o.vueZone = /Zone 1/.test(r2.textContent);
      { const b = new Blob(['x'], { type: 'application/pdf' }), pD = QualiteDocs.partsOf(pr0)[0], dd = { partId: pD.id, rub: pD.rub[0], missionId: 'm1', zone: 'Zone 1' }; pr0.qAuto = { on: true, ...dd }; await DB.put('projects', pr0);
        await QualiteDocs.autoSend(pr0.id, { name: 'PV test.pdf', blob: b, mime: 'application/pdf', srcKind: 'recday', srcId: 'dayT' }); await QualiteDocs.autoSend(pr0.id, { name: 'PV test.pdf', blob: b, mime: 'application/pdf', srcKind: 'recday', srcId: 'dayT' });
        const L = (await DB.byProject('files', pr0.id)).filter(f => f.srcId === 'dayT'); o.auto = L.length === 1 && L[0].role === 'doc' && L[0].missionId === 'm1' && L[0].qPath[0] === 'Qualité' && (L[0].hist || []).length === 2;
        for (const f of L) await DB.del('files', f.id); pr0.qAuto = null; }
      o.qpath = JSON.stringify(QualiteDocs.qPathOf({ nom: 'Gros œuvre' }, 'PV labo', 'Bloc A')) === '["Qualité","Gros œuvre","PV labo","Bloc A"]' && QualiteDocs.qPathOf(null, '__autres', '').join('/') === 'Qualité/Hors partie/Autres pièces';
      { const al = QualiteDocs.alertes(pr0, await DB.byProject('files', pr0.id)); o.alertes = al.late.length === 1 && al.vide.length === 0; }
      r2.remove(); App.docView = null; await DB.del('files', 'fmz1');
      MonEspace.setMap(pr0, ''); root.remove();
    } catch (e) { o.err = String(e.message || e); }
    pr0.team = JSON.parse(bak); await DB.put('projects', pr0);
    return o;
  });
  log('Mon espace', me1);
  if (!me1.noProject && !(me1.ask && me1.card && me1.missions && me1.avance && me1.pieces && me1.vueMz && me1.vueZone && me1.alertes && me1.qpath && me1.auto)) throw new Error('mon espace KO ' + JSON.stringify(me1));
  // ---- Documentation qualité par partie d'ouvrage : rubriques, pièces classées, manques, historique
  const qd = await A.pg.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms)), o = {};
    const pr0 = (await DB.all('projects'))[0]; if (!pr0) return { noProject: true };
    const added = [];
    try {
      App.project = pr0; App.docCat = null; App.docView = 'parties'; App.qSt = null;
      const parts = QualiteDocs.partsOf(pr0); o.parties = parts.length >= 9 && parts[0].nom === 'Terrassement et fondation';
      const f = await DB.put('files', QualiteDocs.addHist({ projectId: pr0.id, role: 'doc', docCat: 'autre', partId: 'terr', rubrique: 'Fond de fouille', name: 'fond-fouille.pdf', blob: new Blob(['x'], { type: 'application/pdf' }), mime: 'application/pdf' }, 'ajoutée', 'test'));
      added.push(f.id);
      const f2 = await DB.put('files', { projectId: pr0.id, role: 'doc', docCat: 'labo', partId: 'terr', rubrique: 'PV laboratoire sol', name: 'pv-sol.pdf', blob: new Blob(['y'], { type: 'application/pdf' }), mime: 'application/pdf' }); added.push(f2.id);
      const all = await DB.byProject('files', pr0.id), st = QualiteDocs.stat(parts[0], all);
      o.stat = st.cov === 2 && st.total === 6 && st.manque.includes('Compactage') && st.n === 2;
      o.hist = (f.hist || []).length === 1 && f.hist[0].act === 'ajoutée' && f.hist[0].at > 0;
      o.cat = QualiteDocs.catOf('PV laboratoire sol') === 'labo' && QualiteDocs.catOf('Réception coulage') === 'pv' && QualiteDocs.catOf('Fond de fouille') === 'autre';
      const root = document.createElement('div'); document.body.appendChild(root);
      await QualiteDocs.render(root); await wait(300);
      const card = root.querySelector('[data-p=terr]'); o.carte = !!card && /2\/6 rubriques/.test(card.textContent) && /Compactage/.test(card.textContent);
      card.click(); await wait(400);
      o.rubriques = root.querySelectorAll('.qd-rub').length >= 6 && !!root.querySelector('.qd-rub.ok') && !!root.querySelector('.qd-rub.no');
      root.querySelector('[data-r="Fond de fouille"]').click(); await wait(400);
      o.piece = /fond-fouille\.pdf/.test(root.textContent);
      root.remove();
    } catch (e) { o.err = String(e.message || e); }
    for (const id of added) await DB.del('files', id).catch(() => {}); App.qSt = null;
    return o;
  });
  log('Documentation qualité', qd);
  if (!qd.noProject && !(qd.parties && qd.stat && qd.hist && qd.cat && qd.carte && qd.rubriques && qd.piece)) throw new Error('documentation qualité KO ' + JSON.stringify(qd));
  // ---- Qualité : volets Administratif / Terrain / Commun dans les outils du projet
  const qs1 = await A.pg.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms)), o = {}; const pr0 = (await DB.all('projects'))[0]; if (!pr0) return { noProject: true };
    try {
      App.project = pr0; localStorage.removeItem('qual.side'); localStorage.removeItem('ptools.qs');
      const root = document.createElement('div'); document.body.appendChild(root);
      sessionStorage.setItem('st.preview', JSON.stringify({ plan: 'enterprise' }));
      ST.renderProjectTools(root); await wait(400);
      const q = root.querySelector('details[data-g=qual]');
      if (!q) { o.pasQual = true; } else {
        o.volets = q.querySelectorAll('details.st-qs').length >= 2;
        o.adm = !!q.querySelector('details[data-qs=adm] [data-tool=docq]');
        o.ter = !!q.querySelector('details[data-qs=ter] [data-tool=reception]');
        o.reglage = !!q.querySelector('[data-a=qsset]');
        o.services = ['travaux', 'hse', 'topo', 'labo'].every(k => { const d = root.querySelector('details[data-g=sv-' + k + ']'); return !!d && /^Service /.test(d.querySelector('summary').textContent) && d.querySelectorAll('details.st-qs').length >= 1; })
          && /Service Topographique/.test(root.textContent);
      }
      o.icones = !!q && q.querySelectorAll('details.st-qs > summary .st-qs-ic').length >= 2;
      const pm = pr0.team; pr0.team = [{ id: 'v1', name: 'Test', poste: 'ctrl', service: 'qual', me: true, volet: 'ter' }];
      o.adminToutVoit = true; pr0.team = pm;
      o.adminSeul = ST.isEnt() === true && typeof orgCanAdmin === 'function' && orgCanAdmin() === true;
      o.deuxCat = !root.querySelector('details[data-g=qual]') && !!root.querySelector('details[data-g=sq]') && /Service Qualité/.test(root.querySelector('details[data-g=sq] summary').textContent) && ['reception', 'docq'].every(k => !!root.querySelector('details[data-g=sq] [data-tool=' + k + ']'));
      sessionStorage.setItem('st.preview', JSON.stringify({ plan: 'basic' })); ST.renderProjectTools(root); await wait(400);
      o.basicInchange = !root.querySelector('details.st-qs') && (!q || !!root.querySelector('details[data-g=qual] [data-tool]'));
      sessionStorage.removeItem('st.preview');
      root.remove();
    } catch (e) { o.err = String(e.message || e); }
    return o;
  });
  log('Qualité volets', qs1);
  // ---- Mises en service : fonctions fermées par défaut pour un compte ordinaire
  const fl1 = await A.pg.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms)), o = {}; const pr0 = (await DB.all('projects'))[0]; if (!pr0) return { noProject: true };
    try {
      App.project = pr0; sessionStorage.setItem('st.preview', JSON.stringify({ plan: 'enterprise' }));
      Team.applyFlags({});
      o.fermees = !Team.isSuper() && Object.keys(Team.FLAG_DEFS).every(k => Team.flag(k) === false);
      const root = document.createElement('div'); document.body.appendChild(root); ST.renderProjectTools(root); await wait(400);
      o.pasSq = !root.querySelector('details[data-g=sq]') && !root.querySelector('details[data-g^=sv-]'); o.monEspaceCache = SECTIONS.monespace.hidden === true;
      Team.applyFlags({ svcqual: { enterprise: 'test' } }, ['autre@example.com']); o.testAutre = Team.flag('svcqual') === false;
      Team.applyFlags({ svcqual: { enterprise: 'pub' } }); o.pub = Team.flag('svcqual') === true;
      sessionStorage.setItem('st.preview', JSON.stringify({ plan: 'basic' })); o.autrePack = Team.flag('svcqual') === false && Team.pack() === 'basic';
      sessionStorage.setItem('st.preview', JSON.stringify({ plan: 'enterprise' }));
      Team.applyFlags(Team.allFlags('pub'), []);
      sessionStorage.removeItem('st.preview'); root.remove();
    } catch (e) { o.err = String(e.message || e); }
    return o;
  });
  log('Mises en service', fl1);
  if (!fl1.noProject && !(fl1.fermees && fl1.pasSq && fl1.monEspaceCache && fl1.testAutre && fl1.pub && fl1.autrePack)) throw new Error('mises en service KO ' + JSON.stringify(fl1));
  if (!qs1.noProject && !qs1.pasQual && !(qs1.volets && qs1.adm && qs1.ter && qs1.reglage && qs1.basicInchange && qs1.icones && qs1.adminSeul && qs1.deuxCat && qs1.services)) throw new Error('volets qualité KO ' + JSON.stringify(qs1));
  // ---- Suivis personnalisés + modèle visuel : cases liées aux colonnes, PDF écrit sur le bon
  const sv2 = await A.pg.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms)), o = {};
    const pr0 = (await DB.all('projects'))[0]; if (!pr0) return { noProject: true };
    App.project = pr0;
    const top = () => [...document.querySelectorAll('.sheet-bg')].pop();
    const need = async (sel, root) => { for (let i = 0; i < 100; i++) { const e = (root || top() || document).querySelector(sel); if (e) return e; await wait(100); } throw new Error('absent ' + sel); };
    let opened = null; const oldOpen = window.openFileRecord; window.openFileRecord = (rec) => { opened = rec; };
    try {
      try { await needPdfLib(); } catch (e) { o.nolib = true; }   // pdf-lib / pdf.js ne sont copiés dans www/lib qu'au build : ici on ne peut pas écrire de PDF
      if (o.nolib) { window.openFileRecord = oldOpen; return o; }
      const PDFLib = window.PDFLib, doc = await PDFLib.PDFDocument.create(); doc.addPage([420, 595]);
      const blob = new Blob([await doc.save()], { type: 'application/pdf' });
      const rec = await DB.put('files', { projectId: pr0.id, blob, mime: 'application/pdf', role: 'bontpl', name: 'Modèle test.pdf' });
      const champs = [{ id: 'Surface', libelle: 'Surface', type: 'nombre' }, { id: 'Date', libelle: 'Date', type: 'date' }];
      const visuel = { id: 'v1', name: 'Bon test', fileId: rec.id, fields: [] };
      // éditeur de cases : proposer les colonnes, en placer une
      const ed = SuivisPerso.visuelEditer(pr0, visuel, champs);
      const edEl = await need('.ft-ed', document);
      (await need('[data-a=add]', edEl)).click(); await wait(300);
      const items = [...top().querySelectorAll('button')]; o.menuCols = items.some(b => /Colonne : Surface/.test(b.textContent)) && items.some(b => /Colonne : Date/.test(b.textContent)) && !items.some(b => /Fiche N°/.test(b.textContent));
      items.find(b => /Colonne : Surface/.test(b.textContent)).click(); await wait(400);
      o.boite = edEl.querySelectorAll('.ft-box').length === 1;
      (await need('[data-a=ok]', edEl)).click(); await ed;
      o.cases = visuel.fields.length === 1 && visuel.fields[0].k === 'col' && visuel.fields[0].col === 'Surface';
      // ligne + PDF
      const base = DocumentStudio.modele({ id: 's_vis', nom: 'Suivi visuel', entrepriseId: SuivisPerso.ctxOf(pr0).entrepriseId, serviceId: 'general', projetId: SuivisPerso.ctxOf(pr0).projetId, categorie: 'suivi', champs });
      await DB.putRaw('dsmodeles', { ...base, visuel, creeLe: Date.now() });
      const d = DocumentStudio.remplir(base, { Surface: 12.5, Date: '2026-11-12' }, SuivisPerso.ctxOf(pr0));
      await DB.putRaw('dsdossiers', { ...d, id: 'd_vis', creeLe: Date.now() });
      App.recTab = { pid: pr0.id, id: 's_vis' }; const root = document.createElement('div'); document.body.appendChild(root); await SuivisTabs.render(root, pr0, 'Ferraillage'); await (await need('.mcard .prow', root)).click(); (await need('[data-pdf]', document)).click(); setTimeout(() => { root.remove(); document.querySelectorAll('.sv-dayr').forEach(x => x.remove()); }, 4000);
      for (let i = 0; i < 100 && !opened; i++) await wait(100);
      o.pdf = !!opened && opened.blob.size > 500 && opened.mime === 'application/pdf';
      const txt = opened ? new TextDecoder('latin1').decode(new Uint8Array(await opened.blob.arrayBuffer())) : '';
      o.pdfPages = txt.startsWith('%PDF') && opened.blob.size > 5000;   // plus gros que la page vierge : les cases sont bien écrites
    } catch (e) { o.err = String(e.message || e); }
    window.openFileRecord = oldOpen;
    for (const m of (await DB.all('dsmodeles')).filter(m => m.id === 's_vis')) await DB.delRaw('dsmodeles', m.id);
    for (const d of (await DB.all('dsdossiers')).filter(d => d.id === 'd_vis')) await DB.delRaw('dsdossiers', d.id);
    document.querySelectorAll('.sheet-bg,.ft-ed').forEach(x => x.remove());
    return o;
  });
  log('Suivis modèle visuel', sv2);
  if (!sv2.noProject && !sv2.nolib && !(sv2.menuCols && sv2.boite && sv2.cases && sv2.pdf && sv2.pdfPages)) throw new Error('suivis modèle visuel KO ' + JSON.stringify(sv2));
  // ---- Détection automatique des cases : logique pure + OCR réel (tesseract local) sur un bon dessiné
  const ac = await A.pg.evaluate(async () => {
    const o = {};
    try {
      const w = (t, x, y, wd = t.length * 6) => ({ t, x, y, w: wd, h: 10 });
      const L = AutoCases.depuisMots([w('ZONE', 40, 170), w('..................', 80, 170, 150), w('OUVRAGE:', 40, 200), w('Poteau P4', 110, 200, 60), w('NOM:', 40, 300), w('phrase sans intitulé du tout ici', 40, 500, 190)], 595, 842).map(c => c.label);
      o.pur = L.join() === 'Zone,Ouvrage,Nom';
      const cv = document.createElement('canvas'); cv.width = 1190; cv.height = 840; const g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 1190, 840); g.fillStyle = '#222'; g.font = 'bold 34px Arial';
      g.fillText('DATE :', 700, 150); g.fillText('ZONE', 60, 260); g.fillText('OUVRAGE :', 60, 340); g.fillText('NOM :', 60, 520); g.fillText('VISA :', 600, 520);
      g.font = '34px Arial'; g.fillText('......................................', 170, 260); g.fillStyle = '#1d3fbf'; g.font = 'italic 40px cursive'; g.fillText('12/11/2026', 820, 150); g.fillText('Poteau P4', 300, 335);
      const mots = await AutoCases.motsOcr(cv, 595, 420), lab = AutoCases.depuisMots(mots, 595, 420).map(c => c.label);
      o.ocr = ['Date', 'Zone', 'Ouvrage', 'Nom', 'Visa'].every(x => lab.includes(x)); o.lab = lab.join();
    } catch (e) { o.err = String(e.message || e); }
    return o;
  });
  log('Détection des cases', ac);
  if (!(ac.pur && ac.ocr)) throw new Error('détection des cases KO ' + JSON.stringify(ac));
  // ---- Tableaux intégrés : Anomalies, Échéances, Points d'intérêt, Alertes, Photos s'affichent dans l'application (pas en feuille / page par-dessus)
  const ti = await A.pg.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms)), o = {};
    const pr0 = (await DB.all('projects'))[0]; if (!pr0) return { noProject: true };
    App.project = pr0;
    try {
      for (const k of ['anom', 'due', 'points', 'alertes', 'photos']) {
        document.querySelectorAll('.sheet-bg').forEach(x => x.remove());
        await openTableTool(pr0, k); await wait(1200);
        const c = document.querySelector('#content');
        o[k] = App.section === 'tb_' + k && !!document.querySelector('#app > .topbar') && !!c && (c.classList.contains('emb') || !!c.querySelector('.emb-wrap')) && !document.querySelector('.sheet-bg') && !document.querySelector('body > .fullpage.an-page, body > .fullpage.due-page');
      }
    } catch (e) { o.err = String(e.message || e); }
    return o;
  });
  log('Tableaux intégrés', ti);
  if (!ti.noProject && !(ti.anom && ti.due && ti.points && ti.alertes && ti.photos)) throw new Error('tableaux intégrés KO ' + JSON.stringify(ti));
  log('errors v1.0.x suivis', []);
  // ---- v1.0.x : Espaces des intervenants (Business + Enterprise, Dev) — invisibles en Basic/Pro
  const esp = await A.pg.evaluate(() => { const o = {}; const ks = ['espbet', 'esparchi', 'esplabo', 'espmoa', 'espbc', 'esptopo', 'espat'];
    Team.applyFlags({}, []); // réglages par défaut du code
    for (const pk of ['basic', 'pro', 'business', 'enterprise']) { const on = (k) => !!Team.flagCfg(k)[pk]; o[pk] = ks.every(on) ? 'tous' : ks.some(on) ? 'partiel' : 'aucun'; o[pk + '_svc'] = on('svctravaux'); }
    Team.applyFlags(Team.allFlags('pub')); return o; });
  log('Espaces intervenants', esp);
  if (esp.basic !== 'aucun' || esp.pro !== 'aucun' || esp.business !== 'tous' || esp.enterprise !== 'tous' || !esp.business_svc) throw new Error('espaces intervenants KO ' + JSON.stringify(esp));
  log('errors v1.0.x espaces', []);
  // ---- v1.0.x : niveau « Intervenants du projet » (Entreprise + intervenants, chacun avec ses services en volets)
  await A.pg.evaluate(async () => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); Team.applyFlags(Team.allFlags('pub')); App.section = 'ptools'; await renderSection(); }); await A.pg.waitForTimeout(400);
  const ivr = await A.pg.evaluate(() => { const q = (s) => document.querySelectorAll('.st-ptools-p ' + s).length; const d = document.querySelector('.st-ptools-p details[data-g=iv-bet]'); if (d) d.open = true; const sub = d && d.querySelector('details.st-sub'); if (sub) sub.open = true;
    return { ent: q('details[data-g=iv-ent]'), bet: q('details[data-g=iv-bet]'), moa: q('details[data-g=iv-moa]'), subs: d ? d.querySelectorAll('details.st-sub').length : 0, volets: sub ? sub.querySelectorAll('details.st-qs').length : 0 }; });
  log('Intervenants du projet', ivr);
  if (!ivr.ent || !ivr.bet || !ivr.moa || ivr.subs !== 4 || !ivr.volets) throw new Error('intervenants KO ' + JSON.stringify(ivr));
  await A.pg.evaluate(async () => { Team.applyFlags(Team.allFlags('pub')); });
  const ivk = await A.pg.evaluate(() => ['bet', 'architecte', 'mo', 'bcontrole', 'labo', 'topoext', 'soustraitant'].map(r => ST.ivKeyOfRole(r)));
  log('Rôle partenaire → intervenant', ivk);
  if (ivk.join() !== 'bet,archi,moa,bc,labo,topo,' ) throw new Error('rôle→intervenant KO ' + ivk.join());
  // l'organisation titulaire voit l'Entreprise et tous les intervenants ; le partenaire (BET) ne voit que le sien : vérifié par la logique de rôle ci-dessus
  log('errors v1.0.x intervenants', []);
  // ---- v1.0.x : Table de projet (réserves · RFI · visas) + tableau de bord interactif
  const tp = await A.pg.evaluate(async () => { const wait = (ms) => new Promise(r => setTimeout(r, ms)); document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove());
    const p = (await DB.all('projects')).find(x => !x.deleted); if (!p) return { noProject: true }; App.project = p;
    const L = REG.rfi.store(p); const x = { id: 'tp-test', n: 'RFI-TP1', obj: 'Gaine VMC test', dest: 'BET structure', st: 'env', date: '2020-01-01' }; L.push(x); await DB.put('projects', p);
    Team.applyFlags(Team.allFlags('pub')); const o = {};
    try { App.section = 'tabproj'; await renderSection(); await wait(600);
      o.tiles = document.querySelectorAll('.tp-t').length; o.rowsAll = document.querySelectorAll('.tp-r').length; o.late = +document.querySelectorAll('.tp-t b')[1].textContent;
      document.querySelector('[data-set="iv:bet"]').click(); await wait(200); o.rowsBet = document.querySelectorAll('.tp-r').length; o.hasRfi = [...document.querySelectorAll('.tp-r b')].some(b => /RFI-TP1/.test(b.textContent));
      document.querySelector('[data-set="iv:archi"]') ? o.archi = 1 : o.archi = 0;
    } catch (e) { o.err = String(e.message || e); }
    p.reg.rfi = p.reg.rfi.filter(y => y.id !== 'tp-test'); await DB.put('projects', p); App.section = 'ptools'; return o; });
  log('Table de projet', tp);
  if (!tp.noProject && (tp.err || tp.tiles !== 3 || !tp.hasRfi || tp.rowsBet < 1 || tp.late < 1 || tp.archi)) throw new Error('table de projet KO ' + JSON.stringify(tp));
  log('errors v1.0.x table de projet', []);
  // ---- ST-LINK-001 : Link Viewer (ouverture centralisée des liens)
  const lk = await A.pg.evaluate(async () => { const o = {}; const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const uid0 = Team.uid(), nProj0 = (await DB.all('projects')).length, calls = [], realOpen = window.open, realCap = window.Capacitor;
    window.open = (u, t, f) => { calls.push({ u, t, f }); return {}; };
    try {
      // Web : lien https valide → nouvel onglet sécurisé
      await openUrl('https://www.google.com/maps/place/Casablanca'); o.webOpen = calls.length === 1 && /noopener/.test(calls[0].f || '') && calls[0].t === '_blank';
      // liens refusés
      const bad = ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'https://user:pw@evil.example/', 'https://x.example/?access_token=abc', 'vbscript:x', ''];
      const n0 = calls.length; for (const b of bad) await openUrl(b); o.badBlocked = calls.length === n0; o.checkBad = bad.every(b => LinkViewer.check(b) === null);
      // schéma implicite
      o.implicit = LinkViewer.check('drive.google.com/file/d/1/view') === 'https://drive.google.com/file/d/1/view';
      // WhatsApp : application externe (jamais le navigateur intégré)
      const r = await LinkViewer.openLink('https://wa.me/?text=hello'); o.wa = r.mode === 'external';
      // ouvertures répétées : pas de blocage, double toucher ignoré
      let rep = 0; for (let i = 0; i < 6; i++) { await LinkViewer.openLink('https://example.com/p' + i); rep++; await wait(5); } const d = await LinkViewer.openLink('https://example.com/p5'); o.repeat = rep === 6 && d.mode === 'ignored';
      // Android natif simulé : le plugin Browser est utilisé, l'application n'est pas touchée
      const seen = []; window.Capacitor = { isNativePlatform: () => true, Plugins: { Browser: { open: async (x) => { seen.push(x.url); } } } };
      o.driveExt = LinkViewer.isExternal('https://drive.google.com/drive/folders/XYZ') && LinkViewer.isExternal('https://docs.google.com/spreadsheets/d/1/edit') && !LinkViewer.isExternal('https://www.google.com/maps?q=1');
      const rn = await LinkViewer.openLink('https://example.com/page'); await wait(750); const rn2 = await LinkViewer.openLink('https://www.google.com/maps?q=1'); o.native = rn.mode === 'inapp' && rn2.mode === 'inapp' && seen.length === 2;
    } catch (e) { o.err = String(e.message || e); }
    window.open = realOpen; window.Capacitor = realCap;
    o.dataKept = (await DB.all('projects')).length === nProj0; o.authKept = Team.uid() === uid0;
    return o; });
  log('Link Viewer', lk);
  if (lk.err || !lk.webOpen || !lk.badBlocked || !lk.checkBad || !lk.implicit || !lk.wa || !lk.repeat || !lk.native || !lk.driveExt || !lk.dataKept || !lk.authKept) throw new Error('link viewer KO ' + JSON.stringify(lk));
  log('errors ST-LINK-001', []);
  // ---- titre de l'écran d'un plan = niveau (et non le long nom du fichier)
  const pt2 = await A.pg.evaluate(async () => { const o = {}; try { const pl = (await DB.all('plans')).find(x => !x.deleted); if (!pl) return { noPlan: true };
    const fo = pl.folderId ? await DB.get('folders', pl.folderId) : null; o.t = await planTitle(pl); o.expect = (fo && nivOfFolder(fo.name)) || nivOfFolder(pl.name) || (fo && fo.name) || pl.name || 'Plan';
    o.long = await planTitle({ name: 'GSC-POP-PE-A-JA-0M-RDC-PLAN', folderId: '' }); } catch (e) { o.err = String(e.message || e); } return o; });
  log('Titre du plan = niveau', pt2);
  if (!pt2.noPlan && (pt2.err || pt2.t !== pt2.expect || pt2.long !== 'RDC')) throw new Error('titre plan KO ' + JSON.stringify(pt2));
  const lt = await A.pg.evaluate(() => { const p = App.project || {}; const hold = p.planLots, holdV = p.catV; p.catV = 1; p.planLots = [{ id: 'zz', name: 'Gros œuvre', cat: 'STR' }]; App.project = p; const o = { lot: planLotText({ lotId: 'zz' }), none: planLotText({}) }; p.planLots = hold; p.catV = holdV; return o; });
  log('Type de lot sous le niveau', lt);
  if (lt.lot !== 'Gros œuvre' || lt.none !== '') throw new Error('type lot KO ' + JSON.stringify(lt));
  // ---- familles de types (menus déroulants), Fondations en SSL, carte d'en-tête
  const fm = await A.pg.evaluate(async () => { const o = {}; try { const p = { typeFam: {}, typeNames: {} };
    o.famStr = famOfType(p, 'STR'); o.famElec = famOfType(p, 'CFO'); p.typeFam.CFO = 'secu'; o.moved = famOfType(p, 'CFO'); p.typeNames.ARCH = 'Archi'; o.ren = typesOf(p).find(t => t.k === 'ARCH').l;
    const ssl = { name: 'SSL' }, rdc = { name: 'RDC' }; o.fndSsl = typeShownIn(ssl, { k: 'FND' }); o.fndRdc = typeShownIn(rdc, { k: 'FND' }); o.fndAdd = typeShownIn({ name: 'RDC', extraTypes: ['FND'] }, { k: 'FND' });
    const h = await planHeadHtml({ name: 'x', folderId: '' }); o.card = /pv-card/.test(h) && /pv-niv/.test(h);
  } catch (e) { o.err = String(e.message || e); } return o; });
  log('Familles / Fondations / carte', fm);
  if (fm.err || fm.famStr !== 'gros' || fm.famElec !== 'elec' || fm.moved !== 'secu' || fm.ren !== 'Archi' || !fm.fndSsl || fm.fndRdc || !fm.fndAdd || !fm.card) throw new Error('familles KO ' + JSON.stringify(fm));
  // balayage dans un dossier de plans : ne doit pas ouvrir le menu
  const sw = await A.pg.evaluate(() => { const src = String(document.querySelector('script[src*="app.js"]') ? '' : ''); return { cls: typeof lotBarInto === 'function' && /lot-swipe/.test(String(lotBarInto)) }; });
  log('Balayage dossier sans menu', sw); if (!sw.cls) throw new Error('lot-swipe KO');
  // ---- sous-lots, portée par niveau, abréviations, classement automatique, catalogue
  const sl = await A.pg.evaluate(() => { const o = {}; try { const hold = App.project, h2 = hold && hold.planLots, hv = hold && hold.catV;
    const P = { catV: 1, planLots: [{ id: 'a', name: 'Peinture', cat: 'CEA' }, { id: 'b', name: 'Finition', cat: 'CEA', up: 'a', only: ['f1'] }, { id: 'c', name: 'Autre' }] };
    App.project = P; o.kids = lotIdsWithKids(P, 'a').join(','); o.txt = planLotText({ lotId: 'b' });
    o.vis1 = lotsVis({ id: 'f1' }, P.planLots).map(l => l.id).join(','); o.vis2 = lotsVis({ id: 'f2' }, P.planLots).map(l => l.id).join(',');
    o.ab = typeAbOf('CFO', P); o.ab2 = abbrOf('Faux plafonds'); o.auto = (autoLotOf({ catV: 1, planLots: [{ id: 'go', name: 'Gros œuvre' }] }, 'PLAN COFFRAGE R+1') || {}).id;
    const N = { catV: 0, planLots: null }; const L = planLots(N); o.seedGo = (L.find(l => l.id === 'go') || {}).cat; o.seedRev = !!L.find(l => l.id === 'rev');
    o.fam = famOfType(P, 'GTB') + ',' + famOfType(P, 'CEA');
    App.project = hold; if (hold) { hold.planLots = h2; hold.catV = hv; } } catch (e) { o.err = String(e.message || e); } return o; });
  log('Sous-lots / niveaux / abréviations', sl);
  if (sl.err || sl.kids !== 'a,b' || sl.txt !== 'Peinture › Finition' || sl.vis1 !== 'a,b,c' || sl.vis2 !== 'a,c' || sl.ab !== 'CFO' || sl.ab2 !== 'FP' || sl.auto !== 'go' || sl.seedGo !== 'STR' || !sl.seedRev || sl.fam !== 'secu,archi') throw new Error('sous-lots KO ' + JSON.stringify(sl));
  // le panneau d'un lot doit se construire (régression : une erreur dedans bloquait « Sous-dossier » et « Plan ici »)
  const lpn = await A.pg.evaluate(async () => { const o = {}; try { const p = App.project, f = (await DB.byProject('folders', p.id)).find(x => !x.parentId); const L = planLots(p)[0];
    const el = lotPanel(L, f, document.body); o.ok = !!(el && el.classList && el.classList.contains('lot-panel')); } catch (e) { o.err = String(e.message || e); } return o; });
  log('Panneau de lot', lpn); if (lpn.err || !lpn.ok) throw new Error('lotPanel KO ' + JSON.stringify(lpn));
  // ---- v1.0.244 : sous-lots division + accordéon, échéance Planning ↔ pin, frise, Localisation
  const v244 = await A.pg.evaluate(async () => { const o = {}; try { const p = App.project, f = (await DB.byProject('folders', p.id)).find(x => !x.parentId);
    const hold = p.planLots; p.planLots = [{ id: 'a', name: 'Peinture', cat: 'CEA', e: '🎨', c: '#0ea5e9' }, { id: 'm', name: 'Finition', cat: 'CEA', up: 'a', only: [f.id], e: '🎨', c: '#0ea5e9' }, { id: 'z', name: 'Zone A', cat: 'CEA', up: 'a', only: [f.id], kind: 'div', e: '🎨', c: '#0ea5e9' }]; p.catV = 1;
    const host = document.createElement('div'); host.innerHTML = '<div class="folder-head"></div>'; document.body.appendChild(host); App.lotSel = App.lotSel || {}; App.lotSel[f.id] = 'a';
    lotBarInto(host, f, [], document.body); o.acc = !!host.querySelector('.lot-acc'); o.met = host.querySelectorAll('.acc-g')[0] ? host.querySelectorAll('.acc-g')[0].textContent.includes('Finition') : false; o.div = host.querySelectorAll('.acc-g')[1] ? host.querySelectorAll('.acc-g')[1].textContent.includes('Zone A') : false; host.remove(); p.planLots = hold;
    // échéance Planning → pin
    const L = await DB.put('links', { projectId: p.id, kind: 'local', planId: 'x', x: 1, y: 1, name: 'T', items: [], lots: {} });
    const P = planData(p); const t = { id: 'tk1', nom: 'Gros œuvre', deb: '2026-01-01', fin: '2026-02-01', ech: '2026-03-01', av: '0', pinId: L.id }; P.tasks.push(t); await syncTaskPin(p, t);
    o.due = (await DB.get('links', L.id)).due; await taskPatchFromPin(Object.assign(await DB.get('links', L.id), { taskId: 'tk1' }), { ech: '2026-04-01' }); o.ech = t.ech;
    P.tasks.splice(P.tasks.indexOf(t), 1);
    o.fr = ptFrise({ start: '2020-01-01', dueCo: '2020-02-01', due: '2020-03-01' }, (d) => d).includes('de retard');
    // Localisation
    const l = await Localisation.add(p, { name: 'Local test', niv: 'R+1' }); o.loc = Localisation.locs(p).some(z => z.id === l.id); p.locs = Localisation.locs(p).filter(z => z.id !== l.id); await DB.put('projects', p);
  } catch (e) { o.err = String(e.message || e) + ' | ' + String(e.stack || '').split('\n').slice(1,4).join(' / '); } return o; });
  log('v1.0.244 [sous-lots division, échéance, frise, localisation]', v244);
  const v245 = await A.pg.evaluate(async () => { const o = {}; try { const p = App.project; const v = { id: 'vz1', title: 'Test', at: '2099-01-01T10:00', aud: { k: 'svc', l: 'Qualité' }, room: 'abc12345', plans: [], agenda: '' }; Visio.list(p).push(v);
    const host = document.createElement('div'); document.body.appendChild(host); await Visio.render(host); o.card = host.querySelectorAll('.vz-c').length >= 1; o.url = Visio.roomUrl(v).startsWith('https://meet.jit.si/SiteTeam-abc12345'); host.remove(); p.visios = Visio.list(p).filter(z => z.id !== 'vz1'); await DB.put('projects', p); } catch (e) { o.err = String(e.message || e); } return o; });
  log('v1.0.246 [réunion en ligne]', v245);
  log('errors v1.0.246', !v245.err && v245.card && v245.url ? [] : ['v1.0.246 ' + JSON.stringify(v245)]);
  log('errors v1.0.244', !v244.err && v244.acc && v244.met && v244.div && v244.due === '2026-03-01' && v244.fr && v244.loc ? [] : ['v1.0.244 ' + JSON.stringify(v244)]);
  log('errors titre plan', []);
  // ---- suppression de compte (exigence Google Play) : le topographe D supprime son compte
  await D.pg.evaluate(() => { document.querySelectorAll('.fullpage,.es-page,.sheet-bg,.firebase-emulator-warning').forEach(x => x.remove()); Team.openCompany('me'); }); await D.pg.waitForTimeout(1500);
  await D.pg.$eval('[data-a=delacc]', (b) => { b.scrollIntoView(); b.click(); }); await D.pg.waitForTimeout(400); await shot(D.pg, '25_delete_confirm');
  await D.pg.click('.opt:has-text("Supprimer mon compte")'); await D.pg.waitForTimeout(400);
  await D.pg.fill('[name=pw]', 'secret123'); await D.pg.click('.sheet [data-a=ok]');
  await D.pg.waitForSelector('.opt:has-text("OK")', { timeout: 20000 }); log('D delete message', await D.pg.textContent('.sheet h3'));
  await D.pg.click('.opt:has-text("OK")'); await D.pg.waitForSelector('.tm-login', { timeout: 20000 });
  log('D after delete: login screen', await D.pg.locator('.tm-login').count());
  await A.pg.evaluate(() => Team.refreshMembers()); log('A members after D delete', await A.pg.evaluate(() => Team.members().map(m => m.name)));
  // le compte supprimé ne peut plus se connecter
  await D.pg.fill('[name=email]', 'topo@test.ma'); await D.pg.fill('[name=pw]', 'secret123'); await D.pg.click('[data-a=go]'); await D.pg.waitForTimeout(2500);
  log('D relogin', await D.pg.evaluate(() => document.querySelector('.sheet h3') ? document.querySelector('.sheet h3').textContent : 'pas de message'));
  log('errors', [...A.errs, ...B.errs, ...C.errs, ...D.errs]);
} catch (e) { log('FAIL', e.message.slice(0, 300)); try { for (const x of [A, B, C, D]) if (x) { log('ERRS', x.errs); await shot(x.pg, 'zz_fail_' + Math.random().toString(36).slice(2, 6)); } } catch (e2) {} }
await b.close();
