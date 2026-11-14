// ================= Planning : suivi prévisionnel / réalisé (baseline, écarts à date de référence, avancement pondéré, dépendances affectées) + consultation du PDF original =================
const PlanTrack = (() => {
  const n0 = (v) => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(x) ? 0 : x; };
  const dur = (t) => (t.deb && t.fin ? Math.max(1, dDiff(t.deb, t.fin) + 1) : 1);
  const planned = (t, D) => { if (!t.deb || !t.fin) return null; if (D < t.deb) return 0; if (D >= t.fin) return 100; return Math.round((dDiff(t.deb, D) + 1) / dur(t) * 1000) / 10; };
  const wOf = (P, t) => { const m = P.wmode || 'dur'; if (m === 'eq') return 1; if (m === 'man' && n0(t.w) > 0) return n0(t.w); return n0(t.w) > 0 ? n0(t.w) : dur(t); };   // jamais une moyenne simple par défaut : durée (ou poids saisi)
  // calcul pur : tâches courantes comparées à leur baseline à la date D (testable)
  function compute(P, D) {
    const T = P.tasks, byRef = {}; T.forEach(t => { if (t.ref) byRef[t.ref] = t; });
    const rows = T.map(t => { const b = baseOf(P, t) || { deb: t.deb, fin: t.fin }, pv = planned(b, D), re = Math.min(100, n0(t.av));
      let ret = 0; if (pv != null && re < 100) { if (D > b.fin) ret = dDiff(b.fin, D); else if (pv > re) ret = Math.ceil((pv - re) / 100 * dur(b)); }
      return { t, b, pv, re, ec: pv == null ? null : Math.round((re - pv) * 10) / 10, ret, w: wOf(P, t), slip: b.deb && t.deb && t.deb !== b.deb || b.fin && t.fin && t.fin !== b.fin ? (b.fin && t.fin ? dDiff(b.fin, t.fin) : 0) : 0 }; });
    const lateRef = new Set(rows.filter(r => r.ret > 0 && r.t.ref).map(r => r.t.ref));
    rows.forEach(r => { r.hit = String(r.t.dep || '').split(/[,;\s]+/).filter(d => d && lateRef.has(d) && byRef[d] !== r.t && n0(r.t.av) < 100); });
    const sw = rows.reduce((s, r) => s + r.w, 0) || 1, wp = rows.reduce((s, r) => s + (r.pv == null ? 0 : r.pv) * r.w, 0) / sw, wr = rows.reduce((s, r) => s + r.re * r.w, 0) / sw;
    return { rows, planned: Math.round(wp * 10) / 10, real: Math.round(wr * 10) / 10, gap: Math.round((wr - wp) * 10) / 10, late: rows.filter(r => r.ret > 0).length };
  }
  function open(p, redraw) {
    const P = planData(p); let D = todayISO();
    const ov = document.createElement('div'); ov.className = 'pi-ov'; document.body.appendChild(ov); let off = pushBack(() => close()); const close = () => { off && off(); off = null; ov.remove(); redraw && redraw(); };
    const draw = () => { const C = compute(P, D), bl = (P.bls || [])[0];
      ov.innerHTML = `<div class="pi-h"><button class="btn sm" data-q>← Retour</button><b>Suivi prévisionnel / réalisé</b></div>
        <div class="pi-i">${bl ? `Baseline <b>${esc(bl.ver)}</b> (${new Date(bl.at).toLocaleDateString('fr-FR')}${bl.by ? ' · ' + esc(bl.by) : ''})` : '<b style="color:#d97706">Pas de baseline : comparaison avec les dates actuelles (importez un planning pour figer la baseline)</b>'}${(P.revs || []).length ? ` · ${P.revs.length} révision(s)` : ''} · date de référence <input type="date" value="${D}" data-d> · pondération
          <select data-w><option value="dur" ${(P.wmode || 'dur') === 'dur' ? 'selected' : ''}>durée</option><option value="man" ${P.wmode === 'man' ? 'selected' : ''}>poids saisis</option><option value="eq" ${P.wmode === 'eq' ? 'selected' : ''}>égale</option></select></div>
        <div class="fn-kpi" style="padding:6px 10px"><div><span>Prévu</span><b>${C.planned} %</b></div><div><span>Réel</span><b>${C.real} %</b></div><div class="${C.gap < 0 ? 'neg' : ''}"><span>Écart</span><b>${C.gap > 0 ? '+' : ''}${C.gap} pts</b></div><div class="${C.late ? 'neg' : ''}"><span>En retard</span><b>${C.late}</b></div></div>
        <div class="pi-t"><table><thead><tr><th>ID</th><th>Tâche</th><th>Prévu</th><th>Réel</th><th>Écart</th><th>Retard</th></tr></thead><tbody>${C.rows.map((r, i) => `<tr data-i="${i}" class="${r.ret > 0 ? 'bad' : ''}"><td>${esc(r.t.ref || '')}</td><td>${esc(r.t.nom)}<small>${r.b.deb ? fmtDate(r.b.deb) + ' → ' + fmtDate(r.b.fin) : 'sans dates'}${r.slip ? ` · décalée de ${r.slip > 0 ? '+' : ''}${r.slip} j` : ''}${r.hit.length ? ' · ⛓ affectée par ' + esc(r.hit.join(',')) : ''}${r.t.cause ? ' · 📝 ' + esc(r.t.cause.cause || '') : ''}</small></td><td>${r.pv == null ? '—' : r.pv + ' %'}</td><td>${r.re} %</td><td style="color:${r.ec < 0 ? '#dc2626' : '#16a34a'}">${r.ec == null ? '—' : (r.ec > 0 ? '+' : '') + r.ec}</td><td>${r.ret ? r.ret + ' j' : ''}</td></tr>`).join('')}</tbody></table></div>
        <div class="pi-f"><small>Avancement global pondéré (${P.wmode === 'eq' ? 'poids égaux' : P.wmode === 'man' ? 'poids saisis, sinon durée' : 'durée'}) — pas de moyenne simple. Toucher une ligne pour noter la cause du retard, le responsable et l'action corrective.</small></div>`;
      ov.querySelector('[data-q]').onclick = () => close();
      ov.querySelector('[data-d]').onchange = (e) => { D = e.target.value || todayISO(); draw(); };
      ov.querySelector('[data-w]').onchange = async (e) => { P.wmode = e.target.value; await DB.put('projects', p); draw(); };
      ov.querySelectorAll('tbody tr').forEach(tr => tr.onclick = async () => { const r = C.rows[+tr.dataset.i], c = r.t.cause || {};
        const f = await formSheet(r.t.nom, [{ name: 'cause', label: 'Cause du retard', value: c.cause || '' }, { name: 'resp', label: 'Responsable', value: c.resp || '' }, { name: 'action', label: 'Action corrective', type: 'textarea', value: c.action || '' }], { okLabel: 'Enregistrer' }); if (!f) return;
        r.t.cause = { ...f, at: Date.now(), by: typeof myName === 'function' ? myName() : '' }; (r.t.log = r.t.log || []).push({ at: Date.now(), by: r.t.cause.by, what: 'cause : ' + (f.cause || '') }); await DB.put('projects', p); draw(); });
    };
    draw();
  }
  // PDF source : une page à la fois, rendue à la largeur de l'écran (pas de pages haute résolution gardées en mémoire)
  async function original(p) {
    const P = planData(p), b = (P.bls || [])[0]; if (!b || !b.fileId) return toast('Aucun PDF original conservé');
    const f = await DB.get('files', b.fileId); if (!f || !f.blob) return toast('PDF original introuvable sur cet appareil');
    if (!(await pdfReadyA())) return toast('Lecteur PDF indisponible');
    const pdf = await pdfjsLib.getDocument({ data: await f.blob.arrayBuffer() }).promise; let pg = 1;
    const ov = document.createElement('div'); ov.className = 'pi-ov'; document.body.appendChild(ov); let off = pushBack(() => close()); const close = () => { off && off(); off = null; ov.remove(); pdf.destroy && pdf.destroy(); };
    const draw = async () => { ov.innerHTML = `<div class="pi-h"><button class="btn sm" data-q>← Retour</button><b>${esc(f.name)} · original (lecture seule)</b><span style="flex:1"></span><button class="btn sm" data-p ${pg <= 1 ? 'disabled' : ''}>‹</button><small>${pg}/${pdf.numPages}</small><button class="btn sm" data-n ${pg >= pdf.numPages ? 'disabled' : ''}>›</button></div><div class="pi-t" style="padding:6px"><canvas class="pi-cv"></canvas></div>`;
      ov.querySelector('[data-q]').onclick = close; ov.querySelector('[data-p]').onclick = () => { pg--; draw(); }; ov.querySelector('[data-n]').onclick = () => { pg++; draw(); };
      const page = await pdf.getPage(pg), v0 = page.getViewport({ scale: 1 }), sc = Math.min(3, Math.max(1, (ov.clientWidth * 2) / v0.width)), v = page.getViewport({ scale: sc }), cv = ov.querySelector('canvas'); cv.width = v.width; cv.height = v.height; cv.style.width = '100%';
      await page.render({ canvasContext: cv.getContext('2d'), viewport: v }).promise; if (page.cleanup) page.cleanup(); };
    draw();
  }

  // ================= Vues : Calendrier, Liste, Comparaison (baseline / révision / réel), Courbe S =================
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const stCol = (t) => (n0(t.av) >= 100 ? '#22c55e' : t.fin && t.fin < todayISO() ? '#ef4444' : '#3b82f6');
  // avancement réel pondéré à une date : dernier relevé daté de chaque tâche (historique), 0 avant le premier relevé
  const realAt = (t, d) => { const h = (t.hist || []).filter(x => x.d <= d).sort((a, b) => a.d.localeCompare(b.d)); return h.length ? h[h.length - 1].av : (d >= todayISO() ? n0(t.av) : 0); };
  function curveData(P, step) {
    const T = P.tasks.filter(t => t.deb && t.fin), bs = T.map(t => baseOf(P, t) || t); if (!T.length) return null;
    const all = T.flatMap((t, i) => [t.deb, t.fin, bs[i].deb, bs[i].fin]).concat(todayISO()).sort(), d0 = all[0], d1 = all[all.length - 1], W = T.map(t => wOf(P, t)), sw = W.reduce((a, b) => a + b, 0) || 1, pts = [];
    for (let d = d0; d <= d1; d = dAdd(d, step)) { const bp = T.reduce((s, t, i) => s + (planned(bs[i], d) || 0) * W[i], 0) / sw, cp = T.reduce((s, t, i) => s + (planned(t, d) || 0) * W[i], 0) / sw, rr = d <= todayISO() ? T.reduce((s, t, i) => s + Math.min(100, realAt(t, d)) * W[i], 0) / sw : null; pts.push({ d, bp, cp, rr }); }
    return { d0, d1, pts, T, bs, W, sw };
  }
  // prévision de fin : indice de performance SPI = réel / prévu à aujourd'hui (pondérés) ; la durée restante de la baseline est divisée par le SPI (estimation linéaire, à lire comme un ordre de grandeur)
  function forecast(P) { const C = compute(P, todayISO()), bs = (P.bls || [])[0]; const end = (bs ? bs.tasks : P.tasks).map(t => t.fin).filter(Boolean).sort().pop(); if (!end) return null; const spi = C.planned > 0 ? C.real / C.planned : null;
    let fc = null; if (spi && spi > 0) { const rest = Math.max(0, dDiff(todayISO(), end)); fc = dAdd(todayISO(), Math.round(rest / Math.min(spi, 1.5))); } if (C.planned >= 100 && C.real < 100) fc = null;
    return { end, spi: spi == null ? null : Math.round(spi * 100) / 100, fc, delay: fc ? dDiff(end, fc) : null, C }; }
  function curveSVG(P) { const T0 = P.tasks.filter(x => x.deb && x.fin); if (!T0.length) return '<div class="fn-empty">Pas de tâches datées.</div>';
    const ds = T0.flatMap(x => { const b = baseOf(P, x) || x; return [x.deb, x.fin, b.deb, b.fin]; }).concat(todayISO()).sort(), span = Math.max(1, dDiff(ds[0], ds[ds.length - 1])), step = Math.max(1, Math.ceil(span / 120)), C = curveData(P, step), Wd = 680, H = 240, ml = 34, mb = 22, X = (d) => ml + dDiff(C.d0, d) / span * (Wd - ml - 8), Y = (v) => 8 + (1 - v / 100) * (H - 8 - mb);
    const line = (k, col, dash) => { const pts = C.pts.filter(p => p[k] != null); return pts.length ? `<polyline fill="none" stroke="${col}" stroke-width="2.2" ${dash ? 'stroke-dasharray="6 4"' : ''} points="${pts.map(p => X(p.d).toFixed(1) + ',' + Y(p[k]).toFixed(1)).join(' ')}"/>` : ''; };
    const grid = [0, 25, 50, 75, 100].map(v => `<line x1="${ml}" x2="${Wd - 8}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(100,116,139,.25)"/><text x="${ml - 4}" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="#64748b">${v}</text>`).join('');
    const ticks = []; for (let d = C.d0.slice(0, 8) + '01'; d <= C.d1; d = dAdd(d, 32).slice(0, 8) + '01') if (d >= C.d0) ticks.push(`<text x="${X(d)}" y="${H - 6}" font-size="9" fill="#64748b">${MOIS[+d.slice(5, 7) - 1].slice(0, 3)} ${d.slice(2, 4)}</text>`);
    return `<svg viewBox="0 0 ${Wd} ${H}" width="100%" class="sc-svg">${grid}${ticks.join('')}${line('bp', '#94a3b8', false)}${line('cp', '#a855f7', true)}${line('rr', '#2563eb', false)}<line x1="${X(todayISO())}" x2="${X(todayISO())}" y1="8" y2="${H - mb}" stroke="#ef4444" stroke-dasharray="3 3"/></svg>
      <div class="gt-leg"><span><i style="background:#94a3b8"></i>baseline</span><span><i style="background:#a855f7"></i>prévu actuel (dates modifiées)</span><span><i style="background:#2563eb"></i>réel (relevés d'avancement)</span><span><i class="td"></i>aujourd'hui</span></div>`; }
  function calHTML(P, ym) { const [Y, M] = ym.split('-').map(Number), first = `${Y}-${String(M).padStart(2, '0')}-01`, off = (new Date(first + 'T12:00:00').getDay() + 6) % 7, nd = new Date(Y, M, 0).getDate(), cells = [];
    for (let i = 0; i < off; i++) cells.push('<div class="cl-c off"></div>');
    for (let d = 1; d <= nd; d++) { const iso = `${Y}-${String(M).padStart(2, '0')}-${String(d).padStart(2, '0')}`, act = P.tasks.filter(t => t.deb && t.fin && t.deb <= iso && iso <= t.fin);
      cells.push(`<div class="cl-c ${iso === todayISO() ? 'td' : ''}" data-day="${iso}"><b>${d}</b>${act.slice(0, 3).map(t => `<i style="background:${stCol(t)}" title="${esc(t.nom)}">${esc((t.ref || t.nom || '').slice(0, 6))}</i>`).join('')}${act.length > 3 ? `<em>+${act.length - 3}</em>` : ''}</div>`); }
    return `<div class="cl"><div class="cl-h"><button class="btn sm" data-m="-1">‹</button><b>${MOIS[M - 1]} ${Y}</b><button class="btn sm" data-m="1">›</button></div><div class="cl-g">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}${cells.join('')}</div></div>`; }
  function listHTML(P) { const T = P.tasks.slice().sort((a, b) => String(a.deb || '9').localeCompare(String(b.deb || '9')));
    return `<div class="pi-t" style="max-height:none"><table><thead><tr><th>ID</th><th>Tâche</th><th>Lot</th><th>Début</th><th>Fin</th><th>%</th><th>Dép.</th></tr></thead><tbody>${T.map(t => `<tr data-t="${t.id}" class="${ganttLate(t) ? 'bad' : ''}"><td>${esc(t.ref || '')}</td><td>${esc(t.nom)}${t.obs ? `<small>${esc(t.obs)}</small>` : ''}</td><td>${esc(t.grp || '')}</td><td>${t.deb ? fmtDate(t.deb) : '—'}</td><td>${t.fin ? fmtDate(t.fin) : '—'}</td><td>${n0(t.av)}</td><td>${esc(t.dep || '')}</td></tr>`).join('')}</tbody></table></div>`; }
  function cmpHTML(P, revIdx) { const T = P.tasks.slice().sort((a, b) => String(a.deb || '9').localeCompare(String(b.deb || '9'))), bs = (P.bls || [])[0], rv = (P.revs || [])[revIdx] || (P.revs || []).slice(-1)[0], F = forecast(P);
    const all = T.flatMap(t => { const b = baseOf(P, t), r = rv && rv.tasks.find(x => (x.ref && x.ref === t.ref) || (!x.ref && x.nom === t.nom)); return [t.deb, t.fin, b && b.deb, b && b.fin, r && r.deb, r && r.fin]; }).filter(Boolean).concat(todayISO()).sort(), d0 = all[0], nd = Math.max(14, dDiff(d0, all[all.length - 1]) + 2), DW = Math.max(3, Math.min(10, 640 / nd)), X = (d) => dDiff(d0, d) * DW, bar = (a, b, cls) => a && b ? `<div class="cp-b ${cls}" style="left:${X(a)}px;width:${Math.max(DW, (dDiff(a, b) + 1) * DW)}px"></div>` : '';
    return `<div class="fn-kpi" style="padding:6px 0"><div><span>Fin baseline</span><b>${F ? fmtDate(F.end) : '—'}</b></div><div class="${F && F.delay > 0 ? 'neg' : ''}"><span>Prévision de fin</span><b>${F && F.fc ? fmtDate(F.fc) : '—'}</b><small>${F && F.fc ? (F.delay > 0 ? '+' : '') + F.delay + ' j · SPI ' + F.spi + ' (estimation linéaire)' : 'pas assez de données'}</small></div></div>
      <div class="pi-i" style="padding:0 0 6px">${bs ? 'Baseline <b>' + esc(bs.ver) + '</b>' : 'Pas de baseline'}${rv ? ` · révision comparée : <b>${esc(rv.ver)}</b>${(P.revs || []).length > 1 ? ' <button class="btn sm" data-rv>changer</button>' : ''}` : ' · aucune révision importée'}</div>
      <div class="gt-sc"><div style="width:${nd * DW + 150}px;position:relative">${T.map(t => { const b = baseOf(P, t), r = rv && rv.tasks.find(x => (x.ref && x.ref === t.ref) || (!x.ref && x.nom === t.nom)), dl = b && b.fin && t.fin ? dDiff(b.fin, t.fin) : 0;
        return `<div class="cp-r"><div class="cp-n"><b>${esc(t.ref || '')} ${esc(t.nom)}</b><small>${dl ? (dl > 0 ? '+' : '') + dl + ' j vs baseline' : 'conforme'}${ganttLate(t) ? ' · retard ' + dDiff(t.fin, todayISO()) + ' j' : ''}</small></div><div class="cp-t" style="width:${nd * DW}px">${b ? bar(b.deb, b.fin, 'bl') : ''}${r ? bar(r.deb, r.fin, 'rv') : ''}${bar(t.deb, t.fin, 'pv')}${t.deb && t.fin && n0(t.av) > 0 ? `<div class="cp-b rl" style="left:${X(t.deb)}px;width:${Math.max(DW, (dDiff(t.deb, t.fin) + 1) * DW * Math.min(100, n0(t.av)) / 100)}px;background:${stCol(t)}"></div>` : ''}</div></div>`; }).join('')}<div class="gt-today" style="left:${150 + X(todayISO())}px"></div></div></div>
      <div class="gt-leg"><span><i style="background:#94a3b8"></i>baseline</span><span><i style="background:#f59e0b"></i>révision</span><span><i style="background:#a855f7"></i>actuel</span><span><i style="background:#2563eb"></i>avancement réel</span></div>`; }
  function applyView(root, p, P, redraw) {
    const v = P.view, host = document.createElement('div'); host.className = 'gt-vw';
    ['.gt-sc', '.gt-leg'].forEach(sel => { const e = root.querySelector(sel); if (e) e.remove(); }); root.querySelector('.gt').appendChild(host);
    if (v === 'list') host.innerHTML = listHTML(P);
    else if (v === 'cmp') { host.innerHTML = cmpHTML(P, P._rv); const b = host.querySelector('[data-rv]'); if (b) b.onclick = async () => { const i = await menu('Révision à comparer', (P.revs || []).map((r, k) => ({ label: r.ver + ' · ' + new Date(r.at).toLocaleDateString('fr-FR'), value: String(k) }))); if (i != null) { P._rv = +i; redraw(); } }; }
    else if (v === 's') { const F = forecast(P); host.innerHTML = `<div class="fn-kpi" style="padding:6px 0"><div><span>Prévu</span><b>${F ? F.C.planned : 0} %</b></div><div><span>Réel</span><b>${F ? F.C.real : 0} %</b></div><div><span>SPI</span><b>${F && F.spi != null ? F.spi : '—'}</b></div></div>` + curveSVG(P); }
    else if (v === 'cal') { let ym = P._ym || todayISO().slice(0, 7); const draw = () => { host.innerHTML = calHTML(P, ym); host.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const [Y, M] = ym.split('-').map(Number), d = new Date(Y, M - 1 + +b.dataset.m, 1); ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; P._ym = ym; draw(); });
      host.querySelectorAll('[data-day]').forEach(c => c.onclick = async () => { const iso = c.dataset.day, act = P.tasks.filter(t => t.deb && t.fin && t.deb <= iso && iso <= t.fin); if (!act.length) return; const id = await menu(fmtDate(iso) + ' · ' + act.length + ' activité(s)', act.map(t => ({ label: `${t.ref ? t.ref + ' · ' : ''}${t.nom} — ${n0(t.av)} %`, swatch: stCol(t), value: t.id }))); }); }; draw(); }
  }
  return { open, original, compute, planned, forecast, curveData, applyView };
})();
