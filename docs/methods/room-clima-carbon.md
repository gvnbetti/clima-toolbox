# Room Clima: how carbon is calculated

## What it measures
Room Clima compares design options by their whole-life carbon over a 50-year study period, expressed per m² of floor
area.

It counts only the impacts that change between the options: the embodied carbon of elements added or removed,
including their replacements, and the operational carbon associated with the energy used by the room.

The structure, floors, partitions and building services shared by all options are excluded. The result is therefore a
comparative assessment of alternative designs for the same room, not a whole-building LCA.

Code: `carbonOf` in `room/src/core.js`. Data: the `carbon.*` entries in `room/src/register.js`.

All embodied-carbon values are generic assumptions. They should be replaced with project-specific data or, where
available, product and assembly data from the Build-up LCA datasets, including ÖKOBAUDAT (Bundesministerium für Wohnen, Stadtentwicklung und Bauwesen, n.d.-b).

## Calculation
<p align="center">Whole-life carbon = embodied carbon of the design options + operational carbon over 50 years</p>

The study period is 50 years, following the reference study period used by BNB (Bundesministerium für Wohnen, Stadtentwicklung und
Bauwesen, n.d.-a) and DGNB (Deutsche Gesellschaft für Nachhaltiges Bauen, n.d.).

**Replacement cycles.** An element with a service life of L years is counted according to the number of times it is
installed during the study period: ⌈50 / L⌉.

**Operational carbon.** Delivered energy is multiplied by an assumed electricity-grid factor of 0.25 kg CO₂e/kWh and by
the 50-year study period.

The factor represents an assumed average over the study period, not today's grid intensity. Germany's electricity mix
was approximately 0.41 kg CO₂e/kWh in 2024, including upstream emissions (Icha & Lauf, 2026). The lower factor reflects the expected decarbonisation of electricity
generation. It can be changed in the app.

## Embodied carbon of design options

| Element | Embodied carbon | Service life | Measured on |
|---|---|---|---|
| Window with frame, double glazing | 55 kg CO₂e/m² | 40 years | Window area |
| Window with frame, triple glazing | 75 kg CO₂e/m² | 40 years | Window area |
| Solar-control coating (g-value ≤ 0.3) | +3 kg CO₂e/m² | With window | Window area |
| Opaque wall | 45 kg CO₂e/m² + 0.42 per cm of insulation (14, 24 or 36 cm, depending on U-value level) | 50 years | Wall area excluding windows |
| Exterior motorised venetian blind | 40 kg CO₂e/m² | 25 years | Window area |
| Interior textile blind | 6 kg CO₂e/m² | 15 years | Window area |
| Overhang, fins or frame | 90 kg CO₂e/m² of projected element | 50 years | Depth × length |
| Thermal mass, relative to light construction | Medium: 15; heavy: 45; very heavy: 60 kg CO₂e/m² | 50 years | Floor area |
| Ceiling fan | 35 kg CO₂e per fan | 15 years | Number of fans |
| Night ventilation, tilt restrictors and actuators | 15 kg CO₂e per facade | 20 years | Number of facades |
| Night ventilation across storeys | 5 kg CO₂e/m² | 20 years | Floor area |

### Cooling equipment by capacity class

Counted only when the room needs cooling. The class follows the design cooling load (the peak exceeded in 1% of the
occupied cooling hours). The values are quantity estimates over 50 years, following the approach of CIBSE TM65 (CIBSE,
2021) for refrigerant leakage, and are to be replaced by system values from CIBSE TM65.4 when available.

| Cooling class | Typical system | Embodied carbon over 50 years | Made up of |
|---|---|---|---|
| Up to 30 W/m² | Cooled slab, water about 18 °C | 14 kg CO₂e/m² floor | PE-X pipes in the slab 5.3 m/m² (1.5), manifolds and distribution (3), plant 0.03 kW/m² at 100 kg CO₂e/kW, three sets in 50 years (9) |
| Up to 50 W/m² | Chilled ceiling, water about 16 °C | 21 kg CO₂e/m² floor | Capillary mats (1.2), connections and distribution (5), plant 0.05 kW/m² (15) |
| Up to 100 W/m² | Chilled beams or fan coils | 87 kg CO₂e/m² floor | Units of 175 kg CO₂e per 10 m², 20-year life (52), pipes and insulation (5), plant (30) |
| Above 100 W/m² | Air conditioning (split or VRF) | 170 kg CO₂e/m² floor | Units 0.15 kW/m² at 200 kg CO₂e/kW, three sets (90), refrigerant R32 at 0.3 kg/kW, GWP 675, 5% leakage a year (77), pipes (3) |

Window area is calculated from the window-to-wall ratio and facade area. A corner room includes both facades. For
overhangs, the projected area is depth multiplied by length; for fins, it is their projection multiplied by height.

The thermal-mass values are the least certain in this dataset and should be treated as indicative.

## Worked example
An office room with one facade, measuring 3.6 × 5.4 m and 3.0 m high. This gives 19.44 m² of floor area and 10.8 m² of
facade area.

The following results are calculated using the current code.

| Element | Design A: 50% window, triple glazing, exterior blind, 0.5 m overhang, medium thermal mass, night tilt ventilation and fans | Design B: 30% window, double glazing, interior blind and heavy thermal mass |
|---|---|---|
| Window | 5.4 m² × 75 × 2 = 810 kg (41.7 kg/m² floor) | 3.24 m² × 55 × 2 = 356 kg (18.3 kg/m² floor) |
| Wall | 5.4 m² × (45 + 0.42 × 24) = 297 kg (15.3 kg/m² floor) | 7.56 m² × (45 + 0.42 × 14) = 385 kg (19.8 kg/m² floor) |
| Blinds | 5.4 m² × 40 × 2 = 432 kg (22.2 kg/m² floor) | 3.24 m² × 6 × 4 = 78 kg (4.0 kg/m² floor) |
| Overhang | 90 × 0.5 × 3.6 = 162 kg (8.3 kg/m² floor) | 0 |
| Thermal mass | 15.0 kg/m² floor | 45.0 kg/m² floor |
| Fans | 35 × 2 × 4 = 280 kg (14.4 kg/m² floor) | 0 |
| Night ventilation | 15 × 3 = 45 kg (2.3 kg/m² floor) | 0 |
| **Embodied carbon** | **119.2 kg CO₂e/m² floor** | **87.1 kg CO₂e/m² floor** |

Operational carbon adds 12.5 kg CO₂e/m² for every 1 kWh/m²a of delivered energy: 0.25 × 50.

At 10 kWh/m²a, this amounts to 125 kg CO₂e/m² over 50 years, comparable in magnitude to the embodied carbon of the
options. A design that saves 2 kWh/m²a therefore avoids approximately 25 kg CO₂e/m² over the study period. This
provides a useful way to compare additional embodied carbon against operational energy savings.

## How carbon influences the recommendation
Carbon is not a performance target and does not contribute to the design score. It is used to distinguish between
designs with otherwise equivalent performance.

Within the same tier, when scores are within 0.01 of each other, the design with lower whole-life carbon is preferred.

A further local search looks for the lowest-carbon design among those meeting every target. This is necessary because
carbon is not one of the main search criteria, and the initial search could otherwise miss a lower-carbon option.

The recommendation therefore prioritises meeting the comfort, energy and daylight requirements, then uses whole-life
carbon to identify the better-performing option among eligible designs.

## References
<!-- refs: oekobaudat bnb dgnb icha2026 cibse_tm65 -->

Bundesministerium für Wohnen, Stadtentwicklung und Bauwesen. (n.d.-a). *Bewertungssystem Nachhaltiges Bauen (BNB)*. https://www.bnb-nachhaltigesbauen.de

Bundesministerium für Wohnen, Stadtentwicklung und Bauwesen. (n.d.-b). *ÖKOBAUDAT*. https://www.oekobaudat.de

CIBSE. (2021). *TM65: Embodied carbon in building services: A calculation methodology*. Chartered Institution of Building Services Engineers.

Deutsche Gesellschaft für Nachhaltiges Bauen. (n.d.). *DGNB System*. https://www.dgnb-system.de

Icha, P., & Lauf, T. (2026). *Entwicklung der spezifischen Treibhausgas-Emissionen des deutschen Strommix in den Jahren 1990–2025* (Climate Change 16/2026). Umweltbundesamt.
