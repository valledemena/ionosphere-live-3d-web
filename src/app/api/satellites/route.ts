// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — /api/satellites: shell data layer (drop 317, F2b #10).
//
// Cabecera de la cadena por-origen adjudicada (316 §4, estrategia de 315 §6):
// CelesTrak (vivo) -> snapshot completo fechado -> SatNOGS (vivo, subconjunto)
// -> unavailable. SatNOGS solo trae ~1.7k objetos con transmisor registrado;
// el snapshot completo (~15.9k) conserva la densidad visual de ECO 2026.
// La logica pura vive en @/lib/iono/satellites/catalog (cero red, testeable);
// esta ruta solo inyecta los fetchers, la cache TTL y la ciudadania.
//
// Ciudadania (312 Q4): User-Agent propio; CelesTrak GROUP <= 1 consulta/2 h
// (payload TTL 6 h) + ventana negativa de 30 min tras fallo (la ruta defensiva
// se reactiva sola); SatNOGS una peticion por TTL con atribucion en el payload.
// Honestidad: nunca fingir vivo (el snapshot lleva su fecha); 'unavailable' es
// estado nulo honesto y no se cachea (un throttle transitorio no debe congelarse).

import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CATALOG_TTL_MS,
  CELESTRAK_ACTIVE_URL,
  CELESTRAK_FAIL_WINDOW_MS,
  SATNOGS_TLE_URL,
  SNAPSHOT_FILE,
  acquireCatalog,
  createCatalogCache,
  createFailureWindow,
  parseSatnogsTle,
  parseTleCatalog,
  type ParsedCatalog,
} from "@/lib/iono/satellites/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UA = "IonosphereLive3D-Web/1.0 (exploration demo)";
const CELESTRAK_TIMEOUT_MS = 25_000;
const SATNOGS_TIMEOUT_MS = 15_000;

const cache = createCatalogCache(CATALOG_TTL_MS);
const celestrakWindow = createFailureWindow(CELESTRAK_FAIL_WINDOW_MS);
let snapshot: ParsedCatalog | null = null;

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function tryCelestrak(): Promise<ParsedCatalog | null> {
  const text = await fetchText(CELESTRAK_ACTIVE_URL, CELESTRAK_TIMEOUT_MS);
  if (!text) return null;
  const parsed = parseTleCatalog(text);
  return parsed.records.length > 0 ? parsed : null;
}

async function trySatnogs(): Promise<ParsedCatalog | null> {
  const text = await fetchText(SATNOGS_TLE_URL, SATNOGS_TIMEOUT_MS);
  if (!text) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = parseSatnogsTle(json);
  return parsed.records.length > 0 ? parsed : null;
}

function loadSnapshot(): ParsedCatalog | null {
  if (snapshot) return snapshot;
  try {
    const text = readFileSync(
      join(process.cwd(), "src", "lib", "iono", "satellites", SNAPSHOT_FILE),
      "utf8",
    );
    const parsed = parseTleCatalog(text);
    snapshot = parsed.records.length > 0 ? parsed : null;
  } catch {
    snapshot = null;
  }
  return snapshot;
}

export async function GET() {
  const hit = cache.get();
  if (hit) {
    return NextResponse.json(hit, { headers: { "Cache-Control": "no-store", "X-Cache": "hit" } });
  }
  const payload = await acquireCatalog({
    fetchCelestrak: tryCelestrak,
    fetchSatnogs: trySatnogs,
    loadSnapshot,
    celestrakBlocked: () => celestrakWindow.isBlocked(),
    markCelestrakFailed: () => celestrakWindow.markFailed(),
  });
  if (payload.source !== "unavailable") cache.set(payload);
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store", "X-Cache": "miss" } });
}
