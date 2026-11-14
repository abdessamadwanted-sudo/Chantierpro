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
  async function pdfLines(file) {
    if (!(await pdfReadyA())) throw new Error('Lecteur PDF indisponible');
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise, lines = [];
    for (let n = 1; n <= pdf.numPages; n++) { const tc = await (await pdf.getPage(n)).getTextContent(), by = new Map();
      for (const it of tc.items) { if (!String(it.str).trim()) continue; const y = Math.round(it.transform[5] / 3); (by.get(y) || by.set(y, []).get(y)).push(it); }
      [...by.entries()].sort((a, b) => b[0] - a[0]).forEach(([, a]) => lines.push(a.sort((p, q) => p.transform[4] - q.transform[4]).map(i => i.str).join(' '))); }
    return lines;
  }
  function csvLines(txt) { return txt.split(/\r?\n/).map(l => l.replace(/[;\t,](?=(?:[^"]*"[^"]*")*[^"]*$)/g, ' ').replace(/"/g, '')); }
  // MS Project XML : <Task><Name/><Start/><Finish/></Task>
  function mspRows(txt) { const doc = new DOMParser().parseFromString(txt, 'text/xml'), rows = [];
    doc.querySelectorAll('Task').forEach(t => { const g = (k) => { const e = [...t.children].find(c => c.tagName === k); return e ? e.textContent : ''; }; const nom = g('Name'), s = g('Start').slice(0, 10), f = g('Finish').slice(0, 10); if (nom && /^\d{4}-\d{2}-\d{2}$/.test(s) && /^\d{4}-\d{2}-\d{2}$/.test(f)) rows.push({ nom: nom.slice(0, 80), deb: s, fin: f, on: true }); });
    return rows; }
  async function read(file) {
    const n = file.name.toLowerCase();
    if (/\.pdf$/.test(n) || file.type === 'application/pdf') return parseLines(await pdfLines(file));
    const txt = await file.text();
    if (/\.xml$/.test(n) || /^\s*<\?xml|<Project/i.test(txt.slice(0, 300))) return mspRows(txt);
    return parseLines(csvLines(txt));
  }
  async function run(p, redraw) {
    const f = (await pickFiles({ accept: '.pdf,.csv,.txt,.xml,application/pdf,text/csv,text/xml', multiple: false }))[0]; if (!f) return;
    let rows; try { toast('Lecture du fichier…'); rows = await read(f); } catch (e) { return alertBox('Lecture impossible : ' + (e.message || e)); }
    if (!rows.length) return alertBox('Aucune tâche reconnue (nom + dates). Si le PDF est une image scannée, utilisez un PDF texte, un CSV ou un export MS Project XML.');
    for (;;) { const on = rows.filter(r => r.on).length;
      const v = await menu(`Aperçu — ${on}/${rows.length} tâche(s) à importer`, [{ label: `✔ Importer ${on} tâche(s)`, value: '__ok' }, ...rows.slice(0, 60).map((r, i) => ({ label: `${r.on ? '☑' : '☐'} ${r.nom} · ${fmtDate(r.deb)} → ${fmtDate(r.fin)}`, value: String(i) }))]);
      if (v == null) return; if (v === '__ok') break; rows[+v].on = !rows[+v].on; }
    const P = planData(p); let n = 0;
    for (const r of rows.filter(r => r.on)) { if (P.tasks.some(t => t.nom === r.nom && t.deb === r.deb)) continue; P.tasks.push({ id: DB.uid(), nom: r.nom, deb: r.deb, fin: r.fin, av: '0' }); n++; }
    await DB.put('projects', p); toast(`${n} tâche(s) importée(s)`); redraw && redraw();
  }
  return { run, parseLines, mspRows, dates };
})();
