/**
 * W-4 #6 grey line (ruling 252, oracles O6.1-O6.3). Pure: no DOM, no net.
 *
 * PINNED REFERENCE (rule 252, BEFORE code): zero external sources (O6.1).
 * The terminator is derived from the program's own ephemeris —
 * `getSunInfo`/`solarZenithDeg` in solar.ts (verified by solar.test.ts) —
 * so the band is checkable against the program's own sun at any time.
 * Display choices (declared, not physics): half-width 7.5 deg, 144 samples.
 */

import { getSunInfo, solarZenithDeg } from "./solar";
import { latLonToVec3 } from "./geo";

/** Grey band half-width in degrees (display choice, declared). */
export const GREY_HALF_WIDTH_DEG = 7.5;
/** Terminator loop samples (display choice, declared). */
export const GREY_SAMPLES = 144;

/** Terminator latitude at a given longitude (deg) for a subsolar point.
 * Solved from cos(zenith) = 0: tan(phi) = -cos(d)*cos(H)/sin(d).
 * atan2 form is exact at the poles and equinox (no special cases). */
export function terminatorLat(lonDeg: number, subLat: number, subLon: number): number {
  const d = (subLat * Math.PI) / 180;
  const h = ((lonDeg - subLon) * Math.PI) / 180;
  const phi = Math.atan2(-Math.cos(d) * Math.cos(h), Math.sin(d));
  return (phi * 180) / Math.PI;
}

export interface GreyPoint {
  lat: number;
  lon: number;
}

/** Terminator loop (O6.1): n points around the globe at the epoch. */
export function greylineLoop(epochSec: number, n = GREY_SAMPLES): GreyPoint[] {
  const s = getSunInfo(epochSec);
  const pts: GreyPoint[] = [];
  for (let i = 0; i < n; i++) {
    const lon = (i / n) * 360 - 180;
    pts.push({ lat: terminatorLat(lon, s.subsolarLat, s.subsolarLon), lon });
  }
  return pts;
}

/** Unit sun direction in engine frame (same convention as the scene). */
export function greySunDir(epochSec: number): [number, number, number] {
  const s = getSunInfo(epochSec);
  return latLonToVec3(s.subsolarLat, s.subsolarLon, 1);
}

/**
 * Ribbon edges at +/- halfWidth degrees around the terminator (O6.2:
 * plain geometry overlay — the earth sun/night shader is untouched).
 * Offset along the local day-gradient (toward/away from the subsolar
 * point), rotated exactly by halfWidth around the tangent axis. */
export function greyRibbon(
  epochSec: number,
  halfWidthDeg = GREY_HALF_WIDTH_DEG,
  n = GREY_SAMPLES
): { inner: [number, number, number][]; outer: [number, number, number][] } {
  const sun = greySunDir(epochSec);
  const hw = (halfWidthDeg * Math.PI) / 180;
  const inner: [number, number, number][] = [];
  const outer: [number, number, number][] = [];
  const loop = greylineLoop(epochSec, n);
  for (const p of loop) {
    const v = latLonToVec3(p.lat, p.lon, 1);
    // Day-gradient direction in the tangent plane.
    const dot = v[0] * sun[0] + v[1] * sun[1] + v[2] * sun[2];
    let gx = sun[0] - dot * v[0];
    let gy = sun[1] - dot * v[1];
    let gz = sun[2] - dot * v[2];
    const gl = Math.hypot(gx, gy, gz) || 1;
    gx /= gl;
    gy /= gl;
    gz /= gl;
    // Rotation axis = tangent perpendicular to the gradient.
    const ax = v[1] * gz - v[2] * gy;
    const ay = v[2] * gx - v[0] * gz;
    const az = v[0] * gy - v[1] * gx;
    for (const [sgn, dst] of [[1, outer], [-1, inner]] as [number, [number, number, number][]][]) {
      const a = sgn * hw;
      const c = Math.cos(a);
      const si = Math.sin(a);
      // Rodrigues rotation of v around axis a by angle a.
      const d = v[0] * ax + v[1] * ay + v[2] * az;
      dst.push([
        v[0] * c + (ay * v[2] - az * v[1]) * si + ax * d * (1 - c),
        v[1] * c + (az * v[0] - ax * v[2]) * si + ay * d * (1 - c),
        v[2] * c + (ax * v[1] - ay * v[0]) * si + az * d * (1 - c),
      ]);
    }
  }
  return { inner, outer };
}

export interface GreySpot {
  txLat: number;
  txLon: number;
  rxLat: number;
  rxLon: number;
}

/**
 * O6.3 superposition: WSPR spots whose midpoint path lies inside the
 * grey band (the highway IN USE). Same zenith function as the scene.
 */
export function countGreySpots(spots: GreySpot[], epochSec: number): number {
  return filterGreySpots(spots, epochSec).length;
}

function spotGrey(s: GreySpot, epochSec: number): boolean {
  const midLat = (s.txLat + s.rxLat) / 2;
  let midLon = (s.txLon + s.rxLon) / 2;
  if (midLon > 180) midLon -= 360;
  if (midLon < -180) midLon += 360;
  const z = solarZenithDeg(midLat, midLon, epochSec);
  return Math.abs(z - 90) <= GREY_HALF_WIDTH_DEG;
}

export function filterGreySpots<T extends GreySpot>(spots: T[], epochSec: number): T[] {
  return spots.filter((s) => spotGrey(s, epochSec));
}
