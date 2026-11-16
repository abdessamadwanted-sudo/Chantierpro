// ================= Catalogue de modules (PR 1 Control Center) : manifest versionné en LECTURE, comparé au code réel =================
//   Compare le « pack minimum » du schéma Control Center (zipMin, illustratif) à ce que le code autorise réellement (PLANS[pack].modules).
//   Ne change aucun droit : c'est un état des lieux. Une rubrique sans module réel rattaché est « à vérifier » (jamais présentée comme existante).
const Catalog = (() => {
  const PACKS = ['basic', 'pro', 'business', 'enterprise'], CAP = { basic: 'Basic', pro: 'Pro', business: 'Business', enterprise: 'Enterprise' };
  const has = (pm, p, k) => pm[p] === '*' || (pm[p] || []).includes(k);
  // pur (testé) : manifest + { pack: [clés de modules] | '*' } → lignes
  function compute(man, pm) {
    return ((man || {}).modules || []).map(m => {
      const mods = m.mods || [];
      const codeMin = mods.length ? (PACKS.find(p => mods.every(k => has(pm, p, k))) || null) : null;
      const zip = String(m.zipMin || '').toLowerCase();
      const status = !mods.length ? 'verifier' : codeMin ? 'existant' : 'partiel';
      const diff = status === 'existant' && zip && codeMin !== zip;
      return { id: m.id, label: m.label, icon: m.icon || '', zipMin: zip, codeMin, status, diff, children: m.children || [], mods };
    });
  }
  const LBL = { existant: 'Existant', partiel: 'Partiel', verifier: 'À vérifier' };
  const table = (rs) => `<div class="mx-w"><table class="mx"><thead><tr><th>Rubrique</th><th>Pack (schéma)</th><th>Pack (code)</th><th>État</th></tr></thead><tbody>${(rs || []).map(r => `<tr><td>${esc(r.icon + ' ' + r.label)}<br><small>${r.children.length} sous-rubriques</small></td><td>${esc(CAP[r.zipMin] || '-')}</td><td>${r.codeMin ? esc(CAP[r.codeMin]) + (r.diff ? ' ≠' : '') : '-'}</td><td>${LBL[r.status]}</td></tr>`).join('')}</tbody></table></div><p class="mx-n">« ≠ » : le code ouvre cette rubrique à un autre pack que le schéma ; à trancher avant tout changement. « À vérifier » : aucun module réel rattaché.</p>`;
  // aperçu de dashboard (pur, testé) : rubriques réellement ouvertes au pack ET accessibles au poste (niveau ≥ 1 sur au moins un module rattaché).
  // Les rubriques « à vérifier » (aucun module réel) ne sont jamais affichées comme disponibles. perms = { module: niveau 0–4 }.
  function dashboard(rows, pack, perms) {
    const ord = PACKS.indexOf(pack);
    return (rows || []).filter(r => r.status !== 'verifier' && r.codeMin && PACKS.indexOf(r.codeMin) <= ord).map(r => {
      const lv = Math.max(0, ...r.mods.map(k => (perms || {})[k] || 0));
      return lv > 0 ? { id: r.id, label: r.label, icon: r.icon, level: lv, children: r.children } : null;
    }).filter(Boolean);
  }
  const LV = ['Aucun accès', 'Voir', 'Modifier', 'Valider', 'Administrer'];
  const cards = (ds) => ds.length ? `<div class="cc-g">${ds.map(d => `<div class="cc-c"><b>${esc(d.icon + ' ' + d.label)}</b><small>${LV[d.level]}</small><span>${d.children.slice(0, 4).map(esc).join(' · ')}</span></div>`).join('')}</div>` : '<p class="mx-n">Aucune rubrique disponible pour ce poste dans ce pack.</p>';
  // bloc interactif (Studio) : pack + poste → aperçu. Données fictives : aucune donnée chantier n'est lue.
  async function previewInto(box) {
    const rows = await live(), roles = Team.roleList(); if (!box) return;
    let pk = 'business', rk = (roles.find(r => r.k === 'conducteur') || roles[0] || {}).k;
    const draw = () => { const r = roles.find(x => x.k === rk) || {}; box.innerHTML = `<h4>Aperçu dashboard par poste</h4><div class="cc-f"><select data-p>${PACKS.map(p => `<option value="${p}"${p === pk ? ' selected' : ''}>${CAP[p]}</option>`).join('')}</select><select data-r>${roles.map(x => `<option value="${esc(x.k)}"${x.k === rk ? ' selected' : ''}>${esc(x.l)}</option>`).join('')}</select></div>${cards(dashboard(rows, pk, r.perms))}<p class="mx-n">Aperçu documentaire : droits réels = règles serveur, pas ce menu.</p>`;
      box.querySelector('[data-p]').onchange = (e) => { pk = e.target.value; draw(); }; box.querySelector('[data-r]').onchange = (e) => { rk = e.target.value; draw(); }; };
    draw();
  }
  let _man = null;
  async function load() { if (_man) return _man; try { _man = await (await fetch('assets/catalog.json')).json(); } catch (e) { _man = { modules: [] }; } return _man; }
  async function live() { return compute(await load(), Team.planModules()); }
  return { PACKS, compute, table, load, live, dashboard, previewInto };
})();
