# Validation of the Clima Toolbox tools

Every model in the apps is checked against an established tool, an open reference implementation, a published test or
an exact solution. Each folder holds a report (`README.md`) with the base cases, the assumptions, the reference and the
results; the scripts that produce them; and the result files they write. Every study can be rerun from this folder.

| Model | Used by | Reference | Result | Folder |
|---|---|---|---|---|
| Hourly room model (EN ISO 52016-1 with four changes) | Room Clima | ASHRAE Standard 140-2020 (ASHRAE, 2020a); EnergyPlus 25.2 (Crawley et al., 2001) in 14 climates | Standard 140: 32 of 44 within range (EnergyPlus 43, the standard as written 33); heating 4.8 %, cooling 12.7 % from the reference median | `thermal/` |
| Room Clima's rooms with their operation | Room Clima | EnergyPlus 25.2: 432 rooms in the 6 climates where the settings were chosen, 576 rooms in 8 held-out climates | hourly RMSE 0.69 K and 0.75 K, bias about −0.5 K; same ranking (0.98), same best design in 68 of 72 and 95 of 96 groups; regret at most 71 K·h, 7 % of the spread of the designs | `thermal/` |
| Daylight with and without blinds | Room Clima | Radiance (Ward, 1994), 6 rooms × 6 climates | useful daylight within 2.9 points in all 108 cases; mean +1.0 (no blind), +0.3 (interior), −0.9 (exterior) | `daylight/` |
| Climate reading: sun, surfaces, psychrometrics, UTCI, adaptive comfort | Macro Clima | pvlib (Holmgren et al., 2018), psychrolib (Meyer & Thevenard, 2019), pythermalcomfort (Tartarini & Schiavon, 2020) | sun within 0.02°; surfaces within 0.2 %; psychrometrics and UTCI identical | `climate-reading/` |
| Future climate | Macro, Micro, Room Clima | IPCC AR6 Atlas data (Iturbide et al., 2021); official regions (Iturbide et al., 2020); pyepwmorph (McCarty, n.d.) after Belcher et al. (2005) | table within 0.05 K on average; region 99.99 %; morphing equal on the annual mean, dew point within 0.01 K | `future-climate/` |
| Urban heat island | Macro, Micro, Room Clima | Theeuwes et al. (2017), independent implementation | identical within 0.0001 K; the three apps share one implementation | `urban-heat-island/` |
| Exported weather file | Clima Morph | the shared core's hourly values read back; EnergyPlus 24.2 (U.S. Department of Energy, 2024); Ladybug (Sadeghipour Roudsari & Pak, 2013) | file within its rounding (0.05 °C, 0.5 %, 0.5 W/m²) in every hour; unchanged fields byte for byte; EnergyPlus and Ladybug read all 12 files | `clima-morph/` |
| Outdoor comfort | Micro Clima | pvlib, pythermalcomfort, exact solutions; Ladybug Tools (Sadeghipour Roudsari & Pak, 2013) | UTCI identical, SolarCal within 0.06 K; sun within 0.02°; ranking of 70 designs 0.97 against Ladybug | `outdoor-comfort/` |

## Shared calculation core
Since 21 November 2026 Macro, Micro and Room Clima (and, from 27 November 2026, Clima Morph) compute sun position, sun on surfaces (Perez et al., 1990), psychrometrics,
SolarCal, sky longwave (file data, or Clark and Allen (1978) where missing), UTCI (inputs outside the polynomial's range held at
its edge), future climate and the urban heat island with the same code, `shared/climamods.js`, copied verbatim from
Macro Clima. The studies it affects (thermal, room types, daylight, climate reading, outdoor comfort, urban heat island)
were rerun on that code on 21 November 2026; the future-climate code itself did not change.

## Known limits
- Future climate: the shipped table differs from the reconstructed calculation by 0.05 K on average and up to about
  0.5 K in single months; monthly mean shifts are up to 0.18 K off after morphing, entirely from the blending of the monthly change between mid-month points (confirmed in `clima-morph/`); sky infrared rises by 10.4 W/m²
  where pyepwmorph gives 12.8 W/m². Corrections are under review.
- Room Clima's hourly model is set for its own rooms: in the Standard 140 test box it reaches 32 of 44 ranges and
  overestimates cooling by 12.7 %. In its rooms the settings hold in eight climates not used to choose them.
- Not yet checked independently: the Givoni-Milne strategy zones of Macro Clima, and the German national annex comfort
  band (DIN EN 16798-1/NA), for which no open reference exists.
- Daylight blinds are modelled as a diffusing layer; the angle dependence of venetian slats is not modelled.

Verification checks that the code computes the model it claims to. Validation compares the model with another
established model. Neither compares the tools with measured buildings or outdoor spaces; that is beyond the scope of
these studies.

## Software
- EnergyPlus 25.2.0 (build cf7368216c) (U.S. Department of Energy, 2025), through `pyenergyplus-lbnl` 25.2.0 (Wang, n.d.);
  EnergyPlus 24.2.0 for the runs before 21 November 2026, which 25.2 reproduces
- Radiance 6.0a (as shipped with pyradiance 1.3.1; Lawrence Berkeley National Laboratory, n.d.)
- Node.js 22
- Python 3.13 with numpy, pandas, scipy, pvlib 0.16.1, pythermalcomfort 4.8.1, ladybug-comfort 0.19.18, pyepwmorph
  3.6.1, psychrolib 2.5.0, shapely 2.2

## Running
```
python3 weather/fetch.py && node weather/app_epw.js        # reference weather files
export EPLUS=/path/to/energyplus WORK=/tmp/clima-validation  # optional; WORK defaults to validation/_work
```
Then follow "How to rerun" in each folder. `lib/app.js` loads the built Room Clima engine (`room/build/worker.js`), so
build Room Clima first (`python3 room/build.py`).

## Runs
All results were produced on 20 November 2026 and, for the studies affected by the shared core, again on 21 November
2026, with the code at the commit that adds them. The thermal studies were rerun later on 21 November 2026 with
EnergyPlus 25.2, the standard as written without the sky treatment of EnergyPlus, each change tested on its own, and
the held-out climates added. Earlier runs, on earlier versions, are kept in `history/` folders where they were
published.

## References
<!-- refs: ashrae140 crawley2001 usdoe2025 pyenergyplus ward1994 holmgren2018 meyer2019 tartarini2020 iturbide2021 iturbide2020 mccarty belcher2005 theeuwes2017 roudsari2013 perez1990 clark1978 usdoe2024 pyradiance -->

ASHRAE. (2020a). *ANSI/ASHRAE Standard 140-2020: Method of test for evaluating building performance simulation software*. American Society of Heating, Refrigerating and Air-Conditioning Engineers.

Belcher, S. E., Hacker, J. N., & Powell, D. S. (2005). Constructing design weather data for future climates. *Building Services Engineering Research and Technology, 26*(1), 49–61. https://doi.org/10.1191/0143624405bt112oa

Clark, G., & Allen, C. P. (1978). The estimation of atmospheric radiation for clear and cloudy skies. In *Proceedings of the 2nd National Passive Solar Conference* (pp. 675–678). AS/ISES.

Crawley, D. B., Lawrie, L. K., Winkelmann, F. C., Buhl, W. F., Huang, Y. J., Pedersen, C. O., Strand, R. K., Liesen, R. J., Fisher, D. E., Witte, M. J., & Glazer, J. (2001). EnergyPlus: Creating a new-generation building energy simulation program. *Energy and Buildings, 33*(4), 319–331. https://doi.org/10.1016/S0378-7788(00)00114-6

Holmgren, W. F., Hansen, C. W., & Mikofski, M. A. (2018). pvlib python: A python package for modeling solar energy systems. *Journal of Open Source Software, 3*(29), 884. https://doi.org/10.21105/joss.00884

Iturbide, M., Fernández, J., Gutiérrez, J. M., Bedia, J., Cimadevilla, E., Díez-Sierra, J., Manzanas, R., Casanueva, A., Baño-Medina, J., Milovac, J., Herrera, S., Cofiño, A. S., San Martín, D., García-Díez, M., Hauser, M., Huard, D., & Yelekçi, Ö. (2021). *Repository supporting the implementation of FAIR principles in the IPCC-WGI Atlas* (Version v2.0-final) [Computer software]. Zenodo. https://doi.org/10.5281/zenodo.5171760

Iturbide, M., Gutiérrez, J. M., Alves, L. M., Bedia, J., Cerezo-Mota, R., Cimadevilla, E., Cofiño, A. S., Di Luca, A., Faria, S. H., Gorodetskaya, I. V., Hauser, M., Herrera, S., Hennessy, K., Hewitt, H. T., Jones, R. G., Krakovska, S., Manzanas, R., Martínez-Castro, D., Narisma, G. T., … Vera, C. S. (2020). An update of IPCC climate reference regions for subcontinental analysis of climate model data: Definition and aggregated datasets. *Earth System Science Data, 12*(4), 2959–2970. https://doi.org/10.5194/essd-12-2959-2020

Lawrence Berkeley National Laboratory. (n.d.). *pyradiance: Python interface for Radiance* (Version 1.3.1) [Computer software]. https://github.com/LBNL-ETA/pyradiance

McCarty, J. (n.d.). *pyepwmorph* (Version 3.6.1) [Computer software]. https://github.com/justinfmccarty/pyepwmorph

Meyer, D., & Thevenard, D. (2019). PsychroLib: A library of psychrometric functions to calculate thermodynamic properties of air. *Journal of Open Source Software, 4*(33), 1137. https://doi.org/10.21105/joss.01137

Perez, R., Ineichen, P., Seals, R., Michalsky, J., & Stewart, R. (1990). Modeling daylight availability and irradiance components from direct and global irradiance. *Solar Energy, 44*(5), 271–289. https://doi.org/10.1016/0038-092X(90)90055-H

Sadeghipour Roudsari, M., & Pak, M. (2013). Ladybug: A parametric environmental plugin for Grasshopper to help designers create an environmentally-conscious design. In *Proceedings of BS2013: 13th Conference of the International Building Performance Simulation Association*, Chambéry, France. IBPSA.

Tartarini, F., & Schiavon, S. (2020). pythermalcomfort: A Python package for thermal comfort research. *SoftwareX, 12*, 100578. https://doi.org/10.1016/j.softx.2020.100578

Theeuwes, N. E., Steeneveld, G. J., Ronda, R. J., & Holtslag, A. A. M. (2017). A diagnostic equation for the daily maximum urban heat island effect for cities in northwestern Europe. *International Journal of Climatology, 37*(1), 443–454. https://doi.org/10.1002/joc.4717

U.S. Department of Energy. (2024). *EnergyPlus version 24.2 documentation: Engineering reference; Auxiliary programs*. https://energyplus.net/documentation

U.S. Department of Energy. (2025). *EnergyPlus version 25.2 documentation: Engineering reference*. https://energyplus.net/documentation

Wang, T. (n.d.). *pyenergyplus_lbnl: Standalone Python package of the EnergyPlus API* (Version 25.2.0) [Computer software]. Lawrence Berkeley National Laboratory. https://github.com/taoning/pyenergyplus

Ward, G. J. (1994). The RADIANCE lighting simulation and rendering system. In *Proceedings of the 21st Annual Conference on Computer Graphics and Interactive Techniques (SIGGRAPH '94)* (pp. 459–472). ACM. https://doi.org/10.1145/192161.192286
