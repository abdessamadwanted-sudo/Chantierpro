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
function planLots(p) {
  if (!p.planLots) p.planLots = LOTS_DEF.map(l => ({ ...l, points: l.id === 'go' ? LOT_GO_POINTS.map(t => ({ id: DB.uid(), t })) : [] }));
  return p.planLots;
}
const lotSelOf = (fid) => (App.lotSel || {})[fid] || '';
// v1.0.50 : plus de « Tous » — un lot est toujours choisi (le 1er qui a des plans) ; « Sans lot » seulement s'il reste des plans sans lot
function lotSelDefault(f, ps) {
  App.lotSel = App.lotSel || {}; const cur = App.lotSel[f.id], lots = planLots(App.project);
  if (cur && (cur === '__all' || (typeof cur === 'string' && cur.startsWith('T:')) || (cur === '__none' ? ps.some(x => !x.lotId) : lots.some(l => l.id === cur)))) return cur;   // v1.0.98 : « Tous les lots »
  const L = lots.find(l => ps.some(x => x.lotId === l.id)); const d = L ? L.id : ps.some(x => !x.lotId) ? '__none' : (lots[0] || {}).id || '';
  App.lotSel[f.id] = d; return d;
}
const nivOfFolder = (name) => { const m = String(name || '').replace(/_/g, ' ').replace(/niveau|niv\.?(?=\s*[rR\d])/gi, ' ').match(/\b(R\s?\+\s?\d+|RDC|SSL|SS\s?\d?|Mezz\w*|Terrasse|Fondations?)\b/i); return m ? m[1].replace(/\s+/g, '').replace(/^mezz\w*/i, 'Mezz') : ''; };
// v1.0.97 : disciplines d'un niveau (plans d'exécution)
const DISCIPLINES = [
  { k: 'ARCH', l: 'Architecture (ARCH)' }, { k: 'STR', l: 'Structure / béton armé (STR)' }, { k: 'VRD', l: 'VRD' },
  { k: 'CFO', l: 'Électricité CFO' }, { k: 'CFA', l: 'Électricité CFA' }, { k: 'PLB', l: 'Plomberie / sanitaire (PLB)' },
  { k: 'CVC', l: 'CVC' }, { k: 'SSI', l: 'Sécurité incendie (SSI)' }, { k: 'CM', l: 'Charpente métallique (CM)' },
  { k: 'ETA', l: 'Étanchéité (ETA)' }, { k: 'PAY', l: 'Aménagement / paysage (PAY)' }, { k: 'SYN', l: 'Synthèse (SYN)' },
];
// v1.0.101 : types de lots = types fixes + types ajoutés par le projet (p.lotTypes)
const typesOf = (p) => [...DISCIPLINES, ...((p && p.lotTypes) || [])];
const typeLab = (k, p) => (typesOf(p || App.project).find(d => d.k === k) || { l: k }).l;
const discLabel = (f) => !f || !f.disc ? '' : f.disc === '_free' ? (f.discName || 'Autre') : ((DISCIPLINES.find(d => d.k === f.disc) || {}).l || f.disc);
const tint = (c, a) => c + Math.round(a * 255).toString(16).padStart(2, '0');

// barre de lots + panneau du lot choisi, insérés dans la carte du dossier
function lotBarInto(card, f, ps, root) {
  const p = App.project, lots = planLots(p), sel = lotSelDefault(f, ps);
  const cnt = (id) => ps.filter(x => x.lotId === id).length, nNo = ps.filter(x => !x.lotId).length;
  const avB = (L) => { try { return typeof avLotBadge === 'function' && App._avLinks ? avLotBadge(p, L, f, App._avLinks) : ''; } catch (e) { return ''; } };
  const bar = document.createElement('div'); bar.className = 'lot-bar';
  // v1.0.80 : les lots ne sont plus alignés dans le bandeau ; on n'affiche que le lot choisi + une liste déroulante
  const lotBtn = (l) => { const D = (f.lotData || {})[l.id] || {}, di = dueInfo(D), po = lotStarted(l, D) ? paOpen(l, D).length : 0;
    return `<button class="lot-c on" data-l="${l.id}" style="--c:${l.c};--t:${tint(l.c, .16)}">${l.e} ${esc(l.name)}${cnt(l.id) ? ` <small>${cnt(l.id)}</small>` : ''}${po ? `<i class="lc-pa">🛑${po}</i>` : ''}${di && di.cls !== 'ok' ? `<i class="lc-due ${di.cls}">⏳</i>` : ''}${avB(l)}</button>`; };
  const curL = lots.find(l => l.id === sel);
  const curHtml = curL ? lotBtn(curL) : sel === '__all' ? `<button class="lot-c on" data-l="__all" style="--c:#334155">📚 Tous les lots <small>${ps.length}</small></button>` : sel === '__none' ? `<button class="lot-c on" data-l="__none" style="--c:#64748b">📄 Sans lot <small>${nNo}</small></button>` : '';
  // v1.0.102 : une seule commande « Lots ▾ » sur le bandeau ; la liste (par type) s'ouvre dessous
  // v1.0.104 : le bouton du bandeau affiche l'endroit où vous êtes (type ou lot), la liste s'ouvre juste en dessous
  const where = sel && sel.startsWith('T:') ? typeLab(sel.slice(2), p) : sel === '__all' ? 'Tous les types (TOUT)' : sel === '__none' ? 'Sans lot' : curL ? `${curL.e} ${curL.name}${curL.cat ? ' · ' + typeLab(curL.cat, p) : ''}` : 'Lots';
  bar.innerHTML = `<button type="button" class="lot-c lot-pickbtn">▾ ${esc(where)} <small>${lots.length}</small></button>`;
  const pickBtn = bar.querySelector('.lot-pickbtn');
  pickBtn.onclick = (e) => { e.stopPropagation(); const old = $('.lot-pick', card); if (old) { old.remove(); return; }
    const list = document.createElement('div'); list.className = 'lot-pick';
    // v1.0.101 : lots en accordéon par type (« Tous » + chaque type + « Sans catégorie »)
    const types = typesOf(p);
    App.lotAcc = App.lotAcc || {};
    const curCat = ((lots.find(l => l.id === sel)) || {}).cat || '';
    const accKey = (k) => f.id + ':' + k;
    const isOpen = (k) => App.lotAcc[accKey(k)] !== undefined ? !!App.lotAcc[accKey(k)] : (k === curCat && sel !== '__all' && sel !== '__none');
    const btn = (l) => `<button type="button" class="lp-i ${sel === l.id ? 'on' : ''}" data-lp="${l.id}" style="--c:${l.c}">${l.e} ${esc(l.name)}${cnt(l.id) ? ` <small>${cnt(l.id)}</small>` : ''}</button>`;
    // v1.0.105 : « Tous » contient des sous-menus par type ; les lots sont en grille compacte
    const tsec = (k, lab, xs, nested) => { const op = isOpen(nested), viewK = 'T:' + k;
      return `<button type="button" class="lp-acc sub ${op ? 'open' : ''}" data-acc="${esc(nested)}"><span>${op ? '▾' : '▸'} ${esc(lab)}</span><small>${xs.length}</small></button>` + (op ? `<div class="lp-body"><button type="button" class="lp-i view ${sel === viewK ? 'on' : ''}" data-lp="${viewK}">▦ Voir tous les plans</button><div class="lp-grid">${xs.length ? xs.map(btn).join('') : '<div class="lp-empty">Aucun lot dans ce type</div>'}</div></div>` : ''); };
    const sec = (k, lab, xs, cls = '') => { const op = isOpen(k), viewK = k === '__all' ? '__all' : k ? 'T:' + k : '';
      const inner = k === '__all' ? types.map(t => tsec(t.k, t.l, lots.filter(l => (l.cat || '') === t.k), 'all/' + t.k)).join('') : `<div class="lp-grid">${xs.length ? xs.map(btn).join('') : '<div class="lp-empty">Aucun lot dans ce type</div>'}</div>`;
      return `<button type="button" class="lp-acc ${cls} ${op ? 'open' : ''}" data-acc="${esc(k)}"><span>${op ? '▾' : '▸'} ${esc(lab)}</span><small>${xs.length}</small></button>` + (op ? `<div class="lp-body">${viewK ? `<button type="button" class="lp-i view ${sel === viewK ? 'on' : ''}" data-lp="${viewK}">▦ Voir tous les plans (${xs.length} lot${xs.length > 1 ? 's' : ''})</button>` : ''}${inner}</div>` : ''); };
    const draw = () => {
      const noCat = lots.filter(l => !l.cat);
      list.innerHTML = sec('__all', 'Tous les types (TOUT)', lots, 'all') + types.map(t => sec(t.k, t.l, lots.filter(l => (l.cat || '') === t.k))).join('') + (noCat.length ? sec('', 'Sans catégorie', noCat) : '')
        + (nNo ? `<button type="button" class="lp-i ${sel === '__none' ? 'on' : ''}" data-lp="__none">📄 Sans lot <small>${nNo}</small></button>` : '')
        + `<div class="lp-foot"><button type="button" class="lp-i add" data-lp="__add">＋ Nouveau lot</button><button type="button" class="lp-i add" data-lp="__addtype">＋ Nouveau type</button></div>`;
      list.querySelectorAll('[data-acc]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const k = b.dataset.acc; App.lotAcc[accKey(k)] = !isOpen(k); draw(); });
      list.querySelectorAll('[data-lp]').forEach(x => {
        x.onclick = async (e) => { e.stopPropagation();
          if (x.dataset.lp === '__addtype') { const r = await formSheet('Nouveau type de lot', [{ name: 'n', label: 'Nom du type', placeholder: 'Ex : Second œuvre' }], { okLabel: 'Ajouter' }); if (!r || !r.n) return;
            p.lotTypes = p.lotTypes || []; p.lotTypes.push({ k: 'T' + DB.uid(), l: r.n }); await DB.put('projects', p); renderPlans(root); return; }
          if (x.dataset.lp === '__add') { const r = await formSheet('Nouveau lot', [{ name: 'n', label: 'Nom', placeholder: 'Ex : Faux plafond' }, { name: 'e', label: 'Emoji', value: '🔧' }], { okLabel: 'Ajouter' }); if (r && r.n) { lots.push({ id: DB.uid(), name: r.n, e: r.e || '🔧', c: ['#0ea5e9', '#22c55e', '#f97316', '#8b5cf6', '#e11d48'][lots.length % 5], points: [] }); await DB.put('projects', p); renderPlans(root); } return; }
          App.lotSel = App.lotSel || {}; App.lotSel[f.id] = x.dataset.lp; App.keepScrollY = ($('#content') || {}).scrollTop || 0; renderPlans(root);
        };
        const L = lots.find(l => l.id === x.dataset.lp); if (L) x.oncontextmenu = (e) => { e.preventDefault(); lotMenu(L, root); };
      });
    };
    draw();
    bar.after(list); };
  const head = $('.folder-head', card); head.after(bar);
  // v1.0.102 : glisser à gauche / à droite dans le dossier = lot suivant / précédent (« Tous » compris)
  if (!card._swipe) { card._swipe = true; let x0 = null, y0 = 0;
    card.addEventListener('touchstart', (e) => { if (e.touches.length !== 1 || e.target.closest('.lot-pick, .lot-panel')) { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    card.addEventListener('touchend', (e) => { if (x0 == null) return; const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
      if (Math.abs(dx) < 70 || Math.abs(dy) > 40) return;
      const LL = planLots(App.project), cur = lotSelDefault(f, ps), idx = LL.findIndex(l => l.id === cur), n = LL.length; if (!n) return;
      const ni = cur === '__all' ? (dx < 0 ? 0 : n - 1) : (((idx < 0 ? 0 : idx) + (dx < 0 ? 1 : -1)) % n + n) % n;
      App.lotSel = App.lotSel || {}; App.lotSel[f.id] = LL[ni].id; App.keepScrollY = ($('#content') || {}).scrollTop || 0; renderPlans(root); }, { passive: true }); }
  if (App.reopenPick === f.id) { App.reopenPick = null; setTimeout(() => pickBtn.onclick({ stopPropagation() {} }), 0); }
  $$('[data-l]', bar).forEach(b => { if (b.dataset.l && b.dataset.l !== '__none') b.oncontextmenu = (e) => { e.preventDefault(); lotMenu(lots.find(l => l.id === b.dataset.l), root); }; });
  bar.querySelectorAll('[data-l]').forEach(b => b.onclick = (e) => pickBtn.onclick(e));   // toucher le lot choisi ouvre la liste
  if (sel) { const L = lots.find(l => l.id === sel); if (L) bar.after(lotPanel(L, f, root)); }
}
const lotFilter = (ps, f) => { const s = lotSelDefault(f, ps); if (s && s.startsWith('T:')) { const k = s.slice(2), ids = planLots(App.project).filter(l => (l.cat || '') === k).map(l => l.id); return ps.filter(p => ids.includes(p.lotId)); } return s === '__all' ? ps : s === '__none' ? ps.filter(p => !p.lotId) : s ? ps.filter(p => p.lotId === s) : ps; };

// panneau du lot : replié par défaut (une ligne), on l'ouvre au toucher ; « ＋ Ajouter » pour y mettre ce qu'il faut
const lotOpenK = (L) => { try { return (JSON.parse(localStorage.getItem('lot.open') || '{}'))[L.id]; } catch (e) { return false; } };
const lotOpenSet = (L, v) => { try { const o = JSON.parse(localStorage.getItem('lot.open') || '{}'); o[L.id] = v; localStorage.setItem('lot.open', JSON.stringify(o)); } catch (e) {} };
const LOT_GS = [['bpu', '📑 BPU'], ['att', '📐 Attachements'], ['dec', '🧾 Décompte'], ['stock', '📦 Stock']];
function lotPanel(L, f, root) {
  const p = App.project, niv = nivOfFolder(f.name);
  f.lotData = f.lotData || {}; const D = f.lotData[L.id] = f.lotData[L.id] || {};
  const av = (p.lots || []).find(x => normQ(x.name) === normQ(L.name));
  const done = (L.points || []).filter(x => (D[x.id] || {}).done).length, open = !!lotOpenK(L), po = paOpen(L, D).length, di = dueInfo(D);
  const sc = L.sc || [], docs = D._docs || [];
  const el = document.createElement('div'); el.className = 'lot-panel' + (open ? ' open' : ''); el.style.setProperty('--c', L.c); el.style.setProperty('--t', tint(L.c, .12));
  el.innerHTML = `<div class="lp-h" data-a="tog"><span class="lp-e">${L.e}</span><div class="grow"><b>${esc(L.name)}</b><small>${esc(f.name)}${(L.points || []).length ? ` · ${done}/${L.points.length} points` : ''}${po ? ` · 🛑 ${po}` : ''}${di ? ` · ⏳ ${di.txt}` : ''}</small></div><button class="iconbtn sm" data-a="lm">${icon('more')}</button><span class="lp-chev">${icon('chevdown')}</span></div>
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
      ${(L.rub || []).length || sc.length ? '<div class="lp-gh">Rubriques & raccourcis</div>' : ''}
      ${(L.rub || []).map(R => `<button data-rub="${R.id}"><i>${esc(R.e)}</i><span>${esc(R.name)}<small>${(((f.lotData || {})[L.id] || {})._rub || {})[R.id] && f.lotData[L.id]._rub[R.id].length ? f.lotData[L.id]._rub[R.id].length + ' ligne(s)' : 'tableau'}</small></span></button>`).join('')}
      ${sc.map((x, i) => `<button data-sc="${i}"><i>${SC_EMO && SC_EMO[x.sec] ? SC_EMO[x.sec] : '🔗'}</i><span>${esc(x.label)}<small>raccourci</small></span></button>`).join('')}
      <button data-a="rubnew" class="lp-rubnew"><i>＋</i><span>Rubrique<small>tableau + Excel</small></span></button>
    </div>
    ${docs.length ? `<div class="lp-docs">${docs.map((d, i) => `<div class="lp-doc"><button class="grow" data-doc="${i}">${icon(d.url && !d.fileId ? 'drive' : d.planId ? 'plans' : 'pdf')}<span>${esc(d.name)}</span></button><button class="iconbtn sm" data-docm="${i}">${icon('more')}</button></div>`).join('')}</div>` : ''}
    <details class="lp-det" ${App.lotDet ? 'open' : ''}><summary>☑ Points de contrôle ${done}/${(L.points || []).length} · notes</summary>
    <div class="lp-pts">${(L.points || []).map(x => { const v = D[x.id] || {}; return `<button class="lp-pt ${v.done ? 'on' : ''}" data-pt="${x.id}"><i>${v.done ? '☑' : '☐'}</i><span class="grow">${esc(x.t)}${v.at ? `<small>${fmtDate(v.at)}</small>` : ''}</span></button>`; }).join('')}
      <button class="lp-add" data-a="addpt">${icon('plus')} Point de contrôle (pour tous les niveaux)</button></div>
    <label class="lp-note">Notes ${esc(L.name)} · ${esc(f.name)}<textarea placeholder="Remarques, besoins, matériel…">${esc(D._note || '')}</textarea></label></details>
    <button class="lp-plus" data-a="plus">${icon('plus')} Ajouter dans ${esc(L.name)}</button></div>`}`;
  const save = () => DB.put('folders', f), redraw = () => renderPlans(root);
  ($('[data-a=tog]', el)||{}).onclick = (e) => { if (e.target.closest('[data-a=lm]')) return; lotOpenSet(L, !open); App.keepScrollY = ($('#content') || {}).scrollTop || 0; redraw(); };
  ($('[data-a=lm]', el)||{}).onclick = (e) => { e.stopPropagation(); lotMenu(L, root); };
  if (!open) return el;
  // v1.0.47 : lien direct vers l'avancement de CE lot sur CE niveau (alertes, dates, équipes, saisies, ✓ terminé)
  let avEl = null, pnEl = null;
  { const sl = $('.lp-avslot', el); if (sl && typeof avLotPanelBlock === 'function') { avEl = avLotPanelBlock(p, L, f, redraw); sl.replaceWith(avEl); } }
  // v1.0.53 : pins photos du lot sur ce niveau (dossiers Porte provisoire, Brique, Nettoyage… ; PDF 4 photos par page)
  { const ls = $('.lp-links', el); if (ls && typeof pnLotBlock === 'function') { pnEl = pnLotBlock(p, L, f, redraw); ls.before(pnEl); } }
  $('.lp-det', el).ontoggle = (e) => { App.lotDet = e.target.open; };
  $$('[data-pt]', el).forEach(b => b.onclick = async () => { const v = D[b.dataset.pt] = D[b.dataset.pt] || {}; v.done = !v.done; v.at = v.done ? todayISO() : null; await save(); redraw(); });
  const addPt = async () => { const r = await formSheet(`Point de contrôle · ${L.name}`, [{ name: 't', label: 'Intitulé (ajouté à tous les niveaux)', placeholder: 'Ex : Réservations vérifiées' }], { okLabel: 'Ajouter' }); if (r && r.t) { L.points = L.points || []; L.points.push({ id: DB.uid(), t: r.t }); App.lotDet = true; await DB.put('projects', p); redraw(); } };
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
  ($('[data-a=rubnew]', el)||{}).onclick = async () => { const R = await rubNew(p, L); if (R) { await rubOpen(p, L, f, R); redraw(); } };
  $$('[data-doc]', el).forEach(b => b.onclick = () => pbOpenDoc(docs[+b.dataset.doc], { projectId: p.id }, planCtx(() => {})));
  $$('[data-docm]', el).forEach(b => b.onclick = async () => { const i = +b.dataset.docm, d = docs[i];
    const v = await menu(d.name, [{ label: 'Ouvrir', icon: 'pdf', value: 'open' }, { label: 'Renommer', icon: 'edit', value: 'ren' }, { label: 'Monter', icon: 'chevup', value: 'up' }, { label: 'Retirer', icon: 'trash', danger: true, value: 'del' }]);
    if (v === 'open') pbOpenDoc(d, { projectId: p.id }, planCtx(() => {}));
    if (v === 'ren') { const r = await formSheet('Renommer', [{ name: 'n', label: 'Nom', value: d.name }]); if (r && r.n) { d.name = r.n; await save(); redraw(); } }
    if (v === 'up' && i > 0) { [docs[i - 1], docs[i]] = [docs[i], docs[i - 1]]; await save(); redraw(); }
    if (v === 'del' && await confirmBox('Retirer ce document ?')) { if (d.fileId) await DB.del('files', d.fileId); docs.splice(i, 1); await save(); redraw(); } });
  // ＋ Ajouter : ce qu'il faut dans ce lot
  ($('[data-a=plus]', el)||{}).onclick = async () => {
    const v = await menu(`Ajouter dans ${L.e} ${L.name}`, [{ label: '☑ Point de contrôle (tous les niveaux)', icon: 'check', value: 'pt' }, { label: '🛑 Point d\'arrêt', icon: 'close', value: 'pa' }, { label: '⚠️ Point critique', icon: 'ask', value: 'pc' },
      { label: '🗂 Nouvelle rubrique (tableau + Excel)', icon: 'grid', value: 'rub' }, { label: '🔗 Raccourci vers une section', icon: 'layers', value: 'sc' }, { label: `📄 Document / plan (${f.name})`, icon: 'pdf', value: 'doc' }, { label: '📝 Note', icon: 'edit', value: 'note' }]);
    if (v === 'pt') addPt();
    if (v === 'rub') { const R = await rubNew(p, L); if (R) { await rubOpen(p, L, f, R); redraw(); } }
    if (v === 'pa' || v === 'pc') { const b = $(v === 'pa' ? '[data-a=addpa]' : '[data-a=addpc]', el); if (b) b.click(); }
    if (v === 'sc') { const secs = Object.entries(SECTIONS).filter(([k, S]) => !S.hidden && k !== 'settings' && (!SECTION_FEATURE[k] || featOn(SECTION_FEATURE[k])));
      const k = await menu('Raccourci vers…', secs.map(([k2, S]) => ({ label: `${(SC_EMO && SC_EMO[k2]) || '📁'} ${S.label}`, value: k2 }))); if (!k) return;
      L.sc = L.sc || []; L.sc.push({ sec: k, label: SECTIONS[k].label.split(' (')[0] }); await DB.put('projects', p); toast('Raccourci ajouté (pour tous les niveaux) ✓'); redraw(); }
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
      ['pts', '☑', 'Contrôle', [q('.lp-det:not(.lp-pa)')].filter(Boolean), `${done}/${(L.points || []).length}`],
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
async function lotMenu(L, root) {
  const p = App.project, lots = planLots(p), i = lots.indexOf(L);
  const v = await menu(`${L.e} ${L.name}`, [{ label: 'Renommer / emoji', icon: 'edit', value: 'ren' }, { label: 'Couleur', icon: 'brush', value: 'col' }, { label: 'Catégorie' + (L.cat ? ' · ' + typeLab(L.cat, App.project) : ''), icon: 'layers', value: 'cat' }, { label: '← Déplacer à gauche', icon: 'back', value: 'l' }, { label: 'Déplacer à droite →', icon: 'chevright', value: 'r' }, { label: 'Points de contrôle…', icon: 'check', value: 'pts' }, { label: 'Supprimer le lot', icon: 'trash', danger: true, value: 'del' }]);
  if (v === 'ren') { const r = await formSheet('Lot', [{ name: 'n', label: 'Nom', value: L.name }, { name: 'e', label: 'Emoji', value: L.e }]); if (r && r.n) { L.name = r.n; L.e = r.e || L.e; } }
  if (v === 'cat') { const k = await menu('Catégorie du lot', [...typesOf(App.project).map(d => ({ label: d.l, value: d.k, checked: L.cat === d.k })), { label: 'Aucune', value: '', checked: !L.cat }]); if (k !== null && k !== undefined) L.cat = k; }
  if (v === 'col') { const c = await menu('Couleur', ['#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#3b82f6', '#eab308', '#14b8a6', '#b45309', '#ec4899', '#64748b', '#22c55e', '#0ea5e9'].map(c => ({ label: c, swatch: c, value: c }))); if (c) L.c = c; }
  if ((v === 'l' && i > 0) || (v === 'r' && i < lots.length - 1)) { const j = v === 'l' ? i - 1 : i + 1; [lots[i], lots[j]] = [lots[j], lots[i]]; }
  if (v === 'pts') { const id = await menu('Supprimer un point ?', (L.points || []).map(x => ({ label: x.t, icon: 'trash', value: x.id }))); if (id && await confirmBox('Supprimer ce point de tous les niveaux ?')) L.points = L.points.filter(x => x.id !== id); }
  if (v === 'del' && await confirmBox(`Supprimer le lot « ${L.name} » ? Les plans restent dans le dossier.`)) lots.splice(i, 1);
  if (v) { await DB.put('projects', p); renderPlans(root); }
}
async function planLotMenu(plan, root) {
  const lots = planLots(App.project);
  const v = await menu(`Lot du plan « ${plan.name} »`, [...lots.map(l => ({ label: `${l.e} ${l.name}`, icon: plan.lotId === l.id ? 'check' : 'layers', value: l.id })), { label: 'Aucun lot', icon: 'close', value: '__none' }]);
  if (!v) return;
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
  const F = { niv: pre.niv || '', lot: pre.lot || '', zone: '', type: '', st: '', q: '' };
  const el = document.createElement('div'); el.className = 'fullpage due-page'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove()); const close = () => { unBack(); el.remove(); };
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
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><div class="tb-title" style="flex:1"><b>Tableau des échéances</b><span>${esc(p.name)}${p.mo ? ' · ' + esc(p.mo) : ''}</span></div><button class="iconbtn" data-a="notif" title="Notifications">🔔</button><button class="iconbtn" data-a="pdf">${icon('pdf')}</button></div>
      <div class="due-body">
        <div class="due-k">${['retard', 'bientot', 'ok', 'fait'].map(k => `<button data-st="${k}" class="${F.st === k ? 'on' : ''} ${k}"><b>${cnt(k)}</b><small>${ST[k][0]} ${ST[k][1]}</small></button>`).join('')}</div>
        <input class="due-q" type="search" placeholder="🔍 Objet, lot, zone…" value="${esc(F.q)}">
        <div class="avf-bar">${sel('niv', 'Niveau', uniq(r => r.niv))}${sel('lot', 'Lot', uniq(r => r.L.name))}${sel('zone', 'Zone', uniq(r => r.a.zone))}${sel('type', 'Type', uniq(r => r.a.type))}</div>
        <div class="due-l">${R.map((r, i) => `<button class="due-r ${stOf(r)}" data-i="${rows.indexOf(r)}"><span class="due-d">${r.a.done ? '✓' : esc(dueTxt(r.d))}</span><span class="grow"><b>${esc(r.a.obj || r.a.type)}</b><small>${esc(r.L.e || '')} ${esc(r.L.name)} · ${esc(r.niv)}${r.a.zone ? ' · ' + esc(r.a.zone) : ''} · ${esc(r.a.type)}${r.a.by ? ' · ' + esc(r.a.by) : ''}</small></span><em>${fmtDate(r.a.d)}${nxOf(r) ? `<br>🔔 ${nxOf(r).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}</em></button>`).join('') || '<div class="empty">Aucune échéance pour ce choix.<br>Ajoutez-les dans Plans › niveau › lot › Échéance.</div>'}</div>
      </div>`;
    ($('[data-a=x]', el)||{}).onclick = close;
    ($('[data-a=notif]', el)||{}).onclick = () => dueNotifSettings(p);
    $$('[data-f]', el).forEach(s => s.onchange = () => { F[s.dataset.f] = s.value; draw(); });
    $$('[data-st]', el).forEach(b => b.onclick = () => { F.st = F.st === b.dataset.st ? '' : b.dataset.st; draw(); });
    const qi = $('.due-q', el); let t; qi.oninput = () => { clearTimeout(t); t = setTimeout(() => { F.q = qi.value.trim(); draw(); setTimeout(() => { const q2 = $('.due-q', el); if (q2) { q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); } }, 0); }, 350); };
    $$('[data-i]', el).forEach(b => b.onclick = () => { const r = rows[+b.dataset.i]; close(); App.lotSel = App.lotSel || {}; App.lotSel[r.f.id] = r.L.id; App.openFolders = App.openFolders || {}; App.openFolders[r.f.id] = true; App.scrollFolder = r.f.id; lotOpenSet(r.L, true); lpTabSet(r.L, 'due'); App.section = 'plans'; App.search = ''; renderSection(); });
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
