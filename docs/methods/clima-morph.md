# Clima Morph: method

## What it is for
Carrying the future and urban climate of the toolbox into other simulation tools.

Clima Morph applies the two climate modifiers shared by Macro, Micro and Room Clima to a weather file, and returns a
complete EPW file that EnergyPlus, Ladybug, Honeybee and other programs can read. It adds no model of its own: a file
morphed here, read back in Macro Clima as recorded, gives the same hours as Macro Clima's own future and urban settings,
to within the file's rounding.

## How it works
**Reading the file.** The weather file is read with Macro Clima's reader. Hourly EPW files are accepted, or a ZIP
holding one, as downloaded from Clima Map. The file stays in the browser.

**Changing the weather.** The hourly values come from the shared calculation core (`shared/climamods.js`): first the
future climate, then the urban heat island on top, as described in [Future and urban climate](climate-scenarios.md).
Under the future climate, relative humidity is held and dew point recomputed (Belcher et al., 2005). Under the heat
island, dew point is held and relative humidity recomputed (Theeuwes et al., 2017).

**Writing the file.** The source file is copied and only these fields are rewritten (EPW field numbers as in the
EnergyPlus documentation; U.S. Department of Energy, 2024):

| Field | Variable | Changed by | Precision |
|---|---|---|---|
| 7 | dry-bulb temperature | future climate and heat island | 0.1 °C |
| 8 | dew point | future climate | 0.1 °C |
| 9 | relative humidity | heat island | 1 % |
| 13 | horizontal infrared radiation from the sky | future climate | 1 W/m² |
| 34 | precipitation depth | future climate | as the source, at least 0.1 mm |

Solar radiation, wind, pressure, cloud and dates are copied unchanged. A value missing in the source stays missing.
A dew point never lies above the dry-bulb temperature after rounding.

**The header.** The design conditions describe the present climate, so they are removed; the line stays as
`DESIGN CONDITIONS,0`, which keeps the eight header lines every program expects. The ground temperatures are raised by
the annual mean future warming; the heat island does not change them. The typical and extreme periods are kept as
they were chosen on the present climate. The second comment line records what was done: the toolbox version, the
warming level, the IPCC region, the file's years, the neighbourhood and the fields changed and kept. It is written
without commas, since some programs split comment lines at commas. The file name records the settings, for example
`…_+2C_urban.epw`.

## Assumptions
In a leap-year file, the 24 hours of 29 February take the hourly changes of 28 February, since the core works on 365
days. Files with more than one record per hour are not supported.

## Limits
The limits of the two modifiers apply to the file: the sequence of weather is that of the recorded years, so future heat
waves are not made longer or stronger; the heat island is a neighbourhood average calibrated in north-western Europe;
sun, wind and cloud are not changed. Sky infrared under the future climate is scaled with air temperature alone; a rise
in sky emissivity with the moister air (Clark & Allen, 1978) is planned in the shared core.

## Validation
The file read back matches the core within its rounding in every hour, unchanged fields are copied byte for byte, and
EnergyPlus and Ladybug read every morphed file: see [Clima Morph](../../validation/clima-morph/).

## References
<!-- refs: belcher2005 theeuwes2017 clark1978 usdoe2024 -->

Belcher, S. E., Hacker, J. N., & Powell, D. S. (2005). Constructing design weather data for future climates. *Building Services Engineering Research and Technology, 26*(1), 49–61. https://doi.org/10.1191/0143624405bt112oa

Clark, G., & Allen, C. P. (1978). The estimation of atmospheric radiation for clear and cloudy skies. In *Proceedings of the 2nd National Passive Solar Conference* (pp. 675–678). AS/ISES.

Theeuwes, N. E., Steeneveld, G. J., Ronda, R. J., & Holtslag, A. A. M. (2017). A diagnostic equation for the daily maximum urban heat island effect for cities in northwestern Europe. *International Journal of Climatology, 37*(1), 443–454. https://doi.org/10.1002/joc.4717

U.S. Department of Energy. (2024). *EnergyPlus version 24.2 documentation: Engineering reference; Auxiliary programs*. https://energyplus.net/documentation
