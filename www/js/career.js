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

async function openCareer() {
  const el = document.createElement('div'); el.className = 'fullpage cr-page';
  document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  const draw = async () => {
    const C = Career.get(), L = CAREER_LOCS.find(x => x[0] === C.loc) || CAREER_LOCS[0];
    const docs = (await DB.byProject('files', CAREER_PID)).sort((a, b) => CAREER_DOCS.indexOf(a.cat) - CAREER_DOCS.indexOf(b.cat) || (a.createdAt || 0) - (b.createdAt || 0));
    const sites = CAREER_SITES.filter(s => !s.only || s.only.includes(C.loc));
    const card = (s, url) => `<button class="cr-site" data-url="${esc(url)}"><span class="cr-lg" style="background:${s.c}">${esc(s.n[0])}</span><span class="grow"><b>${esc(s.n)}</b><small>${s.g === 'Concours' ? 'Concours et emplois publics' : esc(C.q) + (L[1] && C.loc !== 'all' ? ' · ' + L[1] : '')}</small></span>${icon('chevright')}</button>`;
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:18px">Emploi & carrière</h1></div>
      <div class="cr-body">
        <div class="cr-sec">🔎 Rechercher un poste</div>
        <div class="cr-kw">${C.kw.map(k => `<button data-kw="${esc(k)}" class="${k === C.q ? 'on' : ''}">${esc(k)}</button>`).join('')}<button data-a="addkw" class="add">${icon('plus')}</button></div>
        <div class="cr-loc">${CAREER_LOCS.map(([k, l]) => `<button data-loc="${k}" class="${k === C.loc ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="cr-list">${sites.filter(s => s.g === 'Offres').map(s => card(s, s.u(C.q, L))).join('')}
          ${C.sites.map((s, i) => `<button class="cr-site" data-url="${esc(s.url)}" data-cs="${i}"><span class="cr-lg" style="background:#475569">${esc((s.n || '?')[0])}</span><span class="grow"><b>${esc(s.n)}</b><small>${esc(s.url.replace(/^https?:\/\//, '').slice(0, 40))}</small></span>${icon('chevright')}</button>`).join('')}
          <button class="cr-add" data-a="addsite">${icon('plus')} Ajouter un site</button></div>
        <div class="cr-sec">🏛️ Concours</div>
        <div class="cr-list">${CAREER_SITES.filter(s => s.g === 'Concours').map(s => card(s, s.u())).join('')}</div>
        <div class="cr-sec">📁 Mon dossier de candidature</div>
        <div class="cr-box">
          ${C.drive ? `<button class="cr-site cr-drive" data-url="${esc(C.drive)}"><span class="cr-lg" style="background:#1a73e8">${icon('drive')}</span><span class="grow"><b>Dossier Drive</b><small>CV, diplômes, lettres… (ouvrir)</small></span>${icon('chevright')}</button>` : ''}
          <button class="btn ghost small" data-a="drive">${icon('drive')} ${C.drive ? 'Changer le lien du dossier Drive' : 'Lier mon dossier Drive (CV, diplômes…)'}</button>
          <div class="cr-docs">${docs.length ? docs.map(f => `<div class="cr-doc"><button class="grow" data-open="${f.id}"><span class="cr-ic">${icon(/pdf/.test(f.mime || '') ? 'pdf' : /image/.test(f.mime || '') ? 'image' : 'file')}</span><span><b>${esc(f.cat || 'Document')}</b><small>${esc(f.name || '')}</small></span></button>
            <button class="iconbtn sm" data-sh="${f.id}">${icon('share')}</button><button class="iconbtn sm" data-more="${f.id}">${icon('more')}</button></div>`).join('')
            : '<div class="cr-none">Ajoutez votre CV, vos diplômes et votre lettre : vous pourrez les envoyer en 2 touches (WhatsApp, e-mail…).</div>'}</div>
          <div class="btnrow" style="padding:0"><button class="btn ghost small" data-a="adddoc">${icon('plus')} Ajouter un document</button>${docs.length ? `<button class="btn small" data-a="shareall">${icon('share')} Envoyer le dossier</button>` : ''}</div>
        </div>
      </div>`;
    $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
    $$('[data-url]', el).forEach(b => b.onclick = (e) => { if (b.dataset.cs != null && e.target.closest('[data-cs]') && b._lp) return; openUrl(b.dataset.url); });
    $$('[data-cs]', el).forEach(b => { let t; b.addEventListener('pointerdown', () => { b._lp = false; t = setTimeout(async () => { b._lp = true; const i = +b.dataset.cs; if (await confirmBox(`Retirer « ${C.sites[i].n} » ?`, 'Retirer')) { C.sites.splice(i, 1); Career.set(C); draw(); } }, 600); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => clearTimeout(t))); });
    $$('[data-kw]', el).forEach(b => {
      b.onclick = () => { C.q = b.dataset.kw; Career.set(C); draw(); };
      let t; b.addEventListener('pointerdown', () => { t = setTimeout(async () => { if (await confirmBox(`Retirer « ${b.dataset.kw} » ?`, 'Retirer')) { C.kw = C.kw.filter(x => x !== b.dataset.kw); if (C.q === b.dataset.kw) C.q = C.kw[0] || ''; Career.set(C); draw(); } }, 600); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => clearTimeout(t)));
    });
    $$('[data-loc]', el).forEach(b => b.onclick = () => { C.loc = b.dataset.loc; Career.set(C); draw(); });
    $('[data-a=addkw]', el).onclick = async () => { const r = await formSheet('Poste recherché', [{ name: 'k', label: 'Mots-clés', placeholder: 'Ex : Ingénieur travaux, QHSE, Topographe…' }], { okLabel: 'Ajouter' }); if (r && r.k) { C.kw.push(r.k); C.q = r.k; Career.set(C); draw(); } };
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
}
