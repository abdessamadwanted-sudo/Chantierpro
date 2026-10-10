// Synchronisation Google Drive (téléphone ⇄ PC ⇄ autres appareils)
// Tout est envoyé dans « Mon Drive / Chantier Pro / <Projet> / … » par un petit script Google (Apps Script)
// que l'utilisateur installe une seule fois dans son compte. Les données restent dans SON Drive.
const Sync = (() => {
  const DATA = ['projects', 'folders', 'plans', 'tasks', 'links', 'files', 'forms', 'reports', 'receptions'];
  const LS = {
    get(k, d = null) { try { const v = localStorage.getItem('sync.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('sync.' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('sync.' + k); } catch (e) {} },
  };
  const st = { state: 'off', msg: '', last: LS.get('last', 0) };
  let running = false, again = false, timer = null, autoT = null;

  const cfg = () => LS.get('cfg');
  const enabled = () => !!(cfg() && cfg().url && cfg().key);

  // ---------- état (pastille) ----------
  function setStatus(state, msg = '') {
    st.state = state; st.msg = msg;
    let el = document.getElementById('syncPill');
    if (!el) { el = document.createElement('div'); el.id = 'syncPill'; document.body.appendChild(el); el.onclick = () => openSyncSettings(); }
    el.className = 'sync-pill ' + state;
    el.innerHTML = state === 'sync' ? `<span class="spin"></span>${esc(msg || 'Synchronisation…')}` : state === 'error' ? `⚠ ${esc(msg || 'Synchro impossible')}` : '';
    el.style.display = (state === 'sync' || state === 'error') ? 'flex' : 'none';
    document.querySelectorAll('[data-syncstate]').forEach(n => n.innerHTML = statusLine());
  }
  function statusLine() {
    if (!enabled()) return '<span style="color:var(--muted)">Non connecté</span>';
    if (st.state === 'sync') return `<span style="color:#60a5fa">⟳ ${esc(st.msg || 'Synchronisation…')}</span>`;
    if (st.state === 'error') return `<span style="color:#ef4444">⚠ ${esc(st.msg)}</span>`;
    return `<span style="color:#22c55e">✓ Synchronisé</span>${st.last ? ` <span style="color:var(--muted)">· ${new Date(st.last).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>` : ''}`;
  }

  // ---------- appel du script ----------
  async function call(action, body = {}) {
    const c = cfg(); if (!c) throw new Error('Non connecté');
    const payload = JSON.stringify({ key: c.key, action, ...body });
    let txt;
    try {
      const r = await fetch(c.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: payload, redirect: 'follow' });
      if (!r.ok) throw new Error('Erreur ' + r.status);
      txt = await r.text();
    } catch (err) {
      const http = window.Capacitor?.Plugins?.CapacitorHttp;
      if (!http) throw new Error(navigator.onLine === false ? 'Hors connexion' : 'Connexion au script impossible');
      const r = await http.post({ url: c.url, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, data: payload, responseType: 'text', connectTimeout: 30000, readTimeout: 300000 });
      if (r.status >= 400) throw new Error('Erreur ' + r.status);
      txt = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
    }
    let j; try { j = JSON.parse(txt); } catch (e) { throw new Error(/<html/i.test(txt) ? 'Script non accessible (Accès : « Tout le monde » ?)' : 'Réponse invalide'); }
    if (!j.ok) throw new Error(j.error || 'Erreur du script');
    return j;
  }

  // ---------- rangement dans Drive ----------
  const clean = (s, d = 'Sans nom') => (String(s || '').replace(/[\\/:*?"<>|#\n\r\t]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90)) || d;
  const extOf = (f) => { const t = f.mime || (f.blob && f.blob.type) || ''; if (t === 'image/png') return '.png'; if (/^image\/(jpe?g|webp|heic)/.test(t)) return '.jpg'; if (t === 'application/pdf') return '.pdf'; const m = String(f.name || '').match(/\.(\w{2,5})$/); return m ? '.' + m[1].toLowerCase() : ''; };
  async function buildPaths() {
    const [projects, folders, plans, links, recs, tasks, forms, reports] = await Promise.all(['projects', 'folders', 'plans', 'links', 'receptions', 'tasks', 'forms', 'reports'].map(s => DB.all(s)));
    const P = Object.fromEntries(projects.map(p => [p.id, clean(p.name, 'Projet')]));
    const F = Object.fromEntries(folders.map(f => [f.id, clean(f.name)]));
    const PL = Object.fromEntries(plans.map(p => [p.id, p]));
    const map = {};
    const put = (id, segs, name) => { if (id && !map[id]) map[id] = { segs: segs.map(s => clean(s)), name }; };
    for (const pl of plans) {
      const base = [P[pl.projectId] || 'Projet', 'Plans', F[pl.folderId] || 'Sans dossier'];
      put(pl.pdfFileId, base, clean(pl.name.replace(/ - p\d+$/, '')));
      put(pl.fileId, pl.pdfFileId ? [...base, 'Aperçus'] : base, clean(pl.name));
    }
    for (const l of links) {
      const pl = PL[l.planId]; if (!pl) continue;
      const base = [P[l.projectId] || 'Projet', 'Plans', F[pl.folderId] || 'Sans dossier', `${pl.name} - éléments`, l.name || 'Élément'];
      put(l.fileId, base.slice(0, -1), clean(l.name));
      for (const it of l.items || []) if (it.fileId) put(it.fileId, [...base, it.cat || 'Documents'], clean(it.name || it.cat));
    }
    for (const d of recs) {
      const bet = d.type === 'Bétonnage';
      const base = [P[d.projectId] || 'Projet', bet ? 'Programme de bétonnage' : 'Réception ferraillage', (d.date || '').slice(0, 7), d.date || 'date'];
      (d.pvIds || []).forEach((id, i) => put(id, [...base, 'PV du jour'], `PV ${d.date} - ${i + 1}`));
      for (const r of d.rows || []) {
        const nm = clean(`${r.zone ? 'Z' + r.zone + ' ' : ''}${r.niv || ''} ${r.element || ''}`);
        (r.photoIds || []).forEach((id, i) => put(id, [...base, r.status === 'reserve' ? (bet ? 'Défauts' : 'Réserves') : 'Photos'], `${nm} - ${i + 1}`));
        (r.retourIds || []).forEach((id, i) => put(id, [...base, bet ? 'Réparations' : 'Retours (levée)'], `${nm} - ${i + 1}`));
      }
    }
    for (const t of tasks) (t.photoIds || []).forEach((id, i) => put(id, [P[t.projectId] || 'Projet', 'Réserves', `#${t.num || ''} ${t.title || ''}`], `#${t.num || ''} - ${i + 1}`));
    for (const f of forms) (f.photoIds || []).forEach((id, i) => put(id, [P[f.projectId] || 'Projet', 'Formulaires', `${(f.date || '').slice(0, 10)} ${f.title || ''}`], `photo ${i + 1}`));
    for (const r of reports) (r.photoIds || []).forEach((id, i) => put(id, [P[r.projectId] || 'Projet', 'Rapports journaliers', r.date || ''], `photo ${i + 1}`));
    return { map, P };
  }
  function pathFor(f, paths) {
    const m = paths.map[f.id];
    const ext = extOf(f);
    if (m) return { segs: m.segs, name: m.name + ext };
    const month = new Date(f.createdAt || Date.now()).toISOString().slice(0, 7);
    const base = (f.name || f.id).replace(/\.\w{2,5}$/, '');
    return { segs: [paths.P[f.projectId] || 'Projet', f.role === 'doc' ? 'Documents' : 'Photos', month], name: clean(base) + ext };
  }
  const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  const fromB64 = (s, type) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); };

  // ---------- synchronisation ----------
  async function run({ quiet = false, force = false } = {}) {
    if (!enabled()) return;
    if (running) { again = true; return; }
    if (navigator.onLine === false) { setStatus('error', 'Hors connexion'); return; }
    running = true; again = false;
    let pulledCount = 0;
    try {
      setStatus('sync', 'Synchronisation…');
      // 1) envoyer les fichiers (photos, plans, PDF…) dans des dossiers rangés
      const paths = await buildPaths();
      const files = await DB.all('files');
      const todo = files.filter(f => f.blob && (!f.driveId || f.drivePath !== JSON.stringify(pathFor(f, paths))));
      let i = 0;
      for (const f of todo) {
        i++; setStatus('sync', `Envoi vers Drive ${i}/${todo.length}`);
        const pth = pathFor(f, paths), key = JSON.stringify(pth);
        let res = null;
        if (f.driveId) { try { res = await call('upload', { driveId: f.driveId, path: pth.segs, name: pth.name }); } catch (e) { res = null; } }
        if (!res) res = await call('upload', { path: pth.segs, name: pth.name, mime: f.mime || f.blob.type, b64: await b64(f.blob) });
        f.driveId = res.id; f.drivePath = key;
        await DB.put('files', f);
      }
      // 2) envoyer les données modifiées (tableaux, pins, tâches…)
      const since = LS.get('pushAt', 0), start = Date.now();
      const out = [];
      for (const s of DATA) for (const r of await DB.all(s)) if ((r.updatedAt || 0) > since) { const { blob, ...rest } = r; out.push({ ...rest, _store: s }); }
      for (const t of await DB.all('tomb')) if (t.at > since) out.push({ _store: t.store, id: t.rid, projectId: t.projectId, driveId: t.driveId, _deleted: true, updatedAt: t.at });
      for (let k = 0; k < out.length; k += 150) { setStatus('sync', `Envoi des données ${Math.min(k + 150, out.length)}/${out.length}`); await call('push', { records: out.slice(k, k + 150) }); }
      LS.set('pushAt', start);
      // 3) recevoir les changements des autres appareils
      setStatus('sync', 'Réception…');
      const pull = await call('pull', { since: LS.get('pullAt', 0) });
      for (const r of pull.records || []) {
        const store = r._store; if (!DATA.includes(store)) continue;
        const { _store, _srv, _deleted, ...rec } = r;
        const local = await DB.get(store, rec.id);
        if (_deleted) { if (local && (local.updatedAt || 0) <= (r.updatedAt || 0)) { await DB.delRaw(store, rec.id); BlobURL.drop(rec.id); pulledCount++; } continue; }
        if (local && (local.updatedAt || 0) >= (rec.updatedAt || 0)) continue;
        if (store === 'files' && local && local.blob && local.driveId === rec.driveId) rec.blob = local.blob;
        await DB.putRaw(store, rec); pulledCount++;
      }
      LS.set('pullAt', pull.now);
      // 4) télécharger les fichiers manquants (plans d'abord)
      const missing = (await DB.all('files')).filter(f => f.driveId && !f.blob).sort((a, b) => (b.role === 'plan') - (a.role === 'plan'));
      let j = 0;
      for (const f of missing) {
        j++; setStatus('sync', `Téléchargement ${j}/${missing.length}`);
        try { const d = await call('download', { id: f.driveId }); f.blob = fromB64(d.b64, f.mime || d.mime); await DB.putRaw('files', f); pulledCount++; }
        catch (e) { console.warn('download', f.id, e); }
      }
      // 5) documents lisibles dans Drive (PDF des tableaux, réserves, rapports)
      if (force || Date.now() - LS.get('docsAt', 0) > 90000) { await syncDocs(); LS.set('docsAt', Date.now()); }
      st.last = Date.now(); LS.set('last', st.last);
      setStatus('ok');
      if (pulledCount) {
        if (!quiet) toast(`☁ ${pulledCount} mise(s) à jour reçue(s)`);
        // rafraîchir l'écran si aucune fenêtre n'est ouverte
        if (!document.querySelector('.sheet-bg, .fullpage, .viewer')) { try { App.project ? (App.project = await DB.get('projects', App.project.id) || App.project, renderSection()) : renderHome(); } catch (e) {} }
      }
    } catch (e) {
      console.error('sync', e); setStatus('error', String(e.message || e).slice(0, 80));
    } finally {
      running = false;
      if (again) schedule(1500);
    }
  }
  // ---------- PDF automatiques rangés par date ----------
  const hash = (o) => { const s = JSON.stringify(o, (k, v) => (k === 'updatedAt' || k === 'lastOpened' || k === 'driveDocs' || k === 'syncedAt' || k === 'blob') ? undefined : v); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };
  async function capturePdf(fn) {
    const cap = [], L = window.loading, A = window.alertBox;
    window.PdfCapture = cap; window.loading = () => ({ set() {}, close() {} }); window.alertBox = async (m) => console.warn('pdf', m);
    try { await fn(); } catch (e) { console.warn('pdf', e); } finally { window.PdfCapture = null; window.loading = L; window.alertBox = A; }
    return cap[0];
  }
  async function syncDocs() {
    if (!window.jspdf) return;
    const projects = await DB.all('projects');
    for (const p of projects) {
      const docs = p.driveDocs || {}; let dirty = false;
      const pn = clean(p.name, 'Projet');
      const jobs = [];
      for (const d of await DB.byProject('receptions', p.id)) {
        if (!(d.rows || []).some(r => r.element)) continue;
        const bet = d.type === 'Bétonnage', title = bet ? 'Programme de bétonnage' : 'Réception ferraillage';
        const files = []; for (const r of d.rows) files.push(...(r.photoIds || []), ...(r.retourIds || [])); files.push(...(d.pvIds || []));
        jobs.push({ key: 'rec:' + d.id, sig: hash([d, p.pdfTitle, files.length]), segs: [pn, title, (d.date || '').slice(0, 7), d.date], name: `${title} ${d.date}.pdf`, make: () => receptionPdf(p, d) });
      }
      const tasks = await DB.byProject('tasks', p.id);
      if (tasks.length) jobs.push({ key: 'res', sig: hash(tasks), segs: [pn, 'Réserves'], name: 'Liste des réserves (à jour).pdf', make: () => buildReservesPdf(p, { company: 'all', status: 'all', period: 'all', photos: 'yes' }, () => {}) });
      for (const r of await DB.byProject('reports', p.id)) jobs.push({ key: 'rep:' + r.id, sig: hash(r), segs: [pn, 'Rapports journaliers', (r.date || '').slice(0, 7)], name: `Rapport journalier ${r.date}.pdf`, make: () => dailyPdf(r) });
      for (const f of await DB.byProject('forms', p.id)) jobs.push({ key: 'form:' + f.id, sig: hash(f), segs: [pn, 'Formulaires'], name: `PV ${(f.date || '').slice(0, 10)} ${clean(f.title)}.pdf`, make: () => formPdf(f) });
      jobs.forEach(j => { j.sig += '|' + pn; });
      const todo = jobs.filter(j => !docs[j.key] || docs[j.key].sig !== j.sig);
      let n = 0;
      for (const j of todo) {
        n++; setStatus('sync', `PDF dans Drive ${n}/${todo.length}`);
        const out = await capturePdf(j.make); if (!out) continue;
        const res = await call('upload', { path: j.segs, name: j.name, mime: 'application/pdf', b64: await b64(out.blob) });
        const old = docs[j.key] && docs[j.key].id;
        if (old && old !== res.id) await call('push', { records: [{ _store: 'gen', id: j.key + ':' + Date.now(), driveId: old, _deleted: true, updatedAt: Date.now() }] });
        docs[j.key] = { id: res.id, sig: j.sig }; dirty = true;
      }
      // documents dont la source a été supprimée
      for (const k of Object.keys(docs)) if (!jobs.some(j => j.key === k)) {
        await call('push', { records: [{ _store: 'gen', id: k + ':' + Date.now(), driveId: docs[k].id, _deleted: true, updatedAt: Date.now() }] });
        delete docs[k]; dirty = true;
      }
      if (dirty) { const cur = await DB.get('projects', p.id); if (cur) { cur.driveDocs = docs; await DB.put('projects', cur); } }
    }
  }

  function schedule(ms = 4000) { if (!enabled()) return; clearTimeout(timer); timer = setTimeout(() => run(), ms); }

  function start() {
    DB.onChange = () => schedule();
    if (!enabled()) return;
    setStatus('ok');
    setTimeout(() => run({ quiet: true }), 1200);
    clearInterval(autoT); autoT = setInterval(() => { if (document.visibilityState === 'visible') run({ quiet: false }); }, 120000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(800); });
    window.addEventListener('online', () => schedule(800));
  }

  // ---------- connexion ----------
  const newKey = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, '0')).join('');
  const codeOf = (c) => `${c.url}#k=${c.key}`;
  function parseCode(s) {
    s = String(s || '').trim(); const m = s.match(/^(https:\/\/script\.google(?:usercontent)?\.com\/[^\s#]+)(?:#k=([\w-]+))?/);
    return m ? { url: m[1], key: m[2] || '' } : null;
  }
  async function connect(code, pendingKey) {
    const c = parseCode(code); if (!c) throw new Error('Collez l\'URL de l\'application Web (https://script.google.com/macros/s/…/exec)');
    if (!c.key) c.key = pendingKey; if (!c.key) throw new Error('Code incomplet');
    LS.set('cfg', c);
    try { const r = await call('ping', { code: codeOf(c) }); c.folder = r.folder; LS.set('cfg', c); }
    catch (e) { LS.del('cfg'); throw e; }
    // première synchro complète
    LS.set('pushAt', 0); LS.set('pullAt', 0);
    start(); await run();
    return c;
  }
  function disconnect() { LS.del('cfg'); LS.del('pushAt'); LS.del('pullAt'); clearInterval(autoT); setStatus('off'); }

  function script(key) {
    return `// Chantier Pro → Google Drive (synchronisation téléphone / PC)
// Collez ce code dans script.google.com puis : Déployer → Nouveau déploiement → Application Web
// Exécuter en tant que : Moi · Accès : Tout le monde
const KEY = '${key}';
const ROOT_NAME = 'Chantier Pro';

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return out({ ok: true, app: 'chantier' }); }
function root_() {
  const pr = PropertiesService.getScriptProperties(); const id = pr.getProperty('ROOT');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const it = DriveApp.getFoldersByName(ROOT_NAME); const f = it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_NAME);
  pr.setProperty('ROOT', f.getId()); return f;
}
function sub_(parent, name) { const it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); }
function path_(segs) { let f = root_(); segs.forEach(function (s) { f = sub_(f, s); }); return f; }
function dbFile_() {
  const sys = sub_(root_(), '_sync (ne pas toucher)'); const it = sys.getFilesByName('db.json');
  return it.hasNext() ? it.next() : sys.createFile('db.json', '{}', 'application/json');
}
function load_() { return JSON.parse(dbFile_().getBlob().getDataAsString() || '{}'); }
function save_(db) { dbFile_().setContent(JSON.stringify(db)); }

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.key !== KEY) return out({ ok: false, error: 'Clé invalide' });
  const lock = LockService.getScriptLock();
  try {
    if (d.action === 'ping') {
      const r = root_();
      if (d.code && !r.getFilesByName('Code de connexion.txt').hasNext()) r.createFile('Code de connexion.txt', d.code);
      return out({ ok: true, folder: r.getUrl(), now: Date.now() });
    }
    if (d.action === 'pull') {
      const db = load_(), s = d.since || 0, recs = [];
      for (const k in db) if ((db[k]._srv || 0) > s) recs.push(db[k]);
      return out({ ok: true, now: Date.now(), records: recs });
    }
    if (d.action === 'push') {
      lock.waitLock(30000);
      const db = load_(), now = Date.now();
      d.records.forEach(function (r) {
        const k = r._store + ':' + r.id, old = db[k];
        if (old && (old.updatedAt || 0) > (r.updatedAt || 0)) return;
        if (r._deleted) {
          const did = (old && old.driveId) || r.driveId;
          if (did) { try { DriveApp.getFileById(did).setTrashed(true); } catch (e) {} }
          db[k] = { _store: r._store, id: r.id, projectId: r.projectId || (old && old.projectId) || null, _deleted: true, updatedAt: r.updatedAt, _srv: now };
        } else { r._srv = now; db[k] = r; }
      });
      save_(db);
      return out({ ok: true, now: now });
    }
    if (d.action === 'upload') {
      const folder = path_(d.path); let f = null;
      if (d.driveId) { try { f = DriveApp.getFileById(d.driveId); if (f.isTrashed()) f = null; } catch (e) { f = null; } }
      if (f && !d.b64) { f.moveTo(folder); f.setName(d.name); return out({ ok: true, id: f.getId() }); }
      if (!d.b64) return out({ ok: false, error: 'missing' });
      const nf = folder.createFile(Utilities.newBlob(Utilities.base64Decode(d.b64), d.mime || 'application/octet-stream', d.name));
      return out({ ok: true, id: nf.getId() });
    }
    if (d.action === 'download') {
      const b = DriveApp.getFileById(d.id).getBlob();
      return out({ ok: true, mime: b.getContentType(), b64: Utilities.base64Encode(b.getBytes()) });
    }
    return out({ ok: false, error: 'Action inconnue' });
  } catch (err) { return out({ ok: false, error: String(err) }); }
  finally { try { lock.releaseLock(); } catch (e) {} }
}`;
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copié ✓'); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('Copié ✓'); } catch (e2) { alertBox(text); } t.remove(); }
  }

  // ---------- écran de réglage ----------
  function openSyncSettings() {
    const c = cfg();
    if (c) {
      const s = sheet(`<div class="form">
        <div class="sync-card"><div class="cl">☁</div><div class="grow"><b>Google Drive connecté</b><div data-syncstate>${statusLine()}</div></div></div>
        <div class="muted" style="font-size:13.5px;line-height:1.55">Tout est rangé dans <b>Mon Drive › Chantier Pro › (projet)</b> : Plans par niveau, Réception ferraillage et Programme de bétonnage par mois et par jour (Réserves, Retours, PV du jour), Réserves, Photos…<br>La synchro se fait toute seule (après chaque modification, à l'ouverture et toutes les 2 minutes).</div>
        <button class="btn" data-a="now">${icon('undo')} Synchroniser maintenant</button>
        ${c.folder ? `<button class="btn ghost" data-a="open">${icon('drive')} Ouvrir le dossier dans Drive</button>` : ''}
        <button class="btn ghost" data-a="code">${icon('phone')} Copier le code de connexion (PC / autre téléphone)</button>
        <button class="btn ghost" data-a="script">${icon('file')} Copier le code du script</button>
        <button class="btn danger" data-a="off">Déconnecter cet appareil</button>
      </div>`, { title: 'Synchronisation Google Drive' });
      $('[data-a=now]', s.el).onclick = () => run({ force: true });
      const o = $('[data-a=open]', s.el); if (o) o.onclick = () => openUrl(c.folder);
      $('[data-a=code]', s.el).onclick = () => copy(codeOf(c));
      $('[data-a=script]', s.el).onclick = () => copy(script(c.key));
      $('[data-a=off]', s.el).onclick = async () => { if (await confirmBox('Déconnecter Google Drive sur cet appareil ? (les données restent sur l\'appareil et dans Drive)')) { disconnect(); s.close(); toast('Déconnecté'); } };
      return;
    }
    let key = LS.get('pendingKey'); if (!key) { key = newKey(); LS.set('pendingKey', key); }
    const s = sheet(`<div class="form">
      <div class="seg" style="margin-bottom:4px"><button type="button" data-tab="new" class="on">Première fois</button><button type="button" data-tab="code">J'ai un code</button></div>
      <div data-pane="new">
        <div class="muted steps">
          <b>1.</b> Sur PC (ou Chrome en mode ordinateur), ouvrez <b>script.google.com</b> avec votre compte Google → <b>Nouveau projet</b>.<br>
          <b>2.</b> Effacez tout, puis collez le code (bouton ci-dessous).<br>
          <b>3.</b> <b>Déployer → Nouveau déploiement</b> → type <b>Application Web</b> · Exécuter en tant que : <b>Moi</b> · Accès : <b>Tout le monde</b> → <b>Déployer</b> → Autoriser l'accès (Paramètres avancés → Accéder).<br>
          <b>4.</b> Copiez l'<b>URL de l'application Web</b> (…/exec) et collez-la ci-dessous.
        </div>
        <button class="btn ghost" data-a="copy" style="width:100%">${icon('file')} Copier le code du script</button>
        <label style="margin-top:10px">URL de l'application Web<input name="url" placeholder="https://script.google.com/macros/s/…/exec"></label>
      </div>
      <div data-pane="code" style="display:none">
        <div class="muted steps">Vous avez déjà connecté un autre appareil ? Collez ici le <b>code de connexion</b> (Paramètres › Google Drive › Copier le code de connexion), ou ouvrez le fichier <b>Code de connexion.txt</b> dans <b>Mon Drive › Chantier Pro</b>.<br>Tous vos projets, plans, photos et tableaux seront récupérés.</div>
        <label>Code de connexion<textarea name="code" style="min-height:80px" placeholder="https://script.google.com/macros/s/…/exec#k=…"></textarea></label>
      </div>
      <button class="btn" data-a="ok">${icon('check')} Connecter</button>
    </div>`, { title: 'Connecter Google Drive' });
    let tab = 'new';
    $$('[data-tab]', s.el).forEach(b => b.onclick = () => { tab = b.dataset.tab; $$('[data-tab]', s.el).forEach(x => x.classList.toggle('on', x === b)); $$('[data-pane]', s.el).forEach(p => p.style.display = p.dataset.pane === tab ? '' : 'none'); });
    $('[data-a=copy]', s.el).onclick = () => copy(script(key));
    $('[data-a=ok]', s.el).onclick = async () => {
      const v = tab === 'new' ? $('[name=url]', s.el).value : $('[name=code]', s.el).value;
      const ld = loading('Connexion à Google Drive…');
      try { await connect(v, tab === 'new' ? key : ''); ld.close(); LS.del('pendingKey'); s.close(); toast('☁ Google Drive connecté ✓'); if (!App.project) renderHome(); }
      catch (e) { ld.close(); alertBox('Connexion impossible : ' + (e.message || e)); }
    };
  }

  return { start, run, schedule, enabled, openSyncSettings, statusLine, cfg, buildPaths, pathFor, _call: call, _parse: parseCode, _script: script };
})();
