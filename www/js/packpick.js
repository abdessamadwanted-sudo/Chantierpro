// ================= Choix du pack (Super Admin) : écran « Avec quel pack voulez-vous entrer ? » =================
//   v1.0.? : entrée réelle — Basic / Pro / Business / Enterprise sont 4 comptes réels et permanents, créés une seule
//   fois sous l'identité du Super Admin (Team.ensurePackAccount), vides au départ (il y construit lui-même ses
//   projets de test). Choisir une carte bascule réellement dans ce compte (Team.switchTo) : ce n'est plus une
//   simulation d'affichage. « Tous les packs » reste la vue documentaire existante (Architecture Studio), inchangée,
//   car elle ne correspond à aucun compte réel.
//   Business et Enterprise affichent un verrou 🔒 pour tout le monde, y compris le Super Admin : lui seul peut
//   malgré tout appuyer dessus (pour les construire) ; un compte non Super Admin ne voit jamais cet écran (voir
//   « open » ci-dessous), donc le verrou y est réel pour lui.
const PackPick = (() => {
  const ASK = 'st.packask', SEEN = 'st.packasked';
  const wanted = () => { try { return localStorage.getItem(ASK) !== '0'; } catch (e) { return true; } };
  const setWanted = (on) => { try { localStorage.setItem(ASK, on ? '1' : '0'); } catch (e) {} };
  const seen = () => { try { return sessionStorage.getItem(SEEN) === '1'; } catch (e) { return false; } };
  const markSeen = (v = true) => { try { v ? sessionStorage.setItem(SEEN, '1') : sessionStorage.removeItem(SEEN); } catch (e) {} };
  // décision pure (testée) : proposer l'écran seulement au Super Admin, une fois par connexion, si le réglage est actif et aucun aperçu n'est déjà choisi
  const shouldAsk = (st) => !!(st && st.ready && st.isSuper && st.wanted && !st.seen && !st.preview);
  const cards = (cur, acc) => [
    { k: '__all', e: '👑', l: 'Tous les packs', f: 'Catalogue complet (vue Super Admin, simulation d\'affichage)', on: !cur, locked: false },
    ...Object.values(PLANS).map(P => ({ k: P.k, e: P.e || '', l: P.l, f: P.for || '', on: !cur && !!acc && acc[P.k] && acc[P.k] === Team.cid(), locked: planDev(P) })),
  ];
  function cardHTML(c) {
    return `<button class="pp-c ${c.on ? 'on' : ''} ${c.locked ? 'lk' : ''}" data-k="${esc(c.k)}">
      <span class="e">${c.e}</span>
      <span class="grow"><b>${esc(c.l)}${c.on ? ' <span class="pp-chk">✓ espace actuel</span>' : ''}</b><small>${esc(c.f)}</small></span>
      ${c.locked ? `<span class="pp-lock" title="En développement — réservé au Super Admin pour construire ce pack">${icon('lock')}</span>` : '<i>›</i>'}
    </button>`;
  }
  function open(opts = {}) {
    if (typeof Team === 'undefined' || !Team.ready() || !Team.isSuper()) return null;
    const cur = ST.preview(), acc = Team.packAccounts(), el = document.createElement('div'); el.className = 'fullpage pp-pg';
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1>Choisir le pack</h1></div>
      <div class="pp-body">
        <p class="pp-i">Avec quel pack voulez-vous entrer ? <small>Basic, Pro, Business et Enterprise sont des comptes réels et permanents, séparés de vos autres espaces — vous y entrez vraiment, vous y construisez ce que vous voulez. Business et Enterprise restent verrouillés pour tout le monde ; vous seul pouvez les ouvrir.</small></p>
        ${cards(cur, acc).map(cardHTML).join('')}
        <button class="linkbtn" data-a="never">${wanted() ? 'Ne plus me demander à chaque connexion' : 'Me demander à chaque connexion'}</button>
      </div>`;
    document.body.appendChild(el); markSeen();
    let closed = false; const unBack = pushBack(() => shut());
    function shut() { if (closed) return; closed = true; try { unBack(); } catch (e) {} el.remove(); if (opts.onClose) opts.onClose(); }
    el.querySelector('[data-a=x]').onclick = shut;
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = async () => {
      const k = b.dataset.k;
      // « Tous les packs » : vue documentaire existante (Architecture Studio), aucun compte réel associé — inchangé
      if (k === '__all') { shut(); ST.setPack('__all'); if (typeof Studio !== 'undefined') Studio.open({ pack: 'Enterprise', onClose: () => open() }); return; }
      if (b.classList.contains('on')) return shut();
      b.disabled = true;
      const cid = await Team.ensurePackAccount(k);
      b.disabled = false;
      if (!cid) return;   // échec déjà signalé (alertBox) par ensurePackAccount
      try { sessionStorage.removeItem('st.preview'); } catch (e) {}
      shut();
      await Team.switchTo(cid);   // changement d'espace réel (recharge l'application dans ce compte)
    });
    el.querySelector('[data-a=never]').onclick = () => { setWanted(!wanted()); toast(wanted() ? 'Écran de choix activé' : 'Écran de choix désactivé'); shut(); };
    return { el, close: shut };
  }
  function maybe() { if (typeof Team === 'undefined' || !Team.ready()) return null; const st = { ready: true, isSuper: Team.isSuper(), wanted: wanted(), seen: seen(), preview: ST.preview() }; return shouldAsk(st) ? open() : (markSeen(), null); }
  return { open, maybe, shouldAsk, cards, wanted, setWanted, markSeen };
})();
