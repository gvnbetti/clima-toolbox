// Room types, step 1: the cases, run in the app engine (Room Clima build), with the hourly air change, blind state per
// window and internal gains of each run, so that EnergyPlus runs the same operation and only the physics differ.
// Output: WORK/room_types/cases.json and one file of hourly results per case in WORK/room_types/js/.
// SET=calibration (default): the six weather files bundled in the app, the climates in which Room Clima's engine settings
// were chosen. SET=holdout: the eight climates of the engine study not used for that choice, read from the reference
// weather files; each is also written back to EPW (weather/files/app_<key>.epw) so that EnergyPlus reads the same values.
const fs = require('fs'), path = require('path'), H = require('../../lib/app.js'), { S, wx } = H, P = require('../../lib/paths.js'), { readEpw, writeEpw } = require('../../lib/epw.js');
const SET = process.env.SET || 'calibration', OUT = path.join(P.WORK, SET === 'holdout' ? 'room_types_holdout' : 'room_types');
fs.mkdirSync(OUT + '/js', { recursive: true });
const CAL = { mannheim: 'Mannheim', bologna: 'Bologna', san_francisco: 'San Francisco', phoenix: 'Phoenix', dubai: 'Dubai', ho_chi_minh_city: 'Ho Chi Minh City' };
const HOLD = { miami: 'Miami', tampa: 'Tampa', new_delhi: 'New Delhi', denver: 'Denver', chicago: 'Chicago', montreal: 'Montreal', vancouver: 'Vancouver', yellowknife: 'Yellowknife' };
const FILES = JSON.parse(require('child_process').execSync(`python3 -c "import json,climates;print(json.dumps(climates.CLIMATES))"`, { cwd: path.join(__dirname, '../engine') }));
function weather(key, city) {
  if (SET !== 'holdout') return wx(city);
  const w = readEpw(path.join(P.WX, FILES[key]), city, H.G);
  writeEpw(w, { name: city, file: FILES[key], comment: `written from ${FILES[key]} as Room Clima reads it` }, path.join(P.WX, `app_${key}.epw`));
  return w;
}
const CITIES = SET === 'holdout' ? HOLD : CAL;
const D = S.designs(6, 16).map((d) => Object.assign(d, { fans: 0, supply: 'outdoor' }));
const out = [];
for (const [wn, city] of Object.entries(CITIES)) { const w = weather(wn, city);
  for (const use of ['office', 'dwelling']) { const ctx = S.context(w, use, {}); const u = ctx.use;
    for (const sc of S.SCENARIOS) for (const az of [180, 270]) D.forEach((d, k) => {
      const c = Object.assign({ scenario: sc, azimuth: az }, d), zp = S.zoneParams(ctx, c), zone = H.sb.SweepZone.buildZone(zp), shd = S.shadeOf(ctx, c);
      const fr = S.simulate(ctx, c, 'free', true), he = S.simulate(ctx, c, 'heat', true), id = `${wn}_${use}_${sc}_${az}_${k}`;
      const wins = zone.elements.filter((e) => e.kind === 'window').map((e) => ({ wall: e.id.slice(4), area: e.area, U: e.U, g: e.g, frame: e.frame, rect: H.sb.SweepZone.windowRect(e.id.endsWith('A') ? zp.width : zp.depth, zp.height, zp.wwr, e.frame) }));
      out.push({ id, wx: wn, use, scenario: sc, az, design: d, dims: [zp.width, zp.depth, zp.height], wall: ctx.wall, fixed: S.FIXED[d.fixed], tHeat: u.tHeat, shade: { key: shd.key, fc: shd.fc, dR: shd.dR },
        elements: zone.elements.filter((e) => e.kind === 'opaque').map((e) => ({ id: e.id, area: e.area, layers: e.layers, aSol: e.aSol, bc: e.bc, tilt: e.tilt })), windows: wins, winBits: fr.winBits });
      const r2 = (a) => Array.from(a, (x) => +x.toFixed(3));
      fs.writeFileSync(`${OUT}/js/${id}.json`, JSON.stringify({ free: { ach: r2(fr.achH), mask: Array.from(fr.bmask), q: r2(fr.qIntH), top: r2(fr.top) }, heat: { ach: r2(he.achH), mask: Array.from(he.bmask), q: r2(he.qIntH), top: r2(he.top), qh: he.heat } }));
    });
  } console.error(wn);
}
fs.writeFileSync(`${OUT}/cases.json`, JSON.stringify(out)); console.log(out.length, 'cases'); console.log(JSON.stringify(D));
