// SiteTeam → Google Drive (synchronisation téléphone / PC)
// Collez ce code dans script.google.com puis : Déployer → Nouveau déploiement → Application Web
// Exécuter en tant que : Moi · Accès : Tout le monde
const KEY = 'REMPLACER_PAR_UNE_CLE_LONGUE_ALEATOIRE';
const ROOT_NAME = 'SiteTeam';

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return out({ ok: true, app: 'siteteam' }); }
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
      return out({ ok: true, app: 'siteteam', folder: r.getUrl(), now: Date.now() });
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
}