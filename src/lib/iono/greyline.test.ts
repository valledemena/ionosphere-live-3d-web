import { describe, expect, it } from "vitest";
import {
  terminatorLat,
  greylineLoop,
  greyRibbon,
  countGreySpots,
  GREY_HALF_WIDTH_DEG,
  GREY_SAMPLES,
} from "./greyline";
import { solarZenithDeg, getSunInfo } from "./solar";
import { vec3ToLatLon } from "./geo";

const EPOCH = Date.parse("2026-10-14T12:00:00Z") / 1000;

describe("greyline constants (declared display choices)", () => {
  it("half-width and sample count", () => {
    expect(GREY_HALF_WIDTH_DEG).toBe(7.5);
    expect(GREY_SAMPLES).toBe(144);
  });
});

describe("terminatorLat (O6.1 checkable geometry)", () => {
  it("equinox noon: terminator through the poles", () => {
    // subsolar (0, 0): at lon +/-90 the whole meridian is terminator.
    expect(Math.abs(Math.abs(terminatorLat(90, 0, 0)) - 90)).toBeLessThan(1);
    expect(Math.abs(Math.abs(terminatorLat(-90, 0, 0)) - 90)).toBeLessThan(1);
  });
  it("subsolar meridian is full day", () => {
    expect(terminatorLat(0, 0, 0)).toBeCloseTo(-90, 0);
  });
  it("loop points sit ON the program terminator (zenith ~90)", () => {
    const loop = greylineLoop(EPOCH);
    expect(loop).toHaveLength(144);
    let worst = 0;
    for (const p of loop) {
      const z = solarZenithDeg(p.lat, p.lon, EPOCH);
      worst = Math.max(worst, Math.abs(z - 90));
    }
    // Independent check with the program's own sun: band is honest.
    expect(worst).toBeLessThan(2.5);
  });
});

describe("greyRibbon (O6.2 overlay geometry)", () => {
  it("edges sit at +/- half-width from the terminator", () => {
    const { inner, outer } = greyRibbon(EPOCH);
    expect(inner).toHaveLength(144);
    expect(outer).toHaveLength(144);
    let worstR = 0;
    let worstIn = 0;
    let worstOut = 0;
    for (let i = 0; i < 144; i += 4) {
      for (const [v, tag] of [[inner[i], "in"], [outer[i], "out"]] as const) {
        const r = Math.hypot(v[0], v[1], v[2]);
        worstR = Math.max(worstR, Math.abs(r - 1));
        const ll = vec3ToLatLon(v[0], v[1], v[2]);
        const z = solarZenithDeg(ll.lat, ll.lon, EPOCH);
        const d = Math.abs(Math.abs(z - 90) - GREY_HALF_WIDTH_DEG);
        if (tag === "in") worstIn = Math.max(worstIn, d);
        else worstOut = Math.max(worstOut, d);
      }
    }
    expect(worstR).toBeLessThan(1e-9); // unit sphere preserved
    expect(worstIn).toBeLessThan(2.5); // inner edge ~7.5 deg off terminator
    expect(worstOut).toBeLessThan(2.5); // outer edge ~7.5 deg off terminator
  });
});

describe("countGreySpots (O6.3 superposition)", () => {
  it("counts only band midpoints", () => {
    const s = getSunInfo(EPOCH);
    // A spot straddling the subsolar point is full day, not grey.
    const day = [{ txLat: s.subsolarLat, txLon: s.subsolarLon, rxLat: s.subsolarLat, rxLon: s.subsolarLon }];
    expect(countGreySpots(day, EPOCH)).toBe(0);
    // Antisolar midpoint is night, not grey.
    const night = [{ txLat: -s.subsolarLat, txLon: s.subsolarLon + 180, rxLat: -s.subsolarLat, rxLon: s.subsolarLon + 180 }];
    expect(countGreySpots(night, EPOCH)).toBe(0);
  });
  it("empty list -> 0", () => {
    expect(countGreySpots([], EPOCH)).toBe(0);
  });
});
