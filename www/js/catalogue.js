// ================= Catalogue technique BTP (familles → lots techniques) =================
// Référentiel interne proposé pour organiser un projet (familles techniques, lots, modèles par type de projet).
// Codes INTERNES à l'application (pas une nomenclature officielle). Catalogue non exhaustif, pensé pour être complété.
// Statut : données (20 familles, 8 modèles de projet) + écran de sélection simple (openProjectCatalogue, via
// « Fonctions du projet » › Organisation technique). PAS d'assistant de création dédié (secteur/envergure…), PAS de
// moteur de suggestion automatique selon les caractéristiques du projet, PAS de fiche de lot détaillée (section 8)
// — voir la synthèse livrée séparément.

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
// Chaque modèle est une proposition de départ (section 5 du cahier des charges) : l'utilisateur coche/décoche
// librement après chargement. Modèles encore à construire sur le même principe : hôpital/clinique, hôtel,
// école/université, tunnel, tramway, barrage, port, aéroport, projet mixte.
const CAT_MODEL_LABELS = {
  stade: '🏟️ Stade / complexe sportif',
  villa: '🏠 Villa / maison individuelle',
  immeuble: '🏢 Immeuble résidentiel',
  route: '🛣️ Route / voirie',
  pont: '🌉 Pont / ouvrage d\'art',
  lotissement: '🗺️ Lotissement / viabilisation',
  usine: '🏭 Usine / bâtiment industriel',
  reservoir: '💧 Réservoir / station de pompage',
};
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
  villa: [
    ['PRE', 'Installation de chantier'],
    ['TER', 'Terrassements généraux'], ['TER', 'Fouilles et remblais'],
    ['STR', 'Fondations superficielles'], ['STR', 'Superstructure en béton armé'], ['STR', 'Maçonnerie porteuse'],
    ['ENV', 'Couverture'], ['ENV', 'Menuiseries extérieures et vitrages associés'], ['ENV', 'Étanchéité des toitures et terrasses'], ['ENV', 'Isolation de l\'enveloppe'],
    ['SOE', 'Maçonnerie non porteuse'], ['SOE', 'Enduits'], ['SOE', 'Chapes et supports de revêtement'], ['SOE', 'Revêtements de sols'], ['SOE', 'Revêtements muraux'], ['SOE', 'Peinture et finitions'], ['SOE', 'Menuiseries intérieures'], ['SOE', 'Serrurerie et métallerie de finition'],
    ['PLB', 'Eau froide'], ['PLB', 'Eau chaude sanitaire'], ['PLB', 'Appareils sanitaires'], ['PLB', 'Évacuations intérieures EU/EV'], ['PLB', 'Évacuations EP du bâtiment'],
    ['CVC', 'Climatisation'],
    ['CFO', 'Alimentation et raccordement'], ['CFO', 'Distribution électrique'], ['CFO', 'Éclairage intérieur'], ['CFO', 'Mise à la terre'], ['CFO', 'Protection contre la foudre'],
    ['CFA', 'Interphonie'],
    ['VRD', 'Voirie et voies internes'], ['VRD', 'Réseau extérieur d\'eau potable AEP'], ['VRD', 'Réseaux extérieurs EU/EV'], ['VRD', 'Réseau extérieur d\'eaux pluviales EP'], ['VRD', 'Réseaux électriques extérieurs'],
    ['EXT', 'Espaces verts'], ['EXT', 'Arrosage'], ['EXT', 'Clôtures et portails'], ['EXT', 'Aménagements paysagers et de surface'],
    ['SPE', 'Piscines, filtration et équipements de bien-être'],
  ],
  immeuble: [
    ['PRE', 'Installation de chantier'],
    ['TER', 'Terrassements généraux'], ['TER', 'Fouilles et remblais'], ['TER', 'Soutènements'],
    ['STR', 'Fondations superficielles'], ['STR', 'Fondations profondes'], ['STR', 'Infrastructure / substructure'], ['STR', 'Superstructure en béton armé'], ['STR', 'Maçonnerie porteuse'],
    ['ENV', 'Couverture'], ['ENV', 'Façades et bardage'], ['ENV', 'Menuiseries extérieures et vitrages associés'], ['ENV', 'Étanchéité des parties enterrées'], ['ENV', 'Étanchéité des toitures et terrasses'], ['ENV', 'Isolation de l\'enveloppe'],
    ['SOE', 'Maçonnerie non porteuse'], ['SOE', 'Cloisons et doublages'], ['SOE', 'Enduits'], ['SOE', 'Faux plafonds'], ['SOE', 'Chapes et supports de revêtement'], ['SOE', 'Revêtements de sols'], ['SOE', 'Revêtements muraux'], ['SOE', 'Peinture et finitions'], ['SOE', 'Menuiseries intérieures'], ['SOE', 'Serrurerie et métallerie de finition'],
    ['PLB', 'Eau froide'], ['PLB', 'Eau chaude sanitaire'], ['PLB', 'Appareils sanitaires'], ['PLB', 'Évacuations intérieures EU/EV'], ['PLB', 'Évacuations EP du bâtiment'], ['PLB', 'Stockage et surpression'],
    ['CVC', 'Ventilation'],
    ['CFO', 'Alimentation et raccordement'], ['CFO', 'Distribution électrique'], ['CFO', 'Éclairage intérieur'], ['CFO', 'Éclairage extérieur rattaché au bâtiment'], ['CFO', 'Mise à la terre'], ['CFO', 'Protection contre la foudre'], ['CFO', 'Groupes électrogènes'],
    ['CFA', 'Interphonie'], ['CFA', 'Vidéosurveillance'], ['CFA', 'Contrôle d\'accès'],
    ['INC', 'Détection et alarme'], ['INC', 'Extinction'], ['INC', 'RIA'],
    ['TRA', 'Ascenseurs'],
    ['VRD', 'Voirie et voies internes'], ['VRD', 'Parkings'], ['VRD', 'Réseau extérieur d\'eau potable AEP'], ['VRD', 'Réseaux extérieurs EU/EV'], ['VRD', 'Réseau extérieur d\'eaux pluviales EP'], ['VRD', 'Réseaux électriques extérieurs'], ['VRD', 'Éclairage public'],
    ['EXT', 'Espaces verts'], ['EXT', 'Clôtures et portails'], ['EXT', 'Aires de jeux'],
  ],
  route: [
    ['PRE', 'Installation de chantier'], ['PRE', 'Protection et déviation des réseaux existants'],
    ['TER', 'Terrassements généraux'], ['TER', 'Fouilles et remblais'], ['TER', 'Amélioration des sols'],
    ['ROU', 'Couches de chaussée'], ['ROU', 'Revêtements routiers'], ['ROU', 'Assainissement et drainage routiers'], ['ROU', 'Signalisation horizontale'], ['ROU', 'Signalisation verticale'], ['ROU', 'Dispositifs de retenue'], ['ROU', 'Équipements d\'exploitation'], ['ROU', 'Aires et installations annexes'],
    ['VRD', 'Réseau extérieur d\'eaux pluviales EP'], ['VRD', 'Bassins de rétention/infiltration'], ['VRD', 'Réseaux télécom extérieurs'], ['VRD', 'Éclairage public'],
    ['EXT', 'Aménagements paysagers et de surface'],
  ],
  pont: [
    ['PRE', 'Installation de chantier'], ['PRE', 'Protection et déviation des réseaux existants'],
    ['TER', 'Terrassements généraux'], ['TER', 'Fouilles et remblais'], ['TER', 'Soutènements'], ['TER', 'Rabattement de nappe'],
    ['STR', 'Fondations profondes'],
    ['ODA', 'Fondations'], ['ODA', 'Appuis : piles, culées, chevêtres'], ['ODA', 'Tabliers'], ['ODA', 'Précontrainte selon ouvrage'], ['ODA', 'Appareils d\'appui'], ['ODA', 'Joints'], ['ODA', 'Étanchéité et drainage du tablier'], ['ODA', 'Dispositifs de retenue'],
    ['ROU', 'Couches de chaussée'], ['ROU', 'Revêtements routiers'], ['ROU', 'Signalisation horizontale'], ['ROU', 'Signalisation verticale'],
    ['VRD', 'Réseau extérieur d\'eaux pluviales EP'], ['VRD', 'Éclairage public'],
  ],
  lotissement: [
    ['PRE', 'Installation de chantier'], ['PRE', 'Défrichage'],
    ['TER', 'Terrassements généraux'], ['TER', 'Amélioration des sols'],
    ['VRD', 'Voirie et voies internes'], ['VRD', 'Bordures et trottoirs'], ['VRD', 'Réseau extérieur d\'eau potable AEP'], ['VRD', 'Réseaux extérieurs EU/EV'], ['VRD', 'Réseau extérieur d\'eaux pluviales EP'], ['VRD', 'Bassins de rétention/infiltration'], ['VRD', 'Réseaux électriques extérieurs'], ['VRD', 'Réseaux télécom extérieurs'], ['VRD', 'Éclairage public'],
    ['ROU', 'Couches de chaussée'], ['ROU', 'Revêtements routiers'], ['ROU', 'Signalisation horizontale'], ['ROU', 'Signalisation verticale'],
    ['EXT', 'Espaces verts'], ['EXT', 'Arrosage'], ['EXT', 'Clôtures et portails'], ['EXT', 'Mobilier urbain'], ['EXT', 'Aires de jeux'], ['EXT', 'Aménagements paysagers et de surface'],
  ],
  usine: [
    ['PRE', 'Installation de chantier'],
    ['TER', 'Terrassements généraux'], ['TER', 'Fouilles et remblais'], ['TER', 'Amélioration des sols'],
    ['STR', 'Fondations superficielles'], ['STR', 'Infrastructure / substructure'], ['STR', 'Charpente métallique'], ['STR', 'Superstructure en béton armé'],
    ['ENV', 'Couverture'], ['ENV', 'Façades et bardage'], ['ENV', 'Menuiseries extérieures et vitrages associés'], ['ENV', 'Isolation de l\'enveloppe'],
    ['SOE', 'Peinture et finitions'], ['SOE', 'Revêtements de sols'], ['SOE', 'Serrurerie et métallerie de finition'],
    ['PLB', 'Eau froide'], ['PLB', 'Évacuations intérieures EU/EV'],
    ['CVC', 'Ventilation'], ['CVC', 'Extraction'],
    ['CFO', 'Alimentation et raccordement'], ['CFO', 'Transformation HTA/BT selon projet'], ['CFO', 'Distribution électrique'], ['CFO', 'Éclairage intérieur'], ['CFO', 'Éclairage extérieur rattaché au bâtiment'], ['CFO', 'Mise à la terre'], ['CFO', 'Protection contre la foudre'], ['CFO', 'Groupes électrogènes'],
    ['INC', 'Détection et alarme'], ['INC', 'Extinction'], ['INC', 'Sprinklers'], ['INC', 'Réserves et pompage incendie'],
    ['TRA', 'Ponts roulants'], ['TRA', 'Convoyeurs'], ['TRA', 'Équipements de manutention'],
    ['SPE', 'Process industriel'], ['SPE', 'Fluides industriels'],
    ['VRD', 'Voirie et voies internes'], ['VRD', 'Parkings'], ['VRD', 'Réseau extérieur d\'eau potable AEP'], ['VRD', 'Réseaux extérieurs EU/EV'], ['VRD', 'Réseau extérieur d\'eaux pluviales EP'], ['VRD', 'Réseaux électriques extérieurs'], ['VRD', 'Éclairage public'],
  ],
  reservoir: [
    ['PRE', 'Installation de chantier'],
    ['TER', 'Terrassements généraux'], ['TER', 'Fouilles et remblais'], ['TER', 'Rabattement de nappe'],
    ['STR', 'Fondations superficielles'], ['STR', 'Infrastructure / substructure'], ['STR', 'Superstructure en béton armé'],
    ['HYD', 'Réservoirs'], ['HYD', 'Adduction et refoulement'], ['HYD', 'Pompage'], ['HYD', 'Équipements hydromécaniques'], ['HYD', 'Instrumentation'], ['HYD', 'Traitement des eaux'],
    ['CFO', 'Alimentation et raccordement'], ['CFO', 'Distribution électrique'], ['CFO', 'Éclairage extérieur rattaché au bâtiment'], ['CFO', 'Groupes électrogènes'],
    ['CFA', 'GTB/GTC'],
    ['VRD', 'Voirie et voies internes'], ['VRD', 'Réseaux électriques extérieurs'], ['VRD', 'Éclairage public'],
    ['EXT', 'Clôtures et portails'],
  ],
};

// ---------- écran : organisation technique (lots) d'un projet ----------
// Stocke le choix sur le projet (p.catLots = [[familleId, lot], …]) ; indépendant de LOTS_DEF (écran des plans par lot).
function openProjectCatalogue(p) {
  return new Promise((resolve) => {
    const sel = new Set((p.catLots || []).map(([f, l]) => f + '|' + l));
    const s = sheet('<div class="cat-wrap"></div>', { title: 'Organisation technique du projet' });
    const wrap = $('.cat-wrap', s.el);
    const draw = () => {
      wrap.innerHTML = `
        <div class="muted steps" style="margin-bottom:10px">Cochez les lots qui concernent ce projet. Vous pouvez partir d'un modèle puis ajuster.</div>
        <div class="btnrow" style="padding:0 0 10px;flex-wrap:wrap">${Object.keys(CAT_MODELS).map(k => `<button class="btn ghost small" data-model="${k}">${esc(CAT_MODEL_LABELS[k] || k)}</button>`).join('')}</div>
        ${CAT_FAMILIES.map(f => { const n = f.lots.filter(l => sel.has(f.id + '|' + l)).length;
          return `<details class="cat-fam"${n ? ' open' : ''}><summary>${esc(f.l)}${n ? ` <b>(${n})</b>` : ''}</summary>
            <div class="cat-lots">${f.lots.map(l => `<label class="cat-ck"><input type="checkbox" data-f="${f.id}" data-l="${esc(l)}"${sel.has(f.id + '|' + l) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</div></details>`; }).join('')}
        <button class="btn" data-a="save" style="margin-top:14px">${icon('check')} Enregistrer (${sel.size} lot(s))</button>`;
      $$('[data-model]', wrap).forEach(b => b.onclick = () => { for (const [f, l] of CAT_MODELS[b.dataset.model]) sel.add(f + '|' + l); draw(); });
      $$('input[data-f]', wrap).forEach(c => c.onchange = () => { const k = c.dataset.f + '|' + c.dataset.l; c.checked ? sel.add(k) : sel.delete(k); const btn = $('[data-a=save]', wrap); if (btn) btn.textContent = `Enregistrer (${sel.size} lot(s))`; });
      $('[data-a=save]', wrap).onclick = () => { p.catLots = [...sel].map(k => k.split('|')); s.close(); };
    };
    draw();
    s.onClose = () => resolve(p.catLots || []);
  });
}
