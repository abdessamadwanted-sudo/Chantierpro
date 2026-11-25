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

 // ModelCore X : contrat géométrique, résidence et indépendance métier.
const twin=M.validateManifest(M.demo('immeuble'));
assert.deepEqual([...new Set(twin.map(x=>x.building))].sort(),['Bloc A','Bloc B']);
for(const block of ['Bloc A','Bloc B']){
  for(const level of ['RDC','R+1','R+2','R+3','R+4','R+5','R+6'])
    assert.ok(twin.some(x=>x.building===block&&x.level===level&&x.type==='Poteau'));
  for(const lot of ['Fondations','Gros œuvre','Architecture','Ferraillage','CFO/CFA','Plomberie','CVC'])
    assert.ok(twin.some(x=>x.building===block&&x.lot===lot));
}
assert.equal(M.suiviInitial,undefined,'Le moteur ne crée aucun état métier par service');
assert.ok(!code.includes('data-role="service"'),'Aucun sélecteur de service métier');
assert.match(M.ficheGeometrique({kind:'box',size:[2,3,4]}),/24\.000 m³/);
assert.match(M.ficheGeometrique({kind:'beam',start:[0,0,0],end:[3,4,0],width:.4,depth:.5}),/5\.00 m/);
assert.match(M.ficheGeometrique({kind:'mesh',positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2]}),/3 sommets · 1 triangles/);
const generated=M.validateManifest(M.maquetteParametrique({hauteur:3.2,epaisseur:.25,niveaux:3,entraxe:5}));
assert.equal(generated.length,105);
assert.equal(generated.filter(x=>x.type==='Poteau').length,36);
assert.throws(()=>M.maquetteParametrique({hauteur:0,epaisseur:.25,niveaux:3,entraxe:5}),/limites/);
console.log('ModelCore X — résidence, fiche géométrique et génération paramétrique OK.');

 // OCR : les valeurs sont des propositions explicites, jamais inventées.
const cotes=M.suggestionsPlan("Hauteur d'étage : 3,20 m ; Épaisseur de dalle : 250 mm ; Entraxe : 500 cm");
assert.equal(cotes.hauteur.value,3.2);assert.equal(cotes.epaisseur.value,25);assert.equal(cotes.entraxe.value,5);
assert.ok(cotes.hauteur.evidence.includes('3,20'));
assert.equal(M.suggestionsPlan('Hauteur étage 3,20').hauteur,undefined);
assert.equal(M.suggestionsPlan('Hauteur étage 3 m ; Hauteur étage 4 m').hauteur,undefined);
assert.equal(M.suggestionsPlan('Épaisseur dalle 4 m').epaisseur,undefined);
assert.equal(Object.keys(M.suggestionsPlan('D01 P02 3.20 25')).length,0);
console.log('ModelCore AI — extraction de cotes et rejet des ambiguïtés OK.');
