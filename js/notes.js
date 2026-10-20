// ================= Notes riches (pins « Plans » et pins « Photos / note ») : texte, photos, checklist, étiquette, épingle, note vocale =================
const NOTE_TAGS = [['', 'Aucune', '#64748b'], ['imp', 'Important', '#ef4444'], ['todo', 'À faire', '#f59e0b'], ['info', 'Info', '#3b82f6'], ['ok', 'OK', '#22c55e']];
const noteTag = (k) => NOTE_TAGS.find(t => t[0] === (k || '')) || NOTE_TAGS[0];
const myName = () => { try { return localStorage.getItem('userName') || ''; } catch (e) { return ''; } };

// éditeur d'une note ; opts.parts = [{id,name}] pour lier la note à une partie d'ouvrage
function editNote(n, projectId, opts = {}) {
  return new Promise((resolve) => {
    const x = JSON.parse(JSON.stringify(n || { id: DB.uid(), text: '', at: Date.now(), by: myName(), tag: '', pinned: false, check: [], photos: [], audio: null, partId: null }));
    let rec = null, chunks = [];
    const s = sheet('<div class="form nt-ed"></div>', { title: n ? 'Modifier la note' : 'Nouvelle note' });
    s.onClose = () => { if (rec && rec.state !== 'inactive') rec.stop(); resolve(null); };
    const draw = async () => {
      const ph = []; for (const id of x.photos) { const f = await DB.get('files', id); if (f && f.blob) ph.push({ id, src: BlobURL.get(id, f.blob) }); }
      $('.nt-ed', s.el).innerHTML = `<label>Note<textarea name="text" style="min-height:96px" placeholder="Écrivez vos remarques…">${esc(x.text)}</textarea></label>
        <div class="fld">Étiquette</div><div class="nt-tags">${NOTE_TAGS.map(([k, l, c]) => `<button type="button" data-tag="${k}" class="${(x.tag || '') === k ? 'on' : ''}" style="--c:${c}">${l}</button>`).join('')}</div>
        <label>Checklist (un point par ligne)<textarea name="check" style="min-height:60px" placeholder="Vérifier l'enrobage&#10;Cales en place">${esc(x.check.map(c => c.t).join('\n'))}</textarea></label>
        ${opts.parts && opts.parts.length ? `<label>Partie d'ouvrage<select name="partId"><option value="">— aucune —</option>${opts.parts.map(p => `<option value="${p.id}" ${x.partId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>` : ''}
        <div class="fld">Photos</div><div class="thumbs">${ph.map(p => `<div class="t"><img src="${p.src}" data-v="${p.id}"><button class="x" data-dp="${p.id}">×</button></div>`).join('')}<button type="button" class="t add" data-a="ph">${icon('camera')}</button></div>
        <div class="fld">Note vocale</div><div class="nt-voice">${x.audio ? `<audio controls data-au></audio><button type="button" class="iconbtn sm" data-a="audel">${icon('trash')}</button>` : ''}<button type="button" class="btn ghost small" data-a="rec">${rec && rec.state === 'recording' ? '⏹ Arrêter' : '🎤 Enregistrer'}</button></div>
        <label class="nt-pin"><input type="checkbox" data-pin ${x.pinned ? 'checked' : ''}> 📌 Épingler en haut</label>
        <div class="btnrow" style="padding:0"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="ok">Enregistrer</button></div>`;
      const E = $('.nt-ed', s.el), keep = () => { x.text = $('[name=text]', E).value; x.check = $('[name=check]', E).value.split('\n').map(t => t.trim()).filter(Boolean).map(t => ({ t, done: (x.check.find(c => c.t === t) || {}).done || false })); const ps = $('[name=partId]', E); if (ps) x.partId = ps.value || null; x.pinned = $('[data-pin]', E).checked; };
      if (x.audio) { const f = await DB.get('files', x.audio); const a = $('[data-au]', E); if (f && f.blob && a) a.src = BlobURL.get(f.id, f.blob); }
      $$('[data-tag]', E).forEach(b => b.onclick = () => { keep(); x.tag = b.dataset.tag; draw(); });
      $('[data-a=ph]', E).onclick = async () => { keep(); const recs = await addPhotos(projectId, { source: 'Note' }); if (recs.length) { x.photos.push(...recs.map(r => r.id)); draw(); } };
      $$('[data-dp]', E).forEach(b => b.onclick = (e) => { e.preventDefault(); keep(); x.photos = x.photos.filter(id => id !== b.dataset.dp); draw(); });
      $$('[data-v]', E).forEach(img => img.onclick = () => showGallery(ph.map(p => ({ src: p.src })), ph.findIndex(p => p.id === img.dataset.v)));
      const ad = $('[data-a=audel]', E); if (ad) ad.onclick = () => { keep(); x.audio = null; draw(); };
      $('[data-a=rec]', E).onclick = async () => {
        keep();
        if (rec && rec.state === 'recording') { rec.stop(); return; }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); chunks = [];
          rec = new MediaRecorder(stream); rec.ondataavailable = (e) => chunks.push(e.data);
          rec.onstop = async () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); const f = await DB.put('files', { projectId, blob, mime: blob.type, name: `note vocale ${fmtDateTime(Date.now())}.webm`, role: 'doc' }); x.audio = f.id; draw(); };
          rec.start(); draw(); toast('🎤 Enregistrement… touchez « Arrêter »');
        } catch (e) { alertBox('Micro indisponible : autorisez le micro pour l\'application (Paramètres du téléphone › Applications › Chantier › Autorisations).'); }
      };
      $('[data-a=c]', E).onclick = () => s.close();
      $('[data-a=ok]', E).onclick = () => { keep(); if (!x.text.trim() && !x.photos.length && !x.check.length && !x.audio) return toast('Note vide'); x.editedAt = Date.now(); s.onClose = null; s.close(); resolve(x); };
    };
    draw();
  });
}
// carte d'une note (HTML) + liaisons
async function notesHTML(notes, opts = {}) {
  const list = notes.slice().sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at));
  const out = [];
  for (const n of list) {
    const ph = []; for (const id of n.photos || []) { const f = await DB.get('files', id); if (f && f.blob) ph.push({ id, src: BlobURL.get(id, f.blob) }); }
    const T = noteTag(n.tag), part = opts.parts && n.partId ? (opts.parts.find(p => p.id === n.partId) || {}).name : '';
    out.push(`<div class="nt-card" style="--c:${T[2]}" data-n="${n.id}"><div class="nt-h">${n.pinned ? '📌 ' : ''}${n.tag ? `<em>${T[1]}</em>` : ''}${part ? `<span class="nt-part">${esc(part)}</span>` : ''}<span class="grow"></span><small>${fmtDateTime(n.at)}${n.by ? ' · ' + esc(n.by) : ''}</small><button class="iconbtn sm" data-nm="${n.id}">${icon('more')}</button></div>
      ${n.text ? `<div class="nt-t">${esc(n.text).replace(/\n/g, '<br>')}</div>` : ''}
      ${(n.check || []).length ? `<div class="nt-ck">${n.check.map((c, i) => `<button data-ck="${n.id}|${i}" class="${c.done ? 'on' : ''}"><span>${c.done ? '☑' : '☐'}</span>${esc(c.t)}</button>`).join('')}</div>` : ''}
      ${ph.length ? `<div class="nt-ph">${ph.map(p => `<img src="${p.src}" data-nv="${n.id}|${p.id}">`).join('')}</div>` : ''}
      ${n.audio ? `<audio controls data-na="${n.audio}"></audio>` : ''}</div>`);
  }
  return out.join('');
}
// liaisons des cartes : coche checklist, galerie, menu (modifier / partager / supprimer)
async function bindNotes(box, notes, projectId, save, redraw, opts = {}) {
  for (const a of $$('[data-na]', box)) { const f = await DB.get('files', a.dataset.na); if (f && f.blob) a.src = BlobURL.get(f.id, f.blob); }
  $$('[data-ck]', box).forEach(b => b.onclick = async () => { const [nid, i] = b.dataset.ck.split('|'); const n = notes.find(x => x.id === nid); n.check[+i].done = !n.check[+i].done; await save(); redraw(); });
  $$('[data-nv]', box).forEach(img => img.onclick = async () => { const [nid, pid] = img.dataset.nv.split('|'); const n = notes.find(x => x.id === nid); const srcs = []; for (const id of n.photos) { const f = await DB.get('files', id); if (f && f.blob) srcs.push({ id, src: BlobURL.get(id, f.blob) }); } showGallery(srcs.map(s => ({ src: s.src })), srcs.findIndex(s => s.id === pid)); });
  $$('[data-nm]', box).forEach(b => b.onclick = async () => {
    const n = notes.find(x => x.id === b.dataset.nm);
    const v = await menu('Note', [{ label: 'Modifier', icon: 'edit', value: 'ed' }, { label: n.pinned ? 'Désépingler' : 'Épingler en haut', icon: 'pin', value: 'pin' }, { label: 'Partager (WhatsApp…)', icon: 'share', value: 'sh' }, { label: 'Supprimer', icon: 'trash', danger: true, value: 'del' }]);
    if (v === 'ed') { const r = await editNote(n, projectId, opts); if (r) { Object.assign(n, r); await save(); redraw(); } }
    if (v === 'pin') { n.pinned = !n.pinned; await save(); redraw(); }
    if (v === 'sh') { const txt = `${opts.title ? '*' + opts.title + '*\n' : ''}${n.text || ''}${(n.check || []).length ? '\n' + n.check.map(c => (c.done ? '☑ ' : '☐ ') + c.t).join('\n') : ''}\n— ${fmtDateTime(n.at)}`;
      if ((n.photos || []).length) sharePhotos(n.photos, txt, 'note'); else openUrl('https://wa.me/?text=' + encodeURIComponent(txt)); }
    if (v === 'del' && await confirmBox('Supprimer cette note ?')) { for (const id of n.photos || []) await DB.del('files', id); if (n.audio) await DB.del('files', n.audio); notes.splice(notes.indexOf(n), 1); await save(); redraw(); }
  });
}

// ---------- pin « Photos / note » sur le plan ----------
function openPhotoNote(l, ctx = {}) {
  return new Promise((resolve) => {
    l.photos = l.photos || []; l.notes = l.notes || [];
    const s = sheet('<div class="pb2 pn"></div>', {});
    s.onClose = () => resolve();
    const save = () => DB.put('links', l);
    const draw = async () => {
      const P = pinLook(l), box = $('.pn', s.el), ph = [];
      for (const id of l.photos) { const f = await DB.get('files', id); if (f && f.blob) ph.push({ id, src: BlobURL.get(id, f.blob) }); }
      const tks = (await DB.byProject('tasks', l.projectId)).filter(t => t.pinId === l.id).sort((a, b) => (a.num || 0) - (b.num || 0));
      const fms = typeof formStats === 'function' ? (await DB.byProject('forms', l.projectId)).filter(f => f.pinId === l.id) : [];
      box.innerHTML = `<div class="pb-head" style="--c:${P.c}"><span class="pb-hic">${P.e || '📷'}</span><div class="grow"><b>${esc(l.name)}</b><small>${ph.length} photo(s) · ${l.notes.length} note(s)${l.createdAt ? ' · ' + fmtDate(new Date(l.createdAt).toISOString().slice(0, 10)) : ''}</small></div><button class="iconbtn" data-a="more">${icon('more')}</button></div>
        <div class="pn-st"><button data-st="" class="${!l.state ? 'on' : ''}" style="--c:#f59e0b">⏳ À traiter</button><button data-st="done" class="${l.state === 'done' ? 'on' : ''}" style="--c:#22c55e">✅ Traité${l.doneAt ? ' le ' + fmtDate(l.doneAt) : ''}</button></div>
        ${ph.length ? `<div class="pn-ph">${ph.map(p => `<div class="t"><img src="${p.src}" data-v="${p.id}"><button class="x" data-dp="${p.id}">×</button></div>`).join('')}</div>` : '<div class="pb-empty">Ajoutez des photos et des notes à cet endroit du plan.</div>'}
        <div class="btnrow" style="padding:0"><button class="btn small" data-a="ph">${icon('camera')} Photos</button><button class="btn small ghost" data-a="nt">${icon('edit')} Note</button>${ph.length || l.notes.length ? `<button class="btn small ghost" data-a="sh" style="flex:none">${icon('share')}</button>` : ''}</div>
        ${l.notes.length ? `<div class="nt-list">${await notesHTML(l.notes)}</div>` : ''}
        <div class="nt-sec"><span>✅ Tâches${tks.length ? ` (${tks.filter(t => !['done', 'verified'].includes(t.status)).length} ouvertes / ${tks.length})` : ''}</span><button class="btn small ghost" data-a="tk">${icon('plus')} Tâche</button></div>
        ${tks.map(t => `<button class="pn-row" data-tk="${t.id}"><span class="dot" style="background:${(STATUS[t.status] || {}).color || '#888'}"></span><b>#${t.num || ''}</b><span class="grow">${esc(t.title || 'Sans titre')}</span><small>${esc((STATUS[t.status] || {}).label || '')}${t.assignee ? ' · ' + esc(t.assignee) : ''}${t.due ? ' · ' + fmtDate(t.due) : ''}</small></button>`).join('')}
        <div class="nt-sec"><span>📋 Formulaires${fms.length ? ` (${fms.length})` : ''}</span><button class="btn small ghost" data-a="fm">${icon('plus')} Formulaire</button></div>
        ${fms.map(f => { const st = formStats(f); return `<button class="pn-row" data-fm="${f.id}"><span class="dot" style="background:${st.color}"></span><span class="grow">${esc(f.title)}</span><small>${st.answered}/${st.n} · ${fmtDate(f.date)}</small></button>`; }).join('')}`;
      $('[data-a=tk]', box).onclick = async () => { const t = await newTask({ pinId: l.id, planRef: l.planId, title: l.name }); await openTaskDetail(t); draw(); };
      $$('[data-tk]', box).forEach(b => b.onclick = async () => { const t = await DB.get('tasks', b.dataset.tk); if (t) await openTaskDetail(t); draw(); });
      $('[data-a=fm]', box).onclick = async () => { const tid = await menu('Nouveau formulaire', FORM_TEMPLATES.map(t => ({ label: t.title, icon: 'form', value: t.id }))); if (!tid) return; const T = FORM_TEMPLATES.find(x => x.id === tid);
        const f = await DB.put('forms', { projectId: l.projectId, pinId: l.id, templateId: T.id, title: T.title, location: l.name, date: todayISO(), inspector: '', notes: '', items: T.items.map(label => ({ label, res: null, comment: '' })), photoIds: [] }); await openFormDetail(f); draw(); };
      $$('[data-fm]', box).forEach(b => b.onclick = async () => { const f = await DB.get('forms', b.dataset.fm); if (f) await openFormDetail(f); draw(); });
      $$('[data-st]', box).forEach(b => b.onclick = async () => { l.state = b.dataset.st || null; l.doneAt = l.state ? todayISO() : null; await save(); draw(); });
      $('[data-a=ph]', box).onclick = async () => { const recs = await addPhotos(l.projectId, { source: l.name }); if (recs.length) { l.photos.push(...recs.map(r => r.id)); await save(); draw(); } };
      $('[data-a=nt]', box).onclick = async () => { const n = await editNote(null, l.projectId); if (n) { l.notes.push(n); await save(); draw(); } };
      $$('[data-v]', box).forEach(img => img.onclick = () => showGallery(ph.map(p => ({ src: p.src })), ph.findIndex(p => p.id === img.dataset.v)));
      $$('[data-dp]', box).forEach(b => b.onclick = async () => { if (!await confirmBox('Supprimer cette photo ?')) return; l.photos = l.photos.filter(id => id !== b.dataset.dp); await DB.del('files', b.dataset.dp); await save(); draw(); });
      const sh = $('[data-a=sh]', box); if (sh) sh.onclick = () => { const txt = `*${l.name}*\n` + l.notes.map(n => `• ${n.text || ''}`).join('\n'); const ids = [...l.photos, ...l.notes.flatMap(n => n.photos || [])]; if (ids.length) sharePhotos(ids, txt, l.name); else openUrl('https://wa.me/?text=' + encodeURIComponent(txt)); };
      await bindNotes(box, l.notes, l.projectId, save, draw, { title: l.name });
      $('[data-a=more]', box).onclick = async () => { const v = await menu(l.name, [{ label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Icône et couleur du pin', icon: 'pin', value: 'look' }, { label: 'Supprimer le pin', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'ren') { const r = await formSheet('Renommer', [{ name: 'n', label: 'Titre', value: l.name }]); if (r && r.n) { l.name = r.n; await save(); draw(); } }
        if (v === 'look') { await choosePinLook(l); draw(); }
        if (v === 'del' && await confirmBox(`Supprimer « ${l.name} », ses photos et ses notes ?`)) { for (const id of [...l.photos, ...l.notes.flatMap(n => [...(n.photos || []), n.audio].filter(Boolean))]) await DB.del('files', id); await DB.del('links', l.id); s.close(); } };
    };
    draw();
  });
}
