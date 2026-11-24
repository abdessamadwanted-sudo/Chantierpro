/* ModelCore 3D — générateur de maquettes fictives multi-projets.
 * Ne lit aucun fichier BIM réel. Un vrai IFC est traité par un pipeline distinct.
 */
(function () {
  'use strict';
  if (window.ModelCoreTemplates) return;
  const schema='siteteam-modelcore-v1';
  const TYPES=[
    ['stade','Stade / complexe sportif'],
    ['hopital','Hôpital / clinique'],
    ['immeuble','Immeubles / résidence'],
    ['villa','Villa / petit bâtiment'],
    ['pont','Pont / ouvrage d’art'],
    ['vrd','VRD / route / réseaux'],
    ['industriel','Usine / entrepôt'],
    ['batiment','Bâtiment / autre projet']
  ];
  function normalize(v){
    const x=String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(/stade|stadium|sport|tribun|equipement/.test(x))return 'stade';
    if(/hopital|hospital|clinique|sante|medical|chu/.test(x))return 'hopital';
    if(/villa|maison/.test(x))return 'villa';
    if(/immeub|residen|tour|logement|appartement/.test(x))return 'immeuble';
    if(/pont|viaduc|ouvragedart|ouvrage d.art|passerelle/.test(x))return 'pont';
    if(/route|v.r.d|vrd|voirie|reseau|assain|autorout|infrastructure/.test(x))return 'vrd';
    if(/industrie|industriel|usine|entrepot|hangar|atelier|logistique/.test(x))return 'industriel';
    return 'batiment';
  }
  function make(projectType){
    const type=normalize(projectType),els=[];let serial=0;
    const statusFor=i=>i%19===0?'Non conforme':i%6===0?'En attente':i%4===0?'En cours':'Réceptionné';
    function add(kind,building,zone,level,lot,geometry,description){
      const i=++serial,status=statusFor(i);
      els.push({id:'ST-'+type.toUpperCase()+'-'+String(i).padStart(5,'0'),
        type:kind,building,zone,level,lot,sourceFormat:'DEMO',sourceId:'',modelVersion:'demo-1',
        status,progress:status==='Réceptionné'?100:status==='Non conforme'?35:status==='En attente'?80:55,
        description:description||'',geometry});
    }
    const box=(kind,b,z,l,lot,size,position,description)=>add(kind,b,z,l,lot,{kind:'box',size,position},description);
    const beam=(kind,b,z,l,lot,start,end,width,depth)=>add(kind,b,z,l,lot,{kind:'beam',start,end,width,depth});
    function buildFrame(b,x,z,levels,width,depth,levelH=3.2){
      const lot='Gros œuvre';
      for(let f=0;f<levels;f++){
        const y=f*levelH,level=f?'R+'+f:'RDC';
        box('Dalle',b,'Ensemble',level,lot,[width,.25,depth],[x,y,z]);
        for(let dx of [-width*.43,0,width*.43])for(let dz of [-depth*.42,depth*.42])
          box('Poteau',b,'Structure',level,lot,[.4,levelH-.25,.4],[x+dx,y+(levelH-.25)/2+.12,z+dz]);
        for(let dz of [-depth*.42,depth*.42])
          beam('Poutre',b,'Structure',level,lot,[x-width*.43,y+levelH-.15,z+dz],[x+width*.43,y+levelH-.15,z+dz],.35,.5);
        box('Voile',b,'Noyau',level,lot,[.3,levelH-.3,depth*.32],[x+width*.12,y+levelH/2,z]);
        box('Escalier',b,'Noyau',level,'Circulation',[width*.12,.18,depth*.26],[x-width*.05,y+levelH/2,z-depth*.18]);
      }
      box('Dalle',b,'Toiture','Toiture',lot,[width,.22,depth],[x,levels*levelH,z]);
    }
    if(type==='hopital'){
      buildFrame('Bloc A — soins',-12,0,5,19,13);
      buildFrame('Bloc B — consultations',12,0,4,18,13);
      buildFrame('Liaison',0,0,2,8,7);
      for(let f=0;f<4;f++)for(let i=0;i<5;i++){
        box('Cloison','Bloc A — soins','Chambres','R+'+f,'Second œuvre',[.15,3,3.5],[-19+i*3.2,f*3.2+1.55,1.5]);
        box('Gaine CVC','Bloc B — consultations','Technique','R+'+f,'CVC',[9,.38,.55],[12,f*3.2+2.8,-2]);
      }
    }else if(type==='immeuble'){
      buildFrame('Tour A',-16,0,9,13,12);buildFrame('Tour B',0,0,12,13,12);buildFrame('Tour C',16,0,7,13,12);
      for(let j=0;j<3;j++)for(let f=0;f<5+j;f++){
        box('Façade','Tour '+['A','B','C'][j],'Façade Est','R+'+f,'Façade',[.22,2.5,10],[-16+16*j+6.4,f*3.2+1.6,0]);
      }
    }else if(type==='villa'){
      buildFrame('Villa A',0,0,2,14,11);
      box('Dalle','Villa A','Terrasse','Toiture','Étanchéité',[8,.2,4],[0,6.8,6]);
      box('Mur','Villa A','Jardin','RDC','Clôture',[.25,2.1,18],[-10,1,0]);
    }else if(type==='pont'){
      for(let i=0;i<8;i++){
        let x=-28+i*8,y=10+Math.sin(i/7*Math.PI)*2;
        box('Tablier','Pont principal','Travée '+(i+1),'Tablier','Génie civil',[8,.75,10],[x,y,0]);
        if(i%2===0){
          box('Pile','Pont principal','Appui '+(i+1),'Fondations','Génie civil',[1.6,y-1,2],[x,(y-1)/2,0]);
          box('Semelle','Pont principal','Appui '+(i+1),'Fondations','Génie civil',[5,.85,4],[x,-.35,0]);
        }
        beam('Poutre','Pont principal','Travée '+(i+1),'Tablier','Génie civil',[x-4,y-.8,-3],[x+4,y-.8,-3],.7,1.1);
        beam('Poutre','Pont principal','Travée '+(i+1),'Tablier','Génie civil',[x-4,y-.8,3],[x+4,y-.8,3],.7,1.1);
        for(let z of [-4.5,4.5])beam('Garde-corps','Pont principal','Travée '+(i+1),'Tablier','Sécurité',[x-4,y+.8,z],[x+4,y+.8,z],.12,.12);
      }
    }else if(type==='vrd'){
      for(let i=0;i<14;i++){
        const x=-42+i*6,z=2*Math.sin(i*.35),y=.2+Math.sin(i*.18)*.6;
        box('Chaussée','Tronçon A','PK '+i*50,'Plateforme','VRD',[6,.35,10],[x,y,z]);
        for(let side of [-1,1]){
          beam('Canalisation','Tronçon A','PK '+i*50,'Réseaux','Assainissement',[x-3,y-1.2,z+side*6],[x+3,y-1.2,z+side*6],.18,.18);
          box('Regard','Tronçon A','PK '+i*50,'Réseaux','Assainissement',[.9,1.3,.9],[x,y-1,z+side*6]);
        }
      }
    }else if(type==='industriel'){
      for(let h=0;h<2;h++){
        const x=h?22:-22,b='Halle '+(h+1);
        box('Dalle',b,'Plateforme','RDC','Gros œuvre',[36,.35,20],[x,0,0]);
        for(let i=0;i<7;i++){
          const xx=x-16+i*5.3;
          for(let z of [-9,9]){
            box('Poteau',b,'Portique '+i,'Structure','Charpente métallique',[.48,8,.48],[xx,4,z]);
            beam('Arbalétrier',b,'Portique '+i,'Toiture','Charpente métallique',[xx,8,z],[xx,10,0],.38,.6);
          }
          beam('Poutre',b,'Portique '+i,'Toiture','Charpente métallique',[xx,10,-9],[xx,10,9],.26,.26);
        }
        box('Local technique',b,'Technique','RDC','Électricité',[5,4,4],[x,2,0]);
      }
    }else{
      buildFrame('Bâtiment A',0,0,5,23,17);
      box('Rampe','Bâtiment A','Accès','RDC','VRD',[10,.35,4],[17,.25,0]);
      box('Local technique','Bâtiment A','Technique','RDC','CVC',[5,3,5],[-6,1.5,0]);
    }
    return {schema,projectType:type,elements:els};
  }
  window.ModelCoreTemplates={types:TYPES,normalize,make};
})();
