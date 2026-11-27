"""Runs EnergyPlus (example file 1ZoneUncontrolled.idf, a full year) on each source weather file and on each morphed file
written by check.js, and compares the warnings in eplusout.err. Also reads every morphed file with Ladybug (ladybug-core).
Usage: python3 eplus_check.py <EnergyPlus dir> <dir of morphed files>"""
import sys, os, re, json, subprocess, shutil, tempfile, pathlib
E, OUT = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
ROOT = pathlib.Path(__file__).resolve().parents[2]
IDF = E / 'ExampleFiles' / '1ZoneUncontrolled.idf'
def run(epw):
    d = pathlib.Path(tempfile.mkdtemp())
    subprocess.run([str(E / 'energyplus'), '-w', str(epw), '-d', str(d), str(IDF)], capture_output=True)
    err = (d / 'eplusout.err').read_text(errors='replace')
    ok = 'EnergyPlus Completed Successfully' in err
    m = re.search(r'Completed Successfully-- (\d+) Warning; (\d+) Severe', err)
    warn = [l.strip() for l in err.splitlines() if l.strip().startswith('** Warning')]
    shutil.rmtree(d)
    return {'ok': ok, 'warnings': int(m.group(1)) if m else None, 'severe': int(m.group(2)) if m else None, 'warning_lines': warn}
try:
    from ladybug.epw import EPW
except ImportError:
    EPW = None
res, allok = {}, True
src = {}
for f in sorted(OUT.glob('*.epw')):
    base = f.name.split('.epw')[0].rsplit('_', 2 if f.name.count('_+') or '_urban' in f.name else 1)[0]
    stem = next(s for s in (ROOT / 'macro/data/epw').glob('*.epw.txt') if f.name.startswith(s.name[:-8]))
    if stem.name not in src:
        tmp = pathlib.Path(tempfile.mkdtemp()) / stem.name[:-4]; shutil.copy(stem, tmp); src[stem.name] = run(tmp)
    r = run(f); s = src[stem.name]
    r['source_warnings'] = s['warnings']
    new = sorted(set(r['warning_lines']) - set(s['warning_lines']))
    # EnergyPlus's psychrometric iterations (Psy... routines) also fail to converge now and then on the source files;
    # they are reported, but a check fails only on other new warnings (weather file, location, data)
    r['new_psychrometric_warnings'] = [w for w in new if '(Psy' in w]
    r['new_warnings'] = [w for w in new if '(Psy' not in w]
    r['source_psychrometric_warnings'] = [w for w in s['warning_lines'] if '(Psy' in w]
    if EPW:
        try:
            e = EPW(str(f)); r['ladybug'] = {'ok': True, 'mean_dry_bulb_C': round(e.dry_bulb_temperature.average, 3), 'hours': len(e.dry_bulb_temperature)}
        except Exception as x:
            r['ladybug'] = {'ok': False, 'error': str(x)}; allok = False
    good = r['ok'] and r['severe'] == 0 and not r['new_warnings']
    allok &= good
    print(f.name, 'EnergyPlus', 'ok' if good else 'CHECK', f"warnings {r['warnings']} (source {s['warnings']}), severe {r['severe']}", 'Ladybug', r.get('ladybug'))
    del r['warning_lines']; res[f.name] = r
json.dump({'energyplus': str(E.name), 'idf': IDF.name, 'pass': allok, 'files': res}, open(pathlib.Path(__file__).parent / 'eplus_results.json', 'w'), indent=1)
print('ALL PASS' if allok else 'SOME CHECKS NEED A LOOK')
