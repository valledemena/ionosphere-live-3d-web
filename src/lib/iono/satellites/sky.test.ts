// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — TU del cielo del eco 2026 (drop 321, F2b #10, ruling
// 320). Oraculos exigidos: round-trip teme2ecef->ecef2geodetic->latLonToVec3
// consistente con geo.ts, tsince mixto (antes/despues del epoch TLE),
// ISS ~427 km y cota anti-flaky: barrido completo <2 s sobre snapshot real.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gstime, sgp4 } from "../sgp4/sgp4";
import { twoline2rv } from "../sgp4/sgpTle";
import { ecef2geodetic, teme2ecef } from "../sgp4/sgpCoord";
import { latLonToVec3, R_EARTH_KM } from "../geo";
import { SNAPSHOT_CAPTURED_AT, SNAPSHOT_FILE, parseTleCatalog } from "./catalog";
import { createSatSky, satEpochMs } from "./sky";

const snap = parseTleCatalog(
  readFileSync(
    join(process.cwd(), "src", "lib", "iono", "satellites", SNAPSHOT_FILE),
    "utf8",
  ),
);
const ISS = snap.records.find((r) => r.name.includes("ISS (ZARYA)"));
if (!ISS) throw new Error("ISS (ZARYA) no esta en el snapshot");

/** Oracullo independiente: misma ruta del ruling, sin pasar por sky.ts. */
function oracleScene(rec: { line1: string; line2: string }, epochMs: number): [number, number, number] {
  const { satrec } = twoline2rv(rec.line1, rec.line2, "wgs72", "a", { strict: true });
  const epoch = (satrec.jdsatepoch + satrec.jdsatepochF - 2440587.5) * 86_400_000;
  const tsince = (epochMs - epoch) / 60_000;
  const r = [0, 0, 0];
  const v = [0, 0, 0];
  expect(sgp4(satrec, tsince, r, v)).toBe(true);
  const gmst = gstime(2440587.5 + epochMs / 86_400_000);
  const g = ecef2geodetic(teme2ecef(r, gmst));
  return latLonToVec3(g.lat, g.lon, 1 + g.altKm / R_EARTH_KM);
}

describe("createSatSky", () => {
  it("ISS en su epoch: altitud ~427 km, sin errores, tramo valido = 1", () => {
    const sky = createSatSky([ISS]);
    sky.initStep(10_000);
    expect(sky.ready).toBe(true);
    const { satrec } = twoline2rv(ISS.line1, ISS.line2, "wgs72", "a", { strict: true });
    sky.sweep(0, 1, satEpochMs(satrec));
    const alt = (Math.hypot(sky.positions[0], sky.positions[1], sky.positions[2]) - 1) * R_EARTH_KM;
    expect(alt).toBeGreaterThan(380);
    expect(alt).toBeLessThan(470);
    expect(sky.errors).toBe(0);
    expect(sky.validCount).toBe(1);
  });

  it("oraculo: el eco coincide con la ruta geodesica del ruling (1e-5)", () => {
    const sky = createSatSky(snap.records.slice(0, 200));
    sky.initStep(10_000);
    const epochMs = Date.parse("2026-10-17T12:00:00Z");
    sky.sweep(0, 200, epochMs);
    for (const idx of [0, 5, 42, 199]) {
      const [x, y, z] = oracleScene(snap.records[idx], epochMs);
      expect(Math.abs(sky.positions[idx * 3] - x)).toBeLessThan(1e-5);
      expect(Math.abs(sky.positions[idx * 3 + 1] - y)).toBeLessThan(1e-5);
      expect(Math.abs(sky.positions[idx * 3 + 2] - z)).toBeLessThan(1e-5);
    }
    expect(sky.errors).toBe(0);
  });

  it("tsince mixto: -30 min / 0 / +30 min determinista y con orbita viva", () => {
    const sky = createSatSky([ISS]);
    sky.initStep(10_000);
    const { satrec } = twoline2rv(ISS.line1, ISS.line2, "wgs72", "a", { strict: true });
    const e = satEpochMs(satrec);
    const snapshots: Float32Array[] = [];
    for (const ms of [e - 30 * 60_000, e, e + 30 * 60_000]) {
      sky.sweep(0, 1, ms);
      const copy = Float32Array.from(sky.positions);
      const alt = (Math.hypot(copy[0], copy[1], copy[2]) - 1) * R_EARTH_KM;
      expect(alt).toBeGreaterThan(370);
      expect(alt).toBeLessThan(500);
      snapshots.push(copy);
    }
    const d = (a: Float32Array, b: Float32Array) =>
      Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    expect(d(snapshots[0], snapshots[1])).toBeGreaterThan(1e-4);
    expect(d(snapshots[1], snapshots[2])).toBeGreaterThan(1e-4);
    // Determinismo: repetir el mismo instante da la misma nube bit a bit.
    sky.sweep(0, 1, e);
    expect(Array.from(sky.positions)).toEqual(Array.from(snapshots[1]));
    expect(sky.errors).toBe(0);
  });

  it("cota anti-flaky: barrido completo del snapshot real <2 s, 0 errores", () => {
    const sky = createSatSky(snap.records);
    sky.initStep(60_000);
    expect(sky.ready).toBe(true);
    const t0 = performance.now();
    sky.sweep(0, sky.count, SNAPSHOT_CAPTURED_AT);
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(2000);
    expect(sky.errors).toBe(0);
    expect(sky.validCount).toBe(sky.count);
    for (const i of [0, 1000, sky.count - 1]) {
      expect(Number.isFinite(sky.positions[i * 3])).toBe(true);
    }
  });
});
