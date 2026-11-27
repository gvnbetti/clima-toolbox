/* Clima Morph: page logic. The modifiers are the shared core's (ClimaMods.prepWeather); the file is written by epwout.js. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const C = window.Clima, Mods = window.ClimaMods, X = window.ClimaMorph;
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
    hookCarpets();
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
    return `<section class="part"><h2>Month by month<button class="info" data-g="table" aria-label="About the table">?</button></h2>
      <div class="tscroll"><table class="t"><thead><tr><th>Month</th><th>Air, source °C</th><th>Air, morphed °C</th><th>Change K</th><th>Dew point, source °C</th><th>Dew point, morphed °C</th><th>RH, source %</th><th>RH, morphed %</th><th>Sky infrared, source W/m²</th><th>Sky infrared, morphed W/m²</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  // white to brick, 0 to vmax K
  const ramp = (v, vmax) => { const f = Math.max(0, Math.min(1, v / vmax)); const a = [246, 246, 243], b = [178, 69, 44]; return `rgb(${a.map((x, j) => Math.round(x + (b[j] - x) * f)).join(",")})`; };
  function carpet(id, arr, title, vmax) {
    const cw = 1.6, ch = 7, x0 = 34, y0 = 4, Wd = x0 + 365 * cw + 4, Hd = y0 + 24 * ch + 16;
    let s = `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="${esc(title)}" data-car="${id}">`;
    for (let d = 0; d < 365; d++) for (let h = 0; h < 24; h++) s += `<rect x="${(x0 + d * cw).toFixed(1)}" y="${y0 + h * ch}" width="${cw + 0.15}" height="${ch + 0.15}" fill="${ramp(arr[d * 24 + h], vmax)}"/>`;
    let k = 0; for (let m = 0; m < 12; m++) { s += `<text x="${(x0 + (k + MDAYS[m] / 2) * cw).toFixed(1)}" y="${Hd - 3}" text-anchor="middle">${MONTHS[m][0]}</text>`; k += MDAYS[m]; }
    for (const h of [0, 6, 12, 18]) s += `<text x="${x0 - 4}" y="${y0 + h * ch + 7}" text-anchor="end">${String(h).padStart(2, "0")}:00</text>`;
    return s + "</svg>";
  }
  function carpetSection() {
    const parts = [], zero = new Float64Array(8760);
    const fut = R.fut ? R.fut.dh : zero, uhi = R.uhi ? R.uhi.uhi : zero;
    let vmax = 0.5; for (let i = 0; i < 8760; i++) vmax = Math.max(vmax, fut[i], uhi[i]); vmax = Math.ceil(vmax * 2) / 2;
    CAR.fut = fut; CAR.uhi = uhi;
    parts.push(`<div class="carpet"><h3>Future climate, K</h3>${R.fut ? carpet("fut", fut, "Future change by day and hour", vmax) : `<p class="note">Present climate: no change.</p>`}</div>`);
    parts.push(`<div class="carpet"><h3>Heat island, K</h3>${R.uhi ? carpet("uhi", uhi, "Heat island by day and hour", vmax) : `<p class="note">As recorded: no change.</p>`}</div>`);
    return `<section class="part"><h2>Hour by hour<button class="info" data-g="carpets" aria-label="About the hourly charts">?</button></h2><div class="carpets">${parts.join("")}</div>
      <div class="legend"><span>0 K</span><span class="bar" style="background:linear-gradient(90deg,${ramp(0, 1)},${ramp(1, 1)})"></span><span>${f1(vmax)} K</span></div></section>`;
  }
  const CAR = {};
  function hookCarpets() {
    const tip = $("tip");
    for (const svg of document.querySelectorAll("svg[data-car]")) {
      const a = CAR[svg.dataset.car];
      svg.addEventListener("mousemove", (e) => {
        const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, x = (e.clientX - r.left) / r.width * vb.width, y = (e.clientY - r.top) / r.height * vb.height;
        const d = Math.floor((x - 34) / 1.6), h = Math.floor((y - 4) / 7);
        if (d < 0 || d > 364 || h < 0 || h > 23) { tip.style.display = "none"; return; }
        let m = 0, dd = d; while (dd >= MDAYS[m]) dd -= MDAYS[m++];
        tip.innerHTML = `<b>${dd + 1} ${MONTHS[m]}, ${String(h).padStart(2, "0")}:00 to ${String(h + 1).padStart(2, "0")}:00</b><br>${sg(a[d * 24 + h], 2)} K`;
        tip.style.display = "block"; tip.style.left = Math.min(innerWidth - 200, e.clientX + 12) + "px"; tip.style.top = e.clientY + 12 + "px";
      });
      svg.addEventListener("mouseleave", () => (tip.style.display = "none"));
    }
  }

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
  $("main").addEventListener("click", (e) => { if (e.target.closest("[data-dl]")) download(); });
  $("linkBtn").onclick = async () => { writeHash(); try { await navigator.clipboard.writeText(location.href); $("linkBtn").textContent = "Link copied"; } catch (e) { $("linkBtn").textContent = "Copy the address bar"; } setTimeout(() => ($("linkBtn").textContent = "Copy a link to these settings"), 1800); };
  document.addEventListener("click", (e) => { const q = e.target.closest("[data-g]"); if (q) openGuide(q.dataset.g); });
  $("guideBtn").onclick = () => openGuide("what"); $("scrim").onclick = closeGuide;
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeGuide(); });
  addEventListener("hashchange", () => { readHash(); run(); });
  buildGuide(); readHash(); syncControls();
})();
