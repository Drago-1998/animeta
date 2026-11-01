// screenshots of the window at several hours, open and closed: node hours.js  (serve.py must be running)
const L = require('./lib');
(async () => {
  const shots = [[2.5, true], [2.5, false], [6, false], [7, false], [13, false], [18, false], [19.2, false], [20.5, false], [22, false], [23.2, true]];
  const st = L.base(null); st.mode = 'street'; st.clock = 13 * 60; st.closed = false;
  const h = await L.open(st), { p, W } = h;
  for (const [hr, cl] of shots) {
    await p.evaluate(([hr, cl]) => { const s = window.__retro.state(); s.clock = hr * 60 + 24 * 60 * 3; s.closed = cl; }, [hr, cl]);
    await W(2600); const f = `hour_${hr}_${cl ? 'closed' : 'open'}.png`; await p.screenshot({ path: f }); console.log(f);
  }
  await h.b.close();
})();
