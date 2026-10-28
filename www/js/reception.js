// Tableau de réception journalier (programme de bétonnage / réception de ferraillage)
const REC_STATUS = {
  ok: { label: 'Réceptionné', short: 'OK', color: '#22c55e', mark: '✅' },
  reserve: { label: 'Avec réserve', short: 'Réserve', color: '#f59e0b', mark: '⚠️' },
  pending: { label: 'Non réceptionné', short: 'En attente', color: '#9aa3b2', mark: '⏳' },
  progress: { label: 'En cours', short: 'En cours', color: '#3b82f6', mark: '🔄' },       // bétonnage en cours
};
const NIVEAUX = ['Fondations', 'SSL', 'Mezz', 'RDC', 'R+1', 'R+2', 'R+3', 'R+4', 'R+5', 'R+6', 'R+7', 'R+8', 'Terrasse'];
const recDateLabel = (d) => d ? d.split('-').reverse().join('/') : '';

// ---------- Réception ferraillage / Programme de bétonnage ----------
const isBeton = (kind) => kind === 'Bétonnage';
const kindOf = (d) => d.type === 'Bétonnage' ? 'Bétonnage' : 'Ferraillage';
const recTitle = (kind) => isBeton(kind) ? 'Programme de bétonnage' : 'Réception ferraillage';
const recColHead = (kind) => isBeton(kind) ? 'Élément bétonné' : 'Ferraillage réceptionné';
const stLabel = (kind, st) => isBeton(kind) ? ({ ok: 'Bétonné', progress: 'En cours', reserve: 'Avec défaut', pending: 'Non bétonné' }[st]) : (REC_STATUS[st] || REC_STATUS.pending).label;
const statusesFor = (kind) => isBeton(kind) ? ['ok', 'progress', 'pending'] : ['ok', 'reserve', 'pending'];
// lignes à mettre dans les rapports : en bétonnage, uniquement bétonné + en cours (le « non bétonné » n'apparaît pas)
const reportRows = (kind, rows) => rows.filter(r => r.element && (!isBeton(kind) || r.status !== 'pending'));
const resLabel = (kind) => isBeton(kind) ? 'Défaut' : 'Réserve';                       // ségrégation, nid de cailloux…
const photoLabels = (kind) => isBeton(kind) ? ['Photo défaut', 'Photo réparation'] : ['Photo réserve', 'Photo retour'];
const liftLabel = (kind) => isBeton(kind) ? 'Réparé' : 'Levée';
const pvMissing = (r) => r.element && r.status !== 'pending' && !r.pvRecu && !r.pvExist;
const pvToBet = (r) => (r.pvRecu || r.pvExist) && !r.pvLivre;
const pvBet = (r) => (r.pvRecu || r.pvExist) ? (r.pvLivre ? '<br><small class="bet ok">BET ✓</small>' : '<br><small class="bet no">à livrer BET</small>') : '';
const pvRec = (r) => !!(r.pvRecu || r.pvExist);
// PV : deux marques indépendantes — « Non reçu → Reçu » (récupéré) et « Non livré → Livré » (remis au BET) ; on touche pour basculer
const pvCell = (r, i) => r.element && r.status !== 'pending' ? `<div class="pvq"><button class="pvq-b ${pvRec(r) ? 'ok' : 'no'}" data-pvq="${i}|r">${pvRec(r) ? 'Reçu ✓' : 'Non reçu'}</button><button class="pvq-b ${r.pvLivre ? 'ok' : 'nl'}" data-pvq="${i}|l">${r.pvLivre ? 'Livré ✓' : 'Non livré'}</button></div>` : '';
const CLASSES = ['B20', 'B25', 'B30', 'B35', 'B40', 'C25/30', 'C30/37', 'C35/45', 'C40/50'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const monthLabel = (ym) => { const [y, m] = ym.split('-'); return `${MONTHS[+m - 1]} ${y}`; };

// Message WhatsApp d'un seul ouvrage
const zoneKey = (r) => [isNaN(+r.zone) ? 9999 : +r.zone, String(r.zone || ''), String(r.niv || ''), String(r.element || '')];
const cmpZone = (a, b) => { const x = zoneKey(a), y = zoneKey(b); for (let i = 0; i < x.length; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; } return 0; };
// Message WhatsApp (même présentation pour 1 ouvrage, une sélection, une zone ou tout le tableau)
const nivRank = (n) => { const i = NIVEAUX.findIndex(x => x.toLowerCase() === String(n || '').trim().toLowerCase()); if (i >= 0) return i; const m = String(n || '').match(/R\s*\+\s*(\d+)/i); return m ? 4 + +m[1] : 999; };
function recMessage(p, day, rows, single = false) {
  const K = kindOf(day), B = isBeton(K);
  rows = reportRows(K, rows).slice().sort(cmpZone);
  // ligne d'un ouvrage : ✅ en réception, • en bétonnage
  const item = (r) => `${B ? '•' : (REC_STATUS[r.status] || REC_STATUS.pending).mark} ${r.element}${B && r.classe ? ` (${r.classe})` : ''}` +
    (r.obs ? `\n     ↳ ${r.status === 'reserve' ? resLabel(K) + ' : ' : ''}${r.obs}` : '') +
    (B && r.status === 'progress' && !/en cours/i.test(r.obs || '') ? `\n     ↳ En cours` : '') +
    (r.status === 'reserve' && r.liftedAt ? `\n     ✔️ ${B ? 'Réparé' : 'Réserve levée'} le ${fmtDate(r.liftedAt)}` : '');
  // Zone → *niveau* (gras) → ouvrages
  const block = (l) => {
    const zs = []; for (const r of l) { const z = String(r.zone || '').trim(); let g = zs.find(x => x.z === z); if (!g) zs.push(g = { z, rows: [] }); g.rows.push(r); }
    return zs.map(g => {
      const nv = []; for (const r of g.rows) { const n = String(r.niv || '').trim(); let h = nv.find(x => x.n === n); if (!h) nv.push(h = { n, rows: [] }); h.rows.push(r); }
      nv.sort((a, b2) => nivRank(a.n) - nivRank(b2.n));
      return `*${g.z ? 'Zone ' + g.z : 'Sans zone'}*\n` + nv.map(h => (h.n ? `*${h.n}*\n` : '') + h.rows.map(item).join('\n')).join('\n');
    }).join('\n\n');
  };
  const head = `*${recTitle(K)} du ${fmtDate(day.date)}*\n`;
  if (B) return head + (rows.length ? '\n' + block(rows) + '\n' : '');
  const sec = (st, title) => { const l = rows.filter(r => r.status === st); return l.length ? (title ? `\n*${title} :*\n` : '\n') + block(l) + '\n' : ''; };
  if (single) return head + sec('ok', '') + sec('reserve', 'Réception avec réserve ⚠️') + sec('pending', 'Non réceptionné ⏳');
  return head + sec('ok', '') + sec('reserve', 'Avec réserve') + sec('pending', 'Non réceptionné');
}
const rowText = (p, day, r) => recMessage(p, day, [r], true);
async function shareRow(p, day, r) {
  const text = rowText(p, day, r);
  const ids = [...(r.photoIds || []), ...(r.anomIds || []), ...(r.retourIds || []), ...(r.croquisId ? [r.croquisId] : [])].slice(0, 10);
  if (!ids.length) return shareWhatsApp(text);
  return sharePhotos(ids, text, r.element || 'ouvrage');
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

// envoi des photos (+ texte) : les photos libérées du téléphone sont reprises dans Drive avant l'envoi
async function sharePhotos(ids, text, base = 'pv') {
  const P = window.Capacitor?.Plugins || {};
  const ld = ids.length > 1 ? loading('Préparation des photos…') : null;
  const recs = []; let miss = 0;
  try { for (const id of ids) { const f = await DB.get('files', id); if (f && f.blob) recs.push(f); else miss++; } } finally { ld && ld.close(); }
  if (!recs.length) { await alertBox(`Les photos ne sont pas sur le téléphone${miss ? ` (${miss} dans Google Drive)` : ''}.\nConnectez-vous à internet puis réessayez : elles seront reprises automatiquement.`); return text ? shareWhatsApp(text) : null; }
  if (miss) toast(`${miss} photo(s) introuvable(s) — envoi des ${recs.length} autres`);
  if (!(P.Share && P.Filesystem)) { for (const f of recs) { const u = URL.createObjectURL(f.blob); const a = document.createElement('a'); a.href = u; a.download = (f.name || `${base}.jpg`); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); } toast('Photos téléchargées'); return; }
  try {
    const files = [];
    for (const f of recs) {
      const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(f.blob); });
      const ext = /png/.test(f.mime || f.blob.type || '') ? 'png' : /pdf/.test(f.mime || f.blob.type || '') ? 'pdf' : 'jpg';
      const name = `${safeName(base)}_${files.length + 1}.${ext}`;
      await P.Filesystem.writeFile({ path: name, data: b64, directory: 'CACHE' });
      files.push((await P.Filesystem.getUri({ path: name, directory: 'CACHE' })).uri);
    }
    if (text) { try { await navigator.clipboard.writeText(text); } catch (e) {} }   // WhatsApp garde parfois seulement les photos : le texte est aussi copié (coller en légende)
    await P.Share.share({ text: text || undefined, files, dialogTitle: 'Envoyer (WhatsApp…)' });
  } catch (e) { if (!/cancel/i.test(String(e?.message))) alertBox('Envoi impossible : ' + (e.message || e)); }
}

async function renderReceptions(root, kind = 'Ferraillage') {
  const p = App.project;
  // v1.0.34 : PV de réception réservés au service Qualité (bibliothèque du service) ; les autres gardent le programme de bétonnage
  const noRec = typeof Team !== 'undefined' && Team.svcLib && Team.svcLib() && !Team.canSection('reception');
  if (noRec && kind === 'Ferraillage') { kind = 'Bétonnage'; App.section = 'beton'; }
  if (kind === 'Ferraillage') { try { const n = await carryPending(p.id); if (n) { const u = carryPending.undo; toast(`↪ ${n} ouvrage(s) non réceptionné(s) reporté(s) au lendemain`, { action: 'Annuler', onAction: async () => { await u(); toast('Report annulé ✓'); renderSection(); } }); } } catch (e) { console.warn('report', e); } }
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

  const nPvAll = nMiss;
  root.innerHTML = `<div class="kseg ${noRec ? 'solo' : ''}"><button class="${!isBeton(kind) ? 'on' : ''}" data-k="reception" ${noRec ? 'hidden' : ''}>${icon('layers')} Réception${nPvAll ? ` <i>${nPvAll}</i>` : ''}</button><button class="${isBeton(kind) ? 'on' : ''}" data-k="beton">${icon('calendar')} Bétonnage</button></div>
    ${isBeton(kind) ? decofBanner(p, all) : ''}
    <div class="search">${icon('search')}<input placeholder="Rechercher un ouvrage (ex : CR 77, voile…)" value="${esc(App.recSearch[kind] || '')}"></div>
    <div class="fbar">
      <button class="fsel ${nivF ? 'on' : ''}" data-f="niv"><small>Niveau</small><b>${esc(nivF || 'Tous')}</b>${icon('chevdown')}</button>
      <button class="fsel ${zoneF ? 'on' : ''}" data-f="zone"><small>Zone</small><b>${esc(zoneF ? 'Zone ' + zoneF : 'Toutes')}</b>${icon('chevdown')}</button>
      ${nivF || zoneF ? `<button class="fclear" data-f="clear" title="Effacer">${icon('close')}</button>` : ''}
    </div>
    ${!isBeton(kind) && (nMiss || pvF) ? `<div class="chips niv"><button class="chip pvchip ${pvF ? 'on' : ''}" data-a="pvf">🔔 PV non reçus <b>${nMiss}</b></button></div>` : ''}
    <div id="recBody"></div>`;
  $$('.kseg [data-k]', root).forEach(b => b.onclick = () => { if (App.section !== b.dataset.k) { App.section = b.dataset.k; renderSection(); } });
  // barre de partage unique (suit le tableau choisi)
  const sb = document.createElement('div'); sb.className = 'sharebar';
  sb.innerHTML = `<button data-sb>${icon('share')} Partager ${isBeton(kind) ? 'le bétonnage' : 'la réception'}…</button>`;
  root.appendChild(sb);
  $('[data-sb]', sb).onclick = async () => {
    if (!all.length) return toast('Aucun tableau');
    const d = await menu('Quel jour ?', all.slice(0, 12).map(x => ({ label: `${fmtDate(x.date)} · ${x.rows.filter(r => r.element).length} élément(s)`, icon: 'calendar', value: x.id })));
    if (d) shareDayMenu(p, all.find(x => x.id === d));
  };
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
    for (const d of all) d.rows.forEach(r => { if (pvMissing(r) && match(r) && (!q || fuzzyHas(`${r.element} ${r.zone} ${r.niv} ${r.avec}`, q))) hits.push({ d, r }); });
    // regroupés par jour de réception, repliables
    const days = []; for (const h of hits) { let g = days.find(x => x.d.id === h.d.id); if (!g) days.push(g = { d: h.d, l: [] }); g.l.push(h); }
    App.pvOpen = App.pvOpen || {};
    if (days.length && !Object.keys(App.pvOpen).length) App.pvOpen[days[0].d.id] = true;
    body.innerHTML = hits.length ? `<div class="section-label">${hits.length} PV pas encore reçu(s) · ${days.length} jour(s)</div>
      ${days.map(g => { const open = !!App.pvOpen[g.d.id], n = daysSince(g.d.date);
        return `<div class="pvday ${open ? 'open' : ''}">
          <button class="pvday-h" data-day="${g.d.id}"><span class="daybox"><b>${(g.d.date || '').slice(8, 10)}</b><small>${MONTHS[+(g.d.date || '0-01').slice(5, 7) - 1].slice(0, 3)}</small></span>
            <div class="grow"><div class="t">${fmtDate(g.d.date)}</div><div class="s">${g.l.length} PV à récupérer · <span style="color:${n >= 3 ? '#ef4444' : '#f59e0b'}">${n ? 'attente ' + n + ' j' : 'aujourd\'hui'}</span></div></div>
            <span class="pvday-n">${g.l.length}</span><span class="chev">${icon('chevdown')}</span></button>
          ${open ? `<div class="pvday-b">${g.l.map(({ r }) => { const i = hits.findIndex(h => h.r === r);
            return `<div class="row pvrow" data-h="${i}"><div class="grow"><div class="title wrap">${r.zone ? 'Zone ' + esc(r.zone) + ' · ' : ''}${r.niv ? esc(r.niv) + ' — ' : ''}${esc(r.element)}</div>
              ${r.avec ? `<div class="sub">avec ${esc(r.avec)}</div>` : ''}</div>
              <button class="btn small" data-ok="${i}" style="flex:none">${icon('check')} Reçu</button></div>`; }).join('')}
            ${g.l.length > 1 ? `<button class="pvday-all" data-allday="${g.d.id}">${icon('check')} Tous les PV du ${fmtDate(g.d.date)} reçus</button>` : ''}</div>` : ''}
        </div>`; }).join('')}`
      : `<div class="empty">Tous les PV ont été reçus 👍</div>`;
    $$('[data-day]', body).forEach(h => h.onclick = () => { const id = h.dataset.day; App.pvOpen[id] = !App.pvOpen[id]; renderReceptions(root, kind); });
    $$('[data-allday]', body).forEach(btn => btn.onclick = async () => {
      const g = days.find(x => x.d.id === btn.dataset.allday);
      if (!await confirmBox(`Marquer les ${g.l.length} PV du ${fmtDate(g.d.date)} comme reçus ?`, 'Oui, reçus')) return;
      g.l.forEach(({ r }) => { r.pvRecu = true; }); await DB.put('receptions', g.d); toast('PV marqués reçus'); renderReceptions(root, kind);
    });
    $$('[data-h]', body).forEach(el => el.onclick = async (e) => {
      const { d, r } = hits[+el.dataset.h];
      if (e.target.closest('[data-ok]')) { r.pvRecu = true; await DB.put('receptions', d); toast('PV marqué reçu'); return renderReceptions(root, kind); }
      await openReceptionDay(d, { focus: r.id }); renderReceptions(root, kind);
    });
  } else if (q || nivF || zoneF) {
    // Résultats de recherche : où et quand l'ouvrage a été réceptionné
    const hits = [];
    for (const d of all) d.rows.forEach(r => { if (r.element && match(r) && (!q || fuzzyHas(`${r.element} ${r.zone} ${r.niv} ${r.obs}`, q))) hits.push({ d, r }); });
    body.innerHTML = hits.length ? `<div class="section-label">${hits.length} résultat(s)</div><div class="list">${hits.map(({ d, r }, i) => `
      <div class="row" data-h="${i}"><span class="rs" style="background:${(REC_STATUS[r.status] || REC_STATUS.pending).color};min-width:74px;text-align:center">${stLabel(kind, r.status)}</span>
        <div class="grow"><div class="title wrap">${esc(r.element)}</div>
        <div class="sub">📅 ${fmtDate(d.date)}${r.zone ? ' · Zone ' + esc(r.zone) : ''}${r.niv ? ' · ' + esc(r.niv) : ''}${r.classe ? ' · ' + esc(r.classe) : ''}${r.avec ? ' · avec ' + esc(r.avec) : ''}${!isBeton(kind) && r.status !== 'pending' ? (r.pvRecu ? ' · <span style="color:#22c55e">PV reçu</span>' : ' · <span style="color:#ef4444">PV manquant</span>') : ''}${r.obs ? `<br><span style="color:${r.status === 'reserve' ? '#f59e0b' : 'var(--muted)'}">${esc(r.obs)}</span>` : ''}</div></div>
${!isBeton(kind) ? `<button class="btn ghost small cp-bet" data-cp="${i}" title="Copier vers le bétonnage">→ Béton</button>` : ''}</div>`).join('')}</div>`
      : `<div class="empty">Aucun ouvrage trouvé${q ? ` pour « ${esc(q)} »` : ''}${nivF ? ` au niveau ${esc(nivF)}` : ''}${zoneF ? ` en zone ${esc(zoneF)}` : ''}.</div>`;
    $$('[data-h]', body).forEach(el => el.onclick = async (e) => {
      const { d, r } = hits[+el.dataset.h];
      if (e.target.closest('[data-cp]')) { e.stopPropagation(); return copyToBeton(d.projectId, [r]); }
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
      const nEl = ds.reduce((a, d) => a + d.rows.filter(r => r.element).length, 0), nRs = ds.reduce((a, d) => a + d.rows.filter(r => r.status === (isBeton(kind) ? 'progress' : 'reserve')).length, 0);
      const card = document.createElement('div'); card.className = 'card mcard';
      const open = App.openMonths[key];
      const mPv = isBeton(kind) ? 0 : ds.reduce((a, d) => a + d.rows.filter(pvMissing).length, 0);
      card.innerHTML = `<div class="folder-head"><span class="fh-ic">${icon('calendar')}</span>
        <div class="grow"><div class="title">${monthLabel(m)}</div><div class="sub">${mPv ? `<span class="mpv">🔔 ${mPv} PV</span> · ` : ''}${ds.length} jour(s) · ${nEl} élément(s)${nRs ? ` · <span style="color:${isBeton(kind) ? '#3b82f6' : '#f59e0b'}">${nRs} ${isBeton(kind) ? 'en cours' : 'réserve(s)'}</span>` : ''}</div></div>
        <span class="fh-chev" style="transform:rotate(${open ? 180 : 0}deg)">${icon('chevdown')}</span></div>
        ${open ? `<div class="plan-rows">${ds.map(d => {
          const n = d.rows.filter(r => r.element).length, ok = d.rows.filter(r => r.status === 'ok').length, rs = d.rows.filter(r => r.status === (isBeton(kind) ? 'progress' : 'reserve')).length, np = d.rows.filter(pvMissing).length;
          const tag = isBeton(kind) ? `<span style="color:#15803d">${ok} bétonné(s)</span>` : np ? `<span class="tpv">🔔 ${np} PV non reçu${np > 1 ? 's' : ''}</span>` : (ok ? '<span class="tok">✓ PV complets</span>' : '');
          return `<div class="prow" data-id="${d.id}"><span class="daybox"><b>${(d.date || '').slice(8, 10)}</b><small>${MONTHS[+(d.date || '0-01').slice(5, 7) - 1].slice(0, 3)}</small></span>
            <div class="nm"><div style="font-size:16px">${fmtDate(d.date)}</div><div style="font-size:13px;color:var(--muted);margin-top:2px">${n} élément(s)${tag ? ' · ' + tag : ''}${rs ? ` · <span style="color:${isBeton(kind) ? '#3b82f6' : '#f59e0b'}">${rs} ${isBeton(kind) ? 'en cours' : 'réserve(s)'}</span>` : ''}${d.syncedAt ? ' · ☁' : ''}</div></div>${icon('chevright')}</div>`;
        }).join('')}</div>` : ''}`;
      body.appendChild(card);
      $('.folder-head', card).onclick = () => { App.openMonths[key] = !open; renderReceptions(root, kind); };
      $$('.prow[data-id]', card).forEach(r => r.onclick = async () => { await openReceptionDay(ds.find(d => d.id === r.dataset.id)); renderReceptions(root, kind); });
    }
  }
  const dcb = $('[data-a=decof]', root); if (dcb) dcb.onclick = async () => { await openDecof(p); renderReceptions(root, kind); };
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
// ---------- Corbeille (30 jours) : lignes et tableaux supprimés ----------
async function trashPut(projectId, item) {
  const p = await DB.get('projects', projectId); if (!p) return;
  p.trash = (p.trash || []).filter(x => Date.now() - x.t < 30 * 864e5); p.trash.unshift({ id: DB.uid(), t: Date.now(), ...item }); p.trash = p.trash.slice(0, 300);
  await DB.put('projects', p); if (App.project && App.project.id === p.id) App.project.trash = p.trash;
}
async function openTrash(projectId) {
  const p = await DB.get('projects', projectId); const L = (p.trash || []).filter(x => Date.now() - x.t < 30 * 864e5);
  if (!L.length) return toast('La corbeille est vide');
  const lab = (x) => x.kind === 'row' ? `Ligne · ${x.row.niv ? x.row.niv + ' · ' : ''}${x.row.element || '—'} (tableau du ${fmtDate(x.date)})` : `Tableau ${x.day.type === 'Bétonnage' ? 'de bétonnage' : 'de réception'} du ${fmtDate(x.day.date)} · ${x.day.rows.length} ligne(s)`;
  const id = await menu(`Corbeille · ${L.length} élément(s) · 30 jours`, L.map(x => ({ label: `${lab(x)} — supprimé le ${new Date(x.t).toLocaleDateString('fr-FR')}`, icon: 'undo', value: x.id })));
  const x = L.find(y => y.id === id); if (!x) return;
  if (!await confirmBox(`Restaurer ?\n${lab(x)}`, 'Restaurer')) return;
  if (x.kind === 'row') { let d = await DB.get('receptions', x.dayId); if (!d) d = await DB.put('receptions', { projectId, date: x.date, type: x.type || 'Ferraillage', rows: [] }); d.rows.splice(Math.min(x.idx ?? d.rows.length, d.rows.length), 0, x.row); await DB.put('receptions', d); }
  else { const ex = await DB.get('receptions', x.day.id); if (ex) { ex.rows.push(...x.day.rows); await DB.put('receptions', ex); } else await DB.putRaw('receptions', x.day); }
  p.trash = (p.trash || []).filter(y => y.id !== x.id); await DB.put('projects', p);
  toast('Restauré ✓'); if (App.section === 'reception' || App.section === 'beton') renderSection();
}

// ouvrages du tableau de réception non réceptionnés un jour passé → reportés au lendemain (marqués « ✗ Reporté »)
const _nextISO = (d) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); };
async function carryPending(projectId) {
  const today = todayISO(); let moved = 0; const snap = new Map(), created = [];
  const keep = (d) => { if (!snap.has(d.id)) snap.set(d.id, JSON.parse(JSON.stringify(d))); };
  for (let pass = 0; pass < 10; pass++) {
    const all = (await DB.byProject('receptions', projectId)).filter(d => kindOf(d) === 'Ferraillage');
    const src = all.filter(d => d.date && d.date < today && d.rows.some(r => r.element && r.status === 'pending' && !r.noCarry)).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!src) break;
    const nd = _nextISO(src.date), take = src.rows.filter(r => r.element && r.status === 'pending' && !r.noCarry);
    keep(src); let dst = all.find(d => d.date === nd); if (dst) keep(dst); else { dst = await DB.put('receptions', { projectId, date: nd, type: 'Ferraillage', rows: [] }); created.push(dst.id); }
    for (const r of take) { if (!dst.rows.some(x => normQ(`${x.niv}|${x.element}`) === normQ(`${r.niv}|${r.element}`))) dst.rows.push({ ...r, id: DB.uid(), repFrom: r.repFrom || src.date }); moved++; }
    src.rows = src.rows.filter(r => !take.includes(r));
    await DB.put('receptions', dst); await DB.put('receptions', src);
  }
  carryPending.undo = moved ? async () => {   // remettre comme avant (et ne plus reporter ces ouvrages automatiquement)
    for (const id of created) await DB.del('receptions', id);
    for (const [id, d] of snap) { if (created.includes(id)) continue; d.rows.forEach(r => { if (r.element && r.status === 'pending') r.noCarry = true; }); await DB.put('receptions', d); }
  } : null;
  return moved;
}
function openReceptionDay(day, opts = {}) {
  let focusId = opts.focus || null; const hlId = opts.focus || null;   // surlignage gardé jusqu'à la fermeture
  return new Promise(async (resolve) => {
    const p = await DB.get('projects', day.projectId);
    const el = document.createElement('div'); el.className = 'fullpage'; document.body.appendChild(el);
    const save = () => DB.put('receptions', day);
    const finish = async () => { await save(); el.remove(); resolve(); };
    const unBack = pushBack(finish);

    const K = kindOf(day);
    if (isBeton(K)) el.classList.add('rec-compact');
    { let RZ = 1; try { RZ = Math.max(.55, Math.min(1.6, +localStorage.getItem('rec.zoom') || 1)); } catch (e) {} el.style.setProperty('--rz', RZ); let pz = null;
      const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
      el.addEventListener('touchstart', (e) => { const w = e.target.closest && e.target.closest('.rec-wrap'); if (e.touches.length === 2 && w) pz = { d: dist(e.touches), z: RZ, w }; }, { passive: true });
      el.addEventListener('touchmove', (e) => { if (!pz || e.touches.length !== 2) return; e.preventDefault();
        const nz = Math.max(.55, Math.min(1.6, pz.z * dist(e.touches) / pz.d)), k = nz / RZ; if (Math.abs(k - 1) < .004) return;
        const R = pz.w.getBoundingClientRect(), mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - R.left, my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - R.top;
        RZ = nz; el.style.setProperty('--rz', RZ.toFixed(3)); pz.w.scrollLeft = (pz.w.scrollLeft + mx) * k - mx; pz.w.scrollTop = (pz.w.scrollTop + my) * k - my; }, { passive: false });
      el.addEventListener('touchend', (e) => { if (pz && e.touches.length < 2) { pz = null; try { localStorage.setItem('rec.zoom', RZ.toFixed(3)); } catch (er) {} } }); }
    const NC = isBeton(K) ? 10 : 12;
    let NAMES = [];
    DB.byProject('receptions', day.projectId).then(l => { NAMES = [...new Set(l.flatMap(d => d.rows.map(r => (r.avec || '').trim()).filter(Boolean)))]; });
    const [PH1, PH2] = photoLabels(K);
    // Fusionne les photos des PV du jour en un seul PDF (une page A4 par photo)
    // PDF du jour : les photos (déjà en JPEG) sont copiées telles quelles dans le PDF → rapide, sans réencodage
    async function mergePv() {
      const PDFLib = await needPdfLib(), doc = await PDFLib.PDFDocument.create(); let n = 0;
      for (const id of day.pvIds || []) {
        const f = await DB.get('files', id); if (!f || !f.blob) continue;
        let img; try { img = /png/i.test(f.mime || '') ? await doc.embedPng(await f.blob.arrayBuffer()) : await doc.embedJpg(await f.blob.arrayBuffer()); } catch (e) { const j = await blobToJpegURL(f.blob, 2000); img = await doc.embedJpg(await (await fetch(j.url)).arrayBuffer()); }
        const land = img.width > img.height, W = land ? 841.89 : 595.28, H = land ? 595.28 : 841.89, m = 17, k = Math.min((W - 2 * m) / img.width, (H - 2 * m) / img.height);
        doc.addPage([W, H]).drawImage(img, { x: (W - img.width * k) / 2, y: (H - img.height * k) / 2, width: img.width * k, height: img.height * k }); n++;
      }
      const old = day.pvPdfId;
      if (!n) { if (old) { await DB.del('files', old).catch(() => {}); day.pvPdfId = null; } return; }
      const rec = await DB.put('files', { projectId: day.projectId, blob: new Blob([await doc.save()], { type: 'application/pdf' }), mime: 'application/pdf', role: 'pvpdf', name: `PV du ${day.date}.pdf` });
      day.pvPdfId = rec.id; if (old && old !== rec.id) await DB.del('files', old).catch(() => {});
    }
    // en arrière-plan, une seule à la fois (l'écran ne bloque plus)
    let pvQ = Promise.resolve();
    const mergeSoon = () => (pvQ = pvQ.then(() => mergePv()).then(() => save()).catch(e => console.warn('pdf PV', e)));
    let moveSel = -1;             // ligne sélectionnée pour la déplacer (appui long)
    let selId = hlId || null;      // ouvrage touché (surligné)
    // jours voisins (même type) pour passer d'un jour à l'autre
    let SIBS = [];
    let ALLD = [];
    const loadSibs = async () => { ALLD = await DB.byProject('receptions', day.projectId); SIBS = ALLD.filter(d => kindOf(d) === K).sort((a, b) => (a.date || '').localeCompare(b.date || '')); };
    const otherKind = () => ALLD.find(d => d.date === day.date && kindOf(d) !== K);
    const sib = (dir) => { const i = SIBS.findIndex(d => d.id === day.id); return i < 0 ? null : SIBS[i + dir] || null; };
    async function goDay(dir) {
      const d2 = sib(dir); if (!d2) return toast(dir < 0 ? 'Premier jour' : 'Dernier jour');
      await save(); day = (await DB.get('receptions', d2.id)) || d2; moveSel = -1; resetScroll = true;
      el.classList.remove('slide-l', 'slide-r'); void el.offsetWidth; el.classList.add(dir > 0 ? 'slide-l' : 'slide-r');
      render();
    }
    if (!isBeton(K)) { try { const n = await carryPending(day.projectId); if (n) { day = (await DB.get('receptions', day.id)) || day; const u = carryPending.undo; toast(`↪ ${n} ouvrage(s) reporté(s) au lendemain`, { action: 'Annuler', onAction: async () => { await u(); day = (await DB.get('receptions', day.id)) || day; await loadSibs(); render(); toast('Report annulé ✓'); } }); } } catch (e) { console.warn('report', e); } }
    await loadSibs();
    // ↶ / ↷ : historique des modifications du tableau (comme sur ordinateur)
    let hist = [], hpos = -1, histDay = null;
    const snapJ = () => JSON.stringify({ rows: day.rows, pvIds: day.pvIds || [] });
    const track = () => { if (histDay !== day.id) { hist = []; hpos = -1; histDay = day.id; } const j = snapJ(); if (hist[hpos] === j) return; hist = hist.slice(0, hpos + 1); hist.push(j); if (hist.length > 60) hist.shift(); hpos = hist.length - 1; };
    const restore = async (j) => { const o = JSON.parse(j); day.rows = o.rows; day.pvIds = o.pvIds; await save(); render(); };
    const undo = async () => { if (hpos <= 0) return toast('Rien à annuler'); hpos--; await restore(hist[hpos]); toast('↶ Annulé'); };
    const redo = async () => { if (hpos >= hist.length - 1) return toast('Rien à rétablir'); hpos++; await restore(hist[hpos]); toast('↷ Rétabli'); };
    let resetScroll = false;
    function render() {
      track();
      const w0 = $('.rec-wrap', el), keep = w0 && !resetScroll ? [w0.scrollTop, w0.scrollLeft, el.scrollTop] : null; resetScroll = false;
      requestAnimationFrame(() => { const w1 = $('.rec-wrap', el); if (keep && w1) { w1.scrollTop = keep[0]; w1.scrollLeft = keep[1]; el.scrollTop = keep[2]; } });
      const n = day.rows.filter(r => r.element).length, ok = day.rows.filter(r => r.status === 'ok').length, rs = day.rows.filter(r => r.status === (isBeton(K) ? 'progress' : 'reserve')).length;
      el.innerHTML = `
        <div class="topbar"><button class="iconbtn" data-a="back">${icon('back')}</button>
          <div class="dnav"><button data-dn="-1" ${sib(-1) ? '' : 'disabled'}>‹</button><h1>${fmtDate(day.date)}</h1><button data-dn="1" ${sib(1) ? '' : 'disabled'}>›</button></div>
          ${isBeton(K) ? '' : `<button class="iconbtn" data-a="share">${icon('share')}</button>`}<button class="iconbtn" data-a="more">${icon('more')}</button></div>
        <div class="rec-sum"><span><b>${n}</b> éléments</span><span style="color:#22c55e"><b>${ok}</b> ${isBeton(K) ? 'bétonnés' : 'réceptionnés'}</span><span style="color:${isBeton(K) ? '#60a5fa' : '#f59e0b'}"><b>${rs}</b> ${isBeton(K) ? 'en cours' : 'réserves'}</span>${n - ok - rs ? `<span style="color:var(--muted)"><b>${n - ok - rs}</b> ${isBeton(K) ? 'non bétonné(s)' : 'en attente'}</span>` : ''}${!isBeton(K) && day.rows.some(pvMissing) ? `<span style="color:#ef4444"><b>${day.rows.filter(pvMissing).length}</b> PV non reçu(s)</span>` : ''}${!isBeton(K) && day.rows.some(x => x.element && x.status !== 'pending' && !x.pvLivre) ? `<span style="color:#f59e0b"><b>${day.rows.filter(x => x.element && x.status !== 'pending' && !x.pvLivre).length}</b> non livré(s)</span>` : ''}</div>
        <div class="rec-info"><b>${fmtDate(day.date)}</b><span class="rp">${esc(p.pdfTitle || p.name)}</span><span class="rt">${recTitle(K)} (post jour)</span>${day.date !== todayISO() ? `<button class="kswitch ktoday" data-a="today">📅 Aujourd'hui</button>` : ''}<button class="kswitch kur" data-a="undo" title="Annuler" ${hpos > 0 ? '' : 'disabled'}>↶</button><button class="kswitch kur" data-a="redo" title="Rétablir" ${hpos < hist.length - 1 ? '' : 'disabled'}>↷</button><button class="kswitch ksort" data-a="sort">⇅ Trier</button><button class="kswitch" data-ks>${icon(isBeton(K) ? 'layers' : 'calendar')} ${isBeton(K) ? 'Réception' : 'Bétonnage'} du ${fmtDate(day.date).slice(0, 5)}</button></div>
        <div class="rec-wrap">
          <table class="rec">
            <thead>
              <tr><th>Zone</th><th>NIV</th><th class="el">${recColHead(K)}</th>${isBeton(K) ? '<th>Classe béton</th>' : '<th class="pvh">PV</th><th class="ix">Ind. coff.</th><th class="ix">Ind. fer.</th>'}<th>Statut</th>${isBeton(K) ? '' : '<th>Réceptionné avec</th>'}<th class="ob">Observation</th><th>${PH1}</th><th>${PH2}</th><th>Croquis</th>${isBeton(K) ? '<th>Décoffrage</th>' : ''}</tr>
            </thead>
            <tbody>
              ${day.rows.map((r, i) => `<tr data-i="${i}" class="st-${r.status} ${moveSel === i ? 'moving' : ''} ${selId && r.id === selId ? 'sel' : ''} ${!isBeton(K) && r.element && r.status !== 'pending' && !r.pvLivre ? 'pv-nl' : ''}">
                <td class="c">${esc(r.zone)}</td><td class="c">${esc(r.niv)}</td><td class="el">${esc(r.element)}</td>${isBeton(K) ? `<td class="c">${esc(r.classe || '')}</td>` : `<td class="c pvc">${pvCell(r, i)}</td><td class="c ix">${r.repFrom ? '<span class="rep-b">✗ Reporté</span>' : ''}${indCell(r.indCof, r.indCofD)}</td><td class="c ix">${indCell(r.indFer, r.indFerD)}</td>`}
                <td class="c">${r.status === 'ok' ? '' : `<span class="rs" style="background:${(REC_STATUS[r.status] || REC_STATUS.pending).color}">${r.status === 'reserve' ? resLabel(K) : r.status === 'progress' ? 'En cours' : 'Attente'}</span>`}${r.status === 'reserve' && r.liftedAt ? `<br><span class="rs" style="background:#16a34a;margin-top:4px">${liftLabel(K)} ${recDateLabel(r.liftedAt).slice(0, 5)}</span>` : ''}</td>
${isBeton(K) ? '' : `<td class="c">${esc(r.avec || '')}</td>`}
                <td class="ob">${esc(r.obs)}</td>
                <td class="c ph">${(r.photoIds || []).length ? `📷 ${r.photoIds.length}` : ''}${(r.anomIds || []).length ? ` <span class="an">⚠ ${r.anomIds.length}</span>` : ''}</td>
                <td class="c ph">${(r.retourIds || []).length ? `📷 ${r.retourIds.length}` : ''}</td>
                <td class="c ph sk">${r.croquisId ? `<img data-sk="${r.croquisId}" alt="✏️">` : ''}</td>${isBeton(K) ? `<td class="c">${decofCell(p, day, r)}</td>` : ''}</tr>`).join('')}
              <tr class="addrow"><td colspan="${NC}"><div class="addrow-in"><button data-a="add">${icon('plus')} Ajouter une ligne</button><button data-a="paste">${icon('edit')} Coller un texte</button><span class="hint-lp">Appui long sur une ligne pour la déplacer</span></div></td></tr>
            </tbody>
          </table>
          ${isBeton(K) ? '' : `<div class="pv-day">
            <div class="pv-h">${icon('report')} PV du jour <span>${(day.pvIds || []).length || ''}</span></div>
            <div class="thumbs" id="pvThumbs"></div>
          </div>
          <div class="fc-box" id="fcBox"></div>`}${isBeton(K) ? '<div class="fc-box bn-box" id="bnBox"></div>' : ''}
        </div>
        ${moveSel >= 0 ? `<div class="movebar"><span>Déplacer la ligne ${moveSel + 1}</span>
          <button data-mv="top" title="Tout en haut">⤒</button><button data-mv="up">▲</button><button data-mv="down">▼</button><button data-mv="bottom" title="Tout en bas">⤓</button>
          <button data-mv="done" class="ok">${icon('check')}</button></div>` : ''}`;
      if (!isBeton(K) && typeof fcBox === 'function') fcBox(p, day, $('#fcBox', el), save, render).catch(e => console.warn('fiches', e));
      if (isBeton(K) && typeof bonBox === 'function') bonBox(p, day, $('#bnBox', el), save, render).catch(e => console.warn('bons', e));
      // PV du jour
      (async () => {
        const pvs = await loadFiles(day.pvIds || []);
        const box = $('#pvThumbs', el); if (!box) return;
        const merged = !!day.pvPdfId && pvs.length;
        box.innerHTML = merged
          ? `<button class="pv-pdf" data-a="openpvpdf"><span class="pp-ic">${icon('pdf')}</span><span class="grow"><b>PV du ${fmtDate(day.date)}.pdf</b><small>${pvs.length} page(s) · un seul fichier</small></span></button>
             ${pvs.map(f => `<div class="t" data-pv="${f.id}"><img src="${BlobURL.get(f.id, f.blob)}"><button class="x" data-pvdel="${f.id}">×</button></div>`).join('')}
             <button class="t add" data-a="addpv">${icon('camera')}</button>
             <div class="pv-acts"><button data-a="sharepvpdf">${icon('share')} Envoyer le PDF</button><button data-a="splitpv">${icon('layers')} Séparer</button></div>`
          : pvs.map(f => `<div class="t" data-pv="${f.id}"><img src="${BlobURL.get(f.id, f.blob)}"><button class="x" data-pvdel="${f.id}">×</button></div>`).join('') + `<button class="t add" data-a="addpv">${icon('camera')}</button>`
            + (pvs.length > 1 ? `<div class="pv-acts"><button data-a="mergepv">${icon('pdf')} Fusionner en un seul PDF</button></div>` : '');
        const addPv = async () => {
          const src = await pickSource('Ajouter un PV'); if (!src) return;
          let files = await pickImages(src); if (!files.length) return;
          // coins détectés automatiquement, à ajuster à la main si besoin (✓ pour valider)
          const sc = await scanDocuments(files); if (!sc || !sc.length) return; files = sc;
          const ld = loading('Enregistrement…'); let recs = [];
          try { for (const f of files) recs.push(await saveImageFile(day.projectId, f, 'photo', { source: `PV ${recTitle(K)} ${recDateLabel(day.date)}`, hq: true }));
            day.pvIds = [...(day.pvIds || []), ...recs.map(x => x.id)]; await save(); }
          finally { ld.close(); }
          toast(`${recs.length} PV ajouté(s) ✓`); render(); mergeSoon();   // le PDF du jour se met à jour en arrière-plan
          if (typeof pvSmartCheck === 'function') pvSmartCheck(p, day, recs, () => { save(); render(); });
        };
        $('[data-a=addpv]', box).onclick = () => addPv();
        const mb = $('[data-a=mergepv]', box); if (mb) mb.onclick = async () => { const ld = loading('Création du PDF…'); try { await pvQ; await mergePv(); await save(); toast('PV fusionnés en un PDF ✓'); } finally { ld.close(); } render(); };
        const sp = $('[data-a=splitpv]', box); if (sp) sp.onclick = async () => { if (!await confirmBox('Séparer le PDF ? Les photos des PV redeviennent séparées.', 'Séparer')) return; await DB.del('files', day.pvPdfId); day.pvPdfId = null; await save(); render(); };
        const op = $('[data-a=openpvpdf]', box); if (op) op.onclick = async () => { await pvQ; const f = await DB.get('files', day.pvPdfId); if (f) showPdf(f.blob, `PV du ${fmtDate(day.date)}`); };
        const sh = $('[data-a=sharepvpdf]', box); if (sh) sh.onclick = async () => { await pvQ; const f = await DB.get('files', day.pvPdfId); if (f) shareBlob(f.blob, `PV_${safeName(recTitle(K))}_${day.date}.pdf`); };
        $$('[data-pv]', box).forEach(t => t.onclick = async (e) => {
          const id = t.dataset.pv;
          if (e.target.closest('[data-pvdel]')) { if (await confirmBox('Retirer ce PV ?')) { day.pvIds = day.pvIds.filter(x => x !== id); await save(); render(); DB.del('files', id).catch(() => {}); if (day.pvPdfId) mergeSoon(); } return; }   // retiré tout de suite, le PDF suit en arrière-plan
          showGallery(pvs.map((f, k) => ({ src: BlobURL.get(f.id, f.blob), caption: `PV du ${fmtDate(day.date)} (${k + 1})`, fileId: f.id })), pvs.findIndex(x => x.id === id),
            { onDelete: async (it) => { day.pvIds = (day.pvIds || []).filter(x => x !== it.fileId); await save(); DB.del('files', it.fileId).catch(() => {}); if (day.pvPdfId) mergeSoon(); return true; } });
          const gl = document.querySelector('.gallery [data-a=x]'); if (gl) { const o = gl.onclick; gl.onclick = () => { o(); render(); }; }
        });
      })();
      $('[data-a=back]', el).onclick = () => { unBack(); finish(); };
      $$('[data-dn]', el).forEach(b => b.onclick = () => goDay(+b.dataset.dn));
      const tdb = $('[data-a=today]', el); if (tdb) tdb.onclick = async () => {
        await save(); await loadSibs(); let t = SIBS.find(d => d.date === todayISO());
        if (!t) { if (!await confirmBox(`Pas encore de tableau ${isBeton(K) ? 'de bétonnage' : 'de réception'} aujourd'hui. Le créer ?`, 'Créer')) return; t = await DB.put('receptions', { projectId: day.projectId, date: todayISO(), type: isBeton(K) ? 'Bétonnage' : 'Ferraillage', rows: [] }); await loadSibs(); }
        const dir = t.date > day.date ? 1 : -1; day = (await DB.get('receptions', t.id)) || t; moveSel = -1;
        el.classList.remove('slide-l', 'slide-r'); void el.offsetWidth; el.classList.add(dir > 0 ? 'slide-l' : 'slide-r'); render(); };
      $('[data-ks]', el).onclick = async () => {
        let o = otherKind();
        if (!o) { if (!await confirmBox(`Pas encore de ${isBeton(K) ? 'réception' : 'programme de bétonnage'} le ${fmtDate(day.date)}. Le créer ?`, 'Créer')) return; o = await DB.put('receptions', { projectId: day.projectId, date: day.date, type: isBeton(K) ? 'Ferraillage' : 'Bétonnage', rows: [] }); }
        await save(); unBack(); el.remove(); resolve();
        App.section = isBeton(K) ? 'reception' : 'beton'; renderSection();
        setTimeout(() => openReceptionDay(o), 50);
      };
      $('[data-a=add]', el).onclick = () => editRow(null);
      $('[data-a=undo]', el).onclick = undo; $('[data-a=redo]', el).onclick = redo;
      $('[data-a=sort]', el).onclick = async () => {   // zone croissante, puis niveau du plus haut au plus bas
        const zn = (r) => { const z = parseFloat(String(r.zone || '').replace(',', '.')); return isNaN(z) ? 1e9 : z; };
        day.rows.sort((a, b) => (!a.element - !b.element) || zn(a) - zn(b) || String(a.zone || '').localeCompare(String(b.zone || ''), 'fr', { numeric: true }) || nivRank(b.niv) - nivRank(a.niv) || String(a.element || '').localeCompare(String(b.element || ''), 'fr', { numeric: true }));
        moveSel = -1; await save(); render(); toast('Trié par zone puis niveau ✓'); };
      $('[data-a=paste]', el).onclick = async () => {
        const r = await formSheet('Coller un texte', [{ name: 'txt', label: 'Collez le message (WhatsApp, notes…) — une ligne par ouvrage', type: 'textarea', placeholder: 'Zone 11\nR+5 Voile CR 75\nR+5 Poutre C21 B30\nZone 12 R+2 Poteau CR 26' }], { okLabel: 'Analyser' });
        if (!r || !r.txt) return;
        const rows = parseRecText(r.txt, K);
        if (!rows.length) return toast('Aucun ouvrage reconnu');
        // aperçu modifiable : chaque case se corrige avant d'entrer dans le tableau
        const bet = isBeton(K), NIVS = ['SSL', 'Mezz', 'RDC', ...Array.from({ length: 12 }, (_, i) => 'R+' + (i + 1)), 'Terrasse'];
        const rowHTML = (x) => `<div class="ps-row ps-ed" data-st="${esc(x.status || '')}"><input data-f="zone" value="${esc(x.zone || '')}" placeholder="Zone"><input data-f="niv" list="ps-niv" value="${esc(x.niv || '')}" placeholder="Niv"><input data-f="element" value="${esc(x.element || '')}" placeholder="Ouvrage">${bet ? `<input data-f="classe" value="${esc(x.classe || '')}" placeholder="Classe">` : ''}<button class="iconbtn sm" data-del>${icon('close')}</button></div>`;
        const sh = sheet(`<datalist id="ps-niv">${NIVS.map(n => `<option value="${n}">`).join('')}</datalist>
          <div class="ps-head ${bet ? 'b' : ''}"><span>Zone</span><span>Niv</span><span>Ouvrage</span>${bet ? '<span>Classe</span>' : ''}<span></span></div>
          <div class="ps-list">${rows.map(rowHTML).join('')}</div>
          <button class="btn ghost" data-a="addl" style="width:100%;margin-top:6px">${icon('plus')} Ajouter une ligne</button>
          <div class="muted" style="font-size:12.5px;margin:8px 0">Touchez une case pour la corriger avant d'ajouter. ✕ = supprimer la ligne.</div>
          <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="ok">${icon('check')} Ajouter <span class="ps-n">${rows.length}</span> ligne(s)</button></div>`, { title: `${rows.length} ouvrage(s) reconnu(s) — vérifiez` });
        const list = $('.ps-list', sh.el), cnt = () => { $('.ps-n', sh.el).textContent = $$('.ps-ed', list).length; };
        const wire = (row) => { $('[data-del]', row).onclick = () => { row.remove(); cnt(); }; if (bet) row.classList.add('b'); };
        $$('.ps-ed', list).forEach(wire);
        $('[data-a=addl]', sh.el).onclick = () => { const last = $$('.ps-ed', list).pop(); const t = document.createElement('div'); t.innerHTML = rowHTML({ zone: last ? $('[data-f=zone]', last).value : '', niv: last ? $('[data-f=niv]', last).value : '' }); const row = t.firstElementChild; list.appendChild(row); wire(row); cnt(); $('[data-f=element]', row).focus(); };
        $('[data-a=c]', sh.el).onclick = () => sh.close();
        $('[data-a=ok]', sh.el).onclick = async () => {
          const final = $$('.ps-ed', list).map(row => { const v = (f) => { const i = $(`[data-f=${f}]`, row); return i ? i.value.trim() : ''; }; return { zone: v('zone'), niv: v('niv'), element: v('element'), classe: v('classe'), st: row.dataset.st }; }).filter(x => x.element);
          if (!final.length) return toast('Aucune ligne');
          for (const x of final) day.rows.push({ id: DB.uid(), zone: x.zone, niv: x.niv, element: x.element, classe: x.classe || '', avec: '', pvRecu: false, status: x.st || (bet ? 'progress' : 'pending'), obs: '', photoIds: [], retourIds: [] });
          await save(); sh.close(); render(); toast(`${final.length} ligne(s) ajoutée(s) ✓`);
        };
      };
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
        tr.onclick = async (e) => { if (lp) return;
          const pq = e.target.closest('[data-pvq]'); if (pq) { const [ix, w] = pq.dataset.pvq.split('|'), r = day.rows[+ix];
            if (w === 'r') { const on = !pvRec(r); r.pvRecu = on; r.pvExist = false; r.pvRecuAt = on ? todayISO() : null; }   // reçu et livré sont indépendants
            else { r.pvLivre = !r.pvLivre; r.pvLivreAt = r.pvLivre ? todayISO() : null; }
            try { navigator.vibrate && navigator.vibrate(12); } catch (x) {} await save(); toast(w === 'r' ? (pvRec(r) ? `PV reçu ✓ · ${r.element}` : `PV non reçu · ${r.element}`) : (r.pvLivre ? `PV livré au BET ✓ · ${r.element}` : `PV non livré · ${r.element}`)); return render(); } if (moveSel >= 0) { moveSel = +tr.dataset.i; return render(); }
          $$('tbody tr.sel', el).forEach(x => x.classList.remove('sel')); tr.classList.add('sel'); selId = (day.rows[+tr.dataset.i] || {}).id || null;
          editRow(+tr.dataset.i); };
      });
      $$('[data-mv]', el).forEach(b => b.onclick = async () => {
        const v = b.dataset.mv, i = moveSel, R = day.rows;
        if (v === 'done') { moveSel = -1; await save(); return render(); }
        const j = v === 'up' ? i - 1 : v === 'down' ? i + 1 : v === 'top' ? 0 : R.length - 1;
        if (j < 0 || j >= R.length || j === i) return;
        const [row] = R.splice(i, 1); R.splice(j, 0, row); moveSel = j; await save(); render();
        const tr = $(`tbody tr[data-i="${j}"]`, el); tr && tr.scrollIntoView({ block: 'nearest' });
      });
      const shb = $('[data-a=share]', el); if (shb) shb.onclick = async () => { await save(); await shareDayMenu(p, day); render(); };
      $('[data-a=more]', el).onclick = async () => {
        const v = await menu('Tableau', [
          ...(!isBeton(K) ? [{ label: '📝 Fiches de contrôle (PV) de tous les ouvrages du jour', icon: 'pdf', value: 'pvgday' }, { label: 'Modèles de fiches (mes PDF)…', icon: 'upload', value: 'pvgtpl' }] : []),
          { label: 'Changer la date', icon: 'calendar', value: 'date' },
          { label: 'Libérer les photos de ce jour (gardées dans Drive)', icon: 'drive', value: 'free' },
          ...(!isBeton(K) ? [{ label: `Bons de bétonnage du jour (PDF, 6 par page)${day.rows.some(x => x.bon) ? ' · ' + day.rows.filter(x => x.bon).length : ''}`, icon: 'pdf', value: 'bons' }] : []),
          ...(!isBeton(K) ? [{ label: 'Copier des ouvrages vers le bétonnage…', icon: 'calendar', value: 'cpb' }] : []),
          { label: 'Corbeille (restaurer une ligne / un tableau)', icon: 'undo', value: 'trash' },
          { label: 'Supprimer ce tableau', icon: 'trash', danger: true, value: 'del' },
        ]);
        if (v === 'bons') { const list = day.rows.filter(x => x.bon).map(x => x.bon); if (!list.length) toast('Aucun bon : ouvrez un ouvrage › « Bon de bétonnage »'); else await bonsPdf(p, list, `Bons de bétonnage ${fmtDate(day.date).replace(/\//g, '-')}`); }
        if (v === 'bonfree') { const cfg = bonCfg(p); const b = { id: DB.uid(), date: day.date, area: '', zone: '', ouvrage: '', partie: '', type: '', sig: { ...(cfg.last || {}) } }; await openBon(p, b, async (bb) => { p.bons = (p.bons || []).filter(x => x.id !== bb.id).concat(bb); await DB.put('projects', p); }, async (bb) => { p.bons = (p.bons || []).filter(x => x.id !== bb.id); await DB.put('projects', p); }); }
        if (v === 'cpb') { await save(); const pick = await pickRows(day.rows.filter(x => x.element), 'Copier vers le bétonnage'); if (pick && pick.length) await copyToBeton(day.projectId, pick); }
        if (v === 'free') { await save(); await freeFilesUI([...(day.pvIds || []), ...day.rows.flatMap(r => [...(r.photoIds || []), ...(r.anomIds || []), ...(r.retourIds || [])])], `${recTitle(K)} du ${fmtDate(day.date)}`); render(); }
        if (v === 'pvgday') return pvgDay(p, day, save);
        if (v === 'pvgtpl') { const w = await menu('Modèles de fiches', [{ label: 'Modèle intégré : changer le PDF de la fiche de contrôle', icon: 'upload', value: 'b' }, { label: '＋ Nouveau modèle (mon PDF)…', icon: 'plus', value: 'n' }, ...(ftList(p).length ? [{ label: 'Gérer mes modèles…', icon: 'settings', value: 'm' }] : [])]); if (w === 'b') await pvgTemplate(p, true); if (w === 'n') await ftNew(p); if (w === 'm') await ftManage(p); return; }
        if (v === 'date') { const r = await formSheet('Date', [{ name: 'date', label: 'Date', type: 'date', value: day.date }]); if (r && r.date) { day.date = r.date; await save(); render(); } }
        if (v === 'del' && await confirmBox('Supprimer ce tableau ?\n(il reste 30 jours dans la corbeille : ⋮ › Corbeille)')) {
          await save(); await trashPut(day.projectId, { kind: 'day', day: JSON.parse(JSON.stringify(day)) });
          await DB.del('receptions', day.id); unBack(); el.remove(); resolve(); toast('Tableau mis à la corbeille', { action: 'Annuler', onAction: () => openTrash(day.projectId) });
        }
        if (v === 'trash') openTrash(day.projectId);
      };
    }

    // Éditeur d'une ligne
    function editRow(i) {
      const isNew = i === null;
      const last = day.rows[day.rows.length - 1] || {};
      const r = isNew ? { id: DB.uid(), zone: last.zone || '', niv: last.niv || '', element: '', classe: last.classe || '', avec: last.avec || '', pvRecu: false, status: isBeton(K) ? 'progress' : 'pending', obs: '', photoIds: [], retourIds: [] } : { ...day.rows[i], photoIds: [...(day.rows[i].photoIds || [])], anomIds: [...(day.rows[i].anomIds || [])], retourIds: [...(day.rows[i].retourIds || [])] };
      const s = sheet(`<div class="form" id="rowf"></div>`, { title: isNew ? 'Nouvelle ligne' : 'Modifier la ligne' });
      const f = $('#rowf', s.el), phOpen = new Set();
      async function draw() {
        const peekAll = async (ids) => { const o = []; for (const id of ids || []) { const x = await DB.peek('files', id); if (x) o.push(x); } return o; };
        r.anomIds = r.anomIds || [];
        const photos = await peekAll(r.photoIds), anoms = await peekAll(r.anomIds), retours = await peekAll(r.retourIds);
        const fold = (sec, ttl, list, extra = '') => `<div class="ph3-b ${sec === 'anomIds' ? 'an' : sec === 'retourIds' ? 'ok' : ''} ${phOpen.has(sec) ? 'open' : ''}"><button type="button" class="ph3-h" data-fold="${sec}"><span>${ttl}</span>${list.length ? `<i>${list.length}</i>` : ''}<u>${icon('chevdown')}</u></button>${phOpen.has(sec) ? thumbs(list, sec) + extra : ''}</div>`;
        const thumbs = (list, sec) => `<div class="thumbs">${list.map(f => `<div class="t" data-id="${f.id}" data-sec="${sec}">${fileThumbHTML(f)}<button class="x" data-del="${f.id}">×</button></div>`).join('')}<button class="t add" data-add="${sec}">${icon('camera')}</button></div>`;
        f.innerHTML = `
          <div class="kv"><label>Zone<input name="zone" value="${esc(r.zone)}" inputmode="numeric" placeholder="11"></label>
            <label>Niveau<input name="niv" list="dl-niv" value="${esc(r.niv)}" placeholder="R+5"></label></div>
          <datalist id="dl-niv">${NIVEAUX.map(n => `<option value="${n}">`).join('')}</datalist>
          <label>Élément<input name="element" value="${esc(r.element)}" placeholder="Ex : Voile CR 77 Axe D2"></label>
          <div class="fld">Indice coffrage<div class="ind-dt"><input name="indCof" value="${esc(r.indCof || '')}" placeholder="P1" maxlength="8"><input name="indCofD" type="date" value="${esc(r.indCofD || '')}"></div></div>
          <div class="fld">Indice ferraillage<div class="ind-dt"><input name="indFer" value="${esc(r.indFer || '')}" placeholder="P1" maxlength="8"><input name="indFerD" type="date" value="${esc(r.indFerD || '')}"></div></div>
          ${isBeton(K) ? `<label>Classe béton<input name="classe" list="dl-classe" value="${esc(r.classe || '')}" placeholder="Ex : B30"></label><datalist id="dl-classe">${CLASSES.map(c => `<option value="${c}">`).join('')}</datalist>
          <div class="fld">Suivi décoffrage<div class="seg"><button type="button" data-dcf="1" class="${decofOn(r) ? 'on' : ''}">Oui</button><button type="button" data-dcf="0" class="${!decofOn(r) ? 'on' : ''}">Non</button></div>
            ${decofOn(r) ? `<div class="dcf-row">${r.status === 'ok' ? decofCell(p, day, r) : '<small class="pv-help">Le suivi démarre quand l\u2019élément est « bétonné »</small>'}${r.status === 'ok' ? `<button type="button" class="btn ghost small" data-a="decofok">${r.decofAt ? 'Annuler « décoffré »' : 'Décoffré aujourd\u2019hui'}</button>` : ''}</div>` : ''}</div>` : ''}
          <div class="fld">Statut<div class="seg seg3">${statusesFor(K).map(k => [k, REC_STATUS[k]]).map(([k, v]) => `<button type="button" data-st="${k}" class="${r.status === k ? 'on' : ''}" style="${r.status === k ? `background:${v.color}` : ''}">${stLabel(K, k)}</button>`).join('')}</div></div>
          ${isBeton(K) ? '' : `<div class="fld">PV <small class="pv-help">touchez pour changer</small><div class="seg pvsw"><button type="button" data-pvt="r" class="${pvRec(r) ? 'ok' : 'no'}">${pvRec(r) ? `✓ Reçu${r.pvRecuAt ? ' le ' + recDateLabel(r.pvRecuAt) : ''}` : '✗ Non reçu'}</button><button type="button" data-pvt="l" class="${r.pvLivre ? 'ok' : 'nl'}">${r.pvLivre ? `✓ Livré${r.pvLivreAt ? ' le ' + recDateLabel(r.pvLivreAt) : ''}` : '✗ Non livré'}</button></div></div>
          <label>Réceptionné avec<input name="avec" list="dl-avec" value="${esc(r.avec || '')}" placeholder="Nom (ex : M. Alaoui — BET)"></label><datalist id="dl-avec">${NAMES.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`}
          <label>Observation ${r.status === 'reserve' ? '/ ' + resLabel(K).toLowerCase() : ''}<textarea name="obs" style="min-height:64px" placeholder="${r.status === 'reserve' ? (isBeton(K) ? 'Ex : ségrégation en pied de voile, nid de cailloux…' : 'Ex : cales manquantes côté axe D2') : 'Optionnel'}">${esc(r.obs)}</textarea></label>
          <div class="ph3">
            ${fold('photoIds', `📷 Photos ${isBeton(K) ? 'du bétonnage' : 'de la partie d\u2019ouvrage'}`, photos)}
            ${fold('anomIds', `⚠️ ${isBeton(K) ? 'Défauts' : 'Anomalies'}`, anoms)}
            ${fold('retourIds', `✅ ${isBeton(K) ? 'Réparation des défauts' : 'Réparation des anomalies'}`, retours, r.status === 'reserve' || anoms.length || r.liftedAt ? `<button type="button" class="btn ${r.liftedAt ? 'ghost' : ''} small" data-a="lift" style="align-self:flex-start;margin-top:8px">${icon('check')} ${r.liftedAt ? `${isBeton(K) ? 'Réparé' : 'Réserve levée'} le ${recDateLabel(r.liftedAt)} (annuler)` : (isBeton(K) ? 'Marquer comme réparé' : 'Marquer la réserve comme levée')}</button>` : '')}
          </div>
          ${!isNew ? `<button type="button" class="btn ghost small bon-btn" data-a="place">📍 ${r.pinId ? 'Voir sur le plan / déplacer' : 'Placer sur un plan'}</button>` : ''}
          ${!isNew ? `<button type="button" class="btn ghost small bon-btn" data-a="bon">📝 ${r.bon ? 'Bon de bétonnage (voir / modifier)' : 'Bon de bétonnage'}</button>` : ''}
          ${!isNew && !isBeton(K) ? `<button type="button" class="btn ghost small cp-btn" data-a="cpb">${icon('calendar')} Copier vers le programme de bétonnage</button>` : ''}
          ${[...photos, ...anoms, ...retours].some(x => x.blob) && !isNew ? `<button type="button" class="btn ghost small fr-btn" data-a="free">☁ Libérer ${[...photos, ...anoms, ...retours].filter(x => x.blob).length} photo(s) du téléphone</button>` : ''}${[...photos, ...anoms, ...retours].some(x => !x.blob && x.freed) ? `<div class="fr-mini">☁ ${[...photos, ...anoms, ...retours].filter(x => !x.blob && x.freed).length} photo(s) uniquement dans Drive</div>` : ''}
          <div class="fld">Croquis ${isBeton(K) ? '(partie bétonnée en couleur)' : '(partie réceptionnée en couleur)'}</div>
          <div class="sk-row">${r.croquisId ? `<img class="sk-thumb" data-a="skview">` : ''}<button type="button" class="btn ghost small" data-a="sketch">${icon('pen')} ${r.croquisId ? 'Modifier le croquis' : 'Dessiner un croquis'}</button>${r.croquisId ? `<button type="button" class="btn ghost small" data-a="skdel" style="flex:none">${icon('trash')}</button>` : ''}</div>
          <div class="btnrow" style="padding:0">${!isNew ? `<button class="btn danger" data-a="del" style="flex:none;padding:14px 16px">${icon('trash')}</button>` : ''}
            <button class="btn ghost" data-a="cancel">Annuler</button><button class="btn" data-a="ok">${isNew ? 'Ajouter' : 'Enregistrer'}</button></div>
          ${isNew ? `<button class="btn ghost" data-a="okmore" style="margin-top:-4px">Ajouter et ligne suivante</button>` : `${!isBeton(K) ? `<div class="pvg-row"><button class="btn pvg-b" data-a="pvgen">📝 ${esc(fcName(p, fcSel(p)).replace(/\s*\(.*\)/, ''))}${fcFile(r, fcSel(p)) ? ' ✓' : ' · remplir'}</button><button class="btn ghost pvg-m" data-a="pvgm" title="Changer de modèle">⇄</button></div>` : ''}<button class="btn ghost" data-a="wa" style="margin-top:-4px">${icon('share')} Envoyer cet ouvrage (WhatsApp)</button>${(r.photoIds.length + r.retourIds.length) ? `<button class="btn ghost" data-a="waph" style="margin-top:-4px">${icon('camera')} Envoyer toutes ses photos (${r.photoIds.length + r.retourIds.length})</button>` : ''}`}`;
        Thumbs.fill(f);
        $$('[data-fold]', f).forEach(b => b.onclick = (e) => { e.preventDefault(); const k = b.dataset.fold; phOpen.has(k) ? phOpen.delete(k) : phOpen.add(k); draw(); });
        const plc = $('[data-a=place]', f); if (plc) plc.onclick = async (e) => {
          e.preventDefault(); if (!await commit()) return;
          const L = r.pinId ? await DB.get('links', r.pinId) : null;
          if (L) {
            const v = await menu(r.element, [{ label: 'Ouvrir le plan', icon: 'plans', value: 'open' }, { label: 'Changer l\u2019emplacement', icon: 'pin', value: 'move' }, { label: 'Retirer du plan', icon: 'trash', danger: true, value: 'del' }]);
            if (!v) return;
            if (v === 'open') { const pl = await DB.get('plans', L.planId); if (!pl) return toast('Plan supprimé'); s.close(); return openPlanViewer(pl, planCtx(() => {})); }
            if (v === 'del') { await DB.del('links', L.id); r.pinId = null; await commit(); return draw(); }
          }
          const pl = await pickPlanFor(day.projectId, r.niv); if (!pl) return;
          s.close();
          openPlanViewer(pl, { ...planCtx(() => render()), place: { label: r.element, onPlace: async (x, y, plan) => {
            if (L) await DB.del('links', L.id);
            const nl = await DB.put('links', { projectId: day.projectId, planId: plan.id, kind: 'recpin', shape: 'point', x, y, name: recPinName(r), recDay: day.id, recRow: r.id, recStatus: r.status, recKind: K, items: [] });
            r.pinId = nl.id; await save(); toast('📍 Placé sur le plan ✓');
          } } });
        };
        const bnb = $('[data-a=bon]', f); if (bnb) bnb.onclick = async (e) => { e.preventDefault(); if (!await commit()) return; const cfg = bonCfg(p); const b = r.bon ? { ...r.bon, sig: { ...(r.bon.sig || {}) } } : bonFromRow(r, day.date, cfg);
          const idx = day.rows.indexOf(r) >= 0 ? day.rows.indexOf(r) : i; s.close();   // la fiche se ferme pour laisser le bon s'afficher par-dessus
          await openBon(p, b, async (bb) => { r.bon = bb; day.rows[idx] = r; await save(); }, async () => { r.bon = null; day.rows[idx] = r; await save(); }); render(); };
        const cpb = $('[data-a=cpb]', f); if (cpb) cpb.onclick = async (e) => { e.preventDefault(); if (!await commit()) return; await copyToBeton(day.projectId, [r]); };
        const frb = $('[data-a=free]', f); if (frb) frb.onclick = async (e) => { e.preventDefault(); if (!await commit()) return; await freeFilesUI([...r.photoIds, ...(r.anomIds || []), ...r.retourIds], r.element || 'ouvrage'); draw(); };
        $$('[name]', f).forEach(inp => inp.oninput = () => { r[inp.name] = inp.value; });
        $$('[data-st]', f).forEach(b => b.onclick = () => { r.status = b.dataset.st; draw(); });
        $$('[data-pvt]', f).forEach(b => b.onclick = () => { if (b.dataset.pvt === 'r') { const on = !pvRec(r); r.pvRecu = on; r.pvExist = false; r.pvRecuAt = on ? todayISO() : null; }
          else { r.pvLivre = !r.pvLivre; r.pvLivreAt = r.pvLivre ? todayISO() : null; } draw(); });
        $$('[data-dcf]', f).forEach(b => b.onclick = () => { r.decof = b.dataset.dcf === '1'; draw(); });
        const dco = $('[data-a=decofok]', f); if (dco) dco.onclick = () => { r.decofAt = r.decofAt ? null : todayISO(); draw(); };
        $$('[data-bet]', f).forEach(b => b.onclick = () => { r.pvLivre = b.dataset.bet === '1'; r.pvLivreAt = r.pvLivre ? todayISO() : null; draw(); });
        $$('[data-add]', f).forEach(b => b.onclick = async (e) => {
          e.preventDefault(); const sec = b.dataset.add;
          const recs = await addPhotos(day.projectId, { source: `${sec === 'retourIds' ? 'Réparation' : sec === 'anomIds' ? 'Anomalie' : 'Réception'} ${recDateLabel(day.date)} · ${r.element || ''}` });
          if (recs.length) {
            r[sec] = r[sec] || []; r[sec].push(...recs.map(x => x.id));
            if (sec === 'anomIds' && r.status !== 'reserve' && !isBeton(K) && await confirmBox('Passer cet ouvrage en « Avec réserve » ?', 'Oui')) r.status = 'reserve';
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
          if ([...photos, ...anoms, ...retours].some(x => !x.blob)) { const l3 = loading('Téléchargement depuis Drive…'); try { for (const x of [...photos, ...anoms, ...retours]) if (!x.blob) { const g = await DB.get('files', x.id); if (g && g.blob) x.blob = g.blob; } } finally { l3.close(); } }
          const all = [...photos.map(x => [x, 'Photo']), ...anoms.map(x => [x, isBeton(K) ? 'Défaut' : 'Anomalie']), ...retours.map(x => [x, 'Réparation'])].filter(([x]) => x.blob);
          showGallery(all.map(([x, lb]) => ({ src: BlobURL.get(x.id, x.blob), caption: `${lb} · ${r.element}`, fileId: x.id })), all.findIndex(([x]) => x.id === id));
          const gl = document.querySelector('.gallery [data-a=x]'); if (gl) { const o = gl.onclick; gl.onclick = () => { o(); draw(); }; }
        });
        const commit = async () => {
          if (!r.element.trim()) { toast('Écrivez l\'élément'); return false; }
          if (isNew) day.rows.push(r); else day.rows[i] = r;
          await save();
          if (r.pinId) { const L = await DB.get('links', r.pinId); if (L && (L.recStatus !== r.status || L.name !== recPinName(r))) { L.recStatus = r.status; L.name = recPinName(r); await DB.put('links', L); } }
          return true;
        };
        $('[data-a=cancel]', f).onclick = () => s.close();
        $('[data-a=ok]', f).onclick = async () => { if (await commit()) { s.close(); render(); } };
        const om = $('[data-a=okmore]', f); if (om) om.onclick = async () => { if (await commit()) { s.close(); render(); editRow(null); } };
        const wa = $('[data-a=wa]', f); if (wa) wa.onclick = async () => { if (await commit()) shareRow(p, day, r); };
        const pvb = $('[data-a=pvgen]', f); if (pvb) pvb.onclick = async () => { if (await commit()) { await ficheMenu(p, day, r, save); draw(); } };
        const pvm = $('[data-a=pvgm]', f); if (pvm) pvm.onclick = async () => { await ficheMenu(p, day, r, save, { change: true }); draw(); };
        const wph = $('[data-a=waph]', f); if (wph) wph.onclick = async () => { const ld = loading('Préparation des photos…'); try { await sharePhotos([...r.photoIds, ...(r.anomIds || []), ...r.retourIds], `${r.zone ? 'Zone ' + r.zone + ' · ' : ''}${r.niv ? r.niv + ' · ' : ''}${r.element} — ${fmtDate(day.date)}`, r.element || 'photo'); } finally { ld.close(); } };
        const del = $('[data-a=del]', f); if (del) del.onclick = async () => { if (await confirmBox('Supprimer cette ligne ?')) { const row = day.rows[i]; await trashPut(day.projectId, { kind: 'row', dayId: day.id, date: day.date, type: day.type, idx: i, row }); day.rows.splice(i, 1); await save(); s.close(); render();
          toast('Ligne supprimée', { action: 'Annuler', onAction: () => undo() }); } };
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
    const rows = reportRows(K, day.rows);
    for (const r of rows) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const el = doc.splitTextToSize(pt(r.element), cols[2].w - 3), ob = doc.splitTextToSize(pt(r.obs || ''), cols[iOb].w - 3);
      const h = Math.max(8, Math.max(el.length, ob.length, isBeton(K) ? 1 : doc.splitTextToSize(pt(r.avec || ""), 23).length) * 4.4 + 3.5);
      if (R.y + h > 297 - 18) { doc.addPage(); R.header(); head(); }
      if (r.status === 'reserve') { doc.setFillColor(255, 243, 224); doc.rect(M, R.y, W - 2 * M, h, 'F'); }
      if (r.status === 'progress') { doc.setFillColor(226, 236, 255); doc.rect(M, R.y, W - 2 * M, h, 'F'); }
      doc.rect(M, R.y, W - 2 * M, h);
      let x = M; cols.forEach(c => { x += c.w; doc.line(x, R.y, x, R.y + h); });
      doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold');
      doc.text(pt(r.zone || ''), M + cols[0].w / 2, R.y + 5.5, { align: 'center' });
      doc.text(pt(r.niv || ''), M + cols[0].w + cols[1].w / 2, R.y + 5.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      el.forEach((l, j) => doc.text(l, M + cols[0].w + cols[1].w + 1.5, R.y + 5.5 + j * 4.4));
      if (!isBeton(K)) {
        const iPv = cols.findIndex(c => c.t === 'PV'), iAv = iPv + 1;
        doc.setFont('helvetica', 'bold'); if (pvRec(r)) doc.setTextColor(22, 163, 74); else if (r.status !== 'pending') doc.setTextColor(220, 38, 38);
        doc.text(pvRec(r) ? (r.pvLivre ? 'Livré BET' : 'Reçu') : r.status !== 'pending' ? 'Non reçu' : '', cx[iPv] + cols[iPv].w / 2, R.y + 5.5, { align: 'center' }); doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'normal');
        doc.splitTextToSize(pt(r.avec || ''), cols[iAv].w - 3).forEach((l, j) => doc.text(l, cx[iAv] + 1.5, R.y + 5.5 + j * 4.4));
      }
      if (isBeton(K)) { doc.setFont('helvetica', 'bold'); doc.text(pt(r.classe || ''), cx[3] + cols[3].w / 2, R.y + 5.5, { align: 'center' }); }
      const st = REC_STATUS[r.status] || REC_STATUS.pending, c = hexRGB(st.color);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...c);
      doc.text(pt(stLabel(K, r.status)), cx[iSt] + cols[iSt].w / 2, R.y + 5.5, { align: 'center' });
      if (r.status === 'reserve' && r.liftedAt) { doc.setTextColor(22, 163, 74); doc.text(pt(`${liftLabel(K)} le ${recDateLabel(r.liftedAt).slice(0, 5)}`), cx[iSt] + cols[iSt].w / 2, R.y + 9.6, { align: 'center' }); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(r.status === 'reserve' ? 190 : 60, r.status === 'reserve' ? 90 : 60, r.status === 'reserve' ? 0 : 60);
      ob.forEach((l, j) => doc.text(l, cx[iOb] + 1.5, R.y + 5.5 + j * 4.4));
      R.y += h;
    }
    R.y += 5;
    const ok = rows.filter(r => r.status === 'ok').length, rs = rows.filter(r => r.status === 'reserve').length;
    if (isBeton(K)) R.text(`Total : ${rows.length} élément(s) · ${ok} bétonné(s) · ${rows.filter(r => r.status === 'progress').length} en cours`, { size: 10, bold: true, gap: 4 });
    else R.text(`Total : ${rows.length} élément(s) · ${ok} ${stLabel(K, 'ok').toLowerCase()}(s) · ${rs} ${stLabel(K, 'reserve').toLowerCase()} · ${rows.length - ok - rs} ${stLabel(K, 'pending').toLowerCase()}(s)`, { size: 10, bold: true, gap: 4 });
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
    ...reportRows(K, day.rows).map(r => [r.zone, r.niv, r.element, ...(B ? [r.classe || ''] : []), stLabel(K, r.status) + (r.status === 'reserve' && r.liftedAt ? ` (${liftLabel(K).toLowerCase()} ${recDateLabel(r.liftedAt)})` : ''), ...(B ? [] : [pvRec(r) ? (r.pvLivre ? 'Livré BET' : 'Reçu') : r.status !== 'pending' ? 'Non reçu' : '', r.avec || '']), r.obs])];
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
    rows: reportRows(kindOf(day), day.rows).map(r => [r.zone || '', r.niv || '', r.element + (isBeton(kindOf(day)) && r.classe ? ` (${r.classe})` : ''), stLabel(kindOf(day), r.status), r.obs || '']),
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

async function shareBlob(blob, fname) {
  const P = window.Capacitor?.Plugins || {};
  if (P.Filesystem && P.Share) {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
    await P.Filesystem.writeFile({ path: fname, data: b64, directory: 'CACHE' });
    const { uri } = await P.Filesystem.getUri({ path: fname, directory: 'CACHE' });
    try { await P.Share.share({ title: fname, files: [uri], dialogTitle: 'Envoyer' }); } catch (e) {}
    return;
  }
  const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = fname; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000);
}

// Analyse un texte libre → lignes { zone, niv, element, classe, status }
function parseRecText(txt, K) {
  const NIV = /(?<![A-Za-z0-9])(R\s*\+\s*\d+(?!\d)|(?:RDC|R\.?D\.?C|Mezz(?:anine)?|SS\s*\d*|SSL|Sous[- ]sol\s*\d*|Fondations?|Terrasse|Toiture)\b)/i;   // « R+4deux poteaux » → R+4
  const out = []; let zone = '', niv = '', status = '';
  for (let raw of String(txt).split(/\r?\n/)) {
    let l = raw.trim().replace(/^[*_~]+|[*_~]+$/g, '').replace(/(^|\s)[*_~]+(?=\S)|(?<=\S)[*_~]+(?=\s|$)/g, '$1').replace(/[✅❌⏳⚠️\u{1F504}✔☑\u{1F7E2}\u{1F534}]/gu, '').replace(/^[\s\-•·▪►>]+/, '').trim();
    if (!l) continue;
    if (/\bdu\s+\d{1,2}[\/.-]\d{1,2}/i.test(l) && /(réception|reception|programme|bétonnage|betonnage)/i.test(l)) continue;   // titre
    if (/:\s*$/.test(l) || /^\(?\d+\)?\s*:?$/.test(l)) {                                                                     // titre de section
      if (/en cours/i.test(l)) status = 'progress'; else if (/non\s+(b[ée]tonn|r[ée]ception)|attente/i.test(l)) status = 'pending'; else if (/r[ée]serve|d[ée]faut/i.test(l)) status = 'reserve'; else if (/b[ée]tonn|r[ée]ceptionn|valid/i.test(l)) status = 'ok';
      continue;
    }
    const zm = l.match(/^zone\s*([\w+.-]+)\s*[:·\-—,]?\s*/i);
    if (zm) { zone = zm[1]; l = l.slice(zm[0].length).trim(); if (!l) { niv = ''; continue; } }
    const nm = l.match(NIV);
    let n = niv;
    if (nm) { n = nm[1].replace(/\s+/g, '').replace(/^r\.?d\.?c$/i, 'RDC').replace(/^r\+/i, 'R+').replace(/^mezz\w*$/i, 'Mezz').replace(/^(ssl|fondations?|terrasse|toiture)$/i, m => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()); l = (l.slice(0, nm.index) + ' ' + l.slice(nm.index + nm[0].length)).trim(); }
    if (!l) { niv = n; continue; }
    let classe = '';
    if (isBeton(K)) { const cm = l.match(/\(?\b(B\s?\d{2}(?:\s*\/\s*G\s?\d)?|C\s?\d{2}\/\d{2})\b\)?/i); if (cm) { classe = cm[1].replace(/\s+/g, '').toUpperCase(); l = (l.slice(0, cm.index) + l.slice(cm.index + cm[0].length)).trim(); } }
    l = l.replace(/^[\s—–\-:·,]+|[\s—–\-:·,]+$/g, '').replace(/\s{2,}/g, ' ');
    if (!l || l.length < 2) continue;
    out.push({ zone, niv: n, element: l.charAt(0).toUpperCase() + l.slice(1), classe, status });
  }
  return out;
}

// Menu de partage d'un tableau (un seul endroit, utilisé partout)
async function shareDayMenu(p, day) {
  const K = kindOf(day);
        const v = await menu('Partager', [
          { label: 'Texte WhatsApp (tout le tableau)', icon: 'share', value: 'txt' },
          { label: 'Une zone…', icon: 'share', value: 'zone' },
          { label: 'Choisir des ouvrages…', icon: 'check', value: 'pick' },
          { label: 'PDF du tableau', icon: 'report', value: 'pdf' },
          ...((day.pvIds || []).length ? [{ label: `Envoyer les PV du jour (${day.pvIds.length})`, icon: 'camera', value: 'pv' }] : []),
          ...(day.rows.some(r => (r.photoIds || []).length + (r.anomIds || []).length + (r.retourIds || []).length) ? [{ label: `Toutes les photos du jour (${day.rows.reduce((a, r) => a + (r.photoIds || []).length + (r.anomIds || []).length + (r.retourIds || []).length, 0)})`, icon: 'image', value: 'allph' }] : []),
          { label: 'Fichier Excel (CSV)', icon: 'grid', value: 'csv' },
          { label: 'Envoyer vers Google Sheets (Drive)', icon: 'drive', value: 'sheets' },
        ]);
        if (v === 'txt') {
          const other = (await DB.byProject('receptions', day.projectId)).find(d => d.id !== day.id && d.date === day.date && kindOf(d) !== K && d.rows.some(r => r.element));
          let what = 'one';
          if (other) {
            const fer = isBeton(K) ? other : day, bet = isBeton(K) ? day : other;
            what = await menu(`Partager le ${fmtDate(day.date)}`, [
              { label: 'Réception ferraillage seule', icon: 'layers', value: 'fer' },
              { label: 'Programme de bétonnage seul', icon: 'calendar', value: 'bet' },
              { label: 'Réception + Bétonnage (un seul message)', icon: 'share', value: 'both' }]);
            if (!what) return;
            if (what === 'fer') return shareWhatsApp(receptionText(p, fer));
            if (what === 'bet') return shareWhatsApp(receptionText(p, bet));
            return shareWhatsApp(receptionText(p, fer).trim() + '\n\n━━━━━━━━━━\n\n' + receptionText(p, bet).trim());
          }
          shareWhatsApp(receptionText(p, day));
        }
        if (v === 'allph') { const ld = loading('Préparation des photos…'); try { await sharePhotos(day.rows.flatMap(r => [...(r.photoIds || []), ...(r.anomIds || []), ...(r.retourIds || [])]), `${recTitle(K)} du ${fmtDate(day.date)}`, `photos_${day.date}`); } finally { ld.close(); } }
        if (v === 'zone') {
          const zones = [...new Set(day.rows.filter(r => r.element).map(r => r.zone || ''))].sort((x, y) => (+x || 9999) - (+y || 9999));
          const z = await menu('Quelle zone ?', zones.map(zz => ({ label: zz ? `Zone ${zz}` : 'Sans zone', value: zz || '__none' })));
          if (z !== null && z !== undefined) shareWhatsApp(recMessage(p, day, day.rows.filter(r => (r.zone || '__none') === z)));
        }
        if (v === 'pick') {
          const rows = day.rows.filter(r => r.element).slice().sort(cmpZone);
          const sel = new Set();
          const sh = sheet(`<div>${rows.map((r, j) => `<label class="selrow"><input type="checkbox" data-j="${j}"><span>${(REC_STATUS[r.status] || REC_STATUS.pending).mark} ${esc([r.zone && 'Zone ' + r.zone, r.niv].filter(Boolean).join(' · '))} — ${esc(r.element)}</span></label>`).join('')}</div>
            <div class="btnrow"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="s">${icon('share')} Envoyer</button></div>`, { title: 'Choisir les ouvrages' });
          $$('[data-j]', sh.el).forEach(cb => cb.onchange = () => cb.checked ? sel.add(+cb.dataset.j) : sel.delete(+cb.dataset.j));
          $('[data-a=c]', sh.el).onclick = () => sh.close();
          $('[data-a=s]', sh.el).onclick = () => { if (!sel.size) return toast('Cochez au moins un ouvrage'); sh.close(); shareWhatsApp(recMessage(p, day, [...sel].map(j => rows[j]))); };
        }
        if (v === 'pdf') receptionPdf(p, day);
        if (v === 'pv') { const f = day.pvPdfId && await DB.get('files', day.pvPdfId); if (f) shareBlob(f.blob, `PV_${safeName(recTitle(K))}_${day.date}.pdf`); else sharePhotos(day.pvIds, `PV — ${recTitle(K)} du ${fmtDate(day.date)}`); }
        if (v === 'csv') receptionCsv(p, day);
        if (v === 'sheets') { await sendToSheets(p, day); await DB.put('receptions', day); }
      }

// ---------- Copier des ouvrages de la réception vers le programme de bétonnage ----------
function pickRows(rows, title) {
  return new Promise((resolve) => {
    const sel = new Set();
    const s = sheet(`<div class="form pk-rows"></div>`, { title });
    s.onClose = () => resolve(null);
    const box = $('.pk-rows', s.el);
    const draw = () => {
      box.innerHTML = `<div class="fr-tools"><button type="button" class="btn ghost small" data-pa="all">Tout</button><button type="button" class="btn ghost small" data-pa="none">Aucun</button></div>
        <div class="pk-list">${rows.map((r, i) => `<button type="button" class="pk-r ${sel.has(i) ? 'on' : ''}" data-i="${i}"><i>${sel.has(i) ? '☑' : '☐'}</i><span class="z">${esc(r.zone || '–')}</span><span class="n">${esc(r.niv || '')}</span><span class="grow">${esc(r.element)}</span></button>`).join('')}</div>
        <button class="btn" data-pa="ok" ${sel.size ? '' : 'disabled'}>${icon('check')} Copier ${sel.size} ouvrage(s)</button>`;
      $$('[data-i]', box).forEach(b => b.onclick = () => { const i = +b.dataset.i; sel.has(i) ? sel.delete(i) : sel.add(i); draw(); });
      $('[data-pa=all]', box).onclick = () => { rows.forEach((_, i) => sel.add(i)); draw(); };
      $('[data-pa=none]', box).onclick = () => { sel.clear(); draw(); };
      $('[data-pa=ok]', box).onclick = () => { const out = rows.filter((_, i) => sel.has(i)); s.onClose = null; s.close(); resolve(out); };
    };
    draw();
  });
}
async function copyToBeton(projectId, rows) {
  if (!rows || !rows.length) return;
  const t = todayISO(), tm = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  let date = await menu(`Copier ${rows.length > 1 ? rows.length + ' ouvrages' : '« ' + rows[0].element + ' »'} vers le bétonnage du…`, [
    { label: `Aujourd'hui · ${fmtDate(t)}`, icon: 'calendar', value: t }, { label: `Demain · ${fmtDate(tm)}`, icon: 'calendar', value: tm }, { label: 'Autre date…', icon: 'calendar', value: 'other' }]);
  if (!date) return;
  if (date === 'other') { const r = await formSheet('Date du bétonnage', [{ name: 'd', label: 'Date', type: 'date', value: t }], { okLabel: 'Copier' }); if (!r || !r.d) return; date = r.d; }
  const all = await DB.byProject('receptions', projectId);
  let d = all.find(x => isBeton(kindOf(x)) && x.date === date);
  if (!d) d = await DB.put('receptions', { projectId, date, type: 'Bétonnage', rows: [] });
  const key = (r) => normQ(`${r.zone}|${r.niv}|${r.element}`);
  const have = new Set(d.rows.map(key)); let n = 0, dup = 0;
  for (const r of rows) {
    if (have.has(key(r))) { dup++; continue; }
    d.rows.push({ id: DB.uid(), zone: r.zone || '', niv: r.niv || '', element: r.element, classe: r.classe || '', avec: '', pvRecu: false, status: 'progress', obs: '', photoIds: [], retourIds: [], fromRec: r.id });
    have.add(key(r)); n++;
  }
  await DB.put('receptions', d);
  toast(n ? `✓ ${n} ouvrage(s) ajouté(s) au bétonnage du ${fmtDate(date)}${dup ? ` · ${dup} déjà présent(s)` : ''}` : `Déjà dans le bétonnage du ${fmtDate(date)}`);
}

// ---------- Suivi décoffrage (planchers, dalles, poutres, escaliers…) ----------
// À partir du jour du bétonnage : J+7 / J+15 / J+28 (modifiables). Vert = délai atteint, orange = aujourd'hui, rouge = pas encore.
const DECOF_DEF = [7, 15, 28];
const decofDays = (p) => (p && Array.isArray(p.decofDays) && p.decofDays.length ? p.decofDays : DECOF_DEF);
const decofOn = (r) => r.decof === true || (r.decof !== false && /plancher|dalle|poutre|escalier|console|linteau|pr[ée]dalle|\bpl[_ ]?\d|\bpl\b/i.test(r.element || ''));
const decofAge = (iso) => Math.round((Date.parse(todayISO()) - Date.parse(iso)) / 864e5);
function decofCell(p, day, r) {
  if (!decofOn(r) || r.status !== 'ok') return '';
  if (r.decofAt) return `<span class="dcf-done">✓ Décoffré ${recDateLabel(r.decofAt).slice(0, 5)}</span>`;
  const a = decofAge(day.date);
  return `<span class="dcf-j">J+${a}</span><span class="dcf">${decofDays(p).map(d => `<i class="${a > d ? 'ok' : a === d ? 'today' : 'no'}" title="J+${d}">${d}</i>`).join('')}</span>`;
}
function decofList(p, days) {
  const out = [];
  for (const d of days) if (isBeton(kindOf(d))) for (const r of d.rows) if (r.element && r.status === 'ok' && decofOn(r) && !r.decofAt) out.push({ d, r, a: decofAge(d.date) });
  return out.sort((x, y) => y.a - x.a);
}
function decofBanner(p, days) {
  const L = decofList(p, days); if (!L.length) return '';
  const D = decofDays(p), ready = L.filter(x => x.a >= D[0]).length, today = L.filter(x => D.includes(x.a)).length;
  return `<button class="dcf-ban" data-a="decof"><span class="ic">🧱</span><span class="grow"><b>Suivi décoffrage</b><small>${L.length} élément(s) · <span class="g">${ready} ≥ J+${D[0]}</span>${today ? ` · <span class="o">${today} aujourd\u2019hui</span>` : ''}</small></span>${icon('chevright')}</button>`;
}
function openDecof(p) {
  return new Promise(async (resolve) => {
    const el = document.createElement('div'); el.className = 'fullpage'; document.body.appendChild(el);
    const unBack = pushBack(() => { el.remove(); resolve(); });
    const draw = async () => {
      const days = await DB.byProject('receptions', p.id), L = decofList(p, days), D = decofDays(p);
      el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:17px">Suivi décoffrage</h1><button class="iconbtn" data-a="cfg" title="Délais">${icon('settings')}</button></div>
        <div class="content"><div class="dcf-leg"><i class="ok"></i> délai atteint <i class="today"></i> aujourd\u2019hui <i class="no"></i> pas encore · délais : ${D.map(d => 'J+' + d).join(' / ')}</div>
        ${L.length ? `<div class="list">${L.map(({ d, r, a }, i) => `<div class="row dcf-it" data-i="${i}"><div class="grow"><div class="title wrap">${esc(r.element)}</div>
          <div class="sub">Bétonné le ${fmtDate(d.date)}${r.zone ? ' · Zone ' + esc(r.zone) : ''}${r.niv ? ' · ' + esc(r.niv) : ''}${r.classe ? ' · ' + esc(r.classe) : ''}</div>
          <div class="dcf-row">${decofCell(p, d, r)}</div></div><button class="btn small" data-ok="${i}">Décoffré</button></div>`).join('')}</div>`
        : '<div class="empty">Aucun élément à suivre.<br>Le suivi démarre quand un plancher / une poutre / une dalle est « bétonné » dans le programme de bétonnage.</div>'}</div>`;
      $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); resolve(); };
      $('[data-a=cfg]', el).onclick = async () => { const r = await formSheet('Délais de décoffrage (jours)', [{ name: 'v', label: 'Séparés par des virgules', value: D.join(', '), placeholder: '7, 15, 28' }], { okLabel: 'Enregistrer' }); if (r) { const v = String(r.v || '').split(/[,; ]+/).map(x => parseInt(x, 10)).filter(x => x > 0).sort((a, b) => a - b); p.decofDays = v.length ? v : DECOF_DEF; await DB.put('projects', p); draw(); } };
      $$('[data-ok]', el).forEach(b => b.onclick = async (e) => { e.stopPropagation(); const { d, r } = L[+b.dataset.ok]; r.decofAt = todayISO(); await DB.put('receptions', d); toast('Décoffré ✓'); draw(); });
      $$('.dcf-it', el).forEach(rw => rw.onclick = async (e) => { if (e.target.closest('[data-ok]')) return; const { d, r } = L[+rw.dataset.i]; await openReceptionDay(d, { focus: r.id }); draw(); });
    };
    draw();
  });
}

// ---------- Ouvrage placé sur un plan ----------
const recPinName = (r) => `${r.zone ? 'Z' + r.zone + ' · ' : ''}${r.element || ''}`.slice(0, 60);
async function pickPlanFor(projectId, niv) {
  const [plans, folders] = await Promise.all([DB.byProject('plans', projectId), DB.byProject('folders', projectId)]);
  const F = Object.fromEntries(folders.map(f => [f.id, folderPath(f, folders)]));
  const cur = plans.filter(p => typeof isCurrentPlan !== 'function' || isCurrentPlan(p));
  const n = normQ(niv || '');
  const score = (p) => (n && normQ(`${F[p.folderId] || ''} ${p.name}`).includes(n) ? 0 : 1);
  cur.sort((a, b) => score(a) - score(b) || (F[a.folderId] || '').localeCompare(F[b.folderId] || '', 'fr', { numeric: true }) || a.name.localeCompare(b.name, 'fr', { numeric: true }));
  if (!cur.length) { toast('Aucun plan dans ce projet'); return null; }
  const id = await menu(`Sur quel plan${niv ? ' (' + niv + ')' : ''} ?`, cur.slice(0, 40).map(p => ({ label: `${score(p) ? '' : '⭐ '}${F[p.folderId] ? F[p.folderId] + ' › ' : ''}${p.name}`, icon: 'plans', value: p.id })));
  return cur.find(p => p.id === id) || null;
}

// indice + date dans la même case : « P1 · 12/10/26 »
function indCell(ind, d) { if (!ind && !d) return ''; const ds = d ? d.split('-').reverse().map((x, i) => i === 2 ? x.slice(2) : x).join('/') : ''; return `${esc(ind || '—')}${ds ? ` <small class="ix-d">· ${ds}</small>` : ''}`; }
