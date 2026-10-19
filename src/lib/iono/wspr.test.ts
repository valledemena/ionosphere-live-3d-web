import { describe, expect, it } from "vitest";
import {
  maidenheadToLatLon,
  wsprBand,
  parseWsprTable,
  bandOpening,
  SPOT_TTL_MIN,
  SPOT_CAP,
} from "./wspr";

describe("maidenheadToLatLon (celda centro)", () => {
  it("JO31 -> (51.5, 7.0)", () => {
    expect(maidenheadToLatLon("JO31")).toEqual([51.5, 7]);
  });
  it("FN20 -> (40.5, -75)", () => {
    expect(maidenheadToLatLon("FN20")).toEqual([40.5, -75]);
  });
  it("6 caracteres afina dentro de la celda", () => {
    const c4 = maidenheadToLatLon("JO31")!;
    const c6 = maidenheadToLatLon("JO31NW")!;
    expect(Math.abs(c6[0] - c4[0])).toBeLessThan(0.5);
    expect(Math.abs(c6[1] - c4[1])).toBeLessThan(1);
  });
  it("grids invalidos -> null", () => {
    expect(maidenheadToLatLon("")).toBeNull();
    expect(maidenheadToLatLon("XX99")).toBeNull();
    expect(maidenheadToLatLon("JO3")).toBeNull();
  });
});

describe("wsprBand (dials reales)", () => {
  it("frecuencias de la tabla viva", () => {
    expect(wsprBand(10.140193)).toBe("30m");
    expect(wsprBand(7.04009)).toBe("40m");
    expect(wsprBand(14.0956)).toBe("20m");
    expect(wsprBand(50.293)).toBe("6m");
  });
  it("fuera de banda -> null", () => {
    expect(wsprBand(100.0)).toBeNull();
    expect(wsprBand(0)).toBeNull();
  });
});

// Filas REALES de wsprnet.org/olddb el 2026-10-14 (forma pineada).
const HTML =
  "<table><tr><td>Date</td><td>Call</td><td>Frequency</td><td>SNR</td>" +
  "<td>Drift</td><td>Grid</td><td>dBm</td><td>W</td><td>by</td><td>loc</td>" +
  "<td>km</td><td>mi</td><td>Mode</td><td>Version</td></tr>" +
  "<tr><td>&nbsp;2026-10-14 12:52&nbsp;</td><td>&nbsp;DL2NL&nbsp;</td>" +
  "<td>&nbsp;10.140193&nbsp;</td><td>&nbsp;+1&nbsp;</td><td>&nbsp;0&nbsp;</td>" +
  "<td>&nbsp;JO31&nbsp;</td><td>&nbsp;+23&nbsp;</td><td>&nbsp;0.200&nbsp;</td>" +
  "<td>&nbsp;DL2NL/1&nbsp;</td><td>&nbsp;JO31&nbsp;</td><td>&nbsp;0&nbsp;</td>" +
  "<td>&nbsp;0&nbsp;</td><td>&nbsp;WSPR-2&nbsp;</td><td>&nbsp;&nbsp;</td></tr>" +
  "<tr><td>&nbsp;2026-10-14 12:52&nbsp;</td><td>&nbsp;EA8BFK&nbsp;</td>" +
  "<td>&nbsp;14.095600&nbsp;</td><td>&nbsp;-22&nbsp;</td><td>&nbsp;0&nbsp;</td>" +
  "<td>&nbsp;IL38&nbsp;</td><td>&nbsp;+37&nbsp;</td><td>&nbsp;5.000&nbsp;</td>" +
  "<td>&nbsp;K1JT&nbsp;</td><td>&nbsp;FN20&nbsp;</td><td>&nbsp;5420&nbsp;</td>" +
  "<td>&nbsp;3368&nbsp;</td><td>&nbsp;WSPR-2&nbsp;</td><td>&nbsp;&nbsp;</td></tr></table>";

const NOW = Date.parse("2026-10-14T12:55:00Z");

describe("parseWsprTable (O5.1 solo reales)", () => {
  it("parsea las 2 filas reales con coordenadas", () => {
    const spots = parseWsprTable(HTML, NOW);
    expect(spots).toHaveLength(2);
    expect(spots[0].tx).toBe("DL2NL");
    expect(spots[0].band).toBe("30m");
    expect(spots[0].txLat).toBe(51.5);
    expect(spots[1].band).toBe("20m");
    expect(spots[1].rxLat).toBe(40.5);
    expect(spots[1].km).toBe(5420);
  });
  it("caducidad ~10 min declarada (O5.2)", () => {
    expect(SPOT_TTL_MIN).toBe(10);
    expect(parseWsprTable(HTML, NOW + 11 * 60_000)).toHaveLength(0);
    expect(parseWsprTable(HTML, NOW)).toHaveLength(2);
  });
  it("basura -> [] (O5.4 jamas sintetico)", () => {
    expect(parseWsprTable("", NOW)).toEqual([]);
    expect(parseWsprTable("<html>sin tabla</html>", NOW)).toEqual([]);
  });
  it("techo de arcos declarado", () => {
    expect(SPOT_CAP).toBe(40);
  });
});

describe("bandOpening (O5.3 del panel = del mapa)", () => {
  it("cuenta y mejor SNR por banda", () => {
    const spots = parseWsprTable(HTML, NOW);
    const op = bandOpening(spots);
    expect(op).toHaveLength(2);
    expect(op.find((b) => b.band === "20m")).toEqual({ band: "20m", count: 1, bestSnr: -22 });
    expect(op.find((b) => b.band === "30m")?.count).toBe(1);
  });
});
