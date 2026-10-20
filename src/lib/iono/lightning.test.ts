import { describe, expect, it } from "vitest";
import {
  newestPerSat,
  parseGlmList,
  glmStatus,
  parseNwsAlerts,
  whistlerPath,
  type GlmGranule,
} from "./lightning";
import { traceConjugate } from "./magnetosphere";

// Items REALES del bucket noaa-goes19 el 2026-10-14 (forma pineada).
const XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  "<ListBucketResult>" +
  "<Key>GLM-L2-LCFA/2026/287/07/OR_GLM-L2-LCFA_G19_s20262870700000_e20262870700200_c20262870700224.nc</Key>" +
  "<LastModified>2026-10-14T07:00:23.000Z</LastModified>" +
  '<ETag>"abc"</ETag><Size>471987</Size>' +
  "<Key>GLM-L2-LCFA/2026/287/07/OR_GLM-L2-LCFA_G19_s20262870700200_e20262870700400_c20262870700421.nc</Key>" +
  "<LastModified>2026-10-14T07:00:45.000Z</LastModified>" +
  '<ETag>"def"</ETag><Size>443421</Size>' +
  "</ListBucketResult>";

const T0 = Date.parse("2026-10-14T07:00:00Z");

describe("parseGlmList (forma S3 pineada)", () => {
  it("extrae granulos con tiempos y satelite", () => {
    const g = parseGlmList(XML, "G19");
    expect(g).toHaveLength(2);
    expect(g[0].sat).toBe("G19");
    expect(g[0].start).toBe(T0 + 20_000);
    expect(g[0].end).toBe(T0 + 40_000);
    expect(g[0].size).toBe(443421);
    // Cadencia continua 20 s (no orientada a eventos: declarado).
    expect(g[0].start - g[1].end).toBe(0);
  });
  it("tolera ChecksumAlgorithm/ChecksumType reales (P1-276)", () => {
    // Forma REAL ListObjectsV2 (evidencia del veredicto 277).
    const xml =
      "<Key>GLM-L2-LCFA/2026/287/07/OR_GLM-L2-LCFA_G19_s20262870700000_e20262870700200_c20262870700224.nc</Key>" +
      "<LastModified>2026-10-14T07:00:23.000Z</LastModified>" +
      "<ETag>abc</ETag>" +
      "<ChecksumAlgorithm>CRC32</ChecksumAlgorithm>" +
      "<ChecksumType>FULL_OBJECT</ChecksumType>" +
      "<Size>471987</Size>";
    const g = parseGlmList(xml, "G19");
    expect(g).toHaveLength(1);
    expect(g[0].start).toBe(T0);
    expect(g[0].size).toBe(471987);
  });
  it("basura -> []", () => {
    expect(parseGlmList("", "G19")).toEqual([]);
    expect(parseGlmList("<xml/>", "G18")).toEqual([]);
  });
});

describe("glmStatus (frescura, no actividad)", () => {
  it("fresco bajo 10 min, rancio despues", () => {
    const g = parseGlmList(XML, "G19");
    const fresh = glmStatus(g, "G19", T0 + 5 * 60_000);
    expect(fresh.fresh).toBe(true);
    expect(fresh.granules).toBe(2);
    const stale = glmStatus(g, "G19", T0 + 3600_000);
    expect(stale.fresh).toBe(false);
    expect(stale.ageSec).toBeGreaterThan(3000);
  });
  it("sin granulos -> no fresco honesto", () => {
    const s = glmStatus([], "G18", T0);
    expect(s.fresh).toBe(false);
    expect(s.ageSec).toBeNull();
  });
});

// Aviso REAL NWS el 2026-10-14 (forma pineada: Polygon + areaDesc).
const NWS = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        id: "urn:test:001",
        event: "Severe Thunderstorm Warning",
        areaDesc: "Wilbarger, TX",
        onset: "2026-10-14T17:03:00-05:00",
        ends: "2026-10-14T17:45:00-05:00",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[-99.8, 34.1], [-99.2, 34.1], [-99.2, 33.7], [-99.8, 33.7], [-99.8, 34.1]]],
      },
    },
    {
      type: "Feature",
      properties: { event: "Tornado Warning", areaDesc: "X" },
      geometry: null,
    },
  ],
};

describe("parseNwsAlerts (cuspides honestas)", () => {
  it("poligono activo -> centroide; sin geometria se descarta", () => {
    const now = Date.parse("2026-10-14T17:10:00-05:00");
    const cells = parseNwsAlerts(NWS, now);
    expect(cells).toHaveLength(1);
    expect(cells[0].lat).toBeCloseTo(33.9, 1);
    expect(cells[0].lon).toBeCloseTo(-99.56, 1); // media de anillo cerrado
    expect(cells[0].area).toBe("Wilbarger, TX");
  });
  it("caducado no dispara sprites (negativo O8)", () => {
    const cells = parseNwsAlerts(NWS, Date.parse("2026-10-14T18:00:00-05:00"));
    expect(cells).toEqual([]);
  });
});

describe("whistlerPath (linea de campo REAL de B(r))", () => {
  it("la linea pasa por el punto y su conjugado", () => {
    const pts = whistlerPath(33.9, -99.5);
    expect(pts.length).toBeGreaterThan(10);
    // Extremos en superficie (r ~= 1): foco y conjugado.
    const r0 = Math.hypot(...pts[0]);
    const r1 = Math.hypot(...pts[pts.length - 1]);
    expect(r0).toBeCloseTo(1, 1);
    expect(r1).toBeCloseTo(1, 1);
    // El conjugado de traceConjugate cae sobre la linea (mismo L).
    const c = traceConjugate(33.9, -99.5);
    expect(c.L).toBeGreaterThan(1);
    expect(c.L).toBeLessThan(3);
  });
});

// TU drop 349 (C): recorte por satelite — ambos GLM sobreviven al recorte
// y el primero de cada lista es el mas reciente (bug del slice(0,40)
// global que dejaba el panel sin G18).
describe("newestPerSat (drop 349: G18 sobrevive)", () => {
  const g = (sat: string, start: number): GlmGranule => ({ sat, start, end: start + 20_000, size: 1 });

  it("ambos satelites sobreviven y el primero de cada uno es el mas reciente", () => {
    const g19 = [g("G19", 300), g("G19", 200), g("G19", 100)];
    const g18 = [g("G18", 280), g("G18", 180)];
    const out = newestPerSat(g19, g18);
    expect(out.filter((x) => x.sat === "G19").length).toBe(3);
    expect(out.filter((x) => x.sat === "G18").length).toBe(2);
    expect(out[0]).toMatchObject({ sat: "G19", start: 300 });
    expect(out[3]).toMatchObject({ sat: "G18", start: 280 });
  });

  it("recorta a perSat por satelite (no global)", () => {
    const g19 = Array.from({ length: 50 }, (_, i) => g("G19", 1000 - i));
    const g18 = Array.from({ length: 50 }, (_, i) => g("G18", 900 - i));
    const out = newestPerSat(g19, g18, 40);
    expect(out.filter((x) => x.sat === "G19").length).toBe(40);
    expect(out.filter((x) => x.sat === "G18").length).toBe(40);
    // el global slice(0,40) antiguo dejaria G18 con 0
    const legacy = [...g19, ...g18].sort((a, b) => b.start - a.start).slice(0, 40);
    expect(legacy.filter((x) => x.sat === "G18").length).toBe(0);
  });

  it("G18 vacio no rompe", () => {
    const out = newestPerSat([g("G19", 50)], []);
    expect(out).toHaveLength(1);
    expect(out[0].sat).toBe("G19");
  });
});
