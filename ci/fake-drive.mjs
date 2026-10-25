// Faux Google Drive (API v3) pour tester la connexion Google directe sans compte réel.
// Branché sur un contexte Playwright : ctx.route('https://www.googleapis.com/**', drive.handle)
export function fakeDrive() {
  const files = new Map(); let n = 0; const log = []; let fail401 = new Set();
  const FOLDER = 'application/vnd.google-apps.folder';
  const mk = (o) => { const id = 'f' + (++n); const f = { id, name: o.name, mimeType: o.mimeType || 'application/octet-stream', parents: o.parents && o.parents.length ? o.parents.map(p => p === 'root' ? 'ROOT' : p) : ['ROOT'], trashed: false, data: o.data || Buffer.alloc(0), version: 1, createdTime: new Date(Date.now() + n).toISOString() }; files.set(id, f); return f; };
  const pick = (f, fields) => { const o = {}; for (const k of (fields || 'id').split(',')) if (k in f && k !== 'data') o[k] = f[k]; if (o.version !== undefined) o.version = String(o.version); return o; };
  function matchQ(f, q) {
    if (/trashed=false/.test(q) && f.trashed) return false;
    let m = q.match(/name='((?:[^'\\]|\\.)*)'/); if (m && f.name !== m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\')) return false;
    m = q.match(/'([^']+)' in parents/); if (m && !f.parents.includes(m[1] === 'root' ? 'ROOT' : m[1])) return false;
    m = q.match(/mimeType='([^']+)'/); if (m && f.mimeType !== m[1]) return false;
    return true;
  }
  function parseMultipart(buf, ct) {
    const b = '--' + ct.match(/boundary=(.+)$/)[1]; const s = buf.toString('latin1');
    const parts = s.split(b).slice(1, -1).map(p => { const i = p.indexOf('\r\n\r\n'); return { head: p.slice(0, i), body: Buffer.from(p.slice(i + 4, p.length - 2), 'latin1') }; });
    return { meta: JSON.parse(parts[0].body.toString('utf8')), data: parts[1].body, type: (parts[1].head.match(/Content-Type: ([^\r\n]+)/i) || [])[1] };
  }
  const sessions = new Map();
  async function handle(route) {
    const r = route.request(), u = new URL(r.url()), meth = r.method(), auth = r.headers()['authorization'] || '';
    const body = (s, o, h = {}) => route.fulfill({ status: s, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Location', ...h }, contentType: 'application/json', body: typeof o === 'string' ? o : JSON.stringify(o) });
    if (meth === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Upload-Content-Type, X-Upload-Content-Length', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': 'Location' } });
    const tk = auth.replace('Bearer ', '');
    log.push(meth + ' ' + u.pathname + (u.searchParams.get('uploadType') ? '?' + u.searchParams.get('uploadType') : ''));
    if (fail401.has(tk)) return body(401, { error: { message: 'Invalid Credentials' } });
    if (!tk) return body(401, { error: { message: 'no token' } });
    const p = u.pathname, fields = (u.searchParams.get('fields') || 'id').replace(/^nextPageToken,files\((.*)\)$/, '$1');
    if (p === '/drive/v3/about') return body(200, { user: { emailAddress: 'hamid@gmail.com' } });
    if (p === '/drive/v3/files' && meth === 'GET') { const q = u.searchParams.get('q') || ''; return body(200, { files: [...files.values()].filter(f => matchQ(f, q)).map(f => pick(f, fields)) }); }
    if (p === '/drive/v3/files' && meth === 'POST') { const m = JSON.parse(r.postData() || '{}'); return body(200, pick(mk(m), fields)); }
    if (p === '/upload/drive/v3/files' && meth === 'POST') {
      const t = u.searchParams.get('uploadType');
      if (t === 'multipart') { const mp = parseMultipart(r.postDataBuffer(), r.headers()['content-type']); const f = mk({ ...mp.meta, data: mp.data }); if (u.searchParams.get('ocrLanguage')) f.data = Buffer.from('PV de réception\nVoile V12 conforme'); return body(200, pick(f, fields)); }
      if (t === 'resumable') { const sid = 's' + (++n); sessions.set(sid, JSON.parse(r.postData() || '{}')); return body(200, {}, { Location: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=' + sid }); }
    }
    if (p === '/upload/drive/v3/files' && meth === 'PUT') { const m = sessions.get(u.searchParams.get('upload_id')); const f = mk({ ...m, data: r.postDataBuffer() || Buffer.alloc(0) }); return body(200, pick(f, 'id,name')); }
    let m = p.match(/^\/(upload\/)?drive\/v3\/files\/([^/]+)(\/export)?$/);
    if (m) {
      const f = files.get(m[2]); if (!f) return body(404, { error: { message: 'File not found: ' + m[2] } });
      if (m[3]) return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'text/plain', body: f.data.toString('utf8') });
      if (meth === 'DELETE') { files.delete(f.id); return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' }); }
      if (meth === 'GET' && u.searchParams.get('alt') === 'media') return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: f.mimeType, body: f.data });
      if (meth === 'GET') return body(200, pick(f, fields));
      if (meth === 'PATCH' && m[1]) { f.data = r.postDataBuffer() || Buffer.alloc(0); f.version++; return body(200, pick(f, fields)); }
      if (meth === 'PATCH') {
        const o = JSON.parse(r.postData() || '{}'); if (o.name) f.name = o.name; if (o.trashed) f.trashed = true;
        const add = u.searchParams.get('addParents'), rm = u.searchParams.get('removeParents');
        if (rm) f.parents = f.parents.filter(x => !rm.split(',').includes(x)); if (add) f.parents.push(add);
        f.version++; return body(200, pick(f, fields));
      }
    }
    return body(400, { error: { message: 'faux Drive : ' + meth + ' ' + p } });
  }
  const pathOf = (f) => { const s = []; let c = f; while (c && c.parents[0] !== 'ROOT') { c = files.get(c.parents[0]); if (c) s.unshift(c.name); } return [...s, f.name].join('/'); };
  return { handle, files, log, fail401, tree: () => [...files.values()].filter(f => !f.trashed && f.mimeType !== FOLDER).map(f => pathOf(f) + ' (' + f.data.length + ')').sort() };
}
