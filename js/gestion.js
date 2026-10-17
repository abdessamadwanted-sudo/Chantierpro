// ================= Gestion de chantier (petites entreprises, conducteurs) =================
// 📦 Stock & besoins · ⚙️ Rendement des équipes · 🧾 Attachements & situations · 🧪 Labo / BET / Topo · 📚 Fiches matériaux
// Les données sont rangées dans le projet (p.gs), donc sauvegardées et synchronisées avec lui.
const GS_TABS = [['stock', '📦', 'Stock'], ['rend', '⚙️', 'Rendement'], ['att', '🧾', 'Attachements'], ['labo', '🧪', 'Labo · BET'], ['fiche', '📚', 'Fiches']];
const GS_ART_TPL = [
  ['Ciment CPJ 45', 'sac', 'Ciment'], ['Ciment CPJ 55', 'sac', 'Ciment'], ['Acier HA8', 'barre', 'Acier'], ['Acier HA10', 'barre', 'Acier'], ['Acier HA12', 'barre', 'Acier'], ['Acier HA14', 'barre', 'Acier'],
  ['Acier HA16', 'barre', 'Acier'], ['Acier HA20', 'barre', 'Acier'], ['Acier HA25', 'barre', 'Acier'], ['Fil à ligaturer', 'kg', 'Acier'], ['Sable', 'm³', 'Granulats'], ['Gravette 8/15', 'm³', 'Granulats'],
  ['Gravier 15/25', 'm³', 'Granulats'], ['Agglos 10', 'u', 'Maçonnerie'], ['Agglos 15', 'u', 'Maçonnerie'], ['Agglos 20', 'u', 'Maçonnerie'], ['Hourdis 16', 'u', 'Maçonnerie'], ['Brique 8 trous', 'u', 'Maçonnerie'],
  ['Bois de coffrage (planches)', 'm²', 'Coffrage'], ['Contreplaqué coffrage', 'u', 'Coffrage'], ['Étais métalliques', 'u', 'Coffrage'], ['Huile de décoffrage', 'L', 'Coffrage'], ['Cales béton / PVC', 'u', 'Coffrage'], ['Gasoil', 'L', 'Divers'],
];
const GS_TACHES = [['Coffrage voiles / poteaux', 'm²', 1.2, 2.5], ['Coffrage dalle / poutres', 'm²', 1.5, 3], ['Ferraillage', 'kg', 25, 45], ['Bétonnage (pompe)', 'm³', 1.5, 4], ['Bétonnage (manuel)', 'm³', .4, .9], ['Maçonnerie agglos', 'm²', 1, 1.6],
  ['Enduit ciment', 'm²', 1.2, 2], ['Chape', 'm²', 2.5, 5], ['Carrelage', 'm²', 1, 2], ['Peinture (par couche)', 'm²', 6, 12], ['Terrassement manuel', 'm³', .4, .8], ['Autre', 'u', 0, 0]];
const GS_CLASSES = { B20: 20, B25: 25, B30: 30, B35: 35, B40: 40, 'C20/25': 25, 'C25/30': 30, 'C30/37': 37, 'C35/45': 45 };
const GS_WHO = ['BET', 'Bureau de contrôle', 'Laboratoire', 'Topographe', 'Maître d\'ouvrage', 'Architecte', 'Fournisseur'];
const gsNum = (v) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const gsF = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('fr-FR', { maximumFractionDigits: d });
const gsDH = (n) => gsF(n, 2) + ' DH';
function gsData(p) { p.gs = p.gs || {}; const G = p.gs; for (const k of ['art', 'mv', 'bes', 'rend', 'bpu', 'att', 'sit', 'pre', 'vis']) G[k] = G[k] || []; return G; }
const gsStock = (G, id) => G.mv.filter(m => m.art === id).reduce((a, m) => a + gsNum(m.q), 0);

async function renderGestion(root) {
  const p = App.project, G = gsData(p), save = () => DB.put('projects', p);
  App.gsTab = App.gsTab || 'stock';
  const redraw = () => renderGestion(root);
  root.innerHTML = `<div class="gs-tabs">${GS_TABS.map(([k, e, l]) => `<button class="${App.gsTab === k ? 'on' : ''}" data-tab="${k}"><span>${e}</span>${l}</button>`).join('')}</div><div class="gs-body"></div>`;
  $$('[data-tab]', root).forEach(b => b.onclick = () => { App.gsTab = b.dataset.tab; redraw(); });
  const box = $('.gs-body', root);
  const T = App.gsTab;
  if (T === 'stock') gsStockTab(box, p, G, save, redraw);
  if (T === 'rend') gsRendTab(box, p, G, save, redraw);
  if (T === 'att') gsAttTab(box, p, G, save, redraw);
  if (T === 'labo') gsLaboTab(box, p, G, save, redraw);
  if (T === 'fiche') gsFichesTab(box);
}

// ---------- 📦 Stock & besoins ----------
function gsStockTab(box, p, G, save, redraw) {
  const low = G.art.filter(a => a.seuil && gsStock(G, a.id) <= gsNum(a.seuil));
  const open = G.bes.filter(b => b.st !== 'livre');
  const cats = [...new Set(G.art.map(a => a.cat || 'Divers'))];
  box.innerHTML = `
    ${low.length ? `<div class="gs-alert">⚠️ <b>${low.length} article(s) sous le seuil</b> : ${low.map(a => esc(a.nom)).join(', ')}</div>` : ''}
    <div class="gs-h"><b>Stock sur chantier</b><button class="btn small ghost" data-a="addart">${icon('plus')} Article</button></div>
    ${G.art.length ? cats.map(c => `<div class="gs-cat">${esc(c)}</div>` + G.art.filter(a => (a.cat || 'Divers') === c).map(a => { const q = gsStock(G, a.id), l = a.seuil && q <= gsNum(a.seuil);
      return `<div class="gs-row ${l ? 'low' : ''}"><button class="grow" data-art="${a.id}"><b>${esc(a.nom)}</b><small>${a.seuil ? `seuil ${gsF(gsNum(a.seuil))} ${esc(a.unite)}` : 'sans seuil'}</small></button>
        <span class="gs-q">${gsF(q)} <small>${esc(a.unite)}</small></span><button class="gs-pm" data-in="${a.id}">＋</button><button class="gs-pm out" data-out="${a.id}">－</button></div>`; }).join('')).join('')
      : `<div class="gs-empty">Ajoutez vos articles (ciment, acier, agglos…) puis notez les entrées <b>＋</b> et les sorties <b>－</b>. <button class="btn small" data-a="tpl" style="margin-top:8px">📋 Charger la liste type</button></div>`}
    <div class="gs-h"><b>Besoins / commandes</b> <span class="cr-n">${open.length}</span><button class="btn small ghost" data-a="addbes">${icon('plus')} Besoin</button></div>
    ${G.bes.slice().sort((a, b) => (a.st === 'livre') - (b.st === 'livre') || (a.pour || '').localeCompare(b.pour || '')).map(b => { const late = b.st !== 'livre' && b.pour && b.pour < todayISO();
      return `<button class="gs-row bes ${b.st || 'dem'} ${late ? 'late' : ''}" data-bes="${b.id}"><span class="grow"><b>${esc(b.nom)} · ${gsF(gsNum(b.q))} ${esc(b.unite || '')}</b><small>${b.pour ? 'pour le ' + fmtDate(b.pour) : ''}${b.note ? ' · ' + esc(b.note) : ''}</small></span><i>${({ dem: '📝 Demandé', cmd: '🚚 Commandé', livre: '✅ Livré' })[b.st || 'dem']}</i></button>`; }).join('') || '<div class="gs-empty">Aucun besoin noté.</div>'}
    ${open.length ? `<button class="btn" data-a="sendbes" style="width:100%;margin-top:8px">${icon('share')} Envoyer la liste des besoins (WhatsApp…)</button>` : ''}
    <div class="gs-h"><b>Derniers mouvements</b></div>
    ${G.mv.slice(-12).reverse().map(m => { const a = G.art.find(x => x.id === m.art) || {}; return `<div class="gs-mv"><span>${fmtDate(m.date)}</span><b class="${gsNum(m.q) < 0 ? 'out' : 'in'}">${gsNum(m.q) > 0 ? '+' : ''}${gsF(gsNum(m.q))} ${esc(a.unite || '')}</b><span class="grow">${esc(a.nom || '?')}${m.note ? ' · ' + esc(m.note) : ''}</span></div>`; }).join('') || '<div class="gs-empty">—</div>'}`;
  const A = (k) => $(`[data-a=${k}]`, box);
  if (A('tpl')) A('tpl').onclick = async () => { for (const [nom, unite, cat] of GS_ART_TPL) G.art.push({ id: DB.uid(), nom, unite, cat, seuil: '' }); await save(); toast('Liste chargée ✓ — supprimez ce qui ne sert pas'); redraw(); };
  A('addart').onclick = () => gsEditArt(null, G, save, redraw);
  $$('[data-art]', box).forEach(b => b.onclick = () => gsEditArt(G.art.find(a => a.id === b.dataset.art), G, save, redraw));
  const mv = async (id, sign) => { const a = G.art.find(x => x.id === id);
    const r = await formSheet(`${sign > 0 ? '＋ Entrée' : '－ Sortie'} · ${a.nom}`, [{ name: 'q', label: `Quantité (${a.unite})`, type: 'number', placeholder: 'Ex : 50' }, { name: 'date', label: 'Date', type: 'date', value: todayISO() }, { name: 'note', label: sign > 0 ? 'Fournisseur / BL' : 'Utilisé pour (ouvrage, équipe…)', placeholder: sign > 0 ? 'Ex : BL 2231' : 'Ex : Voiles R+2' }], { okLabel: 'Enregistrer' });
    if (!r || !gsNum(r.q)) return; G.mv.push({ id: DB.uid(), art: id, q: sign * Math.abs(gsNum(r.q)), date: r.date || todayISO(), note: r.note }); await save();
    const q = gsStock(G, id); if (a.seuil && q <= gsNum(a.seuil)) toast(`⚠️ ${a.nom} : plus que ${gsF(q)} ${a.unite}`); redraw(); };
  $$('[data-in]', box).forEach(b => b.onclick = () => mv(b.dataset.in, 1));
  $$('[data-out]', box).forEach(b => b.onclick = () => mv(b.dataset.out, -1));
  A('addbes').onclick = () => gsEditBes(null, G, save, redraw);
  $$('[data-bes]', box).forEach(b => b.onclick = () => gsEditBes(G.bes.find(x => x.id === b.dataset.bes), G, save, redraw));
  if (A('sendbes')) A('sendbes').onclick = () => { const txt = `📋 Besoins chantier — ${p.name}\n${todayISO().split('-').reverse().join('/')}\n\n` + open.map(b => `• ${b.nom} : ${gsF(gsNum(b.q))} ${b.unite || ''}${b.pour ? ' (pour le ' + fmtDate(b.pour) + ')' : ''}${b.note ? ' — ' + b.note : ''}`).join('\n');
    const S = window.Capacitor?.Plugins?.Share; if (S) S.share({ text: txt, dialogTitle: 'Envoyer les besoins' }).catch(() => {}); else { navigator.clipboard?.writeText(txt); toast('Copié ✓'); } };
}
async function gsEditArt(a, G, save, redraw) {
  const r = await formSheet(a ? a.nom : 'Nouvel article', [{ name: 'nom', label: 'Désignation', value: a ? a.nom : '', placeholder: 'Ex : Ciment CPJ 45' }, { name: 'unite', label: 'Unité', value: a ? a.unite : 'u', list: ['sac', 'kg', 't', 'barre', 'm³', 'm²', 'ml', 'u', 'L'] },
    { name: 'cat', label: 'Catégorie', value: a ? a.cat : '', list: ['Ciment', 'Acier', 'Granulats', 'Maçonnerie', 'Coffrage', 'Divers'] }, { name: 'seuil', label: 'Seuil d\'alerte (quantité mini)', type: 'number', value: a ? a.seuil : '' }], { okLabel: 'Enregistrer', danger: a ? 'Supprimer l\'article' : null });
  if (!r) return;
  if (r.__danger) { if (!await confirmBox(`Supprimer « ${a.nom} » et ses mouvements ?`)) return; G.art = G.art.filter(x => x !== a); G.mv = G.mv.filter(m => m.art !== a.id); }
  else if (a) Object.assign(a, r); else if (r.nom) G.art.push({ id: DB.uid(), ...r });
  await save(); redraw();
}
async function gsEditBes(b, G, save, redraw) {
  const r = await formSheet(b ? 'Besoin' : 'Nouveau besoin', [{ name: 'nom', label: 'Matériel / matériau', value: b ? b.nom : '', list: G.art.map(a => a.nom).concat(GS_ART_TPL.map(x => x[0])) }, { name: 'q', label: 'Quantité', type: 'number', value: b ? b.q : '' }, { name: 'unite', label: 'Unité', value: b ? b.unite : '', list: ['sac', 'kg', 't', 'barre', 'm³', 'm²', 'ml', 'u', 'L'] },
    { name: 'pour', label: 'Pour le', type: 'date', value: b ? b.pour : '' }, { name: 'st', label: 'Statut', type: 'select', value: b ? b.st || 'dem' : 'dem', options: [{ value: 'dem', label: '📝 Demandé' }, { value: 'cmd', label: '🚚 Commandé' }, { value: 'livre', label: '✅ Livré' }] }, { name: 'note', label: 'Note (fournisseur, ouvrage…)', value: b ? b.note : '' }], { okLabel: 'Enregistrer', danger: b ? 'Supprimer' : null });
  if (!r) return;
  if (r.__danger) G.bes = G.bes.filter(x => x !== b);
  else {
    const was = b && b.st; if (b) Object.assign(b, r); else if (r.nom) { b = { id: DB.uid(), ...r }; G.bes.push(b); }
    if (b && r.st === 'livre' && was !== 'livre') { const a = G.art.find(x => normQ(x.nom) === normQ(b.nom)); if (a && gsNum(b.q) && await confirmBox(`Ajouter ${gsF(gsNum(b.q))} ${a.unite} au stock de « ${a.nom} » ?`, 'Ajouter')) G.mv.push({ id: DB.uid(), art: a.id, q: Math.abs(gsNum(b.q)), date: todayISO(), note: 'Livraison' }); }
  }
  await save(); redraw();
}

// ---------- ⚙️ Rendement des équipes ----------
function gsRendTab(box, p, G, save, redraw) {
  const by = {}; for (const r of G.rend) { const k = r.tache; (by[k] = by[k] || []).push(r); }
  const rate = (r) => { const hh = gsNum(r.eff) * (gsNum(r.h) || 8); return hh ? gsNum(r.q) / hh * 8 : 0; };   // par ouvrier et par jour de 8 h
  box.innerHTML = `<div class="gs-h"><b>Rendement par tâche</b><button class="btn small" data-a="add">${icon('plus')} Journée</button></div>
    <div class="gs-note">Rendement = quantité ÷ (ouvriers × heures) × 8 h → <b>par ouvrier et par jour</b>. Repères indicatifs entre crochets.</div>
    ${Object.keys(by).length ? Object.entries(by).map(([k, L]) => { const T = GS_TACHES.find(t => t[0] === k) || [k, L[0].u, 0, 0], avg = L.reduce((a, r) => a + rate(r), 0) / L.length, last = L.slice(-10), mx = Math.max(...last.map(rate), T[3] || 0, .01);
      const lvl = T[2] && avg < T[2] ? 'lo' : T[3] && avg > T[3] ? 'hi' : 'ok';
      return `<div class="gs-rc ${lvl}"><div class="gs-rh"><b>${esc(k)}</b><span>${gsF(avg)} ${esc(T[1])}/ouvrier/j</span></div>
        <div class="gs-bars">${last.map(r => `<i style="height:${Math.max(6, rate(r) / mx * 100)}%" title="${fmtDate(r.date)}"></i>`).join('')}</div>
        <small>${L.length} journée(s) · cumul ${gsF(L.reduce((a, r) => a + gsNum(r.q), 0))} ${esc(T[1])}${T[2] ? ` · [repère ${T[2]}–${T[3]}]` : ''}${lvl === 'lo' ? ' · ⚠️ sous le repère' : ''}</small></div>`; }).join('') : '<div class="gs-empty">Notez chaque jour : tâche, quantité faite, nombre d\'ouvriers et heures. L\'appli calcule le rendement et compare aux repères.</div>'}
    <div class="gs-h"><b>Journal</b></div>
    ${G.rend.slice(-20).reverse().map(r => `<button class="gs-row" data-r="${r.id}"><span class="grow"><b>${esc(r.tache)} · ${gsF(gsNum(r.q))} ${esc(r.u)}</b><small>${fmtDate(r.date)} · ${esc(r.eq || 'équipe')} · ${gsNum(r.eff)} ouvrier(s) × ${gsNum(r.h) || 8} h${r.ouv ? ' · ' + esc(r.ouv) : ''}</small></span><span class="gs-q">${gsF(rate(r))}<small>/ouv./j</small></span></button>`).join('') || ''}`;
  const edit = async (r) => {
    const f = await formSheet(r ? 'Journée' : 'Nouvelle journée', [{ name: 'date', label: 'Date', type: 'date', value: r ? r.date : todayISO() }, { name: 'tache', label: 'Tâche', type: 'select', value: r ? r.tache : GS_TACHES[0][0], options: GS_TACHES.map(t => ({ value: t[0], label: `${t[0]} (${t[1]})` })) },
      { name: 'q', label: 'Quantité réalisée', type: 'number', value: r ? r.q : '' }, { name: 'eff', label: 'Nombre d\'ouvriers', type: 'number', value: r ? r.eff : '' }, { name: 'h', label: 'Heures travaillées', type: 'number', value: r ? r.h : 8 },
      { name: 'eq', label: 'Équipe / chef d\'équipe', value: r ? r.eq : '', list: [...new Set(G.rend.map(x => x.eq).filter(Boolean))] }, { name: 'ouv', label: 'Ouvrage (niveau, zone…)', value: r ? r.ouv : '' }], { okLabel: 'Enregistrer', danger: r ? 'Supprimer' : null });
    if (!f) return; if (f.__danger) G.rend = G.rend.filter(x => x !== r); else { f.u = (GS_TACHES.find(t => t[0] === f.tache) || [, 'u'])[1]; if (r) Object.assign(r, f); else G.rend.push({ id: DB.uid(), ...f }); }
    G.rend.sort((a, b) => (a.date || '').localeCompare(b.date || '')); await save(); redraw();
  };
  $('[data-a=add]', box).onclick = () => edit(null);
  $$('[data-r]', box).forEach(b => b.onclick = () => edit(G.rend.find(x => x.id === b.dataset.r)));
}

// ---------- 🧾 Attachements & situations ----------
function gsAttTab(box, p, G, save, redraw) {
  const cum = (id, upto) => G.att.filter(a => !upto || a.date <= upto).reduce((s, a) => s + gsNum((a.q || {})[id]), 0);
  const tot = (fn) => G.bpu.reduce((s, it) => s + fn(it) * gsNum(it.pu), 0);
  const marche = tot(it => gsNum(it.qm)), fait = tot(it => cum(it.id));
  box.innerHTML = `<div class="gs-kpi"><div><b>${gsDH(marche)}</b><span>montant marché HT</span></div><div><b>${gsDH(fait)}</b><span>réalisé HT · ${marche ? Math.round(fait / marche * 100) : 0}%</span></div></div>
    <div class="gs-h"><b>Bordereau des prix (BPU)</b><button class="btn small ghost" data-a="addbpu">${icon('plus')} Prix</button></div>
    ${G.bpu.map(it => { const c = cum(it.id), pc = gsNum(it.qm) ? Math.min(100, c / gsNum(it.qm) * 100) : 0; return `<button class="gs-row bpu" data-bpu="${it.id}"><span class="gs-n">${esc(it.n || '')}</span><span class="grow"><b>${esc(it.des)}</b><small>${gsF(c)} / ${gsF(gsNum(it.qm))} ${esc(it.u)} · PU ${gsDH(gsNum(it.pu))}</small><span class="gs-pb"><i style="width:${pc}%"></i></span></span><span class="gs-q">${gsDH(c * gsNum(it.pu))}</span></button>`; }).join('') || '<div class="gs-empty">Saisissez les prix du marché (n°, désignation, unité, prix unitaire, quantité du marché).</div>'}
    <div class="gs-h"><b>Attachements (métrés)</b><button class="btn small" data-a="addatt" ${G.bpu.length ? '' : 'disabled'}>${icon('plus')} Attachement</button></div>
    ${G.att.slice().reverse().map(a => `<button class="gs-row" data-att="${a.id}"><span class="grow"><b>Attachement du ${fmtDate(a.date)}</b><small>${Object.values(a.q || {}).filter(v => gsNum(v)).length} poste(s)${a.ouv ? ' · ' + esc(a.ouv) : ''}</small></span><span class="gs-q">${gsDH(G.bpu.reduce((s, it) => s + gsNum((a.q || {})[it.id]) * gsNum(it.pu), 0))}</span></button>`).join('') || '<div class="gs-empty">—</div>'}
    <div class="gs-h"><b>Situations</b></div>
    <button class="btn" data-a="sit" style="width:100%" ${G.bpu.length ? '' : 'disabled'}>${icon('pdf')} Établir la situation n° ${G.sit.length + 1} (PDF)</button>
    ${G.sit.slice().reverse().map(s => `<div class="gs-mv"><span>N° ${s.n}</span><b class="in">${gsDH(s.ttc)}</b><span class="grow">au ${fmtDate(s.date)} · cumul HT ${gsDH(s.cum)}</span></div>`).join('')}`;
  const A = (k) => $(`[data-a=${k}]`, box);
  const editBpu = async (it) => { const r = await formSheet(it ? 'Prix' : 'Nouveau prix', [{ name: 'n', label: 'N° de prix', value: it ? it.n : String(G.bpu.length + 1) }, { name: 'des', label: 'Désignation', value: it ? it.des : '', placeholder: 'Ex : Béton armé B25 pour voiles' }, { name: 'u', label: 'Unité', value: it ? it.u : 'm³', list: ['m³', 'm²', 'ml', 'kg', 't', 'u', 'ens', 'forfait'] }, { name: 'pu', label: 'Prix unitaire HT (DH)', type: 'number', value: it ? it.pu : '' }, { name: 'qm', label: 'Quantité du marché', type: 'number', value: it ? it.qm : '' }], { okLabel: 'Enregistrer', danger: it ? 'Supprimer' : null });
    if (!r) return; if (r.__danger) G.bpu = G.bpu.filter(x => x !== it); else if (it) Object.assign(it, r); else if (r.des) G.bpu.push({ id: DB.uid(), ...r }); await save(); redraw(); };
  A('addbpu').onclick = () => editBpu(null);
  $$('[data-bpu]', box).forEach(b => b.onclick = () => editBpu(G.bpu.find(x => x.id === b.dataset.bpu)));
  const editAtt = async (a) => {
    const r = await formSheet(a ? `Attachement du ${fmtDate(a.date)}` : 'Nouvel attachement', [{ name: 'date', label: 'Date', type: 'date', value: a ? a.date : todayISO() }, { name: 'ouv', label: 'Ouvrage / zone (optionnel)', value: a ? a.ouv : '' },
      ...G.bpu.map(it => ({ name: 'q_' + it.id, label: `${it.n ? it.n + ' · ' : ''}${it.des} (${it.u})`, type: 'number', value: a ? (a.q || {})[it.id] || '' : '' }))], { okLabel: 'Enregistrer', danger: a ? 'Supprimer' : null });
    if (!r) return; if (r.__danger) { G.att = G.att.filter(x => x !== a); await save(); return redraw(); }
    const q = {}; G.bpu.forEach(it => { const v = gsNum(r['q_' + it.id]); if (v) q[it.id] = v; });
    if (a) Object.assign(a, { date: r.date, ouv: r.ouv, q }); else G.att.push({ id: DB.uid(), date: r.date || todayISO(), ouv: r.ouv, q });
    G.att.sort((x, y) => (x.date || '').localeCompare(y.date || '')); await save(); redraw(); };
  if (A('addatt')) A('addatt').onclick = () => editAtt(null);
  $$('[data-att]', box).forEach(b => b.onclick = () => editAtt(G.att.find(x => x.id === b.dataset.att)));
  if (A('sit')) A('sit').onclick = async () => {
    const r = await formSheet(`Situation n° ${G.sit.length + 1}`, [{ name: 'date', label: 'Arrêtée au', type: 'date', value: todayISO() }, { name: 'tva', label: 'TVA (%)', type: 'number', value: p.gsTva || 20 }, { name: 'rg', label: 'Retenue de garantie (%)', type: 'number', value: p.gsRg ?? 7 }, { name: 'ent', label: 'Entreprise', value: p.gsEnt || '' }], { okLabel: 'Créer le PDF' });
    if (!r) return; p.gsTva = gsNum(r.tva); p.gsRg = gsNum(r.rg); p.gsEnt = r.ent;
    const prev = G.sit.length ? G.sit[G.sit.length - 1] : null;
    const rows = G.bpu.map(it => { const c = cum(it.id, r.date), pr = prev ? cum(it.id, prev.date) : 0; return { it, c, pr, m: (c - pr) * gsNum(it.pu), mc: c * gsNum(it.pu) }; });
    const cumHT = rows.reduce((s, x) => s + x.mc, 0), prevHT = prev ? prev.cum : 0, ht = cumHT - prevHT, rg = ht * p.gsRg / 100, tva = (ht - rg) * p.gsTva / 100, ttc = ht - rg + tva;
    const n = G.sit.length + 1, C = newDoc(`Situation n° ${n}`, p), { doc, M, W } = C;
    C.text(`Situation de travaux n° ${n}`, { size: 17, bold: true, gap: 0 }); C.text(`${p.pdfTitle || p.name}${p.mo ? ' · Maître d\'ouvrage : ' + p.mo : ''}${r.ent ? ' · Entreprise : ' + r.ent : ''}`, { size: 10, color: [80, 90, 110] }); C.text(`Arrêtée au ${fmtDate(r.date)}${prev ? ' · précédente au ' + fmtDate(prev.date) : ''}`, { size: 10, color: [80, 90, 110], gap: 4 });
    const cols = [['N°', 12], ['Désignation', 62], ['U', 10], ['PU', 20], ['Q. marché', 18], ['Q. cumul', 18], ['Q. préc.', 18], ['Montant', 24]], rh = 6.2;
    const head = () => { C.need(rh + 2); doc.setFillColor(30, 41, 59); doc.rect(M, C.y, W - 2 * M, rh, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.8); let x = M; cols.forEach(([h, w]) => { doc.text(h, x + 1.5, C.y + 4.2); x += w; }); C.y += rh; };
    head();
    rows.forEach((x, i) => { if (C.y + rh > C.H - 40) { doc.addPage(); C.header(); head(); } if (i % 2) { doc.setFillColor(246, 248, 251); doc.rect(M, C.y, W - 2 * M, rh, 'F'); }
      doc.setTextColor(30); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); let xx = M;
      [x.it.n || '', x.it.des, x.it.u, gsF(gsNum(x.it.pu)), gsF(gsNum(x.it.qm)), gsF(x.c), gsF(x.pr), gsF(x.m)].forEach((v, k) => { doc.text(doc.splitTextToSize(pt(String(v)), cols[k][1] - 2.5)[0] || '', xx + 1.5, C.y + 4.2); xx += cols[k][1]; }); C.y += rh; });
    C.y += 4;
    const line = (l, v, b) => { C.need(7); doc.setFont('helvetica', b ? 'bold' : 'normal'); doc.setFontSize(b ? 11 : 10); doc.setTextColor(20); doc.text(pt(l), W - M - 75, C.y + 4); doc.text(pt(v), W - M, C.y + 4, { align: 'right' }); C.y += 6.5; };
    line('Cumul des travaux HT', gsDH(cumHT)); line('À déduire : situations précédentes', gsDH(prevHT)); line(`Montant de la situation HT`, gsDH(ht), true); line(`Retenue de garantie ${p.gsRg} %`, '- ' + gsDH(rg)); line(`TVA ${p.gsTva} %`, gsDH(tva)); line('Net à payer TTC', gsDH(ttc), true);
    C.y += 10; C.need(26); doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text("L'entreprise", M + 10, C.y); doc.text('Le maître d\'ouvrage / maître d\'œuvre'.replace('œ', 'oe'), W - M - 70, C.y);
    C.finish();
    G.sit.push({ id: DB.uid(), n, date: r.date, cum: cumHT, ht, ttc }); await save();
    await sharePdf(doc, `Situation_${n}_${safeName(p.name)}.pdf`); redraw();
  };
}

// ---------- 🧪 Labo (éprouvettes) · visites BET / BC / topo ----------
function gsLaboTab(box, p, G, save, redraw) {
  const t = todayISO(), add = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const due = []; for (const e of G.pre) for (const [j, k] of [[7, 'r7'], [28, 'r28']]) { const dd = add(e.date, j); if (!gsNum(e[k]) && dd <= add(t, 1)) due.push({ e, j, dd }); }
  const conf = (e) => { const fc = GS_CLASSES[e.cl]; if (!fc || !gsNum(e.r28)) return ''; return gsNum(e.r28) >= fc ? '<i class="ok">✓ conforme</i>' : '<i class="ko">✗ < ' + fc + ' MPa</i>'; };
  box.innerHTML = `
    ${due.length ? `<div class="gs-alert">🧪 <b>Écrasements à faire</b> : ${due.map(x => `${esc(x.e.ouv || 'béton')} · ${x.j} j (${fmtDate(x.dd)})`).join(' · ')}</div>` : ''}
    <div class="gs-h"><b>Prélèvements béton (éprouvettes)</b><button class="btn small" data-a="addpre">${icon('plus')} Prélèvement</button></div>
    ${G.pre.slice().reverse().map(e => `<button class="gs-row" data-pre="${e.id}"><span class="grow"><b>${esc(e.ouv || 'Béton')} · ${esc(e.cl || '')}</b><small>${fmtDate(e.date)} · ${gsNum(e.nb) || '?'} éprouvette(s)${e.slump ? ' · slump ' + esc(e.slump) + ' cm' : ''}${e.lab ? ' · ' + esc(e.lab) : ''}</small></span>
      <span class="gs-lab"><span>7 j : <b>${gsNum(e.r7) ? gsF(gsNum(e.r7), 1) : '—'}</b></span><span>28 j : <b>${gsNum(e.r28) ? gsF(gsNum(e.r28), 1) : '—'}</b></span>${conf(e)}</span></button>`).join('') || '<div class="gs-empty">Notez chaque prélèvement : l\'appli vous rappelle les écrasements à 7 et 28 jours et vérifie la conformité à la classe.</div>'}
    <div class="gs-h"><b>Visites BET · Bureau de contrôle · Topo</b><button class="btn small ghost" data-a="addvis">${icon('plus')} Visite</button></div>
    ${G.vis.slice().reverse().map(v => `<button class="gs-row vis ${v.st === 'ok' ? 'done' : ''}" data-vis="${v.id}"><span class="grow"><b>${esc(v.qui)} · ${esc(v.obj || '')}</b><small>${fmtDate(v.date)}${v.obs ? ' · ' + esc(v.obs.slice(0, 80)) : ''}</small>${v.suite ? `<small class="suite">➜ ${esc(v.suite)}</small>` : ''}</span><i>${v.st === 'ok' ? '✅' : v.suite ? '⏳' : ''}</i></button>`).join('') || '<div class="gs-empty">Notez les passages du BET, du bureau de contrôle, du topographe ou du labo, avec la suite à donner.</div>'}`;
  const editPre = async (e) => {
    const r = await formSheet(e ? 'Prélèvement' : 'Nouveau prélèvement', [{ name: 'date', label: 'Date du coulage', type: 'date', value: e ? e.date : t }, { name: 'ouv', label: 'Ouvrage', value: e ? e.ouv : '', placeholder: 'Ex : Voiles R+2 zone 12' }, { name: 'cl', label: 'Classe', value: e ? e.cl : 'B25', list: Object.keys(GS_CLASSES) },
      { name: 'nb', label: 'Nombre d\'éprouvettes', type: 'number', value: e ? e.nb : 6 }, { name: 'slump', label: 'Affaissement (cm)', type: 'number', value: e ? e.slump : '' }, { name: 'lab', label: 'Laboratoire', value: e ? e.lab : '', list: [...new Set(G.pre.map(x => x.lab).filter(Boolean))] },
      { name: 'r7', label: 'Résultat 7 j (MPa)', type: 'number', value: e ? e.r7 : '' }, { name: 'r28', label: 'Résultat 28 j (MPa)', type: 'number', value: e ? e.r28 : '' }], { okLabel: 'Enregistrer', danger: e ? 'Supprimer' : null });
    if (!r) return; if (r.__danger) G.pre = G.pre.filter(x => x !== e); else if (e) Object.assign(e, r); else G.pre.push({ id: DB.uid(), ...r }); G.pre.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    await save();
    if (!e && r.date) gsLaboNotif(p, r).catch(() => {});
    redraw(); };
  $('[data-a=addpre]', box).onclick = () => editPre(null);
  $$('[data-pre]', box).forEach(b => b.onclick = () => editPre(G.pre.find(x => x.id === b.dataset.pre)));
  const editVis = async (v) => {
    const r = await formSheet(v ? 'Visite' : 'Nouvelle visite', [{ name: 'date', label: 'Date', type: 'date', value: v ? v.date : t }, { name: 'qui', label: 'Qui', type: 'select', value: v ? v.qui : GS_WHO[0], options: GS_WHO }, { name: 'obj', label: 'Objet', value: v ? v.obj : '', placeholder: 'Ex : réception ferraillage R+3, implantation' },
      { name: 'obs', label: 'Observations', type: 'textarea', value: v ? v.obs : '' }, { name: 'suite', label: 'Suite à donner', value: v ? v.suite : '' }, { name: 'st', label: 'Statut', type: 'select', value: v ? v.st || 'w' : 'w', options: [{ value: 'w', label: '⏳ En cours' }, { value: 'ok', label: '✅ Soldé' }] }], { okLabel: 'Enregistrer', danger: v ? 'Supprimer' : null });
    if (!r) return; if (r.__danger) G.vis = G.vis.filter(x => x !== v); else if (v) Object.assign(v, r); else G.vis.push({ id: DB.uid(), ...r }); G.vis.sort((a, b) => (a.date || '').localeCompare(b.date || '')); await save(); redraw(); };
  $('[data-a=addvis]', box).onclick = () => editVis(null);
  $$('[data-vis]', box).forEach(b => b.onclick = () => editVis(G.vis.find(x => x.id === b.dataset.vis)));
}
async function gsLaboNotif(p, e) {
  const LN = window.Capacitor?.Plugins?.LocalNotifications; if (!LN) return;
  const perm = await LN.requestPermissions(); if (perm.display !== 'granted') return;
  try { await LN.createChannel({ id: 'rappels', name: 'Rappels de chantier', importance: 5, visibility: 1, vibration: true }); } catch (x) {}
  const at = (n) => { const d = new Date(e.date + 'T08:00:00'); d.setDate(d.getDate() + n); return d; };
  const base = Math.abs([...(p.id + e.date + (e.ouv || ''))].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % 1e8;
  await LN.schedule({ notifications: [7, 28].filter(n => at(n) > new Date()).map(n => ({ id: 1800000000 + base % 1e8 + n, title: `🧪 Écrasement ${n} jours`, body: `${e.ouv || 'Béton'} (${e.cl || ''}) coulé le ${fmtDate(e.date)} — ${p.name}`, channelId: 'rappels', schedule: { at: at(n), allowWhileIdle: true } })) });
}

// ---------- 📚 Fiches matériaux (listes déroulantes) ----------
const GS_FICHES = {
  'Acier (HA)': { cols: ['Ø', 'Section', 'Poids', 'Barre 12 m'], rows: [6, 8, 10, 12, 14, 16, 20, 25, 32, 40].map(d => { const s = Math.PI * d * d / 4, kg = s * 7.85e-3; return [`HA${d}`, `${gsF(s / 100, 3)} cm²`, `${gsF(kg, 3)} kg/m`, `${gsF(kg * 12, 1)} kg`]; }), note: 'Poids = 0,00617 × Ø² (kg/m). Recouvrement ≈ 40 Ø (FeE400) / 50 Ø (FeE500).' },
  'Ciment': { cols: ['Type', 'Classe', 'Usage courant'], rows: [['CPJ 35', '32,5 MPa', 'Maçonnerie, enduits, béton peu sollicité'], ['CPJ 45', '42,5 MPa', 'Béton armé courant, dallages'], ['CPJ 55', '52,5 MPa', 'Béton à hautes résistances, préfabrication'], ['CPA 55', '52,5 MPa', 'Ouvrages d\'art, décoffrage rapide'], ['CHF / CLK', '—', 'Milieux agressifs (sulfates, mer)']], note: 'Sac de 50 kg ≈ 35 L. Stocker à l\'abri de l\'humidité, sur palettes, ≤ 10 sacs de haut.' },
  'Dosages béton': { cols: ['Usage', 'Ciment', 'Sable', 'Gravier', 'Eau'], rows: [['Béton de propreté', '150–200 kg', '400 L', '800 L', '≈ 100 L'], ['Béton de fondation', '300 kg', '400 L', '800 L', '≈ 150 L'], ['Béton armé courant (B25)', '350 kg', '400 L', '800 L', '≈ 175 L'], ['Béton armé (B30)', '400 kg', '380 L', '800 L', '≈ 180 L'], ['Gros béton', '200–250 kg', '—', 'tout-venant', '—']], note: 'Pour 1 m³ de béton. C\'est la formule du laboratoire / CPS qui fait foi.' },
  'Mortiers': { cols: ['Usage', 'Ciment / m³ de sable', 'Remarque'], rows: [['Maçonnerie agglos', '250–300 kg', 'joints 1 à 1,5 cm'], ['Enduit (gobetis)', '500 kg', 'très fluide, accroche'], ['Enduit (corps)', '350–400 kg', '1,5 à 2 cm'], ['Enduit (finition)', '250–300 kg', 'sable fin'], ['Chape', '300–350 kg', '4 à 6 cm']], note: 'Mouiller les supports avant enduit. Cure pendant 3 jours.' },
  'Agglos / maçonnerie': { cols: ['Élément', 'Dimensions', 'Quantité / m²', 'Mortier / m²'], rows: [['Agglo 10', '10 × 20 × 40 cm', '12,5', '≈ 10 L'], ['Agglo 15', '15 × 20 × 40 cm', '12,5', '≈ 15 L'], ['Agglo 20', '20 × 20 × 40 cm', '12,5', '≈ 20 L'], ['Brique 8 trous', '7 × 20 × 30 cm', '≈ 16', '≈ 12 L'], ['Hourdis 16', '16 × 20 × 53 cm', '≈ 8,3 (entraxe 60)', '—']], note: 'Prévoir 3 à 5 % de casse.' },
  'Granulats': { cols: ['Granulat', 'Densité apparente', 'Usage'], rows: [['Sable 0/4', '≈ 1,5 t/m³', 'béton, mortier'], ['Gravette 8/15', '≈ 1,45 t/m³', 'béton armé'], ['Gravier 15/25', '≈ 1,4 t/m³', 'béton de masse'], ['Tout-venant 0/31,5', '≈ 1,8 t/m³ compacté', 'couches de forme']], note: 'Granulats propres, sans argile ni matières organiques.' },
  'Tolérances (repères)': { cols: ['Ouvrage', 'Tolérance usuelle'], rows: [['Aplomb voiles / poteaux (par étage)', '± 1 cm'], ['Implantation des axes', '± 1 cm'], ['Planéité dalle (règle 2 m)', '≤ 7 mm'], ['Planéité enduit (règle 2 m)', '≤ 5 mm'], ['Planéité carrelage (règle 2 m)', '≤ 3 à 5 mm'], ['Niveau des planchers', '± 1 cm'], ['Enrobage', '0 / + 1 cm']], note: 'Repères de chantier — vérifiez les valeurs du CPS / DTU du marché.' },
};
function gsFichesTab(box) {
  const keys = Object.keys(GS_FICHES); App.gsFiche = App.gsFiche || keys[0];
  const F = GS_FICHES[App.gsFiche] || GS_FICHES[keys[0]];
  box.innerHTML = `<label class="gs-sel">Fiche<select data-a="f">${keys.map(k => `<option ${k === App.gsFiche ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></label>
    ${App.gsFiche === 'Acier (HA)' ? `<div class="gs-calc"><b>Calcul rapide</b><div><select data-c="d">${[6, 8, 10, 12, 14, 16, 20, 25, 32, 40].map(d => `<option value="${d}">HA${d}</option>`).join('')}</select><input data-c="l" type="number" placeholder="longueur totale (m)"><span data-c="r">—</span></div></div>` : ''}
    <div class="gs-tab"><div class="th">${F.cols.map(c => `<span>${esc(c)}</span>`).join('')}</div>${F.rows.map(r => `<div style="grid-template-columns:repeat(${F.cols.length},1fr)">${r.map(c => `<span>${esc(c)}</span>`).join('')}</div>`).join('')}</div>
    <div class="gs-note">${esc(F.note)}</div>`;
  $('.gs-tab .th', box).style.gridTemplateColumns = `repeat(${F.cols.length},1fr)`;
  $('[data-a=f]', box).onchange = (e) => { App.gsFiche = e.target.value; gsFichesTab(box); };
  const cd = $('[data-c=d]', box); if (cd) { const go = () => { const d = +cd.value, l = gsNum($('[data-c=l]', box).value); $('[data-c=r]', box).textContent = l ? `${gsF(0.00617 * d * d * l, 1)} kg · ${Math.ceil(l / 12)} barre(s) de 12 m` : '—'; }; cd.onchange = go; $('[data-c=l]', box).oninput = go; }
}
