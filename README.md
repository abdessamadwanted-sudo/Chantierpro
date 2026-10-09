# Chantier — suivi de chantier (type Fieldwire)

Application Android pour le suivi de chantier, qui fonctionne **sans internet** (données stockées sur le téléphone).

## Fonctionnalités
- **Projets** : plusieurs chantiers sur le même téléphone
- **Plans** : import PDF / image, classés par dossiers (ex : 1-Poteaux+voiles, 2-Plancher)
- **Visionneuse de plan** : zoom, déplacement, et outils :
  - 📍 Pin de **tâche** (numérotée, couleur selon le statut)
  - 🔗 **Élément d'ouvrage** (point ou zone) : en touchant l'élément, une liste s'ouvre avec
    **Photos · Plan coffrage · Plan ferraillage · PV · Autre** — fichiers (photo/PDF) ou **lien Google Drive**
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
