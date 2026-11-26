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

// ModelCore X : un geste tactile ne sélectionne jamais un ouvrage par erreur.
const gesture=M.gesteSelection();
const finger=(pointerId,clientX,clientY,button=0)=>({pointerId,clientX,clientY,button});
gesture.down(finger(1,10,10));assert.equal(gesture.up(finger(1,12,11)),true);
gesture.down(finger(1,10,10));gesture.move(finger(1,90,10));gesture.move(finger(1,10,10));assert.equal(gesture.up(finger(1,10,10)),false,'rotation avec retour au point initial');
gesture.down(finger(1,10,10));gesture.down(finger(2,50,50));gesture.move(finger(2,80,80));assert.equal(gesture.up(finger(2,80,80)),false);assert.equal(gesture.up(finger(1,10,10)),false,'fin du pincement sans sélection');
gesture.down(finger(1,10,10));gesture.cancel(finger(1,10,10));assert.equal(gesture.up(finger(1,10,10)),false);
gesture.down(finger(1,10,10,2));assert.equal(gesture.up(finger(1,10,10,2)),false);
gesture.down(finger(3,10,10));assert.equal(gesture.up(finger(3,10,10)),true,'tap après un geste multiple');
assert.ok(code.includes('controls.enablePan=false'));
assert.ok(code.includes('controls.target.copy(projectCenter)'));
assert.ok(code.includes('controls.touches.TWO=T.TOUCH.DOLLY_PAN'));
console.log('ModelCore X — sélection tactile, pincement et pivot projet : garde-fous OK.');

// Coupes continues : bornes, inversion et filtrage des intersections raycast.
const h=M.coupeParametres(-2,22,50);
assert.equal(h.normal,-1);assert.ok(Math.abs(h.position-10)<1e-8);
const v=M.coupeParametres(100,120,25);
assert.ok(Math.abs(v.position-115)<.001);
const inv=M.coupeParametres(100,120,25,true);
assert.equal(inv.normal,1);assert.ok(Math.abs(inv.position-105)<.001);
assert.ok(M.coupeParametres(100,120,0).position>120);
assert.ok(M.coupeParametres(100,120,100).position<100);
assert.ok(M.coupeParametres(100,120,0,true).position<100);
assert.ok(M.coupeParametres(100,120,100,true).position>120);
assert.throws(()=>M.coupeParametres(10,0,50),/Bornes/);
const planes=[{normal:{x:0,y:-1,z:0},constant:10},{normal:{x:-1,y:0,z:0},constant:115}];
assert.equal(M.pointDansCoupe({x:110,y:5,z:0},planes),true);
assert.equal(M.pointDansCoupe({x:110,y:12,z:0},planes),false);
assert.equal(M.pointDansCoupe({x:118,y:5,z:0},planes),false);
assert.equal(M.pointDansCoupe({x:1000,y:1000,z:0},[]),true);
assert.ok(code.includes('renderer.clippingPlanes=planes'),'Découpe de triangles par le moteur WebGL');
assert.ok(code.includes('.find(h=>pointDansCoupe(h.point,renderer.clippingPlanes))'),'Pas de sélection derrière une surface découpée');
console.log('ModelCore X — coupes H/V, inversion et raycast : tests OK.');

// Déplacement à deux doigts : translation du milieu, indépendamment du pincement.
const pan=M.gestePan();
const touch=(pointerId,clientX,clientY)=>({pointerId,clientX,clientY,pointerType:'touch'});
pan.down(touch(1,10,10));assert.equal(pan.move(touch(1,20,20)),null);
pan.down(touch(2,60,20));
let d=pan.move(touch(1,30,30));assert.equal(d.x,5);assert.equal(d.y,5);
d=pan.move(touch(2,70,30));assert.equal(d.x,5);assert.equal(d.y,5);
let a=pan.move(touch(1,20,30)),b=pan.move(touch(2,80,30));assert.equal(a.x+b.x,0,'pincement symétrique sans déplacement');
pan.up(touch(2,80,30));assert.equal(pan.move(touch(1,10,10)),null);
pan.reset();assert.equal(pan.move(touch(1,50,50)),null);
assert.ok(code.includes('camera.setViewOffset(w,h,-pan.x*w,-pan.y*h,w,h)'),'Pan sans déplacement du pivot');
assert.ok(code.includes('data-role="tools-panel" hidden'),'Tiroir replié au démarrage');
assert.ok(code.includes('data-role="inspector" hidden'),'Fiche repliée au démarrage');
console.log('ModelCore X — pan tactile et viewport prioritaire : tests OK.');

// Rendu différencié et fermeture géométrique (boîtes/poutres).
assert.equal(M.profilMateriau('Poteau','Gros œuvre').kind,'beton');
assert.equal(M.profilMateriau('Vitrage','Architecture').kind,'verre');
assert.equal(M.profilMateriau('Poteau','Charpente métallique').kind,'metal');
assert.equal(M.profilMateriau('Armature','Ferraillage').kind,'acier');
const cube=Array.from({length:8},(_,i)=>[i&1?2:0,i&2?2:0,i&4?2:0]);
const poly=M.contourCoupe(cube,[0,-1,0],1);
assert.equal(poly.length,4);assert.ok(poly.every(p=>Math.abs(p[1]-1)<1e-8));
assert.equal(M.contourCoupe(cube,[-1,0,0],3).length,0);
assert.equal(M.contourCoupe(cube,[0,1,0],-2).length,0);
const diag=cube.map(([x,y,z])=>[x-y,x+y,z]);
assert.equal(M.contourCoupe(diag,[1,0,0],-.5).length,4);
for(const family of ['immeuble','batiment','villa','hopital']){
  const model=M.validateManifest(M.demo(family));
  assert.ok(model.some(e=>e.type==='Menuiserie')&&model.some(e=>e.type==='Cloison'));
  assert.ok(new Set(model.map(e=>e.id)).size===model.length);
}
assert.ok(code.includes('capMesh.geometry.setAttribute'));
assert.ok(code.includes('renderer.shadowMap.enabled=high'));
console.log('ModelCore X — matières, détails architecturaux et fermeture des primitives : tests OK.');

// Plancher : appuis géométriques, pas d'association par nom de niveau.
assert.equal(M.contactPlancher(3,3.25,0,3,'below')!==null,true);
assert.equal(M.contactPlancher(3,3.25,3.25,6,'above')!==null,true);
assert.equal(M.contactPlancher(3,3.25,0,2.8,'below'),null);
assert.equal(M.contactPlancher(3,3.25,3.25,6,'below'),null);
assert.equal(M.contactPlancher(3,3.25,0,3,'above'),null);
assert.equal(M.contactPlancher(3,3.25,3.1,3.2,'above'),null);
const floorPoly=[[0,0],[4,0],[4,4],[0,4]];
const floorSegment=M.segmentDansPolygone([-2,2],[6,2],floorPoly);
assert.ok(Math.abs(floorSegment[0]-.25)<1e-6&&Math.abs(floorSegment[1]-.75)<1e-6);
assert.equal(M.segmentDansPolygone([-2,5],[6,5],floorPoly),null);
assert.ok(M.segmentDansPolygone([1,1],[2,2],[[0,0],[4,0],[0,4]]));
assert.equal(M.segmentDansPolygone([3,3],[4,4],[[0,0],[4,0],[0,4]]),null);
assert.equal(JSON.stringify(M.fusionIntervalles([[.5,1],[0,.5],[.2,.4]])),'[[0,1]]');
assert.ok(M.typeSupport('Voile / mur')&&M.typeSupport('Poteau')&&M.typeSupport('Poutre'));
assert.ok(M.typePlancher('Dalle')&&!M.typePlancher('Poteau'));
console.log('ModelCore X — contacts plancher, découpage des empreintes et côtés : tests OK.');

// Studio : plafonds GPU, environnement local et profils sans mutation de géométrie.
assert.equal(M.profilRendu('standard',100).shadows,false);
assert.equal(M.profilRendu('high',100).shadows,true);
assert.equal(M.profilRendu('studio',100).pixelRatio,2);
assert.equal(M.profilRendu('studio',2000).shadows,false);
assert.equal(M.profilRendu('studio',2000).edges,false);
assert.equal(M.profilRendu('studio',2000).pixelRatio,1);
assert.equal(M.profilRendu('studio',100,1024).shadowSize,1024);
const pixels=M.studioPixels(16,8);
assert.equal(pixels.length,16*8*4);assert.ok(pixels.every((v,i)=>i%4!==3||v===255));
assert.ok(new Set(pixels).size>20);
assert.ok(code.includes('pmrem.fromEquirectangular(source)'));
assert.ok(code.includes('renderer.shadowMap.autoUpdate=false'));
console.log('ModelCore X — profils Studio, environnement procédural et plafonds GPU : tests OK.');

vm.runInNewContext(fs.readFileSync('www/js/modelcore-pdfstack.js','utf8'),context,{filename:'modelcore-pdfstack.js',timeout:5000});
const S=context.window.ModelCorePDFStack;
const eqPoint=(a,b)=>assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-8));
const tr=S.calage([10,20],[10,120],[0,0],[50,0]);
eqPoint(S.appliquer(tr,[10,20]),[0,0]);eqPoint(S.appliquer(tr,[10,120]),[50,0]);
eqPoint(S.appliquer(tr,[30,20]),[0,-10]);assert.equal(tr.scale,.5);
const r=S.reference([25,15],[225,15],40);
eqPoint(S.appliquer(r,[125,65]),[20,10]);
assert.throws(()=>S.reference([1,1],[1,1],10),/distincts/);
assert.throws(()=>S.reference([1,1],[2,2],0),/Distance/);
assert.throws(()=>S.calage([1,1],[2,2],[0,0],[0,0]),/distincts/);
console.log('PDF Stack — calage métrique, rotation, translation et échelle : OK.');
