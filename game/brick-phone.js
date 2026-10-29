/* Nordik 3300: the candybar phone with snap-on colour covers, built in code like the Pocket Pal.
   Axes as in pocket-pal.js: X right, Y up, the keypad looks at +Z and the battery cover at -Z. The body is 2.1 × 4.9 × 1.04.
   The front cover, keymat, display, earpiece and board come off from the front; the back cover and battery from the back,
   and the four Torx screws holding the board sit in the battery bay. */
(function () {
'use strict';
const T = THREE, { rr, disc, stadium, extrude, roundedBox, lathe, merge, canvasTex, fitText, rng, at } = PocketPal.util;

/* ---------- layout, in device units ---------- */
const W = 2.1, H = 4.9, TOPR = 0.62, BOTR = 0.42;     // body width and height, height of the rounded top, bottom corner radius
const FACE = 0.42, BACK = -0.52;                       // front face of the cover and outer face of the battery cover
const SCR = { y: 1.22, w: 1.5, h: 1.0 };               // screen window
const LCDP = { w: 1.32, h: 0.76 };                     // the lit glass, 84 × 48 pixels
const EAR = [0, 2.1], BRAND_Y = 1.86;
const NAVI = { y: 0.28 }, CKEY = [0.74, 0.28], ROCK = [-0.74, 0.28];
const KEYS = []; [-0.42, -0.92, -1.42, -1.92].forEach(y => [-0.62, 0, 0.62].forEach((x, c) => KEYS.push([x, y + (c === 1 ? 0 : 0.05)])));
const MIC = [0, -2.3];
const BAY = { y: -0.62, w: 1.72, h: 2.56 };            // battery bay in the back
const SCREWS = [[-0.62, 0.42], [0.62, 0.42], [-0.62, -1.66], [0.62, -1.66]];
const PCB = { z: 0.09, t: 0.07 };
const CONN = [0, -1.7];                                // battery connector, through a window in the bay floor
const LCD_ON = '#a3c44c', LCD_INK = '#1c2610', LCD_OFF = '#394232';

/* ---------- outlines ---------- */
// the body outline: a rounded top, straight sides and rounded bottom corners, moved in by d
function bodyPts(d = 0, n = 24) {
  const hw = W / 2 - d, hb = -H / 2 + d, ht = H / 2 - d, ry = TOPR - d * 0.6, r = Math.max(0.05, BOTR - d), p = [];
  const arc = (cx, cy, rx, ry2, a0, a1, k) => { for (let i = 0; i <= k; i++) { const a = a0 + (a1 - a0) * i / k; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry2]); } };
  arc(hw - r, hb + r, r, r, -Math.PI / 2, 0, n / 2);
  arc(0, ht - ry, hw, ry, 0, Math.PI, n * 2);
  arc(-hw + r, hb + r, r, r, Math.PI, Math.PI * 1.5, n / 2);
  return p;
}
function shapeFrom(pts, path = false) {
  const s = path ? new T.Path() : new T.Shape();
  pts.forEach(([x, y], i) => { if (i) s.lineTo(x, y); else s.moveTo(x, y); });
  s.closePath();
  return s;
}
function planar(geo, x0, y0, w, h) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - x0) / w; uv[i * 2 + 1] = (p.getY(i) - y0) / h; }
  geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
  return geo;
}
const faceBox = { x0: -W / 2, y0: -H / 2, w: W, h: H };
const boardBox = { x0: -W / 2 + 0.13, y0: -H / 2 + 0.13, w: W - 0.26, h: H - 0.26 };

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
  q.fillStyle = LCD_INK; q.textBaseline = 'alphabetic';
  if (phase < 0.7) {
    q.font = '900 13px Arial'; q.textAlign = 'center'; q.fillText('NORDIK', 42, 27);
    q.font = '700 7px Arial'; q.fillText('3300', 42, 38);
  } else {
    // a game of snake: the border, the score, the food and the snake running along
    q.fillRect(0, 9, 84, 1); q.fillRect(0, 47, 84, 1); q.fillRect(0, 9, 1, 39); q.fillRect(83, 9, 1, 39);
    q.font = '700 8px Arial'; q.textAlign = 'left'; q.fillText('0012', 1, 7);
    q.textAlign = 'right'; q.fillText('ЗМЕЙКА', 83, 7);
    q.fillRect(60, 26, 3, 3);
    const t = (phase - 0.7) * 40, head = Math.floor(t) % 26;
    for (let i = 0; i < 9; i++) { const c = head - i; if (c >= 0) q.fillRect(4 + c * 3, 26, 3, 3); }
    if (phase > 1.25) { q.textAlign = 'center'; q.font = '900 9px Arial'; q.fillText('АЛЛО!', 42, 20); }
  }
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
    for (let i = 0; i < 1600; i++) { const c = 225 + r() * 28 | 0; g.fillStyle = `rgba(${c},${c},${c},${0.2 + r() * 0.3})`; g.fillRect(r() * w, r() * h, 1 + r(), 1 + r()); }
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
      g.fillStyle = faded ? 'rgba(40,40,46,.22)' : '#1f2228';
      g.font = `800 ${ch * .62}px ${mono}`; g.textAlign = 'center'; g.fillText(d, x + cw * .36, y + ch * .74);
      g.font = `700 ${ch * .3}px ${mono}`; g.textAlign = 'left'; g.fillText(l, x + cw * .55, y + ch * .66);
    });
  });
  X.keys = keyFace(false); X.keysWorn = keyFace(true);
  X.navi = canvasTex(256, 96, (g, w, h) => { g.strokeStyle = 'rgba(230,236,245,.75)'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(w * .22, h * .42); g.quadraticCurveTo(w / 2, h * .82, w * .78, h * .42); g.stroke(); });
  X.cKey = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#1f2228'; g.font = `800 40px ${mono}`; g.textAlign = 'center'; g.fillText('C', w / 2, h * .74); });
  X.label = (fresh) => canvasTex(512, 768, (g, w, h) => {
    const r = rng(fresh ? 3 : 4);
    g.fillStyle = fresh ? '#eef3f8' : '#d9d4c6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(80,70,60,${r() * .06})`; g.fillRect(r() * w, r() * h, 2, 2); }
    g.fillStyle = fresh ? '#2f6f9e' : '#3b3f46'; g.fillRect(0, 0, w, 120);
    g.fillStyle = '#ffffff'; fitText(g, 'NORDIK', w / 2, 84, w * .7, 64, 700, font, 'center');
    g.fillStyle = '#1f2228';
    fitText(g, 'BNK-33', w / 2, 230, w * .7, 70, 800, mono, 'center');
    fitText(g, 'Li-Ion  3.6 V', w / 2, 300, w * .8, 40, 700, mono, 'center');
    fitText(g, '900 mAh', w / 2, 352, w * .8, 40, 700, mono, 'center');
    fitText(g, fresh ? 'НОВЫЙ · ПРОВЕРЕН' : 'MADE 2000', w / 2, 430, w * .8, 30, 700, mono, 'center');
    g.strokeStyle = '#1f2228'; g.lineWidth = 4;
    [[120, 560], [256, 560], [392, 560]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 46, 0, 7); g.stroke(); });
    fitText(g, 'Li', 120, 576, 60, 44, 800, mono, 'center'); fitText(g, 'CE', 256, 576, 60, 40, 800, mono, 'center'); fitText(g, '+ −', 392, 574, 70, 40, 800, mono, 'center');
    fitText(g, 'Не бросать в огонь · не разбирать', w / 2, 690, w * .86, 26, 700, mono, 'center');
  });
  X.labelOld = X.label(false); X.labelNew = X.label(true);
  X.grille = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#1a1b1e'; g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill();
    g.fillStyle = '#050506'; for (let y = 10; y < 120; y += 9) for (let x = 10; x < 120; x += 9) if (Math.hypot(x - 64, y - 64) < 50) { g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); }
  });
  X.sim = canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#e9e4d6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c84a32'; g.fillRect(0, 0, w, 34); g.fillStyle = '#fff'; fitText(g, 'РЕТРО-СВЯЗЬ', 12, 25, w * .9, 22, 800, mono);
    const gr = g.createLinearGradient(30, 60, 110, 130); gr.addColorStop(0, '#f4d27a'); gr.addColorStop(1, '#b8892f');
    g.fillStyle = gr; g.fillRect(30, 58, 80, 70); g.strokeStyle = '#8a6a2a'; g.lineWidth = 2; g.strokeRect(30, 58, 80, 70);
    g.beginPath(); g.moveTo(70, 58); g.lineTo(70, 128); g.moveTo(30, 93); g.lineTo(110, 93); g.stroke();
    g.fillStyle = '#3b3f46'; fitText(g, '89 7 01 2000', 128, 100, 120, 18, 700, mono);
  });
  X.torx = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#26282c'; g.beginPath();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = i % 2 ? 11 : 20; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    g.fill();
  });
  X.pcbFront = canvasTex(512, 1180, (g, w, h) => drawBoard(g, w, h, false, mono));
  X.pcbBack = canvasTex(512, 1180, (g, w, h) => drawBoard(g, w, h, true, mono));
  X.shield = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e6e8ec'); gr.addColorStop(1, '#a9adb4'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(60,64,70,.35)'; for (let y = 20; y < h; y += 34) for (let x = 20; x < w; x += 34) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(40,44,50,.6)'; fitText(g, 'NRD', w / 2, h / 2 + 10, w * .5, 34, 800, mono, 'center');
  });
  X.lcdBack = canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2a2e'; fitText(g, 'LCD 84×48 · 3300', 12, 40, w - 24, 22, 700, font); fitText(g, 'LOT 0021', 12, 74, w - 24, 18, 600, font); });
  X.ready = true;
  return X;
}
// The cover print: the paint itself with a soft sheen, the frame round the screen, the brand and the earpiece slots
function frontPrint(body, trim, font) {
  return canvasTex(400, Math.round(400 * H / W), (g, w, h) => {
    const S = w / faceBox.w, P = (x, y) => [(x - faceBox.x0) * S, (faceBox.y0 + faceBox.h - y) * S];
    const col = n => '#' + n.toString(16).padStart(6, '0');
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, col(body)); gr.addColorStop(.45, col(trim)); gr.addColorStop(1, col(body));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const [fx, fy] = P(-SCR.w / 2 - 0.07, SCR.y + SCR.h / 2 + 0.07);
    g.strokeStyle = 'rgba(30,32,40,.55)'; g.lineWidth = 5; g.beginPath(); g.roundRect ? g.roundRect(fx, fy, (SCR.w + .14) * S, (SCR.h + .14) * S, 24) : g.rect(fx, fy, (SCR.w + .14) * S, (SCR.h + .14) * S); g.stroke();
    const [bx, by] = P(0, BRAND_Y - 0.06);
    g.font = `700 ${0.2 * S}px ${font}`; g.textAlign = 'center'; g.fillStyle = 'rgba(235,238,245,.92)'; g.fillText('NORDIK', bx, by);
    const [mx, my] = P(0, -2.2); g.font = `800 ${0.1 * S}px Nunito, Arial`; g.fillStyle = 'rgba(235,238,245,.6)'; g.fillText('3300', mx, my);
  });
}

// Board artwork in device units; the back is mirrored because it is viewed from -Z.
function drawBoard(g, w, h, back, mono) {
  const S = w / boardBox.w, r = rng(back ? 27 : 28);
  const P = (x, y) => [((back ? -x : x) - boardBox.x0) * S, (boardBox.y0 + boardBox.h - y) * S];
  g.fillStyle = '#1d5a36'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.06})`; g.fillRect(r() * w, r() * h, 2, 2); }
  const line = (pts, width = 4) => { g.lineCap = g.lineJoin = 'round'; [['#164a2b', width + 6], ['#2c7a4b', width]].forEach(([c, lw]) => { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); pts.forEach(([x, y], i) => { const [X, Y] = P(x, y); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke(); }); };
  const text = (t, x, y, size) => { const [X, Y] = P(x, y); g.fillStyle = '#e8ebe2'; g.font = `700 ${size}px ${mono}`; g.textAlign = 'center'; g.fillText(t, X, Y); };
  const pad = (x, y, pw, ph, color = '#d4b062') => { const [X, Y] = P(x, y); g.fillStyle = color; g.fillRect(X - pw * S / 2, Y - ph * S / 2, pw * S, ph * S); };
  for (let i = 0; i < 26; i++) { let x = -0.8 + r() * 1.6, y = -2.1 + r() * 4.2; const pts = [[x, y]]; for (let k = 0; k < 3; k++) { if (k % 2) y += (r() - .5) * .5; else x += (r() - .5) * .5; pts.push([x, y]); } line(pts, 3); }
  SCREWS.forEach(([x, y]) => { const [X, Y] = P(x, y); g.fillStyle = '#d4b062'; g.beginPath(); g.arc(X, Y, 0.12 * S, 0, 7); g.fill(); g.fillStyle = '#164a2b'; g.beginPath(); g.arc(X, Y, 0.08 * S, 0, 7); g.fill(); });
  if (!back) {
    // gold rings with carbon centres under every key, contacts for the display and the earpiece
    const contact = (x, y, rx, ry) => { const [X, Y] = P(x, y); g.fillStyle = '#d4b062'; g.beginPath(); g.ellipse(X, Y, rx * S, ry * S, 0, 0, 7); g.fill(); g.fillStyle = '#26272b'; g.beginPath(); g.ellipse(X, Y, rx * S * .62, ry * S * .62, 0, 0, 7); g.fill(); };
    KEYS.forEach(([x, y]) => contact(x, y, 0.2, 0.11));
    contact(0, NAVI.y, 0.34, 0.15); contact(...CKEY, 0.12, 0.12); contact(ROCK[0], ROCK[1] + 0.14, 0.1, 0.08); contact(ROCK[0], ROCK[1] - 0.14, 0.1, 0.08);
    for (let k = 0; k < 18; k++) pad(-0.51 + k * 0.06, SCR.y - SCR.h / 2 - 0.12, 0.03, 0.12);
    pad(EAR[0] - 0.12, EAR[1], 0.1, 0.1); pad(EAR[0] + 0.12, EAR[1], 0.1, 0.1);
    text('NORDIK 3300 · UI-2', 0, SCR.y + 0.05, 20); text('© 2000', 0, SCR.y - 0.12, 16);
  } else {
    text('NRD-3300 MAIN', 0, 1.75, 22); text('REV 04 · 2000', 0, 1.6, 16);
    pad(CONN[0] - 0.2, CONN[1], 0.12, 0.22); pad(CONN[0], CONN[1], 0.12, 0.22); pad(CONN[0] + 0.2, CONN[1], 0.12, 0.22);
    text('BAT  −  BSI  +', 0, CONN[1] - 0.24, 16);
  }
}

/* ---------- materials ---------- */
function materials(o, X) {
  const S = (color, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.5, metalness: 0 }, extra));
  const decal = (map, extra) => S(0xffffff, Object.assign({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, extra));
  const body = S(o.body, { map: X.grain, roughness: 0.3, envMapIntensity: 0.7 });
  const M = {
    body, coverBody: S(o.body, { map: X.grain, roughness: 0.42, envMapIntensity: 0.55 }),
    face: S(0xffffff, { map: frontPrint(o.body, o.trim, o.font), roughness: 0.28, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    chassis: S(0x3a3d42, { roughness: 0.6, envMapIntensity: 0.4 }), chassisDark: S(0x26282c, { roughness: 0.7 }),
    rubber: S(0x2b2d31, { roughness: 0.8 }), key: S(0xd9dde2, { roughness: 0.45 }), keyWorn: S(0xa7a9a4, { roughness: 0.85 }), navi: S(0x3c4c6c, { roughness: 0.3 }),
    keyPrint: decal(X.keys), keyPrintWorn: decal(X.keysWorn), naviPrint: decal(X.navi), cPrint: decal(X.cKey),
    glass: S(0xffffff, { roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide }),
    lcd: new T.MeshBasicMaterial({ map: o.screen || X.lcd }), lcdBezel: S(0x1d2024, { roughness: 0.4 }), ink: new T.MeshBasicMaterial({ map: X.ink, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    lcdBack: decal(X.lcdBack, { transparent: false, depthWrite: true }),
    steel: S(0xc9ccd1, { metalness: 0.85, roughness: 0.3 }), shield: S(0xffffff, { map: X.shield, metalness: 0.7, roughness: 0.35 }),
    pcbEdge: S(0x24603b, { roughness: 0.5 }), pcbFront: S(0xffffff, { map: X.pcbFront, roughness: 0.42 }), pcbBack: S(0xffffff, { map: X.pcbBack, roughness: 0.42 }),
    gold: S(0xd8aa50, { metalness: 0.85, roughness: 0.3 }), black: S(0x141416, { roughness: 0.6 }), flex: S(0xd9822b, { roughness: 0.4 }), led: S(0x9be36b, { roughness: 0.3, emissive: 0x2a5a14 }),
    grille: S(0xffffff, { map: X.grille, roughness: 0.7 }), cell: S(0x2c2f35, { roughness: 0.45, metalness: 0.2 }), cellNew: S(0x2c4f75, { roughness: 0.4, metalness: 0.2 }),
    labelOld: S(0xffffff, { map: X.labelOld, roughness: 0.7 }), labelNew: S(0xffffff, { map: X.labelNew, roughness: 0.6 }),
    sim: S(0xffffff, { map: X.sim, roughness: 0.6 }), crack: decal(X.crack, { roughness: 0.3 }), scorch: decal(X.scorch),
    torx: new T.MeshBasicMaterial({ map: X.torx, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    screw: S(0xb9bdc4, { metalness: 0.9, roughness: 0.28 }),
  };
  return M;
}

/* ---------- the parts kit ---------- */
function kit(opt) {
  const o = Object.assign({ body: 0x23356b, trim: 0x3d528f, font: '"Unbounded", "Arial Black", sans-serif', screen: null }, opt);
  const X = textures(o.font), M = materials(o, X);
  const group = (parent, name, x = 0, y = 0, z = 0, explode = 0) => { const g = new T.Group(); g.name = name; g.position.set(x, y, z); if (explode) g.userData.explode = explode; if (parent) parent.add(g); return g; };
  const mesh = (parent, name, geo, mat, x = 0, y = 0, z = 0) => { const m = new T.Mesh(geo, mat); m.name = name; m.position.set(x, y, z); parent.add(m); return m; };
  const back = m => { m.rotation.y = Math.PI; return m; };
  const plane = (w, h) => new T.PlaneGeometry(w, h);
  const cyl = (r, len, seg = 32) => { const c = new T.CylinderGeometry(r, r, len, seg); c.rotateX(Math.PI / 2); return c; };
  const ring = (dOut, dIn) => { const s = shapeFrom(bodyPts(dOut)); s.holes.push(shapeFrom(bodyPts(dIn), true)); return s; };
  const make = {}, pose = {};

  /* the snap-on front cover: face with the window and key holes, sides wrapping round to the middle of the body */
  const coverHoles = () => [
    rr(SCR.w, SCR.h, 0.14, 0, SCR.y, true),
    stadium(0.44, 0.06, 0, 0, 2.04), stadium(0.4, 0.06, 0, 0, 2.14), stadium(0.3, 0.06, 0, 0, 2.24),
    stadium(0.98, 0.46, 0, 0, NAVI.y), disc(0.17, ...CKEY), stadium(0.52, 0.24, Math.PI / 2, ...ROCK),
    ...KEYS.map(([x, y]) => stadium(0.58, 0.32, 0, x, y)), disc(0.035, ...MIC),
  ];
  const facePlate = (() => { const s = shapeFrom(bodyPts(0.05)); s.holes.push(...coverHoles()); return extrude(s, 0.12, 0.05, 4); })();
  const printShape = (() => { const s = shapeFrom(bodyPts(0.1)); s.holes.push(...coverHoles()); return s; })();
  const printGeo = planar(new T.ShapeGeometry(printShape, 12), faceBox.x0, faceBox.y0, faceBox.w, faceBox.h);
  const crackGeo = planar(new T.ShapeGeometry(printShape, 12), 0.35 - 0.8, -0.95 - 0.8, 1.6, 1.6);
  const sideGeo = extrude(ring(0.003, 0.09), 0.45, 0.012, 2);
  make.phFront = ({ cracked } = {}) => {
    const g = group(null, 'front_cover', 0, 0, 0, 1.6);
    mesh(g, 'cover_face', facePlate, M.body, 0, 0, FACE - 0.06);
    mesh(g, 'cover_sides', sideGeo, M.body, 0, 0, 0.075);
    mesh(g, 'cover_print', printGeo, M.face, 0, 0, FACE + 0.0015);
    mesh(g, 'window_glass', plane(SCR.w - 0.02, SCR.h - 0.02), M.glass, 0, SCR.y, FACE - 0.02);
    if (cracked) mesh(g, 'cover_crack', crackGeo, M.crack, 0, 0, FACE + 0.0025);
    return g;
  };

  /* the rubber keymat: navi key, C, the scroll rocker and twelve number keys with their print */
  const capGeo = lathe([[0, 0], [0.2, 0], [0.2, 0], [0.2, 0.1], [0.19, 0.14], [0.16, 0.165], [0.1, 0.175], [0, 0.178]], 32); capGeo.rotateX(Math.PI / 2);
  const numGeo = capGeo.clone().scale(1.3, 0.68, 1), naviGeo = lathe([[0, 0], [0.2, 0], [0.2, 0], [0.2, 0.12], [0.19, 0.16], [0.16, 0.19], [0.08, 0.2], [0, 0.2]], 32);
  naviGeo.rotateX(Math.PI / 2); naviGeo.scale(2.3, 1.0, 1);
  const cGeo = capGeo.clone().scale(0.75, 0.75, 1), rockGeo = capGeo.clone().scale(0.55, 1.25, 1);
  const sheetGeo = extrude(rr(1.86, 3.0, 0.3, 0, -0.85), 0.05, 0.01, 1);
  const keyPlane = i => { const p = plane(0.36, 0.17), c = i % 3, r = i / 3 | 0, u0 = c / 3, u1 = (c + 1) / 3, v1 = 1 - r / 4, v0 = 1 - (r + 1) / 4; p.setAttribute('uv', new T.Float32BufferAttribute([u0, v1, u1, v1, u0, v0, u1, v0], 2)); return p; };
  make.phKeys = ({ worn } = {}) => {
    const g = group(null, 'keymat', 0, 0, 0, 1.2), base = 0.28;
    mesh(g, 'keymat_sheet', sheetGeo, M.rubber, 0, 0, 0.255);
    const navi = group(g, 'key_navi', 0, NAVI.y, base);
    mesh(navi, 'navi_cap', naviGeo, M.navi); mesh(navi, 'navi_print', plane(0.6, 0.22), M.naviPrint, 0, 0, 0.202);
    const c = group(g, 'key_c', ...CKEY, base); mesh(c, 'c_cap', cGeo, M.key); mesh(c, 'c_print', plane(0.18, 0.18), M.cPrint, 0, 0, 0.18);
    mesh(g, 'key_scroll', rockGeo, M.key, ...ROCK, base);
    KEYS.forEach(([x, y], i) => {
      const k = group(g, 'key_' + (i + 1), x, y, base - (worn && i === 4 ? 0.06 : 0));
      mesh(k, 'cap', numGeo, worn ? M.keyWorn : M.key); mesh(k, 'print', keyPlane(i), worn ? M.keyPrintWorn : M.keyPrint, 0, 0, 0.1795);
    });
    return g;
  };

  /* the display module in its metal frame, with the flex down to the board */
  const frameGeo = roundedBox(1.62, 1.08, 0.1, 0.02);
  make.phLcd = ({ cracked } = {}) => {
    const g = group(null, 'display', 0, SCR.y, 0.24, 1.1);
    mesh(g, 'lcd_frame', frameGeo, M.steel);
    mesh(g, 'lcd_bezel', plane(1.5, 0.96), M.lcdBezel, 0, 0, 0.0502);
    g.userData.panel = mesh(g, 'lcd_panel', plane(LCDP.w, LCDP.h), M.lcd, 0, 0, 0.0506);
    if (cracked) mesh(g, 'lcd_ink', plane(LCDP.w, LCDP.h), M.ink, 0, 0, 0.0512);
    mesh(g, 'lcd_flex', new T.BoxGeometry(0.6, 0.12, 0.008), M.flex, 0, -0.6, -0.06);
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

  /* the main board: key contacts in front, shield cans and the battery connector behind */
  const boardShape = () => { const s = shapeFrom(bodyPts(0.13)); SCREWS.forEach(([x, y]) => s.holes.push(disc(0.075, x, y))); return s; };
  const boardGeo = extrude(boardShape(), PCB.t, 0.004, 1), boardPrint = planar(new T.ShapeGeometry(boardShape(), 12), boardBox.x0, boardBox.y0, boardBox.w, boardBox.h);
  make.phPcb = ({ burnt, loose } = {}) => {
    const g = group(null, 'board'), zf = PCB.z + PCB.t / 2, zb = PCB.z - PCB.t / 2;
    mesh(g, 'pcb_board', boardGeo, M.pcbEdge, 0, 0, PCB.z);
    mesh(g, 'pcb_front_print', boardPrint, M.pcbFront, 0, 0, zf + 0.0008);
    back(mesh(g, 'pcb_back_print', boardPrint, M.pcbBack, 0, 0, zb - 0.0008));
    mesh(g, 'shield_big', roundedBox(0.95, 1.05, 0.1, 0.02), M.shield, 0, 0.95, zb - 0.05);
    mesh(g, 'shield_small', roundedBox(0.75, 0.55, 0.08, 0.02), M.shield, 0.2, -0.45, zb - 0.04);
    const vib = new T.CylinderGeometry(0.1, 0.1, 0.32, 20); vib.rotateZ(Math.PI / 2); mesh(g, 'vibra', vib, M.steel, -0.55, -1.15, zb - 0.1);
    mesh(g, 'mic', cyl(0.07, 0.06, 20), M.black, MIC[0], MIC[1] + 0.06, zf + 0.03);
    [[-0.31, -0.67], [0.31, -0.67], [-0.31, -1.67], [0.31, -1.67], [-0.45, 0.62], [0.45, 0.62]].forEach(([x, y], i) => mesh(g, 'led_' + (i + 1), roundedBox(0.08, 0.05, 0.04, 0.01), M.led, x, y, zf + 0.02));
    const conn = group(g, 'battery_connector', CONN[0], CONN[1], zb);
    mesh(conn, 'housing', roundedBox(0.66, 0.26, 0.1, 0.02), M.black, 0, 0, -0.05);
    [-0.2, 0, 0.2].forEach((x, i) => {
      const f = mesh(conn, 'finger_' + (i + 1), roundedBox(0.07, 0.16, 0.26, 0.015), M.gold, x, 0, -0.2);
      if (loose && i === 2) { f.rotation.x = 0.7; f.position.z = -0.15; f.position.y = 0.08; }
    });
    if (burnt) back(mesh(g, 'pcb_scorch', plane(0.9, 0.9), M.scorch, 0.1, -0.9, zb - 0.002));
    return g;
  };

  /* the BNK-33 battery: label out, contacts on its inner face; it bulges when it swells */
  make.phBatt = ({ swollen, fresh } = {}) => {
    const g = group(null, 'battery', 0, BAY.y, -0.355, -1.3);
    const hw = 0.81, hh = 1.22, bulge = swollen ? 0.09 : 0;
    const f = (x, y) => Math.max(0, 1 - (x / hw) ** 2) * Math.max(0, 1 - (y / hh) ** 2);
    mesh(g, 'battery_case', roundedBox(1.62, 2.44, 0.17, 0.05, [14, 18, 2], v => { if (v.z < 0) v.z -= bulge * f(v.x, v.y); }), fresh ? M.cellNew : M.cell);
    const lg = new T.PlaneGeometry(1.4, 2.1, 20, 24); lg.rotateY(Math.PI);
    const lp = lg.attributes.position; for (let i = 0; i < lp.count; i++) lp.setZ(i, -0.0862 - bulge * f(lp.getX(i), lp.getY(i)));
    lg.computeVertexNormals();
    mesh(g, 'battery_label', lg, fresh ? M.labelNew : M.labelOld, 0, 0.05, 0);
    [-0.2, 0, 0.2].forEach((x, i) => mesh(g, 'battery_contact_' + (i + 1), plane(0.1, 0.18), M.gold, x, CONN[1] - BAY.y, 0.0862));
    return g;
  };

  /* the battery cover: snaps on, no screws, a release catch at the bottom */
  const coverShape = rr(W - 0.06, 3.62, 0.36);
  const coverGeo = extrude(coverShape, 0.08, 0.025, 3);
  const coverPrint = canvasTex(256, 440, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,.18)'; g.font = `700 34px ${o.font}`; g.textAlign = 'center'; g.fillText('NORDIK', w / 2, h * .22);
    g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 3; for (let y = h * .72; y < h * .88; y += 10) { g.beginPath(); g.moveTo(w * .22, y); g.lineTo(w * .78, y); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(w * .44, h * .93); g.lineTo(w * .56, h * .93); g.lineTo(w * .5, h * .97); g.fill();
  });
  const coverPrintMat = M.coverBody.clone(); coverPrintMat.map = coverPrint; coverPrintMat.color.setHex(0xffffff); coverPrintMat.transparent = true; coverPrintMat.depthWrite = false;
  coverPrintMat.polygonOffset = true; coverPrintMat.polygonOffsetFactor = -2; coverPrintMat.polygonOffsetUnits = -2;
  make.phCover = () => {
    const g = group(null, 'battery_cover', 0, BAY.y, -0.48, -1.6);
    mesh(g, 'cover_plate', coverGeo, M.coverBody);
    back(mesh(g, 'cover_print', plane(1.6, 2.75), coverPrintMat, 0, 0.1, -0.0412));
    mesh(g, 'release_catch', roundedBox(0.5, 0.16, 0.05, 0.02), M.chassisDark, 0, -1.62, -0.05);
    return g;
  };

  /* the chassis everything sits in: dark grey sides, the back deck, the battery bay with the SIM, screws' posts */
  const sides = extrude(ring(0.004, 0.09), 0.3, 0.012, 2);
  const deck = (() => { const s = shapeFrom(bodyPts(0.01)); s.holes.push(rr(BAY.w + 0.04, BAY.h + 0.04, 0.14, 0, BAY.y, true)); return extrude(s, 0.06, 0.012, 2); })();
  const floor = (() => { const s = rr(BAY.w + 0.06, BAY.h + 0.06, 0.14, 0, BAY.y); SCREWS.forEach(([x, y]) => s.holes.push(disc(0.075, x, y))); s.holes.push(rr(0.7, 0.32, 0.06, CONN[0], CONN[1], true)); return extrude(s, 0.04, 0.005, 1); })();
  const bayWall = (() => { const s = rr(BAY.w + 0.1, BAY.h + 0.1, 0.16, 0, BAY.y); s.holes.push(rr(BAY.w, BAY.h, 0.12, 0, BAY.y, true)); return extrude(s, 0.24, 0.006, 1); })();
  make.phShell = () => {
    const g = group(null, 'chassis');
    mesh(g, 'chassis_sides', sides, M.chassis, 0, 0, -0.3);
    mesh(g, 'back_deck', deck, M.chassis, 0, 0, -0.42);
    mesh(g, 'bay_floor', floor, M.chassisDark, 0, 0, -0.21);
    mesh(g, 'bay_wall', bayWall, M.chassis, 0, 0, -0.33);
    mesh(g, 'antenna_hump', roundedBox(1.7, 0.95, 0.07, 0.2), M.chassis, 0, 1.75, -0.47);
    back(mesh(g, 'sim_card', plane(0.95, 0.6), M.sim, 0, 0.0, -0.2312));
    SCREWS.forEach(([x, y], i) => mesh(g, 'screw_post_' + (i + 1), cyl(0.1, 0.245, 18), M.chassisDark, x, y, -0.0675));
    const jack = mesh(g, 'charger_jack', new T.CylinderGeometry(0.09, 0.09, 0.06, 20), M.black, 0.35, -H / 2 + 0.01, -0.3);
    mesh(g, 'power_key', roundedBox(0.5, 0.1, 0.22, 0.04), M.chassisDark, 0.25, H / 2 - 0.03, -0.25);
    return g;
  };

  // Torx screws in the battery bay: head outward (-Z)
  const screwGeo = (() => {
    const head = lathe([[0, 0], [0.085, 0], [0.085, 0], [0.085, 0.015], [0.078, 0.026], [0.06, 0.032], [0, 0.034]], 24);
    const shank = new T.CylinderGeometry(0.03, 0.024, 0.3, 12); shank.translate(0, -0.15, 0);
    const g = merge([head, shank]); g.rotateX(-Math.PI / 2); return g;
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
  pose.phBatt = new T.Vector3(0, BAY.y, -0.355); pose.phCover = new T.Vector3(0, BAY.y, -0.48);
  SCREWS.forEach(([x, y], i) => { pose['screw_' + (i + 1)] = new T.Vector3(x, y, -0.23); });

  // grime on dirty parts, in the part's own coordinates; front: +Z
  const zf = PCB.z + PCB.t / 2 + 0.004, zb = PCB.z - PCB.t / 2 - 0.004;
  const spots = {
    phPcb: [
      { x: 0, y: -1.1, z: zf, w: 1.5, h: 1.3, kind: 'stain', front: true },
      { x: 0.45, y: -0.25, z: zf, w: 0.7, h: 0.6, kind: 'crust', front: true },
      { x: 0, y: CONN[1], z: zb - 0.1, w: 0.9, h: 0.55, kind: 'crust' },
      { x: -0.35, y: 0.05, z: zb, w: 0.9, h: 0.8, kind: 'stain' },
    ],
    phKeys: [
      { x: -0.35, y: -0.7, z: 0.47, w: 0.95, h: 0.85, kind: 'juice', front: true },
      { x: 0.4, y: -1.6, z: 0.47, w: 0.95, h: 0.85, kind: 'juice', front: true },
      { x: 0, y: NAVI.y, z: 0.5, w: 0.85, h: 0.5, kind: 'juice', front: true },
      { x: 0, y: -1.0, z: 0.23, w: 1.4, h: 1.3, kind: 'stain' },
    ],
  };
  // the lifted battery-connector finger, soldered back on the mat
  const joint = new T.Vector3(CONN[0] + 0.2, CONN[1], zb - 0.06);
  return { make, pose, spots, joint, materials: M, size: { w: W, h: H, d: 1.04 }, testAt: new T.Vector3(0, NAVI.y, 0.48) };
}

/* ---------- the whole phone, assembled (reference sheet) ---------- */
function build(opt) {
  const k = kit(opt || {}), root = new T.Group(); root.name = 'nordik_3300';
  ['phShell', 'phPcb', 'phLcd', 'phEar', 'phKeys', 'phFront', 'phBatt', 'phCover'].forEach(t => { const p = k.make[t](opt || {}); p.position.copy(k.pose[t]); root.add(p); });
  [1, 2, 3, 4].forEach(i => { const s = k.make.screw(i); root.add(s); });
  return { root, materials: k.materials, kit: k };
}

window.BrickPhone = { kit, build, drawScreen };
})();
