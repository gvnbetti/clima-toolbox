"""Writes the landing page (index.html at the repository root) for Clima Toolbox.
The five previews are drawn from real data in the repository: the station catalogue (Clima Map), Berlin morphed by Clima Morph
itself, the Berlin weather file (Macro Clima), the Rome weather file (Micro Clima) and the sun angles of Mannheim (Room Clima) (morph/preview.json, written by node morph/mkpreview.js).
Usage: python3 shared/mklanding.py   (from the repository root)"""
import json, base64, gzip, math, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'shared'))
import addbar as A

INK, MUTE, LINE, SOFT, ACC, SUN, WARM, COOL = '#18201f', '#5b6663', '#d6dad5', '#e6e9e4', '#23614f', '#d9762b', '#b2452c', '#3f6f9a'
KC = {'A': '#c0392b', 'B': '#e0a020', 'C': '#2f8a5c', 'D': '#2a6fc0', 'E': '#7b6fb0'}
W, H = 480, 260

def epw(name):
    L = (ROOT / 'macro/data/epw' / name).read_text(encoding='latin-1').splitlines()[8:]
    return [r.split(',') for r in L if r.strip()][:8760]

# ---------------------------------------------------------------- Clima Map: every station, coloured by Köppen group
def prev_map():
    s = (ROOT / 'macro/data/stations.js').read_text(); b = s[s.index('"') + 1:s.rindex('"')]
    sites = json.loads(gzip.decompress(base64.b64decode(b)))['sites']
    seen, paths = set(), {k: [] for k in KC}
    for la, lo, *_r in sites:
        k = (_r[2] or ' ')[0]
        if k not in KC or abs(lo) > 180 or not -58 < la < 78: continue
        x = round((lo + 180) / 360 * W, 1); y = round((78 - la) / 136 * H, 1)
        key = (round(x / 2.2), round(y / 2.2))
        if key in seen: continue
        seen.add(key); paths[k].append(f'M{x} {y}h0')
    g = ''.join(f'<path d="{"".join(p)}" stroke="{KC[k]}" stroke-width="2.3" stroke-linecap="round" opacity=".85"/>' for k, p in paths.items())
    # pin over Berlin
    px, py = round((13.4 + 180) / 360 * W, 1), round((78 - 52.5) / 136 * H, 1)
    pin = f'<g transform="translate({px - 16} {py - 34}) scale(.5)"><path d="M32 58C29 53 24 48 24 43A8 8 0 0 1 40 43C40 48 35 53 32 58Z" fill="#fbfbf9" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="43" r="3" fill="{INK}"/></g>'
    leg = ''.join(f'<circle cx="{14 + i * 86}" cy="{H - 10}" r="4" fill="{KC[k]}"/><text x="{22 + i * 86}" y="{H - 6}">{n}</text>' for i, (k, n) in enumerate(zip(KC, ['Tropical', 'Dry', 'Temperate', 'Continental', 'Polar'])))
    return g + pin + f'<rect x="4" y="{H - 21}" width="{W - 8}" height="19" rx="3" fill="#f6f6f3" opacity=".9"/><g class="t">{leg}</g>', len(seen)

# ---------------------------------------------------------------- Macro Clima: Berlin, daily range and mean through the year
def prev_macro():
    rows = epw('DEU_BE_Berlin-Tegel.AP.103820_TMYx.epw.txt'); t = [float(r[6]) for r in rows]
    d = [t[i * 24:(i + 1) * 24] for i in range(365)]
    lo, hi, mean = [min(x) for x in d], [max(x) for x in d], [sum(x) / 24 for x in d]
    T0, T1 = -15, 35; X = lambda i: 30 + i / 364 * (W - 44); Y = lambda v: 18 + (T1 - v) / (T1 - T0) * (H - 52)
    band = 'M' + ' L'.join(f'{X(i):.1f} {Y(hi[i]):.1f}' for i in range(365)) + ' L' + ' L'.join(f'{X(i):.1f} {Y(lo[i]):.1f}' for i in reversed(range(365))) + 'Z'
    # comfort band (EN 16798-1 cat. II, running mean), drawn as context like the app does
    rm, a, cb_hi, cb_lo = mean[-1], 0.8, [], []
    for i in range(365):
        rm = (1 - a) * mean[i - 1] + a * rm if i else rm
        r = min(30, max(10, rm)); cb_hi.append(0.33 * r + 18.8 + 3); cb_lo.append(0.33 * r + 18.8 - 4)
    cb = 'M' + ' L'.join(f'{X(i):.1f} {Y(cb_hi[i]):.1f}' for i in range(365)) + ' L' + ' L'.join(f'{X(i):.1f} {Y(cb_lo[i]):.1f}' for i in reversed(range(365))) + 'Z'
    line = 'M' + ' L'.join(f'{X(i):.1f} {Y(mean[i]):.1f}' for i in range(365))
    grid = ''.join(f'<line x1="30" x2="{W - 14}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="{LINE}" stroke-width="1"/><text x="24" y="{Y(v) + 4:.1f}" text-anchor="end">{v}</text>' for v in (-10, 0, 10, 20, 30))
    mons = ''.join(f'<text x="{X(15 + 30.4 * k):.1f}" y="{H - 14}" text-anchor="middle">{m}</text>' for k, m in enumerate('JFMAMJJASOND'))
    return (f'<g class="t">{grid}{mons}</g><path d="{cb}" fill="{ACC}" opacity=".16"/><path d="{band}" fill="{MUTE}" opacity=".28"/>'
            f'<path d="{line}" fill="none" stroke="{INK}" stroke-width="1.6"/><text class="t" x="{W - 14}" y="14" text-anchor="end">Berlin · °C · daily range, mean, comfort band</text>')

# ---------------------------------------------------------------- Micro Clima: Rome, air temperature by month and hour
def prev_micro():
    rows = epw('ITA_LZ_Rome.162400_TMYx.epw.txt'); days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    acc = [[[] for _ in range(24)] for _ in range(12)]; i = 0
    for m, n in enumerate(days):
        for _ in range(n * 24): acc[m][int(rows[i][3]) - 1].append(float(rows[i][6])); i += 1
    def col(v):
        stops = [(0, (63, 111, 154)), (12, (122, 156, 186)), (18, (214, 218, 213)), (24, (229, 178, 120)), (30, (178, 69, 44))]
        for (a, ca), (b, cb) in zip(stops, stops[1:]):
            if v <= b or b == 30:
                f = max(0, min(1, (v - a) / (b - a))); return '#%02x%02x%02x' % tuple(round(ca[j] + (cb[j] - ca[j]) * f) for j in range(3))
    x0, y0, cw, ch = 46, 16, (W - 64) / 12, (H - 50) / 24
    cells = ''.join(f'<rect x="{x0 + m * cw:.1f}" y="{y0 + h * ch:.1f}" width="{cw + .3:.1f}" height="{ch + .3:.1f}" fill="{col(sum(acc[m][h]) / len(acc[m][h]))}"/>' for m in range(12) for h in range(24))
    lab = ''.join(f'<text x="{x0 + (m + .5) * cw:.1f}" y="{H - 18}" text-anchor="middle">{c}</text>' for m, c in enumerate('JFMAMJJASOND'))
    lab += ''.join(f'<text x="{x0 - 6}" y="{y0 + h * ch + 4:.1f}" text-anchor="end">{h:02d}:00</text>' for h in (0, 6, 12, 18))
    # tree and person, the Micro Clima glyph, standing on the carpet's edge
    fig = f'<g transform="translate({W - 66} {H - 74}) scale(.75)" fill="none" stroke="{INK}" stroke-width="3.5" stroke-linecap="round"><path d="M6 56H58M24 48V56M42 49V56"/><circle cx="24" cy="41" r="7" fill="#fbfbf9"/><circle cx="42" cy="45" r="2.6" fill="{INK}"/></g>'
    return f'{cells}<g class="t">{lab}<text x="{W - 14}" y="11" text-anchor="end">Rome · air temperature by month and hour</text></g>'

# ---------------------------------------------------------------- Room Clima: a room in section under the sun of Mannheim
def prev_room():
    lat = 49.5; hs, hw = 90 - lat + 23.44, 90 - lat - 23.44
    fx, fy, fw, fh, gy = 36, 88, 250, 132, 220  # room in section; facade (south) on the right; ground at gy
    g = [f'<line x1="14" x2="{W - 14}" y1="{gy}" y2="{gy}" stroke="{INK}" stroke-width="2.5"/>']
    wy0, wy1 = fy + 26, gy - 30
    # sun patches on the floor, summer short and winter deep
    for alt, c in ((hw, '#f3d9b0'), (hs, '#efb98a')):
        t = math.tan(math.radians(alt)); x0, x1 = fx + fw - (gy - wy1) / t, fx + fw - (gy - wy0) / t
        g.append(f'<polygon points="{fx + fw},{wy0} {fx + fw},{wy1} {max(fx, x0):.1f},{gy} {max(fx, x1):.1f},{gy}" fill="{c}" opacity=".55"/>')
    g.append(f'<rect x="{fx}" y="{fy}" width="{fw}" height="{gy - fy}" fill="none" stroke="{INK}" stroke-width="2.5"/>')
    g.append(f'<rect x="{fx + fw - 3}" y="{wy0}" width="6" height="{wy1 - wy0}" fill="#f6f6f3"/><line x1="{fx + fw}" x2="{fx + fw}" y1="{wy0}" y2="{wy1}" stroke="{COOL}" stroke-width="2"/>')
    g.append(f'<line x1="{fx + fw}" x2="{fx + fw + 30}" y1="{wy0 - 3}" y2="{wy0 - 3}" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>')
    for alt, c, lab, ly in ((hs, SUN, f'summer noon {hs:.0f}°'.replace(' noon', ''), 26), (hw, '#e2a65c', f'winter noon {hw:.0f}°'.replace(' noon', ''), 0)):
        t = math.tan(math.radians(alt)); L = 104
        for y in (wy0, (wy0 + wy1) / 2, wy1):
            g.append(f'<line x1="{fx + fw + L * math.cos(math.radians(alt)):.1f}" y1="{y - L * math.sin(math.radians(alt)):.1f}" x2="{fx + fw}" y2="{y}" stroke="{c}" stroke-width="1.5"/>')
        ex, ey = fx + fw + 104 * math.cos(math.radians(alt)), wy0 - 104 * math.sin(math.radians(alt))
        g.append(f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="6" fill="{c}"/><text class="t" x="{ex + 10:.1f}" y="{ey + 4:.1f}">{lab}</text>')
    g.append(f'<circle cx="{fx + 46}" cy="{gy - 24}" r="7" fill="#f6f6f3" stroke="{INK}" stroke-width="2.5"/><line x1="{fx + 46}" x2="{fx + 46}" y1="{gy - 17}" y2="{gy}" stroke="{INK}" stroke-width="2.5"/>')
    meters = [('Daylight', .72, ACC), ('Overheating', .28, WARM), ('Energy', .45, COOL), ('Carbon', .38, MUTE)]
    for i, (n, v, c) in enumerate(meters):
        y = 20 + i * 15; g.append(f'<text class="t" x="{fx}" y="{y + 4}">{n}</text><rect x="{fx + 84}" y="{y - 3}" width="112" height="6" rx="3" fill="{SOFT}"/><rect x="{fx + 84}" y="{y - 3}" width="{112 * v:.0f}" height="6" rx="3" fill="{c}"/>')
    g.append(f'<text class="t" x="{W - 14}" y="{gy + 22}" text-anchor="end">Mannheim · south room, sun at noon</text>')
    return ''.join(g)

# ---------------------------------------------------------------- Clima Morph: Berlin as recorded and at +2 °C in an urban neighbourhood
def prev_morph():
    d = json.loads((ROOT / 'morph/preview.json').read_text()); a, b = d['src'], d['morphed']
    T0, T1 = -5, 30; x0, y0, cw = 40, 22, (W - 60) / 12; Y = lambda v: y0 + (T1 - v) / (T1 - T0) * (H - 62)
    g = ''.join(f'<line x1="{x0}" x2="{W - 14}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="{LINE}" stroke-width="1"/><text x="{x0 - 6}" y="{Y(v) + 4:.1f}" text-anchor="end">{v}</text>' for v in (0, 10, 20, 30))
    for m in range(12):
        x = x0 + m * cw
        g += f'<rect x="{x + cw * .16:.1f}" y="{Y(max(a[m], 0)):.1f}" width="{cw * .32:.1f}" height="{abs(Y(a[m]) - Y(0)):.1f}" fill="{MUTE}" opacity=".45"/>'
        g += f'<rect x="{x + cw * .52:.1f}" y="{Y(max(b[m], 0)):.1f}" width="{cw * .32:.1f}" height="{abs(Y(b[m]) - Y(0)):.1f}" fill="{WARM}" opacity=".85"/>'
        g += f'<text x="{x + cw / 2:.1f}" y="{H - 24}" text-anchor="middle">{"JFMAMJJASOND"[m]}</text>'
    leg = (f'<rect x="{x0}" y="{H - 15}" width="9" height="9" fill="{MUTE}" opacity=".45"/><text x="{x0 + 14}" y="{H - 7}">as recorded</text>'
           f'<rect x="{x0 + 110}" y="{H - 15}" width="9" height="9" fill="{WARM}" opacity=".85"/><text x="{x0 + 124}" y="{H - 7}">+2 °C, urban: the file you download</text>')
    return f'<g class="t">{g}{leg}<text x="{W - 14}" y="13" text-anchor="end">Berlin · monthly mean air temperature · °C</text></g>'

svgwrap = lambda inner, label: f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="{label}" class="pv">{inner}</svg>'
mp, nmap = prev_map()
PREV = {'map': svgwrap(mp, 'Weather stations of the world, coloured by climate group'), 'macro': svgwrap(prev_macro(), 'Berlin daily temperature through the year'),
        'micro': svgwrap(prev_micro(), 'Rome air temperature by month and hour'), 'room': svgwrap(prev_room(), 'A room in section with summer and winter sun'),
        'morph': svgwrap(prev_morph(), 'Berlin monthly temperature as recorded and morphed to +2 °C in an urban neighbourhood')}

CARDS = [
    ('map', 'Clima', 'Map', 'map/index.html', 'Finds the weather file.',
     'Some 30,000 weather stations with 67,000 typical-year files. Search a place or click the map; the nearest stations come with their elevation and climate type, and each file downloads in one click.',
     ['Typical years from recent periods', 'Nearest stations to any point', 'Climate type of each station']),
    ('morph', 'Clima', 'Morph', 'morph/index.html', 'Exports the weather file.',
     'The future climate and the urban heat island of the toolbox, written into the weather file itself. The download is a valid EPW file for EnergyPlus, Ladybug and other simulation tools, with the same hours as in Macro, Micro and Room Clima.',
     ['+1.5, +2 and +3 °C of global warming', 'Urban heat island', 'Read by EnergyPlus and Ladybug']),
    ('macro', 'Macro', 'Clima', 'macro/index.html', 'Reads the weather file.',
     'What the climate asks of a building: temperature and humidity through the year, sun, wind, sky, rain, comfort and the strategies that suit it, with the climate at +1.5, +2 and +3 °C of global warming and the urban heat island.',
     ['Comfort, sun, wind, rain', 'Future climate after IPCC AR6', 'Urban heat island']),
    ('micro', 'Micro', 'Clima', 'micro/index.html', 'Outdoor comfort.',
     'Which moves make an outdoor space comfortable, and for how many hours: trees, canopies, ground surfaces, walls, courtyards and street canyons, compared hour by hour with the thermal comfort index UTCI.',
     ['Shade, ground, wind, enclosure', 'Hours of comfort gained or lost', 'Season by season trade-offs']),
    ('room', 'Room', 'Clima', 'room/build/index.html', 'Room and facade.',
     'What to build, facade by facade: window size, glazing, shading, ventilation, mass and fans searched against daylight, overheating, energy and whole-life carbon, with the DIN 4108-2 summer check.',
     ['Hourly ISO 52016-1 room model', 'Checked against EnergyPlus and Radiance', 'Packages that meet every target']),
]
FLOW = [('map', 'Map'), ('morph', 'Morph'), ('macro', 'Macro'), ('micro', 'Micro'), ('room', 'Room')]
svg = lambda k, s: f'<svg width="{s}" height="{s}" viewBox="0 0 64 64" aria-hidden="true">{A.GLYPH[k].replace("4.5", "3")}</svg>'

cards = ''.join(f'''
  <article class="card" id="{k}">
    <a class="cover" href="{p}">{PREV[k]}</a>
    <div class="body">
      <h2>{svg(k, 40)}<span><span class="{'b' if a == 'Clima' else 'l'}">{a}</span> <span class="{'b' if b == 'Clima' else 'l'}">{b}</span></span></h2>
      <p class="what">{what}</p>
      <p>{text}</p>
      <ul>{''.join(f'<li>{x}</li>' for x in li)}</ul>
      <a class="go" href="{p}">Open {a} {b} <span aria-hidden="true">→</span></a>
    </div>
  </article>''' for k, a, b, p, what, text, li in CARDS)
flow = '<span class="arr" aria-hidden="true"></span>'.join(f'<a href="#{k}" class="step">{svg(k, 40)}<span>{n}</span></a>' for k, n in FLOW)

page = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Clima Toolbox: open climate tools for early design</title>
<meta name="description" content="Five browser tools that carry one weather file from the map to the window and beyond: Clima Map, Clima Morph, Macro Clima, Micro Clima and Room Clima.">
<link rel="icon" href="shared/icons/toolbox.svg" type="image/svg+xml">
<link rel="stylesheet" href="shared/fonts/fonts.css">
<style>
:root {{ --bg: #f1f2ef; --panel: #fbfbf9; --ink: {INK}; --mute: {MUTE}; --line: {LINE}; --soft: {SOFT}; --accent: {ACC}; --sun: {SUN};
  --f-disp: "IBM Plex Sans Condensed", "Arial Narrow", sans-serif; --f-body: "IBM Plex Sans", system-ui, sans-serif; --f-data: "IBM Plex Mono", ui-monospace, monospace }}

* {{ box-sizing: border-box }}
body {{ margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 var(--f-body) }}
.wrap {{ max-width: 1180px; margin: 0 auto; padding: 0 max(20px, env(safe-area-inset-left, 0px)) }}
.hero {{ display: grid; grid-template-columns: auto 1fr; gap: 28px 40px; align-items: center; padding-top: 72px; padding-bottom: 40px }}
.hero .mark {{ color: var(--ink) }}
.hero h1 {{ font-size: clamp(44px, 7vw, 76px); line-height: 1; letter-spacing: -.02em; margin: 0; font-weight: 300 }}
.hero h1 b {{ font-weight: 600 }}
.hero .sub {{ font-size: 20px; color: var(--mute); margin: 10px 0 0 }}
.lede {{ grid-column: 1 / -1; max-width: 760px; font-size: 18px; margin: 8px 0 0 }}
.lede p {{ margin: 0 0 12px }}
@media (max-width: 640px) {{ .hero {{ grid-template-columns: 1fr; padding-top: 40px; gap: 16px }} .hero .mark svg {{ width: 84px; height: 84px }} }}
.flow {{ display: flex; align-items: center; gap: 0; margin: 12px auto 48px; flex-wrap: wrap; max-width: 940px }}
.step {{ display: flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; font: 600 15px var(--f-disp); letter-spacing: .02em; text-transform: uppercase; padding: 6px 4px }}
.step:hover span {{ color: var(--accent) }}
.arr {{ flex: 1; min-width: 28px; height: 1px; background: var(--line); margin: 0 14px; position: relative }}
.arr::after {{ content: ""; position: absolute; right: -1px; top: -4px; border: 4.5px solid transparent; border-left: 7px solid var(--line); border-right: 0 }}
.cards {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; max-width: 940px; margin: 0 auto }}
@media (max-width: 860px) {{ .cards {{ grid-template-columns: 1fr }} }}
.card {{ background: var(--panel); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; scroll-margin-top: 20px }}
.cover {{ display: block; background: #f6f6f3; border-bottom: 1px solid var(--line) }}
.pv {{ display: block; width: 100%; height: auto }}
.pv .t, .pv text {{ font: 10.5px "IBM Plex Mono", monospace; fill: {MUTE} }}
.body {{ padding: 18px 22px 22px; display: flex; flex-direction: column; flex: 1 }}
.body h2 {{ display: flex; align-items: center; gap: 12px; margin: 0 0 6px; font-size: 26px; letter-spacing: -.01em; line-height: 1 }}
.body h2 .b {{ font-weight: 600 }} .body h2 .l {{ font-weight: 300 }}
.what {{ font: 500 13px var(--f-data); text-transform: uppercase; letter-spacing: .07em; color: var(--accent); margin: 4px 0 10px }}
.body p {{ margin: 0 0 12px; font-size: 15px }}
.body ul {{ margin: 0 0 18px; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px }}
.body li {{ font-size: 13px; border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; color: var(--mute) }}
.go {{ margin-top: auto; align-self: flex-start; color: #fff; background: var(--accent); text-decoration: none; font-weight: 500; padding: 9px 16px; border-radius: 6px }}

.go:hover {{ filter: brightness(1.1) }}
.facts {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; padding: 64px 0 24px; border-bottom: 1px solid var(--line) }}
@media (max-width: 860px) {{ .facts {{ grid-template-columns: 1fr }} }}
.facts h3 {{ font: 600 13px var(--f-data); text-transform: uppercase; letter-spacing: .08em; margin: 0 0 8px; color: var(--mute) }}
.facts p {{ margin: 0; font-size: 15px }}
.facts a, footer a {{ color: inherit }}
footer {{ padding: 22px 0 48px; font-size: 13px; color: var(--mute) }}
</style>
</head>
<body>
<header class="wrap hero">
  <div class="mark">{svg('studio', 120)}</div>
  <div>
    <h1><b>Clima</b> Toolbox</h1>
    <p class="sub">Bringing climate into architectural design.</p>
  </div>
  <div class="lede"><p>Clima Toolbox is a collection of free, open-source tools for exploring the relationship between climate, place and architecture.</p>
  <p>Start by finding a weather file for your location. Understand the climate and explore future and urban climate scenarios. Analyse outdoor comfort and test different configurations. Then move indoors to explore how room dimensions, facade design and building configurations influence energy, thermal comfort and daylight. When the work moves on to other simulation tools, take the future and urban climate with you in the weather file itself.</p>
  <p>All tools run directly in your browser.</p></div>
</header>
<main class="wrap">
  <nav class="flow" aria-label="The five apps">{flow}</nav>
  <div class="cards">{cards}</div>
  <section class="facts">
    <div><h3>Checked</h3><p>Every model is checked against an established tool: the room model against EnergyPlus and ASHRAE Standard 140, daylight against Radiance, outdoor comfort against Ladybug, and the climate calculations against pvlib, pythermalcomfort and the IPCC Atlas data. See the <a href="validation.html">validation page</a> for the results and their limits.</p></div>
    <div><h3>Weather</h3><p>Typical-year files from Climate.OneBuilding.org (Lawrie and Crawley) and the EnergyPlus collection. Future climate from the IPCC AR6 Atlas. Your own EPW files work in every app and never leave your computer.</p></div>
    <div><h3>Open</h3><p>Code under the MIT licence, notes and validation under CC BY 4.0. Source, history and citation on <a href="https://github.com/gvnbetti/clima-toolbox">GitHub</a>.</p></div>
  </section>
  <footer><a href="about.html">About</a> · <a href="impressum.html">Impressum</a> · <a href="impressum.html#datenschutz">Datenschutz</a><br>Giovanni Betti, Berlin. The apps are drafts in active development; check results that matter against a detailed simulation. The optional AI assistant in Micro and Room Clima uses your own Anthropic API key. Visits are counted without cookies.</footer>
</main>
</body>
</html>
'''
(ROOT / 'index.html').write_text(page.replace('<body>', '<body>' + A.bar('home'), 1))
print('index.html written;', nmap, 'station dots in the map preview')
