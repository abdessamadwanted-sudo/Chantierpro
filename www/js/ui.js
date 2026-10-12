// Outils d'interface partagés
const ICONS = {
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  more: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  plans: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h7v12M10 14h6v7"/>',
  tasks: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  form: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v2h6V3M9 10h6M9 14h6M9 18h3"/>',
  report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  team: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" fill="currentColor" stroke="none"/>',
  chevdown: '<path d="M6 9l6 6 6-6"/>',
  chevright: '<path d="M9 18l6-6-6-6"/>',
  pin: '<path d="M12 22s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  shapes: '<rect x="3" y="9" width="12" height="12" rx="1"/><circle cx="15" cy="9" r="6"/>',
  text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  cad: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 17V7h4a3 3 0 0 1 0 6H7M14 17l3-10 3 10"/>',
  move: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  eraser: '<path d="M20 20H7L3 16l10-10 7 7-7 7"/><path d="M9 10l7 7"/>',
  close: '<path d="M18 6L6 18M6 6l12 12"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 15h1.5a1.5 1.5 0 0 0 0-3H8v5M13 12v5h1a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2z"/>',
  drive: '<path d="M8 3h8l6 10-4 7H6l-4-7z"/><path d="M8 3l6 10h8M2 13h12l-4 7"/>',
  rect: '<rect x="4" y="4" width="16" height="16"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  arrow: '<path d="M5 19L19 5M10 5h9v9"/>',
  line: '<path d="M4 20L20 4"/>',
  cloud: '<path d="M7 6a3 3 0 0 1 5-1 3 3 0 0 1 5 1 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-5 2 3 3 0 0 1-5-1 3 3 0 0 1-3-4 3 3 0 0 1 3-7z"/>',
  zone: '<rect x="4" y="4" width="16" height="16" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  hard: '<path d="M2 18h20M4 18v-3a8 8 0 0 1 16 0v3M10 7V4h4v3"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>',
  ruler: '<path d="M21.3 8.7L8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z"/><path d="M7.5 10.5l2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2"/>',
  fill: '<path d="M4 18l7-12 5 7 4-3v8z" fill="currentColor" fill-opacity=".55"/><path d="M4 18l7-12 5 7 4-3v8z"/>',
  disc: '<circle cx="12" cy="12" r="8" fill="currentColor" fill-opacity=".85"/>',
  box: '<rect x="4" y="5" width="16" height="14" rx="1" fill="currentColor" fill-opacity=".85"/>',
  sheet: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M7 16V9h5v7M12 12h4v4M17 4v5"/>',
  section: '<path d="M4 4v16M20 4v16"/><path d="M4 12h16"/><path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  rows: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M8 4v16"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 3"/>',
  collapse: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4M4 3h16M4 21h16"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  cursor: '<path d="M4 4l7 17 2.5-7.5L21 11z"/><path d="M13.5 13.5L20 20"/>',
  poly: '<path d="M3 17l5-9 6 6 7-10"/><circle cx="3" cy="17" r="1.6"/><circle cx="8" cy="8" r="1.6"/><circle cx="14" cy="14" r="1.6"/><circle cx="21" cy="4" r="1.6"/>',
  layers: '<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
};
const icon = (n, extra = '') => `<svg class="i" viewBox="0 0 24 24" ${extra}>${ICONS[n] || ''}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmtDate = (t) => t ? new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const fmtDateTime = (t) => t ? new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

function loading(msg = 'Chargement…') {
  const el = document.createElement('div');
  el.className = 'loading'; el.textContent = msg;
  document.body.appendChild(el);
  return { set: (m) => el.textContent = m, close: () => el.remove() };
}

// Pile de "retour" (bouton retour Android + flèche)
const BackStack = [];
function pushBack(fn) { BackStack.push(fn); return () => { const i = BackStack.indexOf(fn); if (i >= 0) BackStack.splice(i, 1); }; }
function goBack() { const fn = BackStack.pop(); if (fn) { fn(); return true; } return false; }

// Feuille du bas (bottom sheet)
function sheet(html, { onMount, title } = {}) {
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet"><div class="grab"></div>${title ? `<h3>${esc(title)}</h3>` : ''}${html}</div>`;
  let closed = false;
  const unBack = pushBack(() => close(true));
  function close(fromBack) {
    if (closed) return; closed = true;
    if (!fromBack) unBack();
    bg.remove();
    if (api.onClose) api.onClose();
  }
  const api = { el: bg.firstElementChild, close: () => close(false), onClose: null };
  bg.addEventListener('click', (e) => { if (e.target === bg) api.close(); });
  $('#sheet-root').appendChild(bg);
  if (onMount) onMount(api.el, api);
  return api;
}

// Menu d'options
function menu(title, options) {
  return new Promise((resolve) => {
    let picked = null;
    const s = sheet(options.map((o, i) => `<button class="opt ${o.danger ? 'danger' : ''}" data-i="${i}">${o.icon ? icon(o.icon) : ''}<span>${esc(o.label)}</span>${o.checked ? `<span class="check">${icon('check')}</span>` : ''}</button>`).join(''), {
      title,
      onMount: (el) => $$('.opt', el).forEach(b => b.onclick = () => { picked = options[+b.dataset.i].value ?? +b.dataset.i; s.close(); }),
    });
    s.onClose = () => resolve(picked);
  });
}

// Formulaire rapide : fields = [{name,label,type,value,options,placeholder}]
function formSheet(title, fields, { okLabel = 'Enregistrer', danger } = {}) {
  return new Promise((resolve) => {
    let result = null;
    const body = `<div class="form">${fields.map(f => {
      const v = esc(f.value ?? '');
      let input;
      if (f.type === 'textarea') input = `<textarea name="${f.name}" placeholder="${esc(f.placeholder || '')}">${v}</textarea>`;
      else if (f.type === 'select') input = `<select name="${f.name}">${f.options.map(o => `<option value="${esc(o.value ?? o)}" ${(o.value ?? o) == f.value ? 'selected' : ''}>${esc(o.label ?? o)}</option>`).join('')}</select>`;
      else input = `<input name="${f.name}" type="${f.type || 'text'}" value="${v}" placeholder="${esc(f.placeholder || '')}" ${f.type === 'url' ? 'inputmode="url"' : ''} ${f.list ? `list="dl-${f.name}"` : ''}>` +
        (f.list ? `<datalist id="dl-${f.name}">${f.list.map(o => `<option value="${esc(o)}">`).join('')}</datalist>` : '');
      return `<label>${esc(f.label)}${input}</label>`;
    }).join('')}</div>
    <div class="btnrow"><button class="btn ghost" data-a="cancel">Annuler</button><button class="btn" data-a="ok">${esc(okLabel)}</button></div>
    ${danger ? `<div class="btnrow"><button class="btn danger" data-a="danger">${esc(danger)}</button></div>` : ''}`;
    const s = sheet(body, {
      title,
      onMount: (el) => {
        const first = $('input,textarea', el); if (first && !first.value) setTimeout(() => first.focus(), 250);
        $('[data-a=cancel]', el).onclick = () => s.close();
        $('[data-a=ok]', el).onclick = () => {
          result = {}; $$('[name]', el).forEach(i => result[i.name] = i.value.trim()); s.close();
        };
        const d = $('[data-a=danger]', el); if (d) d.onclick = () => { result = { __danger: true }; s.close(); };
      },
    });
    s.onClose = () => resolve(result);
  });
}

async function alertBox(msg) {
  await menu(msg, [{ label: 'OK', icon: 'check', value: 'ok' }]);
}

async function confirmBox(msg, okLabel = 'Supprimer') {
  const r = await menu(msg, [{ label: okLabel, icon: 'trash', danger: true, value: 'ok' }, { label: 'Annuler', icon: 'close', value: 'no' }]);
  return r === 'ok';
}

// Choisir des fichiers (caméra / galerie / PDF)
function pickFiles({ accept = 'image/*', multiple = true, capture = false } = {}) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.multiple = multiple;
    if (capture) inp.setAttribute('capture', 'environment');
    inp.style.display = 'none';
    inp.onchange = () => { resolve([...inp.files]); inp.remove(); };
    document.body.appendChild(inp);
    inp.click();
  });
}

function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}

// Réduit la taille d'une photo (garde le stockage léger)
// Orientation EXIF d'une photo JPEG (1 = normale, 6 = tournée à 90°, 3 = 180°, 8 = 270°)
async function exifOrientation(file) {
  try {
    const v = new DataView(await file.slice(0, 131072).arrayBuffer());
    if (v.getUint16(0) !== 0xFFD8) return 1;
    let o = 2;
    while (o < v.byteLength - 4) {
      const m = v.getUint16(o), len = v.getUint16(o + 2);
      if (m === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949, ifd = t + v.getUint32(t + 4, le), n = v.getUint16(ifd, le);
        for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le); }
        return 1;
      }
      if ((m & 0xFF00) !== 0xFF00) break;
      o += 2 + len;
    }
  } catch (e) {}
  return 1;
}
async function compressImage(file, max = 1600, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const im = await loadImage(url);
    const ori = /jpe?g/i.test(file.type || file.name || '') ? await exifOrientation(file) : 1;
    // Le navigateur applique-t-il déjà l'orientation ? (photo « debout » enregistrée couchée par le capteur)
    let nw = im.naturalWidth, nh = im.naturalHeight, rot = 0;
    if (ori >= 5 && ori <= 8 && nw > nh) rot = ori === 6 || ori === 5 ? 90 : 270;   // pas encore tournée → on la tourne
    if ((ori === 3 || ori === 4) && !CSS.supports('image-orientation', 'from-image')) rot = 180;
    const r = Math.min(1, max / Math.max(nw, nh));
    const w0 = Math.round(nw * r), h0 = Math.round(nh * r);
    const swap = rot === 90 || rot === 270, w = swap ? h0 : w0, h = swap ? w0 : h0;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (rot) { g.translate(w / 2, h / 2); g.rotate(rot * Math.PI / 180); g.drawImage(im, -w0 / 2, -h0 / 2, w0, h0); }
    else g.drawImage(im, 0, 0, w, h);
    const blob = await new Promise(r2 => c.toBlob(r2, 'image/jpeg', quality));
    return { blob, w, h };
  } finally { URL.revokeObjectURL(url); }
}

function pdfReady() {
  if (!window.pdfjsLib) return false;
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
  return true;
}

// Convertit chaque page d'un PDF en image (pour les plans)
async function pdfToImages(file, maxSide = 3000, onPage) {
  if (!pdfReady()) throw new Error('Lecteur PDF non disponible');
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const out = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    if (onPage) onPage(p, pdf.numPages);
    const page = await pdf.getPage(p);
    const vp1 = page.getViewport({ scale: 1 });
    // haute résolution, limitée à ~16 Mpx (limite des canvas sur Android)
    const scale = Math.min(8, maxSide / Math.max(vp1.width, vp1.height), Math.sqrt(16e6 / (vp1.width * vp1.height)));
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    c.width = c.height = 0; // libère la mémoire
    out.push({ blob, w: Math.round(vp.width), h: Math.round(vp.height), page: p });
  }
  return out;
}

// Visionneuse photo plein écran
function showImage(src, caption = '') { return showGallery([{ src, caption }], 0); }
// Galerie plein écran : glisser à gauche / à droite pour passer d'une photo à l'autre
function showGallery(items, start = 0) {
  items = items.filter(x => x && x.src);
  if (!items.length) return;
  const el = document.createElement('div');
  el.className = 'lightbox gallery';
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('close')}</button><h1 class="gl-cap"></h1><span class="gl-n"></span>${items.some(x => x.fileId) ? `<button class="iconbtn" data-a="rot" title="Tourner">↻</button>` : ''}</div>
    <div class="gl-track">${items.map(it => `<div class="gl-slide"><img src="${it.src}" draggable="false"></div>`).join('')}</div>
    ${items.length > 1 ? `<div class="gl-dots">${items.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>` : ''}`;
  document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
  const tr = $('.gl-track', el);
  const upd = () => {
    const i = Math.round(tr.scrollLeft / tr.clientWidth);
    $('.gl-cap', el).textContent = items[i]?.caption || '';
    $('.gl-n', el).textContent = items.length > 1 ? `${i + 1} / ${items.length}` : '';
    $$('.gl-dots i', el).forEach((d, j) => d.classList.toggle('on', j === i));
  };
  tr.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
  const rb = $('[data-a=rot]', el); if (rb) rb.onclick = async () => {
    const i = Math.round(tr.scrollLeft / tr.clientWidth), it = items[i]; if (!it || !it.fileId) return;
    const url = await rotateFile(it.fileId); if (url) { it.src = url; $$('.gl-slide img', el)[i].src = url; }
  };
  $$('.gl-dots i', el).forEach(d => d.onclick = () => tr.scrollTo({ left: +d.dataset.i * tr.clientWidth, behavior: 'smooth' }));
  requestAnimationFrame(() => { tr.scrollLeft = start * tr.clientWidth; upd(); });
}

// Visionneuse PDF (pages rendues avec pdf.js)
async function showPdf(blob, caption = 'PDF') {
  if (!pdfReady()) { toast('Lecteur PDF non disponible'); return; }
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('close')}</button><h1>${esc(caption)}</h1></div><div class="pdf-pages"></div>`;
  document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
  const box = $('.pdf-pages', el);
  try {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    for (let p = 1; p <= pdf.numPages; p++) {
      if (!el.isConnected) break;
      const page = await pdf.getPage(p);
      const vp1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(3, (window.innerWidth * 2) / vp1.width) });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      box.appendChild(c);
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    }
  } catch (e) { box.innerHTML = `<div class="empty">Impossible d'ouvrir ce PDF</div>`; }
}

// Ouvre un lien (Google Drive, etc.) dans le navigateur du téléphone
function openUrl(url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  if (isNative()) window.location.href = url; // Capacitor l'ouvre dans le navigateur externe
  else window.open(url, '_blank');
}

// ---------- Google Drive : télécharger un fichier partagé par lien ----------
function driveFileId(url) {
  const m = String(url).match(/\/file\/d\/([\w-]{10,})/) || String(url).match(/[?&]id=([\w-]{10,})/) || String(url).match(/\/d\/([\w-]{10,})/);
  return m ? m[1] : null;
}
function base64ToBlob(b64, type) {
  const bin = atob(b64.replace(/^data:[^,]*,/, ''));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}
function mimeFromName(name, fallback) {
  if (/\.pdf$/i.test(name)) return 'application/pdf';
  if (/\.(jpe?g)$/i.test(name)) return 'image/jpeg';
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.webp$/i.test(name)) return 'image/webp';
  if (/\.dwg$/i.test(name)) return 'application/acad';
  if (/\.dxf$/i.test(name)) return 'application/dxf';
  return fallback || 'application/octet-stream';
}
async function downloadFromDrive(url) {
  if (/\/folders\//.test(url)) throw new Error('C\'est un lien de dossier. Ouvrez le fichier dans Drive et copiez le lien du fichier.');
  const id = driveFileId(url);
  if (!id) throw new Error('Lien Drive non reconnu');
  const http = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
  if (!http) throw new Error('Téléchargement disponible uniquement dans l\'application Android');
  const r = await http.get({ url: `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, responseType: 'blob' });
  const headers = {};
  for (const k in (r.headers || {})) headers[k.toLowerCase()] = r.headers[k];
  let type = String(headers['content-type'] || '').split(';')[0].trim();
  if (r.status >= 400 || type === 'text/html') {
    throw new Error('Fichier non accessible. Dans Drive : Partager → « Tous les utilisateurs disposant du lien ».');
  }
  const cd = headers['content-disposition'] || '';
  let name = (cd.match(/filename\*=UTF-8''([^;]+)/i) || [])[1];
  name = name ? decodeURIComponent(name) : ((cd.match(/filename="?([^";]+)"?/i) || [])[1] || `drive-${id}`);
  type = mimeFromName(name, type);
  const data = typeof r.data === 'string' ? r.data : '';
  if (!data) throw new Error('Téléchargement vide');
  return new File([base64ToBlob(data, type)], name, { type });
}

// Vraie image affichable (et pas un DWG déclaré « image/vnd.dwg »)
const isRasterImage = (file) => /^image\/(jpeg|jpg|png|webp|gif|bmp|heic|heif)$/i.test(file.type || '') || (!file.type && /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name || ''));

// ---------- Miniatures (rapides) : 480 px, gardées en cache sur le téléphone ----------
const Thumbs = (() => {
  const mem = new Map(), inflight = new Map();
  const cacheP = (window.caches ? caches.open('thumbs-v1').catch(() => null) : Promise.resolve(null));
  let q = [], active = 0;
  const run = () => { while (active < 4 && q.length) { const job = q.shift(); active++; job().finally(() => { active--; run(); }); } };
  async function make(id) {
    const c = await cacheP, key = '/thumb/' + id;
    if (c) { const r = await c.match(key).catch(() => null); if (r) return URL.createObjectURL(await r.blob()); }
    const f = await DB.get('files', id); if (!f || !f.blob) return '';
    if (!/^image\//.test(f.mime || f.blob.type || '')) return '';
    const bmp = await createImageBitmap(f.blob);
    const k = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close && bmp.close();
    const tb = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.72));
    if (c && tb) c.put(key, new Response(tb, { headers: { 'Content-Type': 'image/jpeg' } })).catch(() => {});
    return tb ? URL.createObjectURL(tb) : '';
  }
  function get(id) {
    if (mem.has(id)) return Promise.resolve(mem.get(id));
    if (!inflight.has(id)) inflight.set(id, new Promise(res => { q.push(() => make(id).catch(() => '').then(u => { if (u) mem.set(id, u); inflight.delete(id); res(u); })); run(); }));
    return inflight.get(id);
  }
  // remplit toutes les <img data-thumb="fileId"> d'un conteneur
  function fill(root) { $$('img[data-thumb]', root).forEach(im => { const id = im.dataset.thumb; im.removeAttribute('data-thumb'); get(id).then(u => { if (u) im.src = u; }); }); }
  async function drop(id) { mem.delete(id); const c = await cacheP; if (c) c.delete('/thumb/' + id).catch(() => {}); }
  return { get, fill, drop };
})();

// Recherche tolérante : ignore espaces, tirets, points, accents et majuscules (« CR22 » = « Cr 22 » = « cr-22 »)
const normQ = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9+]/g, '');
const fuzzyHas = (text, q) => { const n = normQ(q); return !n || normQ(text).includes(n); };

// Tourne une photo de 90° (sens horaire) et l'enregistre (renvoyée vers Drive à la prochaine synchro)
async function rotateFile(id) {
  const f = await DB.get('files', id); if (!f || !f.blob) return '';
  const bmp = await createImageBitmap(f.blob);
  const c = document.createElement('canvas'); c.width = bmp.height; c.height = bmp.width;
  const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate(Math.PI / 2); g.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  f.blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88)); f.mime = 'image/jpeg'; f.w = c.width; f.h = c.height;
  f.driveId = null; f.drivePath = null;
  BlobURL.drop(id); if (window.Thumbs) Thumbs.drop(id);
  await DB.put('files', f);
  return BlobURL.get(f.id, f.blob);
}
