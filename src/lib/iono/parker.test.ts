import { describe, expect, it } from "vitest";
import {
  spiralLagDeg,
  spiralPoints,
  sectorPolarity,
  findCrossings,
  selectMagSource,
  SIDEREAL_ROTATION_DAYS,
} from "./parker";

describe("Parker 1958 (transcripcion exacta)", () => {
  it("rotacion sideral pineada 25.38 d", () => {
    expect(SIDEREAL_ROTATION_DAYS).toBe(25.38);
  });
  it("angulo a 1 UA con 400 km/s ~= 61.4 grados", () => {
    // Transito 1.496e8/400/86400 = 4.3287 d; 4.3287/25.38*360 = 61.41.
    expect(spiralLagDeg(400, 1)).toBeCloseTo(61.4, 0);
    expect(spiralLagDeg(800, 1)).toBeCloseTo(30.7, 0);
  });
  it("el brazo pasa por la Tierra y el pie queda a +lag", () => {
    const pts = spiralPoints(400, 64);
    expect(pts).toHaveLength(65);
    const atEarth = pts.reduce((a, b) => (Math.abs(b.r - 1) < Math.abs(a.r - 1) ? b : a));
    expect(Math.abs(atEarth.r - 1)).toBeLessThan(0.02);
    expect(atEarth.phi).toBeCloseTo(0, 0); // muestra mas cercana a 1 UA
    expect(pts[0].phi).toBeCloseTo(58.3, 0); // pie a 0.05 UA: lag(1)-lag(0.05)
    expect(pts[0].r).toBeCloseTo(0.05, 6);
  });
  it("sin viento no hay espiral", () => {
    expect(spiralLagDeg(0, 1)).toBe(0);
    expect(spiralLagDeg(-5, 1)).toBe(0);
  });
});

describe("sector Bx (convencion declarada +X GSE = toward)", () => {  it("polaridad", () => {
    expect(sectorPolarity(4.47)).toBe("toward");
    expect(sectorPolarity(-2.1)).toBe("away");
    expect(sectorPolarity(0)).toBe("toward");
  });
  it("cruces calculados del dato (O12)", () => {
    const s = [
      { t: 1, bx: 3 },
      { t: 2, bx: 2 },
      { t: 3, bx: -1 },
      { t: 4, bx: -2 },
      { t: 5, bx: 1 },
    ];
    expect(findCrossings(s)).toEqual([3, 5]);
    expect(findCrossings([{ t: 1, bx: 3 }, { t: 2, bx: 4 }])).toEqual([]);
  });
});

describe("selectMagSource (P1-284: feed descendente multi-nave)", () => {
  // Feed como el real: descendente, SOLAR1 activa + ACE inactiva.
  const T = 1_000_000_000;
  const rows = [
    { t: T + 300, bx: -9, active: false }, // ACE nueva (inactiva)
    { t: T + 300, bx: 4.4, active: true }, // SOLAR1 nueva
    { t: T + 200, bx: -8, active: false },
    { t: T + 200, bx: 4.5, active: true },
    { t: T + 100, bx: null, active: true },
  ];
  it("solo fuente activa, ascendente, Bx del extremo nuevo", () => {
    const s = selectMagSource(rows, 3, T + 400);
    expect(s).toHaveLength(2);
    expect(s[0]).toEqual({ t: T + 200, bx: 4.5 });
    expect(s[1]).toEqual({ t: T + 300, bx: 4.4 });
    expect(findCrossings(s)).toEqual([]); // sin mezcla no hay cruces falsos
  });
  it("fallback a todas si ninguna activa (declarado)", () => {
    const dead = rows.map((r) => ({ ...r, active: false }));
    expect(selectMagSource(dead, 3, T + 400)).toHaveLength(4);
  });
});
