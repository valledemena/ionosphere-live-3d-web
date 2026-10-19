/**
 * W-4 F2a #8 rayos + whistlers (ruling 266, oraculo O8). Puro: sin DOM ni red.
 *
 * REFERENCIA PINEADA (regla 252, ANTES de codigo):
 * (a) GLM-L2-LCFA en AWS Open Data SIN auth (verificado vivo 2026-10-14):
 *     buckets `noaa-goes19` (Este, operativo) y `noaa-goes18` (Oeste);
 *     GOES-16 retirado (solo hasta 2025). Forma:
 *     GLM-L2-LCFA/{yyyy}/{ddd}/{hh}/OR_GLM-L2-LCFA_G19_s{start}_e{end}_c{}.nc
 *     con granulos continuos cada 20 s (~450 KB, NetCDF-4: sin localizacion
 *     legible sin HDF5 — la ruta NO parsea flashes, declara frescura y
 *     cobertura). Cobertura GLM = Americas (declarado en UI).
 * (b) NWS Alerts API, publica sin auth (verificada viva): avisos
 *     "Severe Thunderstorm Warning" con poligonos GeoJSON (cuspides de
 *     tormenta honestas y geolocalizadas para los sprites; solo CONUS =
 *     dentro de cobertura GLM, declarado).
 * (c) Helliwell 1965 ("Whistlers and Related Ionospheric Phenomena",
 *     Stanford Univ. Press): los whistlers se canalizan (ducting) a lo
 *     largo de las lineas del campo geomagnetico. La trayectoria del
 *     pulso es la LINEA DIPOLAR REAL de la API B(r) (toMag +
 *     dipoleLinePoints con el L y meridiano magnetico del punto —
 *     la misma API que O4.5; el conjugado lo reproduce el puerto
 *     independiente de GLM).
 * (d) Sprites SOLO sobre cuspides (umbral declarado): centroide del
 *     poligono NWS activo; sin avisos no hay sprites (negativo O8).
 */

import { latLonToVec3 } from "./geo";
import { toMag, dipoleLinePoints, traceConjugate, type Vec3 } from "./magnetosphere";

export interface GlmGranule {
  sat: string; // "G19" | "G18"
  start: number; // ms
  end: number; // ms
  size: number; // bytes (tamano de fichero CRUDO, no conteo de flashes)
}

function parseStamp(s: string): number | null {
  // YYYYDDDHHMMSSd (p.ej. 20262870700000; ultimo digito = decimas).
  // Sin la 's' inicial: la consume el patron _s() de la Key S3.
  const m = s.match(/^(\d{4})(\d{3})(\d{2})(\d{2})(\d{2})(\d)$/);
  if (!m) return null;
  const y = +m[1];
  const d = new Date(Date.UTC(y, 0, 1) + (+m[2] - 1) * 86400_000);
  d.setUTCHours(+m[3], +m[4], +m[5], +m[6] * 100);
  return d.getTime();
}

/** Granulos desde el XML ListBucket S3 (nombres + tamanos).
 * P1-276: ListObjectsV2 intercala <ChecksumAlgorithm>/<ChecksumType>
 * entre <ETag> y <Size>; Key y Size se emparejan POR ORDEN (un par por
 * <Contents>), no por adyacencia. Cubre XML con y sin checksum. */
export function parseGlmList(xml: string, sat: string): GlmGranule[] {
  const out: GlmGranule[] = [];
  const keys = [...xml.matchAll(/<Key>([^<]*_s(\w+)_e(\w+)_c\w+\.nc)<\/Key>/g)];
  const sizes = [...xml.matchAll(/<Size>(\d+)<\/Size>/g)];
  for (let i = 0; i < keys.length && i < sizes.length; i++) {
    const start = parseStamp(keys[i][2]);
    const end = parseStamp(keys[i][3]);
    if (start == null || end == null) continue;
    out.push({ sat, start, end, size: parseInt(sizes[i][1], 10) });
  }
  return out.sort((a, b) => b.start - a.start);
}

export interface GlmStatus {
  sat: string;
  fresh: boolean; // ultimo granulo < 10 min (produccion continua 20 s)
  ageSec: number | null;
  granules: number;
}

export const GLM_FRESH_MS = 600_000;

/** Estado por satelite (frescura, no actividad: produccion continua). */
export function glmStatus(granules: GlmGranule[], sat: string, nowMs: number): GlmStatus {
  const list = granules.filter((g) => g.sat === sat);
  if (!list.length) return { sat, fresh: false, ageSec: null, granules: 0 };
  const ageSec = Math.max(0, (nowMs - list[0].end) / 1000);
  return { sat, fresh: ageSec * 1000 <= GLM_FRESH_MS, ageSec, granules: list.length };
}

export interface StormCell {
  id: string;
  lat: number; // centroide del poligono (declarado)
  lon: number;
  area: string;
  onset: number | null;
  ends: number | null;
}

function polyCentroid(ring: number[][]): [number, number] | null {
  // GeoJSON Polygon: ring exterior [lon, lat]; centroide declarado simple.
  if (!ring.length) return null;
  let x = 0;
  let y = 0;
  for (const [lo, la] of ring) {
    x += lo;
    y += la;
  }
  return [y / ring.length, x / ring.length];
}

function toMs(v: unknown): number | null {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/** Avisos NWS activos (GeoJSON FeatureCollection). */
export function parseNwsAlerts(raw: unknown, nowMs: number): StormCell[] {
  const out: StormCell[] = [];
  const feats =
    raw != null && typeof raw === "object" && Array.isArray((raw as { features?: unknown }).features)
      ? ((raw as { features: unknown[] }).features as Record<string, unknown>[])
      : [];
  for (const f of feats) {
    if (f == null || typeof f !== "object") continue;
    const p = (f as { properties?: Record<string, unknown> }).properties ?? {};
    const g = (f as { geometry?: { type?: string; coordinates?: unknown } }).geometry;
    if (!g || g.type !== "Polygon" || !Array.isArray(g.coordinates) || !g.coordinates.length) continue;
    const c = polyCentroid(g.coordinates[0] as number[][]);
    if (!c) continue;
    const ends = toMs(p.ends);
    if (ends != null && ends < nowMs) continue; // caducado
    out.push({
      id: typeof p.id === "string" ? p.id : "",
      lat: c[0],
      lon: c[1],
      area: typeof p.areaDesc === "string" ? p.areaDesc : "",
      onset: toMs(p.onset),
      ends,
    });
  }
  return out;
}

/**
 * Linea de campo REAL por el punto (O8): L y meridiano magnetico del
 * propio punto via la API B(r) (toMag + traceConjugate), puntos GEO
 * con dipoleLinePoints. Canalización Helliwell declarada en UI.
 */
export function whistlerPath(latDeg: number, lonDeg: number, n = 48): Vec3[] {
  const [x, y, z] = latLonToVec3(latDeg, lonDeg, 1);
  const q = toMag([x, y, z]);
  const lonM = (Math.atan2(q[1], q[0]) * 180) / Math.PI;
  const { L } = traceConjugate(latDeg, lonDeg);
  return dipoleLinePoints(L, lonM, n);
}
