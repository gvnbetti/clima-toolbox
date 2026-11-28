"""0.12.0 (28 November 2026): results in tabs, the priority on top, Manual changes and Suggest optimum.
Decisions of 28 November 2026 (Giovanni, from the layout mock-up):
- Tabs: Overview, one tab per room type and facade, Method and evidence. The inputs fold away after a run.
- One priority row at the top (Balanced, Daylight first, Comfort first, Energy first); it sets the recommended design
  everywhere and the optimum.
- Facade switches in two modes. Manual changes (default): one switch changes one thing. Suggest optimum: a click fixes
  that choice for this room; the other switches move to the best design for this room alone (the actual optimum for the
  facade, building-wide measures included), from the designs tested plus a short search around the choices.
- "Keep this design for <room>": the kept design replaces the recommended one on the room's card in the Overview.
Run from the repository root."""
import pathlib, sys
R = pathlib.Path(__file__).resolve().parent.parent / 'src'
P, SH = R / 'page.html', R / 'shell.html'
p, sh = P.read_text(encoding='utf-8'), SH.read_text(encoding='utf-8')

def rep(s, old, new, n=1, label=''):
    c = s.count(old)
    if c != n: sys.exit(f'{label}: found {c}, expected {n}')
    return s.replace(old, new)

# ---------------------------------------------------------------- shell
CSS = '''.slask { margin-top: 8px; font-size: 13px }'''
sh = rep(sh, CSS, CSS + '''
/* 0.12.0: priority bar, tabs, folding inputs, switch modes */
.ptop { display: flex; flex-direction: column; gap: 4px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; margin-bottom: 12px }
.ptrow { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap } .ptsp { flex: 1 }
.ptseg { display: flex; flex-wrap: wrap } .ptseg button { width: auto; padding: 7px 12px; border-radius: 0; margin-left: -1px; min-height: 38px; cursor: pointer }
.ptseg button[aria-pressed="true"] { background: var(--accent); color: #fff; border-color: var(--accent) }
.ptop .ghost { width: auto; padding: 7px 12px; min-height: 38px } .ptop .ghost:disabled { opacity: .5; cursor: default }
.rtabs { display: flex; flex-wrap: wrap; gap: 2px; border-bottom: 1px solid var(--line); margin: 0 0 14px }
.rtabs button { width: auto; border: 0; background: transparent; padding: 9px 14px; font: 14px var(--f-body); color: var(--mute); border-bottom: 3px solid transparent; cursor: pointer; min-height: 42px }
.rtabs button[aria-pressed="true"] { color: var(--ink); font-weight: 600; border-bottom-color: var(--accent) } .rtabs .rtm { margin-left: auto }
body.infold .grid { grid-template-columns: minmax(0, 1fr) } body.infold aside { display: none }
#v4glance { display: none }
body[data-view="ov"] #facbox, body[data-view="ov"] #evpc, body[data-view="ov"] .evh, body[data-view="ov"] #aibox, body[data-view="ov"] #notedet, body[data-view="ov"] #methdet { display: none }
body[data-view="room"] #ovcards, body[data-view="room"] #ovrech, body[data-view="room"] #ttabs, body[data-view="room"] #verddet, body[data-view="room"] #v4dec, body[data-view="room"] #finedet, body[data-view="room"] #aibox, body[data-view="room"] #notedet, body[data-view="room"] #methdet { display: none }
body[data-view="m"] #ovcards, body[data-view="m"] #ovrech, body[data-view="m"] #ttabs, body[data-view="m"] #verddet, body[data-view="m"] #v4dec, body[data-view="m"] #finedet, body[data-view="m"] #facbox, body[data-view="m"] #evpc, body[data-view="m"] .evh { display: none }
.ovt { margin-bottom: 14px } .ovth { margin: 6px 0 8px; font: 500 11px/1.2 var(--f-data); text-transform: uppercase; letter-spacing: .08em; color: var(--mute) }
.ovrech { margin: 22px 0 8px; font-size: 18px }
.swmode { display: flex; flex-wrap: wrap; border: 1px solid var(--accent); border-radius: 4px; overflow: hidden; margin: 8px 0 10px; width: fit-content; max-width: 100% }
.swmode button { width: auto; border: 0; border-radius: 0; background: #fff; padding: 8px 14px; text-align: left; display: flex; flex-direction: column; cursor: pointer; min-height: 44px; font: 14px var(--f-body); color: var(--ink) }
.swmode button + button { border-left: 1px solid var(--accent) } .swmode button span { font-size: 12px; color: var(--mute) }
.swmode button[aria-pressed="true"] { background: var(--accent); color: #fff } .swmode button[aria-pressed="true"] span { color: #d5e6df }
.lkbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; background: #fdf4ea; border: 1px solid #efd3b5; border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; font-size: 13px }
.lkc { display: inline-flex; align-items: center; gap: 6px; border: 2px solid var(--sun); background: #fff; border-radius: 14px; padding: 2px 4px 2px 10px }
.lkc button { width: 22px; height: 22px; padding: 0; border: 0; border-radius: 11px; background: #f3e1cd; cursor: pointer; font-size: 11px } .lkst { flex-basis: 100% }
.swo button.lk { outline: 2px solid var(--sun); outline-offset: 1px } .swo button.byopt { border-style: dashed }
.swt { display: block; font-size: 11px; opacity: .85; font-weight: 400 }
.keepb { width: auto; margin: 10px 8px 0 0; border-color: var(--accent); color: var(--accent); min-height: 40px } .keepl { font-size: 13px; margin: 10px 0 0 }''', label='css')
sh = rep(sh, '<p id="empty">', '''<section id="ptop" class="ptop" hidden><div class="ptrow"><span class="lab">Priority</span><div class="ptseg" id="ptseg" role="group" aria-label="Priority"></div><a href="#" id="ptfine" class="link">Fine-tune</a><span class="ptsp"></span><button type="button" class="ghost" id="ptin">Show inputs</button><button type="button" class="ghost" id="ptsave">Save results</button><button type="button" class="ghost" id="ptload">Load results</button></div><p class="small" id="ptnote" style="margin:0"></p></section>
      <p id="empty">''', label='ptop')
sh = rep(sh, '<p id="loadnote" class="loadnote" hidden></p>', '<p id="loadnote" class="loadnote" hidden></p>\n      <nav class="rtabs" id="rtabs" aria-label="Results"></nav>', label='rtabs')
sh = rep(sh, '      <div class="ttabs" id="ttabs" role="group" aria-label="Room type"></div>\n', '', label='ttabs out')
sh = rep(sh, '      <section class="v4s" id="v4prio"></section>', '      <section class="v4s" id="ovcards"></section>\n      <section class="v4s" id="v4prio"></section>', label='ovcards')
sh = rep(sh, '      <details class="v4s v4card ev" id="verddet">', '      <h2 class="ovrech" id="ovrech">Recommendations by room type</h2>\n      <div class="ttabs" id="ttabs" role="group" aria-label="Room type"></div>\n      <details class="v4s v4card ev" id="verddet">', label='ttabs in')
sh = rep(sh, '<details class="ev"><summary>Method and limits', '<details class="ev" id="methdet"><summary>Method and limits', label='methdet')

# ---------------------------------------------------------------- page
p = rep(p, 'if (!st.fac) return;\n    if (st.tm) { const rp = runPanelHtml();', 'if (!st.fac) return;\n    renderShell();\n    if (st.tm) { const rp = runPanelHtml();', label='renderShell')
p = rep(p, 'const sc = st.scen, B = buildResult(sc), A = facList(sc);\n    $("v4prio").innerHTML = "";', 'const sc = st.scen, B = buildResult(sc), A = facList(sc);\n    optSync(sc);\n    $("v4prio").innerHTML = "";', label='optSync')
p = rep(p, '${wi ? "What if: your changes are in blue." : "The recommended design: daylight, comfort and energy weighed equally. Pick other choices to see their effect."}', '${swHead(sc, a, wi)}', label='head')
p = rep(p, 'Change the targets under Reading, or allow more strategies in the inputs.</p>` : ""}${B.mixed ? `<p class="missnote">No single choice of glass, insulation and mass was found that suits every facade of this room type; each facade shows its own best design.</p>` : ""}<div class="fpg">`;',
    'Change the targets under Reading, or allow more strategies in the inputs.</p>` : ""}${B.mixed ? `<p class="missnote">No single choice of glass, insulation and mass was found that suits every facade of this room type; each facade shows its own best design.</p>` : ""}${modeBarHtml(sc, a)}<div class="fpg">`;', label='modebar')
p = rep(p, 'h += `<div class="dsel" role="group" aria-label="Designs to compare at this facade">', 'if (st.swMode !== "opt") h += `<div class="dsel" role="group" aria-label="Designs to compare at this facade">', label='dsel')
p = rep(p, 'if (more.length) h += `<details class="dmore" id="moredet"', 'if (more.length && st.swMode !== "opt") h += `<details class="dmore" id="moredet"', label='more')
p = rep(p, 'class="${on ? (isRec ? "on" : "wi") : ""}" style="${isRec ? `box-shadow:0 0 0 ${k >= 5 ? 3 : 2}px ${GREEN(k)}` : ""}">${SHORT4[p](v)}${flipTag(p, v)}</button>',
    'class="${swCls(sc, a, p, v, on, isRec)}" style="${isRec ? `box-shadow:0 0 0 ${k >= 5 ? 3 : 2}px ${GREEN(k)}` : ""}">${SHORT4[p](v)}${flipTag(p, v)}${swTag(sc, a, p, v, on, isRec)}</button>', label='switch')
p = rep(p, 'if (wi) h += `<button type="button" class="ghost" id="wireset">Back to the recommended design</button>`;',
    'h += keepHtml(sc, a, wi, cur);\n    if (wi && st.swMode !== "opt") h += `<button type="button" class="ghost" id="wireset">Back to the recommended design</button>`;', label='keep')
p = rep(p, 'const p = b.dataset.p, v = b.dataset.v.startsWith("n") ? +b.dataset.v.slice(1) : b.dataset.v;',
    'const p = b.dataset.p, v = b.dataset.v.startsWith("n") ? +b.dataset.v.slice(1) : b.dataset.v;\n      if (st.swMode === "opt") { toggleLock(sc, a, p, v); return; }', label='click')
p = rep(p, 'if (fm) draw3d(fm, S.PARAMS.azimuth[a], "fp3d"); else $("fp3d").innerHTML = `<span class="c3wait">Drawing the room…</span>`;\n  }',
    'if (fm) draw3d(fm, S.PARAMS.azimuth[a], "fp3d"); else $("fp3d").innerHTML = `<span class="c3wait">Drawing the room…</span>`;\n    bindModeBar(sc, a);\n  }', label='bindmode')
p = rep(p, 'const add = (id, lab, r, note, row) => { if (!r) return; const k = FS.keyOf(r.dz); if (seen.has(k)) return; seen.add(k); out.push([id, lab, r, note, row]); };',
    'const add = (id, lab, r, note, row) => { if (!r) return; const k = FS.keyOf(r.dz); if (seen.has(k)) return; seen.add(k); out.push([id, lab, r, note, row]); };\n    { const kr = keptRow(sc, a); if (kr) add("kept", "Kept design", kr, "the design you kept for this room", 0); }', label='designSet')
p = rep(p, 'const r = B.best.per[a], fm = fmapOf(sc, r.dz, a), on = a === st.fa;', 'const kr = keptRow(sc, a), r = kr || B.best.per[a], fm = fmapOf(sc, r.dz, a), on = a === st.fa;', label='glance row')
p = rep(p, '<span class="fch"><b>${orientLabel(sc, a)}</b><span>${Math.round(r.dz.wwr * 100)}% window</span></span>', '<span class="fch"><b>${orientLabel(sc, a)}</b><span>${kr ? "your design · " : ""}${Math.round(r.dz.wwr * 100)}% window</span></span>', label='glance label')
p = rep(p, 'if (m.type === "prog") { const [sc, a] = m.id;', 'if (m.type === "prog" && m.id && m.id[2]) { const L = st.lockS && st.lockS[m.id[2]]; if (L) L.n = m.n; scheduleRender(false); return; }\n        if (m.type === "prog") { const [sc, a] = m.id;', label='prog')
p = rep(p, 'else if (o.kind === "topup") topDone(o.id[0], o.id[1], o.r);', 'else if (o.kind === "topup") { if (o.id[2]) lockDone(o.id[0], o.id[1], o.id[2], o.r); else topDone(o.id[0], o.id[1], o.r); }', label='lockdone')
p = rep(p, '    bindSaveLoad();\n', '    bindSaveLoad(); bindTop();\n', label='bindTop')
p = rep(p, 'st.runIn = snapIn(); st.runWx = st.wx; st.loaded = null; $("loadnote").hidden = true;\n',
    'st.runIn = snapIn(); st.runWx = st.wx; st.loaded = null; $("loadnote").hidden = true;\n    st.locks = {}; st.kept = {}; st.lockS = {}; st.view = "ov"; st.swMode = "manual"; foldInputs(true);\n', label='run reset')
p = rep(p, 'st.cache = {}; st.pcache = {}; st.prCache = {}; st.balCache = {}; st.modCache = null; st.detRun = null; st.stale = false;',
    'st.cache = {}; st.pcache = {}; st.prCache = {}; st.balCache = {}; st.modCache = null; st.detRun = null; st.stale = false;\n    st.locks = st.locks || {}; st.kept = st.kept || {}; st.lockS = st.lockS || {}; Object.keys(st.lockS).forEach((k) => { if (!st.lockS[k].done) delete st.lockS[k]; }); st.view = st.view || "ov"; st.swMode = st.swMode || "manual"; foldInputs(true);', label='load reset')
p = rep(p, 'function slButtons() { const b = $("savres"); if (b && b.textContent === "Save results") b.disabled = !st.fac || slBusy(); }',
    'function slButtons() { const b = $("savres"); if (b && b.textContent === "Save results") b.disabled = !st.fac || slBusy(); const q = $("ptsave"); if (q && b) q.disabled = b.disabled; }', label='slButtons')

MOD = r'''  // ---- 0.12.0: tabs, the priority on top, Manual changes and Suggest optimum (decisions of 28 November 2026)
  const TABL = (sc, a) => `${SCLAB[sc].replace(/ room.*$/, "")}${sc === "corner_top" ? " top" : ""} ${orientLabel(sc, a)}`;
  const prioName = () => { const x = PRESETS.find((q) => sameW(st.w, normW(q[2]))); return x ? x[1] : "your own priorities"; };
  function foldInputs(on) { st.inFold = !!on; document.body.classList.toggle("infold", !!on); const b = $("ptin"); if (b) b.textContent = on ? "Show inputs" : "Hide inputs"; }
  function renderShell() {
    $("ptop").hidden = false;
    const cur = PRESETS.find((x) => sameW(st.w, normW(x[2])));
    $("ptseg").innerHTML = PRESETS.map(([k, lab, , sub]) => `<button type="button" data-k="${k}" aria-pressed="${!!cur && cur[0] === k}" title="${escA(sub)}">${lab}</button>`).join("");
    document.querySelectorAll("#ptseg button").forEach((b) => b.onclick = () => { const x = PRESETS.find((q) => q[0] === b.dataset.k); st.w = normW(x[2]); st.wManual = true; st.wAuto = false; if (st.swMode !== "opt") st.wi = null; renderAll(); });
    $("ptnote").textContent = `${cur ? cur[3] : "Your own weights from the triangle: " + wTxt()}. The recommended design in every tab and Suggest optimum follow this priority.`;
    slButtons();
    const tabs = [["ov", "Overview"]].concat(...st.types.map((sc) => facList(sc).map((a) => [sc + "|" + a, TABL(sc, a)])), [["m", "Method and evidence"]]);
    if (!tabs.some((t) => t[0] === st.view)) st.view = "ov";
    $("rtabs").innerHTML = tabs.map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${k === st.view}"${k === "m" ? ' class="rtm"' : ""}>${esc(l)}</button>`).join("");
    document.querySelectorAll("#rtabs button").forEach((b) => b.onclick = () => openView(b.dataset.v));
    const room = st.view.includes("|");
    if (room) { const [sc, a] = st.view.split("|"); st.scen = sc; st.fa = +a; }
    document.body.dataset.view = room ? "room" : st.view;
    if (st.view === "ov") { $("ovcards").innerHTML = ovCardsHtml(); document.querySelectorAll("#ovcards .fcard").forEach((b) => b.onclick = () => openView(b.closest(".ovt").dataset.sc + "|" + b.dataset.a)); }
  }
  function openView(v) {
    if (v === st.view) return;
    const [sc, a] = v.split("|"); if (a != null && !(st.wi && st.wi.sc === sc && st.wi.a === +a)) st.wi = null;
    st.view = v; if (st.sel && st.sel.auto) st.sel = null; renderAll();
    const t = $("rtabs"); if (t) window.scrollTo({ top: Math.max(0, t.getBoundingClientRect().top + window.scrollY - 10) });
  }
  function ovCardsHtml() {
    return `<div class="v4h"><h2>Rooms</h2><span class="small">Each room with its recommended design under ${esc(prioName())}, or the design you kept for it. A card opens its tab.</span></div>`
      + st.types.map((sc) => { const B = buildResult(sc), g = B ? glanceHtml(sc, B).replace(/^[\s\S]*?(<div class="g4">)/, "$1") : `<p class="wait">${st.running || st.topping ? "Appears when the facades of this room type have been searched." : "No design found for this room type."}</p>`;
        return `<div class="ovt" data-sc="${sc}"><h3 class="ovth">${SCLAB[sc]}</h3>${g}</div>`; }).join("");
  }
  function bindTop() {
    $("ptin").onclick = () => foldInputs(!st.inFold);
    $("ptsave").onclick = () => $("savres").click();
    $("ptload").onclick = () => $("loadfile").click();
    $("ptfine").onclick = (e) => { e.preventDefault(); if (st.view !== "ov") openView("ov"); const d = $("finedet"); if (d) { d.open = true; setTimeout(() => d.scrollIntoView({ block: "start" }), 50); } };
  }
  // the choices fixed by the user in Suggest optimum, per room and facade, and the best design that keeps them
  const lkKey = (sc, a) => sc + "|" + a;
  const locksOf = (sc, a) => (st.locks && st.locks[lkKey(sc, a)]) || {};
  const lockSig = (sc, a, L) => sc + "|" + a + "|" + Object.keys(L).sort().map((q) => q + "=" + L[q]).join(",");
  const LOCKCAP = 300; // designs simulated at most in the search around the choices
  function optRow(sc, a) { // the best design for this room alone: building-wide measures free, the user's choices kept
    const L = locksOf(sc, a), ks = Object.keys(L), f = facade(sc, a); if (!f) return null;
    const m = (r) => ks.every((q) => r.dz[q] === L[q]), all = f.rows.filter(m), ok = f.ok.filter(m), meet = ok.filter((r) => r.t && r.t.all);
    const pool = meet.length ? meet : ok.length ? ok : all;
    return pool.length ? pickTie(pool, (r) => r.q) : null;
  }
  function optSync(sc) {
    if (st.swMode !== "opt" || !st.view || !st.view.includes("|")) return;
    const a = st.fa, B = buildResult(sc), rec = B && B.best.per[a], o = optRow(sc, a);
    st.wi = o && !(rec && FS.keyOf(o.dz) === FS.keyOf(rec.dz)) ? { sc, a, dz: Object.assign({}, o.dz), opt: true } : null;
  }
  function toggleLock(sc, a, p, v) { const L = Object.assign({}, locksOf(sc, a)); if (L[p] === v) delete L[p]; else L[p] = v; st.locks[lkKey(sc, a)] = L; lockSearch(sc, a); renderAll(); }
  function lockSearch(sc, a) {
    const L = locksOf(sc, a), ks = Object.keys(L); if (!ks.length || !workers.length || !st.fac[sc][a]) return;
    const sig = lockSig(sc, a, L); st.lockS = st.lockS || {}; if (st.lockS[sig]) return;
    const m = (x) => ks.every((q) => x.dz[q] === L[q]), S0 = st.lockS[sig] = { n: 0, done: false, t0: Date.now() };
    const go = () => { const rows = st.fac[sc][a].rows.filter(m), lv = Object.assign({}, levelsFor(sc, a)); ks.forEach((q) => { lv[q] = [L[q]]; });
      queue.push({ kind: "topup", id: [sc, a, sig], o: { scenario: sc, azimuth: S.PARAMS.azimuth[a], tab: dlTab(sc, a), key: evalKey(), fanOk: fanOkNow(), limit: limitNow(), copH: st.copH, copC: st.copC, rk: rankOpts(sc), mode: st.mode, dlm: st.dlm, floor: st.floor, levels: lv, meas: VARM(sc).filter((q) => !(q in L)), cap: LOCKCAP, rows: rows.map((x) => ({ dz: x.dz, heat: x.r.heat, cool: x.r.cool })) } }); wake(); };
    if (st.fac[sc][a].rows.some(m)) { go(); return; }
    // nothing tested with these choices yet: the best design so far with the choices applied, then the search from there
    const o = optRow(sc, a) || facade(sc, a).best || (buildResult(sc) || { best: { per: {} } }).best.per[a]; if (!o) { S0.done = true; S0.fail = true; return; }
    simulateOne(sc, a, Object.assign({}, o.dz, L)).then(go, () => { S0.done = true; S0.fail = true; scheduleRender(true); });
  }
  function lockDone(sc, a, sig, r) { addRows(sc, a, r.rows); const s = st.lockS && st.lockS[sig]; if (s) { s.done = true; s.n = r.rows.length; s.t = Math.round((Date.now() - s.t0) / 1000); } scheduleRender(true); }
  const keptRow = (sc, a) => { const d = st.kept && st.kept[lkKey(sc, a)]; return d ? wiRow(sc, a, d) : null; };
  function swHead(sc, a, wi) {
    if (st.swMode === "opt") return wi ? `The best design for this room alone under ${esc(prioName())}${Object.keys(locksOf(sc, a)).length ? ", with your choices" : ""}. The recommended design keeps one glass, insulation and mass for the whole building; the differences against it are shown.` : `For this room the recommended design is also the best.`;
    return wi ? "Your changes are marked; the differences against the recommended design are shown." : `The recommended design under ${esc(prioName())}. Change a switch to see its effect, one at a time.`;
  }
  function modeBarHtml(sc, a) {
    const opt = st.swMode === "opt", L = locksOf(sc, a), ks = Object.keys(L);
    let h = `<div class="swmode" role="group" aria-label="How the switches work"><button type="button" data-m="manual" aria-pressed="${!opt}"><b>Manual changes</b><span>Set the switches as you wish</span></button><button type="button" data-m="opt" aria-pressed="${opt}"><b>Suggest optimum</b><span>One change, the rest set to the best combination</span></button></div>`;
    if (!opt) return h;
    const s = ks.length && st.lockS ? st.lockS[lockSig(sc, a, L)] : null, f = facade(sc, a), n = f ? f.rows.length : 0;
    const stat = !ks.length ? `Click a choice to fix it. The other switches move to the best design for this room under ${esc(prioName())}.`
      : !s ? "" : s.fail ? "The search around your choices could not run; the design shown is the best among those already tested."
      : s.done ? `Best design with your choices among ${fmt(n)} designs tested at this facade, ${fmt(s.n)} of them in a search around your choices${s.t != null ? ` (${s.t} s)` : ""}.`
      : `Searching around your choices: ${fmt(s.n || 0)} designs so far. The design shown is the best found yet.`;
    h += `<div class="lkbar"><b>Your choices</b>${ks.length ? ks.map((q) => `<span class="lkc">${NAME4[q]}: ${esc(SHORT4[q](L[q]))} <button type="button" data-p="${q}" aria-label="Remove ${escA(NAME4[q])}">✕</button></span>`).join("") + `<button type="button" class="link" id="lkclear">Clear my choices</button>` : `<span class="small">none yet</span>`}<span class="small lkst">${stat}</span></div>`;
    return h;
  }
  function swCls(sc, a, p, v, on, isRec) { const c = on ? (isRec ? "on" : "wi") : ""; if (st.swMode !== "opt") return c; return locksOf(sc, a)[p] === v ? (c + " lk").trim() : on && !isRec ? c + " byopt" : c; }
  function swTag(sc, a, p, v, on, isRec) { if (st.swMode !== "opt") return ""; if (locksOf(sc, a)[p] === v) return `<span class="swt">your choice</span>`; return on && !isRec ? `<span class="swt">set by optimum</span>` : ""; }
  function keepHtml(sc, a, wi, cur) {
    const kd = st.kept && st.kept[lkKey(sc, a)], B = buildResult(sc), rec = B && B.best.per[a], dz = wi ? wi.dz : rec && rec.dz;
    if (kd && dz && FS.keyOf(kd) === FS.keyOf(dz)) return `<p class="keepl">Kept: this design replaces the recommended one on the ${esc(TABL(sc, a))} card in the Overview. <button type="button" class="link" id="keeprm">Remove</button></p>`;
    let h = wi && cur ? `<button type="button" class="ghost keepb" id="keepdz">Keep this design for ${esc(TABL(sc, a))}</button>` : "";
    if (kd) h += `<p class="keepl">You kept another design for ${esc(TABL(sc, a))}${wi && cur ? "; keeping this one replaces it" : ""}. <button type="button" class="link" id="keeprm">Remove it</button></p>`;
    return h;
  }
  function bindModeBar(sc, a) {
    document.querySelectorAll("#v4fac .swmode button").forEach((b) => b.onclick = () => { const m = b.dataset.m; if (m === st.swMode) return;
      if (m === "manual" && st.wi && st.wi.opt) st.wi = Object.assign({}, st.wi, { opt: false }); // the optimum becomes the start of manual changes
      st.swMode = m; if (m === "opt") lockSearch(sc, a); renderAll(); });
    document.querySelectorAll("#v4fac .lkc button").forEach((b) => b.onclick = () => { const L = Object.assign({}, locksOf(sc, a)); delete L[b.dataset.p]; st.locks[lkKey(sc, a)] = L; lockSearch(sc, a); renderAll(); });
    const c = $("lkclear"); if (c) c.onclick = () => { st.locks[lkKey(sc, a)] = {}; renderAll(); };
    const k = $("keepdz"); if (k) k.onclick = () => { const wi = st.wi && st.wi.sc === sc && st.wi.a === a ? st.wi : null; if (!wi) return; st.kept[lkKey(sc, a)] = Object.assign({}, wi.dz); renderAll(); };
    const r = $("keeprm"); if (r) r.onclick = () => { delete st.kept[lkKey(sc, a)]; renderAll(); };
  }
'''
p = rep(p, '  // ---- 0.11.0: save and load results', MOD + '  // ---- 0.11.0: save and load results', label='module')
p = rep(p, '  const CHANGES = [\n', '''  const CHANGES = [
    ["0.12.0", "28 Nov 2026", "Results in tabs: an Overview, one tab per room and facade, and Method and evidence. The inputs fold away after a run (Show inputs). One priority row at the top, Balanced, Daylight first, Comfort first or Energy first, sets the recommended design everywhere. The facade switches work in two ways: Manual changes, the default, changes one thing at a time; Suggest optimum fixes the choice you click and moves the other switches to the best design for that room alone, building-wide measures included, from the designs tested and a short search around your choices. Keep this design puts a design on the room's card in the Overview."],
''', label='changelog')
P.write_text(p, encoding='utf-8'); SH.write_text(sh, encoding='utf-8')
print('ok')
