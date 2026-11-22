# Room types: the app against EnergyPlus

Free-running hourly operative temperature (app minus EnergyPlus): RMSE, mean bias, difference of the annual maximum. Occupied degree-hours above 26 °C and heating need: app against EnergyPlus as a percentage of the total, with the EnergyPlus mean per case in brackets.

| Group | Cases | Hourly RMSE | Bias | Annual maximum | Degree-hours above 26 °C | Heating need |
|---|---|---|---|---|---|---|
| all | 432 | 0.69 K | -0.49 K | -0.94 K | -8% (21833 K·h) | +7% (11.9 kWh/m²) |
| wx=mannheim | 72 | 0.61 K | -0.34 K | -0.91 K | -23% (2396 K·h) | +5% (36.3 kWh/m²) |
| wx=bologna | 72 | 0.91 K | -0.58 K | -0.89 K | -14% (8710 K·h) | +6% (26.9 kWh/m²) |
| wx=san_francisco | 72 | 0.63 K | -0.48 K | -1.02 K | -53% (720 K·h) | +14% (6.4 kWh/m²) |
| wx=phoenix | 72 | 0.72 K | -0.58 K | -0.95 K | -8% (34521 K·h) | +26% (1.8 kWh/m²) |
| wx=dubai | 72 | 0.67 K | -0.51 K | -1.03 K | -7% (45998 K·h) | n/a (0.0 kWh/m²) |
| wx=ho_chi_minh_city | 72 | 0.60 K | -0.45 K | -0.82 K | -8% (38652 K·h) | n/a (0.0 kWh/m²) |
| use=office | 216 | 0.61 K | -0.37 K | -0.91 K | -9% (11490 K·h) | +5% (14.9 kWh/m²) |
| use=dwelling | 216 | 0.76 K | -0.61 K | -0.97 K | -8% (32175 K·h) | +9% (8.9 kWh/m²) |
| sc=cellular | 144 | 0.64 K | -0.44 K | -0.69 K | -7% (21605 K·h) | +6% (6.8 kWh/m²) |
| sc=corner | 144 | 0.74 K | -0.57 K | -0.97 K | -10% (22438 K·h) | +7% (12.6 kWh/m²) |
| sc=corner_top | 144 | 0.69 K | -0.46 K | -1.15 K | -8% (21455 K·h) | +6% (16.2 kWh/m²) |
| blind=none | 144 | 0.65 K | -0.45 K | -0.73 K | -6% (27530 K·h) | +7% (12.1 kWh/m²) |
| blind=interior | 144 | 0.77 K | -0.56 K | -1.01 K | -9% (21504 K·h) | +8% (15.8 kWh/m²) |
| blind=exterior | 144 | 0.64 K | -0.47 K | -1.07 K | -11% (16465 K·h) | +3% (7.9 kWh/m²) |
| day=0 | 144 | 0.76 K | -0.50 K | -0.92 K | -6% (33846 K·h) | +7% (11.9 kWh/m²) |
| day=1 | 144 | 0.64 K | -0.47 K | -0.96 K | -10% (18791 K·h) | +5% (10.5 kWh/m²) |
| day=2 | 144 | 0.67 K | -0.51 K | -0.93 K | -13% (12862 K·h) | +7% (13.4 kWh/m²) |
| night=0 | 144 | 0.76 K | -0.50 K | -0.92 K | -6% (33846 K·h) | +7% (11.9 kWh/m²) |
| night=1 | 144 | 0.64 K | -0.47 K | -1.07 K | -11% (16465 K·h) | +3% (7.9 kWh/m²) |
| night=5 | 144 | 0.67 K | -0.51 K | -0.82 K | -10% (15188 K·h) | +8% (16.0 kWh/m²) |
| mass=light | 144 | 0.63 K | -0.52 K | -0.81 K | -10% (17010 K·h) | +7% (11.6 kWh/m²) |
| mass=medium | 144 | 0.76 K | -0.50 K | -0.92 K | -6% (33846 K·h) | +7% (11.9 kWh/m²) |
| mass=heavy | 72 | 0.65 K | -0.43 K | -1.23 K | -11% (18246 K·h) | -1% (6.7 kWh/m²) |
| mass=vheavy | 72 | 0.72 K | -0.50 K | -0.94 K | -14% (11040 K·h) | +7% (17.7 kWh/m²) |

## Ranking of the six designs in each group (same climate, use, room type, facade)

- Overheating: rank correlation 0.982 on average, lowest 0.829 (72 groups); same least-overheating design in 68 of 72 groups
- Heating need: rank correlation 0.978 on average, lowest 0.775 (50 groups with heating); same lowest-heating design in 69 of 72 groups
- Heated runs: hourly operative temperature RMSE 0.56 K

## Largest hourly differences

- bologna_dwelling_corner_top_270_2: RMSE 1.48 K, bias -0.92 K; blind none, day airing 0, night airing 0, mass medium, window 0.2
- bologna_dwelling_cellular_270_5: RMSE 1.48 K, bias -0.87 K; blind interior, day airing 2, night airing 5, mass vheavy, window 0.35
- bologna_dwelling_corner_270_0: RMSE 1.47 K, bias -1.24 K; blind interior, day airing 0, night airing 0, mass medium, window 0.2
- bologna_dwelling_cellular_270_0: RMSE 1.39 K, bias -0.95 K; blind interior, day airing 0, night airing 0, mass medium, window 0.2
- bologna_dwelling_corner_270_2: RMSE 1.38 K, bias -0.97 K; blind none, day airing 0, night airing 0, mass medium, window 0.2
