import { describe, expect, it } from "vitest";
import {
  parseEnlilSims,
  pickCmeEvent,
  cmeProgress,
  cmeArrived,
  cmeCountdown,
  lapseFactor,
  cmeEffectiveDp,
  CME_COMPRESSION_DEMO,
} from "./cme";

// Fixture REAL: respuesta del CCMC el 2026-10-14 (forma pineada en cme.ts).
// WSA-ENLIL/49092/1: geoefectiva (isEarthGB), ETA 2026-10-14T11:30Z.
const SIM_GB = {
  simulationID: "WSA-ENLIL/49092/1",
  modelCompletionTime: "2026-10-12T13:04Z",
  au: 2.0,
  cmeInputs: [
    {
      cmeStartTime: "2026-10-12T05:09Z",
      latitude: -1.0,
      longitude: -31.0,
      speed: 741.0,
      halfAngle: 27.0,
      time21_5: "2026-10-12T09:12Z",
      featureCode: "LE",
      isMostAccurate: true,
      levelOfData: 0,
      ipsList: [],
      CMEID: "2026-10-12T05:09:00-CME-001",
    },
  ],
  estimatedShockArrivalTime: "2026-10-14T11:30Z",
  isEarthGB: true,
  isEarthMinorImpact: false,
  rmin_re: null,
  kp_18: null,
  kp_90: 4,
  kp_135: 5,
  kp_180: 6,
  estimatedDuration: null,
  impactList: [],
  link: "https://ccmc.gsfc.nasa.gov/DONKI/view/WSA-ENLIL/49092/-1",
};

// Misma ventana real: sin ETA (no geoefectiva / sin pronostico).
const SIM_NOETA = {
  simulationID: "WSA-ENLIL/49086/1",
  modelCompletionTime: "2026-10-12T01:45Z",
  cmeInputs: [
    {
      cmeStartTime: "2026-10-11T23:15Z",
      latitude: -9.0,
      longitude: 30.0,
      speed: 457.0,
      halfAngle: 10.0,
      time21_5: "2026-10-12T04:25Z",
      featureCode: "LE",
      isMostAccurate: true,
      CMEID: "2026-10-11T23:15:00-CME-001",
    },
  ],
  estimatedShockArrivalTime: null,
  isEarthGB: false,
  kp_90: null,
  kp_135: null,
  kp_180: null,
  estimatedDuration: null,
  impactList: [{ location: "Solar Orbiter", arrivalTime: "2026-10-14T22:00Z" }],
  link: "https://ccmc.gsfc.nasa.gov/DONKI/view/WSA-ENLIL/49086/-1",
};

const T0 = Date.parse("2026-10-12T09:12:00Z"); // time21_5 del fixture
const TA = Date.parse("2026-10-14T11:30:00Z"); // ETA del fixture

describe("parseEnlilSims (forma CCMC pineada)", () => {
  it("parsea el fixture geoefectivo completo", () => {
    const [s] = parseEnlilSims([SIM_GB]);
    expect(s.simulationId).toBe("WSA-ENLIL/49092/1");
    expect(s.estimatedShockArrivalTime).toBe(TA);
    expect(s.isEarthGB).toBe(true);
    expect(s.kpMax).toBe(6);
    expect(s.inputs).toHaveLength(1);
    expect(s.inputs[0].speed).toBe(741);
    expect(s.inputs[0].halfAngle).toBe(27);
    expect(s.inputs[0].time21_5).toBe(T0);
    expect(s.inputs[0].isMostAccurate).toBe(true);
  });
  it("ETA null y kp nulos -> nulls honestos", () => {
    const [s] = parseEnlilSims([SIM_NOETA]);
    expect(s.estimatedShockArrivalTime).toBeNull();
    expect(s.kpMax).toBeNull();
    expect(s.isEarthGB).toBe(false);
  });
  it("basura defensiva -> [] (O1.1 reposo, jamas ficticio)", () => {
    expect(parseEnlilSims(null)).toEqual([]);
    expect(parseEnlilSims({})).toEqual([]);
    expect(parseEnlilSims("WSA-ENLIL")).toEqual([]);
    expect(parseEnlilSims([null, 42, "x"])).toEqual([]);
  });
});

describe("pickCmeEvent (O1.1 sin hardcode)", () => {
  it("elige la ultima CON ETA y extrae velocidad/direccion (O1.4)", () => {
    const sel = pickCmeEvent(parseEnlilSims([SIM_NOETA, SIM_GB]));
    expect(sel.status).toBe("event");
    if (sel.status !== "event") return;
    expect(sel.simId).toBe("WSA-ENLIL/49092/1");
    expect(sel.arrival).toBe(TA);
    expect(sel.start).toBe(T0);
    expect(sel.earthGB).toBe(true);
    expect(sel.speed).toBe(741);
    expect(sel.halfAngle).toBe(27);
    expect(sel.srcLat).toBe(-1);
    expect(sel.srcLon).toBe(-31);
    expect(sel.kpMax).toBe(6);
  });
  it("sin ETA en ninguna -> quiet con marca temporal", () => {
    const sel = pickCmeEvent(parseEnlilSims([SIM_NOETA]));
    expect(sel.status).toBe("quiet");
    if (sel.status !== "quiet") return;
    expect(sel.simCount).toBe(1);
    expect(sel.modelTime).toBe(Date.parse("2026-10-12T01:45:00Z"));
  });
  it("vacio -> unknown", () => {
    expect(pickCmeEvent([])).toEqual({ status: "unknown" });
  });
});

describe("progreso y llegada (O1.3/O1.5)", () => {
  it("progreso lineal 0..1 con clamps", () => {
    expect(cmeProgress(T0, TA, T0 - 1000)).toBe(0);
    expect(cmeProgress(T0, TA, TA + 1000)).toBe(1);
    expect(cmeProgress(T0, TA, (T0 + TA) / 2)).toBeCloseTo(0.5, 10);
  });
  it("sin inicio -> binario declarado", () => {
    expect(cmeProgress(null, TA, TA - 1)).toBe(0);
    expect(cmeProgress(null, TA, TA)).toBe(1);
  });
  it("llegada consumada", () => {
    expect(cmeArrived(T0, TA, TA - 1)).toBe(false);
    expect(cmeArrived(T0, TA, TA)).toBe(true);
  });
  it("cuenta atras honesta", () => {
    expect(cmeCountdown(TA, TA)).toBe("ahora");
    expect(cmeCountdown(TA, TA - 30 * 60_000)).toBe("en 30 min");
    expect(cmeCountdown(TA, TA - 50 * 3600_000)).toBe("en 2 d 2 h");
    expect(cmeCountdown(TA, TA + 3 * 3600_000)).toBe("llego hace 3 h 0 min");
  });
  it("factor xN del barrido (O1.5)", () => {
    // Transito del fixture: 50.3 h comprimidas a 8 s -> x22635.
    expect(lapseFactor(T0, TA, 8000)).toBe(22635);
    expect(lapseFactor(null, TA)).toBe(1);
  });
});

describe("encadenado #4 (O1.3, factor demo declarado)", () => {
  it("boost x1.6 solo con llegada geoefectiva", () => {
    expect(CME_COMPRESSION_DEMO).toBe(1.6);
    expect(cmeEffectiveDp(2, true, true)).toBeCloseTo(3.2, 10);
    expect(cmeEffectiveDp(2, true, false)).toBe(2);
    expect(cmeEffectiveDp(2, false, true)).toBe(2);
  });
});
