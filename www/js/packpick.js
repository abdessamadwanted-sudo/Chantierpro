// ================= Choix du pack (Super Admin) : écran « Avec quel pack voulez-vous entrer ? » =================
//   Entrée réelle — Basic / Pro / Business / Enterprise sont 4 comptes réels et permanents sous l'identité du Super
//   Admin (Team.ensurePackAccount) : Basic/Pro/Business vides au départ (construits à la main) ; Enterprise N'EST PAS
//   un nouveau compte, c'est le compte d'origine réel du Super Admin (ses vrais projets, ex. « Grand stade
//   Casablanca », inchangés). Choisir une carte bascule réellement dans ce compte (Team.switchTo). « Tous les packs »
//   reste la vue documentaire existante (Architecture Studio), inchangée, car elle ne correspond à aucun compte réel.
//   Design : réutilise la carte d'offre existante (offerCard, team.js — même visuel que l'écran de bienvenue et
//   l'onglet Pro). Business et Enterprise affichent leur verrou 🔒 pour tout le monde, y compris le Super Admin (pour
//   la cohérence visuelle avec ce que voit un client) — lui seul peut malgré tout appuyer dessus (offerCard reçoit
//   canAct:true) pour construire ce que ces packs doivent contenir ; un compte non Super Admin ne voit jamais cet
//   écran (voir « open » ci-dessous), donc le verrou y est réel pour lui.
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
  // carte « Tous les packs » : bouton simple existant (aucun PLANS entry, pas de carte d'offre) ; les 4 packs réels utilisent offerCard
  const allCardHTML = (c) => `<button class="pp-c ${c.on ? 'on' : ''}" data-k="${esc(c.k)}">
      <span class="e">${c.e}</span>
      <span class="grow"><b>${esc(c.l)}</b><small>${esc(c.f)}</small></span><i>›</i>
    </button>`;
  function open(opts = {}) {
    if (typeof Team === 'undefined' || !Team.ready() || !Team.isSuper()) return null;
    const cur = ST.preview(), acc = Team.packAccounts(), C = cards(cur, acc), el = document.createElement('div'); el.className = 'fullpage pp-pg';
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1>Choisir le pack</h1></div>
      <div class="pp-body">
        <p class="pp-i">Avec quel pack voulez-vous entrer ? <small>Basic, Pro, Business et Enterprise sont des comptes réels et permanents, séparés de vos autres espaces — vous y entrez vraiment, vous y construisez ce que vous voulez. Business et Enterprise restent verrouillés pour tout le monde ; vous seul pouvez les ouvrir.</small></p>
        ${allCardHTML(C[0])}
        <div class="st-offers">${C.slice(1).map(c => offerCard(planFor(PLANS[c.k], false), false, true, { forceLock: c.locked, canAct: true, current: c.on })).join('')}</div>
        <button class="linkbtn" data-a="never">${wanted() ? 'Ne plus me demander à chaque connexion' : 'Me demander à chaque connexion'}</button>
      </div>`;
    document.body.appendChild(el); markSeen();
    let closed = false; const unBack = pushBack(() => shut());
    function shut() { if (closed) return; closed = true; try { unBack(); } catch (e) {} el.remove(); if (opts.onClose) opts.onClose(); }
    el.querySelector('[data-a=x]').onclick = shut;
    el.querySelector('[data-k=__all]').onclick = () => { shut(); ST.setPack('__all'); if (typeof Studio !== 'undefined') Studio.open({ pack: 'Enterprise', onClose: () => open() }); };
    // offerCard : data-p pour les 4 packs réels (toujours actionnable ici, même verrouillé — canAct:true) ; la carte « espace actuel » n'a pas de bouton
    el.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => {
      const k = b.dataset.p;
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
