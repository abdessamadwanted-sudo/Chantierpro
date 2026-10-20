# Chantier — suivi de chantier (type Fieldwire)

Application Android pour le suivi de chantier, qui fonctionne **sans internet** (données stockées sur le téléphone).

## Fonctionnalités
- **Projets** : plusieurs chantiers sur le même téléphone
- **Plans** : import PDF / image, classés par dossiers (ex : 1-Poteaux+voiles, 2-Plancher)
- **Visionneuse de plan** : zoom, déplacement, et outils :
  - 📍 Pin de **tâche** (numérotée, couleur selon le statut)
  - 🔗 **Pin élément** (pin ou zone) posé sur la vue en plan : en le touchant, une liste s'ouvre avec
    **Plan coffrage · Plan ferraillage · Coupe · PV · Photos · Notes · Autre** — chaque rubrique se lie à un **plan du projet**, une image/PDF ou un **lien Google Drive**
  - ✏️ Crayon, formes (nuage, rectangle, cercle, flèche, ligne), texte, couleurs, gomme, annuler
  - 👁 Filtres (tâches / éléments / annotations)
- **Tâches** : statut (Ouvert, En cours, Terminé, Vérifié), priorité, responsable, échéance, photos, commentaires
- **Photos** : galerie de toutes les photos du chantier
- **Formulaires QC** : réception ferraillage, coffrage, bétonnage, maçonnerie, étanchéité
- **Rapports journaliers** : météo, effectif, travaux, livraisons, problèmes, photos
- Partage **WhatsApp** des tâches, formulaires et rapports

## Télécharger l'APK
Onglet **Releases** → dernière version → `Chantier.apk`.

Chaque `push` sur `main` reconstruit l'APK automatiquement (GitHub Actions).

## Préparer une version Google Play
Le workflow **Build Play Store AAB** construit un bundle Android signé (`Chantier-play.aab`) sur demande, séparément du workflow APK existant. Il ne publie rien automatiquement sur Google Play. La version Play désactive les mises à jour APK/OTA hors Play Store et n'ajoute pas la permission `REQUEST_INSTALL_PACKAGES`.

**Attention avant toute diffusion Play :** les APK actuels sont signés avec `keystore/debug.keystore`, qui est déjà présent dans le dépôt et ne doit pas servir de clé de signature de production. La clé de signature de Play sera différente ; une installation existante peut donc ne pas pouvoir être mise à jour directement et une désinstallation peut effacer les données locales. Décidez d'abord d'une migration et demandez aux utilisateurs de sauvegarder leurs projets (par exemple avec la sauvegarde de l'application ou Google Drive). Ne publiez pas la version Play avant d'avoir testé ce parcours de migration.

Avant le premier lancement, créez une clé d'upload dédiée sur un ordinateur de confiance et gardez une copie protégée du fichier et des mots de passe :

```bash
keytool -genkeypair -v -keystore play-upload-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias chantier-upload
base64 -w0 play-upload-key.jks
```

Dans **Settings → Secrets and variables → Actions** du dépôt GitHub, ajoutez les secrets `PLAY_UPLOAD_KEYSTORE_BASE64` (la sortie base64), `PLAY_UPLOAD_STORE_PASSWORD`, `PLAY_UPLOAD_KEY_ALIAS` (par exemple `chantier-upload`) et `PLAY_UPLOAD_KEY_PASSWORD`. Ne commitez pas le keystore et ne partagez pas ses mots de passe.

Ensuite, lancez **Actions → Build Play Store AAB → Run workflow**, entrez une version au format `1.0.0`, téléchargez l'artefact et importez-le manuellement dans une piste de test de Google Play Console. Le premier lancement sur un compte personnel récent peut nécessiter un test fermé avec 12 testeurs pendant 14 jours. Vérifiez avant le lancement que `ma.chantier.app` est bien l'identifiant souhaité, et préparez la politique de confidentialité ainsi que les déclarations exactes sur les données collectées.
