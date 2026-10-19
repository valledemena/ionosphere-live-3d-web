// ionosphere-live-3d — drop 9c binding oracle: full 200-vector regression
// against the OFFICIAL NRLMSIS 2.1 reference vectors.
//
// DECLARED DUAL CRITERION:
//  (a) DESIRED: bit-exact vs same-engine recomputation. Reported in the
//      drop note, NOT binding (engine libm 1-ulp differences, ruling 302
//      section 6: V8/JSC/libm Math.log Manoj 1 ulp).
//  (b) BINDING vs official vectors (this TU): densities relative
//      tolerance 1e-3, T absolute tolerance 0.01 K, dmissing exact.
//  Rationale (measured, declared): reference print quantum is 5e-5
//  (6 sig figs) for densities and 0.005 (f8.2) for T; the measured
//  reference-vs-code ceiling is 4.85e-4 / 0.00496 K, a smooth systematic
//  across all cells. Code-vs-code (this port vs the official compiled
//  Fortran via pymsis, same parm) agrees to <=4e-5 worst (ill-conditioned
//  Chapman tail) and typically <=1e-6 with T at 1e-7 — so the 5e-4 floor
//  is a REFERENCE-side artifact (most plausibly a parm recalibration
//  after vector generation; cause undetermined but external to any
//  transcription). Binding tolerances sit 2x above the measured ceiling;
//  every known transcription-defect class exceeds them by 10x or more.
//
// Fixtures: official msis2.1_test_in.txt (12864 B) + msis2.1_test_ref_dp.txt
// (40602 B), mirror @ 9124144, read at test time (test-only, NRL-SOF
// fenced directory). Driver mapping (msis2.1_test.F90 + gtd8d docs):
// doy = mod(iyd,1000); ap(1) = daily Ap (ap(2:7) unused in default daily
// mode, set 0); stl/mass ignored; real(4) inputs emulated via Math.fround.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DMISSING } from "./msisConstants";
import { createMsisState, msisinit } from "./msisInit";
import { gtd8d, createGfnCache } from "./msisGtd8d";

export const BIND_REL = 1e-3;
export const BIND_T_ABS = 0.01;

function readLines(name: string): string[] {
  const buf = readFileSync(new URL("./" + name, import.meta.url));
  return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
    .toString("utf8")
    .split("\n")
    .slice(1)
    .filter((l) => l.trim());
}

describe("9c binding oracle: 200 official vectors", () => {
  it("all densities within 1e-3 relative, T within 0.01 K, dmissing exact", () => {
    const parm = readFileSync(new URL("./msis21.parm", import.meta.url));
    const state = createMsisState();
    msisinit(state, {
      parmBytes: new Uint8Array(parm.buffer, parm.byteOffset, parm.byteLength),
    });
    // Single shared cache across rows (also exercises globe memoization).
    const cache = createGfnCache();
    const f = Math.fround;
    const inl = readLines("msis2.1_test_in.txt");
    const refl = readLines("msis2.1_test_ref_dp.txt");
    expect(inl).toHaveLength(200);
    expect(refl).toHaveLength(200);
    const fails: string[] = [];
    inl.forEach((line, k) => {
      const p = line.trim().split(/\s+/).map(Number);
      const [iyd, sec, alt, lat, lon, , f107a, f107, apd] = p;
      const rp = refl[k].trim().split(/\s+/).map(Number);
      const refD = [0, ...rp.slice(9, 19)];
      const refT = rp[19];
      const { d, t } = gtd8d(
        state, cache, iyd, f(sec), f(alt), f(lat), f(lon), 0,
        f(f107a), f(f107), [f(apd), 0, 0, 0, 0, 0, 0], 0,
      );
      if (Math.abs(t[2] - refT) >= BIND_T_ABS) {
        fails.push(`row${k} T: ${t[2]} vs ${refT}`);
      }
      for (let m = 1; m <= 10; m++) {
        if (refD[m] === 9.999e-38) {
          if (d[m] !== DMISSING) fails.push(`row${k} d${m}: missing mismatch`);
          continue;
        }
        if (refD[m] === 0) {
          if (Math.abs(d[m]) > 1e-300) fails.push(`row${k} d${m}: zero mismatch`);
          continue;
        }
        const rel = Math.abs(d[m] - refD[m]) / Math.abs(refD[m]);
        if (rel >= BIND_REL) fails.push(`row${k} d${m}: rel ${rel}`);
      }
    });
    expect(fails.slice(0, 10)).toEqual([]);
  });
});
