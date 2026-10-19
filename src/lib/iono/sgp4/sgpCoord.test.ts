// ionosphere-live-3d — drop 313 TU: TEME/ECEF/geodetic helpers.
// gstime is ported Vallado eq. 3-45; rotation/geodetic are own code.
// Numeric pins computed with an INDEPENDENT Python implementation
// (same published formulas, no shared code with this module).

import { describe, expect, it } from "vitest";
import { gstime, teme2ecef, ecef2geodetic, jday, invjday } from "./sgpCoord";

describe("313 gstime (ported Vallado eq 3-45)", () => {
  it("matches the independent implementation", () => {
    // Python (own coding of eq. 3-45): 3.482786746879171
    expect(gstime(2453106.5)).toBeCloseTo(3.482786746879171, 12);
  });
  it("advances ~2pi per day (wrapped excess is one extra turn per year)", () => {
    const g0 = gstime(2453106.5);
    const g1 = gstime(2453107.5);
    let d = g1 - g0;
    if (d < 0) d += 2 * Math.PI;
    // One solar day = one extra sidereal increment of 2pi/365.25 (mod 2pi)
    expect(d).toBeCloseTo((2 * Math.PI) / 365.25, 4);
  });
});

describe("313 teme2ecef (GMST z-rotation)", () => {
  it("matches the independent implementation", () => {
    const e = teme2ecef([4200, -5500, 3200], 3.482786746879171);
    expect(e[0]).toBeCloseTo(-2117.52501971713, 6);
    expect(e[1]).toBeCloseTo(6588.329666225876, 6);
    expect(e[2]).toBe(3200);
  });
  it("is a pure z rotation (norm + z preserved, basis images)", () => {
    const e = teme2ecef([1, 0, 0], Math.PI / 2);
    expect(e[0]).toBeCloseTo(0, 12);
    expect(e[1]).toBeCloseTo(-1, 12);
    expect(e[2]).toBe(0);
    const v = teme2ecef([3, -4, 12], 1.234);
    expect(Math.hypot(v[0], v[1], v[2])).toBeCloseTo(Math.hypot(3, -4, 12), 12);
    expect(v[2]).toBe(12);
  });
});

describe("313 ecef2geodetic (Hirvonen, WGS-84)", () => {
  it("matches the independent implementation", () => {
    const g = ecef2geodetic([-2117.52501971713, 6588.329666225876, 3200.0]);
    expect(g.lat).toBeCloseTo(24.939063621, 6);
    expect(g.lon).toBeCloseTo(107.817687872, 6);
    expect(g.altKm).toBeCloseTo(1249.945535518, 6);
  });
  it("equator/prime-meridian and pole are exact", () => {
    const eq = ecef2geodetic([6378.137, 0, 0]);
    expect(eq.lat).toBeCloseTo(0, 9);
    expect(eq.lon).toBeCloseTo(0, 9);
    expect(eq.altKm).toBeCloseTo(0, 6);
    const b = 6378.137 * (1 - 1 / 298.257223563);
    const np = ecef2geodetic([0, 0, b]);
    expect(np.lat).toBeCloseTo(90, 6);
    expect(np.altKm).toBeCloseTo(0, 3);
  });
});

describe("313 jday/invjday round-trip", () => {
  it("2000-01-01 12:00 UTC is JD 2451545.0", () => {
    const { jd, jdFrac } = jday(2000, 1, 1, 12, 0, 0);
    expect(jd + jdFrac).toBeCloseTo(2451545.0, 9);
  });
  it("inverts jday", () => {
    const fwd = jday(2024, 6, 15, 10, 30, 45.5);
    const back = invjday(fwd.jd, fwd.jdFrac);
    expect(back.year).toBe(2024);
    expect(back.mon).toBe(6);
    expect(back.day).toBe(15);
    expect(back.hr).toBe(10);
    expect(back.minute).toBe(30);
    expect(back.sec).toBeCloseTo(45.5, 6);
  });
});
