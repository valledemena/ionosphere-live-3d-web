/**
 * TU W-4 magnetosfera #4 (ruling 252): Shue-1998 transcrito, IGRF dipolar,
 * B(r) servicio, traza al conjugado, monotonías O4.2. Vitest.
 *
 * O4.1: tabla >=5 puntos (Bz,Dp) verificable contra Shue 1997/1998.
 * O4.2: monotonía física automática (r0 cae con Dp y Bz sur; la cola
 *       abre con Bz sur). O4.3: tilt 9-12°, polo N ártico.
 */
import { describe, expect, it } from "vitest";
import { vec3ToLatLon } from "./geo";
import {
  DIPOLE_B0_NT,
  DIPOLE_POLE_N,
  DIPOLE_TILT_DEG,
  dipoleMoment,
  dynamicPressure,
  fieldMagnitudeNt,
  magnetoKey,
  magnetopauseMesh,
  magnetosphereField,
  shueAlpha,
  shueR0,
  shueRadius,
  tailStretch,
  traceConjugate,
} from "./magnetosphere";

describe("magnetosfera: Shue O4.1 (tabla pineada)", () => {
  // (Bz, Dp) -> r0 esperado (Shue-1998 verificado a mano, tolerancia 0.05).
  const table: [number, number, number][] = [
    [0, 2, 10.25],
    [-5, 4, 8.83],
    [-10, 8, 7.15],
    [5, 1.5, 10.81],
    [0, 8, 8.31],
    [-2, 2, 10.14],
  ];
  for (const [bz, dp, want] of table) {
    it(`r0 Bz=${bz} Dp=${dp} ~= ${want}`, () => {
      expect(shueR0(bz, dp)).toBeCloseTo(want, 1);
    });
  }
  it("bandas de cordura: medios 9-12, tormenta 6-8.5", () => {
    expect(shueR0(0, 2)).toBeGreaterThan(9);
    expect(shueR0(0, 2)).toBeLessThan(12);
    expect(shueR0(-10, 8)).toBeGreaterThan(6);
    expect(shueR0(-10, 8)).toBeLessThan(8.5);
  });
  it("alfa ~0.59 en calma", () => {
    expect(shueAlpha(0, 2)).toBeCloseTo(0.59, 2);
  });
  it("radio subsolar == r0 y crece a flanco", () => {
    expect(shueRadius(0, 0, 2)).toBeCloseTo(shueR0(0, 2), 9);
    expect(shueRadius(1.2, 0, 2)).toBeGreaterThan(shueR0(0, 2));
  });
});

describe("magnetosfera: monotonía O4.2 (automática)", () => {
  it("r0 cae con Dp", () => {
    expect(shueR0(0, 8)).toBeLessThan(shueR0(0, 2));
    expect(shueR0(-5, 8)).toBeLessThan(shueR0(-5, 2));
  });
  it("r0 cae con Bz sur", () => {
    expect(shueR0(-10, 2)).toBeLessThan(shueR0(0, 2));
    expect(shueR0(0, 2)).toBeLessThan(shueR0(5, 2));
  });
  it("alfa abre (crece) con Bz sur", () => {
    expect(shueAlpha(0, 2)).toBeLessThan(shueAlpha(-10, 2));
  });
  it("cola declarada: stretch >=1, crece con sur", () => {
    expect(tailStretch(0)).toBe(1);
    expect(tailStretch(5)).toBe(1);
    expect(tailStretch(-5)).toBeGreaterThan(1);
  });
});

describe("magnetosfera: dipolo IGRF O4.3", () => {
  it("tilt 9-12 grados", () => {
    expect(DIPOLE_TILT_DEG).toBeGreaterThan(9);
    expect(DIPOLE_TILT_DEG).toBeLessThan(12);
  });
  it("polo N en el Ártico", () => {
    expect(DIPOLE_POLE_N.lat).toBeGreaterThan(66.5);
  });
  it("momento unitario", () => {
    const m = dipoleMoment();
    expect(Math.hypot(m[0], m[1], m[2])).toBeCloseTo(1, 12);
  });
  it("|B| ecuador magnético ~B0 y polo ~2x (dipolo)", () => {
    // Perpendicular a m en marco WEB: m×Y normalizado (dot nulo exacto).
    const me = vec3ToLatLon(0.95509, 0, -0.29635);
    expect(fieldMagnitudeNt(me.lat, me.lon, 0)).toBeCloseTo(DIPOLE_B0_NT, 0);
    expect(fieldMagnitudeNt(80, 0, 0)).toBeGreaterThan(1.5 * DIPOLE_B0_NT);
  });
});

describe("magnetosfera: traza al conjugado O4.5", () => {
  it("N->S espejado (misma línea L)", () => {
    const a = traceConjugate(60, 10);
    expect(a.lat).toBeLessThan(0);
    expect(a.L).toBeGreaterThan(2.5);
    expect(a.L).toBeLessThan(6);
    const b = traceConjugate(a.lat, a.lon);
    expect(b.lat).toBeCloseTo(60, 0);
  });
  it("Dp desde n y v", () => {
    expect(dynamicPressure(5, 400)).toBeCloseTo(1.34, 1);
  });
  it("servicio B(r) finito y dirigido", () => {
    const B = magnetosphereField(40, 0, 300);
    expect(B.every(isFinite)).toBe(true);
    expect(Math.hypot(B[0], B[1], B[2])).toBeGreaterThan(0);
  });
});

describe("magnetosfera: malla magnetopausa", () => {
  it("9 anillos x49 + 8 meridianos x31", () => {
    const m = magnetopauseMesh(0, 2);
    expect(m.rings.length).toBe(9);
    expect(m.rings[0].length).toBe(49);
    expect(m.meridians.length).toBe(8);
    expect(m.meridians[0].length).toBe(31);
  });
  it("primer anillo sobre la superficie Shue (θ=15°)", () => {
    const m = magnetopauseMesh(0, 2);
    const th = (15 * Math.PI) / 180;
    const want = shueRadius(th, 0, 2) * Math.cos(th);
    expect(m.rings[0][0][0]).toBeCloseTo(want, 6);
    expect(m.r0).toBeCloseTo(shueR0(0, 2), 9);
  });
  it("cola estirada en noche con Bz sur (más antisolar)", () => {
    const calm = magnetopauseMesh(0, 2);
    const storm = magnetopauseMesh(-10, 8);
    const minX = (mm: { meridians: [number, number, number][][] }) =>
      Math.min(...mm.meridians.flat().map((p) => p[0]));
    expect(minX(storm)).toBeLessThan(minX(calm));
  });
  it("clave estable y sensible", () => {
    expect(magnetoKey(0, 2)).toBe(magnetoKey(0.001, 2.001));
    expect(magnetoKey(0, 2)).not.toBe(magnetoKey(-5, 2));
  });
});
