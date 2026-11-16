// Garde-fou : refuse toute écriture directe « $('…').onclick = » sans vérifier que l'élément existe.
// Un élément absent faisait planter le démarrage (« Cannot set properties of null »).
import { readdirSync, readFileSync } from 'node:fs';
const re = /(?<!\$)\$\((?:'[^']*'|"[^"]*")(?:,\s*\w+)?\)\.onclick/g;
let bad = 0;
for (const f of readdirSync('www/js').filter(x => x.endsWith('.js'))) {
  readFileSync('www/js/' + f, 'utf8').split('\n').forEach((l, i) => {
    re.lastIndex = 0;
    if (re.test(l)) { bad++; console.log(`www/js/${f}:${i + 1} : ${l.trim().slice(0, 140)}`); }
  });
}
// catalogue v2 : preuves existantes, ids uniques, décisions Finance/HSE (même logique que Catalog.check, côté Node)
import { existsSync } from 'node:fs';
{ const man = JSON.parse(readFileSync('www/assets/catalog.json', 'utf8')), seen = new Set(), PK = ['basic', 'pro', 'business', 'enterprise'];
  const e = (m) => { bad++; console.log('catalog.json : ' + m); };
  if (man.schemaVersion !== 2) e('schemaVersion ≠ 2');
  for (const m of man.modules) for (const f of (m.features || [])) {
    if (seen.has(f.id)) e('id dupliqué ' + f.id); seen.add(f.id);
    if (!PK.includes(f.packMin)) e(f.id + ' packMin invalide');
    if (f.status !== 'a_developper' && !(f.evidence || []).length) e(f.id + ' sans preuve');
    for (const p of (f.evidence || [])) if (!existsSync(p)) e(f.id + ' preuve introuvable ' + p);
    if (m.id === 'finance' && f.tier === 'avancee' && f.packMin !== 'enterprise') e(f.id + ' Finance avancée = Enterprise');
    if (m.id === 'hse' && f.tier === 'collaboratif' && f.packMin !== 'business') e(f.id + ' HSE collaboratif = Business');
  } }
if (bad) { console.log(`\n${bad} ligne(s) à corriger : utiliser ($('…')||{}).onclick ou un if.`); process.exit(1); }
console.log('Garde-fous OK');
