// the second half of the story on the «heir» path, from a saved state after Аркадий: node story_heir_end.js
const L = require('./lib');
(async () => {
  const st = L.base(null); st.mode = 'bench'; st.rep = 60; st.money = 600; st.cup = { screw: 8, bscrew: 4 };
  const done = {}; 'note,timur,vanya,marina,kravets1,timur2,leva,petr2,vanya2,arkady'.split(',').forEach(id => { done[id] = true; });
  st.case = { done, clues: 'note1,record,coat,note2,card,flea,morse,radioclub,opened,proto,scared'.split(','), seen: [],
    flags: Object.fromEntries('petr_told,case_open,timur_scout,vanya_benched,marina_check,refused,timur_kept,leva_ally,recorder,petr_goes,vanya_master'.split(',').map(k => [k, true])),
    trust: { petr: 3, timur: 2, vanya: 1, marina: 1, leva: 1 }, met: { petr: true, timur: true, vanya: true, marina: true, kravets: true, leva: true, arkady: true }, posted: { father: true, letter: true }, since: 0, active: null, endings: [] };
  const h = await L.open(st), { p, W } = h;
  const T = require('./storylib')(h), { talk, visit, repair, pickup, skip, deduce, state, R, mode } = T;
  const keys = async (...k) => { for (const x of k) { await p.keyboard.press(x); await W(400); } };

  console.log('== phone (event)');
  for (let i = 0; i < 20 && !(await R(() => window.__retro.line())); i++) await W(500);
  await talk();
  console.log('   job:', await R(() => window.__retro.state().job && window.__retro.state().job.title));
  await repair([], async () => {
    await W(800); await p.click('#useDone'); await W(800); console.log('   before reading:', await p.textContent('#taskSub'));
    await R(() => window.__retro.ff(26)); await W(600); await h.lcd('sa_missed.png');   // let the stranger's call ring out
    await keys('Enter', 'Enter', 'Enter'); await W(800); await keys('Escape', 'ArrowDown', 'Enter'); await W(1200);
    await h.lcd('sa_phone.png');
  });
  await state('after phone');

  console.log('== somov (web)'); console.log('   web:', JSON.stringify(await R(() => window.__retro.state().web.filter(o => o.beat).map(o => o.nick + ': ' + o.note))));
  await R(() => window.__retro.webBench('somov')); await W(1500); await talk();
  await repair(['speaker']);
  await state('after somov');

  await skip(1); await visit(['Снять копию'], 'marina2');
  await deduce('who', 0); await deduce('who', 1); await deduce('where', 1);
  await state('after deductions');
  console.log('== cellar (event)'); await mode('bench'); for (let i = 0; i < 20 && !(await R(() => window.__retro.line())); i++) await W(500);
  await talk(['Позвать Петра']);
  await state('after cellar');

  await skip(1); await visit(['Рассказать всё'], 'sokolova');
  await skip(1); await visit(['диктофон'], 'kravets2');
  await skip(1); await visit(['Беру'], 'arkady2');
  await repair(['shell']);
  await pickup(['Сказать правду'], 'arkady2');
  await state('before finale');
  console.log('== finale (event)'); await mode('bench'); for (let i = 0; i < 20 && !(await R(() => window.__retro.line())); i++) await W(500);
  await talk(['лейтенанту']);
  await W(1500); await talk();
  await state('end');
  await mode('pc'); await p.click('[data-app="case"]'); await W(1000);
  await p.screenshot({ path: 'sa_case.png' });
  const body = await p.textContent('#caseBody'); console.log('CASE FILE:', body.replace(/\s+/g, ' ').slice(0, 1800));
  await h.b.close();
})();
