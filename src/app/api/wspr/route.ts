import { NextResponse } from "next/server";
import { parseWsprTable } from "@/lib/iono/wspr";

/**
 * W-4 #5: spots WSPR vivos (tabla HTML olddb, catalogo 251 §D).
 * Fuente verificada viva el 2026-10-14:
 *   http://wsprnet.org/olddb?mode=html&band=all&limit=50
 * Uso cortes (O5.1): limite 50 filas + cache 5 min (los spots ciclan
 * cada 2 min; no se golpea la BD legada en cada visita).
 */

export const revalidate = 0;

const UA = "IonosphereLive3D-Web/1.0 (exploration demo)";
const URL = "http://wsprnet.org/olddb?mode=html&band=all&limit=50";
const TTL = 300_000;

let cached: { data: unknown; ts: number } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data, { headers: { "Cache-Control": "no-store", "X-Cache": "hit" } });
  }
  const now = Date.now();
  let html: string | null = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(URL, {
      headers: { "User-Agent": UA },
      signal: ctrl.signal,
      next: { revalidate: 0 },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error("upstream " + res.status);
    html = await res.text();
  } catch {
    html = null;
  }
  // Sin red -> lista vacia honesta (O5.4: "sin datos", jamas sinteticos).
  const spots = html ? parseWsprTable(html, now) : [];
  const payload = {
    spots,
    fetchedAt: now,
    source: html ? "WSPRnet olddb (live)" : "unavailable",
  };
  cached = { data: payload, ts: now };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store", "X-Cache": "miss" } });
}
