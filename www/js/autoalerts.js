// SiteTeam — Centre d'automatisations : aperçu local, sans accès à une API externe.
// Aucun réglage n'active d'envoi tant que le backend sécurisé n'est pas déployé.
const AutoAlerts = (() => {
  const canaux = [
    { nom: 'SiteTeam', etat: 'Notifications locales existantes', actif: true },
    { nom: 'Telegram', etat: 'À connecter au serveur', actif: false },
    { nom: 'WhatsApp', etat: 'Meta Business à configurer', actif: false },
    { nom: 'Email', etat: 'À connecter au serveur', actif: false },
  ];
  const scenarios = [
    { id: 'debut', label: 'Début des travaux', avant: '1 heure avant', canal: 'SiteTeam' },
    { id: 'echeance', label: 'Échéance dépassée', avant: 'À la date prévue', canal: 'SiteTeam' },
    { id: 'critique', label: 'Alerte critique sur plan', avant: 'Dès synchronisation', canal: 'SiteTeam' },
    { id: 'reception', label: 'Réception programmée', avant: '1 jour avant', canal: 'SiteTeam' },
  ];
  function simuler(id) {
    const r = scenarios.find(x => x.id === id);
    if (!r) return null;
    // Retour déterministe, ne crée aucun événement ni notification.
    return { declencheur: r.label, condition: r.avant, action: 'Préparer une notification SiteTeam',
      whatsapp: 'désactivé', telegram: 'désactivé', reel: false };
  }
  // Lecture seule des rappels du projet actuellement ouvert : aucune modification ni envoi.
  function rappelsDuProjet(p, maintenant = new Date()) {
    if (!p || !Array.isArray(p.rappels)) return [];
    const base = new Date(maintenant).getTime();
    if (!Number.isFinite(base)) return [];
    return p.rappels.filter(x => x && !x.done && typeof x.at === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/.test(x.at))
      .map(x => { const d = new Date(x.at.length === 10 ? x.at + 'T23:59:59' : x.at);
        const t = d.getTime();
        return { id: String(x.id || ''), texte: String(x.text || '').slice(0, 180), date: x.at, statut: !Number.isFinite(t) ? 'invalide' : t < base ? 'retard' : t < base + 86400000 ? 'proche' : 'prévu', ts: t }; })
      .filter(x => Number.isFinite(x.ts))
      .sort((a, b) => a.ts - b.ts).slice(0, 20);
  }
  function open() {
    const projet = typeof App !== 'undefined' && App.project ? App.project : null;
    const rappels = rappelsDuProjet(projet);
    const s = sheet(`<div style="padding:4px 16px 20px">
      <p style="margin:4px 0 12px;color:var(--muted)">Configuration en préparation. Aucun envoi WhatsApp ou Telegram n'est activé.</p>
      <h4 style="margin:12px 0 8px">Canaux de notification</h4>
      ${canaux.map(c => `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line, #d1d5db)">
        <span><b>${esc(c.nom)}</b><small style="display:block;color:var(--muted)">${esc(c.etat)}</small></span>
        <span style="font-size:12px;color:var(--muted)">${c.actif ? 'Existant' : 'Non configuré'}</span></div>`).join('')}
      <h4 style="margin:18px 0 8px">Rappels du projet ouvert</h4>
      ${!projet ? '<p style="color:var(--muted)">Ouvrez un projet pour consulter ses rappels.</p>' :
        rappels.length ? rappels.map(r => `<div style="padding:9px 0;border-bottom:1px solid var(--line, #d1d5db)"><b>${esc(r.texte || 'Rappel')}</b><small style="display:block;color:var(--muted)">${esc(r.date)} · ${esc(r.statut)} · Aucun envoi externe</small></div>`).join('') :
        '<p style="color:var(--muted)">Aucun rappel daté en attente dans ce projet.</p>'}
      <h4 style="margin:18px 0 8px">Scénarios de workflow</h4>
      ${scenarios.map(r => `<button class="opt" data-auto-sim="${r.id}" style="width:100%;text-align:left"><span><b>${esc(r.label)}</b><small style="display:block;color:var(--muted)">${esc(r.avant)} · Mode simulation</small></span></button>`).join('')}
      <div data-auto-result role="status" aria-live="polite" style="margin:12px 0;color:var(--muted)">Choisissez un scénario pour afficher son fonctionnement simulé.</div>
      <p style="font-size:12px;color:var(--muted)">Les notifications locales déjà en place restent inchangées. Les envois externes exigent un serveur, un consentement et des identifiants sécurisés.</p>
    </div>`, { title: 'Alertes & automatisations' });
    $$('[data-auto-sim]', s.el).forEach(b => b.onclick = () => {
      const d = simuler(b.dataset.autoSim), el = $('[data-auto-result]', s.el);
      if (d && el) el.textContent = 'Si : ' + d.declencheur + ' · ' + d.condition + ' → ' + d.action + '. WhatsApp / Telegram : désactivés.';
    });
    return s;
  }
  return Object.freeze({ open, simuler, rappelsDuProjet, canaux: () => canaux.map(c => ({ ...c })) });
})();
