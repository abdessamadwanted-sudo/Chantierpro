// ================= Catalogue technique BTP (familles → lots techniques) =================
// Référentiel interne proposé pour organiser un projet (familles techniques, lots, modèles par type de projet).
// Codes INTERNES à l'application (pas une nomenclature officielle). Catalogue non exhaustif, pensé pour être complété.
// Statut : données + fonctions pures ci-dessous, PAS ENCORE reliées à un écran (pas d'assistant de création, pas de
// fiche de lot, pas de moteur de suggestion automatique) — voir la synthèse livrée séparément pour le détail.

const CAT_FAMILIES = [
  { id: 'PRE', l: 'Préparation et travaux préalables', lots: ['Installation de chantier', 'Démolition / déconstruction', 'Curage', 'Défrichage', 'Protection et déviation des réseaux existants'] },
  { id: 'TER', l: 'Terrassements et géotechnique', lots: ['Terrassements généraux', 'Fouilles et remblais', 'Soutènements', 'Amélioration des sols', 'Rabattement de nappe'] },
  { id: 'STR', l: 'Gros œuvre / Structure', lots: ['Fondations superficielles', 'Fondations profondes', 'Infrastructure / substructure', 'Superstructure en béton armé', 'Éléments préfabriqués', 'Maçonnerie porteuse', 'Charpente métallique', 'Charpente bois', 'Précontrainte', 'Réparation et renforcement structurel'] },
  { id: 'ENV', l: 'Enveloppe / Clos et couvert', lots: ['Couverture', 'Façades et bardage', 'Murs-rideaux', 'Menuiseries extérieures et vitrages associés', 'Étanchéité des parties enterrées', 'Étanchéité des toitures et terrasses', 'Étanchéité des locaux humides', 'Isolation de l\'enveloppe', 'Protections solaires'] },
  { id: 'SOE', l: 'Second œuvre architectural', lots: ['Maçonnerie non porteuse', 'Cloisons et doublages', 'Enduits', 'Plâtrerie, staff et ouvrages en plâtre', 'Faux plafonds', 'Chapes et supports de revêtement', 'Revêtements de sols', 'Revêtements muraux', 'Peinture et finitions', 'Menuiseries intérieures', 'Serrurerie et métallerie de finition', 'Agencement et mobilier fixe', 'Signalétique'] },
  { id: 'PLB', l: 'Plomberie sanitaire', lots: ['Eau froide', 'Eau chaude sanitaire', 'Appareils sanitaires', 'Évacuations intérieures EU/EV', 'Évacuations EP du bâtiment', 'Stockage et surpression', 'Traitement d\'eau du bâtiment'] },
  { id: 'CVC', l: 'Chauffage, ventilation et climatisation', lots: ['Chauffage', 'Climatisation', 'Ventilation', 'Extraction', 'Désenfumage'] },
  { id: 'CFO', l: 'Électricité courants forts', lots: ['Alimentation et raccordement', 'Transformation HTA/BT selon projet', 'Distribution électrique', 'Éclairage intérieur', 'Éclairage extérieur rattaché au bâtiment', 'Éclairage sportif', 'Mise à la terre', 'Protection contre la foudre', 'Groupes électrogènes', 'Onduleurs', 'Photovoltaïque selon projet'] },
  { id: 'CFA', l: 'Courants faibles et contrôle', lots: ['Réseaux informatiques et télécommunications', 'Vidéosurveillance', 'Contrôle d\'accès', 'Interphonie', 'Sonorisation', 'Audiovisuel', 'GTB/GTC', 'Systèmes spécialisés de communication'] },
  { id: 'INC', l: 'Sécurité incendie', lots: ['Détection et alarme', 'Extinction', 'RIA', 'Sprinklers', 'Réserves et pompage incendie', 'Réseaux et équipements associés'] },
  { id: 'TRA', l: 'Transport et manutention', lots: ['Ascenseurs', 'Escaliers mécaniques', 'Monte-charges', 'Plateformes élévatrices', 'Ponts roulants', 'Convoyeurs', 'Équipements de manutention'] },
  { id: 'VRD', l: 'Voirie et réseaux divers', lots: ['Voirie et voies internes', 'Parkings', 'Bordures et trottoirs', 'Réseau extérieur d\'eau potable AEP', 'Réseaux extérieurs EU/EV', 'Réseau extérieur d\'eaux pluviales EP', 'Bassins de rétention/infiltration', 'Réseaux électriques extérieurs', 'Réseaux télécom extérieurs', 'Éclairage public', 'Réseaux complémentaires selon projet'] },
  { id: 'EXT', l: 'Aménagements extérieurs', lots: ['Espaces verts', 'Arrosage', 'Clôtures et portails', 'Mobilier urbain', 'Aires de jeux', 'Aménagements paysagers et de surface'] },
  { id: 'ROU', l: 'Infrastructures routières', lots: ['Couches de chaussée', 'Revêtements routiers', 'Assainissement et drainage routiers', 'Signalisation horizontale', 'Signalisation verticale', 'Dispositifs de retenue', 'Équipements d\'exploitation', 'Aires et installations annexes'] },
  { id: 'ODA', l: 'Ouvrages d\'art', lots: ['Fondations', 'Appuis : piles, culées, chevêtres', 'Tabliers', 'Précontrainte selon ouvrage', 'Appareils d\'appui', 'Joints', 'Étanchéité et drainage du tablier', 'Dispositifs de retenue', 'Réparation et renforcement'] },
  { id: 'TUN', l: 'Tunnels et ouvrages souterrains', lots: ['Excavation', 'Soutènement', 'Revêtement définitif', 'Étanchéité et drainage', 'Galeries et locaux techniques', 'Équipements d\'exploitation et de sécurité'] },
  { id: 'FER', l: 'Infrastructures ferroviaires', lots: ['Plateforme ferroviaire', 'Voie', 'Énergie de traction', 'Signalisation ferroviaire', 'Télécommunications ferroviaires', 'Équipements des stations et dépôts selon périmètre'] },
  { id: 'HYD', l: 'Ouvrages et équipements hydrauliques', lots: ['Réservoirs', 'Adduction et refoulement', 'Pompage', 'Équipements hydromécaniques', 'Instrumentation', 'Traitement des eaux', 'Équipements de barrages'] },
  { id: 'MAR', l: 'Ouvrages maritimes et portuaires', lots: ['Dragage', 'Quais', 'Digues', 'Protections maritimes', 'Équipements maritimes et portuaires'] },
  { id: 'SPE', l: 'Process et équipements spécifiques', lots: ['Équipements sportifs', 'Équipements médicaux', 'Fluides médicaux', 'Appel malade', 'Process industriel', 'Fluides industriels', 'Cuisines professionnelles', 'Buanderies', 'Froid spécialisé', 'Piscines, filtration et équipements de bien-être', 'Équipements pédagogiques', 'Process de traitement des eaux et des boues', 'Équipements aéroportuaires', 'Autres équipements personnalisés'] },
];
// recherche rapide
const catFamily = (id) => CAT_FAMILIES.find(f => f.id === id);
const catLot = (famId, lotName) => { const f = catFamily(famId); return f && f.lots.includes(lotName) ? { fam: f.id, l: lotName } : null; };
// fusionne plusieurs modèles de type de projet sans dupliquer un même (famille, lot)
function catMergeModels(models) {
  const seen = new Set(), out = [];
  for (const m of models) for (const [fam, lot] of m) { const k = fam + '|' + lot; if (seen.has(k)) continue; seen.add(k); out.push([fam, lot]); }
  return out;
}

// ---------- Modèles par type de projet (liste de [familleId, lot] proposés par défaut) ----------
// Démarré avec un seul modèle complet (Stade), demandé comme exemple de validation ; les autres types
// (villa, immeuble, route…) sont à construire sur le même principe avant d'être branchés à un écran.
const CAT_MODELS = {
  stade: [
    ['PRE', 'Installation de chantier'], ['TER', 'Terrassements généraux'], ['TER', 'Soutènements'],
    ['STR', 'Fondations superficielles'], ['STR', 'Infrastructure / substructure'], ['STR', 'Superstructure en béton armé'], ['STR', 'Éléments préfabriqués'],
    ['STR', 'Charpente métallique'], ['ENV', 'Couverture'], ['ENV', 'Façades et bardage'], ['ENV', 'Étanchéité des toitures et terrasses'], ['ENV', 'Isolation de l\'enveloppe'],
    ['SOE', 'Revêtements de sols'], ['SOE', 'Peinture et finitions'], ['SOE', 'Menuiseries intérieures'], ['SOE', 'Serrurerie et métallerie de finition'],
    ['PLB', 'Eau froide'], ['PLB', 'Appareils sanitaires'], ['PLB', 'Évacuations intérieures EU/EV'],
    ['CVC', 'Ventilation'], ['CVC', 'Désenfumage'],
    ['CFO', 'Distribution électrique'], ['CFO', 'Éclairage intérieur'], ['CFO', 'Éclairage sportif'], ['CFO', 'Groupes électrogènes'],
    ['CFA', 'Sonorisation'], ['CFA', 'Audiovisuel'], ['CFA', 'Contrôle d\'accès'],
    ['INC', 'Détection et alarme'], ['INC', 'Extinction'], ['INC', 'Réserves et pompage incendie'],
    ['TRA', 'Ascenseurs'], ['TRA', 'Monte-charges'],
    ['SPE', 'Équipements sportifs'],
    ['VRD', 'Voirie et voies internes'], ['VRD', 'Parkings'], ['VRD', 'Réseau extérieur d\'eau potable AEP'], ['VRD', 'Réseaux extérieurs EU/EV'], ['VRD', 'Réseau extérieur d\'eaux pluviales EP'], ['VRD', 'Éclairage public'],
    ['EXT', 'Espaces verts'], ['EXT', 'Clôtures et portails'],
  ],
};
