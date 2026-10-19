import { NextResponse } from "next/server";
import { parseFlr } from "@/lib/iono/flare";

/**
 * W-4 #3: flares solares del CCMC (DONKI) para el cross-check O3.4.
 * Endpoint verificado vivo el 2026-10-14:
 *   https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR
 * Cache 10 min (cortesia; el catalogo se actualiza por evento).
 */

export const revalidate = 0;

const UA = "IonosphereLive3D-Web/1.0 (exploration demo)";
const BASE = "https://ccmc.gsfc.nasa.gov";
const TTL = 600_000;
const LOOKBACK_DAYS = 7;

let cached: { data: unknown; ts: number } | null = null;

function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data, { headers: { "Cache-Control": "no-store", "X-Cache": "hit" } });
  }
  const now = Date.now();
  const end = new Date(now + 24 * 3600_000);
  const start = new Date(now - LOOKBACK_DAYS * 24 * 3600_000);
  const url = `${BASE}/DONKI-API/get/FLR?startDate=${day(start)}&endDate=${day(end)}`;
  let raw: unknown = null;
  let live = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error("upstream " + res.status);
    raw = await res.json();
    live = true;
  } catch {
    live = false;
  }
  // Sin red -> lista vacia honesta (el panel lo declara; jamas flares falsos).
  const flares = live ? parseFlr(raw) : [];
  const payload = {
    flares: flares.map((f) => ({
      flrId: f.flrId,
      begin: f.begin,
      peak: f.peak,
      end: f.end,
      classType: f.classType,
      srcLoc: f.srcLoc,
      ar: f.ar,
      link: f.link,
    })),
    checkedAt: now,
    source: live ? "CCMC DONKI FLR (live)" : "unavailable",
  };
  cached = { data: payload, ts: now };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store", "X-Cache": live ? "miss" : "miss" } });
}
