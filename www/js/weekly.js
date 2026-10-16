// ================= Rapport hebdomadaire PDF (conducteur / direction) : réception, bétonnage, PV, réserves, avancement, journaux =================
const wkISO = (d) => d.toISOString().slice(0, 10);
function weekRange(offset = 0, ref = new Date()) {
  const d = new Date(ref); d.setHours(12, 0, 0, 0); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow + offset * 7);
  const e = new Date(d); e.setDate(d.getDate() + 6); return { a: wkISO(d), b: wkISO(e) };
}
async function weeklyReportDialog() {
  const p = App.project; const W0 = weekRange(0), W1 = weekRange(-1);
  const v = await menu('Rapport hebdomadaire (PDF)', [
    { label: `Cette semaine · ${fmtDate(W0.a)} → ${fmtDate(W0.b)}`, icon: 'calendar', value: '0' },
    { label: `Semaine dernière · ${fmtDate(W1.a)} → ${fmtDate(W1.b)}`, icon: 'calendar', value: '-1' },
    { label: 'Choisir une date…', icon: 'edit', value: 'pick' }]);
  if (!v) return;
  let W = v === 'pick' ? null : weekRange(+v);
  if (!W) { const r = await formSheet('Semaine contenant le…', [{ name: 'd', label: 'Date', type: 'date', value: todayISO() }], { okLabel: 'Créer' }); if (!r || !r.d) return; W = weekRange(0, new Date(r.d + 'T12:00:00')); }
  const ld = loading('Préparation du rapport…');
  try { const doc = await buildWeeklyPdf(p, W); ld.close(); await sharePdf(doc, `Hebdo_${safeName(p.name)}_${W.a}.pdf`); }
  catch (e) { ld.close(); console.error(e); alertBox('Erreur : ' + (e.message || e)); }
}
async function buildWeeklyPdf(p, W) {
  const pid = p.id, inW = (d) => d && d >= W.a && d <= W.b;
  const [recs, tasks, reports, links] = await Promise.all([DB.byProject('receptions', pid), DB.byProject('tasks', pid), DB.byProject('reports', pid), DB.byProject('links', pid)]);
  const days = recs.filter(d => inW(d.date)).sort((a, b) => a.date.localeCompare(b.date));
  const rowsOf = (d) => (d.rows || []).filter(r => r.element);
  const fer = days.filter(d => kindOf(d) !== 'Bétonnage'), bet = days.filter(d => kindOf(d) === 'Bétonnage');
  const sum = (ds, f) => ds.reduce((a, d) => a + rowsOf(d).filter(f).length, 0);
  const allPvMiss = recs.flatMap(d => rowsOf(d).filter(pvMissing).map(r => ({ d, r }))).sort((x, y) => x.d.date.localeCompare(y.d.date));
  const toBet = recs.flatMap(d => rowsOf(d).filter(pvToBet)).length;
  const wStart = new Date(W.a + 'T00:00:00').getTime(), wEnd = new Date(W.b + 'T23:59:59').getTime();
  const tNew = tasks.filter(t => (t.createdAt || 0) >= wStart && (t.createdAt || 0) <= wEnd);
  const tLift = tasks.filter(t => isLifted(t) && (t.log || []).some(l => l.t >= wStart && l.t <= wEnd));
  const tOpen = tasks.filter(t => !isLifted(t)), tLate = tasks.filter(isLate);
  const reps = reports.filter(r => inW(r.date)).sort((a, b) => a.date.localeCompare(b.date));

  const C = newDoc(`Rapport hebdomadaire ${fmtDate(W.a)} - ${fmtDate(W.b)}`, p), { doc, M, W: PW } = C;
  C.text(`Rapport hebdomadaire`, { size: 18, bold: true, gap: 0 });
  C.text(`${p.pdfTitle || p.name} · semaine du ${fmtDate(W.a)} au ${fmtDate(W.b)}`, { size: 10.5, color: [80, 90, 110], gap: 4 });
  // indicateurs
  const K = [
    ['Ferraillage réceptionné', `${sum(fer, r => r.status === 'ok')} / ${sum(fer, () => true)}`, [37, 99, 235]],
    ['Éléments bétonnés', `${sum(bet, r => r.status === 'ok')} / ${sum(bet, () => true)}`, [100, 116, 139]],
    ['PV manquants (total)', String(allPvMiss.length), allPvMiss.length ? [220, 38, 38] : [22, 163, 74]],
    ['PV à livrer au BET', String(toBet), toBet ? [234, 88, 12] : [22, 163, 74]],
    ['Réserves ouvertes', `${tOpen.length}${tLate.length ? ` (${tLate.length} en retard)` : ''}`, tLate.length ? [234, 88, 12] : [71, 85, 105]],
    ['Réserves levées / créées', `${tLift.length} / ${tNew.length}`, [22, 163, 74]],
  ];
  const bw = (PW - 2 * M - 10) / 3, bh = 19;
  K.forEach(([l, v, c], i) => { const x = M + (i % 3) * (bw + 5), y = C.y + Math.floor(i / 3) * (bh + 4);
    doc.setFillColor(245, 247, 250); doc.setDrawColor(...c); doc.setLineWidth(.6); doc.roundedRect(x, y, bw, bh, 2, 2, 'FD');
    doc.setTextColor(...c); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(pt(v), x + 4, y + 9);
    doc.setTextColor(80, 90, 110); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(pt(l), x + 4, y + 15.5); });
  C.y += 2 * (bh + 4) + 4;
  // tableau par jour
  const table = (head, rows, widths, colorOf) => {
    const x0 = M, rh = 6.4; let y;
    const hdr = () => { C.need(rh + 2); y = C.y; doc.setFillColor(30, 41, 59); doc.rect(x0, y, PW - 2 * M, rh, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); let x = x0; head.forEach((h, i) => { doc.text(pt(h), x + 1.8, y + 4.4); x += widths[i]; }); C.y += rh; };
    hdr();
    rows.forEach((r, k) => { if (C.y + rh > C.H - 16) { doc.addPage(); C.header(); hdr(); } y = C.y; if (k % 2) { doc.setFillColor(246, 248, 251); doc.rect(x0, y, PW - 2 * M, rh, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); let x = x0;
      r.forEach((c, i) => { const col = colorOf && colorOf(i, c, r); doc.setTextColor(...(col || [30, 30, 30])); doc.text(doc.splitTextToSize(pt(String(c ?? '')), widths[i] - 3)[0] || '', x + 1.8, y + 4.4); x += widths[i]; });
      C.y += rh; });
    C.y += 4;
  };
  const sec = (t) => { C.need(14); C.y += 2; C.text(t, { size: 12.5, bold: true, color: [30, 41, 59], gap: 1.5 }); };
  sec('Réception & bétonnage par jour');
  if (days.length) table(['Date', 'Type', 'Éléments', 'Réceptionnés / bétonnés', 'Réserves', 'PV manquants'],
    days.map(d => { const R = rowsOf(d); return [fmtDate(d.date), kindOf(d) === 'Bétonnage' ? 'Bétonnage' : 'Ferraillage', R.length, R.filter(r => r.status === 'ok').length, R.filter(r => r.status === 'reserve').length, R.filter(pvMissing).length]; }),
    [26, 30, 24, 46, 26, 30], (i, c) => (i === 4 || i === 5) && +c > 0 ? [220, 38, 38] : null);
  else C.text('Aucun tableau cette semaine.', { color: [120, 120, 120] });
  // éléments en réserve de la semaine
  const res = days.flatMap(d => rowsOf(d).filter(r => r.status === 'reserve').map(r => [fmtDate(d.date), r.zone || '', r.niv || '', r.element, r.obs || '']));
  if (res.length) { sec(`Éléments en réserve (${res.length})`); table(['Date', 'Zone', 'Niv', 'Élément', 'Observation'], res, [22, 14, 16, 60, 70]); }
  // PV manquants
  sec(`PV de réception manquants (${allPvMiss.length})`);
  if (allPvMiss.length) table(['Date', 'Zone', 'Niv', 'Élément', 'Attente'], allPvMiss.slice(0, 80).map(({ d, r }) => [fmtDate(d.date), r.zone || '', r.niv || '', r.element, `${Math.max(0, Math.round((Date.now() - new Date(d.date + 'T12:00:00')) / 864e5))} j`]), [24, 16, 18, 92, 32], (i, c) => i === 4 && parseInt(c) > 3 ? [220, 38, 38] : null);
  else C.text('✓ Tous les PV sont récupérés.', { color: [22, 163, 74] });
  // réserves en retard
  if (tLate.length) { sec(`Réserves en retard (${tLate.length})`); table(['N°', 'Réserve', 'Échéance', 'Statut'], tLate.slice(0, 60).map(t => ['#' + (t.num || ''), t.title || '', fmtDate(t.due), (STATUS[t.status] || {}).label || '']), [14, 112, 28, 28]); }
  // avancement second œuvre
  const locs = links.filter(l => l.kind === 'local');
  if (locs.length) {
    const lots = (p.lots && p.lots.length) ? p.lots : AV_DEFAULT_LOTS;
    sec('Avancement second œuvre');
    table(['Lot', 'Avancement', 'Terminés', 'En cours', 'En retard'], lots.map(l => { const s = avStats(locs, l.id); return [l.name, s.pct + ' %', s.fin, s.progress, s.late]; }), [60, 32, 30, 30, 30], (i, c) => i === 4 && +c > 0 ? [220, 38, 38] : null);
  }
  // journaux
  if (reps.length) { sec('Rapports journaliers'); for (const r of reps) { C.text(fmtDate(r.date) + (r.meteo ? ' · ' + r.meteo : '') + (r.effectif ? ' · effectif ' + r.effectif : ''), { bold: true, size: 9.5, gap: .5 }); const t = [r.travaux, r.problemes, r.obs].filter(Boolean).join(' — '); if (t) C.text(t, { size: 9, indent: 3, gap: 2 }); } }
  C.finish();
  return doc;
}
