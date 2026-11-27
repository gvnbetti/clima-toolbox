/* Sections of the reading: variables, written readings (rule-based, every number tied to a chart), and chart cards. */
(function (root) {
  "use strict";
  const C = root.Clima, K = root.K, fmt = K.fmt, esc = K.esc, N = C.N;
  const S = {};

  /* ---------------- variables ---------------- */
  const V = {
    dbt: { label: "Dry bulb temperature", unit: "°C", get: (W) => W.dbt, sc: { ramp: "temp", lo: -40, hi: 50 }, dec: 1 },
    dpt: { label: "Dew point temperature", unit: "°C", get: (W) => W.dpt, sc: { ramp: "temp", lo: -50, hi: 35 }, dec: 1 },
    twb: { label: "Wet bulb temperature", unit: "°C", get: (W, X) => X.twb, sc: { ramp: "temp", lo: -40, hi: 35 }, dec: 1 },
    rh: { label: "Relative humidity", unit: "%", get: (W) => W.rh, sc: { ramp: "humid", lo: 0, hi: 100 }, dec: 0 },
    w: { label: "Humidity ratio", unit: "g/kg", get: (W, X) => X.wg || (X.wg = X.w.map((v) => v * 1000)), sc: { ramp: "humid", lo: 0, hi: 30 }, dec: 1 },
    p: { label: "Atmospheric pressure", unit: "hPa", get: (W, X) => X.ph || (X.ph = W.p.map((v) => v / 100)), sc: { ramp: "press", lo: 950, hi: 1050 }, dec: 0 },
    ghi: { label: "Global horizontal radiation", unit: "W/m²", get: (W) => W.ghi, sc: { ramp: "sun", lo: 0, hi: 1200 }, dec: 0 },
    dni: { label: "Direct normal radiation", unit: "W/m²", get: (W) => W.dni, sc: { ramp: "sun", lo: 0, hi: 1200 }, dec: 0 },
    dhi: { label: "Diffuse horizontal radiation", unit: "W/m²", get: (W) => W.dhi, sc: { ramp: "sun", lo: 0, hi: 1200 }, dec: 0 },
    hir: { label: "Horizontal infrared radiation from the sky", unit: "W/m²", get: (W) => W.hir, sc: { ramp: "sun", lo: 0, hi: 500 }, dec: 0 },
    gil: { label: "Global horizontal illuminance", unit: "klx", get: (W, X) => X.gilk || (X.gilk = W.gil.map((v) => v / 1000)), sc: { ramp: "light", lo: 0, hi: 120 }, dec: 1 },
    dil: { label: "Diffuse horizontal illuminance", unit: "klx", get: (W, X) => X.dilk || (X.dilk = W.dil.map((v) => v / 1000)), sc: { ramp: "light", lo: 0, hi: 120 }, dec: 1 },
    tsc: { label: "Total sky cover", unit: "tenths", get: (W) => W.tsc, sc: { ramp: "sky", lo: 0, hi: 10 }, dec: 0 },
    ws: { label: "Wind speed", unit: "m/s", get: (W) => W.ws, sc: { ramp: "wind", lo: 0, hi: 20 }, dec: 1 },
    wd: { label: "Wind direction", unit: "°", get: (W) => W.wd, sc: { ramp: "dir", lo: 0, hi: 360 }, dec: 0 },
    prec: { label: "Liquid precipitation", unit: "mm", get: (W) => W.prec, sc: { ramp: "rain", lo: 0, hi: 10 }, dec: 1 },
    snow: { label: "Snow depth", unit: "cm", get: (W) => W.snow, sc: { ramp: "rain", lo: 0, hi: 60 }, dec: 0 },
    vis: { label: "Visibility", unit: "km", get: (W) => W.vis, sc: { ramp: "sky", lo: 0, hi: 100 }, dec: 0 },
    alt: { label: "Solar altitude", unit: "°", get: (W, X) => X.alt, sc: { ramp: "sun", lo: 0, hi: 90 }, dec: 1 },
    mrt: { label: "Mean radiant temperature, in the sun", unit: "°C", get: (W, X) => X.mrt, sc: { ramp: "temp", lo: -40, hi: 70 }, dec: 1 },
    dwSun: { label: "Wind effect on UTCI, in the sun", unit: "K", get: (W, X) => X.dwSun || (X.dwSun = X.utci.sunWind.map((v, i) => v - X.utci.sunStill[i])), sc: { ramp: "delta", lo: -20, hi: 20 }, dec: 1, sym: true },
    dwShade: { label: "Wind effect on UTCI, in shade", unit: "K", get: (W, X) => X.dwShade || (X.dwShade = X.utci.shadeWind.map((v, i) => v - X.utci.shadeStill[i])), sc: { ramp: "delta", lo: -20, hi: 20 }, dec: 1, sym: true },
    dlw: { label: "Longwave exchange with the sky, change of MRT", unit: "K", get: (W, X) => X.dlw, sc: { ramp: "delta", lo: -15, hi: 15 }, dec: 1, sym: true },
    mrtShade: { label: "Mean radiant temperature, in shade", unit: "°C", get: (W, X) => X.mrtShade, sc: { ramp: "temp", lo: -40, hi: 70 }, dec: 1 },
    dmrt: { label: "Solar increase of mean radiant temperature", unit: "K", get: (W, X) => X.dmrt, sc: { ramp: "sun", lo: 0, hi: 40 }, dec: 1 },
    utci_sw: { label: "UTCI, sun and wind", unit: "°C", get: (W, X) => X.utci.sunWind, sc: { ramp: "temp", lo: -70, hi: 70 }, dec: 1, utci: true },
    utci_sn: { label: "UTCI, sun, no wind", unit: "°C", get: (W, X) => X.utci.sunStill, sc: { ramp: "temp", lo: -70, hi: 70 }, dec: 1, utci: true },
    utci_hw: { label: "UTCI, shade and wind", unit: "°C", get: (W, X) => X.utci.shadeWind, sc: { ramp: "temp", lo: -70, hi: 70 }, dec: 1, utci: true },
    utci_hn: { label: "UTCI, shade, no wind", unit: "°C", get: (W, X) => X.utci.shadeStill, sc: { ramp: "temp", lo: -70, hi: 70 }, dec: 1, utci: true },
    surfS: { label: "Irradiance on the south façade", unit: "W/m²", get: (W, X) => X.surf.S.hourly, sc: { ramp: "sun", lo: 0, hi: 1200 }, dec: 0, group: "surf" },
    surfSE: { label: "Irradiance on the south-east façade", unit: "W/m²", get: (W, X) => X.surf.SE.hourly, sc: { ramp: "sun", lo: 0, hi: 1200 }, dec: 0, group: "surf" },
    surfE: { label: "Irradiance on the east façade", unit: "W/m²", get: (W, X) => X.surf.E.hourly, sc: { ramp: "sun", lo: 0, hi: 1200 }, dec: 0, group: "surf" },
    surfNE: { label: "Irradiance on the north-east façade", unit: "W/m²", get: (W, X) => X.surf.NE.hourly, sc: { ramp: "sun", lo: 0, hi: 1200 }, dec: 0, group: "surf" },
    surfN: { label: "Irradiance on the north façade", unit: "W/m²", get: (W, X) => X.surf.N.hourly, sc: { ramp: "sun", lo: 0, hi: 1200 }, dec: 0, group: "surf" },
    surfNW: { label: "Irradiance on the north-west façade", unit: "W/m²", get: (W, X) => X.surf.NW.hourly, sc: { ramp: "sun", lo: 0, hi: 1200 }, dec: 0, group: "surf" },
    surfW: { label: "Irradiance on the west façade", unit: "W/m²", get: (W, X) => X.surf.W.hourly, sc: { ramp: "sun", lo: 0, hi: 1200 }, dec: 0, group: "surf" },
    surfSW: { label: "Irradiance on the south-west façade", unit: "W/m²", get: (W, X) => X.surf.SW.hourly, sc: { ramp: "sun", lo: 0, hi: 1200 }, dec: 0, group: "surf" },
    pvBest: { label: "PV output, best fixed plane", unit: "W/kWp", get: (W, X) => X.pv.planes.best.hourly, sc: { ramp: "sun", lo: 0, hi: 900 }, dec: 0, group: "pv" },
    pvFlat: { label: "PV output, flat panel", unit: "W/kWp", get: (W, X) => X.pv.planes.flat.hourly, sc: { ramp: "sun", lo: 0, hi: 900 }, dec: 0, group: "pv" },
    pvS: { label: "PV output, south façade", unit: "W/kWp", get: (W, X) => X.pv.planes.S.hourly, sc: { ramp: "sun", lo: 0, hi: 900 }, dec: 0, group: "pv" },
    pvE: { label: "PV output, east façade", unit: "W/kWp", get: (W, X) => X.pv.planes.E.hourly, sc: { ramp: "sun", lo: 0, hi: 900 }, dec: 0, group: "pv" },
    pvW: { label: "PV output, west façade", unit: "W/kWp", get: (W, X) => X.pv.planes.W.hourly, sc: { ramp: "sun", lo: 0, hi: 900 }, dec: 0, group: "pv" },
    pvN: { label: "PV output, north façade", unit: "W/kWp", get: (W, X) => X.pv.planes.N.hourly, sc: { ramp: "sun", lo: 0, hi: 900 }, dec: 0, group: "pv" },
    surfRoof: { label: "Irradiance on the roof (horizontal)", unit: "W/m²", get: (W, X) => X.surf.Roof.hourly, sc: { ramp: "sun", lo: 0, hi: 1200 }, dec: 0, group: "surf" }
  };
  S.V = V;
  S.varOptions = (keys) => (keys || Object.keys(V)).map((k) => [k, V[k].label]);
  // colour scale for a variable, global or local range
  // a colour scale per variable: a range set by the viewer wins, then local or global; variables in a group share one range
  S.scaleFor = function (key, ctx) {
    const v = V[key], gk = v.group || key, g = Object.assign({ key: gk }, v.sc), ov = ctx.st.scaleOv[gk];
    if (ov) { g.lo = ov.lo; g.hi = ov.hi; }
    else if (ctx.st.range === "local") { let lo = Infinity, hi = -Infinity; const keys = v.group ? Object.keys(V).filter((k) => V[k].group === v.group) : [key]; for (const k of keys) { const a = V[k].get(ctx.W, ctx.X); for (let i = 0; i < a.length; i++) if (isFinite(a[i])) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; } } if (hi > lo) { g.lo = lo; g.hi = hi; } if (v.sym) { const m = Math.max(Math.abs(g.lo), Math.abs(g.hi)); g.lo = -m; g.hi = m; } }
    return K.scale(g);
  };
  S.missingVar = (key, ctx) => { const a = V[key].get(ctx.W, ctx.X); let n = 0; for (let i = 0; i < a.length; i++) if (!isFinite(a[i])) n++; return n === a.length; };

  /* ---------------- helpers ---------------- */
  const pct = (a, n) => (n ? (100 * a) / n : 0);
  const dateOf = (d) => `${C.T.day[d * 24]} ${C.MONTHS_LONG[C.T.month[d * 24] - 1]}`;
  const hourOf = (i) => `${dateOf((i / 24) | 0)}, ${String(i % 24).padStart(2, "0")}:00 to ${String((i % 24) + 1).padStart(2, "0")}:00`;
  S.dateOf = dateOf; S.hourOf = hourOf;
  function percentile(a, p) { const b = Array.from(a).filter(isFinite).sort((x, y) => x - y); if (!b.length) return NaN; const k = (b.length - 1) * p / 100, f = Math.floor(k); return b[f] + (b[Math.min(b.length - 1, f + 1)] - b[f]) * (k - f); }
  S.percentile = percentile;
  function monthlyMean(a, mask) { const s = new Array(12).fill(0), c = new Array(12).fill(0); for (let i = 0; i < N; i++) { if (mask && !mask[i]) continue; if (!isFinite(a[i])) continue; s[C.T.month[i] - 1] += a[i]; c[C.T.month[i] - 1]++; } return s.map((x, k) => (c[k] ? x / c[k] : NaN)); }
  function monthlySum(a, mask) { const s = new Array(12).fill(0); for (let i = 0; i < N; i++) { if (mask && !mask[i]) continue; if (isFinite(a[i])) s[C.T.month[i] - 1] += a[i]; } return s; }
  S.monthlyMean = monthlyMean; S.monthlySum = monthlySum;
  const seasonMask = (lat, which) => { const m = new Uint8Array(N); for (let i = 0; i < N; i++) m[i] = C.seasonOf(C.T.month[i], lat).name === which ? 1 : 0; return m; };
  const seasonDays = (lat, which) => { const out = []; for (let d = 0; d < 365; d++) if (C.seasonOf(C.T.month[d * 24], lat).name === which) out.push(d); return out; };
  const summerMonths = (lat) => (lat >= 0 ? "June to August" : "December to February");
  const winterMonths = (lat) => (lat >= 0 ? "December to February" : "June to August");
  const argmax = (a) => a.reduce((b, v, i) => (v > a[b] ? i : b), 0), argmin = (a) => a.reduce((b, v, i) => (v < a[b] ? i : b), 0);
  // a number in the reading, linked to the card that shows it
  const n = S.n = (txt, card, set) => `<span class="n" data-card="${card}"${set ? ` data-set="${set}"` : ""} tabindex="0">${txt}</span>`;
  const list = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);

  /* ---------------- Köppen-Geiger names ---------------- */
  S.KOPPEN = { Af: "tropical rainforest", Am: "tropical monsoon", Aw: "tropical savanna, dry winter", As: "tropical savanna, dry summer", BWh: "hot desert", BWk: "cold desert", BSh: "hot semi-arid", BSk: "cold semi-arid", Csa: "Mediterranean, hot summer", Csb: "Mediterranean, warm summer", Csc: "Mediterranean, cold summer", Cwa: "humid subtropical, dry winter", Cwb: "subtropical highland, dry winter", Cwc: "subtropical highland, cold summer", Cfa: "humid subtropical, no dry season", Cfb: "temperate oceanic", Cfc: "subpolar oceanic", Dsa: "continental, dry hot summer", Dsb: "continental, dry warm summer", Dsc: "continental, dry cool summer", Dsd: "continental, dry summer, very cold winter", Dwa: "continental, dry winter, hot summer", Dwb: "continental, dry winter, warm summer", Dwc: "subarctic, dry winter", Dwd: "subarctic, dry winter, very cold winter", Dfa: "continental, hot summer, no dry season", Dfb: "continental, warm summer, no dry season", Dfc: "subarctic, no dry season", Dfd: "subarctic, very cold winter", ET: "tundra", EF: "ice cap" };

  /* ---------------- family colours for the strategy carpet ---------------- */
  S.FAMILIES = [
    ["comfort", "Inside the comfort zone", "#1baf7a", ["comfort"]],
    ["pheat", "Passive heating: internal gains or sun", "#eda100", ["internal", "solarLow", "solarHigh"]],
    ["vent", "Ventilation or thermal mass", "#2a78d6", ["fan", "natVent", "mass", "massNight"]],
    ["evap", "Evaporative cooling", "#6250d6", ["evap", "evap2"]],
    ["heat", "Heating needed", "#eb6834", ["heat", "humid"]],
    ["cool", "Cooling or dehumidification needed", "#e87ba4", ["cool", "dehumid"]]];
  S.familyOf = function (Z, i) { for (let f = 0; f < 4; f++) for (const k of S.FAMILIES[f][3]) if (Z.S[k][i]) return f; return Z.S.heat[i] || Z.S.humid[i] ? 4 : 5; };
  S.CC_FAMILY = {}; S.FAMILIES.forEach((f, idx) => f[3].forEach((k) => (S.CC_FAMILY[k] = idx))); S.CC_FAMILY.shade = -1; S.CC_FAMILY.windProt = -1;


  /* ---------------- strategy zone outlines on the psychrometric chart (Macro Clima and Clima Compare) ---------------- */
  S.zoneOutlines = function (Z, P, keys) {
    const out = [], p = 101325, tLo = -15, tHi = 45, wHi = 30, x0 = 48, y0 = 14, w = 640, h = 410;
    const Xp = (t) => x0 + w * (Math.max(tLo, Math.min(tHi, t)) - tLo) / (tHi - tLo), Yp = (wg) => y0 + h - h * wg / wHi;
    const wbAt = (t, wk) => C.wetBulb(t, wk, p);
    const tForWb = (wb, wk) => { let lo = wb, hi = 60; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (wbAt(m, wk) > wb) hi = m; else lo = m; } return (lo + hi) / 2; };
    const tForRh = (rh, wk) => C.dewFromPw(C.pwFromW(wk, p) / (rh / 100)); // temperature where this humidity ratio has the given RH
    const iv = { // interval of temperature, per humidity ratio (kg/kg)
      comfort: (wk, cv) => (wk <= P.comfort.wMax ? [cv.lo, cv.hi] : null),
      dehumid: (wk, cv) => (wk > P.comfort.wMax ? [cv.lo, cv.hi] : null),
      humid: (wk, cv) => (wk < P.humid.wMin ? [cv.lo, cv.hi] : null),
      internal: (wk, cv) => [P.internal.balance, cv.lo],
      solarLow: (wk, cv) => [cv.lo - P.solarLow.dT, cv.lo], solarHigh: (wk, cv) => [cv.lo - P.solarHigh.dT, cv.lo],
      fan: (wk, cv) => (wk <= P.comfort.wMax ? [cv.hi, Math.min(cv.hi + P.fan.dT, tForRh(P.fan.rhMax, wk) > cv.hi ? cv.hi + P.fan.dT : cv.hi)] : null),
      natVent: (wk, cv) => (wk <= P.comfort.wMax ? [cv.hi, cv.hi + P.natVent.dT] : null),
      mass: (wk, cv) => (wk <= P.comfort.wMax ? [cv.hi, cv.hi + P.mass.dT] : null), massNight: (wk, cv) => (wk <= P.comfort.wMax ? [cv.hi, cv.hi + P.massNight.dT] : null),
      evap: (wk, cv) => (wk <= P.comfort.wMax ? [cv.hi, Math.min(P.evap.tMax, tForWb(P.evap.wbMax, wk))] : null), evap2: (wk, cv) => (wk <= P.comfort.wMax ? [cv.hi, Math.min(P.evap2.tMax, tForWb(P.evap2.wbMax, wk))] : null),
      shade: () => [P.shade.tMin, 45], windProt: () => [-15, P.windProt.tMax]
    };
    const SHORT = { comfort: "Comfort", dehumid: "Dehumidify", humid: "Humidify", internal: "Internal gains", solarLow: "Solar, low mass", solarHigh: "Solar, high mass", fan: "Fan", natVent: "Natural vent.", mass: "Mass", massNight: "Mass + night vent.", evap: "Direct evap.", evap2: "Two-stage evap.", shade: "Shading", windProt: "Wind protection", heat: "", cool: "" };
    const names = Object.fromEntries(C.CC_KEYS);
    for (const k of keys) {
      if (!iv[k]) continue; const left = [], right = [];
      for (let wg = 0; wg <= wHi; wg += 0.25) { const wk = wg / 1000, cv = C.curveAt(Z.grid, wk), r = iv[k](wk, cv); if (!r) continue; let [a, b] = r; const td = C.dewFromPw(Math.max(1, C.pwFromW(wk, p))); a = Math.max(a, td); if (b <= a) continue; left.push([Xp(a), Yp(wg)]); right.push([Xp(b), Yp(wg)]); }
      if (left.length < 2) continue;
      const pts = left.concat(right.reverse()); const d = "M" + pts.map((q) => q[0].toFixed(1) + "," + q[1].toFixed(1)).join("L") + "Z";
      const fam = S.CC_FAMILY[k], col = fam >= 0 ? S.FAMILIES[fam][2] : "#5b6663";
      const mid = left[Math.floor(left.length * 0.25)]; out.push({ k, d, col, name: names[k], short: SHORT[k], lx: (mid[0] + right[right.length - 1 - Math.floor(left.length * 0.25)][0]) / 2 - 20, ly: mid[1] });
    }
    return out;
  };

  /* ---------------- adaptive comfort models ---------------- */
  S.ADAPT = [
    ["en1", "EN 16798-1, category I"], ["en2", "EN 16798-1, category II"], ["en3", "EN 16798-1, category III"],
    ["na", "DIN EN 16798-1/NA (Germany), category II"], ["ash90", "ASHRAE 55, 90 % acceptability"], ["ash80", "ASHRAE 55, 80 % acceptability"]];
  S.ADAPT_LABEL = Object.fromEntries(S.ADAPT);
  const EUROPE = new Set("ALB AND AUT BEL BGR BIH BLR CHE CYP CZE DEU DNK ESP EST FIN FRA GBR GRC HRV HUN IRL ISL ITA LIE LTU LUX LVA MCO MDA MKD MLT MNE NLD NOR POL PRT ROU SMR SRB SVK SVN SWE UKR XKX".split(" "));
  S.regionOf = (cc) => (/^(DEU|GER|DE)$/i.test(cc || "") ? "de" : EUROPE.has((cc || "").toUpperCase()) ? "eu" : "world");
  S.defaultAdaptive = (cc) => ({ de: "na", eu: "en2", world: "ash80" }[S.regionOf(cc)]);
  // band of acceptable indoor operative temperature for each day; outside the running-mean range a standard covers,
  // the band is held at its limit values and flagged, so it can be drawn lighter
  S.adaptiveBand = function (X, key) {
    const rmEN = X.adaptive.rmEN, rmA = X.adaptive.rmA, lo = new Float32Array(365), hi = new Float32Array(365), inR = new Uint8Array(365);
    for (let d = 0; d < 365; d++) {
      if (key.startsWith("en")) { const r = rmEN[d], k = { en1: [2, 3], en2: [3, 4], en3: [4, 5] }[key]; hi[d] = 0.33 * Math.min(30, Math.max(10, r)) + 18.8 + k[0]; lo[d] = 0.33 * Math.min(30, Math.max(15, r)) + 18.8 - k[1]; inR[d] = r >= 10 && r <= 30 ? 1 : 0; }
      else if (key === "na") { const r = rmEN[d], nc = r <= 16 ? 22 : r >= 32 ? 26 : 18 + 0.25 * r; hi[d] = nc + 2; lo[d] = nc - 2; inR[d] = 1; }
      else { const r = rmA[d], cm = 0.31 * Math.min(33.5, Math.max(10, r)) + 17.8, k = key === "ash90" ? 2.5 : 3.5; hi[d] = cm + k; lo[d] = cm - k; inR[d] = r >= 10 && r <= 33.5 ? 1 : 0; }
    }
    return { lo, hi, inR, label: S.ADAPT_LABEL[key], rm: key.startsWith("ash") ? rmA : rmEN, rmName: key.startsWith("ash") ? "prevailing mean outdoor temperature (7 days)" : "running mean outdoor temperature" };
  };

  /* ---------------- reference climates ---------------- */
  S.refs = function (ctx) {
    const A = (root.CLIMA_ANCHORS || []).filter((a) => !(Math.abs(a.lat - ctx.W.meta.lat) < 0.3 && Math.abs(a.mean - ctx.R.mean) < 0.2));
    return A.map((a) => { const dm = Float32Array.from(a.dm); return { name: a.name, short: a.name === "San Francisco" ? "SF" : a.name.slice(0, 3), p01: a.p01, p99: a.p99, mean: a.mean, ghi: a.ghi, diff: a.diff, swing: a.swing, hdd: C.degreeDays(dm, ctx.st.hdd, "heat").annual, cdd: C.degreeDays(dm, ctx.st.cdd, "cool").annual, gtz: C.gradtagzahl(dm).annual, pv: a.pv }; });
  };
  // where a value sits among the reference climates, in words
  S.compare = function (v, refs, key) {
    const r = refs.map((x) => x[key]); if (!r.length) return "";
    const below = r.filter((x) => x < v).length, n0 = r.length + 1, rankLow = below + 1;
    if (rankLow === 1) return `lowest of ${n0}`; if (rankLow === n0) return `highest of ${n0}`;
    return rankLow <= n0 / 2 ? `${ord(rankLow)} lowest of ${n0}` : `${ord(n0 - rankLow + 1)} highest of ${n0}`;
  };
  S.glance = function (ctx) {
    const R = ctx.R, st = ctx.st, refs = S.refs(ctx), T1 = (v) => fmt(v, 1) + " °C", K0 = (v) => fmt(v) + " Kd";
    const rows = [
      { key: "p01", label: "Cold end, 1st percentile", v: R.p01, f: T1, card: "c-monthT", what: "One hour in a hundred is colder than this. It marks the cold conditions a building meets for a few days a year, without the single extreme hour." },
      { key: "p99", label: "Warm end, 99th percentile", v: R.p99, f: T1, card: "c-monthT", what: "One hour in a hundred is warmer than this: the warm conditions of the hottest days, without the single extreme hour." },
      { key: "mean", label: "Annual mean temperature", v: R.mean, f: T1, card: "c-monthT", what: "The average of all hours. It is close to the temperature of the ground a few metres down." },
      { key: "swing", label: "Mean daily swing", v: R.ex.meanSwing, f: (v) => fmt(v, 1) + " K", card: "c-daily", what: "The average difference between each day's maximum and minimum. A large swing means cool nights follow warm days; a small one means day and night are alike." },
      { key: "ghi", label: "Solar radiation on the horizontal", v: R.ghi, f: (v) => fmt(v) + " kWh/m²", card: "c-monthR", what: "The solar energy an unobstructed horizontal surface receives in a year." },
      { key: "diff", label: "Diffuse share", v: R.diffShare, f: (v) => fmt(v) + " %", card: "c-monthR", what: "The part of that energy that arrives from the sky and clouds rather than straight from the sun. The higher it is, the more evenly light comes from the whole sky." },
      { key: "hdd", label: `Heating degree days, base ${fmt(st.hdd, 1)} °C`, v: R.hdd.annual, f: K0, card: "c-dd", what: "Each day, how far the daily mean falls below the base, added up over the year. It scales with the heat a building loses to the outside." },
      { key: "cdd", label: `Cooling degree days, base ${fmt(st.cdd, 1)} °C`, v: R.cdd.annual, f: K0, card: "c-dd", what: "Each day, how far the daily mean rises above the base, added up. It scales with the heat the outside air brings in." }];
    rows.push({ key: "pv", label: "PV yield, best fixed plane", v: ctx.X.pv.map.best.annual, f: (v) => fmt(v) + " kWh/kWp", card: "c-pvMap", what: "The electricity a year from one kilowatt-peak of panels on the best fixed tilt and orientation, after heat, reflection and standard system losses. It describes the sunlight as electricity; it does not size a system." });
    if (st.gtz) rows.push({ key: "gtz", label: "Gradtagzahl G 20/15", v: R.gtz.annual, f: K0, card: "c-dd", what: "German heating measure (VDI 4710): 20 °C minus the daily mean, on every day with a mean below 15 °C." });
    for (const r of rows) { r.refs = refs.map((x) => ({ name: x.name, short: x.short, v: x[r.key] })); r.cmp = S.compare(r.v, refs, r.key); }
    return { rows, refs };
  };

  /* ---------------- derived summaries, once per file ---------------- */
  S.summarise = function (W, X, st) {
    const R = {}, m = W.meta, lat = m.lat;
    R.p01 = percentile(W.dbt, 1); R.p99 = percentile(W.dbt, 99);
    R.mean = W.dbt.reduce((a, b) => a + b, 0) / N;
    R.mMean = monthlyMean(W.dbt); R.mMax = new Array(12).fill(0); R.mMin = new Array(12).fill(0);
    for (let mo = 0; mo < 12; mo++) { let a = 0, b = 0; for (let d = C.MSTART[mo]; d < C.MSTART[mo] + C.MDAYS[mo]; d++) { a += X.daily.max[d]; b += X.daily.min[d]; } R.mMax[mo] = a / C.MDAYS[mo]; R.mMin[mo] = b / C.MDAYS[mo]; }
    R.ghi = W.ghi.reduce((a, b) => a + (b > 0 ? b : 0), 0) / 1000; R.dhi = W.dhi.reduce((a, b) => a + (b > 0 ? b : 0), 0) / 1000;
    R.diffShare = pct(R.dhi, R.ghi);
    R.mGhiDay = monthlySum(W.ghi).map((v, k) => v / 1000 / C.MDAYS[k]); R.mDhiDay = monthlySum(W.dhi).map((v, k) => v / 1000 / C.MDAYS[k]);
    R.hdd = C.degreeDays(X.daily.mean, st.hdd, "heat"); R.cdd = C.degreeDays(X.daily.mean, st.cdd, "cool"); R.gtz = C.gradtagzahl(X.daily.mean);
    R.isDE = /^(DEU|GER|DE)$/i.test(m.country) || / DEU$/.test(st.siteTitle || "");
    // humidity
    R.rhWinter = monthlyMeanSeason(W.rh, lat, "Winter"); R.rhSummer = monthlyMeanSeason(W.rh, lat, "Summer");
    let dp18 = 0; const dpM = new Array(12).fill(0); for (let i = 0; i < N; i++) if (W.dpt[i] > 18) { dp18++; dpM[C.T.month[i] - 1]++; } R.dp18 = dp18; R.dp18Months = dpM;
    // summer nights
    const sd = seasonDays(lat, "Summer"); R.summerNightsBelow18 = pct(sd.filter((d) => X.daily.min[d] < 18).length, sd.length);
    const wd = seasonDays(lat, "Winter"); R.winterDaysAbove10 = pct(wd.filter((d) => X.daily.max[d] > 10).length, wd.length);
    R.swingMonthly = new Array(12).fill(0).map((_, mo) => R.mMax[mo] - R.mMin[mo]);
    // adaptive: share of hours where outdoor air lies inside the band
    R.adapt = {};
    for (const [key] of S.ADAPT) { const b = S.adaptiveBand(X, key); let ins = 0, above = 0, below = 0, outDays = 0; for (let d = 0; d < 365; d++) if (!b.inR[d]) outDays++; for (let i = 0; i < N; i++) { const d = (i / 24) | 0, t = W.dbt[i]; if (t > b.hi[d]) above++; else if (t < b.lo[d]) below++; else ins++; } R.adapt[key] = { ins, above, below, outDays }; }
    // sun
    let up = 0, sun = 0; for (let i = 0; i < N; i++) { if (X.alt[i] > 0) up++; if (W.dni[i] > 120) sun++; } R.sunUp = up; R.sunshine = sun;
    const skyM = Array.from({ length: 12 }, () => [0, 0, 0]); const sky = [0, 0, 0]; for (let i = 0; i < N; i++) { const c = C.skyClass(X.eps[i]); if (c < 0 || !(W.ghi[i] > 0)) continue; sky[c]++; skyM[C.T.month[i] - 1][c]++; } R.sky = sky; R.skyM = skyM;
    // illuminance
    R.illumOK = Array.from(W.gil).some((v) => v > 0) && !(W.missing.gil > N / 2);
    if (R.illumOK) { const th = [10000, 20000, 50000]; R.lux = th.map((t) => { let c = 0; const mm = new Array(12).fill(0); for (let i = 0; i < N; i++) if (W.gil[i] > t) { c++; mm[C.T.month[i] - 1]++; } return { t, hours: c, monthly: mm }; }); let day = 0; const dM = new Array(12).fill(0); for (let i = 0; i < N; i++) if (X.alt[i] > 0) { day++; dM[C.T.month[i] - 1]++; } R.dayHours = day; R.dayHoursM = dM; }
    // wind
    R.rose = C.windRose(W, null); R.seasons = {}; for (const s of ["Winter", "Spring", "Summer", "Autumn"]) R.seasons[s] = C.windRose(W, seasonMask(lat, s));
    const dayM = new Uint8Array(N), nightM = new Uint8Array(N); for (let i = 0; i < N; i++) { if (X.alt[i] > 0) dayM[i] = 1; else nightM[i] = 1; } R.roseDay = C.windRose(W, dayM); R.roseNight = C.windRose(W, nightM);
    // strategies
    const Z = X.zones; R.zoneHours = Z.hours; let above12 = 0; for (let i = 0; i < N; i++) if (X.w[i] > 0.012) above12++; R.wAbove12 = above12;
    let nv = 0; const nvM = new Uint8Array(N); for (let i = 0; i < N; i++) if (W.dbt[i] >= st.nv.tMin && W.dbt[i] <= st.nv.tMax && W.dpt[i] <= st.nv.dpMax) { nv++; nvM[i] = 1; } R.nv = nv; R.nvMask = nvM;
    // water
    R.precOK = !(W.missing.prec >= N * 0.5) && Array.from(W.prec).some((v) => v > 0);
    R.precM = monthlySum(W.prec); R.precTot = R.precM.reduce((a, b) => a + b, 0); let wetH = 0; for (let i = 0; i < N; i++) if (W.prec[i] > 0.1) wetH++; R.wetHours = wetH;
    R.snowOK = !(W.missing.snow >= N * 0.5) && Array.from(W.snow).some((v) => v > 0);
    if (R.snowOK) { let sd2 = 0; for (let d = 0; d < 365; d++) { let mx = 0; for (let h = 0; h < 24; h++) mx = Math.max(mx, W.snow[d * 24 + h] || 0); if (mx >= 1) sd2++; } R.snowDays = sd2; }
    // UTCI
    R.utci = {}; for (const [k, a] of Object.entries(X.utci)) { const cls = new Array(10).fill(0); const mon = Array.from({ length: 12 }, () => new Array(10).fill(0)); for (let i = 0; i < N; i++) { const c = C.utciClass(a[i]); if (c >= 0) { cls[c]++; mon[C.T.month[i] - 1][c]++; } } R.utci[k] = { cls, mon, heat: cls.slice(6).reduce((x, y) => x + y, 0), cold: cls.slice(0, 5).reduce((x, y) => x + y, 0), none: cls[5] }; }
    // MRT: overcast daytime hours (diffuse share above 80 %)
    let oc = 0, dNew = 0, dOld = 0; for (let i = 0; i < N; i++) if (X.alt[i] > 5 && W.ghi[i] > 50 && W.dhi[i] / W.ghi[i] > 0.8) { oc++; dNew += X.dmrt[i]; dOld += X.dmrtCBE[i]; } R.overcastMrt = { hours: oc, now: oc ? dNew / oc : 0, cbe: oc ? dOld / oc : 0 };
    R.ex = X.extremes;
    // seasonal means of daily maxima and minima
    const sd2 = seasonDays(lat, "Summer"), wd2 = seasonDays(lat, "Winter"), avg = (ds, a) => ds.reduce((x, d) => x + a[d], 0) / ds.length;
    R.sumMax = avg(sd2, X.daily.max); R.sumMin = avg(sd2, X.daily.min); R.winMax = avg(wd2, X.daily.max); R.winMin = avg(wd2, X.daily.min);
    // precipitation plausibility and seasonality
    if (R.precOK) { const mx = Math.max(...R.precM), mn = Math.min(...R.precM); R.precDoubt = R.precTot < 100 || R.wetHours < 150 || (R.precTot > 300 && mn < 1) || (R.precTot > 400 && mn > 0 && mx / mn > 8); const ws = (lat >= 0 ? [11, 0, 1] : [5, 6, 7]).reduce((a, k) => a + R.precM[k], 0), ss = (lat >= 0 ? [5, 6, 7] : [11, 0, 1]).reduce((a, k) => a + R.precM[k], 0); R.precWinShare = pct(ws, R.precTot); R.precSumShare = pct(ss, R.precTot); }
    // adaptive: days outside the standard's range, below or above, and their months
    for (const [key] of S.ADAPT) { const b = S.adaptiveBand(X, key); const lo = [], hi = []; for (let d = 0; d < 365; d++) if (!b.inR[d]) (b.rm[d] < 20 ? lo : hi).push(C.T.month[d * 24] - 1); R.adapt[key].outLo = lo; R.adapt[key].outHi = hi; }
    return R;
  };
  function monthlyMeanSeason(a, lat, which) { let s = 0, c = 0; for (let i = 0; i < N; i++) if (C.seasonOf(C.T.month[i], lat).name === which && isFinite(a[i])) { s += a[i]; c++; } return c ? s / c : NaN; }

  /* ---------------- readings ---------------- */
  // Rules: state numbers with their basis, name thresholds by what they mean, say which side and when,
  // flag doubtful data, no comparisons with other places in the text (the glance table carries those).
  function compressMonths(ms) { if (ms.length < 12 && ms[0] === 0 && ms[ms.length - 1] === 11) { let k = ms.length - 1; while (k > 0 && ms[k - 1] === ms[k] - 1) k--; ms = ms.slice(k).concat(ms.slice(0, k)); } const out = []; let a = ms[0], b = ms[0]; for (let k = 1; k <= ms.length; k++) { if (k < ms.length && ms[k] === (b + 1) % 12) { b = ms[k]; continue; } out.push(a === b ? C.MONTHS_LONG[a] : `${C.MONTHS_LONG[a]} to ${C.MONTHS_LONG[b]}`); if (k < ms.length) { a = b = ms[k]; } } return out; }
  const ord = (k) => k + (k % 100 >= 11 && k % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][k % 10] || "th");
  const monthSpan = (ms) => { const u = [...new Set(ms)].sort((x, y) => x - y); return u.length ? list(compressMonths(u)) : ""; };
  const pctTxt = (v, card, set) => (v > 0 && v < 1 ? n("fewer than 1 %", card, set) : v > 99.5 && v < 100 ? n("more than 99 %", card, set) : n(fmt(v) + " %", card, set));
  S.readings = {};
  S.readings.summary = function (ctx) {
    const { W, R, st } = ctx, m = W.meta, out = [];
    let p = `${esc(ctx.siteName)}: ${fmt(Math.abs(m.lat), 2)}° ${m.lat >= 0 ? "N" : "S"}, ${fmt(Math.abs(m.lon), 2)}° ${m.lon >= 0 ? "E" : "W"}, ${fmt(m.elev)} m above sea level.`;
    if (ctx.koppen) p += ` Köppen-Geiger class ${n(ctx.koppen, "c-identity")}${S.KOPPEN[ctx.koppen] ? ", " + S.KOPPEN[ctx.koppen] : ""}.`;
    if (ctx.uhi) p += ` All air temperatures below include an estimated urban heat island of ${n(fmt(ctx.uhi.nightMean, 1) + " K", "c-uhi")} on average with the sun down, up to ${n(fmt(ctx.uhi.max, 1) + " K", "c-uhi")}.`;
    out.push(p);
    const wm = argmax(R.mMean), cm = argmin(R.mMean), seas = R.mMean[wm] - R.mMean[cm];
    let t = `One hour in a hundred is colder than ${n(fmt(R.p01, 1) + " °C", "c-glance")} and one in a hundred warmer than ${n(fmt(R.p99, 1) + " °C", "c-glance")}; the annual mean is ${n(fmt(R.mean, 1) + " °C", "c-glance")}. Monthly means run from ${n(fmt(R.mMean[cm], 1) + " °C", "c-monthT")} in ${C.MONTHS_LONG[cm]} to ${n(fmt(R.mMean[wm], 1) + " °C", "c-monthT")} in ${C.MONTHS_LONG[wm]}.`;
    const late = W.meta.lat >= 0 ? wm >= 8 : wm >= 2 && wm <= 4;
    if (late) t += ` The warmest month comes late, after the longest days.`;
    if (R.ex.meanSwing > seas) t += ` The average day-night swing, ${n(fmt(R.ex.meanSwing, 1) + " K", "c-daily")}, is larger than the ${n(fmt(seas, 1) + " K", "c-monthT")} between the warmest and coldest month.`;
    out.push(t);
    const gm = argmax(R.mGhiDay), lm = argmin(R.mGhiDay);
    let r = `A horizontal surface receives ${n(fmt(R.ghi) + " kWh/m²", "c-glance")} a year, ${n(fmt(R.diffShare) + " %", "c-glance")} of it diffuse. The daily amount, as a monthly mean, runs from ${n(fmt(R.mGhiDay[lm], 1) + " kWh/m²", "c-monthR")} in ${C.MONTHS_LONG[lm]} to ${n(fmt(R.mGhiDay[gm], 1) + " kWh/m²", "c-monthR")} in ${C.MONTHS_LONG[gm]}.`;
    const lag = (wm - gm + 12) % 12; if (lag >= 2 && lag <= 4) r += ` Temperature peaks ${lag} months after radiation.`;
    out.push(r);
    const H = R.hdd.annual, Cd = R.cdd.annual;
    let dd = `Heating degree days (base ${fmt(st.hdd, 1)} °C): ${n(fmt(H) + " Kd", "c-glance")}. Cooling degree days (base ${fmt(st.cdd, 1)} °C): ${n(fmt(Cd) + " Kd", "c-glance")}.`;
    if (Cd < 100 && H >= 100) dd += ` Cooling degree days are close to zero.`; else if (H < 100 && Cd >= 100) dd += ` Heating degree days are close to zero.`;
    if (st.gtz) dd += ` Gradtagzahl G 20/15: ${n(fmt(R.gtz.annual) + " Kd", "c-dd")} over ${n(fmt(R.gtz.heatingDays) + " heating days", "c-dd")}.`;
    out.push(dd);
    return out;
  };
  S.readings.temperature = function (ctx) {
    const { W, R, st } = ctx, lat = W.meta.lat, out = [];
    const bm = argmax(R.swingMonthly), sm = argmin(R.swingMonthly);
    out.push(`The day-night swing averages ${n(fmt(R.ex.meanSwing, 1) + " K", "c-daily")}, from ${n(fmt(R.swingMonthly[sm], 1) + " K", "c-profiles")} in ${C.MONTHS_LONG[sm]} to ${n(fmt(R.swingMonthly[bm], 1) + " K", "c-profiles")} in ${C.MONTHS_LONG[bm]}. In summer (${summerMonths(lat)}) days average a maximum of ${n(fmt(R.sumMax, 1) + " °C", "c-daily")} and a minimum of ${n(fmt(R.sumMin, 1) + " °C", "c-daily")}; in winter (${winterMonths(lat)}) ${n(fmt(R.winMax, 1) + " °C", "c-daily")} and ${n(fmt(R.winMin, 1) + " °C", "c-daily")}.`);
    const a = R.adapt[st.adm], name = S.ADAPT_LABEL[st.adm];
    let ad = `The ${name} band describes indoor temperatures accepted in naturally ventilated buildings. Outdoor air lies inside it for ${pctTxt(pct(a.ins, N), "c-daily")} of hours, below it for ${pctTxt(pct(a.below, N), "c-daily")} and above it for ${pctTxt(pct(a.above, N), "c-daily")}.`;
    if (a.outDays) { const parts = []; if (a.outLo.length) parts.push(`below it on ${n(fmt(a.outLo.length) + " days", "c-daily")} (${monthSpan(a.outLo)})`); if (a.outHi.length) parts.push(`above it on ${n(fmt(a.outHi.length) + " days", "c-daily")} (${monthSpan(a.outHi)})`); ad += ` The running mean lies outside the range the standard covers, ${list(parts)}; there the band is held at its limit.`; }
    out.push(ad);
    let h = `Relative humidity averages ${n(fmt(R.rhWinter) + " %", "c-carpet", "v=rh")} in winter and ${n(fmt(R.rhSummer) + " %", "c-carpet", "v=rh")} in summer.`;
    if (R.dp18 === 0) h += ` The dew point never exceeds 18 °C, the level at which air starts to feel muggy.`;
    else if (R.dp18 < 50) h += ` The dew point exceeds 18 °C, the level at which air starts to feel muggy, in only ${n(fmt(R.dp18) + " hours", "c-carpet", "v=dpt")}.`;
    else { const mx = Math.max(...R.dp18Months), top = R.dp18Months.map((v, k) => [v, k]).filter((x) => x[0] >= mx * 0.5).map((x) => x[1]); h += ` The dew point exceeds 18 °C, the level at which air starts to feel muggy, for ${n(fmt(R.dp18) + " hours", "c-carpet", "v=dpt")}, ${top.length >= 10 ? "in almost every month" : "mainly in " + monthSpan(top)}.`; }
    out.push(h);
    return out;
  };
  S.readings.extremes = function (ctx) {
    const { R } = ctx, e = R.ex, out = [];
    out.push(`Summer days (maximum 25 °C or more): ${n(fmt(e.summerDays), "c-calendar")}. Hot days (30 °C or more): ${n(fmt(e.hotDays), "c-calendar")}. Tropical nights (minimum 20 °C or more): ${n(fmt(e.tropicalNights), "c-calendar")}. Frost days (minimum below 0 °C): ${n(fmt(e.frostDays), "c-calendar")}. Ice days (maximum below 0 °C): ${n(fmt(e.iceDays), "c-calendar")}.`);
    let sp = "";
    if (e.heatSpells.length) { const L = e.heatSpells.reduce((x, y) => (y[1] > x[1] ? y : x)); sp += `Hot days come in runs of three or more ${n(fmt(e.heatSpells.length) + (e.heatSpells.length === 1 ? " time" : " times"), "c-calendar")}; the longest lasts ${n(fmt(L[1]) + " days", "c-calendar")}, from ${dateOf(L[0])}. `; }
    else if (e.hotDays) sp += `Hot days occur singly or in pairs, never three in a row. `;
    if (e.coldSpells.length) { const L = e.coldSpells.reduce((x, y) => (y[1] > x[1] ? y : x)); sp += `Daily means stay at or below 0 °C for three days or more ${n(fmt(e.coldSpells.length) + (e.coldSpells.length === 1 ? " time" : " times"), "c-calendar")}; the longest run lasts ${n(fmt(L[1]) + " days", "c-calendar")}, from ${dateOf(L[0])}.`; }
    if (sp) out.push(sp.trim());
    out.push(`The hottest week starts on ${dateOf(e.hottestWeek.start)} (mean ${n(fmt(e.hottestWeek.mean, 1) + " °C", "c-hotweek")}), the coldest on ${dateOf(e.coldestWeek.start)} (${n(fmt(e.coldestWeek.mean, 1) + " °C", "c-coldweek")}). Extreme hours: ${n(fmt(e.tMax.v, 1) + " °C", "c-weeks")} on ${dateOf((e.tMax.i / 24) | 0)} and ${n(fmt(e.tMin.v, 1) + " °C", "c-weeks")} on ${dateOf((e.tMin.i / 24) | 0)}.`);
    out.push(`${n(fmt(e.overcastDays) + " days", "c-calendar")} (${fmt(pct(e.overcastDays, 365))} %) are overcast, ${e.overcastBasis === "sky cover" ? "with daytime sky cover of 8 tenths or more" : "with a daily clearness index below 0.3 (the file has no sky cover)"}. The longest overcast run lasts ${n(fmt(e.longestOvercast[1]) + " days", "c-calendar")}.`);
    return out;
  };
  S.readings.sun = function (ctx) {
    const { R } = ctx, out = [];
    out.push(`The sun is above the horizon for ${n(fmt(R.sunUp) + " hours", "c-sunpath")} a year. In ${n(fmt(R.sunshine), "c-monthR")} of them (${fmt(pct(R.sunshine, R.sunUp))} %) direct normal radiation exceeds 120 W/m², the WMO definition of sunshine.`);
    const W = ctx.W, X = ctx.X, tscOK = Array.from(W.tsc).some((v) => v > 0) && !(W.missing && W.missing.tsc >= C.N * 0.5);
    if (tscOK) { const c = [0, 0, 0], d = [0, 0, 0]; let t = 0, td = 0; for (let i = 0; i < C.N; i++) { const v = W.tsc[i]; if (!isFinite(v)) continue; const k = v <= 2 ? 0 : v <= 7 ? 1 : 2; c[k]++; t++; if (X.alt[i] > 0) { d[k]++; td++; } }
      out.push(`By the sky cover in the file, ${pctTxt(pct(c[0], t), "c-sky")} of all hours are clear (0 to 2 tenths), ${pctTxt(pct(c[1], t), "c-sky")} partly cloudy and ${pctTxt(pct(c[2], t), "c-sky")} overcast (8 tenths or more). In daylight hours: ${pctTxt(pct(d[0], td), "c-sky")} clear, ${pctTxt(pct(d[2], td), "c-sky")} overcast.`); }
    else out.push(`The file holds no sky cover.`);
    return out;
  };
  S.readings.surfaces = function (ctx) {
    const { X, W } = ctx, s = X.surf, out = [], eq = W.meta.lat >= 0 ? "S" : "N", pole = W.meta.lat >= 0 ? "N" : "S";
    const order = C.ORIENT.map((o) => o[0]).sort((a, b) => s[b].annual - s[a].annual);
    out.push(`Annual irradiation, kWh/m²: ${order.map((k) => `${k} ${n(fmt(root.K.U.v(s[k].annual, "kWh/m²")), "c-orient")}`).join(", ")}; roof ${n(fmt(root.K.U.v(s.Roof.annual, "kWh/m²")), "c-orient")}.`);
    const by = {}; for (const k of ["E", "W"]) { by[k] = []; for (let m = 0; m < 12; m++) if (s[k].monthly[m] > s[eq].monthly[m]) by[k].push(m); }
    const parts = ["W", "E"].filter((k) => by[k].length).map((k) => `the ${OR_NAMES[k]} façade in ${monthSpan(by[k])}`);
    if (parts.length) out.push(`Month by month, ${list(parts)} receive${parts.length === 1 ? "s" : ""} more than the ${OR_NAMES[eq]} façade.`);
    const fr = (k) => `${n(fmt(100 * s[k].skyShare) + " %", "c-orient")} is diffuse from the sky and ${n(fmt(100 * s[k].gndShare) + " %", "c-orient")} reflected from the ground`;
    out.push(`Of the radiation on the ${OR_NAMES[pole]} façade, ${fr(pole)}; on the ${OR_NAMES[eq]} façade, ${fr(eq).replace(" is ", " ")}. Ground reflectance: ${fmt(s[eq].albedo, 2)}${Math.abs(s[eq].albedo - 0.2) < 0.005 ? " (assumed)" : ", from the file"}.`);
    return out;
  };
  // compass words for an azimuth
  const COMPASS = ["north", "north-north-east", "north-east", "east-north-east", "east", "east-south-east", "south-east", "south-south-east", "south", "south-south-west", "south-west", "west-south-west", "west", "west-north-west", "north-west", "north-north-west"];
  S.compass = (az) => COMPASS[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];
  S.readings.pv = function (ctx) {
    const { X, W } = ctx, pv = X.pv, b = pv.map.best, P = pv.planes, out = [], eq = W.meta.lat >= 0 ? "S" : "N", pole = W.meta.lat >= 0 ? "N" : "S", pc = (k) => n(fmt(100 * P[k].annual / b.annual) + " %", "c-pvMap");
    out.push(`${b.tilt < 6 ? `A nearly flat panel, tilted ${n(fmt(b.tilt) + "°", "c-pvMap")} towards the ${S.compass(b.az)}, gives the most:` : `A fixed panel facing ${S.compass(b.az)} (${fmt(b.az)}°) at a tilt of ${n(fmt(b.tilt) + "°", "c-pvMap")} gives the most:`} ${n(fmt(b.annual) + " kWh per kWp", "c-pvMap")} a year, or ${n(fmt(b.annual * 0.2) + " kWh per m² of panel", "c-pvMonthly")} with 20 % efficient panels. A flat panel gives ${pc("flat")} of that, the ${OR_NAMES[eq]} façade ${pc(eq)}, the east and west façades ${pc("E")} and ${pc("W")}, the ${OR_NAMES[pole]} façade ${pc(pole)}.`);
    const mo = P.best.monthly, hi = argmax(mo), lo = argmin(mo);
    out.push(`On the best plane, monthly yield runs from ${n(fmt(mo[lo] * 0.2, 1) + " kWh per m²", "c-pvMonthly")} of panel in ${C.MONTHS_LONG[lo]} to ${n(fmt(mo[hi] * 0.2, 1) + " kWh per m²", "c-pvMonthly")} in ${C.MONTHS_LONG[hi]}; the ${OR_NAMES[eq]} façade gives ${n(fmt(P[eq].annual * 0.2) + " kWh per m²", "c-pvMonthly")} of panel a year.`);
    const s = P.best.st, heat = 100 * (1 - s.temp / s.iam), mh = Array.from(P.best.mIam, (v, k) => (v > 0 ? 100 * (1 - P.best.mDc[k] / v) : 0)), hm = argmax(mh);
    const refl = (k) => 100 * (1 - P[k].st.iam / P[k].st.poa);
    let t = heat >= 0.5 ? `Panel heat costs ${n(fmt(heat, 1) + " %", "c-pvLoss")} over the year, ${n(fmt(mh[hm], 1) + " %", "c-pvLoss")} in ${C.MONTHS_LONG[hm]}.` : heat <= -0.5 ? `Panels run cooler than 25 °C for much of the year and gain ${n(fmt(-heat, 1) + " %", "c-pvLoss")} from it; the loss peaks at ${n(fmt(mh[hm], 1) + " %", "c-pvLoss")} in ${C.MONTHS_LONG[hm]}.` : `Over the year, gains in cool hours and losses in warm ones roughly cancel; the loss peaks at ${n(fmt(mh[hm], 1) + " %", "c-pvLoss")} in ${C.MONTHS_LONG[hm]}.`;
    t += ` Reflection at low sun angles costs ${n(fmt(refl("best"), 1) + " %", "c-pvLoss")} on the best plane and ${n(fmt(refl(eq), 1) + " %", "c-pvLoss")} on the ${OR_NAMES[eq]} façade.`;
    out.push(t);
    if (S.pvRoofCases) {
      const cs = S.pvRoofCases(), f = cs[0], rows = cs[1], ew = cs.find((c) => /tents/.test(c.name));
      let r = `On a flat roof, panels laid flat edge to edge give ${n(fmt(f.roof) + " kWh per m² of roof", "c-pvRoofCmp")}. Rows at ${fmt(rows.t)}°, spaced so that none shades the next between 10h and 14h on the winter solstice, cover ${n(fmt(100 * rows.c) + " %", "c-pvRoofCmp")} of the roof and give ${n(fmt(rows.roof) + " kWh per m²", "c-pvRoofCmp")} of roof, but ${n(fmt(rows.kwp) + " kWh per kWp", "c-pvRoofCmp")} against ${fmt(f.kwp)} for the flat panels.`;
      if (ew) r += ` East-west tents at 10° cover ${n(fmt(100 * ew.c) + " %", "c-pvRoofCmp")} and give ${n(fmt(ew.roof) + " kWh per m²", "c-pvRoofCmp")} of roof.`;
      out.push(r);
    }
    return out;
  };
  S.readings.daylight = function (ctx) {
    const { R } = ctx, out = [];
    if (!R.illumOK) { out.push(`The file has no illuminance values.`); return out; }
    const [a, b, c] = R.lux, lo = argmin(a.monthly), hi = argmax(a.monthly);
    out.push(`Of the hours with the sun up, global horizontal illuminance exceeds 10 klx in ${pctTxt(pct(a.hours, R.dayHours), "c-lux")}, 20 klx in ${pctTxt(pct(b.hours, R.dayHours), "c-lux")} and 50 klx in ${pctTxt(pct(c.hours, R.dayHours), "c-lux")}. Hours above 10 klx per day: ${n(fmt(a.monthly[lo] / C.MDAYS[lo], 1), "c-lux")} in ${C.MONTHS_LONG[lo]}, ${n(fmt(a.monthly[hi] / C.MDAYS[hi], 1), "c-lux")} in ${C.MONTHS_LONG[hi]}.`);
    return out;
  };
  S.readings.wind = function (ctx) {
    const { R, W } = ctx, out = [];
    const top = (rose) => { const t = rose.counts.map((c) => c.reduce((a, b) => a + b, 0)); const k = argmax(t); return { dir: K.dirName(k * rose.step), share: pct(t[k], rose.total) }; };
    const a = top(R.rose), w = top(R.seasons.Winter), s = top(R.seasons.Summer);
    out.push(`Mean wind speed: ${n(fmt(R.rose.mean, 1) + " m/s", "c-rose")}. Calm hours (below 0.5 m/s): ${pctTxt(pct(R.rose.calm, R.rose.total), "c-rose")}. Most frequent direction: ${a.dir}, ${n(fmt(a.share) + " %", "c-rose")} of hours.`);
    const sw = `Averaged over all hours of the season, wind speed is ${n(fmt(R.seasons.Winter.mean, 1) + " m/s", "c-roseS")} in winter and ${n(fmt(R.seasons.Summer.mean, 1) + " m/s", "c-roseS")} in summer`;
    out.push(w.dir === s.dir ? `${sw}; in both seasons the wind comes most often from ${w.dir}.` : `${sw}; the most frequent direction is ${n(w.dir, "c-roseS")} in winter and ${n(s.dir, "c-roseS")} in summer.`);
    let gust = 0; for (let i = 0; i < N; i++) if (W.ws[i] >= 8) gust++;
    out.push(`Sun up: ${n(fmt(R.roseDay.mean, 1) + " m/s", "c-roseD")}; sun down: ${n(fmt(R.roseNight.mean, 1) + " m/s", "c-roseD")}. Hourly means of 8 m/s or more: ${n(fmt(gust) + " hours", "c-ws")} (${pctTxt(pct(gust, N), "c-ws")}). Speeds are at the station mast, usually 10 m above open ground.`);
    return out;
  };
  S.readings.psychro = function (ctx) {
    const { R } = ctx, h = R.zoneHours, out = [];
    out.push(`Comfort zone (ASHRAE 55 PMV model, as used by Climate Consultant): ${pctTxt(pct(h.comfort, N), "c-psy")} of hours. Humidity ratio above the zone's 12 g/kg limit: ${pctTxt(pct(R.wAbove12, N), "c-psy")}.`);
    const keys = ["internal", "solarLow", "solarHigh", "fan", "natVent", "mass", "massNight", "evap", "evap2"], names = Object.fromEntries(C.CC_KEYS);
    const ranked = keys.map((k) => [k, h[k]]).filter((x) => pct(x[1], N) >= 1).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (ranked.length) out.push(`Each zone marks hours in which that measure alone would reach the comfort zone; zones overlap, so their shares do not add up. Largest: ${list(ranked.map(([k, v]) => `${names[k].toLowerCase()} ${pctTxt(pct(v, N), "c-zones")}`))}.`);
    out.push(`Hours outside the comfort zone and every passive zone: ${pctTxt(pct(h.heat, N), "c-zones")} on the cold side, ${pctTxt(pct(h.cool, N), "c-zones")} on the warm or humid side.`);
    const nv = ctx.st.nv;
    out.push(`CBE Clima's natural ventilation filter (air ${nv.tMin} to ${nv.tMax} °C, dew point up to ${nv.dpMax} °C): ${n(fmt(R.nv) + " hours", "c-nv")}, ${pctTxt(pct(R.nv, N), "c-nv")} of the year.`);
    return out;
  };
  S.readings.water = function (ctx) {
    const { R, X, W } = ctx, out = [];
    if (!R.precOK) out.push(`The file has no precipitation (the field is empty or zero), so driving rain cannot be estimated.`);
    else {
      const wm = argmax(R.precM), dm = argmin(R.precM);
      let p = `Precipitation in the file: ${n(fmt(R.precTot) + " mm", "c-prec")} a year, wettest month ${C.MONTHS_LONG[wm]} (${n(fmt(R.precM[wm]) + " mm", "c-prec")}), driest ${C.MONTHS_LONG[dm]} (${n(fmt(R.precM[dm]) + " mm", "c-prec")}).`;
      if (R.precWinShare >= 45) p += ` ${n(fmt(R.precWinShare) + " %", "c-prec")} falls in the three winter months.`; else if (R.precSumShare >= 45) p += ` ${n(fmt(R.precSumShare) + " %", "c-prec")} falls in the three summer months.`;
      if (R.precDoubt) p += ` These values look doubtful: typical-year files often carry incomplete precipitation, assembled month by month from different years. The driving rain figures below inherit this.`;
      out.push(p);
      const r = X.rain, ks = Object.keys(r).sort((a, b) => r[b].annual - r[a].annual);
      out.push(`Wind-driven rain (ISO 15927-3 airfield index): most on the ${OR_NAMES[ks[0]]} façade, ${n(fmt(r[ks[0]].annual) + " l/m²", "c-rain")} a year; least on the ${OR_NAMES[ks[ks.length - 1]]} façade, ${n(fmt(r[ks[ks.length - 1]].annual) + " l/m²", "c-rain")}.`);
    }
    out.push(R.snowOK ? `Snow depth is recorded on ${n(fmt(R.snowDays) + " days", "c-snow")}; snow records in typical-year files are often sparse.` : `The file has no snow depth.`);
    return out;
  };
  const OR_NAMES = { N: "north", NE: "north-east", E: "east", SE: "south-east", S: "south", SW: "south-west", W: "west", NW: "north-west" };
  S.readings.outdoor = function (ctx) {
    const { R } = ctx, out = [], u = R.utci, P = (v) => pct(v, N);
    const strongCold = u.sunWind.cls.slice(0, 3).reduce((a, b) => a + b, 0), strongHeat = u.sunWind.cls.slice(7).reduce((a, b) => a + b, 0);
    out.push(`UTCI in the sun and wind, share of all hours: cold stress ${pctTxt(P(u.sunWind.cold), "c-utci-sw")}, no thermal stress ${pctTxt(P(u.sunWind.none), "c-utci-sw")}, heat stress ${pctTxt(P(u.sunWind.heat), "c-utci-sw")}. Strong or extreme stress: ${pctTxt(P(strongCold), "c-utciM")} cold, ${pctTxt(P(strongHeat), "c-utciM")} heat.`);
    const chg = (a, b, card) => (Math.round(P(a)) === Math.round(P(b)) ? `unchanged at ${pctTxt(P(b), card)}` : `${fmt(P(a))} % to ${pctTxt(P(b), card)}`);
    let t = `In shade, heat stress: ${chg(u.sunWind.heat, u.shadeWind.heat, "c-utci-hw")}.`;
    if (Math.max(u.sunWind.cold, u.shadeWind.cold) >= N / 200) t += ` Out of the wind, cold stress: ${chg(u.sunWind.cold, u.sunStill.cold, "c-utci-sn")} in the sun, ${chg(u.shadeWind.cold, u.shadeStill.cold, "c-utci-hn")} in shade.`;
    out.push(t);
    const dw = V.dwSun.get(ctx.W, ctx.X); let sw = 0, cw = 0, big = 0; for (let i = 0; i < N; i++) { const v = dw[i]; if (isFinite(v)) { sw += v; cw++; if (v <= -10) big++; } }
    out.push(`Against still air, wind ${sw < 0 ? "lowers" : "raises"} UTCI in the sun by ${n(fmt(Math.abs(sw / cw), 1) + " K", "c-dwind")} on average; it lowers it by 10 K or more in ${n(fmt(big) + " hours", "c-dwind")} (${pctTxt(pct(big, N), "c-dwind")}).`);
    const o = R.overcastMrt;
    if (o.hours) out.push(`On the ${n(fmt(o.hours) + " daytime hours", "c-dmrt")} with more than 80 % diffuse radiation, sunlight adds ${n(fmt(o.now, 1) + " K", "c-dmrt")} to the mean radiant temperature in the open on average. CBE Clima gives ${n(fmt(o.cbe, 1) + " K", "c-dmrt")} for the same hours because it took diffuse radiation as 0.2 × direct normal rather than the measured value.`);
    const lw = ctx.X.dlw; let sn = 0, cn = 0, mn = 0; for (let i = 0; i < N; i++) if (ctx.X.alt[i] <= 0) { sn += lw[i]; cn++; if (lw[i] < mn) mn = lw[i]; }
    out.push(`The colder sky takes ${n(fmt(-sn / cn, 1) + " K", "c-dlw")} off the mean radiant temperature at night on average, up to ${n(fmt(-mn, 1) + " K", "c-dlw")} on the clearest nights.${ctx.X.irMissing > N / 2 ? " The file has no sky infrared radiation; it was estimated from dew point and cloud cover." : ""}${ctx.X.utciHeld ? ` In ${ctx.X.utciHeld} hours the conditions lie outside the UTCI polynomial's range; they are counted with the inputs held at its edge.` : ""}`);
    return out;
  };
  S.readings.quality = function (ctx) {
    const { W } = ctx, m = W.meta, out = [];
    let p = `Data set: ${esc(m.source || "unnamed")}${m.wmo ? `, station ${esc(m.wmo)}` : ""}.`;
    if (ctx.period) p += ` A typical year built from ${esc(ctx.period)}.`;
    if (W.years.length > 1) p += ` Its months come from ${n(fmt(W.years.length) + " different years", "c-quality")}, so values can step at month boundaries.`;
    out.push(p);
    const core = ["dbt", "dpt", "rh", "p", "ghi", "dni", "dhi", "ws", "wd"], miss = core.filter((k) => W.missing[k] > 0);
    const absent = ["gil", "tsc", "prec", "snow", "alb"].filter((k) => W.missing[k] === N || !Array.from(W[k]).some((v) => v > 0));
    const lab = { gil: "illuminance", tsc: "sky cover", prec: "precipitation", snow: "snow depth", alb: "albedo" };
    out.push((miss.length ? `Missing hours in ${list(miss.map((k) => `${(V[k] || { label: k }).label.toLowerCase()} (${n(fmt(W.missing[k]), "c-quality")})`))}, filled by interpolation.` : `Temperature, humidity, pressure, radiation and wind have no missing hours.`) + (absent.length ? ` Empty or zero throughout: ${list(absent.map((k) => lab[k]))}.` : ""));
    for (const t of W.notes) out.push(esc(t));
    return out;
  };

  root.Sections = S;
})(this);
