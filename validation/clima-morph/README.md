# Clima Morph: the exported weather file

**What is checked.** Clima Morph writes the future climate and the urban heat island into a weather file that other
programs can read. Its hourly values come from the shared core (`shared/climamods.js`, `prepWeather`), whose models are
checked in [future climate](../future-climate/) and [urban heat island](../urban-heat-island/). This study checks the
writing: that the file carries exactly those values, that everything else is copied unchanged, and that EnergyPlus and
Ladybug read it.

**Result in short.**
- Present climate and as recorded: the file comes back byte for byte unchanged, in all four climates.
- Round trip: a morphed file read back with Macro Clima's reader matches the core's own morphed weather to within the
  file's rounding in every hour: 0.05 °C dry bulb and dew point, 0.5 % relative humidity, 0.5 W/m² sky infrared.
- Future climate holds relative humidity exactly; the heat island holds dew point exactly. No dew point lies above
  the dry bulb. All other fields are unchanged.
- EnergyPlus 24.2 runs a full year on all 12 morphed files without severe errors and without new warnings about the
  weather file; Ladybug reads all 12 with 8,760 hours.
- A month's mean change differs from its IPCC Atlas value by up to 0.11 K. The whole difference comes from the linear
  blending of the monthly change between mid-month points (`dailyFromMonthly`): the applied hourly change is that
  blend and nothing else.

## Base cases
Four weather files bundled with Macro Clima, chosen for range: Berlin-Tegel (temperate), Cairo (hot desert), Singapore
Changi (tropical), Moscow-Bibirevo (continental). Three settings each:

| Case | Future climate | Urban context |
|---|---|---|
| `fut2` | +2 °C | as recorded |
| `urban` | present | urban (sky view factor 0.60, vegetation fraction 0.20) |
| `fut3_dense` | +3 °C | dense (sky view factor 0.40, vegetation fraction 0.10) |

## What the file must hold
| Field (1-based) | Variable | Written | Precision |
|---|---|---|---|
| 7 | dry-bulb temperature | future climate and heat island | 0.1 °C |
| 8 | dew point | future climate (relative humidity held) | 0.1 °C |
| 9 | relative humidity | heat island (dew point held) | 1 % |
| 13 | horizontal infrared radiation from the sky | future climate | 1 W/m² |
| 34 | precipitation depth | future climate, where above 0 | as the source, at least 0.1 mm |

Every other field is copied unchanged, and a value missing in the source stays missing. Header: `DESIGN CONDITIONS,0`
in place of the design conditions; ground temperatures raised by the annual mean future warming; the provenance in
COMMENTS 2, without commas; all eight header lines in their order. The EPW format follows the EnergyPlus auxiliary
programs documentation (U.S. Department of Energy, 2024).

## Results
| File | Case | Identity | Dry bulb, max °C | Dew point, max °C | RH, max % | Sky infrared, max W/m² | Monthly mean vs Atlas, max K | Format |
|---|---|---|--:|--:|--:|--:|--:|---|
| Berlin-Tegel | fut2 | yes | 0.050 | 0.050 | 0.00 | 0.50 | 0.063 | ok |
| Berlin-Tegel | urban | yes | 0.050 | 0.000 | 0.50 | 0.00 | – | ok |
| Berlin-Tegel | fut3_dense | yes | 0.050 | 0.050 | 0.50 | 0.50 | 0.090 | ok |
| Cairo | fut2 | yes | 0.050 | 0.050 | 0.00 | 0.50 | 0.035 | ok |
| Cairo | urban | yes | 0.050 | 0.000 | 0.50 | 0.00 | – | ok |
| Cairo | fut3_dense | yes | 0.050 | 0.050 | 0.50 | 0.50 | 0.052 | ok |
| Singapore Changi | fut2 | yes | 0.050 | 0.050 | 0.00 | 0.50 | 0.021 | ok |
| Singapore Changi | urban | yes | 0.050 | 0.000 | 0.50 | 0.00 | – | ok |
| Singapore Changi | fut3_dense | yes | 0.050 | 0.050 | 0.50 | 0.50 | 0.014 | ok |
| Moscow-Bibirevo | fut2 | yes | 0.050 | 0.050 | 0.00 | 0.50 | 0.076 | ok |
| Moscow-Bibirevo | urban | yes | 0.050 | 0.000 | 0.50 | 0.00 | – | ok |
| Moscow-Bibirevo | fut3_dense | yes | 0.050 | 0.050 | 0.50 | 0.50 | 0.106 | ok |

The maxima are differences between the file read back and the core's hourly values, over all 8,760 hours; they are
the rounding of the file and nothing more. Full results, with the monthly values: `results.json`.

**EnergyPlus.** The example file `1ZoneUncontrolled.idf`, a full year, run on each source file and each morphed file
(`eplus_results.json`). All runs complete with 0 severe errors. The warnings about the example's own Denver location and
design days appear in every run. EnergyPlus's psychrometric iterations fail to converge in a few hours, in the source
files as in the morphed ones (Moscow: 3 hours in the source; 2 hours in the +2 °C file, in different hours); the check
reports these and fails only on other new warnings. **Ladybug** (ladybug-core; Sadeghipour Roudsari & Pak, 2013) reads
every morphed file, with 8,760 hours.

## Assumptions and limits
- Only hourly files. In a leap-year file the 24 hours of 29 February take the hourly changes of 28 February, since
  the core works on 365 days.
- Sky infrared under the future climate is scaled with air temperature alone, as the core does on 27 November 2026.
  A rise in sky emissivity with the moister air (Clark & Allen, 1978) is decided and will follow in the core, with the
  future-climate validation rerun.
- The typical and extreme periods in the header were chosen on the present climate and are kept.

## How to rerun
```
node validation/clima-morph/check.js /tmp/morphout                       # identity, round trip, format, physics, monthly means
python3 validation/clima-morph/eplus_check.py <EnergyPlus 24.2 folder> /tmp/morphout   # needs ladybug-core for the Ladybug read
```
Run on 27 November 2026 with Node.js 22, EnergyPlus 24.2.0 (build 94a887817b) and ladybug-core 0.45.4.

## References
<!-- refs: belcher2005 theeuwes2017 clark1978 usdoe2024 roudsari2013 -->

Belcher, S. E., Hacker, J. N., & Powell, D. S. (2005). Constructing design weather data for future climates. *Building Services Engineering Research and Technology, 26*(1), 49–61. https://doi.org/10.1191/0143624405bt112oa

Clark, G., & Allen, C. P. (1978). The estimation of atmospheric radiation for clear and cloudy skies. In *Proceedings of the 2nd National Passive Solar Conference* (pp. 675–678). AS/ISES.

Sadeghipour Roudsari, M., & Pak, M. (2013). Ladybug: A parametric environmental plugin for Grasshopper to help designers create an environmentally-conscious design. In *Proceedings of BS2013: 13th Conference of the International Building Performance Simulation Association*, Chambéry, France. IBPSA.

Theeuwes, N. E., Steeneveld, G. J., Ronda, R. J., & Holtslag, A. A. M. (2017). A diagnostic equation for the daily maximum urban heat island effect for cities in northwestern Europe. *International Journal of Climatology, 37*(1), 443–454. https://doi.org/10.1002/joc.4717

U.S. Department of Energy. (2024). *EnergyPlus version 24.2 documentation: Engineering reference; Auxiliary programs*. https://energyplus.net/documentation
