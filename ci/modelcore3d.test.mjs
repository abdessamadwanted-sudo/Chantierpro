import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const templates = fs.readFileSync('www/js/modelcore3d-templates.js', 'utf8');
const code = fs.readFileSync('www/js/modelcore3d.js', 'utf8');
const context = { window: {} };
vm.runInNewContext(templates, context, { filename: 'modelcore3d-templates.js', timeout: 5000 });
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

// Le moteur n'est pas réservé aux stades : chaque famille est générée et validée.
const families = ['stade','hopital','immeuble','villa','pont','vrd','industriel','batiment'];
for (const family of families) {
  const manifest = M.demo(family);
  const out = M.validateManifest(manifest);
  assert.ok(out.length > 10, family + ': plus de 10 éléments distincts');
  assert.equal(new Set(out.map(e=>e.id)).size, out.length, family + ': identifiants uniques');
  assert.ok(out.every(e=>e.geometry && e.type && e.level && e.zone), family + ': objets classés');
  assert.ok(out.some(e=>e.building && e.lot), family + ': bâtiment et lot présents');
}
assert.equal(context.window.ModelCoreTemplates.normalize('Hôpital CHU'), 'hopital');
assert.equal(context.window.ModelCoreTemplates.normalize('Ouvrage d’art — pont'), 'pont');
assert.equal(context.window.ModelCoreTemplates.normalize('Bâtiment inconnu'), 'batiment');
const custom=M.validateManifest({schema:M.schema,elements:[{
  id:'IFC-OTH-42',type:'Pieu foré',building:'Ouvrage B',lot:'Fondations',zone:'Sud',level:'-2',
  geometry:{kind:'box',size:[1,1,5],position:[0,0,0]}
}]});
assert.equal(custom[0].type,'Pieu foré','catégorie IFC libre conservée');
console.log('ModelCore 3D multi-projets OK — '+families.join(', '));
