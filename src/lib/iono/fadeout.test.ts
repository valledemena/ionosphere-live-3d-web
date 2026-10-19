import { describe, expect, it } from "vitest";
import {
  waitSpiesNu,
  waitSpiesOmega,
  waitSpiesNe,
  pcaDb,
  latestProtonFlux,
  fadeoutGrid,
  fadeoutStats,
  WS_BETA_DAY,
  WS_BETA_NIGHT,
  PCA_PFU_THRESHOLD,
  FADEOUT_W,
  FADEOUT_H,
} from "./fadeout";

describe("Wait-Spies TN300 (transcripcion exacta del PDF NIST)", () => {
  it("eq(2): nu(70) == 5e6 y decae con 0.15/km", () => {
    expect(waitSpiesNu(70)).toBe(5e6);
    expect(waitSpiesNu(80)).toBeCloseTo(5e6 * Math.exp(-1.5), 6);
  });
  it("eq(3): wr(70) == 2.5e5 (dia beta=0.3)", () => {
    expect(WS_BETA_DAY).toBe(0.3);
    expect(WS_BETA_NIGHT).toBe(0.5);
    expect(waitSpiesOmega(70, 0.3, 70)).toBe(2.5e5);
    expect(waitSpiesOmega(80, 0.3, 70)).toBeCloseTo(2.5e5 * Math.exp(3), 3);
  });
  it("Ne(70, dia) autoconsistente del libro ~= 3.93e8 m^-3", () => {
    const ne = waitSpiesNe(70, 0.3, 70);
    expect(ne).toBeCloseTo(3.93e8, -6); // 2 digitos: 3.9e8
    expect(ne).toBeGreaterThan(1e8);
    expect(ne).toBeLessThan(1e9);
  });
});

describe("PCA polar (umbrales pineados)", () => {
  it("umbral NOAA S1 = 10 pfu", () => {
    expect(PCA_PFU_THRESHOLD).toBe(10);
  });
  it("gate: bajo umbral o fuera del casquete -> 0", () => {
    expect(pcaDb(9.9, 80)).toBe(0);
    expect(pcaDb(100, 59.9)).toBe(0);
    expect(pcaDb(100, -59.9)).toBe(0);
  });
  it("sobre umbral y en casquete: 2 dB/decada declarada", () => {
    expect(pcaDb(10, 80)).toBe(0);
    expect(pcaDb(100, 80)).toBeCloseTo(2, 10);
    expect(pcaDb(100, -80)).toBeCloseTo(2, 10);
  });
  it("ultimo flujo >=10 MeV util", () => {
    const s = [
      { t: 1000, f: 3 },
      { t: 2000, f: 25 },
      { t: 3000, f: 12 },
    ];
    expect(latestProtonFlux(s, 2500)).toBe(25);
    expect(latestProtonFlux(s, 500)).toBe(0);
  });
});

const EPOCH = Date.parse("2026-10-14T12:00:00Z") / 1000;

describe("fadeoutGrid (S&W pineado por celda + PCA)", () => {
  it("dimensiones y fila 0 = norte", () => {
    const g = fadeoutGrid(1e-6, 2, 0, EPOCH);
    expect(g.length).toBe(FADEOUT_W * FADEOUT_H);
    expect(FADEOUT_W).toBe(72);
    expect(FADEOUT_H).toBe(36);
  });
  it("noche NUNCA afectada por X-ray (O2 negativo)", () => {
    // X1 brutal: aun asi, celdas con cosChi<0 solo llevan 0 SID.
    const g = fadeoutGrid(1e-4, 2, 0, EPOCH);
    // Polo norte nocturno en octubre (subsolar ~-8 lat): celda (lat 87.5).
    expect(g[0 * FADEOUT_W + 36]).toBe(0);
  });
  it("subsolar arde con X1 y el maximo cae de dia", () => {
    const g = fadeoutGrid(1e-4, 2, 0, EPOCH);
    const st = fadeoutStats(g, FADEOUT_W, FADEOUT_H, 1e-4);
    // A subsolar = 4.5*(1e-4/1e-6)^0.75 = 4.5*100^0.75 ~= 142 dB.
    expect(st.maxDb).toBeGreaterThan(100);
    expect(st.maxLat).toBeLessThan(30);
    expect(st.maxLat).toBeGreaterThan(-30);
    expect(st.quiet).toBe(false);
  });
  it("quiet sin flare elegible (O2 negativo)", () => {
    const g = fadeoutGrid(2e-6, 2, 0, EPOCH);
    const st = fadeoutStats(g, FADEOUT_W, FADEOUT_H, 2e-6);
    expect(st.quiet).toBe(true);
    expect(st.maxDb).toBeLessThan(10);
  });
  it("PCA suma en casquete con protones altos", () => {
    const g0 = fadeoutGrid(2e-6, 2, 5, EPOCH);
    const g1 = fadeoutGrid(2e-6, 2, 100, EPOCH);
    // Celda polo norte (fila 0): g1-g0 == 2 dB exactos.
    expect(g1[0] - g0[0]).toBeCloseTo(2, 10);
  });
  it("determinista: mismo input -> mismo grid", () => {
    const a = fadeoutGrid(2.5e-5, 4, 12, EPOCH);
    const b = fadeoutGrid(2.5e-5, 4, 12, EPOCH);
    expect(a).toEqual(b);
  });
});
