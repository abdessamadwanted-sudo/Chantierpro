// ================= Choix du pack (Super Admin) : écran « Avec quel pack voulez-vous entrer ? » =================
//   Après la connexion, le propriétaire choisit un pack (Basic / Pro / Business / Enterprise) ou « Tous les packs » et entre dans l'application comme ce pack.
//   Simulation d'affichage uniquement (même mécanisme que « Pack de travail ») : aucun abonnement ni droit réel n'est modifié. Désactivable (« Ne plus me demander »).
const PackPick = (() => {
  const ASK = 'st.packask', SEEN = 'st.packasked';
  const wanted = () => { try { return localStorage.getItem(ASK) !== '0'; } catch (e) { return true; } };
  const setWanted = (on) => { try { localStorage.setItem(ASK, on ? '1' : '0'); } catch (e) {} };
  const seen = () => { try { return sessionStorage.getItem(SEEN) === '1'; } catch (e) { return false; } };
  const markSeen = (v = true) => { try { v ? sessionStorage.setItem(SEEN, '1') : sessionStorage.removeItem(SEEN); } catch (e) {} };
  // décision pure (testée) : proposer l'écran seulement au Super Admin, une fois par connexion, si le réglage est actif et aucun aperçu n'est déjà choisi
  const shouldAsk = (st) => !!(st && st.ready && st.isSuper && st.wanted && !st.seen && !st.preview);
  const cards = (cur) => [{ k: '__all', e: '👑', l: 'Tous les packs', f: 'Super Admin : tout est visible', on: !cur }, ...Object.values(PLANS).map(P => ({ k: P.k, e: P.e || '', l: P.l, f: (P.for || '') + (planDev(P) ? ' · en développement' : ''), on: !!cur && planOf(cur.plan).k === P.k }))];
  function open(opts = {}) {
    if (typeof Team === 'undefined' || !Team.ready() || !Team.isSuper()) return null;
    const cur = ST.preview(), el = document.createElement('div'); el.className = 'fullpage pp-pg';
    el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('back')}</button><h1>Choisir le pack</h1></div>
      <div class="pp-body"><p class="pp-i">Avec quel pack voulez-vous entrer ? <small>Simulation d'affichage : votre abonnement et vos droits réels ne changent pas.</small></p>
        ${cards(cur).map(c => `<button class="pp-c ${c.on ? 'on' : ''}" data-k="${esc(c.k)}"><span class="e">${c.e}</span><span class="grow"><b>${esc(c.l)}${c.on ? ' ✓' : ''}</b><small>${esc(c.f)}</small></span><i>›</i></button>`).join('')}
        <button class="linkbtn" data-a="never">${wanted() ? 'Ne plus me demander à chaque connexion' : 'Me demander à chaque connexion'}</button></div>`;
    document.body.appendChild(el); markSeen();
    let closed = false; const unBack = pushBack(() => shut());
    function shut() { if (closed) return; closed = true; try { unBack(); } catch (e) {} el.remove(); if (opts.onClose) opts.onClose(); }
    el.querySelector('[data-a=x]').onclick = shut;
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { shut(); ST.setPack(b.dataset.k); });
    el.querySelector('[data-a=never]').onclick = () => { setWanted(!wanted()); toast(wanted() ? 'Écran de choix activé' : 'Écran de choix désactivé'); shut(); };
    return { el, close: shut };
  }
  function maybe() { if (typeof Team === 'undefined' || !Team.ready()) return null; const st = { ready: true, isSuper: Team.isSuper(), wanted: wanted(), seen: seen(), preview: ST.preview() }; return shouldAsk(st) ? open() : (markSeen(), null); }
  return { open, maybe, shouldAsk, cards, wanted, setWanted, markSeen };
})();
