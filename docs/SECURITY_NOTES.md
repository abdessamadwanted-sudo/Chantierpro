# SECURITY_NOTES — SiteTeam

## Ce qui est exclu des exports (ZIP)
`keystore/` (clé privée de signature), tout `*.keystore` / `*.jks`, `.env`, `node_modules/`, caches de build,
APK/AAB, résultats de tests (`ci-out/`). Aucune donnée utilisateur réelle n'est exportée (elles sont dans
Firestore/Drive, hors du dépôt).

## Constats

1. **Dépôt GitHub public.** Tout le code, la configuration Firebase client et `keystore/debug.keystore`
   sont lisibles par tous. Rendre le dépôt privé casserait cependant :
   - les liens de téléchargement d'APK (`apkLink()` dans team.js, invitations WhatsApp) ;
   - les mises à jour automatiques de l'app *Chantier* (branche `main`, fichiers `ota.json`/`www.zip` en release publique) ;
   - GitHub Pages de *Chantier* (Pages privé = offre payante).
   → Recommandation : **dupliquer** dans un dépôt privé de sauvegarde (voir SiteTeam_GitHub_Setup.md) et
   décider plus tard d'une distribution séparée (Google Play, stockage d'APK).

2. **Clé de signature publique.** `keystore/debug.keystore` (mots de passe par défaut Android) est dans le dépôt
   public : elle assure la continuité des mises à jour par APK mais **pas l'authenticité** (n'importe qui peut
   signer un APK `com.siteteam.app` avec). Elle ne doit pas servir pour Google Play. La clé de publication
   future devra rester privée (secrets GitHub, sauvegarde hors ligne).

3. **Configuration Firebase client** (`FB_CONFIG`) : publique par conception. Recommandé (non fait) :
   restreindre la clé d'API dans Google Cloud Console (applications/domaines autorisés) et activer
   **Firebase App Check**.

4. **Règles Firestore** : seul rempart des données partagées. Elles sont dans le code (`FIRESTORE_RULES`) et
   doivent être **publiées à la main** ; rien ne garantit que la version en production soit la même (non vérifié).
   Points d'attention :
   - `invites/{code}` et `shares/{code}` : lecture (`get`) par tout utilisateur connecté qui connaît le code
     (8 caractères parmi 31 → ~8,5×10¹¹ combinaisons) ; pas d'expiration ;
   - `shares` : le destinataire peut réécrire tout le tableau `responses` (pas seulement ajouter) ;
   - pas de validation de schéma (types, tailles) sur les enregistrements `m/{mod}/r/*` ;
   - un admin peut tout modifier dans son entreprise (attendu).

5. **Script Google Drive** : déployé « accès : tout le monde », protégé par une **clé partagée** envoyée dans le corps
   des requêtes. La clé est stockée dans `companies/{cid}/private/drive`, lisible par **tous les membres** :
   un membre (même au niveau « voir ») peut donc appeler le script directement et lire/écrire/mettre à la
   corbeille des fichiers du Drive de l'entreprise, au-delà de ses droits dans l'app. Changer la clé = redéployer
   le script et reconnecter.

6. **Droits côté client** : l'interface masque des écrans selon `Team.lvl()` ; seul le serveur (règles)
   protège réellement les données Firestore. Les fichiers Drive ne sont protégés que par la clé (point 5).

7. **Données personnelles** : e-mails, noms, photos de chantier. Aucune politique de confidentialité ni procédure
   de suppression de compte n'existe dans l'app (requises par Google Play).

8. **`android:allowBackup="true"`** : la sauvegarde Android peut copier les données locales de l'app (modèle par défaut).

## À ne jamais faire
- Commiter une clé de publication, un mot de passe, un `google-services.json` lié à une clé admin, un compte de service.
- Remplacer `keystore/debug.keystore` par une autre clé : les téléphones refuseraient les mises à jour.
- Assouplir les règles Firestore pour « débloquer » un écran.
