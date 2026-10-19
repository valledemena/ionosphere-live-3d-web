import { describe, expect, it } from "vitest";
import {
  parseRbe,
  beltOuterL,
  rbeGlow,
  driftAngle,
  BELT_INNER_L,
} from "./belts";

// Evento REAL DONKI el 2026-10-10 (forma pineada).
const RBE = [
  {
    rbeID: "2026-10-10T14:35:00-RBE-001",
    eventTime: "2026-10-10T14:35Z",
    instruments: [{ displayName: "GOES-P: SEISS >2MeV" }],
    link: "https://ccmc.gsfc.nasa.gov/DONKI/view/RBE/49055/-1",
    linkedEvents: [{ activityID: "2026-10-10T14:30:00-HSS-001" }],
    sentNotifications: [],
    submissionTime: "2026-10-10T15:05Z",
    versionId: 1,
  },
];

describe("parseRbe (forma DONKI pineada)", () => {
  it("evento con instrumento y link", () => {
    const [e] = parseRbe(RBE);
    expect(e.id).toBe("2026-10-10T14:35:00-RBE-001");
    expect(e.time).toBe(Date.parse("2026-10-10T14:35:00Z"));
    expect(e.instrument).toBe("GOES-P: SEISS >2MeV");
    expect(e.link).toContain("ccmc.gsfc.nasa.gov/DONKI/view/RBE");
  });
  it("basura -> []", () => {
    expect(parseRbe(null)).toEqual([]);
    expect(parseRbe([null, 7])).toHaveLength(0);
  });
});

describe("cinturones parametricos (declarados O19)", () => {
  it("interno estable L 1.5, externo 4.2+0.08*Kp", () => {
    expect(BELT_INNER_L).toBe(1.5);
    expect(beltOuterL(0)).toBe(4.2);
    expect(beltOuterL(9)).toBeCloseTo(4.92, 10);
  });
  it("brillo RBE decae en ~14 dias", () => {
    const t0 = Date.parse("2026-10-10T14:35:00Z");
    expect(rbeGlow(t0, t0)).toBe(1);
    expect(rbeGlow(t0, t0 + 14 * 86400_000)).toBeCloseTo(Math.exp(-1), 10);
    expect(rbeGlow(null, t0)).toBe(0);
  });
});

describe("deriva (direccion fisica O19)", () => {
  it("protones oeste (-), electrones este (+)", () => {
    expect(driftAngle(100, "protons")).toBeLessThan(0);
    expect(driftAngle(100, "electrons")).toBeGreaterThan(0);
    expect(driftAngle(0, "protons")).toBeCloseTo(0, 10); // -0 === 0 aqui
    expect(driftAngle(100, "protons")).toBe(-driftAngle(100, "electrons"));
  });
});
