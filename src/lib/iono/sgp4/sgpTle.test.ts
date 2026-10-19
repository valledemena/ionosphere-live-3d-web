// ionosphere-live-3d — drop 313 TU: TLE parsing + checksum policy.
// Fixture: SGP4-VER.TLE line pairs (official verification set).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseTle, tleChecksumOk, twoline2rv } from "./sgpTle";

function verLines(): string[] {
  const buf = readFileSync(new URL("./SGP4-VER.TLE", import.meta.url));
  return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString("utf8").split("\n");
}

function tlePair(satnum: string): [string, string] {
  const lines = verLines();
  for (let k = 0; k < lines.length; k++) {
    if (lines[k].startsWith("1 ") && lines[k].slice(2, 7).trim() === satnum) {
      return [lines[k], lines[k + 1]];
    }
  }
  throw new Error("tle not found: " + satnum);
}

describe("313 TLE checksum (strict by default)", () => {
  it("all 30 clean VER TLEs pass strict parsing", () => {
    const lines = verLines();
    let n = 0;
    for (let k = 0; k < lines.length; k++) {
      if (!lines[k].startsWith("1 ")) continue;
      const l1 = lines[k];
      const l2 = lines[k + 1];
      if (l2 === undefined || !l2.startsWith("2 ")) continue;
      const sat = l1.slice(2, 7).trim();
      if (["33333", "33334", "33335"].includes(sat)) continue; // intentional error cases
      const el = parseTle(l1, l2);
      expect(tleChecksumOk(l1)).toBe(true);
      expect(tleChecksumOk(l2)).toBe(true);
      expect(el.checksumOk1).toBe(true);
      expect(el.checksumOk2).toBe(true);
      n++;
    }
    expect(n).toBe(30);
  });
  it("a single corrupted digit is rejected", () => {
    const [l1, l2] = tlePair("00005");
    const bad = "9" + l1.slice(1);
    expect(tleChecksumOk(bad)).toBe(false);
    expect(() => parseTle(bad, l2)).toThrow();
  });
  it("the 3 intentional error TLEs fail checksum (documented) but parse lenient", () => {
    for (const sat of ["33333", "33334", "33335"]) {
      const [l1, l2] = tlePair(sat);
      expect(tleChecksumOk(l1) && tleChecksumOk(l2)).toBe(false);
      expect(() => parseTle(l1, l2)).toThrow();
      const el = parseTle(l1, l2, { strict: false });
      expect(el.satnum).toBe(sat);
    }
  });
  it("short lines are rejected", () => {
    expect(tleChecksumOk("1 00005U")).toBe(false);
    expect(() => parseTle("1 00005U", "2 00005")).toThrow();
  });
});

describe("313 TLE field transcription (00005 spot checks)", () => {
  it("parses epoch/inclination/eccentricity", () => {
    const [l1, l2] = tlePair("00005");
    const el = parseTle(l1, l2);
    expect(el.satnum).toBe("00005");
    expect(el.epochyr).toBe(0);
    expect(el.epochdays).toBe(179.78495062);
    expect(el.inclo).toBe(34.2682);
    // 0.1859667 via the implied-decimal surgery (col 26 '.')
    expect(el.ecco).toBe(0.1859667);
    // [52] != ' ' branch: 11-char mean motion,-verbatim like the C reader
    expect(el.noKozai).toBe(10.82419157);
    expect(el.bstar).toBe(0.28098); // raw; x10^ibexp applied in twoline2rv
    expect(el.ibexp).toBe(-4);
    expect(el.startmfe).toBe(0);
    expect(el.stopmfe).toBe(4320);
    expect(el.deltamin).toBe(360);
  });
  it("twoline2rv converts units (rad/min)", () => {
    const [l1, l2] = tlePair("00005");
    const { satrec } = twoline2rv(l1, l2, "wgs72", "a");
    expect(satrec.error).toBe(0);
    expect(satrec.inclo).toBeCloseTo((34.2682 * Math.PI) / 180, 12);
    expect(satrec.mo).toBeCloseTo((19.3264 * Math.PI) / 180, 12);
    expect(satrec.bstar).toBeCloseTo(0.28098e-4, 18);
  });
});
