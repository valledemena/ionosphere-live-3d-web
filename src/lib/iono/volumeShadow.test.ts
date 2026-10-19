/**
 * TU W-3 sombra (spec 158 sec.5.1, TU OBLIGATORIO): replica los pines del
 * TU C++ (drop 133, tests/test_volume_shadow.cpp, norma 144). Vitest.
 * Marco: sol en +X, esfera interior r = 1 + 60/6371 (60 km sobre r = 1).
 */
import { describe, expect, it } from "vitest";
import { SHADOW_GUARD, shadowed } from "./volumeShadow";

const LX = 1.0;
const LY = 0.0;
const LZ = 0.0;
const K_INNER = 1.0 + 60.0 / 6371.0;

describe("volume_shadow: casos estructurales", () => {
  it("subsolar iluminado (el planeta queda detras)", () => {
    expect(shadowed(1.05 * LX, 0, 0, LX, LY, LZ, K_INNER)).toBe(false);
  });

  it("antisolar en sombra (el rayo al sol cruza la esfera)", () => {
    expect(shadowed(-1.05 * LX, 0, 0, LX, LY, LZ, K_INNER)).toBe(true);
  });

  it("limbo iluminado (rayo tangencial, sin interseccion)", () => {
    expect(shadowed(0, 1.05, 0, LX, LY, LZ, K_INNER)).toBe(false);
  });

  it("frontera exacta t0==0 -> luz (la guarda protege el borde)", () => {
    expect(shadowed(-K_INNER * LX, 0, 0, LX, LY, LZ, K_INNER)).toBe(false);
  });

  it("la guarda es 1e-4", () => {
    expect(SHADOW_GUARD).toBe(1e-4);
  });
});

describe("volume_shadow: monotonia dia->noche", () => {
  it("una sola transicion luz->sombra en el ecuador solar", () => {
    let flips = 0;
    let prev = false;
    let prevInit = false;
    for (let i = 0; i <= 36; i++) {
      const a = (i * Math.PI) / 36; // 0 = subsolar
      const s = shadowed(1.05 * Math.cos(a), 1.05 * Math.sin(a), 0, LX, LY, LZ, K_INNER);
      if (prevInit && s !== prev) flips++;
      prev = s;
      prevInit = true;
    }
    expect(flips).toBe(1);
  });
});
