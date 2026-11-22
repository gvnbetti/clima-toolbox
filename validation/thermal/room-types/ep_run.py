"""Room types, step 2: EnergyPlus 25.2 models of the cases written by dump.js: the same constructions, windows, reveal and
outdoor shading as the app, with the app's operation imposed hour by hour from its own run:
air change (window openings by EN 16798-7, base air), blind state per window (switchable glazing: SHGC g x F_C,
U with the blind's added resistance), internal gains (100% convective). Free-running and heated.
Usage: python3 ep_run.py   (NP=2 parallel runs)"""
import json, math, os, subprocess, sys
import pandas as pd
from multiprocessing import Pool
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'lib'))
from paths import WORK, EPLUS as EP, WX, EP_VERSION
R = os.path.join(WORK, 'room_types_holdout' if os.environ.get('SET') == 'holdout' else 'room_types')   # SET=holdout: the held-out climates
CASES = json.load(open(f'{R}/cases.json'))
RSI, RSE = 0.13, 0.04
def idf(c, heat, d):
    W, D, H = c['dims']; rot = math.radians(c['az'] - 180); cr, sr = math.cos(rot), math.sin(rot)
    P = lambda p: f"{p[0]*cr + p[1]*sr:.4f},{-p[0]*sr + p[1]*cr:.4f},{p[2]:.4f}"
    def rect(o, u, Lu, v, Lv):
        pts = [[o[i] + v[i]*Lv for i in range(3)], o, [o[i] + u[i]*Lu for i in range(3)], [o[i] + u[i]*Lu + v[i]*Lv for i in range(3)]]
        return ",".join(P(p) for p in pts)
    L = []; A = L.append
    A(f"Version,{EP_VERSION};"); A("SimulationControl,No,No,No,No,Yes,No,1;")
    A("Building,Room,0,Suburbs,0.04,0.4,FullInteriorAndExterior,25,6;"); A("Timestep,6;")
    A("ShadowCalculation,PolygonClipping,Periodic,7,15000;")
    A("GlobalGeometryRules,UpperLeftCorner,Counterclockwise,World;")
    A("Site:GroundReflectance,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2;")
    A("RunPeriod,Year,1,1,,12,31,,Monday,No,No,No,No,No;")
    A("ScheduleTypeLimits,Any,,,Continuous;"); A("Schedule:Constant,On,Any,1;")
    for j, n in enumerate(["ach", "gain", "bA", "bB"]):
        A(f"Schedule:File,S_{n},Any,{d}/sched.csv,{j+1},0,8760,Comma,No,60;")
    A("Zone,Z1;")
    made = {}
    def cons(layers, aSol):
        key = json.dumps(layers) + str(aSol)
        if key in made: return made[key]
        name = f"C{len(made)}"; lay = []
        for j, (dd, k, rho, cp) in enumerate(layers):
            mn = f"{name}_L{j}"; ab = max(0.01, aSol if j == 0 else 0.6)
            if rho * cp == 0 or dd < 0.003: A(f"Material:NoMass,{mn},MediumRough,{max(0.001, dd/k):.5f},0.9,{ab},{ab};")
            else: A(f"Material,{mn},MediumRough,{dd},{k},{rho},{cp},0.9,{ab},{ab};")
            lay.append(mn)
        A(f"Construction,{name}," + ",".join(lay) + ";"); made[key] = name; return name
    E = {e['id']: e for e in c['elements']}
    geo = {'wall_A': ([0, 0, 0], [1, 0, 0], W, [0, 0, 1], H), 'wall_back': ([W, D, 0], [-1, 0, 0], W, [0, 0, 1], H),
        'wall_B': ([0, D, 0], [0, -1, 0], D, [0, 0, 1], H), 'wall_side': ([W, 0, 0], [0, 1, 0], D, [0, 0, 1], H),
        'floor': ([0, 0, 0], [0, 1, 0], D, [1, 0, 0], W), 'ceiling': ([0, 0, H], [1, 0, 0], W, [0, 1, 0], D), 'roof': ([0, 0, H], [1, 0, 0], W, [0, 1, 0], D)}
    # v16 zones split the ceiling (or roof) into an exposed part and a part under a suspended ceiling: two strips
    for top in ('ceiling', 'roof'):
        if top + '_cov' in E:
            s0 = E[top]['area'] / (W * D)
            geo[top] = ([0, 0, H], [1, 0, 0], W, [0, 1, 0], D * s0); geo[top + '_cov'] = ([0, D * s0, H], [1, 0, 0], W, [0, 1, 0], D * (1 - s0))
    for eid, e in E.items():
        o, u, Lu, v, Lv = geo[eid]; kind = 'Floor' if eid == 'floor' else 'Roof' if eid.startswith(('ceiling', 'roof')) else 'Wall'
        bc = 'Outdoors' if e['bc'] == 'outdoor' else 'Adiabatic'
        lay = e['layers'] if bc == 'Outdoors' else list(reversed(e['layers'])) + e['layers']  # mirrored, see 24 Oct notes
        A(f"BuildingSurface:Detailed,{eid},{kind},{cons(lay, e['aSol'])},Z1,,{bc},,{'SunExposed,WindExposed' if bc == 'Outdoors' else 'NoSun,NoWind'},,4,{rect(o, u, Lu, v, Lv)};")
    sh = []; shd = c['shade']
    for w in c['windows']:
        A(f"WindowMaterial:SimpleGlazingSystem,G{w['wall']},{w['U']},{w['g']},0.6;"); A(f"Construction,Win{w['wall']},G{w['wall']};")
        if shd['fc'] < 1:  # lowered blind: solar factor g x F_C and the blind's added resistance (as the app)
            Us = 1 / (1 / w['U'] + (shd['dR'] or 0))
            A(f"WindowMaterial:SimpleGlazingSystem,GS{w['wall']},{Us:.4f},{w['g'] * shd['fc']:.4f},0.1;"); A(f"Construction,WinS{w['wall']},GS{w['wall']};")
        rfr = max(0.001, 1 / w['U'] - RSI - RSE); A(f"Material:NoMass,Fr{w['wall']},Smooth,{rfr:.4f},0.9,0.01,0.01;"); A(f"Construction,Frame{w['wall']},Fr{w['wall']};")
        r = w['rect']; bw, bh = r['x1'] - r['x0'], r['z1'] - r['z0']
        if w['wall'] == 'A': o, ea, en = [r['x0'], 0, r['z0']], [1, 0, 0], [0, -1, 0]; base = 'wall_A'; Lw = W
        else: o, ea, en = [0, r['x1'], r['z0']], [0, -1, 0], [-1, 0, 0]; base = 'wall_B'; Lw = D
        ez = [0, 0, 1]
        A(f"FenestrationSurface:Detailed,Win_{w['wall']},Window,Win{w['wall']},{base},,,,1,4,{rect(o, ea, bw, ez, bh)};")
        if shd['fc'] < 1:
            A(f"WindowShadingControl,WSC_{w['wall']},Z1,{1 if w['wall'] == 'A' else 2},SwitchableGlazing,WinS{w['wall']},OnIfScheduleAllows,S_b{w['wall']},,Yes,No,,,,,,Sequential,Win_{w['wall']};")
        fa = w['area'] * w['frame']; fh = min(0.8, r['z0'] - 0.04); fw = fa / fh
        a0 = (Lw - fw) / 2; fo = [a0, 0, 0.02] if w['wall'] == 'A' else [0, Lw - a0, 0.02]
        A(f"FenestrationSurface:Detailed,Frame_{w['wall']},Door,Frame{w['wall']},{base},,,,1,4,{rect(fo, ea, fw, ez, fh)};")
        def Pw(a, z, dd): return [o[i] + ea[i] * a + ez[i] * z + en[i] * dd for i in range(3)]
        t = c['wall']['glass']
        if t > 0:
            sh += [(Pw(0, 0, 0), ea, bw, en, t), (Pw(0, bh, 0), ea, bw, en, t), (Pw(0, 0, 0), ez, bh, en, t), (Pw(bw, 0, 0), ez, bh, en, t)]
        f = c['fixed']
        if f.get('overhang'):
            e_ = f['overhang']['ext']; sh.append((Pw(-e_, bh, t), ea, bw + 2 * e_, en, f['overhang']['depth']))
        if f.get('fins'):
            for a in (0, bw): sh.append((Pw(a, 0, t), ez, bh, en, f['fins']['depth']))
    for k, (o, u, Lu, v, Lv) in enumerate(sh):
        A(f"Shading:Building:Detailed,Shd{k},,4,{rect(o, u, Lu, v, Lv)};"); A(f"Shading:Building:Detailed,Shd{k}b,,4,{rect(o, v, Lv, u, Lu)};")
    A("ElectricEquipment,Gains,Z1,S_gain,Watts/Area,,1,,0,0,0,General;")  # 100% convective (DIN 4108-2, v16)
    A("ZoneVentilation:DesignFlowRate,Vent,Z1,S_ach,AirChanges/Hour,,,,1,Natural,0,1,1,0,0,0,-100,,100,,-100,,-100,,100,,40;")
    if heat:
        A(f"Schedule:Constant,HeatSP,Any,{c['tHeat']};"); A("Schedule:Constant,CoolSP,Any,99;"); A("Schedule:Constant,CtlType,Any,4;")
        A("ThermostatSetpoint:DualSetpoint,DualSP,HeatSP,CoolSP;")
        A("ZoneControl:Thermostat,Tstat,Z1,CtlType,ThermostatSetpoint:DualSetpoint,DualSP;")
        A("ZoneControl:Thermostat:OperativeTemperature,Tstat,Constant,0.5;")
        A("ZoneHVAC:IdealLoadsAirSystem,Ideal,,IdealSupply,,,50,13,0.015,0.009,NoLimit,,,NoLimit,,,,,None,0.7,None,,,None,NoEconomizer,None,0,0;")
        A("NodeList,Inlets,IdealSupply;"); A("ZoneHVAC:EquipmentConnections,Z1,EqList,Inlets,,ZoneNode,ZoneReturn;")
        A("ZoneHVAC:EquipmentList,EqList,SequentialLoad,ZoneHVAC:IdealLoadsAirSystem,Ideal,1,1,,;")
    A("Output:Variable,Z1,Zone Operative Temperature,Hourly;")
    if heat: A("Output:Variable,Ideal,Zone Ideal Loads Zone Sensible Heating Energy,Hourly;")
    A("OutputControl:Files,Yes,No,No,No,No,No,Yes,No,No,No,No,No,No,No,No,No,No,No,No,No,No,No,No,No,No,No;")
    return "\n".join(L) + "\n"
def run(args):
    c, heat = args; mode = 'heat' if heat else 'free'
    d = f"{R}/runs/{c['id']}_{mode[0]}"; res = f"{d}/res.json"
    if os.path.exists(res): return
    os.makedirs(d, exist_ok=True)
    js = json.load(open(f"{R}/js/{c['id']}.json"))[mode]
    bits = dict(c['winBits']); m = js['mask']
    pd.DataFrame({'ach': js['ach'], 'gain': js['q'], 'bA': [1 if (x & bits.get('win_A', 0)) else 0 for x in m], 'bB': [1 if (x & bits.get('win_B', 0)) else 0 for x in m]}).to_csv(f"{d}/sched.csv", index=False, header=False)
    open(f"{d}/in.idf", "w").write(idf(c, heat, d))
    r = subprocess.run([EP, '-r', '-w', os.path.join(WX, f"app_{c['wx']}.epw"), '-d', d, f'{d}/in.idf'], capture_output=True, text=True)
    if r.returncode or not os.path.exists(f"{d}/eplusout.csv"):
        open(f"{d}/FAILED", "w").write(open(f"{d}/eplusout.err").read()[-4000:] if os.path.exists(f"{d}/eplusout.err") else r.stderr[-2000:]); return
    df = pd.read_csv(f"{d}/eplusout.csv"); cols = df.columns
    top = df[[k for k in cols if 'Operative' in k][0]].round(2).tolist()
    q = df[[k for k in cols if 'Heating Energy' in k][0]].sum() / 3.6e6 / (c['dims'][0] * c['dims'][1]) if heat else 0
    json.dump({"top": top, "qh": q}, open(res, "w"))
    for f in os.listdir(d):
        if f not in ("res.json",): os.remove(os.path.join(d, f))
if __name__ == "__main__":
    only = sys.argv[1:]
    jobs = [(c, h) for c in CASES for h in (False, True) if not only or c['id'] in only]
    with Pool(int(os.environ.get('NP', 2))) as p:
        for k, _ in enumerate(p.imap_unordered(run, jobs)):
            if k % 24 == 0: print(k, len(jobs), flush=True)
    print("DONE")
