// Window diagnostic, step 3: the app engine on the cases of diag_cases.py, in the six variants of ../engine/js_run.js:
// the standard as written, each of the four changes alone, and all four as Room Clima runs it.
// Output: WORK/window_diag/js/<variant>/<climate>/<case>.json
const fs = require('fs'), path = require('path'), { WORK } = require('../../lib/paths.js');
const E = require('../engine/js_run.js'), D = path.join(WORK, 'window_diag'), C = JSON.parse(fs.readFileSync(path.join(D, 'cases.json')));
const VARS = E.VARIANTS;
const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], MONTH = []; MD.forEach((d, m) => { for (let k = 0; k < d * 24; k++) MONTH.push(m); });   // all six: as written, each change alone, all four
for (const [clim, f] of Object.entries(E.CLIMATES)) {
  const wx = E.readWx(f);
  for (const [v, opt] of Object.entries(VARS)) {
    const dir = path.join(D, 'js', v, clim); fs.mkdirSync(dir, { recursive: true });
    for (const [c, z] of Object.entries(C)) fs.writeFileSync(path.join(dir, c + '.json'), JSON.stringify(E.run(E.prep(z), wx, opt)));
  }
  // monthly sun through the glass (kWh, g-based, angle-dependent), to compare the shading of each geometry with EnergyPlus
  const dir = path.join(D, 'js', 'sun', clim); fs.mkdirSync(dir, { recursive: true });
  for (const [c, z] of Object.entries(C)) {
    const m = new Array(12).fill(0), zz = E.prep(z);
    for (const e of zz.elements) if (e.kind === 'window') { const r = E.G.windowTransmitted(wx, e, { fw: 'angle' }); for (let i = 0; i < 8760; i++) m[MONTH[i]] += r.tr[i] / 1000; }
    fs.writeFileSync(path.join(dir, c + '.json'), JSON.stringify({ monthly: m.map((x) => Math.round(x * 100) / 100) }));
  }
  console.log(clim);
}
