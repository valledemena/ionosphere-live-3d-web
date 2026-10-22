import { describe, expect, it } from "vitest";
import {
  FARADAY_DEG_PER_MHZ2_NT,
  FaradayPoint,
  faradayRotationDeg,
  volumeFaradayDeg,
} from "./faraday";
import { DensityVolume } from "./densityVolume";

/** Sampler fijo para tests analíticos (Ne en m⁻³, B en nT). */
const constSampler = (neM3: number, bNt: [number, number, number]) => () => ({
  neM3,
  bNt,
});

describe("faradayRotationDeg — caso analítico 4056°", () => {
  it("ecuador radial 100→200 km, Ne=1e11, B=[30000,0,0] nT, 10 MHz ≈ 4056°", () => {
    // Marco WEB de latLonToVec3 (geo.ts:5): lon 0 → +X, Y = norte.
    // En lat=0, lon=0 la vertical local es exactamente +X:
    //   latLonToVec3(0,0,R+100) = (R+100, 0, 0)  ⇒ û = (1,0,0) exacto.
    // Con B=[30000,0,0] nT (paralelo a +X): bPar = 30000 nT.
    // dl = 100 km = 1e5 m; I = 1e11·3e4·1e5 = 3e20.
    // Ω_deg = 1.3522e-15·3e20/100 ≈ 4056.6°. (Con el B real en ese punto
    // bPar sería ≈1300 nT; los 30000 nT son un valor de test controlado.)
    const points: FaradayPoint[] = [
      { lat: 0, lon: 0, altKm: 100 },
      { lat: 0, lon: 0, altKm: 200 },
    ];
    const deg = faradayRotationDeg(points, 10, constSampler(1e11, [30000, 0, 0]));
    expect(deg).not.toBeNull();
    expect(deg!).toBeCloseTo(4056.6, 0);
    expect(FARADAY_DEG_PER_MHZ2_NT).toBe(1.3522e-15);
  });

  it("dependencia 1/f² exacta: 20 MHz = ¼ del valor a 10 MHz", () => {
    const points: FaradayPoint[] = [
      { lat: 0, lon: 0, altKm: 100 },
      { lat: 0, lon: 0, altKm: 200 },
    ];
    const s = constSampler(1e11, [30000, 0, 0]);
    const d10 = faradayRotationDeg(points, 10, s)!;
    const d20 = faradayRotationDeg(points, 20, s)!;
    expect(d20).toBeCloseTo(d10 / 4, 9);
  });

  it("invertir la trayectoria invierte el signo con |Ω| idéntico", () => {
    const s = constSampler(1e11, [30000, 0, 0]);
    const fwd = faradayRotationDeg(
      [
        { lat: 0, lon: 0, altKm: 100 },
        { lat: 0, lon: 0, altKm: 200 },
      ],
      10,
      s
    )!;
    const bwd = faradayRotationDeg(
      [
        { lat: 0, lon: 0, altKm: 200 },
        { lat: 0, lon: 0, altKm: 100 },
      ],
      10,
      s
    )!;
    expect(bwd).toBeCloseTo(-fwd, 6);
    expect(Math.abs(bwd)).toBeCloseTo(Math.abs(fwd), 6);
  });

  it("blindaje de unidades: Ne×2 ⇒ Ω×2, B×2 ⇒ Ω×2, camino×2 ⇒ Ω×2", () => {
    const base: FaradayPoint[] = [
      { lat: 0, lon: 0, altKm: 100 },
      { lat: 0, lon: 0, altKm: 200 },
    ];
    const doubledPath: FaradayPoint[] = [
      { lat: 0, lon: 0, altKm: 100 },
      { lat: 0, lon: 0, altKm: 300 },
    ];
    const d0 = faradayRotationDeg(base, 10, constSampler(1e11, [30000, 0, 0]))!;
    const dNe = faradayRotationDeg(base, 10, constSampler(2e11, [30000, 0, 0]))!;
    const dB = faradayRotationDeg(base, 10, constSampler(1e11, [60000, 0, 0]))!;
    const dPath = faradayRotationDeg(doubledPath, 10, constSampler(1e11, [30000, 0, 0]))!;
    expect(dNe).toBeCloseTo(d0 * 2, 6);
    expect(dB).toBeCloseTo(d0 * 2, 6);
    expect(dPath).toBeCloseTo(d0 * 2, 6);
  });
});

describe("faradayRotationDeg — guards", () => {
  const ok = faradayRotationDeg(
    [
      { lat: 0, lon: 0, altKm: 100 },
      { lat: 0, lon: 0, altKm: 200 },
    ],
    10,
    constSampler(1e11, [30000, 0, 0])
  );

  it("un solo punto ⇒ null", () => {
    expect(faradayRotationDeg([{ lat: 0, lon: 0, altKm: 100 }], 10, constSampler(1e11, [1, 0, 0]))).toBeNull();
  });

  it("freq ≤ 0 o no finita ⇒ null", () => {
    const pts: FaradayPoint[] = [
      { lat: 0, lon: 0, altKm: 100 },
      { lat: 0, lon: 0, altKm: 200 },
    ];
    expect(faradayRotationDeg(pts, 0, constSampler(1e11, [1, 0, 0]))).toBeNull();
    expect(faradayRotationDeg(pts, -5, constSampler(1e11, [1, 0, 0]))).toBeNull();
    expect(faradayRotationDeg(pts, NaN, constSampler(1e11, [1, 0, 0]))).toBeNull();
  });

  it("punto con lat/lon/alt no finitos ⇒ null", () => {
    const bad = faradayRotationDeg(
      [
        { lat: NaN, lon: 0, altKm: 100 },
        { lat: 0, lon: 0, altKm: 200 },
      ],
      10,
      constSampler(1e11, [1, 0, 0])
    );
    expect(bad).toBeNull();
  });

  it("sampler con Ne o B no finitos ⇒ null", () => {
    expect(
      faradayRotationDeg(
        [
          { lat: 0, lon: 0, altKm: 100 },
          { lat: 0, lon: 0, altKm: 200 },
        ],
        10,
        constSampler(NaN, [30000, 0, 0])
      )
    ).toBeNull();
    expect(ok).not.toBeNull();
  });

  it("V1: punto duplicado (segmento degenerado) ⇒ resultado finito, no NaN", () => {
    // Simula el punto de suelo duplicado entre saltos de hf.ts.
    const pts: FaradayPoint[] = [
      { lat: 10, lon: 20, altKm: 0 },
      { lat: 10, lon: 20, altKm: 0 }, // duplicado exacto
      { lat: 12, lon: 22, altKm: 150 },
    ];
    const deg = faradayRotationDeg(pts, 10, constSampler(1e11, [20000, 1000, 0]));
    expect(deg).not.toBeNull();
    expect(Number.isFinite(deg!)).toBe(true);
  });

  it("V5: viable===0 en un extremo omite el segmento (trayectoria sin viables ⇒ 0)", () => {
    const pts: FaradayPoint[] = [
      { lat: 0, lon: 0, altKm: 100, viable: 0 },
      { lat: 0, lon: 0, altKm: 200, viable: 0 },
    ];
    const deg = faradayRotationDeg(pts, 10, constSampler(1e11, [30000, 0, 0]));
    expect(deg).toBe(0);
  });

  it("V5-puente: viable 1,0,1 NO integra p0→p2 (no se salta el salto central)", () => {
    // Trayectoria [p0(v=1), p1(v=0), p2(v=1)]: los dos segmentos de la
    // trayectoria real tienen un extremo viable=0 ⇒ ambos se omiten ⇒ 0.
    // Si se filtraran los puntos antes (filter viable>0) quedaría [p0, p2]
    // ADYACENTES y se integraría el puente p0→p2 (rayo inexistente) dando >0.
    // Sampler no nulo para que cualquier puente sea visible (>0).
    const pts: FaradayPoint[] = [
      { lat: 0, lon: 0, altKm: 100, viable: 1 },
      { lat: 0, lon: 40, altKm: 150, viable: 0 }, // salto intermedio no viable
      { lat: 0, lon: 80, altKm: 100, viable: 1 },
    ];
    const deg = faradayRotationDeg(pts, 10, constSampler(1e11, [30000, 0, 0]));
    expect(deg).toBe(0);

    // Control: con el mismo camino todo viable SÍ integra (el sampler no es
    // la causa del 0).
    const allOk = pts.map((p) => ({ ...p, viable: 1 }));
    const degFull = faradayRotationDeg(allOk, 10, constSampler(1e11, [30000, 0, 0]));
    expect(degFull).not.toBeNull();
    expect(Math.abs(degFull!)).toBeGreaterThan(0);
  });
});

describe("volumeFaradayDeg", () => {
  const volOk: DensityVolume = {
    lonRes: 2,
    latRes: 2,
    altRes: 2,
    altMinKm: 60,
    altMaxKm: 500,
    data: new Array(2 * 2 * 2).fill(0.5),
    layer: new Array(2 * 2 * 2).fill(3),
    valid: true,
    timestamp: 1,
  };
  const pts: FaradayPoint[] = [
    { lat: 0, lon: -30, altKm: 300 },
    { lat: 0, lon: 30, altKm: 300 },
  ];

  it("DensityVolume mínimo válido ⇒ número finito", () => {
    const deg = volumeFaradayDeg(pts, 14, volOk);
    expect(deg).not.toBeNull();
    expect(Number.isFinite(deg!)).toBe(true);
  });

  it("valid:false ⇒ null", () => {
    expect(volumeFaradayDeg(pts, 14, { ...volOk, valid: false })).toBeNull();
  });

  it("data vacío ⇒ null; v=null ⇒ null", () => {
    expect(volumeFaradayDeg(pts, 14, { ...volOk, data: [] })).toBeNull();
    expect(volumeFaradayDeg(pts, 14, null)).toBeNull();
  });

  it("consistencia de unidades con la coordenada: no hay factor 1e6 oculto", () => {
    // Ne normalizado a 0.5 ⇒ logNe = 8 + 4.5·0.5 = 10.25 ⇒ Ne = 10^10.25 m⁻³.
    // Un valor con factor 1e6 oculto desviaría el resultado ~1e6×.
    const deg = volumeFaradayDeg(pts, 14, volOk)!;
    expect(Math.abs(deg)).toBeGreaterThan(1);
    expect(Math.abs(deg)).toBeLessThan(1e7);
  });
});
