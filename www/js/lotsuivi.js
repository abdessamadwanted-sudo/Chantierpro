// ================= v1.0.35 — Lots & équipes : suivi opérationnel par lot =================
// Pour chaque lot du projet : dates (début / fin prévues), zones, avancement réel vs prévu, alertes,
// et les équipes / sous-traitants qui y travaillent : chef responsable, effectif, mission, engins,
// saisie du jour (effectif, quantité réalisée, consommation, avancement) → rendement journalier.
// Données gardées sur le projet (p.lotSuivi), synchronisées avec lui. Attachements et décomptes restent dans « Gestion & finance ».
const LS_UNITS = ['m³', 'm²', 'ml', 'kg', 't', 'u', 'ens.'];
const LS_KIND = [['int', 'Équipe interne'], ['st', 'Sous-traitant'], ['tac', 'Tâcheron']];
const LS_COLORS = ['#2164A8', '#18866B', '#B7791F', '#5B4BA8', '#C2410C', '#0E7490', '#3D5A80', '#9D174D'];

// lots du projet : ceux de l'organisation technique (assistant / catalogue), sinon les lots des plans
function lsLots(p) {
  const cat = (p.catLots || []).map(([f, l], i) => ({ id: 'c:' + f + '|' + l, name: l, fam: f, c: LS_COLORS[i % LS_COLORS.length] }));
  if (cat.length) return cat;
  return (typeof planLots === 'function' ? planLots(p) : []).map(l => ({ id: 'p:' + l.id, name: l.name, e: l.e, c: l.c }));
}
const lsData = (p, id) => { p.lotSuivi = p.lotSuivi || {}; return p.lotSuivi[id] = p.lotSuivi[id] || { eq: [] }; };
const lsDays = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
// avancement prévu (linéaire entre début et fin) et réel (saisi, ou moyenne des équipes)
// v1.0.40 : répartition par niveau — qui tient quelle partie (sous-traitant ou équipe de l'entreprise), statut, réception
const LS_ST = [['todo', 'À faire', '#64748b'], ['run', 'En cours', '#2164A8'], ['done', 'Terminé · à réceptionner', '#B7791F'], ['rec', 'Réceptionné', '#18866B'], ['blk', 'Bloqué', '#C2410C']];
const LS_NIV_DEF = ['Fondations', 'Sous-sol', 'RDC', 'R+1', 'R+2', 'R+3', 'Terrasse'];
const lsNiv = (p) => (Array.isArray(p.lsNiv) && p.lsNiv.length ? p.lsNiv : LS_NIV_DEF);
const lsSt = (k) => LS_ST.find(x => x[0] === k) || LS_ST[0];
const lsPartAv = (x) => x.st === 'rec' || x.st === 'done' ? 100 : +x.av || 0;
const lsEqC = (D, id) => { const i = (D.eq || []).findIndex(e => e.id === id); return i < 0 ? '#64748b' : LS_COLORS[i % LS_COLORS.length]; };
const lsIni = (n) => String(n || '?').replace(/^(Ste|Sté|Société|Equipe|Équipe)\s+/i, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
function lsState(D) {
  const t = todayISO(), eqs = D.eq || [];
  const last = (e) => (e.j || []).slice().sort((a, b) => (b.d || '').localeCompare(a.d || ''))[0];
  const parts = Object.entries(D.parts || {});
  const real = D.av != null && D.av !== '' ? +D.av : parts.length ? Math.round(parts.reduce((a, [, x]) => a + lsPartAv(x), 0) / parts.length) : eqs.length ? Math.round(eqs.reduce((s, e) => s + (+((last(e) || {}).av) || 0), 0) / eqs.length) : 0;
  let prev = null; if (D.deb && D.fin && D.fin > D.deb) prev = Math.max(0, Math.min(100, Math.round(100 * lsDays(D.deb, t) / lsDays(D.deb, D.fin))));
  const al = [];
  if (D.deb && t >= D.deb && !real && !eqs.some(e => (e.j || []).length)) al.push(['r', `Devait commencer le ${fmtDate(D.deb)}`]);
  if (D.deb && t < D.deb && lsDays(t, D.deb) <= 7) al.push(['y', `Démarrage dans ${lsDays(t, D.deb)} j`]);
  if (D.fin && t > D.fin && real < 100) al.push(['r', `Fin prévue dépassée (${fmtDate(D.fin)})`]);
  else if (D.fin && real < 100 && lsDays(t, D.fin) <= 7 && lsDays(t, D.fin) >= 0) al.push(['y', `Fin dans ${lsDays(t, D.fin)} j`]);
  if (prev != null && real < prev - 10) al.push(['r', `Retard : ${real}% réalisé / ${prev}% prévu`]);
  for (const e of eqs) { const l = last(e); if (l && lsDays(l.d, t) >= 3 && real < 100) al.push(['y', `${e.nom} : aucune saisie depuis ${lsDays(l.d, t)} j`]); }
  for (const [n, x] of parts) {
    if (x.st === 'done') al.push(['y', `${n} : terminé, réception à faire`]);
    if (x.st === 'blk') al.push(['r', `${n} : bloqué${x.note ? ' — ' + x.note : ''}`]);
    if (x.fin && t > x.fin && !['done', 'rec'].includes(x.st)) al.push(['r', `${n} : fin prévue dépassée (${fmtDate(x.fin)})`]);
    if (!x.eq && x.st !== 'rec') al.push(['y', `${n} : aucune équipe affectée`]);
  }
  const eff = eqs.reduce((s, e) => s + (+((last(e) || {}).eff) || +e.eff || 0), 0);
  return { real, prev, al, eff, last, parts };
}
// rendement journalier d'une saisie = quantité / effectif (par personne) ; moyenne sur les 7 dernières saisies
const lsRend = (x) => (+x.q > 0 && +x.eff > 0) ? +x.q / +x.eff : null;
function lsRendAvg(e) { const R = (e.j || []).slice().sort((a, b) => (b.d || '').localeCompare(a.d || '')).slice(0, 7).map(lsRend).filter(v => v != null); return R.length ? R.reduce((a, b) => a + b, 0) / R.length : null; }
const lsFmt = (v, d = 1) => v == null ? '—' : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('fr-FR');
const lsBar = (real, prev, c) => `<div class="ls-bar" style="--c:${c}"><i style="width:${real}%"></i>${prev != null ? `<u style="left:${prev}%" title="Prévu ${prev}%"></u>` : ''}</div>`;

async function renderLotSuivi(root) {
  const p = App.project, L = lsLots(p);
  const tba = $('#tbActions'); if (tba) tba.innerHTML = `<button class="iconbtn" data-a="lsst" title="Sous-traitants & équipes">${icon('team')}</button>`;
  const rows = L.map(l => ({ l, D: lsData(p, l.id) })).map(x => ({ ...x, S: lsState(x.D) }));
  const nAl = rows.reduce((a, x) => a + x.S.al.filter(y => y[0] === 'r').length, 0), nEq = rows.reduce((a, x) => a + (x.D.eq || []).length, 0), eff = rows.reduce((a, x) => a + x.S.eff, 0);
  const view = App.lsView || 'actifs';
  const shown = rows.filter(x => view === 'tous' || x.D.deb || (x.D.eq || []).length || x.D.av || Object.keys(x.D.parts || {}).length);
  root.innerHTML = `<div class="ls">
    <div class="ls-kpis"><div><b>${rows.filter(x => x.S.real > 0 && x.S.real < 100).length}</b><small>Lots en cours</small></div><div><b>${nEq}</b><small>Équipes / ST</small></div><div><b>${eff}</b><small>Effectif</small></div><div class="${nAl ? 'r' : ''}"><b>${nAl}</b><small>Alertes</small></div></div>
    <div class="ls-seg"><button class="${view === 'actifs' ? 'on' : ''}" data-v="actifs">Lots suivis</button><button class="${view === 'tous' ? 'on' : ''}" data-v="tous">Tous (${rows.length})</button><button class="${view === 'mx' ? 'on' : ''}" data-v="mx">Matrice</button></div>
    ${view === 'mx' ? lsMatrix(p, rows) : ''}
    ${view === 'mx' ? '' : shown.length ? shown.map(({ l, D, S }) => `<button class="ls-lot" data-lot="${esc(l.id)}" style="--c:${l.c}">
      <div class="ls-lh"><span class="ls-dot"></span><b class="grow">${esc((l.e ? l.e + ' ' : '') + l.name)}</b><em>${S.real}%</em></div>
      ${lsBar(S.real, S.prev, l.c)}
      ${Object.keys(D.parts || {}).length ? `<div class="ls-strip">${lsNiv(p).map(n => { const x = (D.parts || {})[n]; return `<i style="--s:${x ? lsSt(x.st)[2] : 'transparent'}" title="${esc(n)}"></i>`; }).join('')}</div>` : ''}
      <div class="ls-meta">${D.deb ? `<span>📅 ${fmtDate(D.deb)} → ${D.fin ? fmtDate(D.fin) : '?'}</span>` : '<span class="mut">Dates non définies</span>'}${(D.eq || []).length ? `<span>👷 ${(D.eq || []).length} équipe(s) · ${S.eff} pers.</span>` : ''}${(D.zones || []).length ? `<span>📍 ${esc(D.zones.slice(0, 3).join(', '))}${D.zones.length > 3 ? '…' : ''}</span>` : ''}</div>
      ${S.al.length ? `<div class="ls-al">${S.al.slice(0, 2).map(([k, t]) => `<i class="${k}">${k === 'r' ? '⚠️' : '⏳'} ${esc(t)}</i>`).join('')}</div>` : ''}</button>`).join('')
    : `<div class="ls-empty"><b>Aucun lot suivi pour le moment</b><span>Touchez « Tous les lots », choisissez un lot puis définissez ses dates et ses équipes.</span></div>`}
    ${!L.length ? '<div class="ls-empty">Aucun lot : définissez l\'organisation technique du projet (Fiche projet › Organisation technique).</div>' : ''}
  </div>`;
  $$('[data-v]', root).forEach(b => b.onclick = () => { App.lsView = b.dataset.v; renderLotSuivi(root); });
  $$('[data-lot]', root).forEach(b => b.onclick = () => lsOpenLot(p, L.find(l => l.id === b.dataset.lot), () => renderLotSuivi(root)));
  const st = $('[data-a=lsst]'); if (st) st.onclick = () => lsSousTraitants(p);
}

function lsOpenLot(p, l, back) {
  const el = document.createElement('div'); el.className = 'fullpage ls-page'; document.body.appendChild(el);
  const unBack = pushBack(() => { el.remove(); back && back(); });
  const save = () => DB.put('projects', p);
  const draw = () => {
    const D = lsData(p, l.id), S = lsState(D), zonesAll = String(p.zones || '').split('\n').map(x => x.trim()).filter(Boolean);
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title"><b>${esc(l.name)}</b><span class="tb-crumb">${esc(p.name)} › Lots & équipes</span></div></div>
      <div class="ls-body" style="--c:${l.c}">
        <div class="ls-card ls-head"><div class="ls-big"><b>${S.real}%</b><small>réalisé${S.prev != null ? ` · ${S.prev}% prévu` : ''}</small></div>${lsBar(S.real, S.prev, l.c)}
          <div class="ls-kv"><button data-a="dates"><small>Début → fin prévus</small><b>${D.deb ? fmtDate(D.deb) : '—'} → ${D.fin ? fmtDate(D.fin) : '—'}</b></button>
            <button data-a="zones"><small>Zones</small><b>${(D.zones || []).length ? esc(D.zones.join(', ')) : 'Toutes'}</b></button>
            <button data-a="av"><small>Avancement</small><b>${D.av != null && D.av !== '' ? D.av + '% (saisi)' : 'Calculé (équipes)'}</b></button>
            <button data-a="resp"><small>Responsable du lot</small><b>${esc(D.resp || '—')}</b></button></div>
          ${S.al.length ? `<div class="ls-al col">${S.al.map(([k, t]) => `<i class="${k}">${k === 'r' ? '⚠️' : '⏳'} ${esc(t)}</i>`).join('')}</div>` : '<div class="ls-ok">✓ Aucune alerte</div>'}</div>
        <div class="h2-sec"><span>Répartition par niveau</span><small>${Object.keys(D.parts || {}).length}/${lsNiv(p).length}</small><button class="h2-more" data-a="niv">Niveaux…</button></div>
        <div class="ls-parts">${lsNiv(p).map(n => { const x = (D.parts || {})[n], S2 = lsSt(x && x.st), e = x && (D.eq || []).find(q => q.id === x.eq);
          return `<button class="ls-part ${x ? '' : 'vide'}" data-part="${esc(n)}" style="--s:${S2[2]};--e:${x ? lsEqC(D, x.eq) : '#94a3b8'}"><b class="n">${esc(n)}</b>
            ${x ? `<span class="who"><i>${esc(e ? lsIni(e.nom) : '?')}</i>${esc(e ? e.nom : 'Non affecté')}</span><span class="st">${esc(S2[1])}</span><span class="pb"><u style="width:${lsPartAv(x)}%"></u></span>` : '<span class="who mut">＋ Affecter</span>'}</button>`; }).join('')}</div>
        ${(D.eq || []).length ? `<div class="btnrow" style="padding:0;margin:6px 0 2px"><button class="btn ghost small" data-a="all">${icon('layers')} Une équipe pour tout le bâtiment</button></div>` : ''}
        <div class="h2-sec"><span>Équipes & sous-traitants</span><small>${(D.eq || []).length}</small></div>
        ${(D.eq || []).map(e => { const la = S.last(e), r = lsRendAvg(e), K = LS_KIND.find(k => k[0] === e.kind) || LS_KIND[0];
          return `<button class="ls-card ls-eq" data-eq="${e.id}"><div class="ls-lh"><span class="ls-av">${esc((e.nom || '?')[0].toUpperCase())}</span><span class="grow"><b>${esc(e.nom)}</b><small>${esc(K[1])}${e.chef ? ' · Chef : ' + esc(e.chef) : ''}</small></span><em>${la && la.av != null ? (+la.av) + '%' : '—'}</em></div>
            <div class="ls-grid"><div><small>Effectif</small><b>${(la && la.eff) || e.eff || '—'}</b></div><div><small>Rendement / pers. / j</small><b>${lsFmt(r)} ${esc(e.u || '')}</b></div><div><small>Engins</small><b>${esc(e.eng || '—')}</b></div><div><small>Dernière saisie</small><b>${la ? fmtDate(la.d) : '—'}</b></div></div>
            ${e.mis ? `<p>${esc(e.mis)}</p>` : ''}</button>`; }).join('') || '<div class="ls-empty">Ajoutez les équipes internes, sous-traitants ou tâcherons qui travaillent sur ce lot.</div>'}
        <button class="btn" data-a="addeq" style="width:100%;margin-top:6px">${icon('plus')} Équipe / sous-traitant</button>
      </div>`;
    $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); back && back(); };
    $('[data-a=dates]', el).onclick = async () => { const r = await formSheet('Dates du lot', [{ name: 'deb', label: 'Début prévu', type: 'date', value: D.deb || '' }, { name: 'fin', label: 'Fin prévue', type: 'date', value: D.fin || '' }], { okLabel: 'Enregistrer' }); if (r) { if (r.fin && r.deb && r.fin < r.deb) return toast('La fin doit être après le début'); D.deb = r.deb; D.fin = r.fin; await save(); draw(); } };
    $('[data-a=zones]', el).onclick = async () => {
      if (!zonesAll.length) { const r = await formSheet('Zones du lot', [{ name: 'z', label: 'Zones (séparées par des virgules)', value: (D.zones || []).join(', '), placeholder: 'Ex : Bloc A, Bloc B, R+1' }], { okLabel: 'Enregistrer' }); if (r) { D.zones = r.z.split(',').map(x => x.trim()).filter(Boolean); await save(); draw(); } return; }
      const sel = new Set(D.zones || []);
      for (;;) { const v = await menu('Zones du lot', [...zonesAll.map(z => ({ label: z, value: z, checked: sel.has(z) })), { label: '✓ Terminé', value: '__ok' }]); if (!v || v === '__ok') break; sel.has(v) ? sel.delete(v) : sel.add(v); }
      D.zones = zonesAll.filter(z => sel.has(z)); await save(); draw(); };
    $('[data-a=av]', el).onclick = async () => { const r = await formSheet('Avancement du lot', [{ name: 'av', label: 'Avancement réalisé (%) — vide = calculé depuis les équipes', type: 'number', value: D.av ?? '' }], { okLabel: 'Enregistrer' }); if (r) { D.av = r.av === '' ? null : Math.max(0, Math.min(100, +r.av)); await save(); draw(); } };
    $('[data-a=resp]', el).onclick = async () => { const r = await formSheet('Responsable du lot', [{ name: 'resp', label: 'Nom', value: D.resp || '', list: (p.team || []).map(m => m.name).filter(Boolean) }], { okLabel: 'Enregistrer' }); if (r) { D.resp = r.resp; await save(); draw(); } };
    $('[data-a=addeq]', el).onclick = async () => { const e = await lsEqForm(p, null); if (e) { D.eq.push(e); await save(); draw(); } };
    $('[data-a=niv]', el).onclick = async () => { const r = await formSheet('Niveaux du projet', [{ name: 'n', label: 'Un niveau par ligne (communs à tous les lots)', type: 'textarea', value: lsNiv(p).join('\n') }], { okLabel: 'Enregistrer' });
      if (r) { const L = r.n.split('\n').map(x => x.trim()).filter(Boolean); if (L.length) { p.lsNiv = L; await save(); draw(); } } };
    const ab = $('[data-a=all]', el); if (ab) ab.onclick = async () => { const id = await menu('Toute la hauteur du bâtiment', D.eq.map(e => ({ label: e.nom, value: e.id }))); if (!id) return;
      D.parts = D.parts || {}; for (const n of lsNiv(p)) { const x = D.parts[n] = D.parts[n] || { st: 'todo', av: 0 }; x.eq = id; } await save(); draw(); toast('Affecté à tous les niveaux ✓'); };
    $$('[data-part]', el).forEach(b => b.onclick = () => lsPartForm(p, D, b.dataset.part, async () => { await save(); draw(); }));
    $$('[data-eq]', el).forEach(b => b.onclick = () => lsOpenEq(p, l, D, D.eq.find(x => x.id === b.dataset.eq), save, draw));
  };
  draw();
}
async function lsPartForm(p, D, n, done) {
  D.parts = D.parts || {}; const x = D.parts[n] || { st: 'todo', av: 0 };
  if (!(D.eq || []).length) toast('Astuce : ajoutez d\'abord les équipes / sous-traitants du lot');
  const r = await formSheet(`${n}`, [
    { name: 'eq', label: 'Qui tient cette partie ?', type: 'select', value: x.eq || '', options: [{ value: '', label: '— Non affecté —' }, ...(D.eq || []).map(e => ({ value: e.id, label: `${e.nom} (${(LS_KIND.find(k => k[0] === e.kind) || LS_KIND[0])[1]})` }))] },
    { name: 'st', label: 'Statut', type: 'select', value: x.st || 'todo', options: LS_ST.map(([v, l]) => ({ value: v, label: l })) },
    { name: 'av', label: 'Avancement (%)', type: 'number', value: x.av ?? '' },
    { name: 'deb', label: 'Début prévu', type: 'date', value: x.deb || '' }, { name: 'fin', label: 'Fin prévue', type: 'date', value: x.fin || '' },
    { name: 'note', label: 'Note (blocage, réserve, réception…)', type: 'textarea', value: x.note || '' },
  ], { okLabel: 'Enregistrer', danger: D.parts[n] ? 'Retirer' : null });
  if (!r) return; if (r.__danger) { delete D.parts[n]; return done(); }
  const v = { ...x, ...r, av: r.av === '' ? 0 : Math.max(0, Math.min(100, +r.av)) };
  if (v.st === 'rec' && x.st !== 'rec') { v.av = 100; v.recAt = todayISO(); }
  if (v.st === 'done') v.av = 100;
  D.parts[n] = v; done();
}
// matrice niveaux × lots : couleur = statut, initiales = qui tient la partie
function lsMatrix(p, rows) {
  const L = rows.filter(x => Object.keys(x.D.parts || {}).length), N = lsNiv(p);
  if (!L.length) return '<div class="ls-empty"><b>Matrice vide</b><span>Ouvrez un lot puis affectez ses niveaux (Répartition par niveau).</span></div>';
  return `<div class="ls-mx-w"><table class="ls-mx"><tr><th></th>${L.map(({ l }) => `<th data-lot="${esc(l.id)}" style="--c:${l.c}">${esc(l.name.length > 12 ? l.name.slice(0, 11) + '…' : l.name)}</th>`).join('')}</tr>
    ${N.slice().reverse().map(n => `<tr><th>${esc(n)}</th>${L.map(({ l, D }) => { const x = (D.parts || {})[n]; if (!x) return '<td class="vide"></td>';
      const e = (D.eq || []).find(q => q.id === x.eq); return `<td data-lot="${esc(l.id)}" style="--s:${lsSt(x.st)[2]}" title="${esc(lsSt(x.st)[1])}"><b>${esc(e ? lsIni(e.nom) : '?')}</b><small>${lsPartAv(x)}%</small></td>`; }).join('')}</tr>`).join('')}</table></div>
    <div class="ls-leg">${LS_ST.map(([, l, c]) => `<span><i style="background:${c}"></i>${esc(l)}</span>`).join('')}</div>`;
}
async function lsEqForm(p, e) {
  const known = [...new Set(Object.values(p.lotSuivi || {}).flatMap(D => (D.eq || []).map(x => x.nom)).filter(Boolean))];
  const r = await formSheet(e ? 'Équipe / sous-traitant' : 'Nouvelle équipe / sous-traitant', [
    { name: 'kind', label: 'Type', type: 'select', value: e ? e.kind : 'st', options: LS_KIND.map(([v, l]) => ({ value: v, label: l })) },
    { name: 'nom', label: 'Nom (entreprise ou équipe)', value: e ? e.nom : '', list: known, placeholder: 'Ex : Ste Atlas Coffrage / Équipe ferrailleurs 2' },
    { name: 'chef', label: 'Chef responsable sur place', value: e ? e.chef : '', placeholder: 'Ex : Hassan' }, { name: 'tel', label: 'Téléphone du chef', type: 'tel', value: e ? e.tel || '' : '' },
    { name: 'eff', label: 'Effectif habituel', type: 'number', value: e ? e.eff || '' : '' },
    { name: 'mis', label: 'Mission / chargé de', type: 'textarea', value: e ? e.mis || '' : '', placeholder: 'Ex : coffrage et bétonnage des voiles R+1 à R+3' },
    { name: 'u', label: 'Unité de production', type: 'select', value: e ? e.u || 'm²' : 'm²', options: LS_UNITS },
    { name: 'eng', label: 'Engins / matériel', value: e ? e.eng || '' : '', placeholder: 'Ex : 1 grue, 2 bétonnières' },
  ], { okLabel: 'Enregistrer', danger: e ? 'Retirer du lot' : null });
  if (!r) return null; if (r.__danger) return { __del: true };
  if (!r.nom) { toast('Indiquez le nom'); return null; }
  return { ...(e || { id: DB.uid(), j: [] }), ...r };
}
function lsOpenEq(p, l, D, e, save, redraw) {
  const s = sheet('<div class="ls-eqs"></div>', { title: e.nom }), box = $('.ls-eqs', s.el);
  const draw = () => {
    const J = (e.j || []).slice().sort((a, b) => (b.d || '').localeCompare(a.d || '')), r = lsRendAvg(e), tq = J.reduce((a, x) => a + (+x.q || 0), 0);
    const cons = {}; J.forEach(x => (x.c || []).forEach(c => { const k = c.m + ' (' + c.u + ')'; cons[k] = (cons[k] || 0) + (+c.q || 0); }));
    const R7 = J.slice(0, 10).reverse().map(lsRend), mx = Math.max(1, ...R7.filter(v => v != null));
    box.innerHTML = `<div class="ls-grid g3"><div><small>Total réalisé</small><b>${lsFmt(tq)} ${esc(e.u || '')}</b></div><div><small>Rendement moyen</small><b>${lsFmt(r)} ${esc(e.u || '')}/pers./j</b></div><div><small>Chef</small><b>${esc(e.chef || '—')}</b></div></div>
      ${R7.length ? `<div class="ls-spark">${R7.map(v => `<i style="height:${v == null ? 2 : Math.max(4, Math.round(v / mx * 46))}px" title="${lsFmt(v)}"></i>`).join('')}</div><small class="muted">Rendement par personne, 10 dernières saisies</small>` : ''}
      ${Object.keys(cons).length ? `<div class="ls-cons"><b>Consommation cumulée</b>${Object.entries(cons).map(([k, v]) => `<span>${esc(k)} : <b>${lsFmt(v)}</b></span>`).join('')}</div>` : ''}
      <div class="btnrow" style="padding:0;margin:10px 0"><button class="btn" data-a="jour">${icon('plus')} Saisie du jour</button><button class="btn ghost" data-a="edit">${icon('edit')} Fiche</button>${e.tel ? `<button class="btn ghost" data-a="tel">${icon('phone')}</button>` : ''}</div>
      <div class="ls-j">${J.map((x, i) => `<button class="ls-jr" data-j="${i}"><b>${fmtDate(x.d)}</b><span>${x.eff || '—'} pers. · ${lsFmt(+x.q)} ${esc(e.u || '')}${lsRend(x) != null ? ` · <em>${lsFmt(lsRend(x))}/pers.</em>` : ''}${x.av != null && x.av !== '' ? ` · ${x.av}%` : ''}</span>${x.n ? `<small>${esc(x.n)}</small>` : ''}</button>`).join('') || '<div class="ls-empty">Aucune saisie. Chaque jour : effectif, quantité réalisée, consommation → le rendement se calcule seul.</div>'}</div>`;
    $('[data-a=jour]', box).onclick = () => lsJour(e, null, async () => { await save(); draw(); redraw(); });
    $('[data-a=edit]', box).onclick = async () => { const n = await lsEqForm(p, e); if (!n) return; if (n.__del) { if (!(await confirmBox(`Retirer ${e.nom} de ce lot ?`, 'Retirer'))) return; D.eq = D.eq.filter(x => x !== e); await save(); s.close(); redraw(); return; } Object.assign(e, n); await save(); draw(); redraw(); };
    const tb = $('[data-a=tel]', box); if (tb) tb.onclick = () => openUrl('tel:' + e.tel.replace(/\s/g, ''));
    $$('[data-j]', box).forEach(b => b.onclick = () => lsJour(e, J[+b.dataset.j], async () => { await save(); draw(); redraw(); }));
  };
  draw();
}
async function lsJour(e, x, done) {
  const c0 = (x && x.c && x.c[0]) || {};
  const r = await formSheet(x ? 'Saisie du ' + fmtDate(x.d) : 'Saisie du jour · ' + e.nom, [
    { name: 'd', label: 'Date', type: 'date', value: x ? x.d : todayISO() },
    { name: 'eff', label: 'Effectif présent', type: 'number', value: x ? x.eff : e.eff || '' },
    { name: 'q', label: `Quantité réalisée (${e.u || 'u'})`, type: 'number', value: x ? x.q : '' },
    { name: 'av', label: 'Avancement de l\'équipe sur le lot (%)', type: 'number', value: x ? x.av ?? '' : '' },
    { name: 'cm', label: 'Consommation : matériau', value: c0.m || '', list: ['Béton', 'Acier HA', 'Coffrage', 'Ciment', 'Sable', 'Gravette', 'Agglos', 'Gasoil'] },
    { name: 'cq', label: 'Consommation : quantité', type: 'number', value: c0.q || '' }, { name: 'cu', label: 'Consommation : unité', type: 'select', value: c0.u || 'm³', options: [...LS_UNITS, 'L', 'sacs'] },
    { name: 'n', label: 'Note (zone, problème, météo…)', type: 'textarea', value: x ? x.n || '' : '' },
  ], { okLabel: 'Enregistrer', danger: x ? 'Supprimer' : null });
  if (!r) return;
  if (r.__danger) { e.j = (e.j || []).filter(y => y !== x); return done(); }
  const v = { d: r.d || todayISO(), eff: r.eff === '' ? '' : +r.eff, q: r.q === '' ? '' : +r.q, av: r.av === '' ? null : Math.max(0, Math.min(100, +r.av)), n: r.n, c: r.cm && r.cq ? [{ m: r.cm, q: +r.cq, u: r.cu }] : [] };
  if (x) Object.assign(x, v); else { e.j = e.j || []; e.j.push(v); }
  done();
}
// vue transversale : chaque sous-traitant / équipe, sur quels lots, effectif, rendement
function lsSousTraitants(p) {
  const M = new Map();
  for (const l of lsLots(p)) { const D = (p.lotSuivi || {})[l.id]; if (!D) continue;
    for (const e of D.eq || []) { const k = (e.nom || '').trim().toLowerCase(); if (!M.has(k)) M.set(k, { nom: e.nom, kind: e.kind, chef: e.chef, lots: [], eff: 0, q: {}, r: [] });
      const g = M.get(k), la = lsState(D).last(e); const nv = Object.entries(D.parts || {}).filter(([, x]) => x.eq === e.id).map(([n, x]) => n + (x.st === 'rec' ? ' ✓' : x.st === 'blk' ? ' ⛔' : '')); g.lots.push(l.name + (nv.length ? ' : ' + nv.join(', ') : '')); g.eff += +((la || {}).eff) || +e.eff || 0; const rr = lsRendAvg(e); if (rr != null) g.r.push(`${l.name} : ${lsFmt(rr)} ${e.u || ''}`); } }
  const L = [...M.values()];
  sheet(`<div class="ls-sts">${L.map(g => `<div class="ls-card"><div class="ls-lh"><span class="ls-av">${esc((g.nom || '?')[0].toUpperCase())}</span><span class="grow"><b>${esc(g.nom)}</b><small>${esc((LS_KIND.find(k => k[0] === g.kind) || LS_KIND[0])[1])}${g.chef ? ' · ' + esc(g.chef) : ''}</small></span><em>${g.eff} pers.</em></div>
    <p>📋 ${esc(g.lots.join(' · '))}</p>${g.r.length ? `<p>⚙️ ${esc(g.r.join(' · '))} /pers./j</p>` : ''}</div>`).join('') || '<div class="ls-empty">Aucune équipe ni sous-traitant pour le moment.</div>'}</div>`, { title: 'Sous-traitants & équipes' });
}
