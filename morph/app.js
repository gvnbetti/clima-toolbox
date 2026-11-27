/* Clima Morph: page logic. The modifiers are the shared core's (ClimaMods.prepWeather); the file is written by epwout.js. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const C = window.Clima, Mods = window.ClimaMods, X = window.ClimaMorph, K = window.K;
  const VERSION = (document.querySelector(".tbver") || {}).textContent || "";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const SAMPLES = [ // the files bundled with Macro Clima
    ["DEU_BE_Berlin-Tegel.AP.103820_TMYx.epw.txt", "Berlin-Tegel Airport, Germany"], ["GBR_ENG_London.Wea.Ctr-St.James.Park.037700_TMYx.epw.txt", "London St James's Park, UK"],
    ["ESP_MD_Madrid.WS.082200_TMYx.epw.txt", "Madrid, Spain"], ["ITA_LZ_Rome.162400_TMYx.epw.txt", "Rome, Italy"], ["RUS_MOS_Moscow-Bibirevo.276120_TMYx.epw.txt", "Moscow-Bibirevo, Russia"],
    ["EGY_QH_Cairo.Intl.AP.623660_TMYx.epw.txt", "Cairo International Airport, Egypt"], ["ARE_DU_Dubai.Intl.AP.411940_TMYx.epw.txt", "Dubai International Airport, UAE"],
    ["IND_MH_Mumbai-Shivaji.Intl.AP.430030_TMYx.epw.txt", "Mumbai Airport, India"], ["SGP_SG_Singapore-Changi.Intl.AP.486980_Custom.epw.txt", "Singapore Changi Airport"],
    ["CHN_SH_Shanghai-Hongqiao.Intl.AP.583670_TMYx.epw.txt", "Shanghai Hongqiao Airport, China"], ["MEX_CMX_Ciudad.Mexico.Central.766800_TMYx.epw.txt", "Mexico City Central, Mexico"]];
  const PRESETS = Mods.UHI_PRESETS;
  const st = { level: 0, ctx: "off", svf: 0.6, fveg: 0.2 };
  let src = null, R = null; // source { text, name }, result of the last morph
  const f1 = (v, d = 1) => { const s = (+v).toFixed(d); return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s; };
  const sg = (v, d = 1) => (v > 0.0499 ? "+" : "") + f1(v, d);

  /* ---------------- settings in the address ---------------- */
  function readHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    const L = +q.get("fut"); if ([0, 1.5, 2, 3].includes(L)) st.level = L;
    const c = q.get("ctx"); if (c && (c === "off" || c === "custom" || PRESETS[c])) st.ctx = c;
    if (PRESETS[st.ctx]) { st.svf = PRESETS[st.ctx].svf; st.fveg = PRESETS[st.ctx].fveg; }
    if (st.ctx === "custom") { const s = +q.get("svf"), v = +q.get("veg"); if (s >= 0.2 && s <= 1) st.svf = s; if (v >= 0 && v <= 0.8) st.fveg = v; }
  }
  function writeHash() {
    const q = new URLSearchParams(); if (st.level) q.set("fut", st.level); if (st.ctx !== "off") q.set("ctx", st.ctx);
    if (st.ctx === "custom") { q.set("svf", st.svf.toFixed(2)); q.set("veg", st.fveg.toFixed(2)); }
    history.replaceState(null, "", location.pathname + location.search + (q.toString() ? "#" + q.toString() : ""));
  }

  /* ---------------- loading ---------------- */
  const showErr = (m) => { const e = $("loaderr"); e.textContent = m; e.hidden = !m; };
  async function loadFile(file) {
    showErr(""); $("wxinfo").textContent = `Reading ${file.name}`;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      if (/\.zip$/i.test(file.name) || (buf[0] === 0x50 && buf[1] === 0x4b)) {
        const z = window.fflate.unzipSync(buf), k = Object.keys(z).find((n) => /\.epw$/i.test(n));
        if (!k) { showErr("The ZIP holds no EPW file."); $("wxinfo").textContent = ""; return; }
        setSource(new TextDecoder("windows-1252").decode(z[k]), k.split("/").pop());
      } else setSource(new TextDecoder("windows-1252").decode(buf), file.name);
    } catch (e) { showErr("The file could not be read: " + e.message); $("wxinfo").textContent = ""; }
  }
  async function loadSample(i) {
    const [url] = SAMPLES[i]; $("wxinfo").textContent = "Loading the sample";
    const r = await fetch("../macro/data/epw/" + url); setSource(await r.text(), url.replace(/\.txt$/, ""));
  }
  function setSource(text, name) {
    try { C.parseEPW(text, name); } catch (e) { showErr(e.message); $("wxinfo").textContent = ""; return; }
    src = { text, name }; run();
  }

  /* ---------------- run ---------------- */
  function run() {
    syncControls(); writeHash();
    if (!src) return;
    try {
      R = X.morph(src.text, src.name, { level: st.level, uhi: st.ctx === "off" ? null : { svf: st.svf, fveg: st.fveg, key: st.ctx }, version: VERSION },
        { Clima: C, Mods, future: window.CLIMA_FUTURE, regions: window.CLIMA_REGIONS });
    } catch (e) { showErr(e.message); R = null; $("main").innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    showErr(""); notes(); render();
  }
  function notes() {
    const m = R.W0.meta, t = R.W0.dbt; let a = 0; for (let i = 0; i < t.length; i++) a += t[i];
    $("wxinfo").innerHTML = `<b>${esc(src.name)}</b><br>${esc([m.city, m.country].filter(Boolean).join(", "))}; ${m.lat.toFixed(2)}°, ${m.lon.toFixed(2)}°; mean ${(a / t.length).toFixed(1)} °C`;
    const fn = [];
    if (R.region) fn.push(`IPCC region: ${esc(Mods.regName(R.region))} (${R.region.id}). Change measured from the file's years${R.years.known ? ` (${R.years.from} to ${R.years.to})` : ""}.`);
    if (!R.years.known) fn.push(`<span class="warmtxt">The file does not state its years; they are taken to centre on 2010.</span>`);
    if (R.fut) fn.push(`Applied: ${f1(R.dAnn)} K on average over the year, ${f1(Math.min(...R.fut.dT))} to ${f1(Math.max(...R.fut.dT))} K by month.`);
    for (const n of R.notes) fn.push(`<span class="warmtxt">${esc(n)}</span>`);
    $("futnote").innerHTML = fn.map((x) => `<span>${x}</span>`).join("");
    const un = [];
    if (R.uhi) {
      un.push(`Heat island factor ${R.uhi.factor.toFixed(2)} (2 − sky view factor − vegetation fraction). Estimated heat island: ${f1(R.uhi.nightMean)} K on average with the sun down, up to ${f1(R.uhi.max)} K.`);
      if (!Mods.isNWEurope(m.lat, m.lon)) un.push(`<span class="warmtxt">The model was calibrated on cities in north-western Europe. For this location the estimate is indicative.</span>`);
      if (st.svf < 0.2 || st.svf > 0.9 || st.fveg > 0.4) un.push(`<span class="warmtxt">These settings lie outside the calibration range (sky view factor 0.2 to 0.9, vegetation up to 0.4).</span>`);
      if (!Mods.AIRPORT.test(`${src.name} ${m.city}`)) un.push(`<span class="warmtxt">This station's name does not mark it as an airport. If it stands in a built-up area, its data already hold part of the heat island, and this estimate adds it again.</span>`);
    }
    $("uhinote").innerHTML = un.map((x) => `<span>${x}</span>`).join("");
    $("dlBtn").disabled = !R.changed;
    $("dlnote").innerHTML = R.changed ? `File name: <code>${esc(R.fileName)}</code>` : "Choose a future climate, an urban context or both. As recorded and present, the file would not change.";
  }
  function syncControls() {
    for (const b of document.querySelectorAll("#futSeg button")) b.setAttribute("aria-pressed", +b.dataset.v === st.level);
    for (const b of document.querySelectorAll("#uhiSeg button")) b.setAttribute("aria-pressed", b.dataset.v === st.ctx);
    $("uhibox").hidden = st.ctx === "off";
    $("svf").value = st.svf; $("svfo").textContent = st.svf.toFixed(2); $("fveg").value = st.fveg; $("fvego").textContent = st.fveg.toFixed(2);
    if (!src) { $("dlBtn").disabled = true; }
  }

  /* ---------------- results ---------------- */
  function monthly(a) { const o = []; let i = 0; for (let m = 0; m < 12; m++) { let s = 0; const n = MDAYS[m] * 24; for (let k = 0; k < n; k++) s += a[i++]; o.push(s / n); } return o; }
  const annual = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; };
  function render() {
    const W0 = R.W0, W = R.W, main = $("main");
    if (!R.changed) { main.innerHTML = `<section class="part"><h2>Nothing changes yet</h2><div class="reading"><p>The file is loaded. Choose a level of future warming, an urban context or both on the left; the changes appear here and the morphed file can be downloaded.</p></div></section>` + fileSection(); return; }
    const dT = annual(W.dbt) - annual(W0.dbt), dF = R.fut ? R.dAnn : 0, dU = R.uhi ? R.uhi.mean : 0;
    const tiles = [[sg(dT), "K", "Air temperature, change over the year"]];
    if (R.fut) tiles.push([sg(dF), "K", "of which future climate"]);
    if (R.uhi) tiles.push([sg(dU), "K", "of which heat island"], [f1(R.uhi.max), "K", "Largest hourly heat island"]);
    tiles.push([sg(annual(W.dpt) - annual(W0.dpt)), "K", "Dew point, change"], [sg(annual(W.rh) - annual(W0.rh), 0), "%", "Relative humidity, change"], [sg(annual(W.hir) - annual(W0.hir), 1), "W/m²", "Sky infrared, change"]);
    const what = [];
    if (R.fut) what.push(`Shifted to <b>${st.level} °C</b> of global warming (${esc(Mods.futLab(st.level).replace(/^.*?global warming, /, ""))}) for the IPCC region ${esc(Mods.regName(R.region))}: the air is ${f1(dF)} K warmer on average, with relative humidity held.`);
    if (R.uhi) what.push(`Placed in a${st.ctx === "urban" ? "n" : ""} <b>${st.ctx === "custom" ? "custom" : st.ctx}</b> neighbourhood (sky view factor ${st.svf.toFixed(2)}, vegetation fraction ${st.fveg.toFixed(2)}): ${f1(R.uhi.nightMean)} K warmer on average at night, ${f1(dU)} K over the whole year, with dew point held.`);
    main.innerHTML = `<section class="part"><h2>What changes</h2><div class="reading">${what.map((x) => `<p>${x}</p>`).join("")}</div>
      <div class="tiles">${tiles.map(([v, u, k]) => `<div class="tile"><div class="v">${v} <small>${u}</small></div><div class="k">${k}</div></div>`).join("")}</div></section>`
      + fileSection() + tableSection() + carpetSection();
  }
  function fileSection() {
    if (!R.changed) return "";
    const lines = [];
    lines.push(`Dry-bulb temperature, 0.1 °C: ${R.fut && R.uhi ? "future climate and heat island" : R.fut ? "future climate" : "heat island"}.`);
    if (R.fut) lines.push("Dew point, 0.1 °C; sky infrared, 1 W/m²; precipitation: future climate.", `Ground temperatures in the header: +${f1(R.dAnn, 2)} K.`);
    if (R.uhi) lines.push("Relative humidity, 1 %: heat island.");
    lines.push("Design conditions removed; typical and extreme periods kept as chosen on the present climate.", "Solar radiation, wind, pressure, cloud and dates unchanged.");
    if (R.leapRows) lines.push(`Leap year: the ${R.leapRows} hours of 29 February take the changes of 28 February.`);
    if (R.keptMissing) lines.push(`${R.keptMissing} values missing in the source stay missing.`);
    return `<section class="part"><h2>The file<button class="info" data-g="out" aria-label="About the file">?</button></h2>
      <div class="dl"><button class="btn primary" data-dl>Download ${esc(R.fileName)}</button></div>
      <ul class="chg">${lines.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="note">Recorded in the file's second comment line: ${esc(R.provenance)}</p></section>`;
  }
  function tableSection() {
    const W0 = R.W0, W = R.W, a = {};
    for (const k of ["dbt", "dpt", "rh", "hir"]) { a[k] = [monthly(W0[k]), monthly(W[k])]; a[k][0].push(annual(W0[k])); a[k][1].push(annual(W[k])); }
    const rows = MONTHS.concat(["Year"]).map((m, i) => `<tr${i === 12 ? ' class="yr"' : ""}><td>${m}</td>` +
      `<td>${f1(a.dbt[0][i])}</td><td>${f1(a.dbt[1][i])}</td><td class="d">${sg(a.dbt[1][i] - a.dbt[0][i])}</td>` +
      `<td>${f1(a.dpt[0][i])}</td><td>${f1(a.dpt[1][i])}</td><td>${f1(a.rh[0][i], 0)}</td><td>${f1(a.rh[1][i], 0)}</td>` +
      `<td>${f1(a.hir[0][i], 0)}</td><td>${f1(a.hir[1][i], 0)}</td></tr>`).join("");
    return `<section class="part" data-sec="table"><div class="ph"><h2>Month by month<button class="info" data-g="table" aria-label="About the table">?</button></h2>${tools("table")}</div>
      <div class="tscroll"><table class="t"><thead><tr><th>Month</th><th>Air, source °C</th><th>Air, morphed °C</th><th>Change K</th><th>Dew point, source °C</th><th>Dew point, morphed °C</th><th>RH, source %</th><th>RH, morphed %</th><th>Sky infrared, source W/m²</th><th>Sky infrared, morphed W/m²</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  /* hourly charts: Macro Clima's carpet and its temperature colour scale (K.PAL.temp, from CBE Clima), as in Macro Clima's
     heat island card; one colour range for both charts, so they compare; click the colour bar to set it */
  const tools = (id) => `<div class="tools"><button class="btn small" data-exp="svg" data-sec="${id}">SVG</button><button class="btn small" data-exp="png" data-sec="${id}">PNG</button><button class="btn small" data-exp="csv" data-sec="${id}">CSV</button></div>`;
  const scaleOv = {};
  const hourOf = (i) => { const d = Math.floor(i / 24), h = i % 24; let m = 0, dd = d; while (dd >= MDAYS[m]) dd -= MDAYS[m++]; return `${dd + 1} ${MONTHS[m]}, ${String(h).padStart(2, "0")}:00 to ${String(h + 1).padStart(2, "0")}:00`; };
  function carpetSection() {
    K.resetHover();
    const zero = new Float64Array(8760), fut = R.fut ? R.fut.dh : zero, uhi = R.uhi ? R.uhi.uhi : zero, a = R.W0.dbt, b = R.W.dbt;
    let mx = 0; for (let i = 0; i < 8760; i++) mx = Math.max(mx, fut[i], uhi[i]);
    const ov = scaleOv.dT, sc = K.scale({ ramp: "temp", lo: ov ? ov.lo : 0, hi: ov ? ov.hi : Math.max(1, Math.ceil(mx)), key: "dT" });
    const one = (arr, label, what) => K.carpet({ vals: arr, scale: sc, unit: "K", label, W: 760, colorOf: (v) => sc.color(v),
      tip: (i) => `<b>${hourOf(i)}</b><br>${what}: ${sg(arr[i], 2)} K<br>Air: ${f1(a[i])} °C as recorded, ${f1(b[i])} °C in the file` });
    const parts = [];
    parts.push(`<div class="carpet"><h3>Future climate, K</h3>${R.fut ? one(fut, "Future climate", "Future change") : `<p class="note">Present climate: no change.</p>`}</div>`);
    parts.push(`<div class="carpet"><h3>Heat island, K</h3>${R.uhi ? one(uhi, "Heat island", "Heat island") : `<p class="note">As recorded: no change.</p>`}</div>`);
    return `<section class="part" data-sec="hourly"><div class="ph"><h2>Hour by hour<button class="info" data-g="carpets" aria-label="About the hourly charts">?</button></h2>${tools("hourly")}</div>${parts.join("")}
      <p class="note">One colour range for both charts. Click a colour bar to set it.</p></section>`;
  }

  /* ---------------- chart and table downloads, as in Macro Clima ---------------- */
  const safe = (t) => t.replace(/[^A-Za-z0-9 ._+-]/g, "").replace(/\s+/g, "_").slice(0, 120);
  const srcLine = () => `Clima Morph · ${src.name.replace(/\.epw$/i, "")}${R.fut ? ` · +${st.level} °C` : ""}${R.uhi ? ` · ${st.ctx} (SVF ${st.svf.toFixed(2)}, vegetation ${st.fveg.toFixed(2)})` : ""} · ${new Date().toISOString().slice(0, 10)}`;
  const TITLES = { table: "Month by month", hourly: "Hour by hour: added air temperature" };
  function saveFile(name, blob) { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
  function csvOf(id) {
    if (id === "table") { const t = document.querySelector('section[data-sec="table"] table'); return [...t.rows].map((r) => [...r.cells].map((c) => `"${c.textContent.trim()}"`).join(",")).join("\n"); }
    const zero = new Float64Array(8760), fut = R.fut ? R.fut.dh : zero, uhi = R.uhi ? R.uhi.uhi : zero;
    return ["hour of year,month,day,hour,future change (K),heat island (K),air temperature as recorded (C),air temperature in the file (C)"].concat(Array.from({ length: 8760 }, (_, i) => { const d = Math.floor(i / 24); let m = 0, dd = d; while (dd >= MDAYS[m]) dd -= MDAYS[m++]; return `${i + 1},${m + 1},${dd + 1},${i % 24 + 1},${fut[i].toFixed(3)},${uhi[i].toFixed(3)},${R.W0.dbt[i].toFixed(1)},${R.W.dbt[i].toFixed(2)}`; })).join("\n");
  }
  async function doExport(kind, id) {
    const base = safe(`${src.name.replace(/\.epw$/i, "")}_${TITLES[id]}`);
    try {
      if (kind === "csv") { saveFile(base + ".csv", new Blob(["﻿" + csvOf(id)], { type: "text/csv" })); return; }
      const sec = document.querySelector(`section[data-sec="${id}"]`), svgs = [...sec.querySelectorAll(".carpet svg")], tbls = [...sec.querySelectorAll("table.t")].map(tableToSvg);
      const out = K.standalone(combineSvgs(svgs, tbls), TITLES[id], srcLine(), "");
      if (kind === "svg") saveFile(base + ".svg", new Blob([out.svg], { type: "image/svg+xml" })); else saveFile(base + ".png", await K.svgToPng(out));
    } catch (e) { toast(e.message || String(e)); }
  }
  // a table drawn as SVG text, for exports (as in Macro Clima)
  function tableToSvg(t) {
    const rows = [...t.rows].map((r) => [...r.cells].map((c) => c.textContent.trim())), ncol = Math.max(...rows.map((r) => r.length));
    const colW = Array.from({ length: ncol }, (_, k) => Math.max(...rows.map((r) => (r[k] || "").length)) * 6.6 + 18), W = colW.reduce((a, b) => a + b, 0), rh = 20, H = rows.length * rh + 6;
    const ns = "http://www.w3.org/2000/svg", g = document.createElementNS(ns, "svg"); g.setAttribute("viewBox", `0 0 ${W} ${H}`);
    let s = ""; rows.forEach((r, i) => { let x = 0; const y = 4 + i * rh; s += `<line x1="0" x2="${W}" y1="${y + rh}" y2="${y + rh}" stroke="#e6e9e4"/>`; r.forEach((v, k) => { const right = k > 0; s += `<text x="${right ? x + colW[k] - 8 : x + 4}" y="${y + 14}" text-anchor="${right ? "end" : "start"}" font-family="Helvetica, Arial, sans-serif" font-size="${i ? 12 : 10.5}" font-weight="${i ? 400 : 600}" fill="${i ? "#18201f" : "#5b6663"}">${esc(v)}</text>`; x += colW[k]; }); });
    g.innerHTML = s; g.style.position = "absolute"; g.style.left = "-9999px"; document.body.appendChild(g); setTimeout(() => g.remove(), 2000); return g;
  }
  // several charts in one export, stacked, tables underneath (as in Macro Clima)
  function combineSvgs(charts, tables) {
    const ns = "http://www.w3.org/2000/svg", g = document.createElementNS(ns, "svg"); let y = 0, wMax = 0;
    for (const x of charts) {
      const t = x.closest(".carpet") && x.closest(".carpet").querySelector("h3"); // each chart keeps its heading in the export
      if (t) { const e = document.createElementNS(ns, "text"); e.setAttribute("x", 4); e.setAttribute("y", y + 14); e.setAttribute("font-family", "Helvetica, Arial, sans-serif"); e.setAttribute("font-size", "13"); e.setAttribute("font-weight", "600"); e.setAttribute("fill", "#18201f"); e.textContent = t.textContent; g.appendChild(e); y += 22; }
      const [, , w, h] = x.getAttribute("viewBox").split(/\s+/).map(Number), n = x.cloneNode(true); n.setAttribute("x", 0); n.setAttribute("y", y); n.setAttribute("width", w); n.setAttribute("height", h); g.appendChild(n); y += h + 12; wMax = Math.max(wMax, w);
    }
    for (const t of tables) { const [, , w, h] = t.getAttribute("viewBox").split(/\s+/).map(Number), n = t.cloneNode(true); n.setAttribute("x", 0); n.setAttribute("y", y); n.setAttribute("width", w); n.setAttribute("height", h); g.appendChild(n); y += h + 12; wMax = Math.max(wMax, w); }
    g.setAttribute("viewBox", `0 0 ${wMax} ${y}`); g.style.position = "absolute"; g.style.left = "-9999px"; document.body.appendChild(g); setTimeout(() => g.remove(), 2000); return g;
  }
  function toast(m) { const t = $("tip"); t.innerHTML = esc(m); t.style.display = "block"; t.style.left = "50%"; t.style.top = "20px"; setTimeout(() => (t.style.display = "none"), 3500); }

  /* ---------------- colour range: click a colour bar (as in Macro Clima) ---------------- */
  let rpKey = null;
  document.addEventListener("click", (ev) => {
    const g = ev.target.closest && ev.target.closest("[data-scale]"), pop = $("rangepop");
    if (!g) { if (!pop.hidden && !pop.contains(ev.target)) pop.hidden = true; return; }
    rpKey = g.dataset.scale; $("rpLo").value = +(+g.dataset.lo).toPrecision(4); $("rpHi").value = +(+g.dataset.hi).toPrecision(4);
    pop.hidden = false; pop.style.left = Math.min(innerWidth - 240, ev.clientX + 8) + "px"; pop.style.top = Math.min(innerHeight - 110, ev.clientY + 8) + "px"; $("rpLo").focus();
  });
  function applyRange(clear) {
    if (!rpKey) return; const lo = parseFloat($("rpLo").value), hi = parseFloat($("rpHi").value);
    if (clear) delete scaleOv[rpKey]; else if (isFinite(lo) && isFinite(hi) && hi > lo) scaleOv[rpKey] = { lo, hi }; else return;
    $("rangepop").hidden = true; render();
  }
  $("rpApply").onclick = () => applyRange(false); $("rpReset").onclick = () => applyRange(true); $("rpClose").onclick = () => ($("rangepop").hidden = true);
  $("rangepop").addEventListener("keydown", (e) => { if (e.key === "Enter") applyRange(false); if (e.key === "Escape") $("rangepop").hidden = true; });

  /* ---------------- tooltip, as in Macro Clima ---------------- */
  document.addEventListener("mousemove", (ev) => {
    const tip = $("tip"), el = ev.target.closest && ev.target.closest("[data-hov]");
    if (!el) { tip.style.display = "none"; return; }
    const fn = K.hov[el.dataset.hov], svg = el.ownerSVGElement || el; let html = null;
    if (fn && svg.getScreenCTM) { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const lp = pt.matrixTransform(svg.getScreenCTM().inverse()); html = fn(lp.x, lp.y); }
    if (!html) { tip.style.display = "none"; return; }
    tip.innerHTML = html; tip.style.display = "block";
    const r = tip.getBoundingClientRect(); let x = ev.clientX + 14, y = ev.clientY + 14; if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14; if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14; tip.style.left = x + "px"; tip.style.top = y + "px";
  });

  /* ---------------- download ---------------- */
  function download() {
    if (!R || !R.changed) return;
    const blob = new Blob([X.encode1252(R.text)], { type: "application/octet-stream" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = R.fileName; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------------- guide ---------------- */
  function buildGuide() {
    const G = window.MORPH_GUIDE || [];
    $("guide").innerHTML = `<div class="ghead"><h2>Guide</h2><button class="btn" id="gclose">Close</button></div><div class="gbody"><nav class="gtoc">${G.map((s) => `<a href="#g-${s.id}" data-goto="${s.id}">${esc(s.t)}</a>`).join("")}</nav>${G.map((s) => `<section id="g-${s.id}"><h3>${esc(s.t)}</h3>${s.h}</section>`).join("")}</div>`;
    $("gclose").onclick = closeGuide;
    $("guide").addEventListener("click", (e) => { const g = e.target.closest("[data-goto]"); if (g) { e.preventDefault(); openGuide(g.dataset.goto); } });
  }
  function openGuide(id) {
    $("guide").classList.add("open"); $("guide").setAttribute("aria-hidden", "false"); $("scrim").hidden = false;
    if (id) { const s = $("g-" + id); if (s) { s.scrollIntoView({ block: "start" }); s.classList.add("flash"); setTimeout(() => s.classList.remove("flash"), 1200); } }
  }
  function closeGuide() { $("guide").classList.remove("open"); $("guide").setAttribute("aria-hidden", "true"); $("scrim").hidden = true; }

  /* ---------------- wiring ---------------- */
  $("sample").innerHTML += SAMPLES.map((s, i) => `<option value="${i}">${esc(s[1])}</option>`).join("");
  $("sample").onchange = (e) => { if (e.target.value !== "") loadSample(+e.target.value); };
  $("file").onchange = (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); };
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("over")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); });
  $("futSeg").onclick = (e) => { const b = e.target.closest("button"); if (b) { st.level = +b.dataset.v; run(); } };
  $("uhiSeg").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; st.ctx = b.dataset.v; if (PRESETS[st.ctx]) { st.svf = PRESETS[st.ctx].svf; st.fveg = PRESETS[st.ctx].fveg; } run(); };
  const slide = () => { st.svf = +$("svf").value; st.fveg = +$("fveg").value; const p = Object.keys(PRESETS).find((k) => PRESETS[k].svf === st.svf && PRESETS[k].fveg === st.fveg); st.ctx = p || "custom"; run(); };
  $("svf").oninput = slide; $("fveg").oninput = slide;
  $("dlBtn").onclick = download;
  $("main").addEventListener("click", (e) => { if (e.target.closest("[data-dl]")) download(); const x = e.target.closest("[data-exp]"); if (x) doExport(x.dataset.exp, x.dataset.sec); });
  $("linkBtn").onclick = async () => { writeHash(); try { await navigator.clipboard.writeText(location.href); $("linkBtn").textContent = "Link copied"; } catch (e) { $("linkBtn").textContent = "Copy the address bar"; } setTimeout(() => ($("linkBtn").textContent = "Copy a link to these settings"), 1800); };
  document.addEventListener("click", (e) => { const q = e.target.closest("[data-g]"); if (q) openGuide(q.dataset.g); });
  $("guideBtn").onclick = () => openGuide("what"); $("scrim").onclick = closeGuide;
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeGuide(); });
  addEventListener("hashchange", () => { readHash(); run(); });
  buildGuide(); readHash(); syncControls();
})();
