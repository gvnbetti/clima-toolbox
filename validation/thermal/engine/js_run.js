// The app's thermal engine (EN ISO 52016-1 hourly method, from the Room Clima build) on the Standard 140 cases, in Denver
// and in the 14 validation climates, with the same control logic as the EnergyPlus models (ideal loads to the set points).
// Variants: the standard as written; each of Room Clima's four changes alone; and all four together, as Room Clima runs
// the engine. The four changes: (1) wind-driven exterior convection at station wind speed (DOE-2), (2) angle-dependent
// glazing transmission, (3) transmitted sun absorbed by the opaque surfaces only, (4) long-wave exchange with the sky
// over the square root of the sky view factor (Walton, as EnergyPlus). Output: WORK/thermal_engine/js/<variant>/<climate>/<case>.json
const fs = require('fs'), path = require('path'), { WORK, WX } = require('../../lib/paths.js'), H = require('../../lib/app.js'), G = H.G;
const D = path.join(WORK, 'thermal_engine'), SPEC = JSON.parse(fs.readFileSync(path.join(D, 'cases.json'))), CASES = SPEC.cases;
const CLIMATES = JSON.parse(require('child_process').execSync(`python3 -c "import json,climates;print(json.dumps(climates.CLIMATES))"`, { cwd: __dirname }));
const WRITTEN = { skySplit: false, fw: 0.9 };                     // EN ISO 52016-1 as written: fixed 20 W/m2K exterior convection, constant 0.9 on g, sun on all inner surfaces, full sky view
const VARIANTS = {
  written: WRITTEN,
  wind: Object.assign({}, WRITTEN, { wind: { terrain: 'station' } }),
  angle: Object.assign({}, WRITTEN, { fw: 'angle' }),
  opaque: Object.assign({}, WRITTEN, { solOnWindows: false }),
  sky: Object.assign({}, WRITTEN, { skySplit: true }),
  room: { wind: { terrain: 'station' }, fw: 'angle', solOnWindows: false, skySplit: true },   // as Sweep.simulate in room/src/core.js
};
// Window of the standard (two panes of 3 mm clear glass, 12 mm air): U and SHGC from EnergyPlus's own window calculation
const WIN = { U: 2.74, g: 0.760 };
function readWx(f) {
  const lines = fs.readFileSync(path.join(WX, f), 'latin1').split('\n'), loc = lines[0].split(',');
  const rows = lines.slice(8).filter((l) => l.trim()).map((l) => l.split(','));
  const col = (j) => Float64Array.from(rows.map((r) => +r[j]));
  const wx = { t: col(6), p: col(9), ir: col(12), dni: col(14), dhi: col(15), ws: col(21), albedo: 0.2, lat: +loc[6], lon: +loc[7], tz: +loc[8] };
  return Object.assign(wx, G.solarPosition(wx.lat, wx.lon, wx.tz));
}
function prep(z) {
  const zz = JSON.parse(JSON.stringify(z));
  zz.elements.forEach((e) => {
    if (e.kind !== 'window') return;
    e.U = WIN.U; e.g = WIN.g; e.height = e.geom.h; if (e.geom.overhang) e.overhang = { dep: e.geom.overhang.dep, gap: e.geom.overhang.gap };
    // window diagnostic only: opaque frame share of the opening, and glass recessed behind an outer reveal (shade.js)
    if (e.geom.frame) e.frame = e.geom.frame;
    if (e.geom.reveal) e.geo = { w: e.geom.w, h: e.geom.h * (1 - (e.geom.frame || 0)), t: e.geom.reveal, glass: e.geom.reveal };
  });
  return zz;
}
function run(z, wx, opt) {
  const eng = G.Iso52016(z, wx, opt), qh = new Float64Array(8760), qc = new Float64Array(8760), tair = new Float64Array(8760);
  const step = (i, rec) => {
    const k = i % 24, te = wx.t[i], rho = wx.p[i] / (287.05 * (te + 273.15)), hVe = rho * 1006 * (z.volume * z.ach_inf + z.ventM3h[k]) / 3600;
    const p = { hVe, thSup: te, qInt: z.gains.total, fShade: 1, phiHC: 0 };
    let r = eng.trial(i, p);
    if (z.ideal) {
      const hs = z.heatSP[k], cs = z.coolSP[k], tg = r.thAir < hs ? hs : r.thAir > cs ? cs : null;
      if (tg !== null) { const r1 = eng.trial(i, Object.assign({}, p, { phiHC: 1000 })), phi = 1000 * (tg - r.thAir) / (r1.thAir - r.thAir);
        r = eng.trial(i, Object.assign({}, p, { phiHC: phi })); if (rec) { if (phi > 0) qh[i] = phi; else qc[i] = -phi; } }
    }
    eng.commit(r); if (rec) tair[i] = r.thAir;
  };
  for (let i = 8760 - 720; i < 8760; i++) step(i, false);   // 30 days of warm-up from the end of the year
  for (let i = 0; i < 8760; i++) step(i, true);
  const r1 = (a) => Array.from(a, (x) => Math.round(x * 10) / 10);
  return z.ideal ? { tair: Array.from(tair, (x) => Math.round(x * 100) / 100), qh: r1(qh), qc: r1(qc) } : { tair: Array.from(tair, (x) => Math.round(x * 100) / 100) };
}
module.exports = { prep, run, readWx, VARIANTS, CLIMATES, G };
if (require.main === module) {
for (const [clim, f] of Object.entries(CLIMATES)) {
  const wx = readWx(f), list = clim === 'denver' ? Object.keys(CASES) : SPEC.climate_cases;
  for (const [v, opt] of Object.entries(VARIANTS)) {
    const dir = path.join(D, 'js', v, clim); fs.mkdirSync(dir, { recursive: true });
    for (const c of list) fs.writeFileSync(path.join(dir, c + '.json'), JSON.stringify(run(prep(CASES[c]), wx, opt)));
  }
  console.log(clim);
}
}
