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
  await pg.addInitScript(() => { localStorage.setItem('askedName', '1'); localStorage.setItem('splash.sched', JSON.stringify({ mode: 'off' })); });
  await pg.goto(URL); await pg.waitForSelector('.tm-login', { timeout: 20000 });
  return { pg, errs, ctx };
}
async function signup(pg, name, email) {
  await pg.click('[data-m=up]'); await pg.fill('[name=name]', name); await pg.fill('[name=email]', email); await pg.fill('[name=pw]', 'secret123');
  await pg.click('[data-a=go]'); await pg.waitForSelector('.tm-choice', { timeout: 20000 });
}
const shot = (pg, n) => pg.screenshot({ path: `${O}/${n}.png` });
let A, B, C, D;
try {
  // ---- patron
  A = await newUser('A');
  await shot(A.pg, '01_login');
  await signup(A.pg, 'Abdessamad Patron', 'patron@test.ma');
  await shot(A.pg, '02_onboard');
  await A.pg.click('[data-a=create]'); await A.pg.waitForSelector('.st-packs'); await shot(A.pg, '02b_packs');
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
  B = await newUser('B');
  await signup(B.pg, 'Youssef Conducteur', 'youssef@test.ma');
  await B.pg.click('[data-a=join]'); await B.pg.fill('[name=code]', code1); await B.pg.click('.sheet [data-a=ok]');
  await B.pg.waitForSelector('.opt:has-text("Rejoindre")', { timeout: 15000 }); await shot(B.pg, 'B_confirm_code'); await B.pg.click('.opt:has-text("Rejoindre")');
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
  await C.pg.waitForSelector('.opt:has-text("Rejoindre")', { timeout: 15000 }); await shot(C.pg, 'C_confirm_code'); await C.pg.click('.opt:has-text("Rejoindre")');
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
  await A.pg.click('.tm-form [data-a=ok]'); await A.pg.waitForSelector('.sheet h3', { timeout: 15000 }); await A.pg.waitForTimeout(400);
  const code3 = (await A.pg.textContent('.sheet h3')).split(':').pop().trim(); await A.pg.click('.opt:has-text("Fermer")');
  D = await newUser('D'); await signup(D.pg, 'Karim Topo', 'topo@test.ma');
  await D.pg.click('[data-a=join]'); await D.pg.fill('[name=code]', code3); await D.pg.click('.sheet [data-a=ok]');
  await D.pg.waitForSelector('.opt:has-text("Rejoindre")', { timeout: 15000 }); await D.pg.click('.opt:has-text("Rejoindre")'); await D.pg.waitForSelector('.home2', { timeout: 20000 });
  // conducteur B : demande d'implantation + commande béton + rendement + pointage (via l'interface pour la 1re)
  await B.pg.evaluate(() => { document.querySelectorAll('.fullpage,.sheet-bg,.drawer,.drawer-bg').forEach(x => x.remove()); renderHome(); }); await B.pg.waitForTimeout(800);
  await shot(B.pg, '17_home_conducteur_espace');
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
  await E.pg.click('[data-a=perso]'); await E.pg.waitForSelector('.st-packs'); log('E packs proposés', await E.pg.evaluate(() => [...document.querySelectorAll('.st-packs [data-p]')].map(b => b.dataset.p)));
  await E.pg.click('[data-p=basic]'); await E.pg.waitForSelector('[name=role]'); await E.pg.selectOption('[name=role]', 'techqualite'); await shot(E.pg, '30_perso_metier');
  await E.pg.click('[data-a=go]'); await E.pg.waitForSelector('.home2', { timeout: 20000 }); await E.pg.waitForTimeout(800);
  await E.pg.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove())); await shot(E.pg, '31_perso_home');
  log('E espace', await E.pg.evaluate(() => [Team.isPerso(), Team.plan().k, Team.company().name, Team.me().role, Team.isAdmin(), Org.me() && Org.me().poste]));
  log('E outils basic', await E.pg.evaluate(() => [Team.canSection('tasks'), Team.canSection('reception'), featAllowed('reception')]));
  await E.pg.evaluate(async () => { await DB.put('projects', { name: 'Villa Hamid', type: 'villa', team: [] }); });
  await E.pg.evaluate(() => { window.__lim = Team.checkLimit('projects'); }); await E.pg.waitForTimeout(600);
  log('E limite projets', await E.pg.evaluate(() => (document.querySelector('.sheet h3') || {}).textContent || 'pas de message')); await shot(E.pg, '32_limite_basic');
  await E.pg.click('.opt:has-text("Fermer")'); log('E limite résultat', await E.pg.evaluate(() => window.__lim));
  F = await newUser('F'); await signup(F.pg, 'Sara BET', 'sara@test.ma');
  await F.pg.click('[data-a=create]'); await F.pg.waitForSelector('.st-packs'); await F.pg.click('[data-p=business]'); await F.pg.waitForSelector('.st-orgs');
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
