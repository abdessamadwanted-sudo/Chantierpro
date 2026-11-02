// ================= v1.0.65 : Avancement par quantités — Global (m², m³, ml, nombre…) par niveau × lot (× zone) =================
// Un « pin Global » invisible sur le plan porte la quantité totale et les saisies du jour (quantité faite, équipe, effectif).
// Le % (fait ÷ Global), le reste, le rythme et la fin estimée en découlent ; les tableaux d'avancement pondèrent par les quantités.
const AVQ_UNITS = ['m²', 'm³', 'ml', 'u', 'kg', 't', 'ens.'];
async function avGlobalPin(p, nivId, zone, create = true) {
  const L = (await DB.byProject('links', p.id)).filter(l => l.kind === 'local' && l.global && l.nivId === nivId && (l.zone || '') === (zone || ''));
  if (L[0] || !create) return L[0] || null;
  const n = (p.avNiveaux || []).find(x => x.id === nivId);
  return DB.put('links', { id: DB.uid(), projectId: p.id, kind: 'local', global: true, nivId, zone: zone || '', name: `Global ${n ? n.name : ''}${zone ? ' · ' + zone : ''}`.trim(), x: null, y: null, lots: {}, journal: [] });
}
// rythme (moyenne des 7 derniers jours avec saisie) et fin estimée
function avQtyPace(loc, lotId) {
  const J = (loc.journal || []).filter(e => e.lot === lotId && +e.qd > 0).sort((a, b) => a.d.localeCompare(b.d));
  const byD = {}; for (const e of J) byD[e.d] = (byD[e.d] || 0) + (+e.qd || 0);
  const D = Object.entries(byD).slice(-7), v = D.length ? D.reduce((a, [, q]) => a + q, 0) / D.length : 0;
  return { perDay: Math.round(v * 100) / 100, days: D.length };
}
async function avQtyDialog(p, nivId, lotId, onDone) {
  const n = (p.avNiveaux || []).find(x => x.id === nivId), lot = avLot(p, lotId); if (!n) return toast('Niveau introuvable');
  const zones = (typeof avZones === 'function' ? avZones(p) : []).filter(z => typeof avZoneOf !== 'function' || true);
  let zone = '';
  if (zones.length) { const z = await menu(`${n.name} · ${lot.name} — quantité pour…`, [{ label: `Tout le niveau ${n.name}`, value: '__all' }, ...zones.map(z => ({ label: z, value: z }))]); if (!z) return; zone = z === '__all' ? '' : z; }
  const loc = await avGlobalPin(p, nivId, zone), R = (loc.lots || {})[lotId] || {}, done = avQtyDone(loc, lotId), T = +R.qtot || 0, u = R.unit || 'm²', pace = avQtyPace(loc, lotId);
  const rest = T ? Math.max(0, T - done) : 0, fin = T && pace.perDay > 0 ? avAddDays(todayISO(), Math.ceil(rest / pace.perDay)) : '';
  const teams = typeof avTeams === 'function' ? avTeams(p) : [];
  const head = T ? `<div class="avq-sum"><div><b>${avFmtQ(done)}</b><small>fait (${esc(u)})</small></div><div><b>${avFmtQ(T)}</b><small>Global</small></div><div><b>${Math.min(100, Math.round(done / T * 100))}%</b><small>avancement</small></div><div><b>${avFmtQ(rest)}</b><small>reste</small></div>${pace.perDay ? `<div><b>${avFmtQ(pace.perDay)}</b><small>/ jour</small></div>` : ''}${fin ? `<div><b>${fmtDate(fin)}</b><small>fin estimée</small></div>` : ''}</div>` : '<p class="muted" style="margin:0">Indiquez la quantité totale (Global) : le % se calcule ensuite tout seul à chaque saisie.</p>';
  const r = await formSheet(`📏 ${n.name}${zone ? ' · ' + zone : ''} · ${lot.name}`, [
    { name: 'tot', label: 'Quantité globale (Global)', type: 'number', value: T || '', placeholder: 'Ex : 1250' },
    { name: 'u', label: 'Unité', type: 'select', value: u, options: AVQ_UNITS.map(x => ({ value: x, label: x === 'u' ? 'nombre (u)' : x })) },
    { name: 'q', label: `Fait aujourd'hui (${todayISO().split('-').reverse().join('/')})`, type: 'number', value: '', placeholder: 'Ex : 85' },
    ...(teams.length ? [{ name: 'eq', label: 'Équipe / sous-traitant', type: 'select', value: '', options: [{ value: '', label: '—' }, ...teams.map(t => ({ value: t.id, label: t.name }))] }] : []),
    { name: 'eff', label: 'Effectif (personnes)', type: 'number', value: '' },
  ], { okLabel: 'Enregistrer', intro: head });
  if (!r) return;
  const fresh = await DB.get('links', loc.id) || loc; fresh.lots = fresh.lots || {}; const rr = fresh.lots[lotId] = fresh.lots[lotId] || { state: 'todo', photos: [] };
  if (+r.tot > 0) { rr.qtot = +r.tot; rr.unit = r.u || 'm²'; }
  if (+r.q > 0) { if (!(+rr.qtot > 0)) return alertBox('Indiquez d\'abord la quantité globale.'); const cum = avQtyDone(fresh, lotId) + (+r.q); avEntryOn(p, fresh, { lot: lotId, qc: cum, eq: r.eq || '', eff: +r.eff || 0, src: 'qty' }); }
  await DB.put('links', fresh); await DB.put('projects', p);
  toast(+r.q > 0 ? `✓ ${avFmtQ(+r.q)} ${rr.unit} enregistrés` : '✓ Quantité globale enregistrée'); onDone && onDone();
}

// ================= v1.0.65 : case du tableau photos = un dossier (photos rangées par catégorie, ajout, envoi PDF / photos) =================
const AVD_CATS = ['Avancement', 'Nettoyage', 'Avant travaux', 'Après travaux', 'Anomalie', 'Traitement', 'Réception', 'Matériel / livraison', 'Autre'];
async function avCellDossier(p, l, lot, onChange) {
  const ids = () => { const R = (l.lots || {})[lot.id] || {}; return [...new Set([...(R.photos || []), ...(l.journal || []).filter(e => e.lot === lot.id).flatMap(e => e.photos || [])])]; };
  const jIds = () => new Set((l.journal || []).filter(e => e.lot === lot.id).flatMap(e => e.photos || []));
  const sel = new Set(); let selMode = false;
  return new Promise((resolve) => {
    const s = sheet(`<div class="avd"></div>`, { title: `📁 ${l.name} · ${lot.name}` }); s.onClose = () => resolve();
    const draw = async () => {
      const L = [], J = jIds(); for (const id of ids()) { const f = await DB.get('files', id); if (f) L.push({ f, cat: f.phCat || (J.has(id) ? 'Avancement' : 'Général') }); }
      L.sort((a, b) => (b.f.createdAt || 0) - (a.f.createdAt || 0));
      const G = new Map(); for (const x of L) { if (!G.has(x.cat)) G.set(x.cat, []); G.get(x.cat).push(x); }
      $('.avd', s.el).innerHTML = `<div class="avd-bar"><button class="btn small" data-a="add">${icon('camera')} Photos</button><button class="btn small ghost" data-a="sel">${selMode ? `✓ ${sel.size} choisie(s)` : '☑ Choisir'}</button>${L.length ? `<button class="btn small ghost" data-a="send">${icon('share')} Envoyer</button>` : ''}</div>
        ${selMode && sel.size ? `<div class="avd-bar"><button class="btn small ghost" data-a="mv">📁 Changer de catégorie</button><button class="btn small danger" data-a="del">${icon('trash')} Supprimer</button></div>` : ''}
        ${L.length ? [...G.entries()].map(([c, xs]) => `<div class="avd-h">${esc(c)} <small>${xs.length}</small></div><div class="avd-g">${xs.map(x => `<button class="avd-t ${sel.has(x.f.id) ? 'on' : ''}" data-id="${x.f.id}"><img src="${BlobURL.get(x.f.id, x.f.blob)}" loading="lazy"><small>${fmtDate(new Date(x.f.createdAt || Date.now()).toISOString().slice(0, 10)).slice(0, 5)}</small></button>`).join('')}</div>`).join('') : '<div class="empty">Aucune photo. Touchez « Photos » pour en ajouter.</div>'}`;
      $('[data-a=add]', s.el).onclick = async () => { const c = await menu('Catégorie des photos', AVD_CATS.map(x => ({ label: x, value: x }))); if (!c) return;
        const fs = await addPhotos(p.id, { local: l.id, lot: lot.id, source: `${l.name} · ${lot.name} · ${c}`, phCat: c }); if (!fs.length) return;
        for (const f of fs) { const r = await DB.get('files', f.id); if (r && r.phCat !== c) { r.phCat = c; await DB.put('files', r); } }
        const fresh = await DB.get('links', l.id); fresh.lots = fresh.lots || {}; const rr = fresh.lots[lot.id] = fresh.lots[lot.id] || { state: 'todo', photos: [] }; rr.photos = [...(rr.photos || []), ...fs.map(f => f.id)]; await DB.put('links', fresh); Object.assign(l, fresh); onChange && onChange(); draw(); };
      $('[data-a=sel]', s.el).onclick = () => { selMode = !selMode; if (!selMode) sel.clear(); draw(); };
      const sd = $('[data-a=send]', s.el); if (sd) sd.onclick = async () => { const chosen = selMode && sel.size ? L.filter(x => sel.has(x.f.id)) : L; const v = await menu(`Envoyer ${chosen.length} photo(s)`, [{ label: '📄 PDF (rangé par catégorie)', value: 'pdf' }, { label: '🖼️ Les photos', value: 'ph' }]); if (!v) return;
        if (v === 'ph') return sharePhotos(chosen.map(x => x.f.id), `*${l.name} · ${lot.name}*`, avFileName(`${l.name} ${lot.name}`));
        const G2 = new Map(); for (const x of chosen) { if (!G2.has(x.cat)) G2.set(x.cat, []); G2.get(x.cat).push(x.f); }
        return phPdf(p, [...G2.entries()].map(([c, fs]) => ({ title: c, sub: `${l.name} · ${lot.name}`, files: fs })), `${l.name} - ${lot.name}`); };
      const mv = $('[data-a=mv]', s.el); if (mv) mv.onclick = async () => { const c = await menu('Nouvelle catégorie', AVD_CATS.map(x => ({ label: x, value: x }))); if (!c) return; for (const id of sel) { const f = await DB.get('files', id); if (f) { f.phCat = c; await DB.put('files', f); } } sel.clear(); selMode = false; draw(); };
      const dl = $('[data-a=del]', s.el); if (dl) dl.onclick = async () => { if (await PhotoQ.remove([...sel])) { const fresh = await DB.get('links', l.id); if (fresh) Object.assign(l, fresh); sel.clear(); selMode = false; onChange && onChange(); draw(); } };
      $$('[data-id]', s.el).forEach(b => b.onclick = () => { const id = b.dataset.id;
        if (selMode) { sel.has(id) ? sel.delete(id) : sel.add(id); return draw(); }
        const flat = [...G.values()].flat(); showGallery(flat.map(x => ({ src: BlobURL.get(x.f.id, x.f.blob), fileId: x.f.id, caption: `${x.cat} · ${fmtDateTime(x.f.createdAt)}` })), flat.findIndex(x => x.f.id === id)); });
    };
    draw();
  });
}
