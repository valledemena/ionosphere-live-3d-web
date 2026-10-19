// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — NRLMSIS 2.1 shell grid (drop 9d, F2b #9).
//
// Pure lat×lon Tn/rho grid builder over msiscalc for the app shell.
// North-first rows (row 0 = +90 deg, shell convention), cell centers,
// no DOM, no fetch (the caller supplies the initialized state).
// Default solar/geomagnetic inputs are REFERENCE quiet conditions,
// always echoed back to the caller (never presented as live).

import type { MsisState } from "./msisInit";
import { msiscalc, createGfnCache, type GfnCache } from "./msisCalc";

export interface MsisGridSpec {
  w: number;
  h: number;
  /** Geodetic altitude km (100..600 for the 9d shell grid). */
  altKm: number;
  /** Day of year 1..366. */
  doy: number;
  /** Universal time seconds. */
  utsec: number;
  f107a?: number;
  f107?: number;
  /** 7-element Ap array, 0-based (element 0 = daily Ap). */
  ap?: number[];
}

export const MSIS_REF_F107A = 150;
export const MSIS_REF_F107 = 150;
export const MSIS_REF_AP = 4;

export function resolveMsisInputs(spec: MsisGridSpec): {
  f107a: number;
  f107: number;
  ap: number[];
} {
  return {
    f107a: spec.f107a ?? MSIS_REF_F107A,
    f107: spec.f107 ?? MSIS_REF_F107,
    ap: spec.ap ?? [MSIS_REF_AP, 0, 0, 0, 0, 0, 0],
  };
}

export interface MsisGrid {
  w: number;
  h: number;
  /** Neutral temperature K, north-first. */
  tn: Float32Array;
  /** Total mass density g/cm^3, north-first. */
  rho: Float32Array;
  altKm: number;
  doy: number;
  utsec: number;
  f107a: number;
  f107: number;
  apDaily: number;
}

/** Cell-center latitude of a north-first row. */
export function gridLat(h: number, row: number): number {
  return 90 - ((row + 0.5) * 180) / h;
}

/** Cell-center longitude of a column. */
export function gridLon(w: number, col: number): number {
  return -180 + ((col + 0.5) * 360) / w;
}

/**
 * Build the Tn/rho grid. One shared globe cache across cells (same as
 * the 9c regression harness).
 */
export function buildMsisGrid(
  state: MsisState,
  cache: GfnCache,
  spec: MsisGridSpec,
): MsisGrid {
  const { f107a, f107, ap } = resolveMsisInputs(spec);
  const tn = new Float32Array(spec.w * spec.h);
  const rho = new Float32Array(spec.w * spec.h);
  for (let row = 0; row < spec.h; row++) {
    const lat = gridLat(spec.h, row);
    for (let col = 0; col < spec.w; col++) {
      const lon = gridLon(spec.w, col);
      const r = msiscalc(state, cache, spec.doy, spec.utsec, spec.altKm, lat, lon, f107a, f107, ap);
      tn[row * spec.w + col] = r.tn;
      // dn[1] is kg/m^3; shell rho is g/cm^3 (same net factor as gtd8d).
      rho[row * spec.w + col] = r.dn[1] * 1e-3;
    }
  }
  return {
    w: spec.w, h: spec.h, tn, rho,
    altKm: spec.altKm, doy: spec.doy, utsec: spec.utsec,
    f107a, f107, apDaily: ap[0],
  };
}

/** Single-point Tn (K) + rho (g/cm^3) query. */
export function msisPoint(
  state: MsisState,
  cache: GfnCache,
  spec: MsisGridSpec & { lat: number; lon: number },
): { tn: number; rho: number } {
  const { f107a, f107, ap } = resolveMsisInputs(spec);
  const r = msiscalc(state, cache, spec.doy, spec.utsec, spec.altKm, spec.lat, spec.lon, f107a, f107, ap);
  return { tn: r.tn, rho: r.dn[1] * 1e-3 };
}

/** Grid summary statistics (min/max/mean over finite cells). */
export function msisGridStats(g: MsisGrid): {
  tnMin: number; tnMax: number; tnMean: number;
  rhoMin: number; rhoMax: number; rhoMean: number;
} {
  let tnMin = Infinity, tnMax = -Infinity, tnSum = 0, tnN = 0;
  let rhoMin = Infinity, rhoMax = -Infinity, rhoSum = 0, rhoN = 0;
  for (let k = 0; k < g.w * g.h; k++) {
    const t = g.tn[k];
    if (Number.isFinite(t)) {
      if (t < tnMin) tnMin = t;
      if (t > tnMax) tnMax = t;
      tnSum += t;
      tnN++;
    }
    const r = g.rho[k];
    if (Number.isFinite(r) && r > 0) {
      if (r < rhoMin) rhoMin = r;
      if (r > rhoMax) rhoMax = r;
      rhoSum += r;
      rhoN++;
    }
  }
  return {
    tnMin, tnMax, tnMean: tnN ? tnSum / tnN : NaN,
    rhoMin, rhoMax, rhoMean: rhoN ? rhoSum / rhoN : NaN,
  };
}

export { createGfnCache };
export type { GfnCache };
