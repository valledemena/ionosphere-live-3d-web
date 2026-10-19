/**
 * TU W-2 tour (spec 152: sin TU exigido; verificacion minima de la curva
 * porteada de Tour.h para que el drop viaje con red). Vitest.
 */
import { describe, expect, it } from "vitest";
import { tourAdvance, tourCount, tourEval, tourKey, tourTotal } from "./tour";

describe("tour didactico", () => {
  it("4 tramos, 44 s en total", () => {
    expect(tourCount()).toBe(4);
    expect(tourTotal()).toBe(44);
  });

  it("t=0 -> W0 implicito 0.0/3.2, tramo 0, no done", () => {
    const s = tourEval(0);
    expect(s.ry).toBe(0);
    expect(s.dist).toBe(3.2);
    expect(s.index).toBe(0);
    expect(s.done).toBe(false);
  });

  it("mitad del tramo 0: smoothstep u=0.5 -> ry=0.3, dist intacta", () => {
    const s = tourEval(6);
    expect(s.ry).toBeCloseTo(0.3, 6);
    expect(s.dist).toBe(3.2);
    expect(s.index).toBe(0);
  });

  it("t>=44 -> done en el waypoint final 3.4/2.8", () => {
    const s = tourEval(44);
    expect(s.done).toBe(true);
    expect(s.ry).toBe(3.4);
    expect(s.dist).toBe(2.8);
    expect(s.index).toBe(3);
  });

  it("el reloj solo avanza con dato listo", () => {
    expect(tourAdvance(10, 0.5, false)).toBe(10);
    expect(tourAdvance(10, 0.5, true)).toBeCloseTo(10.5, 9);
  });

  it("tourKey sujeta indices fuera de rango", () => {
    expect(tourKey(-1)).toBe(tourKey(0));
    expect(tourKey(99)).toBe(tourKey(3));
  });
});
