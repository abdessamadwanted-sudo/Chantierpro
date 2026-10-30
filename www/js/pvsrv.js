// ================= v1.0.42 — PV de réception intelligents, par service et par type d'ouvrage =================
// Chaque modèle a des rubriques (check-list), des mesures avec tolérances (vérifiées automatiquement), un verdict
// automatique (Conforme / Conforme avec réserves / Non conforme), une numérotation PV-XXX-001, la création des réserves
// et la contre-visite. Les PV restent des « formulaires » (store forms) : même synchro, même validation, même PDF dans Drive.
const PVT = [
  { id: 'pv_fer', code: 'FER', e: '🔩', svc: ['qualite', 'ferraillage', 'travaux'], title: 'PV réception ferraillage', sec: [
    ['Armatures', ['Diamètres conformes au plan', 'Nombre de barres conforme', 'Espacement des armatures', 'Cadres / étriers / épingles (forme et pas)', 'Façonnage (crochets, rayons de cintrage)']],
    ['Enrobage', ['Cales en place et en nombre suffisant', 'Enrobage côté coffrage respecté', 'Distanciers entre nappes']],
    ['Recouvrements & ancrages', ['Longueurs de recouvrement', 'Ancrages et attentes en place', 'Ligatures et stabilité de la cage']],
    ['Propreté', ['Armatures propres (ni huile, ni boue, ni rouille feuilletée)', 'Fond de coffrage propre']]],
    mes: [{ k: 'enr', l: 'Enrobage mesuré', u: 'mm', min: 25, max: 60 }, { k: 'esp', l: 'Écart d\'espacement', u: 'mm', min: -10, max: 10 }, { k: 'rec', l: 'Recouvrement mesuré', u: 'cm', min: 50, max: '' }] },
  { id: 'pv_cof', code: 'COF', e: '🪵', svc: ['qualite', 'travaux', 'ferraillage'], title: 'PV réception coffrage', sec: [
    ['Géométrie', ['Implantation / axes', 'Dimensions conformes au plan', 'Aplomb / verticalité', 'Niveau du fond et de l\'arase']],
    ['Stabilité', ['Étaiement et contreventement', 'Serrage des tiges / entretoises', 'Accès et plateformes de travail sûrs']],
    ['Préparation', ['Étanchéité des joints', 'Huile de décoffrage appliquée', 'Réservations et inserts en place', 'Fond propre (sciure, fil, eau)']]],
    mes: [{ k: 'apl', l: 'Écart d\'aplomb', u: 'mm', min: -10, max: 10 }, { k: 'dim', l: 'Écart de dimension', u: 'mm', min: -5, max: 5 }, { k: 'niv', l: 'Écart de niveau', u: 'mm', min: -10, max: 10 }] },
  { id: 'pv_bet', code: 'BET', e: '🧱', svc: ['qualite', 'travaux', 'centrale', 'labo'], title: 'PV contrôle bétonnage', sec: [
    ['Avant coulage', ['Ferraillage et coffrage réceptionnés', 'Moyens en place (pompe, vibreurs, éclairage)', 'Météo compatible']],
    ['Livraison', ['Bon de livraison conforme (classe, ciment, Dmax)', 'Délai depuis la fabrication < 1 h 30', 'Aucun ajout d\'eau sur chantier']],
    ['Coulage', ['Hauteur de chute respectée (< 1,5 m)', 'Vibration correcte', 'Reprise de bétonnage traitée']],
    ['Après coulage', ['Cure du béton mise en place', 'Protection (soleil, pluie, vent)']]],
    mes: [{ k: 'slump', l: 'Affaissement (slump)', u: 'mm', min: 100, max: 150 }, { k: 'temp', l: 'Température du béton', u: '°C', min: 5, max: 32 }, { k: 'epr', l: 'Éprouvettes prélevées', u: 'u', min: 3, max: '' }] },
  { id: 'pv_imp', code: 'IMP', e: '📐', svc: ['topo', 'travaux', 'methodes'], title: 'PV d\'implantation (topo)', sec: [
    ['Repères', ['Bornes / points de référence vérifiés', 'Repère de nivellement (NGM) vérifié']],
    ['Implantation', ['Axes principaux implantés', 'Axes secondaires implantés', 'Cotes entre axes vérifiées', 'Diagonales vérifiées']],
    ['Altimétrie', ['Niveaux reportés (traits de niveau)']],
    ['Remise', ['Croquis / fichier de points remis à l\'entreprise']]],
    mes: [{ k: 'dx', l: 'Écart X', u: 'mm', min: -10, max: 10 }, { k: 'dy', l: 'Écart Y', u: 'mm', min: -10, max: 10 }, { k: 'dz', l: 'Écart Z (altimétrie)', u: 'mm', min: -5, max: 5 }, { k: 'dg', l: 'Écart sur diagonale', u: 'mm', min: -15, max: 15 }] },
  { id: 'pv_alt', code: 'ALT', e: '📏', svc: ['topo'], title: 'PV contrôle altimétrique', sec: [
    ['Contrôle', ['Repère de départ vérifié', 'Fond de fouille / arase contrôlé', 'Points relevés reportés sur croquis']]],
    mes: [{ k: 'dz1', l: 'Écart maxi relevé', u: 'mm', min: -20, max: 20 }, { k: 'pente', l: 'Pente mesurée', u: '%', min: '', max: '' }] },
  { id: 'pv_bf', code: 'EBF', e: '🧪', svc: ['labo', 'qualite', 'centrale'], title: 'PV essai béton frais (labo)', sec: [
    ['Prélèvement', ['Prélèvement fait à la livraison', 'Moules conformes et huilés', 'Éprouvettes identifiées (n°, date, ouvrage)']],
    ['Essais', ['Essai d\'affaissement au cône d\'Abrams', 'Mise en place par piquage / vibration', 'Conservation des éprouvettes (24 h puis bac)']]],
    mes: [{ k: 'slump', l: 'Affaissement', u: 'mm', min: 100, max: 150 }, { k: 'temp', l: 'Température', u: '°C', min: 5, max: 32 }, { k: 'epr', l: 'Éprouvettes', u: 'u', min: 6, max: '' }] },
  { id: 'pv_ecr', code: 'ECR', e: '🏋️', svc: ['labo', 'qualite'], title: 'PV d\'écrasement (labo)', sec: [
    ['Éprouvettes', ['Identification conforme au prélèvement', 'Surfaçage / rectification', 'Âge de l\'essai conforme']]],
    mes: [{ k: 'r7', l: 'Résistance à 7 jours', u: 'MPa', min: 16, max: '' }, { k: 'r28', l: 'Résistance à 28 jours', u: 'MPa', min: 25, max: '' }] },
  { id: 'pv_cmp', code: 'CMP', e: '🚜', svc: ['labo', 'topo', 'travaux'], title: 'PV compactage / plate-forme', sec: [
    ['Couche', ['Matériau conforme', 'Épaisseur de couche conforme', 'Teneur en eau proche de l\'OPM']]],
    mes: [{ k: 'comp', l: 'Compacité (% OPM)', u: '%', min: 95, max: '' }, { k: 'ev2', l: 'Module EV2', u: 'MPa', min: 50, max: '' }, { k: 'k', l: 'Rapport EV2 / EV1', u: '', min: '', max: 2.2 }] },
  { id: 'pv_mac', code: 'MAC', e: '🧱', svc: ['travaux', 'qualite'], title: 'PV réception maçonnerie', sec: [
    ['Géométrie', ['Implantation', 'Aplomb', 'Niveau / alignement']],
    ['Exécution', ['Épaisseur des joints', 'Harpage / liaison', 'Chaînages et linteaux', 'Propreté']]],
    mes: [{ k: 'apl', l: 'Écart d\'aplomb', u: 'mm', min: -10, max: 10 }, { k: 'jt', l: 'Épaisseur de joint', u: 'mm', min: 8, max: 15 }] },
  { id: 'pv_eta', code: 'ETA', e: '💧', svc: ['travaux', 'qualite'], title: 'PV réception étanchéité', sec: [
    ['Support', ['Support propre et sec', 'Pentes conformes', 'Primaire appliqué']],
    ['Exécution', ['Recouvrement des lés', 'Relevés et engravures', 'Évacuations EP traitées']],
    ['Essai', ['Essai de mise en eau (48 h)', 'Protection mise en place']]],
    mes: [{ k: 'rec', l: 'Recouvrement des lés', u: 'cm', min: 10, max: '' }, { k: 'rel', l: 'Hauteur des relevés', u: 'cm', min: 15, max: '' }] },
  { id: 'pv_hse', code: 'HSE', e: '🦺', svc: ['hse', 'travaux'], title: 'Inspection sécurité (HSE)', sec: [
    ['Protections collectives', ['Garde-corps en place', 'Trémies et ouvertures protégées', 'Échafaudages réceptionnés', 'Balisage des zones']],
    ['Personnel', ['EPI portés (casque, chaussures, harnais)', 'Accueil sécurité fait']],
    ['Installations', ['Extincteurs accessibles', 'Électricité de chantier conforme', 'Propreté et circulations dégagées']]], mes: [] },
];
const pvTpl = (id) => PVT.find(t => t.id === id);
const pvMyServices = () => { try { const m = Team.ready() && Team.me(); if (!m) return []; return [m.service || (typeof tmRoleOf === 'function' ? tmRoleOf(m.role).s : ''), ...(m.postes || []).map(k => typeof tmRoleOf === 'function' ? tmRoleOf(k).s : '')].filter(Boolean); } catch (e) { return []; } };
const pvNum = (v) => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
// mesure dans la tolérance ? null = pas encore mesurée
function pvMesOk(m) { const v = pvNum(m.v); if (v == null) return null; const a = pvNum(m.min), b = pvNum(m.max); return !((a != null && v < a) || (b != null && v > b)); }
const pvTol = (m) => { const a = pvNum(m.min), b = pvNum(m.max), u = m.u ? ' ' + m.u : ''; return a != null && b != null ? `${a} à ${b}${u}` : a != null ? `≥ ${a}${u}` : b != null ? `≤ ${b}${u}` : 'libre'; };

// choix du modèle : ceux de mon service d'abord
function pvPickTemplate() {
  return new Promise((resolve) => {
    const mine = pvMyServices(), isMine = (t) => t.svc.some(s => mine.includes(s));
    const A = mine.length ? PVT.filter(isMine) : [], B = PVT.filter(t => !A.includes(t));
    const card = (t) => `<button class="pv-tc" data-t="${t.id}"><span>${t.e}</span><b>${esc((x => x.charAt(0).toUpperCase() + x.slice(1))(t.title.replace(/^PV (de |d'|d’)?/, '')))}</b><small>${t.sec.reduce((n, s) => n + s[1].length, 0)} points${t.mes.length ? ' · ' + t.mes.length + ' mesures' : ''}</small></button>`;
    let picked = null;
    const s = sheet(`<div class="pv-pick">${A.length ? `<div class="pv-ph">⭐ Mon service</div><div class="pv-tg">${A.map(card).join('')}</div><div class="pv-ph">Autres services</div>` : ''}<div class="pv-tg">${B.map(card).join('')}</div>
      <details class="pv-old"><summary class="pv-ph">Anciennes fiches simples ›</summary><div class="pv-tg">${FORM_TEMPLATES.map(t => `<button class="pv-tc old" data-o="${t.id}"><span>📝</span><b>${esc(t.title)}</b><small>fiche simple</small></button>`).join('')}</div></details></div>`, {
      title: 'Nouveau PV de réception',
      onMount: (el) => { $$('[data-t]', el).forEach(b => b.onclick = () => { picked = { v2: b.dataset.t }; s.close(); }); $$('[data-o]', el).forEach(b => b.onclick = () => { picked = { old: b.dataset.o }; s.close(); }); },
    });
    s.onClose = () => resolve(picked);
  });
}
// création d'un PV (pre : { niv, ouv, lotId, companyId, tpl })
async function pvCreate(p, pre = {}) {
  p = p || App.project; if (!p) return null;
  const ch = pre.tpl ? { v2: pre.tpl } : await pvPickTemplate(); if (!ch) return null;
  if (ch.old) { const t = FORM_TEMPLATES.find(x => x.id === ch.old); return DB.put('forms', { projectId: p.id, templateId: t.id, title: t.title, location: '', date: todayISO(), inspector: '', notes: '', aut: Team.ready() ? Team.uid() : '', vst: 'brouillon', items: t.items.map(label => ({ label, res: null, comment: '' })), photoIds: [] }); }
  const T = pvTpl(ch.v2), all = await DB.byProject('forms', p.id);
  const n = all.filter(f => f.templateId === T.id).length + 1, me = Team.ready() && Team.me();
  return DB.put('forms', { projectId: p.id, templateId: T.id, v2: 1, ref: `PV-${T.code}-${String(n).padStart(3, '0')}`, title: T.title, location: pre.ouv || '', niv: pre.niv || '', lotId: pre.lotId || '', companyId: pre.companyId || '',
    date: todayISO(), inspector: (me && me.name) || '', notes: '', aut: Team.ready() ? Team.uid() : '', vst: 'brouillon', parent: pre.parent || '',
    items: pre.items || T.sec.flatMap(([sec, L]) => L.map(label => ({ sec, label, res: null, comment: '' }))),
    mes: pre.mes || T.mes.map(m => ({ ...m, v: '' })), photoIds: [] });
}
// réserves (tâches) à partir des points « réserve » / « non conforme » et des mesures hors tolérance
async function pvMakeReserves(form) {
  const tasks = await DB.byProject('tasks', form.projectId); let num = tasks.reduce((m, t) => Math.max(m, t.num || 0), 0), n = 0;
  const where = [form.niv, form.location].filter(Boolean).join(' · ');
  const mk = async (title, desc, prio) => { num++; n++; const t = await DB.put('tasks', { projectId: form.projectId, num, kind: 'reserve', companyId: form.companyId || '', title, status: 'open', priority: prio, assignee: '', category: form.title, due: '', description: desc, photoIds: [], pvId: form.id, log: [{ t: Date.now(), msg: `Créée depuis ${form.ref || 'le PV'}` }] }); return t.id; };
  for (const it of form.items) if ((it.res === 'nok' || it.res === 'res') && !it.taskId) it.taskId = await mk(`${it.label}${where ? ' — ' + where : ''}`, `${it.comment || ''}${it.comment ? '\n' : ''}${form.ref || form.title} du ${fmtDate(form.date)}`, it.res === 'nok' ? 3 : 2);
  for (const m of (form.mes || [])) if (pvMesOk(m) === false && !m.taskId) m.taskId = await mk(`${m.l} hors tolérance (${m.v} ${m.u || ''}, attendu ${pvTol(m)})${where ? ' — ' + where : ''}`, `${form.ref || form.title} du ${fmtDate(form.date)}`, 3);
  await DB.put('forms', form); return n;
}

function openPvDetail(form) {
  return new Promise(async (resolve) => {
    const project = await DB.get('projects', form.projectId), T = pvTpl(form.templateId) || { e: '📋', sec: [] };
    const el = document.createElement('div'); el.className = 'fullpage pv2'; document.body.appendChild(el);
    let saveT; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => DB.put('forms', form), 400); };
    const flush = async () => { clearTimeout(saveT); await DB.put('forms', form); };
    const finish = async () => { await flush(); el.remove(); resolve(); };
    const unBack = pushBack(finish);
    if (!form.photoIds) form.photoIds = []; if (!form.mes) form.mes = [];
    const lots = typeof lsLots === 'function' ? lsLots(project) : [], nivs = typeof lsNiv === 'function' ? lsNiv(project) : [];
    const open = {}; // rubriques repliées
    async function render() {
      const s = formStats(form), photos = await loadFiles(form.photoIds);
      const secs = [...new Set(form.items.map(i => i.sec || 'Points de contrôle'))];
      const nRes = form.items.filter(i => (i.res === 'nok' || i.res === 'res') && !i.taskId).length + form.mes.filter(m => pvMesOk(m) === false && !m.taskId).length;
      const vc = s.status === 'Conforme' ? 'g' : s.status === 'Non conforme' ? 'r' : s.status === 'Conforme avec réserves' ? 'o' : 'b';
      const sc = window.scrollY, ct = $('.content', el), keep = ct ? ct.scrollTop : 0;
      el.innerHTML = `
        <div class="topbar"><button class="iconbtn" data-a="back">${icon('back')}</button><h1>${esc(T.e)} ${esc(form.ref || form.title)}</h1>
          <button class="iconbtn" data-a="share">${icon('share')}</button><button class="iconbtn" data-a="more">${icon('more')}</button></div>
        <div class="content"><div class="form pv2-f">
          <div class="pv-verdict ${vc}"><div><small>${esc(form.title)}</small><b>${s.status === 'En cours' ? 'En cours de contrôle' : esc(s.status)}</b>
            <span>${s.answered}/${s.n} points · ✓ ${s.ok}${s.res ? ` · réserves ${s.res}` : ''}${s.nok ? ` · NC ${s.nok}` : ''}${s.mb ? ` · mesures hors tol. ${s.mb}` : ''}</span></div>
            <i style="--p:${s.n ? Math.round(s.answered / s.n * 100) : 0}">${s.n ? Math.round(s.answered / s.n * 100) : 0}%</i></div>
          ${form.parent ? '<div class="pv-cv">🔁 Contre-visite — seuls les points à revoir sont repris</div>' : ''}
          ${ST.vBox(form)}
          <div class="pv-ctx">
            <div class="kv"><label>Date<input name="date" type="date" value="${esc(form.date)}"></label><label>Niveau<input name="niv" value="${esc(form.niv || '')}" list="pv-niv" placeholder="R+1"><datalist id="pv-niv">${nivs.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label></div>
            <label>Ouvrage / localisation<input name="location" value="${esc(form.location)}" placeholder="Ex : Voiles V1 à V6, axes A–C"></label>
            <div class="kv">${lots.length ? `<label>Lot<select name="lotId"><option value="">—</option>${lots.map(l => `<option value="${esc(l.id)}" ${form.lotId === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>` : ''}
            <label>Entreprise<select name="companyId"><option value="">—</option>${(project.companies || []).map(c => `<option value="${c.id}" ${form.companyId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label></div>
            <label>Contrôlé par<input name="inspector" value="${esc(form.inspector)}"></label>
          </div>
          ${s.answered < s.n ? `<button class="btn ghost small pv-all" data-a="allok">✓ Le reste est conforme</button>` : ''}
          ${secs.map(sec => { const L = form.items.map((it, i) => [it, i]).filter(([it]) => (it.sec || 'Points de contrôle') === sec), d = L.filter(([it]) => it.res).length, bad = L.some(([it]) => it.res === 'nok');
            return `<details class="pv-sec ${bad ? 'bad' : d === L.length ? 'done' : ''}" ${open[sec] === false ? '' : 'open'} data-sec="${esc(sec)}"><summary><b>${esc(sec)}</b><small>${d}/${L.length}</small></summary>
              ${L.map(([it, i]) => `<div class="check-item pv-it" data-i="${i}"><div class="lbl">${esc(it.label)}${it.taskId ? ' <em>réserve créée</em>' : ''}</div>
                <div class="seg pv-seg">${[['ok', '✓ Conforme'], ['res', 'Réserve'], ['nok', 'Non conf.'], ['na', 'N/A']].map(([k, l]) => `<button data-r="${k}" class="${it.res === k ? 'on ' + k : ''}">${l}</button>`).join('')}</div>
                ${it.res === 'nok' || it.res === 'res' || it.comment ? `<input data-c value="${esc(it.comment)}" placeholder="${it.res === 'nok' ? 'Écart constaté, action demandée' : 'Réserve à lever'}">` : ''}</div>`).join('')}</details>`; }).join('')}
          <button class="btn ghost small" data-a="additem">${icon('plus')} Point de contrôle</button>
          ${form.mes.length ? `<div class="pv-mes"><div class="pv-mh"><b>📏 Mesures</b><small>vérifiées avec la tolérance</small></div>
            ${form.mes.map((m, i) => { const ok = pvMesOk(m); return `<div class="pv-m ${ok === false ? 'bad' : ok ? 'ok' : ''}" data-m="${i}"><span><b>${esc(m.l)}</b><button type="button" data-tol>tolérance : ${esc(pvTol(m))} ✎</button></span>
              <label><input data-v inputmode="decimal" value="${esc(m.v ?? '')}" placeholder="—"><em>${esc(m.u || '')}</em></label><i>${ok === false ? '✗' : ok ? '✓' : ''}</i></div>`; }).join('')}</div>` : ''}
          <label>Observations<textarea name="notes">${esc(form.notes)}</textarea></label>
          <label>Photos</label>${thumbsHTML(photos)}
          <div class="fld">Signature du contrôleur<div class="sigbox" data-sig="sigCtrl"></div></div>
          <div class="fld">Signature de l'entreprise<div class="sigbox" data-sig="sigEnt"></div></div>
          <div class="pv-act">
            <button class="btn" data-a="pdf">${icon('report')} Générer le PV (PDF)</button>
            ${nRes ? `<button class="btn ghost" data-a="res">⚠️ Créer ${nRes} réserve(s)</button>` : ''}
            ${s.nok || s.res || s.mb ? `<button class="btn ghost" data-a="cv">🔁 Contre-visite</button>` : ''}
          </div>
        </div></div>`;
      const ct2 = $('.content', el); if (ct2 && keep) ct2.scrollTop = keep; if (sc) window.scrollTo(0, sc);
      $('[data-a=back]', el).onclick = () => { unBack(); finish(); };
      $$('input[name], textarea[name], select[name]', el).forEach(i => i.oninput = i.onchange = () => { form[i.name] = i.value; save(); });
      ST.vBind(el, form, async () => { await flush(); render(); });
      $$('.sigbox', el).forEach(b => signaturePad(b, form[b.dataset.sig], (v) => { form[b.dataset.sig] = v; save(); }));
      $$('details.pv-sec', el).forEach(d => d.ontoggle = () => { open[d.dataset.sec] = d.open; });
      $$('.pv-it', el).forEach(ci => {
        const it = form.items[+ci.dataset.i];
        $$('[data-r]', ci).forEach(b => b.onclick = () => { it.res = it.res === b.dataset.r ? null : b.dataset.r; save(); render(); });
        const c = $('[data-c]', ci); if (c) c.oninput = () => { it.comment = c.value; save(); };
      });
      $$('.pv-m', el).forEach(row => {
        const m = form.mes[+row.dataset.m], inp = $('[data-v]', row);
        inp.onchange = () => { m.v = inp.value.trim(); save(); render(); };
        $('[data-tol]', row).onclick = async () => { const r = await formSheet('Tolérance · ' + m.l, [{ name: 'min', label: `Minimum (${m.u || ''})`, value: m.min ?? '', type: 'text' }, { name: 'max', label: `Maximum (${m.u || ''})`, value: m.max ?? '', type: 'text' }, { name: 'i', type: 'info', label: 'Astuce', value: 'Laissez vide pour « pas de limite ». Les valeurs viennent du CPS / des plans : adaptez-les à votre projet.' }]); if (!r) return; m.min = r.min.trim(); m.max = r.max.trim(); save(); render(); };
      });
      const all = $('[data-a=allok]', el); if (all) all.onclick = () => { form.items.forEach(it => { if (!it.res) it.res = 'ok'; }); save(); render(); };
      $('[data-a=additem]', el).onclick = async () => {
        const r = await formSheet('Point de contrôle', [{ name: 'label', label: 'Libellé' }, { name: 'sec', label: 'Rubrique', value: secs[secs.length - 1] || '', list: secs }], { okLabel: 'Ajouter' });
        if (r && r.label) { form.items.push({ sec: r.sec || 'Points de contrôle', label: r.label, res: null, comment: '' }); save(); render(); }
      };
      $('[data-a=addphoto]', el).onclick = async () => { const recs = await addPhotos(form.projectId, { source: form.ref || form.title }); if (recs.length) { form.photoIds.push(...recs.map(r => r.id)); save(); render(); } };
      $$('.thumbs .t[data-id]', el).forEach(t => t.onclick = async (e) => {
        const id = t.dataset.id;
        if (e.target.closest('[data-del]')) { if (await confirmBox('Supprimer cette photo ?')) { form.photoIds = form.photoIds.filter(x => x !== id); await DB.del('files', id); save(); render(); } return; }
        showGallery(photos.map(f => ({ src: BlobURL.get(f.id, f.blob), caption: form.ref || form.title })), photos.findIndex(p => p.id === id));
      });
      $('[data-a=pdf]', el).onclick = async () => { await flush(); formPdf(form); };
      const rb = $('[data-a=res]', el); if (rb) rb.onclick = async () => { await flush(); const n = await pvMakeReserves(form); toast(`${n} réserve(s) créée(s) ✓ — voir Réserves`); render(); };
      const cv = $('[data-a=cv]', el); if (cv) cv.onclick = async () => {
        await flush();
        const items = form.items.filter(i => i.res === 'nok' || i.res === 'res').map(i => ({ sec: i.sec, label: i.label, res: null, comment: '', was: i.comment || '' }));
        const mes = form.mes.filter(m => pvMesOk(m) === false).map(m => ({ ...m, v: '', taskId: null }));
        const f2 = await pvCreate(project, { tpl: form.templateId, parent: form.id, items, mes, niv: form.niv, ouv: form.location, lotId: form.lotId, companyId: form.companyId });
        if (!f2) return; f2.title = form.title + ' (contre-visite)'; await DB.put('forms', f2);
        unBack(); el.remove(); await openPvDetail(f2); resolve();
      };
      $('[data-a=share]', el).onclick = () => {
        const mark = { ok: '✅', nok: '❌', res: '🟠', na: '➖' };
        shareWhatsApp(`*${project.name}*\n*${form.ref ? form.ref + ' · ' : ''}${form.title}*\n${[form.niv, form.location].filter(Boolean).join(' · ')}\nDate : ${fmtDate(form.date)}${form.inspector ? ' · ' + form.inspector : ''}\nRésultat : *${s.status}*\n\n` +
          form.items.filter(it => it.res && it.res !== 'ok' || it.comment).map(it => `${mark[it.res] || '⬜'} ${it.label}${it.comment ? ' — ' + it.comment : ''}`).join('\n') +
          (form.mes.some(m => pvNum(m.v) != null) ? '\n\n' + form.mes.filter(m => pvNum(m.v) != null).map(m => `${pvMesOk(m) ? '✅' : '❌'} ${m.l} : ${m.v} ${m.u || ''} (${pvTol(m)})`).join('\n') : '') +
          (form.notes ? `\n\nObservations : ${form.notes}` : ''));
      };
      $('[data-a=more]', el).onclick = async () => {
        const v = await menu(form.ref || form.title, [{ label: 'Générer le PV (PDF)', icon: 'report', value: 'pdf' }, { label: 'Supprimer le PV', icon: 'trash', danger: true, value: 'del' }]);
        if (v === 'pdf') { await flush(); return formPdf(form); }
        if (v === 'del' && await confirmBox('Supprimer ce PV ?')) { clearTimeout(saveT); for (const id of form.photoIds) await DB.del('files', id); await DB.del('forms', form.id); unBack(); el.remove(); resolve(); }
      };
    }
    render();
  });
}
