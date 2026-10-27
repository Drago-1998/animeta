/* Pocket Pal PP-90: the handheld from the parts reference sheet, built in code.
   Axes: X right, Y up; the front faces +Z and the back cover faces -Z. The body is 3.0 × 4.9 × 0.62.
   Every part is a named node with its pivot on its own centre, so the game can unscrew, pull and
   swap parts, and tools/sheet.html can export the same tree to a .glb for other engines. */
(function () {
'use strict';
const T = THREE;

/* ---------- layout, in device units ---------- */
const W = 3.0, H = 4.9, R = 0.42, WALL = 0.09;
const SCREWS = [[-1.18, 2.08], [1.18, 2.08], [-1.18, -2.08], [1.18, -2.08]];
const SCREEN = { y: 1.15, w: 2.36, h: 1.86 };
const WINDOW = { y: 1.18, w: 1.78, h: 1.3 };
const DIAL = [-0.82, -0.62];
const BUTTONS = [[0.8, -0.36], [0.48, -0.92], [1.12, -0.92]];
const POWER = [-0.95, -1.72];
const SPEAKER = [0.84, -1.85];
const GRILL = { x: 0.5, y: -1.85, n: 5, step: 0.17, len: 0.46, wid: 0.11, ang: Math.PI / 3 };
const PCB = { w: 2.74, h: 4.56, r: 0.3, back: 0.06, front: 0.10 };
const BAY = [0, -1.2];
// parts on the back of the board: [x, y, w, h]
const CPU = [-0.32, 0.95, 0.66, 0.66], RAM = [0.68, 1.62, 0.52, 0.28], SND = [0.72, 0.62, 0.26, 0.26];
const XTAL = [0.2, 0.25, 0.3, 0.11], FLEX = [0, 2.02, 0.92, 0.12], JST = [0.98, -0.42, 0.26, 0.14];
const USB = [0, -2.15, 0.38, 0.24], JACK = [-0.82, -2.06, 0.26, 0.36], HOLDER = [0, -1.2, 1.74, 1.0];
const TANTALUM = [[-1.0, 1.75], [1.05, 0.2], [-1.02, 0.1]];
const PASSIVES = [ // x, y, rotated 90°
  [-0.78, 0.98, 1], [-0.78, 0.78, 1], [0.17, 1.18, 0], [0.17, 0.72, 0], [-0.3, 1.45, 0], [-0.52, 1.45, 0],
  [-0.3, 0.42, 0], [-0.1, 0.42, 0], [0.35, 1.72, 1], [1.05, 1.55, 1], [0.68, 1.3, 0], [1.0, 0.78, 1],
  [1.0, 0.56, 1], [0.45, 0.6, 1], [-1.05, 1.3, 1], [-1.05, 1.1, 1], [-1.05, 0.5, 1], [0.2, -0.3, 0],
  [0.42, -0.3, 0], [-0.2, -0.3, 0], [-0.62, -0.3, 0], [-1.0, -0.35, 1], [0.55, -1.95, 0], [0.55, -2.12, 0],
  [-0.45, -2.05, 1], [0.95, -1.95, 1],
];
const STAIN = [0.22, 0.42];

/* ---------- small utilities ---------- */
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.anisotropy = 8;
  return t;
}
function fitText(g, text, x, y, maxW, size, weight, font, align = 'left') {
  let s = size;
  do { g.font = `${weight} ${s}px ${font}`; s -= 1; } while (g.measureText(text).width > maxW && s > 6);
  g.textAlign = align; g.fillText(text, x, y);
}

/* ---------- 2D outlines ---------- */
function rr(w, h, r, cx = 0, cy = 0, path = false) {
  const s = path ? new T.Path() : new T.Shape(), hw = w / 2, hh = h / 2;
  r = Math.min(r, hw * 0.999, hh * 0.999);
  s.moveTo(cx - hw + r, cy - hh);
  s.lineTo(cx + hw - r, cy - hh);
  s.absarc(cx + hw - r, cy - hh + r, r, -Math.PI / 2, 0, false);
  s.lineTo(cx + hw, cy + hh - r);
  s.absarc(cx + hw - r, cy + hh - r, r, 0, Math.PI / 2, false);
  s.lineTo(cx - hw + r, cy + hh);
  s.absarc(cx - hw + r, cy + hh - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(cx - hw, cy - hh + r);
  s.absarc(cx - hw + r, cy - hh + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
function disc(r, cx = 0, cy = 0, path = true) {
  const p = path ? new T.Path() : new T.Shape();
  p.absarc(cx, cy, r, 0, Math.PI * 2, false);
  return p;
}
function stadium(len, wid, ang, cx, cy) {
  const p = new T.Path(), r = wid / 2, hl = len / 2 - r, c = Math.cos(ang), s = Math.sin(ang), pts = [];
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + Math.PI * i / 10; pts.push([hl + r * Math.cos(a), r * Math.sin(a)]); }
  for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + Math.PI * i / 10; pts.push([-hl + r * Math.cos(a), r * Math.sin(a)]); }
  pts.forEach(([x, y], i) => { const X = cx + x * c - y * s, Y = cy + x * s + y * c; if (i) p.lineTo(X, Y); else p.moveTo(X, Y); });
  p.closePath();
  return p;
}
function ringShape(ow, oh, or, iw, ih, ir, iy = 0) {
  const s = rr(ow, oh, or); s.holes.push(rr(iw, ih, ir, 0, iy, true)); return s;
}

/* ---------- 3D primitives ---------- */
// Extruded outline centred on z = 0, with the bevel and rounded side walls shaded smooth and the caps kept flat.
function extrude(shape, thick, bevel = 0, segs = 4, curve = 14) {
  const depth = Math.max(0.0004, thick - 2 * bevel);
  const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  const side = g.groups.find(x => x.materialIndex === 1);
  if (side) {
    const p = g.attributes.position, n = g.attributes.normal, acc = new Map();
    const key = i => Math.round(p.getX(i) * 2e4) + ',' + Math.round(p.getY(i) * 2e4) + ',' + Math.round(p.getZ(i) * 2e4);
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
    for (let i = side.start; i < side.start + side.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      const f = b.clone().sub(a).cross(c.clone().sub(a));
      for (let k = 0; k < 3; k++) { const kk = key(i + k), s = acc.get(kk); if (s) s.add(f); else acc.set(kk, f.clone()); }
    }
    for (let i = side.start; i < side.start + side.count; i++) {
      const s = acc.get(key(i)); if (s && s.lengthSq() > 0) { s.normalize(); n.setXYZ(i, s.x, s.y, s.z); }
    }
    n.needsUpdate = true;
  }
  return g;
}

// Rounded box with smooth normals; `deform(v)` can push vertices (the swollen battery uses it).
function roundedBox(w, h, d, r, seg = [1, 1, 1], deform) {
  const half = [w / 2, h / 2, d / 2];
  r = Math.min(r, half[0], half[1], half[2]) * 0.999;
  const axis = (L, n) => {
    const inner = L - r, t = [Math.tan(Math.PI / 12), Math.tan(Math.PI / 6), 1], out = [];
    out.push(-(inner + r * t[2]), -(inner + r * t[1]), -(inner + r * t[0]));
    for (let i = 0; i <= n; i++) out.push(-inner + 2 * inner * i / n);
    out.push(inner + r * t[0], inner + r * t[1], inner + r * t[2]);
    return out;
  };
  const S = [axis(half[0], seg[0]), axis(half[1], seg[1]), axis(half[2], seg[2])];
  const pos = [], idx = [], seen = new Map(), v = new T.Vector3(), q = new T.Vector3();
  const vert = p => {
    q.set(Math.max(-half[0] + r, Math.min(half[0] - r, p[0])), Math.max(-half[1] + r, Math.min(half[1] - r, p[1])), Math.max(-half[2] + r, Math.min(half[2] - r, p[2])));
    v.set(p[0], p[1], p[2]).sub(q).setLength(r).add(q);
    if (deform) deform(v);
    const k = Math.round(v.x * 1e5) + ',' + Math.round(v.y * 1e5) + ',' + Math.round(v.z * 1e5);
    let i = seen.get(k);
    if (i === undefined) { i = pos.length / 3; pos.push(v.x, v.y, v.z); seen.set(k, i); }
    return i;
  };
  [[0, 1, 2, 1], [1, 0, 2, -1], [1, 2, 0, 1], [2, 1, 0, -1], [2, 0, 1, 1], [0, 2, 1, -1]].forEach(([u, vv, n, sg]) => {
    const su = S[u], sv = S[vv], grid = [];
    for (let j = 0; j < sv.length; j++) for (let i = 0; i < su.length; i++) {
      const p = [0, 0, 0]; p[u] = su[i]; p[vv] = sv[j]; p[n] = sg * half[n]; grid.push(vert(p));
    }
    const nu = su.length;
    for (let j = 0; j < sv.length - 1; j++) for (let i = 0; i < nu - 1; i++) {
      const a = grid[j * nu + i], b = grid[j * nu + i + 1], c = grid[(j + 1) * nu + i + 1], e = grid[(j + 1) * nu + i];
      if (a !== b && b !== c && a !== c) idx.push(a, b, c);
      if (a !== c && c !== e && a !== e) idx.push(a, c, e);
    }
  });
  const g = new T.BufferGeometry(), uv = [];
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / w + 0.5, pos[i + 1] / h + 0.5);
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Lathe around Y from a bottom-to-top profile; repeat a point to keep that edge crisp.
function lathe(profile, seg = 48) {
  return new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), seg);
}
function merge(list) {
  const geos = list.map(g => g.index ? g.toNonIndexed() : g);
  let n = 0; geos.forEach(g => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  geos.forEach(g => {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  });
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(pos, 3));
  out.setAttribute('normal', new T.BufferAttribute(nor, 3));
  out.setAttribute('uv', new T.BufferAttribute(uv, 2));
  return out;
}
const at = (g, x, y, z) => { g.translate(x, y, z); return g; };

/* ---------- textures ---------- */
let TEX = null;
function textures(font) {
  if (TEX) return TEX;
  const mono = '"Nunito", "Arial", sans-serif';
  const X = {};

  X.speckle = canvasTex(256, 256, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const c = 205 + r() * 38 | 0; g.fillStyle = `rgba(${c},${c},${c - 8},${0.3 + r() * 0.4})`; g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5); }
    for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(110,90,70,${0.2 + r() * 0.3})`; g.beginPath(); g.arc(r() * w, r() * h, 0.5 + r() * 0.9, 0, 7); g.fill(); }
  });
  X.speckle.wrapS = X.speckle.wrapT = T.RepeatWrapping; X.speckle.repeat.set(1.7, 1.7);

  X.lcd = canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#a7bd73'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b3d20'; g.textAlign = 'center';
    g.font = `700 30px ${font}`; g.fillText('POCKET', w / 2, 82); g.fillText('PAL', w / 2, 118);
    g.font = `600 13px ${font}`; g.fillText('PP-90', w / 2, 150);
  });

  X.sticker = canvasTex(768, 400, (g, w, h) => {
    const r = rng(3);
    g.fillStyle = '#efe5cf'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,100,70,${r() * 0.08})`; g.fillRect(r() * w, r() * h, 2, 2); }
    g.strokeStyle = '#3a2b1f'; g.lineWidth = 6; g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = '#3a2b1f';
    fitText(g, 'POCKET PAL', 44, 100, 470, 66, 700, font);
    fitText(g, 'MODEL NO. PP-90', 44, 150, 470, 26, 600, font);
    fitText(g, 'SERIAL NO. 4471-92-0318', 44, 188, 470, 26, 600, font);
    fitText(g, 'Li-Po 3.7V  ·  MADE 1991', 44, 226, 470, 26, 600, font);
    let x = 44; while (x < 420) { const bw = 2 + (r() * 5 | 0); g.fillRect(x, 250, bw, 78); x += bw + 2 + (r() * 4 | 0); }
    g.lineWidth = 6; g.beginPath(); g.arc(620, 168, 74, 0, 7); g.stroke();
    fitText(g, 'PP', 620, 194, 120, 72, 700, font, 'center');
    fitText(g, 'Гарантия недействительна при вскрытии', 44, 362, w - 88, 24, 600, mono);
  });

  const label = (bg, band, lines) => canvasTex(640, 320, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = band; g.fillRect(0, 232, w, 88);
    g.fillStyle = '#1d1a16';
    fitText(g, lines[0], 34, 92, 560, 64, 700, font);
    fitText(g, lines[1], 34, 146, 560, 32, 600, font);
    fitText(g, lines[2], 34, 196, 560, 26, 600, font);
    g.fillStyle = '#fff8e6';
    g.beginPath(); g.moveTo(54, 300); g.lineTo(80, 252); g.lineTo(106, 300); g.closePath(); g.fill();
    g.fillStyle = band; g.fillRect(77, 268, 6, 18); g.fillRect(77, 290, 6, 6);
    g.fillStyle = '#fff8e6'; fitText(g, lines[3], 124, 290, 490, 26, 700, mono);
  });
  X.labelOld = label('#e7dcbc', '#b0892f', ['Li-Po 3.7V', '1200 mAh · 4.44 Wh', 'PP-90 BP-1 · 1993', 'НЕ ПРОКАЛЫВАТЬ · НЕ НАГРЕВАТЬ']);
  X.labelNew = label('#eef3f8', '#2f6f9e', ['Li-Po 3.7V', '1500 mAh · 5.55 Wh', 'PP-90 BP-1 · НОВАЯ', 'НОВАЯ · ПРОВЕРЕНА']);

  X.cross = canvasTex(64, 64, (g, w, h) => {
    g.strokeStyle = '#26282c'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(14, 32); g.lineTo(50, 32); g.moveTo(32, 14); g.lineTo(32, 50); g.stroke();
  });

  X.speaker = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#1b1b1d'; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill();
    g.strokeStyle = '#2b2b2f'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 104, 0, 7); g.stroke();
    g.fillStyle = '#060607';
    for (let ring = 1; ring <= 3; ring++) for (let i = 0; i < ring * 8; i++) {
      const a = i / (ring * 8) * Math.PI * 2, d = ring * 26;
      g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 7, 0, 7); g.fill();
    }
    g.fillStyle = '#26262a'; g.beginPath(); g.arc(128, 128, 14, 0, 7); g.fill();
  });

  const chipTop = (w, h, lines) => canvasTex(w, h, (g) => {
    const r = rng(w + h);
    g.fillStyle = '#1d1d20'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.03})`; g.fillRect(r() * w, r() * h, 2, 2); }
    g.fillStyle = '#141416'; g.beginPath(); g.arc(w * 0.13, h * 0.17, Math.min(w, h) * 0.06, 0, 7); g.fill();
    g.fillStyle = '#9d9da3';
    lines.forEach(([t, size, y]) => fitText(g, t, w / 2, y * h, w * 0.86, size, 700, font, 'center'));
  });
  X.cpu = chipTop(256, 256, [['PAL', 58, 0.42], ['PP90-CPU', 26, 0.6], ['8.00 MHz', 20, 0.72], ['9147 A2', 18, 0.84]]);
  X.ram = chipTop(256, 138, [['PP-RAM 64K', 30, 0.5], ['9152', 22, 0.8]]);
  X.snd = chipTop(128, 128, [['SND-2', 26, 0.55], ['91', 18, 0.8]]);
  X.qc = canvasTex(96, 96, (g, w, h) => {
    g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(48, 48, 46, 0, 7); g.fill();
    g.strokeStyle = '#2f8a4a'; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(26, 50); g.lineTo(42, 64); g.lineTo(70, 32); g.stroke();
    g.fillStyle = '#2f8a4a'; fitText(g, 'QC', 48, 86, 60, 16, 700, font, 'center');
  });

  const word = (text, w, h, color, weight = 700, italic = 0) => canvasTex(w, h, (g) => {
    g.fillStyle = color; g.setTransform(1, 0, -italic, 1, italic * h * 0.5, 0);
    fitText(g, text, w / 2, h * 0.74, w * 0.92, h * 0.78, weight, font, 'center');
  });
  X.brand = word('POCKET PAL', 512, 64, '#4a3f35', 700, 0.18);
  X.powerWord = word('POWER', 256, 64, '#4a3f35', 600);
  X.pwr = word('PWR', 128, 48, '#b9b9c0', 600);

  X.pcbBack = canvasTex(1024, 1704, (g, w, h) => drawBoard(g, w, h, font, mono, true));
  X.pcbFront = canvasTex(1024, 1704, (g, w, h) => drawBoard(g, w, h, font, mono, false));
  [X.pcbBack, X.pcbFront].forEach(t => { t.repeat.set(1 / PCB.w, 1 / PCB.h); t.offset.set(0.5, 0.5); });
  return (TEX = X);
}

// Board artwork in device units. The back is drawn mirrored because it is viewed from -Z.
function drawBoard(g, w, h, font, mono, back) {
  const S = w / PCB.w, r = rng(back ? 7 : 8);
  const P = (x, y) => [((back ? -x : x) + PCB.w / 2) * S, (PCB.h / 2 - y) * S];
  g.fillStyle = '#123f25'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#16502e'; g.fillRect(18, 18, w - 36, h - 36);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 2); }
  const line = (pts, width = 5) => {
    g.lineCap = g.lineJoin = 'round';
    [['#113e24', width + 8], ['#1f6b3d', width]].forEach(([c, lw]) => {
      g.strokeStyle = c; g.lineWidth = lw; g.beginPath();
      pts.forEach(([x, y], i) => { const [X, Y] = P(x, y); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
      g.stroke();
    });
  };
  const via = (x, y) => { const [X, Y] = P(x, y); g.fillStyle = '#c9a85a'; g.beginPath(); g.arc(X, Y, 6.5, 0, 7); g.fill(); g.fillStyle = '#0c2716'; g.beginPath(); g.arc(X, Y, 2.6, 0, 7); g.fill(); };
  const silk = (cx, cy, cw, ch, name, where = 'top') => {
    const [x0, y0] = P(cx - cw / 2 - 0.03, cy + ch / 2 + 0.03), [x1, y1] = P(cx + cw / 2 + 0.03, cy - ch / 2 - 0.03);
    g.strokeStyle = '#e8ebe2'; g.lineWidth = 3; g.strokeRect(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0);
    if (name) { g.fillStyle = '#e8ebe2'; g.font = `700 22px ${mono}`; g.textAlign = 'left'; g.fillText(name, Math.min(x0, x1), where === 'top' ? y0 - 8 : y1 + 24); }
  };
  const text = (t, x, y, size, weight = 700) => { const [X, Y] = P(x, y); g.fillStyle = '#e8ebe2'; g.font = `${weight} ${size}px ${mono}`; g.textAlign = 'left'; g.fillText(t, X, Y); };
  const pad = (x, y, pw, ph, color = '#c4c7ca') => { const [X, Y] = P(x, y); g.fillStyle = color; g.fillRect(X - pw * S / 2, Y - ph * S / 2, pw * S, ph * S); };

  // random signal traces from points, bending at 45°
  const wander = (x, y, dx, dy, n) => {
    const pts = [[x, y]];
    for (let k = 0; k < n; k++) {
      const len = 0.08 + r() * 0.28; x += dx * len; y += dy * len; pts.push([x, y]);
      const turn = r() < 0.5 ? 1 : -1;
      [dx, dy] = r() < 0.5 ? [Math.sign(dx + turn * -dy) || dx, Math.sign(dy + turn * dx) || dy] : [dx, dy];
      const m = Math.hypot(dx, dy); dx /= m; dy /= m;
    }
    x = Math.max(-1.25, Math.min(1.25, x)); y = Math.max(-2.15, Math.min(2.15, y)); pts.push([x, y]);
    line(pts, 4); via(x, y);
  };

  SCREWS.forEach(([x, y]) => { const [X, Y] = P(x, y); g.fillStyle = '#c9a85a'; g.beginPath(); g.arc(X, Y, 0.135 * S, 0, 7); g.fill(); g.fillStyle = '#113e24'; g.beginPath(); g.arc(X, Y, 0.1 * S, 0, 7); g.fill(); });

  if (back) {
    // address/data bus from the CPU to the RAM
    for (let i = 0; i < 8; i++) {
      const y = CPU[1] + 0.29 - i * 0.045, xr = RAM[0] - 0.21 + i * 0.06, dy = (RAM[1] - 0.21) - y;
      line([[CPU[0] + 0.4, y], [xr - dy, y], [xr, RAM[1] - 0.21]]);
    }
    for (let side = 0; side < 4; side++) for (let k = 0; k < 14; k++) {
      if (r() < 0.45 || (side === 1 && k > 7)) continue;
      const o = (k - 6.5) * 0.042, e = 0.4;
      const [x, y, dx, dy] = [[CPU[0] + o, CPU[1] + e, 0, 1], [CPU[0] + e, CPU[1] + o, 1, 0], [CPU[0] + o, CPU[1] - e, 0, -1], [CPU[0] - e, CPU[1] + o, -1, 0]][side];
      wander(x, y, dx, dy, 2 + (r() * 2 | 0));
    }
    for (let i = 0; i < 18; i++) wander(-1.2 + r() * 2.4, -2.1 + r() * 4.2, r() < 0.5 ? 1 : -1, 0, 2);
    line([[JST[0], JST[1] + 0.07], [JST[0], 0.05], [1.2, 0.3], [1.2, 1.2], [1.0, 1.4]], 12);
    line([[JST[0] - 0.05, JST[1] + 0.07], [0.6, -0.12], [-0.9, -0.12], [-1.2, 0.18], [-1.2, 1.9]], 12);
    line([[USB[0] - 0.1, USB[1] + 0.12], [-0.1, -1.85], [-1.1, -1.85], [-1.2, -1.7], [-1.2, -0.3]], 10);

    // pads peeking out under the parts
    PASSIVES.forEach(([x, y, rot]) => { const dx = rot ? 0 : 0.05, dy = rot ? 0.05 : 0; pad(x - dx, y - dy, 0.05, 0.06); pad(x + dx, y + dy, 0.05, 0.06); });
    TANTALUM.forEach(([x, y]) => { pad(x - 0.08, y, 0.05, 0.09); pad(x + 0.08, y, 0.05, 0.09); });
    for (let k = 0; k < 14; k++) {
      const o = (k - 6.5) * 0.042, e = CPU[2] / 2 + 0.05;
      pad(CPU[0] + o, CPU[1] + e, 0.026, 0.07); pad(CPU[0] + o, CPU[1] - e, 0.026, 0.07);
      pad(CPU[0] + e, CPU[1] + o, 0.07, 0.026); pad(CPU[0] - e, CPU[1] + o, 0.07, 0.026);
    }
    for (let k = 0; k < 8; k++) { const o = (k - 3.5) * 0.06, e = RAM[3] / 2 + 0.05; pad(RAM[0] + o, RAM[1] + e, 0.026, 0.07); pad(RAM[0] + o, RAM[1] - e, 0.026, 0.07); }

    // silkscreen
    silk(...CPU, 'U1'); silk(...RAM, 'U2'); silk(...SND, 'U3', 'bottom'); silk(...XTAL, 'X1 8.00MHz', 'bottom');
    silk(...JST, 'J2 BAT'); silk(...USB, 'J3 USB-C'); silk(...JACK, 'J4'); silk(...FLEX, 'J1 LCD', 'bottom');
    silk(...HOLDER, '');
    text('B+', 0.98, -1.5, 26); text('B−', -1.1, -1.5, 26);
    text('POCKET PAL · PP-90 MAIN · REV.B', 0.42, -0.42, 26);
    text('© 1991   DATE 9147   ▲ 94V-0', 0.42, -0.53, 20, 600);
    PASSIVES.forEach(([x, y], i) => { if (i % 3 === 0) text((i % 2 ? 'R' : 'C') + (i + 1), x + 0.06, y + 0.1, 16, 600); });
    [[-1.2, 2.18], [1.2, -2.2], [1.22, 2.18]].forEach(([x, y]) => { const [X, Y] = P(x, y); g.fillStyle = '#c4c7ca'; g.beginPath(); g.arc(X, Y, 9, 0, 7); g.fill(); });
  } else {
    for (let i = 0; i < 26; i++) wander(-1.2 + r() * 2.4, -2.1 + r() * 4.2, r() < 0.5 ? 1 : -1, 0, 2);
    // button contacts: interleaved combs under each rubber pad
    const comb = (x, y, rad) => {
      const [X, Y] = P(x, y), R2 = rad * S;
      g.save(); g.beginPath(); g.arc(X, Y, R2, 0, 7); g.clip();
      g.fillStyle = '#d6b25a'; g.fillRect(X - R2, Y - R2, R2 * 2, R2 * 2);
      g.fillStyle = '#16502e';
      const n = Math.max(4, Math.round(rad * 40));
      for (let i = 0; i < n; i++) { const yy = Y - R2 + (i + 0.5) * (2 * R2 / n); g.fillRect(i % 2 ? X - R2 + 7 : X - R2, yy - 2, R2 * 2 - 7, 4); }
      g.restore();
      g.strokeStyle = '#e8ebe2'; g.lineWidth = 3; g.beginPath(); g.arc(X, Y, R2 + 8, 0, 7); g.stroke();
    };
    [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(([dx, dy]) => comb(DIAL[0] + dx * 0.24, DIAL[1] + dy * 0.24, 0.1));
    comb(DIAL[0], DIAL[1], 0.07);
    BUTTONS.forEach(([x, y]) => comb(x, y, 0.16));
    comb(POWER[0], POWER[1], 0.1);
    for (let i = 0; i < 24; i++) pad(-0.46 + i * 0.04, 2.05, 0.022, 0.12, '#d6b25a');
    const [sx, sy] = P(SPEAKER[0], SPEAKER[1]); g.strokeStyle = '#e8ebe2'; g.lineWidth = 3; g.beginPath(); g.arc(sx, sy, 0.29 * S, 0, 7); g.stroke();
    text('SW1 DIAL', DIAL[0] - 0.3, DIAL[1] + 0.48, 22); text('SW2', BUTTONS[0][0] - 0.12, BUTTONS[0][1] + 0.3, 22);
    text('SW5 PWR', POWER[0] - 0.2, POWER[1] + 0.26, 22); text('SP1', SPEAKER[0] - 0.08, SPEAKER[1] + 0.38, 22);
    text('LCD', -0.08, 1.88, 24);
  }
}

/* ---------- materials ---------- */
function materials(o, X) {
  const S = (color, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0 }, extra));
  const decal = (map, extra) => S(0xffffff, Object.assign({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 0.6 }, extra));
  const body = S(o.body, { map: X.speckle, roughness: 0.66, envMapIntensity: 0.45 }), trim = S(o.trim, { map: X.speckle, roughness: 0.7, envMapIntensity: 0.45 });
  const M = {
    body, trim, coverBody: body.clone(), coverTrim: trim.clone(),
    dark: S(0x2c2d32, { roughness: 0.45 }), rubber: S(0x25262a, { roughness: 0.72 }), black: S(0x141416, { roughness: 0.6 }),
    red: S(0xd0432c, { roughness: 0.3 }), powerRed: S(0xc93a26, { roughness: 0.3 }),
    screw: S(0xc5c8cd, { metalness: 0.9, roughness: 0.28 }), steel: S(0xc9ccd1, { metalness: 0.85, roughness: 0.3 }),
    tin: S(0xc0c4c8, { metalness: 0.8, roughness: 0.38 }), brass: S(0xd8aa50, { metalness: 0.85, roughness: 0.3 }),
    pcbEdge: S(0x2f6e3e, { roughness: 0.5 }), chip: S(0x1c1c1f, { roughness: 0.5 }), holder: S(0x232426, { roughness: 0.6 }),
    pcbBack: S(0xffffff, { map: X.pcbBack, roughness: 0.42 }), pcbFront: S(0xffffff, { map: X.pcbFront, roughness: 0.42 }),
    silicone: S(0xe9eef0, { roughness: 0.5, transparent: true, opacity: 0.9 }),
    pouch: S(0xc4c8cf, { metalness: 0.6, roughness: 0.36 }), pouchNew: S(0xc9cdd4, { metalness: 0.6, roughness: 0.34 }),
    labelOld: S(0xffffff, { map: X.labelOld, roughness: 0.6 }), labelNew: S(0xffffff, { map: X.labelNew, roughness: 0.55 }),
    tape: S(0xdfa62a, { roughness: 0.4 }), flex: S(0xd9822b, { roughness: 0.4, side: T.DoubleSide }),
    jst: S(0xf0ece2, { roughness: 0.5 }), connector: S(0xe6dcc3, { roughness: 0.55 }),
    tantalum: S(0xdaa524, { roughness: 0.45 }), band: S(0x5a3a14, { roughness: 0.5 }), cap: S(0xb08a5c, { roughness: 0.55 }), res: S(0x202023, { roughness: 0.5 }),
    wireRed: S(0xc42a20, { roughness: 0.45 }), wireBlack: S(0x1d1d1f, { roughness: 0.45 }),
    glass: S(0xffffff, { roughness: 0.05, transparent: true, opacity: 0.14, depthWrite: false }),
    lcd: new T.MeshBasicMaterial({ map: o.screen || X.lcd }), led: S(0x5a1510, { roughness: 0.3 }),
    groove: S(0x4f4134, { roughness: 0.8 }),
    sticker: decal(X.sticker, { transparent: false, depthWrite: true, roughness: 0.75 }), speaker: S(0xffffff, { map: X.speaker, roughness: 0.7 }),
    cross: decal(X.cross), cpu: decal(X.cpu, { transparent: false, depthWrite: true }), ram: decal(X.ram, { transparent: false, depthWrite: true }),
    snd: decal(X.snd, { transparent: false, depthWrite: true }), qc: decal(X.qc), brand: decal(X.brand), powerWord: decal(X.powerWord), pwr: decal(X.pwr),
    notch: S(0xf1e9d8, { roughness: 0.5 }),
  };
  const dull = { dark: 0.5, rubber: 0.35, black: 0.4, red: 0.6, powerRed: 0.6, pcbEdge: 0.4, chip: 0.5, holder: 0.45, pcbBack: 0.35, pcbFront: 0.35,
    silicone: 0.6, labelOld: 0.3, labelNew: 0.35, tape: 0.5, jst: 0.45, connector: 0.45, tantalum: 0.5, cap: 0.45, res: 0.45,
    wireRed: 0.5, wireBlack: 0.5, groove: 0.4, sticker: 0.35, speaker: 0.4, cpu: 0.4, ram: 0.4, snd: 0.4, qc: 0.4, brand: 0.4, powerWord: 0.4, pwr: 0.4, notch: 0.5, flex: 0.5 };
  Object.keys(dull).forEach(k => { M[k].envMapIntensity = dull[k]; });
  M.labelOld.roughness = M.labelNew.roughness = 0.85;
  return M;
}

/* ---------- the build ---------- */
function build(opt) {
  const o = Object.assign({ body: 0xc9b189, trim: 0xb39a74, swollen: true, font: '"Unbounded", "Arial Black", sans-serif', screen: null }, opt);
  const X = textures(o.font), M = materials(o, X);
  const root = new T.Group(); root.name = 'pocket_pal';
  const group = (parent, name, x = 0, y = 0, z = 0, explode = 0) => {
    const g = new T.Group(); g.name = name; g.position.set(x, y, z); if (explode) g.userData.explode = explode; parent.add(g); return g;
  };
  const mesh = (parent, name, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new T.Mesh(geo, mat); m.name = name; m.position.set(x, y, z); parent.add(m); return m;
  };
  const back = m => { m.rotation.y = Math.PI; return m; };
  const plane = (w, h) => new T.PlaneGeometry(w, h);
  const ringRim = (rin, rout, thick) => extrude((() => { const s = disc(rout, 0, 0, false); s.holes.push(disc(rin)); return s; })(), thick, 0.006, 2, 20);

  /* front half of the shell */
  const front = group(root, 'front_shell', 0, 0, 0, 1.7);
  const b = 0.03, plate = rr(W - 2 * b, H - 2 * b, R - b);
  plate.holes.push(rr(SCREEN.w, SCREEN.h, 0.16, 0, SCREEN.y, true), disc(0.46, ...DIAL), disc(0.15, ...POWER), ...BUTTONS.map(([x, y]) => disc(0.225, x, y)));
  for (let i = 0; i < GRILL.n; i++) plate.holes.push(stadium(GRILL.len, GRILL.wid, GRILL.ang, GRILL.x + i * GRILL.step, GRILL.y));
  mesh(front, 'front_plate', extrude(plate, 0.14, b, 5), M.body, 0, 0, 0.24);
  const wallRing = bv => ringShape(W - 2 * bv, H - 2 * bv, R - bv, W - 2 * WALL, H - 2 * WALL, R - WALL);
  mesh(front, 'front_walls', extrude(wallRing(0.015), 0.25, 0.015, 3), M.body, 0, 0, 0.125);
  mesh(front, 'dial_collar', ringRim(0.46, 0.53, 0.03), M.trim, ...DIAL, 0.318);
  BUTTONS.forEach(([x, y], i) => mesh(front, 'button_collar_' + (i + 1), ringRim(0.225, 0.27, 0.024), M.trim, x, y, 0.316));
  mesh(front, 'power_collar', ringRim(0.15, 0.19, 0.02), M.trim, ...POWER, 0.314);
  mesh(front, 'screen_gasket', extrude(ringShape(2.42, 1.92, 0.18, 1.99, 1.51, 0.02, WINDOW.y - SCREEN.y), 0.012, 0, 1), M.black, 0, SCREEN.y, 0.186);
  mesh(front, 'grill_felt', extrude(rr(1.12, 0.62, 0.08), 0.008, 0, 1), M.black, 0.84, GRILL.y, 0.166);
  mesh(front, 'brand', plane(1.3, 0.16), M.brand, 0, 0.05, 0.3112);
  mesh(front, 'power_label', plane(0.4, 0.1), M.powerWord, POWER[0], POWER[1] - 0.27, 0.3112);
  SCREWS.forEach(([x, y], i) => {
    const boss = mesh(front, 'front_boss_' + (i + 1), new T.CylinderGeometry(0.085, 0.085, 0.165, 24), M.trim, x, y, 0.0875);
    boss.rotation.x = Math.PI / 2;
    back(mesh(front, 'front_boss_hole_' + (i + 1), new T.CircleGeometry(0.035, 16), M.black, x, y, 0.0045));
  });
  [-0.8, 0.8].forEach((x, i) => mesh(front, 'shoulder_' + (i ? 'right' : 'left'), roundedBox(0.46, 0.09, 0.15, 0.03), M.dark, x, 2.47, 0.1));
  mesh(front, 'card_slot', roundedBox(0.42, 0.02, 0.045, 0.008), M.black, 0, 2.452, 0.1);
  mesh(front, 'usb_port', roundedBox(0.34, 0.03, 0.11, 0.05), M.black, 0, -2.452, 0.1);
  mesh(front, 'usb_tongue', roundedBox(0.2, 0.02, 0.024, 0.008), M.tin, 0, -2.456, 0.1);
  const jack = mesh(front, 'audio_jack', new T.CylinderGeometry(0.055, 0.055, 0.03, 24), M.black, -0.82, -2.452, 0.1);
  const jackRing = mesh(front, 'audio_jack_ring', new T.TorusGeometry(0.063, 0.009, 8, 28), M.tin, -0.82, -2.456, 0.1);
  jackRing.rotation.x = Math.PI / 2; void jack;

  /* screen bezel, glass and power LED */
  const bezel = group(root, 'bezel', 0, SCREEN.y, 0.27, 2.3);
  const bz = ringShape(2.28 - 0.016, 1.78 - 0.016, 0.135, WINDOW.w, WINDOW.h, 0.06, WINDOW.y - SCREEN.y);
  mesh(bezel, 'bezel_frame', extrude(bz, 0.06, 0.008, 2), M.dark);
  const ledGeo = new T.SphereGeometry(0.034, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2); ledGeo.rotateX(Math.PI / 2);
  const led = mesh(bezel, 'power_led', ledGeo, M.led, -1.015, 0.4, 0.03);
  mesh(bezel, 'led_label', plane(0.15, 0.056), M.pwr, -1.015, 0.29, 0.0305);
  mesh(bezel, 'screen_glass', plane(WINDOW.w, WINDOW.h), M.glass, 0, WINDOW.y - SCREEN.y, 0.022);

  /* LCD module */
  const lcd = group(root, 'lcd', 0, WINDOW.y, 0.215, 1.25);
  mesh(lcd, 'lcd_frame', roundedBox(1.98, 1.5, 0.05, 0.015), M.tin);
  const screen = mesh(lcd, 'lcd_panel', plane(1.84, 1.36), M.lcd, 0, 0, 0.0255);
  mesh(lcd, 'lcd_flex', new T.BoxGeometry(0.5, 0.006, 0.1), M.flex, 0, -0.752, -0.075);

  /* thumb dial */
  const dial = group(root, 'thumb_dial', ...DIAL, 0.225, 1.25);
  const knob = [lathe([[0, 0], [0.45, 0], [0.45, 0], [0.45, 0.03], [0.45, 0.03], [0.37, 0.03], [0.37, 0.03], [0.37, 0.15], [0.362, 0.162], [0.338, 0.17], [0.26, 0.164], [0.14, 0.156], [0, 0.153]], 64)];
  for (let i = 0; i < 48; i++) { const k = new T.BoxGeometry(0.018, 0.1, 0.02); k.translate(0, 0.09, 0.372); k.rotateY(i / 48 * Math.PI * 2); knob.push(k); }
  const knobGeo = merge(knob); knobGeo.rotateX(Math.PI / 2);
  mesh(dial, 'dial_knob', knobGeo, M.rubber);
  const notch = roundedBox(0.04, 0.012, 0.13, 0.005); notch.translate(0, 0.165, -0.25); notch.rotateX(Math.PI / 2);
  mesh(dial, 'dial_notch', notch, M.notch);

  /* action buttons and power */
  const btnGeo = lathe([[0, 0], [0.235, 0], [0.235, 0], [0.235, 0.03], [0.235, 0.03], [0.19, 0.03], [0.19, 0.03], [0.19, 0.17], [0.186, 0.195], [0.17, 0.216], [0.135, 0.234], [0.075, 0.246], [0, 0.25]]);
  btnGeo.rotateX(Math.PI / 2);
  BUTTONS.forEach(([x, y], i) => { const g = group(root, 'button_' + 'abc'[i], x, y, 0.13, 1.25); mesh(g, 'button_' + 'abc'[i] + '_cap', btnGeo, M.red); });
  const pwrGeo = lathe([[0, 0], [0.14, 0], [0.14, 0], [0.14, 0.02], [0.14, 0.02], [0.11, 0.02], [0.11, 0.02], [0.11, 0.1], [0.104, 0.118], [0.088, 0.13], [0.05, 0.138], [0, 0.14]]);
  pwrGeo.rotateX(Math.PI / 2);
  const powerGroup = group(root, 'power_button', ...POWER, 0.2, 1.25);
  const power = mesh(powerGroup, 'power_button_cap', pwrGeo, M.powerRed);

  /* rubber pads under the controls */
  const pads = group(root, 'button_pads', 0, 0, 0, 0.75);
  const dome = (r, hgt) => { const g = lathe([[0, 0], [r, 0], [r, 0], [r, 0.012], [r * 0.9, 0.02], [r * 0.72, hgt * 0.9], [0, hgt]], 32); g.rotateX(Math.PI / 2); return g; };
  mesh(pads, 'dial_pad', dome(0.42, 0.035), M.silicone, ...DIAL, 0.1);
  BUTTONS.forEach(([x, y], i) => mesh(pads, 'button_pad_' + (i + 1), dome(0.2, 0.05), M.silicone, x, y, 0.1));
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = BUTTONS[i], [bx, by] = BUTTONS[(i + 1) % 3], len = Math.hypot(bx - ax, by - ay);
    const web = mesh(pads, 'button_web_' + (i + 1), roundedBox(len, 0.1, 0.012, 0.005), M.silicone, (ax + bx) / 2, (ay + by) / 2, 0.106);
    web.rotation.z = Math.atan2(by - ay, bx - ax);
  }
  mesh(pads, 'power_pad', dome(0.14, 0.04), M.silicone, ...POWER, 0.1);

  /* speaker behind the grill */
  const spk = group(root, 'speaker', ...SPEAKER, 0.1325, 0.45);
  const spkBody = mesh(spk, 'speaker_body', new T.CylinderGeometry(0.27, 0.25, 0.065, 40), M.black); spkBody.rotation.x = Math.PI / 2;
  mesh(spk, 'speaker_face', new T.CircleGeometry(0.262, 40), M.speaker, 0, 0, 0.0328);

  /* main board and everything soldered to it */
  const pcb = group(root, 'pcb');
  const holes = s => { SCREWS.forEach(([x, y]) => s.holes.push(disc(0.1, x, y))); return s; };
  mesh(pcb, 'pcb_board', extrude(holes(rr(PCB.w - 0.008, PCB.h - 0.008, PCB.r - 0.004)), 0.04, 0.004, 1), M.pcbEdge, 0, 0, 0.08);
  const face = holes(rr(PCB.w - 0.01, PCB.h - 0.01, PCB.r));
  back(mesh(pcb, 'pcb_back_print', new T.ShapeGeometry(face, 14), M.pcbBack, 0, 0, PCB.back - 0.0008));
  mesh(pcb, 'pcb_front_print', new T.ShapeGeometry(face, 14), M.pcbFront, 0, 0, PCB.front + 0.0008);

  const zOn = hgt => PCB.back - hgt / 2; // centre of a part of this height resting on the back of the board
  const chip = (name, [x, y, w, h], hgt, topMat, pinsX, pinsY, pitch) => {
    mesh(pcb, name, roundedBox(w, h, hgt, 0.008), M.chip, x, y, zOn(hgt) - 0.006);
    back(mesh(pcb, name + '_marking', plane(w - 0.04, h - 0.04), topMat, x, y, zOn(hgt) - 0.006 - hgt / 2 - 0.0008));
    const pins = [];
    for (let k = 0; k < pinsX; k++) { const ox = (k - (pinsX - 1) / 2) * pitch; [1, -1].forEach(s => pins.push(at(new T.BoxGeometry(0.022, 0.08, 0.012), x + ox, y + s * (h / 2 + 0.035), 0.052))); }
    for (let k = 0; k < pinsY; k++) { const oy = (k - (pinsY - 1) / 2) * pitch; [1, -1].forEach(s => pins.push(at(new T.BoxGeometry(0.08, 0.022, 0.012), x + s * (w / 2 + 0.035), y + oy, 0.052))); }
    if (pins.length) mesh(pcb, name + '_pins', merge(pins), M.tin);
  };
  chip('cpu', CPU, 0.05, M.cpu, 14, 14, 0.042);
  chip('ram', RAM, 0.04, M.ram, 8, 0, 0.06);
  chip('sound_chip', SND, 0.03, M.snd, 0, 0, 0);
  mesh(pcb, 'crystal', roundedBox(XTAL[2], XTAL[3], 0.05, 0.05), M.steel, XTAL[0], XTAL[1], zOn(0.05));
  const tBody = [], tBand = [];
  TANTALUM.forEach(([x, y]) => { tBody.push(at(roundedBox(0.15, 0.08, 0.06, 0.008), x, y, zOn(0.06))); tBand.push(at(new T.BoxGeometry(0.026, 0.082, 0.062), x + 0.052, y, zOn(0.06))); });
  mesh(pcb, 'tantalum_caps', merge(tBody), M.tantalum); mesh(pcb, 'tantalum_bands', merge(tBand), M.band);
  const caps = [], res = [], ends = [];
  PASSIVES.forEach(([x, y, rot], i) => {
    const bw = rot ? 0.045 : 0.08, bh = rot ? 0.08 : 0.045;
    (i % 2 ? res : caps).push(at(new T.BoxGeometry(bw, bh, 0.026), x, y, zOn(0.026)));
    [-1, 1].forEach(s => ends.push(at(new T.BoxGeometry(rot ? 0.047 : 0.016, rot ? 0.016 : 0.047, 0.028), x + (rot ? 0 : s * 0.036), y + (rot ? s * 0.036 : 0), zOn(0.028))));
  });
  mesh(pcb, 'capacitors', merge(caps), M.cap); mesh(pcb, 'resistors', merge(res), M.res); mesh(pcb, 'passive_ends', merge(ends), M.tin);
  mesh(pcb, 'lcd_connector', roundedBox(FLEX[2], FLEX[3], 0.055, 0.01), M.connector, FLEX[0], FLEX[1], zOn(0.055));
  mesh(pcb, 'lcd_connector_latch', roundedBox(FLEX[2] - 0.04, 0.04, 0.02, 0.006), M.dark, FLEX[0], FLEX[1] + 0.04, zOn(0.055) - 0.03);
  mesh(pcb, 'lcd_flex_back', new T.BoxGeometry(0.8, 0.2, 0.006), M.flex, 0, 2.18, PCB.back - 0.004);
  const bend = new T.CylinderGeometry(0.024, 0.024, 0.8, 16, 1, true, 0, Math.PI); bend.rotateZ(Math.PI / 2);
  mesh(pcb, 'lcd_flex_bend', bend, M.flex, 0, PCB.h / 2, 0.08);
  mesh(pcb, 'battery_connector', roundedBox(JST[2], JST[3], 0.1, 0.012), M.jst, JST[0], JST[1], zOn(0.1));
  mesh(pcb, 'usb_receptacle', roundedBox(USB[2], USB[3], 0.12, 0.04), M.steel, USB[0], USB[1], 0);
  mesh(pcb, 'jack_module', roundedBox(JACK[2], JACK[3], 0.12, 0.02), M.chip, JACK[0], JACK[1], 0);
  back(mesh(pcb, 'qc_sticker', new T.CircleGeometry(0.07, 24), M.qc, 0.62, -0.62, PCB.back - 0.0015));

  const holder = ringShape(HOLDER[2] - 0.012, HOLDER[3] - 0.012, 0.07, 1.58, 0.88, 0.04);
  mesh(pcb, 'battery_holder', extrude(holder, 0.12, 0.006, 2), M.holder, HOLDER[0], HOLDER[1], 0);
  const contacts = [-1, 1].map(s => {
    const c = group(pcb, 'contact_' + (s < 0 ? 'left' : 'right'), s * 0.69, BAY[1], 0.052);
    mesh(c, 'plate', roundedBox(0.17, 0.36, 0.012, 0.004), M.brass);
    mesh(c, 'finger', roundedBox(0.012, 0.3, 0.09, 0.004), M.brass, s * 0.095, 0, -0.045);
    const tab = mesh(c, 'spring', roundedBox(0.012, 0.2, 0.07, 0.004), M.brass, s * 0.07, 0, -0.055); tab.rotation.y = s * 0.5;
    mesh(c, 'tail', roundedBox(0.09, 0.06, 0.012, 0.004), M.brass, s * 0.22, 0, 0);
    return c;
  });
  const wire = (name, pts, mat) => mesh(pcb, name, new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), 80, 0.016, 6), mat);
  wire('wire_red', [[0.94, -0.49, 0.03], [1.0, -0.62, 0.034], [1.03, -0.9, 0.036], [0.98, -1.12, 0.04], [0.92, -1.2, 0.044]], M.wireRed);
  wire('wire_black', [[1.02, -0.49, 0.03], [0.9, -0.6, 0.03], [0.4, -0.64, 0.032], [-0.4, -0.64, 0.032], [-0.88, -0.67, 0.032], [-1.02, -0.9, 0.036], [-0.98, -1.12, 0.04], [-0.92, -1.2, 0.044]], M.wireBlack);

  /* battery: a lithium pouch, swollen in the broken unit */
  const pouch = (name, swell, pouchMat, labelMat) => {
    const g = group(root, name, BAY[0], BAY[1], 0, -0.75);
    const hw = 0.75, hh = 0.42, bb = swell ? 0.06 : 0, bf = swell ? 0.015 : 0;
    const f = (x, y) => Math.max(0, 1 - (x / hw) ** 2) * Math.max(0, 1 - (y / hh) ** 2);
    const puff = ox => v => { const k = f(v.x + ox, v.y); if (v.z < 0) v.z -= bb * k; else v.z += bf * k; };
    mesh(g, name + '_pouch', roundedBox(1.5, 0.84, 0.11, 0.035, [18, 12, 2], puff(0)), pouchMat);
    const lg = new T.PlaneGeometry(1.26, 0.63, 24, 12); lg.rotateY(Math.PI);
    const lp = lg.attributes.position, lx = -0.04;
    for (let i = 0; i < lp.count; i++) lp.setZ(i, -0.0572 - bb * f(lp.getX(i) + lx, lp.getY(i)));
    lg.computeVertexNormals();
    mesh(g, name + '_label', lg, labelMat, lx, 0, 0);
    mesh(g, name + '_tape', roundedBox(0.12, 0.862, 0.118, 0.02, [4, 12, 2], puff(0.69)), M.tape, 0.69, 0, 0);
    [-1, 1].forEach(s => mesh(g, name + '_tab_' + (s < 0 ? 'neg' : 'pos'), roundedBox(0.05, 0.14, 0.012, 0.004), M.tin, s * 0.77, 0, 0.03));
    return g;
  };
  const battery = pouch('battery', o.swollen, M.pouch, M.labelOld);
  const newBattery = pouch('battery_new', false, M.pouchNew, M.labelNew); newBattery.visible = false;

  /* back cover: plate, walls, label, grip and battery door move as one piece */
  const cover = group(root, 'back_cover', 0, 0, 0, -1.7);
  const bplate = rr(W - 2 * b, H - 2 * b, R - b); SCREWS.forEach(([x, y]) => bplate.holes.push(disc(0.125, x, y)));
  mesh(cover, 'back_plate', extrude(bplate, 0.14, b, 5), M.coverBody, 0, 0, -0.24);
  mesh(cover, 'back_walls', extrude(wallRing(0.015), 0.25, 0.015, 3), M.coverBody, 0, 0, -0.125);
  SCREWS.forEach(([x, y], i) => {
    const boss = mesh(cover, 'back_boss_' + (i + 1), new T.CylinderGeometry(0.12, 0.12, 0.165, 24), M.coverTrim, x, y, -0.0875); boss.rotation.x = Math.PI / 2;
    back(mesh(cover, 'screw_channel_' + (i + 1), new T.CircleGeometry(0.06, 16), M.black, x, y, -0.1712));
  });
  mesh(cover, 'label_frame', extrude(ringShape(1.62, 0.9, 0.06, 1.5, 0.78, 0.04), 0.01, 0.002, 1), M.coverTrim, 0, 1.3, -0.315);
  back(mesh(cover, 'label', plane(1.5, 0.78), M.sticker, 0, 1.3, -0.3106));
  for (let i = 0; i < 7; i++) mesh(cover, 'grip_ridge_' + (i + 1), roundedBox(2.2, 0.04, 0.03, 0.012), M.coverBody, 0, -0.2 - i * 0.1, -0.31);
  mesh(cover, 'battery_door_seam', extrude(ringShape(1.9, 1.16, 0.06, 1.82, 1.08, 0.045), 0.004, 0, 1), M.groove, 0, -1.6, -0.3105);
  mesh(cover, 'battery_door', roundedBox(1.82, 1.08, 0.03, 0.012), M.coverBody, 0, -1.6, -0.301);
  for (let i = 0; i < 5; i++) mesh(cover, 'door_ridge_' + (i + 1), roundedBox(1.3, 0.025, 0.012, 0.005), M.coverBody, 0, -1.78 - i * 0.07, -0.318);
  mesh(cover, 'door_latch', roundedBox(0.36, 0.1, 0.03, 0.012), M.coverTrim, 0, -1.14, -0.318);
  for (let i = 0; i < 3; i++) mesh(cover, 'latch_grip_' + (i + 1), new T.BoxGeometry(0.26, 0.012, 0.01), M.coverBody, 0, -1.115 - i * 0.025, -0.334);

  /* four Phillips screws: head outward (-Z), thread into the shell (+Z) */
  const head = lathe([[0, 0], [0.105, 0], [0.105, 0], [0.105, 0.014], [0.098, 0.024], [0.085, 0.03], [0.07, 0.032], [0, 0.032]], 32);
  const shank = new T.CylinderGeometry(0.04, 0.03, 0.34, 16); shank.translate(0, -0.17, 0);
  const helix = []; for (let t = 0; t <= 10 * Math.PI * 2; t += 0.25) helix.push(new T.Vector3(Math.cos(t) * 0.044, -0.02 - t / (Math.PI * 2) * 0.03, Math.sin(t) * 0.044));
  const thread = new T.TubeGeometry(new T.CatmullRomCurve3(helix), 160, 0.009, 4);
  const screwGeo = merge([head, shank, thread]); screwGeo.rotateX(-Math.PI / 2);
  const screws = SCREWS.map(([x, y], i) => {
    const g = group(root, 'screw_' + (i + 1), x, y, -0.302, -2.5);
    mesh(g, 'screw_' + (i + 1) + '_body', screwGeo, M.screw);
    back(mesh(g, 'screw_' + (i + 1) + '_slot', plane(0.13, 0.13), M.cross, 0, 0, -0.0326));
    return g;
  });

  return {
    root, cover, screws, battery, newBattery, power, led, screen, contacts,
    slot: battery.position.clone(),
    spots: { contacts: contacts.map(c => new T.Vector3(c.position.x, c.position.y, 0.044)), stain: new T.Vector3(STAIN[0], STAIN[1], PCB.back - 0.0015) },
    glow: { screws: [M.screw], cover: [M.coverBody, M.coverTrim], battery: [M.pouch, M.labelOld], newBattery: [M.pouchNew, M.labelNew], power: [M.powerRed] },
    materials: M,
  };
}

// Soft studio reflections so metal, plastic and the LiPo pouch read as real materials.
function environment(renderer) {
  const s = new T.Scene();
  s.add(new T.Mesh(new T.BoxGeometry(30, 30, 30), new T.MeshBasicMaterial({ color: 0x2a2119, side: T.BackSide })));
  const panel = (color, w, h, x, y, z) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color, side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  panel(0xfff0d8, 10, 6, -9, 9, 8);
  panel(0xa9bde3, 8, 10, 11, 4, -2);
  panel(0x6a5038, 30, 8, 0, -13, 0);
  panel(0xffffff, 8, 4, 0, 13, 4);
  panel(0xffe2bc, 6, 6, 4, 2, 13);
  const pm = new T.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.04).texture;
  pm.dispose();
  return tex;
}

window.PocketPal = { build, environment, size: { w: W, h: H, d: 0.62 } };
})();
