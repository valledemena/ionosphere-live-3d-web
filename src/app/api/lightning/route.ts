import { NextResponse } from "next/server";
import { newestPerSat, parseGlmList, parseNwsAlerts } from "@/lib/iono/lightning";

/**
 * W-4 F2a #8: GLM granules (AWS Open Data, no auth) + NWS storm warnings.
 * Fuentes verificadas vivas el 2026-10-14:
 *   https://noaa-goes19.s3.amazonaws.com/?list-type=2&prefix=GLM-L2-LCFA/...
 *   https://noaa-goes18.s3.amazonaws.com/?list-type=2&prefix=GLM-L2-LCFA/...
 *   (GOES-16 retirado: solo hasta 2025; operativos G19 Este + G18 Oeste)
 *   https://api.weather.gov/alerts/active?event=Severe%20Thunderstorm%20Warning
 * Cache 5 min (cortesia; los granulos ciclan cada 20 s).
 * Drop 349: max-keys=400 (≈180 granulos/hora a 20 s; 400 cubre la hora con
 * margen). Con 40, S3 devuelve las 40 claves lexicográficamente MÁS
 * ANTIGUAS de la hora y G19 envejece hasta ~47 min al final de la hora.
 */

export const revalidate = 0;

const UA = "IonosphereLive3D-Web/1.0 (exploration demo)";
const TTL = 300_000;

let cached: { data: unknown; ts: number } | null = null;

async function fetchText(url: string, timeoutMs: number, ua: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { "User-Agent": ua },
      signal: ctrl.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchJson(url: string, timeoutMs: number, ua: string): Promise<unknown> {
  const t = await fetchText(url, timeoutMs, ua);
  if (t == null) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

function dayHour(d: Date): { day: string; hour: string } {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const doy = String(Math.floor((d.getTime() - start) / 86400_000)).padStart(3, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  return { day: doy, hour: hh };
}

export async function GET() {
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data, { headers: { "Cache-Control": "no-store", "X-Cache": "hit" } });
  }
  const now = Date.now();
  const { day, hour } = dayHour(new Date(now));
  const [g19, g18, nws] = await Promise.all([
    fetchText(
      `https://noaa-goes19.s3.amazonaws.com/?list-type=2&prefix=GLM-L2-LCFA/2026/${day}/${hour}/&max-keys=400`,
      20000,
      UA
    ),
    fetchText(
      `https://noaa-goes18.s3.amazonaws.com/?list-type=2&prefix=GLM-L2-LCFA/2026/${day}/${hour}/&max-keys=400`,
      20000,
      UA
    ),
    fetchJson(
      "https://api.weather.gov/alerts/active?event=Severe%20Thunderstorm%20Warning",
      20000,
      UA + " (research contact)"
    ),
  ]);
  // Sin red -> estados honestos vacios (O5.4: jamas flashes falsos).
  // Drop 349: parse separado + recorte por satelite (newestPerSat) — el
  // slice(0,40) global sobre [G19…, G18…] dejaba el panel sin G18.
  const granules = newestPerSat(
    parseGlmList(g19 ?? "", "G19"),
    parseGlmList(g18 ?? "", "G18"),
    40
  );
  const storms = parseNwsAlerts(nws, now);
  const payload = {
    granules: granules.map((g) => ({
      sat: g.sat,
      start: g.start,
      end: g.end,
      size: g.size,
    })),
    storms: storms.slice(0, 12).map((s) => ({
      id: s.id,
      lat: s.lat,
      lon: s.lon,
      area: s.area,
      onset: s.onset,
      ends: s.ends,
    })),
    checkedAt: now,
    source: g19 || g18 ? "GLM AWS + NWS (live)" : "unavailable",
  };
  cached = { data: payload, ts: now };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store", "X-Cache": "miss" } });
}
