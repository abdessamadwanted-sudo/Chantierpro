// SiteTeam Document Studio — noyau de modèles paramétrables (sans dépendance).
// Ne remplace pas fiches.js, pvgen.js ou bon.js : intégration progressive après revue.
// Les permissions doivent TOUJOURS être vérifiées par Team + règles Firestore/Storage.
(function (root) {
  'use strict';
  const TYPES = ['texte', 'nombre', 'date', 'liste', 'case', 'signature', 'photo'];
  const STATUTS = ['brouillon', 'soumis', 'valide', 'rejete', 'archive'];
  const CIRCUIT = {
    brouillon: ['soumis'],
    soumis: ['valide', 'rejete'],
    rejete: ['brouillon'],
    valide: ['archive'],
    archive: []
  };
  function copie(v) { return JSON.parse(JSON.stringify(v)); }
  function ident(s) { return /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(String(s || '')); }
  function texte(v, max) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max; }
  function modele(data) {
    if (!data || !ident(data.id) || !texte(data.nom, 160)) throw Error('Identité du modèle invalide');
    if (!ident(data.entrepriseId) || !ident(data.serviceId)) throw Error('Périmètre entreprise/service requis');
    const champs = data.champs || [];
    if (!Array.isArray(champs) || champs.length > 150) throw Error('Nombre de champs invalide');
    const ids = new Set();
    for (const f of champs) {
      if (!ident(f.id) || ids.has(f.id) || !TYPES.includes(f.type) || !texte(f.libelle, 160)) throw Error('Champ invalide ou dupliqué');
      ids.add(f.id);
      if (f.type === 'liste' && (!Array.isArray(f.options) || !f.options.length || f.options.length > 100 || f.options.some(x => !texte(x, 120)))) throw Error('Options invalides');
      if (f.position) position(f.position);
    }
    return { schemaVersion: 1, id: data.id, nom: data.nom.trim(), entrepriseId: data.entrepriseId, serviceId: data.serviceId,
      projetId: data.projetId || null, version: Number.isInteger(data.version) && data.version > 0 ? data.version : 1,
      categorie: data.categorie || 'document', pdfFileId: data.pdfFileId || null, champs: copie(champs),
      circuit: copie(CIRCUIT) };
  }
  // Coordonnées PDF normalisées, origine en haut à gauche, indépendantes du zoom.
  function position(p) {
    if (!p || !Number.isInteger(p.page) || p.page < 1 || p.page > 1000 ||
      !['x','y','w','h'].every(k => Number.isFinite(p[k]) && p[k] >= 0 && p[k] <= 1) ||
      p.w <= 0 || p.h <= 0 || p.x + p.w > 1.000001 || p.y + p.h > 1.000001) throw Error('Position PDF invalide');
    return copie(p);
  }
  function enPoints(p, largeur, hauteur) {
    position(p);
    if (!(largeur > 0 && hauteur > 0)) throw Error('Dimensions PDF invalides');
    return { page: p.page, x: p.x * largeur, y: p.y * hauteur, w: p.w * largeur, h: p.h * hauteur };
  }
  function remplir(tpl, valeurs, contexte) {
    const T = modele(tpl), V = valeurs || {}, C = contexte || {};
    if (C.entrepriseId !== T.entrepriseId || (T.projetId && C.projetId !== T.projetId)) throw Error('Périmètre interdit');
    const permis = new Set(T.champs.map(f => f.id));
    if (Object.keys(V).some(k => !permis.has(k))) throw Error('Champ inconnu');
    const out = {};
    for (const f of T.champs) {
      const v = V[f.id];
      if (f.obligatoire && (v === null || v === undefined || v === '')) throw Error('Champ obligatoire : ' + f.id);
      if (v === undefined || v === null || v === '') continue;
      if (f.type === 'nombre' && (typeof v !== 'number' || !Number.isFinite(v))) throw Error('Nombre invalide : ' + f.id);
      if (f.type === 'case' && typeof v !== 'boolean') throw Error('Case invalide : ' + f.id);
      if (f.type === 'date' && (typeof v !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(v) || Number.isNaN(Date.parse(v + 'T00:00:00Z')))) throw Error('Date invalide : ' + f.id);
      if (f.type === 'liste' && !f.options.includes(v)) throw Error('Option inconnue : ' + f.id);
      if (['texte','signature','photo'].includes(f.type) && (typeof v !== 'string' || v.length > 5000)) throw Error('Valeur invalide : ' + f.id);
      // signature = référence d'un fichier authentifié, pas une valeur signée juridiquement.
      out[f.id] = v;
    }
    return { modeleId: T.id, modeleVersion: T.version, entrepriseId: T.entrepriseId, projetId: C.projetId || null,
      valeurs: out, statut: 'brouillon', historique: [] };
  }
  function transition(dossier, suivant, acteur, horodatage, autorise) {
    if (!dossier || !STATUTS.includes(dossier.statut) || !STATUTS.includes(suivant) ||
      !CIRCUIT[dossier.statut].includes(suivant)) throw Error('Transition interdite');
    if (autorise !== true || !texte(acteur, 160)) throw Error('Validation des droits requise');
    const D = copie(dossier);
    D.historique = Array.isArray(D.historique) ? D.historique : [];
    D.historique.push({ de: D.statut, vers: suivant, acteur, date: horodatage || new Date().toISOString() });
    D.statut = suivant;
    return D;
  }
  function nouveauSuivi(id, entrepriseId, serviceId, nom, champs) {
    return modele({ id, entrepriseId, serviceId, nom, categorie: 'suivi', champs });
  }
  root.DocumentStudio = Object.freeze({ TYPES: TYPES.slice(), modele, position, enPoints, remplir, transition, nouveauSuivi });
})(typeof globalThis !== 'undefined' ? globalThis : window);
