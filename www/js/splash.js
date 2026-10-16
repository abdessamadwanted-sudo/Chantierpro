// ================= Écran d'ouverture animé : logo qui se dessine + message tapé au clavier (style terminal) =================
const Splash = (() => {
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const on = () => LS('splash.off') !== '1';
  const soundOn = () => LS('splash.sound') !== '0';
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
      el.innerHTML = `<div class="sp-logo">
          <svg viewBox="0 0 120 120" class="sp-svg">
            <circle class="sp-ring" cx="60" cy="60" r="52" pathLength="1"/>
            <circle class="sp-ring2" cx="60" cy="60" r="44" pathLength="1"/>
            <path class="sp-hat" pathLength="1" d="M26 80h68M32 80v-10a28 28 0 0 1 56 0v10M52 44v-9h16v9M60 35v45"/>
          </svg>
          <div class="sp-glow"></div>
        </div>
        <div class="sp-name">${'CHANTIER'.split('').map((c, i) => `<span style="animation-delay:${0.9 + i * 0.06}s">${c}</span>`).join('')}</div>
        <pre class="sp-term"></pre><small class="sp-skip">Touchez pour passer</small>`;
      document.body.appendChild(el);
      let done = false;
      const finish = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => { el.remove(); resolve(); }, 380); };
      el.onclick = finish;
      const L = await lines(), term = $('.sp-term', el);
      await new Promise(r => setTimeout(r, 1150));
      for (const line of L) {
        if (done) return;
        const row = document.createElement('div'); row.className = line.startsWith('✓') ? 'ok' : ''; term.appendChild(row);
        for (let i = 0; i < line.length; i++) {
          if (done) return;
          row.textContent = line.slice(0, i + 1); if (line[i] !== ' ') click();
          await new Promise(r => setTimeout(r, (line[i] === ' ' ? 40 : 60) + Math.random() * 45));
        }
        await new Promise(r => setTimeout(r, 420));
      }
      setTimeout(finish, 1600);
      setTimeout(finish, 16000);
    });
  }
  return { show, on, soundOn, set: (k, v) => LS(k, v) };
})();
