// ================= Fichiers (comme Fieldwire) : tous les fichiers du projet, taille de chacun, rangés par niveau / par type de plan =================
//   Plans : un fichier = un plan (aperçu + PDF source + DWG/DXF éventuels, tailles additionnées). Documents : tout fichier ajouté ici (ou ailleurs en « document »).
//   Les tailles sont celles des fichiers présents SUR le téléphone ; un fichier déjà libéré (resté sur Drive) compte pour 0 et est signalé.
const Fichiers = (() => {
  const mb = (b) => typeof mbTxt === 'function' ? mbTxt(b) : (b >= 1048576 ? (b / 1048576).toFixed(1) + ' Mo' : Math.max(0, Math.round(b / 1024)) + ' Ko');
  const sz = (f) => f ? (f.blob ? (f.blob.size || 0) : (+f.size || 0)) : 0;
  const typeLabel = (k) => k ? ((typeof DISCIPLINES !== 'undefined' && DISCIPLINES.find(d => d.k === k)) || {}).l || k : 'Sans type';
  const rank = (n) => typeof navLevelRank === 'function' ? navLevelRank(n) : 500;

  // modèle pur : lignes { kind, id, name, niv, type, size, n, freed, at }, total, groupes
  async function collect(p) {
    const [files, plans, folders] = await Promise.all([DB.byProject('files', p.id), DB.byProject('plans', p.id), DB.byProject('folders', p.id)]);
    const fById = new Map(files.map(f => [f.id, f])), byId = new Map(folders.map(f => [f.id, f])), used = new Set(), rows = [];
    const topName = (fid) => { let f = byId.get(fid); while (f && f.parentId && byId.get(f.parentId)) f = byId.get(f.parentId); return f ? f.name : ''; };
    for (const pl of plans) {
      const ids = [pl.fileId, pl.pdfFileId, pl.dwgFileId, pl.dxfFileId].filter(Boolean), fs = ids.map(i => fById.get(i)).filter(Boolean);
      ids.forEach(i => used.add(i));
      rows.push({ kind: 'plan', id: pl.id, name: pl.name || 'Plan', niv: topName(pl.folderId), type: typeof planTypeKey === 'function' ? planTypeKey(pl, p) : (pl.disc || ''), size: fs.reduce((s, f) => s + sz(f), 0), n: fs.length, freed: fs.some(f => !f.blob), at: pl.updatedAt || pl.createdAt || 0, plan: pl });
    }
    for (const f of files) { if (f.role !== 'doc' || used.has(f.id)) continue;
      rows.push({ kind: 'doc', id: f.id, name: f.name || 'Document', niv: f.niv || '', type: f.ptype || '', size: sz(f), n: 1, freed: !f.blob, at: f.updatedAt || f.createdAt || 0, f }); }
    return { rows, total: rows.reduce((s, r) => s + r.size, 0) };
  }
  // regroupement : par niveau (ordre R+n…) ou par type de plan ; chaque groupe = { key, label, rows, size }
  function group(rows, mode) {
    if (mode === 'date') return [{ key: '*', label: 'Tous les fichiers (récents d\'abord)', rows: [...rows].sort((a, b) => b.at - a.at), size: rows.reduce((s, r) => s + r.size, 0) }];
    const G = new Map();
    for (const r of rows) { const k = mode === 'type' ? (r.type || '') : (r.niv || ''); if (!G.has(k)) G.set(k, []); G.get(k).push(r); }
    const out = [...G.entries()].map(([k, rs]) => ({ key: k, label: k ? (mode === 'type' ? typeLabel(k) : k) : (mode === 'type' ? 'Sans type' : 'Sans niveau'), rows: rs.sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr', { numeric: true })), size: rs.reduce((s, r) => s + r.size, 0) }));
    out.sort((a, b) => (!a.key) - (!b.key) || (mode === 'niv' ? rank(a.key) - rank(b.key) : 0) || a.label.localeCompare(b.label, 'fr', { numeric: true }));
    return out;
  }
  async function size(pid) { try { const p = { id: pid }; return mb((await collect(p)).total); } catch (e) { return ''; } }

  async function render(root) {
    const p = App.project, canW = (typeof Team === 'undefined' || !Team.lvl) ? true : Team.lvl('files') >= 2;
    let view = 'niv'; try { view = localStorage.getItem('fi.view') || 'niv'; } catch (e) {}
    const st = App.fi = App.fi || { q: '', open: {} };
    const { rows, total } = await collect(p);
    try { App.fichCache = App.fichCache || {}; App.fichCache[p.id] = mb(total); } catch (e) {}
    const q = (st.q || '').toLowerCase(), shown = q ? rows.filter(r => `${r.name} ${r.niv} ${typeLabel(r.type)}`.toLowerCase().includes(q)) : rows, G = group(shown, view);
    const ic = (r) => r.kind === 'plan' ? icon('plans') : icon('file');
    root.innerHTML = `<div class="pagehead"><h2>Fichiers</h2><p class="fi-tot"><b>${rows.length}</b> fichier(s) · <b>${mb(total)}</b> sur le téléphone</p></div>
      <div class="fi-bar"><input class="fi-q" placeholder="🔍 Rechercher un fichier…" value="${esc(st.q || '')}">
        <div class="fi-chips">${[['niv', 'Par niveau'], ['type', 'Par type de plan'], ['date', 'Récents']].map(([k, l]) => `<button class="${view === k ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div></div>
      ${G.length ? G.map(g => `<div class="fi-g ${view === 'date' || st.open[view + g.key] ? 'open' : ''}" data-k="${esc(view + g.key)}"><button class="fi-gh" ${view === 'date' ? 'disabled' : ''}><span>${view === 'date' ? '🕒' : '📁'} ${esc(g.label)}</span><i>${g.rows.length} · ${mb(g.size)}</i></button>
        <div class="fi-gb">${g.rows.map(r => `<button class="fi-r" data-id="${r.kind}:${r.id}">${ic(r)}<span class="fi-n"><b>${esc(r.name)}</b><small>${[view !== 'niv' ? r.niv : '', view !== 'type' && r.type ? typeLabel(r.type) : '', r.kind === 'plan' ? 'plan' : ''].filter(Boolean).map(esc).join(' · ')}</small></span><em>${r.freed && !r.size ? 'Drive' : mb(r.size)}</em></button>`).join('')}</div></div>`).join('')
      : `<div class="empty">Aucun fichier${q ? ' pour cette recherche' : ''}.${canW ? '<br>Appuyez sur <b>+</b> pour ajouter des fichiers (plans, PDF, Word, Excel…).' : ''}</div>`}`;
    $('.fi-q', root).oninput = (e) => { st.q = e.target.value; clearTimeout(st.t); st.t = setTimeout(() => render(root), 250); };
    $$('[data-v]', root).forEach(b => b.onclick = () => { try { localStorage.setItem('fi.view', b.dataset.v); } catch (e) {} render(root); });
    $$('.fi-gh', root).forEach(b => b.onclick = () => { const k = b.parentElement.dataset.k; st.open[k] = !st.open[k]; b.parentElement.classList.toggle('open', !!st.open[k]); });
    const all = new Map(rows.map(r => [r.kind + ':' + r.id, r]));
    $$('.fi-r', root).forEach(b => b.onclick = () => rowMenu(all.get(b.dataset.id), canW, () => render(root)));
    if (canW) fab(root, () => addFiles(p, () => render(root)));
  }

  async function rowMenu(r, canW, redo) {
    if (!r) return;
    if (r.kind === 'plan') {
      const pl = r.plan, v = await menu(r.name, [{ label: 'Ouvrir le plan', icon: 'plans', value: 'open' }, ...(pl.pdfFileId ? [{ label: 'Ouvrir le PDF source', icon: 'pdf', value: 'pdf' }] : [])]);
      if (v === 'open') return openPlanViewer(pl, { ...(typeof planCtx === 'function' ? planCtx(() => redo()) : {}) });
      if (v === 'pdf') { const f = await DB.get('files', pl.pdfFileId); if (f && f.blob) return openFileRecord(f, r.name); toast('PDF source retiré du téléphone (sur Drive)'); }
      return;
    }
    const f = r.f, v = await menu(f.name || 'Document', [{ label: 'Ouvrir', icon: 'file', value: 'open' }, ...(canW ? [{ label: 'Niveau / type', icon: 'folder', value: 'cls' }, { label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Supprimer', icon: 'trash', danger: true, value: 'del' }] : [])]);
    if (v === 'open') { if (f.blob) return openFileRecord(f, f.name); return toast('Fichier retiré du téléphone (sur Drive)'); }
    if (v === 'cls') { const c = await classify([f.name], { niv: f.niv, ptype: f.ptype }); if (c) { f.niv = c.niv; f.ptype = c.ptype; await DB.put('files', f); redo(); } }
    if (v === 'ren') { const x = await formSheet('Renommer', [{ name: 'name', label: 'Nom', value: f.name || '' }]); if (x && x.name) { f.name = x.name; await DB.put('files', f); redo(); } }
    if (v === 'del' && await confirmBox(`Supprimer « ${f.name} » ?`, 'Supprimer')) { await DB.del('files', f.id); redo(); }
  }
  // niveau (dossiers de plans du projet, ou libre) + type de plan
  async function classify(names, cur = {}) {
    const folders = (await DB.byProject('folders', App.project.id)).filter(f => !f.parentId).map(f => f.name).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'fr', { numeric: true }));
    const r = await formSheet(names.length > 1 ? `${names.length} fichiers` : names[0], [
      { name: 'niv', label: 'Niveau', type: 'select', value: cur.niv || '', options: [{ value: '', label: '— aucun —' }, ...folders.map(n => ({ value: n, label: n }))] },
      { name: 'ptype', label: 'Type de plan', type: 'select', value: cur.ptype || '', options: [{ value: '', label: '— aucun —' }, ...(typeof DISCIPLINES !== 'undefined' ? DISCIPLINES : []).map(d => ({ value: d.k, label: d.l }))] }], { okLabel: 'Valider' });
    return r ? { niv: r.niv || '', ptype: r.ptype || '' } : null;
  }
  async function addFiles(p, redo) {
    const files = await pickFiles({ accept: '*/*', multiple: true }); if (!files || !files.length) return;
    const c = await classify(files.map(f => f.name)); if (!c) return;
    const ld = loading('Ajout…');
    try { for (const file of files) await DB.put('files', { projectId: p.id, blob: file, mime: mimeFromName(file.name, file.type), name: file.name, role: 'doc', niv: c.niv, ptype: c.ptype, by: typeof Team !== 'undefined' && Team.uid ? Team.uid() : undefined }); }
    finally { ld.close(); }
    toast(`${files.length} fichier(s) ajouté(s) ✓`); redo();
  }
  return { render, collect, group, size, mb };
})();
