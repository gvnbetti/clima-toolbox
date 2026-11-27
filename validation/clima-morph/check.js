/* Clima Morph checks. Usage: node validation/clima-morph/check.js [out dir]
   1 identity: present climate, as recorded: the file is returned unchanged.
   2 round trip: morph, read the download back with Macro Clima's reader, and compare it hour by hour with the shared core's
     own morphed weather (what Macro, Micro and Room Clima compute internally). Pass: within the file's rounding.
   3 format: header lines, row count, 35 fields per row, dew point not above dry bulb, unchanged fields byte for byte.
   4 physics: future only holds relative humidity; heat island only holds dew point.
   5 monthly means: morphed minus source against the Atlas value of each month.
   Writes results.json and the morphed files used by the EnergyPlus and Ladybug checks. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const C = require(ROOT + "/macro/core.js");
global.window = global; // the data files assign window.CLIMA_*
require(ROOT + "/macro/future.js"); require(ROOT + "/macro/regions.js");
const Mods = require(ROOT + "/shared/climamods.js"), X = require(ROOT + "/morph/epwout.js");
const OUT = path.resolve(process.argv[2] || path.join(__dirname, "out")); fs.mkdirSync(OUT, { recursive: true });
const deps = { Clima: C, Mods, future: global.CLIMA_FUTURE, regions: global.CLIMA_REGIONS };
const FILES = ["DEU_BE_Berlin-Tegel.AP.103820_TMYx.epw", "EGY_QH_Cairo.Intl.AP.623660_TMYx.epw", "SGP_SG_Singapore-Changi.Intl.AP.486980_Custom.epw", "RUS_MOS_Moscow-Bibirevo.276120_TMYx.epw"];
const CASES = [{ id: "fut2", level: 2, uhi: null }, { id: "urban", level: 0, uhi: { svf: 0.6, fveg: 0.2, key: "urban" } }, { id: "fut3_dense", level: 3, uhi: { svf: 0.4, fveg: 0.1, key: "dense" } }];
const VER = fs.readFileSync(ROOT + "/VERSION", "utf8").trim() + " beta";
const res = { files: {}, pass: true };
const fail = (m) => { res.pass = false; console.log("FAIL", m); return m; };
const rows = (t) => t.replace(/\r/g, "").split("\n").filter((L) => /^\s*-?\d{4},/.test(L)).map((L) => L.split(","));
const headLines = (t) => t.replace(/\r/g, "").split("\n").filter((L) => L.trim() && !/^\s*-?\d{4},/.test(L));

for (const fn of FILES) {
  const text = fs.readFileSync(`${ROOT}/macro/data/epw/${fn}.txt`, "latin1");
  const r0 = X.morph(text, fn, { level: 0, uhi: null, version: VER }, deps);
  const F = (res.files[fn] = { identity: r0.text === text && !r0.changed, cases: {} });
  if (!F.identity) fail(`${fn}: identity`);
  const src = rows(text);
  for (const cs of CASES) {
    const r = X.morph(text, fn, { level: cs.level, uhi: cs.uhi, version: VER }, deps);
    fs.writeFileSync(path.join(OUT, r.fileName), Buffer.from(X.encode1252(r.text)));
    const out = rows(r.text), H = headLines(r.text), c = (F.cases[cs.id] = { file: r.fileName, errors: [] });
    // format
    if (H.length !== 8) c.errors.push(fail(`${fn} ${cs.id}: ${H.length} header lines`));
    const order = ["LOCATION", "DESIGN CONDITIONS", "TYPICAL/EXTREME PERIODS", "GROUND TEMPERATURES", "HOLIDAYS/DAYLIGHT SAVINGS", "COMMENTS 1", "COMMENTS 2", "DATA PERIODS"];
    H.forEach((L, i) => { if (L.split(",")[0].trim().toUpperCase() !== order[i]) c.errors.push(fail(`${fn} ${cs.id}: header line ${i + 1} is ${L.slice(0, 20)}`)); });
    if (H[1] !== "DESIGN CONDITIONS,0") c.errors.push(fail(`${fn}: design conditions`));
    if (H[0] !== headLines(text)[0]) c.errors.push(fail(`${fn}: LOCATION changed`));
    if (H[6].slice(11).includes(",") && !/Original comments 2/.test(H[6])) c.errors.push(fail(`${fn}: comma in provenance`));
    if (out.length !== src.length) c.errors.push(fail(`${fn}: rows ${out.length}`));
    const changedCols = new Set([6, 7, 8, 12, 33]); let other = 0, dewAbove = 0;
    out.forEach((f, i) => { if (f.length !== src[i].length) other++; f.forEach((v, j) => { if (!changedCols.has(j) && v !== src[i][j]) other++; }); if (+f[7] > +f[6] && +f[7] < 99) dewAbove++; });
    if (other) c.errors.push(fail(`${fn} ${cs.id}: ${other} unchanged fields differ`));
    if (dewAbove) c.errors.push(fail(`${fn} ${cs.id}: dew point above dry bulb in ${dewAbove} hours`));
    // round trip against the core
    const Wb = C.parseEPW(r.text, r.fileName), W = r.W, W0 = r.W0;
    const md = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
    c.maxDiff = { dbt: md(Wb.dbt, W.dbt), dpt: md(Wb.dpt, W.dpt), rh: md(Wb.rh, W.rh), hir: md(Wb.hir, W.hir) };
    const tol = { dbt: 0.0501, dpt: 0.1001, rh: 0.5001, hir: 0.5001 }; // dpt: rounding, plus the dew point clamp after rounding
    for (const k in tol) if (c.maxDiff[k] > tol[k]) c.errors.push(fail(`${fn} ${cs.id}: round trip ${k} ${c.maxDiff[k].toFixed(3)}`));
    // physics
    if (cs.level && !cs.uhi) { const d = md(Wb.rh, W0.rh); c.rhHeldMax = d; if (d > 0) c.errors.push(fail(`${fn}: RH not held (${d})`)); }
    if (!cs.level && cs.uhi) { const d = md(Wb.dpt, W0.dpt); c.dptHeldMax = d; if (d > 0) c.errors.push(fail(`${fn}: dew point not held (${d})`)); }
    // monthly means against the Atlas value
    if (r.fut) {
      const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; let i = 0; c.monthly = [];
      for (let m = 0; m < 12; m++) { let s = 0; const n = MD[m] * 24; for (let k = 0; k < n; k++, i++) s += r.fut.dh[i]; c.monthly.push({ month: m + 1, applied: +(s / n).toFixed(3), atlas: +r.fut.dT[m].toFixed(3), diff: +(s / n - r.fut.dT[m]).toFixed(3) }); }
      c.monthlyMaxDiff = Math.max(...c.monthly.map((x) => Math.abs(x.diff)));
      c.annualChange = +r.dAnn.toFixed(3);
    }
    if (r.uhi) c.uhi = { mean: +r.uhi.mean.toFixed(3), nightMean: +r.uhi.nightMean.toFixed(3), max: +r.uhi.max.toFixed(3) };
    console.log(fn, cs.id, c.errors.length ? "errors " + c.errors.length : "ok", JSON.stringify(c.maxDiff), c.monthlyMaxDiff != null ? "monthly max diff " + c.monthlyMaxDiff : "");
  }
}
fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify(res, null, 1));
console.log(res.pass ? "ALL PASS" : "SOME CHECKS FAILED");
process.exit(res.pass ? 0 : 1);
