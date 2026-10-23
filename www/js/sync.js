// Synchronisation Google Drive (téléphone ⇄ PC ⇄ autres appareils)
// Tout est envoyé dans « Mon Drive / SiteTeam / <Projet> / … » par un petit script Google (Apps Script)
// que l'utilisateur installe une seule fois dans son compte. Les données restent dans SON Drive.
const Sync = (() => {
  const DATA = ['projects', 'folders', 'plans', 'tasks', 'links', 'files', 'forms', 'reports', 'receptions', 'items'];
  const LS = {
    get(k, d = null) { try { const v = localStorage.getItem('sync.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('sync.' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('sync.' + k); } catch (e) {} },
  };
  const st = { state: 'off', msg: '', last: LS.get('last', 0) };
  let fails0 = [];
  let running = false, again = false, timer = null, autoT = null;

  const cfg = () => LS.get('cfg');
  const hasDrive = () => !!(cfg() && cfg().url && cfg().key);
  const teamOn = () => typeof Team !== 'undefined' && Team.ready();
  const enabled = () => hasDrive() || teamOn();

  // ---------- état (pastille) ----------
  function setStatus(state, msg = '') {
    st.state = state; st.msg = msg;
    let el = document.getElementById('syncPill');
    if (!el) { el = document.createElement('div'); el.id = 'syncPill'; document.body.appendChild(el); el.onclick = () => openSyncSettings(); }
    el.className = 'sync-pill ' + state;
    el.innerHTML = state === 'sync' ? `<span class="spin"></span>${esc(msg || 'Synchronisation…')}` : state === 'error' ? `⚠ ${esc(msg || 'Synchro impossible')}` : '';
    el.style.display = (state === 'sync' || state === 'error') ? 'flex' : 'none';
    document.querySelectorAll('[data-syncstate]').forEach(n => n.innerHTML = statusLine());
    document.querySelectorAll('.h2-cloud').forEach(n => { n.classList.remove('st-ok', 'st-sync', 'st-error'); n.classList.add('st-' + (state || 'ok')); });
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
  // Rangement Drive « pro » : un dossier par projet, sous-dossiers numérotés, un dossier par jour et par ouvrage.
  // Changer un chemin DÉPLACE le fichier dans Drive (jamais de doublon).
  const D = { plans: '01 - Plans', rec: '02 - Réception ferraillage', bet: '03 - Bétonnage', res: '04 - Réserves', rap: '05 - Rapports journaliers', form: '06 - Formulaires', cons: '07 - Constats', cl: '08 - Clauses techniques', doc: '09 - Documents', ph: '10 - Photos' };
  const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const moisDe = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})/); return m ? `${m[1]}-${m[2]} ${MOIS[+m[2] - 1]}` : 'Sans date'; };
  async function buildPaths() {
    const [projects, folders, plans, links, recs, tasks, forms, reports] = await Promise.all(['projects', 'folders', 'plans', 'links', 'receptions', 'tasks', 'forms', 'reports'].map(s => DB.all(s)));
    const P = Object.fromEntries(projects.map(p => [p.id, clean(p.name, 'Projet')]));
    const F = Object.fromEntries(folders.map(f => [f.id, clean(folderPath(f, folders, ' - '))]));
    const PL = Object.fromEntries(plans.map(p => [p.id, p]));
    const PR = Object.fromEntries(projects.map(p => [p.id, p]));
    const map = {};
    const put = (id, segs, name) => { if (id && !map[id]) map[id] = { segs: segs.map(s => clean(s)), name }; };
    const pj = (pid) => P[pid] || 'Projet';
    for (const pl of plans) {
      // plan actuel dans le dossier du niveau ; anciens indices rangés à part (jamais écrasés)
      const old = !!pl.supersededBy, ind = pl.indice ? ` (ind ${pl.indice})` : '';
      const base = old ? [pj(pl.projectId), D.plans, F[pl.folderId] || 'Sans dossier', 'Anciens indices'] : [pj(pl.projectId), D.plans, F[pl.folderId] || 'Sans dossier'];
      put(pl.pdfFileId, base, clean(pl.name.replace(/ - p\d+$/, '') + ind));
      put(pl.dxfFileId, base, clean(pl.name + ind));
      put(pl.dwgFileId, base, clean(pl.name + ind));
      put(pl.fileId, [...base, 'Aperçus'], clean(pl.name + ind));
    }
    for (const l of links) {
      const pl = PL[l.planId]; if (!pl) continue;
      const base = [pj(l.projectId), D.plans, F[pl.folderId] || 'Sans dossier', `${pl.name} - éléments`];
      const el = [...base, l.name || 'Élément'];
      put(l.fileId, base, clean(l.name));
      for (const it of l.items || []) if (it.fileId) put(it.fileId, [...el, it.cat || 'Documents'], clean(it.name || it.cat));
      for (const z of l.zones || []) for (const pt of z.parts || []) for (const dd of pt.docs || []) if (dd.fileId) put(dd.fileId, [...base, 'Plans par ouvrage', z.name, pt.name], clean(dd.name));
      for (const [k, docs] of Object.entries(l.recDocs || {})) for (const dd of docs) if (dd.fileId) put(dd.fileId, [...base, 'Plans par ouvrage', (l.recNames || {})[k] || 'Ouvrage'], clean(dd.name));
      (l.photos || []).forEach((id, i) => put(id, [...base, 'Photos et notes', l.name || 'Pin'], `${clean(l.name || 'Photo')} - ${i + 1}`));
      if (l.kind === 'local' && l.lots) { const pr = PR[l.projectId] || {}; for (const [lid, rr] of Object.entries(l.lots)) { const lot = (pr.lots || []).find(x => x.id === lid); (rr.photos || []).forEach((id, i) => put(id, [pj(l.projectId), '11 - Avancement', F[pl.folderId] || 'Sans dossier', lot ? lot.name : 'Lot', l.name || 'Local'], `${clean(l.name || 'Local')} - ${i + 1}`)); } }
      for (const n of l.notes || []) { const d = new Date(n.at).toISOString().slice(0, 10); (n.photos || []).forEach((id, i) => put(id, [...base, 'Photos et notes', l.name || 'Pin', 'Notes'], `Note ${d} - ${i + 1}`)); if (n.audio) put(n.audio, [...base, 'Photos et notes', l.name || 'Pin', 'Notes'], `Note vocale ${d}`); }
    }
    for (const d of recs) {
      const bet = d.type === 'Bétonnage';
      const base = [pj(d.projectId), bet ? D.bet : D.rec, moisDe(d.date), d.date || 'Sans date'];
      (d.pvIds || []).forEach((id, i) => put(id, [...base, 'PV', 'Pages photographiées'], `PV ${d.date} - page ${i + 1}`));
      if (d.pvPdfId) put(d.pvPdfId, [...base, 'PV'], `PV du ${d.date}`);   // un seul PDF par jour, remplacé quand on ajoute un PV
      for (const r of d.rows || []) {
        // <jour> / Ouvrages / <Zone · Niveau · Élément> / Photos | Anomalies | Réparations
        const nm = clean(`${r.zone ? 'Zone ' + r.zone + ' · ' : ''}${r.niv ? r.niv + ' · ' : ''}${r.element || 'Ouvrage'}`);
        const dir = [...base, 'Photos', nm];
        (r.photoIds || []).forEach((id, i) => put(id, dir, `${nm} - Photo ${i + 1}`));
        (r.anomIds || []).forEach((id, i) => put(id, [...dir, 'Anomalies'], `${nm} - ${bet ? 'Défaut' : 'Anomalie'} ${i + 1}`));
        (r.retourIds || []).forEach((id, i) => put(id, [...dir, 'Réparations'], `${nm} - Réparation ${i + 1}`));
        if (r.croquisId) put(r.croquisId, dir, `${nm} - Croquis`);
        if (r.pvGenId) put(r.pvGenId, [...base, 'PV', 'Fiches remplies (à signer)'], `Fiche - ${nm}`);
        for (const [tid, fid] of Object.entries(r.fiches || {})) { const t = ((PR[d.projectId] || {}).ficheTpls || []).find(x => x.id === tid); put(fid, [...base, 'PV', 'Fiches remplies (à signer)'], `${t ? t.name : 'Fiche'} - ${nm}`); }
        if (r.bon && r.bon.fileId) put(r.bon.fileId, [...base, 'Bons de bétonnage'], `Bon - ${nm}`);
      }
    }
    for (const pr of projects) { for (const b of pr.bons || []) if (b.fileId) put(b.fileId, [pj(pr.id), D.bet, 'Bons libres', b.date || ''], clean(`Bon - ${b.ouvrage || ''} ${b.partie || ''}`)); const bc = pr.bon || {}; for (const L of Object.values(bc.people || {})) for (const q of L) if (q.sigId) put(q.sigId, [pj(pr.id), D.bet, 'Signatures'], clean(`Signature ${q.name}`)); }
    for (const pr of projects) if (pr.pvTpl) put(pr.pvTpl, [pj(pr.id), D.doc, 'Modèles'], 'Modèle fiche de contrôle');
    for (const pr of projects) for (const t of pr.ficheTpls || []) put(t.fileId, [pj(pr.id), D.doc, 'Modèles'], `Modèle ${t.name}`);
    for (const pr of projects) for (const c of pr.clauses || []) put(c.fileId, [pj(pr.id), D.cl, c.type || 'Autre'], clean(c.name));
    for (const pr of projects) for (const c of pr.constats || []) (c.items || []).forEach((it, k) => (it.photoIds || []).forEach((id, i) => put(id, [pj(pr.id), D.cons, `${c.date || ''} ${c.title || 'Constat'}`], `${k + 1}-${i + 1} ${it.probleme || 'photo'}`.slice(0, 80))));
    for (const t of tasks) (t.photoIds || []).forEach((id, i) => put(id, [pj(t.projectId), D.res, `#${t.num || ''} ${t.title || ''}`], `#${t.num || ''} - ${i + 1}`));
    for (const f of forms) (f.photoIds || []).forEach((id, i) => put(id, [pj(f.projectId), D.form, `${(f.date || '').slice(0, 10)} ${f.title || ''}`], `photo ${i + 1}`));
    for (const r of reports) (r.photoIds || []).forEach((id, i) => put(id, [pj(r.projectId), D.rap, moisDe(r.date), r.date || ''], `photo ${i + 1}`));
    return { map, P };
  }
  function pathFor(f, paths) {
    if (f.projectId === '__career') return { segs: ['Mon dossier de candidature'], name: clean(`${f.cat || 'Document'} - ${String(f.name || f.id).replace(/\.\w{2,5}$/, '')}`) + extOf(f) };
    const m = paths.map[f.id];
    const ext = extOf(f);
    if (m) return { segs: m.segs, name: m.name + ext };
    const day = new Date(f.createdAt || Date.now()).toISOString().slice(0, 10);
    const base = (f.name || f.id).replace(/\.\w{2,5}$/, '');
    return { segs: [paths.P[f.projectId] || 'Projet', f.role === 'doc' ? D.doc : D.ph, moisDe(day)], name: clean(base) + ext };
  }
  const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  const fromB64 = (s, type) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); };

  // exécute fn sur la liste avec N envois en parallèle (plus rapide qu'un par un)
  async function pool(list, n, fn) { let i = 0; await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const k = i++; await fn(list[k], k); } })); }

  // ---------- espace sur le téléphone ----------
  // keep : 'all' = tout garder · 'plans' = plans + photos des 7 derniers jours · 'min' = seulement les plans · 'cloud' = rien (tout dans Drive)
  const keepMode = () => LS.get('keep', 'plans');
  const isPlan = (f) => f.role === 'plan' || f.role === 'plansrc';
  function wantLocal(f, mode = keepMode()) {
    if (f.role === 'sig') return true;
    if (f.freed) return !!(f.lastUsed && Date.now() - f.lastUsed < 2 * 864e5);   // libérée volontairement : reste dans Drive
    if (mode === 'all') return true;
    if (f.role === 'croquis') return true;                                   // petits
    if (f.lastUsed && Date.now() - f.lastUsed < 2 * 864e5) return true;      // ouvert récemment
    if (isPlan(f)) return mode !== 'cloud';
    if (mode === 'plans') return Date.now() - (f.createdAt || 0) < 7 * 864e5;
    return false;
  }
  async function freeSpace() {
    if (!hasDrive()) return 0;
    let freed = 0;
    for (const f of await DB.all('files')) {
      if (f.blob && f.driveId && f.drivePath && !wantLocal(f)) { freed += f.blob.size || 0; f.blob = null; BlobURL.drop(f.id); await DB.putRaw('files', f); }
    }
    return freed;
  }
  const pending = new Map();
  async function fetchBlob(f) {                                               // téléchargement à la demande depuis Drive
    if (!f || f.blob || !f.driveId || !hasDrive()) return f;
    if (!pending.has(f.id)) pending.set(f.id, (async () => {
      try { const d = await call('download', { id: f.driveId }); f.blob = fromB64(d.b64, f.mime || d.mime); f.lastUsed = Date.now(); await DB.putRaw('files', f); }
      catch (e) { console.warn('fetch', e); }
      finally { pending.delete(f.id); }
      return f;
    })());
    return pending.get(f.id);
  }
  // DB.get / DB.byProject sur « files » : si le fichier n'est plus sur le téléphone, on le reprend dans Drive
  const _get = DB.get.bind(DB), _byP = DB.byProject.bind(DB);
  DB.get = async (store, id) => { const r = await _get(store, id); if (store === 'files' && r && !r.blob && r.driveId) { await fetchBlob(r); } return r; };
  DB.byProject = async (store, pid) => { const l = await _byP(store, pid); if (store === 'files') await pool(l.filter(f => !f.blob && f.driveId && !f.freed).slice(0, 40), 4, fetchBlob); return l; };
  DB.peek = (store, id) => _get(store, id);   // lecture sans téléchargement depuis Drive
  async function usage() { let local = 0, n = 0, cloud = 0; for (const f of await DB.all('files')) { if (f.blob) { local += f.blob.size || 0; n++; } else if (f.driveId) cloud++; } return { local, n, cloud }; }

  // ---------- synchronisation ----------
  async function run({ quiet = false, force = false } = {}) {
    if (!enabled()) return;
    if (running) { again = true; return; }
    if (navigator.onLine === false) { setStatus('error', 'Hors connexion'); return; }
    running = true; again = false;
    let pulledCount = 0; const fails = []; fails0 = fails;
    try {
      setStatus('sync', 'Synchronisation…');
      // 1) envoyer les fichiers (photos, plans, PDF…) dans des dossiers rangés
      const paths = await buildPaths();
      const files = await DB.all('files');
      const todo = !hasDrive() ? [] : files.filter(f => (f.blob && (!f.driveId || f.drivePath !== JSON.stringify(pathFor(f, paths)))) || (!f.blob && f.driveId && f.drivePath && f.drivePath !== JSON.stringify(pathFor(f, paths))));
      let i = 0;
      await pool(todo, 3, async (f) => {
        const pth = pathFor(f, paths), key = JSON.stringify(pth);
        let res = null;
        try {
          if (f.driveId) { try { res = await call('upload', { driveId: f.driveId, path: pth.segs, name: pth.name }); } catch (e) { res = null; } }
          if (!res && !f.blob) return;
          if (!res) res = await call('upload', { path: pth.segs, name: pth.name, mime: f.mime || f.blob.type, b64: await b64(f.blob) });
          f.driveId = res.id; f.drivePath = key;
          await DB.put('files', f);
        } catch (e) { fails.push(`${pth.name} : ${e.message || e}`); }
        finally { i++; setStatus('sync', `Envoi vers Drive ${i}/${todo.length}`); }
      });
      // 2) envoyer les données modifiées (tableaux, pins, tâches…)
      const since = LS.get('pushAt', 0), start = Date.now();
      const out = [];
      for (const s of DATA) for (const r of await DB.all(s)) if ((r.updatedAt || 0) > since) { const { blob, ...rest } = r; out.push({ ...rest, _store: s }); }
      for (const t of await DB.all('tomb')) if (t.at > since) out.push({ _store: t.store, id: t.rid, projectId: t.projectId, kind: t.kind, driveId: t.driveId, _deleted: true, updatedAt: t.at });
      if (teamOn()) {
        setStatus('sync', `Envoi des données (${out.length})`);
        await Team.push(out);
        // suppression des fichiers correspondants dans le Drive de l'entreprise
        const del = out.filter(r => r._deleted && r.driveId);
        if (del.length && hasDrive()) { try { await call('push', { records: del }); } catch (e) { console.warn('drive del', e); } }
      } else for (let k = 0; k < out.length; k += 150) { setStatus('sync', `Envoi des données ${Math.min(k + 150, out.length)}/${out.length}`); await call('push', { records: out.slice(k, k + 150) }); }
      LS.set('pushAt', start);
      // 3) recevoir les changements des autres appareils
      setStatus('sync', 'Réception…');
      const pull = teamOn() ? await Team.pull() : await call('pull', { since: LS.get('pullAt', 0) });
      let pullFails = 0;
      for (const r of pull.records || []) {
        const store = r._store; if (!DATA.includes(store)) continue;
        const { _store, _srv, _deleted, ...rec } = r;
        try {
          const local = await _get(store, rec.id);   // sans téléchargement automatique
          if (_deleted) { if (local && (local.updatedAt || 0) <= (r.updatedAt || 0)) { await DB.delRaw(store, rec.id); BlobURL.drop(rec.id); pulledCount++; } continue; }
          if (local && (local.updatedAt || 0) >= (rec.updatedAt || 0)) continue;
          if (store === 'files' && local && local.blob && local.driveId === rec.driveId) rec.blob = local.blob;
          await DB.putRaw(store, rec); pulledCount++;
        } catch (e) {
          // un enregistrement non sauvegardé ne bloque pas les autres ; le repère de réception n'avance pas → il sera repris
          pullFails++; console.warn('pull', store, rec.id, e);
          if (e && e.name === 'QuotaExceededError') { fails.push('Mémoire du téléphone pleine : données reçues non enregistrées'); break; }
        }
      }
      if (pullFails) fails.push(`${pullFails} élément(s) reçu(s) non enregistré(s) — nouvel essai à la prochaine synchro`);
      else if (pull.commit) pull.commit(); else LS.set('pullAt', pull.now);
      // 4) télécharger les fichiers manquants (plans d'abord)
      const missing = !hasDrive() ? [] : (await DB.all('files')).filter(f => f.driveId && !f.blob && wantLocal(f)).sort((a, b) => (b.role === 'plan') - (a.role === 'plan'));
      let j = 0;
      await pool(missing, 4, async (f) => {
        try { const d = await call('download', { id: f.driveId }); f.blob = fromB64(d.b64, f.mime || d.mime); await DB.putRaw('files', f); pulledCount++; }
        catch (e) { console.warn('download', f.id, e); }
        finally { j++; setStatus('sync', `Téléchargement ${j}/${missing.length}`); }
      });
      // 4b) libérer l'espace du téléphone (fichiers déjà dans Drive)
      await freeSpace();
      // 5) documents lisibles dans Drive (PDF des tableaux, réserves, rapports)
      if (hasDrive() && (force || Date.now() - LS.get('docsAt', 0) > 600000)) { await syncDocs(); LS.set('docsAt', Date.now()); }
      st.last = Date.now(); LS.set('last', st.last);
      if (Date.now() - LS.get('chkAt', 0) > 7 * 864e5) weeklyCheck().catch(e => console.warn('check', e));
      LS.set('fails', fails.slice(0, 20));
      if (fails.length) setStatus('error', `${fails.length} problème(s) de synchro — touchez pour voir`); else setStatus('ok');
      if (pulledCount) {
        if (!quiet) toast(`☁ ${pulledCount} mise(s) à jour reçue(s)`);
        // rafraîchir l'écran si aucune fenêtre n'est ouverte
        if (!document.querySelector('.sheet-bg, .fullpage, .viewer')) { try { App.project ? (App.project = await DB.get('projects', App.project.id) || App.project, renderSection()) : renderHome(); } catch (e) {} }
      }
    } catch (e) {
      console.error('sync', e); LS.set('fails', [String(e.message || e)]); setStatus('error', String(e.message || e).slice(0, 80));
    } finally {
      running = false;
      if (again) schedule(1500);
    }
  }
  // ---------- contrôle hebdomadaire : tout est-il bien dans Drive ? ----------
  const SCRIPT_VER = 3;
  async function scriptVer() { const c = cfg(); if (!c) return 0; try { const r = await call('ping', {}); c.ver = r.ver || 1; LS.set('cfg', c); return c.ver; } catch (e) { return c.ver || 0; } }
  async function weeklyCheck(manual) {
    if ((await scriptVer()) < SCRIPT_VER) { LS.set('chkAt', Date.now()); if (manual) alertBox('Mettez d\'abord à jour le script Google (Synchronisation › « Mettre à jour le script »).'); return null; }
    const files = (await DB.all('files')).filter(f => f.driveId), miss = [];
    for (let i = 0; i < files.length; i += 150) { const r = await call('check', { ids: files.slice(i, i + 150).map(f => f.driveId) }); miss.push(...(r.missing || [])); }
    let fixed = 0, lost = 0;
    for (const f of files) if (miss.includes(f.driveId)) { if (f.blob) { f.driveId = null; f.drivePath = null; await DB.putRaw('files', f); fixed++; } else lost++; }
    const res = { at: Date.now(), n: files.length, fixed, lost }; LS.set('chk', res); LS.set('chkAt', Date.now());
    if (fixed) schedule(1000);
    if (manual || fixed || lost) toast(fixed || lost ? `☁ Contrôle Drive : ${fixed} fichier(s) renvoyé(s)${lost ? ` · ${lost} introuvable(s)` : ''}` : `☁ Contrôle Drive ✓ : ${files.length} fichiers bien rangés`, { ms: 4000 });
    return res;
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
        const files = []; for (const r of d.rows) files.push(...(r.photoIds || []), ...(r.retourIds || []), r.croquisId || ''); files.push(...(d.pvIds || []));
        jobs.push({ key: 'rec:' + d.id, sig: 'v2|' + hash([d, p.pdfTitle, files.length]), segs: [pn, bet ? D.bet : D.rec, moisDe(d.date), d.date || 'Sans date', 'Programme de réception'], name: `${bet ? 'Programme de bétonnage' : 'Programme de réception'} ${d.date}.pdf`, make: () => receptionPdf(p, d) });
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
        const out = await capturePdf(j.make); if (!out) { fails0.push(`${j.name} : PDF non créé`); continue; }
        let res; try { res = await call('upload', { path: j.segs, name: j.name, mime: 'application/pdf', b64: await b64(out.blob) }); } catch (e) { fails0.push(`${j.name} : ${e.message || e}`); continue; }
        const old = docs[j.key] && docs[j.key].id;
        if (old && old !== res.id) await call('push', { records: [{ _store: 'gen', id: j.key + ':' + Date.now(), driveId: old, _deleted: true, updatedAt: Date.now() }] });
        docs[j.key] = { id: res.id, sig: j.sig }; dirty = true;
      }
      // documents dont la source a été supprimée
      for (const k of Object.keys(docs)) if (!jobs.some(j => j.key === k)) {
        await call('push', { records: [{ _store: 'gen', id: k + ':' + Date.now(), driveId: docs[k].id, _deleted: true, updatedAt: Date.now() }] });
        delete docs[k]; dirty = true;
      }
      if (dirty) { const cur = await _get('projects', p.id); if (cur) { cur.driveDocs = docs; await DB.put('projects', cur); } }
    }
  }

  function schedule(ms = 4000) { if (!enabled()) return; clearTimeout(timer); timer = setTimeout(() => run(), ms); }

  function start() {
    DB.onChange = (s) => { schedule(); if (typeof licOnChange === 'function') licOnChange(s); };
    if (!enabled()) return;
    setStatus('ok');
    setTimeout(() => (window.requestIdleCallback || setTimeout)(() => run({ quiet: true }), { timeout: 3000 }), 2500);
    clearInterval(autoT); autoT = setInterval(() => { if (document.visibilityState === 'visible') run({ quiet: false }); }, 120000);
    if (start.done) return; start.done = true;
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
    if (typeof licIsOwnerScript === 'function' && await licIsOwnerScript(c.url)) throw new Error('Ce Google Drive appartient au titulaire de la licence. Connectez VOTRE propre compte Google (onglet « Première fois »).');
    LS.set('cfg', c);
    try { const r = await call('ping', { code: codeOf(c) }); if (r.app !== 'siteteam') throw new Error('Ce code est celui de l\'application Chantier. Pour ne pas mélanger les données, SiteTeam utilise son propre script : onglet « Première fois ». (Pour récupérer les projets de Chantier : Mon entreprise › Réglages › Importer.)'); c.folder = r.folder; c.ver = r.ver || 1; LS.set('cfg', c); }
    catch (e) { LS.del('cfg'); throw e; }
    // première synchro complète
    LS.set('pushAt', 0); LS.set('pullAt', 0);
    start(); await run();
    return c;
  }
  function disconnect() { LS.del('cfg'); LS.del('pushAt'); LS.del('pullAt'); clearInterval(autoT); setStatus('off'); }

  function script(key) {
    return `// SiteTeam → Google Drive (synchronisation téléphone / PC)
// Collez ce code dans script.google.com puis : Déployer → Nouveau déploiement → Application Web
// Exécuter en tant que : Moi · Accès : Tout le monde
const KEY = '${key}';
const ROOT_NAME = 'SiteTeam';
const VER = 3;

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return out({ ok: true, app: 'siteteam' }); }
function root_() {
  const pr = PropertiesService.getScriptProperties(); const id = pr.getProperty('ROOT');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const it = DriveApp.getFoldersByName(ROOT_NAME); const f = it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_NAME);
  pr.setProperty('ROOT', f.getId()); return f;
}
// un seul dossier par nom : les doublons sont fusionnés dans le premier (fichiers et sous-dossiers déplacés)
function merge_(keep, dup) {
  const fi = dup.getFiles(); while (fi.hasNext()) { const x = fi.next(); if (x.getName() === 'db.json' && keep.getFilesByName('db.json').hasNext()) x.setTrashed(true); else x.moveTo(keep); }   // la base utilisée reste celle du premier dossier
  const fo = dup.getFolders(); while (fo.hasNext()) { const c = fo.next(), same = keep.getFoldersByName(c.getName()); if (same.hasNext()) merge_(same.next(), c); else c.moveTo(keep); }
  dup.setTrashed(true);
}
function sub_(parent, name) {
  const it = parent.getFoldersByName(name); if (!it.hasNext()) return parent.createFolder(name);
  const f = it.next(); while (it.hasNext()) merge_(f, it.next()); return f;
}
function dedupe_(f, n) { const seen = {}, it = f.getFolders(), list = []; while (it.hasNext()) list.push(it.next());
  list.forEach(function (c) { const k = c.getName(); if (seen[k]) { merge_(seen[k], c); n.n++; } else seen[k] = c; });
  for (const k in seen) dedupe_(seen[k], n); return n; }
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
      return out({ ok: true, app: 'siteteam', folder: r.getUrl(), now: Date.now(), ver: VER });
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
    if (d.action === 'dedupe') { lock.waitLock(30000); const n = dedupe_(root_(), { n: 0 }); return out({ ok: true, merged: n.n }); }
    if (d.action === 'check') { const miss = []; (d.ids || []).forEach(function (id) { try { if (DriveApp.getFileById(id).isTrashed()) miss.push(id); } catch (e) { miss.push(id); } }); return out({ ok: true, missing: miss }); }
    if (d.action === 'upload') {
      lock.waitLock(30000);
      const folder = path_(d.path); let f = null;
      if (d.driveId) { try { f = DriveApp.getFileById(d.driveId); if (f.isTrashed()) f = null; } catch (e) { f = null; } }
      if (f && !d.b64) { f.moveTo(folder); f.setName(d.name); return out({ ok: true, id: f.getId() }); }
      if (!d.b64) return out({ ok: false, error: 'missing' });
      const nf = folder.createFile(Utilities.newBlob(Utilities.base64Decode(d.b64), d.mime || 'application/octet-stream', d.name));
      return out({ ok: true, id: nf.getId() });
    }
    if (d.action === 'ocr') {   // lecture d'une photo (OCR de Google Drive) → texte
      const blob = Utilities.newBlob(Utilities.base64Decode(d.b64), d.mime || 'image/jpeg', 'pv.jpg'), tok = ScriptApp.getOAuthToken(), bd = 'chantierOcr' + Date.now();
      const head = Utilities.newBlob('--' + bd + '\\r\\nContent-Type: application/json; charset=UTF-8\\r\\n\\r\\n' + JSON.stringify({ title: 'ocr-tmp', mimeType: 'application/vnd.google-apps.document' }) + '\\r\\n--' + bd + '\\r\\nContent-Type: ' + blob.getContentType() + '\\r\\n\\r\\n').getBytes();
      const tail = Utilities.newBlob('\\r\\n--' + bd + '--').getBytes();
      const r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&ocr=true&ocrLanguage=fr', { method: 'post', contentType: 'multipart/related; boundary=' + bd, payload: head.concat(blob.getBytes()).concat(tail), headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true });
      const id = JSON.parse(r.getContentText()).id; if (!id) return out({ ok: false, error: r.getContentText().slice(0, 200) });
      const t = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '/export?mimeType=text/plain', { headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true }).getContentText();
      try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {}
      return out({ ok: true, text: t });
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
        <div class="muted" style="font-size:13.5px;line-height:1.55">Tout est rangé dans <b>Mon Drive › SiteTeam › (projet)</b> : Plans par niveau, Réception ferraillage et Programme de bétonnage par mois et par jour (Réserves, Retours, PV du jour), Réserves, Photos…<br>La synchro se fait toute seule (après chaque modification, à l'ouverture et toutes les 2 minutes).</div>
        <div class="sync-diag" data-syncdiag>…</div>
        <div class="keep-box"><div class="fld">Garder sur le téléphone</div>
          <select data-keep>
            <option value="all">Tout (plus d'espace utilisé)</option>
            <option value="plans">Plans + photos des 7 derniers jours (conseillé)</option>
            <option value="min">Seulement les plans</option>
            <option value="cloud">Rien — tout reste dans Drive (internet nécessaire)</option>
          </select>
          <div class="keep-use" data-use>…</div>
          <button class="btn ghost small" data-a="free">${icon('trash')} Libérer de l'espace maintenant</button>
          <div class="muted" style="font-size:12.5px;line-height:1.5">Les fichiers libérés restent dans Drive et se téléchargent tout seuls quand vous les ouvrez.</div></div>
        <button class="btn" data-a="now">${icon('undo')} Synchroniser maintenant</button>
        ${c.folder ? `<button class="btn ghost" data-a="open">${icon('drive')} Ouvrir le dossier dans Drive</button>` : ''}
        <button class="btn ghost" data-a="code">${icon('phone')} Copier le code de connexion (PC / autre téléphone)</button>
        <div class="sync-upd" data-upd></div>
        <button class="btn ghost" data-a="dedupe">🧹 Fusionner les dossiers en double dans Drive</button>
        <button class="btn ghost" data-a="check">🔎 Vérifier que tout est dans Drive${LS.get('chk') ? ` <small style="opacity:.7">· ${new Date(LS.get('chk').at).toLocaleDateString('fr-FR')}</small>` : ''}</button>
        <button class="btn ghost" data-a="script">${icon('file')} Copier le code du script</button>
        <button class="btn danger" data-a="off">Déconnecter cet appareil</button>
      </div>`, { title: 'Synchronisation Google Drive' });
      $('[data-a=now]', s.el).onclick = async () => { await run({ force: true }); diag(); };
      async function diag() {
        const files = await DB.all('files'), projects = await DB.all('projects'), recs = await DB.all('receptions');
        const withBlob = files.filter(f => f.blob), sent = withBlob.filter(f => f.driveId).length;
        const nDocs = projects.reduce((a, p) => a + Object.keys(p.driveDocs || {}).length, 0);
        const fl = LS.get('fails', []);
        const el = $('[data-syncdiag]', s.el); if (!el) return;
        el.innerHTML = `<div>📁 Compte Google : celui qui a autorisé le script</div>
          <div>📷 Fichiers envoyés : <b>${sent} / ${withBlob.length}</b></div>
          <div>📄 PDF créés dans Drive : <b>${nDocs}</b> · Tableaux réception/bétonnage : <b>${recs.length}</b></div>
          ${fl.length ? `<div style="color:#ef4444;margin-top:6px"><b>Erreurs :</b><br>${fl.map(esc).join('<br>')}</div>` : '<div style="color:#22c55e">Aucune erreur</div>'}`;
      }
      diag();
      const mb = (b) => (b / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Mo';
      const showUse = async () => { const u = await usage(); const e = $('[data-use]', s.el); if (e) e.innerHTML = `📱 Sur le téléphone : <b>${mb(u.local)}</b> (${u.n} fichiers) · ☁ seulement dans Drive : <b>${u.cloud}</b>`; };
      const ks = $('[data-keep]', s.el); ks.value = keepMode();
      ks.onchange = async () => { LS.set('keep', ks.value); const fr = await freeSpace(); showUse(); toast(fr ? `${mb(fr)} libérés ✓` : 'Enregistré ✓'); };
      $('[data-a=free]', s.el).onclick = async () => { const ld = loading('Libération…'); const fr = await freeSpace(); ld.close(); showUse(); toast(fr ? `${mb(fr)} libérés ✓` : 'Rien à libérer (fichiers pas encore envoyés ?)'); };
      showUse();
      const o = $('[data-a=open]', s.el); if (o) o.onclick = () => openUrl(c.folder);
      $('[data-a=code]', s.el).onclick = () => copy(codeOf(c));
      $('[data-a=script]', s.el).onclick = () => copy(script(c.key));
      scriptVer().then(v => { const u = $('[data-upd]', s.el); if (!u || v >= SCRIPT_VER) return;
        u.innerHTML = `<div class="sync-warn"><b>⚠️ Mettre à jour le script Google (une fois)</b><br>Nécessaire pour fusionner les dossiers en double et ne plus en créer.<br><b>1.</b> Copiez le nouveau code ci-dessous.<br><b>2.</b> Sur script.google.com, ouvrez votre projet « SiteTeam », effacez tout et collez.<br><b>3.</b> <b>Déployer → Gérer les déploiements → ✏️ Modifier → Version : Nouvelle version → Déployer</b> (le lien reste le même).</div><button class="btn small" data-a="copy3">${icon('file')} Copier le nouveau code</button>`;
        $('[data-a=copy3]', u).onclick = () => copy(script(c.key)); });
      $('[data-a=dedupe]', s.el).onclick = async () => { if ((await scriptVer()) < SCRIPT_VER) return alertBox('Mettez d\'abord à jour le script Google (encadré ci-dessus).'); const ld = loading('Fusion des dossiers en double…'); try { const r = await call('dedupe', {}); toast(r.merged ? `${r.merged} dossier(s) en double fusionné(s) ✓` : 'Aucun dossier en double ✓'); } catch (e) { alertBox(String(e.message || e)); } finally { ld.close(); } };
      $('[data-a=check]', s.el).onclick = async () => { const ld = loading('Vérification dans Drive…'); try { await weeklyCheck(true); } catch (e) { alertBox(String(e.message || e)); } finally { ld.close(); } };
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
        <div class="muted steps">Vous avez déjà connecté un autre appareil ? Collez ici le <b>code de connexion</b> (Paramètres › Google Drive › Copier le code de connexion), ou ouvrez le fichier <b>Code de connexion.txt</b> dans <b>Mon Drive › SiteTeam</b>.<br>Tous vos projets, plans, photos et tableaux seront récupérés.</div>
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

  return { start, run, schedule, enabled, hasDrive, disconnect, openSyncSettings, statusLine, cfg, buildPaths, pathFor, _call: call, _parse: parseCode, _script: script };
})();
