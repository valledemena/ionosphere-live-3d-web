/**
 * TU W-2 alert (spec del veredicto 152, P3): casos borde replicados del TU
 * C++ (drop 139, norma 144). Vitest.
 */
import { describe, expect, it } from "vitest";
import { AlertEngine, AlertLevel, AlertRule, type AlertInput } from "./alerts";

function base(utc: number): AlertInput {
  return {
    utc,
    kpOk: true,
    kp: 2.0,
    bzOk: true,
    bz: 1.0,
    xrayOk: true,
    xrayClass: "B",
    mufOk: true,
    muf: 20.0,
  };
}

// Siembra historia MUF suficiente: 6 muestras a 20 MHz en 4 h.
function seedMuf(e: AlertEngine, t0: number): void {
  for (let i = 0; i < 6; i++) e.evaluate(base(t0 + (i * 3600 * 4) / 5));
}

describe("umbrales del catalogo", () => {
  it("Kp 5 -> RED tras 2 seguidas (1 sola no latchea)", () => {
    const e = new AlertEngine();
    seedMuf(e, 1000000);
    expect(e.overall()).toBe(AlertLevel.GREEN);
    const a = base(2000000);
    a.kp = 5.0;
    e.evaluate(a);
    expect(e.level(AlertRule.KP)).not.toBe(AlertLevel.RED);
    e.evaluate(a);
    expect(e.level(AlertRule.KP)).toBe(AlertLevel.RED);
    expect(e.overall()).toBe(AlertLevel.RED);
    const b = base(2000100);
    b.kp = 3.0;
    e.evaluate(b);
    expect(e.level(AlertRule.KP)).toBe(AlertLevel.GREEN);
  });

  it("Bz -11 -> RED, 0 -> GREEN, -7 -> AMBER", () => {
    const e = new AlertEngine();
    seedMuf(e, 1000000);
    const a = base(2000000);
    a.bz = -11.0;
    e.evaluate(a);
    e.evaluate(a);
    expect(e.level(AlertRule.BZ)).toBe(AlertLevel.RED);
    const b = base(2000100);
    b.bz = 0.0;
    e.evaluate(b);
    expect(e.level(AlertRule.BZ)).toBe(AlertLevel.GREEN);
    const c = base(2000200);
    c.bz = -7.0;
    e.evaluate(c);
    expect(e.level(AlertRule.BZ)).toBe(AlertLevel.AMBER);
  });

  it("X-ray M -> RED, C -> AMBER", () => {
    const e = new AlertEngine();
    seedMuf(e, 1000000);
    const a = base(2000000);
    a.xrayClass = "M";
    e.evaluate(a);
    e.evaluate(a);
    expect(e.level(AlertRule.XRAY)).toBe(AlertLevel.RED);
    const b = base(2000100);
    b.xrayClass = "C";
    e.evaluate(b);
    expect(e.level(AlertRule.XRAY)).toBe(AlertLevel.AMBER);
  });

  it("MUF -30% -> RED, -15% -> AMBER, sin caida -> GREEN", () => {
    const e = new AlertEngine();
    seedMuf(e, 1910000); // mediana 20 MHz (ventana <24 h)
    const a = base(1930000);
    a.muf = 14.0;
    e.evaluate(a);
    e.evaluate(a);
    expect(e.level(AlertRule.MUF)).toBe(AlertLevel.RED);
    const b = base(1930100);
    b.muf = 17.0;
    e.evaluate(b);
    expect(e.level(AlertRule.MUF)).toBe(AlertLevel.AMBER);
    const c = base(1930200);
    c.muf = 20.0;
    e.evaluate(c);
    expect(e.level(AlertRule.MUF)).toBe(AlertLevel.GREEN);
  });
});

describe("dato faltante e historia insuficiente", () => {
  it("Bz ausente -> OFF con valor basura, global intacto", () => {
    const e = new AlertEngine();
    seedMuf(e, 1000000);
    const a = base(2000000);
    a.bzOk = false;
    a.bz = -50.0;
    e.evaluate(a);
    e.evaluate(a);
    expect(e.level(AlertRule.BZ)).toBe(AlertLevel.OFF);
    expect(e.overall()).toBe(AlertLevel.GREEN);
  });

  it("MUF sin historia (0 y 2 muestras) -> OFF", () => {
    const e = new AlertEngine();
    e.evaluate(base(1000000));
    expect(e.level(AlertRule.MUF)).toBe(AlertLevel.OFF);
    e.evaluate(base(1000600));
    expect(e.level(AlertRule.MUF)).toBe(AlertLevel.OFF);
  });
});

describe("cola de eventos", () => {
  it("transicion registrada con regla/from/to y cota 32", () => {
    const e = new AlertEngine();
    seedMuf(e, 1000000);
    const n0 = e.events().length;
    const a = base(2000000);
    a.kp = 5.0;
    e.evaluate(a);
    e.evaluate(a);
    expect(e.events().length).toBeGreaterThan(n0);
    const ev = e.events()[e.events().length - 1];
    expect(ev.rule).toBe(AlertRule.KP);
    expect(ev.to).toBe(AlertLevel.RED);
    expect(e.events().length).toBeLessThanOrEqual(32);
  });
});

// --- drop 353: umbrales rojos configurables ---
import {
  AlertEngine as AE353,
  AlertLevel as AL353,
  AlertRule as AR353,
  DEFAULT_ALERT_THRESHOLDS,
  normalizeAlertThresholds,
} from "./alerts";

describe("drop 353: umbrales rojos configurables", () => {
  it("defaults identicos al catalogo (tests base intactos)", () => {
    expect(DEFAULT_ALERT_THRESHOLDS).toEqual({ kpRed: 5, bzRed: -10, xrayRedRank: 3, mufRedDrop: 0.2 });
  });

  it("Kp custom: RED a 4.5 con debounce", () => {
    const e = new AE353({ ...DEFAULT_ALERT_THRESHOLDS, kpRed: 4.5 });
    const a = base(1000);
    a.kp = 4.5;
    e.evaluate(a);
    e.evaluate(a);
    expect(e.level(AR353.KP)).toBe(AL353.RED);
  });

  it("Bz custom: RED a -7 con debounce", () => {
    const e = new AE353({ ...DEFAULT_ALERT_THRESHOLDS, bzRed: -7 });
    const a = base(2000);
    a.bz = -7;
    e.evaluate(a);
    e.evaluate(a);
    expect(e.level(AR353.BZ)).toBe(AL353.RED);
  });

  it("X-ray custom: RED con C (rank 2)", () => {
    const e = new AE353({ ...DEFAULT_ALERT_THRESHOLDS, xrayRedRank: 2 });
    const a = base(3000);
    a.xrayClass = "C";
    e.evaluate(a);
    e.evaluate(a);
    expect(e.level(AR353.XRAY)).toBe(AL353.RED);
  });

  it("setThresholds conserva la historia MUF (RED al 15%)", () => {
    const e = new AE353();
    // historia: 8 muestras cada 30 min (span 3.5 h >= 3 h) con muf ~20
    let utc = 100000;
    for (let i = 0; i < 8; i++) {
      const a = base(utc);
      a.muf = 20;
      e.evaluate(a);
      utc += 1800;
    }
    expect(e.mufSamples()).toBeGreaterThanOrEqual(8);
    e.setThresholds({ ...DEFAULT_ALERT_THRESHOLDS, mufRedDrop: 0.15 });
    expect(e.mufSamples()).toBeGreaterThanOrEqual(8); // historia intacta
    const b = base(utc);
    b.muf = 17; // caida 15% -> RED con el umbral nuevo (20% no)
    e.evaluate(b);
    e.evaluate(b);
    expect(e.level(AR353.MUF)).toBe(AL353.RED);
  });

  it("normalizeAlertThresholds: clamps y basura", () => {
    expect(normalizeAlertThresholds(null)).toEqual(DEFAULT_ALERT_THRESHOLDS);
    expect(normalizeAlertThresholds({ kpRed: "x" })).toEqual(DEFAULT_ALERT_THRESHOLDS);
    expect(normalizeAlertThresholds({ kpRed: NaN })).toEqual(DEFAULT_ALERT_THRESHOLDS);
    const c = normalizeAlertThresholds({ kpRed: 99, bzRed: -99, xrayRedRank: 9, mufRedDrop: 0.99 });
    expect(c.kpRed).toBe(9);
    expect(c.bzRed).toBe(-30);
    expect(c.xrayRedRank).toBe(4);
    expect(c.mufRedDrop).toBe(0.5);
    const lo = normalizeAlertThresholds({ kpRed: 1, bzRed: 0, xrayRedRank: 0, mufRedDrop: 0 });
    expect(lo.kpRed).toBe(4);
    expect(lo.bzRed).toBe(-5);
    expect(lo.xrayRedRank).toBe(2);
    expect(lo.mufRedDrop).toBe(0.1);
    // pasos: 4.3 -> 4.5; muf 0.12 -> 0.10 (paso 0.05)
    const s = normalizeAlertThresholds({ kpRed: 4.3, mufRedDrop: 0.12 });
    expect(s.kpRed).toBe(4.5);
    expect(s.mufRedDrop).toBeCloseTo(0.1, 5);
  });
});
