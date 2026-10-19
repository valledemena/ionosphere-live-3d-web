/**
 * W-4 F2b #7 Voyager (ruling 266/288, oraculo O7). Puro: sin DOM ni red.
 *
 * REFERENCIA PINEADA (regla 252, ANTES de codigo):
 * (a) JPL Horizons API en vivo (verificado 2026-10-15): Voyager 1
 *     (-31) geocentrico, observer quantity 20 (range AU):
 *     2026-Oct-15 172.508150629083 AU (el pin del catalogo, 172.4869
 *     del 14-oct, NO es eterno — la ruta refresca al ejecutar, O7).
 *     Tiempo-luz real: 1 UA = 499.004 s => ~23.9 h solo-ida (los
 *     23h54m del ruling).
 * (b) Friis con parametros PUBLICOS JPL (declarados): Pt 23 W (TWTA
 *     banda X), antena nave 3.7 m, f 8.42 GHz, DSN 70 m, eficiencias
 *     tipicas eta 0.55/0.65 (declaradas). Pr ~= 5e-19 W (el oraculo
 *     lo recalcula independiente).
 * Pulso HONESTO: el esquema se barre en 10 s con factor xN VISIBLE
 * (O1.5); bono local DSN Robledo (Madrid) declarado en el panel.
 */

export const VOYAGER_FREQ_HZ = 8.42e9; // banda X bajada, publico JPL
export const VOYAGER_TX_W = 23; // TWTA, publico JPL
export const VOYAGER_DISH_M = 3.7; // publico JPL
export const DSN_DISH_M = 70; // 70 m, publico JPL
export const ETA_TX = 0.55; // eficiencia tipica (declarada)
export const ETA_RX = 0.65; // eficiencia tipica (declarada)
export const C_MS = 299792458;
export const AU_KM = 1.496e8;

function dishGain(dM: number, eta: number): number {
  const lambda = C_MS / VOYAGER_FREQ_HZ;
  const x = (Math.PI * dM) / lambda;
  return eta * x * x;
}

/** Presupuesto Friis (W recibidos) a distancia r_au. */
export function friisReceivedW(r_au: number): number {
  if (!(r_au > 0)) return 0;
  const lambda = C_MS / VOYAGER_FREQ_HZ;
  const r = r_au * AU_KM * 1000;
  const gt = dishGain(VOYAGER_DISH_M, ETA_TX);
  const gr = dishGain(DSN_DISH_M, ETA_RX);
  const path = lambda / (4 * Math.PI * r);
  return VOYAGER_TX_W * gt * gr * path * path;
}

/** Tiempo-luz solo-ida en segundos para r_au. */
export function lightTimeSec(r_au: number): number {
  if (!(r_au > 0)) return 0;
  return ((r_au * AU_KM * 1000) / C_MS);
}

/** Factor visible del barrido del pulso (O1.5): transito real a 10 s. */
export function pulseLapse(lightSec: number, sweepMs = 10000): number {
  if (!(lightSec > 0) || !(sweepMs > 0)) return 1;
  return Math.max(1, Math.round((lightSec * 1000) / sweepMs));
}

export interface VoyagerFix {
  au: number;
  date: string; // "2026-Oct-15 00:00"
  t: number; // epoch ms de la fila
}

/** Parseo de la tabla observer Horizons (quantity 20 = range AU). */
export function parseHorizons(text: string): VoyagerFix[] {
  const rows: VoyagerFix[] = [];
  for (const ln of text.split("\n")) {
    const m = ln.match(/^\s*(\d{4})-([A-Za-z]{3})-(\d{2}) (\d{2}):(\d{2})\s+([\d.]+)\s+[\d.\-+]+\s*$/);
    if (!m) continue;
    const au = parseFloat(m[6]);
    if (!(Number.isFinite(au) && au > 100 && au < 200)) continue;
    const t = Date.parse(`${m[2]} ${m[3]}, ${m[1]} ${m[4]}:${m[5]} UTC`);
    if (!Number.isFinite(t)) continue;
    rows.push({ date: `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`, au, t });
  }
  return rows;
}

/**
 * P1-286: fila pasada MAS CERCANA a ahora (nunca futura; fallback
 * declarado a la primera si todo es futuro).
 */
export function pickCurrentRow(rows: VoyagerFix[], nowMs: number): VoyagerFix | null {
  if (!rows.length) return null;
  let best: VoyagerFix | null = null;
  for (const r of rows) {
    if (r.t <= nowMs) best = r;
  }
  return best ?? rows[0];
}
