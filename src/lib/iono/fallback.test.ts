/**
 * TU W-4 fallback kc2g (clase 244, ruling 243): parse, lon, EG931,
 * frescura, precedencia, caché honesta, badge 5 estados. Vitest.
 * Fixtures con la forma real verificada en vivo (stations.json).
 */
import { describe, expect, it } from "vitest";
import {
  cacheable,
  CACHE_MAX_AGE_MIN,
  filterFresh,
  isCacheUsable,
  normalizeLon,
  parseKc2gRow,
  resolveSource,
  sourceBadge,
} from "./fallback";

const NOW = Date.parse("2026-10-11T12:00:00Z");
const H = 3600_000;

function row(over: Record<string, unknown> = {}) {
  return {
    station: { code: "EA036", name: "El Arenosillo, Spain", longitude: "353.3", latitude: "37.1" },
    fof2: 9.35,
    hmf2: 243.234,
    foe: 1.95,
    fof1: null,
    mufd: 32.753,
    time: "2026-10-11T11:25:01",
    ...over,
  };
}

describe("fallback: parse kc2g", () => {
  it("fila real completa", () => {
    const s = parseKc2gRow(row())!;
    expect(s.code).toBe("EA036");
    expect(s.lat).toBeCloseTo(37.1, 9);
    expect(s.lon).toBeCloseTo(-6.7, 9);
    expect(s.foF2).toBe(9.35);
    expect(s.hmF2).toBeCloseTo(243.234, 9);
    expect(s.timeMs).toBe(Date.parse("2026-10-11T11:25:01Z"));
  });
  it("EG931 excluida siempre", () => {
    expect(
      parseKc2gRow(row({ station: { code: "EG931", name: "x", longitude: "0", latitude: "0" } })),
    ).toBeNull();
  });
  it("filas rotas -> null (sin código, sin coords)", () => {
    expect(parseKc2gRow(null)).toBeNull();
    expect(parseKc2gRow({})).toBeNull();
    expect(parseKc2gRow(row({ station: { code: "", name: "x", longitude: "0", latitude: "0" } }))).toBeNull();
    expect(
      parseKc2gRow(row({ station: { code: "EB040", name: "x", longitude: "no", latitude: "40" } })),
    ).toBeNull();
  });
  it("lon normalize 0-360 -> -180..180", () => {
    expect(normalizeLon("353.3")).toBeCloseTo(-6.7, 9);
    expect(normalizeLon("0.5")).toBeCloseTo(0.5, 9);
    expect(normalizeLon(262.3)).toBeCloseTo(-97.7, 9);
    expect(normalizeLon("no")).toBeNaN();
  });
});

describe("fallback: frescura y precedencia", () => {
  const mk = (ageH: number, code = "EB040") => ({
    code,
    name: code,
    lat: 0,
    lon: 0,
    foF2: 7,
    hmF2: 300,
    foE: null,
    foF1: null,
    mufd: null,
    timeMs: NOW - ageH * H,
  });
  it("corte 6 h / 24 h (futuro = fresco)", () => {
    const rows = [mk(1), mk(7), mk(30), { ...mk(1), timeMs: NOW + H }];
    expect(filterFresh(rows, NOW, 6 * H).length).toBe(2);
    expect(filterFresh(rows, NOW, 24 * H).length).toBe(3);
  });
  it("live > kc2g > cache > model", () => {
    expect(resolveSource({ live: 5, kc2g: 3, cacheAgeMin: 10 })).toBe("live");
    expect(resolveSource({ live: 0, kc2g: 3, cacheAgeMin: 10 })).toBe("kc2g");
    expect(resolveSource({ live: 0, kc2g: 0, cacheAgeMin: 10 })).toBe("cache");
    expect(resolveSource({ live: 0, kc2g: 0, cacheAgeMin: null })).toBe("model");
  });
  it("caché honesta: vacío nunca se guarda", () => {
    expect(cacheable(0)).toBe(false);
    expect(cacheable(7)).toBe(true);
  });
  it("techo 24 h (P2-245): vieja -> model", () => {
    expect(CACHE_MAX_AGE_MIN).toBe(1440);
    expect(isCacheUsable(10)).toBe(true);
    expect(isCacheUsable(1440)).toBe(true);
    expect(isCacheUsable(1441)).toBe(false);
    expect(isCacheUsable(null)).toBe(false);
    expect(resolveSource({ live: 0, kc2g: 0, cacheAgeMin: 1500 })).toBe("model");
  });
});

describe("fallback: badge 5 estados", () => {
  it("live/kc2g/cache/model/down", () => {
    expect(sourceBadge("GIRO DIDBase (live, getbest)")).toEqual({ label: "live", tone: "green" });
    expect(sourceBadge("kc2g fallback")).toEqual({ label: "kc2g", tone: "amber" });
    expect(sourceBadge("cache +25min")).toEqual({ label: "cache", tone: "slate" });
    expect(sourceBadge("model")).toEqual({ label: "model", tone: "blue" });
    expect(sourceBadge("")).toEqual({ label: "down", tone: "red" });
  });
});
