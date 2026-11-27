(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const BASE = "../";
  const KOPPEN = { Af: "tropical rainforest", Am: "tropical monsoon", Aw: "tropical savanna, dry winter", As: "tropical savanna, dry summer", BWh: "hot desert", BWk: "cold desert", BSh: "hot semi-arid", BSk: "cold semi-arid", Csa: "Mediterranean, hot summer", Csb: "Mediterranean, warm summer", Csc: "Mediterranean, cold summer", Cwa: "humid subtropical, dry winter", Cwb: "subtropical highland, dry winter", Cwc: "subtropical highland, cold summer", Cfa: "humid subtropical, no dry season", Cfb: "temperate oceanic", Cfc: "subpolar oceanic", Dsa: "continental, dry hot summer", Dsb: "continental, dry warm summer", Dsc: "continental, dry cool summer", Dsd: "continental, dry summer, very cold winter", Dwa: "continental, dry winter, hot summer", Dwb: "continental, dry winter, warm summer", Dwc: "subarctic, dry winter", Dwd: "subarctic, dry winter, very cold winter", Dfa: "continental, hot summer, no dry season", Dfb: "continental, warm summer, no dry season", Dfc: "subarctic, no dry season", Dfd: "subarctic, very cold winter", ET: "tundra", EF: "ice cap" };
  const GROUPS = [["A", "Tropical"], ["B", "Dry"], ["C", "Temperate"], ["D", "Continental"], ["E", "Polar"], ["N", "Not given"]];
  const grp = (k) => (k && "ABCDE".includes(k[0]) ? k[0] : "N");
  const show = { A: true, B: true, C: true, D: true, E: true, N: true };
  const ICON = {
    macro: '<path d="M10 34A22 22 0 0 1 54 34" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="43" cy="14.95" r="4.5" fill="#d9762b"/><path d="M4 34H60M14 43H50M24 52H40" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
    micro: '<path d="M10 34A22 22 0 0 1 54 34" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="43" cy="14.95" r="4.5" fill="#d9762b"/><path d="M6 56H58M24 48V56M42 49V56" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="41" r="7" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="42" cy="45" r="3" fill="currentColor"/>',
    room: '<path d="M10 34A22 22 0 0 1 54 34" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="43" cy="14.95" r="4.5" fill="#d9762b"/><path d="M50 43V38H14V56H50V51" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
    morph: '<path d="M10 34A22 22 0 0 1 54 34" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="43" cy="14.95" r="4.5" fill="#d9762b"/><path d="M6 56H58M32 50V40M25 46L32 39L39 46" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  $("open").innerHTML = [["morph", "Clima Morph", "morph/index.html"], ["macro", "Macro Clima", "macro/index.html"], ["micro", "Micro Clima", "micro/index.html"], ["room", "Room Clima", "room/build/index.html"]]
    .map(([k, n, p]) => `<a href="${BASE + p}" target="_blank" rel="noopener"><svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">${ICON[k]}</svg>${n}</a>`).join("");

  // ------------------------------------------------------------ map
  const dark = false; // light theme only, as the whole site
  const map = L.map("map", { worldCopyJump: true, minZoom: 2, maxZoom: 16, zoomControl: true }).setView([30, 10], 3);
  // OpenStreetMap standard tiles (no key); toned down to the apps' greys by a CSS filter on the tile pane
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);

  let cat = null, P0 = null, sel = null, selMark = null, probe = null;
  const color = {};
  const readColors = () => GROUPS.forEach(([g]) => (color[g] = css("--k" + g)));

  // all stations drawn on one canvas, redrawn after each move (65,000 points; markers would be too slow)
  const Dots = L.Layer.extend({
    onAdd(m) { this._c = L.DomUtil.create("canvas", "leaflet-zoom-hide"); this._c.style.pointerEvents = "none"; m.getPanes().overlayPane.appendChild(this._c); m.on("moveend zoomend resize viewreset", this.redraw, this); this.redraw(); },
    onRemove(m) { this._c.remove(); m.off("moveend zoomend resize viewreset", this.redraw, this); },
    redraw() {
      if (!cat) return; const m = this._map, c = this._c, size = m.getSize(), d = devicePixelRatio || 1;
      L.DomUtil.setPosition(c, m.containerPointToLayerPoint([0, 0]));
      c.width = size.x * d; c.height = size.y * d; c.style.width = size.x + "px"; c.style.height = size.y + "px";
      const g = c.getContext("2d"), z = m.getZoom(), sc = 256 * 2 ** z, o = m.getPixelBounds().min, W = sc;
      const r = (z < 4 ? 1.6 : z < 6 ? 2.4 : z < 9 ? 3.4 : 4.4) * d;
      g.globalAlpha = z < 5 ? 0.75 : 0.9; g.lineWidth = d; g.strokeStyle = dark ? "rgba(0,0,0,.5)" : "rgba(255,255,255,.85)";
      for (const [gk] of GROUPS) {
        if (!show[gk]) continue; g.fillStyle = color[gk]; g.beginPath();
        for (let i = 0; i < cat.sites.length; i++) {
          if (P0.g[i] !== gk) continue;
          let x = P0.x[i] * sc - o.x; const y = P0.y[i] * sc - o.y;
          if (y < -8 || y > size.y + 8) continue;
          x = ((x % W) + W) % W; // nearest world copy to the left edge, then repeat across the view
          for (; x < size.x + 8; x += W) if (x > -8) { g.moveTo(x * d + r, y * d); g.arc(x * d, y * d, r, 0, 6.2832); }
        }
        g.fill(); if (z >= 6) g.stroke();
      }
    },
  });
  const dots = new Dots();

  function nearestPixel(pt, maxPx) {
    const z = map.getZoom(), sc = 256 * 2 ** z, o = map.getPixelBounds().min; let best = -1, bd = maxPx * maxPx;
    for (let i = 0; i < cat.sites.length; i++) {
      if (!show[P0.g[i]]) continue;
      let x = P0.x[i] * sc - o.x; const y = P0.y[i] * sc - o.y; if (Math.abs(y - pt.y) > maxPx) continue;
      x = x - Math.round((x - pt.x) / sc) * sc; const q = (x - pt.x) ** 2 + (y - pt.y) ** 2; if (q < bd) { bd = q; best = i; }
    }
    return best;
  }
  const R = 6371, rad = Math.PI / 180;
  const km = (a, b, c, e) => { const s = Math.sin((c - a) * rad / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin((e - b) * rad / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
  const lonN = (x) => ((x + 540) % 360) - 180;

  map.on("click", (e) => {
    if (!cat) return; const i = nearestPixel(map.latLngToContainerPoint(e.latlng), 10);
    if (i >= 0) select(i, false); else nearby(e.latlng.lat, lonN(e.latlng.lng));
  });

  // ------------------------------------------------------------ station panel
  const url = (f) => cat.hosts[cat.dirs[f[0]][0]] + cat.dirs[f[0]][1] + (cat.dirs[f[0]][1] ? "/" : "") + f[1];
  const yrs = (f) => { const m = /(\d{4})-(\d{4})/.exec(f[2] || f[1]); return m ? +m[2] : 0; };
  const deg = (v, p, n) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? p : n}`;
  const DL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></svg>';

  function select(i, fly) {
    const s = cat.sites[i]; sel = i;
    if (selMark) selMark.remove();
    selMark = L.circleMarker([s[0], s[1]], { radius: 11, color: css("--sun"), weight: 3, fill: false, interactive: false }).addTo(map);
    if (probe) { probe.remove(); probe = null; }
    if (fly) map.setView([s[0], s[1]], Math.max(map.getZoom(), 9));
    const newest = Math.max(...s[5].map(yrs));
    const files = s[5].slice().sort((a, b) => yrs(b) - yrs(a));
    $("site").hidden = false;
    $("site").innerHTML = `<p class="lab">Station</p><h2>${esc(s[2])}</h2>
      <dl class="kv"><dt>Position</dt><dd>${deg(s[0], "N", "S")}, ${deg(s[1], "E", "W")}</dd>
      <dt>Elevation</dt><dd>${s[3] != null && s[3] !== "" ? Math.round(s[3]) + " m" : "not given"}</dd>
      <dt>Climate</dt><dd><span class="dot" style="display:inline-block;background:${color[grp(s[4])]}"></span> ${esc(s[4] || "–")}${KOPPEN[s[4]] ? ", " + esc(KOPPEN[s[4]]) : ""}</dd></dl>
      <p class="lab">${files.length} file${files.length > 1 ? "s" : ""}</p>
      <div class="files">${files.map((f) => `<a class="file" href="${esc(url(f))}" download rel="noopener">${DL}<div><b>${esc(f[2] || "Weather file")}</b><span>${esc(f[1])}</span></div>${newest && yrs(f) === newest && files.length > 1 ? '<em class="new">most recent</em>' : ""}</a>`).join("")}</div>
      <p class="hint" style="margin:8px 0 0">TMYx: typical months chosen from the years in the name, from hourly station records with satellite-derived solar data. Shorter, recent periods carry more of today's warming.</p>`;
    $("near").hidden = true;
    history.replaceState(null, "", "#" + encodeURIComponent(s[2]));
  }

  function nearby(lat, lon, label) {
    const list = []; for (let i = 0; i < cat.sites.length; i++) { const s = cat.sites[i]; if (!show[P0.g[i]]) continue; list.push([km(lat, lon, s[0], s[1]), i]); }
    list.sort((a, b) => a[0] - b[0]); const top = list.slice(0, 8);
    if (probe) probe.remove(); probe = L.circleMarker([lat, lon], { radius: 5, color: css("--ink"), weight: 2, fillOpacity: 0, interactive: false }).addTo(map);
    $("near").hidden = false;
    $("near").innerHTML = `<p class="lab">Nearest stations to ${label ? esc(label) : deg(lat, "N", "S") + ", " + deg(lon, "E", "W")}</p>` +
      top.map(([d, i]) => { const s = cat.sites[i]; return `<button type="button" data-i="${i}"><span class="dot" style="background:${color[grp(s[4])]}"></span>${esc(s[2])}<small>${d < 10 ? d.toFixed(1) : Math.round(d)} km${s[3] != null && s[3] !== "" ? " · " + Math.round(s[3]) + " m" : ""}</small></button>`; }).join("") +
      `<p class="hint" style="margin:6px 0 0">Prefer a station with similar surroundings and elevation: a coastal airport and an inland city a few kilometres apart can differ more than the distance suggests.</p>`;
  }
  $("near").addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b) select(+b.dataset.i, true); });

  // ------------------------------------------------------------ search
  let norm = null;
  const fold = (x) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[._-]+/g, " ");
  let qTimer = null, lastPlaces = null;
  function stationHits(q) {
    const hit = []; for (let i = 0; i < norm.length && hit.length < 400; i++) { const k = norm[i].indexOf(q); if (k >= 0) hit.push([k === 0 || norm[i][k - 1] === " " ? 0 : 1, norm[i].length, i]); }
    return hit.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 25).map((h) => h[2]);
  }
  function renderResults() {
    const raw = $("q").value.trim(), q = fold(raw), box = $("res"); if (!cat || q.length < 2) { box.hidden = true; return; }
    const st = stationHits(q); let h = "";
    if (lastPlaces && lastPlaces.q === raw) {
      h += `<p class="rh">Places</p>` + (lastPlaces.list.length ? lastPlaces.list.map((p, k) => `<button type="button" data-p="${k}"><span class="dot pin"></span>${esc(p.name)}<small>${esc(p.kind)}</small></button>`).join("") : `<p class="rh none">${lastPlaces.err ? "Place search did not answer. Try again in a moment." : "No place found."}</p>`);
    } else h += `<button type="button" class="place" data-search="1">Search places named “${esc(raw)}” <small>Enter</small></button>`;
    h += `<p class="rh">Stations</p>` + (st.length ? st.map((i) => { const s = cat.sites[i]; return `<button type="button" data-i="${i}"><span class="dot" style="background:${color[grp(s[4])]}"></span>${esc(s[2])}<small>${esc(s[4] || "")} · ${s[5].length}</small></button>`; }).join("") : `<p class="rh none">No station name matches.</p>`);
    box.innerHTML = h; box.hidden = false;
  }
  async function searchPlaces() {
    const raw = $("q").value.trim(); if (raw.length < 2) return;
    lastPlaces = { q: raw, list: [] }; $("res").querySelector(".place") && ($("res").querySelector(".place").textContent = "Searching places");
    try {
      const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=en&q=" + encodeURIComponent(raw));
      const j = await r.json();
      lastPlaces.list = j.map((x) => ({ name: x.display_name.split(", ").slice(0, 3).join(", "), kind: (x.addresstype || x.type || "").replace(/_/g, " "), lat: +x.lat, lon: +x.lon }));
    } catch (e) { lastPlaces.list = []; lastPlaces.err = true; }
    renderResults();
  }
  $("q").addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(renderResults, 120); });
  $("q").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); searchPlaces(); } });
  $("res").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.search) { searchPlaces(); return; }
    if (b.dataset.p != null) { const p = lastPlaces.list[+b.dataset.p]; map.setView([p.lat, p.lon], 10); nearby(p.lat, p.lon, p.name); $("res").hidden = true; return; }
    if (b.dataset.i != null) { select(+b.dataset.i, true); $("res").hidden = true; }
  });

  // ------------------------------------------------------------ legend
  function legend() {
    const n = {}; if (cat) for (const g of P0.g) n[g] = (n[g] || 0) + 1;
    $("legend").innerHTML = GROUPS.map(([g, name]) => `<button type="button" data-g="${g}" aria-pressed="${show[g]}"><span class="dot" style="background:${color[g]}"></span>${name}${cat ? ` <small style="color:var(--mute)">${(n[g] || 0).toLocaleString("en-GB")}</small>` : ""}</button>`).join("");
  }
  $("legend").addEventListener("click", (e) => { const b = e.target.closest("button[data-g]"); if (!b) return; show[b.dataset.g] = !show[b.dataset.g]; legend(); dots.redraw(); });

  // ------------------------------------------------------------ catalogue (same file as Macro Clima)
  async function load() {
    const r = await fetch(BASE + "macro/data/stations.js"); const js = await r.text();
    const b64 = js.slice(js.indexOf('"') + 1, js.lastIndexOf('"')), bin = atob(b64), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const txt = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    const c = JSON.parse(txt), byKey = new Map();
    // the catalogue lists some stations once per source folder: merge entries with the same name within about 2 km
    for (const s of c.sites) {
      if (!(Math.abs(s[0]) <= 90 && Math.abs(s[1]) <= 180 && s[5] && s[5].length)) continue;
      const k = s[2] + "|" + Math.round(s[0] * 50) + "|" + Math.round(s[1] * 50), o = byKey.get(k);
      if (!o) byKey.set(k, [s[0], s[1], s[2], s[3], s[4], s[5].slice()]);
      else { for (const f of s[5]) if (!o[5].some((g) => g[1] === f[1])) o[5].push(f); if (!o[4] && s[4]) o[4] = s[4]; if (o[3] == null) o[3] = s[3]; }
    }
    c.sites = [...byKey.values()];
    const n = c.sites.length, x = new Float64Array(n), y = new Float64Array(n), g = new Array(n);
    for (let i = 0; i < n; i++) { const s = c.sites[i], la = Math.max(-85, Math.min(85, s[0])) * rad; x[i] = (s[1] + 180) / 360; y[i] = (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2; g[i] = grp(s[4]); }
    cat = c; P0 = { x, y, g }; norm = c.sites.map((s) => fold(s[2]));
    const nf = c.sites.reduce((a, s) => a + s[5].length, 0);
    $("count").textContent = `${n.toLocaleString("en-GB")} stations, ${nf.toLocaleString("en-GB")} files. Click a dot, or click anywhere for the nearest stations.`;
    legend(); dots.redraw();
    const h = decodeURIComponent(location.hash.slice(1)); if (h) { const i = c.sites.findIndex((s) => s[2] === h); if (i >= 0) select(i, true); }
  }
  readColors(); legend(); dots.addTo(map);
  load().catch((e) => { $("count").textContent = "The station list did not load: " + e.message; });
})();
