"""Room types, step 3: compares the app with EnergyPlus case by case and per group, in the calibration climates (the six
weather files bundled in the app, where Room Clima's engine settings were chosen) and in the held-out climates (eight
climates not used for that choice). Writes results.md next to this script and summary.json to WORK.

Groups are reported by climate, use and room position only. The six designs per group are drawn to cover every option
level, not every combination, so results split by a single design option (mass, blind, airing) would mix the effects of
several options and are not reported.

Decision regret: in a group where the app and EnergyPlus name different best designs, the EnergyPlus result of the app's
choice minus that of EnergyPlus's own choice (K.h above 26 degC, or kWh/m2 of heating), and as a share of the spread of
the six designs in EnergyPlus."""
import json, os, sys, numpy as np, collections
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'lib'))
from paths import WORK
from scipy.stats import spearmanr
HERE = os.path.dirname(os.path.abspath(__file__)); L = []; out = lambda *a: L.append(' '.join(str(x) for x in a))
h = np.arange(8760); dow = (h // 24) % 7; hr = h % 24
OCC = {'office': (dow < 5) & (hr >= 7) & (hr < 18), 'dwelling': np.ones(8760, bool)}
SETS = {'calibration': 'room_types', 'holdout': 'room_types_holdout'}
NAMES = {'mannheim': 'Mannheim', 'bologna': 'Bologna', 'san_francisco': 'San Francisco', 'phoenix': 'Phoenix', 'dubai': 'Dubai', 'ho_chi_minh_city': 'Ho Chi Minh City',
         'miami': 'Miami', 'tampa': 'Tampa', 'new_delhi': 'New Delhi', 'denver': 'Denver', 'chicago': 'Chicago', 'montreal': 'Montreal', 'vancouver': 'Vancouver', 'yellowknife': 'Yellowknife'}
VARIANTS = {'written': 'EN ISO 52016-1 as written', 'wind': '+ (1) wind-driven exterior convection', 'angle': '+ (2) angle-dependent glazing transmission',
            'opaque': '+ (3) transmitted sun on opaque surfaces only', 'sky': '+ (4) sky long-wave over the root of the sky view', 'room': 'Room Clima settings (1 to 4)'}


def load(R):
    C = json.load(open(f'{R}/cases.json')); rows = []
    for c in C:
        js = json.load(open(f"{R}/js/{c['id']}.json")); ef = json.load(open(f"{R}/runs/{c['id']}_f/res.json")); eh = json.load(open(f"{R}/runs/{c['id']}_h/res.json"))
        a, b = np.array(ef['top']), np.array(js['free']['top']); o = OCC[c['use']]
        kh = lambda t: float(np.clip(t[o] - 26, 0, None).sum())
        x = dict(id=c['id'], wx=c['wx'], use=c['use'], sc=c['scenario'], az=c['az'], k=int(c['id'].split('_')[-1]), d=c['design'], blind=c['shade']['key'],
                 rmse=float(np.sqrt(((b - a) ** 2).mean())), bias=float((b - a).mean()), dmax=float(b.max() - a.max()),
                 kh_js=kh(b), kh_ep=kh(a), qh_js=js['heat']['qh'], qh_ep=eh['qh'], rmse_h=float(np.sqrt(((np.array(js['heat']['top']) - np.array(eh['top'])) ** 2).mean())), var={})
        for v in VARIANTS:
            f = f"{R}/replay/{v}/{c['id']}.json"
            if os.path.exists(f):
                r = json.load(open(f)); t = np.array(r['top'])
                x['var'][v] = dict(rmse=float(np.sqrt(((t - a) ** 2).mean())), bias=float((t - a).mean()), kh=kh(t), qh=r['qh'])
        rows.append(x)
    return rows


def groups(rows):
    G = collections.defaultdict(list)
    for x in rows: G[(x['wx'], x['use'], x['sc'], x['az'])].append(x)
    return G


def ranking(rows, kh='kh_js', qh='qh_js'):
    """Rank agreement and regret within each group of six designs; kh/qh pick the app values (own run or a variant)."""
    G = groups(rows); r = dict(n=len(G), rk=[], best=0, rkH=[], bestH=0, nH=0, reg=[], regH=[])
    for g, xs in G.items():
        a = [kh(x) if callable(kh) else x[kh] for x in xs]; b = [x['kh_ep'] for x in xs]
        if np.std(a) > 0 and np.std(b) > 0: r['rk'].append(spearmanr(a, b)[0])
        ia, ib = int(np.argmin(a)), int(np.argmin(b)); r['best'] += ia == ib
        if ia != ib: r['reg'].append(dict(group=g, app=xs[ia]['k'], ep=xs[ib]['k'], kh=b[ia] - b[ib], spread=max(b) - min(b), best=b[ib]))
        qa = [qh(x) if callable(qh) else x[qh] for x in xs]; qb = [x['qh_ep'] for x in xs]
        if np.std(qb) > 0 and max(qb) > 0.5:
            r['nH'] += 1
            if np.std(qa) > 0: r['rkH'].append(spearmanr(qa, qb)[0])
            ja, jb = int(np.argmin(qa)), int(np.argmin(qb)); r['bestH'] += ja == jb
            if ja != jb: r['regH'].append(dict(group=g, app=xs[ja]['k'], ep=xs[jb]['k'], q=qb[ja] - qb[jb], spread=max(qb) - min(qb)))
    return r


def table(rows, sel, lab):
    r = [x for x in rows if sel(x)]
    if not r: return
    K1 = sum(x['kh_js'] for x in r); K2 = sum(x['kh_ep'] for x in r); Q1 = sum(x['qh_js'] for x in r); Q2 = sum(x['qh_ep'] for x in r)
    out(f"| {lab} | {len(r)} | {np.mean([x['rmse'] for x in r]):.2f} | {np.mean([x['bias'] for x in r]):+.2f} | {np.mean([x['dmax'] for x in r]):+.2f} | "
        f"{(f'{100*(K1/K2-1):+.0f} %' if K2 > 0 else 'n/a')} | {K2/len(r):,.0f} | {(f'{100*(Q1/Q2-1):+.0f} %' if Q2 > 0.5 * len(r) else 'n/a')} | {Q2/len(r):.1f} |")


summary = {}
out('# Room types: the app against EnergyPlus'); out('')
out('Generated by `analyse.py`. Calibration climates: the six weather files bundled in the app, in which Room Clima\'s engine settings were chosen (24 October 2026). Held-out climates: eight climates of the engine study that played no part in that choice, run with the same rooms and designs.'); out('')
out('Free-running hourly operative temperature, app minus EnergyPlus: RMSE, mean bias and difference of the annual maximum, in K. Occupied degree-hours above 26 °C and heating need: app against EnergyPlus as a deviation of the total, with the EnergyPlus mean per room. Groups are by climate, use and room position only: the six designs per group cover every option level but not every combination, so splits by a single design option would mix the effects of several options.')
for s, sub in SETS.items():
    R = os.path.join(WORK, sub)
    if not os.path.exists(f'{R}/cases.json'): continue
    if any(not os.path.exists(f"{R}/runs/{c['id']}_{m}/res.json") for c in json.load(open(f'{R}/cases.json')) for m in 'fh'): print(f'{s}: EnergyPlus runs incomplete, skipped', file=sys.stderr); continue
    rows = load(R); summary[s] = {}
    wxs = list(dict.fromkeys(x['wx'] for x in rows))
    out(''); out(f"## {'Calibration climates' if s == 'calibration' else 'Held-out climates'} ({len(rows)} rooms)"); out('')
    out('| Group | Rooms | Hourly RMSE (K) | Bias (K) | Annual maximum (K) | Degree-hours > 26 °C | EnergyPlus mean (K·h) | Heating need | EnergyPlus mean (kWh/m²a) |')
    out('|---|---|---|---|---|---|---|---|---|')
    table(rows, lambda x: True, 'all')
    for w in wxs: table(rows, lambda x, w=w: x['wx'] == w, NAMES[w])
    for u in ('office', 'dwelling'): table(rows, lambda x, u=u: x['use'] == u, u)
    for sc in ('cellular', 'corner', 'corner_top'): table(rows, lambda x, sc=sc: x['sc'] == sc, sc.replace('_', ' '))
    rk = ranking(rows)
    out(''); out('### Ranking and regret within each group of six designs (same climate, use, room position, facade)'); out('')
    out(f"- Overheating: rank correlation {np.mean(rk['rk']):.3f} on average, lowest {np.min(rk['rk']):.3f} ({len(rk['rk'])} groups); same least-overheating design in {rk['best']} of {rk['n']} groups.")
    if rk['reg']:
        rg = rk['reg']
        out(f"- Where the choices differ ({len(rg)} groups), EnergyPlus gives the app's choice {np.mean([x['kh'] for x in rg]):,.0f} K·h more above 26 °C on average (largest {max(x['kh'] for x in rg):,.0f} K·h), "
            f"{100*np.mean([x['kh']/x['spread'] for x in rg]):.0f} % of the spread between the best and the worst of the six designs (largest {100*max(x['kh']/x['spread'] for x in rg):.0f} %).")
        for x in sorted(rg, key=lambda x: -x['kh']):
            out(f"  - {NAMES[x['group'][0]]}, {x['group'][1]}, {x['group'][2].replace('_', ' ')}, {'south' if x['group'][3] == 180 else 'west'}: app picks design {x['app']}, EnergyPlus design {x['ep']}; regret {x['kh']:,.0f} K·h ({x['best']:,.0f} K·h for the best), {100*x['kh']/x['spread']:.0f} % of the spread")
    out(f"- Heating need: rank correlation {np.mean(rk['rkH']):.3f} on average, lowest {np.min(rk['rkH']):.3f} ({rk['nH']} groups with heating); same lowest-heating design in {rk['bestH']} of {rk['nH']} groups.")
    if rk['regH']:
        rg = rk['regH']
        out(f"- Where the choices differ ({len(rg)} groups), EnergyPlus gives the app's choice {np.mean([x['q'] for x in rg]):.1f} kWh/m²a more heating on average (largest {max(x['q'] for x in rg):.1f} kWh/m²a), {100*np.mean([x['q']/x['spread'] for x in rg]):.0f} % of the spread of the six designs.")
    out(f"- Heated runs: hourly operative temperature RMSE {np.mean([x['rmse_h'] for x in rows]):.2f} K.")
    w = sorted(rows, key=lambda x: -x['rmse'])[:5]
    out(''); out('### Largest hourly differences'); out('')
    for x in w: out(f"- {x['id']}: RMSE {x['rmse']:.2f} K, bias {x['bias']:+.2f} K; design {x['k']}")
    # engine variants, same operation as EnergyPlus
    if all(len(x['var']) == len(VARIANTS) for x in rows):
        out(''); out('### Each change to EN ISO 52016-1 on these rooms'); out('')
        out('Each variant of the engine runs the same rooms with the same hourly operation that EnergyPlus receives (`replay.js`). With all four changes, the replay reproduces the app\'s own run within 0.1 K hourly RMSE in every room; the small rest comes from the four-week run-up, which the app runs under its own control.'); out('')
        out('| Engine | Hourly RMSE (K) | Bias (K) | Degree-hours > 26 °C | Heating need | Rank correlation, overheating | Same least-overheating design | Mean regret (K·h) |')
        out('|---|---|---|---|---|---|---|---|')
        K2 = sum(x['kh_ep'] for x in rows); Q2 = sum(x['qh_ep'] for x in rows)
        for v, lab in VARIANTS.items():
            K1 = sum(x['var'][v]['kh'] for x in rows); Q1 = sum(x['var'][v]['qh'] for x in rows)
            r2 = ranking(rows, kh=lambda x, v=v: x['var'][v]['kh'], qh=lambda x, v=v: x['var'][v]['qh'])
            reg = np.mean([x['kh'] for x in r2['reg']]) if r2['reg'] else 0
            out(f"| {lab} | {np.mean([x['var'][v]['rmse'] for x in rows]):.2f} | {np.mean([x['var'][v]['bias'] for x in rows]):+.2f} | {100*(K1/K2-1):+.0f} % | {100*(Q1/Q2-1):+.0f} % | {np.mean(r2['rk']):.3f} | {r2['best']} of {r2['n']} | {reg:,.0f} |")
            summary[s][v] = dict(rmse=float(np.mean([x['var'][v]['rmse'] for x in rows])), bias=float(np.mean([x['var'][v]['bias'] for x in rows])), kh=100*(K1/K2-1), qh=100*(Q1/Q2-1), rho=float(np.mean(r2['rk'])), best=r2['best'], n=r2['n'], regret=float(reg))
    summary[s]['app'] = dict(n=len(rows), rmse=float(np.mean([x['rmse'] for x in rows])), bias=float(np.mean([x['bias'] for x in rows])), rho=float(np.mean(rk['rk'])), best=rk['best'], groups=rk['n'],
                             regret=[dict(group=list(x['group']), app=x['app'], ep=x['ep'], kh=x['kh'], spread=x['spread']) for x in rk['reg']], rhoH=float(np.mean(rk['rkH'])), bestH=rk['bestH'], nH=rk['nH'],
                             regretH=[dict(group=list(x['group']), q=x['q'], spread=x['spread']) for x in rk['regH']])
    json.dump([{k: v for k, v in x.items()} for x in rows], open(f'{R}/summary.json', 'w'))
open(os.path.join(HERE, 'results.md'), 'w').write('\n'.join(L) + '\n')
json.dump(summary, open(os.path.join(HERE, 'summary.json'), 'w'), indent=1)
print('\n'.join(L))
