/* Clima Morph: writes a morphed EPW file.
   The hourly values come from the shared calculation core (shared/climamods.js, prepWeather), exactly as Macro, Micro
   and Room Clima use them; this file only reads the source rows and writes the changed fields back into them.
   The file is read with Macro Clima's parseEPW (macro/core.js), so it is read as in Macro Clima.

   What is written (EPW field numbers, 1-based):
     7 dry-bulb temperature   future climate and heat island                0.1 °C
     8 dew point              future climate only (relative humidity held)  0.1 °C
     9 relative humidity      heat island only (dew point held)             1 %
    13 horizontal infrared    future climate only                           1 W/m²
    34 precipitation depth    future climate only                           as the source, at least 0.1 mm
   Every other field is copied unchanged. A value missing in the source stays missing.
   29 February (leap-year files) is not in the 365-day data the core works on: those rows take the hourly changes of
   28 February.
   Header: DESIGN CONDITIONS becomes "DESIGN CONDITIONS,0" (the line stays, so the file keeps its eight header lines);
   GROUND TEMPERATURES are shifted by the annual mean future warming; COMMENTS 2 carries the provenance, without commas.
   Usage: ClimaMorph.morph(text, fileName, { level, uhi: null | { svf, fveg, key }, version }, { Clima, Mods, future, regions }) */
(function (root) {
  "use strict";
  const MISS = { dbt: 99.9, dpt: 99.9, rh: 999, hir: 9999, prec: 999 };
  const COL = { dbt: 6, dpt: 7, rh: 8, hir: 12, prec: 33 }; // 0-based indices of the fields above
  const DATA_ROW = /^\s*-?\d{4},\s*\d{1,2},\s*\d{1,2},/;

  const num = (s) => { const v = parseFloat(s); return isFinite(v) ? v : NaN; };
  const isMissing = (k, s) => { const v = num(s); return !isFinite(v) || v >= MISS[k]; };
  const decimals = (s) => { const m = String(s).trim().match(/\.(\d+)$/); return m ? m[1].length : 0; };
  const fix = (v, d) => { const s = (Math.round(v * 10 ** d) / 10 ** d).toFixed(d); return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s; };
  const mean = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; };
  const levelLabel = (L) => (L ? "+" + String(L) + "C" : "");

  function provenance(o) {
    // one line, no commas: some EPW readers split COMMENTS lines at commas
    const p = [`Morphed by Clima Morph (Clima Toolbox ${o.version} - gvnbetti.github.io/clima-toolbox/morph).`];
    if (o.fut) p.push(`Future climate: ${o.level} C global warming since 1850-1900; IPCC AR6 region ${o.region}; change measured from the file years ${o.years}; mean change ${o.dAnn} K (monthly ${o.dMin} to ${o.dMax} K); dew point from held relative humidity; sky infrared scaled with air temperature; precipitation scaled by the regional monthly change.`);
    if (o.uhi) p.push(`Urban heat island after Theeuwes et al. (2017): sky view factor ${o.svf}; vegetation fraction ${o.fveg}; mean ${o.uhiMean} K and up to ${o.uhiMax} K; dew point held and relative humidity recomputed.`);
    const changed = ["dry bulb temperature"];
    if (o.fut) changed.push("dew point", "horizontal infrared", "precipitation", `ground temperatures (+${o.dAnn} K)`);
    if (o.uhi) changed.push("relative humidity");
    p.push(`Changed: ${changed.join("; ")}.`);
    p.push(`Unchanged: solar radiation; wind; pressure; cloud; typical and extreme periods (chosen on the present climate)${o.uhi && !o.fut ? "; dew point; horizontal infrared" : ""}${o.fut && !o.uhi ? "; relative humidity" : ""}. Design conditions removed.`);
    return p.join(" ").replace(/,/g, ";");
  }

  function morph(text, fileName, opt, deps) {
    const { Clima, Mods, future, regions } = deps;
    const eol = /\r\n/.test(text) ? "\r\n" : "\n";
    const lines = text.replace(/\r/g, "").split("\n");
    let h0 = 0; while (h0 < lines.length && h0 < 12 && !DATA_ROW.test(lines[h0])) h0++;
    const head = lines.slice(0, h0), body = lines.slice(h0);
    const key = (L) => L.split(",")[0].trim().toUpperCase();
    const dp = head.find((L) => key(L) === "DATA PERIODS");
    if (dp && (parseInt(dp.split(",")[2], 10) || 1) !== 1) throw new Error("This file has more than one record per hour. Clima Morph works on hourly files only.");

    const W0 = Clima.parseEPW(text, fileName);
    const yrs = Mods.fileYears(fileName, W0.meta.comments);
    const uhiOpt = opt.uhi ? { svf: opt.uhi.svf, fveg: opt.uhi.fveg } : null;
    const P = Mods.prepWeather(W0, { level: opt.level || 0, uhi: uhiOpt, year: yrs.year, future, regions });
    const W = P.W, fut = P.fut, uhi = P.uhi;
    const region = Mods.futRegion(W0, regions);
    const out = { fut, uhi, region, years: yrs, W0, W, notes: [], changed: !!(fut || uhi) };
    if (opt.level && !fut) out.notes.push(region ? "The IPCC Atlas has no change for this region, so the future climate is not applied." : "This location lies outside the IPCC land regions, so the future climate is not applied.");
    if (!out.changed) { out.text = text; out.fileName = fileName; return out; }

    // ------------------------------------------------------------ data rows
    let k = 0, kept = 0, leapRows = 0;
    const feb28 = (hr) => (31 + 27) * 24 + hr; // 0-based hour of 28 February at hour-of-day hr
    const rows = body.map((L) => {
      if (!L.trim()) return L;
      const f = L.split(",");
      const leap = +f[1] === 2 && +f[2] === 29;
      const h = leap ? feb28(Math.max(0, Math.min(23, (+f[3] || 1) - 1))) : k++;
      if (leap) leapRows++;
      const val = {};
      for (const v of ["dbt", "dpt", "rh", "hir", "prec"]) {
        if (leap) {
          const o = num(f[COL[v]]);
          val[v] = v === "prec" ? (W0.prec[h] > 0 ? o * W.prec[h] / W0.prec[h] : o * (fut ? 1 + fut.dP[1] / 100 : 1)) : o + (W[v][h] - W0[v][h]);
        } else val[v] = W[v][h];
      }
      const set = (v, s) => { if (isMissing(v, f[COL[v]])) { kept++; return; } f[COL[v]] = s; };
      set("dbt", fix(val.dbt, 1));
      if (fut) { set("dpt", fix(val.dpt, 1)); set("hir", fix(val.hir, 0)); if (num(f[COL.prec]) > 0) set("prec", fix(val.prec, Math.max(1, decimals(f[COL.prec])))); }
      if (uhi) set("rh", fix(Math.max(0, Math.min(100, val.rh)), 0));
      // dew point never above dry bulb after rounding
      if (!isMissing("dbt", f[COL.dbt]) && !isMissing("dpt", f[COL.dpt]) && num(f[COL.dpt]) > num(f[COL.dbt])) f[COL.dpt] = f[COL.dbt];
      return f.join(",");
    });
    out.leapRows = leapRows; out.keptMissing = kept;

    // ------------------------------------------------------------ header
    const dAnn = fut ? mean(fut.dh) : 0;
    const o = {
      version: opt.version || "", fut: !!fut, uhi: !!uhi, level: opt.level, region: region ? `${region.id} (${Mods.regName(region)})` : "",
      years: yrs.known ? `${yrs.from}-${yrs.to}` : "not stated (taken to centre on 2010)",
      dAnn: fix(dAnn, 2), dMin: fut ? fix(Math.min(...fut.dT), 1) : "", dMax: fut ? fix(Math.max(...fut.dT), 1) : "",
      svf: uhiOpt ? uhiOpt.svf.toFixed(2) : "", fveg: uhiOpt ? uhiOpt.fveg.toFixed(2) : "",
      uhiMean: uhi ? fix(uhi.mean, 2) : "", uhiMax: uhi ? fix(uhi.max, 1) : "",
    };
    const prov = provenance(o);
    let hasC2 = false, groundNote = "";
    const H = head.map((L) => {
      const K = key(L);
      if (K === "DESIGN CONDITIONS") return "DESIGN CONDITIONS,0";
      if (K === "GROUND TEMPERATURES" && fut) {
        const f = L.split(","), n = parseInt(f[1], 10);
        if (!(n > 0) || f.length < 2 + n * 16) { groundNote = "The ground temperatures could not be read and are left unchanged."; return L; }
        for (let b = 0; b < n; b++) for (let m = 0; m < 12; m++) { const i = 2 + b * 16 + 4 + m, v = num(f[i]); if (f[i].trim() !== "" && isFinite(v)) f[i] = fix(v + dAnn, 2); }
        return f.join(",");
      }
      if (K === "COMMENTS 2") { hasC2 = true; const t = L.slice(L.indexOf(",") + 1).trim(); return "COMMENTS 2," + prov + (t ? " Original comments 2: " + t : ""); }
      return L;
    });
    if (!hasC2) { const i = H.findIndex((L) => key(L) === "DATA PERIODS"); H.splice(i < 0 ? H.length : i, 0, "COMMENTS 2," + prov); }
    if (groundNote) out.notes.push(groundNote);
    out.dAnn = dAnn; out.provenance = prov;

    // ------------------------------------------------------------ file
    const base = fileName.replace(/\.(epw|txt)$/i, "").replace(/\.epw$/i, "");
    const parts = [];
    if (fut) parts.push(levelLabel(opt.level));
    if (uhi) parts.push(opt.uhi.key && opt.uhi.key !== "custom" ? opt.uhi.key : `svf${o.svf}-veg${o.fveg}`);
    out.fileName = `${base}_${parts.join("_")}.epw`;
    out.text = H.concat(rows).join(eol);
    return out;
  }

  // Windows-1252, as the files are read: keeps accented station names byte for byte
  const CP = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";
  function encode1252(s) {
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x80 || (c >= 0xa0 && c < 0x100)) b[i] = c;
      else { const j = CP.indexOf(s[i]); b[i] = j >= 0 ? 0x80 + j : 0x3f; }
    }
    return b;
  }

  const api = { morph, encode1252, provenance, MISS, COL };
  root.ClimaMorph = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
