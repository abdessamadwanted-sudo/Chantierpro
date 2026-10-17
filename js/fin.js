// ================= Financier & TCE (tous corps d'état) : tableaux déroulants comme les fichiers Excel de chantier + export .xlsx =================
// ---------- petit générateur .xlsx (sans bibliothèque : XML + zip) ----------
async function xlsxBlob(sheets) {
  await loadScript('vendor/fflate.min.js');
  const X = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const col = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; } return s; };
  const enc = (s) => new TextEncoder().encode(s), files = {};
  files['[Content_Types].xml'] = enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  files['_rels/.rels'] = enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  files['xl/workbook.xml'] = enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${X(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  files['xl/_rels/workbook.xml.rels'] = enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  // styles : 0 normal · 1 en-tête (gras, fond bleu, texte blanc) · 2 nombre 2 décimales · 3 total (gras + nombre) · 4 titre
  files['xl/styles.xml'] = enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf borderId="1" applyBorder="1"/><xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" borderId="1" applyNumberFormat="1" applyBorder="1"/><xf fontId="2" numFmtId="164" borderId="1" applyFont="1" applyNumberFormat="1" applyBorder="1"/><xf fontId="3"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  sheets.forEach((sh, si) => {
    const rows = sh.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => { if (v == null || v === '') return ''; const ref = col(ci) + (ri + 1), st = sh.title && ri === 0 ? 4 : ri === (sh.head ?? 0) ? 1 : (sh.total && ri === sh.rows.length - 1) ? 3 : 0;
      return typeof v === 'number' && isFinite(v) ? `<c r="${ref}" s="${st === 0 ? 2 : st}"><v>${v}</v></c>` : `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${X(v)}</t></is></c>`; }).join('')}</row>`).join('');
    const cols = (sh.widths || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    files[`xl/worksheets/sheet${si + 1}.xml`] = enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${(sh.head ?? 0) + 1}" topLeftCell="A${(sh.head ?? 0) + 2}" state="frozen"/></sheetView></sheetViews>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${rows}</sheetData></worksheet>`);
  });
  return new Blob([fflate.zipSync(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const fN = (v) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const fDH = (n) => (Math.round(n * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' DH';
const finOpen = (k, d) => { try { const v = localStorage.getItem('fin.o.' + k); return v == null ? d : v === '1'; } catch (e) { return d; } };
const finSet = (k, v) => { try { localStorage.setItem('fin.o.' + k, v ? '1' : '0'); } catch (e) {} };
function finSec(k, title, sum, body, def) { const o = finOpen(k, def); return `<div class="fn-g ${o ? 'open' : ''}" data-g="${k}"><button class="fn-gh" data-tg="${k}"><span class="grow"><b>${title}</b>${sum ? `<small>${sum}</small>` : ''}</span>${icon('chevdown')}</button><div class="fn-gb">${body}</div></div>`; }
function finBind(root, redraw) { $$('[data-tg]', root).forEach(b => b.onclick = () => { const g = b.closest('[data-g]'), o = !g.classList.contains('open'); g.classList.toggle('open', o); finSet(b.dataset.tg, o); }); }
// formulaire générique d'une ligne (ajout / modification / suppression)
async function finEdit(list, item, title, fields, save, redraw) {
  const r = await formSheet(item ? title : 'Nouveau · ' + title, fields.map(f => ({ ...f, value: item ? item[f.name] ?? '' : f.value ?? '' })), { okLabel: 'Enregistrer', danger: item ? 'Supprimer' : null });
  if (!r) return;
  if (r.__danger) list.splice(list.indexOf(item), 1); else if (item) Object.assign(item, r); else list.push({ id: DB.uid(), ...r });
  await save(); redraw();
}

// ================= FINANCIER =================
const FIN_CATS = ['Main d\'œuvre', 'Matériaux', 'Location d\'engins', 'Sous-traitance', 'Transport', 'Carburant', 'Frais de chantier', 'Divers'];
function finData(p) { p.fin = p.fin || {}; const F = p.fin; for (const k of ['av', 'dep', 'fac', 'enc']) F[k] = F[k] || []; return F; }
function finCalc(p) {
  const F = finData(p), G = p.gs || {};
  const bpu = (G.bpu || []).reduce((s, it) => s + fN(it.qm) * fN(it.pu), 0);
  const base = fN(F.base) || bpu, av = F.av.reduce((s, a) => s + fN(a.m), 0), marche = base + av;
  const sits = G.sit || [], sitCum = sits.length ? sits[sits.length - 1].cum : 0;
  const enc = F.enc.reduce((s, e) => s + fN(e.m), 0), dep = F.dep.reduce((s, d) => s + fN(d.m), 0);
  const facT = F.fac.reduce((s, f) => s + fN(f.m), 0), facDue = F.fac.filter(f => f.st !== 'paye').reduce((s, f) => s + fN(f.m), 0);
  const facLate = F.fac.filter(f => f.st !== 'paye' && f.ech && f.ech < todayISO()).length;
  const real = sitCum || enc;
  return { base, av, marche, sitCum, enc, dep, facT, facDue, facLate, marge: real - dep, pct: marche ? Math.round(real / marche * 100) : 0, reste: marche - enc };
}
async function renderFinance(root) {
  const p = App.project, F = finData(p), save = () => DB.put('projects', p), redraw = () => renderFinance(root), K = finCalc(p);
  const byCat = FIN_CATS.map(c => [c, F.dep.filter(d => (d.cat || 'Divers') === c).reduce((s, d) => s + fN(d.m), 0)]).filter(x => x[1]);
  const mx = Math.max(1, ...byCat.map(x => x[1]));
  const rowsOf = (L, fn) => L.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).map(fn).join('');
  root.innerHTML = `<div class="fn">
    <div class="fn-kpi">
      <div><span>Marché HT${K.av ? ' (+ avenants)' : ''}</span><b>${fDH(K.marche)}</b></div>
      <div><span>Réalisé (situations)</span><b>${fDH(K.sitCum)}</b><i style="--p:${Math.min(100, K.pct)}%"></i><small>${K.pct} % du marché</small></div>
      <div><span>Encaissé</span><b class="g">${fDH(K.enc)}</b><small>reste ${fDH(Math.max(0, K.reste))}</small></div>
      <div><span>Dépenses</span><b class="o">${fDH(K.dep)}</b><small>factures à payer ${fDH(K.facDue)}</small></div>
      <div class="wide ${K.marge < 0 ? 'neg' : ''}"><span>Marge estimée (réalisé − dépenses)</span><b>${fDH(K.marge)}</b></div>
    </div>
    <div class="fn-acts"><button class="btn small" data-a="xls">${icon('grid')} Export Excel</button><button class="btn ghost small" data-a="att">🧾 Attachements & situations</button></div>
    ${finSec('mar', '📑 Marché & avenants', `${F.av.length} avenant(s)`, `<button class="fn-row" data-a="base"><span class="grow"><b>Montant du marché de base HT</b><small>${fN(F.base) ? 'saisi' : K.base ? 'calculé depuis le BPU (Gestion)' : 'à saisir'}</small></span><span class="fn-v">${fDH(K.base)}</span></button>
      ${F.av.map(a => `<button class="fn-row" data-av="${a.id}"><span class="grow"><b>Avenant n° ${esc(a.n || '')} · ${esc(a.obj || '')}</b><small>${a.date ? fmtDate(a.date) : ''}</small></span><span class="fn-v ${fN(a.m) < 0 ? 'neg' : ''}">${fN(a.m) > 0 ? '+' : ''}${fDH(fN(a.m))}</span></button>`).join('')}
      <button class="fn-add" data-a="addav">${icon('plus')} Avenant</button>`, true)}
    ${finSec('dep', '💸 Dépenses', `${F.dep.length} ligne(s) · ${fDH(K.dep)}`, `${byCat.length ? `<div class="fn-bars">${byCat.map(([c, v]) => `<div><span>${esc(c)}</span><i><u style="width:${Math.round(v / mx * 100)}%"></u></i><b>${fDH(v)}</b></div>`).join('')}</div>` : ''}
      ${rowsOf(F.dep, d => `<button class="fn-row" data-dep="${d.id}"><span class="grow"><b>${esc(d.lib || d.cat || '')}</b><small>${d.date ? fmtDate(d.date) : ''} · ${esc(d.cat || '')}${d.fr ? ' · ' + esc(d.fr) : ''}</small></span><span class="fn-v">${fDH(fN(d.m))}</span></button>`) || '<div class="fn-empty">Notez main d\'œuvre, matériaux, location d\'engins, sous-traitance…</div>'}
      <button class="fn-add" data-a="adddep">${icon('plus')} Dépense</button>`, false)}
    ${finSec('fac', '🧾 Factures fournisseurs / sous-traitants', `${F.fac.filter(f => f.st !== 'paye').length} à payer${K.facLate ? ` · <em>${K.facLate} en retard</em>` : ''}`, `${rowsOf(F.fac, f => { const late = f.st !== 'paye' && f.ech && f.ech < todayISO(); return `<button class="fn-row ${f.st === 'paye' ? 'paid' : late ? 'late' : ''}" data-fac="${f.id}"><span class="grow"><b>${esc(f.fr || '')} · n° ${esc(f.n || '')}</b><small>${f.date ? fmtDate(f.date) : ''}${f.ech ? ' · échéance ' + fmtDate(f.ech) : ''}</small></span><span class="fn-v">${fDH(fN(f.m))}<small>${f.st === 'paye' ? '✓ payée' : late ? 'en retard' : 'à payer'}</small></span></button>`; }) || '<div class="fn-empty">Aucune facture.</div>'}
      <button class="fn-add" data-a="addfac">${icon('plus')} Facture</button>`, false)}
    ${finSec('enc', '💰 Encaissements (paiements du maître d\'ouvrage)', `${fDH(K.enc)}`, `${rowsOf(F.enc, e => `<button class="fn-row" data-enc="${e.id}"><span class="grow"><b>${esc(e.ref || 'Paiement')}</b><small>${e.date ? fmtDate(e.date) : ''}</small></span><span class="fn-v g">${fDH(fN(e.m))}</span></button>`) || '<div class="fn-empty">Notez chaque paiement reçu (situation n°…).</div>'}
      <button class="fn-add" data-a="addenc">${icon('plus')} Encaissement</button>`, false)}
    ${finSec('sit', '📊 Situations de travaux', `${(p.gs && p.gs.sit || []).length}`, `${(p.gs && p.gs.sit || []).slice().reverse().map(x => `<div class="fn-row"><span class="grow"><b>Situation n° ${x.n}</b><small>au ${fmtDate(x.date)} · cumul HT ${fDH(x.cum)}</small></span><span class="fn-v">${fDH(x.ttc)}<small>TTC</small></span></div>`).join('') || '<div class="fn-empty">Les situations se font dans Gestion › Attachements (BPU + métrés).</div>'}`, false)}
  </div>`;
  finBind(root, redraw);
  const A = (k) => $(`[data-a=${k}]`, root);
  A('att').onclick = () => { App.section = 'gestion'; App.gsTab = 'att'; renderSection(); };
  A('base').onclick = async () => { const r = await formSheet('Marché de base', [{ name: 'b', label: 'Montant HT (DH) — vide = calcul depuis le BPU', type: 'number', value: F.base || '' }]); if (r) { F.base = r.b; await save(); redraw(); } };
  const AVF = [{ name: 'n', label: 'N°' }, { name: 'obj', label: 'Objet', placeholder: 'Ex : travaux supplémentaires R+6' }, { name: 'date', label: 'Date', type: 'date', value: todayISO() }, { name: 'm', label: 'Montant HT (DH, négatif = moins-value)', type: 'number' }];
  const DEPF = [{ name: 'date', label: 'Date', type: 'date', value: todayISO() }, { name: 'cat', label: 'Catégorie', type: 'select', options: FIN_CATS, value: FIN_CATS[1] }, { name: 'lib', label: 'Libellé', placeholder: 'Ex : 200 sacs CPJ45' }, { name: 'fr', label: 'Fournisseur / équipe', list: [...new Set(F.dep.map(d => d.fr).filter(Boolean))] }, { name: 'm', label: 'Montant (DH)', type: 'number' }];
  const FACF = [{ name: 'fr', label: 'Fournisseur / sous-traitant', list: [...new Set(F.fac.map(f => f.fr).filter(Boolean))] }, { name: 'n', label: 'N° de facture' }, { name: 'date', label: 'Date', type: 'date', value: todayISO() }, { name: 'ech', label: 'Échéance de paiement', type: 'date' }, { name: 'm', label: 'Montant TTC (DH)', type: 'number' }, { name: 'st', label: 'Statut', type: 'select', options: [{ value: 'due', label: 'À payer' }, { value: 'paye', label: 'Payée' }], value: 'due' }];
  const ENCF = [{ name: 'date', label: 'Date', type: 'date', value: todayISO() }, { name: 'ref', label: 'Référence', placeholder: 'Ex : Situation n° 3' }, { name: 'm', label: 'Montant reçu (DH)', type: 'number' }];
  A('addav').onclick = () => finEdit(F.av, null, 'Avenant', AVF, save, redraw);
  A('adddep').onclick = () => finEdit(F.dep, null, 'Dépense', DEPF, save, redraw);
  A('addfac').onclick = () => finEdit(F.fac, null, 'Facture', FACF, save, redraw);
  A('addenc').onclick = () => finEdit(F.enc, null, 'Encaissement', ENCF, save, redraw);
  $$('[data-av]', root).forEach(b => b.onclick = () => finEdit(F.av, F.av.find(x => x.id === b.dataset.av), 'Avenant', AVF, save, redraw));
  $$('[data-dep]', root).forEach(b => b.onclick = () => finEdit(F.dep, F.dep.find(x => x.id === b.dataset.dep), 'Dépense', DEPF, save, redraw));
  $$('[data-fac]', root).forEach(b => b.onclick = () => finEdit(F.fac, F.fac.find(x => x.id === b.dataset.fac), 'Facture', FACF, save, redraw));
  $$('[data-enc]', root).forEach(b => b.onclick = () => finEdit(F.enc, F.enc.find(x => x.id === b.dataset.enc), 'Encaissement', ENCF, save, redraw));
  A('xls').onclick = async () => {
    const ld = loading('Création du fichier Excel…');
    try {
      const T = (h, rows, w, total) => ({ head: 0, rows: [h, ...rows, ...(total ? [total] : [])], widths: w, total: !!total });
      const sum = (L) => L.reduce((s, x) => s + fN(x.m), 0);
      const b = await xlsxBlob([
        { name: 'Synthèse', title: true, head: 2, rows: [[`${p.name} — synthèse financière au ${fmtDate(todayISO())}`], [], ['Poste', 'Montant (DH)'], ['Marché de base HT', K.base], ['Avenants HT', K.av], ['Marché total HT', K.marche], ['Réalisé (situations, cumul HT)', K.sitCum], ['Avancement financier (%)', K.pct], ['Encaissé', K.enc], ['Reste à encaisser', K.reste], ['Dépenses', K.dep], ['Factures à payer', K.facDue], ['Marge estimée', K.marge]], widths: [38, 20] },
        { name: 'Avenants', ...T(['N°', 'Objet', 'Date', 'Montant HT'], F.av.map(a => [a.n || '', a.obj || '', a.date ? fmtDate(a.date) : '', fN(a.m)]), [8, 44, 12, 18], ['', 'TOTAL', '', sum(F.av)]) },
        { name: 'Dépenses', ...T(['Date', 'Catégorie', 'Libellé', 'Fournisseur', 'Montant'], F.dep.map(d => [d.date ? fmtDate(d.date) : '', d.cat || '', d.lib || '', d.fr || '', fN(d.m)]), [12, 20, 38, 24, 16], ['', '', 'TOTAL', '', sum(F.dep)]) },
        { name: 'Factures', ...T(['Fournisseur', 'N°', 'Date', 'Échéance', 'Montant TTC', 'Statut'], F.fac.map(f => [f.fr || '', f.n || '', f.date ? fmtDate(f.date) : '', f.ech ? fmtDate(f.ech) : '', fN(f.m), f.st === 'paye' ? 'Payée' : 'À payer']), [28, 12, 12, 12, 16, 10], ['TOTAL', '', '', '', sum(F.fac), '']) },
        { name: 'Encaissements', ...T(['Date', 'Référence', 'Montant'], F.enc.map(e => [e.date ? fmtDate(e.date) : '', e.ref || '', fN(e.m)]), [12, 34, 16], ['', 'TOTAL', sum(F.enc)]) },
      ]);
      ld.close(); await shareBlob(b, `Financier_${safeName(p.name)}_${todayISO()}.xlsx`);
    } catch (e) { ld.close(); alertBox('Export impossible : ' + (e.message || e)); }
  };
}

// ================= TCE (tous corps d'état) =================
const TCE_LOTS = ['Gros œuvre', 'Étanchéité', 'Charpente métallique', 'Menuiserie aluminium', 'Menuiserie bois', 'Menuiserie métallique / serrurerie', 'Plomberie sanitaire', 'Électricité CFO / CFA', 'Climatisation / ventilation (CVC)', 'Protection incendie', 'Ascenseurs', 'Faux plafond', 'Revêtements sols et murs', 'Peinture', 'VRD', 'Espaces verts'];
const TCE_ST = [['nd', 'Non démarré', '#64748b'], ['ec', 'En cours', '#3b82f6'], ['ret', 'En retard', '#ef4444'], ['fin', 'Terminé', '#22c55e'], ['rec', 'Réceptionné', '#16a34a']];
function tceData(p) { p.tce = p.tce || {}; if (!p.tce.lots) p.tce.lots = []; return p.tce; }
const tceLate = (L) => L.st !== 'fin' && L.st !== 'rec' && L.fin && L.fin < todayISO();
async function renderTce(root) {
  const p = App.project, T = tceData(p), save = () => DB.put('projects', p), redraw = () => renderTce(root);
  const tasks = await DB.byProject('tasks', p.id), comps = p.companies || [];
  const resOf = (L) => { const c = comps.find(x => normQ(x.name) === normQ(L.ent || '')); return c ? tasks.filter(t => t.companyId === c.id && !isLifted(t)).length : 0; };
  const tot = T.lots.reduce((s, L) => s + fN(L.m), 0), avg = tot ? T.lots.reduce((s, L) => s + fN(L.m) * fN(L.av), 0) / tot : (T.lots.length ? T.lots.reduce((s, L) => s + fN(L.av), 0) / T.lots.length : 0);
  const late = T.lots.filter(tceLate).length;
  root.innerHTML = `<div class="fn">
    <div class="fn-kpi"><div><span>Lots TCE</span><b>${T.lots.length}</b></div><div><span>Montant des marchés</span><b>${fDH(tot)}</b></div>
      <div><span>Avancement global</span><b>${Math.round(avg)} %</b><i style="--p:${Math.round(avg)}%"></i></div><div class="${late ? 'neg' : ''}"><span>Lots en retard</span><b>${late}</b></div></div>
    <div class="fn-acts"><button class="btn small" data-a="xls">${icon('grid')} Export Excel</button>${T.lots.length ? '' : `<button class="btn ghost small" data-a="tpl">📋 Charger les lots TCE types</button>`}</div>
    ${T.lots.map(L => { const st = TCE_ST.find(x => x[0] === (tceLate(L) ? 'ret' : L.st)) || TCE_ST[0], rs = resOf(L);
      return finSec('l' + L.id, `<span class="tc-dot" style="background:${st[2]}"></span>${esc(L.lot)}`, `${esc(L.ent || 'entreprise ?')} · ${fN(L.av)} %${rs ? ` · ⚠️ ${rs} réserve(s)` : ''}`, `
        <div class="tc-bar"><i style="width:${Math.min(100, fN(L.av))}%;background:${st[2]}"></i></div>
        <div class="tc-grid">
          <div><span>Entreprise</span><b>${esc(L.ent || '—')}</b></div><div><span>Contact</span><b>${L.tel ? `<a href="tel:${esc(L.tel)}">${esc(L.tel)}</a>` : '—'}</b></div>
          <div><span>Montant marché</span><b>${fDH(fN(L.m))}</b></div><div><span>Statut</span><b style="color:${st[2]}">${st[1]}</b></div>
          <div><span>Début prévu</span><b>${L.deb ? fmtDate(L.deb) : '—'}</b></div><div><span>Fin prévue</span><b class="${tceLate(L) ? 'neg' : ''}">${L.fin ? fmtDate(L.fin) : '—'}</b></div>
          <div><span>Fin réelle</span><b>${L.finR ? fmtDate(L.finR) : '—'}</b></div><div><span>Réserves ouvertes</span><b>${rs}</b></div>
        </div>${L.note ? `<div class="tc-note">${esc(L.note)}</div>` : ''}
        <div class="tc-acts"><button class="btn ghost small" data-av="${L.id}">＋ Avancement</button><button class="btn ghost small" data-ed="${L.id}">${icon('edit')} Modifier</button></div>
        ${(L.hist || []).length ? `<div class="tc-h">${L.hist.slice(-5).reverse().map(h => `<div><span>${fmtDate(h.d)}</span><b>${h.v} %</b>${h.n ? `<small>${esc(h.n)}</small>` : ''}</div>`).join('')}</div>` : ''}`, false); }).join('') || '<div class="fn-empty">Ajoutez les lots (ou chargez la liste type) : entreprise, montant, dates, avancement, réserves.</div>'}
    <button class="fn-add" data-a="add">${icon('plus')} Lot</button>
  </div>`;
  finBind(root, redraw);
  const FIELDS = [{ name: 'lot', label: 'Lot', list: TCE_LOTS }, { name: 'ent', label: 'Entreprise', list: comps.map(c => c.name) }, { name: 'tel', label: 'Téléphone', type: 'tel' }, { name: 'm', label: 'Montant du marché HT (DH)', type: 'number' },
    { name: 'deb', label: 'Début prévu', type: 'date' }, { name: 'fin', label: 'Fin prévue', type: 'date' }, { name: 'finR', label: 'Fin réelle', type: 'date' }, { name: 'av', label: 'Avancement (%)', type: 'number' },
    { name: 'st', label: 'Statut', type: 'select', options: TCE_ST.filter(x => x[0] !== 'ret').map(([value, label]) => ({ value, label })), value: 'nd' }, { name: 'note', label: 'Notes', type: 'textarea' }];
  $('[data-a=add]', root).onclick = () => finEdit(T.lots, null, 'Lot TCE', FIELDS, save, redraw);
  $$('[data-ed]', root).forEach(b => b.onclick = () => finEdit(T.lots, T.lots.find(x => x.id === b.dataset.ed), 'Lot TCE', FIELDS, save, redraw));
  $$('[data-av]', root).forEach(b => b.onclick = async () => { const L = T.lots.find(x => x.id === b.dataset.av); const r = await formSheet(`Avancement · ${L.lot}`, [{ name: 'v', label: 'Avancement (%)', type: 'number', value: L.av || '' }, { name: 'n', label: 'Commentaire', placeholder: 'Ex : 2e couche R+3 terminée' }], { okLabel: 'Enregistrer' });
    if (!r) return; L.av = Math.max(0, Math.min(100, fN(r.v))); (L.hist = L.hist || []).push({ d: todayISO(), v: L.av, n: r.n }); if (L.av >= 100 && L.st !== 'rec') { L.st = 'fin'; L.finR = L.finR || todayISO(); } else if (L.av > 0 && L.st === 'nd') L.st = 'ec'; await save(); redraw(); });
  const tp = $('[data-a=tpl]', root); if (tp) tp.onclick = async () => { T.lots = TCE_LOTS.map(lot => ({ id: DB.uid(), lot, st: 'nd', av: 0 })); await save(); toast('Lots chargés ✓ — supprimez ceux qui ne concernent pas le projet'); redraw(); };
  $('[data-a=xls]', root).onclick = async () => {
    const ld = loading('Création du fichier Excel…');
    try {
      const b = await xlsxBlob([{ name: 'TCE', head: 0, total: true, widths: [30, 26, 16, 16, 12, 12, 12, 12, 14, 10, 30],
        rows: [['Lot', 'Entreprise', 'Téléphone', 'Montant HT', 'Début prévu', 'Fin prévue', 'Fin réelle', 'Avancement %', 'Statut', 'Réserves', 'Notes'],
          ...T.lots.map(L => [L.lot, L.ent || '', L.tel || '', fN(L.m), L.deb ? fmtDate(L.deb) : '', L.fin ? fmtDate(L.fin) : '', L.finR ? fmtDate(L.finR) : '', fN(L.av), (TCE_ST.find(x => x[0] === (tceLate(L) ? 'ret' : L.st)) || TCE_ST[0])[1], resOf(L), L.note || '']),
          ['TOTAL', '', '', tot, '', '', '', Math.round(avg), '', '', '']] }]);
      ld.close(); await shareBlob(b, `TCE_${safeName(p.name)}_${todayISO()}.xlsx`);
    } catch (e) { ld.close(); alertBox('Export impossible : ' + (e.message || e)); }
  };
}
