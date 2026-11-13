# SiteTeam Link Viewer (ST-LINK-001)

Module : `www/js/link-viewer.js` (global `LinkViewer`). Branche `agent/st-link-001`.

## Rôle
Ouvrir les liens **http(s)** depuis SiteTeam sans obliger l'utilisateur à « quitter » l'application, de façon centralisée et vérifiée.
Ce n'est pas un navigateur : c'est le navigateur intégré du système.

## API
- `LinkViewer.openLink(url, { external })` → `{ ok, mode }` avec `mode` = `inapp` · `external` · `refused` · `blocked` · `ignored`.
- `LinkViewer.openExternal(url)` : force le navigateur externe.
- `LinkViewer.closeLink()` : ferme le navigateur intégré (iOS seulement ; sans effet sur Android).
- `LinkViewer.check(url)` : renvoie l'URL nettoyée ou `null` si refusée.
- `openUrl(url)` (ui.js) reste le point d'entrée historique : les liens http(s) passent par `LinkViewer`, `mailto:` `tel:` `sms:` `whatsapp:` `geo:` restent ouverts par le système.

## Comportement par plateforme
| Plateforme | Comportement |
|---|---|
| Android | `@capacitor/browser` (Chrome Custom Tab) : l'application reste en arrière-plan avec son état ; retour par le bouton Retour. Pas de bouton de fermeture personnalisé. |
| iOS | `@capacitor/browser` (SFSafariViewController). **Non testé** (pas d'environnement iOS). |
| Web | nouvel onglet `noopener,noreferrer`. Pas d'iframe : CSP / X-Frame-Options des sites tiers ne sont pas contournés. |
| Ancien APK (sans le plugin) | repli sur l'ouverture dans le navigateur externe (comportement d'avant). |

## Sécurité
- Refusés : `javascript:` `data:` `file:` `blob:` `vbscript:` `about:` `content:` `intent:` et tout schéma autre que http/https.
- Refusés : adresses avec identifiants (`user:pass@`) ou paramètres sensibles (`access_token`, `id_token`, `refresh_token`, `token`, `password`…).
- Aucun script injecté dans les pages externes ; la page externe n'est pas un espace de confiance.
- Ouverts **hors** navigateur intégré : **Google Drive / Docs / Sheets** (`drive.google.com`, `docs.google.com` → application Drive du téléphone, vue complète des dossiers), WhatsApp (`wa.me`…), Telegram, Play Store, et les téléchargements `.apk` `.aab` `.zip` (mise à jour de l'application).
- Un double toucher sur le même lien (< 0,7 s) ne provoque qu'une ouverture.

## Google Drive
Inchangé. L'authentification utilise le plugin natif `GDriveAuth` (aucun flux OAuth ne passe par `openUrl`). Les liens Drive (fichier, dossier, PDF) s'ouvrent dans le navigateur intégré, qui partage la session Google du navigateur du téléphone. Synchronisation, restauration et mode hors ligne ne sont pas modifiés.

## Packs
Disponible dans tous les packs (Basic, Pro, Business, Enterprise) : capacité technique commune, sans flag.

## Dépendance native
`@capacitor/browser ^6.0.0` ajouté à `package.json`. Il faut **un nouvel APK** pour que le plugin existe sur les téléphones : une mise à jour OTA (web seulement) fonctionne sur un ancien APK grâce au repli.

## Limites
- Testé en CI : navigateur Chromium (Playwright) avec le plugin simulé. **Non testé** sur Android 10 réel (Huawei VOG-L29) ni sur iOS.
- Android peut fermer l'application en arrière-plan si la mémoire est basse pendant la consultation d'un lien (comportement du système).
- Certains liens (Google Maps) peuvent proposer d'ouvrir l'application Maps ; ce choix appartient au système.
- `package-lock.json` n'a pas été régénéré (pas d'accès réseau) : le build utilise `npm install`, qui le met à jour.
