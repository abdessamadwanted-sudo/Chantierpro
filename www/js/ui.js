// Outils d'interface partagés
const ICONS = {
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  net: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M10.8 7.2 6.3 15.8M13.2 7.2l4.5 8.6M7.5 18h9"/>',
  bag: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>',
  idcard: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10.5" r="2.3"/><path d="M5.5 16.5c.6-1.7 1.9-2.6 3.5-2.6s2.9.9 3.5 2.6M14.5 9.5H18M14.5 13H18"/>',
  dots: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  more: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  plans: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h7v12M10 14h6v7"/>',
  tasks: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  form: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v2h6V3M9 10h6M9 14h6M9 18h3"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/><path d="M9 7h7M9 11h5"/>',
  report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  team: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" fill="currentColor" stroke="none"/>',
  chevdown: '<path d="M6 9l6 6 6-6"/>',
  chevup: '<path d="M6 15l6-6 6 6"/>',
  power: '<path d="M12 3v9"/><path d="M6.4 6.6a8 8 0 1 0 11.2 0"/>',
  expand: '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4"/><path d="M15 4v5h5"/><path d="M9 20v-5H4"/><path d="M15 20v-5h5"/>',
  brush: '<path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L11 15.8l-2.9-2.9z"/><path d="M8 14c-2 0-3.5 1.5-3.5 3.5 0 1.5-1 2.5-2.5 2.5 1.5 1.2 3 1.5 4.5 1.5A4 4 0 0 0 11 17z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>',
  redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>',
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
  cube: '<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M4 7.4l8 4.6 8-4.6"/><path d="M12 12v9.2"/>',
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
  // v1.0.34 : pictogrammes professionnels (tableaux de bord, outils, dossier pro)
  flask: '<path d="M9 3h6M10 3v6L4.5 18.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/><path d="M7.5 15h9"/>',
  shield: '<path d="M12 3l8 3v6c0 4.6-3.4 8.2-8 9-4.6-.8-8-4.4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  alert: '<path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>',
  helmet: '<path d="M3 17h18M4 17a8 8 0 0 1 16 0"/><path d="M10 9V5h4v4"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
};
const icon = (n, extra = '') => `<svg class="i" viewBox="0 0 24 24" ${extra}>${ICONS[n] || ''}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmtDate = (t) => t ? new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const fmtDateTime = (t) => t ? new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

function toast(msg, opts = {}) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show'); t.classList.toggle('act', !!opts.action);
  if (opts.action) { const b = document.createElement('button'); b.className = 'toast-act'; b.textContent = opts.action; b.onclick = (e) => { e.stopPropagation(); t.classList.remove('show'); clearTimeout(t._h); opts.onAction && opts.onAction(); }; t.appendChild(b); }
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), opts.ms || (opts.action ? 6000 : 2200));
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
  // « clic fantôme » : le doigt qui vient d'ouvrir la feuille (appui court sur un pin…) ne doit pas la refermer aussitôt
  const born = Date.now();
  bg.addEventListener('click', (e) => { if (e.target === bg && Date.now() - born > 450) api.close(); });
  $('#sheet-root').appendChild(bg);
  if (onMount) onMount(api.el, api);
  return api;
}

// Menu d'options
function menu(title, options) {
  return new Promise((resolve) => {
    let picked = null;
    const s = sheet(options.map((o, i) => `<button class="opt ${o.danger ? 'danger' : ''}" data-i="${i}">${o.swatch ? `<span class="swatch" style="background:${o.swatch}"></span>` : o.icon ? icon(o.icon) : ''}<span>${esc(o.label)}</span>${o.checked ? `<span class="check">${icon('check')}</span>` : ''}</button>`).join(''), {
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
      if (f.type === 'info') return `<div class="fs-info"><b>${esc(f.label)}</b><div>${v.replace(/\n/g, '<br>')}</div></div>`;
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

// menu en groupes (titre de groupe, icône dans une pastille colorée, libellé + détail)
function groupMenu(title, groups, { head = '' } = {}) {
  return new Promise((resolve) => {
    let v = null;
    const s = sheet(`<div class="gm">${head}${groups.filter(g => g.items.length).map(g => `${g.title ? `<div class="gm-g">${esc(g.title)}</div>` : ''}<div class="gm-box">${g.items.map(it => `<button class="gm-i" ${it.value != null ? `data-v="${esc(it.value)}"` : 'disabled'}><span class="gm-ic" style="--c:${g.color}">${icon(it.icon)}</span><span class="grow"><b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>${it.value != null ? icon('chevright') : ''}</button>`).join('')}</div>`).join('')}</div>`, { title });
    $$('[data-v]', s.el).forEach(b => b.onclick = () => { v = b.dataset.v; s.close(); });
    // v1.0.47 : menus compacts — recherche (dès 7 entrées) ; chaque groupe se replie (état mémorisé)
    const gm = $('.gm', s.el), n = groups.reduce((a, g) => a + g.items.length, 0), key = 'gm.' + normQ(title);
    if (gm) { gm.classList.add('gm-c');
      let closed = {}; try { closed = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) {}
      $$('.gm-g', gm).forEach(h => { const box = h.nextElementSibling; if (!box) return; const k = h.textContent; h.classList.add('gm-t'); if (closed[k]) { h.classList.add('off'); box.style.display = 'none'; }
        h.onclick = () => { const off = !h.classList.toggle('off'); box.style.display = off ? '' : 'none'; closed[k] = !off; try { localStorage.setItem(key, JSON.stringify(closed)); } catch (e) {} }; });
      if (n >= 7) { const sr = document.createElement('div'); sr.className = 'gm-sr'; sr.innerHTML = `${icon('search')}<input placeholder="Rechercher…">`; gm.prepend(sr);
        $('input', sr).oninput = (e) => { const q = normQ(e.target.value); $$('.gm-i', gm).forEach(b => { b.style.display = !q || normQ(b.textContent).includes(q) ? '' : 'none'; });
          $$('.gm-g', gm).forEach(h => { const box = h.nextElementSibling; if (!box) return; const any = [...box.querySelectorAll('.gm-i')].some(b => b.style.display !== 'none'); h.style.display = any ? '' : 'none'; box.style.display = any && (q || !h.classList.contains('off')) ? '' : 'none'; }); }; } }
    s.onClose = () => resolve(v);
  });
}
// choix de la source (Appareil photo · Photos · Fichiers) en cartes, comme les applis modernes
function pickSource(title = 'Ajouter') {
  return new Promise((resolve) => {
    let v = null;
    const s = sheet(`<div class="src-h"><b>${esc(title)}</b></div><div class="src-grid">
      <button data-v="cam"><span class="src-ic">${icon('camera')}</span><span>Appareil photo</span></button>
      <button data-v="gal"><span class="src-ic">${icon('image')}</span><span>Photos</span></button>
      <button data-v="file"><span class="src-ic"><svg class="i" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 17v-6M9.5 13.5 12 11l2.5 2.5"/></svg></span><span>Fichiers</span></button></div>`, {});
    s.el.classList.add('src-sheet');
    $$('[data-v]', s.el).forEach(b => b.onclick = () => { v = b.dataset.v; s.close(); });
    s.onClose = () => resolve(v);
  });
}
// fichiers choisis → images (les PDF deviennent une image par page)
async function pickImages(src) {
  let files = await pickFiles({ accept: src === 'file' ? 'image/*,application/pdf' : 'image/*', multiple: src !== 'cam', capture: src === 'cam' });
  const out = [];
  for (const f of files) {
    if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) { try { for (const pg of await pdfToImages(f, 2400)) out.push(new File([pg.blob], f.name.replace(/\.pdf$/i, '') + `_p${pg.page}.jpg`, { type: 'image/jpeg' })); } catch (e) { toast('PDF illisible'); } }
    else out.push(f);
  }
  return out;
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

// v1.0.45 : pdf.js, pdf-lib et jsPDF se chargent juste après l'accueil (démarrage plus rapide) ; ceci attend la fin de ce chargement
async function pdfReadyA() { try { if (!window.pdfjsLib && window.__late) await window.__late; } catch (e) {} return pdfReady(); }
function pdfReady() {
  if (!window.pdfjsLib) return false;
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
  return true;
}

// Convertit chaque page d'un PDF en image (pour les plans)
async function pdfToImages(file, maxSide = 3000, onPage) {
  if (!(await pdfReadyA())) throw new Error('Lecteur PDF non disponible');
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const out = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    if (onPage) onPage(p, pdf.numPages);
    const page = await pdf.getPage(p);
    const r = await pdfPageToBlob(page, maxSide);
    out.push({ ...r, page: p });
  }
  return out;
}
// v1.0.47 : rendu d'une page PDF par tuiles (plans A0) — jamais un seul gros rendu : le téléphone ne coupe plus le plan
// (moitié blanche) ; côté max 4096 px et ~12 Mpx (limites sûres des canvas Android / Huawei)
const PDF_MAXSIDE = 4096, PDF_MAXPX = 12e6, PDF_TILE = 1024;
async function pdfPageToBlob(page, maxSide = PDF_MAXSIDE, onTile) {
  const vp1 = page.getViewport({ scale: 1 });
  const scale = Math.min(8, Math.min(maxSide, PDF_MAXSIDE) / Math.max(vp1.width, vp1.height), Math.sqrt(PDF_MAXPX / (vp1.width * vp1.height)));
  const vp = page.getViewport({ scale }), W = Math.round(vp.width), H = Math.round(vp.height);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const t = document.createElement('canvas'), nx = Math.ceil(W / PDF_TILE), ny = Math.ceil(H / PDF_TILE); let k = 0;
  for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) {
    const x0 = tx * PDF_TILE, y0 = ty * PDF_TILE, tw = Math.min(PDF_TILE, W - x0), th = Math.min(PDF_TILE, H - y0);
    t.width = tw; t.height = th; const g = t.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, tw, th);
    try { await page.render({ canvasContext: g, viewport: vp, transform: [1, 0, 0, 1, -x0, -y0] }).promise; } catch (e) { console.warn('tuile', e); }
    ctx.drawImage(t, x0, y0); k++; if (onTile) onTile(k, nx * ny);
  }
  t.width = t.height = 0;
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
  c.width = c.height = 0; // libère la mémoire
  return { blob, w: W, h: H };
}
// v1.0.47 : plans importés avant (rendu d'un seul bloc jusqu'à 5000 px → parfois coupés) : l'image est refaite par tuiles,
// les coordonnées du plan (pins, annotations) ne changent pas (plan.w / plan.h gardés, l'image est simplement étirée)
const _planHealing = new Map();
const _healTried = () => { try { return JSON.parse(localStorage.getItem('heal.tried') || '{}'); } catch (e) { return {}; } };
function planNeedsHeal(plan) { return !!(plan && plan.pdfFileId && !plan.imgV && !_healTried()[plan.id] && (Math.max(plan.w, plan.h) > PDF_MAXSIDE || plan.w * plan.h > PDF_MAXPX)); }
let _healQ = Promise.resolve();
async function planHeal(plan) {
  if (!planNeedsHeal(plan)) return false;
  if (_planHealing.has(plan.id)) return _planHealing.get(plan.id);
  // v1.0.48 : une seule tentative par plan (même en cas d'échec), un plan à la fois, lancée 4 s après l'ouverture (l'écran reste fluide)
  try { const T = _healTried(); T[plan.id] = Date.now(); localStorage.setItem('heal.tried', JSON.stringify(T)); } catch (e) {}
  const pr = (_healQ = _healQ.then(() => new Promise(r => setTimeout(r, 4000))).then(async () => {
    try {
      if (!(await pdfReadyA())) return false;
      const src = await DB.get('files', plan.pdfFileId), img = await DB.get('files', plan.fileId); if (!src || !src.blob || !img) return false;
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await src.blob.arrayBuffer()) }).promise;
      const page = await doc.getPage(plan.pdfPage || 1), r = await pdfPageToBlob(page);
      try { doc.destroy(); } catch (e) {}
      img.blob = r.blob; img.mime = 'image/jpeg'; img.w = r.w; img.h = r.h; BlobURL.drop(img.id); await DB.put('files', img);
      const pl = await DB.get('plans', plan.id) || plan; pl.imgV = 47; await DB.put('plans', pl); plan.imgV = 47;
      return true;
    } catch (e) { console.warn('heal', e); return false; } finally { _planHealing.delete(plan.id); }
  }));
  _planHealing.set(plan.id, pr); return pr;
}

// v1.0.54 : « Refaire l'image du plan » à la main (image coupée, moitié blanche) — depuis le PDF d'origine, par tuiles, coordonnées gardées
async function planRebuild(plan) {
  if (!plan || !plan.pdfFileId) { alertBox('Ce plan n\'a pas de PDF d\'origine sur le téléphone : réimportez-le (Mettre à jour le plan).'); return false; }
  const ld = loading('Image du plan refaite depuis le PDF…');
  try {
    if (!(await pdfReadyA())) throw new Error('lecteur PDF indisponible');
    const src = await DB.get('files', plan.pdfFileId), img = await DB.get('files', plan.fileId); if (!src || !src.blob || !img) throw new Error('PDF d\'origine introuvable');
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await src.blob.arrayBuffer()) }).promise;
    const page = await doc.getPage(plan.pdfPage || 1), r = await pdfPageToBlob(page); try { doc.destroy(); } catch (e) {}
    img.blob = r.blob; img.mime = 'image/jpeg'; img.w = r.w; img.h = r.h; BlobURL.drop(img.id); await DB.put('files', img);
    const pl = await DB.get('plans', plan.id) || plan; pl.imgV = 54; await DB.put('plans', pl); plan.imgV = 54;
    try { Object.keys(localStorage).filter(k => k.startsWith('th.' + plan.fileId)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    ld.close(); toast('Image du plan refaite ✓'); return true;
  } catch (e) { ld.close(); alertBox('Impossible : ' + (e.message || e)); return false; }
}

// Visionneuse photo plein écran
function showImage(src, caption = '') { return showGallery([{ src, caption }], 0); }
// Galerie plein écran façon téléphone : la photo suit le doigt, zoom à deux doigts / double appui, miniatures
function showGallery(items, start = 0, opts = {}) {
  items = items.filter(x => x && x.src);
  // v1.0.44 : suppression possible partout où la photo est un fichier de l'application
  document.querySelectorAll('.sheet-bg').forEach(x => x.classList.add('under-lb'));   // v1.0.54 : la galerie ouverte depuis une fiche passe devant elle (avant : visible seulement en fermant la fiche)
  if (!opts.onDelete && items.some(x => x.fileId) && typeof PhotoQ !== 'undefined') opts = { ...opts, onDelete: async (it) => { if (!it.fileId) { toast('Photo non supprimable ici'); return false; } return PhotoQ.remove([it.fileId], { ask: false }); } };
  if (!items.length) return;
  let i = Math.max(0, Math.min(start, items.length - 1)), dx = 0, zoom = 1, px = 0, py = 0;
  const el = document.createElement('div');
  el.className = 'lightbox gallery g2';
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('close')}</button><h1 class="gl-cap"></h1><span class="gl-n"></span>${items.some(x => x.fileId) ? `<button class="iconbtn" data-a="rotl" title="Tourner à gauche"><svg class="i" viewBox="0 0 24 24"><path d="M3 4v5h5"/><path d="M3.5 9a9 9 0 1 1-.3 5"/></svg></button><button class="iconbtn" data-a="rot" title="Tourner à droite"><svg class="i" viewBox="0 0 24 24"><path d="M21 4v5h-5"/><path d="M20.5 9a9 9 0 1 0 .3 5"/></svg></button>` : ''}${items.some(x => x.fileId) && typeof openPhotoStudio === 'function' ? '<button class="iconbtn" data-a="gfx" title="Améliorer la photo">✨</button>' : ''}${opts.onDelete ? `<button class="iconbtn" data-a="gdel" title="Supprimer">${icon('trash')}</button>` : ''}</div>
    <div class="g2-stage"><div class="g2-track"><div class="g2-s"><img draggable="false"></div><div class="g2-s"><img draggable="false"></div><div class="g2-s"><img draggable="false"></div></div></div>
    ${items.length > 1 ? `<div class="g2-strip">${items.map((it, k) => `<button data-k="${k}"><img data-k="${k}" alt=""></button>`).join('')}</div>` : ''}`;
  document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
  const gfx = $('[data-a=gfx]', el); if (gfx) gfx.onclick = async () => { const it = items[i]; if (!it || !it.fileId) return toast('Photo non modifiable ici'); const f = await DB.get('files', it.fileId); if (!f || !f.blob) return toast('Photo seulement dans Drive : ouvrez-la d\'abord');
    const b = await openPhotoStudio({ blob: f.blob, name: f.name, fileId: it.fileId }); if (b) { it.src = BlobURL.get(it.fileId, b); show(); } };
  const gd = $('[data-a=gdel]', el); if (gd) gd.onclick = async () => {
    if (!await confirmBox('Supprimer cette photo ?', 'Supprimer')) return;
    if (await opts.onDelete(items[i], i) === false) return;
    items.splice(i, 1); const sb = $(`.g2-strip button[data-k="${i}"]`, el); if (sb) sb.remove();
    $$('.g2-strip button', el).forEach((b, k) => { b.dataset.k = k; const im = $('img', b); if (im) im.dataset.k = k; });
    if (!items.length) { unBack(); el.remove(); return; } i = Math.min(i, items.length - 1); show(); toast('Photo supprimée');
  };
  const stage = $('.g2-stage', el), track = $('.g2-track', el), slides = $$('.g2-s', el), W = () => stage.clientWidth;
  const imgs = slides.map(sl => $('img', sl));
  const setT = (anim) => { track.style.transition = anim ? 'transform .22s ease-out' : 'none'; track.style.transform = `translate3d(${-W() + dx}px,0,0)`; };
  const applyZoom = (anim) => { const im = imgs[1]; im.style.transition = anim ? 'transform .2s' : 'none'; im.style.transform = `translate(${px}px,${py}px) scale(${zoom})`; };
  function show() {
    [-1, 0, 1].forEach((o, k) => { const it = items[i + o]; imgs[k].style.visibility = it ? 'visible' : 'hidden'; if (it && imgs[k].getAttribute('src') !== it.src) imgs[k].src = it.src; imgs[k].style.transform = ''; });
    zoom = 1; px = py = 0; dx = 0; setT(false);
    $('.gl-cap', el).textContent = items[i].caption || '';
    $('.gl-n', el).textContent = items.length > 1 ? `${i + 1} / ${items.length}` : '';
    $$('.g2-strip button', el).forEach((b, k) => b.classList.toggle('on', k === i));
    const on = $('.g2-strip button.on', el); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
  function go(dir) {
    if (!items[i + dir]) { dx = 0; return setT(true); }
    dx = -dir * W(); setT(true);
    setTimeout(() => { i += dir; show(); }, 220);
  }
  // gestes
  const pts = new Map(); let sx = 0, sy = 0, st = 0, d0 = 0, z0 = 1, lastTap = 0, mode = null, ppx = 0, ppy = 0;
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { sx = e.clientX; sy = e.clientY; st = Date.now(); ppx = px; ppy = py; mode = zoom > 1 ? 'pan' : null; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); z0 = zoom; mode = 'pinch'; dx = 0; setT(true); }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (mode === 'pinch' && pts.size === 2) { const [a, b] = [...pts.values()]; zoom = Math.max(1, Math.min(5, z0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / d0)); applyZoom(false); return; }
    const mx = e.clientX - sx, my = e.clientY - sy;
    if (mode === 'pan') { px = ppx + mx; py = ppy + my; applyZoom(false); return; }
    if (!mode && Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) mode = 'swipe';
    if (mode === 'swipe') { dx = mx * ((mx > 0 && !items[i - 1]) || (mx < 0 && !items[i + 1]) ? 0.3 : 1); setT(false); }
  });
  const up = (e) => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (pts.size) return;
    if (mode === 'swipe') { const v = dx / Math.max(1, Date.now() - st); if (dx < -W() * 0.22 || v < -0.45) go(1); else if (dx > W() * 0.22 || v > 0.45) go(-1); else { dx = 0; setT(true); } }
    else if (mode === 'pinch') { if (zoom < 1.05) { zoom = 1; px = py = 0; applyZoom(true); } }
    else if (!mode || (mode === 'pan' && Math.hypot(e.clientX - sx, e.clientY - sy) < 8)) {
      if (Date.now() - lastTap < 300) { if (zoom > 1) { zoom = 1; px = py = 0; } else zoom = 2.5; applyZoom(true); lastTap = 0; } else lastTap = Date.now();
    }
    mode = null;
  };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  $$('.g2-strip button', el).forEach(b => b.onclick = () => { i = +b.dataset.k; show(); });
  $$('.g2-strip img', el).forEach(im => { const it = items[+im.dataset.k]; if (it.fileId && window.Thumbs) Thumbs.get(it.fileId).then(u => { im.src = u || it.src; }); else im.src = it.src; });
  // rotation instantanée à l'écran, enregistrée en arrière-plan (plusieurs appuis = une seule opération)
  const rotPend = new Map();
  const rot = (d) => {
    const it = items[i]; if (!it || !it.fileId) return;
    const n = (rotPend.get(it) || { q: 0, t: 0 }); n.q += d; rotPend.set(it, n);
    imgs[1].style.transition = 'transform .25s ease'; imgs[1].style.transform = `rotate(${n.q * 90}deg)`;
    const th = $(`.g2-strip img[data-k="${i}"]`, el); if (th) { th.style.transition = 'transform .25s'; th.style.transform = `rotate(${n.q * 90}deg)`; }
    clearTimeout(n.t); n.t = setTimeout(async () => { const q = n.q; rotPend.delete(it); const url = await rotateFile(it.fileId, q); if (!url) return; it.src = url;
      const k = items.indexOf(it); if (k === i) { imgs[1].style.transition = 'none'; imgs[1].style.transform = ''; imgs[1].src = url; }
      const t2 = $(`.g2-strip img[data-k="${k}"]`, el); if (t2) { t2.style.transition = 'none'; t2.style.transform = ''; t2.src = url; } }, 700);
  };
  const rb = $('[data-a=rot]', el); if (rb) rb.onclick = () => rot(1);
  const rl = $('[data-a=rotl]', el); if (rl) rl.onclick = () => rot(-1);
  window.addEventListener('resize', () => setT(false));
  show();
}

// Visionneuse PDF (pages rendues avec pdf.js)
// Texte d'un PDF (normalisé sans accents) : recherche dans les cahiers et dans le lecteur
const normTxt = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
async function pdfPagesText(pdf, onProg) {
  const out = [];
  for (let p = 1; p <= pdf.numPages; p++) { try { const tc = await (await pdf.getPage(p)).getTextContent(); out.push(tc.items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ')); } catch (e) { out.push(''); } if (onProg) onProg(p, pdf.numPages); }
  return out;
}
// opts : { page: n (ouvrir à cette page), q: 'mot' (surligner + recherche) }
async function showPdf(blob, caption = 'PDF', opts = {}) {
  if (!(await pdfReadyA())) { toast('Lecteur PDF non disponible'); return; }
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="x">${icon('close')}</button><h1>${esc(caption)}</h1><button class="iconbtn" data-a="find">${icon('search')}</button></div>
    <div class="pdf-find" style="display:none"><input placeholder="Rechercher dans le document…"><span data-fc></span><button data-a="prev">‹</button><button data-a="next">›</button></div>
    <div class="pdf-pages"><div class="pdf-zoom"></div></div><div class="pdf-ind"><span data-pg></span><button data-a="fit">⤢</button></div>`;
  document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  $('[data-a=x]', el).onclick = () => { unBack(); el.remove(); };
  const scroller = $('.pdf-pages', el), box = $('.pdf-zoom', el);
  let zk = 1, pinch = null, lastTap = 0, nPages = 0;
  const setZoom = (nk, mx, my) => {
    nk = Math.max(1, Math.min(5, nk)); const r = scroller.getBoundingClientRect(); mx = mx ?? r.width / 2; my = my ?? r.height / 2;
    const cx = (scroller.scrollLeft + mx) / zk, cy = (scroller.scrollTop + my) / zk; zk = nk; box.style.width = (zk * 100) + '%';
    scroller.scrollLeft = cx * zk - mx; scroller.scrollTop = cy * zk - my; $('[data-a=fit]', el).style.display = zk > 1.02 ? '' : 'none';
  };
  scroller.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) { const [a, b] = e.touches, r = scroller.getBoundingClientRect(); pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), k: zk, mx: (a.clientX + b.clientX) / 2 - r.left, my: (a.clientY + b.clientY) / 2 - r.top }; }
    else if (e.touches.length === 1) { const now = Date.now(); if (now - lastTap < 280) { const r = scroller.getBoundingClientRect(), t = e.touches[0]; setZoom(zk > 1.3 ? 1 : 2.5, t.clientX - r.left, t.clientY - r.top); lastTap = 0; } else lastTap = now; }
  }, { passive: true });
  scroller.addEventListener('touchmove', (e) => { if (!pinch || e.touches.length !== 2) return; e.preventDefault(); const [a, b] = e.touches; setZoom(pinch.k * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d, pinch.mx, pinch.my); }, { passive: false });
  scroller.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = null; }, { passive: true });
  scroller.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); const r = scroller.getBoundingClientRect(); setZoom(zk * (e.deltaY < 0 ? 1.15 : 0.87), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  $('[data-a=fit]', el).onclick = () => setZoom(1); $('[data-a=fit]', el).style.display = 'none';
  const cs = () => [...box.querySelectorAll('canvas')];
  const pgInd = () => { const c = cs(); if (!c.length) return; const mid = scroller.scrollTop + scroller.clientHeight / 3; let n = 1; c.forEach((x, j) => { if (x.offsetTop <= mid) n = j + 1; }); $('[data-pg]', el).textContent = `Page ${n} / ${nPages}`; };
  scroller.addEventListener('scroll', pgInd, { passive: true });
  let pdf, q = normTxt(opts.q || ''), texts = null;
  const goPage = (n) => { const c = cs()[n - 1]; if (c) scroller.scrollTop = c.offsetTop - 6; pgInd(); };
  // rendu à la demande (les pages visibles d'abord) → on peut sauter direct à la page 150
  const render = async (c, force) => {
    if (c._r && !force) return; c._r = true; const n = +c.dataset.p;
    const page = await pdf.getPage(n), vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: Math.min(3, (window.innerWidth * 2) / vp1.width) });
    c.width = vp.width; c.height = vp.height; const g = c.getContext('2d');
    await page.render({ canvasContext: g, viewport: vp }).promise;
    if (q) { try { const tc = await page.getTextContent(); g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(255,214,0,.55)';
      for (const it of tc.items) { if (!normTxt(it.str).includes(q)) continue; const t = pdfjsLib.Util.transform(vp.transform, it.transform), h = Math.hypot(t[2], t[3]); g.fillRect(t[4], t[5] - h, it.width * vp.scale, h * 1.15); }
      g.restore(); } catch (e) {} }
  };
  const io = new IntersectionObserver((en) => en.forEach(e => { if (e.isIntersecting) render(e.target); }), { root: scroller, rootMargin: '600px 0px' });
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    nPages = pdf.numPages; const v1 = (await pdf.getPage(1)).getViewport({ scale: 1 });
    for (let p = 1; p <= nPages; p++) { const c = document.createElement('canvas'); c.dataset.p = p; c.width = 600; c.height = Math.round(600 * v1.height / v1.width); box.appendChild(c); io.observe(c); }
    if (opts.page > 1) { await render(cs()[opts.page - 1]); requestAnimationFrame(() => goPage(opts.page)); }
    pgInd();
  } catch (e) { box.innerHTML = `<div class="empty">Impossible d'ouvrir ce PDF</div>`; return; }
  // recherche dans le document
  const fb = $('.pdf-find', el), fi = $('input', fb); let hits = [], hi = 0;
  const show = () => { $('[data-fc]', fb).textContent = q ? (hits.length ? `${hi + 1}/${hits.length}` : '0') : ''; if (hits.length) goPage(hits[hi]); };
  const find = async () => {
    q = normTxt(fi.value.trim()); hits = []; hi = 0;
    cs().forEach(c => { if (c._r) { c._r = false; } }); cs().forEach(c => { const r = c.getBoundingClientRect(); if (r.bottom > -600 && r.top < innerHeight + 600) render(c); });
    if (!q) return show();
    if (!texts) { $('[data-fc]', fb).textContent = '…'; texts = (await pdfPagesText(pdf)).map(normTxt); }
    hits = texts.map((t, i) => t.includes(q) ? i + 1 : 0).filter(Boolean); show();
  };
  $('[data-a=find]', el).onclick = () => { fb.style.display = fb.style.display === 'none' ? '' : 'none'; if (fb.style.display === '') fi.focus(); };
  fi.onkeydown = (e) => { if (e.key === 'Enter') find(); }; let ft; fi.oninput = () => { clearTimeout(ft); ft = setTimeout(find, 500); };
  $('[data-a=next]', fb).onclick = () => { if (hits.length) { hi = (hi + 1) % hits.length; show(); } };
  $('[data-a=prev]', fb).onclick = () => { if (hits.length) { hi = (hi - 1 + hits.length) % hits.length; show(); } };
  if (opts.q) { fb.style.display = ''; fi.value = opts.q; find().then(() => { if (opts.page) { const k = hits.indexOf(opts.page); if (k >= 0) { hi = k; show(); } } }); }
}

// Ouvre un lien (Google Drive, etc.) dans le navigateur du téléphone
function openUrl(url) {
  if (!/^(https?|mailto|tel|sms|whatsapp|intent|geo):/i.test(url)) url = 'https://' + url;
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
async function rotateFile(id, quarter = 1) {   // quarter : +1 = droite, -1 = gauche (cumulable)
  const q = ((quarter % 4) + 4) % 4; if (!q) return '';
  const f = await DB.get('files', id); if (!f || !f.blob) return '';
  const bmp = await createImageBitmap(f.blob), sw = q % 2 === 1;
  const c = document.createElement('canvas'); c.width = sw ? bmp.height : bmp.width; c.height = sw ? bmp.width : bmp.height;
  const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate(q * Math.PI / 2); g.drawImage(bmp, -bmp.width / 2, -bmp.height / 2); bmp.close && bmp.close();
  f.blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9)); f.mime = 'image/jpeg'; f.w = c.width; f.h = c.height; c.width = c.height = 0;
  f.driveId = null; f.drivePath = null;
  BlobURL.drop(id); if (window.Thumbs) Thumbs.drop(id);
  await DB.put('files', f);
  return BlobURL.get(f.id, f.blob);
}

// ✕ dans toutes les barres de recherche (efface tout le texte d'un appui)
(function searchClear() {
  const add = (root) => {
    if (!root || !root.querySelectorAll) return;
    const list = root.matches && root.matches('.search') ? [root] : root.querySelectorAll('.search');
    list.forEach(s => {
      const i = s.querySelector('input'); if (!i || s.querySelector('.sx')) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'sx'; b.setAttribute('aria-label', 'Effacer'); b.innerHTML = icon('close');
      const upd = () => s.classList.toggle('has-v', !!i.value);
      b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); upd(); const n = s.querySelector('input'); if (n) n.focus(); };
      i.addEventListener('input', upd); s.appendChild(b); upd();
    });
  };
  const start = () => { add(document.body); new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) add(n); }))).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

// Logo d'origine de SiteTeam (le même que l'icône et l'écran d'ouverture) : cercle bleu, casque, équipe
let _stlN = 0;
function stLogo(cls = '') {
  const q = 'stl' + (++_stlN);   // identifiants uniques : un dégradé caché (display:none) ne doit pas servir aux autres logos
  // v1.0.44 : logo vectoriel soigné (dégradés, reflet, ombre douce) — même dessin que l'écran de démarrage
  return `<svg class="st-logo ${cls}" viewBox="182 182 660 660" aria-label="SiteTeam" role="img"><defs><radialGradient id="${q}c" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#5b9cff"/><stop offset=".55" stop-color="#2563eb"/><stop offset="1" stop-color="#1e3a8a"/></radialGradient><linearGradient id="${q}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e8f0ff"/><stop offset="1" stop-color="#c7d8fb"/></linearGradient><linearGradient id="${q}gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><linearGradient id="${q}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fcd34d"/><stop offset="1" stop-color="#ea8a0c"/></linearGradient><linearGradient id="${q}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ee7a0"/><stop offset="1" stop-color="#15a34a"/></linearGradient><linearGradient id="${q}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#93dcff"/><stop offset="1" stop-color="#0b84d0"/></linearGradient><filter id="${q}f" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#0b1f4d" flood-opacity=".35"/></filter></defs><circle cx="512" cy="512" r="330" fill="url(#${q}c)"/><circle cx="512" cy="512" r="318" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="5"/><ellipse cx="490" cy="335" rx="190" ry="100" fill="url(#${q}gl)"/><g filter="url(#${q}f)" fill="url(#${q}h)" class="cap"><path d="M315 530A200 180 0 0 1 490 353V540H315Z"/><path d="M535 353A200 180 0 0 1 710 530H535Z"/><rect x="252" y="528" width="520" height="58" rx="29"/></g><path d="M340 500A170 150 0 0 1 470 378" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-opacity=".9"/><g filter="url(#${q}f)"><circle cx="412" cy="650" r="31" fill="url(#${q}a)"/><path d="M360 743A52 52 0 0 1 464 743Z" fill="url(#${q}a)"/><circle cx="512" cy="650" r="31" fill="url(#${q}b)"/><path d="M460 743A52 52 0 0 1 564 743Z" fill="url(#${q}b)"/><circle cx="612" cy="650" r="31" fill="url(#${q}s)"/><path d="M560 743A52 52 0 0 1 664 743Z" fill="url(#${q}s)"/></g></svg>`;
}
