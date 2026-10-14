// ================= Clauses techniques : CPS, CCTP, CCAP… avec recherche dans le texte de tous les cahiers =================
const CL_TYPES = ['CPS', 'CCTP', 'CCAP', 'RC', 'BPU / DQE', 'Normes / DTU', 'Notes de calcul', 'Autre'];
// index du texte : base locale séparée (non synchronisée, recalculée si besoin)
const ClIdx = (() => {
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('chantier-idx', 1); r.onupgradeneeded = () => r.result.createObjectStore('txt'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('txt', mode), st = t.objectStore('txt'); const rq = fn(st); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); }); };
  return { get: (id) => tx('readonly', s => s.get(id)), set: (id, v) => tx('readwrite', s => s.put(v, id)), del: (id) => tx('readwrite', s => s.delete(id)) };
})();
const clIndexing = {};
async function clIndex(c, onProg) {
  if (clIndexing[c.fileId]) return clIndexing[c.fileId];
  return clIndexing[c.fileId] = (async () => {
    try {
      const f = await DB.get('files', c.fileId); if (!f || !f.blob || !pdfReady()) return null;
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await f.blob.arrayBuffer()) }).promise;
      const pages = await pdfPagesText(pdf, onProg); await ClIdx.set(c.fileId, pages); return pages;
    } catch (e) { console.warn('index', e); return null; } finally { delete clIndexing[c.fileId]; }
  })();
}

async function renderClauses(root) {
  const p = App.project; p.clauses = p.clauses || [];
  const save = async () => { await DB.put('projects', p); };
  let q = App.clQ || '';
  const draw = async () => {
    const idx = {}; for (const c of p.clauses) idx[c.id] = await ClIdx.get(c.fileId).catch(() => null);
    let res = '';
    if (q.trim().length >= 2) {
      const nq = normTxt(q.trim()), hits = [];
      for (const c of p.clauses) {
        if (normTxt(c.name).includes(nq)) hits.push({ c, page: 1, snip: '' });
        (idx[c.id] || []).forEach((t, i) => { const n = normTxt(t), k = n.indexOf(nq); if (k < 0) return;
          let cnt = 0, j = k; while (j >= 0 && cnt < 99) { cnt++; j = n.indexOf(nq, j + nq.length); }
          const a = Math.max(0, k - 70), raw = t.slice(a, k + nq.length + 110).replace(/\s+/g, ' ');
          hits.push({ c, page: i + 1, cnt, snip: (a ? '…' : '') + esc(raw).replace(new RegExp(esc(t.slice(k, k + nq.length)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), m => `<mark>${m}</mark>`) + '…' }); });
      }
      res = `<div class="cl-res"><div class="cl-rh">${hits.length} résultat(s) pour « ${esc(q.trim())} »</div>${hits.slice(0, 150).map((h, i) => `<button class="cl-hit" data-h="${i}"><div class="cl-hm"><b>${esc(h.c.type)}</b> ${esc(h.c.name)} <span>p. ${h.page}${h.cnt > 1 ? ' · ' + h.cnt + '×' : ''}</span></div>${h.snip ? `<div class="cl-sn">${h.snip}</div>` : ''}</button>`).join('') || '<div class="cl-none">Aucun résultat. Vérifiez que les cahiers sont indexés (texte lisible, pas un scan).</div>'}</div>`;
      draw.hits = hits;
    }
    const groups = CL_TYPES.map(t => [t, p.clauses.filter(c => c.type === t)]).filter(([, l]) => l.length);
    root.innerHTML = `<div class="pagehead"><h2>Clauses techniques</h2><p>CPS, CCTP, CCAP… · recherche dans tout le texte</p></div><div class="cl-prog"></div>
      <div class="search cl-search">${icon('search')}<input placeholder="Rechercher dans les cahiers (ex : enrobage, B25, décoffrage)" value="${esc(q)}"></div>
      ${res || (p.clauses.length ? groups.map(([t, l]) => `<div class="cl-g">${esc(t)}</div><div class="list">${l.map(c => `<div class="row" data-c="${c.id}"><span class="cl-ty">${esc(c.type.split(' ')[0])}</span><div class="grow"><div class="title">${esc(c.name)}</div><div class="sub">${idx[c.id] ? idx[c.id].length + ' page(s) · ✓ indexé' : clIndexing[c.fileId] ? 'Indexation…' : 'Non indexé'}${c.at ? ' · ' + fmtDate(new Date(c.at).toISOString().slice(0, 10)) : ''}</div></div><button class="iconbtn" data-cm="${c.id}">${icon('more')}</button></div>`).join('')}</div>`).join('')
        : `<div class="empty">Aucun cahier.<br>Appuyez sur <b>+</b> pour ajouter le CPS, le CCTP… (PDF).<br>Vous pourrez ensuite chercher un mot dans tous les cahiers.</div>`)}`;
    if (draw.fab) root.appendChild(draw.fab);
    const si = $('.cl-search input', root);
    si.oninput = () => { q = App.clQ = si.value; clearTimeout(root._t); root._t = setTimeout(() => draw().then(() => { const n = $('.cl-search input', root); n.focus(); n.setSelectionRange(q.length, q.length); }), 300); };
    $$('[data-h]', root).forEach(b => b.onclick = async () => { const h = draw.hits[+b.dataset.h]; const f = await DB.get('files', h.c.fileId); if (f && f.blob) showPdf(f.blob, h.c.name, { page: h.page, q: q.trim() }); else toast('Fichier indisponible'); });
    $$('[data-c]', root).forEach(r => r.onclick = async (e) => { if (e.target.closest('[data-cm]')) return; const c = p.clauses.find(x => x.id === r.dataset.c); const f = await DB.get('files', c.fileId); if (f && f.blob) showPdf(f.blob, c.name); else toast('Fichier indisponible'); });
    $$('[data-cm]', root).forEach(b => b.onclick = async () => {
      const c = p.clauses.find(x => x.id === b.dataset.cm);
      const v = await menu(c.name, [{ label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Type de document', icon: 'book', value: 'ty' }, { label: 'Réindexer le texte', icon: 'search', value: 'idx' }, { label: 'Supprimer', icon: 'trash', danger: true, value: 'del' }]);
      if (v === 'ren') { const r = await formSheet('Renommer', [{ name: 'n', label: 'Nom', value: c.name }]); if (r && r.n) { c.name = r.n; await save(); draw(); } }
      if (v === 'ty') { const t = await menu('Type', CL_TYPES.map(x => ({ label: x, icon: 'book', value: x }))); if (t) { c.type = t; await save(); draw(); } }
      if (v === 'idx') { await ClIdx.del(c.fileId); indexAll(); }
      if (v === 'del' && await confirmBox(`Supprimer « ${c.name} » ?`)) { p.clauses = p.clauses.filter(x => x !== c); await DB.del('files', c.fileId); await ClIdx.del(c.fileId).catch(() => {}); await save(); draw(); }
    });
  };
  const indexAll = async () => {
    for (const c of p.clauses) { if (await ClIdx.get(c.fileId).catch(() => null)) continue; const pr = (m) => { const x = $('.cl-prog', root); if (x) x.textContent = m; }; pr(`Lecture de « ${c.name} »…`); try { await clIndex(c, (i, n) => pr(`📖 Lecture de « ${c.name} » : page ${i}/${n}`)); } finally { pr(''); } }
    if (root.isConnected) draw();
  };
  await draw();
  fab(root, async () => {
    const files = await pickFiles({ accept: 'application/pdf', multiple: true }); if (!files.length) return;
    const t = await menu('Type de document', CL_TYPES.map(x => ({ label: x, icon: 'book', value: x }))); if (!t) return;
    const ld = loading('Enregistrement…');
    try { for (const f of files) { const rec = await DB.put('files', { projectId: p.id, blob: f, mime: 'application/pdf', name: f.name, role: 'doc' }); p.clauses.push({ id: DB.uid(), name: f.name.replace(/\.pdf$/i, ''), type: t, fileId: rec.id, at: Date.now() }); } await save(); }
    finally { ld.close(); }
    await draw(); indexAll();
  });
  draw.fab = root.querySelector('.fab');
  indexAll();
}
