// ================= Planning (Gantt prévu / réel) et pointage de la main d'œuvre =================
// Planning : tâches (ou lots TCE importés) avec dates prévues / réelles et avancement ; la fin du marché recule avec les avenants et les OS.
// Pointage : présence de chaque ouvrier par jour ; le coût part automatiquement dans Financier › Dépenses (main d'œuvre).
function planData(p) { p.plan = p.plan || {}; p.plan.tasks = p.plan.tasks || []; return p.plan; }
const dISO = (d) => d.toISOString().slice(0, 10), dAdd = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return dISO(d); }, dDiff = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const ganttLate = (t) => fN(t.av) < 100 && t.fin && t.fin < todayISO();
async function renderPlanning(root) {
  const p = App.project, P = planData(p), save = () => DB.put('projects', p), redraw = () => renderPlanning(root), canE = orgEdit('planning');
  const T = P.tasks.slice().sort((a, b) => String(a.deb || '9').localeCompare(String(b.deb || '9')));
  const delai = planDelai(p), finRev = P.finM ? dAdd(P.finM, delai) : '';
  const all = T.flatMap(t => [t.deb, t.fin, t.debR, t.finR]).filter(Boolean).concat([todayISO(), P.finM, finRev].filter(Boolean)).sort();
  const z = P.zoom || 'w', DW = z === 'd' ? 26 : z === 'w' ? 9 : 3.2;
  const d0 = all.length ? dAdd(all[0], -3) : dAdd(todayISO(), -7), d1 = all.length ? dAdd(all[all.length - 1], 10) : dAdd(todayISO(), 60), nd = Math.max(30, dDiff(d0, d1)), W = nd * DW;
  const X = (d) => dDiff(d0, d) * DW;
  // graduations : mois (+ semaines selon le zoom)
  let ticks = '', months = '';
  for (let i = 0; i <= nd; i++) { const d = dAdd(d0, i), dt = new Date(d + 'T12:00:00');
    if (dt.getDate() === 1 || i === 0) months += `<span style="left:${i * DW}px">${dt.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}</span>`;
    if (z === 'd' || (z === 'w' && dt.getDay() === 1)) ticks += `<i style="left:${i * DW}px"><em>${dt.getDate()}</em></i>`; }
  const late = T.filter(ganttLate).length, avg = T.length ? Math.round(T.reduce((s, t) => s + fN(t.av), 0) / T.length) : 0;
  root.innerHTML = `<div class="gt">
    <div class="fn-kpi" style="padding:12px 12px 0"><div><span>Tâches</span><b>${T.length}</b><small>avancement moyen ${avg} %</small></div><div class="${late ? 'neg' : ''}"><span>En retard</span><b>${late}</b></div>
      <div class="wide"><span>Fin du marché</span><b>${P.finM ? fmtDate(P.finM) : '— à saisir'}${delai && P.finM ? ` → ${fmtDate(finRev)}` : ''}</b><small>${delai ? `+${delai} j (avenants et ordres de service)` : 'aucun délai supplémentaire'}</small></div></div>
    <div class="gt-bar">${canE ? `<button class="btn small" data-a="add">${icon('plus')} Tâche</button>` : ''}${canE && (p.tce || {}).lots && p.tce.lots.length ? `<button class="btn small ghost" data-a="tce">Importer les lots TCE</button>` : ''}
      <span class="grow"></span><div class="gt-z">${[['d', 'Jour'], ['w', 'Sem.'], ['m', 'Mois']].map(([k, l]) => `<button class="${z === k ? 'on' : ''}" data-z="${k}">${l}</button>`).join('')}</div><button class="iconbtn" data-a="more">${icon('more')}</button></div>
    ${T.length ? `<div class="gt-sc"><div class="gt-in" style="width:${W + 130}px">
      <div class="gt-hd"><div class="gt-nm"></div><div class="gt-tl" style="width:${W}px"><div class="gt-mo">${months}</div><div class="gt-tk">${ticks}</div></div></div>
      ${T.map(t => { const lt = ganttLate(t), c = lt ? '#ef4444' : fN(t.av) >= 100 ? '#22c55e' : '#3b82f6';
        const pv = t.deb && t.fin ? `<div class="gt-pv" style="left:${X(t.deb)}px;width:${Math.max(DW, (dDiff(t.deb, t.fin) + 1) * DW)}px"></div>` : '';
        const rs = t.debR || (fN(t.av) > 0 ? t.deb : ''), re = t.finR || (fN(t.av) > 0 && fN(t.av) < 100 ? todayISO() : t.fin);
        const rv = rs && re && re >= rs ? `<div class="gt-rv" style="left:${X(rs)}px;width:${Math.max(DW, (dDiff(rs, re) + 1) * DW)}px;--c:${c}"><u style="width:${Math.min(100, fN(t.av))}%"></u></div>` : '';
        return `<div class="gt-r" data-t="${t.id}"><div class="gt-nm"><b>${esc(t.nom || '')}</b><small>${fN(t.av)} %${lt ? ' · retard ' + dDiff(t.fin, todayISO()) + ' j' : ''}</small></div><div class="gt-tl" style="width:${W}px">${pv}${rv}</div></div>`; }).join('')}
      <div class="gt-today" style="left:${130 + X(todayISO())}px"></div>${P.finM ? `<div class="gt-fin" style="left:${130 + X(P.finM)}px" title="Fin du marché"></div>` : ''}${finRev && finRev !== P.finM ? `<div class="gt-fin rev" style="left:${130 + X(finRev)}px"></div>` : ''}
    </div></div><div class="gt-leg"><span><i class="pv"></i>prévu</span><span><i style="background:#3b82f6"></i>réel / avancement</span><span><i style="background:#ef4444"></i>en retard</span><span><i class="td"></i>aujourd'hui</span><span><i class="fm"></i>fin du marché</span></div>`
    : '<div class="fn-empty" style="padding:20px">Ajoutez les tâches (ou importez les lots TCE) avec les dates prévues. Le réel et l\'avancement s\'affichent par-dessus.</div>'}
  </div>`;
  const sc = $('.gt-sc', root); if (sc && !P._scrolled) { sc.scrollLeft = Math.max(0, X(todayISO()) - 120); }
  $$('[data-z]', root).forEach(b => b.onclick = async () => { P.zoom = b.dataset.z; await save(); redraw(); });
  const FIELDS = [{ name: 'nom', label: 'Tâche', placeholder: 'Ex : Gros œuvre R+3' }, { name: 'grp', label: 'Lot', list: typeof TCE_LOTS !== 'undefined' ? TCE_LOTS : [] }, { name: 'deb', label: 'Début prévu', type: 'date' }, { name: 'fin', label: 'Fin prévue', type: 'date' },
    { name: 'debR', label: 'Début réel', type: 'date' }, { name: 'finR', label: 'Fin réelle', type: 'date' }, { name: 'av', label: 'Avancement (%)', type: 'number' }];
  const edit = async (t) => { const r = await formSheet(t ? t.nom : 'Nouvelle tâche', FIELDS.map(f => ({ ...f, value: t ? t[f.name] ?? '' : f.name === 'deb' ? todayISO() : '' })), { okLabel: 'Enregistrer', danger: t ? 'Supprimer' : null });
    if (!r) return; if (r.__danger) P.tasks.splice(P.tasks.indexOf(t), 1); else { r.av = String(Math.max(0, Math.min(100, fN(r.av)))); if (fN(r.av) >= 100 && !r.finR) r.finR = todayISO(); if (fN(r.av) > 0 && !r.debR) r.debR = r.deb || todayISO(); t ? Object.assign(t, r) : P.tasks.push({ id: DB.uid(), ...r }); }
    // la tâche liée à un lot TCE met à jour son avancement
    const tg = t || P.tasks[P.tasks.length - 1]; if (tg && tg.lotId && p.tce) { const L = p.tce.lots.find(l => l.id === tg.lotId); if (L) { L.av = fN(tg.av); L.deb = tg.deb; L.fin = tg.fin; L.finR = tg.finR || L.finR; } }
    await save(); redraw(); };
  const ad = $('[data-a=add]', root); if (ad) ad.onclick = () => edit(null);
  $$('[data-t]', root).forEach(r => r.onclick = () => canE ? edit(P.tasks.find(t => t.id === r.dataset.t)) : null);
  const tc = $('[data-a=tce]', root); if (tc) tc.onclick = async () => { let n = 0; for (const L of p.tce.lots) { if (P.tasks.some(t => t.lotId === L.id)) continue; P.tasks.push({ id: DB.uid(), lotId: L.id, nom: L.lot, grp: L.lot, deb: L.deb || '', fin: L.fin || '', finR: L.finR || '', av: String(fN(L.av)) }); n++; } await save(); toast(`${n} lot(s) importé(s)`); redraw(); };
  $('[data-a=more]', root).onclick = async () => {
    const v = await menu('Planning', [...(canE ? [{ label: `Fin du marché (contractuelle)${P.finM ? ' · ' + fmtDate(P.finM) : ''}`, icon: 'calendar', value: 'fin' }] : []), { label: 'Export Excel', icon: 'grid', value: 'xls' }, { label: 'Avenants & ordres de service (délais)', icon: 'sign', value: 'av' }]);
    if (v === 'fin') { const r = await formSheet('Fin du marché', [{ name: 'd', label: 'Date de fin contractuelle (sans avenants)', type: 'date', value: P.finM || '' }]); if (r) { P.finM = r.d; await save(); redraw(); } }
    if (v === 'av') { App.section = 'avenants'; renderSection(); }
    if (v === 'xls') { const ld = loading('Excel…'); try { const b = await xlsxBlob([{ name: 'Planning', head: 0, rows: [['Tâche', 'Lot', 'Début prévu', 'Fin prévue', 'Début réel', 'Fin réelle', 'Avancement %', 'Retard (j)'], ...T.map(t => [t.nom || '', t.grp || '', t.deb ? fmtDate(t.deb) : '', t.fin ? fmtDate(t.fin) : '', t.debR ? fmtDate(t.debR) : '', t.finR ? fmtDate(t.finR) : '', fN(t.av), ganttLate(t) ? dDiff(t.fin, todayISO()) : 0])], widths: [32, 22, 12, 12, 12, 12, 12, 10] }]); ld.close(); await shareBlob(b, `Planning_${safeName(p.name)}.xlsx`); } catch (e) { ld.close(); alertBox(e.message || e); } }
  };
}

// ================= Pointage =================
function ptData(p) { p.pt = p.pt || {}; p.pt.w = p.pt.w || []; p.pt.d = p.pt.d || {}; p.pt.val = p.pt.val || {}; return p.pt; }
const weekKey = (d) => { const x = new Date(d + 'T12:00:00'), day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return dISO(x); };   // lundi de la semaine
function ptCost(p, from, to) { const P = ptData(p); let s = 0; for (const [d, m] of Object.entries(P.d)) { if ((from && d < from) || (to && d > to)) continue; for (const [wid, v] of Object.entries(m)) { const w = P.w.find(x => x.id === wid); if (w) s += fN(v) * fN(w.tarif); } } return s; }
async function renderPointage(root) {
  const p = App.project, P = ptData(p), save = () => DB.put('projects', p), redraw = () => renderPointage(root), canE = orgEdit('pointage'), canV = orgValid('pointage');
  App.ptDay = App.ptDay || todayISO(); const day = App.ptDay, M = P.d[day] || {}, wk = weekKey(day), val = P.val[wk];
  const act = P.w.filter(w => !w.off), pres = act.reduce((s, w) => s + fN(M[w.id]), 0), cost = act.reduce((s, w) => s + fN(M[w.id]) * fN(w.tarif), 0);
  const groups = [...new Set(act.map(w => w.eq || 'Équipe'))];
  root.innerHTML = `<div class="pt">
    <div class="pt-nav"><button class="iconbtn" data-d="-1">${icon('back')}</button><button class="pt-day" data-a="day"><b>${new Date(day + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</b>${day === todayISO() ? '<small>aujourd\'hui</small>' : ''}</button><button class="iconbtn" data-d="1" style="transform:scaleX(-1)">${icon('back')}</button></div>
    <div class="fn-kpi" style="padding:0 12px"><div><span>Présents</span><b>${gsF(pres, 1)} / ${act.length}</b></div><div><span>Coût du jour</span><b>${fDH(cost)}</b></div></div>
    ${val ? `<div class="pt-val">✓ Semaine validée par ${esc(val.by || '')} le ${fmtDate(val.at)}</div>` : ''}
    <div class="pt-l">${groups.map(g => `<div class="pt-g">${esc(g)}</div>${act.filter(w => (w.eq || 'Équipe') === g).map(w => { const v = M[w.id] ?? ''; return `<div class="pt-r"><button class="grow" data-w="${w.id}"><b>${esc(w.nom)}</b><small>${esc(w.fn || '')}${w.tarif ? ' · ' + fDH(fN(w.tarif)) + '/j' : ''}</small></button>
      <div class="pt-tg ${canE && !val ? '' : 'ro'}" data-tg="${w.id}">${[['1', '✓'], ['0.5', '½'], ['0', '✗']].map(([k, l]) => `<button class="${String(v) === k ? 'on v' + k.replace('.', '') : ''}" data-v="${k}">${l}</button>`).join('')}</div></div>`; }).join('')}`).join('') || '<div class="fn-empty" style="padding:16px">Ajoutez les ouvriers (nom, fonction, salaire journalier, équipe). Ensuite, chaque jour : ✓ présent · ½ demi-journée · ✗ absent.</div>'}</div>
    <div class="rg-b" style="padding:0 12px">${canE ? `<button class="fn-add" data-a="addw">${icon('plus')} Ouvrier</button>${act.length && !val ? `<button class="btn ghost small" data-a="all">Tous présents</button>` : ''}` : ''}<button class="btn ghost small" data-a="week">Semaine</button><button class="btn ghost small" data-a="xls">${icon('grid')} Excel du mois</button>${canV && act.length ? `<button class="btn ghost small" data-a="val">${val ? 'Annuler la validation' : '✍️ Valider la semaine'}</button>` : ''}</div>
  </div>`;
  $$('[data-d]', root).forEach(b => b.onclick = () => { App.ptDay = dAdd(day, +b.dataset.d); redraw(); });
  $('[data-a=day]', root).onclick = async () => { const r = await formSheet('Jour', [{ name: 'd', label: 'Date', type: 'date', value: day }]); if (r && r.d) { App.ptDay = r.d; redraw(); } };
  $$('[data-tg]', root).forEach(g => !g.classList.contains('ro') && $$('[data-v]', g).forEach(b => b.onclick = async () => { P.d[day] = P.d[day] || {}; const cur = String(P.d[day][g.dataset.tg] ?? ''); if (cur === b.dataset.v) delete P.d[day][g.dataset.tg]; else P.d[day][g.dataset.tg] = b.dataset.v; await save(); redraw(); }));
  const WF = [{ name: 'nom', label: 'Nom' }, { name: 'fn', label: 'Fonction', list: ['Maçon', 'Ferrailleur', 'Coffreur', 'Manœuvre', 'Chef d\'équipe', 'Électricien', 'Plombier', 'Peintre', 'Carreleur', 'Conducteur d\'engin', 'Grutier', 'Gardien'] }, { name: 'tarif', label: 'Salaire journalier (DH)', type: 'number' }, { name: 'eq', label: 'Équipe / sous-traitant', list: [...new Set([...P.w.map(w => w.eq).filter(Boolean), ...(p.st || []).map(s => s.nom)])] }, { name: 'tel', label: 'Téléphone', type: 'tel' }];
  const editW = async (w) => { const r = await formSheet(w ? w.nom : 'Nouvel ouvrier', WF.map(f => ({ ...f, value: w ? w[f.name] ?? '' : '' })), { okLabel: 'Enregistrer', danger: w ? 'Retirer (ne plus pointer)' : null }); if (!r) return; if (r.__danger) w.off = true; else w ? Object.assign(w, r) : P.w.push({ id: DB.uid(), ...r }); await save(); redraw(); };
  const aw = $('[data-a=addw]', root); if (aw) aw.onclick = () => editW(null);
  $$('[data-w]', root).forEach(b => b.onclick = () => canE && editW(P.w.find(w => w.id === b.dataset.w)));
  const al = $('[data-a=all]', root); if (al) al.onclick = async () => { P.d[day] = P.d[day] || {}; act.forEach(w => { if (P.d[day][w.id] == null) P.d[day][w.id] = '1'; }); await save(); redraw(); };
  const vb = $('[data-a=val]', root); if (vb) vb.onclick = async () => { if (val) delete P.val[wk]; else P.val[wk] = { by: myName(), poste: Org.label(), at: todayISO() }; await save(); redraw(); };
  $('[data-a=week]', root).onclick = () => { const ds = Array.from({ length: 7 }, (_, i) => dAdd(wk, i));
    sheet(`<div class="pt-wk"><table><tr><th></th>${ds.map(d => `<th>${new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'narrow' })}<br>${d.slice(8)}</th>`).join('')}<th>Σ</th></tr>
      ${act.map(w => { const vs = ds.map(d => fN((P.d[d] || {})[w.id])); return `<tr><td>${esc(w.nom)}</td>${vs.map(v => `<td class="${v === 1 ? 'p' : v ? 'h' : ''}">${v === 1 ? '✓' : v ? '½' : ''}</td>`).join('')}<td><b>${gsF(vs.reduce((a, b) => a + b, 0), 1)}</b></td></tr>`; }).join('')}</table>
      <p><b>Coût de la semaine : ${fDH(ptCost(p, ds[0], ds[6]))}</b></p></div>`, { title: `Semaine du ${fmtDate(wk)}` }); };
  $('[data-a=xls]', root).onclick = async () => { const mo = day.slice(0, 7), ds = Object.keys(P.d).filter(d => d.startsWith(mo)).sort(), ld = loading('Excel…');
    try { const all = Array.from({ length: new Date(+mo.slice(0, 4), +mo.slice(5, 7), 0).getDate() }, (_, i) => `${mo}-${String(i + 1).padStart(2, '0')}`);
      const rows = P.w.filter(w => !w.off || ds.some(d => (P.d[d] || {})[w.id])).map(w => { const vs = all.map(d => fN((P.d[d] || {})[w.id])), j = vs.reduce((a, b) => a + b, 0); return [w.nom, w.fn || '', w.eq || '', ...vs.map(v => v || ''), j, fN(w.tarif), j * fN(w.tarif)]; });
      const tot = ['TOTAL', '', '', ...all.map(() => ''), rows.reduce((s, r) => s + r[r.length - 3], 0), '', rows.reduce((s, r) => s + r[r.length - 1], 0)];
      const b = await xlsxBlob([{ name: 'Pointage ' + mo, head: 0, total: true, rows: [['Nom', 'Fonction', 'Équipe', ...all.map(d => d.slice(8)), 'Jours', 'DH/jour', 'Montant'], ...rows, tot], widths: [22, 14, 16, ...all.map(() => 4), 8, 10, 12] }]);
      ld.close(); await shareBlob(b, `Pointage_${safeName(p.name)}_${mo}.xlsx`); } catch (e) { ld.close(); alertBox(e.message || e); } };
}
