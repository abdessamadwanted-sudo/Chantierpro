// Lecture DWG en arrière-plan (LibreDWG wasm) : l'appli ne se fige pas, et on peut arrêter un fichier trop long
import { LibreDwg, Dwg_File_Type } from '../vendor/dwg/dist/libredwg-web.js';
let lib = null;
self.onmessage = async (ev) => {
  try {
    lib = lib || await LibreDwg.create(new URL('../vendor/dwg/wasm', import.meta.url).href);
    const d = lib.dwg_read_data(ev.data, Dwg_File_Type.DWG);
    if (!d) throw new Error('Fichier DWG illisible');
    const db = lib.convert(d);
    try { lib.dwg_free(d); } catch (e) {}
    delete db.thumbnailImage;
    for (const b of (db.tables.BLOCK_RECORD || {}).entries || []) delete b.bmpPreview;
    self.postMessage({ ok: true, db });
  } catch (e) { self.postMessage({ ok: false, err: String((e && e.message) || e) }); }
};
