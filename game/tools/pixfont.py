"""Builds game/pixfont.js: the two bitmap fonts the gadgets' LCDs write with.

Reads the X11 Cyrillic bitmap fonts (Debian/Ubuntu package xfonts-cyrillic) through Pillow:
koi6x10 for small text and Cronyx Helvetica Bold 11 (crox1hb) for titles, both KOI8-R.
Run from the repository root:  python3 game/tools/pixfont.py game/pixfont.js
"""
import gzip, io, sys
from PIL import PcfFontFile
from PIL.PcfFontFile import PCF_BDF_ENCODINGS


# Pillow maps a PCF font's encoding table as if it started at code 0; these KOI8-R fonts start at 32
class Pcf(PcfFontFile.PcfFontFile):
    def _load_encoding(self):
        fp, format, i16, i32 = self._getformat(PCF_BDF_ENCODINGS)
        first_col, last_col = i16(fp.read(2)), i16(fp.read(2))
        first_row, last_row = i16(fp.read(2)), i16(fp.read(2))
        i16(fp.read(2))
        n = (last_col - first_col + 1) * (last_row - first_row + 1)
        offs = [i16(fp.read(2)) for _ in range(n)]
        enc = [None] * 256
        for i in range(first_col, min(256, last_col + 1)):
            o = offs[i - first_col]
            if o != 0xFFFF: enc[i] = o
        return enc


def load(name):
    raw = gzip.open('/usr/share/fonts/X11/cyrillic/%s.pcf.gz' % name).read()
    f = Pcf(io.BytesIO(raw), 'iso8859-1'); f.compile(); return f


# a glyph as rows of '#' and '.', with its offset from the baseline
def glyph(f, ch):
    g = f.glyph[ch.encode('koi8_r')[0]]
    if g is None: return None
    dx, dst, src, im = g
    w, h = im.size
    px = im.load() if w and h else None
    return dict(x0=dst[0], y0=dst[1], w=w, h=h, rows=[''.join('#' if px[x, y] else '.' for x in range(w)) for y in range(h)])


A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
CHARS = ''.join(chr(c) for c in range(33, 127)) + 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя'


# every glyph cut to its ink: its width, then each column as base-64 digits, the low bit at the top of the cell
def build(name, space, over={}):
    f = load(name)
    gl = {c: glyph(f, c) for c in CHARS}
    top = min(g['y0'] for g in gl.values() if g and g['h'])
    bot = max(g['y0'] + g['h'] for g in gl.values() if g and g['h'])
    H = bot - top
    n = -(-H // 6)
    data = []
    for c in CHARS:
        g = gl[c]
        cols = []
        for x in range(g['w']):
            m = 0
            for y, r in enumerate(g['rows']):
                if r[x] == '#': m |= 1 << (g['y0'] - top + y)
            cols.append(m)
        if c in over: cols = list(over[c])
        while cols and not cols[0]: cols.pop(0)
        while cols and not cols[-1]: cols.pop()
        assert cols, c
        data.append(A[len(cols)] + ''.join(''.join(A[m >> (6 * (n - 1 - k)) & 63] for k in range(n)) for m in cols))
    return dict(h=H, base=-top, space=space, data=''.join(data))


TEMPLATE = r'''/* Pixel fonts for the gadgets' little LCDs: one bit per pixel, so text stays crisp when the screen is scaled up.
   Generated from the X11 bitmap fonts koi6x10 (small) and Cronyx Helvetica Bold 11 (bold), letters cut to their ink
   and set one pixel apart. Each glyph: its width, then its columns, each in as many base-64 digits as the cell needs, the low bit at the top row. */
(function () {
'use strict';
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const CHARS = '%CHARS%';
const FONTS = { small: %SMALL%, bold: %BOLD% };
// what the fonts lack, spelled with what they have
const SUB = { '\u00ab': '"', '\u00bb': '"', '\u2014': '-', '\u2013': '-', '\u2026': '...', '\u2116': 'N', '\u2019': "'" };
for (const f of Object.values(FONTS)) {
  f.glyphs = {}; let i = 0;
  const n = Math.ceil(f.h / 6);
  for (const c of CHARS) {
    const w = A.indexOf(f.data[i++]), cols = [];
    for (let k = 0; k < w; k++) { let m = 0; for (let d = 0; d < n; d++) m = m * 64 + A.indexOf(f.data[i++]); cols.push(m); }
    f.glyphs[c] = cols;
  }
  f.tints = {};
}
const clean = s => [...String(s)].map(c => SUB[c] || c).join('');
// a strip of every glyph in one colour, drawn once per font and colour
function atlas(f, color) {
  if (f.tints[color]) return f.tints[color];
  const cv = document.createElement('canvas'), q = cv.getContext('2d');
  let x = 0; f.at = {};
  for (const c of CHARS) { f.at[c] = x; x += f.glyphs[c].length + 1; }
  cv.width = x; cv.height = f.h; q.fillStyle = color;
  for (const c of CHARS) f.glyphs[c].forEach((m, k) => { for (let y = 0; y < f.h; y++) if (m >> y & 1) q.fillRect(f.at[c] + k, y, 1, 1); });
  return (f.tints[color] = cv);
}
function width(font, s) {
  const f = FONTS[font] || FONTS.small; let w = 0;
  for (const c of clean(s)) w += (c === ' ' ? f.space : (f.glyphs[c] || f.glyphs['?']).length) + 1;
  return Math.max(0, w - 1);
}
// draws s with its cell's top at y; align: 'left' (x is the left edge), 'center' or 'right'
function text(q, s, x, y, color, font = 'small', align = 'left') {
  const f = FONTS[font] || FONTS.small, str = clean(s), img = atlas(f, color);
  let cx = Math.round(align === 'center' ? x - width(font, str) / 2 : align === 'right' ? x - width(font, str) : x);
  for (const c of str) {
    if (c === ' ') { cx += f.space + 1; continue; }
    const g = f.glyphs[c] ? c : '?', w = f.glyphs[g].length;
    q.drawImage(img, f.at[g], 0, w, f.h, cx, Math.round(y), w, f.h); cx += w + 1;
  }
  return cx - x;
}
// splits s into lines no wider than max, breaking words that are longer than a line
function wrap(font, s, max) {
  const out = []; let line = '';
  for (const word of clean(s).split(/\s+/).filter(Boolean)) {
    const t = line ? line + ' ' + word : word;
    if (width(font, t) <= max) { line = t; continue; }
    if (line) out.push(line);
    line = word;
    while (width(font, line) > max) { let k = line.length - 1; while (k > 1 && width(font, line.slice(0, k)) > max) k--; out.push(line.slice(0, k)); line = line.slice(k); }
  }
  if (line) out.push(line);
  return out;
}
window.PixFont = { text, width, wrap, height: font => (FONTS[font] || FONTS.small).h, base: font => (FONTS[font] || FONTS.small).base };
})();
'''

if __name__ == '__main__':
    # koi6x10 draws its dots as little crosses, which read as daggers on a phone screen: square ones instead
    small = build('koi6x10', 3, {'.': [192, 192], ':': [204, 204], ';': [460, 204]})
    bold = build('crox1hb', 4)
    js = TEMPLATE
    for k, v in (('SMALL', small), ('BOLD', bold)):
        js = js.replace('%' + k + '%', "{ h: %d, base: %d, space: %d, data: '%s' }" % (v['h'], v['base'], v['space'], v['data']))
    # the file stays plain ASCII, so it reads the same whatever charset the page is served with
    js = js.replace('%CHARS%', ''.join(c if ord(c) < 128 else '\\u%04x' % ord(c) for c in CHARS.replace('\\', '\\\\').replace("'", "\\'")))
    open(sys.argv[1], 'w').write(js)
