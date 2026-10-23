// ================= Écran d'ouverture animé : logo qui se dessine + message tapé au clavier (style terminal) =================
const Splash = (() => {
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  // réglages : animation et son selon l'heure (matin / soir), le reste de la journée sans son ou désactivé
  const SCHED_DEF = { mode: 'always', sound: true, m: { from: '06:00', to: '10:00', sound: true }, e: { from: '18:00', to: '23:30', sound: true }, rest: 'silent', brief: true, title: 'CHANTIER', msg: '{salut}, {nom} 👷', motto: 'QUALITÉ ◆ SÉCURITÉ ◆ DÉLAIS' };
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
  // seulement l'accueil avec le prénom (plus de nom de chantier)
  // textes modifiables dans Paramètres › Écran d'ouverture ({salut} = Bonjour / Bonsoir…, {nom} = votre prénom)
  const fill = (t) => { const h = new Date().getHours(), hello = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir', name = LS('userName') || '';
    return String(t || '').replace(/\{salut\}/gi, hello).replace(/,?\s*\{nom\}/gi, (m) => name ? m.replace(/\{nom\}/i, name) : '').trim(); };
  const txt = () => { const S = sched(); return { title: (S.title || '').trim() || 'CHANTIER', msg: S.msg == null ? SCHED_DEF.msg : S.msg, motto: S.motto == null ? SCHED_DEF.motto : S.motto }; };
  async function lines() {
    const m = fill(txt().msg); return m ? m.split('\n').map(x => '> ' + x) : [];
  }
  // mur qui se construit brique par brique (bas de l'écran), une grue pose la dernière brique
  function wallHTML() {
    const rows = 2, per = 9, out = [];
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? -0.5 : 0, n = per + (r % 2 ? 1 : 0);
      for (let i = 0; i < n; i++) { const d = 0.35 + r * 0.22 + i * 0.045 + (r % 2 ? 0.02 : 0); const tone = 0.86 + ((i * 7 + r * 3) % 5) * 0.035;
        out.push(`<i style="left:${(i + off) * (100 / per)}%;bottom:${r * (100 / rows)}%;animation-delay:${d.toFixed(2)}s;--t:${tone.toFixed(3)}"></i>`); }
    }
    return `<div class="sp-wall" aria-hidden="true"><div class="sp-bricks">${out.join('')}</div><div class="sp-ground"></div></div>
      <div class="sp-tc" aria-hidden="true"><div class="tc-mast"></div><div class="tc-slew"><i class="tc-top"></i><i class="tc-cab"></i>
        <div class="tc-jib"><b class="tc-trol"><i class="tc-cable"></i><i class="tc-hook"></i></b></div><div class="tc-cj"><i class="tc-cw"></i></div></div></div>`;
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
        <div class="sp-name">${[...txt().title].map((c, i) => `<span style="animation-delay:${0.9 + i * 0.06}s">${c}</span>`).join('')}</div>
        <pre class="sp-term"></pre></div>${wallHTML()}<small class="sp-skip">Touchez pour passer</small>`;
      document.body.appendChild(el);
      let done = false; chime();
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
      const mo = txt().motto.split(/\s*[◆•|·]\s*/).filter(Boolean); if (mo.length) $('.sp-intro', el).insertAdjacentHTML('beforeend', `<div class="sp-motto">${mo.map(x => `<b>${esc(x)}</b>`).join('<i>◆</i>')}<u></u></div>`);
      setTimeout(finish, 2500);
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
        <div class="wl-top"><b>${esc(txt().title)}</b><span>${esc(hello())}${name ? ', ' + esc(name) : ''}</span><small>${esc(d.charAt(0).toUpperCase() + d.slice(1))}</small></div>
        <div class="wl-power"><span class="wl-ring r1"></span><span class="wl-ring r2"></span><button class="wl-pbtn" aria-label="Entrer">${icon('power')}</button></div>
        <small class="wl-hint">Touchez pour démarrer</small>`;
      document.body.appendChild(el);
      const b = $('.wl-pbtn', el);
      b.onclick = () => { if (b.classList.contains('go')) return; b.classList.add('go'); el.classList.add('lit'); powerSound(); try { navigator.vibrate && navigator.vibrate([12, 40, 18]); } catch (e) {}
        setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); resolve(); }, 420); }, 650); };
    });
  }
  // petite mélodie quand le logo apparaît (trois notes douces)
  function chime() {
    if (!soundOn()) return;
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); const t0 = ac.currentTime + .15;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(), t = t0 + i * .16; o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + .9); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 1); }); } catch (e) {}
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
    // ordre : bouton vert « Entrer » → logo + texte avec la musique → mes chantiers (le briefing s'ouvre en touchant un chantier)
    const S = sched();
    if (S.mode === 'off') return;
    await welcome();
    await show(true);
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
      <div class="ss-txt"><b>✏️ Textes affichés</b>
        <label>Titre<input data-k="title" value="${esc(S.title || '')}" placeholder="CHANTIER" maxlength="18"></label>
        <label>Message tapé<textarea data-k="msg" rows="2" placeholder="{salut}, {nom} 👷">${esc(S.msg == null ? SCHED_DEF.msg : S.msg)}</textarea></label>
        <label>Devise (séparée par ◆)<input data-k="motto" value="${esc(S.motto == null ? SCHED_DEF.motto : S.motto)}" placeholder="QUALITÉ ◆ SÉCURITÉ ◆ DÉLAIS"></label>
        <small>{salut} = Bonjour / Bonsoir… · {nom} = votre prénom · laisser vide pour ne rien afficher</small></div>
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
