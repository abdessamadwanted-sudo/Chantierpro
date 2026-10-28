// ================= v1.0.34 — Mon dossier pro : profil professionnel (type LinkedIn) + CV PDF + candidatures =================
// Profil gardé sur ce téléphone (localStorage « dossier.pro »). Les documents (CV, diplômes…) et le suivi des candidatures
// réutilisent le module « Emploi & carrière » de Chantier (career.js : fichiers __career, sauvegarde Drive).
const DP_SKILLS = ['Lecture de plans', 'Béton armé', 'Ferraillage', 'Coffrage', 'Réception d\'ouvrages', 'Contrôle qualité', 'Métré', 'Topographie', 'Implantation',
  'VRD', 'Terrassement', 'Gros œuvre', 'Second œuvre', 'Planning', 'HSE', 'Gestion d\'équipe', 'AutoCAD', 'Revit', 'Covadis', 'Robot Structural', 'MS Project', 'Primavera', 'Excel', 'BIM'];
const DP_LANGS = ['Arabe', 'Français', 'Anglais', 'Amazigh', 'Espagnol', 'Allemand'];
const DP_NIV = ['Notions', 'Intermédiaire', 'Courant', 'Bilingue / natif'];
const DP_DISPO = [['ouvert', '🟢 Ouvert aux opportunités', '#18866B'], ['ecoute', '🟡 À l\'écoute', '#B7791F'], ['non', '⚪ Non disponible', '#64748b']];
const Dossier = {
  get() {
    let d = {}; try { d = JSON.parse(localStorage.getItem('dossier.pro') || '{}') || {}; } catch (e) {}
    const me = (typeof Team !== 'undefined' && Team.ready && Team.ready() && Team.me && Team.me()) || {};
    let mail = ''; try { mail = (firebase.auth().currentUser || {}).email || ''; } catch (e) {}
    return { name: me.name || '', titre: '', ville: '', tel: '', email: mail, linkedin: '', dispo: 'ecoute', about: '', exp: [], form: [], skills: [], certs: [], langs: [], photo: '', ...d };
  },
  set(d) { try { localStorage.setItem('dossier.pro', JSON.stringify(d)); } catch (e) { toast('Mémoire du téléphone pleine'); } },
  // complétude : 10 points, comme une fiche LinkedIn
  score(d) {
    const ok = [d.name, d.titre, d.ville, d.about, d.exp.length, d.form.length, d.skills.length >= 3, d.langs.length, d.tel || d.email, d.photo];
    return Math.round(ok.filter(Boolean).length * 10);
  },
  cardHTML() {
    const d = Dossier.get(), s = Dossier.score(d);
    return `<button class="dp-card" data-a="dossier"><span class="dp-av sm">${d.photo ? `<img src="${esc(d.photo)}" alt="">` : esc(dpIni(d.name))}</span>
      <span class="grow"><b>Mon dossier pro</b><small>${esc(d.titre || 'Profil, CV, diplômes, candidatures')}</small><span class="dp-bar"><i style="width:${s}%"></i></span></span><em>${s}%</em>${icon('chevright')}</button>`;
  },
};
const dpIni = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase() || '?';
const dpPer = (x) => [x.de, x.cur ? 'aujourd\'hui' : x.a].filter(Boolean).join(' – ');
const dpMonth = (v) => { if (!v) return ''; const [y, m] = String(v).split('-'); return m ? `${['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][+m - 1] || ''} ${y}` : y; };

async function openDossier() {
  const el = document.createElement('div'); el.className = 'fullpage dp-page';
  document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  const draw = () => {
    const d = Dossier.get(), s = Dossier.score(d), D = DP_DISPO.find(x => x[0] === d.dispo) || DP_DISPO[1];
    const keep = ($('.dp-body', el) || {}).scrollTop || 0;
    const blk = (k, title, ic, body, add) => `<section class="dp-sec"><div class="dp-sh"><span class="dp-si">${icon(ic)}</span><b>${title}</b>${add ? `<button class="iconbtn sm" data-add="${k}" title="Ajouter">${icon('plus')}</button>` : ''}</div>${body}</section>`;
    const empty = (t) => `<div class="dp-none">${t}</div>`;
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:18px">Mon dossier pro</h1><button class="iconbtn" data-a="share" title="Partager">${icon('share')}</button></div>
      <div class="dp-body">
        <div class="dp-head"><div class="dp-cover"></div>
          <button class="dp-av" data-a="photo">${d.photo ? `<img src="${esc(d.photo)}" alt="">` : esc(dpIni(d.name))}<i>${icon('camera')}</i></button>
          <div class="dp-id"><b>${esc(d.name || 'Votre nom')}</b><span>${esc(d.titre || 'Titre professionnel (ex : Conducteur de travaux)')}</span><small>${d.ville ? '📍 ' + esc(d.ville) : ''}</small>
            <span class="dp-dispo" style="--c:${D[2]}">${D[1]}</span></div>
          <button class="btn ghost small dp-edit" data-a="id">${icon('edit')} Modifier</button>
          <div class="dp-score"><div><b>Profil complété à ${s}%</b><small>${s < 100 ? 'Complétez-le pour un CV prêt à envoyer' : 'Profil complet ✓'}</small></div><span class="dp-bar"><i style="width:${s}%"></i></span></div>
          <div class="dp-acts"><button class="btn small" data-a="cv">${icon('pdf')} Générer mon CV (PDF)</button><button class="btn ghost small" data-a="career">${icon('briefcase')} Documents & candidatures</button></div>
        </div>
        ${blk('about', 'À propos', 'user', d.about ? `<p class="dp-about" data-edit="about">${esc(d.about)}</p>` : empty('<button class="lnk" data-edit="about">Présentez-vous en 2 ou 3 phrases : métier, années d\'expérience, types de chantiers.</button>'))}
        ${blk('exp', 'Expérience', 'briefcase', d.exp.length ? d.exp.map(x => `<button class="dp-it" data-it="exp:${x.id}"><span class="dp-lg">${esc(dpIni(x.co))}</span><span class="grow"><b>${esc(x.poste)}</b><span>${esc(x.co)}${x.lieu ? ' · ' + esc(x.lieu) : ''}</span><small>${esc([dpMonth(x.de), x.cur ? 'aujourd\'hui' : dpMonth(x.a)].filter(Boolean).join(' – '))}</small>${x.desc ? `<p>${esc(x.desc)}</p>` : ''}</span></button>`).join('') : empty('Ajoutez vos postes : entreprise, chantier, période, missions.'), true)}
        ${blk('form', 'Formation', 'award', d.form.length ? d.form.map(x => `<button class="dp-it" data-it="form:${x.id}"><span class="dp-lg alt">${esc(dpIni(x.ecole))}</span><span class="grow"><b>${esc(x.dip)}</b><span>${esc(x.ecole || '')}</span><small>${esc(x.an || '')}</small></span></button>`).join('') : empty('Diplômes : technicien spécialisé, licence, ingénieur…'), true)}
        ${blk('skills', 'Compétences', 'check', `<div class="dp-chips">${d.skills.map((k, i) => `<button class="dp-chip" data-sk="${i}">${esc(k)} <i>×</i></button>`).join('')}<button class="dp-chip add" data-add="skills">${icon('plus')} Ajouter</button></div>`)}
        ${blk('certs', 'Certifications & habilitations', 'shield', d.certs.length ? d.certs.map(x => `<button class="dp-it" data-it="certs:${x.id}"><span class="dp-lg ok">${icon('award')}</span><span class="grow"><b>${esc(x.n)}</b><span>${esc(x.org || '')}</span><small>${esc(x.an || '')}</small></span></button>`).join('') : empty('SST, habilitation électrique, CACES, formation HSE…'), true)}
        ${blk('langs', 'Langues', 'globe', d.langs.length ? `<div class="dp-chips">${d.langs.map((x, i) => `<button class="dp-chip" data-lg="${i}">${esc(x.l)} · <small>${esc(x.niv)}</small></button>`).join('')}</div>` : empty('Arabe, français, anglais…'), true)}
        ${blk('contact', 'Coordonnées', 'phone', `<div class="dp-kv" data-edit="contact"><div><small>Téléphone</small><b>${esc(d.tel || '—')}</b></div><div><small>E-mail</small><b>${esc(d.email || '—')}</b></div><div><small>LinkedIn</small><b>${esc((d.linkedin || '—').replace(/^https?:\/\/(www\.)?/, ''))}</b></div></div>`)}
        <p class="dp-priv">🔒 Ce profil reste sur votre téléphone. Il n'est partagé que si vous envoyez le CV ou le profil.</p>
      </div>`;
    $('.dp-body', el).scrollTop = keep;
    $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
    $('[data-a=id]', el).onclick = () => dpEditId(draw);
    $('[data-a=photo]', el).onclick = () => dpPhoto(draw);
    $('[data-a=cv]', el).onclick = () => dpCv();
    $('[data-a=share]', el).onclick = () => dpShare();
    $('[data-a=career]', el).onclick = () => { if (typeof openCareer === 'function') openCareer(); };
    $$('[data-edit]', el).forEach(b => b.onclick = () => b.dataset.edit === 'about' ? dpAbout(draw) : dpContact(draw));
    $$('[data-add]', el).forEach(b => b.onclick = () => dpAdd(b.dataset.add, null, draw));
    $$('[data-it]', el).forEach(b => b.onclick = () => { const [k, id] = b.dataset.it.split(':'); dpAdd(k, id, draw); });
    $$('[data-sk]', el).forEach(b => b.onclick = async () => { const d2 = Dossier.get(); if (await confirmBox(`Retirer « ${d2.skills[+b.dataset.sk]} » ?`, 'Retirer')) { d2.skills.splice(+b.dataset.sk, 1); Dossier.set(d2); draw(); } });
    $$('[data-lg]', el).forEach(b => b.onclick = () => dpLang(+b.dataset.lg, draw));
  };
  draw();
}
async function dpEditId(draw) {
  const d = Dossier.get();
  const r = await formSheet('Mon profil', [
    { name: 'name', label: 'Nom et prénom', value: d.name },
    { name: 'titre', label: 'Titre professionnel', value: d.titre, placeholder: 'Ex : Technicien qualité BTP · 6 ans d\'expérience', list: ['Conducteur de travaux', 'Chef de chantier', 'Technicien qualité BTP', 'Ingénieur génie civil', 'Topographe', 'Responsable HSE', 'Métreur', 'Laborantin', 'Ingénieur méthodes'] },
    { name: 'ville', label: 'Ville', value: d.ville, placeholder: 'Ex : Casablanca' },
    { name: 'dispo', label: 'Disponibilité', type: 'select', value: d.dispo, options: DP_DISPO.map(([v, l]) => ({ value: v, label: l })) },
  ], { okLabel: 'Enregistrer' });
  if (!r) return; Object.assign(d, r); Dossier.set(d); draw();
}
async function dpAbout(draw) {
  const d = Dossier.get();
  const r = await formSheet('À propos', [{ name: 'about', label: 'Présentation', type: 'textarea', value: d.about, placeholder: 'Ex : Technicien qualité avec 6 ans d\'expérience sur des projets de bâtiment et d\'ouvrages d\'art (réception de ferraillage, essais, PV)…' }], { okLabel: 'Enregistrer' });
  if (!r) return; d.about = (r.about || '').trim(); Dossier.set(d); draw();
}
async function dpContact(draw) {
  const d = Dossier.get();
  const r = await formSheet('Coordonnées', [{ name: 'tel', label: 'Téléphone', type: 'tel', value: d.tel, placeholder: '+212 6…' }, { name: 'email', label: 'E-mail', type: 'email', value: d.email },
    { name: 'linkedin', label: 'Lien LinkedIn (optionnel)', type: 'url', value: d.linkedin, placeholder: 'https://www.linkedin.com/in/…' }], { okLabel: 'Enregistrer' });
  if (!r) return; Object.assign(d, r); Dossier.set(d); draw();
}
async function dpAdd(k, id, draw) {
  const d = Dossier.get();
  if (k === 'skills') {
    const v = await menu('Ajouter une compétence', [...DP_SKILLS.filter(x => !d.skills.includes(x)).map(x => ({ label: x, value: x })), { label: '✏️ Autre…', value: '__o' }]); if (!v) return;
    let s = v; if (v === '__o') { const r = await formSheet('Compétence', [{ name: 's', label: 'Compétence', placeholder: 'Ex : Précontrainte' }], { okLabel: 'Ajouter' }); if (!r || !r.s) return; s = r.s.trim(); }
    if (!d.skills.includes(s)) d.skills.push(s); Dossier.set(d); return draw();
  }
  if (k === 'langs') return dpLang(-1, draw);
  const L = d[k], x = id ? L.find(y => y.id === id) : null;
  const F = {
    exp: [{ name: 'poste', label: 'Poste', value: x?.poste, placeholder: 'Ex : Chef de chantier' }, { name: 'co', label: 'Entreprise', value: x?.co, placeholder: 'Ex : SGTM' },
      { name: 'lieu', label: 'Lieu / chantier', value: x?.lieu, placeholder: 'Ex : Tanger — Port Tanger Med' }, { name: 'de', label: 'Début', type: 'month', value: x?.de },
      { name: 'cur', label: 'Poste actuel ?', type: 'select', value: x?.cur ? '1' : '', options: [{ value: '', label: 'Non (terminé)' }, { value: '1', label: 'Oui, en cours' }] },
      { name: 'a', label: 'Fin (si terminé)', type: 'month', value: x?.a }, { name: 'desc', label: 'Missions / réalisations', type: 'textarea', value: x?.desc, placeholder: 'Ex : suivi de 3 blocs R+8, réception ferraillage, gestion de 25 ouvriers…' }],
    form: [{ name: 'dip', label: 'Diplôme', value: x?.dip, placeholder: 'Ex : Technicien spécialisé en gros œuvre' }, { name: 'ecole', label: 'École / institut', value: x?.ecole, placeholder: 'Ex : ISTA, EHTP, ENSA…' }, { name: 'an', label: 'Année', value: x?.an, placeholder: 'Ex : 2018' }],
    certs: [{ name: 'n', label: 'Certification / habilitation', value: x?.n, placeholder: 'Ex : Sauveteur secouriste du travail (SST)' }, { name: 'org', label: 'Organisme', value: x?.org }, { name: 'an', label: 'Année', value: x?.an }],
  }[k];
  const r = await formSheet(x ? 'Modifier' : 'Ajouter', F, { okLabel: 'Enregistrer', danger: x ? 'Supprimer' : null }); if (!r) return;
  if (r.__danger) d[k] = L.filter(y => y !== x);
  else { const v = { ...r }; delete v.__danger; if (k === 'exp') { v.cur = v.cur === '1'; if (v.cur) v.a = ''; if (!v.poste) return toast('Indiquez le poste'); }
    if (x) Object.assign(x, v); else L.unshift({ id: DB.uid(), ...v });
    if (k === 'exp') L.sort((a, b) => (b.cur - a.cur) || String(b.de || '').localeCompare(String(a.de || ''))); }
  Dossier.set(d); draw();
}
async function dpLang(i, draw) {
  const d = Dossier.get(), x = i >= 0 ? d.langs[i] : null;
  const r = await formSheet(x ? 'Langue' : 'Ajouter une langue', [{ name: 'l', label: 'Langue', value: x?.l || DP_LANGS.find(l => !d.langs.some(y => y.l === l)) || '', list: DP_LANGS },
    { name: 'niv', label: 'Niveau', type: 'select', value: x?.niv || DP_NIV[2], options: DP_NIV.map(v => ({ value: v, label: v })) }], { okLabel: 'Enregistrer', danger: x ? 'Supprimer' : null });
  if (!r) return; if (r.__danger) d.langs.splice(i, 1); else if (r.l) { if (x) Object.assign(x, { l: r.l, niv: r.niv }); else d.langs.push({ l: r.l, niv: r.niv }); }
  Dossier.set(d); draw();
}
async function dpPhoto(draw) {
  const [f] = await pickFiles({ accept: 'image/*', multiple: false }); if (!f) return;
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(f); });
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), m = Math.min(img.width, img.height);
    g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);
    const d = Dossier.get(); d.photo = c.toDataURL('image/jpeg', .85); Dossier.set(d); draw();
  } catch (e) { toast('Image illisible'); }
}
function dpText(d) {
  return [d.name, d.titre, d.ville && '📍 ' + d.ville, '', d.about, '', d.exp.length && '— Expérience', ...d.exp.map(x => `• ${x.poste} — ${x.co}${x.lieu ? ' (' + x.lieu + ')' : ''} · ${[dpMonth(x.de), x.cur ? 'aujourd\'hui' : dpMonth(x.a)].filter(Boolean).join(' – ')}`),
    d.form.length && '— Formation', ...d.form.map(x => `• ${x.dip}${x.ecole ? ' — ' + x.ecole : ''}${x.an ? ' (' + x.an + ')' : ''}`),
    d.skills.length && '— Compétences : ' + d.skills.join(', '), d.langs.length && '— Langues : ' + d.langs.map(x => `${x.l} (${x.niv})`).join(', '),
    '', [d.tel, d.email, d.linkedin].filter(Boolean).join(' · ')].filter(x => x !== 0 && x !== false && x != null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
async function dpShare() {
  const v = await menu('Partager', [{ label: 'CV en PDF', icon: 'pdf', value: 'cv' }, { label: 'Profil en texte (WhatsApp…)', icon: 'text', value: 'txt' }]); if (!v) return;
  if (v === 'cv') return dpCv(); shareText(dpText(Dossier.get()));
}
// CV A4 sobre : bandeau navy, colonne gauche (contact, compétences, langues), colonne droite (profil, expérience, formation, certifications)
async function dpCv() {
  const d = Dossier.get(); if (!d.name || !d.titre) { toast('Indiquez d\'abord votre nom et votre titre'); return dpEditId(() => {}); }
  if (!window.jspdf) return alertBox('Module PDF indisponible');
  const ld = loading('Création du CV…');
  try {
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), W = 210, H = 297, LW = 66, X2 = LW + 10, CW = W - X2 - 12;
    const navy = [15, 37, 64], blue = [31, 95, 168], grey = [90, 106, 128];
    doc.setFillColor(...navy); doc.rect(0, 0, W, 40, 'F'); doc.setFillColor(238, 242, 248); doc.rect(0, 40, LW, H - 40, 'F');
    let tx = 14; if (d.photo) { try { doc.addImage(d.photo, 'JPEG', 12, 8, 24, 24); tx = 42; } catch (e) {} }
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text(pt(d.name), tx, 19);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11.5); doc.setTextColor(200, 214, 232); doc.text(pt(d.titre), tx, 27);
    if (d.ville) { doc.setFontSize(9.5); doc.text(pt(d.ville), tx, 33); }
    // colonne gauche
    let y = 52; const L = (t) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...navy); doc.text(pt(t.toUpperCase()), 10, y); doc.setDrawColor(...blue); doc.setLineWidth(.6); doc.line(10, y + 1.6, 24, y + 1.6); y += 7; };
    const lt = (t, b) => { doc.setFont('helvetica', b ? 'bold' : 'normal'); doc.setFontSize(9); doc.setTextColor(b ? 30 : 70); const s = doc.splitTextToSize(pt(t), LW - 16); doc.text(s, 10, y); y += s.length * 4.2 + 1; };
    if (d.tel || d.email || d.linkedin) { L('Contact'); if (d.tel) lt(d.tel); if (d.email) lt(d.email); if (d.linkedin) lt(d.linkedin.replace(/^https?:\/\/(www\.)?/, '')); y += 3; }
    if (d.skills.length) { L('Compétences'); d.skills.forEach(s => lt('•  ' + s)); y += 3; }
    if (d.langs.length) { L('Langues'); d.langs.forEach(x => { lt(x.l, true); y -= 1; lt(x.niv); }); y += 3; }
    // colonne droite
    let r = 52; const R = (t) => { if (r > H - 30) { doc.addPage(); doc.setFillColor(238, 242, 248); doc.rect(0, 0, LW, H, 'F'); r = 18; } doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...navy); doc.text(pt(t.toUpperCase()), X2, r); doc.setDrawColor(...blue); doc.setLineWidth(.6); doc.line(X2, r + 1.8, X2 + 18, r + 1.8); r += 8; };
    const rt = (t, o = {}) => { doc.setFont('helvetica', o.b ? 'bold' : o.i ? 'italic' : 'normal'); doc.setFontSize(o.s || 9.5); doc.setTextColor(...(o.c || [45, 55, 70])); const s = doc.splitTextToSize(pt(t), CW); if (r + s.length * 4.4 > H - 14) { doc.addPage(); doc.setFillColor(238, 242, 248); doc.rect(0, 0, LW, H, 'F'); r = 18; } doc.text(s, X2, r); r += s.length * 4.4 + (o.gap ?? 1); };
    if (d.about) { R('Profil'); rt(d.about, { gap: 5 }); }
    if (d.exp.length) { R('Expérience professionnelle'); d.exp.forEach(x => { rt(x.poste, { b: true, s: 10.5, c: [20, 30, 45], gap: .5 }); rt(`${x.co}${x.lieu ? ' — ' + x.lieu : ''}`, { c: blue, gap: .5 }); rt([dpMonth(x.de), x.cur ? 'aujourd\'hui' : dpMonth(x.a)].filter(Boolean).join(' – '), { i: true, s: 8.5, c: grey, gap: 1.5 }); if (x.desc) rt(x.desc, { gap: 4 }); else r += 3; }); r += 2; }
    if (d.form.length) { R('Formation'); d.form.forEach(x => { rt(x.dip, { b: true, s: 10, c: [20, 30, 45], gap: .5 }); rt([x.ecole, x.an].filter(Boolean).join(' · '), { c: grey, gap: 4 }); }); r += 1; }
    if (d.certs.length) { R('Certifications'); d.certs.forEach(x => rt(`${x.n}${x.org ? ' — ' + x.org : ''}${x.an ? ' (' + x.an + ')' : ''}`, { gap: 2 })); }
    doc.setFontSize(7.5); doc.setTextColor(150); doc.text(pt('CV généré avec SiteTeam'), W - 12, H - 6, { align: 'right' });
    ld.close(); await sharePdf(doc, `CV_${safeName(d.name)}.pdf`);
  } catch (e) { ld.close(); alertBox('CV impossible : ' + (e.message || e)); }
}
