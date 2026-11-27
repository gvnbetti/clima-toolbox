# Methods

## Background

Buildings have always been about protecting people and adapting to climate. Understanding the relationship between a
building and its climate, a city and its climate, and ultimately anything we build and the climate it stands in,
should be one of the foundations of design. Not the only one, but a fundamental one. It matters even more now: the
energy used to heat and cool buildings is a major driver of global emissions, while the climate in which buildings
stand is changing.

In practice, climate-adaptive and bioclimatic design are still often treated as specialist tasks, requiring
specialised software and knowledge.

CBE Clima (Betti et al., 2024) was born from the idea that climate data should be easy to access and easy to understand, without
specialised tools or expertise. The aim was to lower the barrier to entry. Clima Toolbox follows the same ethos,
builds on that experience, and takes it a step further.

Clima Map and Macro Clima extend what CBE Clima set out to do: make weather files accessible and climate data easy to
read. Three things are built into them from the start:

- **Future climate.** Every weather file can be explored under +1.5, +2 and +3 °C of global warming.
- **Comparison.** Every climate reading can be understood in relation to other climates.
- **The city.** Weather files are usually recorded at airports or in open country, while many of the buildings we
  design stand in cities. Urban modifiers bring the climate data closer to the actual conditions of the place being
  designed.

Micro Clima and Room Clima take this a step further. They work as design recommendation systems, running thousands of
what-if scenarios to identify which combinations of a few key parameters can create more comfortable outdoor and
indoor environments.

Making something easy to access does not mean making it simpler than it needs to be. A considerable amount of
mathematics runs underneath these apps, and we try to be as transparent about it as possible. That is the purpose of
the methods and validation pages. Some assumptions are self-evident; others are there for expert users to question and
challenge. All the tools are free to use and free to inspect, in the hope that others will help us make them better.

## The five apps

**Clima Map** finds the most appropriate weather file for a given location.

**Clima Morph** writes the future and urban climate into the weather file itself, so that the same conditions can be
carried into other simulation tools.

**Macro Clima** helps understand the climate: comfort, sun, wind, sky and rain, and the design strategies that respond
to them. It explores present conditions, future warming and the influence of the city.

**Micro Clima** explores how design choices shape the outdoor environment, testing the effects of shade, ground
materials, wind protection and enclosure.

**Room Clima** explores the relationship between a room and its facade, testing windows, glazing, shading, thermal mass
and ventilation, and their effects on energy use, comfort, daylight and carbon.

## Principles

### Designed for the early stages
The apps focus on the information available at the beginning of a project: a location, a type of space, a few
dimensions and a set of design options. When details are not yet known, they use clearly stated typical values rather
than requiring information that may not exist yet.

### Explore alternatives, not predict outcomes
The apps compare design options under the same climate conditions and assumptions. The differences between
alternatives are generally more reliable than any single absolute result. The tools are designed primarily to help
understand these differences and support informed design decisions.

### Performance against fixed targets
Results are measured against fixed thresholds drawn from established standards and guidance, such as comfort ranges,
overheating limits and daylight requirements. They are never measured against the best-performing option in a
particular run. If a design does not meet a target, it is shown as such, regardless of how it compares with the
alternatives.

### Open about assumptions
Every assumption is documented, with its unit, source and status: standard, secondary source, design decision or
assumption. Room Clima brings these into a single register, while Macro Clima and Micro Clima document them in their
respective guides. Placeholder values are explicitly identified.

### Established models, independently checked
The apps build on published scientific models and methods, including EN ISO 52016-1 (ISO, 2017), Perez (Perez et al., 1990), UTCI (Bröde et al., 2012),
Theeuwes (Theeuwes et al., 2017), the IPCC AR6 Atlas (Gutiérrez et al., 2021) and Radiance's sky model (Perez et al.,
1993; Ward, 1994). Their results are checked against established simulation tools used in the field,
including EnergyPlus (Crawley et al., 2001), Radiance (Ward, 1994), pvlib (Holmgren et al., 2018),
pythermalcomfort (Tartarini & Schiavon, 2020) and Ladybug (Sadeghipour Roudsari & Pak, 2013). These comparisons are model-to-model validations,
rather than comparisons with measured building performance. See [Validation](../../validation/) for details.

### Everything runs in the browser
There is nothing to install, and weather files remain on the user's computer. All calculations run directly in the
browser. The underlying models are kept compact and transparent, so that their assumptions and methods can be
inspected.

## Method pages

| Page | Content |
|---|---|
| [Clima Map](clima-map.md) | weather station catalogue, place search, choice of file |
| [Clima Morph](clima-morph.md) | writing the future and urban climate into a valid EPW file |
| [Macro Clima](macro-clima.md) | sun, surfaces, psychrometrics, comfort, strategies, derived readings |
| [Future and urban climate](climate-scenarios.md) | morphing to levels of global warming; urban heat island (shared by Macro, Micro, Room Clima and Clima Morph) |
| [Micro Clima](micro-clima.md) | ground and wall heat balance, radiant exchange, trees and canopies, enclosures, UTCI |
| [Room Clima](room-clima.md) | hourly room model, ventilation, blinds, comfort, daylight, scores, scenarios |
| [Room Clima: carbon](room-clima-carbon.md) | whole-life carbon of the design options |

Each page has the same parts: what the app is for, how it works, assumptions, limits, and its validation.

## References
<!-- refs: betti2023 iso52016 perez1990 brode2012 theeuwes2017 gutierrez2021 perez1993 ward1994 crawley2001 holmgren2018 tartarini2020 roudsari2013 -->

Betti, G., Tartarini, F., Nguyen, C., & Schiavon, S. (2024). CBE Clima Tool: A free and open-source web application for climate analysis tailored to sustainable building design. *Building Simulation, 17*(3), 493–508. https://doi.org/10.1007/s12273-023-1090-5

Bröde, P., Fiala, D., Błażejczyk, K., Holmér, I., Jendritzky, G., Kampmann, B., Tinz, B., & Havenith, G. (2012). Deriving the operational procedure for the Universal Thermal Climate Index (UTCI). *International Journal of Biometeorology, 56*(3), 481–494. https://doi.org/10.1007/s00484-011-0454-1

Crawley, D. B., Lawrie, L. K., Winkelmann, F. C., Buhl, W. F., Huang, Y. J., Pedersen, C. O., Strand, R. K., Liesen, R. J., Fisher, D. E., Witte, M. J., & Glazer, J. (2001). EnergyPlus: Creating a new-generation building energy simulation program. *Energy and Buildings, 33*(4), 319–331. https://doi.org/10.1016/S0378-7788(00)00114-6

Gutiérrez, J. M., Jones, R. G., Narisma, G. T., Alves, L. M., Amjad, M., Gorodetskaya, I. V., Grose, M., Klutse, N. A. B., Krakovska, S., Li, J., Martínez-Castro, D., Mearns, L. O., Mernild, S. H., Ngo-Duc, T., van den Hurk, B., & Yoon, J.-H. (2021). Atlas. In V. Masson-Delmotte et al. (Eds.), *Climate change 2021: The physical science basis. Contribution of Working Group I to the Sixth Assessment Report of the Intergovernmental Panel on Climate Change* (pp. 1927–2058). Cambridge University Press. https://doi.org/10.1017/9781009157896.021

Holmgren, W. F., Hansen, C. W., & Mikofski, M. A. (2018). pvlib python: A python package for modeling solar energy systems. *Journal of Open Source Software, 3*(29), 884. https://doi.org/10.21105/joss.00884

ISO. (2017). *ISO 52016-1:2017 Energy performance of buildings: Energy needs for heating and cooling, internal temperatures and sensible and latent heat loads: Part 1: Calculation procedures*. International Organization for Standardization.

Perez, R., Ineichen, P., Seals, R., Michalsky, J., & Stewart, R. (1990). Modeling daylight availability and irradiance components from direct and global irradiance. *Solar Energy, 44*(5), 271–289. https://doi.org/10.1016/0038-092X(90)90055-H

Perez, R., Seals, R., & Michalsky, J. (1993). All-weather model for sky luminance distribution: Preliminary configuration and validation. *Solar Energy, 50*(3), 235–245. https://doi.org/10.1016/0038-092X(93)90017-I

Sadeghipour Roudsari, M., & Pak, M. (2013). Ladybug: A parametric environmental plugin for Grasshopper to help designers create an environmentally-conscious design. In *Proceedings of BS2013: 13th Conference of the International Building Performance Simulation Association*, Chambéry, France. IBPSA.

Tartarini, F., & Schiavon, S. (2020). pythermalcomfort: A Python package for thermal comfort research. *SoftwareX, 12*, 100578. https://doi.org/10.1016/j.softx.2020.100578

Theeuwes, N. E., Steeneveld, G. J., Ronda, R. J., & Holtslag, A. A. M. (2017). A diagnostic equation for the daily maximum urban heat island effect for cities in northwestern Europe. *International Journal of Climatology, 37*(1), 443–454. https://doi.org/10.1002/joc.4717

Ward, G. J. (1994). The RADIANCE lighting simulation and rendering system. In *Proceedings of the 21st Annual Conference on Computer Graphics and Interactive Techniques (SIGGRAPH '94)* (pp. 459–472). ACM. https://doi.org/10.1145/192161.192286
