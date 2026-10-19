// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — NRLMSIS 2.1 global basis functions (drop 9b, F2b #9).
//
// TypeScript transcription of `msis_gfn.F90` from the NRLMSIS 2.1
// reference package (NRL-SOF-014-1, mirror pinned at
// jacobwilliams/NRLMSIS2.1 commit 9124144).
// Source sha256:
// a284f405bd606bb8b9085907d85ccbd4e7fa77d40fa1665e710f374f64861039
// Faithful translation without physics changes
// (traducción fiel sin cambios de física). Translated 2026-10-16.
//
// NRL-SOF section 4(b) compliance: verbatim translation of the logic;
// the original copyright notice is reproduced in
// `nrlmsis2.1_license.txt` in this directory. Portions of NRLMSIS
// Copyright (C) 2021 U.S. Naval Research Laboratory.
//
// Notes: Fortran `**` maps to Math.pow (as written; `*` stays `*`).
// Fortran MOD (truncated) maps to JS `%` (same truncation semantics).
// Module memoization caches (plg/cdoy/clst/clon + last*) are explicit
// state (GfnCache) instead of hidden globals.

import {
  DEG2RAD,
  DOY2RAD,
  LST2RAD,
  PI,
  MAXNBF,
  MAXN,
  AMAXN,
  AMAXS,
  TMAXL,
  TMAXN,
  TMAXS,
  PMAXM,
  PMAXN,
  PMAXS,
  NSFX,
  NSFXMOD,
  NMAG,
  NUT,
  CTIMEIND,
  CINTANN,
  CTIDE,
  CSPW,
  CSFX,
  CEXTRA,
  CNONLIN,
  CSFXMOD,
  CMAG,
  CUT,
  MBF,
} from "./msisConstants";
import type { MsisState, MsisSubset } from "./msisInit";

/** Memoization state for globe (module caches of the original). */
export interface GfnCache {
  plg: number[][];
  cdoy: number[];
  sdoy: number[];
  clst: number[];
  slst: number[];
  clon: number[];
  slon: number[];
  lastlat: number;
  lastdoy: number;
  lastlst: number;
  lastlon: number;
}

export function createGfnCache(): GfnCache {
  return {
    plg: Array.from({ length: MAXN + 1 }, () => new Array<number>(MAXN + 1).fill(0)),
    cdoy: [0, 0, 0],
    sdoy: [0, 0, 0],
    clst: [0, 0, 0, 0],
    slst: [0, 0, 0, 0],
    clon: [0, 0, 0],
    slon: [0, 0, 0],
    lastlat: -999.9,
    lastdoy: -999.9,
    lastlst: -999.9,
    lastlon: -999.9,
  };
}

export const SFLUXAVGREF = 150.0; // Reference F10.7 value (=150 in NRLMSISE-00)
export const SFLUXAVG_QUAD_CUTOFF = 150.0; // Cutoff F10.7 for truncated quadratic F10.7a

/**
 * GLOBE: horizontal and time-dependent basis functions (512 terms).
 * ap: daily Ap history array (7 elements, 0-based; element 0 = daily Ap).
 */
export function globe(
  state: MsisState,
  cache: GfnCache,
  doy: number,
  utsec: number,
  lat: number,
  lon: number,
  sfluxavg: number,
  sflux: number,
  ap: number[],
): number[] {
  const { plg, cdoy, sdoy, clst, slst, clon, slon } = cache;

  // Associated Legendre polynomials (defined in colatitude)
  if (lat !== cache.lastlat) {
    const clat = Math.sin(lat * DEG2RAD); // sin, Legendre defined in colat
    const slat = Math.cos(lat * DEG2RAD); // cos, Legendre defined in colat
    const clat2 = clat * clat;
    const clat4 = clat2 * clat2;
    const slat2 = slat * slat;

    plg[0][0] = 1.0;
    plg[1][0] = clat;
    plg[2][0] = 0.5 * (3.0 * clat2 - 1.0);
    plg[3][0] = 0.5 * (5.0 * clat * clat2 - 3.0 * clat);
    plg[4][0] = (35.0 * clat4 - 30.0 * clat2 + 3.0) / 8.0;
    plg[5][0] = (63.0 * clat2 * clat2 * clat - 70.0 * clat2 * clat + 15.0 * clat) / 8.0;
    plg[6][0] = (11.0 * clat * plg[5][0] - 5.0 * plg[4][0]) / 6.0;

    plg[1][1] = slat;
    plg[2][1] = 3.0 * clat * slat;
    plg[3][1] = 1.5 * (5.0 * clat2 - 1.0) * slat;
    plg[4][1] = 2.5 * (7.0 * clat2 * clat - 3.0 * clat) * slat;
    plg[5][1] = 1.875 * (21.0 * clat4 - 14.0 * clat2 + 1.0) * slat;
    plg[6][1] = (11.0 * clat * plg[5][1] - 6.0 * plg[4][1]) / 5.0;

    plg[2][2] = 3.0 * slat2;
    plg[3][2] = 15.0 * slat2 * clat;
    plg[4][2] = 7.5 * (7.0 * clat2 - 1.0) * slat2;
    plg[5][2] = 3.0 * clat * plg[4][2] - 2.0 * plg[3][2];
    plg[6][2] = (11.0 * clat * plg[5][2] - 7.0 * plg[4][2]) / 4.0;

    plg[3][3] = 15.0 * slat2 * slat;
    plg[4][3] = 105.0 * slat2 * slat * clat;
    plg[5][3] = (9.0 * clat * plg[4][3] - 7.0 * plg[3][3]) / 2.0;
    plg[6][3] = (11.0 * clat * plg[5][3] - 8.0 * plg[4][3]) / 3.0;

    cache.lastlat = lat;
  }

  // Fourier harmonics of day of year
  if (doy !== cache.lastdoy) {
    cdoy[1] = Math.cos(DOY2RAD * doy);
    sdoy[1] = Math.sin(DOY2RAD * doy);
    cdoy[2] = Math.cos(DOY2RAD * doy * 2.0);
    sdoy[2] = Math.sin(DOY2RAD * doy * 2.0);
    cache.lastdoy = doy;
  }

  // Fourier harmonics of local time
  const lst = ((utsec / 3600.0 + lon / 15.0 + 24.0) % 24.0);
  if (lst !== cache.lastlst) {
    clst[1] = Math.cos(LST2RAD * lst);
    slst[1] = Math.sin(LST2RAD * lst);
    clst[2] = Math.cos(LST2RAD * lst * 2.0);
    slst[2] = Math.sin(LST2RAD * lst * 2.0);
    clst[3] = Math.cos(LST2RAD * lst * 3.0);
    slst[3] = Math.sin(LST2RAD * lst * 3.0);
    cache.lastlst = lst;
  }

  // Fourier harmonics of longitude
  if (lon !== cache.lastlon) {
    clon[1] = Math.cos(DEG2RAD * lon);
    slon[1] = Math.sin(DEG2RAD * lon);
    clon[2] = Math.cos(DEG2RAD * lon * 2.0);
    slon[2] = Math.sin(DEG2RAD * lon * 2.0);
    cache.lastlon = lon;
  }

  // Coupled linear terms
  const bf = new Array<number>(MAXNBF).fill(0);

  // Time-independent (pure latitude dependence)
  let c = CTIMEIND;
  for (let n = 0; n <= AMAXN; n++) {
    bf[c] = plg[n][0];
    c = c + 1;
  }

  // Intra-annual (annual and semiannual)
  if (c !== CINTANN) throw new Error("msis: problem with basis definitions");
  for (let s = 1; s <= AMAXS; s++) {
    const cosdoy = cdoy[s];
    const sindoy = sdoy[s];
    for (let n = 0; n <= AMAXN; n++) {
      const pl = plg[n][0];
      bf[c] = pl * cosdoy;
      bf[c + 1] = pl * sindoy;
      c = c + 2;
    }
  }

  // Migrating tides (local time dependence)
  if (c !== CTIDE) throw new Error("msis: problem with basis definitions");
  for (let l = 1; l <= TMAXL; l++) {
    const coslst = clst[l];
    const sinlst = slst[l];
    for (let n = l; n <= TMAXN; n++) {
      const pl = plg[n][l];
      bf[c] = pl * coslst;
      bf[c + 1] = pl * sinlst;
      c = c + 2;
    }
    // Intra-annual modulation of tides
    for (let s = 1; s <= TMAXS; s++) {
      const cosdoy = cdoy[s];
      const sindoy = sdoy[s];
      for (let n = l; n <= TMAXN; n++) {
        const pl = plg[n][l];
        bf[c] = pl * coslst * cosdoy;
        bf[c + 1] = pl * sinlst * cosdoy;
        bf[c + 2] = pl * coslst * sindoy;
        bf[c + 3] = pl * sinlst * sindoy;
        c = c + 4;
      }
    }
  }

  // Stationary planetary waves (longitude dependence)
  if (c !== CSPW) throw new Error("msis: problem with basis definitions");
  for (let m = 1; m <= PMAXM; m++) {
    const coslon = clon[m];
    const sinlon = slon[m];
    for (let n = m; n <= PMAXN; n++) {
      const pl = plg[n][m];
      bf[c] = pl * coslon;
      bf[c + 1] = pl * sinlon;
      c = c + 2;
    }
    // Intra-annual modulation of SPWs
    for (let s = 1; s <= PMAXS; s++) {
      const cosdoy = cdoy[s];
      const sindoy = sdoy[s];
      for (let n = m; n <= PMAXN; n++) {
        const pl = plg[n][m];
        bf[c] = pl * coslon * cosdoy;
        bf[c + 1] = pl * sinlon * cosdoy;
        bf[c + 2] = pl * coslon * sindoy;
        bf[c + 3] = pl * sinlon * sindoy;
        c = c + 4;
      }
    }
  }

  // Linear solar flux terms
  if (c !== CSFX) throw new Error("msis: problem with basis definitions");
  const dfa = sfluxavg - SFLUXAVGREF;
  const df = sflux - sfluxavg;
  bf[c] = dfa;
  bf[c + 1] = dfa * dfa;
  bf[c + 2] = df;
  bf[c + 3] = df * df;
  bf[c + 4] = df * dfa;
  c = c + NSFX;

  // Additional linear terms
  if (c !== CEXTRA) throw new Error("msis: problem with basis definitions");
  const sza = solzen(doy, lst, lat, lon);
  bf[c] = -0.5 * Math.tanh((sza - 98.0) / 6.0); // SZA logistic for O, H
  bf[c + 1] = -0.5 * Math.tanh((sza - 101.5) / 20.0); // SZA logistic for NO
  bf[c + 2] = dfa * bf[c]; // Solar flux modulation of logistic sza term
  bf[c + 3] = dfa * bf[c + 1]; // Solar flux modulation of logistic sza term
  bf[c + 4] = dfa * plg[2][0]; // Solar flux modulation of P(2,0) term
  bf[c + 5] = dfa * plg[4][0]; // Solar flux modulation of P(4,0) term
  bf[c + 6] = dfa * plg[0][0] * cdoy[1]; // Solar flux modulation of global AO
  bf[c + 7] = dfa * plg[0][0] * sdoy[1]; // Solar flux modulation of global AO
  bf[c + 8] = dfa * plg[0][0] * cdoy[2]; // Solar flux modulation of global SAO
  bf[c + 9] = dfa * plg[0][0] * sdoy[2]; // Solar flux modulation of global SAO
  if (sfluxavg <= SFLUXAVG_QUAD_CUTOFF) {
    bf[c + 10] = dfa * dfa;
  } else {
    bf[c + 10] =
      (SFLUXAVG_QUAD_CUTOFF - SFLUXAVGREF) *
      (2.0 * dfa - (SFLUXAVG_QUAD_CUTOFF - SFLUXAVGREF));
  }
  bf[c + 11] = bf[c + 10] * plg[2][0]; // P(2,0) modulation of truncated quadratic F10.7a
  bf[c + 12] = bf[c + 10] * plg[4][0]; // P(4,0) modulation of truncated quadratic F10.7a
  bf[c + 13] = df * plg[2][0]; // P(2,0) modulation of df
  bf[c + 14] = df * plg[4][0]; // P(4,0) modulation of df

  // Nonlinear terms
  c = CNONLIN;

  // Solar flux modulation terms
  if (c !== CSFXMOD) throw new Error("msis: problem with basis definitions");
  bf[c] = dfa;
  bf[c + 1] = dfa * dfa;
  bf[c + 2] = df;
  bf[c + 3] = df * df;
  bf[c + 4] = df * dfa;
  c = c + NSFXMOD;

  // Terms for legacy geomagnetic activity dependence
  if (c !== CMAG) throw new Error("msis: problem with basis set");
  for (let k = 0; k <= 6; k++) bf[c + k] = ap[k] - 4.0;
  // NOTE: bf[c+7] intentionally left zero (source skips it)
  bf[c + 8] = DOY2RAD * doy;
  bf[c + 9] = LST2RAD * lst;
  bf[c + 10] = DEG2RAD * lon;
  bf[c + 11] = (LST2RAD * utsec) / 3600.0;
  bf[c + 12] = Math.abs(lat);
  c = c + 13;
  for (let m = 0; m <= 1; m++) {
    for (let n = 0; n <= AMAXN; n++) {
      bf[c] = plg[n][m];
      c = c + 1;
    }
  }

  // Terms for legacy UT dependence
  c = CUT;
  bf[c] = (LST2RAD * utsec) / 3600.0;
  bf[c + 1] = DOY2RAD * doy;
  bf[c + 2] = dfa;
  bf[c + 3] = DEG2RAD * lon;
  bf[c + 4] = plg[1][0];
  bf[c + 5] = plg[3][0];
  bf[c + 6] = plg[5][0];
  bf[c + 7] = plg[3][2];
  bf[c + 8] = plg[5][2];

  // Apply switches (linear terms only, 0..MBF)
  for (let k = 0; k <= MBF; k++) {
    if (!state.swg[k]) bf[k] = 0;
  }

  return bf;
}

// ---------------------------------------------------------------------------
// SOLZEN: solar zenith angle (adapted from IRI subroutine)
// ---------------------------------------------------------------------------

const SOLZEN_P = [0.017203534, 0.034407068, 0.051610602, 0.068814136, 0.103221204];

export function solzen(ddd: number, lst: number, lat: number, lon: number): number {
  const humr = PI / 12.0;
  // NOTE: source also declares dumr = pi/182.5 (unused) and computes
  // teqnx = ddd + (lst + wlon/15)/24 + 0.9369 first (dead); the
  // effective line below is what survives.
  void lon;
  const teqnx = ddd + 0.9369;

  // Solar declination
  let dec =
    23.256 * Math.sin(SOLZEN_P[0] * (teqnx - 82.242)) +
    0.381 * Math.sin(SOLZEN_P[1] * (teqnx - 44.855)) +
    0.167 * Math.sin(SOLZEN_P[2] * (teqnx - 23.355)) -
    0.013 * Math.sin(SOLZEN_P[3] * (teqnx + 11.97)) +
    0.011 * Math.sin(SOLZEN_P[4] * (teqnx - 10.41)) +
    0.339137;
  dec = dec * DEG2RAD;

  // Equation of time
  const tf = teqnx - 0.5;
  const teqt =
    -7.38 * Math.sin(SOLZEN_P[0] * (tf - 4.0)) -
    9.87 * Math.sin(SOLZEN_P[1] * (tf + 9.0)) +
    0.27 * Math.sin(SOLZEN_P[2] * (tf - 53.0)) -
    0.2 * Math.cos(SOLZEN_P[3] * (tf - 17.0));

  const phi = humr * (lst - 12.0) + (teqt * DEG2RAD) / 4.0;
  const rlat = lat * DEG2RAD;

  // Cosine of solar zenith angle
  let cosx =
    Math.sin(rlat) * Math.sin(dec) +
    Math.cos(rlat) * Math.cos(dec) * Math.cos(phi);
  if (Math.abs(cosx) > 1.0) cosx = cosx > 0 ? 1.0 : -1.0;

  return Math.acos(cosx) / DEG2RAD;
}

// ---------------------------------------------------------------------------
// SFLUXMOD: legacy nonlinear modulation of intra-annual, tide, SPW terms
// ---------------------------------------------------------------------------

export function sfluxmod(
  state: MsisState,
  iz: number,
  gf: number[],
  parmset: MsisSubset,
  dffact: number,
): number {
  let f1: number;
  if (state.swg[CSFXMOD]) {
    f1 =
      parmset.beta[CSFXMOD][iz] * gf[CSFXMOD] +
      (parmset.beta[CSFX + 2][iz] * gf[CSFXMOD + 2] +
        parmset.beta[CSFX + 3][iz] * gf[CSFXMOD + 3]) *
        dffact;
  } else {
    f1 = 0;
  }

  let f2: number;
  if (state.swg[CSFXMOD + 1]) {
    f2 =
      parmset.beta[CSFXMOD + 1][iz] * gf[CSFXMOD] +
      (parmset.beta[CSFX + 2][iz] * gf[CSFXMOD + 2] +
        parmset.beta[CSFX + 3][iz] * gf[CSFXMOD + 3]) *
        dffact;
  } else {
    f2 = 0;
  }

  let f3: number;
  if (state.swg[CSFXMOD + 2]) {
    f3 = parmset.beta[CSFXMOD + 2][iz] * gf[CSFXMOD];
  } else {
    f3 = 0;
  }

  let sum = 0;
  for (let j = 0; j <= MBF; j++) {
    if (state.zsfx[j]) {
      sum = sum + parmset.beta[j][iz] * gf[j] * f1;
      continue;
    }
    if (state.tsfx[j]) {
      sum = sum + parmset.beta[j][iz] * gf[j] * f2;
      continue;
    }
    if (state.psfx[j]) {
      sum = sum + parmset.beta[j][iz] * gf[j] * f3;
      continue;
    }
  }
  return sum;
}

// ---------------------------------------------------------------------------
// GEOMAG: legacy nonlinear ap dependence (daily ap and ap history modes)
// Master switches: neither cmag → zero; both → daily Ap;
//                  exactly one → 3-hour ap history.
// ---------------------------------------------------------------------------

function g0fn(a: number, k00r: number, k00s: number): number {
  return a + (k00r - 1.0) * (a + (Math.exp(-a * k00s) - 1.0) / k00s);
}

export function geomag(
  state: MsisState,
  p0: number[],
  bf: number[],
  plg: number[][],
): number {
  // Return zero if both master switches are off
  if (!(state.swg[CMAG] || state.swg[CMAG + 1])) return 0;

  const p = p0.slice();
  const swg1: boolean[] = [];
  for (let k = 0; k <= NMAG - 1; k++) swg1[k] = state.swg[CMAG + k];

  if (swg1[0] === swg1[1]) {
    // Daily Ap mode
    if (p[1] === 0) return 0; // k00s zero → cannot compute
    for (let k = 2; k <= 25; k++) if (!swg1[k]) p[k] = 0;
    p[8] = p0[8]; // Need doy phase term
    const delA = g0fn(bf[0], p[0], p[1]);
    return (
      (p[2] * plg[0][0] + p[3] * plg[2][0] + p[4] * plg[4][0] + // time independent
        (p[5] * plg[1][0] + p[6] * plg[3][0] + p[7] * plg[5][0]) * Math.cos(bf[8] - p[8]) + // doy modulation
        (p[9] * plg[1][1] + p[10] * plg[3][1] + p[11] * plg[5][1]) * Math.cos(bf[9] - p[12]) + // local time
        (1.0 + p[13] * plg[1][0]) *
          (p[14] * plg[2][1] + p[15] * plg[4][1] + p[16] * plg[6][1]) *
          Math.cos(bf[10] - p[17]) + // longitude effect
        (p[18] * plg[1][1] + p[19] * plg[3][1] + p[20] * plg[5][1]) *
          Math.cos(bf[10] - p[21]) *
          Math.cos(bf[8] - p[8]) + // longitude with doy modulation
        (p[22] * plg[1][0] + p[23] * plg[3][0] + p[24] * plg[5][0]) *
          Math.cos(bf[11] - p[25])) * // universal time
      delA
    );
  } else {
    // 3-hour ap history mode
    if (p[28] === 0) return 0; // beta00 zero → cannot compute
    for (let k = 30; k <= NMAG - 1; k++) if (!swg1[k]) p[k] = 0;
    p[36] = p0[36]; // Need doy phase term
    const gbeta = p[28] / (1 + p[29] * (45.0 - bf[12]));
    const ex = Math.exp(-10800.0 * gbeta);
    const sumex = 1 + ((1 - Math.pow(ex, 19.0)) * Math.pow(ex, 0.5)) / (1 - ex);
    const G = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 1; i <= 6; i++) G[i] = g0fn(bf[i], p[26], p[27]);
    const delA =
      (G[1] +
        (G[2] * ex +
          G[3] * ex * ex +
          G[4] * Math.pow(ex, 3.0) +
          (G[5] * Math.pow(ex, 4.0) + G[6] * Math.pow(ex, 12.0)) *
            ((1 - Math.pow(ex, 8.0)) / (1 - ex)))) /
      sumex;
    return (
      (p[30] * plg[0][0] + p[31] * plg[2][0] + p[32] * plg[4][0] + // time independent
        (p[33] * plg[1][0] + p[34] * plg[3][0] + p[35] * plg[5][0]) *
          Math.cos(bf[8] - p[36]) + // doy modulation
        (p[37] * plg[1][1] + p[38] * plg[3][1] + p[39] * plg[5][1]) *
          Math.cos(bf[9] - p[40]) + // local time modulation
        (1.0 + p[41] * plg[1][0]) *
          (p[42] * plg[2][1] + p[43] * plg[4][1] + p[44] * plg[6][1]) *
          Math.cos(bf[10] - p[45]) + // longitude effect
        (p[46] * plg[1][1] + p[47] * plg[3][1] + p[48] * plg[5][1]) *
          Math.cos(bf[10] - p[49]) *
          Math.cos(bf[8] - p[36]) + // longitude with doy modulation
        (p[50] * plg[1][0] + p[51] * plg[3][0] + p[52] * plg[5][0]) *
          Math.cos(bf[11] - p[53])) * // universal time
      delA
    );
  }
}

// ---------------------------------------------------------------------------
// UTDEP: legacy nonlinear UT dependence
// ---------------------------------------------------------------------------

export function utdep(state: MsisState, p0: number[], bf: number[]): number {
  const p = p0.slice();
  const swg1: boolean[] = [];
  for (let k = 0; k <= NUT - 1; k++) swg1[k] = state.swg[CUT + k];
  for (let k = 3; k <= NUT - 1; k++) if (!swg1[k]) p[k] = 0;

  return (
    Math.cos(bf[0] - p[0]) *
      (1 + p[3] * bf[4] * Math.cos(bf[1] - p[1])) *
      (1 + p[4] * bf[2]) *
      (1 + p[5] * bf[4]) *
      (p[6] * bf[4] + p[7] * bf[5] + p[8] * bf[6]) +
    Math.cos(bf[0] - p[2] + 2 * bf[3]) *
      (p[9] * bf[7] + p[10] * bf[8]) *
      (1 + p[11] * bf[2])
  );
}
