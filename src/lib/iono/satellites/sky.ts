/**
 * W-4 F2b #10 (ruling 320): cielo del eco 2026.
 *
 * Cadena por satelite (misma que el oraculo del ruling):
 *   sgp4(TLE, tsince) -> rTEME -> teme2ecef(gmst) -> ecef2geodetic
 *   -> latLonToVec3(lat, lon, 1 + altKm/6371)
 *
 * La conversion se comparte con las estaciones (geo.ts): un satelite y una
 * estacion en la misma lat/lon/alt caen en el MISMO punto de escena.
 *
 * Init troceada (<=8 ms por frame tras el primer frame; ruling 320): los
 * satrecs se construyen por tramos con initStep(); el primer barrido solo
 * empieza cuando ready. El barrido lo agenda scheduler.ts (rebanadas con
 * presupuesto y cadencia), aqui solo vive la fisica por rebanada.
 */
import { gstime, sgp4, type ElsetRec } from "../sgp4/sgp4";
import { twoline2rv } from "../sgp4/sgpTle";
import { ecef2geodetic, teme2ecef } from "../sgp4/sgpCoord";
import { latLonToVec3, R_EARTH_KM } from "../geo";
import type { SatRecord } from "./catalog";
import {
  createSweepScheduler,
  SWEEP_INIT_BUDGET_MS,
  type SweepScheduler,
} from "./scheduler";

/** JD del epoch Unix (1970-01-01T00:00:00Z). */
export const JD_UNIX_EPOCH = 2_440_587.5;

export function jdFromUnixMs(ms: number): number {
  return JD_UNIX_EPOCH + ms / 86_400_000;
}

/** GMST (rad) del instante; mismo gstime de Vallado para todo el barrido. */
export function gmstFromUnixMs(ms: number): number {
  return gstime(jdFromUnixMs(ms));
}

/** Epoch del TLE en ms Unix (jd entero + fraccion). */
export function satEpochMs(satrec: ElsetRec): number {
  return (satrec.jdsatepoch + satrec.jdsatepochF - JD_UNIX_EPOCH) * 86_400_000;
}

/**
 * Conversion TEME -> escena (oraculo byte a byte con geo.ts; sin factor de
 * exageracion: 1 unidad = 1 R_E = 6371 km).
 */
export function temeToScene(
  rTEME: number[],
  gmst: number,
  out: Float32Array,
  offset: number,
): void {
  const rECEF = teme2ecef(rTEME, gmst);
  const g = ecef2geodetic(rECEF);
  const [x, y, z] = latLonToVec3(g.lat, g.lon, 1 + g.altKm / R_EARTH_KM);
  out[offset] = x;
  out[offset + 1] = y;
  out[offset + 2] = z;
}

export interface SatSky {
  /** Numero de satelites del catalogo cargado. */
  readonly count: number;
  /** Posiciones de escena (count*3); solo valido hasta validCount. */
  readonly positions: Float32Array;
  /** Fin del tramo contiguo ya barrido (para setDrawRange; 0 al inicio). */
  readonly validCount: number;
  /** Barridos agendados (rebanadas adaptativas + cadencia). */
  readonly scheduler: SweepScheduler;
  /** true cuando TODOS los satrecs estan construidos. */
  readonly ready: boolean;
  /** Construye satrecs por tramos hasta agotar el presupuesto (ms). */
  initStep(budgetMs?: number): void;
  /** Un slice del barrido: propaga y escribe posiciones from..from+count. */
  sweep(from: number, count: number, epochMs: number): void;
  /** Errores sgp4 acumulados (0 con el catalogo activo real). */
  readonly errors: number;
}

export function createSatSky(records: SatRecord[]): SatSky {
  const count = records.length;
  const satrecs: (ElsetRec | null)[] = new Array(count).fill(null);
  const epochsMs = new Float64Array(count);
  const positions = new Float32Array(count * 3);
  const rTEME = [0, 0, 0];
  const vTEME = [0, 0, 0];
  let initCursor = 0;
  let validEnd = 0;
  let errors = 0;

  const sky: SatSky = {
    count,
    positions,
    scheduler: createSweepScheduler(count),
    get ready(): boolean {
      return initCursor >= count;
    },
    get validCount(): number {
      return validEnd;
    },
    get errors(): number {
      return errors;
    },
    initStep(budgetMs: number = SWEEP_INIT_BUDGET_MS): void {
      const t0 = performance.now();
      while (initCursor < count && performance.now() - t0 < budgetMs) {
        const rec = records[initCursor];
        const { satrec } = twoline2rv(rec.line1, rec.line2, "wgs72", "a", {
          strict: true,
        });
        satrecs[initCursor] = satrec;
        epochsMs[initCursor] = satEpochMs(satrec);
        initCursor++;
      }
    },
    sweep(from: number, sliceCount: number, epochMs: number): void {
      const gmst = gmstFromUnixMs(epochMs);
      const end = Math.min(count, from + sliceCount);
      for (let i = from; i < end; i++) {
        const sr = satrecs[i];
        if (!sr) continue;
        const tsince = (epochMs - epochsMs[i]) / 60_000;
        if (sgp4(sr, tsince, rTEME, vTEME)) {
          temeToScene(rTEME, gmst, positions, i * 3);
        } else {
          errors++;
        }
      }
      // Los slices llegan en orden (scheduler secuencial); el tramo
      // contiguo crece hasta cubrir el catalogo entero.
      if (from <= validEnd) validEnd = Math.max(validEnd, end);
    },
  };
  return sky;
}
