// ================= Bon de bétonnage : « Demande de bétonnage et contrôle de coffrage — cales en PVC » =================
// Même présentation que le bon papier ; écriture manuscrite bleue ; rempli depuis la réception / le programme de bétonnage ;
// signatures (Travaux, Topographe, Qualité) enregistrées UNE fois par chaque personne, avec son accord.
const BON_W = 1600, BON_H = 1240, BON_INK = '#1c34b0';
const BON_ROLES = [['travaux', 'TRAVEAUX', 'Travaux'], ['topo', 'TOPOGRAPHE', 'Topographe'], ['qualite', 'QUALITE', 'Qualité']];
const BON_FIELDS = [['area', 'AREA:', 'Area (niveau)', 'Ex : R+5'], ['zone', 'ZONE:', 'Zone', 'Ex : 11'], ['ouvrage', 'OUVRAGE:', 'Ouvrage', 'Ex : Voiles CR 23'], ['partie', 'PARTIE D’OUVRAGE:', 'Partie d’ouvrage', 'Ex : Axe D13-D14 entre fil H et I'], ['type', 'TYPE DE BETON:', 'Type de béton', 'Ex : B40/G0']];
let bonFontP = null;
function bonFont() {
  return bonFontP || (bonFontP = (async () => {
    try { const f = new FontFace('BonHand', 'url(vendor/fonts/caveat-latin-600-normal.woff2)'); await f.load(); document.fonts.add(f); } catch (e) { console.warn('police', e); }
  })());
}
const bonImgs = {};
const bonLogo = (n) => bonImgs[n] || (bonImgs[n] = loadImage('assets/bon/' + n).catch(() => null));
function bonCfg(p) {
  p.bon = p.bon || {};
  const c = p.bon;
  c.title = c.title ?? 'Grand Stade Hassan 2';
  c.people = c.people || {};
  BON_ROLES.forEach(([k]) => { c.people[k] = c.people[k] || []; });
  c.last = c.last || {};
  return c;
}

// petites variations stables (même bon = même écriture)
function bonRand(seed) { let s = 7; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) | 0; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
// écriture « stylo » : police manuscrite, encre bleue, légère pente et irrégularités
function bonHand(g, text, x, y, maxW, size, seed) {
  text = String(text || '').trim(); if (!text) return;
  let fs = size;
  const setF = () => { g.font = `600 ${fs}px BonHand, 'Segoe Script', cursive`; };
  // écriture aérée : lettres un peu espacées, espaces larges ; on réduit peu la taille (jamais minuscule)
  let sp = 1.07; const wid = () => g.measureText(text).width * sp + (text.split(' ').length - 1) * fs * 0.12;
  setF(); while (wid() > maxW && fs > 46) { fs -= 2; setF(); }
  while (wid() > maxW && sp > 0.98) sp -= 0.01;
  while (wid() > maxW && fs > 34) { fs -= 2; setF(); }
  const R = bonRand(seed + '|' + text);
  // écriture plus naturelle : taille, pente et ligne de base qui varient un peu à chaque lettre, encre plus ou moins chargée
  g.save(); g.translate(x, y); g.rotate((R() - 0.5) * 0.035 - 0.012); g.textBaseline = 'alphabetic';
  let cx = 0; const wave = R() * 6.28, amp = fs * (0.025 + R() * 0.02);
  for (const [k, ch] of [...text].entries()) {
    const sc = 0.93 + R() * 0.13, rot = (R() - 0.5) * 0.09, dy = Math.sin(wave + k * 0.55) * amp + (R() - 0.5) * fs * 0.05;
    g.save(); g.translate(cx, dy); g.rotate(rot); g.scale(sc, sc); g.transform(1, 0, -0.08 - R() * 0.06, 1, 0, 0);
    g.globalAlpha = 0.86 + R() * 0.14; g.fillStyle = BON_INK; g.fillText(ch, 0, 0); g.restore();
    cx += g.measureText(ch).width * sc * (sp - 0.03 + R() * 0.05) + (ch === ' ' ? fs * (0.1 + R() * 0.06) : 0);
  }
  g.restore();
}
function bonDots(g, x1, x2, y) { g.save(); g.strokeStyle = '#333'; g.setLineDash([2.5, 7]); g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y); g.stroke(); g.restore(); }

// dessine un bon → { canvas, hits } (hits : zones touchables du bon)
async function bonRender(b, cfg) {
  await bonFont();
  const [L1, L2] = await Promise.all([bonLogo('sgtm.png'), bonLogo('tgcc.png')]);
  const cv = document.createElement('canvas'); cv.width = BON_W; cv.height = BON_H;
  const g = cv.getContext('2d'), hits = [];
  g.fillStyle = '#fff'; g.fillRect(0, 0, BON_W, BON_H);
  g.strokeStyle = '#111'; g.lineWidth = 5; g.strokeRect(24, 24, BON_W - 48, BON_H - 48);
  if (L1) g.drawImage(L1, 70, 60, 330, 195);
  if (L2) g.drawImage(L2, 70, 275, 300, 155);
  // titre
  g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = 'italic 54px "Times New Roman", "Noto Serif", serif';
  [['DEMANDE DE BETONNAGE', 120], ['ET', 182], ['CONTROLE DE COFFRAGE', 246], ['CALES EN PVC', 306]].forEach(([t, y]) => g.fillText(t, 1010, y));
  g.font = '48px "Times New Roman", "Noto Serif", serif'; g.fillText(cfg.title || '', 1010, 372);
  g.textAlign = 'left';
  // date
  g.font = '44px "Times New Roman", "Noto Serif", serif'; g.fillText('DATE :', 860, 462); bonDots(g, 1010, 1500, 468);
  { const dt = b.date ? fmtDate(b.date).replace(/\/\d{4}$/, (m) => b.fullYear ? m : '') : ''; g.font = `600 78px BonHand, cursive`; const dw = Math.min(470, g.measureText(dt).width * 1.05); bonHand(g, dt, 1255 - dw / 2, 454, 470, 78, 'date' + b.id); }
  hits.push({ k: 'date', x: 840, y: 400, w: 700, h: 90 });
  // champs
  const ys = [545, 625, 705, 785, 865];
  BON_FIELDS.forEach(([k, lab], i) => {
    const y = ys[i]; g.fillStyle = '#111'; g.font = '44px "Times New Roman", "Noto Serif", serif'; g.fillText(lab, 70, y);
    const lx = 70 + g.measureText(lab).width + 6; bonDots(g, lx, BON_W - 80, y + 4);
    const vx = k === 'area' ? Math.max(lx + 40, 560) : lx + 30;
    bonHand(g, b[k], vx, y - 6, BON_W - 90 - vx, 78, k + b.id);
    hits.push({ k, x: 50, y: y - 60, w: BON_W - 100, h: 78 });
  });
  // tableau des visas
  const roles = BON_ROLES;
  const tx = 70, tw = BON_W - 140, top = 905, hh = 100, bot = BON_H - 55, cw = tw / roles.length;
  g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(tx, top, tw, bot - top);
  g.beginPath(); g.moveTo(tx, top + hh); g.lineTo(tx + tw, top + hh); for (let i = 1; i < roles.length; i++) { g.moveTo(tx + cw * i, top); g.lineTo(tx + cw * i, bot); } g.stroke();
  for (const [i, [k, head]] of roles.entries()) {
    const x = tx + cw * i;
    g.fillStyle = '#111'; g.textAlign = 'center'; g.font = 'italic 40px "Times New Roman", "Noto Serif", serif'; g.fillText(head, x + cw / 2, top + 64); g.textAlign = 'left';
    g.font = '30px "Times New Roman", "Noto Serif", serif'; g.fillText('NOM:', x + 14, top + hh + 52); g.fillText('VISA:', x + 14, top + hh + 128);
    bonDots(g, x + 92, x + cw - 14, top + hh + 56); bonDots(g, x + 92, x + cw - 14, top + hh + 132);
    const pid = (b.sig || {})[k], per = (cfg.people[k] || []).find(q => q.id === pid);
    if (per) {
      const imgOf = async (id) => { const f = await DB.peek('files', id).catch(() => null) || await DB.get('files', id).catch(() => null); return f && f.blob ? loadImage(BlobURL.get(f.id, f.blob)).catch(() => null) : null; };
      const bold = (im, dx, dy, w, h) => { const r = Math.max(1, Math.round(w / 260)); for (const [ox, oy] of [[0, 0], [r, 0], [0, r], [-r, 0], [0, -r]]) g.drawImage(im, dx + ox, dy + oy, w, h); };   // trait plus épais = signature bien visible
      const nim = per.nameImgId ? await imgOf(per.nameImgId) : null;
      if (nim) { const bw = cw - 112, bh = 58, k3 = Math.min(bw / nim.width, bh / nim.height); g.drawImage(nim, x + 96, top + hh + 8 + (bh - nim.height * k3) / 2, nim.width * k3, nim.height * k3); }
      else if (!per.noName) bonHand(g, per.name, x + 96, top + hh + 48, cw - 112, 62, k + b.id);
      if (per.sigId) { const im = await imgOf(per.sigId);
        if (im) { const bw = cw - 40, bh = bot - (top + hh + 66) - 8, k2 = Math.min(bw / im.width, bh / im.height, 2.4); bold(im, x + 20 + (bw - im.width * k2) / 2, top + hh + 66 + (bh - im.height * k2) / 2, im.width * k2, im.height * k2); } }
    }
    hits.push({ k: 'sig:' + k, x, y: top, w: cw, h: bot - top });
  }
  return { canvas: cv, hits };
}

// découpe d'un intitulé d'ouvrage : « Voile CR 77 Axe D2 fil K*L » → ouvrage / partie
function bonSplit(el) {
  const s = String(el || '').trim();
  const m = s.match(/^(.*?)\s+((?:entre\s+)?(?:axe|axes|cote|côte|fil|niv\.?|niveau)\b.*)$/i);
  return m && m[1] ? { ouvrage: m[1].trim(), partie: m[2].trim() } : { ouvrage: s, partie: '' };
}
// nouveau bon à partir d'une ligne de réception / bétonnage
function bonFromRow(r, date, cfg) {
  const { ouvrage, partie } = bonSplit(r.element);
  return { id: DB.uid(), date: date || todayISO(), area: r.niv || '', zone: r.zone || '', ouvrage, partie, type: r.classe || '', sig: { ...(cfg.last || {}) } };
}

// ---------- Personnes + signature ----------
function bonInk(c) {   // garde l'encre (traits foncés) et rend le fond transparent, recadré
  const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i], gg = a[i + 1], bb = a[i + 2], l = (r * 299 + gg * 587 + bb * 114) / 1000, blue = bb - (r + gg) / 2;
    const ink = a[i + 3] > 20 && (l < 120 || (blue > 25 && l < 175));
    if (!ink) { a[i + 3] = 0; continue; }
    a[i] = 28; a[i + 1] = 52; a[i + 2] = 176; a[i + 3] = 255;
    const p = i / 4, x = p % c.width, y = (p / c.width) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  g.putImageData(d, 0, 0);
  if (x1 <= x0 || y1 <= y0) return null;
  const o = document.createElement('canvas'); o.width = x1 - x0 + 16; o.height = y1 - y0 + 16; o.getContext('2d').drawImage(c, x0 - 8, y0 - 8, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}
function bonAddPerson(p, role) {
  return new Promise((resolve) => {
    const R = BON_ROLES.find(r => r[0] === role);
    const s = sheet(`<div class="form bon-per">
      <label>Nom<input name="n" placeholder="Ex : ${role === 'topo' ? 'Aziz' : role === 'qualite' ? 'A. Daga' : 'Walid'}"></label>
      <div class="fld">Signature (la personne signe elle-même dans le cadre)</div>
      <div class="bon-pad"><canvas></canvas></div>
      <div class="btnrow" style="padding:0"><button type="button" class="btn ghost small" data-a="clr">Effacer</button><button type="button" class="btn ghost small" data-a="ph">${icon('camera')} Depuis une photo</button></div>
      <label class="bon-ok"><input type="checkbox" data-a="agree"> J'ai l'accord de cette personne pour utiliser sa signature sur les bons qu'elle a validés.</label>
      <button class="btn" data-a="ok">${icon('check')} Enregistrer</button></div>`, { title: `Ajouter · ${R[2]}` });
    s.onClose = () => resolve(null);
    const c = $('canvas', s.el), W = Math.min(560, s.el.clientWidth - 40 || 320), H = 220, dpr = 2;
    c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = BON_INK;
    let drawing = false, last = null, dirty = false;
    const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.onpointerdown = (e) => { e.preventDefault(); c.setPointerCapture(e.pointerId); drawing = true; last = pos(e); };
    c.onpointermove = (e) => { if (!drawing) return; const q = pos(e); g.beginPath(); g.moveTo(...last); g.lineTo(...q); g.stroke(); last = q; dirty = true; };
    c.onpointerup = c.onpointercancel = () => { drawing = false; };
    $('[data-a=clr]', s.el).onclick = () => { g.clearRect(0, 0, W, H); dirty = false; };
    $('[data-a=ph]', s.el).onclick = async () => {
      const [f] = await pickFiles({ accept: 'image/*' }); if (!f) return;
      const im = await loadImage(URL.createObjectURL(f)); const k = Math.min(1, 900 / Math.max(im.width, im.height));
      const t = document.createElement('canvas'); t.width = im.width * k; t.height = im.height * k; t.getContext('2d').drawImage(im, 0, 0, t.width, t.height);
      const ink = bonInk(t); if (!ink) return toast('Signature non détectée');
      g.clearRect(0, 0, W, H); const kk = Math.min(W / ink.width, H / ink.height); g.drawImage(ink, (W - ink.width * kk) / 2, (H - ink.height * kk) / 2, ink.width * kk, ink.height * kk); dirty = true;
    };
    $('[data-a=ok]', s.el).onclick = async () => {
      const name = $('[name=n]', s.el).value.trim(); if (!name) return toast('Écrivez le nom');
      let sigId = null;
      if (dirty) {
        if (!$('[data-a=agree]', s.el).checked) return toast('Cochez l\'accord de la personne');
        const ink = bonInk(c); if (ink) { const blob = await new Promise(r => ink.toBlob(r, 'image/png')); sigId = (await DB.put('files', { projectId: p.id, blob, mime: 'image/png', role: 'sig', name: `Signature ${name}.png` })).id; }
      }
      const per = { id: DB.uid(), name, sigId, at: Date.now() };
      bonCfg(p).people[role].push(per); await DB.put('projects', p);
      s.onClose = null; s.close(); resolve(per);
    };
  });
}
// signature reprise d'un bon papier signé : on redresse la feuille, on lit la case du rôle (nom + visa) et on garde seulement l'encre
async function bonImportSig(p, role) {
  const src = await pickSource('Photo du bon signé'); if (!src) return null;
  const [f] = await pickImages(src); if (!f) return null;
  const sc = await scanDocuments([f]); if (!sc || !sc.length) return null;   // ajuster les 4 coins sur le bord du bon
  const im = await loadImage(URL.createObjectURL(sc[0]));
  const c = document.createElement('canvas'); c.width = BON_W; c.height = BON_H; c.getContext('2d').drawImage(im, 0, 0, BON_W, BON_H);
  const ri = BON_ROLES.findIndex(r => r[0] === role), tx = 70, tw = BON_W - 140, top = 905, hh = 100, bot = BON_H - 55, cw = tw / BON_ROLES.length, x = tx + cw * ri;
  const cut = (x0, y0, w, h) => { const t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h); return bonInk(t); };
  const nameInk = cut(x + 88, top + hh + 4, cw - 96, 62), sigInk = cut(x + 8, top + hh + 70, cw - 16, bot - (top + hh + 70) - 6);
  if (!sigInk) { toast('Aucune signature trouvée dans la case ' + BON_ROLES[ri][2] + ' — vérifiez le recadrage'); return null; }
  return new Promise((resolve) => {
    const s = sheet(`<div class="form bon-imp"><div class="fld">Case « ${BON_ROLES[ri][2]} » lue sur le bon</div>
      ${nameInk ? `<div class="bi-prev"><small>Nom écrit</small><img data-n></div>` : ''}<div class="bi-prev"><small>Signature</small><img data-s></div>
      <label>Nom (pour la liste)<input name="n" placeholder="Ex : Walid"></label>
      ${nameInk ? `<label class="bon-ok"><input type="checkbox" data-a="keep" checked> Garder le nom écrit à la main sur les bons</label>` : `<label class="bon-ok"><input type="checkbox" data-a="non"> Pas de nom sur les bons (signature seule)</label>`}
      <label class="bon-ok"><input type="checkbox" data-a="agree"> J'ai l'accord de cette personne pour utiliser sa signature sur les bons qu'elle a validés.</label>
      <button class="btn" data-a="ok">${icon('check')} Enregistrer</button></div>`, { title: `Signature · ${BON_ROLES[ri][2]}` });
    if (nameInk) $('[data-n]', s.el).src = nameInk.toDataURL('image/png'); $('[data-s]', s.el).src = sigInk.toDataURL('image/png');
    s.onClose = () => resolve(null);
    $('[data-a=ok]', s.el).onclick = async () => {
      if (!$('[data-a=agree]', s.el).checked) return toast('Cochez l\'accord de la personne');
      const name = $('[name=n]', s.el).value.trim() || 'Signature';
      const put = async (cv, nm) => (await DB.put('files', { projectId: p.id, blob: await new Promise(r => cv.toBlob(r, 'image/png')), mime: 'image/png', role: 'sig', name: nm })).id;
      const keep = nameInk && $('[data-a=keep]', s.el).checked, non = !nameInk && $('[data-a=non]', s.el) && $('[data-a=non]', s.el).checked;
      const per = { id: DB.uid(), name, sigId: await put(sigInk, `Signature ${name}.png`), nameImgId: keep ? await put(nameInk, `Nom ${name}.png`) : null, noName: !!non, at: Date.now() };
      bonCfg(p).people[role].push(per); await DB.put('projects', p);
      s.onClose = null; s.close(); toast('Signature importée ✓'); resolve(per);
    };
  });
}
async function bonPickPerson(p, role, cur) {
  const cfg = bonCfg(p), R = BON_ROLES.find(r => r[0] === role);
  const v = await menu(R[2], [
    ...cfg.people[role].map(q => ({ label: `${q.name}${q.sigId ? ' ✍' : ''}`, icon: q.id === cur ? 'check' : 'team', value: q.id })),
    { label: 'Ajouter une personne…', icon: 'plus', value: '__add' },
    { label: 'Importer depuis un bon signé (photo)', icon: 'camera', value: '__imp' },
    ...(cfg.people[role].length ? [{ label: 'Gérer la liste…', icon: 'edit', value: '__edit' }] : []),
    ...(cur ? [{ label: 'Laisser vide', icon: 'close', value: '__none' }] : []),
  ]);
  if (!v) return undefined;
  if (v === '__none') return null;
  if (v === '__add') { const q = await bonAddPerson(p, role); return q ? q.id : undefined; }
  if (v === '__imp') { const q = await bonImportSig(p, role); return q ? q.id : undefined; }
  if (v === '__edit') {
    const id = await menu('Supprimer qui ?', cfg.people[role].map(q => ({ label: q.name, icon: 'trash', value: q.id })));
    const q = cfg.people[role].find(x => x.id === id);
    if (q && await confirmBox(`Retirer ${q.name} et sa signature ?`)) { if (q.sigId) await DB.del('files', q.sigId); cfg.people[role] = cfg.people[role].filter(x => x !== q); await DB.put('projects', p); }
    return undefined;
  }
  return v;
}

// ---------- Écran du bon ----------
// onSave(bon) est appelé à chaque enregistrement (le bon contient fileId = image du bon)
function openBon(p, bon, onSave) {
  return new Promise(async (resolve) => {
    const cfg = bonCfg(p); bon.sig = bon.sig || {};
    const el = document.createElement('div'); el.className = 'fullpage bon-page'; document.body.appendChild(el);
    const close = () => { unBack(); el.remove(); resolve(bon); };
    const unBack = pushBack(() => { el.remove(); resolve(bon); });
    let hits = [], t = null, dirty = false;
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1 style="flex:1;font-size:17px">Bon de bétonnage</h1>
        <button class="iconbtn" data-a="view" title="Afficher en grand">${icon('eye')}</button><button class="iconbtn" data-a="share" title="Partager">${icon('share')}</button><button class="iconbtn" data-a="more">${icon('more')}</button></div>
      <div class="bon-body"><div class="bon-prev"><img alt="Bon"></div><div class="bon-hint">Touchez une case du bon pour la modifier ou choisir la signature</div>
        <div class="form bon-form">
          <label>Date<input type="date" name="date" value="${esc(bon.date || todayISO())}"></label>
          ${BON_FIELDS.map(([k, , lab, ph]) => `<label>${lab}<input name="${k}" value="${esc(bon[k] || '')}" placeholder="${esc(ph)}"></label>`).join('')}
          <div class="bon-sigs"></div>
          <div class="btnrow" style="padding:0"><button class="btn" data-a="save">${icon('check')} Enregistrer</button><button class="btn ghost" data-a="wa">${icon('share')} WhatsApp</button></div>
        </div></div>`;
    const img = $('.bon-prev img', el);
    const sigs = () => { $('.bon-sigs', el).innerHTML = BON_ROLES.map(([k, , lab]) => { const q = cfg.people[k].find(x => x.id === bon.sig[k]); return `<button type="button" class="bon-sig ${q ? 'on' : ''}" data-r="${k}"><small>${lab}</small><b>${q ? esc(q.name) + (q.sigId ? ' ✍' : '') : 'Choisir…'}</b></button>`; }).join('');
      $$('[data-r]', el).forEach(b => b.onclick = () => pick(b.dataset.r)); };
    const draw = async () => { const r = await bonRender(bon, cfg); hits = r.hits; img.src = r.canvas.toDataURL('image/jpeg', 0.9); img._cv = r.canvas; };
    const redraw = () => { clearTimeout(t); t = setTimeout(draw, 250); };
    const pick = async (role) => { const id = await bonPickPerson(p, role, bon.sig[role]); if (id === undefined) return sigs(); bon.sig[role] = id; cfg.last[role] = id; await DB.put('projects', p); dirty = true; sigs(); draw(); };
    $$('.bon-form [name]', el).forEach(i => i.oninput = () => { bon[i.name] = i.value; dirty = true; redraw(); });
    img.onclick = (e) => {
      const r = img.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * BON_W, y = (e.clientY - r.top) / r.height * BON_H;
      const h = hits.filter(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h).pop(); if (!h) return view();
      if (h.k.startsWith('sig:')) return pick(h.k.slice(4));
      const inp = $(`.bon-form [name=${h.k}]`, el); if (inp) { inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => inp.focus(), 250); }
    };
    const save = async (quiet) => {
      const cv = img._cv || (await bonRender(bon, cfg)).canvas;
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
      if (bon.fileId) { await DB.del('files', bon.fileId); BlobURL.drop(bon.fileId); }
      bon.fileId = (await DB.put('files', { projectId: p.id, blob, mime: 'image/jpeg', role: 'doc', name: `Bon ${bon.ouvrage || ''} ${bon.partie || ''}.jpg`.trim() })).id;
      bon.at = Date.now(); dirty = false;
      if (onSave) await onSave(bon);
      if (!quiet) toast('Bon enregistré ✓');
    };
    $('[data-a=save]', el).onclick = async () => { await save(); close(); };
    const share = async () => { await save(true); await sharePhotos([bon.fileId], `Demande de bétonnage — ${[bon.area, bon.zone ? 'Zone ' + bon.zone : '', bon.ouvrage, bon.partie].filter(Boolean).join(' · ')} — ${fmtDate(bon.date)}`, 'Bon de bétonnage'); };
    $('[data-a=wa]', el).onclick = share; $('[data-a=share]', el).onclick = share;
    $('[data-a=x]', el).onclick = async () => { if (dirty && await confirmBox('Enregistrer le bon ?', 'Enregistrer')) await save(); close(); };
    $('[data-a=more]', el).onclick = async () => {
      const v = await menu('Bon', [{ label: 'PDF du bon', icon: 'pdf', value: 'pdf' }, { label: 'Nom du chantier sur le bon', icon: 'edit', value: 'title' }]);
      if (v === 'title') { const r = await formSheet('Nom du chantier', [{ name: 't', label: 'Sous le titre du bon', value: cfg.title }]); if (r) { cfg.title = r.t || ''; await DB.put('projects', p); draw(); } }
      if (v === 'pdf') { await save(true); await bonsPdf(p, [bon], `Bon ${bon.ouvrage || ''}`); }
    };
    const view = () => { if (img.src) showGallery([{ src: img.src, caption: `Bon de bétonnage · ${[bon.ouvrage, bon.partie].filter(Boolean).join(' · ')}` }], 0); };
    $('[data-a=view]', el).onclick = view;
    sigs(); await draw();
    if (bon.fileId || bon.at) view();   // bon déjà fait : on l'affiche directement (fermer = revenir pour modifier)
  });
}

// ---------- PDF : 6 bons par page A4 (comme le modèle papier) ----------
async function bonsPdf(p, bons, name = 'Bons de bétonnage') {
  if (!bons.length) return toast('Aucun bon');
  const ld = loading('Création du PDF…');
  try {
    const cfg = bonCfg(p), { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const cw = 98, ch = cw * BON_H / BON_W, mx = (210 - 2 * cw) / 3, my = (297 - 3 * ch) / 4;
    for (let i = 0; i < bons.length; i++) {
      if (i && i % 6 === 0) doc.addPage();
      const k = i % 6, cx = mx + (k % 2) * (cw + mx), cy = my + Math.floor(k / 2) * (ch + my);
      const cv = (await bonRender(bons[i], cfg)).canvas;
      doc.addImage(cv.toDataURL('image/jpeg', 0.9), 'JPEG', cx, cy, cw, ch);
    }
    const blob = doc.output('blob');
    ld.close();
    await shareBlob(blob, `${name}.pdf`.replace(/[\\/:*?"<>|]+/g, '-'), 'application/pdf');
  } catch (e) { ld.close(); alertBox('PDF impossible : ' + (e.message || e)); }
}
