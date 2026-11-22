"""EnergyPlus 25.2 models of the Standard 140 cases (cases.py), run in Denver (all 14 cases, the Standard 140 test) and in
the 14 validation climates (8 cases). Hourly zone air temperature and ideal loads are kept in WORK/thermal_engine/ep/.
Usage: python3 ep_run.py [--jobs 2]"""
import json, os, re, subprocess, sys, glob
from multiprocessing import Pool
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "lib"))
from paths import WORK, EPLUS, WX, EP_VERSION
import climates

D = os.path.join(WORK, "thermal_engine")
SPEC = json.load(open(os.path.join(D, "cases.json")))
CASES = SPEC["cases"]


def idf(z):
    Lx, Wy, H = z["dims"]
    A = []; a = A.append
    a(f"Version,{EP_VERSION};")
    a("SimulationControl,No,No,No,No,Yes,No,1;")
    a("Building,BESTEST,0,Country,0.04,0.4,FullInteriorAndExterior,25,6;")
    a("Timestep,6;")
    a("Site:GroundReflectance,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2;")
    a("GlobalGeometryRules,UpperLeftCorner,Counterclockwise,World;")
    a("RunPeriod,Year,1,1,,12,31,,Sunday,No,No,No,No,No;")
    a("ScheduleTypeLimits,Any,,,Continuous;")
    a("Schedule:Constant,On,Any,1;")
    def sched(name, vals):
        a(",".join([f"Schedule:Compact,{name},Any,Through: 12/31,For: AllDays"] + [f"Until: {k+1:02d}:00,{v}" for k, v in enumerate(vals)]) + ";")
    sched("HeatSP", z["heatSP"]); sched("CoolSP", z["coolSP"]); sched("Vent", [1.0 if v > 0 else 0.0 for v in z["ventM3h"]])
    a("Zone,Z;")
    def cons(name, layers, ext_abs=0.6):
        names = []
        for j, (d, k, rho, c) in enumerate(layers):
            mn = f"{name}_L{j}"
            if rho == 0: a(f"Material:NoMass,{mn},Rough,{d/k:.5f},0.9,0.6,0.6;")
            else:
                ab = ext_abs if j == 0 else 0.6
                a(f"Material,{mn},Rough,{d},{k},{rho},{c},0.9,{ab},{ab};")
            names.append(mn)
        a(f"Construction,{name}," + ",".join(names) + ";")
    byid = {e["id"]: e for e in z["elements"]}
    cons("WallC", byid["wall_S"]["layers"]); cons("RoofC", byid["roof"]["layers"]); cons("FloorC", byid["floor"]["layers"], ext_abs=0.0)
    g = z["glass"]
    a(f"WindowMaterial:Glazing,Glass,SpectralAverage,,{g['thick']},{g['tau']},{g['rho']},{g['rho']},{g['tau']},{g['rho']},{g['rho']},0,{g['eps']},{g['eps']},{g['k']};")
    a(f"WindowMaterial:Gas,Gap,Air,{g['gap']};")
    a("Construction,WinC,Glass,Gap,Glass;")
    P = {"S": ((0, 0), (Lx, 0)), "E": ((Lx, 0), (Lx, Wy)), "N": ((Lx, Wy), (0, Wy)), "W": ((0, Wy), (0, 0))}
    OUT = {"S": (0, -1), "E": (1, 0), "N": (0, 1), "W": (-1, 0)}   # outward normal of each wall
    made, nsh = set(), [0]
    for k, ((x1, y1), (x2, y2)) in P.items():
        a(f"BuildingSurface:Detailed,Wall_{k},Wall,WallC,Z,,Outdoors,,SunExposed,WindExposed,autocalculate,4,{x1},{y1},{H},{x1},{y1},0,{x2},{y2},0,{x2},{y2},{H};")
    a(f"BuildingSurface:Detailed,Roof,Roof,RoofC,Z,,Outdoors,,SunExposed,WindExposed,autocalculate,4,0,{Wy},{H},0,0,{H},{Lx},0,{H},{Lx},{Wy},{H};")
    a(f"BuildingSurface:Detailed,Floor,Floor,FloorC,Z,,Outdoors,,NoSun,NoWind,autocalculate,4,0,0,0,0,{Wy},0,{Lx},{Wy},0,{Lx},0,0;")
    for e in z["elements"]:
        if e["kind"] != "window": continue
        gm = e["geom"]; (x1, y1), (x2, y2) = P[gm["wall"]]
        wl = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
        f0, f1 = gm["x0"] / wl, (gm["x0"] + gm["w"]) / wl
        ax, ay, bx, by = x1 + (x2 - x1) * f0, y1 + (y2 - y1) * f0, x1 + (x2 - x1) * f1, y1 + (y2 - y1) * f1
        fr = gm.get("frame", 0.0)                       # optional opaque frame share of the opening (window diagnostic), above the glass
        zb, zt, zo = gm["z0"], gm["z0"] + gm["h"] * (1 - fr), gm["z0"] + gm["h"]
        a(f"FenestrationSurface:Detailed,{e['id']},Window,WinC,Wall_{gm['wall']},,autocalculate,,1,4,{ax},{ay},{zt},{ax},{ay},{zb},{bx},{by},{zb},{bx},{by},{zt};")
        if fr > 0:
            fa = gm.get("frameAbs", 0.6)                # solar absorptance of the frame, outside and inside
            if "FrameC" not in made: a(f"Material:NoMass,FrameM,Smooth,{1 / 2.74 - 0.13 - 0.04:.4f},0.9,{fa},{fa};"); a("Construction,FrameC,FrameM;"); made.add("FrameC")
            a(f"FenestrationSurface:Detailed,{e['id']}_frame,Door,FrameC,Wall_{gm['wall']},,,,1,4,{ax},{ay},{zo},{ax},{ay},{zt},{bx},{by},{zt},{bx},{by},{zo};")
        if gm.get("reveal"):                             # optional outer reveal of depth d around the glass (window diagnostic)
            d = gm["reveal"]; nx, ny = OUT[gm["wall"]]
            q = lambda x, y, zz, k: (x + nx * d * k, y + ny * d * k, zz)
            for (x1_, y1_, z1_), (x2_, y2_, z2_) in [((ax, ay, zb), (bx, by, zb)), ((ax, ay, zt), (bx, by, zt)), ((ax, ay, zb), (ax, ay, zt)), ((bx, by, zb), (bx, by, zt))]:
                P4 = [q(x1_, y1_, z1_, 0), q(x2_, y2_, z2_, 0), q(x2_, y2_, z2_, 1), q(x1_, y1_, z1_, 1)]
                for rev, nm in ((P4, "a"), (P4[::-1], "b")):
                    nsh[0] += 1; a(f"Shading:Building:Detailed,Rev{nsh[0]}{nm},,4," + ",".join(f"{c:.4f}" for pt in rev for c in pt) + ";")
        if gm.get("overhang"):
            o = gm["overhang"]; a(f"Shading:Overhang,OH_{e['id']},{e['id']},{o['gap']},90,{o['ext']},{o['ext']},{o['dep']};")
    gn = z["gains"]
    a(f"OtherEquipment,Gains,None,Z,On,EquipmentLevel,{gn['total']},,,0,{gn['radFrac']},0,0,General;")
    a(f"ZoneInfiltration:DesignFlowRate,Inf,Z,On,AirChanges/Hour,,,,{z['ach_inf']},1,0,0,0;")
    vmax = max(z["ventM3h"])
    if vmax > 0:   # limits wide open: the schedule alone decides (minimum indoor -100, maximum indoor 100, delta -100, outdoor -100 to 100)
        a(f"ZoneVentilation:DesignFlowRate,NightVent,Z,Vent,Flow/Zone,{vmax/3600:.5f},,,,Natural,0,1,1,0,0,0,-100,,100,,-100,,-100,,100,,40;")
    if z["ideal"]:
        a("Schedule:Constant,CtlType,Any,4;")
        a("ThermostatSetpoint:DualSetpoint,DSP,HeatSP,CoolSP;")
        a("ZoneControl:Thermostat,TS,Z,CtlType,ThermostatSetpoint:DualSetpoint,DSP;")
        a("ZoneHVAC:IdealLoadsAirSystem,IL,,ILSup,,,50,13,0.015,0.009,NoLimit,,,NoLimit,,,,,None,0.7,None,,,None,NoEconomizer,None,0,0;")
        a("NodeList,Inl,ILSup;")
        a("ZoneHVAC:EquipmentConnections,Z,EqL,Inl,,ZNode,ZRet;")
        a("ZoneHVAC:EquipmentList,EqL,SequentialLoad,ZoneHVAC:IdealLoadsAirSystem,IL,1,1,,;")
        a("Output:Variable,IL,Zone Ideal Loads Zone Sensible Heating Energy,Hourly;")
        a("Output:Variable,IL,Zone Ideal Loads Zone Sensible Cooling Energy,Hourly;")
    a("Output:Variable,Z,Zone Mean Air Temperature,Hourly;")
    if z.get("diag"):   # window diagnostic: transmitted sun, and the part of it absorbed at the inside faces of the opaque surfaces
        a("Output:Variable,*,Enclosure Windows Total Transmitted Solar Radiation Energy,Hourly;")
        for k in P: a(f"Output:Variable,Wall_{k},Surface Inside Face Solar Radiation Heat Gain Energy,Hourly;")
        a("Output:Variable,Roof,Surface Inside Face Solar Radiation Heat Gain Energy,Hourly;"); a("Output:Variable,Floor,Surface Inside Face Solar Radiation Heat Gain Energy,Hourly;")
        for e in z["elements"]:
            if e["kind"] == "window" and e["geom"].get("frame"): a(f"Output:Variable,{e['id']}_frame,Surface Inside Face Solar Radiation Heat Gain Energy,Hourly;")
    a("Output:Constructions,Constructions;")
    a("OutputControl:Files,Yes,No,No,Yes,Yes,No,Yes,No,No,No,No,No,No,No,No,No,No,No,No,No,No,No,No,No,No,No;")
    return "\n".join(A) + "\n"


def run(job):
    case, clim, epw = job
    d = os.path.join(D, "ep", clim, case); os.makedirs(d, exist_ok=True)
    out = os.path.join(D, "ep", clim, case + ".json")
    if os.path.exists(out): return out
    z = CASES[case]
    open(f"{d}/in.idf", "w").write(idf(z))
    r = subprocess.run([EPLUS, "-w", epw, "-d", d, "-x", "in.idf"], cwd=d, capture_output=True, text=True)
    if r.returncode != 0: raise RuntimeError(case + " " + clim + "\n" + open(f"{d}/eplusout.err").read()[-1500:])
    import csv
    rows = list(csv.reader(open(f"{d}/eplusout.csv")))
    head, data = rows[0], [r[:1] + r[2:] if len(r) == len(rows[0]) + 1 else r for r in rows[1:]]   # some outputs carry an empty second column
    col = lambda s: [float(x[[k for k, h in enumerate(head) if s in h][0]] or 0) for x in data]
    res = {"tair": [round(x, 2) for x in col("Mean Air Temperature")]}
    if z["ideal"]:
        res["qh"] = [round(x / 3600, 1) for x in col("Heating Energy")]   # W (hourly J / 3600 s)
        res["qc"] = [round(x / 3600, 1) for x in col("Cooling Energy")]
    if clim == "denver":
        m = re.search(r" WindowConstruction,\s*WINC,[^\n]*", open(f"{d}/eplusout.eio").read())
        if m: f = [x.strip() for x in m.group(0).split(",")]; res["window"] = {"conductance": float(f[5]), "SHGC": float(f[8])}   # check of the U 2.74 and SHGC 0.760 used by js_run.js
    json.dump(res, open(out, "w"))
    for f in glob.glob(f"{d}/*"): os.remove(f)
    os.rmdir(d)
    return out


if __name__ == "__main__":
    jobs = int(sys.argv[sys.argv.index("--jobs") + 1]) if "--jobs" in sys.argv else 2
    work = [(c, "denver", os.path.join(WX, climates.DENVER)) for c in CASES]
    work += [(c, k, os.path.join(WX, f)) for k, f in climates.CLIMATES.items() if k != "denver" for c in SPEC["climate_cases"]]
    with Pool(jobs) as p:
        for k, o in enumerate(p.imap_unordered(run, work)): print(k + 1, "/", len(work), os.path.relpath(o, D), flush=True)
