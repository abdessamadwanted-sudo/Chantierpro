// ================= Emploi & carrière : recherche d'offres et concours + dossier de candidature =================
// Les sites s'ouvrent directement sur la recherche (mots-clés + pays). Le dossier (CV, diplômes, lettre…) est
// gardé dans l'application (envoi rapide WhatsApp / e-mail, sauvegarde dans Drive) + lien vers un dossier Drive.
const CAREER_PID = '__career';
const CAREER_DOCS = ['CV', 'Lettre de motivation', 'Diplôme', 'Attestation de travail', 'Certificat', 'Pièce d\'identité / passeport', 'Autre'];
const CAREER_LOCS = [['ma', 'Maroc', 'Maroc'], ['ca', 'Canada', 'Canada'], ['us', 'USA', 'United States'], ['af', 'Afrique / international', 'Africa'], ['all', 'Partout', '']];
const enc = encodeURIComponent;
// q = mots-clés, L = [code, nom, nom anglais]
const CAREER_SITES = [
  { k: 'indeed', n: 'Indeed', c: '#2557a7', g: 'Offres', u: (q, L) => `https://${{ ma: 'ma.', ca: 'ca.', us: 'www.', af: 'www.', all: 'www.' }[L[0]]}indeed.com/jobs?q=${enc(q)}${L[0] === 'af' ? '&l=Africa' : ''}` },
  { k: 'linkedin', n: 'LinkedIn', c: '#0a66c2', g: 'Offres', u: (q, L) => `https://www.linkedin.com/jobs/search/?keywords=${enc(q)}${L[2] ? '&location=' + enc(L[2]) : ''}` },
  { k: 'glassdoor', n: 'Glassdoor', c: '#0caa41', g: 'Offres', u: (q, L) => `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${enc(q)}${L[2] ? '&locKeyword=' + enc(L[2]) : ''}` },
  { k: 'rekrute', n: 'ReKrute', c: '#e4572e', g: 'Offres', only: ['ma', 'all'], u: (q) => `https://www.rekrute.com/offres.html?s=1&p=1&o=1&query=${enc(q)}` },
  { k: 'emploima', n: 'Emploi.ma', c: '#1d4ed8', g: 'Offres', only: ['ma', 'all'], u: (q) => `https://www.emploi.ma/recherche-jobs-maroc?keywords=${enc(q)}` },
  { k: 'dreamjob', n: 'Dreamjob.ma', c: '#7c3aed', g: 'Offres', only: ['ma', 'all'], u: (q) => `https://www.dreamjob.ma/?s=${enc(q)}` },
  { k: 'jobbank', n: 'Job Bank (Canada)', c: '#af3c43', g: 'Offres', only: ['ca', 'all'], u: (q) => `https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=${enc(q)}` },
  { k: 'alwadifa', n: 'Alwadifa Maroc', c: '#16a34a', g: 'Concours', u: () => 'https://www.alwadifa-maroc.com/' },
  { k: 'emploipublic', n: 'Emploi-public.ma', c: '#b91c1c', g: 'Concours', u: () => 'https://www.emploi-public.ma/' },
  { k: 'anapec', n: 'ANAPEC', c: '#0369a1', g: 'Concours', u: () => 'https://www.anapec.org/' },
];
const CAREER_DEF_KW = ['Conducteur de travaux', 'Chef de chantier', 'Technicien qualité BTP', 'Contrôle qualité génie civil', 'Suivi de chantier'];
const Career = {
  get() { try { return { kw: CAREER_DEF_KW.slice(), q: CAREER_DEF_KW[0], loc: 'ma', drive: '', sites: [], ...JSON.parse(localStorage.getItem('career') || '{}') }; } catch (e) { return { kw: CAREER_DEF_KW.slice(), q: CAREER_DEF_KW[0], loc: 'ma', drive: '', sites: [] }; } },
  set(c) { try { localStorage.setItem('career', JSON.stringify(c)); } catch (e) {} },
};

const CAREER_CT = ['Tous', 'CDI', 'CDD', 'Intérim', 'Freelance', 'Stage'];
const CAREER_ST = [['saved', '⭐ À postuler', '#d97706'], ['sent', '📨 Envoyée', '#2563eb'], ['relance', '🔁 Relancée', '#7c3aed'], ['interview', '📞 Entretien', '#ea580c'], ['offer', '✅ Acceptée', '#16a34a'], ['no', '❌ Refusée', '#64748b']];
const careerQ = (C, q) => [q || C.q, C.ct && C.ct !== 'Tous' ? C.ct : '', C.x || ''].filter(Boolean).join(' ');
const crLate = (a) => a.st === 'sent' && a.at && (Date.now() - new Date(a.at)) > 7 * 864e5 && !a.arch;
const crOpen = (k, d) => { try { const v = localStorage.getItem('cr.o.' + k); return v == null ? d : v === '1'; } catch (e) { return d; } };
const crSetOpen = (k, v) => { try { localStorage.setItem('cr.o.' + k, v ? '1' : '0'); } catch (e) {} };
function careerBadge() { const C = Career.get(); const n = (C.apps || []).filter(crLate).length; try { localStorage.setItem('job.new', String(n)); } catch (e) {} return n; }
async function openCareer(opts = {}) {
  const el = document.createElement('div'); el.className = 'fullpage cr-page';
  document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  let filt = 'all';
  const draw = async () => {
    const keep = ($('.cr-body', el) || {}).scrollTop || 0;
    const C = Career.get(), L = CAREER_LOCS.find(x => x[0] === C.loc) || CAREER_LOCS[0];
    const docs = (await DB.byProject('files', CAREER_PID)).sort((a, b) => CAREER_DOCS.indexOf(a.cat) - CAREER_DOCS.indexOf(b.cat) || (a.createdAt || 0) - (b.createdAt || 0));
    const sites = CAREER_SITES.filter(s => !s.only || s.only.includes(C.loc));
    const qq = careerQ(C);
    const R = careerRobot(C), pct = R.items.length ? Math.round(R.seen / R.items.length * 100) : 0;
    const seenKey = (s) => R.seenSet.has(`${s.k}|${C.loc}|${C.q}`);
    const card = (s, url, sub) => `<button class="cr-site" data-url="${esc(url)}" ${s.k ? `data-k="${s.k}"` : ''}><span class="cr-lg" style="background:${s.c}">${esc(s.n[0])}</span><span class="grow"><b>${esc(s.n)}</b><small>${sub}</small></span>${s.k && s.g === 'Offres' ? (seenKey(s) ? '<em class="cr-b ok">✓ vu</em>' : '<em class="cr-b nw">● à voir</em>') : ''}${icon('chevright')}</button>`;
    const apps = (C.apps || []).slice().sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    const live = apps.filter(a => !a.arch), cnt = (k) => k === 'all' ? live.length : k === 'arch' ? apps.filter(a => a.arch).length : live.filter(a => a.st === k).length;
    const shown = filt === 'arch' ? apps.filter(a => a.arch) : live.filter(a => filt === 'all' || a.st === filt);
    const sec = (k, title, n, body, def = true) => { const o = crOpen(k, def); return `<div class="cr-grp ${o ? 'open' : ''}" data-grp="${k}"><button class="cr-gh" data-tg="${k}"><span class="grow">${title}</span>${n != null ? `<span class="cr-n">${n}</span>` : ''}${icon('chevdown')}</button><div class="cr-gb">${body}</div></div>`; };
    const late = live.filter(crLate).length; careerBadge();
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:18px">Emploi & carrière</h1><button class="iconbtn" data-a="clip" title="Coller le lien d'une offre">${icon('plus')}</button></div>
      <div class="cr-body">
        <div class="cr-hero"><div><b>${live.length}</b><span>candidature(s)</span></div><div><b>${cnt('interview')}</b><span>entretien(s)</span></div><div class="${late ? 'r' : ''}"><b>${late}</b><span>à relancer</span></div><div><b>${pct}%</b><span>tournée du jour</span></div></div>
        ${sec('search', `🔎 Recherche <small class="cr-sum">${esc(C.q)} · ${esc(L[1])}${C.ct && C.ct !== 'Tous' ? ' · ' + esc(C.ct) : ''}</small>`, null, `<div class="cr-dd">
          <label>Poste<select data-dd="q">${C.kw.map(k => `<option ${k === C.q ? 'selected' : ''}>${esc(k)}</option>`).join('')}<option value="__add">➕ Autre poste…</option>${C.kw.length > 1 ? '<option value="__del">🗑 Retirer ce poste</option>' : ''}</select></label>
          <label>Pays<select data-dd="loc">${CAREER_LOCS.map(([k, l]) => `<option value="${k}" ${k === C.loc ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label>Contrat<select data-dd="ct">${CAREER_CT.map(k => `<option ${k === (C.ct || 'Tous') ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
          <label>Mots en plus<input data-dd="x" value="${esc(C.x || '')}" placeholder="Ex : chinoise, TGCC"></label></div>`, false)}
        <div class="cr-robot ${C.robot && C.robot.on ? 'on' : ''}"><div class="h">🤖 <b>Robot emploi</b><span>${C.robot && C.robot.on ? `actif · chaque jour à ${esc(C.robot.time || '08:00')}` : 'arrêté'}</span></div>
          <div class="cr-rbar anim"><i style="width:${pct}%"></i></div><small>Aujourd'hui : ${R.seen}/${R.items.length} recherche(s) vérifiée(s)</small>
          <div class="btnrow" style="padding:0"><button class="btn small" data-a="tour">▶ ${R.seen && R.seen < R.items.length ? 'Continuer' : 'Lancer'} la tournée</button><button class="btn ghost small" data-tg="robot">⚙ Réglages ${icon('chevdown')}</button></div>
          <div class="cr-rcfg" style="${crOpen('robot', false) ? '' : 'display:none'}"></div></div>
        ${sec('apps', `📨 Mes candidatures`, live.length, `<div class="cr-chips">${[['all', 'Toutes'], ...CAREER_ST.map(x => [x[0], x[1]]), ['arch', '🗄 Archivées']].map(([k, l]) => cnt(k) || k === 'all' || k === filt ? `<button class="${filt === k ? 'on' : ''}" data-f="${k}">${l} <small>${cnt(k)}</small></button>` : '').join('')}</div>
          <div class="cr-apps">${shown.map(a => { const st = CAREER_ST.find(x => x[0] === a.st) || CAREER_ST[1]; return `<div class="cr-card" data-app="${a.id}" style="--sc:${st[2]}"><div class="cr-cin"><span class="cr-av">${esc((a.co || '?')[0].toUpperCase())}</span><span class="grow"><b>${esc(a.co || '—')}</b><small>${esc(a.poste || '')}</small><small>${a.pays ? '📍 ' + esc(a.pays) : ''}${a.at ? ' · ' + fmtDate(a.at) : ''}</small></span><span class="cr-st">${st[1]}</span>${a.url ? `<button class="cr-ou" data-ou="${esc(a.url)}">🔗</button>` : ''}${crLate(a) ? '<em class="cr-b late">à relancer</em>' : ''}</div></div>`; }).join('') || `<div class="cr-none">${filt === 'all' ? 'Repérez une offre sur un site, copiez son lien, puis touchez ＋ en haut : elle arrive ici. Glissez une carte → pour passer à l\'étape suivante, ← pour l\'archiver.' : 'Rien ici.'}</div>`}</div>
          <button class="cr-add" data-a="addapp">${icon('plus')} Ajouter une offre / candidature</button>`)}
        ${sec('sites', `🌐 Sites d'emploi · ${esc(L[1])}`, sites.filter(s => s.g === 'Offres').length + C.sites.length, `<div class="cr-list">${sites.filter(s => s.g === 'Offres').map(s => card(s, s.u(qq, L), esc(C.q) + (L[1] && C.loc !== 'all' ? ' · ' + L[1] : ''))).join('')}
          ${C.sites.map((s, i) => `<button class="cr-site" data-url="${esc(s.url)}" data-cs="${i}"><span class="cr-lg" style="background:#475569">${esc((s.n || '?')[0])}</span><span class="grow"><b>${esc(s.n)}</b><small>${esc(s.url.replace(/^https?:\/\//, '').slice(0, 40))}</small></span>${icon('chevright')}</button>`).join('')}
          <button class="cr-add" data-a="addsite">${icon('plus')} Ajouter un site</button></div>`, false)}
        ${sec('conc', '🏛️ Concours & emploi public', 3, `<div class="cr-list">${CAREER_SITES.filter(s => s.g === 'Concours').map(s => card(s, s.u(), 'Concours et emplois publics')).join('')}</div>`, false)}
        ${sec('docs', '📁 Mon dossier de candidature', docs.length, `<div class="cr-box">
          ${C.drive ? `<button class="cr-site cr-drive" data-url="${esc(C.drive)}"><span class="cr-lg" style="background:#1a73e8">${icon('drive')}</span><span class="grow"><b>Dossier Drive</b><small>CV, diplômes, lettres… (ouvrir)</small></span>${icon('chevright')}</button>` : ''}
          <button class="btn ghost small" data-a="drive">${icon('drive')} ${C.drive ? 'Changer le lien du dossier Drive' : 'Lier mon dossier Drive (CV, diplômes…)'}</button>
          <div class="cr-docs">${docs.length ? docs.map(f => `<div class="cr-doc"><button class="grow" data-open="${f.id}"><span class="cr-ic">${icon(/pdf/.test(f.mime || '') ? 'pdf' : /image/.test(f.mime || '') ? 'image' : 'file')}</span><span><b>${esc(f.cat || 'Document')}</b><small>${esc(f.name || '')}</small></span></button>
            <button class="iconbtn sm" data-sh="${f.id}">${icon('share')}</button><button class="iconbtn sm" data-more="${f.id}">${icon('more')}</button></div>`).join('')
            : '<div class="cr-none">Ajoutez votre CV, vos diplômes et votre lettre : vous pourrez les envoyer en 2 touches (WhatsApp, e-mail…).</div>'}</div>
          <div class="btnrow" style="padding:0"><button class="btn ghost small" data-a="adddoc">${icon('plus')} Ajouter un document</button>${docs.length ? `<button class="btn small" data-a="shareall">${icon('share')} Envoyer le dossier</button>` : ''}</div>
        </div>`, false)}
      </div>`;
    $('.cr-body', el).scrollTop = keep;
    $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
    $$('[data-tg]', el).forEach(b => b.onclick = () => { const k = b.dataset.tg; const g = b.closest('[data-grp]');
      if (k === 'robot') { const box = $('.cr-rcfg', el), o = box.style.display === 'none'; crSetOpen('robot', o); box.style.display = o ? '' : 'none'; if (o) careerRobotInline(box, draw); return; }
      const o = !g.classList.contains('open'); g.classList.toggle('open', o); crSetOpen(k, o); });
    if (crOpen('robot', false)) careerRobotInline($('.cr-rcfg', el), draw);
    $$('[data-f]', el).forEach(b => b.onclick = () => { filt = b.dataset.f; draw(); });
    $$('[data-url]', el).forEach(b => b.onclick = (e) => { if (b.dataset.cs != null && e.target.closest('[data-cs]') && b._lp) return; if (b.dataset.k) { R.mark(`${b.dataset.k}|${C.loc}|${C.q}`); setTimeout(draw, 400); } openUrl(b.dataset.url); });
    $$('[data-cs]', el).forEach(b => { let t; b.addEventListener('pointerdown', () => { b._lp = false; t = setTimeout(async () => { b._lp = true; const i = +b.dataset.cs; if (await confirmBox(`Retirer « ${C.sites[i].n} » ?`, 'Retirer')) { C.sites.splice(i, 1); Career.set(C); draw(); } }, 600); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => clearTimeout(t))); });
    const dd = (k) => $(`[data-dd=${k}]`, el);
    dd('q').onchange = async () => {
      const v = dd('q').value;
      if (v === '__add') { const r = await formSheet('Poste recherché', [{ name: 'k', label: 'Mots-clés', placeholder: 'Ex : Ingénieur travaux, QHSE, Topographe…' }], { okLabel: 'Ajouter' }); if (r && r.k) { C.kw.push(r.k); C.q = r.k; } }
      else if (v === '__del') { if (await confirmBox(`Retirer « ${C.q} » ?`, 'Retirer')) { C.kw = C.kw.filter(x => x !== C.q); C.q = C.kw[0] || ''; } }
      else C.q = v;
      Career.set(C); draw();
    };
    dd('loc').onchange = () => { C.loc = dd('loc').value; Career.set(C); draw(); };
    dd('ct').onchange = () => { C.ct = dd('ct').value; Career.set(C); draw(); };
    dd('x').onchange = () => { C.x = dd('x').value.trim(); Career.set(C); draw(); };
    $('[data-a=tour]', el).onclick = () => careerTour(draw);
    $('[data-a=addapp]', el).onclick = () => careerApp(null, draw);
    $('[data-a=clip]', el).onclick = async () => { let u = ''; try { u = (await navigator.clipboard.readText() || '').trim(); } catch (e) {} careerApp(null, draw, /^https?:\/\//.test(u) ? { url: u, st: 'saved' } : { st: 'saved' }); };
    // cartes : toucher = ouvrir ; glisser → étape suivante ; glisser ← archiver
    $$('[data-app]', el).forEach(c => { const inner = $('.cr-cin', c); let sx = 0, sy = 0, dx = 0, on = false, h = null;
      c.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; on = true; h = null; inner.style.transition = 'none'; }, { passive: true });
      c.addEventListener('touchmove', e => { if (!on) return; const x = e.touches[0].clientX - sx, y = e.touches[0].clientY - sy; if (h === null && Math.hypot(x, y) > 8) h = Math.abs(x) > Math.abs(y); if (!h) return; e.preventDefault(); dx = x; inner.style.transform = `translateX(${dx}px)`; c.classList.toggle('go-r', dx > 40); c.classList.toggle('go-l', dx < -40); }, { passive: false });
      c.addEventListener('touchend', async () => { if (!on) return; on = false; inner.style.transition = ''; inner.style.transform = ''; c.classList.remove('go-r', 'go-l');
        if (!h) return; const a = (C.apps || []).find(x => x.id === c.dataset.app); if (!a) return;
        if (dx > 90) { if (a.arch) a.arch = false; else { const i = CAREER_ST.findIndex(x => x[0] === a.st); if (i >= 0 && i < CAREER_ST.length - 2) { a.st = CAREER_ST[i + 1][0]; if (a.st === 'sent') a.at = todayISO(); } } Career.set(C); toast((CAREER_ST.find(x => x[0] === a.st) || [])[1] || '✓'); draw(); }
        else if (dx < -90) { a.arch = !a.arch; Career.set(C); toast(a.arch ? '🗄 Archivée' : 'Restaurée'); draw(); } });
      c.onclick = (e) => { if (h) return; const ou = e.target.closest('[data-ou]'); if (ou) return openUrl(ou.dataset.ou); careerApp(c.dataset.app, draw); }; });
    $('[data-a=addsite]', el).onclick = async () => { const r = await formSheet('Ajouter un site', [{ name: 'n', label: 'Nom', placeholder: 'Ex : Bayt, Marocannonces, site d\'une entreprise…' }, { name: 'u', label: 'Lien', type: 'url', placeholder: 'https://…' }], { okLabel: 'Ajouter' });
      if (r && r.u) { C.sites.push({ n: r.n || r.u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0], url: /^https?:/.test(r.u) ? r.u : 'https://' + r.u }); Career.set(C); draw(); } };
    $('[data-a=drive]', el).onclick = async () => { const r = await formSheet('Dossier Drive', [{ name: 'u', label: 'Lien du dossier Drive (Partager › Copier le lien)', type: 'url', value: C.drive, placeholder: 'https://drive.google.com/drive/folders/…' }], { okLabel: 'Enregistrer' }); if (r) { C.drive = r.u; Career.set(C); draw(); } };
    $('[data-a=adddoc]', el).onclick = async () => {
      const cat = await menu('Quel document ?', CAREER_DOCS.map(c => ({ label: c, icon: 'file', value: c }))); if (!cat) return;
      const files = await pickFiles({ accept: 'application/pdf,image/*,.doc,.docx', multiple: true }); if (!files.length) return;
      for (const f of files) await DB.put('files', { projectId: CAREER_PID, blob: f, mime: mimeFromName(f.name, f.type), name: f.name, role: 'career', cat });
      toast('Ajouté ✓'); draw();
    };
    const sa = $('[data-a=shareall]', el); if (sa) sa.onclick = async () => { const list = []; for (const f of docs) { const r = await DB.get('files', f.id); if (r && r.blob) list.push({ b: r.blob, n: r.name || `${r.cat}.pdf` }); } if (list.length) shareBlobs(list); };
    $$('[data-open]', el).forEach(b => b.onclick = async () => { const f = await DB.get('files', b.dataset.open); if (f && f.blob) openFileRecord(f, f.cat); else toast('Fichier indisponible'); });
    $$('[data-sh]', el).forEach(b => b.onclick = async () => { const f = await DB.get('files', b.dataset.sh); if (f && f.blob) shareBlob(f.blob, f.name || `${f.cat}.pdf`); });
    $$('[data-more]', el).forEach(b => b.onclick = async () => {
      const f = await DB.get('files', b.dataset.more);
      const v = await menu(f.cat || 'Document', [{ label: 'Changer la catégorie', icon: 'edit', value: 'cat' }, { label: 'Remplacer le fichier', icon: 'undo', value: 'rep' }, { label: 'Supprimer', icon: 'trash', danger: true, value: 'del' }]);
      if (v === 'cat') { const c = await menu('Catégorie', CAREER_DOCS.map(x => ({ label: x, value: x, checked: x === f.cat }))); if (c) { f.cat = c; await DB.put('files', f); } }
      if (v === 'rep') { const [nf] = await pickFiles({ accept: 'application/pdf,image/*,.doc,.docx', multiple: false }); if (nf) { f.blob = nf; f.name = nf.name; f.mime = mimeFromName(nf.name, nf.type); f.driveId = f.driveId || null; await DB.put('files', f); toast('Remplacé ✓'); } }
      if (v === 'del' && await confirmBox('Supprimer ce document ?')) await DB.del('files', f.id);
      draw();
    });
  };
  draw();
  if (opts.robot) setTimeout(() => careerTour(draw), 300);
}
// réglages du robot, dépliés dans la carte
function careerRobotInline(box, onDone) {
  const C = Career.get(), rb = C.robot = C.robot || { on: false, time: '08:00', postes: [], locs: [C.loc] };
  box.innerHTML = `<div class="form cr-cfg">
    <div class="fld">Robot<div class="seg"><button type="button" data-on="1" class="${rb.on ? 'on' : ''}">Actif</button><button type="button" data-on="0" class="${!rb.on ? 'on' : ''}">Arrêté</button></div></div>
    <label>Heure du rappel quotidien<input type="time" name="time" value="${esc(rb.time || '08:00')}"></label>
    <div class="fld">Postes à chercher<div class="cr-ck">${C.kw.map(k => `<label><input type="checkbox" data-p="${esc(k)}" ${!(rb.postes || []).length || rb.postes.includes(k) ? 'checked' : ''}> ${esc(k)}</label>`).join('')}</div></div>
    <div class="fld">Pays<div class="cr-ck">${CAREER_LOCS.filter(l => l[0] !== 'all').map(([k, l]) => `<label><input type="checkbox" data-l="${k}" ${(rb.locs || []).includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
    <button class="btn small" data-a="ok" style="width:100%">Enregistrer</button></div>`;
  let on = !!rb.on;
  $$('[data-on]', box).forEach(b => b.onclick = () => { on = b.dataset.on === '1'; $$('[data-on]', box).forEach(x => x.classList.toggle('on', x === b)); });
  $('[data-a=ok]', box).onclick = async () => {
    rb.on = on; rb.time = $('[name=time]', box).value || '08:00';
    rb.postes = $$('[data-p]', box).filter(i => i.checked).map(i => i.dataset.p); rb.locs = $$('[data-l]', box).filter(i => i.checked).map(i => i.dataset.l);
    if (!rb.locs.length) rb.locs = [C.loc];
    Career.set(C); await careerRobotNotif(rb); crSetOpen('robot', false); toast(rb.on ? `🤖 Robot actif : rappel chaque jour à ${rb.time}` : 'Robot arrêté'); onDone && onDone();
  };
}

// ---------- Robot emploi : tournée quotidienne des sites (postes × pays), avec ce qui a déjà été vu ----------
function careerRobot(C) {
  const rb = C.robot || {}, postes = (rb.postes && rb.postes.length ? rb.postes : C.kw).filter(k => C.kw.includes(k)), locs = rb.locs && rb.locs.length ? rb.locs : [C.loc];
  const items = [];
  for (const lc of locs) { const L = CAREER_LOCS.find(x => x[0] === lc) || CAREER_LOCS[0];
    for (const q of postes) for (const st of CAREER_SITES.filter(s => s.g === 'Offres' && (!s.only || s.only.includes(lc)))) items.push({ key: `${st.k}|${lc}|${q}`, site: st, L, q, url: st.u(careerQ(C, q), L) }); }
  let seenS = {}; try { seenS = JSON.parse(localStorage.getItem('career.seen') || '{}'); } catch (e) {}
  const today = todayISO(), seen = new Set(seenS.d === today ? seenS.k || [] : []);
  return { items, seenSet: seen, seen: items.filter(i => seen.has(i.key)).length, mark: (k) => { seen.add(k); try { localStorage.setItem('career.seen', JSON.stringify({ d: today, k: [...seen] })); } catch (e) {} } };
}
function careerTour(onClose) {
  const C = Career.get(), R = careerRobot(C);
  const s = sheet(`<div class="cr-tour"></div>`, { title: '🤖 Tournée du jour' });
  const box = $('.cr-tour', s.el);
  const draw = () => {
    const next = R.items.find(i => !R.seenSet.has(i.key)), n = R.items.filter(i => R.seenSet.has(i.key)).length;
    box.innerHTML = `<div class="cr-rbar"><i style="width:${R.items.length ? Math.round(n / R.items.length * 100) : 0}%"></i></div><small class="muted">${n}/${R.items.length} vérifiée(s) · ${esc(careerQ(C, '…').replace('…', '').trim()) || 'tous contrats'}</small>
      ${next ? `<button class="btn" data-a="next" style="width:100%;margin:10px 0">▶ Ouvrir : ${esc(next.site.n)} · ${esc(next.q)} · ${esc(next.L[1])}</button>` : '<div class="cr-done">✅ Tournée terminée pour aujourd\'hui</div>'}
      <div class="cr-ti">${R.items.map((i, k) => `<button data-i="${k}" class="${R.seenSet.has(i.key) ? 'ok' : ''}"><span class="cr-lg" style="background:${i.site.c}">${esc(i.site.n[0])}</span><span class="grow"><b>${esc(i.site.n)}</b><small>${esc(i.q)} · ${esc(i.L[1])}</small></span><i>${R.seenSet.has(i.key) ? '✓' : ''}</i></button>`).join('')}</div>
      <div class="muted" style="font-size:12px;margin-top:8px">Une offre intéressante ? Revenez et ajoutez-la dans « Mes candidatures ».</div>`;
    const go = (i) => { R.mark(i.key); openUrl(i.url); draw(); };
    const nb = $('[data-a=next]', box); if (nb) nb.onclick = () => go(next);
    $$('[data-i]', box).forEach(b => b.onclick = () => go(R.items[+b.dataset.i]));
  };
  draw(); s.onClose = () => onClose && onClose();
}
function careerRobotCfg(onDone) {
  const C = Career.get(), rb = C.robot = C.robot || { on: false, time: '08:00', postes: [], locs: [C.loc] };
  const s = sheet(`<div class="form cr-cfg">
    <div class="fld">Robot<div class="seg"><button type="button" data-on="1" class="${rb.on ? 'on' : ''}">Actif</button><button type="button" data-on="0" class="${!rb.on ? 'on' : ''}">Arrêté</button></div></div>
    <label>Heure du rappel quotidien<input type="time" name="time" value="${esc(rb.time || '08:00')}"></label>
    <div class="fld">Postes à chercher<div class="cr-ck">${C.kw.map(k => `<label><input type="checkbox" data-p="${esc(k)}" ${!rb.postes.length || rb.postes.includes(k) ? 'checked' : ''}> ${esc(k)}</label>`).join('')}</div></div>
    <div class="fld">Pays<div class="cr-ck">${CAREER_LOCS.filter(l => l[0] !== 'all').map(([k, l]) => `<label><input type="checkbox" data-l="${k}" ${(rb.locs || []).includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
    <div class="btnrow"><button class="btn ghost" data-a="c">Annuler</button><button class="btn" data-a="ok">Enregistrer</button></div></div>`, { title: '⚙ Robot emploi' });
  let on = !!rb.on;
  $$('[data-on]', s.el).forEach(b => b.onclick = () => { on = b.dataset.on === '1'; $$('[data-on]', s.el).forEach(x => x.classList.toggle('on', x === b)); });
  $('[data-a=c]', s.el).onclick = () => s.close();
  $('[data-a=ok]', s.el).onclick = async () => {
    rb.on = on; rb.time = $('[name=time]', s.el).value || '08:00';
    rb.postes = $$('[data-p]', s.el).filter(i => i.checked).map(i => i.dataset.p); rb.locs = $$('[data-l]', s.el).filter(i => i.checked).map(i => i.dataset.l);
    if (!rb.locs.length) rb.locs = [C.loc];
    Career.set(C); await careerRobotNotif(rb); s.close(); toast(rb.on ? `🤖 Robot actif : rappel chaque jour à ${rb.time}` : 'Robot arrêté'); onDone && onDone();
  };
}
async function careerRobotNotif(rb) {
  const LN = window.Capacitor?.Plugins?.LocalNotifications; if (!LN) return;
  try {
    await LN.cancel({ notifications: [{ id: 1999000101 }] }).catch(() => {});
    if (!rb.on) return;
    const perm = await LN.requestPermissions(); if (perm.display !== 'granted') return;
    try { await LN.createChannel({ id: 'rappels', name: 'Rappels de chantier', importance: 5, visibility: 1, vibration: true }); } catch (e) {}
    const [h, m] = (rb.time || '08:00').split(':').map(Number);
    await LN.schedule({ notifications: [{ id: 1999000101, title: '🤖 Robot emploi', body: 'La tournée des offres du jour est prête — touchez pour la lancer', channelId: 'rappels', schedule: { on: { hour: h, minute: m }, allowWhileIdle: true }, extra: { action: 'jobrobot' } }] });
  } catch (e) { console.warn('robot', e); }
}
// ---------- suivi des candidatures ----------
async function careerApp(id, onDone, pre = {}) {
  const C = Career.get(); C.apps = C.apps || []; const a = id ? C.apps.find(x => x.id === id) : null;
  const r = await formSheet(a ? 'Candidature' : 'Nouvelle candidature', [
    { name: 'co', label: 'Entreprise', value: a ? a.co : '', placeholder: 'Ex : China Railway, TGCC, SGTM…' },
    { name: 'poste', label: 'Poste', value: a ? a.poste : C.q, list: C.kw },
    { name: 'pays', label: 'Pays / ville', value: a ? a.pays : (CAREER_LOCS.find(x => x[0] === C.loc) || [])[1] || '' },
    { name: 'at', label: 'Date d\'envoi', type: 'date', value: a ? a.at : todayISO() },
    { name: 'st', label: 'Statut', type: 'select', value: a ? a.st : (pre.st || 'sent'), options: CAREER_ST.map(([k, l]) => ({ value: k, label: l })) },
    { name: 'url', label: 'Lien de l\'offre (optionnel)', type: 'url', value: a ? a.url || '' : (pre.url || '') },
    { name: 'note', label: 'Notes (contact, salaire…)', type: 'textarea', value: a ? a.note || '' : '' },
  ], { okLabel: 'Enregistrer', danger: a ? 'Supprimer' : null });
  if (!r) return;
  if (r.__danger) { C.apps = C.apps.filter(x => x !== a); }
  else if (a) Object.assign(a, r); else C.apps.push({ id: DB.uid(), ...r });
  Career.set(C); onDone && onDone();
}
