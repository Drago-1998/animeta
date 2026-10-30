/* Nordik 3300: the candybar phone with snap-on colour covers, built in code like the Pocket Pal.
   Axes as in pocket-pal.js: X right, Y up, the keypad looks at +Z and the battery cover at -Z. The body is 2.1 × 4.9 × 0.94,
   rounded all round, the two covers meeting at a seam at z = 0. The front cover (with its silver keyhole-shaped trim),
   keymat, display, earpiece and board come off from the front; the battery cover and battery from the back, and the four
   Torx screws holding the board sit in the battery bay under a white label and the SIM holder. */
(function () {
'use strict';
const T = THREE, { rr, disc, stadium, extrude, roundedBox, lathe, merge, canvasTex, fitText, rng } = PocketPal.util;

/* ---------- layout, in device units ---------- */
const W = 2.1, H = 4.9, RT = 0.72, RB = 0.5;          // body width and height, top and bottom corner radius
const RIM = 0.2, FACE = 0.42, BACKZ = 0.52, PLATE = 0.06; // how far the rounded edge curls in, front face z, depth of the back, plate thickness
const SCR = { y: 1.12, w: 1.2, h: 0.92 };              // screen window
const LCDP = { w: 1.08, h: 0.62 };                     // the lit glass, 84 × 48 pixels
const EAR = [0, 1.95], LOGO_Y = 1.72;
const KEYS = [];                                       // twelve oval keys in rows bent into a smile; the side keys lean in
[-0.66, -1.1, -1.54, -1.98].forEach(y => [-1, 0, 1].forEach(c => KEYS.push({ x: 0.56 * c, y: y + (c ? 0.07 : 0), rot: 0.16 * c })));
const NAV = { hw: 0.56, top: 0.34, sag: 0.16, thick: 0.4, tip: 0.1 }; // the navi opening: a curved band, thickest in the middle
const LOBE = { y: 0.1, rx: 0.8, ry: 0.42 }, TRIM = { x: 0.72, y0: 0.45, y1: 2.2, r: 0.5 }, BAND = 0.08; // the silver keyhole trim
const BAY = { y: -0.62, w: 1.6, h: 2.5 };              // battery bay in the back
const SCREWS = [[-0.6, 0.38], [0.6, 0.38], [-0.6, -1.6], [0.6, -1.6]];
const PCB = { z: 0.09, t: 0.07 };
const CONN = [0, -1.72];                               // battery connector, through a window in the bay floor
const LCD_ON = '#a3c44c', LCD_INK = '#1c2610', LCD_OFF = '#394232';

/* ---------- outlines ---------- */
// the body outline, moved in by d: big rounded corners at the top, smaller at the bottom, sides drawn in a touch below the screen
function bodyPts(d = 0) {
  const hw = W / 2 - d, rt = Math.max(0.05, RT - d), rb = Math.max(0.05, RB - d), ht = H / 2 - d, hb = -H / 2 + d, p = [];
  const arc = (cx, cy, r, a0, a1, k) => { for (let i = 0; i <= k; i++) { const a = a0 + (a1 - a0) * i / k; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  const waist = y => 0.03 * Math.exp(-(((y + 0.3) / 1.1) ** 2));
  arc(hw - rb, hb + rb, rb, -Math.PI / 2, 0, 14);
  for (let i = 1; i < 30; i++) { const y = hb + rb + (ht - rt - hb - rb) * i / 30; p.push([hw - waist(y), y]); }
  arc(hw - rt, ht - rt, rt, 0, Math.PI / 2, 16);
  arc(-hw + rt, ht - rt, rt, Math.PI / 2, Math.PI, 16);
  for (let i = 1; i < 30; i++) { const y = ht - rt - (ht - rt - hb - rb) * i / 30; p.push([-hw + waist(y), y]); }
  arc(-hw + rb, hb + rb, rb, Math.PI, Math.PI * 1.5, 14);
  return p;
}
function normals(pts) {
  const n = pts.length;
  return pts.map((_, i) => { const [px, py] = pts[(i - 1 + n) % n], [qx, qy] = pts[(i + 1) % n], l = Math.hypot(qx - px, qy - py) || 1; return [(qy - py) / l, -(qx - px) / l]; });
}
function shapeFrom(pts, path = false) {
  const s = path ? new T.Path() : new T.Shape();
  pts.forEach(([x, y], i) => { if (i) s.lineTo(x, y); else s.moveTo(x, y); });
  s.closePath();
  return s;
}
// the rounded edge of one cover: from the seam (z = 0, full outline) it curls in by R as it reaches height H (sign: +1 front, -1 back)
function skinGeo(pts, R, Hh, sign, segs = 10) {
  const n = pts.length, N = normals(pts), pos = [], uv = [], idx = [];
  for (let j = 0; j <= segs; j++) {
    const th = j / segs * Math.PI / 2, off = -R * (1 - Math.cos(th)), z = sign * Hh * Math.sin(th);
    for (let i = 0; i < n; i++) { const [x, y] = pts[i]; pos.push(x + N[i][0] * off, y + N[i][1] * off, z); uv.push(x / W + 0.5, (y + j * 0.04) / H + 0.5); }
  }
  for (let j = 0; j < segs; j++) for (let i = 0; i < n; i++) {
    const a = j * n + i, b = j * n + (i + 1) % n, c = (j + 1) * n + (i + 1) % n, d = (j + 1) * n + i;
    if (sign > 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const offsetPts = (pts, d) => { const N = normals(pts); return pts.map(([x, y], i) => [x + N[i][0] * d, y + N[i][1] * d]); };
// the navi opening: a band bent into a smile, its top edge sagging in the middle
function crescent(c = NAV, grow = 0, n = 40) {
  const top = t => c.top - c.sag * (1 - t * t) + grow, th = t => c.tip + (c.thick - c.tip) * Math.pow(1 - t * t, 0.7) + grow * 2, p = [];
  for (let i = 0; i <= n; i++) { const t = -1 + 2 * i / n; p.push([(c.hw + grow) * t, top(t)]); }
  for (let i = n; i >= 0; i--) { const t = -1 + 2 * i / n; p.push([(c.hw + grow) * t, top(t) - th(t)]); }
  return p;
}
function planar(geo, x0, y0, w, h) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - x0) / w; uv[i * 2 + 1] = (p.getY(i) - y0) / h; }
  geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
  return geo;
}
const OUT = bodyPts(0), FLAT = offsetPts(OUT, -RIM), FACEPTS = offsetPts(OUT, -RIM - 0.02);
const faceBox = { x0: -W / 2, y0: -H / 2, w: W, h: H };
const boardBox = { x0: -W / 2 + 0.15, y0: -H / 2 + 0.15, w: W - 0.3, h: H - 0.3 };

/* ---------- the screen: 84 × 48 pixels, drawn small and scaled up without smoothing ---------- */
const px = document.createElement('canvas'); px.width = 84; px.height = 48;
function drawScreen(g, w, h, phase) {
  if (phase < 0) {
    g.fillStyle = LCD_OFF; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,255,255,.1)'); gr.addColorStop(.45, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    return;
  }
  const q = px.getContext('2d'), k = Math.min(1, phase / 0.12);
  q.fillStyle = k < 1 ? `rgb(${57 + (163 - 57) * k | 0},${66 + (196 - 66) * k | 0},${50 + (76 - 50) * k | 0})` : LCD_ON; q.fillRect(0, 0, 84, 48);
  const F = window.PixFont;
  if (k > .6) { F.text(q, 'NORDIK', 42, 12, LCD_INK, 'bold', 'center'); F.text(q, '3300', 42, 25, LCD_INK, 'small', 'center'); }
  if (phase >= 0.7) F.text(q, 'Поиск сети' + '...'.slice(0, Math.floor((phase - 0.7) * 6) % 4), 8, 37, LCD_INK, 'small');
  g.imageSmoothingEnabled = false; g.drawImage(px, 0, 0, w, h); g.imageSmoothingEnabled = true;
  for (let x = 0; x < w; x += w / 84) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(x, 0, 1, h); }
  for (let y = 0; y < h; y += h / 48) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, y, w, 1); }
}

/* ---------- textures ---------- */
const TEX = {};
function textures(font) {
  if (TEX.ready) return TEX;
  const X = TEX, mono = '"Nunito", "Arial", sans-serif';
  X.grain = canvasTex(256, 256, (g, w, h) => {
    const r = rng(61); g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { const c = 228 + r() * 26 | 0; g.fillStyle = `rgba(${c},${c},${c},${0.2 + r() * 0.3})`; g.fillRect(r() * w, r() * h, 1 + r(), 1 + r()); }
  });
  X.grain.wrapS = X.grain.wrapT = T.RepeatWrapping; X.grain.repeat.set(1.2, 2.4);
  X.lcd = canvasTex(256, 192, (g, w, h) => drawScreen(g, w, h, 0.5));
  X.ink = canvasTex(256, 192, (g, w, h) => {
    const r = rng(8);
    for (let i = 0; i < 4; i++) {
      const x = r() * w, y = r() * h, rad = 30 + r() * 60, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(8,8,10,.97)'); gr.addColorStop(.55, 'rgba(20,16,40,.85)'); gr.addColorStop(.8, 'rgba(90,40,120,.35)'); gr.addColorStop(1, 'rgba(90,40,120,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    g.strokeStyle = 'rgba(230,240,230,.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(w * .1, h * .8); g.lineTo(w * .45, h * .35); g.lineTo(w * .9, h * .25); g.stroke();
  });
  X.crack = canvasTex(512, 512, (g, w, h) => {
    const r = rng(29), cx = w / 2, cy = h / 2;
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      let x = cx, y = cy, a = i / 9 * Math.PI * 2 + r() * 0.4;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 7; k++) { a += (r() - 0.5) * 0.7; const len = 16 + r() * 34; x += Math.cos(a) * len; y += Math.sin(a) * len; g.lineTo(x, y); }
      g.strokeStyle = 'rgba(15,15,20,.8)'; g.lineWidth = 3.5; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.3; g.stroke();
    }
  });
  X.scorch = canvasTex(256, 256, (g, w, h) => {
    const r = rng(31);
    for (let i = 0; i < 20; i++) { const x = w / 2 + (r() - .5) * w * .5, y = h / 2 + (r() - .5) * h * .5, rad = 18 + r() * 46, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(18,12,8,.75)'); gr.addColorStop(1, 'rgba(60,35,15,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  });
  // digits and letters for the twelve keys, three columns by four rows
  const keyFace = (faded) => canvasTex(512, 256, (g, w, h) => {
    const cw = w / 3, ch = h / 4, labels = [['1', 'oo'], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['*', '+'], ['0', ''], ['#', '']];
    labels.forEach(([d, l], i) => {
      const c = i % 3, rw = i / 3 | 0, x = c * cw, y = rw * ch;
      g.fillStyle = faded ? 'rgba(40,40,46,.2)' : '#2a2d33';
      g.font = `800 ${ch * .6}px ${mono}`; g.textAlign = 'center'; g.fillText(d, x + cw * .38, y + ch * .73);
      g.font = `700 ${ch * .28}px ${mono}`; g.textAlign = 'left'; g.fillText(l, x + cw * .56, y + ch * .64);
    });
  });
  X.keys = keyFace(false); X.keysWorn = keyFace(true);
  X.cKey = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#2a2d33'; g.font = `800 40px ${mono}`; g.textAlign = 'center'; g.fillText('C', w / 2, h * .74); });
  X.arrows = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#2a2d33';
    g.beginPath(); g.moveTo(32, 8); g.lineTo(46, 26); g.lineTo(18, 26); g.fill();
    g.beginPath(); g.moveTo(32, 56); g.lineTo(46, 38); g.lineTo(18, 38); g.fill();
  });
  X.label = (fresh) => canvasTex(512, 768, (g, w, h) => {
    const r = rng(fresh ? 3 : 4);
    g.fillStyle = fresh ? '#f2f6fa' : '#f0efea'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(80,70,60,${r() * .05})`; g.fillRect(r() * w, r() * h, 2, 2); }
    if (fresh) { g.fillStyle = '#2f6f9e'; g.fillRect(0, 0, w, 110); g.fillStyle = '#fff'; fitText(g, 'НОВЫЙ · ПРОВЕРЕН', w / 2, 72, w * .8, 40, 800, mono, 'center'); }
    g.fillStyle = '#26282c';
    fitText(g, 'NORDIK', w / 2, 200, w * .62, 70, 700, font, 'center');
    fitText(g, 'BNK-33  Li-Ion  3.6 V  900 mAh', w / 2, 270, w * .86, 34, 800, mono, 'center');
    g.strokeStyle = '#26282c'; g.lineWidth = 3; g.strokeRect(46, 310, w - 92, 250);
    ['ВНИМАНИЕ: не бросать в огонь,', 'не разбирать, не замыкать', 'контакты. Использовать только', 'с зарядным устройством NORDIK.'].forEach((t, i) => fitText(g, t, w / 2, 352 + i * 50, w * .78, 30, 700, mono, 'center'));
    [[120, 650], [256, 650], [392, 650]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 44, 0, 7); g.stroke(); });
    fitText(g, 'Li', 120, 664, 60, 40, 800, mono, 'center'); fitText(g, 'CE', 256, 664, 60, 38, 800, mono, 'center'); fitText(g, '+ −', 392, 662, 70, 38, 800, mono, 'center');
  });
  X.labelOld = X.label(false); X.labelNew = X.label(true);
  X.imei = canvasTex(320, 240, (g, w, h) => {
    const r = rng(12);
    g.fillStyle = '#f4f4f1'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#26282c'; fitText(g, 'NORDIK', 16, 40, 140, 30, 700, font); fitText(g, 'CE 168', 190, 42, 120, 32, 800, mono);
    fitText(g, 'Type: NRD-5  Made in Europe', 16, 74, w - 32, 18, 700, mono);
    fitText(g, 'Code: 0504845', 16, 100, w - 32, 18, 700, mono);
    let x = 16; while (x < w - 16) { const bw = 2 + (r() * 4 | 0); g.fillRect(x, 116, bw, 70); x += bw + 2 + (r() * 3 | 0); }
    fitText(g, 'IMEI 35 0697 0021 4433 1', 16, 216, w - 32, 20, 800, mono);
  });
  X.sim = canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#e9e4d6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c84a32'; g.fillRect(0, 0, w, 34); g.fillStyle = '#fff'; fitText(g, 'РЕТРО-СВЯЗЬ', 12, 25, w * .9, 22, 800, mono);
    const gr = g.createLinearGradient(30, 60, 110, 130); gr.addColorStop(0, '#f4d27a'); gr.addColorStop(1, '#b8892f');
    g.fillStyle = gr; g.fillRect(30, 58, 80, 70); g.strokeStyle = '#8a6a2a'; g.lineWidth = 2; g.strokeRect(30, 58, 80, 70);
    g.beginPath(); g.moveTo(70, 58); g.lineTo(70, 128); g.moveTo(30, 93); g.lineTo(110, 93); g.stroke();
    g.fillStyle = '#3b3f46'; fitText(g, '89 7 01 2000', 128, 100, 120, 18, 700, mono);
  });
  X.grille = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#1a1b1e'; g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill();
    g.fillStyle = '#050506'; for (let y = 10; y < 120; y += 9) for (let x = 10; x < 120; x += 9) if (Math.hypot(x - 64, y - 64) < 50) { g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); }
  });
  X.torx = canvasTex(64, 64, (g) => {
    g.fillStyle = '#26282c'; g.beginPath();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = i % 2 ? 11 : 20; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    g.fill();
  });
  // the RF side's shield lids: perforated gold sheet
  X.shield = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e8d7a6'); gr.addColorStop(1, '#b89c5c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(70,56,26,.55)'; for (let y = 10; y < h; y += 16) for (let x = 10 + (y / 16 % 2) * 8; x < w; x += 16) { g.beginPath(); g.arc(x, y, 3.6, 0, 7); g.fill(); }
  });
  X.frameTop = canvasTex(256, 64, (g, w, h) => { g.fillStyle = 'rgba(60,64,70,.55)'; fitText(g, 'NORDIK', w / 2, h * .74, w * .6, 40, 700, font, 'center'); });
  X.pcbFront = canvasTex(512, 1180, (g, w, h) => drawBoard(g, w, h, false, mono));
  X.pcbBack = canvasTex(512, 1180, (g, w, h) => drawBoard(g, w, h, true, mono));
  X.lcdBack = canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2a2e'; fitText(g, 'LCD 84×48 · 3300', 12, 40, w - 24, 22, 700, font); fitText(g, 'LOT 0021', 12, 74, w - 24, 18, 600, font); });
  X.ready = true;
  return X;
}
const hex = n => '#' + n.toString(16).padStart(6, '0');
const lum = n => (((n >> 16) & 255) * .3 + ((n >> 8) & 255) * .59 + (n & 255) * .11) / 255;
// The front cover print: the glossy paint, the silver keyhole trim round the screen and the navi keys, the logo
function frontPrint(body, trim, font) {
  return canvasTex(420, Math.round(420 * H / W), (g, w, h) => {
    const S = w / faceBox.w, P = (x, y) => [(x - faceBox.x0) * S, (faceBox.y0 + faceBox.h - y) * S];
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, hex(body)); gr.addColorStop(.42, '#' + [16, 8, 0].map(s => Math.min(255, ((body >> s) & 255) + 34).toString(16).padStart(2, '0')).join('')); gr.addColorStop(1, hex(body));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // the trim: a rounded panel over the screen and a wide lobe over the navi keys, as one outline band
    const shape = (k) => {
      g.beginPath();
      const [x0, y0] = P(-TRIM.x + k, TRIM.y1 - k), [x1, y1] = P(TRIM.x - k, TRIM.y0 + k), r = (TRIM.r - k) * S;
      if (g.roundRect) g.roundRect(x0, y0, x1 - x0, y1 - y0, [r, r, 0.12 * S, 0.12 * S]); else g.rect(x0, y0, x1 - x0, y1 - y0);
      const [cx, cy] = P(0, LOBE.y); g.ellipse(cx, cy, (LOBE.rx - k) * S, (LOBE.ry - k) * S, 0, 0, Math.PI * 2);
    };
    const light = '#' + [16, 8, 0].map(s => Math.min(255, ((trim >> s) & 255) + 38).toString(16).padStart(2, '0')).join('');
    const tg = g.createLinearGradient(0, 0, w, h * .4); tg.addColorStop(0, hex(trim)); tg.addColorStop(.5, light); tg.addColorStop(1, hex(trim));
    g.fillStyle = tg; shape(0); g.fill('nonzero');
    g.fillStyle = 'rgba(0,0,0,.18)'; shape(BAND * 0.55); g.fill('nonzero');
    g.fillStyle = gr; shape(BAND); g.fill('nonzero');
    const dark = lum(body) > 0.55;
    const [lx, ly] = P(0, LOGO_Y);
    g.font = `700 ${0.19 * S}px ${font}`; g.textAlign = 'center'; g.fillStyle = dark ? 'rgba(30,32,40,.85)' : 'rgba(240,242,246,.95)'; g.fillText('NORDIK', lx, ly);
  });
}

// Board artwork in device units; the back is mirrored because it is viewed from -Z.
function drawBoard(g, w, h, back, mono) {
  const S = w / boardBox.w, r = rng(back ? 27 : 28);
  const P = (x, y) => [((back ? -x : x) - boardBox.x0) * S, (boardBox.y0 + boardBox.h - y) * S];
  g.fillStyle = '#1b4d33'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.06})`; g.fillRect(r() * w, r() * h, 2, 2); }
  g.strokeStyle = '#c9a85a'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  const line = (pts, width = 4) => { g.lineCap = g.lineJoin = 'round'; [['#143f28', width + 6], ['#2c7a4b', width]].forEach(([c, lw]) => { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); pts.forEach(([x, y], i) => { const [X, Y] = P(x, y); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke(); }); };
  const text = (t, x, y, size) => { const [X, Y] = P(x, y); g.fillStyle = '#e8ebe2'; g.font = `700 ${size}px ${mono}`; g.textAlign = 'center'; g.fillText(t, X, Y); };
  const pad = (x, y, pw, ph, color = '#d4b062') => { const [X, Y] = P(x, y); g.fillStyle = color; g.fillRect(X - pw * S / 2, Y - ph * S / 2, pw * S, ph * S); };
  for (let i = 0; i < 26; i++) { let x = -0.75 + r() * 1.5, y = -2.1 + r() * 4.2; const pts = [[x, y]]; for (let k = 0; k < 3; k++) { if (k % 2) y += (r() - .5) * .5; else x += (r() - .5) * .5; pts.push([x, y]); } line(pts, 3); }
  SCREWS.forEach(([x, y]) => { const [X, Y] = P(x, y); g.fillStyle = '#d4b062'; g.beginPath(); g.arc(X, Y, 0.12 * S, 0, 7); g.fill(); g.fillStyle = '#143f28'; g.beginPath(); g.arc(X, Y, 0.08 * S, 0, 7); g.fill(); });
  if (!back) {
    // gold rings with carbon centres under every key, contacts for the display and the earpiece
    const contact = (x, y, rx, ry, rot = 0) => { const [X, Y] = P(x, y); g.fillStyle = '#d4b062'; g.beginPath(); g.ellipse(X, Y, rx * S, ry * S, -rot, 0, 7); g.fill(); g.fillStyle = '#26272b'; g.beginPath(); g.ellipse(X, Y, rx * S * .62, ry * S * .62, -rot, 0, 7); g.fill(); };
    KEYS.forEach(k => contact(k.x, k.y, 0.19, 0.11, k.rot));
    contact(0, NAV.top - NAV.sag - 0.1, 0.24, 0.09); contact(-0.42, 0.13, 0.1, 0.1); contact(0.42, 0.19, 0.07, 0.06); contact(0.42, 0.07, 0.07, 0.06);
    for (let k = 0; k < 18; k++) pad(-0.51 + k * 0.06, SCR.y - SCR.h / 2 - 0.1, 0.03, 0.12);
    pad(EAR[0] - 0.12, EAR[1], 0.1, 0.1); pad(EAR[0] + 0.12, EAR[1], 0.1, 0.1);
    text('NORDIK 3300 · UI-2', 0, SCR.y + 0.05, 20); text('© 2000', 0, SCR.y - 0.12, 16);
  } else {
    text('NRD-5 MAIN', 0, 1.95, 22); text('REV 04 · 2000', 0, 1.8, 16);
    pad(CONN[0] - 0.2, CONN[1], 0.12, 0.22); pad(CONN[0], CONN[1], 0.12, 0.22); pad(CONN[0] + 0.2, CONN[1], 0.12, 0.22);
    for (let k = 0; k < 12; k++) pad(-0.55 + (k % 6) * 0.22, -2.0 - (k / 6 | 0) * 0.14, 0.12, 0.08);
  }
}

/* ---------- materials ---------- */
function materials(o, X) {
  const S = (color, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.5, metalness: 0 }, extra));
  const decal = (map, extra) => S(0xffffff, Object.assign({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, extra));
  const body = S(o.body, { map: X.grain, roughness: 0.26, envMapIntensity: 0.75 });
  const M = {
    body, bodySkin: Object.assign(body.clone(), { side: T.DoubleSide }),
    coverBody: S(o.body, { map: X.grain, roughness: 0.3, envMapIntensity: 0.7 }),
    face: S(0xffffff, { map: frontPrint(o.body, o.trim, o.font), roughness: 0.24, envMapIntensity: 0.65, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    chassis: S(0x969ba3, { roughness: 0.55, envMapIntensity: 0.45 }), chassisDark: S(0x767c85, { roughness: 0.6 }), black: S(0x141416, { roughness: 0.6 }),
    rubber: S(0xaeb3ba, { roughness: 0.75 }), key: S(0xc2c6cc, { roughness: 0.5 }), keyWorn: S(0xa9aaa5, { roughness: 0.85 }), navi: S(0x3f6fb8, { roughness: 0.3 }),
    keyPrint: decal(X.keys), keyPrintWorn: decal(X.keysWorn), cPrint: decal(X.cKey), arrowPrint: decal(X.arrows),
    glass: S(0xffffff, { roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide }),
    lcd: new T.MeshBasicMaterial({ map: o.screen || X.lcd }), lcdBezel: S(0x1d2024, { roughness: 0.4 }), ink: new T.MeshBasicMaterial({ map: X.ink, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    lcdBack: decal(X.lcdBack, { transparent: false, depthWrite: true }), frameTop: decal(X.frameTop),
    steel: S(0xc9ccd1, { metalness: 0.85, roughness: 0.3 }), shield: S(0xffffff, { map: X.shield, metalness: 0.75, roughness: 0.35 }),
    pcbEdge: S(0x24603b, { roughness: 0.5 }), pcbFront: S(0xffffff, { map: X.pcbFront, roughness: 0.42 }), pcbBack: S(0xffffff, { map: X.pcbBack, roughness: 0.42 }),
    gold: S(0xd8aa50, { metalness: 0.85, roughness: 0.3 }), flex: S(0xd9822b, { roughness: 0.4 }), led: S(0x9be36b, { roughness: 0.3, emissive: 0x2a5a14 }),
    grille: S(0xffffff, { map: X.grille, roughness: 0.7 }), cell: S(0xd2d4d8, { roughness: 0.45, metalness: 0.15 }), cellNew: S(0xc6d6e6, { roughness: 0.4, metalness: 0.15 }),
    labelOld: S(0xffffff, { map: X.labelOld, roughness: 0.7 }), labelNew: S(0xffffff, { map: X.labelNew, roughness: 0.6 }),
    imei: decal(X.imei, { transparent: false, depthWrite: true, roughness: 0.7 }), sim: S(0xffffff, { map: X.sim, roughness: 0.6 }),
    crack: decal(X.crack, { roughness: 0.3 }), scorch: decal(X.scorch),
    torx: new T.MeshBasicMaterial({ map: X.torx, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    screw: S(0xb9bdc4, { metalness: 0.9, roughness: 0.28 }),
  };
  return M;
}

/* ---------- the parts kit ---------- */
function kit(opt) {
  const o = Object.assign({ body: 0x1b2647, trim: 0xa3a9b2, font: '"Unbounded", "Arial Black", sans-serif', screen: null }, opt);
  const X = textures(o.font), M = materials(o, X);
  const group = (parent, name, x = 0, y = 0, z = 0, explode = 0) => { const g = new T.Group(); g.name = name; g.position.set(x, y, z); if (explode) g.userData.explode = explode; if (parent) parent.add(g); return g; };
  const mesh = (parent, name, geo, mat, x = 0, y = 0, z = 0) => { const m = new T.Mesh(geo, mat); m.name = name; m.position.set(x, y, z); parent.add(m); return m; };
  const back = m => { m.rotation.y = Math.PI; return m; };
  const plane = (w, h) => new T.PlaneGeometry(w, h);
  const cyl = (r, len, seg = 32) => { const c = new T.CylinderGeometry(r, r, len, seg); c.rotateX(Math.PI / 2); return c; };
  const make = {}, pose = {};

  /* the snap-on front cover: rounded all round, the face with its window, the navi opening and the twelve key holes */
  const coverHoles = () => [
    rr(SCR.w, SCR.h, 0.1, 0, SCR.y, true),
    ...[1.92, 1.97, 2.02, 2.07].map(y => stadium(0.12, 0.035, 0, 0, y)),
    shapeFrom(crescent(), true),
    ...KEYS.map(k => stadium(0.48, 0.3, k.rot, k.x, k.y)),
  ];
  const faceShape = (pts) => { const s = shapeFrom(pts); s.holes.push(...coverHoles()); return s; };
  const facePlate = extrude(faceShape(offsetPts(OUT, -RIM + 0.01)), PLATE, 0.01, 2);
  const printGeo = planar(new T.ShapeGeometry(faceShape(FACEPTS), 12), faceBox.x0, faceBox.y0, faceBox.w, faceBox.h);
  const crackGeo = planar(new T.ShapeGeometry(faceShape(FACEPTS), 12), 0.35 - 0.8, -1.2 - 0.8, 1.6, 1.6);
  const frontSkin = skinGeo(OUT, RIM, FACE, 1);
  make.phFront = ({ cracked } = {}) => {
    const g = group(null, 'front_cover', 0, 0, 0, 1.6);
    mesh(g, 'cover_rim', frontSkin, M.bodySkin);
    mesh(g, 'cover_face', facePlate, M.body, 0, 0, FACE - PLATE / 2);
    mesh(g, 'cover_print', printGeo, M.face, 0, 0, FACE + 0.0015);
    mesh(g, 'window_glass', plane(SCR.w - 0.02, SCR.h - 0.02), M.glass, 0, SCR.y, FACE - 0.02);
    if (cracked) mesh(g, 'cover_crack', crackGeo, M.crack, 0, 0, FACE + 0.0025);
    return g;
  };

  /* the light grey keymat: the navi pad bent into a smile with the blue navi key, C and the arrows, and twelve number keys */
  const capGeo = lathe([[0, 0], [0.2, 0], [0.2, 0], [0.2, 0.1], [0.19, 0.14], [0.16, 0.165], [0.1, 0.175], [0, 0.178]], 32); capGeo.rotateX(Math.PI / 2);
  const numGeo = capGeo.clone().scale(1.15, 0.68, 1);
  const padGeo = extrude(shapeFrom(crescent(NAV, -0.03)), 0.17, 0.04, 3);
  // the blue navi key follows the top edge of the opening across its middle half
  const naviPts = (() => { const p = [], n = 30, top = t => NAV.top - NAV.sag * (1 - t * t) - 0.05; for (let i = 0; i <= n; i++) { const t = -0.5 + i / n; p.push([NAV.hw * t, top(t)]); } for (let i = n; i >= 0; i--) { const t = -0.5 + i / n; p.push([NAV.hw * t, top(t) - 0.13]); } return p; })();
  const naviGeo = extrude(shapeFrom(naviPts), 0.06, 0.025, 3);
  const sheetGeo = extrude(rr(1.62, 2.82, 0.3, 0, -0.95), 0.05, 0.01, 1);
  const keyPlane = (i) => { const p = plane(0.34, 0.16), c = i % 3, r = i / 3 | 0, u0 = c / 3, u1 = (c + 1) / 3, v1 = 1 - r / 4, v0 = 1 - (r + 1) / 4; p.setAttribute('uv', new T.Float32BufferAttribute([u0, v1, u1, v1, u0, v0, u1, v0], 2)); return p; };
  make.phKeys = ({ worn } = {}) => {
    const g = group(null, 'keymat', 0, 0, 0, 1.2), base = 0.28;
    mesh(g, 'keymat_sheet', sheetGeo, M.rubber, 0, 0, 0.255);
    mesh(g, 'navi_pad', padGeo, worn ? M.keyWorn : M.rubber, 0, 0, base + 0.085);
    mesh(g, 'key_navi', naviGeo, M.navi, 0, 0, base + 0.2);
    mesh(g, 'c_print', plane(0.12, 0.12), M.cPrint, -0.42, 0.135, base + 0.1712);
    mesh(g, 'arrows_print', plane(0.12, 0.12), M.arrowPrint, 0.42, 0.135, base + 0.1712);
    KEYS.forEach((k, i) => {
      const kg = group(g, 'key_' + (i + 1), k.x, k.y, base - (worn && i === 4 ? 0.06 : 0)); kg.rotation.z = k.rot;
      mesh(kg, 'cap', numGeo, worn ? M.keyWorn : M.key); mesh(kg, 'print', keyPlane(i), worn ? M.keyPrintWorn : M.keyPrint, 0, 0, 0.1795);
    });
    return g;
  };

  /* the display module in its metal frame, stamped with the logo, with the flex down to the board */
  const frameGeo = roundedBox(1.36, 1.0, 0.1, 0.02);
  make.phLcd = ({ cracked } = {}) => {
    const g = group(null, 'display', 0, SCR.y, 0.24, 1.1);
    mesh(g, 'lcd_frame', frameGeo, M.steel);
    mesh(g, 'lcd_bezel', plane(1.3, 0.98), M.lcdBezel, 0, -0.01, 0.0502);
    g.userData.panel = mesh(g, 'lcd_panel', plane(LCDP.w, LCDP.h), M.lcd, 0, -0.04, 0.0525);
    if (cracked) mesh(g, 'lcd_ink', plane(LCDP.w, LCDP.h), M.ink, 0, -0.04, 0.054);
    mesh(g, 'lcd_flex', new T.BoxGeometry(0.6, 0.12, 0.008), M.flex, 0, -0.56, -0.06);
    back(mesh(g, 'lcd_sticker', plane(0.6, 0.22), M.lcdBack, 0.3, 0.2, -0.0505));
    return g;
  };

  /* the earpiece above the screen, on two springs */
  make.phEar = ({ burnt } = {}) => {
    const g = group(null, 'earpiece', ...EAR, 0.22, 1.0);
    mesh(g, 'ear_body', cyl(0.2, 0.08, 32), M.black);
    mesh(g, 'ear_grille', new T.CircleGeometry(0.19, 32), M.grille, 0, 0, 0.0405);
    if (burnt) mesh(g, 'ear_scorch', plane(0.38, 0.38), M.scorch, 0, 0, 0.041);
    [-0.1, 0.1].forEach((x, i) => mesh(g, 'ear_spring_' + (i + 1), roundedBox(0.05, 0.05, 0.1, 0.01), M.gold, x, 0, -0.08));
    return g;
  };

  /* the main board: key contacts in front, gold shield lids and the battery connector behind */
  const boardShape = () => { const s = shapeFrom(bodyPts(0.15)); SCREWS.forEach(([x, y]) => s.holes.push(disc(0.075, x, y))); return s; };
  const boardGeo = extrude(boardShape(), PCB.t, 0.004, 1), boardPrint = planar(new T.ShapeGeometry(boardShape(), 12), boardBox.x0, boardBox.y0, boardBox.w, boardBox.h);
  make.phPcb = ({ burnt, loose } = {}) => {
    const g = group(null, 'board'), zf = PCB.z + PCB.t / 2, zb = PCB.z - PCB.t / 2;
    mesh(g, 'pcb_board', boardGeo, M.pcbEdge, 0, 0, PCB.z);
    mesh(g, 'pcb_front_print', boardPrint, M.pcbFront, 0, 0, zf + 0.0008);
    back(mesh(g, 'pcb_back_print', boardPrint, M.pcbBack, 0, 0, zb - 0.0008));
    mesh(g, 'shield_top', roundedBox(1.1, 0.75, 0.08, 0.02), M.shield, 0, 1.55, zb - 0.04);
    mesh(g, 'shield_mid', roundedBox(1.0, 0.9, 0.09, 0.02), M.shield, 0, 0.55, zb - 0.045);
    mesh(g, 'shield_low', roundedBox(1.2, 1.1, 0.09, 0.02), M.shield, 0, -0.6, zb - 0.045);
    const vib = new T.CylinderGeometry(0.08, 0.08, 0.28, 20); vib.rotateZ(Math.PI / 2); mesh(g, 'vibra', vib, M.steel, -0.5, -1.35, zb - 0.08);
    [[-0.28, -0.88], [0.28, -0.88], [-0.28, -1.76], [0.28, -1.76], [-0.45, 0.56], [0.45, 0.56]].forEach(([x, y], i) => mesh(g, 'led_' + (i + 1), roundedBox(0.08, 0.05, 0.04, 0.01), M.led, x, y, zf + 0.02));
    const conn = group(g, 'battery_connector', CONN[0], CONN[1], zb);
    mesh(conn, 'housing', roundedBox(0.66, 0.26, 0.1, 0.02), M.black, 0, 0, -0.05);
    [-0.2, 0, 0.2].forEach((x, i) => {
      const f = mesh(conn, 'finger_' + (i + 1), roundedBox(0.07, 0.16, 0.26, 0.015), M.gold, x, 0, -0.2);
      if (loose && i === 2) { f.rotation.x = 0.7; f.position.z = -0.15; f.position.y = 0.08; }
    });
    if (burnt) back(mesh(g, 'pcb_scorch', plane(0.9, 0.9), M.scorch, 0.1, -0.9, zb - 0.1));
    return g;
  };

  /* the BNK-33 battery: light grey, label out, contacts on its inner face; it bulges when it swells */
  make.phBatt = ({ swollen, fresh } = {}) => {
    const g = group(null, 'battery', 0, BAY.y, -0.355, -1.3);
    const hw = 0.77, hh = 1.2, bulge = swollen ? 0.09 : 0;
    const f = (x, y) => Math.max(0, 1 - (x / hw) ** 2) * Math.max(0, 1 - (y / hh) ** 2);
    mesh(g, 'battery_case', roundedBox(1.54, 2.4, 0.17, 0.05, [14, 18, 2], v => { if (v.z < 0) v.z -= bulge * f(v.x, v.y); }), fresh ? M.cellNew : M.cell);
    const lg = new T.PlaneGeometry(1.34, 2.04, 20, 24); lg.rotateY(Math.PI);
    const lp = lg.attributes.position; for (let i = 0; i < lp.count; i++) lp.setZ(i, -0.0862 - bulge * f(lp.getX(i), lp.getY(i)));
    lg.computeVertexNormals();
    mesh(g, 'battery_label', lg, fresh ? M.labelNew : M.labelOld, 0, 0.04, 0);
    [-0.2, 0, 0.2].forEach((x, i) => mesh(g, 'battery_contact_' + (i + 1), plane(0.1, 0.18), M.gold, x, CONN[1] - BAY.y, 0.0862));
    return g;
  };

  /* the battery cover: the whole back, rounded like the front, logo on top, the release catch showing through an oval at the bottom */
  const backPlate = (() => { const s = shapeFrom(offsetPts(OUT, -RIM + 0.01)); s.holes.push(stadium(0.5, 0.18, 0, 0, -2.08)); return extrude(s, PLATE, 0.01, 2); })();
  const backSkin = skinGeo(OUT, RIM, BACKZ, -1);
  const coverPrint = canvasTex(256, Math.round(256 * (H - 2 * RIM) / (W - 2 * RIM)), (g, w, h) => {
    const dark = lum(o.body) > 0.55, s = w / (W - 2 * RIM);
    g.fillStyle = dark ? 'rgba(0,0,0,.12)' : 'rgba(0,0,0,.35)'; const bw = 0.82 * s, bh = 0.26 * s, by = h * 0.1;
    g.beginPath(); g.roundRect ? g.roundRect(w / 2 - bw / 2, by, bw, bh, 10) : g.rect(w / 2 - bw / 2, by, bw, bh); g.fill();
    g.fillStyle = dark ? 'rgba(30,32,40,.8)' : 'rgba(240,242,246,.95)'; g.font = `700 ${0.16 * s}px ${o.font}`; g.textAlign = 'center'; g.fillText('NORDIK', w / 2, by + bh * 0.72);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.08, h * 0.36); g.quadraticCurveTo(w / 2, h * 0.31, w * 0.92, h * 0.36); g.stroke();
  });
  const coverPrintMat = M.coverBody.clone(); coverPrintMat.map = coverPrint; coverPrintMat.color.setHex(0xffffff); coverPrintMat.transparent = true; coverPrintMat.depthWrite = false;
  coverPrintMat.polygonOffset = true; coverPrintMat.polygonOffsetFactor = -2; coverPrintMat.polygonOffsetUnits = -2;
  const coverSkinMat = Object.assign(M.coverBody.clone(), { side: T.DoubleSide });
  make.phCover = () => {
    const g = group(null, 'battery_cover', 0, 0, 0, -1.6);
    mesh(g, 'cover_rim', backSkin, coverSkinMat);
    mesh(g, 'cover_plate', backPlate, M.coverBody, 0, 0, -(BACKZ - PLATE / 2));
    back(mesh(g, 'cover_print', plane(W - 2 * RIM, H - 2 * RIM), coverPrintMat, 0, 0, -(BACKZ + 0.0015)));
    return g;
  };

  /* the light grey chassis inside the covers: back deck with the battery bay, the white label and the SIM holder in it,
     posts for the screws, the release catch, power key on top and the sockets at the bottom */
  const deck = (() => { const s = shapeFrom(offsetPts(OUT, -0.15)); s.holes.push(rr(BAY.w + 0.04, BAY.h + 0.04, 0.14, 0, BAY.y, true)); return extrude(s, 0.06, 0.012, 2); })();
  const sides = (() => { const s = shapeFrom(offsetPts(OUT, -0.12)); s.holes.push(shapeFrom(offsetPts(OUT, -0.2), true)); return extrude(s, 0.36, 0.01, 2); })();
  const floor = (() => { const s = rr(BAY.w + 0.06, BAY.h + 0.06, 0.14, 0, BAY.y); SCREWS.forEach(([x, y]) => s.holes.push(disc(0.075, x, y))); s.holes.push(rr(0.7, 0.32, 0.06, CONN[0], CONN[1], true)); return extrude(s, 0.04, 0.005, 1); })();
  const bayWall = (() => { const s = rr(BAY.w + 0.1, BAY.h + 0.1, 0.16, 0, BAY.y); s.holes.push(rr(BAY.w, BAY.h, 0.12, 0, BAY.y, true)); return extrude(s, 0.24, 0.006, 1); })();
  make.phShell = () => {
    const g = group(null, 'chassis');
    mesh(g, 'chassis_sides', sides, M.chassis, 0, 0, -0.2);
    mesh(g, 'back_deck', deck, M.chassis, 0, 0, -0.42);
    mesh(g, 'bay_floor', floor, M.chassisDark, 0, 0, -0.21);
    mesh(g, 'bay_wall', bayWall, M.chassis, 0, 0, -0.33);
    back(mesh(g, 'imei_label', plane(0.95, 0.72), M.imei, 0, 0.12, -0.2312));
    mesh(g, 'sim_holder', roundedBox(0.98, 0.68, 0.02, 0.03), M.steel, 0, -1.0, -0.238);
    back(mesh(g, 'sim_card', plane(0.86, 0.55), M.sim, 0, -1.0, -0.2492));
    SCREWS.forEach(([x, y], i) => mesh(g, 'screw_post_' + (i + 1), cyl(0.1, 0.245, 18), M.chassisDark, x, y, -0.0675));
    mesh(g, 'release_catch', roundedBox(0.44, 0.13, 0.08, 0.04), M.chassisDark, 0, -2.08, -0.46);
    mesh(g, 'power_key', roundedBox(0.46, 0.08, 0.2, 0.04), M.black, 0, H / 2 - 0.005, 0);
    mesh(g, 'charger_jack', new T.CylinderGeometry(0.075, 0.075, 0.05, 20), M.black, -0.42, -H / 2 + 0.01, 0);
    mesh(g, 'system_socket', roundedBox(0.42, 0.05, 0.12, 0.02), M.black, 0.25, -H / 2 + 0.01, 0);
    return g;
  };

  // Torx screws in the battery bay: head outward (-Z)
  const screwGeo = (() => {
    const head = lathe([[0, 0], [0.085, 0], [0.085, 0], [0.085, 0.015], [0.078, 0.026], [0.06, 0.032], [0, 0.034]], 24);
    const shank = new T.CylinderGeometry(0.03, 0.024, 0.3, 12); shank.translate(0, -0.15, 0);
    const geo = merge([head, shank]); geo.rotateX(-Math.PI / 2); return geo;
  })();
  make.screw = i => {
    const [x, y] = SCREWS[i - 1], g = group(null, 'screw_' + i, x, y, -0.23, -2.4);
    mesh(g, 'screw_' + i + '_body', screwGeo, M.screw);
    back(mesh(g, 'screw_' + i + '_torx', plane(0.1, 0.1), M.torx, 0, 0, -0.0345));
    return g;
  };

  // where each part sits when installed (device coordinates)
  pose.phShell = new T.Vector3(); pose.phFront = new T.Vector3(); pose.phKeys = new T.Vector3();
  pose.phLcd = new T.Vector3(0, SCR.y, 0.24); pose.phEar = new T.Vector3(EAR[0], EAR[1], 0.22); pose.phPcb = new T.Vector3();
  pose.phBatt = new T.Vector3(0, BAY.y, -0.355); pose.phCover = new T.Vector3();
  SCREWS.forEach(([x, y], i) => { pose['screw_' + (i + 1)] = new T.Vector3(x, y, -0.23); });

  // grime on dirty parts, in the part's own coordinates; front: +Z
  const zf = PCB.z + PCB.t / 2 + 0.004, zb = PCB.z - PCB.t / 2 - 0.004;
  const spots = {
    phPcb: [
      { x: 0, y: -1.2, z: zf, w: 1.5, h: 1.3, kind: 'stain', front: true },
      { x: 0.45, y: -0.35, z: zf, w: 0.7, h: 0.6, kind: 'crust', front: true },
      { x: 0, y: CONN[1], z: zb - 0.1, w: 0.9, h: 0.55, kind: 'crust' },
      { x: -0.3, y: -0.3, z: zb - 0.09, w: 0.9, h: 0.8, kind: 'stain' },
    ],
    phKeys: [
      { x: -0.35, y: -0.85, z: 0.47, w: 0.95, h: 0.85, kind: 'juice', front: true },
      { x: 0.4, y: -1.7, z: 0.47, w: 0.95, h: 0.85, kind: 'juice', front: true },
      { x: 0, y: 0.15, z: 0.52, w: 0.85, h: 0.5, kind: 'juice', front: true },
      { x: 0, y: -1.1, z: 0.23, w: 1.4, h: 1.3, kind: 'stain' },
    ],
  };
  // the lifted battery-connector finger, soldered back on the mat
  const joint = new T.Vector3(CONN[0] + 0.2, CONN[1], zb - 0.06);
  const naviY = NAV.top - NAV.sag - 0.11;
  return { make, pose, spots, joint, materials: M, size: { w: W, h: H, d: FACE + BACKZ }, testAt: new T.Vector3(0, naviY, 0.5) };
}

/* ---------- the phone's own software: standby, the menu, messages and calls ---------- */
// 84 × 48 pixels. The blue navi key does what the label above it says, C goes back, the arrows scroll, the number keys
// dial from standby. ctx.phone brings this phone's messages, its call register and somebody who calls while it is in hand.
const PIC = { // menu pictures and small marks, '#' is a pixel
  mail: ['########################', '##....................##', '#.#..................#.#', '#..#................#..#', '#...#..............#...#',
    '#....#............#....#', '#.....#..........#.....#', '#......#........#......#', '#.......#..##..#.......#', '#........##..##........#',
    '#.......#......#.......#', '#......#........#......#', '#.....#..........#.....#', '#....#............#....#', '#...#..............#...#', '########################'],
  calls: ['....##############....', '..##################..', '.####............####.', '####..............####', '####...########...####', '.##...##########...##.',
    '.....###.##..##.###...', '....####.##..##.####..', '...#####........#####.', '...##################.', '...##################.', '...##################.', '....################..'],
  env: ['#######', '##...##', '#.#.#.#', '#..#..#', '#######'],
  in: ['....#', '...#.', '#.#..', '##...', '###..'],
  out: ['..###', '...##', '..#.#', '.#...', '#....'],
  missed: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  ant: ['#.#.#', '.###.', '..#..', '..#..', '..#..'],
  bat: ['.###.', '#####', '#...#', '#####', '#...#', '#####'],
};
function pic(q, name, x, y, color) {
  q.fillStyle = color;
  PIC[name].forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') q.fillRect(x + i, y + j, 1, 1); }));
}
function app(ctx) {
  const cv = document.createElement('canvas'); cv.width = 84; cv.height = 48;
  const q = cv.getContext('2d'), F = window.PixFont, ON = LCD_ON, INK = LCD_INK;
  const data = ctx.phone || { inbox: [], calls: [] }, inbox = data.inbox, calls = data.calls;
  const MENU = [{ title: 'Сообщения', pic: 'mail', go: 'inbox' }, { title: 'Звонки', pic: 'calls', go: 'calls' }];
  let view = 'idle', back = 'idle', t = 0, menuI = 0, sel = 0, top = 0, line = 0, dial = '', call = null, rang = false;
  const beep = (f, d = .05) => ctx.beep(f, d, 'square', .03);
  const go = v => { view = v; sel = top = line = 0; };
  const unread = () => inbox.filter(m => !m.read).length, missed = () => calls.filter(c => c.type === 'missed' && !c.seen).length;
  // a call: incoming (ringing until answered), talking, or dialled out; it remembers the screen to go back to
  function endCall(note) {
    ctx.vibrate(false);
    const dur = call.state === 'talk' ? t - call.from : 0;
    if (call.entry && dur) call.entry.dur = mmss(dur);
    call = { ...call, state: 'ended', note, at: t, dur };
    beep(880, .08); beep(660, .12);
  }
  function key(id, down) {
    if (!down) return;
    if (call && call.state === 'ring') {
      if (id === 'navi') {
        call.state = 'talk'; call.at = call.from = t; ctx.vibrate(false); ctx.say(call.who + ': «' + call.line + '»', 'surprised', 8000);
        call.entry = { who: call.who, type: 'in', day: 'Сегодня', when: clock(), num: call.num }; calls.unshift(call.entry);
      }
      else if (id === 'c') { calls.unshift({ who: call.who, type: 'missed', day: 'Сегодня', when: clock(), num: call.num, n: 1 }); endCall('Отклонён'); }
      return;
    }
    if (call && (call.state === 'talk' || call.state === 'out')) { if (id === 'navi' || id === 'c') endCall(call.state === 'out' ? 'Вызов отменён' : 'Вызов завершён'); return; }
    if (call) return;
    // in the lists 2 and 8 scroll too, like on the real thing
    if (view !== 'idle') id = { k2: 'up', k8: 'down' }[id] || id;
    const n = id.startsWith('k') ? '123456789*0#'[+id.slice(1) - 1] : null;
    if (view === 'idle') {
      if (n) { if (dial.length < 12) dial += n; beep(1200 + '123456789*0#'.indexOf(n) * 40, .07); }
      else if (id === 'c' && dial) dial = dial.slice(0, -1);
      else if (id === 'navi' && dial) { call = { state: 'out', who: dial, at: t, num: dial }; calls.unshift({ who: dial, type: 'out', day: 'Сегодня', when: clock(), num: dial }); dial = ''; }
      else if (id === 'navi') { go('menu'); menuI = 0; }
      else if (id === 'down' && (unread() || missed())) go(unread() ? 'inbox' : 'calls');
      return;
    }
    if (id === 'up' || id === 'down') {
      const d = id === 'up' ? -1 : 1;
      if (view === 'menu') menuI = (menuI + d + MENU.length) % MENU.length;
      else if (view === 'inbox' || view === 'calls') { const list = view === 'inbox' ? inbox : calls; if (list.length) sel = (sel + d + list.length) % list.length; top = Math.min(Math.max(top, sel - 2), sel); }
      else if (view === 'read') line = Math.max(0, Math.min(line + d, textLines().length - 3));
      beep(1500, .02);
      return;
    }
    if (id === 'c') {
      ({ menu: () => go('idle'), inbox: () => { go('menu'); menuI = 0; }, calls: () => { go('menu'); menuI = 1; }, read: () => { const s = sel0; go('inbox'); sel = s; top = Math.max(0, s - 2); },
        info: () => { const s = sel0; go('calls'); sel = s; top = Math.max(0, s - 2); } }[view] || (() => {}))();
      beep(700, .04);
      return;
    }
    if (id === 'navi') {
      if (view === 'menu') { const m = MENU[menuI]; go(m.go); if (m.go === 'calls') calls.forEach(c => { c.seen = true; }); }
      else if (view === 'inbox' && inbox.length) { sel0 = sel; go('read'); inbox[sel0].read = true; if (ctx.onRead) ctx.onRead(inbox[sel0]); }
      else if (view === 'read') { const s = sel0; go('inbox'); sel = s; top = Math.max(0, s - 2); }
      else if (view === 'calls' && calls.length) { sel0 = sel; go('info'); }
      else if (view === 'info') { const s = sel0; go('calls'); sel = s; top = Math.max(0, s - 2); }
      beep(1100, .04);
    }
  }
  let sel0 = 0; // the message or call being looked at
  const textLines = () => F.wrap('small', inbox[sel0].text, 79);
  function tick(dt) {
    t += dt;
    // somebody rings a few seconds after it comes back to life
    if (!rang && data.caller && t > 6 && !call) {
      rang = true; call = { state: 'ring', who: data.caller.who, line: data.caller.line, num: data.caller.num, at: t };
      ctx.vibrate(true);
    }
    if (!call) return;
    const k = t - call.at;
    if (call.state === 'ring') {
      if (Math.floor(k / 2.2) !== Math.floor((k - dt) / 2.2) || k < dt) RING.forEach(([f, d], i) => ctx.beep(f, .1, 'square', .035, d));
      if (k > 15) { calls.unshift({ who: call.who, type: 'missed', day: 'Сегодня', when: clock(), num: call.num, n: 1 }); endCall('Непринятый вызов'); }
    } else if (call.state === 'talk') {
      if (k > 7) endCall('Вызов завершён');
    } else if (call.state === 'out') {
      if (Math.floor(k / 1.6) !== Math.floor((k - dt) / 1.6) && k < 6) ctx.beep(425, .8, 'sine', .03);
      if (k > 6.5) endCall('Нет ответа');
    } else if (call.state === 'ended' && k > 1.6) call = null;
  }
  const RING = [[1319, 0], [1568, .12], [1760, .24], [1568, .36], [1319, .48], [1175, .6], [1319, .72]];
  const clock = () => { const d = new Date(); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  // the label over the navi key
  const soft = label => F.text(q, label, 42, 38, INK, 'small', 'center');
  function head(title, right) {
    F.text(q, title, 1, 0, INK, 'small');
    if (right) F.text(q, right, 83, 0, INK, 'small', 'right');
    q.fillStyle = INK; q.fillRect(0, 10, 84, 1);
  }
  function scrollbar(i, n, y0 = 12, h = 26) {
    if (n < 2) return;
    q.fillStyle = INK; q.fillRect(82, y0, 1, h);
    const th = Math.max(3, Math.round(h / n)), y = y0 + Math.round((h - th) * i / (n - 1));
    q.fillRect(81, y, 3, th);
  }
  function list(items, row) {
    if (!items.length) { F.text(q, 'Пусто', 42, 20, INK, 'small', 'center'); return; }
    items.slice(top, top + 3).forEach((it, k) => {
      const i = top + k, y = 11 + k * 9, on = i === sel;
      if (on) { q.fillStyle = INK; q.fillRect(0, y, 80, 9); }
      row(it, y, on ? ON : INK);
    });
    scrollbar(sel, items.length);
  }
  const fit = (s, w) => { let r = s; while (F.width('small', r) > w && r.length > 1) r = r.slice(0, -1); return r === s ? s : r.slice(0, -1) + '…'; };
  function idle() {
    pic(q, 'ant', 0, 1, INK); pic(q, 'bat', 79, 1, INK);
    q.fillStyle = INK; [[0, 32, 2], [0, 28, 3], [0, 24, 4], [0, 20, 5]].forEach(([x, y, w]) => q.fillRect(x, y, w, 2));
    [[82, 32, 2], [81, 28, 3], [80, 24, 4]].forEach(([x, y, w]) => q.fillRect(x, y, w, 2));
    F.text(q, clock(), 42, 0, INK, 'small', 'center');
    if (dial) { F.text(q, dial.length > 9 ? dial.slice(-9) : dial, 42, 15, INK, 'bold', 'center'); soft('Вызов'); return; }
    F.text(q, 'NORDIK', 42, 11, INK, 'bold', 'center');
    const u = unread(), m = missed();
    if (u || m) {
      if (u) pic(q, 'env', 11, 1, INK);
      F.text(q, u ? u + ' ' + plural(u, ['новое SMS', 'новых SMS', 'новых SMS']) : m + ' ' + plural(m, ['пропущенный', 'пропущенных', 'пропущенных']), 42, 26, INK, 'small', 'center');
    }
    soft('Меню');
  }
  function ringing() {
    const k = t - call.at;
    if (call.state === 'ring') {
      if (Math.floor(k * 3) % 2) pic(q, 'calls', 31, 1, INK);
      F.text(q, fit(call.who, 80), 42, 15, INK, 'bold', 'center');
      F.text(q, 'вызывает', 42, 27, INK, 'small', 'center');
      soft('Ответить');
    } else if (call.state === 'talk') {
      F.text(q, fit(call.who, 80), 42, 4, INK, 'bold', 'center');
      F.text(q, mmss(k), 42, 20, INK, 'small', 'center');
      soft('Отбой');
    } else if (call.state === 'out') {
      F.text(q, 'Вызов' + '...'.slice(0, Math.floor(k * 2) % 4), 2, 2, INK, 'small');
      F.text(q, fit(call.who, 80), 42, 17, INK, 'bold', 'center');
      soft('Отбой');
    } else {
      F.text(q, call.note, 42, 12, INK, 'small', 'center');
      if (call.dur) F.text(q, mmss(call.dur), 42, 24, INK, 'small', 'center');
    }
  }
  function draw(gc, w, h) {
    q.fillStyle = ON; q.fillRect(0, 0, 84, 48);
    if (call) ringing();
    else if (view === 'idle') idle();
    else if (view === 'menu') {
      const m = MENU[menuI];
      F.text(q, m.title, 1, 0, INK, 'bold'); F.text(q, String(menuI + 1), 79, 0, INK, 'small', 'right');
      pic(q, m.pic, 42 - (PIC[m.pic][0].length >> 1), 15, INK);
      scrollbar(menuI, MENU.length, 14, 22); soft('Выбрать');
    } else if (view === 'inbox') {
      head('Входящие', inbox.length ? (sel + 1) + '/' + inbox.length : '');
      list(inbox, (m, y, c) => { if (!m.read) pic(q, 'env', 1, y + 2, c); F.text(q, fit(m.from, 70), 10, y - 1, c, 'small'); });
      soft(inbox.length ? 'Читать' : '');
    } else if (view === 'read') {
      const m = inbox[sel0], lines = textLines();
      head(fit(m.from, 52), m.when);
      lines.slice(line, line + 3).forEach((l, i) => F.text(q, l, 1, 11 + i * 9, INK, 'small'));
      if (lines.length > 3) scrollbar(line, lines.length - 2);
      soft('Назад');
    } else if (view === 'calls') {
      head('Звонки', calls.length ? (sel + 1) + '/' + calls.length : '');
      list(calls, (c, y, col) => { pic(q, c.type, 1, y + 2, col); F.text(q, fit(c.who, 58) + (c.n > 1 ? ' x' + c.n : ''), 9, y - 1, col, 'small'); });
      soft(calls.length ? 'Подробно' : '');
    } else if (view === 'info') {
      const c = calls[sel0];
      head(fit(c.who, 80));
      F.text(q, { missed: 'Пропущенный', in: 'Входящий', out: 'Исходящий' }[c.type] + (c.n > 1 ? ' x' + c.n : ''), 1, 11, INK, 'small');
      F.text(q, c.day + ' ' + c.when, 1, 20, INK, 'small');
      F.text(q, c.dur ? 'Длит. ' + c.dur : c.num || '', 1, 29, INK, 'small');
      soft('Назад');
    }
    gc.imageSmoothingEnabled = false; gc.drawImage(cv, 0, 0, w, h); gc.imageSmoothingEnabled = true;
    gc.fillStyle = 'rgba(0,0,0,.05)';
    for (let x = 0; x < w; x += w / 84) gc.fillRect(Math.round(x), 0, 1, h);
    for (let y = 0; y < h; y += h / 48) gc.fillRect(0, Math.round(y), w, 1);
  }
  return { key, tick, draw };
}
const plural = (n, f) => f[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2];
// in use: the screen, the navi pad and the first row of keys fill the view; the C key and the arrows share the pad with the navi key
const use = {
  frame: [-1.08, -0.85, 1.08, 2.45],
  keys: [
    { id: 'navi', slot: 'phKeys', mesh: 'key_navi', at: [0, NAV.top - NAV.sag - 0.11, 0.5], r: 0.2 },
    { id: 'c', slot: 'phKeys', mesh: 'navi_pad', at: [-0.42, 0.14, 0.46], r: 0.17, tilt: [0, -0.1] },
    { id: 'up', slot: 'phKeys', mesh: 'navi_pad', at: [0.42, 0.21, 0.46], r: 0.11, tilt: [-0.07, 0.1] },
    { id: 'down', slot: 'phKeys', mesh: 'navi_pad', at: [0.42, 0.06, 0.46], r: 0.11, tilt: [0.07, 0.1] },
    ...KEYS.map((k, i) => ({ id: 'k' + (i + 1), slot: 'phKeys', mesh: 'key_' + (i + 1), at: [k.x, k.y, 0.46], r: 0.21 })),
    { id: 'power', slot: 'phShell', mesh: 'power_key', at: [0, H / 2 - 0.02, 0.12], r: 0.2, push: [0, -0.03, 0] },
  ],
  lcd: ['phLcd', 'lcd_panel'],
  kbd: { Enter: 'navi', Space: 'navi', Backspace: 'c', Escape: 'c', ArrowUp: 'up', ArrowDown: 'down',
    ...Object.fromEntries('1234567890'.split('').flatMap(d => { const id = 'k' + (d === '0' ? 11 : +d); return [['Digit' + d, id], ['Numpad' + d, id]]; })) },
};

/* ---------- the whole phone, assembled (reference sheet) ---------- */
function build(opt) {
  const k = kit(opt || {}), root = new T.Group(); root.name = 'nordik_3300';
  ['phShell', 'phPcb', 'phLcd', 'phEar', 'phKeys', 'phFront', 'phBatt', 'phCover'].forEach(t => { const p = k.make[t](opt || {}); p.position.copy(k.pose[t]); root.add(p); });
  [1, 2, 3, 4].forEach(i => { const s = k.make.screw(i); root.add(s); });
  return { root, materials: k.materials, kit: k };
}

window.BrickPhone = { kit, build, drawScreen, app, use };
})();
