// Une publication SiteTeam ne dépend plus du numéro du workflow.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const syntax = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function compare(a, b) {
  const A = a.split('.').map(BigInt), B = b.split('.').map(BigInt);
  for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] > B[i] ? 1 : -1;
  return 0;
}
export function releaseVersion(manifest, refs) {
  if (!manifest || !Object.hasOwn(manifest, 'version')) throw new Error('Manifeste de publication invalide');
  const v = manifest.version;
  if (v === null) return '';
  if (typeof v !== 'string' || !syntax.test(v)) throw new Error('Version attendue : X.Y.Z sans zéro initial');
  // Les tags de Chantier et les tags de test ne participent pas à la comparaison.
  const versions = refs.split(/\r?\n/).map(l => l.match(/\srefs\/tags\/siteteam-v([^\s]+)$/)?.[1]).filter(s => s && syntax.test(s));
  if (!versions.length) throw new Error('Aucun tag SiteTeam trouvé : vérification de monotonie impossible');
  if (versions.some(old => compare(v, old) <= 0)) throw new Error('Version SiteTeam déjà utilisée ou inférieure à une version publiée');
  return v;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [manifest, refs] = process.argv.slice(2);
    const v = releaseVersion(JSON.parse(readFileSync(manifest, 'utf8')), readFileSync(refs, 'utf8'));
    if (v) console.log(v);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
