"""Window diagnostic, step 1: the free-floating Standard 140 cases 600FF and 900FF with five window geometries. The
question: does the app engine's warm bias in the test box come from the flush windows of the box, through which
EnergyPlus loses part of the transmitted sun back out? Room Clima's windows sit behind a reveal and have a frame.
  flush   the Standard 140 box as specified: two windows of 3 x 2 m, flush with the outer face, no frame
  reveal  the same glass behind a 0.3 m outer reveal (Room Clima's default glass setback)
  frame   30 % of each opening an opaque frame (Room Clima's default), the glass above it 30 % smaller
  recess  reveal and frame together, as Room Clima models a window
  single  one window of 3 x 2 m instead of two: half the glass, the rest as in flush
  recess_dark0  as recess, with a frame that absorbs no sun (EnergyPlus only differs; the app ignores sun on frames)
Writes WORK/window_diag/cases.json."""
import json, os, sys, copy
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "lib")); sys.path.insert(0, os.path.join(HERE, "..", "engine"))
from paths import WORK
import cases as std

GEOMS = {"flush": {}, "reveal": {"reveal": 0.3}, "frame": {"frame": 0.3}, "recess": {"reveal": 0.3, "frame": 0.3}, "single": {"single": True}, "recess_dark0": {"reveal": 0.3, "frame": 0.3, "frameAbs": 0.0}}
BASES = ["600FF", "900FF"]


def variant(base, gname):
    z = copy.deepcopy(std.zone(base)); g = GEOMS[gname]; z["diag"] = True; z["case"] = f"{base}_{gname}"
    if g.get("single"):
        win = [e for e in z["elements"] if e["kind"] == "window"]
        z["elements"] = [e for e in z["elements"] if e["id"] != win[1]["id"]]
        for e in z["elements"]:
            if e["id"] == "wall_S": e["area"] += win[1]["area"]
    for e in z["elements"]:
        if e["kind"] == "window":
            if "reveal" in g: e["geom"]["reveal"] = g["reveal"]
            if "frame" in g: e["geom"]["frame"] = g["frame"]
            if "frameAbs" in g: e["geom"]["frameAbs"] = g["frameAbs"]
    return z


if __name__ == "__main__":
    os.makedirs(os.path.join(WORK, "window_diag"), exist_ok=True)
    C = {f"{b}_{g}": variant(b, g) for b in BASES for g in GEOMS}
    json.dump(C, open(os.path.join(WORK, "window_diag", "cases.json"), "w"))
    print("wrote", len(C), "cases")
