/**
 * TU W-4 replay largo (clase C1): sampleStationAt sobre historia dispersa
 * 168 h (serie LGDC por ionograma, no cadencia fija). Pines: clamp en
 * extremos, lerp en huecos grandes, fallback a foF2 sin historia. Vitest.
 */
import { describe, expect, it } from "vitest";
import {
  sampleStationAt,
  replayAdvance,
  replaySliderOffset,
  DEFAULT_SETTINGS,
  STATION_POINT_REF,
  stationPointSizeClamp,
  type IonosondeStation,
} from "../../components/ionosphere/types";

const T0 = Date.parse("2026-10-05T12:00:00Z");
const H = 3600_000;

function station(history: { dtH: number; foF2: number }[], foF2: number | null = 7): IonosondeStation {
  return {
    code: "EB040",
    name: "ROQUETES",
    lat: 40.8,
    lon: 0.5,
    foF2,
    muf3000: null,
    history: history.map((p) => ({
      t: new Date(T0 + p.dtH * H).toISOString().replace(".000Z", "Z"),
      foF2: p.foF2,
    })),
    foE: null,
    foF1: null,
    hmF2: null,
    B0: null,
    B1: null,
    stale: false,
  };
}

describe("replay: historia dispersa 168h", () => {
  // ~15 ionogramas/día: huecos de varias horas.
  const s = station([
    { dtH: 0, foF2: 6 },
    { dtH: 9, foF2: 9 },
    { dtH: 30, foF2: 5 },
    { dtH: 150, foF2: 8 },
  ]);
  it("clamp antes del primero y despues del ultimo", () => {
    expect(sampleStationAt(s, T0 - H)).toBe(6);
    expect(sampleStationAt(s, T0 + 200 * H)).toBe(8);
  });
  it("lerp en hueco grande (9h->30h al 50%)", () => {
    expect(sampleStationAt(s, T0 + 19.5 * H)).toBeCloseTo(7, 9);
  });
  it("valor exacto en ionograma", () => {
    expect(sampleStationAt(s, T0 + 30 * H)).toBe(5);
  });
  it("sin historia -> foF2 actual", () => {
    expect(sampleStationAt(station([], 7.5), T0 + 100 * H)).toBe(7.5);
  });
  it("hueco con cero -> toma el positivo", () => {
    const z = station([
      { dtH: 0, foF2: 0 },
      { dtH: 10, foF2: 8 },
    ]);
    expect(sampleStationAt(z, T0 + 5 * H)).toBe(8);
  });
});

describe("replay: avance automatico (App.cpp:2139-2141)", () => {
  // p3-216: default speed 2 == App.cpp:284.
  it("default speed 2", () => {
    expect(DEFAULT_SETTINGS.replaySpeed).toBe(2);
  });
  // 1x = 20 min/s: 0.5 s -> 10 min.
  it("avanza 10 min por tick a 1x", () => {
    expect(replayAdvance(1000, 1, 0.5, 10080, true)).toBe(990);
  });
  it("velocidad escala (4x -> 40 min)", () => {
    expect(replayAdvance(1000, 4, 0.5, 10080, true)).toBe(960);
  });
  it("con loop envuelve al fondo", () => {
    expect(replayAdvance(5, 1, 0.5, 10080, true)).toBe(10080);
  });
  it("sin loop fija en 0 (presente)", () => {
    expect(replayAdvance(5, 1, 0.5, 10080, false)).toBe(0);
  });
  it("clamp superior", () => {
    expect(replayAdvance(20000, 1, 0.5, 10080, true)).toBe(10080);
  });
});

describe("settings E-tail o6: point-size (App.cpp:4293)", () => {
  it("default 11 == base 140 del shader", () => {
    expect(DEFAULT_SETTINGS.pointSize).toBe(11);
    expect(STATION_POINT_REF).toBe(11);
  });
  it("clamp [2,30]", () => {
    expect(stationPointSizeClamp(-5)).toBe(2);
    expect(stationPointSizeClamp(0)).toBe(2);
    expect(stationPointSizeClamp(11)).toBe(11);
    expect(stationPointSizeClamp(30)).toBe(30);
    expect(stationPointSizeClamp(99)).toBe(30);
  });
});

describe("TimeBar slider: mapeo espejo (quirk 326/328)", () => {
  const MAX = 10080; // 168 h
  it("extremos: derecha = «ahora» (0 min), izquierda = −168 h", () => {
    expect(replaySliderOffset(MAX, MAX)).toBe(0);
    expect(replaySliderOffset(MAX, 0)).toBe(MAX);
  });
  it("caso −2 h del smoke: pulgar a 9960 -> 120 min atras, y el pulgar no salta", () => {
    const raw = 9960;
    const rp = replaySliderOffset(MAX, raw);
    expect(rp).toBe(120);
    expect(replaySliderOffset(MAX, rp)).toBe(raw); // value={minutesBack} == raw
  });
  it("es su propia inversa: posicion -> minutos -> posicion estable", () => {
    for (const pos of [0, 5, 120, 5040, 9960, 10075, MAX]) {
      expect(replaySliderOffset(MAX, replaySliderOffset(MAX, pos))).toBe(pos);
    }
  });
});
