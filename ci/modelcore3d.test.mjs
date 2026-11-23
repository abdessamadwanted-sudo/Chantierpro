import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync('www/js/modelcore3d.js', 'utf8');
const context = { window: {} };
vm.runInNewContext(code, context, { filename: 'modelcore3d.js', timeout: 5000 });
const M = context.window.ModelCore3D;
assert.ok(M && typeof M.open === 'function');
assert.equal(M.schema, 'siteteam-modelcore-v1');
const demo = M.demo();
const elements = M.validateManifest(demo);
assert.ok(elements.length > 350, 'Stade has individual volumetric elements');
assert.equal(new Set(elements.map(x => x.id)).size, elements.length, 'IDs are unique');
for (const type of ['Terrain', 'Gradin', 'Escalier', 'Poteau', 'Poutre', 'Voile', 'Charpente'])
  assert.ok(elements.some(x => x.type === type), type + ' present');
assert.ok(elements.some(x => x.type === 'Poutre' && x.geometry.kind === 'beam'), 'Poutre inclinée supported');
assert.ok(elements.some(x => x.type === 'Gradin' && x.geometry.kind === 'mesh'), 'Solid mesh gradins');
const specimen = {
  schema: M.schema, elements: [{
    id: 'IFC-OUVR-001', type: 'Poutre', zone: 'Nord', level: 'R+2',
    sourceFormat: 'IFC', sourceId: '3F3rDummyGuid', modelVersion: 'v2',
    geometry: { kind: 'beam', start: [0, 3.2, 0], end: [6, 4.1, 0], width: 0.4, depth: 0.65 }
  }]
};
const parsed = M.validateManifest(specimen);
assert.equal(parsed[0].sourceId, '3F3rDummyGuid');
assert.equal(parsed[0].geometry.end[1], 4.1);
assert.throws(() => M.validateManifest({...specimen, elements:[specimen.elements[0], specimen.elements[0]]}), /dupliqué/);
assert.throws(() => M.validateManifest({...specimen, elements:[{...specimen.elements[0],geometry:{kind:'box',position:[0,0,0],size:[0,2,3]}}]}), /invalides/);
assert.throws(() => M.validateManifest({schema:M.schema,elements:[]}), /invalide/);
console.log('ModelCore 3D schema + demo tests OK — ' + elements.length + ' ouvrages.');
