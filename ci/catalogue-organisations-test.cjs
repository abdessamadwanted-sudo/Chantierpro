// Tests isolés du catalogue ; exécution : node ci/catalogue-organisations-test.cjs
'use strict';
const assert = require('node:assert/strict');
const cat = require('../www/js/catalogue-organisations.js');
const expected = ['entreprise','bet','archi','bc','labo','opc','moa','topo'];
assert.deepEqual(cat.organisationTypes().map(x => x.id), expected);
for (const type of expected) {
  const services = cat.servicesFor(type);
  assert.ok(services.length > 0, type + ' sans service');
  assert.ok(services.every(s => s.id && s.label), type + ' : libellé absent');
  assert.equal(cat.selectionValide(type, services.map(s => s.id)), true);
  assert.equal(cat.selectionValide(type, [services[0].id,services[0].id]), false);
  assert.equal(cat.selectionValide(type, ['service_inconnu']), false);
}
assert.deepEqual(cat.servicesFor('inconnu'), []);
assert.equal(cat.selectionValide('inconnu', []), false);
assert.equal(cat.selectionValide('entreprise', 'travaux'), false);
console.log('Catalogue organisations : tests OK');
