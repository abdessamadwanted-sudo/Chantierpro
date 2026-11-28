import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseVersion, compare } from './release-version.mjs';
const refs = ['abc\trefs/tags/siteteam-v1.0.348','def\trefs/tags/siteteam-v1.0.349','ghi\trefs/tags/v99.0.0','jkl\trefs/tags/siteteam-v2.0.0-beta'].join('\n');
test('pause initiale sans publication', () => assert.equal(releaseVersion({version:null}, ''),''));
test('version suivante et passage de minor', () => {
  assert.equal(releaseVersion({version:'1.0.350'},refs),'1.0.350');
  assert.equal(releaseVersion({version:'1.1.0'},refs),'1.1.0');
  assert.equal(compare('1.10.0','1.2.0'),1);
});
test('refus des versions existantes, anciennes ou non canoniques', () => {
  for (const v of ['1.0.349','1.0.348','1.0.9','1.01.0','1.1','1.1.0-beta','1.1.0\n',1]) assert.throws(()=>releaseVersion({version:v},refs));
});
test('refus de publier sans historique de tags', () => assert.throws(()=>releaseVersion({version:'1.1.0'},'')));
test('manifeste invalide', () => { assert.throws(()=>releaseVersion({},refs)); assert.throws(()=>releaseVersion(null,refs)); });
