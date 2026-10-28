// Équipe projet et historique des affectations (Business / Enterprise).
const Affectations = (() => {
  const active = () => Team.ready() && !Team.isPerso() && !Team.isCollab() && Team.isAdmin() && Team.taille() !== 'petite';
  const current = p => (p.affectations || []).filter(a => !a.fin);
  async function open(project = null) {
    if (!active()) return;
    const projects = (await DB.all('projects')).filter(p => !p.deleted && Team.canProject(p.id));
    const s = sheet('<div class="aff-body"></div>', { title: project ? 'Équipe du projet' : 'Affectations' }), box = $('.aff-body', s.el);
    let chosen = project && project.id;
    async function draw() {
      const p = projects.find(p => p.id === chosen);
      const members = Team.members(), byId = id => members.find(m => m.uid === id) || { name: 'Ancien membre' };
      box.innerHTML = `<div class="form"><label>Projet<select data-aff-project><option value="">Tous les projets</option>${projects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><p class="muted">L'équipe projet est distincte des membres de l'organisation. Les affectations terminées restent dans l'historique.</p>${(p ? [p] : projects).map(p => `<section class="tm-box"><b>${esc(p.name)}</b>${p.teamEnabled ? '' : '<p>Équipe ouverte : accès historique conservé.</p>'}${current(p).length ? current(p).map(a => `<div class="aff-row"><span><b>${esc(byId(a.uid).name || byId(a.uid).email)}</b><small>${esc(tmRoleOf(a.role).l)} · depuis le ${esc(a.debut)}</small></span>${Team.isAdmin() ? `<button class="btn ghost small" data-aff-end="${esc(p.id)}|${esc(a.id)}">Terminer / transférer</button>` : ''}</div>`).join('') : '<p class="muted">Aucune affectation nominative.</p>'}${Team.isAdmin() ? `<button class="btn small" data-aff-add="${esc(p.id)}">${p.teamEnabled ? 'Affecter / remplacer' : 'Définir l’équipe du projet'}</button>` : ''}<details><summary>Historique des affectations</summary>${(p.affectations || []).filter(a => a.fin).map(a => `<p>${esc(byId(a.uid).name || byId(a.uid).email)} · ${esc(tmRoleOf(a.role).l)} · ${esc(a.debut)} → ${esc(a.fin)}</p>`).join('') || '<p>Aucune affectation terminée.</p>'}</details></section>`).join('') || '<div class="empty">Aucun projet accessible.</div>'}</div>`;
      const sel = $('[data-aff-project]', box); sel.value = chosen || ''; sel.onchange = () => { chosen = sel.value; draw(); };
      $$('[data-aff-add]', box).forEach(b => b.onclick = () => add(projects.find(p => p.id === b.dataset.affAdd)));
      $$('[data-aff-end]', box).forEach(b => b.onclick = () => finish(...b.dataset.affEnd.split('|')));
    }
    async function save(p, list, action, who, target = null) {
      const ld = loading('Enregistrement des affectations…');
      try {
        await Team.saveAffectations(p, list, action, who, target);
        Object.assign(p, await DB.get('projects', p.id));
        if (target) Object.assign(target.p, await DB.get('projects', target.p.id));
        toast('Affectation enregistrée ✓'); await draw();
      } catch (e) { alertBox(e.message || 'Enregistrement impossible'); }
      finally { ld.close(); }
    }
    async function add(p) {
      const r = await formSheet('Affecter un membre · ' + p.name, [
        { name: 'uid', label: 'Membre', type: 'select', options: Team.members().map(m => ({ value: m.uid, label: m.name || m.email })) },
        { name: 'role', label: 'Poste sur le projet', type: 'select', options: allRoles().filter(r => !ROLE_LEGACY[r.k]).map(r => ({ value: r.k, label: r.l })) },
        { name: 'debut', label: 'Date de début', type: 'date', value: todayISO() },
        { name: 'replace', label: 'Remplacer un titulaire (facultatif)', type: 'select', options: [{ value: '', label: 'Personne' }, ...current(p).map(a => ({ value: a.id, label: (Team.members().find(m => m.uid === a.uid) || {}).name || a.uid }))] },
      ]);
      if (!r || !r.uid || !r.debut) return;
      if (r.debut > todayISO()) return toast('La date de début ne peut pas être future');
      if (current(p).some(a => a.uid === r.uid && a.role === r.role)) return toast('Cette affectation est déjà active');
      if (r.replace && (p.affectations || []).find(a => a.id === r.replace)?.debut > r.debut) return toast('Le remplacement précède l’affectation initiale');
      if (!p.teamEnabled && !await confirmBox('Définir une équipe nominative ? Les membres non affectés perdront l’accès à ce projet. Les administrateurs conservent leur accès. Les autres projets et les données passées sont conservés.', 'Définir l’équipe')) return;
      const list = (p.affectations || []).map(a => a.id === r.replace ? { ...a, fin: r.debut } : a);
      list.push({ id: DB.uid(), uid: r.uid, role: r.role, debut: r.debut, fin: null });
      await save(p, list, r.replace ? 'remplacement' : 'affectation', r.uid);
    }
    async function finish(pid, id) {
      const p = projects.find(p => p.id === pid), a = (p.affectations || []).find(a => a.id === id);
      if (!a) return;
      const r = await formSheet('Terminer / transférer', [
        { name: 'fin', label: 'Date de fin', type: 'date', value: todayISO() },
        { name: 'target', label: 'Transférer vers (facultatif)', type: 'select', options: [{ value: '', label: 'Terminer sans transfert' }, ...projects.filter(x => x.id !== pid).map(x => ({ value: x.id, label: x.name }))] },
      ]);
      if (!r || !r.fin) return;
      if (r.fin < a.debut || r.fin > todayISO()) return toast('Date de fin invalide');
      const target = projects.find(x => x.id === r.target);
      if (target && !target.teamEnabled && !await confirmBox('Le projet destinataire passera à une équipe nominative. Seules les personnes affectées et les administrateurs y auront accès.', 'Continuer')) return;
      const list = (p.affectations || []).map(x => x.id === id ? { ...x, fin: r.fin } : x);
      const to = target ? { p: target, list: [...(target.affectations || []), { id: DB.uid(), uid: a.uid, role: a.role, debut: r.fin, fin: null }] } : null;
      await save(p, list, target ? 'transfert' : 'fin_affectation', a.uid, to);
    }
    await draw();
  }
  return { active, current, open };
})();
