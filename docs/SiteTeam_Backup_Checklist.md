# SiteTeam — Liste de contrôle de sauvegarde

Cocher chaque ligne. Un APK seul ne suffit pas, et la documentation ne remplace pas le code.

## A. Code source
- [ ] `SiteTeam_Source_Code.zip` téléchargé et ouvert (contient `www/`, `package.json`, `package-lock.json`, `capacitor.config.json`, `.github/`, `ci/`, `assets/`, `docs/`, `AGENTS.md`)
- [ ] Copie 1 : stockage personnel hors GitHub (Google Drive privé, disque, ordinateur)
- [ ] Copie 2 : dépôt GitHub **privé** créé (SiteTeam_GitHub_Setup.md), branche `siteteam` présente
- [ ] Dépôt public `Chantierpro` toujours en place (il sert aux téléchargements d'APK et à *Chantier*)

## B. Clé de signature (hors ZIP)
- [ ] Fichier `SiteTeam-cle-signature-PRIVE.keystore` (= `keystore/debug.keystore`) rangé dans un stockage privé
- [ ] Noté à côté : alias `androiddebugkey`, SHA-256 `E3:EC:F4:31:00:A6:6E:B4:E5:5E:F1:8A:A1:82:36:A4:37:4F:56:D0:E3:65:1E:F3:0B:62:D9:D0:58:BE:E0:24`, mots de passe = valeurs par défaut Android debug
- [ ] Compris : les clés des versions ≤ 1.0.8 sont perdues (désinstallation unique nécessaire pour passer à 1.0.9)

## C. Versions installables
- [ ] `SiteTeam-1.0.9.apk` conservé (version de référence)
- [ ] AAB de contrôle conservé (non publiable sur Google Play)

## D. Services externes — accès du propriétaire
- [ ] console.firebase.google.com : le projet **`siteteam`** apparaît avec le compte Google du propriétaire en rôle **Owner**
- [ ] Un second Owner de confiance ajouté (en cas de perte du compte)
- [ ] Authentication › e-mail/mot de passe activé ; Firestore › Règles = contenu de `docs/firebase/firestore.rules`
- [ ] Compte Google qui héberge le script Drive de l'entreprise identifié ; script ouvert sur script.google.com ; URL `/exec` notée
- [ ] Compte GitHub `abdessamadwanted-sudo` : double authentification activée, codes de secours sauvegardés
- [ ] Domaine `chantierpro.ma` : acheté ou non ? (adresse de contact provisoire dans le code)

## E. Données
- [ ] Sauvegarde `.chantier` de chaque projet important (Projet › Paramètres › Sauvegarder ce projet) — surtout avant une désinstallation
- [ ] Dossier `SiteTeam/` du Drive de l'entreprise téléchargé (ou Google Takeout)
- [ ] Export Firestore : seulement possible avec la formule Blaze (payante) — décision à prendre ; à défaut, les sauvegardes `.chantier` couvrent les projets
- [ ] Aucune donnée personnelle réelle copiée dans le dépôt ou dans le ZIP

## F. Vérification de restauration
- [ ] Sur une autre machine : `npm ci`, `npm run copy-libs`, page web ouverte localement (BUILD_INSTRUCTIONS.md §2)
- [ ] Un build APK lancé depuis le dépôt privé (onglet Actions) et signature vérifiée (`E3:EC:F4:31…`)
- [ ] Une sauvegarde `.chantier` restaurée sur un téléphone de test
