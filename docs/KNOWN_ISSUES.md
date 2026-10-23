# KNOWN_ISSUES — SiteTeam

Constatés en lisant le code et les builds (octobre 2026). « Non vérifié » = soupçonné, non reproduit.

| # | Problème | Où | Impact | Statut |
|---|---|---|---|---|
| 1 | **Signatures différentes jusqu'à v1.0.8** : chaque APK signé par une clé debug aléatoire (perdue) | build-siteteam.yml (avant le 23/10/2026) | Impossible d'installer une mise à jour par-dessus une version ≤ 1.0.8 : désinstallation obligatoire une fois | **Corrigé** à partir de v1.0.9 (clé fixe + vérification d'empreinte) |
| 2 | Connexion IndexedDB unique jamais rouverte : erreur « database connection is closing » pendant une longue synchro | www/js/db.js (`open()` sans `onclose`/`onversionchange`) | Synchro bloquée jusqu'au redémarrage de l'app | Constaté sur l'app *Chantier* (même code) ; **non corrigé** |
| 3 | Partage externe : la règle Firestore autorise le destinataire à réécrire **tout** le tableau `responses` | règles `shares/{code}` | Un destinataire pourrait effacer l'historique des réponses | Non corrigé |
| 4 | Partage externe : le destinataire ne voit **aucun document** du projet, seulement la description | team.js | Fonction limitée à un journal d'échanges | Limite connue (v1) |
| 5 | Requête `shares where cid == and pid ==` sans index déclaré | team.js `projectShares` | Possible erreur « index requis » | **Non vérifié** en production |
| 6 | Formules (Basic/Pro…) affichées sans aucune limite appliquée | team.js `PLANS` | Quotas non respectés | Simulé |
| 7 | `targetSdk` 34 < API 36 exigée par Google Play (depuis le 31/08/2026) | projet Android généré (Capacitor 6) | Publication Play impossible | Non traité |
| 8 | Pas de suppression de compte | team.js | Exigence Google Play non remplie | Non traité |
| 9 | Module « Emploi & carrière » présent dans le dépôt mais **non chargé** par index.html | career.js | Code mort | Non traité |
| 10 | `pages.yml` déclenché sur une branche inexistante | .github/workflows | Pas de version web publiée pour SiteTeam | Volontaire (à décider) |
| 11 | Avant connexion, `Team.lvl()` renvoie 4 (tout autorisé côté interface) | team.js | Affichage seulement ; le serveur refuse | Mineur |
| 12 | Invitations et partages sans date d'expiration automatique | team.js | Codes valables indéfiniment jusqu'à usage/suppression | Non traité |
| 13 | Le premier build `export-source-snapshot` (20/10) a échoué : erreur de syntaxe YAML | workflow | Aucun | Corrigé |
| 14 | `__APP_VERSION__` visible en exécution hors CI | app.js | Cosmétique | Normal |

## Plateformes réellement testées
- **Chromium (Playwright), viewport téléphone 390×800**, contre émulateurs Firebase — dernier résultat enregistré
  le 14/10/2026 : scénario complet sans erreur (`errors []`).
- **Android** : APK installés et utilisés par le propriétaire (retours d'usage dans le projet) ; aucun test automatisé sur appareil.
- Tablette Android, iPhone/iPad, navigateurs desktop : **non vérifié**.
