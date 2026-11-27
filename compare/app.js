/* Clima Compare: page logic. Two weather files, A and B. Every climate figure comes from Macro Clima's own code
   (macro/core.js: processWeather; macro/sections.js: summarise, adaptive bands, zone outlines) and the shared modifiers
   (shared/climamods.js: prepWeather). This file only aligns the two files, subtracts and describes. */
(function () {
  "use strict";
  const C = window.Clima, K = window.K, S = window.Sections, Mods = window.ClimaMods, fmt = K.fmt, esc = K.esc, N = C.N;
  const $ = (id) => document.getElementById(id);
  const SIDES = ["A", "B"], COL = { A: "#2a78d6", B: "#eb6834" }, FILL = { A: "#2a78d6", B: "#eb6834" };
  const SAMPLES = [ // the files bundled with Macro Clima
    ["DEU_BE_Berlin-Tegel.AP.103820_TMYx.epw.txt", "Berlin-Tegel Airport, Germany"], ["GBR_ENG_London.Wea.Ctr-St.James.Park.037700_TMYx.epw.txt", "London St James's Park, UK"],
    ["ESP_MD_Madrid.WS.082200_TMYx.epw.txt", "Madrid, Spain"], ["ITA_LZ_Rome.162400_TMYx.epw.txt", "Rome, Italy"], ["RUS_MOS_Moscow-Bibirevo.276120_TMYx.epw.txt", "Moscow-Bibirevo, Russia"],
    ["EGY_QH_Cairo.Intl.AP.623660_TMYx.epw.txt", "Cairo International Airport, Egypt"], ["ARE_DU_Dubai.Intl.AP.411940_TMYx.epw.txt", "Dubai International Airport, UAE"],
    ["IND_MH_Mumbai-Shivaji.Intl.AP.430030_TMYx.epw.txt", "Mumbai Airport, India"], ["SGP_SG_Singapore-Changi.Intl.AP.486980_Custom.epw.txt", "Singapore Changi Airport"],
    ["CHN_SH_Shanghai-Hongqiao.Intl.AP.583670_TMYx.epw.txt", "Shanghai Hongqiao Airport, China"], ["MEX_CMX_Ciudad.Mexico.Central.766800_TMYx.epw.txt", "Mexico City Central, Mexico"]];
  const PRESETS = Mods.UHI_PRESETS;
  const newMod = () => ({ level: 0, ctx: "off", svf: 0.6, fveg: 0.2 });
  const st = { mods: { A: newMod(), B: newMod() }, season: false, adm: null, admTouched: false, hdd: 15, cdd: 18, nv: { tMin: 10, tMax: 24, dpMax: 16 }, cc: JSON.parse(JSON.stringify(C.CC_DEFAULT)), ui: {}, scaleOv: {} };
  const src = { A: null, B: null }, F = { A: null, B: null };
  let catalogue = null, catPromise = null;
  const ROSE_COLORS = [null].concat([1.25, 3, 5, 7, 9, 14].map((v) => K.ramps.wind(0.1 + 0.9 * v / 15))); // as in Macro Clima
  const sg = (v, d) => (!isFinite(v) ? "–" : (v > 0 && +fmt(Math.abs(v), d).replace(/,/g, "") !== 0 ? "+" : v < 0 && +fmt(Math.abs(v), d).replace(/,/g, "") !== 0 ? "−" : "±") + fmt(Math.abs(v), d));
  const tag = (k) => `<span class="k${k.toLowerCase()}">${k}</span>`;

  /* ---------------- station catalogue (Köppen-Geiger class and station title, as Macro Clima) ---------------- */
  function catalogueReady() {
    if (catalogue) return Promise.resolve(catalogue);
    if (!catPromise) catPromise = (async () => {
      try {
        const r = await fetch("../macro/data/stations.js"); const js = await r.text(); const b64 = js.slice(js.indexOf('"') + 1, js.lastIndexOf('"')); const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); let txt;
        try { txt = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text(); } catch (e) { txt = new TextDecoder().decode(window.fflate.gunzipSync(buf)); }
        catalogue = JSON.parse(txt);
      } catch (e) { console.warn("catalogue", e); catalogue = { sites: [] }; }
      return catalogue;
    })();
    return catPromise;
  }
  function matchSite(W, name) { // nearest catalogue site within 0.15°, as Macro Clima
    if (!catalogue) return null; const m = W.meta; let best = null, bd = 0.15 ** 2;
    for (const s of catalogue.sites) { const d = (s[0] - m.lat) ** 2 + (s[1] - m.lon) ** 2; if (d < bd) { bd = d; best = s; } }
    if (!best) return null;
    const f = best[5].find((x) => name && x[1].replace(/\.zip$/i, "").includes(name.replace(/\.epw$/i, "")));
    return { title: best[2], elev: best[3], kg: best[4], period: f ? f[2] : "" };
  }

  /* ---------------- loading ---------------- */
  const showErr = (k, m) => { const e = $("err" + k); e.textContent = m || ""; e.hidden = !m; };
  async function loadFile(k, file) {
    showErr(k, ""); $("info" + k).textContent = `Reading ${file.name}`;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      if (/\.zip$/i.test(file.name) || (buf[0] === 0x50 && buf[1] === 0x4b)) {
        const z = window.fflate.unzipSync(buf), n = Object.keys(z).find((x) => /\.epw$/i.test(x));
        if (!n) { showErr(k, "The ZIP holds no EPW file."); $("info" + k).textContent = ""; return; }
        await setSource(k, new TextDecoder("windows-1252").decode(z[n]), n.split("/").pop());
      } else await setSource(k, new TextDecoder("windows-1252").decode(buf), file.name);
    } catch (e) { showErr(k, "The file could not be read: " + e.message); $("info" + k).textContent = ""; }
  }
  async function loadSample(k, i) {
    const [url] = SAMPLES[i]; $("info" + k).textContent = "Loading the sample";
    const r = await fetch("../macro/data/epw/" + url); await setSource(k, await r.text(), url.replace(/\.txt$/, ""), SAMPLES[i][1]);
  }
  async function setSource(k, text, name, nice) {
    try { C.parseEPW(text, name); } catch (e) { showErr(k, e.message); $("info" + k).textContent = ""; return; }
    src[k] = { text, name, nice }; await catalogueReady(); processSide(k); refresh();
  }
  function processSide(k) {
    const s = src[k]; if (!s) { F[k] = null; return; }
    const t0 = performance.now();
    const W0 = C.parseEPW(s.text, s.name), m = st.mods[k], years = Mods.fileYears(s.name, W0.meta.comments);
    const P = Mods.prepWeather(W0, { level: m.level, uhi: m.ctx === "off" ? null : { svf: m.svf, fveg: m.fveg }, year: years.year, future: window.CLIMA_FUTURE, regions: window.CLIMA_REGIONS });
    const X = C.processWeather(P.W, { params: st.cc }), site = matchSite(P.W, s.name), meta = P.W.meta;
    const fromFile = [meta.city.replace(/[_.]+/g, " ").replace(/\s+/g, " ").trim(), meta.country].filter(Boolean).join(", ");
    const label = s.nice || fromFile || (site ? site.title.replace(/_/g, " ") : s.name);
    const f = { k, name: s.name, W0, W: P.W, X, fut: P.fut, uhi: P.uhi, years, site, label, kg: site ? site.kg : null };
    f.R = S.summarise(P.W, X, Object.assign({}, st, { siteTitle: site ? site.title : "" }));
    f.off = solarOffsets(meta); f.cache = new Map();
    F[k] = f;
    console.log("processed", k, Math.round(performance.now() - t0), "ms");
  }
  function resummarise() { for (const k of SIDES) if (F[k]) F[k].R = S.summarise(F[k].W, F[k].X, Object.assign({}, st, { siteTitle: F[k].site ? F[k].site.title : "" })); }

  /* ---------------- alignment: half-year shift and local solar time ---------------- */
  const SH = 182, SHH = SH * 24;
  // which file is shifted: the one south of the equator; with both on the same side, B
  function shifted() {
    if (!st.season || !F.A || !F.B) return null;
    const a = F.A.W.meta.lat < 0, b = F.B.W.meta.lat < 0;
    return a !== b ? (a ? "A" : "B") : "B";
  }
  const axisSide = () => (shifted() === "A" ? "B" : "A"); // the file whose calendar the month axis shows
  function rotH(a) { const o = new a.constructor(N); for (let i = 0; i < N; i++) o[i] = a[(i + N - SHH) % N]; return o; }
  function rotD(a) { const o = new a.constructor(a.length); const n = a.length; for (let d = 0; d < n; d++) o[d] = a[(d + n - SH) % n]; return o; }
  // hours from local standard time to apparent solar time, per day: equation of time plus the longitude correction (NOAA, as the shared sun position)
  function solarOffsets(m) { const o = new Float64Array(365); for (let d = 0; d < 365; d++) o[d] = (C.sunPosition(m.lat, m.lon, m.tz, d + 1, 12).eqTime + 4 * m.lon - 60 * m.tz) / 60; return o; }
  // value at the centre of each solar hour, interpolated linearly between the two neighbouring file hours (nearest for directions and flags)
  function toSolar(a, off, nearest) {
    const o = new Float32Array(N);
    for (let d = 0; d < 365; d++) for (let s = 0; s < 24; s++) {
      const gx = d * 24 + s - off[d]; // file hours are centred on h + 0.5; solar hour s is centred on s + 0.5
      if (nearest) { o[d * 24 + s] = a[((Math.round(gx) % N) + N) % N]; continue; }
      const k0 = Math.floor(gx), fr = gx - k0, a0 = a[((k0 % N) + N) % N], a1 = a[(((k0 + 1) % N) + N) % N];
      o[d * 24 + s] = isFinite(a0) && isFinite(a1) ? a0 + (a1 - a0) * fr : fr < 0.5 ? a0 : a1;
    }
    return o;
  }
  // views of a file's arrays: clock hours (h), days (d) and solar hours (sol), each shifted if this file is
  function view(f) {
    const sh = shifted() === f.k;
    const c = (key, fn) => { const kk = key + (sh ? "|s" : ""); if (!f.cache.has(kk)) f.cache.set(kk, fn()); return f.cache.get(kk); };
    return {
      f, sh,
      h: (a, key) => (sh ? (key ? c("h:" + key, () => rotH(a)) : rotH(a)) : a),
      d: (a) => (sh ? rotD(a) : a),
      sol: (a, key, nearest) => c("s:" + key, () => { const s0 = toSolar(a, f.off, nearest); return sh ? rotH(s0) : s0; })
    };
  }
  function shiftText() {
    const s = shifted(); if (!s) return "";
    const o = s === "A" ? "B" : "A";
    return `File ${s} is shown half a year (182 days) later, so its January appears under July and its July under January. Month labels follow the calendar of file ${o}.`;
  }
  // monthly helpers on a view
  const mMean = (a) => S.monthlyMean(a);
  const mSum = (a) => S.monthlySum(a);
  const mCount = (pred) => { const o = new Array(12).fill(0); for (let i = 0; i < N; i++) if (pred(i)) o[C.T.month[i] - 1]++; return o; };

  /* ---------------- relations between the two files ---------------- */
  const samePlace = () => F.A && F.B && Math.abs(F.A.W.meta.lat - F.B.W.meta.lat) < 0.05 && Math.abs(F.A.W.meta.lon - F.B.W.meta.lon) < 0.05;
  function identical() {
    if (!F.A || !F.B) return false;
    for (const key of ["dbt", "dpt", "ghi", "dni", "ws", "wd"]) { const a = F.A.W[key], b = F.B.W[key]; for (let i = 0; i < N; i++) if (a[i] !== b[i]) return false; }
    return true;
  }
  // a short name for the prose: the place without the station's suffixes ("Cairo International Airport, Egypt" gives "Cairo")
  const short = (f) => f.label.replace(/,.*$/, "").replace(/\s+(International|Intl|Airport|AP|Wea|WS|Ctr|Central)\b.*$/i, "").trim() || f.label;
  function modText(f) {
    const p = []; if (f.fut) p.push(`+${f.fut.level} °C`); if (f.uhi) { const m = st.mods[f.k]; p.push(`${m.ctx === "custom" ? "custom" : m.ctx} context`); }
    return p.length ? ` (${p.join(", ")})` : "";
  }
  const nameOf = (f) => `${short(f)}${modText(f)}`;

  /* ---------------- shared scales and tables ---------------- */
  function rangeOf(arrs, pad) { let lo = Infinity, hi = -Infinity; for (const a of arrs) for (let i = 0; i < a.length; i++) { const v = a[i]; if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } } if (!isFinite(lo)) { lo = 0; hi = 1; } if (pad) { const p = (hi - lo) * pad || 1; lo -= p; hi += p; } return [lo, hi]; }
  function pctAbs(arr, p) { const b = []; for (let i = 0; i < arr.length; i++) if (isFinite(arr[i])) b.push(Math.abs(arr[i])); b.sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * p))] : 1; }
  const legendHtml = (items) => `<div class="legend">${items.map(([c, t, dash]) => `<span><i style="background:${c}${dash ? ";opacity:.5" : ""}"></i>${esc(t)}</span>`).join("")}</div>`;
  const abLegend = (extra) => legendHtml([[COL.A, "A: " + nameOf(F.A)], [COL.B, "B: " + nameOf(F.B)]].concat(extra || []));
  // a table of figures: rows [label, a, b, unit, dec, diffUnit, card]; the last column is B − A
  function cmpTable(rows, opt) {
    opt = opt || {};
    const head = `<tr><th>${esc(opt.first || "Figure")}</th><th class="r ca">A</th><th class="r cb">B</th><th class="r">B − A</th></tr>`;
    const body = rows.map((r) => {
      if (r.sep) return `<tr><td colspan="4" style="padding-top:10px"><b>${esc(r.sep)}</b></td></tr>`;
      if (r.text) return `<tr><td>${esc(r.label)}</td><td>${esc(r.a)}</td><td>${esc(r.b)}</td><td></td></tr>`;
      const [label, a, b, unit, dec, du] = r, d = b - a, u = unit ? " " + unit : "";
      return `<tr><td>${esc(label)}</td><td class="r">${fmt(a, dec)}${esc(u)}</td><td class="r">${fmt(b, dec)}${esc(u)}</td><td class="r d">${sg(d, dec)}${du ? " " + esc(du) : esc(u)}</td></tr>`;
    }).join("");
    return `<div style="overflow-x:auto"><table class="t cmp">${head}${body}</table></div>`;
  }
  const csvTable = (rows) => ["figure,A,B,B - A,unit"].concat(rows.filter((r) => !r.sep).map((r) => (r.text ? `"${r.label}","${r.a}","${r.b}",,` : `"${r[0]}",${isFinite(r[1]) ? (+r[1]).toFixed(3) : ""},${isFinite(r[2]) ? (+r[2]).toFixed(3) : ""},${isFinite(r[2] - r[1]) ? (r[2] - r[1]).toFixed(3) : ""},"${r[5] || r[3] || ""}"`))).join("\n");
  function monthlyTable(series, unit, dec) { // series: [{name, vals, color}]
    return `<div style="overflow-x:auto"><table class="t"><tr><th></th>${C.MONTHS.map((m) => `<th class="r">${m}</th>`).join("")}</tr>${series.map((s) => `<tr><td style="white-space:nowrap"><span class="swatch" style="background:${s.color}"></span> ${esc(s.name)}</td>${s.vals.map((v) => `<td class="r">${s.diff ? sg(v, dec) : fmt(v, dec)}</td>`).join("")}</tr>`).join("")}</table></div><p class="note">${esc(unit)}${shifted() ? ". " + esc(shiftText()) : ""}</p>`;
  }
  const monthlyCsv = (series, unit) => [["month"].concat(series.map((s) => `${s.name} (${unit})`)).join(",")].concat(C.MONTHS.map((m, k) => [m].concat(series.map((s) => (isFinite(s.vals[k]) ? (+s.vals[k]).toFixed(3) : ""))).join(","))).join("\n");
  const hourName = (i, solar) => { const d = Math.floor(i / 24), h = i % 24; return `${S.dateOf ? S.dateOf(d) : d + 1}, ${String(h).padStart(2, "0")}:00 to ${String(h + 1).padStart(2, "0")}:00${solar ? " solar time" : ""}`; };

  /* ---------------- charts that hold two files ---------------- */
  // twelve monthly average days, both files in each panel, solar time
  function profiles2(a, b, unit, dec) {
    const narrow = (K.curW || 760) < 480, cols = narrow ? 4 : 12, nrow = 12 / cols, W = narrow ? K.curW : 760, x0 = 40, gap = 4, h = narrow ? 120 : 170, rowH = h + 34, H = 16 + nrow * rowH, pw = (W - x0 - 8 - gap * (cols - 1)) / cols;
    const stat = (vals) => { const out = []; for (let m = 0; m < 12; m++) { const mn = new Array(24).fill(0), cnt = new Array(24).fill(0), mi = new Array(24).fill(Infinity), ma = new Array(24).fill(-Infinity); for (let d = C.MSTART[m]; d < C.MSTART[m] + C.MDAYS[m]; d++) for (let hr = 0; hr < 24; hr++) { const v = vals[d * 24 + hr]; if (!isFinite(v)) continue; mn[hr] += v; cnt[hr]++; mi[hr] = Math.min(mi[hr], v); ma[hr] = Math.max(ma[hr], v); } out.push({ mean: mn.map((s, k) => (cnt[k] ? s / cnt[k] : NaN)), min: mi.map((v) => (isFinite(v) ? v : NaN)), max: ma.map((v) => (isFinite(v) ? v : NaN)) }); } return out; };
    const SA = stat(a), SB = stat(b);
    let [lo, hi] = rangeOf(SA.concat(SB).flatMap((s) => [s.min, s.max]), 0.05);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Average day of each month, A and B">`;
    for (let r = 0; r < nrow; r++) s += K.axisY(x0, 16 + r * rowH, h, lo, hi, K.niceTicks(lo, hi, narrow ? 4 : 5), unit, W - x0 - 8);
    for (let m = 0; m < 12; m++) {
      const y0 = 16 + Math.floor(m / cols) * rowH, Y = (v) => y0 + h - h * (v - lo) / (hi - lo), px = x0 + (m % cols) * (pw + gap), X = (k) => px + pw * (k + 0.5) / 24;
      s += `<rect x="${px}" y="${y0}" width="${pw}" height="${h}" fill="none" stroke="var(--soft)"/>`;
      for (const [st0, col] of [[SA[m], COL.A], [SB[m], COL.B]]) {
        let band = "", line = "", pen = false;
        for (let k = 0; k < 24; k++) band += (k ? "L" : "M") + X(k).toFixed(1) + "," + Y(isFinite(st0.max[k]) ? st0.max[k] : lo).toFixed(1);
        for (let k = 23; k >= 0; k--) band += "L" + X(k).toFixed(1) + "," + Y(isFinite(st0.min[k]) ? st0.min[k] : lo).toFixed(1);
        for (let k = 0; k < 24; k++) { if (!isFinite(st0.mean[k])) { pen = false; continue; } line += (pen ? "L" : "M") + X(k).toFixed(1) + "," + Y(st0.mean[k]).toFixed(1); pen = true; }
        if (st0.mean.some(isFinite)) s += `<path d="${band}Z" fill="${col}" fill-opacity="0.13"/><path d="${line}" fill="none" stroke="${col}" stroke-width="2"/>`;
      }
      s += `<text x="${px + pw / 2}" y="${y0 + h + 15}" text-anchor="middle">${C.MONTHS[m]}</text>`;
      const hid = K.hover((lx) => { const k = Math.max(0, Math.min(23, Math.floor((lx - px) / pw * 24))); return `<b>${C.MONTHS_LONG[m]}, ${String(k).padStart(2, "0")}:00 to ${String(k + 1).padStart(2, "0")}:00 solar time</b><br>A: mean ${fmt(SA[m].mean[k], dec)} ${unit}, range ${fmt(SA[m].min[k], dec)} to ${fmt(SA[m].max[k], dec)}<br>B: mean ${fmt(SB[m].mean[k], dec)} ${unit}, range ${fmt(SB[m].min[k], dec)} to ${fmt(SB[m].max[k], dec)}<br>B − A: ${sg(SB[m].mean[k] - SA[m].mean[k], dec)} ${dUnit(unit)}`; });
      s += `<rect x="${px}" y="${y0}" width="${pw}" height="${h}" fill="transparent" data-hov="${hid}"/>`;
    }
    return { svg: s + `</svg>`, SA, SB };
  }
  const dUnit = (u) => (u === "°C" ? "K" : u);
  const PW = () => Math.min(520, K.curW || 520); // width of a chart in a pair: half a wide card, or the phone
  // A, B on one colour scale, then the difference B − A on a diverging scale
  function carpets3(key, va, vb) {
    const V = S.V[key], dec = V.dec, unit = V.unit, du = dUnit(unit);
    let [lo, hi] = rangeOf([va, vb]); const t = K.niceTicks(lo, hi, 5); lo = Math.min(lo, t[0]); hi = Math.max(hi, t[t.length - 1]);
    const ov = st.scaleOv["cv:" + key]; if (ov) { lo = ov.lo; hi = ov.hi; }
    const sc = K.scale({ ramp: V.sc.ramp, lo, hi, key: "cv:" + key });
    const d = new Float32Array(N); for (let i = 0; i < N; i++) d[i] = vb[i] - va[i];
    let m = pctAbs(d, 0.98); m = Math.max(m, 1e-6); const tm = K.niceTicks(0, m, 3); m = tm[tm.length - 1] || m;
    const ovd = st.scaleOv["cd:" + key]; const sd = K.scale({ ramp: "delta", lo: ovd ? ovd.lo : -m, hi: ovd ? ovd.hi : m, key: "cd:" + key });
    const isU = V.utci, colA = (v) => (isU ? K.UTCI_COLORS[C.utciClass(v)] : sc.color(v));
    const tip = (i) => `<b>${hourName(i, true)}</b><br>A: ${fmt(va[i], dec)} ${unit}<br>B: ${fmt(vb[i], dec)} ${unit}<br>B − A: ${sg(d[i], dec)} ${du}`;
    const one = (vals, label, colorOf, scale, u) => K.carpet({ vals, scale: isU && scale === sc ? null : scale, unit: u, label, colorOf, tip, legend: isU && scale === sc ? K.UTCI_COLORS.map((c, k) => [c, C.UTCI_CLASSES[k][2]]) : null });
    const html = `<div class="stack"><div><h4>${tag("A")} ${esc(nameOf(F.A))}</h4>${one(va, "A", colA, sc, unit)}</div><div><h4>${tag("B")} ${esc(nameOf(F.B))}</h4>${one(vb, "B", colA, sc, unit)}</div><div><h4>B − A, ${esc(du)}</h4>${one(d, "B minus A", (v) => sd.color(v), sd, du)}</div></div>`;
    return { html, d };
  }

  /* ---------------- sections and cards ---------------- */
  const VAR_KEYS = ["dbt", "dpt", "rh", "w", "twb", "ghi", "dni", "dhi", "tsc", "ws", "mrt", "utci_sw", "utci_hn", "surfS", "surfE", "surfW", "surfN"];
  const varSel = (keys, def) => ({ k: "v", label: "Variable", options: keys.map((k) => [k, S.V[k].label]), def });
  const SEASON_OPTS = [["year", "Whole year"], ["Winter", "Winter of each file"], ["Spring", "Spring of each file"], ["Summer", "Summer of each file"], ["Autumn", "Autumn of each file"]];
  const UTCI_OPTS = [["sunWind", "In the sun and in the wind"], ["sunStill", "In the sun, out of the wind"], ["shadeWind", "In shade and in the wind"], ["shadeStill", "In shade, out of the wind"]];
  const SECTIONS = [
    { id: "summary", title: "The two climates", reading: true, cards: [
      { id: "c-glance", title: "At a glance", sub: "Key figures of each file, and the difference B − A", wide: true, render: glanceCard },
      { id: "c-extremes", title: "Extremes and events", sub: "Days in the year, and the hottest and coldest week", render: extremesCard },
      { id: "c-files", title: "The two files", sub: "Where each comes from", render: filesCard }] },
    { id: "temperature", title: "Temperature and humidity", cards: [
      { id: "c-daily", title: "Daily temperature through the year", sub: "Daily range and mean of each file, with the adaptive comfort band", wide: true, tools: [{ k: "b", label: "Comfort band", options: [["both", "Comfort band of both"], ["A", "Comfort band of A"], ["B", "Comfort band of B"], ["none", "No comfort band"]], def: "both" }], render: dailyCard },
      { id: "c-monthT", title: "Monthly temperature", sub: "Mean daily maximum, mean and mean daily minimum", wide: true, render: monthTCard },
      { id: "c-profiles", title: "Average day of each month", sub: "Mean and range at each solar hour", wide: true, tools: [varSel(["dbt", "rh", "dpt", "w", "ghi", "ws", "utci_sw"], "dbt")], render: profilesCard },
      { id: "c-carpet", title: "Hour by hour", sub: "Each column a day, each row a solar hour; A and B on one scale, then B − A", wide: true, tools: [varSel(VAR_KEYS, "dbt")], render: carpetCard },
      { id: "c-humid", title: "Humidity by month", sub: "Mean dew point, and hours with the dew point above 18 °C", wide: true, render: humidCard },
      { id: "c-dd", title: "Degree days by month", sub: "Heating and cooling, from daily means", wide: true, render: ddCard }] },
    { id: "sun", title: "Sun and light", cards: [
      { id: "c-sunpath", title: "Sun path", sub: "Every daylight hour of the year, coloured by air temperature on one scale", wide: true, render: sunpathCard },
      { id: "c-orient", title: "Irradiation by orientation", sub: "Vertical façades and the roof, kWh/m²", wide: true, tools: [{ k: "p", label: "Period", options: [["year", "Whole year"], ["summer", "Summer of each file"], ["winter", "Winter of each file"]], def: "year" }], render: orientCard },
      { id: "c-rad", title: "Daily solar radiation on the horizontal", sub: "Monthly mean of the daily sum, global and diffuse", wide: true, render: radCard },
      { id: "c-sky", title: "Sky condition by month", sub: "Hours by total sky cover", wide: true, tools: [{ k: "h", label: "Hours", options: [["day", "Daylight hours only"], ["all", "All hours"]], def: "day" }], render: skyCard },
      { id: "c-lux", title: "Daylight", sub: "Hours above outdoor illuminance thresholds", render: luxCard },
      { id: "c-pv", title: "PV potential", sub: "Yield per kWp, best fixed plane and façades", render: pvCard }] },
    { id: "wind", title: "Wind and water", cards: [
      { id: "c-rose", title: "Wind roses", sub: "Share of hours by direction and speed, on one scale", wide: true, tools: [{ k: "s", label: "Season", options: SEASON_OPTS, def: "year" }], render: roseCard },
      { id: "c-wind", title: "Wind speed by month", sub: "Mean of all hours", wide: true, render: windCard },
      { id: "c-prec", title: "Precipitation by month", sub: "Liquid precipitation, mm", wide: true, render: precCard },
      { id: "c-rain", title: "Driving rain by orientation", sub: "Rain carried onto vertical walls by the wind, ISO 15927-3 airfield index", render: rainCard }] },
    { id: "comfort", title: "Comfort and strategies", cards: [
      { id: "c-psy", title: "Psychrometric chart", sub: "Every hour of both files, with the comfort zone", wide: true, tools: [{ k: "z", label: "Zones", options: [["comfort", "Comfort zone"], ["none", "No zones"], ["all", "All strategy zones"]], def: "comfort" }], render: psyCard },
      { id: "c-zones", title: "Hours in each strategy zone", sub: "Givoni-Milne zones with the Climate Consultant criteria", wide: true, render: zonesCard },
      { id: "c-adapt", title: "Adaptive comfort", sub: "Outdoor air against the indoor comfort band of the chosen model", render: adaptCard },
      { id: "c-nv", title: "Natural ventilation hours", sub: "Air 10 to 24 °C with dew point up to 16 °C", render: nvCard },
      { id: "c-utci", title: "Outdoor thermal stress by month", sub: "UTCI stress classes, hours", wide: true, tools: [{ k: "s", label: "Condition", options: UTCI_OPTS, def: "sunWind" }], render: utciCard }] },
    { id: "data", title: "Data", cards: [
      { id: "c-quality", title: "Data quality", sub: "Fields, gaps and years of each file", wide: true, render: qualityCard }] }];
  const GROUPS = [["Overview", ["summary"]], ["Temperature", ["temperature"]], ["Sun and light", ["sun"]], ["Wind and water", ["wind"]], ["Comfort and strategies", ["comfort"]], ["Data", ["data"]]];
  const CARD = {}; SECTIONS.forEach((s) => s.cards.forEach((c) => (CARD[c.id] = c)));

  /* ---------------- cards ---------------- */
  function glanceCard() {
    const A = F.A, B = F.B, RA = A.R, RB = B.R, adm = st.adm;
    const mean = (a) => { let s = 0, n = 0; for (let i = 0; i < a.length; i++) if (isFinite(a[i])) { s += a[i]; n++; } return n ? s / n : NaN; };
    const warm = (R) => Math.max(...R.mMean), cold = (R) => Math.min(...R.mMean);
    const kg = (f) => (f.kg ? `${f.kg}, ${S.KOPPEN[f.kg] || ""}` : "not found");
    const rows = [
      { sep: "Place" },
      { text: 1, label: "File", a: A.label, b: B.label },
      { text: 1, label: "Köppen-Geiger class", a: kg(A), b: kg(B) },
      ["Latitude", A.W.meta.lat, B.W.meta.lat, "°", 2],
      ["Elevation", A.W.meta.elev, B.W.meta.elev, "m", 0],
      { sep: "Temperature" },
      ["Annual mean", RA.mean, RB.mean, "°C", 1, "K"],
      ["Warmest month, mean", warm(RA), warm(RB), "°C", 1, "K"],
      ["Coldest month, mean", cold(RA), cold(RB), "°C", 1, "K"],
      ["Warm end, 99th percentile", RA.p99, RB.p99, "°C", 1, "K"],
      ["Cold end, 1st percentile", RA.p01, RB.p01, "°C", 1, "K"],
      ["Mean daily swing", RA.ex.meanSwing, RB.ex.meanSwing, "K", 1],
      ["Summer, mean daily maximum", RA.sumMax, RB.sumMax, "°C", 1, "K"],
      ["Summer, mean daily minimum", RA.sumMin, RB.sumMin, "°C", 1, "K"],
      ["Winter, mean daily maximum", RA.winMax, RB.winMax, "°C", 1, "K"],
      ["Winter, mean daily minimum", RA.winMin, RB.winMin, "°C", 1, "K"],
      ["Summer nights below 18 °C, share of days", RA.summerNightsBelow18, RB.summerNightsBelow18, "%", 0, "% points"],
      { sep: "Humidity" },
      ["Mean dew point", mean(A.W.dpt), mean(B.W.dpt), "°C", 1, "K"],
      ["Hours with dew point above 18 °C", RA.dp18, RB.dp18, "h", 0],
      { sep: "Sun" },
      ["Solar radiation on the horizontal", RA.ghi, RB.ghi, "kWh/m²", 0],
      ["Diffuse share", RA.diffShare, RB.diffShare, "%", 0, "% points"],
      ["Hours of direct sun (above 120 W/m²)", RA.sunshine, RB.sunshine, "h", 0],
      ["PV yield, best fixed plane", A.X.pv.map.best.annual, B.X.pv.map.best.annual, "kWh/kWp", 0],
      { sep: "Heating, cooling, comfort" },
      [`Heating degree days, base ${fmt(st.hdd, 1)} °C`, RA.hdd.annual, RB.hdd.annual, "Kd", 0],
      [`Cooling degree days, base ${fmt(st.cdd, 1)} °C`, RA.cdd.annual, RB.cdd.annual, "Kd", 0],
      [`Hours above the comfort band (${S.ADAPT_LABEL[adm]})`, RA.adapt[adm].above, RB.adapt[adm].above, "h", 0],
      [`Hours below the comfort band`, RA.adapt[adm].below, RB.adapt[adm].below, "h", 0],
      ["Natural ventilation hours", RA.nv, RB.nv, "h", 0],
      ["Outdoor heat stress, sun and wind (UTCI above 26 °C)", RA.utci.sunWind.heat, RB.utci.sunWind.heat, "h", 0],
      ["Outdoor cold stress, sun and wind (UTCI below 9 °C)", RA.utci.sunWind.cold, RB.utci.sunWind.cold, "h", 0],
      { sep: "Wind and water" },
      ["Mean wind speed", mean(A.W.ws), mean(B.W.ws), "m/s", 1],
      ["Precipitation", RA.precOK ? RA.precTot : NaN, RB.precOK ? RB.precTot : NaN, "mm", 0]];
    return { html: cmpTable(rows) + (st.season ? "" : "") + `<p class="note">Summer and winter are each file's own: June to August north of the equator, December to February south of it, and the other way round for winter. Annual figures do not change with the season shift.</p>`, csv: () => csvTable(rows) };
  }
  function extremesCard() {
    const a = F.A.R.ex, b = F.B.R.ex, rows = [
      ["Summer days (maximum 25 °C or more)", a.summerDays, b.summerDays, "d", 0], ["Hot days (maximum 30 °C or more)", a.hotDays, b.hotDays, "d", 0], ["Very hot days (maximum 35 °C or more)", a.veryHotDays, b.veryHotDays, "d", 0],
      ["Tropical nights (minimum 20 °C or more)", a.tropicalNights, b.tropicalNights, "d", 0], ["Frost days (minimum below 0 °C)", a.frostDays, b.frostDays, "d", 0], ["Ice days (maximum below 0 °C)", a.iceDays, b.iceDays, "d", 0],
      ["Overcast days", a.overcastDays, b.overcastDays, "d", 0], ["Highest hourly temperature", a.tMax.v, b.tMax.v, "°C", 1, "K"], ["Lowest hourly temperature", a.tMin.v, b.tMin.v, "°C", 1, "K"],
      ["Hottest week, mean", a.hottestWeek.mean, b.hottestWeek.mean, "°C", 1, "K"], ["Coldest week, mean", a.coldestWeek.mean, b.coldestWeek.mean, "°C", 1, "K"]];
    return { html: cmpTable(rows) + `<p class="note">Counted as in Macro Clima. Overcast: daytime sky cover of 8 tenths or more, or a daily clearness index below 0.3 where the file holds no sky cover.</p>`, csv: () => csvTable(rows) };
  }
  function filesCard() {
    const per = (f) => (f.years.known ? `${f.years.from} to ${f.years.to}` : "not stated (taken to centre on 2010)");
    const tz = (m) => `UTC${m.tz >= 0 ? "+" : "−"}${fmt(Math.abs(m.tz), m.tz % 1 ? 1 : 0)}`;
    const coord = (m) => `${fmt(Math.abs(m.lat), 3)}° ${m.lat >= 0 ? "N" : "S"}, ${fmt(Math.abs(m.lon), 3)}° ${m.lon >= 0 ? "E" : "W"}`;
    const mod = (f) => [f.fut ? `+${f.fut.level} °C global warming, IPCC region ${Mods.regName(f.fut.region)}` : "", f.uhi ? `urban heat island, sky view factor ${st.mods[f.k].svf.toFixed(2)}, vegetation ${st.mods[f.k].fveg.toFixed(2)}` : ""].filter(Boolean).join("; ") || "none, as recorded";
    const rows = [["File name", F.A.name, F.B.name], ["Place", F.A.label, F.B.label], ["Coordinates", coord(F.A.W.meta), coord(F.B.W.meta)], ["Time zone", tz(F.A.W.meta), tz(F.B.W.meta)], ["Data set", F.A.W.meta.source || "–", F.B.W.meta.source || "–"], ["Years of the data", per(F.A), per(F.B)], ["Changes applied here", mod(F.A), mod(F.B)]];
    const notes = [];
    if ((F.A.W.meta.source || "") !== (F.B.W.meta.source || "")) notes.push("The two files come from different data sets, which can account for part of the difference.");
    if (F.A.years.known && F.B.years.known && (F.A.years.from !== F.B.years.from || F.A.years.to !== F.B.years.to)) notes.push(`The files cover different years (${per(F.A)} and ${per(F.B)}).`);
    if (samePlace()) notes.push("Both files describe the same place.");
    return { html: `<table class="t"><tr><th></th><th class="ca">A</th><th class="cb">B</th></tr>${rows.map(([l, a, b]) => `<tr><th>${esc(l)}</th><td style="word-break:break-word">${esc(a)}</td><td style="word-break:break-word">${esc(b)}</td></tr>`).join("")}</table>${notes.length ? `<p class="note">${notes.map(esc).join(" ")}</p>` : ""}`, csv: () => ["item,A,B"].concat(rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, "'")}"`).join(","))).join("\n") };
  }
  function dailyCard(u) {
    const va = view(F.A), vb = view(F.B), dA = F.A.X.daily, dB = F.B.X.daily;
    const A = { mn: va.d(dA.min), mx: va.d(dA.max), me: va.d(dA.mean) }, B = { mn: vb.d(dB.min), mx: vb.d(dB.max), me: vb.d(dB.mean) };
    const series = [{ vals: A.me, color: COL.A, width: 1.6 }, { vals: B.me, color: COL.B, width: 1.6 }];
    const bands = {}; for (const [k, v] of [["A", va], ["B", vb]]) if (u.b === "both" || u.b === k) { const bd = S.adaptiveBand(F[k].X, st.adm); bands[k] = { lo: v.d(bd.lo), hi: v.d(bd.hi) }; series.push({ vals: bands[k].lo, color: COL[k], width: 1, dash: "5 3" }, { vals: bands[k].hi, color: COL[k], width: 1, dash: "5 3" }); }
    const html = K.lines({ series, areas: [{ lo: A.mn, hi: A.mx, fill: FILL.A, opacity: 0.18 }, { lo: B.mn, hi: B.mx, fill: FILL.B, opacity: 0.18 }], unit: "°C", height: 300, label: "Daily temperature, A and B",
      tip: (d) => `<b>${S.dateOf(d)}</b><br>A: ${fmt(A.mn[d], 1)} to ${fmt(A.mx[d], 1)} °C, mean ${fmt(A.me[d], 1)}${bands.A ? `<br>&nbsp;&nbsp;comfort band ${fmt(bands.A.lo[d], 1)} to ${fmt(bands.A.hi[d], 1)} °C` : ""}<br>B: ${fmt(B.mn[d], 1)} to ${fmt(B.mx[d], 1)} °C, mean ${fmt(B.me[d], 1)}${bands.B ? `<br>&nbsp;&nbsp;comfort band ${fmt(bands.B.lo[d], 1)} to ${fmt(bands.B.hi[d], 1)} °C` : ""}<br>Mean, B − A: ${sg(B.me[d] - A.me[d], 1)} K` });
    return { html: html + abLegend(u.b !== "none" ? [["var(--mute)", `Dashed: adaptive comfort band, ${S.ADAPT_LABEL[st.adm]}`, 1]] : []) + (shifted() ? `<p class="note">${esc(shiftText())}</p>` : ""),
      csv: () => ["day,A min (C),A mean (C),A max (C),B min (C),B mean (C),B max (C)"].concat(Array.from({ length: 365 }, (_, d) => [d + 1, A.mn[d], A.me[d], A.mx[d], B.mn[d], B.me[d], B.mx[d]].map((x, j) => (j ? (+x).toFixed(2) : x)).join(","))).join("\n") };
  }
  function monthStats(f, v) { // mean daily max, mean, mean daily min by month, on the view
    const dmx = v.d(f.X.daily.max), dmn = v.d(f.X.daily.min), mean = mMean(v.h(f.W.dbt, "dbt")), mx = [], mn = [];
    for (let m = 0; m < 12; m++) { let a = 0, b = 0; for (let d = C.MSTART[m]; d < C.MSTART[m] + C.MDAYS[m]; d++) { a += dmx[d]; b += dmn[d]; } mx.push(a / C.MDAYS[m]); mn.push(b / C.MDAYS[m]); }
    return { mx, mean, mn };
  }
  function monthTCard() {
    const a = monthStats(F.A, view(F.A)), b = monthStats(F.B, view(F.B));
    const series = [{ vals: a.mx, color: COL.A, dash: "4 3", width: 1.5 }, { vals: a.mean, color: COL.A }, { vals: a.mn, color: COL.A, dash: "4 3", width: 1.5 }, { vals: b.mx, color: COL.B, dash: "4 3", width: 1.5 }, { vals: b.mean, color: COL.B }, { vals: b.mn, color: COL.B, dash: "4 3", width: 1.5 }];
    const tab = [{ name: "A, mean", vals: a.mean, color: COL.A }, { name: "B, mean", vals: b.mean, color: COL.B }, { name: "B − A, mean", vals: b.mean.map((x, k) => x - a.mean[k]), color: "var(--mute)", diff: true }, { name: "A, mean daily maximum", vals: a.mx, color: COL.A }, { name: "B, mean daily maximum", vals: b.mx, color: COL.B }, { name: "A, mean daily minimum", vals: a.mn, color: COL.A }, { name: "B, mean daily minimum", vals: b.mn, color: COL.B }];
    return { html: K.lines({ n: 12, series, unit: "°C", height: 260, dots: true, xName: (i) => C.MONTHS_LONG[i], label: "Monthly temperature" }) + abLegend([["var(--mute)", "Dashed: mean daily maximum and minimum", 1]]) + monthlyTable(tab, "°C; differences in K", 1), csv: () => monthlyCsv(tab, "C") };
  }
  function profilesCard(u) {
    const V = S.V[u.v], key = u.v, nearest = V.sc.ramp === "dir";
    const a = view(F.A).sol(V.get(F.A.W, F.A.X), key, nearest), b = view(F.B).sol(V.get(F.B.W, F.B.X), key, nearest);
    const p = profiles2(a, b, V.unit, V.dec);
    return { html: p.svg + abLegend([["var(--mute)", "Band: lowest to highest value at that hour in the month", 1]]) + `<p class="note">Hours in local apparent solar time: 12:00 is when the sun is highest, in both files.${shifted() ? " " + esc(shiftText()) : ""}</p>`,
      csv: () => { const r = ["month,solar hour,A mean,B mean,A min,A max,B min,B max (" + V.unit + ")"]; for (let m = 0; m < 12; m++) for (let h = 0; h < 24; h++) r.push([C.MONTHS[m], h, p.SA[m].mean[h], p.SB[m].mean[h], p.SA[m].min[h], p.SA[m].max[h], p.SB[m].min[h], p.SB[m].max[h]].map((x, j) => (j > 1 ? (isFinite(x) ? (+x).toFixed(3) : "") : x)).join(",")); return r.join("\n"); } };
  }
  function carpetCard(u) {
    const V = S.V[u.v], key = u.v, nearest = V.sc.ramp === "dir";
    if (S.missingVar(key, { W: F.A.W, X: F.A.X }) || S.missingVar(key, { W: F.B.W, X: F.B.X })) return { html: `<p class="note">One of the files holds no values for this variable.</p>` };
    const a = view(F.A).sol(V.get(F.A.W, F.A.X), key, nearest), b = view(F.B).sol(V.get(F.B.W, F.B.X), key, nearest);
    const r = carpets3(key, a, b);
    return { html: r.html + `<p class="note">Rows are hours of local apparent solar time, so noon is the sun's highest point in both files. Values are interpolated between the two neighbouring file hours. Click a colour bar to set its range.${shifted() ? " " + esc(shiftText()) : ""}</p>`,
      csv: () => ["day,solar hour,A,B,B - A (" + V.unit + ")"].concat(Array.from({ length: N }, (_, i) => `${Math.floor(i / 24) + 1},${i % 24},${(+a[i]).toFixed(3)},${(+b[i]).toFixed(3)},${(+r.d[i]).toFixed(3)}`)).join("\n") };
  }
  function humidCard() {
    const va = view(F.A), vb = view(F.B), dA = mMean(va.h(F.A.W.dpt, "dpt")), dB = mMean(vb.h(F.B.W.dpt, "dpt"));
    const pa = va.h(F.A.W.dpt, "dpt"), pb = vb.h(F.B.W.dpt, "dpt"), hA = mCount((i) => pa[i] > 18), hB = mCount((i) => pb[i] > 18);
    const ser = [{ name: "A", color: COL.A, vals: hA }, { name: "B", color: COL.B, vals: hB }];
    const tab = [{ name: "A, mean dew point", vals: dA, color: COL.A }, { name: "B, mean dew point", vals: dB, color: COL.B }, { name: "B − A", vals: dB.map((x, k) => x - dA[k]), color: "var(--mute)", diff: true }];
    return { html: `<div class="pair"><div><h4>Mean dew point, °C</h4>${K.lines({ n: 12, series: [{ vals: dA, color: COL.A }, { vals: dB, color: COL.B }], unit: "°C", height: 230, dots: true, xName: (i) => C.MONTHS_LONG[i], W: PW(), label: "Mean dew point" })}</div><div><h4>Hours with dew point above 18 °C</h4>${K.bars({ series: ser, unit: "h", height: 230, W: PW(), label: "Humid hours" })}</div></div>` + abLegend() + monthlyTable(tab, "Dew point in °C, difference in K. Above a dew point of about 18 °C the air feels humid and sweat evaporates slowly", 1),
      csv: () => monthlyCsv([{ name: "A mean dew point (C)", vals: dA }, { name: "B mean dew point (C)", vals: dB }, { name: "A hours dew point above 18 C", vals: hA }, { name: "B hours dew point above 18 C", vals: hB }], "") };
  }
  function ddCard() {
    const va = view(F.A), vb = view(F.B), hA = C.degreeDays(va.d(F.A.X.daily.mean), st.hdd, "heat"), hB = C.degreeDays(vb.d(F.B.X.daily.mean), st.hdd, "heat"), cA = C.degreeDays(va.d(F.A.X.daily.mean), st.cdd, "cool"), cB = C.degreeDays(vb.d(F.B.X.daily.mean), st.cdd, "cool");
    const ser = [{ name: `A, heating (base ${fmt(st.hdd, 1)} °C)`, color: COL.A, vals: hA.monthly }, { name: `B, heating`, color: COL.B, vals: hB.monthly }, { name: `A, cooling (base ${fmt(st.cdd, 1)} °C)`, color: "#8fb9ea", vals: cA.monthly }, { name: "B, cooling", color: "#f5b28f", vals: cB.monthly }];
    const rows = [["Heating degree days", hA.annual, hB.annual, "Kd", 0], ["Cooling degree days", cA.annual, cB.annual, "Kd", 0]];
    return { html: K.bars({ series: ser, unit: "Kd", height: 260, label: "Degree days by month" }) + legendHtml(ser.map((s) => [s.color, s.name])) + cmpTable(rows) + (shifted() ? `<p class="note">${esc(shiftText())}</p>` : ""), csv: () => monthlyCsv(ser, "Kd") };
  }
  function sunpathCard() {
    const pts = { A: [], B: [] }; let [lo, hi] = rangeOf([F.A.W.dbt, F.B.W.dbt]); const t = K.niceTicks(lo, hi, 5); lo = t[0]; hi = t[t.length - 1];
    const ov = st.scaleOv["sp"]; if (ov) { lo = ov.lo; hi = ov.hi; }
    const sc = K.scale({ ramp: "temp", lo, hi, key: "sp" });
    const one = (f) => { const X = f.X, W = f.W, p = []; for (let i = 0; i < N; i++) if (X.alt[i] > 0) p.push({ i, alt: X.alt[i], az: X.az[i], c: sc.color(W.dbt[i]) || "#8b9592" }); return K.sunPath({ lat: W.meta.lat, lines: C.sunPathLines(W.meta.lat, W.meta.lon, W.meta.tz), points: p, scale: sc, unit: "°C", label: "Sun path " + f.k, tip: (i) => `<b>${f.k}: ${S.hourOf(i)}</b><br>altitude ${fmt(X.alt[i], 1)}°, azimuth ${fmt(X.az[i], 1)}°<br>air ${fmt(W.dbt[i], 1)} °C` }); };
    return { html: `<div class="pair"><div><h4>${tag("A")} ${esc(nameOf(F.A))}, ${fmt(Math.abs(F.A.W.meta.lat), 1)}° ${F.A.W.meta.lat >= 0 ? "N" : "S"}</h4>${one(F.A)}</div><div><h4>${tag("B")} ${esc(nameOf(F.B))}, ${fmt(Math.abs(F.B.W.meta.lat), 1)}° ${F.B.W.meta.lat >= 0 ? "N" : "S"}</h4>${one(F.B)}</div></div><p class="note">Equidistant view, north at the top. Arcs are the 21st of each month; the figure-of-eight lines trace one clock hour across the year. One colour scale for both; click the colour bar to set it.</p>`,
      csv: () => ["file,hour of year,solar altitude (deg),solar azimuth (deg),air (C)"].concat(SIDES.flatMap((k) => Array.from({ length: N }, (_, i) => i).filter((i) => F[k].X.alt[i] > 0).map((i) => `${k},${i + 1},${F[k].X.alt[i].toFixed(2)},${F[k].X.az[i].toFixed(2)},${F[k].W.dbt[i].toFixed(1)}`))).join("\n") };
  }
  function orientCard(u) {
    const keys = C.ORIENT.map((o) => o[0]).concat(["Roof"]);
    const per = (f) => { const s = f.X.surf, lat = f.W.meta.lat, sm = lat >= 0 ? [5, 6, 7] : [11, 0, 1], wm = lat >= 0 ? [11, 0, 1] : [5, 6, 7]; return keys.map((k) => (u.p === "year" ? s[k].annual : (u.p === "summer" ? sm : wm).reduce((a, m) => a + s[k].monthly[m], 0))); };
    const a = per(F.A), b = per(F.B), ser = [{ name: "A", color: COL.A, vals: a }, { name: "B", color: COL.B, vals: b }];
    const rows = keys.map((k, i) => [k === "Roof" ? "Roof, horizontal" : `${k} façade`, a[i], b[i], "kWh/m²", 0]);
    const pl = { year: "over the year", summer: "over each file's three summer months", winter: "over each file's three winter months" }[u.p];
    return { html: K.bars({ cats: keys, series: ser, unit: "kWh/m²", height: 260, label: "Irradiation by orientation" }) + abLegend() + cmpTable(rows, { first: "Surface" }) + `<p class="note">Irradiation ${pl}: direct, diffuse (Perez 1990) and reflected from the ground, without surroundings. Orientations are by compass. South of the equator the equator-facing façade is the north one.</p>`, csv: () => csvTable(rows) };
  }
  function radCard() {
    const va = view(F.A), vb = view(F.B), g = (f, v, key) => mSum(v.h(f.W[key], key)).map((x, k) => x / 1000 / C.MDAYS[k]);
    const gA = g(F.A, va, "ghi"), gB = g(F.B, vb, "ghi"), dA = g(F.A, va, "dhi"), dB = g(F.B, vb, "dhi");
    const series = [{ vals: gA, color: COL.A }, { vals: gB, color: COL.B }, { vals: dA, color: COL.A, dash: "4 3", width: 1.5 }, { vals: dB, color: COL.B, dash: "4 3", width: 1.5 }];
    const tab = [{ name: "A, global", vals: gA, color: COL.A }, { name: "B, global", vals: gB, color: COL.B }, { name: "B − A, global", vals: gB.map((x, k) => x - gA[k]), color: "var(--mute)", diff: true }, { name: "A, diffuse", vals: dA, color: COL.A }, { name: "B, diffuse", vals: dB, color: COL.B }];
    return { html: K.lines({ n: 12, series, unit: "kWh/m²", height: 250, dots: true, lo: 0, xName: (i) => C.MONTHS_LONG[i], label: "Daily solar radiation" }) + abLegend([["var(--mute)", "Dashed: diffuse", 1]]) + monthlyTable(tab, "kWh/m² per day", 2), csv: () => monthlyCsv(tab, "kWh/m2 per day") };
  }
  function skyCard(u) {
    const day = u.h === "day", out = [];
    const one = (f) => { const v = view(f), tsc = v.h(f.W.tsc, "tsc"), alt = v.h(f.X.alt, "alt"), ok = Array.from(f.W.tsc).some((x) => x > 0) && !(f.W.missing && f.W.missing.tsc >= N * 0.5); if (!ok) return null; const c = [0, 1, 2].map(() => new Array(12).fill(0)); for (let i = 0; i < N; i++) { if (day && !(alt[i] > 0)) continue; const x = tsc[i]; if (!isFinite(x)) continue; c[x <= 2 ? 0 : x <= 7 ? 1 : 2][C.T.month[i] - 1]++; } return c; };
    const cA = one(F.A), cB = one(F.B), names = ["Clear, 0 to 2 tenths", "Partly cloudy, 3 to 7 tenths", "Overcast, 8 to 10 tenths"], cols = ["#08306b", "#7ec9f3", "#b9c2c0"];
    const top = (c) => (c ? Math.max(...C.MONTHS.map((_, m) => c[0][m] + c[1][m] + c[2][m])) : 0), hi = Math.max(top(cA), top(cB)) * 1.08 || 1; // one scale for both
    const chart = (c) => (c ? K.bars({ series: names.map((n, k) => ({ name: n, color: cols[k], vals: c[k] })), stacked: true, unit: "h", height: 220, W: PW(), hi }) : `<p class="note">This file holds no sky cover.</p>`);
    const share = (c, k) => (c ? 100 * c[k].reduce((x, y) => x + y, 0) / Math.max(1, c.flat().reduce((x, y) => x + y, 0)) : NaN);
    const rows = names.map((n, k) => [n, share(cA, k), share(cB, k), "%", 0, "% points"]);
    return { html: `<div class="pair"><div><h4>${tag("A")} ${esc(nameOf(F.A))}</h4>${chart(cA)}</div><div><h4>${tag("B")} ${esc(nameOf(F.B))}</h4>${chart(cB)}</div></div>` + legendHtml(names.map((n, k) => [cols[k], n])) + cmpTable(rows, { first: day ? "Share of daylight hours" : "Share of all hours" }) + (shifted() ? `<p class="note">${esc(shiftText())}</p>` : ""), csv: () => csvTable(rows) };
  }
  function luxCard() {
    const a = F.A.R, b = F.B.R;
    if (!a.illumOK || !b.illumOK) return { html: `<p class="note">${!a.illumOK && !b.illumOK ? "Neither file holds" : !a.illumOK ? "File A does not hold" : "File B does not hold"} global horizontal illuminance.</p>` };
    const rows = [["Daylight hours (sun above the horizon)", a.dayHours, b.dayHours, "h", 0]].concat(a.lux.map((x, k) => [`Hours above ${fmt(x.t / 1000)} klx`, x.hours, b.lux[k].hours, "h", 0]));
    return { html: cmpTable(rows) + `<p class="note">Global horizontal illuminance as recorded or modelled in each file. 10 klx is a bright overcast sky; 50 klx is sunshine.</p>`, csv: () => csvTable(rows) };
  }
  function pvCard() {
    const pa = F.A.X.pv, pb = F.B.X.pv, rows = [["Best fixed plane", pa.map.best.annual, pb.map.best.annual, "kWh/kWp", 0], ["Best tilt", pa.map.best.tilt, pb.map.best.tilt, "°", 0], ["Flat, horizontal", pa.planes.flat.annual, pb.planes.flat.annual, "kWh/kWp", 0]].concat(["S", "E", "W", "N"].map((o) => [`Vertical, ${o} façade`, pa.planes[o].annual, pb.planes[o].annual, "kWh/kWp", 0]));
    const az = (x) => `${fmt(x.az)}° (${S.compass(x.az)})`;
    return { html: cmpTable(rows) + `<p class="note">Best orientation: ${esc(az(pa.map.best))} for A, ${esc(az(pb.map.best))} for B. Yield per kWp after reflection, heat and system losses, with the fixed assumptions of Macro Clima (PVWatts).</p>`, csv: () => csvTable(rows) };
  }
  function roseCard(u) {
    const ro = (f) => (u.s === "year" ? f.R.rose : f.R.seasons[u.s]), ra = ro(F.A), rb = ro(F.B);
    let pmax = 0; for (const r of [ra, rb]) { let mx = 0; for (const c of r.counts) mx = Math.max(mx, c.reduce((a, b) => a + b, 0)); pmax = Math.max(pmax, Math.ceil(100 * mx / (r.total || 1) / 2) * 2); }
    const one = (r, k) => K.rose({ rose: r, colors: ROSE_COLORS, r: 120, pmax, label: "Wind rose " + k });
    const lg = legendHtml(ROSE_COLORS.slice(1).map((c, k) => [c, K.binName(k + 1)]));
    const rows = [["Mean wind speed", ra.mean, rb.mean, "m/s", 1], ["Calm hours (below 0.5 m/s)", 100 * ra.calm / (ra.total || 1), 100 * rb.calm / (rb.total || 1), "%", 0, "% points"]];
    return { html: `<div class="pair"><div style="max-width:420px;margin:auto;width:100%"><h4>${tag("A")} ${esc(nameOf(F.A))}</h4>${one(ra, "A")}</div><div style="max-width:420px;margin:auto;width:100%"><h4>${tag("B")} ${esc(nameOf(F.B))}</h4>${one(rb, "B")}</div></div>${lg}${cmpTable(rows)}<p class="note">Both roses on the same radial scale. ${u.s === "year" ? "" : "Seasons are each file's own, so summer is the warm season in both. "}Directions are where the wind comes from.</p>`,
      csv: () => { const r = ["file,direction," + ROSE_COLORS.slice(1).map((_, k) => K.binName(k + 1)).join(",") + ",calm hours,total hours"]; for (const [k, x] of [["A", ra], ["B", rb]]) x.counts.forEach((c, s) => r.push([k, K.dirName(s * x.step)].concat(c.slice(1)).concat([s ? "" : x.calm, s ? "" : x.total]).join(","))); return r.join("\n"); } };
  }
  function windCard() {
    const wA = mMean(view(F.A).h(F.A.W.ws, "ws")), wB = mMean(view(F.B).h(F.B.W.ws, "ws"));
    const tab = [{ name: "A", vals: wA, color: COL.A }, { name: "B", vals: wB, color: COL.B }, { name: "B − A", vals: wB.map((x, k) => x - wA[k]), color: "var(--mute)", diff: true }];
    return { html: K.lines({ n: 12, series: [{ vals: wA, color: COL.A }, { vals: wB, color: COL.B }], unit: "m/s", height: 230, dots: true, lo: 0, xName: (i) => C.MONTHS_LONG[i], label: "Wind speed by month" }) + abLegend() + monthlyTable(tab, "m/s, at the station, usually 10 m above open ground", 1), csv: () => monthlyCsv(tab, "m/s") };
  }
  function precCard() {
    const ok = { A: F.A.R.precOK, B: F.B.R.precOK };
    if (!ok.A && !ok.B) return { html: `<p class="note">Neither file holds precipitation.</p>` };
    const pA = ok.A ? mSum(view(F.A).h(F.A.W.prec, "prec")) : new Array(12).fill(NaN), pB = ok.B ? mSum(view(F.B).h(F.B.W.prec, "prec")) : new Array(12).fill(NaN);
    const ser = [{ name: "A", color: COL.A, vals: pA }, { name: "B", color: COL.B, vals: pB }];
    const doubt = SIDES.filter((k) => F[k].R.precDoubt).map((k) => `File ${k}'s precipitation looks implausible (too little in total, too few wet hours or an odd monthly pattern); typical-year files often carry rain poorly.`);
    return { html: K.bars({ series: ser, unit: "mm", height: 240, label: "Precipitation by month" }) + abLegend() + cmpTable([["Precipitation in the year", F.A.R.precOK ? F.A.R.precTot : NaN, F.B.R.precOK ? F.B.R.precTot : NaN, "mm", 0], ["Wet hours (above 0.1 mm)", F.A.R.wetHours, F.B.R.wetHours, "h", 0]]) + (doubt.length || !ok.A || !ok.B || shifted() ? `<p class="note">${[!ok.A ? "File A holds no precipitation." : "", !ok.B ? "File B holds no precipitation." : ""].concat(doubt, [shifted() ? shiftText() : ""]).filter(Boolean).map(esc).join(" ")}</p>` : ""), csv: () => monthlyCsv(ser, "mm") };
  }
  function rainCard() {
    if (!F.A.R.precOK || !F.B.R.precOK) return { html: `<p class="note">Driving rain needs precipitation in both files.</p>` };
    const keys = C.ORIENT.map((o) => o[0]), a = keys.map((k) => F.A.X.rain[k].annual), b = keys.map((k) => F.B.X.rain[k].annual);
    const rows = keys.map((k, i) => [`${k} wall`, a[i], b[i], "l/m²", 0]);
    return { html: K.bars({ cats: keys, series: [{ name: "A", color: COL.A, vals: a }, { name: "B", color: COL.B, vals: b }], unit: "l/m²", height: 220, label: "Driving rain" }) + abLegend() + cmpTable(rows, { first: "Wall facing" }) + `<p class="note">Annual airfield index, l/m² a year, for walls facing each direction, from hours with both rain and wind towards the wall.</p>`, csv: () => csvTable(rows) };
  }
  function psyCard(u) {
    const p = 101325, Wd = 760, H = 470, x0 = 48, y0 = 14, w = 640, h = 410, tLo = -15, tHi = 45, wHi = 30;
    const Xp = (t) => x0 + w * (t - tLo) / (tHi - tLo), Yp = (wg) => y0 + h - h * wg / wHi, wsat = (t) => 1000 * C.humRatio(C.pws(t), p);
    let clip = `M${Xp(tLo)},${Yp(0)}`; for (let t = tLo; t <= tHi; t += 0.5) clip += `L${Xp(t).toFixed(1)},${Yp(Math.min(wHi, wsat(t))).toFixed(1)}`; clip += `L${Xp(tHi)},${Yp(0)}Z`;
    // point clouds on a canvas: A first, B on top, each hour a dot
    const cv = document.createElement("canvas"); cv.width = w * 2; cv.height = h * 2; const g = cv.getContext("2d");
    g.globalAlpha = 0.2;
    for (let i = 0; i < N; i++) for (const k of (i % 2 ? ["B", "A"] : SIDES)) { const f = F[k], t = f.W.dbt[i], wv = f.X.w[i] * 1000; if (!(t >= tLo && t <= tHi && wv >= 0 && wv <= wHi)) continue; g.fillStyle = COL[k]; g.beginPath(); g.arc((Xp(t) - x0) * 2, (Yp(wv) - y0) * 2, 2.2, 0, 7); g.fill(); }
    let s = `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Psychrometric chart, A and B"><defs><clipPath id="psyclipc"><path d="${clip}"/></clipPath></defs>`;
    s += `<image href="${cv.toDataURL("image/png")}" x="${x0}" y="${y0}" width="${w}" height="${h}" clip-path="url(#psyclipc)"/>`;
    for (const rh of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) { let d = ""; for (let t = tLo; t <= tHi; t += 0.5) { const wv = 1000 * C.humRatio(C.pws(t) * rh / 100, p); if (wv > wHi) break; d += (d ? "L" : "M") + Xp(t).toFixed(1) + "," + Yp(wv).toFixed(1); } s += `<path d="${d}" fill="none" stroke="${rh === 100 ? "var(--ink)" : "var(--line)"}" stroke-width="${rh === 100 ? 1.5 : 1}"/>`; const tl = rh === 100 ? 30 : 40, wl = 1000 * C.humRatio(C.pws(tl) * rh / 100, p); if (wl < wHi - 0.5 && rh % 20 === 0) s += `<text x="${Xp(tl) + 2}" y="${Yp(wl) - 2}" font-size="9">${rh}%</text>`; }
    s += `<g class="ax"><line x1="${x0}" x2="${x0 + w}" y1="${y0 + h}" y2="${y0 + h}"/>`; for (const [t, lab] of K.U.ticks(tLo, tHi, 12, "°C")) { if (t < tLo - 1e-6 || t > tHi + 1e-6) continue; s += `<line x1="${Xp(t)}" x2="${Xp(t)}" y1="${y0 + h}" y2="${y0 + h + 4}"/><text x="${Xp(t)}" y="${y0 + h + 16}" text-anchor="middle">${fmt(lab)}</text>`; } s += `<text x="${x0 + w}" y="${y0 + h + 32}" text-anchor="end">dry bulb temperature, °C</text>`;
    s += `<line x1="${x0 + w}" x2="${x0 + w}" y1="${y0}" y2="${y0 + h}"/>`; for (const [wv, lab] of K.U.ticks(0, wHi, 6, "g/kg")) { if (wv < -1e-6 || wv > wHi + 1e-6) continue; s += `<line x1="${x0 + w}" x2="${x0 + w + 4}" y1="${Yp(wv)}" y2="${Yp(wv)}"/><text x="${x0 + w + 7}" y="${Yp(wv) + 3.5}">${fmt(lab)}</text>`; } s += `<text x="${x0 + w - 4}" y="${y0 + 10}" text-anchor="end">humidity ratio, g/kg</text></g>`;
    const Z = F.A.X.zones, show = u.z === "none" ? [] : u.z === "all" ? C.CC_KEYS.map((k) => k[0]) : ["comfort"];
    for (const z of S.zoneOutlines(Z, Z.params, show)) s += `<path d="${z.d}" fill="${u.z === "comfort" ? "none" : z.col}" fill-opacity="0.05" stroke="${u.z === "comfort" ? "var(--ink)" : z.col}" stroke-width="2" clip-path="url(#psyclipc)" data-tip="${esc(`${z.name}: A ${fmt(F.A.X.zones.hours[z.k])} h, B ${fmt(F.B.X.zones.hours[z.k])} h`)}"/><text x="${z.lx}" y="${z.ly}" font-size="10" font-weight="600" style="fill:${u.z === "comfort" ? "var(--ink)" : z.col}">${esc(z.short)}</text>`;
    s += `</svg>`;
    return { html: s + abLegend() + `<p class="note">Each dot is one hour. Where the two clouds overlap, the climates share conditions. The zones use the same criteria for both files (Climate Consultant, as in Macro Clima).</p>`, csv: () => ["file,hour of year,dry bulb (C),humidity ratio (g/kg)"].concat(SIDES.flatMap((k) => Array.from({ length: N }, (_, i) => `${k},${i + 1},${F[k].W.dbt[i].toFixed(1)},${(F[k].X.w[i] * 1000).toFixed(2)}`))).join("\n") };
  }
  function zonesCard() {
    const za = F.A.X.zones.hours, zb = F.B.X.zones.hours;
    const rows = C.CC_KEYS.map(([k, l]) => [l, za[k], zb[k], "h", 0]);
    const fam = (k) => { const x = S.CC_FAMILY[k]; return x >= 0 ? S.FAMILIES[x][2] : "#5b6663"; };
    const html = `<div style="overflow-x:auto"><table class="t cmp"><tr><th>Zone</th><th class="r ca">A, h</th><th class="r cb">B, h</th><th class="r">B − A, h</th><th class="r ca">A, share</th><th class="r cb">B, share</th></tr>${C.CC_KEYS.map(([k, l]) => `<tr><td><span class="swatch" style="background:${fam(k)}"></span> ${esc(l)}</td><td class="r">${fmt(za[k])}</td><td class="r">${fmt(zb[k])}</td><td class="r d">${sg(zb[k] - za[k], 0)}</td><td class="r">${fmt(100 * za[k] / N, 1)} %</td><td class="r">${fmt(100 * zb[k] / N, 1)} %</td></tr>`).join("")}</table></div><p class="note">Hours of the year in which each strategy could keep indoor conditions comfortable on its own, with the criteria of Climate Consultant 6 as in Macro Clima. Zones overlap, so their hours do not add up.</p>`;
    return { html, csv: () => csvTable(rows) };
  }
  function adaptCard() {
    const key = st.adm, a = F.A.R.adapt[key], b = F.B.R.adapt[key];
    const rows = [["Inside the band", a.ins, b.ins, "h", 0], ["Above the band", a.above, b.above, "h", 0], ["Below the band", a.below, b.below, "h", 0], ["Days outside the range the standard covers", a.outDays, b.outDays, "d", 0]];
    return { html: cmpTable(rows) + `<p class="note">${esc(S.ADAPT_LABEL[key])}. Outdoor air temperature hour by hour against the band of indoor operative temperatures that occupants of free-running buildings accept. It shows how often outdoor air alone lies in the comfortable range; a building shifts and damps it.</p>`, csv: () => csvTable(rows) };
  }
  function nvCard() {
    const mA = view(F.A).h(F.A.R.nvMask), mB = view(F.B).h(F.B.R.nvMask), a = mCount((i) => mA[i]), b = mCount((i) => mB[i]);
    const ser = [{ name: "A", color: COL.A, vals: a }, { name: "B", color: COL.B, vals: b }];
    return { html: K.bars({ series: ser, unit: "h", height: 220, label: "Natural ventilation hours" }) + abLegend() + cmpTable([["Natural ventilation hours", F.A.R.nv, F.B.R.nv, "h", 0]]) + (shifted() ? `<p class="note">${esc(shiftText())}</p>` : ""), csv: () => monthlyCsv(ser, "h") };
  }
  function utciCard(u) {
    const one = (f) => { const a = view(f).h(f.X.utci[u.s], "utci:" + u.s), M = Array.from({ length: 12 }, () => new Array(10).fill(0)); for (let i = 0; i < N; i++) { const c = C.utciClass(a[i]); if (c >= 0) M[C.T.month[i] - 1][c]++; } return M; };
    const MA = one(F.A), MB = one(F.B);
    const hi = Math.max(...MA.concat(MB).map((x) => x.reduce((a, b) => a + b, 0))) * 1.08 || 1; // one scale for both
    const chart = (M) => K.bars({ series: K.UTCI_COLORS.map((c, k) => ({ name: C.UTCI_CLASSES[k][2], color: c, vals: M.map((x) => x[k]) })), stacked: true, unit: "h", height: 230, W: PW(), hi });
    const ra = F.A.R.utci[u.s], rb = F.B.R.utci[u.s], rows = [["Heat stress (UTCI above 26 °C)", ra.heat, rb.heat, "h", 0], ["No thermal stress (9 to 26 °C)", ra.none, rb.none, "h", 0], ["Cold stress (UTCI below 9 °C)", ra.cold, rb.cold, "h", 0]];
    return { html: `<div class="pair"><div><h4>${tag("A")} ${esc(nameOf(F.A))}</h4>${chart(MA)}</div><div><h4>${tag("B")} ${esc(nameOf(F.B))}</h4>${chart(MB)}</div></div>` + legendHtml(K.UTCI_COLORS.map((c, k) => [c, C.UTCI_CLASSES[k][2]])) + cmpTable(rows) + (shifted() ? `<p class="note">${esc(shiftText())}</p>` : ""), csv: () => csvTable(rows) };
  }
  function qualityCard() {
    const one = (f) => { const W = f.W, miss = C.FIELDS.map((x) => x[1]).filter((k) => (W.missing[k] || 0) > 0); return [["Data set", W.meta.source || "–"], ["WMO station", W.meta.wmo || "–"], ["Years used", W.years.slice(0, 12).map(([y, c]) => `${y} (${Math.round(c / 24)} d)`).join(", ") || "–"], ["Fields with gaps", miss.length ? miss.map((k) => `${k} (${W.missing[k] === N ? "not in the file" : W.missing[k] + " h"})`).join(", ") : "none"], ["Notes from reading", (W.notes || []).join(" ") || "none"]]; };
    const a = one(F.A), b = one(F.B);
    return { html: `<table class="t"><tr><th></th><th class="ca">A</th><th class="cb">B</th></tr>${a.map(([l, x], i) => `<tr><th>${esc(l)}</th><td style="word-break:break-word">${esc(x)}</td><td style="word-break:break-word">${esc(b[i][1])}</td></tr>`).join("")}</table><p class="note">Field keys as in Macro Clima's data quality card. The CSV holds the main hourly variables of both files, in clock time, with the half-year shift applied if it is on.</p>`,
      csv: () => { const va = view(F.A), vb = view(F.B), cols = [["dry bulb (C)", "dbt"], ["dew point (C)", "dpt"], ["relative humidity (%)", "rh"], ["global horizontal (W/m2)", "ghi"], ["direct normal (W/m2)", "dni"], ["diffuse horizontal (W/m2)", "dhi"], ["wind speed (m/s)", "ws"], ["wind direction (deg)", "wd"]]; const A = cols.map(([, k]) => va.h(F.A.W[k], k)), B = cols.map(([, k]) => vb.h(F.B.W[k], k)); const r = ["month,day,hour (interval ending)," + cols.map(([n]) => "A " + n).concat(cols.map(([n]) => "B " + n)).join(",")]; for (let i = 0; i < N; i++) r.push([C.T.month[i], C.T.day[i], C.T.hour[i] + 1].concat(A.map((x) => (+x[i]).toFixed(1)), B.map((x) => (+x[i]).toFixed(1))).join(",")); return r.join("\n"); } };
  }

  /* ---------------- the reading of the differences ---------------- */
  // every number links to the card it comes from
  const n = (txt, card, set) => `<span class="n" data-card="${card}"${set ? ` data-set="${set}"` : ""}>${txt}</span>`;
  const K1 = (v) => `${fmt(Math.abs(v), 1)} K`;
  const list = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
  const STRAT = [["natVent", "natural ventilation"], ["massNight", "thermal mass with night flushing"], ["mass", "thermal mass"], ["fan", "fan-forced ventilation"], ["evap", "direct evaporative cooling"], ["solarLow", "passive solar gain"], ["internal", "internal heat gains"], ["shade", "sun shading of windows"]];
  function readingParas() {
    const A = F.A, B = F.B, RA = A.R, RB = B.R, same = samePlace(), nA = same ? "file A" : esc(short(A)), nB = same ? "file B" : esc(short(B)), NB = same ? "File B" : nB, out = [];
    if (identical()) return [`The two files hold the same weather, hour by hour, so every difference below is zero. Load another file, or set a future climate or an urban context for one of them.`];
    const ab = (a, b, card, set) => `(${tag("A")} ${n(a, card, set)}, ${tag("B")} ${n(b, card, set)})`;
    // 1. overall
    const dMean = RB.mean - RA.mean, rel = (RB.ghi - RA.ghi) / RA.ghi * 100, p1 = [];
    if (same) p1.push(`Both files describe ${esc(A.label)}.`);
    else if (A.kg && B.kg) p1.push(A.kg === B.kg ? `${nB} and ${nA} share a Köppen-Geiger class, ${A.kg}: ${esc(S.KOPPEN[A.kg] || "")}.` : `${nB} has a ${esc(S.KOPPEN[B.kg] || B.kg)} climate (${B.kg}), ${nA} a ${esc(S.KOPPEN[A.kg] || A.kg)} one (${A.kg}).`);
    p1.push(Math.abs(dMean) < 0.05 ? `Over the year both have a mean temperature of ${n(fmt(RA.mean, 1) + " °C", "c-glance")}.` : `Over the year ${nB} is ${n(K1(dMean), "c-glance")} ${dMean > 0 ? "warmer" : "cooler"} ${ab(fmt(RA.mean, 1) + " °C", fmt(RB.mean, 1) + " °C", "c-glance")}.`);
    p1.push(`The warm end, the temperature only one hour in a hundred exceeds, moves from ${n(fmt(RA.p99, 1) + " °C", "c-glance")} to ${n(fmt(RB.p99, 1) + " °C", "c-glance")}; the cold end from ${n(fmt(RA.p01, 1) + " °C", "c-glance")} to ${n(fmt(RB.p01, 1) + " °C", "c-glance")}.`);
    p1.push(Math.abs(rel) < 3 ? `Solar radiation on the horizontal is about the same ${ab(fmt(RA.ghi) + " kWh/m²", fmt(RB.ghi) + " kWh/m²", "c-glance")}.` : `${NB} receives ${fmt(Math.abs(rel))} % ${rel > 0 ? "more" : "less"} solar radiation on the horizontal ${ab(fmt(RA.ghi) + " kWh/m²", fmt(RB.ghi) + " kWh/m²", "c-glance")}.`);
    p1.push(`The dew point lies above 18 °C, where air feels humid, for ${n(fmt(RB.dp18) + " h", "c-glance")} a year in ${nB} and ${n(fmt(RA.dp18) + " h", "c-glance")} in ${nA}.`);
    out.push(p1.join(" "));
    // 2. the main design problem of B, against A
    const kind = (R) => { const hd = R.hdd.annual, cd = R.cdd.annual, sh = hd / Math.max(1, hd + cd); return sh > 0.75 ? "heat" : sh < 0.25 ? "cool" : "mixed"; };
    const KIND = { heat: "dominated by heating", cool: "dominated by cooling", mixed: "split between a heating and a cooling season" };
    const kA = kind(RA), kB = kind(RB), dd = (R) => `${n(fmt(R.hdd.annual) + " Kd", "c-dd")} of heating, ${n(fmt(R.cdd.annual) + " Kd", "c-dd")} of cooling`, p2 = [];
    p2.push(kA === kB ? `Both are ${KIND[kA]}: ${nB} with ${dd(RB)}, ${nA} with ${dd(RA)}.` : `${NB} is ${KIND[kB]}, with ${dd(RB)}; ${nA} is ${KIND[kA]}, with ${dd(RA)}.`);
    const evB = B.X.zones.hours.evap;
    if (kB === "cool") {
      if (RB.dp18 > 1500 && evB < 300) p2.push(`The heat in ${nB} is humid, so evaporation cools little; air movement and dehumidification matter more.`);
      else if (RB.dp18 < 300 && RB.cdd.annual > 300) p2.push(`The heat in ${nB} is dry, so evaporation and night-time cooling can carry much of it.`);
      else if (RB.dp18 > 500) p2.push(`Part of the heat in ${nB} is humid, in the hours with a dew point above 18 °C.`);
    }
    const ON = { N: "north", NE: "north-east", E: "east", SE: "south-east", S: "south", SW: "south-west", W: "west", NW: "north-west" };
    const most = (f) => { const s = f.X.surf, lat = f.W.meta.lat, ms = lat >= 0 ? [5, 6, 7] : [11, 0, 1]; let bk = null, bv = -1; for (const [o] of C.ORIENT) { const v = ms.reduce((a, m) => a + s[o].monthly[m], 0); if (v > bv) { bv = v; bk = o; } } return [bk, bv]; };
    const [sA, vA] = most(A), [sB, vB] = most(B);
    p2.push(sA === sB ? `In summer the ${ON[sB]} façade receives the most sun in both ${ab(fmt(vA) + " kWh/m²", fmt(vB) + " kWh/m²", "c-orient", "p=summer")} over the three summer months.` : `In summer the most sun falls on the ${ON[sB]} façade in ${nB} (${n(fmt(vB) + " kWh/m²", "c-orient", "p=summer")} over the three summer months) and on the ${ON[sA]} façade in ${nA} (${n(fmt(vA) + " kWh/m²", "c-orient", "p=summer")}).`);
    const eq = (f) => { const s = f.X.surf, lat = f.W.meta.lat, o = lat >= 0 ? "S" : "N", ms = lat >= 0 ? [11, 0, 1] : [5, 6, 7]; return ms.reduce((a, m) => a + s[o].monthly[m], 0); };
    if (kA !== "cool" || kB !== "cool") p2.push(`In winter the façade facing the equator receives ${n(fmt(eq(B)) + " kWh/m²", "c-orient", "p=winter")} in ${nB} and ${n(fmt(eq(A)) + " kWh/m²", "c-orient", "p=winter")} in ${nA}.`);
    out.push(p2.join(" "));
    // 3. which passive strategies carry over
    const za = A.X.zones.hours, zb = B.X.zones.hours, MIN = 500, keep = [], less = [], more = [];
    for (const [k, l] of STRAT) { const a = za[k], b = zb[k]; if (a < MIN && b < MIN) continue; const t = `${l} ${ab(fmt(a) + " h", fmt(b) + " h", "c-zones")}`; if (a >= MIN && b >= 0.7 * a && b <= 1.6 * a) keep.push(t); else if (a >= MIN && b < 0.7 * a) less.push(t); else more.push(t); }
    const p3 = [], parts = [], v = (a, one, many) => (a.length === 1 ? one : many), where = () => (parts.length ? "there" : `in ${nB}`);
    if (keep.length) parts.push(`${list(keep)} ${v(keep, "keeps its", "keep their")} weight ${where()}`);
    if (less.length) parts.push(`${list(less)} ${v(less, "covers", "cover")} far fewer hours ${where()}`);
    if (more.length) parts.push(`${list(more)} ${v(more, "matters", "matter")} more ${where()} than in ${nA}`);
    if (parts.length) { const t = parts.join("; "); p3.push(`Counted by the hours in which each alone keeps a room comfortable, ${t}.`); }
    else p3.push(`No passive strategy reaches ${fmt(MIN)} hours a year in either file.`);
    p3.push(`In summer, nights cool below 18 °C on ${n(fmt(RB.summerNightsBelow18) + " %", "c-glance")} of days in ${nB}, against ${n(fmt(RA.summerNightsBelow18) + " %", "c-glance")} in ${nA}.`);
    if (RA.summerNightsBelow18 >= 60 && RB.summerNightsBelow18 < 30) p3.push(`Night-time cooling, available on most summer nights in ${nA}, is rarely available in ${nB}.`);
    else if (RB.summerNightsBelow18 >= 60 && RA.summerNightsBelow18 < 30) p3.push(`Night-time cooling, rarely available in ${nA}, is available on most summer nights in ${nB}.`);
    p3.push(`Outdoors, in the sun and in the wind, heat stress lasts ${n(fmt(RB.utci.sunWind.heat) + " h", "c-utci", "s=sunWind")} a year in ${nB} and ${n(fmt(RA.utci.sunWind.heat) + " h", "c-utci", "s=sunWind")} in ${nA}.`);
    out.push(p3.join(" "));
    // 4. when the two are closest and furthest apart
    const ma = monthStats(A, view(A)).mean, mb = monthStats(B, view(B)).mean, d = mb.map((x, k) => x - ma[k]);
    let lo = 0, hi = 0; for (let k = 1; k < 12; k++) { if (Math.abs(d[k]) < Math.abs(d[lo])) lo = k; if (Math.abs(d[k]) > Math.abs(d[hi])) hi = k; }
    const sh = shifted(), mlab = (k) => C.MONTHS_LONG[k] + (sh ? ` (on ${axisSide()}'s calendar)` : "");
    const p4 = [`Month by month, the two are closest in ${mlab(lo)}, when their mean temperatures ${Math.abs(d[lo]) < 0.05 ? `agree to within ${n("0.1 K", "c-monthT")}` : `differ by ${n(K1(d[lo]), "c-monthT")}`}, and furthest apart in ${mlab(hi)}, by ${n(K1(d[hi]), "c-monthT")}.`];
    const warmA = Math.max(...ma), above = mb.filter((x) => x > warmA).length;
    if (above && !same) p4.push(`In ${n(above + (above === 1 ? " month" : " months"), "c-monthT")} the mean temperature of ${nB} lies above that of the warmest month in ${nA} (${n(fmt(warmA, 1) + " °C", "c-monthT")}).`);
    if (sh) p4.push(esc(shiftText()));
    else if (!same && (A.W.meta.lat < 0) !== (B.W.meta.lat < 0)) p4.push(`The two files lie on opposite sides of the equator, so their seasons are half a year apart; the season shift on the left aligns them.`);
    out.push(p4.join(" "));
    return out;
  }

  /* ---------------- page ---------------- */
  function ui(card, k, def) { return (st.ui[card] && st.ui[card][k]) || def; }
  function cardShell(c) {
    const tools = (c.tools || []).map((t) => `<select data-card="${c.id}" data-k="${t.k}" aria-label="${esc(t.label)}">${t.options.map(([v, l]) => `<option value="${v}" ${v === ui(c.id, t.k, t.def) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`).join("");
    return `<div class="card${c.wide ? " wide" : ""}" id="${c.id}"><div class="ch"><div class="t"><h3>${esc(c.title)}</h3>${c.sub ? `<div class="sub">${esc(c.sub)}</div>` : ""}</div><div class="tools">${tools}<button class="info" data-gl="${c.id}" aria-label="About this chart, in the guide">?</button><button class="btn small" data-exp="svg" data-card="${c.id}">SVG</button><button class="btn small" data-exp="png" data-card="${c.id}">PNG</button><button class="btn small" data-exp="csv" data-card="${c.id}">CSV</button></div></div><div class="body" data-body="${c.id}"></div></div>`;
  }
  const rendered = {};
  function renderCard(id) {
    const c = CARD[id], body = document.querySelector(`[data-body="${id}"]`); if (!c || !body) return;
    const u = {}; (c.tools || []).forEach((t) => (u[t.k] = ui(id, t.k, t.def)));
    const h0 = body.offsetHeight; if (h0) body.style.minHeight = h0 + "px";
    try { K.curCard = id; const base = c.wide ? 760 : 540, bw = body.clientWidth; K.curW = bw && bw < base ? Math.max(300, Math.round(bw)) : base; const r = c.render(u); rendered[id] = r; body.innerHTML = r.html; } catch (e) { console.error(id, e); body.innerHTML = `<p class="err">This chart could not be drawn: ${esc(e.message)}</p>`; }
    requestAnimationFrame(() => { body.style.minHeight = ""; });
  }
  let io = null;
  function observe() {
    if (io) io.disconnect(); for (const k in rendered) delete rendered[k];
    io = new IntersectionObserver((ents) => { for (const e of ents) if (e.isIntersecting) { const id = e.target.dataset.body; if (!rendered[id]) renderCard(id); io.unobserve(e.target); } }, { rootMargin: "600px 0px" });
    document.querySelectorAll("[data-body]").forEach((b) => io.observe(b));
  }
  function render() {
    K.resetHover();
    const main = $("main");
    if (!F.A || !F.B) {
      $("toc").innerHTML = ""; $("sitetag").textContent = "Two weather files, side by side";
      main.innerHTML = `<div class="empty">${F.A || F.B ? `File ${F.A ? "A" : "B"} is loaded: ${esc((F.A || F.B).label)}. Now load file ${F.A ? "B" : "A"}${F.A ? ", the climate you design for" : ", the climate you know"}.` : "Load two weather files on the left: A, the climate you know, and B, the climate you design for. They can be two places, two files of the same place, or one file and the same file at a warming level."}</div>`;
      return;
    }
    $("sitetag").textContent = `${nameOf(F.A)} and ${nameOf(F.B)}`;
    $("toc").innerHTML = GROUPS.map(([t, ids]) => `<a href="#${ids[0]}">${esc(t)}</a>`).join("");
    let h = "";
    for (const s of SECTIONS) {
      h += `<section class="part" id="${s.id}"><h2>${esc(s.title)}</h2>`;
      if (s.id === "summary") h += `<p class="note" style="margin-top:0">${tag("A")} ${esc(nameOf(F.A))} &nbsp; ${tag("B")} ${esc(nameOf(F.B))}. Differences are always B − A.</p>`;
      if (shifted() && s.id !== "data") h += `<p class="shiftband">${esc(shiftText())}</p>`;
      if (s.reading) h += `<div class="reading">${readingParas().map((p) => `<p>${p}</p>`).join("")}</div>`;
      h += `<div class="cards">${s.cards.map(cardShell).join("")}</div></section>`;
    }
    main.innerHTML = h;
    observe(); spy.last = -1; spy();
  }
  function spy() {
    const nav = $("toc"); if (!nav || !nav.children.length) return;
    document.documentElement.style.setProperty("--navh", nav.offsetHeight + "px");
    const off = nav.offsetHeight + 40; let cur = 0;
    GROUPS.forEach(([, ids], i) => { const el = document.getElementById(ids[0]); if (el && el.getBoundingClientRect().top <= off) cur = i; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = GROUPS.length - 1;
    [...nav.children].forEach((a, i) => { a.classList.toggle("on", i === cur); if (i === cur) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
  }
  addEventListener("scroll", () => { if (!spy.q) { spy.q = 1; requestAnimationFrame(() => { spy.q = 0; spy(); }); } }, { passive: true });
  addEventListener("resize", () => spy());

  /* ---------------- settings: side panels, hash ---------------- */
  function sideNotes(k) {
    const f = F[k], m = st.mods[k];
    for (const b of document.querySelectorAll(`[data-fut="${k}"] button`)) b.setAttribute("aria-pressed", +b.dataset.v === m.level);
    for (const b of document.querySelectorAll(`[data-uhi="${k}"] button`)) b.setAttribute("aria-pressed", b.dataset.v === m.ctx);
    document.querySelector(`[data-uhibox="${k}"]`).hidden = m.ctx === "off";
    $("svf" + k).value = m.svf; $("svfo" + k).textContent = m.svf.toFixed(2); $("fveg" + k).value = m.fveg; $("fvego" + k).textContent = m.fveg.toFixed(2);
    if (!f) { $("info" + k).textContent = ""; $("mod" + k).innerHTML = ""; return; }
    const meta = f.W.meta;
    $("info" + k).innerHTML = `<b>${esc(f.label)}</b><br>${esc(f.name)}<br>${fmt(Math.abs(meta.lat), 2)}° ${meta.lat >= 0 ? "N" : "S"}, ${fmt(Math.abs(meta.lon), 2)}° ${meta.lon >= 0 ? "E" : "W"}; ${f.years.known ? `years ${f.years.from} to ${f.years.to}` : "years not stated"}`;
    const notes = [];
    if (f.fut) { const a = f.fut.dT.reduce((x, v) => x + v, 0) / 12; notes.push(`IPCC region ${esc(Mods.regName(f.fut.region))} (${f.fut.region.id}): ${fmt(a, 1)} K on average, ${fmt(Math.min(...f.fut.dT), 1)} to ${fmt(Math.max(...f.fut.dT), 1)} K by month.`); if (!f.years.known) notes.push(`<span class="warmtxt">The file does not state its years; they are taken to centre on 2010.</span>`); }
    if (f.uhi) { notes.push(`Heat island ${fmt(f.uhi.nightMean, 1)} K on average with the sun down, up to ${fmt(f.uhi.max, 1)} K.`); if (!Mods.isNWEurope(meta.lat, meta.lon)) notes.push(`<span class="warmtxt">Calibrated on cities in north-western Europe; indicative here.</span>`); if (!Mods.AIRPORT.test(`${f.name} ${meta.city}`)) notes.push(`<span class="warmtxt">This station's name does not mark it as an airport. If it stands in a built-up area, its data already hold part of the heat island.</span>`); }
    $("mod" + k).innerHTML = notes.map((x) => `<span>${x}</span>`).join("");
  }
  function syncGlobal() {
    $("season").checked = st.season;
    const s = shifted();
    $("seasonnote").innerHTML = !st.season ? "Off: both files on their own calendar." : !F.A || !F.B ? "On: applies once both files are loaded." : (F.A.W.meta.lat < 0) !== (F.B.W.meta.lat < 0) ? `On: file ${s}, south of the equator, is shown half a year later, so summer meets summer.` : `On: both files lie on the same side of the equator, so file B is shown half a year later. Each season of A now meets the opposite season of B.`;
    if (!st.admTouched) st.adm = S.defaultAdaptive(F.B ? F.B.W.meta.country : F.A ? F.A.W.meta.country : "DEU");
    $("adm").value = st.adm; $("admsum").textContent = S.ADAPT_LABEL[st.adm];
    $("hdd").value = st.hdd; $("cdd").value = st.cdd;
  }
  function refresh() { for (const k of SIDES) sideNotes(k); syncGlobal(); writeHash(); render(); }
  function readHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    for (const k of SIDES) {
      const m = st.mods[k], kk = k.toLowerCase(), L = +q.get("fut" + kk); if ([0, 1.5, 2, 3].includes(L)) m.level = L;
      const c = q.get("ctx" + kk); if (c && (c === "off" || c === "custom" || PRESETS[c])) m.ctx = c; else m.ctx = "off";
      if (PRESETS[m.ctx]) { m.svf = PRESETS[m.ctx].svf; m.fveg = PRESETS[m.ctx].fveg; }
      if (m.ctx === "custom") { const s = +q.get("svf" + kk), v = +q.get("veg" + kk); if (s >= 0.2 && s <= 1) m.svf = s; if (v >= 0 && v <= 0.8) m.fveg = v; }
    }
    st.season = q.get("season") === "1";
    const a = q.get("adm"); if (a && S.ADAPT_LABEL[a]) { st.adm = a; st.admTouched = true; }
    const h = parseFloat(q.get("hdd")), c = parseFloat(q.get("cdd")); if (isFinite(h)) st.hdd = h; if (isFinite(c)) st.cdd = c;
  }
  function writeHash() {
    const q = new URLSearchParams();
    for (const k of SIDES) { const m = st.mods[k], kk = k.toLowerCase(); if (m.level) q.set("fut" + kk, m.level); if (m.ctx !== "off") q.set("ctx" + kk, m.ctx); if (m.ctx === "custom") { q.set("svf" + kk, m.svf.toFixed(2)); q.set("veg" + kk, m.fveg.toFixed(2)); } }
    if (st.season) q.set("season", "1"); if (st.admTouched) q.set("adm", st.adm); if (st.hdd !== 15) q.set("hdd", st.hdd); if (st.cdd !== 18) q.set("cdd", st.cdd);
    history.replaceState(null, "", location.pathname + location.search + (q.toString() ? "#" + q.toString() : ""));
  }
  function remod(k) { if (src[k]) processSide(k); refresh(); }

  /* ---------------- exports, as in Macro Clima and Clima Morph ---------------- */
  const safe = (t) => t.replace(/[^A-Za-z0-9 ._+-]/g, "").replace(/\s+/g, "_").slice(0, 120);
  const srcLine = () => `Clima Compare · A: ${nameOf(F.A)} · B: ${nameOf(F.B)}${shifted() ? ` · ${shifted()} shifted by half a year` : ""} · ${new Date().toISOString().slice(0, 10)}`;
  function saveFile(name, blob) { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
  async function doExport(kind, id) {
    const c = CARD[id]; if (!rendered[id]) renderCard(id); const r = rendered[id]; if (!r) return;
    const base = safe(`Compare_${short(F.A)}_${short(F.B)}_${c.title}`);
    try {
      if (kind === "csv") { if (!r.csv) { toast("This card has no data table."); return; } saveFile(base + ".csv", new Blob(["﻿" + r.csv()], { type: "text/csv" })); return; }
      const body = document.querySelector(`[data-body="${id}"]`), svgs = [...body.querySelectorAll("svg")].filter((x) => !x.closest("table")), tbls = [...body.querySelectorAll("table.t")].map(tableToSvg);
      const leg = [...body.querySelectorAll(".legend")].map(legendToSvg);
      const out = K.standalone(combineSvgs(svgs, leg.concat(tbls)), c.title, srcLine(), c.sub || "");
      if (kind === "svg") saveFile(base + ".svg", new Blob([out.svg], { type: "image/svg+xml" })); else saveFile(base + ".png", await K.svgToPng(out));
    } catch (e) { console.error(e); toast(e.message || String(e)); }
  }
  function tableToSvg(t) {
    const rows = [...t.rows].map((r) => [...r.cells].map((c) => c.textContent.trim())), ncol = Math.max(...rows.map((r) => r.length));
    const colW = Array.from({ length: ncol }, (_, k) => Math.min(380, Math.max(...rows.map((r) => (r[k] || "").length)) * 6.6 + 18)), W = colW.reduce((a, b) => a + b, 0), rh = 20, H = rows.length * rh + 6;
    const ns = "http://www.w3.org/2000/svg", g = document.createElementNS(ns, "svg"); g.setAttribute("viewBox", `0 0 ${W} ${H}`);
    let s = ""; rows.forEach((r, i) => { let x = 0; const y = 4 + i * rh; s += `<line x1="0" x2="${W}" y1="${y + rh}" y2="${y + rh}" stroke="#e6e9e4"/>`; r.forEach((v, k) => { const right = k > 0 && /^[−+±\-–\d]/.test(v); s += `<text x="${right ? x + colW[k] - 8 : x + 4}" y="${y + 14}" text-anchor="${right ? "end" : "start"}" font-family="Helvetica, Arial, sans-serif" font-size="${i ? 12 : 10.5}" font-weight="${i ? 400 : 600}" fill="${i ? "#18201f" : "#5b6663"}">${esc(v.length > 60 ? v.slice(0, 58) + "…" : v)}</text>`; x += colW[k]; }); });
    g.innerHTML = s; g.style.position = "absolute"; g.style.left = "-9999px"; document.body.appendChild(g); setTimeout(() => g.remove(), 2000); return g;
  }
  function legendToSvg(l) {
    const items = [...l.querySelectorAll("span")].map((s) => [s.querySelector("i") ? s.querySelector("i").style.background : "#999", s.textContent.trim()]);
    const ns = "http://www.w3.org/2000/svg", g = document.createElementNS(ns, "svg"); let x = 4, y = 4, s = ""; const W = 760;
    for (const [c, t] of items) { const w = t.length * 6.2 + 24; if (x + w > W) { x = 4; y += 18; } s += `<rect x="${x}" y="${y + 2}" width="10" height="10" rx="2" fill="${c}"/><text x="${x + 14}" y="${y + 11}" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#5b6663">${esc(t)}</text>`; x += w; }
    g.setAttribute("viewBox", `0 0 ${W} ${y + 18}`); g.innerHTML = s; g.style.position = "absolute"; g.style.left = "-9999px"; document.body.appendChild(g); setTimeout(() => g.remove(), 2000); return g;
  }
  function combineSvgs(charts, tables) {
    const ns = "http://www.w3.org/2000/svg", g = document.createElementNS(ns, "svg"); let y = 0, wMax = 0;
    for (const x of charts) {
      const t = x.closest("div") && x.closest("div").querySelector(":scope > h4");
      if (t) { const e = document.createElementNS(ns, "text"); e.setAttribute("x", 4); e.setAttribute("y", y + 14); e.setAttribute("font-family", "Helvetica, Arial, sans-serif"); e.setAttribute("font-size", "13"); e.setAttribute("font-weight", "600"); e.setAttribute("fill", "#18201f"); e.textContent = t.textContent; g.appendChild(e); y += 22; }
      const [, , w, h] = (x.getAttribute("viewBox") || "0 0 760 260").split(/\s+/).map(Number), nd = x.cloneNode(true); nd.setAttribute("x", 0); nd.setAttribute("y", y); nd.setAttribute("width", w); nd.setAttribute("height", h); g.appendChild(nd); y += h + 12; wMax = Math.max(wMax, w);
    }
    for (const t of tables) { const [, , w, h] = t.getAttribute("viewBox").split(/\s+/).map(Number), nd = t.cloneNode(true); nd.setAttribute("x", 0); nd.setAttribute("y", y); nd.setAttribute("width", w); nd.setAttribute("height", h); g.appendChild(nd); y += h + 12; wMax = Math.max(wMax, w); }
    g.setAttribute("viewBox", `0 0 ${wMax || 760} ${y || 10}`); g.style.position = "absolute"; g.style.left = "-9999px"; document.body.appendChild(g); setTimeout(() => g.remove(), 2000); return g;
  }
  function toast(m) { const t = $("tip"); t.innerHTML = esc(m); t.style.display = "block"; t.style.left = "50%"; t.style.top = "20px"; setTimeout(() => (t.style.display = "none"), 3500); }

  /* ---------------- colour range: click a colour bar ---------------- */
  let rpKey = null;
  function applyRange(clear) {
    if (!rpKey) return; const lo = parseFloat($("rpLo").value), hi = parseFloat($("rpHi").value);
    if (clear) delete st.scaleOv[rpKey]; else if (isFinite(lo) && isFinite(hi) && hi > lo) st.scaleOv[rpKey] = { lo, hi }; else return;
    $("rangepop").hidden = true; for (const id in rendered) if (/c-carpet|c-sunpath/.test(id)) renderCard(id);
  }
  $("rpApply").onclick = () => applyRange(false); $("rpReset").onclick = () => applyRange(true); $("rpClose").onclick = () => ($("rangepop").hidden = true);
  $("rangepop").addEventListener("keydown", (e) => { if (e.key === "Enter") applyRange(false); if (e.key === "Escape") $("rangepop").hidden = true; });

  /* ---------------- tooltip ---------------- */
  const tip = $("tip");
  document.addEventListener("mousemove", (ev) => {
    const el = ev.target.closest && ev.target.closest("[data-tip],[data-hov]");
    if (!el) { tip.style.display = "none"; return; }
    let html = null;
    if (el.dataset.tip) html = el.dataset.tip.replace(/&lt;br&gt;/g, "<br>");
    else { const fn = K.hov[el.dataset.hov]; const svg = el.ownerSVGElement || el; if (fn && svg.getScreenCTM) { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const lp = pt.matrixTransform(svg.getScreenCTM().inverse()); html = fn(lp.x, lp.y); } }
    if (!html) { tip.style.display = "none"; return; }
    tip.innerHTML = html; tip.style.display = "block";
    const r = tip.getBoundingClientRect(); let x = ev.clientX + 14, y = ev.clientY + 14; if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14; if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14; tip.style.left = x + "px"; tip.style.top = y + "px";
  });

  /* ---------------- guide ---------------- */
  function buildGuide() {
    const G = window.COMPARE_GUIDE || [];
    $("guide").innerHTML = `<div class="ghead"><h2>Guide</h2><button class="btn small" id="gclose">Close</button></div><div class="gbody"><nav class="gtoc">${G.filter((s) => !s.card).map((s) => `<a href="#g-${s.id}" data-goto="${s.id}">${esc(s.t)}</a>`).join("")}</nav>${G.map((s) => `<section id="g-${s.id}"${s.card ? ' class="gcard"' : ""}>${s.card ? `<h4>${esc(s.t)}</h4>` : `<h3 class="gch">${esc(s.t)}</h3>`}${s.h}</section>`).join("")}</div>`;
    $("gclose").onclick = closeGuide;
    $("guide").addEventListener("click", (e) => { const g = e.target.closest("[data-goto]"); if (g) { e.preventDefault(); openGuide(g.dataset.goto); } });
  }
  function openGuide(id) {
    $("guide").classList.add("open"); $("guide").setAttribute("aria-hidden", "false"); $("scrim").hidden = false;
    if (id) { const s = $("g-" + id); if (s) { s.scrollIntoView({ block: "start" }); s.classList.add("flash"); setTimeout(() => s.classList.remove("flash"), 1200); } }
  }
  function closeGuide() { $("guide").classList.remove("open"); $("guide").setAttribute("aria-hidden", "true"); $("scrim").hidden = true; }

  /* ---------------- wiring ---------------- */
  $("adm").innerHTML = S.ADAPT.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("");
  for (const sel of document.querySelectorAll("[data-sample]")) { sel.innerHTML += SAMPLES.map((s, i) => `<option value="${i}">${esc(s[1])}</option>`).join(""); sel.onchange = (e) => { if (e.target.value !== "") loadSample(sel.dataset.sample, +e.target.value); }; }
  for (const inp of document.querySelectorAll("[data-file]")) inp.onchange = (e) => { if (e.target.files[0]) loadFile(inp.dataset.file, e.target.files[0]); };
  for (const drop of document.querySelectorAll("[data-drop]")) {
    ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("over")));
    drop.addEventListener("drop", (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(drop.dataset.drop, f); });
  }
  for (const seg of document.querySelectorAll("[data-fut]")) seg.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; st.mods[seg.dataset.fut].level = +b.dataset.v; remod(seg.dataset.fut); };
  for (const seg of document.querySelectorAll("[data-uhi]")) seg.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; const m = st.mods[seg.dataset.uhi]; m.ctx = b.dataset.v; if (PRESETS[m.ctx]) { m.svf = PRESETS[m.ctx].svf; m.fveg = PRESETS[m.ctx].fveg; } remod(seg.dataset.uhi); };
  for (const k of SIDES) { const slide = () => { const m = st.mods[k]; m.svf = +$("svf" + k).value; m.fveg = +$("fveg" + k).value; const p = Object.keys(PRESETS).find((x) => PRESETS[x].svf === m.svf && PRESETS[x].fveg === m.fveg); m.ctx = p || "custom"; $("svfo" + k).textContent = m.svf.toFixed(2); $("fvego" + k).textContent = m.fveg.toFixed(2); clearTimeout(slide.t); slide.t = setTimeout(() => remod(k), 250); }; $("svf" + k).oninput = slide; $("fveg" + k).oninput = slide; }
  $("swapBtn").onclick = () => { st.admTouched = true; [src.A, src.B] = [src.B, src.A]; [st.mods.A, st.mods.B] = [st.mods.B, st.mods.A]; [F.A, F.B] = [F.B, F.A]; for (const k of SIDES) if (F[k]) { F[k].k = k; F[k].cache = new Map(); } refresh(); };
  $("season").onchange = (e) => { st.season = e.target.checked; for (const k of SIDES) if (F[k]) F[k].cache = new Map(); refresh(); };
  $("adm").onchange = (e) => { st.adm = e.target.value; st.admTouched = true; refresh(); };
  const ddIn = () => { const h = parseFloat($("hdd").value), c = parseFloat($("cdd").value); if (isFinite(h)) st.hdd = h; if (isFinite(c)) st.cdd = c; resummarise(); refresh(); };
  $("hdd").onchange = ddIn; $("cdd").onchange = ddIn;
  $("linkBtn").onclick = async () => { writeHash(); try { await navigator.clipboard.writeText(location.href); $("linkBtn").textContent = "Link copied"; } catch (e) { $("linkBtn").textContent = "Copy the address bar"; } setTimeout(() => ($("linkBtn").textContent = "Copy a link to these settings"), 1800); };
  document.addEventListener("change", (e) => { const s = e.target; if (s.matches && s.matches("select[data-card]")) { (st.ui[s.dataset.card] = st.ui[s.dataset.card] || {})[s.dataset.k] = s.value; renderCard(s.dataset.card); } });
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    const num = t.closest && t.closest(".n");
    if (num) { const card = $(num.dataset.card); if (card) { if (num.dataset.set) { const [k, v] = num.dataset.set.split("="); (st.ui[num.dataset.card] = st.ui[num.dataset.card] || {})[k] = v; const sel = card.querySelector(`select[data-k="${k}"]`); if (sel) sel.value = v; renderCard(num.dataset.card); } else if (!rendered[num.dataset.card]) renderCard(num.dataset.card); card.scrollIntoView({ behavior: "smooth", block: "center" }); card.classList.add("flash"); setTimeout(() => card.classList.remove("flash"), 1400); } return; }
    const g = t.closest && t.closest("[data-scale]"), pop = $("rangepop");
    if (g) { rpKey = g.dataset.scale; if (!rpKey) return; $("rpLo").value = +(+g.dataset.lo).toPrecision(4); $("rpHi").value = +(+g.dataset.hi).toPrecision(4); pop.hidden = false; pop.style.left = Math.min(innerWidth - 240, ev.clientX + 8) + "px"; pop.style.top = Math.min(innerHeight - 110, ev.clientY + 8) + "px"; $("rpLo").focus(); return; }
    if (!pop.hidden && !pop.contains(t)) pop.hidden = true;
    if (t.dataset && t.dataset.gl) { openGuide(t.dataset.gl); return; }
    if (t.dataset && t.dataset.exp) { doExport(t.dataset.exp, t.dataset.card); return; }
  });
  $("guideBtn").onclick = () => openGuide("what"); $("scrim").onclick = closeGuide;
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeGuide(); });
  addEventListener("hashchange", () => { readHash(); for (const k of SIDES) if (src[k]) processSide(k); refresh(); });
  buildGuide(); readHash(); refresh(); catalogueReady();
  // for tests: the processed files and the view helpers
  window.ClimaCompare = { F, st, view, shifted, toSolar, readingParas, identical, samePlace, render, refresh, setSource, CARD, rendered, renderCard };
})();
