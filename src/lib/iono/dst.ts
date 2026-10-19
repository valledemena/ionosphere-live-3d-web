/**
 * W-4 F2a #18 anillo Dst (ruling 266, oraculo O18). Puro: sin DOM ni red.
 *
 * REFERENCIA PINEADA (regla 252, ANTES de codigo):
 * (a) Kyoto WDC Dst realtime (verificado vivo 2026-10-15): patron
 *     `dst_realtime/presentmonth/dstYYMM.for.request` (alias del mes en
 *     curso) o `dst_realtime/YYYYMM/dstYYMM.for.request`. Forma WDC:
 *     `DST2610*DD R RX020` + 24 valores horarios + media diaria.
 *     La propia pagina advierte: valores de datos crudos sin verificar
 *     (pueden contener imprecisiones) — declarado en el panel.
 * (b) DONKI /get/GST como COMPLEMENTO declarado (verificado vivo):
 *     tormentas con allKpIndex (fuente NOAA) + link (jamas inventado).
 * El anillo sigue SYM-H/Dst REAL (O18): radio e intensidad del Dst vivo.
 */

export interface DstPoint {
  t: number; // ms UTC (hora en punto)
  dst: number; // nT
}

/**
 * Parseo WDC mensual (year, month): lineas `DST2610*04 R RX020` +
 * 24 horarios + media (se ignora la media: 25º valor).
 */
export function parseDstWdc(text: string, year: number, month: number): DstPoint[] {
  const out: DstPoint[] = [];
  for (const ln of text.split("\n")) {
    const m = ln.match(/^DST\d{4}\*(\d{2})\S*\s+(.*)$/);
    if (!m) continue;
    const dd = parseInt(m[1], 10);
    if (!(dd >= 1 && dd <= 31)) continue;
    const vals = m[2].trim().split(/\s+/).slice(0, 24);
    if (vals.length < 24) continue;
    for (let h = 0; h < 24; h++) {
      const v = parseInt(vals[h], 10);
      if (!Number.isFinite(v)) continue;
      out.push({ t: Date.UTC(year, month - 1, dd, h), dst: v });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

export interface GstStorm {
  id: string;
  start: number | null;
  kpMax: number | null;
  link: string | null;
}

function toMs(v: unknown): number | null {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v.length === 16 ? v + ":00Z" : v);
  return Number.isFinite(t) ? t : null;
}

/** Tormentas GST del DONKI (complemento declarado, O18). */
export function parseGst(raw: unknown): GstStorm[] {
  if (!Array.isArray(raw)) return [];
  const out: GstStorm[] = [];
  for (const e of raw) {
    if (e == null || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    let kpMax: number | null = null;
    if (Array.isArray(r.allKpIndex)) {
      for (const k of r.allKpIndex) {
        const v = (k as { kpIndex?: unknown }).kpIndex;
        if (typeof v === "number" && Number.isFinite(v)) {
          kpMax = kpMax == null ? v : Math.max(kpMax, v);
        }
      }
    }
    out.push({
      id: typeof r.gstID === "string" ? r.gstID : "",
      start: toMs(r.startTime),
      kpMax,
      link: typeof r.link === "string" ? r.link : null,
    });
  }
  return out;
}

export type DstBand = "quiet" | "unsettled" | "storm" | "intense";

/** Bandas declaradas (O18): >=-30 quiet · -50..-30 unsettled ·
 * -100..-50 storm · <-100 intense. */
export function dstBand(dst: number): DstBand {
  if (dst < -100) return "intense";
  if (dst < -50) return "storm";
  if (dst < -30) return "unsettled";
  return "quiet";
}

/** Color del anillo por banda (declarado): azul tenue -> ambar -> rojo. */
export function dstColor(dst: number): [number, number, number] {
  if (dst < -100) return [1.0, 0.25, 0.2];
  if (dst < -50) return [1.0, 0.55, 0.15];
  if (dst < -30) return [0.9, 0.75, 0.3];
  return [0.35, 0.55, 1.0];
}

/** Radio del anillo en R_E (declarado): se cierra con la tormenta. */
export function dstRadius(dst: number): number {
  const r = 5.5 + dst / 100;
  return Math.min(6, Math.max(3.5, r));
}
