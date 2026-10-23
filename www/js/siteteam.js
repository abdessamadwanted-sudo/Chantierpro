// ================= SiteTeam : adaptation des outils de l'application Chantier =================
// SiteTeam reprend tous les outils de Chantier. Différences :
//  - l'identité et les droits viennent du compte SiteTeam (Firebase : entreprise, poste, droits par module),
//    pas des licences « CH- » ni du choix de poste local de Chantier ;
//  - une rubrique n'apparaît que si le poste SiteTeam y donne accès (Team.canSection), en plus des
//    réglages « Fonctions affichées » du téléphone et des fonctions du projet.
// Les interfaces par service / pack seront construites ensuite à partir de ce point unique.
(function () {
  // les licences Chantier ne s'appliquent pas : tout ce que le compte SiteTeam autorise est disponible
  if (typeof Org !== 'undefined') Org.owner = () => true;

  // 1er démarrage : pas d'écran « service → poste » de Chantier (le poste vient de l'invitation SiteTeam).
  // Le choix reste possible à la demande (bouton d'accueil) pour l'ordre du menu.
  if (typeof orgOnboard === 'function') {
    const ob = orgOnboard;
    window.orgOnboard = (force) => (force ? ob(force) : Promise.resolve());
  }

  // rubriques : droits SiteTeam en plus des réglages de Chantier
  if (typeof sectionOn === 'function') {
    const so = sectionOn;
    window.sectionOn = (k) => so(k) && (typeof Team === 'undefined' || Team.canSection(k));
  }
})();
