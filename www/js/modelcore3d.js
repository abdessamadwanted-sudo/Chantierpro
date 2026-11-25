/* SiteTeam ModelCore 3D — prototype expérimental, chargement différé.
 * Affichage WebGL, import IFC local expérimental; aucune synchronisation chantier.
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
  // Fiche géométrique neutre : aucune dépendance aux services métier.
  function ficheGeometrique(g) {
    if(g.kind==='box')return 'Dimensions X/Y/Z : '+g.size.map(x=>x.toFixed(2)).join(' × ')+' m · Volume géométrique : '+g.size.reduce((a,b)=>a*b,1).toFixed(3)+' m³';
    if(g.kind==='beam')return 'Longueur : '+Math.hypot(...g.end.map((x,i)=>x-g.start[i])).toFixed(2)+' m · Section : '+g.width.toFixed(2)+' × '+g.depth.toFixed(2)+' m';
    return 'Maillage : '+g.positions.length/3+' sommets · '+g.indices.length/3+' triangles';
  }
  function maquetteParametrique(p) {
    const {hauteur,epaisseur,niveaux,entraxe}=p;
    if(![hauteur,epaisseur,niveaux,entraxe].every(Number.isFinite)||hauteur<2.5||hauteur>5||epaisseur<.15||epaisseur>.45||!Number.isInteger(niveaux)||niveaux<1||niveaux>7||entraxe<3||entraxe>8)throw Error('Paramètres hors limites.');
    const elements=[];let id=0;
    const add=(type,level,geometry)=>elements.push({id:'AI-DEMO-'+(++id),type,building:'Studio',lot:'Gros œuvre',zone:'Structure',level,sourceFormat:'DEMO',status:'Non commencé',geometry});
    for(let l=0;l<niveaux;l++){
      const y=l*hauteur,level=l?'R+'+l:'RDC';
      for(let i=0;i<3;i++)for(let j=0;j<2;j++)add('Dalle',level,{kind:'box',size:[entraxe-.02,epaisseur,entraxe-.02],position:[(i-1)*entraxe,y,(j-.5)*entraxe]});
      for(let i=0;i<4;i++)for(let j=0;j<3;j++)add('Poteau',level,{kind:'box',size:[.4,hauteur-epaisseur,.4],position:[(i-1.5)*entraxe,y+hauteur/2,(j-1)*entraxe]});
      for(let i=0;i<3;i++)for(let j=0;j<3;j++)add('Poutre',level,{kind:'beam',start:[(i-1.5)*entraxe,y+hauteur-.3,(j-1)*entraxe],end:[(i-.5)*entraxe,y+hauteur-.3,(j-1)*entraxe],width:.35,depth:.5});
      for(let i=0;i<4;i++)for(let j=0;j<2;j++)add('Poutre',level,{kind:'beam',start:[(i-1.5)*entraxe,y+hauteur-.3,(j-1)*entraxe],end:[(i-1.5)*entraxe,y+hauteur-.3,j*entraxe],width:.35,depth:.5});
    }
    return {schema:SCHEMA,projectType:'batiment',elements};
  }
  // Seules les cotes explicitement libellées et unitaires sont proposées.
  function suggestionsPlan(text) {
    const t=String(text||'').slice(0,50000).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u00a0/g,' ');
    const fields=[['hauteur',/(?:hauteur\s*(?:d['’ ]?etage|sous\s*plafond)|h\s*etage)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/gi,2.5,5],['epaisseur',/(?:epaisseur\s*(?:de\s*(?:la\s*)?)?dalle|ep\.?\s*dalle)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/gi,.15,.45],['entraxe',/entraxe\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/gi,3,8]];
    const out={};
    for(const [key,pattern,min,max] of fields){const all=[...t.matchAll(pattern)].map(m=>({value:Number(m[1].replace(',','.'))*({mm:.001,cm:.01,m:1}[m[2].toLowerCase()]),evidence:m[0]}));if(!all.length)continue;const x=all[0];if(x.value>=min&&x.value<=max&&all.every(a=>Math.abs(a.value-x.value)<1e-6))out[key]={value:key==='epaisseur'?Math.round(x.value*1000)/10:x.value,evidence:x.evidence};}
    return out;
  }
  // Un tap ne peut jamais provenir d'un pincement, d'une rotation ou d'une annulation.
  function gesteSelection(seuil=7) {
    const points=new Set();let start=null,blocked=false;
    return {
      down(e){if(points.size===0){start={id:e.pointerId,x:e.clientX,y:e.clientY};blocked=e.button!==undefined&&e.button!==0;}points.add(e.pointerId);if(points.size>1)blocked=true;},
      move(e){if(start&&points.has(e.pointerId)&&(e.pointerId!==start.id||Math.hypot(e.clientX-start.x,e.clientY-start.y)>seuil))blocked=true;},
      up(e){this.move(e);const tap=points.has(e.pointerId)&&points.size===1&&!blocked&&start?.id===e.pointerId;points.delete(e.pointerId);if(!points.size){start=null;blocked=false;}return tap;},
      cancel(e){blocked=true;points.delete(e.pointerId);if(!points.size){start=null;blocked=false;}},
      reset(){points.clear();start=null;blocked=false;}
    };
  }
  // Plans de coupe en coordonnées monde. 0 % conserve tout; 100 % retire tout.
  function coupeParametres(min,max,pourcent,inverse=false){
    if(![min,max,pourcent].every(Number.isFinite)||max<min)throw Error('Bornes de coupe invalides.');
    const t=Math.max(0,Math.min(100,pourcent))/100,pad=Math.max(.00001,(max-min)*.00001);
    const lo=min-pad,hi=max+pad,position=inverse?lo+(hi-lo)*t:hi-(hi-lo)*t;
    return {position,normal:inverse?1:-1,constant:inverse?-position:position};
  }
  function pointDansCoupe(point,planes,epsilon=1e-6){
    return planes.every(p=>p.normal.x*point.x+p.normal.y*point.y+p.normal.z*point.z+p.constant>=-epsilon);
  }
  // Déplacement d'écran par le milieu des deux doigts, sans déplacer le pivot 3D.
  function gestePan(){
    const points=new Map();let previous=null;
    function centre(){if(points.size!==2)return null;const [a,b]=[...points.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
    return {
      down(e){if(e.pointerType!=='touch')return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});previous=centre();},
      move(e){if(!points.has(e.pointerId))return null;points.set(e.pointerId,{x:e.clientX,y:e.clientY});const c=centre(),d=c&&previous?{x:c.x-previous.x,y:c.y-previous.y}:null;previous=c;return d;},
      up(e){points.delete(e.pointerId);previous=centre();},
      reset(){points.clear();previous=null;}
    };
  }
  // Matériaux indicatifs, jamais des propriétés certifiées du modèle IFC.
  function profilMateriau(type,lot=''){
    const k=(type+' '+lot).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(/vitrage|fenetre|ifcwindow/.test(k))return {kind:'verre',color:0x426c80,roughness:.22,metalness:.12};
    if(/armature|ferraillage/.test(k))return {kind:'acier',color:0xa46b42,roughness:.5,metalness:.55};
    if(/charpente metallique|garde-corps|menuiserie|arbaletrier|metal/.test(k))return {kind:'metal',color:0x637686,roughness:.38,metalness:.55};
    if(/gaine|cvc/.test(k))return {kind:'technique',color:0x6ba89e,roughness:.5,metalness:.25};
    if(/conduite|canalisation|plomberie/.test(k))return {kind:'technique',color:0x508ba6,roughness:.55,metalness:.12};
    if(/terrain|jardin/.test(k))return {kind:'sol',color:0x69796b,roughness:1,metalness:0};
    if(/facade|cloison|acrotere/.test(k))return {kind:'enduit',color:0xc1b7a7,roughness:.9,metalness:0};
    if(/chaussee|voirie/.test(k))return {kind:'sol',color:0x515b63,roughness:1,metalness:0};
    if(/poutre/.test(k))return {kind:'beton',color:0x909ba1,roughness:.88,metalness:0};
    if(/poteau|voile|pile/.test(k))return {kind:'beton',color:0xb2b9ba,roughness:.85,metalness:0};
    return {kind:'beton',color:0xa5afb3,roughness:.9,metalness:0};
  }
  // Contour plan/boîte orientée : polygone exact sur les primitives pleines.
  function contourCoupe(corners,normal,constant){
    if(corners.length!==8)return [];
    const dots=corners.map(p=>p.reduce((a,v,i)=>a+v*normal[i],constant)),eps=1e-7;
    if(!dots.some(x=>x>eps)||!dots.some(x=>x< -eps))return [];
    const pts=[];
    function add(p){if(!pts.some(q=>Math.hypot(...p.map((x,i)=>x-q[i]))<eps))pts.push(p);}
    for(let i=0;i<8;i++)for(const bit of [1,2,4]){
      const j=i^bit;if(j<=i)continue;
      const a=dots[i],b=dots[j];if(Math.abs(a)<=eps)add(corners[i]);if(Math.abs(b)<=eps)add(corners[j]);
      if(a*b<0){const t=a/(a-b);add(corners[i].map((x,k)=>x+(corners[j][k]-x)*t));}
    }
    if(pts.length<3)return [];
    const axis=Math.abs(normal[0])>.5?0:Math.abs(normal[1])>.5?1:2,u=(axis+1)%3,v=(axis+2)%3;
    const mid=[0,0,0];for(const p of pts)for(let i=0;i<3;i++)mid[i]+=p[i]/pts.length;
    pts.sort((a,b)=>Math.atan2(a[v]-mid[v],a[u]-mid[u])-Math.atan2(b[v]-mid[v],b[u]-mid[u]));
    return pts;
  }
  // Empreintes de contact, en mètres. Ne pas confondre proximité géométrique et validation structurelle.
  function contactPlancher(slabMin,slabMax,supportMin,supportMax,side,tol=.03){
    if(side==='below'&&supportMin<slabMin-tol&&supportMax>=slabMin-tol){
      return Math.max(supportMin+1e-6,Math.min(slabMin,supportMax-1e-6));
    }
    if(side==='above'&&supportMax>slabMax+tol&&supportMin<=slabMax+tol){
      return Math.max(supportMin+1e-6,Math.min(slabMax,supportMax-1e-6));
    }
    return null;
  }
  // Découpe 2D d'un segment par un polygone convexe CCW (rectangle/triangle de dalle).
  function segmentDansPolygone(a,b,poly){
    let lo=0,hi=1;
    for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length],ex=q[0]-p[0],ez=q[1]-p[1];
      const u=ex*(a[1]-p[1])-ez*(a[0]-p[0]),v=ex*(b[1]-a[1])-ez*(b[0]-a[0]);
      if(Math.abs(v)<1e-10){if(u< -1e-8)return null;continue;}
      const t=(-1e-8-u)/v;if(v>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
      if(hi-lo<1e-7)return null;
    }
    return [lo,hi];
  }
  function fusionIntervalles(intervals){
    const out=[];for(const x of intervals.sort((a,b)=>a[0]-b[0])){
      const last=out[out.length-1];if(last&&x[0]<=last[1]+1e-6)last[1]=Math.max(last[1],x[1]);else out.push(x.slice());
    }return out;
  }
  function typePlancher(type){return /^(dalle|plancher|ifcslab)(\b|$)/i.test(type);}
  function typeSupport(type){return /^(poteau|voile|mur|poutre|pile|ifccolumn|ifcwall|ifcbeam)(\b|$)/i.test(type);}
  // Profils explicites, sans dépendance à un service ni promesse de fréquence d'image.
  function profilRendu(mode,objects=0,maxTexture=2048){
    const studio=mode==='studio',high=studio||mode==='high',heavy=objects>1800;
    return {high,studio,shadows:high&&!heavy,edges:high&&!heavy,reflection:high&&!heavy,
      pixelRatio:studio&&!heavy?2:high&&!heavy?1.5:1,
      shadowSize:Math.min(maxTexture,studio?2048:1024),exposure:studio?.93:.9};
  }
  // Panorama de studio procédural : ciel, sol et deux grands diffuseurs.
  function studioPixels(w=256,h=128){
    const data=new Uint8Array(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const u=x/w,v=y/h,sky=Math.max(0,1-v*1.8),ground=Math.max(0,(v-.55)*2);
      const wrap=(a,b)=>Math.min(Math.abs(a-b),1-Math.abs(a-b));
      const panel=(cx,cy,sx,sy)=>Math.exp(-((wrap(u,cx)/sx)**4+((v-cy)/sy)**4));
      const key=panel(.22,.31,.105,.15),rim=panel(.72,.39,.07,.12);
      const i=(y*w+x)*4;
      data[i]=Math.min(255,49+85*sky+25*ground+170*key+100*rim);
      data[i+1]=Math.min(255,60+92*sky+18*ground+165*key+124*rim);
      data[i+2]=Math.min(255,72+105*sky+9*ground+152*key+160*rim);data[i+3]=255;
    }
    return data;
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
    el.innerHTML = `<style>
.st-mc3d{--mc-cyan:#45def6;--mc-muted:#91b2ca;--mc-line:#31546b;background:#06121f!important;color:#e9f5ff!important;min-height:0}
.st-mc3d *{box-sizing:border-box}.st-mc3d button,.st-mc3d select,.st-mc3d input{font:inherit;color:#e7f1ff;background:linear-gradient(145deg,#18364c,#0c2133);border:1px solid #31546b;border-radius:9px;padding:8px;min-height:36px}
.st-mc3d button:disabled{opacity:.4}.st-mc3d button.active{border-color:#45def6;color:#7cecff;background:#103a4c}.st-mc3d option{background:#132c42}.st-mc3d .mcbar{display:flex;gap:6px;padding:7px 10px;align-items:center;overflow:auto;flex-shrink:0;background:#091a29}.st-mc3d .mcbar button{white-space:nowrap;flex-shrink:0}.st-mc3d .mchead{background:linear-gradient(120deg,#173b54,#081727);border-bottom:1px solid var(--mc-line);padding:12px}.st-mc3d .mctitle{font-size:18px;font-weight:750;flex:1;min-width:0;letter-spacing:-.5px}.st-mc3d .mcsub{font-size:11px;color:var(--mc-muted);line-height:1.45;overflow-wrap:anywhere}.st-mc3d .mcwarn{font-size:10px;color:#ffd58f}.st-mc3d .mcnav button{flex:1}.st-mc3d .mckpis{display:flex;gap:6px;padding:7px 10px;flex-shrink:0}.st-mc3d .mckpi{flex:1;padding:7px 9px;border-radius:10px;border:1px solid #29485e;background:#10283d}.st-mc3d .mckpi b{display:block;font-size:17px;color:#6ae7f7}.st-mc3d .mcfilters{display:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:8px;max-height:32%;overflow:auto;background:#0c2235}.st-mc3d .mcfilters.open{display:grid}.st-mc3d .mcview{flex:1;min-height:120px;position:relative;touch-action:none;overflow:hidden}.st-mc3d .mcview canvas{display:block;touch-action:none}.st-mc3d .mcover{position:absolute;top:10px;left:12px;color:#98cce0;font-size:10px;pointer-events:none}.st-mc3d .mcside{position:absolute;left:8px;top:45px;display:grid;gap:5px}.st-mc3d .mcside button{width:38px;background:#10283be8;padding:4px;font-size:16px}.st-mc3d .mclevels{position:absolute;right:8px;top:45px;display:grid;gap:4px;max-height:65%;overflow:auto;padding:4px;background:#091e31df;border-radius:10px;border:1px solid #34556b}.st-mc3d .mclevels button{min-height:28px;font-size:10px;padding:4px;max-width:86px;overflow:hidden;text-overflow:ellipsis}.st-mc3d .mclegend{display:flex;gap:9px;flex-wrap:wrap;justify-content:center;padding:7px;background:#0a1b2b;font-size:10px;flex-shrink:0}.st-mc3d .mclegend i{display:inline-block;width:8px;height:8px;border-radius:3px;margin-right:4px}.st-mc3d .mcdetail{background:linear-gradient(145deg,#173549,#0d2133);padding:10px;display:flex;gap:7px;flex-wrap:wrap;align-items:center;max-height:40%;overflow:auto;border-top:1px solid #36566e;flex-shrink:0}.st-mc3d .mcinfo{flex:1;min-width:170px;line-height:1.55}.st-mc3d .mcinfo b{font-size:15px}.st-mc3d .mcprogress{height:6px;width:100%;background:#29495e;border-radius:8px;overflow:hidden}.st-mc3d .mcprogress i{display:block;height:100%;background:#44def6}.st-mc3d .mcpage{flex:1;min-height:0;overflow:auto;padding:15px}.st-mc3d .mccard{border:1px solid #29485e;background:linear-gradient(145deg,#102b40,#0a1e30);padding:12px;border-radius:12px;margin:10px 0;line-height:1.55}.st-mc3d .mccard h3{margin:0 0 8px}.st-mc3d .mcgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.st-mc3d .mcgrid input{width:100%}.st-mc3d .mcviewer{display:flex;flex-direction:column;min-height:0;flex:1}.st-mc3d .mcinspector-extra{width:100%;padding:4px 0}.st-mc3d .mcinspector-extra button{margin:3px}.st-mc3d .mcsection{position:absolute;left:52px;right:52px;bottom:24px;z-index:5;padding:9px;background:#0b2235f2;border:1px solid #3b7d96;border-radius:12px;box-shadow:0 5px 20px #0006;touch-action:none}.st-mc3d .mcsection-head{display:flex;align-items:center;gap:4px;margin-bottom:5px}.st-mc3d .mcsection-head b{flex:1;color:#78e6fb;font-size:11px}.st-mc3d .mcsection button{min-height:29px;padding:5px;font-size:11px;touch-action:manipulation}.st-mc3d .mcsection-row{display:flex;gap:6px;align-items:center;margin-top:5px}.st-mc3d .mcsection-row span{font-size:11px;color:#cae7f4;min-width:22px}.st-mc3d .mcsection input[type=range]{min-width:0;flex:1;width:100%;min-height:28px;padding:0;accent-color:#43def6;touch-action:none}.st-mc3d .mcsection output{font-size:10px;color:#9ddded;min-width:43px;text-align:right}.st-mc3d .mcviewer{position:relative}.st-mc3d .mctoolpanel{position:absolute;bottom:0;left:0;right:0;z-index:12;max-height:65%;overflow:auto;background:#0a2033fa;border:1px solid #365a73;border-radius:17px 17px 0 0;box-shadow:0 -12px 32px #0008;touch-action:pan-y}.st-mc3d .mctoolpanel .mcfilters{max-height:unset}.st-mc3d .mctoolpanel .mcbar{flex-wrap:wrap;overflow:visible}.st-mc3d .mctoolpanel .mcbar button{flex:1}.st-mc3d .mctoolpanel .mcbar select{min-width:0}.st-mc3d .mctoolhead{display:flex;justify-content:space-between;align-items:center;padding:7px 12px;color:#8fe9f8;border-bottom:1px solid #254559}.st-mc3d .mcquick{padding:4px 8px}.st-mc3d .mcquick button{min-height:32px}.st-mc3d .mcquick [data-act=tools]{flex:1}.st-mc3d .mcdetail{padding:7px 10px}.st-mc3d .mcinfo b{color:#eaf6ff!important}.st-mc3d .mclegend{padding:4px;font-size:10px}.st-mc3d .mcview{min-height:140px}.st-mc3d .mcdetail{position:absolute;bottom:0;left:0;right:0;z-index:8;max-height:48%;border:1px solid #3b657a;border-radius:16px 16px 0 0;background:linear-gradient(155deg,#17384af7,#0a1c2df8);box-shadow:0 -7px 26px #0007;touch-action:pan-y}.st-mc3d .mcinfo{flex-basis:100%;min-width:0;display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:8px;align-items:start}.st-mc3d .mcobject-icon{display:grid;place-items:center;background:#0b2639;border:1px solid #4ccfe4;border-radius:10px;color:#64e9f9;font-size:21px;height:40px}.st-mc3d .mcobject-copy{min-width:0;overflow-wrap:anywhere}.st-mc3d .mcinfo b{font-size:14px;line-height:1.3;color:#eaf6ff!important}.st-mc3d .mcobject-geo{font-size:11px;color:#a5d2df;margin-top:3px}.st-mc3d .mcobject-actions{display:flex;width:100%;gap:5px}.st-mc3d .mcobject-actions button{flex:1;min-width:0;padding:6px;min-height:34px}.st-mc3d .mcobject-progress{display:flex;align-items:center;gap:8px;width:100%}.st-mc3d .mcobject-progress select{flex:1;min-width:0}.st-mc3d .mcobject-progress .mcprogress{flex:1}.st-mc3d .mcobject-percent{font-weight:700;color:#62e5f7}.st-mc3d .mcsection{z-index:10}.st-mc3d .mcviewer.mc-has-selection .mcsection{bottom:auto;top:8px}.st-mc3d .mclevels{touch-action:pan-y}.st-mc3d .mcfoot-controls{position:absolute;top:25px;left:50px;right:88px;z-index:4;padding:5px;border:1px solid #31546b;border-radius:8px;background:#0b2033e8;touch-action:pan-y}.st-mc3d .mcfoot-controls select{width:100%;min-height:28px;padding:3px;font-size:11px}.st-mc3d [hidden]{display:none!important}.st-mc3d .mcsplit{position:absolute;left:50%;top:0;bottom:0;border-left:1px solid #46677d;pointer-events:none}.st-mc3d .mclabel{position:absolute;top:28px;left:53%;font-size:10px;color:#a1cce1;pointer-events:none}
</style>
<div class="mcbar mchead"><button data-act="close" aria-label="Fermer">✕</button><div class="mctitle">◈ ModelCore <span style="color:#5ce5fc">X</span><div class="mcsub" data-val="project"></div></div><span class="mcwarn">DÉMO LOCALE</span></div>
<div class="mcbar mcnav"><button data-page="viewer" class="active">◇ Explorer</button><button data-page="import">⇩ Import</button><button data-page="ai">✧ AI Studio</button><button data-page="dash">▥ Maquette</button></div>
<div class="mcviewer" data-pane="viewer"><div class="mcbar mcquick"><button data-act="tools" aria-expanded="false">☷ Outils · Filtres</button><button data-act="plancher" title="Plancher et empreintes des appuis" aria-pressed="false">▧ Plancher</button><button data-act="restorequick" hidden title="Restaurer les ouvrages masqués">↶</button><button data-act="fitquick" title="Recentrer le projet">⛶ Ajuster</button></div><div class="mctoolpanel" data-role="tools-panel" hidden><div class="mctoolhead"><b>OUTILS DE MAQUETTE</b><select data-role="quality" aria-label="Qualité graphique"><option value="standard">Fluide</option><option value="high">Détaillé</option><option value="studio">Studio</option></select><button data-act="tools-close" aria-label="Replier les outils">⌄</button></div><div class="mcsub" data-val="render-profile" style="padding:4px 12px">Fluide · rendu optimisé</div>
<div class="mcbar"><select data-role="projecttype" aria-label="Famille de démonstration" style="flex:1;min-width:0"><option value="stade">Stade</option><option value="hopital">Hôpital</option><option value="immeuble">Résidence · 2 bâtiments</option><option value="villa">Villa</option><option value="pont">Pont</option><option value="vrd">VRD / Route</option><option value="industriel">Industrie</option><option value="batiment">Autre bâtiment</option></select><button data-act="reset" aria-label="Réinitialiser">↺</button></div>
<div class="mckpis"><div class="mckpi">Ouvrages<b data-val="total">0</b></div><div class="mckpi">Lots<b data-val="avg">0</b></div><div class="mckpi">Niveaux<b data-val="nc">0</b></div></div>
<div class="mcbar"><button data-act="structure">▤ Structure</button><button data-act="architecture">◇ Architecture</button><button data-act="color" class="active">◉ États</button><button data-act="filters">☷ Filtres</button><button data-act="layers">Calques</button></div>
<div class="mcbar"><button data-act="view">Vue 3D</button><button data-act="explode">Éclaté</button><button data-act="all">Tout</button><button data-act="roof">Toiture</button></div>
<div class="mcfilters" data-role="filters"><select data-filter="building" aria-label="Bâtiment"></select><select data-filter="lot" aria-label="Lot"></select><select data-filter="zone" aria-label="Zone"></select><select data-filter="level" aria-label="Niveau"></select><select data-filter="type" aria-label="Type"></select><select data-filter="status" aria-label="État"></select></div>
<div class="mcfilters" data-role="layers"></div></div>
<div class="mcview" data-role="stage"><div class="mcover" data-val="visible"></div><div class="mcfoot-controls" data-role="foot-controls" hidden><select data-role="foot-side" aria-label="Empreintes des appuis"><option value="below">Appuis dessous</option><option value="above">Éléments dessus</option><option value="both">Les deux</option></select><div data-val="foot-report" class="mcsub"></div></div><div class="mcside"><button data-act="top" title="Dessus">↑</button><button data-act="under" title="Dessous">↓</button><button data-act="zoomplus" title="Zoom avant">＋</button><button data-act="zoomminus" title="Zoom arrière">−</button><button data-act="cut" title="Coupe interactive">◫</button><button data-act="fit" title="Ajuster">⛶</button></div><div class="mclevels" data-role="levels"></div><div class="mcsection" data-role="section-panel" hidden><div class="mcsection-head"><b>COUPE LIVE</b><button data-act="section-h" aria-label="Coupe horizontale">H</button><button data-act="section-v" aria-label="Coupe verticale">V</button><button data-act="section-reset" title="Réinitialiser les coupes">↺</button><button data-act="section-close" title="Replier les réglages">−</button></div><div class="mcsection-row" data-section-row="h" hidden><span>H ↕</span><input data-section-slider="h" aria-label="Profondeur de coupe horizontale" type="range" min="0" max="100" step=".1" value="0"><output data-section-value="h">0%</output><button data-invert="h" title="Inverser la coupe horizontale">⇅</button></div><div class="mcsection-row" data-section-row="v" hidden><span>V ↔</span><input data-section-slider="v" aria-label="Profondeur de coupe verticale" type="range" min="0" max="100" step=".1" value="0"><output data-section-value="v">0%</output><button data-invert="v" title="Inverser la coupe verticale">⇄</button></div><div class="mcsub" data-val="section-note">H : haut vers bas · V : +X vers −X</div></div><div class="mcsplit" hidden></div><div class="mclabel" hidden>PLAN ZÉNITHAL</div><div class="mcsub" style="position:absolute;bottom:6px;left:12px;pointer-events:none">1 doigt : orbite · 2 doigts : zoom / déplacement</div></div>
<div class="mclegend" data-role="legend"></div>
<div class="mcdetail" data-role="inspector" hidden><div class="mcinfo"><div class="mcobject-icon" data-val="object-icon">◇</div><div class="mcobject-copy"><div class="mcsub" style="color:#61dfef;letter-spacing:1px;font-size:10px">OUVRAGE SÉLECTIONNÉ</div><b data-val="id">Aucun ouvrage sélectionné</b><div class="mcsub" data-val="info">Touchez un élément.</div><div class="mcobject-geo" data-val="object-geo"></div><div class="mcwarn" data-val="warning">Données locales non synchronisées.</div></div><button data-act="selection-close" title="Fermer la sélection" aria-label="Fermer la sélection">✕</button></div><div class="mcobject-actions"><button data-act="isolate" disabled>Isoler</button><button data-act="hide" disabled>Masquer</button><button data-act="restore-hidden" disabled>Restaurer</button><button data-act="detail" aria-expanded="false" disabled>Fiche ↑</button></div><div class="mcobject-progress"><select data-role="editstatus" aria-label="État local de démonstration" disabled></select><span class="mcobject-percent" data-val="progress-percent">0%</span><div class="mcprogress"><i data-role="progressbar" style="width:0%"></i></div></div><div class="mcinspector-extra" data-role="extra" hidden><button data-tab="Infos">Infos</button><button data-tab="Géométrie">Géométrie</button><button data-tab="Docs">Docs</button><button data-tab="Journal">Journal</button><div data-val="extra" class="mcsub"></div><label data-role="progresslabel">Avancement fictif <input data-role="progress" type="range" min="0" max="100" step="1"></label></div></div>
</div>
<div class="mcpage" data-pane="import" hidden><h2>Import Studio</h2><div class="mccard"><h3>Maquette BIM · IFC</h3>Revit / Tekla / Archicad → IFC. Import direct local expérimental, 8 Mo et 5 000 ouvrages maximum, budget de triangles limité. Aucun fichier envoyé.<br><button data-act="ifc">Sélectionner IFC</button> <button data-act="ifccancel" hidden>Annuler</button><input data-role="ifcfile" type="file" accept=".ifc" hidden><p class="mcsub" data-val="ifcreport">Choisissez un IFC exporté depuis votre logiciel BIM. RVT direct non pris en charge.</p></div><div class="mccard"><h3>Manifeste JSON ModelCore v1</h3>Import local réel, 10 Mo / 5 000 ouvrages maximum.<br><button data-act="import">Sélectionner JSON</button><input data-role="file" type="file" accept=".json,application/json" hidden></div><div class="mccard"><h3>Plans 2D</h3>Lecture PDF et OCR local, puis création paramétrique assistée.<br><button data-page="ai">Ouvrir AI Studio</button></div><div class="mccard">GlobalId préservé si présent. Lots proposés à vérifier. Coordonnées recentrées pour affichage; versions, géoréférencement et contrôle des droits restent à développer.</div></div>
<div class="mcpage" data-pane="ai" hidden><h2>AI Geometry Studio</h2><div class="mccard"><h3>Assistant de lecture · PDF / image</h3><p>Extraction de texte PDF ou OCR neuronal local (première page). Les cotes explicites sont des suggestions à vérifier, pas une reconnaissance de la géométrie.</p><button data-act="planfile">Choisir un plan</button><input data-role="planfile" type="file" accept=".pdf,image/png,image/jpeg" hidden><p data-val="ocrstatus" class="mcsub"></p><textarea data-role="ocrtext" readonly rows="5" style="width:100%;background:#0b2033;color:#d6ecfa;border:1px solid #31546b;border-radius:8px" placeholder="Texte reconnu"></textarea><p data-val="suggestions" class="mcsub"></p><button data-act="applysuggestions" disabled>Reporter les cotes proposées</button></div><div class="mccard"><h3>Plan de coffrage fictif · exemple</h3><svg data-role="aiplan" viewBox="0 0 340 190" style="width:100%;background:#081c2c;border-radius:8px"></svg><button data-act="detect">Détection simulée</button><p data-val="airesult">Aucune analyse de PDF réel.</p></div><div class="mccard"><h3>Paramètres à confirmer</h3><div class="mcgrid"><label>Hauteur (m)<input data-ai="hauteur" type="number" value="3.2" min="2.5" max="5" step=".1"></label><label>Épaisseur (cm)<input data-ai="epaisseur" type="number" value="25" min="15" max="45"></label><label>Niveaux<input data-ai="niveaux" type="number" value="3" min="1" max="7"></label><label>Entraxe (m)<input data-ai="entraxe" type="number" value="5" min="3" max="8"></label></div><label><input data-role="confirm" type="checkbox"> Je confirme les dimensions pour une trame paramétrique illustrative (pas une reproduction du plan).</label><br><button data-act="generate">Générer une maquette paramétrique</button><p class="mcwarn" data-val="aierror"></p></div></div>
<div class="mcpage" data-pane="dash" hidden><h2>Explorateur de maquette</h2><div class="mccard" data-role="dashboard"></div><div class="mccard"><h3>Raccourcis géométriques</h3><div data-role="shortcuts" class="mcgrid"></div><p class="mcsub">Filtres locaux par type d’ouvrage.</p></div></div>`;
    document.body.appendChild(el);
    const $ = s => el.querySelector(s);
    $('[data-val="project"]').textContent = projectName + ' · Démo locale';
    const stage = $('[data-role="stage"]'), scene = new T.Scene();scene.background=null;stage.style.background="radial-gradient(ellipse at 48% 38%, #20394c 0%, #10283a 43%, #061321 100%)";
    const camera = new T.PerspectiveCamera(45, 1, .1, 500); const planCam = new T.OrthographicCamera(-10,10,10,-10,.1,2000);
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: window.innerWidth > 650, alpha:true, powerPreference:'default' }); }
    catch(e){ el.remove(); throw new Error('WebGL indisponible sur cet appareil.'); }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 650 ? 1 : 1.5));
    renderer.setClearColor(0x000000,0);renderer.outputEncoding = T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
    renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.enabled=false;renderer.shadowMap.autoUpdate=false;
    stage.prepend(renderer.domElement);
    const controls = new T.OrbitControls(camera, renderer.domElement);
    controls.enableDamping=false;controls.enableZoom=true;controls.enableRotate=true;
    // Pas de pan implicite : le pivot reste au centre du projet, même après un pincement.
    controls.enablePan=false;controls.touches.ONE=T.TOUCH.ROTATE;controls.touches.TWO=T.TOUCH.DOLLY_PAN;
    controls.zoomSpeed=1;controls.rotateSpeed=.85;controls.maxDistance=150;controls.minDistance=.05;
    renderer.domElement.style.touchAction='none';
    const projectCenter=new T.Vector3();let fitDistance=15;const gesture=gesteSelection(),panGesture=gestePan();const pan={x:0,y:0};
    const hemi=new T.HemisphereLight('#e8f2ff','#526077',.65);scene.add(hemi);
    const sun = new T.DirectionalLight('#fff5e8', .85); sun.position.set(-12, 30, 24); scene.add(sun);
    const fill = new T.DirectionalLight('#75bdff', .22); fill.position.set(18, 10, -18);scene.add(fill);
    const grp = new T.Group();scene.add(grp); const grid = new T.GridHelper(120,60,0x315b73,0x1b3448); grid.position.y=-1.15;grid.material.transparent=true;grid.material.opacity=.24;scene.add(grid);
    const geometryCache = [], matCache = new Map(), registry = new Map();
    // Une petite texture de relief partagée, générée localement et sans téléchargement.
    const noiseSize=64,noise=new Uint8Array(noiseSize*noiseSize*4);let seed=137;
    for(let i=0;i<noise.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=110+(seed>>>26);noise[i]=noise[i+1]=noise[i+2]=v;noise[i+3]=255;}
    const concreteBump=new T.DataTexture(noise,noiseSize,noiseSize,T.RGBAFormat);concreteBump.wrapS=concreteBump.wrapT=T.RepeatWrapping;concreteBump.repeat.set(5,5);concreteBump.magFilter=T.LinearFilter;concreteBump.minFilter=T.LinearFilter;concreteBump.needsUpdate=true;
    let quality='standard',renderProfile=profilRendu(quality),envTarget=null,envUnavailable=false,edgesDirty=true;
    const ground=new T.Mesh(new T.PlaneGeometry(1,1),new T.ShadowMaterial({opacity:.22}));ground.rotation.x=-Math.PI/2;ground.visible=false;ground.receiveShadow=true;scene.add(ground);
    sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.00015;sun.shadow.normalBias=.018;
    const modelEdges=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:0x243a48,transparent:true,opacity:.27,depthTest:true,depthWrite:false,toneMapped:false}));modelEdges.visible=false;modelEdges.renderOrder=2;scene.add(modelEdges);
    const stageBase=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({color:0x435668,roughness:.95,metalness:0}));stageBase.rotation.x=-Math.PI/2;stageBase.visible=false;stageBase.receiveShadow=true;scene.add(stageBase);
    function environnementStudio(){
      if(envTarget||envUnavailable)return;
      let source=null,pmrem=null;const planes=renderer.clippingPlanes;
      try{renderer.clippingPlanes=[];
        source=new T.DataTexture(studioPixels(),256,128,T.RGBAFormat);source.mapping=T.EquirectangularReflectionMapping;source.encoding=T.sRGBEncoding;source.minFilter=T.LinearFilter;source.magFilter=T.LinearFilter;source.needsUpdate=true;
        pmrem=new T.PMREMGenerator(renderer);envTarget=pmrem.fromEquirectangular(source);
      }catch(e){envUnavailable=true;if(envTarget){envTarget.dispose();envTarget=null;}}
      finally{renderer.clippingPlanes=planes;source?.dispose();pmrem?.dispose();}
    }
    function appliquerOmbres(){
      // Une coupe ne doit jamais laisser une ombre de la partie masquée.
      const high=renderProfile.shadows&&!sectionActive()&&mode!=='plancher';
      renderer.shadowMap.enabled=high;sun.castShadow=high;ground.visible=high&&!renderProfile.studio;stageBase.visible=high&&renderProfile.studio;
      renderer.shadowMap.needsUpdate=high;
    }
    function configQualite(){
      renderProfile=profilRendu(quality,registry.size,renderer.capabilities.maxTextureSize);
      if(renderProfile.reflection)environnementStudio();
      scene.environment=renderProfile.reflection&&envTarget?envTarget.texture:null;
      hemi.intensity=scene.environment ? .42 : .65;
      sun.intensity=scene.environment ? 1.05 : .85;
      fill.intensity=renderProfile.studio ? .28 : .22;
      renderer.toneMappingExposure=renderProfile.exposure;
      if(sun.shadow.mapSize.x!==renderProfile.shadowSize){if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}sun.shadow.mapSize.set(renderProfile.shadowSize,renderProfile.shadowSize);}
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,renderProfile.pixelRatio));
      for(const m of matCache.values()){
        if(m.userData.mcConcrete){m.bumpMap=renderProfile.edges?concreteBump:null;m.bumpScale=.035;}
        if(m.userData.mcGlass){m.envMapIntensity=scene.environment?1.1:.15;m.clearcoat=scene.environment ? .5 : 0;}
        m.needsUpdate=true;
      }
      for(const e of registry.values()){e.mesh.castShadow=renderProfile.shadows&&!e.mesh.material.userData.mcGlass;e.mesh.receiveShadow=renderProfile.shadows;}
      grid.material.opacity=renderProfile.studio ? .08 : renderProfile.high ? .15 : .24;
      edgesDirty=true;appliquerOmbres();
      $('[data-val="render-profile"]').textContent=(quality==='studio'?'Studio':quality==='high'?'Détaillé':'Fluide')+(quality!=='standard'&&!renderProfile.shadows?' · allégé (grande maquette)':'')+(envUnavailable&&renderProfile.reflection?' · reflets indisponibles':'');
      onResize();
    }
    const getMat = (key, hex, metalness=0) => {
      if(!matCache.has(key))matCache.set(key,new T.MeshStandardMaterial({color:hex,roughness:metalness?.45:.83,metalness,side:T.DoubleSide}));
      return matCache.get(key);
    };
    let selected=null, isolated=null, hidden=new Set(), roofHidden=false, statusColors=false, dataset=null, disposed=false, raf=0, press=null, backRemove=null;
    let fitPending=false;let mode='structure', view='3D', page='viewer', exploded=false, detail=false, tab='Infos', detected=false;
    let hiddenLots=new Set(), outline=null,highlight=null,highlightId=null; let ifcWorker=null, ifcTimer=0, ifcRequest=0, ocrWorker=null, pdfTask=null, reading=false, ocrSuggestions={};
    // Plans globaux Three.js : toutes les surfaces (y compris contours) sont découpées.
    const sectionBounds=new T.Box3();
    const capMesh=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial({color:0xc8ac8c,side:T.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));capMesh.visible=false;scene.add(capMesh);let capsDirty=true;
    const footBelow=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:0x17374e,toneMapped:false,depthTest:true}));
    const footAbove=new T.LineSegments(new T.BufferGeometry(),new T.LineDashedMaterial({color:0xd38a24,toneMapped:false,depthTest:true,dashSize:.12,gapSize:.07}));
    for(const lines of [footBelow,footAbove]){lines.visible=false;lines.renderOrder=6;scene.add(lines);}let feetDirty=true;
    const sections={h:{active:false,inverse:false,value:0,axis:'y',plane:new T.Plane()},v:{active:false,inverse:false,value:0,axis:'x',plane:new T.Plane()}};
    function sectionActive(){return sections.h.active||sections.v.active;}
    function appliquerCoupes(){
      const planes=[];
      for(const [key,c] of Object.entries(sections)){
        if(c.active&&!sectionBounds.isEmpty()){
          const p=coupeParametres(sectionBounds.min[c.axis],sectionBounds.max[c.axis],c.value,c.inverse);
          c.plane.normal.set(c.axis==='x'?p.normal:0,c.axis==='y'?p.normal:0,0);c.plane.constant=p.constant;
          if(c.value>0)planes.push(c.plane);
        }
        $('[data-section-row="'+key+'"]').hidden=!c.active;
        $('[data-act="section-'+key+'"]').classList.toggle('active',c.active);
        $('[data-invert="'+key+'"]').classList.toggle('active',c.inverse);
        $('[data-section-slider="'+key+'"]').value=c.value;
        $('[data-section-value="'+key+'"]').textContent=Math.round(c.value)+'%';
      }
      renderer.clippingPlanes=planes;capsDirty=true;appliquerOmbres();
      $('[data-act="cut"]').classList.toggle('active',sectionActive());
      $('[data-val="section-note"]').textContent=(sections.h.active?'H : '+(sections.h.inverse?'bas → haut':'haut → bas'):'')+(sections.h.active&&sections.v.active?' · ':'')+(sections.v.active?'V : '+(sections.v.inverse?'−X → +X':'+X → −X'):'');
      schedule();
    }
    function resetCoupes(){for(const c of Object.values(sections)){c.active=false;c.inverse=false;c.value=0;} $('[data-role="section-panel"]').hidden=true;appliquerCoupes();}
    function ouvrirCoupes(){const p=$('[data-role="section-panel"]');if(!p.hidden){p.hidden=true;return;}p.hidden=false;if(!sectionActive())sections.h.active=true;appliquerCoupes();}
    const etat = e => e.status;
    const couleur = ()=>STATUS_COLOR;
    const hex = n=>'#'+n.toString(16).padStart(6,'0');
    const levelRank = level => {const m=/^(?:R|N)\+(\d+)$/.exec(level);return m?Number(m[1]):level==='Toiture'?8:0;};
    function clearOutline(){if(outline){outline.parent?.remove(outline);outline.geometry.dispose();outline.material.dispose();outline=null;}if(highlight){highlight.parent?.remove(highlight);highlight.material.dispose();highlight=null;}highlightId=null;}
    function selectedOutline(){
      const v=registry.get(selected);if(!v||!v.mesh.visible){clearOutline();return;}if(highlightId===selected)return;
      clearOutline();highlightId=selected;
      outline=new T.LineSegments(new T.EdgesGeometry(v.mesh.geometry,18),new T.LineBasicMaterial({color:0x67efff,toneMapped:false,depthTest:true,transparent:true,opacity:1}));outline.renderOrder=12;v.mesh.add(outline);
      highlight=new T.Mesh(v.mesh.geometry,new T.MeshBasicMaterial({color:0x35d9f4,toneMapped:false,transparent:true,opacity:.18,depthWrite:false,depthTest:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,side:T.DoubleSide}));highlight.renderOrder=11;v.mesh.add(highlight);
    }
    function kpis(){const a=dataset||[];$('[data-val="total"]').textContent=a.length;$('[data-val="avg"]').textContent=new Set(a.map(e=>e.lot)).size;$('[data-val="nc"]').textContent=new Set(a.map(e=>e.level)).size;}
    function legend(){const l=$('[data-role="legend"]');l.replaceChildren();for(const [name,c] of Object.entries(couleur())){const span=document.createElement('span'),dot=document.createElement('i');dot.style.background=hex(c);span.append(dot,document.createTextNode(name));l.append(span);}}
    function modeUI(){$('[data-act="plancher"]').classList.toggle('active',mode==='plancher');$('[data-act="plancher"]').setAttribute('aria-pressed',String(mode==='plancher'));$('[data-role="foot-controls"]').hidden=mode!=='plancher';$('[data-act="restorequick"]').hidden=hidden.size===0&&!isolated;$('[data-role="legend"]').hidden=!statusColors;for(const a of ['structure','architecture','color','explode','cut'])$('[data-act="'+a+'"]').classList.toggle('active',a==='color'?statusColors:a==='explode'?exploded:a==='cut'?sectionActive():mode===a);$('[data-act="view"]').textContent='Vue '+view;}
    function dash(){const d=$('[data-role="dashboard"]'),q=$('[data-role="shortcuts"]');d.replaceChildren();q.replaceChildren();const a=dataset||[],counts=new Map();for(const e of a)counts.set(e.type,(counts.get(e.type)||0)+1);const h=document.createElement('h3');h.textContent='Inventaire géométrique · '+a.length+' ouvrages';d.append(h);for(const [k,n] of [...counts].sort((a,b)=>b[1]-a[1])){const p=document.createElement('p');p.textContent=k+' : '+n;d.append(p);const b=document.createElement('button');b.textContent=k+' ('+n+')';b.onclick=()=>{hidden.clear();hiddenLots.clear();isolated=null;resetCoupes();roofHidden=false;mode='all';statusColors=false;for(const key of ['building','lot','zone','level','type','status'])$('[data-filter="'+key+'"]').value='all';$('[data-filter="type"]').value=k;select(null);setPage('viewer');resetCamera();};q.append(b);}}
    function setPage(p){const previous=page;page=p;el.querySelectorAll('[data-pane]').forEach(n=>n.hidden=n.dataset.pane!==p);el.querySelectorAll('.mcnav [data-page]').forEach(n=>n.classList.toggle('active',n.dataset.page===p));if(p==='viewer'){onResize();if(previous!=='viewer'&&fitPending){fitPending=false;resetCamera();}}if(p==='dash')dash();if(p==='ai')drawPlan();}
    function drawPlan(){const svg=$('[data-role="aiplan"]');let shapes='';for(let i=0;i<4;i++){const x=25+i*96;shapes+='<path d="M'+x+' 10V180" stroke="#526f86" stroke-dasharray="4 4"/>';for(let j=0;j<3;j++){const y=25+j*70;shapes+='<rect x="'+(x-6)+'" y="'+(y-6)+'" width="12" height="12" fill="'+(detected?'#ee9476':'#b6ccda')+'"/>';if(i<3)shapes+='<rect x="'+(x+6)+'" y="'+(y-3)+'" width="84" height="6" fill="'+(detected?'#dbad55':'#7e99ac')+'"/>';if(j<2)shapes+='<rect x="'+(x-3)+'" y="'+(y+6)+'" width="6" height="58" fill="'+(detected?'#dbad55':'#7e99ac')+'"/>';}}svg.innerHTML=shapes;}

    // La sélection ne remplace jamais le matériau d'état.
    const pos = v => new T.Vector3(v[0],v[1],v[2]);
    function createMesh(g, type, lot) {
      let geo, mesh;
      if(g.kind==='box'){ geo=new T.BoxGeometry(...g.size); mesh=new T.Mesh(geo); mesh.position.set(...g.position); if(vec(g.rotation,3))mesh.rotation.set(...g.rotation); }
      else if(g.kind==='beam'){let a=pos(g.start),b=pos(g.end),d=b.clone().sub(a),len=d.length();geo=new T.BoxGeometry(g.width,Math.max(.01,len),g.depth);mesh=new T.Mesh(geo);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());}
      else {geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(g.positions,3));geo.setIndex(g.indices);geo.computeVertexNormals();mesh=new T.Mesh(geo);}
      geometryCache.push(geo);
      const profile=profilMateriau(type,lot),key='m:'+profile.kind+':'+profile.color+(geo.getAttribute('uv')?':uv':':sans-uv');
      if(!matCache.has(key)){
        const m=profile.kind==='verre'?new T.MeshPhysicalMaterial({color:profile.color,roughness:.18,metalness:.18,clearcoat:scene.environment ? .5 : 0,clearcoatRoughness:.12,envMapIntensity:scene.environment?1.1:.15,side:T.DoubleSide}):new T.MeshStandardMaterial({color:profile.color,roughness:profile.roughness,metalness:profile.metalness,side:T.DoubleSide,envMapIntensity:(profile.kind==='metal'||profile.kind==='acier') ? .85 : .38});
        m.userData.mcGlass=profile.kind==='verre';
        m.userData.mcConcrete=profile.kind==='beton'&&!!geo.getAttribute('uv');
        if(m.userData.mcConcrete&&renderProfile.edges){m.bumpMap=concreteBump;m.bumpScale=.045;}
        matCache.set(key,m);
      }
      // Les maillages IFC ne disposent pas forcément d'UV : pas de bump sur ces éléments.
      mesh.material=matCache.get(key);
      if(!geo.getAttribute('uv')&&mesh.material.userData.mcConcrete){const plainKey=key+':sans-uv';if(!matCache.has(plainKey)){const m=mesh.material.clone();m.userData.mcConcrete=false;m.bumpMap=null;matCache.set(plainKey,m);}mesh.material=matCache.get(plainKey);}
      mesh.castShadow=renderProfile.shadows&&!mesh.material.userData.mcGlass;mesh.receiveShadow=renderProfile.shadows;
      return mesh;
    }
    function resetCamera(){
      const bounds=new T.Box3().setFromObject(grp),size=bounds.getSize(new T.Vector3());bounds.getCenter(projectCenter);const span=Math.max(2,size.length());ground.position.set(projectCenter.x,bounds.min.y-.03,projectCenter.z);ground.scale.set(span*2,span*2,1);stageBase.position.copy(ground.position);stageBase.scale.set(span*1.7,span*1.7,1);grid.position.set(projectCenter.x,bounds.min.y-.04,projectCenter.z);grid.scale.setScalar(Math.max(.1,span/95));sun.target.position.copy(projectCenter);scene.add(sun.target);sun.position.copy(projectCenter).add(new T.Vector3(-.65,1,.7).multiplyScalar(span));Object.assign(sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:.1,far:span*5});sun.shadow.camera.updateProjectionMatrix();pan.x=0;pan.y=0;appliquerPan();sectionBounds.copy(bounds);appliquerCoupes();
      const radius=Math.max(.05,size.length()/2),vertical=T.MathUtils.degToRad(camera.fov/2),horizontal=Math.atan(Math.tan(vertical)*Math.max(.1,camera.aspect));
      // Ajustement des huit coins dans le repère caméra : moins d'espace vide qu'une sphère englobante.
      const direction=new T.Vector3(.7,.56,.8).normalize(),right=new T.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right);
      let distance=.3;
      for(let i=0;i<8;i++){const p=new T.Vector3(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z).sub(projectCenter);distance=Math.max(distance,p.dot(direction)+Math.max(Math.abs(p.dot(right))/Math.tan(horizontal),Math.abs(p.dot(up))/Math.tan(vertical))*1.13);}
      fitDistance=distance;
      controls.minDistance=Math.max(.025,radius*.035);controls.maxDistance=fitDistance*5;
      camera.near=Math.max(.001,radius*.0002);camera.far=Math.max(500,controls.maxDistance+radius*3);camera.updateProjectionMatrix();
      controls.target.copy(projectCenter);camera.position.copy(projectCenter).add(direction.multiplyScalar(fitDistance));controls.update();schedule();
    }
    function orienterDessus(signe){const d=Math.max(controls.minDistance,camera.position.distanceTo(projectCenter));controls.target.copy(projectCenter);camera.position.copy(projectCenter).add(new T.Vector3(0,signe*d,d*.0001));controls.update();schedule();}
    function populate(elements) {
      clearOutline(); for(const child of [...grp.children]) grp.remove(child);
      geometryCache.splice(0).forEach(g=>g.dispose()); registry.clear(); hidden.clear(); hiddenLots.clear(); isolated=null; selected=null; dataset=elements; exploded=false;resetCoupes();mode='structure';detail=false;roofHidden=false;for(const k of ['building','lot','zone','level','type','status'])$('[data-filter="'+k+'"]').value='all';
      for(const e of elements){
        e.journal=[]; let mesh=createMesh(e.geometry,e.type,e.lot); mesh.userData.modelcoreId=e.id; grp.add(mesh);registry.set(e.id,{mesh,meta:e,baseMat:mesh.material,baseY:mesh.position.y});
      }
      refreshFilters();configQualite();visibility();resetCamera();fitPending=page!=='viewer';updateDetails();kpis();
    }
    function refreshFilters(){
      for(const key of ['building','lot','zone','level','type','status']){
        const f=$('[data-filter="'+key+'"]'),old=f.value;f.replaceChildren(new Option(key==='zone'?'Toutes zones':key==='level'?'Tous niveaux':key==='type'?'Tous ouvrages':key==='building'?'Tous bâtiments':key==='lot'?'Tous lots':'Tous états','all'));
        const values=key==='status'?Object.keys(couleur()):[...new Set(dataset.map(e=>e[key]))].sort();values.forEach(v=>f.add(new Option(v,v)));f.value=values.includes(old)?old:'all';
      }
      const levels=$('[data-role="levels"]');levels.replaceChildren();for(const v of ['all',...new Set(dataset.map(e=>e.level))]){const b=document.createElement('button');b.textContent=v==='all'?'Tous':v;b.title=v;b.onclick=()=>{$('[data-filter="level"]').value=v;isolated=null;select(null);};b.dataset.level=v;levels.append(b);}
      const layers=$('[data-role="layers"]');layers.replaceChildren();for(const lot of [...new Set(dataset.map(e=>e.lot))].sort()){const b=document.createElement('button');b.textContent=lot;b.dataset.lot=lot;b.onclick=()=>{mode='all';hiddenLots.has(lot)?hiddenLots.delete(lot):hiddenLots.add(lot);visibility();updateDetails();};layers.append(b);}
      legend();
    }
    function visibility(){capsDirty=true;feetDirty=true;edgesDirty=true;appliquerOmbres();
      for(const entry of registry.values()){
        const e=entry.meta;
        const arch=/façade|architecture|second œuvre|vitrage|étanchéité/i.test(e.lot); const technique=/ferraillage|CFO|CFA|plomberie|CVC|électricité|assainissement/i.test(e.lot);
        entry.mesh.position.y=entry.baseY+(exploded?levelRank(e.level)*1.2:0);
        entry.mesh.visible=!hidden.has(e.id)&&!hiddenLots.has(e.lot)&&(!isolated||e.id===isolated)&&(!roofHidden||!(e.type==='Charpente'||e.type==='Couverture'||e.level==='Toiture'))&&(mode!=='plancher'||typePlancher(e.type))&&(mode!=='structure'||(!arch&&!technique))&&(mode!=='architecture'||!technique)&&
          ['building','lot','zone','level','type','status'].every(k=>$('[data-filter="'+k+'"]').value==='all'||$('[data-filter="'+k+'"]').value===(k==='status'?etat(e):e[k]));
        entry.mesh.material=statusColors?getMat('s:'+etat(e),couleur()[etat(e)]):entry.baseMat;
      }
      if(selected&&!registry.get(selected)?.mesh.visible){selected=null;isolated=null;updateDetails();}
      selectedOutline();const count=[...registry.values()].filter(e=>e.mesh.visible).length;$('[data-val="visible"]').textContent=count+' / '+registry.size+' OUVRAGES';
      el.querySelectorAll('[data-level]').forEach(b=>b.classList.toggle('active',b.dataset.level===$('[data-filter="level"]').value));el.querySelectorAll('[data-lot]').forEach(b=>b.classList.toggle('active',!hiddenLots.has(b.dataset.lot)));modeUI();schedule();
    }
    function updateDetails(){
      const e=selected&&registry.get(selected)?.meta;
      $('[data-role="inspector"]').hidden=!e;$('[data-pane="viewer"]').classList.toggle('mc-has-selection',!!e);if(!e)detail=false;
      $('[data-val="object-geo"]').textContent=e?ficheGeometrique(e.geometry):'';
      $('[data-val="object-icon"]').textContent=e?.geometry.kind==='beam'?'╱':e?.geometry.kind==='mesh'?'◇':'▣';
      $('[data-val="progress-percent"]').textContent=(e?e.progress:0)+'%';
      $('[data-act="restore-hidden"]').disabled=hidden.size===0&&!isolated;
      $('[data-act="detail"]').textContent=detail?'Fiche ↓':'Fiche ↑';
      $('[data-act="detail"]').setAttribute('aria-expanded',String(detail));
      $('[data-val="id"]').textContent=e?e.type+' · '+e.id:'Smart Object Inspector';
      $('[data-val="info"]').textContent=e?e.building+' · '+e.level+' · '+e.zone+' · '+e.lot:'Touchez un ouvrage pour consulter sa fiche.';
      $('[data-val="warning"]').textContent=e?.sourceFormat==='IFC'?'IFC local · classification à vérifier · état non synchronisé.':'Données locales · aucune modification du chantier.';
      for(const a of ['isolate','hide','detail'])$('[data-act="'+a+'"]').disabled=!e;
      $('[data-act="isolate"]').textContent=isolated?'Quitter':'Isoler';
      const status=$('[data-role="editstatus"]');status.replaceChildren(...Object.keys(couleur()).map(v=>new Option(v,v)));status.disabled=!e;if(e)status.value=etat(e);
      $('[data-role="progressbar"]').style.width=(e?e.progress:0)+'%';
      $('[data-role="extra"]').hidden=!e||!detail;if(!e)return;
      const p=$('[data-role="progress"]');p.value=e.progress;$('[data-role="progresslabel"]').hidden=tab!=='Infos';
      const value=$('[data-val="extra"]');value.textContent=tab==='Infos'?'Source : '+(e.sourceFormat||'JSON')+' · ID source : '+(e.sourceId||'non fourni')+' · Géométrie : '+e.geometry.kind:tab==='Géométrie'?ficheGeometrique(e.geometry):tab==='Docs'?'Aucun PV, plan ou photo associé à cette démo.':e.journal.join(' | ')||'Aucune modification locale.';
      el.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    }
    function select(id){if(mode==='plancher'&&$('[data-filter="level"]').value==='all')mode='structure';const next=registry.has(id)?id:null;if(next!==selected)detail=false;selected=next;if(!selected)isolated=null;visibility();updateDetails();}
    // Surfaces de fermeture des boîtes et poutres seulement; maillages IFC arbitraires exclus.
    function actualiserCaps(){
      if(!capsDirty)return;capsDirty=false;
      const planes=renderer.clippingPlanes,positions=[];
      if(planes.length){
        grp.updateMatrixWorld(true);let processed=0;
        for(const e of registry.values()){
          if(!e.mesh.visible||e.meta.geometry.kind==='mesh')continue;
          if(++processed>1500)break;
          const g=e.mesh.geometry;if(!g.boundingBox)g.computeBoundingBox();const b=g.boundingBox;
          const corners=Array.from({length:8},(_,i)=>new T.Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).applyMatrix4(e.mesh.matrixWorld).toArray());
          for(const plane of planes){
            const normal=plane.normal.toArray(),poly=contourCoupe(corners,normal,plane.constant);
            // Décalage infinitésimal du côté conservé pour éviter le rejet par le clipping.
            for(let j=1;j+1<poly.length;j++)for(const p of [poly[0],poly[j],poly[j+1]])positions.push(...p.map((x,k)=>x+normal[k]*.00002));
          }
        }
      }
      capMesh.geometry.dispose();capMesh.geometry=new T.BufferGeometry();capMesh.geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));capMesh.visible=positions.length>0;
    }
    // Les empreintes utilisent les géométries réellement chargées, y compris les triangles IFC.
    // Les dalles inclinées, surfaces non horizontales et budgets dépassés sont signalés.
    function actualiserEmpreintes(){
      if(!feetDirty)return;feetDirty=false;
      const positions={below:[],above:[]},counts={below:new Set(),above:new Set()};let skipped=0,truncated=false,budget=180000;
      const side=$('[data-role="foot-side"]').value;
      function consume(n=1){budget-=n;if(budget<0){truncated=true;return false;}return true;}
      if(mode==='plancher'&&dataset){
        grp.updateMatrixWorld(true);
        const entries=[...registry.values()],slabs=[],supports=[];
        for(const e of entries){
          if(!typeSupport(e.meta.type)&&!(e.mesh.visible&&typePlancher(e.meta.type)))continue;
          const bounds=new T.Box3().setFromObject(e.mesh);
          if(typeSupport(e.meta.type)){if(!hidden.has(e.meta.id)&&!hiddenLots.has(e.meta.lot))supports.push({e,bounds});continue;}
          if(bounds.isEmpty())continue;
          const m=e.mesh,geo=m.geometry,polys=[],top=bounds.max.y;
          if(e.meta.geometry.kind==='box'&&Math.abs(m.rotation.x)<1e-7&&Math.abs(m.rotation.z)<1e-7){
            if(!geo.boundingBox)geo.computeBoundingBox();const b=geo.boundingBox;
            for(const [x,z] of [[b.min.x,b.min.z],[b.max.x,b.min.z],[b.max.x,b.max.z],[b.min.x,b.max.z]]){
              const p=new T.Vector3(x,b.max.y,z).applyMatrix4(m.matrixWorld);polys.push([p.x,p.z]);
            }
            slabs.push({e,bounds,polys:[polys]});continue;
          }
          if(e.meta.geometry.kind!=='mesh'){skipped++;continue;}
          const pos=geo.getAttribute('position'),idx=geo.index;
          for(let i=0;i<(idx?idx.count:pos.count);i+=3){
            if(!consume())break;
            const tri=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(pos,idx?idx.getX(i+j):i+j).applyMatrix4(m.matrixWorld));
            if(tri.some(p=>Math.abs(p.y-top)>.0005))continue;
            const p=tri.map(v=>[v.x,v.z]),area=(p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0]);
            if(Math.abs(area)<1e-10)continue;if(area<0)p.reverse();polys.push(p);
          }
          if(polys.length&&!truncated)slabs.push({e,bounds,polys});else skipped++;
          if(truncated)break;
        }
        const cache=new Map();
        function segments(support,y){
          const key=support.e.meta.id+'|'+y.toFixed(6);if(cache.has(key))return cache.get(key);
          const m=support.e.mesh,g=m.geometry,out=[];
          if(support.e.meta.geometry.kind!=='mesh'){
            if(!g.boundingBox)g.computeBoundingBox();const b=g.boundingBox,corners=Array.from({length:8},(_,i)=>new T.Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).applyMatrix4(m.matrixWorld).toArray());
            const p=contourCoupe(corners,[0,1,0],-y);for(let i=0;i<p.length;i++)out.push([[p[i][0],p[i][2]],[p[(i+1)%p.length][0],p[(i+1)%p.length][2]]]);
          }else{
            const pos=g.getAttribute('position'),idx=g.index;
            for(let i=0;i<(idx?idx.count:pos.count);i+=3){
              if(!consume())break;const tri=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(pos,idx?idx.getX(i+j):i+j).applyMatrix4(m.matrixWorld)),pts=[];
              const add=p=>{if(!pts.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-7))pts.push(p);};
              for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],d=a.y-y,e=b.y-y;if(Math.abs(d)<1e-8)add([a.x,a.z]);if(d*e<0){const t=d/(d-e);add([a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t]);}}
              if(pts.length===2)out.push(pts);
            }
          }
          cache.set(key,out);return out;
        }
        outer:for(const slab of slabs)for(const support of supports){
          if(!consume())break outer;
          const a=slab.bounds,b=support.bounds;
          if(slab.e.meta.building!==support.e.meta.building||a.max.x<b.min.x||a.min.x>b.max.x||a.max.z<b.min.z||a.min.z>b.max.z)continue;
          for(const k of (side==='both'?['below','above']:[side])){
            const y=contactPlancher(a.min.y,a.max.y,b.min.y,b.max.y,k);if(y===null)continue;
            for(const [p,q] of segments(support,y)){
              if(truncated)break outer;
              const intervals=[];for(const poly of slab.polys){if(!consume())break outer;const v=segmentDansPolygone(p,q,poly);if(v)intervals.push(v);}
              for(const [lo,hi] of fusionIntervalles(intervals)){
                const top=a.max.y+(k==='above'?.006:.003);
                for(const t of [lo,hi])positions[k].push(p[0]+(q[0]-p[0])*t,top,p[1]+(q[1]-p[1])*t);
                counts[k].add(support.e.meta.id);
              }
            }
          }
        }
      }
      for(const [key,lines] of [['below',footBelow],['above',footAbove]]){
        lines.geometry.dispose();lines.geometry=new T.BufferGeometry();lines.geometry.setAttribute('position',new T.Float32BufferAttribute(positions[key],3));lines.visible=positions[key].length>0;if(lines.visible&&key==='above')lines.computeLineDistances();
      }
      $('[data-val="foot-report"]').textContent=counts.below.size+' dessous · '+counts.above.size+' dessus'+(skipped?' · '+skipped+' dalles non traitées':'')+(truncated?' · calcul partiel (limite)':'')+' · contacts indicatifs';
    }
    function actualiserAretes(){
      if(!edgesDirty)return;edgesDirty=false;
      const p=[];
      if(renderProfile.edges&&mode!=='plancher'){
        grp.updateMatrixWorld(true);
        // Un seul draw call, contours des primitives uniquement, pas de coût sur l'IFC dense.
        for(const e of registry.values()){
          if(!e.mesh.visible||e.meta.geometry.kind==='mesh'||p.length>=180000)continue;
          const m=e.mesh,g=m.geometry;if(!g.boundingBox)g.computeBoundingBox();const b=g.boundingBox;
          const corners=Array.from({length:8},(_,i)=>new T.Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).applyMatrix4(m.matrixWorld));
          for(let i=0;i<8;i++)for(const bit of [1,2,4])if((i^bit)>i)p.push(...corners[i].toArray(),...corners[i^bit].toArray());
        }
      }
      modelEdges.geometry.dispose();modelEdges.geometry=new T.BufferGeometry();modelEdges.geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));modelEdges.visible=p.length>0;
    }
    function render(){if(disposed||page!=='viewer')return;actualiserCaps();actualiserEmpreintes();actualiserAretes();const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);
      if(view==='3D'){renderer.render(scene,camera);return;}
      const ctr=projectCenter,sz=sectionBounds.getSize(new T.Vector3()),pw=view==='Hybride'?w/2:w,asp=pw/h,half=Math.max(sz.z/2,sz.x/(2*asp),.1)*1.15*Math.max(.01,camera.position.distanceTo(projectCenter)/fitDistance);
      const dx=-2*half*asp*pan.x,dy=2*half*pan.y;
      planCam.left=-half*asp+dx;planCam.right=half*asp+dx;planCam.top=half+dy;planCam.bottom=-half+dy;planCam.far=Math.max(2000,sz.y*5+100);planCam.position.set(ctr.x,ctr.y+Math.max(100,sz.y*3),ctr.z);planCam.up.set(0,0,-1);planCam.lookAt(ctr);planCam.updateProjectionMatrix();
      if(view==='2D'){renderer.render(scene,planCam);return;}
      renderer.setScissorTest(true);renderer.setViewport(0,0,w/2,h);renderer.setScissor(0,0,w/2,h);renderer.render(scene,camera);renderer.setViewport(w/2,0,w/2,h);renderer.setScissor(w/2,0,w/2,h);renderer.render(scene,planCam);renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);
    }
    function schedule(){if(disposed||raf)return;raf=requestAnimationFrame(()=>{raf=0;render();});}
    function appliquerPan(){
      const w=Math.max(1,stage.clientWidth/(view==='Hybride'?2:1)),h=Math.max(1,stage.clientHeight);
      camera.setViewOffset(w,h,-pan.x*w,-pan.y*h,w,h);schedule();
    }
    const onResize=()=>{let w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);renderer.setSize(w,h);appliquerPan();};
    const observer=new ResizeObserver(onResize);observer.observe(stage);
    const raycaster=new T.Raycaster(), mouse=new T.Vector2();
    const surface=renderer.domElement;
    surface.addEventListener('pointerdown',e=>{
      gesture.down(e);panGesture.down(e);
      // En 2D, garder le plan horizontal : le zoom est synchronisé avec la caméra 3D.
      const r=surface.getBoundingClientRect();controls.enableRotate=view==='3D'||(view==='Hybride'&&e.clientX-r.left<r.width/2);
    },true);
    surface.addEventListener('pointermove',e=>{gesture.move(e);const d=panGesture.move(e);if(!d)return;const w=Math.max(1,stage.clientWidth/(view==='Hybride'?2:1)),h=Math.max(1,stage.clientHeight);pan.x=Math.max(-2,Math.min(2,pan.x+d.x/w));pan.y=Math.max(-2,Math.min(2,pan.y+d.y/h));appliquerPan();},true);
    surface.addEventListener('pointercancel',e=>{gesture.cancel(e);panGesture.up(e);},true);
    surface.addEventListener('lostpointercapture',e=>{gesture.cancel(e);panGesture.up(e);},true);
    surface.addEventListener('pointerup',e=>{
      panGesture.up(e);if(!gesture.up(e))return;
      if(!$('[data-role="tools-panel"]').hidden){setTools(false);return;}
      const r=surface.getBoundingClientRect();let x=e.clientX-r.left,cam=camera,w=r.width;if(view==='2D')cam=planCam;if(view==='Hybride'){w/=2;if(x>=w){x-=w;cam=planCam;}}if(!w||!r.height)return;
      mouse.x=(x/w)*2-1;mouse.y=-((e.clientY-r.top)/r.height)*2+1;
      cam.updateMatrixWorld(true);grp.updateMatrixWorld(true);raycaster.setFromCamera(mouse,cam);const hit=raycaster.intersectObjects([...registry.values()].map(x=>x.mesh).filter(x=>x.visible),false).find(h=>pointDansCoupe(h.point,renderer.clippingPlanes));
      select(hit?.object?.userData?.modelcoreId||null);
    },true);
    controls.addEventListener('change',schedule);
    function close(){
      if(disposed)return;disposed=true;stopIfc();if(ocrWorker)ocrWorker.terminate().catch(()=>{});if(pdfTask)pdfTask.destroy().catch(()=>{});
      if(backRemove)try{backRemove();}catch(e){}
      if(raf)cancelAnimationFrame(raf);observer.disconnect();controls.dispose();
      clearOutline();scene.environment=null;envTarget?.dispose();sun.shadow.map?.dispose();modelEdges.geometry.dispose();modelEdges.material.dispose();stageBase.geometry.dispose();stageBase.material.dispose();for(const lines of [footBelow,footAbove]){lines.geometry.dispose();lines.material.dispose();}capMesh.geometry.dispose();capMesh.material.dispose();concreteBump.dispose();ground.geometry.dispose();ground.material.dispose();grid.geometry.dispose();grid.material.dispose();for(const g of geometryCache)g.dispose();for(const m of matCache.values())m.dispose();
      renderer.dispose();renderer.forceContextLoss();el.remove();
    }
    if(typeof pushBack==='function') backRemove=pushBack(close);
    const on=(act,fn)=>$('[data-act="'+act+'"]').addEventListener('click',fn);
    function setTools(open){$('[data-role="tools-panel"]').hidden=!open;$('[data-act="tools"]').setAttribute('aria-expanded',String(open));}
    $('[data-role="quality"]').onchange=e=>{quality=e.target.value;configQualite();};
    on('tools',()=>setTools($('[data-role="tools-panel"]').hidden));on('tools-close',()=>setTools(false));on('fitquick',resetCamera);
    on('close',close);on('top',()=>orienterDessus(1));
    on('under',()=>orienterDessus(-1));
    on('reset',()=>{isolated=null;hidden.clear();roofHidden=false;statusColors=false;hiddenLots.clear();resetCoupes();exploded=false;mode='structure';for(const k of ['building','lot','zone','level','type','status'])$('[data-filter="'+k+'"]').value='all';select(null);resetCamera();});
    on('zoomplus',()=>{camera.position.sub(controls.target).multiplyScalar(.78).add(controls.target);controls.update();});
    on('zoomminus',()=>{camera.position.sub(controls.target).multiplyScalar(1.25).add(controls.target);controls.update();});
    on('isolate',()=>{if(!selected)return;isolated=isolated?null:selected;visibility();updateDetails();});
    on('hide',()=>{if(!selected)return;hidden.add(selected);if(isolated===selected)isolated=null;select(null);});
    on('all',()=>{isolated=null;hidden.clear();hiddenLots.clear();resetCoupes();mode='all';roofHidden=false;for(const k of ['building','lot','zone','level','type','status'])$('[data-filter="'+k+'"]').value='all';select(null);});
    on('roof',()=>{roofHidden=!roofHidden;visibility();updateDetails();});
    on('color',()=>{statusColors=!statusColors;visibility();});
    on('structure',()=>{mode='structure';hiddenLots.clear();statusColors=false;select(null);});
    on('architecture',()=>{mode='architecture';hiddenLots.clear();statusColors=false;select(null);});
    on('fit',resetCamera);
    on('filters',()=>{$('[data-role="filters"]').classList.toggle('open');$('[data-role="layers"]').classList.remove('open');});
    on('layers',()=>{if(!$('[data-role="layers"]').classList.contains('open')&&mode!=='all'){for(const e of dataset){const arch=/façade|architecture|second œuvre|vitrage|étanchéité/i.test(e.lot),tech=/ferraillage|CFO|CFA|plomberie|CVC|électricité|assainissement/i.test(e.lot);if(tech||(mode==='structure'&&arch))hiddenLots.add(e.lot);}mode='all';visibility();} $('[data-role="layers"]').classList.toggle('open');$('[data-role="filters"]').classList.remove('open');});
    on('explode',()=>{if(mode==='plancher')mode='structure';exploded=!exploded;visibility();resetCamera();});
    on('cut',ouvrirCoupes);
    on('section-close',()=>{$('[data-role="section-panel"]').hidden=true;});
    on('section-reset',resetCoupes);
    for(const key of ['h','v']){
      on('section-'+key,()=>{sections[key].active=!sections[key].active;appliquerCoupes();});
      $('[data-invert="'+key+'"]').onclick=()=>{sections[key].inverse=!sections[key].inverse;appliquerCoupes();};
      $('[data-section-slider="'+key+'"]').addEventListener('input',e=>{sections[key].value=Number(e.target.value);appliquerCoupes();});
    }
    on('view',()=>{view=['3D','2D','Hybride'][(['3D','2D','Hybride'].indexOf(view)+1)%3];gesture.reset();panGesture.reset();controls.enableRotate=view!=='2D';$('.mcsplit').hidden=$('.mclabel').hidden=view!=='Hybride';modeUI();onResize();});
    on('plancher',()=>{
      if(mode==='plancher'){mode='structure';select(null);return;}
      const level=$('[data-filter="level"]'),building=$('[data-filter="building"]').value;
      const levels=[...new Set(dataset.filter(e=>typePlancher(e.type)&&(building==='all'||e.building===building)).map(e=>e.level))];
      if(!levels.length){toast('Aucun plancher identifié dans ce bâtiment.');return;}
      if(!levels.includes(level.value))level.value=levels.includes('RDC')?'RDC':levels[0];
      exploded=false;mode='plancher';statusColors=false;isolated=null;roofHidden=false;$('[data-filter="type"]').value='all';select(null);setTools(false);
    });
    $('[data-role="foot-side"]').onchange=()=>{feetDirty=true;schedule();};
    on('detail',()=>{detail=!detail;updateDetails();});
    on('selection-close',()=>select(null));
    const restoreHidden=()=>{hidden.clear();isolated=null;visibility();updateDetails();};on('restore-hidden',restoreHidden);on('restorequick',restoreHidden);
    el.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
    el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;updateDetails();});
    $('[data-role="progress"]').onchange=e=>{const o=registry.get(selected)?.meta;if(!o)return;o.progress=Number(e.target.value);o.journal.unshift('Avancement fictif : '+o.progress+'%');kpis();updateDetails();};
    on('detect',()=>{detected=true;$('[data-role="confirm"]').checked=false;drawPlan();$('[data-val="airesult"]').textContent='Simulation : 12 poteaux · 17 poutres · 6 dalles. Vérifiez les paramètres.';});
    on('generate',()=>{try{if(!detected||!$('[data-role="confirm"]').checked)throw Error('Chargez un plan ou lancez la détection simulée, puis confirmez les paramètres.');const p={};el.querySelectorAll('[data-ai]').forEach(i=>p[i.dataset.ai]=Number(i.value));p.epaisseur/=100;populate(validateManifest(maquetteParametrique(p)));$('[data-val="project"]').textContent=projectName+' · Trame paramétrique illustrative';$('[data-val="aierror"]').textContent='';setPage('viewer');}catch(e){$('[data-val="aierror"]').textContent=e.message;}});
    for(const k of ['building','lot','zone','level','type','status'])$('[data-filter="'+k+'"]').addEventListener('change',()=>{select(null);});
    $('[data-role="editstatus"]').addEventListener('change',e=>{
      if(!selected)return;const item=registry.get(selected);if(item&&STATES.includes(e.target.value)){const o=item.meta,old=o.status;o.status=e.target.value;o.journal.unshift('État fictif : '+old+' → '+o.status);if(o.status==='Réceptionné')o.progress=100;if(o.status==='Non commencé')o.progress=0;visibility();updateDetails();}
    });
    // Conversion IFC en Worker : annulation, délai maximal, contrôle du manifeste.
    function stopIfc(){ifcRequest++;if(ifcTimer)clearTimeout(ifcTimer);ifcTimer=0;if(ifcWorker)ifcWorker.terminate();ifcWorker=null;$('[data-act="ifccancel"]').hidden=true;$('[data-act="ifc"]').disabled=false;}
    on('ifc',()=>$('[data-role="ifcfile"]').click());
    on('ifccancel',()=>{stopIfc();$('[data-val="ifcreport"]').textContent='Import annulé.';});
    $('[data-role="ifcfile"]').onchange=async e=>{
      const file=e.target.files[0];e.target.value='';if(!file||disposed)return;
      const report=$('[data-val="ifcreport"]');
      if(!/\.ifc$/i.test(file.name)||file.size>8*1024*1024){report.textContent='IFC .ifc uniquement, 8 Mo maximum.';return;}
      stopIfc();const request=ifcRequest;$('[data-act="ifc"]').disabled=true;$('[data-act="ifccancel"]').hidden=false;report.textContent='Lecture IFC locale…';
      try{
        const bytes=await file.arrayBuffer();if(disposed||request!==ifcRequest)return;
        const w=new Worker(new URL('js/modelcore-ifc-worker.js',location.href));ifcWorker=w;
        ifcTimer=setTimeout(()=>{stopIfc();report.textContent='Délai dépassé (120 s). Découpez la maquette.';},120000);
        w.onerror=()=>{stopIfc();report.textContent='Worker IFC indisponible. Vérifiez que le build inclut WebIFC.';};
        w.onmessage=event=>{if(disposed||ifcWorker!==w)return;try{const v=event.data;if(!v.ok)throw Error(v.error);const data=validateManifest(v.data);const r=v.data.report;populate(data);mode='all';statusColors=false;visibility();$('[data-val="project"]').textContent=projectName+' · IFC '+clean(file.name)+' (local)';report.textContent=r.schema+' · '+r.imported+' ouvrages · '+r.triangles+' triangles · '+r.skipped+' maillages exclus · '+r.missing+' sans GlobalId. '+r.scope;setPage('viewer');}catch(err){report.textContent='Import IFC : '+clean(err.message);}finally{stopIfc();}};
        w.postMessage(bytes,[bytes]);
      }catch(err){if(request===ifcRequest){stopIfc();report.textContent='Import IFC : '+clean(err.message);}}
    };
    // PDF vectoriel : texte natif. Plan image/scanné : OCR Tesseract embarqué.
    async function lirePlan(file){
      const status=$('[data-val="ocrstatus"]');let text='',canvas=null,doc=null,bitmap=null;
      if(file.size>15*1024*1024)throw Error('Plan limité à 15 Mo.');
      try{
        if(/\.pdf$/i.test(file.name)||file.type==='application/pdf'){
          if(typeof pdfjsLib==='undefined')throw Error('PDF.js indisponible.');
          pdfTask=pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())});doc=await pdfTask.promise;const page=await doc.getPage(1);
          const tc=await page.getTextContent();text=tc.items.map(i=>i.str||'').join(' ');
          if(text.trim().length>=40)return {text,method:'Texte PDF natif'};
          const v=page.getViewport({scale:1}),vp=page.getViewport({scale:Math.min(3,2200/Math.max(v.width,v.height))});canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
        }else if(/^image\/(png|jpeg)$/.test(file.type)||/\.(png|jpe?g)$/i.test(file.name)){
          bitmap=await createImageBitmap(file);const scale=Math.min(1,2200/Math.max(bitmap.width,bitmap.height));canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
        }else throw Error('PDF, PNG ou JPEG uniquement.');
        if(disposed)throw Error('Studio fermé.');
        await needOCR();if(disposed)throw Error('Studio fermé.');
        const base=new URL('vendor/3d/',location.href).href;
        const worker=await Tesseract.createWorker('eng',1,{workerPath:base+'worker.min.js',corePath:base,langPath:base,gzip:true,logger:m=>{if(!disposed&&m.status==='recognizing text')status.textContent='OCR local : '+Math.round(m.progress*100)+' %';}});
        ocrWorker=worker;try{if(disposed)throw Error('Studio fermé.');const r=await worker.recognize(canvas);return {text:r.data.text||'',method:'OCR neuronal local (eng)'};}finally{if(ocrWorker===worker)ocrWorker=null;await worker.terminate().catch(()=>{});}
      }finally{bitmap?.close();if(canvas){canvas.width=0;canvas.height=0;}if(pdfTask){const task=pdfTask;pdfTask=null;await task.destroy().catch(()=>{});}}
    }
    on('planfile',()=>$('[data-role="planfile"]').click());
    $('[data-role="planfile"]').onchange=async e=>{
      const f=e.target.files[0];e.target.value='';if(!f||reading||disposed)return;
      reading=true;detected=false;ocrSuggestions={};$('[data-act="planfile"]').disabled=true;$('[data-act="applysuggestions"]').disabled=true;$('[data-role="confirm"]').checked=false;$('[data-role="ocrtext"]').value='';$('[data-val="suggestions"]').textContent='';el.querySelectorAll('[data-ai]').forEach(i=>i.value='');$('[data-val="ocrstatus"]').textContent='Analyse locale de la première page…';
      try{const r=await lirePlan(f);if(disposed)return;const text=r.text.slice(0,50000);$('[data-role="ocrtext"]').value=text;ocrSuggestions=suggestionsPlan(text);const keys=Object.keys(ocrSuggestions);$('[data-val="ocrstatus"]').textContent=r.method+' · '+(text.trim()?'texte extrait':'aucun texte reconnu');$('[data-val="suggestions"]').textContent=keys.length?keys.map(k=>k+' : '+ocrSuggestions[k].value+' ('+ocrSuggestions[k].evidence+')').join(' | ') : 'Aucune cote explicite non ambiguë détectée. Renseignez manuellement les dimensions.';$('[data-act="applysuggestions"]').disabled=!keys.length;detected=true;}
      catch(err){if(!disposed)$('[data-val="ocrstatus"]').textContent='Analyse : '+clean(err.message);}
      finally{reading=false;if(!disposed)$('[data-act="planfile"]').disabled=false;}
    };
    on('applysuggestions',()=>{for(const [k,v] of Object.entries(ocrSuggestions))$('[data-ai="'+k+'"]').value=v.value;$('[data-role="confirm"]').checked=false;});
    el.querySelectorAll('[data-ai]').forEach(i=>i.addEventListener('input',()=>{$('[data-role="confirm"]').checked=false;}));
    on('import',()=>{$('[data-role="file"]').click();});
    $('[data-role="file"]').addEventListener('change',async(e)=>{
      const f=e.target.files[0];e.target.value='';if(!f)return;
      try{if(f.size>10*1024*1024)throw new Error('Fichier supérieur à 10 Mo.');
        const json=JSON.parse(await f.text()),data=validateManifest(json);
        if(disposed)return;populate(data);$('[data-val="project"]').textContent=projectName+' · JSON '+clean(f.name)+' (local)';setPage('viewer');
      }catch(err){alert('Import ModelCore : '+clean(err.message));}
    });
    const chooseTemplate = key => {
      const demo = key==='stade' ? createDemo() : templates ? templates.make(key) : createDemo();
      populate(validateManifest(demo));
      $('[data-val="project"]').textContent = projectName + ' · Démo '+key+' (fictive)';
    };
    $('[data-role="projecttype"]').value = initialType;
    $('[data-role="projecttype"]').addEventListener('change',e=>chooseTemplate(e.target.value));
    onResize();chooseTemplate(initialType);
    return { close, getSelected:()=>registry.get(selected)?.meta||null, selectById:id=>{if(disposed||!registry.get(id)?.mesh.visible)return false;select(id);return selected===id;}, projectId, schema:SCHEMA };
  }
  window.ModelCore3D = { open, validateManifest, ficheGeometrique, suggestionsPlan, gesteSelection, gestePan, profilMateriau, profilRendu, studioPixels, contourCoupe, contactPlancher, segmentDansPolygone, fusionIntervalles, typePlancher, typeSupport, coupeParametres, pointDansCoupe, maquetteParametrique, demo:(type='stade')=>type==='stade'?createDemo():window.ModelCoreTemplates?window.ModelCoreTemplates.make(type):createDemo(), schema:SCHEMA };
})();
