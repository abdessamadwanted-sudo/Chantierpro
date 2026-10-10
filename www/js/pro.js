// Fonctions « pro » (concept Bulldozair / Mezzoteam) :
// entreprises (lots), réserves en retard, tableau de bord, rapports PDF, signatures.
const COMPANY_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b'];
const LOTS = ['Gros œuvre', 'Terrassement', 'Maçonnerie', 'Plâtrerie', 'Charpente', 'Charpente métallique', 'Façade', 'Étanchéité', 'Électricité', 'Plomberie', 'CVC', 'Menuiserie', 'Carrelage', 'Revêtements', 'Peinture', 'VRD', 'Bureau de contrôle'];
const KINDS = { reserve: 'Réserve', observation: 'Observation', tache: 'Tâche' };

const isLate = (t) => t.due && (t.status === 'open' || t.status === 'progress') && t.due < todayISO();
const isLifted = (t) => t.status === 'done' || t.status === 'verified';
const companyOf = (project, id) => (project.companies || []).find(c => c.id === id) || null;

// ---------- Entreprises ----------
async function editCompany(project, company) {
  const r = await formSheet(company ? 'Modifier l\'entreprise' : 'Nouvelle entreprise', [
    { name: 'name', label: 'Nom de l\'entreprise', value: company?.name, placeholder: 'Ex : SGTM, TGCC, Sous-traitant ferraillage…' },
    { name: 'lot', label: 'Lot (choisir ou écrire un autre)', value: company?.lot || '', placeholder: 'Ex : Maçonnerie, Plâtrerie, Charpente…', list: LOTS },
    { name: 'contact', label: 'Contact (nom / téléphone)', value: company?.contact },
  ], { danger: company ? 'Supprimer l\'entreprise' : null });
  if (!r) return null;
  project.companies = project.companies || [];
  if (r.__danger) {
    if (!await confirmBox(`Supprimer « ${company.name} » ? (les réserves restent, sans entreprise)`)) return null;
    project.companies = project.companies.filter(c => c.id !== company.id);
  } else if (r.name) {
    if (company) Object.assign(company, r);
    else { company = { id: DB.uid(), color: COMPANY_COLORS[project.companies.length % COMPANY_COLORS.length], ...r }; project.companies.push(company); }
  } else return null;
  await DB.put('projects', project);
  if (App.project && App.project.id === project.id) App.project = project;
  return company;
}

// ---------- Tableau de bord ----------
async function renderDashboard(root) {
  const p = App.project; const pid = p.id;
  const [tasks, forms, reports, plans] = await Promise.all([DB.byProject('tasks', pid), DB.byProject('forms', pid), DB.byProject('reports', pid), DB.byProject('plans', pid)]);
  const nPv = (await missingPvs(pid)).length;
  const total = tasks.length, lifted = tasks.filter(isLifted).length, late = tasks.filter(isLate), toLift = total - lifted;
  const rate = total ? Math.round(lifted / total * 100) : 0;
  const comps = [...(p.companies || []), { id: '', name: 'Sans entreprise', color: '#64748b' }]
    .map(c => { const ts = tasks.filter(t => (t.companyId || '') === c.id); return { c, n: ts.length, lifted: ts.filter(isLifted).length, late: ts.filter(isLate).length }; })
    .filter(x => x.n || x.c.id);
  const fs = forms.map(formStats);
  const conf = fs.filter(s => s.status === 'Conforme').length, nconf = fs.filter(s => s.status === 'Non conforme').length;
  const activity = tasks.flatMap(t => (t.log || []).map(l => ({ ...l, t2: t }))).sort((a, b) => b.t - a.t).slice(0, 6);

  root.innerHTML = `
    <div class="pagehead"><h2>Tableau de bord</h2><p>${esc(p.name)}${p.address ? ' · ' + esc(p.address) : ''}</p></div>
    ${late.length ? `<div class="alert" data-a="late">${icon('calendar')}<div><b>${late.length} réserve(s) en retard</b><br><span>Échéance dépassée — touchez pour voir</span></div></div>` : ''}
    ${nPv ? `<div class="alert pv" data-a="pvmiss">${icon('report')}<div><b>🔔 ${nPv} PV de réception pas encore reçu(s)</b><br><span>Touchez pour voir la liste et cocher les PV reçus</span></div></div>` : ''}
    <div class="kpis">
      <div class="kpi" data-f="toLift"><div class="v" style="color:var(--red)">${toLift}</div><div class="l">À lever</div></div>
      <div class="kpi" data-f="late"><div class="v" style="color:var(--orange)">${late.length}</div><div class="l">En retard</div></div>
    </div>
    <div class="card dash">
      <div class="dash-h">Avancement par entreprise</div>
      ${comps.length ? comps.map(x => `
        <div class="crow" data-c="${x.c.id}">
          <div class="ctop"><span class="dot" style="background:${x.c.color}"></span><span class="cn">${esc(x.c.name)}</span>
            <span class="cs">${x.n - x.lifted} à lever${x.late ? ` · <b style="color:var(--orange)">${x.late} en retard</b>` : ''}</span></div>
          <div class="progress"><div style="width:${x.n ? x.lifted / x.n * 100 : 0}%;background:${x.c.color}"></div></div>
        </div>`).join('') : `<div class="muted">Ajoutez des entreprises dans « Équipe » puis affectez-leur des réserves.</div>`}
      <button class="btn ghost small" data-a="addco" style="margin-top:10px">${icon('plus')} Entreprise</button>
    </div>
    <div class="card dash">
      <div class="dash-h">Rapports PDF</div>
      <button class="btn" data-a="pdf" style="width:100%">${icon('report')} Rapport des réserves (PDF)</button>
      <div class="muted" style="margin-top:8px">Par entreprise ou global, avec extraits de plan et photos — à envoyer par WhatsApp ou e-mail.</div>
    </div>
    ${activity.length ? `<div class="card dash"><div class="dash-h">Activité récente</div><div class="log">${activity.map(a =>
      `<div data-t="${a.t2.id}"><b>#${a.t2.num}</b> ${esc(a.msg)} <span style="float:right">${fmtDateTime(a.t)}</span></div>`).join('')}</div></div>` : ''}`;

  const goTasks = (status, company) => { App.section = 'tasks'; App.taskFilter = status; App.companyFilter = company ?? 'all'; renderSection(); };
  $$('.kpi[data-f]', root).forEach(k => k.onclick = () => goTasks(k.dataset.f));
  const al = $('[data-a=late]', root); if (al) al.onclick = () => goTasks('late');
  $$('.crow', root).forEach(r => r.onclick = () => goTasks('all', r.dataset.c));
  const pvm = $('[data-a=pvmiss]', root); if (pvm) pvm.onclick = () => goMissingPv();
  $('[data-a=addco]', root).onclick = async () => { if (await editCompany(App.project)) renderDashboard(root); };
  $('[data-a=pdf]', root).onclick = () => reservesReportDialog();
  $$('.log [data-t]', root).forEach(d => d.onclick = async () => { await openTaskDetail(tasks.find(t => t.id === d.dataset.t)); renderDashboard(root); });
}

// ---------- Signature ----------
function signaturePad(container, value, onChange) {
  container.innerHTML = `<canvas class="sig"></canvas><div class="sig-bar"><span>Signez dans le cadre</span><button class="btn small ghost" type="button">Effacer</button></div>`;
  const c = $('canvas', container), ctx = c.getContext('2d');
  const W = container.clientWidth || 320, H = 150, dpr = window.devicePixelRatio || 1;
  c.width = W * dpr; c.height = H * dpr; c.style.height = H + 'px';
  ctx.scale(dpr, dpr); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
  const paintBg = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); };
  paintBg();
  if (value) loadImage(value).then(im => ctx.drawImage(im, 0, 0, W, H)).catch(() => {});
  let drawing = false, last = null, dirty = false;
  const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  c.addEventListener('pointerdown', (e) => { e.preventDefault(); c.setPointerCapture(e.pointerId); drawing = true; last = pos(e); });
  c.addEventListener('pointermove', (e) => {
    if (!drawing) return; const p = pos(e);
    ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke(); last = p; dirty = true;
  });
  const end = () => { if (!drawing) return; drawing = false; if (dirty) onChange(c.toDataURL('image/png')); };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  $('button', container).onclick = () => { paintBg(); dirty = false; onChange(''); };
}

// ---------- PDF : outils ----------
const pt = (s) => String(s ?? '').replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/→/g, '->').replace(/[^\x00-\xFF]/g, '');
const hexRGB = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

async function blobToJpegURL(blob, max = 900) {
  const url = URL.createObjectURL(blob);
  try {
    const im = await loadImage(url);
    const r = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * r); c.height = Math.round(im.naturalHeight * r);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0, c.width, c.height);
    return { url: c.toDataURL('image/jpeg', 0.8), w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}

function drawPinOn(ctx, x, y, label, color, size) {
  ctx.save(); ctx.translate(x, y); const s = size / 30; ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-4, -10, -14, -14, -14, -26); ctx.arc(0, -26, 14, Math.PI, 0); ctx.bezierCurveTo(14, -14, 4, -10, 0, 0);
  ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(label), 0, -26);
  ctx.restore();
}

const planImgCache = new Map();
async function planImage(plan) {
  if (planImgCache.has(plan.id)) return planImgCache.get(plan.id);
  const f = await DB.get('files', plan.fileId);
  const im = f ? await loadImage(BlobURL.get(f.id, f.blob)) : null;
  planImgCache.set(plan.id, im);
  return im;
}

// Extrait du plan centré sur la réserve
async function planSnippet(plan, task) {
  const im = await planImage(plan); if (!im) return null;
  const k = im.naturalWidth / plan.w;
  const side = Math.max(plan.w, plan.h) * 0.16;
  const cw = side * 1.5, ch = side;
  let sx = task.x - cw / 2, sy = task.y - ch / 2;
  sx = Math.max(0, Math.min(plan.w - cw, sx)); sy = Math.max(0, Math.min(plan.h - ch, sy));
  const c = document.createElement('canvas'); c.width = 600; c.height = 400;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 600, 400);
  ctx.drawImage(im, sx * k, sy * k, cw * k, ch * k, 0, 0, 600, 400);
  drawPinOn(ctx, (task.x - sx) / cw * 600, (task.y - sy) / ch * 400, task.num, STATUS[task.status].color, 46);
  return c.toDataURL('image/jpeg', 0.85);
}

// Vue d'ensemble du plan avec tous les numéros
async function planOverview(plan, tasks) {
  const im = await planImage(plan); if (!im) return null;
  const max = 1600, r = Math.min(1, max / Math.max(plan.w, plan.h));
  const c = document.createElement('canvas'); c.width = Math.round(plan.w * r); c.height = Math.round(plan.h * r);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(im, 0, 0, c.width, c.height);
  const size = Math.max(22, Math.min(40, c.width / 45));
  for (const t of tasks) drawPinOn(ctx, t.x * r, t.y * r, t.num, STATUS[t.status].color, size);
  return { url: c.toDataURL('image/jpeg', 0.82), w: c.width, h: c.height };
}

// Document A4 avec en-tête / pied de page
function newDoc(title, project, opts = {}) {
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 14;
  const ctx = { doc, W, H, M, y: 0, title, project };
  ctx.header = () => {
    if (opts.plain) { ctx.y = 14; doc.setTextColor(20, 20, 20); return; }
    doc.setFillColor(27, 30, 36); doc.rect(0, 0, W, 18, 'F');
    doc.setTextColor(245, 184, 46); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('CHANTIER', M, 11.5);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(pt(`${project.name} - ${title}`), W - M, 11.5, { align: 'right', maxWidth: 140 });
    ctx.y = 26; doc.setTextColor(20, 20, 20);
  };
  ctx.need = (h) => { if (ctx.y + h > H - 16) { doc.addPage(); ctx.header(); } };
  ctx.text = (s, { size = 10, bold = false, color = [20, 20, 20], indent = 0, gap = 1.5, width } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(pt(s), width || (W - 2 * M - indent));
    const lh = size * 0.42;
    for (const l of lines) { ctx.need(lh + 1); doc.text(l, M + indent, ctx.y + lh * 0.8); ctx.y += lh; }
    ctx.y += gap;
  };
  ctx.finish = () => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(130, 130, 130); doc.setFont('helvetica', 'normal');
      doc.text(pt(`Généré le ${new Date().toLocaleString('fr-FR')}`), M, H - 8);
      doc.text(`Page ${i} / ${n}`, W - M, H - 8, { align: 'right' });
    }
  };
  ctx.header();
  return ctx;
}

async function sharePdf(doc, fname) {
  if (window.PdfCapture) { window.PdfCapture.push({ blob: doc.output('blob'), fname }); return; }   // génération pour Drive
  const fs = window.Capacitor?.Plugins?.Filesystem, share = window.Capacitor?.Plugins?.Share;
  if (fs && share) {
    const b64 = doc.output('datauristring').split(',')[1];
    await fs.writeFile({ path: fname, data: b64, directory: 'CACHE' });
    const { uri } = await fs.getUri({ path: fname, directory: 'CACHE' });
    try { await share.share({ title: fname, files: [uri], dialogTitle: 'Envoyer le rapport' }); }
    catch (e) { if (!/cancel/i.test(String(e?.message))) throw e; }
  } else {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
const safeName = (s) => pt(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '_').slice(0, 40) || 'rapport';

// ---------- Rapport des réserves ----------
async function reservesReportDialog(preset = {}) {
  const p = await DB.get('projects', App.project.id);
  const comps = p.companies || [];
  const r = await formSheet('Rapport PDF des réserves', [
    { name: 'company', label: 'Entreprise', type: 'select', value: preset.company || 'all',
      options: [{ value: 'all', label: 'Toutes les entreprises' }, ...comps.map(c => ({ value: c.id, label: `${c.name} (${c.lot})` })), { value: 'none', label: 'Sans entreprise' }] },
    { name: 'status', label: 'Réserves', type: 'select', value: 'open',
      options: [{ value: 'open', label: 'Non levées (ouvertes + en cours)' }, { value: 'late', label: 'En retard uniquement' }, { value: 'all', label: 'Toutes' }] },
    { name: 'period', label: 'Période (date de création)', type: 'select', value: 'all',
      options: [{ value: 'all', label: 'Tout' }, { value: '1', label: 'Aujourd\'hui (rapport de visite)' }, { value: '7', label: '7 derniers jours' }, { value: '30', label: '30 derniers jours' }] },
    { name: 'photos', label: 'Inclure', type: 'select', value: 'yes', options: [{ value: 'yes', label: 'Plans + photos' }, { value: 'noph', label: 'Plans sans photos (PDF léger)' }] },
  ], { okLabel: 'Générer le PDF' });
  if (!r) return;
  const ld = loading('Préparation du rapport…');
  try { await buildReservesPdf(p, r, (m) => ld.set(m)); }
  catch (e) { console.error(e); alertBox('Erreur PDF : ' + (e.message || e)); }
  finally { ld.close(); planImgCache.clear(); }
}

async function buildReservesPdf(p, opt, progress) {
  if (!window.jspdf) throw new Error('Module PDF non chargé');
  const [allTasks, plans] = await Promise.all([DB.byProject('tasks', p.id), DB.byProject('plans', p.id)]);
  const since = opt.period === 'all' ? 0 : (opt.period === '1' ? new Date(todayISO()).getTime() : Date.now() - (+opt.period) * 864e5);
  const tasks = allTasks.filter(t =>
    (opt.company === 'all' || (opt.company === 'none' ? !t.companyId : t.companyId === opt.company)) &&
    (opt.status === 'all' || (opt.status === 'late' ? isLate(t) : !isLifted(t))) &&
    (t.createdAt || 0) >= since
  ).sort((a, b) => a.num - b.num);
  const co = opt.company !== 'all' && opt.company !== 'none' ? companyOf(p, opt.company) : null;
  const title = co ? `Réserves - ${co.name}` : 'Rapport des réserves';
  const R = newDoc(title, p); const { doc, M, W } = R;

  // Page de garde / synthèse
  R.text(title, { size: 20, bold: true, gap: 2 });
  R.text(`${p.name}${p.address ? ' - ' + p.address : ''}`, { size: 12, gap: 1 });
  R.text(`Date : ${fmtDate(Date.now())}`, { size: 10, color: [90, 90, 90], gap: 1 });
  const stLabel = { open: 'Non levées', late: 'En retard', all: 'Toutes' }[opt.status];
  const perLabel = { all: 'Toute la période', 1: 'Aujourd\'hui', 7: '7 derniers jours', 30: '30 derniers jours' }[opt.period];
  R.text(`Filtre : ${co ? co.name + ' (' + co.lot + ')' : (opt.company === 'none' ? 'Sans entreprise' : 'Toutes entreprises')} · ${stLabel} · ${perLabel}`, { size: 10, color: [90, 90, 90], gap: 5 });

  // Tableau de synthèse par entreprise
  const rows = [...(p.companies || []), { id: '', name: 'Sans entreprise', lot: '-', color: '#64748b' }].map(c => {
    const ts = tasks.filter(t => (t.companyId || '') === c.id);
    return { c, n: ts.length, open: ts.filter(t => !isLifted(t)).length, lifted: ts.filter(isLifted).length, late: ts.filter(isLate).length };
  }).filter(x => x.n);
  R.text('Synthèse', { size: 13, bold: true, gap: 2 });
  const cols = [M, M + 70, M + 112, M + 132, M + 152, M + 172];
  const head = ['Entreprise', 'Lot', 'Total', 'A lever', 'Levées', 'Retard'];
  doc.setFillColor(238, 240, 244); doc.rect(M, R.y, W - 2 * M, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
  head.forEach((h, i) => doc.text(pt(h), cols[i] + 1.5, R.y + 4.8)); R.y += 7;
  doc.setFont('helvetica', 'normal');
  for (const x of rows) {
    R.need(7);
    doc.setFillColor(...hexRGB(x.c.color)); doc.rect(M + 1, R.y + 2, 2.5, 3, 'F');
    doc.setTextColor(20, 20, 20);
    doc.text(pt(x.c.name).slice(0, 34), cols[0] + 5, R.y + 4.8); doc.text(pt(x.c.lot || '').slice(0, 20), cols[1] + 1.5, R.y + 4.8);
    doc.text(String(x.n), cols[2] + 1.5, R.y + 4.8); doc.text(String(x.open), cols[3] + 1.5, R.y + 4.8); doc.text(String(x.lifted), cols[4] + 1.5, R.y + 4.8);
    doc.setTextColor(x.late ? 220 : 20, x.late ? 120 : 20, 20); doc.text(String(x.late), cols[5] + 1.5, R.y + 4.8);
    doc.setDrawColor(225, 225, 225); doc.line(M, R.y + 7, W - M, R.y + 7); R.y += 7;
  }
  doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 20, 20);
  R.need(8); doc.text(pt(`Total : ${tasks.length} réserve(s) · ${tasks.filter(t => !isLifted(t)).length} à lever · ${tasks.filter(isLate).length} en retard`), M, R.y + 5); R.y += 12;
  if (!tasks.length) { R.text('Aucune réserve pour ces critères.', { size: 11, color: [120, 120, 120] }); R.finish(); return sharePdf(doc, `${safeName(title)}_${todayISO()}.pdf`); }

  // Plans de repérage
  const byPlan = plans.map(pl => ({ pl, ts: tasks.filter(t => t.planId === pl.id && t.x != null) })).filter(x => x.ts.length);
  for (const { pl, ts } of byPlan) {
    progress && progress(`Plan : ${pl.name}`);
    const ov = await planOverview(pl, ts); if (!ov) continue;
    const maxW = W - 2 * M, maxH = 200;
    const k = Math.min(maxW / ov.w, maxH / ov.h), iw = ov.w * k, ih = ov.h * k;
    R.need(ih + 14);
    R.text(`Plan de repérage : ${pl.name}`, { size: 12, bold: true, gap: 2 });
    doc.addImage(ov.url, 'JPEG', M + (maxW - iw) / 2, R.y, iw, ih); doc.setDrawColor(200, 200, 200); doc.rect(M + (maxW - iw) / 2, R.y, iw, ih);
    R.y += ih + 6;
  }

  // Fiches réserves
  doc.addPage(); R.header();
  R.text('Détail des réserves', { size: 14, bold: true, gap: 3 });
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]; progress && progress(`Réserve ${i + 1}/${tasks.length}`);
    const c = companyOf(p, t.companyId), pl = plans.find(x => x.id === t.planId);
    const late = isLate(t);
    R.need(40);
    // bandeau
    doc.setFillColor(...hexRGB(STATUS[t.status].color)); doc.roundedRect(M, R.y, 14, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(`#${t.num}`, M + 7, R.y + 5.5, { align: 'center' });
    doc.setTextColor(20, 20, 20); doc.setFontSize(12); doc.text(pt(t.title || 'Sans titre').slice(0, 80), M + 17, R.y + 5.6);
    R.y += 11;
    const meta = [
      `${KINDS[t.kind || 'reserve']} · ${STATUS[t.status].label} · Priorité ${t.priority}`,
      c ? `Entreprise : ${c.name} (${c.lot})` : null,
      t.assignee ? `Responsable : ${t.assignee}` : null,
      t.due ? `Échéance : ${fmtDate(t.due)}${late ? '  (EN RETARD)' : ''}` : null,
      pl ? `Plan : ${pl.name}` : null,
      `Créée le ${fmtDate(t.createdAt)}`,
    ].filter(Boolean);
    for (const m of meta) R.text(m, { size: 9.5, color: m.includes('RETARD') ? [200, 90, 0] : [60, 60, 60], gap: 0.3 });
    if (t.description) { R.y += 1; R.text(t.description, { size: 10, gap: 1 }); }
    R.y += 2;
    // extrait plan + photos
    const imgs = [];
    if (pl && t.x != null) { const sn = await planSnippet(pl, t); if (sn) imgs.push({ url: sn, w: 600, h: 400, plan: true }); }
    if (opt.photos === 'yes') for (const id of (t.photoIds || []).slice(0, 4)) { const f = await DB.get('files', id); if (f) imgs.push(await blobToJpegURL(f.blob, 700)); }
    if (imgs.length) {
      const boxH = 52, gapX = 3;
      let x = M; R.need(boxH + 4);
      for (const im of imgs) {
        const k = boxH / im.h; let w = im.w * k, h = boxH;
        if (w > 80) { w = 80; h = im.h * (80 / im.w); }
        if (x + w > W - M) { R.y += boxH + 3; x = M; R.need(boxH + 4); }
        doc.addImage(im.url, 'JPEG', x, R.y, w, h); doc.setDrawColor(im.plan ? 91 : 210, im.plan ? 141 : 210, im.plan ? 239 : 210); doc.rect(x, R.y, w, h);
        x += w + gapX;
      }
      R.y += boxH + 4;
    }
    doc.setDrawColor(220, 220, 220); doc.line(M, R.y, W - M, R.y); R.y += 5;
  }
  R.finish();
  await sharePdf(doc, `${safeName(title)}_${todayISO()}.pdf`);
}

// ---------- PV de contrôle (formulaire) ----------
async function formPdf(form) {
  const ld = loading('Création du PV…');
  try {
    const p = await DB.get('projects', form.projectId);
    const s = formStats(form);
    const R = newDoc('PV de contrôle', p); const { doc, M, W } = R;
    R.text(`PV - ${form.title}`, { size: 18, bold: true, gap: 2 });
    R.text(`${p.name}${p.address ? ' - ' + p.address : ''}`, { size: 11, gap: 1 });
    if (form.location) R.text(`Ouvrage / localisation : ${form.location}`, { size: 10, gap: 0.5 });
    R.text(`Date : ${fmtDate(form.date)}${form.inspector ? '   ·   Contrôlé par : ' + form.inspector : ''}`, { size: 10, gap: 0.5 });
    const co = companyOf(p, form.companyId); if (co) R.text(`Entreprise : ${co.name} (${co.lot})`, { size: 10, gap: 0.5 });
    const col = s.status === 'Conforme' ? [34, 160, 80] : s.status === 'Non conforme' ? [210, 50, 50] : [220, 140, 0];
    R.y += 2; R.text(`Résultat : ${s.status.toUpperCase()}   (Conforme ${s.ok} · Non conforme ${s.nok} · N/A ${s.na})`, { size: 11, bold: true, color: col, gap: 4 });
    // tableau
    doc.setFillColor(238, 240, 244); doc.rect(M, R.y, W - 2 * M, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
    doc.text('Point de contrôle', M + 2, R.y + 4.8); doc.text(pt('Résultat'), W - M - 32, R.y + 4.8); R.y += 7;
    const lab = { ok: ['Conforme', [34, 160, 80]], nok: ['Non conforme', [210, 50, 50]], na: ['N/A', [120, 120, 120]] };
    for (let i = 0; i < form.items.length; i++) {
      const it = form.items[i];
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
      const lines = doc.splitTextToSize(pt(`${i + 1}. ${it.label}`), W - 2 * M - 40);
      const cl = it.comment ? doc.splitTextToSize(pt('-> ' + it.comment), W - 2 * M - 40) : [];
      const h = (lines.length + cl.length) * 4.2 + 3;
      R.need(h);
      doc.setTextColor(20, 20, 20); lines.forEach((l, j) => doc.text(l, M + 2, R.y + 4.5 + j * 4.2));
      doc.setTextColor(200, 90, 0); cl.forEach((l, j) => doc.text(l, M + 4, R.y + 4.5 + (lines.length + j) * 4.2));
      const [lt, lc] = lab[it.res] || ['-', [150, 150, 150]];
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...lc); doc.text(lt, W - M - 32, R.y + 4.5);
      doc.setDrawColor(228, 228, 228); doc.line(M, R.y + h, W - M, R.y + h); R.y += h;
    }
    R.y += 4;
    if (form.notes) { R.text('Observations', { size: 11, bold: true, gap: 1 }); R.text(form.notes, { size: 10, gap: 3 }); }
    // photos
    const photos = []; for (const id of (form.photoIds || [])) { const f = await DB.get('files', id); if (f) photos.push(await blobToJpegURL(f.blob, 800)); }
    if (photos.length) {
      R.text('Photos', { size: 11, bold: true, gap: 2 });
      let x = M; const bh = 55;
      R.need(bh + 3);
      for (const im of photos) {
        let w = im.w * (bh / im.h), h = bh; if (w > 85) { w = 85; h = im.h * (85 / im.w); }
        if (x + w > W - M) { R.y += bh + 3; x = M; R.need(bh + 3); }
        doc.addImage(im.url, 'JPEG', x, R.y, w, h); x += w + 3;
      }
      R.y += bh + 6;
    }
    // signatures
    R.need(52);
    R.text('Signatures', { size: 11, bold: true, gap: 2 });
    const sw = (W - 2 * M - 8) / 2;
    [['Contrôleur', form.sigCtrl, form.inspector], ['Entreprise', form.sigEnt, co ? co.name : '']].forEach(([l, sig, who], i) => {
      const x = M + i * (sw + 8);
      doc.setDrawColor(190, 190, 190); doc.rect(x, R.y, sw, 36);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90); doc.text(pt(`${l}${who ? ' : ' + who : ''}`), x + 2, R.y + 4.5);
      if (sig) doc.addImage(sig, 'PNG', x + 4, R.y + 7, sw - 8, 27);
    });
    R.y += 40;
    R.finish();
    await sharePdf(doc, `PV_${safeName(form.title)}_${form.date || todayISO()}.pdf`);
  } catch (e) { console.error(e); alertBox('Erreur PDF : ' + (e.message || e)); }
  finally { ld.close(); }
}

// ---------- Rapport journalier PDF ----------
async function dailyPdf(rep) {
  const ld = loading('Création du rapport…');
  try {
    const p = await DB.get('projects', rep.projectId);
    const R = newDoc('Rapport journalier', p);
    R.text(`Rapport journalier du ${fmtDate(rep.date)}`, { size: 18, bold: true, gap: 2 });
    R.text(`${p.name}${p.address ? ' - ' + p.address : ''}`, { size: 11, gap: 4 });
    const kv = [['Météo', `${rep.weather || '-'}${rep.temp ? ' (' + rep.temp + ' °C)' : ''}`], ['Effectif', rep.workers ? rep.workers + ' ouvriers' : '-'], ['Engins / matériel', rep.equipment || '-']];
    for (const [k, v] of kv) R.text(`${k} : ${v}`, { size: 10.5, gap: 0.8 });
    R.y += 3;
    for (const [k, v] of [['Travaux réalisés', rep.works], ['Livraisons', rep.deliveries], ['Problèmes / observations', rep.issues]]) {
      if (!v) continue; R.text(k, { size: 12, bold: true, gap: 1 }); R.text(v, { size: 10.5, gap: 4 });
    }
    const photos = []; for (const id of (rep.photoIds || [])) { const f = await DB.get('files', id); if (f) photos.push(await blobToJpegURL(f.blob, 800)); }
    if (photos.length) {
      const { doc, M, W } = R; R.text('Photos', { size: 12, bold: true, gap: 2 });
      let x = M; const bh = 60; R.need(bh + 3);
      for (const im of photos) {
        let w = im.w * (bh / im.h), h = bh; if (w > 88) { w = 88; h = im.h * (88 / im.w); }
        if (x + w > W - M) { R.y += bh + 3; x = M; R.need(bh + 3); }
        doc.addImage(im.url, 'JPEG', x, R.y, w, h); x += w + 3;
      }
      R.y += bh + 4;
    }
    R.finish();
    await sharePdf(R.doc, `Rapport_${safeName(p.name)}_${rep.date || todayISO()}.pdf`);
  } catch (e) { console.error(e); alertBox('Erreur PDF : ' + (e.message || e)); }
  finally { ld.close(); }
}
