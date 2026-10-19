/**
 * W-4 F2a #17 electrojets (ruling 266, oraculo O17). Puro: sin DOM ni red.
 *
 * REFERENCIA PINEADA (regla 252, ANTES de codigo): Kyoto WDC AE
 * realtime digital (publicado desde dic-2024, verificado vivo
 * 2026-10-14; "only for non-commercial purpose", cita obligatoria —
 * atribucion visible en el panel). Patron MENSUAL fijado por este drop
 * (O17): `ae_realtime/data_dir/YYYY/MM/DD/aeYYMMDD` (9.4 KB/dia).
 * Forma (igual que el AE definitivo clasico): cabecera
 * `AEALAOAU    260927E00AE QUICKLK` + 60 valores minutales por hora.
 * Mapeo AE->color de filamentos (azul->amarillo->blanco) declarado
 * abajo (O17 lo reproduce el oraculo).
 */

export interface AePoint {
  t: number; // ms UTC
  ae: number; // nT
}

/**
 * Parseo del fichero diario aeYYMMDD (year, month, day para el calendario).
 * Filas horarias `AEALAOAU YYMMDD E HH AE QUICKLK` + 60 enteros.
 * Valores 9999 (hueco) se descartan (honestos, sin rellenar).
 */
export function parseKyotoAe(text: string, year: number, month: number, day: number): AePoint[] {
  const out: AePoint[] = [];
  const lines = text.split("\n");
  for (const ln of lines) {
    const m = ln.match(/^AEALAOAU\s+\d{6}E(\d{2})AE\s+\S+\s+(.*)$/);
    if (!m) continue;
    const hh = parseInt(m[1], 10);
    if (!(hh >= 0 && hh < 24)) continue;
    const vals = m[2].trim().split(/\s+/);
    for (let i = 0; i < Math.min(60, vals.length); i++) {
      const v = parseInt(vals[i], 10);
      if (!Number.isFinite(v) || v >= 9999 || v < 0) continue;
      out.push({ t: Date.UTC(year, month - 1, day, hh, i), ae: v });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Nombre de fichero diario aeYYMMDD (patron mensual O17). */
export function aeFileName(year: number, month: number, day: number): string {
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `ae${String(year).slice(2)}${p2(month)}${p2(day)}`;
}

export type AeBand = "quiet" | "active" | "storm";

/** Bandas declaradas (O17): <100 quiet · 100-500 active · >500 storm. */
export function aeBand(ae: number): AeBand {
  if (ae > 500) return "storm";
  if (ae >= 100) return "active";
  return "quiet";
}

/**
 * Mapeo AE -> color de filamento (azul->amarillo->blanco, declarado):
 * <=100 azul (0.2,0.4,1.0); 100-500 lerp a amarillo (1.0,0.85,0.2);
 * 500-1500 lerp a blanco (1,1,1); >=1500 blanco.
 */
export function aeColor(ae: number): [number, number, number] {
  const lo: [number, number, number] = [0.2, 0.4, 1.0];
  const mid: [number, number, number] = [1.0, 0.85, 0.2];
  const hi: [number, number, number] = [1.0, 1.0, 1.0];
  if (ae <= 100) return lo;
  if (ae >= 1500) return hi;
  const a = ae <= 500 ? lo : mid;
  const b = ae <= 500 ? mid : hi;
  const f = ae <= 500 ? (ae - 100) / 400 : (ae - 500) / 1000;
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
}

/** Latitud magnetica del ovalo electrojet (declarada; solo norte). */
export const ELECTROJET_MAGLAT = 67;
