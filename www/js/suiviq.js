// ================= Suivi quantitatif : articles BPU / DQE, quantités par bâtiment · bloc · niveau · zone, prévisionnel vs réalisé =================
// Données (magasin « items » existant, un document par enregistrement → chaque appareil ajoute ses saisies sans écraser celles des autres) :
//   sqa  article  { id, projectId, ref, nom, lot, unit, qty (référence contractuelle), planRef (ID d'une tâche du Planning), zones:[{ zid, qty }], hist:[{ at, by, qty, why }] }
//   sqz  zone     { id, projectId, bat, bloc, niv, zone }
//   sqe  saisie   { id, projectId, artId, zid, delta, cum, mode:'cum'|'inc', at, by, note, status:'saisie'|'valide', corrects, over }
// Règles : réalisé = somme des deltas des saisies par zone (jamais un total éditable) ; une correction est une NOUVELLE saisie (delta opposé) qui référence l'ancienne ;
// un dépassement n'est ni plafonné ni effacé (justification demandée) ; le calcul n'utilise NI réception qualité NI PV ; le prévu vient de la baseline Planning (jamais d'une constante).
const SuiviQ = (() => {
  const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);
  const num = (v) => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(x) ? x : NaN; };
  const r6 = (x) => Math.round(x * 1e6) / 1e6;   // évite les écarts de virgule flottante (0,1 + 0,2)
  const UNITS = ['U', 'm²', 'm³', 'ml', 'kg', 't', 'ens', 'h'], INT_UNITS = ['U', 'ens'];
  const zoneName = (z) => [z.bat, z.bloc, z.niv, z.zone].filter(Boolean).join(' · ') || 'Zone';
  const mine = (all, pid) => all.filter(x => x.projectId === pid);   // séparation stricte : un projet (donc une organisation) ne voit jamais les données d'un autre

  // ---- calcul pur (testé) : article + saisies + tâche baseline → indicateurs
  function calc(art, entries, opt = {}) {
    const E = entries.filter(e => e.artId === art.id && e.projectId === art.projectId), byZone = {};
    for (const e of E) byZone[e.zid] = r6((byZone[e.zid] || 0) + (+e.delta || 0));   // une seule somme par zone : pas de double comptage
    const done = r6(Object.values(byZone).reduce((s, v) => s + v, 0)), qty = +art.qty || 0, zRef = r6((art.zones || []).reduce((s, z) => s + (+z.qty || 0), 0));
    const pct = qty > 0 ? done / qty * 100 : null;
    let planned = null; if (opt.plannedPct != null && qty > 0) planned = r6(qty * opt.plannedPct / 100);
    return { done, remaining: r6(qty - done), pct: pct == null ? null : Math.round(pct * 100) / 100, over: qty > 0 && done > qty ? r6(done - qty) : 0, planned, gap: planned == null ? null : r6(done - planned), byZone,
      zRef, recon: (art.zones || []).length ? r6(zRef - qty) : null, refZero: qty <= 0, negZone: Object.entries(byZone).filter(([, v]) => v < -1e-9).map(([z]) => z), nPending: E.filter(e => e.status === 'saisie').length };
  }
  // prévu à date = quantité de référence × % prévu de la tâche Planning liée, calculé sur la baseline (PlanTrack / baseOf) — null si non lié
  function plannedPct(p, art, D) {
    if (!art.planRef || typeof planData !== 'function' || typeof PlanTrack === 'undefined') return null;
    const P = planData(p), t = P.tasks.find(x => x.ref === art.planRef || x.id === art.planRef); if (!t) return null;
    const b = (typeof baseOf === 'function' && baseOf(P, t)) || t; return PlanTrack.planned(b, D || todayISO());
  }
  const valid = (unit, v) => Number.isFinite(v) && v >= 0 && (!INT_UNITS.includes(unit) || Math.abs(v - Math.round(v)) < 1e-9);

  // ---- écriture : nouvelle saisie (cumul ou ajout), jamais de modification d'un chiffre existant
  async function record(p, art, zid, value, mode, o = {}) {
    const all = mine(await DB.byProject('items', p.id), p.id), E = all.filter(e => e.kind === 'sqe' && e.artId === art.id), cur = r6(E.filter(e => e.zid === zid).reduce((s, e) => s + (+e.delta || 0), 0));
    const v = num(value); if (!valid(art.unit, v)) return { ok: false, err: INT_UNITS.includes(art.unit) ? 'Nombre entier positif attendu pour cette unité.' : 'Quantité invalide (nombre positif attendu).' };
    const delta = mode === 'inc' ? r6(v) : r6(v - cur); if (Math.abs(delta) < 1e-9) return { ok: false, err: 'Aucun changement.' };
    if (cur + delta < -1e-9) return { ok: false, err: 'Le réalisé de la zone ne peut pas devenir négatif.' };
    const by = o.by != null ? o.by : (typeof myName === 'function' ? myName() : ''), now = o.at || Date.now();
    const dup = E.find(e => e.zid === zid && Math.abs(e.delta - delta) < 1e-9 && e.by === by && now - e.at < 6000 && !e.corrects); if (dup) return { ok: false, err: 'Saisie identique déjà enregistrée (doublon ignoré).', dup: true };
    const total = calc(art, E).done + delta, over = art.qty > 0 && total > art.qty + 1e-9;
    if (over && !String(o.note || '').trim()) return { ok: false, needNote: true, err: 'Dépassement de la quantité de référence : une justification est demandée.' };
    const x = { id: DB.uid(), projectId: p.id, kind: 'sqe', artId: art.id, zid, delta, cum: r6(cur + delta), mode, at: now, by, note: String(o.note || '').slice(0, 300), crewId: o.crewId || '', status: o.valid ? 'valide' : 'saisie', corrects: o.corrects || null, over };
    await DB.put('items', x); return { ok: true, entry: x };
  }
  // correction contrôlée : annule une saisie par une écriture opposée (l'original reste visible dans l'historique)
  async function correct(p, art, entry, newDelta, o = {}) {
    const all = mine(await DB.byProject('items', p.id), p.id).filter(e => e.kind === 'sqe');
    if (all.some(e => e.corrects === entry.id)) return { ok: false, err: 'Cette saisie est déjà corrigée.' };
    const by = o.by != null ? o.by : (typeof myName === 'function' ? myName() : ''), r1 = { id: DB.uid(), projectId: p.id, kind: 'sqe', artId: entry.artId, zid: entry.zid, delta: r6(-entry.delta), cum: null, mode: 'cor', at: Date.now(), by, note: 'Correction : ' + (o.note || 'annulation'), status: o.valid ? 'valide' : 'saisie', corrects: entry.id, over: false };
    await DB.put('items', r1);
    if (newDelta != null && Math.abs(newDelta) > 1e-9) { const r = await record(p, art, entry.zid, newDelta, 'inc', { ...o, corrects: entry.id, note: 'Valeur corrigée', at: Date.now() + 1 }); if (!r.ok) return r; }
    return { ok: true };
  }

  // ================= interface =================
  const can = () => { try { return typeof orgEdit === 'function' ? orgEdit('avancement') : true; } catch (e) { return true; } };
  const canV = () => { try { return typeof orgValid === 'function' ? orgValid('avancement') : false; } catch (e) { return false; } };
  const bar = (v, k = '') => `<div class="sq-tr"><div class="sq-fl ${k}" style="width:${Math.max(0, Math.min(100, v || 0))}%"></div></div>`;
  async function load(p) { const all = mine(await DB.byProject('items', p.id), p.id); return { arts: all.filter(x => x.kind === 'sqa').sort((a, b) => String(a.ref).localeCompare(String(b.ref), 'fr', { numeric: true })), zones: all.filter(x => x.kind === 'sqz'), ents: all.filter(x => x.kind === 'sqe') }; }
  const head = (title) => `<div class="sq-hd"><div class="sq-br"><div class="sq-lg">♧</div><div><strong>SiteTeam</strong><small>${esc(App.project.name)} · Suivi des travaux</small></div></div><h1>${esc(title)}</h1></div>`;

  async function render(root) { if (!App.project) return; App.sq = App.sq || {}; return App.sq.sel ? fiche(root, App.sq.sel) : liste(root); }
  async function liste(root) {
    const p = App.project, D = await load(p), q = (App.sq.q || '').toLowerCase(), L = D.arts.filter(a => [a.ref, a.nom, a.lot].join(' ').toLowerCase().includes(q));
    root.innerHTML = `<div class="sq">${head('Articles BPU / DQE')}<div class="sq-bd"><div class="sq-lh"><span class="sq-pill">${L.length} article(s)</span><h2>Liste des articles</h2></div>
      <div class="sq-tools"><input class="sq-q" type="search" placeholder="Rechercher un article, un lot…" value="${esc(App.sq.q || '')}">${can() ? '<button class="sq-btn" data-a="add">＋ Article</button>' : ''}</div>
      ${L.map(a => { const c = calc(a, D.ents, { plannedPct: plannedPct(p, a) }); return `<button type="button" class="sq-art" data-id="${a.id}"><div class="sq-eb">ARTICLE ${esc(a.ref)} · ${esc(a.lot || '—')}</div><div class="sq-ah"><h3>${esc(a.nom)}</h3><span class="sq-val ${c.over ? 'neg' : ''}">${c.pct == null ? '—' : fmt(c.pct) + '%'} ›</span></div><div class="sq-qt">${fmt(c.done)} / ${fmt(a.qty)} ${esc(a.unit)}${c.over ? ' · dépassement ' + fmt(c.over) : ''}</div>${bar(c.pct)}</button>`; }).join('') || `<div class="sq-empty">${D.arts.length ? 'Aucun résultat.' : 'Aucun article. Ajoutez les articles du BPU / DQE (référence, désignation, lot, unité, quantité contractuelle).'}</div>`}
      <p class="sq-hint">L'avancement est calculé à partir des quantités saisies — indépendamment des réceptions qualité et des PV.</p></div></div>`;
    const qi = root.querySelector('.sq-q'); qi.oninput = () => { App.sq.q = qi.value; const pos = qi.selectionStart; liste(root).then(() => { const n = root.querySelector('.sq-q'); n.focus(); n.setSelectionRange(pos, pos); }); };
    root.querySelectorAll('.sq-art').forEach(b => b.onclick = () => { App.sq.sel = b.dataset.id; render(root); });
    const ad = root.querySelector('[data-a=add]'); if (ad) ad.onclick = async () => { if (await editArt(p, null)) liste(root); };
  }
  async function editArt(p, a) {
    const P = typeof planData === 'function' ? planData(p) : { tasks: [] };
    const r = await formSheet(a ? 'Modifier l\'article' : 'Nouvel article', [{ name: 'ref', label: 'Référence BPU', value: a ? a.ref : '' }, { name: 'nom', label: 'Désignation', value: a ? a.nom : '' }, { name: 'lot', label: 'Lot', value: a ? a.lot : '' },
      { name: 'unit', label: 'Unité', type: 'select', options: UNITS.map(u => ({ value: u, label: u })), value: a ? a.unit : 'U' }, { name: 'qty', label: 'Quantité contractuelle (référence)', type: 'number', value: a ? a.qty : '' },
      { name: 'planRef', label: 'Activité du Planning liée (pour le prévu à date)', type: 'select', options: [{ value: '', label: '— non lié —' }, ...P.tasks.map(t => ({ value: t.ref || t.id, label: (t.ref ? t.ref + ' · ' : '') + t.nom }))], value: a ? a.planRef || '' : '' }], { okLabel: 'Enregistrer' });
    if (!r || !String(r.nom || '').trim()) return null; const q = num(r.qty);
    if (!Number.isFinite(q) || q < 0) { toast('Quantité contractuelle invalide'); return null; }
    const x = a || { id: DB.uid(), projectId: p.id, kind: 'sqa', zones: [], hist: [] }; const old = a ? +a.qty : null;
    Object.assign(x, { ref: String(r.ref || '').trim() || String((await load(p)).arts.length + 1), nom: r.nom.trim(), lot: (r.lot || '').trim(), unit: r.unit || 'U', qty: q, planRef: r.planRef || '' });
    if (old == null || old !== q) (x.hist = x.hist || []).push({ at: Date.now(), by: typeof myName === 'function' ? myName() : '', qty: q, why: old == null ? 'création' : 'révision de la quantité (' + fmt(old) + ' → ' + fmt(q) + ')' });
    await DB.put('items', x); return x;
  }
  async function fiche(root, id) {
    const p = App.project, D = await load(p), a = D.arts.find(x => x.id === id); if (!a) { App.sq.sel = null; return liste(root); }
    const c = calc(a, D.ents, { plannedPct: plannedPct(p, a) }), ed = can(), vd = canV(), U = esc(a.unit), zones = (a.zones || []).map(z => ({ ...z, z: D.zones.find(q => q.id === z.zid) })).filter(z => z.z);
    const m = (l, v, u, cls = '') => `<div class="sq-m"><label>${l}</label><strong class="${cls}">${v}</strong> <span class="u">${u}</span></div>`;
    const grp = {}; zones.forEach(z => { const k = [z.z.bat, z.z.bloc, z.z.niv].filter(Boolean).join(' · ') || 'Sans localisation'; (grp[k] = grp[k] || []).push(z); });
    const hist = D.ents.filter(e => e.artId === a.id).sort((x, y) => y.at - x.at), corrected = new Set(hist.filter(e => e.corrects).map(e => e.corrects));
    root.innerHTML = `<div class="sq">${head('Fiche d\'avancement')}<div class="sq-bd"><button class="sq-back" data-a="back">← Tous les articles</button>
      <div class="sq-dt"><div class="sq-eb">ARTICLE ${esc(a.ref)} · ${esc(a.lot || '—')}</div><h2>${esc(a.nom)}</h2>${ed ? '<button class="sq-lnk" data-a="eda">Modifier l\'article</button>' : ''}</div>
      <div class="sq-ms">${m('Quantité totale', fmt(a.qty), U)}${m('Quantité réalisée', fmt(c.done), U)}${m('Quantité restante', fmt(c.remaining), U, c.remaining < 0 ? 'neg' : '')}${m('Avancement réel', c.pct == null ? '—' : fmt(c.pct), '%')}</div>
      ${c.refZero ? '<div class="sq-warn">Quantité de référence nulle : le pourcentage ne peut pas être calculé.</div>' : ''}${c.over ? `<div class="sq-warn">⚠ Dépassement de ${fmt(c.over)} ${U} par rapport à la quantité contractuelle (conservé, non plafonné).</div>` : ''}${c.negZone.length ? '<div class="sq-warn">⚠ Une zone a un réalisé négatif : vérifier l\'historique.</div>' : ''}${c.nPending ? `<div class="sq-info">${c.nPending} saisie(s) en attente de validation</div>` : ''}
      <section class="sq-sec"><div class="sq-kl"><h3>Avancement physique</h3><strong class="${c.over ? 'neg' : 'pos'}">${c.pct == null ? '—' : fmt(c.pct) + '%'}</strong></div>${bar(c.pct)}</section>
      <section class="sq-sec"><h3>Prévisionnel vs Réalisé</h3>${c.planned == null ? `<p class="sq-hint">Prévu à date indisponible : ${a.planRef ? 'activité « ' + esc(a.planRef) + ' » introuvable dans le Planning.' : 'article non lié à une activité du Planning (Modifier l\'article).'} Aucune valeur n'est inventée.</p>` : `<div class="sq-bl"><div class="sq-kl"><span>Prévu à date</span><strong>${fmt(c.planned)} ${U}</strong></div>${bar(a.qty > 0 ? c.planned / a.qty * 100 : 0, 'blue')}</div>`}
        <div class="sq-bl"><div class="sq-kl"><span>Réalisé</span><strong>${fmt(c.done)} ${U}</strong></div>${bar(c.pct)}</div>${c.gap == null ? '' : `<div class="sq-kl"><span>Écart à date</span><span class="${c.gap < 0 ? 'neg' : 'pos'}">${c.gap > 0 ? '+' : ''}${fmt(c.gap)} ${U}</span></div>`}</section>
      <section class="sq-sec"><div class="sq-kl"><h3>Détail par bâtiment / bloc / niveau / zone</h3>${ed ? '<button class="sq-lnk" data-a="addz">＋ Zone</button>' : ''}</div>
        <p class="sq-hint">Le réalisé est la somme des saisies par zone. Saisie cumulative : la valeur remplace le cumul de la zone par une <b>nouvelle écriture</b> ; « ＋ » ajoute un incrément.</p>
        ${Object.entries(grp).map(([g, zs]) => `<div class="sq-gh">${esc(g)}</div>${zs.map(z => { const r = c.byZone[z.zid] || 0, pz = z.qty > 0 ? r / z.qty * 100 : null; return `<div class="sq-z" data-z="${z.zid}"><div class="sq-zh"><div><h4>${esc(z.z.zone || zoneName(z.z))}</h4><small>Réf. ${fmt(z.qty)} ${U} · réalisé ${fmt(r)} ${U}${pz == null ? '' : ' · ' + fmt(pz) + '%'}</small></div>${ed ? `<div class="sq-zi"><input type="number" step="any" min="0" inputmode="decimal" aria-label="Cumul ${esc(zoneName(z.z))}" data-zi="${z.zid}" value="${r}"><button class="sq-plus" data-inc="${z.zid}" title="Ajouter un incrément">＋</button><button class="sq-plus" data-zm="${z.zid}" title="Zone">⋯</button></div>` : ''}</div>${bar(pz)}</div>`; }).join('')}`).join('') || '<div class="sq-empty">Aucune zone affectée. Ajoutez une zone (bâtiment · bloc · niveau · zone) et sa quantité de référence.</div>'}
        <div class="sq-kl"><strong>Total des zones (réalisé)</strong><strong>${fmt(c.done)} ${U}</strong></div>
        ${c.recon != null ? `<div class="sq-kl"><span class="sq-hint">Références zonales : ${fmt(c.zRef)} ${U}</span><span class="${Math.abs(c.recon) > 1e-9 ? 'neg' : 'pos'}">${Math.abs(c.recon) > 1e-9 ? 'écart ' + (c.recon > 0 ? '+' : '') + fmt(c.recon) + ' ' + a.unit + ' vs référence globale' : 'cohérent avec la référence globale'}</span></div>` : ''}
        <div id="sqErr" class="sq-err" role="alert"></div>${ed ? '<button class="sq-btn" data-a="apply">Appliquer les quantités</button>' : '<p class="sq-hint">Lecture seule : vous n\'avez pas le droit de modifier ces quantités.</p>'}</section>
      <section class="sq-sec"><h3>Historique</h3>${hist.length ? hist.map(e => { const z = D.zones.find(q => q.id === e.zid); return `<div class="sq-h ${corrected.has(e.id) ? 'cor' : ''}" data-e="${e.id}"><div><b class="${e.delta < 0 ? 'neg' : 'pos'}">${e.delta > 0 ? '+' : ''}${fmt(e.delta)} ${U}</b> · ${esc(z ? zoneName(z) : 'zone supprimée')}<small>${new Date(e.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · ${esc(e.by || '—')} · ${e.mode === 'cum' ? 'cumul' : e.mode === 'cor' ? 'correction' : 'ajout'}${e.status === 'valide' ? ' · ✓ validé' : ' · à valider'}${e.over ? ' · ⚠ dépassement' : ''}${corrected.has(e.id) ? ' · corrigée' : ''}${e.note ? ' · ' + esc(e.note) : ''}</small></div></div>`; }).join('') : '<p class="sq-hint">Aucune saisie.</p>'}
        ${(a.hist || []).length ? `<p class="sq-hint">Révisions de la référence : ${a.hist.map(h => `${new Date(h.at).toLocaleDateString('fr-FR')} ${fmt(h.qty)} ${U}`).join(' → ')}</p>` : ''}</section></div></div>`;
    const redraw = () => fiche(root, id), err = (t) => { const e = root.querySelector('#sqErr'); if (e) e.textContent = t; };
    root.querySelector('[data-a=back]').onclick = () => { App.sq.sel = null; render(root); };
    const eda = root.querySelector('[data-a=eda]'); if (eda) eda.onclick = async () => { if (await editArt(p, a)) redraw(); };
    const az = root.querySelector('[data-a=addz]'); if (az) az.onclick = async () => { if (await addZone(p, a, D)) redraw(); };
    const ap = root.querySelector('[data-a=apply]'); if (ap) ap.onclick = async () => {
      const done = []; for (const inp of root.querySelectorAll('[data-zi]')) { const zid = inp.dataset.zi, cur = c.byZone[zid] || 0, v = num(inp.value); if (!Number.isFinite(v) || v < 0 || (INT_UNITS.includes(a.unit) && Math.abs(v - Math.round(v)) > 1e-9)) return err('Quantités invalides : ' + (INT_UNITS.includes(a.unit) ? 'nombres entiers positifs' : 'nombres positifs') + ' attendus.'); if (Math.abs(v - cur) > 1e-9) done.push([zid, v]); }
      if (!done.length) return err('Aucun changement.'); err('');
      let note = ''; const tot = c.done + done.reduce((s, [z, v]) => s + (v - (c.byZone[z] || 0)), 0);
      if (a.qty > 0 && tot > a.qty + 1e-9) { const f = await formSheet('Dépassement de la quantité de référence', [{ name: 'n', label: `Total ${fmt(tot)} ${a.unit} > ${fmt(a.qty)} ${a.unit} : justification (obligatoire)`, type: 'textarea' }], { okLabel: 'Confirmer' }); if (!f || !String(f.n || '').trim()) return err('Dépassement non enregistré : justification requise.'); note = f.n; }
      for (const [zid, v] of done) { const r = await record(p, a, zid, v, 'cum', { note, valid: vd }); if (!r.ok && !r.dup) return err(r.err); }
      toast('Quantités enregistrées ✓'); redraw(); };
    root.querySelectorAll('[data-inc]').forEach(b => b.onclick = async () => { const crews = (await DB.byProject('items', p.id)).filter(x => x.kind === 'ogt' && x.projectId === p.id);   // équipe ayant exécuté (rendements de l'organigramme)
      const f = await formSheet('Ajouter une quantité', [{ name: 'v', label: `Quantité exécutée à ajouter (${a.unit})`, type: 'number' }, ...(crews.length ? [{ name: 'c', label: 'Équipe (optionnel)', type: 'select', value: '', options: [{ value: '', label: '— non précisée —' }, ...crews.map(x => ({ value: x.id, label: x.name }))] }] : []), { name: 'n', label: 'Note (optionnel)', type: 'textarea' }], { okLabel: 'Ajouter' }); if (!f) return;
      let r = await record(p, a, b.dataset.inc, f.v, 'inc', { note: f.n, valid: vd, crewId: f.c }); if (r.needNote) { const j = await formSheet('Dépassement', [{ name: 'n', label: 'Justification (obligatoire)', type: 'textarea' }], { okLabel: 'Confirmer' }); if (!j || !String(j.n || '').trim()) return err('Justification requise.'); r = await record(p, a, b.dataset.inc, f.v, 'inc', { note: j.n, valid: vd, crewId: f.c }); }
      if (!r.ok) return err(r.err); toast('Ajouté ✓'); redraw(); });
    root.querySelectorAll('[data-zm]').forEach(b => b.onclick = async () => { const zid = b.dataset.zm, za = a.zones.find(z => z.zid === zid), v = await menu('Zone', [{ label: 'Modifier la quantité de référence', value: 'q' }, { label: 'Retirer de cet article', value: 'd' }]); if (!v) return;
      if (v === 'q') { const f = await formSheet('Quantité de référence de la zone', [{ name: 'q', label: `Référence (${a.unit})`, type: 'number', value: za.qty }]); if (f && Number.isFinite(num(f.q)) && num(f.q) >= 0) { za.qty = num(f.q); await DB.put('items', a); redraw(); } }
      if (v === 'd') { if ((c.byZone[zid] || 0) !== 0 || D.ents.some(e => e.artId === a.id && e.zid === zid)) return toast('Zone avec saisies : non retirable (historique conservé)'); a.zones = a.zones.filter(z => z.zid !== zid); await DB.put('items', a); redraw(); } });
    root.querySelectorAll('.sq-h').forEach(h => h.onclick = async () => { if (!ed) return; const e = hist.find(x => x.id === h.dataset.e); if (!e || corrected.has(e.id) || e.corrects) return;
      const opts = [{ label: 'Corriger la valeur…', value: 'c' }, { label: 'Annuler cette saisie', value: 'a' }]; if (vd && e.status !== 'valide') opts.unshift({ label: '✓ Valider cette saisie', value: 'v' }); const v = await menu('Saisie du ' + new Date(e.at).toLocaleDateString('fr-FR'), opts); if (!v) return;
      if (v === 'v') { e.status = 'valide'; e.vby = typeof myName === 'function' ? myName() : ''; await DB.put('items', e); return redraw(); }
      if (v === 'a') { const r = await correct(p, a, e, null, { valid: vd }); if (!r.ok) return err(r.err); }
      if (v === 'c') { const f = await formSheet('Valeur corrigée', [{ name: 'v', label: `Nouvelle quantité de cette saisie (${a.unit})`, type: 'number', value: e.delta }]); if (!f) return; const nv = num(f.v); if (!valid(a.unit, nv)) return err('Valeur invalide.'); const r = await correct(p, a, e, nv, { valid: vd, note: f.n }); if (!r.ok) return err(r.err); }
      toast('Correction enregistrée ✓'); redraw(); });
  }
  async function addZone(p, a, D) {
    const have = new Set((a.zones || []).map(z => z.zid)), free = D.zones.filter(z => !have.has(z.id));
    const v = await menu('Affecter une zone', [{ label: '＋ Nouvelle zone…', value: '__new' }, ...free.map(z => ({ label: zoneName(z), value: z.id }))]); if (!v) return null; let zid = v;
    if (v === '__new') { const niv = [...new Set((await DB.byProject('folders', p.id)).map(f => (typeof nivOfFolder === 'function' && nivOfFolder(f.name)) || '').filter(Boolean))];
      const f = await formSheet('Nouvelle zone', [{ name: 'bat', label: 'Bâtiment' }, { name: 'bloc', label: 'Bloc' }, { name: 'niv', label: 'Niveau', list: niv }, { name: 'zone', label: 'Zone / local' }], { okLabel: 'Créer' }); if (!f || !(f.bat || f.bloc || f.niv || f.zone)) return null;
      const z = { id: DB.uid(), projectId: p.id, kind: 'sqz', bat: (f.bat || '').trim(), bloc: (f.bloc || '').trim(), niv: (f.niv || '').trim(), zone: (f.zone || '').trim() }; await DB.put('items', z); zid = z.id; }
    const q = await formSheet('Quantité de référence de la zone', [{ name: 'q', label: `Référence (${a.unit}) — la somme des zones doit rejoindre ${fmt(a.qty)} ${a.unit}`, type: 'number', value: '' }], { okLabel: 'Affecter' }); if (!q) return null;
    const n = num(q.q); if (!Number.isFinite(n) || n < 0) { toast('Quantité invalide'); return null; }
    (a.zones = a.zones || []).push({ zid, qty: n }); await DB.put('items', a); return true;
  }
  return { render, calc, record, correct, plannedPct, valid, zoneName };
})();
function renderSuiviQ(root) { return SuiviQ.render(root); }
