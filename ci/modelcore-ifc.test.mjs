import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const WebIFC=require('web-ifc');
const {convertir,transformer}=require('../www/js/modelcore-ifc-worker.js');
assert.deepEqual(transformer(1,2,3,[1,0,0,0,0,1,0,0,0,0,1,0,10,20,30,1]),[11,22,33]);
const api=new WebIFC.IfcAPI();
await api.Init(undefined,true);
try{
 const bytes=new Uint8Array(readFileSync('ci/fixtures/modelcore-column.ifc'));
 const result=convertir(api,bytes,WebIFC);
 assert.equal(result.elements.length,1,'Un seul ouvrage physique');
 const e=result.elements[0];
 assert.equal(e.sourceId,'0J$yPqHBD3sQxZL6y09abh');
 assert.equal(e.type,'Poteau');
 assert.equal(e.building,'Bloc test');
 assert.equal(e.level,'RDC');
 const axes=[[],[],[]];e.geometry.positions.forEach((v,i)=>axes[i%3].push(v));
 const ext=axes.map(a=>Math.max(...a)-Math.min(...a));
 assert.ok(Math.abs(ext[1]-3)<.001,'Axe vertical Y : 3 m');
 assert.ok(Math.abs(ext[0]-.4)<.001&&Math.abs(ext[2]-.4)<.001,'Section 40 x 40 cm');
 assert.ok(result.report.triangles>0);
 console.log('IFC4 réel — GlobalId, bâtiment, niveau, section et hauteur vérifiés.');
}finally{api.Dispose?.();}
