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
  // v1.0.? : écran obligatoire à CHAQUE démarrage pour le Super Admin — plus de case « ne plus me demander » ni de
  // mémorisation « déjà vu cette session » (l'ancienne logique sessionStorage pouvait survivre à une relance de l'app
  // quand Android garde le processus en vie, donnant l'impression que l'écran « ne revenait plus »). Le propriétaire
  // a demandé explicitement : à chaque fermeture/réouverture, cet écran s'affiche, sans exception, sans réglage.
  const ASK = 'st.packask';   // conservé uniquement pour compat (ancien réglage, plus lu nulle part)
  const wanted = () => { try { return localStorage.getItem(ASK) !== '0'; } catch (e) { return true; } };
  const setWanted = (on) => { try { localStorage.setItem(ASK, on ? '1' : '0'); } catch (e) {} };
  // décision pure (testée) : proposer l'écran au Super Admin, à chaque démarrage, sans condition autre que « prêt »
  const shouldAsk = (st) => !!(st && st.ready && st.isSuper);
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
      </div>`;
    document.body.appendChild(el);
    let closed = false; const unBack = pushBack(() => shut());
    function shut() { if (closed) return; closed = true; try { unBack(); } catch (e) {} el.remove(); if (opts.onClose) opts.onClose(); }
    el.querySelector('[data-a=x]').onclick = shut;
    el.querySelector('[data-k=__all]').onclick = () => { shut(); ST.setPack('__all'); if (typeof Studio !== 'undefined') Studio.open({ pack: 'Enterprise', onClose: () => open() }); };
    // offerCard : data-p pour les 4 packs réels (toujours actionnable ici, même verrouillé — canAct:true) ; la carte « espace actuel » n'a pas de bouton
    el.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => {
      const k = b.dataset.p, P = PLANS[k];
      b.disabled = true;
      // v1.0.? : retour visuel IMMÉDIAT dès le tap, avant le moindre appel réseau — sur 4G, ensurePackAccount/switchTo
      // peuvent prendre quelques secondes sans que rien ne bouge à l'écran autrement, ce qui a fait croire au propriétaire
      // que le tap n'avait rien fait (il tapait une 2e fois, appuyait sur « retour »… pendant que l'entrée se faisait déjà).
      const ld = loading('Entrée dans ' + (P && P.l ? P.l : k) + '…');
      try {
        const cid = await Team.ensurePackAccount(k);
        if (!cid) return;   // échec déjà signalé (alertBox) par ensurePackAccount
        try { sessionStorage.removeItem('st.preview'); } catch (e) {}
        shut();
        await Team.switchTo(cid);   // changement d'espace réel (affiche son propre overlay, puis recharge l'application dans ce compte)
      } finally { b.disabled = false; ld.close(); }
    });
    // v1.0.? : le propriétaire tape n'importe où sur la carte (pas seulement le petit bouton tout en bas, après la liste
    // des outils) et s'attend à entrer directement — carte entière cliquable, sauf la zone « Outils inclus » (details/summary,
    // qui doit garder son propre rôle d'ouverture/fermeture de la liste) et le bouton lui-même (déjà géré ci-dessus, pour ne
    // pas déclencher l'action deux fois). Carte « espace actuel » (pas de bouton data-p) : aucune action, déjà dedans.
    el.querySelectorAll('.st-offer').forEach(card => {
      const b = card.querySelector('[data-p]');
      if (!b) return;
      card.classList.add('pp-tap');
      card.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-p], [data-req], details, summary')) return;
        b.click();
      });
    });
    return { el, close: shut };
  }
  function maybe() { if (typeof Team === 'undefined' || !Team.ready()) return null; const st = { ready: true, isSuper: Team.isSuper() }; return shouldAsk(st) ? open() : null; }
  return { open, maybe, shouldAsk, cards, wanted, setWanted };
})();
