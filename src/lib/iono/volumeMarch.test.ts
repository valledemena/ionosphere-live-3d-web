/**
 * TU W-3 march CPU (spec 181 P1): paridad del camino completo contra la
 * estructura del oraculo (volFragSrc, norma 144; sin TU C++ dedicado para
 * este modulo). Pines estructurales + contraste dia/noche + convergencia.
 * Vitest.
 */
import { describe, expect, it } from "vitest";
import {
  MARCH_EARLY_ALPHA,
  MARCH_ISO,
  MARCH_ISO_WIDTH,
  MARCH_LAYER_COLORS,
  MARCH_MIN_ALPHA,
  MARCH_OPACITY_SCALE,
  MARCH_STEPS,
  marchRay,
  raySphereT,
  texelAltKm,
} from "./volumeMarch";
import { volumeAltKm } from "./densityVolume";
import type { DensityVolume } from "./densityVolume";

function mkVol(fill: number, layerFill = 0): DensityVolume {
  const W = 4, H = 4, A = 4;
  return {
    lonRes: W,
    latRes: H,
    altRes: A,
    altMinKm: 60,
    altMaxKm: 500,
    data: new Array(W * H * A).fill(fill),
    layer: new Array(W * H * A).fill(layerFill),
    valid: true,
    timestamp: 0,
  };
}

// Rayo fijo del TU: (0,0,3) -> (0,0,-1), inner 1.0, outer 1.5.
const RO: [number, number, number] = [0, 0, 3];
const RD: [number, number, number] = [0, 0, -1];
const BASE = { innerR: 1.0, outerR: 1.5 };

describe("volumeMarch: constantes 1:1 del oraculo", () => {
  it("defaults del header + iso + capas + early-outs", () => {
    expect(MARCH_STEPS).toBe(64);
    expect(MARCH_OPACITY_SCALE).toBe(1);
    expect(MARCH_ISO_WIDTH).toBe(0.02);
    expect(MARCH_EARLY_ALPHA).toBe(0.98);
    expect(MARCH_MIN_ALPHA).toBe(0.001);
    expect([...MARCH_ISO]).toEqual([0.556, 0.667, 0.778]);
    expect(MARCH_LAYER_COLORS[3]).toEqual([0.2, 0.8, 1.0]);
  });

  it("raySphereT en eje: t0/t1 exactos + miss", () => {
    const s = raySphereT(0, 0, 3, 0, 0, -1, 1);
    expect(s.hit).toBe(true);
    expect(s.t0).toBe(2);
    expect(s.t1).toBe(4);
    expect(raySphereT(0, 0, 3, 0, 1, 0, 1).hit).toBe(false);
  });
});

describe("volumeMarch: convencion z por centros de texel (n1-182)", () => {
  it("fracciones de control 0.375/0.625 + bordes puros", () => {
    // A=4 como la sonda HW [10,85,170,250]: gz = r*4-0.5 -> niveles 1.0/2.0.
    expect(texelAltKm(0.375, 4, 60, 500)).toBe(volumeAltKm(1, 4, 60, 500));
    expect(texelAltKm(0.625, 4, 60, 500)).toBe(volumeAltKm(2, 4, 60, 500));
    expect(texelAltKm(0, 4, 60, 500)).toBe(volumeAltKm(0, 4, 60, 500));
    expect(texelAltKm(1, 4, 60, 500)).toBe(volumeAltKm(3, 4, 60, 500));
  });

  it("marcha radial distingue A-0.5 de A-1 (gradiente por niveles)", () => {
    const W = 2, H = 2, A = 8;
    const data: number[] = [];
    const layer: number[] = [];
    for (let a = 0; a < A; a++)
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          data.push(a / (A - 1));
          layer.push(3);
        }
    const v = {
      lonRes: W, latRes: H, altRes: A, altMinKm: 60, altMaxKm: 500,
      data, layer, valid: true, timestamp: 0,
    };
    const r = marchRay(v, [0, 0, 3], [0, 0, -1], {
      innerR: 1.0, outerR: 1.5, sunDir: [0, 0, 1], steps: 64,
    });
    expect(r).not.toBe(null);
    // Valor medido con el fix (convencion GL); el puente viejo (A-1) daba
    // alpha 0.9821625695088864 en este mismo setup: divergencia amplia.
    expect(Math.abs(r!.alpha - 0.9821625695088864)).toBeGreaterThan(1e-6);
    expect(r!.alpha > 0 && r!.alpha <= 1).toBe(true);
  });
});

describe("volumeMarch: camino completo", () => {
  it("descartes: volumen invalido, rayo fuera, opacidad 0", () => {
    expect(marchRay({ ...mkVol(0.5), valid: false }, RO, RD, { ...BASE, sunDir: [0, 0, 1] })).toBe(null);
    expect(marchRay(mkVol(0.5), [0, 0, 3], [0, 1, 0], { ...BASE, sunDir: [0, 0, 1] })).toBe(null);
    expect(marchRay(mkVol(0.5), RO, RD, { ...BASE, sunDir: [0, 0, 1], opacityScale: 0 })).toBe(null);
  });

  it("saturacion densa: alfa > 0.98 con hue viridis", () => {
    const r = marchRay(mkVol(1), RO, RD, { ...BASE, sunDir: [0, 0, 1] });
    expect(r).not.toBe(null);
    expect(r!.alpha).toBeGreaterThan(0.98);
    expect(r!.color[0] > r!.color[1] && r!.color[1] > r!.color[2]).toBe(true);
  });

  it("sombra dia/noche: mismo rayo, sol invertido -> null", () => {
    const day = marchRay(mkVol(0.5), RO, RD, { ...BASE, sunDir: [0, 0, 1] });
    expect(day).not.toBe(null);
    expect(day!.alpha).toBeGreaterThan(0);
    const night = marchRay(mkVol(0.5), RO, RD, { ...BASE, sunDir: [0, 0, -1] });
    expect(night).toBe(null);
  });

  it("determinista: misma llamada, mismo resultado", () => {
    const o = { ...BASE, sunDir: [0, 0, 1] as [number, number, number], px: 7, py: 13 };
    expect(marchRay(mkVol(0.5), RO, RD, o)).toEqual(marchRay(mkVol(0.5), RO, RD, o));
  });

  it("modo capas: hue cian F2 + iso ilumina", () => {
    const lay = marchRay(mkVol(0.5, 3), RO, RD, { ...BASE, sunDir: [0, 0, 1], colorMode: 1 });
    expect(lay).not.toBe(null);
    expect(lay!.color[2] > lay!.color[1] && lay!.color[1] > lay!.color[0]).toBe(true);
    const off = marchRay(mkVol(0.667), RO, RD, { ...BASE, sunDir: [0, 0, 1] });
    const on = marchRay(mkVol(0.667), RO, RD, { ...BASE, sunDir: [0, 0, 1], isoOn: true });
    expect(off && on).toBeTruthy();
    const sum = (c: readonly number[]) => c[0] + c[1] + c[2];
    expect(sum(on!.color) > sum(off!.color)).toBe(true);
  });
});
