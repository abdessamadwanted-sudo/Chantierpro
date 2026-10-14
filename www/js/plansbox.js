// ================= Pin « Plans de l'ouvrage » : Zones → Parties d'ouvrage → PDF des plans =================
// Jusqu'à 10 zones par pin et 10 parties d'ouvrage par zone ; chaque niveau se renomme, se réordonne, se supprime.
const PB_MAX = 10;
async function pbPickDocs(projectId) {
  const how = await menu('Ajouter un plan', [
    { label: 'PDF / image du téléphone (plusieurs possibles)', icon: 'phone', value: 'file' },
    { label: 'Plan déjà dans le projet', icon: 'plans', value: 'plan' },
    { label: 'Lien Google Drive', icon: 'drive', value: 'url' },
  ]);
  if (how === 'file') {
    const files = await pickFiles({ accept: 'application/pdf,image/*,*/*', multiple: true }); if (!files.length) return [];
    const ld = loading('Enregistrement…'), out = [];
    try { for (const f of files) { const rec = isRasterImage(f) ? await saveImageFile(projectId, f, 'doc', { name: f.name }) : await DB.put('files', { projectId, blob: f, mime: mimeFromName(f.name, f.type), name: f.name, role: 'doc' }); out.push({ id: DB.uid(), name: f.name.replace(/\.[^.]+$/, ''), fileId: rec.id }); } }
    finally { ld.close(); }
    return out;
  }
  if (how === 'plan') {
    const plans = (await DB.byProject('plans', projectId)).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
    const id = await menu('Choisir le plan', plans.map(p => ({ label: p.name, icon: 'plans', value: p.id }))); if (!id) return [];
    const p = plans.find(x => x.id === id); return [{ id: DB.uid(), name: p.name, planId: p.id }];
  }
  if (how === 'url') {
    const r = await formSheet('Lien Google Drive', [{ name: 'url', label: 'Lien du fichier', type: 'url', placeholder: 'https://drive.google.com/…' }, { name: 'name', label: 'Nom', placeholder: 'Ex : Plan coffrage indice C' }], { okLabel: 'Ajouter' });
    if (!r || !r.url) return []; return [{ id: DB.uid(), name: r.name || 'Plan', url: r.url }];
  }
  return [];
}
async function pbOpenDoc(d, l, ctx) {
  if (d.fileId) { const f = await DB.get('files', d.fileId); if (f && f.blob) return openFileRecord(f, d.name); }
  if (d.planId) { const pl = await DB.get('plans', d.planId); if (pl) return openPlanViewer(pl, { ...ctx, onClose: () => {} }); return toast('Ce plan a été supprimé'); }
  if (d.url) {
    if (driveFileId(d.url) && isNative()) {
      const ld = loading('Ouverture…');
      try { const file = await downloadFromDrive(d.url); const rec = await DB.put('files', { projectId: l.projectId, blob: file, mime: mimeFromName(file.name, file.type), name: file.name, role: 'doc' }); d.fileId = rec.id; await DB.put('links', l); ld.close(); return openFileRecord(rec, d.name); }
      catch (e) { ld.close(); toast(e.message); }
    }
    return openUrl(d.url);
  }
  toast('Fichier introuvable');
}
function openPlansBox(l, ctx = {}) {
  return new Promise((resolve) => {
    l.zones = l.zones || [];
    const openZ = new Set(l.zones.length === 1 ? [l.zones[0].id] : []), openP = new Set();
    let q = '';
    const s = sheet('<div class="pb2"></div>', {});
    s.onClose = () => resolve();
    const save = () => DB.put('links', l);
    const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
    const nDocs = (z) => (z.parts || []).reduce((a, p) => a + (p.docs || []).length, 0);
    const match = (t) => !q || fuzzyHas(t, q);
    const draw = () => {
      const P = pinLook(l), box = $('.pb2', s.el);
      const zones = l.zones.map((z, zi) => {
        const zHit = match(z.name), parts = (z.parts || []).map((p, pi) => ({ p, pi, hit: zHit || match(p.name) || (p.docs || []).some(d => match(d.name)) })).filter(x => !q || x.hit);
        if (q && !zHit && !parts.length) return '';
        const zo = openZ.has(z.id) || !!q;
        return `<div class="pb-z ${zo ? 'open' : ''}"><div class="pb-zh" data-z="${zi}"><span class="pb-zi">${zi + 1}</span><div class="grow"><b>${esc(z.name)}</b><small>${(z.parts || []).length} partie(s) · ${nDocs(z)} plan(s)</small></div>
            <button class="iconbtn sm" data-zm="${zi}">${icon('more')}</button><span class="chev">${icon('chevdown')}</span></div>
          ${zo ? `<div class="pb-parts">${parts.map(({ p, pi }) => { const po = openP.has(p.id) || (!!q && (p.docs || []).some(d => match(d.name)));
            return `<div class="pb-p ${po ? 'open' : ''}"><div class="pb-ph" data-p="${zi}|${pi}"><span class="pb-dot"></span><div class="grow"><b>${esc(p.name)}</b><small>${(p.docs || []).length} plan(s)</small></div>
                <button class="iconbtn sm" data-pm="${zi}|${pi}">${icon('more')}</button><span class="chev">${icon('chevdown')}</span></div>
              ${po ? `<div class="pb-docs">${(p.docs || []).filter(d => !q || match(d.name) || match(p.name) || zHit).map((d, di) => `<div class="pb-d"><button class="grow" data-d="${zi}|${pi}|${p.docs.indexOf(d)}"><span class="pb-di">${icon(d.url && !d.fileId ? 'drive' : d.planId ? 'plans' : 'pdf')}</span><span>${esc(d.name)}</span></button><button class="iconbtn sm" data-dm="${zi}|${pi}|${p.docs.indexOf(d)}">${icon('more')}</button></div>`).join('')}
                <button class="pb-add" data-adddoc="${zi}|${pi}">${icon('plus')} Ajouter un plan (PDF)</button></div>` : ''}</div>`; }).join('')}
            ${(z.parts || []).length < PB_MAX ? `<button class="pb-add" data-addp="${zi}">${icon('plus')} Partie d'ouvrage</button>` : '<div class="pb-max">10 parties maximum</div>'}</div>` : ''}</div>`;
      }).join('');
      box.innerHTML = `<div class="pb-head" style="--c:${P.c}"><span class="pb-hic">${P.e}</span><div class="grow"><b>${esc(l.name)}</b><small>${l.zones.length} zone(s) · ${plansboxCount(l)} plan(s)</small></div><button class="iconbtn" data-a="more">${icon('more')}</button></div>
        ${plansboxCount(l) > 3 ? `<div class="search pb-search">${icon('search')}<input placeholder="Rechercher (ex : CR 78, coffrage…)" value="${esc(q)}"></div>` : ''}
        <div class="pb-zones">${zones || (q ? '<div class="pb-empty">Aucun résultat</div>' : '<div class="pb-empty">Ajoutez une zone, puis ses parties d\'ouvrage et leurs plans PDF.</div>')}</div>
        ${l.zones.length < PB_MAX ? `<button class="btn ghost small pb-addz" data-a="addz">${icon('plus')} Zone</button>` : '<div class="pb-max">10 zones maximum</div>'}`;
      const si = $('.pb-search input', box); if (si) si.oninput = (e) => { q = e.target.value.trim(); clearTimeout(s._t); s._t = setTimeout(() => { draw(); const n = $('.pb-search input', box); if (n) { n.focus(); n.setSelectionRange(q.length, q.length); } }, 250); };
      $$('[data-z]', box).forEach(h => h.onclick = (e) => { if (e.target.closest('[data-zm]')) return; const z = l.zones[+h.dataset.z]; openZ.has(z.id) ? openZ.delete(z.id) : openZ.add(z.id); draw(); });
      $$('[data-p]', box).forEach(h => h.onclick = (e) => { if (e.target.closest('[data-pm]')) return; const [zi, pi] = h.dataset.p.split('|').map(Number), p = l.zones[zi].parts[pi];
        if ((p.docs || []).length === 1 && !openP.has(p.id)) return pbOpenDoc(p.docs[0], l, ctx);
        openP.has(p.id) ? openP.delete(p.id) : openP.add(p.id); draw(); });
      $$('[data-d]', box).forEach(b => b.onclick = () => { const [zi, pi, di] = b.dataset.d.split('|').map(Number); pbOpenDoc(l.zones[zi].parts[pi].docs[di], l, ctx); });
      $$('[data-adddoc]', box).forEach(b => b.onclick = async () => { const [zi, pi] = b.dataset.adddoc.split('|').map(Number), p = l.zones[zi].parts[pi]; const docs = await pbPickDocs(l.projectId); if (!docs.length) return;
        if (docs.length === 1) { const r = await formSheet('Nom du plan', [{ name: 'n', label: 'Nom', value: docs[0].name }], { okLabel: 'OK' }); if (r && r.n) docs[0].name = r.n; }
        p.docs = [...(p.docs || []), ...docs]; openP.add(p.id); await save(); draw(); });
      $$('[data-addp]', box).forEach(b => b.onclick = async () => { const z = l.zones[+b.dataset.addp]; const r = await formSheet('Partie d\'ouvrage', [{ name: 'n', label: 'Nom', placeholder: 'Ex : Voile CR 78, Plancher cage d\'asc., Poutre D13-D14' }], { okLabel: 'Ajouter' });
        if (!r || !r.n) return; const p = { id: DB.uid(), name: r.n, docs: [] }; z.parts = [...(z.parts || []), p]; openP.add(p.id); await save(); draw(); });
      const az = $('[data-a=addz]', box); if (az) az.onclick = async () => { const r = await formSheet('Zone', [{ name: 'n', label: 'Nom de la zone', placeholder: 'Ex : Zone 1, Zone 12, Bloc B…' }], { okLabel: 'Ajouter' });
        if (!r || !r.n) return; const z = { id: DB.uid(), name: r.n, parts: [] }; l.zones.push(z); openZ.add(z.id); await save(); draw(); };
      const rename = async (o, lbl) => { const r = await formSheet('Renommer', [{ name: 'n', label: lbl, value: o.name }]); if (r && r.n) { o.name = r.n; await save(); draw(); } };
      $$('[data-zm]', box).forEach(b => b.onclick = async (e) => { e.stopPropagation(); const zi = +b.dataset.zm, z = l.zones[zi];
        const v = await menu(z.name, [{ label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Monter', icon: 'chevup', value: 'up' }, { label: 'Descendre', icon: 'chevdown', value: 'down' }, { label: 'Supprimer la zone', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'ren') rename(z, 'Nom de la zone'); if (v === 'up' || v === 'down') { move(l.zones, zi, v === 'up' ? -1 : 1); await save(); draw(); }
        if (v === 'del' && await confirmBox(`Supprimer « ${z.name} » et ses ${nDocs(z)} plan(s) ?`)) { for (const p of z.parts || []) for (const d of p.docs || []) if (d.fileId) await DB.del('files', d.fileId); l.zones.splice(zi, 1); await save(); draw(); } });
      $$('[data-pm]', box).forEach(b => b.onclick = async (e) => { e.stopPropagation(); const [zi, pi] = b.dataset.pm.split('|').map(Number), z = l.zones[zi], p = z.parts[pi];
        const v = await menu(p.name, [{ label: 'Ajouter un plan', icon: 'plus', value: 'add' }, { label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Monter', icon: 'chevup', value: 'up' }, { label: 'Descendre', icon: 'chevdown', value: 'down' },
          ...(l.zones.length > 1 ? [{ label: 'Déplacer vers une autre zone', icon: 'layers', value: 'mv' }] : []), { label: 'Supprimer', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'add') { const docs = await pbPickDocs(l.projectId); if (docs.length) { p.docs = [...(p.docs || []), ...docs]; openP.add(p.id); await save(); draw(); } }
        if (v === 'ren') rename(p, 'Nom de la partie d\'ouvrage'); if (v === 'up' || v === 'down') { move(z.parts, pi, v === 'up' ? -1 : 1); await save(); draw(); }
        if (v === 'mv') { const to = await menu('Vers quelle zone ?', l.zones.filter(x => x !== z).map(x => ({ label: x.name, icon: 'layers', value: x.id }))); const tz = l.zones.find(x => x.id === to); if (tz) { if ((tz.parts || []).length >= PB_MAX) return toast('10 parties maximum'); z.parts.splice(pi, 1); tz.parts = [...(tz.parts || []), p]; openZ.add(tz.id); await save(); draw(); } }
        if (v === 'del' && await confirmBox(`Supprimer « ${p.name} » ?`)) { for (const d of p.docs || []) if (d.fileId) await DB.del('files', d.fileId); z.parts.splice(pi, 1); await save(); draw(); } });
      $$('[data-dm]', box).forEach(b => b.onclick = async () => { const [zi, pi, di] = b.dataset.dm.split('|').map(Number), p = l.zones[zi].parts[pi], d = p.docs[di];
        const v = await menu(d.name, [{ label: 'Ouvrir', icon: 'pdf', value: 'open' }, { label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Remplacer le fichier (nouvel indice)', icon: 'undo', value: 'rep' }, { label: 'Monter', icon: 'chevup', value: 'up' }, { label: 'Retirer', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'open') pbOpenDoc(d, l, ctx); if (v === 'ren') rename(d, 'Nom du plan'); if (v === 'up') { move(p.docs, di, -1); await save(); draw(); }
        if (v === 'rep') { const [nd] = await pbPickDocs(l.projectId); if (nd) { if (d.fileId && d.fileId !== nd.fileId) await DB.del('files', d.fileId); Object.assign(d, { fileId: nd.fileId || null, planId: nd.planId || null, url: nd.url || null }); await save(); toast('Remplacé ✓'); draw(); } }
        if (v === 'del' && await confirmBox('Retirer ce plan ?')) { if (d.fileId) await DB.del('files', d.fileId); p.docs.splice(di, 1); await save(); draw(); } });
      $('[data-a=more]', box).onclick = async () => { const v = await menu(l.name, [{ label: 'Renommer le pin', icon: 'edit', value: 'ren' }, { label: 'Icône et couleur du pin', icon: 'pin', value: 'look' }, { label: 'Supprimer le pin', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'ren') rename(l, 'Nom du pin'); if (v === 'look') { await choosePinLook(l); draw(); }
        if (v === 'del' && await confirmBox(`Supprimer le pin « ${l.name} » et ses ${plansboxCount(l)} plan(s) ?`)) { for (const z of l.zones) for (const p of z.parts || []) for (const d of p.docs || []) if (d.fileId) await DB.del('files', d.fileId); await DB.del('links', l.id); s.close(); } };
    };
    draw();
  });
}
