// Sauvegarde / restauration d'un projet dans un seul fichier (.chantier)
// Format : une ligne JSON par enregistrement (les fichiers sont encodés en base64).
const Backup = (() => {
  const STORES = ['folders', 'plans', 'tasks', 'links', 'files', 'forms', 'reports', 'receptions'];
  const FS = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  const SHARE = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;

  const blobToB64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

  async function encode(store, obj) {
    const o = { ...obj };
    if (o.blob instanceof Blob) { o.blob = { __b64: await blobToB64(o.blob), type: o.blob.type || o.mime || '' }; }
    return JSON.stringify({ s: store, d: o }) + '\n';
  }

  // ---------- Export ----------
  // Archive .zip (données JSON + fichiers bruts, sans base64) écrite par morceaux : rapide, légère en mémoire,
  // puis la feuille « Partager » (WhatsApp, Drive, Gmail…) s'ouvre directement.
  const u8ToB64 = (u8) => blobToB64(new Blob([u8]));
  async function exportProject(projectId, onProgress, opts = {}) {
    const project = await DB.get('projects', projectId);
    await loadScript('vendor/fflate.min.js');
    const all = [];
    // v1.0.90 : une sauvegarde doit contenir les fichiers eux-mêmes (plans, photos), pas seulement leurs adresses Drive
    const missing = [];
    for (const s of STORES) for (const r of await DB.byProject(s, projectId)) {
      let x = r;
      if (s === 'files' && !(x.blob instanceof Blob) && (x.driveId || x.sref)) { try { const g = await DB.get('files', x.id); if (g && g.blob instanceof Blob) x = g; } catch (e) {} }
      if (s === 'files' && !(x.blob instanceof Blob) && (x.driveId || x.sref)) missing.push(x.name || x.id);
      all.push([s, x]);
    }
    if (missing.length) throw new Error(`${missing.length} fichier(s) pas encore téléchargé(s) depuis Drive. Vérifiez la connexion Drive, attendez la synchro, puis réessayez.`);
    const safe = project.name.replace(/[^\wÀ-ſ؀-ۿ -]+/g, '').trim().replace(/\s+/g, '_').slice(0, 40) || 'projet';
    const fname = `Sauvegarde_${safe}_${todayISO()}.chantier.zip`;
    const lines = [JSON.stringify({ app: 'chantier', v: 2, date: Date.now(), name: project.name }), JSON.stringify({ s: 'projects', d: project })];
    const blobs = [];
    for (const [st, r] of all) {
      const o = { ...r };
      if (o.blob instanceof Blob) { const n = `f/${st}_${o.id}`; blobs.push([n, o.blob]); o.blob = { __zip: n, type: o.blob.type || o.mime || '' }; }
      lines.push(JSON.stringify({ s: st, d: o }));
    }
    // v1.0.131 : envoi Drive = ZIP en mémoire (sans passer par le cache en base64, trop gourmand : fermeture de l'application en fin de sauvegarde)
    const fs = opts.drive ? null : FS(), q = []; let qn = 0, err = null, wrote = false;
    const zip = new fflate.Zip((e, chunk) => { if (e) err = e; else if (chunk && chunk.length) { q.push(chunk); qn += chunk.length; } });
    const outParts = [];
    const flush = async (force) => {
      if (err) throw err;
      if (!q.length || (!force && qn < 1.5e6)) return;
      const merged = new Blob(q.splice(0)); qn = 0;
      if (!fs) { outParts.push(merged); return; }
      const data = await blobToB64(merged);
      try { if (!wrote) { await fs.writeFile({ path: fname, data, directory: 'CACHE' }); wrote = true; } else await fs.appendFile({ path: fname, data, directory: 'CACHE' }); }
      catch (e) { throw new Error(/space|ENOSPC|No space/i.test(String(e && e.message)) ? 'Espace insuffisant sur le téléphone. Libérez de la place puis réessayez.' : (e && e.message) || String(e)); }
    };
    const head = new fflate.ZipDeflate('donnees.jsonl', { level: 6 }); zip.add(head);
    head.push(new TextEncoder().encode(lines.join('\n') + '\n'), true); await flush();
    for (let i = 0; i < blobs.length; i++) {
      onProgress && onProgress(i + 1, blobs.length);
      const [n, b] = blobs[i], e = new fflate.ZipPassThrough(n); zip.add(e);
      e.push(new Uint8Array(await b.arrayBuffer()), true); await flush();
    }
    zip.end(); await flush(true);
    // v1.0.79 : envoi direct vers Drive (même fichier mis à jour) au lieu du partage
    if (opts.drive) {
      let blob;
      if (fs) { const rd = await fs.readFile({ path: fname, directory: 'CACHE' }); const bin = atob(rd.data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); blob = new Blob([u8], { type: 'application/zip' }); }
      else blob = new Blob(outParts, { type: 'application/zip' });
      await opts.drive(blob, project);
      return fname;
    }
    if (fs) {
      const { uri } = await fs.getUri({ path: fname, directory: 'CACHE' });
      const share = SHARE();
      if (share) {
        try { await share.share({ title: `Sauvegarde ${project.name}`, text: `Sauvegarde du projet ${project.name} (application SiteTeam)`, files: [uri], dialogTitle: 'Envoyer / enregistrer la sauvegarde' }); }
        catch (e) { if (!/cancel/i.test(String(e && e.message))) throw e; }
      } else toast('Fichier créé : ' + fname);
      return fname;
    }
    const url = URL.createObjectURL(new Blob(outParts, { type: 'application/zip' }));
    const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return fname;
  }

  // ---------- Import ----------
  async function* lines(file) {
    const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) yield l; }
    }
    if (buf.trim()) yield buf;
  }

  function decode(o) {
    if (o.blob && o.blob.__b64 !== undefined) o.blob = base64ToBlob(o.blob.__b64, o.blob.type);
    return o;
  }

  // archive .zip (v2) : lignes JSON + fichiers à part
  async function* zipLines(u8, ctx) {
    const d = fflate.unzipSync(u8, { filter: (f) => f.name === 'donnees.jsonl' })['donnees.jsonl'];
    if (!d) throw new Error('Ce fichier n\'est pas une sauvegarde SiteTeam / Chantier');
    ctx.blob = (n, type) => { const r = fflate.unzipSync(u8, { filter: (f) => f.name === n })[n]; return r ? new Blob([r], { type }) : null; };
    for (const l of new TextDecoder().decode(d).split('\n')) if (l.trim()) yield l;
  }
  // only (optionnel) : Set d'identifiants de projets à restaurer ; les autres de la sauvegarde sont ignorés
  async function importFile(file, onProgress, { replaceAll = false, only = null } = {}) {
    let header = null, project = null, n = 0, last = null;
    const db = DB, ctx = {};
    const sig = new Uint8Array(await file.slice(0, 2).arrayBuffer()), isZip = sig[0] === 0x50 && sig[1] === 0x4b;
    let src;
    if (isZip) { await loadScript('vendor/fflate.min.js'); src = zipLines(new Uint8Array(await file.arrayBuffer()), ctx); } else src = lines(file);
    for await (const line of src) {
      const obj = JSON.parse(line);
      if (!header) {
        if (obj.app !== 'chantier') throw new Error('Ce fichier n\'est pas une sauvegarde SiteTeam / Chantier');
        header = obj; continue;
      }
      if (obj.s === 'projects') {
        project = obj.d;
        if (only && !only.has(project.id)) { project = null; continue; }
        const existing = await db.get('projects', project.id);
        if (existing) {
          if (!replaceAll) { const ok = await confirmBox(`« ${project.name} » existe déjà sur ce téléphone. Le remplacer par la sauvegarde ?`, 'Remplacer'); if (!ok) return null; }
          await db.deleteProject(project.id);
        }
        await db.put('projects', project);
        last = project;
        continue;
      }
      if (!project || !STORES.includes(obj.s)) continue;
      if (obj.d.blob && obj.d.blob.__zip) obj.d.blob = ctx.blob ? ctx.blob(obj.d.blob.__zip, obj.d.blob.type) : null;
      await db.put(obj.s, decode(obj.d));
      n++; onProgress && onProgress(n);
    }
    if (!last) throw new Error(only ? 'Aucun des projets choisis n\'est dans cette sauvegarde' : 'Sauvegarde vide ou incomplète');
    return last;
  }

  // v1.0.74 : sauvegarde COMPLÈTE de tous les projets dans un seul fichier (pour Google Drive, mise à jour à chaque fois)
  async function buildAllBlob(onProgress) {
    await loadScript('vendor/fflate.min.js');
    const projects = await DB.all('projects');
    if (!projects.length) throw new Error('Aucun projet sur ce téléphone : la sauvegarde Drive existante est conservée');
    const lines = [JSON.stringify({ app: 'chantier', v: 2, date: Date.now(), name: 'Tous les projets (' + projects.length + ')' })];
    const blobs = [];
    for (const p of projects) {
      lines.push(JSON.stringify({ s: 'projects', d: p }));
      for (const st of STORES) for (const r of await DB.byProject(st, p.id)) {
        const o = { ...r };
        if (o.blob instanceof Blob) { const n = `f/${st}_${o.id}`; blobs.push([n, o.blob]); o.blob = { __zip: n, type: o.blob.type || o.mime || '' }; }
        lines.push(JSON.stringify({ s: st, d: o }));
      }
    }
    const parts = [];
    const zip = new fflate.Zip((e, chunk) => { if (e) throw e; if (chunk && chunk.length) parts.push(chunk); });
    const head = new fflate.ZipDeflate('donnees.jsonl', { level: 6 }); zip.add(head);
    head.push(new TextEncoder().encode(lines.join('\n') + '\n'), true);
    for (let i = 0; i < blobs.length; i++) {
      onProgress && onProgress(i + 1, blobs.length);
      const [n, b] = blobs[i], e = new fflate.ZipPassThrough(n); zip.add(e);
      e.push(new Uint8Array(await b.arrayBuffer()), true);
    }
    zip.end();
    return new Blob(parts, { type: 'application/zip' });
  }

  // lecture rapide du contenu d'une sauvegarde : nom du projet + nombre d'éléments par type
  async function inspect(blob) {
    await loadScript('vendor/fflate.min.js');
    const u8 = new Uint8Array(await blob.arrayBuffer());
    const d = fflate.unzipSync(u8, { filter: (f) => f.name === 'donnees.jsonl' })['donnees.jsonl'];
    const out = { name: '', counts: {} };
    if (!d) return out;
    for (const l of new TextDecoder().decode(d).split('\n')) {
      if (!l.trim()) continue;
      const o = JSON.parse(l);
      if (o.s === 'projects') out.name = o.d.name || '';
      else if (o.s && STORES.includes(o.s)) out.counts[o.s] = (out.counts[o.s] || 0) + 1;
    }
    return out;
  }

  return { exportProject, importFile, buildAllBlob, inspect };
})();
