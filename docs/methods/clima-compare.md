# Clima Compare: method

## What it is for
Setting two climates side by side, so that design experience from one can be carried to the other, or its limits seen.

Clima Compare reads two weather files: A, the climate the reader knows, and B, the climate being designed for. Three
kinds of comparison use the same app: two places; two files of the same place (two periods of a station, or two
sources for one city); and a climate analogue, a place today against another place, or itself, at a level of global
warming. Clima Compare adds no climate model of its own. For each file it gives the figures Macro Clima gives for that
file with the same settings; it only aligns the two files, subtracts and describes.

## How it works
**Reading the files.** Each file is read with Macro Clima's reader and processed by Macro Clima's own code
(`macro/core.js`, `processWeather`), and its summary figures come from the same function Macro Clima uses
(`macro/sections.js`, `summarise`). Future climate and urban heat island are applied per file through the shared core
(`shared/climamods.js`, `prepWeather`), as described in [Future and urban climate](climate-scenarios.md). Nothing is
copied: Clima Compare loads Macro Clima's files. Sun position follows NOAA (n.d.) after Meeus (1998); irradiation on
surfaces Perez et al. (1990); outdoor comfort the UTCI (Bröde et al., 2012); adaptive comfort EN 16798-1 (CEN, 2019),
its German annex (DIN, 2021) or ASHRAE 55 (ASHRAE, 2020); strategy zones Givoni (1992) and Milne and Givoni (1979)
with the Climate Consultant criteria (Milne, n.d.); driving rain ISO 15927-3 (ISO, 2009).

**Differences.** Every difference is B − A, in the unit of the figure; temperature differences are in kelvin, shares
in percentage points. Two charts of the same variable share one scale. Hour-by-hour differences are drawn on a
diverging scale that spans the 98th percentile of the absolute difference.

**Solar time.** Charts by hour of the day use local apparent solar time, so that noon is the sun's highest point in
both files whatever their time zones. For each day, the offset from local standard time is the equation of time plus
four minutes per degree of longitude from the time zone's meridian, from the shared sun position code. Each file hour
is taken at its midpoint, as in Macro Clima; the value at the centre of each solar hour is interpolated linearly
between the two neighbouring file hours (wind direction takes the nearest hour). Annual and monthly figures are
computed on clock hours and do not change.

**Season shift.** An optional switch shows one file 182 days later. If the two files lie on opposite sides of the
equator, the southern one moves, so that summer meets summer. If both lie on the same side, file B moves, so that each
season of A meets the opposite season of B. The shift moves the hours on the calendar of the charts only: annual
totals and counts stay as they are, and seasonal figures always use each file's own seasons. Month labels follow the
calendar of the file that does not move.

**The reading.** The written reading at the top follows fixed rules, and every number in it links to the card it
comes from. It answers four questions in order. How different are the two climates overall: Köppen-Geiger class,
annual mean temperature, the 1st and 99th percentiles, solar radiation on the horizontal, hours with a dew point above
18 °C. What is the main design problem of B against A: a climate is dominated by heating when heating degree days make
up more than three quarters of heating and cooling degree days together, by cooling when they make up less than a
quarter, and mixed otherwise; the façade with the most summer irradiation; the winter irradiation of the façade facing
the equator. Which passive strategies carry over: for each strategy zone, B's hours against A's; a strategy keeps its
weight between 70 % and 160 % of A's hours, covers far fewer hours below 70 %, and matters more above 160 % or when A
has fewer than 500 hours and B at least 500; strategies under 500 hours in both files are left out. When in the year
the two are closest and furthest apart: the months with the smallest and largest difference of mean temperature. When
both files describe the same place (within 0.05° of latitude and longitude), the text speaks of file A and file B. The
reading never says which climate is better.

## Assumptions
One comfort model, one set of degree-day bases and one set of strategy-zone criteria apply to both files, so that hours
compare. By default the comfort model follows file B: the German annex for German stations, EN 16798-1 category II
elsewhere in Europe, ASHRAE 55 at 80 % acceptability in the rest of the world. The place name in the reading is the
station's name without suffixes such as "Airport".

## Limits
Differences between two files include differences between their data sets and their years, as well as between the
climates; the app lists both and notes where they differ, but does not correct for them. Solar time uses each file
hour's midpoint, which is the convention of the apps; files whose producers centre radiation differently within the
hour (most TMYx files carry an extraterrestrial radiation centred half an hour earlier) keep that offset in the solar
time charts. The season shift is a fixed 182 days, so a month moved by it is not exactly a calendar month of the other
file.

## Validation
For each file the figures equal Macro Clima's for the same settings; a file compared with itself gives zero in every
difference; swapping A and B changes the sign of every difference and nothing else; the sun's height centres on 12:00
solar time in every bundled file; and the season shift lines up a southern twin of Berlin with Berlin hour by hour:
see [Clima Compare](../../validation/clima-compare/).

## References
<!-- refs: noaa meeus1998 perez1990 brode2012 cen16798_1 dinNA ashrae55 givoni1992 milne1979 milneCC iso15927_3 -->

ASHRAE. (2020b). *ANSI/ASHRAE Standard 55-2020: Thermal environmental conditions for human occupancy*. American Society of Heating, Refrigerating and Air-Conditioning Engineers.

Bröde, P., Fiala, D., Błażejczyk, K., Holmér, I., Jendritzky, G., Kampmann, B., Tinz, B., & Havenith, G. (2012). Deriving the operational procedure for the Universal Thermal Climate Index (UTCI). *International Journal of Biometeorology, 56*(3), 481–494. https://doi.org/10.1007/s00484-011-0454-1

CEN. (2019). *EN 16798-1:2019 Energy performance of buildings: Ventilation for buildings: Part 1: Indoor environmental input parameters for design and assessment of energy performance of buildings addressing indoor air quality, thermal environment, lighting and acoustics (Module M1-6)*. European Committee for Standardization.

DIN. (2021). *E DIN EN 16798-1/NA:2021-06 Nationaler Anhang: Nationale Ergänzungen und Hinweise zur Anwendung: Energetische Bewertung von Gebäuden: Lüftung von Gebäuden: Teil 1* [Draft standard, withdrawn]. Beuth.

Givoni, B. (1992). Comfort, climate analysis and building design guidelines. *Energy and Buildings, 18*(1), 11–23. https://doi.org/10.1016/0378-7788(92)90047-K

ISO. (2009). *ISO 15927-3:2009 Hygrothermal performance of buildings: Calculation and presentation of climatic data: Part 3: Calculation of a driving rain index for vertical surfaces from hourly wind and rain data*. International Organization for Standardization.

Meeus, J. (1998). *Astronomical algorithms* (2nd ed.). Willmann-Bell.

Milne, M. (n.d.). *Climate Consultant* (Version 6) [Computer software]. UCLA Energy Design Tools Group. https://www.sbse.org/resources/climate-consultant

Milne, M., & Givoni, B. (1979). Architectural design based on climate. In D. Watson (Ed.), *Energy conservation through building design* (pp. 96–113). McGraw-Hill.

NOAA Global Monitoring Laboratory. (n.d.). *NOAA solar calculator*. https://gml.noaa.gov/grad/solcalc/

Perez, R., Ineichen, P., Seals, R., Michalsky, J., & Stewart, R. (1990). Modeling daylight availability and irradiance components from direct and global irradiance. *Solar Energy, 44*(5), 271–289. https://doi.org/10.1016/0038-092X(90)90055-H
