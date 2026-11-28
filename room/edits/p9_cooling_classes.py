"""0.13.0 (28 November 2026): cooling by capacity class. Decisions of 28 November 2026 (Giovanni):
- Classes by the design cooling load (the peak exceeded in 1% of occupied cooling hours), named by capacity:
  no cooling, up to 30, up to 50, up to 100, above 100 W/m² of floor; the actual peak is shown with the class.
- Windows or radiant cooling, not both: in the cooled run a window opens only when the room dew point with that air
  and the moisture gains stays below the chilled-ceiling water temperature minus 1 K (15 °C); while it is open there is no
  cooling; when the room needs cooling the windows stay shut. One cooled run with this rule (no extra run time).
- Moisture removal per class at its own dew-point limit: 17 °C (cooled slab, water 18 °C), 15 °C (chilled ceiling, 16 °C),
  12 g/kg otherwise. Seasonal efficiency per class 6 / 5 / 4 / 3 in place of one cooling COP.
- Embodied carbon per class from typical quantities (register carbon.cool), added when the room needs cooling.
- Suggest optimum: a cooling limit can be fixed like a switch. Strategies to test: the left-out options by name.
Run from the repository root."""
import pathlib, sys
R = pathlib.Path(__file__).resolve().parent.parent / 'src'
F = {k: R / k for k in ['register.js', 'core.js', 'page.html', 'shell.html']}
T = {k: v.read_text(encoding='utf-8') for k, v in F.items()}

def rep(f, old, new, n=1, label=''):
    c = T[f].count(old)
    if c != n: sys.exit(f'{label}: found {c} in {f}, expected {n}')
    T[f] = T[f].replace(old, new)

# ---------------------------------------------------------------- register
a = T['register.js'].index('    "ceil.max": {')
T['register.js'] = T['register.js'][:a] + '''    "cool.class": { v: { lims: [30, 50, 100], cop: [6, 5, 4, 3], water: [18, 16], dewMargin: 1 }, unit: "W/m² of floor; seasonal COP; °C", status: "assumption", src: "Decision of 28 November 2026. Warmer chilled water (16 to 20 °C) raises chiller efficiency and allows free cooling (IPCC, 2007, 6.4.5.2); chiller COP 9 to 10 at high temperature against 5 to 6 at 7 °C (Jiang, IEA). System values lower for pumps, fans and heat rejection", text: "Cooling classes by the design cooling load: up to 30 W/m² (cooled slab, water about 18 °C), up to 50 (chilled ceiling, 16 °C), up to 100 (chilled beams, fan coils), above 100 (air conditioning). Seasonal COP per class for cooling and moisture removal. Radiant classes: room dew point at most the water temperature minus 1 K" },
    "carbon.cool": { v: [14, 21, 87, 170], unit: "kg CO₂e per m² of floor over 50 years", status: "assumption", src: "Quantity estimates, 28 November 2026, method of CIBSE TM65 (refrigerant leakage) with generic factors; to be replaced by TM65.4 system values. Plant at 100 kg CO₂e per kW of cooling, 20-year life (3 sets in 50 years)", text: "Cooling equipment per class, counted when the room needs cooling. Up to 30: PE-X pipes in the slab 5.3 m/m² (1.5), manifolds and distribution (3), plant 0.03 kW/m² (9). Up to 50: capillary mats (1.2), connections and distribution (5), plant 0.05 kW/m² (15). Up to 100: fan coils or chilled beams, 175 kg per 10 m², 20-year life (52), pipes and insulation (5), plant (30). Above 100: split or VRF units 0.15 kW/m² at 200 kg/kW, 3 sets (90), refrigerant R32 0.3 kg/kW, GWP 675, 5% leakage a year (77), pipes (3)" },
''' + T['register.js'][a:]

# ---------------------------------------------------------------- engine: windows or cooling, moisture per class, energy per class
rep('core.js', '    let qHsum = 0, qCsum = 0, qLsum = 0, humid = 0,', '    let qL30 = 0, qL50 = 0;\n    let qHsum = 0, qCsum = 0, qLsum = 0, humid = 0,', label='qL vars')
rep('core.js', '''        const dryOut = !coolHi || wx.w[i] <= W_DEHUM, coolOk = !coolHi || !occ[i] || te <= coolHi[i] - 2;
        if (pres[i]) { if (c.dayAch > 0 && tAir > VR.dayT && te <= tAir - VR.dayM && te >= VR.dayOut && dryOut && coolOk) { want = Math.max(base, ventFlow(ops, c.dayAch, tAir - te) / V); isDay = true; } }
        else if (c.nightAch > 0 && lastMax > arm && tAir > u.tHeat && te <= tAir - VR.nightM && dryOut) want = Math.max(base, c.nightAch === 5 ? 5 : ventFlow(ops, 1, tAir - te) / V);''',
'''        /* 0.13.0: in the cooled run a window opens only when the room dew point, with the air it lets in and the moisture
           gains, stays below the chilled-ceiling water temperature minus 1 K (register cool.class) */
        const coolOk = !coolHi || !occ[i] || te <= coolHi[i] - 2, wRad = coolHi ? wSat(DP_WIN, wx.p[i]) : 0, G0w = u.moist * Af / 1000;
        const dryAt = (a) => !coolHi || wx.w[i] + G0w / Math.max(1e-6, rho[i] * V * a) <= wRad;
        if (pres[i]) { if (c.dayAch > 0 && tAir > VR.dayT && te <= tAir - VR.dayM && te >= VR.dayOut && coolOk) { const a = ventFlow(ops, c.dayAch, tAir - te) / V; if (dryAt(a)) { want = Math.max(base, a); isDay = true; } } }
        else if (c.nightAch > 0 && lastMax > arm && tAir > u.tHeat && te <= tAir - VR.nightM) { const a = c.nightAch === 5 ? 5 : ventFlow(ops, 1, tAir - te) / V; if (dryAt(a)) want = Math.max(base, a); }''', label='window rule')
rep('core.js', '      if (rec && ach > base + 1e-6) { if (isDay) dayOpen++; else nightOpen++; vHours++; }',
    '      // 0.13.0: windows or cooling, not both: when the room still needs cooling with the window open, the window is shut\n'
    '      if (coolHi && occ[i] && ach > base + 1e-6 && r.thOp > coolHi[i]) { setAir(base); ach = base; r = eng.trial(i, p); isDay = false; }\n'
    '      if (rec && ach > base + 1e-6) { if (isDay) dayOpen++; else nightOpen++; vHours++; }', label='windows or cooling')
rep('core.js', '            if (L > 0) { qLsum += L * 2.45e6 / 3600; if (L * 2.45e6 / 3600 > 0.5 * Af) latH++; } } } // latH: hours with moisture removal above 0.5 W/m² floor',
    '            if (L > 0) { qLsum += L * 2.45e6 / 3600; if (L * 2.45e6 / 3600 > 0.5 * Af) latH++; }\n'
    '            // 0.13.0: moisture removal at the dew-point limits of the radiant classes (cooled slab, chilled ceiling)\n'
    '            const L30 = m * (wSup - Math.min(w, wSat(DP30, wx.p[i]))) + G0, L50 = m * (wSup - Math.min(w, wSat(DP50, wx.p[i]))) + G0;\n'
    '            if (L30 > 0) qL30 += L30 * 2.45e6 / 3600; if (L50 > 0) qL50 += L50 * 2.45e6 / 3600; } } // latH: hours with moisture removal above 0.5 W/m² floor', label='latent classes')
rep('core.js', 'coolLat: qLsum / 1000 / Af, cHist,', 'coolLat: qLsum / 1000 / Af, coolLat30: qL30 / 1000 / Af, coolLat50: qL50 / 1000 / Af, cHist,', label='return lat')
rep('core.js', 'o.ql = Math.round(x.coolLat * 10) / 10; o.qc = Math.round((x.cool + x.coolLat) * 10) / 10;',
    'o.ql = Math.round(x.coolLat * 10) / 10; o.qc = Math.round((x.cool + x.coolLat) * 10) / 10; if (x.coolLat30 != null) { o.ql30 = Math.round(x.coolLat30 * 10) / 10; o.ql50 = Math.round(x.coolLat50 * 10) / 10; }', label='summary lat')
rep('core.js', '  function humidityRatio(td, p) {', '''  // 0.13.0: cooling classes (register cool.class): humidity ratio at a dew point, the dew-point limits, class and energy
  const CCL = RV("cool.class"), DP30 = CCL.water[0] - CCL.dewMargin, DP50 = CCL.water[1] - CCL.dewMargin, DP_WIN = DP50;
  const wSat = (td, p) => { const pv = 611.2 * Math.exp(17.62 * td / (243.12 + td)); return 0.622 * pv / Math.max(pv + 1000, p - pv); };
  const coolClassK = (pk) => pk == null ? -1 : pk <= CCL.lims[0] ? 0 : pk <= CCL.lims[1] ? 1 : pk <= CCL.lims[2] ? 2 : 3;
  function coolParts(c) { // delivered electricity for cooling and moisture removal at the class's efficiency and dew-point limit
    if (!c) return { k: -1, cop: CCL.cop[3], qs: 0, ql: 0, es: 0, el: 0, e: 0 };
    const k = coolClassK(c.cPeak), cop = k < 0 ? CCL.cop[3] : CCL.cop[k], qs = c.qcs != null ? c.qcs : Math.max(0, (c.qc || 0) - (c.ql || 0));
    const ql = k === 0 && c.ql30 != null ? c.ql30 : k === 1 && c.ql50 != null ? c.ql50 : (c.ql || 0);
    return { k, cop, qs, ql, es: qs / cop, el: ql / cop, e: (qs + ql) / cop };
  }
  function humidityRatio(td, p) {''', label='helpers')
rep('core.js', 'const api = { CBIN, CBINS, USE,', 'const api = { coolParts, coolClassK, DP30, DP50, CBIN, CBINS, USE,', label='api')
rep('core.js', 'row.cool.qh / o.copH + row.cool.qc / o.copC + (row.cool.fanE || 0)', 'row.cool.qh / o.copH + S.coolParts(row.cool).e + (row.cool.fanE || 0)', label='search energy')

# ---------------------------------------------------------------- page
P = 'page.html'
rep(P, 'r.cool.qh / st.copH + r.cool.qc / st.copC + (r.cool.fanE || 0)', 'r.cool.qh / st.copH + S.coolParts(r.cool).e + (r.cool.fanE || 0)', label='energyOf')
rep(P, 'cooling_sensible: r1((c.qcs != null ? c.qcs : c.qc) / st.copC), cooling_moisture_removal: r1((c.ql || 0) / st.copC)', 'cooling_sensible: r1(S.coolParts(c).es), cooling_moisture_removal: r1(S.coolParts(c).el)', label='eSplit')
rep(P, 'cooling ${fmt((c.qcs != null ? c.qcs : c.qc) / st.copC)}, removing moisture ${fmt((c.ql || 0) / st.copC)}', 'cooling ${fmt(S.coolParts(c).es)}, removing moisture ${fmt(S.coolParts(c).el)} (COP ${S.coolParts(c).cop} for its cooling class)', label='deliv text')
rep(P, 'r1((r.r.cool.qcs != null ? r.r.cool.qcs : r.r.cool.qc) / st.copC), r1((r.r.cool.ql || 0) / st.copC)', 'r1(S.coolParts(r.r.cool).es), r1(S.coolParts(r.r.cool).el)', label='csv')
rep(P, '(COP ${st.copH} / ${st.copC})', '(COP ${st.copH} / ${S.coolParts(r.cool).cop})', label='detail cop')
rep(P, '$("coph").value = st.copH; $("copc").value = st.copC;', '$("coph").value = st.copH;', label='fillLimit')
rep(P, '    $("copc").onchange = () => { const v = +$("copc").value; if (v > 0) { st.copC = v; reread(); } };\n', '', label='copc bind')
# carbon: cooling equipment per class when the room needs cooling
rep(P, '''    const k = "K" + FS.keyOf(row.dz) + "|" + row.sc + "|" + Math.round(row.m.E * 100) + "|" + gridNow(); if (st.cache[k]) return st.cache[k];
    const em = S.carbonOf(st.dims, row.sc === "cellular" ? "cellular" : "corner", row.dz), op = row.m.E * gridNow() * Register.val("carbon.years");
    return (st.cache[k] = { emb: em.total, per: em.per, op, tot: em.total + op });''',
'''    const cc = row.r && row.a != null ? coolCls(row) : 0, k = "K" + FS.keyOf(row.dz) + "|" + row.sc + "|" + Math.round(row.m.E * 100) + "|" + gridNow() + "|" + cc; if (st.cache[k]) return st.cache[k];
    const em = S.carbonOf(st.dims, row.sc === "cellular" ? "cellular" : "corner", row.dz), op = row.m.E * gridNow() * Register.val("carbon.years");
    const ce = cc ? Register.val("carbon.cool")[cc - 1] : 0, per = Object.assign({}, em.per, { cooling: ce }); // 0.13.0
    return (st.cache[k] = { emb: em.total + ce, per, op, tot: em.total + ce + op });''', label='carbon')
# verdicts by capacity class
rep(P, '      v: v || (feasible && uncOk && humidOk ? "ceil" : "sys") };',
    '      qlc: S.coolParts(c).ql, ceil75: S.coolParts(c).k >= 2 && feasible && humidOk && uncOk,\n'
    '      v: v || CLSID[Math.max(0, S.coolParts(c).k) + 1] };', label='verdict v')
rep(P, '  const VLAB = { wait: "Checking", none: "No cooling needed", ceil: "A chilled ceiling is enough, without air conditioning", sys: "Air conditioning needed"',
    '  // 0.13.0: cooling classes by capacity (register cool.class)\n'
    '  const CLSID = ["none", "c30", "c50", "c100", "c200"];\n'
    '  const FLIPT = { none: "no cooling needed", c30: "cooling up to 30 W/m²", c50: "cooling up to 50 W/m²", c100: "cooling up to 100 W/m²", c200: "cooling above 100 W/m²" };\n'
    '  function coolCls(row) { // 0 no cooling, 1 to 4 the capacity classes; quick, from the cached or estimated checks\n'
    '    const h = row.r.heat, c = row.r.cool; let none;\n'
    '    if (dinRule()) { const d = st.dinC[[row.sc, row.a, FS.keyOf(row.dz)].join("|")], kh = d ? d["din_" + st.region] : h["din_" + st.region]; none = kh != null && kh <= dinLim(); }\n'
    '    else { const ab = st.model === "din" ? h["dinh_" + st.region] : (h[compKey(row.dz)] || [])[3]; none = ab == null || 100 * ab / nOccNow() <= st.maxOut; }\n'
    '    const k = S.coolParts(c).k; return none ? 0 : k < 0 ? 4 : k + 1;\n'
    '  }\n'
    '  const VLAB = { wait: "Checking", none: "No cooling needed", c30: "Cooling up to 30 W/m²", c50: "Cooling up to 50 W/m²", c100: "Cooling up to 100 W/m²", c200: "Cooling above 100 W/m²"', label='VLAB')
T[P] = T[P].replace('  const VSHORT = { wait: "Checking…", none: "No cooling", ceil: "Chilled ceiling", sys: "Air conditioning" };',
    '  const VSHORT = { wait: "Checking…", none: "No cooling", c30: "Cooling up to 30 W/m²", c50: "Cooling up to 50 W/m²", c100: "Cooling up to 100 W/m²", c200: "Cooling above 100 W/m²" };')
if 'c30: "Cooling up to 30 W/m²", c50: "Cooling up to 50 W/m²", c100: "Cooling up to 100 W/m²", c200: "Cooling above 100 W/m²" };' not in T[P]: sys.exit('VSHORT')
rep(P, '  const RANKV = { none: 0, ceil: 1, sys: 2 };', '  const RANKV = { none: 0, c30: 1, c50: 2, c100: 3, c200: 4 };', label='RANKV')
rep(P, '{ none: "no cooling needed", ceil: "needs a chilled ceiling", sys: "needs air conditioning" }[v2] || VSHORT[v2]', 'FLIPT[v2] || VSHORT[v2]', label='flip')
rep(P, 'return ["none", "ceil", "dry", "sys", "wait"].filter((k) => g[k])', 'return ["none", "c30", "c50", "c100", "c200", "wait"].filter((k) => g[k])', label='coolSum')
rep(P, '<span class="fcv"><span class="cvd ${v}">${VSHORT[v]}</span>${din}</span>', '<span class="fcv"><span class="cvd ${v}">${VSHORT[v]}</span>${v[0] === "c" && r.r.cool.cPeak != null ? `<span class="dinl">peak ${fmt(r.r.cool.cPeak)} W/m²</span>` : ""}${din}</span>', label='card peak')
a = T[P].index('    if (x.v === "ceil") return `${f} ${pk};')
b = T[P].index('  const cap1 = (t) =>', a)
T[P] = T[P][:a] + '''    // 0.13.0: the capacity class, the actual peak, what typically provides it, and the conditions of radiant cooling
    const L = { c30: 30, c50: 50, c100: 100 }[x.v], kind = { c30: "typically a cooled slab, water about 18 °C", c50: "typically a chilled ceiling, water about 16 °C", c100: "typically chilled beams or fan coils", c200: "typically air conditioning" }[x.v];
    const rad = x.v === "c30" || x.v === "c50", dry = rad && x.qlc >= 0.05 ? ` In humid hours the fresh air must be dried (${fmt(x.qlc)} ${UE}), so that the cooled surfaces stay above the dew point.` : "";
    const hi = x.ceil75 ? ` A chilled ceiling with a higher rating (up to about ${CEIL_MAX} W/m² of floor at 10 K) could still cover this peak with dew-point control.` : "";
    return `${f} ${pk}: cooling ${L ? "up to " + L : "above 100"} W/m² of floor is needed, ${kind}.${dry}${hi} Windows and cooling take turns: a window opens only when the air it lets in keeps the room dew point below ${S.DP50} °C, and cooling runs with the windows shut.`;
  }
''' + T[P][b:]
# Suggest optimum: a cooling limit as a fixed choice
rep(P, "    const L = locksOf(sc, a), ks = Object.keys(L), f = facade(sc, a); if (!f) return null;\n    const m = (r) => ks.every((q) => r.dz[q] === L[q]), all = f.rows.filter(m),",
    "    const L = locksOf(sc, a), ks = Object.keys(L).filter((q) => q !== \"cool\"), f = facade(sc, a); if (!f) return null;\n    const cl = L.cool == null ? 9 : COOLLIM[L.cool], m = (r) => ks.every((q) => r.dz[q] === L[q]) && coolCls(r) <= cl, all = f.rows.filter(m),", label='optRow')
rep(P, "    const L = locksOf(sc, a), ks = Object.keys(L); if (!ks.length || !workers.length || !st.fac[sc][a]) return;",
    "    const L = locksOf(sc, a), ks = Object.keys(L).filter((q) => q !== \"cool\"); if (!ks.length || !workers.length || !st.fac[sc][a]) return;", label='lockSearch')
rep(P, "meas: VARM(sc).filter((q) => !(q in L)),", "meas: VARM(sc).filter((q) => !ks.includes(q)),", label='lock meas')
rep(P, "ks.forEach((q) => { lv[q] = [L[q]]; });", "ks.forEach((q) => { lv[q] = [L[q]]; });", label='lock lv')
rep(P, "    const opt = st.swMode === \"opt\", L = locksOf(sc, a), ks = Object.keys(L);\n    let h = `<div class=\"swmode\"",
    "    const opt = st.swMode === \"opt\", L = locksOf(sc, a), ks = Object.keys(L), ksm = ks.filter((q) => q !== \"cool\");\n    let h = `<div class=\"swmode\"", label='modebar ks')
rep(P, "    const s = ks.length && st.lockS ? st.lockS[lockSig(sc, a, L)] : null, f = facade(sc, a), n = f ? f.rows.length : 0;",
    "    const s = ksm.length && st.lockS ? st.lockS[lockSig(sc, a, L)] : null, f = facade(sc, a), n = f ? f.rows.length : 0;", label='modebar s')
rep(P, "      : !s ? \"\" : s.fail",
    "      : !s ? (L.cool != null ? `Best design within the cooling limit among ${fmt(n)} designs tested at this facade.` : \"\") : s.fail", label='modebar stat')
rep(P, "${ks.length ? ks.map((q) => `<span class=\"lkc\">${NAME4[q]}: ${esc(SHORT4[q](L[q]))} <button",
    "${ks.length ? ks.map((q) => `<span class=\"lkc\">${q === \"cool\" ? `Cooling: ${esc(COOLTXT[L.cool])}` : `${NAME4[q]}: ${esc(SHORT4[q](L[q]))}`} <button", label='chip')
rep(P, "<span class=\"small lkst\">${stat}</span></div>`;",
    "<label class=\"lkcool\">Cooling at most <select id=\"lkcool\" aria-label=\"Cooling at most\">${[[\"\", \"any\"]].concat(Object.keys(COOLTXT).map((k) => [k, COOLTXT[k]])).map(([k, t]) => `<option value=\"${k}\"${String(L.cool == null ? \"\" : L.cool) === k ? \" selected\" : \"\"}>${t}</option>`).join(\"\")}</select></label><span class=\"small lkst\">${stat}</span></div>`;", label='select')
rep(P, "    const c = $(\"lkclear\"); if (c) c.onclick = () => { st.locks[lkKey(sc, a)] = {}; renderAll(); };",
    "    const c = $(\"lkclear\"); if (c) c.onclick = () => { st.locks[lkKey(sc, a)] = {}; renderAll(); };\n"
    "    const lc = $(\"lkcool\"); if (lc) lc.onchange = () => { const L = Object.assign({}, locksOf(sc, a)); if (lc.value === \"\") delete L.cool; else L.cool = +lc.value; st.locks[lkKey(sc, a)] = L; renderAll(); };", label='select bind')
rep(P, "  const LOCKCAP = 300;", "  const LOCKCAP = 300;\n  const COOLLIM = { 0: 0, 30: 1, 50: 2, 100: 3 }, COOLTXT = { 0: \"no cooling\", 30: \"up to 30 W/m²\", 50: \"up to 50 W/m²\", 100: \"up to 100 W/m²\" };", label='coollim')
# strategies: the left-out options by name and reason
rep(P, '''    const n = STRAT.reduce((s, p) => s + S.PARAMS[p].length - LVa(p).length, 0);
    $("stratsum").textContent = n ? `${n} option${n === 1 ? "" : "s"} left out` : "all included";''',
'''    // 0.13.0: the left-out options by name, split by reason
    const DEF_OUT = { mass: ["vheavy"], nightAch: [5] }, you = [], def = [], lab = (p, lv) => `${SLAB[p].toLowerCase()} ${NAME4[p] && SHORT4[p] ? String(SHORT4[p](lv)).toLowerCase() : lv}`;
    STRAT.forEach((p) => { if (p === "fans" && !fanOkNow()) return; const al = st.allow[p] || S.PARAMS[p]; S.PARAMS[p].forEach((lv) => { if (!al.includes(lv)) ((DEF_OUT[p] || []).includes(lv) ? def : you).push(lab(p, lv)); }); });
    const parts = []; if (you.length) parts.push("by you: " + you.join(", ")); if (def.length) parts.push("by default: " + def.join(", ")); if (!fanOkNow()) parts.push(`not credited by ${MODELS[st.model].label}: ceiling fans`);
    $("stratsum").textContent = parts.length ? "Left out " + parts.join("; ") : "all included";''', label='strat')
rep(P, '  const CHANGES = [\n', '''  const CHANGES = [
    ["0.13.0", "28 Nov 2026", "Cooling by capacity class: no cooling, up to 30, up to 50, up to 100 or above 100 W/m² of floor, with the actual peak shown. Windows and cooling take turns: a window opens only when the air it lets in keeps the room dew point below the chilled-ceiling water temperature minus 1 K, and the room is cooled with the windows shut. Moisture removal, efficiency (COP 6, 5, 4, 3) and embodied carbon of the equipment follow the class. In Suggest optimum a cooling limit can be fixed. Strategies to test lists the options left out by name."],
''', label='changelog')

# ---------------------------------------------------------------- shell
rep('shell.html', '<label class="inl">COP heating <input id="coph" type="number" step="0.1" min="0.5" style="width:70px"> cooling <input id="copc" type="number" step="0.1" min="0.5" style="width:70px"></label>',
    '<label class="inl">COP heating <input id="coph" type="number" step="0.1" min="0.5" style="width:70px"></label><span class="small">Cooling: by capacity class, seasonal COP 6, 5, 4 and 3 for peaks up to 30, 50, 100 and above 100 W/m².</span>', label='copc ui')
rep('shell.html', '.cvd.none { background: var(--accent-soft); color: var(--accent) }',
    '.cvd.none { background: var(--accent-soft); color: var(--accent) } .cvd.c30, .cvd.c50 { background: rgba(63,111,154,.15); color: var(--cool) } .cvd.c100 { background: rgba(168,118,19,.15); color: var(--sun) } .cvd.c200 { background: var(--warm-soft); color: var(--warm) }\n.lkcool { display: inline-flex; align-items: center; gap: 6px; font-size: 13px } .lkcool select { width: auto; min-height: 32px }', label='css')
for k, v in F.items(): v.write_text(T[k], encoding='utf-8')
print('ok')
