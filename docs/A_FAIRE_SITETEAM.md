# SiteTeam — travaux demandés par le propriétaire, pas encore faits (au 28/10/2026)

Lire d'abord `AGENTS.md`. Une branche `agent/<sujet>` par sujet, Pull Request vers `siteteam`, tests verts, fins de ligne LF (voir `.gitattributes`).

## 1. PV de réception « intelligents » par service et par ouvrage
- PV adaptés au métier : Qualité (réception ferraillage), Topo (PV d'implantation), Labo (PV d'essai), etc.
- Check-lists par type d'ouvrage : ferraillage (diamètres, espacements, enrobage, recouvrements, cales), coffrage (aplomb, étanchéité, huile de décoffrage, étaiement), bétonnage (classe, slump, éprouvettes, vibration, cure).
- Point d'entrée : `www/js/reception.js`, `www/js/pvsmart.js`, `www/js/fiches.js`. Bibliothèque par service : `SVC_LIB` dans `www/js/team.js`.

## 3. Ouverture plus rapide
- Mesure déjà en place : menu Réglages › « ⏱ Dernier démarrage » (fichiers · connexion · accueil). Attendre le chiffre du propriétaire.
- Pistes : bundle minifié au build (`.github/workflows/build-siteteam.yml`), chargement à la demande des modules lourds (dwg.js, m3d.js, poutre3d.js, viewer.js), accueil rendu depuis le cache avant `Team.boot()`.

## 5. Organisation des dossiers Drive
- Écran « Organisation des dossiers Drive » : renommer, réordonner, regrouper (mois / jour / niveau / lot), masquer les dossiers du projet.
- Les noms sont dans `const D = {…}` de `www/js/sync.js` (chemins calculés par `buildPaths`). Changer un chemin DÉPLACE le fichier dans Drive (pas de doublon) — garder ce principe.

## 6. Photos en masse + envoi en arrière-plan
- Partout (ligne de réception, ouvrage, réserve, rapport) : choisir plusieurs photos d'un coup, qualité d'origine (option), bouton « Envoyer » non bloquant, compteur « 12/30 envoyées ».
- File d'attente persistante (IndexedDB) : reprise automatique au retour du réseau ou à la réouverture ; option « Wi-Fi seulement ».
- Classement automatique dans Drive selon l'endroit où la photo est rattachée (projet › rubrique › mois › jour › ouvrage).
- Phase 2 (plus tard, sur accord) : plugin natif Android WorkManager pour continuer l'envoi application fermée, avec notification de progression ; prévoir l'exception « économiseur de batterie » (Huawei, Xiaomi).

## Fait dans v1.0.38 (pour mémoire)
- Barre du bas à 4 onglets (Accueil · Projets · Équipe · Réglages) ; chaque projet s'ouvre sur « Outils du projet » (section `ptools`).
- Onglet Réglages = menu ⋮ complet. Message clair si la connexion Google Drive n'aboutit pas. `.gitattributes` (LF).
- Nettoyage restant : le panneau `sec('tools', …)` de `renderHome` n'est plus atteignable par la barre ; il sert encore à d'anciens tests (`ci/st.mjs`) — à retirer quand ces tests seront réécrits.
