// ---------- Thèmes ----------
const THEMES = [
  ['siteteam', '🏗️ SiteTeam (clair)', 'linear-gradient(160deg,#F2F5F9,#E3EAF3)', '#2164A8'],
  ['siteteam-dark', '🌙 SiteTeam (sombre)', 'linear-gradient(160deg,#132238,#0B1422)', '#4C8DDB'],
  ['dark', 'Classique', 'linear-gradient(160deg,#2c313a,#1b1e24)', '#5b8def'],
  ['glass', 'Verre', 'radial-gradient(60% 40% at 0 0,#3b82f6aa,transparent),radial-gradient(50% 40% at 100% 40%,#a855f7aa,transparent),#0e1430', 'linear-gradient(135deg,#4f8cff,#a855f7)'],
  ['sakura', '🌸 Sakura', 'radial-gradient(60% 40% at 0 0,#ff6faecc,transparent),radial-gradient(50% 40% at 100% 40%,#ffb6d5aa,transparent),#2a0f22', 'linear-gradient(135deg,#ff6fae,#c084fc)'],
  ['lavande', '💜 Lavande', 'radial-gradient(60% 40% at 0 0,#a78bfacc,transparent),radial-gradient(50% 40% at 100% 40%,#f0abfc88,transparent),#1b1533', 'linear-gradient(135deg,#a78bfa,#f0abfc)'],
  ['peche', '🍑 Pêche', 'radial-gradient(60% 40% at 0 0,#fb923ccc,transparent),radial-gradient(50% 40% at 100% 40%,#fda4afaa,transparent),#2a1514', 'linear-gradient(135deg,#fb923c,#f472b6)'],
  ['ocean', '🌊 Océan', 'radial-gradient(60% 40% at 0 0,#06b6d4cc,transparent),radial-gradient(50% 40% at 100% 40%,#3b82f6aa,transparent),#061a26', 'linear-gradient(135deg,#06b6d4,#3b82f6)'],
  ['foret', '🌿 Forêt', 'radial-gradient(60% 40% at 0 0,#22c55ebb,transparent),radial-gradient(50% 40% at 100% 40%,#14b8a688,transparent),#0b1a12', 'linear-gradient(135deg,#22c55e,#14b8a6)'],
  ['sunset', '🌅 Sunset', 'radial-gradient(60% 40% at 0 0,#f97316cc,transparent),radial-gradient(50% 40% at 100% 40%,#ec4899bb,transparent),#1f0f24', 'linear-gradient(135deg,#f97316,#8b5cf6)'],
  ['pro', '💼 Pro sobre', 'linear-gradient(160deg,#20242a,#15171b)', '#4b6584'],
  ['net', '📄 Net clair', 'linear-gradient(160deg,#ffffff,#eef1f5)', '#334155'],
  ['noir-or', '🖤 Noir & Or', 'radial-gradient(60% 40% at 0 0,#d4a53766,transparent),#0a0a0a', 'linear-gradient(135deg,#d4a537,#f5d77a)'],
];
const themeInt = () => { try { return localStorage.getItem('theme.int') || 'compact'; } catch (e) { return 'compact'; } };
function applyTheme(t) {
  const h = document.documentElement;
  h.className = h.className.split(' ').filter(c => c && c !== 'glass' && c !== 'sober' && !c.startsWith('th-') && !c.startsWith('gi-')).join(' ');
  if (t === 'siteteam') h.classList.add('sober', 'th-net', 'th-st');   // SiteTeam UI Kit : clair, Navy / Blue / Amber / Green
  else if (t === 'siteteam-dark') h.classList.add('sober', 'th-pro', 'th-st', 'th-std');   // v1.0.34 : SiteTeam sombre professionnel
  else if (t === 'pro' || t === 'net') h.classList.add('sober', 'th-' + t);   // thèmes professionnels : sobres, sans effets
  else if (t && t !== 'dark') { h.classList.add('glass'); if (t !== 'glass') h.classList.add('th-' + t); h.classList.add('gi-' + themeInt()); }
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = ({ dark: '#1b1e24', glass: '#0e1430', pro: '#15171b', net: '#ffffff', siteteam: '#ffffff', 'siteteam-dark': '#101C2E' })[t] || getComputedStyle(h).getPropertyValue('--base').trim() || '#1b1e24';
}
// v1.0.30 : le thème SiteTeam (UI Kit) devient le thème par défaut ; un thème choisi auparavant (autre que « Classique ») est conservé
try { if (!localStorage.getItem('theme.v30')) { const t0 = localStorage.getItem('theme'); if (!t0 || t0 === 'dark') localStorage.setItem('theme', 'siteteam'); localStorage.setItem('theme.v30', '1'); } } catch (e) {}
const curTheme = () => { try { return localStorage.getItem('theme') || 'siteteam'; } catch (e) { return 'siteteam'; } };
try { applyTheme(curTheme()); } catch (e) {}
function chooseTheme(after) {
  const s = sheet(`<div style="padding:0 16px 14px"><h3 style="margin:0 0 10px">Apparence</h3><div class="thm-grid">${THEMES.map(([k, l, bg, fab]) => `<button class="thm ${curTheme() === k ? 'on' : ''}" data-t="${k}"><i style="background:${bg};--fab:${fab}"><u></u></i>${l}</button>`).join('')}</div>
    <div class="thm-int"><span>Rendu</span><button data-int="compact" class="${themeInt() === 'compact' ? 'on' : ''}">Net (compact)</button><button data-int="verre" class="${themeInt() === 'verre' ? 'on' : ''}">Verre (transparent)</button></div>
    <small style="color:var(--muted)">Le thème s'applique tout de suite, sur tous les écrans.</small></div>`, {});
  $$('[data-int]', s.el).forEach(b => b.onclick = () => { try { localStorage.setItem('theme.int', b.dataset.int); } catch (e) {} applyTheme(curTheme()); $$('[data-int]', s.el).forEach(x => x.classList.toggle('on', x === b)); after && after(); });
  $$('[data-t]', s.el).forEach(b => b.onclick = () => { const t = b.dataset.t; try { localStorage.setItem('theme', t); } catch (e) {} applyTheme(t); $$('.thm', s.el).forEach(x => x.classList.toggle('on', x === b)); after && after(); });
}
// Application principale : écrans et navigation
const CATEGORIES = ['Gros œuvre', 'Coffrage', 'Ferraillage', 'Béton', 'Maçonnerie', 'Étanchéité', 'Électricité', 'Plomberie', 'Menuiserie', 'Finitions', 'Sécurité', 'Qualité'];
const LINK_CATS = [
  { key: 'coffrage', label: 'Plan coffrage', icon: 'plans', type: 'doc' },
  { key: 'ferraillage', label: 'Plan ferraillage', icon: 'layers', type: 'doc' },
  { key: 'coupe', label: 'Coupe', icon: 'ruler', type: 'doc' },
  // PV / photos / notes : maintenant dans les tableaux de réception et de bétonnage (affichés seulement s'il en reste d'anciens)
  { key: 'pv', label: 'PV', icon: 'report', type: 'pv', legacy: true },
  { key: 'photo', label: 'Photos', icon: 'camera', type: 'photo', legacy: true },
  { key: 'note', label: 'Notes', icon: 'edit', type: 'note', legacy: true },
];
const EXTRA_CAT_SUGGEST = ['Maçonnerie', 'Plâtrerie', 'Charpente', 'Façade', 'Étanchéité', 'Électricité', 'Plomberie', 'Menuiserie', 'Carrelage', 'Peinture', 'Escalier', 'Fondations'];
const FORM_TEMPLATES = [
  { id: 'ferraillage', title: 'Réception ferraillage', items: ['Diamètres conformes au plan', 'Espacement des armatures', 'Nombre de barres', 'Longueurs de recouvrement', 'Enrobage (cales en place)', 'Ligatures / stabilité de la cage', 'Propreté des armatures', 'Attentes en place', 'Cadres et épingles'] },
  { id: 'coffrage', title: 'Réception coffrage', items: ['Implantation / axes', 'Dimensions conformes', 'Aplomb / verticalité', 'Niveau / altimétrie', 'Étanchéité des joints', 'Huile de décoffrage', 'Étaiement et stabilité', 'Réservations en place', 'Propreté du fond'] },
  { id: 'betonnage', title: 'Contrôle bétonnage', items: ['Bon de livraison conforme', 'Classe de béton conforme', 'Slump test (affaissement)', 'Prélèvement éprouvettes', 'Vibration correcte', 'Hauteur de chute respectée', 'Cure du béton', 'Météo compatible'] },
  { id: 'maconnerie', title: 'Contrôle maçonnerie', items: ['Implantation', 'Aplomb', 'Niveau', 'Épaisseur des joints', 'Chaînages', 'Linteaux', 'Harpage / liaison', 'Propreté'] },
  { id: 'etancheite', title: 'Contrôle étanchéité', items: ['Support propre et sec', 'Primaire appliqué', 'Recouvrement des lés', 'Relevés', 'Évacuations EP', 'Essai d\'eau (mise en eau)', 'Protection'] },
  { id: 'vide', title: 'Formulaire vide', items: [] },
];
const WEATHER = ['Ensoleillé', 'Nuageux', 'Pluie', 'Vent fort', 'Chaleur', 'Froid'];

const APP_VERSION = '__APP_VERSION__';
const App = { project: null, section: 'dashboard', taskFilter: 'all', companyFilter: 'all', search: '' };

// ---------- Helpers données ----------
async function fileURL(fileId) {
  const f = await DB.get('files', fileId);
  return f ? BlobURL.get(f.id, f.blob) : '';
}
async function saveImageFile(projectId, file, role = 'photo', extra = {}) {
  const hq = extra.hq; delete extra.hq;
  if (file._w && /jpe?g/i.test(file.type || '')) return DB.put('files', { projectId, blob: file, mime: 'image/jpeg', name: file.name, role, w: file._w, h: file._h, ...extra });   // déjà recadrée et compressée
  const { blob, w, h } = await compressImage(file, role === 'plan' ? 5000 : hq ? 2200 : 1600, role === 'plan' ? 0.93 : hq ? 0.86 : 0.82);
  return DB.put('files', { projectId, blob, mime: 'image/jpeg', name: file.name, role, w, h, ...extra });
}
async function addPhotos(projectId, extra = {}) {
  const src = await pickSource(extra.scan ? 'Ajouter un PV' : 'Ajouter des photos');
  if (!src) return [];
  let files = await pickImages(src);
  if (!files.length) return [];
  const scan = extra.scan; delete extra.scan;
  if (scan) { const sc = await scanDocuments(files); if (!sc || !sc.length) return []; files = sc; extra.hq = true; }
  const ld = loading('Enregistrement…');
  try {
    const out = [];
    for (const f of files) out.push(await saveImageFile(projectId, f, 'photo', { ...extra }));
    return out;
  } finally { ld.close(); }
}
function thumbsHTML(files, editable = true) {
  return `<div class="thumbs">${files.map(f => `<div class="t" data-id="${f.id}"><img src="${BlobURL.get(f.id, f.blob)}">${editable ? `<button class="x" data-del="${f.id}">×</button>` : ''}</div>`).join('')}
    ${editable ? `<button class="t add" data-a="addphoto">${icon('camera')}</button>` : ''}</div>`;
}
async function loadFiles(ids = []) {
  const out = [];
  for (const id of ids) { const f = await DB.get('files', id); if (f) out.push(f); }
  return out;
}
function shareWhatsApp(text) {
  openUrl('https://wa.me/?text=' + encodeURIComponent(text));
}

// ---------- Rappels : couleur selon l'échéance ----------
// late = aujourd'hui ou dépassé (rouge, reste jusqu'au ✓) · soon = demain (vert) · '' = plus tard
const rapDays = (x) => { if (!x.at) return 99; const d = new Date(x.at.slice(0, 10) + 'T00:00:00'), t = new Date(todayISO() + 'T00:00:00'); return Math.round((d - t) / 864e5); };
const rapState = (x) => { const d = rapDays(x); return d <= 0 ? 'late' : d === 1 ? 'soon' : ''; };
const rapRank = (x) => ({ late: 0, soon: 1 })[rapState(x)] ?? 2;
const rapLabel = (x) => { const d = rapDays(x); return d < 0 ? ` · en retard de ${-d} j` : d === 0 ? " · aujourd'hui" : d === 1 ? ' · demain' : ''; };

// ---------- Accueil : projets ----------
async function renderHome() {
  App.fromBrief = null;
  const keepScroll = App.project ? 0 : (($('.h2-body') || {}).scrollTop || 0);
  $('#app').classList.remove('with-bnav');
  App.homeFocus = null;   // plus de page intermédiaire : la liste des chantiers, un toucher = on entre
  App.project = null;
  BackStack.length = 0;
  const projects = (await DB.all('projects')).filter(p => Team.canProject(p.id)).sort((a, b) => b.updatedAt - a.updatedAt);
  const [allTasks, allRecs, allLinks] = await Promise.all([DB.all('tasks'), DB.all('receptions'), DB.all('links')]);
  const fRec = featOn('reception'), fTasks = featOn('tasks'), fAv = featOn('avancement');
  const today = todayISO();
  const wk = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const stats = (p) => {
    const t = allTasks.filter(x => x.projectId === p.id), r = allRecs.filter(x => x.projectId === p.id);
    const cnt = (kind, from) => r.filter(d => (d.type === 'Bétonnage') === (kind === 'B') && (!from || d.date >= from)).reduce((a, d) => a + (d.rows || []).filter(x => x.element && x.status !== 'pending').length, 0);
    const pvl = r.filter(d => d.type !== 'Bétonnage').flatMap(d => (d.rows || []).filter(pvMissing).map(x => d.date));
    return { open: t.filter(x => !isLifted(x)).length, late: t.filter(isLate).length, pv: pvl.length, pvOld: pvl.filter(dt => daysSince(dt) >= 3).length,
      today: cnt('F', today) + cnt('B', today), fT: cnt('F', today), fW: cnt('F', wk), fA: cnt('F'), bT: cnt('B', today), bW: cnt('B', wk), bA: cnt('B'),
      rap: (p.rappels || []).filter(x => !x.done).sort((a, b) => rapRank(a) - rapRank(b) || (a.at || '9').localeCompare(b.at || '9')),
      av: fAv ? avHomeStats(p, allLinks) : null };
  };
  App.homeOpen = App.homeOpen || {};
  const HUES = [['#2563eb', '#1e3a8a'], ['#0d9488', '#134e4a'], ['#7c3aed', '#4c1d95'], ['#ea580c', '#7c2d12'], ['#db2777', '#831843'], ['#0891b2', '#164e63']];
  const hue = (s) => HUES[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const h = new Date().getHours(), hello = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  let uname = ''; try { uname = localStorage.getItem('userName') || ''; } catch (e) {}
  const PHR = h < 12 ? ['Bonne journée sur le chantier ☀️', 'Prêt pour les réceptions du jour ?', 'Un café, et on attaque 💪', 'Nouvelle journée, nouveaux niveaux 🏗️', 'La qualité commence dès le matin ✅']
    : h < 18 ? ['Bon courage pour l\'après-midi 💪', 'Pensez aux PV de la matinée 📋', 'Le bétonnage avance ? 🏗️', 'Encore un effort, la journée avance bien', 'Un point sur les réserves ?']
    : ['Belle soirée, bon travail aujourd\'hui 👏', 'Le temps de faire le bilan du jour 📊', 'Pensez à envoyer les tableaux du jour 📤', 'Reposez-vous, demain on continue 🌙', 'Merci pour cette journée de chantier'];
  const phrase = PHR[(new Date().getDate() + h) % PHR.length];
  const dateL = new Date().toLocaleDateString({ ar: 'ar-MA', en: 'en-GB' }[Lang.cur] || 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const detHTML = (p, st) => { const due = (x) => x.at && x.at.slice(0, 10) <= today, ropen = !!(App.homeRap || {})[p.id]; return `<div class="h2-det">
              ${st.av ? `<div class="h2-kpi" style="grid-template-columns:1fr;margin:0 0 10px"><div class="${st.av.late ? 'r' : 'g'}" data-go="${p.id}|avancement"><b>${st.av.pct}%</b><span>Avancement second œuvre · ${st.av.locs} locaux ›</span>${st.av.late ? `<small>${st.av.late} engagement(s) en retard</small>` : ''}</div></div>` : ''}
              ${fRec ? `<table class="h2-tab"><tr><th></th><th>Aujourd'hui</th><th>7 jours</th><th>Total</th></tr>
                <tr data-go="${p.id}|reception"><td>Réception ferraillage ›</td><td><b>${st.fT}</b></td><td>${st.fW}</td><td>${st.fA}</td></tr>
                <tr data-go="${p.id}|beton"><td>Bétonnage ›</td><td><b>${st.bT}</b></td><td>${st.bW}</td><td>${st.bA}</td></tr></table>` : ''}
              ${fRec || fTasks ? `<div class="h2-kpi" style="${fRec && fTasks ? '' : 'grid-template-columns:1fr'}">${fRec ? `<div class="${st.pv ? 'r' : 'g'}" data-go="${p.id}|pv"><b>${st.pv}</b><span>PV à récupérer ›</span>${st.pvOld ? `<small>dont ${st.pvOld} > 3 jours</small>` : ''}</div>` : ''}
                ${fTasks ? `<div class="${st.open ? 'o' : 'g'}" data-go="${p.id}|tasks"><b>${st.open}</b><span>Réserves ouvertes ›</span>${st.late ? `<small>${st.late} en retard</small>` : ''}</div>` : ''}</div>` : ''}
              <div class="h2-rh"><button class="h2-rt" data-raptog="${p.id}"><b>🔔 Rappels</b><span class="n">${st.rap.length}</span>${st.rap.some(due) ? '<span class="due">à faire</span>' : ''}<span class="chev" style="transform:rotate(${ropen ? 180 : 0}deg)">${icon('chevdown')}</span></button><button data-addrap="${p.id}">${icon('plus')} Ajouter</button></div>
              ${!ropen ? '' : st.rap.length ? st.rap.map(x => `<div class="h2-rap ${rapState(x)}"><button class="ck" data-rapok="${p.id}|${x.id}"></button><div class="grow" data-rapedit="${p.id}|${x.id}"><span>${esc(x.text)}</span>${x.at ? `<small>${fmtDate(x.at.slice(0, 10))}${x.at.length > 10 ? ' · ' + x.at.slice(11, 16) : ''}${rapLabel(x)}</small>` : ''}</div><button class="iconbtn sm" data-rapdel="${p.id}|${x.id}">${icon('close')}</button></div>`).join('') : '<div class="h2-none">Aucun rappel</div>'}
            </div>`; };
  const fp = App.homeFocus && projects.find(x => x.id === App.homeFocus); if (!fp) App.homeFocus = null;
  const focusHTML = () => { const st = stats(fp), [c1, c2] = hue(fp.name); if (!fRec) { st.today = 0; st.pv = 0; } if (!fTasks) { st.open = 0; st.late = 0; }
    return `<div class="h2-focus"><div class="h2-band" style="--c1:${c1};--c2:${c2}"><button class="h2-bk" data-a="unfocus" aria-label="Mes chantiers">${icon('back')}</button>
      <span class="h2-bav">${esc(initials(fp.name))}</span><b class="grow">${esc(fp.name)}</b><button class="h2-bopen" data-open="${fp.id}">Ouvrir ${icon('chevright')}</button></div>
      <button class="h2-bbrief" data-brief="${fp.id}">☀️ Briefing du chantier</button>${detHTML(fp, st)}</div>`; };
  $('#app').innerHTML = `
    <div class="home2">
      <div class="h2-hero">
        <div class="h2-top"><div class="brand notr"><span class="logo st-lg">${stLogo()}</span><b class="bt">SITETEAM</b></div>
          <div class="h2-acts"><button class="h2-cloud ${Sync.enabled() ? 'on' : 'off'}" data-a="sync" title="Google Drive">${icon('drive')}<i data-syncdot></i></button>
          ${Sync.enabled() ? `<button class="iconbtn" data-a="syncnow" title="Synchroniser">${icon('undo')}</button>` : ''}
          ${featOn('career') ? `<button class="iconbtn h2-emo" data-a="career" title="Emploi & carrière">💼${(() => { try { return +localStorage.getItem('job.new') > 0 ? `<i class="h2-badge">${localStorage.getItem('job.new')}</i>` : ''; } catch (e) { return ''; } })()}</button>` : ''}
          ${Team.ready() ? `<button class="iconbtn" data-a="company" title="${Team.isPerso() ? 'Mon espace' : 'Mon organisation'}">${icon(Team.isPerso() ? 'user' : 'team')}</button>` : ''}
          <button class="iconbtn h2-emo off" data-a="freeph" title="Stockage">🧹</button>
          <button class="iconbtn h2-quit" data-a="quit" title="Fermer (appui long : verrouiller)">${icon('power')}</button>
          <button class="iconbtn" data-a="homemore">${icon('more')}</button></div></div>
        <div class="h2-chiprow">${(() => { if (Team.ready() && Team.isCollab()) return '<span class="h2-role">🤝 Collaborateur · projet partagé</span>'; if (ST.isPerso()) { if (Team.isFree()) return '<span class="h2-role" title="Pack Basic">🆓 Free</span>'; const M = metierOf(Team.profil().metier); Org.apply && Org.poste() && Org.apply(); return `<span class="h2-role" title="Votre métier (profil)">👷 ${esc(M ? M.l : 'Espace personnel')}</span>`; } const P = Org.poste(); if (P) { Org.apply(); return `<span class="h2-role" title="Vous êtes connecté comme">${P.svc.e} ${esc(P.n)}</span>`; } const r = applyRoleColor(), R = r && roleOf(r); return Team.ready() ? '' : (R ? `<button class="h2-role" data-a="role">${R.e} ${esc(R.n.split(' / ')[0])}</button>` : ''); })()}${Team.ready() && ST.wsBtnHTML ? ST.wsBtnHTML() : ''}</div>
        <div class="h2-who">${Team.ready() && typeof Dossier !== 'undefined' ? Dossier.meHTML() : ''}<div class="h2-whot">
        <div class="h2-hello" data-a="uname">${tr(hello)}${uname ? (Lang.cur === 'ar' ? '، ' : ', ') + esc(uname) : ''} 👷</div>
        <div class="h2-phrase">${phrase}</div>
        <div class="h2-date">${dateL.charAt(0).toUpperCase() + dateL.slice(1)}</div></div></div>
      </div>
      <div class="h2-body">
        ${(() => { const M = Team.ready() && Team.appCfg().message; let off = ''; try { off = localStorage.getItem('st.msgOff') || ''; } catch (e) {}
          return M && M.on && M.text && off !== String(M.id || M.text) ? `<div class="st-msg ${M.level === 'alerte' ? 'al' : ''}"><span>${M.level === 'alerte' ? '⚠️' : '📣'}</span><p>${esc(M.text)}</p><button class="iconbtn sm" data-a="msgoff" aria-label="Masquer">${icon('close')}</button></div>` : ''; })()}
        ${(() => {
          // v1.0.32 : accueil en onglets (barre du bas) — Accueil · Projets · Outils ; chaque onglet est court, sans doublon
          const card = (p) => { const st = stats(p), [c1, c2] = hue(p.name), open = !!App.homeOpen[p.id];
          const due = (x) => x.at && x.at.slice(0, 10) <= today;
          if (!fRec) { st.today = 0; st.pv = 0; } if (!fTasks) { st.open = 0; st.late = 0; }
          return `<div class="h2-proj ${open ? 'open' : ''}"><div class="h2-stick"><button class="h2-card" data-id="${p.id}">
            <span class="h2-av" style="background:linear-gradient(135deg,${c1},${c2})">${esc(initials(p.name))}</span>
            <span class="grow"><b>${esc(p.name)}</b>${p.address ? `<small>${icon('pin')} ${esc(p.address)}</small>` : ''}
              <span class="h2-chips">
                ${Team.ready() && Team.sharedOf(p.id) ? `<i class="c-b">🤝 ${esc(Team.sharedOf(p.id).ownerName || 'Projet partenaire')}</i>` : ''}
                ${st.today ? `<i class="c-b">${st.today} réception(s) aujourd'hui</i>` : ''}
                ${st.pv ? `<i class="c-r c-go" data-pvgo="${p.id}">${st.pv} PV à récupérer ›</i>` : ''}
                ${st.rap.length ? `<i class="${st.rap.some(x => rapState(x) === 'late') ? 'c-r' : st.rap.some(x => rapState(x) === 'soon') ? 'c-g2' : 'c-y'}">🔔 ${st.rap.length} rappel(s)</i>` : ''}
                ${st.open ? `<i class="c-o">${st.open} réserve(s)</i>` : ''}
                ${st.av ? `<i class="${st.av.late ? 'c-r' : 'c-b'}">🏗️ ${st.av.pct}%${st.av.late ? ` · ${st.av.late} en retard` : ''}</i>` : ''}
                ${!st.today && !st.pv && !st.open && !st.rap.length && !(st.av && st.av.late) ? '<i class="c-g">À jour ✓</i>' : ''}
              </span></span>
            <span class="h2-chev" data-det="${p.id}" style="transform:rotate(${open ? 180 : 0}deg)">${icon('chevdown')}</span></button></div>
            ${open ? `<div class="h2-detw"><button class="h2-bbrief" data-brief="${p.id}">☀️ Briefing du chantier</button>${detHTML(p, st)}</div>` : ''}</div>`; };
          const empty = `<div class="h2-empty"><div class="ic">${icon('hard')}</div><b>Aucun chantier pour le moment</b><span>Créez votre premier projet avec le bouton <b>+</b>, ou récupérez vos données avec Google Drive.</span>
            <button class="btn ghost" data-a="restore2" style="flex:none">${icon('undo')} Restaurer une sauvegarde</button></div>`;
          const tabs = Team.ready() && !Team.isCollab(), T = tabs ? (App.homeTab || 'home') : '';
          const sec = (k, html) => tabs ? `<section class="h2-pane ${T === k ? 'on' : ''}" data-tab="${k}">${html}</section>` : html;
          const all = `<div class="h2-sec"><span>Mes chantiers</span><small>${projects.length}</small></div>${projects.length ? projects.map(card).join('') : empty}`;
          if (!tabs) return `${ST.directionHTML()}${ST.serviceHTML()}${ST.dashHTML()}${ST.isPerso() || (Team.ready() && Team.isCollab()) ? '' : espaceHome()}${fp ? focusHTML() : all}`;
          const recent = projects.slice(0, 2);
          return sec('home', `${ST.directionHTML()}${ST.serviceHTML()}${ST.dashHTML()}
              <div class="h2-sec"><span>Derniers chantiers</span><small>${projects.length}</small>${projects.length > 2 ? '<button class="h2-more" data-tabgo="proj">Tous ›</button>' : ''}</div>${recent.length ? recent.map(card).join('') : empty}`)
            + sec('proj', all)
            + sec('tools', ST.toolsHTML());   // v1.0.38 : plus d'onglet « Outils » dans la barre du bas (chaque projet s'ouvre sur ses outils) ; panneau gardé pour les tests
        })()}
      </div>
    </div>
    ${fp || Team.lvl('projet') < 3 ? '' : `<button class="fab" data-a="new">${icon('plus')}</button>`}`;
  const cb = $('[data-a=career]'); if (cb) cb.onclick = openCareer;
  const fpb = $('[data-a=freeph]'); fpb.onclick = () => openStorage();
  photoReminder().then(r => { if (!r || App.project || !fpb.isConnected) return; fpb.classList.remove('off'); fpb.title = `${r.n} photos déjà dans Drive · libérer ${r.mb.toFixed(0)} Mo`; fpb.insertAdjacentHTML('beforeend', `<i class="h2-badge y">${r.n > 99 ? '99+' : r.n}</i>`); }).catch(() => {});
  const cmp = $('[data-a=company]'); if (cmp) cmp.onclick = () => Team.openCompany();
  espaceBind($('#app'));
  ST.dashBind($('#app'));
  if (keepScroll) { const hb = $('.h2-body'); if (hb) hb.scrollTop = keepScroll; }
  // v1.0.35 : l'en-tête se resserre quand on fait défiler (le nom et le menu des espaces restent visibles)
  // v1.0.36 : sans effet « vibration » — on réduit au-delà de 64 px, on ré-agrandit seulement près du haut (< 6 px),
  // et jamais si la page est trop courte (sinon la réduction elle-même fait remonter la page et l'en-tête oscille)
  { const hb = $('.h2-body'), he = $('.h2-hero'); if (hb && he) { let mini = false, lock = 0;
      const f = () => { if (Date.now() < lock) return; const y = hb.scrollTop, room = hb.scrollHeight - hb.clientHeight;
        const want = mini ? y > 6 : (y > 64 && room > 200); if (want !== mini) { mini = want; he.classList.toggle('mini', mini); lock = Date.now() + 260; } };
      hb.addEventListener('scroll', f, { passive: true }); f(); } }
  const meb = $('.h2-hero [data-a=dossier]'); if (meb) meb.onclick = (e) => { e.stopPropagation(); openDossier(); };
  // toucher un chantier : son briefing, puis « Entrer » → la page du chantier
  const focusOn = async (id) => { App.homeFocus = id; await renderHome(); $('#app .h2-body') && ($('#app .h2-body').scrollTop = 0);
    if (typeof briefingShow === 'function') { const act = await briefingShow({ pid: id }).catch(e => { console.warn(e); return null; }); if (act) act(); } };
  // un toucher sur le chantier = on entre (page Plans) ; la flèche ⌄ déplie les chiffres et le briefing
  $$('.h2-card[data-id]').forEach(r => r.onclick = async (e) => { const pv = e.target.closest('[data-pvgo]'); if (pv) { await openProject(await DB.get('projects', pv.dataset.pvgo)); return goMissingPv(); }
    const dt = e.target.closest('[data-det]'); if (dt) { e.stopPropagation(); App.homeOpen[dt.dataset.det] = !App.homeOpen[dt.dataset.det]; return renderHome(); }
    openProject(await DB.get('projects', r.dataset.id), Team.ready() ? 'ptools' : null); });
  const unf = $('[data-a=unfocus]'); if (unf) { unf.onclick = () => { App.homeFocus = false; renderHome().then(() => { App.homeFocus = null; }); }; pushBack(() => unf.onclick()); }
  $$('[data-brief]').forEach(bb => bb.onclick = async () => { const act = await briefingShow({ pid: bb.dataset.brief }); if (act) act(); });
  $$('[data-open]').forEach(b => b.onclick = async () => openProject(await DB.get('projects', b.dataset.open), Team.ready() ? 'ptools' : null));
  $$('[data-go]').forEach(b => b.onclick = async () => {
    const [pid, where] = b.dataset.go.split('|'); const p = await DB.get('projects', pid);
    await openProject(p);
    if (where === 'pv') return goMissingPv();
    App.section = where; App.search = ''; if (where === 'tasks') App.taskFilter = 'open'; renderSection();
  });
  $$('[data-raptog]').forEach(b => b.onclick = () => { App.homeRap = App.homeRap || {}; App.homeRap[b.dataset.raptog] = !App.homeRap[b.dataset.raptog]; renderHome(); });
  $$('[data-rapedit]').forEach(b => b.onclick = () => { const [pid, id] = b.dataset.rapedit.split('|'); addRappel(pid, id); });
  const q = $('[data-a=quit]'); { let t = null, lp = false;   // toucher = au revoir et fermer ; appui long = verrouiller / code PIN
    q.addEventListener('pointerdown', () => { lp = false; t = setTimeout(() => { lp = true; powerMenu(); }, 550); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => q.addEventListener(ev, () => clearTimeout(t)));
    q.onclick = () => { if (!lp) Splash.bye(); }; }
  const sn = $('[data-a=syncnow]'); if (sn) sn.onclick = () => { sn.classList.add('spinning'); Sync.run({ force: true }).finally(() => sn.classList.remove('spinning')); };
  $$('[data-addrap]').forEach(b => b.onclick = () => addRappel(b.dataset.addrap));
  $$('[data-rapok]').forEach(b => b.onclick = async () => { const [pid, id] = b.dataset.rapok.split('|'); const p = await DB.get('projects', pid); const x = (p.rappels || []).find(r => r.id === id); if (x) { x.done = true; cancelNotif(x); await DB.put('projects', p); toast('Rappel terminé ✓'); renderHome(); } });
  $$('[data-rapdel]').forEach(b => b.onclick = async () => { const [pid, id] = b.dataset.rapdel.split('|'); const p = await DB.get('projects', pid); const x = (p.rappels || []).find(r => r.id === id); p.rappels = (p.rappels || []).filter(r => r.id !== id); if (x) cancelNotif(x); await DB.put('projects', p); renderHome(); });
  $('[data-a=sync]').onclick = () => Sync.openSyncSettings();
  const askName = async () => { const r = await formSheet('Votre prénom', [{ name: 'n', label: 'Comment vous appeler ?', value: uname, placeholder: 'Ex : Abdessamad' }], { okLabel: 'Enregistrer' }); if (r) { try { localStorage.setItem('userName', (r.n || '').trim()); localStorage.setItem('askedName', '1'); } catch (e) {} renderHome(); } };
  $('[data-a=uname]').onclick = askName;
  const rb = $('[data-a=role]'); if (rb) rb.onclick = async () => { const v = await menu('Mon profil (couleur et titre)', ROLES.map(x => ({ label: `${x.e} ${x.n}`, value: x.k, swatch: ROLE_COLORS[x.k], checked: x.k === myRole() }))); if (v) { try { localStorage.setItem('myRole', v); } catch (e) {} renderHome(); } };
  try { if (!uname && !localStorage.getItem('askedName')) { localStorage.setItem('askedName', '1'); setTimeout(askName, 600); } } catch (e) {}
  { const mo = $('[data-a=msgoff]'); if (mo) mo.onclick = () => { const M = Team.appCfg().message || {}; try { localStorage.setItem('st.msgOff', String(M.id || M.text)); } catch (e) {} mo.closest('.st-msg').remove(); }; }
  $('[data-a=homemore]').onclick = async () => {
        // menu ⋮ : 6 groupes courts, sans doublon (déconnexion et prénom sont dans « Mon compte », la langue dans Réglages, la version ouvre la mise à jour)
        const v = await groupMenu('Réglages', [
      { title: '', color: '#22c55e', items: [{ label: 'Briefing du jour', sub: 'notes, rappels, PV à livrer, tâches', icon: 'calendar', value: 'brief' }] },
      { title: 'Mon espace', color: '#3b82f6', items: Team.ready() ? [
        { label: 'Changer d\'espace', sub: 'espace personnel · organisations · code', icon: 'swap', value: 'ws' },
        Team.isPerso() ? { label: 'Mon espace personnel', sub: 'profil · abonnement · compte', icon: 'user', value: 'company' } : { label: 'Mon organisation', sub: 'équipe · codes d\'accès · compte', icon: 'team', value: 'company' },
        ...(Team.isAdmin() && !Team.isPerso() ? [ST.preview() ? { label: 'Quitter l\'aperçu', sub: 'revenir à mon interface', icon: 'eye', value: 'preview-off' } : { label: 'Tester une interface', sub: 'aperçu par poste et pack', icon: 'eye', value: 'preview' }] : []),
        ...(Team.isSuper() ? [{ label: 'Panneau d\'administration', sub: 'comptes · packs · codes · annonces', icon: 'settings', value: 'admin' }] : [])] : [
        { label: 'Mon prénom', sub: uname || 'pour les messages d\'accueil', icon: 'edit', value: 'name' }] },
      { title: 'Outils', color: '#f59e0b', items: [
        { label: 'Outils PDF', sub: 'fusionner · diviser · compresser', icon: 'pdf', value: 'pdf' },
        { label: 'Studio photo', sub: 'auto · document · recadrage', icon: 'camera', value: 'photo' },
        { label: 'Tableau de dessin', icon: 'brush', value: 'board' }] },
      { title: 'Données', color: '#0ea5e9', items: [
        { label: 'Stockage & sauvegarde', sub: 'libérer · Google Drive · .zip', icon: 'cloud', value: 'stock' },
        ...(typeof BgUp !== 'undefined' && BgUp.available() ? [{ label: 'Envoi en arrière-plan', sub: 'photos vers Drive, même application fermée · Wi-Fi · batterie', icon: 'upload', value: 'bgup' }] : []),
        { label: 'Restaurer une sauvegarde', sub: 'fichier .zip ou .chantier', icon: 'undo', value: 'restore' },
        { label: 'Corbeille', sub: 'supprimés depuis 30 jours', icon: 'trash', value: 'trash' }] },
      { title: 'Réglages', color: '#a855f7', items: [
        { label: 'Apparence', sub: 'thèmes · sons et effets', icon: 'brush', value: 'look' },
        { label: 'Langue', sub: 'Français · العربية · English', icon: 'globe', value: 'lang' },
        { label: 'Code PIN et empreinte', icon: 'settings', value: 'pin' },
        { label: 'Fonctions affichées', sub: 'masquer ce qui ne sert pas', icon: 'grid', value: 'feat' }] },
      { title: 'Application', color: '#64748b', items: [
        ...(() => { try { const T = JSON.parse(localStorage.getItem('boot.t') || 'null'); return T ? [{ label: `⏱ Dernier démarrage : ${(T.total / 1000).toFixed(1)} s`, sub: `fichiers ${(T.scripts / 1000).toFixed(1)} s · connexion ${(T.team / 1000).toFixed(1)} s · accueil ${(T.home / 1000).toFixed(1)} s`, icon: 'calendar', value: 'boott' }] : []; } catch (e) { return []; } })(),
        { label: `Version ${APP_VERSION.startsWith('__') ? 'dev' : APP_VERSION}`, sub: 'mise à jour', icon: 'upload', value: 'ver' }] },
    ]);
    if (v === 'brief') { const act = await briefingShow(); if (act) act(); }
    if (v === 'trash') { const ps = (await DB.all('projects')).filter(p => (p.trash || []).length); if (!ps.length) toast('La corbeille est vide'); else { const id = ps.length === 1 ? ps[0].id : await menu('Corbeille de quel chantier ?', ps.map(p => ({ label: `${p.name} · ${p.trash.length}`, icon: 'trash', value: p.id }))); if (id) openTrash(id); } }
    if (v === 'packs') openPacks();
    if (v === 'restore') restoreBackup();
    if (v === 'stock') openStorage();
    if (v === 'bgup') BgUp.openSettings();
    if (v === 'team') openMyTeam();
    if (v === 'pin') setPinDialog();
    if (v === 'feat') chooseMyFeatures();
    if (v === 'upd') checkUpdate(true);
    if (v === 'ver') showVersion();
    if (v === 'admin') location.href = 'admin.html' + (/[?&]emu=1/.test(location.search) ? '?emu=1' : '');
    if (v === 'look') { const w = await menu('Apparence', [{ label: 'Thèmes', icon: 'brush', value: 'theme' }, { label: 'Sons et effets', icon: 'disc', value: 'fx' }]); if (w === 'theme') chooseTheme(() => {}); if (w === 'fx') fxSettings(); }
    if (v === 'pdf') openPdfTools();
    if (v === 'photo') photoStudioTool();
    if (v === 'name') askName();
    if (v === 'board') openBoardTool();
    if (v === 'company') Team.openCompany();
    if (v === 'ws') Team.openSwitcher();
    if (v === 'preview') ST.startPreview();
    if (v === 'preview-off') ST.stopPreview();
    if (v === 'invite') Team.inviteFlow();
    if (v === 'logout') Team.logout();
    if (v === 'lang') chooseLang();
    if (v === 'theme') chooseTheme(() => {});
    if (v === 'splash') Splash.settings();
    if (v === 'fx') fxSettings();
  };
  const r2 = $('[data-a=restore2]'); if (r2) r2.onclick = restoreBackup;
  const nb = $('[data-a=new]'); if (nb) nb.onclick = () => newProjectDialog();
}

async function openProject(p, sec) {
  App.project = p; App.section = sec || 'plans';   // on arrive directement sur les plans (dossiers) App.search = ''; App.companyFilter = 'all'; App.taskFilter = 'all';
  p.updatedAt = Date.now(); await DB.put('projects', p);
  renderSection();
  const late = (await DB.byProject('tasks', p.id)).filter(isLate).length;
  if (late) setTimeout(() => toast(`⚠ ${late} réserve(s) en retard`), 400);
  if (featOn('reception')) setTimeout(() => pvReminder(p), 700);
}

// ---------- Structure d'un projet ----------
const SECTIONS = {
  dashboard: { label: 'Tableau de bord', icon: 'layers', render: (r) => renderDashboard(r) },
  avancement: { label: 'Avancement (lots · locaux)', icon: 'grid', render: (r) => renderAvancement(r), title: 'Avancement', subtitle: 'Lots · niveaux · locaux · engagements' },
  plans: { label: 'Plans', icon: 'plans', render: renderPlans, title: 'Plans', subtitle: 'Toutes les tâches sur les plans' },
  clauses: { label: 'Clauses techniques', icon: 'book', render: (r) => renderClauses(r) },
  tasks: { label: 'Réserves / Tâches', icon: 'tasks', render: renderTasks },
  reception: { label: 'Réception & Bétonnage', icon: 'layers', render: (r) => renderReceptions(r, 'Ferraillage'), title: 'Réception & Bétonnage', subtitle: 'Tableaux par jour' },
  beton: { label: 'Programme de bétonnage', hidden: true, icon: 'calendar', render: (r) => renderReceptions(r, 'Bétonnage'), title: 'Réception & Bétonnage', subtitle: 'Tableaux par jour' },
  photos: { label: 'Photos', icon: 'camera', render: renderPhotos },
  forms: { label: 'PV & contrôles', icon: 'form', render: renderForms },
  reports: { label: 'Rapports journaliers', icon: 'report', render: renderReports },
  constat: { label: 'Constats / NC', icon: 'report', render: (r) => renderConstats(r) },
  models3d: { label: 'Modèles 3D', icon: 'cube', render: (r) => renderModels3D(r) },
  maquette: { label: 'Maquette 3D', icon: 'cube', render: (r) => renderMaquettes(r) },
  calc: { label: 'Calculs & Topo', icon: 'ruler', render: (r) => renderCalcs(r) },
  gestion: { label: 'Gestion (stock · rendement · situations · labo)', icon: 'grid', render: (r) => renderGestion(r), title: 'Gestion du chantier', subtitle: 'Stock · rendement · attachements · labo' },
  finance: { label: 'Financier (marché · dépenses · factures · marge)', icon: 'grid', render: (r) => renderFinance(r), title: 'Financier', subtitle: 'Marché · dépenses · factures · marge' },
  tce: { label: 'TCE (tous corps d\'état)', icon: 'layers', render: (r) => renderTce(r), title: 'TCE', subtitle: 'Lots · entreprises · avancement' },
  planning: { label: 'Planning (Gantt)', icon: 'gantt', render: (r) => renderPlanning(r), title: 'Planning', subtitle: 'Prévu · réel · retards' },
  reunions: { label: 'Réunions de chantier', icon: 'meet', render: (r) => renderReunions(r), title: 'Réunions', subtitle: 'Comptes rendus · actions' },
  pointage: { label: 'Pointage main d\'œuvre', icon: 'clock', render: (r) => renderPointage(r), title: 'Pointage', subtitle: 'Présences · coût' },
  rfi: { label: 'RFI · demandes au BET', icon: 'ask', render: (r) => renderRfi(r), title: 'RFI', subtitle: 'Demandes d\'information' },
  visa: { label: 'Visas & bordereaux', icon: 'stamp', render: (r) => renderVisa(r), title: 'Visas', subtitle: 'Documents · bordereaux d\'envoi' },
  ptools: { label: 'Outils du projet', icon: 'grid', hidden: true, render: (r) => ST.renderProjectTools(r), title: 'Outils du projet' },
  lotsuivi: { label: 'Lots & équipes', icon: 'layers', render: (r) => renderLotSuivi(r), title: 'Lots & équipes', subtitle: 'Avancement · sous-traitants · rendement' },
  labo: { label: 'Laboratoire', icon: 'flask', render: (r) => renderLabo(r), title: 'Laboratoire', subtitle: 'Béton · slump · essais' },
  hse: { label: 'HSE · sécurité', icon: 'shield', render: (r) => renderHse(r), title: 'HSE', subtitle: 'Causeries · EPI · accidents · permis' },
  avenants: { label: 'Avenants & OS', icon: 'sign', render: (r) => renderAvenants(r), title: 'Avenants & OS', subtitle: 'Montants · délais' },
  st: { label: 'Sous-traitants', icon: 'hands', render: (r) => renderSt(r), title: 'Sous-traitants', subtitle: 'Contrats · situations · paiements' },
  org: { label: 'Organigramme', icon: 'org', render: (r) => renderOrg(r), title: 'Organigramme', subtitle: 'Hiérarchie du chantier' },
  team: { label: 'Équipe', icon: 'team', render: renderTeam },
  orgs: { label: 'Organisations du projet', icon: 'team', render: (r) => Team.openPartners(App.project, r), title: 'Organisations', subtitle: 'MOA · BET · architecte · groupement' },
  histo: { label: 'Historique', icon: 'history', render: (r) => Team.renderHistory(r), title: 'Historique', subtitle: 'qui a fait quoi, et quand' },
  docq: { label: 'Documentation & archives', icon: 'file', render: (r) => ST.renderDocs(r), title: 'Documentation', subtitle: 'PAQ · procédures · PV · essais · archives' },
  settings: { label: 'Paramètres', icon: 'settings', render: renderSettings },
};

async function renderSection() {
  if (!App.project || !Team.canProject(App.project.id)) return renderHome();
  BackStack.length = 0;
  if (App.section === 'reception' && !Team.canSection('reception') && Team.canSection('beton') && sectionOn('beton')) App.section = 'beton';   // v1.0.34 : bibliothèque du service
  if (!SECTIONS[App.section] || !sectionOn(App.section) || !Team.canSection(App.section)) App.section = Object.keys(SECTIONS).find(k => !SECTIONS[k].hidden && sectionOn(k) && Team.canSection(k)) || 'plans';
  pushBack(() => { if (App.fromBrief && typeof briefReopen === 'function') return briefReopen(); const home = Team.ready() ? 'ptools' : 'plans'; if (App.section !== home) { App.section = home; App.search = ''; renderSection(); } else renderHome(); });
  // retour intelligent : chaque page du chantier retrouve sa position quand on y revient
  App.secScroll = App.secScroll || {};
  const c0 = $('#content'); if (c0 && App.lastSecKey) App.secScroll[App.lastSecKey] = [c0.scrollTop, (document.scrollingElement || {}).scrollTop || 0];
  const secKey = App.project.id + '|' + App.section; App.lastSecKey = secKey;
  const s = SECTIONS[App.section];
  $('#app').classList.remove('with-bnav');
  $('#app').innerHTML = `
    <div class="topbar dark">
      <button class="iconbtn" data-a="drawer">${icon('menu')}</button>
      ${s.title ? `<div class="tb-title"><b>${esc(s.title)}</b><span class="tb-crumb">${Team.ready() && (Team.company() || {}).name ? `<a data-a="crumb">${esc(Team.company().name)}</a> › ` : ''}${esc(App.project.name)}</span></div><div class="tb-actions" id="tbActions"></div>`
        : (Team.ready() && (Team.company() || {}).name ? `<div class="tb-title"><b>${esc(App.project.name)}</b><span class="tb-crumb"><a data-a="crumb">${esc(Team.company().name)}</a> › ${esc(s.label || '')}</span></div><button class="iconbtn" data-a="home">${icon('home')}</button>` : `<h1>${esc(App.project.name)}</h1><button class="iconbtn" data-a="home">${icon('home')}</button>`)}
    </div>
    <div class="content" id="content"></div>`;
  $('[data-a=drawer]').onclick = openDrawer;
  const hb = $('[data-a=home]'); if (hb) hb.onclick = renderHome;
  const cr = $('[data-a=crumb]'); if (cr) cr.onclick = (e) => { e.stopPropagation(); renderHome(); };
  await s.render($('#content'));
  const sv = App.secScroll[secKey]; if (sv && !App.scrollFolder) requestAnimationFrame(() => { const c1 = $('#content'); if (c1 && App.lastSecKey === secKey) { c1.scrollTop = sv[0]; if (document.scrollingElement) document.scrollingElement.scrollTop = sv[1]; } });
  Team.decorateSection(App.section);
}

async function openDrawer(opts = {}) {
  // le menu s'affiche tout de suite (compteurs du dernier passage), les chiffres se mettent à jour juste après
  App.drawerCache = App.drawerCache || {};
  const dc = App.drawerCache[App.project.id] || { tasks: [], nPv: 0 };
  const tasks = dc.tasks, nPv = dc.nPv;
  Promise.all([DB.byProject('tasks', App.project.id), missingPvs(App.project.id)]).then(([t, pv]) => {
    const changed = t.length !== tasks.length || pv.length !== nPv || JSON.stringify(t.map(x => x.status)) !== JSON.stringify(tasks.map(x => x.status));
    App.drawerCache[App.project.id] = { tasks: t, nPv: pv.length };
    if (!changed || !d.isConnected) return;
    const b = d.querySelector('.pvbadge'); if (b) b.textContent = pv.length + ' PV'; else if (pv.length) { const r = d.querySelector('[data-s=reception],[data-s=beton]'); if (r) r.insertAdjacentHTML('beforeend', `<span class="count pvbadge">${pv.length} PV</span>`); }
    if (b && !pv.length) b.remove();
    $$('[data-f]', d).forEach(x => { const k = x.dataset.f, c = x.querySelector('.count'); if (c) c.textContent = k === 'late' ? t.filter(isLate).length : t.filter(y => k === 'all' || y.status === k).length; });
  });
  const cnt = (st) => tasks.filter(t => st === 'all' || t.status === st).length;
  let resOpen = false; try { resOpen = localStorage.getItem('dr.res') === '1'; } catch (e) {}
  const resRows = [['all', 'Toutes'], ['late', 'En retard'], ['open', 'Ouvertes'], ['progress', 'En cours'], ['done', 'Levées (terminées)'], ['verified', 'Vérifiées']].map(([k, l]) =>
      `<button class="item sub" data-f="${k}">${k === 'all' ? icon('tasks') : k === 'late' ? icon('calendar') : `<span class="dot" style="background:${STATUS[k].color};margin:0 5px"></span>`}<span>${l}</span><span class="count">${k === 'late' ? tasks.filter(isLate).length : cnt(k)}</span></button>`).join('');
  const bg = document.createElement('div'); bg.className = 'drawer-bg';
  const d = document.createElement('div'); d.className = 'drawer';
  d.innerHTML = `
    <div class="drawer-head"><h3>${esc(App.project.name)}</h3><button class="iconbtn" data-home>${icon('home')}</button></div>
    ${Team.ready() ? `<button class="item tm-dr" data-company>${icon('team')}<span>${esc((Team.me() || {}).name || 'Mon entreprise')}</span><span class="count" style="font-size:11.5px;opacity:.7">${esc(tmRoleOf((Team.me() || {}).role).l)}</span></button>` : ''}
    <div class="dr-scroll">${drawerSections((k) => { const s = SECTIONS[k]; return `<button class="item ${App.section === k || (k === 'reception' && App.section === 'beton') ? 'active' : ''}" data-s="${k === 'reception' && App.section === 'beton' ? 'beton' : k}">${icon(s.icon)}<span>${s.label}</span>${k === 'reception' && nPv ? `<span class="count pvbadge">${nPv} PV</span>` : ''}${k === 'tasks' ? `<span class="count dr-rt" data-rtog>${tasks.filter(t => t.status === 'open').length || ''}<i style="display:inline-block;transform:rotate(${resOpen ? 180 : 0}deg)">${icon('chevdown', 'style="width:18px;height:18px"')}</i></span>` : ''}</button>${k === 'tasks' ? `<div class="dr-sub" style="${resOpen ? '' : 'display:none'}">${resRows}</div>` : ''}`; })}
    <div class="dr-g ${(() => { try { const v = localStorage.getItem('dr.g.tools'); return v === '1'; } catch (e) { return false; } })() ? 'open' : ''}" data-g="tools"><button class="group dr-gh" data-gt="tools"><span>🧰 Outils & liens</span><i>${6 + (App.project.quickLinks || [1]).length}</i>${icon('chevdown', 'style="width:16px;height:16px"')}</button><div class="dr-gb">
    <button class="item" data-tool="pdf">${icon('pdf')}<span>Outils PDF</span><span class="count" style="font-size:12px;opacity:.6">fusionner · pages · compresser</span></button>
    <button class="item" data-tool="poutre">🧱<span>Poutre 3D</span><span class="count" style="font-size:12px;opacity:.6">plan Arche → 3D</span></button>
    <button class="item" data-tool="photo">${icon('camera')}<span>Studio photo</span><span class="count" style="font-size:12px;opacity:.6">auto · document · netteté</span></button>
    <button class="item" data-tool="board">${icon('brush')}<span>Tableau de dessin</span><span class="count" style="font-size:12px;opacity:.6">${(App.project.boards || []).length || ''}</span></button>
    <button class="item" data-tool="bar">${icon('rows')}<span>Dessiner une barre</span><span class="count" style="font-size:12px;opacity:.6">façonnage</span></button>
    <button class="item" data-tool="rap">${icon('calendar')}<span>Rappels</span>${(App.project.rappels || []).filter(x => !x.done).length ? `<span class="count">${(App.project.rappels || []).filter(x => !x.done).length}</span>` : ''}</button>
    <div class="dr-sep">🔗 Liens rapides</div>
    ${(App.project.quickLinks || [{ id: 'reception', name: 'Tableau de réception (Drive)', url: '' }]).map(q => `<button class="item" data-q="${q.id}">${icon('grid')}<span>${esc(q.name)}</span>${q.url ? `<span class="count qe" data-qe="${q.id}">${icon('edit', 'style="width:18px;height:18px;opacity:.55"')}</span>` : '<span class="count" style="font-size:12px;opacity:.6">à lier</span>'}</button>`).join('')}
    <button class="item" data-q="__add" style="color:var(--muted)">${icon('plus')}<span>Ajouter un lien</span></button></div></div>
    </div><div class="dr-foot"><button class="item ${App.section === 'settings' ? 'active' : ''}" data-s="settings">${icon('settings')}<span>Paramètres</span></button><button class="dr-org" data-a="drorg" title="Organiser le menu">${icon('edit', 'style="width:18px;height:18px"')}</button></div>`;
  document.body.append(bg, d);
  // style TikTok : le menu suit le doigt et pousse la page
  const appEl = $('#app'), W = () => d.offsetWidth || 300;
  const setP = (x, anim) => { const k = Math.max(0, Math.min(1, x / W())); [d, appEl, bg].forEach(e => e.style.transition = anim ? 'transform .22s ease-out, opacity .22s' : 'none');
    d.style.transform = `translateX(${(k - 1) * 100}%)`; bg.style.opacity = String(k); };   // le menu glisse seul, comme un rideau, par-dessus la page
  const remove = () => { bg.remove(); d.remove(); appEl.style.transform = ''; appEl.style.transition = ''; };
  const close = () => { unBack(); setP(0, true); setTimeout(remove, 230); };
  const unBack = pushBack(() => { setP(0, true); setTimeout(remove, 230); });
  d.style.animation = 'none'; bg.style.animation = 'none';
  if (opts.drag) { setP(0); opts.drag.ctl = { move: (dx) => setP(dx), end: (dx, v) => { if (dx > W() * 0.3 || v > 0.3) setP(W(), true); else close(); } }; }
  else { setP(0); requestAnimationFrame(() => setP(W(), true)); }
  bg.onclick = close;
  // glisser vers la gauche pour fermer (le menu suit le doigt)
  // glisser : on verrouille la direction (horizontal = fermer, vertical = défiler la liste), jamais les deux
  let dsx = 0, dsy = 0, dst = 0, dir = null;
  const ts = e => { dsx = e.touches[0].clientX; dsy = e.touches[0].clientY; dst = Date.now(); dir = null; };
  const tm = e => {
    const dx = e.touches[0].clientX - dsx, dy = e.touches[0].clientY - dsy;
    if (!dir && Math.hypot(dx, dy) > 8) dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    if (dir === 'h') { e.preventDefault(); d.style.overflowY = 'hidden'; setP(W() + Math.min(0, dx)); }
  };
  const te = e => { d.style.overflowY = ''; if (dir !== 'h') return; const dx = e.changedTouches[0].clientX - dsx, v = -dx / Math.max(1, Date.now() - dst); if (-dx > W() * 0.25 || v > 0.3) close(); else setP(W(), true); };
  [d, bg].forEach(x => { x.addEventListener('touchstart', ts, { passive: true }); x.addEventListener('touchmove', tm, { passive: false }); x.addEventListener('touchend', te, { passive: true }); x.addEventListener('touchcancel', te, { passive: true }); });
  $('[data-home]', d).onclick = () => { close(); renderHome(); };
  const dcb = $('[data-company]', d); if (dcb) dcb.onclick = () => { close(); Team.openCompany(); };
  drawerGroupsBind(d, close);
  const rt = $('[data-rtog]', d); if (rt) rt.onclick = (e) => { e.stopPropagation(); resOpen = !resOpen; try { localStorage.setItem('dr.res', resOpen ? '1' : '0'); } catch (x) {} $('.dr-sub', d).style.display = resOpen ? '' : 'none'; rt.querySelector('i').style.transform = `rotate(${resOpen ? 180 : 0}deg)`; };
  let lp = false;
  $$('[data-s]', d).forEach(b => { b.onclick = () => { if (lp) { lp = false; return; } close(); App.section = b.dataset.s; App.search = ''; renderSection(); };
    // appui long : monter / descendre / changer de groupe
    if (b.dataset.s !== 'settings') b.oncontextmenu = (e) => { e.preventDefault(); lp = true; setTimeout(() => { lp = false; }, 600); drMove(b.dataset.s === 'beton' ? 'reception' : b.dataset.s, () => { remove(); openDrawer(); }); }; });
  const dro = $('[data-a=drorg]', d); if (dro) dro.onclick = async () => { const k = await menu('Organiser le menu : quelle rubrique ?', [...$$('.dr-scroll [data-s]', d)].map(b => ({ label: b.querySelector('span').textContent, value: b.dataset.s === 'beton' ? 'reception' : b.dataset.s }))); if (k) drMove(k, () => { remove(); openDrawer(); }); };
  $$('[data-tool]', d).forEach(b => b.onclick = () => { close(); const t = b.dataset.tool; if (t === 'pdf') openPdfTools(); else if (t === 'photo') photoStudioTool(); else if (t === 'poutre') ptListPage(App.project); else if (t === 'board') openBoardTool(); else if (t === 'bar') openBarTool(); else if (t === 'lang') chooseLang(); else addRappel(App.project.id); });
  $$('[data-q]', d).forEach(b => b.onclick = (e) => { close(); quickLink(b.dataset.q, !!e.target.closest('[data-qe]')); });
  $$('[data-f]', d).forEach(b => b.onclick = () => { close(); App.section = 'tasks'; App.taskFilter = b.dataset.f; App.companyFilter = 'all'; renderSection(); });
}

function fab(root, onClick) {
  const b = document.createElement('button');
  b.className = 'fab'; b.innerHTML = icon('plus'); b.onclick = onClick;
  root.appendChild(b);
}

// ---------- Plans ----------
async function renderPlans(root) {
  const pid = App.project.id;
  const [folders, plans, tasks] = await Promise.all([DB.byProject('folders', pid), DB.byProject('plans', pid), DB.byProject('tasks', pid)]);
  folders.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
  plans.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
  const allPlans = plans.slice(); plans.length = 0; plans.push(...allPlans.filter(isCurrentPlan));   // seulement le dernier indice de chaque plan
  const indTag = (p) => p.indice && p.indice !== 'A' || p.prevId ? ` <span class="ind-tag">Ind. ${esc(planIndice(p))}</span>` : '';
  const q = App.search.toLowerCase();
  const shown = plans.filter(p => !q || fuzzyHas(p.name, q));
  const openCount = (planId) => tasks.filter(t => t.planId === planId && t.status !== 'verified').length;
  App.openFolders = App.openFolders || {};

  // dossiers principaux (niveaux) + sous-dossiers (parentId)
  const tops = folders.filter(f => !f.parentId || !folders.find(x => x.id === f.parentId));
  const subsOf = (fid) => folders.filter(x => x.parentId === fid);
  const fMatch = (f) => q && fuzzyHas(f.name, q);
  const plansIn = (f) => (q && fMatch(f) ? plans : shown).filter(p => p.folderId === f.id);
  const groups = tops.map(f => ({ f, plans: plansIn(f), subs: subsOf(f.id).map(sf => ({ f: sf, plans: q && fMatch(f) ? plans.filter(p => p.folderId === sf.id) : plansIn(sf) })).filter(g => !q || fMatch(f) || fMatch(g.f) || g.plans.length) }))
    .filter(g => !q || fMatch(g.f) || g.plans.length || g.subs.length);
  const loose = shown.filter(p => !p.folderId || !folders.find(f => f.id === p.folderId));
  if (loose.length) groups.push({ f: { id: '_none', name: 'Sans dossier' }, plans: loose, subs: [] });

  App.planView = App.planView || (() => { try { return localStorage.getItem('planView') || 'grid'; } catch (e) { return 'grid'; } })();
  const anyOpen = groups.some(g => App.openFolders[g.f.id]);
  const tba = $('#tbActions');
  if (tba) tba.innerHTML = `
      <button class="iconbtn" data-a="fold" title="Tout ouvrir / fermer">${icon('collapse')}</button>
      <button class="iconbtn" data-a="view" title="Vue">${icon(App.planView === 'grid' ? 'rows' : 'grid')}</button>
      <button class="iconbtn" data-a="recent" title="Récents">${icon('history')}</button>`;
  root.innerHTML = `
    <div style="height:8px"></div>
    <div class="search">${icon('search')}<input placeholder="Rechercher des plans" value="${esc(App.search)}"></div>
    ${groups.length ? '' : `<div class="empty">Aucun plan.<br>Appuyez sur <b>+</b> pour importer un plan (PDF ou image).</div>`}
    ${typeof featOn === 'function' && featOn('reception') && sectionOn('reception') && !q ? `<button class="rb-card" data-a="recbox"><span class="rb-ic">📚</span><span class="grow"><b>Plans des ouvrages du jour</b><small>Programme de réception d'aujourd'hui · <span class="rb-n">…</span></small></span>${icon('chevright')}</button>` : ''}
    <div id="folders"></div>`;
  const rbc = $('[data-a=recbox]', root);
  if (rbc) {
    rbc.onclick = () => openRecBox(pid);
    DB.byProject('receptions', pid).then(ds => { const n = ds.filter(d => d.date === todayISO() && kindOf(d) === 'Ferraillage').reduce((a, d) => a + d.rows.filter(r => r.element).length, 0); const x = $('.rb-n', rbc); if (x) x.textContent = n ? `${n} ouvrage(s) — touchez pour ajouter / ouvrir les plans` : 'aucun ouvrage aujourd\'hui'; }).catch(() => {});
  }
  const box = $('#folders', root);
  const lotOf = (p) => { const L = p.lotId && planLots(App.project).find(l => l.id === p.lotId); return L ? `<span class="lot-dot" style="background:${L.c}" title="${esc(L.name)}">${L.e}</span>` : ''; };
  // remplit une grille / liste de plans + la tuile « Ajouter un plan »
  const fillPlans = (grid, ps, f, lotF) => {
    const list = typeof lotFilter === 'function' && !q && lotF ? lotFilter(ps, lotF) : ps;
    for (const p of list) {
      const t = document.createElement('div');
      const n = openCount(p.id);
      if (App.planView === 'grid') { t.className = 'ptile'; t.innerHTML = `<div class="im"><img data-thumb="${p.fileId}" alt=""></div><div class="nm">${esc(p.name)}${indTag(p)}</div>${n ? `<span class="badge">${n}</span>` : ''}`; }
      else { t.className = 'prow'; t.innerHTML = `<span class="im"><img data-thumb="${p.fileId}" alt=""></span><div class="nm">${esc(p.name)}${indTag(p)}</div>${n ? `<span class="badge">${n}</span>` : ''}${icon('chevright')}`; }
      t.onclick = () => openPlanViewer(p, planCtx(() => renderPlans(root)));
      if (typeof planLotMenu === 'function') { t.oncontextmenu = (e) => { e.preventDefault(); planLotMenu(p, root); }; t.insertAdjacentHTML('beforeend', lotOf(p)); }
      grid.appendChild(t);
    }
    Thumbs.fill(grid);
    const add = document.createElement('div');
    add.className = App.planView === 'grid' ? 'ptile add' : 'prow';
    add.innerHTML = App.planView === 'grid' ? `${icon('plus')}<span>Ajouter un plan</span>` : `<span class="pic" style="color:var(--accent)">${icon('plus')}</span><div class="nm" style="color:var(--accent)">Ajouter un plan</div>`;
    add.onclick = async () => { const sel = lotF ? lotSelOf(lotF.id) : ''; App.newPlanLot = sel || null; try { await addPlanTo(f.id === '_none' ? null : f.id, folders, root); } finally { App.newPlanLot = null; } if (sel) renderPlans(root); };   // le plan reste dans le lot ouvert
    if (lotF && lotSelOf(lotF.id) && !list.length && ps.length) grid.insertAdjacentHTML('afterbegin', `<div class="lot-empty">Aucun plan de ce lot ici.</div>`);
    grid.appendChild(add);
  };
  const gridHTML = () => App.planView === 'grid' ? `<div class="plan-grid fw"></div>` : `<div class="plan-rows"></div>`;
  for (const { f, plans: ps, subs } of groups) {
    const open = q ? true : App.openFolders[f.id];
    const card = document.createElement('div');
    const fc = FOLDER_COLORS.find(x => x.k === f.color) || FOLDER_COLORS[0];
    const nAll = ps.length + subs.reduce((a, s) => a + s.plans.length, 0);
    card.className = 'card fcard' + (open ? ' open' : ''); card.dataset.fid = f.id; card.style.setProperty('--fc', fc.c);
    card.innerHTML = `<div class="folder-head ${f.color ? '' : 'th-fold'}" style="${f.color || !document.documentElement.classList.contains('glass') ? `background:${fc.c}` : ''}"><span class="fh-ic">📁</span>
      <div class="grow"><div class="title">${esc(f.name)}</div><div class="sub">${subs.length ? `${subs.length} dossier${subs.length > 1 ? 's' : ''} · ` : ''}${nAll} plan${nAll > 1 ? 's' : ''}</div></div>
      ${f.id !== '_none' ? `<button class="iconbtn" data-more>${icon('more')}</button>` : ''}
      <span class="fh-chev" style="transform:rotate(${open ? 180 : 0}deg)">${icon('chevdown')}</span></div>
      ${open ? `<div class="fbody">${subs.length ? '<div class="subfs"></div>' : ''}${ps.length || !subs.length ? gridHTML() : ''}${f.id !== '_none' && !q ? `<div class="fb-actions">${subs.length ? `<button class="fb-btn" data-a="addplan">${icon('plus')} Plan ici</button>` : ''}<button class="fb-btn" data-a="addsub">${icon('folder')} Sous-dossier</button></div>` : ''}</div>` : ''}`;
    box.appendChild(card);
    $('.folder-head', card).onclick = (e) => {
      if (e.target.closest('[data-more]')) return;
      App.openFolders[f.id] = !open; renderPlans(root);
    };
    const more = $('[data-more]', card);
    if (more) more.onclick = () => folderMenu(f, root);
    if (!open) continue;
    if (f.id !== '_none' && !q && typeof lotBarInto === 'function') lotBarInto(card, f, ps.concat(...subs.map(s => s.plans)), root);
    const lotF = f.id !== '_none' ? f : null;
    const grid = $('.fbody > .plan-grid, .fbody > .plan-rows', card);
    if (grid) fillPlans(grid, ps, f, lotF);
    const sb = $('[data-a=addsub]', card); if (sb) sb.onclick = () => newFolder(root, f);
    const ap = $('[data-a=addplan]', card); if (ap) ap.onclick = () => addPlanTo(f.id, folders, root);
    const sbox = $('.subfs', card);
    for (const { f: sf, plans: sps } of subs) {
      const sopen = q ? true : App.openFolders[sf.id];
      const el = document.createElement('div');
      el.className = 'subf' + (sopen ? ' open' : ''); el.dataset.fid = sf.id;
      el.innerHTML = `<div class="subf-head"><span class="sf-ic">${icon('folder')}</span>
        <div class="grow"><div class="title">${esc(sf.name)}</div><div class="sub">${sps.length} plan${sps.length > 1 ? 's' : ''}</div></div>
        <button class="iconbtn sm" data-more>${icon('more')}</button>
        <span class="sf-chev" style="transform:rotate(${sopen ? 180 : 0}deg)">${icon('chevdown')}</span></div>
        ${sopen ? gridHTML() : ''}`;
      sbox.appendChild(el);
      $('.subf-head', el).onclick = (e) => { if (e.target.closest('[data-more]')) return; App.openFolders[sf.id] = !sopen; renderPlans(root); };
      $('[data-more]', el).onclick = () => folderMenu(sf, root);
      if (sopen) fillPlans($('.plan-grid, .plan-rows', el), sps, sf, lotF);
    }
  }
  if (App.scrollFolder) { const fid = App.scrollFolder; App.scrollFolder = null; const c = box.querySelector(`[data-fid="${fid}"]`); if (c) requestAnimationFrame(() => c.scrollIntoView({ block: 'start', behavior: 'smooth' })); }
  $('[data-a=fold]').onclick = () => { groups.forEach(g => { App.openFolders[g.f.id] = !anyOpen; g.subs.forEach(sg => App.openFolders[sg.f.id] = !anyOpen); }); renderPlans(root); };
  $('[data-a=view]').onclick = () => { App.planView = App.planView === 'grid' ? 'list' : 'grid'; try { localStorage.setItem('planView', App.planView); } catch (e) {} renderPlans(root); };
  $('[data-a=recent]').onclick = async () => {
    const rec = plans.filter(p => p.lastOpened).sort((a, b) => b.lastOpened - a.lastOpened).slice(0, 8);
    if (!rec.length) return toast('Aucun plan ouvert récemment');
    const id = await menu('Plans récents', rec.map(p => ({ label: `${p.name} · ${fmtDateTime(p.lastOpened)}`, icon: 'plans', value: p.id })));
    if (id) openPlanViewer(rec.find(p => p.id === id), planCtx(() => renderPlans(root)));
  };
  const inp = $('.search input', root);
  inp.oninput = () => { App.search = inp.value; clearTimeout(inp._t); inp._t = setTimeout(() => { renderPlans(root).then(() => { const i = $('.search input', root); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 300); };

  fab(root, async () => {
    const v = await menu('Ajouter', [
      { label: 'Importer un plan (PDF / image / DWG / DXF)', icon: 'plans', value: 'plan' },
      { label: 'Importer depuis Google Drive (lien)', icon: 'drive', value: 'drive' },
      { label: 'Nouveau dossier (niveau)', icon: 'folder', value: 'folder' },
      ...(tops.length ? [{ label: 'Nouveau sous-dossier (dans un niveau)', icon: 'folder', value: 'subfolder' }] : []),
      { label: 'Outils : DWG → PDF / DXF, fusionner, diviser', icon: 'layers', value: 'tools' },
      { label: 'Comparer : deux niveaux · deux indices', icon: 'layers', value: 'lvl' },
    ]);
    if (v === 'lvl') { compareMenu(); return; }
    if (v === 'tools') return planToolsMenu(root);
    if (v === 'folder') newFolder(root, null);
    if (v === 'subfolder') {
      const pidF = await menu('Dans quel niveau ?', tops.map(f => ({ label: f.name, icon: 'folder', value: f.id })));
      if (pidF) newFolder(root, tops.find(f => f.id === pidF));
    }
    if (v === 'plan' || v === 'drive') importPlans(folders, root, v === 'drive');
  });
}

// chemin lisible d'un dossier : « R+3 › Plancher »
function folderPath(f, folders, sep = ' › ') {
  if (!f) return '';
  const par = f.parentId && (folders || []).find(x => x.id === f.parentId);
  return par ? `${par.name}${sep}${f.name}` : f.name;
}
async function newFolder(root, parent) {
  const pid = App.project.id;
  const r = await formSheet(parent ? `Sous-dossier dans « ${parent.name} »` : 'Nouveau dossier (niveau)', [{ name: 'name', label: parent ? 'Nom du sous-dossier' : 'Nom du dossier / niveau', placeholder: parent ? 'Ex : Plancher, Poteaux + voiles, Coffrage…' : 'Ex : NIV R+3, Sous-sol, Fondations…' }], { okLabel: 'Créer' });
  if (!r || !r.name) return;
  const f = await DB.put('folders', { projectId: pid, name: r.name.trim(), parentId: parent ? parent.id : null, color: parent ? parent.color : undefined });
  App.openFolders = App.openFolders || {}; App.openFolders[f.id] = true; if (parent) App.openFolders[parent.id] = true;
  App.scrollFolder = f.id;
  await renderPlans(root);
  const v = await menu(`« ${r.name.trim()} » créé ✓`, [{ label: 'Ajouter un plan maintenant', icon: 'plus', value: 'add' }, ...(parent ? [] : [{ label: 'Créer un sous-dossier dedans', icon: 'folder', value: 'sub' }]), { label: 'Plus tard', icon: 'close', value: 'no' }]);
  if (v === 'add') addPlanTo(f.id, await DB.byProject('folders', pid), root);
  if (v === 'sub') newFolder(root, f);
}

async function addPlanTo(folderId, folders, root) {
  const v = await menu('Ajouter un plan', [
    { label: 'Depuis le téléphone (PDF / image)', icon: 'plans', value: 'phone' },
    { label: 'Depuis Google Drive (lien)', icon: 'drive', value: 'drive' },
  ]);
  if (v) return importPlans(folders, root, v === 'drive', folderId);
}

const FOLDER_COLORS = [
  { k: 'nuit', l: 'Bleu nuit', c: '#24344d' }, { k: 'ardoise', l: 'Ardoise', c: '#3a4452' }, { k: 'pin', l: 'Vert sapin', c: '#24493d' },
  { k: 'petrole', l: 'Bleu pétrole', c: '#1f4750' }, { k: 'bordeaux', l: 'Bordeaux', c: '#5a2a35' }, { k: 'prune', l: 'Prune', c: '#45304f' },
  { k: 'brun', l: 'Brun', c: '#4f3b2b' }, { k: 'olive', l: 'Olive', c: '#434a2c' },
];
async function folderMenu(f, root) {
  const all = await DB.byProject('folders', App.project.id);
  const isSub = !!(f.parentId && all.find(x => x.id === f.parentId)), hasSubs = all.some(x => x.parentId === f.id);
  const tops = all.filter(x => x.id !== f.id && (!x.parentId || !all.find(y => y.id === x.parentId)));
  const v = await menu(folderPath(f, all), [{ label: 'Ajouter un plan ici', icon: 'plus', value: 'add' },
    ...(isSub ? [] : [{ label: 'Nouveau sous-dossier', icon: 'folder', value: 'sub' }]),
    { label: 'Renommer', icon: 'edit', value: 'rename' },
    ...(hasSubs ? [] : [{ label: isSub ? 'Déplacer vers un autre niveau…' : 'Mettre dans un niveau…', icon: 'layers', value: 'move' }]),
    ...(isSub ? [] : [{ label: 'Couleur', icon: 'fill', value: 'color' }]),
    { label: 'Supprimer le dossier', icon: 'trash', danger: true, value: 'del' }]);
  if (v === 'add') { App.openFolders[f.id] = true; if (f.parentId) App.openFolders[f.parentId] = true; return addPlanTo(f.id, all, root); }
  if (v === 'sub') return newFolder(root, f);
  if (v === 'move') {
    const to = await menu('Déplacer vers', [...(isSub ? [{ label: 'Dossier principal (niveau)', icon: 'folder', value: '_top' }] : []), ...tops.filter(x => x.id !== f.parentId).map(x => ({ label: x.name, icon: 'folder', value: x.id }))]);
    if (!to) return;
    f.parentId = to === '_top' ? null : to; await DB.put('folders', f);
    if (f.parentId) App.openFolders[f.parentId] = true; App.openFolders[f.id] = true;
    return renderPlans(root);
  }
  if (v === 'color') {
    const c = await menu('Couleur du dossier', FOLDER_COLORS.map(x => ({ label: x.l, value: x.k, swatch: x.c, checked: (f.color || 'nuit') === x.k })));
    if (c) { f.color = c; await DB.put('folders', f); renderPlans(root); }
  }
  if (v === 'rename') {
    const r = await formSheet('Renommer', [{ name: 'name', label: 'Nom du dossier', value: f.name }]);
    if (r && r.name) { f.name = r.name; await DB.put('folders', f); renderPlans(root); }
  }
  if (v === 'del' && await confirmBox(isSub ? `Supprimer le sous-dossier ? (ses plans iront dans « ${all.find(x => x.id === f.parentId).name} »)` : hasSubs ? 'Supprimer le dossier ? (les sous-dossiers deviennent des dossiers principaux, les plans vont dans « Sans dossier »)' : 'Supprimer le dossier ? (les plans iront dans « Sans dossier »)')) {
    const plans = await DB.byProject('plans', App.project.id);
    for (const p of plans.filter(p => p.folderId === f.id)) { p.folderId = isSub ? f.parentId : null; await DB.put('plans', p); }
    for (const x of all.filter(x => x.parentId === f.id)) { x.parentId = null; await DB.put('folders', x); }
    await DB.del('folders', f.id); renderPlans(root);
  }
}

async function importPlans(folders, root, fromDrive = false, presetFolder) {
  const pid = App.project.id;
  let folderId = presetFolder === undefined ? null : presetFolder;
  if (presetFolder === undefined && folders.length) {
    const fl = folders.map(f => ({ f, l: folderPath(f, folders) })).sort((a, b) => a.l.localeCompare(b.l, 'fr', { numeric: true }));
    folderId = await menu('Dans quel dossier ?', [...fl.map(({ f, l }) => ({ label: l, icon: 'folder', value: f.id })), { label: 'Sans dossier', icon: 'plans', value: '_none' }]);
    if (!folderId) return;
    if (folderId === '_none') folderId = null;
  }
  let files = [];
  if (fromDrive) {
    const r = await formSheet('Plan depuis Google Drive', [
      { name: 'url', label: 'Coller le lien du fichier (PDF ou image)', type: 'url', placeholder: 'https://drive.google.com/file/d/…' },
    ], { okLabel: 'Importer' });
    if (!r || !r.url) return;
    const ld0 = loading('Téléchargement depuis Drive…');
    try { files = [await downloadFromDrive(r.url)]; }
    catch (e) { ld0.close(); return alertBox(e.message); }
    ld0.close();
  } else {
    files = await pickFiles({ accept: '*/*', multiple: true });   // tout accepter : sinon Android grise les .dwg / .dxf
    const bad = files.filter(f => !/\.(pdf|dwg|dxf|jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(f.name) && !/^image\/|pdf/.test(f.type || ''));
    if (bad.length) { toast(`Ignoré : ${bad.map(f => f.name).join(', ')} (PDF, image, DWG ou DXF)`); files = files.filter(f => !bad.includes(f)); }
  }
  if (!files.length) return;
  const ld = loading('Import du plan…');
  try {
    for (const file of files) {
      const base = file.name.replace(/\.[^.]+$/, '');
      if (/\.(dwg|dxf)$/i.test(file.name)) {   // AutoCAD : DXF affiché comme plan (le DWG est expliqué)
        for (const im of await fileToPlanImages(file, pid, ld)) await DB.put('plans', { projectId: pid, folderId, lotId: App.newPlanLot || null, fileId: im.fileId, dxfFileId: im.dxfFileId, dwgFileId: im.dwgFileId || null, w: im.w, h: im.h, name: im.name, annotations: [], indice: 'A' });
        continue;
      }
      if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf' && !isRasterImage(file)) { await alertBox(`Format non pris en charge : ${file.name}`); continue; }
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        const pages = await pdfToImages(file, 5000, (p, n) => ld.set(`Conversion PDF… page ${p}/${n}`));
        // on garde le PDF original pour un affichage net quand on zoome
        const src = await DB.put('files', { projectId: pid, blob: file, mime: 'application/pdf', role: 'plansrc', name: file.name });
        for (const pg of pages) {
          const f = await DB.put('files', { projectId: pid, blob: pg.blob, mime: 'image/jpeg', role: 'plan', w: pg.w, h: pg.h, name: file.name });
          await DB.put('plans', { projectId: pid, folderId, lotId: App.newPlanLot || null, fileId: f.id, pdfFileId: src.id, pdfPage: pg.page, w: pg.w, h: pg.h, name: pages.length > 1 ? `${base} - p${pg.page}` : base, annotations: [] });
        }
      } else {
        const f = await saveImageFile(pid, file, 'plan');
        await DB.put('plans', { projectId: pid, folderId, lotId: App.newPlanLot || null, fileId: f.id, w: f.w, h: f.h, name: base, annotations: [] });
      }
    }
    if (folderId) { App.openFolders[folderId] = true; const fo = folders.find(x => x.id === folderId); if (fo && fo.parentId) App.openFolders[fo.parentId] = true; } else App.openFolders._none = true;
    toast('Plan importé ✓');
  } catch (e) {
    console.error(e); toast('Erreur d\'import : ' + e.message);
  } finally { ld.close(); renderPlans(root); }
}

function planCtx(onClose) {
  return {
    onClose,
    openTask: (t) => openTaskDetail(t),
    createTask: async (pos) => { const t = await newTask(pos); return openTaskDetail(t); },
    openLink: (l) => openLinkDetail(l),
  };
}

// ---------- Lien / élément d'ouvrage ----------
function fileKind(f) {
  const n = (f && (f.name || '')).toLowerCase(), m = (f && f.mime) || '';
  if (n.endsWith('.dwg') || n.endsWith('.dxf') || /dwg|dxf|acad/.test(m)) return 'cad';
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.dwg') || n.endsWith('.dxf')) return 'cad';
  return 'other';
}
async function openFileRecord(f, title) {
  const k = fileKind(f);
  if (k === 'image') return showImage(BlobURL.get(f.id, f.blob), title);
  if (k === 'pdf') return showPdf(f.blob, title);
  return openExternal(f);
}
// Ouvre un fichier (DWG/DXF…) avec une autre application du téléphone (AutoCAD, DWG FastView…)
async function openExternal(f) {
  const P = window.Capacitor?.Plugins || {};
  if (!P.Filesystem) { const u = URL.createObjectURL(f.blob); const a = document.createElement('a'); a.href = u; a.download = f.name || 'fichier'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); toast('Fichier téléchargé — ouvrez-le avec AutoCAD'); return; }
  const name = (f.name || 'fichier').replace(/[^\w.\- ]+/g, '_');
  const ext = name.split('.').pop().toLowerCase();
  const mime = { dwg: 'application/acad', dxf: 'application/dxf', pdf: 'application/pdf' }[ext] || f.mime || 'application/octet-stream';
  const ld = loading('Ouverture…');
  try {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f.blob); });
    await P.Filesystem.writeFile({ path: name, data: b64, directory: 'CACHE' });
    const { uri } = await P.Filesystem.getUri({ path: name, directory: 'CACHE' });
    ld.close();
    if (P.FileOpener) {
      try { await P.FileOpener.open({ filePath: uri, contentType: mime, openWithDefault: false }); return; } catch (e) { console.warn(e); }
    }
    if (P.Share) { await P.Share.share({ title: name, files: [uri], dialogTitle: 'Ouvrir avec…' }); return; }
    toast('Aucune application pour ouvrir ce fichier');
  } catch (e) {
    ld.close();
    if (!/cancel/i.test(String(e?.message))) alertBox(ext === 'dwg' || ext === 'dxf'
      ? 'Installez une application AutoCAD (ex : AutoCAD, DWG FastView) pour ouvrir ce fichier.' : 'Impossible d\'ouvrir : ' + (e.message || e));
  }
}

function openLinkDetail(link) {
  return new Promise(async (resolve) => {
    const pid = link.projectId;
    if (!link.items) link.items = [];
    let project = await DB.get('projects', pid);
    const openCats = new Set();
    const s = sheet('<div id="lk"></div>', {});
    s.onClose = () => resolve();
    const save = () => DB.put('links', link);
    const cats = () => {
      const list = [...LINK_CATS.filter(c => !c.legacy || link.items.some(i => i.cat === c.key)), ...(project.extraCats || []).map(c => ({ ...c, icon: 'hard', type: 'doc', custom: true }))];
      if (link.items.some(i => i.cat === 'autre')) list.push({ key: 'autre', label: 'Autre', icon: 'file', type: 'doc' });
      return list;
    };

    async function render() {
      const box = $('#lk', s.el);
      const files = {}, plansById = {};
      for (const it of link.items) {
        if (it.fileId && !files[it.fileId]) files[it.fileId] = await DB.get('files', it.fileId);
        if (it.planId && !plansById[it.planId]) {
          const pl = await DB.get('plans', it.planId);
          if (pl) { plansById[pl.id] = pl; files[pl.fileId] = await DB.get('files', pl.fileId); }
        }
      }
      const itemHTML = (it) => {
        const pl = it.kind === 'plan' ? plansById[it.planId] : null;
        const f = pl ? files[pl.fileId] : files[it.fileId];
        const fk = it.kind === 'file' ? fileKind(f) : null;
        const th = it.kind === 'note' ? icon('edit') : it.kind === 'url' ? icon('drive')
          : (fk === 'image' || (it.kind === 'plan' && f)) ? `<img src="${BlobURL.get(f.id, f.blob)}">` : icon(fk === 'cad' ? 'cad' : it.kind === 'plan' ? 'plans' : 'pdf');
        const nm = it.kind === 'note' ? it.text : it.kind === 'plan' ? (it.name || (pl ? pl.name : 'Plan supprimé')) : (it.name || 'Fichier');
        const tag = { url: 'Lien Drive', plan: 'Plan du projet', note: 'Note' }[it.kind] || { pdf: 'PDF', image: 'Image', cad: 'AutoCAD', other: 'Fichier' }[fk];
        return `<div class="lk-item" data-it="${it.id}"><div class="th">${th}</div>
          <div class="grow"><div class="nm">${esc(nm)}</div><div class="meta">${tag} · ${fmtDate(it.date)}</div></div>
          <button class="iconbtn sm" data-m="${it.id}">${icon('more')}</button></div>`;
      };
      const all = cats();
      const filled = all.filter(c => link.items.some(i => i.cat === c.key));
      const empty = all.filter(c => !link.items.some(i => i.cat === c.key));
      const subOf = (it) => {
        const pl = it.kind === 'plan' ? plansById[it.planId] : null, f = pl ? files[pl.fileId] : files[it.fileId];
        const fk = it.kind === 'file' ? fileKind(f) : null;
        return { url: 'Lien Drive', plan: 'Plan du projet', note: 'Note' }[it.kind] || { pdf: 'PDF', image: 'Image', cad: 'AutoCAD', other: 'Fichier' }[fk] || '';
      };
      box.innerHTML = `
        <div class="lk2-band" style="--c:${link.color}">
          <span class="lk2-ic">${pinLook(link).e ? `<span style="font-size:22px">${pinLook(link).e}</span>` : icon('link')}</span>
          <div class="grow"><div class="lk2-name">${esc(link.name)}</div><div class="lk2-sub">${link.items.length ? link.items.length + ' document(s)' : 'Aucun document'}</div></div>
          <button class="iconbtn" data-a="more">${icon('more')}</button>
        </div>
        ${link.driveFolder ? `<button class="lk2-drive" data-a="opendf">${icon('drive')}<span class="grow"><b>Dossier Drive</b><small>${esc(link.driveFolderName || 'Ouvrir le dossier')}</small></span>${icon('external')}</button>` : ''}
        ${filled.length ? `<div class="lk2-list">${filled.map(c => {
          const items = link.items.filter(i => i.cat === c.key), one = items.length === 1, open = openCats.has(c.key);
          return `<div class="lk2-cat ${open ? 'open' : ''}" data-c="${c.key}">
            <div class="lk2-row" data-row="${c.key}">
              <span class="lk2-ci">${icon(c.icon)}</span>
              <div class="grow"><div class="lk2-l">${esc(c.label)}</div><div class="lk2-s">${one ? esc((items[0].kind === 'note' ? items[0].text : items[0].name) || '') + ' · ' + subOf(items[0]) : items.length + ' documents'}</div></div>
              ${one ? `<button class="iconbtn sm" data-m="${items[0].id}">${icon('more')}</button>` : `<span class="lk2-n">${items.length}</span><span class="chev">${icon('chevdown')}</span>`}
            </div>
            ${open && !one ? `<div class="lk2-items">${items.map(it => `<div class="lk2-it" data-it="${it.id}"><span class="dot"></span><div class="grow"><div class="nm">${esc((it.kind === 'note' ? it.text : it.name) || 'Document')}</div><div class="mt">${subOf(it)} · ${fmtDate(it.date)}</div></div><button class="iconbtn sm" data-m="${it.id}">${icon('more')}</button></div>`).join('')}
              ${c.legacy ? '' : `<button class="lk2-more" data-add="${c.key}">${icon('plus')} Ajouter dans ${esc(c.label)}</button>`}</div>` : ''}
          </div>`;
        }).join('')}</div>` : `<div class="lk2-empty">Ajoutez le plan de coffrage, de ferraillage ou une coupe pour les ouvrir d'un seul appui.</div>`}
        <div class="lk2-addh">Ajouter</div>
        <div class="lk2-chips">
          ${all.filter(c => !c.legacy).map(c => `<button class="lk2-chip" data-add="${c.key}">${icon(c.icon)}<span>${esc(c.label)}</span></button>`).join('')}
          <button class="lk2-chip" data-a="dfolder">${icon('drive')}<span>${link.driveFolder ? 'Changer le dossier Drive' : 'Dossier Drive'}</span></button>
          <button class="lk2-chip m3" data-a="m3d">${icon('box')}<span>Modèle 3D</span></button>
          <button class="lk2-chip ghost" data-a="newcat">${icon('plus')}<span>Rubrique</span></button>
        </div>
        ${empty.some(c => c.custom) ? `<div class="lk2-rmrow">${empty.filter(c => c.custom).map(c => `<button data-rmcat="${c.key}">Retirer « ${esc(c.label)} »</button>`).join('')}</div>` : ''}`;

      const openItem = async (it) => {
        if (it.kind === 'url') {
          // lien Drive : on télécharge une fois, puis le fichier s'ouvre directement dans l'application
          if (driveFileId(it.url) && isNative()) {
            const ld = loading('Ouverture…');
            try {
              const file = await downloadFromDrive(it.url);
              const rec = isRasterImage(file) ? await saveImageFile(pid, file, 'doc', { source: link.name, name: file.name })
                : await DB.put('files', { projectId: pid, blob: file, mime: mimeFromName(file.name, file.type), name: file.name, role: 'doc' });
              it.kind = 'file'; it.fileId = rec.id; files[rec.id] = rec; await save(); ld.close();
              return openFileRecord(rec, it.name);
            } catch (e) { ld.close(); toast(e.message); }
          }
          return openUrl(it.url);
        }
        if (it.kind === 'note') return itemMenu(it);
        if (it.kind === 'plan') { const pl = plansById[it.planId]; if (!pl) return toast('Ce plan a été supprimé'); s.close(); return openPlanViewer(pl, planCtx(() => {})); }
        const f = files[it.fileId]; if (f) openFileRecord(f, it.name); else toast('Fichier en cours de téléchargement…');
      };
      $$('[data-row]', box).forEach(r => r.onclick = (e) => {
        const key = r.dataset.row, items = link.items.filter(i => i.cat === key);
        if (e.target.closest('[data-m]')) return itemMenu(link.items.find(i => i.id === e.target.closest('[data-m]').dataset.m));
        if (items.length === 1) return openItem(items[0]);
        openCats.has(key) ? openCats.delete(key) : openCats.add(key); render();
      });
      $$('.lk2-it', box).forEach(a => a.onclick = (e) => {
        const it = link.items.find(i => i.id === a.dataset.it);
        if (e.target.closest('[data-m]')) return itemMenu(it);
        openItem(it);
      });
      const dfb = $('[data-a=dfolder]', box); if (dfb) dfb.onclick = async () => {
        const r = await formSheet('Dossier Google Drive', [{ name: 'url', label: 'Lien du dossier Drive', type: 'url', value: link.driveFolder || '', placeholder: 'https://drive.google.com/drive/folders/…' }, { name: 'name', label: 'Nom (optionnel)', value: link.driveFolderName || '' }], { okLabel: 'Enregistrer' });
        if (!r) return; link.driveFolder = (r.url || '').trim(); link.driveFolderName = r.name || ''; await save(); render();
      };
      const odf = $('[data-a=opendf]', box); if (odf) odf.onclick = () => openUrl(link.driveFolder);
      const m3b = $('[data-a=m3d]', box); if (m3b) m3b.onclick = async () => {
        const pr = await DB.get('projects', pid), mine = (pr.models3d || []).filter(x => x.linkId === link.id);
        let m = null;
        if (mine.length) { const v = await menu('Modèles 3D de cet ouvrage', [...mine.map(x => ({ label: x.name, icon: 'box', value: x.id })), { label: 'Nouveau modèle…', icon: 'plus', value: '__new' }]); if (!v) return; m = v === '__new' ? null : mine.find(x => x.id === v); if (m) return openModel(m); }
        m = await newModelFlow({ name: link.name, linkId: link.id, planId: link.planId }); if (m) openModel(m);
      };
      $$('[data-add]', box).forEach(b => b.onclick = () => addItem(cats().find(c => c.key === b.dataset.add)));
      $$('[data-rmcat]', box).forEach(b => b.onclick = async () => { project.extraCats = (project.extraCats || []).filter(c => c.key !== b.dataset.rmcat); await DB.put('projects', project); render(); });
      $('[data-a=newcat]', box).onclick = async () => {
        const existing = new Set(cats().map(c => c.label));
        const v = await menu('Nouvelle rubrique', [...EXTRA_CAT_SUGGEST.filter(x => !existing.has(x)).map(x => ({ label: x, icon: 'hard', value: x })), { label: 'Autre nom…', icon: 'edit', value: '__other' }]);
        let label = v;
        if (v === '__other') { const r = await formSheet('Nouvelle rubrique', [{ name: 'label', label: 'Nom (ex : Plâtrerie, Charpente…)' }], { okLabel: 'Ajouter' }); label = r && r.label; }
        if (!label) return;
        const key = 'x_' + DB.uid();
        project.extraCats = [...(project.extraCats || []), { key, label }];
        await DB.put('projects', project); openCats.add(key); render();
      };
      $('[data-a=more]', box).onclick = async () => {
        const v = await menu(link.name, [
          { label: 'Renommer', icon: 'edit', value: 'rename' },
          { label: 'Icône et couleur du pin', icon: 'pin', value: 'look' },
          { label: 'Supprimer l\'élément', icon: 'trash', danger: true, value: 'del' },
        ]);
        if (v === 'rename') {
          const r = await formSheet('Renommer', [{ name: 'name', label: 'Nom', value: link.name }]);
          if (r && r.name) { link.name = r.name; await save(); render(); }
        }
        if (v === 'look') { if (await choosePinLook(link)) render(); }
        if (v === 'color') {
          const c = await menu('Couleur', PALETTE.filter(c => c !== '#ffffff').map(c => ({ label: c, value: c, checked: c === link.color })));
          if (c) { link.color = c; await save(); render(); }
        }
        if (v === 'del' && await confirmBox('Supprimer cet élément et tous ses documents ?')) {
          for (const it of link.items) if (it.fileId) await DB.del('files', it.fileId);
          await DB.del('links', link.id); s.close();
        }
      };
    }

    async function itemMenu(it) {
      const f = it.fileId ? await DB.get('files', it.fileId) : null;
      const v = await menu(it.kind === 'note' ? 'Note' : (it.name || 'Document'), [
        ...(it.kind === 'note' ? [{ label: 'Modifier la note', icon: 'edit', value: 'editnote' }] : [{ label: 'Renommer', icon: 'edit', value: 'rename' }]),
        ...(f ? [{ label: 'Ouvrir avec une autre application', icon: 'external', value: 'ext' }] : []),
        ...(it.url ? [{ label: 'Ouvrir le lien Drive', icon: 'drive', value: 'url' }] : []),
        { label: 'Supprimer', icon: 'trash', danger: true, value: 'del' },
      ]);
      if (v === 'rename') { const r = await formSheet('Renommer', [{ name: 'name', label: 'Nom du document', value: it.name || '' }]); if (r && r.name) { it.name = r.name; await save(); } }
      if (v === 'editnote') { const r = await formSheet('Note', [{ name: 'text', label: 'Note', type: 'textarea', value: it.text }]); if (r && r.text) { it.text = r.text; await save(); } }
      if (v === 'ext') openExternal(f);
      if (v === 'url') openUrl(it.url);
      if (v === 'del' && await confirmBox('Supprimer ce document ?')) {
        link.items = link.items.filter(i => i !== it);
        if (it.fileId) await DB.del('files', it.fileId);
        await save();
      }
      render();
    }

    async function askName(def) {
      const r = await formSheet('Nom du document', [{ name: 'name', label: 'Nom (ex : Coffrage poteaux R+2 indice B)', value: def }], { okLabel: 'Enregistrer' });
      return r ? (r.name || def) : null;
    }
    async function storeFile(cat, file, name) {
      let rec;
      if (isRasterImage(file)) rec = await saveImageFile(pid, file, cat.type === 'photo' ? 'photo' : 'doc', { source: link.name, name: file.name });
      else rec = await DB.put('files', { projectId: pid, blob: file, mime: mimeFromName(file.name, file.type), name: file.name, role: 'doc' });
      link.items.push({ id: DB.uid(), cat: cat.key, kind: 'file', fileId: rec.id, name, date: Date.now() });
    }

    async function addItem(cat) {
      openCats.add(cat.key);
      if (cat.type === 'note') {
        const r = await formSheet('Nouvelle note', [{ name: 'text', label: 'Note', type: 'textarea', placeholder: 'Ex : Enrobage insuffisant côté axe C, à reprendre avant coulage' }], { okLabel: 'Ajouter' });
        if (r && r.text) { link.items.push({ id: DB.uid(), cat: cat.key, kind: 'note', text: r.text, date: Date.now() }); await save(); }
        return render();
      }
      const opts = cat.type === 'photo' ? [['cam', 'camera', 'Prendre une photo'], ['gal', 'image', 'Galerie']]
        : cat.type === 'pv' ? [['cam', 'camera', 'Prendre une photo'], ['gal', 'image', 'Galerie'], ['phone', 'phone', 'Fichier du téléphone (PDF…)'], ['drive', 'drive', 'Google Drive (lien)']]
        : [['phone', 'phone', 'Depuis le téléphone (PDF, image, AutoCAD DWG/DXF)'], ['drive', 'drive', 'Depuis Google Drive (lien)'], ['plan', 'plans', 'Lier un plan du projet']];
      const how = await menu(`Ajouter · ${cat.label}`, opts.map(([v, i, l]) => ({ value: v, icon: i, label: l })));
      if (!how) return render();

      if (how === 'plan') {
        const [plans, folders] = await Promise.all([DB.byProject('plans', pid), DB.byProject('folders', pid)]);
        const others = plans.filter(p => p.id !== link.planId);
        if (!others.length) { toast('Importez d\'abord ce plan dans « Plans »'); return render(); }
        const fname = (id) => folderPath(folders.find(f => f.id === id), folders);
        others.sort((a, b) => `${fname(a.folderId) || ''} ${a.name}`.localeCompare(`${fname(b.folderId) || ''} ${b.name}`, 'fr', { numeric: true }));
        const planId = await menu('Choisir le plan', others.map(p => ({ label: (fname(p.folderId) ? fname(p.folderId) + ' / ' : '') + p.name, icon: 'plans', value: p.id })));
        if (!planId) return render();
        const name = await askName(others.find(p => p.id === planId).name);
        if (name === null) return render();
        link.items.push({ id: DB.uid(), cat: cat.key, kind: 'plan', planId, name, date: Date.now() }); await save();
        return render();
      }
      if (how === 'drive') {
        const r = await formSheet('Google Drive', [
          { name: 'url', label: 'Coller le lien du fichier', type: 'url', placeholder: 'https://drive.google.com/file/d/…' },
          { name: 'name', label: 'Nom du document', placeholder: cat.label },
        ], { okLabel: 'Ajouter' });
        if (!r || !r.url) return render();
        if (driveFileId(r.url) && isNative()) {
          const ld = loading('Téléchargement depuis Drive…');
          try {
            const file = await downloadFromDrive(r.url);
            await storeFile(cat, file, r.name || file.name.replace(/\.[^.]+$/, ''));
            link.items[link.items.length - 1].url = r.url;
            await save(); toast('Fichier Drive enregistré ✓'); ld.close(); return render();
          } catch (e) { ld.close(); toast(e.message); }
        }
        link.items.push({ id: DB.uid(), cat: cat.key, kind: 'url', url: r.url, name: r.name || cat.label, date: Date.now() }); await save();
        return render();
      }
      const accept = how === 'phone' ? '*/*' : 'image/*';
      const files = await pickFiles({ accept, multiple: how !== 'cam', capture: how === 'cam' });
      if (!files.length) return render();
      for (const file of files) {
        const def = file.name.replace(/\.[^.]+$/, '');
        const name = cat.type === 'photo' || how === 'cam' ? def : await askName(def);
        if (name === null) continue;
        const ld = loading('Enregistrement…');
        try { await storeFile(cat, file, name); } finally { ld.close(); }
      }
      await save(); render();
    }
    render();
  });
}

// ---------- Tâches ----------
async function newTask(extra = {}) {
  const tasks = await DB.byProject('tasks', App.project.id);
  const num = tasks.reduce((m, t) => Math.max(m, t.num || 0), 0) + 1;
  return DB.put('tasks', { projectId: App.project.id, num, kind: 'reserve', companyId: App.companyFilter && !['all', 'none'].includes(App.companyFilter) ? App.companyFilter : '', title: '', status: 'open', priority: 2, assignee: '', category: '', due: '', description: '', photoIds: [], log: [{ t: Date.now(), msg: 'Créée' }], ...extra });
}

async function renderTasks(root) {
  const pid = App.project.id; const p = App.project;
  const [tasks, plans] = await Promise.all([DB.byProject('tasks', pid), DB.byProject('plans', pid)]);
  const planName = (id) => (plans.find(x => x.id === id) || {}).name || '';
  const q = App.search.toLowerCase();
  const comps = p.companies || [];
  const byCo = (t) => App.companyFilter === 'all' || (App.companyFilter === 'none' ? !t.companyId : t.companyId === App.companyFilter);
  const bySt = (t, k) => k === 'all' || (k === 'late' ? isLate(t) : k === 'toLift' ? !isLifted(t) : k === 'lifted' ? isLifted(t) : t.status === k);
  const base = tasks.filter(byCo);
  const list = base.filter(t => bySt(t, App.taskFilter) &&
    (!q || fuzzyHas(`${t.num} ${t.title} ${t.assignee} ${t.category} ${(companyOf(p, t.companyId) || {}).name || ''}`, q)))
    .sort((a, b) => (isLate(b) - isLate(a)) || b.num - a.num);
  const stChips = [['all', 'Toutes'], ['late', 'En retard'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])];
  if (!stChips.find(c => c[0] === App.taskFilter)) stChips.splice(1, 0, [App.taskFilter, { toLift: 'À lever', lifted: 'Levées' }[App.taskFilter] || App.taskFilter]);
  root.innerHTML = `
    <div class="pagehead"><h2>Réserves / Tâches</h2><p>${base.length} élément(s)${App.companyFilter !== 'all' ? ' · ' + esc(App.companyFilter === 'none' ? 'Sans entreprise' : (companyOf(p, App.companyFilter) || {}).name || '') : ''}</p></div>
    <div class="search">${icon('search')}<input placeholder="Rechercher" value="${esc(App.search)}"></div>
    ${comps.length ? `<div class="chips">${[['all', 'Toutes entreprises', '#5b8def'], ...comps.map(c => [c.id, c.name, c.color]), ['none', 'Sans entreprise', '#64748b']].map(([k, l, col]) =>
      `<button class="chip ${App.companyFilter === k ? 'on' : ''}" data-co="${k}" ${App.companyFilter === k ? `style="background:${col};border-color:${col}"` : ''}>${k !== 'all' ? `<span class="dot" style="background:${col};width:9px;height:9px;margin-right:5px"></span>` : ''}${esc(l)}</button>`).join('')}</div>` : ''}
    <div class="chips" style="padding-top:0">${stChips.map(([k, l]) =>
      `<button class="chip ${App.taskFilter === k ? 'on' : ''}" data-f="${k}">${l} (${base.filter(t => bySt(t, k)).length})</button>`).join('')}</div>
    <div style="padding:0 16px 10px"><button class="btn ghost small" data-a="pdf">${icon('report')} Rapport PDF</button></div>
    ${list.length ? `<div class="list">${list.map(t => { const c = companyOf(p, t.companyId); const late = isLate(t); return `
      <div class="row" data-id="${t.id}"><span class="tasknum" style="background:${STATUS[t.status].color}">${t.num}</span>
        <div class="grow"><div class="title">${esc(t.title || 'Sans titre')}</div>
        <div class="sub">${c ? `<span class="dot" style="background:${c.color};width:8px;height:8px"></span> ${esc(c.name)} · ` : ''}${[KINDS[t.kind || 'reserve'], planName(t.planId) && '📍 ' + planName(t.planId), t.due && '⏰ ' + fmtDate(t.due)].filter(Boolean).map(esc).join(' · ')}</div></div>
        ${late ? `<span class="late-badge">Retard</span>` : `<span style="color:${['', '#ef4444', '#f59e0b', '#9aa3b2'][t.priority || 2]};font-weight:700;font-size:13px">P${t.priority || 2}</span>`}</div>`; }).join('')}</div>`
    : `<div class="empty">Rien ici.<br>Créez une réserve avec <b>+</b> ou placez un pin sur un plan.</div>`}`;
  $$('[data-f]', root).forEach(b => b.onclick = () => { App.taskFilter = b.dataset.f; renderTasks(root); });
  $$('[data-co]', root).forEach(b => b.onclick = () => { App.companyFilter = b.dataset.co; renderTasks(root); });
  $('[data-a=pdf]', root).onclick = () => reservesReportDialog({ company: App.companyFilter });
  $$('.row[data-id]', root).forEach(r => r.onclick = async () => { await openTaskDetail(tasks.find(t => t.id === r.dataset.id)); renderTasks(root); });
  const inp = $('.search input', root);
  inp.oninput = () => { App.search = inp.value; clearTimeout(inp._t); inp._t = setTimeout(() => renderTasks(root).then(() => { const i = $('.search input', root); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 300); };
  fab(root, async () => { const t = await newTask(); await openTaskDetail(t); renderTasks(root); });
}

function openTaskDetail(task) {
  return new Promise(async (resolve) => {
    const pid = task.projectId;
    let project = await DB.get('projects', pid);
    const team = (project.team || []).map(m => m.name);
    const plan = task.planId ? await DB.get('plans', task.planId) : null;
    if (!task.kind) task.kind = 'reserve';
    const el = document.createElement('div');
    el.className = 'fullpage';
    document.body.appendChild(el);
    const done = () => { el.remove(); resolve(); };
    const unBack = pushBack(async () => { await flush(); done(); });

    let saveT;
    const save = () => { clearTimeout(saveT); saveT = setTimeout(() => DB.put('tasks', task), 400); };
    const flush = async () => { clearTimeout(saveT); if (!task.title) task.title = 'Nouvelle tâche'; await DB.put('tasks', task); };
    const log = (msg) => { task.log = task.log || []; task.log.push({ t: Date.now(), msg }); };

    async function render() {
      const photos = await loadFiles(task.photoIds);
      el.innerHTML = `
        <div class="topbar">
          <button class="iconbtn" data-a="back">${icon('back')}</button>
          <span class="tasknum" style="background:${STATUS[task.status].color};margin-left:6px">${task.num}</span>
          <h1>${KINDS[task.kind]} #${task.num}</h1>
          <button class="iconbtn" data-a="share">${icon('share')}</button>
          <button class="iconbtn" data-a="more">${icon('more')}</button>
        </div>
        <div class="content"><div class="form" style="padding-top:16px">
          <div class="fld">Type<div class="seg seg3">${Object.entries(KINDS).map(([k, l]) => `<button data-kind="${k}" class="${task.kind === k ? 'on' : ''}" style="${task.kind === k ? 'background:var(--accent)' : ''}">${l}</button>`).join('')}</div></div>
          <label>Titre<input name="title" value="${esc(task.title)}" placeholder="Ex : Reprise enrobage poteau P12"></label>
          <label>Entreprise (lot)<select name="_company"><option value="">— Aucune —</option>${(project.companies || []).map(c => `<option value="${c.id}" ${task.companyId === c.id ? 'selected' : ''}>${esc(c.name)} · ${esc(c.lot)}</option>`).join('')}<option value="__new">+ Nouvelle entreprise…</option></select></label>
          <div class="fld">Statut<div class="seg">${Object.entries(STATUS).map(([k, v]) => `<button data-st="${k}" class="${task.status === k ? 'on' : ''}" style="${task.status === k ? `background:${v.color}` : ''}">${v.label}</button>`).join('')}</div></div>
          <div class="fld">Priorité<div class="seg seg3">${[1, 2, 3].map(p => `<button data-pr="${p}" class="${task.priority === p ? 'on' : ''}" style="${task.priority === p ? `background:${['', '#ef4444', '#f59e0b', '#6b7280'][p]}` : ''}">Priorité ${p}</button>`).join('')}</div></div>
          <div class="kv">
            <label>Responsable<input name="assignee" list="dl-team" value="${esc(task.assignee)}" placeholder="Nom"></label>
            <label>Échéance${isLate(task) ? ' <b style="color:var(--orange)">· en retard</b>' : ''}<input name="due" type="date" value="${esc(task.due)}"></label>
          </div>
          <label>Catégorie<input name="category" list="dl-cat" value="${esc(task.category)}" placeholder="Gros œuvre, Ferraillage…"></label>
          <label>Description<textarea name="description" placeholder="Détails, localisation, axe…">${esc(task.description)}</textarea></label>
          ${plan ? `<button class="btn ghost" data-a="plan">${icon('pin')} Voir sur le plan : ${esc(plan.name)}</button>` : ''}
          <label>Photos</label>${thumbsHTML(photos)}
          <div class="fld">Commentaire<div style="display:flex;gap:8px"><input name="_comment" placeholder="Ajouter un commentaire…"><button class="btn small" data-a="comment">OK</button></div></div>
          <div class="log">${(task.log || []).slice().reverse().map(l => `<div><b>${fmtDateTime(l.t)}</b> — ${esc(l.msg)}</div>`).join('')}</div>
        </div></div>
        <datalist id="dl-team">${team.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        <datalist id="dl-cat">${CATEGORIES.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;

      $('[data-a=back]', el).onclick = async () => { unBack(); await flush(); done(); };
      $$('input[name]:not([name=_comment]), textarea[name]', el).forEach(i => i.oninput = () => { task[i.name] = i.value; save(); });
      $$('[data-kind]', el).forEach(b => b.onclick = (e) => { e.preventDefault(); task.kind = b.dataset.kind; save(); render(); });
      $('[name=_company]', el).onchange = async (e) => {
        if (e.target.value === '__new') {
          const c = await editCompany(project);
          project = await DB.get('projects', pid);
          if (c) { task.companyId = c.id; log(`Entreprise : ${c.name}`); }
          save(); return render();
        }
        const c = companyOf(project, e.target.value);
        task.companyId = e.target.value; log(`Entreprise : ${c ? c.name : 'aucune'}`); save();
      };
      $$('[data-st]', el).forEach(b => b.onclick = (e) => {
        e.preventDefault(); if (task.status === b.dataset.st) return;
        log(`Statut : ${STATUS[task.status].label} → ${STATUS[b.dataset.st].label}`); task.status = b.dataset.st; save(); render();
      });
      $$('[data-pr]', el).forEach(b => b.onclick = (e) => { e.preventDefault(); task.priority = +b.dataset.pr; save(); render(); });
      $('[data-a=addphoto]', el).onclick = async (e) => {
        e.preventDefault();
        const recs = await addPhotos(pid, { source: `Tâche #${task.num}` });
        if (recs.length) { task.photoIds.push(...recs.map(r => r.id)); log(`${recs.length} photo(s) ajoutée(s)`); await DB.put('tasks', task); render(); }
      };
      $$('.thumbs .t[data-id]', el).forEach(t => t.onclick = async (e) => {
        const id = t.dataset.id;
        if (e.target.closest('[data-del]')) {
          e.preventDefault();
          if (await confirmBox('Supprimer cette photo ?')) { task.photoIds = task.photoIds.filter(x => x !== id); await DB.del('files', id); await DB.put('tasks', task); render(); }
          return;
        }
        showGallery(photos.map(f => ({ src: BlobURL.get(f.id, f.blob), caption: `Tâche #${task.num}` })), photos.findIndex(p => p.id === id));
      });
      $('[data-a=comment]', el).onclick = (e) => {
        e.preventDefault(); const i = $('[name=_comment]', el);
        if (i.value.trim()) { log('💬 ' + i.value.trim()); save(); render(); }
      };
      const pb = $('[data-a=plan]', el);
      if (pb) pb.onclick = async (e) => { e.preventDefault(); await flush(); openPlanViewer(await DB.get('plans', plan.id), planCtx(() => {})); };
      $('[data-a=share]', el).onclick = () => shareWhatsApp(
        `*${project.name}*\n${KINDS[task.kind]} #${task.num} : ${task.title}\n` + (companyOf(project, task.companyId) ? `Entreprise : ${companyOf(project, task.companyId).name}\n` : '') + `Statut : ${STATUS[task.status].label} · Priorité ${task.priority}\n` +
        (task.assignee ? `Responsable : ${task.assignee}\n` : '') + (task.due ? `Échéance : ${fmtDate(task.due)}\n` : '') +
        (plan ? `Plan : ${plan.name}\n` : '') + (task.description ? `\n${task.description}` : ''));
      $('[data-a=more]', el).onclick = async () => {
        const v = await menu(`Tâche #${task.num}`, [{ label: 'Supprimer la tâche', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'del' && await confirmBox('Supprimer cette tâche ?')) {
          clearTimeout(saveT);
          for (const id of task.photoIds) await DB.del('files', id);
          await DB.del('tasks', task.id); unBack(); done();
        }
      };
      if (!task.title) setTimeout(() => $('[name=title]', el)?.focus(), 200);
    }
    render();
  });
}

// ---------- Photos ----------
async function renderPhotos(root) {
  const pid = App.project.id;
  const files = (await DB.byProject('files', pid)).filter(f => f.role === 'photo').sort((a, b) => b.createdAt - a.createdAt);
  root.innerHTML = `<div class="pagehead"><h2>Photos</h2><p>${files.length} photo(s)</p></div>
    ${files.length ? `<div class="photo-grid">${files.map(f => `<div class="ph" data-id="${f.id}"><img src="${BlobURL.get(f.id, f.blob)}" loading="lazy">${f.source ? `<span class="tag">${esc(f.source)}</span>` : ''}</div>`).join('')}</div>`
    : `<div class="empty">Aucune photo.<br>Prenez des photos du chantier avec <b>+</b>.</div>`}`;
  $$('.ph', root).forEach(p => p.onclick = () => showGallery(files.map(f => ({ src: BlobURL.get(f.id, f.blob), caption: `${f.source || 'Photo'} · ${fmtDateTime(f.createdAt)}` })), files.findIndex(x => x.id === p.dataset.id)));
  fab(root, async () => { const r = await addPhotos(pid); if (r.length) { toast(`${r.length} photo(s) ajoutée(s)`); renderPhotos(root); } });
}

// ---------- Formulaires (contrôle qualité) ----------
function formStats(f) {
  const n = f.items.length, ok = f.items.filter(i => i.res === 'ok').length, nok = f.items.filter(i => i.res === 'nok').length, na = f.items.filter(i => i.res === 'na').length;
  const answered = ok + nok + na;
  // v1.0.42 : « Réserve » + mesures hors tolérance (PV intelligents)
  const res = f.items.filter(i => i.res === 'res').length, mb = typeof pvMesOk === 'function' ? (f.mes || []).filter(m => pvMesOk(m) === false).length : 0;
  const answered2 = answered + res;
  const status = n && answered2 === n ? (nok || mb ? 'Non conforme' : res ? 'Conforme avec réserves' : 'Conforme') : 'En cours';
  return { n, ok, nok, na, res, mb, answered: answered2, status, color: status === 'Conforme' ? 'var(--green)' : status === 'Non conforme' ? 'var(--red)' : status === 'Conforme avec réserves' ? '#d97706' : 'var(--orange)' };
}
async function renderForms(root) {
  const all = (await DB.byProject('forms', App.project.id)).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
  const S = all.map(f => [f, formStats(f)]), flt = App.pvFilt || 'all';
  const cnt = { all: S.length, cours: S.filter(([, s]) => s.status === 'En cours').length, res: S.filter(([, s]) => s.status === 'Conforme avec réserves').length, nc: S.filter(([, s]) => s.status === 'Non conforme').length, ok: S.filter(([, s]) => s.status === 'Conforme').length };
  const keep = S.filter(([, s]) => flt === 'all' || (flt === 'cours' && s.status === 'En cours') || (flt === 'res' && s.status === 'Conforme avec réserves') || (flt === 'nc' && s.status === 'Non conforme') || (flt === 'ok' && s.status === 'Conforme'));
  const lotN = (id) => ((typeof lsLots === 'function' ? lsLots(App.project) : []).find(l => l.id === id) || {}).name;
  root.innerHTML = `<div class="pagehead"><h2>PV & contrôles</h2><p>PV de réception par service : check-list, mesures, verdict, réserves</p></div>
    ${S.length ? `<div class="pv-kpi">${[['all', 'Tous', ''], ['cours', 'En cours', 'b'], ['res', 'Réserves', 'o'], ['nc', 'Non conf.', 'r'], ['ok', 'Conformes', 'g']].map(([k, l, c]) => `<button class="${c} ${flt === k ? 'on' : ''}" data-pf="${k}"><b>${cnt[k]}</b><small>${l}</small></button>`).join('')}</div>` : ''}
    ${keep.length ? `<div class="list">${keep.map(([f, s]) => { const T = typeof pvTpl === 'function' && pvTpl(f.templateId); return `
      <div class="row" data-id="${f.id}"><span class="pv-ic" style="color:${s.color}">${T ? T.e : icon('form')}</span>
        <div class="grow"><div class="title">${f.ref ? `<small class="pv-ref">${esc(f.ref)}</small> ` : ''}${esc(f.title)}</div>
        <div class="sub">${[f.niv, f.location, lotN(f.lotId)].filter(Boolean).map(esc).join(' · ')}${f.niv || f.location ? '<br>' : ''}<span style="color:${s.color};font-weight:600">${s.status}</span> · ${s.answered}/${s.n} · ${fmtDate(f.date)} ${Team.ready() && !ST.isPerso() ? ST.vChip(f) : ''}</div>
        <div class="progress"><div style="width:${s.n ? s.answered / s.n * 100 : 0}%;background:${s.color}"></div></div></div></div>`; }).join('')}</div>`
    : `<div class="empty">${S.length ? 'Aucun PV dans ce filtre.' : 'Aucun PV.<br>Appuyez sur <b>+</b> : les PV de votre service (ferraillage, coffrage, bétonnage, implantation, essais…) sont proposés en premier.'}</div>`}`;
  $$('[data-pf]', root).forEach(b => b.onclick = () => { App.pvFilt = b.dataset.pf; renderForms(root); });
  $$('.row[data-id]', root).forEach(r => r.onclick = async () => { await openFormDetail(all.find(f => f.id === r.dataset.id)); renderForms(root); });
  fab(root, async () => {
    const f = await pvCreate(App.project); if (!f) return;
    await openFormDetail(f); renderForms(root);
  });
}

function openFormDetail(form) {
  if (form && form.v2 && typeof openPvDetail === 'function') return openPvDetail(form);
  return new Promise(async (resolve) => {
    const project = await DB.get('projects', form.projectId);
    const el = document.createElement('div'); el.className = 'fullpage'; document.body.appendChild(el);
    let saveT; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => DB.put('forms', form), 400); };
    const finish = async () => { clearTimeout(saveT); await DB.put('forms', form); el.remove(); resolve(); };
    const unBack = pushBack(finish);
    if (!form.photoIds) form.photoIds = [];

    async function render() {
      const s = formStats(form);
      const photos = await loadFiles(form.photoIds);
      el.innerHTML = `
        <div class="topbar"><button class="iconbtn" data-a="back">${icon('back')}</button><h1>${esc(form.title)}</h1>
          <button class="iconbtn" data-a="share">${icon('share')}</button><button class="iconbtn" data-a="more">${icon('more')}</button></div>
        <div class="content"><div class="form" style="padding-top:16px">
          <div style="color:${s.color};font-weight:600">${s.status} · ✔ ${s.ok} · ✘ ${s.nok} · N/A ${s.na}</div>
          ${ST.vBox(form)}
          <label>Localisation (ouvrage / axe / niveau)<input name="location" value="${esc(form.location)}" placeholder="Ex : Poteaux SSL axes C10–C15"></label>
          <div class="kv"><label>Date<input name="date" type="date" value="${esc(form.date)}"></label>
          <label>Contrôlé par<input name="inspector" value="${esc(form.inspector)}"></label></div>
          <label>Entreprise contrôlée<select name="companyId"><option value="">— Aucune —</option>${(project.companies || []).map(c => `<option value="${c.id}" ${form.companyId === c.id ? 'selected' : ''}>${esc(c.name)} · ${esc(c.lot)}</option>`).join('')}</select></label>
          <div>${form.items.map((it, i) => `<div class="check-item" data-i="${i}"><div class="lbl">${i + 1}. ${esc(it.label)}</div>
            <div class="seg seg3">${[['ok', 'Conforme'], ['nok', 'Non conf.'], ['na', 'N/A']].map(([k, l]) => `<button data-r="${k}" class="${it.res === k ? 'on ' + k : ''}">${l}</button>`).join('')}</div>
            ${it.res === 'nok' || it.comment ? `<input data-c value="${esc(it.comment)}" placeholder="Commentaire / réserve">` : ''}</div>`).join('')}</div>
          <button class="btn ghost" data-a="additem">${icon('plus')} Ajouter un point de contrôle</button>
          <label>Observations<textarea name="notes">${esc(form.notes)}</textarea></label>
          <label>Photos</label>${thumbsHTML(photos)}
          <div class="fld">Signature du contrôleur<div class="sigbox" data-sig="sigCtrl"></div></div>
          <div class="fld">Signature de l'entreprise<div class="sigbox" data-sig="sigEnt"></div></div>
          <button class="btn" data-a="pdf">${icon('report')} Générer le PV (PDF)</button>
        </div></div>`;
      $('[data-a=back]', el).onclick = () => { unBack(); finish(); };
      $$('input[name], textarea[name], select[name]', el).forEach(i => i.oninput = i.onchange = () => { form[i.name] = i.value; save(); });
      ST.vBind(el, form, async () => { clearTimeout(saveT); await DB.put('forms', form); render(); });
      $$('.sigbox', el).forEach(b => signaturePad(b, form[b.dataset.sig], (v) => { form[b.dataset.sig] = v; save(); }));
      $('[data-a=pdf]', el).onclick = async () => { clearTimeout(saveT); await DB.put('forms', form); formPdf(form); };
      $$('.check-item', el).forEach(ci => {
        const it = form.items[+ci.dataset.i];
        $$('[data-r]', ci).forEach(b => b.onclick = () => { it.res = it.res === b.dataset.r ? null : b.dataset.r; save(); render(); });
        const c = $('[data-c]', ci); if (c) c.oninput = () => { it.comment = c.value; save(); };
      });
      $('[data-a=additem]', el).onclick = async () => {
        const r = await formSheet('Point de contrôle', [{ name: 'label', label: 'Libellé' }], { okLabel: 'Ajouter' });
        if (r && r.label) { form.items.push({ label: r.label, res: null, comment: '' }); save(); render(); }
      };
      $('[data-a=addphoto]', el).onclick = async () => {
        const recs = await addPhotos(form.projectId, { source: form.title });
        if (recs.length) { form.photoIds.push(...recs.map(r => r.id)); save(); render(); }
      };
      $$('.thumbs .t[data-id]', el).forEach(t => t.onclick = async (e) => {
        const id = t.dataset.id;
        if (e.target.closest('[data-del]')) { if (await confirmBox('Supprimer cette photo ?')) { form.photoIds = form.photoIds.filter(x => x !== id); await DB.del('files', id); save(); render(); } return; }
        showGallery(photos.map(f => ({ src: BlobURL.get(f.id, f.blob), caption: form.title })), photos.findIndex(p => p.id === id));
      });
      $('[data-a=share]', el).onclick = () => {
        const mark = { ok: '✅', nok: '❌', na: '➖' };
        shareWhatsApp(`*${project.name}*\n*${form.title}*${form.location ? ' — ' + form.location : ''}\nDate : ${fmtDate(form.date)}${form.inspector ? ' · ' + form.inspector : ''}\nRésultat : *${s.status}*\n\n` +
          form.items.map((it, i) => `${mark[it.res] || '⬜'} ${i + 1}. ${it.label}${it.comment ? ' — ' + it.comment : ''}`).join('\n') +
          (form.notes ? `\n\nObservations : ${form.notes}` : ''));
      };
      $('[data-a=more]', el).onclick = async () => {
        const v = await menu(form.title, [{ label: 'Générer le PV (PDF)', icon: 'report', value: 'pdf' }, { label: 'Supprimer le formulaire', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'pdf') { clearTimeout(saveT); await DB.put('forms', form); return formPdf(form); }
        if (v === 'del' && await confirmBox('Supprimer ce formulaire ?')) {
          clearTimeout(saveT); for (const id of form.photoIds) await DB.del('files', id);
          await DB.del('forms', form.id); unBack(); el.remove(); resolve();
        }
      };
    }
    render();
  });
}

// ---------- Rapports journaliers ----------
async function renderReports(root) {
  const reports = (await DB.byProject('reports', App.project.id)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  root.innerHTML = `<div class="pagehead"><h2>Rapports journaliers</h2><p>Suivi quotidien du chantier</p></div>
    ${reports.length ? `<div class="list">${reports.map(r => `
      <div class="row" data-id="${r.id}"><span class="icon-muted">${icon('calendar')}</span>
        <div class="grow"><div class="title">${fmtDate(r.date)}</div>
        <div class="sub">${[r.weather, r.workers && `${r.workers} ouvriers`, (r.works || '').split('\n')[0]].filter(Boolean).map(esc).join(' · ')}</div></div></div>`).join('')}</div>`
    : `<div class="empty">Aucun rapport.<br>Appuyez sur <b>+</b> pour le rapport d'aujourd'hui.</div>`}`;
  $$('.row[data-id]', root).forEach(r => r.onclick = async () => { await openReportDetail(reports.find(x => x.id === r.dataset.id)); renderReports(root); });
  fab(root, async () => {
    const r = await DB.put('reports', { projectId: App.project.id, date: todayISO(), weather: 'Ensoleillé', temp: '', workers: '', equipment: '', works: '', deliveries: '', issues: '', photoIds: [] });
    await openReportDetail(r); renderReports(root);
  });
}

function openReportDetail(rep) {
  return new Promise(async (resolve) => {
    const project = await DB.get('projects', rep.projectId);
    const el = document.createElement('div'); el.className = 'fullpage'; document.body.appendChild(el);
    let saveT; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => DB.put('reports', rep), 400); };
    const finish = async () => { clearTimeout(saveT); await DB.put('reports', rep); el.remove(); resolve(); };
    const unBack = pushBack(finish);
    async function render() {
      const photos = await loadFiles(rep.photoIds);
      el.innerHTML = `
        <div class="topbar"><button class="iconbtn" data-a="back">${icon('back')}</button><h1>Rapport du ${fmtDate(rep.date)}</h1>
          <button class="iconbtn" data-a="share">${icon('share')}</button><button class="iconbtn" data-a="more">${icon('more')}</button></div>
        <div class="content"><div class="form" style="padding-top:16px">
          <div class="kv"><label>Date<input name="date" type="date" value="${esc(rep.date)}"></label>
            <label>Météo<select name="weather">${WEATHER.map(w => `<option ${w === rep.weather ? 'selected' : ''}>${w}</option>`).join('')}</select></label></div>
          <div class="kv"><label>Effectif (ouvriers)<input name="workers" type="number" inputmode="numeric" value="${esc(rep.workers)}"></label>
            <label>Température (°C)<input name="temp" type="number" inputmode="numeric" value="${esc(rep.temp)}"></label></div>
          <label>Engins / matériel<input name="equipment" value="${esc(rep.equipment)}" placeholder="Grue, pompe à béton…"></label>
          <label>Travaux réalisés<textarea name="works" placeholder="- Coulage poteaux SSL axes C10–C15&#10;- Ferraillage voiles V3">${esc(rep.works)}</textarea></label>
          <label>Livraisons<textarea name="deliveries" style="min-height:60px" placeholder="Béton 24 m³, acier HA12…">${esc(rep.deliveries)}</textarea></label>
          <label>Problèmes / observations<textarea name="issues" style="min-height:60px">${esc(rep.issues)}</textarea></label>
          <label>Photos</label>${thumbsHTML(photos)}
        </div></div>`;
      $('[data-a=back]', el).onclick = () => { unBack(); finish(); };
      $$('[name]', el).forEach(i => i.oninput = i.onchange = () => { rep[i.name] = i.value; save(); if (i.name === 'date') $('h1', el).textContent = 'Rapport du ' + fmtDate(rep.date); });
      $('[data-a=addphoto]', el).onclick = async () => {
        const recs = await addPhotos(rep.projectId, { source: 'Rapport ' + fmtDate(rep.date) });
        if (recs.length) { rep.photoIds.push(...recs.map(r => r.id)); save(); render(); }
      };
      $$('.thumbs .t[data-id]', el).forEach(t => t.onclick = async (e) => {
        const id = t.dataset.id;
        if (e.target.closest('[data-del]')) { if (await confirmBox('Supprimer cette photo ?')) { rep.photoIds = rep.photoIds.filter(x => x !== id); await DB.del('files', id); save(); render(); } return; }
        showGallery(photos.map(f => ({ src: BlobURL.get(f.id, f.blob), caption: 'Rapport' })), photos.findIndex(p => p.id === id));
      });
      $('[data-a=share]', el).onclick = () => shareWhatsApp(
        `*${project.name}*\n*Rapport journalier du ${fmtDate(rep.date)}*\nMétéo : ${rep.weather}${rep.temp ? ` (${rep.temp}°C)` : ''}\n` +
        (rep.workers ? `Effectif : ${rep.workers} ouvriers\n` : '') + (rep.equipment ? `Engins : ${rep.equipment}\n` : '') +
        (rep.works ? `\n*Travaux réalisés :*\n${rep.works}\n` : '') + (rep.deliveries ? `\n*Livraisons :*\n${rep.deliveries}\n` : '') +
        (rep.issues ? `\n*Problèmes :*\n${rep.issues}` : ''));
      $('[data-a=more]', el).onclick = async () => {
        const v = await menu('Rapport', [{ label: 'Rapport PDF', icon: 'report', value: 'pdf' }, { label: 'Supprimer le rapport', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'pdf') { clearTimeout(saveT); await DB.put('reports', rep); return dailyPdf(rep); }
        if (v === 'del' && await confirmBox('Supprimer ce rapport ?')) {
          clearTimeout(saveT); for (const id of rep.photoIds) await DB.del('files', id);
          await DB.del('reports', rep.id); unBack(); el.remove(); resolve();
        }
      };
    }
    render();
  });
}

// ---------- Équipe ----------
async function renderTeam(root) {
  const p = App.project; p.team = p.team || []; p.companies = p.companies || [];
  const tasks = await DB.byProject('tasks', p.id);
  root.innerHTML = `<div class="pagehead"><h2>Équipe</h2><p>Entreprises (lots) et intervenants</p></div>
    ${Affectations.active() && !Team.sharedOf(p.id) ? '<button class="btn ghost" data-a="affectations">Équipe projet & affectations</button>' : ''}
    <div class="section-label" style="display:flex;align-items:center">Entreprises / lots<button class="btn small ghost" data-a="addco" style="margin-left:auto">${icon('plus')} Ajouter</button></div>
    ${p.companies.length ? `<div class="list">${p.companies.map(c => { const ts = tasks.filter(t => t.companyId === c.id); return `
      <div class="row" data-co="${c.id}"><span class="tasknum" style="background:${c.color}">${esc((c.name || '?')[0].toUpperCase())}</span>
        <div class="grow"><div class="title">${esc(c.name)}</div><div class="sub">${[c.lot, c.contact].filter(Boolean).map(esc).join(' · ')}</div></div>
        <span class="sub" style="color:var(--muted)">${ts.filter(t => !isLifted(t)).length} à lever</span></div>`; }).join('')}</div>`
    : `<div class="empty" style="padding:20px 24px">Ajoutez les entreprises du chantier (gros œuvre, électricité, plomberie…) pour leur affecter des réserves.</div>`}
    <div class="section-label" style="display:flex;align-items:center">Intervenants<button class="btn small ghost" data-a="addm" style="margin-left:auto">${icon('plus')} Ajouter</button></div>
    ${p.team.length ? `<div class="list">${p.team.map((m, i) => `
      <div class="row" data-i="${i}"><span class="tasknum" style="background:var(--accent)">${esc((m.name || '?')[0].toUpperCase())}</span>
        <div class="grow"><div class="title">${esc(m.name)}</div><div class="sub">${[m.role, m.phone].filter(Boolean).map(esc).join(' · ')}</div></div></div>`).join('')}</div>`
    : `<div class="empty" style="padding:20px 24px">Ajoutez les personnes (chef de chantier, contrôleur…) pour les nommer responsables.</div>`}
    ${Team.ready() ? `<div class="section-label" style="display:flex;align-items:center">Organisations du projet<button class="btn small ghost" data-a="partners" style="margin-left:auto">${icon('team')} Gérer</button></div>
    <div class="empty" style="padding:20px 24px">Maître d'ouvrage, BET, architecte, laboratoire, membres du groupement… Chaque organisation travaille dans ce projet avec ses propres comptes et ne voit que les modules accordés.</div>` : ''}
    ${Team.ready() && !Team.sharedOf(p.id) ? `<div class="section-label" style="display:flex;align-items:center">Partage simple (sans compte)<button class="btn small ghost" data-a="extshare" style="margin-left:auto">${icon('share')} Partager</button></div>
    <div class="empty" style="padding:20px 24px">Donnez à un maître d'ouvrage, un BET, un sous-traitant… un accès limité à ce projet, sans l'ajouter à votre entreprise.</div>` : ''}`;
  const af = $('[data-a=affectations]', root); if (af) af.onclick = () => Affectations.open(p);
  const edit = async (m, i) => {
    const r = await formSheet(m ? 'Modifier' : 'Nouvel intervenant', [
      { name: 'name', label: 'Nom', value: m?.name }, { name: 'role', label: 'Fonction / entreprise', value: m?.role }, { name: 'phone', label: 'Téléphone', type: 'tel', value: m?.phone },
    ], { danger: m ? 'Retirer de l\'équipe' : null });
    if (!r) return;
    if (r.__danger) p.team.splice(i, 1);
    else if (r.name) { if (m) p.team[i] = r; else p.team.push(r); }
    await DB.put('projects', p); renderTeam(root);
  };
  $$('.row[data-i]', root).forEach(r => r.onclick = () => edit(p.team[+r.dataset.i], +r.dataset.i));
  $$('.row[data-co]', root).forEach(r => r.onclick = async () => {
    const c = p.companies.find(x => x.id === r.dataset.co);
    const v = await menu(c.name, [{ label: 'Voir ses réserves', icon: 'tasks', value: 'list' }, { label: 'Rapport PDF de l\'entreprise', icon: 'report', value: 'pdf' }, { label: 'Modifier', icon: 'edit', value: 'edit' }]);
    if (v === 'list') { App.section = 'tasks'; App.taskFilter = 'all'; App.companyFilter = c.id; renderSection(); }
    if (v === 'pdf') reservesReportDialog({ company: c.id });
    if (v === 'edit') { await editCompany(p, c); renderTeam(root); }
  });
  $('[data-a=addco]', root).onclick = async () => { await editCompany(p); renderTeam(root); };
  $('[data-a=addm]', root).onclick = () => edit(null);
  const extsh = $('[data-a=extshare]', root); if (extsh) extsh.onclick = () => Team.openProjectShares(p);
  const ptn = $('[data-a=partners]', root); if (ptn) ptn.onclick = () => Team.openPartners(p);
  fab(root, async () => {
    const v = await menu('Ajouter', [{ label: 'Entreprise / lot', icon: 'hard', value: 'co' }, { label: 'Intervenant', icon: 'team', value: 'm' }]);
    if (v === 'co') { await editCompany(p); renderTeam(root); } if (v === 'm') edit(null);
  });
}

// ---------- Paramètres ----------
async function renderSettings(root) {
  const p = App.project;
  root.innerHTML = `<div class="pagehead"><h2>Paramètres</h2></div>
    <div class="form" style="padding-top:12px">
      <label>Nom du projet<input name="name" value="${esc(p.name)}"></label>
      <label>Adresse / ville<input name="address" value="${esc(p.address)}"></label>
      <label>Titre complet sur les tableaux / PDF (optionnel)<input name="pdfTitle" value="${esc(p.pdfTitle || '')}" placeholder="Ex : Projet de construction du Grand stade Benslimane"></label>
      <label>Maître d'ouvrage<input name="mo" value="${esc(p.mo || '')}" placeholder="Ex : SONARGES, ONEE, Commune…"></label>
      <button class="btn" data-a="save">Enregistrer</button>
      <div style="height:12px"></div>
      <div class="card" style="margin:0 0 12px;padding:14px" data-fxbox></div>
      ${Org.owner() ? `<button class="btn ghost" data-a="welcome" style="margin-bottom:12px">👋 Revoir l'écran de bienvenue (service et poste)</button>` : ''}
      <div class="sync-card" data-a="sync" style="margin:0 0 12px"><div class="cl">☁</div><div class="grow"><b>Synchronisation Google Drive</b><div data-syncstate>${Sync.statusLine()}</div></div>${icon('chevright')}</div>
      <div class="card" style="margin:0;padding:16px">
        <div style="font-weight:600;margin-bottom:6px">Sauvegarde manuelle (fichier)</div>
        <div style="color:var(--muted);font-size:14px;line-height:1.5;margin-bottom:12px">Crée un fichier <b>.chantier</b> avec tout le projet (plans, pins, tâches, photos, formulaires, rapports). Enregistrez-le dans Google Drive ou envoyez-le sur WhatsApp. Pour le récupérer : accueil → ⋮ → Restaurer une sauvegarde.</div>
        <button class="btn" data-a="backup" style="width:100%">${icon('share')} Sauvegarder ce projet</button>
        <button class="btn ghost" data-a="pfiche" style="width:100%;margin-top:8px">${icon('file')} Fiche projet (essentiel + avancé)</button>
        ${Team.ready() && Team.isPerso() ? `<button class="btn ghost" data-a="pcollab" style="width:100%;margin-top:8px">${icon('team')} Inviter un collaborateur${Team.plan().k === 'pro' ? '' : ' · avec Pro'}</button>` : ''}
        <button class="btn ghost" data-a="pfeat" style="width:100%;margin-top:8px">${icon('grid')} Type de projet & fonctions du projet${p.type && projTypeOf(p.type) ? ' · ' + projTypeOf(p.type).e : ''}</button>
        <button class="btn ghost" data-a="stock" style="width:100%;margin-top:8px">${icon('cloud')} Stockage du téléphone · libérer de l'espace</button>
      </div>
      <div style="height:20px"></div>
      <button class="btn danger" data-a="del">${icon('trash')} Supprimer le projet</button>
      <p style="color:var(--muted);font-size:13px;line-height:1.5">Les données sont enregistrées sur l'appareil (fonctionne sans internet). Avec Google Drive connecté, tout est aussi copié dans votre Drive et partagé entre téléphone et PC : après une réinstallation, reconnectez Drive avec votre code de connexion pour tout récupérer.<br>Version ${APP_VERSION.startsWith('__') ? 'dev' : APP_VERSION}</p>
    </div>`;
  $('[data-a=sync]', root).onclick = () => Sync.openSyncSettings();
  $('[data-a=stock]', root).onclick = () => openStorage();
  $('[data-a=pfeat]', root).onclick = () => projectFeaturesDialog(p);
  $('[data-a=pfiche]', root).onclick = () => ST.projectFiche(p);
  const pcb = $('[data-a=pcollab]', root); if (pcb) pcb.onclick = () => Team.collabFlow(p);
  const wb = $('[data-a=welcome]', root); if (wb) wb.onclick = () => orgOnboard(true);
  fxPanel($('[data-fxbox]', root));
  $('[data-a=save]', root).onclick = async () => { p.name = $('[name=name]', root).value.trim() || p.name; p.address = $('[name=address]', root).value.trim(); p.pdfTitle = $('[name=pdfTitle]', root).value.trim(); p.mo = $('[name=mo]', root).value.trim(); await DB.put('projects', p); toast('Enregistré ✓'); renderSection(); };
  $('[data-a=backup]', root).onclick = async () => {
    const ld = loading('Préparation de la sauvegarde…');
    try {
      await Backup.exportProject(p.id, (i, n) => ld.set(`Sauvegarde… ${i}/${n}`));
      p.lastBackup = Date.now(); await DB.put('projects', p);
    } catch (e) { console.error(e); alertBox('Erreur de sauvegarde : ' + (e.message || e)); }
    finally { ld.close(); }
  };
  $('[data-a=del]', root).onclick = async () => {
    if (await confirmBox(`Supprimer « ${p.name} » et toutes ses données ?`)) { await DB.deleteProject(p.id); renderHome(); }
  };
}

// ---------- Liens rapides (ex : tableau de réception Excel dans Drive) ----------
async function quickLink(id, editOnly = false) {
  const p = App.project;
  p.quickLinks = p.quickLinks || [{ id: 'reception', name: 'Tableau de réception (Drive)', url: '' }];
  const edit = async (q) => {
    const r = await formSheet(q ? `Lien : ${q.name}` : 'Nouveau lien rapide', [
      { name: 'name', label: 'Nom dans le menu', value: q?.name || '', placeholder: 'Ex : Tableau de réception, Planning…' },
      { name: 'url', label: 'Lien Google Drive / Sheets du fichier Excel', type: 'url', value: q?.url || '', placeholder: 'https://docs.google.com/spreadsheets/…' },
    ], { okLabel: 'Enregistrer', danger: q ? 'Supprimer ce lien' : null });
    if (!r) return null;
    if (r.__danger) { p.quickLinks = p.quickLinks.filter(x => x !== q); await DB.put('projects', p); return null; }
    if (!r.url) { toast('Collez le lien du fichier'); return null; }
    if (q) Object.assign(q, { name: r.name || q.name, url: r.url });
    else { q = { id: DB.uid(), name: r.name || 'Lien', url: r.url }; p.quickLinks.push(q); }
    await DB.put('projects', p);
    return q;
  };
  if (id === '__add') { const q = await edit(null); if (q) toast('Lien ajouté au menu ✓'); return; }
  const q = p.quickLinks.find(x => x.id === id);
  if (!q) return;
  if (!q.url || editOnly) { const r = await edit(q); if (r && !editOnly) openUrl(r.url); return; }
  openUrl(q.url); // ouverture directe (Google Sheets / Drive)
}

// ---------- Restauration ----------
async function restoreBackup() {
  const files = await pickFiles({ accept: '*/*', multiple: false });
  if (!files.length) return;
  const ld = loading('Restauration…');
  try {
    const p = await Backup.importFile(files[0], (n) => ld.set(`Restauration… ${n} éléments`));
    ld.close();
    if (p) { toast('Projet restauré ✓'); openProject(await DB.get('projects', p.id)); }
  } catch (e) {
    ld.close(); console.error(e); alertBox('Restauration impossible : ' + (e.message || e));
  }
}

// ---------- Retour : bouton Android + glisser du bord gauche vers la droite ----------
// Ordre : fermer la fenêtre ouverte → revenir au tableau de bord du projet → revenir à l'accueil (dernière page)
function navBack() {
  if (goBack()) return true;
  if (App.project && App.section !== 'plans') { App.section = 'plans'; App.search = ''; renderSection(); return true; }
  if (App.project) { renderHome(); return true; }
  return false;
}
function initSwipeBack() {
  // Bande invisible le long du bord DROIT : glisser légèrement vers la gauche = retour.
  // touch-action:none → le navigateur ne « vole » pas le geste (sinon il annule le glissement).
  const TRIGGER = 32;
  const strip = document.createElement('div'); strip.id = 'swipeEdge'; document.body.appendChild(strip);
  let sx = 0, sy = 0, t0 = 0, on = false, fired = false, ind = null;
  const allowed = () => !document.querySelector('.viewer, .sketch, .lightbox') && (App.project || BackStack.length);
  const show = (d) => {
    if (!ind) { ind = document.createElement('div'); ind.className = 'swipe-back right'; ind.innerHTML = icon('chevright'); document.body.appendChild(ind); }
    ind.style.top = sy + 'px';
    ind.style.transform = `translate(${44 - Math.min(d * 1.4, 60)}px, -50%) rotate(180deg)`; ind.style.opacity = String(0.4 + Math.min(1, d / TRIGGER) * 0.6);
    ind.classList.toggle('ready', d >= TRIGGER);
  };
  const hide = () => { if (ind) { ind.remove(); ind = null; } };
  const passTap = (x, y) => { strip.style.pointerEvents = 'none'; const t = document.elementFromPoint(x, y); strip.style.pointerEvents = ''; if (t) { t.click(); if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) t.focus(); } };
  strip.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; t0 = Date.now(); on = true; fired = false; try { strip.setPointerCapture(e.pointerId); } catch (er) {} });
  strip.addEventListener('pointermove', (e) => {
    if (!on || fired) return;
    const d = sx - e.clientX;
    if (!allowed()) return;
    if (d > 4) show(d);
    if (d >= TRIGGER && Math.abs(e.clientY - sy) < 80) { fired = true; hide(); try { navigator.vibrate && navigator.vibrate(12); } catch (er) {} navBack(); }
  });
  const end = (e) => {
    if (!on) return; on = false; hide();
    const d = sx - e.clientX, moved = Math.abs(d) + Math.abs(e.clientY - sy);
    if (!fired && moved < 8 && Date.now() - t0 < 500) passTap(e.clientX, e.clientY);   // simple appui → transmis à l'élément dessous
  };
  strip.addEventListener('pointerup', end); strip.addEventListener('pointercancel', (e) => { on = false; hide(); });
}

// ---------- Bouton « Plans » accessible partout ----------
function initPlansButton() {
  const b = document.createElement('button'); b.id = 'plansFab'; b.title = 'Plans'; b.innerHTML = icon('plans');
  document.body.appendChild(b);
  b.onclick = () => {
    if (document.body.classList.contains('pq-on')) { for (let i = 0; i < 12 && document.querySelector('.plansq'); i++) if (!navBack()) break; return; }
    openPlansQuick();
  };
  let was = null;
  const upd = () => { b.style.display = App.project && !document.querySelector('.av-page') ? '' : 'none';
    const on = !!document.querySelector('.plansq'); document.body.classList.toggle('pq-on', on);
    if (on !== was) { was = on; b.innerHTML = icon(on ? 'close' : 'plans'); b.classList.toggle('on', on); } };
  setInterval(upd, 300); upd();
}
async function openPlansQuick() {
  if (!App.project || document.querySelector('.plansq')) return;
  const pid = App.project.id;
  const [plans, folders] = await Promise.all([DB.byProject('plans', pid), DB.byProject('folders', pid)]);
  const el = document.createElement('div'); el.className = 'fullpage plansq'; document.body.appendChild(el);
  const close = () => { unBack(); el.remove(); };
  const unBack = pushBack(() => el.remove());
  let q = '';
  const groups = [...folders.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { numeric: true })).map(f => ({ id: f.id, name: folderPath(f, folders) })).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })), { id: null, name: 'Sans dossier' }];
  async function render() {
    const match = (p) => !q || fuzzyHas(p.name, q);
    const html = [];
    for (const g of groups) {
      const ps = plans.filter(p => (p.folderId || null) === g.id && match(p)).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { numeric: true }));
      if (!ps.length) continue;
      const shut = !q && (App.pqShut || {})[g.id || '_'];
      html.push(`<button class="pq-h ${shut ? 'shut' : ''}" data-g="${g.id || '_'}">${icon('folder')} ${esc(g.name)} <span>${ps.length}</span><i class="grow"></i>${icon('chevdown')}</button><div class="pq-grid" style="${shut ? 'display:none' : ''}">${ps.map(p => `<button class="pq-t" data-p="${p.id}"><span class="pq-img"><img data-thumb="${p.fileId}" alt=""></span><span class="pq-n">${esc(p.name)}</span></button>`).join('')}</div>`);
    }
    $('.pq-body', el).innerHTML = html.join('') || `<div class="empty">${plans.length ? 'Aucun plan trouvé' : 'Aucun plan dans ce projet.<br>Ajoutez-les dans « Plans ».'}</div>`;
    Thumbs.fill(el);
    $$('[data-g]', el).forEach(h => h.onclick = () => { App.pqShut = App.pqShut || {}; const k = h.dataset.g, sh = !App.pqShut[k]; App.pqShut[k] = sh; h.classList.toggle('shut', sh); h.nextElementSibling.style.display = sh ? 'none' : ''; });
    $$('[data-p]', el).forEach(t => t.onclick = () => { const pl = plans.find(p => p.id === t.dataset.p); openPlanViewer(pl, planCtx(() => {})); });
  }
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('close')}</button><h1 style="flex:1">Plans</h1></div>
    <div class="search" style="margin:10px 16px 4px">${icon('search')}<input placeholder="Rechercher un plan…"></div>
    <div class="pq-body"></div>`;
  $('[data-a=x]', el).onclick = close;
  $('.search input', el).oninput = (e) => { q = e.target.value.trim().toLowerCase(); render(); };
  render();
}

// ---------- Démarrage ----------
(function init() {
  // Bouton retour Android
  const capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (capApp) capApp.addListener('backButton', () => { if (!navBack()) capApp.exitApp(); });
  initSwipeBack();
  initPlansButton();
  // glisser depuis le bord gauche vers la droite = ouvrir le menu
  const de = document.createElement('div'); de.id = 'drawerEdge'; document.body.appendChild(de);
  let esx = 0, esy = 0, est = 0, eon = false, drag = null;
  de.addEventListener('touchstart', e => { const t = e.touches[0]; esx = t.clientX; esy = t.clientY; est = Date.now(); drag = null; eon = !!App.project && !document.querySelector('.fullpage, .viewer, .sheet-bg, .drawer, .lightbox'); }, { passive: true });
  de.addEventListener('touchmove', e => { if (!eon) return; const t = e.touches[0], dx = t.clientX - esx, dy = t.clientY - esy;
    if (!drag && dx > 6 && Math.abs(dx) > Math.abs(dy)) { drag = {}; openDrawer({ drag }); }
    if (drag) { e.preventDefault(); if (drag.ctl) drag.ctl.move(dx); } }, { passive: false });
  de.addEventListener('touchend', e => { if (drag && drag.ctl) { const dx = e.changedTouches[0].clientX - esx; drag.ctl.end(dx, dx / Math.max(1, Date.now() - est)); } eon = false; drag = null; }, { passive: true });
  // glisser vers la droite n'importe où sur la page (sauf zones qui défilent horizontalement) = ouvrir le menu
  const hScroll = (el) => { for (let x = el; x && x !== document.body; x = x.parentElement) { if (/^(INPUT|TEXTAREA|SELECT|CANVAS)$/.test(x.tagName)) return true; const cs = getComputedStyle(x); if (/(auto|scroll)/.test(cs.overflowX) && x.scrollWidth > x.clientWidth + 2) return true; } return false; };
  let gx = 0, gy = 0, gt = 0, gon = false, gdrag = null;
  document.addEventListener('touchstart', e => { gon = false; gdrag = null; if (e.target === de || e.touches.length > 1) return; const t = e.touches[0]; gx = t.clientX; gy = t.clientY; gt = Date.now();
    gon = !!App.project && gx < innerWidth * 0.6 && !document.querySelector('.fullpage, .viewer, .sheet-bg, .drawer, .lightbox, .sketch, .lock') && !!e.target.closest('#app') && !hScroll(e.target); }, { passive: true });
  document.addEventListener('touchmove', e => { if (!gon) return; const t = e.touches[0], dx = t.clientX - gx, dy = t.clientY - gy;
    if (!gdrag) { if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { gon = false; return; } if (dx > 22 && dx > Math.abs(dy) * 1.8) { gdrag = { off: dx }; openDrawer({ drag: gdrag }); } else return; }
    e.preventDefault(); if (gdrag.ctl) gdrag.ctl.move(dx - gdrag.off + 20); }, { passive: false });
  const gend = e => { if (gdrag && gdrag.ctl) { const dx = e.changedTouches[0].clientX - gx; gdrag.ctl.end(dx, dx / Math.max(1, Date.now() - gt)); } gon = false; gdrag = null; };
  document.addEventListener('touchend', gend, { passive: true }); document.addEventListener('touchcancel', gend, { passive: true });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  try { Splash.boot(); } catch (e) {}
  // v1.0.36 : temps de démarrage mesuré (fichiers · connexion · accueil), visible dans le menu ⋮ › Application
  const tTeam0 = Date.now();
  Team.boot().catch(e => console.error('team', e)).finally(() => { const tTeam1 = Date.now(); Promise.resolve(renderHome()).finally(() => { try { const t0 = window.__t0 || tTeam0, ts = window.__tScripts || tTeam0, now = Date.now();
      localStorage.setItem('boot.t', JSON.stringify({ total: now - t0, scripts: Math.max(0, ts - t0), team: tTeam1 - tTeam0, home: now - tTeam1, at: now })); } catch (e) {} }); Sync.start(); setTimeout(() => checkUpdate(false).catch(() => {}), 2500); try { dwgCrashCheck(); } catch (e) {} setTimeout(showWhatsNew, 1800); setTimeout(() => otaBoot().catch(() => {}), 1200); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(false).catch(() => {}); });
  // hors ligne : petite pastille en haut
  const net = () => { let b = document.getElementById('offBadge'); if (navigator.onLine) { if (b) b.remove(); return; } if (!b) { b = document.createElement('div'); b.id = 'offBadge'; b.textContent = '⚡ Hors ligne'; b.onclick = () => toast('Pas d\'internet : les photos et fichiers de Drive se chargeront au retour du réseau'); document.body.appendChild(b); } };
  window.addEventListener('online', () => { net(); toast('✓ Connexion rétablie'); try { Sync.schedule(1500); } catch (e) {} }); window.addEventListener('offline', net); net();
  // sauvegarde : rappel chaque semaine (fichier .zip) ; la synchro Drive tourne en continu
  setTimeout(async () => { try {
    const ps = await DB.all('projects'), old = ps.filter(p => !p.lastBackup || Date.now() - p.lastBackup > 7 * 864e5);
    const k = 'bkRemind', last = +(localStorage.getItem(k) || 0);
    if (old.length && Date.now() - last > 3 * 864e5) { localStorage.setItem(k, Date.now()); toast(`💾 ${old.length} projet(s) sans sauvegarde depuis 7 jours`, { action: 'Sauvegarder', onAction: () => openStorage() }); }
  } catch (e) {} }, 9000);
  // photos partagées depuis la galerie (Partager → Chantier)
  setTimeout(() => checkSharedIntent().catch(e => console.warn('share', e)), 300);
  // toucher la notification « photos sauvegardées » → proposer de libérer l'espace
  try { const LN = window.Capacitor?.Plugins?.LocalNotifications; if (LN) LN.addListener('localNotificationActionPerformed', (a) => { if (a?.notification?.extra?.action === 'freephotos') setTimeout(freeOldPhotos, 600); if (a?.notification?.extra?.action === 'jobrobot') setTimeout(() => openCareer({ robot: true }), 600); }); } catch (e) {}
  // message après une mise à jour
  try {
    const prev = localStorage.getItem('appVersion');
    if (!APP_VERSION.startsWith('__') && prev !== APP_VERSION) {
      localStorage.setItem('appVersion', APP_VERSION);
      if (prev) setTimeout(() => toast(`✓ Mise à jour ${APP_VERSION} installée`), 600);
    }
  } catch (e) {}
})();

// ---------- Rappels (avec notification sur le téléphone si possible) ----------
const notifId = (x) => Math.abs([...x.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % 2000000000;
async function scheduleNotif(p, x) {
  const LN = window.Capacitor?.Plugins?.LocalNotifications; if (!LN || !x.at || x.at.length <= 10) return;
  try {
    const perm = await LN.requestPermissions(); if (perm.display !== 'granted') return;
    const at = new Date(x.at); if (at < new Date()) return;
    try { await LN.createChannel({ id: 'rappels', name: 'Rappels de chantier', description: 'Sonnerie des rappels', importance: 5, visibility: 1, vibration: true, lights: true }); } catch (e) {}
    await LN.schedule({ notifications: [{ id: notifId(x), title: `🔔 ${p.name}`, body: x.text, channelId: 'rappels', schedule: { at, allowWhileIdle: true } }] });
  } catch (e) { console.warn('notif', e); }
}
function cancelNotif(x) { const LN = window.Capacitor?.Plugins?.LocalNotifications; if (LN) LN.cancel({ notifications: [{ id: notifId(x) }] }).catch(() => {}); }
async function addRappel(pid, editId) {
  const p0 = await DB.get('projects', pid), old = editId ? (p0.rappels || []).find(x => x.id === editId) : null;
  const r = await formSheet(old ? 'Modifier le rappel' : 'Nouveau rappel', [
    { name: 'text', label: 'Rappel', value: old ? old.text : '', placeholder: 'Ex : Relancer SGTM pour les PV du 10/10' },
    { name: 'date', label: 'Date', type: 'date', value: old ? (old.at || '').slice(0, 10) : todayISO() },
    { name: 'time', label: 'Heure — sonnerie sur le téléphone (optionnel)', type: 'time', value: old && old.at && old.at.length > 10 ? old.at.slice(11, 16) : '' },
  ], { okLabel: old ? 'Enregistrer' : 'Ajouter' });
  if (!r || !r.text) return;
  const p = await DB.get('projects', pid);
  const at = r.date ? r.date + (r.time ? 'T' + r.time : '') : '';
  let x;
  if (old) { x = (p.rappels || []).find(y => y.id === editId); cancelNotif(x); Object.assign(x, { text: r.text, at }); }
  else { x = { id: DB.uid(), text: r.text, at, done: false, createdAt: Date.now() }; p.rappels = [...(p.rappels || []), x]; }
  await DB.put('projects', p);
  await scheduleNotif(p, x);
  toast(r.time ? 'Rappel enregistré — sonnerie programmée 🔔' : 'Rappel enregistré ✓');
  if (!App.project) { App.homeOpen = App.homeOpen || {}; App.homeOpen[pid] = true; renderHome(); }
  else App.project = p;
}

// ---------- Maquette 3D (lien Autodesk Viewer / BIM 360 / autre) ----------
const DEFAULT_3D = 'https://viewer.autodesk.com/id/dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6YTM2MHZpZXdlci1wcm90ZWN0ZWQvdDE3Nzg0ODUwMDNfYzc1ZGQ5ODYtMGExYy00YmVkLWI4ZWItNDg2NTg0ZDM1ODc2LnJ2dA?sheetId=OTgyNDM4NzgtOGNiYy02MTJkLTA5Y2QtNzY5YmVjNjI4NTkz';
async function renderMaquettes(root) {
  const p = await DB.get('projects', App.project.id);
  const list = p.maquettes || [];
  root.innerHTML = `<div class="pagehead"><h2>Maquette 3D</h2><p>Liens Autodesk Viewer, BIM 360, Trimble…</p></div>
    ${list.length ? `<div class="list">${list.map(m => `<div class="row" data-id="${m.id}"><span class="m3-ic">${icon('box')}</span>
      <div class="grow"><div class="title">${esc(m.name)}</div><div class="sub">${esc(new URL(m.url).hostname)} · ajouté le ${fmtDate(m.date)}</div></div>
      <button class="iconbtn sm" data-m="${m.id}">${icon('more')}</button></div>`).join('')}</div>`
    : `<div class="empty">Aucune maquette liée.<br>Appuyez sur <b>+</b> pour ajouter le lien de la maquette 3D.</div>`}
    <div class="muted" style="font-size:12.5px;line-height:1.5;padding:12px 18px">Le lien reste celui du propriétaire : s'il le désactive, le fait expirer ou publie une nouvelle version, demandez-lui le nouveau lien et remplacez-le ici (⋮ → Modifier le lien).</div>`;
  const save = async (fn) => { const cur = await DB.get('projects', p.id); cur.maquettes = fn(cur.maquettes || []); await DB.put('projects', cur); renderMaquettes(root); };
  $$('.row[data-id]', root).forEach(r => r.onclick = (e) => {
    const m = list.find(x => x.id === r.dataset.id);
    if (e.target.closest('[data-m]')) return (async () => {
      const v = await menu(m.name, [{ label: 'Ouvrir dans l\'application', icon: 'box', value: 'in' }, { label: 'Ouvrir dans le navigateur', icon: 'external', value: 'out' }, { label: 'Modifier le lien', icon: 'edit', value: 'edit' }, { label: 'Supprimer', icon: 'trash', danger: true, value: 'del' }]);
      if (v === 'in') openMaquette(m); if (v === 'out') openUrl(m.url);
      if (v === 'edit') { const f = await formSheet('Modifier', [{ name: 'name', label: 'Nom', value: m.name }, { name: 'url', label: 'Lien', type: 'url', value: m.url }]); if (f && f.url) save(l => l.map(x => x.id === m.id ? { ...x, name: f.name || x.name, url: f.url.trim(), date: Date.now() } : x)); }
      if (v === 'del' && await confirmBox('Retirer ce lien ?')) save(l => l.filter(x => x.id !== m.id));
    })();
    openMaquette(m);
  });
  fab(root, async () => {
    const f = await formSheet('Ajouter une maquette 3D', [{ name: 'name', label: 'Nom', value: list.length ? '' : 'Maquette structure', placeholder: 'Ex : Maquette structure' }, { name: 'url', label: 'Lien (Autodesk Viewer…)', type: 'url', value: list.length ? '' : DEFAULT_3D }], { okLabel: 'Ajouter' });
    if (!f || !f.url) return;
    save(l => [...l, { id: DB.uid(), name: f.name || 'Maquette 3D', url: f.url.trim(), date: Date.now() }]);
  });
}
function openMaquette(m) {
  const el = document.createElement('div'); el.className = 'fullpage m3page';
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('close')}</button><h1 style="flex:1;font-size:17px">${esc(m.name)}</h1>
      <button class="iconbtn" data-a="reload" title="Recharger">${icon('undo')}</button><button class="iconbtn" data-a="out" title="Navigateur">${icon('external')}</button></div>
    <div class="m3-wrap"><div class="m3-load">Chargement de la maquette…<br><small>Si rien ne s'affiche, utilisez le bouton <b>↗ Navigateur</b> en haut.</small></div>
    <iframe src="${esc(m.url)}" allow="fullscreen; xr-spatial-tracking" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></div>`;
  document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
  $('[data-a=out]', el).onclick = () => openUrl(m.url);
  $('[data-a=reload]', el).onclick = () => { const f = $('iframe', el); f.src = m.url; };
  $('iframe', el).onload = () => { const l = $('.m3-load', el); if (l) l.style.display = 'none'; };
}
