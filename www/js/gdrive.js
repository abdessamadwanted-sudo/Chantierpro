// Google Drive « direct » : connexion avec le compte Google depuis l'application, SANS script (script.google.com).
// Jeton OAuth obtenu par le plugin natif GDriveAuth (permission « drive.file » : SiteTeam ne voit que les fichiers qu'il crée),
// puis appels directs à l'API Google Drive v3. Mêmes actions que l'ancien script (ping, push, pull, upload, download, check, dedupe, ocr)
// pour que la synchronisation (sync.js) fonctionne sans changement.
const GDrive = (() => {
  const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FOLDER = 'application/vnd.google-apps.folder', ROOT_NAME = 'SiteTeam', SYS = '_sync (ne pas toucher)', VER = 3;
  const LS = {
    get(k, d = null) { try { const v = localStorage.getItem('gd.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('gd.' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('gd.' + k); } catch (e) {} },
  };
  const plug = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GDriveAuth;
  const available = () => !!plug();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ---------- jeton ----------
  let tok = null, tokAt = 0, tokP = null;
  function authMsg(e) {
    const c = String(e && e.code || ''), m = String(e && e.message || e || '');
    if (c === 'CANCELED' || /12501|annul/i.test(c + m)) return 'Connexion annulée';
    if (c === 'NEED_CONSENT') return 'Autorisation Google expirée : reconnectez Google Drive (Paramètres › Google Drive)';
    if (c === '10' || /DEVELOPER_ERROR|^10:/.test(m)) return 'Configuration Google incomplète (ID client Android / empreinte SHA-1 dans Google Cloud)';
    if (c === '7' || /NETWORK/i.test(m)) return 'Hors connexion';
    return 'Google : ' + m;
  }
  async function token(interactive = false, force = false) {
    if (tok && !force && Date.now() - tokAt < 40 * 60000) return tok;
    // v1.0.60 : une demande Google avec fenêtre restée sans réponse ne bloque plus tous les envois (pastille « 3/59 vers Drive » figée)
    if (tokP && !interactive) return Promise.race([tokP, sleep(40000).then(() => { throw Object.assign(new Error('Google ne répond pas (délai dépassé)'), { code: 'TIMEOUT' }); })]);
    const p = plug(); if (!p) throw new Error('Connexion Google disponible dans l\'application Android');
    tokP = (async () => {
      // v1.0.53 : jamais d'attente sans fin (la pastille « 3/49 vers Drive » restait figée) : 40 s au plus sans fenêtre Google
      const auth = p.authorize({ interactive, scopes: [SCOPE] });
      try { const r = interactive ? await auth : await Promise.race([auth, sleep(40000).then(() => { throw Object.assign(new Error('Google ne répond pas (délai dépassé)'), { code: 'TIMEOUT' }); })]); tok = r.accessToken; tokAt = Date.now(); return tok; }
      catch (e) { const er = new Error(authMsg(e)); er.code = e && e.code; throw er; }
      finally { tokP = null; }
    })();
    return tokP;
  }
  async function dropToken(t) { tok = null; tokAt = 0; try { await plug().clearToken({ token: t }); } catch (e) {} }

  // ---------- requêtes ----------
  async function req(url, opt = {}, n = 0) {
    const t = await token(false);
    let r;
    // v1.0.53 : délai maximum par requête (réseau de chantier qui « gèle ») — 45 s, plus le temps d'envoyer le fichier à 20 Ko/s au pire
    const sz = opt.body && opt.body.size || 0, ac = typeof AbortController === 'function' ? new AbortController() : null, tm = ac ? setTimeout(() => ac.abort(), 45000 + Math.round(sz / 20)) : null;
    try { r = await fetch(url, { ...opt, ...(ac ? { signal: ac.signal } : {}), headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + t } }); }
    catch (e) { clearTimeout(tm); if (n < 2) { await sleep(1200 * (n + 1)); return req(url, opt, n + 1); } throw new Error(navigator.onLine === false ? 'Hors connexion' : 'Connexion à Google Drive impossible'); }
    clearTimeout(tm);
    if (r.status === 401 && n < 1) { await dropToken(t); return req(url, opt, n + 1); }
    if ((r.status === 429 || r.status >= 500 || (r.status === 403 && /rate|quota/i.test(r.statusText))) && n < 3) { await sleep(1500 * (n + 1)); return req(url, opt, n + 1); }
    if (!r.ok) {
      let m = ''; try { const j = await r.json(); m = (j.error && (j.error.message || j.error)) || ''; } catch (e) {}
      if (r.status === 403 && /has not been used|disabled/i.test(m)) m = 'API Google Drive non activée dans Google Cloud';
      const er = new Error(`Drive ${r.status}${m ? ' : ' + m : ''}`); er.status = r.status; throw er;
    }
    return r;
  }
  // v1.0.60 : la lecture de la réponse a aussi un délai maximum (réseau qui gèle après l'envoi)
  const json = async (url, opt) => { const r = await req(url, opt); return Promise.race([r.json(), sleep(60000).then(() => { throw new Error('Google Drive ne répond pas (délai dépassé)'); })]); };
  const patch = (url, body) => json(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const qs = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  function multipart(meta, blob, type) {
    const b = 'siteteam' + Math.random().toString(36).slice(2);
    const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${type || 'application/octet-stream'}\r\n\r\n`, blob, `\r\n--${b}--`]);
    return { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body };
  }
  async function create(meta, blob, type, extra = '') {
    type = type || blob.type || 'application/octet-stream';
    if (blob.size <= 4 * 1048576) return json(`${UP}/files?uploadType=multipart&fields=id${extra}`, multipart(meta, blob, type));
    // gros fichier (plans PDF…) : envoi « reprise possible »
    const s = await req(`${UP}/files?uploadType=resumable&fields=id${extra}`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type, 'X-Upload-Content-Length': String(blob.size) }, body: JSON.stringify(meta) });
    const loc = s.headers.get('Location') || s.headers.get('location');
    if (!loc) return json(`${UP}/files?uploadType=multipart&fields=id${extra}`, multipart(meta, blob, type));   // en-tête non lisible : envoi en une fois
    return json(loc, { method: 'PUT', headers: { 'Content-Type': type }, body: blob });
  }
  async function list(q, fields = 'id,name,mimeType,parents') {
    const out = []; let page = '';
    do {
      const r = await json(`${API}/files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(${fields})&orderBy=createdTime&pageSize=1000&spaces=drive${page ? '&pageToken=' + encodeURIComponent(page) : ''}`);
      out.push(...(r.files || [])); page = r.nextPageToken || '';
    } while (page);
    return out;
  }
  const kids = (parent) => list(`'${parent}' in parents and trashed=false`);

  // ---------- dossiers ----------
  const cache = new Map();
  let rootP = null;
  function root() {
    if (rootP) return rootP;
    rootP = (async () => {
      let id = LS.get('root');
      if (id) { try { const m = await json(`${API}/files/${id}?fields=id,trashed`); if (m.trashed) id = null; } catch (e) { if (e.status === 404) id = null; else throw e; } }
      if (!id) {
        const l = await list(`name='${ROOT_NAME}' and 'root' in parents and mimeType='${FOLDER}' and trashed=false`);
        id = l.length ? l[0].id : (await patchless(`${API}/files?fields=id`, { name: ROOT_NAME, mimeType: FOLDER, parents: ['root'] })).id;
        LS.set('root', id);
      }
      return id;
    })();
    rootP.catch(() => { rootP = null; });
    return rootP;
  }
  const patchless = (url, body) => json(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  function sub(parent, name) {
    const k = parent + '/' + name; if (cache.has(k)) return cache.get(k);
    const p = (async () => {
      const l = await list(`name='${qs(name)}' and '${parent}' in parents and mimeType='${FOLDER}' and trashed=false`);
      return l.length ? l[0].id : (await patchless(`${API}/files?fields=id`, { name, mimeType: FOLDER, parents: [parent] })).id;
    })();
    cache.set(k, p); p.catch(() => cache.delete(k));
    return p;
  }
  async function path(segs) { let f = await root(); for (const s of segs || []) f = await sub(f, String(s)); return f; }
  function reset() { cache.clear(); rootP = null; dbP = null; dbMem = null; }

  // ---------- base de synchronisation (db.json dans « SiteTeam / _sync ») ----------
  let dbP = null, dbMem = null;   // dbMem = { ver, db }
  function dbId() {
    if (dbP) return dbP;
    dbP = (async () => {
      const sys = await sub(await root(), SYS);
      const l = await list(`name='db.json' and '${sys}' in parents and trashed=false`);
      if (l.length) return l[0].id;
      return (await create({ name: 'db.json', parents: [sys], mimeType: 'application/json' }, new Blob(['{}'], { type: 'application/json' }), 'application/json')).id;
    })();
    dbP.catch(() => { dbP = null; });
    return dbP;
  }
  async function dbVer() { const id = await dbId(); return String((await json(`${API}/files/${id}?fields=version`)).version || ''); }
  async function load() {
    const id = await dbId(), ver = await dbVer();
    if (dbMem && dbMem.ver === ver) return dbMem;
    const t = await (await req(`${API}/files/${id}?alt=media`)).text();
    let db = {}; try { db = JSON.parse(t || '{}') || {}; } catch (e) { db = {}; }
    dbMem = { ver, db }; return dbMem;
  }
  async function save(db) {
    const id = await dbId();
    const r = await json(`${UP}/files/${id}?uploadType=media&fields=version`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(db) });
    dbMem = { ver: String(r.version || ''), db }; return dbMem;
  }
  // repère « serveur » : toujours plus grand que tout ce qui est déjà dans la base (indépendant de l'heure des téléphones)
  const maxSrv = (db) => { let m = 0; for (const k in db) if ((db[k]._srv || 0) > m) m = db[k]._srv; return m; };
  async function trash(id) { try { await patch(`${API}/files/${id}?fields=id`, { trashed: true }); } catch (e) { if (e.status !== 404 && e.status !== 403) throw e; } }
  async function push(records) {
    for (let a = 0; a < 3; a++) {
      const cur = await load(), db = { ...cur.db }, now = Math.max(Date.now(), maxSrv(db) + 1), del = [];
      for (const r of records || []) {
        const k = r._store + ':' + r.id, old = db[k];
        if (old && (old.updatedAt || 0) > (r.updatedAt || 0)) continue;
        if (r._deleted) {
          const did = (old && old.driveId) || r.driveId; if (did) del.push(did);
          db[k] = { _store: r._store, id: r.id, projectId: r.projectId || (old && old.projectId) || null, _deleted: true, updatedAt: r.updatedAt, _srv: now };
        } else db[k] = { ...r, _srv: now };
      }
      // un autre appareil a écrit entre-temps : on recommence avec sa version (pas d'écrasement)
      if (await dbVer() !== cur.ver) { dbMem = null; continue; }
      await save(db);
      for (const id of del) await trash(id);
      return { ok: true, now };
    }
    throw new Error('Drive occupé par un autre appareil — nouvel essai automatique');
  }
  async function pull(since) {
    const { db } = await load(), recs = [];
    for (const k in db) if ((db[k]._srv || 0) > (since || 0)) recs.push(db[k]);
    return { ok: true, now: Math.max(since || 0, maxSrv(db)), records: recs };
  }

  // ---------- fichiers ----------
  async function upload(d) {
    const folder = await path(d.path);
    if (d.driveId) {
      try {
        const m = await json(`${API}/files/${d.driveId}?fields=id,parents,trashed`);
        if (!m.trashed && !d.blob) {
          const rm = (m.parents || []).filter(x => x !== folder);
          const add = (m.parents || []).includes(folder) ? '' : '&addParents=' + folder;
          await patch(`${API}/files/${d.driveId}?fields=id${add}${rm.length ? '&removeParents=' + rm.join(',') : ''}`, { name: d.name });
          return { ok: true, id: d.driveId };
        }
      } catch (e) { if (e.status !== 404 && e.status !== 403) throw e; }   // fichier de l'ancien script ou supprimé : on renvoie une copie
    }
    if (!d.blob) throw new Error('missing');
    const r = await create({ name: d.name, parents: [folder], mimeType: d.mime || d.blob.type || 'application/octet-stream' }, d.blob, d.mime || d.blob.type);
    return { ok: true, id: r.id };
  }
  async function download(id) {
    const r = await req(`${API}/files/${id}?alt=media`);
    const blob = await Promise.race([r.blob(), sleep(180000).then(() => { throw new Error('Téléchargement Drive : délai dépassé'); })]);
    return { ok: true, mime: blob.type, blob };
  }
  async function check(ids) {
    const miss = [], L = (ids || []).slice();
    const work = async () => { while (L.length) { const id = L.shift(); try { const m = await json(`${API}/files/${id}?fields=id,trashed`); if (m.trashed) miss.push(id); } catch (e) { if (e.status === 404) miss.push(id); else throw e; } } };
    await Promise.all([work(), work(), work(), work()]);
    return { ok: true, missing: miss };
  }
  async function move(id, to, from) { await patch(`${API}/files/${id}?fields=id&addParents=${to}&removeParents=${from}`, {}); }
  async function merge(keep, dup) {
    const inKeep = await kids(keep);
    for (const c of await kids(dup)) {
      if (c.mimeType === FOLDER) { const same = inKeep.find(x => x.mimeType === FOLDER && x.name === c.name); if (same) { await merge(same.id, c.id); continue; } }
      if (c.name === 'db.json' && inKeep.some(x => x.name === 'db.json')) { await trash(c.id); continue; }   // la base utilisée reste celle du premier dossier
      await move(c.id, keep, dup);
    }
    await trash(dup);
  }
  async function dedupe(id, n) {
    const seen = {};
    for (const c of (await kids(id)).filter(x => x.mimeType === FOLDER)) { if (seen[c.name]) { await merge(seen[c.name], c.id); n.n++; } else seen[c.name] = c.id; }
    for (const k in seen) await dedupe(seen[k], n);
    return n;
  }
  async function ocr(blob) {
    const r = await create({ name: 'ocr-tmp', mimeType: 'application/vnd.google-apps.document' }, blob, blob.type || 'image/jpeg', '&ocrLanguage=fr');
    try { return { ok: true, text: await (await req(`${API}/files/${r.id}/export?mimeType=text/plain`)).text() }; }
    finally { try { await req(`${API}/files/${r.id}`, { method: 'DELETE' }); } catch (e) {} }
  }
  async function ping() {
    const id = await root();
    let email = ''; try { email = (await json(`${API}/about?fields=user(emailAddress)`)).user.emailAddress || ''; } catch (e) {}
    return { ok: true, app: 'siteteam', folder: 'https://drive.google.com/drive/folders/' + id, ver: VER, email, now: Date.now() };
  }

  // ---------- point d'entrée (mêmes actions que le script) ----------
  const b64ToBlob = (s, type) => { const bin = atob(s || ''); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: type || 'application/octet-stream' }); };
  async function call(action, d = {}) {
    if (d.b64 && !d.blob) d = { ...d, blob: b64ToBlob(d.b64, d.mime) };
    switch (action) {
      case 'ping': return ping();
      case 'pull': return pull(d.since);
      case 'push': return push(d.records);
      case 'upload': return upload(d);
      case 'download': return download(d.id);
      case 'check': return check(d.ids);
      case 'dedupe': { const n = await dedupe(await root(), { n: 0 }); reset(); return { ok: true, merged: n.n }; }
      case 'ocr': return ocr(d.blob);
      default: throw new Error('Action inconnue');
    }
  }
  // connexion : fenêtre Google (choix du compte + autorisation), puis création / reprise du dossier « SiteTeam »
  async function connect() { reset(); await token(true, true); return ping(); }
  function forget() { reset(); tok = null; tokAt = 0; LS.del('root'); }

  // ---------- v1.0.74 : sauvegarde complète unique « SiteTeam / Sauvegardes » (mise à jour, jamais dupliquée) ----------
  const BK_NAME = 'SiteTeam-sauvegarde-complete.chantier.zip';
  // v1.0.126 : tous les dossiers de sauvegarde sont rangés dans « SiteTeam / projects / Sauvegardes »
  const BK_DIR = ['projects', 'Sauvegardes'];
  // v1.0.79 : recherche / écriture d'un fichier nommé dans un sous-dossier (toujours le MÊME fichier, mis à jour)
  async function fileFind(name, sub) {
    const folder = await path(sub);
    const l = await list(`name='${qs(name)}' and '${folder}' in parents and trashed=false`, 'id,name,size,modifiedTime');
    return { folder, file: l[0] || null };
  }
  async function backupFind() { return fileFind(BK_NAME, BK_DIR); }
  async function backupInfo() { return (await backupFind()).file; }
  async function backupSave(blob) { return fileSave(BK_NAME, BK_DIR, blob); }
  // v1.0.79 : une sauvegarde par projet, dans SiteTeam / Sauvegardes / Projets
  async function projectSave(name, blob) { return fileSave(name, [...BK_DIR, 'Projets'], blob); }
  async function fileSave(name, sub, blob) {
    const { folder, file } = await fileFind(name, sub);
    if (!file) { const r = await create({ name, parents: [folder], mimeType: 'application/zip' }, blob, 'application/zip'); return { id: r.id, created: true, size: blob.size }; }
    if (blob.size <= 4 * 1048576) await req(`${UP}/files/${file.id}?uploadType=media&fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/zip' }, body: blob });
    else {
      const s = await req(`${UP}/files/${file.id}?uploadType=resumable&fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/zip', 'X-Upload-Content-Length': String(blob.size) }, body: '{}' });
      const loc = s.headers.get('Location') || s.headers.get('location'); if (!loc) throw new Error('Envoi Drive : réponse incomplète');
      await json(loc, { method: 'PUT', headers: { 'Content-Type': 'application/zip' }, body: blob });
    }
    return { id: file.id, created: false, size: blob.size };
  }
  async function backupGet(id) { return download(id); }

  // ---------- v1.1 : sauvegardes datées dans « SiteTeam / Sauvegardes » (2 gardées), avec un manifeste (liste des projets) ----------
  const BK_PREFIX = 'SiteTeam-sauvegarde_', BK_KEEP = 2;
  const stamp = (d = new Date()) => { const z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}`; };
  // liste des sauvegardes (les plus récentes d'abord) ; manifestId = fichier de liste des projets, s'il existe
  async function backupList() {
    const folder = await path(BK_DIR);
    const l = await list(`'${folder}' in parents and trashed=false`, 'id,name,size,modifiedTime');
    const mans = new Map(l.filter(f => f.name.startsWith(BK_PREFIX) && f.name.endsWith('.manifest.json')).map(f => [f.name.replace(/\.manifest\.json$/, '.chantier.zip'), f.id]));
    const zips = l.filter(f => f.name === BK_NAME || (f.name.startsWith(BK_PREFIX) && f.name.endsWith('.chantier.zip')));
    return zips.map(z => ({ ...z, manifestId: mans.get(z.name) || null })).sort((a, b) => Date.parse(b.modifiedTime) - Date.parse(a.modifiedTime));
  }
  // enregistre une nouvelle sauvegarde datée + son manifeste, puis met à la corbeille les plus anciennes (au-delà de BK_KEEP)
  async function backupSaveDated(blob, manifest) {
    const folder = await path(BK_DIR);
    const name = BK_PREFIX + stamp() + '.chantier.zip';
    const r = await create({ name, parents: [folder], mimeType: 'application/zip' }, blob, 'application/zip');
    await create({ name: name.replace(/\.chantier\.zip$/, '.manifest.json'), parents: [folder], mimeType: 'application/json' }, new Blob([JSON.stringify(manifest)], { type: 'application/json' }), 'application/json');
    const mine = (await backupList()).filter(z => z.name.startsWith(BK_PREFIX)).sort((a, b) => (a.name < b.name ? 1 : -1));
    for (const old of mine.slice(BK_KEEP)) {
      try { await patch(`${API}/files/${old.id}`, { trashed: true }); if (old.manifestId) await patch(`${API}/files/${old.manifestId}`, { trashed: true }); } catch (e) { console.warn('purge sauvegarde', e); }
    }
    return { id: r.id, name, size: blob.size };
  }
  async function backupManifest(id) { const r = await download(id); return JSON.parse(await r.blob.text()); }
  // téléchargement avec pourcentage (onP reçoit 0..100) ; total = taille annoncée par Drive
  async function downloadProgress(id, total, onP) {
    const r = await req(`${API}/files/${id}?alt=media`);
    if (!r.body || !r.body.getReader) { const b = await r.blob(); onP && onP(100); return b; }
    const rd = r.body.getReader(), parts = []; let got = 0;
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      parts.push(value); got += value.length;
      onP && onP(Math.min(100, Math.round(got * 100 / (total || got || 1))));
    }
    onP && onP(100);
    return new Blob(parts, { type: 'application/zip' });
  }

  // ---------- v1.1 : une sauvegarde ZIP par projet (nom = nom du projet), 2 gardées, dans « Sauvegardes » ----------
  const PBK_KEEP = 2;
  const pSafe = (n) => String(n || 'projet').replace(/[\\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60) || 'projet';
  const PRX = /^(.+)_(\d{4}-\d{2}-\d{2}_\d{4})\.chantier\.zip$/;
  // nom du dossier projet, identique à celui créé par la synchro (sync.js › clean) : « SiteTeam / <projet> »
  const pFolder = (n) => String(n || '').replace(/[\\/:*?"<>|#\n\r\t]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Projet';
  // liste des sauvegardes par projet : ZIP « <projet>_<date>.chantier.zip » rangés DANS le dossier du projet
  // (ignore la sauvegarde complète « SiteTeam-sauvegarde_… »)
  async function projectBackupList() {
    const l = await list(`name contains '.chantier.zip' and mimeType='application/zip' and trashed=false`, 'id,name,size,modifiedTime,parents');
    return l.filter(f => PRX.test(f.name) && !f.name.startsWith(BK_PREFIX)).map(f => { const m = PRX.exec(f.name); return { ...f, project: m[1], stamp: m[2] }; });
  }
  // enregistre le ZIP d'un projet dans SON dossier (pas de dossier « Sauvegardes » par projet),
  // puis met à la corbeille les plus anciennes de ce projet (au-delà de PBK_KEEP)
  async function projectBackupSave(projectName, blob) {
    const folder = await path([pFolder(projectName)]);
    const base = pSafe(projectName), name = base + '_' + stamp() + '.chantier.zip';
    const r = await create({ name, parents: [folder], mimeType: 'application/zip' }, blob, 'application/zip');
    const mine = (await projectBackupList()).filter(x => x.project === base && (x.parents || []).includes(folder)).sort((a, b) => (a.stamp < b.stamp ? 1 : -1));
    for (const old of mine.slice(PBK_KEEP)) { try { await patch(`${API}/files/${old.id}`, { trashed: true }); } catch (e) { console.warn('purge projet', e); } }
    return { id: r.id, name, size: blob.size, folder };
  }

  return { available, connect, call, forget, SCOPE, _reset: reset, backupInfo, backupSave, backupGet, projectSave, backupList, backupSaveDated, backupManifest, downloadProgress, BK_KEEP, projectBackupList, projectBackupSave, PBK_KEEP };
})();
