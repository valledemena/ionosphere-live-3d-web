/**
 * TU W-3 rejilla de perfiles (spec 168 P1): pines del IDW oracular
 * (App.cpp:676-766, norma 144) + havDeg/modelos/dayOfYear. Vitest.
 */
import { describe, expect, it } from "vitest";
import {
  buildLivePeakGrids,
  buildLiveVolume,
  dayOfYearUtc,
  havDeg,
  interpProfiles,
  isStaleSample,
  modelFoF2Core,
  modelHmF2Core,
  STALE_AFTER_MS,
  stationToProfileSample,
  type ProfileSample,
} from "./profileGrid";
import { densityDir, extractPeakGrids } from "./densityVolume";

function station(lat: number, lon: number): ProfileSample {
  return {
    latDeg: lat,
    lonDeg: lon,
    foE: 0,
    foF1: 0,
    foF2: 10,
    hmF2: 300,
    B0: 100,
    B1: 3,
    valid: true,
    stale: false,
  };
}

describe("profileGrid: havDeg y dayOfYearUtc", () => {
  it("mismo punto 0, polo-ecuador 90, antipodas 180", () => {
    expect(havDeg(10, 20, 10, 20)).toBe(0);
    expect(havDeg(0, 0, 90, 0)).toBeCloseTo(90, 9);
    expect(havDeg(0, 0, 0, 180)).toBeCloseTo(180, 9);
  });

  it("1..366 estilo gmtime (igual que el legacy: equivalencia 170)", () => {
    expect(dayOfYearUtc(Date.UTC(2026, 0, 1) / 1000)).toBe(1);
    expect(dayOfYearUtc(Date.UTC(2025, 11, 31) / 1000)).toBe(365);
    expect(dayOfYearUtc(Date.UTC(2024, 11, 31) / 1000)).toBe(366);
  });
});

describe("profileGrid: modelos climatologicos", () => {
  it("foF2 subsolar ecuatorial medido + noche de contraste", () => {
    expect(modelFoF2Core(1, 0, 172, 150)).toBeCloseTo(12.6531942, 6);
    expect(modelFoF2Core(-1, 0, 172, 150)).toBeCloseTo(4.454, 6);
    expect(modelFoF2Core(1, 0, 172, 200) > modelFoF2Core(1, 0, 172, 100)).toBe(true);
  });

  it("hmF2 dia 250 / noche 300 exactos en ecuador", () => {
    expect(modelHmF2Core(1, 0)).toBe(250);
    expect(modelHmF2Core(-1, 0)).toBe(300);
  });
});

describe("profileGrid: stationToProfileSample", () => {
  it("null -> 0 (fondo por puertas >0); valores pasan; valid por foF2", () => {
    const s = stationToProfileSample({
      lat: 40.8, lon: 0.5, foE: null, foF1: 2.5, foF2: 8, hmF2: null, B0: 100, B1: null,
    });
    expect(s.latDeg).toBe(40.8);
    expect(s.foE).toBe(0);
    expect(s.foF1).toBe(2.5);
    expect(s.hmF2).toBe(0);
    expect(s.B1).toBe(0);
    expect(s.valid).toBe(true);
    expect(s.stale).toBe(false);
    const n = stationToProfileSample({
      lat: 0, lon: 0, foE: null, foF1: null, foF2: null, hmF2: null, B0: null, B1: null,
    });
    expect(n.valid).toBe(false);
  });

  it("muestra mapeada alimenta la rejilla (puerta a puerta)", () => {
    const g = interpProfiles(
      [
        stationToProfileSample({ lat: -90, lon: -180, foE: null, foF1: null, foF2: 10, hmF2: 300, B0: 100, B1: 3 }),
      ],
      2, 2, -1, 0, 0, 0, 150
    );
    expect(g[0].hasF2).toBe(true);
    expect(g[0].hasE).toBe(false);
  });
});

describe("profileGrid: interpProfiles", () => {
  it("sin muestras validas -> rejilla apagada", () => {
    const g = interpProfiles([], 2, 2, -1, 0, 0, 0, 150);
    expect(g.length).toBe(4);
    for (const p of g) expect(p.hasE || p.hasF1 || p.hasF2).toBe(false);
    const stale = interpProfiles([{ ...station(0, 0), stale: true }], 2, 2, -1, 0, 0, 0, 150);
    for (const p of stale) expect(p.hasF2).toBe(false);
  });

  it("estacion en esquina: celda casi-exacta a la muestra (convencion replicada)", () => {
    const g = interpProfiles([station(-90, -180)], 2, 2, -1, 0, 0, 0, 150);
    const c = g[0];
    expect(c.hasF2).toBe(true);
    // IDW con bg 0.004: el promedio ponderado redondea ~1 ulp (si la
    // convencion fuese centros, d seria 45 grados y el valor colapsaria
    // al fondo: este pin caza la convencion, no el ulp).
    expect(Math.abs(c.NmF2 / (1.24e10 * 100) - 1)).toBeLessThan(1e-12);
    expect(c.hmF2).toBeCloseTo(300, 9);
    expect(c.hasE).toBe(false);
    expect(c.NmE).toBe(0);
    expect(c.B0).toBeCloseTo(100, 9);
  });

  it("celda lejana: modelo puro (wG=0) con el mismo cosChi", () => {
    const g = interpProfiles([station(-90, -180)], 2, 2, -1, 0, 0, 0, 150);
    const far = g[3]; // esquina (lat 0, lon 0), a 90 grados
    expect(far.hasF2).toBe(true);
    const doy = 1;
    const m = modelFoF2Core(1, 0, doy, 150);
    expect(far.NmF2).toBe(1.24e10 * m * m);
    expect(far.hmF2).toBe(modelHmF2Core(1, 0));
  });
});

describe("profileGrid: buildLiveVolume (tramo visual)", () => {
  const ST = { lat: 40, lon: 0, foE: null, foF1: null, foF2: 10, hmF2: 300, B0: 100, B1: 3 };
  const SUN = densityDir(40, 0);

  it("dims, valido, layer acompana a data", () => {
    const v = buildLiveVolume([ST], 12, 6, SUN[0], SUN[1], SUN[2], 0, 150, 8, 60, 500, 1);
    expect(v.valid).toBe(true);
    expect(v.data.length).toBe(12 * 6 * 8);
    expect(v.layer.length).toBe(v.data.length);
    for (const d of v.data) expect(d >= 0 && d <= 1).toBe(true);
  });

  it("peaks derivables del volumen (misma cadena que el shell)", () => {
    const v = buildLiveVolume([ST], 12, 6, SUN[0], SUN[1], SUN[2], 0, 150, 8, 60, 500, 1);
    const pk = extractPeakGrids(v);
    expect(pk.logNe.valid && pk.hmKm.valid).toBe(true);
    expect(pk.logNe.values.length).toBe(72);
    const g = buildLivePeakGrids([ST], 12, 6, SUN[0], SUN[1], SUN[2], 0, 150, 8, 60, 500, 1);
    expect(g.fo.length).toBe(72);
  });
});

describe("profileGrid: buildLivePeakGrids (rejilla viva)", () => {
  const ST = { lat: 40, lon: 0, foE: null, foF1: null, foF2: 10, hmF2: 300, B0: 100, B1: 3 };
  const SUN = densityDir(40, 0); // subsolar sobre la estacion (dia pleno)

  it("vacia -> suelo fisico finito con dims; determinista", () => {
    const a = buildLivePeakGrids([], 12, 6, SUN[0], SUN[1], SUN[2], 0, 150);
    expect(a.w).toBe(12);
    expect(a.fo.length).toBe(72);
    for (const v of a.fo) expect(isFinite(v) && v >= 0).toBe(true);
    const b = buildLivePeakGrids([ST], 12, 6, SUN[0], SUN[1], SUN[2], 0, 150);
    const c = buildLivePeakGrids([ST], 12, 6, SUN[0], SUN[1], SUN[2], 0, 150);
    expect(b.fo).toEqual(c.fo);
  });

  it("pico diurno cerca de la estacion, suelo fisico lejos, norte arriba", () => {
    const g = buildLivePeakGrids([ST], 12, 6, SUN[0], SUN[1], SUN[2], 0, 150);
    let mx = 0;
    let mi = 0;
    for (let i = 0; i < g.fo.length; i++) {
      expect(isFinite(g.fo[i]) && isFinite(g.hm[i])).toBe(true);
      if (g.fo[i] > mx) {
        mx = g.fo[i];
        mi = i;
      }
    }
    expect(mx).toBeGreaterThan(5); // F2 medida cerca
    const row = Math.floor(mi / 12);
    expect(row < 3).toBe(true); // estacion norte -> pico en filas norte
    expect(g.hm[mi]).toBeGreaterThan(150);
    expect(g.hm[mi]).toBeLessThan(500);
  });

  it("P2-174: muerte nocturna de E (antipoda con F2 de modelo, no ~110)", () => {
    const day = { lat: 0, lon: 0, foE: 3.2, foF1: null, foF2: 8, hmF2: 280, B0: 80, B1: 3 };
    const S = densityDir(0, 0); // subsolar sobre la estacion (dia pleno)
    const g = buildLivePeakGrids([day], 12, 6, S[0], S[1], S[2], 0, 150);
    // Celda mas nocturna (min cosChi): sin applyDayNight el argmax se
    // quedaria en el pico E contaminante (~110 km); con el paso (App 2433)
    // la E muere y manda la F2 del modelo (~270-300 km).
    let best = 2;
    let bestChi = Infinity;
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 12; x++) {
        const latG = -90 + 30 * y;
        const lonG = -180 + 30 * x;
        const [cx, cy, cz] = densityDir(latG, lonG);
        const c = cx * S[0] + cy * S[1] + cz * S[2];
        if (c < bestChi) {
          bestChi = c;
          best = (6 - 1 - y) * 12 + x; // norte-primero
        }
      }
    }
    expect(bestChi).toBeLessThan(-0.9);
    expect(g.hm[best]).toBeGreaterThan(200);
  });
});

describe("profileGrid: stale por edad (banner >6 h, o5)", () => {
  const NOW = Date.parse("2026-10-09T12:00:00Z");
  const hist = (ageH: number) => [
    { t: new Date(NOW - ageH * 3600_000).toISOString(), foF2: 7 },
  ];
  it("reciente -> viva; >6 h -> stale; vacía -> viva", () => {
    expect(isStaleSample(hist(1), NOW)).toBe(false);
    expect(isStaleSample(hist(7), NOW)).toBe(true);
    expect(isStaleSample([], NOW)).toBe(false);
    expect(isStaleSample(undefined, NOW)).toBe(false);
  });
  it("STALE_AFTER_MS == 6 h", () => {
    expect(STALE_AFTER_MS).toBe(6 * 3600_000);
  });
  it("stationToProfileSample propaga stale con epoch", () => {
    const base = { lat: 40, lon: 0, foE: null, foF1: null, foF2: 7, hmF2: 300, B0: 100, B1: 3 };
    expect(stationToProfileSample({ ...base, history: hist(1) }, NOW).stale).toBe(false);
    expect(stationToProfileSample({ ...base, history: hist(30) }, NOW).stale).toBe(true);
  });
  it("stale fuera de la rejilla (puerta !stale intacta)", () => {
    const fresh = { ...stationToProfileSample(
      { lat: 0, lon: 0, foE: null, foF1: null, foF2: 10, hmF2: 300, B0: 100, B1: 3 },
    ), stale: false };
    const old = { ...fresh, stale: true };
    const gFresh = interpProfiles([fresh], 2, 2, -1, 0, 0, 0, 150);
    const gOld = interpProfiles([old], 2, 2, -1, 0, 0, 0, 150);
    const sum = (g: { NmF2: number }[]) => g.reduce((a, p) => a + p.NmF2, 0);
    expect(sum(gFresh)).toBeGreaterThan(0);
    expect(sum(gOld)).toBe(0);
  });
});
