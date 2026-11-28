"""0.12.0, follow-up to p8: place the new sections in the flex order of the results, and in Suggest optimum drop the note
that building-wide changes apply to every facade (the optimum is for one room alone). Run from the repository root."""
import pathlib, sys
R = pathlib.Path(__file__).resolve().parent.parent / 'src'
P, SH = R / 'page.html', R / 'shell.html'
p, sh = P.read_text(encoding='utf-8'), SH.read_text(encoding='utf-8')

def rep(s, old, new, n=1, label=''):
    c = s.count(old)
    if c != n: sys.exit(f'{label}: found {c}, expected {n}')
    return s.replace(old, new)

sh = rep(sh, '#results > .evh { order: 20 } #results > #evpc { order: 21 } #results > .ev { order: 22 }',
    '#results > .evh { order: 20 } #results > #evpc { order: 21 } #results > .ev { order: 22 }\n'
    '#results > #loadnote { order: -3 } #results > #rtabs { order: -2 } #results > #ovcards { order: 2 } #results > #ovrech { order: 4 } main > #ptop { order: 0 }', label='order')
p = rep(p, 'if (wi && shCh.length) {', 'if (wi && shCh.length && !wi.opt) {', label='shCh')
P.write_text(p, encoding='utf-8'); SH.write_text(sh, encoding='utf-8')
print('ok')
