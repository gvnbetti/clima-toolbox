"""Window diagnostic, step 2: EnergyPlus 25.2 runs of the cases of cases.py in the 14 climates of the engine study,
with the model builder of ../engine/ep_run.py. Besides the air temperature it records the sun transmitted through the
windows and the part of it absorbed at the inside faces of the opaque surfaces (walls, roof, floor, frames).
Output: WORK/window_diag/ep/<climate>/<case>.json"""
import json, os, sys, subprocess, csv, glob
from multiprocessing import Pool
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "lib")); sys.path.insert(0, os.path.join(HERE, "..", "engine"))
from paths import WORK, EPLUS, WX
import climates
from ep_run import idf
D = os.path.join(WORK, "window_diag"); C = json.load(open(os.path.join(D, "cases.json")))
_md = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; _e = [24 * sum(_md[:k + 1]) for k in range(12)]
MONTHS = list(zip([0] + _e[:-1], _e))   # hour ranges of the 12 months


def run(job):
    case, clim = job
    d = os.path.join(D, "ep", clim, case); out = d + ".json"
    if os.path.exists(out): return out
    os.makedirs(d, exist_ok=True); open(f"{d}/in.idf", "w").write(idf(C[case]))
    r = subprocess.run([EPLUS, "-w", os.path.join(WX, climates.CLIMATES[clim]), "-d", d, "-x", "in.idf"], cwd=d, capture_output=True, text=True)
    if r.returncode != 0: raise RuntimeError(case + " " + clim + "\n" + open(f"{d}/eplusout.err").read()[-1500:])
    rows = list(csv.reader(open(f"{d}/eplusout.csv"))); head = rows[0]
    data = [x[:1] + x[2:] if len(x) == len(head) + 1 else x for x in rows[1:]]
    cols = lambda s: [k for k, h in enumerate(head) if s in h]
    tot = lambda ks: sum(float(x[k] or 0) for x in data for k in ks) / 3.6e6          # J -> kWh, year
    res = {"tair": [round(float(x[cols("Mean Air Temperature")[0]]), 2) for x in data],
           "transmitted": tot(cols("Windows Total Transmitted Solar Radiation Energy")),
           "opaque": tot(cols("Surface Inside Face Solar Radiation Heat Gain Energy")),
           "monthly": [round(sum(float(x[k] or 0) for x in data[h0:h1] for k in cols("Windows Total Transmitted Solar Radiation Energy")) / 3.6e6, 2) for h0, h1 in MONTHS]}
    json.dump(res, open(out, "w"))
    for f in glob.glob(f"{d}/*"): os.remove(f)
    os.rmdir(d); return out


if __name__ == "__main__":
    work = [(c, k) for k in climates.CLIMATES for c in C]
    with Pool(int(os.environ.get("NP", 2))) as p:
        for k, o in enumerate(p.imap_unordered(run, work)): print(k + 1, "/", len(work), os.path.relpath(o, D), flush=True)
