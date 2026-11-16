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
  let _man = null;
  async function load() { if (_man) return _man; try { _man = await (await fetch('assets/catalog.json')).json(); } catch (e) { _man = { modules: [] }; } return _man; }
  async function live() { return compute(await load(), Team.planModules()); }
  return { PACKS, compute, table, load, live };
})();
