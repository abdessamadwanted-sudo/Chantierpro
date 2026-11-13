// node ci/feature-matrix-v2.test.mjs — isolated tests without Firebase.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const box = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync('www/js/feature-matrix-v2.js', 'utf8'), box);
const M = box.module.exports;
const plans = {
  basic: { perso: true, modules: ['projet', 'photos'], feats: [] },
  pro: { perso: true, orgOffer: false, modules: ['projet', 'photos', 'forms'], feats: ['pdf'] },
  business: { modules: '*', feats: '*' },
  enterprise: { modules: '*', feats: '*' }
};
const args = {
  plans, mods: [['projet','Projet'],['photos','Photos'],['forms','PV']],
  premium: [['pdf','Outils PDF']], flagDefs: { svcqual: 'Service Qualité', missionzone: 'Mission/zone' },
  fp: { svcqual: { enterprise: 'pub', business: 'test', basic: 'dev' }, missionzone: { enterprise: 'dev' } }
};
const rows = M.makeRows(args);
const get = id => rows.find(x => x.id === id);
assert.equal(rows.length, 6);
assert.equal(get('module:forms').packs.basic, 'excluded');
assert.equal(get('module:forms').packs.pro, 'excluded'); // Pro not offered for organisations
assert.equal(get('module:forms').packs.business, 'included');
assert.equal(get('premium:pdf').packs.basic, 'excluded');
assert.equal(get('release:svcqual').packs.enterprise, 'pub');
assert.equal(get('release:svcqual').packs.pro, 'absent');
assert.equal(get('release:missionzone').packs.business, 'absent');
assert.equal(M.makeRows({ ...args, scope: 'personnel' }).find(x => x.id === 'module:forms').packs.pro, 'included');
assert.equal(M.rolloutAllows({ setting: 'pub' }), true);
assert.equal(M.rolloutAllows({ setting: 'test' }), false);
assert.equal(M.rolloutAllows({ setting: 'test', tester: true }), true);
assert.equal(M.rolloutAllows({ setting: 'dev', isSuper: true }), true);
assert.equal(M.rolloutAllows({ setting: '', isSuper: true }), false);
assert.deepEqual(Array.from(M.audit(args)), []);
assert.ok(M.audit({ ...args, fp: { svcqual: { basic: 'preview' } } }).length);
assert.ok(M.audit({ ...args, fp: { unknown: { basic: 'pub' } } }).length);
assert.equal(plans.pro.orgOffer, false, 'source plans must stay unchanged');
console.log('Feature Matrix V2: 17 tests OK');
