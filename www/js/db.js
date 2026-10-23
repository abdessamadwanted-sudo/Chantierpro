// Stockage local (IndexedDB) — tout reste sur le téléphone, fonctionne sans internet.
const DB = (() => {
  const NAME = 'chantier';
  const VERSION = 4;
  const STORES = ['projects', 'folders', 'plans', 'tasks', 'links', 'files', 'forms', 'reports', 'receptions', 'items', 'tomb'];  // tomb = suppressions à synchroniser
  let dbp = null;
  // Erreurs passagères de connexion (connexion fermée par le système, transaction inactive) : on rouvre et on réessaie.
  // Jamais pour un manque d'espace (QuotaExceededError) ni une donnée invalide (DataError, DataCloneError…).
  const RETRY = new Set(['InvalidStateError', 'TransactionInactiveError', 'UnknownError']);

  function open() {
    if (dbp) return dbp;
    const mine = dbp = new Promise((resolve, reject) => {
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
      req.onsuccess = () => {
        const db = req.result;
        // le système (ou une autre version de l'app) peut fermer la connexion : la prochaine opération en rouvrira une
        db.onclose = () => { if (dbp === mine) dbp = null; };
        db.onversionchange = () => { try { db.close(); } catch (e) {} if (dbp === mine) dbp = null; };
        resolve(db);
      };
      req.onerror = () => { if (dbp === mine) dbp = null; reject(req.error); };
    });
    return mine;
  }
  function reset() { const p = dbp; dbp = null; if (p) p.then((db) => { try { db.close(); } catch (e) {} }, () => {}); }

  // Exécute une requête dans sa propre transaction et ne rend la main qu'à la fin de la transaction
  // (« complete ») : une écriture n'est considérée faite que lorsqu'elle est réellement enregistrée.
  async function run(store, mode, fn) {
    for (let attempt = 0; ; attempt++) {
      try {
        const db = await open();
        return await new Promise((resolve, reject) => {
          const t = db.transaction(store, mode);
          const req = fn(t.objectStore(store));
          let result;
          if (req) req.onsuccess = () => { result = req.result; };
          t.oncomplete = () => resolve(result);
          t.onerror = () => reject(t.error || (req && req.error));
          t.onabort = () => reject(t.error || (req && req.error) || new DOMException('Transaction annulée', 'AbortError'));
        });
      } catch (e) {
        if (attempt < 2 && e && RETRY.has(e.name)) { reset(); await new Promise((r) => setTimeout(r, 200 * (attempt + 1))); continue; }
        throw e;
      }
    }
  }

  let chT = null;
  function changed(store) { if (store === 'tomb') return; clearTimeout(chT); chT = setTimeout(() => { try { DB.onChange && DB.onChange(store); } catch (e) {} }, 50); }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  return {
    uid,
    async get(store, id) { return run(store, 'readonly', (os) => os.get(id)); },
    async all(store) { return run(store, 'readonly', (os) => os.getAll()); },
    async byProject(store, projectId) { return run(store, 'readonly', (os) => os.index('projectId').getAll(projectId)); },
    async put(store, obj) {
      if (!obj.id) obj.id = uid();
      if (!obj.createdAt) obj.createdAt = Date.now();
      obj.updatedAt = Date.now();
      await run(store, 'readwrite', (os) => os.put(obj));
      changed(store);
      return obj;
    },
    async del(store, id) {
      const old = await this.get(store, id);
      await run(store, 'readwrite', (os) => os.delete(id));
      if (old && store !== 'tomb') {
        await run('tomb', 'readwrite', (os) => os.put({ id: store + ':' + id, store, rid: id, projectId: old.projectId || (store === 'projects' ? id : null), kind: old.kind || null, driveId: old.driveId || null, at: Date.now() }));
        changed(store);
      }
    },
    // utilisés par la synchronisation (ne déclenchent pas de nouvel envoi)
    async putRaw(store, obj) { await run(store, 'readwrite', (os) => os.put(obj)); return obj; },
    async delRaw(store, id) { return run(store, 'readwrite', (os) => os.delete(id)); },
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
