// Calculs de chantier & topographie : métré (volumes / surfaces multiples), béton, acier,
// calculatrice, pente, nivellement, coordonnées (distance, gisement, implantation, surface).
// Les listes sont enregistrées dans le projet (project.calc) → synchronisées avec Drive.

const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : 0; };
const fmtN = (n, d = 2) => (isFinite(n) ? n : 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const GON = 200 / Math.PI;
const gis = (x1, y1, x2, y2) => { let g = Math.atan2(x2 - x1, y2 - y1) * GON; if (g < 0) g += 400; return g; };   // gisement topo (depuis le Nord, sens horaire, en grades)

const CALC_TOOLS = [
  { k: 'metre', t: 'Métré', s: 'Volumes, surfaces, longueurs — plusieurs à la fois', ic: 'box', c: '#4f8ef7' },
  { k: 'beton', t: 'Béton', s: 'Ciment, sable, gravier, eau, toupies', ic: 'layers', c: '#22c55e' },
  { k: 'acier', t: 'Acier', s: 'Poids des armatures par diamètre', ic: 'rows', c: '#f59e0b' },
  { k: 'calc', t: 'Calculatrice', s: 'Calculs rapides', ic: 'grid', c: '#a855f7' },
  { k: 'pente', t: 'Pente', s: '% · degrés · dénivelé', ic: 'line', c: '#06b6d4' },
  { k: 'niv', t: 'Nivellement', s: 'Lectures AR / AV → altitudes', ic: 'ruler', c: '#ef4444' },
  { k: 'pts', t: 'Coordonnées', s: 'Distance, gisement, implantation, surface', ic: 'pin', c: '#eab308' },
  { k: 'conv', t: 'Angles', s: 'Grades ⇄ degrés ⇄ radians', ic: 'disc', c: '#64748b' },
];

async function renderCalcs(root) {
  root.innerHTML = `<div class="pagehead"><h2>Calculs & Topo</h2><p>Outils de chantier — résultats enregistrés dans le projet</p></div>
    <div class="ct-grid">${CALC_TOOLS.map(t => `<button class="ct-card" data-k="${t.k}" style="--c:${t.c}"><span class="ct-ic">${icon(t.ic)}</span><b>${t.t}</b><small>${t.s}</small></button>`).join('')}</div>`;
  $$('[data-k]', root).forEach(b => b.onclick = () => openCalcTool(b.dataset.k));
}

async function openCalcTool(k) {
  const tool = CALC_TOOLS.find(t => t.k === k);
  const el = document.createElement('div'); el.className = 'fullpage calcpage'; document.body.appendChild(el);
  const unBack = pushBack(() => el.remove());
  el.innerHTML = `<div class="topbar dark"><button class="iconbtn" data-a="back">${icon('back')}</button><h1 style="flex:1">${tool.t}</h1><span class="ct-tools"></span></div><div class="calc-body"></div>`;
  $('[data-a=back]', el).onclick = () => { unBack(); el.remove(); };
  const body = $('.calc-body', el), tb = $('.ct-tools', el);
  let project = App.project ? await DB.get('projects', App.project.id) : null;
  const store = () => { if (!project) return {}; project.calc = project.calc || {}; return project.calc; };
  let saveT = null;
  const persist = () => { if (!project) return; clearTimeout(saveT); saveT = setTimeout(async () => { const cur = await DB.get('projects', project.id); cur.calc = project.calc; await DB.put('projects', cur); project = cur; }, 400); };
  const share = (text) => { tb.innerHTML = `<button class="iconbtn" data-a="sh">${icon('share')}</button>`; $('[data-a=sh]', tb).onclick = () => shareText(text()); };
  const TOOLS = { metre, beton, acier, calc, pente, niv, pts, conv };
  TOOLS[k]();

  // ---------- Métré ----------
  function metre() {
    const S = store(); S.metre = S.metre || [{ id: DB.uid(), des: '', shape: 'rect', a: '', b: '', c: '', n: '1' }];
    const SH = { rect: ['Pavé (L × l × h)', 'm³', ['L (m)', 'l (m)', 'h (m)']], cyl: ['Cylindre (Ø × h)', 'm³', ['Ø (m)', 'h (m)']], tri: ['Prisme triangle (b × h × L)', 'm³', ['base (m)', 'haut. (m)', 'L (m)']], surf: ['Surface (L × l)', 'm²', ['L (m)', 'l (m)']], lin: ['Longueur', 'ml', ['L (m)']], free: ['Valeur libre', 'u', ['quantité']] };
    const val = (r) => { const a = num(r.a), b = num(r.b), c = num(r.c), n = num(r.n || 1);
      return n * ({ rect: a * b * c, cyl: Math.PI * (a / 2) ** 2 * b, tri: a * b / 2 * c, surf: a * b, lin: a, free: a }[r.shape] || 0); };
    const unit = (r) => r.shape === 'free' ? (r.u || 'u') : SH[r.shape][1];
    const totals = () => { const t = {}; for (const r of S.metre) t[unit(r)] = (t[unit(r)] || 0) + val(r); return t; };
    const text = () => `*Métré${project ? ' — ' + project.name : ''}*\n` + S.metre.filter(r => val(r)).map(r => `• ${r.des || SH[r.shape][0]} : ${fmtN(val(r), 3)} ${unit(r)}${num(r.n) > 1 ? ` (×${r.n})` : ''}`).join('\n') + '\n\n*Total :* ' + Object.entries(totals()).filter(([, v]) => v).map(([u, v]) => `${fmtN(v, 3)} ${u}`).join(' · ');
    share(text);
    function draw() {
      body.innerHTML = `<div class="mt-list">${S.metre.map((r, i) => `<div class="mt-row" data-i="${i}">
          <div class="mt-top"><input class="mt-des" data-f="des" value="${esc(r.des)}" placeholder="Désignation (ex : Voile CR 75)">
            <button class="iconbtn sm" data-del="${i}">${icon('trash')}</button></div>
          <div class="mt-shape"><select data-f="shape">${Object.entries(SH).map(([k2, v]) => `<option value="${k2}" ${r.shape === k2 ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
          <div class="mt-in">${SH[r.shape][2].map((lb, j) => `<label><small>${lb}</small><input inputmode="decimal" data-f="${'abc'[j]}" value="${esc(r['abc'[j]] || '')}"></label>`).join('')}
            ${r.shape === 'free' ? `<label><small>unité</small><input data-f="u" value="${esc(r.u || '')}" placeholder="u"></label>` : ''}
            <label class="nb"><small>Nb</small><input inputmode="decimal" data-f="n" value="${esc(r.n || '1')}"></label></div>
          <div class="mt-res"><span>${SH[r.shape][0].split(' (')[0]}</span><b data-res>${fmtN(val(r), 3)} ${unit(r)}</b></div>
        </div>`).join('')}</div>
        <button class="btn ghost" data-a="add" style="width:100%">${icon('plus')} Ajouter une ligne</button>
        <div class="mt-total" data-tot></div>
        <button class="btn" data-a="tobeton" style="width:100%;margin-top:10px">${icon('layers')} Calculer le béton pour le volume total</button>
        <button class="btn ghost danger-t" data-a="clear" style="width:100%;margin-top:8px">Tout effacer</button>`;
      const upTot = () => { $('[data-tot]', body).innerHTML = Object.entries(totals()).filter(([, v]) => v).map(([u, v]) => `<div><span>Total ${u}</span><b>${fmtN(v, 3)} ${u}</b></div>`).join('') || '<div><span>Total</span><b>0</b></div>'; };
      $$('.mt-row', body).forEach(rowEl => {
        const r = S.metre[+rowEl.dataset.i];
        $$('[data-f]', rowEl).forEach(inp => {
          const ev = inp.tagName === 'SELECT' ? 'onchange' : 'oninput';
          inp[ev] = () => { r[inp.dataset.f] = inp.value; persist(); if (inp.dataset.f === 'shape') return draw(); $('[data-res]', rowEl).textContent = `${fmtN(val(r), 3)} ${unit(r)}`; upTot(); };
        });
      });
      $$('[data-del]', body).forEach(b => b.onclick = () => { S.metre.splice(+b.dataset.del, 1); if (!S.metre.length) S.metre.push({ id: DB.uid(), des: '', shape: 'rect', n: '1' }); persist(); draw(); });
      $('[data-a=add]', body).onclick = () => { const l = S.metre[S.metre.length - 1] || {}; S.metre.push({ id: DB.uid(), des: '', shape: l.shape || 'rect', a: '', b: '', c: '', n: '1' }); persist(); draw(); setTimeout(() => $$('.mt-des', body).pop()?.focus(), 50); };
      $('[data-a=clear]', body).onclick = async () => { if (await confirmBox('Effacer toutes les lignes du métré ?')) { S.metre = [{ id: DB.uid(), des: '', shape: 'rect', n: '1' }]; persist(); draw(); } };
      $('[data-a=tobeton]', body).onclick = () => { App._calcVol = String(+(totals()['m³'] || 0).toFixed(3)).replace('.', ','); unBack(); el.remove(); openCalcTool('beton'); };
      upTot();
    }
    draw();
  }

  // ---------- Béton ----------
  function beton() {
    const S = store(); S.beton = { vol: '', dos: '350', sac: '50', perte: '5', toupie: '8', ...(S.beton || {}) };
    const B = S.beton;
    if (App._calcVol != null) { B.vol = App._calcVol; App._calcVol = null; persist(); }
    const DOS = [['150', 'Béton de propreté'], ['250', 'Béton non armé'], ['300', 'Béton armé courant'], ['350', 'Béton armé (B25-B30)'], ['400', 'Béton haute résistance']];
    const res = () => { const v = num(B.vol) * (1 + num(B.perte) / 100), c = v * num(B.dos);
      return { v, ciment: c, sacs: Math.ceil(c / (num(B.sac) || 50)), sable: v * 0.4, gravier: v * 0.8, eau: v * 175, toupies: Math.ceil(v / (num(B.toupie) || 8)) }; };
    const text = () => { const r = res(); return `*Béton${project ? ' — ' + project.name : ''}*\nVolume : ${fmtN(num(B.vol), 3)} m³ (+${B.perte}% pertes = ${fmtN(r.v, 3)} m³)\nDosage : ${B.dos} kg/m³\n• Ciment : ${fmtN(r.ciment, 0)} kg = ${r.sacs} sacs de ${B.sac} kg\n• Sable : ${fmtN(r.sable, 2)} m³\n• Gravier : ${fmtN(r.gravier, 2)} m³\n• Eau : ${fmtN(r.eau, 0)} L\n• Toupies (${B.toupie} m³) : ${r.toupies}`; };
    share(text);
    body.innerHTML = `<div class="cform">
      <label><small>Volume de béton (m³)</small><input inputmode="decimal" data-f="vol" value="${esc(B.vol)}" placeholder="ex : 12,5"></label>
      <label><small>Dosage ciment (kg/m³)</small><select data-f="dos">${DOS.map(([v, l]) => `<option value="${v}" ${B.dos === v ? 'selected' : ''}>${v} — ${l}</option>`).join('')}</select></label>
      <div class="c3"><label><small>Sac (kg)</small><input inputmode="decimal" data-f="sac" value="${esc(B.sac)}"></label>
        <label><small>Pertes %</small><input inputmode="decimal" data-f="perte" value="${esc(B.perte)}"></label>
        <label><small>Toupie m³</small><input inputmode="decimal" data-f="toupie" value="${esc(B.toupie)}"></label></div>
    </div><div class="cres" data-res></div>
    <p class="muted" style="font-size:12.5px;padding:0 4px">Valeurs indicatives (béton courant : 400 L de sable et 800 L de gravier par m³, E/C ≈ 0,5).</p>`;
    const up = () => { const r = res(); $('[data-res]', body).innerHTML = `
      <div class="big"><span>Ciment</span><b>${r.sacs} sacs</b><small>${fmtN(r.ciment, 0)} kg</small></div>
      <div><span>Sable</span><b>${fmtN(r.sable, 2)} m³</b></div><div><span>Gravier</span><b>${fmtN(r.gravier, 2)} m³</b></div>
      <div><span>Eau</span><b>${fmtN(r.eau, 0)} L</b></div><div><span>Toupies</span><b>${r.toupies}</b></div>`; };
    $$('[data-f]', body).forEach(i => i[i.tagName === 'SELECT' ? 'onchange' : 'oninput'] = () => { B[i.dataset.f] = i.value; persist(); up(); });
    up();
  }

  // ---------- Acier ----------
  function acier() {
    const S = store(); S.acier = S.acier || [{ id: DB.uid(), des: '', d: '12', n: '', l: '' }]; S.chute = S.chute ?? '5';
    const DS = ['6', '8', '10', '12', '14', '16', '20', '25', '32', '40'];
    const kgm = (d) => num(d) ** 2 * 0.00617;
    const kg = (r) => num(r.n) * num(r.l) * kgm(r.d);
    const tot = () => S.acier.reduce((a, r) => a + kg(r), 0) * (1 + num(S.chute) / 100);
    const text = () => `*Acier${project ? ' — ' + project.name : ''}*\n` + S.acier.filter(kg).map(r => `• ${r.des ? r.des + ' : ' : ''}${r.n} HA${r.d} × ${r.l} m = ${fmtN(kg(r), 1)} kg`).join('\n') + `\n\n*Total (+${S.chute}% chutes) : ${fmtN(tot(), 1)} kg = ${fmtN(tot() / 1000, 3)} t*`;
    share(text);
    function draw() {
      body.innerHTML = `<div class="mt-list">${S.acier.map((r, i) => `<div class="mt-row" data-i="${i}">
          <div class="mt-top"><input class="mt-des" data-f="des" value="${esc(r.des)}" placeholder="Désignation (ex : Poteaux P1-P8)"><button class="iconbtn sm" data-del="${i}">${icon('trash')}</button></div>
          <div class="mt-in"><label><small>Ø (mm)</small><select data-f="d">${DS.map(d => `<option ${r.d === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
            <label><small>Nb barres</small><input inputmode="decimal" data-f="n" value="${esc(r.n)}"></label>
            <label><small>Long. (m)</small><input inputmode="decimal" data-f="l" value="${esc(r.l)}"></label></div>
          <div class="mt-res"><span>${fmtN(kgm(r.d), 3)} kg/m</span><b data-res>${fmtN(kg(r), 1)} kg</b></div></div>`).join('')}</div>
        <button class="btn ghost" data-a="add" style="width:100%">${icon('plus')} Ajouter une ligne</button>
        <div class="cform" style="margin-top:10px"><label><small>Chutes / recouvrements (%)</small><input inputmode="decimal" data-g="chute" value="${esc(S.chute)}"></label></div>
        <div class="mt-total" data-tot></div>
        <div class="ref-t"><b>Poids par mètre</b>${DS.map(d => `<span>HA${d} <i>${fmtN(kgm(d), 3)}</i></span>`).join('')}</div>`;
      const upT = () => { $('[data-tot]', body).innerHTML = `<div><span>Total</span><b>${fmtN(tot(), 1)} kg</b></div><div><span>Tonnes</span><b>${fmtN(tot() / 1000, 3)} t</b></div>`; };
      $$('.mt-row', body).forEach(rowEl => { const r = S.acier[+rowEl.dataset.i];
        $$('[data-f]', rowEl).forEach(i => i[i.tagName === 'SELECT' ? 'onchange' : 'oninput'] = () => { r[i.dataset.f] = i.value; persist(); $('[data-res]', rowEl).textContent = `${fmtN(kg(r), 1)} kg`; $('.mt-res span', rowEl).textContent = `${fmtN(kgm(r.d), 3)} kg/m`; upT(); }); });
      $('[data-g=chute]', body).oninput = (e) => { S.chute = e.target.value; persist(); upT(); };
      $$('[data-del]', body).forEach(b => b.onclick = () => { S.acier.splice(+b.dataset.del, 1); if (!S.acier.length) S.acier.push({ id: DB.uid(), d: '12' }); persist(); draw(); });
      $('[data-a=add]', body).onclick = () => { S.acier.push({ id: DB.uid(), des: '', d: (S.acier[S.acier.length - 1] || {}).d || '12', n: '', l: '' }); persist(); draw(); };
      upT();
    }
    draw();
  }

  // ---------- Calculatrice ----------
  function calc() {
    let expr = '', hist = [];
    body.innerHTML = `<div class="kc"><div class="kc-hist"></div><div class="kc-expr">0</div><div class="kc-res"></div>
      <div class="kc-keys">${['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', ',', '⌫', '='].map(k => `<button data-k="${k}" class="${/[÷×−+=]/.test(k) ? 'op' : k === 'C' ? 'clr' : ''}">${k}</button>`).join('')}</div>
      <div class="kc-fx">${['√', 'x²', 'π', '%'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div></div>`;
    const ev = (s) => { const js = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.').replace(/π/g, '(' + Math.PI + ')').replace(/√\(/g, 'Math.sqrt(').replace(/\^2/g, '**2');
      if (!/^[\d.+\-*/()\sMathsqrt*]*$/.test(js)) return NaN; try { return Function('"use strict";return (' + js + ')')(); } catch (e) { return NaN; } };
    const show = () => { $('.kc-expr', body).textContent = expr || '0'; const v = ev(expr); $('.kc-res', body).textContent = expr && isFinite(v) ? '= ' + fmtN(v, 6).replace(/,?0+$/, '') : ''; $('.kc-hist', body).innerHTML = hist.slice(-4).map(h => `<div>${esc(h)}</div>`).join(''); };
    $$('[data-k]', body).forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (k === 'C') expr = ''; else if (k === '⌫') expr = expr.slice(0, -1);
      else if (k === '=') { const v = ev(expr); if (isFinite(v)) { hist.push(`${expr} = ${fmtN(v, 6).replace(/,?0+$/, '')}`); expr = String(+v.toFixed(10)).replace('.', ','); } }
      else if (k === '√') expr += '√('; else if (k === 'x²') expr += '^2'; else if (k === '%') expr += '÷100';
      else expr += k;
      show();
    });
    show();
  }

  // ---------- Pente ----------
  function pente() {
    const S = store(); S.pente = { dz: '', l: '', p: '', ...(S.pente || {}) }; const P = S.pente;
    body.innerHTML = `<div class="ctabs"><button data-m="1" class="on">Dénivelé + longueur</button><button data-m="2">Pente % + longueur</button></div>
      <div class="cform" data-m1><label><small>Dénivelé ΔH (m)</small><input inputmode="decimal" data-f="dz" value="${esc(P.dz)}"></label><label><small>Longueur horizontale (m)</small><input inputmode="decimal" data-f="l" value="${esc(P.l)}"></label></div>
      <div class="cform" data-m2 style="display:none"><label><small>Pente (%)</small><input inputmode="decimal" data-f="p" value="${esc(P.p)}"></label><label><small>Longueur horizontale (m)</small><input inputmode="decimal" data-f="l2" value="${esc(P.l)}"></label></div>
      <div class="cres" data-res></div>`;
    let m = 1;
    const up = () => { let dz, l = num(P.l), p;
      if (m === 1) { dz = num(P.dz); p = l ? dz / l * 100 : 0; } else { p = num(P.p); dz = l * p / 100; }
      const deg = Math.atan(p / 100) * 180 / Math.PI;
      $('[data-res]', body).innerHTML = `<div class="big"><span>Pente</span><b>${fmtN(p, 2)} %</b><small>${fmtN(deg, 2)}° · ${fmtN(deg / 0.9, 2)} gr</small></div>
        <div><span>Dénivelé</span><b>${fmtN(dz, 3)} m</b></div><div><span>Longueur en pente</span><b>${fmtN(Math.hypot(l, dz), 3)} m</b></div><div><span>Ratio</span><b>${p ? '1/' + fmtN(100 / Math.abs(p), 1) : '—'}</b></div>`; };
    $$('[data-m]', body).forEach(b => b.onclick = () => { m = +b.dataset.m; $$('[data-m]', body).forEach(x => x.classList.toggle('on', x === b)); $('[data-m1]', body).style.display = m === 1 ? '' : 'none'; $('[data-m2]', body).style.display = m === 2 ? '' : 'none'; up(); });
    $$('[data-f]', body).forEach(i => i.oninput = () => { const f = i.dataset.f === 'l2' ? 'l' : i.dataset.f; P[f] = i.value; persist(); up(); });
    up();
  }

  // ---------- Nivellement ----------
  function niv() {
    const S = store(); S.niv = S.niv || { z0: '', zEnd: '', rows: [{ pt: 'Repère', ar: '', av: '' }, { pt: '', ar: '', av: '' }] }; const N = S.niv;
    const compute = () => { let hi = null; const out = [];
      N.rows.forEach((r, i) => { let z = null;
        if (i === 0) z = num(N.z0); else if (hi != null && r.av !== '') z = hi - num(r.av);
        if (z != null && r.ar !== '') hi = z + num(r.ar);
        out.push({ z, hi }); });
      return out; };
    const text = () => { const c = compute(); return `*Nivellement${project ? ' — ' + project.name : ''}*\n` + N.rows.map((r, i) => `${r.pt || 'P' + i} : ${c[i].z != null ? fmtN(c[i].z, 3) + ' m' : '—'}`).join('\n'); };
    share(text);
    function draw() {
      const c = compute();
      const last = c[c.length - 1]?.z;
      body.innerHTML = `<div class="cform"><div class="c2"><label><small>Altitude du repère (m)</small><input inputmode="decimal" data-g="z0" value="${esc(N.z0)}"></label>
          <label><small>Altitude d'arrivée connue (option)</small><input inputmode="decimal" data-g="zEnd" value="${esc(N.zEnd)}"></label></div></div>
        <div class="nv-head"><span>Point</span><span>Lect. AR</span><span>Lect. AV</span><span>Altitude</span><span></span></div>
        ${N.rows.map((r, i) => `<div class="nv-row" data-i="${i}"><input data-f="pt" value="${esc(r.pt)}" placeholder="P${i}"><input inputmode="decimal" data-f="ar" value="${esc(r.ar)}" placeholder="—"><input inputmode="decimal" data-f="av" value="${esc(r.av)}" placeholder="${i ? '' : '—'}" ${i ? '' : 'disabled'}><b>${c[i].z != null ? fmtN(c[i].z, 3) : '—'}</b><button class="iconbtn sm" data-del="${i}">${i ? icon('close') : ''}</button></div>`).join('')}
        <button class="btn ghost" data-a="add" style="width:100%;margin-top:8px">${icon('plus')} Ajouter un point</button>
        ${N.zEnd !== '' && last != null ? `<div class="cres"><div class="big"><span>Écart de fermeture</span><b>${fmtN((last - num(N.zEnd)) * 1000, 0)} mm</b></div></div>` : ''}
        <p class="muted" style="font-size:12.5px;line-height:1.5;padding:0 4px">AR = lecture arrière (sur point connu), AV = lecture avant. Point de changement : remplir AV puis AR sur la même ligne. Lectures en mètres.</p>`;
      $$('[data-g]', body).forEach(i => i.onchange = () => { N[i.dataset.g] = i.value; persist(); draw(); });
      $$('.nv-row', body).forEach(rowEl => { const r = N.rows[+rowEl.dataset.i]; $$('[data-f]', rowEl).forEach(i => i.onchange = () => { r[i.dataset.f] = i.value; persist(); draw(); }); });
      $$('[data-del]', body).forEach(b => b.onclick = () => { const i = +b.dataset.del; if (i) { N.rows.splice(i, 1); persist(); draw(); } });
      $('[data-a=add]', body).onclick = () => { N.rows.push({ pt: '', ar: '', av: '' }); persist(); draw(); setTimeout(() => $$('.nv-row input[data-f=av]', body).pop()?.focus(), 50); };
    }
    draw();
  }

  // ---------- Coordonnées ----------
  function pts() {
    const S = store(); S.pts = S.pts || [{ n: 'S1', x: '', y: '', z: '' }, { n: 'A', x: '', y: '', z: '' }]; const L = S.pts;
    let mode = 'dist', sel = { a: 0, b: 1, s: 0, r: 1, p: 1 };
    const P = (i) => L[i] || {};
    function draw() {
      const opt = (k) => `<select data-s="${k}">${L.map((p, i) => `<option value="${i}" ${sel[k] === i ? 'selected' : ''}>${esc(p.n || 'P' + i)}</option>`).join('')}</select>`;
      let res = '';
      if (mode === 'dist') { const a = P(sel.a), b = P(sel.b); const dx = num(b.x) - num(a.x), dy = num(b.y) - num(a.y), dz = num(b.z) - num(a.z), d = Math.hypot(dx, dy);
        res = `<div class="big"><span>Distance horizontale</span><b>${fmtN(d, 3)} m</b></div><div><span>Gisement ${esc(a.n)}→${esc(b.n)}</span><b>${fmtN(gis(num(a.x), num(a.y), num(b.x), num(b.y)), 4)} gr</b></div>
          <div><span>ΔX / ΔY</span><b>${fmtN(dx, 3)} / ${fmtN(dy, 3)}</b></div><div><span>Dénivelé ΔZ</span><b>${fmtN(dz, 3)} m</b></div><div><span>Distance inclinée</span><b>${fmtN(Math.hypot(d, dz), 3)} m</b></div><div><span>Pente</span><b>${d ? fmtN(dz / d * 100, 2) + ' %' : '—'}</b></div>`;
        res = `<div class="c2">De ${opt('a')} à ${opt('b')}</div><div class="cres">${res}</div>`; }
      if (mode === 'impl') { const s = P(sel.s), r = P(sel.r), p = P(sel.p);
        const gR = gis(num(s.x), num(s.y), num(r.x), num(r.y)), gP = gis(num(s.x), num(s.y), num(p.x), num(p.y)); let ang = gP - gR; if (ang < 0) ang += 400;
        res = `<div class="c3s"><label><small>Station</small>${opt('s')}</label><label><small>Référence (0)</small>${opt('r')}</label><label><small>Point à implanter</small>${opt('p')}</label></div>
          <div class="cres"><div class="big"><span>Angle horizontal (depuis la référence, sens horaire)</span><b>${fmtN(ang, 4)} gr</b><small>${fmtN(ang * 0.9, 4)}°</small></div>
          <div><span>Distance station → point</span><b>${fmtN(Math.hypot(num(p.x) - num(s.x), num(p.y) - num(s.y)), 3)} m</b></div><div><span>Gisement station → point</span><b>${fmtN(gP, 4)} gr</b></div></div>`; }
      if (mode === 'surf') { let a = 0, per = 0; const v = L.filter(p => p.x !== '' && p.y !== '');
        for (let i = 0; i < v.length; i++) { const p1 = v[i], p2 = v[(i + 1) % v.length]; a += num(p1.x) * num(p2.y) - num(p2.x) * num(p1.y); per += Math.hypot(num(p2.x) - num(p1.x), num(p2.y) - num(p1.y)); }
        res = `<div class="cres"><div class="big"><span>Surface du polygone (${v.length} points, dans l'ordre)</span><b>${fmtN(Math.abs(a) / 2, 3)} m²</b></div><div><span>Périmètre</span><b>${fmtN(per, 3)} m</b></div></div>`; }
      body.innerHTML = `<div class="ctabs"><button data-mode="dist" class="${mode === 'dist' ? 'on' : ''}">Distance</button><button data-mode="impl" class="${mode === 'impl' ? 'on' : ''}">Implantation</button><button data-mode="surf" class="${mode === 'surf' ? 'on' : ''}">Surface</button></div>
        ${res}
        <div class="pt-head"><span>Point</span><span>X (m)</span><span>Y (m)</span><span>Z (m)</span><span></span></div>
        ${L.map((p, i) => `<div class="pt-row" data-i="${i}"><input data-f="n" value="${esc(p.n)}"><input inputmode="decimal" data-f="x" value="${esc(p.x)}"><input inputmode="decimal" data-f="y" value="${esc(p.y)}"><input inputmode="decimal" data-f="z" value="${esc(p.z)}"><button class="iconbtn sm" data-del="${i}">${icon('close')}</button></div>`).join('')}
        <button class="btn ghost" data-a="add" style="width:100%;margin-top:8px">${icon('plus')} Ajouter un point</button>
        <p class="muted" style="font-size:12.5px;line-height:1.5;padding:0 4px">Gisements en grades depuis le Nord (axe Y), sens horaire — comme sur la station totale.</p>`;
      $$('[data-mode]', body).forEach(b => b.onclick = () => { mode = b.dataset.mode; draw(); });
      $$('[data-s]', body).forEach(s => s.onchange = () => { sel[s.dataset.s] = +s.value; draw(); });
      $$('.pt-row', body).forEach(rowEl => { const p = L[+rowEl.dataset.i]; $$('[data-f]', rowEl).forEach(i => i.onchange = () => { p[i.dataset.f] = i.value; persist(); draw(); }); });
      $$('[data-del]', body).forEach(b => b.onclick = () => { if (L.length > 1) { L.splice(+b.dataset.del, 1); for (const k in sel) sel[k] = Math.min(sel[k], L.length - 1); persist(); draw(); } });
      $('[data-a=add]', body).onclick = () => { L.push({ n: 'P' + L.length, x: '', y: '', z: '' }); persist(); draw(); };
    }
    draw();
  }

  // ---------- Angles ----------
  function conv() {
    body.innerHTML = `<div class="cform"><label><small>Grades (gon)</small><input inputmode="decimal" data-u="gr"></label><label><small>Degrés décimaux</small><input inputmode="decimal" data-u="deg"></label>
      <label><small>Degrés ° ' "</small><input data-u="dms" placeholder="ex : 45 30 15"></label><label><small>Radians</small><input inputmode="decimal" data-u="rad"></label></div>`;
    const set = (deg, from) => {
      const vals = { gr: deg / 0.9, deg, rad: deg * Math.PI / 180 };
      const d = Math.floor(Math.abs(deg)), mm = Math.floor((Math.abs(deg) - d) * 60), ss = ((Math.abs(deg) - d) * 60 - mm) * 60;
      vals.dms = `${deg < 0 ? '-' : ''}${d}° ${mm}' ${ss.toFixed(2)}"`;
      $$('[data-u]', body).forEach(i => { if (i.dataset.u !== from) i.value = i.dataset.u === 'dms' ? vals.dms : String(+vals[i.dataset.u].toFixed(8)).replace('.', ','); });
    };
    $$('[data-u]', body).forEach(i => i.oninput = () => {
      const u = i.dataset.u; let deg;
      if (u === 'gr') deg = num(i.value) * 0.9; if (u === 'deg') deg = num(i.value); if (u === 'rad') deg = num(i.value) * 180 / Math.PI;
      if (u === 'dms') { const p = i.value.replace(/[°'"]/g, ' ').trim().split(/\s+/).map(num); deg = (p[0] || 0) + (p[1] || 0) / 60 + (p[2] || 0) / 3600; }
      set(deg, u);
    });
  }
}

function shareText(text) {
  const P = window.Capacitor?.Plugins || {};
  if (P.Share) return P.Share.share({ text, dialogTitle: 'Envoyer' }).catch(() => {});
  if (navigator.share) return navigator.share({ text }).catch(() => {});
  navigator.clipboard?.writeText(text).then(() => toast('Copié ✓'));
}
