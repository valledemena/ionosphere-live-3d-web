// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — TU de la capa de datos del shell (drop 317, F2b #10).
// Cubre: parsers (checksum estricto), etiquetas de fuente (jamas fingir vivo),
// cadena por-origen, cache TTL, ventana negativa y sanidad del snapshot real.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SNAPSHOT_CAPTURED_AT,
  SNAPSHOT_DATE,
  SNAPSHOT_FILE,
  acquireCatalog,
  attributionFor,
  buildPayload,
  createCatalogCache,
  createFailureWindow,
  parseSatnogsTle,
  parseTleCatalog,
  sourceLabel,
} from "./catalog";

// Fixtures reales (lineas verbatim del snapshot, checksum valido).
const CAL1 = "1 00900U 64063C   26290.21310396  .00000589  00000+0  58972-3 0  9997";
const CAL2 = "2 00900  90.2209  74.5953 0024380 282.8813 198.6997 13.76733889 88218";
const ISS1 = "1 25544U 98067A   26290.17683436  .00008767  00000+0  16757-3 0  9993";
const ISS2 = "2 25544  51.6327  56.4129 0006776 273.6806  86.3408 15.48906925590665";
const TG0 = "1 69998U 26159Z   26290.03728685  .00022340  00000+0  69208-3 0  9990";
const TG2 = "2 69998  97.2871 132.3902 0000814  83.9672 276.1663 15.33453629 16576";
const CAL1_BAD = CAL1.slice(0, 68) + "8"; // checksum roto (declarado en el test)

function catalogText(triplets: [string, string, string][]): string {
  return triplets.map(([n, l1, l2]) => `${n}\n${l1}\n${l2}`).join("\n") + "\n";
}

describe("parseTleCatalog", () => {
  it("parsea tripletes validos y normaliza el nombre", () => {
    const p = parseTleCatalog(catalogText([
      ["CALSPHERE 1             ", CAL1, CAL2],
      ["ISS (ZARYA)             ", ISS1, ISS2],
    ]));
    expect(p.dropped).toBe(0);
    expect(p.records).toHaveLength(2);
    expect(p.records[0].name).toBe("CALSPHERE 1");
    expect(p.records[0].noradId).toBe("00900");
    expect(p.records[1].noradId).toBe("25544");
  });

  it("checksum estricto: descarta y cuenta, jamas auto-corrige", () => {
    const p = parseTleCatalog(catalogText([
      ["CALSPHERE 1             ", CAL1_BAD, CAL2],
      ["ISS (ZARYA)             ", ISS1, ISS2],
    ]));
    expect(p.dropped).toBe(1);
    expect(p.records).toHaveLength(1);
    expect(p.records[0].noradId).toBe("25544");
  });

  it("acepta CRLF (formato CelesTrak)", () => {
    const text = catalogText([["CALSPHERE 1 ", CAL1, CAL2]]).replace(/\n/g, "\r\n");
    const p = parseTleCatalog(text);
    expect(p.records).toHaveLength(1);
    expect(p.dropped).toBe(0);
  });

  it("texto vacio o basura -> cero registros", () => {
    expect(parseTleCatalog("").records).toHaveLength(0);
    expect(parseTleCatalog("basura\nsuelta\n").records).toHaveLength(0);
    expect(parseTleCatalog("basura\nsuelta\n").dropped).toBe(2);
  });

  it("lineas sobrantes sin triplete completo cuentan como dropped", () => {
    const p = parseTleCatalog(catalogText([["CALSPHERE 1 ", CAL1, CAL2]]) + "COLGANDO\n");
    expect(p.records).toHaveLength(1);
    expect(p.dropped).toBe(1);
  });

  it("nombre vacio -> reserva honesta NORAD <id>", () => {
    const p = parseTleCatalog(catalogText([["", CAL1, CAL2]]));
    expect(p.records[0].name).toBe("NORAD 00900");
  });
});

describe("parseSatnogsTle", () => {
  const ROW = {
    tle0: "0 ISS (ZARYA)",
    tle1: "1 25544U 98067A   26289.78971908  .00007803  00000-0  15012-3 0  9996",
    tle2: "2 25544  51.6326  58.3278 0006748 271.9059  88.1156 15.48899044590607",
    tle_source: "Space-Track.org",
    norad_cat_id: 25544,
    updated: "2026-10-17T05:24:50.723241Z",
  };

  it("parsea filas reales de SatNOGS (prefijo '0 ' limpiado)", () => {
    const p = parseSatnogsTle([ROW]);
    expect(p.records).toHaveLength(1);
    expect(p.records[0].name).toBe("ISS (ZARYA)");
    expect(p.records[0].noradId).toBe("25544");
    expect(p.dropped).toBe(0);
  });

  it("checksum roto y filas malformadas se descartan y cuentan", () => {
    const bad = { ...ROW, tle1: ROW.tle1.slice(0, 68) + "0" };
    const p = parseSatnogsTle([ROW, bad, null, 7, {}, { tle1: "x", tle2: "y" }]);
    expect(p.records).toHaveLength(1);
    expect(p.dropped).toBe(5);
  });

  it("entrada no-array -> vacio honesto sin excepcion", () => {
    const p = parseSatnogsTle({ nope: true });
    expect(p.records).toHaveLength(0);
    expect(p.dropped).toBe(0);
  });
});

describe("etiquetas de fuente (nunca fingir vivo)", () => {
  it("snapshot lleva fecha y '(no live)'; jamas dice live a secas", () => {
    const label = sourceLabel("snapshot");
    expect(label).toContain(SNAPSHOT_DATE);
    expect(label).toContain("(no live)");
    expect(label).not.toMatch(/\(live\)/);
  });

  it("las fuentes vivas si dicen (live); unavailable es estado nulo", () => {
    expect(sourceLabel("celestrak")).toBe("CelesTrak (live)");
    expect(sourceLabel("satnogs")).toBe("SatNOGS (live)");
    expect(sourceLabel("unavailable")).toBe("unavailable");
  });

  it("atribucion presente en fuentes con dato; vacia en unavailable", () => {
    expect(attributionFor("celestrak")).toContain("CelesTrak");
    expect(attributionFor("satnogs")).toContain("SatNOGS");
    expect(attributionFor("snapshot")).toContain(SNAPSHOT_DATE);
    expect(attributionFor("snapshot")).toContain("not live");
    expect(attributionFor("unavailable")).toBe("");
  });
});

describe("acquireCatalog (cadena por-origen)", () => {
  const NOW = 1_700_000_000_000;
  const PARSED = { records: [{ noradId: "25544", name: "ISS", line1: ISS1, line2: ISS2 }], dropped: 0 };

  function deps(over: Partial<Parameters<typeof acquireCatalog>[0]>) {
    return {
      fetchCelestrak: async () => null,
      fetchSatnogs: async () => null,
      loadSnapshot: () => null,
      now: () => NOW,
      ...over,
    };
  }

  it("CelesTrak vivo gana y no se tocan los demas origenes", async () => {
    let snTouched = false;
    let snapTouched = false;
    const p = await acquireCatalog(deps({
      fetchCelestrak: async () => PARSED,
      fetchSatnogs: async () => { snTouched = true; return PARSED; },
      loadSnapshot: () => { snapTouched = true; return PARSED; },
    }));
    expect(p.source).toBe("celestrak");
    expect(p.sourceLabel).toBe("CelesTrak (live)");
    expect(p.fetchedAt).toBe(NOW);
    expect(p.count).toBe(1);
    expect(snTouched).toBe(false);
    expect(snapTouched).toBe(false);
  });

  it("fallo de CelesTrak abre ventana negativa y cae a SatNOGS", async () => {
    let failed = 0;
    const p = await acquireCatalog(deps({
      fetchCelestrak: async () => { throw new Error("down"); },
      fetchSatnogs: async () => PARSED,
      markCelestrakFailed: () => { failed++; },
    }));
    expect(p.source).toBe("satnogs");
    expect(failed).toBe(1);
  });

  it("catalogo vacio cuenta como fallo del origen", async () => {
    let failed = 0;
    const p = await acquireCatalog(deps({
      fetchCelestrak: async () => ({ records: [], dropped: 3 }),
      fetchSatnogs: async () => PARSED,
      markCelestrakFailed: () => { failed++; },
    }));
    expect(p.source).toBe("satnogs");
    expect(failed).toBe(1);
  });

  it("ventana negativa abierta -> CelesTrak ni se intenta", async () => {
    let ctTouched = false;
    const p = await acquireCatalog(deps({
      fetchCelestrak: async () => { ctTouched = true; return PARSED; },
      fetchSatnogs: async () => PARSED,
      celestrakBlocked: () => true,
    }));
    expect(p.source).toBe("satnogs");
    expect(ctTouched).toBe(false);
  });

  it("ambos vivos caidos -> snapshot fechado rotulado (fetchedAt = captura)", async () => {
    const p = await acquireCatalog(deps({
      fetchCelestrak: async () => null,
      fetchSatnogs: async () => null,
      loadSnapshot: () => PARSED,
    }));
    expect(p.source).toBe("snapshot");
    expect(p.sourceLabel).toContain(SNAPSHOT_DATE);
    expect(p.sourceLabel).toContain("(no live)");
    expect(p.fetchedAt).toBe(SNAPSHOT_CAPTURED_AT);
  });

  it("todo caido -> unavailable honesto, sin excepcion", async () => {
    const p = await acquireCatalog(deps({}));
    expect(p.source).toBe("unavailable");
    expect(p.records).toHaveLength(0);
    expect(p.count).toBe(0);
    expect(p.sourceLabel).toBe("unavailable");
  });

  it("buildPayload conserva dropped (rechazo visible)", () => {
    const p = buildPayload("satnogs", { ...PARSED, dropped: 2 }, NOW);
    expect(p.dropped).toBe(2);
  });
});

describe("cache y ventana (reloj inyectable)", () => {
  it("cache: miss inicial, hit dentro del TTL, expira fuera", () => {
    let t = 1000;
    const cache = createCatalogCache(500, () => t);
    expect(cache.get()).toBeNull();
    const payload = buildPayload("satnogs", { records: [], dropped: 0 }, t);
    cache.set(payload);
    expect(cache.get()).toBe(payload);
    t = 1499;
    expect(cache.get()).toBe(payload);
    t = 1500;
    expect(cache.get()).toBeNull();
  });

  it("ventana negativa: abre al fallar, expira sola", () => {
    let t = 0;
    const w = createFailureWindow(100, () => t);
    expect(w.isBlocked()).toBe(false);
    w.markFailed();
    expect(w.isBlocked()).toBe(true);
    t = 99;
    expect(w.isBlocked()).toBe(true);
    t = 100;
    expect(w.isBlocked()).toBe(false);
  });
});

describe("snapshot real embarcado", () => {
  it("15 927 registros > 10 000, checksums intactos, sin duplicados", () => {
    const text = readFileSync(join(process.cwd(), "src", "lib", "iono", "satellites", SNAPSHOT_FILE), "utf8");
    const p = parseTleCatalog(text);
    expect(p.dropped).toBe(0);
    expect(p.records.length).toBe(15927);
    expect(p.records.length).toBeGreaterThan(10000);
    const unique = new Set(p.records.map((r) => r.noradId));
    expect(unique.size).toBe(p.records.length);
  });
});
