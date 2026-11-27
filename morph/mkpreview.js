/* Writes morph/preview.json for the landing page preview: Berlin-Tegel, monthly mean air temperature as recorded and
   at +2 °C in an urban neighbourhood, computed by Clima Morph itself. Usage: node morph/mkpreview.js */
"use strict";
const fs = require("fs"), path = require("path"), ROOT = path.resolve(__dirname, "..");
const C = require(ROOT + "/macro/core.js"); global.window = global;
require(ROOT + "/macro/future.js"); require(ROOT + "/macro/regions.js");
const Mods = require(ROOT + "/shared/climamods.js"), X = require(ROOT + "/morph/epwout.js");
const fn = "DEU_BE_Berlin-Tegel.AP.103820_TMYx.epw", text = fs.readFileSync(`${ROOT}/macro/data/epw/${fn}.txt`, "latin1");
const r = X.morph(text, fn, { level: 2, uhi: { svf: 0.6, fveg: 0.2, key: "urban" }, version: "" }, { Clima: C, Mods, future: global.CLIMA_FUTURE, regions: global.CLIMA_REGIONS });
const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const mon = (a) => { let i = 0; return MD.map((d) => { let s = 0; for (let k = 0; k < d * 24; k++) s += a[i++]; return +(s / (d * 24)).toFixed(2); }); };
// mean daily profile of the added warmth, by hour: future and heat island
const prof = (a) => Array.from({ length: 24 }, (_, h) => { let s = 0; for (let d = 0; d < 365; d++) s += a[d * 24 + h]; return +(s / 365).toFixed(3); });
const out = { file: fn, setting: "+2 °C, urban", src: mon(r.W0.dbt), morphed: mon(r.W.dbt), fut: prof(r.fut.dh), uhi: prof(r.uhi.uhi) };
fs.writeFileSync(path.join(__dirname, "preview.json"), JSON.stringify(out));
console.log("preview.json", out.src.length, out.morphed.length);
