# Clima Compare: two files side by side

**What is checked.** Clima Compare computes no climate figure of its own: it runs Macro Clima's code on each of two
weather files, then aligns, subtracts and describes. This study checks that layer: that each file's figures are Macro
Clima's, that the differences behave as differences must, that solar time and the season shift move the hours where
they should, and that the written reading points to the right numbers. The models themselves are checked in
[climate reading](../climate-reading/), [future climate](../future-climate/) and
[urban heat island](../urban-heat-island/).

**Result in short.**
- Identity with Macro Clima: for Berlin-Tegel as recorded and Cairo at +2 °C in an urban context, 123 figures (key
  figures, strategy zone hours, monthly temperatures) equal Macro Clima's own CSV downloads within their rounding
  (0.005).
- Self comparison: Berlin against Berlin gives zero in all 100 difference cells, and the reading says the files are
  the same.
- Swap: exchanging A and B changes the sign of all 100 difference cells and nothing else.
- Solar time: in all six files tested the sun's height centres on 12:00 solar time within 0.002 h; annual totals are
  unchanged.
- Season shift: a southern twin of Berlin lines up with Berlin hour by hour once shifted (0 of 8,760 hours differ);
  annual figures do not move.
- Reading: all 41 numbers link to an existing card; every number linked to the key figures appears in that table.

## Base cases
Weather files bundled with Macro Clima. Identity: Berlin-Tegel (as recorded) and Cairo (+2 °C, urban: sky view factor
0.60, vegetation fraction 0.20), the second case exercising both modifiers. Self comparison, swap and reading:
Berlin-Tegel and Cairo. Solar time: Madrid, Mumbai, Shanghai, Berlin-Tegel, Mexico City and Singapore, in which solar noon falls between
0.1 h before and 1.3 h after clock noon (annual mean).

No bundled file lies south of the equator. The season test therefore builds a southern twin of Berlin: the data
columns rolled forward by 182 days, the latitude in the header negated, the date columns unchanged. Its weather is
Berlin's, half a year apart; once the shift moves it back, both files must agree in every hour.

## Method
`verify.py` runs both apps in headless Chrome (Playwright) on the repository served locally.

1. **Identity.** Macro Clima is loaded with the same file and settings, and its CSV downloads of the key figures, the
   strategy zones and the monthly temperatures are read. The same values are taken from Clima Compare's processed file.
   Pass: every difference within 0.005, the rounding of Macro Clima's CSV.
2. **Self comparison.** The same file as A and B; every card drawn. Pass: every B − A cell is zero.
3. **Swap.** Berlin as recorded against Cairo at +2 °C, urban; every card drawn, A and B swapped, every card drawn
   again. Pass: each B − A cell changes sign and nothing else. (Swapping fixes the comfort model, which otherwise
   follows file B.)
4. **Solar time.** For each file, the mean daily course of the sun's height (from the shared sun position, at the
   middle of each file hour) is moved to solar time with the app's own conversion. Pass: its centroid lies within
   0.05 h of 12:00, and the annual sum of global radiation is unchanged within 0.1 %.
5. **Season shift.** Berlin against its southern twin, with the switch off and on. Pass: off, nothing is shifted;
   on, the southern file is shifted, every hour of its temperature matches Berlin's, the warmest month falls in the
   same place, and its annual mean is unchanged.
6. **Reading.** Pass: every linked number points to an existing card; every number linked to the key figures appears
   in that table's text.

## Results
`results.json` holds every value. Identity: largest difference 0.005 for both files (62 and 61 values). Solar time,
centroid of the sun's height in solar time: 12.000 h (Madrid), 12.002 h (Mumbai), 12.000 h (Shanghai), 11.999 h
(Berlin), 12.002 h (Mexico City), 11.999 h (Singapore).

**Timing within the files.** For information, the test also records where each file's own radiation centres. In the
TMYx files the extraterrestrial horizontal radiation centres on 11:30 solar time when each hour is taken at its
midpoint; in the Singapore file (a custom file) it centres on 12:00. The producers of the TMYx files thus compute it
half an hour earlier than the apps' convention. Measured global radiation centres between 11:21 and 12:29 solar time,
which reflects both this timing and the daily course of cloud. Clima Compare, like Macro Clima, keeps each file's
values as they are and places them at the middle of the hour.

## Macro Clima unchanged
To let Clima Compare draw the strategy zones without copying code, the function that outlines them moved from Macro
Clima's page code (`macro/app.js`) to its shared section code (`macro/sections.js`). Every card of Macro Clima was
drawn before and after the move for Berlin-Tegel and Cairo, and the resulting pages compared: identical.

## Rerun
```
python3 -m http.server 8765            # from the repository root
python3 validation/clima-compare/verify.py [path to Chrome]
```
