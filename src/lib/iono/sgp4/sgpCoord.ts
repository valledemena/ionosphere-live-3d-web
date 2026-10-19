// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — TEME/ECEF/geodetic helpers for the SGP4 port
// (drop 313, F2b #10).
//
// Own first-party code (no Fortran/C++ source transcribed here):
// - gstime lives in sgp4.ts (ported Vallado eq. 3-45).
// - teme2ecef: rotation about the z-axis by GMST (the standard
//   GMST-only TEME→pseudo-Earth-fixed reduction used with SGP4 output;
//   full FK5 teme_pef with nutation terms is out of scope for the 313
//   motor and would not change the verification vectors, which are TEME).
// - ecef2geodetic: Hirvonen iterative method, WGS-84.
// TU pins come from an independent Python implementation of the same
// published formulas (9a method), hardcoded with provenance.

import { gstime, jday, invjday, days2mdhms } from "./sgp4";

export const WGS84_A = 6378.137; // km
export const WGS84_F = 1 / 298.257223563;

/**
 * TEME (km) to pseudo-Earth-fixed ECEF (km) via GMST rotation.
 * gmstRad: use gstime(jdut1) from sgp4.ts.
 */
export function teme2ecef(rTEME: number[], gmst: number): number[] {
  const c = Math.cos(gmst);
  const s = Math.sin(gmst);
  return [
    c * rTEME[0] + s * rTEME[1],
    -s * rTEME[0] + c * rTEME[1],
    rTEME[2],
  ];
}

/** ECEF (km) to geodetic latitude (deg), longitude (deg), height (km). */
export function ecef2geodetic(rECEF: number[]): { lat: number; lon: number; altKm: number } {
  const a = WGS84_A;
  const f = WGS84_F;
  const e2 = 2 * f - f * f;
  const [x, y, z] = rECEF;
  const lon = Math.atan2(y, x);
  const p = Math.sqrt(x * x + y * y);
  if (p === 0) {
    // Exact pole: Hirvonen divides by zero; height is |z| minus polar radius.
    return { lat: z >= 0 ? 90 : -90, lon: 0, altKm: Math.abs(z) - a * (1 - f) };
  }
  let lat = Math.atan2(z, p * (1 - e2));
  let alt = 0;
  for (let k = 0; k < 5; k++) {
    const sinLat = Math.sin(lat);
    const n = a / Math.sqrt(1 - e2 * sinLat * sinLat);
    alt = p / Math.cos(lat) - n;
    lat = Math.atan2(z, p * (1 - (e2 * n) / (n + alt)));
  }
  return { lat: (lat * 180) / Math.PI, lon: (lon * 180) / Math.PI, altKm: alt };
}

export { gstime, jday, invjday, days2mdhms };
