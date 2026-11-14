// ================= Import d'un planning (PDF texte, CSV, MS Project XML) avec aperçu avant import =================
// Chaque ligne reconnue = une tâche (nom, début, fin) ; l'aperçu permet de décocher les lignes inutiles. Un PDF scanné (image seule) n'a pas de texte : non lisible ici.
const PlanImport = (() => {
  const MOIS = { janv: 1, jan: 1, fevr: 2, fev: 2, mars: 3, mar: 3, avr: 4, mai: 5, juin: 6, juil: 7, aout: 8, sept: 9, sep: 9, oct: 10, nov: 11, dec: 12 };
  const iso = (y, m, d) => { if (y < 100) y += 2000; if (m < 1 || m > 12 || d < 1 || d > 31) return null; return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
  const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const DRE = /(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})|(\d{1,2})\s+(janv(?:ier)?|f[ée]vr?(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[uû]t|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?)\.?\s+(\d{2,4})/gi;
  // trouve toutes les dates d'une ligne (avec leur position)
  function dates(line) { const out = []; let m; DRE.lastIndex = 0;
    while ((m = DRE.exec(line))) { let d = null;
      if (m[1]) d = iso(+m[1], +m[2], +m[3]); else if (m[4]) d = iso(+m[6], +m[5], +m[4]); else { const k = MOIS[norm(m[8]).slice(0, 4)] || MOIS[norm(m[8]).slice(0, 3)]; if (k) d = iso(+m[9], k, +m[7]); }
      if (d) out.push({ d, i: m.index, e: m.index + m[0].length }); }
    return out; }
  const addDays = (d, n) => { const t = new Date(d + 'T00:00:00'); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); };
  function parseLines(lines) {
    const rows = [];
    for (let raw of lines) { const line = raw.replace(/\s+/g, ' ').trim(); if (line.length < 6) continue;
      const D = dates(line); const dur = /(\d+(?:[.,]\d+)?)\s*(jours?|jrs?|j|days?|d)\b/i.exec(line);
      if (!D.length) continue; let deb = D[0].d, fin = D[1] ? D[1].d : null;
      if (!fin && dur) fin = addDays(deb, Math.max(0, Math.round(parseFloat(dur[1].replace(',', '.'))) - 1)); if (!fin) continue;
      if (fin < deb) { const t = deb; deb = fin; fin = t; }
      let cut = D[0].i; if (dur && dur.index < cut) cut = dur.index;
      let nom = line.slice(0, cut).replace(/^[\s\d.\-–)]+/, '').replace(/[\s:\-–|;]+$/, '').trim();
      if (nom.length < 2 || /^(date|d[ée]but|fin|dur[ée]e|t[âa]che|nom)\b/i.test(nom)) continue;
      rows.push({ nom: nom.slice(0, 80), deb, fin, on: true }); }
    return rows;
  }
  // ---- Tableau PDF par coordonnées : items = [{ s: texte, x, y }] (y croît vers le bas) ; retourne { rows, info, cols }
  const COLS = [['ref', /^(id|ref|n°|no|code)$/], ['nom', /^(tache|taches|activite|activites|designation|libelle|travaux|description)/], ['lot', /^(lot|sous-lot|corps)/], ['deb', /^(debut|start|commence)/], ['fin', /^(fin|end|finish|echeance)$/], ['dur', /^(duree|dur)/], ['av', /^(av|avancement|%|progress)/], ['dep', /^(dependance|dependances|predecesseur|predecesseurs|pred)/]];
  const colKey = (t) => { const n = norm(t).replace(/[.\s/]+$/g, ''); const c = COLS.find(([, re]) => re.test(n)); return c ? c[0] : null; };
  function groupRows(items) { const sorted = items.filter(i => String(i.s).trim()).slice().sort((a, b) => a.y - b.y || a.x - b.x), rows = []; for (const it of sorted) { const r = rows[rows.length - 1]; if (r && Math.abs(r.y - it.y) <= 3.5) r.it.push(it); else rows.push({ y: it.y, it: [it] }); } rows.forEach(r => r.it.sort((a, b) => a.x - b.x)); return rows; }
  // regroupe les mots voisins d'une ligne en cellules (écart horizontal > gap)
  function cells(it, gap = 9) { const out = []; for (const w of it) { const c = out[out.length - 1]; if (c && w.x - c.x1 <= gap) { c.s += ' ' + w.s; c.x1 = w.x1 != null ? w.x1 : w.x + String(w.s).length * 4.2; } else out.push({ s: String(w.s), x: w.x, x1: w.x1 != null ? w.x1 : w.x + String(w.s).length * 4.2 }); } return out; }
  function tableFromItems(items, page = 1) {
    const R = groupRows(items), info = {}; const txt = R.map(r => r.it.map(i => i.s).join(' ')).join('\n');
    const mv = /version\s*:?\s*([A-Za-z0-9._-]+)/i.exec(txt); if (mv) info.ver = mv[1]; const md = /date de r[ée]f[ée]rence\s*:?\s*([0-9\/.\-]+)/i.exec(norm(txt) .replace('reference', 'référence')) || /r[ée]f[ée]rence\s*:?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i.exec(txt); if (md) { const dd = dates(md[1]); if (dd[0]) info.ref = dd[0].d; }
    const mp = /projet\s*:?\s*([^|\n]+?)\s*(?:\||$)/im.exec(txt); if (mp) info.projet = mp[1].trim();
    let hi = R.findIndex(r => { const k = cells(r.it).map(c => colKey(c.s)).filter(Boolean); return k.includes('deb') && k.includes('fin'); });
    if (hi < 0) return { rows: [], info, cols: [], noHeader: true };
    const H = cells(R[hi].it).map(c => ({ k: colKey(c.s), x: c.x })), cols = H.filter(h => h.k);
    const bounds = H.map(h => h.x);   // toutes les colonnes d'en-tête (même inconnues : S01, S02…) bornent les cellules
    const rows = [];
    for (let i = hi + 1; i < R.length; i++) {
      const cell = {}; for (const w of R[i].it) { let ci = -1; for (let j = 0; j < H.length; j++) if (H[j].x <= w.x + 2.5) ci = j; if (ci < 0) continue; const k = H[ci].k; if (!k) continue; cell[k] = ((cell[k] || '') + ' ' + w.s).trim(); }
      const D = cell.deb ? dates(cell.deb) : [], F = cell.fin ? dates(cell.fin) : [];
      if (!cell.nom && !D.length && !F.length) continue; if (!D.length && !F.length && !/^[A-Za-z]{0,4}[-._]?\d+$/.test(cell.ref || '')) continue;   // pied de page, remarques…
      const w = {}; const msgs = [];
      const avM = /(\d+(?:[.,]\d+)?)/.exec(cell.av || ''), dep = (cell.dep || '').split(/[,;\s/]+/).map(z => z.trim()).filter(z => z && !/^[-–—]+$/.test(z));
      rows.push({ ref: (cell.ref || '').trim(), nom: (cell.nom || '').trim(), lot: (cell.lot || '').trim(), deb: D[0] ? D[0].d : '', fin: F[0] ? F[0].d : '', dur: cell.dur || '', av: avM ? String(Math.max(0, Math.min(100, parseFloat(avM[1].replace(',', '.'))))) : '', dep, on: true, src: { page, y: Math.round(R[i].y), x: Math.round(R[i].it[0].x) }, msgs });
    }
    validate(rows); return { rows, info, cols: cols.map(c => c.k) };
  }
  // contrôles : jamais de date inventée — une date manquante reste vide et bloque l'import de la ligne tant qu'elle n'est pas saisie
  function validate(rows) {
    const refs = new Map(); rows.forEach(r => { if (r.ref) refs.set(r.ref, (refs.get(r.ref) || 0) + 1); });
    for (const r of rows) { const m = r.msgs = []; if (!r.nom) m.push('Désignation manquante'); if (!r.deb) m.push('Date de début manquante'); if (!r.fin) m.push('Date de fin manquante'); if (r.deb && r.fin && r.fin < r.deb) m.push('Fin avant le début');
      if (r.ref && refs.get(r.ref) > 1) m.push('ID en double'); if (!r.lot) m.push('Lot non détecté');
      for (const d of r.dep) if (!refs.has(d)) m.push('Dépendance inconnue : ' + d); if (r.dep.includes(r.ref)) m.push('Dépendance sur elle-même'); }
    return rows;
  }
  const blocking = (r) => r.msgs.some(m => /manquante|Fin avant/.test(m));
  async function pdfItems(file) {
    if (!(await pdfReadyA())) throw new Error('Lecteur PDF indisponible');
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise, pages = [];
    for (let n = 1; n <= pdf.numPages; n++) { const pg = await pdf.getPage(n), tc = await pg.getTextContent();   // une page à la fois : pas de rendu haute résolution en mémoire
      pages.push(tc.items.filter(i => String(i.str).trim()).map(i => ({ s: i.str, x: i.transform[4], x1: i.transform[4] + (i.width || 0), y: -i.transform[5] }))); if (pg.cleanup) pg.cleanup(); }
    return pages;
  }
  async function pdfLines(file) { const pages = await pdfItems(file), lines = []; for (const it of pages) groupRows(it).forEach(r => lines.push(r.it.map(i => i.s).join(' '))); return lines; }
  function csvLines(txt) { return txt.split(/\r?\n/).map(l => l.replace(/[;\t,](?=(?:[^"]*"[^"]*")*[^"]*$)/g, ' ').replace(/"/g, '')); }
  // MS Project XML : <Task><Name/><Start/><Finish/></Task>
  function mspRows(txt) { const doc = new DOMParser().parseFromString(txt, 'text/xml'), rows = [];
    doc.querySelectorAll('Task').forEach(t => { const g = (k) => { const e = [...t.children].find(c => c.tagName === k); return e ? e.textContent : ''; }; const nom = g('Name'), s = g('Start').slice(0, 10), f = g('Finish').slice(0, 10); if (nom && /^\d{4}-\d{2}-\d{2}$/.test(s) && /^\d{4}-\d{2}-\d{2}$/.test(f)) rows.push({ nom: nom.slice(0, 80), deb: s, fin: f, on: true }); });
    return rows; }
  async function read(file) {
    const n = file.name.toLowerCase(), out = { rows: [], info: {}, mode: '' };
    if (/\.pdf$/.test(n) || file.type === 'application/pdf') {
      const pages = await pdfItems(file); let rows = [];
      pages.forEach((it, i) => { const t = tableFromItems(it, i + 1); if (t.rows.length) { rows = rows.concat(t.rows); out.info = { ...t.info, ...out.info }; out.mode = 'tableau'; } });
      if (!rows.length) { const lines = []; pages.forEach(it => groupRows(it).forEach(r => lines.push(r.it.map(i => i.s).join(' ')))); rows = parseLines(lines).map(r => ({ ...r, ref: '', lot: '', av: '', dep: [], msgs: [], src: null })); validate(rows); out.mode = 'lignes'; }
      out.rows = rows; if (!pages.some(p => p.length)) out.scan = true; return out;
    }
    const txt = await file.text();
    if (/\.xml$/.test(n) || /^\s*<\?xml|<Project/i.test(txt.slice(0, 300))) { out.rows = mspRows(txt).map(r => ({ ...r, ref: '', lot: '', av: '', dep: [], msgs: [], src: null })); validate(out.rows); out.mode = 'xml'; return out; }
    const csv = csvTable(txt); if (csv) { out.rows = csv; out.mode = 'csv'; return out; }
    out.rows = parseLines(csvLines(txt)).map(r => ({ ...r, ref: '', lot: '', av: '', dep: [], msgs: [], src: null })); validate(out.rows); out.mode = 'lignes'; return out;
  }
  // CSV avec en-têtes (séparateur ; , ou tabulation) : mêmes colonnes que le tableau PDF
  function csvTable(txt) {
    const L = txt.split(/\r?\n/).filter(l => l.trim()); if (L.length < 2) return null; const sep = [';', '\t', ','].sort((a, b) => L[0].split(b).length - L[0].split(a).length)[0];
    const sp = (l) => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o.map(z => z.trim()); };
    const H = sp(L[0]).map(colKey); if (!H.includes('deb') || !H.includes('fin')) return null;
    const rows = L.slice(1).map(l => { const v = sp(l), c = {}; H.forEach((k, i) => { if (k && v[i] != null) c[k] = v[i]; });
      const D = dates(c.deb || ''), F = dates(c.fin || ''), avM = /(\d+(?:[.,]\d+)?)/.exec(c.av || '');
      return { ref: c.ref || '', nom: c.nom || '', lot: c.lot || '', deb: D[0] ? D[0].d : '', fin: F[0] ? F[0].d : '', dur: c.dur || '', av: avM ? String(Math.min(100, parseFloat(avM[1].replace(',', '.')))) : '', dep: (c.dep || '').split(/[,;\s/]+/).filter(z => z && !/^[-–—]+$/.test(z)), on: true, src: null, msgs: [] }; }).filter(r => r.nom || r.deb);
    validate(rows); return rows;
  }
  // ---- aperçu plein écran : tableau éditable, avertissements, validation avant import (aucune tâche créée sans confirmation)
  function preview(data, file, onOk) {
    const ov = document.createElement('div'); ov.className = 'pi-ov'; document.body.appendChild(ov); let off = pushBack(() => close()); const close = () => { off && off(); off = null; ov.remove(); };
    const draw = () => { validate(data.rows); const ok = data.rows.filter(r => r.on && !blocking(r)).length, warn = data.rows.filter(r => r.msgs.length).length;
      ov.innerHTML = `<div class="pi-h"><button class="btn sm" data-q>← Annuler</button><b>Aperçu de l'import</b></div>
        <div class="pi-i">${esc(file.name)} · ${data.mode === 'tableau' ? 'tableau détecté' : data.mode === 'csv' ? 'CSV' : data.mode === 'xml' ? 'MS Project' : 'lecture par lignes (à vérifier)'}${data.info.projet ? ' · ' + esc(data.info.projet) : ''}${data.info.ver ? ' · version ' + esc(data.info.ver) : ''}${data.info.ref ? ' · réf. ' + fmtDate(data.info.ref) : ''} · ${data.rows.length} ligne(s)${warn ? ` · <b style="color:#d97706">${warn} avertissement(s)</b>` : ''}</div>
        <div class="pi-t"><table><thead><tr><th></th><th>ID</th><th>Tâche</th><th>Lot</th><th>Début</th><th>Fin</th><th>%</th><th>Dép.</th></tr></thead><tbody>${data.rows.map((r, i) => `<tr data-i="${i}" class="${blocking(r) ? 'bad' : r.msgs.length ? 'warn' : ''}"><td><input type="checkbox" data-c="${i}" ${r.on ? 'checked' : ''}></td><td>${esc(r.ref)}</td><td>${esc(r.nom)}${r.msgs.length ? `<small>⚠ ${esc(r.msgs.join(' · '))}</small>` : ''}</td><td>${esc(r.lot)}</td><td>${r.deb ? fmtDate(r.deb) : '—'}</td><td>${r.fin ? fmtDate(r.fin) : '—'}</td><td>${esc(r.av)}</td><td>${esc(r.dep.join(','))}</td></tr>`).join('')}</tbody></table></div>
        <div class="pi-f"><button class="btn primary" data-ok ${ok ? '' : 'disabled'}>Importer ${ok} tâche(s)</button><small>Les lignes bloquées (date manquante, fin avant début) ne sont pas importées tant qu'elles ne sont pas corrigées (toucher la ligne).</small></div>`;
      ov.querySelector('[data-q]').onclick = () => close();
      ov.querySelectorAll('[data-c]').forEach(c => c.onclick = (e) => { e.stopPropagation(); data.rows[+c.dataset.c].on = c.checked; draw(); });
      ov.querySelectorAll('tbody tr').forEach(tr => tr.onclick = async () => { const r = data.rows[+tr.dataset.i]; const f = await formSheet('Corriger la ligne', [{ name: 'ref', label: 'ID', value: r.ref }, { name: 'nom', label: 'Tâche', value: r.nom }, { name: 'lot', label: 'Lot', value: r.lot }, { name: 'deb', label: 'Début', type: 'date', value: r.deb }, { name: 'fin', label: 'Fin', type: 'date', value: r.fin }, { name: 'av', label: 'Avancement (%)', type: 'number', value: r.av }, { name: 'dep', label: 'Dépendances (ID séparés par des virgules)', value: r.dep.join(',') }], { okLabel: 'Corriger' }); if (!f) return;
        Object.assign(r, { ref: (f.ref || '').trim(), nom: (f.nom || '').trim(), lot: (f.lot || '').trim(), deb: f.deb || '', fin: f.fin || '', av: f.av === '' ? '' : String(Math.max(0, Math.min(100, +f.av || 0))), dep: String(f.dep || '').split(/[,;\s]+/).filter(Boolean), edited: true }); draw(); });
      ov.querySelector('[data-ok]').onclick = async () => { const rows = data.rows.filter(r => r.on && !blocking(r)); close(); await onOk(rows); };
    };
    draw();
  }
  // ---- enregistrement : PDF source conservé, baseline immuable (une seule par version), tâches sans doublon d'ID
  async function commit(p, file, data, rows) {
    const P = planData(p); P.bls = P.bls || []; P.revs = P.revs || []; const ver = data.info.ver || 'V' + String(P.bls.length + P.revs.length + 1).padStart(2, '0');
    let fileId = null; try { fileId = DB.uid(); await DB.put('files', { id: fileId, projectId: p.id, name: file.name, type: file.type || 'application/octet-stream', blob: file, role: 'planning-src', at: Date.now(), size: file.size }); } catch (e) { fileId = null; }
    const snap = rows.map(r => ({ ref: r.ref, nom: r.nom, grp: r.lot, deb: r.deb, fin: r.fin, av: r.av, dep: r.dep.join(','), w: r.w || '' }));
    const entry = { id: DB.uid(), ver, at: Date.now(), by: typeof myName === 'function' ? myName() : '', fileId, refDate: data.info.ref || '', mode: data.mode, tasks: snap };
    const first = !P.bls.length; (first ? P.bls : P.revs).push(entry);
    let n = 0, dup = 0; for (const r of rows) { if (r.ref && P.tasks.some(t => t.ref === r.ref)) { dup++; continue; } if (!r.ref && P.tasks.some(t => t.nom === r.nom && t.deb === r.deb)) { dup++; continue; }
      P.tasks.push({ id: DB.uid(), ref: r.ref, nom: r.nom, grp: r.lot, deb: r.deb, fin: r.fin, av: r.av || '0', dep: r.dep.join(','), src: r.src ? { fileId, page: r.src.page, y: r.src.y, x: r.src.x } : null, hist: [{ d: data.info.ref || todayISO(), av: +r.av || 0, by: entry.by, ver }] }); n++; }
    await DB.put('projects', p); return { n, dup, ver, first };
  }
  async function run(p, redraw) {
    const f = (await pickFiles({ accept: '.pdf,.csv,.txt,.xml,application/pdf,text/csv,text/xml', multiple: false }))[0]; if (!f) return;
    let data; try { toast('Lecture du fichier…'); data = await read(f); } catch (e) { return alertBox('Lecture impossible : ' + (e.message || e)); }
    if (data.scan) return alertBox('Ce PDF ne contient pas de texte (scan ou image). L\'OCR n\'est pas encore disponible : utilisez un PDF texte, un CSV ou un export MS Project XML.');
    if (!data.rows.length) return alertBox('Aucune tâche reconnue (ID, tâche, dates). Rien n\'a été créé.');
    preview(data, f, async (rows) => { if (!rows.length) return toast('Rien à importer'); const r = await commit(App.project, f, data, rows); toast(`${r.n} tâche(s) importée(s)` + (r.dup ? ` · ${r.dup} déjà présente(s)` : '') + ` · baseline ${r.ver}`); redraw && redraw(); });
  }
  return { run, parseLines, mspRows, dates, tableFromItems, csvTable, validate, commit, read };
})();
