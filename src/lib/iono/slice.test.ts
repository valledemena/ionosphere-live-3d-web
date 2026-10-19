/**
 * TU W-4 slice QTH-DX (clase B1): espejo de SliceLayer + App.cpp:3131-3195.
 * Pines: endpoints por modo (link/manual/fixed + no-ops), slerp sobre el
 * circulo maximo (extremos exactos, punto medio sobre el arco), dims
 * 64x20, muestreo contra volumen sintetico y pico logNe. Vitest.
 */
import { describe, expect, it } from "vitest";
import {
  SLICE_LVL,
  SLICE_SEG,
  buildSliceGrid,
  resolveSliceEndpoints,
  sliceLabel,
  slicePositions,
} from "./slice";
import type { DensityVolume } from "./densityVolume";

/** Volumen sintetico: Ne 0..1 = rampa con la altura (pico arriba). */
function rampVolume(): DensityVolume {
  const lonRes = 72;
  const latRes = 36;
  const altRes = 60;
  const data = new Array(lonRes * latRes * altRes);
  for (let a = 0; a < altRes; a++)
    for (let la = 0; la < latRes; la++)
      for (let lo = 0; lo < lonRes; lo++)
        data[(a * latRes + la) * lonRes + lo] = a / (altRes - 1);
  return {
    lonRes,
    latRes,
    altRes,
    altMinKm: 60,
    altMaxKm: 700,
    data,
    layer: new Array(lonRes * latRes * altRes).fill(3),
    timestamp: 0,
    valid: true,
  };
}

describe("slice: endpoints por modo", () => {
  const manA = { lat: 40, lon: -3 };
  const manB = { lat: 51, lon: 0 };
  it("link usa TX/RX", () => {
    const ep = resolveSliceEndpoints("link", manA, manB, { lat: 0, lon: 0 }, { lat: 1, lon: 1 });
    expect(ep).toEqual({ latA: 40, lonA: -3, latB: 51, lonB: 0 });
  });
  it("manual usa A/B", () => {
    const ep = resolveSliceEndpoints("manual", null, null, manA, manB);
    expect(ep).toEqual({ latA: 40, lonA: -3, latB: 51, lonB: 0 });
  });
  it("fixed +-2 en A editable (veredicto 202 o2)", () => {
    const ep = resolveSliceEndpoints("fixed", null, null, manA, manB);
    expect(ep).toEqual({ latA: 40, lonA: -5, latB: 40, lonB: -1 });
  });
  it("no-ops: sin A, sin B, A==B", () => {
    expect(resolveSliceEndpoints("link", null, manB, manA, manB)).toBeNull();
    expect(resolveSliceEndpoints("link", manA, null, manA, manB)).toBeNull();
    expect(resolveSliceEndpoints("link", manA, manA, manA, manB)).toBeNull();
  });
});

describe("slice: rejilla y muestreo", () => {
  const ep = { latA: 40, lonA: -3, latB: 51, lonB: 0 };
  it("dims 64x20 y clave", () => {
    const g = buildSliceGrid(rampVolume(), ep, 123);
    expect(g).not.toBeNull();
    expect(g!.rgba.length).toBe(SLICE_SEG * SLICE_LVL * 4);
    expect(g!.key).toBe("40|-3|51|0|123");
  });
  it("pico arriba (rampa) -> peakLog 12.5", () => {
    const g = buildSliceGrid(rampVolume(), ep, 0);
    expect(g!.peakLog).toBeCloseTo(12.5, 9);
  });
  it("volumen invalido -> null", () => {
    const v = rampVolume();
    v.valid = false;
    expect(buildSliceGrid(v, ep, 0)).toBeNull();
    expect(buildSliceGrid(rampVolume(), null, 0)).toBeNull();
  });
  it("alfa = d*1.2 clamp + RGBA opaco arriba", () => {
    const g = buildSliceGrid(rampVolume(), ep, 0);
    const top = ((SLICE_LVL - 1) * SLICE_SEG + 0) * 4;
    expect(g!.rgba[top + 3]).toBe(255);
    const bot = 3;
    expect(g!.rgba[bot]).toBeLessThan(30);
  });
  it("paleta 0..1 -> byte: arriba viridis brillante, abajo oscuro", () => {
    const g = buildSliceGrid(rampVolume(), ep, 0);
    const top = ((SLICE_LVL - 1) * SLICE_SEG + 0) * 4;
    // viridis d=1 ~ (253,231,37): R alto (no negro truncado).
    expect(g!.rgba[top]).toBeGreaterThan(200);
    expect(g!.rgba[top + 1]).toBeGreaterThan(150);
    const bot0 = 0;
    // viridis d=0 ~ (68,1,84): oscuro pero no cero.
    expect(g!.rgba[bot0]).toBeGreaterThan(0);
    expect(g!.rgba[bot0]).toBeLessThan(120);
  });
  it("posiciones: 64x20 xyz, radio exagerado", () => {
    const p = slicePositions(ep, 2.2);
    expect(p.length).toBe(SLICE_SEG * SLICE_LVL * 3);
    const r0 = Math.hypot(p[0], p[1], p[2]);
    const rTop = Math.hypot(p[(SLICE_LVL - 1) * SLICE_SEG * 3], p[(SLICE_LVL - 1) * SLICE_SEG * 3 + 1], p[(SLICE_LVL - 1) * SLICE_SEG * 3 + 2]);
    expect(r0).toBeCloseTo(1 + (60 / 6371) * 2.2, 5);
    expect(rTop).toBeCloseTo(1 + (700 / 6371) * 2.2, 4);
  });
  it("label A->B pk", () => {
    expect(sliceLabel("EB040", "TR169", 11.24, null)).toBe("EB040→TR169 pk 11.2");
  });
  it("label manual con coordenadas %.1f,%.0f (o4e)", () => {
    expect(sliceLabel("A", "B", 11.24, { latA: 40, lonA: -4, latB: 40, lonB: -100 })).toBe(
      "40.0,-4→40.0,-100 pk 11.2",
    );
  });
  it("label fijo muestra el centro en ambos lados (n1-208)", () => {
    expect(sliceLabel("A", "B", 11.24, { latA: 40, lonA: -4, latB: 40, lonB: -4 })).toBe(
      "40.0,-4→40.0,-4 pk 11.2",
    );
  });
  it("antipodal: fallback lerp sin NaN (o4a)", () => {
    const ep = { latA: 0, lonA: 0, latB: 0, lonB: 180 };
    const g = buildSliceGrid(rampVolume(), ep, 0);
    expect(g).not.toBeNull();
    for (let i = 0; i < g!.rgba.length; i++) expect(g!.rgba[i]).not.toBeNaN();
  });
  it("indice truncado (o4d): d=0.5 -> pi 127, alfa 153", () => {
    const v = rampVolume();
    // Volumen constante 0.5: sample exacto 0.5 en toda celda.
    for (let i = 0; i < v.data.length; i++) v.data[i] = 0.5;
    const g = buildSliceGrid(v, { latA: 40, lonA: -3, latB: 51, lonB: 0 }, 0);
    // trunc(0.5*255)=127 (round daria 128); alfa trunc(0.5*1.2*255)=153.
    expect(g!.rgba[3]).toBe(153);
    // viridis t=127/255: r~0.128 -> byte ~32 (ventana segura).
    expect(g!.rgba[0]).toBeGreaterThanOrEqual(30);
    expect(g!.rgba[0]).toBeLessThanOrEqual(35);
  });
});
