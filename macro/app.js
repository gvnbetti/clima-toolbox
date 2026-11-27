/* Macro Clima: page logic. Loading, the reading, chart cards, filter, exports, explorer, Claude Inspection. */
(function () {
  "use strict";
  const C = window.Clima, K = window.K, S = window.Sections, fmt = K.fmt, esc = K.esc, N = C.N;
  const $ = (id) => document.getElementById(id);
  const BUNDLED = [
    ["data/epw/DEU_BE_Berlin-Tegel.AP.103820_TMYx.epw.txt", "Berlin, Germany", "Berlin-Tegel Airport, Germany", "Cfb"],
    ["data/epw/GBR_ENG_London.Wea.Ctr-St.James.Park.037700_TMYx.epw.txt", "London, UK", "London St James's Park, UK", "Cfb"],
    ["data/epw/RUS_MOS_Moscow-Bibirevo.276120_TMYx.epw.txt", "Moscow, Russia", "Moscow-Bibirevo, Russia", "Dfb"],
    ["data/epw/ESP_MD_Madrid.WS.082200_TMYx.epw.txt", "Madrid, Spain", "Madrid, Spain", "Csa"],
    ["data/epw/ITA_LZ_Rome.162400_TMYx.epw.txt", "Rome, Italy", "Rome, Italy", "Csa"],
    ["data/epw/EGY_QH_Cairo.Intl.AP.623660_TMYx.epw.txt", "Cairo, Egypt", "Cairo International Airport, Egypt", "BWh"],
    ["data/epw/ARE_DU_Dubai.Intl.AP.411940_TMYx.epw.txt", "Dubai, UAE", "Dubai International Airport, UAE", "BWh"],
    ["data/epw/IND_MH_Mumbai-Shivaji.Intl.AP.430030_TMYx.epw.txt", "Mumbai, India", "Mumbai Chhatrapati Shivaji Airport, India", "Am"],
    ["data/epw/SGP_SG_Singapore-Changi.Intl.AP.486980_Custom.epw.txt", "Singapore", "Singapore Changi Airport", "Af"],
    ["data/epw/CHN_SH_Shanghai-Hongqiao.Intl.AP.583670_TMYx.epw.txt", "Shanghai, China", "Shanghai Hongqiao Airport, China", "Cfa"],
    ["data/epw/MEX_CMX_Ciudad.Mexico.Central.766800_TMYx.epw.txt", "Mexico City, Mexico", "Mexico City Central, Mexico", "Cwb"]];
  const st = { fut: 0, uhi: { on: false, preset: "urban", svf: 0.6, fveg: 0.2 }, range: "local", scaleOv: {}, axisOv: {}, hdd: 15, cdd: 18, gtz: false, adm: "en2", filter: { m1: 1, m2: 12, h1: 0, h2: 23 }, ui: {}, nv: { tMin: 10, tMax: 24, dpMax: 16 }, cc: JSON.parse(JSON.stringify(C.CC_DEFAULT)), ccSel: new Set(["comfort", "internal", "solarLow", "fan", "natVent", "mass"]), ex: { v: "dbt", x: "dbt", y: "rh", c: "ghi", fv: "ws", fmin: "", fmax: "" }, insp: null };
  let ctx = null, catalogue = null, catPromise = null;
  const files = []; // the data model holds several files; the page shows the first. Comparison will use the second.

  /* ---------------- loading ---------------- */
  async function loadText(text, name, label) {
    $("loaderr").hidden = true;
    let W;
    try { W = C.parseEPW(text, name); } catch (e) { showErr(e.message); return; }
    const t0 = performance.now();
    files[0] = { W0: W, name, label };
    const P = prepWeather(W), X = C.processWeather(P.W, { params: st.cc });
    files[0].W = P.W; files[0].X = X;
    await catalogueReady();
    ctx = makeCtx(P.W, X, name, label); ctx.W0 = W; ctx.uhi = P.uhi; ctx.fut = P.fut;
    console.log("processed in", Math.round(performance.now() - t0), "ms");
    st.insp = null;
    render(); uhiSync(); futSync(); wxInfo();
  }
  // urban heat island (Theeuwes et al. 2017, as in Micro Clima): raise air temperature, hold vapour pressure
  function prepWeather(W0, level, withUhi) {
    level = level === undefined ? st.fut : level; withUhi = withUhi === undefined ? st.uhi.on : withUhi;
    let W = W0, fut = null;
    if (level) { const reg = futRegion(W0), d = reg ? C.futureDelta(window.CLIMA_FUTURE, reg.id, level, futMid(W0).year) : null; if (d) { const m = C.morphWeather(W0, d); W = Object.assign({}, W0, { dbt: m.dbt, dpt: m.dpt, hir: m.hir, prec: m.prec }); fut = Object.assign(d, { region: reg, dh: m.dh }); } }
    if (!withUhi) return { W, uhi: null, fut };
    const S0 = C.solarArrays(W.meta.lat, W.meta.lon, W.meta.tz), u = C.urbanHeatIsland(W, S0, st.uhi.svf, st.uhi.fveg);
    return { W: Object.assign({}, W, { dbt: u.dbt, rh: u.rh }), uhi: u, fut };
  }
  /* future climate: IPCC AR6 region of the file, and the middle of its years */
  const FUT_LEVELS = [[1.5, "+1.5 °C", "around 2030"], [2, "+2 °C", "around 2050"], [3, "+3 °C", "around 2080 to 2100"]];
  const futLab = (L) => { const x = FUT_LEVELS.find((f) => f[0] === L); return x ? `${x[1]} global warming, ${x[2]}` : ""; };
  const futRegion = (W) => (window.CLIMA_REGIONS ? C.regionOf(W.meta.lat, W.meta.lon, window.CLIMA_REGIONS) : null);
  const REG_NAMES = { GIC: "Greenland and Iceland", NWN: "North-West North America", NEN: "North-East North America", WNA: "Western North America", CNA: "Central North America", ENA: "Eastern North America", NCA: "Northern Central America", SCA: "Southern Central America", CAR: "Caribbean", NWS: "North-West South America", NSA: "Northern South America", NES: "North-East South America", SAM: "South American Monsoon", SWS: "South-West South America", SES: "South-East South America", SSA: "Southern South America", NEU: "Northern Europe", WCE: "Western and Central Europe", EEU: "Eastern Europe", MED: "Mediterranean", SAH: "Sahara", WAF: "Western Africa", CAF: "Central Africa", NEAF: "North Eastern Africa", SEAF: "South Eastern Africa", WSAF: "West Southern Africa", ESAF: "East Southern Africa", MDG: "Madagascar", RAR: "Russian Arctic", WSB: "Western Siberia", ESB: "Eastern Siberia", RFE: "Russian Far East", WCA: "West Central Asia", ECA: "East Central Asia", TIB: "Tibetan Plateau", EAS: "East Asia", ARP: "Arabian Peninsula", SAS: "South Asia", SEA: "South-East Asia", NAU: "Northern Australia", CAU: "Central Australia", EAU: "Eastern Australia", SAU: "Southern Australia", NZ: "New Zealand", EAN: "East Antarctica", WAN: "West Antarctica" };
  const regName = (r) => (r ? REG_NAMES[r.id] || r.name.replace(/[.-]/g, " ") : "");
  function futMid(W) {
    const t = (files[0] && files[0].name || "") + " " + W.meta.comments.join(" "), m = t.match(/(\d{4})\s*-\s*(\d{4})/g);
    const per = (t.match(/Period of Record\s*=?\s*(\d{4})\s*-\s*(\d{4})/i) || t.match(/TMYx\.?(\d{4})-(\d{4})/i));
    if (per) return { year: (+per[1] + +per[2]) / 2, from: +per[1], to: +per[2], known: true };
    return { year: 2010, known: false };
  }
  const UHI_PRESETS = { suburban: { svf: 0.8, fveg: 0.35 }, urban: { svf: 0.6, fveg: 0.2 }, dense: { svf: 0.4, fveg: 0.1 } };
  const uhiLabel = () => { const p = Object.keys(UHI_PRESETS).find((k) => UHI_PRESETS[k].svf === st.uhi.svf && UHI_PRESETS[k].fveg === st.uhi.fveg); return `${p || "custom"} neighbourhood, sky view factor ${st.uhi.svf.toFixed(2)}, vegetation fraction ${st.uhi.fveg.toFixed(2)}`; };
  const airportLike = () => { const t = `${ctx.name} ${ctx.site ? ctx.site.title : ""} ${ctx.W.meta.city}`; return /(\bAP\b|\.AP\.|Intl|Airport|Airfield|AFB|Aero|Flughafen|Aeroporto|Aeropuerto|Aéroport|RAF)/i.test(t); };
  async function reprocess() {
    const f = files[0]; if (!f) return;
    const anchor = [...document.querySelectorAll(".card, section.part")].find((c) => c.getBoundingClientRect().bottom > 80), off = anchor ? anchor.getBoundingClientRect().top : 0;
    const P = prepWeather(f.W0), X = C.processWeather(P.W, { params: st.cc }); f.W = P.W; f.X = X;
    ctx = makeCtx(P.W, X, f.name, f.label); ctx.W0 = f.W0; ctx.uhi = P.uhi; ctx.fut = P.fut;
    for (const k in rendered) delete rendered[k];
    render(); uhiSync(); futSync();
    if (anchor && document.getElementById(anchor.id)) window.scrollBy(0, document.getElementById(anchor.id).getBoundingClientRect().top - off);
  }
  function futSync() {
    for (const b of document.querySelectorAll("#futSeg button")) b.setAttribute("aria-pressed", +b.dataset.v === st.fut);
    if (!ctx) return;
    const reg = futRegion(ctx.W0), mid = futMid(ctx.W0), notes = [];
    if (reg) notes.push(`IPCC region: ${esc(regName(reg))} (${reg.id}). Change measured from the file's years${mid.known ? ` (${mid.from}-${mid.to})` : ""}.`);
    if (!mid.known) notes.push(`<span class="warmtxt">The file does not state its years; they are taken to centre on 2010.</span>`);
    if (st.fut && ctx.fut) { const a = ctx.fut.dT.reduce((x, v) => x + v, 0) / 12; notes.push(`Applied: ${fmt(a, 1)} K on average over the year, ${fmt(Math.min(...ctx.fut.dT), 1)} to ${fmt(Math.max(...ctx.fut.dT), 1)} K by month.`); }
    $("futnote").innerHTML = K.U.text(notes.map((x) => `<span>${x}</span>`).join(""));
  }
  function uhiSync() {
    const on = st.uhi.on; for (const b of document.querySelectorAll("#uhiSeg button")) b.setAttribute("aria-pressed", on ? b.dataset.v === (Object.keys(UHI_PRESETS).find((k) => UHI_PRESETS[k].svf === st.uhi.svf && UHI_PRESETS[k].fveg === st.uhi.fveg) || "") : b.dataset.v === "off");
    $("uhibox").hidden = !on; $("svf").value = st.uhi.svf; $("svfo").textContent = st.uhi.svf.toFixed(2); $("fveg").value = st.uhi.fveg; $("fvego").textContent = st.uhi.fveg.toFixed(2);
    if (!ctx) return;
    const notes = []; if (on && ctx.uhi) notes.push(`Heat island factor ${ctx.uhi.factor.toFixed(2)} (2 − sky view factor − vegetation fraction). Estimated heat island: ${fmt(ctx.uhi.nightMean, 1)} K on average with the sun down, up to ${fmt(ctx.uhi.max, 1)} K.`);
    if (on && !C.isNWEurope(ctx.W.meta.lat, ctx.W.meta.lon)) notes.push(`<span class="warmtxt">The model was calibrated on cities in north-western Europe. For this location the estimate is indicative.</span>`);
    if (on && !airportLike()) notes.push(`<span class="warmtxt">This station's name does not mark it as an airport. If it stands in a built-up area, its data already hold part of the heat island, and this estimate adds it again.</span>`);
    $("uhinote").innerHTML = K.U.text(notes.map((x) => `<span>${x}</span>`).join(" "));
  }
  function showErr(m) { const e = $("loaderr"); e.textContent = m; e.hidden = false; }
  function makeCtx(W, X, name, label) {
    const m = W.meta;
    const site = matchSite(W, name);
    const fromFile = [m.city.replace(/[_.]+/g, " ").replace(/\s+/g, " ").trim(), m.country].filter(Boolean).join(", ");
    const siteName = label || (site && !/[_]/.test(site.title) ? site.title : fromFile || (site ? site.title.replace(/_/g, " ") : name));
    const period = (name.match(/TMYx\.?(\d{4}-\d{4})/i) || [])[1] || (site && site.period ? site.period.replace(/^TMYx\s*/, "") : "") || ((m.comments.join(" ").match(/Period of Record\s*=?\s*([0-9]{4}\s*-\s*[0-9]{4})/i) || [])[1] || "");
    const c = { W, X, st, siteName, site, koppen: site ? site.kg : null, period: period ? `the years ${period}` : "", name };
    c.R = S.summarise(W, X, Object.assign({}, st, { siteTitle: site ? site.title : "" }));
    if (!st.gtzTouched) { st.gtz = c.R.isDE; $("gtz").checked = c.R.isDE; }
    if (!st.admTouched) { st.adm = S.defaultAdaptive(m.country); }
    return c;
  }
  function matchSite(W, name) {
    if (!catalogue) return null; const m = W.meta; let best = null, bd = 0.15 ** 2;
    for (const s of catalogue.sites) { const d = (s[0] - m.lat) ** 2 + (s[1] - m.lon) ** 2; if (d < bd) { bd = d; best = s; } }
    if (!best) return null;
    const f = best[5].find((x) => name && x[1].replace(/\.zip$/i, "").includes(name.replace(/\.epw$/i, "")));
    return { title: best[2], elev: best[3], kg: best[4], period: f ? f[2] : "", files: best[5] };
  }
  function catalogueReady() {
    if (catalogue) return Promise.resolve(catalogue);
    if (!catPromise) catPromise = (async () => {
      try {
        const r = await fetch("data/stations.js"); const js = await r.text(); const b64 = js.slice(js.indexOf('"') + 1, js.lastIndexOf('"')); const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); let txt;
        try { const ds = new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))); txt = await ds.text(); }
        catch (e) { txt = new TextDecoder().decode(window.fflate.gunzipSync(buf)); }
        catalogue = JSON.parse(txt);
      } catch (e) { console.warn("catalogue", e); catalogue = { hosts: [], dirs: [], sites: [] }; }
      return catalogue;
    })();
    return catPromise;
  }
  async function loadBundled(i) { const [url, label, nice] = BUNDLED[i]; $("main").innerHTML = `<div class="loading">Loading ${esc(label)}</div>`; const r = await fetch(url); const t = await r.text(); await loadText(t, url.split("/").pop().replace(/\.txt$/, ""), nice); }
  const UPL = []; // files the user loaded in this session, listed after the bundled ones as in Micro and Room Clima
  function fillWx(sel) {
    $("bundled").innerHTML = BUNDLED.map((b, i) => `<option value="${i}">${esc(b[1])} (${b[3]})</option>`).join("") + UPL.map((u, k) => `<option value="u${k}">${esc(u.label)}</option>`).join("");
    if (sel != null) $("bundled").value = sel;
  }
  function addUpload(text, name) {
    const ok = !!ctx && ctx.name === name; if (!ok) return;
    const m = ctx.W0.meta, kg = ctx.site && ctx.site.kg ? ` (${ctx.site.kg})` : "";
    UPL.push({ text, name, label: (m.city || name.replace(/\.epw$/i, "")).replace(/[._]+/g, " ").trim() + kg }); fillWx("u" + (UPL.length - 1));
  }
  function wxInfo() {
    if (!ctx) return; const m = ctx.W0.meta, t = ctx.W0.dbt; let a = 0; for (let i = 0; i < t.length; i++) a += t[i];
    $("wxinfo").textContent = `${m.source || "EPW"}${m.country ? ", " + m.country : ""}; ${m.lat.toFixed(2)}°, ${m.lon.toFixed(2)}°; mean ${(a / t.length).toFixed(1)} °C`;
  }
  // any failure while reading a file shows in the weather box, never silently
  addEventListener("unhandledrejection", (e) => showErr("Something went wrong: " + (e.reason && e.reason.message || e.reason)));
  addEventListener("error", (e) => { if (e.message) showErr("Something went wrong: " + e.message); });
  async function loadFile(file) {
    $("wxinfo").textContent = `Reading ${file.name}`;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      if (/\.zip$/i.test(file.name) || (buf[0] === 0x50 && buf[1] === 0x4b)) {
        const z = window.fflate.unzipSync(buf); const k = Object.keys(z).find((n) => /\.epw$/i.test(n));
        if (!k) { showErr("The ZIP holds no EPW file."); return; }
        const text = new TextDecoder("windows-1252").decode(z[k]), name = k.split("/").pop(); await loadText(text, name); addUpload(text, name);
      } else { const text = new TextDecoder("windows-1252").decode(buf); await loadText(text, file.name); addUpload(text, file.name); }
    } catch (e) { showErr("The file could not be read: " + e.message); }
  }

  /* ---------------- filter ---------------- */
  function filterMask() {
    const f = st.filter; if (f.m1 === 1 && f.m2 === 12 && f.h1 === 0 && f.h2 === 23) return null;
    const m = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const mo = C.T.month[i], h = C.T.hour[i]; const inM = f.m1 <= f.m2 ? mo >= f.m1 && mo <= f.m2 : mo >= f.m1 || mo <= f.m2; const inH = f.h1 <= f.h2 ? h >= f.h1 && h <= f.h2 : h >= f.h1 || h <= f.h2; m[i] = inM && inH ? 1 : 0; }
    return m;
  }
  function filterLabel() { const f = st.filter; if (!filterMask()) return ""; return `Filter: ${C.MONTHS[f.m1 - 1]} to ${C.MONTHS[f.m2 - 1]}, ${String(f.h1).padStart(2, "0")}:00 to ${String(f.h2 + 1).padStart(2, "0")}:00`; }

  /* ---------------- cards ---------------- */
  const ui = (card, key, def) => (key === "adm" ? st.adm : st.ui[card] && st.ui[card][key] != null ? st.ui[card][key] : def);
  const greyHex = () => (document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches) ? "#3a4442" : "#d3d7d2");
  function carpetOf(key, mask, extra) {
    const V = S.V[key], a = V.get(ctx.W, ctx.X), sc = S.scaleFor(key, ctx);
    if (V.utci) return utciCarpet(a, mask, V.label);
    return { html: K.carpet({ vals: a, mask, scale: sc, unit: V.unit, label: V.label, greyHex: greyHex(), colorOf: (v) => sc.color(v), tip: (i) => `<b>${S.hourOf(i)}</b><br>${esc(V.label)}: ${fmt(a[i], V.dec)} ${V.unit}${extra ? extra(i) : ""}` }), csv: () => hourlyCsv([[V.label + " (" + V.unit + ")", a]]) };
  }
  function utciCarpet(a, mask, label) {
    return { html: K.carpet({ vals: a, mask, greyHex: greyHex(), label, colorOf: (v) => { const c = C.utciClass(v); return c < 0 ? null : K.UTCI_COLORS[c]; }, tip: (i) => `<b>${S.hourOf(i)}</b><br>UTCI ${fmt(a[i], 1)} °C<br>${C.utciClass(a[i]) >= 0 ? C.UTCI_CLASSES[C.utciClass(a[i])][2] : "outside the model range"}`, legend: C.UTCI_CLASSES.map((c, k) => [K.UTCI_COLORS[k], c[2].replace(" stress", "")]).reverse() }), csv: () => hourlyCsv([[label + " (°C)", a]]) };
  }
  function hourlyCsv(cols) { const head = ["month", "day", "hour (interval ending)"].concat(cols.map((c) => c[0])); const rows = [head.join(",")]; for (let i = 0; i < N; i++) rows.push([C.T.month[i], C.T.day[i], C.T.hour[i] + 1].concat(cols.map((c) => (isFinite(c[1][i]) ? +(+c[1][i]).toFixed(3) : ""))).join(",")); return rows.join("\n"); }
  function monthlyCsv(series, unit) { const rows = [["month"].concat(series.map((s) => `${s.name} (${unit})`)).join(",")]; for (let k = 0; k < 12; k++) rows.push([C.MONTHS[k]].concat(series.map((s) => (isFinite(s.vals[k]) ? +s.vals[k].toFixed(3) : ""))).join(",")); return rows.join("\n"); }
  const legendHtml = (items) => `<div class="legend">${items.map(([c, t]) => `<span><i style="background:${c}"></i>${esc(t)}</span>`).join("")}</div>`;
  const varSel = (keys, def) => ({ k: "v", label: "Variable", options: S.varOptions(keys), def });

  const ASSUME = "Fixed assumptions, as in PVWatts: crystalline silicon panels, open-rack mounting; sunlight on the panel from the Perez 1990 model; reflection losses by angle of incidence (Martin and Ruiz, a_r 0.16, for direct, sky and ground light); cell temperature from air temperature, sunlight and wind (Faiman, U0 25, U1 6.84); power falls 0.37 % per kelvin above 25 °C; 14 % system losses (wiring, soiling, mismatch, availability); PVWatts inverter, 96 % nominal efficiency, DC/AC ratio 1.2. Not included: shading by the horizon or surroundings, snow cover, dust beyond the 14 %, bifacial gain, tracking.";
  const PV_EFF = 0.2; // panel efficiency used only to turn kWh/kWp into kWh per m² of panel: 200 Wp per m²
  const ROOFINFO = "Rows of panels on a flat roof shade one another. Cover is panel area divided by roof area: 100 % is panels laid flat edge to edge. For tilted rows, wider spacing lowers the cover and the shading. Yield per m² of roof assumes 20 % efficient panels (200 Wp per m² of panel). Shading model, as in pvlib: infinite rows; direct and circumsolar light cut by the shaded fraction of the row, with the stepped electrical loss of Martínez-Moreno et al. 2010 for three bypass-diode blocks across the row height; sky light reduced by the masking angle of the row in front (Passias and Källbäck 1984); light reflected from the roof scaled by one minus the cover. Diamonds mark the spacing rule: no shading between 10h and 14h, local standard time, on the winter solstice. Not included: edge rows (the first row is unshaded), walkways, setbacks and roof plant; the cover applies to the usable area. ";
  const FUTINFO = "Regional change from CMIP6 models, as aggregated by the IPCC AR6 WGI Atlas (Iturbide et al. 2021) over the IPCC reference regions (land). For each model and scenario (SSP1-2.6, 2-4.5, 3-7.0, 5-8.5), a warming level is the 20 years centred where the model's global mean first reaches it, measured from 1850-1900. Each model counts once (the median over its scenarios); the line is the median of the models, the band their 10th to 90th percentile. The change is measured from the file's own years, using the models' change from 1995-2014 to those years, so warming already in the file is not counted twice. The approximate years come from the current assessment of global warming (1.37 °C in 2025, rising about 0.27 °C per decade; current policies lead to about 2.8 °C by 2100); raw models reach each level some years earlier. ";
  const SECTIONS = [
    { id: "summary", title: "Climate at a glance", reading: "summary", cards: [
      { id: "c-glance", title: "What the key figures mean, and how they compare", sub: "Each figure placed among reference climates computed the same way", wide: true, render: glanceCard, info: "Reference climates, typical-year files from Climate.OneBuilding.Org read with this app: Berlin, London, Moscow, Madrid, Rome, Cairo, Dubai, Mumbai, Singapore, Shanghai and Mexico City. They span equatorial to cold continental and desert to oceanic climates. A file loaded from one of these places is left out of its own scale. Hover a tick to see its value." },
      { id: "c-identity", title: "Location and file", render: identityCard },
      { id: "c-monthT", title: "Monthly temperature", sub: "Mean daily maximum, mean and mean daily minimum", render: monthTCard, info: "Each month shows the average of the daily maxima, the monthly mean and the average of the daily minima. The shaded band spans the two averages, not the extremes." },
      { id: "c-monthR", title: "Daily solar radiation on the horizontal", sub: "Monthly average, split into direct and diffuse", render: monthRCard, info: "Global horizontal radiation is the sum of the direct beam projected onto the horizontal and the diffuse radiation from the rest of the sky. The bars show the daily average of each month in kWh/m²." },
      { id: "c-dd", title: "Degree days by month", tools: [{ k: "g", label: "Measure", options: [["auto", "Follow the setting at the left"], ["dd", "Heating and cooling degree days"], ["gtz", "Gradtagzahl G 20/15"]], def: "auto" }], render: ddCard, info: "Heating degree days add up, day by day, how far the daily mean temperature falls below the heating base. Cooling degree days add up how far it rises above the cooling base. The German Gradtagzahl G 20/15 adds 20 °C minus the daily mean on every day with a mean below 15 °C." }] },
    { id: "extremes", title: "Extremes and events", reading: "extremes", tiles: extremeTiles, cards: [
      { id: "c-calendar", title: "Calendar of events", sub: "Each square is a day", wide: true, render: calendarCard, info: "Summer day: maximum 25 °C or more. Hot day: maximum 30 °C or more. Tropical night: minimum 20 °C or more. Frost day: minimum below 0 °C. Ice day: maximum below 0 °C. Overcast day: daytime sky cover of 8 tenths or more, or a daily clearness index below 0.3 where the file has no sky cover." },
      { id: "c-weeks", title: "Seven-day running mean", sub: "With the hottest and the coldest week", wide: true, render: weeksCard },
      { id: "c-hotweek", title: "The hottest week, hour by hour", sub: "With the day before and after; nights shaded", wide: true, render: () => weekCard(true) },
      { id: "c-coldweek", title: "The coldest week, hour by hour", sub: "With the day before and after; nights shaded", wide: true, render: () => weekCard(false) }] },
    { id: "future", title: "Future climate", reading: "future", cards: [
      { id: "c-futT", title: "Change in monthly mean temperature", sub: "From this file's years to each warming level, kelvin", wide: true, render: futTCard, info: FUTINFO + "Applied to the file as a shift of air temperature, interpolated day by day between the mid-month values; relative humidity is held, so dew point rises. Day-night swing and the spread of hot and cold spells stay as recorded." },
      { id: "c-futP", title: "Change in monthly precipitation", sub: "From 1995-2014 to each warming level, percent", wide: true, render: futPCard, info: FUTINFO + "Applied to the file by scaling hourly precipitation month by month. Model spread for precipitation is wide; the band shows it." },
      { id: "c-futReg", title: "This region against the global average", sub: "Warming since 1850-1900 at each global warming level", wide: true, render: futRegCard, info: FUTINFO + "Global: land and sea, by definition equal to the level. All land: the mean over all land, which warms faster than the oceans. Shaded cells: the region warms more (warm) or less (cool) than the global mean, by more than 10 %. Precipitation: change of the seasonal or annual mean from 1850-1900, compared with the mean over all land." },
      { id: "c-futCmp", title: "Present and future compared", sub: "This file as recorded, and morphed to each warming level", wide: true, render: futCmpCard, info: FUTINFO + "Indicators are counted on the morphed hourly data. Outdoor heat stress uses the UTCI in the sun and in the wind, with the mean radiant temperature shifted by the same amount as the air. With an urban context on, the heat island is added in every column." }] },
    { id: "temperature", title: "Temperature and humidity", reading: "temperature", cards: [
      { id: "c-daily", title: "Daily temperature through the year", sub: "Daily range and mean, with an adaptive comfort band", wide: true, tools: [{ k: "adm", label: "Comfort model", options: S.ADAPT, def: null }], render: dailyCard, info: "The grey band spans each day's minimum and maximum air temperature; the line is the daily mean. The green band is the adaptive comfort range of the chosen standard, computed from the running mean of outdoor temperature (EN 16798-1 and its German annex: exponentially weighted, α = 0.8; ASHRAE 55: mean of the previous 7 days). It describes indoor operative temperatures that occupants of naturally ventilated buildings accept. Where the running mean lies outside the range the standard covers (EN: 10 to 30 °C; ASHRAE: 10 to 33.5 °C), the band is held at its limit values and drawn lighter. Default: the German annex for German stations, EN 16798-1 category II elsewhere in Europe, ASHRAE 55 at 80 % acceptability in the rest of the world." },
      { id: "c-profiles", title: "Average day of each month", tools: [varSel(["dbt", "rh", "dpt", "twb", "w", "ghi", "ws"], "dbt")], wide: true, render: profilesCard, info: "Each panel is one month. The line is the mean of each hour across the month's days; the band runs from the lowest to the highest value at that hour." },
      { id: "c-uhi", title: "Estimated urban heat island", sub: "Added to the station's air temperature, kelvin", when: () => !!(ctx && ctx.uhi), wide: true, render: uhiCard, info: "Theeuwes et al. (2017): the daily maximum heat island equals (2 − SVF − Fveg) × (S × DTR³ / U)^¼, with S the daily mean global radiation divided by ρcp, DTR the station's daily temperature range and U its daily mean wind (at least 0.5 m/s). S is averaged from 01:00 to midnight, the range and wind from 08:00 to 07:00 the next day, and the value applies to that window. The daily maximum applies in full with the sun down and falls to 15 % at the daily sun peak (assumed profile, as in Micro Clima). Vapour pressure is held, so dew point and humidity ratio stay as recorded and relative humidity falls. Calibrated on 14 cities in north-western Europe for sky view factors 0.2 to 0.9 and vegetation fractions up to 0.4. Wind and radiation stay as recorded: urban wind is lower, which the model does not cover. The same model and code as Micro Clima; daytime cooling by tree canopy is left to Micro Clima." },
      { id: "c-carpet", title: "Hour by hour", tools: [varSel(["dbt", "dpt", "twb", "rh", "w", "p"], "dbt")], wide: true, render: (u) => carpetOf(u.v, ctx.mask), info: "Each column is a day, each row an hour. Hours outside the filter are grey." },
    ] },
    { id: "sun", title: "Sun and sky", reading: "sun", cards: [
      { id: "c-sunpath", title: "Sun path", wide: true, sub: "Every daylight hour of the year, coloured by a variable", tools: [{ k: "proj", label: "View", options: [["polar", "Equidistant"], ["ortho", "Orthographic, from above"], ["cyl", "Cylindrical"], ["3d", "3D"]], def: "polar" }, { k: "v", label: "Data overlay", options: [["none", "No data overlay"]].concat(S.varOptions(["dbt", "ghi", "dni", "dhi", "tsc", "rh", "ws", "utci_sw"])), def: "dbt" }], render: sunpathCard, info: "Equidistant: the sky seen from the ground, looking up; the centre is the zenith, the outer circle the horizon, altitude scales evenly with distance from the edge. Cylindrical: azimuth across, altitude up, centred on the equator-facing direction. 3D: the sky dome from outside; drag to turn it. Arcs are the 21st of each month: solstices bold, equinoxes solid, the other months dashed. With no data overlay the arcs turn orange and the hourly analemmas stay in the background. Each dot is the sun at the middle of an hour of the file, coloured by the chosen variable. Positions are computed at the midpoint of each EPW interval." },
      { id: "c-sunsection", title: "Sun path section", wide: true, sub: "Noon sun angles at the solstices and the equinoxes", render: sunSectionCard, info: "The 3D sun path seen from the west, in parallel projection, and cut along the north-south line. In this view each day\'s path appears as a straight line and each hour traces a figure of eight (the analemma) across the year; the analemmas are drawn for each clock hour from sunrise to solar noon on the summer solstice; the afternoon ones fall behind them in this view. The rays show the sun at true solar noon, when it is highest and due south or due north (between the tropics the noon sun is to the north for part of the year, and to the south for the rest), on 21 June, the equinoxes and 21 December. The shaded fan is the range of noon altitudes over the year. The clock time of solar noon, in local standard time, is given in the hover and the table." },
      { id: "c-sky", title: "Sky condition by month", wide: true, sub: "Hours by total sky cover", tools: [{ k: "h", label: "Hours", options: [["all", "All hours"], ["day", "Daylight hours only"]], def: "all" }], render: skyCard, info: "Total sky cover: the share of the sky covered by cloud, in tenths, as recorded in the file; clear is 0 to 2 tenths, partly cloudy 3 to 7, overcast 8 to 10. Daylight hours: sun above the horizon at the middle of the hour. Most stations report sky cover every hour or every three hours, with the hours between interpolated, and automatic stations see only clouds below about 3.7 km, so thin high cloud is often missed." },
      { id: "c-suncarpet", title: "Radiation and cloud, hour by hour", tools: [varSel(["ghi", "dni", "dhi", "tsc", "hir"], "ghi")], wide: true, render: (u) => carpetOf(u.v, ctx.mask) }] },
    { id: "surfaces", title: "Radiation on façades and roof", reading: "surfaces", cards: [
      { id: "c-orient", title: "Annual irradiation by orientation", sub: "Vertical façades and the horizontal roof, kWh/m²", render: orientCard, info: "Irradiation on each surface adds the direct beam, the diffuse sky (Perez 1990 model) and radiation reflected from the ground (the file's albedo, or 0.2 where it is missing). Surroundings and self-shading are not included." },
      { id: "c-orientSeason", title: "Summer and winter irradiation by surface", sub: "Sum of the three summer and the three winter months, kWh/m²", render: orientSeasonCard },
      { id: "c-orientM", title: "Monthly irradiation by orientation", sub: "kWh/m² per month", wide: true, render: orientMCard },
      { id: "c-surfcarpet", title: "Irradiance on façades and roof, hour by hour", sub: "One colour scale for all surfaces", tools: [{ k: "v", label: "Surface", options: [["grid", "All eight façades and the roof"]].concat(S.varOptions(["surfS", "surfSE", "surfE", "surfNE", "surfN", "surfNW", "surfW", "surfSW", "surfRoof"])), def: "grid" }], wide: true, render: surfCarpetCard }] },
    { id: "pv", title: "PV Potential", reading: "pv", cards: [
      { id: "c-pvMap", title: "Yield by tilt and orientation", sub: "Share of the best fixed plane, per kWp", wide: true, render: pvMapCard, info: "Each cell is the annual electricity from one kWp of panels at that tilt and orientation, as a share of the best. Tilt 0° is flat, 90° vertical; the top row is the eight façades. Hover for kWh/kWp. " + ASSUME },
      { id: "c-pvYear", title: "Yield over the year by surface", sub: "Per m² of panel or per kWp", tools: [{ k: "u", label: "Unit", options: [["m2", "kWh per m² of panel"], ["kwp", "kWh per kWp"]], def: "m2" }], wide: true, render: pvYearCard, info: "Per m² of panel assumes 20 % efficient panels, 200 Wp per m², typical of current crystalline modules. For other panels, scale in proportion: at 22 %, multiply by 1.1. " + ASSUME },
      { id: "c-pvMonthly", title: "Yield by month", sub: "Per m² of panel or per kWp", tools: [{ k: "u", label: "Unit", options: [["m2", "kWh per m² of panel"], ["kwp", "kWh per kWp"]], def: "m2" }], wide: true, render: pvMonthlyCard, info: "Per m² of panel assumes 20 % efficient panels, 200 Wp per m², which is typical of current crystalline modules. For other panels, scale in proportion: at 22 %, multiply by 1.1. " + ASSUME },
      { id: "c-pvLoss", title: "From sunlight to electricity", sub: "Annual, per kWp; each loss as a share of the step before", wide: true, render: pvLossCard, info: "Sunlight on the panel in kWh/m² equals the yield in kWh/kWp a panel would give at standard test conditions (1000 W/m², 25 °C). The steps below take away reflection, heat, system losses and the inverter, in that order. A negative heat loss is a gain: panels colder than 25 °C produce more. " + ASSUME },
      { id: "c-pvRoof", title: "Rows on a flat roof: spacing and yield", sub: "Each line one tilt; across, the share of the roof covered by panels", tools: [{ k: "lay", label: "Layout", options: [["eq", "Rows facing the equator"], ["ew", "East-west tents"]], def: "eq" }, { k: "m", label: "Measure", options: [["roof", "kWh per m² of roof"], ["kwp", "kWh per kWp"], ["shade", "Shading loss, %"]], def: "roof" }], wide: true, render: pvRoofCard, info: ROOFINFO + ASSUME },
      { id: "c-pvRoofCmp", title: "Flat roof layouts compared", sub: "Yield per m² of roof", wide: true, render: pvRoofCmpCard, info: ROOFINFO + ASSUME },
      { id: "c-pvCarpet", title: "PV output, hour by hour", sub: "W per kWp", tools: [varSel(["pvBest", "pvFlat", "pvS", "pvE", "pvW", "pvN"], "pvBest")], wide: true, render: (u) => carpetOf(u.v, ctx.mask), info: ASSUME }] },
    { id: "daylight", title: "Daylight", reading: "daylight", cards: [
      { id: "c-lux", title: "Hours above illuminance thresholds", sub: "Hours per day, monthly average", render: luxCard, info: "Global horizontal illuminance is the visible light falling on an unobstructed horizontal plane, as recorded or modelled in the weather file. 10 klx is roughly an overcast winter noon; 50 klx a bright summer day." },
      { id: "c-luxcarpet", title: "Illuminance, hour by hour", tools: [varSel(["gil", "dil"], "gil")], wide: true, render: (u) => carpetOf(u.v, ctx.mask) }] },
    { id: "wind", title: "Wind", reading: "wind", cards: [
      { id: "c-rose", title: "Wind rose, whole year or filter", wide: true, render: roseCard, info: "Each petal shows how often the wind blows from that direction, split by speed. Rings mark the share of hours. Calm hours (below 0.5 m/s) have no direction and are counted in the centre." },
      { id: "c-roseD", title: "Wind roses by day and night", wide: true, render: roseDCard },
      { id: "c-roseS", title: "Wind roses by season", sub: "Meteorological seasons, flipped south of the equator", wide: true, render: roseSCard },
      { id: "c-ws", title: "Wind speed, hour by hour", wide: true, render: () => carpetOf("ws", ctx.mask) }] },
    { id: "water", title: "Water", reading: "water", cards: [
      { id: "c-prec", title: "Precipitation by month", render: precCard },
      { id: "c-rain", title: "Wind-driven rain by orientation", sub: "ISO 15927-3 airfield index, l/m² a year", render: rainCard, info: "The airfield index sums, over the hours with rain and wind blowing onto the wall, 2/9 × wind speed × rainfall^(8/9) × cos(wind direction − wall orientation). It describes rain at the station; terrain, obstacles and wall height change the amount a façade receives." },
      { id: "c-snow", title: "Snow depth", render: snowCard }] },
    { id: "outdoor", title: "Outdoor thermal comfort", reading: "outdoor", cards: [
      { id: "c-utci-sw", title: "UTCI, in the sun and in the wind", render: () => carpetOf("utci_sw", ctx.mask), info: "UTCI (Universal Thermal Climate Index) expresses how the combination of air temperature, radiation, wind and humidity feels, as the air temperature of a reference condition. Mean radiant temperature in the open: air temperature, plus the solar gain from SolarCal with the measured direct, diffuse and reflected radiation, plus the longwave exchange with a sky that is usually colder than the air. Shade blocks the direct beam only; the sky and the ground stay in view. Wind: the station wind speed. No wind: 0.5 m/s, the model's lower limit." },
      { id: "c-utci-sn", title: "UTCI, in the sun, out of the wind", render: () => carpetOf("utci_sn", ctx.mask) },
      { id: "c-utci-hw", title: "UTCI, in shade and in the wind", render: () => carpetOf("utci_hw", ctx.mask) },
      { id: "c-utci-hn", title: "UTCI, in shade, out of the wind", render: () => carpetOf("utci_hn", ctx.mask) },
      { id: "c-utciM", title: "Thermal stress by month", wide: true, tools: [{ k: "s", label: "Scenario", options: [["sunWind", "Sun and wind"], ["sunStill", "Sun, no wind"], ["shadeWind", "Shade and wind"], ["shadeStill", "Shade, no wind"]], def: "sunWind" }], render: utciMCard },
      { id: "c-dmrt", title: "Solar increase of mean radiant temperature", sub: "Standing person in the open, kelvin above air temperature", render: () => carpetOf("dmrt", ctx.mask, (i) => `<br>CBE Clima form: ${fmt(ctx.X.dmrtCBE[i], 1)} K`), info: "SolarCal (ASHRAE 55, Appendix C) for a standing person, solar angle 45° from the front, short-wave absorptivity 0.7, whole sky in view. This app feeds it the measured diffuse horizontal and the global horizontal radiation for the reflected part. The hover shows the value from the CBE Clima calculation, which assumed diffuse to be 0.2 × direct normal." },
      { id: "c-dlw", title: "Longwave exchange with the sky", sub: "Change of mean radiant temperature, kelvin", render: () => carpetOf("dlw", ctx.mask, (i) => `<br>sky temperature ${fmt(ctx.X.tsky[i], 1)} °C, air ${fmt(ctx.W.dbt[i], 1)} °C`), info: "Half of a standing person's view in the open is sky. The sky is usually colder than the air, so the body loses heat to it by radiation. Sky temperature comes from the file's horizontal infrared radiation; the change of mean radiant temperature is half the difference between sky and air temperature, as in Ladybug Tools. It applies in sun and shade alike, by day and by night." },
      { id: "c-dwind", title: "Wind effect on felt temperature", sub: "UTCI with the station wind minus UTCI at 0.5 m/s, kelvin", tools: [{ k: "v", label: "Condition", options: [["dwSun", "In the sun"], ["dwShade", "In shade"]], def: "dwSun" }], render: (u) => carpetOf(u.v, ctx.mask, (i) => `<br>wind ${fmt(ctx.W.ws[i], 1)} m/s, air ${fmt(ctx.W.dbt[i], 1)} °C`), info: "The difference between UTCI with the hourly station wind speed and UTCI with 0.5 m/s, the lowest speed the model accepts. Blue: the wind makes the hour feel cooler; orange to red: warmer, which happens when the air is hotter than the skin. The wind is measured at the station mast, usually 10 m above open ground; at street level it is often much weaker." }] },
    { id: "psychro", title: "Psychrometrics and passive strategies", reading: "psychro", cards: [
      { id: "c-psy", title: "Psychrometric chart", sub: "Hours by temperature and humidity ratio", tools: [{ k: "z", label: "Zones", options: [["sel", "Selected zones"], ["all", "All zones"], ["none", "No zones"]], def: "sel" }], wide: true, render: psyCard, info: "Each cell counts the hours with that dry bulb temperature and humidity ratio. Curves are relative humidity. The outlined zones are the Givoni-Milne strategy zones with Climate Consultant criteria; some of them also depend on conditions that a chart of single hours cannot show, such as the daily mean or the sun on the façade, so their outlines show only the temperature and humidity part." },
      { id: "c-zones", title: "Hours in each strategy zone", sub: "Tick zones to outline them and to count the hours they cover together", render: zonesCard },
      { id: "c-zcarpet", title: "Strategy zones, hour by hour", tools: [{ k: "m", label: "Show", options: [["fam", "Zone families"], ["sel", "Hours covered by the ticked zones"]].concat(C.CC_KEYS.map(([k, l]) => ["one:" + k, l])), def: "fam" }], wide: true, render: zcarpetCard, info: "Zone families: each hour takes the first family that covers it, in the order of the legend. Ticked zones: hours covered by at least one ticked zone. A single zone: the hours in that zone." },
      { id: "c-nv", title: "Natural ventilation hours", sub: "Air temperature and dew point inside the limits", wide: true, render: nvCard, info: "The same filter as CBE Clima: air temperature between a lower and an upper limit, dew point at or below a limit. It does not consider wind, noise or the building." }] },
    { id: "explorer", title: "Data explorer", cards: [
      { id: "c-exCarpet", title: "Any variable, hour by hour", tools: [varSel(null, "dbt")], wide: true, render: (u) => carpetOf(u.v, exMask()) },
      { id: "c-exScatter", title: "Two variables against each other", wide: true, tools: [{ k: "x", label: "x", options: S.varOptions(), def: "dbt" }, { k: "y", label: "y", options: S.varOptions(), def: "rh" }, { k: "c", label: "colour", options: [["none", "No colour"]].concat(S.varOptions()), def: "ghi" }], render: scatterCard }] },
    { id: "quality", title: "Data quality", reading: "quality", cards: [
      { id: "c-quality", title: "What the file contains", wide: true, render: qualityCard }] }];

  /* ---------------- card renderers ---------------- */
  function glanceCard() {
    const G = S.glance(ctx);
    const html = `<div style="overflow-x:auto"><table class="t glance"><tr><th>Figure</th><th class="r">This file</th><th style="min-width:300px">Among the reference climates</th><th>What it means</th></tr>${G.rows.map((r) => `<tr><td><b>${esc(r.label)}</b></td><td class="r" style="font-size:15px"><b>${esc(r.f(r.v))}</b></td><td style="width:340px">${K.refStrip({ refs: r.refs, v: r.v, fmt: r.f, label: r.label })}</td><td>${esc(r.what)} <span style="color:var(--ink)">Rank: ${esc(r.cmp)}, this file included.</span></td></tr>`).join("")}</table></div>`;
    return { html, csv: () => ["figure,this file," + G.refs.map((x) => x.name).join(",")].concat(G.rows.map((r) => [`"${r.label}"`, r.v.toFixed(2)].concat(r.refs.map((x) => x.v.toFixed(2))).join(","))).join("\n") };
  }
  function extremeTiles() { const e = ctx.R.ex; return tilesHtml([[e.summerDays, "", "Summer days (≥ 25 °C)", "c-calendar"], [e.hotDays, "", "Hot days (≥ 30 °C)", "c-calendar"], [e.tropicalNights, "", "Tropical nights (≥ 20 °C)", "c-calendar"], [e.frostDays, "", "Frost days (< 0 °C)", "c-calendar"], [e.iceDays, "", "Ice days (max < 0 °C)", "c-calendar"], [e.overcastDays, "", "Overcast days", "c-calendar"]]); }
  const tilesHtml = (t) => `<div class="tiles">${t.map(([v, u, k, card]) => `<div class="tile" data-card="${card}"><div class="v">${v} <small>${u}</small></div><div class="k">${esc(k)}</div></div>`).join("")}</div>`;
  function identityCard() {
    const W = ctx.W, m = W.meta, s = ctx.site;
    const rows = [["Place", ctx.siteName], ["Coordinates", `${fmt(Math.abs(m.lat), 3)}° ${m.lat >= 0 ? "N" : "S"}, ${fmt(Math.abs(m.lon), 3)}° ${m.lon >= 0 ? "E" : "W"}`], ["Elevation", `${fmt(m.elev)} m`], ["Time zone", `UTC${m.tz >= 0 ? "+" : "−"}${fmt(Math.abs(m.tz), m.tz % 1 ? 1 : 0)}`], ["Köppen-Geiger", ctx.koppen ? `${ctx.koppen}, ${S.KOPPEN[ctx.koppen] || ""} (Beck et al. 2018 map, 1980 to 2016)` : "not found for this location"], ["Data set", `${m.source || "–"}${m.wmo ? ", WMO " + m.wmo : ""}`], ["Period", ctx.period ? ctx.period.replace("the years ", "") : "not stated in the file"], ["File", ctx.name]];
    return { html: `<table class="t">${rows.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join("")}</table>` };
  }
  function monthTCard() {
    const R = ctx.R, g = S.V.dbt.sc;
    const html = K.lines({ n: 12, months: false, xTicks: C.MONTHS.map((m, k) => [k, m]), series: [{ vals: R.mMax, color: "#ff0000", name: "max" }, { vals: R.mMean, color: "#000082", name: "mean" }, { vals: R.mMin, color: "#00b3ff", name: "min" }], area: { lo: R.mMin, hi: R.mMax, fill: "var(--soft)", opacity: 1 }, unit: "°C", lo: st.range === "global" ? -15 : null, hi: st.range === "global" ? 40 : null, height: 230, tip: (k) => `<b>${C.MONTHS_LONG[k]}</b><br>mean daily max ${fmt(R.mMax[k], 1)} °C<br>mean ${fmt(R.mMean[k], 1)} °C<br>mean daily min ${fmt(R.mMin[k], 1)} °C` });
    return { html: html + legendHtml([["#ff0000", "Mean daily maximum"], ["#000082", "Monthly mean"], ["#00b3ff", "Mean daily minimum"]]), csv: () => monthlyCsv([{ name: "mean daily maximum", vals: R.mMax }, { name: "mean", vals: R.mMean }, { name: "mean daily minimum", vals: R.mMin }], "°C") };
  }
  function monthRCard() {
    const R = ctx.R, dirH = R.mGhiDay.map((v, k) => Math.max(0, v - R.mDhiDay[k]));
    const ser = [{ vals: R.mDhiDay, color: "#960c2c", name: "Diffuse" }, { vals: dirH, color: "#ff7b00", name: "Direct on the horizontal" }];
    return { html: K.bars({ series: ser, stacked: true, unit: "kWh/m² per day", dec: 2, hi: st.range === "global" ? 9 : null, height: 230 }) + legendHtml(ser.map((s) => [s.color, s.name])), csv: () => monthlyCsv(ser, "kWh/m2 per day") };
  }
  function ddCard(u) {
    const R = ctx.R, g = u.g === "gtz" || (u.g === "auto" && st.gtz);
    const ser = g ? [{ vals: R.gtz.monthly, color: "#000082", name: `Gradtagzahl G 20/15, ${fmt(R.gtz.heatingDays)} heating days` }] : [{ vals: R.hdd.monthly, color: "#00b3ff", name: `Heating, base ${fmt(st.hdd, 1)} °C` }, { vals: R.cdd.monthly, color: "#ff0000", name: `Cooling, base ${fmt(st.cdd, 1)} °C` }];
    return { html: K.bars({ series: ser, unit: "Kd", height: 230 }) + legendHtml(ser.map((s) => [s.color, s.name])), csv: () => monthlyCsv(ser, "Kd") };
  }
  function dailyCard() {
    const X = ctx.X, d = X.daily, b = S.adaptiveBand(X, st.adm);
    const inLo = [], inHi = [], outLo = [], outHi = [];
    for (let k = 0; k < 365; k++) { const a = b.inR[k] || (k > 0 && b.inR[k - 1]) || (k < 364 && b.inR[k + 1]), o = !b.inR[k] || (k > 0 && !b.inR[k - 1]) || (k < 364 && !b.inR[k + 1]); inLo.push(a ? b.lo[k] : NaN); inHi.push(a ? b.hi[k] : NaN); outLo.push(o ? b.lo[k] : NaN); outHi.push(o ? b.hi[k] : NaN); }
    const html = K.lines({ n: 365, series: [{ vals: d.mean, color: "var(--ink)", width: 1.5 }], band: { lo: d.min, hi: d.max, fill: "var(--grey)", opacity: 0.9 }, areas: [{ lo: inLo, hi: inHi, fill: "var(--accent)", opacity: 0.3 }, { lo: outLo, hi: outHi, fill: "var(--accent)", opacity: 0.12, stroke: "var(--accent)", dash: "3 3" }], unit: "°C", lo: st.range === "global" ? -20 : null, hi: st.range === "global" ? 45 : null, tip: (k) => `<b>${S.dateOf(k)}</b><br>max ${fmt(d.max[k], 1)} °C, mean ${fmt(d.mean[k], 1)} °C, min ${fmt(d.min[k], 1)} °C<br>${esc(b.label)}: ${fmt(b.lo[k], 1)} to ${fmt(b.hi[k], 1)} °C${b.inR[k] ? "" : " (outside the range the standard covers)"}<br>${b.rmName}: ${fmt(b.rm[k], 1)} °C` });
    return { html: html + legendHtml([["var(--grey)", "Daily range"], ["var(--ink)", "Daily mean"], ["var(--accent)", `${b.label} band`], ["color-mix(in srgb, var(--accent) 30%, transparent)", "Band held at its limits, outside the standard's range"]]), csv: () => { const r = ["day,date,min,mean,max,running mean,band low,band high,inside the standard's range"]; for (let k = 0; k < 365; k++) r.push([k + 1, S.dateOf(k), d.min[k].toFixed(2), d.mean[k].toFixed(2), d.max[k].toFixed(2), b.rm[k].toFixed(2), b.lo[k].toFixed(2), b.hi[k].toFixed(2), b.inR[k]].join(",")); return r.join("\n"); } };
  }
  function weekCard(hot) {
    const W = ctx.W, X = ctx.X, e = X.extremes, start = (hot ? e.hottestWeek.start : e.coldestWeek.start) - 1, n = 9 * 24, idx = Array.from({ length: n }, (_, k) => ((start * 24 + k) % N + N) % N);
    const t = idx.map((i) => W.dbt[i]), dp = idx.map((i) => W.dpt[i]), g = idx.map((i) => Math.max(0, W.ghi[i])), shade = []; let s0 = -1;
    for (let k = 0; k <= n; k++) { const night = k < n && X.alt[idx[k]] <= 0; if (night && s0 < 0) s0 = k; if (!night && s0 >= 0) { shade.push([s0, k - 1]); s0 = -1; } }
    const xt = []; for (let dd = 0; dd < 9; dd++) xt.push([dd * 24 + 12, S.dateOf((start + dd + 365) % 365).replace(/ (\w{3})\w*$/, " $1")]);
    const wk = Array.from({ length: n }, (_, k) => (k >= 24 && k < 192 ? 1 : NaN));
    const T = K.lines({ n, months: false, xTicks: xt, shade, series: [{ vals: t, color: hot ? "#ff0000" : "#000082", width: 2 }, { vals: dp, color: "#00c8ff", width: 1.5, dash: "4 3" }], unit: "°C", height: 250, tip: (k) => `<b>${S.hourOf(idx[k])}</b><br>air ${fmt(t[k], 1)} °C<br>dew point ${fmt(dp[k], 1)} °C<br>global horizontal ${fmt(g[k])} W/m²` });
    const G = K.lines({ n, months: false, xTicks: [], shade, series: [{ vals: g, color: "#ff7b00", width: 1.5 }], area: { lo: g.map(() => 0), hi: g, fill: "#ff7b00", opacity: 0.35 }, unit: "W/m²", lo: 0, hi: st.range === "global" ? 1200 : null, height: 120 });
    const mean = hot ? e.hottestWeek.mean : e.coldestWeek.mean;
    const months = new Set(idx.map((i) => C.T.month[i])), seam = months.size > 1 ? ` The days shown span two months. A typical-year file takes each month from a different year, so values can step at the month boundary.` : "";
    return { html: `<p class="note">${hot ? "Hottest" : "Coldest"} seven days by daily mean: from ${S.dateOf(start + 1)}, mean ${fmt(mean, 1)} °C. The first and last day shown lie outside the week.${seam}</p>` + T + G + legendHtml([[hot ? "#ff0000" : "#000082", "Air temperature"], ["#00c8ff", "Dew point (dashed)"], ["#ff7b00", "Global horizontal radiation"], ["var(--soft)", "Sun below the horizon"]]), csv: () => ["month,day,hour,air C,dew point C,global horizontal W/m2"].concat(idx.map((i, k) => [C.T.month[i], C.T.day[i], C.T.hour[i] + 1, t[k].toFixed(2), dp[k].toFixed(2), g[k].toFixed(0)].join(","))).join("\n") };
  }
  function profilesCard(u) {
    const V = S.V[u.v], a = V.get(ctx.W, ctx.X), sc = S.V[u.v].sc, glob = st.range === "global";
    const col = K.ramps[V.sc.ramp](V.sc.ramp === "sun" ? 0.45 : V.sc.ramp === "wind" ? 0.85 : 0.62);
    return { html: K.profiles({ vals: a, mask: ctx.mask, unit: V.unit, lo: glob ? sc.lo : null, hi: glob ? sc.hi : null, label: V.label, color: col, fill: col, fillOpacity: 0.22 }), csv: () => { const s = K._lastProfiles, r = ["month,hour,mean,min,max"]; s.forEach((m, k) => { for (let h = 0; h < 24; h++) r.push([C.MONTHS[k], h + 1, m.mean[h], m.min[h], m.max[h]].map((v) => (typeof v === "number" ? (isFinite(v) ? v.toFixed(3) : "") : v)).join(",")); }); return r.join("\n"); } };
  }
  function calendarCard() {
    const X = ctx.X, d = X.daily, e = X.extremes, W = ctx.W;
    const rows = [["Hot day", "#c95d3e", (k) => d.max[k] >= 30], ["Summer day", "#e5a062", (k) => d.max[k] >= 25 && d.max[k] < 30], ["Tropical night", "#8f2f20", (k) => d.min[k] >= 20], ["Frost day", "#7ea3d0", (k) => d.min[k] < 0 && d.max[k] >= 0], ["Ice day", "#263d6b", (k) => d.max[k] < 0], ["Overcast day", "#7c8784", overcastFn()]];
    const Wd = 760, x0 = 96, w = 650, rh = 18, H = rows.length * (rh + 6) + 30; let s = `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Calendar of events">`;
    rows.forEach(([name, col, f], r) => { const y = 8 + r * (rh + 6); s += `<text x="${x0 - 8}" y="${y + 13}" text-anchor="end" class="lbl">${name}</text><rect x="${x0}" y="${y}" width="${w}" height="${rh}" fill="var(--bg)"/>`; for (let k = 0; k < 365; k++) if (f(k)) s += `<rect x="${(x0 + w * k / 365).toFixed(2)}" y="${y}" width="${Math.max(1.4, w / 365).toFixed(2)}" height="${rh}" fill="${col}" data-tip="${esc(`${S.dateOf(k)}: ${name.toLowerCase()}, min ${fmt(d.min[k], 1)} °C, max ${fmt(d.max[k], 1)} °C`)}"/>`; });
    s += K.axisMonthsX(x0, w, 8 + rows.length * (rh + 6)) + `</svg>`;
    return { html: s, csv: () => { const r = ["day,date,min,max," + rows.map((x) => x[0]).join(",")]; for (let k = 0; k < 365; k++) r.push([k + 1, S.dateOf(k), d.min[k].toFixed(2), d.max[k].toFixed(2)].concat(rows.map((x) => (x[2](k) ? 1 : 0))).join(",")); return r.join("\n"); } };
    function overcastFn() { const over = new Array(365).fill(false); const tscOK = e.overcastBasis === "sky cover"; for (let k = 0; k < 365; k++) { if (tscOK) { let a = 0, c = 0; for (let h = 7; h < 19; h++) { a += W.tsc[k * 24 + h]; c++; } over[k] = a / c >= 8; } else { let g = 0, x = 0; for (let h = 0; h < 24; h++) { const i = k * 24 + h; if (W.ghi[i] > 0) g += W.ghi[i]; if (W.etrh[i] > 0) x += W.etrh[i]; } over[k] = x > 0 && g / x < 0.3; } } return (k) => over[k]; }
  }
  function weeksCard() {
    const d = ctx.X.daily.mean, e = ctx.X.extremes, rm = new Float32Array(365);
    for (let k = 0; k < 365; k++) { let s = 0; for (let j = 0; j < 7; j++) s += d[(k + j) % 365]; rm[k] = s / 7; }
    const mark = (start) => { const a = new Array(365).fill(NaN); for (let j = 0; j < 7; j++) a[(start + j) % 365] = rm[start]; return a; };
    const html = K.lines({ n: 365, spans: [[e.hottestWeek.start, 7, "#ff0000"], [e.coldestWeek.start, 7, "#00b3ff"]], series: [{ vals: d, color: "var(--out)", width: 1 }, { vals: rm, color: "var(--ink)", width: 2 }], unit: "°C", tip: (k) => `<b>${S.dateOf(k)}</b><br>daily mean ${fmt(d[k], 1)} °C<br>mean of the 7 days from here ${fmt(rm[k], 1)} °C` });
    return { html: html + legendHtml([["var(--out)", "Daily mean"], ["var(--ink)", "Mean of the 7 days starting that day"], ["rgba(255,0,0,.25)", "Hottest week"], ["rgba(0,179,255,.3)", "Coldest week"]]) };
  }
  function sunpathCard(u) {
    const W = ctx.W, X = ctx.X, none = u.v === "none", V = none ? S.V.dbt : S.V[u.v], a = V.get(W, X), sc = S.scaleFor(none ? "dbt" : u.v, ctx), pts = [], mask = ctx.mask;
    for (let i = 0; i < N && !none; i++) { if (X.alt[i] <= 0) continue; if (mask && !mask[i]) continue; const c = V.utci ? K.UTCI_COLORS[C.utciClass(a[i])] : sc.color(a[i]); pts.push({ i, alt: X.alt[i], az: X.az[i], c: c || "#8b9592" }); }
    const lines = C.sunPathLines(W.meta.lat, W.meta.lon, W.meta.tz);
    const fn = u.proj === "cyl" ? K.sunPathCyl : u.proj === "3d" ? K.sunPath3D : K.sunPath;
    const wrap = (h) => (u.proj === "polar" || u.proj === "ortho" ? `<div style="max-width:720px;margin:auto">${h}</div>` : h);
    return { html: wrap(fn({ lat: W.meta.lat, ortho: u.proj === "ortho", lines, points: pts, emphasis: none, scale: V.utci || none ? null : sc, unit: V.unit, label: "Sun path", tip: (i) => `<b>${S.hourOf(i)}</b><br>altitude ${fmt(X.alt[i], 1)}°, azimuth ${fmt(X.az[i], 1)}°<br>${esc(V.label)}: ${fmt(a[i], V.dec)} ${V.unit}` })), csv: () => hourlyCsv([["solar altitude (deg)", X.alt], ["solar azimuth (deg)", X.az], [V.label + " (" + V.unit + ")", a]]) };
  }
  function sunSectionCard() {
    const m = ctx.W.meta, noon = (doy) => { let best = { alt: -99 }; for (let k = 0; k <= 24 * 60; k += 2) { const h = k / 60, p = C.sunPosition(m.lat, m.lon, m.tz, doy, h); if (p.alt > best.alt) best = { alt: p.alt, h, north: Math.cos(p.az * Math.PI / 180) > 0 }; } return best; };
    const tfmt = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}`;
    const sum = m.lat >= 0 ? 172 : 355, win = m.lat >= 0 ? 355 : 172;
    const mk = (d, name, color) => { const b = noon(d); return { name, full: name, alt: b.alt, north: b.north, time: tfmt(b.h) + " local standard time", color }; };
    const rows = [mk(sum, "21 June", "#ff0000"), mk(79, "20 March", "#ff7b00"), mk(266, "23 September", "#ff7b00"), mk(win, "21 December", "#00b3ff")].sort((a, b) => b.alt - a.alt);
    const eqx = rows.filter((r) => r.color === "#ff7b00"), cases = rows.filter((r) => r.color !== "#ff7b00").concat([{ name: "Equinoxes", full: "Equinoxes", alt: (eqx[0].alt + eqx[1].alt) / 2, north: eqx[0].north, time: `${eqx[0].time.slice(0, 5)} and ${eqx[1].time}`, color: "#ff7b00" }]).sort((a, b) => b.alt - a.alt);
    const tbl = `<table class="t" style="margin-top:6px"><tr><th>Day</th><th class="r">Noon altitude</th><th>Sun to the</th><th class="r">Solar noon, clock</th></tr>${rows.map((c) => `<tr><td><span class="swatch" style="background:${c.color}"></span> ${esc(c.full)}</td><td class="r">${fmt(c.alt, 1)}°</td><td>${c.north ? "north" : "south"}</td><td class="r">${c.time.replace(" local standard time", "")}</td></tr>`).join("")}</table>`;
    return { html: K.sunSection({ lat: m.lat, cases, lines: C.sunPathLines(m.lat, m.lon, m.tz) }) + tbl, csv: () => ["day,noon altitude (deg),sun to the,solar noon (local standard time)"].concat(rows.map((c) => `"${c.full}",${c.alt.toFixed(2)},${c.north ? "north" : "south"},${c.time.slice(0, 5)}`)).join("\n") };
  }
  function skyCard(u) {
    const W = ctx.W, day = u && u.h === "day", okTsc = Array.from(W.tsc).some((v) => v > 0) && !(W.missing && W.missing.tsc >= N * 0.5);
    if (!okTsc) return { html: `<p class="note">This file holds no sky cover.</p>` };
    const c = [0, 1, 2].map(() => new Array(12).fill(0));
    for (let i = 0; i < N; i++) { if (ctx.mask && !ctx.mask[i]) continue; if (day && !(ctx.X.alt[i] > 0)) continue; const v = W.tsc[i]; if (!isFinite(v)) continue; c[v <= 2 ? 0 : v <= 7 ? 1 : 2][C.T.month[i] - 1]++; }
    const ser = [{ name: "Clear, 0 to 2 tenths", color: "#08306b", vals: c[0] }, { name: "Partly cloudy, 3 to 7 tenths", color: "#7ec9f3", vals: c[1] }, { name: "Overcast, 8 to 10 tenths", color: "#b9c2c0", vals: c[2] }];
    const tot = c.flat().reduce((a, b) => a + b, 0), share = (k) => 100 * c[k].reduce((a, b) => a + b, 0) / Math.max(1, tot);
    return { html: K.bars({ series: ser, stacked: true, unit: "hours", height: 230 }) + legendHtml(ser.map((s0) => [s0.color, s0.name])) + `<p class="note">${day ? "Daylight hours" : "All hours, day and night"}. Over the year: ${fmt(share(0))} % clear, ${fmt(share(1))} % partly cloudy, ${fmt(share(2))} % overcast.</p>`, csv: () => monthlyCsv(ser, "hours") };
  }
  function orientCard() {
    const s = ctx.X.surf, vals = C.ORIENT.map(([n, az]) => [n, s[n].annual, az]), max = st.range === "global" ? 2200 : null;
    const sc = K.scale({ ramp: "sun", lo: 0, hi: (max || Math.max(...vals.map((v) => v[1])) * 1.05) / 0.66 });
    return { html: K.orient({ vals, roof: s.Roof.annual, unit: "kWh/m² a year", color: sc.color, max, note: "", label: "Annual irradiation by orientation" }), csv: () => ["surface,annual kWh/m2,direct share"].concat(C.ORIENT.map(([n]) => `${n},${s[n].annual.toFixed(1)},${s[n].beamShare.toFixed(3)}`), [`Roof,${s.Roof.annual.toFixed(1)},`]).join("\n") };
  }
  function surfCarpetCard(u) {
    if (u.v !== "grid") return carpetOf(u.v, ctx.mask);
    const sc = S.scaleFor("surfS", ctx), lat = ctx.W.meta.lat;
    const layout = [["NW", "N", "NE"], ["W", "Roof", "E"], ["SW", "S", "SE"]];
    const cell = (k) => { const V = S.V["surf" + k], a = V.get(ctx.W, ctx.X); return K.carpet({ vals: a, mask: ctx.mask, small: true, W: 250, label: k === "Roof" ? "Roof" : k, greyHex: greyHex(), colorOf: (v) => sc.color(v), tip: (i) => `<b>${S.hourOf(i)}</b><br>${esc(V.label)}: ${fmt(a[i])} W/m²` }); };
    const bar = `<svg viewBox="0 0 120 230" style="max-width:90px">${K.colorbar(20, 24, 190, sc, "W/m²")}</svg>`;
    return { html: `<div style="display:grid;grid-template-columns:minmax(0,1fr) 90px;gap:8px;align-items:center"><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 10px">${layout.flat().map(cell).join("")}</div>${bar}</div><p class="note">Arranged as on a plan, north at the top; the roof in the middle. Each panel: days across, hours down.</p>`, csv: () => hourlyCsv(layout.flat().map((k) => [S.V["surf" + k].label + " (W/m2)", S.V["surf" + k].get(ctx.W, ctx.X)])) };
  }

  /* ---------- future climate ---------- */
  const FUT_COL = { 1.5: "#f1a33c", 2: "#d81600", 3: "#6b0f00" };
  function futAll() {
    if (ctx._futAll) return ctx._futAll;
    const W0 = ctx.W0, reg = futRegion(W0), out = { reg, mid: futMid(W0), levels: {} };
    if (!reg || !window.CLIMA_FUTURE.gwl["2.0"].dT[reg.id] || !window.CLIMA_FUTURE.gwl["2.0"].dT[reg.id][0] || window.CLIMA_FUTURE.gwl["2.0"].dT[reg.id][0][0] == null) { ctx._futAll = out; return out; }
    out.present = futStats(prepWeather(W0, 0).W);
    for (const [L] of FUT_LEVELS) { const P = prepWeather(W0, L); out.levels[L] = { d: P.fut, stats: futStats(P.W) }; }
    ctx._futAll = out; return out;
  }
  function futStats(Wl) {
    const N = C.N, t = Wl.dbt, W0 = ctx.W0, X = ctx.X;
    let sum = 0, hot26 = 0, dp18 = 0, utciHot = 0, prec = 0;
    const dmax = [], dmin = [], dmean = [], mmax = new Array(12).fill(0), mcnt = new Array(12).fill(0);
    for (let d = 0; d < 365; d++) { let mx = -99, mn = 99, s0 = 0; for (let h = 0; h < 24; h++) { const v = t[d * 24 + h]; mx = Math.max(mx, v); mn = Math.min(mn, v); s0 += v; } dmax.push(mx); dmin.push(mn); dmean.push(s0 / 24); const m = C.T.month[d * 24] - 1; mmax[m] += mx; mcnt[m]++; }
    for (let i = 0; i < N; i++) {
      sum += t[i]; if (t[i] > 26) hot26++; if (Wl.dpt[i] > 18) dp18++; if (Wl.prec[i] > 0) prec += Wl.prec[i];
      const mrt = X.mrt[i] - (ctx.W.dbt[i] - W0.dbt[i]) + (t[i] - W0.dbt[i]), v = Wl.ws[i] <= 0.5 ? 0.6 : Math.min(16.9, Wl.ws[i]);
      if (C.utciLimited(t[i], mrt, v, Wl.rh[i]).u > 32) utciHot++;
    }
    return { mean: sum / N, warmMax: Math.max(...mmax.map((v, m) => v / mcnt[m])), hotDays: dmax.filter((v) => v >= 30).length, trop: dmin.filter((v) => v >= 20).length, frost: dmin.filter((v) => v < 0).length,
      hdd: dmean.reduce((x, v) => x + Math.max(0, st.hdd - v), 0), cdd: dmean.reduce((x, v) => x + Math.max(0, v - st.cdd), 0), hot26, dp18, utciHot, prec };
  }
  const futNone = () => `<p class="note">This location lies outside the regions with model data, or in an ocean region without land values.</p>`;
  function futTCard() {
    const A = futAll(); if (!A.present) return { html: futNone() };
    const ser = FUT_LEVELS.map(([L, lab, yr]) => ({ name: `${lab}, ${yr}`, color: FUT_COL[L], width: 2, vals: A.levels[L].d.dT }));
    const areas = FUT_LEVELS.map(([L]) => ({ lo: A.levels[L].d.lo, hi: A.levels[L].d.hi, fill: FUT_COL[L], opacity: 0.12 }));
    const all = FUT_LEVELS.flatMap(([L]) => A.levels[L].d.lo.concat(A.levels[L].d.hi));
    return { html: K.lines({ n: 12, series: ser, areas, dots: true, xName: (i) => C.MONTHS[i], unit: "K", dec: 1, lo: Math.min(0, Math.floor(Math.min(...all))), hi: Math.ceil(Math.max(...all)), height: 260 }) + legendHtml(ser.map((x) => [x.color, x.name])) + `<p class="note">Lines: median of ${window.CLIMA_FUTURE.gwl["2.0"].n} CMIP6 models; bands: 10th to 90th percentile. Region: ${esc(regName(A.reg))}. From the file's years${A.mid.known ? ` (${A.mid.from}-${A.mid.to}, at about ${fmt(A.levels[2].d.fileWarming, 1)} K of global warming in the models)` : ""}.</p>`,
      csv: () => ["month," + FUT_LEVELS.map(([L]) => `+${L} median (K),+${L} p10,+${L} p90`).join(",")].concat(C.MONTHS.map((m, i) => [m].concat(FUT_LEVELS.flatMap(([L]) => [A.levels[L].d.dT[i], A.levels[L].d.lo[i], A.levels[L].d.hi[i]].map((v) => v.toFixed(2)))).join(","))).join("\n") };
  }
  function futPCard() {
    const A = futAll(); if (!A.present) return { html: futNone() };
    const F = window.CLIMA_FUTURE, r = A.reg.id;
    const ser = FUT_LEVELS.map(([L, lab, yr]) => ({ name: `${lab}, ${yr}`, color: FUT_COL[L], width: 2, vals: F.gwl[L.toFixed(1)].dP[r].map((x) => (x[0] == null ? NaN : x[0])) }));
    const areas = FUT_LEVELS.map(([L]) => ({ lo: F.gwl[L.toFixed(1)].dP[r].map((x) => x[1]), hi: F.gwl[L.toFixed(1)].dP[r].map((x) => x[2]), fill: FUT_COL[L], opacity: 0.1 }));
    const all = areas.flatMap((a) => a.lo.concat(a.hi)).filter(isFinite);
    const note = A.present.prec > 0 ? "" : " This file holds no precipitation, so nothing is scaled.";
    return { html: K.lines({ n: 12, series: ser, areas, dots: true, xName: (i) => C.MONTHS[i], unit: "%", dec: 0, lo: Math.floor(Math.min(0, ...all) / 10) * 10, hi: Math.ceil(Math.max(0, ...all) / 10) * 10, height: 240 }) + legendHtml(ser.map((x) => [x.color, x.name])) + `<p class="note">Median and 10th to 90th percentile of the models.${note}</p>`,
      csv: () => ["month," + FUT_LEVELS.map(([L]) => `+${L} median (%),+${L} p10,+${L} p90`).join(",")].concat(C.MONTHS.map((m, i) => [m].concat(FUT_LEVELS.flatMap(([L]) => F.gwl[L.toFixed(1)].dP[r][i].map((v) => (v == null ? "" : v)))).join(","))).join("\n") };
  }
  function futRegCard() {
    const A = futAll(); if (!A.present) return { html: futNone() };
    const F = window.CLIMA_FUTURE, r = A.reg.id;
    const cellT = (v, g) => { const q = v / g, cls = q > 1.1 ? "background:rgba(216,22,0,.14)" : q < 0.9 ? "background:rgba(0,120,200,.12)" : ""; return `<td class="r" style="${cls}">${fmt(v, 1)} K <span class="note" style="display:inline">×${fmt(q, 2)}</span></td>`; };
    const cellP = (v, w) => { const diff = v - w, cls = v < 0 && w >= 0 ? "background:rgba(150,90,20,.16)" : diff > 5 ? "background:rgba(0,120,200,.12)" : diff < -5 ? "background:rgba(150,90,20,.12)" : ""; return `<td class="r" style="${cls}">${v >= 0 ? "+" : ""}${fmt(v, 0)} %</td>`; };
    let h = `<table class="t"><tr><th>Global warming level</th><th class="r">Global</th><th class="r">All land</th><th class="r">${esc(regName(A.reg))}, year</th><th class="r">June to August</th><th class="r">December to February</th></tr>`;
    for (const [L, lab, yr] of FUT_LEVELS) { const g = F.gwl[L.toFixed(1)], R = g.reg[r], Wd = g.reg.world; h += `<tr><td>${lab} <span class="note" style="display:inline">${yr}</span></td><td class="r">${fmt(L, 1)} K</td>${cellT(Wd.ann[0], L)}${cellT(R.ann[0], L)}${cellT(R.jja[0], L)}${cellT(R.djf[0], L)}</tr>`; }
    h += `<tr><th>Precipitation</th><th></th><th class="r">All land</th><th class="r">Year</th><th class="r">June to August</th><th class="r">December to February</th></tr>`;
    for (const [L, lab] of FUT_LEVELS) { const g = F.gwl[L.toFixed(1)], R = g.reg[r], Wd = g.reg.world; if (R.pann[0] == null) continue; h += `<tr><td>${lab}</td><td></td><td class="r">${Wd.pann[0] >= 0 ? "+" : ""}${fmt(Wd.pann[0], 0)} %</td>${cellP(R.pann[0], Wd.pann[0])}${cellP(R.pjja[0], Wd.pjja[0])}${cellP(R.pdjf[0], Wd.pdjf[0])}</tr>`; }
    h += `</table><p class="note">Temperatures: warming since 1850-1900, with the ratio to the global level. Warm cells: more than 10 % above the global level; cool cells: more than 10 % below. Precipitation: change since 1850-1900; blue cells wetter than the land average by more than 5 points, brown drier, or drying where land overall gets wetter. Model medians.</p>`;
    return { html: h, csv: () => ["level,global (K),all land (K),region year (K),region JJA (K),region DJF (K),all land precip (%),region precip year (%),region JJA (%),region DJF (%)"].concat(FUT_LEVELS.map(([L]) => { const g = F.gwl[L.toFixed(1)], R = g.reg[r], Wd = g.reg.world; return [L, L, Wd.ann[0], R.ann[0], R.jja[0], R.djf[0], Wd.pann[0], R.pann[0], R.pjja[0], R.pdjf[0]].join(","); })).join("\n") };
  }
  function futCmpCard() {
    const A = futAll(); if (!A.present) return { html: futNone() };
    const rows = [["Annual mean", "mean", (v) => fmt(v, 1) + " °C", 1], ["Mean daily maximum, warmest month", "warmMax", (v) => fmt(v, 1) + " °C", 1], ["Hot days (maximum 30 °C or more)", "hotDays", (v) => fmt(v), 0], ["Tropical nights (minimum 20 °C or more)", "trop", (v) => fmt(v), 0], ["Frost days (minimum below 0 °C)", "frost", (v) => fmt(v), 0],
      [`Heating degree days, base ${fmt(st.hdd, 1)} °C`, "hdd", (v) => fmt(v) + " Kd", 0], [`Cooling degree days, base ${fmt(st.cdd, 1)} °C`, "cdd", (v) => fmt(v) + " Kd", 0], ["Hours above 26 °C", "hot26", (v) => fmt(v), 0], ["Hours with dew point above 18 °C", "dp18", (v) => fmt(v), 0], ["Hours of strong heat stress outdoors, in the sun (UTCI above 32 °C)", "utciHot", (v) => fmt(v), 0]];
    if (A.present.prec > 0) rows.push(["Precipitation", "prec", (v) => fmt(v) + " mm", 0]);
    const unitOf = (f) => (f(1).match(/[^\d.\s,-].*$/) || [""])[0].trim();
    const dlt = (v0, v, f, dec) => { const u = unitOf(f), key = u === "°C" ? "K" : u, dd = K.U.v(v - v0, key) - K.U.v(0, key), lab = key === "K" ? " " + K.U.lab("K") : ""; return `<span class="note" style="display:inline;white-space:nowrap">${dd >= 0 ? "+" : "−"}${fmt(Math.abs(dd), dec + (key === "mm" && K.U.sys === "ip" ? 1 : 0))}${lab}</span>`; };
    const h = `<table class="t"><tr><th></th><th class="r">Present${A.mid.known ? ` (${A.mid.from}-${A.mid.to})` : ""}</th>${FUT_LEVELS.map(([L, lab, yr]) => `<th class="r" style="color:${FUT_COL[L]}">${lab}<br><span style="font-weight:400">${yr}</span></th>`).join("")}</tr>${rows.map(([lab, k, f, dec]) => `<tr><td>${lab}</td><td class="r">${f(A.present[k])}</td>${FUT_LEVELS.map(([L]) => `<td class="r">${f(A.levels[L].stats[k])} ${dlt(A.present[k], A.levels[L].stats[k], f, dec)}</td>`).join("")}</tr>`).join("")}</table>`;
    return { html: h + (ctx.uhi ? `<p class="note">All columns include the estimated urban heat island.</p>` : ""), csv: () => ["indicator,present," + FUT_LEVELS.map(([L]) => "+" + L).join(",")].concat(rows.map(([lab, k]) => [`"${lab}"`, A.present[k].toFixed(2)].concat(FUT_LEVELS.map(([L]) => A.levels[L].stats[k].toFixed(2))).join(","))).join("\n") };
  }
  S.readings.future = function () {
    const n = S.n, A = futAll(), F = window.CLIMA_FUTURE, out = [];
    if (!A.present) return ["No model data for this location: it lies outside the IPCC land regions."];
    const r = A.reg.id, g2 = F.gwl["2.0"].reg[r], g3 = F.gwl["3.0"].reg[r], q = g2.ann[0] / 2, ql = F.gwl["2.0"].reg.world.ann[0] / 2;
    const rel = q > 1.1 ? "faster than" : q < 0.9 ? "more slowly than" : "about as fast as";
    const landNote = q < ql - 0.15 ? ", though less than land on average" : "";
    let p = `The file lies in the IPCC region ${esc(regName(A.reg))}. This region warms ${rel} the world as a whole${landNote}: at 2 °C of global warming, around 2050, the models put its annual mean ${n(fmt(g2.ann[0], 1) + " K", "c-futReg")} above 1850-1900 (${fmt(q, 2)} times the global figure; all land ${fmt(ql, 2)}).`;
    const sj = g2.jja[0] / 2, sd = g2.djf[0] / 2;
    if (Math.abs(sj - sd) > 0.15) p += ` ${sj > sd ? "June to August" : "December to February"} warms more than ${sj > sd ? "December to February" : "June to August"}: ${fmt(Math.max(sj, sd) * 2, 1)} against ${fmt(Math.min(sj, sd) * 2, 1)} K.`;
    out.push(p);
    const d = (L) => A.levels[L].d.dT, av = (L) => d(L).reduce((x, v) => x + v, 0) / 12, P = A.present, S3 = A.levels[3].stats, S2 = A.levels[2].stats;
    // the indicators that move here: skip the ones that are saturated or absent in this climate
    const cand = [["tropical nights", "trop", P.trop < 330, ""], ["hot days", "hotDays", P.hotDays < 330, ""], ["hours above 26 °C", "hot26", P.hot26 < 7000, ""], ["hours of strong outdoor heat stress", "utciHot", P.utciHot < 6000, ""], ["heating degree days", "hdd", P.hdd > 150, " Kd"], ["frost days", "frost", P.frost > 5, ""]].filter((c) => c[2] && Math.abs(S3[c[1]] - P[c[1]]) >= 3).slice(0, 3);
    let t2 = `Measured from this file's years${A.mid.known ? ` (${A.mid.from}-${A.mid.to})` : ""}, monthly means rise by ${n(fmt(av(1.5), 1) + " K", "c-futT")} on average at +1.5 °C, ${n(fmt(av(2), 1) + " K", "c-futT")} at +2 °C and ${n(fmt(av(3), 1) + " K", "c-futT")} at +3 °C, most in ${C.MONTHS_LONG[d(3).indexOf(Math.max(...d(3)))]}.`;
    if (cand.length) t2 += " " + cand.map(([lab, k, , u], i) => `${i ? lab : lab[0].toUpperCase() + lab.slice(1)} go from ${n(fmt(P[k]) + u, "c-futCmp")} to ${n(fmt(S2[k]) + u, "c-futCmp")} at +2 °C and ${n(fmt(S3[k]) + u, "c-futCmp")} at +3 °C`).join("; ") + ".";
    out.push(t2);
    if (g2.pann[0] != null) { const pw = F.gwl["2.0"].reg.world.pann[0]; out.push(`Precipitation at +2 °C: ${g2.pann[0] >= 0 ? "+" : ""}${fmt(g2.pann[0], 0)} % over the year (all land ${pw >= 0 ? "+" : ""}${fmt(pw, 0)} %), ${g2.pjja[0] >= 0 ? "+" : ""}${fmt(g2.pjja[0], 0)} % in June to August, ${g2.pdjf[0] >= 0 ? "+" : ""}${fmt(g2.pdjf[0], 0)} % in December to February. The models disagree more on precipitation than on temperature.`); }
    out.push(`The morphing shifts temperatures month by month; it keeps the file's weather sequence, its day-night swing and the spread of its hot and cold spells, so future heatwaves are underestimated.`);
    return out;
  };

  /* ---------- urban heat island ---------- */
  function uhiCard() {
    const u = ctx.uhi, a = ctx.W0.dbt, b = ctx.W.dbt, N = C.N;
    const stats = (t) => { const dm = [], dmin = []; for (let d = 0; d < 365; d++) { let s = 0, mn = 99; for (let h = 0; h < 24; h++) { const v = t[d * 24 + h]; s += v; mn = Math.min(mn, v); } dm.push(s / 24); dmin.push(mn); } let hot = 0, sum = 0; for (let i = 0; i < N; i++) { sum += t[i]; if (t[i] > 26) hot++; } return { mean: sum / N, hdd: dm.reduce((x, v) => x + Math.max(0, st.hdd - v), 0), cdd: dm.reduce((x, v) => x + Math.max(0, v - st.cdd), 0), trop: dmin.filter((v) => v >= 20).length, frost: dmin.filter((v) => v < 0).length, hot }; };
    const A = stats(a), B = stats(b);
    const rows = [["Annual mean", (x) => fmt(x.mean, 1) + " °C"], [`Heating degree days, base ${fmt(st.hdd, 1)} °C`, (x) => fmt(x.hdd) + " Kd"], [`Cooling degree days, base ${fmt(st.cdd, 1)} °C`, (x) => fmt(x.cdd) + " Kd"], ["Hours above 26 °C", (x) => fmt(x.hot)], ["Tropical nights (minimum 20 °C or more)", (x) => fmt(x.trop)], ["Frost days (minimum below 0 °C)", (x) => fmt(x.frost)]];
    const tbl = `<table class="t" style="margin-top:8px"><tr><th></th><th class="r">As recorded</th><th class="r">With heat island</th></tr>${rows.map(([l, f]) => `<tr><td>${l}</td><td class="r">${f(A)}</td><td class="r"><b>${f(B)}</b></td></tr>`).join("")}</table>`;
    const sc = K.scale({ ramp: "temp", lo: 0, hi: Math.max(1, Math.ceil(u.max)) });
    const html = K.carpet({ vals: u.uhi, mask: ctx.mask, scale: sc, unit: "K", label: "Heat island", greyHex: greyHex(), colorOf: (v) => sc.color(v), tip: (i) => `<b>${S.hourOf(i)}</b><br>Heat island: ${fmt(u.uhi[i], 1)} K<br>Air: ${fmt(a[i], 1)} °C as recorded, ${fmt(b[i], 1)} °C with heat island` }) + tbl + `<p class="note">Estimated heat island: ${fmt(u.nightMean, 1)} K on average with the sun down, ${fmt(u.mean, 1)} K over all hours, up to ${fmt(u.max, 1)} K. ${esc(uhiLabel().replace(/^./, (c) => c.toUpperCase()))}.</p>`;
    return { html, csv: () => ["hour of year,heat island (K),air temperature as recorded (C),air temperature with heat island (C)"].concat(Array.from(u.uhi, (v, i) => `${i + 1},${v.toFixed(2)},${a[i].toFixed(1)},${b[i].toFixed(2)}`)).join("\n") };
  }

  /* ---------- PV potential ---------- */
  function pvMapCard() {
    const pv = ctx.X.pv, M = pv.map, b = M.best, lat = ctx.W.meta.lat, c0 = lat >= 0 ? 180 : 0; // the equator direction in the middle
    const W = K.curW || 760, H = 330, x0 = 54, y0 = 14, w = W - x0 - 96, h = H - y0 - 46, nA = M.azs.length, nT = M.tilts.length, cw = w / nA, ch = h / nT;
    const col = (a) => ((((a - c0 + 180) % 360) + 360) % 360) / 10; // column of an azimuth
    let lo = 100; for (const r of M.grid) for (const v of r) lo = Math.min(lo, 100 * v / b.annual);
    const sc = K.scale({ ramp: "sun", lo: Math.floor(lo / 10) * 10, hi: 100 });
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="PV yield by tilt and orientation">`;
    M.tilts.forEach((t, i) => M.azs.forEach((a, j) => { const v = M.grid[i][j], p = 100 * v / b.annual, x = x0 + col(a) * cw, y = y0 + h - (i + 1) * ch; s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(cw + 0.4).toFixed(1)}" height="${(ch + 0.4).toFixed(1)}" fill="${sc.color(p)}" data-tip="${esc(`tilt ${t}°, facing ${a}°<br>${fmt(v)} kWh/kWp, ${fmt(v * PV_EFF)} kWh/m² of panel<br>${fmt(p)} % of the best`)}"/>`; }));
    // contour-like labels every 10 % on the tilt 90 row would crowd; mark the best plane, the flat panel and the façades instead
    const bx = x0 + (col(b.az) + 0.5) * cw, by = y0 + h - (b.tilt / 5 + 0.5) * ch;
    s += `<circle cx="${bx}" cy="${by}" r="7" fill="none" stroke="#18201f" stroke-width="2"/><text x="${bx + 11}" y="${by + 4}" style="font-size:12px;font-weight:600">best: ${fmt(b.tilt)}°, ${fmt(b.az)}°, ${fmt(b.annual)} kWh/kWp</text>`;
    s += `<g class="ax"><line x1="${x0}" x2="${x0 + w}" y1="${y0 + h}" y2="${y0 + h}"/>`;
    for (const [nme, a] of C.ORIENT) { const x = x0 + (col(a) + 0.5) * cw; s += `<text x="${x}" y="${y0 + h + 15}" text-anchor="middle">${nme}</text>`; }
    s += `<text x="${x0 + w / 2}" y="${y0 + h + 34}" text-anchor="middle">Orientation the panel faces</text>`;
    for (const t of [0, 15, 30, 45, 60, 75, 90]) { const y = y0 + h - (t / 5 + 0.5) * ch; s += `<text x="${x0 - 6}" y="${y + 4}" text-anchor="end">${t}°</text>`; }
    s += `<text transform="translate(14 ${y0 + h / 2}) rotate(-90)" text-anchor="middle">Tilt from horizontal</text></g>`;
    s += K.colorbar(W - 70, y0 + 6, h - 12, sc, "%");
    s += `</svg>`;
    const fac = C.ORIENT.map(([k]) => `${k} ${fmt(100 * pv.planes[k].annual / b.annual)} %`).join(" · ");
    return { html: s + `<p class="note">Vertical façades: ${fac}. Flat: ${fmt(100 * pv.planes.flat.annual / b.annual)} %.</p>`, csv: () => ["tilt (deg)," + M.azs.map((a) => `facing ${a} (kWh/kWp)`).join(",")].concat(M.tilts.map((t, i) => [t].concat(M.grid[i].map((v) => v.toFixed(1))).join(","))).join("\n") };
  }
  function pvSeries(u) {
    const P = ctx.X.pv.planes, b = ctx.X.pv.map.best, eq = ctx.W.meta.lat >= 0 ? "S" : "N", eqName = eq === "S" ? "South" : "North", m2 = !u || u.u !== "kwp", f = m2 ? PV_EFF : 1;
    const ser = [["best", `Best plane, ${fmt(b.tilt)}° facing ${fmt(b.az)}°`, "#d81600"], ["flat", "Flat", "#f1a33c"], [eq, `${eqName} façade`, "#2b4a6f"], ["E", "East façade", "#7fb3d5"], ["W", "West façade", "#4d6daa"]].map(([k, name, color]) => ({ name, color, vals: Array.from(P[k].monthly, (v) => v * f), annual: P[k].annual * f }));
    return { ser, m2, unit: m2 ? "kWh/m² of panel" : "kWh/kWp", note: m2 ? `<p class="note">Per m² of panel at 20 % efficiency (200 Wp/m²).</p>` : "" };
  }
  function pvYearCard(u) {
    const { ser, m2, unit, note } = pvSeries(u), cats = ser.map((x) => `${x.name.split(",")[0]}: ${fmt(K.U.v(x.annual, unit))}`);
    const bars = ser.map((x, k) => ({ name: x.name, color: x.color, vals: ser.map((_, j) => (j === k ? x.annual : 0)) }));
    return { html: K.bars({ cats, series: bars, stacked: true, barMax: 90, unit, height: 230, hi: st.range === "global" ? (m2 ? 420 : 2100) : null, tip: (i) => `${ser[i].name}: ${fmt(ser[i].annual)} ${unit} a year` }) + note, csv: () => ["surface,annual (" + unit + ")"].concat(ser.map((x) => `"${x.name}",${x.annual.toFixed(1)}`)).join("\n") };
  }
  function pvMonthlyCard(u) {
    const { ser, m2, unit, note } = pvSeries(u);
    return { html: K.lines({ n: 12, months: false, xTicks: C.MONTHS.map((m, i) => [i, m]), dots: true, lo: 0, hi: st.range === "global" ? (m2 ? 48 : 240) : Math.max(...ser.flatMap((x) => x.vals)) * 1.08, series: ser, unit, dec: 1, height: 260 }) + legendHtml(ser.map((x) => [x.color, x.name])) + note, csv: () => monthlyCsv(ser, unit) };
  }

  function pvRoofCard(u) {
    const R = ctx.X.pv.roof(), ew = u.lay === "ew", tilts = ew ? R.tiltsEW : R.tiltsEq, grid = ew ? R.ew : R.eq, rule = ew ? R.ruleEW : R.ruleEq, cv = R.covers;
    const show = ew ? tilts : tilts.filter((t) => t % 10 === 0), unit = { roof: "kWh/m² of roof", kwp: "kWh/kWp", shade: "%" }[u.m], val = (c) => (c ? (u.m === "roof" ? c.roof : u.m === "kwp" ? c.kwp : 100 * c.shade) : NaN);
    const ser = show.map((t) => { const i = tilts.indexOf(t); return { name: `${t}°`, color: K.ramps.sun(0.1 + 0.55 * (show.length > 1 ? show.indexOf(t) / (show.length - 1) : 0)), width: 2, vals: grid[i].map(val) }; });
    const marks = show.map((t) => { const i = tilts.indexOf(t), c = Math.min(1, rule[i]), x = (c - cv[0]) / (cv[1] - cv[0]); if (!t || x < 0) return null; const k = Math.floor(x), fr = x - k, a = grid[i][k], b = grid[i][Math.min(cv.length - 1, k + 1)]; if (!a || !b) return null; const v = val(a) + (val(b) - val(a)) * fr; return { i: x, v, color: ser[show.indexOf(t)].color, tip: `${t}°, spacing rule: cover ${fmt(100 * c)} %, ${fmt(v, u.m === "shade" ? 1 : 0)} ${unit}` }; }).filter(Boolean);
    const all = ser.flatMap((x) => x.vals).filter(isFinite);
    const html = K.lines({ n: cv.length, months: false, xTicks: cv.map((c, i) => [i, fmt(100 * c) + " %"]).filter((_, i) => i % 2 === 0), dots: true, marks, xName: (i) => `cover ${fmt(100 * cv[i])} %, tilt`, lo: u.m === "kwp" ? Math.floor(Math.min(...all) * 0.95 / 50) * 50 : 0, hi: Math.max(...all) * 1.05 || 1, series: ser, unit, dec: u.m === "shade" ? 1 : 0, height: 280 })
      + legendHtml(ser.map((x) => [x.color, `tilt ${x.name}`]).concat([["var(--ink)", "◇ spacing rule"]])) + `<p class="note">Across: panel area as a share of roof area. ${ew ? "Tents: two panels back to back per row, one facing east, one west." : "Rows face " + (R.eqAz === 180 ? "south" : "north") + "."} Tilt 0° is panels laid flat, without rows.</p>`;
    return { html, csv: () => ["tilt (deg),cover,kWh per m2 roof,kWh per kWp,shading loss (%),spacing rule cover"].concat(tilts.flatMap((t, i) => grid[i].filter(Boolean).map((c) => `${t},${c.c},${c.roof.toFixed(1)},${c.kwp.toFixed(1)},${(100 * c.shade).toFixed(2)},${rule[i].toFixed(3)}`))).join("\n") };
  }
  function pvRoofCases() {
    const pv = ctx.X.pv, R = pv.roof(), eqAz = R.eqAz, bt = Math.min(60, Math.max(5, Math.round(pv.map.best.tilt / 5) * 5)), eqName = eqAz === 180 ? "south" : "north";
    const ruleOf = (tilts, rule, t) => Math.min(1, rule[tilts.indexOf(t)]);
    const eqCase = (t, c, name) => { const r = pv.run(t, eqAz, c); return { name, t, c, kwp: r.annual, shade: r.shadeLoss / (r.st.iam + r.shadeLoss), pitch: 1 / c }; };
    const ewCase = (t, c, name) => { const a = pv.run(t, 90, c / 2), b = pv.run(t, 270, c / 2); return { name, t, c, kwp: (a.annual + b.annual) / 2, shade: (a.shadeLoss + b.shadeLoss) / (a.st.iam + b.st.iam + a.shadeLoss + b.shadeLoss), pitch: 2 / c }; };
    let bestEq = null; R.eq.forEach((row, i) => { if (!R.tiltsEq[i]) return; row.forEach((c) => { if (c && c.shade <= 0.05 && (!bestEq || c.roof > bestEq.roof)) bestEq = c; }); });
    const cases = [{ name: "Flat, edge to edge", t: 0, c: 1, kwp: pv.planes.flat.annual, shade: 0, pitch: null },
      eqCase(bt, ruleOf(R.tiltsEq, R.ruleEq, bt), `Rows at ${bt}° facing ${eqName}, spacing rule`),
      eqCase(15, ruleOf(R.tiltsEq, R.ruleEq, 15), `Rows at 15° facing ${eqName}, spacing rule`)];
    if (bestEq) cases.push(eqCase(bestEq.t, bestEq.c, `Rows at ${bestEq.t}° facing ${eqName}, densest with shading loss under 5 %`));
    cases.push(ewCase(10, ruleOf(R.tiltsEW, R.ruleEW, 10), "East-west tents at 10°, spacing rule"));
    for (const c of cases) c.roof = c.kwp * PV_EFF * c.c;
    return cases;
  }
  S.pvRoofCases = pvRoofCases;
  function pvRoofCmpCard() {
    const cases = pvRoofCases(), cols = ["#f1a33c", "#d81600", "#a61b00", "#6b0f00", "#4d6daa"];
    const bars = cases.map((x, k) => ({ name: x.name, color: cols[k % cols.length], vals: cases.map((_, j) => (j === k ? x.roof : 0)) }));
    const chart = K.bars({ cats: cases.map((x) => fmt(K.U.v(x.roof, "kWh/m² of roof"))), series: bars, stacked: true, barMax: 90, unit: "kWh/m² of roof", height: 220, tip: (i) => `${cases[i].name}: ${fmt(cases[i].roof)} kWh per m² of roof` });
    const tbl = `<table class="t" style="margin-top:6px"><tr><th>Layout</th><th class="r">Cover</th><th class="r">Row pitch ÷ panel depth</th><th class="r">Shading loss</th><th class="r">kWh/kWp</th><th class="r">Per area of roof</th></tr>${cases.map((x, k) => `<tr><td><span class="swatch" style="background:${cols[k % cols.length]}"></span> ${esc(x.name)}</td><td class="r">${fmt(100 * x.c)} %</td><td class="r">${x.pitch ? fmt(x.pitch, 2) + " ×" : "none"}</td><td class="r">${fmt(100 * x.shade, 1)} %</td><td class="r">${fmt(x.kwp)}</td><td class="r"><b>${fmt(x.roof)} kWh/m² of roof</b></td></tr>`).join("")}</table>`;
    return { html: chart + tbl + `<p class="note">Row pitch is the distance from one row to the next, as a multiple of the panel depth along the slope; tents count both faces. Cover and yield refer to the usable roof area.</p>`, csv: () => ["layout,tilt (deg),cover,row pitch per m of panel (m),shading loss (%),kWh per kWp,kWh per m2 roof"].concat(cases.map((x) => `"${x.name}",${x.t},${x.c.toFixed(3)},${x.pitch ? x.pitch.toFixed(3) : ""},${(100 * x.shade).toFixed(2)},${x.kwp.toFixed(1)},${x.roof.toFixed(1)}`)).join("\n") };
  }
  function pvLossCard() {
    const P = ctx.X.pv.planes, eq = ctx.W.meta.lat >= 0 ? "S" : "N", cols = [["best", "Best plane"], ["flat", "Flat"], [eq, `${eq === "S" ? "South" : "North"} façade`]];
    const steps = [["poa", "Sunlight on the panel"], ["iam", "after reflection"], ["temp", "after heat"], ["sys", "after system losses (14 %)"], ["ac", "after the inverter"]];
    const cell = (k, i) => { const s = P[k].st, v = s[steps[i][0]]; if (!i) return `<td class="r">${fmt(v)}</td>`; const prev = s[steps[i - 1][0]], l = 100 * (1 - v / prev); return `<td class="r">${fmt(v)} <span style="display:inline-block;min-width:5.5em;color:var(--soft-ink, #6b7672);font-size:0.85em">${l >= 0 ? "−" : "+"}${fmt(Math.abs(l), 1)} %</span></td>`; };
    const pr = (k) => `<td class="r"><b>${fmt(100 * P[k].st.ac / P[k].st.poa)} %</b></td>`;
    const html = `<table class="t"><tr><th>kWh/kWp a year</th>${cols.map((c) => `<th class="r">${c[1]}</th>`).join("")}</tr>${steps.map((st0, i) => `<tr><td>${st0[1]}</td>${cols.map((c) => cell(c[0], i)).join("")}</tr>`).join("")}<tr><td>Electricity as a share of sunlight</td>${cols.map((c) => pr(c[0])).join("")}</tr><tr><td>Electricity per area of panel (20 % efficient panels)</td>${cols.map((c) => `<td class="r"><b>${fmt(P[c[0]].st.ac * PV_EFF)} kWh per m²</b></td>`).join("")}</tr></table>`;
    return { html, csv: () => ["step," + cols.map((c) => c[1] + " (kWh/kWp)").join(",")].concat(steps.map((st0) => [st0[1]].concat(cols.map((c) => P[c[0]].st[st0[0]].toFixed(1))).join(","))).join("\n") };
  }
  function orientSeasonCard() {
    const s = ctx.X.surf, lat = ctx.W.meta.lat, sm = lat >= 0 ? [5, 6, 7] : [11, 0, 1], wm = lat >= 0 ? [11, 0, 1] : [5, 6, 7], keys = C.ORIENT.map((o) => o[0]).concat(["Roof"]);
    const sum = (k, ms) => ms.reduce((a, b) => a + s[k].monthly[b], 0);
    const ser = [{ name: `Summer, ${lat >= 0 ? "Jun to Aug" : "Dec to Feb"}`, color: "var(--s4)", vals: keys.map((k) => sum(k, sm)) }, { name: `Winter, ${lat >= 0 ? "Dec to Feb" : "Jun to Aug"}`, color: "var(--s1)", vals: keys.map((k) => sum(k, wm)) }];
    return { html: K.bars({ cats: keys, series: ser, unit: "kWh/m²", height: 250, hi: st.range === "global" ? 700 : null }) + legendHtml(ser.map((x) => [x.color, x.name])), csv: () => ["surface," + ser.map((x) => x.name).join(",")].concat(keys.map((k, i) => [k].concat(ser.map((x) => x.vals[i].toFixed(1))).join(","))).join("\n") };
  }
  function orientMCard() {
    const s = ctx.X.surf, keys = C.ORIENT.map((o) => o[0]).concat(["Roof"]); let max = 0; for (const k of keys) max = Math.max(max, ...s[k].monthly);
    const sc = K.scale({ ramp: "sun", lo: 0, hi: (st.range === "global" ? 260 : max) / 0.66 });
    const cell = (v) => { const c = sc.color(v), dark = v / sc.hi < 0.38; return `<td class="r" style="background:${c};color:${dark ? "#fff" : "#18201f"}" data-tip="${esc(fmt(v) + " kWh/m²")}">${fmt(K.U.v(v, "kWh/m²"))}</td>`; };
    const html = `<div style="overflow-x:auto"><table class="t"><tr><th>Surface</th>${C.MONTHS.map((m) => `<th class="r">${m}</th>`).join("")}<th class="r">Year</th></tr>${keys.map((k) => `<tr><th>${k === "Roof" ? "Roof" : k + " façade"}</th>${s[k].monthly.map(cell).join("")}<td class="r"><b>${fmt(s[k].annual)}</b></td></tr>`).join("")}</table></div>`;
    return { html, csv: () => ["surface," + C.MONTHS.join(",") + ",year"].concat(keys.map((k) => [k].concat(s[k].monthly.map((v) => v.toFixed(2)), [s[k].annual.toFixed(1)]).join(","))).join("\n") };
  }
  function luxCard() {
    const R = ctx.R; if (!R.illumOK) return { html: `<p class="note">This file does not record illuminance.</p>` };
    const ser = R.lux.map((l, k) => ({ name: `Above ${l.t / 1000} klx`, color: ["#4d6daa", "#f1e969", "#d81600"][k], vals: l.monthly.map((v, m) => v / C.MDAYS[m]) }));
    return { html: K.bars({ series: ser, unit: "hours a day", dec: 1, height: 230 }) + legendHtml(ser.map((s) => [s.color, s.name])), csv: () => monthlyCsv(ser, "hours per day") };
  }
  const ROSE_COLORS = [null].concat([1.25, 3, 5, 7, 9, 14].map((v) => K.ramps.wind(0.1 + 0.9 * v / 15)));
  function roseLegend() { return legendHtml(ROSE_COLORS.slice(1).map((c, k) => [c, K.binName(k + 1)])); }
  function roseCsv(roses) { const r = ["rose,direction," + ROSE_COLORS.slice(1).map((_, k) => K.binName(k + 1)).join(",") + ",calm hours,total hours"]; for (const [name, ro] of roses) ro.counts.forEach((c, k) => r.push([name, K.dirName(k * ro.step)].concat(c.slice(1), [ro.calm, ro.total]).join(","))); return r.join("\n"); }
  function roseCard() { const ro = C.windRose(ctx.W, ctx.mask); return { html: `<div style="max-width:540px;margin:auto">${K.rose({ rose: ro, colors: ROSE_COLORS, r: 130, label: "Wind rose" })}</div>` + roseLegend(), csv: () => roseCsv([["annual or filtered", ro]]) }; }
  function roseSCard() {
    const lat = ctx.W.meta.lat, order = ["Winter", "Spring", "Summer", "Autumn"], ro = order.map((s) => [s, C.windRose(ctx.W, andMask(seasonMaskOf(lat, s)))]);
    const pmax = Math.max(...ro.map(([, r]) => Math.max(...r.counts.map((c) => c.reduce((a, b) => a + b, 0))) / (r.total || 1) * 100));
    const months = { Winter: lat >= 0 ? "Dec to Feb" : "Jun to Aug", Spring: lat >= 0 ? "Mar to May" : "Sep to Nov", Summer: lat >= 0 ? "Jun to Aug" : "Dec to Feb", Autumn: lat >= 0 ? "Sep to Nov" : "Mar to May" };
    return { html: `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;max-width:860px;margin:auto">${ro.map(([s, r]) => K.rose({ rose: r, colors: ROSE_COLORS, r: 90, pmax: Math.ceil(pmax / 2) * 2, title: `${s}, ${months[s]}`, label: s })).join("")}</div>` + roseLegend(), csv: () => roseCsv(ro) };
  }
  function roseDCard() {
    const X = ctx.X, dm = new Uint8Array(N), nm = new Uint8Array(N); for (let i = 0; i < N; i++) { if (X.alt[i] > 0) dm[i] = 1; else nm[i] = 1; }
    const ro = [["Sun up", C.windRose(ctx.W, andMask(dm))], ["Sun down", C.windRose(ctx.W, andMask(nm))]]; const pmax = Math.max(...ro.map(([, r]) => Math.max(...r.counts.map((c) => c.reduce((a, b) => a + b, 0))) / (r.total || 1) * 100));
    return { html: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:860px;margin:auto">${ro.map(([s, r]) => K.rose({ rose: r, colors: ROSE_COLORS, r: 90, pmax: Math.ceil(pmax / 2) * 2, title: s, label: s })).join("")}</div>` + roseLegend(), csv: () => roseCsv(ro) };
  }
  function seasonMaskOf(lat, which) { const m = new Uint8Array(N); for (let i = 0; i < N; i++) m[i] = C.seasonOf(C.T.month[i], lat).name === which ? 1 : 0; return m; }
  function andMask(m) { if (!ctx.mask) return m; const o = new Uint8Array(N); for (let i = 0; i < N; i++) o[i] = m[i] && ctx.mask[i] ? 1 : 0; return o; }

  /* psychrometric chart */
  function psyCard(u) {
    const W = ctx.W, X = ctx.X, Z = X.zones, P = Z.params, p = 101325, mask = ctx.mask;
    const Wd = 760, H = 470, x0 = 48, y0 = 14, w = 640, h = 410, tLo = -15, tHi = 45, wHi = 30;
    const Xp = (t) => x0 + w * (t - tLo) / (tHi - tLo), Yp = (wg) => y0 + h - h * wg / wHi;
    const wsat = (t) => 1000 * C.humRatio(C.pws(t), p);
    let s = `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Psychrometric chart"><defs><clipPath id="psyclip"><path d="M${Xp(tLo)},${Yp(0)}`;
    for (let t = tLo; t <= tHi; t += 0.5) s += `L${Xp(t).toFixed(1)},${Yp(Math.min(wHi, wsat(t))).toFixed(1)}`;
    s += `L${Xp(tHi)},${Yp(0)}Z"/></clipPath></defs>`;
    // frequency cells, 1 K by 1 g/kg
    const cnt = {}; let max = 0; for (let i = 0; i < N; i++) { if (mask && !mask[i]) continue; const a = Math.floor(W.dbt[i]), b = Math.floor(X.w[i] * 1000); if (a < tLo || a >= tHi || b < 0 || b >= wHi) continue; const k = a + "," + b; cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] > max) max = cnt[k]; }
    const sc = K.scale({ ramp: "green", lo: 0, hi: Math.max(1, max) });
    s += `<g clip-path="url(#psyclip)">`; for (const [k, c] of Object.entries(cnt)) { const [a, b] = k.split(",").map(Number); s += `<rect x="${Xp(a).toFixed(1)}" y="${Yp(b + 1).toFixed(1)}" width="${(w / (tHi - tLo)).toFixed(2)}" height="${(h / wHi).toFixed(2)}" fill="${sc.color(0.15 * max + 0.85 * c)}" data-tip="${esc(`${a} to ${a + 1} °C, ${b} to ${b + 1} g/kg: ${c} hours`)}"/>`; } s += `</g>`;
    // relative humidity curves
    for (const rh of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) { let d = ""; for (let t = tLo; t <= tHi; t += 0.5) { const wv = 1000 * C.humRatio(C.pws(t) * rh / 100, p); if (wv > wHi) break; d += (d ? "L" : "M") + Xp(t).toFixed(1) + "," + Yp(wv).toFixed(1); } s += `<path d="${d}" fill="none" stroke="${rh === 100 ? "var(--ink)" : "var(--line)"}" stroke-width="${rh === 100 ? 1.5 : 1}"/>`; const tl = rh === 100 ? 30 : 40; const wl = 1000 * C.humRatio(C.pws(tl) * rh / 100, p); if (wl < wHi - 0.5 && rh % 20 === 0) s += `<text x="${Xp(tl) + 2}" y="${Yp(wl) - 2}" font-size="9">${rh}%</text>`; }
    // axes
    s += `<g class="ax"><line x1="${x0}" x2="${x0 + w}" y1="${y0 + h}" y2="${y0 + h}"/>`; for (const [t, lab] of K.U.ticks(tLo, tHi, 12, "°C")) { if (t < tLo - 1e-6 || t > tHi + 1e-6) continue; s += `<line x1="${Xp(t)}" x2="${Xp(t)}" y1="${y0 + h}" y2="${y0 + h + 4}"/><text x="${Xp(t)}" y="${y0 + h + 16}" text-anchor="middle">${fmt(lab)}</text>`; } s += `<text x="${x0 + w}" y="${y0 + h + 32}" text-anchor="end">dry bulb temperature, °C</text>`;
    s += `<line x1="${x0 + w}" x2="${x0 + w}" y1="${y0}" y2="${y0 + h}"/>`; for (const [wv, lab] of K.U.ticks(0, wHi, 6, "g/kg")) { if (wv < -1e-6 || wv > wHi + 1e-6) continue; s += `<line x1="${x0 + w}" x2="${x0 + w + 4}" y1="${Yp(wv)}" y2="${Yp(wv)}"/><text x="${x0 + w + 7}" y="${Yp(wv) + 3.5}">${fmt(lab)}</text>`; } s += `<text x="${x0 + w - 4}" y="${y0 + 10}" text-anchor="end">humidity ratio, g/kg</text></g>`;
    // zones
    const show = u.z === "none" ? [] : u.z === "all" ? C.CC_KEYS.map((k) => k[0]) : [...st.ccSel];
    const zs = zoneOutlines(Z, P, show); for (const z of zs) s += `<path d="${z.d}" fill="${z.col}" fill-opacity="0.07" stroke="${z.col}" stroke-width="2" clip-path="url(#psyclip)" data-tip="${esc(z.name + ": " + fmt(Z.hours[z.k]) + " hours")}"/><text x="${z.lx}" y="${z.ly}" font-size="10" font-weight="600" style="fill:${z.col}">${esc(z.short)}</text>`;
    s += `</svg>`;
    return { html: s + legendHtml([[sc.color(0.15 * max), "Few hours"], [sc.color(max), `Most hours in one cell (${max})`]]), csv: () => { const r = ["dry bulb from (C),humidity ratio from (g/kg),hours"]; for (const [k, c] of Object.entries(cnt)) r.push(k + "," + c); return r.join("\n"); } };
  }
  const zoneOutlines = S.zoneOutlines; // shared with Clima Compare (sections.js)
  function zonesCard() {
    const Z = ctx.X.zones, names = C.CC_KEYS, cover = C.strategyCover(Z, [...st.ccSel]);
    const rows = names.map(([k, l]) => { const fam = S.CC_FAMILY[k], col = fam >= 0 ? S.FAMILIES[fam][2] : "#5b6663"; const chk = k === "heat" || k === "cool" ? "" : `<input type="checkbox" data-zone="${k}" ${st.ccSel.has(k) ? "checked" : ""} aria-label="${esc(l)}">`; return `<tr><td>${chk}</td><td><span class="swatch" style="background:${col}"></span> ${esc(l)}</td><td class="r">${fmt(Z.hours[k])}</td><td class="r">${fmt(100 * Z.hours[k] / N, 1)} %</td></tr>`; }).join("");
    const html = `<table class="t"><tr><th></th><th>Zone</th><th class="r">Hours</th><th class="r">Share</th></tr>${rows}<tr><td></td><td><b>Covered by the ticked zones together</b></td><td class="r"><b>${fmt(cover.hours)}</b></td><td class="r"><b>${fmt(100 * cover.hours / N, 1)} %</b></td></tr></table><p class="note">Zones overlap, so their hours do not add up. Sun shading and wind protection describe conditions beside the comfort question and are counted separately.</p>` + criteriaHtml();
    return { html, csv: () => ["zone,hours,share"].concat(names.map(([k, l]) => `"${l}",${Z.hours[k]},${(Z.hours[k] / N).toFixed(4)}`)).join("\n") };
  }
  const CRIT = [["comfort.met", "Comfort: metabolic rate", "met"], ["comfort.cloS", "Comfort: clothing in summer", "clo"], ["comfort.cloW", "Comfort: clothing in winter", "clo"], ["comfort.wMax", "Comfort: upper humidity ratio", "kg/kg"], ["shade.tMin", "Sun shading above", "°C"], ["shade.ghiMin", "Sun shading with global radiation above", "W/m²"], ["mass.dT", "High mass: up to this far above comfort", "K"], ["massNight.dT", "Mass and night ventilation: up to this far above comfort", "K"], ["massNight.nightBelow", "Mass and night ventilation: night minimum at least this far below the comfort limit", "K"], ["evap.wbMax", "Direct evaporative: wet bulb up to", "°C"], ["evap2.wbMax", "Two-stage evaporative: wet bulb up to", "°C"], ["natVent.dT", "Natural ventilation: up to this far above comfort", "K"], ["fan.dT", "Fan-forced ventilation: up to this far above comfort", "K"], ["internal.balance", "Internal gains: balance point", "°C"], ["solarLow.irrMin", "Passive solar: irradiance on the equator-facing façade, mean of the last hours, at least", "W/m²"], ["solarLow.dT", "Passive solar, low mass: down to this far below comfort", "K"], ["solarHigh.dT", "Passive solar, high mass: down to this far below comfort", "K"], ["windProt.vMin", "Wind protection: wind above", "m/s"], ["windProt.tMax", "Wind protection: air below", "°C"]];
  function criteriaHtml() {
    const g = (path) => path.split(".").reduce((o, k) => o[k], st.cc);
    return `<details><summary class="lab" style="cursor:pointer">Criteria (editable)</summary><table class="t">${CRIT.map(([p, l, u]) => `<tr><td>${esc(l)}</td><td class="r"><input type="number" step="any" data-crit="${p}" data-u="${encodeURIComponent(u)}" value="${+K.U.v(g(p), u).toPrecision(4)}" style="width:80px"> ${u}</td></tr>`).join("")}</table><p class="note">Values reconstructed from the Climate Consultant 6 criteria screen. Please check them against your copy before relying on the hours. <button class="btn small" id="critreset">Restore defaults</button></p></details>`;
  }
  function zcarpetCard(u) {
    const Z = ctx.X.zones, mode = u.m;
    if (mode === "fam") { const fam = new Uint8Array(N); for (let i = 0; i < N; i++) fam[i] = S.familyOf(Z, i); return { html: K.carpet({ vals: fam, mask: ctx.mask, greyHex: greyHex(), label: "Strategy families", colorOf: (v) => S.FAMILIES[v][2], legend: S.FAMILIES.map((f) => [f[2], f[1].replace(/:.*$/, "")]), tip: (i) => `<b>${S.hourOf(i)}</b><br>${esc(S.FAMILIES[fam[i]][1])}<br>${zonesAt(Z, i)}` }), csv: () => hourlyCsv([["family (0 comfort, 1 passive heating, 2 ventilation or mass, 3 evaporative, 4 heating, 5 cooling or dehumidification)", fam]]) }; }
    let m, label;
    if (mode === "sel") { m = C.strategyCover(Z, [...st.ccSel]).mask; label = "Covered by the ticked zones"; } else { const k = mode.slice(4); m = Z.S[k]; label = Object.fromEntries(C.CC_KEYS)[k]; }
    return { html: K.carpet({ vals: m, mask: ctx.mask, greyHex: greyHex(), label, colorOf: (v) => (v ? "#23614f" : "#eef1ec"), legend: [["#23614f", "Yes"], ["#eef1ec", "No"]], tip: (i) => `<b>${S.hourOf(i)}</b><br>${esc(label)}: ${m[i] ? "yes" : "no"}<br>${zonesAt(Z, i)}` }), csv: () => hourlyCsv([[label, m]]) };
  }
  const zonesAt = (Z, i) => { const l = C.CC_KEYS.filter(([k]) => Z.S[k][i]).map((x) => x[1]); return l.length ? "Zones: " + esc(l.join(", ")) : ""; };
  function nvCard() { const m = ctx.R.nvMask; const sum = new Array(12).fill(0); for (let i = 0; i < N; i++) if (m[i]) sum[C.T.month[i] - 1]++; return { html: `<div class="row" style="max-width:520px;margin-bottom:6px"><label>Air from</label><input type="number" data-nv="tMin" value="${+K.U.v(st.nv.tMin, "°C").toFixed(1)}"><label>to</label><input type="number" data-nv="tMax" value="${+K.U.v(st.nv.tMax, "°C").toFixed(1)}"><label>°C, dew point up to</label><input type="number" data-nv="dpMax" value="${+K.U.v(st.nv.dpMax, "°C").toFixed(1)}"><label>°C</label></div>` + K.carpet({ vals: m, mask: ctx.mask, greyHex: greyHex(), label: "Natural ventilation hours", colorOf: (v) => (v ? "#2a78d6" : "#eef1ec"), legend: [["#2a78d6", "Inside the limits"], ["#eef1ec", "Outside"]], tip: (i) => `<b>${S.hourOf(i)}</b><br>${fmt(ctx.W.dbt[i], 1)} °C, dew point ${fmt(ctx.W.dpt[i], 1)} °C` }) + `<p class="note">By month: ${C.MONTHS.map((mo, k) => `${mo} ${sum[k]}`).join(", ")} hours.</p>`, csv: () => hourlyCsv([["inside the limits", m]]) }; }
  function precCard() { const R = ctx.R; if (!R.precOK) return { html: `<p class="note">No precipitation in this file.</p>` }; const ser = [{ name: "Precipitation", color: "#00c8ff", vals: R.precM }]; return { html: K.bars({ series: ser, unit: "mm", height: 220 }), csv: () => monthlyCsv(ser, "mm") }; }
  function rainCard() { const R = ctx.R, r = ctx.X.rain; if (!R.precOK) return { html: `<p class="note">No precipitation in this file.</p>` }; const vals = C.ORIENT.map(([n, az]) => [n, r[n].annual, az]); const sc = K.scale({ ramp: "rain", lo: 0, hi: Math.max(1, ...vals.map((v) => v[1])) * 1.1 }); return { html: K.orient({ vals, unit: "l/m² a year", color: sc.color, label: "Driving rain" }), csv: () => ["orientation,annual l/m2"].concat(vals.map((v) => `${v[0]},${v[1].toFixed(2)}`)).join("\n") }; }
  function snowCard() { const R = ctx.R; if (!R.snowOK) return { html: `<p class="note">No snow depth in this file.</p>` }; const W = ctx.W, dmax = new Array(365).fill(0); for (let d = 0; d < 365; d++) for (let h = 0; h < 24; h++) dmax[d] = Math.max(dmax[d], W.snow[d * 24 + h] || 0); return { html: K.lines({ n: 365, series: [{ vals: dmax, color: "#0000ff" }], unit: "cm", lo: 0, height: 200, tip: (k) => `<b>${S.dateOf(k)}</b><br>${fmt(dmax[k])} cm` }) }; }
  function utciMCard(u) { const M = ctx.R.utci[u.s].mon; const ser = K.UTCI_COLORS.map((c, k) => ({ name: C.UTCI_CLASSES[k][2], color: c, vals: M.map((x) => x[k]) })).filter((s) => s.vals.some((v) => v > 0)); return { html: K.bars({ series: ser, stacked: true, unit: "hours", height: 240 }) + legendHtml(ser.map((s) => [s.color, s.name])), csv: () => monthlyCsv(ser, "hours") }; }
  function qualityCard() {
    const W = ctx.W, m = W.meta, keys = C.FIELDS.map((f) => f[1]);
    const label = { dbt: "Dry bulb temperature", dpt: "Dew point", rh: "Relative humidity", p: "Pressure", etrh: "Extraterrestrial horizontal radiation", etrn: "Extraterrestrial direct normal radiation", hir: "Horizontal infrared radiation", ghi: "Global horizontal radiation", dni: "Direct normal radiation", dhi: "Diffuse horizontal radiation", gil: "Global horizontal illuminance", dnil: "Direct normal illuminance", dil: "Diffuse horizontal illuminance", zl: "Zenith luminance", wd: "Wind direction", ws: "Wind speed", tsc: "Total sky cover", osc: "Opaque sky cover", vis: "Visibility", ceil: "Ceiling height", pw: "Precipitable water", aod: "Aerosol optical depth", snow: "Snow depth", dss: "Days since last snowfall", alb: "Albedo", prec: "Liquid precipitation depth", precr: "Liquid precipitation rate" };
    const rows = keys.map((k) => { const mi = W.missing[k] || 0, f = W.filled[k]; const all = mi === N; return `<tr><td>${esc(label[k] || k)}</td><td class="r">${fmt(N - mi)}</td><td class="r">${fmt(mi)}</td><td>${all ? "not in the file" : mi ? (f ? "short gaps interpolated" : "left as missing") : "complete"}</td></tr>`; }).join("");
    const meta = [["Data set", m.source], ["WMO station", m.wmo], ["Station elevation", fmt(m.elev) + " m"], ["Years used", W.years.slice(0, 12).map(([y, c]) => `${y} (${Math.round(c / 24)} d)`).join(", ")], ["Data periods line", m.dataPeriods], ["Comments", m.comments.join(" · ")], ["Most common source flags", W.flagTop.map(([f, c]) => `${f} (${c} h)`).join(" · ")]];
    return { html: `<table class="t">${meta.map(([a, b]) => `<tr><th>${esc(a)}</th><td style="word-break:break-word">${esc(b || "–")}</td></tr>`).join("")}</table><h3 style="margin:14px 0 4px;font-size:13px">Fields</h3><div style="overflow-x:auto"><table class="t"><tr><th>Field</th><th class="r">Valid hours</th><th class="r">Missing hours</th><th>Treatment</th></tr>${rows}</table></div><p class="note">EPW files mark missing values with fixed codes (for example 99.9 for temperature or 9999 for radiation). The source flags record, field by field, whether a value was measured, modelled or filled; their meaning depends on the data set. <button class="btn small" id="csvall">Download all processed hourly data (CSV)</button></p>` };
  }
  function exMask() {
    const e = st.ex, base = ctx.mask; if (e.fmin === "" && e.fmax === "") return base;
    const a = S.V[e.fv].get(ctx.W, ctx.X), lo = e.fmin === "" ? -Infinity : +e.fmin, hi = e.fmax === "" ? Infinity : +e.fmax, m = new Uint8Array(N);
    for (let i = 0; i < N; i++) m[i] = (!base || base[i]) && a[i] >= lo && a[i] <= hi ? 1 : 0; return m;
  }
  function scatterCard(u) {
    const VX = S.V[u.x], VY = S.V[u.y], x = VX.get(ctx.W, ctx.X), y = VY.get(ctx.W, ctx.X), mask = exMask(); let sc = null, cv = null, VC = null;
    if (u.c !== "none") { VC = S.V[u.c]; cv = VC.get(ctx.W, ctx.X); sc = S.scaleFor(u.c, ctx); }
    const glob = st.range === "global";
    return { html: K.scatter({ x, y, mask, xr: glob ? [VX.sc.lo, VX.sc.hi] : null, yr: glob ? [VY.sc.lo, VY.sc.hi] : null, xLabel: `${VX.label}, ${VX.unit}`, xUnit: VX.unit, yUnit: VY.unit, scale: sc, cUnit: VC ? VC.unit : "", colorOf: cv ? (i) => sc.color(sc.lo + (sc.hi - sc.lo) * (0.14 + 0.86 * Math.max(0, Math.min(1, (cv[i] - sc.lo) / (sc.hi - sc.lo))))) : null, label: "Scatter" }), csv: () => hourlyCsv([[VX.label, x], [VY.label, y]].concat(cv ? [[VC.label, cv]] : [])) };
  }
  function explorerControls() {
    const e = st.ex, opts = S.varOptions().map(([k, l]) => `<option value="${k}" ${k === e.fv ? "selected" : ""}>${esc(l)}</option>`).join("");
    const m = exMask(); let c = 0; for (let i = 0; i < N; i++) if (!m || m[i]) c++;
    return `<div class="row" style="flex-wrap:wrap;max-width:860px;margin:6px 0 12px"><label>Keep only hours where</label><select id="exfv" style="flex:2">${opts}</select><label>is between</label><input type="number" id="exmin" value="${e.fmin === "" ? "" : +K.U.v(+e.fmin, S.V[e.fv].unit).toPrecision(4)}" placeholder="any"><label>and</label><input type="number" id="exmax" value="${e.fmax === "" ? "" : +K.U.v(+e.fmax, S.V[e.fv].unit).toPrecision(4)}" placeholder="any"></div><p class="note" id="excount">${fmt(c)} hours meet the conditions (${fmt(100 * c / N, 1)} % of the year)${ctx.mask ? ", inside the filter at the left" : ""}.</p>`;
  }

  /* ---------------- guide ---------------- */
  function guideHtml() {
    const P = C.CC_DEFAULT;
    return `<div class="guide">
<p>Macro Clima describes the climate held in one EPW weather file. It does not recommend. Each section opens with a short reading written by fixed rules from the numbers on screen; click a number to see the chart it comes from. Two sibling apps test responses to the climate: Room Design Guide for a room, Micro Clima for outdoor places.</p>
<h3>Time and the sun</h3>
<p>An EPW hour is an interval that ends at the stated hour, in local standard time without daylight saving. Measured and modelled values describe that interval, so the sun is placed at its midpoint: the row for 12:00 uses the sun at 11:30. At Berlin on 21 June this moves the sun from an azimuth of 176.2° to 162.3°. Solar position follows the NOAA formulation of Meeus, within 0.03° of the NREL SPA algorithm in pvlib.</p>
<h3>Seasons</h3>
<p>Seasons are meteorological: December to February, March to May, June to August, September to November. South of the equator the names are swapped, so that summer is always the warm season.</p>
<h3>Radiation components</h3>
<p>Global horizontal radiation is what an unobstructed horizontal surface receives. It is the direct beam, measured on a surface facing the sun (direct normal) and projected onto the horizontal, plus the diffuse radiation scattered by the sky and clouds. Vertical façades and the roof are computed with the Perez 1990 sky model and a ground reflectance from the file (0.2 where missing), without surroundings or shading.</p>
<h3>Reading a sun path</h3>
<p>The default view is equidistant: the sky seen from the ground, looking up, with north at the top. The centre is the zenith, rings mark solar altitude, the outer circle is the horizon, and altitude scales evenly with distance. The cylindrical view unrolls the sky: azimuth across, altitude up, centred on the equator-facing direction. The 3D view shows the sky dome from outside and can be turned by dragging. In every view the arcs trace the sun on the 21st of a month; the figure-of-eight lines trace one hour across the year.</p>
<h3>Reading a wind rose</h3>
<p>A petal points to where the wind comes from. Its length is the share of hours from that direction, its bands the speeds. Speeds are hourly means at the station, usually 10 m above open ground.</p>
<h3>Reading a psychrometric chart</h3>
<p>The horizontal axis is air temperature, the vertical axis the water content of the air (humidity ratio, grams of water per kilogram of dry air). The top curve is saturation; the others mark relative humidity. Moving right at constant height is heating or cooling without adding water; evaporative cooling moves up and to the left along a line of constant wet bulb temperature.</p>
<h3>Givoni-Milne zones, Climate Consultant criteria</h3>
<p>The zones mark outdoor conditions under which a passive measure can keep a building interior comfortable, following Givoni and Milne and the criteria of Climate Consultant 6. The comfort zone uses the ASHRAE 55 PMV model at ${P.comfort.met} met, ${P.comfort.cloS} clo in summer and ${P.comfort.cloW} clo in winter, 0.1 m/s air speed and PMV between −${P.comfort.pmv} and +${P.comfort.pmv}, up to a humidity ratio of ${P.comfort.wMax * 1000} g/kg. Other zones are measured from the edges of this zone:</p>
<ul><li>Sun shading: air above ${P.shade.tMin} °C with global horizontal radiation above ${P.shade.ghiMin} W/m².</li><li>High thermal mass: up to ${P.mass.dT} K above the comfort zone, on days whose mean stays inside it.</li><li>High mass with night ventilation: up to ${P.massNight.dT} K above, when the day's minimum falls at least ${P.massNight.nightBelow} K below the upper comfort limit.</li><li>Direct evaporative cooling: above the zone with a wet bulb up to ${P.evap.wbMax} °C; two-stage: up to ${P.evap2.wbMax} °C.</li><li>Natural ventilation: up to ${P.natVent.dT} K above the zone, relative humidity up to ${P.natVent.rhMax} %; fan-forced ventilation: up to ${P.fan.dT} K (about 0.8 m/s, Milne 2009).</li><li>Internal heat gain: from a balance point of ${P.internal.balance} °C up to the zone.</li><li>Passive solar direct gain: below the zone, down to ${P.solarLow.dT} K (low mass) or ${P.solarHigh.dT} K (high mass), when the equator-facing façade has received at least ${P.solarLow.irrMin} W/m² on average over the last ${P.solarLow.hours} or ${P.solarHigh.hours} hours.</li><li>Wind protection of outdoor spaces: wind above ${P.windProt.vMin} m/s with air below ${P.windProt.tMax} °C.</li></ul>
<p><b>Assumption to check:</b> these values were reconstructed for this app and have not yet been compared line by line with the Climate Consultant criteria screen. They are editable in the strategy section.</p>
<h3>UTCI and mean radiant temperature</h3>
<p>UTCI uses the polynomial of Bröde et al. (2012), as in pythermalcomfort. Inputs outside its range (air below −50 or above 50 °C, wind outside 0.5 to 17 m/s, radiant temperature more than 70 K above or 30 K below air) are held at its edge, so extreme hours keep their stress class; the reading says how many hours this concerns. Micro Clima and Room Clima use the same code. The mean radiant temperature in the open has three parts. Air temperature stands for the ground and surroundings. SolarCal (ASHRAE 55, Appendix C) adds the effect of direct, diffuse and ground-reflected radiation on a standing person, with the measured diffuse and global horizontal values; CBE Clima passed only direct normal radiation, and the library then assumed diffuse to be 0.2 × direct normal. The longwave exchange with the sky subtracts half the difference between air and sky temperature, the sky temperature coming from the file\'s horizontal infrared radiation, as in Ladybug Tools. In shade the direct beam is blocked; the sky and the ground remain in view. CBE Clima set the mean radiant temperature in shade equal to air temperature and left out the sky exchange altogether.</p>
<h3>Degree days</h3>
<p>Degree days are computed from daily mean temperatures. The default heating base is 15 °C, close to common European practice; the German Gradtagzahl G 20/15 (VDI 4710) is shown automatically for German stations and can be switched on or off at the left and in the chart.</p>
<h3>Adaptive comfort bands</h3>
<p>Six bands can be chosen in the daily temperature chart: EN 16798-1 categories I, II and III (running mean with α = 0.8; comfort temperature 0.33 × running mean + 18.8 °C; upper limits +2, +3, +4 K, lower limits −3, −4, −5 K), the German national annex DIN EN 16798-1/NA category II (as in Room Design Guide), and ASHRAE 55 at 90 % and 80 % acceptability (prevailing mean of the previous seven days; 0.31 × mean + 17.8 °C, ±2.5 or ±3.5 K). The default follows the station: the German annex in Germany, EN 16798-1 category II elsewhere in Europe, ASHRAE 55 at 80 % in the rest of the world. Outside the running-mean range a standard covers, the band is held at its limit values and drawn lighter, so the whole year can be read.</p>
<h3>PV potential</h3>
<p>The PV section turns sunlight into electricity per kilowatt-peak of panels with fixed assumptions, following PVWatts version 5: ${esc(ASSUME.replace("Fixed assumptions, as in PVWatts: ", ""))} It describes the climate as a resource; it does not size a system or estimate cost. The chain was checked hour by hour against pvlib on Berlin, Dubai and Singapore; annual yields agree within 0.4 %, the difference coming from twilight hours with diffuse light, which this app keeps and pvlib drops.</p>
<h3>Reference climates</h3>
<p>The figures in "Climate at a glance" are placed among eleven typical-year files from Climate.OneBuilding.Org: Berlin, London, Moscow, Madrid, Rome, Cairo, Dubai, Mumbai, Singapore, Shanghai and Mexico City. They span equatorial, monsoon, desert, highland, Mediterranean, humid subtropical, oceanic and cold continental climates, and are the files bundled with the app. None is subarctic or in the southern hemisphere.</p>
<h3>Colours</h3>
<p>Ranges are local by default, stretched to the file; the façades and the roof share one range so they can be read against each other. Click any colour bar or chart axis to type a minimum and maximum; "Automatic" returns to the local or global range. Each variable keeps one colour scheme throughout the app, taken from CBE Clima: blue to red to yellow for temperatures, yellow to blue for humidity, dark blue through red to white for solar radiation, blue to orange for illuminance, dark blue to grey for sky cover, white to red for wind speed. Global ranges also follow CBE Clima, so charts of two places can be compared directly. UTCI stress classes use the CBE Clima class colours.</p>
<h3>Water</h3>
<p>Wind-driven rain uses the ISO 15927-3 airfield index. Many typical-year files leave precipitation empty or set it to zero; the app says so rather than showing zero rain.</p>
<h3>Verification</h3>
<p>Every calculation except the Givoni-Milne zones agrees with an independent reference (pvlib, psychrolib, pythermalcomfort, Ladybug Tools, or a separate implementation) on up to six weather files. Largest differences: solar angles 0.05°, wet bulb 0.0005 K, façade irradiance below 0.001 W/m², UTCI below 0.001 K, MRT with sky exchange 0.42 K by day and 0 K at night. Degree days, comfort bands, extremes, sky classes, daylight hours, driving rain and wind roses match exactly. The scripts and results are in the repository, <a href="https://github.com/gvnbetti/clima-toolbox/tree/main/validation/climate-reading" target="_blank" rel="noopener">validation/climate-reading</a>.</p>
<h3>Not yet in this version</h3>
<p>Comparison of two files on shared axes, the one-page climate report, and an independent check of the strategy zones. The data model already holds two files.</p>
<h3>Sources and credit</h3>
<p>Scope and reading habits follow CBE Clima (Betti, Tartarini, Nguyen, Schiavon, 2023, Building Simulation), which this app rebuilds rather than forks. Station catalogue: Climate.OneBuilding.Org (Crawley and Lawrie). Köppen-Geiger classes: Beck et al. (2018), through kgcpy. References for verification: pvlib, pythermalcomfort, psychrolib. Map outlines: Natural Earth.</p>
</div>`;
  }

  /* ---------------- guide drawer ---------------- */
  function guideDrawerHtml() {
    const G = window.CLIMA_GUIDE, secs = SECTIONS.filter((x) => x.cards.length);
    const toc = `<nav class="gtoc"><a href="#g-start">Getting started</a>${secs.map((x) => `<a href="#g-${x.id}">${esc(x.title)}</a>`).join("")}<a href="#g-method">Methods</a><a href="#g-gloss">Glossary</a><a href="#g-units">Units</a></nav>`;
    let h = `<div class="ghead"><h2>Guide</h2><button class="btn small" id="guideClose" aria-label="Close the guide">Close</button></div><div class="gbody">${toc}`;
    h += `<section id="g-start"><h3 class="gch">Getting started</h3>${G.start.map(([t, b]) => `<h4>${esc(t)}</h4>${b}`).join("")}</section>`;
    for (const x of secs) {
      h += `<section id="g-${x.id}"><h3 class="gch">${esc(x.title)}</h3>${G.sections[x.id] ? `<p>${esc(G.sections[x.id])}</p>` : ""}`;
      for (const c of x.cards) h += `<div class="gcard" id="g-${c.id}"><h4>${esc(c.title)}</h4>${c.sub ? `<div class="gsub">${esc(c.sub)}</div>` : ""}${G.read[c.id] ? `<p><span class="glab">Reading it</span> ${esc(G.read[c.id])}</p>` : ""}${c.info ? `<p><span class="glab">Method</span> ${esc(c.info)}</p>` : ""}<button class="link" data-goto="${c.id}">Show the chart</button></div>`;
      h += `</section>`;
    }
    h += `<section id="g-method"><h3 class="gch">Methods</h3>${guideHtml()}</section>`;
    h += `<section id="g-gloss"><h3 class="gch">Glossary</h3><dl>${G.glossary.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join("")}</dl></section>`;
    h += `<section id="g-units"><h3 class="gch">Units</h3><p>Choose International (SI) or imperial (IP) units in the sidebar; wind can also be shown in km/h. Calculations always run in SI and are converted for display; CSV downloads stay in SI. This guide quotes methods in SI, as the standards do.</p><table class="t"><tr><th>Quantity</th><th>SI</th><th>IP</th></tr>${G.units.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</table></section>`;
    return h + `</div>`;
  }
  function openGuide(id) {
    const g = $("guide"); if (!g.dataset.built) { g.innerHTML = guideDrawerHtml(); g.dataset.built = 1; }
    g.classList.add("open"); g.setAttribute("aria-hidden", "false"); $("scrim").hidden = false;
    const tgt = id ? document.getElementById("g-" + id) : null; const body = g.querySelector(".gbody");
    if (tgt) { body.scrollTop = tgt.offsetTop - 8; tgt.classList.add("flash"); setTimeout(() => tgt.classList.remove("flash"), 1400); } else body.scrollTop = 0;
  }
  function closeGuide() { const g = $("guide"); g.classList.remove("open"); g.setAttribute("aria-hidden", "true"); $("scrim").hidden = true; }
  document.addEventListener("click", (ev) => {
    const t = ev.target; if (!t.closest) return;
    if (t.closest("#guideBtn")) { openGuide(); return; }
    if (t.closest("#guideClose") || t.id === "scrim") { closeGuide(); return; }
    const a = t.closest(".gtoc a"); if (a) { ev.preventDefault(); openGuide(a.getAttribute("href").slice(3)); return; }
    const mo = t.closest("[data-more]"); if (mo) { const el = $(mo.dataset.more); el.hidden = !el.hidden; mo.setAttribute("aria-expanded", String(!el.hidden)); return; }
    const go = t.closest("[data-goto]"); if (go) { closeGuide(); const el = document.getElementById(go.dataset.goto); if (el) el.scrollIntoView({ block: "start" }); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("guide").classList.contains("open")) closeGuide(); });

  /* ---------------- render ---------------- */
  function render() {
    K.resetHover();
    ctx.mask = filterMask();
    $("sitetag").textContent = ctx.siteName + (ctx.period ? `, ${ctx.period.replace("the years ", "")}` : "");
    const fl = filterLabel();
    $("toc").innerHTML = GROUPS.map(([t, ids]) => `<a href="#${ids[0]}" title="${esc(ids.map((i) => SECTIONS.find((s) => s.id === i).title).join(", "))}">${esc(t)}</a>`).join("");
    $("filtsum").textContent = fl ? "on" : "whole year";
    let h = "";
    if (st.insp && st.insp.overall) h += `<div class="insp"><h4>Claude Inspection, overall</h4>${esc(st.insp.overall)}</div>`;
    for (const s of SECTIONS) {
      h += `<section class="part" id="${s.id}"><h2>${esc(s.title)}</h2>`;
      if (ctx.fut && s.id !== "explorer") h += `<p class="uhiband futband">Morphed to ${esc(futLab(ctx.fut.level))}: air temperature, humidity and precipitation changed by the CMIP6 projection for ${esc(regName(ctx.fut.region))}. <button class="link" data-goto="future">See the change</button></p>`;
      if (ctx.uhi && s.id !== "explorer") h += `<p class="uhiband">Air temperature and humidity include an estimated urban heat island: ${esc(uhiLabel())}. <button class="link" data-goto="c-uhi">See the estimate</button></p>`;
      if (s.reading) { const ps = S.readings[s.reading](ctx); s._plain = ps.map((p) => p.replace(/<[^>]+>/g, "")); h += `<div class="reading">${ps.map((p) => `<p>${p}</p>`).join("")}</div>`; h += inspBlock(s.id); }
      if (s.cards.length) h += `<p class="note fnote" ${fl ? "" : "hidden"}>${fl ? esc(fl) + ". Charts leave filtered-out hours out of their totals or show them in grey." : ""}</p>`;
      if (s.tiles) h += s.tiles();
      if (s.id === "explorer") h += explorerControls();

      if (s.cards.length) h += `<div class="cards">${s.cards.filter((c) => !c.when || c.when()).map(cardShell).join("")}</div>`;
      h += `</section>`;
    }
    $("main").innerHTML = K.U.text(h);
    observe(); spy.last = -1; spy();
  }
  // six groups for the section bar, in page order; the group in view is filled
  const GROUPS = [["Overview", ["summary", "extremes", "future"]], ["Temperature", ["temperature"]], ["Sun and light", ["sun", "surfaces", "pv", "daylight"]], ["Wind and water", ["wind", "water"]], ["Comfort and strategies", ["outdoor", "psychro"]], ["Data", ["explorer", "quality"]]];
  function spy() {
    const nav = $("toc"); if (!nav || !nav.children.length) return;
    document.documentElement.style.setProperty("--navh", nav.offsetHeight + "px");
    const off = nav.offsetHeight + 40; let cur = 0;
    GROUPS.forEach(([, ids], i) => { const el = document.getElementById(ids[0]); if (el && el.getBoundingClientRect().top <= off) cur = i; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = GROUPS.length - 1;
    [...nav.children].forEach((a, i) => { a.classList.toggle("on", i === cur); if (i === cur) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
    if (cur !== spy.last) { spy.last = cur; const a = nav.children[cur]; if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: "smooth" }); }
  }
  addEventListener("scroll", () => { if (!spy.q) { spy.q = 1; requestAnimationFrame(() => { spy.q = 0; spy(); }); } }, { passive: true });
  let narrowW = innerWidth < 700;
  addEventListener("resize", () => { spy(); const n = innerWidth < 700; if (n !== narrowW) { narrowW = n; clearTimeout(spy.rt); spy.rt = setTimeout(() => rerenderCards(), 200); } });
  function inspBlock(sec) {
    const I = st.insp; if (!I) return "";
    if (I.pending) return sec === "summary" ? `<div class="insp"><h4>Claude Inspection</h4>Claude is reading the readings…</div>` : "";
    const items = (I.items || []).filter((x) => x.section === sec), miss = (I.missing || []).filter((x) => x.section === sec);
    if (!items.length && !miss.length) return "";
    return `<div class="insp"><h4>Claude Inspection</h4>${items.length ? `<ul>${items.map((x) => `<li>“${esc(x.sentence)}”: ${esc(x.issue)}${x.suggestion ? ` <i>${esc(x.suggestion)}</i>` : ""}</li>`).join("")}</ul>` : ""}${miss.length ? `<div style="margin-top:4px">Possibly missing: <ul>${miss.map((x) => `<li>${esc(x.observation)}</li>`).join("")}</ul></div>` : ""}</div>`;
  }
  function cardShell(c) {
    const tools = (c.tools || []).map((t) => `<select data-card="${c.id}" data-k="${t.k}" aria-label="${esc(t.label)}">${t.options.map(([v, l]) => `<option value="${v}" ${v === ui(c.id, t.k, t.def) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`).join("");
    return `<div class="card${c.wide ? " wide" : ""}" id="${c.id}"><div class="ch"><div class="t"><h3>${esc(c.title)}</h3>${c.sub ? `<div class="sub">${esc(c.sub)}</div>` : ""}</div><div class="tools">${tools}<button class="info" data-gl="${c.id}" aria-label="About this chart, in the guide">?</button><button class="btn small" data-exp="svg" data-card="${c.id}">SVG</button><button class="btn small" data-exp="png" data-card="${c.id}">PNG</button><button class="btn small" data-exp="csv" data-card="${c.id}">CSV</button></div></div><div class="body" data-body="${c.id}"></div></div>`;
  }
  const CARD = {}; SECTIONS.forEach((s) => s.cards.forEach((c) => (CARD[c.id] = c)));
  const rendered = {};
  function renderCard(id) {
    const c = CARD[id], body = document.querySelector(`[data-body="${id}"]`); if (!c || !body) return;
    const u = {}; (c.tools || []).forEach((t) => (u[t.k] = ui(id, t.k, t.def)));
    const h0 = body.offsetHeight; if (h0) body.style.minHeight = h0 + "px";
    try { K.curCard = id; const base = c.wide ? 760 : 540, bw = body.clientWidth; K.curW = bw && bw < base ? Math.max(300, Math.round(bw)) : base; const r = c.render(u); rendered[id] = r; body.innerHTML = K.U.text(r.html); } catch (e) { console.error(id, e); body.innerHTML = `<p class="err">This chart could not be drawn: ${esc(e.message)}</p>`; }
    requestAnimationFrame(() => { body.style.minHeight = ""; });
  }
  let io = null;
  function observe() {
    if (io) io.disconnect(); for (const k in rendered) delete rendered[k];
    io = new IntersectionObserver((ents) => { for (const e of ents) if (e.isIntersecting) { const id = e.target.dataset.body; if (!rendered[id]) renderCard(id); io.unobserve(e.target); } }, { rootMargin: "600px 0px" });
    document.querySelectorAll("[data-body]").forEach((b) => io.observe(b));
  }
  function rerenderCards(pred) { document.querySelectorAll("[data-body]").forEach((b) => { const id = b.dataset.body; if (rendered[id] && (!pred || pred(id))) renderCard(id); }); }

  /* ---------------- exports ---------------- */
  let DL = null;
  async function saveFile(name, blob) {
    try { if (DL === null && window.claude && typeof window.claude.use === "function") DL = await window.claude.use("downloads").catch(() => false); } catch (e) { DL = false; }
    if (DL && DL.save) { await DL.save({ filename: name, data: blob }); return; }
    const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  }
  const safe = (t) => t.replace(/[^A-Za-z0-9 ._-]/g, "").replace(/\s+/g, "_").slice(0, 100);
  const srcLine = () => `Macro Clima · ${ctx.siteName} · ${ctx.name}${ctx.fut ? " · morphed to " + futLab(ctx.fut.level) : ""}${ctx.uhi ? " · with estimated urban heat island (" + uhiLabel() + ")" : ""} · ${filterLabel() || "whole year"} · ${new Date().toISOString().slice(0, 10)}`;
  async function doExport(kind, id) {
    const c = CARD[id]; if (!rendered[id]) renderCard(id); const r = rendered[id], base = safe(`${ctx.siteName}_${c.title}`);
    try {
      if (kind === "csv") { if (!r.csv) throw new Error("This card has no data table."); await saveFile(base + ".csv", new Blob(["﻿" + r.csv()], { type: "text/csv" })); return; }
      const svgs = document.querySelectorAll(`[data-body="${id}"] svg`);
      if (!svgs.length) throw new Error("This card is a table; use CSV.");
      const tbls = [...document.querySelectorAll(`[data-body="${id}"] > table.t, [data-body="${id}"] > div > table.t`)].filter((t) => !t.closest("svg"));
      const sv = combineSvgs([...svgs], tbls.map(tableToSvg)), out = K.standalone(sv, K.U.text(c.title), srcLine(), K.U.text(c.sub || ""));
      if (kind === "svg") await saveFile(base + ".svg", new Blob([out.svg], { type: "image/svg+xml" })); else await saveFile(base + ".png", await K.svgToPng(out));
    } catch (e) { toast(e.message || String(e)); }
  }
  // a table drawn as SVG text, for exports
  function tableToSvg(t) {
    const rows = [...t.rows].map((r) => [...r.cells].map((c) => c.textContent.trim())), ncol = Math.max(...rows.map((r) => r.length));
    const colW = Array.from({ length: ncol }, (_, k) => Math.max(...rows.map((r) => (r[k] || "").length)) * 6.6 + 18), W = colW.reduce((a, b) => a + b, 0), rh = 20, H = rows.length * rh + 6;
    const ns = "http://www.w3.org/2000/svg", g = document.createElementNS(ns, "svg"); g.setAttribute("viewBox", `0 0 ${W} ${H}`);
    let s = ""; rows.forEach((r, i) => { let x = 0; const y = 4 + i * rh; s += `<line x1="0" x2="${W}" y1="${y + rh}" y2="${y + rh}" stroke="#e6e9e4"/>`; r.forEach((v, k) => { const right = k > 0; s += `<text x="${right ? x + colW[k] - 8 : x + 4}" y="${y + 14}" text-anchor="${right ? "end" : "start"}" font-family="Helvetica, Arial, sans-serif" font-size="${i ? 12 : 10.5}" font-weight="${i ? 400 : 600}" fill="${i ? "#18201f" : "#5b6663"}">${esc(v)}</text>`; x += colW[k]; }); });
    g.innerHTML = s; g.style.position = "absolute"; g.style.left = "-9999px"; document.body.appendChild(g); setTimeout(() => g.remove(), 2000); return g;
  }
  // several charts in one card: keep the layout they have on screen (stacked, side by side or in a grid); tables go underneath
  function combineSvgs(charts, tables) {
    tables = tables || [];
    charts = charts.filter((x) => !x.parentElement || !x.parentElement.closest("svg"));
    if (charts.length === 1 && !tables.length) return charts[0];
    const ns = "http://www.w3.org/2000/svg", g = document.createElementNS(ns, "svg");
    let R = charts.map((x) => x.getBoundingClientRect());
    if (R.some((r) => r.width < 1)) { let yy = 0; R = charts.map((x) => { const [, , w, h] = (x.getAttribute("viewBox") || "0 0 760 300").split(/\s+/).map(Number), r = { left: 0, top: yy, width: w, height: h }; yy += h + 10; return r; }); } // not on screen: stack
    const L = Math.min(...R.map((r) => r.left)), T = Math.min(...R.map((r) => r.top));
    const vbW = (x) => +((x.getAttribute("viewBox") || "0 0 760 300").split(/\s+/)[2]), spanW = Math.max(...R.map((r) => r.left + r.width)) - L, k = Math.max(760 / Math.max(1, spanW), ...charts.map((x, i) => vbW(x) / Math.max(1, R[i].width))); // keep native detail, and at least the width of one full chart
    let wMax = 0, hMax = 0;
    charts.forEach((x, i) => { const r = R[i], n = x.cloneNode(true), X = (r.left - L) * k, Y = (r.top - T) * k, w = r.width * k, h = r.height * k; n.setAttribute("x", X); n.setAttribute("y", Y); n.setAttribute("width", w); n.setAttribute("height", h); g.appendChild(n); wMax = Math.max(wMax, X + w); hMax = Math.max(hMax, Y + h); });
    let y = hMax + (tables.length ? 14 : 0);
    tables.forEach((t) => { const [, , w, h] = t.getAttribute("viewBox").split(/\s+/).map(Number), n = t.cloneNode(true); n.setAttribute("x", 0); n.setAttribute("y", y); n.setAttribute("width", w); n.setAttribute("height", h); g.appendChild(n); y += h + 12; wMax = Math.max(wMax, w); });
    g.setAttribute("viewBox", `0 0 ${wMax} ${tables.length ? y : hMax}`); g.style.position = "absolute"; g.style.left = "-9999px"; document.body.appendChild(g); setTimeout(() => g.remove(), 2000); return g;
  }
  function toast(m) { const t = $("tip"); t.innerHTML = esc(m); t.style.display = "block"; t.style.left = "50%"; t.style.top = "20px"; setTimeout(() => (t.style.display = "none"), 3500); }
  function allCsv() {
    const W = ctx.W, X = ctx.X, cols = Object.entries(S.V).map(([k, v]) => [`${v.label} (${v.unit})`, v.get(W, X)]);
    cols.push(["solar azimuth (deg)", X.az], ["strategy family", Uint8Array.from({ length: N }, (_, i) => S.familyOf(X.zones, i))]);
    saveFile(safe(ctx.siteName + "_processed_hourly") + ".csv", new Blob(["﻿" + hourlyCsv(cols)], { type: "text/csv" })).catch((e) => toast(e.message));
  }

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

  /* ---------------- events ---------------- */
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    const num = t.closest(".n, .tile[data-card]");
    if (num) { const card = $(num.dataset.card); if (card) { if (num.dataset.set) { const [k, v] = num.dataset.set.split("="); (st.ui[num.dataset.card] = st.ui[num.dataset.card] || {})[k] = v; const sel = card.querySelector(`select[data-k="${k}"]`); if (sel) sel.value = v; renderCard(num.dataset.card); } else if (!rendered[num.dataset.card]) renderCard(num.dataset.card); card.scrollIntoView({ behavior: "smooth", block: "center" }); card.classList.add("flash"); setTimeout(() => card.classList.remove("flash"), 1400); } return; }
    if (t.dataset.gl) { openGuide(t.dataset.gl); return; }
    if (t.dataset.exp) { doExport(t.dataset.exp, t.dataset.card); return; }
    if (t.id === "csvall") { allCsv(); return; }
    if (t.id === "critreset") { st.cc = JSON.parse(JSON.stringify(C.CC_DEFAULT)); recomputeZones(); return; }
  });
  /* range editing: click a colour bar or an axis */
  let rpTarget = null;
  document.addEventListener("click", (ev) => {
    const g = ev.target.closest && ev.target.closest("[data-scale],[data-axis]"); const pop = $("rangepop");
    if (!g) { if (!pop.hidden && !pop.contains(ev.target)) pop.hidden = true; return; }
    if (g.dataset.scale === "" && !g.dataset.axis) return;
    rpTarget = g.dataset.scale != null && g.hasAttribute("data-scale") ? { kind: "scale", key: g.dataset.scale } : { kind: "axis", key: g.dataset.axis };
    $("rpTitle").textContent = rpTarget.kind === "scale" ? "Colour range" : "Axis range"; rpTarget.u = decodeURIComponent(g.dataset.u || ""); $("rpLo").value = +K.U.v(+g.dataset.lo, rpTarget.u).toPrecision(4); $("rpHi").value = +K.U.v(+g.dataset.hi, rpTarget.u).toPrecision(4);
    pop.hidden = false; pop.style.left = Math.min(innerWidth - 240, ev.clientX + 8) + "px"; pop.style.top = Math.min(innerHeight - 110, ev.clientY + 8) + "px"; $("rpLo").focus();
  });
  function applyRange(clear) {
    if (!rpTarget) return; const lo = K.U.inv(parseFloat($("rpLo").value), rpTarget.u), hi = K.U.inv(parseFloat($("rpHi").value), rpTarget.u), store = rpTarget.kind === "scale" ? st.scaleOv : st.axisOv;
    if (clear) delete store[rpTarget.key]; else if (isFinite(lo) && isFinite(hi) && hi > lo) store[rpTarget.key] = { lo, hi }; else return;
    $("rangepop").hidden = true; if (rpTarget.kind === "scale") rerenderCards(); else renderCard(rpTarget.key.split("|")[0]);
  }
  $("rpApply").addEventListener("click", () => applyRange(false)); $("rpReset").addEventListener("click", () => applyRange(true)); $("rpClose").addEventListener("click", () => ($("rangepop").hidden = true));
  $("rangepop").addEventListener("keydown", (e) => { if (e.key === "Enter") applyRange(false); if (e.key === "Escape") $("rangepop").hidden = true; });
  let drag3 = null, raf3 = 0;
  document.addEventListener("pointerdown", (ev) => { const sv = ev.target.closest && ev.target.closest("svg[data-drag3d]"); if (!sv) return; drag3 = { x: ev.clientX, y: ev.clientY, yaw: K.view3d.yaw, pitch: K.view3d.pitch }; ev.preventDefault(); });
  document.addEventListener("pointermove", (ev) => { if (!drag3) return; K.view3d.yaw = drag3.yaw + (ev.clientX - drag3.x) * 0.5; K.view3d.pitch = Math.max(5, Math.min(89, drag3.pitch + (ev.clientY - drag3.y) * 0.4)); if (!raf3) raf3 = requestAnimationFrame(() => { raf3 = 0; renderCard("c-sunpath"); }); });
  document.addEventListener("pointerup", () => { drag3 = null; });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && ev.target.classList && ev.target.classList.contains("n")) ev.target.click(); });
  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.tagName === "SELECT" && t.dataset.card) { if (t.dataset.k === "adm") { st.adm = t.value; st.admTouched = true; refreshSummaries(); return; } (st.ui[t.dataset.card] = st.ui[t.dataset.card] || {})[t.dataset.k] = t.value; renderCard(t.dataset.card); return; }
    if (t.dataset.zone) { if (t.checked) st.ccSel.add(t.dataset.zone); else st.ccSel.delete(t.dataset.zone); rerenderCards((id) => ["c-zones", "c-psy", "c-zcarpet"].includes(id)); return; }
    if (t.dataset.crit) { const [a, b] = t.dataset.crit.split("."); const v = parseFloat(t.value); if (isFinite(v)) { st.cc[a][b] = K.U.inv(v, decodeURIComponent(t.dataset.u || "")); recomputeZones(); } return; }
    if (t.dataset.nv) { const v = parseFloat(t.value); if (isFinite(v)) { st.nv[t.dataset.nv] = K.U.inv(v, "°C"); refreshSummaries(); } return; }
    if (t.id === "exfv" || t.id === "exmin" || t.id === "exmax") { st.ex.fv = $("exfv").value; { const un = S.V[st.ex.fv].unit, sv = (x) => (x === "" ? "" : String(K.U.inv(+x, un))); st.ex.fmin = sv($("exmin").value); st.ex.fmax = sv($("exmax").value); } const m = exMask(); let c = 0; for (let i = 0; i < N; i++) if (!m || m[i]) c++; $("excount").textContent = `${fmt(c)} hours meet the conditions (${fmt(100 * c / N, 1)} % of the year)${ctx.mask ? ", inside the filter at the left" : ""}.`; rerenderCards((id) => id.startsWith("c-ex")); }
  });
  function recomputeZones() { ctx.X.zones = C.strategyZones(ctx.W, ctx.X, { params: st.cc }); refreshSummaries(); }
  // update readings, notes and drawn charts in place; the page is not rebuilt, so nothing moves
  function refreshSummaries() {
    ctx.R = S.summarise(ctx.W, ctx.X, Object.assign({}, st, { siteTitle: ctx.site ? ctx.site.title : "" })); ctx.mask = filterMask();
    const fl = filterLabel(); $("filtsum").textContent = fl ? "on" : "whole year";
    for (const sec of SECTIONS) {
      const el = document.getElementById(sec.id); if (!el) continue;
      if (sec.reading) { const ps = S.readings[sec.reading](ctx); sec._plain = ps.map((p) => p.replace(/<[^>]+>/g, "")); const r = el.querySelector(".reading"); if (r) r.innerHTML = K.U.text(ps.map((p) => `<p>${p}</p>`).join("")); }
      const fn = el.querySelector(".fnote"); if (fn) { fn.hidden = !fl; fn.textContent = fl ? `${fl}. Charts leave filtered-out hours out of their totals or show them in grey.` : ""; }
      const ex = el.querySelector("#excount"); if (ex) { const m = exMask(); let c = 0; for (let i = 0; i < N; i++) if (!m || m[i]) c++; ex.textContent = `${fmt(c)} hours meet the conditions (${fmt(100 * c / N, 1)} % of the year)${ctx.mask ? ", inside the filter at the left" : ""}.`; }
    }
    const tsel = document.querySelector('#c-daily select[data-k="adm"]'); if (tsel) tsel.value = st.adm;
    K.resetHover(); rerenderCards();
  }

  function initControls() {
    fillWx();
    $("bundled").addEventListener("change", (e) => { const v = e.target.value; if (v[0] === "u") { const u = UPL[+v.slice(1)]; loadText(u.text, u.name); } else loadBundled(+v); });
    const mo = C.MONTHS.map((m, k) => `<option value="${k + 1}">${m}</option>`).join(""), ho = Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, "0")}:00</option>`).join("");
    $("m1").innerHTML = mo; $("m2").innerHTML = mo; $("h1").innerHTML = ho; $("h2").innerHTML = Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h + 1).padStart(2, "0")}:00</option>`).join("");
    $("m1").value = 1; $("m2").value = 12; $("h1").value = 0; $("h2").value = 23;
    for (const k of ["m1", "m2", "h1", "h2"]) $(k).addEventListener("change", () => { st.filter[k] = +$(k).value; if (ctx) refreshSummaries(); });
    $("resetfilter").addEventListener("click", () => { st.filter = { m1: 1, m2: 12, h1: 0, h2: 23 }; $("m1").value = 1; $("m2").value = 12; $("h1").value = 0; $("h2").value = 23; if (ctx) refreshSummaries(); });
    $("rangeSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; st.range = b.dataset.v; [...$("rangeSeg").children].forEach((x) => x.setAttribute("aria-pressed", x === b)); if (ctx) rerenderCards(); });
    $("themeSeg") && $("themeSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; const v = b.dataset.v; if (v === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v; [...$("themeSeg").children].forEach((x) => x.setAttribute("aria-pressed", x === b)); if (ctx) rerenderCards(); });
    for (const k of ["hdd", "cdd"]) $(k).addEventListener("change", () => { const v = parseFloat($(k).value); if (isFinite(v)) { st[k] = K.U.inv(v, "°C"); if (ctx) refreshSummaries(); } });
    // units: SI or imperial; wind optionally in km/h. Calculations stay in SI; the page is redrawn in place.
    const unitSync = () => { for (const b of document.querySelectorAll("#unitSeg button")) b.setAttribute("aria-pressed", b.dataset.v === K.U.sys); $("windkmh").disabled = K.U.sys === "ip"; $("windkmh").checked = K.U.wind === "kmh"; $("windlab").style.opacity = K.U.sys === "ip" ? 0.5 : 1; for (const k of ["hdd", "cdd"]) { $(k).value = +K.U.v(st[k], "°C").toFixed(1); $(k + "u").textContent = K.U.lab("°C"); $(k).step = K.U.sys === "ip" ? 1 : 0.5; } };
    const unitApply = () => { try { localStorage.setItem("newclima.units", JSON.stringify({ sys: K.U.sys, wind: K.U.wind })); } catch (e) {} unitSync(); if (!ctx) return; const anchor = [...document.querySelectorAll(".card")].find((c) => c.getBoundingClientRect().bottom > 80), off = anchor ? anchor.getBoundingClientRect().top : 0; render(); if (anchor && document.getElementById(anchor.id)) { const n = document.getElementById(anchor.id); window.scrollBy(0, n.getBoundingClientRect().top - off); } };
    try { const u = JSON.parse(localStorage.getItem("newclima.units") || "null"); if (u) { K.U.sys = u.sys === "ip" ? "ip" : "si"; K.U.wind = u.wind === "kmh" ? "kmh" : "ms"; } } catch (e) {}
    unitSync();
    for (const b of document.querySelectorAll("#unitSeg button")) b.addEventListener("click", () => { K.U.sys = b.dataset.v; unitApply(); });
    for (const b of document.querySelectorAll("#futSeg button")) b.addEventListener("click", () => { st.fut = +b.dataset.v; futSync(); reprocess(); });
    for (const b of document.querySelectorAll("#uhiSeg button")) b.addEventListener("click", () => { if (b.dataset.v === "off") st.uhi.on = false; else { st.uhi.on = true; Object.assign(st.uhi, UHI_PRESETS[b.dataset.v]); } uhiSync(); reprocess(); });
    for (const k of ["svf", "fveg"]) { $(k).addEventListener("input", () => { st.uhi[k] = +$(k).value; $(k + "o").textContent = (+$(k).value).toFixed(2); }); $(k).addEventListener("change", () => { st.uhi[k] = +$(k).value; uhiSync(); reprocess(); }); }
    uhiSync();
    $("windkmh").addEventListener("change", () => { K.U.wind = $("windkmh").checked ? "kmh" : "ms"; unitApply(); });
    $("gtz").addEventListener("change", () => { st.gtz = $("gtz").checked; st.gtzTouched = true; if (ctx) refreshSummaries(); });
    const drop = $("drop"), file = $("file");
    file.addEventListener("change", () => { if (file.files[0]) loadFile(file.files[0]); file.value = ""; });
    ["dragover", "dragenter"].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) loadFile(f); });
    document.addEventListener("dragover", (e) => e.preventDefault()); document.addEventListener("drop", (e) => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f && !drop.contains(e.target)) loadFile(f); });
    $("inspect").addEventListener("click", inspect);
  }

  /* ---------------- Claude Inspection ---------------- */
  let SAMPLE;
  async function inspect() {
    if (!ctx) return;
    if (SAMPLE === undefined) { try { SAMPLE = window.claude && window.claude.use ? await window.claude.use("sample") : null; } catch (e) { SAMPLE = null; } }
    if (!SAMPLE) { $("insphint").textContent = "Claude Inspection is not available in this view."; return; }
    st.insp = { pending: true }; render();
    const secs = SECTIONS.filter((s) => s.reading).map((s) => ({ section: s.id, title: s.title, reading: s._plain }));
    const R = ctx.R, facts = { place: ctx.siteName, lat: ctx.W.meta.lat, lon: ctx.W.meta.lon, elevation_m: ctx.W.meta.elev, koppen: ctx.koppen, dbt_p01: R.p01, dbt_p99: R.p99, dbt_mean: R.mean, monthly_mean_dbt: R.mMean, monthly_mean_daily_max: R.mMax, monthly_mean_daily_min: R.mMin, ghi_kwh_m2: R.ghi, diffuse_share_pct: R.diffShare, monthly_ghi_kwh_m2_day: R.mGhiDay, hdd: R.hdd.annual, cdd: R.cdd.annual, rh_winter: R.rhWinter, rh_summer: R.rhSummer, extremes: { summer: R.ex.summerDays, hot: R.ex.hotDays, tropical_nights: R.ex.tropicalNights, frost: R.ex.frostDays, ice: R.ex.iceDays }, wind_mean: R.rose.mean, calm_pct: 100 * R.rose.calm / R.rose.total, facade_annual_kwh_m2: Object.fromEntries(Object.entries(ctx.X.surf).map(([k, v]) => [k, Math.round(v.annual)])), zone_hours: R.zoneHours, utci_sun_wind_classes_hours: R.utci.sunWind.cls, precip_total_mm: R.precOK ? R.precTot : null };
    const prompt = `You are reviewing the automatically generated written readings of a climate description app for architects (DCA project teams and students). The readings are produced by fixed rules from an EPW weather file. The app describes one climate; it is not a comparison tool. Your task is critique only: you do not rewrite the readings, you do not give design advice, and you do not tell the reader which method or source to trust. Keep each point to one short sentence.

For each section, point out sentences that are unclear, ambiguous, misleading in emphasis, or inconsistent with the numbers given. Then name notable patterns visible in the numbers that the readings do not mention. Be specific and brief. Use plain English, no jargon, no em dashes. Only raise real issues; it is fine to return few or no items.

Return JSON only, in this form:
{"overall": "one or two sentences on the readings as a whole",
 "items": [{"section": "<section id>", "sentence": "<short quote from the reading>", "issue": "<what is wrong>", "suggestion": "<how the rule could phrase it, optional>"}],
 "missing": [{"section": "<section id>", "observation": "<pattern in the numbers the readings miss>"}]}

Readings:
${JSON.stringify(secs, null, 1)}

Numbers behind them:
${JSON.stringify(facts, (k, v) => (typeof v === "number" ? +v.toFixed(2) : v))}`;
    try {
      let out;
      if (SAMPLE.json) out = await SAMPLE.json(prompt, { modelTier: "default" });
      else { const r = await SAMPLE(prompt, { modelTier: "default" }); const t = r.text, a = t.indexOf("{"), b = t.lastIndexOf("}"); out = JSON.parse(t.slice(a, b + 1)); }
      st.insp = out || { overall: "No answer." };
    } catch (e) { st.insp = { overall: e && e.code === "not_granted" ? "Claude Inspection was not allowed for this page." : e && e.code === "rate_limited" ? "Claude is busy; please try again in a minute." : "Claude Inspection failed: " + ((e && e.message) || e) }; }
    const t = window.scrollY; render(); requestAnimationFrame(() => window.scrollTo(0, t));
  }

  K.axisOv = st.axisOv;
  initControls();
  catalogueReady();
  loadBundled(0).then(() => fillWx("0"));
  window.__clima = { st, get ctx() { return ctx; }, loadText };
})();
