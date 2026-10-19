/**
 * TU geografico W-3 (ruling 174 P1): el subsolar decodificado en marco
 * motor, cenit ~0 en el subsolar y mediodia del lado verdadero. Vitest.
 * Ancla H1-261 (veredicto 262): 2026-10-07T12:00Z -> (-5.62, -3.04)
 * (antes (-5.79, -3.07) con el signo J2000 erroneo; el valor nuevo esta
 * anclado al J2000.0 absoluto de abajo, no al oraculo compilado).
 */
import { describe, expect, it } from "vitest";
import { densityDir } from "./densityVolume";
import { getSunInfo, motorToLatLon, solarZenithDeg } from "./solar";

const EPOCH_12Z = Date.UTC(2026, 9, 7, 12, 0, 0) / 1000; // 1791374400

describe("solar: marco motor", () => {
  it("subsolar 12:00Z en lon 0+-6 (verdad -3.04)", () => {
    const s = getSunInfo(EPOCH_12Z);
    expect(Math.abs(s.subsolarLon)).toBeLessThan(6);
    expect(s.subsolarLon).toBeCloseTo(-3.04, 1);
    expect(s.subsolarLat).toBeCloseTo(-5.62, 1);
  });

  it("anclaje absoluto J2000.0 (H1-261): j2000 == 0", () => {
    // Unix 946728000 == 2000-01-01T12:00Z == J2000.0 por definicion
    // (GMST = 280.46061837 por IAU). Con el signo erroneo esto daba
    // 21915.0 dias (60 anos julianos); corregido da el sol verdadero
    // de perihelio: declinacion ~-23.03 (oblicuidad de enero) y lon
    // ~+0.83 (EoT ~-3.5 min). Puerto Python independiente: exacto.
    const s = getSunInfo(946728000);
    expect(s.subsolarLat).toBeCloseTo(-23.03, 2);
    expect(s.subsolarLon).toBeCloseTo(0.83, 2);
  });

  it("motorToLatLon invierte densityDir", () => {
    for (const [la, lo] of [[0, 0], [40, -3], [-30, 150], [80, 45]] as const) {
      const [x, y, z] = densityDir(la, lo);
      const g = motorToLatLon(x, y, z);
      expect(g.lat).toBeCloseTo(la, 9);
      expect(g.lon).toBeCloseTo(lo, 9);
    }
  });

  it("cosChi ~1 en la celda subsolar (mismo marco ambos lados)", () => {
    const s = getSunInfo(EPOCH_12Z);
    const [cx, cy, cz] = densityDir(s.subsolarLat, s.subsolarLon);
    const dot = cx * s.dir[0] + cy * s.dir[1] + cz * s.dir[2];
    expect(dot).toBeGreaterThan(0.999);
  });

  it("mediodia del modelo del lado verdadero (cenit ~0 en subsolar)", () => {
    const s = getSunInfo(EPOCH_12Z);
    expect(solarZenithDeg(s.subsolarLat, s.subsolarLon, EPOCH_12Z)).toBeLessThan(5);
  });
});
