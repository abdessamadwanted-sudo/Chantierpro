// ================= Détection automatique des cases d'un bon / d'une fiche (Document Studio, phase 5 partielle) =================
// On repère les intitulés imprimés (« DATE : », « ZONE ……… », « NOM / VISA ») et on propose une case à côté de chacun.
// Deux sources de mots : le texte du PDF (pdf.js) ; à défaut (photo / scan) une lecture OCR (tesseract, hors ligne).
// L'écriture à la main n'est PAS lue : seuls les intitulés imprimés servent. Les cases proposées sont toujours à vérifier.
(function () {
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  // intitulés fréquents sur les bons de chantier (sans accents, minuscules)
  const CLES = ['date', 'zone', 'ouvrage', 'partie', 'type', 'beton', 'nom', 'visa', 'axe', 'file', 'niveau', 'niv', 'element', 'observation', 'observations',
    'signature', 'designation', 'chantier', 'projet', 'lot', 'entreprise', 'reference', 'ref', 'fiche', 'plan', 'indice', 'volume', 'cadence', 'heure', 'camion', 'centrale', 'fournisseur', 'affaire', 'client', 'objet', 'etabli'];
  const PTS = /^[.…_\-·•\s]{3,}$/;                       // ligne de points / tirets / soulignement
  const estCle = (t) => { const n = norm(t); return !!n && n.split(' ').some(w => CLES.includes(w)); };

  // mots : [{t, x, y, w, h}] en points de page, origine en haut à gauche. Retourne [{label, x, y, w, h}].
  function depuisMots(mots, W, H) {
    const ws = (mots || []).filter(m => m && String(m.t).trim() && m.w > 0 && m.h > 0).map(m => ({ ...m, t: String(m.t).trim() }));
    if (!ws.length) return [];
    // 1. lignes
    ws.sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
    const lignes = [];
    for (const m of ws) { const cy = m.y + m.h / 2, L = lignes[lignes.length - 1]; if (L && Math.abs(cy - L.cy) < Math.max(L.h, m.h) * 0.6) { L.m.push(m); L.cy = (L.cy * (L.m.length - 1) + cy) / L.m.length; L.h = Math.max(L.h, m.h); } else lignes.push({ m: [m], cy, h: m.h }); }
    const out = [];
    for (const L of lignes) {
      L.m.sort((a, b) => a.x - b.x);
      // 2. segments : mots proches fusionnés
      const seg = [];
      for (const m of L.m) { const s = seg[seg.length - 1]; if (s && !/[:：]\s*$/.test(s.t) && m.x - (s.x + s.w) < Math.max(m.h, s.h) * 0.8 && PTS.test(m.t) === PTS.test(s.t)) { s.t += ' ' + m.t; s.w = m.x + m.w - s.x; s.h = Math.max(s.h, m.h); s.y = Math.min(s.y, m.y); } else seg.push({ ...m }); }
      for (let i = 0; i < seg.length; i++) {
        const s = seg[i]; if (PTS.test(s.t)) continue;
        const lettres = (s.t.match(/[A-Za-zÀ-ÿ]/g) || []).length; if (lettres < 2 || s.t.length > 48) continue;
        const suivant = seg[i + 1], pts = suivant && PTS.test(suivant.t) && suivant.x - (s.x + s.w) < s.h * 3;   // (pts : points juste après l'intitulé)
        const deuxPts = /[:：]\s*$/.test(s.t), libre = (suivant ? suivant.x : W - 18) - (s.x + s.w);
        if (!(deuxPts || pts || (estCle(s.t) && libre > s.h * 4))) continue;
        // 3. case : sur ce qui suit l'intitulé (points, ou écriture déjà là) jusqu'au prochain intitulé ; sinon dans l'espace libre
        const h = Math.max(14, s.h * 1.35), cy = s.y + s.h / 2, estLab = (g) => !PTS.test(g.t) && (g.t.match(/[A-Za-zÀ-ÿ]/g) || []).length >= 2 && (/[:：]\s*$/.test(g.t) || estCle(g.t));
        let x0 = s.x + s.w + 3, x1 = x0, j = i + 1;
        while (seg[j] && !estLab(seg[j])) { x1 = seg[j].x + seg[j].w; j++; }
        if (j > i + 1 && seg[i + 1].x - x0 < s.h * 3) x0 = seg[i + 1].x; else x1 = x0;
        if (x1 - x0 < 28) x1 = seg[j] ? seg[j].x - 4 : Math.min(W - 14, x0 + 220);
        const w = Math.min(x1 - x0, 260); if (w < 28) continue;
        const label = s.t.replace(/[:：.…_\-·•\s]+$/g, '').replace(/^[.…_\-·•\s]+/, '').slice(0, 40);
        if (label.length < 2) continue;
        out.push({ label: label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(), x: Math.max(0, x0), y: Math.max(0, Math.min(H - h, cy - h / 2)), w, h });
      }
    }
    return out;
  }

  // associe les cases détectées aux colonnes d'un suivi (nom proche) ; le reste est ignoré
  function versColonnes(cases, cols) {
    const res = [], pris = new Set();
    for (const c of cases) {
      const n = norm(c.label); if (n.length < 3) continue;
      const col = (cols || []).find(k => { if (pris.has(k.id)) return false; const m = norm(k.libelle); return m && (m === n || (m.length >= 3 && (m.includes(n) || n.includes(m)))); });
      if (col) { pris.add(col.id); res.push({ ...c, col: col.id, label: col.libelle }); }
    }
    return res;
  }
  const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const nouvelles = (cases, existantes) => cases.filter(c => !existantes.some(e => inter(c, e) > 0.3 * Math.min(c.w * c.h, e.w * e.h)));

  // ---- source 1 : texte du PDF (pdf.js) ----
  async function motsTexte(page) {
    const vp = page.getViewport({ scale: 1 }), tc = await page.getTextContent(), mots = [];
    for (const it of tc.items) { if (!it.str || !String(it.str).trim()) continue; const t = pdfjsLib.Util.transform(vp.transform, it.transform), h = Math.hypot(t[2], t[3]) || it.height || 10;
      mots.push({ t: it.str, x: t[4], y: t[5] - h * 0.95, w: (it.width || 0) * (vp.scale || 1), h }); }
    return { mots, W: vp.width, H: vp.height };
  }
  // ---- source 2 : OCR (tesseract, fichiers locaux vendor/3d) sur une image de la page ----
  async function motsOcr(canvas, W, H, progress) {
    await loadScript('vendor/3d/tesseract.min.js');
    const base = new URL('vendor/3d/', location.href).href;
    const worker = await Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true, logger: (m) => { if (m.status === 'recognizing text' && progress) progress(m.progress); } });
    try {
      await worker.setParameters({ tessedit_pageseg_mode: '11' });   // texte épars
      const { data } = await worker.recognize(canvas), k = W / canvas.width;
      return (data.words || []).filter(w => w.confidence >= 60 && w.text && w.text.trim()).map(w => ({ t: w.text, x: w.bbox.x0 * k, y: w.bbox.y0 * k, w: (w.bbox.x1 - w.bbox.x0) * k, h: (w.bbox.y1 - w.bbox.y0) * k }));
    } finally { await worker.terminate(); }
  }
  // page pdf.js → cases proposées : texte d'abord, OCR si le PDF n'a pas de texte exploitable (photo, scan)
  async function detecter(page, opt = {}) {
    const T = await motsTexte(page); let cases = depuisMots(T.mots, T.W, T.H), via = 'texte';
    if (cases.length < 2) {
      const vp1 = page.getViewport({ scale: 1 }), s = Math.min(3, 2200 / Math.max(vp1.width, vp1.height)), cv = document.createElement('canvas');
      cv.width = Math.round(vp1.width * s); cv.height = Math.round(vp1.height * s);
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: g, viewport: page.getViewport({ scale: s }) }).promise;
      const mots = await motsOcr(cv, vp1.width, vp1.height, opt.progress); cv.width = cv.height = 0;
      cases = depuisMots(mots, vp1.width, vp1.height); via = 'ocr';
    }
    return { cases, via, W: T.W, H: T.H };
  }
  window.AutoCases = { depuisMots, versColonnes, nouvelles, detecter, motsOcr, norm };
})();
