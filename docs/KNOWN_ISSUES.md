# KNOWN_ISSUES — SiteTeam

## Phase 2b (équipes projet)

Publier les règles Firestore ET Storage avant de définir la première équipe nominative. Un appareil hors ligne utilise la dernière politique reçue ; un retrait prend effet côté serveur immédiatement et côté interface à la prochaine synchronisation. La définition d'une équipe exige une connexion.

Constatés en lisant le code et les builds (octobre 2026). « Non vérifié » = soupçonné, non reproduit.

| # | Problème | Où | Impact | Statut |
|---|---|---|---|---|
| 1 | **Signatures différentes jusqu'à v1.0.8** : chaque APK signé par une clé debug aléatoire (perdue) | build-siteteam.yml (avant le 23/10/2026) | Impossible d'installer une mise à jour par-dessus une version ≤ 1.0.8 : désinstallation obligatoire une fois | **Corrigé** à partir de v1.0.9 (clé fixe + vérification d'empreinte) |
| 2 | Connexion IndexedDB unique jamais rouverte : erreur « database connection is closing » pendant une longue synchro | www/js/db.js | Synchro bloquée jusqu'au redémarrage de l'app | **Corrigé** en v1.0.11 : réouverture + 3 essais, attente de fin de transaction ; testé (ci/db-test.mjs) |
| 3 | Partage externe : la règle Firestore autorise le destinataire à réécrire **tout** le tableau `responses` | règles `shares/{code}` | Un destinataire pourrait effacer l'historique des réponses | **Corrigé** (ajout seulement), testé — effectif après publication des règles |
| 4 | Partage externe : le destinataire ne voit **aucun document** du projet, seulement la description | team.js | Fonction limitée à un journal d'échanges | Limite connue (v1) |
| 5 | Requête `shares where cid == and pid ==` sans index déclaré | team.js `projectShares` | Possible erreur « index requis » | **Non vérifié** en production |
| 6 | Formules (Basic/Pro…) affichées sans aucune limite appliquée | team.js `PLANS` | Quotas non respectés | Simulé |
| 7 | `targetSdk` 34 < API 36 exigée par Google Play (depuis le 31/08/2026) | projet Android généré (Capacitor 6) | Publication Play impossible | Non traité |
| 8 | Pas de suppression de compte | team.js | Exigence Google Play | **Corrigé** dans l'app (Mon compte › Supprimer mon compte), testé E2E ; page web de suppression encore à faire |
| 9 | Module « Emploi & carrière » présent dans le dépôt mais **non chargé** par index.html | career.js | Code mort | Non traité |
| 10 | `pages.yml` déclenché sur une branche inexistante | .github/workflows | Pas de version web publiée pour SiteTeam | Volontaire (à décider) |
| 11 | Avant connexion, `Team.lvl()` renvoie 4 (tout autorisé côté interface) | team.js | Affichage seulement ; le serveur refuse | Mineur |
| 12 | Invitations et partages sans date d'expiration automatique | team.js | Codes valables indéfiniment jusqu'à usage/suppression | Non traité |
| 13 | Le premier build `export-source-snapshot` (20/10) a échoué : erreur de syntaxe YAML | workflow | Aucun | Corrigé |
| 14 | `__APP_VERSION__` visible en exécution hors CI | app.js | Cosmétique | Normal |
| 15 | **Projet Firebase partagé avec l'app Chantier** (collections `licences`, `suivi`) : les anciennes règles SiteTeam auraient bloqué les codes CH | règles Firestore | Codes CH refusés si publiées | **Corrigé** : règles unifiées testées (ci/rules-test.mjs, 29 vérifications) — **à publier par le propriétaire** |
| 16 | Le repère de réception Firestore avançait même si l'enregistrement local échouait | team.js `pull`, sync.js | Données reçues perdues | **Corrigé** v1.0.11 |
| 17 | Les tags `siteteam-v*` pointaient vers un commit de `main` | build-siteteam.yml | Traçabilité | **Corrigé** (`target_commitish`) |
| 18 | Réserve sans priorité affichée « Pundefined » | app.js (liste des réserves) | Cosmétique | Non traité |
| 19 | Outils repris de Chantier (v1.0.12) : beaucoup de données (avancement, finance, registres, rubriques…) sont dans la fiche projet ; Firestore limite un document à 1 Mo | sync Firestore (`projects`) | Un très gros projet pourrait ne plus se synchroniser | À surveiller — découpage prévu |
| 20 | Rubriques Financier / TCE / avenants / sous-traitants : masquées selon le module « finance », mais leurs données sont dans la fiche projet (lisible par tout membre du projet côté serveur) | team.js, règles | Protection d'affichage seulement | À traiter avec les interfaces par service |
| 21 | Mise à jour depuis l'app : nécessite que le dépôt GitHub reste public (téléchargement des releases) | modules.js | — | Connu |
| 22 | Verrou par service autonome (v1.0.3xx) : ne vaut que si `config/plans.pro.open` reste **faux** dans Super Admin › Réglages › « Packs ouverts au public » (le propriétaire teste toujours en Super Admin, qui contourne tout ; un vrai utilisateur ne voit l'effet que si Pro est bien fermé) | admin.js (ctrl), team.js (planOpen) | Si Pro est resté ouvert, le verrou par service n'a aucun effet pour les vrais utilisateurs | **À vérifier par le propriétaire** après fusion |
| 23 | Verrou par service autonome (v1.0.3xx) : `codePlanOk` (FIRESTORE_RULES) a changé — **règles non publiées automatiquement** | team.js (FIRESTORE_RULES) | Sans publication, l'ancien comportement (pas de verrou par service côté serveur) reste actif malgré le nouveau code client | **À publier par le propriétaire** dans la console Firebase après fusion |
| 24 | **Corrigé** — ثغرة « ＋ Nouveau service autonome » (Mes espaces) : `Team.createService` était appelable directement (UI et règle Firestore) par n'importe quel compte, créant gratuitement n'importe quel service du catalogue payant | mesespaces.js, team.js (`obtainAutonomeSvc`, FIRESTORE_RULES `companies.create`) | Contournement complet du verrou par service (issue 22/23 ci-dessus) | **Corrigé** côté client (`Team.obtainAutonomeSvc`) et côté serveur (règle `companies.create`) — **règles à republier par le propriétaire** après fusion (même publication que les issues 22/23) |
| 25 | Point 17 : la suspension/réactivation d'une Entreprise (`admin.js`, Statut) agit sur l'Entreprise entière, pas service par service | admin.js (`orgCard`), team.js (modèle `svcKeys`) | Suspendre une Entreprise coupe l'accès à TOUS ses services débloqués à la fois — pas de suspension indépendante d'un seul service à l'intérieur d'une même Entreprise | Limite connue de cette version, à signaler au propriétaire ; non construit |
| 26 | Point 17 : aucun parcours de bout en bout (`ci/st.mjs`) pour la nouvelle Entreprise (onboarding, catalogue « Ajouter », présentation, demande/code) | ci/st.mjs | Seules les règles Firestore sont testées automatiquement (`ci/rules-test.mjs`) ; le parcours dans l'app n'est couvert que par vérification manuelle | **Corrigé** — parcours ajouté (section L/M, `ci/st.mjs`) |
| 27 | « Mon abonnement » (Organisation) demande explicitement du propriétaire (21/11/2026) : voir le pack actuel et demander/activer un pack supérieur (Business, Enterprise) depuis l'application, pas seulement par code pack ou panneau d'administration | www/js/team.js (`openCompany`, onglet `abo`), admin.js (`reqs`) | Réservé aux Organisations « réelles » (`kind` « org », assistant stepOrg/stepSvcs) — volontairement absent pour une Entreprise « Pro Service autonome » (`kind` « entreprise », point 17), dont le modèle (un service débloqué à la fois) n'a pas de pack global unique à faire monter de gamme | Testé (`ci/st.mjs`, section « Mon abonnement (organisation) ») |
| 28 | Business/Enterprise restent fermés au public par défaut (`config/plans.<pack>.open`) même après le 27 ci-dessus | config/plans (Firestore) | Une Organisation ne peut demander Business/Enterprise que si le propriétaire les a ouverts (Contrôle de l'application) | Comportement voulu, pas un bug — à ouvrir par le propriétaire quand il le décide |
| 29 | OPC (Ordonnancement, Pilotage, Coordination) n'existait qu'en tant que *service* à l'intérieur d'une Entreprise (point 17, `aut_15`), pas comme organisme à part entière | www/js/team.js (`ORG_TYPES`, `TM_ROLES`, `SHARE_ENTITIES`, `PARTNER_SVC_AUTO`) | Une organisation OPC ne pouvait pas se créer comme type (comme BET/Architecte/MOA/Bureau de contrôle), ni être invitée sur un projet avec ce rôle précis | **Corrigé** — ajout additif (aucun type/rôle existant modifié), testé (`ci/st.mjs`, log « OPC proposé ») |

## Plateformes réellement testées
- **Chromium (Playwright), viewport téléphone 390×800**, contre émulateurs Firebase — dernier résultat enregistré
  le 14/10/2026 : scénario complet sans erreur (`errors []`).
- **Android** : APK installés et utilisés par le propriétaire (retours d'usage dans le projet) ; aucun test automatisé sur appareil.
- Tablette Android, iPhone/iPad, navigateurs desktop : **non vérifié**.
