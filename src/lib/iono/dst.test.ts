import { describe, expect, it } from "vitest";
import { parseDstWdc, parseGst, dstBand, dstColor, dstRadius } from "./dst";

// Filas REALES de dst2610.for.request (Kyoto, forma pineada).
const WDC =
  "DST2610*04RRX020   0  16  29  23  23  14  22  21  -4 -27 -18 -15 -22 -36 -47 -53 -60 -56 -56 -51 -49 -44 -36 -37 -37 -21\n" +
  "DST2610*05RRX020   0 -36 -44 -47 -55 -55 -44 -35 -35 -36 -44 -41 -31 -26 -23 -22 -31 -34 -37 -36 -38 -40 -41 -31 -29 -37\n" +
  "BASURA\n";

// GST REAL del CCMC el 2026-10-14 (forma pineada).
const GST = [
  {
    gstID: "2026-10-10T15:00:00-GST-001",
    startTime: "2026-10-10T15:00Z",
    allKpIndex: [
      { kpIndex: 7.0, observedTime: "2026-10-10T18:00Z", source: "NOAA" },
      { kpIndex: 6.67, observedTime: "2026-10-10T21:00Z", source: "NOAA" },
    ],
    link: "https://ccmc.gsfc.nasa.gov/DONKI/view/GST/49066/-1",
  },
];

describe("parseDstWdc (forma WDC pineada)", () => {
  it("24 valores por dia (la media 25 se ignora)", () => {
    const pts = parseDstWdc(WDC, 2026, 10);
    expect(pts).toHaveLength(48);
    expect(pts[0]).toEqual({ t: Date.UTC(2026, 9, 4, 0), dst: 0 });
    expect(pts[16]).toEqual({ t: Date.UTC(2026, 9, 4, 16), dst: -60 });
    expect(pts[24]).toEqual({ t: Date.UTC(2026, 9, 5, 0), dst: 0 });
  });
});

describe("parseGst (complemento DONKI declarado)", () => {
  it("tormenta con Kp maximo y link", () => {
    const [g] = parseGst(GST);
    expect(g.kpMax).toBe(7);
    expect(g.start).toBe(Date.parse("2026-10-10T15:00:00Z"));
    expect(g.link).toContain("ccmc.gsfc.nasa.gov/DONKI/view/GST");
  });
  it("basura -> []", () => {
    expect(parseGst(null)).toEqual([]);
  });
});

describe("dstBand + dstColor + dstRadius (declarados O18)", () => {
  it("bandas", () => {
    expect(dstBand(0)).toBe("quiet");
    expect(dstBand(-30)).toBe("quiet");
    expect(dstBand(-31)).toBe("unsettled");
    expect(dstBand(-50)).toBe("unsettled");
    expect(dstBand(-51)).toBe("storm");
    expect(dstBand(-100)).toBe("storm");
    expect(dstBand(-101)).toBe("intense");
  });
  it("el anillo se cierra con la tormenta", () => {
    expect(dstRadius(0)).toBe(5.5);
    expect(dstRadius(-100)).toBe(4.5);
    expect(dstRadius(-500)).toBe(3.5);
    expect(dstRadius(50)).toBe(6);
    expect(dstColor(-150)).toEqual([1.0, 0.25, 0.2]);
  });
});
