/**
 * TU de contrato del wiring (reparo n1 del veredicto 156, P1 del 157):
 * el modelo web entrega clase letra+magnitud ("M5.0") o "\u2014" sin dato;
 * el motor espera 1 char. Este TU habria cazado el canal X-ray muerto.
 * Vitest.
 */
import { describe, expect, it } from "vitest";
import {
  AlertEngine,
  AlertLevel,
  AlertRule,
  buildAlertInput,
  type SwLike,
} from "./alerts";

function swFlat(): SwLike {
  return {
    kp: { now: 2.0, source: "NOAA SWPC (live)" },
    wind: { bz: 1.0, t: "2026-10-06T00:00:00" },
    xray: { class: "B1.0" },
  };
}

describe("contrato del wiring", () => {
  it('"M5.0" -> char "M", xrayOk true', () => {
    const sw = swFlat();
    sw.xray.class = "M5.0";
    const inp = buildAlertInput(sw, [], 1000);
    expect(inp.xrayClass).toBe("M");
    expect(inp.xrayOk).toBe(true);
  });

  it('"\u2014" sin dato -> xrayOk false (OFF honesto, no GREEN)', () => {
    const sw = swFlat();
    sw.xray.class = "\u2014";
    const inp = buildAlertInput(sw, [], 1000);
    expect(inp.xrayOk).toBe(false);
  });

  it("kp source unavailable -> kpOk false (P2)", () => {
    const sw = swFlat();
    sw.kp.source = "unavailable";
    const inp = buildAlertInput(sw, [], 1000);
    expect(inp.kpOk).toBe(false);
  });

  it("sw null -> todo OFF salvo MUF sin muestras", () => {
    const inp = buildAlertInput(null, [], 1000);
    expect(inp.kpOk).toBe(false);
    expect(inp.bzOk).toBe(false);
    expect(inp.xrayOk).toBe(false);
    expect(inp.mufOk).toBe(false);
  });

  it("mediana MUF superior, nulos y no-positivos fuera", () => {
    const inp = buildAlertInput(swFlat(), [10, null, 30, 0, 20, -5, undefined], 1000);
    expect(inp.mufOk).toBe(true);
    expect(inp.muf).toBe(20);
  });

  it("regresion n1: M5.0 dos muestras -> XRAY RED; \u2014 -> OFF", () => {
    const e = new AlertEngine();
    const sw = swFlat();
    sw.xray.class = "M5.0";
    e.evaluate(buildAlertInput(sw, [], 1000));
    expect(e.level(AlertRule.XRAY)).not.toBe(AlertLevel.RED);
    e.evaluate(buildAlertInput(sw, [], 1100));
    expect(e.level(AlertRule.XRAY)).toBe(AlertLevel.RED);
    sw.xray.class = "\u2014";
    e.evaluate(buildAlertInput(sw, [], 1200));
    expect(e.level(AlertRule.XRAY)).toBe(AlertLevel.OFF);
  });
});
