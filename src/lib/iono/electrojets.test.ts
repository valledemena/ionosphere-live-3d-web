import { describe, expect, it } from "vitest";
import {
  parseKyotoAe,
  aeFileName,
  aeBand,
  aeColor,
  ELECTROJET_MAGLAT,
} from "./electrojets";

// Lineas REALES de ae260927 (Kyoto, 2026-09-27, forma pineada).
const DAY =
  "AEALAOAU    260927E00AE QUICKLK      224   229   249   263   268   304   330   316\n" +
  "AEALAOAU    260927E01AE QUICKLK      441   421   411   412   454   464   456   418\n" +
  "BASURA SIN CABECERA\n" +
  "AEALAOAU    260927E02AE QUICKLK      142   148   9999   160   165\n";

describe("parseKyotoAe (forma Kyoto pineada)", () => {
  it("parsea filas horarias con minutos exactos", () => {
    const pts = parseKyotoAe(DAY, 2026, 9, 27);
    expect(pts).toHaveLength(8 + 8 + 4); // 9999 descartado, basura ignorada
    expect(pts[0]).toEqual({ t: Date.UTC(2026, 8, 27, 0, 0), ae: 224 });
    expect(pts[8]).toEqual({ t: Date.UTC(2026, 8, 27, 1, 0), ae: 441 });
    expect(pts[pts.length - 1].ae).toBe(165);
  });
  it("nombre de fichero aeYYMMDD (patron mensual O17)", () => {
    expect(aeFileName(2026, 9, 27)).toBe("ae260927");
    expect(aeFileName(2026, 10, 14)).toBe("ae261014");
    expect(ELECTROJET_MAGLAT).toBe(67);
  });
});

describe("aeBand + aeColor (mapeo declarado O17)", () => {
  it("bandas", () => {
    expect(aeBand(50)).toBe("quiet");
    expect(aeBand(100)).toBe("active");
    expect(aeBand(500)).toBe("active");
    expect(aeBand(501)).toBe("storm");
  });
  it("azul->amarillo->blanco monotono", () => {
    expect(aeColor(50)).toEqual([0.2, 0.4, 1.0]);
    const mid = aeColor(300);
    expect(mid[0]).toBeGreaterThan(0.5); // ya tiende a amarillo
    expect(mid[2]).toBeLessThan(0.7);
    expect(aeColor(1500)).toEqual([1, 1, 1]);
    expect(aeColor(2000)).toEqual([1, 1, 1]);
  });
});
