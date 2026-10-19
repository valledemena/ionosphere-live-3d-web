// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — NRLMSIS 2.1 main entry point (drop 9c, F2b #9).
//
// TypeScript transcription of `msis_calc.F90` (MSISCALC subroutine) from
// the NRLMSIS 2.1 reference package (NRL-SOF-014-1, mirror pinned at
// jacobwilliams/NRLMSIS2.1 commit 9124144).
// Source sha256:
// be5ee7e90e9610f72b5db96aefade89601007ccd4a2c86b545e12102cfcbee55
// Faithful translation without physics changes
// (traducción fiel sin cambios de física). Translated 2026-10-16.
//
// NRL-SOF section 4(b) compliance: verbatim translation of the logic;
// the original copyright notice is reproduced in
// `nrlmsis2.1_license.txt` in this directory. Portions of NRLMSIS
// Copyright (C) 2021 U.S. Naval Research Laboratory.
//
// Notes: the original memoizes gf/tpro/dpro/Sz/iz across calls with
// SAVE variables. This port recomputes every call (stateless), which
// is observationally identical — the stale Sz/iz on the Bates branch
// is never read (tfnx ignores wght there), and re-evaluation with
// unchanged inputs reproduces the same values. The default
// self-initialization (msisinit with CWD parameter file) is replaced
// by an explicit error: the host must initialize with parameter bytes.

import {
  DMISSING,
  LNP0,
  MBARG0DIVKB,
  KB,
  NSPEC,
  NODES_TN,
  ND,
  ZETAF,
  ZETAB,
  HGAMMA,
  ZETAGAMMA,
} from "./msisConstants";
import type { MsisState } from "./msisInit";
import { alt2gph, bspline, dilog } from "./msisUtils";
import { createGfnCache, globe, type GfnCache } from "./msisGfn";
import { tfnparm, tfnx, type TnParm } from "./msisTfn";
import { dfnparm, dfnx, type DnParm } from "./msisDfn";

export type { GfnCache };
export { createGfnCache };

/** Full model output: tn (K), dn(1:10) emulated (index 0 unused), tex (K). */
export interface MsisResult {
  tn: number;
  dn: number[];
  tex: number;
}

/**
 * MSISCALC: day, utsec, z (geodetic altitude km, or geopotential height
 * if zaltflag is false), lat, lon, sfluxavg (F10.7a), sflux (F10.7),
 * ap (7-element daily/history array, 0-based; element 0 = daily Ap).
 */
export function msiscalc(
  state: MsisState,
  cache: GfnCache,
  day: number,
  utsec: number,
  z: number,
  lat: number,
  lon: number,
  sfluxavg: number,
  sflux: number,
  ap: number[],
): MsisResult {
  if (!state.initflag) {
    throw new Error("msis: model not initialized (call msisinit with parameter bytes first)");
  }

  // Geopotential height, if necessary
  const zeta = state.zaltflag ? alt2gph(lat, z) : z;

  // Local spline weights (only needed below zetaB)
  let iz = 0;
  let Sz: number[][] = Array.from({ length: 6 }, () => [0, 0, 0, 0, 0, 0, 0]);
  if (zeta < ZETAB) {
    const kmax = zeta < ZETAF ? 5 : 6;
    const r = bspline(zeta, NODES_TN, ND + 2, kmax, state.etaTN);
    iz = r.i;
    Sz = r.S;
  }

  // Profile parameters
  const gf = globe(state, cache, day, utsec, lat, lon, sfluxavg, sflux, ap);
  const tpro: TnParm = tfnparm(state, gf);
  const dpro: (DnParm | null)[] = new Array(NSPEC).fill(null);
  for (let ispec = 2; ispec <= NSPEC - 1; ispec++) {
    if (state.specflag[ispec]) dpro[ispec] = dfnparm(state, ispec, gf, tpro);
  }

  const tex = tpro.tex;

  // Temperature at altitude (wght = Sz(-3:0,4); ignored on Bates branch)
  const tn = tfnx(zeta, iz, [Sz[2][4], Sz[3][4], Sz[4][4], Sz[5][4]], tpro);

  // Temperature integration terms at altitude, total number density
  const delz = zeta - ZETAB;
  let Vz: number;
  let Wz: number;
  // NOTE: the source leaves lndtotz undefined for zeta >= zetaF; it is
  // only read by dfnx in the z < zhyd mixing-ratio branch, which
  // requires zeta < zetaF (or takes the O/NO spline path that ignores
  // it). NaN here is never observed.
  let lndtotz = Number.NaN;
  if (zeta < ZETAF) {
    const i = Math.max(iz - 4, 0);
    const j = iz < 4 ? -iz : -4;
    Vz = dotBeta(tpro, i, iz, Sz, j, 5) + tpro.cVs;
    Wz = 0;
    const lnPz = LNP0 - MBARG0DIVKB * (Vz - tpro.Vzeta0);
    lndtotz = lnPz - Math.log(KB * tn);
  } else {
    if (zeta < ZETAB) {
      Vz = dotBeta(tpro, iz - 4, iz, Sz, -4, 5) + tpro.cVs;
      Wz = dotGamma(tpro, iz - 5, iz, Sz, -5, 6) + tpro.cVs * delz + tpro.cWs;
    } else {
      Vz = (delz + Math.log(tn / tpro.tex) / tpro.sigma) / tpro.tex + tpro.cVb;
      Wz =
        (0.5 * delz * delz + dilog(tpro.b * Math.exp(-tpro.sigma * delz)) / tpro.sigmasq) /
          tpro.tex +
        tpro.cVb * delz +
        tpro.cWb;
    }
  }

  // Species number densities at altitude (m^-3)
  const HRfact = 0.5 * (1.0 + Math.tanh(HGAMMA * (zeta - ZETAGAMMA)));
  const dn: number[] = new Array(NSPEC).fill(0);
  for (let ispec = 2; ispec <= NSPEC - 1; ispec++) {
    dn[ispec] = state.specflag[ispec]
      ? dfnx(state, zeta, tn, lndtotz, Vz, Wz, HRfact, tpro, dpro[ispec] as DnParm)
      : DMISSING;
  }

  // Mass density (kg/m^3)
  dn[1] = state.specflag[1] ? dotDn(dn, state.masswgt) : DMISSING;

  return { tn, dn, tex };
}

/** dot(tpro.beta(i:iz), Sz(j:0,k)) with 0-based Sz rows (row = l+5). */
function dotBeta(
  tpro: TnParm,
  i: number,
  iz: number,
  Sz: number[][],
  j: number,
  k: number,
): number {
  let s = 0;
  let w = j + 5;
  for (let q = i; q <= iz; q++) {
    s += tpro.beta[q] * Sz[w][k];
    w++;
  }
  return s;
}

/** dot(tpro.gamma(i:iz), Sz(j:0,k)) with 0-based Sz rows. */
function dotGamma(
  tpro: TnParm,
  i: number,
  iz: number,
  Sz: number[][],
  j: number,
  k: number,
): number {
  let s = 0;
  let w = j + 5;
  for (let q = i; q <= iz; q++) {
    s += tpro.gamma[q] * Sz[w][k];
    w++;
  }
  return s;
}

/** dot(dn(1:10), masswgt(1:10)). */
function dotDn(dn: number[], masswgt: number[]): number {
  let s = 0;
  for (let q = 1; q <= 10; q++) s += dn[q] * masswgt[q];
  return s;
}
