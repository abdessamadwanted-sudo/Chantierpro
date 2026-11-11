import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliserAlerte, construireTemplate, envoyerWhatsApp } from './send.mjs';
test('alerte validée et limitée', () => {
  const a = normaliserAlerte({ type: 'rappel', projet: 'Projet', description: 'x'.repeat(500) });
  assert.equal(a.description.length, 180);
  assert.throws(() => normaliserAlerte({ type: 'rappel' }));
});
test('numéros et templates validés', () => {
  assert.throws(() => construireTemplate({ destinataire: '0612345678', template: 'alerte' }));
  assert.throws(() => construireTemplate({ destinataire: '+212612345678', template: 'ALERTE!' }));
  const p = construireTemplate({ destinataire: '+212612345678', template: 'alerte_site', variables: ['P1'] });
  assert.equal(p.to, '212612345678'); assert.equal(p.template.components[0].parameters[0].text, 'P1');
});
test('simulation ne réalise aucune requête', async () => {
  const r = await envoyerWhatsApp({ destinataire: '+212612345678', template: 'alerte_site', fetcher: () => { throw Error('réseau interdit'); } });
  assert.equal(r.simulation, true); assert.equal(r.accepte, false);
});
test('vrai envoi exige un secret serveur', async () => {
  await assert.rejects(envoyerWhatsApp({ destinataire: '+212612345678', template: 'alerte_site', simulation: false }), /Configuration serveur/);
});
test('acceptation Meta ne vaut pas livraison', async () => {
  let calls = 0;
  const r = await envoyerWhatsApp({ destinataire: '+212612345678', template: 'alerte_site', token: 'test-token', phoneNumberId: '1234567890', simulation: false,
    fetcher: async (url, opts) => { calls++; assert.match(url, /graph.facebook.com/); assert.match(opts.headers.Authorization, /^Bearer /); return { ok: true, json: async () => ({ messages: [{ id: 'wamid.test' }] }) }; } });
  assert.equal(calls, 1); assert.equal(r.accepte, true); assert.equal(r.livre, false);
});
