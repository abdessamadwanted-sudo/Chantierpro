import fs from 'fs';
const s = fs.readFileSync('www/js/team.js', 'utf8');
const m = s.match(/const FIRESTORE_RULES = `([\s\S]*?)`;/);
fs.writeFileSync('ci/firestore.rules', m[1].replace(/\\`/g, '`'));
