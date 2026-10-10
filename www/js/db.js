// Stockage local (IndexedDB) — tout reste sur le téléphone, fonctionne sans internet.
const DB = (() => {
  const NAME = 'chantier';
  const VERSION = 3;
  const STORES = ['projects', 'folders', 'plans', 'tasks', 'links', 'files', 'forms', 'reports', 'receptions', 'tomb'];  // tomb = suppressions à synchroniser
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) {
            const os = db.createObjectStore(s, { keyPath: 'id' });
            if (s !== 'projects') os.createIndex('projectId', 'projectId');
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function wrap(req) {
    return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  }

  async function tx(store, mode = 'readonly') {
    const db = await open();
    return db.transaction(store, mode).objectStore(store);
  }

  let chT = null;
  function changed(store) { if (store === 'tomb') return; clearTimeout(chT); chT = setTimeout(() => { try { DB.onChange && DB.onChange(store); } catch (e) {} }, 50); }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  return {
    uid,
    async get(store, id) { return wrap((await tx(store)).get(id)); },
    async all(store) { return wrap((await tx(store)).getAll()); },
    async byProject(store, projectId) { return wrap((await tx(store)).index('projectId').getAll(projectId)); },
    async put(store, obj) {
      if (!obj.id) obj.id = uid();
      if (!obj.createdAt) obj.createdAt = Date.now();
      obj.updatedAt = Date.now();
      await wrap((await tx(store, 'readwrite')).put(obj));
      changed(store);
      return obj;
    },
    async del(store, id) {
      const old = await this.get(store, id);
      await wrap((await tx(store, 'readwrite')).delete(id));
      if (old && store !== 'tomb') {
        await wrap((await tx('tomb', 'readwrite')).put({ id: store + ':' + id, store, rid: id, projectId: old.projectId || (store === 'projects' ? id : null), driveId: old.driveId || null, at: Date.now() }));
        changed(store);
      }
    },
    // utilisés par la synchronisation (ne déclenchent pas de nouvel envoi)
    async putRaw(store, obj) { await wrap((await tx(store, 'readwrite')).put(obj)); return obj; },
    async delRaw(store, id) { return wrap((await tx(store, 'readwrite')).delete(id)); },
    onChange: null,
    async deleteProject(projectId) {
      for (const s of STORES) {
        if (s === 'projects' || s === 'tomb') continue;
        const items = await this.byProject(s, projectId);
        for (const it of items) await this.del(s, it.id);
      }
      await this.del('projects', projectId);
    },
  };
})();

// Cache des URLs d'images (Blob -> objectURL)
const BlobURL = (() => {
  const cache = new Map();
  return {
    get(id, blob) {
      if (!blob) return '';
      if (!cache.has(id)) cache.set(id, URL.createObjectURL(blob));
      return cache.get(id);
    },
    drop(id) { if (cache.has(id)) { URL.revokeObjectURL(cache.get(id)); cache.delete(id); } },
  };
})();
