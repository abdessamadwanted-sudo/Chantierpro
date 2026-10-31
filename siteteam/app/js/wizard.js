// ================= Assistant de création de projet (Wizard) — v1.0.31 =================
// Type → fiche → caractéristiques → lots (modèle + suggestions expliquées) → zones → services → récapitulatif.
// « Créer maintenant » est possible dès la fiche : le reste se complète plus tard (Fiche projet, Organisation technique).
// Les suggestions sont des PROPOSITIONS internes à SiteTeam (pas une nomenclature officielle) ; l'utilisateur garde la main.
const Wizard = (() => {
  const TYPE_MODEL = { bat: 'immeuble', equip: 'stade', villa: 'villa', route: 'route', pont: 'pont', ga: 'pont', vrd: 'lotissement', indus: 'usine', hydro: 'reservoir' };
  const BUILD = ['bat', 'equip', 'villa', 'so', 'reno'];
  const ENV = [['petit', 'Petit'], ['moyen', 'Moyen'], ['grand', 'Grand'], ['complexe', 'Complexe']];
  // lot du catalogue dont le nom correspond (sinon rien : on ne propose jamais un lot qui n'existe pas)
  const findLot = (re) => { for (const f of (typeof CAT_FAMILIES !== 'undefined' ? CAT_FAMILIES : [])) { const l = f.lots.find(x => re.test(x)); if (l) return [f.id, l]; } return null; };
  // moteur de suggestion explicable : chaque lot proposé dit POURQUOI
  function suggest(st) {
    const c = st.carac, out = [], add = (re, why) => { const x = findLot(re); if (x && !out.some(o => o.k === x.join('|'))) out.push({ k: x.join('|'), fam: x[0], lot: x[1], why }); };
    if (+c.ss > 0) { add(/^Soutènements$/, `${c.ss} sous-sol(s)`); add(/Rabattement de nappe/, `${c.ss} sous-sol(s)`); add(/Étanchéité des parties enterrées/, `${c.ss} sous-sol(s)`); add(/^Désenfumage$/, 'sous-sol / parking couvert'); }
    if (+c.niv >= 4) { add(/^Ascenseurs$/, `R+${c.niv}`); add(/^Détection et alarme$/, `R+${c.niv}`); add(/^RIA$/, `R+${c.niv}`); }
    if (c.asc) add(/^Ascenseurs$/, 'ascenseurs prévus');
    if (c.parking) { add(/^Parkings$/, 'parking'); if (+c.ss > 0) add(/^Ventilation$/, 'parking en sous-sol'); }
    if (c.piscine) add(/Piscine/i, 'piscine');
    if (c.pontRoulant) add(/^Ponts roulants$/, 'pont roulant');
    if (st.env === 'grand' || st.env === 'complexe') { add(/Groupes électrogènes/, `envergure ${st.env}`); add(/^Contrôle d'accès$/, `envergure ${st.env}`); }
    return out;
  }
  function zonesOf(st) {
    const c = st.carac, blocs = String(c.blocs || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean), niv = [];
    if (BUILD.includes(st.type)) { for (let i = +c.ss || 0; i >= 1; i--) niv.push(`SS${i}`); niv.push('RDC'); for (let i = 1; i <= (+c.niv || 0); i++) niv.push(`R+${i}`); if ((+c.niv || 0) > 0) niv.push('Terrasse'); }
    if (!niv.length) return blocs.length ? blocs.map(b => `Bloc ${b}`) : [];
    return blocs.length ? blocs.flatMap(b => niv.map(n => `Bloc ${b} · ${n}`)) : niv;
  }
  async function open() {
    if (Team.ready() && !(await Team.checkLimit('projects'))) return;
    const ST0 = (typeof ST !== 'undefined' && ST.families) ? ST.families : [];
    const svcs = Team.ready() && !Team.isPerso() && Team.taille() !== 'petite' ? Team.companyServices().filter(x => x.k !== 'externe' && x.k !== 'perso') : [];
    const STEPS = ['Type', 'Fiche', 'Caractéristiques', 'Lots', 'Zones', ...(svcs.length ? ['Services'] : []), 'Récapitulatif'];
    const st = { i: 0, type: null, fiche: {}, carac: {}, env: 'moyen', lots: new Set(), sugg: [], model: null, zones: '', zonesTouched: false, services: new Set(svcs.map(x => x.k)), lotsInit: false };
    const s = sheet('<div class="wz"></div>', {}); s.el.classList.add('wz-sheet');
    const W = $('.wz', s.el), T = () => projTypeOf(st.type) || PROJ_TYPES[0];
    const read = () => { $$('[data-fi]', W).forEach(x => { st.fiche[x.dataset.fi] = x.value.trim(); }); $$('[data-ca]', W).forEach(x => { st.carac[x.dataset.ca] = x.type === 'checkbox' ? x.checked : x.value.trim(); });
      const z = $('[data-zones]', W); if (z) { st.zones = z.value; st.zonesTouched = true; } };
    const head = () => `<div class="wz-h"><button class="iconbtn" data-a="wzback">${icon(st.i ? 'back' : 'close')}</button><div class="grow"><small>Nouveau projet · étape ${st.i + 1}/${STEPS.length}</small><b>${esc(STEPS[st.i])}</b></div></div>
      <div class="wz-bar">${STEPS.map((x, i) => `<i class="${i < st.i ? 'd' : i === st.i ? 'on' : ''}"></i>`).join('')}</div>`;
    const foot = (next = 'Continuer ›', quick) => `<div class="wz-f">${quick ? '<button class="btn ghost" data-a="ok">Créer maintenant</button>' : ''}<button class="btn" data-a="next">${next}</button></div>`;
    function draw() {
      const k = STEPS[st.i]; let body = '';
      if (k === 'Type') body = `<div class="st-types">${ST0.map(F => `<button data-f="${F.k}" style="--c:${F.c}"><span class="e">${F.e}</span><b>${esc(F.l)}</b><small>${esc(F.d)}</small></button>`).join('')}</div>`;
      if (k === 'Fiche') body = `<div class="wz-chip">${T().e} ${esc(T().n)}</div><div class="form">
        <label>Nom du projet *<input name="name" data-fi="name" value="${esc(st.fiche.name || '')}" placeholder="Ex : Grand stade Hassan II Benslimane"></label>
        <label>Code / référence<input data-fi="code" value="${esc(st.fiche.code || '')}" placeholder="Ex : GS-2026-01"></label>
        <label>Lieu / ville<input data-fi="address" value="${esc(st.fiche.address || '')}"></label>
        <label>Maître d'ouvrage (MOA)<input name="moa" data-fi="moa" value="${esc(st.fiche.moa || '')}"></label>
        <div class="wz-2"><label>Date de début<input type="date" data-fi="debut" value="${esc(st.fiche.debut || '')}"></label><label>Durée (mois)<input type="number" min="0" data-fi="duree" value="${esc(st.fiche.duree || '')}"></label></div></div>${foot('Continuer ›', true)}`;
      if (k === 'Caractéristiques') { const c = st.carac, b = BUILD.includes(st.type);
        body = `<div class="fld">Envergure</div><div class="wz-seg">${ENV.map(([v, l]) => `<button data-env="${v}" class="${st.env === v ? 'on' : ''}">${l}</button>`).join('')}</div><div class="form">
          ${b ? `<div class="wz-2"><label>Niveaux au-dessus du RDC (R+…)<input type="number" min="0" data-ca="niv" value="${esc(c.niv || '')}" placeholder="Ex : 6"></label><label>Sous-sols<input type="number" min="0" data-ca="ss" value="${esc(c.ss || '')}" placeholder="0"></label></div>
            <label>Blocs (séparés par des virgules)<input data-ca="blocs" value="${esc(c.blocs || '')}" placeholder="Ex : A, B, C"></label>
            <label>Surface construite (m²)<input type="number" min="0" data-ca="surface" value="${esc(c.surface || '')}"></label>
            <div class="wz-cks"><label class="tm-ck"><input type="checkbox" data-ca="parking" ${c.parking ? 'checked' : ''}> Parking</label><label class="tm-ck"><input type="checkbox" data-ca="asc" ${c.asc ? 'checked' : ''}> Ascenseurs</label><label class="tm-ck"><input type="checkbox" data-ca="piscine" ${c.piscine ? 'checked' : ''}> Piscine</label></div>`
          : ['route', 'vrd', 'pont', 'ga'].includes(st.type) ? `<label>Longueur / linéaire (m)<input type="number" min="0" data-ca="longueur" value="${esc(c.longueur || '')}"></label><label>Sections / tronçons (séparés par des virgules)<input data-ca="blocs" value="${esc(c.blocs || '')}" placeholder="Ex : PK0-PK5, PK5-PK10"></label>`
          : st.type === 'indus' ? `<label>Surface (m²)<input type="number" min="0" data-ca="surface" value="${esc(c.surface || '')}"></label><label>Blocs / halls<input data-ca="blocs" value="${esc(c.blocs || '')}" placeholder="Ex : Hall 1, Hall 2"></label><label class="tm-ck"><input type="checkbox" data-ca="pontRoulant" ${c.pontRoulant ? 'checked' : ''}> Pont roulant</label>`
          : `<label>Capacité / surface<input data-ca="surface" value="${esc(c.surface || '')}"></label><label>Zones / ouvrages (séparés par des virgules)<input data-ca="blocs" value="${esc(c.blocs || '')}"></label>`}</div>
          <small class="muted">Ces informations servent à proposer des lots et des zones. Tout reste modifiable.</small>${foot()}`; }
      if (k === 'Lots') {
        if (!st.lotsInit) { st.lotsInit = true; st.model = TYPE_MODEL[st.type] || null; if (st.model && CAT_MODELS[st.model]) CAT_MODELS[st.model].forEach(([f, l]) => st.lots.add(f + '|' + l)); }
        st.sugg = suggest(st); st.sugg.forEach(x => { if (!st.sugDone) st.lots.add(x.k); }); st.sugDone = true;
        body = `<div class="fld">Modèle de départ</div><div class="wz-models">${Object.keys(CAT_MODELS).map(m => `<button data-model="${m}" class="${st.model === m ? 'on' : ''}">${esc(CAT_MODEL_LABELS[m] || m)}</button>`).join('')}</div>
          ${st.sugg.length ? `<div class="wz-sug"><b>✨ Suggestions selon vos caractéristiques</b>${st.sugg.map(x => `<label class="tm-ck"><input type="checkbox" data-lot="${esc(x.k)}" ${st.lots.has(x.k) ? 'checked' : ''}> ${esc(x.lot)} <small>— ${esc(x.why)}</small></label>`).join('')}</div>` : ''}
          ${CAT_FAMILIES.map(f => { const n = f.lots.filter(l => st.lots.has(f.id + '|' + l)).length;
            return `<details class="cat-fam"${n ? ' open' : ''}><summary>${esc(f.l)}${n ? ` <b>(${n})</b>` : ''}</summary><div class="cat-lots">${f.lots.map(l => `<label class="cat-ck"><input type="checkbox" data-lot="${esc(f.id + '|' + l)}" ${st.lots.has(f.id + '|' + l) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></details>`; }).join('')}
          <small class="muted">Proposition interne SiteTeam, à adapter à votre marché (pas une nomenclature officielle).</small>${foot(`Continuer · ${st.lots.size} lot(s) ›`)}`; }
      if (k === 'Zones') { if (!st.zonesTouched) st.zones = zonesOf(st).join('\n');
        body = `<div class="form"><label>Zones / blocs / niveaux (une par ligne)<textarea data-zones style="min-height:220px" placeholder="Ex : Bloc A · RDC">${esc(st.zones)}</textarea></label></div>
          <small class="muted">Générées depuis vos caractéristiques (sous-sols, niveaux, blocs). Organisation spatiale : séparée des lots (organisation technique).</small>${foot()}`; }
      if (k === 'Services') body = `<div class="muted" style="margin-bottom:8px">Services actifs sur ce projet</div><div class="wz-cks">${svcs.map(x => `<label class="tm-ck"><input type="checkbox" data-svc="${x.k}" ${st.services.has(x.k) ? 'checked' : ''}> ${esc(x.e || '')} ${esc(x.l)}</label>`).join('')}</div>${foot()}`;
      if (k === 'Récapitulatif') { const z = st.zones.split('\n').map(x => x.trim()).filter(Boolean);
        body = `<div class="wz-rec">
          <div><span>Type</span><b>${T().e} ${esc(T().n)}</b></div><div><span>Projet</span><b>${esc(st.fiche.name || '—')}${st.fiche.code ? ' · ' + esc(st.fiche.code) : ''}</b></div>
          <div><span>Lieu · MOA</span><b>${esc([st.fiche.address, st.fiche.moa].filter(Boolean).join(' · ') || '—')}</b></div>
          <div><span>Envergure</span><b>${esc((ENV.find(e => e[0] === st.env) || [])[1] || '')}</b></div>
          <div><span>Lots</span><b>${st.lots.size}</b></div><div><span>Zones</span><b>${z.length}</b></div>${svcs.length ? `<div><span>Services</span><b>${st.services.size}</b></div>` : ''}</div>${foot('✓ Créer le projet')}`; }
      W.innerHTML = head() + `<div class="wz-b">${body}</div>`;
      bind();
    }
    function bind() {
      $('[data-a=wzback]', W).onclick = () => { read(); if (st.i) { st.i--; draw(); } else s.close(); };
      $$('[data-f]', W).forEach(b => b.onclick = async () => { const F = ST0.find(x => x.k === b.dataset.f); let t = F.types[0];
        if (F.types.length > 1) { t = await menu(F.l, F.types.map(k => projTypeOf(k)).filter(Boolean).map(X => ({ label: `${X.e} ${X.n}`, value: X.k }))); if (!t) return; }
        if (st.type !== t) { st.type = t; st.lotsInit = false; st.sugDone = false; st.lots = new Set(); st.zonesTouched = false; } st.i = 1; draw(); });
      $$('[data-env]', W).forEach(b => b.onclick = () => { read(); st.env = b.dataset.env; draw(); });
      $$('[data-model]', W).forEach(b => b.onclick = () => { st.model = b.dataset.model; (CAT_MODELS[st.model] || []).forEach(([f, l]) => st.lots.add(f + '|' + l)); draw(); });
      $$('[data-lot]', W).forEach(c => c.onchange = () => { c.checked ? st.lots.add(c.dataset.lot) : st.lots.delete(c.dataset.lot); const n = $('[data-a=next]', W); if (n) n.textContent = `Continuer · ${st.lots.size} lot(s) ›`; });
      $$('[data-svc]', W).forEach(c => c.onchange = () => { c.checked ? st.services.add(c.dataset.svc) : st.services.delete(c.dataset.svc); });
      const nx = $('[data-a=next]', W); if (nx) nx.onclick = () => { read();
        if (STEPS[st.i] === 'Fiche' && !st.fiche.name) return toast('Le nom du projet est obligatoire');
        if (STEPS[st.i] === 'Caractéristiques') st.sugDone = false;   // nouvelles caractéristiques → nouvelles suggestions cochées
        if (st.i === STEPS.length - 1) return create(); st.i++; draw(); };
      const ok = $('[data-a=ok]', W); if (ok) ok.onclick = () => { read(); if (!st.fiche.name) return toast('Le nom du projet est obligatoire'); create(true); };
    }
    async function create(quick) {
      const X = T();
      if (quick && !st.lotsInit) { const m = TYPE_MODEL[st.type]; if (m && CAT_MODELS[m]) CAT_MODELS[m].forEach(([f, l]) => st.lots.add(f + '|' + l)); }
      const zones = (st.zonesTouched ? st.zones : zonesOf(st).join('\n')).split('\n').map(x => x.trim()).filter(Boolean);
      const p = await DB.put('projects', { name: st.fiche.name, code: st.fiche.code || '', address: st.fiche.address || '', moa: st.fiche.moa || '', dateDebut: st.fiche.debut || '', dureeMois: +st.fiche.duree || null,
        type: X.k, featOff: Object.fromEntries(X.off.map(k => [k, true])), team: [], envergure: st.env, carac: st.carac, catLots: [...st.lots].map(k => k.split('|')),
        zones: zones.join('\n'), ...(svcs.length ? { services: [...st.services] } : {}), wizard: 1 });
      if (Team.ready() && Team.noteProject) Team.noteProject(p);
      s.onClose = null; s.close(); toast('Projet créé ✓'); openProject(p);
    }
    draw();
  }
  return { open, suggest, zonesOf };
})();
window.newProjectDialog = () => Wizard.open();
