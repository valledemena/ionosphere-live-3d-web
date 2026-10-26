// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — shell data layer: live TLE catalog (drop 317, F2b #10).
//
// Cadena por-origen adjudicada en el veredicto 316 §4 (estrategia de 315 §6):
//   CelesTrak (vivo) -> snapshot completo fechado -> SatNOGS (vivo, subconjunto)
//   -> unavailable. El volcado de SatNOGS solo cubre satelites con transmisor
//   registrado (~1.7k), no el catalogo activo completo; para ECO 2026 se prefiere
//   el snapshot completo y se rotula como frozen (jamas como live).
// Reglas de honestidad: el snapshot JAMAS lleva etiqueta "live" (lleva su fecha);
// "unavailable" es un estado nulo honesto, nunca un dato ficticio. La cache solo
// guarda catalogos no vacios (nunca guardar vacio como bueno — patron fallback).
// Cero red en este modulo: la ruta inyecta los fetchers (testeable con fakes).
//
// Ciudadania (312 Q4 / 316 §4.3): TTL de horas + User-Agent propio + rate-limits
// viven en la ruta; el GROUP de CelesTrak respeta su etiqueta (una consulta de
// grupo cada >= 2 h) con ventana negativa corta tras un fallo. Atribucion SatNOGS.

import { tleChecksumOk } from "../sgp4/sgpTle";

export interface SatRecord {
  noradId: string;
  name: string;
  line1: string;
  line2: string;
}

export type CatalogSource = "celestrak" | "satnogs" | "snapshot" | "unavailable";

export interface CatalogPayload {
  source: CatalogSource;
  sourceLabel: string;
  attribution: string;
  fetchedAt: number;
  count: number;
  dropped: number;
  records: SatRecord[];
}

export interface ParsedCatalog {
  records: SatRecord[];
  dropped: number;
}

/** CelesTrak GP: grupo activo completo (TLE crudo). Fuente primaria viva. */
export const CELESTRAK_ACTIVE_URL =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=TLE";

/** SatNOGS DB: volcado completo de TLE (JSON, sin paginacion — medido 1733). */
export const SATNOGS_TLE_URL = "https://db.satnogs.org/api/tle/?format=json";

export const SNAPSHOT_DATE = "2026-10-17";
export const SNAPSHOT_FILE = "active-2026-10-17.tle";
/** Captura del snapshot (mtime UTC del crudo en la adquisicion). */
export const SNAPSHOT_CAPTURED_AT = Date.parse("2026-10-17T10:53:13Z");

/** TTL del payload (CelesTrak: consulta de grupo <= 1/2 h; 6 h es seguro). */
export const CATALOG_TTL_MS = 6 * 3_600_000;
/** Ventana negativa de CelesTrak tras un fallo (la ruta defensiva reintenta sola). */
export const CELESTRAK_FAIL_WINDOW_MS = 30 * 60_000;

function noradOf(line1: string): string {
  return line1.slice(2, 7).trim();
}

/** Nombre con reserva honesta si la linea de nombre viene vacia. */
function recordName(rawName: string, noradId: string): string {
  const n = rawName.trim();
  return n.length > 0 ? n : `NORAD ${noradId}`;
}

/**
 * Parsea un catalogo TLE de formato CelesTrak (grupos de 3 lineas:
 * nombre, linea 1, linea 2). Checksum estricto por defecto: un registro
 * con checksum invalido se DESCARTA y se cuenta (estilo dmissing: rechazar
 * y reportar, jamas auto-corregir). Lineas sobrantes => dropped.
 */
export function parseTleCatalog(text: string): ParsedCatalog {
  const lines = text.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const records: SatRecord[] = [];
  let dropped = 0;
  const full = Math.floor(lines.length / 3);
  for (let i = 0; i < full; i++) {
    const name = lines[i * 3];
    const line1 = lines[i * 3 + 1];
    const line2 = lines[i * 3 + 2];
    if (!line1.startsWith("1 ") || !line2.startsWith("2 ")) {
      dropped++;
      continue;
    }
    if (!tleChecksumOk(line1) || !tleChecksumOk(line2)) {
      dropped++;
      continue;
    }
    const noradId = noradOf(line1);
    records.push({ noradId, name: recordName(name, noradId), line1, line2 });
  }
  dropped += lines.length - full * 3;
  return { records, dropped };
}

/**
 * Parsea el volcado JSON de SatNOGS (/api/tle/): array de filas con
 * tle0 ("0 NOMBRE"), tle1, tle2. Mismo checksum estricto. Filas malformadas
 * o invalidas se descartan y se cuentan.
 */
export function parseSatnogsTle(rows: unknown): ParsedCatalog {
  const records: SatRecord[] = [];
  let dropped = 0;
  if (!Array.isArray(rows)) return { records, dropped };
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      dropped++;
      continue;
    }
    const r = row as Record<string, unknown>;
    const tle1 = typeof r.tle1 === "string" ? r.tle1 : "";
    const tle2 = typeof r.tle2 === "string" ? r.tle2 : "";
    const tle0 = typeof r.tle0 === "string" ? r.tle0 : "";
    if (!tle1.startsWith("1 ") || !tle2.startsWith("2 ")) {
      dropped++;
      continue;
    }
    if (!tleChecksumOk(tle1) || !tleChecksumOk(tle2)) {
      dropped++;
      continue;
    }
    const noradId = noradOf(tle1);
    const name = recordName(tle0.replace(/^0\s+/, ""), noradId);
    records.push({ noradId, name, line1: tle1, line2: tle2 });
  }
  return { records, dropped };
}

/** Etiqueta humana de fuente. El snapshot lleva su fecha y "(no live)". */
export function sourceLabel(source: CatalogSource): string {
  switch (source) {
    case "celestrak":
      return "CelesTrak (live)";
    case "satnogs":
      return "SatNOGS (live)";
    case "snapshot":
      return `snapshot ${SNAPSHOT_DATE} (no live)`;
    case "unavailable":
      return "unavailable";
  }
}

/** Atribucion por fuente (ciudadania 312 Q4 / 316 §4.1). */
export function attributionFor(source: CatalogSource): string {
  switch (source) {
    case "celestrak":
      return "Orbital data: CelesTrak (public GP data, celestrak.org).";
    case "satnogs":
      return "Orbital data: SatNOGS DB (satnogs.org); TLE provenance per record (Space-Track.org).";
    case "snapshot":
      return `Frozen catalog of ${SNAPSHOT_DATE} (CelesTrak GP, group active); not live.`;
    case "unavailable":
      return "";
  }
}

export function buildPayload(source: CatalogSource, parsed: ParsedCatalog, at: number): CatalogPayload {
  return {
    source,
    sourceLabel: sourceLabel(source),
    attribution: attributionFor(source),
    fetchedAt: source === "snapshot" ? SNAPSHOT_CAPTURED_AT : at,
    count: parsed.records.length,
    dropped: parsed.dropped,
    records: parsed.records,
  };
}

export interface AcquireDeps {
  fetchCelestrak: () => Promise<ParsedCatalog | null>;
  fetchSatnogs: () => Promise<ParsedCatalog | null>;
  loadSnapshot: () => ParsedCatalog | null;
  celestrakBlocked?: () => boolean;
  markCelestrakFailed?: () => void;
  now?: () => number;
}

/**
 * Cadena por-origen. Un catalogo vacio cuenta como fallo del origen (nunca
 * se sirve vacio como bueno). El fallo de CelesTrak abre la ventana negativa;
 * al expirar, la ruta vuelve a intentarlo sola (defensiva, 316 §4.2).
 */
export async function acquireCatalog(deps: AcquireDeps): Promise<CatalogPayload> {
  const now = deps.now ?? Date.now;
  const blocked = deps.celestrakBlocked ?? (() => false);
  if (!blocked()) {
    let ct: ParsedCatalog | null = null;
    try {
      ct = await deps.fetchCelestrak();
    } catch {
      ct = null;
    }
    if (ct && ct.records.length > 0) return buildPayload("celestrak", ct, now());
    deps.markCelestrakFailed?.();
  }
  const snap = deps.loadSnapshot();
  if (snap && snap.records.length > 0) return buildPayload("snapshot", snap, now());
  let sn: ParsedCatalog | null = null;
  try {
    sn = await deps.fetchSatnogs();
  } catch {
    sn = null;
  }
  if (sn && sn.records.length > 0) return buildPayload("satnogs", sn, now());
  return buildPayload("unavailable", { records: [], dropped: 0 }, now());
}

export interface CatalogCache {
  get(): CatalogPayload | null;
  set(payload: CatalogPayload): void;
}

/** Cache de payload con TTL (reloj inyectable para TU). */
export function createCatalogCache(ttlMs: number, now: () => number = Date.now): CatalogCache {
  let entry: { data: CatalogPayload; ts: number } | null = null;
  return {
    get(): CatalogPayload | null {
      if (entry && now() - entry.ts < ttlMs) return entry.data;
      return null;
    },
    set(payload: CatalogPayload): void {
      entry = { data: payload, ts: now() };
    },
  };
}

export interface FailureWindow {
  isBlocked(): boolean;
  markFailed(): void;
}

/** Ventana negativa por origen (reloj inyectable para TU). */
export function createFailureWindow(windowMs: number, now: () => number = Date.now): FailureWindow {
  let failedAt: number | null = null;
  return {
    isBlocked(): boolean {
      return failedAt !== null && now() - failedAt < windowMs;
    },
    markFailed(): void {
      failedAt = now();
    },
  };
}
