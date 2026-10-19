/**
 * TU W-3 jitter (spec 160 P1, TU OBLIGATORIO): replica los pines del TU C++
 * (drop 135, tests/test_volume_jitter.cpp, norma 144). Los 3 valores son
 * bit-exactos f32 (Math.fround por operacion en el espejo): se pinean con
 * Math.fround del literal, igual que el sufijo f del C++. Vitest.
 */
import { describe, expect, it } from "vitest";
import { entryOffset } from "./volumeJitter";

describe("volume_jitter: valores exactos medidos", () => {
  it("(0,7) -> 0.164884567", () => {
    expect(entryOffset(0, 7)).toBe(Math.fround(0.164884567));
  });

  it("(37,98) -> 0.921024323", () => {
    expect(entryOffset(37, 98)).toBe(Math.fround(0.921024323));
  });

  it("(148,371) -> 0.189423084", () => {
    expect(entryOffset(148, 371)).toBe(Math.fround(0.189423084));
  });
});

describe("volume_jitter: rango + determinismo + descorrelacion", () => {
  it("64x64 todo en [0,1), no constante, repetir da identico", () => {
    const first = entryOffset(0, 0);
    let inRange = true;
    let varied = false;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const v = entryOffset(x, y);
        if (!(v >= 0 && v < 1)) inRange = false;
        if (v !== first) varied = true;
        // Sin componente temporal: repetir da identico.
        if (entryOffset(x, y) !== v) inRange = false;
      }
    }
    expect(inRange).toBe(true);
    expect(varied).toBe(true);
  });
});
