"""Writes climamods.js, the calculation core shared by Macro, Micro and Room Clima: sun position, sun on surfaces
(Perez), psychrometrics, SolarCal, sky longwave, UTCI, and the future climate and urban heat island modifiers. The code
is copied verbatim from Macro Clima's core.js and app.js (blocks below), so the apps compute these the same way (Macro, Micro and Room Clima, and Clima Morph).
Usage: python3 shared/mkmods.py macro shared/climamods.js"""
import sys, re, hashlib, pathlib
M = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2])
core = (M / 'core.js').read_text().split('\n'); app = (M / 'app.js').read_text().split('\n')

def block(lines, start_pat, end_pat, inclusive_end=True):
    a = next(i for i, l in enumerate(lines) if re.search(start_pat, l))
    b = next(i for i in range(a + 1, len(lines)) if re.search(end_pat, lines[i]))
    return lines[a:b + (1 if inclusive_end else 0)]

parts = []
parts += block(core, r'^  const N = 8760, D2R', r'^  const MSTART =')                       # constants
parts += block(core, r'^  function timeArrays\(\)', r'^  const T = timeArrays\(\);')         # month of each hour
parts += block(core, r'^  function julianDay', r'^  function solarArrays', False)            # NOAA sun position
parts += block(core, r'^  function solarArrays', r'^  }')
parts += block(core, r'^  function pws\(t\)', r'^  function psychroArrays', False)              # psychrometrics (Hyland-Wexler)
parts += block(core, r'^  /\* -+ irradiation on surfaces', r'^  const ORIENT', False)            # Perez 1990
parts += block(core, r'^  /\* -+ SolarCal', r'^  // the original pythermalcomfort form', False)  # SolarCal
parts += block(core, r'^  /\* -+ longwave exchange', r'^  /\* -+ UTCI', False)                   # sky longwave
parts += block(core, r'^  /\* -+ UTCI', r'^  const UTCI_CLASSES', False)                          # UTCI
parts += block(core, r'^  const UTCI_CLASSES', r'\]\];')
parts += block(core, r'^  /\* ---------- future climate', r'^  const isNWEurope')             # morph and heat island
appParts = []
appParts += block(app, r'^  const FUT_LEVELS =', r'^  const regName =')
appParts += block(app, r'^  const UHI_PRESETS =', r'^  const uhiLabel =', False)
src_core = '\n'.join(parts); src_app = '\n'.join(appParts)
# app helpers that read Macro Clima's page state are rewritten as pure functions of their inputs
src_app = src_app.replace('const futRegion = (W) => (window.CLIMA_REGIONS ? C.regionOf(W.meta.lat, W.meta.lon, window.CLIMA_REGIONS) : null);',
                          'const futRegion = (W, regions) => (regions ? regionOf(W.meta.lat, W.meta.lon, regions) : null);')
assert 'regionOf(W.meta.lat, W.meta.lon, regions)' in src_app
h = hashlib.sha256((src_core + src_app).encode()).hexdigest()[:12]
js = f'''/* Clima Toolbox calculation core, shared by Macro Clima, Micro Clima and Room Clima.
   Sun position (NOAA), sun on surfaces (Perez 1990), psychrometrics (Hyland-Wexler, as psychrolib), SolarCal (ASHRAE 55),
   sky longwave, UTCI (Broede et al. 2012), urban heat island (Theeuwes et al. 2017) and future climate (IPCC AR6 Atlas).
   The code below is copied verbatim from Macro Clima (core.js and app.js) by shared/mkmods.py;
   do not edit it here: change Macro Clima and regenerate. Source fingerprint {h}.
   Data: window.CLIMA_FUTURE (future.js) and window.CLIMA_REGIONS (regions.js), as in Macro Clima. */
(function (root) {{
  "use strict";
{src_core}
  /* ---------- from Macro Clima app.js ---------- */
{src_app}
  // the file's years, from its name and comment lines (as futMid in Macro Clima, which reads the same two sources)
  function fileYears(name, comments) {{
    const t = (name || "") + " " + (comments || []).join(" ");
    const per = (t.match(/Period of Record\\s*=?\\s*(\\d{{4}})\\s*-\\s*(\\d{{4}})/i) || t.match(/TMYx\\.?(\\d{{4}})-(\\d{{4}})/i));
    if (per) return {{ year: (+per[1] + +per[2]) / 2, from: +per[1], to: +per[2], known: true }};
    return {{ year: 2010, known: false }};
  }}
  const AIRPORT = /(\\bAP\\b|\\.AP\\.|Intl|Airport|Airfield|AFB|Aero|Flughafen|Aeroporto|Aeropuerto|Aéroport|RAF)/i;
  /* prepWeather as in Macro Clima: morph to the warming level first, then the heat island on top.
     W0 in Macro Clima's fields: dbt, dpt, rh, hir, prec, dni, dhi, ws, meta {{ lat, lon, tz }}.
     opt: {{ level: 0 | 1.5 | 2 | 3, uhi: null | {{ svf, fveg }}, year: mid-year of the file, future, regions }} */
  function prepWeather(W0, opt) {{
    let W = W0, fut = null;
    if (opt.level) {{ const reg = futRegion(W0, opt.regions), d = reg ? futureDelta(opt.future, reg.id, opt.level, opt.year) : null; if (d) {{ const m = morphWeather(W0, d); W = Object.assign({{}}, W0, {{ dbt: m.dbt, dpt: m.dpt, hir: m.hir, prec: m.prec }}); fut = Object.assign(d, {{ region: reg, dh: m.dh }}); }} }}
    if (!opt.uhi) return {{ W, uhi: null, fut }};
    const S0 = solarArrays(W.meta.lat, W.meta.lon, W.meta.tz), u = urbanHeatIsland(W, S0, opt.uhi.svf, opt.uhi.fveg);
    return {{ W: Object.assign({{}}, W, {{ dbt: u.dbt, rh: u.rh }}), uhi: u, fut }};
  }}
  const api = {{ FINGERPRINT: "{h}", prepWeather, futureDelta, morphWeather, urbanHeatIsland, regionOf, futRegion, regName, fileYears, isNWEurope, AIRPORT, FUT_LEVELS, futLab, UHI_PRESETS, REG_NAMES, pws, dewFromPw, humRatio, pwFromW, enthalpy, wetBulb, solarArrays, sunPosition, T, poa, dniExtra, airmassKY, perezSkyClearness, fpStanding, solarCalDeltaMrt, FP_STANDING, ALT_RANGE, AZ_RANGE, SIGMA, skyTemperature, longwaveDeltaMrt, utci, utciLimited, utciPoly, utciPvap, UTCI_CLASSES }};
  root.ClimaMods = api; // also global in Node, so code that embeds this core (Micro Clima's engine) finds it there too
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}})(typeof window !== "undefined" ? window : globalThis);
'''
out.write_text(js); print('wrote', out, len(js), 'bytes, fingerprint', h)
