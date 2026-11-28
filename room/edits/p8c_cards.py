"""0.12.0, follow-up: no card is marked as selected in the Overview. Run from the repository root."""
import pathlib, sys
P = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'page.html'
p = P.read_text(encoding='utf-8')
old = 'glanceHtml(sc, B).replace(/^[\\s\\S]*?(<div class="g4">)/, "$1")'
if p.count(old) != 1: sys.exit('anchor')
p = p.replace(old, old + '.replace(/class="fcard on"/g, \'class="fcard"\').replace(/aria-pressed="true"/g, \'aria-pressed="false"\')')
P.write_text(p, encoding='utf-8'); print('ok')
