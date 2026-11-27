"""Writes the site's method pages from docs/methods/*.md, so the site and the repository say the same thing:
methods.html (the overview, from README.md) and methods/<app>.html. Links between method pages become links between
site pages; links into the repository and repository paths in code become links to GitHub. Rerun after editing a
method page. Needs Python-Markdown (pip install markdown).
Usage (from the repository root): python3 shared/mkmethods.py"""
import pathlib, re, sys, markdown
sys.path.insert(0, str(pathlib.Path(__file__).parent)); import addbar as A
ROOT = pathlib.Path(__file__).resolve().parent.parent; SRC = ROOT / 'docs' / 'methods'
GH = 'https://github.com/gvnbetti/clima-toolbox'
PAGES = [('README.md', 'methods.html', 'Overview'), ('clima-map.md', 'methods/map.html', 'Clima Map'),
         ('clima-morph.md', 'methods/morph.html', 'Clima Morph'),
         ('macro-clima.md', 'methods/macro.html', 'Macro Clima'), ('climate-scenarios.md', 'methods/climate.html', 'Future and urban climate'),
         ('micro-clima.md', 'methods/micro.html', 'Micro Clima'), ('room-clima.md', 'methods/room.html', 'Room Clima'),
         ('room-clima-carbon.md', 'methods/room-carbon.html', 'Room Clima: carbon')]
SITE = {md: out for md, out, _ in PAGES}

CSS = '''<style>
:root { --bg: #f1f2ef; --panel: #fbfbf9; --ink: #18201f; --mute: #5b6663; --line: #d6dad5; --accent: #23614f;
  --f-body: "IBM Plex Sans", system-ui, sans-serif; --f-data: "IBM Plex Mono", ui-monospace, monospace }

* { box-sizing: border-box }
.ref { padding-left: 2em; text-indent: -2em; font-size: 14px }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.65 var(--f-body) }
.wrap { max-width: 1080px; margin: 0 auto; padding: 48px max(20px, env(safe-area-inset-left, 0px)) 64px; display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 48px }
nav.toc { font-size: 14px; position: sticky; top: 16px; align-self: start }
nav.toc b { display: block; font: 600 11px var(--f-data); text-transform: uppercase; letter-spacing: .08em; color: var(--mute); margin: 0 0 10px }
nav.toc a { display: block; color: var(--mute); text-decoration: none; padding: 4px 0 4px 10px; border-left: 2px solid var(--line) }
nav.toc a:hover { color: var(--ink) } nav.toc a[aria-current] { color: var(--ink); border-left-color: var(--accent); font-weight: 600 }
article { max-width: 780px }
h1 { font-size: 38px; font-weight: 300; letter-spacing: -.01em; line-height: 1.15; margin: 0 0 28px }
h2 { font: 600 13px var(--f-data); text-transform: uppercase; letter-spacing: .08em; color: var(--mute); margin: 40px 0 12px }
h3 { font-size: 17px; margin: 28px 0 8px }
p { margin: 0 0 14px } a { color: var(--accent) } code { font: 13px var(--f-data); overflow-wrap: anywhere } pre { overflow-x: auto; font-size: 13px }
ul, ol { margin: 0 0 14px; padding-left: 22px } li { margin: 0 0 6px } li > ul { margin: 6px 0 0 }
table { width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.5; background: var(--panel); border: 1px solid var(--line); margin: 0 0 18px }
th, td { text-align: left; vertical-align: top; padding: 8px 12px; border-top: 1px solid var(--line) }
thead th { font: 600 11px var(--f-data); text-transform: uppercase; letter-spacing: .06em; color: var(--mute); border-top: 0 }
.tw { overflow-x: auto }
.next { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 14px; display: flex; justify-content: space-between; gap: 16px }
.next a { text-decoration: none }
.src { font: 12px var(--f-data); color: var(--mute) } .src a { color: inherit }
@media (max-width: 820px) { .wrap { grid-template-columns: minmax(0, 1fr); gap: 20px; padding-top: 32px } nav.toc { position: static }
  nav.toc a { display: inline-block; border: 1px solid var(--line); border-radius: 14px; padding: 3px 10px; margin: 0 4px 6px 0 }
  nav.toc a[aria-current] { border-color: var(--accent) } h1 { font-size: 30px } .tw table { min-width: 620px } td code { overflow-wrap: normal } }
</style>'''

def links(h, out):
    up = '../' * out.count('/')
    def fix(m):
        href = m.group(1)
        base, _, frag = href.partition('#')
        name = pathlib.PurePosixPath(base).name
        if base and not base.startswith(('http', 'mailto')):
            if name in SITE and '/' not in base.rstrip('/'): href = up + SITE[name] + ('#' + frag if frag else '')
            else:  # anything else in the repository: open it on GitHub
                p = (SRC / base).resolve().relative_to(ROOT); href = f'{GH}/{"tree" if base.endswith("/") or (ROOT / p).is_dir() else "blob"}/main/{p.as_posix()}'
        return f'href="{href}"'
    h = re.sub(r'href="([^"]+)"', fix, h)
    h = h.replace(f'href="{GH}/tree/main/validation">Validation<', f'href="{up}validation.html">Validation<')
    def code(m):  # repository paths written as code become links
        t = m.group(1); p = t.split(' ')[0]
        if re.match(r'^(validation|room|macro|micro|map|shared|docs)/[\w./-]*$', p) and (ROOT / p).exists():
            return f'<a href="{GH}/{"tree" if (ROOT / p).is_dir() else "blob"}/main/{p.rstrip("/")}"><code>{t}</code></a>'
        return m.group(0)
    return re.sub(r'<code>([^<]+)</code>', code, h)

for i, (md, out, label) in enumerate(PAGES):
    text = (SRC / md).read_text()
    text = re.sub(r'^> Draft for .*\n\n?', '', text, flags=re.M)  # editorial notes stay in the repository
    # Python-Markdown needs a blank line before a list (GitHub does not): add it where a list follows a paragraph
    text = re.sub(r'(?m)^((?![-*] |\d+\. |\s|\|).+)\n(?=(?:[-*] |\d+\. ))', r'\1\n\n', text)
    title = re.match(r'# (.+)', text).group(1)
    body = markdown.markdown(text, extensions=['tables', 'sane_lists'])
    if '<h2>References</h2>' in body:  # APA list: hanging indent, live links
        a, b = body.split('<h2>References</h2>', 1)
        b = re.sub(r'(?<![">])(https?://[^\s<]+[^\s<.,])', r'<a href="\1">\1</a>', b).replace('<p>', '<p class="ref">')
        body = a + '<h2>References</h2>' + b
    body = links(body, out).replace('<table>', '<div class="tw"><table>').replace('</table>', '</table></div>')
    up = '../' * out.count('/')
    toc = ''.join(f'<a href="{up}{o}"{" aria-current=page" if o == out else ""}>{l}</a>' for _, o, l in PAGES)
    prev = f'<a href="{up}{PAGES[i - 1][1]}">← {PAGES[i - 1][2]}</a>' if i else '<span></span>'
    nxt = f'<a href="{up}{PAGES[i + 1][1]}">{PAGES[i + 1][2]} →</a>' if i + 1 < len(PAGES) else f'<a href="{up}validation.html">Validation →</a>'
    page = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{"Methods" if i == 0 else title.replace(": method", "")} · Clima Toolbox</title>
<meta name="description" content="How Clima Toolbox works: background, principles, models, assumptions and limits.">
<link rel="icon" href="{up}shared/icons/toolbox.svg" type="image/svg+xml">
<link rel="stylesheet" href="{up}shared/fonts/fonts.css">
{CSS}
</head>
<body>{A.bar('methods')}
<div class="wrap"><nav class="toc" aria-label="Method pages"><b>Methods</b>{toc}</nav>
<article>{body}
<p class="src">Source: <a href="{GH}/blob/main/docs/methods/{md}">docs/methods/{md}</a></p>
<div class="next">{prev}{nxt}</div></article></div>
</body>
</html>
'''
    (ROOT / out).parent.mkdir(exist_ok=True); (ROOT / out).write_text(page)
    print(out)
