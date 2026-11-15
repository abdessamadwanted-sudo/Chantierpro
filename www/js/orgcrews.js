// ================= Organisation chantier : équipes, affectations datées, effectifs et rendements =================
// Extension du module Organigramme (org.js) : on ne crée ni comptes ni rôles. Les personnes restent dans p.team ; on y ajoute
//   trades[]  : métiers encadrés (ferraillage, bétonnage… ; vide = généraliste sans périmètre implicite)
//   func      : id d'un responsable FONCTIONNEL (distinct du N+1 hiérarchique `parent`)
// Nouveaux enregistrements (magasin « items », 1 document par enregistrement → pas d'écrasement entre appareils) :
//   ogt équipe { name, trade, leaderId (chef d'équipe), chefId (chef de chantier), techIds[], condIds[], spatial, hist[] }
//   ogw ouvrier { name }                      (sans compte SiteTeam)
//   ogm appartenance { crewId, who:'m:<membre>'|'w:<ouvrier>', from, to }   ← période : changer d'équipe = fermer + ouvrir, jamais écraser
//   oga affectation { crewId, from, to, spatial, artId, planRef, obj, unit }  ← lieu / article BPU / activité Planning, datée
// Les quantités viennent du Suivi quantitatif (saisies `sqe` portant crewId) : aucune quantité n'est stockée ici (une seule vérité).
const OrgCrews = (() => {
  const TRADES = ['ferraillage', 'bétonnage', 'coffrage', 'maçonnerie', 'terrassement', 'étanchéité', 'second œuvre', 'VRD'];
  const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);
  const D = (s) => new Date(s + 'T00:00:00Z').getTime(), DAY = 864e5, iso = (t) => new Date(t).toISOString().slice(0, 10);
  const today = () => (typeof todayISO === 'function' ? todayISO() : iso(Date.now()));
  const mine = (all, pid) => all.filter(x => x.projectId === pid);
  const FULL = ['dirproj', 'dirtrav', 'mo', 'cpmo', 'amo', 'dirtech'];

  // ---- affichage du lieu : projet bâtiment (bât · bloc · niveau · zone) OU linéaire (axe · tronçon · PK) ; jamais « niveau » obligatoire
  const spatialLabel = (s) => !s ? '—' : s.type === 'route' ? [s.axe, s.troncon, (s.pkd || s.pkf) ? `PK ${s.pkd || '?'}→${s.pkf || '?'}` : ''].filter(Boolean).join(' · ') || '—' : [s.bat, s.bloc, s.niv, s.zone].filter(Boolean).join(' · ') || '—';

  // ---- calculs purs (testés) ----
  const overlap = (a, b, from, to) => { const s = Math.max(D(a), D(from)), e = Math.min(D(b || '2999-12-31'), D(to)); return e >= s ? Math.round((e - s) / DAY) + 1 : 0; };
  const active = (m, from, to) => overlap(m.from, m.to, from, to) > 0;
  // effectif UNIQUE : une personne présente dans deux équipes sur la période n'est comptée qu'une fois (dédoublonnage par identifiant)
  const uniqueHeads = (mems, from, to, only) => { const s = new Set(); for (const m of mems) if (active(m, from, to) && (!only || m.who.startsWith(only))) s.add(m.who); return s.size; };
  const personDays = (mems, from, to) => mems.reduce((n, m) => n + overlap(m.from, m.to, from, to), 0);
  // effectif SANS NOMS (ogh) : un nombre daté par équipe (changer le nombre = clôturer l'ancien + ouvrir le nouveau, l'historique reste) ;
  // non dédoublonnable entre équipes (pas d'identité) : il s'additionne à l'effectif nominatif et la mention est affichée
  const anonAt = (hc, crewId, d) => hc.filter(h => h.crewId === crewId && h.from <= d && (!h.to || h.to >= d)).reduce((n, h) => n + (+h.n || 0), 0);
  const anonDays = (hc, crewId, from, to) => hc.filter(h => h.crewId === crewId).reduce((n, h) => n + (+h.n || 0) * overlap(h.from, h.to, from, to), 0);
  const anonHeads = (hc, ids, d) => ids.reduce((n, id) => n + anonAt(hc, id, d), 0);
  // rendement par unité (jamais d'addition entre unités différentes) : quantité exécutée sur la période / jours / ouvrier-jours
  function yields(crew, mems, entries, arts, from, to, hc, artId) {
    const days = Math.round((D(to) - D(from)) / DAY) + 1, pd = personDays(mems.filter(m => m.crewId === crew.id), from, to) + anonDays(hc || [], crew.id, from, to), out = {};
    for (const e of entries) { if (e.crewId !== crew.id || (artId && e.artId !== artId)) continue; const d = iso(e.at); if (d < from || d > to) continue; const a = arts.find(x => x.id === e.artId); if (!a) continue;
      const u = a.unit || '?'; (out[u] = out[u] || { qty: 0 }).qty = Math.round((out[u].qty + (+e.delta || 0)) * 1e6) / 1e6; }
    for (const u in out) { out[u].perDay = days ? Math.round(out[u].qty / days * 100) / 100 : null; out[u].perWorkerDay = pd ? Math.round(out[u].qty / pd * 1000) / 1000 : null; }
    return { days, personDays: pd, byUnit: out, from, to };
  }
  // périmètre : titulaire, direction ou poste sans restriction = tout ; sinon uniquement les équipes de SES métiers ou auxquelles il est rattaché (aucun accès implicite à un autre métier)
  function scope(p, crews, memsAll) {
    const me = (p.team || []).find(x => x.me), P = me && typeof posteOf === 'function' ? posteOf(me.poste) : null, all = !me || (typeof Org !== 'undefined' && Org.owner()) || FULL.includes(me.poste) || (P && P.lv <= 1);   // titulaire, direction (niveau 1) ou poste sans restriction
    if (all) return { all: true, me, crews };
    const t = new Set(me.trades || []), roles = (c) => [c.leaderId, c.chefId, ...(c.techIds || []), ...(c.condIds || [])];
    return { all: false, me, crews: crews.filter(c => c.createdBy === me.id || t.has(c.trade) || roles(c).includes(me.id) || memsAll.some(m => m.crewId === c.id && m.who === 'm:' + me.id)) };
  }
  const rolesOf = (c) => [['Chef d\'équipe', c.leaderId], ['Chef de chantier', c.chefId], ...(c.techIds || []).map(i => ['Technicien', i]), ...(c.condIds || []).map(i => ['Conducteur', i])].filter(r => r[1]);
  // profil d'un conducteur : équipes qu'il suit (rattachées explicitement OU de ses métiers), techniciens distincts, ouvriers (nommés distincts + sans noms)
  function condStats(m, crews, mems, hc, from, to) {
    const t = new Set(m.trades || []), mine = crews.filter(c => t.has(c.trade) || rolesOf(c).some(r => r[1] === m.id)), ids = new Set(mine.map(c => c.id));
    const techs = new Set(); mine.forEach(c => (c.techIds || []).forEach(i => techs.add(i)));
    const named = new Set(mems.filter(x => ids.has(x.crewId) && x.who.startsWith('w:') && active(x, from, to)).map(x => x.who));
    return { crews: mine, nCrews: mine.length, nTechs: techs.size, nWorkers: named.size + anonHeads(hc || [], [...ids], to) };
  }
  const crewsOf = (crews, id) => crews.filter(c => rolesOf(c).some(r => r[1] === id));

  // ---- grade → casque de chantier (convention SiteTeam, la légende est affichée) ----
  const GRADES = { dir: { l: 'Direction', c: '#f8fafc', s: '#d4a017' }, cond: { l: 'Conducteur / ingénieur', c: '#2563eb', s: '#bfdbfe' }, tech: { l: 'Technicien', c: '#16a34a', s: '#bbf7d0' },
    chef: { l: 'Chef de chantier', c: '#f97316', s: '#ffedd5' }, ceq: { l: 'Chef d\'équipe', c: '#facc15', s: '#a16207' }, ouv: { l: 'Ouvrier', c: '#9ca3af', s: '#e5e7eb' } };
  function gradeOf(m) { const P = (typeof posteOf === 'function' && posteOf(m.poste)) || null, n = String((P && P.n) || m.role || ''), k = m.poste || '';
    if (m.grade && GRADES[m.grade]) return m.grade;
    if (/technicien|^TS\b/i.test(n) || k === 'tsq') return 'tech'; if (k === 'chef') return 'chef'; if (k === 'cheq') return 'ceq';
    if (!P) return /ouvrier/i.test(n) ? 'ouv' : 'tech'; return P.lv <= 2 ? 'dir' : P.lv <= 4 ? 'cond' : 'ouv'; }
  const helmetG = (g, x, y, k) => { const G = GRADES[g] || GRADES.ouv, sc = (k || 1);   // casque 30×26 dessiné en SVG (dôme, bande centrale, visière)
    return `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M2 20a13 13 0 0 1 26 0z" fill="${G.c}" stroke="#0f172a" stroke-opacity=".45" stroke-width="1.2"/><rect x="13" y="4" width="4" height="16" fill="${G.s}" stroke="#0f172a" stroke-opacity=".25" stroke-width=".6"/><rect x="0" y="19.5" width="30" height="4.5" rx="2.2" fill="${G.c}" stroke="#0f172a" stroke-opacity=".45" stroke-width="1.2"/></g>`; };
  const helmet = (m, px) => { const g = gradeOf(m), sz = px || 30; return `<svg class="og-hm" width="${sz}" height="${Math.round(sz * .87)}" viewBox="0 0 30 26" role="img" aria-label="${esc(GRADES[g].l)}">${helmetG(g, 0, 0, 1)}</svg>`; };
  const legend = () => `<div class="og-lg">${Object.entries(GRADES).map(([k, g]) => `<span><svg width="20" height="17" viewBox="0 0 30 26">${helmetG(k, 0, 0, 1)}</svg>${esc(g.l)}</span>`).join('')}</div>`;

  async function load(p) { const all = mine(await DB.byProject('items', p.id), p.id); return { crews: all.filter(x => x.kind === 'ogt'), workers: all.filter(x => x.kind === 'ogw'), mems: all.filter(x => x.kind === 'ogm'), hc: all.filter(x => x.kind === 'ogh'), asg: all.filter(x => x.kind === 'oga'), arts: all.filter(x => x.kind === 'sqa'), zones: all.filter(x => x.kind === 'sqz'), ents: all.filter(x => x.kind === 'sqe') }; }
  const nameOf = (p, W, who) => who.startsWith('m:') ? ((p.team || []).find(m => m.id === who.slice(2)) || {}).name || '?' : (W.find(w => w.id === who.slice(2)) || {}).name || '?';
  const audit = (x, what) => { (x.hist = x.hist || []).push({ at: Date.now(), by: typeof myName === 'function' ? myName() : '', what }); x.updatedAt = Date.now(); return x; };
  const period = () => { const n = (App.ogPer || 7), to = today(); return { from: iso(D(to) - (n - 1) * DAY), to, n }; };

  // ---- fiche personne : sections ajoutées à la fiche existante ----
  async function fiche(p, m, canE) {
    const L = await load(p), S = scope(p, L.crews, L.mems), per = period(), mine_ = crewsOf(S.crews, m.id);
    const tradeCrews = S.crews.filter(c => (m.trades || []).includes(c.trade) && !mine_.includes(c)), sup = [...mine_, ...tradeCrews];
    const mems = L.mems.filter(x => sup.some(c => c.id === x.crewId)), head = uniqueHeads(mems, per.from, per.to, 'w:') + anonHeads(L.hc, sup.map(c => c.id), per.to);
    const par = (p.team || []).find(x => x.id === m.func);
    const row = (c) => { const y = yields(c, L.mems, L.ents, L.arts, per.from, per.to, L.hc), u = Object.entries(y.byUnit).map(([k, v]) => `${fmt(v.qty)} ${esc(k)}${v.perDay != null ? ` · ${fmt(v.perDay)} ${esc(k)}/j` : ''}`).join(' · ') || 'aucune quantité liée';
      const a = L.asg.filter(x => x.crewId === c.id && x.from <= per.to && (!x.to || x.to >= per.from)).map(x => spatialLabel(x.spatial)).join(' ; ') || spatialLabel(c.spatial);
      return `<button class="og-ms" data-crew="${c.id}"><span class="grow"><b>${esc(c.name)}</b><small>${esc(c.trade || '')} · ${esc(a)} · ${u}</small></span><span>›</span></button>`; };
    return `<div class="og-sec"><h4>🧭 Responsabilités et rattachement</h4>
      <small>${helmet(m, 22)} Grade : ${esc(GRADES[gradeOf(m)].l)}</small><br><small>Métiers : ${(m.trades || []).length ? (m.trades || []).map(esc).join(', ') : 'généraliste (aucun périmètre de métier implicite)'}</small>
      ${par ? `<small>Responsable fonctionnel : <b>${esc(par.name)}</b></small>` : ''}${canE ? '<div class="og-fb"><button class="btn small ghost" data-a="trades">Métiers / responsable fonctionnel</button></div>' : ''}</div>
    <div class="og-sec"><h4>👷 Équipes suivies <i>${sup.length}</i></h4>${sup.map(row).join('') || '<p class="muted" style="font-size:12px">Aucune équipe dans votre périmètre.</p>'}
      <div class="og-kp"><span><b>${head}</b> ouvrier(s) distinct(s)</span><small>sur ${fmt(per.n)} j (${per.from} → ${per.to}) · une personne nommée dans 2 équipes = 1 ; l'effectif « sans noms » s'ajoute tel quel</small></div>
      <div class="og-fb">${[7, 30].map(n => `<button class="btn small ${per.n === n ? '' : 'ghost'}" data-per="${n}">${n} j</button>`).join('')}</div>
      <small class="muted">Provenance : affectations datées (ogm) · quantités des saisies du Suivi quantitatif liées à l'équipe · jours calendaires.</small></div>`;
  }
  function bindFiche(el, p, m, canE, again) {
    $$('[data-per]', el).forEach(b => b.onclick = () => { App.ogPer = +b.dataset.per; again(); });
    $$('[data-crew]', el).forEach(b => b.onclick = () => crewSheet(p, b.dataset.crew, canE));
    const t = $('[data-a=trades]', el); if (t) t.onclick = async () => {
      const r = await formSheet('Métiers et rattachement', [{ name: 'trades', label: 'Métiers encadrés (séparés par une virgule)', value: (m.trades || []).join(', '), list: TRADES },
        { name: 'func', label: 'Responsable fonctionnel (≠ N+1)', type: 'select', value: m.func || '', options: [{ value: '', label: '— aucun —' }, ...p.team.filter(x => x.id !== m.id).map(x => ({ value: x.id, label: x.name }))] }], { okLabel: 'Enregistrer' }); if (!r) return;
      m.trades = String(r.trades || '').split(',').map(s => s.trim()).filter(Boolean); m.func = r.func || ''; (m.hist = m.hist || []).push({ at: Date.now(), by: typeof myName === 'function' ? myName() : '', what: 'métiers/rattachement modifiés' });
      await DB.put('projects', p); again(); };
  }

  // ---- fiche équipe ----
  async function crewSheet(p, id, canE) {
    const L = await load(p), c = L.crews.find(x => x.id === id); if (!c) return; const S = scope(p, L.crews, L.mems); if (!S.crews.some(x => x.id === id)) return toast('Équipe hors de votre périmètre');
    const per = period(), cm = L.mems.filter(x => x.crewId === id), now = today(), cur = cm.filter(x => active(x, now, now)), y = yields(c, L.mems, L.ents, L.arts, per.from, per.to, L.hc);
    const asg = L.asg.filter(x => x.crewId === id).sort((a, b) => b.from.localeCompare(a.from));
    const pers = (i) => (p.team || []).find(x => x.id === i);
    const html = () => `<div class="og-fw"><div class="og-f"><b>${esc(c.name)}</b><span>${esc(c.trade || '')} · ${esc(spatialLabel(((asg.find(x => !x.to) || {}).spatial) || c.spatial))}</span></div>
      <div class="og-sec"><h4>Encadrement</h4>${rolesOf(c).map(([r, i]) => `<button class="og-ms" data-p="${i}">${pers(i) ? helmet(pers(i), 28) : ''}<span class="grow"><b>${esc((pers(i) || {}).name || '?')}</b><small>${r}</small></span><span>›</span></button>`).join('') || '<small class="muted">Non renseigné</small>'}</div>
      <div class="og-sec"><h4>Effectif <i>${uniqueHeads(cm, now, now) + anonAt(L.hc, id, now)}</i></h4><small>Aujourd'hui (${uniqueHeads(cm, now, now, 'w:')} ouvriers nommés · ${anonAt(L.hc, id, now)} sans noms · ${uniqueHeads(cm, now, now, 'm:')} encadrants)</small>
        ${cur.map(x => `<div class="og-ms"><span class="grow"><b>${esc(nameOf(p, L.workers, x.who))}</b><small>depuis ${esc(x.from)}${x.to ? ' → ' + esc(x.to) : ''}</small></span>${canE ? `<button class="btn small ghost" data-end="${x.id}">Retirer</button>` : ''}</div>`).join('')}
        ${L.hc.filter(h => h.crewId === id).sort((a, b) => b.from.localeCompare(a.from)).slice(0, 4).map(h => `<div class="og-ms"><span class="grow"><b>${fmt(h.n)} ouvriers (sans noms)</b><small>${esc(h.from)} → ${esc(h.to || 'en cours')}${h.note ? ' · ' + esc(h.note) : ''}</small></span></div>`).join('')}
        ${canE ? '<div class="og-fb"><button class="btn small" data-a="nbw">Nombre d\'ouvriers (sans noms)</button></div>' : ''}
        ${canE ? '<div class="og-fb"><button class="btn small" data-a="addw">＋ Ouvrier</button><button class="btn small ghost" data-a="addm">＋ Encadrant</button></div>' : ''}</div>
      <div class="og-sec"><h4>Rendement (${per.from} → ${per.to})</h4>${Object.entries(y.byUnit).map(([u, v]) => `<div class="og-kp"><span><b>${fmt(v.qty)} ${esc(u)}</b> exécuté(s)</span><small>${v.perDay != null ? fmt(v.perDay) + ' ' + esc(u) + '/jour' : ''}${v.perWorkerDay != null ? ' · ' + fmt(v.perWorkerDay) + ' ' + esc(u) + '/ouvrier-jour' : ' · ouvrier-jours = 0 : rendement indisponible'}</small></div>`).join('') || '<small class="muted">Aucune quantité liée à cette équipe sur la période (choisir l\'équipe à la saisie dans le Suivi quantitatif).</small>'}
        <small class="muted">${y.personDays} ouvrier-jours · jours calendaires · unités jamais additionnées entre elles</small></div>
      <div class="og-sec"><h4>Affectations (historique)</h4>${asg.map(x => { const a = L.arts.find(q => q.id === x.artId); return `<div class="og-ms"><span class="grow"><b>${esc(spatialLabel(x.spatial))}</b><small>${esc(x.from)} → ${esc(x.to || 'en cours')}${a ? ' · art. ' + esc(a.ref) + ' ' + esc(a.nom) : ''}${x.planRef ? ' · planning ' + esc(x.planRef) : ''}${x.obj ? ' · objectif ' + fmt(x.obj) + ' ' + esc(x.unit || '') + '/j' : ''}</small></span></div>`; }).join('') || '<small class="muted">Aucune affectation</small>'}
        ${canE ? '<div class="og-fb"><button class="btn small" data-a="chg">Changer l\'affectation</button><button class="btn small ghost" data-a="eq">Modifier l\'équipe</button></div>' : ''}</div></div>`;
    const s = sheet(html(), { title: 'Équipe' }), redo = async () => { s.close(); crewSheet(p, id, canE); };
    $$('[data-p]', s.el).forEach(b => b.onclick = () => { const m = pers(b.dataset.p); if (m) { s.close(); orgFiche(p, m, orgEdit('org') && orgCanAdmin(), () => DB.put('projects', p), () => {}); } });
    $$('[data-end]', s.el).forEach(b => b.onclick = async () => { const x = L.mems.find(q => q.id === b.dataset.end); x.to = iso(D(today()) - DAY); audit(x, 'retiré de l\'équipe'); await DB.put('items', x); redo(); });
    const addPerson = async (kind) => { let who;
      if (kind === 'w') { const r = await formSheet('Nouvel ouvrier', [{ name: 'n', label: 'Nom' }, { name: 'from', label: 'Depuis le', type: 'date', value: today() }], { okLabel: 'Ajouter' }); if (!r || !String(r.n || '').trim()) return;
        const w = { id: DB.uid(), projectId: p.id, kind: 'ogw', name: r.n.trim() }; await DB.put('items', w); who = 'w:' + w.id; return mk(who, r.from); }
      const v = await menu('Encadrant', p.team.map(x => ({ label: x.name, value: x.id }))); if (!v) return; const r = await formSheet('Depuis le', [{ name: 'from', label: 'Date de début', type: 'date', value: today() }]); if (!r) return; return mk('m:' + v, r.from); };
    const mk = async (who, from) => { if (L.mems.some(x => x.who === who && x.crewId === id && !x.to)) return toast('Déjà dans l\'équipe'); const x = { id: DB.uid(), projectId: p.id, kind: 'ogm', crewId: id, who, from: from || today(), to: '', hist: [] }; audit(x, 'affecté à l\'équipe'); await DB.put('items', x); redo(); };
    const nb = $('[data-a=nbw]', s.el); if (nb) nb.onclick = async () => {
      const r = await formSheet('Nombre d\'ouvriers (sans noms)', [{ name: 'n', label: 'Nombre d\'ouvriers dans l\'équipe', type: 'number', value: anonAt(L.hc, id, today()) || '' }, { name: 'from', label: 'À partir du', type: 'date', value: today() }, { name: 'note', label: 'Note (optionnel)' }], { okLabel: 'Enregistrer' }); if (!r) return;
      const n = Math.round(parseFloat(String(r.n).replace(',', '.'))); if (!Number.isFinite(n) || n < 0) return toast('Nombre invalide'); const from = r.from || today();
      const prev = L.hc.find(h => h.crewId === id && !h.to); if (prev && prev.from >= from) return toast('Date postérieure à la dernière saisie requise');
      if (prev) { prev.to = iso(D(from) - DAY); audit(prev, 'clôturé'); await DB.put('items', prev); }   // l'ancien nombre et ses rendements restent intacts
      const x = { id: DB.uid(), projectId: p.id, kind: 'ogh', crewId: id, n, from, to: '', note: String(r.note || '').slice(0, 120), hist: [] }; audit(x, 'créé'); await DB.put('items', x); redo(); };
    const aw = $('[data-a=addw]', s.el); if (aw) aw.onclick = () => addPerson('w'); const am = $('[data-a=addm]', s.el); if (am) am.onclick = () => addPerson('m');
    const eq = $('[data-a=eq]', s.el); if (eq) eq.onclick = async () => { s.close(); if (await editCrew(p, c)) crewSheet(p, id, canE); };
    const ch = $('[data-a=chg]', s.el); if (ch) ch.onclick = async () => { const r = await spatialForm(p, L); if (!r) return; const prev = asg.find(x => !x.to);
      if (prev) { prev.to = iso(D(r.from) - DAY); audit(prev, 'clôturée'); await DB.put('items', prev); }   // l'ancienne affectation et ses rendements restent intacts
      const x = { id: DB.uid(), projectId: p.id, kind: 'oga', crewId: id, from: r.from, to: '', spatial: r.spatial, artId: r.artId, planRef: r.planRef, obj: r.obj, unit: r.unit, hist: [] }; audit(x, 'créée'); await DB.put('items', x); redo(); };
  }
  async function spatialForm(p, L) {
    const t = await menu('Type de projet', [{ label: '🏢 Bâtiment (bât · bloc · niveau · zone)', value: 'bat' }, { label: '🛣️ Linéaire (axe · tronçon · PK)', value: 'route' }]); if (!t) return null;
    const fl = t === 'bat' ? [{ name: 'bat', label: 'Bâtiment' }, { name: 'bloc', label: 'Bloc' }, { name: 'niv', label: 'Niveau' }, { name: 'zone', label: 'Zone' }] : [{ name: 'axe', label: 'Axe / route' }, { name: 'troncon', label: 'Tronçon' }, { name: 'pkd', label: 'PK début' }, { name: 'pkf', label: 'PK fin' }];
    const P = typeof planData === 'function' ? planData(p) : { tasks: [] };
    const r = await formSheet('Nouvelle affectation', [{ name: 'from', label: 'À partir du', type: 'date', value: today() }, ...fl,
      { name: 'artId', label: 'Article BPU/DQE', type: 'select', value: '', options: [{ value: '', label: '— aucun —' }, ...L.arts.map(a => ({ value: a.id, label: a.ref + ' · ' + a.nom }))] },
      { name: 'planRef', label: 'Activité Planning', type: 'select', value: '', options: [{ value: '', label: '— aucune —' }, ...P.tasks.map(x => ({ value: x.ref || x.id, label: (x.ref ? x.ref + ' · ' : '') + x.nom }))] },
      { name: 'obj', label: 'Objectif journalier (quantité/jour)', type: 'number' }, { name: 'unit', label: 'Unité de l\'objectif' }], { okLabel: 'Affecter' }); if (!r) return null;
    const sp = { type: t }; fl.forEach(f => sp[f.name] = (r[f.name] || '').trim()); return { from: r.from || today(), spatial: sp, artId: r.artId || '', planRef: r.planRef || '', obj: parseFloat(String(r.obj || '').replace(',', '.')) || 0, unit: (r.unit || '').trim() };
  }
  async function editCrew(p, c) {
    const opts = [{ value: '', label: '— aucun —' }, ...p.team.map(x => ({ value: x.id, label: x.name }))];
    const r = await formSheet(c ? 'Modifier l\'équipe' : 'Nouvelle équipe', [{ name: 'name', label: 'Nom de l\'équipe', value: c ? c.name : '' }, { name: 'trade', label: 'Métier', value: c ? c.trade : '', list: TRADES },
      { name: 'leaderId', label: 'Chef d\'équipe', type: 'select', value: c ? c.leaderId || '' : '', options: opts }, { name: 'chefId', label: 'Chef de chantier', type: 'select', value: c ? c.chefId || '' : '', options: opts },
      { name: 'techId', label: 'Technicien', type: 'select', value: c ? (c.techIds || [])[0] || '' : '', options: opts }, { name: 'condId', label: 'Conducteur', type: 'select', value: c ? (c.condIds || [])[0] || '' : '', options: opts }], { okLabel: 'Enregistrer' });
    if (!r || !String(r.name || '').trim()) return null; const x = c || { id: DB.uid(), projectId: p.id, kind: 'ogt', hist: [], createdBy: ((p.team || []).find(m => m.me) || {}).id || '' };   // le créateur voit toujours son équipe
    Object.assign(x, { name: r.name.trim(), trade: (r.trade || '').trim(), leaderId: r.leaderId || '', chefId: r.chefId || '', techIds: r.techId ? [r.techId] : [], condIds: r.condId ? [r.condId] : [] }); audit(x, c ? 'modifiée' : 'créée'); await DB.put('items', x); return x;
  }

  // ---- liste des équipes (vue Directeur / Conducteur selon le périmètre) ----
  async function list(p, canE, embed) {
    App.dr = App.dr || { tab: S_def(p), v: null, back: [] };
    if (embed && App.dr.tab !== 'crews' && typeof OrgDir !== 'undefined') return OrgDir.render(p, canE, embed, { crews() { list(p, canE, embed); } });
    const L = await load(p), S = scope(p, L.crews, L.mems), per = period(), me = S.me, P = me && typeof posteOf === 'function' ? posteOf(me.poste) : null, today_ = today();
    const trades = [...new Set(S.crews.map(c => c.trade).filter(Boolean))], act = L.asg.filter(x => S.crews.some(c => c.id === x.crewId) && x.from <= today_ && (!x.to || x.to >= today_));
    const zonesAct = new Set(act.map(x => spatialLabel(x.spatial))), head = uniqueHeads(L.mems.filter(x => S.crews.some(c => c.id === x.crewId)), per.from, per.to, 'w:') + anonHeads(L.hc, S.crews.map(c => c.id), per.to);
    const title = S.all ? 'Dashboard Directeur' : 'Dashboard ' + (P ? P.n : 'Conducteur'), sub = S.all ? 'Toutes les équipes du projet' : (me && (me.trades || []).length ? me.trades.join(' + ') : 'Périmètre limité à mes affectations');
    const conds = (p.team || []).filter(m => gradeOf(m) === 'cond' || L.crews.some(c => (c.condIds || []).includes(m.id)));
    const condSection = `<h4 style="margin-top:14px">Conducteurs <i>${conds.length}</i></h4>${conds.map(m => { const st = condStats(m, S.crews, L.mems, L.hc, per.from, per.to), pp = (p.team || []).find(x => x.id === m.parent), P2 = typeof posteOf === 'function' ? posteOf(m.poste) : null;
      return `<button class="og-ms og-tc" data-p="${m.id}">${helmet(m, 38)}<span class="grow"><b>${esc(m.name || '')}</b><small>${esc((P2 && P2.n) || m.role || 'Conducteur')}${(m.trades || []).length ? ' · ' + (m.trades || []).map(esc).join(' + ') : ' · généraliste'}${pp ? ' · N+1 : ' + esc(pp.name) : ''}</small>
        <em class="og-cs">👷 <strong>${st.nCrews}</strong> équipe(s) · 🔧 <strong>${st.nTechs}</strong> technicien(s) · 👥 <strong>${st.nWorkers}</strong> ouvrier(s)</em></span><span>›</span></button>`; }).join('') || '<small class="muted">Aucun conducteur (poste « Conducteur » ou « Ingénieur travaux » dans l\'organigramme).</small>'}`;
    const K = (l, v) => `<div class="og-k"><small>${l}</small><b>${v}</b></div>`;
    const card = (c) => { const y = yields(c, L.mems, L.ents, L.arts, per.from, per.to, L.hc), a = act.find(x => x.crewId === c.id), u = a && a.unit, v = u && y.byUnit[u], pct = v && a.obj > 0 && v.perDay != null ? Math.round(v.perDay / a.obj * 100) : null, boss = (p.team || []).find(x => x.id === c.leaderId);
      return `<button class="og-ms og-tc" data-crew="${c.id}">${boss ? helmet(boss, 30) : ''}<span class="grow"><b>${esc(c.name)}</b><small>${esc(spatialLabel((a || {}).spatial || c.spatial))}</small>${pct != null ? `<div class="sq-tr"><div class="sq-fl" style="width:${Math.min(100, pct)}%"></div></div>` : ''}</span><b>${pct != null ? pct + '%' : '—'}</b></button>`; };
    const html = `<div class="og-fw">${embed && typeof OrgDir !== 'undefined' ? OrgDir.tabs('crews') : ''}<div class="og-sec"><span class="og-demo">${S.all ? 'Vue complète' : 'Mon périmètre'}</span><h4>${esc(title)}</h4><small>${esc(sub)} · ${esc(p.name)}</small>
      <div class="og-kg">${K('Ouvriers affectés', head)}${K('Équipes', S.crews.length)}${K('Métiers', trades.length)}${K('Zones actives', zonesAct.size)}</div>
      <h4 style="margin-top:14px">Affectations des équipes</h4>${S.crews.map(card).join('') || '<small class="muted">Aucune équipe.</small>'}
      <small class="muted">Les % comparent le rendement journalier moyen (${per.from} → ${per.to}) à l'objectif journalier de l'affectation en cours, même unité. Ce n'est pas l'avancement global (voir Suivi quantitatif). « — » : objectif ou quantité non liés.</small>
      ${canE ? '<div class="og-fb"><button class="btn small" data-a="new">＋ Équipe</button></div>' : ''}${legend()}</div></div>`;
    const s = embed ? (embed.innerHTML = html, { el: embed, close() { list(p, canE, embed); } }) : sheet(html, { title: 'Équipes' });
    $$('[data-crew]', s.el).forEach(b => b.onclick = () => { if (!embed) s.close(); crewSheet(p, b.dataset.crew, canE); });
    $$('[data-p]', s.el).forEach(b => b.onclick = () => { const m = (p.team || []).find(x => x.id === b.dataset.p); if (m) orgFiche(p, m, orgEdit('org') && orgCanAdmin(), () => DB.put('projects', p), () => {}); });
    $$('[data-tab]', s.el).forEach(b => b.onclick = () => { App.dr.tab = b.dataset.tab; App.dr.v = null; list(p, canE, embed); });
    const nw = $('[data-a=new]', s.el); if (nw) nw.onclick = async () => { if (!embed) s.close(); if (await editCrew(p, null)) list(p, canE, embed); };
  }
  const S_def = (p) => { const me = (p.team || []).find(x => x.me); return !me || (typeof Org !== 'undefined' && Org.owner()) || FULL.includes(me.poste) ? 'cond' : 'crews'; };
  const render = (root) => list(App.project, orgEdit('org') && orgCanAdmin(), root);
  return { load, period, render, list, fiche, bindFiche, crewSheet, helmet, helmetG, gradeOf, GRADES, calc: { condStats, overlap, uniqueHeads, personDays, anonAt, anonDays, anonHeads, yields, scope, spatialLabel, crewsOf }, TRADES };
})();
