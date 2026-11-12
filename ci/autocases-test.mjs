// Tests de la détection des cases (node ci/autocases-test.mjs) : logique pure, sans pdf.js ni OCR.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync('www/js/autocases.js', 'utf8'), ctx);
const A = ctx.window.AutoCases, W = 595, H = 842;
const w = (t, x, y, wd = t.length * 6, h = 10) => ({ t, x, y, w: wd, h });
// bon type : « DATE : », « ZONE ……… », « OUVRAGE : ……… », cellules « NOM : / VISA : »
const mots = [
  w('DATE', 380, 100), w(':', 410, 100, 4), w('AREA:', 40, 140), w('ZONE', 40, 170), w('..................', 80, 170, 150),
  w('OUVRAGE:', 40, 200), w('.........................', 110, 200, 200), w('TYPE DE BETON:', 40, 230, 80),
  w('NOM:', 40, 300), w('VISA:', 40, 330), w('Tableau', 40, 400), w('Page 1', 500, 800),
  w('Ceci est une phrase normale sans intitulé du tout', 40, 500, 280),
];
const r = A.depuisMots(mots, W, H), lab = r.map(c => c.label);
for (const l of ['Date', 'Area', 'Zone', 'Ouvrage', 'Type de beton', 'Nom', 'Visa']) assert.ok(lab.includes(l), 'manque ' + l + ' dans ' + lab);
assert.ok(!lab.includes('Tableau') && !lab.some(l => /phrase/i.test(l)), 'faux positifs : ' + lab);
const zone = r.find(c => c.label === 'Zone'); assert.ok(zone.x >= 79 && zone.w >= 140, 'la case Zone suit la ligne de points');
for (const c of r) { assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= W && c.y + c.h <= H, 'case hors page : ' + c.label); assert.ok(c.w >= 28 && c.h >= 14); }
assert.equal(A.depuisMots([], W, H).length, 0);
assert.equal(A.depuisMots(null, W, H).length, 0);
// colonnes d'un suivi : seules les correspondances sont gardées
const cols = [{ id: 'zone', libelle: 'Zone' }, { id: 'ouv', libelle: 'Ouvrage' }, { id: 'prix', libelle: 'Prix' }];
const vc = A.versColonnes(r, cols); assert.equal(vc.map(c => c.col).sort().join(), 'ouv,zone');
// pas de doublon avec des cases déjà placées
assert.equal(A.nouvelles(r, r).length, 0); assert.equal(A.nouvelles(r, []).length, r.length);
console.log('autocases OK', lab.join(', '));
