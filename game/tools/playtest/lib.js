// shared helpers for the playtests
const { chromium } = require('playwright');
const fs = require('fs');
exports.open = async (state, vp = { width: 390, height: 844 }) => {
  const b = await chromium.launch({ ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost' } } : {}), args: ['--use-gl=swiftshader'] });
  const p = await b.newPage({ viewport: vp });
  p.on('pageerror', e => console.log('pageerror', e.message, e.stack.split('\n').slice(0, 3).join(' | ')));
  await p.goto('http://localhost:8765/index.html#test', { timeout: 120000, waitUntil: 'domcontentloaded' });
  await p.evaluate(s => localStorage.setItem('retro-repair-v2', JSON.stringify(s)), state);
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(4000);
  const W = ms => p.waitForTimeout(ms);
  const h = {
    b, p, W,
    st: () => p.evaluate(() => window.__retro.state()),
    sub: () => p.textContent('#taskSub'),
    key: id => p.evaluate(id => window.__retro.key(id), id),
    tap: async (id, hold = 90) => { const k = await h.key(id); await p.mouse.move(k.x, k.y); await p.mouse.down(); await W(hold); await p.mouse.up(); },
    lcd: async file => { const u = await p.evaluate(() => window.__retro.screen()); fs.writeFileSync(file, Buffer.from(u.split(',')[1], 'base64')); },
  };
  return h;
};
// a job on the bench, every part in place and working
exports.benchJob = (dev, parts, screws, extra = {}) => {
  let id = 500; const slots = {}, tight = {};
  parts.forEach(t => { slots[t] = { id: id++, type: t, cond: 'ok', fresh: false, variant: 0 }; });
  screws.forEach(s => { slots[s] = { type: s.replace(/_\d+$/, '') }; tight[s] = true; });
  return Object.assign({ id: 900, dev, kind: 'order', order: { id: 901, dev, nick: 'Kolya_95', note: 'Хочу снова поиграть.', faults: [], pay: 50, variant: 0, mins: 9, deadline: Date.now() + 9e5 },
    slots, tight, side: 'front', started: Date.now(), variant: 0 }, extra);
};
exports.base = job => ({ money: 600, uid: 950, box: [], tray: [], cup: { screw: 0, bscrew: 0 }, offers: [], ordersDone: 5, deliveries: [], mode: 'bench', ready: [], visitor: null,
  nextVisit: Date.now() + 9e6, seen: true, shelf: [], job, web: [], upg: {}, rep: 14, lic: { pet: true, phone: true }, petSeen: true, story: { step: 2, since: 0, active: null } });
