/**
 * TU W-4 ref-shells/iso/labels (clase F1): espejo RefShells.h/.cpp +
 * VolumeRenderer iso + App.cpp:4230-4236/5470-5525. Vitest.
 */
import { describe, expect, it } from "vitest";
import { vec3ToLatLon } from "./geo";
import {
  ISO_LEVELS,
  ISO_WIDTH,
  REF_COLORS,
  labelCulled,
  midnightLon,
  refAltitudes,
  refKey,
} from "./refshells";

describe("refshells: alturas dinámicas (App.cpp:2487)", () => {
  it("E110 fijo, F1 max(150,0.8mh), F2 mh", () => {
    expect(refAltitudes([280, 300, 320])).toEqual({ e: 110, f1: 240, f2: 300 });
  });
  it("F1 piso 150 con mh bajo (mediana superior)", () => {
    expect(refAltitudes([150, 160])).toEqual({ e: 110, f1: 150, f2: 160 });
  });
  it("vacío o <0.5 -> null (guard)", () => {
    expect(refAltitudes([])).toBeNull();
    expect(refAltitudes([0, -3])).toBeNull();
    expect(refAltitudes([0.2])).toBeNull();
  });
  it("clave incluye exageración", () => {
    const a = refAltitudes([300])!;
    expect(refKey(a, 2.2)).toBe("110|240|300|2.2");
    expect(refKey(a, 2.2)).not.toBe(refKey(a, 5));
  });
});

describe("refshells: constantes del oráculo", () => {
  it("colores E/F1/F2", () => {
    expect(REF_COLORS.e).toEqual([0.1, 0.45, 0.2]);
    expect(REF_COLORS.f1).toEqual([0.5, 0.42, 0.1]);
    expect(REF_COLORS.f2).toEqual([0.5, 0.22, 0.07]);
  });
  it("iso 10.5/11/11.5 ancho 0.02", () => {
    expect(ISO_LEVELS).toEqual([10.5, 11, 11.5]);
    expect(ISO_WIDTH).toBe(0.02);
  });
});

describe("labels: cull y medianoche", () => {
  it("dorso y fuera de NDC ocultan", () => {
    expect(labelCulled(0.1, 0, 0)).toBe(true);
    expect(labelCulled(0.5, 1.2, 0)).toBe(true);
    expect(labelCulled(0.5, 0, -1.2)).toBe(true);
    expect(labelCulled(0.5, 0.3, -0.4)).toBe(false);
  });
  it("medianoche == vec3ToLatLon del antisolar", () => {
    const dirs = [
      [-1, 0, 0],
      [0.3, 0.5, -0.8],
      [0.1, -0.9, 0.4],
    ];
    for (const [x, y, z] of dirs) {
      const r = Math.hypot(x, y, z);
      const inv = vec3ToLatLon(-x / r, -y / r, -z / r);
      expect(midnightLon(x / r, y / r, z / r)).toBeCloseTo(inv.lon, 9);
    }
  });
});
