# Future and urban climate: method

## A shared module
Future and Urban Climate is a shared module used by Macro Clima, Micro Clima, Room Clima and Clima Morph. It applies the same
climate adjustments consistently across all of them. Clima Morph writes the adjusted weather into an EPW file for other
simulation tools. Clima Map is the exception: it helps select and download the original weather file but does not modify it.

The module provides two ways to adjust a weather file: to account for future global warming and to represent the
additional heat associated with the urban environment.

Both modifiers are calculated centrally in Macro Clima (`macro/core.js`) and shared with the other apps through the
calculation core `shared/climamods.js`, produced by `shared/mkmods.py`. Room Clima and Micro Clima both embed this
generated core, and Clima Morph loads it directly, so all four give identical results.

## What it is for
A typical-year weather file describes recent climatic conditions at a particular location, usually an open site such
as an airport. But a building designed today will operate in a warmer climate, and most buildings stand within
cities, where the surrounding urban fabric adds further heat.

These two modifiers make it possible to explore both effects directly in the design process, without requiring a
separate climate study.

## Future climate

**Warming levels, not future years.** The weather file is adjusted to represent +1.5, +2 or +3 °C of global warming
above the pre-industrial period (1850–1900). These are warming levels, not projections for specific calendar years.

The timing of each warming level depends on future emissions, while regional climate changes at a given level depend
much less on the pathway taken to reach it. This approach follows the IPCC Sixth Assessment Report (AR6) Atlas (Gutiérrez et al., 2021; Iturbide et al.,
2021).

### How it works
The calculation follows five steps:

1. **Identify the region.** The latitude and longitude of the weather file are used to identify the corresponding
   IPCC AR6 reference region (Iturbide et al., 2020), prioritising land regions.
2. **Establish the file's reference period.** The middle year of the period represented by the typical weather file
   is identified from its comments (Period of Record) or filename (TMYx.YYYY-YYYY). If neither is available, 2010 is
   assumed.
3. **Calculate the climate change.** For each month, the calculation uses the median change across 35 CMIP6 climate
   models (Eyring et al., 2016), comparing the 1995–2014 baseline with the 20-year period around the year each model reaches the selected
   warming level. All four SSP scenarios are included. The 10th and 90th percentiles show the range of model results.
4. **Account for warming already present.** The warming that has already occurred between the 1995–2014 baseline and
   the middle year of the weather file is subtracted. Older weather files therefore receive a larger adjustment than
   more recent ones.
5. **Adjust the weather file.** Using the morphing method of Belcher et al. (2005), monthly temperature changes are
   interpolated between mid-month values and applied day by day. Relative humidity is held constant, allowing dew
   point and absolute humidity to increase with temperature. Sky infrared radiation is scaled by the fourth power of
   the absolute temperature ratio (T'/T)⁴, while precipitation is adjusted according to the monthly percentage change.

### Assumptions
- **One adjustment for the whole file.** The typical months are assumed to represent the full period from which the
  weather file was constructed.
- **Changes in the mean, not in variability.** The adjustment shifts temperatures but does not stretch or compress
  their daily range. The day-night temperature swing and the variability of hot and cold spells remain as recorded in
  the original file. The IPCC Atlas provides changes in mean climate conditions, not equivalent changes in daily
  extremes.

### Limits
The morphing method preserves the original sequence of weather conditions. It therefore cannot reproduce the timing,
duration or intensity of future heat waves, and may underestimate future extreme heat.

The climate changes are based on regional land averages. Coastal and mountain locations may experience different
changes from the regional mean.

## Urban heat island

### How it works
The urban heat island modifier estimates the additional warming associated with the built environment. It uses the
diagnostic equation proposed by Theeuwes et al. (2017):

<p align="center">UHI<sub>max</sub> = (2 − SVF − F<sub>veg</sub>) × (S × DTR³ / U)<sup>1/4</sup></p>

The calculation combines two characteristics of the neighbourhood, the sky view factor (SVF) and vegetation fraction
(F<sub>veg</sub>), with three daily weather conditions from the weather file: solar radiation (S), diurnal temperature
range (DTR) and wind speed (U).

The resulting maximum daily heat island is distributed across the hours of the day and added to the original air
temperature. Vapour pressure is held constant.

### Assumptions
**Which day a value belongs to.** Theeuwes et al. (2017) define the heat island per day, but not over a calendar day. Daily solar radiation (S) is the mean over the calendar day, from 00:00 to 24:00. The diurnal temperature range (DTR) and the mean wind speed (U) are taken over the 24 hours from 08:00 to 07:00 the next morning, as in the original study. The resulting UHI<sub>max</sub> applies to the same window: the day's sun builds the heat island, and it is released in the evening and night that follow. The first hours of the file, before 08:00 on 1 January, take the value of 31 December. Global radiation is rebuilt from the file's direct normal and diffuse radiation. Wind below 0.5 m/s is set to 0.5 m/s, to keep the equation finite in calm conditions.

**Daily temperature profile.** The original equation gives only the daily maximum. Observed urban heat islands are strongest at night and weak by day, because the city stores heat during the day and releases it after sunset (Oke, 1982). The apps follow this pattern with their own profile. With the sun below the horizon, the full value applies. During daylight it decreases with the sun's altitude:

<p align="center">UHI(h) = UHI<sub>max</sub> × (1 − 0.85 × √(sin α<sub>h</sub> / sin α<sub>max</sub>))</p>

where α<sub>h</sub> is the sun's altitude at the middle of hour h and α<sub>max</sub> is the highest altitude that day. At solar noon 15% of the maximum remains. The square root lets the heat island fall quickly after sunrise and recover late in the afternoon. On days when the sun stays very low, sin α<sub>max</sub> is held at no less than 0.05. The profile, its 15% midday floor and its shape are assumptions made for the apps. They are not taken from the original paper and have not been fitted to measurements.

**What changes in the weather data.** The hourly heat island is added to the air temperature. Vapour pressure is held, so dew point and humidity ratio stay as recorded and relative humidity falls, limited to between 1% and 100%. Sky longwave radiation, solar radiation and wind are not changed.

**Neighbourhood presets.** Three representative urban conditions are available, defined by their sky view factor and
vegetation fraction:

| Setting | SVF | Vegetation |
|---|--:|--:|
| Suburban | 0.8 | 0.35 |
| Urban | 0.6 | 0.2 |
| Dense urban | 0.4 | 0.1 |

### Limits
The original equation was developed using data from 14 cities in north-western Europe. Its calibration covers sky
view factors from 0.2 to 0.9 and vegetation fractions up to 0.4. Applying it outside these geographical and parameter
ranges is an extrapolation, which the apps explicitly flag.

The result represents an average neighbourhood heat island, not the conditions of an individual street, courtyard or
outdoor space. These more local effects, including shading, ground materials and wind shelter, are explored in Micro
Clima.

## Validation
Both modifiers are checked against their cited reference data and models, rather than against direct measurements of
future or urban conditions.

Future climate adjustments are checked against IPCC Atlas data, official reference regions and the pyepwmorph
implementation of weather-file morphing (McCarty, n.d.): see [future climate](../../validation/future-climate/).

The urban heat island calculation is checked against an independent implementation of the diagnostic equation
published by Theeuwes et al. (2017): see [urban heat island](../../validation/urban-heat-island/).

## References
<!-- refs: gutierrez2021 iturbide2021 iturbide2020 eyring2016 belcher2005 theeuwes2017 oke1982 mccarty -->

Belcher, S. E., Hacker, J. N., & Powell, D. S. (2005). Constructing design weather data for future climates. *Building Services Engineering Research and Technology, 26*(1), 49–61. https://doi.org/10.1191/0143624405bt112oa

Eyring, V., Bony, S., Meehl, G. A., Senior, C. A., Stevens, B., Stouffer, R. J., & Taylor, K. E. (2016). Overview of the Coupled Model Intercomparison Project Phase 6 (CMIP6) experimental design and organization. *Geoscientific Model Development, 9*(5), 1937–1958. https://doi.org/10.5194/gmd-9-1937-2016

Gutiérrez, J. M., Jones, R. G., Narisma, G. T., Alves, L. M., Amjad, M., Gorodetskaya, I. V., Grose, M., Klutse, N. A. B., Krakovska, S., Li, J., Martínez-Castro, D., Mearns, L. O., Mernild, S. H., Ngo-Duc, T., van den Hurk, B., & Yoon, J.-H. (2021). Atlas. In V. Masson-Delmotte et al. (Eds.), *Climate change 2021: The physical science basis. Contribution of Working Group I to the Sixth Assessment Report of the Intergovernmental Panel on Climate Change* (pp. 1927–2058). Cambridge University Press. https://doi.org/10.1017/9781009157896.021

Iturbide, M., Fernández, J., Gutiérrez, J. M., Bedia, J., Cimadevilla, E., Díez-Sierra, J., Manzanas, R., Casanueva, A., Baño-Medina, J., Milovac, J., Herrera, S., Cofiño, A. S., San Martín, D., García-Díez, M., Hauser, M., Huard, D., & Yelekçi, Ö. (2021). *Repository supporting the implementation of FAIR principles in the IPCC-WGI Atlas* (Version v2.0-final) [Computer software]. Zenodo. https://doi.org/10.5281/zenodo.5171760

Iturbide, M., Gutiérrez, J. M., Alves, L. M., Bedia, J., Cerezo-Mota, R., Cimadevilla, E., Cofiño, A. S., Di Luca, A., Faria, S. H., Gorodetskaya, I. V., Hauser, M., Herrera, S., Hennessy, K., Hewitt, H. T., Jones, R. G., Krakovska, S., Manzanas, R., Martínez-Castro, D., Narisma, G. T., … Vera, C. S. (2020). An update of IPCC climate reference regions for subcontinental analysis of climate model data: Definition and aggregated datasets. *Earth System Science Data, 12*(4), 2959–2970. https://doi.org/10.5194/essd-12-2959-2020

McCarty, J. (n.d.). *pyepwmorph* (Version 3.6.1) [Computer software]. https://github.com/justinfmccarty/pyepwmorph

Oke, T. R. (1982). The energetic basis of the urban heat island. *Quarterly Journal of the Royal Meteorological Society, 108*(455), 1–24. https://doi.org/10.1002/qj.49710845502

Theeuwes, N. E., Steeneveld, G. J., Ronda, R. J., & Holtslag, A. A. M. (2017). A diagnostic equation for the daily maximum urban heat island effect for cities in northwestern Europe. *International Journal of Climatology, 37*(1), 443–454. https://doi.org/10.1002/joc.4717
