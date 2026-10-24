// ================= Rubriques personnalisées d'un lot : un tableau à soi (nom, colonnes), par niveau, avec export / import Excel =================
const RUB_TYPES = [['text', 'Texte'], ['num', 'Nombre'], ['date', 'Date'], ['check', 'Case ✓']];
const RUB_TPL = {
  av: { name: 'Avancement', e: '📊', cols: [['Zone / partie', 'text'], ['Désignation', 'text'], ['Avancement %', 'num'], ['Date', 'date'], ['Observation', 'text']] },
  rec: { name: 'Réception', e: '✅', cols: [['Partie d\'ouvrage', 'text'], ['Date', 'date'], ['Conforme', 'check'], ['Réceptionné avec', 'text'], ['Observation', 'text']] },
  list: { name: 'Liste', e: '🗂', cols: [['Désignation', 'text'], ['Quantité', 'num'], ['Date', 'date'], ['Observation', 'text']] },
};
const rubList = (L) => (L.rub = L.rub || []);
const rubRows = (f, L, R) => { f.lotData = f.lotData || {}; const D = f.lotData[L.id] = f.lotData[L.id] || {}; D._rub = D._rub || {}; return (D._rub[R.id] = D._rub[R.id] || []); };
const rubCols = (spec) => spec.map(([l, t]) => ({ k: DB.uid().slice(0, 8), l, t }));
// colonnes écrites en une ligne : « Désignation ; Quantité:nombre ; Date:date ; Fait:case »
const rubParseCols = (txt) => String(txt || '').split(/[;\n]/).map(s => s.trim()).filter(Boolean).map(s => { const [l, t0 = ''] = s.split(':').map(x => x.trim()), t = /^n/i.test(t0) ? 'num' : /^d/i.test(t0) ? 'date' : /^c|^✓/i.test(t0) ? 'check' : 'text'; return [l, t]; });
const rubColsTxt = (cols) => cols.map(c => c.l + (c.t === 'text' ? '' : ':' + { num: 'nombre', date: 'date', check: 'case' }[c.t])).join(' ; ');

async function rubNew(p, L) {
  const k = await menu(`Nouvelle rubrique · ${L.name}`, [{ label: '📊 Avancement (zone, %, date)', value: 'av' }, { label: '✅ Réception (partie, conforme, date)', value: 'rec' }, { label: '🗂 Liste simple', value: 'list' }, { label: '✏️ Mes colonnes…', value: 'own' }]);
  if (!k) return null;
  const T = RUB_TPL[k] || { name: '', e: '📋', cols: [['Désignation', 'text'], ['Date', 'date'], ['Observation', 'text']] };
  const r = await formSheet('Nouvelle rubrique', [{ name: 'n', label: 'Nom', value: T.name, placeholder: 'Ex : Essais de pression' }, { name: 'e', label: 'Emoji', value: T.e },
    { name: 'c', label: 'Colonnes (séparées par ;  —  :nombre  :date  :case)', type: 'textarea', value: rubColsTxt(T.cols.map(([l, t]) => ({ l, t }))) }], { okLabel: 'Créer' });
  if (!r || !r.n) return null;
  const cols = rubParseCols(r.c); if (!cols.length) { toast('Ajoutez au moins une colonne'); return null; }
  const R = { id: DB.uid(), name: r.n.trim(), e: (r.e || '📋').trim(), cols: rubCols(cols) };
  rubList(L).push(R); await DB.put('projects', p); return R;
}
async function rubMenu(p, L, R, redraw) {
  const v = await menu(`${R.e} ${R.name}`, [{ label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Colonnes', icon: 'grid', value: 'col' }, { label: 'Monter', icon: 'chevup', value: 'up' }, { label: 'Supprimer la rubrique', icon: 'trash', danger: true, value: 'del' }]);
  const Ls = rubList(L), i = Ls.indexOf(R);
  if (v === 'ren') { const r = await formSheet('Renommer', [{ name: 'n', label: 'Nom', value: R.name }, { name: 'e', label: 'Emoji', value: R.e }]); if (r && r.n) { R.name = r.n.trim(); R.e = (r.e || R.e).trim(); } }
  if (v === 'col') { const r = await formSheet('Colonnes', [{ name: 'c', label: 'Colonnes (séparées par ;  —  :nombre  :date  :case)', type: 'textarea', value: rubColsTxt(R.cols) }]); if (r) { const nc = rubParseCols(r.c); if (nc.length) R.cols = nc.map(([l, t]) => { const o = R.cols.find(c => c.l === l); return o ? { ...o, t } : { k: DB.uid().slice(0, 8), l, t }; }); } }
  if (v === 'up' && i > 0) { [Ls[i - 1], Ls[i]] = [Ls[i], Ls[i - 1]]; }
  if (v === 'del') { if (!await confirmBox(`Supprimer la rubrique « ${R.name} » et ses lignes (tous les niveaux) ?`, 'Supprimer')) return; Ls.splice(i, 1); }
  if (v) { await DB.put('projects', p); redraw && redraw(); }
}
const rubFmt = (c, v) => c.t === 'check' ? (v ? '✓' : '') : c.t === 'date' ? (v ? fmtDate(v) : '') : c.t === 'num' ? (v === '' || v == null ? '' : String(v)) : (v || '');
async function rubEdit(R, row, title) {
  const r = await formSheet(row ? title : 'Nouvelle ligne · ' + title, R.cols.map(c => c.t === 'check' ? { name: c.k, label: c.l, type: 'select', value: row && row[c.k] ? '1' : '', options: [{ value: '', label: '—' }, { value: '1', label: '✓ Oui' }] }
    : { name: c.k, label: c.l, type: c.t === 'date' ? 'date' : c.t === 'num' ? 'number' : 'text', value: row ? row[c.k] ?? '' : c.t === 'date' ? todayISO() : '' }), { okLabel: 'Enregistrer', danger: row ? 'Supprimer' : null });
  if (!r) return null; if (r.__danger) return 'del';
  const o = {}; R.cols.forEach(c => { o[c.k] = c.t === 'check' ? r[c.k] === '1' : c.t === 'num' ? (r[c.k] === '' ? '' : fN(r[c.k])) : r[c.k]; }); return o;
}
// lecture d'un .xlsx (première feuille) : texte des cellules ligne par ligne
async function rubReadXlsx(file) {
  await loadScript('vendor/fflate.min.js');
  const z = fflate.unzipSync(new Uint8Array(await file.arrayBuffer())), dec = (n) => z[n] ? new TextDecoder().decode(z[n]) : '';
  const ss = [...dec('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(''));
  const un = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const sheet = dec(Object.keys(z).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0] || ''), rows = [];
  for (const m of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) { const row = [];
    for (const c of m[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) { let ci = 0; for (const ch of c[1]) ci = ci * 26 + ch.charCodeAt(0) - 64; ci--;
      const t = (c[2].match(/t="(\w+)"/) || [])[1], v = ((c[3] || '').match(/<v>([\s\S]*?)<\/v>/) || [])[1], is = ((c[3] || '').match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1];
      row[ci] = un(t === 's' ? ss[+v] || '' : t === 'inlineStr' ? is || '' : v || ''); }
    rows.push(row); }
  return rows;
}
const rubDate = (v) => { if (!v) return ''; if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); const m = String(v).match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/); if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const n = +v; if (n > 20000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + n * 864e5).toISOString().slice(0, 10); return ''; };

// page de la rubrique pour un niveau (dossier)
function rubOpen(p, L, f, R) {
  return new Promise((resolve) => {
    const el = document.createElement('div'); el.className = 'fullpage rub-page'; document.body.appendChild(el);
    const close = () => { unBack(); el.remove(); resolve(); }, unBack = pushBack(() => { el.remove(); resolve(); });
    const save = () => DB.put('folders', f);
    const draw = () => {
      const rows = rubRows(f, L, R), nums = R.cols.filter(c => c.t === 'num');
      const tot = nums.map(c => { const vs = rows.map(r => r[c.k]).filter(v => v !== '' && v != null).map(Number); return !vs.length ? '' : /%/.test(c.l) ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) + ' % (moy.)' : vs.reduce((a, b) => a + b, 0).toLocaleString('fr-FR'); });
      el.innerHTML = `<div class="topbar"><button class="iconbtn" data-a="x">${icon('back')}</button><div style="flex:1;min-width:0"><h1 style="font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(R.e)} ${esc(R.name)}</h1><small style="color:var(--muted)">${esc(L.e)} ${esc(L.name)} · ${esc(f.name)}</small></div>
          <button class="iconbtn" data-a="xls" title="Excel">${icon('grid')}</button><button class="iconbtn" data-a="more">${icon('more')}</button></div>
        <div class="rub-body"><div class="gt-wrap"><table class="gt rub-t"><thead><tr><th>N°</th>${R.cols.map(c => `<th class="${c.t}">${esc(c.l)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((r, i) => `<tr data-i="${i}"><td class="n">${i + 1}</td>${R.cols.map(c => `<td class="${c.t}">${esc(rubFmt(c, r[c.k]))}${c.t === 'num' && /%/.test(c.l) && r[c.k] !== '' && r[c.k] != null ? `<i class="rub-bar" style="--v:${Math.max(0, Math.min(100, +r[c.k]))}%"></i>` : ''}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${R.cols.length + 1}" class="rub-none">Aucune ligne — touchez « ＋ Ajouter une ligne »</td></tr>`}</tbody>
          ${nums.length && rows.length ? `<tfoot><tr><td>Σ</td>${R.cols.map(c => `<td class="${c.t}">${c.t === 'num' ? tot[nums.indexOf(c)] : ''}</td>`).join('')}</tr></tfoot>` : ''}</table></div>
          <button class="btn rub-add" data-a="add">${icon('plus')} Ajouter une ligne</button></div>`;
      $('[data-a=x]', el).onclick = close;
      $('[data-a=add]', el).onclick = async () => { const o = await rubEdit(R, null, R.name); if (o && o !== 'del') { o.id = DB.uid(); rows.push(o); await save(); draw(); } };
      $$('tr[data-i]', el).forEach(tr => tr.onclick = async () => { const i = +tr.dataset.i, o = await rubEdit(R, rows[i], `${R.name} · ligne ${i + 1}`); if (!o) return; if (o === 'del') { if (!await confirmBox('Supprimer cette ligne ?')) return; rows.splice(i, 1); } else rows[i] = { ...rows[i], ...o }; await save(); draw(); });
      $('[data-a=xls]', el).onclick = async () => { const b = await xlsxBlob([{ name: R.name.slice(0, 28) || 'Rubrique', head: 0, widths: [6, ...R.cols.map(c => c.t === 'text' ? 34 : 14)], rows: [['N°', ...R.cols.map(c => c.l)], ...rows.map((r, i) => [i + 1, ...R.cols.map(c => c.t === 'num' ? (r[c.k] === '' ? '' : +r[c.k]) : rubFmt(c, r[c.k]))])] }]);
        shareBlob(b, `${safeName(R.name)}_${safeName(f.name)}.xlsx`); };
      $('[data-a=more]', el).onclick = async () => {
        const v = await menu(R.name, [{ label: 'Exporter en Excel', icon: 'grid', value: 'xls' }, { label: 'Importer depuis Excel (.xlsx)', icon: 'upload', value: 'imp' }, { label: 'Renommer / colonnes…', icon: 'edit', value: 'cfg' }]);
        if (v === 'xls') $('[data-a=xls]', el).click();
        if (v === 'cfg') { await rubMenu(p, L, R); if (!rubList(L).includes(R)) return close(); draw(); }
        if (v === 'imp') { const [file] = await pickFiles({ accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', multiple: false }); if (!file) return;
          let data; try { data = await rubReadXlsx(file); } catch (e) { return alertBox('Lecture impossible : ' + (e.message || e)); }
          const hi = data.findIndex(r => r && r.filter(Boolean).length >= Math.min(2, R.cols.length)); if (hi < 0) return toast('Feuille vide');
          const head = data[hi].map(h => normQ(h || '')), map = R.cols.map(c => head.indexOf(normQ(c.l)));
          const body = data.slice(hi + 1).filter(r => r && r.some(x => String(x || '').trim()) && !/^(total|σ)/i.test(String(r[0] || r[1] || '')));
          const list = body.map(r => { const o = { id: DB.uid() }; R.cols.forEach((c, j) => { const v = map[j] >= 0 ? r[map[j]] : r[j + (normQ(head[0]) === 'n°' || normQ(head[0]) === 'n' ? 1 : 0)]; o[c.k] = c.t === 'num' ? (v === '' || v == null ? '' : fN(v)) : c.t === 'date' ? rubDate(v) : c.t === 'check' ? /^(1|✓|x|oui|vrai|true)$/i.test(String(v || '').trim()) : (v || ''); }); return o; });
          if (!list.length) return toast('Aucune ligne trouvée');
          const w = rows.length ? await menu(`${list.length} ligne(s) trouvée(s)`, [{ label: 'Ajouter à la suite', value: 'add' }, { label: 'Remplacer le tableau', value: 'rep', danger: true }]) : 'add'; if (!w) return;
          if (w === 'rep') rows.splice(0, rows.length); rows.push(...list); await save(); toast(`${list.length} ligne(s) importée(s) ✓`); draw(); }
      };
    };
    draw();
  });
}
