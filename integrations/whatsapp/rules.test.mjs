import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluerAlerte, cleAlerte } from './rules.mjs';

const evenement = { organisationId: 'org1', projetId: 'p1', sourceId: 'a1', type: 'rappel',
  envoiPrevu: '2026-11-11T10:00:00Z', echeance: '2026-11-11 11:00', version: 1, projetNom: 'Projet Test' };
const preferences = { active: true, consentement: true, destinataire: '+212612345678', types: ['rappel'] };
const check = overrides => evaluerAlerte({ evenement, preferences, autorise: true,
  maintenant: '2026-11-11T10:05:00Z', quotaRestant: 5, ...overrides });
test('alerte prête en simulation, champs limités', () => {
  const r = check({});
  assert.equal(r.envoyer, true); assert.equal(r.motif, 'pret_simulation');
  assert.equal(r.variables.length, 4); assert.equal(r.variables[0], 'Projet Test');
});
test('refus sans autorisation ou sans consentement', () => {
  assert.equal(check({ autorise: false }).motif, 'non_autorise');
  assert.equal(check({ preferences: { ...preferences, consentement: false } }).motif, 'non_consenti');
});
test('refus quota, doublon, type désactivé', () => {
  assert.equal(check({ quotaRestant: 0 }).motif, 'quota_atteint');
  assert.equal(check({ dejaTraite: true }).motif, 'doublon');
  assert.equal(check({ preferences: { ...preferences, types: ['critique'] } }).motif, 'type_desactive');
});
test('rappel futur et mauvais numéro ne sont pas émis', () => {
  assert.equal(check({ maintenant: '2026-11-11T09:00:00Z' }).motif, 'pas_encore');
  assert.equal(check({ preferences: { ...preferences, destinataire: '0612345678' } }).motif, 'numero_invalide');
});
test('identifiant déterministe et non ambigu entre organisations', () => {
  const a = cleAlerte(evenement);
  assert.equal(a, cleAlerte({ ...evenement }));
  assert.notEqual(a, cleAlerte({ ...evenement, organisationId: 'org2' }));
  assert.throws(() => cleAlerte({ ...evenement, sourceId: '' }));
});
