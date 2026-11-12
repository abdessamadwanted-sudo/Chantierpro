import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rappelsAEnvoyer, cleEnvoi, instantRappel, chatValide } from './rules.mjs';
import { envoyer, configBot, codeDepuisMiseAJour, requeteEnvoi } from './bot.mjs';

const T = new Date('2026-11-11T10:00:00');
test('rappel dont l heure est atteinte est envoyé une seule fois', () => {
  const r = [{ id: 'a', text: 'Béton', at: '2026-11-11T09:30', done: false }];
  const e1 = rappelsAEnvoyer({ projetId: 'p', rappels: r, maintenant: T });
  assert.equal(e1.length, 1);
  const e2 = rappelsAEnvoyer({ projetId: 'p', rappels: r, maintenant: T, dejaEnvoyes: new Set([e1[0].cle]) });
  assert.equal(e2.length, 0);
});
test('rappel terminé, futur ou trop ancien non envoyé', () => {
  const r = [
    { id: 'b', text: 'fait', at: '2026-11-11T09:00', done: true },
    { id: 'c', text: 'futur', at: '2026-11-11T11:00', done: false },
    { id: 'd', text: 'ancien', at: '2026-11-01T09:00', done: false }];
  assert.equal(rappelsAEnvoyer({ projetId: 'p', rappels: r, maintenant: T }).length, 0);
});
test('date seule = fin de journée', () => {
  assert.equal(instantRappel('2026-11-11'), new Date('2026-11-11T23:59:59').getTime());
  assert.ok(Number.isNaN(instantRappel('11/11/2026')));
});
test('clé d envoi stable et chat valide', () => {
  assert.equal(cleEnvoi('p', { id: 'a', at: '2026-11-11' }), 'p|a|2026-11-11');
  assert.equal(chatValide('-1001234'), true);
  assert.equal(chatValide('abc; rm'), false);
});
test('envoi sans token = simulation, aucun appel réseau', async () => {
  let appels = 0;
  const r = await envoyer('123', 'test', { env: {}, fetchFn: async () => { appels++; return { json: async () => ({ ok: true }) }; } });
  assert.equal(r.simule, true);
  assert.equal(appels, 0);
  assert.equal(configBot({}).reel, false);
});
test('le token ne fuit pas dans le résultat de simulation', async () => {
  const r = await envoyer('123', 'x', { env: { TELEGRAM_BOT_TOKEN: '123456:ABCDEFGHIJKLMNOPQRSTUV', TELEGRAM_ENVOI_REEL: 'non' } });
  assert.equal(r.simule, true);
  assert.ok(!JSON.stringify(r).includes('ABCDEFGHIJKLMNOPQRSTUV'));
});
test('lecture du /start avec code de liaison', () => {
  assert.deepEqual(codeDepuisMiseAJour({ message: { text: '/start Ab12Cd34', chat: { id: 55 } } }), { chatId: '55', code: 'Ab12Cd34' });
  assert.equal(codeDepuisMiseAJour({ message: { text: 'bonjour', chat: { id: 55 } } }), null);
});
test('requête refusée si chat ou message invalide', () => {
  assert.throws(() => requeteEnvoi('x y', 'a', ''));
  assert.throws(() => requeteEnvoi('12', '   ', ''));
});
