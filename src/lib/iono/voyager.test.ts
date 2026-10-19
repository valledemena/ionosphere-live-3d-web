import { describe, expect, it } from "vitest";
import {
  friisReceivedW,
  lightTimeSec,
  pulseLapse,
  parseHorizons,
  pickCurrentRow,
} from "./voyager";

// Respuesta REAL de Horizons el 2026-10-15 (forma pineada).
const HOR = ` Date__(UT)__HR:MN                delta      deldot
 2026-Oct-15 00:00     172.508150629083  36.7108670
 2026-Oct-16 00:00     172.529281520162  36.4666980
`;

describe("parseHorizons (forma JPL pineada)", () => {
  it("rango fresco (no el pin eterno del catalogo)", () => {
    const rows = parseHorizons(HOR);
    expect(rows).toHaveLength(2);
    expect(rows[1].au).toBeCloseTo(172.5293, 3);
    expect(rows[1].au).toBeGreaterThan(172.48); // deriva real desde el 14-oct
    expect(rows[0].t).toBeLessThan(rows[1].t);
  });
  it("basura -> []", () => {
    expect(parseHorizons("")).toEqual([]);
    expect(parseHorizons("no data")).toEqual([]);
  });
});

describe("pickCurrentRow (P1-286: nunca futura)", () => {
  const rows = parseHorizons(HOR);
  const t15 = Date.parse("15 Oct 2026 12:00 UTC");
  const t16 = Date.parse("16 Oct 2026 12:00 UTC");
  it("elige la pasada mas cercana", () => {
    expect(pickCurrentRow(rows, t15)!.au).toBeCloseTo(172.5082, 3);
    expect(pickCurrentRow(rows, t16)!.au).toBeCloseTo(172.5293, 3);
  });
  it("vacio -> null; todo futuro -> primera (declarado)", () => {
    expect(pickCurrentRow([], t15)).toBeNull();
    expect(pickCurrentRow(rows, Date.parse("14 Oct 2026 00:00 UTC"))!.au).toBeCloseTo(172.5082, 3);
  });
});

describe("Friis (el susurro ~5e-19 W, O7)", () => {
  it("orden de magnitud con parametros JPL publicos", () => {
    const pr = friisReceivedW(172.5);
    expect(pr).toBeGreaterThan(1e-19);
    expect(pr).toBeLessThan(2e-18);
  });
  it("decae con r^2", () => {
    expect(friisReceivedW(172.5) / friisReceivedW(86.25)).toBeCloseTo(0.25, 5);
  });
});

describe("tiempo-luz honesto (O7: 23h54m solo-ida)", () => {
  it("172.5 UA ~= 23.9 h", () => {
    const h = lightTimeSec(172.5) / 3600;
    expect(h).toBeGreaterThan(23.5);
    expect(h).toBeLessThan(24.5);
  });
  it("factor visible del barrido (O1.5)", () => {
    // ~86100 s a 10 s -> x8610.
    expect(pulseLapse(lightTimeSec(172.5), 10000)).toBeGreaterThan(8000);
  });
});
