/* ModelCore X — Plans PDF superposés, calage métrique local par deux points homologues. */
(function(){
  'use strict';
  if(window.ModelCorePDFStack)return;
  const MAX=8, MAX_BYTES=60*1024*1024, COLORS=[0x70d9ff,0x9ae6bb,0xffd17a,0xd0b5ff,0xffa6b6,0x9abaff,0x80d8cb,0xffbe8f];
  function calage(a,b,A,B){
    if(![a,b,A,B].every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))throw Error('Repères invalides.');
    const x=b[0]-a[0],y=b[1]-a[1],X=B[0]-A[0],Y=B[1]-A[1],d=x*x+y*y;
    if(d<1e-8||X*X+Y*Y<1e-8)throw Error('Deux points distincts sont nécessaires.');
    const c=(x*X+y*Y)/d,s=(x*Y-y*X)/d;
    return {c,s,tx:A[0]-c*a[0]+s*a[1],tz:A[1]-s*a[0]-c*a[1],scale:Math.hypot(c,s),angle:Math.atan2(s,c)};
  }
  function appliquer(t,p){return [t.c*p[0]-t.s*p[1]+t.tx,t.s*p[0]+t.c*p[1]+t.tz];}
  function reference(a,b,d){
    if(!Number.isFinite(d)||d<=0||d>10000)throw Error('Distance A–B en mètres requise.');
    return calage(a,b,[0,0],[d,0]);
  }
  async function open(options={}){
    await need3D();
    // Même initialisation que le lecteur de plans SiteTeam : worker embarqué,
    // y compris à la première ouverture après un démarrage à froid.
    if(typeof pdfReadyA!=='function'||!(await pdfReadyA()))throw Error('Lecteur PDF indisponible. Vérifiez la mise à jour.');
    const T=window.THREE;if(!T||!T.OrbitControls)throw Error('WebGL indisponible.');
    const el=document.createElement('div');el.className='mc-pdfstack';
    el.innerHTML='<style>.mc-pdfstack{position:fixed;inset:0;z-index:1000000;display:flex;flex-direction:column;background:#08192a;color:#e6f4ff;font:13px system-ui,sans-serif;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}.mc-pdfstack *{box-sizing:border-box}.mc-pdfstack [hidden]{display:none!important}.mc-pdfstack button,.mc-pdfstack input,.mc-pdfstack select{background:#163348;color:#e6f4ff;border:1px solid #34586d;border-radius:8px;padding:8px;min-height:36px;font:inherit}.mc-pdfstack button.active{border-color:#55d9ee;color:#8af0ff;background:#155064}.mc-pdfstack button:disabled{opacity:.4}.mc-pdfstack .ps-head,.mc-pdfstack .ps-bar{display:flex;gap:6px;align-items:center;padding:8px;flex-shrink:0}.mc-pdfstack .ps-head{background:#0b2236}.mc-pdfstack .ps-head b{font-size:16px}.mc-pdfstack .ps-small{font-size:11px;color:#9bbacc}.mc-pdfstack .ps-grow{flex:1;min-width:0}.mc-pdfstack .ps-stage{position:relative;flex:1;min-height:100px;overflow:hidden;background:radial-gradient(ellipse,#24465b,#071625 75%)}.mc-pdfstack .ps-stage>canvas{width:100%;height:100%;display:block;touch-action:none}.mc-pdfstack .ps-cal{display:flex;flex-direction:column;flex:1;min-height:0;padding:8px;gap:5px}.mc-pdfstack .ps-preview{flex:1;min-height:120px;overflow:auto;background:#172b3c;touch-action:pan-x pan-y}.mc-pdfstack .ps-preview canvas{display:block;max-width:none;touch-action:pan-x pan-y}.mc-pdfstack .ps-drawer{max-height:43%;overflow:auto;padding:8px;background:#0d2538;border-top:1px solid #315267}.mc-pdfstack .ps-row{display:flex;align-items:center;gap:5px;margin:6px 0}.mc-pdfstack .ps-row input[type=number]{width:74px}.mc-pdfstack .ps-row b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}.mc-pdfstack .ps-status{padding:5px 10px;color:#a8d4e2;min-height:25px;font-size:11px}.mc-pdfstack .ps-top{position:absolute;top:8px;left:8px;right:8px;pointer-events:none;display:flex;justify-content:space-between}.mc-pdfstack .ps-top span{background:#0a2035dd;padding:6px;border-radius:6px}.mc-pdfstack .ps-cal .ps-bar{padding:0;flex-wrap:wrap}.mc-pdfstack .ps-cal .ps-bar input{width:90px}.mc-pdfstack .ps-point{color:#64e4ff}.mc-pdfstack .ps-source{border:1px solid #34586d;border-radius:8px;padding:6px;margin:6px 0}.mc-pdfstack .ps-source input[type=search]{width:100%}.mc-pdfstack .ps-source-list{max-height:180px;overflow:auto}.mc-pdfstack .ps-source-list button{text-align:left;width:100%;margin:3px 0;white-space:normal;overflow-wrap:anywhere}.mc-pdfstack .ps-source-list small{display:block;color:#a8c7d8}.mc-pdfstack .ps-bar{overflow-x:auto}.mc-pdfstack .ps-drawer .ps-row{flex-wrap:wrap}</style>'+
      '<div class="ps-head"><button data-a="close">✕</button><div class="ps-grow"><b>◈ ModelCore X · PDF Stack</b><div class="ps-small" data-r="project"></div></div><button data-a="layers" aria-expanded="true">☷ Plans</button></div>'+
      '<div class="ps-bar"><button data-a="3d" class="active">3D</button><button data-a="top">Dessus</button><button data-a="fit">Ajuster</button><button data-a="zoomout">−</button><button data-a="zoomin">+</button><label class="ps-small">Écart <select data-r="explode"><option value="1">Réel</option><option value="2">×2</option><option value="4">×4</option></select></label></div>'+
      '<div class="ps-stage" data-r="stage"><div class="ps-top"><span data-r="count">0 plan calé</span><span>1 doigt orbite · 2 doigts zoom/pan</span></div></div>'+
      '<div class="ps-cal" data-r="cal" hidden><div class="ps-bar"><b class="ps-grow" data-r="calname"></b><button data-a="calclose">Terminer</button></div><div class="ps-bar"><button data-a="pointA" class="active">Point A</button><button data-a="pointB">Point B</button><button data-a="calminus">−</button><button data-a="calplus">+</button><button data-a="precision">◎ Précision</button><button data-a="fullpaper" hidden>Plan entier</button><button data-a="clear">Effacer</button></div><div class="ps-small" data-r="instructions"></div><div class="ps-preview" data-r="preview"><canvas data-r="paper"></canvas></div><div class="ps-bar"><label>Distance A–B (m) <input data-r="distance" type="number" min=".01" max="10000" step=".01" value=""></label><button data-a="apply">Valider le calage</button></div></div>'+
      '<div class="ps-drawer" data-r="drawer"><div class="ps-row"><button data-a="projectplans">▤ Plans du projet</button><button data-a="add">＋ Téléphone</button><input data-r="file" type="file" accept="*/*" multiple hidden><label class="ps-small">Page <input data-r="page" type="number" value="1" min="1" step="1" aria-label="Page PDF"></label><label class="ps-small">Opacité <input data-r="opacity" type="range" min="20" max="100" value="100"></label></div><div class="ps-source" data-r="sources" hidden><div class="ps-row"><b class="ps-grow">Niveaux · PDF du projet</b><button data-a="sourceclose">✕</button></div><input type="search" data-r="search" placeholder="Rechercher niveau, dossier ou plan…" aria-label="Rechercher un plan"><div class="ps-source-list" data-r="source-list"></div></div><div class="ps-small">Premier PDF = référence. Les plans importés apparaissent dans la liste; appuyez sur Caler pour les afficher en 3D. Max. 8 plans · 60 Mo/PDF · session locale.</div><div data-r="list"></div></div><div class="ps-status" data-r="status" aria-live="polite">Ajoutez le PDF de référence.</div>';
    document.body.appendChild(el);
    const $=s=>el.querySelector(s),stage=$('[data-r="stage"]'),paper=$('[data-r="paper"]'),rows=$('[data-r="list"]');
    $('[data-r="project"]').textContent=String(options.projectName||'Projet')+' · session locale · PDF originaux inchangés';
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
    const layers=[];let ref=null,current=null,point='A',zoom=1,crop=null,closed=false,busy=false,raf=0,task=null,renderTask=null,backRemove=null,distance=null,view='3d',serial=0,sources=[];
    function msg(s){$('[data-r="status"]').textContent=s;}
    function schedule(){if(closed||raf)return;raf=requestAnimationFrame(()=>{raf=0;if(!stage.hidden)renderer.render(scene,camera);});}
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
    function transform(l){if(!ref||!ref.validated||!ref.A||!ref.B||!distance||!l.validated||!l.A||!l.B)return null;return l===ref?reference(l.A,l.B,distance):calage(l.A,l.B,[0,0],[distance,0]);}
    function update(){
      let n=0;const gap=Number($('[data-r="explode"]').value),opacity=Number($('[data-r="opacity"]').value)/100;
      for(const l of layers){
        let t=null;try{t=transform(l);}catch(e){}
        l.t=t;l.mesh.visible=!!t&&l.visible;
        if(t){const c=appliquer(t,[l.width/2,l.height/2]);l.mesh.position.set(c[0],l.z*gap,c[1]);l.mesh.rotation.y=-t.angle;l.mesh.scale.set(l.width*t.scale,1,l.height*t.scale);l.mesh.material.opacity=opacity;l.mesh.material.transparent=opacity<1;l.mesh.material.depthWrite=opacity===1;l.mesh.material.needsUpdate=true;if(l.visible)n++;}
      }
      $('[data-r="count"]').textContent=n+' / '+layers.length+' plans calés visibles';list();schedule();
    }
    function list(){
      rows.replaceChildren();
      for(const l of layers){
        const row=document.createElement('div');row.className='ps-row';
        const cb=document.createElement('input');cb.type='checkbox';cb.checked=l.visible;cb.setAttribute('aria-label','Afficher '+l.name);cb.onchange=()=>{l.visible=cb.checked;update();};
        const info=document.createElement('div');info.className='ps-grow';const title=document.createElement('b');title.textContent=l.name+' · p.'+l.page;const sub=document.createElement('div');sub.className='ps-small';sub.textContent=(l===ref?'RÉFÉRENCE · ':'')+(l.t?'Calé':'À caler');sub.style.color=l.t?'#8de5c5':'#f2ca80';info.append(title,sub);
        const z=document.createElement('input');z.type='number';z.step='.01';z.value=l.z;z.setAttribute('aria-label','Altitude en mètres');z.onchange=()=>{const n=Number(z.value);if(Number.isFinite(n)&&Math.abs(n)<=10000)l.z=n;else z.value=l.z;update();};
        const c=document.createElement('button');c.textContent='Caler';c.onclick=()=>edit(l);
        const del=document.createElement('button');del.textContent='✕';del.title='Retirer ce plan de la session';del.onclick=()=>{if(busy)return;if(l===ref&&layers.length>1){msg('Retirez les autres plans avant la référence.');return;}remove(l);};
        row.append(cb,info,z,c,del);rows.append(row);
      }
    }
    function remove(l){if(current===l)finish();group.remove(l.mesh);l.mesh.geometry.dispose();l.mesh.material.dispose();l.texture.dispose();l.canvas.width=l.canvas.height=0;layers.splice(layers.indexOf(l),1);if(ref===l){ref=null;distance=null;}update();fit();}
    async function addFile(file,pageNo=1){
      if(closed||busy)throw Error('Import déjà en cours ou fermé.');
      if(layers.length>=MAX)throw Error('Maximum '+MAX+' plans par session.');
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
        const max=Math.min(layers.length>=4?1024:1536,renderer.capabilities.maxTextureSize),vp=p.getViewport({scale:max/Math.max(v.width,v.height)});
        canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(vp.width));canvas.height=Math.max(1,Math.ceil(vp.height));
        renderTask=p.render({canvasContext:canvas.getContext('2d'),viewport:vp,background:'rgb(255,255,255)'});await renderTask.promise;renderTask=null;
        if(closed)throw Error('Session fermée.');
        const texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
        const geo=new T.PlaneGeometry(1,1);geo.rotateX(-Math.PI/2);
        const mat=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,toneMapped:false,transparent:false});
        const mesh=new T.Mesh(geo,mat);mesh.visible=false;group.add(mesh);
        const l={id:++serial,name:String(file.name).slice(0,120),page:pageNo,file,width:v.width,height:v.height,canvas,texture,mesh,z:layers.length*3,visible:true,A:null,B:null,validated:false,t:null,color:COLORS[layers.length%COLORS.length]};
        layers.push(l);committed=true;if(!ref)ref=l;update();msg('PDF importé. Calage requis avant affichage.');return l.id;
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
    async function addProjectPlan(id){
      if(busy||closed)throw Error('Import en cours ou session fermée.');
      if(layers.length>=MAX)throw Error('Maximum '+MAX+' plans par session.');
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
      return addFile(file,Number(plan.pdfPage)||1);
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
    function releaseCrop(){if(crop){crop.canvas.width=crop.canvas.height=0;crop=null;}$('[data-a="fullpaper"]').hidden=true;}
    function drawPaper(){
      if(!current)return;const c=crop?.canvas||current.canvas,region=crop||{x:0,y:0,w:current.width,h:current.height};paper.width=c.width;paper.height=c.height;paper.style.width=(zoom*100)+'%';paper.style.height='auto';
      const ctx=paper.getContext('2d');ctx.drawImage(c,0,0);
      const radius=Math.max(6,c.width/120);
      for(const k of ['A','B'])if(current[k]){
        const x=(current[k][0]-region.x)/region.w*c.width,y=(current[k][1]-region.y)/region.h*c.height;ctx.strokeStyle=k==='A'?'#0086b0':'#c37300';ctx.lineWidth=Math.max(2,radius/4);ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.moveTo(x-radius*2,y);ctx.lineTo(x+radius*2,y);ctx.moveTo(x,y-radius*2);ctx.lineTo(x,y+radius*2);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.font='bold '+radius*2+'px sans-serif';ctx.fillText(k,x+radius,y-radius);
      }
      if(current.A&&current.B){ctx.strokeStyle='#087baf';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo((current.A[0]-region.x)/region.w*c.width,(current.A[1]-region.y)/region.h*c.height);ctx.lineTo((current.B[0]-region.x)/region.w*c.width,(current.B[1]-region.y)/region.h*c.height);ctx.stroke();}
    }
    function edit(l){
      if(busy)return;releaseCrop();current=l;zoom=1;point='A';stage.hidden=true;$('[data-r="cal"]').hidden=false;$('[data-r="drawer"]').hidden=true;
      $('[data-r="calname"]').textContent=l.name+(l===ref?' · Référence':'');
      $('[data-r="distance"]').value=distance||'';$('[data-r="distance"]').disabled=l!==ref;
      $('[data-r="instructions"]').textContent=l===ref?'Choisissez A puis B, saisissez la distance réelle A–B (m).':'Repérez exactement les mêmes axes A puis B que sur le PDF de référence.';
      drawPaper();pointMode('A');
    }
    function pointMode(k){point=k;for(const n of ['A','B'])$('[data-a="point'+n+'"]').classList.toggle('active',k===n);}
    function setPoint(l,k,p){
      if(!l||!['A','B'].includes(k)||!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[1]<0||p[0]>l.width||p[1]>l.height)throw Error('Point hors plan.');
      l[k]=p.slice();l.validated=false;update();if(current===l)drawPaper();
    }
    function finish(){if(busy)return;releaseCrop();current=null;paper.width=paper.height=0;$('[data-r="cal"]').hidden=true;stage.hidden=false;$('[data-r="drawer"]').hidden=false;$('[data-a="layers"]').setAttribute('aria-expanded','true');resize();update();fit();}
    function valider(){
      if(busy)throw Error('Lecture PDF en cours.');if(!current?.A||!current?.B)throw Error('Choisissez A et B.');
      if(current===ref){const d=Number($('[data-r="distance"]').value);reference(current.A,current.B,d);distance=d;}
      else{if(!distance)throw Error('Calez d’abord la référence.');calage(current.A,current.B,[0,0],[distance,0]);}
      current.validated=true;update();finish();msg('Calage validé. Vérifiez un troisième point indépendant sur les plans.');
    }
    let down=null;
    paper.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY,e.pointerId];});
    paper.addEventListener('pointercancel',()=>{down=null;});
    paper.addEventListener('pointerup',e=>{if(!current||!down||down[2]!==e.pointerId||Math.hypot(e.clientX-down[0],e.clientY-down[1])>8){down=null;return;}down=null;const r=paper.getBoundingClientRect(),region=crop||{x:0,y:0,w:current.width,h:current.height};if(busy)return;setPoint(current,point,[Math.max(0,Math.min(current.width,region.x+(e.clientX-r.left)/r.width*region.w)),Math.max(0,Math.min(current.height,region.y+(e.clientY-r.top)/r.height*region.h))]);if(point==='A'&&!crop)pointMode('B');});
    // Rendu natif d'une petite région du PDF original, sans bitmap A0 géant.
    async function precision(){
      if(busy||!current)return;
      const l=current,anchor=l[point];
      if(!anchor){msg('Placez approximativement le point '+point+' avant de zoomer en précision.');return;}
      busy=true;let c=null;
      try{
        const span=Math.max(8,Math.min(l.width,l.height)/(crop?30:6));
        const x=Math.max(0,Math.min(l.width-span,anchor[0]-span/2)),y=Math.max(0,Math.min(l.height-span,anchor[1]-span/2));
        task=pdfjsLib.getDocument({data:new Uint8Array(await l.file.arrayBuffer()),isEvalSupported:false});
        const doc=await task.promise,p=await doc.getPage(l.page),scale=1200/span;
        c=document.createElement('canvas');c.width=c.height=1200;
        const vp=p.getViewport({scale,offsetX:-x*scale,offsetY:-y*scale});
        renderTask=p.render({canvasContext:c.getContext('2d'),viewport:vp,background:'rgb(255,255,255)'});
        await renderTask.promise;
        if(closed||current!==l)return;
        releaseCrop();crop={canvas:c,x,y,w:span,h:span};c=null;zoom=1;drawPaper();
        $('[data-a="fullpaper"]').hidden=false;msg('Précision : cliquez sur le même repère '+point+' dans le détail PDF.');
      }catch(e){if(!closed)msg(e.message||String(e));}
      finally{renderTask=null;const t=task;task=null;if(t)await t.destroy().catch(()=>{});if(c)c.width=c.height=0;busy=false;}
    }
    function close(){
      if(closed)return;closed=true;renderTask?.cancel();task?.destroy().catch(()=>{});if(raf)cancelAnimationFrame(raf);observer.disconnect();controls.dispose();
      if(backRemove)try{backRemove();}catch(e){}
      for(const l of layers){l.mesh.geometry.dispose();l.mesh.material.dispose();l.texture.dispose();l.canvas.width=l.canvas.height=0;}
      grid.geometry.dispose();grid.material.dispose();releaseCrop();paper.width=paper.height=0;renderer.dispose();renderer.forceContextLoss();el.remove();if(typeof options.onClose==='function')options.onClose();
    }
    if(typeof pushBack==='function')backRemove=pushBack(close);
    const on=(a,fn)=>{const b=$('[data-a="'+a+'"]');b.addEventListener('click',()=>{try{fn();}catch(e){msg(e.message);}});};
    on('close',close);on('layers',()=>{if(current)finish();const d=$('[data-r="drawer"]');d.hidden=!d.hidden;$('[data-a="layers"]').setAttribute('aria-expanded',String(!d.hidden));});
    on('projectplans',showSources);on('sourceclose',()=>{$('[data-r="sources"]').hidden=true;});$('[data-r="search"]').oninput=drawSources;
    on('add',()=>{if(!busy)$('[data-r="file"]').click();});
    $('[data-r="file"]').onchange=async e=>{
      const files=[...e.target.files],p=Number($('[data-r="page"]').value);e.target.value='';
      if(busy||closed)return;let first=null,errors=[];
      for(const f of files){if(closed)break;try{const id=await addFile(f,p);if(first===null)first=id;}catch(err){errors.push(f.name+' : '+(err.message||err));}}
      if(closed)return;
      if(first!==null){const l=layers.find(x=>x.id===first);if(l)edit(l);}
      if(errors.length)msg(errors.join(' · '));else if(first!==null)msg('Import réussi · choisissez A et B pour afficher le plan.');
    };
    on('3d',()=>{view='3d';controls.enableRotate=true;$('[data-a="3d"]').classList.add('active');$('[data-a="top"]').classList.remove('active');fit();});
    on('top',()=>{view='top';controls.enableRotate=false;$('[data-a="top"]').classList.add('active');$('[data-a="3d"]').classList.remove('active');fit();});
    on('fit',fit);on('zoomin',()=>{camera.position.sub(controls.target).multiplyScalar(.8).add(controls.target);controls.update();});on('zoomout',()=>{camera.position.sub(controls.target).multiplyScalar(1.25).add(controls.target);controls.update();});
    on('pointA',()=>pointMode('A'));on('pointB',()=>pointMode('B'));on('calplus',()=>{zoom=Math.min(6,zoom*1.5);drawPaper();});on('calminus',()=>{zoom=Math.max(1,zoom/1.5);drawPaper();});
    on('precision',precision);on('fullpaper',()=>{if(!busy){releaseCrop();zoom=1;drawPaper();}});on('clear',()=>{if(current&&!busy){current.A=current.B=null;current.validated=false;update();drawPaper();}});on('calclose',finish);on('apply',valider);
    $('[data-r="explode"]').onchange=()=>{update();fit();};$('[data-r="opacity"]').oninput=update;
    resize();fit();
    return {close,addFile,addProjectPlan,projectSources,edit:id=>{const l=layers.find(x=>x.id===id);if(l)edit(l);},setPoint:(id,k,p)=>setPoint(layers.find(x=>x.id===id),k,p),setDistance:d=>{if(!ref||!ref.A||!ref.B)throw Error('Référence incomplète.');reference(ref.A,ref.B,d);distance=d;ref.validated=true;update();},validate:id=>{const l=layers.find(x=>x.id===id);if(!l||!l.A||!l.B||!distance||!ref?.validated)throw Error('Calage incomplet.');calage(l.A,l.B,[0,0],[distance,0]);l.validated=true;update();},state:()=>layers.map(l=>({id:l.id,width:l.width,height:l.height,z:l.z,calibrated:!!l.t,visible:l.mesh.visible,transform:l.t?{...l.t}:null}))};
  }
  window.ModelCorePDFStack={open,calage,appliquer,reference};
})();
