// ionosphere-live-3d — drop 9b TU: globe + tfnparm + tfnx temperature
// profile against OFFICIAL reference vectors.
//
// Fixtures transcribed from the NRLMSIS 2.1 reference package
// (mirror jacobwilliams/NRLMSIS2.1 @ 9124144):
// msis2.1_test_in.txt row + msis2.1_test_ref_dp.txt T column (f8.2,
// i.e. reference ±0.005). gtd8d mapping: doy = mod(iyd,1000); ap(1) =
// daily Ap (ap(2:7) unused in default daily mode); stl/mass ignored.
// Driver inputs are real(4): the TU emulates the sngl promotion with
// Math.fround. T path mirrors msiscalc through 9a+9b pieces only
// (globe → tfnparm → alt2gph → bspline → tfnx; kmax = 5 below zetaF
// else 6, wght = Sz(-3:0,4)).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ZETAB, ZETAF, NODES_TN, ND } from "./msisConstants";
import { createMsisState, msisinit } from "./msisInit";
import { createGfnCache, globe } from "./msisGfn";
import { tfnparm, tfnx } from "./msisTfn";
import { alt2gph, bspline } from "./msisUtils";

function parmBytes(): Uint8Array {
  const url = new URL("./msis21.parm", import.meta.url);
  const buf = readFileSync(url);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

interface VectorRow {
  iyd: number; sec: number; alt: number; lat: number; lon: number;
  f107a: number; f107: number; ap: number; refT: number;
}

// [in-row, ref-row] pairs from the official vectors (see header).
const ROWS: VectorRow[] = [
  { iyd: 70178, sec: 64800, alt: 0.2, lat: 50.0, lon: 55.0, f107a: 153.3, f107: 146.5, ap: 35.0, refT: 294.1 },
  { iyd: 70022, sec: 64800, alt: 0.6, lat: -15.0, lon: 35.0, f107a: 163.8, f107: 182.8, ap: 5.0, refT: 296.25 },
  { iyd: 70293, sec: 70912, alt: 53.8, lat: -16.3, lon: 87.8, f107a: 150.5, f107: 140.1, ap: 7.0, refT: 257.37 },
  { iyd: 8174, sec: 36372, alt: 110.0, lat: 62.7, lon: 2.3, f107a: 66.5, f107: 64.9, ap: 3.0, refT: 280.27 }, // file row "08174"
  { iyd: 1126, sec: 47520, alt: 250.0, lat: -86.4, lon: 45.0, f107a: 169.2, f107: 160.7, ap: 5.0, refT: 1002.65 }, // file row "01126"
  { iyd: 6022, sec: 4328, alt: 500.0, lat: 22.0, lon: 130.3, f107a: 82.1, f107: 93.9, ap: 6.0, refT: 777.86 }, // file row "06022"
];

function temperatureAt(row: VectorRow): number {
  const state = createMsisState();
  msisinit(state, { parmBytes: parmBytes() });
  const cache = createGfnCache();
  const f = Math.fround;
  const doy = row.iyd % 1000;
  const gf = globe(
    state, cache, doy, f(row.sec), f(row.lat), f(row.lon),
    f(row.f107a), f(row.f107), [f(row.ap), 0, 0, 0, 0, 0, 0],
  );
  const tpro = tfnparm(state, gf);
  const zeta = alt2gph(f(row.lat), f(row.alt));
  if (zeta < ZETAB) {
    const kmax = zeta < ZETAF ? 5 : 6;
    const { i: iz, S } = bspline(zeta, NODES_TN, ND + 2, kmax, state.etaTN);
    return tfnx(zeta, iz, [S[2][4], S[3][4], S[4][4], S[5][4]], tpro);
  }
  return tfnx(zeta, 0, [0, 0, 0, 0], tpro);
}

describe("9b temperature profile vs official T column", () => {
  it.each(ROWS.map((r, k) => [k, r] as const))(
    "vector row %i: T matches official reference",
    (_k, row) => {
      expect(Math.abs(temperatureAt(row) - row.refT)).toBeLessThan(0.006);
    },
  );
  it("globe memoization is transparent (shared cache, repeated call)", () => {
    const state = createMsisState();
    msisinit(state, { parmBytes: parmBytes() });
    const cache = createGfnCache();
    const f = Math.fround;
    const a = globe(state, cache, 178, f(64800), f(50), f(55), f(153.3), f(146.5), [f(35), 0, 0, 0, 0, 0, 0]);
    const b = globe(state, cache, 178, f(64800), f(50), f(55), f(153.3), f(146.5), [f(35), 0, 0, 0, 0, 0, 0]);
    expect(a).toEqual(b);
    expect(a).toHaveLength(512);
    expect(a[0]).toBe(1); // global term always on
  });
});
