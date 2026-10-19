import { NextResponse } from "next/server";
import { parseEnlilSims, pickCmeEvent } from "@/lib/iono/cme";

/**
 * W-4 #1: ultimo pronostico WSA-Enlil del CCMC (DONKI).
 * Endpoint verificado vivo el 2026-10-14 (la forma sin `/get/` da 404):
 *   https://ccmc.gsfc.nasa.gov/DONKI-API/get/WSAEnlilSimulations
 * La vieja api.nasa.gov/DONKI con DEMO_KEY esta saturada/migrada: NO usar.
 * Cache 10 min (las sims completan en horas; cortesia con el CCMC).
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
  const url =
    `${BASE}/DONKI-API/get/WSAEnlilSimulations` +
    `?startDate=${day(start)}&endDate=${day(end)}`;
  let data: unknown;
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
    data = await res.json();
  } catch {
    // O1.1 reposo honesto: sin red -> unknown, jamas CME ficticio.
    data = { status: "unknown", event: null, modelTime: null, simCount: 0, checkedAt: now, source: "unavailable" };
    cached = { data, ts: now };
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store", "X-Cache": "miss" } });
  }
  const sims = parseEnlilSims(data);
  const sel = pickCmeEvent(sims);
  const latest = sims.length
    ? Math.max(...sims.map((s) => s.modelCompletionTime ?? 0))
    : null;
  const payload =
    sel.status === "event"
      ? {
          status: "event",
          event: {
            simId: sel.simId,
            modelTime: sel.modelTime,
            start: sel.start,
            arrival: sel.arrival,
            durationH: sel.durationH,
            earthGB: sel.earthGB,
            speed: sel.speed,
            halfAngle: sel.halfAngle,
            srcLat: sel.srcLat,
            srcLon: sel.srcLon,
            cmeId: sel.cmeId,
            kpMax: sel.kpMax,
            link: sel.link,
          },
          modelTime: sel.modelTime,
          simCount: sims.length,
          checkedAt: now,
          source: "CCMC DONKI ENLIL (live)",
        }
      : sel.status === "quiet"
        ? {
            status: "quiet",
            event: null,
            modelTime: sel.modelTime,
            simCount: sims.length,
            checkedAt: now,
            source: "CCMC DONKI ENLIL (live)",
          }
        : {
            status: "unknown",
            event: null,
            modelTime: latest && latest > 0 ? latest : null,
            simCount: sims.length,
            checkedAt: now,
            source: "unavailable",
          };
  cached = { data: payload, ts: now };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store", "X-Cache": "miss" } });
}
