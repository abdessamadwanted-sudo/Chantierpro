// ================= v1.0.43 — Réseau professionnel : mes contacts BTP réunis (organisation, projets, sous-traitants, contacts perso) =================
// Tout reste sur le téléphone / l'espace de l'entreprise. Profils publics et messages entre comptes : prochaine étape (règles serveur à valider).
const RS_KEY = 'reseau.contacts';
const rsMine = () => { try { return JSON.parse(localStorage.getItem(RS_KEY) || '[]') || []; } catch (e) { return []; } };
const rsSave = (L) => { try { localStorage.setItem(RS_KEY, JSON.stringify(L)); } catch (e) { toast('Mémoire du téléphone pleine'); } };
const rsTel = (s) => { const m = String(s || '').match(/(\+?\d[\d .-]{7,}\d)/); return m ? m[1].replace(/[ .-]/g, '') : ''; };
const rsWa = (t) => { let n = t.replace(/^\+/, ''); if (/^0[5-7]\d{8}$/.test(n)) n = '212' + n.slice(1); return n; };

async function rsCollect() {
  const out = [], seen = new Set();
  const add = (c) => { const k = (c.name || '').toLowerCase().trim() + '|' + (c.tel || c.email || ''); if (!c.name || seen.has(k)) return; seen.add(k); out.push(c); };
  for (const [i, c] of rsMine().entries()) add({ ...c, src: 'me', idx: i, tel: c.tel || '' });
  const meU = Team.ready() ? Team.uid() : '';
  if (Team.ready() && !Team.isPerso()) for (const m of (Team.members() || [])) if (m.uid !== meU) {
    const R = typeof tmRoleOf === 'function' ? tmRoleOf(m.role) : null;
    add({ name: m.name || m.email, sub: [R && R.l, (Team.company() || {}).name].filter(Boolean).join(' · '), email: m.email || '', tel: m.phone || '', src: 'org' });
  }
  const projects = (await DB.all('projects')).filter(p => !p.deleted && (!Team.ready() || Team.canProject(p.id)));
  for (const p of projects) {
    for (const t of (p.team || [])) add({ name: t.name, sub: [t.role, p.name].filter(Boolean).join(' · '), tel: t.phone || '', src: 'proj' });
    for (const c of (p.companies || [])) add({ name: c.name, sub: [c.lot, p.name].filter(Boolean).join(' · '), tel: rsTel(c.contact), contact: c.contact || '', src: 'ent' });
  }
  return out;
}

async function openReseau() {
  const el = document.createElement('div'); el.className = 'fullpage rs-page'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  let flt = 'all', q = '', L = await rsCollect();
  const SRC = { me: ['Mes contacts', '#8b5cf6'], org: ['Mon organisation', '#2563eb'], proj: ['Intervenants', '#0d9488'], ent: ['Entreprises & sous-traitants', '#ea580c'] };
  const HUE = ['#2563eb', '#0d9488', '#7c3aed', '#ea580c', '#db2777', '#0891b2'];
  const hue = (s) => HUE[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % HUE.length];
  const draw = () => {
    const d = typeof Dossier !== 'undefined' ? Dossier.get() : { name: '' }, sc = typeof Dossier !== 'undefined' ? Dossier.score(d) : 0;
    const n = (k) => L.filter(c => k === 'all' || c.src === k).length;
    const V = L.filter(c => (flt === 'all' || c.src === flt) && (!q || `${c.name} ${c.sub || ''} ${c.contact || ''}`.toLowerCase().includes(q)));
    el.innerHTML = `<div class="topbar"><button class="iconbtn" data-a="back">${icon('back')}</button><h1>Réseau</h1><button class="iconbtn" data-a="add">${icon('plus')}</button></div>
      <div class="content rs-c">
        <div class="rs-me"><span class="rs-av big" style="background:${hue(d.name)}">${d.photo ? `<img src="${esc(d.photo)}" alt="">` : esc(dpIni(d.name))}</span>
          <div class="grow"><b>${esc(d.name || 'Mon profil')}</b><small>${esc(d.titre || 'Ajoutez votre titre (ex : Conducteur de travaux)')}${d.ville ? ' · ' + esc(d.ville) : ''}</small>
          <span class="rs-bar"><i style="width:${sc}%"></i></span><em>Profil complété à ${sc}%</em></div></div>
        <div class="rs-acts"><button data-a="dossier">${icon('idcard')}<span>Mon dossier</span></button><button data-a="share">${icon('share')}<span>Partager mon profil</span></button><button data-a="invite">${icon('team')}<span>Inviter</span></button></div>
        <label class="rs-q">${icon('search')}<input data-q placeholder="Chercher un nom, un lot, une entreprise…" value="${esc(q)}"></label>
        <div class="rs-f">${[['all', 'Tous']].concat(Object.entries(SRC).map(([k, [l]]) => [k, l])).filter(([k]) => k === 'all' || n(k)).map(([k, l]) => `<button class="${flt === k ? 'on' : ''}" data-f="${k}">${esc(l)} <small>${n(k)}</small></button>`).join('')}</div>
        ${V.length ? `<div class="rs-list">${V.map((c, i) => `<div class="rs-row" data-i="${i}"><span class="rs-av" style="background:${hue(c.name)}">${esc(dpIni(c.name))}</span>
          <span class="grow"><b>${esc(c.name)}</b><small>${esc(c.sub || c.contact || '')}</small><i style="--c:${SRC[c.src][1]}">${esc(SRC[c.src][0])}</i></span>
          ${c.tel ? `<a class="rs-b" href="tel:${esc(c.tel)}" aria-label="Appeler">${icon('phone')}</a><a class="rs-b wa" href="https://wa.me/${esc(rsWa(c.tel))}" target="_blank" rel="noopener" aria-label="WhatsApp">💬</a>` : c.email ? `<a class="rs-b" href="mailto:${esc(c.email)}" aria-label="E-mail">✉️</a>` : ''}</div>`).join('')}</div>`
          : `<div class="empty">${L.length ? 'Aucun contact trouvé.' : 'Votre réseau se remplit tout seul avec les membres de votre organisation, les intervenants et les entreprises de vos projets.<br>Ajoutez aussi vos contacts avec <b>+</b>.'}</div>`}
        <div class="rs-soon"><b>🚀 Bientôt</b><span>Profils publics SiteTeam, recherche de professionnels BTP par métier et par ville, messages entre comptes.</span></div>
      </div>`;
    $('[data-a=back]', el).onclick = () => { unBack(); el.remove(); };
    const qi = $('[data-q]', el); qi.oninput = () => { q = qi.value.trim().toLowerCase(); const pos = qi.selectionStart; draw(); const n2 = $('[data-q]', el); n2.focus(); try { n2.setSelectionRange(pos, pos); } catch (e) {} };
    $$('[data-f]', el).forEach(b => b.onclick = () => { flt = b.dataset.f; draw(); });
    $('[data-a=dossier]', el).onclick = async () => { await openDossier(); L = await rsCollect(); draw(); };
    $('[data-a=share]', el).onclick = () => { if (typeof dpShare === 'function') dpShare(); };
    $('[data-a=invite]', el).onclick = () => shareWhatsApp(`Je suis sur SiteTeam, l'application des professionnels du BTP (projets, PV, réserves, équipes, emploi). Rejoins-moi : https://abdessamadwanted-sudo.github.io/Chantierpro/siteteam/`);
    $('[data-a=add]', el).onclick = () => edit(null);
    $$('.rs-row', el).forEach(r => r.onclick = (e) => { if (e.target.closest('a')) return; const c = V[+r.dataset.i]; if (c.src === 'me') edit(c.idx); else if (c.contact || c.sub) alertBox(`${c.name}\n${c.sub || ''}${c.contact ? '\n' + c.contact : ''}${c.email ? '\n' + c.email : ''}`); });
  };
  async function edit(idx) {
    const M = rsMine(), c = idx == null ? null : M[idx];
    const r = await formSheet(c ? 'Modifier le contact' : 'Nouveau contact', [
      { name: 'name', label: 'Nom', value: c ? c.name : '' },
      { name: 'sub', label: 'Métier / entreprise', value: c ? c.sub : '', placeholder: 'Ex : Chef de chantier · SGTM', list: ['Conducteur de travaux', 'Chef de chantier', 'Ingénieur', 'Technicien qualité', 'Topographe', 'Laboratoire', 'Architecte', 'Bureau d\'études', 'Sous-traitant', 'Fournisseur', 'Tâcheron'] },
      { name: 'tel', label: 'Téléphone', type: 'tel', value: c ? c.tel : '' },
      { name: 'email', label: 'E-mail', type: 'email', value: c ? c.email || '' : '' },
    ], { okLabel: 'Enregistrer', danger: c ? 'Supprimer le contact' : null });
    if (!r) return;
    if (r.__danger) M.splice(idx, 1);
    else if (r.name) { const o = { name: r.name.trim(), sub: r.sub.trim(), tel: r.tel.trim(), email: r.email.trim() }; if (c) M[idx] = o; else M.unshift(o); }
    rsSave(M); L = await rsCollect(); draw();
  }
  draw();
  return el;
}
