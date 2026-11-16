// ================= Architecture Studio (Étape 2) : explorateur d'arborescence réservé au Super Admin =================
//   Catalogue statique (assets/studio.json, issu du ZIP « Architecture Studio ») : espaces, organisations, tailles, services, sous-services, postes, packs, Business.
//   Aucune donnée réelle : les branches sont des TEMPLATES / états vides ; le pack choisi ici est une SIMULATION d'affichage (aucun abonnement, aucun accès serveur modifié).
//   Seul lien réel : « PTB » = alias logique vers l'espace existant (aucun projet, id ou fichier déplacé).
const Studio = (() => {
  const ALIAS_KEY = 'st.studio.alias', ROUTE_KEY = 'st.studio.route.';
  // nœud synthétique : l'espace réel existant, rattaché à Entreprise BTP (alias logique, rien n'est déplacé)
  const LEGACY = { id: 'legacy_ptb', label: 'PTB — espace réel existant', parent: 'org0', kind: 'legacy', detail: 'Tous les projets, plans, documents et outils actuels restent ici, avec l\'interface chantier/plan habituelle.' };
  const MATRIX = { id: 'matrix_view', label: 'Matrice des fonctions par pack', parent: 'packs', kind: 'matrix', detail: 'Fonctions et niveau de mise en service par pack (valeurs réelles en vigueur, lecture seule).' };
  // branches déjà réelles dans l'application (le reste = placeholder)
  const IMPL = new Set(['root', 'personal', 'professional', 'businesshub', 'organizations', 'packs', 'org0', 'org0_size0', 'org0_size1', 'org0_size2', 'legacy_ptb', 'matrix_view', 'pack0', 'pack1', 'pack2', 'pack3']);
  const PACKS = ['Basic', 'Pro', 'Business', 'Enterprise'], SIZES = ['Petite', 'Moyenne', 'Grande'];
  // ----- modèle pur (testé) -----
  function build(list) {
    const nodes = [...(list || []).filter(n => n && n.id), LEGACY, MATRIX], byId = new Map(nodes.map(n => [n.id, n])), kids = new Map();
    for (const n of nodes) { if (n.parent && byId.has(n.parent)) { if (!kids.has(n.parent)) kids.set(n.parent, []); kids.get(n.parent).push(n); } }
    const path = (id) => { const P = []; let n = byId.get(id), guard = 0; while (n && guard++ < 30) { P.unshift(n); n = byId.get(n.parent); } return P; };
    const count = (id) => { let c = 0; const st = [...(kids.get(id) || [])]; while (st.length) { const n = st.pop(); c++; st.push(...(kids.get(n.id) || [])); } return c; };
    const find = (q, lim = 60) => { q = String(q || '').trim().toLowerCase(); return q ? nodes.filter(n => String(n.label).toLowerCase().includes(q)).slice(0, lim) : []; };
    return { nodes, byId, kids: (id) => kids.get(id) || [], path, count, find, status: (n) => n.kind === 'legacy' ? 'réel' : IMPL.has(n.id) ? 'implémenté' : 'placeholder' };
  }
  const aliasGet = () => { try { return JSON.parse(localStorage.getItem(ALIAS_KEY) || 'null'); } catch (e) { return null; } };
  const aliasSet = (v) => { try { v ? localStorage.setItem(ALIAS_KEY, JSON.stringify(v)) : localStorage.removeItem(ALIAS_KEY); } catch (e) {} };
  // espace réel PTB : choix enregistré, sinon « Sgtm », sinon l'espace courant — toujours un espace auquel l'utilisateur appartient
  function aliasResolve(ws, cur) {
    const a = aliasGet(), L = ws || []; if (a && L.some(w => w.cid === a.cid)) return L.find(w => w.cid === a.cid);
    return L.find(w => /sgtm/i.test(w.name || '')) || L.find(w => w.cid === cur) || L[0] || null;
  }
  const routeKey = () => ROUTE_KEY + ((typeof Team !== 'undefined' && Team.uid && Team.uid()) || 'anon');
  async function load() { if (load.c) return load.c; const r = await fetch('assets/studio.json'); if (!r.ok) throw new Error('catalogue introuvable'); return (load.c = await r.json()); }

  async function open(opts = {}) {
    if (typeof Team === 'undefined' || !Team.ready() || !Team.isSuper()) { toast('Réservé au propriétaire'); return null; }
    let M; try { M = build(await load()); } catch (e) { toast('Catalogue indisponible : ' + e.message); return null; }
    const S = { cur: 'root', pack: PACKS.includes(opts.pack) ? opts.pack : 'Business', size: 'Moyenne', q: '' }; let closed = false;
    const el = document.createElement('div'); el.className = 'fullpage sd-pg';
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="up">${icon('back')}</button><h1>Architecture Studio</h1><button class="iconbtn" data-a="home">${icon('home')}</button></div>
      <div class="sd-body"><div class="sd-warn">Maquette de structure — aucune donnée réelle. Le pack choisi ici est une <b>simulation</b> : il ne change ni l'abonnement ni les accès.</div>
        <div class="sd-crumb"></div><input class="sd-q" type="search" placeholder="Rechercher une branche…" aria-label="Rechercher">
        <div class="sd-sim"><label>Pack simulé <select data-s="pack">${PACKS.map(p => `<option ${p === S.pack ? 'selected' : ''}>${p}</option>`).join('')}</select></label><label>Profil <select data-s="size">${SIZES.map(p => `<option>${p}</option>`).join('')}</select></label><button class="btn ghost small" data-a="resume">↩ Dernière branche</button></div>
        <h2 class="sd-t"></h2><p class="sd-d"></p><div class="sd-chips"></div><div class="sd-list"></div><div class="sd-insp"></div></div>`;
    document.body.appendChild(el);
    const $e = (s) => el.querySelector(s);
    let unBack = pushBack(() => up());
    function rearm() { try { unBack(); } catch (e) {} unBack = pushBack(() => up()); }
    function shut() { if (closed) return; closed = true; try { unBack(); } catch (e) {} el.remove(); if (opts.onClose) opts.onClose(); }
    function up() { const n = M.byId.get(S.cur); if (S.q) { S.q = ''; $e('.sd-q').value = ''; show(S.cur); rearm(); return; } if (n && n.parent && M.byId.has(n.parent)) { show(n.parent); rearm(); } else shut(); }
    function show(id) {
      const n = M.byId.get(id); if (!n) return; S.cur = id; try { localStorage.setItem(routeKey(), id); } catch (e) {}
      const P = M.path(id), K = S.q ? M.find(S.q) : M.kids(id);
      $e('.sd-crumb').innerHTML = `<button data-n="__mes">Mes espaces</button>` + P.map(x => ` › <button data-n="${esc(x.id)}">${esc(x.label)}</button>`).join('');
      $e('.sd-t').textContent = n.label; $e('.sd-d').textContent = n.detail || 'Structure fonctionnelle proposée — aucune donnée réelle';
      const st = M.status(n); $e('.sd-chips').innerHTML = `<span class="sd-c k">${esc(n.kind)}</span><span class="sd-c s-${st.replace('é', 'e')}">${esc(st)}</span><span class="sd-c">${M.count(id)} sous-branche(s)</span>`;
      $e('.sd-list').innerHTML = K.length ? K.map(k => `<button class="sd-n" data-n="${esc(k.id)}"><span class="grow"><b>${esc(k.label)}</b><small>${esc(k.kind)} · ${esc(M.status(k))}${M.count(k.id) ? ' · ' + M.count(k.id) : ''}</small></span><i>›</i></button>`).join('')
        : `<div class="sd-empty">${S.q ? 'Aucun résultat' : 'Branche prête pour développement. Aucun projet réel créé.'}</div>`;
      const ws = Team.workspaces(), real = n.kind === 'legacy' ? aliasResolve(ws, Team.cid()) : null;
      $e('.sd-insp').innerHTML = `<h3>Inspecteur</h3><div class="sd-kv"><span>Identifiant</span><b>${esc(n.id)}</b><span>Route</span><b>${esc(P.map(x => x.label).join(' / '))}</b><span>Pack simulé</span><b>${esc(S.pack)}</b><span>Profil simulé</span><b>${esc(S.size)}</b><span>Données réelles</span><b>${n.kind === 'legacy' ? 'oui — espace existant' : 'aucune'}</b></div>`
        + (n.kind === 'legacy' ? `<div class="sd-act"><p>Espace réel : <b>${real ? esc(real.name || real.cid) : '—'}</b></p><button class="btn" data-a="real">Ouvrir l'espace réel</button><button class="btn ghost" data-a="setreal">Choisir l'espace PTB…</button></div>` : '');
      if (n.kind === 'matrix' && typeof Matrix !== 'undefined') $e('.sd-insp').innerHTML += Matrix.table(Matrix.live());
      if (n.kind === 'matrix' && typeof Catalog !== 'undefined') Catalog.live().then(r => { const i = $e('.sd-insp'); if (i) i.innerHTML += '<h4>Catalogue des modules (schéma ↔ code)</h4>' + Catalog.table(r) + '<div class="cc-p"></div>'; Catalog.previewInto(i.querySelector('.cc-p')); }).catch(() => {});
      el.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { S.q = ''; $e('.sd-q').value = ''; if (b.dataset.n === '__mes') { shut(); try { MesEspaces.open(); } catch (e) {} return; } show(b.dataset.n); rearm(); });
      ($e('[data-a=real]') || {}).onclick = () => { const w = aliasResolve(Team.workspaces(), Team.cid()); if (!w) return toast('Aucun espace'); if (w.cid === Team.cid()) { shut(); toast('Espace réel déjà ouvert'); } else { shut(); Team.switchTo(w.cid); } };
      ($e('[data-a=setreal]') || {}).onclick = async () => { const v = await menu('Quel espace est PTB ?', Team.workspaces().filter(w => !w.pending).map(w => ({ label: `${w.name || w.cid}${w.kind === 'perso' ? ' (personnel)' : ''}`, value: w.cid }))); if (v) { aliasSet({ cid: v, label: 'PTB' }); show(S.cur); } };
    }
    ($e('[data-a=up]') || {}).onclick = () => up(); ($e('[data-a=home]') || {}).onclick = () => { S.q = ''; $e('.sd-q').value = ''; show('root'); rearm(); };
    $e('.sd-q').oninput = (e) => { S.q = e.target.value; show(S.cur); };
    el.querySelectorAll('[data-s]').forEach(s => s.onchange = () => { S[s.dataset.s] = s.value; show(S.cur); });
    ($e('[data-a=resume]') || {}).onclick = () => { let id = 'root'; try { id = localStorage.getItem(routeKey()) || 'root'; } catch (e) {} show(M.byId.has(id) ? id : 'root'); rearm(); };
    let start = opts.node || 'root'; if (!M.byId.has(start)) start = 'root'; show(start);
    return { el, close: shut, state: S, show, model: M };
  }
  return { open, build, aliasResolve, aliasSet, aliasGet, IMPL };
})();
