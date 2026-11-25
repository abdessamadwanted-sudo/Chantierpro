/* ModelCore X — Plans PDF superposés, calage métrique local par deux points homologues. */
(function(){
  'use strict';
  if(window.ModelCorePDFStack)return;
  const MAX=8, COLORS=[0x70d9ff,0x9ae6bb,0xffd17a,0xd0b5ff,0xffa6b6,0x9abaff,0x80d8cb,0xffbe8f];
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
    await need3D();if(window.__late)await window.__late;
    const T=window.THREE;if(!T||!T.OrbitControls||!window.pdfjsLib)throw Error('Lecteur PDF ou WebGL indisponible.');
    const el=document.createElement('div');el.className='mc-pdfstack';
    el.innerHTML='<style>.mc-pdfstack{position:fixed;inset:0;z-index:1000000;display:flex;flex-direction:column;background:#08192a;color:#e6f4ff;font:13px system-ui,sans-serif;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}.mc-pdfstack *{box-sizing:border-box}.mc-pdfstack [hidden]{display:none!important}.mc-pdfstack button,.mc-pdfstack input,.mc-pdfstack select{background:#163348;color:#e6f4ff;border:1px solid #34586d;border-radius:8px;padding:8px;min-height:36px;font:inherit}.mc-pdfstack button.active{border-color:#55d9ee;color:#8af0ff;background:#155064}.mc-pdfstack button:disabled{opacity:.4}.mc-pdfstack .ps-head,.mc-pdfstack .ps-bar{display:flex;gap:6px;align-items:center;padding:8px;flex-shrink:0}.mc-pdfstack .ps-head{background:#0b2236}.mc-pdfstack .ps-head b{font-size:16px}.mc-pdfstack .ps-small{font-size:11px;color:#9bbacc}.mc-pdfstack .ps-grow{flex:1;min-width:0}.mc-pdfstack .ps-stage{position:relative;flex:1;min-height:100px;overflow:hidden;background:radial-gradient(ellipse,#24465b,#071625 75%)}.mc-pdfstack .ps-stage>canvas{width:100%;height:100%;display:block;touch-action:none}.mc-pdfstack .ps-cal{display:flex;flex-direction:column;flex:1;min-height:0;padding:8px;gap:5px}.mc-pdfstack .ps-preview{flex:1;min-height:120px;overflow:auto;background:#172b3c;touch-action:pan-x pan-y}.mc-pdfstack .ps-preview canvas{display:block;max-width:none;touch-action:pan-x pan-y}.mc-pdfstack .ps-drawer{max-height:43%;overflow:auto;padding:8px;background:#0d2538;border-top:1px solid #315267}.mc-pdfstack .ps-row{display:flex;align-items:center;gap:5px;margin:6px 0}.mc-pdfstack .ps-row input[type=number]{width:74px}.mc-pdfstack .ps-row b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}.mc-pdfstack .ps-status{padding:5px 10px;color:#a8d4e2;min-height:25px;font-size:11px}.mc-pdfstack .ps-top{position:absolute;top:8px;left:8px;right:8px;pointer-events:none;display:flex;justify-content:space-between}.mc-pdfstack .ps-top span{background:#0a2035dd;padding:6px;border-radius:6px}.mc-pdfstack .ps-cal .ps-bar{padding:0;flex-wrap:wrap}.mc-pdfstack .ps-cal .ps-bar input{width:90px}.mc-pdfstack .ps-point{color:#64e4ff}</style>'+
      '<div class="ps-head"><button data-a="close">✕</button><div class="ps-grow"><b>◈ ModelCore X · PDF Stack</b><div class="ps-small" data-r="project"></div></div><button data-a="layers" aria-expanded="false">☷ Plans</button></div>'+
      '<div class="ps-bar"><button data-a="3d" class="active">3D</button><button data-a="top">Dessus</button><button data-a="fit">Ajuster</button><button data-a="zoomout">−</button><button data-a="zoomin">+</button><label class="ps-small">Écart <select data-r="explode"><option value="1">Réel</option><option value="2">×2</option><option value="4">×4</option></select></label></div>'+
      '<div class="ps-stage" data-r="stage"><div class="ps-top"><span data-r="count">0 plan calé</span><span>1 doigt orbite · 2 doigts zoom/pan</span></div></div>'+
      '<div class="ps-cal" data-r="cal" hidden><div class="ps-bar"><b class="ps-grow" data-r="calname"></b><button data-a="calclose">Terminer</button></div><div class="ps-bar"><button data-a="pointA" class="active">Point A</button><button data-a="pointB">Point B</button><button data-a="calminus">−</button><button data-a="calplus">+</button><button data-a="clear">Effacer</button></div><div class="ps-small" data-r="instructions"></div><div class="ps-preview" data-r="preview"><canvas data-r="paper"></canvas></div><div class="ps-bar"><label>Distance A–B (m) <input data-r="distance" type="number" min=".01" max="10000" step=".01" value=""></label><button data-a="apply">Valider le calage</button></div></div>'+
      '<div class="ps-drawer" data-r="drawer"><div class="ps-row"><button data-a="add">＋ PDF</button><input data-r="file" type="file" accept=".pdf,application/pdf" multiple hidden><label class="ps-small">Page <input data-r="page" type="number" value="1" min="1" step="1" aria-label="Page PDF"></label><label class="ps-small">Opacité <input data-r="opacity" type="range" min="20" max="100" value="100"></label></div><div class="ps-small">Premier PDF = référence. Même point A et B sur chaque plan; saisir les altitudes en mètres. Max. 8 plans. Session locale.</div><div data-r="list"></div></div><div class="ps-status" data-r="status" aria-live="polite">Ajoutez le PDF de référence.</div>';
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
    const layers=[];let ref=null,current=null,point='A',zoom=1,closed=false,busy=false,raf=0,task=null,renderTask=null,backRemove=null,distance=null,view='3d',serial=0;
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
    function transform(l){if(!ref||!ref.A||!ref.B||!distance||!l.A||!l.B)return null;return l===ref?reference(l.A,l.B,distance):calage(l.A,l.B,[0,0],[distance,0]);}
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
      if(file.size>25*1024*1024)throw Error('PDF limité à 25 Mo.');
      if(!Number.isInteger(pageNo)||pageNo<1)throw Error('Numéro de page invalide.');
      busy=true;msg('Lecture locale : '+file.name);
      let canvas=null,committed=false;
      try{
        const bytes=new Uint8Array(await file.arrayBuffer());if(closed)throw Error('Session fermée.');
        task=pdfjsLib.getDocument({data:bytes});const doc=await task.promise;
        if(pageNo>doc.numPages)throw Error('Le PDF ne contient que '+doc.numPages+' pages.');
        const p=await doc.getPage(pageNo),v=p.getViewport({scale:1});
        const max=Math.min(1536,renderer.capabilities.maxTextureSize),vp=p.getViewport({scale:max/Math.max(v.width,v.height)});
        canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(vp.width));canvas.height=Math.max(1,Math.ceil(vp.height));
        renderTask=p.render({canvasContext:canvas.getContext('2d'),viewport:vp,background:'rgb(255,255,255)'});await renderTask.promise;renderTask=null;
        if(closed)throw Error('Session fermée.');
        const texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
        const geo=new T.PlaneGeometry(1,1);geo.rotateX(-Math.PI/2);
        const mat=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,toneMapped:false,transparent:false});
        const mesh=new T.Mesh(geo,mat);mesh.visible=false;group.add(mesh);
        const l={id:++serial,name:String(file.name).slice(0,120),page:pageNo,width:v.width,height:v.height,canvas,texture,mesh,z:layers.length*3,visible:true,A:null,B:null,t:null,color:COLORS[layers.length%COLORS.length]};
        layers.push(l);committed=true;if(!ref)ref=l;update();msg('PDF importé. Calage requis avant affichage.');return l.id;
      }finally{
        renderTask=null;const t=task;task=null;if(t)await t.destroy().catch(()=>{});if(canvas&&!committed)canvas.width=canvas.height=0;busy=false;
      }
    }
    function drawPaper(){
      if(!current)return;const c=current.canvas;paper.width=c.width;paper.height=c.height;paper.style.width=(zoom*100)+'%';paper.style.height='auto';
      const ctx=paper.getContext('2d');ctx.drawImage(c,0,0);
      const radius=Math.max(6,c.width/120);
      for(const k of ['A','B'])if(current[k]){
        const x=current[k][0]/current.width*c.width,y=current[k][1]/current.height*c.height;ctx.strokeStyle=k==='A'?'#0086b0':'#c37300';ctx.lineWidth=Math.max(2,radius/4);ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.moveTo(x-radius*2,y);ctx.lineTo(x+radius*2,y);ctx.moveTo(x,y-radius*2);ctx.lineTo(x,y+radius*2);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.font='bold '+radius*2+'px sans-serif';ctx.fillText(k,x+radius,y-radius);
      }
      if(current.A&&current.B){ctx.strokeStyle='#087baf';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(current.A[0]/current.width*c.width,current.A[1]/current.height*c.height);ctx.lineTo(current.B[0]/current.width*c.width,current.B[1]/current.height*c.height);ctx.stroke();}
    }
    function edit(l){
      current=l;zoom=1;point='A';stage.hidden=true;$('[data-r="cal"]').hidden=false;$('[data-r="drawer"]').hidden=true;
      $('[data-r="calname"]').textContent=l.name+(l===ref?' · Référence':'');
      $('[data-r="distance"]').value=distance||'';$('[data-r="distance"]').disabled=l!==ref;
      $('[data-r="instructions"]').textContent=l===ref?'Choisissez A puis B, saisissez la distance réelle A–B (m).':'Repérez exactement les mêmes axes A puis B que sur le PDF de référence.';
      drawPaper();pointMode('A');
    }
    function pointMode(k){point=k;for(const n of ['A','B'])$('[data-a="point'+n+'"]').classList.toggle('active',k===n);}
    function setPoint(l,k,p){
      if(!l||!['A','B'].includes(k)||!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[1]<0||p[0]>l.width||p[1]>l.height)throw Error('Point hors plan.');
      l[k]=p.slice();update();if(current===l)drawPaper();
    }
    function finish(){current=null;paper.width=paper.height=0;$('[data-r="cal"]').hidden=true;stage.hidden=false;resize();update();fit();}
    function valider(){
      if(!current?.A||!current?.B)throw Error('Choisissez A et B.');
      if(current===ref){const d=Number($('[data-r="distance"]').value);reference(current.A,current.B,d);distance=d;}
      else{if(!distance)throw Error('Calez d’abord la référence.');calage(current.A,current.B,[0,0],[distance,0]);}
      update();finish();msg('Calage validé. Vérifiez un troisième point indépendant sur les plans.');
    }
    let down=null;
    paper.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY,e.pointerId];});
    paper.addEventListener('pointercancel',()=>{down=null;});
    paper.addEventListener('pointerup',e=>{if(!current||!down||down[2]!==e.pointerId||Math.hypot(e.clientX-down[0],e.clientY-down[1])>8){down=null;return;}down=null;const r=paper.getBoundingClientRect();setPoint(current,point,[Math.max(0,Math.min(current.width,(e.clientX-r.left)/r.width*current.width)),Math.max(0,Math.min(current.height,(e.clientY-r.top)/r.height*current.height))]);if(point==='A')pointMode('B');});
    function close(){
      if(closed)return;closed=true;renderTask?.cancel();task?.destroy().catch(()=>{});if(raf)cancelAnimationFrame(raf);observer.disconnect();controls.dispose();
      if(backRemove)try{backRemove();}catch(e){}
      for(const l of layers){l.mesh.geometry.dispose();l.mesh.material.dispose();l.texture.dispose();l.canvas.width=l.canvas.height=0;}
      grid.geometry.dispose();grid.material.dispose();paper.width=paper.height=0;renderer.dispose();renderer.forceContextLoss();el.remove();
    }
    if(typeof pushBack==='function')backRemove=pushBack(close);
    const on=(a,fn)=>{const b=$('[data-a="'+a+'"]');b.addEventListener('click',()=>{try{fn();}catch(e){msg(e.message);}});};
    on('close',close);on('layers',()=>{if(current)finish();const d=$('[data-r="drawer"]');d.hidden=!d.hidden;$('[data-a="layers"]').setAttribute('aria-expanded',String(!d.hidden));});
    on('add',()=>$('[data-r="file"]').click());
    $('[data-r="file"]').onchange=async e=>{const files=[...e.target.files],p=Number($('[data-r="page"]').value);e.target.value='';for(const f of files){try{await addFile(f,p);}catch(err){msg(err.message);break;}}if(!closed&&layers.length===1&&!layers[0].t)edit(layers[0]);};
    on('3d',()=>{view='3d';controls.enableRotate=true;$('[data-a="3d"]').classList.add('active');$('[data-a="top"]').classList.remove('active');fit();});
    on('top',()=>{view='top';controls.enableRotate=false;$('[data-a="top"]').classList.add('active');$('[data-a="3d"]').classList.remove('active');fit();});
    on('fit',fit);on('zoomin',()=>{camera.position.sub(controls.target).multiplyScalar(.8).add(controls.target);controls.update();});on('zoomout',()=>{camera.position.sub(controls.target).multiplyScalar(1.25).add(controls.target);controls.update();});
    on('pointA',()=>pointMode('A'));on('pointB',()=>pointMode('B'));on('calplus',()=>{zoom=Math.min(6,zoom*1.5);drawPaper();});on('calminus',()=>{zoom=Math.max(1,zoom/1.5);drawPaper();});
    on('clear',()=>{if(current){current.A=current.B=null;update();drawPaper();}});on('calclose',finish);on('apply',valider);
    $('[data-r="explode"]').onchange=()=>{update();fit();};$('[data-r="opacity"]').oninput=update;
    resize();fit();
    return {close,addFile,edit:id=>{const l=layers.find(x=>x.id===id);if(l)edit(l);},setPoint:(id,k,p)=>setPoint(layers.find(x=>x.id===id),k,p),setDistance:d=>{if(!ref||!ref.A||!ref.B)throw Error('Référence incomplète.');reference(ref.A,ref.B,d);distance=d;update();},state:()=>layers.map(l=>({id:l.id,width:l.width,height:l.height,z:l.z,calibrated:!!l.t,visible:l.mesh.visible,transform:l.t?{...l.t}:null}))};
  }
  window.ModelCorePDFStack={open,calage,appliquer,reference};
})();
