// Writes the six weather files bundled in Room Clima (and Micro Clima) to EPW, so that EnergyPlus and Radiance read
// exactly the weather the app uses. Fields the app does not keep are filled with EPW missing codes; global horizontal
// radiation is recomputed from direct normal and diffuse radiation. Output: weather/files/app_<city>.epw
const fs = require('fs'), path = require('path'), H = require('../lib/app.js'), { WX } = require('../lib/paths.js'), { writeEpw } = require('../lib/epw.js');
fs.mkdirSync(WX, { recursive: true });
const slug = (n) => n.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
for (const rec of H.WX) { const f = path.join(WX, `app_${slug(rec.name)}.epw`); writeEpw(H.wx(rec.name), rec, f); console.log(path.basename(f)); }
