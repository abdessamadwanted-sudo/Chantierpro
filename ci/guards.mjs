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
if (bad) { console.log(`\n${bad} ligne(s) à corriger : utiliser ($('…')||{}).onclick ou un if.`); process.exit(1); }
console.log('Garde-fous OK');
