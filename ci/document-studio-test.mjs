// Tests du noyau documentaire (node ci/document-studio-test.mjs).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync('www/js/document-studio.js', 'utf8'), ctx);
const S = ctx.DocumentStudio;
const m = S.nouveauSuivi('suivi_sols', 'entreprise_1', 'qualite', 'Suivi finitions sols', [
  { id: 'code', libelle: 'Code finition', type: 'liste', obligatoire: true, options: ['ST01','ST02'] },
  { id: 'surface', libelle: 'Surface en m²', type: 'nombre', position: { page: 1, x: .1, y: .2, w: .3, h: .05 } },
  { id: 'visa', libelle: 'Signature', type: 'signature' }
]);
assert.equal(m.categorie, 'suivi');
assert.equal(S.enPoints(m.champs[1].position, 600, 800).y, 160);
assert.throws(() => S.position({ page:1,x:.9,y:.2,w:.2,h:.1 }), /Position/);
assert.throws(() => S.modele({ ...m, champs: [m.champs[0], m.champs[0]] }), /dupliqué/);
assert.throws(() => S.remplir(m, { code:'ST03' }, { entrepriseId:'entreprise_1' }), /Option/);
assert.throws(() => S.remplir(m, { code:'ST01' }, { entrepriseId:'autre' }), /Périmètre/);
assert.throws(() => S.remplir(m, { code:'ST01', extra:1 }, { entrepriseId:'entreprise_1' }), /inconnu/);
const d = S.remplir(m, { code:'ST01', surface:120.5 }, { entrepriseId:'entreprise_1', projetId:'p1' });
assert.equal(d.modeleVersion, 1);
assert.throws(() => S.transition(d,'valide','uid',null,true), /Transition/);
assert.throws(() => S.transition(d,'soumis','uid',null,false), /droits/);
const soumis = S.transition(d,'soumis','uid','2026-11-11T19:00:00Z',true);
const valide = S.transition(soumis,'valide','responsable','2026-11-11T19:05:00Z',true);
assert.equal(valide.historique.length, 2);
assert.equal(d.statut,'brouillon');
// v1.0.x : les dates valides doivent être acceptées (régression : regex mal échappée), les invalides refusées
const md = S.nouveauSuivi('suivi_dates', 'entreprise_1', 'qualite', 'Suivi dates', [{ id: 'jour', libelle: 'Date', type: 'date' }]);
assert.equal(S.remplir(md, { jour: '2026-11-11' }, { entrepriseId: 'entreprise_1' }).valeurs.jour, '2026-11-11');
assert.throws(() => S.remplir(md, { jour: '11/11/2026' }, { entrepriseId: 'entreprise_1' }), /Date invalide/);
assert.throws(() => S.remplir(md, { jour: '2026-13-45' }, { entrepriseId: 'entreprise_1' }), /Date invalide/);
console.log('errors document-studio', []);
