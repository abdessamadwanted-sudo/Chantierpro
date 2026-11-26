/* ModelCore X — Plans PDF superposés, calage métrique local par deux points homologues. */
(function(){
  'use strict';
  if(window.ModelCorePDFStack)return;
  const MAX=8, MAX_LEVELS=16, MAX_BYTES=60*1024*1024, COLORS=[0x70d9ff,0x9ae6bb,0xffd17a,0xd0b5ff,0xffa6b6,0x9abaff,0x80d8cb,0xffbe8f];
  function calage(a,b,A,B){
    if(![a,b,A,B].every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))throw Error('Repères invalides.');
    const x=b[0]-a[0],y=b[1]-a[1],X=B[0]-A[0],Y=B[1]-A[1],d=x*x+y*y;
    if(d<1e-8||X*X+Y*Y<1e-8)throw Error('Deux points distincts sont nécessaires.');
    const c=(x*X+y*Y)/d,s=(x*Y-y*X)/d;
    return {c,s,tx:A[0]-c*a[0]+s*a[1],tz:A[1]-s*a[0]-c*a[1],scale:Math.hypot(c,s),angle:Math.atan2(s,c)};
  }
  function appliquer(t,p){return [t.c*p[0]-t.s*p[1]+t.tx,t.s*p[0]+t.c*p[1]+t.tz];}
  // Transférer le centre et l'échelle métrique de la vue 2D, via le repère commun.
  function transferView(from,to,pos){
    if(!from?.t||!to?.t||!pos||!Number.isFinite(pos.cssWidth)||pos.cssWidth<=0||!Number.isFinite(pos.u)||!Number.isFinite(pos.v))return null;
    const a=from.t,b=to.t,world=appliquer(a,[pos.u*from.width,pos.v*from.height]);
    const X=world[0]-b.tx,Y=world[1]-b.tz,d=b.c*b.c+b.s*b.s;
    if(!d||!a.scale||!b.scale)return null;
    const x=(b.c*X+b.s*Y)/d,y=(-b.s*X+b.c*Y)/d;
    if(x< -1e-7||y< -1e-7||x>to.width+1e-7||y>to.height+1e-7)return null;
    return {u:Math.max(0,Math.min(1,x/to.width)),v:Math.max(0,Math.min(1,y/to.height)),cssWidth:pos.cssWidth*to.width*b.scale/(from.width*a.scale),zoom:Number.isFinite(pos.zoom)?pos.zoom*to.width*b.scale/(from.width*a.scale):null};
  }
  // Un point fixe la translation. L'échelle papier doit être connue et
  // l'orientation identique sur tous les plans (aucune estimation automatique).
  function calagePoint(a,denom){
    if(!Array.isArray(a)||a.length!==2||!a.every(Number.isFinite)||!Number.isFinite(denom)||denom<1||denom>10000)throw Error('Point et échelle PDF (1 à 10000) requis.');
    const scale=denom*.0254/72;
    return {c:scale,s:0,tx:-a[0]*scale,tz:-a[1]*scale,scale,angle:0};
  }
  function reference(a,b,d){
    if(!Number.isFinite(d)||d<=0||d>10000)throw Error('Distance A–B en mètres requise.');
    return calage(a,b,[0,0],[d,0]);
  }
  // Coordonnées dans le repère PDF à l'échelle 1, indépendantes du zoom et du DPR.
  function calViewport(w,h,W,H,z,cx,cy){
    const fit=Math.min(W/w,H/h),scale=fit*Math.max(1,Math.min(64,z));
    const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
    const halfX=W/(2*scale),halfY=H/(2*scale);
    cx=halfX>=w/2?w/2:clamp(cx,halfX,w-halfX);
    cy=halfY>=h/2?h/2:clamp(cy,halfY,h-halfY);
    return {scale,cx,cy,x:W/2-cx*scale,y:H/2-cy*scale};
  }
  const writes=new Map();
  function makeWorkspace(pid,name,count,height,custom=''){
    const names=String(custom||'').split(/[,;\n]+/).map(n=>n.trim()).filter(Boolean);
    if(names.length)count=names.length;
    if(!pid||!String(name||'').trim()||!Number.isInteger(count)||count<1||count>MAX_LEVELS||!Number.isFinite(height)||height<=0||height>100)throw Error('Nom, 1 à 16 niveaux et hauteur (0 à 100 m) requis.');
    if(names.some(n=>n.length>24)||new Set(names.map(n=>n.toLocaleLowerCase())).size!==names.length)throw Error('Noms de niveaux uniques, 24 caractères maximum.');
    const rdc=Math.max(0,names.findIndex(n=>n.toUpperCase()==='RDC'));
    return {id:pid,name:String(name).trim().slice(0,120),levels:Array.from({length:count},(_,i)=>({id:'n'+i,name:names[i]||(i?'R+'+i:'RDC'),z:(i-rdc)*height})),plans:[],distance:null,referenceLevel:null,calibrationMode:'point',denominator:null};
  }
  async function openWorkspace(options={}){
    const pid=options.projectId;if(!pid||typeof DB==='undefined'||!await DB.get('projects',pid))throw Error('Ouvrez un projet SiteTeam.');
    const key=DB.name()+'|'+pid;await writes.get(key);
    let data=await DB.get('mcworkspaces',pid);
    if(!data){
      const r=await formSheet('Créer le projet ModelCore X',[
        {name:'name',label:'Nom du projet 3D',value:options.projectName||'Mon projet'},
        {name:'count',label:'Nombre de niveaux standard (RDC compris, max. 16)',type:'number',value:4},
        {name:'names',label:'Ou noms personnalisés, du bas vers le haut (séparés par virgules)',placeholder:'SSL, Mezz, RDC, R+1, R+2…'},
        {name:'height',label:'Hauteur provisoire entre niveaux (m) — à vérifier et corriger ensuite',type:'number',value:3}
      ],{okLabel:'Créer le projet vide'});
      if(!r)return null;
      data=makeWorkspace(pid,r.name,Number(r.count),Number(r.height),r.names);await DB.putRaw('mcworkspaces',data);
    }
    return open({...options,workspace:data});
  }
  async function open(options={}){
    await need3D();
    // Même initialisation que le lecteur de plans SiteTeam : worker embarqué,
    // y compris à la première ouverture après un démarrage à froid.
    if(typeof pdfReadyA!=='function'||!(await pdfReadyA()))throw Error('Lecteur PDF indisponible. Vérifiez la mise à jour.');
    const T=window.THREE;if(!T||!T.OrbitControls)throw Error('WebGL indisponible.');
    const ws=options.workspace||null;
    if(ws&&(!options.projectId||ws.id!==options.projectId||!Array.isArray(ws.levels)||!ws.levels.length||ws.levels.length>MAX_LEVELS))throw Error('Projet ModelCore invalide.');
    const levels=ws?ws.levels.map(v=>({...v})):[];
    const el=document.createElement('div');el.className='mc-pdfstack'+(ws?' mc-workspace':'');
    el.innerHTML='<style>.mc-pdfstack{position:fixed;inset:0;z-index:1000000;display:flex;flex-direction:column;background:#08192a;color:#e6f4ff;font:13px system-ui,sans-serif;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}.mc-pdfstack *{box-sizing:border-box}.mc-pdfstack [hidden]{display:none!important}.mc-pdfstack button,.mc-pdfstack input,.mc-pdfstack select{background:#163348;color:#e6f4ff;border:1px solid #34586d;border-radius:8px;padding:8px;min-height:36px;font:inherit}.mc-pdfstack button.active{border-color:#55d9ee;color:#8af0ff;background:#155064}.mc-pdfstack button:disabled{opacity:.4}.mc-pdfstack .ps-head,.mc-pdfstack .ps-bar{display:flex;gap:6px;align-items:center;padding:8px;flex-shrink:0}.mc-pdfstack .ps-head{background:#0b2236}.mc-pdfstack .ps-head b{font-size:16px}.mc-pdfstack .ps-small{font-size:11px;color:#9bbacc}.mc-pdfstack .ps-grow{flex:1;min-width:0}.mc-pdfstack .ps-stage{position:relative;flex:1;min-height:100px;overflow:hidden;background:radial-gradient(ellipse,#24465b,#071625 75%)}.mc-pdfstack .ps-stage>canvas{width:100%;height:100%;display:block;touch-action:none}.mc-pdfstack .ps-cal{display:flex;flex-direction:column;flex:1;min-height:0;padding:8px;gap:5px}.mc-pdfstack .ps-preview{flex:1;min-height:120px;overflow:auto;background:#172b3c;touch-action:pan-x pan-y}.mc-pdfstack .ps-preview canvas{display:block;max-width:none;touch-action:pan-x pan-y}.mc-pdfstack .ps-drawer{max-height:43%;overflow:auto;padding:8px;background:#0d2538;border-top:1px solid #315267}.mc-pdfstack .ps-row{display:flex;align-items:center;gap:5px;margin:6px 0}.mc-pdfstack .ps-row input[type=number]{width:74px}.mc-pdfstack .ps-row b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}.mc-pdfstack .ps-status{padding:5px 10px;color:#a8d4e2;min-height:25px;font-size:11px}.mc-pdfstack .ps-top{position:absolute;top:8px;left:8px;right:8px;pointer-events:none;display:flex;justify-content:space-between}.mc-pdfstack .ps-top span{background:#0a2035dd;padding:6px;border-radius:6px}.mc-pdfstack .ps-cal .ps-bar{padding:0;flex-wrap:wrap}.mc-pdfstack .ps-cal .ps-bar input{width:90px}.mc-pdfstack .ps-point{color:#64e4ff}.mc-pdfstack .ps-source{border:1px solid #34586d;border-radius:8px;padding:6px;margin:6px 0}.mc-pdfstack .ps-source input[type=search]{width:100%}.mc-pdfstack .ps-source-list{max-height:180px;overflow:auto}.mc-pdfstack .ps-source-list button{text-align:left;width:100%;margin:3px 0;white-space:normal;overflow-wrap:anywhere}.mc-pdfstack .ps-source-list small{display:block;color:#a8c7d8}.mc-pdfstack .ps-bar{overflow-x:auto}.mc-pdfstack .ps-drawer .ps-row{flex-wrap:wrap}.mc-pdfstack .ps-levels{position:absolute;right:10px;top:52px;max-height:calc(100% - 65px);overflow:auto;display:flex;flex-direction:column;gap:6px;padding:5px;background:#0b2236dd;border:1px solid #34586d;border-radius:14px;max-width:94px}.mc-pdfstack .ps-levels button{min-height:44px;min-width:56px;padding:6px 4px;overflow-wrap:anywhere}.mc-pdfstack .ps-levels small{display:block;font-size:10px;color:#a8c7d8}.mc-pdfstack .ps-empty{position:absolute;top:38%;left:10%;right:27%;text-align:center;color:#a8c7d8;pointer-events:none}.mc-pdfstack .ps-empty b{display:block;font-size:17px;color:#e6f4ff;margin-bottom:8px}.mc-pdfstack .ps-overview-row{display:flex;align-items:center;gap:6px;border:1px solid #34586d;border-radius:10px;padding:7px;margin:5px 0}.mc-pdfstack .ps-overview-row b{display:block;overflow-wrap:anywhere}.mc-pdfstack .ps-overview-row button{min-width:64px}.mc-pdfstack .ps-level-tools{border-bottom:1px solid #34586d;padding-bottom:6px;margin-bottom:8px}.mc-pdfstack .ps-level-tools input[type=text]{width:110px;min-width:0}.mc-pdfstack .ps-level-tools input[type=number]{width:72px}.mc-pdfstack .ps-preview{position:relative;overflow:hidden;touch-action:none;min-height:100px}.mc-pdfstack .ps-preview canvas{width:100%;height:100%;touch-action:none;cursor:crosshair}.mc-pdfstack .ps-cal-zoom{font-size:11px;color:#93d3e6}.mc-pdfstack .ps-sight{position:absolute;left:50%;top:50%;width:28px;height:28px;transform:translate(-50%,-50%);border:1px solid #0098c1;border-radius:50%;pointer-events:none;filter:drop-shadow(0 0 1px white)}.mc-pdfstack .ps-sight:before,.mc-pdfstack .ps-sight:after{content:"";position:absolute;background:#0098c1;left:50%;top:50%;transform:translate(-50%,-50%)}.mc-pdfstack .ps-sight:before{width:40px;height:1px}.mc-pdfstack .ps-sight:after{width:1px;height:40px}.mc-workspace .ps-head b{font-size:19px}.mc-workspace .ps-stage{background:radial-gradient(ellipse,#24465b,#071625 75%)}</style>'+
      '<div class="ps-head"><button data-a="close">✕</button><div class="ps-grow"><b>◈ ModelCore <span style="color:#5ce5fc">X</span></b><div class="ps-small" data-r="project"></div></div><button data-a="layers" aria-expanded="true">☷ Plans</button></div>'+
      '<div class="ps-bar"><button data-a="3d" class="active">3D · Tous</button><button data-a="overview" hidden>▤ Niveaux</button><button data-a="top">Dessus 3D</button><button data-a="planview" hidden>Vue en plan</button><button data-a="fit">Ajuster</button><button data-a="detail3d" disabled>HD niveau</button><button data-a="zoomout">−</button><button data-a="zoomin">+</button><label class="ps-small">Écart <select data-r="explode"><option value="1">Réel</option><option value="2">×2</option><option value="4">×4</option></select></label></div>'+
      '<div class="ps-stage" data-r="stage"><div class="ps-top"><span data-r="count">0 plan calé</span><span>1 doigt orbite · 2 doigts zoom/pan</span></div><div class="ps-empty" data-r="empty" hidden><b>Projet vide</b><span>Choisissez un niveau à droite pour ajouter son PDF.</span></div><div class="ps-levels" data-r="levels" hidden></div></div>'+
      '<div class="ps-cal" data-r="cal" hidden><div class="ps-bar"><b class="ps-grow" data-r="calname"></b><button data-a="calclose">Terminer</button></div><div class="ps-bar"><button data-a="pointA" class="active">Point A</button><button data-a="pointB">Point B</button><button data-a="calminus">−</button><button data-a="calplus">+</button><button data-a="precision">◎ Précision</button><button data-a="fullpaper">Plan entier</button><span class="ps-cal-zoom" data-r="cal-zoom">100 %</span><button data-a="aim">⊕ Placer au viseur</button><button data-a="clear">Effacer</button></div><div class="ps-bar"><label>Calage <select data-r="cal-mode"><option value="point">1 point commun</option><option value="two">2 points (avancé)</option></select></label><label data-r="scale-label">Échelle 1:<input data-r="denom" type="number" min="1" max="10000" step="1" placeholder="100"></label></div><div class="ps-small" data-r="instructions"></div><div class="ps-preview" data-r="preview"><canvas data-r="paper" aria-label="Plan PDF : pincez pour zoomer, glissez pour déplacer, touchez pour choisir le point"></canvas><div class="ps-sight" aria-hidden="true"></div></div><div class="ps-bar"><label data-r="distance-label">Distance A–B (m) <input data-r="distance" type="number" min=".01" max="10000" step=".01" value=""></label><button data-a="apply">Valider le calage</button><button data-a="apply-next" hidden>Valider + suivant</button></div></div>'+
      '<div class="ps-drawer" data-r="drawer"><div data-r="overview-panel" hidden><div class="ps-row"><b class="ps-grow" data-r="progress"></b><button data-a="next-empty">＋ Plan suivant</button><button data-a="show-all">3D Tous</button></div><div data-r="overview-list"></div></div><div class="ps-level-tools" data-r="level-tools" hidden><div class="ps-row"><b class="ps-grow" data-r="selected-level"></b><button data-a="retry-save">Enregistrer</button><button data-a="drawerclose">✕</button></div><div class="ps-row"><label>Nom <input type="text" maxlength="24" data-r="level-name"></label><label>Altitude (m) <input type="number" step=".01" data-r="level-z"></label></div><div class="ps-row"><input type="text" maxlength="24" data-r="new-level" placeholder="Ex. Sous-sol"><input type="number" step=".01" data-r="new-z" placeholder="Altitude"><button data-a="newlevel">＋ Niveau</button></div></div><div class="ps-row"><button data-a="projectplans">▤ Plans du projet</button><button data-a="add">＋ Téléphone</button><input data-r="file" type="file" accept="*/*" multiple hidden><label class="ps-small">Page <input data-r="page" type="number" value="1" min="1" step="1" aria-label="Page PDF"></label><label class="ps-small">Opacité <input data-r="opacity" type="range" min="20" max="100" value="100"></label></div><div class="ps-source" data-r="sources" hidden><div class="ps-row"><b class="ps-grow">Niveaux · PDF du projet</b><button data-a="sourceclose">✕</button></div><input type="search" data-r="search" placeholder="Rechercher niveau, dossier ou plan…" aria-label="Rechercher un plan"><div class="ps-source-list" data-r="source-list"></div></div><div class="ps-small">Premier PDF = référence. Calage par point commun (même échelle/orientation) ou par 2 points. Jusqu’à 16 niveaux dans Mon projet (8 en session PDF Stack) · 60 Mo/PDF · stockage local.</div><div data-r="list"></div></div><div class="ps-status" data-r="status" aria-live="polite">Ajoutez le PDF de référence.</div>';
    document.body.appendChild(el);
    const $=s=>el.querySelector(s),stage=$('[data-r="stage"]'),paper=$('[data-r="paper"]'),rows=$('[data-r="list"]');
    $('[data-r="project"]').textContent=(ws?ws.name:String(options.projectName||'Projet'))+(ws?' · Projet réel · local':' · PDF Stack · session locale');
    let renderer;
    try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'default'});}
    catch(e){el.remove();throw Error('WebGL indisponible.');}
    renderer.setClearColor(0,0);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputEncoding=T.sRGBEncoding;
    stage.prepend(renderer.domElement);
    const scene=new T.Scene(),group=new T.Group();scene.add(group);
    const camera=new T.PerspectiveCamera(42,1,.01,10000),controls=new T.OrbitControls(camera,renderer.domElement);
    controls.enableDamping=false;controls.enablePan=true;controls.touches.ONE=T.TOUCH.ROTATE;controls.touches.TWO=T.TOUCH.DOLLY_PAN;
    renderer.domElement.style.touchAction='none';
    const grid=new T.GridHelper(100,20,0x436679,0x2c495d);grid.material.transparent=true;grid.material.opacity=.22;scene.add(grid);
    const layers=[];let ref=null,current=null,point='A',zoom=1,closed=false,busy=false,raf=0,task=null,renderTask=null,backRemove=null,distance=null,view='3d',serial=0,sources=[],selectedLevel='all',restoring=!!ws,saveFailed=false,reading=false,closeReader=null,calMode=ws?(ws.calibrationMode||((ws.plans||[]).length?'two':'point')):'two',denominator=ws?.denominator||null;
    let detailLayer=null,detailTex=null,detailCanvas=null,detailTask=null,detailRender=null,detailEpoch=0,detailBusy=false;
    function msg(s){$('[data-r="status"]').textContent=s;}
    function save(){
      if(!ws||restoring)return Promise.resolve(true);
      const data={id:ws.id,name:ws.name,levels:levels.map(v=>({...v})),distance,referenceLevel:ref?.levelId||null,calibrationMode:calMode,denominator,
        plans:layers.map(l=>({levelId:l.levelId,name:l.name,page:l.page,file:l.file,A:l.A?.slice()||null,B:l.B?.slice()||null,validated:l.validated,visible:l.visible}))};
      const key=DB.name()+'|'+ws.id;
      const promise=(writes.get(key)||Promise.resolve()).then(async()=>{if(!await DB.get('projects',ws.id))throw Error('Projet SiteTeam supprimé.');await DB.putRaw('mcworkspaces',data);}).then(()=>{saveFailed=false;return true;}).catch(e=>{saveFailed=true;const message='Sauvegarde locale échouée : '+(e.message||e);if(!closed)msg(message);else if(typeof toast==='function')toast(message);return false;});
      writes.set(key,promise);promise.then(()=>{if(writes.get(key)===promise)writes.delete(key);});return promise;
    }
    function levelBy(id){return levels.find(v=>v.id===id);}
    async function viewPlan(l,initialView=null){
      if(closed||busy||reading||!l)return;
      if(typeof showPdf!=='function'){msg('Lecteur PDF indisponible.');return;}
      reading=true;
      // Le lecteur normal utilise le PDF original et non la texture 3D.
      // La caméra, les repères et la sélection restent intacts au retour.
      try{
        await showPdf(l.file,(ws?levelBy(l.levelId)?.name+' · ':'')+l.name,{
          page:l.page,onlyPage:true,overlay:true,initialView,
          levels:ws?[...levels].sort((a,b)=>b.z-a.z).map(v=>({id:v.id,name:v.name,available:layers.some(x=>x.levelId===v.id)})):undefined,
          activeLevel:l.levelId,on3D:()=>{if(closeReader)closeReader();showAll();},
          onLevel:(id,pos)=>{
            const target=layers.find(x=>x.levelId===id);
            if(!target||closed||!closeReader)return;
            const next=transferView(l,target,pos);
            closeReader();setLevel(id);viewPlan(target,next);
            if(!next)msg('Vue ajustée : calage commun absent ou point hors du plan cible.');
          },
          onOpen:shut=>{if(closed){shut();return;}closeReader=shut;},onClose:()=>{reading=false;closeReader=null;if(!closed)schedule();}
        });
        if(!closeReader)reading=false;
      }catch(e){reading=false;closeReader=null;if(!closed)msg('Vue en plan : '+(e.message||e));}
    }
    function showAll(){
      if(closed||busy||current)return;
      view='3d';controls.enableRotate=true;
      $('[data-a="3d"]').classList.add('active');$('[data-a="top"]').classList.remove('active');
      if(ws){for(const l of layers)l.visible=true;setLevel('all');save();}
      else{for(const l of layers)l.visible=true;update();fit();}
      const pending=layers.filter(l=>!l.t).length;
      msg(layers.filter(l=>l.t).length+' plans affichés en 3D'+(pending?' · '+pending+' PDF à caler avant superposition':''));
    }
    function nextEmpty(){
      if(!ws||busy||current||closed)return;
      const ordered=[...levels].sort((a,b)=>a.z-b.z);
      const next=ordered.find(v=>!layers.some(l=>l.levelId===v.id));
      if(next){setLevel(next.id);msg('Niveau '+next.name+' · choisissez Téléphone ou Plans du projet.');}
      else{const pending=ordered.map(v=>layers.find(l=>l.levelId===v.id)).find(l=>l&&!l.t);
        if(pending){setLevel(pending.levelId);edit(pending);}else showAll();}
    }
    function showOverview(){
      if(!ws||busy||current)return;
      setLevel('all');$('[data-r="drawer"]').hidden=false;$('[data-a="layers"]').setAttribute('aria-expanded','true');
      $('[data-r="overview-panel"]').hidden=false;
    }
    function drawOverview(){
      if(!ws)return;
      const box=$('[data-r="overview-list"]');box.replaceChildren();
      const aligned=layers.filter(l=>l.t).length;
      $('[data-r="progress"]').textContent=layers.length+'/'+levels.length+' PDF · '+aligned+' calés';
      $('[data-a="next-empty"]').disabled=layers.length===levels.length&&aligned===levels.length;
      for(const v of [...levels].sort((a,b)=>a.z-b.z)){
        const l=layers.find(x=>x.levelId===v.id),row=document.createElement('div');row.className='ps-overview-row';
        const info=document.createElement('div');info.className='ps-grow';const title=document.createElement('b');title.textContent=v.name+' · '+v.z.toFixed(2)+' m';
        const status=document.createElement('span');status.className='ps-small';status.textContent=l?(l.t?'✓ Calé · ':'À caler · ')+l.name:'Aucun PDF';info.append(title,status);row.append(info);
        const action=document.createElement('button');action.dataset.importLevel=v.id;action.textContent=l?(l.t?'Ouvrir':'Caler'):'＋ PDF';action.onclick=()=>{if(busy)return;setLevel(v.id);if(l){if(l.t)viewPlan(l);else edit(l);}};row.append(action);box.append(row);
      }
    }
    function setLevel(id){
      if(!ws||busy||closed||current)return;
      if(id!=='all'&&!levelBy(id))return;
      if(id!==selectedLevel)clearDetail();
      selectedLevel=id;
      $('[data-r="overview-panel"]').hidden=true;
      const d=$('[data-r="drawer"]');d.hidden=id==='all';
      $('[data-a="layers"]').setAttribute('aria-expanded',String(!d.hidden));
      $('[data-r="sources"]').hidden=true;update();fit();
      if(id!=='all'&&!layers.some(l=>l.levelId===id))msg('Niveau '+levelBy(id).name+' : choisissez Téléphone ou Plans du projet.');
      else msg(id==='all'?'Tous les niveaux':'Niveau '+levelBy(id).name);
    }
    function drawLevels(){
      if(!ws)return;
      $('[data-a="overview"]').hidden=false;drawOverview();
      const rail=$('[data-r="levels"]');rail.hidden=false;rail.replaceChildren();
      const all=document.createElement('button');all.textContent='Tous';all.dataset.level='all';all.classList.toggle('active',selectedLevel==='all');all.onclick=()=>setLevel('all');rail.append(all);
      for(const v of [...levels].sort((a,b)=>a.z-b.z)){
        const l=layers.find(l=>l.levelId===v.id),b=document.createElement('button');b.dataset.level=v.id;b.classList.toggle('active',selectedLevel===v.id);
        b.append(document.createTextNode(v.name));const small=document.createElement('small');small.textContent=l?(l.t?'✓ Calé':'À caler'):'+ PDF';b.append(small);b.onclick=()=>setLevel(v.id);rail.append(b);
      }
      const plus=document.createElement('button');plus.textContent='+ Niv.';plus.disabled=levels.length>=MAX_LEVELS;plus.onclick=()=>{if(busy)return;const d=$('[data-r="drawer"]');d.hidden=false;$('[data-a="layers"]').setAttribute('aria-expanded','true');$('[data-r="new-level"]').focus();};rail.append(plus);
      const v=levelBy(selectedLevel);$('[data-r="level-tools"]').hidden=false;
      $('[data-r="selected-level"]').textContent=v?v.name+' · '+(layers.some(l=>l.levelId===v.id)?'PDF importé':'Ajouter le PDF de ce niveau'):'Niveaux du projet';
      const z=$('[data-r="level-z"]'),name=$('[data-r="level-name"]');z.disabled=!v;z.value=v?v.z:'';name.disabled=!v;name.value=v?v.name:'';
      $('[data-a="apply-next"]').hidden=!current||!ws;
      const planButton=$('[data-a="planview"]');planButton.hidden=!v;planButton.disabled=!layers.some(l=>l.levelId===selectedLevel);
      $('[data-a="projectplans"]').disabled=!v||layers.some(l=>l.levelId===v.id);
      $('[data-a="add"]').disabled=!v||layers.some(l=>l.levelId===v.id);
      const empty=$('[data-r="empty"]');empty.hidden=layers.some(l=>l.mesh.visible);
      empty.querySelector('b').textContent=layers.length?'Aucun plan calé visible':'Projet vide';
      empty.querySelector('span').textContent=layers.length?'Sélectionnez Tous ou terminez le calage du niveau.':'Choisissez un niveau à droite pour ajouter son PDF.';
    }
    function schedule(){if(closed||reading||raf)return;raf=requestAnimationFrame(()=>{raf=0;if(!stage.hidden&&!reading)renderer.render(scene,camera);});}
    controls.addEventListener('change',schedule);
    function resize(){if(stage.hidden)return;const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();schedule();}
    const observer=new ResizeObserver(resize);observer.observe(stage);
    function fit(){
      const visible=layers.filter(l=>l.mesh.visible);const box=new T.Box3();
      for(const l of visible){l.mesh.updateMatrixWorld(true);box.expandByObject(l.mesh);}
      const ctr=box.isEmpty()?new T.Vector3():box.getCenter(new T.Vector3()),size=box.isEmpty()?new T.Vector3(10,1,10):box.getSize(new T.Vector3()),r=Math.max(1,size.length()/2);
      const vertical=T.MathUtils.degToRad(camera.fov/2),horizontal=Math.atan(Math.tan(vertical)*Math.max(.1,camera.aspect)),d=r/Math.sin(Math.min(vertical,horizontal))*1.12;
      controls.target.copy(ctr);controls.minDistance=Math.max(.05,r*.025);controls.maxDistance=d*8;
      camera.near=Math.max(.01,r/10000);camera.far=Math.max(1000,d*10);camera.updateProjectionMatrix();
      camera.position.copy(ctr).add((view==='top'?new T.Vector3(0,1,.0001):new T.Vector3(.7,.64,.8)).normalize().multiplyScalar(d));controls.update();
      grid.position.set(ctr.x,box.isEmpty()?-.3:box.min.y-.3,ctr.z);grid.scale.setScalar(Math.max(1,r/40));schedule();
    }
    function transform(l){if(!ref?.validated||!ref.A||!l.validated||!l.A)return null;if(calMode==='point')return denominator?calagePoint(l.A,denominator):null;if(!ref.B||!distance||!l.B)return null;return l===ref?reference(l.A,l.B,distance):calage(l.A,l.B,[0,0],[distance,0]);}
    function clearDetail(){
      ++detailEpoch;
      if(detailRender)try{detailRender.cancel();}catch(e){}
      if(detailTask)detailTask.destroy().catch(()=>{});
      detailTask=null;
      if(detailLayer){detailLayer.mesh.material.map=detailLayer.texture;detailLayer.mesh.material.needsUpdate=true;}
      if(detailTex)detailTex.dispose();
      if(detailCanvas)detailCanvas.width=detailCanvas.height=0;
      detailLayer=detailTex=detailCanvas=null;
      const b=$('[data-a="detail3d"]');b.classList.remove('active');b.textContent='HD niveau';
    }
    function detailTarget(){return layers.find(l=>l.mesh.visible&&(!ws||l.levelId===selectedLevel));}
    function detailUI(){
      const b=$('[data-a="detail3d"]'),target=detailTarget();
      b.disabled=closed||busy||detailBusy||!target||(ws&&selectedLevel==='all');
      b.classList.toggle('active',!!detailLayer&&detailLayer===target);
      b.textContent=detailBusy?'HD…':detailLayer===target&&target?'HD ✓':'HD niveau';
    }
    async function toggleDetail(){
      const l=detailTarget();if(!l||busy||detailBusy||closed||(ws&&selectedLevel==='all'))return;
      if(detailLayer===l){clearDetail();detailUI();schedule();msg('Texture légère rétablie.');return;}
      clearDetail();const epoch=detailEpoch;detailBusy=true;detailUI();let c=null,t=null;
      try{
        msg('Rendu HD du PDF original…');
        const bytes=new Uint8Array(await l.file.arrayBuffer());if(closed||epoch!==detailEpoch)return;
        t=pdfjsLib.getDocument({data:bytes,isEvalSupported:false});detailTask=t;const doc=await t.promise,p=await doc.getPage(l.page);
        const v=p.getViewport({scale:1}),max=Math.min(3072,renderer.capabilities.maxTextureSize);
        const scale=Math.min(max/Math.max(v.width,v.height),Math.sqrt(6000000/(v.width*v.height)));
        const vp=p.getViewport({scale});c=document.createElement('canvas');c.width=Math.max(1,Math.floor(vp.width));c.height=Math.max(1,Math.floor(vp.height));
        detailRender=p.render({canvasContext:c.getContext('2d'),viewport:vp,background:'rgb(255,255,255)'});await detailRender.promise;
        if(closed||epoch!==detailEpoch||!layers.includes(l)||!l.mesh.visible)return;
        const tx=new T.CanvasTexture(c);tx.encoding=T.sRGBEncoding;tx.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
        detailLayer=l;detailTex=tx;detailCanvas=c;c=null;l.mesh.material.map=tx;l.mesh.material.needsUpdate=true;
        msg('HD actif · '+detailCanvas.width+' × '+detailCanvas.height+' px · Vue en plan pour les détails vectoriels.');
      }catch(e){if(!closed&&epoch===detailEpoch)msg('HD indisponible, texture légère conservée : '+(e.message||e));}
      finally{if(c)c.width=c.height=0;if(t)await t.destroy().catch(()=>{});if(detailTask===t)detailTask=null;detailRender=null;detailBusy=false;if(!closed){detailUI();schedule();}}
    }
    function update(){
      let n=0;const gap=Number($('[data-r="explode"]').value),opacity=Number($('[data-r="opacity"]').value)/100;
      for(const l of layers){
        let t=null;try{t=transform(l);}catch(e){}
        l.t=t;l.mesh.visible=!!t&&l.visible&&(!ws||selectedLevel==='all'||selectedLevel===l.levelId);
        if(t){const c=appliquer(t,[l.width/2,l.height/2]);l.mesh.position.set(c[0],l.z*gap,c[1]);l.mesh.rotation.y=-t.angle;l.mesh.scale.set(l.width*t.scale,1,l.height*t.scale);l.mesh.material.opacity=opacity;l.mesh.material.transparent=opacity<1;l.mesh.material.depthWrite=opacity===1;l.mesh.material.needsUpdate=true;if(l.mesh.visible)n++;}
      }
      if(detailLayer&&!detailLayer.mesh.visible)clearDetail();
      $('[data-r="count"]').textContent=n+' affichés · '+layers.filter(l=>l.t).length+' calés / '+layers.length+' PDF';list();drawLevels();detailUI();schedule();
    }
    function list(){
      rows.replaceChildren();
      for(const l of layers){
        if(ws&&selectedLevel!=='all'&&l.levelId!==selectedLevel)continue;
        const row=document.createElement('div');row.className='ps-row';
        const cb=document.createElement('input');cb.type='checkbox';cb.checked=l.visible;cb.setAttribute('aria-label','Afficher '+l.name);cb.onchange=()=>{l.visible=cb.checked;update();save();};
        const info=document.createElement('div');info.className='ps-grow';const title=document.createElement('b');title.textContent=(ws?levelBy(l.levelId)?.name+' · ':'')+l.name+' · p.'+l.page;const sub=document.createElement('div');sub.className='ps-small';sub.textContent=(l===ref?'RÉFÉRENCE · ':'')+(l.t?'Calé':'À caler');sub.style.color=l.t?'#8de5c5':'#f2ca80';info.append(title,sub);
        const z=document.createElement('input');z.type='number';z.step='.01';z.value=l.z;z.setAttribute('aria-label','Altitude en mètres');z.onchange=()=>{const n=Number(z.value);if(Number.isFinite(n)&&Math.abs(n)<=10000){l.z=n;if(ws)levelBy(l.levelId).z=n;}else z.value=l.z;update();save();};
        const c=document.createElement('button');c.textContent='Caler';c.onclick=()=>edit(l);
        const del=document.createElement('button');del.textContent='✕';del.title=ws?'Retirer le PDF du niveau (original inchangé)':'Retirer ce plan de la session';del.onclick=()=>{if(busy)return;if(l===ref&&layers.length>1){msg('Retirez les autres plans avant la référence.');return;}if(ws&&!window.confirm('Retirer ce PDF du niveau ? Le fichier original reste inchangé.'))return;remove(l);};
        const pdf=document.createElement('button');pdf.textContent='PDF';pdf.title='Vue en plan · PDF original';pdf.setAttribute('aria-label','Vue en plan '+l.name);pdf.onclick=()=>viewPlan(l);row.append(cb,info,z,pdf,c,del);rows.append(row);
      }
    }
    function remove(l){if(current===l)finish();if(detailLayer===l||detailBusy)clearDetail();group.remove(l.mesh);l.mesh.geometry.dispose();l.mesh.material.dispose();l.texture.dispose();l.canvas.width=l.canvas.height=0;layers.splice(layers.indexOf(l),1);if(ref===l){ref=null;distance=null;}update();fit();save();}
    async function addFile(file,pageNo=1,levelId=selectedLevel){
      if(closed||busy)throw Error('Import déjà en cours ou fermé.');
      if(layers.length>=(ws?MAX_LEVELS:MAX))throw Error('Maximum '+(ws?MAX_LEVELS:MAX)+' plans.');
      if(ws&&(!levelBy(levelId)||layers.some(l=>l.levelId===levelId)))throw Error('Choisissez un niveau vide avant l’import.');
      if(!file||typeof file.arrayBuffer!=='function'||!file.size)throw Error('Fichier PDF vide ou inaccessible.');
      if(file.size>MAX_BYTES)throw Error('PDF trop volumineux ('+Math.ceil(file.size/1048576)+' Mo). Limite 60 Mo; exportez le niveau seul.');
      if(!Number.isInteger(pageNo)||pageNo<1)throw Error('Numéro de page invalide.');
      busy=true;msg('Lecture locale : '+file.name);
      let canvas=null,committed=false;
      try{
        const head=new Uint8Array(await file.slice(0,1024).arrayBuffer());
        if(!new TextDecoder('latin1').decode(head).includes('%PDF-'))throw Error('Le fichier sélectionné n’est pas un PDF valide.');
        const bytes=new Uint8Array(await file.arrayBuffer());if(closed)throw Error('Session fermée.');
        task=pdfjsLib.getDocument({data:bytes,isEvalSupported:false});const doc=await task.promise;
        msg('PDF ouvert · page '+pageNo+' / '+doc.numPages+' · préparation du plan…');
        if(pageNo>doc.numPages)throw Error('Le PDF ne contient que '+doc.numPages+' pages.');
        const p=await doc.getPage(pageNo),v=p.getViewport({scale:1});
        const max=Math.min(ws&&levels.length>8?768:layers.length>=4?1024:1536,renderer.capabilities.maxTextureSize),vp=p.getViewport({scale:max/Math.max(v.width,v.height)});
        canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(vp.width));canvas.height=Math.max(1,Math.ceil(vp.height));
        renderTask=p.render({canvasContext:canvas.getContext('2d'),viewport:vp,background:'rgb(255,255,255)'});await renderTask.promise;renderTask=null;
        if(closed)throw Error('Session fermée.');
        const texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
        const geo=new T.PlaneGeometry(1,1);geo.rotateX(-Math.PI/2);
        const mat=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,toneMapped:false,transparent:false});
        const mesh=new T.Mesh(geo,mat);mesh.visible=false;group.add(mesh);
        const l={id:++serial,name:String(file.name).slice(0,120),page:pageNo,file,width:v.width,height:v.height,canvas,texture,mesh,levelId:ws?levelId:null,z:ws?levelBy(levelId).z:layers.length*3,visible:true,A:null,B:null,validated:false,t:null,color:COLORS[layers.length%COLORS.length]};
        layers.push(l);committed=true;if(!ref)ref=l;update();msg('PDF importé. Calage requis avant affichage.');if(!await save())throw Error('PDF chargé mais sauvegarde locale échouée. Réessayez via Plans.');return l.id;
      }finally{
        renderTask=null;const t=task;task=null;if(t)await t.destroy().catch(()=>{});if(canvas&&!committed)canvas.width=canvas.height=0;busy=false;
      }
    }
    // Lecture uniquement des métadonnées du projet courant, sans télécharger
    // toute sa bibliothèque. DB.get('files') récupère l'original à la demande.
    async function projectSources(){
      if(!options.projectId||typeof DB==='undefined')throw Error('Ouvrez un projet SiteTeam avant d’importer ses plans.');
      const pid=options.projectId;
      const [plans,folders]=await Promise.all([DB.byProject('plans',pid),DB.byProject('folders',pid)]);
      const fm=new Map(folders.filter(f=>f.projectId===pid).map(f=>[f.id,f]));
      const folderPath=id=>{const names=[],seen=new Set();while(id&&fm.has(id)&&!seen.has(id)&&names.length<12){seen.add(id);const f=fm.get(id);names.unshift(f.name||'Dossier');id=f.parentId;}return names.join(' › ')||'Sans dossier';};
      return plans.filter(p=>p.projectId===pid&&p.pdfFileId&&(typeof isCurrentPlan!=='function'||isCurrentPlan(p)))
        .map(p=>({id:p.id,name:p.name||'Plan',folder:folderPath(p.folderId),page:p.pdfPage||1}))
        .sort((a,b)=>(a.folder+' '+a.name).localeCompare(b.folder+' '+b.name,'fr',{numeric:true}));
    }
    async function addProjectPlan(id,levelId=selectedLevel){
      if(busy||closed)throw Error('Import en cours ou session fermée.');
      if(layers.length>=(ws?MAX_LEVELS:MAX))throw Error('Maximum '+(ws?MAX_LEVELS:MAX)+' plans.');
      const pid=options.projectId;if(!pid||typeof DB==='undefined')throw Error('Projet indisponible.');
      busy=true;let plan,rec;
      try{
        plan=await DB.get('plans',id);
        if(!plan||plan.projectId!==pid||!plan.pdfFileId)throw Error('PDF original absent de ce niveau.');
        msg('Récupération du PDF original : '+plan.name+'…');
        rec=await DB.get('files',plan.pdfFileId);
        if(closed)throw Error('Session fermée.');
        if(!rec||rec.projectId!==pid||!rec.blob)throw Error('PDF original indisponible. Synchronisez ce plan dans SiteTeam puis réessayez.');
      }finally{busy=false;}
      // Blob d'origine conservé en lecture seule; respect de la page du niveau.
      const blob=rec.blob, name=plan.name||rec.name||'Plan PDF';
      const file=new File([blob],name+'.pdf',{type:'application/pdf'});
      return addFile(file,Number(plan.pdfPage)||1,levelId);
    }
    function drawSources(){
      const box=$('[data-r="source-list"]'),q=$('[data-r="search"]').value.trim().toLocaleLowerCase();
      box.replaceChildren();
      const matches=sources.filter(p=>(p.folder+' '+p.name).toLocaleLowerCase().includes(q));
      for(const p of matches.slice(0,150)){
        const b=document.createElement('button');b.type='button';
        const title=document.createElement('span');title.textContent=p.name;
        const sub=document.createElement('small');sub.textContent=p.folder+' · PDF p.'+p.page;
        b.append(title,sub);b.onclick=async()=>{
          if(busy||closed)return;
          b.disabled=true;try{const id=await addProjectPlan(p.id);if(closed)return;
            $('[data-r="sources"]').hidden=true;edit(layers.find(l=>l.id===id));}
          catch(e){if(!closed)msg('Import '+p.name+' : '+(e.message||e));}
          finally{b.disabled=false;}
        };box.append(b);
      }
      if(!matches.length)box.textContent='Aucun PDF original dans ces niveaux. Utilisez Téléphone ou synchronisez les plans.';
      else if(matches.length>150){const sub=document.createElement('div');sub.className='ps-small';sub.textContent='Affinez la recherche ('+matches.length+' plans).';box.append(sub);}
    }
    async function showSources(){
      if(busy||closed)return;
      const panel=$('[data-r="sources"]');panel.hidden=false;
      $('[data-r="source-list"]').textContent='Lecture des niveaux…';
      try{sources=await projectSources();if(!closed)drawSources();}
      catch(e){if(!closed){$('[data-r="source-list"]').textContent=e.message||String(e);msg(e.message||String(e));}}
    }
    const preview=$('[data-r="preview"]');
    let calCenter=null,calV=null,calHD=null,calTimer=null,calEpoch=0,calSession=0,calTask=null,calPagePromise=null,calRender=null,calRendering=false,calPending=false;
    const pointers=new Map();let gesture=null;
    function releaseCrop(){
      ++calEpoch;++calSession;clearTimeout(calTimer);calTimer=null;calPending=false;
      if(calRender)try{calRender.cancel();}catch(e){}
      if(calTask)calTask.destroy().catch(()=>{});
      calTask=null;calPagePromise=null;
      if(calHD){calHD.canvas.width=calHD.canvas.height=0;calHD=null;}
      pointers.clear();gesture=null;
    }
    function viewState(){
      if(!current||!calCenter)return null;
      const W=preview.clientWidth,H=preview.clientHeight;if(W<2||H<2)return null;
      const v=calViewport(current.width,current.height,W,H,zoom,calCenter[0],calCenter[1]);calCenter=[v.cx,v.cy];
      return {...v,W,H,dpr:Math.min(window.devicePixelRatio||1,2,Math.sqrt(3000000/(W*H)))};
    }
    function drawPaper(){
      if(!current)return;const v=viewState();if(!v)return;calV=v;
      const W=Math.max(1,Math.round(v.W*v.dpr)),H=Math.max(1,Math.round(v.H*v.dpr));
      if(paper.width!==W)paper.width=W;if(paper.height!==H)paper.height=H;
      const ctx=paper.getContext('2d');ctx.setTransform(v.dpr,0,0,v.dpr,0,0);ctx.fillStyle='#172b3c';ctx.fillRect(0,0,v.W,v.H);
      ctx.drawImage(current.canvas,v.x,v.y,current.width*v.scale,current.height*v.scale);
      if(calHD&&calHD.layer===current){
        const q=calHD.v;ctx.drawImage(calHD.canvas,(v.x-q.x*v.scale/q.scale),(v.y-q.y*v.scale/q.scale),q.W*v.scale/q.scale,q.H*v.scale/q.scale);
      }
      const xy=p=>[v.x+p[0]*v.scale,v.y+p[1]*v.scale];
      if(calMode==='two'&&current.A&&current.B){const a=xy(current.A),b=xy(current.B);ctx.strokeStyle='#087baf';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}
      for(const k of (calMode==='point'?['A']:['A','B']))if(current[k]){
        const [x,y]=xy(current[k]);ctx.strokeStyle=k==='A'?'#0086b0':'#c37300';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.moveTo(x-17,y);ctx.lineTo(x+17,y);ctx.moveTo(x,y-17);ctx.lineTo(x,y+17);ctx.stroke();
        ctx.fillStyle=ctx.strokeStyle;ctx.font='bold 13px sans-serif';ctx.fillText(k,x+11,y-10);
      }
      $('[data-r="cal-zoom"]').textContent=Math.round(zoom*100)+' %';
    }
    function queueHD(){
      if(!current||closed)return;
      const epoch=++calEpoch;
      if(calRender)try{calRender.cancel();}catch(e){}
      clearTimeout(calTimer);calTimer=setTimeout(()=>{if(epoch===calEpoch)renderCalHD();},150);
    }
    async function renderCalHD(){
      if(!current||closed)return;
      if(calRendering){calPending=true;return;}
      const l=current,v=viewState(),epoch=calEpoch,session=calSession;if(!v)return;
      calRendering=true;let c=null;
      try{
        if(!calPagePromise){
          calPagePromise=(async()=>{
            const bytes=new Uint8Array(await l.file.arrayBuffer());
            if(closed||current!==l||session!==calSession)throw Error('Calage fermé');
            const t=pdfjsLib.getDocument({data:bytes,isEvalSupported:false});calTask=t;
            const doc=await t.promise;return doc.getPage(l.page);
          })();
        }
        const p=await calPagePromise;if(closed||current!==l||epoch!==calEpoch)return;
        c=document.createElement('canvas');c.width=Math.max(1,Math.round(v.W*v.dpr));c.height=Math.max(1,Math.round(v.H*v.dpr));
        const ctx=c.getContext('2d');ctx.fillStyle='#172b3c';ctx.fillRect(0,0,c.width,c.height);
        // Le viewport PDF est calculé à la résolution de l'écran, jamais un A0 géant.
        const vp=p.getViewport({scale:v.scale*v.dpr,offsetX:v.x*v.dpr,offsetY:v.y*v.dpr});
        calRender=p.render({canvasContext:ctx,viewport:vp,background:'rgb(255,255,255)'});
        await calRender.promise;
        if(closed||current!==l||epoch!==calEpoch)return;
        if(calHD)calHD.canvas.width=calHD.canvas.height=0;calHD={canvas:c,layer:l,v};c=null;
        paper.dataset.hd=String(epoch);drawPaper();
      }catch(e){if(!closed&&current===l&&epoch===calEpoch&&e?.name!=='RenderingCancelledException'){msg('Rendu HD indisponible : '+(e.message||e));if(calTask)calTask.destroy().catch(()=>{});calTask=null;calPagePromise=null;}}
      finally{if(c)c.width=c.height=0;calRender=null;calRendering=false;if(calPending){calPending=false;queueHD();}}
    }
    function zoomAt(z,x,y){
      if(!current||!calV)return;
      const v=calV,px=(x-v.x)/v.scale,py=(y-v.y)/v.scale;
      zoom=Math.max(1,Math.min(64,z));
      const n=Math.min(v.W/current.width,v.H/current.height)*zoom;
      calCenter=[px-(x-v.W/2)/n,py-(y-v.H/2)/n];drawPaper();queueHD();
    }
    const calObserver=new ResizeObserver(()=>{if(current){drawPaper();queueHD();}});calObserver.observe(preview);
    function edit(l){
      if(busy||!l)return;clearDetail();releaseCrop();current=l;zoom=1;calCenter=[l.width/2,l.height/2];calV=null;delete paper.dataset.hd;point='A';stage.hidden=true;$('[data-r="cal"]').hidden=false;$('[data-r="drawer"]').hidden=true;
      $('[data-r="calname"]').textContent=l.name+(l===ref?' · Référence':'');
      updateCalControls();$('[data-a="apply-next"]').hidden=!ws;drawPaper();pointMode('A');queueHD();
    }
    function updateCalControls(){
      $('[data-r="cal-mode"]').value=calMode;
      $('[data-r="scale-label"]').hidden=calMode!=='point';
      $('[data-r="denom"]').value=denominator||'';$('[data-r="denom"]').disabled=current!==ref;
      $('[data-r="distance-label"]').hidden=calMode!=='two';
      $('[data-r="distance"]').value=distance||'';$('[data-r="distance"]').disabled=current!==ref;
      $('[data-a="pointB"]').hidden=calMode!=='two';
      $('[data-r="instructions"]').textContent=calMode==='point'?
        (current===ref?'Choisissez un point commun (intersection d’axes), puis saisissez l’échelle réelle du PDF (ex. 100 pour 1:100). Même échelle et orientation sur tous les plans.':'Choisissez exactement le même point commun. Vérifiez que ce PDF a la même échelle et orientation que la référence.'):
        (current===ref?'Choisissez A puis B, saisissez la distance réelle A–B (m).':'Repérez exactement les mêmes axes A puis B que sur le PDF de référence.');
    }
    function changeCalMode(mode){
      if(!current||busy||!['point','two'].includes(mode)||mode===calMode)return;
      if(layers.some(l=>l.validated)&&!window.confirm('Changer de méthode invalide tous les calages. Les PDF et repères restent conservés. Continuer ?')){updateCalControls();return;}
      calMode=mode;for(const l of layers)l.validated=false;
      pointMode('A');updateCalControls();update();drawPaper();save();
    }
    function pointMode(k){point=k;for(const n of ['A','B'])$('[data-a="point'+n+'"]').classList.toggle('active',k===n);}
    function setPoint(l,k,p){
      if(!l||!['A','B'].includes(k)||!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[1]<0||p[0]>l.width||p[1]>l.height)throw Error('Point hors plan.');
      l[k]=p.slice();l.validated=false;update();save();if(current===l)drawPaper();
    }
    function finish(){if(busy)return;releaseCrop();current=null;paper.width=paper.height=0;$('[data-r="cal"]').hidden=true;stage.hidden=false;$('[data-r="drawer"]').hidden=!!ws;$('[data-a="layers"]').setAttribute('aria-expanded',String(!ws));resize();update();fit();}
    function valider(next=false){
      if(busy)throw Error('Lecture PDF en cours.');if(!current?.A)throw Error('Choisissez le point commun A.');
      if(current!==ref&&!ref?.validated)throw Error('Calez d’abord la référence.');
      if(calMode==='point'){
        const n=current===ref?Number($('[data-r="denom"]').value):denominator;
        calagePoint(current.A,n);denominator=n;
      }else{
        if(!current.B)throw Error('Choisissez A et B.');
        if(current===ref){const d=Number($('[data-r="distance"]').value);reference(current.A,current.B,d);distance=d;}
        else{if(!distance)throw Error('Calez d’abord la référence.');calage(current.A,current.B,[0,0],[distance,0]);}
      }
      current.validated=true;update();finish();msg(calMode==='point'?'Point commun aligné. Vérifiez un deuxième repère et l’échelle réelle.':'Calage validé. Vérifiez un troisième point indépendant.');save();if(next&&ws)nextEmpty();
    }
    function local(e){const r=paper.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
    paper.addEventListener('pointerdown',e=>{
      if(!current||!calV||busy)return;e.preventDefault();try{paper.setPointerCapture(e.pointerId);}catch(e){}
      if(pointers.size>=2)return;pointers.set(e.pointerId,local(e));const p=[...pointers.values()];
      if(p.length===1)gesture={start:p[0],last:p[0],moved:false,multi:false};
      else if(p.length===2){gesture={multi:true,last:[(p[0][0]+p[1][0])/2,(p[0][1]+p[1][1])/2],d:Math.max(1,Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]))};}
    });
    paper.addEventListener('pointermove',e=>{
      if(!pointers.has(e.pointerId)||!gesture||!calV)return;
      pointers.set(e.pointerId,local(e));const p=[...pointers.values()],v=calV;
      if(p.length===2){const mid=[(p[0][0]+p[1][0])/2,(p[0][1]+p[1][1])/2],d=Math.max(1,Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]));
        calCenter=[v.cx-(mid[0]-gesture.last[0])/v.scale,v.cy-(mid[1]-gesture.last[1])/v.scale];drawPaper();
        zoomAt(zoom*d/gesture.d,mid[0],mid[1]);gesture.last=mid;gesture.d=d;
      }else if(p.length===1&&!gesture.multi){const q=p[0];if(!gesture.moved&&Math.hypot(q[0]-gesture.start[0],q[1]-gesture.start[1])>6)gesture.moved=true;
        if(gesture.moved){calCenter=[v.cx-(q[0]-gesture.last[0])/v.scale,v.cy-(q[1]-gesture.last[1])/v.scale];drawPaper();queueHD();}gesture.last=q;}
    });
    paper.addEventListener('pointercancel',()=>{pointers.clear();gesture=null;});
    paper.addEventListener('pointerup',e=>{
      if(!pointers.has(e.pointerId))return;const q=local(e),g=gesture;pointers.delete(e.pointerId);
      if(!pointers.size){gesture=null;if(!current||busy||!calV||!g||g.multi||g.moved||Math.hypot(q[0]-g.start[0],q[1]-g.start[1])>6)return;
        const v=calV,x=(q[0]-v.x)/v.scale,y=(q[1]-v.y)/v.scale;
        if(x<0||y<0||x>current.width||y>current.height)return;
        setPoint(current,point,[x,y]);if(calMode==='two'&&point==='A')pointMode('B');
      }
    });
    paper.addEventListener('wheel',e=>{if(!current)return;e.preventDefault();const p=local(e);zoomAt(zoom*(e.deltaY<0?1.25:.8),...p);},{passive:false});
    function precision(){if(!current||!calV)return;const p=current[point];if(p)zoomAt(zoom*2,calV.x+p[0]*calV.scale,calV.y+p[1]*calV.scale);else zoomAt(zoom*2,calV.W/2,calV.H/2);}
    function close(){
      if(closed)return;closed=true;clearDetail();if(closeReader)closeReader();renderTask?.cancel();task?.destroy().catch(()=>{});if(raf)cancelAnimationFrame(raf);observer.disconnect();calObserver.disconnect();controls.dispose();
      if(backRemove)try{backRemove();}catch(e){}
      for(const l of layers){l.mesh.geometry.dispose();l.mesh.material.dispose();l.texture.dispose();l.canvas.width=l.canvas.height=0;}
      grid.geometry.dispose();grid.material.dispose();releaseCrop();paper.width=paper.height=0;renderer.dispose();renderer.forceContextLoss();el.remove();if(typeof options.onClose==='function')options.onClose();
    }
    if(typeof pushBack==='function')backRemove=pushBack(close);
    const on=(a,fn)=>{const b=$('[data-a="'+a+'"]');b.addEventListener('click',()=>{try{fn();}catch(e){msg(e.message);}});};
    on('close',close);on('layers',()=>{if(current){finish();return;}const d=$('[data-r="drawer"]');if(ws&&selectedLevel==='all'&&d.hidden){showOverview();return;}d.hidden=!d.hidden;$('[data-a="layers"]').setAttribute('aria-expanded',String(!d.hidden));});
    on('retry-save',async()=>{if(await save())msg('Projet enregistré sur cet appareil.');});
    on('drawerclose',()=>{$('[data-r="drawer"]').hidden=true;$('[data-a="layers"]').setAttribute('aria-expanded','false');});
    on('newlevel',()=>{
      if(!ws||busy||levels.length>=MAX_LEVELS)return;
      const input=$('[data-r="new-level"]'),alt=$('[data-r="new-z"]'),name=input.value.trim(),z=Number(alt.value);
      if(!name||!alt.value.trim()||!Number.isFinite(z)||Math.abs(z)>10000||levels.some(v=>v.name.toLowerCase()===name.toLowerCase())){msg('Nom unique et altitude en mètres requis.');return;}
      const v={id:DB.uid(),name,z};levels.push(v);input.value=alt.value='';setLevel(v.id);save();
    });
    $('[data-r="level-name"]').onchange=e=>{const v=levelBy(selectedLevel),name=e.target.value.trim();if(!v||!name||name.length>24||levels.some(x=>x!==v&&x.name.toLowerCase()===name.toLowerCase())){drawLevels();msg('Nom de niveau unique requis.');return;}v.name=name;update();save();};
    $('[data-r="level-z"]').onchange=e=>{const v=levelBy(selectedLevel),z=Number(e.target.value);if(!v||!e.target.value.trim()||!Number.isFinite(z)||Math.abs(z)>10000){drawLevels();return;}v.z=z;const l=layers.find(l=>l.levelId===v.id);if(l)l.z=z;update();fit();save();};
    on('projectplans',showSources);on('sourceclose',()=>{$('[data-r="sources"]').hidden=true;});$('[data-r="search"]').oninput=drawSources;
    on('add',()=>{if(!busy)$('[data-r="file"]').click();});
    $('[data-r="file"]').onchange=async e=>{
      const files=[...e.target.files],p=Number($('[data-r="page"]').value);e.target.value='';
      if(busy||closed)return;let first=null,errors=[];
      for(const f of (ws?files.slice(0,1):files)){if(closed)break;try{const id=await addFile(f,p);if(first===null)first=id;}catch(err){errors.push(f.name+' : '+(err.message||err));}}
      if(closed)return;
      if(first!==null){const l=layers.find(x=>x.id===first);if(l)edit(l);}
      if(errors.length)msg(errors.join(' · '));else if(first!==null)msg(calMode==='point'?'Import réussi · choisissez le point commun.':'Import réussi · choisissez A et B.');
    };
    on('planview',()=>viewPlan(layers.find(l=>l.levelId===selectedLevel)));
    on('3d',showAll);on('show-all',showAll);on('overview',showOverview);on('next-empty',nextEmpty);
    on('top',()=>{view='top';controls.enableRotate=false;$('[data-a="top"]').classList.add('active');$('[data-a="3d"]').classList.remove('active');fit();});
    on('detail3d',toggleDetail);
    on('fit',fit);on('zoomin',()=>{camera.position.sub(controls.target).multiplyScalar(.8).add(controls.target);controls.update();});on('zoomout',()=>{camera.position.sub(controls.target).multiplyScalar(1.25).add(controls.target);controls.update();});
    $('[data-r="cal-mode"]').onchange=e=>changeCalMode(e.target.value);
    on('pointA',()=>pointMode('A'));on('pointB',()=>pointMode('B'));on('calplus',()=>{if(calV)zoomAt(zoom*1.5,calV.W/2,calV.H/2);});on('calminus',()=>{if(calV)zoomAt(zoom/1.5,calV.W/2,calV.H/2);});
    on('aim',()=>{if(!current||busy||!calV)return;setPoint(current,point,[calV.cx,calV.cy]);if(calMode==='two'&&point==='A')pointMode('B');});
    on('precision',precision);on('fullpaper',()=>{if(current&&!busy){zoom=1;calCenter=[current.width/2,current.height/2];drawPaper();queueHD();}});on('clear',()=>{if(current&&!busy){current.A=current.B=null;current.validated=false;update();save();drawPaper();}});on('calclose',finish);on('apply',()=>valider());on('apply-next',()=>valider(true));
    $('[data-r="explode"]').onchange=()=>{update();fit();};$('[data-r="opacity"]').oninput=update;
    if(ws){$('[data-r="file"]').multiple=false;$('[data-r="drawer"]').hidden=true;$('[data-a="layers"]').setAttribute('aria-expanded','false');
      try{for(const p of (ws.plans||[])){const file=new File([p.file],p.name,{type:'application/pdf'});const id=await addFile(file,p.page,p.levelId);const l=layers.find(l=>l.id===id);l.A=p.A;l.B=p.B;l.validated=!!p.validated;l.visible=p.visible!==false;}ref=layers.find(l=>l.levelId===ws.referenceLevel)||layers[0]||null;distance=ws.distance||null;}
      catch(e){close();throw Error('Restauration du projet : '+(e.message||e));}finally{restoring=false;}
      msg('Projet local · choisissez un niveau pour importer ou consulter son PDF.');}
    resize();update();fit();
    return {close,addFile,addProjectPlan,projectSources,selectLevel:setLevel,flush:()=>ws?(writes.get(DB.name()+'|'+ws.id)||Promise.resolve(!saveFailed)):Promise.resolve(true),edit:id=>{const l=layers.find(x=>x.id===id);if(l)edit(l);},setPoint:(id,k,p)=>setPoint(layers.find(x=>x.id===id),k,p),setDistance:d=>{if(!ref||!ref.A||!ref.B)throw Error('Référence incomplète.');reference(ref.A,ref.B,d);distance=d;ref.validated=true;update();save();},validate:id=>{const l=layers.find(x=>x.id===id);if(!l||!l.A||!l.B||!distance||!ref?.validated)throw Error('Calage incomplet.');calage(l.A,l.B,[0,0],[distance,0]);l.validated=true;update();save();},detailState:()=>detailLayer?{levelId:detailLayer.levelId,width:detailCanvas.width,height:detailCanvas.height}:null,state:()=>layers.map(l=>({id:l.id,levelId:l.levelId,width:l.width,height:l.height,z:l.z,calibrated:!!l.t,visible:l.mesh.visible,transform:l.t?{...l.t}:null}))};
  }
  window.ModelCorePDFStack={open,openWorkspace,makeWorkspace,calage,calagePoint,appliquer,reference,transferView,calViewport};
})();
