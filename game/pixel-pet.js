/* Pixel Pet PX-97: the egg-shaped virtual pet on a ball chain, built in code like the Pocket Pal.
   Axes as in pocket-pal.js: X right, Y up, the face looks at +Z and the back at -Z. The egg is 3.24 × 3.9 × 1.0
   with its middle at y = EGG.cy; the chain loops above it. Every serviceable part is its own named node. */
(function () {
'use strict';
const T = THREE, { rr, disc, extrude, roundedBox, lathe, merge, canvasTex, fitText, rng } = PocketPal.util;

/* ---------- layout, in device units ---------- */
const EGG = { a: 1.62, b: 1.95, e: 0.1, cy: -0.45 }; // half-width, half-height, how much narrower the top is, centre
const TOP = EGG.cy + EGG.b;
const FRONT = 0.5, PLATE = 0.06, RIM = 0.24; // outer face of each half, face plate thickness, how far the rounded rim curls in
const SCR = { y: -0.1, w: 1.36, h: 1.06, r: 0.12 };
const KEYS = [[-0.62, -1.4], [0, -1.52], [0.62, -1.4]];
const SCREWS = [[-0.72, 0.62], [0.72, 0.62], [-1.0, -1.25], [1.0, -1.25]];
const DOOR = { y: -0.8, r: 0.62, tab: 0.17, low: -0.84 }; // round battery door with a tab for its screw; low: tab bottom (door coords)
const DSCREW = [0, -1.5];
const BUZ = [0, 0.3];
const PCB = { z: -0.05, t: 0.07, a: EGG.a - 0.17, b: EGG.b - 0.17 };
const LCD_GREEN = '#b7c3a0', LCD_INK = '#27311d';

/* ---------- outlines ---------- */
function egg(a, b, cy = EGG.cy, path = false, e = EGG.e, n = 120) {
  const s = path ? new T.Path() : new T.Shape();
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2, x = a * Math.cos(t) * (1 - e * Math.sin(t)), y = cy + b * Math.sin(t);
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  s.closePath();
  return s;
}
// the egg outline as points, the same outline moved along its normals (d < 0: inwards), and a shape from points
function outlinePts(a = EGG.a, b = EGG.b, cy = EGG.cy, e = EGG.e, n = 144) {
  const p = [];
  for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; p.push([a * Math.cos(t) * (1 - e * Math.sin(t)), cy + b * Math.sin(t)]); }
  return p;
}
function normals(pts) {
  const n = pts.length;
  return pts.map((_, i) => { const [px, py] = pts[(i - 1 + n) % n], [qx, qy] = pts[(i + 1) % n], l = Math.hypot(qx - px, qy - py); return [(qy - py) / l, -(qx - px) / l]; });
}
function offsetPts(pts, d) { const N = normals(pts); return pts.map(([x, y], i) => [x + N[i][0] * d, y + N[i][1] * d]); }
function shapeFrom(pts, path = false) {
  const s = path ? new T.Path() : new T.Shape();
  pts.forEach(([x, y], i) => { if (i) s.lineTo(x, y); else s.moveTo(x, y); });
  s.closePath();
  return s;
}
// the rounded rim of one half: from the seam (z = 0, full outline) it curls in by R as it rises to height H (sign: +1 front, -1 back)
function skinGeo(pts, R, H, sign, segs = 10) {
  const n = pts.length, N = normals(pts), pos = [], uv = [], idx = [];
  for (let j = 0; j <= segs; j++) {
    const th = j / segs * Math.PI / 2, off = -R * (1 - Math.cos(th)), z = sign * H * Math.sin(th);
    for (let i = 0; i < n; i++) { const [x, y] = pts[i]; pos.push(x + N[i][0] * off, y + N[i][1] * off, z); uv.push(x / 3.4 + 0.5, (y + j * 0.05) / 4 + 0.5); }
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
const OUT = outlinePts(), FLAT = offsetPts(OUT, -RIM), FACEPTS = offsetPts(OUT, -RIM - 0.05);
// the battery door: a disc with a tab at the bottom where its screw goes
function doorShape(r, hw, low, cy = 0, path = false) {
  const s = path ? new T.Path() : new T.Shape(), a0 = -Math.PI / 2 + Math.asin(hw / r), a1 = 3 * Math.PI / 2 - Math.asin(hw / r);
  for (let i = 0; i <= 48; i++) { const t = a0 + (a1 - a0) * i / 48, x = Math.cos(t) * r, y = cy + Math.sin(t) * r; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
  s.lineTo(-hw, cy + low + 0.06); s.quadraticCurveTo(-hw, cy + low, -hw + 0.06, cy + low);
  s.lineTo(hw - 0.06, cy + low); s.quadraticCurveTo(hw, cy + low, hw, cy + low + 0.06);
  s.closePath();
  return s;
}
// planar UVs over a box in the shape's own coordinates, so a canvas can be painted in device units
function planar(geo, x0, y0, w, h) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - x0) / w; uv[i * 2 + 1] = (p.getY(i) - y0) / h; }
  geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
  return geo;
}
const faceBox = (() => { const xs = FACEPTS.map(p => p[0]), ys = FACEPTS.map(p => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys); return { x0, y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }; })();
const boardBox = { x0: -PCB.a * 1.01, y0: EGG.cy - PCB.b, w: 2 * PCB.a * 1.01, h: 2 * PCB.b };

/* ---------- pixel sprites shared by the screen and the box art ---------- */
const SPRITES = {
  egg: ['....####....', '...#....#...', '..#..##..#..', '.#..#..#..#.', '.#........#.', '#..##...#..#', '#.#..#.#.#.#', '#..##...#..#', '#..........#', '.#........#.', '..#......#..', '...######...'],
  pet: ['...######...', '..#......#..', '.#........#.', '#..##..##..#', '#..##..##..#', '#..........#', '#...#..#...#', '#....##....#', '.#........#.', '..########..', '..#.#..#.#..'],
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
};
function sprite(g, name, x, y, px, color) {
  g.fillStyle = color;
  SPRITES[name].forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') g.fillRect(x + i * px, y + j * px, px - 1, px - 1); }));
}
// the LCD: off (phase < 0), the egg wobbling and hatching, then the pet bouncing and saying hello
function drawScreen(g, w, h, phase) {
  if (phase < 0) {
    g.fillStyle = '#3c4433'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,255,255,.10)'); gr.addColorStop(.45, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    return;
  }
  g.fillStyle = LCD_GREEN; g.fillRect(0, 0, w, h);
  const px = Math.floor(w / 32);
  for (let x = 0; x < w; x += px) { g.fillStyle = 'rgba(39,49,29,.05)'; g.fillRect(x, 0, 1, h); }
  for (let y = 0; y < h; y += px) { g.fillStyle = 'rgba(39,49,29,.05)'; g.fillRect(0, y, w, 1); }
  const ink = phase < .15 ? `rgba(39,49,29,${phase / .15})` : LCD_INK, cx = w / 2;
  if (phase < .9) {
    const wob = phase < .5 ? Math.round(Math.sin(phase * 40)) * px : 0;
    sprite(g, 'egg', cx - 6 * px + wob, h * .52 - 6 * px, px, ink);
    if (phase > .5) { g.strokeStyle = LCD_INK; g.lineWidth = px * .7; g.beginPath(); g.moveTo(cx - 4 * px, h * .52); for (let i = 1; i <= 8; i++) g.lineTo(cx - 4 * px + i * px, h * .52 + (i % 2 ? -px : px)); g.stroke(); }
  } else {
    const hop = Math.round(Math.abs(Math.sin((phase - .9) * 10)) * 3) * px;
    sprite(g, 'pet', cx - 6 * px, h * .55 - 6 * px - hop, px, ink);
    g.fillStyle = LCD_INK; g.fillRect(cx - 9 * px, h * .55 + 5 * px, 18 * px, px * .6);
    if (phase > 1.2) {
      g.globalAlpha = Math.min(1, (phase - 1.2) * 4);
      sprite(g, 'heart', w * .1, h * .12, Math.floor(px * .7), LCD_INK); sprite(g, 'heart', w * .78, h * .12, Math.floor(px * .7), LCD_INK);
      g.fillStyle = LCD_INK; g.font = `800 ${Math.round(h * .1)}px Nunito, Arial`; g.textAlign = 'center'; g.fillText('ПРИВЕТ!', cx, h * .2);
      g.globalAlpha = 1;
    }
  }
}

/* ---------- textures ---------- */
const TEX = {};
function textures(font) {
  if (TEX.ready) return TEX;
  const X = TEX, mono = '"Nunito", "Arial", sans-serif';
  X.speckle = canvasTex(256, 256, (g, w, h) => {
    const r = rng(41);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) { const c = 215 + r() * 34 | 0; g.fillStyle = `rgba(${c},${c},${c},${0.25 + r() * 0.35})`; g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5); }
  });
  X.speckle.wrapS = X.speckle.wrapT = T.RepeatWrapping; X.speckle.repeat.set(1.4, 1.4);
  X.lcd = canvasTex(256, 192, (g, w, h) => drawScreen(g, w, h, 1.4));
  X.lines = canvasTex(256, 192, (g, w, h) => {
    const r = rng(5);
    for (let i = 0; i < 9; i++) { const x = r() * w; g.fillStyle = `rgba(20,24,14,${.55 + r() * .4})`; g.fillRect(x, 0, 2 + r() * 5, h); }
    for (let i = 0; i < 3; i++) { const x = r() * w, y = r() * h, rad = 25 + r() * 45, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(15,16,20,.92)'); gr.addColorStop(.6, 'rgba(30,26,60,.55)'); gr.addColorStop(1, 'rgba(30,26,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  });
  X.scratch = canvasTex(512, 384, (g, w, h) => {
    const r = rng(77);
    g.lineCap = 'round';
    for (let i = 0; i < 80; i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI, len = 20 + r() * 150;
      g.strokeStyle = `rgba(240,244,236,${0.3 + r() * 0.45})`; g.lineWidth = 0.8 + r() * 1.8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
  });
  X.crack = canvasTex(512, 512, (g, w, h) => {
    const r = rng(23), cx = w / 2, cy = h / 2;
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      let x = cx, y = cy, a = i / 9 * Math.PI * 2 + r() * 0.4;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 7; k++) { a += (r() - 0.5) * 0.7; const len = 16 + r() * 34; x += Math.cos(a) * len; y += Math.sin(a) * len; g.lineTo(x, y); }
      g.strokeStyle = 'rgba(30,22,18,.8)'; g.lineWidth = 3.5; g.stroke();
      g.strokeStyle = 'rgba(255,250,240,.6)'; g.lineWidth = 1.3; g.stroke();
    }
    g.fillStyle = 'rgba(25,18,14,.5)'; g.beginPath(); g.arc(cx, cy, 12, 0, 7); g.fill();
  });
  X.scorch = canvasTex(256, 256, (g, w, h) => {
    const r = rng(19);
    for (let i = 0; i < 22; i++) {
      const x = w / 2 + (r() - 0.5) * w * 0.5, y = h / 2 + (r() - 0.5) * h * 0.5, rad = 18 + r() * 46;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(18,12,8,.75)'); gr.addColorStop(1, 'rgba(60,35,15,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  });
  X.sticker = canvasTex(640, 270, (g, w, h) => {
    const r = rng(13);
    g.fillStyle = '#f3ead6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(120,100,70,${r() * 0.08})`; g.fillRect(r() * w, r() * h, 2, 2); }
    g.strokeStyle = '#3a2b1f'; g.lineWidth = 5; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#3a2b1f';
    fitText(g, 'PIXEL PET', 36, 78, 380, 56, 700, font);
    fitText(g, 'MODEL PX-97  ·  CR2032 × 1  3V', 36, 122, 560, 26, 700, mono);
    fitText(g, 'SERIAL 7741-0397  ·  MADE 1997', 36, 158, 560, 24, 600, mono);
    let x = 36; while (x < 360) { const bw = 2 + (r() * 5 | 0); g.fillRect(x, 178, bw, 58); x += bw + 2 + (r() * 4 | 0); }
    fitText(g, 'Не вскрывать — гарантия!', 380, 220, 230, 20, 700, mono);
    sprite(g, 'pet', 470, 32, 9, '#3a2b1f');
  });
  X.lcdBack = canvasTex(256, 96, (g, w, h) => {
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a2a2e'; fitText(g, 'LCD 32×16 · PX-97', 12, 40, w - 24, 22, 700, font); fitText(g, 'LOT 9703', 12, 74, w - 24, 18, 600, font);
  });
  X.zebra = canvasTex(128, 32, (g, w, h) => {
    for (let x = 0; x < w; x += 4) { g.fillStyle = x % 8 ? '#3b3640' : '#c9c2c6'; g.fillRect(x, 0, 4, h); }
  });
  X.zebra.wrapS = T.RepeatWrapping; X.zebra.repeat.set(6, 1);
  X.ceramic = canvasTex(128, 128, (g, w, h) => {
    const r = rng(3); g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(150,140,120,${r() * .12})`; g.fillRect(r() * w, r() * h, 2, 2); }
  });
  const cellFace = (kind) => canvasTex(256, 256, (g, w, h) => {
    const r = rng(kind.length * 7 + 1);
    const gr = g.createRadialGradient(w * .4, h * .35, 10, w / 2, h / 2, w * .6); gr.addColorStop(0, '#f2f4f6'); gr.addColorStop(.6, '#b9bec6'); gr.addColorStop(1, '#8d939c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(255,255,255,${r() * .25})`; g.lineWidth = 1; g.beginPath(); g.arc(w / 2, h / 2, 30 + r() * 95, r() * 7, r() * 7 + .6); g.stroke(); }
    g.fillStyle = '#3d4148'; g.textAlign = 'center';
    fitText(g, 'CR2032', w / 2, h * .46, w * .6, 44, 700, font, 'center');
    fitText(g, '3V  LITHIUM', w / 2, h * .62, w * .55, 22, 700, mono, 'center');
    g.font = `700 40px ${font}`; g.fillText('+', w / 2, h * .26);
    if (kind === 'new') { g.strokeStyle = '#2f6f9e'; g.lineWidth = 16; g.beginPath(); g.arc(w / 2, h / 2, w * .44, 0, 7); g.stroke(); g.fillStyle = '#2f6f9e'; fitText(g, 'NEW', w / 2, h * .82, 80, 26, 800, mono, 'center'); }
    if (kind === 'dead') {
      g.fillStyle = 'rgba(90,70,40,.25)'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 22; i++) {
        const a = r() * 7, d = w * (.34 + r() * .12), x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d;
        for (let k = 0; k < 14; k++) { g.fillStyle = ['rgba(232,240,226,.95)', 'rgba(170,215,185,.9)', 'rgba(120,180,150,.9)'][k % 3]; g.beginPath(); g.arc(x + (r() - .5) * 24, y + (r() - .5) * 24, 2 + r() * 6, 0, 7); g.fill(); }
      }
    }
    g.globalCompositeOperation = 'destination-in'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
  });
  X.cellOld = cellFace('old'); X.cellNew = cellFace('new'); X.cellDead = cellFace('dead');
  X.door = canvasTex(256, 256, (g, w, h) => {
    g.strokeStyle = 'rgba(40,30,30,.35)'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.arc(w / 2, h / 2, w * .3, -2.4, .7); g.stroke();
    g.fillStyle = 'rgba(40,30,30,.35)'; g.beginPath(); g.moveTo(w * .78, h * .58); g.lineTo(w * .62, h * .62); g.lineTo(w * .74, h * .74); g.fill();
    g.fillStyle = 'rgba(40,30,30,.45)'; fitText(g, 'OPEN', w / 2, h * .53, w * .4, 36, 800, mono, 'center');
    fitText(g, 'CR2032', w / 2, h * .2, w * .4, 22, 700, mono, 'center');
  });
  X.pcbBack = canvasTex(768, 932, (g, w, h) => drawBoard(g, w, h, true, font, mono));
  X.pcbFront = canvasTex(768, 932, (g, w, h) => drawBoard(g, w, h, false, font, mono));
  X.qc = canvasTex(96, 96, (g) => {
    g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(48, 48, 46, 0, 7); g.fill();
    g.strokeStyle = '#c4432c'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(26, 50); g.lineTo(42, 64); g.lineTo(70, 32); g.stroke();
  });
  X.ready = true;
  return X;
}
// The face panel print: pastel pattern, a frame round the screen, the classic eight care icons, the brand and A·B·C
function facePrint(trim, body, font) {
  return canvasTex(560, Math.round(560 * faceBox.h / faceBox.w), (g, w, h) => {
    const S = w / faceBox.w, P = (x, y) => [(x - faceBox.x0) * S, (faceBox.y0 + faceBox.h - y) * S];
    const col = n => '#' + n.toString(16).padStart(6, '0');
    g.fillStyle = col(trim); g.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 60; i++) { const x = r() * w, y = r() * h; g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.arc(x, y, 3 + r() * 5, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 5;
    const [fx, fy] = P(-SCR.w / 2 - .08, SCR.y + SCR.h / 2 + .08), fw = (SCR.w + .16) * S, fh = (SCR.h + .16) * S;
    g.beginPath(); g.roundRect ? g.roundRect(fx, fy, fw, fh, 22) : g.rect(fx, fy, fw, fh); g.stroke();
    const ink = 'rgba(40,30,40,.78)';
    const icon = (x, y, draw) => { const [X, Y] = P(x, y); g.save(); g.translate(X, Y); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(0, 0, 21, 0, 7); g.fill(); g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 3.5; g.lineCap = 'round'; g.lineJoin = 'round'; draw(); g.restore(); };
    const ICONS = [
      () => { g.beginPath(); g.arc(0, 2, 11, 0, Math.PI); g.closePath(); g.fill(); g.fillRect(-9, -9, 3, 9); g.fillRect(-2, -12, 3, 12); g.fillRect(5, -9, 3, 9); },            // meal
      () => { g.beginPath(); g.arc(0, -3, 9, 0, 7); g.stroke(); g.fillRect(-4, 6, 8, 6); },                                                                                  // light
      () => { g.beginPath(); g.arc(0, 0, 11, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-11, 0); g.lineTo(11, 0); g.moveTo(0, -11); g.quadraticCurveTo(7, 0, 0, 11); g.stroke(); }, // game
      () => { g.fillRect(-10, -3, 16, 7); g.fillRect(6, -1, 6, 3); g.fillRect(-13, -1, 4, 3); g.fillRect(-5, -8, 3, 5); },                                                  // medicine
      () => { g.beginPath(); g.ellipse(-1, 3, 11, 7, 0, 0, 7); g.fill(); g.beginPath(); g.arc(6, -6, 5, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(6, -8, 2, 2); }, // duck
      () => { g.strokeRect(-11, -8, 22, 16); g.beginPath(); g.moveTo(-6, 4); g.lineTo(-6, -2); g.moveTo(0, 4); g.lineTo(0, -5); g.moveTo(6, 4); g.lineTo(6, 0); g.stroke(); },       // status
      () => { g.beginPath(); g.moveTo(-11, -7); g.lineTo(11, -7); g.lineTo(11, 5); g.lineTo(-3, 5); g.lineTo(-8, 10); g.lineTo(-8, 5); g.lineTo(-11, 5); g.closePath(); g.stroke(); g.fillRect(-1.5, -4, 3, 5); }, // discipline
      () => { g.beginPath(); g.moveTo(0, -11); g.lineTo(11, 9); g.lineTo(-11, 9); g.closePath(); g.stroke(); g.fillRect(-1.5, -4, 3, 8); g.fillRect(-1.5, 5, 3, 3); },        // attention
    ];
    [-0.63, -0.21, 0.21, 0.63].forEach((x, i) => icon(x, 0.66, ICONS[i]));
    [-0.66, -0.22, 0.22, 0.66].forEach((x, i) => icon(x, -0.86, ICONS[4 + i]));
    const dark = '#' + [16, 8, 0].map(sh => Math.round(((body >> sh) & 255) * 0.62).toString(16).padStart(2, '0')).join('');
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 9; g.lineJoin = 'round'; g.fillStyle = dark;
    const [bx, by] = P(0, 0.93); g.font = `700 36px ${font}`; g.textAlign = 'center'; g.strokeText('PIXEL PET', bx, by); g.fillText('PIXEL PET', bx, by);
    g.fillStyle = 'rgba(40,30,40,.6)'; g.font = `800 20px Nunito, Arial`;
    KEYS.forEach(([x, y], i) => { const [X, Y] = P(x, y - 0.3); g.fillText('ABC'[i], X, Y); });
  });
}

// Board artwork in device units. The back is drawn mirrored because it is viewed from -Z.
function drawBoard(g, w, h, back, font, mono) {
  const S = w / boardBox.w, r = rng(back ? 17 : 18);
  const P = (x, y) => [((back ? -x : x) - boardBox.x0) * S, (boardBox.y0 + boardBox.h - y) * S];
  g.fillStyle = '#1a4a7a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.06})`; g.fillRect(r() * w, r() * h, 2, 2); }
  const line = (pts, width = 4) => {
    g.lineCap = g.lineJoin = 'round';
    [['#123a63', width + 7], ['#2d6aa6', width]].forEach(([c, lw]) => { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); pts.forEach(([x, y], i) => { const [X, Y] = P(x, y); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke(); });
  };
  const via = (x, y) => { const [X, Y] = P(x, y); g.fillStyle = '#d4b062'; g.beginPath(); g.arc(X, Y, 5.5, 0, 7); g.fill(); g.fillStyle = '#0e2a48'; g.beginPath(); g.arc(X, Y, 2.2, 0, 7); g.fill(); };
  const text = (t, x, y, size, weight = 700) => { const [X, Y] = P(x, y); g.fillStyle = '#e8ebe2'; g.font = `${weight} ${size}px ${mono}`; g.textAlign = 'center'; g.fillText(t, X, Y); };
  const pad = (x, y, pw, ph, color = '#d4b062') => { const [X, Y] = P(x, y); g.fillStyle = color; g.fillRect(X - pw * S / 2, Y - ph * S / 2, pw * S, ph * S); };
  const wander = (x, y) => {
    const pts = [[x, y]]; let dx = r() < .5 ? 1 : -1, dy = 0;
    for (let k = 0; k < 3; k++) { const len = .1 + r() * .3; x += dx * len; y += dy * len; pts.push([x, y]); [dx, dy] = r() < .5 ? [dy, dx] : [dx, dy]; if (!dx && !dy) dx = 1; }
    line(pts, 3); via(x, y);
  };
  SCREWS.forEach(([x, y]) => { const [X, Y] = P(x, y); g.fillStyle = '#d4b062'; g.beginPath(); g.arc(X, Y, 0.19 * S, 0, 7); g.fill(); g.fillStyle = '#123a63'; g.beginPath(); g.arc(X, Y, 0.15 * S, 0, 7); g.fill(); });
  for (let i = 0; i < 22; i++) wander(-1.1 + r() * 2.2, -2.0 + r() * 3.0);
  if (back) {
    // the cell holder's centre contact, the buzzer pads and the epoxy-covered chip
    const [cx, cy] = P(0, DOOR.y); g.fillStyle = '#d4b062'; g.beginPath(); g.arc(cx, cy, 0.3 * S, 0, 7); g.fill();
    g.strokeStyle = '#e8ebe2'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 0.66 * S, 0, 7); g.stroke();
    text('+', 0.45, DOOR.y - 0.1, 30); text('BT1  CR2032', 0, DOOR.y - 0.75, 22);
    pad(0.55, 0.6, 0.14, 0.1); pad(0.55, 0.45, 0.14, 0.1); text('BZ1', 0.78, 0.4, 18);
    line([[0.55, 0.6], [0.82, 0.6], [0.82, -0.05], [-0.4, -0.05], [-0.6, 0.05]], 5);
    line([[0.55, 0.45], [0.66, 0.45], [0.66, 0.05], [0.15, 0.05], [0, DOOR.y + 0.3]], 6);
    text('PX-97 MAIN · REV.C', 0, 1.05, 24); text('© 1997  ▲ 94V-0', 0, 0.9, 18, 600);
    for (let k = 0; k < 10; k++) pad(-1.05 + k * 0.06, 0.62, 0.025, 0.07);
  } else {
    // carbon contacts under the keys and the gold rows the zebra strips press on
    KEYS.forEach(([x, y]) => {
      const [X, Y] = P(x, y), R = 0.17 * S;
      g.fillStyle = '#d4b062'; g.beginPath(); g.arc(X, Y, R + 6, 0, 7); g.fill();
      g.fillStyle = '#2b2b2e'; g.beginPath(); g.arc(X, Y, R, 0, 7); g.fill();
      g.strokeStyle = '#d4b062'; g.lineWidth = 3; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(X - R * .8, Y + k * R * .3); g.lineTo(X + R * .8, Y + k * R * .3); g.stroke(); }
    });
    [SCR.y + 0.5, SCR.y - 0.5].forEach(y => { for (let k = 0; k < 30; k++) pad(-0.58 + k * 0.04, y, 0.022, 0.08); });
    text('SW1', KEYS[0][0], KEYS[0][1] + 0.3, 18); text('SW2', KEYS[1][0], KEYS[1][1] + 0.3, 18); text('SW3', KEYS[2][0], KEYS[2][1] + 0.3, 18);
    text('LCD1', 0, SCR.y + 0.62, 20);
  }
}

/* ---------- materials ---------- */
function materials(o, X) {
  const S = (color, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0 }, extra));
  const decal = (map, extra) => S(0xffffff, Object.assign({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, extra));
  const body = S(o.body, { map: X.speckle, roughness: 0.42, envMapIntensity: 0.55 }), trim = S(o.trim, { map: X.speckle, roughness: 0.5, envMapIntensity: 0.5 });
  const M = {
    body, trim, coverBody: body.clone(), coverTrim: trim.clone(),
    face: S(0xffffff, { map: facePrint(o.trim, o.body, o.font), roughness: 0.62, envMapIntensity: 0.25, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    crack: decal(X.crack, { roughness: 0.3 }), scratch: decal(X.scratch, { roughness: 0.2 }), lines: new T.MeshBasicMaterial({ map: X.lines, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    glass: S(0xffffff, { roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide }),
    lensFrame: S(0xd8dde2, { roughness: 0.2, transparent: true, opacity: 0.7 }),
    key: S(0xf4efe4, { roughness: 0.35 }), keyWorn: S(0xb8ab98, { roughness: 0.8 }),
    lcd: new T.MeshBasicMaterial({ map: o.screen || X.lcd }), lcdGlass: S(0x8e9a80, { roughness: 0.3 }), lcdBack: decal(X.lcdBack, { transparent: false, depthWrite: true }),
    zebra: S(0xffffff, { map: X.zebra, roughness: 0.7 }),
    pcbEdge: S(0x1d4f80, { roughness: 0.5 }), pcbBack: S(0xffffff, { map: X.pcbBack, roughness: 0.42 }), pcbFront: S(0xffffff, { map: X.pcbFront, roughness: 0.42 }),
    blob: S(0x111114, { roughness: 0.25 }), steel: S(0xc9ccd1, { metalness: 0.85, roughness: 0.3 }), steelDark: S(0x8a8f96, { metalness: 0.8, roughness: 0.4 }),
    brass: S(0xd8aa50, { metalness: 0.85, roughness: 0.3 }), ceramic: S(0xffffff, { map: X.ceramic, roughness: 0.6 }), silver: S(0xe2e4e8, { metalness: 0.9, roughness: 0.25 }),
    cap: S(0xb08a5c, { roughness: 0.55 }), res: S(0x202023, { roughness: 0.5 }), tin: S(0xc0c4c8, { metalness: 0.8, roughness: 0.38 }),
    wireRed: S(0xc42a20, { roughness: 0.45 }), wireBlack: S(0x1d1d1f, { roughness: 0.45 }), solder: S(0xd6dade, { metalness: 0.9, roughness: 0.2 }),
    cellOld: S(0xffffff, { map: X.cellOld, metalness: 0.6, roughness: 0.35 }), cellNew: S(0xffffff, { map: X.cellNew, metalness: 0.6, roughness: 0.3 }), cellDead: S(0xffffff, { map: X.cellDead, metalness: 0.4, roughness: 0.6 }),
    door: decal(X.door, { roughness: 0.6 }), sticker: decal(X.sticker, { transparent: false, depthWrite: true, roughness: 0.75 }),
    black: S(0x141416, { roughness: 0.6 }), scorch: decal(X.scorch), qc: decal(X.qc),
  };
  return M;
}

/* ---------- the parts kit ---------- */
function kit(opt) {
  const o = Object.assign({ body: 0xe9799a, trim: 0xf6b8c9, font: '"Unbounded", "Arial Black", sans-serif', screen: null }, opt);
  const X = textures(o.font), M = materials(o, X);
  const group = (parent, name, x = 0, y = 0, z = 0, explode = 0) => {
    const g = new T.Group(); g.name = name; g.position.set(x, y, z); if (explode) g.userData.explode = explode; if (parent) parent.add(g); return g;
  };
  const mesh = (parent, name, geo, mat, x = 0, y = 0, z = 0) => { const m = new T.Mesh(geo, mat); m.name = name; m.position.set(x, y, z); parent.add(m); return m; };
  const back = m => { m.rotation.y = Math.PI; return m; };
  const plane = (w, h) => new T.PlaneGeometry(w, h);
  const cyl = (r, len, seg = 32) => { const c = new T.CylinderGeometry(r, r, len, seg); c.rotateX(Math.PI / 2); return c; };
  const make = {}, pose = {};

  // one half: the rounded rim curling in from the seam, and the flat plate across its top with the given holes
  const half = (holes, sign) => {
    const plate = shapeFrom(FLAT); plate.holes.push(...holes);
    return [skinGeo(OUT, RIM, FRONT, sign), extrude(plate, PLATE, 0.008, 1)];
  };
  const skin = m => { const c = m.clone(); c.side = T.DoubleSide; return c; };
  M.bodySkin = skin(M.body); M.coverSkin = skin(M.coverBody);
  const lipGeo = (() => { const s = shapeFrom(offsetPts(OUT, 0.004)); s.holes.push(shapeFrom(offsetPts(OUT, -0.045), true)); return extrude(s, 0.014, 0, 1); })();
  const windowHole = () => rr(SCR.w, SCR.h, SCR.r, 0, SCR.y, true), keyHoles = () => KEYS.map(([x, y]) => disc(0.2, x, y));
  const [frontSkin, frontPlate] = half([windowHole(), ...keyHoles()], 1);
  const faceShape = shapeFrom(FACEPTS); faceShape.holes.push(windowHole(), ...keyHoles());
  const faceGeo = planar(new T.ShapeGeometry(faceShape, 12), faceBox.x0, faceBox.y0, faceBox.w, faceBox.h);
  const crackGeo = planar(new T.ShapeGeometry(faceShape, 12), 0.62 - 0.8, -0.55 - 0.8, 1.6, 1.6);

  /* front half: the shell everything mounts on, with the printed face and the chain ear */
  make.petShell = ({ cracked } = {}) => {
    const g = group(null, 'pet_front', 0, 0, 0, 1.5);
    mesh(g, 'front_rim', frontSkin, M.bodySkin);
    mesh(g, 'front_plate', frontPlate, M.body, 0, 0, FRONT - PLATE / 2);
    mesh(g, 'seam_lip', lipGeo, M.trim, 0, 0, 0.007);
    mesh(g, 'face_print', faceGeo, M.face, 0, 0, FRONT + 0.0015);
    if (cracked) mesh(g, 'shell_crack', crackGeo, M.crack, 0, 0, FRONT + 0.0025);
    const ear = rr(0.42, 0.36, 0.13, 0, TOP + 0.05); ear.holes.push(disc(0.075, 0, TOP + 0.1));
    mesh(g, 'chain_ear', extrude(ear, 0.2, 0.03, 3), M.body, 0, 0, 0);
    SCREWS.forEach(([x, y], i) => mesh(g, 'front_boss_' + (i + 1), cyl(0.1, 0.69, 20), M.trim, x, y, 0.095));
    return g;
  };

  /* clear lens in the screen window, held from inside by its flange */
  const paneGeo = extrude(rr(SCR.w - 0.05, SCR.h - 0.05, SCR.r - 0.02), 0.1, 0.01, 2);
  const flangeGeo = extrude((() => { const s = rr(SCR.w + 0.22, SCR.h + 0.22, 0.18); s.holes.push(rr(SCR.w - 0.12, SCR.h - 0.12, 0.08, 0, 0, true)); return s; })(), 0.03, 0.005, 1);
  make.petLens = ({ scratched } = {}) => {
    const g = group(null, 'lens', 0, SCR.y, 0.44, 1.9);
    mesh(g, 'lens_pane', paneGeo, M.glass, 0, 0, 0);
    mesh(g, 'lens_flange', flangeGeo, M.lensFrame, 0, 0, -0.065);
    if (scratched) mesh(g, 'lens_scratches', plane(SCR.w - 0.08, SCR.h - 0.08), M.scratch, 0, 0, 0.0515);
    return g;
  };

  /* the three keys A, B and C with their stems down to the board */
  const keyGeo = lathe([[0, 0], [0.23, 0], [0.23, 0], [0.23, 0.03], [0.23, 0.03], [0.16, 0.03], [0.16, 0.03], [0.16, 0.2], [0.155, 0.215], [0.14, 0.228], [0.11, 0.238], [0.06, 0.244], [0, 0.246]], 40);
  keyGeo.rotateX(Math.PI / 2);
  const stemGeo = cyl(0.06, 0.325, 16);
  make.petKeys = ({ worn } = {}) => {
    const g = group(null, 'keys', 0, 0, 0, 1.2);
    KEYS.forEach(([x, y], i) => {
      const k = group(g, 'key_' + 'abc'[i], x, y, 0.31 - (worn && i === 1 ? 0.07 : 0));
      mesh(k, 'cap', keyGeo, worn ? M.keyWorn : M.key);
      mesh(k, 'stem', stemGeo, M.key, 0, 0, -0.1625);
    });
    return g;
  };

  /* the LCD module with its two zebra strips pressing on the board */
  const lcdGeo = roundedBox(1.46, 1.14, 0.1, 0.02);
  const zebraGeo = roundedBox(1.2, 0.07, 0.125, 0.015);
  make.petLcd = ({ cracked } = {}) => {
    const g = group(null, 'lcd', 0, SCR.y, 0.16, 1.1);
    mesh(g, 'lcd_glass', lcdGeo, M.lcdGlass);
    g.userData.panel = mesh(g, 'lcd_panel', plane(1.3, 1.0), M.lcd, 0, 0, 0.0505);
    if (cracked) mesh(g, 'lcd_lines', plane(1.3, 1.0), M.lines, 0, 0, 0.0512);
    [0.5, -0.5].forEach((y, i) => mesh(g, 'zebra_' + (i + 1), zebraGeo, M.zebra, 0, y, -0.1125));
    back(mesh(g, 'lcd_sticker', plane(0.5, 0.18), M.lcdBack, 0.3, 0.25, -0.0505));
    return g;
  };

  /* main board: blue, egg-shaped; the cell holder, the epoxy chip and the crystal sit on its back */
  const boardShape = () => { const s = egg(PCB.a, PCB.b); SCREWS.forEach(([x, y]) => s.holes.push(disc(0.14, x, y))); return s; };
  const boardGeo = extrude(boardShape(), PCB.t, 0.004, 1);
  const printGeo = planar(new T.ShapeGeometry(boardShape(), 12), boardBox.x0, boardBox.y0, boardBox.w, boardBox.h);
  const holderGeo = (() => { const s = disc(0.645, 0, 0, false); s.holes.push(disc(0.585)); const g = extrude(s, 0.17, 0.01, 2); return g; })();
  const blobGeo = new T.SphereGeometry(0.26, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2); blobGeo.rotateX(-Math.PI / 2); blobGeo.scale(1, 1, 0.38);
  make.petPcb = ({ burnt } = {}) => {
    const g = group(null, 'pcb');
    const zb = PCB.z - PCB.t / 2, zf = PCB.z + PCB.t / 2;
    mesh(g, 'pcb_board', boardGeo, M.pcbEdge, 0, 0, PCB.z);
    back(mesh(g, 'pcb_back_print', printGeo, M.pcbBack, 0, 0, zb - 0.0008));
    mesh(g, 'pcb_front_print', printGeo, M.pcbFront, 0, 0, zf + 0.0008);
    mesh(g, 'cell_holder', holderGeo, M.steel, 0, DOOR.y, zb - 0.085);
    [-1, 1].forEach(s => mesh(g, 'holder_tab_' + (s < 0 ? 'l' : 'r'), roundedBox(0.16, 0.12, 0.02, 0.006), M.steel, s * 0.72, DOOR.y, zb - 0.01));
    mesh(g, 'chip_blob', blobGeo, M.blob, -0.75, 0.05, zb);
    const xt = new T.CylinderGeometry(0.05, 0.05, 0.22, 16); xt.rotateZ(Math.PI / 2);
    mesh(g, 'crystal', xt, M.steel, 0.85, 0.32, zb - 0.05);
    const caps = [], res = [];
    [[-0.4, 0.5], [-0.25, 0.62], [-1.05, -0.2], [1.0, -0.15], [0.95, -0.35], [-0.95, -0.4]].forEach(([x, y], i) => (i % 2 ? res : caps).push(PocketPal.util.at(new T.BoxGeometry(0.1, 0.05, 0.03), x, y, zb - 0.015)));
    mesh(g, 'capacitors', merge(caps), M.cap); mesh(g, 'resistors', merge(res), M.res);
    back(mesh(g, 'qc_sticker', new T.CircleGeometry(0.07, 20), M.qc, 0.45, 0.85, zb - 0.0015));
    if (burnt) back(mesh(g, 'pcb_scorch', plane(0.8, 0.8), M.scorch, 0.25, 0.05, zb - 0.002));
    return g;
  };

  /* piezo buzzer stuck on the back of the board, two wires to its pads */
  const wire = (pts, mat) => new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), 48, 0.014, 6), mat);
  make.petBuzzer = ({ burnt, loose } = {}) => {
    const g = group(null, 'buzzer', BUZ[0], BUZ[1], -0.115, -0.6);
    mesh(g, 'brass_disc', cyl(0.32, 0.02, 40), M.brass);
    mesh(g, 'ceramic', cyl(0.23, 0.012, 36), M.ceramic, 0, 0, -0.016);
    mesh(g, 'electrode', cyl(0.15, 0.006, 32), M.silver, 0, 0, -0.025);
    if (burnt) back(mesh(g, 'ceramic_crack', plane(0.46, 0.46), M.crack, 0, 0, -0.0285));
    const red = loose ? [[0.55, 0.3, 0.028], [0.47, 0.22, -0.05], [0.33, 0.05, -0.12], [0.24, -0.16, -0.14]] : [[0.55, 0.3, 0.028], [0.42, 0.26, -0.03], [0.2, 0.15, -0.06], [0.05, 0.06, -0.03]];
    g.add(Object.assign(wire(red, M.wireRed), { name: 'wire_red' }));
    g.add(Object.assign(wire([[0.55, 0.15, 0.028], [0.52, 0.06, -0.02], [0.4, -0.06, -0.04], [0.27, -0.12, -0.012]], M.wireBlack), { name: 'wire_black' }));
    const blob = new T.SphereGeometry(0.035, 12, 8);
    if (!loose) mesh(g, 'solder_red', blob, M.solder, 0.05, 0.06, -0.03);
    mesh(g, 'solder_black', blob, M.solder, 0.27, -0.12, -0.012);
    if (loose) mesh(g, 'wire_end', blob, M.tin, 0.24, -0.16, -0.14);
    return g;
  };

  /* the CR2032 coin cell: blue ring when new, crusted when it leaked */
  const cellGeo = cyl(0.55, 0.14, 48);
  make.petCell = ({ swollen, fresh } = {}) => {
    const g = group(null, 'cell', 0, DOOR.y, -0.18, -1.2);
    mesh(g, 'cell_body', cellGeo, M.steel);
    back(mesh(g, 'cell_plus', new T.CircleGeometry(0.535, 48), swollen ? M.cellDead : fresh ? M.cellNew : M.cellOld, 0, 0, -0.0705));
    mesh(g, 'cell_minus', new T.CircleGeometry(0.46, 40), M.steelDark, 0, 0, 0.0705);
    return g;
  };

  /* round battery door with its spring contact */
  const doorGeo = extrude(doorShape(DOOR.r, DOOR.tab, DOOR.low), PLATE, 0.01, 2);
  const helix = []; for (let t = 0; t <= 4 * Math.PI * 2; t += 0.2) helix.push(new T.Vector3(Math.cos(t) * 0.11, Math.sin(t) * 0.11, 0.03 + t / (8 * Math.PI) * 0.19));
  const springGeo = new T.TubeGeometry(new T.CatmullRomCurve3(helix), 120, 0.012, 6);
  make.petDoor = () => {
    const g = group(null, 'battery_door', 0, DOOR.y, -(FRONT - PLATE / 2), -1.6);
    mesh(g, 'door_plate', doorGeo, M.coverBody);
    back(mesh(g, 'door_print', plane(0.92, 0.92), M.door, 0, 0.02, -0.0312));
    mesh(g, 'spring', springGeo, M.steel);
    return g;
  };

  /* back half: door opening, screw bosses, buzzer holes, sticker */
  const backHoles = [...SCREWS.map(([x, y]) => disc(0.115, x, y)), doorShape(DOOR.r + 0.03, DOOR.tab + 0.03, DOOR.low - 0.03, DOOR.y, true), disc(0.035, 0.85, -0.2)];
  [[0, 0], [0.13, 0], [-0.13, 0], [0.065, 0.11], [-0.065, 0.11], [0.065, -0.11], [-0.065, -0.11]].forEach(([dx, dy]) => backHoles.push(disc(0.04, BUZ[0] + dx, BUZ[1] + dy)));
  const [backSkin, backPlate] = half(backHoles, -1);
  make.petBack = () => {
    const g = group(null, 'pet_back', 0, 0, 0, -1.5);
    mesh(g, 'back_rim', backSkin, M.coverSkin);
    mesh(g, 'back_plate', backPlate, M.coverBody, 0, 0, -(FRONT - PLATE / 2));
    SCREWS.forEach(([x, y], i) => {
      mesh(g, 'back_boss_' + (i + 1), cyl(0.13, 0.19, 24), M.coverTrim, x, y, -0.345);
      back(mesh(g, 'screw_well_' + (i + 1), new T.CircleGeometry(0.105, 20), M.black, x, y, -0.442));
    });
    mesh(g, 'door_screw_boss', cyl(0.09, 0.14, 20), M.coverTrim, DSCREW[0], DSCREW[1], -0.37);
    back(mesh(g, 'sticker', plane(1.0, 0.36), M.sticker, 0, 0.82, -(FRONT + 0.0015)));
    return g;
  };

  /* ball chain through the ear on top */
  const ball = new T.SphereGeometry(0.042, 10, 8);
  make.petChain = ({ broken } = {}) => {
    const g = group(null, 'chain', 0, TOP, 0, 0.9);
    const ring = mesh(g, 'split_ring', new T.TorusGeometry(0.13, 0.022, 10, 32), M.steel, 0, 0.1, 0); ring.rotation.y = Math.PI / 2;
    const pts = [], cx = 0, cy = 0.69, rx = 0.42, ry = 0.46, n = 34;
    const last = broken ? 22 : n;
    for (let i = 0; i < last; i++) { const t = -Math.PI / 2 + i / n * Math.PI * 2; pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]); }
    if (broken) { const [x, y] = pts[pts.length - 1]; for (let k = 1; k <= 7; k++) pts.push([x - 0.02 * k, y - 0.085 * k]); }
    mesh(g, 'balls', merge(pts.map(([x, y]) => PocketPal.util.at(ball.clone(), x, y, 0))), M.steel);
    if (!broken) { const c = new T.CylinderGeometry(0.035, 0.035, 0.13, 12); c.rotateZ(Math.PI / 2); mesh(g, 'clasp', c, M.brass, cx, cy + ry, 0); }
    return g;
  };

  // Phillips screws: head outward (-Z), thread into the shell (+Z)
  const screwGeo = (hr, hh, sr, len, turns) => {
    const head = lathe([[0, 0], [hr, 0], [hr, 0], [hr, hh * 0.44], [hr * 0.93, hh * 0.75], [hr * 0.81, hh * 0.94], [hr * 0.67, hh], [0, hh]], 28);
    const shank = new T.CylinderGeometry(sr, sr * 0.75, len, 14); shank.translate(0, -len / 2, 0);
    const hl = []; for (let t = 0; t <= turns * Math.PI * 2; t += 0.25) hl.push(new T.Vector3(Math.cos(t) * sr * 1.1, -0.02 - t / (Math.PI * 2) * (len - 0.04) / turns, Math.sin(t) * sr * 1.1));
    const thread = new T.TubeGeometry(new T.CatmullRomCurve3(hl), turns * 14, sr * 0.22, 4);
    const geo = merge([head, shank, thread]); geo.rotateX(-Math.PI / 2);
    return geo;
  };
  const caseScrew = screwGeo(0.092, 0.03, 0.035, 0.42, 9), doorScrew = screwGeo(0.07, 0.024, 0.026, 0.12, 5);
  const crossTex = canvasTex(64, 64, (g) => { g.strokeStyle = '#26282c'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(14, 32); g.lineTo(50, 32); g.moveTo(32, 14); g.lineTo(32, 50); g.stroke(); });
  const cross = new T.MeshBasicMaterial({ map: crossTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const screwMat = new T.MeshStandardMaterial({ color: 0xc5c8cd, metalness: 0.9, roughness: 0.28 });
  make.screw = i => {
    const [x, y] = SCREWS[i - 1], g = group(null, 'screw_' + i, x, y, -0.47, -2.5);
    mesh(g, 'screw_' + i + '_body', caseScrew, screwMat);
    back(mesh(g, 'screw_' + i + '_slot', plane(0.115, 0.115), cross, 0, 0, -0.0306));
    return g;
  };
  make.bscrew = i => {
    const g = group(null, 'bscrew_' + i, DSCREW[0], DSCREW[1], -0.47, -2.2);
    mesh(g, 'bscrew_' + i + '_body', doorScrew, screwMat);
    back(mesh(g, 'bscrew_' + i + '_slot', plane(0.09, 0.09), cross, 0, 0, -0.0246));
    return g;
  };

  // where each part sits when installed (device coordinates)
  pose.petShell = new T.Vector3(); pose.petLens = new T.Vector3(0, SCR.y, 0.44); pose.petKeys = new T.Vector3();
  pose.petLcd = new T.Vector3(0, SCR.y, 0.16); pose.petPcb = new T.Vector3(); pose.petBuzzer = new T.Vector3(BUZ[0], BUZ[1], -0.115);
  pose.petCell = new T.Vector3(0, DOOR.y, -0.18); pose.petDoor = new T.Vector3(0, DOOR.y, -(FRONT - PLATE / 2)); pose.petBack = new T.Vector3();
  pose.petChain = new T.Vector3(0, TOP, 0);
  SCREWS.forEach(([x, y], i) => { pose['screw_' + (i + 1)] = new T.Vector3(x, y, -0.47); });
  pose.bscrew_1 = new T.Vector3(DSCREW[0], DSCREW[1], -0.47);

  // where grime sits on a dirty part, in that part's own coordinates; back faces -Z, front faces +Z
  const zb = PCB.z - PCB.t / 2 - 0.004, zf = PCB.z + PCB.t / 2 + 0.004;
  const spots = {
    petPcb: [
      { x: 0.58, y: DOOR.y + 0.05, z: zb, w: 0.55, h: 0.75, kind: 'crust' },
      { x: -0.56, y: DOOR.y - 0.12, z: zb, w: 0.55, h: 0.7, kind: 'crust' },
      { x: 0.1, y: DOOR.y + 0.62, z: zb, w: 0.75, h: 0.42, kind: 'stain' },
      { x: 0.3, y: SCR.y - 0.5, z: zf, w: 1.0, h: 0.45, kind: 'crust', front: true },
      { x: -0.4, y: -1.25, z: zf, w: 0.9, h: 0.8, kind: 'stain', front: true },
    ],
    petKeys: [
      ...KEYS.map(([x, y]) => ({ x, y, z: 0.56, w: 0.55, h: 0.55, kind: 'juice', front: true })),
      { x: 0, y: -1.46, z: 0.3, w: 1.7, h: 0.62, kind: 'juice' },
    ],
  };
  // where the buzzer's loose red wire has to be soldered back (on the buzzer)
  const joint = new T.Vector3(0.05, 0.06, -0.03);
  return { make, pose, spots, joint, materials: M, size: { w: 2 * EGG.a, h: TOP + 1.17 - (EGG.cy - EGG.b), d: 2 * FRONT }, testAt: new T.Vector3(KEYS[1][0], KEYS[1][1], 0.55) };
}

/* ---------- the whole toy, assembled (reference sheet) ---------- */
function build(opt) {
  const k = kit(opt || {}), root = new T.Group(); root.name = 'pixel_pet';
  ['petShell', 'petLens', 'petKeys', 'petLcd', 'petPcb', 'petBuzzer', 'petCell', 'petDoor', 'petBack', 'petChain'].forEach(t => { const p = k.make[t](opt || {}); p.position.copy(k.pose[t]); root.add(p); });
  [1, 2, 3, 4].forEach(i => { const s = k.make.screw(i); root.add(s); });
  root.add(k.make.bscrew(1));
  return { root, materials: k.materials, kit: k };
}

window.PixelPet = { kit, build, drawScreen, sprite };
})();
