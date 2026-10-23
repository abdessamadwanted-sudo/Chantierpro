// Test du stockage local (www/js/db.js) dans Chromium : écritures, et reprise après une connexion
// IndexedDB fermée par le système (« The database connection is closing »). Résultat : ci-out/db-test.txt
import { chromium } from 'playwright';
import fs from 'fs';

const O = 'ci-out'; fs.mkdirSync(O, { recursive: true });
const out = []; let fails = 0;
const log = (s) => { console.log(s); out.push(s); };
const b = await chromium.launch();
const pg = await (await b.newContext()).newPage();
await pg.goto('http://127.0.0.1:8765/?emu=1');
await pg.waitForFunction(() => typeof DB !== 'undefined', null, { timeout: 20000 });

const cases = [
  ['écriture / lecture / suppression', async () => {
    const p = await DB.put('projects', { name: 'Test DB' });
    const t = await DB.put('tasks', { projectId: p.id, title: 'T1' });
    const ok1 = (await DB.get('projects', p.id)).name === 'Test DB' && (await DB.byProject('tasks', p.id)).length === 1;
    await DB.del('tasks', t.id);
    const ok2 = (await DB.byProject('tasks', p.id)).length === 0 && !!(await DB.get('tomb', 'tasks:' + t.id));
    return ok1 && ok2;
  }],
  ['connexion fermée une fois → réouverture automatique', async () => {
    const orig = IDBDatabase.prototype.transaction; let n = 0;
    IDBDatabase.prototype.transaction = function (...a) { if (n++ === 0) this.close(); return orig.apply(this, a); };
    try { const r = await DB.put('projects', { name: 'Après fermeture' }); return (await DB.get('projects', r.id)).name === 'Après fermeture'; }
    finally { IDBDatabase.prototype.transaction = orig; }
  }],
  ['connexion fermée deux fois de suite → 3e essai réussi', async () => {
    const orig = IDBDatabase.prototype.transaction; let n = 0;
    IDBDatabase.prototype.transaction = function (...a) { if (n++ < 2) this.close(); return orig.apply(this, a); };
    try { const r = await DB.put('tasks', { projectId: 'x', title: 'Essai 3' }); return (await DB.get('tasks', r.id)).title === 'Essai 3' && n >= 3; }
    finally { IDBDatabase.prototype.transaction = orig; }
  }],
  ['fermeture permanente → erreur claire après 3 essais (pas de boucle infinie)', async () => {
    const orig = IDBDatabase.prototype.transaction; let n = 0;
    IDBDatabase.prototype.transaction = function (...a) { n++; this.close(); return orig.apply(this, a); };
    try { await DB.put('tasks', { projectId: 'x', title: 'jamais' }); return false; }
    catch (e) { return e.name === 'InvalidStateError' && n === 3; }
    finally { IDBDatabase.prototype.transaction = orig; }
  }],
  ['mémoire pleine → pas de nouvel essai', async () => {
    const orig = IDBDatabase.prototype.transaction; let n = 0;
    IDBDatabase.prototype.transaction = function () { n++; throw new DOMException('plein', 'QuotaExceededError'); };
    try { await DB.put('tasks', { projectId: 'x', title: 'q' }); return false; }
    catch (e) { return e.name === 'QuotaExceededError' && n === 1; }
    finally { IDBDatabase.prototype.transaction = orig; }
  }],
  ['autre onglet/version qui supprime la base → la connexion se libère et se rouvre', async () => {
    await DB.put('projects', { name: 'avant' });
    const del = await new Promise((r) => { const q = indexedDB.deleteDatabase('chantier'); q.onsuccess = () => r('ok'); q.onerror = () => r('err'); q.onblocked = () => setTimeout(() => r('blocked'), 3000); });
    const p = await DB.put('projects', { name: 'après' });
    return del === 'ok' && (await DB.get('projects', p.id)).name === 'après';
  }],
  ['fichier (Blob) enregistré puis relu', async () => {
    const f = await DB.putRaw('files', { id: 'blob1', projectId: 'x', blob: new Blob([new Uint8Array(200000)], { type: 'image/jpeg' }) });
    const r = await DB.all('files'); const g = r.find(x => x.id === 'blob1');
    return !!f && g && g.blob && g.blob.size === 200000;
  }],
];

for (const [name, fn] of cases) {
  try { const ok = await pg.evaluate(fn); if (ok) log('OK   ' + name); else { fails++; log('FAIL ' + name); } }
  catch (e) { fails++; log('FAIL ' + name + ' :: ' + String(e.message || e).split('\n')[0]); }
}
log(`\n${fails ? fails + ' ÉCHEC(S)' : 'TOUT OK'} — ${cases.length} vérifications`);
fs.writeFileSync(O + '/db-test.txt', out.join('\n') + '\n');
await b.close();
process.exit(fails ? 1 : 0);
