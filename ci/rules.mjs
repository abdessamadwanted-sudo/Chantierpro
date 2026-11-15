import fs from 'fs';
const s = fs.readFileSync('www/js/team.js', 'utf8');
const m = s.match(/const FIRESTORE_RULES = `([\s\S]*?)`;/);
fs.writeFileSync('ci/firestore.rules', m[1].replace(/\\`/g, '`'));
const m2 = s.match(/const STORAGE_RULES = `([\s\S]*?)`;/);
if (m2) fs.writeFileSync('ci/storage.rules', m2[1].replace(/\\`/g, '`'));

// copies de référence pour la documentation : jamais en retard sur team.js
fs.mkdirSync('docs/firebase', { recursive: true });
fs.copyFileSync('ci/firestore.rules', 'docs/firebase/firestore.rules');
if (fs.existsSync('ci/storage.rules')) fs.copyFileSync('ci/storage.rules', 'docs/firebase/storage.rules');
