// helpers for playing the story through: talking, repairing with shortcuts, visits, the case file
module.exports = h => {
  const { p, W } = h;
  const R = (f, a) => p.evaluate(f, a);
  const S = () => R(() => window.__retro.case());
  const log = (...a) => console.log(...a);
  // click through whatever talk or card is open; picks options whose label contains the next wanted text
  async function talk(picks = [], quiet = false) {
    const q = [].concat(picks);
    let idle = 0;
    for (let g = 0; g < 400; g++) {
      if (await p.isVisible('#card')) {
        const t = (await p.textContent('#card')).replace(/\s+/g, ' ').trim();
        log('   [card] ' + t.slice(0, 220));
        await p.click('#card #next'); await W(700); idle = 0; continue;
      }
      const L = await R(() => window.__retro.line());
      if (!L) { if (++idle > 6) return; await W(350); continue; }
      idle = 0;
      if (L.typing) { await R(() => window.__retro.adv()); await W(40); continue; }
      if (L.choices) {
        let i = 0;
        if (q.length) { const k = L.choices.findIndex(c => c.includes(q[0])); if (k >= 0) { i = k; q.shift(); } else log('   !! no option «' + q[0] + '» in', L.choices); }
        log('   ? ' + L.text + '  [' + L.choices.join(' | ') + '] → ' + L.choices[i]);
        await R(i => window.__retro.pick(i), i); await W(250); continue;
      }
      if (!quiet) log('   ' + L.who + ': ' + L.text);
      await R(() => window.__retro.adv()); await W(40);
    }
  }
  async function mode(m) { await p.click(`#nav [data-go="${m}"]`); await W(700); }
  // somebody comes to the window and talks
  async function visit(picks, label) {
    log('== ' + (label || 'visit'));
    await mode('street');
    for (let i = 0; i < 6; i++) { await R(() => window.__retro.now()); await W(700); if (await R(() => window.__retro.visitor())) break; }
    const v = await R(() => window.__retro.visitor()); log('   visitor', JSON.stringify(v));
    for (let i = 0; i < 30 && !(await R(() => window.__retro.line())); i++) await W(300);
    await talk(picks);
    await W(500);
  }
  // mend the gadget on the bench: pull the parts named (finds show up), set the rest right, switch on, play a moment, done
  async function repair(pulls = [], play) {
    await mode('bench');
    for (const s of pulls) { await R(s => window.__retro.pull(s), s); await W(1600); await talk(); }
    await R(() => window.__retro.fix()); await W(900);
    const pw = await R(() => window.__retro.power()); await p.mouse.click(pw.x, pw.y);
    for (let i = 0; i < 50 && !(await R(() => window.__retro.using())); i++) await W(300);
    if (play) await play();
    await W(600);
    await p.click('#useDone'); await W(2500);
    await talk();
  }
  async function pickup(picks, label) { await W(5600); await visit(picks, label + ' (pickup)'); }
  async function skip(n) { await R(n => window.__retro.skip(n), n); }
  // the case file on the computer: answer a deduction by option index
  async function deduce(id, i) {
    await mode('pc');
    if (await p.isHidden('#caseScreen')) { await p.click('[data-app="case"]'); await W(800); }
    const b = await p.$(`[data-ded="${id}"][data-i="${i}"]`);
    if (!b) { log('   !! deduction', id, 'not available'); return; }
    await b.click(); await W(900);
    const no = await p.$('#caseBody .no'); if (no) log('   deduction', id, '→', await no.textContent());
    else log('   deduction', id, '✓');
    await p.click('#caseClose'); await W(300);
  }
  async function state(label) {
    const c = await S();
    log('   [' + label + '] done:', Object.keys(c.done).join(','), '| clues:', c.clues.join(','), '| flags:', Object.keys(c.flags).filter(k => c.flags[k]).join(','), '| trust:', JSON.stringify(c.trust), '| since', c.since, 'active', c.active);
  }
  return { talk, mode, visit, repair, pickup, skip, deduce, state, R };
};
