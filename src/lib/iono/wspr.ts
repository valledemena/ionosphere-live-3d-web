/**
 * W-4 #5 WSPRnet (ruling 252, oraculos O5.1-O5.4). Puro: sin DOM ni red.
 *
 * REFERENCIA PINEADA (regla 252, ANTES de codigo): la fuente verificada
 * viva es la tabla HTML de `http://wsprnet.org/olddb?mode=html&band=all`
 * (verificada el 2026-10-14: 200, ~35 KB, ~50 filas; el catalogo 251 §D
 * la registra como "tabla HTML con spots reales"). Columnas:
 *   Date | Call | Frequency | SNR | Drift | Grid | dBm | W | by | loc |
 *   km | mi | Mode | Version
 * con entidades `&nbsp;`. Fecha "2026-10-14 12:52" (UTC, sin segundos).
 * Uso cortes: limite 50 filas por fetch + cache 5 min en la ruta (O5.1)
 * y atribucion visible en el panel (red de voluntarios).
 *
 * Honestidad (O5.1/O5.4): solo spots reales parseados; sin red -> []
 * (el panel declara "sin datos", jamas sinteticos). Persistencia ~10 min
 * DECLARADA: los spots caducan por tiempo, no por lote (O5.2).
 */

export const SPOT_TTL_MIN = 10; // persistencia declarada (O5.2)
export const SPOT_CAP = 40; // arcos en escena (techo GL declarado)

export interface WsprSpot {
  tx: string;
  rx: string;
  freq: number; // MHz
  band: string; // "20m" ...
  snr: number; // dB
  t: number; // ms UTC
  txLat: number;
  txLon: number;
  rxLat: number;
  rxLon: number;
  km: number;
}

/** Maidenhead 4/6 caracteres -> [lat, lon] (centro de la celda). */
export function maidenheadToLatLon(grid: string): [number, number] | null {
  const g = grid.trim().toUpperCase();
  if (!/^[A-R]{2}[0-9]{2}([A-X]{2})?$/.test(g)) return null;
  const lonB = (g.charCodeAt(0) - 65) * 20 - 180 + (g.charCodeAt(2) - 48) * 2;
  const latB = (g.charCodeAt(1) - 65) * 10 - 90 + (g.charCodeAt(3) - 48) * 1;
  if (g.length === 6) {
    // Subcuadrícula 24x24: 5' lon x 2.5' lat (centro de la subcelda).
    return [
      latB + (g.charCodeAt(5) - 65 + 0.5) / 24,
      lonB + (g.charCodeAt(4) - 65 + 0.5) / 12,
    ];
  }
  return [latB + 0.5, lonB + 1];
}

/** Frecuencias de llamada WSPR (MHz) -> banda; null si fuera de banda. */
const WSPR_DIAL: [number, string][] = [
  [0.4742, "2200m"],
  [1.8366, "160m"],
  [3.5686, "80m"],
  [5.2872, "60m"],
  [7.0386, "40m"],
  [10.1387, "30m"],
  [14.0956, "20m"],
  [18.1046, "17m"],
  [21.0946, "15m"],
  [24.9246, "12m"],
  [28.1246, "10m"],
  [50.293, "6m"],
  [70.091, "4m"],
  [144.489, "2m"],
];

export function wsprBand(freqMHz: number): string | null {
  if (!(freqMHz > 0)) return null;
  for (const [dial, band] of WSPR_DIAL) {
    const tol = dial < 30 ? 0.15 : 1.0;
    if (Math.abs(freqMHz - dial) <= tol) return band;
  }
  return null;
}

/** Color por banda para los arcos (fijo, declarado en el TU). */
export function bandColor(band: string): [number, number, number] {
  const map: Record<string, [number, number, number]> = {
    "160m": [0.55, 0.35, 1.0],
    "80m": [0.35, 0.5, 1.0],
    "60m": [0.3, 0.8, 1.0],
    "40m": [0.2, 0.9, 0.7],
    "30m": [0.3, 0.95, 0.4],
    "20m": [1.0, 0.85, 0.2],
    "17m": [1.0, 0.65, 0.15],
    "15m": [1.0, 0.45, 0.1],
    "12m": [1.0, 0.3, 0.3],
    "10m": [1.0, 0.2, 0.5],
    "6m": [0.9, 0.3, 1.0],
  };
  return map[band] ?? [0.6, 0.6, 0.6];
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toMs(s: string): number | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return Number.isFinite(t) ? t : null;
}

/**
 * Parseo de la tabla HTML olddb -> spots con coordenadas. Fila sin grid
 * valido o frecuencia fuera de banda se descarta (honesto, sin inventar).
 */
export function parseWsprTable(html: string, nowMs: number): WsprSpot[] {
  const out: WsprSpot[] = [];
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];
  for (const r of rows) {
    const cells = [...r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      stripTags(m[1])
    );
    // Cabecera u otras tablas: la de spots tiene 14 celdas y fecha util.
    if (cells.length < 14) continue;
    const t = toMs(cells[0]);
    if (t == null) continue;
    if (nowMs - t > SPOT_TTL_MIN * 60_000) continue; // caducado (O5.2)
    if (t > nowMs + 5 * 60_000) continue; // futuro imposible
    const freq = parseFloat(cells[2]);
    const band = wsprBand(freq);
    if (band == null) continue;
    const txll = maidenheadToLatLon(cells[5]);
    const rxll = maidenheadToLatLon(cells[9]);
    if (!txll || !rxll) continue;
    const snr = parseFloat(cells[3]);
    out.push({
      tx: cells[1],
      rx: cells[8],
      freq,
      band,
      snr: Number.isFinite(snr) ? snr : 0,
      t,
      txLat: txll[0],
      txLon: txll[1],
      rxLat: rxll[0],
      rxLon: rxll[1],
      km: parseFloat(cells[10]) || 0,
    });
    if (out.length >= SPOT_CAP) break;
  }
  return out;
}

export interface BandOpening {
  band: string;
  count: number;
  bestSnr: number;
}

const BAND_ORDER = ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m"];

/**
 * Apertura por banda 160-10m+6m CALCULADA DE LOS SPOTS mostrados (O5.3):
 * el panel y el mapa no pueden discrepar (misma lista).
 */
export function bandOpening(spots: WsprSpot[]): BandOpening[] {
  const acc = new Map<string, { count: number; bestSnr: number }>();
  for (const s of spots) {
    const e = acc.get(s.band) ?? { count: 0, bestSnr: -99 };
    e.count++;
    if (s.snr > e.bestSnr) e.bestSnr = s.snr;
    acc.set(s.band, e);
  }
  return BAND_ORDER.filter((b) => acc.has(b)).map((b) => ({
    band: b,
    count: acc.get(b)!.count,
    bestSnr: acc.get(b)!.bestSnr,
  }));
}
