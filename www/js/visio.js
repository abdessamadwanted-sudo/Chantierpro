// ================= Réunion en ligne : planifier une visio par service / intervenant, lien d'invitation, plans joints =================
// Données : projet.visios = [{ id, title, at (YYYY-MM-DDTHH:mm), aud:{ k, l }, room, plans:[planId], agenda, by }]
// La salle est une salle Jitsi (meet.jit.si, sans compte) au nom aléatoire non devinable : partage d'écran, tableau blanc, chat et documents y sont intégrés.
const Visio = (() => {
  const list = (p) => (p.visios = p.visios || []);
  const rid = () => { const a = new Uint8Array(8); (window.crypto || { getRandomValues: (x) => x.map(() => Math.random() * 256) }).getRandomValues(a); return [...a].map(b => (b % 36).toString(36)).join(''); };
  const slug = (s) => String(s || 'projet').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '').slice(0, 12) || 'Projet';
  const roomUrl = (v) => `https://meet.jit.si/SiteTeam-${v.room}#config.prejoinPageEnabled=false&config.disableDeepLinking=false`;
  const when = (v) => { if (!v.at) return 'Maintenant'; const d = new Date(v.at); return isNaN(d) ? v.at : d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  const audOpts = () => [{ label: 'Tout le projet', value: 'prj|Tout le projet' },
    ...(typeof TM_SERVICES !== 'undefined' ? TM_SERVICES.filter(s => s.k !== 'externe').map(s => ({ label: 'Service ' + s.l, value: 'svc|' + s.l })) : []),
    ...(typeof IV_ROLES !== 'undefined' ? IV_ROLES.map(r => ({ label: r[2] + ' ' + r[1], value: 'iv|' + r[1] })) : [])];
  async function invite(v) { const p = App.project; const pl = []; for (const id of v.plans || []) { const x = await DB.get('plans', id); if (x) pl.push('• ' + x.name); }
    shareWhatsApp(`📹 Réunion ${p.name}\n${v.title}\n🗓 ${when(v)}\n👥 ${v.aud.l}\n${v.agenda ? '📝 ' + v.agenda + '\n' : ''}${pl.length ? '📐 Plans :\n' + pl.join('\n') + '\n' : ''}\n🔗 ${roomUrl(v).split('#')[0]}`); }
  function join(v) { LinkViewer.openLink(roomUrl(v), { external: true }); }
  async function pickPlans(cur) {
    const plans = (await DB.byProject('plans', App.project.id)).filter(x => !x.supersededBy), out = new Set(cur || []);
    for (;;) { const v = await menu(`Plans joints (${out.size})`, [{ label: '✔ Terminer', value: '__ok' }, ...plans.slice(0, 40).map(x => ({ label: (out.has(x.id) ? '☑ ' : '☐ ') + x.name, value: x.id }))]);
      if (!v || v === '__ok') break; out.has(v) ? out.delete(v) : out.add(v); }
    return [...out];
  }
  async function edit(p, v0, root) {
    const v = v0 || { id: DB.uid(), title: '', at: '', aud: { k: 'prj', l: 'Tout le projet' }, room: slug(p.name) + rid(), plans: [], agenda: '', by: (App.user && App.user.email) || '' };
    const r = await formSheet(v0 ? 'Modifier la réunion' : 'Planifier une réunion', [
      { name: 'title', label: 'Objet', placeholder: 'Ex : Point d\'avancement GO', value: v.title },
      { name: 'date', label: 'Date', type: 'date', value: (v.at || '').slice(0, 10) }, { name: 'time', label: 'Heure', type: 'time', value: (v.at || '').slice(11, 16) },
      { name: 'agenda', label: 'Ordre du jour', type: 'textarea', value: v.agenda }], { okLabel: 'Suivant' });
    if (!r || !r.title) return;
    const a = await menu('Qui est invité ?', audOpts()); if (!a) return;
    const [k, l] = a.split('|'); v.title = r.title; v.agenda = r.agenda || ''; v.at = r.date ? r.date + 'T' + (r.time || '09:00') : ''; v.aud = { k, l };
    v.plans = await pickPlans(v.plans);
    if (!v0) list(p).push(v); await DB.put('projects', p); render(root);
  }
  async function render(root) {
    const p = App.project, now = Date.now(), L = list(p).slice().sort((a, b) => (a.at || '9').localeCompare(b.at || '9'));
    const up = L.filter(v => !v.at || new Date(v.at).getTime() > now - 3 * 36e5), past = L.filter(v => !up.includes(v)).reverse();
    const card = (v) => `<div class="vz-c" data-id="${v.id}"><div class="vz-t"><b>${esc(v.title)}</b><small>${esc(when(v))}</small></div>
      <div class="vz-m"><span class="vz-a">👥 ${esc(v.aud.l)}</span>${(v.plans || []).length ? `<span class="vz-a">📐 ${v.plans.length} plan(s)</span>` : ''}</div>${v.agenda ? `<div class="vz-g">${esc(v.agenda)}</div>` : ''}
      <div class="vz-b"><button class="btn sm primary" data-j="${v.id}">📹 Rejoindre</button><button class="btn sm" data-i="${v.id}">Inviter</button><button class="btn sm" data-p="${v.id}">Plans</button><button class="btn sm" data-x="${v.id}">⋯</button></div></div>`;
    root.innerHTML = `<div class="vz"><div class="pagehead"><h2>Réunion en ligne</h2><p>${esc(p.name)} · visio par service ou intervenant</p></div>
      <div class="vz-bar"><button class="btn primary" data-a="new">＋ Planifier</button><button class="btn" data-a="now">⚡ Réunion immédiate</button></div>
      <div class="vz-tools"><span>🖥 Partage d'écran</span><span>🧑‍🏫 Tableau blanc</span><span>💬 Chat</span><span>📐 Plans / PDF joints</span></div>
      ${up.length ? `<h3 class="vz-h">À venir</h3>${up.map(card).join('')}` : '<div class="fn-empty" style="padding:18px">Aucune réunion planifiée.</div>'}
      ${past.length ? `<h3 class="vz-h">Passées</h3>${past.slice(0, 15).map(card).join('')}` : ''}</div>`;
    const get = (id) => list(p).find(v => v.id === id);
    root.querySelector('[data-a=new]').onclick = () => edit(p, null, root);
    root.querySelector('[data-a=now]').onclick = async () => { const a = await menu('Réunion immédiate — qui ?', audOpts()); if (!a) return; const [k, l] = a.split('|'); const v = { id: DB.uid(), title: 'Réunion immédiate', at: '', aud: { k, l }, room: slug(p.name) + rid(), plans: [], agenda: '' }; list(p).push(v); await DB.put('projects', p); await invite(v); join(v); render(root); };
    root.querySelectorAll('[data-j]').forEach(b => b.onclick = () => join(get(b.dataset.j)));
    root.querySelectorAll('[data-i]').forEach(b => b.onclick = () => invite(get(b.dataset.i)));
    root.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => { const v = get(b.dataset.p); if (!(v.plans || []).length) return toast('Aucun plan joint — ⋯ › Modifier'); const rows = []; for (const id of v.plans) { const x = await DB.get('plans', id); if (x) rows.push({ label: x.name, value: id }); } const id = await menu('Plans de la réunion', rows); if (id) { const x = await DB.get('plans', id); openPlanViewer(x, { ...(typeof planCtx === 'function' ? planCtx(() => render(root)) : {}) }); } });
    root.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => { const v = get(b.dataset.x); const a = await menu(v.title, [{ label: 'Modifier', value: 'e' }, { label: 'Copier le lien', value: 'c' }, { label: 'Supprimer', value: 'd' }]);
      if (a === 'e') edit(p, v, root); if (a === 'c') { try { await navigator.clipboard.writeText(roomUrl(v).split('#')[0]); toast('Lien copié ✓'); } catch (e) { toast(roomUrl(v).split('#')[0]); } }
      if (a === 'd' && await confirmBox('Supprimer cette réunion ?')) { p.visios = list(p).filter(z => z !== v); await DB.put('projects', p); render(root); } });
  }
  return { render, roomUrl, list, edit };
})();
