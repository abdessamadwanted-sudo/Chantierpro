// Tableau de réception journalier (programme de bétonnage / réception de ferraillage)
const REC_STATUS = {
  ok: { label: 'Réceptionné', short: 'OK', color: '#22c55e', mark: '✅' },
  reserve: { label: 'Avec réserve', short: 'Réserve', color: '#f59e0b', mark: '⚠️' },
  pending: { label: 'Non réceptionné', short: 'En attente', color: '#9aa3b2', mark: '⏳' },
};
const NIVEAUX = ['Fondations', 'SSL', 'Mezz', 'RDC', 'R+1', 'R+2', 'R+3', 'R+4', 'R+5', 'R+6', 'R+7', 'R+8', 'Terrasse'];
const recDateLabel = (d) => d ? d.split('-').reverse().join('/') : '';

// ---------- Réception ferraillage / Programme de bétonnage ----------
const isBeton = (kind) => kind === 'Bétonnage';
const kindOf = (d) => d.type === 'Bétonnage' ? 'Bétonnage' : 'Ferraillage';
const recTitle = (kind) => isBeton(kind) ? 'Programme de bétonnage' : 'Réception ferraillage';
const recColHead = (kind) => isBeton(kind) ? 'Élément bétonné' : 'Ferraillage réceptionné';
const stLabel = (kind, st) => isBeton(kind) ? ({ ok: 'Bétonné', reserve: 'Avec défaut', pending: 'Non bétonné' }[st]) : REC_STATUS[st].label;
const resLabel = (kind) => isBeton(kind) ? 'Défaut' : 'Réserve';                       // ségrégation, nid de cailloux…
const photoLabels = (kind) => isBeton(kind) ? ['Photo défaut', 'Photo réparation'] : ['Photo réserve', 'Photo retour'];
const liftLabel = (kind) => isBeton(kind) ? 'Réparé' : 'Levée';
const pvMissing = (r) => r.element && r.status !== 'pending' && !r.pvRecu;
const pvCell = (r) => r.pvRecu ? '<span class="rs" style="background:#16a34a">Reçu</span>' : r.status !== 'pending' && r.element ? '<span class="rs" style="background:#dc2626">Manquant</span>' : '';
const CLASSES = ['B20', 'B25', 'B30', 'B35', 'B40', 'C25/30', 'C30/37', 'C35/45', 'C40/50'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const monthLabel = (ym) => { const [y, m] = ym.split('-'); return `${MONTHS[+m - 1]} ${y}`; };

// Message WhatsApp d'un seul ouvrage
const zoneKey = (r) => [isNaN(+r.zone) ? 9999 : +r.zone, String(r.zone || ''), String(r.niv || ''), String(r.element || '')];
const cmpZone = (a, b) => { const x = zoneKey(a), y = zoneKey(b); for (let i = 0; i < x.length; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; } return 0; };
// Message WhatsApp (même présentation pour 1 ouvrage, une sélection, une zone ou tout le tableau)
function recMessage(p, day, rows, single = false) {
  const K = kindOf(day);
  rows = rows.filter(r => r.element).slice().sort(cmpZone);
  const item = (r) => `${REC_STATUS[r.status].mark} ${r.niv ? r.niv + ' — ' : ''}${r.element}${isBeton(K) && r.classe ? ` (${r.classe})` : ''}` +
    (r.obs ? `\n     ↳ ${r.status === 'reserve' ? resLabel(K) + ' : ' : ''}${r.obs}` : '') +
    (r.status === 'reserve' && r.liftedAt ? `\n     ✔️ ${isBeton(K) ? 'Réparé' : 'Réserve levée'} le ${fmtDate(r.liftedAt)}` : '');
  const sec = (st, title) => {
    const l = rows.filter(r => r.status === st);
    if (!l.length) return '';
    const zones = [];
    for (const r of l) { const z = String(r.zone || '').trim(); let g = zones.find(x => x.z === z); if (!g) zones.push(g = { z, rows: [] }); g.rows.push(r); }
    return (single ? `\n*${title}*\n` : `\n*${title} (${l.length}) :*\n`) + zones.map(g => `*${g.z ? 'Zone ' + g.z : 'Sans zone'}*\n${g.rows.map(item).join('\n')}`).join('\n\n') + '\n';
  };
  if (single) return `*${recTitle(K)} du ${fmtDate(day.date)}*\n` + sec('ok', isBeton(K) ? 'Bétonnage validé ✅' : 'Réception validée ✅') + sec('reserve', isBeton(K) ? 'Bétonné avec défaut ⚠️' : 'Réception avec réserve ⚠️') + sec('pending', isBeton(K) ? 'Non bétonné ⏳' : 'Non réceptionné ⏳');
  return `*${recTitle(K)} du ${fmtDate(day.date)}*\n` + sec('ok', stLabel(K, 'ok')) + sec('reserve', stLabel(K, 'reserve')) + sec('pending', stLabel(K, 'pending'));
}
const rowText = (p, day, r) => recMessage(p, day, [r], true);
async function shareRow(p, day, r) {
  const text = rowText(p, day, r);
  const P = window.Capacitor?.Plugins || {};
  const ids = [...(r.photoIds || []), ...(r.retourIds || [])].slice(0, 6);
  if (ids.length && P.Share && P.Filesystem) {
    try {
      const files = [];
      for (const id of ids) {
        const f = await DB.get('files', id); if (!f) continue;
        const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(f.blob); });
        const name = `photo_${id}.jpg`;
        await P.Filesystem.writeFile({ path: name, data: b64, directory: 'CACHE' });
        files.push((await P.Filesystem.getUri({ path: name, directory: 'CACHE' })).uri);
      }
      await P.Share.share({ text, files, dialogTitle: 'Envoyer (WhatsApp…)' });
      return;
    } catch (e) { if (/cancel/i.test(String(e?.message))) return; }
  }
  shareWhatsApp(text);
}

// ---- Rappel des PV non reçus
async function missingPvs(pid) {
  const out = [];
  for (const d of await DB.byProject('receptions', pid)) if (kindOf(d) === 'Ferraillage') d.rows.forEach(r => { if (pvMissing(r)) out.push({ d, r }); });
  return out.sort((a, b) => (a.d.date || '').localeCompare(b.d.date || ''));
}
const daysSince = (iso) => Math.max(0, Math.round((new Date(todayISO()) - new Date(iso)) / 864e5));
function goMissingPv() { App.recPv = App.recPv || {}; App.recPv.Ferraillage = true; App.recSearch = {}; App.recNiv = {}; App.section = 'reception'; renderSection(); }
async function pvReminder(p, force) {
  const miss = await missingPvs(p.id);
  if (!miss.length) { if (force) toast('Tous les PV ont été reçus 👍'); return; }
  const key = 'pvRemind_' + p.id;
  try { if (!force && localStorage.getItem(key) === todayISO()) return; localStorage.setItem(key, todayISO()); } catch (e) {}
  const zones = [];
  for (const m of miss) { const z = m.r.zone || '—'; let g = zones.find(x => x.z === z); if (!g) zones.push(g = { z, l: [] }); g.l.push(m); }
  const s = sheet(`<h3>🔔 ${miss.length} PV pas encore reçu(s)</h3>
    <div class="pvrem">${zones.map(g => `<div class="pz">Zone ${esc(g.z)}</div>${g.l.map(({ d, r }) => { const n = daysSince(d.date);
      return `<div class="pr"><div class="grow"><b>${r.niv ? esc(r.niv) + ' — ' : ''}${esc(r.element)}</b><small>Réceptionné le ${fmtDate(d.date)}${r.avec ? ' avec ' + esc(r.avec) : ''}</small></div><span class="age ${n >= 3 ? 'late' : ''}">${n ? n + ' j' : 'auj.'}</span></div>`; }).join('')}`).join('')}</div>
    <div class="btnrow" style="padding:0;margin-top:12px"><button class="btn ghost" data-a="later">Plus tard</button><button class="btn" data-a="see">Voir et cocher</button></div>`);
  $('[data-a=later]', s.el).onclick = () => s.close();
  $('[data-a=see]', s.el).onclick = () => { s.close(); goMissingPv(); };
}

async function sharePhotos(ids, text) {
  const P = window.Capacitor?.Plugins || {};
  if (!(P.Share && P.Filesystem)) { for (const id of ids) { const f = await DB.get('files', id); if (!f) continue; const u = URL.createObjectURL(f.blob); const a = document.createElement('a'); a.href = u; a.download = (f.name || `pv_${id}.jpg`); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); } toast('Photos téléchargées'); return; }
  try {
    const files = [];
    for (const id of ids) {
      const f = await DB.get('files', id); if (!f) continue;
      const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(f.blob); });
      const name = `pv_${id}.jpg`;
      await P.Filesystem.writeFile({ path: name, data: b64, directory: 'CACHE' });
      files.push((await P.Filesystem.getUri({ path: name, directory: 'CACHE' })).uri);
    }
    await P.Share.share({ text, files, dialogTitle: 'Envoyer les PV' });
  } catch (e) { if (!/cancel/i.test(String(e?.message))) alertBox('Envoi impossible : ' + (e.message || e)); }
}

async function renderReceptions(root, kind = 'Ferraillage') {
  const p = App.project;
  const all = (await DB.byProject('receptions', p.id)).filter(d => kindOf(d) === kind).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  App.recSearch = App.recSearch || {}; App.openMonths = App.openMonths || {};
  const q = (App.recSearch[kind] || '').trim().toLowerCase();
  App.recNiv = App.recNiv || {}; const nivF = App.recNiv[kind] || '';
  const nivs = [...new Set(all.flatMap(d => d.rows.map(r => (r.niv || '').trim()).filter(Boolean)))].sort((a, b) => { const ia = NIVEAUX.findIndex(n => n.toLowerCase() === a.toLowerCase()), ib = NIVEAUX.findIndex(n => n.toLowerCase() === b.toLowerCase()); return ((ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)) || a.localeCompare(b); });
  App.recZone = App.recZone || {}; const zoneF = App.recZone[kind] || '';
  const zonesL = [...new Set(all.flatMap(d => d.rows.map(r => String(r.zone || '').trim()).filter(Boolean)))].sort((a, b) => (parseFloat(a) - parseFloat(b)) || a.localeCompare(b));
  const match = (r) => (!nivF || (r.niv || '').trim() === nivF) && (!zoneF || String(r.zone || '').trim() === zoneF);
  App.recPv = App.recPv || {}; const pvF = !isBeton(kind) && App.recPv[kind];
  const nMiss = isBeton(kind) ? 0 : all.reduce((a, d) => a + d.rows.filter(pvMissing).length, 0);
  const tba = $('#tbActions');
  if (tba) tba.innerHTML = `<button class="iconbtn" data-a="sync" title="Google Sheets">${icon('grid')}</button>`;

  root.innerHTML = `<div style="height:8px"></div>
    <div class="search">${icon('search')}<input placeholder="Rechercher un ouvrage (ex : CR 77, voile…)" value="${esc(App.recSearch[kind] || '')}"></div>
    <div class="fbar">
      <button class="fsel ${nivF ? 'on' : ''}" data-f="niv"><small>Niveau</small><b>${esc(nivF || 'Tous')}</b>${icon('chevdown')}</button>
      <button class="fsel ${zoneF ? 'on' : ''}" data-f="zone"><small>Zone</small><b>${esc(zoneF ? 'Zone ' + zoneF : 'Toutes')}</b>${icon('chevdown')}</button>
      ${nivF || zoneF ? `<button class="fclear" data-f="clear" title="Effacer">${icon('close')}</button>` : ''}
    </div>
    ${!isBeton(kind) && (nMiss || pvF) ? `<div class="chips niv"><button class="chip pvchip ${pvF ? 'on' : ''}" data-a="pvf">🔔 PV non reçus <b>${nMiss}</b></button></div>` : ''}
    <div id="recBody"></div>`;
  const pvb = $('[data-a=pvf]', root); if (pvb) pvb.onclick = () => { App.recPv[kind] = !pvF; renderReceptions(root, kind); };
  $$('[data-f]', root).forEach(b => b.onclick = async () => {
    const f = b.dataset.f;
    if (f === 'clear') { App.recNiv[kind] = ''; App.recZone[kind] = ''; return renderReceptions(root, kind); }
    const list = f === 'niv' ? nivs : zonesL, cur = f === 'niv' ? nivF : zoneF;
    const v = await menu(f === 'niv' ? 'Filtrer par niveau' : 'Filtrer par zone', [
      { label: f === 'niv' ? 'Tous les niveaux' : 'Toutes les zones', icon: cur ? 'layers' : 'check', value: '__all' },
      ...list.map(x => ({ label: f === 'niv' ? x : 'Zone ' + x, icon: cur === x ? 'check' : (f === 'niv' ? 'layers' : 'pin'), value: x }))]);
    if (v == null) return;
    (f === 'niv' ? App.recNiv : App.recZone)[kind] = v === '__all' ? '' : v;
    renderReceptions(root, kind);
  });
  const body = $('#recBody', root);

  if (pvF) {
    const hits = [];
    for (const d of all) d.rows.forEach(r => { if (pvMissing(r) && match(r) && (!q || `${r.element} ${r.zone} ${r.niv} ${r.avec}`.toLowerCase().includes(q))) hits.push({ d, r }); });
    body.innerHTML = hits.length ? `<div class="section-label">${hits.length} PV pas encore reçu(s)</div><div class="list">${hits.map(({ d, r }, i) => `
      <div class="row pvrow" data-h="${i}"><div class="grow"><div class="title wrap">${r.zone ? 'Zone ' + esc(r.zone) + ' · ' : ''}${r.niv ? esc(r.niv) + ' — ' : ''}${esc(r.element)}</div>
        <div class="sub">📅 Réceptionné le ${fmtDate(d.date)}${r.avec ? ' · avec ' + esc(r.avec) : ''} · <span style="white-space:nowrap;color:${daysSince(d.date) >= 3 ? '#ef4444' : '#f59e0b'}">${daysSince(d.date) ? 'attente ' + daysSince(d.date) + ' j' : 'aujourd\'hui'}</span></div></div>
        <button class="btn small" data-ok="${i}" style="flex:none">${icon('check')} Reçu</button></div>`).join('')}</div>`
      : `<div class="empty">Tous les PV ont été reçus 👍</div>`;
    $$('[data-h]', body).forEach(el => el.onclick = async (e) => {
      const { d, r } = hits[+el.dataset.h];
      if (e.target.closest('[data-ok]')) { r.pvRecu = true; await DB.put('receptions', d); toast('PV marqué reçu'); return renderReceptions(root, kind); }
      await openReceptionDay(d, { focus: r.id }); renderReceptions(root, kind);
    });
  } else if (q || nivF || zoneF) {
    // Résultats de recherche : où et quand l'ouvrage a été réceptionné
    const hits = [];
    for (const d of all) d.rows.forEach(r => { if (r.element && match(r) && (!q || `${r.element} ${r.zone} ${r.niv} ${r.obs}`.toLowerCase().includes(q))) hits.push({ d, r }); });
    body.innerHTML = hits.length ? `<div class="section-label">${hits.length} résultat(s)</div><div class="list">${hits.map(({ d, r }, i) => `
      <div class="row" data-h="${i}"><span class="rs" style="background:${REC_STATUS[r.status].color};min-width:74px;text-align:center">${stLabel(kind, r.status)}</span>
        <div class="grow"><div class="title wrap">${esc(r.element)}</div>
        <div class="sub">📅 ${fmtDate(d.date)}${r.zone ? ' · Zone ' + esc(r.zone) : ''}${r.niv ? ' · ' + esc(r.niv) : ''}${r.classe ? ' · ' + esc(r.classe) : ''}${r.avec ? ' · avec ' + esc(r.avec) : ''}${!isBeton(kind) && r.status !== 'pending' ? (r.pvRecu ? ' · <span style="color:#22c55e">PV reçu</span>' : ' · <span style="color:#ef4444">PV manquant</span>') : ''}${r.obs ? `<br><span style="color:${r.status === 'reserve' ? '#f59e0b' : 'var(--muted)'}">${esc(r.obs)}</span>` : ''}</div></div>
        <button class="iconbtn" data-sh="${i}">${icon('share')}</button></div>`).join('')}</div>`
      : `<div class="empty">Aucun ouvrage trouvé${q ? ` pour « ${esc(q)} »` : ''}${nivF ? ` au niveau ${esc(nivF)}` : ''}${zoneF ? ` en zone ${esc(zoneF)}` : ''}.</div>`;
    $$('[data-h]', body).forEach(el => el.onclick = async (e) => {
      const { d, r } = hits[+el.dataset.h];
      if (e.target.closest('[data-sh]')) return shareRow(p, d, r);
      await openReceptionDay(d, { focus: r.id }); renderReceptions(root, kind);
    });
  } else if (!all.length) {
    body.innerHTML = `<div class="empty">Aucun tableau pour le moment.<br>Appuyez sur <b>+</b> pour créer le tableau du jour.</div>`;
  } else {
    // Mois repliables → jours
    const months = [...new Set(all.map(d => (d.date || '').slice(0, 7)))];
    const curM = todayISO().slice(0, 7);
    for (const m of months) {
      const key = kind + m;
      if (App.openMonths[key] === undefined) App.openMonths[key] = m === months[0] || m === curM;
      const ds = all.filter(d => (d.date || '').slice(0, 7) === m);
      const nEl = ds.reduce((a, d) => a + d.rows.filter(r => r.element).length, 0), nRs = ds.reduce((a, d) => a + d.rows.filter(r => r.status === 'reserve').length, 0);
      const card = document.createElement('div'); card.className = 'card';
      const open = App.openMonths[key];
      card.innerHTML = `<div class="folder-head"><span class="icon-muted">${icon('calendar')}</span>
        <div class="grow"><div class="title" style="font-size:18px">${monthLabel(m)}</div><div class="sub" style="color:var(--muted);margin-top:3px">${ds.length} jour(s) · ${nEl} élément(s)${nRs ? ` · <span style="color:#f59e0b">${nRs} réserve(s)</span>` : ''}</div></div>
        <span class="icon-muted" style="transform:rotate(${open ? 180 : 0}deg)">${icon('chevdown')}</span></div>
        ${open ? `<div class="plan-rows">${ds.map(d => {
          const n = d.rows.filter(r => r.element).length, ok = d.rows.filter(r => r.status === 'ok').length, rs = d.rows.filter(r => r.status === 'reserve').length;
          return `<div class="prow" data-id="${d.id}"><span class="daybox"><b>${(d.date || '').slice(8, 10)}</b><small>${MONTHS[+(d.date || '0-01').slice(5, 7) - 1].slice(0, 3)}</small></span>
            <div class="nm"><div style="font-size:16px">${fmtDate(d.date)}</div><div style="font-size:13px;color:var(--muted);margin-top:2px">${n} élément(s) · <span style="color:#22c55e">${ok} OK</span>${rs ? ` · <span style="color:#f59e0b">${rs} réserve(s)</span>` : ''}${d.syncedAt ? ' · ☁' : ''}</div></div>${icon('chevright')}</div>`;
        }).join('')}</div>` : ''}`;
      body.appendChild(card);
      $('.folder-head', card).onclick = () => { App.openMonths[key] = !open; renderReceptions(root, kind); };
      $$('.prow[data-id]', card).forEach(r => r.onclick = async () => { await openReceptionDay(ds.find(d => d.id === r.dataset.id)); renderReceptions(root, kind); });
    }
  }
  const inp = $('.search input', root);
  inp.oninput = () => { App.recSearch[kind] = inp.value; clearTimeout(inp._t); inp._t = setTimeout(() => renderReceptions(root, kind).then(() => { const i = $('.search input', root); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 250); };
  $('[data-a=sync]').onclick = () => sheetsSetup();
  fab(root, async () => {
    const t0 = todayISO();
    const pick = await menu(isBeton(kind) ? 'Nouveau programme de bétonnage' : 'Nouveau tableau de réception', [
      { label: `Aujourd'hui (${fmtDate(t0)})`, icon: 'calendar', value: 'today' },
      { label: 'Une date passée…', icon: 'history', value: 'past' },
    ]);
    if (!pick) return;
    let today = t0;
    if (pick === 'past') {
      const r = await formSheet('Choisir la date', [{ name: 'date', label: 'Date du tableau', type: 'date', value: t0 }], { okLabel: 'Créer' });
      if (!r || !r.date) return; today = r.date;
    }
    const existing = all.find(d => d.date === today);
    if (existing) { toast(`Le tableau du ${fmtDate(today)} existe déjà`); await openReceptionDay(existing); return renderReceptions(root, kind); }
    let rows = [];
    const last = all.find(d => (d.date || '') < today);
    if (last && last.rows.some(r => r.status !== 'ok' && r.element)) {
      const v = await menu(`Reprendre les éléments non terminés / avec réserve du ${fmtDate(last.date)} ?`, [
        { label: 'Oui, les reprendre', icon: 'check', value: 'yes' }, { label: 'Non, tableau vide', icon: 'close', value: 'no' }]);
      if (v === 'yes') rows = last.rows.filter(r => r.status !== 'ok' && r.element).map(r => ({ ...r, id: DB.uid(), status: 'pending', photoIds: [], retourIds: [], liftedAt: null, pvRecu: false, obs: r.status === 'reserve' ? `Réserve du ${recDateLabel(last.date).slice(0, 5)} : ${r.obs || ''}` : r.obs }));
    }
    const d = await DB.put('receptions', { projectId: p.id, date: today, type: kind, rows });
    App.openMonths[kind + today.slice(0, 7)] = true;
    await openReceptionDay(d); renderReceptions(root, kind);
  });
}

// ---------- Tableau d'un jour ----------
function openReceptionDay(day, opts = {}) {
  let focusId = opts.focus || null; const hlId = opts.focus || null;   // surlignage gardé jusqu'à la fermeture
  return new Promise(async (resolve) => {
    const p = await DB.get('projects', day.projectId);
    const el = document.createElement('div'); el.className = 'fullpage'; document.body.appendChild(el);
    const save = () => DB.put('receptions', day);
    const finish = async () => { await save(); el.remove(); resolve(); };
    const unBack = pushBack(finish);

    const K = kindOf(day);
    const NC = isBeton(K) ? 9 : 10;
    let NAMES = [];
    DB.byProject('receptions', day.projectId).then(l => { NAMES = [...new Set(l.flatMap(d => d.rows.map(r => (r.avec || '').trim()).filter(Boolean)))]; });
    const [PH1, PH2] = photoLabels(K);
    let moveSel = -1;             // ligne sélectionnée pour la déplacer (appui long)
    function render() {
      const n = day.rows.filter(r => r.element).length, ok = day.rows.filter(r => r.status === 'ok').length, rs = day.rows.filter(r => r.status === 'reserve').length;
      el.innerHTML = `
        <div class="topbar"><button class="iconbtn" data-a="back">${icon('back')}</button>
          <h1>${fmtDate(day.date)}</h1>
          <button class="iconbtn" data-a="share">${icon('share')}</button><button class="iconbtn" data-a="more">${icon('more')}</button></div>
        <div class="rec-sum"><span><b>${n}</b> éléments</span><span style="color:#22c55e"><b>${ok}</b> ${isBeton(K) ? 'bétonnés' : 'réceptionnés'}</span><span style="color:#f59e0b"><b>${rs}</b> ${isBeton(K) ? "défauts" : "réserves"}</span><span style="color:var(--muted)"><b>${n - ok - rs}</b> en attente</span>${!isBeton(K) && day.rows.some(pvMissing) ? `<span style="color:#ef4444"><b>${day.rows.filter(pvMissing).length}</b> PV manquant(s)</span>` : ''}</div>
        <div class="rec-wrap">
          <table class="rec">
            <thead>
              <tr><th colspan="${NC}" class="rt1">${esc(p.pdfTitle || p.name)}</th></tr>
              <tr><th colspan="${NC - 2}" class="rt2">${recTitle(K)} (post jour)</th><th colspan="2" class="rt2 date">Date ${recDateLabel(day.date).slice(0, 5)}</th></tr>
              <tr><th>Zone</th><th>NIV</th><th class="el">${recColHead(K)}</th>${isBeton(K) ? '<th>Classe béton</th>' : ''}<th>Statut</th>${isBeton(K) ? '' : '<th>PV</th><th>Réceptionné avec</th>'}<th class="ob">Observation</th><th>${PH1}</th><th>${PH2}</th><th>Croquis</th></tr>
            </thead>
            <tbody>
              ${day.rows.map((r, i) => `<tr data-i="${i}" class="st-${r.status} ${moveSel === i ? 'moving' : ''}">
                <td class="c">${esc(r.zone)}</td><td class="c">${esc(r.niv)}</td><td class="el">${esc(r.element)}</td>${isBeton(K) ? `<td class="c">${esc(r.classe || '')}</td>` : ''}
                <td class="c"><span class="rs" style="background:${REC_STATUS[r.status].color}">${r.status === 'ok' ? 'OK' : r.status === 'reserve' ? resLabel(K) : 'Attente'}</span>${r.status === 'reserve' && r.liftedAt ? `<br><span class="rs" style="background:#16a34a;margin-top:4px">${liftLabel(K)} ${recDateLabel(r.liftedAt).slice(0, 5)}</span>` : ''}</td>
${isBeton(K) ? '' : `<td class="c">${pvCell(r)}</td><td class="c">${esc(r.avec || '')}</td>`}
                <td class="ob">${esc(r.obs)}</td>
                <td class="c ph">${(r.photoIds || []).length ? `📷 ${r.photoIds.length}` : ''}</td>
                <td class="c ph">${(r.retourIds || []).length ? `📷 ${r.retourIds.length}` : ''}</td>
                <td class="c ph sk">${r.croquisId ? `<img data-sk="${r.croquisId}" alt="✏️">` : ''}</td></tr>`).join('')}
              <tr class="addrow"><td colspan="${NC}"><button data-a="add">${icon('plus')} Ajouter une ligne</button><span class="hint-lp">Appui long sur une ligne pour la déplacer</span></td></tr>
            </tbody>
          </table>
          <div class="pv-day">
            <div class="pv-h">${icon('report')} PV du jour <span>${(day.pvIds || []).length || ''}</span></div>
            <div class="thumbs" id="pvThumbs"></div>
          </div>
        </div>
        ${moveSel >= 0 ? `<div class="movebar"><span>Déplacer la ligne ${moveSel + 1}</span>
          <button data-mv="top" title="Tout en haut">⤒</button><button data-mv="up">▲</button><button data-mv="down">▼</button><button data-mv="bottom" title="Tout en bas">⤓</button>
          <button data-mv="done" class="ok">${icon('check')}</button></div>` : ''}`;
      // PV du jour
      (async () => {
        const pvs = await loadFiles(day.pvIds || []);
        const box = $('#pvThumbs', el); if (!box) return;
        box.innerHTML = pvs.map(f => `<div class="t" data-pv="${f.id}"><img src="${BlobURL.get(f.id, f.blob)}"><button class="x" data-pvdel="${f.id}">×</button></div>`).join('') + `<button class="t add" data-a="addpv">${icon('camera')}</button>`;
        $('[data-a=addpv]', box).onclick = async () => {
          const recs = await addPhotos(day.projectId, { source: `PV ${recTitle(K)} ${recDateLabel(day.date)}` });
          if (recs.length) { day.pvIds = [...(day.pvIds || []), ...recs.map(x => x.id)]; await save(); render(); }
        };
        $$('[data-pv]', box).forEach(t => t.onclick = async (e) => {
          const id = t.dataset.pv;
          if (e.target.closest('[data-pvdel]')) { if (await confirmBox('Retirer ce PV ?')) { day.pvIds = day.pvIds.filter(x => x !== id); await DB.del('files', id); await save(); render(); } return; }
          const f = pvs.find(x => x.id === id); showImage(BlobURL.get(f.id, f.blob), `PV du ${fmtDate(day.date)}`);
        });
      })();
      $('[data-a=back]', el).onclick = () => { unBack(); finish(); };
      $('[data-a=add]', el).onclick = () => editRow(null);
      $$('img[data-sk]', el).forEach(async im => { const f = await DB.get('files', im.dataset.sk); if (f && f.blob) im.src = BlobURL.get(f.id, f.blob); });
      if (hlId) {
        const fi = day.rows.findIndex(x => x.id === hlId);
        const ftr = fi >= 0 && $(`tbody tr[data-i="${fi}"]`, el);
        if (ftr) { ftr.classList.add('hl'); if (focusId) { ftr.classList.add('flash'); setTimeout(() => ftr.scrollIntoView({ block: 'center', inline: 'nearest' }), 60); } }
        focusId = null;
      }
      $$('tbody tr[data-i]', el).forEach(tr => {
        let t = null, lp = false;
        tr.addEventListener('pointerdown', () => { lp = false; clearTimeout(t); t = setTimeout(() => { lp = true; moveSel = +tr.dataset.i; try { navigator.vibrate && navigator.vibrate(25); } catch (e) {} render(); }, 500); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => tr.addEventListener(ev, () => clearTimeout(t)));
        tr.addEventListener('pointermove', (e) => { if (Math.abs(e.movementY) + Math.abs(e.movementX) > 3) clearTimeout(t); });
        tr.onclick = () => { if (lp) return; if (moveSel >= 0) { moveSel = +tr.dataset.i; return render(); } editRow(+tr.dataset.i); };
      });
      $$('[data-mv]', el).forEach(b => b.onclick = async () => {
        const v = b.dataset.mv, i = moveSel, R = day.rows;
        if (v === 'done') { moveSel = -1; await save(); return render(); }
        const j = v === 'up' ? i - 1 : v === 'down' ? i + 1 : v === 'top' ? 0 : R.length - 1;
        if (j < 0 || j >= R.length || j === i) return;
        const [row] = R.splice(i, 1); R.splice(j, 0, row); moveSel = j; await save(); render();
        const tr = $(`tbody tr[data-i="${j}"]`, el); tr && tr.scrollIntoView({ block: 'nearest' });
      });
      $('[data-a=share]', el).onclick = async () => {
        const v = await menu('Partager', [
          { label: 'Texte WhatsApp (tout le tableau)', icon: 'share', value: 'txt' },
          { label: 'Une zone…', icon: 'share', value: 'zone' },
          { label: 'Choisir des ouvrages…', icon: 'check', value: 'pick' },
          { label: 'PDF du tableau', icon: 'report', value: 'pdf' },
          ...((day.pvIds || []).length ? [{ label: `Envoyer les PV du jour (${day.pvIds.length})`, icon: 'camera', value: 'pv' }] : []),
          { label: 'Fichier Excel (CSV)', icon: 'grid', value: 'csv' },
          { label: 'Envoyer vers Google Sheets (Drive)', icon: 'drive', value: 'sheets' },
        ]);
        if (v === 'txt') shareWhatsApp(receptionText(p, day));
        if (v === 'zone') {
          const zones = [...new Set(day.rows.filter(r => r.element).map(r => r.zone || ''))].sort((x, y) => (+x || 9999) - (+y || 9999));
          const z = await menu('Quelle zone ?', zones.map(zz => ({ label: zz ? `Zone ${zz}` : 'Sans zone', value: zz || '__none' })));
          if (z !== null && z !== undefined) shareWhatsApp(recMessage(p, day, day.rows.filter(r => (r.zone || '__none') === z)));
        }
        if (v === 'pick') {
          const rows = day.rows.filter(r => r.element).slice().sort(cmpZone);
          const sel = new Set();
          const sh = sheet(`<div>${rows.map((r, j) => `<label class="selrow"><input type="checkbox" data-j="${j}"><span>${REC_STATUS[r.status].mark} ${esc([r.zone && 'Zone ' + r.zone, r.niv].filter(Boolean).join(' · '))} — ${esc(r.element)}</span></label>`).join('')}</div>
            <div class="btnrow"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="s">${icon('share')} Envoyer</button></div>`, { title: 'Choisir les ouvrages' });
          $$('[data-j]', sh.el).forEach(cb => cb.onchange = () => cb.checked ? sel.add(+cb.dataset.j) : sel.delete(+cb.dataset.j));
          $('[data-a=c]', sh.el).onclick = () => sh.close();
          $('[data-a=s]', sh.el).onclick = () => { if (!sel.size) return toast('Cochez au moins un ouvrage'); sh.close(); shareWhatsApp(recMessage(p, day, [...sel].map(j => rows[j]))); };
        }
        if (v === 'pdf') receptionPdf(p, day);
        if (v === 'pv') sharePhotos(day.pvIds, `PV — ${recTitle(K)} du ${fmtDate(day.date)}`);
        if (v === 'csv') receptionCsv(p, day);
        if (v === 'sheets') { await save(); await sendToSheets(p, day); render(); }
      };
      $('[data-a=more]', el).onclick = async () => {
        const v = await menu('Tableau', [
          { label: 'Changer la date', icon: 'calendar', value: 'date' },
          { label: 'Supprimer ce tableau', icon: 'trash', danger: true, value: 'del' },
        ]);
        if (v === 'date') { const r = await formSheet('Date', [{ name: 'date', label: 'Date', type: 'date', value: day.date }]); if (r && r.date) { day.date = r.date; await save(); render(); } }
        if (v === 'del' && await confirmBox('Supprimer ce tableau ?')) {
          for (const r of day.rows) for (const id of [...(r.photoIds || []), ...(r.retourIds || [])]) await DB.del('files', id);
          for (const id of day.pvIds || []) await DB.del('files', id);
          await DB.del('receptions', day.id); unBack(); el.remove(); resolve();
        }
      };
    }

    // Éditeur d'une ligne
    function editRow(i) {
      const isNew = i === null;
      const last = day.rows[day.rows.length - 1] || {};
      const r = isNew ? { id: DB.uid(), zone: last.zone || '', niv: last.niv || '', element: '', classe: last.classe || '', avec: last.avec || '', pvRecu: false, status: 'ok', obs: '', photoIds: [], retourIds: [] } : { ...day.rows[i], photoIds: [...(day.rows[i].photoIds || [])], retourIds: [...(day.rows[i].retourIds || [])] };
      const s = sheet(`<div class="form" id="rowf"></div>`, { title: isNew ? 'Nouvelle ligne' : 'Modifier la ligne' });
      const f = $('#rowf', s.el);
      async function draw() {
        const photos = await loadFiles(r.photoIds), retours = await loadFiles(r.retourIds);
        const thumbs = (list, sec) => `<div class="thumbs">${list.map(f => `<div class="t" data-id="${f.id}" data-sec="${sec}"><img src="${BlobURL.get(f.id, f.blob)}"><button class="x" data-del="${f.id}">×</button></div>`).join('')}<button class="t add" data-add="${sec}">${icon('camera')}</button></div>`;
        f.innerHTML = `
          <div class="kv"><label>Zone<input name="zone" value="${esc(r.zone)}" inputmode="numeric" placeholder="11"></label>
            <label>Niveau<input name="niv" list="dl-niv" value="${esc(r.niv)}" placeholder="R+5"></label></div>
          <datalist id="dl-niv">${NIVEAUX.map(n => `<option value="${n}">`).join('')}</datalist>
          <label>Élément<input name="element" value="${esc(r.element)}" placeholder="Ex : Voile CR 77 Axe D2"></label>
          ${isBeton(K) ? `<label>Classe béton<input name="classe" list="dl-classe" value="${esc(r.classe || '')}" placeholder="Ex : B30"></label><datalist id="dl-classe">${CLASSES.map(c => `<option value="${c}">`).join('')}</datalist>` : ''}
          <div class="fld">Statut<div class="seg seg3">${Object.entries(REC_STATUS).map(([k, v]) => `<button type="button" data-st="${k}" class="${r.status === k ? 'on' : ''}" style="${r.status === k ? `background:${v.color}` : ''}">${stLabel(K, k)}</button>`).join('')}</div></div>
          ${isBeton(K) ? '' : `<div class="fld">PV<div class="seg"><button type="button" data-pvr="1" class="${r.pvRecu ? 'on' : ''}" style="${r.pvRecu ? 'background:#16a34a' : ''}">PV reçu</button><button type="button" data-pvr="0" class="${!r.pvRecu ? 'on' : ''}" style="${!r.pvRecu ? 'background:#dc2626' : ''}">Pas encore</button></div></div>
          <label>Réceptionné avec<input name="avec" list="dl-avec" value="${esc(r.avec || '')}" placeholder="Nom (ex : M. Alaoui — BET)"></label><datalist id="dl-avec">${NAMES.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`}
          <label>Observation ${r.status === 'reserve' ? '/ ' + resLabel(K).toLowerCase() : ''}<textarea name="obs" style="min-height:64px" placeholder="${r.status === 'reserve' ? (isBeton(K) ? 'Ex : ségrégation en pied de voile, nid de cailloux…' : 'Ex : cales manquantes côté axe D2') : 'Optionnel'}">${esc(r.obs)}</textarea></label>
          <div class="fld">${r.status === 'reserve' ? (isBeton(K) ? 'Photos du défaut (ségrégation…)' : 'Photos de la réserve') : 'Photos'}</div>${thumbs(photos, 'photoIds')}
          ${r.status === 'reserve' || r.retourIds.length ? `<div class="retour-box">
            <div class="fld">${isBeton(K) ? 'Photos de la réparation' : 'Photos du retour (levée de réserve)'}</div>${thumbs(retours, 'retourIds')}
            ${r.status === 'reserve' ? `<button type="button" class="btn ${r.liftedAt ? 'ghost' : ''} small" data-a="lift" style="align-self:flex-start;margin-top:8px">${icon('check')} ${r.liftedAt ? `${isBeton(K) ? 'Réparé' : 'Réserve levée'} le ${recDateLabel(r.liftedAt)} (annuler)` : (isBeton(K) ? 'Marquer comme réparé' : 'Marquer la réserve levée')}</button>` : ''}
          </div>` : ''}
          <div class="fld">Croquis ${isBeton(K) ? '(partie bétonnée en couleur)' : '(partie réceptionnée en couleur)'}</div>
          <div class="sk-row">${r.croquisId ? `<img class="sk-thumb" data-a="skview">` : ''}<button type="button" class="btn ghost small" data-a="sketch">${icon('pen')} ${r.croquisId ? 'Modifier le croquis' : 'Dessiner un croquis'}</button>${r.croquisId ? `<button type="button" class="btn ghost small" data-a="skdel" style="flex:none">${icon('trash')}</button>` : ''}</div>
          <div class="btnrow" style="padding:0">${!isNew ? `<button class="btn danger" data-a="del" style="flex:none;padding:14px 16px">${icon('trash')}</button>` : ''}
            <button class="btn ghost" data-a="cancel">Annuler</button><button class="btn" data-a="ok">${isNew ? 'Ajouter' : 'Enregistrer'}</button></div>
          ${isNew ? `<button class="btn ghost" data-a="okmore" style="margin-top:-4px">Ajouter et ligne suivante</button>` : `<button class="btn ghost" data-a="wa" style="margin-top:-4px">${icon('share')} Envoyer cet ouvrage (WhatsApp)</button>`}`;
        $$('[name]', f).forEach(inp => inp.oninput = () => { r[inp.name] = inp.value; });
        $$('[data-st]', f).forEach(b => b.onclick = () => { r.status = b.dataset.st; draw(); });
        $$('[data-pvr]', f).forEach(b => b.onclick = () => { r.pvRecu = b.dataset.pvr === '1'; draw(); });
        $$('[data-add]', f).forEach(b => b.onclick = async (e) => {
          e.preventDefault(); const sec = b.dataset.add;
          const recs = await addPhotos(day.projectId, { source: `${sec === 'retourIds' ? 'Retour' : 'Réception'} ${recDateLabel(day.date)} · ${r.element || ''}` });
          if (recs.length) {
            r[sec].push(...recs.map(x => x.id));
            if (sec === 'retourIds' && r.status === 'reserve' && !r.liftedAt && await confirmBox(isBeton(K) ? 'Marquer comme réparé aujourd\'hui ?' : 'Marquer la réserve comme levée aujourd\'hui ?', isBeton(K) ? 'Oui, réparé' : 'Oui, réserve levée')) r.liftedAt = todayISO();
            draw();
          }
        });
        if (r.croquisId) { const cf = await DB.get('files', r.croquisId); const ti = $('.sk-thumb', f); if (cf && ti) { ti.src = BlobURL.get(cf.id, cf.blob); ti.onclick = () => showImage(ti.src, `Croquis · ${r.element}`); } }
        $('[data-a=sketch]', f).onclick = async () => {
          const res = await openSketch({ title: `Croquis · ${r.element || 'ouvrage'}`, data: r.croquis || null, projectId: day.projectId });
          if (!res) return;
          if (r.croquisId) { await DB.del('files', r.croquisId); BlobURL.drop(r.croquisId); }
          const rec = await DB.put('files', { projectId: day.projectId, blob: res.blob, mime: 'image/jpeg', role: 'croquis', name: `croquis ${r.element || ''}.jpg`, w: SKW, h: SKH });
          r.croquisId = rec.id; r.croquis = res.data; draw();
        };
        const skd = $('[data-a=skdel]', f); if (skd) skd.onclick = async () => { if (await confirmBox('Supprimer le croquis ?')) { await DB.del('files', r.croquisId); r.croquisId = null; r.croquis = null; draw(); } };
        const lift = $('[data-a=lift]', f); if (lift) lift.onclick = () => { r.liftedAt = r.liftedAt ? null : todayISO(); draw(); };
        $$('.thumbs .t[data-id]', f).forEach(t => t.onclick = async (e) => {
          const id = t.dataset.id, sec = t.dataset.sec;
          if (e.target.closest('[data-del]')) { e.preventDefault(); r[sec] = r[sec].filter(x => x !== id); draw(); return; }
          const ph = [...photos, ...retours].find(x => x.id === id); showImage(BlobURL.get(ph.id, ph.blob), `${sec === 'retourIds' ? 'Retour' : 'Réserve'} · ${r.element}`);
        });
        const commit = async () => {
          if (!r.element.trim()) { toast('Écrivez l\'élément'); return false; }
          if (isNew) day.rows.push(r); else day.rows[i] = r;
          await save(); return true;
        };
        $('[data-a=cancel]', f).onclick = () => s.close();
        $('[data-a=ok]', f).onclick = async () => { if (await commit()) { s.close(); render(); } };
        const om = $('[data-a=okmore]', f); if (om) om.onclick = async () => { if (await commit()) { s.close(); render(); editRow(null); } };
        const wa = $('[data-a=wa]', f); if (wa) wa.onclick = async () => { if (await commit()) shareRow(p, day, r); };
        const del = $('[data-a=del]', f); if (del) del.onclick = async () => { if (await confirmBox('Supprimer cette ligne ?')) { day.rows.splice(i, 1); await save(); s.close(); render(); } };
        if (isNew && !r.element) setTimeout(() => $('[name=element]', f)?.focus(), 250);
      }
      draw();
    }
    render();
  });
}

// ---------- Exports ----------
function receptionText(p, day) { return recMessage(p, day, day.rows); }

async function receptionPdf(p, day) {
  const ld = loading('Création du PDF…');
  try {
    const K = kindOf(day);
    const R = newDoc(recTitle(K), p, { plain: true }); const { doc, M, W } = R;
    // bandeau titre façon tableau
    doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.3);
    if (p.pdfTitle) {
      doc.rect(M, R.y, W - 2 * M, 10); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 20, 20);
      doc.text(pt(p.pdfTitle), W / 2, R.y + 6.8, { align: 'center' }); R.y += 10;
    }
    doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 20, 20);
    doc.setFillColor(201, 218, 248); doc.rect(M, R.y, W - 2 * M, 8, 'FD');
    doc.setFontSize(10); doc.text(pt(`${recTitle(K)} (post jour)`), M + 3, R.y + 5.5);
    doc.setTextColor(220, 30, 30); doc.setFontSize(12); doc.text(`Date ${recDateLabel(day.date)}`, W - M - 3, R.y + 5.8, { align: 'right' }); R.y += 8;
    // en-têtes
    const cols = isBeton(K)
      ? [{ t: 'Zone', w: 13 }, { t: 'NIV', w: 15 }, { t: recColHead(K), w: 64 }, { t: 'Classe', w: 16 }, { t: 'Statut', w: 26 }, { t: 'Observation', w: W - 2 * M - 134 }]
      : [{ t: 'Zone', w: 12 }, { t: 'NIV', w: 14 }, { t: recColHead(K), w: 58 }, { t: 'Statut', w: 25 }, { t: 'PV', w: 15 }, { t: 'Avec', w: 26 }, { t: 'Observation', w: W - 2 * M - 150 }];
    const cx = []; { let x = M; cols.forEach(c => { cx.push(x); x += c.w; }); }
    const iSt = cols.findIndex(c => c.t === 'Statut'), iOb = cols.length - 1;
    const head = () => {
      doc.setFillColor(201, 218, 248); doc.rect(M, R.y, W - 2 * M, 8, 'FD');
      doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      let x = M; cols.forEach(c => { doc.text(pt(c.t), x + c.w / 2, R.y + 5.4, { align: 'center' }); x += c.w; doc.line(x, R.y, x, R.y + 8); });
      R.y += 8;
    };
    head();
    const rows = day.rows.filter(r => r.element);
    for (const r of rows) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const el = doc.splitTextToSize(pt(r.element), cols[2].w - 3), ob = doc.splitTextToSize(pt(r.obs || ''), cols[iOb].w - 3);
      const h = Math.max(8, Math.max(el.length, ob.length, isBeton(K) ? 1 : doc.splitTextToSize(pt(r.avec || ""), 23).length) * 4.4 + 3.5);
      if (R.y + h > 297 - 18) { doc.addPage(); R.header(); head(); }
      if (r.status === 'reserve') { doc.setFillColor(255, 243, 224); doc.rect(M, R.y, W - 2 * M, h, 'F'); }
      doc.rect(M, R.y, W - 2 * M, h);
      let x = M; cols.forEach(c => { x += c.w; doc.line(x, R.y, x, R.y + h); });
      doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold');
      doc.text(pt(r.zone || ''), M + cols[0].w / 2, R.y + 5.5, { align: 'center' });
      doc.text(pt(r.niv || ''), M + cols[0].w + cols[1].w / 2, R.y + 5.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      el.forEach((l, j) => doc.text(l, M + cols[0].w + cols[1].w + 1.5, R.y + 5.5 + j * 4.4));
      if (!isBeton(K)) {
        const iPv = cols.findIndex(c => c.t === 'PV'), iAv = iPv + 1;
        doc.setFont('helvetica', 'bold'); if (r.pvRecu) doc.setTextColor(22, 163, 74); else if (r.status !== 'pending') doc.setTextColor(220, 38, 38);
        doc.text(r.pvRecu ? 'Reçu' : r.status !== 'pending' ? 'Manquant' : '', cx[iPv] + cols[iPv].w / 2, R.y + 5.5, { align: 'center' }); doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'normal');
        doc.splitTextToSize(pt(r.avec || ''), cols[iAv].w - 3).forEach((l, j) => doc.text(l, cx[iAv] + 1.5, R.y + 5.5 + j * 4.4));
      }
      if (isBeton(K)) { doc.setFont('helvetica', 'bold'); doc.text(pt(r.classe || ''), cx[3] + cols[3].w / 2, R.y + 5.5, { align: 'center' }); }
      const st = REC_STATUS[r.status], c = hexRGB(st.color);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...c);
      doc.text(pt(stLabel(K, r.status)), cx[iSt] + cols[iSt].w / 2, R.y + 5.5, { align: 'center' });
      if (r.status === 'reserve' && r.liftedAt) { doc.setTextColor(22, 163, 74); doc.text(pt(`${liftLabel(K)} le ${recDateLabel(r.liftedAt).slice(0, 5)}`), cx[iSt] + cols[iSt].w / 2, R.y + 9.6, { align: 'center' }); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(r.status === 'reserve' ? 190 : 60, r.status === 'reserve' ? 90 : 60, r.status === 'reserve' ? 0 : 60);
      ob.forEach((l, j) => doc.text(l, cx[iOb] + 1.5, R.y + 5.5 + j * 4.4));
      R.y += h;
    }
    R.y += 5;
    const ok = rows.filter(r => r.status === 'ok').length, rs = rows.filter(r => r.status === 'reserve').length;
    R.text(`Total : ${rows.length} élément(s) · ${ok} ${stLabel(K, 'ok').toLowerCase()}(s) · ${rs} ${stLabel(K, 'reserve').toLowerCase()} · ${rows.length - ok - rs} ${stLabel(K, 'pending').toLowerCase()}(s)`, { size: 10, bold: true, gap: 4 });
    // photos
    const withPh = rows.filter(r => (r.photoIds || []).length || (r.retourIds || []).length || r.croquisId);
    if (withPh.length) {
      R.text('Photos', { size: 12, bold: true, gap: 2 });
      for (const r of withPh) {
        R.text(`${r.zone ? 'Zone ' + r.zone + ' · ' : ''}${r.niv ? r.niv + ' · ' : ''}${r.element}`, { size: 9.5, bold: true, gap: 1 });
        for (const [lab, ids, good] of [[r.status === 'reserve' ? photoLabels(K)[0] : 'Photos', r.photoIds || [], false], [photoLabels(K)[1], r.retourIds || [], true], ['Croquis', r.croquisId ? [r.croquisId] : [], true]]) {
        if (!ids.length) continue;
        R.text(lab, { size: 8.5, color: good ? [22, 163, 74] : [200, 90, 0], gap: 0.5 });
        let x = M; const bh = 50; R.need(bh + 3);
        for (const id of ids.slice(0, 4)) {
          const f = await DB.get('files', id); if (!f) continue;
          const im = await blobToJpegURL(f.blob, 700);
          let w = im.w * (bh / im.h), h = bh; if (w > 85) { w = 85; h = im.h * (85 / im.w); }
          if (x + w > W - M) { R.y += bh + 3; x = M; R.need(bh + 3); }
          doc.addImage(im.url, 'JPEG', x, R.y, w, h); x += w + 3;
        }
        R.y += bh + 5;
        }
      }
    }
    // PV du jour
    if ((day.pvIds || []).length) {
      doc.addPage(); R.header();
      R.text(`PV du jour — ${fmtDate(day.date)}`, { size: 13, bold: true, gap: 3 });
      for (const id of day.pvIds) {
        const f = await DB.get('files', id); if (!f) continue;
        const im = await blobToJpegURL(f.blob, 1400);
        const maxW = W - 2 * M, maxH = 250; const k = Math.min(maxW / im.w, maxH / im.h);
        R.need(im.h * k + 4); doc.addImage(im.url, 'JPEG', M + (maxW - im.w * k) / 2, R.y, im.w * k, im.h * k); R.y += im.h * k + 6;
      }
    }
    R.finish();
    await sharePdf(doc, `${safeName(recTitle(K))}_${day.date}.pdf`);
  } catch (e) { console.error(e); alertBox('Erreur PDF : ' + (e.message || e)); }
  finally { ld.close(); }
}

async function receptionCsv(p, day) {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const K = kindOf(day);
  const B = isBeton(K);
  const lines = [[p.pdfTitle || p.name], [recTitle(K), '', '', '', `Date ${recDateLabel(day.date)}`], ['Zone', 'NIV', recColHead(K), ...(B ? ['Classe béton'] : []), 'Statut', ...(B ? [] : ['PV', 'Réceptionné avec']), 'Observation'],
    ...day.rows.filter(r => r.element).map(r => [r.zone, r.niv, r.element, ...(B ? [r.classe || ''] : []), stLabel(K, r.status) + (r.status === 'reserve' && r.liftedAt ? ` (${liftLabel(K).toLowerCase()} ${recDateLabel(r.liftedAt)})` : ''), ...(B ? [] : [r.pvRecu ? 'Reçu' : r.status !== 'pending' ? 'Manquant' : '', r.avec || '']), r.obs])];
  const csv = '﻿' + lines.map(l => l.map(q).join(';')).join('\r\n');
  const fname = `${safeName(recTitle(K))}_${day.date}.csv`;
  const P = window.Capacitor?.Plugins || {};
  if (P.Filesystem && P.Share) {
    await P.Filesystem.writeFile({ path: fname, data: csv, directory: 'CACHE', encoding: 'utf8' });
    const { uri } = await P.Filesystem.getUri({ path: fname, directory: 'CACHE' });
    try { await P.Share.share({ title: fname, files: [uri], dialogTitle: 'Envoyer le tableau' }); } catch (e) {}
  } else {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = fname; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

// ---------- Synchronisation Google Sheets (Drive) ----------
function sheetsScript(sheetId) {
  return `// Chantier → Google Sheets : à coller dans script.google.com
const SHEET_ID = '${sheetId || 'COLLER_ICI_L_ID_DU_FICHIER'}';
function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.openById(SHEET_ID);
  // 1 onglet par jour (ex : "09-10 Ferraillage"), réécrit à chaque envoi
  const sh = ss.getSheetByName(d.sheet) || ss.insertSheet(d.sheet);
  sh.clear();
  sh.getRange(1, 1, 1, 5).merge().setValue(d.project).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(2, 1, 1, 4).merge().setValue(d.title).setBackground('#c9daf8').setFontWeight('bold');
  sh.getRange(2, 5).setValue('Date ' + d.dateLabel).setFontColor('#e00000').setFontWeight('bold').setBackground('#c9daf8');
  sh.getRange(3, 1, 1, 5).setValues([d.head]).setBackground('#c9daf8').setFontWeight('bold').setHorizontalAlignment('center');
  if (d.rows.length) sh.getRange(4, 1, d.rows.length, 5).setValues(d.rows).setVerticalAlignment('middle').setWrap(true);
  sh.getRange(3, 1, d.rows.length + 1, 5).setBorder(true, true, true, true, true, true);
  sh.setColumnWidth(3, 380); sh.setColumnWidth(5, 220);
  // historique de toutes les lignes
  const h = ss.getSheetByName('Historique') || ss.insertSheet('Historique');
  if (h.getLastRow() === 0) h.appendRow(['Date', 'Type', 'Zone', 'NIV', 'Élément', 'Statut', 'Observation']);
  const old = h.getDataRange().getValues();
  for (let i = old.length - 1; i >= 1; i--) if (old[i][0] === d.dateLabel && old[i][1] === d.type) h.deleteRow(i + 1);
  d.rows.forEach(r => h.appendRow([d.dateLabel, d.type, r[0], r[1], r[2], r[3], r[4]]));
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}`;
}
const sheetIdFrom = (url) => (String(url || '').match(/\/spreadsheets\/d\/([\w-]{20,})/) || String(url || '').match(/\/d\/([\w-]{20,})/) || [])[1] || '';

async function sheetsSetup() {
  const p = await DB.get('projects', App.project.id);
  const rec = (p.quickLinks || []).find(q => q.id === 'reception');
  const sid = sheetIdFrom(rec && rec.url);
  const s = sheet(`<div class="form">
    <div class="muted" style="font-size:14px;line-height:1.6">
      Pour remplir automatiquement votre fichier Google Sheets (Drive) depuis l'application :<br>
      <b>1.</b> Le fichier doit être au format <b>Google Sheets</b> (si c'est un .xlsx : Fichier → Enregistrer au format Google Sheets).<br>
      <b>2.</b> Ouvrez <b>script.google.com</b> dans Chrome (mode ordinateur) → <b>Nouveau projet</b>.<br>
      <b>3.</b> Effacez tout et collez le code (bouton Copier ci-dessous)${sid ? '' : ', puis remplacez COLLER_ICI_L_ID_DU_FICHIER par l\'ID du fichier (la partie après /d/ dans le lien)'}.<br>
      <b>4.</b> <b>Déployer → Nouveau déploiement → Application Web</b> · Exécuter en tant que : <b>Moi</b> · Accès : <b>Tout le monde</b> → Autoriser.<br>
      <b>5.</b> Copiez l'<b>URL de l'application Web</b> et collez-la ici.
    </div>
    <button class="btn ghost" data-a="copy">${icon('file')} Copier le code du script</button>
    <label>URL de l'application Web (Apps Script)<input name="url" type="url" value="${esc(p.sheetsUrl || '')}" placeholder="https://script.google.com/macros/s/…/exec"></label>
    <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="cancel">Fermer</button><button class="btn" data-a="ok">Enregistrer</button></div>
  </div>`, { title: 'Liaison Google Sheets' });
  $('[data-a=copy]', s.el).onclick = async () => {
    const code = sheetsScript(sid);
    try { await navigator.clipboard.writeText(code); toast('Code copié ✓'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Code copié ✓'); }
  };
  $('[data-a=cancel]', s.el).onclick = () => s.close();
  $('[data-a=ok]', s.el).onclick = async () => { p.sheetsUrl = $('[name=url]', s.el).value.trim(); await DB.put('projects', p); App.project = p; s.close(); toast(p.sheetsUrl ? 'Liaison enregistrée ✓' : 'Liaison supprimée'); };
}

async function sendToSheets(p0, day) {
  const p = await DB.get('projects', p0.id);
  if (!p.sheetsUrl) { toast('Configurez d\'abord la liaison Google Sheets'); return sheetsSetup(); }
  const payload = {
    project: p.name, type: kindOf(day), dateLabel: recDateLabel(day.date),
    sheet: `${recDateLabel(day.date).slice(0, 5).replace('/', '-')} ${isBeton(kindOf(day)) ? 'Bétonnage' : 'Ferraillage'}`,
    title: recTitle(kindOf(day)) + ' (post jour)',
    head: ['Zone', 'NIV', recColHead(kindOf(day)), 'Statut', 'Observation'],
    rows: day.rows.filter(r => r.element).map(r => [r.zone || '', r.niv || '', r.element + (isBeton(kindOf(day)) && r.classe ? ` (${r.classe})` : ''), stLabel(kindOf(day), r.status), r.obs || '']),
  };
  const ld = loading('Envoi vers Google Sheets…');
  try {
    const http = window.Capacitor?.Plugins?.CapacitorHttp;
    if (http) {
      const res = await http.post({ url: p.sheetsUrl, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, data: JSON.stringify(payload) });
      if (res.status >= 400) throw new Error('Erreur ' + res.status + ' (vérifiez l\'accès « Tout le monde »)');
    } else {
      await fetch(p.sheetsUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    }
    day.syncedAt = Date.now(); await DB.put('receptions', day);
    toast('Envoyé vers Google Sheets ✓');
  } catch (e) { console.error(e); alertBox('Envoi impossible : ' + (e.message || e) + '\nVérifiez internet et l\'URL du script.'); }
  finally { ld.close(); }
}
