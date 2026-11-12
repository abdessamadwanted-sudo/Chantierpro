// ================= Mon espace : chacun voit son rôle, ses missions, ce dont il est responsable et son accès (v1.0.2xx) =================
// S'appuie sur l'organigramme du projet (p.team : poste, branche, missions). Qui suis-je ? = le membre choisi une fois sur ce téléphone
// (gardé localement), ou « moi » pour le titulaire / l'administrateur du projet.
(function () {
  const keyMe = (p) => 'og.me.' + p.id;
  const getMap = (p) => { try { return localStorage.getItem(keyMe(p)) || ''; } catch (e) { return ''; } };
  const setMap = (p, id) => { try { id ? localStorage.setItem(keyMe(p), id) : localStorage.removeItem(keyMe(p)); } catch (e) {} };
  const nomUser = () => { try { return localStorage.getItem('userName') || ''; } catch (e) { return ''; } };
  const uid = () => { try { return (typeof Team !== 'undefined' && Team.uid && Team.uid()) || ''; } catch (e) { return ''; } };
  const isAdm = () => { try { return !(typeof Team !== 'undefined' && Team.ready && Team.ready()) || Team.isAdmin(); } catch (e) { return true; } };
  // membre de l'organigramme qui me correspond : choix local > « moi » (titulaire/admin seulement)
  function meOf(p) {
    const L = p.team || [], id = getMap(p), pick = L.find(x => x.id === id);
    return pick || (isAdm() ? L.find(x => x.me) : null) || null;
  }
  const todayS = () => new Date().toISOString().slice(0, 10);
  const ST = () => (typeof MISSION_ST !== 'undefined' ? MISSION_ST : { todo: ['À faire', '#64748b'], doing: ['En cours', '#3b82f6'], done: ['Terminée', '#22c55e'] });
  const NEXT = { todo: 'doing', doing: 'done', done: 'todo' };
  const retard = (x) => x.statut !== 'done' && x.echeance && x.echeance < todayS();
  // missions triées : en retard, en cours, à faire, terminées
  const ordre = (a, b) => ({ doing: 1, todo: 2, done: 3 }[a.statut || 'todo'] - { doing: 1, todo: 2, done: 3 }[b.statut || 'todo']) || String(a.echeance || '9').localeCompare(String(b.echeance || '9'));
  const mesMissions = (m) => [...(m.missions || [])].sort((a, b) => (retard(b) - retard(a)) || ordre(a, b));

  async function render(root) {
    const p = App.project, m = meOf(p), W = (typeof esc === 'function');
    if (!m) {
      root.innerHTML = `<div class="pagehead"><h2>Mon espace</h2><p>${esc(p.name || '')}</p></div>
        <div class="me-ask"><b>Qui êtes-vous dans l'organigramme ?</b><small>Choisissez votre nom une seule fois : vos missions et vos responsabilités s'affichent ensuite ici.</small>
        ${(p.team || []).map(x => `<button class="me-pick" data-id="${x.id}"><i>${esc((x.name || '?')[0].toUpperCase())}</i><span class="grow"><b>${esc(x.name || '')}</b><small>${esc((typeof memPoste === 'function' && memPoste(x) ? memPoste(x).n : x.role) || '')}</small></span></button>`).join('') || '<p class="muted">L\'organigramme est vide : demandez à l\'administrateur de vous ajouter.</p>'}</div>`;
      $$('[data-id]', root).forEach(b => b.onclick = () => { setMap(p, b.dataset.id); render(root); });
      return;
    }
    const P = typeof memPoste === 'function' ? memPoste(m) : null, L = p.team || [], par = typeof memParent === 'function' ? L.find(x => x.id === memParent(L, m)) : null;
    const sub = typeof memParent === 'function' ? L.filter(x => memParent(L, x) === m.id) : [];
    const ms = mesMissions(m), st = ST(), nOpen = ms.filter(x => x.statut !== 'done').length, nLate = ms.filter(retard).length;
    // responsable de… (parties d'ouvrage de la documentation qualité)
    const files = await DB.byProject('files', p.id).catch(() => []);
    // pièces rattachées à mes missions (et leurs zones)
    const docsM = (x) => files.filter(f => f.role === 'doc' && !f.archived && f.missionId === x.id);
    const zones = [...new Set(ms.flatMap(x => docsM(x).map(f => f.zone).filter(Boolean)))];
    const nDocs = ms.reduce((n, x) => n + docsM(x).length, 0);
    const mine = files.filter(f => f.role === 'doc' && ((uid() && f.by === uid()) || (nomUser() && f.byName === nomUser()))).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5);
    // accès : poste SiteTeam et outils (niveaux voir / modifier / valider)
    let acc = '';
    try { const tm = typeof Team !== 'undefined' && Team.ready && Team.ready() && Team.me();
      if (tm && typeof MODS !== 'undefined') { const R = tmRoleOf(tm.role), on = MODS.filter(([k]) => ((tm.perms || {})[k] || 0) > 0);
        acc = `<div class="me-acc"><b>${esc(R.l || tm.role)}</b><div class="me-chips">${on.map(([k, l]) => `<span>${esc(l.split(' (')[0])} <i>${['', 'voir', 'modifier', 'valider', 'tout'][(tm.perms || {})[k]] || ''}</i></span>`).join('')}</div></div>`; } } catch (e) {}
    root.innerHTML = `<div class="pagehead"><h2>Mon espace</h2><p>${esc(p.name || '')}</p></div>
      <div class="me-card" style="--c:${typeof memColor === 'function' ? memColor(m) : '#3b82f6'}"><div class="me-av">${esc((m.name || '?')[0].toUpperCase())}</div><div class="grow"><b>${esc(m.name || '')}</b>
        <span>${esc(P ? P.svc.e + ' ' + P.n : m.role || '')}</span><small>${m.branche ? (m.branche === 'admin' ? '🏢 Administratif' : '🏗️ Chantier') : ''}${par ? ` · N+1 : ${esc(par.name)}` : ''}${sub.length ? ` · ${sub.length} dans mon équipe` : ''}</small></div>
        <button class="iconbtn" data-a="who" title="Ce n'est pas moi">${icon('edit')}</button></div>
      <div class="me-kpi"><div><b>${nOpen}</b><small>mission(s) à traiter</small></div><div class="${nLate ? 'late' : ''}"><b>${nLate}</b><small>en retard</small></div><div><b>${nDocs}</b><small>pièce(s) sur mes missions</small></div></div>
      <h4 class="me-h">🎯 Mes missions</h4>
      <div class="me-list">${ms.map(x => `<button class="me-ms ${retard(x) ? 'late' : ''}" data-ms="${x.id}"><span class="me-st" style="background:${(st[x.statut || 'todo'] || st.todo)[1]}">${(st[x.statut || 'todo'] || st.todo)[0]}</span><span class="grow"><b>${esc(x.titre)}</b><small>${docsM(x).length ? '📎 ' + docsM(x).length + ' pièce(s)' : '⚠ aucune pièce'}${x.echeance ? ' · ' + (retard(x) ? '⚠ en retard · ' : '📅 ') + fmtDate(x.echeance) : ''}</small></span></button>`).join('') || '<p class="muted" style="margin:2px 16px">Aucune mission pour le moment.</p>'}</div>
      ${ms.length ? '<small class="me-hint">Touchez l\'état d\'une mission pour le faire avancer : à faire → en cours → terminée.</small>' : ''}
      ${zones.length ? `<h4 class="me-h">📍 Mes zones</h4><div class="me-chips" style="margin:0 16px">${zones.map(z => `<span>${esc(z)}</span>`).join('')}</div>` : ''}
      <button class="me-go" data-a="docs">📎 Ajouter / voir les pièces (Mission / zone)</button>
      ${acc ? `<h4 class="me-h">🔑 Mon accès</h4>${acc}` : ''}
      ${mine.length ? `<h4 class="me-h">📎 Mes dernières pièces</h4><div class="me-list">${mine.map(f => `<div class="me-doc"><span class="grow"><b>${esc(f.name || 'Pièce')}</b><small>${esc(f.rubrique || '')}${f.rubrique ? ' · ' : ''}${fmtDate(new Date(f.updatedAt || Date.now()).toISOString().slice(0, 10))}</small></span></div>`).join('')}</div>` : ''}
      ${sub.length ? `<h4 class="me-h">👥 Mon équipe</h4><div class="me-list">${sub.map(x => `<div class="me-doc"><span class="grow"><b>${esc(x.name || '')}</b><small>${esc((typeof memPoste === 'function' && memPoste(x) ? memPoste(x).n : x.role) || '')} · ${(x.missions || []).filter(y => y.statut !== 'done').length} mission(s) ouverte(s)</small></span></div>`).join('')}</div>` : ''}`;
    ($('[data-a=who]', root) || {}).onclick = () => { setMap(p, ''); if (!isAdm()) { render(root); return; } const mm = (p.team || []).find(x => x.me); if (mm) mm.me = false; render(root); };
    $$('[data-ms]', root).forEach(b => b.onclick = async () => {
      const x = (m.missions || []).find(y => y.id === b.dataset.ms); if (!x) return;
      x.statut = NEXT[x.statut || 'todo']; x.modifieLe = Date.now(); x.parNom = m.name;
      await DB.put('projects', p); render(root); });
    ($('[data-a=docs]', root) || {}).onclick = () => { App.docCat = null; App.docView = 'mz'; App.mzSt = { mode: 'mission', key: null }; App.section = 'docq'; renderSection(); };
  }
  window.MonEspace = { render, meOf, mesMissions, retard, setMap };
})();
