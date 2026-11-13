// Independent, dependency-free contract tests for SiteTeam Pack Manager.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync('www/js/pack-manager.js', 'utf8'), sandbox);
const P = sandbox.module.exports;
const catalog = {
  basic: { k: 'basic', modules: ['projet', 'plans'], users: 1, org: { users: 5 } },
  pro: { k: 'pro', modules: ['projet', 'plans', 'forms'], users: 1 },
  business: { k: 'business', modules: '*', users: 15 },
  enterprise: { k: 'enterprise', modules: '*', users: 0 }
};
const mods = ['projet', 'plans', 'forms', 'qualite'];
assert.equal(P.keyOf('personnel'), 'pro');
assert.equal(P.keyOf('entreprise'), 'enterprise');
assert.equal(P.getPlan(catalog, 'unknown'), null);
assert.equal(P.includesModule(catalog, 'unknown', 'personnel', 'projet', mods), false);
assert.equal(P.includesModule(catalog, 'basic', 'personnel', 'qualite', mods), false);
assert.equal(P.includesModule(catalog, 'pro', 'personnel', 'forms', mods), true);
assert.equal(P.includesModule(catalog, 'business', 'organisation', 'qualite', mods), true);
assert.equal(P.quota(catalog, 'basic', 'personnel', 'users'), 1);
assert.equal(P.quota(catalog, 'basic', 'organisation', 'users'), 5);
assert.deepEqual(Array.from(P.features(catalog, 'business', 'organisation', mods)), mods);
assert.equal(P.matrix(catalog, mods, 'organisation').find(x => x.module === 'qualite').basic, false);
assert.equal(catalog.basic.users, 1, 'must not mutate source plans');
console.log('Pack Manager contract: OK (12 assertions)');
