/* SiteTeam — catalogue des organisations et services (configuration métier).
 * Cette configuration décrit l'interface ; elle ne confère aucun droit Firebase.
 * Les abonnements et permissions restent contrôlés séparément côté serveur.
 */
(function (global) {
  'use strict';
  const TYPES = Object.freeze({
    entreprise: { label: 'Entreprise BTP', icon: '🏗️', services: ['travaux','qualite','hse','methodes','planning','materiel','achats','topographie','finance','rh'] },
    bet: { label: 'Bureau d’Études Techniques', icon: '📐', services: ['etudes_structure','etudes_techniques','plans_dao','calculs_notes','visa_plans','suivi_technique','synthese','rfi'] },
    archi: { label: 'Cabinet d’Architecture', icon: '🏛️', services: ['conception','plans_architecturaux','bim','visa_architecte','suivi_architectural','finitions','coordination'] },
    bc: { label: 'Bureau de Contrôle', icon: '🔎', services: ['controle_technique','avis_techniques','inspections','visas_rapports','reserves','levee_reserves'] },
    labo: { label: 'Laboratoire BTP', icon: '🧪', services: ['essais_beton','essais_sol','prelevements','resultats','rapports','tracabilite'] },
    opc: { label: 'OPC', icon: '📅', services: ['planning_general','coordination','reunions','suivi_avancement','retards','reporting'] },
    moa: { label: 'Maîtrise d’Ouvrage', icon: '🏢', services: ['portefeuille_projets','budget_contrats','validations','suivi_global','decisions','receptions'] },
    topo: { label: 'Cabinet Topographique', icon: '📍', services: ['implantations','releves','controles_geometriques','plans_topo','rapports'] }
  });
  const LABELS = Object.freeze({
    travaux:'Travaux',qualite:'Qualité',hse:'HSE',methodes:'Méthodes',planning:'Planning',materiel:'Matériel',achats:'Achats',topographie:'Topographie',finance:'Finance',rh:'RH',
    etudes_structure:'Études Structure',etudes_techniques:'Études Techniques',plans_dao:'Plans / DAO',calculs_notes:'Calculs / Notes',visa_plans:'Visa Plans',suivi_technique:'Suivi Technique',synthese:'Synthèse',rfi:'RFI',
    conception:'Conception',plans_architecturaux:'Plans architecturaux',bim:'BIM',visa_architecte:'Visa Architecte',suivi_architectural:'Suivi architectural',finitions:'Finitions',coordination:'Coordination',
    controle_technique:'Contrôle technique',avis_techniques:'Avis techniques',inspections:'Inspections',visas_rapports:'Visas / Rapports',reserves:'Réserves',levee_reserves:'Levée réserves',
    essais_beton:'Essais béton',essais_sol:'Essais sol',prelevements:'Prélèvements',resultats:'Résultats',rapports:'Rapports',tracabilite:'Traçabilité',
    planning_general:'Planning général',reunions:'Réunions',suivi_avancement:'Suivi avancement',retards:'Retards',reporting:'Reporting',
    portefeuille_projets:'Portefeuille projets',budget_contrats:'Budget / Contrats',validations:'Validations',suivi_global:'Suivi global',decisions:'Décisions',receptions:'Réceptions',
    implantations:'Implantations',releves:'Relevés',controles_geometriques:'Contrôles géométriques',plans_topo:'Plans topo'
  });
  // Clés conformes à ORG_TYPES de team.js ; aucune conversion implicite de formule commerciale.
  function organisationTypes() {
    return Object.keys(TYPES).map(id => ({ id, label:TYPES[id].label, icon:TYPES[id].icon }));
  }
  function servicesFor(type) {
    const entry = TYPES[type];
    return entry ? entry.services.map(id => ({ id, label:LABELS[id] })) : [];
  }
  function selectionValide(type, services) {
    return !!TYPES[type] && Array.isArray(services) &&
      services.every(id => typeof id === 'string' && TYPES[type].services.includes(id)) &&
      new Set(services).size === services.length;
  }
  const api = Object.freeze({ organisationTypes, servicesFor, selectionValide });
  global.SiteTeamCatalogueOrganisations = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
