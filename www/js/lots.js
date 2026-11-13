// ================= Lots dans les dossiers de niveau (Plans) =================
// Barre de lots colorés au-dessus des plans d'un niveau ; chaque lot a ses plans, ses raccourcis et sa check-list,
// la même pour tous les niveaux (on ajoute un point une fois → il apparaît partout).
const LOTS_DEF = [
  { id: 'go', name: 'Gros œuvre', e: '🏗️', c: '#f59e0b' }, { id: 'mac', name: 'Maçonnerie', e: '🧱', c: '#ef4444' },
  { id: 'chape', name: 'Chape', e: '🪣', c: '#a855f7' }, { id: 'enduit', name: 'Enduit', e: '🎨', c: '#06b6d4' },
  { id: 'etan', name: 'Étanchéité', e: '💧', c: '#3b82f6' }, { id: 'elec', name: 'Électricité', e: '⚡', c: '#eab308' },
  { id: 'plomb', name: 'Plomberie', e: '🚿', c: '#14b8a6' }, { id: 'menu', name: 'Menuiserie', e: '🚪', c: '#b45309' },
  { id: 'peint', name: 'Peinture', e: '🖌️', c: '#ec4899' }, { id: 'carr', name: 'Carrelage', e: '🔲', c: '#64748b' },
];
const LOT_GO_POINTS = ['Plans de coffrage au dernier indice', 'Plans de ferraillage au dernier indice', 'Réception ferraillage faite', 'PV de réception signé', 'Bon de bétonnage validé', 'Décoffrage / étaiement contrôlé'];
// points d'arrêt (🛑 la suite attend la levée) et points critiques (⚠️ à surveiller), modèles par lot
const PA_TPL = {
  go: [['a', 'Réception du ferraillage avant bétonnage'], ['a', 'Implantation / axes vérifiés (topo)'], ['a', 'Réception du fond de fouille'], ['c', 'Enrobage et cales en place'], ['c', 'Réservations et attentes'], ['c', 'Éprouvettes prélevées']],
  mac: [['a', 'Implantation des cloisons validée'], ['c', 'Chaînages et raidisseurs'], ['c', 'Linteaux et appuis']],
  chape: [['a', 'Support propre et réseaux sous chape réceptionnés'], ['c', 'Niveaux / trait de niveau'], ['c', 'Joints de fractionnement']],
  enduit: [['a', 'Réseaux encastrés réceptionnés'], ['c', 'Grillage aux jonctions béton / agglos'], ['c', 'Planéité (règle 2 m)']],
  etan: [['a', 'Réception du support (pente, propreté)'], ['a', 'Essai d\'étanchéité (mise en eau 48 h)'], ['c', 'Relevés et engravures']],
  elec: [['a', 'Réception des fourreaux avant coulage / enduit'], ['c', 'Essais de continuité / isolement'], ['c', 'Mise à la terre']],
  plomb: [['a', 'Essai de pression avant fermeture'], ['c', 'Pentes des évacuations'], ['c', 'Fourreaux en traversée']],
  menu: [['a', 'Validation des échantillons / fiches techniques'], ['c', 'Aplomb et calage'], ['c', 'Jeu de fonctionnement']],
  peint: [['a', 'Support sec et enduit réceptionné'], ['a', 'Validation de la teinte (échantillon)'], ['c', 'Couche d\'impression appliquée'], ['c', 'Aspect final (lumière rasante)']],
  carr: [['a', 'Validation du calepinage et des échantillons'], ['c', 'Planéité et pente du support'], ['c', 'Joints et plinthes']],
};
const PA_BY = ['Maître d\'ouvrage', 'BET', 'Bureau de contrôle', 'Laboratoire', 'Topographe', 'Entreprise', 'Architecte'];
const dueDays = (iso) => Math.round((new Date(iso + 'T12:00:00') - new Date(todayISO() + 'T12:00:00')) / 864e5);
const dueTxt = (d) => d < 0 ? `Retard ${-d} j` : d === 0 ? 'Aujourd\'hui' : `J-${d}`;
// v1.0.65 : plusieurs échéances / alertes par lot et niveau (objet, type, zone) — la plus urgente non faite donne le badge
const lotZonesList = (p) => [...new Set([...(typeof avZones === 'function' ? avZones(p) : []), ...String(p.zones || '').split('\n').map(x => x.trim()).filter(Boolean)])];
const LOT_AL_TYPES = ['Échéance MO', 'Réception', 'Livraison', 'Point d\'arrêt', 'Essai / labo', 'Plan à recevoir', 'Rappel'];
const lotAlerts = (D) => { if (!D) return []; const A = (D._al || []).filter(a => a.d).map(a => ({ ...a, main: false })); if (D._due) A.unshift({ id: '_main', d: D._due, obj: D._dueObj || '', type: 'Échéance ' + (D._dueBy || 'MO'), by: D._dueBy || 'MO', zone: D._dueZone || '', done: !!D._dueDone, main: true }); return A; };
const dueInfo = (D) => { const A = lotAlerts(D).filter(a => !a.done).sort((a, b) => a.d.localeCompare(b.d)); if (!A.length) return null; const a = A[0], d = dueDays(a.d); return { d, a, n: A.length, cls: d < 0 ? 'late' : d <= 7 ? 'soon' : 'ok', txt: dueTxt(d) }; };
const paOpen = (L, D) => (L.pa || []).filter(x => x.k === 'a' && ((D.pa || {})[x.id] || {}).st !== 'ok');
const lotStarted = (L, D) => !!(D._due || D._start || Object.keys(D).some(k => !k.startsWith('_') && k !== 'pa' && (D[k] || {}).done) || Object.values(D.pa || {}).some(v => v.st));
// catalogue : les lots connus sont rangés dans leur type (une fois) ; Revêtements et Faux plafonds ajoutés
const LOT_CAT_SEED = { go: 'STR', mac: 'STR', chape: 'CEA', enduit: 'CEA', etan: 'ETA', elec: 'CFO', plomb: 'PLB', menu: 'CEA', peint: 'CEA', carr: 'CEA' };
const LOTS_NEW = [{ id: 'rev', name: 'Revêtements', e: '🧩', c: '#0891b2', cat: 'CEA' }, { id: 'faplaf', name: 'Faux plafonds', e: '⬜', c: '#7c3aed', cat: 'CEA' }];
function planLots(p) {
  if (!p.planLots) p.planLots = LOTS_DEF.map(l => ({ ...l, points: l.id === 'go' ? LOT_GO_POINTS.map(t => ({ id: DB.uid(), t })) : [] }));
  if (!p.catV) { p.catV = 1;
    for (const l of p.planLots) if (!l.cat && LOT_CAT_SEED[l.id]) l.cat = LOT_CAT_SEED[l.id];
    for (const n of LOTS_NEW) if (!p.planLots.some(l => l.id === n.id)) p.planLots.push({ ...n, points: [] });
    if (p.id) { try { DB.put('projects', p); } catch (e) {} } }
  return p.planLots;
}
// sous-lots : un lot avec up = id du lot parent (mêmes plans, points et couleurs que n'importe quel lot)
const lotIdsWithKids = (p, id) => [id, ...planLots(p).filter(l => l.up === id).map(l => l.id)];
const SOUS_LOTS_TPL = { peint: ['Impression', 'Finition', 'Enduit décoratif'], rev: ['Carrelage', 'Marbre / pierre', 'Parquet', 'Résine'], faplaf: ['Plâtre (BA13)', 'Dalles modulaires', 'Bois / métal'], carr: ['Carrelage sol', 'Faïence murale', 'Plinthes'], go: ['Coffrage', 'Ferraillage', 'Bétonnage'] };
const tplOfLot = (L) => SOUS_LOTS_TPL[L.id] || (/peint/i.test(L.name) ? SOUS_LOTS_TPL.peint : /rev[eê]t/i.test(L.name) ? SOUS_LOTS_TPL.rev : /faux.?plaf/i.test(L.name) ? SOUS_LOTS_TPL.faplaf : []);
// classement automatique d'après le nom du plan (à confirmer par l'utilisateur)
const AUTO_LOT = [[/coffrage|ferraill|b[ée]ton|\bGO\b|fondation/i, 'go'], [/ma[cç]onn|cloison|agglo/i, 'mac'], [/chape/i, 'chape'], [/enduit/i, 'enduit'], [/[ée]tanch/i, 'etan'], [/\bCFO\b|\bCFA\b|[ée]lectr/i, 'elec'], [/plomb|\bPLB\b|sanitaire/i, 'plomb'], [/menuis/i, 'menu'], [/peint/i, 'peint'], [/carrel|faïence|faience/i, 'carr'], [/rev[eê]tement/i, 'rev'], [/faux.?plaf/i, 'faplaf']];
const autoLotOf = (p, name) => { const hit = AUTO_LOT.find(([re]) => re.test(String(name || ''))); if (!hit) return null; const L = planLots(p).find(l => l.id === hit[1]); return L || null; };
const lotSelOf = (fid) => (App.lotSel || {})[fid] || '';
// v1.0.50 : plus de « Tous » — un lot est toujours choisi (le 1er qui a des plans) ; « Sans lot » seulement s'il reste des plans sans lot
function lotSelDefault(f, ps) {
  App.lotSel = App.lotSel || {}; const cur = App.lotSel[f.id], lots = planLots(App.project);
  const hT = (f.hiddenTypes || []), hL = (f.hiddenLots || []), LV = lots.filter(l => !hL.includes(l.id) && onlyHere(l, f));
  if (cur && (cur === '__all' || (typeof cur === 'string' && cur.startsWith('T:') && !hT.includes(cur.slice(2))) || (cur === '__none' ? ps.some(x => !x.lotId) : LV.some(l => l.id === cur)))) return cur;   // v1.0.98 : « Tous les lots »
  const d = '__all';   // v1.0.107 : par défaut, tous les plans du niveau
  App.lotSel[f.id] = d; return d;
}
const nivOfFolder = (name) => { const m = String(name || '').replace(/_/g, ' ').replace(/niveau|niv\.?(?=\s*[rR\d])/gi, ' ').match(/\b(R\s?\+\s?\d+|RDC|SSL|SS\s?\d?|Mezz\w*|Terrasse|Fondations?)\b/i); return m ? m[1].replace(/\s+/g, '').replace(/^mezz\w*/i, 'Mezz') : ''; };
// v1.0.97 : disciplines d'un niveau (plans d'exécution)
const DISCIPLINES = [
  { k: 'ARCH', l: 'Architecture (ARCH)' }, { k: 'STR', l: 'Structure / béton armé (STR)' }, { k: 'VRD', l: 'VRD' },
  { k: 'CFO', l: 'Électricité CFO' }, { k: 'CFA', l: 'Électricité CFA' }, { k: 'PLB', l: 'Plomberie / sanitaire (PLB)' },
  { k: 'CVC', l: 'CVC' }, { k: 'SSI', l: 'Sécurité incendie (SSI)' }, { k: 'CM', l: 'Charpente métallique (CM)' },
  { k: 'ETA', l: 'Étanchéité (ETA)' }, { k: 'PAY', l: 'Aménagement / paysage (PAY)' }, { k: 'SYN', l: 'Synthèse (SYN)' },
  { k: 'FND', l: 'Fondations (FND)' }, { k: 'CEA', l: 'Corps d\'état architecturaux (CEA)' }, { k: 'GTB', l: 'GTB / GTC (GTB)' },
];
// Familles (menus déroulants) : chaque type de plan est rangé dans une famille ; on peut le déplacer (p.typeFam) et renommer (p.typeNames, p.famNames)
const FAMILLES = [
  { k: 'gros', l: 'Gros œuvre & Structure', t: ['STR', 'FND', 'CM'] }, { k: 'archi', l: 'Corps d\'état architecturaux', t: ['ARCH', 'CEA', 'ETA'] },
  { k: 'elec', l: 'Électricité', t: ['CFO', 'CFA'] }, { k: 'fluides', l: 'Fluides', t: ['PLB', 'CVC'] },
  { k: 'vrd', l: 'VRD & Extérieurs', t: ['VRD', 'PAY'] }, { k: 'secu', l: 'Sécurité & Systèmes', t: ['SSI', 'GTB'] },
  { k: 'syn', l: 'Synthèse & Coordination', t: ['SYN'] }, { k: 'autre', l: 'Autres', t: [] },
];
const famsOf = (p) => FAMILLES.map(f => ({ ...f, l: ((p && p.famNames) || {})[f.k] || f.l }));
const famOfType = (p, k) => ((p && p.typeFam) || {})[k] || (FAMILLES.find(f => f.t.includes(k)) || { k: 'autre' }).k;
// Fondations : proposées par défaut dans le niveau SSL seulement ; on peut les ajouter ailleurs (f.extraTypes)
// visible dans ce niveau ? un type / lot / point / rubrique créé dans un niveau n'apparaît que là (x.only = ids de dossiers) ; absent = partout
const onlyHere = (x, f) => !x || !x.only || !f || x.only.includes(f.id);
const typeShownIn = (f, t) => onlyHere(t, f) && (t.k !== 'FND' || !f || (typeof nivOfFolder === 'function' && nivOfFolder(f.name) === 'SSL') || (f.extraTypes || []).includes('FND'));
// v1.0.101 : types de lots = types fixes + types ajoutés par le projet (p.lotTypes)
const typesOf = (p) => [...DISCIPLINES, ...((p && p.lotTypes) || [])].filter(d => !((p && p.typesGone) || []).includes(d.k)).map(d => ({ ...d, l: ((p && p.typeNames) || {})[d.k] || d.l }));
// abréviation d'un type (CFO, CVC, STR…) : la clé pour les types fixes, sinon les initiales du nom
const typeName = (l) => String(l || '').replace(/\s*\([A-Za-z]{2,5}\)\s*$/, '');
const abbrOf = (l) => { const w = typeName(l).split(/[\s\/&,'’\-]+/).filter(x => x.length > 2); if (!w.length) return String(l || '').slice(0, 3).toUpperCase(); return (w.length === 1 ? w[0].slice(0, 4) : w.slice(0, 4).map(x => x[0]).join('')).toUpperCase(); };
const typeAbOf = (k, p) => { const t = typesOf(p || App.project).find(d => d.k === k); if (!t) return ''; return DISCIPLINES.some(d => d.k === k) ? k : (t.ab || abbrOf(t.l)); };
const typeLab = (k, p) => (typesOf(p || App.project).find(d => d.k === k) || { l: k }).l;
const discLabel = (f) => !f || !f.disc ? '' : f.disc === '_free' ? (f.discName || 'Autre') : ((DISCIPLINES.find(d => d.k === f.disc) || {}).l || f.disc);
const tint = (c, a) => c + Math.round(a * 255).toString(16).padStart(2, '0');

// v1.0.108 : barre = une boîte fixe « type » (liste dessous) + la rangée des lots de ce type ; masquage par niveau
const hiddenT = (f) => (f && f.hiddenTypes) || [];
const hiddenL = (f) => (f && f.hiddenLots) || [];
const typesVis = (f, p) => typesOf(p || App.project).filter(t => !hiddenT(f).includes(t.k) && typeShownIn(f, t));
const lotsVis = (f, lots) => lots.filter(l => !hiddenL(f).includes(l.id) && onlyHere(l, f));
// type courant : clé de type (ou '' si un lot sans type, ou '__all')
const selTypeKey = (sel, lots) => sel && sel.startsWith('T:') ? sel.slice(2) : (sel && sel !== '__all' && sel !== '__none') ? ((lots.find(l => l.id === sel) || {}).cat || '') : '';

// barre de lots + panneau du lot choisi, insérés dans la carte du dossier
function lotBarInto(card, f, ps, root) {
  const p = App.project, allLots = planLots(p), lots = lotsVis(f, allLots), sel = lotSelDefault(f, ps);
  const cnt = (id) => { const set = lotIdsWithKids(p, id); return ps.filter(x => set.includes(x.lotId)).length; }, nNo = ps.filter(x => !x.lotId).length;
  const focus = sel === '__all' ? ((App.lotF || {})[f.id] || '') : (sel !== '__none' && !sel.startsWith('T:') ? sel : '');
  const focusL = lots.find(x => x.id === focus) || null, focusTop = focusL ? (focusL.up || focusL.id) : '';
  const avB = (L) => { try { return typeof avLotBadge === 'function' && App._avLinks ? avLotBadge(p, L, f, App._avLinks) : ''; } catch (e) { return ''; } };
  const bar = document.createElement('div'); bar.className = 'lot-bar lot-bar2';
  const tk = selTypeKey(sel, lots);
  const nOfType = (k) => ps.filter(x => { const L = lots.find(l => l.id === x.lotId); return L && (L.cat || '') === k; }).length;
  const where = sel === '__all' ? '📚 Tous les types (TOUT)' : sel === '__none' ? '📄 Sans lot' : tk ? typeAbOf(tk, p) + ' · ' + typeName(typeLab(tk, p)) : 'Sans type';
  const cntTop = sel === '__all' ? ps.length : sel === '__none' ? nNo : sel.startsWith('T:') ? nOfType(tk) : cnt(sel);
  // boîte fixe : ouvre / ferme la liste des types dessous
  const box = document.createElement('button'); box.type = 'button'; box.className = 'lot-tbox';
  box.innerHTML = `<span>▾ ${esc(where)}</span><small>${cntTop}</small>`;
  bar.appendChild(box);
  // rangée des lots du type choisi (ou de tous les lots pour TOUT)
  const chipOf = (l, on, sub) => { const D = (f.lotData || {})[l.id] || {}, di = dueInfo(D), po = lotStarted(l, D) ? paOpen(l, D).length : 0;
    return `<button type="button" class="lot-c ${on ? 'on' : ''} ${sub ? 'sub' : ''}" data-lp="${l.id}" style="--c:${l.c};--t:${tint(l.c, .16)}">${sub ? '↳ ' : l.e + ' '}${esc(l.name)}${cnt(l.id) ? ` <small>${cnt(l.id)}</small>` : ''}${po ? `<i class="lc-pa">🛑${po}</i>` : ''}${di && di.cls !== 'ok' ? `<i class="lc-due ${di.cls}">⏳</i>` : ''}${avB(l)}${sel === '__all' && on ? `<i class="lc-open" data-open="${l.id}" title="Ouvrir le lot">⤢</i>` : ''}</button>`; };
  const kidsOf = (L) => lots.filter(x => x.up === L.id);
  const topOf = (arr) => arr.filter(l => !l.up || !lots.some(z => z.id === l.up));
  // une rangée : lots du niveau ; sous-lots du lot « en vue » juste après lui
  const rowOf = (arr) => topOf(arr).map(l => chipOf(l, focus === l.id || (sel !== '__all' && sel === l.id)) + (l.id === focusTop ? kidsOf(l).map(k => chipOf(k, focus === k.id, true)).join('') + `<button type="button" class="lot-c add sub" data-lp="__addsub">＋ Sous-lot</button>` : '')).join('');
  const inType = sel === '__all' ? lots : lots.filter(l => (l.cat || '') === tk);
  const chips = document.createElement('div'); chips.className = 'lot-chips';
  if (sel !== '__none' && sel !== '__all') chips.innerHTML = `<button type="button" class="lot-c ${sel.startsWith('T:') ? 'on' : ''}" data-lp="${tk ? 'T:' + tk : '__all'}" style="--c:#334155">📚 Tous</button>` + rowOf(inType) + `<button type="button" class="lot-c add" data-lp="__add">＋ Lot</button>`;
  // TOUT : tous les lots et sous-lots restent visibles ; toucher un lot filtre les plans sans quitter TOUT (⤢ = ouvrir le lot)
  if (sel === '__all') chips.innerHTML = `<button type="button" class="lot-c ${focus ? '' : 'on'}" data-lp="__f0" style="--c:#334155">📚 Tous</button>` + rowOf(lots) + (nNo ? `<button type="button" class="lot-c" data-lp="__none" style="--c:#64748b">📄 Sans lot <small>${nNo}</small></button>` : '');
  if (sel === '__none') chips.innerHTML = `<button type="button" class="lot-c on" data-lp="__none" style="--c:#64748b">📄 Sans lot <small>${nNo}</small></button>`;
  bar.appendChild(chips);
  // liste des types (sous la boîte), fermée par défaut
  const pickBtn = box;
  pickBtn.onclick = (e) => { e.stopPropagation(); const old = $('.lot-pick', card); if (old) { old.remove(); return; }
    const list = document.createElement('div'); list.className = 'lot-pick';
    const draw = () => {
      const opt = (v, lab, n, cls = '') => `<button type="button" class="lp-type ${cls} ${sel === v || (v.startsWith('T:') && tk === v.slice(2) && sel.startsWith('T:')) ? 'on' : ''}" data-lp="${v}"><span>${lab}</span><small>${n}</small></button>`;
      App.famOpen = App.famOpen || {}; const fo = App.famOpen[f.id] = App.famOpen[f.id] || {}; const curFam = tk ? famOfType(p, tk) : ''; if (curFam && fo[curFam] === undefined) fo[curFam] = true;
      const TV = typesVis(f, p), famHtml = famsOf(p).map(F => { const ts = TV.filter(t => famOfType(p, t.k) === F.k); if (!ts.length) return '';
        const n = ts.reduce((a, t) => a + nOfType(t.k), 0), open = !!fo[F.k];
        return `<button type="button" class="lp-fam ${open ? 'open' : ''}" data-fam="${F.k}"><span class="lp-fn">📁 ${esc(F.l)}</span><small>${n}</small><i>${open ? '▴' : '▾'}</i></button>`
          + (open ? `<div class="lp-fbody">${ts.map(t => opt('T:' + t.k, `<b class="lp-ab">${esc(typeAbOf(t.k, p))}</b> ${esc(typeName(t.l))}`, nOfType(t.k))).join('')}</div>` : ''); }).join('');
      const addFnd = !typeShownIn(f, { k: 'FND' }) ? `<button type="button" class="lp-i add" data-lp="__addfnd">＋ Fondations ici</button>` : '';
      list.innerHTML = opt('__all', '📚 Tous les types (TOUT)', ps.length, 'all') + famHtml
        + (nNo ? opt('__none', '📄 Sans lot', nNo) : '')
        + `<div class="lp-foot"><button type="button" class="lp-i add" data-lp="__addtype">＋ Nouveau type</button>${addFnd}${nNo ? `<button type="button" class="lp-i add" data-lp="__auto">✨ Classer automatiquement (${nNo})</button>` : ''}${hiddenT(f).length || hiddenL(f).length ? `<button type="button" class="lp-i add" data-lp="__restore">↺ Rétablir masqués</button>` : ''}</div>`;
      list.querySelectorAll('[data-fam]').forEach(h => {
        h.onclick = (e) => { e.stopPropagation(); fo[h.dataset.fam] = !fo[h.dataset.fam]; draw(); };
        h.oncontextmenu = async (e) => { e.preventDefault(); e.stopPropagation(); const F = famsOf(p).find(z => z.k === h.dataset.fam); if (!F) return;
          const r = await formSheet('Renommer la famille', [{ name: 'n', label: 'Nom', value: F.l }]); if (!r || !r.n) return;
          p.famNames = { ...(p.famNames || {}), [F.k]: r.n }; await DB.put('projects', p); renderPlans(root); };
      });
      list.querySelectorAll('[data-lp]').forEach(x => {
        x.onclick = async (e) => { e.stopPropagation();
          if (x.dataset.lp === '__addtype') { const r = await formSheet('Nouveau type (ce niveau seulement)', [{ name: 'n', label: 'Nom du type', placeholder: 'Ex : Second œuvre' }], { okLabel: 'Ajouter' }); if (!r || !r.n) return;
            p.lotTypes = p.lotTypes || []; p.lotTypes.push({ k: 'T' + DB.uid(), l: r.n, only: [f.id] }); await DB.put('projects', p); App.lotSel[f.id] = 'T:' + p.lotTypes[p.lotTypes.length - 1].k; renderPlans(root); return; }
          if (x.dataset.lp === '__auto') { await autoClassify(ps, f, root); return; }
          if (x.dataset.lp === '__addfnd') { f.extraTypes = [...(f.extraTypes || []), 'FND']; await DB.put('folders', f); App.lotSel[f.id] = 'T:FND'; renderPlans(root); return; }
          if (x.dataset.lp === '__restore') { await restoreHiddenAll(p); renderPlans(root); return; }
          App.lotSel = App.lotSel || {}; App.lotSel[f.id] = x.dataset.lp; App.keepScrollY = ($('#content') || {}).scrollTop || 0; renderPlans(root);
        };
        // appui long (menu contextuel) sur un type : le retirer de ce niveau seulement
        if (x.dataset.lp.startsWith('T:')) x.oncontextmenu = async (e) => { e.preventDefault(); e.stopPropagation();
          const k = x.dataset.lp.slice(2), t = typesOf(p).find(d => d.k === k) || { l: k };
          const v = await menu(t.l, [{ label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Déplacer vers une autre famille', icon: 'layers', value: 'fam' }, { label: 'Fusionner avec un autre type…', icon: 'layers', value: 'merge' }, ...((p.lotTypes || []).some(d => d.k === k) ? [{ label: 'Visible dans quels niveaux…', icon: 'eye', value: 'lvl' }] : []), { label: 'Masquer dans ce niveau', icon: 'eye', value: 'hide' }, { label: 'Supprimer définitivement ce type', icon: 'trash', danger: true, value: 'del' }]);
          if (v === 'ren') { const r = await formSheet('Renommer le type', [{ name: 'n', label: 'Nom', value: t.l }]); if (!r || !r.n) return; p.typeNames = { ...(p.typeNames || {}), [k]: r.n }; await DB.put('projects', p); renderPlans(root); return; }
          if (v === 'fam') { const cur = famOfType(p, k), g = await menu('Déplacer « ' + t.l + ' » vers', famsOf(p).map(F => ({ label: F.l, value: F.k, checked: F.k === cur }))); if (!g) return; p.typeFam = { ...(p.typeFam || {}), [k]: g }; if (!App.famOpen) App.famOpen = {}; (App.famOpen[f.id] = App.famOpen[f.id] || {})[g] = true; await DB.put('projects', p); renderPlans(root); return; }
          if (v === 'merge') { const g = await menu('Fusionner « ' + t.l + ' » dans', typesOf(p).filter(d => d.k !== k).map(d => ({ label: `${typeAbOf(d.k, p)} · ${typeName(d.l)}`, value: d.k }))); if (!g) return;
            if (!await confirmBox(`Fusionner « ${t.l} » dans « ${typeLab(g, p)} » ? Ses lots passent dans l'autre type ; aucun plan n'est perdu.`)) return;
            await mergeTypes(k, g, p); App.lotSel[f.id] = 'T:' + g; renderPlans(root); return; }
          if (v === 'lvl') { const tt = (p.lotTypes || []).find(d => d.k === k); if (tt && await shareWithLevels(tt, p, f)) { await DB.put('projects', p); renderPlans(root); } return; }
          if (v === 'del') {
            if (!await confirmBox(`Supprimer DÉFINITIVEMENT le type « ${t.l} » ? Ses lots restent dans les autres types (ou « Sans type »). Irréversible.`)) return;
            p.typesGone = [...((p.typesGone || [])), k]; p.lotTypes = (p.lotTypes || []).filter(d => d.k !== k);
            for (const L2 of planLots(p)) if (L2.cat === k) L2.cat = '';
            for (const fo of await DB.byProject('folders', p.id)) if ((fo.hiddenTypes || []).includes(k)) { fo.hiddenTypes = fo.hiddenTypes.filter(q => q !== k); await DB.put('folders', fo); }
            if (tk === k) App.lotSel[f.id] = '__all';
            await DB.put('projects', p); renderPlans(root); return;
          }
          if (v !== 'hide') return;
          f.hiddenTypes = [...hiddenT(f), k]; if (tk === k) App.lotSel[f.id] = '__all';
          await DB.put('folders', f); renderPlans(root); };
      });
    };
    draw();
    box.after(list); };
  // lot : appui long = menu (retirer de ce niveau)
  chips.querySelectorAll('[data-lp]').forEach(b => { const L = lots.find(l => l.id === b.dataset.lp); if (L) b.oncontextmenu = (e) => { e.preventDefault(); lotMenu(L, root, f); }; });
  // ajout d'un lot : rangé dans le type affiché
  const addB = chips.querySelector('[data-lp="__add"]');
  if (addB) addB.onclick = async (e) => { e.stopPropagation(); const r = await formSheet('Nouveau lot (ce niveau seulement)', [{ name: 'n', label: 'Nom', placeholder: 'Ex : Faux plafond' }, { name: 'e', label: 'Emoji', value: '🔧' }], { okLabel: 'Ajouter' });
    if (r && r.n) { const nl = { id: DB.uid(), name: r.n, e: r.e || '🔧', c: ['#0ea5e9', '#22c55e', '#f97316', '#8b5cf6', '#e11d48'][allLots.length % 5], points: [], cat: tk || undefined, only: [f.id] }; allLots.push(nl); await DB.put('projects', p); App.lotSel[f.id] = nl.id; renderPlans(root); } };
  chips.querySelectorAll('[data-lp]').forEach(b => { if (!/^__add/.test(b.dataset.lp)) b.onclick = (e) => { e.stopPropagation(); App.lotSel = App.lotSel || {}; App.lotSel[f.id] = b.dataset.lp; App.keepScrollY = ($('#content') || {}).scrollTop || 0; renderPlans(root); }; });
  const addSub = chips.querySelector('[data-lp="__addsub"]');
  if (addSub) addSub.onclick = (e) => { e.stopPropagation(); const par = lots.find(x => x.id === focusTop); if (par) addSubLot(par, f, root); };
  if (sel === '__all') chips.querySelectorAll('[data-lp]').forEach(b => { const id = b.dataset.lp; if (id === '__none' || /^__add/.test(id)) return;
    b.onclick = (e) => { e.stopPropagation(); App.lotF = App.lotF || {};
      const op = e.target.closest && e.target.closest('[data-open]'); if (op) { App.lotSel[f.id] = op.dataset.open; App.lotF[f.id] = ''; App.keepScrollY = ($('#content') || {}).scrollTop || 0; return renderPlans(root); }
      App.lotF[f.id] = (id === '__f0' || App.lotF[f.id] === id) ? '' : id; App.keepScrollY = ($('#content') || {}).scrollTop || 0; renderPlans(root); }; });
  // balayage gauche / droite dans le dossier = type suivant / précédent (TOUT compris)
  card.classList.add('lot-swipe');   // le balayage dans ce dossier change de type : il n'ouvre pas le menu (voir app.js)
  if (!card._swipe) { card._swipe = true; let x0 = null, y0 = 0;
    card.addEventListener('touchstart', (e) => { if (e.touches.length !== 1 || e.target.closest('.lot-pick, .lot-panel, .lot-chips')) { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    card.addEventListener('touchend', (e) => { if (x0 == null) return; const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
      if (Math.abs(dx) < 70 || Math.abs(dy) > 40) return;
      const pp = App.project, LL = lotsVis(f, planLots(pp)), cur = lotSelDefault(f, ps);
      const seq = ['__all', ...typesVis(f, pp).map(t2 => 'T:' + t2.k)], n = seq.length;
      const key = cur === '__all' ? '__all' : cur === '__none' ? '' : 'T:' + selTypeKey(cur, LL);
      const idx = seq.indexOf(key);
      const ni = idx < 0 ? (dx < 0 ? 0 : n - 1) : ((idx + (dx < 0 ? 1 : -1)) % n + n) % n;
      App.lotSel = App.lotSel || {}; App.lotSel[f.id] = seq[ni]; App.keepScrollY = ($('#content') || {}).scrollTop || 0; renderPlans(root); }, { passive: true }); }
  if (App.reopenPick === f.id) { App.reopenPick = null; setTimeout(() => pickBtn.onclick({ stopPropagation() {} }), 0); }
  const head = $('.folder-head', card); head.after(bar);
  if (sel && sel !== '__all' && sel !== '__none' && !sel.startsWith('T:')) { const L = lots.find(l => l.id === sel); if (L) bar.after(lotPanel(L, f, root)); }
}
const lotFilter = (ps, f) => { const s = lotSelDefault(f, ps), P = App.project;
  if (s && s.startsWith('T:')) { const k = s.slice(2), ids = lotsVis(f, planLots(P)).filter(l => (l.cat || '') === k).map(l => l.id); return ps.filter(p => ids.includes(p.lotId)); }
  if (s === '__all') { const lf = (App.lotF || {})[f.id]; if (lf && planLots(P).some(l => l.id === lf)) { const ids = lotIdsWithKids(P, lf); return ps.filter(p => ids.includes(p.lotId)); } return ps; }
  if (s === '__none') return ps.filter(p => !p.lotId);
  if (s) { const ids = lotIdsWithKids(P, s); return ps.filter(p => ids.includes(p.lotId)); }
  return ps; };
// ajouter un sous-lot au lot : modèles proposés (Revêtements → Carrelage, Parquet…) ou nom libre ; propre au niveau
async function addSubLot(par, f, root) {
  const p = App.project, lots = planLots(p), have = lots.filter(x => x.up === par.id).map(x => normQ(x.name));
  const tpl = tplOfLot(par).filter(n => !have.includes(normQ(n)));
  const v = tpl.length ? await menu(`Sous-lot de ${par.name}`, [...tpl.map(n => ({ label: n, icon: 'layers', value: 'T:' + n })), { label: 'Autre nom…', icon: 'edit', value: 'new' }]) : 'new';
  if (!v) return; let name = v.startsWith('T:') ? v.slice(2) : '';
  if (v === 'new') { const r = await formSheet(`Nouveau sous-lot de ${par.name} (ce niveau seulement)`, [{ name: 'n', label: 'Nom', placeholder: 'Ex : Peinture plastique' }], { okLabel: 'Ajouter' }); if (!r || !r.n) return; name = r.n; }
  const nl = { id: DB.uid(), name, e: par.e, c: par.c, points: [], cat: par.cat, up: par.id, only: [f.id] };
  lots.push(nl); await DB.put('projects', p); App.lotF = App.lotF || {}; if ((App.lotSel || {})[f.id] === '__all') App.lotF[f.id] = nl.id; else App.lotSel[f.id] = nl.id; renderPlans(root);
}
// fusion : A est absorbé par B (plans, points, données par niveau) — rien n'est perdu
async function mergeLots(A, B, p) {
  for (const x of await DB.byProject('plans', p.id)) { let ch = false; if (x.lotId === A.id) { x.lotId = B.id; ch = true; } if (x.hiddenFromLot === A.id) { x.hiddenFromLot = B.id; ch = true; } if (ch) await DB.put('plans', x); }
  for (const fo of await DB.byProject('folders', p.id)) { let ch = false; const D = fo.lotData || {};
    if (D[A.id]) { if (!D[B.id]) D[B.id] = D[A.id]; delete D[A.id]; ch = true; }
    if ((fo.hiddenLots || []).includes(A.id)) { fo.hiddenLots = fo.hiddenLots.filter(k => k !== A.id); ch = true; }
    if (ch) await DB.put('folders', fo); }
  B.points = B.points || []; for (const q of (A.points || [])) if (!B.points.some(z => normQ(z.t) === normQ(q.t))) B.points.push(q);
  const lots = planLots(p); for (const l of lots) if (l.up === A.id) l.up = B.up || B.id;
  const i = lots.indexOf(A); if (i >= 0) lots.splice(i, 1);
  await DB.put('projects', p);
}
async function mergeTypes(kA, kB, p) {
  for (const l of planLots(p)) if (l.cat === kA) l.cat = kB;
  p.typesGone = [...(p.typesGone || []), kA]; p.lotTypes = (p.lotTypes || []).filter(d => d.k !== kA);
  for (const fo of await DB.byProject('folders', p.id)) if ((fo.hiddenTypes || []).includes(kA)) { fo.hiddenTypes = fo.hiddenTypes.filter(q => q !== kA); await DB.put('folders', fo); }
  await DB.put('projects', p);
}
// classement automatique d'après le nom des plans sans lot (aperçu + confirmation)
async function autoClassify(ps, f, root) {
  const p = App.project, props = ps.filter(x => !x.lotId).map(x => [x, autoLotOf(p, x.name)]).filter(([, L]) => L);
  if (!props.length) { toast('Aucun plan à classer d\'après son nom'); return; }
  const txt = props.slice(0, 8).map(([x, L]) => `• ${x.name.slice(0, 32)} → ${L.name}`).join('\n') + (props.length > 8 ? `\n… et ${props.length - 8} autre(s)` : '');
  if (!await confirmBox(`Classer ${props.length} plan(s) d'après leur nom ?\n${txt}`)) return;
  for (const [x, L] of props) { x.lotId = L.id; await DB.put('plans', x); }
  toast(`✓ ${props.length} plan(s) classé(s)`); renderPlans(root);
}
// partager un type / lot / sous-lot avec d'autres niveaux (ou tous)
async function shareWithLevels(x, p, f) {
  const fos = (await DB.byProject('folders', p.id)).filter(o => !o.parentId && o.id !== '_none');
  if (!fos.length) return false;
  const cur = x.only || null;
  const v = await menu('Visible dans quels niveaux ?', [{ label: 'Tous les niveaux', icon: 'layers', value: '*', checked: !cur }, ...fos.map(o => ({ label: o.name, icon: 'folder', value: o.id, checked: !!(cur && cur.includes(o.id)) }))]);
  if (!v) return false;
  if (v === '*') delete x.only; else { const set = new Set(cur || (f ? [f.id] : [])); set.has(v) ? set.delete(v) : set.add(v); x.only = [...set]; if (!x.only.length) delete x.only; }
  return true;
}

// panneau du lot : replié par défaut (une ligne), on l'ouvre au toucher ; « ＋ Ajouter » pour y mettre ce qu'il faut
const lotOpenK = (L) => { try { return (JSON.parse(localStorage.getItem('lot.open') || '{}'))[L.id]; } catch (e) { return false; } };
const lotOpenSet = (L, v) => { try { const o = JSON.parse(localStorage.getItem('lot.open') || '{}'); o[L.id] = v; localStorage.setItem('lot.open', JSON.stringify(o)); } catch (e) {} };
const LOT_GS = [['bpu', '📑 BPU'], ['att', '📐 Attachements'], ['dec', '🧾 Décompte'], ['stock', '📦 Stock']];
function lotPanel(L, f, root) {
  const p = App.project, niv = nivOfFolder(f.name);
  f.lotData = f.lotData || {}; const D = f.lotData[L.id] = f.lotData[L.id] || {};
  const PTS = (L.points || []).filter(x => onlyHere(x, f)), RUBV = (L.rub || []).filter(x => onlyHere(x, f));   // points et rubriques créés dans un niveau : visibles là seulement
  const av = (p.lots || []).find(x => normQ(x.name) === normQ(L.name));
  const done = PTS.filter(x => (D[x.id] || {}).done).length, open = !!lotOpenK(L), po = paOpen(L, D).length, di = dueInfo(D);
  const sc = L.sc || [], docs = D._docs || [];
  const el = document.createElement('div'); el.className = 'lot-panel' + (open ? ' open' : ''); el.style.setProperty('--c', L.c); el.style.setProperty('--t', tint(L.c, .12));
  el.innerHTML = `<div class="lp-h" data-a="tog"><span class="lp-e">${L.e}</span><div class="grow"><b>${esc(L.name)}</b><small>${esc(f.name)}${PTS.length ? ` · ${done}/${PTS.length} points` : ''}${po ? ` · 🛑 ${po}` : ''}${di ? ` · ⏳ ${di.txt}` : ''}</small></div><button class="iconbtn sm" data-a="lm">${icon('more')}</button><span class="lp-chev">${icon('chevdown')}</span></div>
    ${!open ? '' : `<div class="lp-body">
    <div class="lp-avslot"></div>
    ${lotDueHTML(L, D, f)}
    ${lotPaHTML(L, D)}
    <div class="lp-links lp-grid">
      ${L.id === 'go' ? `<div class="lp-gh">Contrôle</div><button data-go="rec"><i>🔩</i><span>Réception ferraillage<small>${esc(niv || 'tous niveaux')}</small></span></button><button data-go="bet"><i>🧱</i><span>Bétonnage<small>${esc(niv || 'tous niveaux')}</small></span></button><button data-go="dec"><i>⏱️</i><span>Suivi décoffrage<small>${esc(niv || '')}</small></span></button>` : ''}
      <div class="lp-gh">Suivi</div>
      ${av ? `<button data-go="av"><i>📊</i><span>Avancement<small>${esc(L.name)}${niv ? ' · ' + esc(niv) : ''}</small></span></button>` : ''}
      <button data-go="suivi"><i>👷</i><span>Suivi du lot · équipes<small>${esc(L.name)}</small></span></button>
      <button data-go="anom"><i>🚨</i><span>Suivi des anomalies<small>${esc(L.name)}${niv ? ' · ' + esc(niv) : ''}</small></span></button>
      <div class="lp-gh">Qualité</div>
      <button data-go="tasks"><i>⚠️</i><span>Réserves<small>${esc(niv || 'tous niveaux')}</small></span></button>
      ${RUBV.length || sc.length ? '<div class="lp-gh">Rubriques & raccourcis</div>' : ''}
      ${RUBV.map(R => `<button data-rub="${R.id}"><i>${esc(R.e)}</i><span>${esc(R.name)}<small>${(((f.lotData || {})[L.id] || {})._rub || {})[R.id] && f.lotData[L.id]._rub[R.id].length ? f.lotData[L.id]._rub[R.id].length + ' ligne(s)' : 'tableau'}</small></span></button>`).join('')}
      ${sc.map((x, i) => !onlyHere(x, f) ? '' : `<button data-sc="${i}"><i>${SC_EMO && SC_EMO[x.sec] ? SC_EMO[x.sec] : '🔗'}</i><span>${esc(x.label)}<small>raccourci</small></span></button>`).join('')}
      <button data-a="rubnew" class="lp-rubnew"><i>＋</i><span>Rubrique<small>tableau + Excel</small></span></button>
    </div>
    ${docs.length ? `<div class="lp-docs">${docs.map((d, i) => `<div class="lp-doc"><button class="grow" data-doc="${i}">${icon(d.url && !d.fileId ? 'drive' : d.planId ? 'plans' : 'pdf')}<span>${esc(d.name)}</span></button><button class="iconbtn sm" data-docm="${i}">${icon('more')}</button></div>`).join('')}</div>` : ''}
    <details class="lp-det" ${App.lotDet ? 'open' : ''}><summary>☑ Points de contrôle ${done}/${PTS.length} · notes</summary>
    <div class="lp-pts">${PTS.map(x => { const v = D[x.id] || {}; return `<button class="lp-pt ${v.done ? 'on' : ''}" data-pt="${x.id}"><i>${v.done ? '☑' : '☐'}</i><span class="grow">${esc(x.t)}${v.at ? `<small>${fmtDate(v.at)}</small>` : ''}</span></button>`; }).join('')}
      <button class="lp-add" data-a="addpt">${icon('plus')} Point de contrôle (ce niveau)</button></div>
    <label class="lp-note">Notes ${esc(L.name)} · ${esc(f.name)}<textarea placeholder="Remarques, besoins, matériel…">${esc(D._note || '')}</textarea></label></details>
    <button class="lp-plus" data-a="plus">${icon('plus')} Ajouter dans ${esc(L.name)}</button></div>`}`;
  const save = () => DB.put('folders', f), redraw = () => renderPlans(root);
  ($('[data-a=tog]', el)||{}).onclick = (e) => { if (e.target.closest('[data-a=lm]')) return; lotOpenSet(L, !open); App.keepScrollY = ($('#content') || {}).scrollTop || 0; redraw(); };
  ($('[data-a=lm]', el)||{}).onclick = (e) => { e.stopPropagation(); lotMenu(L, root, f); };
  if (!open) return el;
  // v1.0.47 : lien direct vers l'avancement de CE lot sur CE niveau (alertes, dates, équipes, saisies, ✓ terminé)
  let avEl = null, pnEl = null;
  { const sl = $('.lp-avslot', el); if (sl && typeof avLotPanelBlock === 'function') { avEl = avLotPanelBlock(p, L, f, redraw); sl.replaceWith(avEl); } }
  // v1.0.53 : pins photos du lot sur ce niveau (dossiers Porte provisoire, Brique, Nettoyage… ; PDF 4 photos par page)
  { const ls = $('.lp-links', el); if (ls && typeof pnLotBlock === 'function') { pnEl = pnLotBlock(p, L, f, redraw); ls.before(pnEl); } }
  $('.lp-det', el).ontoggle = (e) => { App.lotDet = e.target.open; };
  $$('[data-pt]', el).forEach(b => b.onclick = async () => { const v = D[b.dataset.pt] = D[b.dataset.pt] || {}; v.done = !v.done; v.at = v.done ? todayISO() : null; await save(); redraw(); });
  const addPt = async () => { const r = await formSheet(`Point de contrôle · ${L.name}`, [{ name: 't', label: 'Intitulé (ce niveau seulement)', placeholder: 'Ex : Réservations vérifiées' }], { okLabel: 'Ajouter' }); if (r && r.t) { L.points = L.points || []; L.points.push({ id: DB.uid(), t: r.t, only: [f.id] }); App.lotDet = true; await DB.put('projects', p); redraw(); } };
  ($('[data-a=addpt]', el)||{}).onclick = addPt;
  const ta = $('textarea', el); ta.oninput = () => { D._note = ta.value; clearTimeout(ta._t); ta._t = setTimeout(save, 500); };
  bindLotDue(el, L, D, f, save, redraw);
  $$('[data-go]', el).forEach(b => b.onclick = async () => {
    const g = b.dataset.go;
    if (g === 'rec' || g === 'bet') { const k = g === 'rec' ? 'Ferraillage' : 'Bétonnage'; App.recNiv = App.recNiv || {}; App.recNiv[k] = niv; App.section = g === 'rec' ? 'reception' : 'beton'; return renderSection(); }
    if (g === 'dec') return openDecof(p);
    // v1.0.65 : chaque raccourci s'ouvre sur CE niveau et CE lot
    const nv = typeof avNivOfFolder === 'function' ? avNivOfFolder(p, f) : null;
    if (g === 'av') { App.avTab = 'dash'; App.avF = { ...(App.avF && App.avF._p === p.id ? App.avF : { sect: '', zone: '', eq: '', lt: '', pk: 'total', from: '', to: '', by: 'niv', ts: 'gain' }), _p: p.id, niv: nv ? nv.id : '', lot: av.id, zone: '', sect: '' }; App.section = 'avancement'; return renderSection(); }
    if (g === 'tasks') { App.section = 'tasks'; App.search = niv || ''; return renderSection(); }
    if (g === 'anom') return typeof openAnomalies === 'function' ? openAnomalies(p, { niv: niv || '', lot: L.name }) : null;
    if (g === 'suivi') { const SL = typeof lsLots === 'function' ? lsLots(p) : [], m = SL.find(x => x.id === 'p:' + L.id) || SL.find(x => normQ(x.name) === normQ(L.name));
      if (m && typeof lsOpenLot === 'function') return lsOpenLot(p, m, () => redraw());
      App.section = 'lotsuivi'; return renderSection(); }
  });
  $$('[data-gs]', el).forEach(b => b.onclick = () => { App.gsTab = b.dataset.gs; App.gsLot = b.dataset.gs === 'stock' ? '' : L.id; App.section = 'gestion'; renderSection(); });
  $$('[data-sc]', el).forEach(b => { const x = sc[+b.dataset.sc]; b.onclick = () => { if (!SECTIONS[x.sec]) return toast('Section introuvable'); App.section = x.sec; App.search = x.q || ''; renderSection(); };
    b.oncontextmenu = async (e) => { e.preventDefault(); if (await confirmBox(`Retirer le raccourci « ${x.label} » de ${L.name} ?`)) { sc.splice(+b.dataset.sc, 1); await DB.put('projects', p); redraw(); } }; });
  $$('[data-rub]', el).forEach(b => { const R = (L.rub || []).find(x => x.id === b.dataset.rub); if (!R) return;
    b.onclick = async () => { await rubOpen(p, L, f, R); redraw(); };
    let t = null; b.addEventListener('touchstart', () => { t = setTimeout(() => { t = 'done'; rubMenu(p, L, R, redraw); }, 550); }, { passive: true });
    b.addEventListener('touchend', (e) => { if (t === 'done') e.preventDefault(); clearTimeout(t); t = null; }); b.addEventListener('touchmove', () => { clearTimeout(t); t = null; }, { passive: true });
    b.oncontextmenu = (e) => { e.preventDefault(); rubMenu(p, L, R, redraw); }; });
  ($('[data-a=rubnew]', el)||{}).onclick = async () => { const R = await rubNew(p, L, f); if (R) { await rubOpen(p, L, f, R); redraw(); } };
  $$('[data-doc]', el).forEach(b => b.onclick = () => pbOpenDoc(docs[+b.dataset.doc], { projectId: p.id }, planCtx(() => {})));
  $$('[data-docm]', el).forEach(b => b.onclick = async () => { const i = +b.dataset.docm, d = docs[i];
    const v = await menu(d.name, [{ label: 'Ouvrir', icon: 'pdf', value: 'open' }, { label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Monter', icon: 'chevup', value: 'up' }, { label: 'Retirer', icon: 'trash', danger: true, value: 'del' }]);
    if (v === 'open') pbOpenDoc(d, { projectId: p.id }, planCtx(() => {}));
    if (v === 'ren') { const r = await formSheet('Renommer', [{ name: 'n', label: 'Nom', value: d.name }]); if (r && r.n) { d.name = r.n; await save(); redraw(); } }
    if (v === 'up' && i > 0) { [docs[i - 1], docs[i]] = [docs[i], docs[i - 1]]; await save(); redraw(); }
    if (v === 'del' && await confirmBox('Retirer ce document ?')) { if (d.fileId) await DB.del('files', d.fileId); docs.splice(i, 1); await save(); redraw(); } });
  // ＋ Ajouter : ce qu'il faut dans ce lot
  ($('[data-a=plus]', el)||{}).onclick = async () => {
    const v = await menu(`Ajouter dans ${L.e} ${L.name}`, [{ label: '☑ Point de contrôle (ce niveau)', icon: 'check', value: 'pt' }, { label: '🛑 Point d\'arrêt', icon: 'close', value: 'pa' }, { label: '⚠️ Point critique', icon: 'ask', value: 'pc' },
      { label: '🗂 Nouvelle rubrique (tableau + Excel)', icon: 'grid', value: 'rub' }, { label: '🔗 Raccourci vers une section', icon: 'layers', value: 'sc' }, { label: `📄 Document / plan (${f.name})`, icon: 'pdf', value: 'doc' }, { label: '📝 Note', icon: 'edit', value: 'note' }]);
    if (v === 'pt') addPt();
    if (v === 'rub') { const R = await rubNew(p, L, f); if (R) { await rubOpen(p, L, f, R); redraw(); } }
    if (v === 'pa' || v === 'pc') { const b = $(v === 'pa' ? '[data-a=addpa]' : '[data-a=addpc]', el); if (b) b.click(); }
    if (v === 'sc') { const secs = Object.entries(SECTIONS).filter(([k, S]) => !S.hidden && k !== 'settings' && (!SECTION_FEATURE[k] || featOn(SECTION_FEATURE[k])));
      const k = await menu('Raccourci vers…', secs.map(([k2, S]) => ({ label: `${(SC_EMO && SC_EMO[k2]) || '📁'} ${S.label}`, value: k2 }))); if (!k) return;
      L.sc = L.sc || []; L.sc.push({ sec: k, label: SECTIONS[k].label.split(' (')[0], only: [f.id] }); await DB.put('projects', p); toast('Raccourci ajouté (ce niveau) ✓'); redraw(); }
    if (v === 'doc') { const ds = await pbPickDocs(p.id); if (ds.length) { D._docs = [...docs, ...ds]; await save(); redraw(); } }
    if (v === 'note') { App.lotDet = true; lpTabSet(L, 'pts'); redraw(); setTimeout(() => { const t = document.querySelector(`.lot-panel.open textarea`); if (t) { t.focus(); t.scrollIntoView({ block: 'center' }); } }, 200); }
  };
  // v1.0.55 : fiche du lot rangée en boutons — une section ouverte à la fois (la fiche ne s'étire plus sur plusieurs écrans)
  { const body = $('.lp-body', el); if (body) {
    const q = (x) => $(x, body), links = [q('.lp-links'), q('.lp-docs')].filter(Boolean);
    const T = [
      ['av', '📊', 'Avancement', avEl ? [avEl] : [], ''],
      ['ph', '📷', 'Photos', pnEl ? [pnEl] : [], ''],
      ['due', '⏳', 'Échéance', [q('.lp-due'), q('.lp-als')].filter(Boolean), di ? di.txt : 'non fixée', di && /late|r/.test(di.cls || '')],
      ['pa', '🛑', 'Points d\'arrêt', [q('.lp-pa')].filter(Boolean), po ? `${po} ouvert(s)` : `${(L.pa || []).length}`, po > 0],
      ['go', '🔗', 'Accès rapides', links, `${links[0] ? $$('button', links[0]).length - 1 : 0}`],
      ['pts', '☑', 'Contrôle', [q('.lp-det:not(.lp-pa)')].filter(Boolean), `${done}/${PTS.length}`],
    ].filter(t => t[3].length);
    const bar = document.createElement('div'); bar.className = 'lp-tabs';
    const show = (k) => { T.forEach(t => t[3].forEach(n => { n.style.display = t[0] === k ? '' : 'none'; n.classList.toggle('lp-hide', t[0] !== k); })); $$('button', bar).forEach(b => b.classList.toggle('on', b.dataset.lt === k)); };
    bar.innerHTML = T.map(t => `<button data-lt="${t[0]}" class="${t[5] ? 'r' : ''}"><span class="e">${t[1]}</span>${esc(t[2])}${t[4] ? `<small>${esc(String(t[4]))}</small>` : ''}</button>`).join('');
    $$('button', bar).forEach(b => b.onclick = () => { const k = lpTabOf(L) === b.dataset.lt ? '' : b.dataset.lt; lpTabSet(L, k); show(k); });
    body.prepend(bar); show(lpTabOf(L));
  } }
  return el;
}
const lpTabOf = (L) => { try { return (JSON.parse(localStorage.getItem('lp.tab') || '{}'))[L.id] || ''; } catch (e) { return ''; } };
const lpTabSet = (L, k) => { try { const o = JSON.parse(localStorage.getItem('lp.tab') || '{}'); o[L.id] = k; localStorage.setItem('lp.tab', JSON.stringify(o)); } catch (e) {} };
// masque un lot dans les niveaux donnés ; ses plans de ces niveaux gardent la trace (hiddenFromLot) pour être rendus au lot
async function hideLotIn(p, L, folders) {
  for (const fo of folders) {
    if (!(fo.hiddenLots || []).includes(L.id)) { fo.hiddenLots = [...(fo.hiddenLots || []), L.id]; await DB.put('folders', fo); }
  }
  const ids = new Set(folders.map(x => x.id));
  for (const x of await DB.byProject('plans', p.id)) if (ids.has(x.folderId) && x.lotId === L.id) { x.hiddenFromLot = L.id; x.lotId = null; await DB.put('plans', x); }
}
// « Rétablir masqués » : rend tous les types et lots masqués, dans tous les niveaux, et remet leurs plans à leur lot
async function restoreHiddenAll(p) {
  for (const fo of await DB.byProject('folders', p.id)) { if ((fo.hiddenTypes || []).length || (fo.hiddenLots || []).length) { fo.hiddenTypes = []; fo.hiddenLots = []; await DB.put('folders', fo); } }
  for (const x of await DB.byProject('plans', p.id)) if (x.hiddenFromLot) { if (!x.lotId) x.lotId = x.hiddenFromLot; delete x.hiddenFromLot; await DB.put('plans', x); }
}
async function lotMenu(L, root, f) {
  const p = App.project, lots = planLots(p), i = lots.indexOf(L);
  const v = await menu(`${L.e} ${L.name}`, [{ label: 'Renommer / emoji', icon: 'edit', value: 'ren' }, { label: 'Couleur', icon: 'brush', value: 'col' }, { label: 'Catégorie' + (L.cat ? ' · ' + typeLab(L.cat, App.project) : ''), icon: 'layers', value: 'cat' }, ...(!L.up && f ? [{ label: 'Ajouter un sous-lot…', icon: 'plus', value: 'sub' }] : []), { label: L.up ? 'Déplacer vers un autre lot…' : 'Faire de ce lot un sous-lot de…', icon: 'layers', value: 'upl' }, { label: 'Fusionner avec un autre lot…', icon: 'layers', value: 'merge' }, { label: 'Visible dans quels niveaux…', icon: 'eye', value: 'lvl' }, ...(f ? [{ label: 'Partager ses points / rubriques avec d\'autres niveaux…', icon: 'eye', value: 'items' }] : []), { label: '← Déplacer à gauche', icon: 'back', value: 'l' }, { label: 'Déplacer à droite →', icon: 'chevright', value: 'r' }, { label: 'Points de contrôle…', icon: 'check', value: 'pts' }, ...(f ? [{ label: 'Masquer dans ce niveau', icon: 'eye', value: 'hide' }] : []), { label: 'Supprimer définitivement', icon: 'trash', danger: true, value: 'del' }]);
  if (v === 'ren') { const r = await formSheet('Lot', [{ name: 'n', label: 'Nom', value: L.name }, { name: 'e', label: 'Emoji', value: L.e }]); if (r && r.n) { L.name = r.n; L.e = r.e || L.e; } }
  if (v === 'cat') { const k = await menu('Catégorie du lot', [...typesOf(App.project).map(d => ({ label: d.l, value: d.k, checked: L.cat === d.k })), { label: 'Aucune', value: '', checked: !L.cat }]); if (k !== null && k !== undefined) L.cat = k; }
  if (v === 'sub' && f) { await addSubLot(L, f, root); return; }
  if (v === 'upl') { const cand = lots.filter(x => x !== L && !x.up && x.up !== L.id && !lots.some(z => z.up === L.id && z === x)); const g = await menu(L.up ? 'Déplacer vers le lot' : 'Sous-lot de', [...cand.map(x => ({ label: `${x.e} ${x.name}`, value: x.id })), ...(L.up ? [{ label: 'Aucun (lot principal)', value: '__none' }] : [])]); if (!g) return; if (g === '__none') delete L.up; else { L.up = g; L.cat = (lots.find(x => x.id === g) || {}).cat; for (const z of lots) if (z.up === L.id) z.up = g; } }
  if (v === 'merge') { const g = await menu(`Fusionner « ${L.name} » dans`, lots.filter(x => x !== L && x.up !== L.id).map(x => ({ label: `${x.e} ${x.name}`, value: x.id }))); if (!g) return;
    const B = lots.find(x => x.id === g); if (!await confirmBox(`Fusionner « ${L.name} » dans « ${B.name} » ? Ses plans et ses points passent dans « ${B.name} » ; aucun plan n'est perdu.`)) return;
    await mergeLots(L, B, p); if (f && (App.lotSel || {})[f.id] === L.id) App.lotSel[f.id] = B.id; renderPlans(root); return; }
  if (v === 'lvl') { if (await shareWithLevels(L, p, f)) { await DB.put('projects', p); renderPlans(root); } return; }
  if (v === 'items') { const its = [...(L.points || []), ...(L.rub || []), ...(L.sc || [])].filter(x => x.only); if (!its.length) { toast('Rien de propre à un niveau dans ce lot'); return; }
    const tmp = { only: [...its[0].only] }; if (await shareWithLevels(tmp, p, f)) { for (const x of its) { if (tmp.only) x.only = [...tmp.only]; else delete x.only; } await DB.put('projects', p); renderPlans(root); } return; }
  if (v === 'col') { const c = await menu('Couleur', ['#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#3b82f6', '#eab308', '#14b8a6', '#b45309', '#ec4899', '#64748b', '#22c55e', '#0ea5e9'].map(c => ({ label: c, swatch: c, value: c }))); if (c) L.c = c; }
  if ((v === 'l' && i > 0) || (v === 'r' && i < lots.length - 1)) { const j = v === 'l' ? i - 1 : i + 1; [lots[i], lots[j]] = [lots[j], lots[i]]; }
  if (v === 'pts') { const id = await menu('Supprimer un point ?', (L.points || []).map(x => ({ label: x.t, icon: 'trash', value: x.id }))); if (id && await confirmBox('Supprimer ce point de tous les niveaux ?')) L.points = L.points.filter(x => x.id !== id); }
  // masquer dans CE niveau seulement (récupérable avec « Rétablir masqués »)
  if (v === 'hide' && f) { if (await confirmBox(`Masquer le lot « ${L.name} » de ce niveau ? Ses plans de ce niveau passent dans « Sans lot ». « Rétablir masqués » le remet.`)) {
    await hideLotIn(p, L, [f]);
    if ((App.lotSel || {})[f.id] === L.id) App.lotSel[f.id] = '__all';
    renderPlans(root); } return; }
  // suppression DÉFINITIVE du lot (dans tous les niveaux) ; ses plans restent, rangés « Sans lot »
  if (v === 'del' && await confirmBox(`Supprimer DÉFINITIVEMENT le lot « ${L.name} » ? Il disparaît de tous les niveaux. Les plans restent (sans lot). Irréversible.`)) {
    for (const x of await DB.byProject('plans', p.id)) if (x.lotId === L.id || x.hiddenFromLot === L.id) { x.lotId = null; delete x.hiddenFromLot; await DB.put('plans', x); }
    for (const fo of await DB.byProject('folders', p.id)) if ((fo.hiddenLots || []).includes(L.id)) { fo.hiddenLots = fo.hiddenLots.filter(k => k !== L.id); await DB.put('folders', fo); }
    const k = lots.indexOf(L); if (k >= 0) lots.splice(k, 1);
    if (f && (App.lotSel || {})[f.id] === L.id) App.lotSel[f.id] = '__all';
    await DB.put('projects', p); renderPlans(root); return;
  }
  if (v) { await DB.put('projects', p); renderPlans(root); }
}
async function planLotMenu(plan, root) {
  const p = App.project, fo = plan.folderId ? await DB.get('folders', plan.folderId) : null, all = planLots(p).filter(l => !fo || onlyHere(l, fo));
  const ord = [...all.filter(l => !l.up).flatMap(l => [l, ...all.filter(k => k.up === l.id)]), ...all.filter(l => l.up && !all.some(z => z.id === l.up))];
  const v = await menu(`Lot du plan « ${plan.name} »`, [...ord.map(l => ({ label: `${l.up ? '   ↳ ' : l.e + ' '}${l.name}`, icon: plan.lotId === l.id ? 'check' : 'layers', value: l.id })), { label: 'Discipline du plan (différente du lot)…', icon: 'brush', value: '__disc' }, { label: 'Aucun lot', icon: 'close', value: '__none' }]);
  if (!v) return;
  if (v === '__disc') { const k = await menu('Discipline technique du plan', [...typesOf(p).map(d => ({ label: `${typeAbOf(d.k, p)} · ${typeName(d.l)}`, value: d.k, checked: plan.disc === d.k })), { label: 'Comme le lot du marché', value: '__same', checked: !plan.disc }]); if (!k) return;
    for (const x of await DB.byProject('plans', plan.projectId)) if (x.id === plan.id || planSerie(x) === planSerie(plan)) { if (k === '__same') delete x.disc; else x.disc = k; await DB.put('plans', x); } renderPlans(root); return; }
  plan.lotId = v === '__none' ? null : v; await DB.put('plans', plan);
  // les anciens indices suivent
  for (const x of await DB.byProject('plans', plan.projectId)) if (x.id !== plan.id && planSerie(x) === planSerie(plan)) { x.lotId = plan.lotId; await DB.put('plans', x); }
  renderPlans(root);
}
async function tagNewPlans(projectId, folderId, lotId, since) {
  for (const x of await DB.byProject('plans', projectId)) if (x.folderId === folderId && (x.createdAt || 0) >= since && !x.lotId) { x.lotId = lotId; await DB.put('plans', x); }
}

// ---------- Échéance du maître d'ouvrage (par lot et par niveau) + points d'arrêt / critiques ----------
function lotDueHTML(L, D, f) {
  const p = App.project, di = dueInfo(D), done = (L.points || []).filter(x => (D[x.id] || {}).done).length, nP = (L.points || []).length;
  const pa = L.pa || [], paOk = pa.filter(x => ((D.pa || {})[x.id] || {}).st === 'ok').length;
  const prog = nP + pa.length ? Math.round((done + paOk) / (nP + pa.length) * 100) : 0;
  let tp = 0; if (D._due) { const a = new Date((D._start || D._dueSet || todayISO()) + 'T12:00:00'), b = new Date(D._due + 'T12:00:00'), n = new Date(todayISO() + 'T12:00:00'); tp = b > a ? Math.max(0, Math.min(100, Math.round((n - a) / (b - a) * 100))) : 100; }
  const extra = (D._al || []).slice().sort((a, b) => (a.done - b.done) || String(a.d).localeCompare(String(b.d)));
  const alHTML = `<div class="lp-als">${extra.map(a => { const d = dueDays(a.d), c = a.done ? 'done' : d < 0 ? 'late' : d <= 7 ? 'soon' : 'ok';
      return `<button class="lp-al ${c}" data-al="${a.id}"><span class="lp-ald">${a.done ? '✓' : esc(dueTxt(d))}</span><span class="grow"><b>${esc(a.obj || a.type)}</b><small>${esc(a.type)} · ${fmtDate(a.d)}${a.zone ? ' · ' + esc(a.zone) : ''}${a.by ? ' · ' + esc(a.by) : ''}</small></span></button>`; }).join('')}
    <div class="lp-al-acts"><button class="lp-al add" data-a="aladd">${icon('plus')} Échéance / alerte</button><button class="lp-al add" data-a="altab">📋 Tableau des échéances</button></div></div>`;
  if (!D._due) return `<button class="lp-due none" data-a="due">⏳ <span class="grow">Échéance ${esc(D._dueBy || 'du maître d\'ouvrage')} <small>non fixée · toucher pour la fixer</small></span>${icon('plus')}</button>${alHTML}`;
  const dm = dueDays(D._due), cm = D._dueDone ? 'ok' : dm < 0 ? 'late' : dm <= 7 ? 'soon' : 'ok';
  return `<button class="lp-due ${cm}" data-a="due"><span class="lp-dd">${D._dueDone ? '✓ Fait' : dueTxt(dm)}</span><span class="grow"><b>${D._dueObj ? esc(D._dueObj) : 'Échéance ' + esc(D._dueBy || 'MO')} · ${fmtDate(D._due)}</b><small>${D._dueObj ? 'Échéance ' + esc(D._dueBy || 'MO') + ' · ' : ''}${esc(p.mo || 'Maître d\'ouvrage : toucher pour le nommer')}${D._dueZone ? ' · ' + esc(D._dueZone) : ''}${(D._dueHist || []).length ? ` · modifiée ${(D._dueHist || []).length} fois` : ''}</small>
    <span class="lp-bars"><span><i style="width:${tp}%"></i></span><em>temps ${tp}%</em><span class="pr"><i style="width:${prog}%"></i></span><em>fait ${prog}%</em></span></span></button>${alHTML}`;
}
function lotPaHTML(L, D) {
  const pa = L.pa || [], st = D.pa || {};
  const open = paOpen(L, D).length, ko = pa.filter(x => (st[x.id] || {}).st === 'ko').length;
  const pill = (x) => { const v = st[x.id] || {}; return v.st === 'ok' ? '<i class="pa-s ok">✓ levé</i>' : v.st === 'ko' ? '<i class="pa-s ko">✗ refusé</i>' : '<i class="pa-s w">⏳ en attente</i>'; };
  return `<details class="lp-det lp-pa" ${App.lotPaDet ? 'open' : ''}><summary>🛑 Points d'arrêt & critiques ${pa.length ? `<b class="${open || ko ? 'r' : 'g'}">${pa.filter(x => (st[x.id] || {}).st === 'ok').length}/${pa.length}</b>` : ''}</summary>
    <div class="lp-pts">${pa.map(x => { const v = st[x.id] || {}; return `<button class="pa-row ${x.k}" data-pa="${x.id}"><span class="pa-k">${x.k === 'a' ? '🛑' : '⚠️'}</span><span class="grow">${esc(x.t)}<small>${x.k === 'a' ? 'Point d\'arrêt' : 'Point critique'}${v.at ? ` · ${fmtDate(v.at)}` : ''}${v.by ? ` · ${esc(v.by)}` : ''}${(v.ph || []).length ? ` · 📷 ${(v.ph || []).length}` : ''}${v.note ? ' · 📝' : ''}</small></span>${pill(x)}</button>`; }).join('') || '<div class="lp-none">Aucun point. Ajoutez-en, ou chargez le modèle du lot.</div>'}
      <div class="pa-acts"><button class="lp-add" data-a="addpa">${icon('plus')} Point d'arrêt</button><button class="lp-add" data-a="addpc">${icon('plus')} Point critique</button>${PA_TPL[L.id] ? `<button class="lp-add" data-a="tplpa">📋 Modèle ${esc(L.name)}</button>` : ''}</div></div></details>`;
}
function bindLotDue(el, L, D, f, save, redraw) {
  const p = App.project;
  const pd = $('.lp-pa', el); if (pd) pd.ontoggle = (e) => { App.lotPaDet = e.target.open; };
  ($('[data-a=due]', el)||{}).onclick = async () => {
    const r = await formSheet(`Échéance · ${L.name} · ${f.name}`, [
      { name: 'obj', label: 'Objet (de quoi s\'agit-il ?)', value: D._dueObj || '', placeholder: 'Ex : Coulage dalle zone 4, Livraison local technique' },
      { name: 'due', label: 'Date limite fixée', type: 'date', value: D._due || '' },
      { name: 'zone', label: 'Zone (optionnel)', value: D._dueZone || '', list: lotZonesList(p) },
      ...(D._due ? [{ name: 'done', label: 'État', type: 'select', value: D._dueDone ? 'o' : 'n', options: [{ value: 'n', label: '⏳ À faire' }, { value: 'o', label: '✓ Fait' }] }] : []),
      { name: 'rem', label: '🔔 Rappel', type: 'select', value: D._dueRem || '', options: DUE_REM.map(([value, label]) => ({ value, label })) },
      { name: 'hr', label: 'Heure du rappel (vide = heure par défaut)', type: 'time', value: D._dueHr || '' },
      { name: 'by', label: 'Fixée par', type: 'select', value: D._dueBy || 'MO', options: [['MO', 'Maître d\'ouvrage'], ['BET', 'BET'], ['BC', 'Bureau de contrôle'], ['Archi', 'Architecte'], ['Entreprise', 'Entreprise / planning interne']].map(([value, label]) => ({ value, label })) },
      { name: 'start', label: 'Début du lot (pour la barre de temps)', type: 'date', value: D._start || '' },
      { name: 'mo', label: 'Nom du maître d\'ouvrage (pour tout le projet)', value: p.mo || '', placeholder: 'Ex : SONARGES, ONEE, Commune…' },
      ...(D._due ? [{ name: 'why', label: 'Motif du changement (si la date change)', placeholder: 'Ex : avenant n°2, intempéries…' }] : []),
      ...((D._dueHist || []).length ? [{ name: '_h', type: 'info', label: 'Historique', value: D._dueHist.map(h => `${fmtDate(h.from)} → ${fmtDate(h.to)}${h.why ? ' (' + h.why + ')' : ''} · le ${fmtDate(h.at)}`).join('\n') }] : []),
    ], { okLabel: 'Enregistrer', danger: D._due ? 'Retirer l\'échéance' : null });
    if (!r) return;
    if (r.__danger) { delete D._due; delete D._dueBy; delete D._dueObj; delete D._dueZone; delete D._dueDone; }
    else {
      D._dueObj = (r.obj || '').trim(); D._dueZone = (r.zone || '').trim(); D._dueDone = r.done === 'o'; D._dueRem = r.rem || ''; D._dueHr = r.hr || '';
      if (D._due && r.due && r.due !== D._due) (D._dueHist = D._dueHist || []).push({ from: D._due, to: r.due, why: r.why || '', at: todayISO() });
      if (r.due && !D._due) D._dueSet = todayISO();
      D._due = r.due || null; D._dueBy = r.by; D._start = r.start || D._start || null;
      if ((r.mo || '') !== (p.mo || '')) { p.mo = r.mo; await DB.put('projects', p); }
    }
    await save(); redraw(); dueSchedule(p).catch(() => {});
  };
  // v1.0.65 : échéances / alertes supplémentaires
  const alForm = async (a) => {
    const r = await formSheet(a ? 'Échéance / alerte' : `Nouvelle échéance · ${L.name} · ${f.name}`, [
      { name: 'obj', label: 'Objet', value: a ? a.obj : '', placeholder: 'Ex : Réception réservations R+1 zone 2' },
      { name: 'type', label: 'Type', type: 'select', value: a ? a.type : LOT_AL_TYPES[0], options: LOT_AL_TYPES.map(x => ({ value: x, label: x })) },
      { name: 'd', label: 'Date', type: 'date', value: a ? a.d : '' },
      { name: 'zone', label: 'Zone (optionnel)', value: a ? a.zone || '' : '', list: lotZonesList(p) },
      { name: 'by', label: 'Demandé par (optionnel)', value: a ? a.by || '' : '', list: ['MO', 'BET', 'Bureau de contrôle', 'Architecte', 'Laboratoire', 'Entreprise'] },
      ...(a ? [{ name: 'done', label: 'État', type: 'select', value: a.done ? 'o' : 'n', options: [{ value: 'n', label: '⏳ À faire' }, { value: 'o', label: '✓ Fait' }] }] : []),
      { name: 'rem', label: '🔔 Rappel', type: 'select', value: a ? a.rem || '' : '', options: DUE_REM.map(([value, label]) => ({ value, label })) },
      { name: 'hr', label: 'Heure du rappel (vide = heure par défaut)', type: 'time', value: a ? a.hr || '' : '' },
    ], { okLabel: 'Enregistrer', danger: a ? 'Supprimer' : null });
    if (!r) return; D._al = D._al || [];
    if (r.__danger) D._al = D._al.filter(x => x.id !== a.id);
    else { if (!r.d) return toast('Indiquez la date'); const o = a || { id: DB.uid(), at: todayISO() }; Object.assign(o, { obj: (r.obj || '').trim(), type: r.type, d: r.d, zone: (r.zone || '').trim(), by: (r.by || '').trim(), done: r.done === 'o', doneAt: r.done === 'o' ? (o.doneAt || todayISO()) : null, rem: r.rem || '', hr: r.hr || '' }); if (!a) D._al.push(o); }
    await save(); redraw(); dueSchedule(p).catch(() => {});
  };
  const aa = $('[data-a=aladd]', el); if (aa) aa.onclick = () => alForm(null);
  const at = $('[data-a=altab]', el); if (at) at.onclick = () => openDueTable(p, { niv: nivOfFolder(f.name) || f.name, lot: L.name });
  $$('[data-al]', el).forEach(b => b.onclick = () => alForm((D._al || []).find(x => x.id === b.dataset.al)));
  const addPa = async (k) => { const r = await formSheet(k === 'a' ? '🛑 Point d\'arrêt' : '⚠️ Point critique', [{ name: 't', label: 'Intitulé (ajouté à tous les niveaux)', placeholder: k === 'a' ? 'Ex : Réception ferraillage avant bétonnage' : 'Ex : Enrobage' }], { okLabel: 'Ajouter' }); if (r && r.t) { L.pa = L.pa || []; L.pa.push({ id: DB.uid(), k, t: r.t }); await DB.put('projects', p); App.lotPaDet = true; redraw(); } };
  ($('[data-a=addpa]', el)||{}).onclick = () => addPa('a');
  ($('[data-a=addpc]', el)||{}).onclick = () => addPa('c');
  const tp = $('[data-a=tplpa]', el); if (tp) tp.onclick = async () => { L.pa = L.pa || []; let n = 0; for (const [k, t] of PA_TPL[L.id]) if (!L.pa.some(x => normQ(x.t) === normQ(t))) { L.pa.push({ id: DB.uid(), k, t }); n++; } await DB.put('projects', p); App.lotPaDet = true; toast(`${n} point(s) ajouté(s) pour tous les niveaux`); redraw(); };
  $$('[data-pa]', el).forEach(b => b.onclick = async () => {
    const x = (L.pa || []).find(y => y.id === b.dataset.pa); if (!x) return; D.pa = D.pa || {}; const v = D.pa[x.id] = D.pa[x.id] || {};
    const c = await menu(`${x.k === 'a' ? '🛑' : '⚠️'} ${x.t}`, [
      { label: '✓ Levé (accepté)', icon: 'check', value: 'ok', checked: v.st === 'ok' }, { label: '✗ Refusé', icon: 'close', value: 'ko', checked: v.st === 'ko' }, { label: '⏳ En attente', icon: 'calendar', value: 'w', checked: !v.st || v.st === 'w' },
      { label: 'Ajouter une photo / le PV', icon: 'camera', value: 'ph' }, ...((v.ph || []).length ? [{ label: `Voir les photos (${v.ph.length})`, icon: 'image', value: 'see' }] : []),
      { label: 'Note', icon: 'edit', value: 'note' }, { label: 'Supprimer ce point (tous les niveaux)', icon: 'trash', danger: true, value: 'del' }]);
    if (!c) return;
    if (c === 'ok' || c === 'ko') { const r = await formSheet(c === 'ok' ? 'Point levé' : 'Point refusé', [{ name: 'by', label: 'Par', type: 'select', value: v.by || PA_BY[0], options: PA_BY.map(z => ({ value: z, label: z })) }, { name: 'at', label: 'Date', type: 'date', value: todayISO() }, { name: 'note', label: 'Observation', value: v.note || '' }], { okLabel: 'Enregistrer' }); if (!r) return; Object.assign(v, { st: c, by: r.by, at: r.at, note: r.note }); }
    if (c === 'w') { v.st = 'w'; v.at = null; }
    if (c === 'ph') { const files = await pickFiles({ accept: 'image/*,application/pdf', multiple: true }); for (const fl of files) { const rec = isRasterImage(fl) ? await saveImageFile(p.id, fl, 'photo', { source: `${L.name} · ${x.t}` }) : await DB.put('files', { projectId: p.id, blob: fl, mime: mimeFromName(fl.name, fl.type), name: fl.name, role: 'pv' }); (v.ph = v.ph || []).push(rec.id); } }
    if (c === 'see') { const items = []; for (const id of v.ph) { const fr = await DB.get('files', id); if (fr && fr.blob) { if (/image/.test(fr.mime || fr.blob.type)) items.push({ src: BlobURL.get(fr.id, fr.blob), caption: x.t }); else openFileRecord(fr, x.t); } } if (items.length) showGallery(items, 0); return; }
    if (c === 'note') { const r = await formSheet('Note', [{ name: 'n', label: x.t, type: 'textarea', value: v.note || '' }]); if (r) v.note = r.n; }
    if (c === 'del') { if (!await confirmBox('Supprimer ce point de tous les niveaux ?')) return; L.pa = L.pa.filter(y => y.id !== x.id); await DB.put('projects', p); }
    await save(); App.lotPaDet = true; redraw();
  });
}
// liste pour le tableau de bord / rapport hebdo
async function lotDueList(p) {
  const out = [];
  for (const f of await DB.byProject('folders', p.id)) for (const L of planLots(p)) { const D = (f.lotData || {})[L.id]; if (!D) continue; const di = dueInfo(D), po = paOpen(L, D);
    if (di || (lotStarted(L, D) && po.length)) out.push({ f, L, D, di, po }); }
  return out.sort((a, b) => (a.di ? a.di.d : 9999) - (b.di ? b.di.d : 9999));
}

// ================= v1.0.65 : Tableau des échéances (tous niveaux, zones, lots, types) =================
async function openDueTable(p, pre = {}) {
  p = p || App.project; if (!p) return;
  const rows = [];
  for (const f of await DB.byProject('folders', p.id)) for (const L of planLots(p)) { const D = (f.lotData || {})[L.id]; if (!D) continue;
    for (const a of lotAlerts(D)) rows.push({ f, L, a, niv: nivOfFolder(f.name) || f.name, d: dueDays(a.d) }); }
  // v1.0.176 : les points d'intérêt (plan) sont dans le même tableau : une ligne par date (échéance, fin objectif, début)
  try {
    for (const l of (await DB.byProject('links', p.id)).filter(x => x.kind === 'local' && x.planId && x.x != null)) {
      const pl = await DB.get('plans', l.planId);
      const lot = typeof ptLotName === 'function' ? ptLotName(p, l, pl) : '';
      let niv = l.nivId ? ((p.avNiveaux || []).find(n => n.id === l.nivId) || {}).name || '' : '';
      if (!niv && pl) niv = ((p.avNiveaux || []).find(n => n.name && String(pl.name || '').toLowerCase().includes(String(n.name).toLowerCase())) || {}).name || '';
      const L = { name: lot || '—', e: '📍' };
      const add = (d, t) => { if (d) rows.push({ f: null, L, pt: l, a: { obj: l.name || 'Point', type: t, d, done: !!l.finished, zone: '', by: '' }, niv: niv || '—', d: dueDays(d) }); };
      add(l.due, 'Point · échéance'); add(l.dueCo, 'Point · fin objectif'); if (!l.started) add(l.start, 'Point · début');
    }
  } catch (e) { console.warn('échéances points', e); }
  const F = { niv: pre.niv || '', lot: pre.lot || '', zone: '', type: '', st: '', q: '' };
  const EMB = pre.embed || null, el = EMB || document.createElement('div'); if (EMB) { EMB.classList.add('due-page', 'emb'); EMB.innerHTML = ''; } else { el.className = 'fullpage due-page'; document.body.appendChild(el); }
  const unBack = EMB ? () => {} : pushBack(() => el.remove()); const close = EMB ? () => {} : () => { unBack(); el.remove(); };
  const stOf = (r) => r.a.done ? 'fait' : r.d < 0 ? 'retard' : r.d <= 7 ? 'bientot' : 'ok';
  const ST = { retard: ['🔴', 'En retard'], bientot: ['🟠', 'Bientôt (≤ 7 j)'], ok: ['🟢', 'À venir'], fait: ['✓', 'Fait'] };
  const uniq = (fn) => [...new Set(rows.map(fn).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'fr', { numeric: true }));
  let NX = {}; try { const LN = window.Capacitor?.Plugins?.LocalNotifications; if (LN) { await dueSchedule(p); const pend = await LN.getPending(); for (const x of pend.notifications || []) if (x.body && x.schedule && x.schedule.at) { const t = new Date(x.schedule.at); if (!NX[x.body] || t < NX[x.body]) NX[x.body] = t; } } } catch (e) {}
  const nxOf = (r) => NX[`${r.a.obj || r.a.type} · ${r.L.name} · ${r.niv}${r.a.zone ? ' · ' + r.a.zone : ''}`];
  const draw = () => {
    const R = rows.filter(r => (!F.niv || r.niv === F.niv) && (!F.lot || r.L.name === F.lot) && (!F.zone || (r.a.zone || '') === F.zone) && (!F.type || r.a.type === F.type) && (!F.st || stOf(r) === F.st)
      && (!F.q || `${r.a.obj} ${r.a.type} ${r.niv} ${r.L.name} ${r.a.zone} ${r.a.by}`.toLowerCase().includes(F.q.toLowerCase()))).sort((x, y) => (x.a.done - y.a.done) || x.a.d.localeCompare(y.a.d));
    const cnt = (k) => rows.filter(r => stOf(r) === k).length;
    const sel = (k, lab, L) => `<label class="avf-s ${F[k] ? 'on' : ''}"><small>${lab}</small><select data-f="${k}"><option value="">Tous</option>${L.map(x => { const [v, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${v === F[k] ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>`;
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title" style="flex:1"><b>Tableau des échéances</b><span>${esc(p.name)}</span></div><button class="iconbtn" data-a="notif" title="Notifications">🔔</button><button class="iconbtn" data-a="pdf">${icon('pdf')}</button></div>
      <div class="due-body">
        <div class="due-top"><div class="due-k">${['retard', 'bientot', 'ok', 'fait'].map(k => `<button data-st="${k}" class="${F.st === k ? 'on' : ''} ${k}"><b>${cnt(k)}</b><small>${ST[k][0]} ${ST[k][1]}</small></button>`).join('')}</div>
        <input class="due-q" type="search" placeholder="🔍 Objet, lot, zone…" value="${esc(F.q)}">
        <div class="avf-bar">${sel('niv', 'Niveau', uniq(r => r.niv))}${sel('lot', 'Lot', uniq(r => r.L.name))}${sel('zone', 'Zone', uniq(r => r.a.zone))}${sel('type', 'Type', uniq(r => r.a.type))}</div></div>
        <div class="due-l">${R.map((r, i) => `<button class="due-r ${stOf(r)}" data-i="${rows.indexOf(r)}"><span class="due-d">${r.a.done ? '✓' : esc(dueTxt(r.d))}</span><span class="grow"><b>${esc(r.a.obj || r.a.type)}</b><small>${esc(r.L.e || '')} ${esc(r.L.name)} · ${esc(r.niv)}${r.a.zone ? ' · ' + esc(r.a.zone) : ''} · ${esc(r.a.type)}${r.a.by ? ' · ' + esc(r.a.by) : ''}${p.mo ? ' · ' + esc(p.mo) : ''}</small></span><em>${fmtDate(r.a.d)}${nxOf(r) ? `<br>🔔 ${nxOf(r).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}</em></button>`).join('') || '<div class="empty">Aucune échéance pour ce choix.<br>Ajoutez-les dans Plans › niveau › lot › Échéance.</div>'}</div>
      </div>`;
    ($('[data-a=x]', el)||{}).onclick = close;
    ($('[data-a=notif]', el)||{}).onclick = () => dueNotifSettings(p);
    $$('[data-f]', el).forEach(s => s.onchange = () => { F[s.dataset.f] = s.value; draw(); });
    $$('[data-st]', el).forEach(b => b.onclick = () => { F.st = F.st === b.dataset.st ? '' : b.dataset.st; draw(); });
    const qi = $('.due-q', el); let t; qi.oninput = () => { clearTimeout(t); t = setTimeout(() => { F.q = qi.value.trim(); draw(); setTimeout(() => { const q2 = $('.due-q', el); if (q2) { q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); } }, 0); }, 350); };
    $$('[data-i]', el).forEach(b => b.onclick = async () => { const r = rows[+b.dataset.i]; close();
      if (r.pt) { const pl = await DB.get('plans', r.pt.planId); if (!pl) return toast('Plan supprimé'); return openPlanViewer(pl, { ...planCtx(() => renderSection()), focus: { x: r.pt.x, y: r.pt.y } }); } App.lotSel = App.lotSel || {}; App.lotSel[r.f.id] = r.L.id; App.openFolders = App.openFolders || {}; App.openFolders[r.f.id] = true; App.scrollFolder = r.f.id; lotOpenSet(r.L, true); lpTabSet(r.L, 'due'); App.section = 'plans'; App.search = ''; renderSection(); });
    ($('[data-a=pdf]', el)||{}).onclick = async () => {
      if (!window.jspdf && window.__late) await window.__late; if (!window.jspdf) return toast('Module PDF indisponible');
      const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' }), W = 297, M = 10; let y = 18;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(`Tableau des échéances · ${p.name}`.slice(0, 90), M, 12); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(fmtDate(todayISO()), W - M, 12, { align: 'right' });
      const C = [[M, 'État'], [M + 24, 'Objet'], [M + 104, 'Lot'], [M + 144, 'Niveau'], [M + 170, 'Zone'], [M + 196, 'Type'], [M + 236, 'Date']];
      const head = () => { doc.setFillColor(15, 37, 64); doc.rect(M, y - 4.5, W - 2 * M, 7, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); C.forEach(([x, t]) => doc.text(t, x + 1, y)); doc.setTextColor(30); doc.setFont('helvetica', 'normal'); y += 7; };
      head();
      for (const r of R) { if (y > 195) { doc.addPage(); y = 14; head(); } const s = stOf(r); doc.setTextColor(...(s === 'retard' ? [200, 30, 30] : s === 'bientot' ? [217, 119, 6] : s === 'fait' ? [22, 128, 61] : [40, 40, 40]));
        doc.text(r.a.done ? 'Fait' : dueTxt(r.d), C[0][0] + 1, y); doc.setTextColor(30);
        [[1, r.a.obj || r.a.type, 46], [2, r.L.name, 22], [3, r.niv, 14], [4, r.a.zone || '—', 14], [5, r.a.type, 22], [6, fmtDate(r.a.d), 18]].forEach(([i, t, n]) => doc.text(String(t).slice(0, n), C[i][0] + 1, y));
        doc.setDrawColor(226); doc.line(M, y + 2, W - M, y + 2); y += 7; }
      await shareBlob(doc.output('blob'), avFileName(`Échéances ${p.name} ${todayISO()}`) + '.pdf');
    };
  };
  draw();
}

// ================= v1.0.67 : notifications des échéances / alertes sur le téléphone =================
// Vous choisissez : activées ou non, l'heure, le rappel par défaut (le jour même, 1 j, 2 j, 3 j, 1 semaine avant), un rappel si la date est dépassée,
// et quels types d'alertes ; chaque échéance peut avoir son propre rappel et sa propre heure. Notifications datées (« at »), jamais répétées automatiquement.
const DUE_REM = [['', 'Par défaut'], ['none', 'Pas de rappel'], ['0', 'Le jour même'], ['1', '1 jour avant'], ['2', '2 jours avant'], ['3', '3 jours avant'], ['7', '1 semaine avant']];
const dueNCfg = (p) => { let o = null; try { o = JSON.parse(localStorage.getItem('dueN.' + p.id) || 'null'); } catch (e) {} return { on: true, time: '08:00', before: '1', late: true, types: null, ch: '', snd: '', sndT: '', ...(o || {}) }; };
const dueNCh = (C) => C.ch || 'rappels';   // v1.0.69 : canal avec la sonnerie choisie
const dueNSave = (p, o) => { try { localStorage.setItem('dueN.' + p.id, JSON.stringify(o)); } catch (e) {} };
// v1.0.69 : rappel « dans 1 minute » mémorisé avec son heure : reprogrammé tant qu'il n'est pas passé (avant : annulé par la reprogrammation suivante)
const dueNOnce = (p, id) => { try { const v = (JSON.parse(localStorage.getItem('dueN.once.' + p.id) || '{}'))[id]; return v && v.slice(0, 10) === todayISO() ? new Date(v) : null; } catch (e) { return null; } };
const dueNMark = (p, id, at) => { try { const o = JSON.parse(localStorage.getItem('dueN.once.' + p.id) || '{}'); o[id] = at.toISOString(); localStorage.setItem('dueN.once.' + p.id, JSON.stringify(o)); } catch (e) {} };
const dueNId = (s) => 1700000000 + (Math.abs([...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % 90000000);
async function dueSchedule(p) {
  const LN = window.Capacitor?.Plugins?.LocalNotifications; if (!LN || window.__safe || !p) return 0;
  const C = dueNCfg(p), key = 'dueN.ids.' + p.id; let old = []; try { old = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
  if (old.length) await LN.cancel({ notifications: old.map(id => ({ id })) }).catch(() => {});
  if (!C.on) { try { localStorage.setItem(key, '[]'); } catch (e) {} return 0; }
  const now = new Date(), N = [];
  for (const f of await DB.byProject('folders', p.id)) for (const L of planLots(p)) { const D = (f.lotData || {})[L.id]; if (!D) continue;
    for (const a of lotAlerts(D)) { if (a.done || !a.d) continue; if (C.types && !C.types.includes(a.main ? 'Échéance MO' : a.type)) continue;
      const rem = a.main ? (D._dueRem || '') : (a.rem || ''); if (rem === 'none') continue;
      const before = +(rem === '' ? C.before : rem) || 0, hm = ((a.main ? D._dueHr : a.hr) || C.time || '08:00').split(':').map(Number), niv = nivOfFolder(f.name) || f.name;
      const what = `${a.obj || a.type} · ${L.name} · ${niv}${a.zone ? ' · ' + a.zone : ''}`;
      const at = new Date(a.d + 'T00:00:00'); at.setDate(at.getDate() - before); at.setHours(hm[0] || 8, hm[1] || 0, 0, 0);
      // v1.0.68 : si l'heure du rappel « avant » est déjà passée, rappel le jour même à l'heure choisie ; échéance aujourd'hui et heure passée → dans 1 minute
      const atDay = new Date(a.d + 'T00:00:00'); atDay.setHours(hm[0] || 8, hm[1] || 0, 0, 0);
      if (at > now) N.push({ id: dueNId(f.id + L.id + a.id + 'r'), title: before ? `⏳ Échéance dans ${before} j (${fmtDate(a.d)})` : `⏳ Échéance aujourd'hui`, body: what, at });
      else if (before && atDay > now) N.push({ id: dueNId(f.id + L.id + a.id + 'r'), title: `⏳ Échéance aujourd'hui`, body: what, at: atDay });
      else if (a.d === todayISO()) { const o = dueNOnce(p, a.id + (a.hr || D._dueHr || '') + rem); if (!o) N.push({ id: dueNId(f.id + L.id + a.id + 'r'), title: `⏳ Échéance aujourd'hui`, body: what, at: new Date(now.getTime() + 60000), once: a.id + (a.hr || D._dueHr || '') + rem }); else if (o > now) N.push({ id: dueNId(f.id + L.id + a.id + 'r'), title: `⏳ Échéance aujourd'hui`, body: what, at: o }); }
      if (C.late) { const lt = new Date(a.d + 'T00:00:00'); lt.setDate(lt.getDate() + 1); lt.setHours(hm[0] || 8, hm[1] || 0, 0, 0); if (lt <= now) { lt.setTime(now.getTime()); lt.setDate(lt.getDate() + 1); lt.setHours(hm[0] || 8, hm[1] || 0, 0, 0); }
        N.push({ id: dueNId(f.id + L.id + a.id + 'l'), title: `🔴 En retard (prévu le ${fmtDate(a.d)})`, body: what, at: lt }); } } }
  N.sort((x, y) => x.at - y.at); const S = N.slice(0, 60);
  // v1.0.68 : canal « Rappels de chantier » créé et autorisation demandée avant de programmer (sinon Android n'affiche rien)
  try { const ps = await LN.checkPermissions().catch(() => null); if (!ps || ps.display !== 'granted') await LN.requestPermissions().catch(() => {}); await LN.createChannel({ id: 'rappels', name: 'Rappels de chantier', description: 'Échéances et rappels', importance: 5, visibility: 1, vibration: true, lights: true }).catch(() => {}); } catch (e) {}
  for (const n of S) if (n.once) dueNMark(p, n.once, n.at);
  try { if (S.length) await LN.schedule({ notifications: S.map(n => ({ id: n.id, title: n.title, body: n.body, channelId: dueNCh(C), extra: { action: 'due', pid: p.id }, schedule: { at: n.at, allowWhileIdle: true } })) }); localStorage.setItem(key, JSON.stringify(S.map(n => n.id))); } catch (e) { console.warn('dueN', e); }
  return S.length;
}
async function dueNotifSettings(p) {
  const C = dueNCfg(p), LN = window.Capacitor?.Plugins?.LocalNotifications;
  const r = await formSheet('🔔 Notifications des échéances', [
    { name: 'on', label: 'Notifications sur ce téléphone', type: 'select', value: C.on ? 'o' : 'n', options: [{ value: 'o', label: 'Activées' }, { value: 'n', label: 'Désactivées' }] },
    { name: 'time', label: 'Heure des notifications', type: 'time', value: C.time },
    { name: 'before', label: 'Rappel par défaut', type: 'select', value: C.before, options: DUE_REM.filter(([v]) => v !== '' && v !== 'none').map(([value, label]) => ({ value, label })) },
    { name: 'late', label: 'Si la date est dépassée', type: 'select', value: C.late ? 'o' : 'n', options: [{ value: 'o', label: 'Me le rappeler (le lendemain)' }, { value: 'n', label: 'Rien' }] },
    { name: 'snd', label: `🎵 Sonnerie : ${C.sndT || 'par défaut du téléphone'}`, type: 'select', value: 'k', options: [{ value: 'k', label: 'Garder' }, { value: 'pick', label: '🎵 Choisir une sonnerie du téléphone…' }, { value: 'def', label: 'Sonnerie par défaut' }, { value: 'set', label: '⚙️ Réglages Android (vibration, écran verrouillé…)' }] },
    { name: 'test', label: 'Essai', type: 'select', value: 'n', options: [{ value: 'n', label: '—' }, { value: 'o', label: '🔔 M\'envoyer une notification d\'essai (dans 10 secondes)' }] },
  ], { okLabel: 'Enregistrer', intro: '<p class="muted" style="margin:0">Chaque échéance peut aussi avoir son propre rappel et sa propre heure (dans la fiche de l\'échéance).</p>' });
  if (!r) return;
  const G = window.Capacitor?.Plugins?.GDriveAuth;
  if (r.snd === 'pick') { if (!G || !G.pickSound) toast('Choix de sonnerie : mettez à jour l\'application'); else { try { const s = await G.pickSound({ current: C.snd || '' }); C.ch = s.channel; C.snd = s.uri; C.sndT = s.title; dueNSave(p, C); toast(`🎵 Sonnerie : ${s.title}`); } catch (e) { if (!/CANCEL/i.test(String(e && (e.code || e.message)))) alertBox('Sonnerie : ' + (e.message || e)); } } }
  if (r.snd === 'def') { C.ch = ''; C.snd = ''; C.sndT = ''; dueNSave(p, C); }
  if (r.snd === 'set' && G && G.openNotifSettings) { try { await G.openNotifSettings({ channel: dueNCh(C) }); } catch (e) {} }
  if (r.test === 'o' && LN) { try { const perm = await LN.requestPermissions(); if (perm.display !== 'granted') return alertBox('Notifications refusées : Réglages du téléphone › Applications › SiteTeam › Notifications › Autoriser.');
    await LN.createChannel({ id: 'rappels', name: 'Rappels de chantier', importance: 5, visibility: 1, vibration: true }).catch(() => {});
    await LN.schedule({ notifications: [{ id: 1699999999, title: '🔔 Essai SiteTeam', body: `Les notifications des échéances fonctionnent ✓ · ${C.sndT || 'sonnerie par défaut'}`, channelId: dueNCh(C), schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true } }] }); toast('Notification d\'essai dans 10 secondes — fermez l\'application pour la voir'); } catch (e) { alertBox('Essai impossible : ' + (e.message || e)); } }
  Object.assign(C, dueNCfg(p), { on: r.on === 'o', time: r.time || '08:00', before: r.before || '1', late: r.late === 'o' });
  // types d'alertes notifiées
  const all = LOT_AL_TYPES.slice(); let T = new Set(C.types || all);
  for (;;) { const v = await menu('Quelles alertes notifier ?', [...all.map(t => ({ label: t, value: t, checked: T.has(t) })), { label: '✓ Terminé', value: '__ok' }]); if (!v || v === '__ok') break; T.has(v) ? T.delete(v) : T.add(v); }
  C.types = T.size === all.length ? null : [...T]; dueNSave(p, C);
  if (C.on && LN) { try { const perm = await LN.requestPermissions(); if (perm.display !== 'granted') return alertBox('Autorisez les notifications de SiteTeam dans les réglages du téléphone.'); await LN.createChannel({ id: 'rappels', name: 'Rappels de chantier', importance: 5, visibility: 1, vibration: true }).catch(() => {}); } catch (e) {} }
  const n = await dueSchedule(p);
  if (!C.on) return toast('🔕 Notifications des échéances désactivées');
  let L = []; try { const pend = await LN.getPending(); L = (pend.notifications || []).filter(x => x.id >= 1700000000 && x.id < 1790000000).map(x => x.schedule && x.schedule.at ? `• ${new Date(x.schedule.at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} — ${x.title}` : '').filter(Boolean); } catch (e) {}
  alertBox(`🔔 ${n} notification(s) programmée(s)${L.length ? '\n\n' + L.slice(0, 12).join('\n') : ''}\n\nSur Huawei : Réglages › Batterie › Lancement d'applications › SiteTeam › Gérer manuellement (activer les 3 options), sinon le téléphone peut bloquer les rappels.`);
}
