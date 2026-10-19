// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — NRLMSIS 2.1 legacy wrapper (drop 9c, F2b #9).
//
// TypeScript transcription of `msis_gtd8d.F90` (GTD8D subroutine) from
// the NRLMSIS 2.1 reference package (NRL-SOF-014-1, mirror pinned at
// jacobwilliams/NRLMSIS2.1 commit 9124144).
// Source sha256:
// 5c54e3d2ca0d7a7b85a0b66608e2496f18ba47368ff0a966bfd8e97429dbb219
// Faithful translation without physics changes
// (traducción fiel sin cambios de física). Translated 2026-10-16.
//
// NRL-SOF section 4(b) compliance: verbatim translation of the logic;
// the original copyright notice is reproduced in
// `nrlmsis2.1_license.txt` in this directory. Portions of NRLMSIS
// Copyright (C) 2021 U.S. Naval Research Laboratory.
//
// Notes: the Fortran single-precision outputs (sngl) are kept as
// doubles here; the reference print rounding (e13.4/f8.2) is declared
// per column in the 9c regression. ap is 0-based (element 0 = daily
// Ap); stl and mass inputs are ignored exactly as in the source.

import { DMISSING } from "./msisConstants";
import type { MsisState } from "./msisInit";
import { msiscalc, createGfnCache, type GfnCache } from "./msisCalc";

/** Legacy outputs: d(1:10) emulated (index 0 unused), t(1:2) emulated. */
export interface Gtd8dResult {
  d: number[];
  t: number[];
}

/**
 * GTD8D: legacy wrapper. iyd = year*1000 + day-of-year (year ignored);
 * sec = UT seconds; alt = geodetic altitude km; f107a/f107 solar flux;
 * ap = 7-element Ap array (0-based); mass ignored; stl ignored.
 */
export function gtd8d(
  state: MsisState,
  cache: GfnCache,
  iyd: number,
  sec: number,
  alt: number,
  glat: number,
  glong: number,
  stl: number,
  f107a: number,
  f107: number,
  ap: number[],
  mass: number,
): Gtd8dResult {
  void stl;
  void mass;
  const xday = iyd % 1000;
  const { tn: xtn, dn: xdn, tex: xtex } = msiscalc(
    state, cache, xday, sec, alt, glat, glong, f107a, f107, ap,
  );

  const t = [0, xtex, xtn];
  for (let k = 1; k <= 10; k++) {
    if (xdn[k] !== DMISSING) xdn[k] = xdn[k] * 1e-6;
  }
  if (xdn[1] !== DMISSING) xdn[1] = xdn[1] * 1e3;
  const d = [
    0,
    xdn[5], // He
    xdn[4], // O
    xdn[2], // N2
    xdn[3], // O2
    xdn[7], // Ar
    xdn[1], // mass density
    xdn[6], // H
    xdn[8], // N
    xdn[9], // anomalous O
    xdn[10], // NO
  ];
  return { d, t };
}

export { createGfnCache };
export type { GfnCache };
