// ================= Écran d'ouverture animé : logo qui se dessine + message tapé au clavier (style terminal) =================
const Splash = (() => {
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  // réglages : animation et son selon l'heure (matin / soir), le reste de la journée sans son ou désactivé
  const SCHED_DEF = { mode: 'always', sound: true, m: { from: '06:00', to: '10:00', sound: true }, e: { from: '18:00', to: '23:30', sound: true }, rest: 'silent', brief: true };
  const sched = () => { try { return { ...SCHED_DEF, ...JSON.parse(LS('splash.sched') || '{}') }; } catch (e) { return { ...SCHED_DEF }; } };
  const inWin = (w) => { const n = new Date(), m = n.getHours() * 60 + n.getMinutes(), t = (x) => { const [h, mm] = String(x || '0:0').split(':').map(Number); return h * 60 + (mm || 0); }; const a = t(w.from), b = t(w.to); return a <= b ? m >= a && m <= b : m >= a || m <= b; };
  const now = () => { const S = sched(); if (LS('splash.off') === '1' && !LS('splash.sched')) return { anim: false, sound: false };
    if (S.mode === 'off') return { anim: false, sound: false };
    if (S.mode !== 'time') return { anim: true, sound: S.sound !== false && LS('splash.sound') !== '0' };
    if (inWin(S.m)) return { anim: true, sound: !!S.m.sound }; if (inWin(S.e)) return { anim: true, sound: !!S.e.sound };
    return S.rest === 'off' ? { anim: false, sound: false } : { anim: true, sound: false }; };
  const on = () => now().anim;
  let forceSound = null;
  const soundOn = () => forceSound != null ? forceSound : now().sound;
  let ac = null;
  function click() {
    if (!soundOn()) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime, len = 0.03, buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 1400; g.gain.value = 0.22;
      src.connect(f); f.connect(g); g.connect(ac.destination); src.start(t);
    } catch (e) {}
  }
  async function lines() {
    const h = new Date().getHours(), hello = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
    const name = LS('userName') || '';
    const out = [`> ${hello}${name ? ', ' + name : ''}`];
    try {
      const ps = (await DB.all('projects')).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      if (ps[0]) {
        out.push(`> Chargement du chantier : ${ps[0].name}…`);
        const recs = await DB.byProject('receptions', ps[0].id), t = todayISO();
        const n = recs.filter(d => d.date === t).reduce((a, d) => a + (d.rows || []).filter(r => r.element).length, 0);
        out.push(n ? `✓ ${n} ouvrage(s) au programme aujourd'hui` : '✓ Prêt');
      } else out.push('> Initialisation…', '✓ Prêt');
    } catch (e) { out.push('✓ Prêt'); }
    return out;
  }
  function show(force) {
    if ((!on() && !force) || document.querySelector('.splash')) return Promise.resolve();
    return new Promise(async (resolve) => {
      const el = document.createElement('div'); el.className = 'splash';
      el.innerHTML = `<div class="sp-intro"><div class="sp-logo">
          <svg viewBox="0 0 120 120" class="sp-svg">
            <circle class="sp-ring" cx="60" cy="60" r="52" pathLength="1"/>
            <circle class="sp-ring2" cx="60" cy="60" r="44" pathLength="1"/>
            <path class="sp-hat" pathLength="1" d="M26 80h68M32 80v-10a28 28 0 0 1 56 0v10M52 44v-9h16v9M60 35v45"/>
          </svg>
          <div class="sp-glow"></div>
        </div>
        <div class="sp-name">${'CHANTIER'.split('').map((c, i) => `<span style="animation-delay:${0.9 + i * 0.06}s">${c}</span>`).join('')}</div>
        <pre class="sp-term"></pre></div><small class="sp-skip">Touchez pour passer</small>`;
      document.body.appendChild(el);
      let done = false;
      const finish = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => { el.remove(); resolve(); }, 450); };
      el.onclick = finish;
      const L = await lines(), term = $('.sp-term', el);
      await new Promise(r => setTimeout(r, 1150));
      for (const line of L) {
        if (done) return;
        const row = document.createElement('div'); row.className = line.startsWith('✓') ? 'ok' : ''; term.appendChild(row);
        for (let i = 0; i < line.length; i++) {
          if (done) return;
          row.textContent = line.slice(0, i + 1); if (line[i] !== ' ') click();
          await new Promise(r => setTimeout(r, (line[i] === ' ' ? 16 : 26) + Math.random() * 20));
        }
        await new Promise(r => setTimeout(r, 220));
      }
      if (done) return;
      // la devise apparaît sous le texte, puis on entre tout seul
      $('.sp-intro', el).insertAdjacentHTML('beforeend', `<div class="sp-motto"><b>QUALITÉ</b><i>◆</i><b>SÉCURITÉ</b><i>◆</i><b>DÉLAIS</b><u></u></div>`);
      setTimeout(finish, 1900);
    });
  }
  const hello = () => { const h = new Date().getHours(); return h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'; };
  const LOGO = `<svg viewBox="0 0 120 120" class="sp-svg"><circle class="sp-ring" cx="60" cy="60" r="52" pathLength="1"/><circle class="sp-ring2" cx="60" cy="60" r="44" pathLength="1"/><path class="sp-hat" pathLength="1" d="M26 80h68M32 80v-10a28 28 0 0 1 56 0v10M52 44v-9h16v9M60 35v45"/></svg>`;
  // écran d'accueil : bouton vert en verre (3D) pour entrer
  function welcome() {
    return new Promise((resolve) => {
      const name = LS('userName') || '', d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      const el = document.createElement('div'); el.className = 'splash wel';
      el.innerHTML = `<div class="wl-blob a"></div><div class="wl-blob b"></div>
        <div class="wl-top"><b>CHANTIER</b><span>${esc(hello())}${name ? ', ' + esc(name) : ''}</span><small>${esc(d.charAt(0).toUpperCase() + d.slice(1))}</small></div>
        <div class="wl-power"><span class="wl-ring r1"></span><span class="wl-ring r2"></span><button class="wl-pbtn" aria-label="Entrer">${icon('power')}</button></div>
        <small class="wl-hint">Touchez pour démarrer</small>`;
      document.body.appendChild(el);
      const b = $('.wl-pbtn', el);
      b.onclick = () => { if (b.classList.contains('go')) return; b.classList.add('go'); el.classList.add('lit'); powerSound(); try { navigator.vibrate && navigator.vibrate([12, 40, 18]); } catch (e) {}
        setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); resolve(); }, 420); }, 650); };
    });
  }
  function powerSound() {
    if (!soundOn()) return;
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(660, t + .35); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.2, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + .55); } catch (e) {}
  }
  async function boot() {
    try { if (typeof AppLock !== 'undefined' && AppLock.get() && typeof lockScreen === 'function') await lockScreen(); } catch (e) { console.warn(e); }
    try { if (typeof orgOnboard === 'function') { Org.apply(); await orgOnboard(); } } catch (e) { console.warn(e); }
    const S = sched(), anim = on();
    if (!anim && !S.brief) return;
    await welcome();
    let act = null;
    if (S.brief && typeof briefingShow === 'function') { try { act = await briefingShow(); } catch (e) { console.warn('brief', e); } }
    if (act) { setTimeout(() => { try { act(); } catch (e) { console.warn(e); } }, 250); return; }
    if (anim) await show();
  }
  // au revoir léger : une ligne tapée, puis l'application se ferme
  function bye() {
    if (document.querySelector('.splash')) return;
    const name = LS('userName') || '';
    try { if (typeof Sync !== 'undefined' && Sync.enabled()) Sync.run({ quiet: true }).catch(() => {}); } catch (e) {}
    const el = document.createElement('div'); el.className = 'splash bye';
    el.innerHTML = `<div class="by-in"><div class="by-pw">${icon('power')}</div><div class="by-t"></div><small class="by-s">À demain sur le chantier</small></div>`;
    document.body.appendChild(el);
    const quit = () => { const A = window.Capacitor?.Plugins?.App; if (A && A.exitApp) A.exitApp(); else { el.classList.add('out'); setTimeout(() => el.remove(), 400); } };
    let done = false; el.onclick = () => { if (!done) { done = true; quit(); } };
    (async () => {
      const line = `Au revoir${name ? ', ' + name : ''} 👋`, t = $('.by-t', el); await new Promise(r => setTimeout(r, 350));
      for (let i = 0; i <= line.length; i++) { if (done) return; t.textContent = line.slice(0, i); await new Promise(r => setTimeout(r, 34)); }
      el.classList.add('fin'); setTimeout(() => { if (!done) { done = true; quit(); } }, 1300);
    })();
  }
  // réglages de l'écran d'ouverture (heures, son, briefing)
  function settings() {
    const S = sched();
    const s = sheet(`<div class="sp-set">
      <div class="ss-r"><span>Animation</span><div class="seg" data-g="mode"><button data-v="always">Toujours</button><button data-v="time">Selon l'heure</button><button data-v="off">Désactivée</button></div></div>
      <div class="ss-t" data-show="always"><label class="ss-c"><input type="checkbox" data-k="sound" ${S.sound !== false ? 'checked' : ''}> Son du clavier</label></div>
      <div class="ss-t" data-show="time">
        <div class="ss-w">🌅 <b>Matin</b><input type="time" data-k="m.from" value="${S.m.from}"> → <input type="time" data-k="m.to" value="${S.m.to}"><label class="ss-c"><input type="checkbox" data-k="m.sound" ${S.m.sound ? 'checked' : ''}> son</label></div>
        <div class="ss-w">🌙 <b>Soir</b><input type="time" data-k="e.from" value="${S.e.from}"> → <input type="time" data-k="e.to" value="${S.e.to}"><label class="ss-c"><input type="checkbox" data-k="e.sound" ${S.e.sound ? 'checked' : ''}> son</label></div>
        <div class="ss-r"><span>Le reste de la journée</span><div class="seg" data-g="rest"><button data-v="silent">Sans son</button><button data-v="off">Désactivée</button></div></div>
      </div>
      <label class="ss-c big"><input type="checkbox" data-k="brief" ${S.brief ? 'checked' : ''}> Briefing du jour au démarrage (notes, rappels, PV, tâches…)</label>
      <div class="btnrow" style="padding:0;margin-top:10px"><button class="btn ghost" data-a="see">▶ Voir l'animation</button><button class="btn" data-a="ok">Enregistrer</button></div></div>`, { title: 'Écran d\'ouverture' });
    const st = { mode: S.mode, rest: S.rest };
    const sync = () => { $$('[data-g]', s.el).forEach(g => $$('button', g).forEach(b => b.classList.toggle('on', b.dataset.v === st[g.dataset.g]))); $$('[data-show]', s.el).forEach(x => x.style.display = x.dataset.show === st.mode ? '' : 'none'); };
    $$('[data-g] button', s.el).forEach(b => b.onclick = () => { st[b.parentElement.dataset.g] = b.dataset.v; sync(); });
    const read = () => { const o = { ...S, m: { ...S.m }, e: { ...S.e }, mode: st.mode, rest: st.rest }; $$('[data-k]', s.el).forEach(i => { const [a, b] = i.dataset.k.split('.'), v = i.type === 'checkbox' ? i.checked : i.value; if (b) o[a][b] = v; else o[a] = v; }); return o; };
    $('[data-a=ok]', s.el).onclick = () => { LS('splash.sched', JSON.stringify(read())); LS('splash.off', '0'); s.close(); toast('Écran d\'ouverture enregistré ✓'); };
    $('[data-a=see]', s.el).onclick = () => { const o = read(); forceSound = o.mode === 'time' ? !!(inWin(o.m) ? o.m.sound : inWin(o.e) ? o.e.sound : false) : o.sound !== false; s.close(); show(true).then(() => { forceSound = null; }); };
    sync();
  }
  const label = () => { const S = sched(); return S.mode === 'off' ? 'désactivé' : S.mode === 'time' ? 'selon l\'heure' : (S.sound !== false ? 'animé + son' : 'animé, sans son'); };
  return { show, boot, bye, welcome, on, soundOn, settings, label, set: (k, v) => LS(k, v) };
})();
