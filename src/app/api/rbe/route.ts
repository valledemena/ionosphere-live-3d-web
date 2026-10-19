import { NextResponse } from "next/server";
import { parseRbe } from "@/lib/iono/belts";

/**
 * W-4 F2a #19: eventos RBE del DONKI (radiation belt enhancements).
 * Endpoint verificado vivo el 2026-10-15:
 *   https://ccmc.gsfc.nasa.gov/DONKI-API/get/RBE
 * Cache 30 min (los eventos son diarios/semanales, no minuto a minuto).
 */

export const revalidate = 0;

const UA = "IonosphereLive3D-Web/1.0 (exploration demo)";
const TTL = 1800_000;

let cached: { data: unknown; ts: number } | null = null;

function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data, { headers: { "Cache-Control": "no-store", "X-Cache": "hit" } });
  }
  const now = Date.now();
  // P1-282: DONKI rechaza rangos >60 dias (400 determinista). Ventana
  // de 58 dias sin padding futuro (verificada 200 en la sonda).
  const end = new Date(now);
  const start = new Date(now - 58 * 86400_000);
  const url =
    `https://ccmc.gsfc.nasa.gov/DONKI-API/get/RBE` +
    `?startDate=${day(start)}&endDate=${day(end)}`;
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
  // Sin red -> lista vacia honesta (jamas eventos falsos).
  const events = live ? parseRbe(raw) : [];
  const payload = {
    events: events.slice(0, 8).map((e) => ({
      id: e.id,
      time: e.time,
      instrument: e.instrument,
      link: e.link,
    })),
    checkedAt: now,
    source: live ? "CCMC DONKI RBE (live)" : "unavailable",
  };
  cached = { data: payload, ts: now };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store", "X-Cache": "miss" } });
}
