// SiteTeam V1 integration: opt-in workspace preview, no migration or data writes.
(() => {
  'use strict';
  const css = document.createElement('style');
  css.textContent = `
#st-v1-open{position:fixed;right:14px;bottom:85px;z-index:8999;border:0;border-radius:30px;padding:11px 16px;background:#2563eb;color:#fff;font:600 14px system-ui;box-shadow:0 6px 18px #0005}
#st-v1-overlay{position:fixed;inset:0;z-index:10050;background:#0b1220;color:#e5e7eb;font-family:system-ui,sans-serif;overflow:auto}
#st-v1-overlay *{box-sizing:border-box}
.st-v1-head{position:sticky;top:0;background:#111c30;padding:16px;display:flex;justify-content:space-between;align-items:center;z-index:1}
.st-v1-head button{border:1px solid #64748b;background:transparent;color:white;border-radius:8px;padding:8px}
.st-v1-content{max-width:960px;margin:auto;padding:20px 16px}
.st-v1-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;margin-top:16px}
.st-v1-card{background:#17243a;border:1px solid #30415d;border-radius:14px;padding:18px;min-height:95px}
.st-v1-card small{display:block;color:#a5b4ce;margin-top:8px}
.st-v1-note{padding:12px;background:#2a2844;border-radius:9px;color:#e9d5ff;margin-top:16px}
.st-v1-pills{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}
.st-v1-pill{border:1px solid #556782;border-radius:16px;padding:5px 10px;color:#cbd5e1}
`;
  document.head.appendChild(css);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function openWorkspace() {
    if (document.getElementById('st-v1-overlay')) return;
    const root = document.createElement('div');
    root.id = 'st-v1-overlay';
    root.innerHTML = '<div class="st-v1-head"><strong>SiteTeam · Workspace V1</strong><button type="button" id="st-v1-close">Retour</button></div><div class="st-v1-content" id="st-v1-body">Chargement…</div>';
    document.body.appendChild(root);
    root.querySelector('#st-v1-close').onclick = () => root.remove();
    const body = root.querySelector('#st-v1-body');
    try {
      const projects = (typeof DB !== 'undefined') ? await DB.all('projects') : [];
      const tasks = (typeof DB !== 'undefined') ? await DB.all('tasks') : [];
      const members = typeof Org !== 'undefined' && Org.me ? Org.me() : null;
      const active = tasks.filter(t => !['done','closed','verified','terminé'].includes(String(t.status||'').toLowerCase())).length;
      const cards = [
        ['Projets locaux', projects.length],
        ['Tâches à examiner', active],
        ['Service actuel', members?.service || 'Non défini'],
        ['Poste actuel', members?.poste || 'Non défini']
      ];
      body.innerHTML = '<h1>Tableau de bord SiteTeam</h1><p>Référence ST-001 · Vue de transition reliée aux données locales du téléphone.</p>' +
        '<div class="st-v1-grid">'+cards.map(([name,val])=>'<div class="st-v1-card"><strong>'+escapeHtml(val)+'</strong><small>'+escapeHtml(name)+'</small></div>').join('')+'</div>'+
        '<h2>Mes projets</h2><label for="st-v1-search">Rechercher un projet</label><input id="st-v1-search" placeholder="Nom du chantier…" style="width:100%;padding:12px;margin:10px 0;background:#17243a;color:white;border:1px solid #556782;border-radius:9px"><div id="st-v1-projects" class="st-v1-grid">'+(projects.length ? projects.slice(0,30).map(p=>'<div class="st-v1-card"><strong>'+escapeHtml(p.name||'Projet')+'</strong><small>'+escapeHtml(p.type||'Chantier')+'</small></div>').join('') : '<div class="st-v1-card">Aucun projet local</div>')+'</div>'+
        '<h2>Architecture à venir</h2><div class="st-v1-pills"><span class="st-v1-pill">Entreprise</span><span class="st-v1-pill">Qualité</span><span class="st-v1-pill">Travaux</span><span class="st-v1-pill">Documents</span><span class="st-v1-pill">Groupement JV</span></div>'+
        '<div class="st-v1-note">Prévisualisation intégrée : les modules SaaS, comptes partagés et permissions serveur ne sont pas encore activés. Aucune donnée existante n’est modifiée.</div>';
      const search = body.querySelector('#st-v1-search');
      const list = body.querySelector('#st-v1-projects');
      if (search && list) search.addEventListener('input', () => {
        const q = search.value.trim().toLocaleLowerCase();
        const matches = projects.filter(p => String(p.name || '').toLocaleLowerCase().includes(q)).slice(0, 30);
        list.innerHTML = matches.length
          ? matches.map(p => '<div class="st-v1-card"><strong>'+escapeHtml(p.name||'Projet')+'</strong><small>'+escapeHtml(p.type||'Chantier')+'</small></div>').join('')
          : '<div class="st-v1-card">Aucun projet correspondant</div>';
      });
    } catch(e) {
      body.textContent='Impossible de charger les données locales : '+String(e && e.message || e);
    }
  }
  function boot(){
    if(document.getElementById('st-v1-open'))return;
    const b=document.createElement('button');b.id='st-v1-open';b.type='button';b.textContent='SiteTeam V1 · ST-001';b.onclick=openWorkspace;document.body.appendChild(b);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
