// ================= v1.0.44 — Photos sans attente : enregistrement immédiat, préparation et envoi en arrière-plan, pastille d'envoi, suppression =================
// 1) Les photos choisies sont enregistrées tout de suite (fichier d'origine) : l'ouvrage les montre aussitôt, l'écran n'est jamais bloqué.
// 2) En arrière-plan : réduction (si « optimisée »), puis envoi vers Drive (WorkManager sur Android, sinon la synchro).
// 3) Une petite pastille en bas indique ce qui reste à préparer / envoyer ; toucher = détail.
// 4) Suppression : bouton 🗑 dans la visionneuse, et sélection multiple par appui long sur les miniatures.
const PhotoQ = (() => {
  const Q = []; let busy = false, total = 0, done = 0;
  const quality = () => { try { return localStorage.getItem('pb.q') || 'opt'; } catch (e) { return 'opt'; } };
  // enregistre des fichiers choisis, sans attendre la réduction ; renvoie les enregistrements (ids utilisables tout de suite)
  async function save(projectId, files, extra = {}) {
    const out = [], hq = extra.hq; delete extra.hq;
    for (const f of files) {
      const rec = await DB.putRaw('files', { id: DB.uid(), createdAt: Date.now(), updatedAt: Date.now(), projectId, blob: f, mime: f.type || 'image/jpeg', name: f.name || 'photo.jpg', role: 'photo', prep: 1, ...extra });
      out.push(rec); Q.push({ id: rec.id, hq });
    }
    total += out.length; pill(); kick();
    return out;
  }
  async function kick() {
    if (busy) return; busy = true;
    try {
      while (Q.length) {
        const { id, hq } = Q.shift();
        try {
          const f = await DB.get('files', id); if (!f || !f.blob) { done++; continue; }
          if (quality() !== 'orig' && !f._w && typeof compressImage === 'function' && /^image\//.test(f.mime || f.blob.type || '')) {
            const c = await compressImage(f.blob, hq ? 2400 : 2000, 0.86); if (c && c.blob && c.blob.size < f.blob.size) { f.blob = c.blob; f.mime = 'image/jpeg'; f.w = c.w; f.h = c.h; }
          }
          delete f.prep; BlobURL.drop(f.id);
          await DB.put('files', f);   // la synchro le voit maintenant
          if (typeof BgUp !== 'undefined' && BgUp.on() && f.role === 'photo') await BgUp.hand([f]).catch(() => 0);
        } catch (e) { console.warn('photoq', e); }
        done++; pill();
        await new Promise(r => setTimeout(r, 30));   // laisse respirer l'interface
      }
    } finally { busy = false; if (done >= total) { total = done = 0; } pill(); }
  }
  // au démarrage : photos restées « à préparer » (application fermée pendant la préparation)
  async function resume() { try { const L = (await DB.all('files')).filter(f => f.prep); for (const f of L) if (!Q.some(q => q.id === f.id)) Q.push({ id: f.id }); total += L.length; if (L.length) kick(); } catch (e) {} }

  // ---------- pastille ----------
  let bgPend = 0, upMsg = '';
  function pill() {
    let el = document.getElementById('phPill');
    const prep = Math.max(0, total - done), n = prep + bgPend;
    if (!n && !upMsg) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('button'); el.id = 'phPill'; el.className = 'ph-pill'; el.onclick = detail; document.body.appendChild(el); }
    el.innerHTML = `<span class="ph-spin"></span>${icon('upload')}<b>${n || ''}</b>${upMsg && !n ? `<small>${esc(upMsg)}</small>` : ''}`;
    el.title = `${prep} photo(s) en préparation · ${bgPend} en attente d'envoi`;
  }
  async function poll() {
    try { if (typeof BgUp !== 'undefined' && BgUp.available()) { const st = await BgUp.settle(); bgPend = st.pending || 0; } } catch (e) {}
    try { const s = Sync.state ? Sync.state() : null; upMsg = s && s.state === 'sync' && /Envoi/.test(s.msg || '') ? s.msg.replace('Envoi vers Drive ', '') : ''; } catch (e) { upMsg = ''; }
    pill();
  }
  async function detail() {
    const prep = Math.max(0, total - done);
    const v = await menu('Envoi des photos', [
      { label: prep ? `⏳ ${prep} photo(s) en préparation` : '✓ Préparation terminée', value: 'x' },
      { label: bgPend ? `📤 ${bgPend} photo(s) en attente d'envoi vers Drive` : upMsg ? `📤 Envoi vers Drive ${upMsg}` : '✓ Tout est envoyé', value: 'x' },
      { label: 'Continuez à travailler : l\'envoi se fait tout seul, même application fermée', value: 'x' },
      ...(typeof BgUp !== 'undefined' && BgUp.available() ? [{ label: 'Réglages d\'envoi (Wi-Fi, batterie…)', icon: 'settings', value: 'set' }] : []),
    ]);
    if (v === 'set') BgUp.openSettings();
  }
  function start() { resume(); poll(); setInterval(() => { if (document.visibilityState === 'visible') poll(); }, 6000); }

  // ---------- suppression ----------
  // retire les références aux fichiers supprimés dans toutes les fiches (réceptions, réserves, PV, rapports…)
  async function purgeRefs(ids) {
    const S = new Set(ids);
    const walk = (o) => { let ch = false; if (Array.isArray(o)) { for (let k = o.length - 1; k >= 0; k--) { if (typeof o[k] === 'string' && S.has(o[k])) { o.splice(k, 1); ch = true; } else if (o[k] && typeof o[k] === 'object' && walk(o[k])) ch = true; } }
      else if (o && typeof o === 'object' && !(o instanceof Blob)) { for (const k in o) { const v = o[k]; if (v && typeof v === 'object' && walk(v)) ch = true; else if (typeof v === 'string' && S.has(v) && /Id$/.test(k)) { o[k] = null; ch = true; } } } return ch; };
    for (const st of ['receptions', 'forms', 'tasks', 'reports', 'items', 'links', 'projects']) {
      let L = []; try { L = await DB.all(st); } catch (e) { continue; }
      for (const r of L) if (walk(r)) await DB.put(st, r);
    }
  }
  async function remove(ids, { ask = true } = {}) {
    ids = [...new Set(ids)].filter(Boolean); if (!ids.length) return false;
    if (ask && !await confirmBox(ids.length > 1 ? `Supprimer ${ids.length} photos ? Elles vont aussi dans la corbeille de Google Drive.` : 'Supprimer cette photo ? Elle va aussi dans la corbeille de Google Drive.', 'Supprimer')) return false;
    for (const id of ids) { try { await DB.del('files', id); BlobURL.drop(id); } catch (e) {} }
    await purgeRefs(ids);
    toast(ids.length > 1 ? `${ids.length} photos supprimées` : 'Photo supprimée');
    return true;
  }
  // sélection multiple : appui long sur une miniature
  let selBox = null;
  function selBar() {
    let bar = document.getElementById('selBar');
    const n = selBox ? selBox.querySelectorAll('.ph-sel').length : 0;
    if (!selBox) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'selBar'; bar.className = 'sel-bar'; document.body.appendChild(bar); }
    bar.innerHTML = `<button data-a="x">${icon('close')}</button><b>${n} sélectionnée(s)</b><button data-a="all">Tout</button><button data-a="del" class="d" ${n ? '' : 'disabled'}>${icon('trash')} Supprimer</button>`;
    bar.querySelector('[data-a=x]').onclick = endSel;
    bar.querySelector('[data-a=all]').onclick = () => { items(selBox).forEach(t => t.classList.add('ph-sel')); selBar(); };
    bar.querySelector('[data-a=del]').onclick = async () => { const els = [...selBox.querySelectorAll('.ph-sel')], ids = els.map(t => t.dataset.id);
      if (await remove(ids)) { els.forEach(t => t.remove()); endSel(); } };
  }
  const items = (box) => [...box.querySelectorAll(':scope > .t[data-id], :scope > .ph[data-id]')];
  function endSel() { if (selBox) { selBox.classList.remove('sel-mode'); selBox.querySelectorAll('.ph-sel').forEach(t => t.classList.remove('ph-sel')); } selBox = null; selBar(); }
  function bindLongPress() {
    let tm = null, sx = 0, sy = 0, fired = false;
    document.addEventListener('pointerdown', (e) => {
      const t = e.target.closest('.thumbs > .t[data-id], .photo-grid > .ph[data-id]'); if (!t || e.target.closest('[data-del]')) return;
      fired = false; sx = e.clientX; sy = e.clientY; clearTimeout(tm);
      tm = setTimeout(() => { fired = true; if (selBox && selBox !== t.parentElement) endSel(); selBox = t.parentElement; selBox.classList.add('sel-mode'); t.classList.add('ph-sel'); try { navigator.vibrate && navigator.vibrate(20); } catch (e2) {} selBar(); }, 520);
    }, true);
    const cancel = (e) => { if (e.type === 'pointermove' && Math.hypot(e.clientX - sx, e.clientY - sy) < 10) return; clearTimeout(tm); };
    document.addEventListener('pointermove', cancel, true); document.addEventListener('pointerup', cancel, true); document.addEventListener('pointercancel', cancel, true);
    document.addEventListener('click', (e) => {
      const t = e.target.closest('.thumbs > .t[data-id], .photo-grid > .ph[data-id]');
      if (fired) { fired = false; if (t) { e.stopPropagation(); e.preventDefault(); } return; }
      if (selBox && t && t.parentElement === selBox) { e.stopPropagation(); e.preventDefault(); t.classList.toggle('ph-sel'); selBar(); return; }
      if (selBox && !e.target.closest('#selBar') && !selBox.isConnected) endSel();
    }, true);
    document.addEventListener('contextmenu', (e) => { if (e.target.closest('.thumbs > .t[data-id], .photo-grid > .ph[data-id]')) e.preventDefault(); }, true);
  }
  bindLongPress();
  return { save, start, pill, poll, remove, purgeRefs, endSel, pending: () => Math.max(0, total - done) };
})();
setTimeout(() => { try { PhotoQ.start(); } catch (e) { console.warn('photoq', e); } }, 2500);
