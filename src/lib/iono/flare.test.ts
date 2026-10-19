import { describe, expect, it } from "vitest";
import {
  flareClass,
  sampleXrayAt,
  flareState,
  parseFlr,
  matchFlr,
  FLUX_M1,
  type XrayPt,
} from "./flare";

// Serie con forma real de xrays-6-hour.json (GOES primario 0.1-0.8nm).
const T = Date.parse("2026-10-14T08:00:00Z");
function pt(min: number, f: number): XrayPt {
  return { t: T + min * 60_000, f };
}
const SERIES: XrayPt[] = [
  pt(0, 2e-6),
  pt(10, 3e-6),
  pt(20, 2.5e-5), // M2.5
  pt(30, 1.2e-5),
  pt(40, 4e-6),
  pt(50, 2e-6),
];

describe("flareClass (espejo xrayClass de la ruta)", () => {
  it("letras y magnitudes", () => {
    expect(flareClass(2.5e-5)).toBe("M2.5");
    expect(flareClass(1e-4)).toBe("X1.0");
    expect(flareClass(5e-6)).toBe("C5.0");
    expect(flareClass(0)).toBe("\u2014");
  });
});

describe("sampleXrayAt (determinista replay)", () => {
  it("lerp + clamps", () => {
    expect(sampleXrayAt(SERIES, T)).toBe(2e-6);
    expect(sampleXrayAt(SERIES, T + 50 * 60_000)).toBe(2e-6);
    expect(sampleXrayAt(SERIES, T - 1000)).toBe(2e-6);
    expect(sampleXrayAt(SERIES, T + 15 * 60_000)).toBeCloseTo(1.4e-5, 12);
    expect(sampleXrayAt([], T)).toBe(0);
  });
});

describe("flareState (O3.1 gatillo >= M1)", () => {
  it("detecta el evento M2.5 con pico y hora", () => {
    const s = flareState(SERIES, T + 50 * 60_000);
    expect(s.isEvent).toBe(true);
    expect(s.peak).toBe(2.5e-5);
    expect(s.peakTime).toBe(T + 20 * 60_000);
    expect(s.cls).toBe("M2.5");
    // mapa log C1->0, X1->1: M2.5 -> (log10(2.5e-5)+6)/2 ~= 0.699.
    expect(s.level).toBeCloseTo(0.699, 2);
  });
  it("bajo M1 no es evento (nivel bajo pero no cero)", () => {
    const s = flareState(SERIES.slice(0, 2), T + 10 * 60_000);
    expect(s.isEvent).toBe(false);
    expect(s.level).toBeLessThan(0.5);
  });
  it("ventana de 3 h: el pico viejo no contamina", () => {
    const s = flareState(SERIES, T + 4 * 3600_000);
    expect(s.peak).toBe(0);
    expect(s.isEvent).toBe(false);
  });
  it("umbral exacto M1", () => {
    expect(FLUX_M1).toBe(1e-5);
    expect(flareState([{ t: T, f: 1e-5 }], T).isEvent).toBe(true);
  });
});

// Fixture REAL: respuesta del CCMC el 2026-10-14 (forma pineada).
const FLR_C79 = {
  flrID: "2026-10-07T12:49:00-FLR-001",
  catalog: "M2M_CATALOG",
  instruments: [{ displayName: "GOES-P: EXIS 1.0-8.0" }],
  beginTime: "2026-10-07T12:49Z",
  peakTime: "2026-10-07T13:17Z",
  endTime: "2026-10-07T13:44Z",
  classType: "C7.9",
  sourceLocation: "N10W04",
  activeRegionNum: 14549,
  note: "",
  link: "https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/49010/-1",
  linkedEvents: null,
  sentNotifications: null,
  submissionTime: "2026-10-07T18:12Z",
  versionId: 1,
};

describe("parseFlr + matchFlr (O3.4)", () => {
  it("parsea el fixture C7.9", () => {
    const [f] = parseFlr([FLR_C79]);
    expect(f.classType).toBe("C7.9");
    expect(f.srcLoc).toBe("N10W04");
    expect(f.ar).toBe(14549);
    expect(f.peak).toBe(Date.parse("2026-10-07T13:17:00Z"));
    expect(f.link).toContain("ccmc.gsfc.nasa.gov/DONKI/view/FLR");
  });
  it("basura defensiva -> []", () => {
    expect(parseFlr(null)).toEqual([]);
    expect(parseFlr([null, 7])).toHaveLength(0);
  });
  it("ventana del replay: dentro/fuera", () => {
    const fs = parseFlr([FLR_C79]);
    const t0 = Date.parse("2026-10-07T00:00:00Z");
    const t1 = Date.parse("2026-10-08T00:00:00Z");
    expect(matchFlr(fs, t0, t1)).toHaveLength(1);
    expect(matchFlr(fs, t1, t1 + 3600_000)).toHaveLength(0);
  });
});
