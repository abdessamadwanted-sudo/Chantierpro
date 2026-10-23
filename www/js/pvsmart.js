// ================= PV intelligent : lecture du PV (OCR) → date + ouvrage → proposition « Reçu » sur la bonne ligne =================
// L'application ne coche jamais seule : elle propose, l'utilisateur confirme. Alerte si la date du PV n'est pas celle du tableau.
const PVS_ELEM = ['voile', 'voiles', 'poteau', 'poteaux', 'poutre', 'poutres', 'plancher', 'dalle', 'palier', 'escalier', 'corbeau', 'longrine', 'semelle', 'radier', 'acrotere', 'linteau', 'chainage', 'cage', 'ascenseur', 'cremaillere', 'gradin', 'prefabriquee', 'prefabriquees', 'raidisseur', 'mur', 'rampe', 'consoles', 'console'];
const pvsNorm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function pvsTokens(t) {
  const n = pvsNorm(t).replace(/[^a-z0-9+*\/ -]/g, ' ');
  const tok = new Set();
  for (const m of n.matchAll(/\b(r\s?\+\s?\d{1,2}|rdc|ssl|mezz\w*|terrasse)\b/g)) tok.add('niv:' + m[1].replace(/\s/g, '').replace(/^mezz\w*/, 'mezz'));
  for (const m of n.matchAll(/\b([a-h])\s?(\d{1,2})\b/g)) tok.add('axe:' + m[1] + m[2]);
  for (const m of n.matchAll(/\bcr\s?(\d{1,3})\b/g)) tok.add('cr:' + m[1]);
  for (const m of n.matchAll(/\bfil\s+([a-z])\b/g)) tok.add('fil:' + m[1]);
  for (const w of n.split(/\s+/)) { const b = w.replace(/s$/, ''); if (PVS_ELEM.includes(w) || PVS_ELEM.includes(b)) tok.add('el:' + b); }
  return tok;
}
function pvsDate(text) {
  const n = pvsNorm(text).replace(/[oO]/g, '0');
  const i = n.indexOf('date de controle'); const zone = i >= 0 ? n.slice(i, i + 80) : n;
  const m = zone.match(/(\d{1,2})\s*[\/.\- ]\s*(\d{1,2})\s*[\/.\- ]\s*(20\d{2}|\d{2})/) || n.match(/(\d{1,2})\s*[\/.\- ]\s*(\d{1,2})\s*[\/.\- ]\s*(20\d{2})/);
  if (!m) return null; const d = +m[1], mo = +m[2], y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
async function pvsOcr(blob) {
  const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  if (Sync.enabled()) {
    try { const j = await Sync._call('ocr', { b64, mime: blob.type || 'image/jpeg' }); if (j.text) return j.text; }
    catch (e) { if (/Action inconnue/i.test(e.message)) pvsNeedScript(); else console.warn('ocr drive', e); }
  }
  // secours : lecture sur le téléphone (texte imprimé surtout ; l'écriture à la main est moins bien lue)
  try { await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'); const r = await Tesseract.recognize(blob, 'fra'); return r.data.text || ''; } catch (e) { console.warn('ocr local', e); }
  return '';
}
let _pvsWarned = false;
function pvsNeedScript() {
  if (_pvsWarned) return; _pvsWarned = true;
  toast('Lecture des PV : mettez à jour le script Drive', { action: 'Comment ?', onAction: () => alertBox('Pour une meilleure lecture des PV (écriture à la main), mettez à jour le script Google Drive :\n1. Drive › Paramètres de synchro › « Copier le script »\n2. Collez-le dans Apps Script à la place de l\'ancien\n3. Déployer › Gérer les déploiements › modifier › Nouvelle version\n4. Autorisez l\'accès demandé.\nEn attendant, la lecture se fait sur le téléphone.') });
}
// après l'ajout de PV dans un tableau : lit chaque PV et propose la ligne correspondante
async function pvSmartCheck(p, day, recs, onChange) {
  if (!recs || !recs.length || !navigator.onLine) return;
  const ld = loading('Lecture du PV…');
  const res = [];
  try {
    for (const [k, rec] of recs.entries()) {
      ld.set(`Lecture du PV ${recs.length > 1 ? (k + 1) + '/' + recs.length : ''}…`);
      const f = await DB.get('files', rec.id); if (!f || !f.blob) continue;
      const text = await pvsOcr(f.blob); if (!text.trim()) continue;
      const T = pvsTokens(text), date = pvsDate(text);
      const scored = day.rows.filter(r => r.element).map(r => { const R = pvsTokens(`${r.niv || ''} ${r.element}`); let sc = 0, tot = 0; for (const t of R) { const w = t.startsWith('niv:') ? 2 : t.startsWith('el:') ? 1.5 : t.startsWith('cr:') ? 3 : 2; tot += w; if (T.has(t)) sc += w; } return { r, s: tot ? sc / tot : 0 }; }).filter(x => x.s > 0.25).sort((a, b) => b.s - a.s);
      const ouv = (pvsNorm(text).match(/ouvrage[^a-z0-9]{0,4}([a-z0-9 +*\/-]{3,60})/) || [])[1] || '';
      res.push({ rec, date, scored: scored.slice(0, 4), ouv: ouv.trim() });
    }
  } finally { ld.close(); }
  if (!res.length) return toast('PV non lu (photo floue ?) — cochez « Reçu » à la main');
  const html = res.map((x, i) => `<div class="pvs-c"><div class="pvs-h"><b>PV ${res.length > 1 ? i + 1 : ''}</b>${x.date ? `<span class="${x.date === day.date ? 'ok' : 'bad'}">📅 ${fmtDate(x.date)}</span>` : '<span>📅 date non lue</span>'}</div>
      ${x.date && x.date !== day.date ? `<div class="pvs-w">⚠️ Ce PV est du ${fmtDate(x.date)}, pas du ${fmtDate(day.date)} : vérifiez qu'il est dans le bon tableau.</div>` : ''}
      ${x.ouv ? `<small class="pvs-o">Lu : « ${esc(x.ouv)} »</small>` : ''}
      ${x.scored.length ? x.scored.map((m, j) => `<button class="pvs-m ${j === 0 ? 'best' : ''}" data-i="${i}" data-r="${m.r.id}"><span class="grow"><b>${esc(m.r.niv ? m.r.niv + ' · ' : '')}${esc(m.r.element)}</b><small>${m.r.pvRecu ? 'déjà reçu' : 'PV manquant'} · correspondance ${Math.round(m.s * 100)} %</small></span><i>Reçu ✓</i></button>`).join('')
        : `<div class="pvs-w">⚠️ Aucun ouvrage de ce tableau ne correspond à ce PV.</div>`}</div>`).join('');
  const s = sheet(`<div class="pvs">${html}<div class="muted" style="font-size:12px;margin-top:6px">L'application propose, vous confirmez. Rien n'est coché sans votre accord.</div></div>`, { title: '🧠 PV lu automatiquement' });
  $$('.pvs-m', s.el).forEach(b => b.onclick = () => {
    const r = day.rows.find(x => x.id === b.dataset.r); if (!r) return;
    r.pvRecu = true; r.pvAt = todayISO(); const x = res[+b.dataset.i]; r.pvIds = [...(r.pvIds || []), x.rec.id];
    $$(`.pvs-m[data-i="${b.dataset.i}"]`, s.el).forEach(y => y.classList.toggle('on', y === b)); b.querySelector('i').textContent = '✓ Reçu';
    onChange && onChange(); toast(`PV reçu : ${r.element}`);
  });
}
