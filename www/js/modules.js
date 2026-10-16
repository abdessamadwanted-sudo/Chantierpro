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
  ['career', 'Emploi & carrière'],
];
// section du menu → fonction qui la commande (les sections absentes sont toujours visibles)
const SECTION_FEATURE = { reception: 'reception', beton: 'reception', avancement: 'avancement', tasks: 'tasks', photos: 'photos', forms: 'forms', reports: 'reports', constat: 'constat', clauses: 'clauses', models3d: 'models3d', maquette: 'models3d', calc: 'calc' };

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
  if (verCmp(latest, cur) > 0) return showUpdate(latest, rel.body || '');
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

// téléchargement direct dans l'application puis ouverture de l'installateur Android ; sinon, lien dans le navigateur
async function installUpdate() {
  const P = window.Capacitor?.Plugins || {};
  if (P.Filesystem && P.Filesystem.downloadFile && P.FileOpener) {
    const ld = loading('Téléchargement de la mise à jour…');
    let h = null;
    try {
      if (P.Filesystem.addListener) h = await P.Filesystem.addListener('progress', (e) => { if (e && e.contentLength) ld.set(`Téléchargement… ${Math.round(e.bytes / e.contentLength * 100)} %`); });
      const r = await P.Filesystem.downloadFile({ url: UPD_APK, path: 'Chantier-update.apk', directory: 'CACHE', progress: true });
      const uri = r.path || (await P.Filesystem.getUri({ path: 'Chantier-update.apk', directory: 'CACHE' })).uri;
      ld.close();
      await P.FileOpener.open({ filePath: uri, contentType: 'application/vnd.android.package-archive', openWithDefault: true });
      return;
    } catch (e) { console.warn('maj directe', e); ld.close(); }
    finally { try { h && h.remove && h.remove(); } catch (e) {} }
  }
  openUrl(UPD_APK);
  toast('Ouvrez le fichier téléchargé puis « Mettre à jour »');
}
