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
  await B.pg.evaluate(() => { const n = document.querySelector('.st-bnav [data-n=tools]'); if (n) n.click(); }); await B.pg.waitForTimeout(300);
  await B.pg.click('[data-es=impl]'); await B.pg.waitForTimeout(500); await B.pg.click('.es-page .fab'); await B.pg.waitForTimeout(400);
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
  await D.pg.evaluate(() => { const n = document.querySelector('.st-bnav [data-n=tools]'); if (n) n.click(); }); await D.pg.waitForTimeout(300);
  await D.pg.click('[data-es=impl]'); await D.pg.waitForTimeout(500); await D.pg.click('.es-row'); await D.pg.waitForTimeout(500);
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
  await F.pg.click('[data-a=st-ws]'); await F.pg.waitForSelector('.st-wsl'); await shot(F.pg, '42_switcher');
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
  await I.pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); App.project = null; renderHome(); }); await I.pg.waitForTimeout(800); await shot(I.pg, '63_dash_technicien');
  log('I tableau de bord', await I.pg.evaluate(() => [Team.me().role, [...document.querySelectorAll('.st-mis')].map(x => x.textContent.trim()), !!document.querySelector('[data-stq]')]));
  // PV : le technicien rédige et soumet, l'administrateur valide
  await I.pg.evaluate(async () => { const p = (await DB.all('projects'))[0]; window.__pv = await DB.put('forms', { projectId: p.id, templateId: 'x', title: 'Réception ferraillage P2', location: 'Pile P2', date: todayISO(), inspector: '', notes: '', aut: Team.uid(), vst: 'brouillon', items: [{ label: 'Diamètres conformes', res: 'ok', comment: '' }], photoIds: [] }); openFormDetail(window.__pv); });
  await I.pg.waitForSelector('[data-v=soumettre]', { timeout: 10000 }); await shot(I.pg, '64_pv_brouillon');
  log('I peut valider son PV', await I.pg.evaluate(() => !!document.querySelector('[data-v=valider]')));
  await I.pg.click('[data-v=soumettre]'); await I.pg.waitForTimeout(2500); await I.pg.evaluate(() => Sync.run({ force: true })); await I.pg.waitForTimeout(2000);
  await H.pg.evaluate(() => Sync.run({ force: true })); await H.pg.waitForTimeout(2500);
  await H.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.project = null; renderHome(); }); await H.pg.waitForTimeout(1500); await shot(H.pg, '65_dash_validation');
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
  await A.pg.click('[data-a=homemore]'); await A.pg.waitForSelector('.gm'); await shot(A.pg, '103_menu_accueil');
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
  await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); App.project = null; renderHome(); }); await A.pg.waitForSelector('.st-dir', { timeout: 15000 });
  await A.pg.waitForFunction(() => !document.querySelector('.st-kpi b') || document.querySelector('.st-kpi b').textContent !== '…', null, { timeout: 15000 }); await A.pg.waitForTimeout(600);
  await shot(A.pg, '107_vue_direction');
  log('Vue Direction (A, Business)', await A.pg.evaluate(() => [Team.taille(), document.querySelector('.st-dir-hero b').textContent, document.querySelectorAll('.st-kpi').length, [...document.querySelectorAll('.st-kpi b')].every(b => b.textContent !== '…'), !!document.querySelector('.st-perf-c svg'), document.querySelectorAll('.st-svc2').length > 0, document.documentElement.classList.contains('th-st'), document.querySelectorAll('.st-bnav button').length]));
  await A.pg.evaluate(() => document.querySelector('.h2-body').scrollTo(0, 99999)); await A.pg.waitForTimeout(400); await shot(A.pg, '108_vue_direction_bas');
  log('Free (E) : pas de Vue Direction, barre du bas', await E.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg').forEach(x => x.remove()); App.project = null; renderHome(); return new Promise(r => setTimeout(() => r([Team.taille(), !!document.querySelector('.st-dir'), [...document.querySelectorAll('.st-bnav span')].map(x => x.textContent)]), 800)); }));
  await shot(E.pg, '109_free_ui_kit');
  // fil d'Ariane : Entreprise › Projet, retour au tableau de bord
  await A.pg.evaluate(async () => { await openProject((await DB.all('projects'))[0]); document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); App.section = 'tasks'; await renderSection(); }); await A.pg.waitForTimeout(600);
  log('fil d\'Ariane', await A.pg.evaluate(() => [!!document.querySelector('.tb-crumb a'), (document.querySelector('.tb-crumb') || {}).textContent, document.getElementById('app').classList.contains('with-bnav')]));
  await shot(A.pg, '110_fil_ariane');
  await A.pg.click('.tb-crumb a'); await A.pg.waitForSelector('.st-dir', { timeout: 10000 }); log('fil d\'Ariane → tableau de bord', await A.pg.evaluate(() => !App.project));
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
  await B.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); App.project = null; renderHome(); }); await B.pg.waitForSelector('[data-stsvc]', { timeout: 15000 });
  await B.pg.waitForFunction(() => [...document.querySelectorAll('[data-stsvc] .st-kpi b')].every(b => b.textContent !== '…'), null, { timeout: 15000 }); await B.pg.waitForTimeout(500);
  await shot(B.pg, '112_service_dashboard');
  log('tableau de bord service (B)', await B.pg.evaluate(() => [document.querySelector('[data-stsvc] .st-dir-hero b').textContent, document.querySelectorAll('[data-stsvc] .st-kpi').length, document.querySelectorAll('.st-tcat').length > 0, document.querySelectorAll('.st-tool').length > 0]));
  await B.pg.evaluate(() => { App.homeTab = 'tools'; renderHome(); }); await B.pg.waitForTimeout(600); await shot(B.pg, '113_outils_categories');
  await B.pg.click('.st-bnav [data-n=tools]'); await B.pg.waitForTimeout(300);
  await B.pg.locator('.st-tool').first().click(); await B.pg.waitForTimeout(800); const sel = await B.pg.$('.opt'); if (sel) { await sel.click(); await B.pg.waitForTimeout(1200); }
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
  log('onglets : accueil', await A.pg.evaluate(() => [document.querySelector('.h2-tab.on').dataset.tab, document.querySelectorAll('.h2-tab.on .h2-card').length <= 2, [...document.querySelectorAll('.st-bnav span')].map(x => x.textContent)]));
  await A.pg.click('.st-bnav [data-n=proj]'); await A.pg.waitForTimeout(400); await shot(A.pg, '121_onglet_projets');
  log('onglets : projets', await A.pg.evaluate(() => [document.querySelector('.h2-tab.on').dataset.tab, document.querySelectorAll('.h2-tab.on .h2-card').length]));
  await A.pg.click('.st-bnav [data-n=tools]'); await A.pg.waitForTimeout(400); await shot(A.pg, '122_onglet_outils');
  const cat = await A.pg.evaluate(() => document.querySelectorAll('.h2-tab.on .st-tcats [data-cat]')[2].dataset.cat);
  await A.pg.click(`.h2-tab.on .st-tcats [data-cat="${cat}"]`); await A.pg.waitForTimeout(300); await shot(A.pg, '123_outils_categorie');
  log('outils : catégorie en boutons', await A.pg.evaluate(() => [...document.querySelectorAll('.h2-tab.on .st-tcat')].filter(t => t.style.display !== 'none').length, cat));
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
  // ---- v1.0.15 : tablette et ordinateur
  for (const [w, h, n] of [[820, 1180, '45_tablette'], [1280, 800, '46_desktop']]) {
    await A.pg.setViewportSize({ width: w, height: h }); await A.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); App.project = null; renderHome(); }); await A.pg.waitForTimeout(1200); await shot(A.pg, n);
  }
  await A.pg.setViewportSize({ width: 390, height: 800 });
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
