/**
 * Fallback kc2g FAILOVER-ONLY W-4 (clase 244, ruling 243): espejo FASE A
 * (Kc2gAdapter.h:39-59). Solo se usa con la ronda LGDC fallida; jamás
 * primario ni always-on (241 ratificado). Puro, sin red. TU: fallback.
 *
 * Esquema kc2g (stations.json, verificado en vivo): array de 101 filas
 * {station:{code,name,longitude("0-360"),latitude},fof2,hmf2,foe,fof1,
 * mufd,time("sin Z")}. Sin B0/B1 (sanitize 100/3) ni historia.
 */
export type DataSource = "live" | "kc2g" | "cache" | "model" | "down";

export interface Kc2gStation {
  code: string;
  name: string;
  lat: number;
  lon: number; // -180..180 normalizada
  foF2: number | null;
  hmF2: number | null;
  foE: number | null;
  foF1: number | null;
  mufd: number | null;
  timeMs: number; // NaN si ilegible
}

// EG931 excluida (regla kc2g del oráculo).
const EXCLUDED = new Set(["EG931"]);

/** lon 0-360 (string|number) -> -180..180. NaN si ilegible. */
export function normalizeLon(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  if (!isFinite(n)) return NaN;
  return ((n + 540) % 360) - 180;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return isFinite(n) && n !== null ? (n as number) : null;
}

function timeMs(v: unknown): number {
  if (typeof v !== "string") return NaN;
  const t = Date.parse(v.endsWith("Z") ? v : v + "Z");
  return isFinite(t) ? t : NaN;
}

/** Parsea una fila kc2g. null si código/coords inutilizables o excluida. */
export function parseKc2gRow(row: unknown): Kc2gStation | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const st = (r.station ?? {}) as Record<string, unknown>;
  const code = typeof st.code === "string" ? st.code : "";
  if (!code || EXCLUDED.has(code)) return null;
  const lat = num(st.latitude);
  const lon = normalizeLon(st.longitude);
  if (lat === null || !isFinite(lon)) return null;
  return {
    code,
    name: typeof st.name === "string" ? st.name : code,
    lat,
    lon,
    foF2: num(r.fof2),
    hmF2: num(r.hmf2),
    foE: num(r.foe),
    foF1: num(r.fof1),
    mufd: num(r.mufd),
    timeMs: timeMs(r.time),
  };
}

/** Filtra por frescura (edad máxima en ms; futuro = fresco). */
export function filterFresh(rows: Kc2gStation[], nowMs: number, maxAgeMs: number): Kc2gStation[] {
  return rows.filter((s) => isFinite(s.timeMs) && nowMs - s.timeMs <= maxAgeMs);
}

/** Precedencia declarada: live > kc2g > cache (con techo) > model. */
export function resolveSource(args: {
  live: number;
  kc2g: number;
  cacheAgeMin: number | null;
}): DataSource {
  if (args.live > 0) return "live";
  if (args.kc2g > 0) return "kc2g";
  if (isCacheUsable(args.cacheAgeMin)) return "cache";
  return "model";
}

/** Regla de caché honesta: nunca guardar vacío como bueno. */
export function cacheable(stationCount: number): boolean {
  return stationCount > 0;
}

// Techo de edad de caché (P2-245): más allá, model (ventana panel 24 h).
export const CACHE_MAX_AGE_MIN = 24 * 60;

/** Caché utilizable: existe edad y no supera el techo. */
export function isCacheUsable(cacheAgeMin: number | null): boolean {
  return cacheAgeMin !== null && cacheAgeMin <= CACHE_MAX_AGE_MIN;
}

export interface SourceBadge {
  label: string;
  tone: "green" | "amber" | "slate" | "blue" | "red";
}

/** Badge de fuente, 5 estados (ruling 243). Puro para TU. */
export function sourceBadge(source: string): SourceBadge {
  const s = source.toLowerCase();
  if (s.includes("live")) return { label: "live", tone: "green" };
  if (s.includes("kc2g") || s.includes("fallback")) return { label: "kc2g", tone: "amber" };
  if (s.includes("cache")) return { label: "cache", tone: "slate" };
  if (s.includes("model")) return { label: "model", tone: "blue" };
  return { label: "down", tone: "red" };
}
