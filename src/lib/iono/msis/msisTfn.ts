// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — NRLMSIS 2.1 vertical temperature profile (drop 9b, F2b #9).
//
// TypeScript transcription of `msis_tfn.F90` from the NRLMSIS 2.1
// reference package (NRL-SOF-014-1, mirror pinned at
// jacobwilliams/NRLMSIS2.1 commit 9124144).
// Source sha256:
// 583aa67d867da3076502381f0b537cf4d194bb8837a786a5446d4bc57bd4c82b
// Faithful translation without physics changes
// (traducción fiel sin cambios de física). Translated 2026-10-16.
//
// NRL-SOF section 4(b) compliance: verbatim translation of the logic;
// the original copyright notice is reproduced in
// `nrlmsis2.1_license.txt` in this directory. Portions of NRLMSIS
// Copyright (C) 2021 U.S. Naval Research Laboratory.

import {
  KB,
  LNP0,
  MBARG0DIVKB,
  ZETAB,
  ZETAA,
  IZFX,
  IZAX,
  ITEX,
  ITGB0,
  ITB0,
  C2TN,
  NL,
  WBETA,
  WGAMMA,
  S5ZETAB,
  S6ZETAB,
  WGHTAXDZ,
  S4ZETAA,
  S5ZETAA,
  S6ZETAA,
  S4ZETAF,
  S5ZETAF,
  S5ZETA0,
  CMAG,
  NMAG,
  CUT,
  NUT,
  MBF,
} from "./msisConstants";
import type { MsisState } from "./msisInit";
import { dilog } from "./msisUtils";
import { sfluxmod, geomag, utdep } from "./msisGfn";

/** Temperature vertical profile parameters (tnparm). */
export interface TnParm {
  /** Spline coefficients cf(0:NL). */
  cf: number[];
  tzetaF: number;
  tzetaA: number;
  dlntdzA: number;
  lndtotF: number;
  tex: number;
  tgb0: number;
  tb0: number;
  sigma: number;
  sigmasq: number;
  /** b = 1-tb0/tex. */
  b: number;
  /** 1st integration coefficients beta(0:NL). */
  beta: number[];
  /** 2nd integration coefficients gamma(0:NL). */
  gamma: number[];
  cVs: number;
  cVb: number;
  cWs: number;
  cWb: number;
  VzetaF: number;
  VzetaA: number;
  WzetaA: number;
  Vzeta0: number;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let k = 0; k < a.length; k++) s += a[k] * b[k];
  return s;
}

function colRows(subset: { beta: number[][] }, rows: number[], col: number): number[] {
  return rows.map((r) => subset.beta[r][col]);
}

function range(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let k = lo; k <= hi; k++) out.push(k);
  return out;
}

/**
 * TFNPARM: vertical temperature and species-independent profile
 * parameters from the 512 globe basis terms gf(0:511).
 */
export function tfnparm(state: MsisState, gf: number[]): TnParm {
  const TN = state.TN;
  const linRows = range(0, MBF);
  const tpro: TnParm = {
    cf: new Array<number>(NL + 1).fill(0),
    tzetaF: 0, tzetaA: 0, dlntdzA: 0, lndtotF: 0,
    tex: 0, tgb0: 0, tb0: 0, sigma: 0, sigmasq: 0, b: 0,
    beta: new Array<number>(NL + 1).fill(0),
    gamma: new Array<number>(NL + 1).fill(0),
    cVs: 0, cVb: 0, cWs: 0, cWb: 0,
    VzetaF: 0, VzetaA: 0, WzetaA: 0, Vzeta0: 0,
  };

  // Unconstrained spline coefficients
  for (let ix = 0; ix <= ITB0 - 1; ix++) {
    tpro.cf[ix] = dot(colRows(TN, linRows, ix), gf.slice(0, MBF + 1));
  }
  for (let ix = 0; ix <= ITB0 - 1; ix++) {
    if (state.smod[ix]) {
      tpro.cf[ix] =
        tpro.cf[ix] + sfluxmod(state, ix, gf, TN, 1.0 / TN.beta[0][ix]);
    }
  }

  // Exospheric temperature
  tpro.tex = dot(colRows(TN, linRows, ITEX), gf.slice(0, MBF + 1));
  tpro.tex = tpro.tex + sfluxmod(state, ITEX, gf, TN, 1.0 / TN.beta[0][ITEX]);
  tpro.tex =
    tpro.tex +
    geomag(
      state,
      colRows(TN, range(CMAG, CMAG + NMAG - 1), ITEX),
      gf.slice(CMAG, CMAG + 13),
      slicePlg(gf, CMAG + 13),
    );
  tpro.tex =
    tpro.tex +
    utdep(
      state,
      colRows(TN, range(CUT, CUT + NUT - 1), ITEX),
      gf.slice(CUT, CUT + 9),
    );

  // Temperature gradient at zetaB (122.5 km)
  tpro.tgb0 = dot(colRows(TN, linRows, ITGB0), gf.slice(0, MBF + 1));
  if (state.smod[ITGB0])
    tpro.tgb0 =
      tpro.tgb0 + sfluxmod(state, ITGB0, gf, TN, 1.0 / TN.beta[0][ITGB0]);
  tpro.tgb0 =
    tpro.tgb0 +
    geomag(
      state,
      colRows(TN, range(CMAG, CMAG + NMAG - 1), ITGB0),
      gf.slice(CMAG, CMAG + 13),
      slicePlg(gf, CMAG + 13),
    );

  // Temperature at zetaB (122.5 km)
  tpro.tb0 = dot(colRows(TN, linRows, ITB0), gf.slice(0, MBF + 1));
  if (state.smod[ITB0])
    tpro.tb0 =
      tpro.tb0 + sfluxmod(state, ITB0, gf, TN, 1.0 / TN.beta[0][ITB0]);
  tpro.tb0 =
    tpro.tb0 +
    geomag(
      state,
      colRows(TN, range(CMAG, CMAG + NMAG - 1), ITB0),
      gf.slice(CMAG, CMAG + 13),
      slicePlg(gf, CMAG + 13),
    );

  // Shape factor
  tpro.sigma = tpro.tgb0 / (tpro.tex - tpro.tb0);

  // Constrain top three spline coefficients for C2 continuity
  const bc = [
    1.0 / tpro.tb0,
    -tpro.tgb0 / (tpro.tb0 * tpro.tb0),
    (tpro.tgb0 / (tpro.tb0 * tpro.tb0)) * (tpro.sigma + (2.0 * tpro.tgb0) / tpro.tb0),
  ];
  for (let k = 0; k <= 2; k++) {
    tpro.cf[ITB0 + k] = bc[0] * C2TN[0][k] + bc[1] * C2TN[1][k] + bc[2] * C2TN[2][k];
  }

  // Reference temperature at zetaF (70 km)
  tpro.tzetaF = 1.0 / dot(tpro.cf.slice(IZFX, IZFX + 3), S4ZETAF);

  // Reference temperature and gradient at zetaA (85 km)
  tpro.tzetaA = 1.0 / dot(tpro.cf.slice(IZAX, IZAX + 3), S4ZETAA);
  tpro.dlntdzA = -dot(tpro.cf.slice(IZAX, IZAX + 3), WGHTAXDZ) * tpro.tzetaA;

  // Spline coefficients for first and second 1/T integrals
  tpro.beta[0] = tpro.cf[0] * WBETA[0];
  for (let ix = 1; ix <= NL; ix++) {
    tpro.beta[ix] = tpro.beta[ix - 1] + tpro.cf[ix] * WBETA[ix];
  }
  tpro.gamma[0] = tpro.beta[0] * WGAMMA[0];
  for (let ix = 1; ix <= NL; ix++) {
    tpro.gamma[ix] = tpro.gamma[ix - 1] + tpro.beta[ix] * WGAMMA[ix];
  }

  // Integration terms and constants
  tpro.b = 1 - tpro.tb0 / tpro.tex;
  tpro.sigmasq = tpro.sigma * tpro.sigma;
  tpro.cVs = -dot(tpro.beta.slice(ITB0 - 1, ITB0 + 3), S5ZETAB);
  tpro.cWs = -dot(tpro.gamma.slice(ITB0 - 2, ITB0 + 3), S6ZETAB);
  tpro.cVb = -Math.log(1 - tpro.b) / (tpro.sigma * tpro.tex);
  tpro.cWb = -dilog(tpro.b) / (tpro.sigmasq * tpro.tex);
  tpro.VzetaF = dot(tpro.beta.slice(IZFX - 1, IZFX + 3), S5ZETAF) + tpro.cVs;
  tpro.VzetaA = dot(tpro.beta.slice(IZAX - 1, IZAX + 3), S5ZETAA) + tpro.cVs;
  tpro.WzetaA =
    dot(tpro.gamma.slice(IZAX - 2, IZAX + 3), S6ZETAA) +
    tpro.cVs * (ZETAA - ZETAB) +
    tpro.cWs;
  tpro.Vzeta0 = dot(tpro.beta.slice(0, 3), S5ZETA0) + tpro.cVs;

  // Total number density at zetaF
  tpro.lndtotF =
    LNP0 - MBARG0DIVKB * (tpro.VzetaF - tpro.Vzeta0) - Math.log(KB * tpro.tzetaF);

  return tpro;
}

/**
 * Slice a 14-element gf section gf[base..base+13] as the geomag
 * plg(0:6,0:1) table (column-major: plg[i][j] = slice[i + 7*j]).
 */
function slicePlg(gf: number[], base: number): number[][] {
  const plg: number[][] = [];
  for (let i = 0; i <= 6; i++) {
    plg[i] = [gf[base + i], gf[base + i + 7]];
  }
  return plg;
}

/**
 * TFNX: temperature at geopotential height z. wght holds the four
 * bspline weights wght(-3:0) (0-based array, element 0 = wght(-3)).
 */
export function tfnx(z: number, iz: number, wght: number[], tpro: TnParm): number {
  if (z < ZETAB) {
    // Spline region
    const i = Math.max(iz - 3, 0);
    const j = iz < 3 ? -iz : -3;
    // dot(cf(i:iz), wght(j:0)) with 0-based wght (wght[k] = wght(-3+k))
    let s = 0;
    let w = j + 3;
    for (let k = i; k <= iz; k++) {
      s += tpro.cf[k] * wght[w];
      w++;
    }
    return 1.0 / s;
  } else {
    // Bates profile region
    return tpro.tex - (tpro.tex - tpro.tb0) * Math.exp(-tpro.sigma * (z - ZETAB));
  }
}
