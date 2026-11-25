/* Import IFC local — WebIFC 0.0.77 (MPL-2.0), isolé dans un Worker.
 * Aucun transfert réseau du fichier. Les positions WebIFC sont en mètres, Y vertical.
 * Contrat V1 : une géométrie par GlobalId, limites de sécurité pour mobile.
 */
(function(root){
  'use strict';
  const LIMITS={elements:5000,coords:600000,indices:600000};
  const val=x=>x&&typeof x==='object'&&'value' in x?x.value:x;
  function transformer(x,y,z,m){
    return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
  }
  function convertir(api,bytes,types){
    let model=-1;
    try{
      model=api.OpenModel(bytes,{COORDINATE_TO_ORIGIN:true});
      if(!Number.isInteger(model)||model<0)throw Error('IFC illisible.');
      const schema=api.GetModelSchema(model),parents=new Map(),memo=new Map();
      const line=id=>{if(!memo.has(id))memo.set(id,api.GetLine(model,id,false));return memo.get(id);};
      function relation(code,from,to){if(code==null)return;const ids=api.GetLineIDsWithType(model,code);for(let i=0;i<ids.size();i++){const r=line(ids.get(i)),p=val(r?.[from]);for(const child of r?.[to]||[]){const c=val(child);if(Number.isInteger(c)&&Number.isInteger(p))parents.set(c,p);}}}
      relation(types.IFCRELAGGREGATES,'RelatingObject','RelatedObjects');
      relation(types.IFCRELCONTAINEDINSPATIALSTRUCTURE,'RelatingStructure','RelatedElements');
      function classOf(e){return String(api.GetNameFromTypeCode(e.type)||'IFCELEMENT');}
      function location(id){let building='',level='',zone='',seen=new Set();while(parents.has(id)&&!seen.has(id)){seen.add(id);id=parents.get(id);const e=line(id);if(!e)break;const c=classOf(e),name=String(val(e.Name)||c);if(/IFCBUILDINGSTOREY/i.test(c)&&!level)level=name;else if(/IFCBUILDING$|IFCFACILITY$|IFCBRIDGE$|IFCROAD$/i.test(c)&&!building)building=name;else if(/IFCSPACE|IFCFACILITYPART/i.test(c)&&!zone)zone=name;}return {building:building||'IFC · non classé',level:level||'Non défini',zone:zone||'Non classée'};}
      const elements=[],seen=new Set();let totalCoords=0,totalIndices=0,missing=0,skipped=0,failure=null;
      api.StreamAllMeshes(model,mesh=>{
        if(failure)return;
        try{
          const e=line(mesh.expressID);if(!e){skipped++;return;}
          const c=classOf(e);
          if(/IFCSPACE|IFCOPENINGELEMENT/i.test(c)){skipped++;return;}
          const positions=[],indices=[];
          for(let i=0;i<mesh.geometries.size();i++){
            const p=mesh.geometries.get(i),g=api.GetGeometry(model,p.geometryExpressID);
            try{
              const v=api.GetVertexArray(g.GetVertexData(),g.GetVertexDataSize()),idx=api.GetIndexArray(g.GetIndexData(),g.GetIndexDataSize());
              if(v.length%6||idx.length%3||p.flatTransformation.length!==16)throw Error('Géométrie IFC invalide.');
              if(positions.length+v.length/2>150000||indices.length+idx.length>300000||totalCoords+positions.length+v.length/2>LIMITS.coords||totalIndices+indices.length+idx.length>LIMITS.indices)throw Error('Budget géométrique mobile dépassé. Découpez le fichier IFC par zone ou lot.');
              const offset=positions.length/3;
              for(let j=0;j<v.length;j+=6)positions.push(...transformer(v[j],v[j+1],v[j+2],p.flatTransformation));
              for(let j=0;j<idx.length;j++){if(idx[j]>=v.length/6)throw Error('Indice IFC invalide.');indices.push(offset+idx[j]);}
            }finally{g.delete?.();}
          }
          if(positions.length<9||indices.length<3){skipped++;return;}
          if(elements.length>=LIMITS.elements)throw Error('Limite de 5 000 ouvrages dépassée. Découpez la maquette.');
          const guid=String(val(e.GlobalId)||''),id=guid?'IFC-'+guid:'IFC-EXP-'+mesh.expressID;
          if(!guid)missing++;if(seen.has(id))throw Error('Identifiant IFC dupliqué : '+id);seen.add(id);
          const loc=location(mesh.expressID);
          const map={IFCCOLUMN:'Poteau',IFCBEAM:'Poutre',IFCSLAB:'Dalle',IFCWALL:'Voile / mur',IFCWALLSTANDARDCASE:'Voile / mur',IFCFOOTING:'Semelle',IFCPILE:'Pieu',IFCSTAIR:'Escalier',IFCSTAIRFLIGHT:'Volée',IFCDOOR:'Porte',IFCWINDOW:'Fenêtre',IFCREINFORCINGBAR:'Armature',IFCPIPESEGMENT:'Conduite',IFCDUCTSEGMENT:'Gaine'};
          const lot=/REINFORCING/i.test(c)?'Ferraillage':/PIPE/i.test(c)?'Plomberie':/DUCT/i.test(c)?'CVC':/CABLE|ELECTRIC/i.test(c)?'CFO/CFA':/DOOR|WINDOW|CURTAINWALL/i.test(c)?'Architecture':/FOOTING|PILE/i.test(c)?'Fondations':/COLUMN|BEAM|SLAB|WALL|STAIR|MEMBER/i.test(c)?'Structure · à vérifier':'IFC · à classer';
          elements.push({id,type:map[c.toUpperCase()]||c,...loc,lot,sourceId:guid,sourceFormat:'IFC',modelVersion:'Import local',description:c+' · '+String(val(e.Name)||''),geometry:{kind:'mesh',positions,indices}});
          totalCoords+=positions.length;totalIndices+=indices.length;
        }catch(err){failure=err;}
      });
      if(failure)throw failure;if(!elements.length)throw Error('Aucun ouvrage géométrique compatible trouvé.');
      return {schema:'siteteam-modelcore-v1',elements,report:{schema,imported:elements.length,skipped,missing,triangles:totalIndices/3,scope:'Maillages émis par WebIFC; espaces et ouvertures exclus. Exhaustivité non garantie.'}};
    }finally{if(model>=0)api.CloseModel(model);}
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={convertir,transformer,LIMITS};return;}
  root.onmessage=async event=>{
    let api;
    try{
      if(!(event.data instanceof ArrayBuffer)||event.data.byteLength>8*1024*1024)throw Error('IFC limité à 8 Mo dans ce pilote.');
      importScripts('../vendor/ifc/web-ifc-api-iife.js');
      api=new WebIFC.IfcAPI();api.SetWasmPath(new URL('../vendor/ifc/',root.location.href).href,true);await api.Init(undefined,true);
      const data=convertir(api,new Uint8Array(event.data),WebIFC);
      root.postMessage({ok:true,data});
    }catch(e){root.postMessage({ok:false,error:String(e?.message||e)});}
    finally{api?.Dispose?.();}
  };
})(typeof self!=='undefined'?self:globalThis);
