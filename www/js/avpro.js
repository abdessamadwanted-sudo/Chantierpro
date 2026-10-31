// ================= v1.0.46 — Avancement « Pro Macro » : zones → niveaux → pins, saisie journalière, tableau de bord, rapports =================
// S'appuie sur le module Avancement (locaux = pins « local » sur le plan de chaque niveau).
// Nouveau : zones (Zone 1, Zone 2… ; chaque niveau appartient à une zone), équipes & responsables, journal quotidien par pin
// (lot, équipe, %, effectif, quantité, note, photos), pin « zone de travail » (façade, couloir… pas un local),
// étapes photo du local technique (maçonnerie, chape, nettoyage, porte provisoire… modifiables), types de chape colorés,
// dossier complet d'un local (PDF) à envoyer par WhatsApp, tableau de bord interactif et rapports PDF / Excel / WhatsApp.

const AVP_ETAPES = ['Maçonnerie', 'Chape', 'Nettoyage', 'Porte provisoire'];
const AVP_CHAPES = [['Chape ciment', '#64748b'], ['Chape allégée', '#0ea5e9'], ['Chape flottante / acoustique', '#a855f7'], ['Chape anhydrite', '#f59e0b']];
const AVP_TEAM_C = ['#2563eb', '#0d9488', '#7c3aed', '#ea580c', '#db2777', '#16a34a', '#0891b2', '#b45309'];

// ---------- réglages du projet ----------
const avZones = (p) => { if (!Array.isArray(p.avZones) || !p.avZones.length) p.avZones = ['Zone 1']; return p.avZones; };
const avZoneOf = (p, n) => (n && n.zone && avZones(p).includes(n.zone)) ? n.zone : avZones(p)[0];
const avEtapes = (p) => { if (!Array.isArray(p.avEtapes) || !p.avEtapes.length) p.avEtapes = AVP_ETAPES.map(n => ({ id: DB.uid(), name: n })); return p.avEtapes; };
const avChapes = (p) => { if (!Array.isArray(p.chapeTypes) || !p.chapeTypes.length) p.chapeTypes = AVP_CHAPES.map(([n, c]) => ({ id: DB.uid(), name: n, color: c })); return p.chapeTypes; };
const avTeams = (p) => { if (!Array.isArray(p.avTeams)) p.avTeams = []; return p.avTeams; };
const avTeam = (p, id) => avTeams(p).find(t => t.id === id);
const avDayISO = (d) => d.toISOString().slice(0, 10);
const avAddDays = (iso, k) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + k); return avDayISO(d); };

// pourcentage d'un pin pour un lot à une date (journal d'abord, sinon l'état actuel)
// v1.0.48 : journal trié une seule fois par pin et par lot (le tableau de bord appelait ce calcul des milliers de fois)
const _avJC = new WeakMap();
function avJSorted(loc, lotId) {
  const J0 = loc.journal || []; let c = _avJC.get(J0); if (!c) { c = {}; _avJC.set(J0, c); }
  return c[lotId] || (c[lotId] = J0.filter(e => e.lot === lotId).sort((a, b) => (a.d + (a.t || 0)).localeCompare(b.d + (b.t || 0))));
}
function avPctAt(loc, lotId, day) {
  const S = avJSorted(loc, lotId);
  if (S.length) { let lo = 0, hi = S.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (S[m].d <= day) { k = m; lo = m + 1; } else hi = m - 1; } return k >= 0 ? (+S[k].pct || 0) : 0; }   // 0 : première saisie après cette date
  const r = (loc.lots || {})[lotId]; if (r && r.state === 'done' && r.doneAt && r.doneAt > day) return 0;
  return avPct(r);
}
// une saisie du jour met aussi à jour l'état du lot dans le pin (même tableau que la fiche du local)
function avApplyEntry(loc, e) {
  loc.lots = loc.lots || {}; const r = loc.lots[e.lot] = loc.lots[e.lot] || { state: 'todo', photos: [] };
  const last = (loc.journal || []).filter(x => x.lot === e.lot).sort((a, b) => (b.d + (b.t || 0)).localeCompare(a.d + (a.t || 0)))[0];
  if (last && last.id !== e.id) return;   // une saisie plus récente existe : on ne revient pas en arrière
  const v = Math.max(0, Math.min(100, +e.pct || 0));
  if (v >= 100) { r.state = 'done'; r.doneAt = r.doneAt || e.d; r.pct = 100; } else if (v > 0) { r.state = 'progress'; r.pct = v; delete r.doneAt; } else { r.state = 'todo'; r.pct = 0; delete r.doneAt; }
  if (e.eq) r.eq = e.eq;
}

// ---------- saisie du jour sur un pin ----------
async function avJourForm(p, loc, pre = {}) {
  avLots(p); const lots = p.lots, teams = avTeams(p);
  const lot0 = pre.lot && lots.find(l => l.id === pre.lot) ? pre.lot : (lots.find(l => !avIsDone(avStatus((loc.lots || {})[l.id]))) || lots[0]).id;
  const cur = (lid) => avPctAt(loc, lid, todayISO());
  const r = await formSheet(`📅 ${loc.name} — saisie du jour`, [
    { name: 'info', type: 'info', label: 'Avancement actuel', value: lots.map(l => `${l.name} : ${cur(l.id)} %`).join(' · ') },
    { name: 'd', label: 'Date', type: 'date', value: pre.d || todayISO() },
    { name: 'lot', label: 'Lot', type: 'select', value: lot0, options: lots.map(l => ({ value: l.id, label: l.name })) },
    { name: 'eq', label: 'Équipe / responsable', type: 'select', value: pre.eq || ((loc.lots || {})[lot0] || {}).eq || '', options: [{ value: '', label: '—' }, ...teams.map(t => ({ value: t.id, label: `${t.name}${t.resp ? ' · ' + t.resp : ''}` })), { value: '__new', label: '➕ Nouvelle équipe…' }] },
    { name: 'pct', label: 'Avancement atteint (%)', type: 'select', value: String(Math.min(100, Math.ceil((cur(lot0) + 1) / 5) * 5)), options: Array.from({ length: 21 }, (_, i) => ({ value: String(i * 5), label: `${i * 5} %${i * 5 === 100 ? ' — terminé' : ''}` })) },
    { name: 'eff', label: 'Effectif (personnes)', type: 'number', value: pre.eff || '' },
    { name: 'qty', label: 'Quantité réalisée (facultatif)', value: '', placeholder: 'Ex : 24 m², 3 portes' },
    { name: 'note', label: 'Note', type: 'textarea', value: '', placeholder: 'Ce qui a été fait, ce qui bloque…' },
  ], { okLabel: 'Enregistrer' });
  if (!r) return null;
  if (+r.pct >= 100 && typeof avCheckReserves === 'function' && !(await avCheckReserves(p, [{ loc, pct: 100 }])).length) return null;
  let eq = r.eq;
  if (eq === '__new') { const t = await avTeamForm(p); eq = t ? t.id : ''; }
  const e = { id: DB.uid(), d: r.d || todayISO(), t: Date.now(), lot: r.lot, eq, pct: +r.pct || 0, eff: +r.eff || 0, qty: (r.qty || '').trim(), note: (r.note || '').trim(), photos: [], by: Team.ready() ? ((Team.me() || {}).name || '') : '' };
  e.prev = avPctAt(loc, e.lot, avAddDays(e.d, -1));
  loc.journal = [...(loc.journal || []), e]; avApplyEntry(loc, e);
  await DB.put('links', loc); await DB.put('projects', p);
  toast(`✓ ${loc.name} · ${avLot(p, e.lot).name} : ${e.pct} %`, { action: '📷 Photos', ms: 5000, onAction: async () => { const fs = await addPhotos(p.id, { local: loc.id, lot: e.lot, source: `${loc.name} · ${avLot(p, e.lot).name} · ${fmtDate(e.d)}` }); if (fs.length) { const L = await DB.get('links', loc.id); const x = (L.journal || []).find(z => z.id === e.id); if (x) { x.photos.push(...fs.map(f => f.id)); await DB.put('links', L); toast('Photos ajoutées ✓'); } } } });
  return e;
}
async function avTeamForm(p, t) {
  avLots(p);
  const r = await formSheet(t ? 'Modifier l\'équipe' : 'Nouvelle équipe', [
    { name: 'name', label: 'Nom de l\'équipe / sous-traitant', value: t ? t.name : '', placeholder: 'Ex : Équipe Rachid, STE Atlas' },
    { name: 'type', label: 'Type', type: 'select', value: t ? t.type || 'int' : 'int', options: [{ value: 'int', label: 'Équipe interne' }, { value: 'st', label: 'Sous-traitant' }, { value: 'tach', label: 'Tâcheron' }] },
    { name: 'soc', label: 'Société (sous-traitant)', value: t ? t.soc || '' : '', placeholder: 'Ex : STE Atlas SARL' },
    { name: 'resp', label: 'Responsable', value: t ? t.resp || '' : '', placeholder: 'Ex : chef d\'équipe' },
    { name: 'tel', label: 'Téléphone', type: 'tel', value: t ? t.tel || '' : '' },
    { name: 'lot', label: 'Lot principal', type: 'select', value: t ? t.lot || '' : '', options: [{ value: '', label: '—' }, ...p.lots.map(l => ({ value: l.id, label: l.name }))] },
  ], { okLabel: 'Enregistrer', danger: t ? 'Supprimer l\'équipe' : null });
  if (!r) return null;
  if (r.__danger) { p.avTeams = avTeams(p).filter(x => x !== t); await DB.put('projects', p); return null; }
  if (!r.name) return null;
  if (t) Object.assign(t, { name: r.name.trim(), resp: r.resp.trim(), tel: r.tel.trim(), lot: r.lot, type: r.type || 'int', soc: (r.soc || '').trim() });
  else { t = { id: DB.uid(), name: r.name.trim(), resp: r.resp.trim(), tel: r.tel.trim(), lot: r.lot, type: r.type || 'int', soc: (r.soc || '').trim(), color: AVP_TEAM_C[avTeams(p).length % AVP_TEAM_C.length] }; avTeams(p).push(t); }
  await DB.put('projects', p); return t;
}

// ---------- « Avancement du jour » (actions rapides du projet) ----------
async function openAvJour(p, day) {
  p = p || App.project; if (!p) return; avLots(p); day = day || todayISO();
  const el = document.createElement('div'); el.className = 'fullpage avj-page'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  async function draw() {
    const { locaux, nivs } = await avData(p);
    const E = locaux.flatMap(l => (l.journal || []).filter(e => e.d === day).map(e => ({ e, l, n: nivs.find(n => n.id === l.nivId) }))).filter(x => x.n);
    const byZ = {}; for (const x of E) (byZ[avPinZone(p, x.l, x.n)] = byZ[avPinZone(p, x.l, x.n)] || []).push(x);
    const eff = E.reduce((a, x) => a + (+x.e.eff || 0), 0), teamsN = new Set(E.map(x => x.e.eq).filter(Boolean)).size;
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:18px">Avancement du jour</h1>
        <button class="iconbtn" data-a="share" title="Partager">${icon('share')}</button></div>
      <div class="content avj-c">
        <div class="avj-day"><button data-a="prev">‹</button><label><input type="date" value="${day}" data-a="d"><b>${day === todayISO() ? 'Aujourd\'hui' : esc(fmtDate(day))}</b></label><button data-a="next" ${day >= todayISO() ? 'disabled' : ''}>›</button></div>
        <div class="avj-k"><div><b>${E.length}</b><span>saisie(s)</span></div><div><b>${eff}</b><span>personnes</span></div><div><b>${teamsN}</b><span>équipe(s)</span></div><div><b>${Object.keys(byZ).length}</b><span>zone(s)</span></div></div>
        <div class="avj-btns"><button class="btn avj-new" data-a="new">${icon('plus')} Saisie</button>${typeof openAvTable === 'function' ? `<button class="btn ghost" data-a="tab">${icon('grid')} Tableau rapide</button><button class="btn ghost" data-a="exp">⚡ Express</button>` : ''}</div>
        ${E.length ? Object.entries(byZ).map(([z, L]) => `<div class="avj-z"><div class="avj-zh">${esc(z)}<small>${L.length}</small></div>${L.sort((a, b) => (a.n.name + a.l.name).localeCompare(b.n.name + b.l.name, 'fr', { numeric: true })).map(({ e, l, n }) => { const lot = avLot(p, e.lot), t = avTeam(p, e.eq);
          return `<button class="avj-row" data-loc="${l.id}"><i style="background:${lot.color}"></i><span class="grow"><b>${esc(n.name)} · ${esc(l.name)}</b><small>${esc(lot.name)}${t ? ' · ' + esc(t.name) : ''}${e.eff ? ' · ' + e.eff + ' pers.' : ''}${e.qty ? ' · ' + esc(e.qty) : ''}${e.photos && e.photos.length ? ' · 📷 ' + e.photos.length : ''}</small>${e.note ? `<em>${esc(e.note)}</em>` : ''}</span>
            <span class="avj-p"><b>${e.pct}%</b>${e.prev != null && e.pct > e.prev ? `<small>+${e.pct - e.prev}</small>` : ''}</span></button>`; }).join('')}</div>`).join('')
          : '<div class="empty">Aucune saisie ce jour.<br>Touchez <b>Nouvelle saisie</b> : zone → niveau → local ou zone de travail.</div>'}
      </div>`;
    $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
    $('[data-a=prev]', el).onclick = () => { day = avAddDays(day, -1); draw(); };
    $('[data-a=next]', el).onclick = () => { if (day < todayISO()) { day = avAddDays(day, 1); draw(); } };
    $('[data-a=d]', el).onchange = (ev) => { if (ev.target.value) { day = ev.target.value; draw(); } };
    $('[data-a=new]', el).onclick = async () => { const loc = await avPickPin(p, nivs, locaux); if (loc && await avJourForm(p, loc, { d: day })) draw(); };
    $$('[data-loc]', el).forEach(b => b.onclick = async () => { const loc = locaux.find(l => l.id === b.dataset.loc); if (loc && await avJourForm(p, loc, { d: day })) draw(); });
    $('[data-a=share]', el).onclick = () => shareWhatsApp(avJourText(p, day, E));
    const tb = $('[data-a=tab]', el); if (tb) tb.onclick = () => openAvTable(p, { onClose: draw });
    const xb = $('[data-a=exp]', el); if (xb) xb.onclick = () => avExpress(p, draw);
  }
  draw();
  return el;
}
function avJourText(p, day, E) {
  const byZ = {}; for (const x of E) (byZ[avPinZone(p, x.l, x.n)] = byZ[avPinZone(p, x.l, x.n)] || []).push(x);
  return `*${p.name}* — Avancement du ${fmtDate(day)}\n${E.length} saisie(s) · ${E.reduce((a, x) => a + (+x.e.eff || 0), 0)} personne(s)\n` +
    Object.entries(byZ).map(([z, L]) => `\n*${z}*\n` + L.map(({ e, l, n }) => `• ${n.name} · ${l.name} — ${avLot(p, e.lot).name} : *${e.pct} %*${e.prev != null && e.pct > e.prev ? ` (+${e.pct - e.prev})` : ''}${avTeam(p, e.eq) ? ' · ' + avTeam(p, e.eq).name : ''}${e.eff ? ' · ' + e.eff + ' pers.' : ''}${e.note ? '\n   ' + e.note : ''}`).join('\n')).join('\n');
}
// choisir un pin : zone → niveau → pin (ou placer sur le plan)
async function avPickPin(p, nivs, locaux) {
  if (!nivs.length) { toast('Ajoutez d\'abord un niveau (Avancement › Ajouter un niveau)'); return null; }
  const nz = (l) => avPinZone(p, l, nivs.find(n => n.id === l.nivId));
  const Z = avZones(p).filter(z => locaux.some(l => nz(l) === z) || nivs.some(n => avZoneOf(p, n) === z));
  const lab = (z) => avSectOf(p, z) ? `${avSectOf(p, z)} · ${z}` : z;
  const z = Z.length > 1 ? await menu('Zone', Z.map(x => ({ label: lab(x), icon: 'layers', value: x }))) : Z[0]; if (!z) return null;
  const N = nivs.filter(n => locaux.some(l => l.nivId === n.id && nz(l) === z) || avZoneOf(p, n) === z);
  if (!N.length) return null;
  const nid = N.length > 1 ? await menu(`${z} · niveau`, N.map(n => ({ label: n.name, icon: 'plans', value: n.id }))) : N[0].id; if (!nid) return null;
  const L = locaux.filter(l => l.nivId === nid && nz(l) === z).sort(avNameSort);
  const v = await menu(`${(N.find(n => n.id === nid) || {}).name} · pin`, [...L.map(l => ({ label: `${l.type === 'travail' ? '▭' : '●'} ${l.name}`, value: l.id })), { label: '📍 Placer un nouveau pin sur le plan', value: '__plan' }]);
  if (!v) return null;
  if (v === '__plan') { await new Promise(res => openAvViewer(nid, null, res)); return null; }
  return L.find(l => l.id === v);
}

// ---------- tableau de bord « Pro Macro » ----------
// v1.0.47 : avProFilter / avProDash → av47.js (barre de choix, période, équipes & sous-traitants)
const avAvg = (L, lots, day) => { let s = 0, n = 0; for (const l of L) for (const lot of lots) { s += day ? avPctAt(l, lot.id, day) : avPct((l.lots || {})[lot.id]); n++; } return n ? Math.round(s / n) : 0; };
function avDonut(pct, color, size = 64, label = '') {
  const r = size / 2 - 6, C = 2 * Math.PI * r, o = C * (1 - pct / 100);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="avp-dn"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="7"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${o}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="${label ? '47%' : '54%'}" text-anchor="middle" font-size="${size / 4.6}" font-weight="800" fill="currentColor">${pct}%</text>${label ? `<text x="50%" y="68%" text-anchor="middle" font-size="${size / 8}" fill="var(--muted)">${esc(label)}</text>` : ''}</svg>`;
}
function avCurve(series, w = 320, h = 110) {
  if (!series.length) return '';
  const mx = 100, X = (i) => 6 + i * (w - 12) / Math.max(1, series.length - 1), Y = (v) => h - 18 - (h - 30) * v / mx;
  const pts = series.map((s, i) => `${X(i).toFixed(1)},${Y(s.v).toFixed(1)}`).join(' ');
  const last = series[series.length - 1], first = series[0];
  return `<svg viewBox="0 0 ${w} ${h}" class="avp-curve" preserveAspectRatio="none"><defs><linearGradient id="avpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${[25, 50, 75].map(v => `<line x1="0" x2="${w}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-dasharray="3 4"/>`).join('')}
    <polygon points="${X(0)},${h - 18} ${pts} ${X(series.length - 1)},${h - 18}" fill="url(#avpg)"/><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${X(series.length - 1)}" cy="${Y(last.v)}" r="4" fill="var(--accent)" stroke="#fff" stroke-width="2"/>
    <text x="4" y="${h - 4}" font-size="10" fill="var(--muted)">${esc(fmtDate(first.d).slice(0, 5))}</text><text x="${w - 4}" y="${h - 4}" font-size="10" text-anchor="end" fill="var(--muted)">${esc(fmtDate(last.d).slice(0, 5))} · ${last.v}%</text></svg>`;
}
function avTeamStats(p, L, per) {
  const from = avAddDays(todayISO(), -per + 1), T = {};
  for (const l of L) for (const e of l.journal || []) { if (!e.eq || e.d < from) continue;
    const t = T[e.eq] = T[e.eq] || { n: 0, gain: 0, eff: 0, effN: 0, lots: new Set(), pins: new Set(), last: '' };
    t.n++; t.gain += Math.max(0, (+e.pct || 0) - (+e.prev || 0)); if (e.eff) { t.eff += +e.eff; t.effN++; } t.lots.add(e.lot); t.pins.add(l.id); if (e.d > t.last) t.last = e.d; }
  return Object.entries(T).map(([id, t]) => ({ id, t: avTeam(p, id) || { name: '?', color: '#64748b' }, ...t, effM: t.effN ? Math.round(t.eff / t.effN) : 0 })).sort((a, b) => b.gain - a.gain);
}
async function avTeamsMenu(p) {
  for (;;) {
    const v = await menu('Équipes & sous-traitants', [...avTeams(p).map(t => ({ label: `${t.name}${t.type === 'st' ? ' · sous-traitant' : t.type === 'tach' ? ' · tâcheron' : ''}${t.resp ? ' · ' + t.resp : ''}`, swatch: t.color, value: t.id })), { label: 'Ajouter une équipe', icon: 'plus', value: '__add' }]);
    if (!v) return; if (v === '__add') await avTeamForm(p); else await avTeamForm(p, avTeam(p, v));
  }
}

// ---------- rapports ----------
async function avProExport(kind, p, nivs, locaux) {
  const { F, N, L, lots } = avProFilter(p, nivs, locaux), today = todayISO(), scope = [F.sect, F.zone || 'Toutes zones', F.niv ? (nivs.find(n => n.id === F.niv) || {}).name : '', F.lot ? avLot(p, F.lot).name : '', F.eq ? (avTeam(p, F.eq) || {}).name : ''].filter(Boolean).join(' · ');
  if (kind === 'plan') return avReportDialog({});
  if (kind === 'wa') {
    const z = avZones(p).map(zz => { const LL = L.filter(l => avPinZone(p, l, nivs.find(n => n.id === l.nivId)) === zz); return LL.length ? `\n*${zz}* : ${avAvg(LL, lots)} %\n` + lots.map(lot => `   ${lot.name} : ${avAvg(LL, [lot])} %`).join('\n') : ''; }).join('');
    const E = L.flatMap(l => (l.journal || []).filter(e => e.d === today).map(e => ({ e, l, n: nivs.find(n => n.id === l.nivId) })));
    return shareWhatsApp(`*${p.name}* — État d'avancement au ${fmtDate(today)}\n${scope}\nGlobal : *${avAvg(L, lots)} %*\n` + lots.map(lot => `• ${lot.name} : ${avAvg(L, [lot])} %`).join('\n') + z + (E.length ? `\n\n*Aujourd'hui* (${E.length} saisie(s))\n` + E.slice(0, 25).map(({ e, l, n }) => `• ${n ? n.name : ''} · ${l.name} — ${avLot(p, e.lot).name} ${e.pct} %${avTeam(p, e.eq) ? ' · ' + avTeam(p, e.eq).name : ''}`).join('\n') : ''));
  }
  if (kind === 'csv') {
    const q = (s) => `"${String(s == null ? '' : s).replace(/"/g, '""')}"`;
    const head = ['Zone', 'Niveau', 'Pin', 'Type', ...lots.map(l => l.name + ' %'), ...lots.map(l => l.name + ' état'), ...lots.map(l => l.name + ' équipe')];
    const rows = L.map(l => { const n = nivs.find(x => x.id === l.nivId); return [avPinZone(p, l, n), n ? n.name : '', l.name, l.type === 'travail' ? 'Zone de travail' : 'Local', ...lots.map(lot => avPct((l.lots || {})[lot.id])), ...lots.map(lot => AV_ST[avStatus((l.lots || {})[lot.id])][0]), ...lots.map(lot => ((avTeam(p, ((l.lots || {})[lot.id] || {}).eq)) || {}).name || '')]; });
    const J = L.flatMap(l => (l.journal || []).map(e => { const n = nivs.find(x => x.id === l.nivId); return [e.d, avPinZone(p, l, n), n ? n.name : '', l.name, avLot(p, e.lot).name, (avTeam(p, e.eq) || {}).name || '', e.prev, e.pct, e.eff || '', e.qty || '', e.note || '', e.by || '']; })).sort((a, b) => String(b[0]).localeCompare(String(a[0])));
    const csv = '﻿' + [`État d'avancement — ${p.name} — ${fmtDate(today)} — ${scope}`, head.map(q).join(';'), ...rows.map(r => r.map(q).join(';')), '', 'Journal quotidien', ['Date', 'Zone', 'Niveau', 'Pin', 'Lot', 'Équipe', '% avant', '% après', 'Effectif', 'Quantité', 'Note', 'Saisi par'].map(q).join(';'), ...J.map(r => r.map(q).join(';'))].join('\r\n');
    return shareBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), avFileName(`Avancement ${p.name} ${today}`) + '.csv');
  }
  if (kind === 'pdf') {
    const ld = loading('Création du rapport…');
    try {
      if (!window.jspdf && window.__late) await window.__late;
      const R = newDoc('État d\'avancement', p), { doc, M, W } = R;
      R.text(`État d'avancement — ${fmtDate(today)}`, { size: 17, bold: true, gap: 1 }); R.text(scope, { size: 10, color: [90, 90, 90], gap: 4 });
      const glob = avAvg(L, lots), tw = W - 2 * M;
      R.text(`Avancement global : ${glob} %`, { size: 13, bold: true, gap: 2 });
      // barres par lot
      for (const lot of lots) { const v = avAvg(L, [lot]); R.need(9); doc.setFontSize(10); doc.setTextColor(30, 30, 30); doc.text(pt(lot.name), M, R.y + 4.5);
        doc.setFillColor(232, 236, 242); doc.roundedRect(M + 45, R.y + 1, tw - 60, 5, 2, 2, 'F'); const [r, g, b] = hexRgb(lot.color); doc.setFillColor(r, g, b); if (v) doc.roundedRect(M + 45, R.y + 1, (tw - 60) * v / 100, 5, 2, 2, 'F');
        doc.setFont('helvetica', 'bold'); doc.text(`${v} %`, W - M, R.y + 4.5, { align: 'right' }); doc.setFont('helvetica', 'normal'); R.y += 8; }
      R.y += 4;
      // tableau zones/niveaux × lots
      const rows = (F.zone ? N.map(n => [n.name, L.filter(l => l.nivId === n.id)]) : avZones(p).map(z => [(avSectOf(p, z) ? avSectOf(p, z) + ' · ' : '') + z, L.filter(l => avPinZone(p, l, nivs.find(n => n.id === l.nivId)) === z)])).filter(r => r[1].length);
      if (rows.length) {
        R.text(F.zone ? 'Niveaux × lots' : 'Zones × lots', { size: 12, bold: true, gap: 2 });
        const cw = Math.min(28, (tw - 40) / (lots.length + 1)); R.need(8); doc.setFillColor(238, 240, 244); doc.rect(M, R.y, tw, 7, 'F'); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
        lots.forEach((l, i) => doc.text(pt(l.name).slice(0, 14), M + 40 + i * cw + cw / 2, R.y + 4.8, { align: 'center' })); doc.text('Total', M + 40 + lots.length * cw + cw / 2, R.y + 4.8, { align: 'center' }); R.y += 7;
        for (const [lab, LL] of rows) { R.need(8); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30, 30, 30); doc.text(pt(lab).slice(0, 24), M + 2, R.y + 5);
          lots.forEach((lot, i) => { const s = avStats(LL, lot.id), [r, g, b] = s.late ? [239, 68, 68] : s.pct === 100 ? [34, 197, 94] : hexRgb(lot.color); doc.setFillColor(r, g, b); doc.setGState && doc.setGState(new doc.GState({ opacity: 0.15 + 0.85 * s.pct / 100 }));
            doc.rect(M + 40 + i * cw + 1, R.y + 0.8, cw - 2, 6, 'F'); doc.setGState && doc.setGState(new doc.GState({ opacity: 1 })); doc.setTextColor(s.pct > 55 ? 255 : 30, s.pct > 55 ? 255 : 30, s.pct > 55 ? 255 : 30); doc.text(`${s.pct}%`, M + 40 + i * cw + cw / 2, R.y + 5, { align: 'center' }); });
          doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'bold'); doc.text(`${avAvg(LL, lots)}%`, M + 40 + lots.length * cw + cw / 2, R.y + 5, { align: 'center' }); R.y += 7.5; }
        R.y += 4;
      }
      if (typeof avLotPlanning === 'function') { const AL = []; for (const n of N) { const LL = L.filter(l => l.nivId === n.id); if (!LL.length) continue; for (const lot of lots) { const x = avLotPlanning(p, n, lot, LL); if (x.P.deb || x.P.fin || x.al.length) AL.push([n, lot, x]); } }
        if (AL.length) { R.text('Planning des lots', { size: 12, bold: true, gap: 2 }); for (const [n, lot, x] of AL) R.text(`${avZoneOf(p, n)} · ${n.name} · ${lot.name} — ${x.s.pct} % · prévu ${x.P.deb ? fmtDate(x.P.deb) : '—'} → ${x.P.fin ? fmtDate(x.P.fin) : '—'}${x.debR ? ' · réel ' + fmtDate(x.debR) : ''}${x.finR ? ' → ' + fmtDate(x.finR) : x.prev ? ' · prévision ' + fmtDate(x.prev) : ''}${x.al.length ? ' · ' + x.al.map(a => a[1]).join(' ; ') : ''}`, { size: 8.8, gap: 0.5, color: x.al.some(a => a[0] === 'r') ? [200, 40, 40] : [30, 30, 30] }); R.y += 3; } }
      const PER = typeof avPeriod === 'function' ? avPeriod(F) : { a: avAddDays(today, -F.per + 1), b: today, l: `${F.per} derniers jours` };
      const TS = typeof avTeamStats2 === 'function' ? avTeamStats2(p, L, lots, PER.a, PER.b) : avTeamStats(p, L, F.per);
      if (TS.length) { R.text(`Équipes & sous-traitants — ${PER.l}`, { size: 12, bold: true, gap: 2 }); for (const x of TS) R.text(`• ${x.t.name}${typeof avTType === 'function' ? ' [' + avTType(x.t)[1] + ']' : ''}${x.t.resp ? ' (' + x.t.resp + ')' : ''} — part ${x.part != null ? x.part + ' %' : '?'}, +${x.pts != null ? avF1(x.pts) : x.gain} pts, ${x.n} saisie(s), ${x.pins.size} pin(s)${x.effM ? ', ~' + x.effM + ' pers./j' : ''}${x.jh ? ', ' + x.jh + ' jours-homme' : ''}${x.late ? ', ' + x.late + ' en retard' : ''}`, { size: 9.5, gap: 0.6 }); R.y += 3; }
      const E = L.flatMap(l => (l.journal || []).filter(e => e.d >= avAddDays(today, -6)).map(e => ({ e, l, n: nivs.find(n => n.id === l.nivId) }))).sort((a, b) => (b.e.d + b.e.t).localeCompare(a.e.d + a.e.t));
      if (E.length) { R.text('Journal des 7 derniers jours', { size: 12, bold: true, gap: 2 }); for (const { e, l, n } of E.slice(0, 80)) R.text(`${fmtDate(e.d)} · ${avPinZone(p, l, n)} · ${n ? n.name : ''} · ${l.name} — ${avLot(p, e.lot).name} ${e.prev != null ? e.prev + ' → ' : ''}${e.pct} %${avTeam(p, e.eq) ? ' · ' + avTeam(p, e.eq).name : ''}${e.eff ? ' · ' + e.eff + ' pers.' : ''}${e.note ? ' — ' + e.note : ''}`, { size: 8.8, gap: 0.5 }); }
      R.finish(); await sharePdf(doc, avFileName(`Avancement ${p.name} ${today}`) + '.pdf');
    } catch (e) { console.error(e); alertBox('Rapport impossible : ' + (e.message || e)); } finally { ld.close(); }
  }
}
const hexRgb = (h) => { const m = String(h || '').replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [100, 116, 139]; };

// ---------- local technique : étapes photo, type de chape, dossier complet ----------
function avEtapesHTML(p, loc) {
  const E = avEtapes(p), st = loc.etapes = loc.etapes || {}, ch = avChapes(p).find(c => c.id === loc.chape);
  return `<div class="avp-et"><div class="avp-et-h"><b>Étapes du local</b><button class="btn ghost small" data-a="chape" style="--c:${ch ? ch.color : 'var(--muted)'}"><i class="avp-sw"></i>${ch ? esc(ch.name) : 'Type de chape'}</button></div>
    ${E.map(e => { const x = st[e.id] || {}; return `<div class="avp-etr ${x.done ? 'ok' : ''}"><button class="avp-ck" data-etok="${e.id}">${x.done ? '✓' : ''}</button><span class="grow"><b>${esc(e.name)}</b><small>${x.done && x.date ? 'fait le ' + esc(fmtDate(x.date)) : 'à faire'}${(x.photos || []).length ? ' · 📷 ' + x.photos.length : ''}</small></span>
      <button class="iconbtn sm" data-etph="${e.id}">${icon('camera')}</button>${(x.photos || []).length ? `<button class="iconbtn sm" data-etsee="${e.id}">${icon('image')}</button>` : ''}</div>`; }).join('')}
    <button class="btn small avp-dos" data-a="dossier">${icon('share')} Dossier complet (WhatsApp)</button></div>`;
}
function avEtapesBind(box, p, loc, save, rerender) {
  const st = loc.etapes = loc.etapes || {};
  $$('[data-etok]', box).forEach(b => b.onclick = async () => { const x = st[b.dataset.etok] = st[b.dataset.etok] || {}; x.done = !x.done; x.date = x.done ? todayISO() : null; await save(true); rerender(); });
  $$('[data-etph]', box).forEach(b => b.onclick = async () => { const e = avEtapes(p).find(z => z.id === b.dataset.etph); const fs = await addPhotos(p.id, { local: loc.id, etape: e.id, source: `${loc.name} · ${e.name}` }); if (fs.length) { const x = st[e.id] = st[e.id] || {}; x.photos = [...(x.photos || []), ...fs.map(f => f.id)]; await save(true); rerender(); } });
  $$('[data-etsee]', box).forEach(b => b.onclick = async () => { const e = avEtapes(p).find(z => z.id === b.dataset.etsee), fs = await loadFiles((st[e.id] || {}).photos || []); showGallery(fs.map(f => ({ src: BlobURL.get(f.id, f.blob), caption: `${loc.name} · ${e.name}`, fileId: f.id })), 0); });
  const cb = $('[data-a=chape]', box); if (cb) cb.onclick = async () => { const v = await menu('Type de chape', [...avChapes(p).map(c => ({ label: c.name, swatch: c.color, value: c.id, checked: loc.chape === c.id })), { label: 'Aucun', value: '__none' }, { label: 'Modifier la liste des types…', icon: 'edit', value: '__edit' }]);
    if (!v) return; if (v === '__edit') { await avListEdit(p, 'chape'); return rerender(); } loc.chape = v === '__none' ? null : v; await save(true); rerender(); };
  const db = $('[data-a=dossier]', box); if (db) db.onclick = () => avDossierLocal(p, loc);
}
// modifier les listes : étapes photo / types de chape / zones
async function avListEdit(p, kind) {
  const L = kind === 'chape' ? avChapes(p) : kind === 'ltype' ? avLocTypes(p) : kind === 'zone' ? null : avEtapes(p), title = { chape: 'Types de chape', etape: 'Étapes du local', zone: 'Zones (joints)', ltype: 'Types de local (code couleur)' }[kind];
  for (;;) {
    const items = kind === 'zone' ? avZones(p).map(z => ({ label: z, icon: 'layers', value: z })) : L.map(x => ({ label: x.name, swatch: x.color, icon: x.color ? null : 'check', value: x.id }));
    const v = await menu(title, [...items, { label: 'Ajouter', icon: 'plus', value: '__add' }]); if (!v) break;
    if (v === '__add') { const r = await formSheet(`${title} — ajouter`, [{ name: 'n', label: 'Nom' }], { okLabel: 'Ajouter' }); if (r && r.n) { if (kind === 'zone') avZones(p).push(r.n.trim()); else L.push({ id: DB.uid(), name: r.n.trim(), ...(kind === 'chape' || kind === 'ltype' ? { color: AVP_TEAM_C[L.length % AVP_TEAM_C.length] } : {}) }); } continue; }
    const cur = kind === 'zone' ? v : L.find(x => x.id === v).name;
    const a = await menu(cur, [{ label: 'Renommer', icon: 'edit', value: 'ren' }, ...(kind === 'chape' || kind === 'ltype' ? [{ label: 'Couleur', icon: 'fill', value: 'col' }] : []), { label: 'Supprimer', icon: 'trash', danger: true, value: 'del' }]);
    if (a === 'ren') { const r = await formSheet('Renommer', [{ name: 'n', label: 'Nom', value: cur }]); if (r && r.n) { if (kind === 'zone') { const i = avZones(p).indexOf(v); p.avZones[i] = r.n.trim(); (p.avNiveaux || []).forEach(n => { if (n.zone === v) n.zone = r.n.trim(); }); } else L.find(x => x.id === v).name = r.n.trim(); } }
    if (a === 'col') { const c = await menu('Couleur', AV_LOT_COLORS.concat(['#0ea5e9', '#a855f7', '#f59e0b', '#64748b']).map(x => ({ label: x, swatch: x, value: x }))); if (c) L.find(x => x.id === v).color = c; }
    if (a === 'del') { if (kind === 'zone') { if (avZones(p).length < 2) { toast('Il faut au moins une zone'); continue; } p.avZones = avZones(p).filter(z => z !== v); (p.avNiveaux || []).forEach(n => { if (n.zone === v) n.zone = p.avZones[0]; }); } else { const i = L.findIndex(x => x.id === v); L.splice(i, 1); } }
  }
  await DB.put('projects', p);
}
// dossier complet d'un local : fiche, extrait du plan, lots, étapes et photos → PDF partagé (WhatsApp…)
async function avDossierLocal(p, loc) {
  const ld = loading('Préparation du dossier…');
  try {
    if (!window.jspdf && window.__late) await window.__late;
    const niv = (p.avNiveaux || []).find(n => n.id === loc.nivId) || { name: '' }, plan = await latestPlanOfSerie(p.id, niv.serieId);
    const R = newDoc('Dossier du local', p), { doc, M, W } = R, ch = avChapes(p).find(c => c.id === loc.chape);
    R.text(`${loc.name}`, { size: 18, bold: true, gap: 1 });
    R.text(`${avSectOf(p, avPinZone(p, loc, niv)) ? avSectOf(p, avPinZone(p, loc, niv)) + ' · ' : ''}${avPinZone(p, loc, niv)} · ${niv.name}${loc.anep ? ' · ANEP ' + loc.anep : ''}${loc.area ? ' · ' + loc.area + ' m²' : ''}${(avLocTypes(p).find(t => t.id === loc.ltype) || {}).name ? ' · ' + avLocTypes(p).find(t => t.id === loc.ltype).name : ''}${ch ? ' · ' + ch.name : ''}${loc.type === 'travail' ? ' · zone de travail' : ' · local technique'}`, { size: 10.5, color: [80, 80, 80], gap: 4 });
    if (plan) { try { const k = 900, cx = Math.max(0, loc.x - k / 2), cy = Math.max(0, loc.y - k / 2), cw = Math.min(k, plan.w - cx), chh = Math.min(k, plan.h - cy);
      const c = await avPlanCanvas(p, plan, [loc], avLots(p)[0], { maxSide: 1400, crop: [cx, cy, cw, chh] }); const g = c.getContext('2d'), s = c.width / cw;
      g.strokeStyle = '#ef4444'; g.lineWidth = Math.max(4, c.width / 120); g.beginPath(); g.arc((loc.x - cx) * s, (loc.y - cy) * s, Math.max(30, c.width / 18), 0, Math.PI * 2); g.stroke();
      const url = c.toDataURL('image/jpeg', 0.85), w = W - 2 * M, h = Math.min(110, w * c.height / c.width); R.need(h + 4); doc.addImage(url, 'JPEG', M, R.y, h * c.width / c.height, h); R.y += h + 5; } catch (e) { console.warn('extrait', e); } }
    R.text('Avancement par lot', { size: 12, bold: true, gap: 1.5 });
    for (const lot of avLots(p)) { const r = (loc.lots || {})[lot.id] || {}, k = avStatus(r); R.text(`• ${lot.name} : ${avPct(r)} % — ${AV_ST[k][0]}${r.due ? ' · engagement ' + fmtDate(r.due) : ''}${r.doneAt ? ' · fini le ' + fmtDate(r.doneAt) : ''}${avTeam(p, r.eq) ? ' · ' + avTeam(p, r.eq).name : ''}`, { size: 9.5, gap: 0.5 }); }
    R.y += 3;
    const photoRow = async (ids, title) => { const fs = await loadFiles(ids || []); if (!fs.length) return; R.text(title, { size: 11, bold: true, gap: 1.5 });
      let x = M; const bh = 44; R.need(bh + 3);
      for (const f of fs.slice(0, 12)) { if (!f.blob) continue; const im = await blobToJpegURL(f.blob, 700); let w = im.w * (bh / im.h); if (w > 66) w = 66; if (x + w > W - M) { R.y += bh + 3; x = M; R.need(bh + 3); } doc.addImage(im.url, 'JPEG', x, R.y, w, w * im.h / im.w > bh ? bh : w * im.h / im.w); x += w + 3; }
      R.y += bh + 5; };
    for (const e of avEtapes(p)) { const x = (loc.etapes || {})[e.id] || {}; R.text(`${x.done ? '✓' : '○'} ${e.name}${x.done && x.date ? ' — fait le ' + fmtDate(x.date) : ' — à faire'}`, { size: 10.5, bold: !!x.done, color: x.done ? [22, 130, 70] : [90, 90, 90], gap: 1 }); await photoRow(x.photos, `Photos — ${e.name}`); }
    for (const lot of avLots(p)) await photoRow(((loc.lots || {})[lot.id] || {}).photos, `Photos — ${lot.name}`);
    const J = (loc.journal || []).slice().sort((a, b) => (b.d + b.t).localeCompare(a.d + a.t));
    if (J.length) { R.text('Journal', { size: 11, bold: true, gap: 1.5 }); for (const e of J.slice(0, 40)) R.text(`${fmtDate(e.d)} — ${avLot(p, e.lot).name} ${e.prev != null ? e.prev + ' → ' : ''}${e.pct} %${avTeam(p, e.eq) ? ' · ' + avTeam(p, e.eq).name : ''}${e.eff ? ' · ' + e.eff + ' pers.' : ''}${e.note ? ' — ' + e.note : ''}`, { size: 9, gap: 0.4 }); }
    R.finish(); ld.close(); await sharePdf(doc, avFileName(`Dossier ${loc.name} ${niv.name} ${p.name}`) + '.pdf');
  } catch (e) { ld.close(); console.error(e); alertBox('Dossier impossible : ' + (e.message || e)); }
}
