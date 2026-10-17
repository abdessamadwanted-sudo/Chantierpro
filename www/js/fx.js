// ================= Effets au toucher : vague d'eau en verre + son de bulle =================
const Fx = {
  on(k) { try { return localStorage.getItem('fx.' + k) !== '0'; } catch (e) { return true; } },
  set(k, v) { try { localStorage.setItem('fx.' + k, v ? '1' : '0'); } catch (e) {} },
  ac: null, last: 0,
  color() { try { return localStorage.getItem('fx.color') || ''; } catch (e) { return ''; } },
  // « bloup » : une bulle qui remonte (sinus qui glisse vers l'aigu, très court) + une petite goutte
  bubble() {
    if (!Fx.on('sound')) return;
    const now = performance.now(); if (now - Fx.last < 60) return; Fx.last = now;
    try {
      const A = Fx.ac = Fx.ac || new (window.AudioContext || window.webkitAudioContext)(); if (A.state === 'suspended') A.resume();
      const t = A.currentTime, f0 = 330 + Math.random() * 90;
      const o = A.createOscillator(), g = A.createGain(), lp = A.createBiquadFilter();
      o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 3.1, t + .07);
      lp.type = 'lowpass'; lp.frequency.value = 2400;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + .11);
      o.connect(lp); lp.connect(g); g.connect(A.destination); o.start(t); o.stop(t + .13);
      const o2 = A.createOscillator(), g2 = A.createGain();   // la goutte (écho aigu très léger)
      o2.type = 'sine'; o2.frequency.setValueAtTime(f0 * 3.6, t + .05); o2.frequency.exponentialRampToValueAtTime(f0 * 4.4, t + .1);
      g2.gain.setValueAtTime(.0001, t + .05); g2.gain.exponentialRampToValueAtTime(.05, t + .06); g2.gain.exponentialRampToValueAtTime(.0001, t + .14);
      o2.connect(g2); g2.connect(A.destination); o2.start(t + .05); o2.stop(t + .16);
    } catch (e) {}
  },
  // vague : deux anneaux de verre qui s'élargissent depuis le doigt, à la couleur du thème
  wave(x, y) {
    if (!Fx.on('wave')) return;
    const w = document.createElement('div'); w.className = 'fx-wave'; w.style.left = x + 'px'; w.style.top = y + 'px';
    const c = Fx.color(); if (c) w.style.setProperty('--fx-c', c);
    w.innerHTML = '<i></i><i></i><b></b>'; document.body.appendChild(w); setTimeout(() => w.remove(), 800);
  },
};
const FX_SEL = 'button, a.btn, .opt, .fn-row, .item, .bf-card, .h2-card, .row, .rg-si, .pt-tg button, .ob-c, .ob-p, label.bn-i, [data-a], [data-s], [data-id]';
// seulement un vrai toucher : pas pendant qu'on fait glisser / défiler
let _fxDown = null;
document.addEventListener('pointerdown', (e) => { if (e.button > 0) return; _fxDown = { x: e.clientX, y: e.clientY, t: Date.now(), el: e.target }; }, { capture: true, passive: true });
document.addEventListener('pointermove', (e) => { if (_fxDown && Math.hypot(e.clientX - _fxDown.x, e.clientY - _fxDown.y) > 8) _fxDown = null; }, { capture: true, passive: true });
document.addEventListener('pointercancel', () => { _fxDown = null; }, { capture: true, passive: true });
document.addEventListener('pointerup', (e) => {
  const D = _fxDown; _fxDown = null; if (!D || Date.now() - D.t > 600 || Math.hypot(e.clientX - D.x, e.clientY - D.y) > 8) return;
  const t = D.el.closest && D.el.closest(FX_SEL); if (!t || t.disabled) return;
  if (t.closest('.viewer, .sketch, .av-stage, .rl-ov, .og-vp')) return;   // pas d'effet en dessinant ou en zoomant sur un plan
  Fx.wave(e.clientX, e.clientY); Fx.bubble();
}, { capture: true, passive: true });
const FX_COLORS = [['', 'Couleur du thème'], ['#38bdf8', 'Bleu eau'], ['#22c55e', 'Vert'], ['#a855f7', 'Violet'], ['#f472b6', 'Rose'], ['#f59e0b', 'Or'], ['#ffffff', 'Blanc verre']];
// réglages (Paramètres) : son, vague, relief, couleur de la vague
function fxPanel(box) {
  const row = (k, l) => `<button class="ft-r ${Fx.on(k) ? 'on' : ''}" data-fx="${k}"><span class="grow">${l}</span><i class="ft-sw"><u></u></i></button>`;
  box.innerHTML = `<div class="fx-p"><div style="font-weight:600;margin-bottom:6px">Sons et effets</div>${row('sound', '💧 Son de bulle au toucher')}${row('wave', '🌊 Vague d\'eau au toucher')}${row('tilt', '📱 Cartes qui suivent le téléphone')}
    <div class="fx-cl"><span>Couleur de la vague</span><div>${FX_COLORS.map(([c, l]) => `<button data-fxc="${c}" title="${l}" class="${Fx.color() === c ? 'on' : ''}" style="background:${c || 'linear-gradient(135deg,var(--g1,var(--accent)),var(--g2,var(--accent2)))'}"></button>`).join('')}</div></div></div>`;
  $$('[data-fx]', box).forEach(b => b.onclick = () => { const k = b.dataset.fx; Fx.set(k, !Fx.on(k)); b.classList.toggle('on', Fx.on(k)); if (k === 'sound' && Fx.on(k)) Fx.bubble(); });
  $$('[data-fxc]', box).forEach(b => b.onclick = (e) => { try { localStorage.setItem('fx.color', b.dataset.fxc); } catch (x) {} $$('[data-fxc]', box).forEach(x => x.classList.toggle('on', x === b)); const r = b.getBoundingClientRect(); Fx.wave(r.left + r.width / 2, r.top + r.height / 2); });
}
async function fxSettings() {
  for (;;) {
    const v = await menu('Sons et effets', [{ label: '💧 Son de bulle au toucher', value: 'sound', checked: Fx.on('sound') }, { label: '🌊 Vague d\'eau au toucher', value: 'wave', checked: Fx.on('wave') }, { label: '📱 Cartes qui suivent le téléphone (relief)', value: 'tilt', checked: Fx.on('tilt') }, { label: 'Terminé', icon: 'check', value: '__ok' }]);
    if (!v || v === '__ok') return;
    Fx.set(v, !Fx.on(v)); if (Fx.on(v) && v === 'sound') Fx.bubble();
  }
}
