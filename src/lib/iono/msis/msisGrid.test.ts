// ionosphere-live-3d — drop 9d TU: shell Tn/rho grid over msiscalc.
// Official pin: test vector file-row 150 (alt 250 km, lat -86.4,
// lon 45; ref T 1002.65, rho 0.6501E-13 g/cm^3).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createMsisState, msisinit } from "./msisInit";
import {
  buildMsisGrid,
  msisPoint,
  msisGridStats,
  gridLat,
  gridLon,
  resolveMsisInputs,
  createGfnCache,
} from "./msisGrid";

function parmBytes(): Uint8Array {
  const buf = readFileSync(new URL("./msis21.parm", import.meta.url));
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

describe("9d shell grid", () => {
  it("north-first cell-center geometry", () => {
    expect(gridLat(18, 0)).toBe(85);
    expect(gridLat(18, 17)).toBe(-85);
    expect(gridLon(36, 0)).toBe(-175);
    expect(gridLon(36, 35)).toBe(175);
  });
  it("reference quiet defaults are echoed, never live", () => {
    const r = resolveMsisInputs({ w: 1, h: 1, altKm: 300, doy: 1, utsec: 0 });
    expect(r).toEqual({ f107a: 150, f107: 150, ap: [4, 0, 0, 0, 0, 0, 0] });
  });
  it("point query matches official vector (row 150)", () => {
    const state = createMsisState();
    msisinit(state, { parmBytes: parmBytes() });
    const cache = createGfnCache();
    const f = Math.fround;
    const p = msisPoint(state, cache, {
      w: 1, h: 1, altKm: f(250), doy: 126, utsec: f(47520),
      lat: f(-86.4), lon: f(45), f107a: f(169.2), f107: f(160.7),
      ap: [f(5), 0, 0, 0, 0, 0, 0],
    });
    expect(Math.abs(p.tn - 1002.65)).toBeLessThan(0.01);
    expect(Math.abs(p.rho - 0.6501e-13) / 0.6501e-13).toBeLessThan(1e-3);
  });
  it("grid is deterministic with sane stats", () => {
    const state = createMsisState();
    msisinit(state, { parmBytes: parmBytes() });
    const cache = createGfnCache();
    const spec = { w: 12, h: 6, altKm: 300, doy: 172, utsec: 43200 };
    const a = buildMsisGrid(state, cache, spec);
    const b = buildMsisGrid(state, cache, spec);
    expect(a.tn).toEqual(b.tn);
    expect(a.rho).toEqual(b.rho);
    const st = msisGridStats(a);
    expect(st.tnMin).toBeGreaterThan(100);
    expect(st.tnMax).toBeLessThan(3000);
    expect(st.rhoMin).toBeGreaterThan(0);
    expect(st.rhoMax).toBeLessThan(1e-6);
    expect(st.tnMean).toBeGreaterThan(st.tnMin);
  });
});
