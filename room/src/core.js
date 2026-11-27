/* Climate-based daylight for a box room, in the browser.
   Daylight coefficients from a radiosity solution of the six room surfaces: sky and ground split into
   Reinhart patches (MF:2, 577 + ground, as Radiance), first arrival by stratified cosine-weighted rays from
   each sensor and surface patch, interreflection solved once per room (diffuse surfaces).
   Sky per hour: Perez all-weather model with Perez 1990 luminous efficacy, replicated from Radiance gendaymtx.
   Direct sun: exact ray test from each sensor through the glazing; its interreflected part enters through the
   sky patches nearest the sun, as gendaymtx does. Glazing: Radiance glass model (n = 1.52). */
(function (root) {
  "use strict";
  const PI = Math.PI, D2R = PI / 180;

  // ------------------------------------------------------------------ sky patches (Radiance rh_init)
  function skyPatches(mf) {
    const tnaz = [30, 30, 24, 24, 18, 12, 6], NROW = 7, nrow = NROW * mf, alpha = (PI / 2) / (nrow + 0.5);
    const alt = [-PI / 2], azi = [0], dom = [2 * PI], rowStart = [], rowN = [];
    for (let i = 0; i < nrow; i++) {
      const ralt = alpha * (i + 0.5), n = tnaz[Math.floor(i / mf)] * mf, d = 2 * PI * (Math.sin(alpha * (i + 1)) - Math.sin(alpha * i)) / n;
      rowStart.push(alt.length); rowN.push(n);
      for (let j = 0; j < n; j++) { alt.push(ralt); azi.push(2 * PI * j / n); dom.push(d); }
    }
    alt.push(PI / 2); azi.push(0); dom.push(2 * PI * (1 - Math.cos(alpha * 0.5)));
    const n = alt.length, vx = new Float64Array(n), vy = new Float64Array(n), vz = new Float64Array(n);
    for (let p = 0; p < n; p++) { const c = Math.cos(alt[p]); vx[p] = c * Math.sin(azi[p]); vy[p] = c * Math.cos(azi[p]); vz[p] = Math.sin(alt[p]); }
    return { mf, alpha, nrow, rowStart, rowN, alt, azi, dom, n, vx, vy, vz };
  }
  function patchOf(S, x, y, z) { // world direction: x east, y north, z up
    if (z <= 0) return 0;
    const a = Math.asin(Math.min(1, z)), r = Math.floor(a / S.alpha);
    if (r >= S.nrow) return S.n - 1;
    const n = S.rowN[r]; let A = Math.atan2(x, y); if (A < 0) A += 2 * PI;
    return S.rowStart[r] + (Math.round(A / (2 * PI) * n) % n);
  }

  // ------------------------------------------------------------------ glazing (Radiance glass.c)
  function tnOf(T) { return (Math.sqrt(0.8402528435 + 0.0072522239 * T * T) - 0.9166530661) / 0.0036261119 / T; }
  function glassT(tau) {
    const n = 1.52, tn = tnOf(tau);
    return (c) => {
      if (c <= 1e-6) return 0;
      const cos2 = Math.sqrt((1 - 1 / (n * n)) + c * c / (n * n)), d = Math.pow(tn, 1 / cos2);
      let re = (c - n * cos2) / (c + n * cos2); re *= re;
      let rm = (1 / c - n / cos2) / (1 / c + n / cos2); rm *= rm;
      return 0.5 * (1 - re) * (1 - re) * d / (1 - re * re * d * d) + 0.5 * (1 - rm) * (1 - rm) * d / (1 - rm * rm * d * d);
    };
  }

  // ------------------------------------------------------------------ room, wall depth, reveals, outdoor shading
  /* Local frame: x along facade A, y into the room, z up. Facade A: inner face y = 0, outward -y. Facade B: inner face
     x = 0, outward -x. The room box [0,W]x[0,D]x[0,H] is the clear interior. Walls with windows are c.wall.t deep
     (default 0); the glass sits c.wall.glass from the outer face. Openings get four reveal faces inside the glass
     (room surfaces, wall reflectance) and four outside it (exterior reflectance). Outdoor shading per window:
     w.overhang {depth, ext} at the head of the opening, w.fins {depth} at its jambs, both on the outer face.
     The outer facade is a large plane (100 m beyond the room) whose luminance is that of an unobstructed facade.
     Everything is a list of one-sided rectangles; glass is two-sided and transmits. */
  const add = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const neg = (a) => [-a[0], -a[1], -a[2]];
  function geometry(c) {
    const W = c.W, D = c.D, H = c.H, rf = c.refl, t = c.wall ? c.wall.t : 0, gp = c.wall ? Math.min(c.wall.glass, t) : 0, di = t - gp;
    const rhoExt = rf.ext != null ? rf.ext : 0.3, rhoIn = rf.revealIn != null ? rf.revealIn : rf.wall, BIG = 100;
    const R = [];
    const rect = (o, u, Lu, v, Lv, n, kind, rho, twin) => { if (Lu > 1e-9 && Lv > 1e-9) R.push({ o, u, v, Lu, Lv, n, kind, rho, twin: !!twin }); };
    // a rectangle in wall coordinates with an optional hole, split into up to four pieces
    const split = (P, ea, ez, a0, a1, z0, z1, hole, n, kind, rho) => {
      const pcs = !hole ? [[a0, a1, z0, z1]] : [[a0, hole.x0, z0, z1], [hole.x1, a1, z0, z1], [hole.x0, hole.x1, z0, hole.z0], [hole.x0, hole.x1, hole.z1, z1]];
      for (const [b0, b1, c0, c1] of pcs) rect(P(b0, c0, 0), ea, b1 - b0, ez, c1 - c0, n, kind, rho);
    };
    const walls = {
      A: { L: W, ea: [1, 0, 0], ez: [0, 0, 1], en: [0, -1, 0], o: [0, 0, 0] },
      B: { L: D, ea: [0, 1, 0], ez: [0, 0, 1], en: [-1, 0, 0], o: [0, 0, 0] } };
    const ext = new Set(c.windows.map((w) => w.wall).concat(c.facades || []));
    // room surfaces
    rect([0, 0, 0], [1, 0, 0], W, [0, 1, 0], D, [0, 0, 1], "room", rf.floor);
    rect([0, 0, H], [1, 0, 0], W, [0, 1, 0], D, [0, 0, -1], "room", rf.ceiling);
    rect([0, D, 0], [1, 0, 0], W, [0, 0, 1], H, [0, -1, 0], "room", rf.wall);
    rect([W, 0, 0], [0, 1, 0], D, [0, 0, 1], H, [-1, 0, 0], "room", rf.wall);
    for (const k of ["A", "B"]) {
      const g = walls[k], w = c.windows.find((x) => x.wall === k);
      const P = (a, z, d) => add(add(add(g.o, g.ea, a), g.ez, z), g.en, d);
      split(P, g.ea, g.ez, 0, g.L, 0, H, w, neg(g.en), "room", rf.wall);
      if (!ext.has(k)) continue;
      // outer facade (cellular room: open both ways; corner room: stops at the corner)
      const a0 = ext.has(k === "A" ? "B" : "A") ? -t : -BIG;
      const Pf = (a, z) => P(a, z, t);
      split(Pf, g.ea, g.ez, a0, g.L + BIG, -BIG, BIG, w, g.en, "facade", rhoExt);
      if (!w) continue;
      const bw = w.x1 - w.x0, bh = w.z1 - w.z0;
      const reveal = (d0, dd, kind, rho) => {
        rect(P(w.x0, w.z0, d0), g.ea, bw, g.en, dd, g.ez, kind, rho);           // sill
        rect(P(w.x0, w.z1, d0), g.ea, bw, g.en, dd, neg(g.ez), kind, rho);      // head
        rect(P(w.x0, w.z0, d0), g.ez, bh, g.en, dd, g.ea, kind, rho);           // jamb at x0
        rect(P(w.x1, w.z0, d0), g.ez, bh, g.en, dd, neg(g.ea), kind, rho);      // jamb at x1
      };
      reveal(0, di, "revIn", rhoIn);
      R.push({ o: P(w.x0, w.z0, di), u: g.ea, v: g.ez, Lu: bw, Lv: bh, n: g.en, kind: "glass", rho: 0, tf: w.tf != null ? w.tf : 1 });
      reveal(di, gp, "revOut", rhoExt);
      if (w.overhang && w.overhang.depth > 0) {
        const e = w.overhang.ext || 0, o = P(w.x0 - e, w.z1, t);
        rect(o, g.ea, bw + 2 * e, g.en, w.overhang.depth, g.ez, "dev", rhoExt);
        rect(o, g.ea, bw + 2 * e, g.en, w.overhang.depth, neg(g.ez), "dev", rhoExt, true);
      }
      if (w.fins && w.fins.depth > 0) for (const x of [w.x0, w.x1]) {
        const o = P(x, w.z0, t);
        rect(o, g.ez, bh, g.en, w.fins.depth, g.ea, "dev", rhoExt);
        rect(o, g.ez, bh, g.en, w.fins.depth, neg(g.ea), "dev", rhoExt, true);
      }
    }
    return R;
  }
  function makeRoom(c, patchSize) {
    const ps = patchSize || 0.4, G = geometry(c), P = [], FAC = [];
    G.forEach((r, ri) => {
      if (r.kind === "facade") { r.fac = FAC.length; FAC.push(r.n); return; }
      if (r.kind === "glass") return;
      r.nu = Math.max(1, Math.round(r.Lu / ps)); r.nv = Math.max(1, Math.round(r.Lv / ps)); r.base = P.length;
      for (let i = 0; i < r.nu; i++) for (let j = 0; j < r.nv; j++) {
        const a = (i + 0.5) * r.Lu / r.nu, b = (j + 0.5) * r.Lv / r.nv;
        P.push({ f: ri, a, b, area: r.Lu * r.Lv / (r.nu * r.nv), rho: r.rho, kind: r.kind, n: r.n, p: add(add(r.o, r.u, a), r.v, b) });
      }
    });
    // facades share one luminance per facade orientation; merge identical normals (pieces of one facade)
    const key = (n) => n.map((x) => Math.round(x * 1e6)).join(","), uniq = [], idx = {};
    G.forEach((r) => { if (r.kind !== "facade") return; const k = key(r.n); if (!(k in idx)) { idx[k] = uniq.length; uniq.push(r.n); } r.fac = idx[k]; });
    return { W: c.W, D: c.D, H: c.H, G, P, facN: uniq };
  }
  /* Trace a ray. Returns {sky: true, w, d} (escaped; w = product of glass transmittances), {patch, w} or {facade, w}.
     T: glass transmittance as a function of incidence cosine. */
  function trace(R, px, py, pz, dx, dy, dz, T) {
    let w = 1, skip = -1, g0 = -1; // g0: index (in R.G) of the first glass the ray crosses from inside to outside
    for (let guard = 0; guard < 6; guard++) {
      let best = Infinity, bi = -1, ba = 0, bb = 0, bc = 0;
      for (let i = 0; i < R.G.length; i++) {
        if (i === skip) continue;
        const r = R.G[i], n = r.n, den = dx * n[0] + dy * n[1] + dz * n[2];
        if (r.kind === "glass" ? Math.abs(den) < 1e-12 : den > -1e-12) continue;
        const s = ((r.o[0] - px) * n[0] + (r.o[1] - py) * n[1] + (r.o[2] - pz) * n[2]) / den;
        if (s <= 1e-9 || s >= best) continue;
        const hx = px + s * dx - r.o[0], hy = py + s * dy - r.o[1], hz = pz + s * dz - r.o[2];
        const a = hx * r.u[0] + hy * r.u[1] + hz * r.u[2]; if (a < 0 || a > r.Lu) continue;
        const b = hx * r.v[0] + hy * r.v[1] + hz * r.v[2]; if (b < 0 || b > r.Lv) continue;
        best = s; bi = i; ba = a; bb = b; bc = Math.abs(den);
      }
      if (bi < 0) return { sky: true, w, g0 };
      const r = R.G[bi];
      if (r.kind === "glass") { if (g0 < 0 && dx * r.n[0] + dy * r.n[1] + dz * r.n[2] > 0) g0 = bi;
        w *= T(bc) * r.tf; if (!(w > 0)) return { patch: -1, w: 0, g0 }; px += best * dx; py += best * dy; pz += best * dz; skip = bi; continue; }
      if (r.kind === "facade") return { facade: r.fac, w, g0 };
      const i = Math.min(r.nu - 1, Math.max(0, Math.floor(ba / r.Lu * r.nu))), j = Math.min(r.nv - 1, Math.max(0, Math.floor(bb / r.Lv * r.nv)));
      return { patch: r.base + i * r.nv + j, w, g0 };
    }
    return { patch: -1, w: 0 };
  }
  function frame(n) { // orthonormal tangents
    const a = Math.abs(n[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0];
    const t = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]], l = Math.hypot(...t);
    const u = t.map((x) => x / l), v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    return [u, v];
  }
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  /* Daylight coefficients for a room. c: {W, D, H, az, tau, windows, refl, sensors:[[x,y,z]]}
     Returns DCs (sensors x patches: direct sky through glass plus interreflected), DCi (interreflected only). */
  function coefficients(c, opt) {
    opt = opt || {};
    const S = opt.sky || skyPatches(2), R = makeRoom(c, opt.patchSize), T = glassT(c.tau);
    const nP = R.P.length, nS = c.sensors.length, NP = S.n, nF = R.facN.length;
    const rot = (c.az - 180) * D2R, cr = Math.cos(rot), sr = Math.sin(rot); // local -> world: rotate clockwise by az-180
    const toWorld = (x, y, z) => [x * cr + y * sr, -x * sr + y * cr, z];
    // luminance of an unobstructed facade per unit sky patch luminance (exterior reflectance / pi x irradiance coefficient)
    const rhoExt = c.refl.ext != null ? c.refl.ext : 0.3;
    const facL = R.facN.map((n) => { const [X, Y, Z] = toWorld(n[0], n[1], n[2]), v = new Float64Array(NP);
      v[0] = rhoExt / PI * PI * (1 - Z) / 2; // ground, view factor (1 - cos tilt) / 2
      for (let q = 1; q < NP; q++) { const cs = X * S.vx[q] + Y * S.vy[q] + Z * S.vz[q]; if (cs > 0) v[q] = rhoExt / PI * S.dom[q] * cs; }
      return v; });
    const nsS = opt.raysSensor || 64, nsP = opt.raysPatch || 32; // strata per side
    const Fs = new Float64Array(nS * nP), DCd = new Float64Array(nS * NP), Gs = new Float64Array(nS * nF);
    const Fp = new Float64Array(nP * nP), Ep = new Float64Array(nP * NP), Gp = new Float64Array(nP * nF);
    // v16 blinds as diffusing layers: each glass also acts as a uniform diffuse source; Ws, Wp: light at sensors and patches
    // per unit exitance of each glass (rays leaving the room through it, cosine-weighted, so each counts 1/N)
    const GL = []; R.G.forEach((r, i) => { if (r.kind === "glass") GL.push(i); }); const nG = GL.length, gIdx = {}; GL.forEach((gi, k) => { gIdx[gi] = k; });
    const Ws = new Float64Array(nS * nG), Wp = new Float64Array(nP * nG);
    const shoot = (p, n, ns, seed, onSky, onPatch, onFac, onGlass) => {
      const [u, v] = frame(n), r = rng(seed), N = ns * ns, w = PI / N;
      for (let i = 0; i < ns; i++) for (let j = 0; j < ns; j++) {
        const u1 = (i + r()) / ns, u2 = (j + r()) / ns, st = Math.sqrt(u1), ct = Math.sqrt(1 - u1), ph = 2 * PI * u2;
        const cx = st * Math.cos(ph), cy = st * Math.sin(ph);
        const dx = u[0] * cx + v[0] * cy + n[0] * ct, dy = u[1] * cx + v[1] * cy + n[1] * ct, dz = u[2] * cx + v[2] * cy + n[2] * ct;
        const h = trace(R, p[0], p[1], p[2], dx, dy, dz, T);
        if (onGlass && h.g0 >= 0) onGlass(gIdx[h.g0], 1 / N);
        if (h.sky) { const [X, Y, Z] = toWorld(dx, dy, dz); onSky(patchOf(S, X, Y, Z), w * h.w); }
        else if (h.facade != null) onFac(h.facade, w * h.w);
        else if (h.patch >= 0) onPatch(h.patch, h.w / N);
      }
    };
    c.sensors.forEach((s, k) => shoot(s, [0, 0, 1], nsS, 7919 * (k + 1), (q, x) => { DCd[k * NP + q] += x; }, (j, x) => { Fs[k * nP + j] += x; }, (f, x) => { Gs[k * nF + f] += x; }, (g, x) => { Ws[k * nG + g] += x; }));
    R.P.forEach((P, k) => {
      const e = 1e-6, p = add(P.p, P.n, e);
      shoot(p, P.n, nsP, 104729 * (k + 1), (q, x) => { Ep[k * NP + q] += x; }, (j, x) => { Fp[k * nP + j] += x; }, (f, x) => { Gp[k * nF + f] += x; }, P.kind === "room" ? (g, x) => { Wp[k * nG + g] += x; } : null);
    });
    // light arriving at each glass, facing outward: just inside it (through the glass: on an interior blind) and just outside
    // it (on an exterior blind); 3 x 3 points per glass, sky and ground patches plus the facade, sun added per hour
    const nsW = opt.raysWindow || 24, WP = [], DWin = new Float64Array(nG * NP), DWout = new Float64Array(nG * NP), FWin = new Float64Array(nG * NP), FWout = new Float64Array(nG * NP);
    GL.forEach((gi, g) => {
      const r = R.G[gi]; WP.push([]);
      for (const side of [-1, 1]) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        const p = add(add(add(r.o, r.u, (a + 0.5) * r.Lu / 3), r.v, (b + 0.5) * r.Lv / 3), r.n, side * 1e-4), D = side < 0 ? DWin : DWout, Fa = side < 0 ? FWin : FWout;
        WP[g].push({ p, side });
        shoot(p, r.n, nsW, 7907 * (gi + 1) + 31 * (3 * a + b) + (side > 0 ? 17 : 0), (q, x) => { D[g * NP + q] += x / 9; }, () => {}, (f, x) => { for (let q = 0; q < NP; q++) Fa[g * NP + q] += x / 9 * facL[f][q]; });
      }
    });
    for (let k = 0; k < nP; k++) for (let f = 0; f < nF; f++) { const g = Gp[k * nF + f]; if (g) for (let q = 0; q < NP; q++) Ep[k * NP + q] += g * facL[f][q]; }
    // K = Fs (I - diag(rho) F)^-1 : solve A^T K^T = Fs^T with A = I - diag(rho) F
    const A = new Float64Array(nP * nP);
    for (let i = 0; i < nP; i++) { const rho = R.P[i].rho; for (let j = 0; j < nP; j++) A[j * nP + i] = (i === j ? 1 : 0) - rho * Fp[i * nP + j]; } // A^T stored
    const X = new Float64Array(nP * nS); for (let k = 0; k < nS; k++) for (let j = 0; j < nP; j++) X[j * nS + k] = Fs[k * nP + j];
    solve(A, X, nP, nS);
    // DCi = K diag(rho) Ep + facade seen directly
    const DCi = new Float64Array(nS * NP);
    for (let j = 0; j < nP; j++) { const rho = R.P[j].rho; if (!rho) continue;
      for (let k = 0; k < nS; k++) { const g = X[j * nS + k] * rho; if (!g) continue; const o = k * NP, e = j * NP; for (let q = 0; q < NP; q++) DCi[o + q] += g * Ep[e + q]; } }
    for (let k = 0; k < nS; k++) for (let f = 0; f < nF; f++) { const g = Gs[k * nF + f]; if (g) for (let q = 0; q < NP; q++) DCi[k * NP + q] += g * facL[f][q]; }
    const DCs = new Float64Array(nS * NP); for (let i = 0; i < DCs.length; i++) DCs[i] = DCd[i] + DCi[i];
    // a glass as a diffuse source: seen directly from the sensors, plus interreflected through the room surfaces
    const WD = new Float64Array(nS * nG);
    for (let k = 0; k < nS; k++) for (let g = 0; g < nG; g++) { let v = Ws[k * nG + g]; for (let j = 0; j < nP; j++) { const rho = R.P[j].rho; if (rho) v += X[j * nS + k] * rho * Wp[j * nG + g]; } WD[k * nG + g] = v; }
    const glass = GL.map((gi, g) => ({ n: R.G[gi].n, pts: WP[g] }));
    for (let i = 0; i < DWin.length; i++) { DWin[i] += FWin[i]; DWout[i] += FWout[i]; }
    return { S, R, T, nS, NP, nP, DCs, DCi, rot, toWorld, sensors: c.sensors, room: c, nG, WD, glass, DWin, DWout, FWin, FWout };
  }
  function solve(A, B, n, m) { // Gaussian elimination with partial pivoting, A n x n (row-major), B n x m, in place
    for (let c = 0; c < n; c++) {
      let p = c, mx = Math.abs(A[c * n + c]);
      for (let r = c + 1; r < n; r++) { const v = Math.abs(A[r * n + c]); if (v > mx) { mx = v; p = r; } }
      if (p !== c) { for (let k = 0; k < n; k++) { const t = A[c * n + k]; A[c * n + k] = A[p * n + k]; A[p * n + k] = t; } for (let k = 0; k < m; k++) { const t = B[c * m + k]; B[c * m + k] = B[p * m + k]; B[p * m + k] = t; } }
      const d = A[c * n + c];
      for (let r = c + 1; r < n; r++) { const f = A[r * n + c] / d; if (!f) continue; for (let k = c; k < n; k++) A[r * n + k] -= f * A[c * n + k]; for (let k = 0; k < m; k++) B[r * m + k] -= f * B[c * m + k]; }
    }
    for (let c = n - 1; c >= 0; c--) { const d = A[c * n + c]; for (let k = 0; k < m; k++) { let s = B[c * m + k]; for (let j = c + 1; j < n; j++) s -= A[c * n + j] * B[j * m + k]; B[c * m + k] = s / d; } }
  }

  // ------------------------------------------------------------------ sky per hour (Radiance gendaymtx, irradiance input)
  const PEREZ = [[1.3525, -0.2576, -0.2690, -1.4366, -0.7670, 0.0007, 1.2734, -0.1233, 2.8000, 0.6004, 1.2375, 1.0000, 1.8734, 0.6297, 0.9738, 0.2809, 0.0356, -0.1246, -0.5718, 0.9938],
    [-1.2219, -0.7730, 1.4148, 1.1016, -0.2054, 0.0367, -3.9128, 0.9156, 6.9750, 0.1774, 6.4477, -0.1239, -1.5798, -0.5081, -1.7812, 0.1080, 0.2624, 0.0672, -0.2190, -0.4285],
    [-1.1000, -0.2515, 0.8952, 0.0156, 0.2782, -0.1812, -4.5000, 1.1766, 24.7219, -13.0812, -37.7000, 34.8438, -5.0000, 1.5218, 3.9229, -2.6204, -0.0156, 0.1597, 0.4199, -0.5562],
    [-0.5484, -0.6654, -0.2672, 0.7117, 0.7234, -0.6219, -5.6812, 2.6297, 33.3389, -18.3000, -62.2500, 52.0781, -3.5000, 0.0016, 1.1477, 0.1062, 0.4659, -0.3296, -0.0876, -0.0329],
    [-0.6000, -0.3566, -2.5000, 2.3250, 0.2937, 0.0496, -5.6812, 1.8415, 21.0000, -4.7656, -21.5906, 7.2492, -3.5000, -0.1554, 1.4062, 0.3988, 0.0032, 0.0766, -0.0656, -0.1294],
    [-1.0156, -0.3670, 1.0078, 1.4051, 0.2875, -0.5328, -3.8500, 3.3750, 14.0000, -0.9999, -7.1406, 7.5469, -3.4000, -0.1078, -1.0750, 1.5702, -0.0672, 0.4016, 0.3017, -0.4844],
    [-1.0000, 0.0211, 0.5025, -0.5119, -0.3000, 0.1922, 0.7023, -1.6317, 19.0000, -5.0000, 1.2438, -1.9094, -4.0000, 0.0250, 0.3844, 0.2656, 1.0468, -0.3788, -2.4517, 1.4656],
    [-1.0500, 0.0289, 0.4260, 0.3590, -0.3250, 0.1156, 0.7781, 0.0025, 31.0625, -14.5000, -46.1148, 55.3750, -7.2312, 0.4050, 13.3500, 0.6234, 1.5000, -0.6426, 1.8564, 0.5636]];
  const CAT = [1.065, 1.230, 1.500, 1.950, 2.800, 4.500, 6.200, 12.01];
  const KD = [[97.24, -0.46, 12.00, -8.91], [107.22, 1.15, 0.59, -3.95], [104.97, 2.96, -5.53, -8.77], [102.39, 5.59, -13.95, -13.90], [100.71, 5.94, -22.75, -23.74], [106.42, 3.83, -36.15, -28.83], [141.88, 1.90, -53.24, -14.03], [152.23, 0.35, -45.27, -7.98]];
  const KB = [[57.20, -4.55, -2.98, 117.12], [98.99, -3.46, -1.21, 12.38], [109.83, -4.90, -1.71, -8.81], [110.34, -5.84, -1.99, -4.56], [106.36, -3.97, -1.75, -6.16], [107.19, -1.25, -1.51, -26.73], [105.75, 0.77, -1.26, -34.44], [101.18, 1.58, -1.10, -8.29]];
  const MDA = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  /* Hourly sky for a year. wx: {lat, lon (east +), tz (h), dni[8760], dhi[8760]}. Returns per hour: patch luminance (cd/m2),
     sun direction (world), direct normal illuminance (lux), and the four sun patches with weights for the interreflected path. */
  function skies(wx, S, rotDeg) {
    const rotS = (rotDeg || 0) * D2R; // sky in the frame of a room turned by rotDeg (azimuth of facade A minus 180)
    const apwc = Math.exp(0.07 * 11 - 0.075), CMx = root.ClimaMods || globalThis.ClimaMods, SUN = CMx.solarArrays(wx.lat, wx.lon, wx.tz);
    const out = { L: new Float32Array(8760 * S.n), sun: new Float32Array(8760 * 3), Edn: new Float32Array(8760), Edh: new Float32Array(8760), sunP: new Int32Array(8760 * 4), sunW: new Float32Array(8760 * 4) };
    let i = 0;
    for (let mo = 0; mo < 12; mo++) for (let da = 1; da <= MDAYS[mo]; da++) for (let h = 1; h <= 24; h++, i++) {
      const jd = MDA[mo] + da, hr = h - 0.5;
      // sun from the shared Clima Toolbox core (as the thermal model and the other apps), azimuth from north, clockwise
      const alt = SUN.alt[i] * D2R, azi = SUN.az[i] * D2R - rotS;
      const sx = Math.cos(alt) * Math.sin(azi), sy = Math.cos(alt) * Math.cos(azi), sz = Math.sin(alt);
      out.sun[3 * i] = sx; out.sun[3 * i + 1] = sy; out.sun[3 * i + 2] = sz;
      const dir = wx.dni[i], dif = wx.dhi[i];
      if (dir + dif <= 1e-4) continue;
      const szn = alt <= 0 ? PI / 2 : alt >= 87 * D2R ? 3 * D2R : PI / 2 - alt;
      const ecc = (() => { const a = (jd - 1) * 2 * PI / 365; return 1.00011 + 0.034221 * Math.cos(a) + 0.00128 * Math.sin(a) + 0.000719 * Math.cos(2 * a) + 0.000077 * Math.sin(2 * a); })();
      const am = 1 / (Math.cos(szn) + 0.15 * Math.pow(93.885 - szn / D2R, -1.253));
      let br = dif * am / (1367 * ecc), z3 = szn * szn * szn, cl = ((dif + dir) / dif + 1.041 * z3) / (1 + 1.041 * z3);
      if (!(dif > 0)) cl = 11.9;
      cl = Math.min(11.9, Math.max(1, cl)); br = Math.min(0.6, Math.max(0.01, br));
      let k = 0; while (k < 7 && !(cl < CAT[k])) k++;
      const dIll = dif * (KD[k][0] + KD[k][1] * apwc + KD[k][2] * Math.cos(szn) + KD[k][3] * Math.log(br));
      const bIll = dir * Math.max(0, KB[k][0] + KB[k][1] * apwc + KB[k][2] * Math.exp(5.73 * szn - 5) + KB[k][3] * br);
      out.Edn[i] = alt > 0 ? bIll : 0; out.Edh[i] = dIll;
      const o = i * S.n;
      out.L[o] = 0.2 * (dIll + (alt > 0 ? bIll * Math.sin(alt) : 0)) / PI; // ground
      // Perez parameters
      let delta = br; if (cl > 1.065 && cl < 2.8 && delta < 0.2) delta = 0.2;
      const x = PEREZ[k], pp = [0, 0, 0, 0, 0];
      if (k !== 0) for (let m = 0; m < 5; m++) pp[m] = x[4 * m] + x[4 * m + 1] * szn + delta * (x[4 * m + 2] + x[4 * m + 3] * szn);
      else { pp[0] = x[0] + x[1] * szn + delta * (x[2] + x[3] * szn); pp[1] = x[4] + x[5] * szn + delta * (x[6] + x[7] * szn); pp[4] = x[16] + x[17] * szn + delta * (x[18] + x[19] * szn);
        pp[2] = Math.exp(Math.pow(delta * (x[8] + x[9] * szn), x[10])) - x[11]; pp[3] = -Math.exp(delta * (x[12] + x[13] * szn)) + x[14] + delta * x[15]; }
      let rel = 0;
      for (let p = 1; p < S.n; p++) {
        const zsa = PI / 2 - S.alt[p], aas = Math.abs(S.azi[p] - azi);
        const g = Math.acos(Math.max(-1, Math.min(1, Math.cos(szn) * Math.cos(zsa) + Math.sin(szn) * Math.sin(zsa) * Math.cos(aas))));
        let l = (1 + pp[0] * Math.exp(pp[1] / Math.cos(zsa))) * (1 + pp[2] * Math.exp(pp[3] * g) + pp[4] * Math.cos(g) * Math.cos(g));
        if (!(l > 0)) l = 0;
        out.L[o + p] = l; rel += l * Math.sin(S.alt[p]) * S.dom[p];
      }
      const norm = rel > 1e-9 ? dIll / rel : 0;
      for (let p = 1; p < S.n; p++) out.L[o + p] *= norm;
      // sun into its four nearest patches (gendaymtx AddDirect), used only for the interreflected path
      if (out.Edn[i] > 1e-4) {
        const best = [-1, -1, -1, -1], bp = [0, 0, 0, 0];
        for (let p = 1; p < S.n; p++) { const dp = S.vx[p] * sx + S.vy[p] * sy + S.vz[p] * sz;
          for (let q = 0; q < 4; q++) if (dp > best[q]) { for (let r = 3; r > q; r--) { best[r] = best[r - 1]; bp[r] = bp[r - 1]; } best[q] = dp; bp[q] = p; break; } }
        let wt = 0; const wa = best.map((d) => 1 / (1.002 - d)); wa.forEach((w) => { wt += w; });
        for (let q = 0; q < 4; q++) { out.sunP[4 * i + q] = bp[q]; out.sunW[4 * i + q] = wa[q] / wt * out.Edn[i] / S.dom[bp[q]]; }
      }
    }
    return out;
  }

  /* Hourly illuminance at the sensors (lux) for a set of hours.
     Returns {E: Float32Array(nS * nH) total, Es: direct sun only}. fGlass (optional per hour) scales all light through
     the glazing, e.g. a blind's visible transmittance in the hours it is down. */
  function illuminance(dc, sk, hours, fGlass) {
    const { nS, NP, DCs, DCi, S } = dc, nH = hours.length, E = new Float32Array(nS * nH), Es = new Float32Array(nS * nH);
    const W = dc.room, rot = dc.rot, cr = Math.cos(rot), sr = Math.sin(rot);
    const R = dc.R;
    for (let t = 0; t < nH; t++) {
      const i = hours[t], o = i * NP, f = fGlass ? fGlass[t] : 1;
      if (!(sk.L[o] > 0) && !(sk.Edn[i] > 0)) continue;
      // world sun -> local: inverse of toWorld
      const X = sk.sun[3 * i], Y = sk.sun[3 * i + 1], Z = sk.sun[3 * i + 2];
      const lx = X * cr - Y * sr, ly = X * sr + Y * cr, lz = Z;
      for (let k = 0; k < nS; k++) {
        let e = 0; const r = k * NP;
        for (let p = 0; p < NP; p++) e += DCs[r + p] * sk.L[o + p];
        for (let q = 0; q < 4; q++) { const w = sk.sunW[4 * i + q]; if (w) e += DCi[r + sk.sunP[4 * i + q]] * w; }
        let es = 0;
        if (sk.Edn[i] > 0 && lz > 0) {
          const s = dc.sensors[k], h = trace(R, s[0], s[1], s[2], lx, ly, lz, dc.T);
          if (h.sky) es = sk.Edn[i] * h.w * lz;
        }
        E[k * nH + t] = (e + es) * f; Es[k * nH + t] = es * f;
      }
    }
    return { E, Es, nH };
  }

  /* Light arriving at each glass of the room per hour (lux on the plane of the glass, facing out): Ein just inside the glass
     (what reaches an interior blind), Eout just outside it (what reaches an exterior blind). Sky and ground from the
     patches, facade light from the facade luminance, sun traced from each of the 3 x 3 points of the glass. */
  function windowLight(dc, sk, hours) {
    const { NP, nG, DWin, DWout, FWin, FWout, glass, R } = dc, nH = hours.length, Ein = new Float32Array(nG * nH), Eout = new Float32Array(nG * nH);
    const rot = dc.rot, cr = Math.cos(rot), sr = Math.sin(rot);
    for (let t = 0; t < nH; t++) {
      const i = hours[t], o = i * NP;
      if (!(sk.L[o] > 0) && !(sk.Edn[i] > 0)) continue;
      const X = sk.sun[3 * i], Y = sk.sun[3 * i + 1], Z = sk.sun[3 * i + 2], lx = X * cr - Y * sr, ly = X * sr + Y * cr, lz = Z;
      for (let g = 0; g < nG; g++) {
        let ei = 0, eo = 0; const r = g * NP;
        for (let p = 0; p < NP; p++) { const L = sk.L[o + p]; ei += DWin[r + p] * L; eo += DWout[r + p] * L; }
        for (let q = 0; q < 4; q++) { const w = sk.sunW[4 * i + q]; if (w) { const pq = sk.sunP[4 * i + q]; ei += FWin[r + pq] * w; eo += FWout[r + pq] * w; } }
        const n = glass[g].n, ci = lx * n[0] + ly * n[1] + lz * n[2];
        if (sk.Edn[i] > 0 && lz > 0 && ci > 0) for (const P of glass[g].pts) {
          const h = trace(R, P.p[0], P.p[1], P.p[2], lx, ly, lz, dc.T);
          if (h.sky) { const e = sk.Edn[i] * h.w * ci / 9; if (P.side < 0) ei += e; else eo += e; }
        }
        Ein[g * nH + t] = ei; Eout[g * nH + t] = eo;
      }
    }
    return { Ein, Eout, nH };
  }
  // hemispherical (diffuse) transmittance of the glass: 2 x integral of T(cos) cos sin over the incidence angle
  function glassDiffuse(tau) { const T = glassT(tau); let s = 0; const n = 900; for (let k = 0; k < n; k++) { const th = (k + 0.5) / n * PI / 2; s += T(Math.cos(th)) * Math.cos(th) * Math.sin(th); } return 2 * s * (PI / 2) / n; }

  // ------------------------------------------------------------------ metrics (IES LM-83, UDI, EN 17037)
  function metrics(il, nS, opt) {
    opt = opt || {};
    const { E, Es, nH } = il, lim = opt.sda || 300, frac = 0.5;
    let sda = 0, ase = 0, udi = 0, udiLow = 0, udiHigh = 0, mean = 0;
    for (let k = 0; k < nS; k++) {
      let n300 = 0, nsun = 0, nu = 0, nl = 0, nh = 0, s = 0;
      for (let t = 0; t < nH; t++) { const e = E[k * nH + t]; s += e; if (e >= lim) n300++; if (Es[k * nH + t] >= 1000) nsun++; if (e < 100) nl++; else if (e > 3000) nh++; else nu++; }
      if (n300 >= frac * nH) sda++; if (nsun > 250) ase++;
      udi += nu / nH; udiLow += nl / nH; udiHigh += nh / nH; mean += s / nH;
    }
    return { sDA: 100 * sda / nS, ASE: 100 * ase / nS, UDI: 100 * udi / nS, UDIlow: 100 * udiLow / nS, UDIhigh: 100 * udiHigh / nS, Emean: mean / nS };
  }
  // EN 17037 climate-based route: share of floor reaching E for at least half of the daylight hours
  function en17037(il, nS) {
    const { E, nH } = il, area = (lux) => { let n = 0; for (let k = 0; k < nS; k++) { let c = 0; for (let t = 0; t < nH; t++) if (E[k * nH + t] >= lux) c++; if (c >= 0.5 * nH) n++; } return 100 * n / nS; };
    const a300 = area(300), a100 = area(100), a500 = area(500), a750 = area(750);
    return { a300, a100, a500, a750, minimum: a300 >= 50 && a100 >= 95, medium: a500 >= 50 && a300 >= 95, high: a750 >= 50 && a500 >= 95 };
  }
  function occupiedHours() { const h = []; for (let i = 0; i < 8760; i++) { const k = i % 24; if (k >= 8 && k < 18) h.push(i); } return h; }

  const api = { skyPatches, patchOf, glassT, tnOf, glassDiffuse, geometry, makeRoom, trace, coefficients, skies, illuminance, windowLight, metrics, en17037, occupiedHours };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Daylight = api;
})(typeof window !== "undefined" ? window : globalThis);

/* Shading of a recessed window by its outer reveal, an overhang and side fins, from the same geometry as the
   daylight model (Daylight.geometry). Per hour: sunlit share of the glass for beam and circumsolar light. Constant:
   share of the isotropic sky, of the horizon band and of the ground that the glass still sees, relative to an
   unobstructed vertical window. Reflections from the reveal and shading devices are neglected, as in EnergyPlus
   without its reflection option. */
(function (root) {
  "use strict";
  const DL = typeof module !== "undefined" && module.exports ? require("./daylight.js") : root.Daylight;
  const PI = Math.PI, D2R = PI / 180;
  // win: {w, h, t (wall depth), glass (glass distance from outer face), overhang: {depth, ext}, fins: {depth}}
  function windowShade(win, surfAz, sun, opt) {
    opt = opt || {};
    const x0 = 0.5, z0 = 0.5, W = { x0, x1: x0 + win.w, z0, z1: z0 + win.h, wall: "A", overhang: win.overhang, fins: win.fins };
    const c = { W: win.w + 1, D: 1, H: win.h + 1, windows: [W], wall: { t: win.t || 0, glass: win.glass || 0 }, refl: { floor: 0, wall: 0, ceiling: 0, ext: 0 } };
    const R = { G: DL.geometry(c) }, T = () => 1, yg = -((win.t || 0) - (win.glass || 0)) - 1e-6;
    const ng = opt.grid || 12, pts = [];
    for (let i = 0; i < ng; i++) for (let j = 0; j < ng; j++) pts.push([x0 + (i + 0.5) * win.w / ng, yg, z0 + (j + 0.5) * win.h / ng]);
    const open = (p, d) => DL.trace(R, p[0], p[1], p[2], d[0], d[1], d[2], T).sky === true;
    const rot = (surfAz - 180) * D2R, cr = Math.cos(rot), sr = Math.sin(rot);
    const local = (X, Y, Z) => [X * cr - Y * sr, X * sr + Y * cr, Z];
    // beam: sun.az, sun.el in degrees (azimuth from north, clockwise)
    const n = sun.el.length, beam = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const el = sun.el[i] * D2R, az = sun.az[i] * D2R;
      const d = local(Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el));
      if (el <= 0 || d[1] >= -1e-9) { beam[i] = 1; continue; }
      let k = 0; for (const p of pts) if (open(p, d)) k++;
      beam[i] = k / pts.length;
    }
    // diffuse: cosine-weighted rays about the outward normal (0,-1,0)
    const ns = opt.strata || 24, sub = [];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) sub.push([x0 + (i + 0.5) * win.w / 8, yg, z0 + (j + 0.5) * win.h / 8]);
    let sky = 0, gnd = 0, N = 0;
    for (const p of sub) for (let a = 0; a < ns; a++) for (let b = 0; b < ns; b++) {
      const u1 = (a + 0.5) / ns, u2 = (b + 0.5) / ns, st = Math.sqrt(u1), ct = Math.sqrt(1 - u1), ph = 2 * PI * u2;
      const d = [st * Math.cos(ph), -ct, st * Math.sin(ph)]; N++;
      if (Math.abs(d[2]) < 1e-9) continue;
      if (open(p, d)) { if (d[2] > 0) sky++; else gnd++; }
    }
    // horizon band: directions just above the horizon, weighted by the cosine to the normal
    let hor = 0, hw = 0;
    for (const p of sub) for (let a = 0; a < 90; a++) {
      const ph = (-90 + (a + 0.5) * 2) * D2R, e = 1 * D2R, d = [Math.cos(e) * Math.sin(ph), -Math.cos(e) * Math.cos(ph), Math.sin(e)], w = Math.cos(ph);
      hw += w; if (open(p, d)) hor += w;
    }
    return { beam, sky: 2 * sky / N, gnd: 2 * gnd / N, hor: hor / hw };
  }
  const api = { windowShade };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Shade = api;
})(typeof window !== "undefined" ? window : globalThis);

/* Geometry-based zone engines for Climate Brief.
   - Solar position and irradiance on any surface from the shared Clima Toolbox core (NOAA sun, Perez 1990).
   - EN ISO 13790:2008 simple hourly method (5R1C), complete: opaque solar gains, sky radiation, F_w.
   - EN ISO 52016-1:2017 hourly method: 5 nodes per opaque element, 2 per window, one air node,
     area-weighted internal radiation, solved implicitly each hour.
   Both engines share one interface so any driver (Standard 140 tests, the app's controls) can use them:
     eng.trial(i, {hVe, thSup, qInt, fShade, phiHC}) -> {thAir, mrt, thOp, ...}   (W, W/K, °C)
     eng.commit(r)
   Option flags let each simplification be switched on or off for testing. */
(function (root) {
  "use strict";
  const D2R = Math.PI / 180, SIGMA = 5.67e-8;

  // ------------------------------------------------------------------ solar position: the shared Clima Toolbox core
  // (NOAA solar calculator, as Macro and Micro Clima; shared/climamods.js), at the middle of each hour, with refraction.
  const CM = () => root.ClimaMods || globalThis.ClimaMods;
  function solarPosition(lat, lon, tz) {
    const S = CM().solarArrays(lat, lon, tz), el = new Float64Array(8760), az = new Float64Array(8760);
    for (let i = 0; i < 8760; i++) { el[i] = S.alt[i]; az[i] = S.az[i]; }
    return { el, az };
  }

  // ------------------------------------------------------------------ irradiance on a surface: Perez 1990 from the shared core
  // (as Macro Clima and pvlib). Global horizontal is rebuilt from direct and diffuse, as the weather data carry no GHI.
  function irradiance(wx, tilt, surfAz) {
    const key = tilt + "|" + surfAz;
    if (wx._irr && wx._irr[key]) return wx._irr[key];
    const res = irradianceRaw(wx, tilt, surfAz);
    try { (wx._irr = wx._irr || {})[key] = res; } catch (e) {}
    return res;
  }
  function irradianceRaw(wx, tilt, surfAz) {
    const n = 8760, alb = wx.albedo == null ? 0.2 : wx.albedo, P = CM().poa, doy = CM().T.doy;
    const o = { beam: new Float32Array(n), circ: new Float32Array(n), iso: new Float32Array(n), hor: new Float32Array(n), grd: new Float32Array(n),
      cosT: new Float32Array(n), tot: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      const a = wx.el[i], zen = 90 - a, dni = wx.dni[i], dhi = wx.dhi[i], ghi = dhi + (a > 0 ? dni * Math.sin(a * D2R) : 0);
      const r = P(tilt, surfAz, zen, wx.az[i], dni, dhi, ghi, doy[i], alb);
      o.cosT[i] = Math.cos(zen * D2R) * Math.cos(tilt * D2R) + Math.sin(zen * D2R) * Math.sin(tilt * D2R) * Math.cos((wx.az[i] - surfAz) * D2R);
      o.beam[i] = r.beam; o.circ[i] = r.circ || 0; o.iso[i] = r.iso || 0; o.hor[i] = r.hor || 0; o.grd[i] = r.gnd;
      o.tot[i] = Math.max(0, r.tot);
    }
    return o;
  }

  // ------------------------------------------------------------------ windows: optics and overhangs
  // Angle dependence for clear double glazing: ASHRAE Handbook of Fundamentals, fenestration chapter, glazing 5b,
  // SHGC 0.76 / 0.74 / 0.71 / 0.64 / 0.50 / 0.26 at 0 / 40 / 50 / 60 / 70 / 80 degrees, 0.66 hemispherical.
  const IAM = [[0, 1], [40, 0.974], [50, 0.934], [60, 0.842], [70, 0.658], [80, 0.342], [90, 0]];
  const IAM_DIF = 0.868;
  function iam(cosT) {
    if (cosT <= 0) return 0;
    const th = Math.acos(Math.min(1, cosT)) / D2R;
    for (let k = 1; k < IAM.length; k++) if (th <= IAM[k][0]) { const [a0, v0] = IAM[k - 1], [a1, v1] = IAM[k]; return v0 + (v1 - v0) * (th - a0) / (a1 - a0); }
    return 0;
  }
  // Horizontal overhang over a vertical window, treated as infinitely long: sunlit share of beam light
  // from the shadow line, and the sky view left by the overhang for isotropic diffuse light.
  function overhang(wx, surfAz, o, hWin) {
    const n = 8760, beam = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const dAz = (wx.az[i] - surfAz) * D2R, a = wx.el[i];
      if (a <= 0 || Math.cos(dAz) <= 0) { beam[i] = 1; continue; }
      const tanP = Math.tan(a * D2R) / Math.cos(dAz), s = o.dep * tanP;
      beam[i] = 1 - Math.min(hWin, Math.max(0, s - o.gap)) / hWin;
    }
    const sky = (Math.hypot(o.gap + hWin, o.dep) - Math.hypot(o.gap, o.dep)) / hWin;
    return { beam, sky };
  }
  function recess(wx, e) {
    const g = e.geo, key = [e.azimuth, g.w, g.h, g.t, g.glass, g.overhang ? g.overhang.depth + "/" + g.overhang.ext : 0, g.fins ? g.fins.depth : 0].map((x) => typeof x === "number" ? x.toFixed(3) : x).join("|");
    let c; try { c = wx._recess || (wx._recess = {}); } catch (err) { c = {}; }
    if (!c[key]) { const SH = typeof Shade !== "undefined" ? Shade : require("./shade.js"); c[key] = SH.windowShade(g, e.azimuth, wx, { grid: 12 }); }
    return c[key];
  }
  function windowTransmitted(wx, e, opt) {
    const I = irradiance(wx, e.tilt, e.azimuth), n = 8760, out = new Float32Array(n), dir = new Float32Array(n);
    // recessed glass with reveals and outdoor shading (shade.js, same geometry as the daylight model), else the old overhang
    const sh = e.geo ? recess(wx, e) : e.overhang ? overhang(wx, e.azimuth, e.overhang, e.height) : null;
    const fr = 1 - (e.frame || 0);
    for (let i = 0; i < n; i++) {
      const fb = sh ? sh.beam[i] : 1, fs = sh ? sh.sky : 1, fh = sh && sh.hor != null ? sh.hor : 1, fg = sh && sh.gnd != null ? sh.gnd : 1;
      const direct = (I.beam[i] + I.circ[i]) * fb, diffuse = I.iso[i] * fs + I.hor[i] * fh + I.grd[i] * fg;
      const gd = opt.fw === "angle" ? e.g * iam(I.cosT[i]) * direct : e.g * (opt.fw || 0.9) * direct;
      const g = opt.fw === "angle" ? gd + e.g * IAM_DIF * diffuse : e.g * (opt.fw || 0.9) * (direct + diffuse);
      out[i] = Math.max(0, g) * fr * e.area; dir[i] = Math.max(0, gd) * fr * e.area;
    }
    return { tr: out, dir, I };
  }
  function skyDelta(wx, i) {
    if (wx.ir && wx.ir[i] > 0) { const tsky = Math.pow(wx.ir[i] / SIGMA, 0.25) - 273.15; return wx.t[i] - tsky; }
    return 11;
  }

  // ------------------------------------------------------------------ constructions
  const rLayers = (layers) => layers.reduce((s, [d, k]) => s + d / k, 0);
  const capLayers = (layers) => layers.reduce((s, [d, , rho, c]) => s + d * rho * c, 0);
  // EN ISO 13786 Annex A thickness method: inner layers up to the first insulating layer, 0.10 m, or half the element.
  function kappa13786(layers) {
    // from the inside: accumulate rho*c*d until an insulating layer (k < 0.1 W/mK, or no mass) or 0.10 m is reached
    let d = 0, k = 0;
    for (let j = layers.length - 1; j >= 0; j--) {
      const [dd, kk, rho, c] = layers[j];
      if (kk < 0.1 || rho * c === 0) break;
      const take = Math.min(dd, 0.10 - d);
      k += take * rho * c; d += take;
      if (d >= 0.10 - 1e-9) break;
    }
    return k;
  }
  // EN ISO 52016-1 mass distribution class from the position of the main insulation layer.
  function massClass(layers) {
    const kap = capLayers(layers);
    if (kap === 0) return { kap: 0, cls: "none" };
    if (layers.length === 1) return { kap, cls: "D" };
    let ins = 0, best = -1; layers.forEach((l, j) => { const r = l[0] / l[1]; if (r > best) { best = r; ins = j; } });
    const out = capLayers(layers.slice(0, ins)), inn = capLayers(layers.slice(ins + 1));
    if (out <= 0.1 * kap) return { kap, cls: "I" };
    if (inn <= 0.1 * kap) return { kap, cls: "E" };
    return { kap, cls: "IE" };
  }
  const DIST = { I: [0, 0, 0, 0, 1], E: [1, 0, 0, 0, 0], IE: [0.5, 0, 0, 0, 0.5], D: [1 / 8, 1 / 4, 1 / 4, 1 / 4, 1 / 8], M: [0, 0, 1, 0, 0], none: [0, 0, 0, 0, 0] };

  // ------------------------------------------------------------------ EN ISO 13790 5R1C
  function Iso13790(zone, wx, opt) {
    opt = Object.assign({ opaqueSolar: true, sky: true, fw: 0.9, at: 4.5 }, opt || {});
    const Af = zone.floorArea, At = opt.at * Af, hr = 5 * 0.9;
    let hTrW = 0, hOp = 0, C = 0, C2 = 0;
    const solOpq = new Float64Array(8760), solWin = new Float64Array(8760), skyWin = new Float64Array(8760);
    zone.elements.forEach((e) => {
      if (e.kind === "window") {
        hTrW += e.U * e.area;
        solWin.set(windowTransmitted(wx, e, opt).tr.map((x, i) => x + solWin[i]));
        const Fr = e.tilt < 45 ? 1 : e.tilt > 135 ? 0 : 0.5;
        if (opt.sky) for (let i = 0; i < 8760; i++) skyWin[i] += Fr * 0.04 * e.U * e.area * hr * skyDelta(wx, i);
        return;
      }
      const kap = kappa13786(e.layers);
      C += kap * e.area; C2 += kap * kap * e.area;
      if (e.bc === "adiabatic") return;
      const rsi = e.tilt < 45 ? 0.10 : e.tilt > 135 ? 0.17 : 0.13, Uc = 1 / (rsi + rLayers(e.layers) + 0.04);
      hOp += Uc * e.area;
      if (e.bc !== "outdoor") return;
      const Fr = e.tilt < 45 ? 1 : e.tilt > 135 ? 0 : 0.5;
      const I = opt.opaqueSolar ? irradiance(wx, e.tilt, e.azimuth).tot : null;
      for (let i = 0; i < 8760; i++) {
        if (opt.opaqueSolar) solOpq[i] += e.aSol * 0.04 * Uc * e.area * I[i];
        if (opt.sky) solOpq[i] -= Fr * 0.04 * Uc * e.area * hr * skyDelta(wx, i);
      }
    });
    for (let i = 0; i < 8760; i++) solOpq[i] -= skyWin[i];
    const Am = C2 > 0 ? C * C / C2 : 2.5 * Af, Cm = C;
    const z = { hTrIs: 3.45 * At, hTrMs: 9.1 * Am, hTrW, hOp, hTrEm: 1 / (1 / hOp - 1 / (9.1 * Am)), cm: Cm, fM: Am / At, fSt: 1 - Am / At - hTrW / (9.1 * At) };
    let thM = 20;
    const eng = {
      kind: "iso13790", z, Cm, Am,
      reset(th) { thM = th == null ? 20 : th; },
      trial(i, p) {
        const thE = wx.t[i], phiSol = solOpq[i] + (p.fShade == null ? 1 : p.fShade) * solWin[i];
        const phiIa = 0.5 * p.qInt, base = 0.5 * p.qInt + phiSol, hVe = Math.max(1e-6, p.hVe);
        const h1 = 1 / (1 / hVe + 1 / z.hTrIs), h2 = h1 + z.hTrW, h3 = 1 / (1 / h2 + 1 / z.hTrMs);
        const phiSt = z.fSt * base, phiM = z.fM * base, phiHC = p.phiHC || 0;
        const tot = phiM + z.hTrEm * thE + h3 * (phiSt + z.hTrW * thE + h1 * ((phiIa + phiHC) / hVe + p.thSup)) / h2;
        const cmH = z.cm / 3600;
        const thMt = (thM * (cmH - 0.5 * (h3 + z.hTrEm)) + tot) / (cmH + 0.5 * (h3 + z.hTrEm));
        const thMm = (thMt + thM) / 2;
        const thS = (z.hTrMs * thMm + phiSt + z.hTrW * thE + h1 * (p.thSup + (phiIa + phiHC) / hVe)) / (z.hTrMs + z.hTrW + h1);
        const thAir = (z.hTrIs * thS + hVe * p.thSup + phiIa + phiHC) / (z.hTrIs + hVe);
        return { thAir, thS, mrt: thS, thOp: 0.3 * thAir + 0.7 * thS, thMt };
      },
      commit(r) { thM = r.thMt; },
    };
    return eng;
  }

  // ------------------------------------------------------------------ exterior convection from wind (correction)
  // DOE-2 correlation (as in EnergyPlus): h = hn + Rf (sqrt(hn^2 + (a V^b)^2) - hn), windward a = 2.38, b = 0.89,
  // leeward a = 2.86, b = 0.617; station wind (10 m, open terrain) converted to the surface height and site terrain
  // with the ASHRAE power law. Walls take the mean of windward and leeward; roofs windward.
  const TERRAIN = { country: [0.14, 270], suburbs: [0.22, 370], city: [0.33, 460] };
  function localWind(v, z, terrain) {
    if (terrain === "station") return v;
    const [a, d] = TERRAIN[terrain || "country"];
    return v * Math.pow(270 / 10, 0.14) * Math.pow(Math.max(0.5, z) / d, a);
  }
  function hDoe2(V, Rf, hn, side) {
    const f = (a, b) => hn + Rf * (Math.sqrt(hn * hn + Math.pow(a * Math.pow(Math.max(0, V), b), 2)) - hn);
    return side === "windward" ? f(2.38, 0.89) : side === "leeward" ? f(2.86, 0.617) : 0.5 * (f(2.38, 0.89) + f(2.86, 0.617));
  }

  // ------------------------------------------------------------------ EN ISO 52016-1 hourly method
  function Iso52016(zone, wx, opt) {
    opt = Object.assign({ fw: 0.9, hciDynamic: true, kappaInt: 10000, fSolC: 0.1, fIntC: null, hce: 20, hre: 4.14, hri: 5.13, wind: null, beamFloor: false, shade: null, skySplit: true }, opt || {});
    const H = zone.height || (zone.volume / zone.floorArea);
    const fIntC = opt.fIntC != null ? opt.fIntC : zone.gains && zone.gains.radFrac != null ? 1 - zone.gains.radFrac : 0.4;
    const els = [], dt = 3600;
    let N = 0;
    zone.elements.forEach((e) => {
      const isWin = e.kind === "window";
      const horiz = e.tilt < 45 ? "ceil" : e.tilt > 135 ? "floor" : "wall";
      const rsi = 1 / ((horiz === "wall" ? 2.5 : horiz === "ceil" ? 5.0 : 0.7) + opt.hri), rse = 1 / (opt.hce + opt.hre);
      let n, h, kap;
      if (isWin) { const Uw = e.U * (opt.winUf || 1); n = 2; h = [1 / Math.max(0.01, opt.wind ? 1 / Uw - 0.13 - 0.04 : 1 / Uw - rsi - rse)]; kap = [0, 0];
        // EN ISO 52022-1 simplified method: total solar energy transmittance of glazing with an external blind,
        // as a ratio to the glazing alone; EN ISO 10077-1: additional resistance of the closed blind.
        if (opt.shade) { const sh = opt.shade, G = 1 / (1 / e.U + 1 / 5 + 1 / 10);
          const gt = sh.tau * e.g + (1 - sh.tau - sh.rho) * G / 10 + sh.tau * (1 - e.g) * G / 5;
          e._gShRatio = sh.ratio != null ? sh.ratio : gt / e.g; e._hShaded = 1 / (1 / h[0] + (sh.dR || 0)); } }
      else {
        n = 5; const Rc = Math.max(1e-4, e.R != null ? e.R : rLayers(e.layers));
        h = [6 / Rc, 3 / Rc, 3 / Rc, 6 / Rc];
        const mc = e.massClass ? { kap: e.kappa, cls: e.massClass } : massClass(e.layers);
        kap = DIST[mc.cls].map((f) => f * mc.kap);
      }
      const bc = e.bc || "outdoor";
      const Rf = e.rough != null ? e.rough : isWin ? 1.0 : 1.67, zc = horiz === "ceil" ? H : horiz === "floor" ? 0.5 : H / 2;
      els.push({ e, n, h, kap, base: N, horiz, bc, area: e.area, Fsky: bc === "outdoor" ? (1 + Math.cos(e.tilt * D2R)) / 2 : 0,
        he: bc === "adiabatic" ? 0 : opt.hce + (bc === "outdoor" || bc === "outdoor_nosun" ? opt.hre : 0), isWin, Rf, zc });
      N += n;
    });
    const ia = N; N += 1;
    const Atot = els.reduce((s, x) => s + x.area, 0);
    const Cint = opt.kappaInt * zone.floorArea;
    // solar inputs per hour
    const trWin = new Float64Array(8760), extSrc = els.map(() => null);
    els.forEach((x, j) => {
      if (x.isWin) { const w = windowTransmitted(wx, x.e, opt); x.tr = w.tr; for (let i = 0; i < 8760; i++) trWin[i] += w.tr[i]; }
      else if (x.bc === "outdoor" && x.e.aSol > 0) extSrc[j] = irradiance(wx, x.e.tilt, x.e.azimuth).tot;
    });
    const dTsky = new Float64Array(8760); for (let i = 0; i < 8760; i++) dTsky[i] = skyDelta(wx, i);
    // matrix for one combination of convective coefficients
    const BIN = 0.5, heOf = (x, bin) => {
      if (x.bc === "adiabatic") return 0;
      if (!opt.wind) return x.he;
      const hn = x.horiz === "ceil" ? 2.0 : 2.2;
      if (x.bc === "outdoor_nosun") return hn + opt.hre;
      const V = localWind(bin * BIN, x.zc, opt.wind.terrain);
      return hDoe2(V, x.Rf, hn, x.horiz === "ceil" ? "windward" : "mean") + opt.hre;
    };
    const hciOf = (x, combo) => x.horiz === "wall" ? 2.5 : x.horiz === "floor" ? (combo & 1 ? 5.0 : 0.7) : (combo & 2 ? 5.0 : 0.7);
    function assemble(combo, bin, shd) {
      const A = Array.from({ length: N }, () => new Float64Array(N));
      els.forEach((x) => {
        const a = x.area, b = x.base, m = x.n - 1, hci = hciOf(x, combo);
        for (let p = 0; p < x.n; p++) A[b + p][b + p] += a * x.kap[p] / dt;
        A[b][b] += a * heOf(x, bin);
        for (let p = 0; p < m; p++) { const g = a * (shd && x.isWin && x.e._hShaded ? x.e._hShaded : x.h[p]); A[b + p][b + p] += g; A[b + p + 1][b + p + 1] += g; A[b + p][b + p + 1] -= g; A[b + p + 1][b + p] -= g; }
        A[b + m][b + m] += a * hci; A[b + m][ia] -= a * hci; A[ia][b + m] -= a * hci; A[ia][ia] += a * hci;
        els.forEach((y) => { const g = opt.hri * a * y.area / Atot; A[b + m][b + m] += g; A[b + m][y.base + y.n - 1] -= g; });
      });
      A[ia][ia] += Cint / dt;
      return invert(A);
    }
    const combos = opt.hciDynamic ? [0, 1, 2, 3] : [opt.hciFixed || 1];
    // unit responses, cached per convection combination and wind bin
    const ea = new Float64Array(N); ea[ia] = 1;
    const bInt = new Float64Array(N); bInt[ia] = fIntC; els.forEach((x) => { bInt[x.base + x.n - 1] += (1 - fIntC) * x.area / Atot; });
    // transmitted sun spread by area over the inner surfaces; opt.solOnWindows false leaves the glass out (light that
    // reaches the inside of a window mostly passes back out rather than heating it)
    const solEls = opt.solOnWindows === false ? els.filter((x) => !x.isWin) : els, AsolT = solEls.reduce((s, x) => s + x.area, 0);
    const bSol = new Float64Array(N); bSol[ia] = opt.fSolC; solEls.forEach((x) => { bSol[x.base + x.n - 1] += (1 - opt.fSolC) * x.area / AsolT; });
    // beam on the floor: absorbed share on the floor surface, the reflected rest spread like diffuse light
    const fl = els.filter((x) => x.horiz === "floor" && !x.isWin), aFl = fl.reduce((s, x) => s + x.area, 0), alphaFl = 0.6;
    const bBeam = new Float64Array(N);
    if (fl.length) { fl.forEach((x) => { bBeam[x.base + x.n - 1] += alphaFl * x.area / aFl; }); for (let k = 0; k < N; k++) bBeam[k] += (1 - alphaFl) * bSol[k]; }
    // All systems differ from one base matrix by rank-one terms (exterior coefficient on one node, interior
    // convection between a surface and the air node, blind resistance between the two window nodes); the matrix
    // is symmetric, so each case follows from one inversion by Sherman-Morrison updates.
    let M0 = null;
    function smUpdate(M, i1, i2, d) {
      // A += d (e_i1 - e_i2)(e_i1 - e_i2)^T ; i2 < 0 means v = e_i1
      if (d === 0) return;
      const n = N, w = new Float64Array(n);
      for (let r = 0; r < n; r++) w[r] = i2 >= 0 ? M[r][i1] - M[r][i2] : M[r][i1];
      const vw = i2 >= 0 ? w[i1] - w[i2] : w[i1], k = d / (1 + d * vw);
      for (let r = 0; r < n; r++) { const row = M[r], f = k * w[r]; if (f !== 0) for (let c = 0; c < n; c++) row[c] -= f * w[c]; }
    }
    const wins = els.filter((x) => x.isWin), nW = wins.length, allMask = (1 << nW) - 1;
    wins.forEach((x, w) => { x.wBit = 1 << w; });
    function derive(combo, bin, shd) {
      if (!M0) M0 = assemble(0, 0, false);
      if (combo === 0 && bin === 0 && !shd) return M0;
      const mask = shd === true ? allMask : (shd | 0);
      const M = M0.map((r) => Float64Array.from(r));
      els.forEach((x) => {
        const a = x.area, b = x.base, m = x.n - 1;
        const dh = heOf(x, bin) - heOf(x, 0); if (dh) smUpdate(M, b, -1, a * dh);
        const dc = hciOf(x, combo) - hciOf(x, 0); if (dc) smUpdate(M, b + m, ia, a * dc);
        if (x.isWin && (mask & x.wBit) && x.e._hShaded) smUpdate(M, b, b + 1, a * (x.e._hShaded - x.h[0]));
      });
      return M;
    }
    const cache = {};
    const sysArr = [];
    function sysFor(combo, bin, shd) {
      const m = shd === true ? allMask : (shd | 0), key = ((bin * 4 + combo) << nW) + m;
      let S = sysArr[key];
      if (!S) { const M = derive(combo, bin, m), F = new Float64Array(N * N); for (let r = 0; r < N; r++) F.set(M[r], r * N);
        S = sysArr[key] = { M, F, u: matvec(M, ea), yi: matvec(M, bInt), ys: matvec(M, bSol), yb: matvec(M, bBeam) }; }
      return S;
    }
    const yBuf = new Float64Array(N), yBufSh = new Float64Array(N);
    function mvFlat(F, v, o) { for (let r = 0, off = 0; r < N; r++, off += N) { let s = 0; for (let k = 0; k < N; k++) s += F[off + k] * v[k]; o[r] = s; } return o; }
    let X = new Float64Array(N).fill(20);
    const bFix = new Float64Array(N);
    const maskY = [], maskS = [], maskBuf = [];
    let prepared = -1, yFix = null, combo = combos[0], sys = null, bin = 0, sysSh = null, yFixSh = null;
    const gRatio = opt.shade ? els.filter((x) => x.isWin).reduce((s, x) => s + x.e._gShRatio * x.area, 0) / Math.max(1e-9, els.filter((x) => x.isWin).reduce((s, x) => s + x.area, 0)) : null;
    // window solar: total and direct parts
    const dirWin = new Float64Array(8760);
    if (opt.beamFloor) els.forEach((x) => { if (x.isWin) { const w = windowTransmitted(wx, x.e, opt); for (let i = 0; i < 8760; i++) dirWin[i] += w.dir[i]; } });
    // fast paths: exterior coefficients per wind bin, element index arrays, buffer ring for trials
    const nE = els.length, heTab = {}, flIdx = [], ceIdx = [];
    els.forEach((x) => { if (x.horiz === "floor") flIdx.push(x.base + x.n - 1); if (x.horiz === "ceil") ceIdx.push(x.base + x.n - 1); });
    const surfIdx = Int32Array.from(els.map((x) => x.base + x.n - 1)), surfW = Float64Array.from(els.map((x) => x.area / Atot));
    const capD = new Float64Array(N); els.forEach((x) => { for (let p = 0; p < x.n; p++) capD[x.base + p] = x.area * x.kap[p] / dt; }); capD[ia] = Cint / dt;
    const extIdx = Int32Array.from(els.map((x) => x.base)), areaE = Float64Array.from(els.map((x) => x.area));
    // long-wave exchange with the sky: the part of the sky view near the horizon radiates at about air temperature;
    // EnergyPlus (Walton) counts sqrt(Fsky) of the sky view as cold sky. ISO 52016-1 counts all of it (opt.skySplit false).
    const skyF = Float64Array.from(els.map((x) => x.bc === "outdoor" ? x.area * x.Fsky * (opt.skySplit === false ? 1 : Math.sqrt(x.Fsky)) * opt.hre : 0));
    const solF = Float64Array.from(els.map((x) => x.area * (x.e.aSol || 0)));
    function heRow(b) { if (!heTab[b]) heTab[b] = Float64Array.from(els.map((x) => x.area * heOf(x, b))); return heTab[b]; }
    const RING = 16, ring = Array.from({ length: RING }, () => new Float64Array(N)); let rk = 0;
    function prepare(i) {
      if (opt.hciDynamic) {
        let c = 0, ta = X[ia];
        for (let k = 0; k < flIdx.length; k++) if (X[flIdx[k]] > ta) { c |= 1; break; }
        for (let k = 0; k < ceIdx.length; k++) if (X[ceIdx[k]] < ta) { c |= 2; break; }
        combo = c;
      } else combo = combos[0];
      bin = opt.wind ? Math.min(40, Math.round((wx.ws ? wx.ws[i] : 4) / BIN)) : 0;
      sys = sysFor(combo, bin, 0); sysSh = null; yFixSh = null; for (let k = 0; k < maskY.length; k++) maskY[k] = null;
      const thE = wx.t[i], dS = dTsky[i], he = heRow(bin);
      for (let k = 0; k < N; k++) bFix[k] = capD[k] * X[k];
      for (let j = 0; j < nE; j++) {
        const b = extIdx[j];
        if (he[j] > 0) { bFix[b] += he[j] * thE - skyF[j] * dS; }
        const src = extSrc[j]; if (src) bFix[b] += solF[j] * src[i];
      }
      yFix = mvFlat(sys.F, bFix, yBuf);
      prepared = i;
    }
    const eng = {
      kind: "iso52016", N, els, ia, windows: () => wins.map((x) => ({ id: x.e.id, azimuth: x.e.azimuth, bit: x.wBit })),
      reset(th) { X = new Float64Array(N).fill(th == null ? 20 : th); prepared = -1; },
      trial(i, p) {
        if (prepared !== i) prepare(i);
        // shading: p.shadeMask (bit per window, in element order) or p.fShade < 1 for all windows
        let mask = 0;
        if (opt.shade) mask = p.shadeMask != null ? p.shadeMask & allMask : (p.fShade != null && p.fShade < 1 ? allMask : 0);
        let S = sys, yF = yFix, solTr, solDir = 0;
        if (mask) {
          if (!maskY[mask]) { maskS[mask] = sysFor(combo, bin, mask); maskBuf[mask] = maskBuf[mask] || new Float64Array(N); maskY[mask] = mvFlat(maskS[mask].F, bFix, maskBuf[mask]); }
          S = maskS[mask]; yF = maskY[mask];
          solTr = 0; for (let w = 0; w < nW; w++) { const x = wins[w]; solTr += x.tr[i] * ((mask & x.wBit) ? x.e._gShRatio : 1); }
        } else {
          const fS = opt.shade ? 1 : p.fShade == null ? 1 : p.fShade;
          solDir = opt.beamFloor ? fS * dirWin[i] : 0; solTr = fS * trWin[i] - solDir;
        }
        const u = S.u, yi = S.yi, ys = S.ys, yb = S.yb;
        const c = p.hVe * p.thSup + (p.phiHC || 0), qI = p.qInt;
        const x = ring[rk]; rk = (rk + 1) % RING;
        for (let k = 0; k < N; k++) x[k] = yF[k] + qI * yi[k] + solTr * ys[k] + solDir * yb[k] + c * u[k];
        const f = p.hVe * x[ia] / (1 + p.hVe * u[ia]);
        let mrt = 0;
        for (let k = 0; k < N; k++) x[k] -= f * u[k];
        for (let j = 0; j < nE; j++) mrt += surfW[j] * x[surfIdx[j]];
        return { thAir: x[ia], mrt, thS: mrt, thOp: 0.5 * (x[ia] + mrt), x };
      },
      commit(r) { X.set(r.x); prepared = -1; },
    };
    return eng;
  }

  // ------------------------------------------------------------------ linear algebra
  function invert(A) {
    const n = A.length, M = A.map((r) => Float64Array.from(r)), I = Array.from({ length: n }, (_, i) => { const r = new Float64Array(n); r[i] = 1; return r; });
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]]; [I[c], I[p]] = [I[p], I[c]];
      const d = M[c][c];
      for (let k = 0; k < n; k++) { M[c][k] /= d; I[c][k] /= d; }
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f !== 0) for (let k = 0; k < n; k++) { M[r][k] -= f * M[c][k]; I[r][k] -= f * I[c][k]; } }
    }
    return I;
  }
  function matvec(M, v) { const n = v.length, o = new Float64Array(n); for (let r = 0; r < n; r++) { const row = M[r]; let s = 0; for (let k = 0; k < n; k++) s += row[k] * v[k]; o[r] = s; } return o; }

  // ------------------------------------------------------------------ the app's box, from the presets
  // Same geometry as the EnergyPlus model: 10 x 10 m, four walls and roof outdoors, adiabatic floor;
  // walls and roof without mass, U·A matched to the preset; mass as a concrete floor plus internal mass sized to the class.
  const MASS = { very_light: [80e3, 2.5], light: [110e3, 2.5], medium: [165e3, 2.5], heavy: [260e3, 3.0], very_heavy: [370e3, 3.5] };
  function zoneFromPresets(b, massKey, eqFactor, eqSide) {
    const AF = 100, S = 10, h = b.storey_h, win = { N: b.wfr / 4 * AF, E: b.wfr / 4 * AF, S: b.wfr / 4 * AF, W: b.wfr / 4 * AF };
    win[eqSide] *= eqFactor;
    const aWin = win.N + win.E + win.S + win.W, aEnv = b.a_v * h * AF, aOpqT = Math.max(0, aEnv - aWin);
    const walls = { N: S * h - win.N, E: S * h - win.E, S: S * h - win.S, W: S * h - win.W };
    const aGeo = walls.N + walls.E + walls.S + walls.W + AF, uEff = b.u_opaque * aOpqT / aGeo;
    const R = Math.max(0.01, 1 / uEff - 0.17);
    const [cm, am] = MASS[massKey], rc = 2240 * 900, t = cm / (am * rc);
    const conc = [[t, 1.95, 2240, 900]];
    const AZ = { N: 0, E: 90, S: 180, W: 270 }, el = [];
    Object.keys(AZ).forEach((k) => el.push({ id: "wall_" + k, kind: "opaque", area: walls[k], tilt: 90, azimuth: AZ[k], layers: [[R * 0.04, 0.04, 0, 0]], aSol: b.a_sol_opaque == null ? 0.6 : b.a_sol_opaque, eps: 0.9, bc: "outdoor" }));
    el.push({ id: "roof", kind: "opaque", area: AF, tilt: 0, azimuth: 0, layers: [[R * 0.04, 0.04, 0, 0]], aSol: b.a_sol_opaque == null ? 0.6 : b.a_sol_opaque, eps: 0.9, bc: "outdoor" });
    el.push({ id: "floor", kind: "opaque", area: AF, tilt: 180, azimuth: 0, layers: conc, aSol: 0, eps: 0.9, bc: "adiabatic", massClass: "D", kappa: t * rc });
    el.push({ id: "mass", kind: "opaque", area: Math.max(0.01, am * AF - AF), tilt: 90, azimuth: 0, layers: conc, aSol: 0, eps: 0.9, bc: "adiabatic", massClass: "D", kappa: t * rc });
    Object.keys(AZ).forEach((k) => { if (win[k] > 0) el.push({ id: "win_" + k, kind: "window", area: win[k], tilt: 90, azimuth: AZ[k], U: b.u_window, g: b.g_value, frame: 1 - b.frame_shade, height: Math.min(h - 0.4, 2) }); });
    return { floorArea: AF, volume: AF * h, elements: el, gains: { radFrac: 0.5 } };
  }

  const api = { localWind, hDoe2, solarPosition, irradiance, iam, overhang, windowTransmitted, kappa13786, massClass, Iso13790, Iso52016, zoneFromPresets, invert, matvec };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Geo = api;
})(typeof window !== "undefined" ? window : globalThis);

/* Thermal zone taken out of a building, for the sweep app.
   Builds the element list of engine_geo2.Iso52016 from: use dimensions, scenario, orientation,
   window-to-wall ratio, opaque U, glazing, mass level. Layers run outside -> inside.
   Shared constructions (floor, ceiling, partitions) are cut at their mid-plane, which is adiabatic
   for a room between identical rooms, so each slab or partition is counted once per room. */
(function (root) {
  "use strict";
  // [thickness m, conductivity W/mK, density kg/m3, specific heat J/kgK]; density 0 = no mass
  const M = {
    plaster: (d) => [d, 0.70, 1400, 1000],
    gypsum: (d) => [d, 0.25, 900, 1000],
    sandlime: (d) => [d, 0.99, 1800, 1000],
    concrete: (d) => [d, 2.00, 2400, 1000],
    screed: (d) => [d, 1.40, 2000, 1000],
    dryscreed: (d) => [d, 0.32, 1150, 1100],
    mineralwool: (d) => [d, 0.035, 30, 1030],
    impact: (d) => [d, 0.040, 100, 1030],
    timber: (d) => [d, 0.13, 500, 1600],
    airgap: (R) => [R * 0.1, 0.1, 0, 0], // massless resistance R
  };
  const RSI_WALL = 0.13, RSE = 0.04, RSI_UP = 0.10;
  const rOf = (layers) => layers.reduce((s, [d, k]) => s + d / k, 0);

  // inner part of the exterior wall and roof, and the shared constructions, by mass level
  const MASS = {
    light: {
      wallIn: [M.gypsum(0.0125), M.gypsum(0.0125)],
      roofIn: [M.airgap(0.16), M.gypsum(0.0125)],
      ceiling: [M.timber(0.011), M.mineralwool(0.05), M.airgap(0.10), M.gypsum(0.0125)],
      floor: [M.timber(0.011), M.impact(0.03), M.dryscreed(0.025)],
      partition: [M.mineralwool(0.03), M.gypsum(0.0125), M.gypsum(0.0125)],
    },
    medium: {
      wallIn: [M.sandlime(0.175), M.plaster(0.015)],
      roofIn: [M.concrete(0.20), M.airgap(0.16), M.gypsum(0.0125)],
      ceiling: [M.concrete(0.10), M.airgap(0.16), M.gypsum(0.0125)],
      floor: [M.concrete(0.10), M.impact(0.03), M.screed(0.05)],
      partition: [M.mineralwool(0.03), M.gypsum(0.0125), M.gypsum(0.0125)],
    },
    /* v10 (27 October 2026): heavy recalibrated to about DIN V 18599 "schwer": exposed slab, lightweight partitions;
       very heavy is the former heavy (masonry partitions). In both, 70% of the slab soffit (ceiling, or roof slab on the top
       floor) is exposed; the rest sits behind acoustic panels and lights, modelled like a suspended ceiling. */
    heavy: {
      wallIn: [M.sandlime(0.175), M.plaster(0.015)],
      roofIn: [M.concrete(0.20)],
      roofInCov: [M.concrete(0.20), M.airgap(0.10), M.gypsum(0.0125)],
      ceiling: [M.concrete(0.10)],
      ceilingCov: [M.concrete(0.10), M.airgap(0.10), M.gypsum(0.0125)],
      exposed: 0.7,
      floor: [M.concrete(0.10), M.impact(0.03), M.screed(0.05)],
      partition: [M.mineralwool(0.03), M.gypsum(0.0125), M.gypsum(0.0125)],
    },
    vheavy: {
      wallIn: [M.sandlime(0.175), M.plaster(0.015)],
      roofIn: [M.concrete(0.20)],
      roofInCov: [M.concrete(0.20), M.airgap(0.10), M.gypsum(0.0125)],
      ceiling: [M.concrete(0.10)],
      ceilingCov: [M.concrete(0.10), M.airgap(0.10), M.gypsum(0.0125)],
      exposed: 0.7,
      floor: [M.concrete(0.10), M.impact(0.03), M.screed(0.05)],
      partition: [M.sandlime(0.0875), M.plaster(0.015)],
    },
  };
  /* v10: a floor on an impact sound layer: only the layers above it (screed) are coupled to the room. EN ISO 52016-1 class IE
     puts half the element's capacity at each surface node, so the capacity is set to twice that of the room-side layers. */
  function floorEl(layers, Af) {
    const j = layers.findIndex((l) => l[1] < 0.1 && l[2] > 0); // first insulating layer from outside
    const el = { id: "floor", kind: "opaque", area: Af, tilt: 180, azimuth: 0, layers, aSol: 0, eps: 0.9, bc: "adiabatic" };
    if (j >= 0 && j < layers.length - 1) { const cap = layers.slice(j + 1).reduce((s, [d, , rho, c]) => s + d * rho * c, 0); el.massClass = "IE"; el.kappa = 2 * cap; }
    return el;
  }

  // insulation thickness so that the element meets the target U (exterior facing)
  function insulated(inner, U, rsi, outer) {
    const rest = 1 / U - rsi - RSE - rOf(inner) - rOf(outer || []);
    if (rest <= 0) throw new Error("U-value " + U + " not reachable with this construction");
    return (outer || []).concat([M.mineralwool(rest * 0.035)], inner);
  }

  const SCEN = {
    cellular: { facades: ["A"], roof: false },
    corner: { facades: ["A", "B"], roof: false },
    corner_top: { facades: ["A", "B"], roof: true },
  };
  /* p: { width, depth, height, scenario, azimuth (facade A, degrees from north, clockwise),
          wwr, uOpaque, uWindow, gWindow, frame (0.3), mass, aSol (0.6), rough (1.52) } */
  /* Glass rectangle as in the daylight model: glass area = wwr x facade x (1 - frame), head 0.2 m below the ceiling,
     sill 0.85 m, widened down to the floor if the facade is too short. t: wall depth, glass: glass distance from the
     outer face. fixed: {overhang: {depth, ext}, fins: {depth}} or null. */
  function windowRect(L, H, wwr, frame) {
    const area = wwr * L * H * (1 - frame), head = H - 0.2; let sill = 0.85, h = head - sill, w = area / h;
    if (w > L - 0.2) { w = L - 0.2; h = area / w; sill = Math.max(0.05, head - h); h = head - sill; }
    return { x0: (L - w) / 2, x1: (L + w) / 2, z0: sill, z1: head };
  }
  function windowGeo(L, H, wwr, frame, t, glass, fixed) {
    const r = windowRect(L, H, wwr, frame), g = { w: r.x1 - r.x0, h: r.z1 - r.z0, t, glass: Math.min(glass, t) };
    if (fixed && fixed.overhang) g.overhang = fixed.overhang;
    if (fixed && fixed.fins) g.fins = fixed.fins;
    return g;
  }
  function buildZone(p) {
    const W = p.width, D = p.depth, H = p.height, Af = W * D, sc = SCEN[p.scenario];
    if (!sc) throw new Error("unknown scenario " + p.scenario);
    const ml = MASS[p.mass]; if (!ml) throw new Error("unknown mass level " + p.mass);
    const frame = p.frame == null ? 0.3 : p.frame, aSol = p.aSol == null ? 0.6 : p.aSol, rough = p.rough == null ? 1.52 : p.rough;
    const azA = ((p.azimuth % 360) + 360) % 360, azB = (azA + 90) % 360;
    // walls: A (width) and its opposite (back), B (depth, clockwise of A) and its opposite
    const walls = [
      { id: "A", len: W, az: azA, exposed: sc.facades.includes("A") },
      { id: "B", len: D, az: azB, exposed: sc.facades.includes("B") },
      { id: "back", len: W, az: (azA + 180) % 360, exposed: false },
      { id: "side", len: D, az: (azB + 180) % 360, exposed: false },
    ];
    const uWall = p.uWall != null ? p.uWall : p.uOpaque, uRoof = p.uRoof != null ? p.uRoof : p.uOpaque;
    const wallExt = insulated(ml.wallIn, uWall, RSI_WALL, [M.plaster(0.01)]);
    const el = [];
    walls.forEach((w) => {
      const gross = w.len * H;
      if (w.exposed) {
        const aWin = p.wwr * gross;
        el.push({ id: "wall_" + w.id, kind: "opaque", area: gross - aWin, tilt: 90, azimuth: w.az, layers: wallExt, aSol, eps: 0.9, bc: "outdoor", rough });
        if (aWin > 0) el.push({ id: "win_" + w.id, kind: "window", area: aWin, tilt: 90, azimuth: w.az, U: p.uWindow, g: p.gWindow, frame, height: Math.min(H - 0.3, Math.max(1, p.wwr * H)),
          geo: p.wallDepth === 0 ? null : windowGeo(w.len, H, p.wwr, frame, p.wallDepth == null ? 0.4 : p.wallDepth, p.glassSetback == null ? 0.3 : p.glassSetback, p.fixedShade) });
      } else {
        el.push({ id: "wall_" + w.id, kind: "opaque", area: gross, tilt: 90, azimuth: w.az, layers: ml.partition, aSol: 0, eps: 0.9, bc: "adiabatic" });
      }
    });
    const ex = ml.exposed == null ? 1 : ml.exposed;
    if (sc.roof) { const ra = { kind: "opaque", tilt: 0, azimuth: 0, aSol: p.aSolRoof != null ? p.aSolRoof : aSol, eps: 0.9, bc: "outdoor", rough };
      el.push(Object.assign({ id: "roof", area: Af * ex, layers: insulated(ml.roofIn, uRoof, RSI_UP, []) }, ra));
      if (ex < 1) el.push(Object.assign({ id: "roof_cov", area: Af * (1 - ex), layers: insulated(ml.roofInCov, uRoof, RSI_UP, []) }, ra)); }
    else { el.push({ id: "ceiling", kind: "opaque", area: Af * ex, tilt: 0, azimuth: 0, layers: ml.ceiling, aSol: 0, eps: 0.9, bc: "adiabatic" });
      if (ex < 1) el.push({ id: "ceiling_cov", kind: "opaque", area: Af * (1 - ex), tilt: 0, azimuth: 0, layers: ml.ceilingCov, aSol: 0, eps: 0.9, bc: "adiabatic" }); }
    el.push(floorEl(ml.floor, Af));
    return { floorArea: Af, volume: Af * H, height: H, elements: el, gains: { radFrac: 0.5 } };
  }

  // areal heat capacity seen from the room, EN ISO 13786 10 cm rule, per m2 of floor (for reporting)
  function capacityPerFloor(zone, kappa13786) {
    return zone.elements.filter((e) => e.kind !== "window").reduce((s, e) => s + kappa13786(e.layers) * e.area, 0) / zone.floorArea;
  }
  // U-value of an opaque element as built (check)
  function uOf(layers, rsi) { return 1 / (rsi + rOf(layers) + RSE); }

  const api = { buildZone, windowRect, windowGeo, capacityPerFloor, uOf, MASS, SCEN, MAT: M };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SweepZone = api;
})(this);

/* Comfort evaluations (v16): EN 16798-1 adaptive (I, II, III), ASHRAE 55 adaptive (80, 90), German annex
   DIN EN 16798-1/NA on the hourly mean outdoor temperature (I, II, III), DIN 4108-2 overheating degree-hours
   (regions A, B, C). Fans raise the upper limit by the register's credit in the hours in which they run.
   All constants come from the register. Scores count the hours given by the occupancy mask. */
(function (root) {
  "use strict";
  const RG = root.Register || require("./register.js"), RV = RG.val;
  function dailyMeans(t) {
    const d = new Float64Array(365);
    for (let k = 0; k < 365; k++) { let s = 0; for (let h = 0; h < 24; h++) s += t[k * 24 + h]; d[k] = s / 24; }
    return d;
  }
  function runningMeanEN(dm, alpha) {
    const a = alpha == null ? 0.8 : alpha, out = new Float64Array(365);
    let rm = dm.reduce((s, x) => s + x, 0) / 365;
    for (let pass = 0; pass < 2; pass++) for (let k = 0; k < 365; k++) { rm = (1 - a) * dm[(k + 364) % 365] + a * rm; out[k] = rm; }
    return out;
  }
  function prevailingMean(dm, n) {
    const days = n || 7, out = new Float64Array(365);
    for (let k = 0; k < 365; k++) { let s = 0; for (let j = 1; j <= days; j++) s += dm[(k - j + 730) % 365]; out[k] = s / days; }
    return out;
  }
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const ENB = RV("en.band"), ASB = RV("ash.band"), NAB = RV("na.band");
  const EN_BAND = { I: [ENB.up.I, ENB.dn.I], II: [ENB.up.II, ENB.dn.II], III: [ENB.up.III, ENB.dn.III] };
  const ASH_BAND = { 80: ASB.half[80], 90: ASB.half[90] };
  // German national annex: comfort temperature against the HOURLY mean outdoor air temperature (v16; v15 used the
  // running mean, which roughly doubled the degree-hours above the band)
  const NA_BAND = Object.assign({}, NAB.tol);
  const naComfort = (te) => te <= NAB.below ? NAB.low : te >= NAB.above ? NAB.high : NAB.low - NAB.slope * NAB.below + NAB.slope * te;
  const DIN_REF = Object.assign({}, RV("din.ref"));
  const FAN_DT = RV("run.fan.credit");

  // hourly limits for every model and category, computed once per weather file
  function bands(t, opt) {
    opt = opt || {};
    const dm = dailyMeans(t), rmEN = runningMeanEN(dm, ENB.alpha), rmA = prevailingMean(dm, opt.ashraeDays || ASB.days);
    const B = {}, oorEN = new Uint8Array(8760), oorA = new Uint8Array(8760);
    for (const c of Object.keys(EN_BAND)) { const [up, dn] = EN_BAND[c], lo = new Float32Array(8760), hi = new Float32Array(8760);
      for (let i = 0; i < 8760; i++) { const r = rmEN[(i / 24) | 0]; hi[i] = ENB.a * clamp(r, 10, 30) + ENB.b + up; lo[i] = ENB.a * clamp(r, 15, 30) + ENB.b - dn; }
      B["en_" + c] = { lo, hi, fans: true }; }
    for (const c of Object.keys(ASH_BAND)) { const b = ASH_BAND[c], lo = new Float32Array(8760), hi = new Float32Array(8760);
      for (let i = 0; i < 8760; i++) { const cm = ASB.a * clamp(rmA[(i / 24) | 0], 10, 33.5) + ASB.b; hi[i] = cm + b; lo[i] = cm - b; }
      B["ash_" + c] = { lo, hi, fans: true }; }
    for (const c of Object.keys(NA_BAND)) { const b = NA_BAND[c], lo = new Float32Array(8760), hi = new Float32Array(8760);
      for (let i = 0; i < 8760; i++) { const cm = naComfort(t[i]); hi[i] = cm + b; lo[i] = cm - b; }
      B["na_" + c] = { lo, hi, fans: true }; } // v11: the fan variant is computed; the page applies it only when chosen
    for (let i = 0; i < 8760; i++) { const r = rmEN[(i / 24) | 0], a = rmA[(i / 24) | 0]; oorEN[i] = r < 10 || r > 30 ? 2 : r < 15 ? 1 : 0; oorA[i] = a < 10 || a > 33.5 ? 2 : 0; }
    return { B, rmEN, rmA, oorEN, oorA };
  }
  // one band: [degree-hours above, degree-hours below, hours in band, hours above]. fan: hourly mask of the hours in
  // which the fans ran (v16; v15 credited every hour at 25 °C or more, also hours in which no fan ran)
  function scoreBand(top, occ, lo, hi, fan) {
    let a = 0, b = 0, n = 0, na = 0;
    for (let i = 0; i < 8760; i++) {
      if (!occ[i]) continue;
      const x = top[i], h = fan && fan[i] ? hi[i] + FAN_DT : hi[i];
      if (x > h) { a += x - h; na++; } else if (x < lo[i]) b += lo[i] - x; else n++;
    }
    return [Math.round(a * 10) / 10, Math.round(b * 10) / 10, n, na];
  }
  // all evaluations for one simulated year
  function scoreAll(top, occ, dinMask, BN, fanMask) {
    const out = {};
    for (const k of Object.keys(BN.B)) {
      const b = BN.B[k];
      out[k] = scoreBand(top, occ, b.lo, b.hi, null);
      if (b.fans) out[k + "_fan"] = fanMask ? scoreBand(top, occ, b.lo, b.hi, fanMask) : out[k];
    }
    for (const r of Object.keys(DIN_REF)) { let s = 0, nh = 0; const ref = DIN_REF[r]; for (let i = 0; i < 8760; i++) if (dinMask[i] && top[i] > ref) { s += top[i] - ref; nh++; } out["din_" + r] = Math.round(s * 10) / 10; out["dinh_" + r] = nh; }
    return out;
  }
  function dinLimit(useKey) { const L = RV("din.limit"); return useKey === "dwelling" ? L.res : L.nonres; }
  // Outside Germany only: a summer region estimated from the warmest monthly mean (A up to 16.5 C, B up to 18 C, C
  // above), for reference. In Germany the region is chosen from figure 1 of DIN 4108-2.
  function dinRegion(t) {
    const md = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; let i = 0, mx = -99;
    for (const n of md) { let s = 0; for (let k = 0; k < n * 24; k++) s += t[i + k]; i += n * 24; mx = Math.max(mx, s / (n * 24)); }
    return { region: mx <= 16.5 ? "A" : mx <= 18 ? "B" : "C", maxMonth: mx };
  }
  const api = { dailyMeans, runningMeanEN, prevailingMean, bands, scoreBand, scoreAll, dinLimit, dinRegion, naComfort, NA_BAND, DIN_REF, EN_BAND, ASH_BAND, FAN_DT };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Comfort = api;
})(this);

/* Sweep driver (v16): DIN 4108-2 boundary conditions for schedules, gains, base air and heating, from the register.
   simulate(ctx, combo, mode) runs one year; mode "free" | "heat" | { cool } | "din" (the summer protection check with
   the conditions of DIN 4108-2, 8.4.2, only). Works in Node, in the page and in web workers. */
(function (root) {
  "use strict";
  const G = root.Geo || require("./engine_geo2.js"), Z = root.SweepZone || require("./zone2.js"), C = root.Comfort || require("./comfort2.js");
  const RG = root.Register || require("./register.js"), RV = RG.val;

  // DIN 4108-2 presets (8.4.2 b, e, f, g, h); room sizes and moisture gains from the spec of 23 October 2026.
  // achOcc of non-residential uses follows eq. (5), n = 4 A_G / V = 4 / H, and is recomputed from the room height.
  const SN = RV("din.schedule.nonres"), PR = RV("din.presence.res"), TH = RV("din.tHeat");
  const G_RES = RV("din.gain.res") / 24, G_NONRES = RV("din.gain.nonres") / (SN[1] - SN[0]);
  const USE = {
    dwelling: { label: "Dwelling", dims: [4.0, 5.0, 2.6], occ: RV("din.schedule.res"), weekdays: false, pres: PR, gainOcc: G_RES, gainUnocc: G_RES,
      achOcc: RV("din.air.res"), achUnocc: RV("din.air.res"), tHeat: TH.res, moist: 1.5, din: "residential" },
    office: { label: "Office", dims: [4.05, 5.0, 3.0], occ: SN, weekdays: true, pres: SN, gainOcc: G_NONRES, gainUnocc: 0,
      achOcc: RV("din.air.nonres.use") / 3.0, achUnocc: RV("din.air.nonres.off"), tHeat: TH.nonres, moist: 4.5, din: "non-residential" },
    school: { label: "School", dims: [8.0, 7.5, 3.2], occ: SN, weekdays: true, pres: SN, gainOcc: G_NONRES, gainUnocc: 0,
      achOcc: RV("din.air.nonres.use") / 3.2, achUnocc: RV("din.air.nonres.off"), tHeat: TH.nonres, moist: 12, din: "non-residential" },
  };
  const achOccOf = (u, H) => u.din === "residential" ? u.achOcc : RV("din.air.nonres.use") / H;
  // opaque envelope (wall and roof U, W/m²K) and window (Uw incl. frame; total solar energy transmittance g) as
  // separate measures (decision of 24 October 2026). Unrenovated is not simulated.
  const OPAQUE = {
    u24: { label: "Retrofit requirement", uWall: 0.24, uRoof: 0.20 },
    u15: { label: "High performance", uWall: 0.15, uRoof: 0.12 },
    u10: { label: "Passive house", uWall: 0.10, uRoof: 0.08 },
  };
  const panes = (u) => u >= 1 ? "double" : "triple";
  const colOf = (u, g) => g <= RV("din.fc.scGlass") ? "sc" : panes(u);
  // F_C by glass column (solar control / double / triple), DIN 4108-2 Table 7 rows 3.2.1, 3.1.1 and 2.1 (register)
  const FC = RV("din.fc");
  // v16 phase 2: two blind types, exterior and interior; F_C and light transmittance editable through ctx.blinds
  const SHADES = {
    none: { label: "No blinds", fc: { double: 1, triple: 1, sc: 1 }, dR: 0, tau: 1 },
    exterior: { label: "Exterior blind", fc: FC.venetian, dR: 0.10, tau: RV("blind.ext").tau, direct: RV("blind.ext").direct / RV("blind.ext").tau, outside: true },
    interior: { label: "Interior blind", fc: FC.interior, dR: 0, tau: RV("blind.int").tau, direct: RV("blind.int").direct / RV("blind.int").tau, outside: false },
  };
  // fixed outdoor shading on the outer face of the wall (glass 10 cm behind the inner face); overhang at the window head, fins at the jambs
  const FIXED = {
    none: { label: "No added shading" }, // the wall reveal is part of every option
    oh05: { label: "Overhang 0.5 m", overhang: { depth: 0.5, ext: 0.3 } },
    oh10: { label: "Overhang 1.0 m", overhang: { depth: 1.0, ext: 0.3 } },
    fin05: { label: "Side fins 0.5 m", fins: { depth: 0.5 } },
    box05: { label: "Frame 0.5 m", overhang: { depth: 0.5, ext: 0 }, fins: { depth: 0.5 } },
  };
  // Room Clima's four changes to EN ISO 52016-1, set here and in the call to Geo.Iso52016 below: wind-driven exterior
// convection (wind), angle-dependent glazing transmission (fw: "angle"), transmitted sun on opaque surfaces only
// (solOnWindows: false, chosen after the EnergyPlus check of the room types, 24 October 2026), and sky long-wave exchange
// over the square root of the sky view factor (skySplit, as EnergyPlus). validation/thermal/ tests each one.
const ENGINE = { solOnWindows: false, skySplit: true };
  const WALL = { depth: 0.35, glass: 0.25 }; // default; glass 10 cm behind the inner face. Override per run with ctx.wall
  const SHADE_LEVELS = { dwelling: ["none", "interior", "exterior"], office: ["none", "interior", "exterior"], school: ["none", "interior", "exterior"] };
  const W_COIL = 0.0093; // kg/kg: saturation at 13 °C, the coil leaving temperature of the cooling air
  const FAN_W = RV("run.fan.power"); // W/m² floor while running (register; editable through ctx.fanW)
  const CM = RV("ceil.model"), T_WATER = CM.tWater; // °C: lowest mean water temperature of a chilled ceiling (rating point)
  const W_DEHUM = 0.012; // kg/kg: humidity ratio above which the cooled room is dehumidified in occupied hours (as the humid-hours limit)
  const BI = RV("din.blind.irr"), SHADE_IRR = { dwelling: BI.res, office: BI.nonres, school: BI.nonres }; // [north, other], W/m2
  const PARAMS = {
    azimuth: [0, 45, 90, 135, 180, 225, 270, 315],
    wwr: [0.2, 0.35, 0.5, 0.65, 0.8],
    opaque: ["u24", "u15", "u10"],
    uglass: [1.3, 0.8], // window U, W/m²K: double (1.3) or triple (0.8) glazing
    gglass: [0.6, 0.45, 0.3], // g value
    mass: ["light", "medium", "heavy", "vheavy"], // v10: heavy recalibrated, very heavy = former heavy
    fixed: ["none", "oh05", "oh10", "fin05", "box05"],
    shading: [0, 1, 2], // index into SHADE_LEVELS[use]
    dayAch: RV("run.day.levels").slice(), // v16: DIN 4108-2 allows at most 3 1/h by day
    nightAch: RV("run.night.levels").slice(), // 5 1/h only across storeys or by a system (off by default in the page)
    fans: [0, 1], // v11: ceiling fans, 0.9 m/s, on in occupied hours when the room is at 25 °C or more
    supply: ["outdoor"], // earth-tempered and evaporative supply set aside until their models are checked (24 October 2026)
    roof: ["standard", "cool"],
  };
  // supply air for the base (hygienic) air change: outdoor air, through an earth-air heat exchanger, or through a direct
  // evaporative cooler. Window ventilation (day and night) always brings outdoor air.
  const SUPPLY = {
    outdoor: { label: "Outdoor air" },
    earth: { label: "Earth-tempered supply air", eff: 0.7 },   // effectiveness towards the ground temperature
    evap: { label: "Evaporative supply air", eff: 0.8, on: 20 }, // direct evaporative cooler above 20 C outdoor
  };
  const ROOF = { standard: { label: "Standard roof", aSol: 0.6 }, cool: { label: "Cool roof", aSol: 0.25 } };
  const SCENARIOS = ["cellular", "corner", "corner_top"];
  const VR = { dayT: RV("run.day.tAir"), dayM: RV("run.day.margin"), dayOut: RV("run.day.tOutMin"), nightM: RV("run.night.margin"), floor: RV("run.vent.floor"),
    dinDayT: RV("din.day.tAir"), dinDay: RV("din.day.ach"), gtot: RV("din.night.gtot"), peak: RV("run.peak"), fanT: RV("run.fan.start"), arm: RV("run.night.arm") };
  const isNorth = (az) => { const a = ((az % 360) + 360) % 360; return a >= 315 || a <= 45; };
  // the facade that gets little direct sun (lower blind threshold of DIN 4108-2): north above the Tropic of Cancer,
  // south below the Tropic of Capricorn, none in between, where the sun reaches every facade in some months
  const shadeSide = (lat, az) => { const a = ((az % 360) + 360) % 360; return lat >= 23.44 ? (a >= 315 || a <= 45) : lat <= -23.44 ? (a >= 135 && a <= 225) : false; };

  function schedules(u) {
    const occ = new Uint8Array(8760), pres = new Uint8Array(8760);
    for (let i = 0; i < 8760; i++) {
      const hr = (i % 24) + 0.5, d = (i / 24) | 0, wd = (d % 7) < 5; // 1 January a Monday (DIN 4108-2, 8.4.2 d)
      const day = u.weekdays ? wd : true;
      occ[i] = day && hr > u.occ[0] && hr < u.occ[1] ? 1 : 0;
      pres[i] = day && hr > u.pres[0] && hr < u.pres[1] ? 1 : 0;
    }
    return { occ, pres };
  }
  // outdoor humidity ratio (kg/kg) from dew point and pressure, with the shared core's psychrometrics (as Macro Clima)
  function humidityRatio(td, p) {
    const w = new Float32Array(8760), M = root.ClimaMods || globalThis.ClimaMods;
    for (let i = 0; i < 8760; i++) { const pv = M.pws(td[i]); w[i] = M.humRatio(pv, Math.max(pv + 1000, p[i])); }
    return w;
  }
  function context(wx, useKey, opt) {
    opt = opt || {};
    const u = USE[useKey], s = schedules(u);
    const rho = new Float64Array(8760); for (let i = 0; i < 8760; i++) rho[i] = wx.p[i] / (287.05 * (wx.t[i] + 273.15));
    if (!wx.w) wx.w = humidityRatio(wx.td, wx.p);
    if (!wx._bands) wx._bands = C.bands(wx.t);
    const dinMask = useKey === "dwelling" ? new Uint8Array(8760).fill(1) : s.occ;
    if (!wx._supply) wx._supply = supplyAir(wx);
    const wall = opt.wallDepth != null ? { depth: opt.wallDepth, glass: Math.max(0, opt.wallDepth - 0.1) } : WALL;
    return { wx, use: u, useKey, occ: s.occ, pres: s.pres, rho, dinMask, BN: wx._bands, wall, dims: opt.dims || null, coolSet: opt.coolSet || 26, coolHi: opt.coolHi ? Float32Array.from(opt.coolHi) : null, coolHiFan: opt.coolHiFan ? Float32Array.from(opt.coolHiFan) : null, fanW: opt.fanW != null ? opt.fanW : null, gOcc: opt.gainOcc != null ? opt.gainOcc : null, blindCtl: opt.blindCtl || "auto", blindRule: opt.blindRule === "din" ? "din" : "comfort", blinds: opt.blinds || null };
  }
  // ground temperature at about 2 m: annual mean plus a damped, delayed 30-day mean (used only by the earth-tempered
  // supply, which is set aside; not part of any run)
  function supplyAir(wx) {
    const n = 8760, t = wx.t, mean = t.reduce((a, b) => a + b, 0) / n, m30 = new Float32Array(n);
    let acc = 0; for (let i = n - 720; i < n; i++) acc += t[i];
    for (let i = 0; i < n; i++) { acc += t[i] - t[(i - 720 + n) % n]; m30[i] = acc / 720; }
    const earth = new Float32Array(n), evap = new Float32Array(n), dw = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const tg = mean + 0.35 * (m30[(i - 720 + n) % n] - mean);
      earth[i] = t[i] + SUPPLY.earth.eff * (tg - t[i]);
      const T = t[i], td = wx.td ? wx.td[i] : T - 5;
      const rh = Math.min(100, Math.max(5, 100 * Math.exp(17.62 * td / (243.12 + td)) / Math.exp(17.62 * T / (243.12 + T))));
      const tw = T * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) + Math.atan(T + rh) - Math.atan(rh - 1.676331) + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) - 4.686035;
      if (T > SUPPLY.evap.on) { evap[i] = T - SUPPLY.evap.eff * (T - Math.min(T, tw)); dw[i] = 1006 * (T - evap[i]) / 2.45e6; } else evap[i] = T;
    }
    return { earth, evap, dw };
  }
  function zoneParams(ctx, c) {
    const u = ctx.use, op = OPAQUE[c.opaque];
    const dims = c.dims || ctx.dims || u.dims;
    return { width: dims[0], depth: dims[1], height: dims[2], scenario: c.scenario, azimuth: c.azimuth, wwr: c.wwr,
      uWall: op.uWall, uRoof: op.uRoof, uWindow: c.uglass, gWindow: c.gglass, mass: c.mass,
      wallDepth: (ctx.wall || WALL).depth, glassSetback: (ctx.wall || WALL).glass, fixedShade: FIXED[c.fixed || "none"],
      aSolRoof: ROOF[c.roof || "standard"].aSol };
  }
  function shadeOf(ctx, c) {
    const key = SHADE_LEVELS[ctx.useKey][c.shading], sh = SHADES[key];
    const col = colOf(c.uglass, c.gglass), ov = ctx.blinds && ctx.blinds[key];
    const tau = ov && ov.tau != null ? ov.tau : sh.tau; // light through a lowered blind: a share straight through, the rest diffuse
    return { key, label: sh.label, fc: ov && ov.fc != null ? ov.fc : sh.fc[col], dR: sh.dR, tau, tauDir: tau * (sh.direct || 0), tauDif: tau * (1 - (sh.direct || 0)), outside: !!sh.outside };
  }
  /* window openings for ventilation: per window of the room, the openable sash and its height; effective area for tilt
     (C_k at 10°) or fully open side-hung windows. v16 phase 3.5 (decision of 27 November 2026): a standard sash of
     0.6 x 1.5 m per 2.7 m of facade, scaled by the facade width, or the window where smaller; height 1.5 m or the window
     height where lower. Before: half the window area, so a larger window meant a larger opening. */
  const HOLD = RV("run.blind.heatHold"), VM = RV("vent.method"), V_SASH = RV("vent.sash"), V_CK = RV("vent.tilt").ck, BCOM = RV("run.blind.comfort");
  function openings(ctx, c) {
    const dims = c.dims || ctx.dims || ctx.use.dims, W = dims[0], D = dims[1], H = dims[2];
    const walls = c.scenario === "cellular" ? [W] : [W, D];
    return walls.map((L) => { const r = Z.windowRect(L, H, c.wwr, 0.3), std = V_SASH.w * V_SASH.h * L / V_SASH.facade; return { sash: Math.min(std, c.wwr * L * H), h: Math.min(V_SASH.h, r.z1 - r.z0) }; });
  }
  /* embodied carbon of the elements the options change, per m² of floor, over the study period with replacements
     (v16 phase 3, register carbon.*). dims [W, D, H]; scenario "cellular" (one facade) or corner (two). */
  function carbonOf(dims, scenario, dz) {
    const W = dims[0], D = dims[1], H = dims[2], Af = W * D, Y = RV("carbon.years"), rep = (life) => Math.ceil(Y / life);
    const fw = RV("carbon.window"), fl = RV("carbon.wall"), fb = RV("carbon.blind"), ff = RV("carbon.fixed"), fm = RV("carbon.mass"), fn = RV("carbon.fan"), fo = RV("carbon.night");
    const walls = scenario === "cellular" ? [W] : [W, D], out = { window: 0, wall: 0, blinds: 0, fixed: 0, mass: 0, fans: 0, night: 0 };
    const key = SHADE_LEVELS.office[dz.shading] || "none";
    walls.forEach((L) => {
      const Aw = dz.wwr * L * H, Ao = (1 - dz.wwr) * L * H, r = Z.windowRect(L, H, dz.wwr, 0.3), hw = r.z1 - r.z0;
      out.window += Aw * ((dz.uglass >= 1 ? fw.double : fw.triple) + (dz.gglass <= 0.3 ? fw.coat : 0)) * rep(fw.life);
      out.wall += Ao * (fl.base + fl.perCm * (fl.cm[dz.opaque] || 0));
      if (key !== "none") out.blinds += Aw * fb[key][0] * rep(fb[key][1]);
      const dep = { none: [0, 0], oh05: [0.5, 0], oh10: [1, 0], fin05: [0, 0.5], box05: [0.5, 0.5] }[dz.fixed] || [0, 0];
      out.fixed += ff * (dep[0] * L + 2 * dep[1] * hw);
      if (dz.nightAch === 1) out.night += fo.window * rep(fo.life);
    });
    if (dz.nightAch === 5) out.night += fo.storey * Af * rep(fo.life);
    out.mass = (fm[dz.mass] || 0) * Af;
    if (dz.fans) out.fans = fn.unit * Math.ceil(Af / fn.area) * rep(fn.life);
    const per = {}; let tot = 0; for (const k in out) { per[k] = out[k] / Af; tot += per[k]; }
    return { per, total: tot };
  }
  const effArea = (ops, kind) => ops.reduce((s, o) => s + o.sash * (kind === 2 ? 1 : V_CK), 0); // m², kind 1 tilt, 2 open
  // EN 16798-7 single-sided airing without wind: m³/h through all openings of the kind, at a temperature difference dT
  const ventFlow = (ops, kind, dT) => dT <= 0 ? 0 : ops.reduce((s, o) => s + VM.k * o.sash * (kind === 2 ? 1 : V_CK) * Math.sqrt(VM.cst * o.h * dT), 0);
  // blinds down per hour for a facade azimuth: irradiance on the facade above the use's threshold (same rule as simulate)
  function blindsDown(ctx, az) {
    const thr = SHADE_IRR[ctx.useKey], lim = shadeSide(ctx.wx.lat, az) ? thr[0] : thr[1], I = G.irradiance(ctx.wx, 90, az).tot, out = new Uint8Array(8760);
    for (let i = 0; i < 8760; i++) out[i] = I[i] > lim ? 1 : 0;
    return out;
  }
  // percentile of a list of values (q = 0.99: the value exceeded in 1 % of the entries); the largest when fewer than 100
  function pctl(a, q) { if (!a.length) return 0; const s = Float64Array.from(a).sort(); return s.length < 100 ? s[s.length - 1] : s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
  // mode: "free" | "heat" | { cool: Float32Array upper limit } | "din" (DIN 4108-2 check: the standard's controls only)
  function simulate(ctx, c, mode, keepHourly) {
    const { wx, use: u, occ, pres, rho } = ctx, din = mode === "din";
    const zone = Z.buildZone(zoneParams(ctx, c)), shd = shadeOf(ctx, c);
    const eng = G.Iso52016(zone, wx, Object.assign({ wind: { terrain: "station" }, fw: "angle", shade: shd.fc < 1 ? { tau: 0, rho: 0, ratio: shd.fc, dR: shd.dR } : null }, ENGINE, ctx.engineOpt || {}));
    const wins = eng.windows(), thr = SHADE_IRR[ctx.useKey];
    const irr = wins.map((w) => G.irradiance(wx, 90, w.azimuth).tot), wthr = wins.map((w) => (shadeSide(wx.lat, w.azimuth) ? thr[0] : thr[1]));
    const V = zone.volume, Af = zone.floorArea, heat = mode !== "free", coolHi = mode && mode.cool ? (c.fans && mode.coolFan ? mode.coolFan : mode.cool) : null;
    let fanH = 0, topPrev = 20; const fanW = ctx.fanW != null ? ctx.fanW : FAN_W, fanT = ctx.fanT != null ? ctx.fanT : VR.fanT; // ceiling fans: hours on, power, start temperature
    const fanMask = c.fans && !din ? new Uint8Array(8760) : null; // hours in which the fans ran (the comfort credit applies only there)
    const achOcc = achOccOf(u, zone.height || zone.volume / zone.floorArea), nonres = u.din !== "residential";
    const hand = ctx.blindCtl === "hand" && nonres; // DIN 4108-2, 8.4.2 j: blinds operated by hand are not used at weekends
    const gtotOk = (c.gglass || 1) * shd.fc <= VR.gtot + 1e-9; // DIN 4108-2, 8.4.2 i: night ventilation counts only with g_tot <= 0.4
    const vFloor = u.tHeat + (ctx.ventFloor != null ? ctx.ventFloor : VR.floor), ops = openings(ctx, c); // design runs: window air is reduced so that the room stays above this operative temperature
    const cL = [], eL = [], eLA = [];
    const arm = ctx.nightArm != null ? ctx.nightArm : VR.arm; let curMax = -99, lastMax = -99, wasPres = 0; // night ventilation armed after a warm day
    const top = new Float32Array(8760), tair = new Float32Array(8760), bdown = keepHourly ? new Uint8Array(8760) : null, achH = keepHourly ? new Float32Array(8760) : null, bmask = keepHourly ? new Uint8Array(8760) : null, qIntH = keepHourly ? new Float32Array(8760) : null, gOcc = ctx.gOcc != null ? ctx.gOcc : u.gainOcc;
    const eHist = coolHi ? new Int16Array(CBINS) : null, eHistA = coolHi ? new Int16Array(CBINS) : null; let ePeak = 0, ePeakA = 0, cPeakVent = 0; // ceiling: load at its rating (10 K), fresh-air share at the peak
    let qHsum = 0, qCsum = 0, qLsum = 0, humid = 0, tmax = -99, cPeak = 0, latH = 0, cMax = 0, vHours = 0, ventHeat = 0;
    const cHist = coolHi ? new Int16Array(CBINS) : null; // hours of sensible cooling by load, CBIN W/m² floor per bin
    const p = { hVe: 0, thSup: 0, qInt: 0, phiHC: 0, shadeMask: 0 };
    let tAir = 20, dayOpen = 0, nightOpen = 0;
    const wLim = 0.012, SA = wx._supply || supplyAir(wx);
    const run = (i, rec) => {
      const te = wx.t[i], cp = rho[i] * 1006 / 3600;
      let mask = 0;
      const weekend = (((i / 24) | 0) % 7) >= 5; // 1 January a Monday
      /* blinds down when the sun on the window is above the DIN 4108-2 threshold of the use (8.4.2 j), both blind types. Design
         runs keep them up while the room air is at or below 23 °C (winter sun); the DIN check uses the threshold alone
         (decision of 17 November 2026). Blinds operated by hand stay up at weekends in non-residential use. */
      /* v16 phase 3.5 (decision of 27 November 2026): comfort-driven control, the default. Blinds down when the operative
         temperature of the previous hour is above 26 °C or the upper edge of the comfort band (ctx.coolHi), whichever is
         lower, and the sun on the window is above 100 W/m², every orientation. The DIN 4108-2 check keeps the thresholds. */
      if (!din && ctx.blindRule !== "din") { const tLim = ctx.coolHi ? Math.min(BCOM.tOp, ctx.coolHi[i]) : BCOM.tOp;
        if (shd.fc < 1 && !(hand && weekend) && topPrev > tLim && !(ctx.blindHalf && ((i / 24) | 0) % 2)) for (let w = 0; w < wins.length; w++) if (irr[w][i] > BCOM.irr) mask |= wins[w].bit; }
      else if (shd.fc < 1 && !(hand && weekend) && (din || HOLD == null || tAir > HOLD) && !(ctx.blindHalf && ((i / 24) | 0) % 2)) for (let w = 0; w < wins.length; w++) if (irr[w][i] > wthr[w]) mask |= wins[w].bit;
      const base = occ[i] ? achOcc : u.achUnocc;
      let want = base, isDay = false;
      /* window ventilation. DIN check (8.4.2 h, i): by day up to 3 1/h when the room air is above 23 °C and above the outdoor
         air; at night the design's level (2 or 5 1/h) when the room air is above the heating setpoint and above the outdoor
         air, and only with g_tot of 0.4 or less. Design runs (v16): by day when the room air is above 23 °C, the outdoor air
         at least 1 K cooler and at least 12 °C; at night when the room air is above the heating setpoint and at least 2 K
         warmer than outside; in both cases the air flow is reduced so that the room does not fall below the heating setpoint
         + 1 K. In the cooled run windows stay shut while cooling runs (v12): by day they open only when the outdoor air is at
         least 2 K below the cooling limit and not humid; at night only when the outdoor air is not humid. */
      if (din) { // DIN 4108-2, 8.4.2 h and i: any day opening counts as 3 1/h; tilt windows at night as 2 1/h; across storeys 5 1/h
        if (pres[i]) { if (c.dayAch > 0 && tAir > VR.dinDayT && tAir > te) { want = Math.max(base, VR.dinDay); isDay = true; } }
        else if (c.nightAch > 0 && gtotOk && tAir > u.tHeat && tAir > te) want = Math.max(base, c.nightAch === 5 ? 5 : 2);
      } else { // v16 phase 2: air flow of the opening (EN 16798-7, single-sided, no wind); across storeys: 5 1/h
        const dryOut = !coolHi || wx.w[i] <= W_DEHUM, coolOk = !coolHi || !occ[i] || te <= coolHi[i] - 2;
        if (pres[i]) { if (c.dayAch > 0 && tAir > VR.dayT && te <= tAir - VR.dayM && te >= VR.dayOut && dryOut && coolOk) { want = Math.max(base, ventFlow(ops, c.dayAch, tAir - te) / V); isDay = true; } }
        else if (c.nightAch > 0 && lastMax > arm && tAir > u.tHeat && te <= tAir - VR.nightM && dryOut) want = Math.max(base, c.nightAch === 5 ? 5 : ventFlow(ops, 1, tAir - te) / V);
      }
      const sup = c.supply || "outdoor", tb = sup === "earth" ? SA.earth[i] : sup === "evap" ? SA.evap[i] : te;
      const fanOn = c.fans && !din && occ[i] && topPrev >= fanT; p.qInt = (occ[i] ? gOcc : u.gainUnocc) * Af + (fanOn ? fanW * Af : 0); p.phiHC = 0; p.shadeMask = mask;
      const setAir = (a) => { p.hVe = cp * V * a; p.thSup = (base * tb + (a - base) * te) / a; };
      let ach = want; setAir(ach);
      let r = eng.trial(i, p), q = 0;
      if (!din && want > base && r.thOp < vFloor) { // reduce the window air flow so that the room stays at vFloor
        setAir(base); const r0 = eng.trial(i, p);
        if (r0.thOp <= vFloor) { ach = base; r = r0; }
        else { let lo = base, hi = want, tLo = r0.thOp, tHi = r.thOp; // secant on the air change, two steps
          for (let k = 0; k < 2; k++) { const a = lo + (hi - lo) * (tLo - vFloor) / Math.max(1e-9, tLo - tHi); setAir(a); const ra = eng.trial(i, p); if (ra.thOp >= vFloor) { lo = a; tLo = ra.thOp; r = ra; ach = a; } else { hi = a; tHi = ra.thOp; } }
          if (ach === want) { setAir(lo); r = eng.trial(i, p); ach = lo; } }
      }
      if (rec && ach > base + 1e-6) { if (isDay) dayOpen++; else nightOpen++; vHours++; }
      if (heat) {
        const tC = coolHi && occ[i] ? coolHi[i] : Infinity;
        const tg = r.thOp < u.tHeat ? u.tHeat : r.thOp > tC ? tC : null;
        if (tg !== null) { p.phiHC = 1000; const r1 = eng.trial(i, p); q = 1000 * (tg - r.thOp) / (r1.thOp - r.thOp); p.phiHC = q; r = eng.trial(i, p); }
      }
      eng.commit(r); tAir = r.thAir; topPrev = r.thOp; if (rec && fanOn) { fanH++; fanMask[i] = 1; }
      if (pres[i]) { if (!wasPres) curMax = -99; if (r.thOp > curMax) curMax = r.thOp; } else if (wasPres) lastMax = curMax; wasPres = pres[i];
      if (rec) {
        top[i] = r.thOp; tair[i] = r.thAir; if (r.thOp > tmax) tmax = r.thOp; if (bdown) { let m = mask, n = 0; while (m) { n += m & 1; m >>= 1; } bdown[i] = n; achH[i] = ach; bmask[i] = mask; qIntH[i] = p.qInt / Af; } // hourly record (validation)
        if (q > 0) { qHsum += q; if (ach > base + 1e-6 && !din) ventHeat++; } else qCsum -= q;
        if (cHist && q < 0) { const wm = -q / Af; cL.push([wm, Math.max(0, p.hVe * (p.thSup - r.thAir) / Af)]); if (wm > cMax) cMax = wm; cHist[Math.min(CBINS - 1, Math.floor(wm / CBIN))]++;
          /* chilled ceiling (register ceil.model): output q = cap10 * (dT / 10)^1.1, dT = room operative temperature minus mean water temperature; the water may not run
             below 16 °C (rating point: room 26 °C, 10 K) nor below the room dew point + 1 K. Room humidity: what ventilation and
             moisture gains give, held at most at W_DEHUM by dehumidified supply air where needed. The equivalent load at the
             rating, wm / f, is what the ceiling must deliver at 10 K. */
          if (occ[i]) { const m = rho[i] * V * ach, wSup = wx.w[i] + (c.supply === "evap" ? SA.dw[i] * base / ach : 0), w0 = (m * wSup + u.moist * Af / 1000) / m;
            const eqOf = (wr) => { const pv = wr * wx.p[i] / (0.622 + wr), al = Math.log(Math.max(1, pv) / 611.2), tdp = 243.12 * al / (17.62 - al);
              const dT = r.thOp - Math.max(T_WATER, tdp + CM.dewMargin); return wm / (dT > 0.5 ? Math.pow(dT / 10, CM.exp) : 0.05); };
            const eq = eqOf(Math.min(W_DEHUM, w0)), eqA = eqOf(w0); // with dehumidified supply air where needed; ceiling alone
            eL.push(eq); eHist[Math.min(CBINS - 1, Math.floor(eq / CBIN))]++;
            eLA.push(eqA); eHistA[Math.min(CBINS - 1, Math.floor(eqA / CBIN))]++; } }
        if (occ[i]) { const m = rho[i] * V * ach, wSup = wx.w[i] + (c.supply === "evap" ? SA.dw[i] * base / ach : 0), wi = (m * wSup + u.moist * Af / 1000) / m; if (wi > wLim) humid++;
          /* cooled run, occupied hours: moisture removed (latent cooling). The cooling air leaves the coil at 13 °C and can
             carry at most W_COIL, so sensible cooling dries the room as a side effect; the room humidity settles where
             ventilation, moisture gains and the coil balance, and anything still above W_DEHUM is removed on top.
             Checked against EnergyPlus ideal loads with a humidistat (25 October 2026). Wh over the hour. */
          if (coolHi) {
            const G0 = u.moist * Af / 1000, mc = q < 0 && r.thAir > 13.5 ? -q * 3.6 / (1.006 * (r.thAir - 13)) : 0; // kg/h
            let w = wi; if (mc > 0) { const we = (m * wSup + G0 + mc * W_COIL) / (m + mc); if (we < wi && wi > W_COIL) w = we; }
            const wf = Math.min(w, W_DEHUM), L = m * (wSup - wf) + G0; // kg/h removed to hold the room at wf
            if (L > 0) { qLsum += L * 2.45e6 / 3600; if (L * 2.45e6 / 3600 > 0.5 * Af) latH++; } } } // latH: hours with moisture removal above 0.5 W/m² floor
      }
    };
    for (let i = 8760 - 672; i < 8760; i++) run(i, false); // four weeks of December as run-up
    for (let i = 0; i < 8760; i++) run(i, true);
    // design peaks (v16): the 99th percentile of the occupied cooling hours, so that a Monday restart does not set the size
    if (cL.length) { cL.sort((a, b) => a[0] - b[0]); const k = cL.length < 100 ? cL.length - 1 : Math.min(cL.length - 1, Math.floor(VR.peak * cL.length)); cPeak = cL[k][0]; cPeakVent = cL[k][1]; }
    ePeak = pctl(eL, VR.peak); ePeakA = pctl(eLA, VR.peak);
    return { top, tair: keepHourly ? tair : null, bdown, achH, bmask, qIntH, winBits: wins.map((x) => [x.id, x.bit]), nWin: wins.length, heat: qHsum / 1000 / Af, cool: qCsum / 1000 / Af, fanH, fanE: fanH * fanW / 1000, fanMask, coolLat: qLsum / 1000 / Af, cHist, cPeak, cMax, latH, eHist, ePeak, ePeakMax: eL.length ? Math.max.apply(null, eL) : 0, eHistA, ePeakA, cPeakVent, humid, tmax, zone, shade: shd, dayOpen, nightOpen, gtotOk, ventHeat, vHours };
  }
  // free-running and heating-on, scored under every evaluation
  // ideal cooling in occupied hours to an hourly upper limit set by the page from the comfort model (ctx.coolHi; v6, 27 October
  // 2026: the upper edge of the German annex band, fixed limits for EN 16798-1 and ASHRAE 55, the DIN reference temperature),
  // or to a fixed operative temperature when none is given
  const CBIN = 5, CBINS = 40; // load bins for the cooling-load histogram: 5 W/m² floor wide, the last one open
  const coolArr = (ctx) => ctx.coolHi || ctx._coolArr || (ctx._coolArr = new Float32Array(8760).fill(ctx.coolSet || 26));
  function summary(ctx, x, energy) {
    const o = Object.assign(C.scoreAll(x.top, ctx.occ, ctx.dinMask, ctx.BN, x.fanMask), { humid: x.humid, tmax: Math.round(x.tmax * 10) / 10, dayOpen: x.dayOpen, nightOpen: x.nightOpen, ventHeat: x.ventHeat });
    if (energy) { o.qh = Math.round(x.heat * 10) / 10; o.fanE = Math.round(x.fanE * 100) / 100; o.fanH = x.fanH; o.qcs = Math.round(x.cool * 10) / 10; o.ql = Math.round(x.coolLat * 10) / 10; o.qc = Math.round((x.cool + x.coolLat) * 10) / 10;
      if (x.cHist) { o.cHist = Array.from(x.cHist); o.cPeak = Math.round(x.cPeak * 10) / 10; o.latH = x.latH; o.eHist = Array.from(x.eHist); o.ePeak = Math.round(x.ePeak * 10) / 10; o.eHistA = Array.from(x.eHistA); o.ePeakA = Math.round(x.ePeakA * 10) / 10; o.cPeakVent = Math.round(x.cPeakVent * 10) / 10; o.cMax = Math.round(x.cMax * 10) / 10; } } // qc: sensible + latent; cHist: hours of sensible cooling by load
    return o;
  }
  // free-running, heating without cooling, heating and ideal cooling; scored under every evaluation
  function runCombo(ctx, c, only) {
    const out = {};
    if (!only || only === "free") out.free = summary(ctx, simulate(ctx, c, "free"), false);
    if (!only || only === "heat") out.heat = summary(ctx, simulate(ctx, c, "heat"), true);
    if (!only || only === "cool") out.cool = summary(ctx, simulate(ctx, c, { cool: coolArr(ctx), coolFan: ctx.coolHiFan }), true);
    return out;
  }
  /* DIN 4108-2 summer protection check (v16), with the conditions of clause 8.4.2 only: the standard's gains (100 %
     convective), schedules, base air, heating setpoint, day ventilation up to 3 1/h, night ventilation as designed (2 or
     5 1/h) only with g_tot <= 0.4, blinds by irradiance alone, no fans, no cooling. On the project's weather file the
     result is an indication: the proof uses the 2011 test reference year of the region (8.4.2 c). */
  function runDin(ctx, c) {
    const dctx = Object.assign({}, ctx, { gOcc: null, engineOpt: Object.assign({}, ctx.engineOpt || {}, { fIntC: RV("din.gain.convective") }) });
    const x = simulate(dctx, Object.assign({}, c, { fans: 0 }), "din"), o = { nightCounted: !!(c.nightAch > 0 && x.gtotOk) }, sc = C.scoreAll(x.top, ctx.occ, ctx.dinMask, ctx.BN);
    Object.keys(sc).forEach((k) => { if (k.startsWith("din")) o[k] = sc[k]; }); return o;
  }
  // balanced random designs: each level of each parameter appears about equally often
  function designs(k, seed, levels) {
    let s = seed || 1; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const keys = ["wwr", "opaque", "uglass", "gglass", "mass", "fixed", "shading", "dayAch", "nightAch", "fans", "supply", "roof"], cols = {};
    keys.forEach((key) => { const lv = (levels && levels[key]) || PARAMS[key], arr = []; for (let i = 0; i < k; i++) arr.push(lv[i % lv.length]);
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } cols[key] = arr; });
    const out = []; for (let i = 0; i < k; i++) { const d = {}; keys.forEach((key) => { d[key] = cols[key][i]; }); out.push(d); }
    return out;
  }
  const api = { CBIN, CBINS, USE, OPAQUE, panes, colOf, FIXED, WALL, SUPPLY, ROOF, supplyAir, blindsDown, SHADES, SHADE_LEVELS, SHADE_IRR, PARAMS, SCENARIOS, schedules, context, simulate, runCombo, runDin, T_WATER, FAN_W, designs, shadeOf, zoneParams, humidityRatio, isNorth, shadeSide, achOccOf, pctl, VR, openings, effArea, ventFlow, carbonOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Sweep = api;
})(this);

/* Daylight inside the sweep, by the app's Daylight Assessment Criteria (24 October 2026).
   One job per room type, window-to-wall ratio and outdoor shading: daylight coefficients once (facade A due south,
   sky turned for each orientation), glass computed at visible transmittance 0.70 and scaled to each glass type.
   Unshaded: fixed shading and reveals are geometry, movable blinds are not modelled. Reference plane 0.85 m,
   analysis area = floor minus a 0.5 m band.
   Reading A (EN 17037+): A1 = EN 17037 minimum level on daylight hours; A2 UDA = share of area with 300 to 3000 lx
   for at least 50% of the time base; A3 EXA = share of area above 3000 lx for more than 10% of the time base;
   pass = A1 and A2 and A3; score S (300 lx ramp, 0 above 3000 lx). Time base: daylight hours for dwellings,
   8:00 to 18:00 for office and school. Practice preset: 200 to 2000 lx, 60% of hours over 60% of the area.
   Reading B: EN 17037 levels on daylight hours. Reading C: LEED v4.1 sDA 300/50 and ASE 1000,250 on 8:00 to 18:00. */
(function (root) {
  "use strict";
  const DL = root.Daylight || require("./daylight.js"), Z = root.SweepZone || require("./zone2.js"), S = root.Sweep || require("./sweep2.js");
  const TAU0 = 0.70;
  // visible transmittance by window U (double or triple glazing) and g value (register dl.tv)
  const TV = Object.assign({}, (root.Register || require("./register.js")).val("dl.tv"));
  const tvKey = (u, g) => (u >= 1 ? "d" : "t") + Math.round(g * 100);
  const REFL = { floor: 0.2, wall: 0.5, ceiling: 0.7, ext: 0.3, revealIn: 0.5 };
  const FAST = { raysSensor: 32, raysPatch: 16, patchSize: 0.4 };
  function sensors(W, D, spacing, border, z) {
    spacing = spacing || 0.5; border = border == null ? 0.5 : border; z = z || 0.85;
    const nx = Math.max(2, Math.round((W - 2 * border) / spacing) + 1), ny = Math.max(2, Math.round((D - 2 * border) / spacing) + 1), out = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out.push([border + (W - 2 * border) * i / (nx - 1), border + (D - 2 * border) * j / (ny - 1), z]);
    return out;
  }
  function room(ctx, scenario, wwr, fixedKey) {
    const dims = ctx.dims || ctx.use.dims, W = dims[0], D = dims[1], H = dims[2], fx = S.FIXED[fixedKey], wall = ctx.wall || S.WALL;
    const walls = scenario === "cellular" ? ["A"] : ["A", "B"];
    const windows = walls.map((k) => { const r = Z.windowRect(k === "A" ? W : D, H, wwr, 0.3); return Object.assign(r, { wall: k, overhang: fx.overhang, fins: fx.fins }); });
    return { W, D, H, az: 180, tau: TAU0, windows, wall: { t: wall.depth, glass: wall.glass }, refl: REFL, sensors: sensors(W, D) };
  }
  const skyCache = {};
  function skyFor(ctx, az, S1) {
    const k = ctx.wx.name + "|" + az;
    if (!skyCache[k]) skyCache[k] = DL.skies(ctx.wx, S1, az - 180);
    return skyCache[k];
  }
  let SKY1 = null;
  const RG = root.Register || require("./register.js"), UDI = RG.val("dl.udi"), LIT = RG.val("dl.light"), BREF = RG.val("dl.blindRef");
  /* hours: daylight (sun above the horizon, from the sky) and the occupied hours of the use, as the thermal runs: DIN 4108-2
     schedule, Monday 1 January (v16 phase 2; until v16 phase 1 daylight used 8:00 to 18:00 on every day). Evaluated once
     on their union. */
  function hourSets(sk, ctx) {
    const u = ctx && ctx.use, o0 = u ? u.occ[0] : 8, o1 = u ? u.occ[1] : 18, wdOnly = u ? u.weekdays : false;
    const all = [], day = [], occ = [];
    for (let i = 0; i < 8760; i++) { const h = i % 24, d = sk.sun[3 * i + 2] > 0, o = h >= o0 && h < o1 && (!wdOnly || ((i / 24) | 0) % 7 < 5) && !(o0 === 0 && o1 === 24); if (d || o) { all.push(i); day.push(d ? 1 : 0); occ.push(o ? 1 : 0); } }
    return { all, day, occ };
  }
  /* metrics from per-sensor hourly illuminance on the union of hours; tb: "day" | "occ" time base for Reading A.
     v16 phase 2: fac (optional) = daylight factor of each hour for blinds as operated; band = useful daylight range of the
     use; light = { lpd, target } for lighting electricity with continuous dimming (offices and schools). */
  function readings(E, Es, nS, H, sc, tb, fac, band, light) {
    band = band || UDI.nonres; let udiN = 0, uLo = 0, uHi = 0, litSum = 0;
    const nH = H.all.length, nDay = H.day.reduce((a, b) => a + b, 0), nOcc = H.occ.reduce((a, b) => a + b, 0);
    const A = tb === "day" ? H.day : H.occ, nA = tb === "day" ? nDay : nOcc;
    let a100 = 0, a300 = 0, a500 = 0, a750 = 0, uda = 0, exa = 0, Ssum = 0, udaP = 0, exaP = 0, sda = 0, ase = 0, f1 = 0, f2 = 0, f3 = 0, f4 = 0;
    for (let s = 0; s < nS; s++) {
      let d100 = 0, d300 = 0, d500 = 0, d750 = 0, ua = 0, ue = 0, sc_ = 0, uaP = 0, ueP = 0, o300 = 0, sun = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0;
      for (let t = 0; t < nH; t++) {
        const e = E[s * nH + t] * sc * (fac ? fac[t] : 1);
        if (light && H.occ[t]) litSum += e >= light.target ? 0 : 1 - e / light.target;
        if (H.day[t]) { if (e >= 100) d100++; if (e >= 300) d300++; if (e >= 500) d500++; if (e >= 750) d750++; }
        if (A[t]) {
          if (e < 100) b1++; else if (e < 300) b2++; else if (e <= 3000) b3++; else b4++;
          if (e < band[0]) uLo++; else if (e <= band[1]) udiN++; else uHi++;
          if (e >= 300 && e <= 3000) ua++; if (e > 3000) ue++;
          sc_ += e < 300 ? e / 300 : e <= 3000 ? 1 : 0;
          if (e >= 200 && e <= 2000) uaP++; if (e > 2000) ueP++;
        }
        if (H.occ[t]) { if (e >= 300) o300++; if (Es[s * nH + t] * sc > 1000) sun++; }
      }
      if (d100 >= 0.5 * nDay) a100++; if (d300 >= 0.5 * nDay) a300++; if (d500 >= 0.5 * nDay) a500++; if (d750 >= 0.5 * nDay) a750++;
      if (ua >= 0.5 * nA) uda++; if (ue > 0.1 * nA) exa++; Ssum += sc_ / nA;
      if (uaP >= 0.6 * nA) udaP++; if (ueP > 0.1 * nA) exaP++;
      if (o300 >= 0.5 * nOcc) sda++; if (sun > 250) ase++;
      f1 += b1 / nA; f2 += b2 / nA; f3 += b3 / nA; f4 += b4 / nA;
    }
    const udi = 100 * udiN / (nS * nA), udiLo = 100 * uLo / (nS * nA), udiHi = 100 * uHi / (nS * nA);
    const lightE = light ? light.lpd * litSum / nS / 1000 : 0; // kWh/m²a
    const p = (x) => Math.round(1000 * x / nS) / 10;
    const r = { a100: p(a100), a300: p(a300), a500: p(a500), a750: p(a750), UDA: p(uda), EXA: p(exa), S: Math.round(1000 * Ssum / nS) / 1000,
      UDAp: p(udaP), EXAp: p(exaP), sDA: p(sda), ASE: p(ase), bins: [p(f1), p(f2), p(f3), p(f4)],
      udi: Math.round(10 * udi) / 10, udiLo: Math.round(10 * udiLo) / 10, udiHi: Math.round(10 * udiHi) / 10, band: band.slice(), light: Math.round(100 * lightE) / 100 };
    r.en = r.a750 >= 50 && r.a500 >= 95 ? "high" : r.a500 >= 50 && r.a300 >= 95 ? "medium" : r.a300 >= 50 && r.a100 >= 95 ? "minimum" : "none";
    r.A1 = r.en !== "none"; r.A2 = r.UDA >= 50; r.A3 = r.EXA <= 10; r.passA = r.A1 && r.A2 && r.A3;
    r.grade = r.A1 && r.A3 ? (r.UDA >= 80 ? "A" : r.UDA >= 65 ? "B" : r.UDA >= 50 ? "C" : "fail") : "fail";
    r.passP = r.A1 && r.UDAp >= 60 && r.EXAp <= 10;
    r.leed = r.ASE > 10 ? 0 : r.sDA >= 75 ? 3 : r.sDA >= 55 ? 2 : r.sDA >= 40 ? 1 : 0;
    return r;
  }
  // job: {scenario: "cellular"|"corner", wwr, fixed}; returns per orientation index: {tvKey: readings}
  /* job: {scenario: "cellular"|"corner", wwr, fixed}; returns per orientation index: {tvKey: readings without blinds,
     tvKey|interior, tvKey|exterior: readings with blinds as operated}. The hours with blinds down come from a heated run of a
     reference room (register dl.blindRef), so daylight and the thermal runs use the same rule; when down, the blind lets a
     small share through straight and scatters the rest evenly (withBlind). The EN 17037
     minimum (A1) is always read without blinds. */
  const KEEP = ["a100", "a300", "a500", "a750", "en", "A1"];
  /* daylight with blinds lowered for a share f of the windows each hour (decision of 20 November 2026): the light of the
     clear windows times (1 - f (1 - tauDir)), plus f times the blind's diffuse transmittance times the light arriving at
     the blind, re-emitted evenly from the glass (DL coefficient WD). Exterior blind: light just outside the glass, then
     the glass's diffuse transmittance; interior blind: light just inside the glass. A corner room counts both windows
     half when one is down. */
  function withBlind(dc, il, wl, fx, nS, nH) {
    const sh = fx.sh, f = fx.down, E = new Float32Array(nS * nH), Es = new Float32Array(nS * nH), src = sh.outside ? wl.Eout : wl.Ein;
    const tgd = sh.outside ? DL.glassDiffuse(TAU0) : 1, nG = dc.nG;
    for (let t = 0; t < nH; t++) {
      const ft = f[t], keep = 1 - ft * (1 - sh.tauDir);
      for (let k = 0; k < nS; k++) {
        let ed = 0; if (ft > 0) for (let g = 0; g < nG; g++) ed += dc.WD[k * nG + g] * src[g * nH + t];
        E[k * nH + t] = il.E[k * nH + t] * keep + ft * sh.tauDif * tgd * ed; Es[k * nH + t] = il.Es[k * nH + t] * keep;
      }
    }
    return { E, Es };
  }
  function job(ctx, j, opt) {
    opt = opt || FAST;
    SKY1 = SKY1 || DL.skyPatches(1);
    const c = room(ctx, j.scenario, j.wwr, j.fixed), nS = c.sensors.length, tb = ctx.useKey === "dwelling" ? "day" : "occ";
    const band = ctx.useKey === "dwelling" ? UDI.res : UDI.nonres, light = ctx.useKey === "dwelling" ? null : { lpd: LIT.lpd, target: LIT.target[ctx.useKey] || 500 };
    const dc = DL.coefficients(c, Object.assign({ sky: SKY1 }, opt)), out = [], nW = c.windows.length;
    for (let a = 0; a < 8; a++) {
      if (j.azs && !j.azs.includes(a)) { out.push(null); continue; } // v16 phase 3.2: only the orientations of the run
      const az = S.PARAMS.azimuth[a], sk = skyFor(ctx, az, SKY1), H = hourSets(sk, ctx), il = DL.illuminance(dc, sk, H.all), res = {};
      // blind hours from a heated run of the reference room with this window, orientation and blind type (same rule as the design runs)
      const facOf = (lv) => {
        const d = Object.assign({ scenario: j.scenario === "corner_top" ? "corner" : j.scenario, azimuth: az, wwr: j.wwr, fixed: j.fixed, shading: lv, fans: 0, supply: "outdoor", roof: "standard" }, BREF);
        const sim = S.simulate(ctx, d, "heat", true), sh = S.shadeOf(ctx, d);
        return { down: Float32Array.from(H.all, (i) => sim.bdown[i] / sim.nWin), sh };
      };
      const fx = { interior: facOf(1), exterior: facOf(2) }, wl = DL.windowLight(dc, sk, H.all), nH = H.all.length;
      for (const tk of Object.keys(TV)) {
        const r0 = readings(il.E, il.Es, nS, H, TV[tk] / TAU0, tb, null, band, light); res[tk] = r0;
        for (const k of ["interior", "exterior"]) { const b = withBlind(dc, il, wl, fx[k], nS, nH); const r = readings(b.E, b.Es, nS, H, TV[tk] / TAU0, tb, null, band, light); KEEP.forEach((x) => { r[x] = r0[x]; }); r.passA = r.A1 && r.A2 && r.A3; res[tk + "|" + k] = r; }
      }
      out.push(res);
    }
    return out;
  }
  // key of the daylight readings for a design: glass, and the blind type of its shading level
  const dlKey = (ctx, dz) => { const t = tvKey(dz.uglass, dz.gglass), k = dz.shading != null ? S.SHADE_LEVELS[ctx.useKey][dz.shading] : "none"; return k && k !== "none" ? t + "|" + k : t; };
  // per-sensor maps for one option at full resolution: UDI-a and UDI-e shares (Reading A time base), sun hours
  function floorMap(ctx, scenario, wwr, fixedKey, az, tvk) {
    SKY1 = SKY1 || DL.skyPatches(1);
    const c = room(ctx, scenario, wwr, fixedKey), nS = c.sensors.length, sk = skyFor(ctx, az, SKY1), H = hourSets(sk, ctx), tb = ctx.useKey === "dwelling" ? "day" : "occ";
    const il = DL.illuminance(DL.coefficients(c, { sky: SKY1 }), sk, H.all), sc = TV[tvk] / TAU0, nH = H.all.length, A = tb === "day" ? H.day : H.occ, nA = A.reduce((x, y) => x + y, 0);
    const ua = new Float32Array(nS), ue = new Float32Array(nS), sun = new Float32Array(nS);
    for (let s = 0; s < nS; s++) { let a1 = 0, e1 = 0, n = 0; for (let t = 0; t < nH; t++) { const e = il.E[s * nH + t] * sc; if (A[t]) { if (e >= 300 && e <= 3000) a1++; if (e > 3000) e1++; } if (H.occ[t] && il.Es[s * nH + t] * sc > 1000) n++; } ua[s] = a1 / nA; ue[s] = e1 / nA; sun[s] = n; }
    return { room: c, ua, ue, sun, all: readings(il.E, il.Es, nS, H, sc, tb), tb };
  }
  const api = { job, floorMap, room, sensors, readings, TV, tvKey, TAU0, dlKey, hourSets, skyFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.DaySweep = api;
})(typeof window !== "undefined" ? window : globalThis);

/* Scoring of room options by desirability (decision of 24 October 2026).
   Each option has three metrics: daylight score S (0..1, Reading A), passive comfort C (K·h/a or h/a outside the band,
   heated without cooling) and delivered energy E (kWh/m²a, heated and cooled: need ÷ COP for each).
   Desirability per metric, 0..1:
     dS = the chosen daylight measure (0..1) when the chosen minimum is met, else 0
     dC = 1 − C / (2 × limit), clipped to 0..1; options above the limit are marked as falling short
     dE = 1 at or below the target, 0 at or above the upper value, linear between
   Overall D = dS^wS · dC^wC · dE^wE with wS + wC + wE = 1 (weighted geometric mean).
   Also: the Pareto front on (S up, C down, E down), corner picks by the Chebyshev distance to the ideal,
   the ten best and what they share, and the regret of each measure. */
(function (root) {
  "use strict";
  const RG = root.Register || require("./register.js");
  const clip = (x) => Math.max(0, Math.min(1, x));
  function dS(m) { return m.A1 ? clip(m.S) : 0; }
  // comfort: 1 at 0 and 0 at twice the limit; or, when no option of the room type meets the limit, relative to the run:
  // 1 at the lowest overheating found (o.cBest) and 0 at o.cZero (decision of 25 October 2026)
  /* v16 phase 3: absolute scales (register score.shape). Comfort 1 at 0, 0.5 at the limit; energy 1 at or below the target,
     0.5 at the limit. Neither reaches 0, so designs that miss a target are still ranked. */
  function dC(m, o) { return 1 / (1 + Math.max(0, m.C) / Math.max(1e-9, o.limit)); }
  function dE(m, o) { return m.E <= o.target ? 1 : 1 / (1 + (m.E - o.target) / Math.max(1e-9, o.upper - o.target)); }
  /* targets (register rec.rule): o.dlT daylight share 0..1, o.limit comfort, o.upper energy limit, o.dinLim with m.din in
     Germany. Shortfalls as shares of the target; ws the largest, weighted by the priorities (largest weight = 1). */
  function meets(m, o) {
    const req = !!m.A1 && (m.din == null || o.dinLim == null || m.din <= o.dinLim);
    const hOk = m.H == null || o.maxOut == null || m.H <= o.maxOut; // share of occupied hours above the band, where the model has one
    // o.noC: a climate where every design needs cooling; comfort without cooling is then a resilience figure, not a target
    const t = { A1: !!m.A1, din: m.din == null || o.dinLim == null || m.din <= o.dinLim, S: m.S >= o.dlT - 1e-9, C: o.noC ? true : m.C <= o.limit && hOk, E: m.E <= o.upper };
    return Object.assign(t, { req, all: req && t.S && t.C && t.E });
  }
  function shortfall(m, o) {
    const sH = m.H == null || o.maxOut == null ? 0 : Math.max(0, (m.H - o.maxOut) / Math.max(1e-9, o.maxOut));
    const s = [m.A1 ? Math.max(0, (o.dlT - m.S) / Math.max(1e-9, o.dlT)) : 1, o.noC ? 0 : Math.max(0, (m.C - o.limit) / Math.max(1e-9, o.limit), sH), Math.max(0, (m.E - o.upper) / Math.max(1e-9, o.upper))];
    const wm = Math.max(...o.w); return { s, ws: Math.max(...s.map((x, i) => x * o.w[i] / wm)) };
  }
  /* one number to rank by: designs meeting every target in (2, 3] by their score; the others by closeness, in (1, 2] when
     they meet the daylight minimum and DIN 4108-2, in (0, 1] when not */
  function rank(m, o, D) { const t = meets(m, o); if (t.all) return { q: 2 + D, t, ws: 0, s: [0, 0, 0] }; const f = shortfall(m, o); return { q: (t.req ? 1 : 0) + 1 / (1 + f.ws), t, ws: f.ws, s: f.s }; }
  // o: {w:[wS,wC,wE], limit, target, upper}
  function score(m, o) {
    const d = [dS(m), dC(m, o), dE(m, o)], w = o.w;
    let D = 1;
    for (let i = 0; i < 3; i++) { if (w[i] <= 0) continue; if (d[i] <= 0) { D = 0; break; } D *= Math.pow(d[i], w[i]); }
    const k = o.dlT != null ? rank(m, o, D) : null;
    return { d, D, short: m.C > o.limit, q: k ? k.q : D, t: k ? k.t : null, ws: k ? k.ws : 0, s: k ? k.s : null };
  }
  // non-dominated options among those meeting A1: no other option is at least as good on all three and better on one
  function pareto(ms) {
    const c = ms.filter((m) => m.A1), out = [];
    for (const a of c) {
      let dom = false;
      for (const b of c) {
        if (b === a) continue;
        if (b.S >= a.S && b.C <= a.C && b.E <= a.E && (b.S > a.S || b.C < a.C || b.E < a.E)) { dom = true; break; }
      }
      if (!dom) out.push(a);
    }
    return out;
  }
  // corner pick for metric k: smallest largest weighted shortfall (1 − d), weight 0.6 on k and 0.2 on the others
  function corner(rows, k) {
    const w = [0.2, 0.2, 0.2]; w[k] = 0.6;
    let best = null, bv = Infinity;
    for (const r of rows) {
      if (!(r.D > 0)) continue;
      const v = Math.max(w[0] * (1 - r.d[0]), w[1] * (1 - r.d[1]), w[2] * (1 - r.d[2]));
      if (v < bv - 1e-12 || (Math.abs(v - bv) <= 1e-12 && r.D > best.D)) { bv = v; best = r; }
    }
    return best;
  }
  // rows: [{dz, D, ...}] scored. Ten best, and per measure: levels among the ten, and the regret:
  // D of the best option minus the best D reachable with that measure at any other level (from the options evaluated)
  function analyse(rows, measures, n) {
    const ok = rows.filter((r) => r.D > 0).sort((a, b) => b.D - a.D), top = ok.slice(0, n || 10), best = top[0] || null;
    const out = { top, best, measures: [] };
    if (!best) return out;
    for (const p of measures) {
      const levels = [...new Set(top.map((r) => r.dz[p]))];
      const alt = {};
      for (const r of ok) { const lv = r.dz[p]; if (lv === best.dz[p]) continue; if (!alt[lv] || r.D > alt[lv].D) alt[lv] = r; }
      const alts = Object.keys(alt).map((k) => ({ level: alt[k].dz[p], row: alt[k], loss: best.D - alt[k].D })).sort((a, b) => a.loss - b.loss);
      out.measures.push({ p, levels, constant: levels.length === 1, regret: alts.length ? alts[0].loss : null, nextBest: alts[0] || null, alts });
    }
    return out;
  }
  // daylight measures, each 0..1, and minimum levels (decision of 24 October 2026)
  const DLM = {
    UDI: (d) => (d.udi != null ? d.udi : 0) / 100, // v16 phase 2 default: useful daylight share with blinds as operated
    S: (d) => d.S, // useful daylight score of Reading A
    UDA: (d) => d.UDA / 100, // share of floor with 300 to 3,000 lx for at least half the hours
    LEED: (d) => (d.sDA / 100) * (d.ASE > 10 ? 10 / d.ASE : 1), // sDA, reduced in proportion when ASE is above 10%
    EN: (d) => ({ none: 0, minimum: 1 / 3, medium: 2 / 3, high: 1 })[d.en], // EN 17037 level as steps
  };
  const FLOOR = { en: (d) => !!d.A1, enx: (d) => !!(d.A1 && d.A3), none: () => true };
  function daylight(d, measure, floor) { if (!d) return { A1: false, S: 0 }; return { A1: FLOOR[floor || "en"](d), S: DLM[measure || "UDI"](d) }; }
  // daylight answer in words (register score.dl), from the share 0..1
  const DLW = RG.val("score.dl"), dlWord = (S) => { const p = 100 * S, w = DLW.words; return p < w[0] ? "not enough" : p < w[1] ? "sufficient" : p < w[2] ? "good" : "very good"; };
  const api = { dS, dC, dE, score, meets, shortfall, rank, dlWord, DLW, pareto, corner, analyse, daylight, DLM, FLOOR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Score = api;
})(typeof window !== "undefined" ? window : globalThis);

/* Search per facade (room type × orientation), run in a worker.
   1. Daylight first: window ratio, outdoor shading and glazing (U and g, which set the light transmittance) are drawn only
      from variants that meet the EN 17037 minimum at this facade; the other measures are balanced at random.
   2. Refinement: rounds of variations (one or two measures changed) of options on the current Pareto front of
      daylight, passive comfort and delivered energy, so that the front fills in whatever the priorities.
   Each option runs two years: heated without cooling (passive comfort) and heated and cooled (energy).
   Also the two steps of the whole-building combination: shared measures fixed, the facade measures searched. */
(function (root) {
  "use strict";
  const S = root.Sweep || require("./sweep2.js"), DS = root.DaySweep || require("./dlsweep.js"), SC = root.Score || require("./score.js");
  const ALL = ["wwr", "fixed", "uglass", "gglass", "opaque", "mass", "shading", "dayAch", "nightAch", "fans", "roof"];
  const GEO = { wwr: 1, fixed: 1, uglass: 1, gglass: 1 };
  const SHARED = ["opaque", "uglass", "gglass", "mass", "roof"], OWN = ["wwr", "fixed", "shading", "dayAch", "nightAch", "fans"];
  // levels allowed for a measure: the strategies chosen in the inputs (all when not given)
  const LV = (o, p) => (o.levels && o.levels[p]) || S.PARAMS[p];
  const keyOf = (dz) => ALL.map((p) => p === "fans" ? dz[p] || 0 : dz[p]).join("|");
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const comfortOf = (heat, key) => { const x = heat[key]; return Array.isArray(x) ? x[0] : x; };
  // metrics of an evaluated option
  function metrics(row, o) {
    const dl = SC.daylight(row.dl, o.dlm, o.floor);
    // v11: ceiling fans raise the upper comfort limit where the standard allows it (o.fanOk); their electricity is added
    const fk = row.dz.fans && o.fanOk ? "_fan" : "";
    // v16 phase 3.2: with o.rk (ranking options from the page) also the share of hours above the band and the DIN estimate
    const rk = o.rk, hx = row.heat[o.key + fk], H = rk && rk.model !== "din" && Array.isArray(hx) ? 100 * hx[3] / rk.nOcc : null, din = rk && rk.dinLim != null ? row.heat["din_" + rk.region] : null;
    return { H, din, A1: dl.A1, S: dl.S, C: comfortOf(row.heat, o.key + fk), E: (o.mode === "heat" ? row.heat.qh / o.copH + (row.heat.fanE || 0) : row.cool.qh / o.copH + row.cool.qc / o.copC + (row.cool.fanE || 0)) + (row.heat.lightE || 0) };
  }
  function evaluator(ctx, o) {
    const seen = new Map(), arch = [];
    const dlOf = (dz) => { const t = o.tab[dz.wwr + "|" + dz.fixed]; return t ? t[DS.dlKey(ctx, dz)] || t[DS.tvKey(dz.uglass, dz.gglass)] || null : null; };
    const ev = (dz) => {
      const k = keyOf(dz); if (seen.has(k)) return seen.get(k);
      const c = Object.assign({ scenario: o.scenario, azimuth: o.azimuth, supply: "outdoor" }, dz);
      const row = { dz: Object.assign({}, dz), heat: S.runCombo(ctx, c, "heat").heat, cool: S.runCombo(ctx, c, "cool").cool, dl: dlOf(dz) };
      row.heat.lightE = row.cool.lightE = row.dl && row.dl.light ? row.dl.light : 0; // lighting electricity, kWh/m²a
      row.m = metrics(row, o); seen.set(k, row); arch.push(row);
      if (o.onProgress && arch.length % 10 === 0) o.onProgress(arch.length);
      return row;
    };
    return { ev, dlOf, arch, seen };
  }
  // o: {scenario, azimuth, tab, key, limit, copH, copC, nRandom, rounds, perRound, seed, onProgress}
  function search(ctx, o) {
    const R = rng(o.seed), E = evaluator(ctx, o), top = o.scenario === "corner_top";
    const meas = ALL.filter((p) => p !== "roof" || top);
    const geos = [];
    for (const w of LV(o, "wwr")) for (const f of LV(o, "fixed")) for (const u of LV(o, "uglass")) for (const g of LV(o, "gglass")) {
      const d = E.dlOf({ wwr: w, fixed: f, uglass: u, gglass: g }); if (d) { const x = SC.daylight(d, o.dlm, o.floor); geos.push({ wwr: w, fixed: f, uglass: u, gglass: g, A1: x.A1, S: x.S }); }
    }
    let pool = geos.filter((x) => x.A1); const noneA1 = !pool.length;
    if (noneA1) pool = geos.slice().sort((a, b) => b.S - a.S).slice(0, 10);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const rest = S.designs(o.nRandom, o.seed, o.levels);
    for (let i = 0; i < o.nRandom; i++) {
      const g = pool[i % pool.length], r = rest[i];
      E.ev({ wwr: g.wwr, fixed: g.fixed, uglass: g.uglass, gglass: g.gglass, opaque: r.opaque, mass: r.mass, shading: r.shading, dayAch: r.dayAch, nightAch: r.nightAch, fans: r.fans || 0, roof: top ? r.roof : "standard" });
    }
    const okGeo = (dz) => { const d = E.dlOf(dz); if (!d) return false; if (noneA1) return true; return SC.daylight(d, o.dlm, o.floor).A1; };
    for (let round = 0; round < o.rounds; round++) {
      let front = SC.pareto(E.arch.map((r) => Object.assign({ row: r }, r.m))).map((m) => m.row);
      const inLim = front.filter((r) => r.m.C <= 2 * o.limit); if (inLim.length) front = inLim;
      if (!front.length) front = E.arch.slice();
      let made = 0, tries = 0;
      while (made < o.perRound && tries < o.perRound * 40) {
        tries++;
        const par = front[Math.floor(R() * front.length)], dz = Object.assign({}, par.dz), nCh = R() < 0.7 ? 1 : 2;
        for (let k = 0; k < nCh; k++) { const p = meas[Math.floor(R() * meas.length)], lv = LV(o, p).filter((x) => x !== dz[p]); if (!lv.length) continue; dz[p] = lv[Math.floor(R() * lv.length)]; }
        if (E.seen.has(keyOf(dz)) || !okGeo(dz)) continue;
        E.ev(dz); made++;
      }
    }
    /* Pareto local search (decision of 25 October 2026, after the brute-force benchmark): every single change of every
       design on the front of daylight, overheating and energy is simulated, until the front stops changing; stops at
       o.cap designs (default 5,000) and reports whether the front is complete. */
    const complete = o.pls === false ? true : paretoLocal(E, o, meas, okGeo);
    if (o.rk && o.pls !== false) lowCarbonLocal(E, o, meas, okGeo);
    return { rows: E.arch.map((r) => ({ dz: r.dz, heat: r.heat, cool: r.cool })), noneA1, complete };
  }
  /* v16 phase 3.2: after the front is complete, a local search around the design with the least whole-life carbon among
     those that meet every target, until it stops improving (carbon is not on the front, so the front alone may miss it) */
  function lowCarbonLocal(E, o, meas, okGeo) {
    const rk = o.rk, cap = o.cap || 5000, done = new Set(), o0 = { w: rk.pri[0], limit: o.limit, target: rk.target, upper: rk.upper, dlT: rk.dlT, maxOut: rk.maxOut, dinLim: rk.dinLim, noC: rk.noC };
    const carb = (r) => r._k != null ? r._k : (r._k = S.carbonOf(rk.dims, rk.cscen, r.dz).total + r.m.E * rk.grid * rk.years);
    for (;;) {
      const meet = E.arch.filter((r) => SC.meets(r.m, o0).all); if (!meet.length) return;
      const lo = meet.reduce((b, r) => carb(r) < carb(b) ? r : b, meet[0]), k = keyOf(lo.dz); if (done.has(k)) return; done.add(k);
      for (const p of meas) for (const lv of LV(o, p)) {
        if (lv === lo.dz[p]) continue;
        const dz = Object.assign({}, lo.dz, { [p]: lv });
        if (E.seen.has(keyOf(dz)) || !okGeo(dz)) continue;
        if (E.arch.length >= cap) return; E.ev(dz);
      }
    }
  }
  function paretoLocal(E, o, meas, okGeo) {
    const cap = o.cap || 5000, done = new Set();
    for (;;) {
      let front = SC.pareto(E.arch.map((r) => Object.assign({ row: r }, r.m))).map((m) => m.row).filter((r) => !done.has(keyOf(r.dz)));
      /* v16 phase 3.2: front members far from every target (largest shortfall above rk.prune, register search.prune) are not
         expanded; the front still fills in wherever designs come within reach of the targets */
      if (o.rk && o.rk.prune != null) { const rk = o.rk, o0 = { w: rk.pri[0], limit: o.limit, target: rk.target, upper: rk.upper, dlT: rk.dlT, maxOut: rk.maxOut, dinLim: rk.dinLim, noC: rk.noC };
        // when nothing comes within reach, the bar is relative: twice the smallest largest shortfall found so far
        let m0 = Infinity; for (const r of E.arch) { const x = SC.shortfall(r.m, o0).ws; if (x < m0) m0 = x; }
        const thr = Math.max(rk.prune, 2 * m0); front = front.filter((r) => SC.shortfall(r.m, o0).ws <= thr); }
      if (!front.length) return true;
      for (const r of front) {
        done.add(keyOf(r.dz));
        for (const p of meas) for (const lv of LV(o, p)) {
          if (lv === r.dz[p]) continue;
          const dz = Object.assign({}, r.dz, { [p]: lv });
          if (E.seen.has(keyOf(dz)) || !okGeo(dz)) continue;
          if (E.arch.length >= cap) return false;
          E.ev(dz);
        }
      }
    }
  }
  /* Top-up after the daylight measure, minimum or comfort model changed: the designs already simulated are loaded
     (no new runs for them) and Pareto local search completes the front for the new choice. Returns the new designs. */
  function topUp(ctx, o) {
    const E = evaluator(ctx, o), top = o.scenario === "corner_top"; // v16 phase 3.4: progress reported (refinement)
    const meas = (o.meas || ALL).filter((p) => p !== "roof" || top); // o.meas: only these measures are varied (window refinement)
    o.rows.forEach((x) => { const row = { dz: Object.assign({}, x.dz), heat: x.heat, cool: x.cool, dl: E.dlOf(x.dz) }; row.m = metrics(row, o); E.seen.set(keyOf(x.dz), row); E.arch.push(row); });
    const n0 = E.arch.length, anyA1 = E.arch.some((r) => r.m.A1);
    const okGeo = (dz) => { if (!anyA1) return true; return SC.daylight(E.dlOf(dz), o.dlm, o.floor).A1; };
    const complete = paretoLocal(E, Object.assign({}, o, { cap: (o.cap || 5000) + n0 }), meas, okGeo);
    return { rows: E.arch.slice(n0).map((r) => ({ dz: r.dz, heat: r.heat, cool: r.cool })), complete };
  }
  // building step 1: one set of shared measures; each facade's seed designs taken over to it; best per facade
  // o: {scenario, shared:{opaque, uglass, gglass, mass, roof}, facades:[{a, azimuth, tab, seeds:[dz]}], key, limit, copH, copC, w, target, upper}
  function combineSeed(ctx, o) {
    return o.facades.map((f) => {
      const E = evaluator(ctx, Object.assign({}, o, { azimuth: f.azimuth, tab: f.tab, onProgress: null }));
      let best = null;
      f.seeds.forEach((sd) => { const r = E.ev(Object.assign({}, sd, o.shared)); r.s = SC.score(r.m, o); if (!best || r.s.D > best.s.D) best = r; });
      return { a: f.a, best: best ? best.dz : null, D: best ? best.s.D : 0, rows: E.arch.map((r) => ({ dz: r.dz, heat: r.heat, cool: r.cool })) };
    });
  }
  // building step 2: from a start design, change one facade measure at a time while the score improves (two passes)
  function combineRefine(ctx, o) {
    const E = evaluator(ctx, Object.assign({}, o, { onProgress: null }));
    const sc = (dz) => { const r = E.ev(dz); r.s = SC.score(r.m, o); return r; };
    let cur = sc(o.start);
    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      for (const p of OWN) for (const lv of LV(o, p)) {
        if (lv === cur.dz[p]) continue;
        const r = sc(Object.assign({}, cur.dz, { [p]: lv }));
        if (r.s.D > cur.s.D + 1e-9) { cur = r; moved = true; }
      }
      if (!moved) break;
    }
    return { a: o.a, best: cur.dz, D: cur.s.D, rows: E.arch.map((r) => ({ dz: r.dz, heat: r.heat, cool: r.cool })) };
  }
  // every single change of one design: each measure at each of its other levels (for like-for-like effects)
  function swaps(ctx, o) {
    const E = evaluator(ctx, Object.assign({}, o, { onProgress: null }));
    ALL.filter((p) => p !== "roof" || o.scenario === "corner_top").forEach((p) => LV(o, p).forEach((lv) => { if (lv !== o.dz[p]) E.ev(Object.assign({}, o.dz, { [p]: lv })); }));
    // measures that stand in for each other: both removed together
    [["dayAch", 0, "nightAch", 0], ["shading", 0, "fixed", "none"], ["mass", "medium", "nightAch", 0]].forEach(([p, po, q, qo]) => {
      if (LV(o, p).includes(po) && LV(o, q).includes(qo) && (o.dz[p] !== po || o.dz[q] !== qo)) E.ev(Object.assign({}, o.dz, { [p]: po, [q]: qo })); });
    return { rows: E.arch.map((r) => ({ dz: r.dz, heat: r.heat, cool: r.cool })) };
  }
  const api = { LV, search, topUp, combineSeed, combineRefine, swaps, metrics, comfortOf, ALL, SHARED, OWN, GEO, keyOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.FacadeSearch = api;
})(typeof window !== "undefined" ? window : globalThis);
