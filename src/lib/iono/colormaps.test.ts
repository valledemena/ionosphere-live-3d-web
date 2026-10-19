/**
 * TU W-3 colormaps (spec 162 P1): pines PROPIOS (no hay TU C++ dedicado para
 * Colormap.h). Pinea la semantica porteada de colormap::buildPalette y su
 * alineacion con sampleColormap (mismo juego de stops). Vitest.
 */
import { describe, expect, it } from "vitest";
import { buildPalette, sampleColormap, type ColormapName } from "./colormaps";

const NAMES: ColormapName[] = ["viridis", "inferno", "plasma", "turbo", "aurora"];

describe("colormaps: buildPalette", () => {
  it("longitud n*3 y extremos == primer/ultimo stop (5 digitos por la guarda)", () => {
    const p = buildPalette("viridis", 9);
    expect(p.length).toBe(27);
    expect(p[0]).toBeCloseTo(0.267, 5);
    expect(p[1]).toBeCloseTo(0.004, 5);
    expect(p[2]).toBeCloseTo(0.329, 5);
    expect(p[24]).toBeCloseTo(0.993, 5);
    expect(p[25]).toBeCloseTo(0.906, 5);
    expect(p[26]).toBeCloseTo(0.144, 5);
  });

  it("nombre desconocido -> viridis", () => {
    expect(buildPalette("nope", 5)).toEqual(buildPalette("viridis", 5));
  });

  it("las 5 paletas tienen extremos validos en [0,1]", () => {
    for (const name of NAMES) {
      const p = buildPalette(name, 17);
      expect(p.length).toBe(51);
      for (const v of p) expect(v >= -1e-9 && v <= 1 + 1e-9).toBe(true);
    }
  });

  it("consistencia con sampleColormap en la misma malla", () => {
    for (const name of NAMES) {
      const n = 33;
      const p = buildPalette(name, n);
      let max = 0;
      for (let i = 0; i < n; i++) {
        const [r, g, b] = sampleColormap(name, i / (n - 1));
        max = Math.max(max, Math.abs(p[i * 3] - r), Math.abs(p[i * 3 + 1] - g), Math.abs(p[i * 3 + 2] - b));
      }
      expect(max).toBeLessThan(1e-9);
    }
  });

  it("aurora (5 stops) interpola el verde neon a mitad", () => {
    const p = buildPalette("aurora", 5);
    // t=0.5 cae en el stop central (0.05, 0.65, 0.15) salvo la guarda 1e-6
    // del denominador (misma que el C++): pin con 5 digitos.
    expect(p[6]).toBeCloseTo(0.05, 5);
    expect(p[7]).toBeCloseTo(0.65, 5);
    expect(p[8]).toBeCloseTo(0.15, 5);
  });
});
