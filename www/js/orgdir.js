// ================= Dashboard Directeur : Conducteurs & Parties d'ouvrage (maquette V3) =================
// Aucune donnée dupliquée : tout est dérivé des équipes/affectations (orgcrews.js) et du Suivi quantitatif (suiviq.js).
//   Avancement d'un article = réalisé cumulé / quantité de référence (SuiviQ.calc) ; une quantité n'est comptée qu'UNE fois, même si plusieurs responsables y travaillent.
//   Agrégat de plusieurs articles (unités différentes) = moyenne SIMPLE des % d'articles, mentionnée à l'écran ; les quantités d'unités différentes ne sont jamais additionnées.
//   Rendement vs objectif = rendement journalier réalisé de l'équipe sur la période (même unité) / objectif journalier de son affectation ; « — » si donnée absente.
const OrgDir = (() => {
  const fmt = (n) => n == null ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);
  const pc = (n) => n == null ? '—' : Math.round(n) + ' %';
  const mean = (a, cap) => { a = a.filter(x => x != null && Number.isFinite(x)); if (cap) a = a.map(x => Math.min(x, 100)); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  const OC = () => OrgCrews.calc;
  const todayD = () => (typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10));

  // ---- modèle pur (testé) ----
  // périmètre S, données L (load d'OrgCrews), période per → { conds[], parts[], arts{} }
  function model(p, L, S, per, plannedFn) {
    const O = OC(), tdy = todayD(), crewIds = new Set(S.crews.map(c => c.id));
    const ents = L.ents.filter(e => !e.status || e.status !== 'rejetée');
    const act = L.asg.filter(a => crewIds.has(a.crewId) && a.from <= tdy && (!a.to || a.to >= tdy));
    const zName = (z) => [z.bat, z.bloc, z.niv, z.zone].filter(Boolean).join(' · ') || 'Zone';
    const zById = Object.fromEntries(L.zones.map(z => [z.id, z]));
    // article → calc unique
    const arts = {};
    for (const a of L.arts) { const c = SuiviQ.calc(a, ents, { plannedPct: plannedFn ? plannedFn(a) : null }); arts[a.id] = { art: a, c, pct: c.pct, planned: c.planned, crews: crewsOfArt(a.id), act: actName(a) }; }
    function crewsOfArt(id) { const m = {}; for (const e of ents) if (e.artId === id && e.crewId) m[e.crewId] = Math.round(((m[e.crewId] || 0) + (+e.delta || 0)) * 1e6) / 1e6; return m; }
    function actName(a) { if (!a.planRef || typeof planData !== 'function') return null; try { const t = planData(p).tasks.find(x => x.ref === a.planRef || x.id === a.planRef); return t ? (t.name || t.nom || t.ref || a.planRef) : null; } catch (e) { return null; } }
    // conducteurs : équipes suivies, techniciens distincts, ouvriers uniques, zones actives, articles suivis, avancement, rendement
    const condM = (p.team || []).filter(m => O.condStats && (OrgCrews.gradeOf(m) === 'cond' || L.crews.some(c => (c.condIds || []).includes(m.id))));
    const conds = condM.map(m => {
      const st = O.condStats(m, S.crews, L.mems, L.hc, per.from, per.to), ids = new Set(st.crews.map(c => c.id));
      const aset = new Set(); L.asg.filter(a => ids.has(a.crewId) && a.artId).forEach(a => aset.add(a.artId)); ents.filter(e => ids.has(e.crewId)).forEach(e => aset.add(e.artId));
      const A = [...aset].map(i => arts[i]).filter(Boolean), zs = new Set(act.filter(a => ids.has(a.crewId)).map(a => O.spatialLabel(a.spatial)).filter(x => x !== '—'));
      const rs = []; for (const a of act) { if (!ids.has(a.crewId) || !(a.obj > 0) || !a.unit) continue; const crew = L.crews.find(c => c.id === a.crewId), y = O.yields(crew, L.mems, ents, L.arts, per.from, per.to, L.hc, a.artId || undefined), v = y.byUnit[a.unit]; rs.push(v && v.perDay != null ? v.perDay / a.obj * 100 : null); }
      return { m, crews: st.crews, nCrews: st.nCrews, nTechs: st.nTechs, nWorkers: st.nWorkers, nZones: zs.size, arts: A, av: mean(A.map(x => x.pct), 1), prev: mean(A.map(x => x.planned)), rend: mean(rs) };
    });
    // parties d'ouvrage = zones groupées par bâtiment/ouvrage (à défaut « Sans localisation »)
    const P = {};
    for (const A of Object.values(arts)) for (const zr of (A.art.zones || [])) { const z = zById[zr.zid]; if (!z) continue; const key = z.bat || 'Sans localisation'; const q = P[key] = P[key] || { name: key, lines: {}, zones: new Set() };
      q.zones.add(zr.zid); const l = q.lines[A.art.id] = q.lines[A.art.id] || { A, ref: 0, done: 0, zones: [], crews: {} }; const d = A.c.byZone[zr.zid] || 0; l.ref += +zr.qty || 0; l.done += d; l.zones.push({ id: zr.zid, name: zName(z), ref: +zr.qty || 0, done: d }); for (const e of ents) if (e.artId === A.art.id && e.zid === zr.zid && e.crewId) l.crews[e.crewId] = Math.round(((l.crews[e.crewId] || 0) + (+e.delta || 0)) * 1e6) / 1e6; }
    const parts = Object.values(P).map(q => { const lines = Object.values(q.lines).map(l => ({ ...l, ref: Math.round(l.ref * 1e6) / 1e6, done: Math.round(l.done * 1e6) / 1e6, pct: l.ref > 0 ? l.done / l.ref * 100 : null }));
      return { name: q.name, nZones: q.zones.size, lines, av: mean(lines.map(l => l.pct), 1), prev: mean(lines.map(l => l.A.planned)) }; }).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
    return { conds, parts, arts, act };
  }

  // ---- vue ----
  const bar = (v, blue) => `<div class="dr-bar${blue ? ' blue' : ''}"><i style="width:${v == null ? 0 : Math.max(0, Math.min(100, v))}%"></i></div>`;
  const tile = (l, v) => `<div class="dr-m"><span>${l}</span><strong>${v}</strong></div>`;
  const perf = (av, rend, prev) => `<div class="dr-perf"><div class="dr-pr"><span>Avancement réalisé</span><b>${pc(av)}</b></div>${bar(av)}${prev != null ? `<div class="dr-pr"><span>Prévisionnel à date</span><b>${pc(prev)}</b></div>${bar(prev, 1)}` : ''}<div class="dr-pr"><span>Rendement vs objectif de période</span><b>${pc(rend)}</b></div>${bar(rend)}</div>`;
  const tabs = (t) => `<div class="dr-intro"><small>Dashboard Directeur</small><div class="dr-nav"><button class="${t === 'cond' ? 'on' : ''}" data-tab="cond">Conducteurs</button><button class="${t === 'parts' ? 'on' : ''}" data-tab="parts">Parties d'ouvrage</button><button class="${t === 'crews' ? 'on' : ''}" data-tab="crews">Équipes</button></div></div>`;
  const crumb = (items) => `<nav class="dr-crumb">${items.map((x, i) => x.go != null ? `<a data-go="${x.go}">${esc(x.t)}</a>` : `<span>${esc(x.t)}</span>`).join(' → ')}</nav>`;

  async function render(p, canE, root, ctx) {
    const L = await OrgCrews.load(p), S = OrgCrews.calc.scope(p, L.crews, L.mems), per = OrgCrews.period();
    const st = App.dr = App.dr || { tab: 'cond', v: null, back: [] };
    const M = model(p, L, S, per, (a) => SuiviQ.plannedPct(p, a));
    const go = (v) => { st.back.push(st.v); st.v = v; draw(); };
    const per_ = `${per.from} → ${per.to}`;
    function draw() {
      let h = tabs(st.tab), v = st.v;
      if (st.tab === 'cond' && !v) h += `<div class="dr-wrap"><h2>Conducteurs</h2><p class="dr-s">${M.conds.length} conducteur(s) · période ${per_}</p>${M.conds.map(c => `<button class="dr-card" data-c="${c.m.id}"><div class="dr-ch">${OrgCrews.helmet(c.m, 44)}<div><b>${esc(c.m.name || '')}</b><small>${esc(c.m.role || 'Conducteur')}${(c.m.trades || []).length ? ' · ' + esc(c.m.trades.join(' + ')) : ' · généraliste'}</small></div></div><div class="dr-ms">${tile('Techniciens', c.nTechs)}${tile('Équipes', c.nCrews)}${tile('Ouvriers', c.nWorkers)}${tile('Zones', c.nZones)}</div>${perf(c.av, c.rend, c.prev)}</button>`).join('') || '<p class="dr-s">Aucun conducteur.</p>'}<p class="dr-n">Avancement = moyenne simple des % des articles suivis (unités différentes jamais additionnées). Rendement = rendement journalier réalisé ÷ objectif de l'affectation, même unité.</p></div>`;
      else if (st.tab === 'cond' && v.t === 'c') { const c = M.conds.find(x => x.m.id === v.id); if (!c) { st.v = null; return draw(); }
        const techs = [...new Set(c.crews.flatMap(x => x.techIds || []))].map(i => (p.team || []).find(m => m.id === i)).filter(Boolean), pp = [...new Set(M.parts.filter(q => q.lines.some(l => c.arts.includes(l.A))).map(q => q.name))];
        h += `<div class="dr-wrap">${crumb([{ t: 'Conducteurs', go: 'root' }, { t: c.m.name }])}<div class="dr-card"><div class="dr-ch">${OrgCrews.helmet(c.m, 52)}<div><b>${esc(c.m.name || '')}</b><small>${esc(c.m.role || 'Conducteur')}${(c.m.trades || []).length ? ' · ' + esc(c.m.trades.join(' + ')) : ' · généraliste'}</small></div></div><div class="dr-ms">${tile('Techniciens', c.nTechs)}${tile('Équipes', c.nCrews)}${tile('Ouvriers', c.nWorkers)}${tile('Zones', c.nZones)}</div>${perf(c.av, c.rend, c.prev)}<div class="dr-fb"><button class="btn small" data-fiche="${c.m.id}">Fiche complète</button></div></div>
          <h3>Techniciens</h3>${techs.map(t => `<button class="dr-it" data-fiche="${t.id}">${OrgCrews.helmet(t, 30)}<span><b>${esc(t.name)}</b><small>${esc(t.role || 'Technicien')}</small></span><i>›</i></button>`).join('') || '<p class="dr-s">—</p>'}
          <h3>Équipes</h3>${c.crews.map(x => `<button class="dr-it" data-crew="${x.id}"><span><b>${esc(x.name)}</b><small>${esc(x.trade || '—')}</small></span><i>›</i></button>`).join('') || '<p class="dr-s">—</p>'}
          <h3>Parties d'ouvrage suivies</h3>${pp.map(n => `<button class="dr-it" data-part="${esc(n)}"><span><b>${esc(n)}</b></span><i>›</i></button>`).join('') || '<p class="dr-s">—</p>'}</div>`; }
      else if (st.tab === 'parts' && !v) h += `<div class="dr-wrap"><h2>Parties d'ouvrage</h2><p class="dr-s">${M.parts.length} partie(s) · avancement réalisé vs prévu</p>${M.parts.map(q => { const g = q.av != null && q.prev != null ? q.av - q.prev : null; return `<button class="dr-card" data-part="${esc(q.name)}"><div class="dr-ch"><div><b>${esc(q.name)}</b><small>${q.lines.length} article(s) · ${q.nZones} zone(s)</small></div>${g != null ? `<span class="dr-tag">${g >= 0 ? '+' : ''}${Math.round(g)} pts</span>` : ''}</div>${perf(q.av, null, q.prev).replace(/<div class="dr-pr"><span>Rendement[^]*$/, '</div>')}</button>`; }).join('') || '<p class="dr-s">Aucune partie : liez des zones aux articles dans le Suivi quantitatif.</p>'}</div>`;
      else if (st.tab === 'parts' && v.t === 'p') { const q = M.parts.find(x => x.name === v.id); if (!q) { st.v = null; return draw(); }
        const grp = {}; q.lines.forEach(l => (grp[l.A.act || 'Sans activité liée'] = grp[l.A.act || 'Sans activité liée'] || []).push(l));
        h += `<div class="dr-wrap">${crumb([{ t: p.name || 'Projet', go: 'root' }, { t: q.name }])}<div class="dr-card"><b>Avancement physique</b>${perf(q.av, null, q.prev).replace(/<div class="dr-pr"><span>Rendement[^]*$/, '</div>')}<p class="dr-n">Moyenne simple des articles de la partie (unités différentes non additionnées).</p></div>
          ${Object.entries(grp).map(([g, ls]) => `<h3>${esc(g)}</h3>${ls.map(l => `<button class="dr-it col" data-art="${l.A.art.id}" data-pt="${esc(q.name)}"><span class="dr-row"><b>${esc(l.A.art.ref)} · ${esc(l.A.art.nom)}</b><em>${pc(l.pct)}</em></span>${bar(l.pct)}<small>${fmt(l.done)} / ${fmt(l.ref)} ${esc(l.A.art.unit)}${l.pct > 100 ? ' · dépassement' : ''}</small></button>`).join('')}`).join('')}</div>`; }
      else if (st.tab === 'parts' && v.t === 'a') { const A = M.arts[v.id], q = M.parts.find(x => x.name === v.pt), l = q && q.lines.find(x => x.A === A); if (!A || !l) { st.v = null; return draw(); }
        const u = esc(A.art.unit), ys = Object.entries(l.crews).map(([cid, qty]) => { const cr = L.crews.find(x => x.id === cid); return { cr, qty }; }), objs = M.act.filter(a => a.artId === A.art.id && a.obj > 0 && a.unit === A.art.unit), rd = mean(objs.map(a => { const cr = L.crews.find(x => x.id === a.crewId), y = cr && OC().yields(cr, L.mems, L.ents, L.arts, per.from, per.to, L.hc, A.art.id), pdv = y && y.byUnit[a.unit]; return pdv && pdv.perDay != null ? pdv.perDay / a.obj * 100 : null; }));
        h += `<div class="dr-wrap">${crumb([{ t: p.name || 'Projet', go: 'root' }, { t: q.name, go: 'part' }, ...(A.act ? [{ t: A.act, go: 'part' }] : []), { t: A.art.ref + ' · ' + A.art.nom }])}<div class="dr-card"><b>Avancement physique</b><div class="dr-pr"><span>Réalisé / référence</span><b>${pc(l.pct)}</b></div>${bar(l.pct)}<div class="dr-ms">${tile('Quantité totale', fmt(l.ref) + ' ' + u)}${tile('Réalisé', fmt(l.done) + ' ' + u)}${tile('Restant', fmt(Math.max(0, l.ref - l.done)) + ' ' + u)}${tile('Rendement / objectif', pc(rd))}</div>
          ${A.planned != null ? `<h3>Prévisionnel vs Réalisé</h3><div class="dr-pr"><span>Prévu à date</span><b>${pc(A.planned)}</b></div>${bar(A.planned, 1)}<div class="dr-pr"><span>Réalisé</span><b>${pc(A.pct)}</b></div>${bar(A.pct)}` : '<p class="dr-n">Prévu à date indisponible (article non lié à une activité du Planning).</p>'}</div>
          <h3>Par équipe</h3>${ys.map(y => `<div class="dr-it"><span><b>${esc(y.cr ? y.cr.name : 'Équipe supprimée')}</b><small>${esc(y.cr ? (L.crews.length && y.cr.condIds && y.cr.condIds.length ? y.cr.condIds.map(i => ((p.team || []).find(m => m.id === i) || {}).name).filter(Boolean).join(', ') : '') : '')}</small></span><em>${fmt(y.qty)} ${u}</em></div>`).join('') || '<p class="dr-s">Aucune saisie rattachée à une équipe.</p>'}
          <h3>Par zone</h3>${l.zones.map(z => `<div class="dr-it"><span><b>${esc(z.name)}</b></span><em>${fmt(z.done)} / ${fmt(z.ref)} ${u}</em></div>`).join('')}
          <div class="dr-fb"><button class="btn small" data-sq="${A.art.id}">Ouvrir dans Suivi quantitatif</button></div><p class="dr-n">Source : Suivi quantitatif · période ${per_} · une quantité n'est comptée qu'une fois même avec plusieurs responsables.</p></div>`; }
      else if (st.tab === 'parts' || st.tab === 'cond') { st.v = null; return draw(); }
      root.innerHTML = `<div class="dr">${h}</div>`; wire();
    }
    function wire() {
      $$('[data-tab]', root).forEach(b => b.onclick = () => { st.tab = b.dataset.tab; st.v = null; st.back = []; if (st.tab === 'crews') ctx.crews(); else draw(); });
      $$('[data-c]', root).forEach(b => b.onclick = () => go({ t: 'c', id: b.dataset.c }));
      $$('[data-part]', root).forEach(b => b.onclick = () => { st.tab = 'parts'; st.back.push(st.v); st.v = { t: 'p', id: b.dataset.part }; draw(); });
      $$('[data-art]', root).forEach(b => b.onclick = () => go({ t: 'a', id: b.dataset.art, pt: b.dataset.pt }));
      $$('[data-go]', root).forEach(a => a.onclick = () => { if (a.dataset.go === 'root') { st.v = null; } else st.v = { t: 'p', id: st.v.pt || st.v.id }; draw(); });
      $$('[data-crew]', root).forEach(b => b.onclick = () => OrgCrews.crewSheet(p, b.dataset.crew, canE));
      $$('[data-fiche]', root).forEach(b => b.onclick = () => { const m = (p.team || []).find(x => x.id === b.dataset.fiche); if (m) orgFiche(p, m, orgEdit('org') && orgCanAdmin(), () => DB.put('projects', p), () => {}); });
      $$('[data-sq]', root).forEach(b => b.onclick = () => { App.sq = { ...(App.sq || {}), sel: b.dataset.sq }; App.section = 'suiviq'; if (typeof renderSection === 'function') renderSection(); });
    }
    draw();
  }
  return { render, model, tabs };
})();
