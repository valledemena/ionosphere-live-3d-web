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
