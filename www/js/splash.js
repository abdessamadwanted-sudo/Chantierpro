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
  // sons : grondement + souffle à l'ouverture des portes
  function doorSound() {
    if (!soundOn()) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const t = ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + 1.3);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      o.connect(f); f.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 1.6);
      const len = 1.4, buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length) * 0.5;
      const n = ac.createBufferSource(), nf = ac.createBiquadFilter(), ng = ac.createGain(); n.buffer = buf; nf.type = 'bandpass'; nf.frequency.setValueAtTime(300, t + .9); nf.frequency.exponentialRampToValueAtTime(2400, t + 2.2); ng.gain.value = 0.16;
      n.connect(nf); nf.connect(ng); ng.connect(ac.destination); n.start(t + 0.9);
    } catch (e) {}
  }
  // porte monumentale (style des grandes portes impériales marocaines) : arc outrepassé, zellige, merlons, battants cloutés
  function gateHTML() {
    const merlons = Array.from({ length: 15 }, (_, i) => `<path d="M${i * 20 + 2},34 v-12 h5 v-6 h6 v6 h5 v12z"/>`).join('');
    const studs = (x0) => Array.from({ length: 7 }, (_, r) => Array.from({ length: 3 }, (_, c) => `<circle cx="${x0 + 10 + c * 15}" cy="${r * 30 + 30}" r="2.2"/>`).join('')).join('');
    return `<div class="sp-gate">
      <svg width="0" height="0" style="position:absolute"><clipPath id="gArch" clipPathUnits="objectBoundingBox"><path d="M0.0862,1 V0.397 A0.5,0.2544 0 1 1 0.9138,0.397 V1 Z"/></clipPath></svg>
      <div class="g-light"></div>
      <div class="g-doors"><div class="g-door l"><svg viewBox="0 0 58 228" preserveAspectRatio="none"><rect width="58" height="228" fill="url(#gWood)"/>${[0, 1, 2, 3].map(k => `<rect x="5" y="${12 + k * 54}" width="48" height="46" rx="3" fill="none" stroke="#3b2210" stroke-width="2"/>`).join('')}<g fill="#e6c25c">${studs(0)}</g><circle cx="50" cy="140" r="5" fill="none" stroke="#e6c25c" stroke-width="2"/></svg></div>
        <div class="g-door r"><svg viewBox="0 0 58 228" preserveAspectRatio="none"><rect width="58" height="228" fill="url(#gWood)"/>${[0, 1, 2, 3].map(k => `<rect x="5" y="${12 + k * 54}" width="48" height="46" rx="3" fill="none" stroke="#3b2210" stroke-width="2"/>`).join('')}<g fill="#e6c25c">${studs(3)}</g><circle cx="8" cy="140" r="5" fill="none" stroke="#e6c25c" stroke-width="2"/></svg></div></div>
      <svg class="g-frame" viewBox="0 0 300 340">
        <defs>
          <pattern id="gZel" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#f3ead6"/><path d="M10 1 L12.6 7.4 19 10 12.6 12.6 10 19 7.4 12.6 1 10 7.4 7.4Z" fill="#1d6b4f"/><circle cx="10" cy="10" r="2.4" fill="#f3ead6"/><path d="M0 0h3v3H0zM17 0h3v3h-3zM0 17h3v3H0zM17 17h3v3h-3z" fill="#1c3f7a"/></pattern>
          <pattern id="gZel2" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#1d6b4f"/><path d="M6 0 L12 6 6 12 0 6Z" fill="#e9dcc0"/><rect x="4.5" y="4.5" width="3" height="3" fill="#1c3f7a"/></pattern>
          <linearGradient id="gWood" x1="0" x2="1"><stop offset="0" stop-color="#6b3d1c"/><stop offset=".5" stop-color="#8a5326"/><stop offset="1" stop-color="#5a3216"/></linearGradient>
          <linearGradient id="gStone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b77c"/><stop offset="1" stop-color="#b98d52"/></linearGradient>
        </defs>
        <g fill="url(#gStone)">${merlons}</g>
        <path fill-rule="evenodd" fill="url(#gStone)" d="M0 34H300V340H0Z M102 330 V192.6 A58 58 0 1 1 198 192.6 V330Z"/>
        <rect x="0" y="34" width="300" height="5" fill="#9c7342"/>
        <path fill-rule="evenodd" fill="url(#gZel)" d="M52 64 H248 V340 H52Z M102 330 V192.6 A58 58 0 1 1 198 192.6 V330Z"/>
        <rect x="52" y="64" width="196" height="16" fill="url(#gZel2)"/>
        <text x="150" y="76.5" text-anchor="middle" font-size="13" font-weight="700" fill="#f6d77a" font-family="serif" stroke="#1d3f2f" stroke-width=".6" paint-order="stroke">مرحبا بكم</text>
        <path d="M102 330 V192.6 A58 58 0 1 1 198 192.6 V330" fill="none" stroke="#e9dcc0" stroke-width="13"/>
        <path d="M102 330 V192.6 A58 58 0 1 1 198 192.6 V330" fill="none" stroke="#1d6b4f" stroke-width="13" stroke-dasharray="7 7"/>
        <path d="M95.5 330 V192 A64.5 64.5 0 1 1 204.5 192 V330" fill="none" stroke="#c9a24a" stroke-width="2"/>
        <rect x="80" y="196" width="9" height="134" rx="2" fill="#efe6d3"/><rect x="211" y="196" width="9" height="134" rx="2" fill="#efe6d3"/>
        <rect x="77" y="190" width="15" height="7" rx="2" fill="#c9a24a"/><rect x="208" y="190" width="15" height="7" rx="2" fill="#c9a24a"/>
        <rect x="10" y="60" width="34" height="280" fill="#c99f62" opacity=".55"/><rect x="256" y="60" width="34" height="280" fill="#c99f62" opacity=".55"/>
        <path d="M16 100h22v30H16zM16 160h22v30H16zM262 100h22v30h-22zM262 160h22v30h-22z" fill="url(#gZel2)" opacity=".9"/>
      </svg>
      <button class="g-enter">🔑 Entrer au chantier</button>
    </div>`;
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
      let done = false, gate = false;
      const finish = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => { el.remove(); resolve(); }, 450); };
      const toGate = () => {
        if (gate || done) return; gate = true;
        el.classList.add('gating'); el.insertAdjacentHTML('beforeend', gateHTML()); $('.sp-skip', el).textContent = 'Touchez la porte pour entrer';
        const G = $('.sp-gate', el); let opening = false;
        G.onclick = (e) => { e.stopPropagation(); if (opening) return; opening = true; doorSound(); try { navigator.vibrate && navigator.vibrate([20, 60, 30]); } catch (x) {}
          G.classList.add('open'); setTimeout(() => el.classList.add('through'), 1500); setTimeout(finish, 2350); };
      };
      el.onclick = () => { if (!gate) toGate(); };
      const L = await lines(), term = $('.sp-term', el);
      await new Promise(r => setTimeout(r, 1150));
      for (const line of L) {
        if (gate || done) return;
        const row = document.createElement('div'); row.className = line.startsWith('✓') ? 'ok' : ''; term.appendChild(row);
        for (let i = 0; i < line.length; i++) {
          if (gate || done) return;
          row.textContent = line.slice(0, i + 1); if (line[i] !== ' ') click();
          await new Promise(r => setTimeout(r, (line[i] === ' ' ? 40 : 60) + Math.random() * 45));
        }
        await new Promise(r => setTimeout(r, 420));
      }
      setTimeout(toGate, 900);
    });
  }
  return { show, on, soundOn, set: (k, v) => LS(k, v) };
})();
