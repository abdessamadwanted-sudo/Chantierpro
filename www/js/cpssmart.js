// ================= Recherche intelligente dans le CPS / CCTP : darija, phrases incomplètes, fautes, synonymes + fiches techniques =================
// Tout se fait sur le téléphone (sans internet) : la question est découpée en idées (béton, décoffrage, délai…),
// chaque idée est élargie à ses synonymes (français + darija en lettres latines ou arabes), puis on classe les passages.
const CL_CONCEPTS = [
  ['béton', 'beton betons bitoun biton betoun bton bitone بيطون البيطون لبيطون بطون بيتون'],
  ['coffrage', 'coffrage coffrages coffrer kofraj kofrage coffraj banche banches moule moules كوفراج لكوفراج الكوفراج'],
  ['décoffrage', 'decoffrage decoffrer decoffre dekofraj decofraj demoulage etaiement etai etais etaye chandelle chandelles ديكوفراج لديكوفراج'],
  ['ferraillage', 'ferraillage ferraille armature armatures acier aciers fer hadid l7did 7did lhdid ha barre barres treillis tor حديد لحديد الحديد'],
  ['enrobage', 'enrobage enrobages enrobe cale cales kal kalat distanceur distanceurs كال لكال الكال كالات'],
  ['recouvrement', 'recouvrement recouvrements chevauchement ancrage ancrages scellement rkoub ركوب'],
  ['ciment', 'ciment ciments cimo cimon cpj cpa liant liants سيمة السيمة سيمو سيمان'],
  ['eau', 'eau gachage lma lmaa الما لما ماء'],
  ['granulats', 'granulat granulats gravier gravette gravillon sable sables rmel ghabra رملة الرملة رمل'],
  ['dosage', 'dosage dosages dose doser kg/m3 quantite proportion ch7al chhal chhal chehal شحال قداش minimum minimal maximum mini maxi'],
  ['résistance', 'resistance resistances mpa fc28 fc28j fcj classe classes compression quwa قوة'],
  ['essais', 'essai essais eprouvette eprouvettes test tests prelevement prelevements laboratoire labo لابو controle controles ecrasement'],
  ['slump', 'slump affaissement abrams cone consistance ouvrabilite fluidite'],
  ['cure', 'cure arrosage arroser humidification humidifier protection rach rech رش ترشاش'],
  ['vibration', 'vibration vibrer vibreur vibrage vibre aiguille'],
  ['délai', 'delai delais jour jours nhar iyam iam ayam duree temps semaine semaines heure heures mda أيام ايام نهار النهار مدة'],
  ['tolérance', 'tolerance tolerances ecart ecarts aplomb planeite rectitude faux-aplomb precision'],
  ['étanchéité', 'etancheite etanche etancher tanchi complexe bitume membrane'],
  ['maçonnerie', 'maconnerie brique briques agglo agglos parpaing parpaings bloc blocs yajour ياجور الياجور لياجور بريك'],
  ['enduit', 'enduit enduits crepissage crepi lissage tlbis تلبيس'],
  ['peinture', 'peinture peintures zwaq sbagha زواق صباغة الصباغة'],
  ['carrelage', 'carrelage carreau carreaux zellige zelij faience زليج الزليج'],
  ['chape', 'chape chapes ragreage'],
  ['fondation', 'fondation fondations semelle semelles radier radiers fouille fouilles terrassement terrassements hfir حفير الحفير'],
  ['poteau', 'poteau poteaux poto potou بوطو البوطو عمود'],
  ['poutre', 'poutre poutres longrine longrines chainage chainages'],
  ['plancher', 'plancher planchers dalle dalles hourdis corps creux pre-dalle predalle دالة الدالة'],
  ['voile', 'voile voiles mur murs voile-beton حيط الحيط'],
  ['reprise', 'reprise reprises joint joints arret'],
  ['température', 'temperature temperatures chaleur chaud froid gel hiver ete s5ana skhana lbard سخانة البرد الشمش'],
  ['épaisseur', 'epaisseur epaisseurs diametre diametres espacement espacements ecartement distance dimension dimensions section sections'],
  ['réception', 'reception receptions receptionner pv proces-verbal verification visa agrement'],
  ['pénalités', 'penalite penalites retard retards amende ghrama غرامة الغرامة خطية'],
  ['paiement', 'paiement paiements decompte decomptes situation situations facture avance retenue garantie caution flous فلوس الخلاص khlas'],
  ['sécurité', 'securite epi casque harnais garde-corps signalisation hse'],
  ['nettoyage', 'nettoyage nettoyer propre proprete repli dechets'],
];
const CL_STOP = new Set(('le la les l de des du d un une et ou en a au aux pour par sur sous dans est sont etre que qui quoi quel quelle quels quelles comment combien avec sans ce cet cette ces se sa son ses leur il elle on y ne pas plus doit doivent faut peut entre lors avant apres selon tout tous toute toutes '
  + 'chno achno ach wach wash kifach kifash fin fine ina li lli dyal dial d f fi ila wla o w ana nta bghit bghina kayn kayna kaynin khass khassni khasso wach daba m3a ma3a b bach had hadi hadak hadik ghir 3la ala mn men lah ok '
  + 'شنو اش اشنو واش كيفاش فين لي اللي ديال ف في الى إلى ولا و انا بغيت كاين كاينة خاص خاصني مع ب باش هاد هادي غير على من').split(/\s+/));
const clNorm = (t) => normTxt(t).replace(/[ـًٌٍَُِّْ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const clTok = (t) => clNorm(t).split(/[^a-z0-9؀-ۿ/+-]+/).filter(Boolean);
const clStem = (w) => /^[a-z]/.test(w) && w.length > 4 ? w.replace(/(ements|ement|ations|ation|ages|age|ees|ee|es|s|x)$/, '') : w;
const CL_IDX = (() => { const m = new Map(); CL_CONCEPTS.forEach(([n, terms], i) => terms.split(/\s+/).forEach(t => { const k = clNorm(t); m.set(k, i); m.set(clStem(k), i); })); return m; })();
function lev1(a, b, max) {   // distance d'édition bornée
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = b.length; let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { const cur = [i]; let best = i; for (let j = 1; j <= n; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < best) best = cur[j]; } if (best > max) return max + 1; prev = cur; }
  return prev[n];
}
// question → idées : [{ label, terms:[...], w }]
function clParse(q) {
  const toks = clTok(q), ideas = [], seen = new Set();
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]; if (CL_STOP.has(t) || (t.length < 2 && !/\d/.test(t))) continue;
    const vars = [t, clStem(t), t.replace(/^(el|al|l|f|b)(?=[a-z]{3})/, ''), t.replace(/^(فال|بال|وال|لل|ال|ف|ب|ل|و)(?=[\u0600-\u06ff]{2})/, ''), t.replace(/^(فال|بال|وال|لل|ال|ف|ب|ل|و)/, 'ال')];   // préfixes darija : l-kal, فالبيطون…
    let ci = null; for (const v of vars) { if (CL_IDX.has(v)) { ci = CL_IDX.get(v); break; } }
    if (ci == null && t.length >= 5 && !/\d/.test(t)) { for (const [term, i] of CL_IDX) if (term.length >= 4 && term[0] === t[0] && lev1(t, term, t.length >= 8 ? 2 : 1) <= (t.length >= 8 ? 2 : 1)) { ci = i; break; } }
    if (ci != null) { if (seen.has('c' + ci)) continue; seen.add('c' + ci); ideas.push({ label: CL_CONCEPTS[ci][0], terms: [...new Set(CL_CONCEPTS[ci][1].split(/\s+/).map(clNorm))], w: ci === 9 || ci === 15 ? .7 : 1 }); continue; }
    if (seen.has(t)) continue; seen.add(t);
    ideas.push({ label: t, terms: [t, clStem(t)], w: /\d/.test(t) ? 1.6 : 1, raw: true });
  }
  return ideas;
}
// découpe des pages en passages (≈ 2-4 phrases)
const _clChunks = new Map();
function clChunks(fileId, pages) {
  if (_clChunks.has(fileId)) return _clChunks.get(fileId);
  const out = [];
  // n° et titre de l'article en cours (ARTICLE 12 – BÉTONS, Art. 3.2.1 Coffrages, 4.1.2 - Armatures…)
  const ART = /(?:^|\s)(?:ARTICLE|Article|ART\.?|Art\.)\s*([0-9IVXL]+(?:[.\-][0-9]+)*)\s*[:.\-–—]?\s*([A-ZÀ-Ýa-zà-ÿ'’ ,\/()-]{3,70})?|(?:^|\s)((?:\d{1,2}\.){1,3}\d{1,2})\.?\s+[-–—]?\s*([A-ZÀ-Ý][A-ZÀ-Ýa-zà-ÿ'’ ,\/()-]{3,60})/;
  let art = '';
  const artOf = (x) => { const m = x.match(ART); if (!m) return null; const n = m[1] || m[3], t = (m[2] || m[4] || '').replace(/\s+(Le|La|Les|Il|Ce|Cette|L'|Pour|Dans)\b.*$/, '').trim(); return `Art. ${n}${t ? ' — ' + t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : ''}`; };
  pages.forEach((txt, pi) => {
    const s = String(txt || '').replace(/\s+/g, ' ').trim(); if (!s) return;
    const sent = s.split(/(?<=[.;:!?])\s+(?=[A-ZÀ-Ý0-9•\-–(])/);
    let cur = '', cart = art;
    for (const x of sent) { const a = artOf(x.slice(0, 120));
      if ((cur + ' ' + x).length > 420 && cur) { out.push({ page: pi + 1, t: cur, art: cart }); cur = cur.length > 160 ? cur.slice(-120) + ' ' + x : x; cart = art; } else cur = cur ? cur + ' ' + x : x;
      if (a) { art = a; if (cur === x || cur.endsWith(x) && cur.length < 140) cart = a; } }
    if (cur) out.push({ page: pi + 1, t: cur, art: cart });
  });
  out.forEach(c => { c.n = clNorm(c.t); c.w = new Set(clTok(c.t)); });
  _clChunks.set(fileId, out); return out;
}
function clMatchIdea(ch, idea) {
  for (const term of idea.terms) {
    if (!term) continue;
    if (/\s|-|\//.test(term)) { if (ch.n.includes(term)) return term; continue; }
    if (ch.w.has(term)) return term;
    if (term.length >= 4) for (const w of ch.w) if (w.startsWith(term) && w.length - term.length <= 4) return w;
  }
  if (idea.raw && idea.terms[0].length >= 5) for (const w of ch.w) if (w[0] === idea.terms[0][0] && lev1(w, idea.terms[0], 1) <= 1) return w;
  return null;
}
// recherche : renvoie les meilleurs passages [{ c, page, score, snip, hl }]
function clSmart(q, clauses, idx) {
  const ideas = clParse(q); if (!ideas.length) return { ideas, hits: [] };
  const all = []; for (const c of clauses) { const pg = idx[c.id]; if (pg) for (const ch of clChunks(c.fileId, pg)) all.push({ c, ch }); }
  const N = all.length || 1;
  const df = ideas.map(I => all.reduce((a, x) => a + (clMatchIdea(x.ch, I) ? 1 : 0), 0));
  const nq = clNorm(q.trim()), hits = [];
  for (const { c, ch } of all) {
    let sc = 0, got = 0; const hl = [];
    ideas.forEach((I, i) => { const m = clMatchIdea(ch, I); if (m) { got++; sc += I.w * Math.log(1 + N / (1 + df[i])); hl.push(m); } });
    if (!got) continue;
    if (got === ideas.length && ideas.length > 1) sc *= 1.6;
    sc *= .55 + .45 * got / ideas.length;
    if (nq.length > 3 && ch.n.includes(nq)) sc += 3;
    if (/\d/.test(ch.t) && ideas.some(I => ['dosage', 'délai', 'épaisseur', 'résistance', 'tolérance'].includes(I.label))) sc *= 1.15;   // une valeur chiffrée répond souvent à la question
    hits.push({ c, page: ch.page, score: sc, got, t: ch.t, hl, art: ch.art });
  }
  hits.sort((a, b) => b.score - a.score);
  const seen = new Set(), out = [];
  for (const h of hits) { const k = h.c.id + '|' + h.t.slice(0, 60); if (seen.has(k)) continue; seen.add(k); out.push(h); if (out.length >= 60) break; }
  const max = out.length ? out[0].score : 1;
  out.forEach(h => { h.pct = Math.max(8, Math.round(h.score / max * 100)); h.snip = clSnip(h.t, h.hl); });
  return { ideas, hits: out };
}
function clSnip(t, hl) {
  let s = esc(t.length > 520 ? t.slice(0, 520) + '…' : t);
  const words = [...new Set(hl)].filter(w => w.length > 1).sort((a, b) => b.length - a.length);
  if (!words.length) return s;
  // surligne sans tenir compte des accents
  const map = []; let flat = ''; for (let i = 0; i < s.length; i++) { const n = clNorm(s[i]); for (const ch of n) { flat += ch; map.push(i); } }
  const marks = [];
  for (const w of words) { let k = 0; while ((k = flat.indexOf(w, k)) >= 0) { const before = flat[k - 1], after = flat[k + w.length]; if (!(before && /[a-z0-9]/.test(before))) marks.push([map[k], map[k + w.length - 1] + 1]); k += w.length; } }
  marks.sort((a, b) => a[0] - b[0]); let out = '', p = 0;
  for (const [a, b] of marks) { if (a < p) continue; let e = b; while (e < s.length && /[a-zà-ÿ0-9]/i.test(s[e])) e++; out += s.slice(p, a) + '<mark>' + s.slice(a, e) + '</mark>'; p = e; }
  return out + s.slice(p);
}

// ---------- Fiches techniques (repères usuels) reliées au CPS ----------
// Valeurs courantes de chantier (BAEL / NM / pratique) — c'est toujours le CPS / CCTP du marché qui fait foi.
const CL_FICHES = [
  { k: 'enrobage', e: '🧱', t: 'Enrobage des armatures', q: 'enrobage armatures cales', rows: [['Locaux couverts, non exposés', '≥ 1 cm'], ['Parois exposées aux intempéries / condensation, au contact d\'un liquide', '≥ 3 cm'], ['Ambiance agressive (bord de mer, sols agressifs)', '≥ 5 cm'], ['Cales', 'béton ou PVC, ≈ 4 / m², tous les ≈ 1 m']] },
  { k: 'classes', e: '🏗️', t: 'Classes de béton', q: 'classe béton résistance dosage ciment', rows: [['B20 / C16/20', 'béton de propreté, ouvrages peu sollicités'], ['B25 / C20/25', 'béton armé courant'], ['B30 / C25/30', 'structures (poteaux, voiles, planchers) selon CPS'], ['B35 et + / C30/37…', 'ouvrages exposés / fortement chargés'], ['Gros béton / propreté', 'souvent 150 à 250 kg/m³ de ciment']] },
  { k: 'slump', e: '🔻', t: 'Affaissement (cône d\'Abrams)', q: 'affaissement slump consistance', rows: [['S1 ferme', '10 à 40 mm'], ['S2 plastique', '50 à 90 mm'], ['S3 très plastique', '100 à 150 mm'], ['S4 fluide', '160 à 210 mm'], ['S5', '≥ 220 mm']] },
  { k: 'eprouv', e: '🧪', t: 'Éprouvettes et essais', q: 'éprouvettes essais écrasement prélèvement', rows: [['Éprouvettes', 'cylindres 16 × 32 cm (ou 11 × 22)'], ['Échéances', 'écrasement à 7 j et 28 j (parfois 3 j)'], ['Prélèvement', 'par toupie / par volume coulé selon le CPS'], ['Conservation', 'démoulage à 24 h, cure dans l\'eau']] },
  { k: 'decof', e: '⏱️', t: 'Décoffrage', q: 'décoffrage délai étaiement jours', rows: [['Faces verticales (voiles, poteaux)', 'souvent après 1 à 3 jours'], ['Fonds de poutres / dalles', 'après résistance suffisante — souvent 7 j avec réétaiement, étais jusqu\'à ≈ 28 j'], ['Temps froid', 'délais allongés'], ['Règle', 'délais exacts : voir CPS / avis du BET']] },
  { k: 'recouv', e: '🔗', t: 'Recouvrement / ancrage', q: 'recouvrement ancrage longueur', rows: [['FeE400', 'ls ≈ 40 Ø'], ['FeE500', 'ls ≈ 50 Ø'], ['Crochets', 'selon plan de ferraillage'], ['Zones de recouvrement', 'décalées, hors zones les plus sollicitées']] },
  { k: 'cure', e: '💧', t: 'Cure du béton', q: 'cure arrosage protection béton', rows: [['Durée', 'au moins 3 jours, souvent 7 j (plus par temps chaud / sec)'], ['Moyens', 'arrosage, toile humide, produit de cure, film'], ['Temps chaud', 'éviter le bétonnage aux heures chaudes, eau froide, cure immédiate']] },
  { k: 'vibr', e: '〰️', t: 'Mise en place / vibration', q: 'vibration hauteur de chute couches', rows: [['Hauteur de chute', 'limitée (souvent ≤ 1,5 m), sinon goulotte / trémie'], ['Couches', '≈ 30 à 50 cm'], ['Aiguille', 'verticale, pénétrer la couche inférieure, ne pas vibrer les armatures'], ['Reprise', 'surface repiquée et propre, humidifiée']] },
];
function clFiche(F, onSearch) {
  const s = sheet(`<div class="clf"><div class="clf-h"><span>${F.e}</span><b>${esc(F.t)}</b></div>
    <div class="clf-t">${F.rows.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>
    <div class="clf-w">Repères usuels de chantier : c'est le <b>CPS / CCTP du marché</b> qui fait foi.</div>
    <button class="btn" data-a="s" style="width:100%">${icon('search')} Voir ce que dit le CPS</button></div>`, { title: 'Fiche technique' });
  $('[data-a=s]', s.el).onclick = () => { s.close(); onSearch(F.q); };
}
