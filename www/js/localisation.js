// ================= Localisation : un seul tableau (tout le projet) des locaux, liés à un tout petit pin « Localiser » sur le plan =================
// Données : projet.locs = [{ id, name, niv, planId, x, y }]. Le pin n'apparaît qu'à la recherche (ouverture depuis le tableau) ou avec l'outil « Localiser ».
const Localisation = (() => {
  const locs = (p) => (p.locs = p.locs || []);
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  async function nivOfPlan(p, plan) { try { const fo = await DB.get('folders', plan.folderId); return (fo && typeof nivOfFolder === 'function' && nivOfFolder(fo.name)) || (fo && fo.name) || ''; } catch (e) { return ''; } }
  // ajoute un local (depuis le plan ou le tableau) — retourne l'objet
  async function add(p, o) { const l = { id: DB.uid(), name: String(o.name || '').slice(0, 60), niv: o.niv || '', planId: o.planId || null, x: o.x ?? null, y: o.y ?? null }; locs(p).push(l); await DB.put('projects', p); return l; }
  async function place(p, l, planId, x, y) { const pl = await DB.get('plans', planId); l.planId = planId; l.x = x; l.y = y; if (pl) l.niv = await nivOfPlan(p, pl) || l.niv; await DB.put('projects', p); }
  async function locate(p, l, back) {
    const pl = l.planId && await DB.get('plans', l.planId); if (!pl || l.x == null) return toast('Ce local n\'est pas encore placé sur un plan');
    openPlanViewer(pl, { ...(typeof planCtx === 'function' ? planCtx(back || (() => {})) : {}), focus: { x: l.x, y: l.y } });
  }
  async function pickPlan(p) {
    const plans = (await DB.byProject('plans', p.id)).filter(x => !x.supersededBy);
    const rows = []; for (const x of plans.slice(0, 60)) rows.push({ label: x.name, value: x.id });
    return menu('Sur quel plan placer le local ?', rows);
  }
  async function render(root) {
    const p = App.project; let q = '';
    const draw = async () => {
      const L = locs(p).filter(l => !q || norm(`${l.name} ${l.niv}`).includes(norm(q))).sort((a, b) => (a.niv || '').localeCompare(b.niv || '', 'fr', { numeric: true }) || a.name.localeCompare(b.name, 'fr', { numeric: true }));
      const plans = {}; for (const x of await DB.byProject('plans', p.id)) plans[x.id] = x;
      root.innerHTML = `<div class="lcz"><div class="pagehead"><h2>Localisation</h2><p>${esc(p.name)} · ${locs(p).length} local(aux)</p></div>
        <div class="lcz-bar"><input class="lcz-q" type="search" placeholder="Chercher un local, un niveau…" value="${esc(q)}"><button class="btn sm" data-a="add">＋ Local</button></div>
        ${L.length ? `<table class="lcz-t"><thead><tr><th>Local</th><th>Niveau</th><th>Plan</th><th></th></tr></thead><tbody>${L.map(l => `<tr data-id="${l.id}"><td><b>${esc(l.name)}</b></td><td>${esc(l.niv || '—')}</td><td>${l.planId && plans[l.planId] ? esc(plans[l.planId].name) : '<span class="muted">non placé</span>'}</td><td>${l.x != null ? `<button class="lcz-go" data-go="${l.id}" title="Localiser sur le plan">📍</button>` : `<button class="lcz-go" data-pl="${l.id}" title="Placer sur un plan">＋📍</button>`}</td></tr>`).join('')}</tbody></table>`
          : '<div class="fn-empty" style="padding:20px">Aucun local. Ajoutez-en (＋ Local) ou utilisez l\'outil « Localiser » sur un plan pour placer un tout petit pin.</div>'}</div>`;
      const qi = root.querySelector('.lcz-q'); qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; draw().then(() => { const n = root.querySelector('.lcz-q'); n.focus(); n.setSelectionRange(pos, pos); }); };
      root.querySelector('[data-a=add]').onclick = async () => { const r = await formSheet('Nouveau local', [{ name: 'name', label: 'Nom du local', placeholder: 'Ex : Local technique 03' }, { name: 'niv', label: 'Niveau', placeholder: 'Ex : R+1' }], { okLabel: 'Ajouter' }); if (r && r.name) { await add(p, r); draw(); } };
      root.querySelectorAll('[data-go]').forEach(b => b.onclick = (e) => { e.stopPropagation(); locate(p, locs(p).find(l => l.id === b.dataset.go), () => draw()); });
      root.querySelectorAll('[data-pl]').forEach(b => b.onclick = async (e) => { e.stopPropagation(); const l = locs(p).find(z => z.id === b.dataset.pl), pid = await pickPlan(p); if (!pid) return; const pl = await DB.get('plans', pid); toast('Touchez le plan pour placer « ' + l.name + ' »'); openPlanViewer(pl, { ...(typeof planCtx === 'function' ? planCtx(() => draw()) : {}), locPlace: l.id, startTool: 'loc' }); });
      root.querySelectorAll('tbody tr').forEach(tr => tr.oncontextmenu = async (e) => { e.preventDefault(); const l = locs(p).find(z => z.id === tr.dataset.id); const v = await menu(l.name, [{ label: 'Renommer', value: 'ren' }, { label: 'Supprimer', value: 'del' }]); if (v === 'ren') { const r = await formSheet('Renommer', [{ name: 'n', label: 'Nom', value: l.name }]); if (r && r.n) { l.name = r.n; await DB.put('projects', p); draw(); } } if (v === 'del' && await confirmBox('Supprimer « ' + l.name + ' » ?')) { p.locs = locs(p).filter(z => z !== l); await DB.put('projects', p); draw(); } });
    };
    await draw();
  }
  return { render, add, place, locate, locs };
})();
