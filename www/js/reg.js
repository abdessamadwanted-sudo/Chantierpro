// ================= Registres : un seul moteur pour Réunions, RFI, Visas, Bordereaux, HSE, Labo, Avenants & OS, Sous-traitants =================
// Chaque registre = une liste de fiches (champs, statut, sous-liste, photos) + PDF + Excel + cartes du briefing.
// Les droits viennent du poste : voir / modifier / valider (statuts marqués « v »).
const REG = {};
const regStore = (k) => (p) => { p.reg = p.reg || {}; return (p.reg[k] = p.reg[k] || []); };
const regNum = (L, pre) => `${pre || ''}${String(L.length + 1).padStart(pre ? 3 : 1, '0')}`;
const regAge = (d) => d ? daysSince(d) : 0;
const regVal = (f, v) => { if (v == null || v === '') return ''; if (f.type === 'date') return fmtDate(v); if (f.type === 'select') { const o = (f.options || []).find(o => (o.value ?? o) == v); return o ? (o.label ?? o) : v; } if (f.type === 'number' && /\(DH/.test(f.label)) return fDH(fN(v)); if (f.type === 'number' && /jours\)/.test(f.label)) return `${v} j`; if (f.unit) return `${v} ${f.unit}`; return String(v); };
function regSt(D, x) { return D.st ? (D.st.find(s => s[0] === x.st) || D.st[0]) : null; }

// ---------- définitions ----------
const REU_TYPES = ['Réunion de chantier (hebdomadaire)', 'Coordination TCE', 'Réunion avec le maître d\'ouvrage', 'Réunion sécurité', 'Réunion qualité', 'Autre'];
REG.reu = { t: 'Réunions de chantier', one: 'Réunion', e: '🗓️', f: 'reunions', store: regStore('reu'), pre: 'CR-',
  fields: [{ name: 'date', label: 'Date', type: 'date', def: todayISO }, { name: 'type', label: 'Type', type: 'select', options: REU_TYPES }, { name: 'lieu', label: 'Lieu', placeholder: 'Bureau de chantier' },
    { name: 'part', label: 'Présents (un par ligne : nom — société)', type: 'textarea' }, { name: 'points', label: 'Points abordés', type: 'textarea' }, { name: 'next', label: 'Prochaine réunion', type: 'date' }],
  sub: { k: 'act', t: 'Actions à mener', one: 'Action', fields: [{ name: 'quoi', label: 'Action', placeholder: 'Ex : envoyer les plans de réservation' }, { name: 'qui', label: 'Responsable' }, { name: 'quand', label: 'Pour le', type: 'date' }],
    row: (y) => ({ t: y.quoi, s: [y.qui, y.quand && 'pour le ' + fmtDate(y.quand)].filter(Boolean).join(' · '), late: !y.done && y.quand && y.quand < todayISO() }) },
  row: (x) => { const o = (x.act || []).filter(a => !a.done).length; return { t: `${x.n} · ${x.type || 'Réunion'}`, s: `${fmtDate(x.date)}${x.lieu ? ' · ' + x.lieu : ''}`, v: o ? `${o} action(s)` : '✓', c: o ? '#f59e0b' : '#22c55e' }; },
  title: (x) => `Compte rendu de réunion ${x.n}`,
  brief: (p, L) => L.flatMap(x => (x.act || []).filter(a => !a.done).map(a => ({ label: a.quoi, sub: `${p.name} · ${a.qui || ''}${a.quand ? ' · ' + fmtDate(a.quand) : ''}`, late: a.quand && a.quand < todayISO() }))),
  briefCard: { e: '🗓️', t: 'Actions des réunions', c: '#0ea5e9' },
};
REG.rfi = { t: 'RFI · demandes d\'information', one: 'RFI', e: '❓', f: 'rfi', store: regStore('rfi'), pre: 'RFI-',
  fields: [{ name: 'date', label: 'Date', type: 'date', def: todayISO }, { name: 'obj', label: 'Objet', placeholder: 'Ex : réservation gaine VMC R+3' }, { name: 'q', label: 'Question', type: 'textarea' },
    { name: 'dest', label: 'Destinataire', type: 'select', options: ['BET structure', 'BET fluides', 'Bureau de contrôle', 'Architecte', 'Maître d\'ouvrage', 'Autre'] }, { name: 'loc', label: 'Niveau / zone / plan', placeholder: 'R+3 · axe C4' },
    { name: 'urg', label: 'Urgence', type: 'select', options: ['Normale', 'Urgente (bloque le chantier)'] }, { name: 'rep', label: 'Réponse', type: 'textarea' }, { name: 'drep', label: 'Date de réponse', type: 'date' }],
  st: [['env', 'Envoyée', '#3b82f6'], ['rep', 'Répondue', '#22c55e', 'v'], ['clo', 'Clôturée', '#64748b']], photos: true,
  row: (x) => { const late = x.st === 'env' && regAge(x.date) > 7; return { t: `${x.n} · ${x.obj || ''}`, s: `${fmtDate(x.date)} · ${x.dest || ''}${x.st === 'env' ? ` · ${regAge(x.date)} j sans réponse` : ''}`, late, urg: /Urgente/.test(x.urg || '') }; },
  wait: ['env'], brief: (p, L) => L.filter(x => x.st === 'env').map(x => ({ label: `${x.n} · ${x.obj || ''}`, sub: `${p.name} · ${regAge(x.date)} j sans réponse`, late: regAge(x.date) > 7 || /Urgente/.test(x.urg || '') })),
  briefCard: { e: '❓', t: 'RFI sans réponse', c: '#6366f1' },
};
REG.visa = { t: 'Visas des documents', one: 'Document', e: '🛂', f: 'visa', store: regStore('visa'), pre: 'V-',
  fields: [{ name: 'date', label: 'Envoyé le', type: 'date', def: todayISO }, { name: 'doc', label: 'Type', type: 'select', options: ['Fiche technique matériau', 'Plan d\'exécution', 'Note de calcul', 'Échantillon', 'Procédure / méthodologie', 'Autre'] },
    { name: 'des', label: 'Désignation', placeholder: 'Ex : carrelage grès 60x60' }, { name: 'lot', label: 'Lot', list: typeof TCE_LOTS !== 'undefined' ? TCE_LOTS : [] }, { name: 'dest', label: 'Pour visa de', type: 'select', options: ['BET', 'Bureau de contrôle', 'Architecte', 'Maître d\'ouvrage'] },
    { name: 'dret', label: 'Retour le', type: 'date' }, { name: 'obs', label: 'Observations', type: 'textarea' }],
  st: [['env', 'En attente', '#3b82f6'], ['va', 'Visé', '#22c55e', 'v'], ['vo', 'Visé avec observations', '#f59e0b', 'v'], ['ref', 'Refusé', '#ef4444', 'v']], photos: true,
  row: (x) => ({ t: `${x.n} · ${x.des || x.doc || ''}`, s: `${x.doc || ''} · ${x.dest || ''} · ${fmtDate(x.date)}${x.st === 'env' ? ` · ${regAge(x.date)} j` : ''}`, late: x.st === 'env' && regAge(x.date) > 15 }),
  wait: ['env'], brief: (p, L) => L.filter(x => x.st === 'env' && regAge(x.date) > 10).map(x => ({ label: `${x.n} · ${x.des || ''}`, sub: `${p.name} · en attente depuis ${regAge(x.date)} j`, late: regAge(x.date) > 15 })),
  briefCard: { e: '🛂', t: 'Visas en attente', c: '#14b8a6' },
};
REG.bord = { t: 'Bordereaux d\'envoi', one: 'Bordereau', e: '📨', f: 'visa', store: regStore('bord'), pre: 'BE-',
  fields: [{ name: 'date', label: 'Date', type: 'date', def: todayISO }, { name: 'dest', label: 'Destinataire', list: ['BET', 'Bureau de contrôle', 'Architecte', 'Maître d\'ouvrage', 'Laboratoire'] }, { name: 'obj', label: 'Objet', placeholder: 'Ex : PV de réception ferraillage semaine 42' },
    { name: 'docs', label: 'Documents (un par ligne)', type: 'textarea' }, { name: 'mode', label: 'Mode d\'envoi', type: 'select', options: ['Remis en main propre', 'E-mail', 'WhatsApp', 'Courrier'] }, { name: 'ar', label: 'Accusé de réception le', type: 'date' }],
  row: (x) => { const n = String(x.docs || '').split('\n').filter(s => s.trim()).length; return { t: `${x.n} · ${x.dest || ''}`, s: `${fmtDate(x.date)} · ${n} document(s)${x.obj ? ' · ' + x.obj : ''}`, v: x.ar ? '✓ reçu' : '', c: '#22c55e' }; },
  actions: [{ label: 'Joindre les PV réceptionnés (non livrés)', icon: 'report', run: regJoinPv }],
};
// ---- HSE ----
REG.caus = { t: 'Causeries sécurité', one: 'Causerie', e: '🗣️', f: 'hse', store: regStore('caus'),
  fields: [{ name: 'date', label: 'Date', type: 'date', def: todayISO }, { name: 'theme', label: 'Thème', list: ['Travail en hauteur', 'Port des EPI', 'Levage / grue', 'Échafaudages', 'Risque électrique', 'Ordre et propreté', 'Fouilles et tranchées', 'Circulation des engins', 'Incendie', 'Chaleur / hydratation'] },
    { name: 'anim', label: 'Animée par' }, { name: 'nb', label: 'Participants', type: 'number' }, { name: 'equipe', label: 'Équipe / entreprise' }, { name: 'obs', label: 'Remarques', type: 'textarea' }], photos: true,
  row: (x) => ({ t: x.theme || 'Causerie', s: `${fmtDate(x.date)}${x.anim ? ' · ' + x.anim : ''}`, v: x.nb ? x.nb + ' pers.' : '' }),
};
REG.epi = { t: 'Contrôles EPI', one: 'Contrôle', e: '🦺', f: 'hse', store: regStore('epi'),
  fields: [{ name: 'date', label: 'Date', type: 'date', def: todayISO }, { name: 'zone', label: 'Zone / équipe' }, { name: 'ok', label: 'Personnes conformes', type: 'number' }, { name: 'ko', label: 'Non conformes', type: 'number' }, { name: 'manq', label: 'Manquements', placeholder: 'casque, harnais, chaussures…' }, { name: 'mes', label: 'Mesures prises', type: 'textarea' }],
  photos: true, row: (x) => { const t = fN(x.ok) + fN(x.ko); return { t: x.zone || 'Contrôle EPI', s: fmtDate(x.date) + (x.manq ? ' · ' + x.manq : ''), v: t ? Math.round(fN(x.ok) / t * 100) + ' %' : '', c: fN(x.ko) ? '#ef4444' : '#22c55e' }; },
};
REG.acc = { t: 'Accidents & presque-accidents', one: 'Événement', e: '🚑', f: 'hse', store: regStore('acc'),
  fields: [{ name: 'date', label: 'Date', type: 'date', def: todayISO }, { name: 'type', label: 'Type', type: 'select', options: ['Presque-accident', 'Accident sans arrêt', 'Accident avec arrêt', 'Dommage matériel'] }, { name: 'lieu', label: 'Lieu' },
    { name: 'vict', label: 'Personne / entreprise concernée' }, { name: 'desc', label: 'Ce qui s\'est passé', type: 'textarea' }, { name: 'cause', label: 'Causes', type: 'textarea' }, { name: 'mes', label: 'Actions correctives', type: 'textarea' }, { name: 'j', label: 'Jours d\'arrêt', type: 'number' }],
  st: [['ouv', 'Analyse en cours', '#f59e0b'], ['clo', 'Clôturé', '#22c55e', 'v']], photos: true,
  row: (x) => ({ t: x.type || 'Événement', s: `${fmtDate(x.date)}${x.lieu ? ' · ' + x.lieu : ''}`, late: /Accident/.test(x.type || '') && x.st !== 'clo' }),
};
REG.perm = { t: 'Permis de travail', one: 'Permis', e: '📝', f: 'hse', store: regStore('perm'), pre: 'PT-',
  fields: [{ name: 'type', label: 'Type', type: 'select', options: ['Permis de feu (soudure, meulage)', 'Travail en hauteur', 'Fouille / tranchée', 'Espace confiné', 'Levage', 'Consignation électrique'] }, { name: 'ent', label: 'Entreprise' }, { name: 'zone', label: 'Zone' },
    { name: 'deb', label: 'Début', type: 'date', def: todayISO }, { name: 'fin', label: 'Fin', type: 'date', def: todayISO }, { name: 'cond', label: 'Mesures / conditions', type: 'textarea' }],
  st: [['act', 'Actif', '#3b82f6'], ['clo', 'Clôturé', '#64748b']],
  row: (x) => ({ t: `${x.n} · ${(x.type || '').split(' (')[0]}`, s: `${x.ent || ''} · ${x.zone || ''} · ${fmtDate(x.deb)} → ${fmtDate(x.fin)}`, late: x.st !== 'clo' && x.fin && x.fin < todayISO() }),
  brief: (p, L) => L.filter(x => x.st !== 'clo' && x.fin && x.fin < todayISO()).map(x => ({ label: `${x.n} · ${(x.type || '').split(' (')[0]}`, sub: `${p.name} · expiré le ${fmtDate(x.fin)}`, late: true })),
  briefCard: { e: '🦺', t: 'Permis expirés', c: '#f97316' },
};
// ---- Laboratoire ----
REG.slump = { t: 'Slump & réception du béton', one: 'Contrôle', e: '🧪', f: 'labo', store: regStore('slump'),
  fields: [{ name: 'date', label: 'Date', type: 'date', def: todayISO }, { name: 'ouv', label: 'Ouvrage', placeholder: 'R+3 · dalle zone 2' }, { name: 'cl', label: 'Classe', list: Object.keys(GS_CLASSES) }, { name: 'bl', label: 'N° BL / toupie' },
    { name: 'v', label: 'Affaissement mesuré (cm)', type: 'number' }, { name: 'min', label: 'Mini exigé (cm)', type: 'number', def: () => '10' }, { name: 'max', label: 'Maxi exigé (cm)', type: 'number', def: () => '16' }, { name: 'temp', label: 'Température (°C)', type: 'number' }, { name: 'obs', label: 'Observations', type: 'textarea' }],
  row: (x) => { const ok = x.v === '' || x.v == null ? null : fN(x.v) >= fN(x.min) && fN(x.v) <= fN(x.max); return { t: `${x.ouv || 'Béton'} · ${x.cl || ''}`, s: `${fmtDate(x.date)}${x.bl ? ' · BL ' + x.bl : ''}`, v: x.v ? x.v + ' cm' : '', c: ok == null ? '#64748b' : ok ? '#22c55e' : '#ef4444', late: ok === false }; },
};
REG.ess = { t: 'Essais (sols, granulats, aciers…)', one: 'Essai', e: '🔬', f: 'labo', store: regStore('ess'), pre: 'E-',
  fields: [{ name: 'date', label: 'Date', type: 'date', def: todayISO }, { name: 'cat', label: 'Essai', list: ['Proctor', 'Densité en place', 'Essai à la plaque', 'Granulométrie', 'Limites d\'Atterberg', 'Équivalent de sable', 'Los Angeles', 'Traction acier', 'Pliage acier', 'Carottage béton', 'Scléromètre'] },
    { name: 'loc', label: 'Localisation / échantillon' }, { name: 'res', label: 'Résultat' }, { name: 'exig', label: 'Exigence' }, { name: 'conf', label: 'Conformité', type: 'select', options: ['En attente', 'Conforme', 'Non conforme'] }, { name: 'lab', label: 'Laboratoire' }, { name: 'obs', label: 'Observations', type: 'textarea' }],
  photos: true, row: (x) => ({ t: `${x.n} · ${x.cat || ''}`, s: `${fmtDate(x.date)}${x.loc ? ' · ' + x.loc : ''}${x.res ? ' · ' + x.res : ''}`, v: x.conf === 'Conforme' ? '✓' : x.conf === 'Non conforme' ? '✗' : '…', c: x.conf === 'Conforme' ? '#22c55e' : x.conf === 'Non conforme' ? '#ef4444' : '#64748b', late: x.conf === 'Non conforme' }),
  brief: (p, L) => L.filter(x => x.conf === 'Non conforme').map(x => ({ label: `${x.cat || 'Essai'} non conforme`, sub: `${p.name} · ${x.loc || ''} · ${fmtDate(x.date)}`, late: true })),
  briefCard: { e: '🔬', t: 'Essais non conformes', c: '#ef4444' },
};
// ---- Avenants & ordres de service (les avenants alimentent le Financier et le Planning) ----
REG.av = { t: 'Avenants', one: 'Avenant', e: '📑', f: 'finance', store: (p) => finData(p).av,
  fields: [{ name: 'n', label: 'N°' }, { name: 'obj', label: 'Objet', placeholder: 'Ex : travaux supplémentaires R+6' }, { name: 'motif', label: 'Motif', type: 'select', options: ['Travaux supplémentaires', 'Modification du projet', 'Prolongation de délai', 'Révision des prix', 'Moins-value', 'Autre'] },
    { name: 'date', label: 'Date', type: 'date', def: todayISO }, { name: 'm', label: 'Montant HT (DH, négatif = moins-value)', type: 'number' }, { name: 'delai', label: 'Délai supplémentaire (jours)', type: 'number' }],
  st: [['br', 'Brouillon', '#64748b'], ['env', 'Envoyé au MO', '#3b82f6'], ['sig', 'Signé', '#f59e0b', 'v'], ['app', 'Approuvé', '#22c55e', 'v'], ['ref', 'Refusé', '#ef4444', 'v']], st0: 'br', photos: true,
  row: (x) => ({ t: `Avenant n° ${x.n || ''} · ${x.obj || ''}`, s: `${x.date ? fmtDate(x.date) : ''}${fN(x.delai) ? ` · +${fN(x.delai)} j` : ''}${x.motif ? ' · ' + x.motif : ''}`, v: (fN(x.m) > 0 ? '+' : '') + fDH(fN(x.m)), c: fN(x.m) < 0 ? '#ef4444' : '#22c55e' }),
  wait: ['env', 'sig'], title: (x) => `Avenant n° ${x.n || ''}`,
};
REG.os = { t: 'Ordres de service', one: 'Ordre de service', e: '📣', f: 'finance', store: regStore('os'), pre: 'OS-',
  fields: [{ name: 'type', label: 'Type', type: 'select', options: ['Démarrage des travaux', 'Arrêt des travaux', 'Reprise des travaux', 'Travaux supplémentaires', 'Modification', 'Autre'] }, { name: 'date', label: 'Date', type: 'date', def: todayISO },
    { name: 'obj', label: 'Objet', type: 'textarea' }, { name: 'j', label: 'Prolongation de délai (jours)', type: 'number' }],
  photos: true, row: (x) => ({ t: `${x.n} · ${x.type || ''}`, s: `${fmtDate(x.date)}${x.obj ? ' · ' + x.obj.slice(0, 60) : ''}`, v: fN(x.j) ? `+${fN(x.j)} j` : '' }),
};
// ---- Sous-traitants ----
REG.st = { t: 'Sous-traitants', one: 'Sous-traitant', e: '🤝', f: 'st', store: (p) => (p.st = p.st || []),
  fields: [{ name: 'nom', label: 'Raison sociale' }, { name: 'lot', label: 'Lot / travaux', list: typeof TCE_LOTS !== 'undefined' ? TCE_LOTS : [] }, { name: 'contact', label: 'Contact' }, { name: 'tel', label: 'Téléphone', type: 'tel' },
    { name: 'ice', label: 'ICE' }, { name: 'rc', label: 'RC' }, { name: 'assur', label: 'Assurance valable jusqu\'au', type: 'date' }, { name: 'm', label: 'Montant du contrat HT (DH)', type: 'number' },
    { name: 'rg', label: 'Retenue de garantie (%)', type: 'number', def: () => '7' }, { name: 'av', label: 'Avance versée (DH)', type: 'number' }, { name: 'fin', label: 'Fin des travaux prévue', type: 'date' },
    { name: 'eq', label: 'Note qualité (1 à 5)', type: 'select', options: ['', '1', '2', '3', '4', '5'] }, { name: 'ed', label: 'Note délais (1 à 5)', type: 'select', options: ['', '1', '2', '3', '4', '5'] }, { name: 'es', label: 'Note sécurité (1 à 5)', type: 'select', options: ['', '1', '2', '3', '4', '5'] }],
  sub: { k: 'sit', t: 'Situations / paiements', one: 'Situation', fields: [{ name: 'n', label: 'N°' }, { name: 'date', label: 'Date', type: 'date', def: todayISO }, { name: 'm', label: 'Montant HT (DH)', type: 'number' },
    { name: 'st', label: 'Statut', type: 'select', options: [{ value: 'sou', label: 'Soumise (à valider)' }, { value: 'val', label: 'Validée' }, { value: 'pay', label: 'Payée' }], value: 'sou' }],
    guard: (y, old) => (y.st !== 'sou' && (!old || old.st !== y.st) && !orgValid('st')) ? 'Seul votre responsable peut valider ou payer une situation.' : '',
    row: (y) => ({ t: `Situation ${y.n || ''} · ${fDH(fN(y.m))}`, s: `${y.date ? fmtDate(y.date) : ''} · ${({ sou: '⏳ à valider', val: '✓ validée', pay: '💰 payée' })[y.st] || ''}` }) },
  row: (x) => { const S = stCalc(x), as = x.assur && x.assur < addDays(todayISO(), 30); return { t: x.nom || 'Sous-traitant', s: `${x.lot || ''}${S.note ? ' · ★ ' + S.note : ''}${as ? ' · ⚠️ assurance' : ''}`, v: fDH(S.paye), c: '#a855f7', late: as }; },
  kpis: (x) => { const S = stCalc(x); return [['Contrat', fDH(fN(x.m))], ['Situé', fDH(S.sit)], ['Payé', fDH(S.paye)], [`Retenue ${fN(x.rg)} %`, fDH(S.rg)], ['Reste à payer', fDH(S.reste)]]; },
  brief: (p, L) => [...L.filter(x => x.assur && x.assur < addDays(todayISO(), 30)).map(x => ({ label: `${x.nom} : assurance`, sub: `${p.name} · ${x.assur < todayISO() ? 'expirée' : 'expire'} le ${fmtDate(x.assur)}`, late: x.assur < todayISO() })),
    ...(orgValid('st') ? L.flatMap(x => (x.sit || []).filter(y => y.st === 'sou').map(y => ({ label: `${x.nom} : situation ${y.n || ''} à valider`, sub: `${p.name} · ${fDH(fN(y.m))}`, late: regAge(y.date) > 2 }))) : [])],
  briefCard: { e: '🤝', t: 'Sous-traitants', c: '#a855f7' },
};
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
function stCalc(x) { const S = x.sit || [], sit = S.reduce((a, y) => a + fN(y.m), 0), paye = S.filter(y => y.st === 'pay').reduce((a, y) => a + fN(y.m), 0), rg = sit * fN(x.rg) / 100;
  const ns = [x.eq, x.ed, x.es].map(fN).filter(Boolean); return { sit, paye, rg, reste: Math.max(0, sit - rg - paye - fN(x.av)), note: ns.length ? (ns.reduce((a, b) => a + b, 0) / ns.length).toFixed(1) : '' }; }

// ---------- rendu générique ----------
async function regSave(p) { await DB.put('projects', p); }
async function regEdit(p, k, x, redraw) {
  const D = REG[k], L = D.store(p);
  const r = await formSheet(x ? (D.title ? D.title(x) : D.one) : 'Nouveau · ' + D.one, D.fields.map(f => ({ ...f, value: x ? x[f.name] ?? '' : (f.def ? f.def() : f.name === 'n' ? regNum(L, D.pre) : '') })), { okLabel: 'Enregistrer', danger: x ? 'Supprimer' : null });
  if (!r) return null;
  if (r.__danger) { if (!await confirmBox(`Supprimer ${D.title ? D.title(x) : D.one} ?`)) return null; L.splice(L.indexOf(x), 1); await regSave(p); redraw && redraw(); return null; }
  if (x) Object.assign(x, r); else { x = { id: DB.uid(), n: regNum(L, D.pre), ...r, at: Date.now(), by: myName() }; if (D.st) x.st = D.st0 || D.st[0][0]; L.push(x); }
  await regSave(p); redraw && redraw(); return x;
}
async function regSetSt(p, k, x, redraw) {
  const D = REG[k], canV = orgValid(D.f), canE = orgEdit(D.f);
  const v = await menu('Statut', D.st.map(([sk, sl, sc, need]) => ({ label: sl + (need === 'v' && !canV ? '  🔒' : ''), swatch: sc, value: sk, checked: x.st === sk })));
  if (!v || v === x.st) return;
  const S = D.st.find(s => s[0] === v);
  if (S[3] === 'v' && !canV) return alertBox(`« ${S[1]} » doit être validé par votre responsable (${Org.label() ? 'poste : ' + Org.label() : 'droit de validation'}).`);
  if (!canE && !canV) return;
  x.st = v; (x.log = x.log || []).push({ st: v, by: myName(), poste: Org.label(), at: Date.now() });
  await regSave(p); redraw && redraw();
}
function regRowHtml(D, x) {
  const R = D.row(x), S = regSt(D, x);
  return `<button class="fn-row ${R.late ? 'late' : ''}" data-rid="${x.id}"><span class="grow"><b>${R.urg ? '🔴 ' : ''}${esc(R.t || '')}</b><small>${esc(R.s || '')}</small></span>
    ${S ? `<span class="rg-st" style="--c:${S[2]}">${esc(S[1])}</span>` : R.v ? `<span class="fn-v" style="color:${R.c || 'inherit'}">${esc(R.v)}</span>` : ''}</button>`;
}
// liste d'un registre (avec filtres de statut, recherche, export)
async function renderReg(box, k, onChange) {
  const p = App.project, D = REG[k], L = D.store(p), canE = orgEdit(D.f);
  const redraw = () => { renderReg(box, k, onChange); onChange && onChange(); };
  box._f = box._f || 'all';
  const q = (box._q || '').toLowerCase();
  const vis = L.filter(x => (box._f === 'all' || x.st === box._f) && (!q || JSON.stringify(x).toLowerCase().includes(q))).sort((a, b) => String(b.date || b.deb || '').localeCompare(String(a.date || a.deb || '')) || (b.at || 0) - (a.at || 0));
  box.innerHTML = `<div class="rg">
    ${D.st && L.length ? `<div class="rg-ch"><button class="${box._f === 'all' ? 'on' : ''}" data-f="all">Tous · ${L.length}</button>${D.st.map(([sk, sl, sc]) => { const n = L.filter(x => x.st === sk).length; return n ? `<button class="${box._f === sk ? 'on' : ''}" data-f="${sk}" style="--c:${sc}">${esc(sl)} · ${n}</button>` : ''; }).join('')}</div>` : ''}
    ${L.length > 8 ? `<input class="rg-q" placeholder="Rechercher…" value="${esc(box._q || '')}">` : ''}
    <div class="rg-l">${vis.map(x => regRowHtml(D, x)).join('') || `<div class="fn-empty">${L.length ? 'Rien avec ce filtre.' : `Rien pour le moment — touchez « ＋ ${esc(D.one)} » pour commencer.`}</div>`}</div>
    <div class="rg-b">${canE ? `<button class="fn-add" data-a="add">${icon('plus')} ${esc(D.one)}</button>` : ''}${L.length ? `<button class="btn ghost small" data-a="xls">${icon('grid')} Excel</button>` : ''}</div></div>`;
  $$('[data-f]', box).forEach(b => b.onclick = () => { box._f = b.dataset.f; renderReg(box, k, onChange); });
  const qi = $('.rg-q', box); if (qi) qi.oninput = () => { box._q = qi.value; clearTimeout(box._qt); box._qt = setTimeout(() => { renderReg(box, k, onChange); const n = $('.rg-q', box); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  $$('[data-rid]', box).forEach(b => b.onclick = () => regOpen(p, k, L.find(x => x.id === b.dataset.rid), redraw));
  const ad = $('[data-a=add]', box); if (ad) ad.onclick = async () => { const x = await regEdit(p, k, null, redraw); if (x) regOpen(p, k, x, redraw); };
  const xl = $('[data-a=xls]', box); if (xl) xl.onclick = () => regXls(p, k);
}
// fiche détaillée
async function regOpen(p, k, x, redraw) {
  if (!x) return;
  const D = REG[k], canE = orgEdit(D.f);
  const body = () => { const S = regSt(D, x), R = D.row(x);
    return `<div class="rg-d">${S ? `<button class="rg-st big" data-a="st" style="--c:${S[2]}">${esc(S[1])} ${icon('chevdown', 'style="width:14px;height:14px"')}</button>` : ''}
      ${D.kpis ? `<div class="rg-k">${D.kpis(x).map(([l, v]) => `<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
      <div class="rg-fs">${D.fields.filter(f => x[f.name] !== '' && x[f.name] != null).map(f => `<div class="${f.type === 'textarea' ? 'w' : ''}"><span>${esc(f.label.split(' (')[0])}</span><b>${f.type === 'tel' ? `<a href="tel:${esc(x[f.name])}">${esc(x[f.name])}</a>` : esc(regVal(f, x[f.name])).replace(/\n/g, '<br>')}</b></div>`).join('')}</div>
      ${D.sub ? `<div class="rg-sh"><b>${esc(D.sub.t)}</b>${canE ? `<button class="btn small ghost" data-a="sadd">${icon('plus')} ${esc(D.sub.one)}</button>` : ''}</div>
        <div class="rg-sl">${(x[D.sub.k] || []).map((y, i) => { const Y = D.sub.row(y); return `<div class="rg-si ${y.done ? 'done' : ''} ${Y.late ? 'late' : ''}">${D.sub.k === 'act' ? `<input type="checkbox" data-sc="${i}" ${y.done ? 'checked' : ''} ${canE ? '' : 'disabled'}>` : ''}<button class="grow" data-se="${i}"><b>${esc(Y.t || '')}</b><small>${esc(Y.s || '')}</small></button></div>`; }).join('') || '<div class="fn-empty">—</div>'}</div>` : ''}
      ${D.photos ? `<div class="rg-sh"><b>Photos & documents</b>${canE ? `<button class="btn small ghost" data-a="ph">${icon('camera')} Ajouter</button>` : ''}</div><div class="rg-ph">${(x.ph || []).map((id, i) => `<img data-pi="${i}" data-fid="${id}">`).join('') || '<div class="fn-empty">—</div>'}</div>` : ''}
      ${(x.log || []).length ? `<div class="rg-log">${x.log.slice(-4).reverse().map(l => `<div>✔ ${esc((D.st.find(s => s[0] === l.st) || [])[1] || l.st)} · ${esc(l.by || '')}${l.poste ? ' (' + esc(l.poste) + ')' : ''} · ${new Date(l.at).toLocaleDateString('fr-FR')}</div>`).join('')}</div>` : ''}
      <div class="rg-a">${canE ? `<button class="btn small ghost" data-a="ed">${icon('edit')} Modifier</button>` : ''}<button class="btn small ghost" data-a="pdf">${icon('pdf')} PDF</button><button class="btn small ghost" data-a="wa">${icon('share')} WhatsApp</button>
        ${canE ? (D.actions || []).map((a, i) => `<button class="btn small ghost" data-ax="${i}">${icon(a.icon)} ${esc(a.label)}</button>`).join('') : ''}</div></div>`; };
  const s = sheet(`<div class="rg-wrap"></div>`, { title: D.title ? D.title(x) : D.row(x).t });
  const wrap = $('.rg-wrap', s.el), rerender = () => { $('h3', s.el).textContent = D.title ? D.title(x) : D.row(x).t; wrap.innerHTML = body(); bind(); redraw && redraw(); };
  const bind = () => {
    const A = (n) => $(`[data-a=${n}]`, wrap);
    if (A('st')) A('st').onclick = () => regSetSt(p, k, x, rerender);
    if (A('ed')) A('ed').onclick = async () => { const r = await regEdit(p, k, x, null); if (r === null && !D.store(p).includes(x)) { s.close(); redraw && redraw(); } else rerender(); };
    A('pdf').onclick = () => regPdf(p, k, x);
    A('wa').onclick = () => openUrl('https://wa.me/?text=' + encodeURIComponent(regText(p, k, x)));
    $$('[data-ax]', wrap).forEach(b => b.onclick = async () => { await D.actions[+b.dataset.ax].run(p, x); await regSave(p); rerender(); });
    if (A('sadd')) A('sadd').onclick = () => regSubEdit(p, k, x, null, rerender);
    $$('[data-se]', wrap).forEach(b => b.onclick = () => canE && regSubEdit(p, k, x, x[D.sub.k][+b.dataset.se], rerender));
    $$('[data-sc]', wrap).forEach(c => c.onchange = async () => { const y = x[D.sub.k][+c.dataset.sc]; y.done = c.checked; y.doneAt = c.checked ? todayISO() : null; await regSave(p); rerender(); });
    if (A('ph')) A('ph').onclick = async () => { const src = await pickSource('Ajouter'); if (!src) return; const fs = await pickImages(src); if (!fs.length) return; const ld = loading('Ajout…');
      try { for (const f of fs) { const r = await saveImageFile(p.id, f, 'photo', { hq: true }); (x.ph = x.ph || []).push(r.id); } await regSave(p); } finally { ld.close(); } rerender(); };
    $$('[data-fid]', wrap).forEach(async (im) => { im.src = await fileURL(im.dataset.fid); im.onclick = async () => showGallery(await Promise.all((x.ph || []).map(async id => ({ src: await fileURL(id), id }))), +im.dataset.pi, canE ? { onDelete: async (it) => { x.ph = x.ph.filter(i => i !== it.id); await regSave(p); rerender(); } } : {}); });
  };
  rerender();
}
async function regSubEdit(p, k, x, y, done) {
  const D = REG[k], S = D.sub, L = (x[S.k] = x[S.k] || []);
  const r = await formSheet(y ? S.one : 'Nouveau · ' + S.one, S.fields.map(f => ({ ...f, value: y ? y[f.name] ?? '' : f.def ? f.def() : f.name === 'n' ? String(L.length + 1) : f.value ?? '' })), { okLabel: 'Enregistrer', danger: y ? 'Supprimer' : null });
  if (!r) return;
  if (r.__danger) L.splice(L.indexOf(y), 1);
  else { const err = S.guard && S.guard(r, y); if (err) return alertBox(err); if (y) Object.assign(y, r); else L.push({ id: DB.uid(), ...r }); }
  await regSave(p); done();
}
function regText(p, k, x) {
  const D = REG[k], S = regSt(D, x);
  return [`*${D.title ? D.title(x) : D.row(x).t}*`, `${p.name}`, S ? `Statut : ${S[1]}` : '', ...D.fields.filter(f => x[f.name]).map(f => `${f.label.split(' (')[0]} : ${regVal(f, x[f.name])}`),
    ...(D.sub ? [(x[D.sub.k] || []).length ? `\n*${D.sub.t}*` : '', ...(x[D.sub.k] || []).map(y => { const Y = D.sub.row(y); return `${y.done ? '✅' : '▫️'} ${Y.t}${Y.s ? ' — ' + Y.s : ''}`; })] : [])].filter(Boolean).join('\n');
}
async function regPdf(p, k, x) {
  const D = REG[k], S = regSt(D, x), C = newDoc(D.t, p), { doc, M, W } = C;
  C.text(D.title ? D.title(x) : D.row(x).t, { size: 15, bold: true, gap: 1 });
  if (S) C.text(`Statut : ${S[1]}`, { size: 10, bold: true, color: [70, 70, 70], gap: 3 });
  if (D.kpis) { C.text(D.kpis(x).map(([l, v]) => `${l} : ${v}`).join('   ·   '), { size: 9.5, color: [40, 40, 40], gap: 3 }); }
  for (const f of D.fields) { const v = regVal(f, x[f.name]); if (!v) continue;
    if (f.type === 'textarea') { C.text(f.label.split(' (')[0], { size: 10, bold: true, gap: .5 }); C.text(v, { size: 10, indent: 3, gap: 2.5 }); }
    else C.text(`${f.label.split(' (')[0]} : ${v}`, { size: 10, gap: 1.2 }); }
  if (D.sub && (x[D.sub.k] || []).length) {
    C.y += 2; C.text(D.sub.t, { size: 12, bold: true, gap: 1.5 });
    const cols = D.sub.fields.map(f => f.label.split(' (')[0]), cw = (W - 2 * M - 8) / cols.length;
    const rowH = (cells) => Math.max(...cells.map(c => doc.splitTextToSize(pt(c), cw - 2).length)) * 4.2 + 2.5;
    const drawRow = (cells, head) => { const h = rowH(cells); C.need(h); if (head) { doc.setFillColor(230, 236, 245); doc.rect(M, C.y, W - 2 * M, h, 'F'); }
      doc.setFont('helvetica', head ? 'bold' : 'normal'); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
      cells.forEach((c, i) => doc.text(doc.splitTextToSize(pt(c), cw - 2), M + 8 + i * cw, C.y + 4.2)); doc.setDrawColor(210); doc.line(M, C.y + h, W - M, C.y + h); C.y += h; };
    drawRow(cols, true);
    for (const y of x[D.sub.k]) { const sy = C.y; drawRow(D.sub.fields.map(f => regVal(f, y[f.name])), false); if (D.sub.k === 'act') { doc.setFontSize(10); doc.text(y.done ? 'X' : '', M + 2.5, sy + 4.4); doc.rect(M + 1.5, sy + 1.4, 3.6, 3.6); } }
    C.y += 3;
  }
  if ((x.log || []).length) { C.text('Validations', { size: 11, bold: true, gap: 1 }); x.log.forEach(l => C.text(`${(D.st.find(s => s[0] === l.st) || [])[1] || l.st} — ${l.by || ''}${l.poste ? ' (' + l.poste + ')' : ''} — ${new Date(l.at).toLocaleDateString('fr-FR')}`, { size: 9, color: [80, 80, 80], gap: .8 })); C.y += 2; }
  for (const id of (x.ph || []).slice(0, 8)) { try { const f = await DB.get('files', id); if (!f) continue; const url = await fileURL(id), im = await loadImage(url), w = W - 2 * M, h = Math.min(120, w * im.height / im.width), ww = h * im.width / im.height;
    C.need(h + 4); doc.addImage(im, 'JPEG', M + (w - ww) / 2, C.y, ww, h); C.y += h + 4; } catch (e) {} }
  C.y += 6; C.need(24); doc.setFontSize(9); doc.setTextColor(90); doc.text(pt(`Établi par : ${myName() || '...............'}${Org.label() ? ' — ' + Org.label().replace(/^\S+\s/, '') : ''}`), M, C.y); doc.text('Visa :', W / 2 + 10, C.y);
  C.finish(); await sharePdf(doc, `${safeName((D.title ? D.title(x) : D.row(x).t))}_${safeName(p.name)}.pdf`);
}
async function regXls(p, k) {
  const D = REG[k], L = D.store(p), ld = loading('Création du fichier Excel…');
  try {
    const head = ['N°', ...D.fields.filter(f => f.name !== 'n').map(f => f.label.split(' (')[0]), ...(D.st ? ['Statut'] : []), ...(D.sub ? [D.sub.t] : [])];
    const rows = L.map(x => [x.n || '', ...D.fields.filter(f => f.name !== 'n').map(f => f.type === 'number' ? fN(x[f.name]) : regVal(f, x[f.name])), ...(D.st ? [(regSt(D, x) || [])[1] || ''] : []), ...(D.sub ? [(x[D.sub.k] || []).map(y => D.sub.row(y).t).join(' | ')] : [])]);
    const b = await xlsxBlob([{ name: D.t.slice(0, 28), head: 0, rows: [head, ...rows], widths: head.map((h, i) => i === 0 ? 10 : 22) }]);
    ld.close(); await shareBlob(b, `${safeName(D.t)}_${safeName(p.name)}_${todayISO()}.xlsx`);
  } catch (e) { ld.close(); alertBox('Export impossible : ' + (e.message || e)); }
}
// bordereau : ajouter les PV reçus mais pas encore livrés, et les marquer livrés
async function regJoinPv(p, x) {
  const recs = (await DB.byProject('receptions', p.id)).filter(d => kindOf(d) === 'Ferraillage');
  const L = recs.flatMap(d => (d.rows || []).filter(r => r.element && (r.pvRecu || r.pvExist) && !r.pvLivre).map(r => ({ d, r }))).sort((a, b) => a.d.date.localeCompare(b.d.date));
  if (!L.length) return toast('Aucun PV reçu en attente de livraison');
  await new Promise((res) => {
    const s = sheet(`<div class="rg-pv">${L.map((o, i) => `<label class="bn-i"><input type="checkbox" data-i="${i}" checked><span>${esc(fmtDate(o.d.date))} · ${esc(o.r.niv ? o.r.niv + ' · ' : '')}${esc(o.r.element)}</span></label>`).join('')}</div><button class="btn" style="width:100%;margin-top:10px" data-ok>Ajouter au bordereau</button>`, { title: `PV à joindre · ${L.length}` });
    $('[data-ok]', s.el).onclick = async () => { const pick = $$('[data-i]', s.el).filter(c => c.checked).map(c => L[+c.dataset.i]);
      x.docs = [String(x.docs || '').trim(), ...pick.map(o => `PV de réception ferraillage — ${o.r.niv ? o.r.niv + ' · ' : ''}${o.r.element} (${fmtDate(o.d.date)})`)].filter(Boolean).join('\n');
      const ds = new Set(); pick.forEach(o => { o.r.pvLivre = true; o.r.pvLivreAt = x.date || todayISO(); ds.add(o.d); }); for (const d of ds) await DB.put('receptions', d);
      toast(`${pick.length} PV marqué(s) livré(s) ✓`); s.close(); };
    s.onClose = res;
  });
}
// onglets d'une section (Labo, HSE, Visas, Avenants…)
function regTabs(root, key, tabs, extraTop) {
  App.rgTab = App.rgTab || {}; const cur = tabs.find(t => t[0] === App.rgTab[key]) ? App.rgTab[key] : tabs[0][0];
  root.innerHTML = `${extraTop ? extraTop() : ''}<div class="gs-tabs">${tabs.map(([k, l]) => `<button class="${k === cur ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div class="rg-body"></div>`;
  $$('[data-tab]', root).forEach(b => b.onclick = () => { App.rgTab[key] = b.dataset.tab; regTabs(root, key, tabs, extraTop); });
  const T = tabs.find(t => t[0] === cur), box = $('.rg-body', root);
  if (T[2]) T[2](box); else renderReg(box, cur, extraTop ? () => { const h = $('.rg-top', root); if (h) h.outerHTML = extraTop(); } : null);
}

// ---------- sections ----------
function renderReunions(root) { renderReg(root, 'reu'); }
function renderRfi(root) { renderReg(root, 'rfi'); }
function renderVisa(root) { regTabs(root, 'visa', [['visa', '🛂 Visas'], ['bord', '📨 Bordereaux d\'envoi']]); }
function hseDays(p) { const A = (REG.acc.store(p)).filter(x => /Accident/.test(x.type || '')).map(x => x.date).sort(); const ref = A.length ? A[A.length - 1] : (p.hseStart || null); return ref ? daysSince(ref) : null; }
function renderHse(root) {
  const p = App.project;
  regTabs(root, 'hse', [['caus', '🗣️ Causeries'], ['epi', '🦺 EPI'], ['acc', '🚑 Accidents'], ['perm', '📝 Permis']], () => { const d = hseDays(p), m = REG.caus.store(p).filter(x => (x.date || '').slice(0, 7) === todayISO().slice(0, 7)).length;
    return `<div class="rg-top hs"><div class="hs-big"><b>${d == null ? '✓' : d}</b><span>${d == null ? 'aucun accident enregistré' : 'jours sans accident'}</span></div><div class="hs-s"><div><b>${m}</b><span>causerie(s) ce mois</span></div><div><b>${REG.perm.store(p).filter(x => x.st !== 'clo').length}</b><span>permis actifs</span></div></div></div>`; });
}
function renderLabo(root) {
  const p = App.project;
  regTabs(root, 'labo', [['epr', '🧱 Éprouvettes', (box) => { const G = gsData(p), redraw = () => renderLabo(root); gsLaboTab(box, p, G, () => DB.put('projects', p), redraw); if (!orgEdit('labo')) $$('[data-a]', box).forEach(b => b.style.display = 'none'); }], ['slump', '🧪 Slump'], ['ess', '🔬 Essais']]);
}
function renderAvenants(root) {
  const p = App.project;
  regTabs(root, 'av', [['av', '📑 Avenants'], ['os', '📣 Ordres de service']], () => { const F = finData(p), ok = F.av.filter(a => !['br', 'ref'].includes(a.st)), m = ok.reduce((s, a) => s + fN(a.m), 0), j = planDelai(p);
    return `<div class="rg-top fn-kpi" style="padding:12px 12px 0"><div><span>Avenants retenus</span><b>${ok.length}</b><small>${fDH(m)}</small></div><div><span>Délai supplémentaire</span><b>+${j} j</b><small>avenants + OS</small></div></div>`; });
}
function renderSt(root) { renderReg(root, 'st'); }

// délai ajouté au marché : avenants retenus + OS (prolongations + périodes d'arrêt)
function planDelai(p) {
  const av = finData(p).av.filter(a => !['br', 'ref'].includes(a.st)).reduce((s, a) => s + fN(a.delai), 0);
  const os = REG.os.store(p).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let j = os.reduce((s, o) => s + fN(o.j), 0), stop = null;
  for (const o of os) { if (/Arrêt/.test(o.type)) stop = o.date; else if (/Reprise/.test(o.type) && stop) { j += Math.max(0, Math.round((new Date(o.date) - new Date(stop)) / 864e5)); stop = null; } }
  if (stop) j += Math.max(0, daysSince(stop));
  return av + j;
}

// ---------- cartes du briefing venant des registres ----------
function regBriefCards(ps) {
  const C = [];
  for (const [k, D] of Object.entries(REG)) {
    if (!D.brief || !Org.can(D.f, 'see') || !featOn(D.f)) continue;
    const items = ps.flatMap(p => (D.brief(p, D.store(p)) || []).map(it => ({ ...it, pid: p.id })));
    if (items.length) C.push({ k: 'reg:' + k, ...D.briefCard, n: items.length, items, alert: items.some(x => x.late) });
  }
  // validations en attente (circuit : le N+1 valide ; rouge après 48 h = escalade)
  const w = ps.flatMap(p => Object.entries(REG).filter(([, D]) => D.wait && orgValid(D.f) && Org.poste() && featOn(D.f)).flatMap(([k, D]) => D.store(p).filter(x => D.wait.includes(x.st)).map(x => ({ pid: p.id, label: `${D.one} : ${D.row(x).t}`, sub: `${p.name} · ${(regSt(D, x) || [])[1] || ''}`, late: (Date.now() - (x.at || 0)) > 2 * 864e5, rk: k }))));
  if (w.length) C.push({ k: 'valid', e: '✍️', t: 'À valider', c: '#eab308', n: w.length, items: w, alert: w.some(x => x.late) });
  return C;
}
const REG_SECTION = { reu: 'reunions', rfi: 'rfi', visa: 'visa', bord: 'visa', caus: 'hse', epi: 'hse', acc: 'hse', perm: 'hse', slump: 'labo', ess: 'labo', av: 'avenants', os: 'avenants', st: 'st' };
function regGo(k) { const sec = REG_SECTION[k]; App.rgTab = App.rgTab || {}; App.rgTab[sec === 'avenants' ? 'av' : sec] = k; App.section = sec; return renderSection(); }

// ---------- tableau de bord : indicateurs selon le poste ----------
async function dashKpis(p) {
  const T = [], can = (f) => !f || (sectionOn(SECTION_FEATURE_REV[f] || f) && Org.can(f, 'see'));
  try { if (can('tce') && (p.tce || {}).lots && p.tce.lots.length) { const L = p.tce.lots, tot = L.reduce((s, l) => s + fN(l.m), 0), av = tot ? L.reduce((s, l) => s + fN(l.m) * fN(l.av), 0) / tot : L.reduce((s, l) => s + fN(l.av), 0) / L.length; T.push(['tce', '🏗️', 'Avancement TCE', Math.round(av) + ' %', '']); } } catch (e) {}
  try { if (can('planning') && (p.plan || {}).tasks) { const n = p.plan.tasks.filter(t => fN(t.av) < 100 && t.fin && t.fin < todayISO()).length; T.push(['planning', '📅', 'Planning', n ? n + ' en retard' : 'à jour', n ? 'bad' : 'ok']); } } catch (e) {}
  if (can('rfi')) { const n = REG.rfi.store(p).filter(x => x.st === 'env').length; if (n || REG.rfi.store(p).length) T.push(['rfi', '❓', 'RFI sans réponse', n, n ? 'warn' : 'ok']); }
  if (can('visa')) { const n = REG.visa.store(p).filter(x => x.st === 'env').length; if (n || REG.visa.store(p).length) T.push(['visa', '🛂', 'Visas en attente', n, n ? 'warn' : 'ok']); }
  if (can('reunions')) { const n = REG.reu.store(p).flatMap(x => x.act || []).filter(a => !a.done).length; if (REG.reu.store(p).length) T.push(['reunions', '🗓️', 'Actions de réunion', n, n ? 'warn' : 'ok']); }
  if (can('hse')) { const d = hseDays(p); T.push(['hse', '🦺', 'Jours sans accident', d == null ? '✓ aucun accident' : d, 'ok']); }
  if (can('labo')) { const n = REG.ess.store(p).filter(x => x.conf === 'Non conforme').length + REG.slump.store(p).filter(x => REG.slump.row(x).late).length; if (n || REG.ess.store(p).length || REG.slump.store(p).length) T.push(['labo', '🧪', 'Labo non conforme', n, n ? 'bad' : 'ok']); }
  if (can('finance')) { try { const K = finCalc(p); if (K.marche || K.dep) T.push(['finance', '💰', 'Marge estimée', fDH(K.marge), K.marge < 0 ? 'bad' : 'ok']); } catch (e) {} }
  if (can('st') && (p.st || []).length) { const n = p.st.filter(x => x.assur && x.assur < addDays(todayISO(), 30)).length; T.push(['st', '🤝', 'Sous-traitants', n ? n + ' assurance(s)' : p.st.length + ' actif(s)', n ? 'warn' : 'ok']); }
  if (!T.length) return '';
  return `<div class="dk">${T.map(([s, e, l, v, c]) => `<button class="dk-t ${c}" data-dk="${s}"><span>${e} ${esc(l)}</span><b>${esc(String(v))}</b></button>`).join('')}</div>`;
}
const SECTION_FEATURE_REV = { finance: 'finance', tce: 'tce', planning: 'planning', rfi: 'rfi', visa: 'visa', reunions: 'reunions', hse: 'hse', labo: 'labo', st: 'st' };
