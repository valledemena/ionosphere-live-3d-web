/**
 * TU drop 353: preferencias de alertas persistentes — roundtrip, JSON
 * corrupto, campos ausentes y storage nulo. Puro (storage falso, sin DOM).
 */
import { describe, expect, it } from "vitest";
import {
  ALERT_PREFS_KEY,
  DEFAULT_ALERT_PREFS,
  loadAlertPrefs,
  normalizeAlertPrefs,
  saveAlertPrefs,
} from "./alertPrefs";
import { DEFAULT_ALERT_THRESHOLDS } from "./alerts";

function fakeStorage(initial?: Record<string, string>) {
  const m = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    _m: m,
  };
}

describe("alertPrefs (drop 353)", () => {
  it("defaults honestos", () => {
    expect(DEFAULT_ALERT_PREFS).toEqual({
      thresholds: DEFAULT_ALERT_THRESHOLDS,
      toast: true,
      sound: false,
    });
  });

  it("roundtrip save/load", () => {
    const s = fakeStorage();
    const p = {
      thresholds: { kpRed: 4.5, bzRed: -7, xrayRedRank: 2, mufRedDrop: 0.15 },
      toast: false,
      sound: true,
    };
    saveAlertPrefs(s, p);
    expect(s._m.has(ALERT_PREFS_KEY)).toBe(true);
    expect(loadAlertPrefs(s)).toEqual(p);
  });

  it("JSON corrupto -> defaults", () => {
    const s = fakeStorage({ [ALERT_PREFS_KEY]: "{no json" });
    expect(loadAlertPrefs(s)).toEqual(DEFAULT_ALERT_PREFS);
  });

  it("campos ausentes o de tipo erroneo -> defaults individuales", () => {
    const s = fakeStorage({ [ALERT_PREFS_KEY]: JSON.stringify({ sound: "yes" }) });
    const p = loadAlertPrefs(s);
    expect(p.sound).toBe(false);
    expect(p.toast).toBe(true);
    expect(p.thresholds).toEqual(DEFAULT_ALERT_THRESHOLDS);
    expect(normalizeAlertPrefs({ thresholds: { kpRed: 6 } }).thresholds.kpRed).toBe(6);
  });

  it("storage nulo/lanzador -> no explota", () => {
    expect(loadAlertPrefs(null)).toEqual(DEFAULT_ALERT_PREFS);
    expect(loadAlertPrefs(undefined)).toEqual(DEFAULT_ALERT_PREFS);
    const bad = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(loadAlertPrefs(bad)).toEqual(DEFAULT_ALERT_PREFS);
    expect(() => saveAlertPrefs(bad, DEFAULT_ALERT_PREFS)).not.toThrow();
    expect(() => saveAlertPrefs(null, DEFAULT_ALERT_PREFS)).not.toThrow();
  });
});
