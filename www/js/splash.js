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
    // merlons en escalier, bastions à niches, sebka (losanges) verte, zellige, arc outrepassé à lobes, colonnes de marbre, frise noire et or
    const merl = (x0, x1, y) => { let d = ''; for (let x = x0; x < x1 - 1; x += 16) d += `M${x + 1},${y} v-9 h3 v-5 h3 v-4 h2 v4 h3 v5 h3 v9z`; return d; };
    const studs = (x0) => Array.from({ length: 9 }, (_, r) => Array.from({ length: 3 }, (_, c) => `<circle cx="${x0 + 11 + c * 14}" cy="${r * 24 + 18}" r="1.9"/>`).join('')).join('');
    const star = (cx, cy, r) => { let d = ''; for (let i = 0; i < 16; i++) { const a = Math.PI * i / 8, rr = i % 2 ? r * .45 : r; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1); } return d + 'Z'; };
    const door = (side) => `<svg viewBox="0 0 58 228" preserveAspectRatio="none"><rect width="58" height="228" fill="url(#gWood)"/>
        <rect x="3" y="3" width="52" height="222" fill="none" stroke="#2a160a" stroke-width="2"/>
        ${[0, 1, 2].map(k => `<g transform="translate(29 ${48 + k * 66})"><rect x="-21" y="-28" width="42" height="56" rx="2" fill="url(#gWood2)" stroke="#2a160a" stroke-width="1.6"/><path d="${star(0, 0, 13)}" fill="none" stroke="#c99a3c" stroke-width="1.3"/><circle r="3" fill="#e6c25c"/></g>`).join('')}
        <g fill="#e9c46a" stroke="#7a5a1c" stroke-width=".5">${studs(side === 'l' ? 1 : 2)}</g>
        <circle cx="${side === 'l' ? 51 : 7}" cy="132" r="5.5" fill="none" stroke="#e6c25c" stroke-width="2.2"/><circle cx="${side === 'l' ? 51 : 7}" cy="126" r="2" fill="#e6c25c"/>
        <rect x="${side === 'l' ? 54 : 0}" width="4" height="228" fill="#000" opacity=".35"/></svg>`;
    const OPEN = 'M102 330 V192.6 A58 58 0 1 1 198 192.6 V330Z';
    return `<div class="sp-gate">
      <svg width="0" height="0" style="position:absolute"><clipPath id="gArch" clipPathUnits="objectBoundingBox"><path d="M0.0862,1 V0.397 A0.5,0.2544 0 1 1 0.9138,0.397 V1 Z"/></clipPath></svg>
      <div class="g-light"></div>
      <div class="g-doors"><div class="g-door l">${door('l')}</div><div class="g-door r">${door('r')}</div></div>
      <svg class="g-frame" viewBox="0 0 300 340">
        <defs>
          <filter id="gTex" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .22  0 0 0 0 .1  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/><feBlend in2="SourceGraphic" mode="multiply"/></filter>
          <linearGradient id="gStone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2bd82"/><stop offset=".55" stop-color="#cfa064"/><stop offset="1" stop-color="#a87a45"/></linearGradient>
          <linearGradient id="gBast" x1="0" x2="1"><stop offset="0" stop-color="#b8884f"/><stop offset=".45" stop-color="#d9b077"/><stop offset="1" stop-color="#a97b46"/></linearGradient>
          <pattern id="gSebka" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#0e5a40"/><path d="M8 .8 L15.2 8 8 15.2 .8 8Z" fill="none" stroke="#d8e9cf" stroke-width="1.1"/><path d="M8 4 L12 8 8 12 4 8Z" fill="#0a2e22"/><circle cx="8" cy="8" r="1.1" fill="#d4af37"/><path d="M0 0h1.6v1.6H0zM14.4 0H16v1.6h-1.6zM0 14.4h1.6V16H0zM14.4 14.4H16V16h-1.6z" fill="#d8e9cf"/></pattern>
          <pattern id="gZel" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="#f1e7d0"/><path d="${star(9, 9, 7.5)}" fill="#13684b"/><path d="${star(9, 9, 3.6)}" fill="#f1e7d0"/><circle cx="9" cy="9" r="1.4" fill="#1b3d78"/><path d="M0 0l3 0 0 3zM18 0l-3 0 0 3zM0 18l3 0 0-3zM18 18l-3 0 0-3z" fill="#111"/></pattern>
          <pattern id="gBand" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#0b2b20"/><path d="M5 1 9 5 5 9 1 5Z" fill="#d4af37"/></pattern>
          <linearGradient id="gWood" x1="0" x2="1"><stop offset="0" stop-color="#4a2510"/><stop offset=".5" stop-color="#6e3b18"/><stop offset="1" stop-color="#40200d"/></linearGradient>
          <linearGradient id="gWood2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4520"/><stop offset="1" stop-color="#55290f"/></linearGradient>
          <linearGradient id="gMarble" x1="0" x2="1"><stop offset="0" stop-color="#cfc6b4"/><stop offset=".4" stop-color="#fbf7ee"/><stop offset="1" stop-color="#bdb3a0"/></linearGradient>
          <mask id="gHole" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="340"><rect width="300" height="340" fill="#fff"/><path d="${OPEN}" fill="#000"/></mask>
          <radialGradient id="gShade" cx=".5" cy=".55" r=".6"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
        </defs>
        <!-- bastions -->
        <g filter="url(#gTex)">
          <rect x="0" y="40" width="50" height="300" fill="url(#gBast)"/><rect x="250" y="40" width="50" height="300" fill="url(#gBast)"/>
          <path d="${merl(0, 50, 40)} ${merl(250, 300, 40)}" fill="#d2a86d"/>
          <path fill-rule="evenodd" fill="url(#gStone)" d="M50 52H250V340H50Z ${OPEN}"/>
          <path d="${merl(50, 250, 52)}" fill="#ddb67c"/>
        </g>
        <path d="M14 120 v-26 a11 11 0 0 1 22 0 v26z M264 120 v-26 a11 11 0 0 1 22 0 v26z M14 210 v-26 a11 11 0 0 1 22 0 v26z M264 210 v-26 a11 11 0 0 1 22 0 v26z" fill="url(#gSebka)" stroke="#8c6234" stroke-width="1.5"/>
        <rect x="50" y="52" width="3" height="288" fill="#000" opacity=".18"/><rect x="247" y="52" width="3" height="288" fill="#000" opacity=".18"/>
        <!-- grand panneau (alfiz) : sebka verte au-dessus de l'arc, zellige sur les côtés -->
        <g mask="url(#gHole)">
          <rect x="62" y="70" width="176" height="270" fill="#7d5a2c"/>
          <rect x="66" y="92" width="168" height="104" fill="url(#gSebka)"/>
          <rect x="66" y="196" width="168" height="144" fill="url(#gZel)"/>
          <rect x="66" y="92" width="168" height="248" fill="url(#gShade)"/>
        </g>
        <!-- frise noire et or -->
        <rect x="62" y="70" width="176" height="22" fill="#0b2b20"/><rect x="62" y="70" width="176" height="3" fill="url(#gBand)"/><rect x="62" y="89" width="176" height="3" fill="url(#gBand)"/>
        <text x="150" y="86.5" text-anchor="middle" font-size="14" font-weight="700" fill="#e9c46a" font-family="'Noto Naskh Arabic','Amiri',serif">مرحبا بكم</text>
        <!-- claveaux de l'arc + lobes -->
        <path d="M102 330 V192.6 A58 58 0 1 1 198 192.6 V330" fill="none" stroke="#efe3c6" stroke-width="14"/>
        <path d="M102 330 V192.6 A58 58 0 1 1 198 192.6 V330" fill="none" stroke="#0e5a40" stroke-width="6" stroke-dasharray="4 4" transform="translate(0 0)" opacity=".85"/>
        
        <path d="M93.6 330 V192 A66.5 66.5 0 1 1 206.4 192 V330" fill="none" stroke="#d4af37" stroke-width="1.6"/>
        <path d="M110.4 330 V193 A50 50 0 1 1 189.6 193 V330" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="3"/>
        <g fill="#efe3c6" stroke="#8c6234" stroke-width=".8"><circle cx="101.9" cy="127.6" r="5.6"/><circle cx="107.8" cy="120.2" r="5.6"/><circle cx="114.8" cy="113.9" r="5.6"/><circle cx="122.8" cy="108.8" r="5.6"/><circle cx="131.4" cy="105.1" r="5.6"/><circle cx="140.6" cy="102.8" r="5.6"/><circle cx="150.0" cy="102.0" r="5.6"/><circle cx="159.4" cy="102.8" r="5.6"/><circle cx="168.6" cy="105.1" r="5.6"/><circle cx="177.2" cy="108.8" r="5.6"/><circle cx="185.2" cy="113.9" r="5.6"/><circle cx="192.2" cy="120.2" r="5.6"/><circle cx="198.1" cy="127.6" r="5.6"/></g>
        <!-- colonnes de marbre -->
        <g><rect x="80" y="200" width="10" height="130" rx="2" fill="url(#gMarble)"/><rect x="210" y="200" width="10" height="130" rx="2" fill="url(#gMarble)"/>
          <path d="M76 200h18l-3 -8h-12z M206 200h18l-3 -8h-12z" fill="#d4af37"/><rect x="76" y="326" width="18" height="6" fill="#bfa77a"/><rect x="206" y="326" width="18" height="6" fill="#bfa77a"/></g>
        <!-- sol -->
        <rect x="0" y="330" width="300" height="10" fill="#6f4d26" opacity=".55"/>
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
          await new Promise(r => setTimeout(r, (line[i] === ' ' ? 25 : 38) + Math.random() * 28));
        }
        await new Promise(r => setTimeout(r, 300));
      }
      setTimeout(toGate, 650);
    });
  }
  return { show, on, soundOn, set: (k, v) => LS(k, v) };
})();
