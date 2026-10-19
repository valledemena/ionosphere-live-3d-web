// ionosphere-live-3d — drop 313 TU: special cases & exact return codes.
// Oracle: official SGP4 verification set (.e rows where valid) + the
// python-sgp4 pure model (same SGP4.cpp family) for the code pins.
// Reference semantics: return codes are PER-CALL (recomputed on every
// call, including "recovery" after a transient error), so the tail
// probes pin the exact code at the exact tsince (method 9c: measured
// against the reference, then pinned verbatim; see README numerics).
// Codes: 0 ok; 1 mean ecc out of range; 3 perturbed ecc out of range;
// 4 semi-latus rectum negative (decayed); 6 mrt < 1 (decayed).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { twoline2rv } from "./sgpTle";
import { sgp4 } from "./sgp4";

const ABS_POS = 1e-6;
const REL = 1e-6;
const ABS_VEL = 1e-9;

interface Row {
  tsinceMin: number;
  r: number[];
  v: number[];
}

function readVer(): string[] {
  const buf = readFileSync(new URL("./SGP4-VER.TLE", import.meta.url));
  return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString("utf8").split("\n");
}

function verPair(satnum: string): [string, string] {
  const lines = readVer();
  for (let k = 0; k < lines.length; k++) {
    if (lines[k].startsWith("1 ") && lines[k].slice(2, 7).trim() === satnum) {
      return [lines[k], lines[k + 1]];
    }
  }
  throw new Error("tle not found: " + satnum);
}

function ephemRows(satnum: string): Row[] {
  const buf = readFileSync(new URL(`./tle/${satnum}.e`, import.meta.url));
  const text = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString("utf8");
  const rows: Row[] = [];
  let started = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("EphemerisTimePosVel")) {
      started = true;
      continue;
    }
    if (!started) continue;
    if (line.startsWith("END")) break;
    if (line.length === 0) continue;
    const p = line.split(/\s+/).map(Number);
    rows.push({ tsinceMin: p[0] / 60, r: [p[1], p[2], p[3]], v: [p[4], p[5], p[6]] });
  }
  return rows;
}

interface Special {
  rows: number;
  rowCodes: number[];
  probes: Array<[number, number]>;
}

const SPECIAL: Record<string, Special> = {
  // e=0.995: pl < 0 at t=25 only; the reference recovers afterwards
  "33333": { rows: 5, rowCodes: [0, 0, 0, 0, 0], probes: [[25, 4], [80, 0], [320, 0]] },
  // nm ~ 1e-5 rev/day: perturbed-ecc range error; code shifts 3 -> 1 at long t
  "33334": { rows: 1, rowCodes: [3], probes: [[1, 3], [60, 3], [300, 1]] },
  // Lyddane special: no error across the full 24 h sweep
  "33335": {
    rows: 73,
    rowCodes: Array(73).fill(0),
    probes: [[1460, 0], [1500, 0], [1740, 0]],
  },
  // decayed (mrt < 1) at t=55 only
  "28872": { rows: 11, rowCodes: Array(11).fill(0), probes: [[55, 6], [110, 0], [350, 0]] },
  // decayed; stays below (mrt < 1) for every t beyond the last row
  "29141": { rows: 22, rowCodes: Array(22).fill(0), probes: [[440, 6], [480, 6], [720, 6]] },
  // 12 h resonance: em crosses 1 after the last row (startmfe + 20 min grid)
  "22312": {
    rows: 23,
    rowCodes: Array(23).fill(0),
    probes: [[528.4057344, 1], [534.2028672, 1], [774.2028672, 1]],
  },
  // STR#3 original: no error (kept for completeness; also in the main harness)
  "88888": {
    rows: 13,
    rowCodes: Array(13).fill(0),
    probes: [[1560, 0], [1620, 0], [1740, 0]],
  },
};

describe("313 special cases: exact per-call return codes", () => {
  for (const [sat, spec] of Object.entries(SPECIAL)) {
    it(`${sat}: ${spec.rows} .e rows + tail probes match the reference codes`, () => {
      const [l1, l2] = verPair(sat);
      const { satrec } = twoline2rv(l1, l2, "wgs72", "a", { strict: false });
      const rows = ephemRows(sat);
      expect(rows.length).toBe(spec.rows);
      const r = [0, 0, 0];
      const v = [0, 0, 0];
      for (let i = 0; i < rows.length; i++) {
        const ok = sgp4(satrec, rows[i].tsinceMin, r, v);
        expect(satrec.error).toBe(spec.rowCodes[i]);
        expect(ok).toBe(spec.rowCodes[i] === 0);
        if (spec.rowCodes[i] !== 0) continue;
        for (let k = 0; k < 3; k++) {
          const dr = Math.abs(r[k] - rows[i].r[k]);
          const rel = rows[i].r[k] !== 0 ? dr / Math.abs(rows[i].r[k]) : Infinity;
          expect(dr <= ABS_POS || rel <= REL).toBe(true);
          const dv = Math.abs(v[k] - rows[i].v[k]);
          const relv = rows[i].v[k] !== 0 ? dv / Math.abs(rows[i].v[k]) : Infinity;
          expect(dv <= ABS_VEL || relv <= REL).toBe(true);
        }
      }
      for (const [t, code] of spec.probes) {
        const ok = sgp4(satrec, t, r, v);
        expect(satrec.error).toBe(code);
        expect(ok).toBe(code === 0);
      }
    });
  }
});
