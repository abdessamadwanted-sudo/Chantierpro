// ================= v1.0.43 — Envoi des photos vers Drive en arrière-plan (WorkManager Android), même application fermée =================
// Les photos confiées au téléphone (file BgUpload) ne sont plus envoyées par la synchro de l'application (pas de doublon) :
// le Worker Android les envoie dès qu'il y a du réseau (ou du Wi-Fi seulement), avec une notification de progression.
// À chaque ouverture / synchro, l'application relit les résultats et note l'identifiant Drive de chaque photo.
const BgUp = (() => {
  const plug = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BgUpload;
  const on = () => { try { return !!plug() && typeof Sync !== 'undefined' && Sync.direct() && Sync.hasDrive(); } catch (e) { return false; } };
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem('bg.' + k); localStorage.setItem('bg.' + k, v); } catch (e) { return null; } };
  const wifi = () => LS('wifi') === '1';
  const rootId = () => { try { return JSON.parse(localStorage.getItem('gd.root') || 'null') || ''; } catch (e) { return ''; } };
  const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); });
  let last = { pending: 0 };

  // confie des fichiers au téléphone ; renvoie le nombre confié
  async function hand(files, { onStep } = {}) {
    if (!on()) return 0;
    const L = (files || []).filter(f => f && f.blob && !f.driveId && !f.bgq && !f.prep);
    if (!L.length) return 0;
    const paths = await Sync.buildPaths(); let n = 0;
    for (const f of L) {
      try {
        const pth = Sync.pathFor(f, paths); if (!pth || !pth.segs) continue;
        await plug().enqueue({ id: f.id, name: pth.name, mime: f.mime || f.blob.type || 'image/jpeg', segs: pth.segs, data: await b64(f.blob) });
        f.bgq = JSON.stringify(pth); f.bgAt = Date.now(); await DB.putRaw('files', f); n++;
        if (onStep) onStep(n, L.length);
      } catch (e) { console.warn('bgup', e); }
    }
    if (n) await start();
    return n;
  }
  async function start() { if (!plug()) return; try { await plug().start({ wifiOnly: wifi(), rootId: rootId() }); } catch (e) { console.warn('bgup start', e); } }

  // relit les résultats du téléphone : identifiants Drive des photos envoyées, reprise par l'application en cas d'échec
  async function settle() {
    if (!plug()) return last;
    let st; try { st = await plug().status(); } catch (e) { return last; }
    const pend = new Set(st.pendingIds || []), done = st.done || [], ack = [];
    const byId = new Map(done.map(d => [d.id, d]));
    const mine = (await DB.all('files')).filter(f => f.bgq);
    for (const f of mine) {
      const d = byId.get(f.id);
      if (d) { const ok = !!d.driveId; if (ok) { f.driveId = d.driveId; f.drivePath = f.bgq; } delete f.bgq; delete f.bgAt; await (ok ? DB.put('files', f) : DB.putRaw('files', f)); }
      else if (!pend.has(f.id)) { delete f.bgq; delete f.bgAt; await DB.putRaw('files', f); }   // perdu (téléphone nettoyé…) : l'application l'enverra
    }
    for (const d of done) ack.push(d.id);
    if (ack.length) { try { await plug().ack({ ids: ack }); } catch (e) {} }
    if (pend.size) start();   // relance (ex. après une reconnexion Google)
    last = { pending: pend.size, running: !!st.running, err: st.lastError || '', sent: done.filter(d => d.driveId).length };
    return last;
  }
  // au passage en arrière-plan : les photos encore à envoyer sont confiées au téléphone
  async function handPending(skip) {
    if (!on()) return 0;
    const L = (await DB.all('files')).filter(f => f.blob && !f.driveId && !f.bgq && !f.prep && f.role === 'photo' && !(skip && skip.has(f.id)));
    return hand(L);
  }

  async function openSettings() {
    if (!plug()) return alertBox('L\'envoi en arrière-plan fonctionne dans l\'application Android installée.');
    const st = await settle();
    let notif = true; try { notif = (await plug().notifPermission({ ask: false })).granted; } catch (e) {}
    const v = await menu('Envoi en arrière-plan', [
      { label: (st.pending ? `📤 ${st.pending} photo(s) en attente${st.running ? ' · envoi en cours' : ''}` : '✓ Aucune photo en attente') + (st.err ? ` — ${st.err}` : ''), icon: 'upload', value: 'st' },
      { label: wifi() ? 'Réseau : Wi-Fi seulement (toucher pour changer)' : 'Réseau : 4G et Wi-Fi (toucher pour changer)', icon: 'globe', value: 'net' },
      { label: notif ? 'Notification de progression : activée' : 'Activer la notification de progression', icon: 'settings', value: 'notif' },
      { label: 'Batterie : ne pas bloquer SiteTeam (Huawei…)', icon: 'settings', value: 'bat' },
      ...(st.pending ? [{ label: 'Relancer l\'envoi maintenant', icon: 'undo', value: 'go' }] : []),
    ]);
    if (v === 'net') { LS('wifi', wifi() ? '0' : '1'); await start(); toast(wifi() ? 'Envoi seulement en Wi-Fi ✓' : 'Envoi avec toute connexion ✓'); }
    if (v === 'notif') { try { await plug().notifPermission({ ask: true }); } catch (e) {} }
    if (v === 'bat') { await alertBox('Sur Huawei : Paramètres › Batterie › Lancement d\'applications › SiteTeam › « Gérer manuellement » et activez les 3 options.\nSur les autres téléphones : choisissez « Ne pas optimiser » pour SiteTeam.\nSinon le téléphone peut arrêter l\'envoi quand l\'application est fermée.'); try { await plug().batterySettings(); } catch (e) {} }
    if (v === 'go') { await start(); toast('Envoi relancé ✓'); }
  }
  return { available: () => !!plug(), on, hand, handPending, settle, start, openSettings, wifi, last: () => last };
})();
