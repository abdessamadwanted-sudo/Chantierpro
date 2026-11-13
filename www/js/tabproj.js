// ================= Table de projet : un seul tableau pour tout ce qui attend quelqu'un — réserves, RFI, visas =================
// Tableau de bord interactif (toucher une tuile, une barre ou une pastille filtre la liste) + liste. Lecture seule : chaque ligne ouvre la fiche d'origine.
// Pour ajouter une source : ajouter une entrée dans rowsOf().
const TabProj = (() => {
  const IV = [['ent', '🏢', 'Entreprise'], ['bet', '📐', 'BET'], ['archi', '🏛️', 'Architecte / MOE'], ['moa', '🏗️', 'Maître d\'ouvrage / AMO'], ['bc', '🔍', 'Bureau de contrôle'], ['labo', '🧪', 'Laboratoire'], ['topo', '📍', 'Topographe'], ['autre', '•', 'Autre']];
  const TYPES = [['res', '📍', 'Réserves'], ['rfi', '❓', 'RFI'], ['visa', '🛂', 'Visas']];
  // destinataire (texte libre des registres) → intervenant
  const ivOf = (s) => { const t = String(s || '').toLowerCase(); return /bet/.test(t) ? 'bet' : /architecte|moe/.test(t) ? 'archi' : /ma[iî]tre d|moa|amo/.test(t) ? 'moa' : /contr[oô]le/.test(t) ? 'bc' : /labo/.test(t) ? 'labo' : /topo/.test(t) ? 'topo' : 'autre'; };
  const F = { typ: '', etat: 'ouvert', iv: '', late: false, q: '' };
  async function rowsOf(p) {
    const out = [];
    try {
      const tasks = await DB.byProject('tasks', p.id);
      for (const t of tasks) {
        const c = companyOf(p, t.companyId), st = t.status === 'open' ? 'ouvert' : t.status === 'progress' ? 'cours' : 'clos';
        out.push({ typ: 'res', iv: 'ent', n: '#' + t.num, t: t.title || 'Sans titre', resp: (c && c.name) || t.assignee || '', ech: t.due || '', etat: st, late: !!isLate(t), p: +t.priority || 2, open: async (redraw) => { await openTaskDetail(t); redraw(); } });
      }
    } catch (e) { console.warn('tabproj tasks', e); }
    for (const k of ['rfi', 'visa']) {
      try {
        const D = REG[k]; if (!D) continue;
        for (const x of D.store(p)) { const R = D.row(x), S = regSt(D, x);
          out.push({ typ: k, iv: ivOf(x.dest), n: x.n || '', t: String(x.obj || x.des || x.doc || '').trim() || D.one, resp: x.dest || '', ech: x.dret || '', etat: x.st === 'env' ? 'ouvert' : 'clos', stl: S ? S[1] : '', late: !!R.late, p: R.urg ? 1 : 2, open: async (redraw) => { await regOpen(p, k, x, redraw); } }); }
      } catch (e) { console.warn('tabproj ' + k, e); }
    }
    return out;
  }
  const ETAT = { ouvert: ['Ouvert', '#3b82f6'], cours: ['En cours', '#f59e0b'], clos: ['Clos', '#22c55e'] };
  const match = (r, skip) => (skip === 'typ' || !F.typ || r.typ === F.typ) && (skip === 'iv' || !F.iv || r.iv === F.iv) && (skip === 'etat' || !F.etat || (F.etat === 'ouvert' ? r.etat !== 'clos' : r.etat === F.etat))
    && (skip === 'late' || !F.late || r.late) && (!F.q || `${r.n} ${r.t} ${r.resp}`.toLowerCase().includes(F.q.toLowerCase()));
  async function render(root) {
    const p = App.project; if (!p) return;
    const all = await rowsOf(p);
    const draw = () => {
      const open = all.filter(r => r.etat !== 'clos'), late = open.filter(r => r.late), rows = all.filter(r => match(r)).sort((a, b) => (b.late - a.late) || (a.p - b.p) || String(a.ech || '9').localeCompare(String(b.ech || '9')));
      const cnt = (f, skip) => all.filter(r => match(r, skip) && f(r)).length;
      const mx = Math.max(1, ...IV.map(([k]) => cnt(r => r.iv === k, 'iv')));
      root.innerHTML = `<div class="tp"><div class="pagehead"><h2>Table de projet</h2><p>${esc(p.name)} · toucher pour filtrer</p></div>
        <div class="tp-tiles">
          <button class="tp-t ${F.etat === 'ouvert' && !F.late ? 'on' : ''}" data-set="etat:ouvert" style="--c:#3b82f6"><b>${open.length}</b><span>À traiter</span></button>
          <button class="tp-t ${F.late ? 'on' : ''}" data-set="late:1" style="--c:#ef4444"><b>${late.length}</b><span>En retard</span></button>
          <button class="tp-t ${F.etat === 'clos' ? 'on' : ''}" data-set="etat:clos" style="--c:#22c55e"><b>${all.length - open.length}</b><span>Clos</span></button>
        </div>
        <div class="tp-chips">${[['', '🗂️', 'Tout'], ...TYPES].map(([k, e, l]) => `<button class="tp-c ${F.typ === k ? 'on' : ''}" data-set="typ:${k}">${e} ${l} <em>${cnt(r => !k || r.typ === k, 'typ')}</em></button>`).join('')}</div>
        <div class="tp-iv">${IV.map(([k, e, l]) => { const n = cnt(r => r.iv === k, 'iv'); return n || F.iv === k ? `<button class="tp-b ${F.iv === k ? 'on' : ''}" data-set="iv:${k}"><span>${e} ${esc(l)}</span><i style="width:${Math.round(n / mx * 100)}%"></i><em>${n}</em></button>` : ''; }).join('') || '<p class="tp-n">Aucun élément.</p>'}</div>
        <input class="tp-q" type="search" placeholder="🔍 Rechercher (n°, objet, responsable)…" value="${esc(F.q)}">
        <div class="tp-l">${rows.map((r, i) => `<button class="tp-r ${r.late ? 'late' : ''}" data-i="${i}"><span class="tp-ty">${(TYPES.find(x => x[0] === r.typ) || [0, '•'])[1]}</span><span class="tp-m"><b>${esc(r.n)} ${esc(r.t)}</b><small>${[(IV.find(x => x[0] === r.iv) || [])[2], r.resp, r.ech && '⏰ ' + fmtDate(r.ech)].filter(Boolean).map(esc).join(' · ')}</small></span><span class="tp-s" style="--c:${(ETAT[r.etat] || ETAT.ouvert)[1]}">${esc(r.late ? 'Retard' : r.stl || (ETAT[r.etat] || ETAT.ouvert)[0])}</span></button>`).join('') || '<div class="empty">Rien dans cette sélection.</div>'}</div></div>`;
      root.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { const [k, v] = b.dataset.set.split(':');
        if (k === 'late') { F.late = !F.late; if (F.late) F.etat = 'ouvert'; } else { F[k] = F[k] === v && k !== 'typ' ? '' : v; if (k === 'etat') F.late = false; }
        draw(); });
      const q = root.querySelector('.tp-q'); if (q) q.oninput = () => { F.q = q.value; const pos = q.selectionStart; draw(); const n = root.querySelector('.tp-q'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} };
      root.querySelectorAll('.tp-r').forEach(b => b.onclick = () => { const r = rows[+b.dataset.i]; if (r && r.open) r.open(() => render(root)); });
    };
    draw();
  }
  return { render, rowsOf };
})();
window.TabProj = TabProj;
