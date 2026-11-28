"""0.11.0 (28 November 2026): save and load results.
Two buttons under Run. Save results writes one zip file holding results.json: the release, the date, the weather file
as loaded (future and urban modifiers are applied again from the inputs), the inputs as they were at Run, and every
result of the run with the reading choices. Caches, the engine context and the Claude review and chat are left out
(decision of 28 November 2026). Load results restores the run without simulating it again; a file saved with another
release shows "Saved with X; this is Y. Run again to update." above the results. Loading while a calculation runs asks
first, then stops it. Run from the repository root."""
import pathlib, sys
R = pathlib.Path(__file__).resolve().parent.parent / 'src'
P, SH = R / 'page.html', R / 'shell.html'
p, sh = P.read_text(encoding='utf-8'), SH.read_text(encoding='utf-8')

def rep(s, old, new, n=1, label=''):
    c = s.count(old)
    if c != n: sys.exit(f'{label}: found {c}, expected {n}')
    return s.replace(old, new)

# ---- shell: buttons under Run, a confirmation line, the note above the results, styles
sh = rep(sh, '<span id="status">Set the inputs, then run.</span></div>',
    '<span id="status">Set the inputs, then run.</span>'
    '<div class="slrow"><button id="savres" type="button" class="ghost" disabled>Save results</button><button id="loadres" type="button" class="ghost">Load results</button>'
    '<input type="file" id="loadfile" accept=".zip,.json" hidden></div>'
    '<div id="slask" class="slask" hidden><span></span> <button type="button" class="link" data-a="yes">Stop and load</button> <button type="button" class="link" data-a="no">Keep running</button></div>'
    '<span class="err" id="loaderr"></span></div>', label='shell buttons')
sh = rep(sh, '<div id="results" hidden>', '<div id="results" hidden>\n<p id="loadnote" class="loadnote" hidden></p>', label='shell note')
sh = rep(sh, '.ghost { width: auto; cursor: pointer; background: transparent }',
    '.ghost { width: auto; cursor: pointer; background: transparent }\n'
    '.slrow { display: flex; gap: 8px; margin-top: 10px } .slrow .ghost { flex: 1; min-height: 36px } .slrow .ghost:disabled { opacity: .5; cursor: default }\n'
    '.slask { margin-top: 8px; font-size: 13px } .loadnote { margin: 0 0 14px; padding: 8px 12px; background: #f9eeda; border-radius: 4px; font-size: 13px }',
    label='shell css')

# ---- page: the context and the workers in their own functions, so a loaded run can rebuild them
a = p.index('    const eng = forEngine(st.wx);\n', p.index('function startRun()'))
b = p.index('    // v16 phase 3.2: daylight only', a)
ctx_lines = p[a + len('    const eng = forEngine(st.wx);\n'):b]
p = p[:a] + '    const eng = setupCtx();\n' + p[b:]
loop0 = '    for (let k = 0; k < (st.wmode === "inline" ? 1 : NW); k++) {\n'
a = p.index(loop0, p.index('function startRun()'))
end = '      workers.push(w);\n    }\n'
b = p.index(end, a) + len(end)
loop = p[a:b]
loop = rep(loop, 'if (!w.ready && st.wmode === "file") { st.wmode = "inline"; startRun(); return; }',
    'if (!w.ready && st.wmode === "file") { st.wmode = "inline"; onFail(); return; }', label='onFail')
p = p[:a] + '    spawn(gen, eng, () => startRun());\n' + p[b:]
tail = '    t0 = performance.now(); scheduleRender(true);\n  }\n  let t0 = 0;\n'
p = rep(p, tail, '    t0 = performance.now(); scheduleRender(true);\n  }\n'
    '  // the engine context of a run (also rebuilt for a loaded run)\n'
    '  function setupCtx() {\n    const eng = forEngine(st.wx);\n' + ctx_lines + '    return eng;\n  }\n'
    '  // the calculation workers of a run; a loaded run gets them too, idle, for the checks computed on demand\n'
    '  function spawn(gen, eng, onFail) {\n' + loop + '  }\n  let t0 = 0;\n', label='tail')
p = rep(p, 'stopWorkers(); $("empty").hidden = true; $("results").hidden = false; setStale(false);\n',
    'stopWorkers(); $("empty").hidden = true; $("results").hidden = false; setStale(false);\n'
    '    st.runIn = snapIn(); st.runWx = st.wx; st.loaded = null; $("loadnote").hidden = true;\n', label='run snapshot')
# Save button state follows every render
p = rep(p, '  function renderAll() {\n', '  function renderAll() {\n    slButtons();\n', label='renderAll')
# the ori note is reused when inputs are restored
p = rep(p, '    const oriNote = () => {', '    const oriNote = oriNoteFn = () => {', label='oriNote')
p = rep(p, '    $("run").onclick = () => startRun();\n', '    $("run").onclick = () => startRun();\n    bindSaveLoad();\n', label='bind')

MOD = r'''  // ---- 0.11.0: save and load results (decision of 28 November 2026)
  /* One zip file holding results.json: the release, the date, the weather file as loaded, the inputs as they were at
     Run and every result of the run with the reading choices. Caches, the engine context and the Claude review and chat
     are left out; the context is rebuilt on loading, the caches as the results are drawn. */
  let oriNoteFn = null;
  const SL_SKIP = new Set(["wxList", "wx", "ctx", "ctxWx", "cache", "pcache", "prCache", "balCache", "modCache", "running", "gen", "wmode", "hover", "stale", "runIn", "runWx", "loaded", "detRun", "bgen"]);
  // the inputs that change the calculation, kept as they were at Run (saved in their place when the inputs changed since)
  const SL_IN = ["wxIdx", "use", "region", "model", "modelManual", "cat", "fans", "naFan", "dims", "wall", "coolSet", "fanW", "blindCtl", "blindRule", "blinds", "mods", "uhiLast", "copH", "copC", "limit", "ori", "types", "allow", "mode", "refineWin", "dlm", "floor"];
  const slPack = function (k, v) {
    if (k === "byKey") return undefined;
    if (typeof v === "number" && !Number.isFinite(v)) return { __n: String(v) };
    if (v instanceof Map) return { __map: [...v] };
    if (v instanceof Set) return { __set: [...v] };
    if (ArrayBuffer.isView(v)) return { __ta: v.constructor.name, v: Array.from(v, (x) => (Number.isFinite(x) ? x : String(x))) };
    return v;
  };
  const SL_TA = { Float64Array, Float32Array, Int32Array, Int16Array, Int8Array, Uint32Array, Uint16Array, Uint8Array };
  const slRevive = (k, v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return v;
    if (typeof v.__n === "string" && Object.keys(v).length === 1) return Number(v.__n);
    if (v.__map) return new Map(v.__map);
    if (v.__set) return new Set(v.__set);
    if (typeof v.__ta === "string" && Array.isArray(v.v)) { const C = SL_TA[v.__ta]; return C ? C.from(v.v, Number) : v.v; }
    return v;
  };
  const slCopy = (o) => JSON.parse(JSON.stringify(o, slPack), slRevive);
  const snapIn = () => { const o = {}; SL_IN.forEach((k) => { if (k in st) o[k] = st[k]; }); return slCopy(o); };
  const release = () => { const e = document.querySelector(".tbver"); return e ? e.textContent.replace(/\s*beta\s*$/i, "").trim() : ""; };
  const slBusy = () => st.running || queue.length > 0 || workers.some((w) => !w.idle);
  function slButtons() { const b = $("savres"); if (b && b.textContent === "Save results") b.disabled = !st.fac || slBusy(); }
  async function saveResults() {
    const pick = {}; for (const k in st) if (!SL_SKIP.has(k)) pick[k] = st[k];
    const changed = st.stale && st.runIn; if (changed) Object.assign(pick, st.runIn);
    const wx = changed && st.runWx ? st.runWx : st.wx, now = new Date();
    const doc = { app: "Room Clima", format: 1, release: release(), saved: now.toISOString(), weather: wx, st: pick };
    const z = new JSZip(); z.file("results.json", JSON.stringify(doc, slPack));
    const blob = await z.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    await saveFile(safeName(`RoomClima_${wx.name}_${st.use}_${doc.saved.slice(0, 10)}_results`) + ".zip", blob);
    return changed;
  }
  function askInline(text) {
    return new Promise((res) => {
      const b = $("slask"); b.querySelector("span").textContent = text; b.hidden = false;
      b.querySelector('[data-a="yes"]').onclick = () => { b.hidden = true; res(true); };
      b.querySelector('[data-a="no"]').onclick = () => { b.hidden = true; res(false); };
    });
  }
  async function readResults(f) {
    const head = new Uint8Array(await f.slice(0, 2).arrayBuffer());
    if (head[0] === 0x50 && head[1] === 0x4b) {
      const z = await JSZip.loadAsync(f), n = Object.keys(z.files).find((x) => /results\.json$/i.test(x)) || Object.keys(z.files).find((x) => /\.json$/i.test(x));
      if (!n) throw new Error("This zip file holds no Room Clima results.");
      return z.files[n].async("string");
    }
    return f.text();
  }
  async function loadResults(f) {
    const err = $("loaderr"); err.textContent = "";
    if (slBusy() && !(await askInline("A calculation is running. Stop it and load the file?"))) return;
    let doc;
    try { doc = JSON.parse(await readResults(f), slRevive); } catch (e) { err.textContent = "The file could not be read: " + e.message; return; }
    if (!doc || doc.app !== "Room Clima" || !doc.st || !doc.weather || !doc.st.fac) { err.textContent = "This is not a Room Clima results file."; return; }
    stopWorkers(); st.gen++; const gen = st.gen;
    // the weather: a file already in the list is reused, otherwise the saved one is added
    const W = doc.weather, same = (w) => w.name === W.name && w.t && W.t && w.t.length === W.t.length && [0, 1000, 4000, 8000].every((i) => w.t[i] === W.t[i]);
    let wi = st.wxList.findIndex(same); if (wi < 0) { st.wxList.push(W); wi = st.wxList.length - 1; }
    Object.assign(st, doc.st); st.wxIdx = wi; st.wx = st.wxList[wi];
    for (const sc in st.fac) (st.fac[sc] || []).forEach((F) => { if (F && F.rows) F.byKey = new Map(F.rows.map((x) => [FS.keyOf(x.dz), x])); });
    st.cache = {}; st.pcache = {}; st.prCache = {}; st.balCache = {}; st.modCache = null; st.detRun = null; st.stale = false;
    fmPending.clear(); scenPending.clear(); dinPending.clear();
    AI.review = null; AI.chat = []; if (typeof renderReview === "function") { renderReview(); renderChat(); }
    const dinC = st.dinC, eng = setupCtx(); st.dinC = dinC;
    st.runIn = snapIn(); st.runWx = st.wx; st.running = false; st.mainRun = false; st.facQueued = true;
    const fail = () => { stopWorkers(); spawn(gen, eng, fail); };
    spawn(gen, eng, fail);
    t0 = performance.now() - 1000 * (st.elapsed || 0);
    syncInputs(); setStale(false); $("empty").hidden = true; $("results").hidden = false;
    const rel = doc.release || "an earlier release", cur = release(), when = new Date(doc.saved);
    st.loaded = { name: f.name, release: rel, saved: doc.saved };
    $("loadnote").textContent = `Loaded ${f.name}: a run saved on ${isNaN(when) ? "an unknown date" : when.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.` + (rel !== cur ? ` Saved with ${rel}; this is ${cur}. Run again to update.` : "");
    $("loadnote").hidden = false;
    scheduleRender(true);
  }
  // the input controls redrawn from the state (after loading a run)
  function syncInputs() {
    fillControls(); $("region").value = st.region; wxInfo(); regionInfo(); modsSync();
    $("blindctl").value = st.blindCtl; $("blindrule").value = st.blindRule; blindThr();
    [["fcext", "exterior", "fc"], ["tauext", "exterior", "tau"], ["fcint", "interior", "fc"], ["tauint", "interior", "tau"]].forEach(([id, k, f]) => { const v = st.blinds[k][f]; $(id).value = v == null ? "" : v; });
    ["modeSeg|mode", "useSeg|use"].forEach((x) => { const [id, k] = x.split("|"); document.querySelectorAll(`#${id} button`).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === String(st[k]))); });
    $("dlm").value = st.dlm; $("floor").value = st.floor; $("dlnote").textContent = DLNOTE[st.dlm]; $("refwin").checked = !!st.refineWin;
    document.querySelectorAll("#ori input").forEach((x) => { x.checked = st.ori.includes(+x.value); });
    document.querySelectorAll("#types input").forEach((x) => { x.checked = st.types.includes(x.value); });
    if (oriNoteFn) oriNoteFn(); fillStrategies();
  }
  function bindSaveLoad() {
    const sb = $("savres");
    sb.onclick = async () => {
      $("loaderr").textContent = ""; sb.disabled = true; sb.textContent = "Saving the results";
      try { const changed = await saveResults(); $("loaderr").textContent = changed ? "The inputs changed after the run; the file keeps the inputs of the run." : ""; }
      catch (e) { $("loaderr").textContent = e && e.code === "declined" ? "Not saved." : "The results could not be saved: " + ((e && e.message) || e); }
      sb.textContent = "Save results"; slButtons();
    };
    $("loadres").onclick = () => $("loadfile").click();
    $("loadfile").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) loadResults(f); };
    slButtons();
  }
'''
p = rep(p, '  function init() {\n', MOD + '  function init() {\n', label='module')
P.write_text(p, encoding='utf-8'); SH.write_text(sh, encoding='utf-8')
print('ok')
