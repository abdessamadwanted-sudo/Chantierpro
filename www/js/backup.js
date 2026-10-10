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
  async function exportProject(projectId, onProgress) {
    const project = await DB.get('projects', projectId);
    const all = [];
    for (const s of STORES) for (const r of await DB.byProject(s, projectId)) all.push([s, r]);
    const safe = project.name.replace(/[^\wÀ-ſ؀-ۿ -]+/g, '').trim().replace(/\s+/g, '_').slice(0, 40) || 'projet';
    const fname = `${safe}_${todayISO()}.chantier`;
    const header = JSON.stringify({ app: 'chantier', v: 1, date: Date.now(), name: project.name }) + '\n' + JSON.stringify({ s: 'projects', d: project }) + '\n';

    const fs = FS();
    if (fs) {
      await fs.writeFile({ path: fname, data: header, directory: 'CACHE', encoding: 'utf8' });
      for (let i = 0; i < all.length; i++) {
        onProgress && onProgress(i + 1, all.length);
        await fs.appendFile({ path: fname, data: await encode(...all[i]), directory: 'CACHE', encoding: 'utf8' });
      }
      const { uri } = await fs.getUri({ path: fname, directory: 'CACHE' });
      const share = SHARE();
      if (share) {
        try { await share.share({ title: `Sauvegarde ${project.name}`, text: `Sauvegarde du projet ${project.name}`, files: [uri], dialogTitle: 'Enregistrer la sauvegarde' }); }
        catch (e) { if (!/cancel/i.test(String(e && e.message))) throw e; }
      } else {
        toast('Fichier créé : ' + fname);
      }
      return fname;
    }
    // Navigateur : téléchargement classique
    const parts = [header];
    for (let i = 0; i < all.length; i++) { onProgress && onProgress(i + 1, all.length); parts.push(await encode(...all[i])); }
    const url = URL.createObjectURL(new Blob(parts, { type: 'application/octet-stream' }));
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

  async function importFile(file, onProgress) {
    let header = null, project = null, n = 0;
    const db = DB;
    for await (const line of lines(file)) {
      const obj = JSON.parse(line);
      if (!header) {
        if (obj.app !== 'chantier') throw new Error('Ce fichier n\'est pas une sauvegarde Chantier');
        header = obj; continue;
      }
      if (obj.s === 'projects') {
        project = obj.d;
        const existing = await db.get('projects', project.id);
        if (existing) {
          const ok = await confirmBox(`« ${project.name} » existe déjà sur ce téléphone. Le remplacer par la sauvegarde ?`, 'Remplacer');
          if (!ok) return null;
          await db.deleteProject(project.id);
        }
        await db.put('projects', project);
        continue;
      }
      if (!project || !STORES.includes(obj.s)) continue;
      await db.put(obj.s, decode(obj.d));
      n++; onProgress && onProgress(n);
    }
    if (!project) throw new Error('Sauvegarde vide ou incomplète');
    return project;
  }

  return { exportProject, importFile };
})();
