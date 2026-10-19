/**
 * TU W-3 god rays (spec 162 P1, TU OBLIGATORIO): replica los pines del TU
 * C++ (drops 143/147, tests/test_godrays.cpp, norma 144): proyeccion en
 * 3 casos, 12 taps con decay monotono, mascara del corredor, puerta y
 * stepping, mas pines de las constantes nombradas de la spec. Vitest.
 */
import { describe, expect, it } from "vitest";
import {
  DECAY,
  EARTH_R,
  FALLOFF_K,
  GAIN,
  MAX_RADIUS,
  NTAPS,
  SUN_B,
  SUN_G,
  SUN_R,
  falloff,
  gateSkip,
  godraysPassState,
  mat4Inverse,
  mat4LookAt,
  mat4Mul,
  mat4Perspective,
  projectSun,
  rayHitsEarth,
  tapMask,
  tapUV,
  tapWeight,
  unprojectDir,
  vec3Normalize,
  type Vec3,
} from "./godrays";

function setup(): { vp: ReturnType<typeof mat4Mul>; cam: Vec3 } {
  const proj = mat4Perspective((45 * Math.PI) / 180, 16 / 9, 0.1, 100);
  const cam: Vec3 = [0, 0, 3];
  const view = mat4LookAt(cam, [0, 0, 0], [0, 1, 0]);
  return { vp: mat4Mul(proj, view), cam };
}

describe("godrays: proyeccion sol->NDC (3 casos)", () => {
  it("delante: ni behind ni offscreen", () => {
    const { vp, cam } = setup();
    const s = projectSun(vp, cam, vec3Normalize([0.2, 0.05, -1]));
    expect(s.behind).toBe(false);
    expect(s.offscreen).toBe(false);
  });

  it("detras: behind (w<=0) y gate skip", () => {
    const { vp, cam } = setup();
    const b = projectSun(vp, cam, [0, 0, 1]);
    expect(b.behind).toBe(true);
    expect(gateSkip(b, false)).toBe(true);
  });

  it("tras limbo: gate skip por oclusion", () => {
    const { vp, cam } = setup();
    const s = projectSun(vp, cam, vec3Normalize([0.2, 0.05, -1]));
    expect(gateSkip(s, rayHitsEarth(cam, vec3Normalize([-1, 0, -2.9])))).toBe(true);
  });
});

describe("godrays: 12 taps con decay monotono", () => {
  it("NTAPS == 12", () => {
    expect(NTAPS).toBe(12);
  });

  it("pesos no crecientes y positivos", () => {
    for (let i = 1; i < NTAPS; i++) {
      expect(tapWeight(i) <= tapWeight(i - 1) && tapWeight(i) > 0).toBe(true);
    }
  });

  it("w0 == 1 exacto", () => {
    expect(tapWeight(0)).toBe(1);
  });
});

describe("godrays: mascara del corredor", () => {
  it("hacia la Tierra -> 0", () => {
    expect(tapMask([0, 0, 3], [0, 0, -1])).toBe(0);
  });

  it("al cielo -> 1", () => {
    expect(tapMask([0, 0, 3], [0, 0, 1])).toBe(1);
  });

  it("falloff monotono", () => {
    expect(falloff(0) > falloff(0.5) && falloff(0.5) > falloff(2)).toBe(true);
  });
});

describe("godrays: puerta y stepping", () => {
  it("off-screen -> skip", () => {
    expect(gateSkip({ x: 1.5, y: 0, behind: false, offscreen: true }, false)).toBe(true);
  });

  it("tap0 == pixel", () => {
    const t0 = tapUV(0, [0.5, 0.5], [0.9, 0.5], 16 / 9);
    expect(Math.abs(t0[0] - 0.5) < 1e-6 && Math.abs(t0[1] - 0.5) < 1e-6).toBe(true);
  });

  it("tap11 avanza al sol (mismo eje, con clamp)", () => {
    const t11 = tapUV(11, [0.5, 0.5], [0.9, 0.5], 16 / 9);
    expect(Math.abs(t11[1] - 0.5) < 1e-6 && t11[0] > 0.5 && t11[0] <= 0.9).toBe(true);
  });
});

describe("godrays: constantes nombradas de la spec", () => {
  it("pines 143/147", () => {
    expect(DECAY).toBe(0.9);
    expect(MAX_RADIUS).toBe(0.45);
    expect(FALLOFF_K).toBe(8);
    expect(EARTH_R).toBe(1);
    expect(GAIN).toBe(0.12);
    expect([SUN_R, SUN_G, SUN_B]).toEqual([1, 0.9, 0.75]);
  });
});

describe("godrays: mat4Inverse (n1-178: la puerta necesita la inversa)", () => {
  it("identidad exacta y round-trip vp/lookAt < 1e-12", () => {
    const id = mat4Inverse([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    expect(id).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const { vp } = setup();
    for (const m of [vp, mat4LookAt([1, 2, 3], [0, 0, 0], [0, 1, 0])]) {
      const rt = mat4Mul(m, mat4Inverse(m));
      let mx = 0;
      for (let i = 0; i < 16; i++) {
        const want = i % 5 === 0 ? 1 : 0;
        mx = Math.max(mx, Math.abs(rt[i] - want));
      }
      expect(mx).toBeLessThan(1e-12);
    }
  });
});

describe("godrays: paridad mascara cielo/disco por el camino del pase", () => {
  it("0 desacuerdos: disco -> 0, cielo -> 1 (vp INVERTIDA)", () => {
    const { vp, cam } = setup();
    const inv = mat4Inverse(vp);
    const maskAt = (u: number, v: number): number =>
      rayHitsEarth(cam, unprojectDir(inv, cam, u, v)) ? 0 : 1;
    // Disco (rayos al centro y cercanias): todos ocluidos.
    for (const [u, v] of [[0.5, 0.5], [0.5, 0.45], [0.45, 0.5], [0.55, 0.55]] as const) {
      expect(maskAt(u, v)).toBe(0);
    }
    // Cielo (esquinas y laterales lejanos): todos libres.
    for (const [u, v] of [[0.02, 0.98], [0.98, 0.98], [0.02, 0.02], [0.98, 0.02], [0.9, 0.9]] as const) {
      expect(maskAt(u, v)).toBe(1);
    }
  });

  it("camino completo tapUV -> unproject -> mask (sol lateral)", () => {
    const { vp, cam } = setup();
    const inv = mat4Inverse(vp);
    const sun: [number, number] = [0.75, 0.55];
    const m0 = rayHitsEarth(cam, unprojectDir(inv, cam, ...tapUV(0, [0.5, 0.5], sun, 16 / 9))) ? 0 : 1;
    const m11 = rayHitsEarth(cam, unprojectDir(inv, cam, ...tapUV(11, [0.5, 0.5], sun, 16 / 9))) ? 0 : 1;
    expect(m0).toBe(0); // tap en el pixel central: mira a la Tierra
    expect(m11).toBe(1); // tap en el sol: cielo libre (ahi nace el glow)
  });
});
describe("godrays: godraysPassState (puerta por frame)", () => {
  it("sol de frente lateral (no ocluido) -> visible con UV en [0,1]", () => {
    const { vp, cam } = setup();
    // Sol al frente-lateral: en frustum y sin la Tierra en medio (desde
    // (0,0,3) el sol tras la Tierra se apaga por puerta de limbo, como manda).
    const st = godraysPassState(vp, cam, vec3Normalize([0.5, 0.15, -1]));
    expect(st.visible).toBe(true);
    expect(st.sunUV[0] >= 0 && st.sunUV[0] <= 1 && st.sunUV[1] >= 0 && st.sunUV[1] <= 1).toBe(true);
  });

  it("sol detras o fuera o tras limbo -> apagado", () => {
    const { vp, cam } = setup();
    expect(godraysPassState(vp, cam, [0, 0, 1]).visible).toBe(false);
    expect(godraysPassState(vp, cam, vec3Normalize([0.2, 3, -1])).visible).toBe(false);
    // Camara mirando al sol con la Tierra en medio (limbo): el rayo
    // camara->sol cruza la Tierra -> puerta por oclusion.
    const limb = godraysPassState(vp, [0, 0, 3], vec3Normalize([-1, 0, -2.9]));
    expect(limb.visible).toBe(false);
  });
});
