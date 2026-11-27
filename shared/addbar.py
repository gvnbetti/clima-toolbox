"""Inserts (or replaces) the Clima Toolbox bar at the top of an app page: the umbrella mark, the six apps, and links to
methods, validation, source, about and impressum. The block sits between two marker comments right after <body>, so running this again replaces it.
Links are absolute, so the bar also works where an app runs as a Claude artifact.
Usage: python3 addbar.py <app id: map|macro|micro|room|morph> <html file> [...more pairs]"""
import sys, re, pathlib
VERSION = (pathlib.Path(__file__).resolve().parent.parent / 'VERSION').read_text().strip()   # Clima Toolbox release, one for all apps
VLAB = VERSION + (' beta' if VERSION.startswith('0.') else '')

BASE = 'https://gvnbetti.github.io/clima-toolbox/'
INK, SUN = 'currentColor', '#d9762b'
ARC = f'<path d="M10 34A22 22 0 0 1 54 34" fill="none" stroke="{INK}" stroke-width="4.5" stroke-linecap="round"/><circle cx="43" cy="14.95" r="5" fill="{SUN}"/>'
S = f'fill="none" stroke="{INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"'
GLYPH = {
    'studio': f'<path d="M4 44H60M8 44A24 24 0 0 1 56 44M15 44A17 17 0 0 1 49 44M22 44A10 10 0 0 1 42 44" {S}/><circle cx="44" cy="23.22" r="5" fill="{SUN}"/>',
    'map': ARC + f'<path d="M32 58C29 53 24 48 24 43A8 8 0 0 1 40 43C40 48 35 53 32 58Z" {S}/>',
    'macro': ARC + f'<path d="M4 34H60M14 43H50M24 52H40" {S}/>',
    'micro': ARC + f'<path d="M6 56H58M24 48V56M42 49V56" {S}/><circle cx="24" cy="41" r="7" {S}/><circle cx="42" cy="45" r="3" fill="{INK}"/>',
    'room': ARC + f'<path d="M50 43V38H14V56H50V51" {S}/>',
    'morph': ARC + f'<path d="M6 56H58M32 50V40M25 46L32 39L39 46" {S}/>',
    'compare': ARC + f'<path d="M12 56H52M24 56V45M40 56V39" {S}/>',
}
APPS = [('map', 'Clima Map', 'map/index.html', 'Find a weather file'), ('morph', 'Clima Morph', 'morph/index.html', 'Export a future or urban weather file'),
        ('compare', 'Clima Compare', 'compare/index.html', 'Compare two weather files'), ('macro', 'Macro Clima', 'macro/index.html', 'Read the climate'), ('micro', 'Micro Clima', 'micro/index.html', 'Outdoor comfort'),
        ('room', 'Room Clima', 'room/build/index.html', 'Room and facade')]
svg = lambda k, s: f'<svg width="{s}" height="{s}" viewBox="0 0 64 64" aria-hidden="true">{GLYPH[k]}</svg>'

CSS = '''<style>
:root{color-scheme:light}
.csb{--csb-bg:#fbfbf9;--csb-ink:#18201f;--csb-mute:#5b6663;--csb-line:#d6dad5;--csb-on:#e6e9e4;display:flex;align-items:center;gap:4px 18px;flex-wrap:wrap;
 padding:6px max(16px,env(safe-area-inset-right,0px)) 6px max(16px,env(safe-area-inset-left,0px));background:var(--csb-bg);color:var(--csb-ink);border-bottom:1px solid var(--csb-line);
 font:500 13px/1.2 "IBM Plex Sans",system-ui,-apple-system,sans-serif;position:relative;z-index:50}

.csb a{color:inherit;text-decoration:none;display:inline-flex;align-items:center;gap:7px;border-radius:5px}
.csb svg{flex:none;display:block}
.tbver{font:500 12px var(--f-data,ui-monospace,monospace);color:#5b6663;margin-left:8px;vertical-align:middle;letter-spacing:0}
.csb-ver{font:500 10.5px var(--f-data,ui-monospace,monospace);color:var(--csb-mute);margin-left:-10px}
.csb-home{font-size:15px;padding:3px 4px}.csb-home b{font-weight:600}.csb-home span{font-weight:300}
.csb-apps{display:flex;gap:2px;flex-wrap:wrap}
.csb-apps a{padding:5px 9px;color:var(--csb-mute)}.csb-apps a:hover{color:var(--csb-ink);background:var(--csb-on)}
.csb-apps a[aria-current]{color:var(--csb-ink);background:var(--csb-on);font-weight:600}
.csb-right{margin-left:auto;display:flex;gap:2px 14px;flex-wrap:wrap}
.csb-right a{color:var(--csb-mute);font-size:12px;padding:5px 2px}.csb-right a:hover,.csb-right a[aria-current]{color:var(--csb-ink)}.csb-right a[aria-current]{font-weight:600}
@media (max-width:720px){.csb-apps a span,.csb .csb-src{display:none}.csb-apps a{padding:5px 7px}.csb-right{gap:10px}}
</style>'''

# visitor count: GoatCounter, no cookies; only on the public site (not in Claude artifacts or local copies)
COUNT = ('<script>(function(){if(!/(^|\\.)github\\.io$/.test(location.hostname))return;var s=document.createElement("script");s.async=true;'
         's.setAttribute("data-goatcounter","https://climatoolbox.goatcounter.com/count");s.src="' + BASE + 'shared/goatcounter-count.js";document.head.appendChild(s)})();</script>')

def bar(cur):
    apps = ''.join(f'<a href="{BASE}{p}" title="{n}: {d}"{" aria-current=page" if k == cur else ""}>{svg(k, 20)}<span>{n}</span></a>' for k, n, p, d in APPS)
    return (f'<!-- clima-studio-bar -->{CSS}<nav class="csb" aria-label="Clima Toolbox apps"><a class="csb-home" href="{BASE}">{svg("studio", 24)}<b>Clima</b><span>Toolbox</span></a><span class="csb-ver" title="Clima Toolbox release">{VLAB}</span>'
            f'<span class="csb-apps">{apps}</span><span class="csb-right"><a href="{BASE}methods.html"{" aria-current=page" if cur == "methods" else ""}>Methods</a><a href="{BASE}validation.html"{" aria-current=page" if cur == "validation" else ""}>Validation</a>'
            f'<a class="csb-src" href="https://github.com/gvnbetti/clima-toolbox">Source</a><a href="{BASE}about.html">About</a><a href="{BASE}impressum.html">Impressum</a></span></nav>{COUNT}<!-- /clima-studio-bar -->')

if __name__ == '__main__':
    a = sys.argv[1:]
    for cur, f in zip(a[0::2], a[1::2]):
        p = pathlib.Path(f); s = p.read_text()
        s = re.sub(r'<!-- clima-studio-bar -->.*?<!-- /clima-studio-bar -->', '', s, flags=re.S)
        m = re.search(r'<body[^>]*>', s); assert m, f'no <body> in {f}'
        s = s[:m.end()] + bar(cur) + s[m.end():]
        s = re.sub(r'<span class="([^"]*\btbver)">[^<]*</span>', lambda m: f'<span class="{m.group(1)}">{VLAB}</span>', s)   # the release in the app's own header
        p.write_text(s)
        print(f'{f}: bar for {cur}')
