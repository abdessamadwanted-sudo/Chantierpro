// ================= Plans HSE : tous les niveaux du projet, UN seul plan par niveau (sans types ni lots) =================
//   Sert de point d'entrée du service HSE (futurs calques de sécurité). Un niveau = un dossier de premier niveau de « Plans » ;
//   le plan montré est le dernier indice de la série préférée : Architecture (ARCH), sinon Synthèse (SYN), sinon Structure (STR), sinon le plus récent.
//   Le choix est modifiable par niveau (« n plans ») et mémorisé sur ce téléphone.
const HsePlans = (() => {
  const PREF = ['ARCH', 'SYN', 'STR'];
  const rank = (n) => typeof navLevelRank === 'function' ? navLevelRank(n) : 500;
  const key = (pid, niv) => 'hsepl.' + pid + '.' + niv;
  const top = (byId, fid) => { let f = byId.get(fid); while (f && f.parentId && byId.get(f.parentId)) f = byId.get(f.parentId); return f ? f.name : ''; };
  // modèle pur : [{ niv, plan, others:[plan…] }] trié par niveau (SSL → terrasse) ; une « série » = un plan et ses indices (seul le dernier compte)
  function model(p, plans, folders, saved) {
    const byId = new Map(folders.map(f => [f.id, f])), cur = plans.filter(x => typeof isCurrentPlan === 'function' ? isCurrentPlan(x) : !x.supersededBy);
    const G = new Map();
    for (const pl of cur) { const n = top(byId, pl.folderId) || ''; if (!G.has(n)) G.set(n, []); G.get(n).push(pl); }
    const type = (pl) => String((typeof planTypeKey === 'function' ? planTypeKey(pl, p) : pl.disc) || '').toUpperCase();
    const out = [...G.entries()].map(([niv, list]) => {
      const sorted = [...list].sort((a, b) => { const ia = PREF.indexOf(type(a)), ib = PREF.indexOf(type(b)); return ((ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)) || (b.createdAt || 0) - (a.createdAt || 0); });
      const pick = sorted.find(x => (typeof planSerie === 'function' ? planSerie(x) : x.id) === (saved || {})[niv]) || sorted[0];
      return { niv, plan: pick, others: sorted.filter(x => x !== pick) };
    });
    out.sort((a, b) => (!a.niv) - (!b.niv) || rank(a.niv) - rank(b.niv) || String(a.niv).localeCompare(String(b.niv), 'fr', { numeric: true }));
    return out;
  }
  const loadSaved = (pid, rows) => { const o = {}; try { rows.forEach(n => { const v = localStorage.getItem(key(pid, n)); if (v) o[n] = v; }); } catch (e) {} return o; };

  async function render(root) {
    const p = App.project, [plans, folders] = await Promise.all([DB.byProject('plans', p.id), DB.byProject('folders', p.id)]);
    const names = [...new Set(plans.map(x => top(new Map(folders.map(f => [f.id, f])), x.folderId)))];
    const M = model(p, plans, folders, loadSaved(p.id, names));
    root.innerHTML = `<div class="pagehead"><h2>Plans</h2><p class="fi-tot"><b>${M.length}</b> niveau(x) · un plan par niveau</p></div>
      ${M.length ? `<div class="hp-list">${M.map((r, i) => `<div class="hp-c" data-i="${i}"><button class="hp-open"><span class="hp-th" data-f="${esc(r.plan.fileId || '')}">${icon('plans')}</span>
        <span class="hp-t"><b>${esc(r.niv || 'Sans niveau')}</b><small>${esc(r.plan.name || 'Plan')}${r.plan.indice ? ' · indice ' + esc(r.plan.indice) : ''}</small></span></button>
        ${r.others.length ? `<button class="hp-more" aria-label="Autres plans du niveau">${r.others.length + 1} plans ›</button>` : ''}</div>`).join('')}</div>`
      : `<div class="empty">Aucun plan dans ce projet.<br>Les plans sont ajoutés depuis la rubrique « Plans » du Chantier.</div>`}`;
    $$('.hp-th', root).forEach(t => { if (t.dataset.f && window.Thumbs) Thumbs.get(t.dataset.f).then(u => { if (u) t.innerHTML = `<img alt="" src="${u}">`; }).catch(() => {}); });
    $$('.hp-c', root).forEach(c => {
      const r = M[+c.dataset.i];
      ($('.hp-open', c) || {}).onclick = () => (typeof HseSp !== 'undefined' ? HseSp.open(r.plan, { onClose: () => render(root) }) : openPlanViewer(r.plan, planCtx(() => render(root))));
      const mo = $('.hp-more', c);
      if (mo) mo.onclick = async () => {
        const all = [r.plan, ...r.others], v = await menu(`Plan affiché pour ${r.niv || 'ce niveau'}`, all.map((x, k) => ({ label: `${x.name || 'Plan'}${x.indice ? ' · ' + x.indice : ''}${k === 0 ? '  ✓' : ''}`, icon: 'plans', value: String(k) })));
        if (v == null) return; try { localStorage.setItem(key(p.id, r.niv), typeof planSerie === 'function' ? planSerie(all[+v]) : all[+v].id); } catch (e) {} render(root);
      };
    });
  }
  return { render, model };
})();
