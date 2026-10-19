/**
 * TU W-3 density volume (spec 162 P1): pines PROPIOS contra el oraculo
 * (src/Ionosphere/DensityVolume.h, norma 144; no hay TU C++ dedicado para
 * este modulo). Pinea layout, alturas, direccion del motor, dia/noche,
 * picos derivados, TEC y muestreo. Vitest.
 */
import { describe, expect, it } from "vitest";
import {
  VOL_ALT_MAX_KM,
  VOL_ALT_MIN_KM,
  VOL_ALT_RES,
  VOL_LAT_RES,
  VOL_LOG_MIN,
  VOL_LOG_RANGE,
  VOL_LON_RES,
  VOL_PEAK_FLOOR,
  CHAPMAN_WINNER_COLORS,
  applyDayNight,
  densityDir,
  extractPeakGrids,
  integrateTEC,
  sampleVolume,
  volumeAltKm,
  volumeIndex,
  volumeModeIndex,
  volumeOpacityClamp,
  type DensityVolume,
} from "./densityVolume";

function blankVolume(): DensityVolume {
  return {
    lonRes: 0,
    latRes: 0,
    altRes: 0,
    altMinKm: VOL_ALT_MIN_KM,
    altMaxKm: VOL_ALT_MAX_KM,
    data: [],
    layer: [],
    valid: false,
    timestamp: 0,
  };
}

describe("densityVolume: layout y constantes", () => {
  it("pines del oraculo 72x72x48, alt 60..500, log 8..12.5, suelo 8.5", () => {
    expect([VOL_LON_RES, VOL_LAT_RES, VOL_ALT_RES]).toEqual([72, 72, 48]);
    expect([VOL_ALT_MIN_KM, VOL_ALT_MAX_KM]).toEqual([60, 500]);
    expect(VOL_LOG_MIN).toBe(8);
    expect(VOL_LOG_MIN + VOL_LOG_RANGE).toBeCloseTo(12.5, 12);
    expect(VOL_PEAK_FLOOR).toBe(8.5);
  });

  it("volumeIndex == data[(a*H+y)*W+x]", () => {
    const W = 72;
    const H = 72;
    expect(volumeIndex(0, 0, 0, W, H)).toBe(0);
    expect(volumeIndex(1, 0, 0, W, H)).toBe(1);
    expect(volumeIndex(0, 1, 0, W, H)).toBe(W);
    expect(volumeIndex(0, 0, 1, W, H)).toBe(W * H);
  });

  it("volumeAltKm: extremos, n<=1 y malla densa abajo (^1.5)", () => {
    expect(volumeAltKm(0, 48, 60, 500)).toBe(60);
    expect(volumeAltKm(47, 48, 60, 500)).toBe(500);
    expect(volumeAltKm(0, 1, 60, 500)).toBe(60);
    const dLo = volumeAltKm(1, 48, 60, 500) - volumeAltKm(0, 48, 60, 500);
    const dHi = volumeAltKm(47, 48, 60, 500) - volumeAltKm(46, 48, 60, 500);
    expect(dHi > dLo).toBe(true);
  });
});

describe("densityVolume: direccion del motor", () => {
  it("(0,0) -> -X, (0,90E) -> +Z, polo -> +Y, unitaria", () => {
    const a = densityDir(0, 0);
    expect(a[0]).toBeCloseTo(-1, 9);
    expect(a[1]).toBeCloseTo(0, 9);
    expect(a[2]).toBeCloseTo(0, 9);
    const b = densityDir(0, 90);
    expect(b[2]).toBeCloseTo(1, 9);
    const c = densityDir(90, 33);
    expect(c[1]).toBeCloseTo(1, 9);
  });
});

describe("densityVolume: applyDayNight", () => {
  it("subsolar intacto, antisolar apaga E/F1", () => {
    // 1x1: celda (lat 0, lon 0) -> dir (-1,0,0).
    const day = [{ NmE: 100, NmF1: 200, hasE: true, hasF1: true }];
    applyDayNight(day, 1, 1, -1, 0, 0);
    expect(day[0].NmE).toBe(100);
    expect(day[0].NmF1).toBe(200);
    expect(day[0].hasE && day[0].hasF1).toBe(true);
    const night = [{ NmE: 100, NmF1: 200, hasE: true, hasF1: true }];
    applyDayNight(night, 1, 1, 1, 0, 0);
    expect(night[0].NmE).toBe(0);
    expect(night[0].NmF1).toBe(0);
    expect(night[0].hasE || night[0].hasF1).toBe(false);
  });

  it("terminador parcial: e == 2/27 (mismo smoothstep del C++)", () => {
    const t = [{ NmE: 100, NmF1: 200, hasE: true, hasF1: true }];
    applyDayNight(t, 1, 1, 0, 1, 0); // dot = 0
    expect(t[0].NmE).toBeCloseTo((100 * 2) / 27, 6);
    expect(t[0].hasE).toBe(true);
  });

  it("rejilla de tamano erroneo -> no toca nada", () => {
    const p = [{ NmE: 5, NmF1: 6, hasE: true, hasF1: true }];
    applyDayNight(p, 2, 2, -1, 0, 0);
    expect(p[0].NmE).toBe(5);
  });
});

describe("densityVolume: extractPeakGrids (shells derivadas)", () => {
  it("pico interior simetrico: logNe exacto y hm en el punto medio", () => {
    const W = 2;
    const H = 2;
    const A = 5;
    const data = new Array(W * H * A).fill(0);
    data[(2 * H + 0) * W + 0] = 1;
    const v: DensityVolume = {
      lonRes: W,
      latRes: H,
      altRes: A,
      altMinKm: 60,
      altMaxKm: 500,
      data,
      layer: [],
      valid: true,
      timestamp: 7,
    };
    const out = extractPeakGrids(v);
    expect(out.logNe.valid && out.hmKm.valid).toBe(true);
    expect(out.logNe.width).toBe(W);
    expect(out.logNe.values[0]).toBe(12.5);
    const x0 = volumeAltKm(1, A, 60, 500);
    const x2 = volumeAltKm(3, A, 60, 500);
    expect(out.hmKm.values[0]).toBeCloseTo((x0 + x2) / 2, 9);
    expect(out.hmKm.values[0] > x0 && out.hmKm.values[0] < x2).toBe(true);
    // Columna plana a cero -> hueco (logNe 8.0 < 8.5, hm 0).
    expect(out.logNe.values[1]).toBe(8);
    expect(out.hmKm.values[1]).toBe(0);
    expect(out.logNe.timestamp).toBe(7);
  });

  it("volumen invalido -> rejillas invalidas", () => {
    const out = extractPeakGrids(blankVolume());
    expect(out.logNe.valid || out.hmKm.valid).toBe(false);
  });
});

describe("densityVolume: integrateTEC y sampleVolume", () => {
  it("columna uniforme n=0 -> TEC == 1e8 * 440000 / 1e16", () => {
    const W = 2;
    const H = 2;
    const A = 8;
    const v: DensityVolume = {
      lonRes: W,
      latRes: H,
      altRes: A,
      altMinKm: 60,
      altMaxKm: 500,
      data: new Array(W * H * A).fill(0),
      layer: [],
      valid: true,
      timestamp: 0,
    };
    expect(integrateTEC(v, 0, 0)).toBeCloseTo(0.0044, 9);
    expect(integrateTEC(v, -1, 0)).toBe(0);
    expect(integrateTEC(blankVolume(), 0, 0)).toBe(0);
  });

  it("campo constante -> la muestra vale la constante", () => {
    const W = 3;
    const H = 3;
    const A = 3;
    const v: DensityVolume = {
      lonRes: W,
      latRes: H,
      altRes: A,
      altMinKm: 60,
      altMaxKm: 500,
      data: new Array(W * H * A).fill(0.37),
      layer: [],
      valid: true,
      timestamp: 0,
    };
    expect(sampleVolume(v, 10.5, -30.25, 200)).toBeCloseTo(0.37, 12);
    expect(sampleVolume(blankVolume(), 0, 0, 200)).toBe(0);
  });
});

describe("densityVolume: params de render F2 (VolumeRenderer.h:31-37)", () => {
  it("modo density->0, chapman->1", () => {
    expect(volumeModeIndex("density")).toBe(0);
    expect(volumeModeIndex("chapman")).toBe(1);
  });
  it("opacidad clamp [0,3]", () => {
    expect(volumeOpacityClamp(-1)).toBe(0);
    expect(volumeOpacityClamp(0)).toBe(0);
    expect(volumeOpacityClamp(1)).toBe(1);
    expect(volumeOpacityClamp(2.5)).toBe(2.5);
    expect(volumeOpacityClamp(9)).toBe(3);
  });
  it("colores Chapman == VOL_FRAG (D/E/F1/F2)", () => {
    expect(CHAPMAN_WINNER_COLORS).toEqual([
      [1.0, 0.55, 0.1],
      [0.2, 0.85, 0.3],
      [1.0, 0.9, 0.2],
      [0.2, 0.8, 1.0],
    ]);
  });
});
