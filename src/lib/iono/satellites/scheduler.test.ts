// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — TU del scheduler de barridos del eco 2026 (drop 321,
// F2b #10, ruling 320). Reloj inyectado (nowMs): sin temporizadores reales.
// Cubre: suelo 256, presupuesto adaptativo, cadencia >=0.5 s entre INICIOS
// de barrido y cobertura completa sin huecos ni solapes.

import { describe, expect, it } from "vitest";
import {
  SWEEP_CADENCE_MS,
  SWEEP_FLOOR,
  createSweepScheduler,
} from "./scheduler";

describe("createSweepScheduler", () => {
  it("primer slice: arranca en 0 con el suelo de 256", () => {
    const s = createSweepScheduler(15927);
    expect(s.plan(0)).toEqual({ from: 0, count: SWEEP_FLOOR });
    expect(s.sweepCount()).toBe(1);
  });

  it("un barrido completo cubre [0,total) exactamente una vez", () => {
    const total = 15927;
    const s = createSweepScheduler(total);
    const seen = new Uint8Array(total);
    let t = 0;
    let slices = 0;
    let covered = 0;
    while (covered < total) {
      const slice = s.plan(t);
      expect(slice).not.toBeNull();
      if (!slice) break;
      slices++;
      for (let i = slice.from; i < slice.from + slice.count; i++) {
        expect(seen[i]).toBe(0); // sin solapes
        seen[i] = 1;
        covered++;
      }
      // coste real ~3 ms de presupuesto: el lote no crece ni mengua.
      s.report(slice.count, 3);
      t += 16;
      if (slices > 200) throw new Error("barrido no termina");
    }
    expect(slices).toBe(Math.ceil(total / SWEEP_FLOOR));
    expect(seen.every((v) => v === 1)).toBe(true);
  });

  it("cadencia: tras completar, espera >=0.5 s entre INICIOS de barrido", () => {
    const s = createSweepScheduler(512);
    const t0 = 1000;
    expect(s.plan(t0)).toEqual({ from: 0, count: 256 });
    expect(s.plan(t0 + 16)).toEqual({ from: 256, count: 256 });
    // Barrido 1 completo en el cursor; con t < t0+500 no hay barrido nuevo.
    expect(s.plan(t0 + 32)).toBeNull();
    expect(s.plan(t0 + SWEEP_CADENCE_MS - 1)).toBeNull();
    const again = s.plan(t0 + SWEEP_CADENCE_MS);
    expect(again).toEqual({ from: 0, count: 256 }); // barrido 2
    expect(s.sweepCount()).toBe(2);
  });

  it("adaptacion: coste alto -> el lote jamas baja del suelo (256)", () => {
    const s = createSweepScheduler(15927);
    s.plan(0);
    s.report(256, 12); // 4x sobre presupuesto -> factor 0.5
    s.report(256, 50); // 16x sobre presupuesto
    expect(s.batchSize()).toBe(SWEEP_FLOOR);
    expect(s.plan(16)).toEqual({ from: 256, count: 256 });
  });

  it("adaptacion: coste bajo -> sube el lote (hasta total)", () => {
    const s = createSweepScheduler(15927);
    s.plan(0);
    s.report(256, 0.5); // factor 2 (clamp)
    expect(s.batchSize()).toBe(512);
    expect(s.plan(16)).toEqual({ from: 256, count: 512 });
    s.report(512, 0.1);
    expect(s.batchSize()).toBe(1024);
    s.report(512, 0.1);
    expect(s.batchSize()).toBe(2048);
    expect(s.plan(32)?.count).toBe(2048);
  });

  it("total 0: no hay trabajo", () => {
    const s = createSweepScheduler(0);
    expect(s.plan(0)).toBeNull();
    expect(s.sweepCount()).toBe(0);
  });

  it("total menor que el suelo: un unico slice con todo", () => {
    const s = createSweepScheduler(100);
    expect(s.plan(0)).toEqual({ from: 0, count: 100 });
    expect(s.plan(16)).toBeNull();
  });
});
