# Thermal model

**What is checked.** The hourly room model of Room Clima: EN ISO 52016-1 (ISO, 2017; hourly method) with four changes,
written in JavaScript (`room/src/core.js`, `Iso52016`). The reference is EnergyPlus 25.2 (Crawley et al., 2001; U.S.
Department of Energy, 2025). EnergyPlus itself is first checked against ASHRAE Standard 140 (ASHRAE, 2020a).

**Result in short.**
- EnergyPlus 25.2 falls within 43 of 44 Standard 140 ranges, so it can serve as the reference.
- In Room Clima's own rooms, the app follows EnergyPlus within 0.69 K hourly (RMSE) in the six climates where its
  settings were chosen, and within 0.75 K in eight further climates that played no part in that choice. It runs about
  0.5 K cooler, so it counts 8 to 11 % fewer degree-hours above 26 °C.
- It ranks the designs of each group as EnergyPlus does: rank correlation 0.98 in both sets; the same
  least-overheating design in 68 of 72 groups and in 95 of 96 held-out groups. Where it picks another design, that
  design overheats by 4 to 71 K·h more in EnergyPlus, at most 7 % of the spread between the six designs.
- Together the four changes cut the hourly RMSE in these rooms from 0.79 to 0.69 K (calibration) and from 0.88 to
  0.75 K (held out). Changes 3 and 4 help on their own; changes 1 and 2 help only in combination.
- In the Standard 140 box, which Room Clima does not use, the same changes cut the heating error and raise the
  cooling and overheating error: cooling is 13 % above the reference programs, overheating 14 % above EnergyPlus over
  14 climates.

The four changes to EN ISO 52016-1, used by Room Clima (`Sweep.simulate`, `ENGINE`):
1. Exterior convection from wind (DOE-2 correlation, as EnergyPlus; U.S. Department of Energy, 2024), with the weather
   station's wind speed; the window core resistance is taken from the rated U-value with EN 673 surface films (CEN, 2011).
2. Glazing transmission by angle of incidence instead of a constant factor of 0.9.
3. Transmitted sun is spread over the opaque inner surfaces only, not over the glass (`solOnWindows: false`).
4. Long-wave exchange with the sky over the square root of each surface's sky view factor, after Walton (1983) as in
   EnergyPlus (`skySplit: true`); the standard counts the whole sky view as cold sky.

Blinds enter as the DIN 4108-2 (DIN, 2013) reduction factor F_C on the solar gain of the glazing, with the closed blind's added
thermal resistance.

Until 21 November 2026 the reports listed three changes and compared Room Clima with a variant called "as written"
that still carried change 4. That variant is now the standard as written, and change 4 is tested on its own. The
earlier results are kept in `engine/history/` and `room-types/history/`.

## Study 1: Standard 140 and the engine in 14 climates (`engine/`)

**Base cases.** The ASHRAE Standard 140-2020 building envelope cases as implemented in the LBL Modelica Buildings
library (Wetter et al., 2014; BESTEST package 11.1.0, Lawrence Berkeley National Laboratory, 2024; Standard 140-2020
with Addendum b, ASHRAE, 2023): a single zone 8 × 6 × 2.7 m with 12 m² of
glazing, light (600 series) and heavy (900 series), with set points, night ventilation, setback, overhangs and
free-floating variants.

| Case | Glazing | Mass | Control |
|---|---|---|---|
| 600, 900 | 12 m² south | light, heavy | heating below 20 °C, cooling above 27 °C |
| 610, 910 | as 600, 900, with a 1 m overhang | light, heavy | as 600 |
| 620, 920 | 6 m² east and 6 m² west | light, heavy | as 600 |
| 640, 940 | 12 m² south | light, heavy | setback to 10 °C from 23:00 to 07:00 |
| 650, 950 | 12 m² south | light, heavy | no heating; cooling 07:00 to 18:00; night ventilation 1,700 m³/h |
| 600FF, 650FF, 900FF, 950FF | as above | | free-floating |

Common to all cases: internal gains 200 W (60 % radiant); infiltration 0.5 air changes per hour; walls and roof with
solar absorptance 0.6 and emissivity 0.9; floor raised above the ground, with no sun on it; ground reflectance 0.2.
Glazing is two panes of 3 mm clear glass with 12 mm of air. In the app engine this is entered as the U-value 2.74 W/m²K
and SHGC 0.760 that EnergyPlus computes for this glazing, a check `ep_run.py` repeats.

**Reference.** Annual loads are judged against the acceptance ranges of Addendum b. Peak loads and free-floating
temperatures are judged against the range of the six reference programmes (BSIMAC, CSE, DeST, EnergyPlus, ESP-r,
TRNSYS), as given in the Modelica library. The test runs in Denver, TMY3 (Wilcox & Marion, 2008), the climate the standard is defined for.
Beyond Denver, EnergyPlus is the reference in 14 climates (Köppen A to D, 11° to 62° N; `engine/climates.py`), on
cases 600, 620, 650, 900, 920, 950, 600FF and 900FF.

**Variants of the engine.** The standard as written; each change alone; all four together, as Room Clima runs it.

**Results** (`engine/results.md`). Denver, Standard 140: mean absolute deviation from the median of the six programmes,
signed mean in brackets.

| Model | Within range, of 44 | Heating | Cooling | Peak heating | Peak cooling |
|---|---|---|---|---|---|
| EnergyPlus 25.2 | 43 | 2.6 % (−0.4) | 2.6 % (+2.5) | 1.0 % | 4.4 % |
| EN ISO 52016-1 as written | 33 | 17.2 % (+17.2) | 6.9 % (+4.2) | 11.8 % | 6.1 % |
| + (1) wind-driven convection | 31 | 10.6 % (+10.6) | 17.5 % (+17.5) | 10.3 % | 6.5 % |
| + (2) angle-dependent transmission | 30 | 17.6 % (+17.6) | 6.9 % (−6.9) | 11.8 % | 1.7 % |
| + (3) sun on opaque surfaces only | 34 | 15.4 % (+15.4) | 8.8 % (+7.3) | 11.6 % | 5.8 % |
| + (4) sky over √F_sky | 33 | 14.6 % (+14.6) | 8.0 % (+6.4) | 11.0 % | 6.3 % |
| Room Clima, (1) to (4) | 32 | 4.8 % (+4.8) | 12.7 % (+12.7) | 10.6 % | 6.9 % |

14 climates against EnergyPlus (heating and cooling where EnergyPlus needs at least 10 kWh/m² a year; overheating:
degree-hours above 26 °C, free-floating cases):

| Model | Heating | Cooling | Overheating | Hourly RMSE, free-floating |
|---|---|---|---|---|
| EN ISO 52016-1 as written | 11.5 % (+11.5) | 6.1 % (+5.5) | 7.5 % (+7.2) | 1.34 K |
| + (1) wind-driven convection | 9.4 % (+9.4) | 15.1 % (+15.1) | 20.9 % (+20.9) | 1.94 K |
| + (2) angle-dependent transmission | 12.1 % (+12.1) | 5.1 % (−3.4) | 6.0 % (−5.6) | 0.98 K |
| + (3) sun on opaque surfaces only | 10.5 % (+10.5) | 8.3 % (+8.2) | 10.2 % (+10.2) | 1.39 K |
| + (4) sky over √F_sky | 9.3 % (+9.3) | 7.5 % (+7.2) | 9.4 % (+9.3) | 1.39 K |
| Room Clima, (1) to (4) | 4.9 % (+4.6) | 11.8 % (+11.4) | 13.9 % (+13.9) | 1.34 K |

**What this means.** The standard as written overestimates heating by 17 % in Denver and 12 % over the climates. The
cause is its fixed exterior coefficient of 20 W/m²K, with which the window loses heat at its rated U-value in every
hour. Wind-driven convection and the sky treatment of EnergyPlus together remove most of this bias. In this box the
same changes overestimate cooling and overheating. Change 1 alone raises overheating by 21 %: calm hours lose less heat
by day as well as by night. Change 2 lowers it, and change 3 raises it slightly. The window diagnostic below shows
that change 1 is the main cause of the warm bias in the box, and that about half of the bias disappears when the
box gets Room Clima's recessed, framed windows. Study 2 tests the changes in Room Clima's own rooms. The peak heating loads of the simplified model sit 1 to 16 % above the reference range.
Room Clima does not report peak loads.

## Study 2: Room Clima's rooms, as the app runs them (`room-types/`)

**Base cases.** Room Clima's rooms, run free-running and heated, in two sets of climates:
- **Calibration**: the six weather files bundled in the app, Mannheim (TMYx 2007-2021), Bologna, San Francisco,
  Phoenix, Dubai, Ho Chi Minh City. Change 3 was chosen against EnergyPlus in these climates on 24 October 2026.
  432 rooms.
- **Held out**: the eight climates of Study 1 that played no part in that choice: Miami, Tampa, New Delhi, Denver,
  Chicago, Montreal, Vancouver, Yellowknife. 576 rooms. The app reads the reference weather files (`lib/epw.js`), and
  EnergyPlus reads them back as the app holds them (`weather/files/app_<climate>.epw`).

In each set:

| Item | Values |
|---|---|
| Use | office (4.05 × 5 × 3 m, weekdays 07:00 to 18:00, 21 °C heating); dwelling (4 × 5 × 2.6 m, all hours, 20 °C heating) |
| Room | cellular (one facade); corner (two facades); corner on the top floor (two facades and a roof) |
| Facade | south and west |
| Designs | six per group, drawn by `Sweep.designs(6, 16)` to cover every option level, listed below |

| Design | Window share | Wall U | Glazing U / g | Mass | Fixed shading | Blind | Day airing | Night airing | Roof |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 0.20 | 0.24 | 1.3 / 0.60 | medium | frame 0.5 m | interior | none | none | standard |
| 1 | 0.50 | 0.10 | 0.8 / 0.45 | light | none | exterior | side-hung | tilt | cool |
| 2 | 0.20 | 0.10 | 1.3 / 0.45 | medium | overhang 0.5 m | none | none | none | cool |
| 3 | 0.80 | 0.15 | 0.8 / 0.30 | light | fins 0.5 m | none | tilt | across storeys | standard |
| 4 | 0.65 | 0.15 | 0.8 / 0.60 | heavy | none | exterior | tilt | tilt | standard |
| 5 | 0.35 | 0.24 | 1.3 / 0.30 | very heavy | overhang 1.0 m | interior | side-hung | across storeys | cool |

The six designs cover every level of every option but not every combination: designs 0 and 2 share medium mass and
no airing, designs 1 and 4 share the exterior blind and tilted windows at night. Results split by a single option
would mix the effects of several options, so they are reported by climate, use and room position only.

**How EnergyPlus sees the same room.** Constructions, windows, frame, wall reveal and outdoor shading are those of the
app. The app's own hourly operation is imposed on EnergyPlus:
- the air change of the window openings (EN 16798-7, single-sided, wind off; CEN, 2017) plus base air;
- the blind state of each window (switchable glazing: SHGC g × F_C, and U with the blind's added resistance);
- the internal gains, 100 % convective as in DIN 4108-2.

The comparison therefore isolates the room physics. The airflow model of the openings is not compared. Interior
surfaces facing other rooms are adiabatic, modelled in EnergyPlus as mirrored constructions. Ceilings split into an
exposed part and a part under a suspended ceiling are modelled as two strips.

**Each change on these rooms.** `replay.js` runs each variant of the engine on the same rooms with the same hourly
operation that EnergyPlus receives. With all four changes the replay reproduces the app's own run within 0.1 K hourly
RMSE in every room.

**Measures.** Hourly operative temperature, free-running (RMSE and bias, app minus EnergyPlus); occupied degree-hours
above 26 °C and heating need, as a deviation of the total; within each group of six designs (same climate, use, room
position and facade), the Spearman rank correlation, whether both name the same best design, and the decision
regret: the EnergyPlus result of the app's choice minus that of EnergyPlus's own choice.

**Results** (`room-types/results.md`):

| Set | Rooms | Hourly RMSE | Bias | Degree-hours above 26 °C | Heating need | Rank correlation, overheating | Same least-overheating design |
|---|---|---|---|---|---|---|---|
| Calibration | 432 | 0.69 K | −0.49 K | −8 % | +7 % | 0.982 | 68 of 72 |
| Held out | 576 | 0.75 K | −0.45 K | −11 % | +4 % | 0.981 | 95 of 96 |

- **Regret, overheating.** In the 4 calibration groups where the choices differ (all in San Francisco), EnergyPlus
  gives the app's choice 4 to 71 K·h more above 26 °C, 32 K·h on average, 1 to 7 % of the spread between the best and
  the worst of the six designs. In the one held-out group (Vancouver, dwelling, cellular, south), 22 K·h, 1 % of the
  spread.
- **Heating.** Rank correlation 0.984 (calibration, 45 groups with heating) and 0.981 (held out, 78 groups); same
  lowest-heating design in 43 of 45 and 69 of 78 groups. Where they differ, the app's choice needs 0.5 and 0.1 kWh/m²a
  more heating on average, at most 1.0 kWh/m²a.
- **By climate.** Overheating is underestimated by 7 to 14 % in hot climates and by up to 53 % in mild ones, where the
  totals are small (San Francisco: 720 K·h per room in EnergyPlus). Montreal has the largest hourly scatter (RMSE
  1.13 K, bias −0.22 K); Bologna dwellings facing west the largest bias (about −1 K).

Each change on these rooms (`replay.js`):

| Engine | Hourly RMSE, calibration | Hourly RMSE, held out | Bias, held out | Same least-overheating design, calibration / held out |
|---|---|---|---|---|
| EN ISO 52016-1 as written | 0.79 K | 0.88 K | −0.59 K | 65 of 72 / 95 of 96 |
| + (1) wind-driven convection | 0.85 K | 0.93 K | −0.70 K | 65 / 95 |
| + (2) angle-dependent transmission | 0.81 K | 0.89 K | −0.61 K | 65 / 95 |
| + (3) sun on opaque surfaces only | 0.76 K | 0.85 K | −0.54 K | 65 / 95 |
| + (4) sky over √F_sky | 0.73 K | 0.82 K | −0.49 K | 67 / 95 |
| Room Clima, (1) to (4) | 0.69 K | 0.75 K | −0.45 K | 68 / 95 |

**What this means.** The app ranks designs as EnergyPlus does, in the climates where its settings were chosen and in
eight climates where they were not; this is what its recommendations rest on. Where it picks a different design,
the loss is small against the differences between designs. The changes help in the held-out climates as much as in
the calibration climates, so they are not fitted to those six weather files. Change 1 alone makes the rooms cooler and
worse; it improves the result only together with the others. Absolute overheating is somewhat optimistic, by about
0.5 K. This matters most for the DIN 4108-2 check in mild climates, where the limit is reached by few degree-hours. The
bias is known and stated in the app.

## Window diagnostic: why the box runs warm (`window-diagnostic/`)

The free-floating cases 600FF and 900FF in 14 climates, with six window geometries from flush (Standard 140) to
recessed and framed (Room Clima), in EnergyPlus and in all six variants of the engine. Results and method:
`window-diagnostic/README.md`.

- EnergyPlus keeps 96 to 98 % of the transmitted sun on opaque surfaces in every geometry. Change 3 raises overheating
  by only 1 to 2 points; the earlier explanation, that sun leaves the box through its flush windows, does not hold.
- Change 1 is the main cause of the warm bias: +12 to +14 points of overheating, +0.57 to +0.86 K, in every geometry.
- Behind a reveal the app lets 5 to 7 % less summer sun through than EnergyPlus. With Room Clima's window, the warm
  bias with all four changes falls from +1.05 K to +0.44 K: the window geometry explains about half of the difference
  between box and rooms.
- Neither model counts sun absorbed on window frames in the room study.

## Limits
- Model against model: no measured room. Outside Denver the reference is one programme, EnergyPlus.
- The calibration and held-out sets share rooms and designs; they differ in climate only.
- One zone. Neighbouring rooms are at the same temperature (adiabatic). No ground contact.
- The airflow through open windows (EN 16798-7) is not compared here. The same air change is given to both models.
- Glazing transmission by angle (change 2) uses one curve, from EnergyPlus's double clear glazing, for all glazing types.
- Sun absorbed on the outside of window frames is ignored by the app; the room study sets the EnergyPlus frames to
  absorb none, so it does not test this. In the test box with Room Clima's windows, a frame absorptance of 0.6 adds
  7 % overheating in EnergyPlus.
- The DIN 4108-2 check in the app uses the bundled weather. A formal proof uses the DWD test reference year (Bundesinstitut für Bau-,
  Stadt- und Raumforschung, 2017).

## How to rerun
```
python3 weather/fetch.py && node weather/app_epw.js
cd thermal/engine && python3 cases.py && python3 ep_run.py && node js_run.js && python3 analyse.py
cd ../room-types && node dump.js && SET=holdout node dump.js
python3 ep_run.py && SET=holdout python3 ep_run.py
node replay.js && SET=holdout node replay.js && python3 analyse.py
cd ../window-diagnostic && python3 diag_cases.py && python3 diag_ep.py && node diag_js.js && python3 diag_analyse.py
```
EnergyPlus 25.2.0 (build cf7368216c), run through the EnergyPlus library of the `pyenergyplus-lbnl` 25.2.0 package
(Wang, n.d.) with the input data dictionary of EnergyPlus 25.2.0 from its source; any EnergyPlus 25.2 executable will do
(`EPLUS=/path/to/energyplus`). Node 22; Python 3.13 with numpy, pandas, scipy. On two cores the engine study takes
about 5 minutes and the room studies about 45 minutes.

The runs of 21 November 2026 with EnergyPlus 24.2.0 (build 94a887817b) gave the same EnergyPlus results to the
reported precision: `engine/history/results_ep24.2_21nov.md`, `room-types/history/results_ep24.2_21nov.md`.
`room-types/history/` also keeps the run of 19 November 2026 (three climates, the earlier Mannheim weather file).

## References
<!-- refs: iso52016 crawley2001 ashrae140 usdoe2024 usdoe2025 pyenergyplus cen673 din4108 wetter2014 modelica_bestest ashrae140b wilcox2008 cen16798_7 bbsr2017 walton1983 -->

ASHRAE. (2020a). *ANSI/ASHRAE Standard 140-2020: Method of test for evaluating building performance simulation software*. American Society of Heating, Refrigerating and Air-Conditioning Engineers.

ASHRAE. (2023). *Addendum b to ANSI/ASHRAE Standard 140-2020* [Software acceptance criteria]. American Society of Heating, Refrigerating and Air-Conditioning Engineers.

Bundesinstitut für Bau-, Stadt- und Raumforschung. (2017). *Ortsgenaue Testreferenzjahre von Deutschland für mittlere, extreme und zukünftige Witterungsverhältnisse*. BBSR; Deutscher Wetterdienst.

CEN. (2011). *EN 673:2011 Glass in building: Determination of thermal transmittance (U value): Calculation method*. European Committee for Standardization.

CEN. (2017). *EN 16798-7:2017 Energy performance of buildings: Ventilation for buildings: Part 7: Calculation methods for the determination of air flow rates in buildings including infiltration (Module M5-5)*. European Committee for Standardization.

Crawley, D. B., Lawrie, L. K., Winkelmann, F. C., Buhl, W. F., Huang, Y. J., Pedersen, C. O., Strand, R. K., Liesen, R. J., Fisher, D. E., Witte, M. J., & Glazer, J. (2001). EnergyPlus: Creating a new-generation building energy simulation program. *Energy and Buildings, 33*(4), 319–331. https://doi.org/10.1016/S0378-7788(00)00114-6

DIN. (2013). *DIN 4108-2:2013-02 Wärmeschutz und Energie-Einsparung in Gebäuden: Teil 2: Mindestanforderungen an den Wärmeschutz*. Beuth.

ISO. (2017). *ISO 52016-1:2017 Energy performance of buildings: Energy needs for heating and cooling, internal temperatures and sensible and latent heat loads: Part 1: Calculation procedures*. International Organization for Standardization.

Lawrence Berkeley National Laboratory. (2024). *Modelica Buildings library, package Buildings.ThermalZones.Detailed.Validation.BESTEST* (Version 11.1.0) [Computer software]. https://simulationresearch.lbl.gov/modelica

U.S. Department of Energy. (2024). *EnergyPlus version 24.2 documentation: Engineering reference; Auxiliary programs*. https://energyplus.net/documentation

U.S. Department of Energy. (2025). *EnergyPlus version 25.2 documentation: Engineering reference*. https://energyplus.net/documentation

Walton, G. N. (1983). *Thermal analysis research program reference manual* (NBSIR 83-2655). National Bureau of Standards.

Wang, T. (n.d.). *pyenergyplus_lbnl: Standalone Python package of the EnergyPlus API* (Version 25.2.0) [Computer software]. Lawrence Berkeley National Laboratory. https://github.com/taoning/pyenergyplus

Wetter, M., Zuo, W., Nouidui, T. S., & Pang, X. (2014). Modelica Buildings library. *Journal of Building Performance Simulation, 7*(4), 253–270. https://doi.org/10.1080/19401493.2013.765506

Wilcox, S., & Marion, W. (2008). *Users manual for TMY3 data sets* (NREL/TP-581-43156). National Renewable Energy Laboratory.
