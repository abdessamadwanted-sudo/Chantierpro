// Verdict des tests SiteTeam : le workflow échoue (et aucun APK n'est construit) si un seul test échoue.
import fs from 'fs';
const rd = (f) => { try { return fs.readFileSync('ci-out/' + f, 'utf8'); } catch (e) { return ''; } };
const R = rd('rules-test.txt'), D = rd('db-test.txt'), L = rd('log.txt'), bad = [];
if (!/TOUT OK — \d+ vérifications/.test(R)) bad.push('Règles Firestore / Storage : ' + ((R.match(/^FAIL .*$/gm) || ['résultat absent']).slice(0, 10).join(' ; ')));
if (!/TOUT OK — \d+ vérifications/.test(D)) bad.push('Base locale (IndexedDB) : ' + ((D.match(/^FAIL .*$/gm) || ['résultat absent']).slice(0, 10).join(' ; ')));
if (!L.trim()) bad.push('Parcours complet : résultat absent');
for (const l of L.split('\n')) {
  if (/^FAIL\b/.test(l) || /ALLOWED \(BAD\)/.test(l)) bad.push('Parcours complet : ' + l.slice(0, 300));
  if (/^errors v[\d.]+ \[(?!\])/.test(l)) bad.push('Erreurs JavaScript : ' + l.slice(0, 300));
}
const sum = bad.length ? `❌ ${bad.length} problème(s)\n- ` + bad.join('\n- ') : `✅ Tous les tests sont passés\n${(R.match(/TOUT OK — \d+ vérifications/) || [''])[0]} (règles) · ${(D.match(/TOUT OK — \d+ vérifications/) || [''])[0]} (base locale) · parcours complet sans erreur`;
console.log(sum);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Tests SiteTeam\n\n' + sum.replace(/\n- /g, '\n- ') + '\n');
process.exit(bad.length ? 1 : 0);
