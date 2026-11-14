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
  return { open, original, compute, planned };
})();
