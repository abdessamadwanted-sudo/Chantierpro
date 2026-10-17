// ================= Fonctions affichées (par téléphone et par licence) + mises à jour de l'application =================

// ---------- Fonctions (modules) ----------
// Le propriétaire choisit, pour chaque licence, les fonctions visibles chez son ami (ex : retirer « Réception & bétonnage »).
// Chacun peut aussi masquer des fonctions sur son propre téléphone.
const FEATURES = [
  ['avancement', 'Avancement second œuvre (lots · niveaux · locaux)'],
  ['reception', 'Réception & bétonnage · PV à récupérer'],
  ['tasks', 'Réserves / Tâches'],
  ['photos', 'Photos'],
  ['forms', 'Formulaires QC'],
  ['reports', 'Rapports journaliers'],
  ['constat', 'Constats / NC'],
  ['clauses', 'Clauses techniques'],
  ['models3d', 'Modèles 3D / Maquette 3D'],
  ['calc', 'Calculs & Topo'],
  ['gestion', 'Gestion : stock, rendement, attachements / situations, labo'],
  ['planning', 'Planning (Gantt)'],
  ['reunions', 'Réunions de chantier (comptes rendus)'],
  ['rfi', 'RFI : demandes au BET / architecte'],
  ['visa', 'Visas des documents · bordereaux d\'envoi'],
  ['pointage', 'Pointage de la main d\'œuvre'],
  ['hse', 'HSE : sécurité, causeries, EPI, permis'],
  ['labo', 'Laboratoire : béton, slump, sols, essais'],
  ['finance', 'Financier · avenants & ordres de service'],
  ['tce', 'TCE (tous corps d\'état)'],
  ['st', 'Sous-traitants'],
  ['org', 'Organigramme & hiérarchie'],
  ['career', 'Emploi & carrière'],
];
// section du menu → fonction qui la commande (les sections absentes sont toujours visibles)
const SECTION_FEATURE = { reception: 'reception', beton: 'reception', avancement: 'avancement', tasks: 'tasks', photos: 'photos', forms: 'forms', reports: 'reports', constat: 'constat', clauses: 'clauses', models3d: 'models3d', maquette: 'models3d', calc: 'calc', gestion: 'gestion', planning: 'planning', reunions: 'reunions', rfi: 'rfi', visa: 'visa', pointage: 'pointage', hse: 'hse', labo: 'labo', finance: 'finance', avenants: 'finance', tce: 'tce', st: 'st', org: 'org' };

function myFeatures() { try { return JSON.parse(localStorage.getItem('myFeatures') || '{}') || {}; } catch (e) { return {}; } }
// fonction autorisée par la licence (l'ami ne peut pas la réactiver lui-même)
function featAllowed(k) { const L = (typeof Lic !== 'undefined' && Lic.get()) || {}; return !(L.mode === 'user' && L.features && L.features[k] === false); }
function featOn(k) { return featAllowed(k) && myFeatures()[k] !== false; }
function sectionOn(key) { const f = SECTION_FEATURE[key]; return !f || featOn(f); }

// choix des fonctions affichées sur ce téléphone
async function chooseMyFeatures() {
  const mine = myFeatures();
  for (;;) {
    const opts = FEATURES.filter(([k]) => featAllowed(k)).map(([k, l]) => ({ label: l, value: k, checked: mine[k] !== false }));
    const v = await menu('Fonctions affichées (touchez pour activer / masquer)', [...opts, { label: 'Terminé', icon: 'check', value: '__ok' }]);
    if (!v || v === '__ok') break;
    mine[v] = mine[v] === false ? true : false;
    try { localStorage.setItem('myFeatures', JSON.stringify(mine)); } catch (e) {}
  }
  if (App.project) renderSection(); else renderHome();
}

// éditeur des fonctions d'une licence (propriétaire) → renvoie l'objet features ou null
async function editLicFeatures(L) {
  const f = { ...(L.features || {}) };
  for (;;) {
    const v = await menu(`Fonctions de ${L.name || 'la licence'}`, [...FEATURES.map(([k, l]) => ({ label: l, value: k, checked: f[k] !== false })), { label: 'Enregistrer', icon: 'check', value: '__ok' }]);
    if (!v) return null;
    if (v === '__ok') return f;
    f[v] = f[v] === false ? true : false;
  }
}

// ---------- Mises à jour (sans désinstaller : même signature, les données restent) ----------
const UPD_API = 'https://api.github.com/repos/abdessamadwanted-sudo/Chantierpro/releases/latest';
const UPD_APK = 'https://github.com/abdessamadwanted-sudo/Chantierpro/releases/latest/download/Chantier.apk';
const verNum = (v) => String(v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
function verCmp(a, b) { const A = verNum(a), B = verNum(b); for (let i = 0; i < Math.max(A.length, B.length); i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d; } return 0; }

async function checkUpdate(manual = false) {
  const cur = typeof APP_VERSION === 'string' ? APP_VERSION : '';
  if (!/^\d+\.\d+\.\d+$/.test(cur)) { if (manual) alertBox('Version de développement : la mise à jour se fait depuis le téléphone.'); return; }
  if (!manual) { let last = 0; try { last = +localStorage.getItem('upd.at') || 0; } catch (e) {} if (Date.now() - last < 3 * 3600e3) return; }
  if (navigator.onLine === false) { if (manual) toast('Pas de connexion internet'); return; }
  const ld = manual ? loading('Recherche d\'une mise à jour…') : null;
  let rel = null;
  try {
    const r = await Promise.race([fetch(UPD_API, { headers: { Accept: 'application/vnd.github+json' } }), new Promise((_, j) => setTimeout(() => j(new Error('timeout')), 12000))]);
    if (r.ok) rel = await r.json();
  } catch (e) { console.warn('maj', e); }
  finally { if (ld) ld.close(); }
  try { localStorage.setItem('upd.at', String(Date.now())); } catch (e) {}
  if (!rel || !rel.tag_name) { if (manual) toast('Impossible de vérifier (internet ?)'); return; }
  const latest = rel.tag_name.replace(/^v/, '');
  if (verCmp(latest, cur) > 0) { window._updRel = rel; try { localStorage.setItem('updNotes', JSON.stringify({ v: latest, notes: rel.body || '' })); } catch (e) {} return showUpdate(latest, rel.body || ''); }
  if (manual) toast(`Application à jour ✓ (${cur})`);
}

function showUpdate(latest, notes = '') {
  const lines = String(notes).split('\n').map(l => l.trim()).filter(l => l && !/^téléchargez/i.test(l));
  const news = lines.length ? `<div class="upd-notes">${lines.map(l => /^#+\s/.test(l) ? `<b>${esc(l.replace(/^#+\s*/, ''))}</b>` : `<div>• ${esc(l.replace(/^[-*•]\s*/, ''))}</div>`).join('')}</div>` : '';
  if (document.querySelector('.upd-sheet')) return;
  const s = sheet(`<div class="upd-sheet"><div class="upd-ic">⬆️</div>
    <p><b>Nouvelle version ${esc(latest)}</b> disponible (vous avez ${esc(APP_VERSION)}).</p>${news}
    <p class="muted">Installez-la <b>par-dessus</b> l'application : <b>ne la désinstallez pas</b>. Vos projets, plans, photos et réglages restent sur le téléphone.</p>
    <div class="btnrow"><button class="btn ghost" data-a="later">Plus tard</button><button class="btn" data-a="go">${icon('upload')} Mettre à jour</button></div></div>`, { title: 'Mise à jour' });
  $('[data-a=later]', s.el).onclick = () => s.close();
  $('[data-a=go]', s.el).onclick = () => { s.close(); installUpdate(); };
}

// ---------- Mise à jour rapide (sans réinstaller) : paquet web téléchargé puis chargé à la place de celui de l'APK ----------
// Possible quand la partie native ne change pas (même empreinte). Sinon : installation de l'APK.
// Sécurité : le nouveau paquet ne devient permanent qu'après avoir démarré correctement (sinon, retour automatique à l'ancien).
const NATIVE_ID = '__NATIVE_ID__';
const OTA_WV = () => window.Capacitor?.Plugins?.WebView;
const b64ToBytes = (b64) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const bytesToB64 = (u) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
async function otaInstall(rel, ld) {
  const P = window.Capacitor?.Plugins || {}, FS = P.Filesystem, WV = OTA_WV();
  if (!FS || !FS.downloadFile || !WV || !WV.setServerBasePath || /^__/.test(NATIVE_ID)) return false;
  try { if (localStorage.getItem('ota.off')) return false; } catch (e) {}
  const A = (n) => (rel.assets || []).find(a => a.name === n), aj = A('ota.json'), az = A('www.zip');
  if (!aj || !az) return false;
  const ver = rel.tag_name.replace(/^v/, '');
  await FS.downloadFile({ url: aj.browser_download_url, path: 'ota.json', directory: 'CACHE' });
  const meta = JSON.parse(atob((await FS.readFile({ path: 'ota.json', directory: 'CACHE' })).data));
  if (meta.native !== NATIVE_ID || meta.version !== ver) return false;          // partie native modifiée → APK
  ld.set('Téléchargement de la mise à jour…');
  let h = null; try { if (FS.addListener) h = await FS.addListener('progress', (e) => { if (e && e.contentLength) ld.set(`Téléchargement… ${Math.round(e.bytes / e.contentLength * 100)} %`); }); } catch (e) {}
  try { await FS.downloadFile({ url: az.browser_download_url, path: 'www.zip', directory: 'CACHE', progress: true }); } finally { try { h && h.remove && h.remove(); } catch (e) {} }
  const st = await FS.stat({ path: 'www.zip', directory: 'CACHE' }).catch(() => null);
  if (!st || Math.abs((st.size || 0) - az.size) > 16) throw new Error('téléchargement incomplet');
  ld.set('Préparation…');
  await loadScript('vendor/fflate.min.js');
  let zipBytes = null;
  try { const { uri } = await FS.getUri({ path: 'www.zip', directory: 'CACHE' }); const r = await fetch(window.Capacitor.convertFileSrc(uri)); if (r.ok) zipBytes = new Uint8Array(await r.arrayBuffer()); } catch (e) {}
  if (!zipBytes || Math.abs(zipBytes.length - az.size) > 16) zipBytes = b64ToBytes((await FS.readFile({ path: 'www.zip', directory: 'CACHE' })).data);
  const files = fflate.unzipSync(zipBytes); zipBytes = null;
  const names = Object.keys(files).filter(n => !n.endsWith('/'));
  if (names.length !== meta.files || !files['index.html']) throw new Error('paquet incomplet');
  const dir = `ota/${ver}`;
  try { await FS.rmdir({ path: dir, directory: 'DATA', recursive: true }); } catch (e) {}
  let i = 0;
  for (const n of names) { await FS.writeFile({ path: `${dir}/${n}`, data: bytesToB64(files[n]), directory: 'DATA', recursive: true }); files[n] = null; if (++i % 10 === 0) ld.set(`Installation… ${Math.round(i / names.length * 100)} %`); }
  FS.deleteFile({ path: 'www.zip', directory: 'CACHE' }).catch(() => {});
  const { uri } = await FS.getUri({ path: dir, directory: 'DATA' });
  const path = decodeURIComponent(uri.replace(/^file:\/\//, ''));
  try { localStorage.setItem('ota.try', JSON.stringify({ v: ver, at: Date.now() })); } catch (e) {}
  ld.set('Redémarrage…');
  await WV.setServerBasePath({ path });                                          // l'application redémarre sur la nouvelle version
  return true;
}
// au démarrage : rendre permanent le paquet qui vient de démarrer, nettoyer les anciens
async function otaBoot() {
  const P = window.Capacitor?.Plugins || {}, FS = P.Filesystem, WV = OTA_WV(); if (!FS || !WV || !WV.getServerBasePath) return;
  try {
    const { path } = await WV.getServerBasePath(), onOta = /\/ota\//.test(path || '');
    let T = null; try { T = JSON.parse(localStorage.getItem('ota.try') || 'null'); } catch (e) {}
    if (onOta) { await WV.persistServerBasePath(); try { localStorage.removeItem('ota.try'); } catch (e) {} }
    else if (T && T.v !== APP_VERSION && Date.now() - T.at < 10 * 60000) { try { localStorage.setItem('ota.off', '1'); localStorage.removeItem('ota.try'); } catch (e) {} }   // le changement n'a pas pris : on repasse par l'APK
    const cur = onOta ? path.split('/ota/')[1].split('/')[0] : '';
    const d = await FS.readdir({ path: 'ota', directory: 'DATA' }).catch(() => null);
    for (const f of (d && d.files) || []) { const n = typeof f === 'string' ? f : f.name; if (n && n !== cur) FS.rmdir({ path: `ota/${n}`, directory: 'DATA', recursive: true }).catch(() => {}); }
  } catch (e) { console.warn('ota', e); }
}

// téléchargement direct dans l'application puis ouverture de l'installateur Android ; sinon, lien dans le navigateur
// - lien exact de la version (pas « latest », qui peut renvoyer une ancienne version en cache → « Application non installée »)
// - nom de fichier unique, anciens APK effacés, taille vérifiée avant d'installer
async function installUpdate() {
  const P = window.Capacitor?.Plugins || {}, rel = window._updRel || null;
  const asset = rel && (rel.assets || []).find(a => /\.apk$/i.test(a.name));
  const ver = rel ? rel.tag_name.replace(/^v/, '') : 'latest', url = asset ? asset.browser_download_url : UPD_APK;
  if (rel) {   // d'abord la mise à jour rapide (sans réinstaller)
    const l0 = loading('Recherche de la mise à jour rapide…');
    try { if (await otaInstall(rel, l0)) return; } catch (e) { console.warn('ota', e); toast('Mise à jour rapide impossible (' + (e.message || e) + ') — installation classique'); }
    finally { l0.close(); }
  }
  if (P.Filesystem && P.Filesystem.downloadFile && P.FileOpener) {
    const ld = loading('Téléchargement de la mise à jour…');
    let h = null; const path = `Chantier-${ver}-${Date.now() % 100000}.apk`;
    try {
      try { const d = await P.Filesystem.readdir({ path: '', directory: 'CACHE' }); for (const f of d.files || []) { const n = typeof f === 'string' ? f : f.name; if (/^Chantier.*\.apk$/i.test(n)) await P.Filesystem.deleteFile({ path: n, directory: 'CACHE' }).catch(() => {}); } } catch (e) {}
      if (P.Filesystem.addListener) h = await P.Filesystem.addListener('progress', (e) => { if (e && e.contentLength) ld.set(`Téléchargement… ${Math.round(e.bytes / e.contentLength * 100)} %`); });
      const r = await P.Filesystem.downloadFile({ url, path, directory: 'CACHE', progress: true });
      const st = await P.Filesystem.stat({ path, directory: 'CACHE' }).catch(() => null);
      if (asset && st && st.size && Math.abs(st.size - asset.size) > 16) throw new Error(`téléchargement incomplet (${Math.round(st.size / 1e6)} / ${Math.round(asset.size / 1e6)} Mo)`);
      const uri = r.path || (await P.Filesystem.getUri({ path, directory: 'CACHE' })).uri;
      ld.close();
      await P.FileOpener.open({ filePath: uri, contentType: 'application/vnd.android.package-archive', openWithDefault: true });
      return;
    } catch (e) { console.warn('maj directe', e); ld.close(); toast('Téléchargement direct impossible : ' + (e.message || e) + ' — ouverture du navigateur'); }
    finally { try { h && h.remove && h.remove(); } catch (e) {} }
  }
  openUrl(url);
  toast('Ouvrez le fichier téléchargé puis « Mettre à jour »');
}

// après une mise à jour : « Nouveautés » affichées une fois
function showWhatsNew() {
  try {
    const cur = typeof APP_VERSION === 'string' ? APP_VERSION : ''; if (!/^\d/.test(cur)) return;
    const seen = localStorage.getItem('seenVer'); localStorage.setItem('seenVer', cur);
    if (!seen || seen === cur) return;
    const N = JSON.parse(localStorage.getItem('updNotes') || 'null'); if (!N || N.v !== cur || !N.notes) return;
    const lines = String(N.notes).split('\n').map(l => l.trim()).filter(Boolean);
    const sh = sheet(`<div class="upd-sheet"><div class="upd-ic">🎉</div><p><b>Mise à jour installée : version ${esc(cur)}</b></p><div class="upd-notes">${lines.map(l => /^#+\s/.test(l) ? `<b>${esc(l.replace(/^#+\s*/, ''))}</b>` : `<div>• ${esc(l.replace(/^[-*•]\s*/, ''))}</div>`).join('')}</div><button class="btn" data-a="ok" style="width:100%">OK</button></div>`, { title: 'Nouveautés' });
    sh.el.querySelector('[data-a=ok]').onclick = () => sh.close();
  } catch (e) {}
}
