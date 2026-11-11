// SiteTeam : moteur de préparation des alertes WhatsApp (côté serveur uniquement).
// Ce composant prépare une décision, sans réseau, sans Firestore et sans envoi.
import { normaliserAlerte } from './send.mjs';

const TYPES = new Set(['rappel', 'echeance', 'retard', 'critique', 'reception']);
const E164 = /^\+[1-9]\d{7,14}$/;

export function cleAlerte({ organisationId, projetId, type, sourceId, echeance, version = 1 }) {
  const vals = [organisationId, projetId, type, sourceId, echeance, version];
  if (vals.some(v => v === undefined || v === null || String(v).trim() === '')) throw new Error('Identifiant d\'alerte incomplet');
  // Encodage non ambigu : le dédoublonnage final doit être fait atomiquement dans le stockage serveur.
  return JSON.stringify(vals.map(String));
}

export function evaluerAlerte({ evenement, preferences, autorise, maintenant = new Date(), dejaTraite = false, quotaRestant = 0 }) {
  if (!evenement || !preferences) return { envoyer: false, motif: 'configuration_absente' };
  // Le serveur doit calculer autorise depuis les droits persistés : jamais se fier à un booléen client.
  if (autorise !== true) return { envoyer: false, motif: 'non_autorise' };
  if (!preferences.active || preferences.consentement !== true) return { envoyer: false, motif: 'non_consenti' };
  if (!E164.test(preferences.destinataire || '')) return { envoyer: false, motif: 'numero_invalide' };
  if (!TYPES.has(evenement.type)) return { envoyer: false, motif: 'type_invalide' };
  if (Array.isArray(preferences.types) && !preferences.types.includes(evenement.type)) return { envoyer: false, motif: 'type_desactive' };
  if (dejaTraite) return { envoyer: false, motif: 'doublon' };
  if (!Number.isSafeInteger(quotaRestant) || quotaRestant <= 0) return { envoyer: false, motif: 'quota_atteint' };
  const instant = new Date(evenement.envoiPrevu);
  const now = new Date(maintenant);
  if (!Number.isFinite(instant.getTime()) || !Number.isFinite(now.getTime())) return { envoyer: false, motif: 'date_invalide' };
  if (instant > now) return { envoyer: false, motif: 'pas_encore' };
  // Ne pas transmettre la description brute d'une non-conformité sensible au numéro personnel.
  const alerte = normaliserAlerte({
    type: evenement.type, projet: evenement.projetNom, ouvrage: evenement.ouvrage || '',
    echeance: evenement.echeance || '', description: ''
  });
  return { envoyer: true, motif: 'pret_simulation', cle: cleAlerte(evenement), destinataire: preferences.destinataire,
    variables: [alerte.projet, alerte.type, alerte.ouvrage || '-', alerte.echeance || '-'] };
}
