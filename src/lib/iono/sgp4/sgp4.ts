// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — SGP4 propagator port (drop 313, F2b #10).
//
// TypeScript transcription of `SGP4.cpp` from the Vallado C++ reference
// package (sgp4 Archer release, mirror pinned at the celestrak.org
// AIAA-2006-6753 bundle; see README.md, third-party boundary notice).
// Source sha256: 2ee7ad0e8f201e8251894083fe21e33a7aace2f43c871bf04357eb44a891b06e
// Faithful translation without physics changes
// (traducción fiel sin cambios de física). Translated 2026-10-17.
//
// The original carries no separate license text; its file header (mirrored
// above in spirit) documents provenance back to the 1980/1986 spacetrack
// reports and the 2006 AIAA paper by Vallado, Crawford, Hujsak and Kelso.
//
// Notes: C++ `double&` out-params become returned objects (pure where the
// source is pure); `sgp4init` mutates the passed record exactly like the
// C++ reference semantics. `fmod` (truncated) maps to a truncating
// remainder helper (NOT the floored JS `%` for negatives).

const PI = 3.14159265358979323846;
const TWOPI = 2.0 * PI;

/** Truncated remainder (C/C++ fmod semantics; JS % differs for negatives only in sign handling — same here, kept explicit). */
function fmod2(x: number, y: number): number {
  return x - Math.trunc(x / y) * y;
}

export type GravConstKind = "wgs72old" | "wgs72" | "wgs84";

/** Full SGP4 element set record (elsetrec). Mutable by sgp4init/sgp4. */
export interface ElsetRec {
  satnum: string;
  epochyr: number;
  epochtynumrev: number;
  error: number;
  operationmode: string;
  init: string;
  method: string;
  // Near Earth
  isimp: number;
  aycof: number; con41: number; cc1: number; cc4: number; cc5: number;
  d2: number; d3: number; d4: number;
  delmo: number; eta: number; argpdot: number; omgcof: number;
  sinmao: number; t: number; t2cof: number; t3cof: number;
  t4cof: number; t5cof: number; x1mth2: number; x7thm1: number;
  mdot: number; nodedot: number; xlcof: number; xmcof: number;
  nodecf: number;
  // Deep Space
  irez: number;
  d2201: number; d2211: number; d3210: number; d3222: number;
  d4410: number; d4422: number; d5220: number; d5232: number;
  d5421: number; d5433: number; dedt: number; del1: number;
  del2: number; del3: number; didt: number; dmdt: number;
  dnodt: number; domdt: number; e3: number; ee2: number;
  peo: number; pgho: number; pho: number; pinco: number;
  plo: number; se2: number; se3: number; sgh2: number;
  sgh3: number; sgh4: number; sh2: number; sh3: number;
  si2: number; si3: number; sl2: number; sl3: number;
  sl4: number; gsto: number; xfact: number; xgh2: number;
  xgh3: number; xgh4: number; xh2: number; xh3: number;
  xi2: number; xi3: number; xl2: number; xl3: number;
  xl4: number; xlamo: number; zmol: number; zmos: number;
  atime: number; xli: number; xni: number;
  // Extra elements
  a: number; altp: number; alta: number;
  epochdays: number; jdsatepoch: number; jdsatepochF: number;
  nddot: number; ndot: number;
  bstar: number; rcse: number; inclo: number; nodeo: number;
  ecco: number; argpo: number; mo: number; noKozai: number;
  classification: string; intldesg: string;
  ephtype: number; elnum: number; revnum: number;
  noUnkozai: number;
  am: number; em: number; im: number; Om: number; om: number; mm: number; nm: number;
  tumin: number; mus: number; radiusearthkm: number; xke: number;
  j2: number; j3: number; j4: number; j3oj2: number;
  diaMm: number; periodSec: number; active: number; notOrbital: number;
  rcsM2: number;
}

export function newElsetRec(): ElsetRec {
  return {
    satnum: "", epochyr: 0, epochtynumrev: 0, error: 0,
    operationmode: "a", init: "", method: "",
    isimp: 0,
    aycof: 0, con41: 0, cc1: 0, cc4: 0, cc5: 0,
    d2: 0, d3: 0, d4: 0,
    delmo: 0, eta: 0, argpdot: 0, omgcof: 0,
    sinmao: 0, t: 0, t2cof: 0, t3cof: 0,
    t4cof: 0, t5cof: 0, x1mth2: 0, x7thm1: 0,
    mdot: 0, nodedot: 0, xlcof: 0, xmcof: 0,
    nodecf: 0,
    irez: 0,
    d2201: 0, d2211: 0, d3210: 0, d3222: 0,
    d4410: 0, d4422: 0, d5220: 0, d5232: 0,
    d5421: 0, d5433: 0, dedt: 0, del1: 0,
    del2: 0, del3: 0, didt: 0, dmdt: 0,
    dnodt: 0, domdt: 0, e3: 0, ee2: 0,
    peo: 0, pgho: 0, pho: 0, pinco: 0,
    plo: 0, se2: 0, se3: 0, sgh2: 0,
    sgh3: 0, sgh4: 0, sh2: 0, sh3: 0,
    si2: 0, si3: 0, sl2: 0, sl3: 0,
    sl4: 0, gsto: 0, xfact: 0, xgh2: 0,
    xgh3: 0, xgh4: 0, xh2: 0, xh3: 0,
    xi2: 0, xi3: 0, xl2: 0, xl3: 0,
    xl4: 0, xlamo: 0, zmol: 0, zmos: 0,
    atime: 0, xli: 0, xni: 0,
    a: 0, altp: 0, alta: 0,
    epochdays: 0, jdsatepoch: 0, jdsatepochF: 0,
    nddot: 0, ndot: 0,
    bstar: 0, rcse: 0, inclo: 0, nodeo: 0,
    ecco: 0, argpo: 0, mo: 0, noKozai: 0,
    classification: "", intldesg: "",
    ephtype: 0, elnum: 0, revnum: 0,
    noUnkozai: 0,
    am: 0, em: 0, im: 0, Om: 0, om: 0, mm: 0, nm: 0,
    tumin: 0, mus: 0, radiusearthkm: 0, xke: 0,
    j2: 0, j3: 0, j4: 0, j3oj2: 0,
    diaMm: 0, periodSec: 0, active: 0, notOrbital: 0,
    rcsM2: 0,
  };
}

// ---------------------------------------------------------------------------
// dpper: deep-space long-period periodic contributions
// ---------------------------------------------------------------------------

export interface DpperState {
  ep: number; inclp: number; nodep: number; argpp: number; mp: number;
}

export function dpper(
  s: {
    e3: number; ee2: number; peo: number; pgho: number; pho: number;
    pinco: number; plo: number; se2: number; se3: number;
    sgh2: number; sgh3: number; sgh4: number; sh2: number; sh3: number;
    si2: number; si3: number; sl2: number; sl3: number; sl4: number;
    t: number; xgh2: number; xgh3: number; xgh4: number;
    xh2: number; xh3: number; xi2: number; xi3: number;
    xl2: number; xl3: number; xl4: number; zmol: number; zmos: number;
    inclo: number;
  },
  init: string,
  st: DpperState,
  opsmode: string,
): DpperState {
  let { ep, inclp, nodep, argpp, mp } = st;
  const zns = 1.19459e-5;
  const zes = 0.01675;
  const znl = 1.5835218e-4;
  const zel = 0.0549;

  let zm = s.zmos + zns * s.t;
  if (init === "y") zm = s.zmos;
  let zf = zm + 2.0 * zes * Math.sin(zm);
  let sinzf = Math.sin(zf);
  let f2 = 0.5 * sinzf * sinzf - 0.25;
  let f3 = -0.5 * sinzf * Math.cos(zf);
  const ses = s.se2 * f2 + s.se3 * f3;
  const sis = s.si2 * f2 + s.si3 * f3;
  const sls = s.sl2 * f2 + s.sl3 * f3 + s.sl4 * sinzf;
  const sghs = s.sgh2 * f2 + s.sgh3 * f3 + s.sgh4 * sinzf;
  const shs = s.sh2 * f2 + s.sh3 * f3;
  zm = s.zmol + znl * s.t;
  if (init === "y") zm = s.zmol;
  zf = zm + 2.0 * zel * Math.sin(zm);
  sinzf = Math.sin(zf);
  f2 = 0.5 * sinzf * sinzf - 0.25;
  f3 = -0.5 * sinzf * Math.cos(zf);
  const sel = s.ee2 * f2 + s.e3 * f3;
  const sil = s.xi2 * f2 + s.xi3 * f3;
  const sll = s.xl2 * f2 + s.xl3 * f3 + s.xl4 * sinzf;
  const sghl = s.xgh2 * f2 + s.xgh3 * f3 + s.xgh4 * sinzf;
  const shll = s.xh2 * f2 + s.xh3 * f3;
  let pe = ses + sel;
  let pinc = sis + sil;
  let pl = sls + sll;
  let pgh = sghs + sghl;
  let ph = shs + shll;

  if (init === "n") {
    pe = pe - s.peo;
    pinc = pinc - s.pinco;
    pl = pl - s.plo;
    pgh = pgh - s.pgho;
    ph = ph - s.pho;
    inclp = inclp + pinc;
    ep = ep + pe;
    const sinip = Math.sin(inclp);
    const cosip = Math.cos(inclp);

    if (inclp >= 0.2) {
      ph = ph / sinip;
      pgh = pgh - cosip * ph;
      argpp = argpp + pgh;
      nodep = nodep + ph;
      mp = mp + pl;
    } else {
      const sinop = Math.sin(nodep);
      const cosop = Math.cos(nodep);
      let alfdp = sinip * sinop;
      let betdp = sinip * cosop;
      const dalf = ph * cosop + pinc * cosip * sinop;
      const dbet = -ph * sinop + pinc * cosip * cosop;
      alfdp = alfdp + dalf;
      betdp = betdp + dbet;
      nodep = fmod2(nodep, TWOPI);
      if (nodep < 0.0 && opsmode === "a") nodep = nodep + TWOPI;
      let xls = mp + argpp + cosip * nodep;
      const dls = pl + pgh - pinc * nodep * sinip;
      xls = xls + dls;
      const xnoh = nodep;
      nodep = Math.atan2(alfdp, betdp);
      if (nodep < 0.0 && opsmode === "a") nodep = nodep + TWOPI;
      if (Math.abs(xnoh - nodep) > PI) {
        if (nodep < xnoh) nodep = nodep + TWOPI;
        else nodep = nodep - TWOPI;
      }
      mp = mp + pl;
      argpp = xls - mp - cosip * nodep;
    }
  }

  return { ep, inclp, nodep, argpp, mp };
}

// ---------------------------------------------------------------------------
// dscom: deep-space common items
// ---------------------------------------------------------------------------

export interface DscomOut {
  snodm: number; cnodm: number; sinim: number; cosim: number;
  sinomm: number; cosomm: number; day: number; e3: number; ee2: number;
  em: number; emsq: number; gam: number; peo: number; pgho: number;
  pho: number; pinco: number; plo: number; rtemsq: number;
  se2: number; se3: number; sgh2: number; sgh3: number; sgh4: number;
  sh2: number; sh3: number; si2: number; si3: number;
  sl2: number; sl3: number; sl4: number;
  s1: number; s2: number; s3: number; s4: number; s5: number;
  s6: number; s7: number;
  ss1: number; ss2: number; ss3: number; ss4: number; ss5: number;
  ss6: number; ss7: number;
  sz1: number; sz2: number; sz3: number;
  sz11: number; sz12: number; sz13: number;
  sz21: number; sz22: number; sz23: number;
  sz31: number; sz32: number; sz33: number;
  xgh2: number; xgh3: number; xgh4: number; xh2: number;
  xh3: number; xi2: number; xi3: number; xl2: number; xl3: number;
  xl4: number; nm: number;
  z1: number; z2: number; z3: number;
  z11: number; z12: number; z13: number;
  z21: number; z22: number; z23: number;
  z31: number; z32: number; z33: number;
  zmol: number; zmos: number;
}

export function dscom(
  epoch: number, ep: number, argpp: number, tc: number,
  inclp: number, nodep: number, np: number,
): DscomOut {
  const zes = 0.01675;
  const zel = 0.0549;
  const c1ss = 2.9864797e-6;
  const c1l = 4.7968065e-7;
  const zsinis = 0.39785416;
  const zcosis = 0.91744867;
  const zcosgs = 0.1945905;
  const zsings = -0.98088458;

  const nm = np;
  const em = ep;
  const snodm = Math.sin(nodep);
  const cnodm = Math.cos(nodep);
  const sinomm = Math.sin(argpp);
  const cosomm = Math.cos(argpp);
  const sinim = Math.sin(inclp);
  const cosim = Math.cos(inclp);
  const emsq = em * em;
  const betasq = 1.0 - emsq;
  const rtemsq = Math.sqrt(betasq);

  const peo = 0.0;
  const pinco = 0.0;
  const plo = 0.0;
  const pgho = 0.0;
  const pho = 0.0;
  const day = epoch + 18261.5 + tc / 1440.0;
  const xnodce = fmod2(4.523602 - 9.2422029e-4 * day, TWOPI);
  const stem = Math.sin(xnodce);
  const ctem = Math.cos(xnodce);
  const zcosil = 0.91375164 - 0.03568096 * ctem;
  const zsinil = Math.sqrt(1.0 - zcosil * zcosil);
  const zsinhl = 0.089683511 * stem / zsinil;
  const zcoshl = Math.sqrt(1.0 - zsinhl * zsinhl);
  const gam = 5.8351514 + 0.001944368 * day;
  let zx = (zsinis * stem) / zsinil;
  const zy = zcoshl * ctem + zcosis * zsinhl * stem;
  zx = Math.atan2(zx, zy);
  zx = gam + zx - xnodce;
  const zcosgl = Math.cos(zx);
  const zsingl = Math.sin(zx);

  let zcosg = zcosgs;
  let zsing = zsings;
  let zcosi = zcosis;
  let zsini = zsinis;
  let zcosh = cnodm;
  let zsinh = snodm;
  let cc = c1ss;
  const xnoi = 1.0 / nm;

  let a1 = 0, a2 = 0, a3 = 0, a4 = 0, a5 = 0, a6 = 0, a7 = 0;
  let a8 = 0, a9 = 0, a10 = 0;
  let x1 = 0, x2 = 0, x3 = 0, x4 = 0, x5 = 0, x6 = 0, x7 = 0, x8 = 0;
  let z31 = 0, z32 = 0, z33 = 0;
  let z1 = 0, z2 = 0, z3 = 0;
  let z11 = 0, z12 = 0, z13 = 0;
  let z21 = 0, z22 = 0, z23 = 0;
  let s3 = 0, s2 = 0, s4 = 0, s1 = 0, s5 = 0, s6 = 0, s7 = 0;
  let ss1 = 0, ss2 = 0, ss3 = 0, ss4 = 0, ss5 = 0, ss6 = 0, ss7 = 0;
  let sz1 = 0, sz2 = 0, sz3 = 0;
  let sz11 = 0, sz12 = 0, sz13 = 0;
  let sz21 = 0, sz22 = 0, sz23 = 0;
  let sz31 = 0, sz32 = 0, sz33 = 0;

  for (let lsflg = 1; lsflg <= 2; lsflg++) {
    a1 = zcosg * zcosh + zsing * zcosi * zsinh;
    a3 = -zsing * zcosh + zcosg * zcosi * zsinh;
    a7 = -zcosg * zsinh + zsing * zcosi * zcosh;
    a8 = zsing * zsini;
    a9 = zsing * zsinh + zcosg * zcosi * zcosh;
    a10 = zcosg * zsini;
    a2 = cosim * a7 + sinim * a8;
    a4 = cosim * a9 + sinim * a10;
    a5 = -sinim * a7 + cosim * a8;
    a6 = -sinim * a9 + cosim * a10;

    x1 = a1 * cosomm + a2 * sinomm;
    x2 = a3 * cosomm + a4 * sinomm;
    x3 = -a1 * sinomm + a2 * cosomm;
    x4 = -a3 * sinomm + a4 * cosomm;
    x5 = a5 * sinomm;
    x6 = a6 * sinomm;
    x7 = a5 * cosomm;
    x8 = a6 * cosomm;

    z31 = 12.0 * x1 * x1 - 3.0 * x3 * x3;
    z32 = 24.0 * x1 * x2 - 6.0 * x3 * x4;
    z33 = 12.0 * x2 * x2 - 3.0 * x4 * x4;
    z1 = 3.0 * (a1 * a1 + a2 * a2) + z31 * emsq;
    z2 = 6.0 * (a1 * a3 + a2 * a4) + z32 * emsq;
    z3 = 3.0 * (a3 * a3 + a4 * a4) + z33 * emsq;
    z11 = -6.0 * a1 * a5 + emsq * (-24.0 * x1 * x7 - 6.0 * x3 * x5);
    z12 =
      -6.0 * (a1 * a6 + a3 * a5) + emsq * (-24.0 * (x2 * x7 + x1 * x8) - 6.0 * (x3 * x6 + x4 * x5));
    z13 = -6.0 * a3 * a6 + emsq * (-24.0 * x2 * x8 - 6.0 * x4 * x6);
    z21 = 6.0 * a2 * a5 + emsq * (24.0 * x1 * x5 - 6.0 * x3 * x7);
    z22 =
      6.0 * (a4 * a5 + a2 * a6) + emsq * (24.0 * (x2 * x5 + x1 * x6) - 6.0 * (x4 * x7 + x3 * x8));
    z23 = 6.0 * a4 * a6 + emsq * (24.0 * x2 * x6 - 6.0 * x4 * x8);
    z1 = z1 + z1 + betasq * z31;
    z2 = z2 + z2 + betasq * z32;
    z3 = z3 + z3 + betasq * z33;
    s3 = cc * xnoi;
    s2 = (-0.5 * s3) / rtemsq;
    s4 = s3 * rtemsq;
    s1 = -15.0 * em * s4;
    s5 = x1 * x3 + x2 * x4;
    s6 = x2 * x3 + x1 * x4;
    s7 = x2 * x4 - x1 * x3;

    if (lsflg === 1) {
      ss1 = s1; ss2 = s2; ss3 = s3; ss4 = s4;
      ss5 = s5; ss6 = s6; ss7 = s7;
      sz1 = z1; sz2 = z2; sz3 = z3;
      sz11 = z11; sz12 = z12; sz13 = z13;
      sz21 = z21; sz22 = z22; sz23 = z23;
      sz31 = z31; sz32 = z32; sz33 = z33;
      zcosg = zcosgl;
      zsing = zsingl;
      zcosi = zcosil;
      zsini = zsinil;
      zcosh = zcoshl * cnodm + zsinhl * snodm;
      zsinh = snodm * zcoshl - cnodm * zsinhl;
      cc = c1l;
    }
  }

  const zmol = fmod2(4.7199672 + 0.2299715 * day - gam, TWOPI);
  const zmos = fmod2(6.2565837 + 0.017201977 * day, TWOPI);

  const se2 = 2.0 * ss1 * ss6;
  const se3 = 2.0 * ss1 * ss7;
  const si2 = 2.0 * ss2 * sz12;
  const si3 = 2.0 * ss2 * (sz13 - sz11);
  const sl2 = -2.0 * ss3 * sz2;
  const sl3 = -2.0 * ss3 * (sz3 - sz1);
  const sl4 = -2.0 * ss3 * (-21.0 - 9.0 * emsq) * zes;
  const sgh2 = 2.0 * ss4 * sz32;
  const sgh3 = 2.0 * ss4 * (sz33 - sz31);
  const sgh4 = -18.0 * ss4 * zes;
  const sh2 = -2.0 * ss2 * sz22;
  const sh3 = -2.0 * ss2 * (sz23 - sz21);

  const ee2 = 2.0 * s1 * s6;
  const e3 = 2.0 * s1 * s7;
  const xi2 = 2.0 * s2 * z12;
  const xi3 = 2.0 * s2 * (z13 - z11);
  const xl2 = -2.0 * s3 * z2;
  const xl3 = -2.0 * s3 * (z3 - z1);
  const xl4 = -2.0 * s3 * (-21.0 - 9.0 * emsq) * zel;
  const xgh2 = 2.0 * s4 * z32;
  const xgh3 = 2.0 * s4 * (z33 - z31);
  const xgh4 = -18.0 * s4 * zel;
  const xh2 = -2.0 * s2 * z22;
  const xh3 = -2.0 * s2 * (z23 - z21);

  return {
    snodm, cnodm, sinim, cosim, sinomm, cosomm, day,
    e3, ee2, em, emsq, gam, peo, pgho, pho, pinco, plo, rtemsq,
    se2, se3, sgh2, sgh3, sgh4, sh2, sh3, si2, si3, sl2, sl3, sl4,
    s1, s2, s3, s4, s5, s6, s7,
    ss1, ss2, ss3, ss4, ss5, ss6, ss7,
    sz1, sz2, sz3, sz11, sz12, sz13, sz21, sz22, sz23, sz31, sz32, sz33,
    xgh2, xgh3, xgh4, xh2, xh3, xi2, xi3, xl2, xl3, xl4, nm,
    z1, z2, z3, z11, z12, z13, z21, z22, z23, z31, z32, z33,
    zmol, zmos,
  };
}

// ---------------------------------------------------------------------------
// dsinit: deep-space resonance initialization
// ---------------------------------------------------------------------------

export interface DsinitIn {
  xke: number;
  cosim: number; emsq: number; argpo: number;
  s1: number; s2: number; s3: number; s4: number; s5: number;
  sinim: number;
  ss1: number; ss2: number; ss3: number; ss4: number; ss5: number;
  sz1: number; sz3: number; sz11: number; sz13: number;
  sz21: number; sz23: number; sz31: number; sz33: number;
  t: number; tc: number; gsto: number;
  mo: number; mdot: number; no: number; nodeo: number; nodedot: number;
  xpidot: number;
  z1: number; z3: number; z11: number; z13: number;
  z21: number; z23: number; z31: number; z33: number;
  ecco: number; eccsq: number;
}

export interface DsinitState {
  em: number; argpm: number; inclm: number; mm: number;
  nm: number; nodem: number;
}

export interface DsinitOut extends DsinitState {
  irez: number;
  atime: number;
  d2201: number; d2211: number; d3210: number; d3222: number;
  d4410: number; d4422: number; d5220: number; d5232: number;
  d5421: number; d5433: number;
  dedt: number; didt: number; dmdt: number; dndt: number;
  dnodt: number; domdt: number;
  del1: number; del2: number; del3: number;
  xfact: number; xlamo: number; xli: number; xni: number;
}

export function dsinit(q: DsinitIn, st: DsinitState): DsinitOut {
  let { em, argpm, inclm, mm, nm, nodem } = st;
  const {
    xke, cosim, emsq, argpo, s1, s2, s3, s4, s5, sinim,
    ss1, ss2, ss3, ss4, ss5, sz1, sz3, sz11, sz13,
    sz21, sz23, sz31, sz33, t, tc, gsto,
    mo, mdot, no, nodeo, nodedot, xpidot,
    z1, z3, z11, z13, z21, z23, z31, z33, ecco, eccsq,
  } = q;

  const q22 = 1.7891679e-6;
  const q31 = 2.1460748e-6;
  const q33 = 2.2123015e-7;
  const root22 = 1.7891679e-6;
  const root44 = 7.3636953e-9;
  const root54 = 2.1765803e-9;
  const rptim = 4.37526908801129966e-3;
  const root32 = 3.7393792e-7;
  const root52 = 1.1428639e-7;
  const x2o3 = 2.0 / 3.0;
  const znl = 1.5835218e-4;
  const zns = 1.19459e-5;

  let irez = 0;
  if (nm < 0.0052359877 && nm > 0.0034906585) irez = 1;
  if (nm >= 8.26e-3 && nm <= 9.24e-3 && em >= 0.5) irez = 2;

  const ses = ss1 * zns * ss5;
  const sis = ss2 * zns * (sz11 + sz13);
  const sls = -zns * ss3 * (sz1 + sz3 - 14.0 - 6.0 * emsq);
  const sghs = ss4 * zns * (sz31 + sz33 - 6.0);
  let shs = -zns * ss2 * (sz21 + sz23);
  if (inclm < 5.2359877e-2 || inclm > PI - 5.2359877e-2) shs = 0.0;
  if (sinim !== 0.0) shs = shs / sinim;
  const sgs = sghs - cosim * shs;

  const dedt = ses + s1 * znl * s5;
  const didt = sis + s2 * znl * (z11 + z13);
  const dmdt = sls - znl * s3 * (z1 + z3 - 14.0 - 6.0 * emsq);
  const sghl = s4 * znl * (z31 + z33 - 6.0);
  let shll = -znl * s2 * (z21 + z23);
  if (inclm < 5.2359877e-2 || inclm > PI - 5.2359877e-2) shll = 0.0;
  let domdt = sgs + sghl;
  let dnodt = shs;
  if (sinim !== 0.0) {
    domdt = domdt - (cosim / sinim) * shll;
    dnodt = dnodt + shll / sinim;
  }

  const dndt = 0.0;
  const theta = fmod2(gsto + tc * rptim, TWOPI);
  em = em + dedt * t;
  inclm = inclm + didt * t;
  argpm = argpm + domdt * t;
  nodem = nodem + dnodt * t;
  mm = mm + dmdt * t;

  let aonv = 0, cosisq = 0, emo = 0, emsqo = 0, eoc = 0;
  let g201 = 0, g211 = 0, g300 = 0, g310 = 0, g322 = 0;
  let g410 = 0, g422 = 0, g520 = 0, g521 = 0, g532 = 0, g533 = 0;
  let sini2 = 0;
  let f220 = 0, f221 = 0, f311 = 0, f321 = 0, f322 = 0, f330 = 0;
  let f441 = 0, f442 = 0, f522 = 0, f523 = 0, f542 = 0, f543 = 0;
  let del1 = 0, del2 = 0, del3 = 0;
  let xfact = 0, xlamo = 0, xli = 0, xni = 0, atime = 0;
  let d2201 = 0, d2211 = 0, d3210 = 0, d3222 = 0;
  let d4410 = 0, d4422 = 0, d5220 = 0, d5232 = 0;
  let d5421 = 0, d5433 = 0;

  if (irez !== 0) {
    aonv = Math.pow(nm / xke, x2o3);

    if (irez === 2) {
      cosisq = cosim * cosim;
      emo = em;
      em = ecco;
      emsqo = emsq;
      const emsqNew = eccsq;
      eoc = em * emsqNew;
      g201 = -0.306 - (em - 0.64) * 0.44;

      if (em <= 0.65) {
        g211 = 3.616 - 13.247 * em + 16.29 * emsqNew;
        g310 = -19.302 + 117.39 * em - 228.419 * emsqNew + 156.591 * eoc;
        g322 = -18.9068 + 109.7927 * em - 214.6334 * emsqNew + 146.5816 * eoc;
        g410 = -41.122 + 242.694 * em - 471.094 * emsqNew + 313.953 * eoc;
        g422 = -146.407 + 841.88 * em - 1629.014 * emsqNew + 1083.435 * eoc;
        g520 = -532.114 + 3017.977 * em - 5740.032 * emsqNew + 3708.276 * eoc;
      } else {
        g211 = -72.099 + 331.819 * em - 508.738 * emsqNew + 266.724 * eoc;
        g310 = -346.844 + 1582.851 * em - 2415.925 * emsqNew + 1246.113 * eoc;
        g322 = -342.585 + 1554.908 * em - 2366.899 * emsqNew + 1215.972 * eoc;
        g410 = -1052.797 + 4758.686 * em - 7193.992 * emsqNew + 3651.957 * eoc;
        g422 = -3581.69 + 16178.11 * em - 24462.77 * emsqNew + 12422.52 * eoc;
        if (em > 0.715) g520 = -5149.66 + 29936.92 * em - 54087.36 * emsqNew + 31324.56 * eoc;
        else g520 = 1464.74 - 4664.75 * em + 3763.64 * emsqNew;
      }
      if (em < 0.7) {
        g533 = -919.2277 + 4988.61 * em - 9064.77 * emsqNew + 5542.21 * eoc;
        g521 = -822.71072 + 4568.6173 * em - 8491.4146 * emsqNew + 5337.524 * eoc;
        g532 = -853.666 + 4690.25 * em - 8624.77 * emsqNew + 5341.4 * eoc;
      } else {
        g533 = -37995.78 + 161616.52 * em - 229838.2 * emsqNew + 109377.94 * eoc;
        g521 = -51752.104 + 218913.95 * em - 309468.16 * emsqNew + 146349.42 * eoc;
        g532 = -40023.88 + 170470.89 * em - 242699.48 * emsqNew + 115605.82 * eoc;
      }

      sini2 = sinim * sinim;
      f220 = 0.75 * (1.0 + 2.0 * cosim + cosisq);
      f221 = 1.5 * sini2;
      f321 = 1.875 * sinim * (1.0 - 2.0 * cosim - 3.0 * cosisq);
      f322 = -1.875 * sinim * (1.0 + 2.0 * cosim - 3.0 * cosisq);
      f441 = 35.0 * sini2 * f220;
      f442 = 39.375 * sini2 * sini2;
      f522 =
        9.84375 * sinim * (sini2 * (1.0 - 2.0 * cosim - 5.0 * cosisq) +
          0.33333333 * (-2.0 + 4.0 * cosim + 6.0 * cosisq));
      f523 =
        sinim * (4.92187512 * sini2 * (-2.0 - 4.0 * cosim + 10.0 * cosisq) +
          6.56250012 * (1.0 + 2.0 * cosim - 3.0 * cosisq));
      f542 =
        29.53125 * sinim * (2.0 - 8.0 * cosim + cosisq * (-12.0 + 8.0 * cosim + 10.0 * cosisq));
      f543 =
        29.53125 * sinim * (-2.0 - 8.0 * cosim + cosisq * (12.0 + 8.0 * cosim - 10.0 * cosisq));
      const xno2 = nm * nm;
      const ainv2 = aonv * aonv;
      let temp1 = 3.0 * xno2 * ainv2;
      let temp = temp1 * root22;
      d2201 = temp * f220 * g201;
      d2211 = temp * f221 * g211;
      temp1 = temp1 * aonv;
      temp = temp1 * root32;
      d3210 = temp * f321 * g310;
      d3222 = temp * f322 * g322;
      temp1 = temp1 * aonv;
      temp = 2.0 * temp1 * root44;
      d4410 = temp * f441 * g410;
      d4422 = temp * f442 * g422;
      temp1 = temp1 * aonv;
      temp = temp1 * root52;
      d5220 = temp * f522 * g520;
      d5232 = temp * f523 * g532;
      temp = 2.0 * temp1 * root54;
      d5421 = temp * f542 * g521;
      d5433 = temp * f543 * g533;
      xlamo = fmod2(mo + nodeo + nodeo - theta - theta, TWOPI);
      xfact = mdot + dmdt + 2.0 * (nodedot + dnodt - rptim) - no;
      em = emo;
    }

    if (irez === 1) {
      g201 = 1.0 + emsq * (-2.5 + 0.8125 * emsq);
      g310 = 1.0 + 2.0 * emsq;
      g300 = 1.0 + emsq * (-6.0 + 6.60937 * emsq);
      f220 = 0.75 * (1.0 + cosim) * (1.0 + cosim);
      f311 = 0.9375 * sinim * sinim * (1.0 + 3.0 * cosim) - 0.75 * (1.0 + cosim);
      f330 = 1.0 + cosim;
      f330 = 1.875 * f330 * f330 * f330;
      del1 = 3.0 * nm * nm * aonv * aonv;
      del2 = 2.0 * del1 * f220 * g201 * q22;
      del3 = 3.0 * del1 * f330 * g300 * q33 * aonv;
      del1 = del1 * f311 * g310 * q31 * aonv;
      xlamo = fmod2(mo + nodeo + argpo - theta, TWOPI);
      xfact = mdot + xpidot - rptim + dmdt + domdt + dnodt - no;
    }

    xli = xlamo;
    xni = no;
    atime = 0.0;
    nm = no + dndt;
    void emsqo;
  }

  return {
    em, argpm, inclm, mm, nm, nodem,
    irez, atime,
    d2201, d2211, d3210, d3222, d4410, d4422, d5220, d5232, d5421, d5433,
    dedt, didt, dmdt, dndt, dnodt, domdt,
    del1, del2, del3, xfact, xlamo, xli, xni,
  };
}

// ---------------------------------------------------------------------------
// dspace: deep-space resonance effects
// ---------------------------------------------------------------------------

export interface DspaceState {
  em: number; argpm: number; inclm: number;
  xli: number; mm: number; xni: number; nodem: number;
  nm: number;
}

export interface DspaceOut extends DspaceState {
  atime: number;
  dndt: number;
}

export function dspace(
  s: {
    irez: number;
    d2201: number; d2211: number; d3210: number; d3222: number;
    d4410: number; d4422: number; d5220: number; d5232: number;
    d5421: number; d5433: number;
    dedt: number; del1: number; del2: number; del3: number;
    didt: number; dmdt: number; dnodt: number; domdt: number;
    argpo: number; argpdot: number; t: number; tc: number;
    gsto: number; xfact: number; xlamo: number; no: number;
  },
  st: DspaceState,
  atimeIn: number,
): DspaceOut {
  let { em, argpm, inclm, xli, mm, xni, nodem, nm } = st;
  const {
    irez, d2201, d2211, d3210, d3222, d4410, d4422, d5220, d5232,
    d5421, d5433, dedt, del1, del2, del3, didt, dmdt, dnodt, domdt,
    argpo, argpdot, t, tc, gsto, xfact, xlamo, no,
  } = s;
  let atime = atimeIn;

  const fasx2 = 0.13130908;
  const fasx4 = 2.8843198;
  const fasx6 = 0.37448087;
  const g22 = 5.7686396;
  const g32 = 0.95240898;
  const g44 = 1.8014998;
  const g52 = 1.050833;
  const g54 = 4.4108898;
  const rptim = 4.37526908801129966e-3;
  const stepp = 720.0;
  const stepn = -720.0;
  const step2 = 259200.0;

  let dndt = 0.0;
  const theta = fmod2(gsto + tc * rptim, TWOPI);
  em = em + dedt * t;
  inclm = inclm + didt * t;
  argpm = argpm + domdt * t;
  nodem = nodem + dnodt * t;
  mm = mm + dmdt * t;

  let ft = 0.0;
  if (irez !== 0) {
    if (atime === 0.0 || t * atime <= 0.0 || Math.abs(t) < Math.abs(atime)) {
      atime = 0.0;
      xni = no;
      xli = xlamo;
    }
    const delt = t > 0.0 ? stepp : stepn;

    let iretn = 381;
    let iret = 0;
    void iret;
    let xndt = 0.0, xnddt = 0.0, xldot = 0.0;
    while (iretn === 381) {
      if (irez !== 2) {
        xndt = del1 * Math.sin(xli - fasx2) + del2 * Math.sin(2.0 * (xli - fasx4)) + del3 * Math.sin(3.0 * (xli - fasx6));
        xldot = xni + xfact;
        xnddt = del1 * Math.cos(xli - fasx2) + 2.0 * del2 * Math.cos(2.0 * (xli - fasx4)) + 3.0 * del3 * Math.cos(3.0 * (xli - fasx6));
        xnddt = xnddt * xldot;
      } else {
        const xomi = argpo + argpdot * atime;
        const x2omi = xomi + xomi;
        const x2li = xli + xli;
        xndt =
          d2201 * Math.sin(x2omi + xli - g22) + d2211 * Math.sin(xli - g22) +
          d3210 * Math.sin(xomi + xli - g32) + d3222 * Math.sin(-xomi + xli - g32) +
          d4410 * Math.sin(x2omi + x2li - g44) + d4422 * Math.sin(x2li - g44) +
          d5220 * Math.sin(xomi + xli - g52) + d5232 * Math.sin(-xomi + xli - g52) +
          d5421 * Math.sin(xomi + x2li - g54) + d5433 * Math.sin(-xomi + x2li - g54);
        xldot = xni + xfact;
        xnddt =
          d2201 * Math.cos(x2omi + xli - g22) + d2211 * Math.cos(xli - g22) +
          d3210 * Math.cos(xomi + xli - g32) + d3222 * Math.cos(-xomi + xli - g32) +
          d5220 * Math.cos(xomi + xli - g52) + d5232 * Math.cos(-xomi + xli - g52) +
          2.0 * (d4410 * Math.cos(x2omi + x2li - g44) +
            d4422 * Math.cos(x2li - g44) +
            d5421 * Math.cos(xomi + x2li - g54) +
            d5433 * Math.cos(-xomi + x2li - g54));
        xnddt = xnddt * xldot;
      }

      if (Math.abs(t - atime) >= stepp) {
        iret = 0;
        iretn = 381;
      } else {
        ft = t - atime;
        iretn = 0;
      }

      if (iretn === 381) {
        xli = xli + xldot * delt + xndt * step2;
        xni = xni + xndt * delt + xnddt * step2;
        atime = atime + delt;
      }
    }

    nm = xni + xndt * ft + xnddt * ft * ft * 0.5;
    const xl = xli + xldot * ft + xndt * ft * ft * 0.5;
    if (irez !== 1) {
      mm = xl - 2.0 * nodem + 2.0 * theta;
      dndt = nm - no;
    } else {
      mm = xl - nodem - argpm + theta;
      dndt = nm - no;
    }
    nm = no + dndt;
  }

  return { em, argpm, inclm, xli, mm, xni, nodem, nm, atime, dndt };
}

// ---------------------------------------------------------------------------
// initl: initialize SGP4
// ---------------------------------------------------------------------------

export interface InitlOut {
  method: string;
  ainv: number; ao: number;
  con41: number; con42: number; cosio: number; cosio2: number;
  eccsq: number; omeosq: number; posq: number; rp: number;
  rteosq: number; sinio: number; gsto: number;
  noUnkozai: number;
}

export function initl(
  xke: number, j2: number,
  ecco: number, epoch: number, inclo: number, noKozai: number,
): InitlOut {
  const x2o3 = 2.0 / 3.0;
  const eccsq = ecco * ecco;
  const omeosq = 1.0 - eccsq;
  const rteosq = Math.sqrt(omeosq);
  const cosio = Math.cos(inclo);
  const cosio2 = cosio * cosio;

  const ak = Math.pow(xke / noKozai, x2o3);
  const d1 = (0.75 * j2 * (3.0 * cosio2 - 1.0)) / (rteosq * omeosq);
  let del = d1 / (ak * ak);
  const adel = ak * (1.0 - del * del - del * ((1.0 / 3.0) + (134.0 * del * del) / 81.0));
  del = d1 / (adel * adel);
  const noUnkozai = noKozai / (1.0 + del);

  const ao = Math.pow(xke / noUnkozai, x2o3);
  const sinio = Math.sin(inclo);
  const po = ao * omeosq;
  const con42 = 1.0 - 5.0 * cosio2;
  const con41 = -con42 - cosio2 - cosio2;
  const ainv = 1.0 / ao;
  const posq = po * po;
  const rp = ao * (1.0 - ecco);
  const method = "n";

  // sgp4fix modern approach: the old-way gst below is dead in the source
  // (kept verbatim for fidelity; the live value comes from gstime).
  const ts70 = epoch - 7305.0;
  const ds70 = Math.floor(ts70 + 1.0e-8);
  const tfrac = ts70 - ds70;
  const c1 = 1.72027916940703639e-2;
  const thgr70 = 1.7321343856509374;
  const fk5r = 5.075514194322694e-15;
  const c1p2p = c1 + TWOPI;
  let gstoOld = fmod2(thgr70 + c1 * ds70 + c1p2p * tfrac + ts70 * ts70 * fk5r, TWOPI);
  if (gstoOld < 0.0) gstoOld = gstoOld + TWOPI;
  void gstoOld;
  const gsto = gstime(epoch + 2433281.5);

  return {
    method, ainv, ao, con41, con42, cosio, cosio2, eccsq, omeosq,
    posq, rp, rteosq, sinio, gsto, noUnkozai,
  };
}

// ---------------------------------------------------------------------------
// sgp4init: initialize the SGP4 propagator (mutates satrec, like C++).
// Returns true; errors ride on satrec.error (1..6).
// ---------------------------------------------------------------------------

export interface Sgp4InitIn {
  whichconst: GravConstKind;
  opsmode: string;
  satn: string;
  epoch: number;
  xbstar: number;
  xndot: number;
  xnddot: number;
  xecco: number;
  xargpo: number;
  xinclo: number;
  xmo: number;
  xnoKozai: number;
  xnodeo: number;
}

export function sgp4init(q: Sgp4InitIn, satrec: ElsetRec): boolean {
  const temp4 = 1.5e-12;

  satrec.isimp = 0; satrec.method = "n"; satrec.aycof = 0.0;
  satrec.con41 = 0.0; satrec.cc1 = 0.0; satrec.cc4 = 0.0;
  satrec.cc5 = 0.0; satrec.d2 = 0.0; satrec.d3 = 0.0;
  satrec.d4 = 0.0; satrec.delmo = 0.0; satrec.eta = 0.0;
  satrec.argpdot = 0.0; satrec.omgcof = 0.0; satrec.sinmao = 0.0;
  satrec.t = 0.0; satrec.t2cof = 0.0; satrec.t3cof = 0.0;
  satrec.t4cof = 0.0; satrec.t5cof = 0.0; satrec.x1mth2 = 0.0;
  satrec.x7thm1 = 0.0; satrec.mdot = 0.0; satrec.nodedot = 0.0;
  satrec.xlcof = 0.0; satrec.xmcof = 0.0; satrec.nodecf = 0.0;

  satrec.irez = 0; satrec.d2201 = 0.0; satrec.d2211 = 0.0;
  satrec.d3210 = 0.0; satrec.d3222 = 0.0; satrec.d4410 = 0.0;
  satrec.d4422 = 0.0; satrec.d5220 = 0.0; satrec.d5232 = 0.0;
  satrec.d5421 = 0.0; satrec.d5433 = 0.0; satrec.dedt = 0.0;
  satrec.del1 = 0.0; satrec.del2 = 0.0; satrec.del3 = 0.0;
  satrec.didt = 0.0; satrec.dmdt = 0.0; satrec.dnodt = 0.0;
  satrec.domdt = 0.0; satrec.e3 = 0.0; satrec.ee2 = 0.0;
  satrec.peo = 0.0; satrec.pgho = 0.0; satrec.pho = 0.0;
  satrec.pinco = 0.0; satrec.plo = 0.0; satrec.se2 = 0.0;
  satrec.se3 = 0.0; satrec.sgh2 = 0.0; satrec.sgh3 = 0.0;
  satrec.sgh4 = 0.0; satrec.sh2 = 0.0; satrec.sh3 = 0.0;
  satrec.si2 = 0.0; satrec.si3 = 0.0; satrec.sl2 = 0.0;
  satrec.sl3 = 0.0; satrec.sl4 = 0.0; satrec.gsto = 0.0;
  satrec.xfact = 0.0; satrec.xgh2 = 0.0; satrec.xgh3 = 0.0;
  satrec.xgh4 = 0.0; satrec.xh2 = 0.0; satrec.xh3 = 0.0;
  satrec.xi2 = 0.0; satrec.xi3 = 0.0; satrec.xl2 = 0.0;
  satrec.xl3 = 0.0; satrec.xl4 = 0.0; satrec.xlamo = 0.0;
  satrec.zmol = 0.0; satrec.zmos = 0.0; satrec.atime = 0.0;
  satrec.xli = 0.0; satrec.xni = 0.0;

  const gc = getgravconst(q.whichconst);
  satrec.tumin = gc.tumin; satrec.mus = gc.mus;
  satrec.radiusearthkm = gc.radiusearthkm; satrec.xke = gc.xke;
  satrec.j2 = gc.j2; satrec.j3 = gc.j3; satrec.j4 = gc.j4;
  satrec.j3oj2 = gc.j3oj2;

  satrec.error = 0;
  satrec.operationmode = q.opsmode;
  satrec.satnum = q.satn;

  satrec.bstar = q.xbstar;
  satrec.ndot = q.xndot;
  satrec.nddot = q.xnddot;
  satrec.ecco = q.xecco;
  satrec.argpo = q.xargpo;
  satrec.inclo = q.xinclo;
  satrec.mo = q.xmo;
  satrec.noKozai = q.xnoKozai;
  satrec.nodeo = q.xnodeo;

  satrec.am = 0; satrec.em = 0; satrec.im = 0;
  satrec.Om = 0; satrec.om = 0; satrec.mm = 0; satrec.nm = 0;

  const ss = 78.0 / satrec.radiusearthkm + 1.0;
  const qzms2ttemp = (120.0 - 78.0) / satrec.radiusearthkm;
  const qzms2t = qzms2ttemp * qzms2ttemp * qzms2ttemp * qzms2ttemp;
  const x2o3 = 2.0 / 3.0;

  satrec.init = "y";
  satrec.t = 0.0;

  const il = initl(satrec.xke, satrec.j2, satrec.ecco, q.epoch, satrec.inclo, satrec.noKozai);
  satrec.method = il.method;
  const ao = il.ao;
  const con41 = il.con41;
  satrec.con41 = il.con41;
  const con42 = il.con42;
  const cosio = il.cosio;
  const cosio2 = il.cosio2;
  const eccsq = il.eccsq;
  const omeosq = il.omeosq;
  const posq = il.posq;
  const rp = il.rp;
  const rteosq = il.rteosq;
  const sinio = il.sinio;
  satrec.gsto = il.gsto;
  satrec.noUnkozai = il.noUnkozai;
  satrec.a = Math.pow(satrec.noUnkozai * satrec.tumin, -2.0 / 3.0);
  satrec.alta = satrec.a * (1.0 + satrec.ecco) - 1.0;
  satrec.altp = satrec.a * (1.0 - satrec.ecco) - 1.0;
  satrec.error = 0;

  if (omeosq >= 0.0 || satrec.noUnkozai >= 0.0) {
    satrec.isimp = 0;
    if (rp < 220.0 / satrec.radiusearthkm + 1.0) satrec.isimp = 1;
    let sfour = ss;
    let qzms24 = qzms2t;
    const perige = (rp - 1.0) * satrec.radiusearthkm;

    if (perige < 156.0) {
      sfour = perige - 78.0;
      if (perige < 98.0) sfour = 20.0;
      const qzms24temp = (120.0 - sfour) / satrec.radiusearthkm;
      qzms24 = qzms24temp * qzms24temp * qzms24temp * qzms24temp;
      sfour = sfour / satrec.radiusearthkm + 1.0;
    }
    const pinvsq = 1.0 / posq;
    const tsi = 1.0 / (ao - sfour);
    satrec.eta = ao * satrec.ecco * tsi;
    const etasq = satrec.eta * satrec.eta;
    const eeta = satrec.ecco * satrec.eta;
    const psisq = Math.abs(1.0 - etasq);
    const coef = qzms24 * Math.pow(tsi, 4.0);
    const coef1 = coef / Math.pow(psisq, 3.5);
    const cc2 =
      coef1 * satrec.noUnkozai *
      (ao * (1.0 + 1.5 * etasq + eeta * (4.0 + etasq)) +
        0.375 * (satrec.j2 * tsi) / psisq * con41 * (8.0 + 3.0 * etasq * (8.0 + etasq)));
    satrec.cc1 = satrec.bstar * cc2;
    let cc3 = 0.0;
    if (satrec.ecco > 1.0e-4)
      cc3 = ((-2.0 * coef * tsi * satrec.j3oj2 * satrec.noUnkozai * sinio) / satrec.ecco);
    satrec.x1mth2 = 1.0 - cosio2;
    satrec.cc4 =
      2.0 * satrec.noUnkozai * coef1 * ao * omeosq *
      (satrec.eta * (2.0 + 0.5 * etasq) + satrec.ecco * (0.5 + 2.0 * etasq) -
        satrec.j2 * tsi * (1.0 / (ao * psisq)) *
          (-3.0 * con41 * (1.0 - 2.0 * eeta + etasq * (1.5 - 0.5 * eeta)) +
            0.75 * satrec.x1mth2 * (2.0 * etasq - eeta * (1.0 + etasq)) * Math.cos(2.0 * satrec.argpo)));
    satrec.cc5 = 2.0 * coef1 * ao * omeosq * (1.0 + 2.75 * (etasq + eeta) + eeta * etasq);
    const cosio4 = cosio2 * cosio2;
    const temp1 = 1.5 * satrec.j2 * pinvsq * satrec.noUnkozai;
    const temp2 = 0.5 * temp1 * satrec.j2 * pinvsq;
    const temp3 = -0.46875 * satrec.j4 * pinvsq * pinvsq * satrec.noUnkozai;
    satrec.mdot =
      satrec.noUnkozai + 0.5 * temp1 * rteosq * con41 +
      0.0625 * temp2 * rteosq * (13.0 - 78.0 * cosio2 + 137.0 * cosio4);
    satrec.argpdot =
      -0.5 * temp1 * con42 + 0.0625 * temp2 * (7.0 - 114.0 * cosio2 + 395.0 * cosio4) +
      temp3 * (3.0 - 36.0 * cosio2 + 49.0 * cosio4);
    const xhdot1 = -temp1 * cosio;
    satrec.nodedot = xhdot1 + (0.5 * temp2 * (4.0 - 19.0 * cosio2) + 2.0 * temp3 * (3.0 - 7.0 * cosio2)) * cosio;
    const xpidot = satrec.argpdot + satrec.nodedot;
    satrec.omgcof = satrec.bstar * cc3 * Math.cos(satrec.argpo);
    satrec.xmcof = 0.0;
    if (satrec.ecco > 1.0e-4) satrec.xmcof = (-x2o3 * coef * satrec.bstar) / eeta;
    satrec.nodecf = 3.5 * omeosq * xhdot1 * satrec.cc1;
    satrec.t2cof = 1.5 * satrec.cc1;
    if (Math.abs(cosio + 1.0) > temp4) satrec.xlcof = (-0.25 * satrec.j3oj2 * sinio * (3.0 + 5.0 * cosio)) / (1.0 + cosio);
    else satrec.xlcof = (-0.25 * satrec.j3oj2 * sinio * (3.0 + 5.0 * cosio)) / temp4;
    satrec.aycof = -0.5 * satrec.j3oj2 * sinio;
    const delmotemp = 1.0 + satrec.eta * Math.cos(satrec.mo);
    satrec.delmo = delmotemp * delmotemp * delmotemp;
    satrec.sinmao = Math.sin(satrec.mo);
    satrec.x7thm1 = 7.0 * cosio2 - 1.0;

    if ((2 * PI) / satrec.noUnkozai >= 225.0) {
      satrec.method = "d";
      satrec.isimp = 1;
      const tc = 0.0;
      const inclm = satrec.inclo;

      const ds = dscom(q.epoch, satrec.ecco, satrec.argpo, tc, satrec.inclo, satrec.nodeo, satrec.noUnkozai);
      const snodm = ds.snodm, cnodm = ds.cnodm;
      void snodm; void cnodm;
      const sinim = ds.sinim, cosim = ds.cosim;
      const sinomm = ds.sinomm, cosomm = ds.cosomm;
      void sinomm; void cosomm;
      const day = ds.day;
      void day;
      const em = ds.em, emsq = ds.emsq, gam = ds.gam;
      void gam;
      satrec.e3 = ds.e3; satrec.ee2 = ds.ee2;
      satrec.peo = ds.peo; satrec.pgho = ds.pgho; satrec.pho = ds.pho;
      satrec.pinco = ds.pinco; satrec.plo = ds.plo;
      const rtemsq = ds.rtemsq;
      void rtemsq;
      satrec.se2 = ds.se2; satrec.se3 = ds.se3;
      satrec.sgh2 = ds.sgh2; satrec.sgh3 = ds.sgh3; satrec.sgh4 = ds.sgh4;
      satrec.sh2 = ds.sh2; satrec.sh3 = ds.sh3;
      satrec.si2 = ds.si2; satrec.si3 = ds.si3;
      satrec.sl2 = ds.sl2; satrec.sl3 = ds.sl3; satrec.sl4 = ds.sl4;
      const s1 = ds.s1, s2 = ds.s2, s3 = ds.s3, s4 = ds.s4, s5 = ds.s5, s6 = ds.s6, s7 = ds.s7;
      void s6; void s7;
      const ss1 = ds.ss1, ss2 = ds.ss2, ss3 = ds.ss3, ss4 = ds.ss4, ss5 = ds.ss5;
      const sz1 = ds.sz1, sz2 = ds.sz2, sz3 = ds.sz3;
      void sz2;
      const sz11 = ds.sz11, sz12 = ds.sz12, sz13 = ds.sz13;
      const sz21 = ds.sz21, sz22 = ds.sz22, sz23 = ds.sz23;
      void sz22;
      const sz31 = ds.sz31, sz32 = ds.sz32, sz33 = ds.sz33;
      satrec.xgh2 = ds.xgh2; satrec.xgh3 = ds.xgh3; satrec.xgh4 = ds.xgh4;
      satrec.xh2 = ds.xh2; satrec.xh3 = ds.xh3;
      satrec.xi2 = ds.xi2; satrec.xi3 = ds.xi3;
      satrec.xl2 = ds.xl2; satrec.xl3 = ds.xl3; satrec.xl4 = ds.xl4;
      const nm = ds.nm;
      void nm;
      const z1 = ds.z1, z2 = ds.z2, z3 = ds.z3;
      void z2;
      const z11 = ds.z11, z12 = ds.z12, z13 = ds.z13;
      const z21 = ds.z21, z22 = ds.z22, z23 = ds.z23;
      void z22;
      const z31 = ds.z31, z32 = ds.z32, z33 = ds.z33;
      satrec.zmol = ds.zmol; satrec.zmos = ds.zmos;

      const dp = dpper(
        {
          e3: satrec.e3, ee2: satrec.ee2, peo: satrec.peo, pgho: satrec.pgho,
          pho: satrec.pho, pinco: satrec.pinco, plo: satrec.plo,
          se2: satrec.se2, se3: satrec.se3, sgh2: satrec.sgh2,
          sgh3: satrec.sgh3, sgh4: satrec.sgh4, sh2: satrec.sh2,
          sh3: satrec.sh3, si2: satrec.si2, si3: satrec.si3,
          sl2: satrec.sl2, sl3: satrec.sl3, sl4: satrec.sl4,
          t: satrec.t, xgh2: satrec.xgh2, xgh3: satrec.xgh3,
          xgh4: satrec.xgh4, xh2: satrec.xh2, xh3: satrec.xh3,
          xi2: satrec.xi2, xi3: satrec.xi3, xl2: satrec.xl2,
          xl3: satrec.xl3, xl4: satrec.xl4, zmol: satrec.zmol,
          zmos: satrec.zmos, inclo: satrec.inclo,
        },
        satrec.init,
        { ep: satrec.ecco, inclp: satrec.inclo, nodep: satrec.nodeo, argpp: satrec.argpo, mp: satrec.mo },
        satrec.operationmode,
      );
      satrec.ecco = dp.ep;
      void inclm;
      satrec.nodeo = dp.nodep;
      satrec.argpo = dp.argpp;
      satrec.mo = dp.mp;

      const argpm = 0.0, nodem = 0.0, mm = 0.0;
      const di = dsinit(
        {
          xke: satrec.xke, cosim, emsq, argpo: satrec.argpo,
          s1, s2, s3, s4, s5, sinim, ss1, ss2, ss3, ss4, ss5,
          sz1, sz3, sz11, sz13, sz21, sz23, sz31, sz33,
          t: satrec.t, tc, gsto: satrec.gsto, mo: satrec.mo,
          mdot: satrec.mdot, no: satrec.noUnkozai, nodeo: satrec.nodeo,
          nodedot: satrec.nodedot, xpidot, z1, z3, z11, z13,
          z21, z23, z31, z33, ecco: satrec.ecco, eccsq,
        },
        { em, argpm, inclm, mm, nm: satrec.noUnkozai, nodem },
      );
      satrec.irez = di.irez;
      satrec.atime = di.atime;
      satrec.d2201 = di.d2201; satrec.d2211 = di.d2211;
      satrec.d3210 = di.d3210; satrec.d3222 = di.d3222;
      satrec.d4410 = di.d4410; satrec.d4422 = di.d4422;
      satrec.d5220 = di.d5220; satrec.d5232 = di.d5232;
      satrec.d5421 = di.d5421; satrec.d5433 = di.d5433;
      satrec.dedt = di.dedt; satrec.didt = di.didt;
      satrec.dmdt = di.dmdt; satrec.dnodt = di.dnodt;
      satrec.domdt = di.domdt;
      satrec.del1 = di.del1; satrec.del2 = di.del2; satrec.del3 = di.del3;
      satrec.xfact = di.xfact; satrec.xlamo = di.xlamo;
      satrec.xli = di.xli; satrec.xni = di.xni;
      void argpm; void nodem; void mm;
    }

    if (satrec.isimp !== 1) {
      const cc1sq = satrec.cc1 * satrec.cc1;
      satrec.d2 = 4.0 * ao * tsi * cc1sq;
      const temp = satrec.d2 * tsi * satrec.cc1 / 3.0;
      satrec.d3 = (17.0 * ao + sfour) * temp;
      satrec.d4 = 0.5 * temp * ao * tsi * (221.0 * ao + 31.0 * sfour) * satrec.cc1;
      satrec.t3cof = satrec.d2 + 2.0 * cc1sq;
      satrec.t4cof = 0.25 * (3.0 * satrec.d3 + satrec.cc1 * (12.0 * satrec.d2 + 10.0 * cc1sq));
      satrec.t5cof =
        0.2 * (3.0 * satrec.d4 + 12.0 * satrec.cc1 * satrec.d3 + 6.0 * satrec.d2 * satrec.d2 + 15.0 * cc1sq * (2.0 * satrec.d2 + cc1sq));
    }
  }

  const r0 = [0, 0, 0];
  const v0 = [0, 0, 0];
  sgp4(satrec, 0.0, r0, v0);

  satrec.init = "n";

  return true;
}

// ---------------------------------------------------------------------------
// sgp4: main propagator (mutates satrec.t / satrec.error; fills r, v).
// Returns true normally; false + satrec.error set on error.
// ---------------------------------------------------------------------------

export function sgp4(satrec: ElsetRec, tsince: number, r: number[], v: number[]): boolean {
  const temp4 = 1.5e-12;
  const vkmpersec = (satrec.radiusearthkm * satrec.xke) / 60.0;

  satrec.t = tsince;
  satrec.error = 0;

  const xmdf = satrec.mo + satrec.mdot * satrec.t;
  const argpdf = satrec.argpo + satrec.argpdot * satrec.t;
  const nodedf = satrec.nodeo + satrec.nodedot * satrec.t;
  let argpm = argpdf;
  let mm = xmdf;
  const t2 = satrec.t * satrec.t;
  let nodem = nodedf + satrec.nodecf * t2;
  let tempa = 1.0 - satrec.cc1 * satrec.t;
  let tempe = satrec.bstar * satrec.cc4 * satrec.t;
  let templ = satrec.t2cof * t2;

  if (satrec.isimp !== 1) {
    const delomg = satrec.omgcof * satrec.t;
    const delmtemp = 1.0 + satrec.eta * Math.cos(xmdf);
    const delm = satrec.xmcof * (delmtemp * delmtemp * delmtemp - satrec.delmo);
    const temp = delomg + delm;
    mm = xmdf + temp;
    argpm = argpdf - temp;
    const t3 = t2 * satrec.t;
    const t4 = t3 * satrec.t;
    tempa = tempa - satrec.d2 * t2 - satrec.d3 * t3 - satrec.d4 * t4;
    tempe = tempe + satrec.bstar * satrec.cc5 * (Math.sin(mm) - satrec.sinmao);
    templ = templ + satrec.t3cof * t3 + t4 * (satrec.t4cof + satrec.t * satrec.t5cof);
  }

  let nm = satrec.noUnkozai;
  let em = satrec.ecco;
  let inclm = satrec.inclo;
  if (satrec.method === "d") {
    const tc = satrec.t;
    const ds = dspace(
      {
        irez: satrec.irez,
        d2201: satrec.d2201, d2211: satrec.d2211, d3210: satrec.d3210,
        d3222: satrec.d3222, d4410: satrec.d4410, d4422: satrec.d4422,
        d5220: satrec.d5220, d5232: satrec.d5232, d5421: satrec.d5421,
        d5433: satrec.d5433, dedt: satrec.dedt, del1: satrec.del1,
        del2: satrec.del2, del3: satrec.del3, didt: satrec.didt,
        dmdt: satrec.dmdt, dnodt: satrec.dnodt, domdt: satrec.domdt,
        argpo: satrec.argpo, argpdot: satrec.argpdot, t: satrec.t, tc,
        gsto: satrec.gsto, xfact: satrec.xfact, xlamo: satrec.xlamo,
        no: satrec.noUnkozai,
      },
      {
        em, argpm, inclm, xli: satrec.xli, mm, xni: satrec.xni,
        nodem, nm,
      },
      satrec.atime,
    );
    em = ds.em; argpm = ds.argpm; inclm = ds.inclm;
    satrec.xli = ds.xli; mm = ds.mm; satrec.xni = ds.xni;
    nodem = ds.nodem; nm = ds.nm;
    satrec.atime = ds.atime;
  }

  if (nm <= 0.0) {
    satrec.error = 2;
    return false;
  }
  const am = Math.pow(satrec.xke / nm, 2.0 / 3.0) * tempa * tempa;
  nm = satrec.xke / Math.pow(am, 1.5);
  em = em - tempe;

  if (em >= 1.0 || em < -0.001) {
    satrec.error = 1;
    return false;
  }
  if (em < 1.0e-6) em = 1.0e-6;
  mm = mm + satrec.noUnkozai * templ;
  let xlm = mm + argpm + nodem;
  const emsq = em * em;
  const temp = 1.0 - emsq;

  nodem = fmod2(nodem, TWOPI);
  argpm = fmod2(argpm, TWOPI);
  xlm = fmod2(xlm, TWOPI);
  mm = fmod2(xlm - argpm - nodem, TWOPI);

  satrec.am = am; satrec.em = em; satrec.im = inclm;
  satrec.Om = nodem; satrec.om = argpm; satrec.mm = mm;
  satrec.nm = nm;

  const sinim = Math.sin(inclm);
  const cosim = Math.cos(inclm);

  let ep = em;
  let xincp = inclm;
  let argpp = argpm;
  let nodep = nodem;
  let mp = mm;
  let sinip = sinim;
  let cosip = cosim;
  if (satrec.method === "d") {
    const dp = dpper(
      {
        e3: satrec.e3, ee2: satrec.ee2, peo: satrec.peo, pgho: satrec.pgho,
        pho: satrec.pho, pinco: satrec.pinco, plo: satrec.plo,
        se2: satrec.se2, se3: satrec.se3, sgh2: satrec.sgh2,
        sgh3: satrec.sgh3, sgh4: satrec.sgh4, sh2: satrec.sh2,
        sh3: satrec.sh3, si2: satrec.si2, si3: satrec.si3,
        sl2: satrec.sl2, sl3: satrec.sl3, sl4: satrec.sl4,
        t: satrec.t, xgh2: satrec.xgh2, xgh3: satrec.xgh3,
        xgh4: satrec.xgh4, xh2: satrec.xh2, xh3: satrec.xh3,
        xi2: satrec.xi2, xi3: satrec.xi3, xl2: satrec.xl2,
        xl3: satrec.xl3, xl4: satrec.xl4, zmol: satrec.zmol,
        zmos: satrec.zmos, inclo: satrec.inclo,
      },
      "n",
      { ep, inclp: xincp, nodep, argpp, mp },
      satrec.operationmode,
    );
    ep = dp.ep; xincp = dp.inclp; nodep = dp.nodep;
    argpp = dp.argpp; mp = dp.mp;
    if (xincp < 0.0) {
      xincp = -xincp;
      nodep = nodep + PI;
      argpp = argpp - PI;
    }
    if (ep < 0.0 || ep > 1.0) {
      satrec.error = 3;
      return false;
    }
  }

  if (satrec.method === "d") {
    sinip = Math.sin(xincp);
    cosip = Math.cos(xincp);
    satrec.aycof = -0.5 * satrec.j3oj2 * sinip;
    if (Math.abs(cosip + 1.0) > temp4)
      satrec.xlcof = (-0.25 * satrec.j3oj2 * sinip * (3.0 + 5.0 * cosip)) / (1.0 + cosip);
    else satrec.xlcof = (-0.25 * satrec.j3oj2 * sinip * (3.0 + 5.0 * cosip)) / temp4;
  }
  const axnl = ep * Math.cos(argpp);
  const tempA = 1.0 / (am * (1.0 - ep * ep));
  const aynl = ep * Math.sin(argpp) + tempA * satrec.aycof;
  const xl = mp + argpp + nodep + tempA * satrec.xlcof * axnl;

  const u = fmod2(xl - nodep, TWOPI);
  let eo1 = u;
  let tem5 = 9999.9;
  let ktr = 1;
  let sineo1 = 0.0;
  let coseo1 = 0.0;
  while (Math.abs(tem5) >= 1.0e-12 && ktr <= 10) {
    sineo1 = Math.sin(eo1);
    coseo1 = Math.cos(eo1);
    tem5 = 1.0 - coseo1 * axnl - sineo1 * aynl;
    tem5 = (u - aynl * coseo1 + axnl * sineo1 - eo1) / tem5;
    if (Math.abs(tem5) >= 0.95) tem5 = tem5 > 0.0 ? 0.95 : -0.95;
    eo1 = eo1 + tem5;
    ktr = ktr + 1;
  }

  const ecose = axnl * coseo1 + aynl * sineo1;
  const esine = axnl * sineo1 - aynl * coseo1;
  const el2 = axnl * axnl + aynl * aynl;
  const pl = am * (1.0 - el2);
  let mrt = 0;
  if (pl < 0.0) {
    satrec.error = 4;
    return false;
  } else {
    const rl = am * (1.0 - ecose);
    const rdotl = (Math.sqrt(am) * esine) / rl;
    const rvdotl = Math.sqrt(pl) / rl;
    const betal = Math.sqrt(1.0 - el2);
    const tempB = esine / (1.0 + betal);
    const sinu = (am / rl) * (sineo1 - aynl - axnl * tempB);
    const cosu = (am / rl) * (coseo1 - axnl + aynl * tempB);
    const su = Math.atan2(sinu, cosu);
    const sin2u = (cosu + cosu) * sinu;
    const cos2u = 1.0 - 2.0 * sinu * sinu;
    const tempC = 1.0 / pl;
    const temp1 = 0.5 * satrec.j2 * tempC;
    const temp2 = temp1 * tempC;

    if (satrec.method === "d") {
      const cosisq = cosip * cosip;
      satrec.con41 = 3.0 * cosisq - 1.0;
      satrec.x1mth2 = 1.0 - cosisq;
      satrec.x7thm1 = 7.0 * cosisq - 1.0;
    }
    mrt = rl * (1.0 - 1.5 * temp2 * betal * satrec.con41) + 0.5 * temp1 * satrec.x1mth2 * cos2u;
    const su2 = su - 0.25 * temp2 * satrec.x7thm1 * sin2u;
    const xnode = nodep + 1.5 * temp2 * cosip * sin2u;
    const xinc = xincp + 1.5 * temp2 * cosip * sinip * cos2u;
    const mvt = rdotl - (nm * temp1 * satrec.x1mth2 * sin2u) / satrec.xke;
    const rvdot = rvdotl + (nm * temp1 * (satrec.x1mth2 * cos2u + 1.5 * satrec.con41)) / satrec.xke;

    const sinsu = Math.sin(su2);
    const cossu = Math.cos(su2);
    const snod = Math.sin(xnode);
    const cnod = Math.cos(xnode);
    const sini = Math.sin(xinc);
    const cosi = Math.cos(xinc);
    const xmx = -snod * cosi;
    const xmy = cnod * cosi;
    const ux = xmx * sinsu + cnod * cossu;
    const uy = xmy * sinsu + snod * cossu;
    const uz = sini * sinsu;
    const vx = xmx * cossu - cnod * sinsu;
    const vy = xmy * cossu - snod * sinsu;
    const vz = sini * cossu;

    r[0] = mrt * ux * satrec.radiusearthkm;
    r[1] = mrt * uy * satrec.radiusearthkm;
    r[2] = mrt * uz * satrec.radiusearthkm;
    v[0] = (mvt * ux + rvdot * vx) * vkmpersec;
    v[1] = (mvt * uy + rvdot * vy) * vkmpersec;
    v[2] = (mvt * uz + rvdot * vz) * vkmpersec;
  }

  if (mrt < 1.0) {
    satrec.error = 6;
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// getgravconst
// ---------------------------------------------------------------------------

export interface GravConstants {
  tumin: number;
  mus: number;
  radiusearthkm: number;
  xke: number;
  j2: number;
  j3: number;
  j4: number;
  j3oj2: number;
}

export function getgravconst(whichconst: GravConstKind): GravConstants {
  switch (whichconst) {
    case "wgs72old":
      return {
        mus: 398600.79964,
        radiusearthkm: 6378.135,
        xke: 0.0743669161,
        tumin: 1.0 / 0.0743669161,
        j2: 0.001082616,
        j3: -0.00000253881,
        j4: -0.00000165597,
        j3oj2: -0.00000253881 / 0.001082616,
      };
    case "wgs72": {
      const xke = 60.0 / Math.sqrt((6378.135 * 6378.135 * 6378.135) / 398600.8);
      return {
        mus: 398600.8,
        radiusearthkm: 6378.135,
        xke,
        tumin: 1.0 / xke,
        j2: 0.001082616,
        j3: -0.00000253881,
        j4: -0.00000165597,
        j3oj2: -0.00000253881 / 0.001082616,
      };
    }
    case "wgs84": {
      const xke = 60.0 / Math.sqrt((6378.137 * 6378.137 * 6378.137) / 398600.5);
      return {
        mus: 398600.5,
        radiusearthkm: 6378.137,
        xke,
        tumin: 1.0 / xke,
        j2: 0.00108262998905,
        j3: -0.00000253215306,
        j4: -0.00000161098761,
        j3oj2: -0.00000253215306 / 0.00108262998905,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// gstime: Greenwich sidereal time (Vallado 2013, eq 3-45)
// ---------------------------------------------------------------------------

export function gstime(jdut1: number): number {
  const tut1 = (jdut1 - 2451545.0) / 36525.0;
  let temp =
    -6.2e-6 * tut1 * tut1 * tut1 + 0.093104 * tut1 * tut1 +
    (876600.0 * 3600 + 8640184.812866) * tut1 + 67310.54841;
  temp = fmod2((temp * (PI / 180.0)) / 240.0, TWOPI);
  if (temp < 0.0) temp += TWOPI;
  return temp;
}

export function sgn(x: number): number {
  return x < 0.0 ? -1.0 : 1.0;
}

export function mag(x: number[]): number {
  return Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);
}

export function cross(vec1: number[], vec2: number[], outvec: number[]): void {
  outvec[0] = vec1[1] * vec2[2] - vec1[2] * vec2[1];
  outvec[1] = vec1[2] * vec2[0] - vec1[0] * vec2[2];
  outvec[2] = vec1[0] * vec2[1] - vec1[1] * vec2[0];
}

export function dot(x: number[], y: number[]): number {
  return x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
}

export function angle(vec1: number[], vec2: number[]): number {
  const small = 0.00000001;
  const undefined = 999999.1;
  const magv1 = mag(vec1);
  const magv2 = mag(vec2);
  if (magv1 * magv2 > small * small) {
    let temp = dot(vec1, vec2) / (magv1 * magv2);
    if (Math.abs(temp) > 1.0) temp = sgn(temp) * 1.0;
    return Math.acos(temp);
  }
  return undefined;
}

export function asinh(xval: number): number {
  return Math.log(xval + Math.sqrt(xval * xval + 1.0));
}

export function newtonnu(ecc: number, nu: number): { e0: number; m: number } {
  let e0 = 999999.9;
  let m = 999999.9;
  const small = 0.00000001;

  if (Math.abs(ecc) < small) {
    m = nu;
    e0 = nu;
  } else if (ecc < 1.0 - small) {
    const sine = (Math.sqrt(1.0 - ecc * ecc) * Math.sin(nu)) / (1.0 + ecc * Math.cos(nu));
    const cose = (ecc + Math.cos(nu)) / (1.0 + ecc * Math.cos(nu));
    e0 = Math.atan2(sine, cose);
    m = e0 - ecc * Math.sin(e0);
  } else if (ecc > 1.0 + small) {
    if (Math.abs(nu) + 0.00001 < PI - Math.acos(1.0 / ecc)) {
      const sine = (Math.sqrt(ecc * ecc - 1.0) * Math.sin(nu)) / (1.0 + ecc * Math.cos(nu));
      e0 = asinh(sine);
      m = ecc * Math.sinh(e0) - e0;
    }
  } else if (Math.abs(nu) < (168.0 * PI) / 180.0) {
    e0 = Math.tan(nu * 0.5);
    m = e0 + (e0 * e0 * e0) / 3.0;
  }

  if (ecc < 1.0) {
    m = fmod2(m, 2.0 * PI);
    if (m < 0.0) m = m + 2.0 * PI;
    e0 = fmod2(e0, 2.0 * PI);
  }
  return { e0, m };
}

export interface CoeResult {
  p: number; a: number; ecc: number; incl: number;
  omega: number; argp: number; nu: number; m: number;
  arglat: number; truelon: number; lonper: number;
}

export function rv2coe(r: number[], v: number[], mus: number): CoeResult {
  const undefined = 999999.1;
  const infinite = 999999.9;
  const small = 0.00000001;
  let p = 0, a = 0, ecc = 0, incl = 0, omega = 0, argp = 0;
  let nu = 0, m = 0, arglat = 0, truelon = 0, lonper = 0;

  const magr = mag(r);
  const magv = mag(v);
  const hbar = [0, 0, 0];
  cross(r, v, hbar);
  const magh = mag(hbar);
  if (magh > small) {
    const nbar = [-hbar[1], hbar[0], 0.0];
    const magn = mag(nbar);
    const c1 = magv * magv - mus / magr;
    const rdotv = dot(r, v);
    const ebar = [0, 0, 0];
    for (let i = 0; i <= 2; i++) ebar[i] = (c1 * r[i] - rdotv * v[i]) / mus;
    ecc = mag(ebar);

    const sme = magv * magv * 0.5 - mus / magr;
    if (Math.abs(sme) > small) a = -mus / (2.0 * sme);
    else a = infinite;
    p = (magh * magh) / mus;

    const hk = hbar[2] / magh;
    incl = Math.acos(hk);

    let typeorbit = 1;
    if (ecc < small) {
      if (Math.abs(incl) < small || Math.abs(incl - PI) < small) typeorbit = 2;
      else typeorbit = 3;
    } else {
      if (Math.abs(incl) < small || Math.abs(incl - PI) < small) typeorbit = 4;
    }

    if (magn > small) {
      let temp = nbar[0] / magn;
      if (Math.abs(temp) > 1.0) temp = sgn(temp);
      omega = Math.acos(temp);
      if (nbar[1] < 0.0) omega = TWOPI - omega;
    } else omega = undefined;

    if (typeorbit === 1) {
      argp = angle(nbar, ebar);
      if (ebar[2] < 0.0) argp = TWOPI - argp;
    } else argp = undefined;

    if (typeorbit === 1 || typeorbit === 4) {
      nu = angle(ebar, r);
      if (rdotv < 0.0) nu = TWOPI - nu;
    } else nu = undefined;

    if (typeorbit === 3) {
      arglat = angle(nbar, r);
      if (r[2] < 0.0) arglat = TWOPI - arglat;
      m = arglat;
    } else arglat = undefined;

    if (ecc > small && typeorbit === 4) {
      let temp = ebar[0] / ecc;
      if (Math.abs(temp) > 1.0) temp = sgn(temp);
      lonper = Math.acos(temp);
      if (ebar[1] < 0.0) lonper = TWOPI - lonper;
      if (incl > PI * 0.5) lonper = TWOPI - lonper;
    } else lonper = undefined;

    if (magr > small && typeorbit === 2) {
      let temp = r[0] / magr;
      if (Math.abs(temp) > 1.0) temp = sgn(temp);
      truelon = Math.acos(temp);
      if (r[1] < 0.0) truelon = TWOPI - truelon;
      if (incl > PI * 0.5) truelon = TWOPI - truelon;
      m = truelon;
    } else truelon = undefined;

    if (typeorbit === 1 || typeorbit === 4) {
      const nm = newtonnu(ecc, nu);
      m = nm.m;
    }
  } else {
    p = undefined; a = undefined; ecc = undefined; incl = undefined;
    omega = undefined; argp = undefined; nu = undefined; m = undefined;
    arglat = undefined; truelon = undefined; lonper = undefined;
  }
  return { p, a, ecc, incl, omega, argp, nu, m, arglat, truelon, lonper };
}

export function jday(
  year: number, mon: number, day: number, hr: number, minute: number, sec: number,
): { jd: number; jdFrac: number } {
  let jd = 367.0 * year - Math.floor((7 * (year + Math.floor((mon + 9) / 12.0))) * 0.25) + Math.floor((275 * mon) / 9.0) + day + 1721013.5;
  let jdFrac = (sec + minute * 60.0 + hr * 3600.0) / 86400.0;
  if (Math.abs(jdFrac) > 1.0) {
    const dtt = Math.floor(jdFrac);
    jd = jd + dtt;
    jdFrac = jdFrac - dtt;
  }
  return { jd, jdFrac };
}

export function days2mdhms(
  year: number, days: number,
): { mon: number; day: number; hr: number; minute: number; sec: number } {
  const lmonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const dayofyr = Math.floor(days);
  if (year % 4 === 0) lmonth[2] = 29;
  let i = 1;
  let inttemp = 0;
  while (dayofyr > inttemp + lmonth[i] && i < 12) {
    inttemp = inttemp + lmonth[i];
    i = i + 1;
  }
  const mon = i;
  const day = dayofyr - inttemp;
  const temp = (days - dayofyr) * 24.0;
  const hr = Math.floor(temp);
  const temp2 = (temp - hr) * 60.0;
  const minute = Math.floor(temp2);
  const sec = (temp2 - minute) * 60.0;
  return { mon, day, hr, minute, sec };
}

export function invjday(jd: number, jdFrac: number): {
  year: number; mon: number; day: number; hr: number; minute: number; sec: number;
} {
  let jdW = jd;
  let jdFW = jdFrac;
  if (Math.abs(jdFW) >= 1.0) {
    jdW = jdW + Math.floor(jdFW);
    jdFW = jdFW - Math.floor(jdFW);
  }
  const dt = jdW - Math.floor(jdW) - 0.5;
  if (Math.abs(dt) > 0.00000001) {
    jdW = jdW - dt;
    jdFW = jdFW + dt;
  }
  const temp = jdW - 2415019.5;
  const tu = temp / 365.25;
  let year = 1900 + Math.floor(tu);
  let leapyrs = Math.floor((year - 1901) * 0.25);
  let days = Math.floor(temp - ((year - 1900) * 365.0 + leapyrs));
  if (days + jdFW < 1.0) {
    year = year - 1;
    leapyrs = Math.floor((year - 1901) * 0.25);
    days = Math.floor(temp - ((year - 1900) * 365.0 + leapyrs));
  }
  const r = days2mdhms(year, days + jdFW);
  return { year, mon: r.mon, day: r.day, hr: r.hr, minute: r.minute, sec: r.sec };
}
