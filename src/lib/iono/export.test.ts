/**
 * TU W-2 export (ruling 150, spec del veredicto 152): pines del formato CSV
 * contra el golden del Exporter C++ (drop 131, norma 144). Vitest.
 */
import { describe, expect, it } from "vitest";
import { buildPngName, fmtG9, gridCsv, type WebGrid } from "./export";

describe("buildPngName", () => {
  it("epoch fijo -> iono-20261001-114500Z.png (mismo TOV que el TU C++)", () => {
    expect(buildPngName(1790855100)).toBe("iono-20261001-114500Z.png");
  });
  it("epoch 0", () => {
    expect(buildPngName(0)).toBe("iono-19700101-000000Z.png");
  });
});

describe("fmtG9 (%.9g de C)", () => {
  it("golden C++: 1.5 / -2.25 / 0 / 100.125", () => {
    expect(fmtG9(1.5)).toBe("1.5");
    expect(fmtG9(-2.25)).toBe("-2.25");
    expect(fmtG9(0)).toBe("0");
    expect(fmtG9(100.125)).toBe("100.125");
  });
  it("exponentes estilo C (%e con 2+ digitos)", () => {
    expect(fmtG9(1e17)).toBe("1e+17");
    expect(fmtG9(1.23456789e-5)).toBe("1.23456789e-05");
  });
  it("NaN -> nan ( spelling glibc, filas estables)", () => {
    expect(fmtG9(NaN)).toBe("nan");
  });
});

describe("gridCsv", () => {
  it("bundle 2x2 exacto con timestamp del dato por fila", () => {
    const g: WebGrid = {
      w: 2,
      h: 2,
      // filas web: j=0 norte. valores identidad para el pin.
      values: new Float32Array([10, 11, 20, 21]),
      valid: true,
    };
    // lat_idx 0 = sur = j=1 -> [20,21]; lat_idx 1 = j=0 -> [10,11].
    const want =
      "# var=foF2 width=2 height=2\n" +
      "# layout: values[lat_idx*width+lon_idx], row0=lat-90 south, col0=lon-180\n" +
      "lat_idx,lon_idx,value,tov_epoch\n" +
      "0,0,20,1790855100\n" +
      "0,1,21,1790855100\n" +
      "1,0,10,1790855100\n" +
      "1,1,11,1790855100\n";
    expect(gridCsv("foF2", g, 1790855100)).toBe(want);
  });
  it("vacio declarado", () => {
    const g: WebGrid = { w: 0, h: 0, values: new Float32Array(0), valid: false };
    expect(gridCsv("foF2", g, 1790855100)).toContain("# empty\n");
  });
});
