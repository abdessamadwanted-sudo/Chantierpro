// ================= SiteTeam Link Viewer (ST-LINK-001) : ouverture centralisée et sûre des liens http(s) =================
// Android / iOS : navigateur intégré du système (plugin @capacitor/browser = Chrome Custom Tab / SFSafariViewController) — l'application reste en
//   arrière-plan avec son état (projet, écran) ; retour par le bouton Retour. Aucun bouton de fermeture personnalisé n'est promis (le plugin ne le permet pas).
// Web : nouvel onglet avec noopener/noreferrer. Jamais d'iframe (CSP / X-Frame-Options des sites tiers ne sont pas contournés).
// L'authentification Google Drive (plugin natif GDriveAuth) n'est PAS concernée : aucun flux OAuth ne passe par ici.
// Ancienne version de l'APK sans le plugin : repli sur l'ouverture dans le navigateur externe (comportement d'avant).
const LinkViewer = (() => {
  // applications natives : ces liens s'ouvrent dans leur application, pas dans le navigateur intégré
  // Google Drive / Docs / Sheets : l'application Drive du téléphone (vue complète des dossiers et des fichiers) s'ouvre à la place du navigateur intégré
  const EXTERNAL_HOSTS = /^(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|t\.me|play\.google\.com|market\.android\.com|drive\.google\.com|docs\.google\.com)$/i;
  // téléchargements (mise à jour APK…) : toujours par le navigateur du téléphone, qui sait les installer
  const DOWNLOAD = /\.(apk|aab|zip)(\?|#|$)/i;
  const SECRET_PARAMS = ['access_token', 'id_token', 'refresh_token', 'token', 'idtoken', 'password', 'pw'];
  const native = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const plugin = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
  // renvoie l'URL nettoyée, ou null si le lien est refusé (schéma non autorisé, identifiants ou jeton dans l'adresse)
  function check(raw) {
    let s = String(raw == null ? '' : raw).trim();
    if (!s || /^(javascript|data|file|blob|vbscript|about|content|intent):/i.test(s)) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
    let u; try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password) return null;
    for (const k of u.searchParams.keys()) if (SECRET_PARAMS.includes(k.toLowerCase())) return null;
    return u.href;
  }
  let last = { url: '', at: 0 };
  function openExternal(raw) {
    const url = check(raw); if (!url) { try { toast('Lien non autorisé'); } catch (e) {} return { ok: false, mode: 'refused' }; }
    if (native()) window.location.href = url;   // Capacitor remet le lien au navigateur du téléphone
    else { const w = window.open(url, '_blank', 'noopener,noreferrer'); if (!w) { try { toast('Ouverture bloquée par le navigateur'); } catch (e) {} return { ok: false, mode: 'blocked' }; } }
    return { ok: true, mode: 'external' };
  }
  async function openLink(raw, options = {}) {
    const url = check(raw); if (!url) { try { toast('Lien non autorisé'); } catch (e) {} return { ok: false, mode: 'refused' }; }
    const now = Date.now(); if (url === last.url && now - last.at < 700) return { ok: true, mode: 'ignored' };   // double toucher : une seule ouverture
    last = { url, at: now };
    const U = new URL(url);
    if (options.external || EXTERNAL_HOSTS.test(U.hostname) || DOWNLOAD.test(U.pathname)) return openExternal(url);
    if (native()) {
      const P = plugin();
      if (P && P.open) { try { await P.open({ url, presentationStyle: 'popover' }); return { ok: true, mode: 'inapp' }; } catch (e) { console.warn('link-viewer', e); } }
      return openExternal(url);   // plugin absent (ancien APK) ou erreur : navigateur externe
    }
    return openExternal(url);
  }
  // iOS seulement : Android ne sait pas fermer l'onglet par programme (le retour se fait par le bouton Retour)
  async function closeLink() { try { const P = plugin(); if (native() && P && P.close) await P.close(); } catch (e) {} }
  const isExternal = (raw) => { const u = check(raw); if (!u) return false; const U = new URL(u); return EXTERNAL_HOSTS.test(U.hostname) || DOWNLOAD.test(U.pathname); };
  return { openLink, closeLink, openExternal, check, isExternal };
})();
window.LinkViewer = LinkViewer;
