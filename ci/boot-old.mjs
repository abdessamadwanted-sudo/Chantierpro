// Diagnostic : ouverture de l'application avec les ANCIENNES règles Firestore (celles de la production si elles n'ont pas été publiées)
import { chromium } from 'playwright';
import fs from 'fs';
const O = 'ci-out'; const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); fs.appendFileSync(O + '/boot.txt', s + '\n'); };
const rules = fs.readFileSync('ci/old13.rules', 'utf8');
const r = await fetch('http://127.0.0.1:8080/emulator/v1/projects/siteteam:securityRules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: rules }] } }) });
log('anciennes règles chargées', r.status);
const b = await chromium.launch();
for (const [port, tag] of [[8765, 'v1.0.20'], [8766, 'v1.0.21']]) for (const [email, who] of [['patron@test.ma', 'A'], ['karima@test.ma', 'H'], ['nadia@test.ma', 'G']]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 } }); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 300)); });
  pg.on('dialog', d => d.accept());
  await pg.addInitScript(() => { localStorage.setItem('askedName', '1'); localStorage.setItem('splash.sched', JSON.stringify({ mode: 'off' })); });
  try {
    await pg.goto(`http://127.0.0.1:${port}/?emu=1`); await pg.waitForSelector('.tm-login', { timeout: 20000 });
    await pg.fill('[name=email]', email); await pg.fill('[name=pw]', 'secret123'); await pg.click('[data-a=go]');
    await pg.waitForTimeout(9000);
    log(tag, who, 'accueil affiché', await pg.locator('.home2').count(), 'texte', (await pg.evaluate(() => document.body.innerText.slice(0, 120))).replace(/\s+/g, ' '));
    await pg.evaluate(() => { try { return Sync.run({ force: true }); } catch (e) { return String(e); } }); await pg.waitForTimeout(3000);
    await pg.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()); App.project = null; return renderHome(); }).catch(e => errs.push('renderHome: ' + e.message));
    await pg.waitForTimeout(1500); log(tag, who, 'après synchro, accueil', await pg.locator('.home2').count());
    await pg.screenshot({ path: `${O}/boot_${tag}_${who}.png` });
  } catch (e) { log(tag, who, 'FAIL', e.message.slice(0, 200)); try { await pg.screenshot({ path: `${O}/boot_${tag}_${who}_fail.png` }); } catch (e2) {} }
  log(tag, who, 'erreurs', errs);
  await ctx.close();
}
await b.close();
