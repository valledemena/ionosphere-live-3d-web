/**
 * W-4 F2a #19 Van Allen (ruling 266, oraculo O19). Puro: sin DOM ni red.
 *
 * REFERENCIA PINEADA (regla 252, ANTES de codigo):
 * DONKI /get/RBE verificado vivo 2026-10-15 (4 eventos 23-sep/26-sep/
 * 5-oct/10-oct): {rbeID, eventTime, instruments[] ("GOES-P: SEISS
 * >2MeV"), link, linkedEvents[], sentNotifications[]}.
 * v1 PARAMETRICO por Kp DECLARADO (AE9/AP9 queda para v2, no F2):
 * toro interno plateado estable (L 1.5, protones) + externo ambar
 * vivo (L 4.2+0.08*Kp, electrones) + brillo externo por RBE reciente.
 * DERIVA con direccion fisica correcta (determinista, el oraculo la
 * comprueba): protones hacia el OESTE, electrones hacia el ESTE.
 */

export interface RbeEvent {
  id: string;
  time: number | null;
  instrument: string | null;
  link: string | null;
}

function toMs(v: unknown): number | null {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v.length === 16 ? v + ":00Z" : v);
  return Number.isFinite(t) ? t : null;
}

/** Eventos RBE del DONKI (ordenados nuevos primero). */
export function parseRbe(raw: unknown): RbeEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: RbeEvent[] = [];
  for (const e of raw) {
    if (e == null || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    const inst = Array.isArray(r.instruments) ? r.instruments[0] as { displayName?: unknown } : null;
    out.push({
      id: typeof r.rbeID === "string" ? r.rbeID : "",
      time: toMs(r.eventTime),
      instrument: inst && typeof inst.displayName === "string" ? inst.displayName : null,
      link: typeof r.link === "string" ? r.link : null,
    });
  }
  return out
    .filter((e) => e.time != null)
    .sort((a, b) => (b.time as number) - (a.time as number));
}

/** L del toro interno (estable, protones) y externo (Kp, electrones). */
export const BELT_INNER_L = 1.5;
export function beltOuterL(kp: number): number {
  const k = Math.max(0, Math.min(9, kp));
  return 4.2 + 0.08 * k;
}

/** Brillo externo por RBE reciente (0..1, decae en 14 dias; declarado). */
export function rbeGlow(eventMs: number | null, nowMs: number): number {
  if (eventMs == null) return 0;
  const days = (nowMs - eventMs) / 86400_000;
  if (days < 0) return 0;
  return Math.exp(-days / 14);
}

export type DriftSpecies = "protons" | "electrons";

/**
 * Angulo de deriva (rad) a tiempo t: protones OESTE (signo -),
 * electrones ESTE (signo +). Determinista; el oraculo comprueba signos.
 */
export function driftAngle(tSec: number, species: DriftSpecies, rate = 0.05): number {
  return (species === "protons" ? -1 : 1) * rate * tSec;
}
