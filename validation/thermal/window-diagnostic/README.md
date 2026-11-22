# Window diagnostic: why the app engine runs warm in the Standard 140 box

**Question.** With Room Clima's four changes, the app engine overestimates overheating in the Standard 140 test box
(+13.9 % over 14 climates, Study 1) but slightly underestimates it in Room Clima's own rooms (Study 2). The earlier
explanation was that the box's windows are flush with the facade, so that EnergyPlus loses part of the transmitted sun
back out through them, while change 3 keeps all of it in the room. This diagnostic tests that explanation.

**Base cases.** The free-floating cases 600FF (light) and 900FF (heavy) in the 14 climates of the engine study, with
six window geometries (`diag_cases.py`):

| Window | Change from Standard 140 |
|---|---|
| Flush | none: two windows of 3 × 2 m, flush with the outer face, no frame |
| Reveal | glass behind a 0.3 m outer reveal (Room Clima's default glass setback) |
| Frame | 30 % of each opening an opaque frame (Room Clima's default), solar absorptance 0.6 |
| Reveal and frame | both, as Room Clima models a window |
| One window | one window of 3 × 2 m instead of two |
| Reveal and frame, frame absorbs no sun | frame solar absorptance 0, as in the room study (`room-types/ep_run.py`) |

EnergyPlus 25.2 (U.S. Department of Energy, 2025) models the reveal as shading surfaces around the glass and the frame
as an opaque subsurface with the window's U-value. The app engine models the reveal with the shading of `shade.js`
and the frame as an opaque share of the window that transmits no sun. EnergyPlus also reports the sun transmitted
through the glass and the part of it absorbed at the inside faces of the opaque surfaces. All six variants of the
engine (as written, each change alone, all four) run on every case.

**Results** (`results.md`, pooled over 14 climates and both cases):

| Window | Transmitted sun kept on opaque surfaces, EnergyPlus | Summer sun through the glass relative to flush, EnergyPlus / app | Effect of change 1 | Effect of change 3 | As written | All four changes |
|---|---|---|---|---|---|---|
| Flush, as Standard 140 | 96.4 % | 1.000 / 1.000 | +11.6 points | +2.2 points | +6.2 % (+0.40 K) | +12.5 % (+1.05 K) |
| Reveal | 96.4 % | 0.777 / 0.738 | +11.8 | +1.8 | −2.5 % (−0.29 K) | +9.7 % (+0.66 K) |
| Frame | 97.5 % | 0.700 / 0.700 | +11.7 | +1.7 | −3.0 % (−0.39 K) | +4.9 % (+0.27 K) |
| Reveal and frame | 97.5 % | 0.503 / 0.467 | +11.7 | +1.2 | −12.7 % (−0.94 K) | +1.2 % (−0.06 K) |
| One window | 98.2 % | 0.500 / 0.500 | +14.1 | +0.8 | +1.5 % (−0.01 K) | +11.6 % (+0.68 K) |
| Reveal and frame, frame absorbs no sun | 97.4 % | 0.503 / 0.467 | +12.6 | +1.3 | −6.0 % (−0.44 K) | +8.9 % (+0.44 K) |

Degree-hours above 26 °C, app against EnergyPlus; mean bias of the hourly air temperature in brackets. Summer: June to
August (all 14 climates lie in the northern hemisphere). Effects of a change: as written with that change, minus as
written, in percentage points of the overheating deviation.

**What this means.**
- The earlier explanation does not hold. EnergyPlus keeps 96 to 98 % of the transmitted sun on opaque surfaces in every
  geometry, flush windows included, so little leaves the room again. Change 3 raises overheating by only 1 to 2
  points, at most 0.2 K.
- The warm bias in the box comes mainly from change 1, wind-driven exterior convection. It raises overheating by 12 to
  14 points and the mean temperature by 0.57 to 0.86 K in every geometry. With a fixed coefficient of 20 W/m²K, the
  standard cools the outside surfaces as if every hour were windy; with station wind, calm sunny hours lose less heat.
- The window geometry shifts the starting point. Behind a reveal, the app lets 5 to 7 % less summer sun through the
  glass than EnergyPlus, so the standard as written runs cool there. With the window Room Clima models and a frame
  that absorbs no sun, as in the room study, the warm bias with all four changes falls from +1.05 K to +0.44 K. The
  window geometry thus explains about half of the difference between the box and the rooms; the rest comes from other
  differences between them (exposed faces, size, mass, gains and operation), which this diagnostic does not separate.
- The app engine ignores sun absorbed on the outside of window frames. In the room study EnergyPlus ignores it too
  (frame solar absorptance 0.01), so the two agree there by assumption. With an absorptance of 0.6, EnergyPlus counts
  7 % more overheating in the box with Room Clima's windows.

**How to rerun.**
```
cd thermal/window-diagnostic
python3 diag_cases.py && python3 diag_ep.py && node diag_js.js && python3 diag_analyse.py
```
About 3 minutes on two cores, after the engine study's `cases.py`.

## References
<!-- refs: usdoe2025 -->

U.S. Department of Energy. (2025). *EnergyPlus version 25.2 documentation: Engineering reference*. https://energyplus.net/documentation
