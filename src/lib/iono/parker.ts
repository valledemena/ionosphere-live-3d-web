/**
 * W-4 F2b #12 Parker spiral (ruling 266/288, oraculo O12). Puro.
 *
 * REFERENCIA PINEADA (regla 252, ANTES de codigo): Parker 1958 —
 * la espiral sale de rotacion solar + viento radial constante:
 *   phi(r) = phi0 - OMEGA * (r - r0) / v_sw
 * con OMEGA sideral = 2*pi/25.38 d (pineado) y v_sw REAL vivo.
 * Polaridad de sector del Bx REAL (rtsw 1-min, ya consumido):
 * Bx>=0 = toward (hacia el Sol, +X GSE), Bx<0 = away (declarado).
 * Frontera de sector = cruce CALCULADO del dato (cambio de signo
 * entre muestras adyacentes); notificacion SOLO en cruce real
 * (negativo O12: sin cruce no hay notificacion).
 * Display declarado: esquema 2D cenital en el panel (el frente #1
 * sento el precedente: 1 UA no cabe en la vista R_E); la Tierra va
 * fija en (1, 0) y la espiral es la foto instantanea con el v vivo.
 */

export const SIDEREAL_ROTATION_DAYS = 25.38; // pineado
export const AU_KM = 1.496e8;

/** Angulo de atraso (deg) a distancia r_au con viento v (Parker 1958). */
export function spiralLagDeg(v_kms: number, r_au = 1): number {
  if (!(v_kms > 0)) return 0;
  const transitDays = ((r_au * AU_KM) / v_kms / 86400);
  return (transitDays / SIDEREAL_ROTATION_DAYS) * 360;
}

export interface SpiralPt {
  r: number; // AU
  phi: number; // deg (0 = Tierra, negativo hacia el Sol-atrás)
  x: number; // AU, plano ecliptico
  y: number;
}

/** Brazo espiral Sol(0.05)->1.5 UA por la Tierra (foto instantanea).
 * phi(r) = lag(1) - lag(r): en la Tierra phi=0; hacia dentro el pie
 * queda a +lag (el Sol roto mientras viaja el plasma); hacia fuera
 * atrasa. Convencion display: norte arriba, antihorario positivo. */
export function spiralPoints(v_kms: number, n = 64): SpiralPt[] {
  const pts: SpiralPt[] = [];
  const lag1 = spiralLagDeg(v_kms, 1);
  for (let i = 0; i <= n; i++) {
    const r = 0.05 + ((1.5 - 0.05) * i) / n;
    const ph = lag1 - spiralLagDeg(v_kms, r);
    const rad = (ph * Math.PI) / 180;
    pts.push({ r, phi: ph, x: r * Math.cos(rad), y: r * Math.sin(rad) });
  }
  return pts;
}

export type SectorPolarity = "toward" | "away";

/** Polaridad del Bx REAL (convencion declarada: +X GSE = hacia el Sol). */
export function sectorPolarity(bx: number): SectorPolarity {
  return bx >= 0 ? "toward" : "away";
}

export interface MagPt {
  t: number;
  bx: number;
}

export interface MagRow {
  t: number;
  bx: number | null;
  active: boolean;
}

/**
 * P1-284: el feed rtsw es DESCENDENTE y MULTI-NAVE (SOLAR1 activa +
 * ACE/IMAP inactivas intercaladas). Selección honesta: filas de la
 * fuente ACTIVA (fallback declarado a todas si ninguna lo es),
 * ordenadas ASCENDENTES (la más nueva al final). De aquí salen tanto
 * el Bx vigente (extremo nuevo) como la serie de cruces (con la
 * serie ascendente de una sola fuente, recent[last] ya es el cruce
 * más nuevo — el síntoma (c) se corrige solo).
 */
export function selectMagSource(rows: MagRow[], hoursBack = 3, nowMs = Date.now()): MagPt[] {
  const act = rows.filter((r) => r.active);
  const pool = act.length ? act : rows;
  const cut = nowMs - hoursBack * 3600_000;
  return pool
    .filter((r) => r.bx != null && r.t >= cut)
    .map((r) => ({ t: r.t, bx: r.bx as number }))
    .sort((a, b) => a.t - b.t);
}

/** Cruces de sector CALCULADOS del dato (cambios de signo adyacentes). */
export function findCrossings(series: MagPt[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1].bx;
    const b = series[i].bx;
    if (a === 0 || b === 0) continue;
    if ((a > 0) !== (b > 0)) out.push(series[i].t);
  }
  return out;
}
