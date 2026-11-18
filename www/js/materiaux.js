// ================= Matériaux : suivi du ferraillage (tonnage théorique/réel par partie d'ouvrage et par diamètre, stock, alertes) =================
// Module autonome (pas dans Plans), réservé Pro et plus (flag « materiaux »). Extensible plus tard à d'autres matériaux (béton…) avec la même logique.
// Données (magasin « items » existant, un document par enregistrement → chaque appareil ajoute ses saisies sans écraser celles des autres) :
//   mta  article (partie d'ouvrage)  { id, projectId, nom, note, createdAt, by }
//   mtd  ligne diamètre (théorique)  { id, projectId, artId, diam, nbBarres, tonnage }
//   mtm  mouvement                  { id, projectId, type:'entree'|'sortie'|'chute'|'ajout', diam, tonnage, artId (sauf entree), bloc, zone, niv, axe, fil, note, bl, at, by }
// Règles : la liste des parties d'ouvrage n'est pas prédéfinie (ajout libre, comme les lots) ; la liste des diamètres aussi (HA6…HA25, saisie libre) ;
// la chute est enregistrée réellement à chaque mouvement (pas de pourcentage par défaut) ; le réel sorti = somme des mouvements « sortie » (hors chute/ajouts, montrés à part) ;
// l'écart compare le théorique au total réellement prélevé du stock (sortie + chute + ajouts) ; alerte dès 3 % d'écart ou quand un stock de diamètre approche l'épuisement.
const Materiaux = (() => {
  const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n || 0);
  const num = (v) => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(x) ? x : NaN; };
  const r3 = (x) => Math.round(x * 1e3) / 1e3;
  const DIAMS = ['HA6', 'HA8', 'HA10', 'HA12', 'HA14', 'HA16', 'HA20', 'HA25', 'HA32'];
  const SEUIL_ECART = 3;      // % — alerte d'écart théorique/réel
  const SEUIL_STOCK = 10;     // % du total entré — alerte « stock proche de l'épuisement »
  const mine = (all, pid) => all.filter(x => x.projectId === pid);
  const locLabel = (m) => [m.bloc, m.zone, m.niv, m.axe && 'Axe ' + m.axe, m.fil && 'Fil ' + m.fil].filter(Boolean).join(' · ') || '—';

  // ---- calculs purs (testés) ----
  // stock global par diamètre, toutes parties d'ouvrage confondues
  function calcStock(moves) {
    const by = {};
    for (const m of moves) { const d = m.diam || '?'; by[d] = by[d] || { entree: 0, sortie: 0, chute: 0, ajout: 0 };
      if (by[d][m.type] != null) by[d][m.type] = r3(by[d][m.type] + (+m.tonnage || 0)); }
    return Object.fromEntries(Object.entries(by).map(([d, v]) => {
      const reste = r3(v.entree - v.sortie - v.chute - v.ajout), pct = v.entree > 0 ? reste / v.entree * 100 : null;
      return [d, { ...v, reste, pct, bas: pct != null && pct <= SEUIL_STOCK }]; }));
  }
  // fiche d'un article : une ligne par diamètre théorique, avec le réel calculé depuis les mouvements
  function calcArticle(art, diamLines, moves) {
    const M = moves.filter(m => m.artId === art.id);
    const diams = [...new Set([...diamLines.map(d => d.diam), ...M.map(m => m.diam)])];
    const rows = diams.map(diam => {
      const dl = diamLines.find(d => d.diam === diam) || {}, Md = M.filter(m => m.diam === diam);
      const sum = (t) => r3(Md.filter(m => m.type === t).reduce((s, m) => s + (+m.tonnage || 0), 0));
      const theo = r3(+dl.tonnage || 0), sorti = sum('sortie'), chute = sum('chute'), ajout = sum('ajout'), reel = r3(sorti + chute + ajout);
      const ecart = r3(reel - theo), ecartPct = theo > 0 ? r3(ecart / theo * 100) : (reel > 0 ? 100 : 0);
      return { diam, nbBarres: dl.nbBarres || 0, theo, sorti, chute, ajout, reel, ecart, ecartPct, alerte: theo > 0 && Math.abs(ecartPct) >= SEUIL_ECART };
    }).sort((a, b) => DIAMS.indexOf(a.diam) - DIAMS.indexOf(b.diam));
    const totTheo = r3(rows.reduce((s, r) => s + r.theo, 0)), totReel = r3(rows.reduce((s, r) => s + r.reel, 0));
    return { rows, totTheo, totReel, totEcart: r3(totReel - totTheo), nAlertes: rows.filter(r => r.alerte).length };
  }
  // alertes globales du projet : écarts par article/diamètre + stocks bas
  function calcAlertes(arts, diamLines, moves) {
    const stock = calcStock(moves), out = [];
    for (const a of arts) { const c = calcArticle(a, diamLines.filter(d => d.artId === a.id), moves);
      for (const r of c.rows) if (r.alerte) out.push({ type: 'ecart', art: a, diam: r.diam, ecartPct: r.ecartPct }); }
    for (const [diam, s] of Object.entries(stock)) if (s.bas) out.push({ type: 'stock', diam, pct: s.pct, reste: s.reste });
    return out;
  }

  // ---- interface ----
  const can = () => { try { return orgEdit('materiaux'); } catch (e) { return true; } };
  const bar = (v, k = '') => `<div class="sq-tr"><div class="sq-fl ${k}" style="width:${Math.max(0, Math.min(100, Math.abs(v || 0)))}%"></div></div>`;
  async function load(p) { const all = mine(await DB.byProject('items', p.id), p.id);
    return { arts: all.filter(x => x.kind === 'mta').sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr')), diamLines: all.filter(x => x.kind === 'mtd'), moves: all.filter(x => x.kind === 'mtm') }; }
  const head = (title) => `<div class="sq-hd"><div class="sq-br"><div class="sq-lg">♧</div><div><strong>SiteTeam</strong><small>${esc(App.project.name)} · Matériaux</small></div></div><h1>${esc(title)}</h1></div>`;

  async function render(root) { if (!App.project) return; App.mt = App.mt || { tab: 'articles' };
    return App.mt.sel ? fiche(root, App.mt.sel) : App.mt.tab === 'stock' ? stock(root) : liste(root); }

  async function liste(root) {
    const p = App.project, D = await load(p), q = (App.mt.q || '').toLowerCase();
    const L = D.arts.filter(a => a.nom.toLowerCase().includes(q));
    const alertes = calcAlertes(D.arts, D.diamLines, D.moves);
    const stockTot = Object.values(calcStock(D.moves)).reduce((s, v) => s + v.entree, 0);
    root.innerHTML = `<div class="sq">${head('Matériaux · Ferraillage')}<div class="sq-bd">
      <div class="sq-ms" style="margin-bottom:14px">
        ${((l, v, u, c = '') => `<div class="sq-m"><label>${l}</label><strong class="${c}">${v}</strong><span class="u">${u}</span></div>`)('Parties d\'ouvrage', D.arts.length, '')}
        ${((l, v, u, c = '') => `<div class="sq-m"><label>${l}</label><strong class="${c}">${v}</strong><span class="u">${u}</span></div>`)('Tonnage entré', fmt(stockTot), 't')}
        ${((l, v, u, c = '') => `<div class="sq-m"><label>${l}</label><strong class="${c}">${v}</strong><span class="u">${u}</span></div>`)('Alertes actives', alertes.length, '', alertes.length ? 'neg' : 'pos')}
      </div>
      <div class="sq-lh"><span class="sq-pill">${alertes.length} alerte(s)</span><h2>🚨 Alertes</h2></div>
      ${alertes.length ? alertes.map(a => a.type === 'ecart'
          ? `<div class="sq-warn">⚠ <b>${esc(a.art.nom)}</b> · ${esc(a.diam)} : écart de ${a.ecartPct > 0 ? '+' : ''}${fmt(a.ecartPct)} % vs théorique</div>`
          : `<div class="sq-warn">📉 Stock <b>${esc(a.diam)}</b> presque épuisé : reste ${fmt(a.reste)} t (${fmt(a.pct)} %)</div>`).join('')
        : `<div class="sq-info">Aucune alerte ✓ — écarts sous ${SEUIL_ECART} % et stocks suffisants.</div>`}
      <div class="sq-lh" style="margin-top:18px"><span class="sq-pill">${L.length} article(s)</span><h2>Parties d'ouvrage</h2></div>
      <div class="sq-tools"><input class="sq-q" type="search" placeholder="Rechercher une partie d'ouvrage…" value="${esc(App.mt.q || '')}">
        <button class="sq-btn" data-a="stock">📦 Stock global</button>${can() ? '<button class="sq-btn" data-a="add">＋ Partie d\'ouvrage</button>' : ''}</div>
      ${L.map(a => { const c = calcArticle(a, D.diamLines.filter(d => d.artId === a.id), D.moves);
          return `<button type="button" class="sq-art" data-id="${a.id}"><div class="sq-eb">${esc(a.nom)}</div>
            <div class="sq-ah"><h3>${c.rows.length} diamètre(s)</h3><span class="sq-val ${c.nAlertes ? 'neg' : ''}">${c.totEcart > 0 ? '+' : ''}${fmt(c.totEcart)} t ›</span></div>
            <div class="sq-qt">${fmt(c.totReel)} / ${fmt(c.totTheo)} t théo.${c.nAlertes ? ` · ${c.nAlertes} alerte(s)` : ''}</div></button>`; }).join('')
        || `<div class="sq-empty">${D.arts.length ? 'Aucun résultat.' : 'Aucune partie d\'ouvrage. Ajoutez-les librement (semelles, poteaux, poutres, dalles, voiles…), comme les lots du projet.'}</div>`}
      <p class="sq-hint">Le réel est la somme des mouvements (sorties + chutes réelles + ajouts terrain) saisis sur le chantier — jamais une estimation.</p></div></div>`;
    const qi = root.querySelector('.sq-q'); qi.oninput = () => { App.mt.q = qi.value; const pos = qi.selectionStart; liste(root).then(() => { const n = root.querySelector('.sq-q'); n.focus(); n.setSelectionRange(pos, pos); }); };
    root.querySelectorAll('.sq-art').forEach(b => b.onclick = () => { App.mt.sel = b.dataset.id; render(root); });
    const st = root.querySelector('[data-a=stock]'); if (st) st.onclick = () => { App.mt.tab = 'stock'; render(root); };
    const ad = root.querySelector('[data-a=add]'); if (ad) ad.onclick = async () => { if (await editArt(p, null)) liste(root); };
  }

  async function editArt(p, a) {
    const r = await formSheet(a ? 'Modifier la partie d\'ouvrage' : 'Nouvelle partie d\'ouvrage', [
      { name: 'nom', label: 'Nom (ex. Poteaux, Voiles, Semelles, Poutres RDC…)', value: a ? a.nom : '' },
      { name: 'note', label: 'Note (optionnel)', type: 'textarea', value: a ? a.note : '' }], { okLabel: 'Enregistrer' });
    if (!r || !String(r.nom || '').trim()) return null;
    const x = a || { id: DB.uid(), projectId: p.id, kind: 'mta', createdAt: Date.now(), by: typeof myName === 'function' ? myName() : '' };
    Object.assign(x, { nom: r.nom.trim(), note: (r.note || '').trim() }); await DB.put('items', x); return x;
  }

  // ---- stock global (entrées) ----
  async function stock(root) {
    const p = App.project, D = await load(p), S = calcStock(D.moves);
    const entrees = D.moves.filter(m => m.type === 'entree').sort((a, b) => b.at - a.at);
    root.innerHTML = `<div class="sq">${head('Stock global · Ferraillage')}<div class="sq-bd"><button class="sq-back" data-a="back">← Parties d'ouvrage</button>
      <div class="sq-lh"><h2>Stock par diamètre</h2>${can() ? '<button class="sq-lnk" data-a="addentree">＋ Entrée (livraison)</button>' : ''}</div>
      ${Object.keys(S).length ? Object.entries(S).sort(([a], [b]) => DIAMS.indexOf(a) - DIAMS.indexOf(b)).map(([diam, v]) => `
        <section class="sq-sec"><div class="sq-kl"><h3>${esc(diam)}</h3><strong class="${v.bas ? 'neg' : 'pos'}">${fmt(v.reste)} t${v.pct != null ? ' · ' + fmt(v.pct) + '%' : ''}</strong></div>
          ${v.pct != null ? bar(v.pct, v.bas ? 'neg' : '') : ''}${v.bas ? '<p class="sq-hint" style="color:#8a4b00">📉 Stock presque épuisé — pensez à commander.</p>' : ''}
          <p class="sq-hint">Entrées ${fmt(v.entree)} t · sorties ${fmt(v.sortie)} t · chutes ${fmt(v.chute)} t · ajouts ${fmt(v.ajout)} t</p></section>`).join('')
        : '<div class="sq-empty">Aucun mouvement. Ajoutez une première entrée de stock (bon de livraison).</div>'}
      <h2 style="margin-top:18px">Historique des entrées</h2>
      ${entrees.length ? entrees.map(m => `<div class="sq-h"><div><b class="pos">+${fmt(m.tonnage)} t</b> · ${esc(m.diam)}<small>${new Date(m.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · ${esc(m.by || '—')}${m.bl ? ' · ' + esc(m.bl) : ''}${m.note ? ' · ' + esc(m.note) : ''}</small></div></div>`).join('')
        : '<p class="sq-hint">Aucune entrée enregistrée.</p>'}</div></div>`;
    root.querySelector('[data-a=back]').onclick = () => { App.mt.tab = 'articles'; render(root); };
    const ae = root.querySelector('[data-a=addentree]'); if (ae) ae.onclick = async () => { if (await addMouvement(p, null, D, 'entree')) stock(root); };
  }

  // ---- fiche d'une partie d'ouvrage ----
  async function fiche(root, id) {
    const p = App.project, D = await load(p), a = D.arts.find(x => x.id === id); if (!a) { App.mt.sel = null; return liste(root); }
    const dls = D.diamLines.filter(d => d.artId === a.id), c = calcArticle(a, dls, D.moves), ed = can();
    const M = D.moves.filter(m => m.artId === a.id).sort((x, y) => y.at - x.at);
    root.innerHTML = `<div class="sq">${head('Fiche partie d\'ouvrage')}<div class="sq-bd"><button class="sq-back" data-a="back">← Parties d'ouvrage</button>
      <div class="sq-dt"><div class="sq-eb">PARTIE D'OUVRAGE</div><h2>${esc(a.nom)}</h2>${ed ? '<button class="sq-lnk" data-a="eda">Modifier</button>' : ''}</div>
      ${a.note ? `<p class="sq-hint">${esc(a.note)}</p>` : ''}
      <div class="sq-ms">${[['Théorique', fmt(c.totTheo), 't'], ['Réel consommé', fmt(c.totReel), 't'], ['Écart', (c.totEcart > 0 ? '+' : '') + fmt(c.totEcart), 't', Math.abs(c.totEcart) > 1e-9 ? (c.totEcart > 0 ? 'neg' : '') : '']]
        .map(([l, v, u, cl = '']) => `<div class="sq-m"><label>${l}</label><strong class="${cl}">${v}</strong><span class="u">${u}</span></div>`).join('')}</div>
      <section class="sq-sec"><div class="sq-kl"><h3>Par diamètre</h3>${ed ? '<button class="sq-lnk" data-a="addd">＋ Diamètre</button>' : ''}</div>
        ${c.rows.length ? `<table class="mt-tbl"><thead><tr><th>Diam.</th><th>Barres</th><th>Théo. (t)</th><th>Chute (t)</th><th>Ajouts (t)</th><th>Sorti (t)</th><th>Écart</th></tr></thead><tbody>
          ${c.rows.map(r => `<tr class="${r.alerte ? 'mt-row-alert' : ''}"><td>${esc(r.diam)}</td><td>${fmt(r.nbBarres)}</td><td>${fmt(r.theo)}</td><td>${fmt(r.chute)}</td><td>${fmt(r.ajout)}</td><td>${fmt(r.sorti)}</td>
            <td class="${r.alerte ? 'neg' : ''}">${r.ecart > 0 ? '+' : ''}${fmt(r.ecart)}${r.theo > 0 ? ' (' + (r.ecartPct > 0 ? '+' : '') + fmt(r.ecartPct) + '%)' : ''}</td></tr>`).join('')}
          </tbody></table>` : '<div class="sq-empty">Aucun diamètre. Ajoutez le théorique (nombre de barres, tonnage) par diamètre.</div>'}</section>
      <section class="sq-sec"><div class="sq-kl"><h3>Mouvements sur cette partie d'ouvrage</h3></div>
        ${ed ? `<div class="sq-tools"><button class="sq-btn" data-a="sortie">− Sortie</button><button class="sq-btn" data-a="chute">🗑 Chute</button><button class="sq-btn" data-a="ajout">＋ Ajout terrain</button></div>` : ''}
        ${M.length ? M.map(m => `<div class="sq-h"><div><b class="${m.type === 'sortie' ? '' : m.type === 'chute' ? 'neg' : 'pos'}">${m.type === 'sortie' ? '−' : m.type === 'chute' ? '🗑' : '+'}${fmt(m.tonnage)} t</b> · ${esc(m.diam)} · ${{ sortie: 'sortie', chute: 'chute', ajout: 'ajout terrain' }[m.type]}
            <small>${esc(locLabel(m))} · ${new Date(m.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · ${esc(m.by || '—')}${m.note ? ' · ' + esc(m.note) : ''}</small></div></div>`).join('')
          : '<p class="sq-hint">Aucun mouvement enregistré pour cette partie d\'ouvrage.</p>'}</section></div></div>`;
    const redraw = () => fiche(root, id);
    root.querySelector('[data-a=back]').onclick = () => { App.mt.sel = null; render(root); };
    const eda = root.querySelector('[data-a=eda]'); if (eda) eda.onclick = async () => { if (await editArt(p, a)) redraw(); };
    const ad = root.querySelector('[data-a=addd]'); if (ad) ad.onclick = async () => { if (await addDiamLine(p, a, dls)) redraw(); };
    root.querySelectorAll('[data-a=sortie],[data-a=chute],[data-a=ajout]').forEach(b => b.onclick = async () => { if (await addMouvement(p, a, D, b.dataset.a)) redraw(); });
  }

  async function addDiamLine(p, a, dls) {
    const used = new Set(dls.map(d => d.diam));
    const r = await formSheet('Diamètre théorique', [
      { name: 'diam', label: 'Diamètre', type: 'select', options: DIAMS.map(d => ({ value: d, label: d + (used.has(d) ? ' (déjà saisi)' : '') })) },
      { name: 'nb', label: 'Nombre de barres théorique', type: 'number' }, { name: 'ton', label: 'Tonnage théorique (t)', type: 'number' }], { okLabel: 'Enregistrer' });
    if (!r || !r.diam) return null; const nb = num(r.nb), ton = num(r.ton);
    if (!Number.isFinite(ton) || ton < 0) { toast('Tonnage théorique invalide'); return null; }
    let dl = dls.find(d => d.diam === r.diam) || { id: DB.uid(), projectId: p.id, kind: 'mtd', artId: a.id, diam: r.diam };
    Object.assign(dl, { nbBarres: Number.isFinite(nb) ? nb : 0, tonnage: ton }); await DB.put('items', dl); return dl;
  }

  async function addMouvement(p, a, D, type) {
    const titre = { entree: 'Entrée de stock (livraison)', sortie: 'Sortie vers ' + (a ? a.nom : ''), chute: 'Chute (perte réelle) — ' + (a ? a.nom : ''), ajout: 'Ajout terrain (hors plan) — ' + (a ? a.nom : '') }[type];
    const fields = [{ name: 'diam', label: 'Diamètre', type: 'select', options: DIAMS.map(d => ({ value: d, label: d })) },
      { name: 'ton', label: 'Tonnage (t)', type: 'number' }];
    if (type === 'entree') fields.push({ name: 'bl', label: 'N° bon de livraison / commande (optionnel)' });
    else fields.push({ name: 'bloc', label: 'Bloc (optionnel)' }, { name: 'zone', label: 'Zone (optionnel)' }, { name: 'niv', label: 'Niveau (optionnel)' }, { name: 'axe', label: 'Axe (optionnel)' }, { name: 'fil', label: 'Fil (optionnel)' });
    fields.push({ name: 'note', label: 'Note (optionnel)', type: 'textarea' });
    const r = await formSheet(titre, fields, { okLabel: 'Enregistrer' }); if (!r) return null;
    const ton = num(r.ton); if (!Number.isFinite(ton) || ton <= 0) { toast('Tonnage invalide'); return null; }
    if (type !== 'entree') { const S = calcStock(D.moves)[r.diam]; const reste = S ? S.reste : 0; if (ton > reste + 1e-6) { const f = await formSheet('Stock insuffisant', [{ name: 'ok', label: `Le stock ${r.diam} ne contient que ${fmt(reste)} t. Continuer quand même ?`, type: 'select', options: [{ value: '', label: '— choisir —' }, { value: '1', label: 'Oui, continuer (stock négatif accepté)' }] }]); if (!f || f.ok !== '1') return null; } }
    const x = { id: DB.uid(), projectId: p.id, kind: 'mtm', type, diam: r.diam, tonnage: r3(ton), artId: type === 'entree' ? null : a.id,
      bloc: (r.bloc || '').trim(), zone: (r.zone || '').trim(), niv: (r.niv || '').trim(), axe: (r.axe || '').trim(), fil: (r.fil || '').trim(),
      bl: (r.bl || '').trim(), note: (r.note || '').trim(), at: Date.now(), by: typeof myName === 'function' ? myName() : '' };
    await DB.put('items', x); toast('Mouvement enregistré ✓'); return x;
  }

  return { render, calcStock, calcArticle, calcAlertes, locLabel, DIAMS, SEUIL_ECART, SEUIL_STOCK };
})();
function renderMateriaux(root) { return Materiaux.render(root); }
