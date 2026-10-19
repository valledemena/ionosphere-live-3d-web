/**
 * TU W-3 layer profile + builder (spec 166 P1): replica los pines del TU C++
 * (tests/test_layer_winner.cpp, norma 144: suelos exactos 110/-1/167,
 * REAL-shape 145/155/136, continuidad, winners por margenes, invariante
 * best contra max() viejo) + pines propios del builder (memo invisible,
 * rangos, invalido). Vitest.
 */
import { describe, expect, it } from "vitest";
import {
  blankProfile,
  buildDensityVolume,
  chapmanAlpha,
  evalNeTotal,
  f2FloorKm,
  profileFromFo,
  sanitizeB0,
  sanitizeB1,
  type LayerProfileTS,
} from "./layerProfile";
import { densityDir, volumeAltKm } from "./densityVolume";

function dayNoF1(): LayerProfileTS {
  return {
    NmE: 1.116e11, hmE: 110,
    NmF1: 0, hmF1: 180,
    NmF2: 1.24e12, hmF2: 300, B0: 100, B1: 3,
    hasE: true, hasF1: false, hasF2: true,
  };
}

// Replica INDEPENDIENTE del max() viejo (sin gate), mismo genero que el
// evalRefMax del TU C++: aisla la puerta f2Floor (si divergen, cae ruidoso).
function evalRefMax(p: LayerProfileTS, hKm: number, cosChi: number): { ne: number; winner: number } {
  let best = 0;
  let win = -1;
  if (cosChi > 0) {
    const v = chapmanAlpha(1e9 * Math.sqrt(cosChi), 75, 10, hKm);
    if (v > best) {
      best = v;
      win = 0;
    }
  }
  if (p.hasE) {
    const v = chapmanAlpha(p.NmE, p.hmE, 10, hKm);
    if (v > best) {
      best = v;
      win = 1;
    }
  }
  if (p.hasF1) {
    const v = chapmanAlpha(p.NmF1, p.hmF1, 25, hKm);
    if (v > best) {
      best = v;
      win = 2;
    }
  }
  if (p.hasF2) {
    let NeF2 = 0;
    if (hKm <= p.hmF2) {
      const B0 = p.B0 > 0 ? p.B0 : 100;
      const x = (p.hmF2 - hKm) / B0;
      const xc = x < 1.6 ? x : 1.6;
      const base = p.NmF2 * Math.exp(-Math.pow(xc, p.B1) / Math.cosh(xc));
      NeF2 = x > 1.6 ? base * Math.exp(-(x - 1.6) / 1.2) : base;
    } else {
      const Htop = 60 * (1 + (hKm - p.hmF2) / 300);
      NeF2 = p.NmF2 * Math.exp(-(hKm - p.hmF2) / Htop);
    }
    if (NeF2 > best) {
      best = NeF2;
      win = 3;
    }
  }
  return { ne: best, winner: win };
}

describe("layerProfile: chapmanAlpha y saneado", () => {
  it("en el pico z=0 -> Nm exacto", () => {
    expect(chapmanAlpha(1.5e11, 110, 10, 110)).toBe(1.5e11);
  });

  it("sanitize oraculo-exacto (default B0 100, ver decision)", () => {
    expect(sanitizeB0(0)).toBe(100);
    expect(sanitizeB0(10)).toBe(20);
    expect(sanitizeB0(400)).toBe(300);
    expect(sanitizeB1(0)).toBe(3);
    expect(sanitizeB1(1)).toBe(1.7);
    expect(sanitizeB1(9)).toBe(4);
  });

  it("profileFromFo mapea fo->Nm con flags y hmF1 de partida", () => {
    expect(blankProfile().hasE).toBe(false);
    const p = profileFromFo(4, 3, 7, 300, 0, 1);
    expect(p.hasE && p.hasF1 && p.hasF2).toBe(true);
    expect(p.NmE).toBe(1.24e10 * 16);
    expect(p.NmF2).toBe(1.24e10 * 49);
    expect(p.hmF1).toBe(240);
    expect(p.B0).toBe(100);
    expect(p.B1).toBe(1.7);
    const q = profileFromFo(4, 0, 7, 300, 0, 1);
    expect(q.hasF1).toBe(false);
    expect(q.hmF1).toBe(180);
  });
});

describe("layerProfile: f2FloorKm (pines exactos del C++)", () => {
  it("sumergido B0=100 -> suelo == hmE exacto", () => {
    expect(f2FloorKm(dayNoF1())).toBe(110);
  });

  it("noche sin-E -> NINGUNO (-1) exacto", () => {
    const p = blankProfile();
    p.NmF2 = 3e11;
    p.hmF2 = 350;
    p.B0 = 120;
    p.B1 = 3;
    p.hasF2 = true;
    expect(f2FloorKm(p)).toBe(-1);
  });

  it("cruce E-fuerte B0=60 -> suelo == 167.0 exacto", () => {
    const p = blankProfile();
    p.NmE = 1.8e12;
    p.hasE = true;
    p.NmF2 = 1e12;
    p.hmF2 = 300;
    p.B0 = 60;
    p.B1 = 2.5;
    p.hasF2 = true;
    expect(f2FloorKm(p)).toBe(167);
  });

  it("continuidad B0+-2 -> suelos a <=15 km", () => {
    const mk = (B0: number): LayerProfileTS => {
      const p = blankProfile();
      p.NmE = 1.8e12;
      p.hasE = true;
      p.NmF2 = 1e12;
      p.hmF2 = 300;
      p.B0 = B0;
      p.B1 = 2.5;
      p.hasF2 = true;
      return p;
    };
    const fa = f2FloorKm(mk(58));
    const fb = f2FloorKm(mk(62));
    expect(fa > 110 && fb > 110 && Math.abs(fa - fb) <= 15).toBe(true);
  });

  it("REAL-shape: B0=60->145, 45->155, 80->136 exactos", () => {
    const NmE = 1.24e10 * 16;
    const NmF2 = 1.24e10 * 49;
    for (const [B0, want] of [[60, 145], [45, 155], [80, 136]] as const) {
      const p = blankProfile();
      p.NmE = NmE;
      p.hasE = true;
      p.NmF2 = NmF2;
      p.hmF2 = 300;
      p.B1 = 3;
      p.hasF2 = true;
      p.B0 = B0;
      expect(f2FloorKm(p)).toBe(want);
    }
  });
});

describe("layerProfile: winners (margenes del C++)", () => {
  it("dia sin-F1: 75->D, 110->E, 200/300->F2", () => {
    const p = dayNoF1();
    expect(evalNeTotal(p, 75, 0.9, 1).winner).toBe(0);
    expect(evalNeTotal(p, 110, 0.9, 1).winner).toBe(1);
    expect(evalNeTotal(p, 200, 0.9, 1).winner).toBe(3);
    expect(evalNeTotal(p, 300, 0.9, 1).winner).toBe(3);
  });

  it("dia E-sumergido +F1: suelo hmE, 60->D, 100->E", () => {
    const p = { ...dayNoF1(), NmF1: 3.1e11, hmF1: 240, hasF1: true };
    expect(f2FloorKm(p)).toBe(110);
    expect(evalNeTotal(p, 60, 0.9, 1).winner).toBe(0);
    expect(evalNeTotal(p, 100, 0.9, 1).winner).toBe(1);
  });

  it("noche todo F2; dia sin-E: suelo -1 y 60->F2", () => {
    const n = blankProfile();
    n.NmF2 = 3e11;
    n.hmF2 = 350;
    n.B0 = 120;
    n.B1 = 3;
    n.hasF2 = true;
    expect(evalNeTotal(n, 60, -0.5, 1).winner).toBe(3);
    expect(evalNeTotal(n, 300, -0.5, 1).winner).toBe(3);
    const d = { ...dayNoF1(), hasE: false };
    expect(f2FloorKm(d)).toBe(-1);
    expect(evalNeTotal(d, 60, 0.9, 1).winner).toBe(3);
  });

  it("perfil vacio de noche -> {0, -1}", () => {
    expect(evalNeTotal(blankProfile(), 200, -0.5, 1)).toEqual({ ne: 0, winner: -1 });
  });
});

describe("layerProfile: invariante best contra max() viejo", () => {
  it("4 perfiles x 12 alturas bit-identico", () => {
    const ps: LayerProfileTS[] = [
      dayNoF1(),
      { ...dayNoF1(), NmF1: 3.1e11, hmF1: 240, hasF1: true },
      { ...blankProfile(), NmF2: 3e11, hmF2: 350, B0: 120, B1: 3, hasF2: true },
      { ...dayNoF1(), hasE: false },
    ];
    const hs = [60, 80, 100, 120, 150, 180, 200, 250, 300, 400, 500, 700];
    for (let pi = 0; pi < 4; pi++) {
      for (const h of hs) {
        const cc = pi === 2 ? -0.5 : 0.9;
        const a = evalNeTotal(ps[pi], h, cc, 1);
        const b = evalRefMax(ps[pi], h, cc);
        // Invariante best bit-identico (igual que el C++: solo el valor).
        expect(a.ne === b.ne).toBe(true);
        if (b.winner === 3 && a.winner !== 3) {
          // Unica divergencia legitima: la puerta f2Floor retiene el win.
          expect(h <= f2FloorKm(ps[pi])).toBe(true);
        } else {
          expect(a.winner).toBe(b.winner);
        }
      }
    }
  });
});

describe("layerProfile: buildDensityVolume", () => {
  it("tamano erroneo -> invalido", () => {
    const v = buildDensityVolume([dayNoF1()], 2, 2, 3, 60, 500, -1, 0, 0, 1);
    expect(v.valid).toBe(false);
  });

  it("rejilla 2x2x3 uniforme: valida, data en [0,1], layer en 0..3", () => {
    const v = buildDensityVolume(
      [dayNoF1(), dayNoF1(), dayNoF1(), dayNoF1()], 2, 2, 3, 60, 500, -1, 0, 0, 1
    );
    expect(v.valid).toBe(true);
    expect(v.data.length).toBe(12);
    expect(v.layer.length).toBe(12);
    for (const d of v.data) expect(d >= 0 && d <= 1).toBe(true);
    for (const l of v.layer) expect(l >= 0 && l <= 3).toBe(true);
  });

  it("memoizacion invisible: igual que el ingenuo celda a celda", () => {
    const profs = [dayNoF1(), dayNoF1(), dayNoF1(), dayNoF1()];
    const v = buildDensityVolume(profs, 2, 2, 3, 60, 500, -1, 0, 0, 1);
    for (let latIdx = 0; latIdx < 2; latIdx++) {
      const latDeg = -90 + (180 * (latIdx + 0.5)) / 2;
      for (let lonIdx = 0; lonIdx < 2; lonIdx++) {
        const lonDeg = -180 + (360 * (lonIdx + 0.5)) / 2;
        const [cx, cy, cz] = densityDir(latDeg, lonDeg);
        const cosChi = -cx;
        const p = profs[latIdx * 2 + lonIdx];
        for (let a = 0; a < 3; a++) {
          const h = volumeAltKm(a, 3, 60, 500);
          const r = evalNeTotal(p, h, cosChi, 1);
          const ii = (a * 2 + latIdx) * 2 + lonIdx;
          const want = ((r.ne > 0 ? Math.log10(r.ne) : 0) - 8) / 4.5;
          expect(v.data[ii] === Math.min(1, Math.max(0, want))).toBe(true);
          expect(v.layer[ii]).toBe(r.winner < 0 ? 0 : r.winner);
        }
      }
    }
  });
});
