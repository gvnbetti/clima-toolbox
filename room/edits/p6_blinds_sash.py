"""v16 phase 3.5 (27 November 2026): blind control and window openings.
Blind control switch: comfort-driven (default everywhere) = blinds down when the operative temperature of the previous
hour is above min(26 C, upper edge of the comfort band) and the sun on the window is above 100 W/m2, every orientation;
or the DIN 4108-2 thresholds (previous rule). The DIN 4108-2 check keeps the thresholds.
Openings: standard sash 0.6 x 1.5 m per 2.7 m of facade, scaled by facade width, or the window where smaller; height
min(1.5 m, window height); same sash for tilt and fully open, day and night (replaces half the window area).
Each replacement is applied in the source file that holds it, with its count checked. Run from the repository root."""
import json, pathlib
R = pathlib.Path(__file__).resolve().parent.parent / 'src'
FILES = ['register.js', 'core.js', 'page.html', 'shell.html']
PAIRS = json.loads(r'''[
 [
  "reg sash",
  "\"vent.openShare\": { v: 0.5, unit: \"share of window area\", status: \"decision\", src: \"Decision of 17 November 2026\", text: \"Openable sash area: half of the window area (fixed, not editable)\" },",
  "\"vent.sash\": { v: { w: 0.6, h: 1.5, facade: 2.7 }, unit: \"m\", status: \"decision\", src: \"Decision of 27 November 2026 (replaces half the window area, decision of 17 November 2026)\", text: \"Openable sash: 0.6 m wide and 1.5 m tall for a facade 2.7 m wide, its area scaled by the facade width (4.05 m: 1.35 m²), or the window area where the window is smaller. Opening height 1.5 m, or the window height where lower. The same sash for tilt and fully open windows, by day and at night. A larger window no longer means a larger opening\" },"
 ],
 [
  "reg blinds",
  "\"run.blinds\": { v: \"DIN 4108-2 irradiance\", status: \"decision\", src: \"Decision of 17 November 2026\", text: \"Every run, exterior and interior blinds alike: blinds come down when the sun on the window exceeds the DIN 4108-2 threshold (8.4.2 j), whatever the room temperature. The same hours apply to daylight\" }",
  "\"run.blinds\": { v: \"comfort-driven (default) or DIN 4108-2 irradiance\", status: \"decision\", src: \"Decisions of 17 and 27 November 2026\", text: \"Every design run, exterior and interior blinds alike, follows the blind control chosen in the inputs: comfort-driven (default everywhere) or the DIN 4108-2 thresholds (8.4.2 j). The same hours apply to daylight. The DIN 4108-2 check always uses the thresholds alone\" },\n    \"run.blind.comfort\": { v: { tOp: 26, irr: 100 }, unit: \"°C operative, W/m² on the window\", status: \"decision\", src: \"Decision of 27 November 2026\", text: \"Comfort-driven blinds: down when the operative temperature of the room in the previous hour is above 26 °C or the upper edge of the comfort band, whichever is lower, and the sun on the window is above 100 W/m². Every orientation. Operative temperature, as the comfort limits of EN 16798-1 and ASHRAE 55 are stated\" }"
 ],
 [
  "reg hold",
  "text: \"Design runs: blinds stay up while the room air is at or below 23 °C, to keep winter sun; above it they follow the DIN 4108-2 irradiance thresholds. The DIN 4108-2 check uses the thre",
  "text: \"Design runs with DIN 4108-2 blind control: blinds stay up while the room air is at or below 23 °C, to keep winter sun; above it they follow the DIN 4108-2 irradiance thresholds. The DIN 4108-2 check uses the thre"
 ],
 [
  "context",
  "blindCtl: opt.blindCtl || \"auto\", blinds: opt.blinds || null };",
  "blindCtl: opt.blindCtl || \"auto\", blindRule: opt.blindRule === \"din\" ? \"din\" : \"comfort\", blinds: opt.blinds || null };"
 ],
 [
  "open head",
  "  /* window openings for ventilation (v16 phase 2): per window of the room, the openable sash area (half the window area,\n     frame included) and the sash height; effective area for tilt (C_k at 10°) or fully open side-hung windows */\n  const HOLD = RV(\"run.blind.heatHold\"), VM = RV(\"vent.method\"), V_SHARE = RV(\"vent.openShare\"), V_CK = RV(\"vent.tilt\").ck;",
  "  /* window openings for ventilation: per window of the room, the openable sash and its height; effective area for tilt\n     (C_k at 10°) or fully open side-hung windows. v16 phase 3.5 (decision of 27 November 2026): a standard sash of\n     0.6 x 1.5 m per 2.7 m of facade, scaled by the facade width, or the window where smaller; height 1.5 m or the window\n     height where lower. Before: half the window area, so a larger window meant a larger opening. */\n  const HOLD = RV(\"run.blind.heatHold\"), VM = RV(\"vent.method\"), V_SASH = RV(\"vent.sash\"), V_CK = RV(\"vent.tilt\").ck, BCOM = RV(\"run.blind.comfort\");"
 ],
 [
  "open body",
  "return walls.map((L) => { const r = Z.windowRect(L, H, c.wwr, 0.3); return { sash: V_SHARE * c.wwr * L * H, h: r.z1 - r.z0 }; });",
  "return walls.map((L) => { const r = Z.windowRect(L, H, c.wwr, 0.3), std = V_SASH.w * V_SASH.h * L / V_SASH.facade; return { sash: Math.min(std, c.wwr * L * H), h: Math.min(V_SASH.h, r.z1 - r.z0) }; });"
 ],
 [
  "sim blinds",
  "      if (shd.fc < 1 && !(hand && weekend) && (din || HOLD == null || tAir > HOLD) && !(ctx.blindHalf && ((i / 24) | 0) % 2)) for (let w = 0; w < wins.length; w++) if (irr[w][i] > wthr[w]) mask |= wins[w].bit;",
  "      /* v16 phase 3.5 (decision of 27 November 2026): comfort-driven control, the default. Blinds down when the operative\n         temperature of the previous hour is above 26 °C or the upper edge of the comfort band (ctx.coolHi), whichever is\n         lower, and the sun on the window is above 100 W/m², every orientation. The DIN 4108-2 check keeps the thresholds. */\n      if (!din && ctx.blindRule !== \"din\") { const tLim = ctx.coolHi ? Math.min(BCOM.tOp, ctx.coolHi[i]) : BCOM.tOp;\n        if (shd.fc < 1 && !(hand && weekend) && topPrev > tLim && !(ctx.blindHalf && ((i / 24) | 0) % 2)) for (let w = 0; w < wins.length; w++) if (irr[w][i] > BCOM.irr) mask |= wins[w].bit; }\n      else if (shd.fc < 1 && !(hand && weekend) && (din || HOLD == null || tAir > HOLD) && !(ctx.blindHalf && ((i / 24) | 0) % 2)) for (let w = 0; w < wins.length; w++) if (irr[w][i] > wthr[w]) mask |= wins[w].bit;"
 ],
 [
  "worker ctx",
  "blindCtl:m.blindCtl,blinds:m.blinds}",
  "blindCtl:m.blindCtl,blindRule:m.blindRule,blinds:m.blinds}"
 ],
 [
  "state",
  "fanW: Register.val(\"run.fan.power\"), blindCtl: \"auto\",",
  "fanW: Register.val(\"run.fan.power\"), blindCtl: \"auto\", blindRule: \"comfort\","
 ],
 [
  "run ctx",
  "blindCtl: st.blindCtl, blinds: JSON.parse(JSON.stringify(st.blinds)) }); st.gainRun = gainNow(); st.fanWRun = st.fanW; st.blindCtlRun = st.blindCtl;",
  "blindCtl: st.blindCtl, blindRule: st.blindRule, blinds: JSON.parse(JSON.stringify(st.blinds)) }); st.gainRun = gainNow(); st.fanWRun = st.fanW; st.blindCtlRun = st.blindCtl; st.blindRuleRun = st.blindRule;"
 ],
 [
  "init msg",
  "blindCtl: st.blindCtlRun, blinds: st.blindsRun,",
  "blindCtl: st.blindCtlRun, blindRule: st.blindRuleRun, blinds: st.blindsRun,"
 ],
 [
  "ui select",
  "<label class=\"inl\">Blinds operated <select id=\"blindctl\"",
  "<label class=\"inl\">Blind control <select id=\"blindrule\" aria-label=\"Blind control rule\" style=\"width:auto\"><option value=\"comfort\">comfort-driven</option><option value=\"din\">DIN 4108-2 thresholds</option></select></label>\n        <label class=\"inl\">Blinds operated <select id=\"blindctl\""
 ],
 [
  "ui bind",
  "$(\"blindctl\").value = st.blindCtl; $(\"blindctl\").onchange = () => { st.blindCtl = $(\"blindctl\").value; setStale(true); };",
  "$(\"blindctl\").value = st.blindCtl; $(\"blindctl\").onchange = () => { st.blindCtl = $(\"blindctl\").value; setStale(true); };\n    $(\"blindrule\").value = st.blindRule; $(\"blindrule\").onchange = () => { st.blindRule = $(\"blindrule\").value; blindThr(); setStale(true); };"
 ],
 [
  "ui thr",
  "function blindThr() { const t = S.SHADE_IRR[st.use]; $(\"blindthr\").textContent = `Blinds come down when the sun on the window exceeds",
  "function blindThr() { const t = S.SHADE_IRR[st.use], bc = Register.val(\"run.blind.comfort\");\n    if (st.blindRule !== \"din\") { $(\"blindthr\").textContent = `Comfort-driven: blinds come down when the room's operative temperature is above ${bc.tOp} °C or the upper edge of the comfort band, whichever is lower, and the sun on the window is above ${bc.irr} W/m², on every orientation. The DIN 4108-2 check uses the standard's thresholds (${t[1]} W/m², ${t[0]} W/m² facing north). Daylight uses the same blind hours as the design runs.`; return; }\n    $(\"blindthr\").textContent = `Blinds come down when the sun on the window exceeds"
 ],
 [
  "txt method1",
  "Blinds come down by the DIN 4108-2 irradiance thresholds when the room air is above 23 °C, so winter sun is kept; set \"by hand\"",
  "Blinds come down comfort-driven by default (operative temperature above 26 °C or the upper edge of the comfort band, whichever is lower, and sun on the window above 100 W/m², every orientation), or by the DIN 4108-2 irradiance thresholds when the room air is above 23 °C if chosen in the inputs; set \"by hand\""
 ],
 [
  "txt method2",
  "\"Blinds come down when the room air is above 23 °C and the sun on the window exceeds the DIN 4108-2 threshold (8.4.2 j); the DIN 4108-2 check itself uses the threshold alone. Thresholds:",
  "\"Blinds: comfort-driven by default (operative temperature above 26 °C or the upper edge of the comfort band, whichever is lower, and sun on the window above 100 W/m², every orientation), or by the DIN 4108-2 irradiance thresholds when the room air is above 23 °C if chosen in the inputs. The DIN 4108-2 check itself uses the thresholds alone. Thresholds:"
 ],
 [
  "txt method3",
  "half the window area openable, single-sided without wind (EN 16798-7), checked against ASR A3.6 for offices and schools; air across storeys at 5 1/h. Blinds by the DIN 4108-2 irradiance thresholds when the room air is above 23 °C, also for daylight;",
  "a standard sash of 0.6 × 1.5 m per 2.7 m of facade, scaled by the facade width, or the window where smaller, single-sided without wind (EN 16798-7), checked against ASR A3.6 for offices and schools; air across storeys at 5 1/h. Blinds comfort-driven by default (operative temperature above 26 °C or the upper edge of the comfort band, whichever is lower, and sun on the window above 100 W/m², every orientation), or by the DIN 4108-2 irradiance thresholds when the room air is above 23 °C if chosen in the inputs, also for daylight;"
 ],
 [
  "cmt open",
  "Openable sash = half the window area; tilt windows at 10°",
  "Openable sash: 0.6 x 1.5 m per 2.7 m of facade (v16 phase 3.5); tilt windows at 10°"
 ],
 [
  "txt cool",
  "come down automatically when the sun on the facade is above ${S.SHADE_IRR[st.use][S.shadeSide(st.wx.lat, S.PARAMS.azimuth[fa]) ? 0 : 1]} W/m² and the room air is above 23 °C; left up",
  "come down automatically ${st.blindRuleRun === \"din\" ? `when the sun on the facade is above ${S.SHADE_IRR[st.use][S.shadeSide(st.wx.lat, S.PARAMS.azimuth[fa]) ? 0 : 1]} W/m² and the room air is above 23 °C` : `when the room is above ${Register.val(\"run.blind.comfort\").tOp} °C (or the comfort band, if lower) and the sun on the window is above ${Register.val(\"run.blind.comfort\").irr} W/m²`}; left up"
 ],
 [
  "changelog",
  "  const CHANGES = [\n",
  "  const CHANGES = [\n    [\"v16, phase 3.5\", \"27 Nov 2026\", \"Blind control in the inputs: comfort-driven (default everywhere) or the DIN 4108-2 thresholds. Comfort-driven blinds come down when the room's operative temperature is above 26 °C or the upper edge of the comfort band, whichever is lower, and the sun on the window is above 100 W/m², on every orientation; before, north windows hardly ever got their blinds down. Window openings: a standard sash of 0.6 × 1.5 m per 2.7 m of facade, scaled by the facade width (or the window, where smaller), for tilt and fully open windows, by day and at night; before, half the window area, so larger windows ventilated more and won on overheating. The DIN 4108-2 check is unchanged. The EnergyPlus comparison is still to be rerun with these rules.\"],\n"
 ]
]''')
OPTIONAL = {'txt method1'}  # text in the older method block, not in every source version
EXPECT = {'worker ctx': 2}
txt = {f: (R / f).read_text(encoding='utf-8') for f in FILES}
for label, old, new in PAIRS:
    hits = [f for f in FILES if old in txt[f]]
    if not hits:
        if label in OPTIONAL: print('skipped', label); continue
        raise SystemExit('not found: ' + label)
    if len(hits) > 1: raise SystemExit('in several files: ' + label)
    f = hits[0]; c = txt[f].count(old)
    if c != EXPECT.get(label, 1): raise SystemExit(f'{label}: {c} in {f}')
    txt[f] = txt[f].replace(old, new); print(label, '->', f)
for f in FILES: (R / f).write_text(txt[f], encoding='utf-8')
