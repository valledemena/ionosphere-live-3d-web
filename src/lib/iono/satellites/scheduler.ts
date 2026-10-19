/**
 * W-4 F2b #10 (ruling 320): planificador de barridos del eco 2026.
 *
 * Puro y sin temporizadores: el reloj entra por parametro (nowMs). El
 * presupuesto de 3 ms/frame NO se puede cumplir barriendo el catalogo
 * entero de golpe (15.9k props ~ 31-52 ms medido); el scheduler reparte el
 * barrido en rebanadas (slices) y adapta el tamano de lote al coste real
 * reportado, con suelo SWEEP_FLOOR y cadencia SWEEP_CADENCE_MS entre
 * INICIOS de barrido (ruling 320: >=0.5 s de reloj de pared).
 */

/** Suelo de satelites por frame durante un barrido (ruling 320). */
export const SWEEP_FLOOR = 256;
/** Presupuesto objetivo por slice en ms (ruling 320: ~3 ms/frame). */
export const SWEEP_BUDGET_MS = 3;
/** Cadencia minima entre INICIOS de barrido (ruling 320: >=0.5 s). */
export const SWEEP_CADENCE_MS = 500;
/** Presupuesto de init troceada por frame (ruling 320: <=8 ms). */
export const SWEEP_INIT_BUDGET_MS = 8;

export interface SweepSlice {
  from: number;
  count: number;
}

export interface SweepScheduler {
  /** Siguiente slice, o null si toca esperar (cadencia) o no hay trabajo. */
  plan(nowMs: number): SweepSlice | null;
  /** Reporte de coste real del slice anterior (adaptacion de lote). */
  report(processed: number, elapsedMs: number): void;
  /** Barridos completos iniciados hasta ahora (observabilidad/tests). */
  sweepCount(): number;
  /** Tamano de lote actual (observabilidad/tests). */
  batchSize(): number;
}

export function createSweepScheduler(total: number): SweepScheduler {
  const n = Math.max(0, Math.floor(total));
  let cursor = 0;
  let batch = Math.min(SWEEP_FLOOR, n);
  let lastStart = Number.NEGATIVE_INFINITY;
  let sweeps = 0;

  return {
    plan(nowMs: number): SweepSlice | null {
      if (n === 0) return null;
      if (cursor >= n) {
        // Barrido previo completo: la cadencia de 0.5 s se mide entre
        // INICIOS de barrido (ruling 320), no entre slices.
        if (nowMs - lastStart < SWEEP_CADENCE_MS) return null;
        cursor = 0;
      }
      if (cursor === 0) {
        lastStart = nowMs;
        sweeps++;
      }
      const count = Math.min(Math.max(batch, SWEEP_FLOOR), n - cursor);
      const slice = { from: cursor, count };
      cursor += count;
      return slice;
    },
    report(processed: number, elapsedMs: number): void {
      if (processed <= 0) return;
      const cost = Math.max(0.1, elapsedMs);
      const factor = Math.min(2, Math.max(0.5, SWEEP_BUDGET_MS / cost));
      const next = Math.round(batch * factor);
      batch = Math.min(n, Math.max(Math.min(SWEEP_FLOOR, n), next));
    },
    sweepCount(): number {
      return sweeps;
    },
    batchSize(): number {
      return batch;
    },
  };
}
