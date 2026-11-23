/* SiteTeam ModelCore 3D — prototype expérimental, chargement différé.
 * Affichage WebGL, géométrie fictive; aucun import IFC/RVT ni données de chantier réelles.
 * La géométrie et les fiches d'ouvrage sont indépendantes pour préparer le futur mapping BIM.
 */
(function () {
  'use strict';
  if (window.ModelCore3D) return;
  const STATES = ['Non commencé', 'En cours', 'En attente', 'Réceptionné', 'Non conforme'];
  const STATUS_COLOR = { 'Non commencé': 0x94a3b8, 'En cours': 0x60a5fa, 'En attente': 0xfbbf24, 'Réceptionné': 0x34d399, 'Non conforme': 0xfb7185 };
  const SCHEMA = 'siteteam-modelcore-v1';
  // Types libres : ne pas réduire les objets IFC inconnus à une catégorie unique.
  function clean(s) { return String(s == null ? '' : s).slice(0, 120); }
  function finite(n) { return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1000000; }
  function vec(v, count) { return Array.isArray(v) && v.length === count && v.every(finite); }
  // Ce format neutre est un résultat de conversion, PAS un lecteur IFC/RVT.
  function validateManifest(m) {
    if (!m || m.schema !== SCHEMA || !Array.isArray(m.elements) || !m.elements.length || m.elements.length > 5000)
      throw new Error('Manifeste ModelCore invalide ou trop volumineux (max. 5000 ouvrages).');
    const seen = new Set();
    return m.elements.map((e, i) => {
      if (!e || typeof e.id !== 'string' || !e.id.trim() || e.id.length > 128 || seen.has(e.id))
        throw new Error('Identifiant manquant ou dupliqué à la ligne ' + (i + 1));
      seen.add(e.id);
      const g = e.geometry || {};
      if (g.kind === 'box') {
        if (!vec(g.size, 3) || !g.size.every(x => x > 0) || !vec(g.position, 3))
          throw new Error('Dimensions/position invalides pour ' + e.id);
      } else if (g.kind === 'beam') {
        if (!vec(g.start, 3) || !vec(g.end, 3) || !finite(g.width) || !finite(g.depth) || g.width <= 0 || g.depth <= 0)
          throw new Error('Poutre invalide pour ' + e.id);
      } else if (g.kind === 'mesh') {
        if (!Array.isArray(g.positions) || !Array.isArray(g.indices) ||
            g.positions.length < 9 || g.positions.length > 150000 || g.positions.length % 3 ||
            g.indices.length < 3 || g.indices.length > 300000 || g.indices.length % 3 ||
            !g.positions.every(finite) || !g.indices.every(n => Number.isInteger(n) && n >= 0 && n < g.positions.length / 3))
          throw new Error('Maillage invalide pour ' + e.id);
      } else throw new Error('Géométrie non prise en charge pour ' + e.id);
      return {
        id: e.id, type: clean(e.type || 'Autre'),
        building: clean(e.building || 'Bâtiment non défini'), lot: clean(e.lot || 'Non défini'),
        zone: clean(e.zone || 'Non classée'), level: clean(e.level || 'Non défini'),
        sourceId: clean(e.sourceId || ''), sourceFormat: clean(e.sourceFormat || ''),
        modelVersion: clean(e.modelVersion || ''), description: clean(e.description || ''),
        status: STATES.includes(e.status) ? e.status : 'Non commencé', progress: finite(e.progress) ? Math.max(0, Math.min(100, e.progress)) : 0,
        geometry: g
      };
    });
  }
  function createDemo() {
    const elements = [], sectors = 32, tiers = 8;
    let serial = 0;
    const add = (type, zone, level, geometry, description) => {
      const i = ++serial, status = i % 37 === 0 ? 'Non conforme' : i % 7 === 0 ? 'En attente' : i % 5 === 0 ? 'En cours' : 'Réceptionné';
      elements.push({ id: 'STD-' + String(i).padStart(5, '0'), type, zone, level, status,
        progress: status === 'Réceptionné' ? 100 : status === 'Non conforme' ? 35 : status === 'En attente' ? 80 : 55,
        description: description || '', sourceFormat: 'DEMO', geometry });
    };
    const pt = (a, rx, rz, y) => [Math.cos(a) * rx, y, Math.sin(a) * rz];
    const zoneOf = a => Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'Est' : 'Ouest') : (Math.sin(a) > 0 ? 'Sud' : 'Nord');
    const box = (type, zone, level, size, position, description) => add(type, zone, level, { kind: 'box', size, position }, description);
    const beam = (type, zone, level, start, end, width, depth) => add(type, zone, level, { kind: 'beam', start, end, width, depth });
    box('Terrain', 'Central', 'Terrain', [18, .28, 10], [0, -.2, 0], 'Pelouse de démonstration');
    for (let r = 0; r < tiers; r++) {
      const ri = 10.3 + r * .88, rj = ri + .88, zi = 6.25 + r * .8, zj = zi + .8, y = .5 + r * .55;
      for (let j = 0; j < sectors; j++) {
        const a = j * Math.PI * 2 / sectors, b = (j + 1) * Math.PI * 2 / sectors;
        const top = [pt(a, ri, zi, y), pt(b, ri, zi, y), pt(b, rj, zj, y), pt(a, rj, zj, y)];
        const low = top.map(p => [p[0], p[1] - .4, p[2]]);
        add(j % 8 === 0 ? 'Escalier' : 'Gradin', zoneOf((a + b) / 2), 'N+' + (r + 1),
          { kind: 'mesh', positions: [...top, ...low].flat(), indices: [0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0] },
          'Élément préfabriqué à épaisseur réelle (simulation)');
      }
    }
    for (let j = 0; j < 32; j++) {
      const a = j * Math.PI * 2 / 32, zone = zoneOf(a), p = pt(a, 18.5, 13.5, 0);
      box('Poteau', zone, 'Structure', [.42, 6.3, .42], [p[0], 3.15, p[2]]);
      if (j % 2 === 0) beam('Poutre', zone, 'Structure', pt(a, 11, 7.3, .8), pt(a, 18.5, 13.5, 6), .37, .5);
      if (j % 4 === 0) box('Voile', zone, 'RDC', [.7, 4, .4], [p[0] * .97, 2, p[2] * .97]);
    }
    for (let j = 0; j < sectors; j++) {
      const a = j * Math.PI * 2 / sectors, b = (j + 1) * Math.PI * 2 / sectors, zone = zoneOf((a + b) / 2);
      const p = pt(a, 19, 14, 6.6), q = pt(b, 19, 14, 6.6),
            u = pt(a, 19, 14, 8.1), v = pt(b, 19, 14, 8.1);
      beam('Charpente', zone, 'Toiture', p, q, .21, .22);
      beam('Charpente', zone, 'Toiture', u, v, .18, .2);
      beam('Charpente', zone, 'Toiture', j % 2 ? u : p, j % 2 ? q : v, .17, .17);
    }
    return { schema: SCHEMA, projectType: 'stade', elements };
  }
  async function open(options) {
    if (typeof need3D !== 'function') throw new Error('Chargeur Three.js indisponible.');
    await need3D();
    const T = window.THREE;
    if (!T || !T.OrbitControls) throw new Error('Three.js / OrbitControls indisponibles.');
    const projectId = options && options.projectId || null, projectName = clean(options && options.projectName || 'Projet');
    const templates = window.ModelCoreTemplates;
    const initialType = templates ? templates.normalize(options && options.projectType) : 'stade';
    const el = document.createElement('div'); el.className = 'fullpage st-mc3d'; el.style.cssText = 'position:fixed;inset:0;z-index:1100;display:flex;flex-direction:column;background:#081324;color:#e7f1ff;font:13px system-ui,sans-serif;overflow:hidden';
    el.innerHTML = '<style>.st-mc3d *{box-sizing:border-box}.st-mc3d button,.st-mc3d select{background:#223954;color:#e7f1ff;border:1px solid #3c5876;border-radius:7px;padding:8px;font-size:12px}.st-mc3d button:disabled{opacity:.4}.st-mc3d .mcbar{display:flex;gap:6px;padding:8px;align-items:center;overflow:auto;flex-wrap:wrap;background:#14233a}.st-mc3d .mctitle{font-weight:700;flex:1;min-width:155px}.st-mc3d .mcview{flex:1;min-height:100px;position:relative;touch-action:none}.st-mc3d .mcview canvas{display:block;touch-action:none}.st-mc3d .mcdetail{background:#122138;padding:10px;display:flex;gap:7px;flex-wrap:wrap;align-items:center;max-height:32%;overflow:auto}.st-mc3d .mcinfo{flex:1;min-width:180px;line-height:1.6}.st-mc3d .mcsub{font-size:11px;color:#a8bed6}.st-mc3d .mcwarn{font-size:10px;color:#ffd58f}.st-mc3d .mcstatus{display:flex;gap:4px;flex-wrap:wrap}.st-mc3d .mcstatus button{white-space:nowrap}</style>'+
      '<div class="mcbar"><button data-act="close">✕</button><div class="mctitle">◈ SiteTeam ModelCore 3D<div class="mcsub" data-val="project"></div></div><button data-act="reset">↺</button><button data-act="top">Dessus</button><button data-act="under">Dessous</button><button data-act="zoomplus">＋</button><button data-act="zoomminus">－</button></div>'+
      '<div class="mcbar"><select data-role="projecttype"><option value="stade">Stade</option><option value="hopital">Hôpital</option><option value="immeuble">Immeubles</option><option value="villa">Villa</option><option value="pont">Pont</option><option value="vrd">VRD / Route</option><option value="industriel">Industrie</option><option value="batiment">Autre bâtiment</option></select><select data-filter="building"><option value="all">Tous bâtiments</option></select><select data-filter="lot"><option value="all">Tous lots</option></select><select data-filter="zone"><option value="all">Toutes zones</option></select><select data-filter="level"><option value="all">Tous niveaux</option></select><select data-filter="type"><option value="all">Tous ouvrages</option></select><select data-filter="status"><option value="all">Tous états</option></select><button data-act="all">Afficher tout</button><button data-act="roof">Toiture</button><button data-act="color">Couleurs état</button><button data-act="import">Importer JSON</button><input data-role="file" type="file" accept=".json,application/json" style="display:none"></div>'+
      '<div class="mcview" data-role="stage"><div style="position:absolute;left:10px;bottom:10px;color:#cde2f6;font-size:11px;pointer-events:none">Orbit 360° · toucher un ouvrage · zoom pincement / molette</div></div>'+
      '<div class="mcdetail"><div class="mcinfo"><b data-val="id">Aucun ouvrage sélectionné</b><div class="mcsub" data-val="info">Cliquez sur un élément. Données fictives non synchronisées.</div><div class="mcwarn" data-val="warning">Prototype — ne modifie pas votre projet et ne lit pas encore IFC/RVT.</div></div><button data-act="isolate" disabled>Isoler</button><button data-act="hide" disabled>Masquer</button><select data-role="editstatus" disabled>'+STATES.map(s=>'<option>'+s+'</option>').join('')+'</select></div>';
    document.body.appendChild(el);
    const $ = s => el.querySelector(s);
    $('[data-val="project"]').textContent = projectName + ' · Démo locale';
    const stage = $('[data-role="stage"]'), scene = new T.Scene();scene.background = new T.Color('#142338');
    const camera = new T.PerspectiveCamera(45, 1, .1, 500);
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: window.innerWidth > 650, powerPreference:'low-power' }); }
    catch(e){ el.remove(); throw new Error('WebGL indisponible sur cet appareil.'); }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 650 ? 1 : 1.5));
    renderer.outputEncoding = T.sRGBEncoding;
    stage.prepend(renderer.domElement);
    const controls = new T.OrbitControls(camera, renderer.domElement); controls.enableDamping = false; controls.maxDistance = 150; controls.minDistance = 3;
    scene.add(new T.HemisphereLight('#e8f2ff', '#526077', 1.2));
    const sun = new T.DirectionalLight('#ffffff', 1.45); sun.position.set(-12, 30, 24); scene.add(sun);
    const fill = new T.DirectionalLight('#75bdff', .5); fill.position.set(18, 10, -18);scene.add(fill);
    const grp = new T.Group();scene.add(grp);
    const geometryCache = [], matCache = new Map(), registry = new Map();
    const getMat = (key, hex, metalness=0) => {
      if(!matCache.has(key))matCache.set(key,new T.MeshStandardMaterial({color:hex,roughness:metalness?.45:.83,metalness,side:T.DoubleSide}));
      return matCache.get(key);
    };
    let selected=null, isolated=null, hidden=new Set(), roofHidden=false, statusColors=false, dataset=null, disposed=false, raf=0, press=null, backRemove=null;
    const selectedMat = new T.MeshStandardMaterial({color:0xffe29a,roughness:.65,side:T.DoubleSide});
    const pos = v => new T.Vector3(v[0],v[1],v[2]);
    function createMesh(g, type) {
      let geo, mesh;
      if(g.kind==='box'){ geo=new T.BoxGeometry(...g.size); mesh=new T.Mesh(geo); mesh.position.set(...g.position); if(vec(g.rotation,3))mesh.rotation.set(...g.rotation); }
      else if(g.kind==='beam'){let a=pos(g.start),b=pos(g.end),d=b.clone().sub(a),len=d.length();geo=new T.BoxGeometry(g.width,Math.max(.01,len),g.depth);mesh=new T.Mesh(geo);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());}
      else {geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(g.positions,3));geo.setIndex(g.indices);geo.computeVertexNormals();mesh=new T.Mesh(geo);}
      geometryCache.push(geo);
      const palette={Terrain:0x31794f,Gradin:0xc9d5df,Escalier:0xa5b6c5,Poteau:0xe0e6ea,Poutre:0xa9bdcd,Voile:0xc1ced9,Charpente:0xd34e5e,Dalle:0xc8d4df,Autre:0x93a6bd};
      mesh.material=getMat(type,palette[type] || palette.Autre,type==='Charpente'?.15:0);
      return mesh;
    }
    function resetCamera(){const bounds=new T.Box3().setFromObject(grp),ctr=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());const d=Math.max(15,size.length()*1.12);camera.position.set(ctr.x+d*.7,ctr.y+d*.56,ctr.z+d*.8);controls.target.copy(ctr);controls.update();schedule();}
    function populate(elements) {
      for(const child of [...grp.children]) grp.remove(child);
      geometryCache.splice(0).forEach(g=>g.dispose()); registry.clear(); hidden.clear(); isolated=null; selected=null; dataset=elements;
      for(const e of elements){
        let mesh=createMesh(e.geometry,e.type); mesh.userData.modelcoreId=e.id; grp.add(mesh);registry.set(e.id,{mesh,meta:e,baseMat:mesh.material});
      }
      refreshFilters();visibility();resetCamera();updateDetails();
    }
    function refreshFilters(){
      for(const key of ['building','lot','zone','level','type','status']){
        const s=$('[data-filter="'+key+'"]');s.replaceChildren(new Option(key==='zone'?'Toutes zones':key==='level'?'Tous niveaux':key==='type'?'Tous ouvrages':key==='building'?'Tous bâtiments':key==='lot'?'Tous lots':'Tous états','all'));
        [...new Set(dataset.map(e=>e[key]))].sort().forEach(v=>s.add(new Option(v,v)));
      }
    }
    function visibility(){
      for(const entry of registry.values()){
        const e=entry.meta;
        entry.mesh.visible=!hidden.has(e.id) && (!isolated || e.id===isolated) && (!roofHidden || !(e.type==='Charpente'||e.type==='Couverture'||e.level==='Toiture')) &&
          ['building','lot','zone','level','type','status'].every(k=>$('[data-filter="'+k+'"]').value==='all'||$('[data-filter="'+k+'"]').value===e[k]);
        entry.mesh.material=e.id===selected?selectedMat:statusColors?getMat('s:'+e.status,STATUS_COLOR[e.status]):entry.baseMat;
      }
      schedule();
    }
    function updateDetails(){
      const e=selected && registry.get(selected)?.meta;
      $('[data-val="id"]').textContent=e?e.type+' · '+e.id:'Aucun ouvrage sélectionné';
      $('[data-val="info"]').textContent=e?('Bâtiment '+e.building+' · Zone '+e.zone+' · '+e.level+' · Lot '+e.lot+' · '+e.status+' · Avancement '+e.progress+' %'+(e.sourceId?' · ID source '+e.sourceId:'')):'Cliquez sur un élément. Données fictives non synchronisées.';
      $('[data-val="warning"]').textContent=e?.sourceFormat && e.sourceFormat!=='DEMO'?'Géométrie importée depuis un manifeste JSON; état non synchronisé.':'Prototype — données fictives. Aucun IFC/RVT lu directement.';
      for(const a of ['isolate','hide'])$('[data-act="'+a+'"]').disabled=!e;
      const status=$('[data-role="editstatus"]');status.disabled=!e;if(e)status.value=e.status;
    }
    function select(id){selected=registry.has(id)?id:null; updateDetails();visibility();}
    function schedule(){if(disposed||raf)return;raf=requestAnimationFrame(()=>{raf=0;if(!disposed)renderer.render(scene,camera);});}
    const onResize=()=>{let w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();schedule();};
    const observer=new ResizeObserver(onResize);observer.observe(stage);
    const raycaster=new T.Raycaster(), mouse=new T.Vector2();
    renderer.domElement.addEventListener('pointerdown',e=>{press={x:e.clientX,y:e.clientY};});
    renderer.domElement.addEventListener('pointerup',e=>{
      if(!press || Math.hypot(e.clientX-press.x,e.clientY-press.y)>7){press=null;return;}press=null;
      const r=renderer.domElement.getBoundingClientRect();mouse.x=((e.clientX-r.left)/r.width)*2-1;mouse.y=-((e.clientY-r.top)/r.height)*2+1;
      raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObjects([...registry.values()].map(x=>x.mesh).filter(x=>x.visible),false)[0];
      select(hit?.object?.userData?.modelcoreId||null);
    });
    controls.addEventListener('change',schedule);
    function close(){
      if(disposed)return;disposed=true;
      if(backRemove)try{backRemove();}catch(e){}
      if(raf)cancelAnimationFrame(raf);observer.disconnect();controls.dispose();
      for(const g of geometryCache)g.dispose();for(const m of matCache.values())m.dispose();selectedMat.dispose();
      renderer.dispose();renderer.forceContextLoss();el.remove();
    }
    if(typeof pushBack==='function') backRemove=pushBack(close);
    const on=(act,fn)=>$('[data-act="'+act+'"]').addEventListener('click',fn);
    on('close',close);on('top',()=>{camera.position.set(.001,54,.001);controls.target.set(0,2.5,0);controls.update();});
    on('under',()=>{camera.position.set(.001,-40,.001);controls.target.set(0,2.5,0);controls.update();});
    on('reset',()=>{isolated=null;hidden.clear();roofHidden=false;statusColors=false;for(const k of ['building','lot','zone','level','type','status'])$('[data-filter="'+k+'"]').value='all';resetCamera();select(null);});
    on('zoomplus',()=>{camera.position.sub(controls.target).multiplyScalar(.78).add(controls.target);controls.update();});
    on('zoomminus',()=>{camera.position.sub(controls.target).multiplyScalar(1.25).add(controls.target);controls.update();});
    on('isolate',()=>{if(!selected)return;isolated=selected;hidden.delete(selected);roofHidden=false;for(const k of ['building','lot','zone','level','type','status'])$('[data-filter="'+k+'"]').value='all';visibility();});
    on('hide',()=>{if(!selected)return;hidden.add(selected);if(isolated===selected)isolated=null;select(null);});
    on('all',()=>{isolated=null;hidden.clear();roofHidden=false;for(const k of ['building','lot','zone','level','type','status'])$('[data-filter="'+k+'"]').value='all';select(null);});
    on('roof',()=>{roofHidden=!roofHidden;visibility();});
    on('color',()=>{statusColors=!statusColors;visibility();});
    for(const k of ['building','lot','zone','level','type','status'])$('[data-filter="'+k+'"]').addEventListener('change',()=>{select(null);});
    $('[data-role="editstatus"]').addEventListener('change',e=>{
      if(!selected)return;const item=registry.get(selected);if(item && STATES.includes(e.target.value)){item.meta.status=e.target.value;item.meta.progress=e.target.value==='Réceptionné'?100:item.meta.progress;updateDetails();visibility();}
    });
    on('import',()=>{$('[data-role="file"]').click();});
    $('[data-role="file"]').addEventListener('change',async(e)=>{
      const f=e.target.files[0];e.target.value='';if(!f)return;
      try{if(f.size>10*1024*1024)throw new Error('Fichier supérieur à 10 Mo.');
        const json=JSON.parse(await f.text()),data=validateManifest(json);
        populate(data);$('[data-val="project"]').textContent=projectName+' · JSON '+clean(f.name)+' (local)';
      }catch(err){alert('Import ModelCore : '+clean(err.message));}
    });
    const chooseTemplate = key => {
      const demo = key==='stade' ? createDemo() : templates ? templates.make(key) : createDemo();
      populate(validateManifest(demo));
      $('[data-val="project"]').textContent = projectName + ' · Démo '+key+' (fictive)';
    };
    $('[data-role="projecttype"]').value = initialType;
    $('[data-role="projecttype"]').addEventListener('change',e=>chooseTemplate(e.target.value));
    chooseTemplate(initialType);onResize();
    return { close, getSelected:()=>registry.get(selected)?.meta||null, projectId, schema:SCHEMA };
  }
  window.ModelCore3D = { open, validateManifest, demo:(type='stade')=>type==='stade'?createDemo():window.ModelCoreTemplates?window.ModelCoreTemplates.make(type):createDemo(), schema:SCHEMA };
})();
