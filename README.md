# SiteTeam

Application Android (Capacitor 6) de gestion de chantier en équipe : entreprise, rôles et droits,
projets, plans, réserves, PV, rapports, synchronisation Firebase + Google Drive.

- Identifiant Android : `com.siteteam.app`
- Branche de travail : `siteteam` (la branche `main` est l'application *Chantier*)
- **Guide complet de reprise, build, signature et sauvegarde des données : [`docs/REPRISE.md`](docs/REPRISE.md)**
- Règles Firestore : `docs/firebase/firestore.rules` · Script Google Drive : `docs/apps-script/Code.gs`
- Variables de build : `.env.example`

Démarrage rapide :

```bash
npm ci && npm run copy-libs
cd www && python3 -m http.server 8765   # test navigateur
```

APK : onglet **Releases** → `siteteam-v1.0.<n>` → `SiteTeam.apk`.
