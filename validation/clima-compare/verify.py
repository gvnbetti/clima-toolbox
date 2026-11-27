"""Clima Compare verification (spec section 11). Runs both apps in headless Chrome against the repository served at
http://localhost:8765 (python3 -m http.server 8765 from the repository root) and writes results.json.
Usage: python3 validation/clima-compare/verify.py [chrome executable]"""
import sys, json, asyncio, csv, io, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = "http://localhost:8765/"
CHROME = sys.argv[1] if len(sys.argv) > 1 else "/usr/bin/google-chrome"
EPW = ROOT / "macro/data/epw"
BERLIN, CAIRO = "DEU_BE_Berlin-Tegel.AP.103820_TMYx.epw", "EGY_QH_Cairo.Intl.AP.623660_TMYx.epw"
OUT = {}

async def compare_page(br):
    pg = await br.new_page(viewport={"width": 1400, "height": 1000})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(BASE + "compare/index.html"); await pg.wait_for_function("window.ClimaCompare")
    pg.errs = errs
    return pg

async def load(pg, side, name, text=None, mods=None):
    if text is None: text = (EPW / (name + ".txt")).read_text(encoding="latin-1")
    await pg.evaluate("async ([k, t, n, m]) => { const CC = window.ClimaCompare; if (m) Object.assign(CC.st.mods[k], m); await CC.setSource(k, t, n); }", [side, text, name, mods])

async def render_all(pg):
    await pg.evaluate("async () => { const CC = window.ClimaCompare; for (const id in CC.CARD) CC.renderCard(id); }")

async def diffs(pg):
    """Every B − A cell of every card, by card, in order."""
    return await pg.evaluate("() => Object.fromEntries([...document.querySelectorAll('.card')].map(c => [c.id, [...c.querySelectorAll('td.d')].map(td => td.textContent.trim())]))")

def num(t):
    t = t.replace("−", "-").replace("±", "").replace(",", "").split()[0]
    return float(t)

async def macro_csv(br, fname, fut, uhi, cards):
    """Macro Clima's own CSV downloads for the given file and settings."""
    pg = await br.new_page(viewport={"width": 1400, "height": 1000}, accept_downloads=True)
    await pg.goto(BASE + "macro/index.html"); await pg.wait_for_selector(".card", timeout=60000)
    opts = await pg.eval_on_selector_all("#bundled option", "os => os.map(o => o.textContent)")
    city = fname.split("_")[2].split(".")[0].split("-")[0]
    idx = [i for i, v in enumerate(opts) if v.startswith(city)][0]
    await pg.select_option("#bundled", index=idx); await pg.wait_for_timeout(3000)
    if fut: await pg.click(f'#futSeg button[data-v="{fut}"]'); await pg.wait_for_timeout(3000)
    if uhi: await pg.click(f'#uhiSeg button[data-v="{uhi}"]'); await pg.wait_for_timeout(3000)
    out = {}
    for c in cards:
        el = await pg.query_selector(f"#{c}"); await el.scroll_into_view_if_needed(); await pg.wait_for_timeout(400)
        async with pg.expect_download() as d: await pg.click(f'#{c} [data-exp="csv"]')
        dl = await d.value; out[c] = list(csv.reader(io.StringIO(pathlib.Path(await dl.path()).read_text(encoding="utf-8-sig"))))
    await pg.close(); return out

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        # 1. identity with Macro Clima: each file's figures equal Macro Clima's for the same settings
        cases = [(BERLIN, 0, None, {"level": 0, "ctx": "off"}), (CAIRO, 2, "urban", {"level": 2, "ctx": "urban", "svf": 0.6, "fveg": 0.2})]
        pg = await compare_page(br)
        await load(pg, "A", cases[0][0], mods=cases[0][3]); await load(pg, "B", cases[1][0], mods=cases[1][3])
        res = []
        for side, (fname, fut, uhi, _) in zip("AB", cases):
            mc = await macro_csv(br, fname, fut, uhi, ["c-glance", "c-zones", "c-monthT"])
            ours = await pg.evaluate("""(k) => { const f = window.ClimaCompare.F[k], R = f.R; return { p01: R.p01, p99: R.p99, mean: R.mean, swing: R.ex.meanSwing, ghi: R.ghi, diff: R.diffShare, hdd: R.hdd.annual, cdd: R.cdd.annual, pv: f.X.pv.map.best.annual, gtz: R.gtz.annual, zones: f.X.zones.hours, mMean: R.mMean, mMax: R.mMax, mMin: R.mMin }; }""", side)
            keys = ["p01", "p99", "mean", "swing", "ghi", "diff", "hdd", "cdd", "pv", "gtz"]
            worst = 0.0; n = 0
            for row, key in zip(mc["c-glance"][1:], keys):
                worst = max(worst, abs(float(row[1]) - ours[key])); n += 1
            # zone rows are in the order of Clima.CC_KEYS
            zl = [float(r[-2]) for r in mc["c-zones"][1:]]
            zk = await pg.evaluate("() => window.Clima.CC_KEYS.map(k => k[0])")
            for v, k in zip(zl, zk): worst = max(worst, abs(v - ours["zones"][k])); n += 1
            for r, m in zip(mc["c-monthT"][1:], range(12)):
                for j, key in ((1, "mMax"), (2, "mMean"), (3, "mMin")):
                    if j < len(r) and r[j] != "": worst = max(worst, abs(float(r[j]) - ours[key][m])); n += 1
            res.append({"file": fname, "future": fut, "context": uhi, "values_compared": n, "largest_difference": round(worst, 4)})
        OUT["identity_with_macro"] = {"cases": res, "pass": all(r["largest_difference"] <= 0.005 for r in res), "rule": "Macro Clima's CSV values (2 decimals or more) against Clima Compare's, |difference| <= 0.005"}

        # 2. self comparison: a file against itself gives zero in every difference
        pg2 = await compare_page(br)
        await load(pg2, "A", BERLIN); await load(pg2, "B", BERLIN); await render_all(pg2)
        d = await diffs(pg2); vals = [num(x) for c in d.values() for x in c]
        reading = await pg2.evaluate("document.querySelector('.reading').innerText")
        OUT["self_comparison"] = {"cells": len(vals), "nonzero": sum(1 for v in vals if v != 0), "reading": reading[:120], "pass": len(vals) > 50 and all(v == 0 for v in vals) and "same weather" in reading}

        # 3. swap: every difference changes sign and nothing else
        await render_all(pg)
        d1 = await diffs(pg)
        await pg.click("#swapBtn"); await pg.wait_for_timeout(1500); await render_all(pg)
        d2 = await diffs(pg)
        bad = []; cnt = 0
        for c in d1:
            for x, y in zip(d1[c], d2[c]):
                cnt += 1
                if abs(num(x) + num(y)) > 1e-9: bad.append([c, x, y])
            if len(d1[c]) != len(d2[c]): bad.append([c, "cells", len(d1[c]), len(d2[c])])
        OUT["swap"] = {"cells": cnt, "mismatches": bad[:10], "pass": cnt > 50 and not bad}

        # 4. solar time: the file's extraterrestrial horizontal radiation (geometry only, written by the file's producer) and
        #    the shared sun position both centre on 12:00 solar time; global radiation is reported for information
        pg4 = await compare_page(br); sol = []
        for fn in ["ESP_MD_Madrid.WS.082200_TMYx.epw", "IND_MH_Mumbai-Shivaji.Intl.AP.430030_TMYx.epw", "CHN_SH_Shanghai-Hongqiao.Intl.AP.583670_TMYx.epw", BERLIN, "MEX_CMX_Ciudad.Mexico.Central.766800_TMYx.epw", "SGP_SG_Singapore-Changi.Intl.AP.486980_Custom.epw"]:
            await load(pg4, "A", fn)
            r = await pg4.evaluate("""() => { const CC = window.ClimaCompare, f = CC.F.A, W = f.W, v = CC.view(f), prof = (a) => { const o = new Array(24).fill(0); for (let i = 0; i < 8760; i++) o[i % 24] += Math.max(0, a[i]) / 365; return o; };
              const cen = (a) => a.reduce((x, y, h) => x + y * (h + 0.5), 0) / a.reduce((x, y) => x + y, 0), up = Float32Array.from(f.X.alt, (x) => Math.max(0, Math.sin(x * Math.PI / 180)));
              const tot = (a) => a.reduce((x, y) => x + y, 0);
              return { lon: W.meta.lon, tz: W.meta.tz,
                etrClock: cen(prof(W.etrh)), etrSolar: cen(prof(v.sol(W.etrh, 'etrh'))), sunClock: cen(prof(up)), sunSolar: cen(prof(v.sol(up, 'sinalt'))),
                ghiClock: cen(prof(W.ghi)), ghiSolar: cen(prof(v.sol(W.ghi, 'ghi'))), annualChange: (tot(v.sol(W.ghi, 'ghi')) - tot(W.ghi)) / tot(W.ghi) }; }""")
            r["file"] = fn; sol.append(r)
        OUT["solar_time"] = {"cases": sol, "rule": "in solar time the centroid of the mean daily course of the sun's height (shared sun position, at the middle of each file hour) lies within 0.05 h of 12:00; annual totals unchanged within 0.1 %. The file's own extraterrestrial and global radiation are listed for information.",
                             "pass": all(abs(x["sunSolar"] - 12) <= 0.05 and abs(x["annualChange"]) <= 0.001 for x in sol)}

        # 5. season shift: a synthetic southern twin of Berlin (data rolled by 182 days, latitude negated) lines up with Berlin exactly
        lines = (EPW / (BERLIN + ".txt")).read_text(encoding="latin-1").splitlines()
        head, rows = lines[:8], lines[8:8 + 8760]
        h0 = head[0].split(","); h0[6] = str(-float(h0[6])); head[0] = ",".join(h0)
        S = 182 * 24
        twin = [",".join(r.split(",")[:6] + rows[(i + S) % 8760].split(",")[6:]) for i, r in enumerate(rows)]
        text = "\r\n".join(head + twin) + "\r\n"
        pg5 = await compare_page(br)
        await load(pg5, "A", BERLIN); await load(pg5, "B", "SOUTH_Berlin-twin_test.epw", text=text)
        off = await pg5.evaluate("""() => { const CC = window.ClimaCompare, ma = CC.view(CC.F.A), mb = CC.view(CC.F.B), a = window.Sections.monthlyMean(ma.h(CC.F.A.W.dbt)), b = window.Sections.monthlyMean(mb.h(CC.F.B.W.dbt)); return { shifted: CC.shifted(), maxMonthlyDiff: Math.max(...a.map((x, k) => Math.abs(b[k] - x))), warmA: a.indexOf(Math.max(...a)), warmB: b.indexOf(Math.max(...b)), meanB: CC.F.B.R.mean }; }""")
        await pg5.click("#season"); await pg5.wait_for_timeout(800)
        on = await pg5.evaluate("""() => { const CC = window.ClimaCompare, ma = CC.view(CC.F.A), mb = CC.view(CC.F.B), a = window.Sections.monthlyMean(ma.h(CC.F.A.W.dbt)), b = window.Sections.monthlyMean(mb.h(CC.F.B.W.dbt)); let h = 0; const v = mb.h(CC.F.B.W.dbt); for (let i = 0; i < 8760; i++) if (v[i] !== CC.F.A.W.dbt[i]) h++; return { shifted: CC.shifted(), maxMonthlyDiff: Math.max(...a.map((x, k) => Math.abs(b[k] - x))), hoursDiffering: h, warmA: a.indexOf(Math.max(...a)), warmB: b.indexOf(Math.max(...b)), meanB: CC.F.B.R.mean, note: document.getElementById('seasonnote').innerText }; }""")
        OUT["season_shift"] = {"off": off, "on": on, "pass": off["shifted"] is None and on["shifted"] == "B" and on["hoursDiffering"] == 0 and on["warmA"] == on["warmB"] and abs(on["meanB"] - off["meanB"]) < 1e-9,
                               "note": "No southern-hemisphere file is bundled; the test uses Berlin's data rolled by 182 days with the latitude negated, so after the shift both files must match hour by hour."}

        # 6. readings: every number links to an existing card; numbers linked to the glance table appear in it
        await pg.click("#swapBtn"); await pg.wait_for_timeout(1500); await render_all(pg)
        chk = await pg.evaluate("""() => { const CC = window.ClimaCompare, ns = [...document.querySelectorAll('.reading .n')], bad = [], miss = []; const g = document.querySelector('#c-glance').innerText;
          for (const s of ns) { if (!CC.CARD[s.dataset.card]) bad.push(s.dataset.card); if (s.dataset.card === 'c-glance') { const t = s.textContent.replace(/ (°C|K|h|%|kWh\\/m²)$/, ''); if (!g.includes(t)) miss.push(s.textContent); } } return { numbers: ns.length, badLinks: bad, notInGlance: miss }; }""")
        OUT["readings"] = dict(chk, **{"pass": chk["numbers"] > 20 and not chk["badLinks"] and not chk["notInGlance"]})

        OUT["page_errors"] = pg.errs + pg2.errs + pg4.errs + pg5.errs
        await br.close()
    OUT["all_pass"] = all(v.get("pass") for k, v in OUT.items() if isinstance(v, dict)) and not OUT["page_errors"]
    (pathlib.Path(__file__).parent / "results.json").write_text(json.dumps(OUT, indent=1))
    print(json.dumps({k: (v.get("pass") if isinstance(v, dict) else v) for k, v in OUT.items()}, indent=1))

asyncio.run(main())
