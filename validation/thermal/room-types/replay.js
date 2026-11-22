// Room types, step 1b: each variant of the engine on the same rooms, driven by the same hourly operation that EnergyPlus
// receives (air change, internal gains, blind state per window, all from the app's own run in dump.js). This isolates
// the effect of each of Room Clima's four changes to EN ISO 52016-1 on the rooms the app models, in the calibration and
// the held-out climates. Variants as in ../engine/js_run.js. Output: WORK/<set>/replay/<variant>/<case>.json
const fs = require('fs'), path = require('path'), H = require('../../lib/app.js'), { S, G, wx } = H, P = require('../../lib/paths.js'), { readEpw } = require('../../lib/epw.js');
const SET = process.env.SET || 'calibration', R = path.join(P.WORK, SET === 'holdout' ? 'room_types_holdout' : 'room_types');
const FILES = JSON.parse(require('child_process').execSync(`python3 -c "import json,climates;print(json.dumps(climates.CLIMATES))"`, { cwd: path.join(__dirname, '../engine') }));
const NAMES = { mannheim: 'Mannheim', bologna: 'Bologna', san_francisco: 'San Francisco', phoenix: 'Phoenix', dubai: 'Dubai', ho_chi_minh_city: 'Ho Chi Minh City',
  miami: 'Miami', tampa: 'Tampa', new_delhi: 'New Delhi', denver: 'Denver', chicago: 'Chicago', montreal: 'Montreal', vancouver: 'Vancouver', yellowknife: 'Yellowknife' };
const WRITTEN = { wind: null, fw: 0.9, solOnWindows: true, skySplit: false };
const VARIANTS = { written: WRITTEN, wind: Object.assign({}, WRITTEN, { wind: { terrain: 'station' } }), angle: Object.assign({}, WRITTEN, { fw: 'angle' }),
  opaque: Object.assign({}, WRITTEN, { solOnWindows: false }), sky: Object.assign({}, WRITTEN, { skySplit: true }),
  room: { wind: { terrain: 'station' }, fw: 'angle', solOnWindows: false, skySplit: true } };
const CASES = JSON.parse(fs.readFileSync(path.join(R, 'cases.json')));
const wxCache = {}, ctxCache = {};
function run(eng, ctx, zone, hr, heat) {
  const Af = zone.floorArea, V = zone.volume, top = new Float64Array(8760); let qh = 0;
  const step = (i, rec) => {
    const p = { hVe: ctx.rho[i] * 1006 / 3600 * V * hr.ach[i], thSup: ctx.wx.t[i], qInt: hr.q[i] * Af, phiHC: 0, shadeMask: hr.mask[i] };
    let r = eng.trial(i, p);
    if (heat && r.thOp < ctx.use.tHeat) { p.phiHC = 1000; const r1 = eng.trial(i, p), q = 1000 * (ctx.use.tHeat - r.thOp) / (r1.thOp - r.thOp); p.phiHC = q; r = eng.trial(i, p); if (rec) qh += q; }
    eng.commit(r); if (rec) top[i] = r.thOp;
  };
  for (let i = 8760 - 672; i < 8760; i++) step(i, false);
  for (let i = 0; i < 8760; i++) step(i, true);
  return { top: Array.from(top, (x) => Math.round(x * 1000) / 1000), qh: qh / 1000 / Af };
}
let n = 0;
for (const c of CASES.slice(0, +process.env.N || CASES.length)) {
  if (!wxCache[c.wx]) wxCache[c.wx] = SET === 'holdout' ? readEpw(path.join(P.WX, FILES[c.wx]), NAMES[c.wx], G) : wx(NAMES[c.wx]);
  const key = c.wx + '|' + c.use; if (!ctxCache[key]) ctxCache[key] = S.context(wxCache[c.wx], c.use, {});
  const ctx = ctxCache[key], d = Object.assign({ scenario: c.scenario, azimuth: c.az }, c.design), zone = H.sb.SweepZone.buildZone(S.zoneParams(ctx, d)), shd = S.shadeOf(ctx, d);
  const hr = JSON.parse(fs.readFileSync(path.join(R, 'js', c.id + '.json')));
  for (const [v, opt] of Object.entries(VARIANTS)) {
    const o = Object.assign({ shade: shd.fc < 1 ? { tau: 0, rho: 0, ratio: shd.fc, dR: shd.dR } : null }, opt);
    const fr = run(G.Iso52016(zone, ctx.wx, o), ctx, zone, hr.free, false), he = run(G.Iso52016(H.sb.SweepZone.buildZone(S.zoneParams(ctx, d)), ctx.wx, o), ctx, zone, hr.heat, true);
    const dir = path.join(R, 'replay', v); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, c.id + '.json'), JSON.stringify({ top: fr.top, qh: he.qh }));
  }
  if (++n % 72 === 0) console.error(n, '/', CASES.length);
}
console.log('done', n);
