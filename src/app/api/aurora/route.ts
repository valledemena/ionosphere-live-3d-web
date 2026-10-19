import { NextResponse } from "next/server";

/**
 * NOAA OVATION aurora: descarga el grid completo (360×181) y lo reduce a
 * un JSON compacto (celdas con prob > 8%) para el render de cortinas.
 * Caché 5 min (el upstream se actualiza ~10 min).
 */

export const revalidate = 0;

const URL_OVATION = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";

interface OvationResponse {
  "Observation Time": string;
  "Forecast Time": string;
  coordinates: [number, number, number][]; // [lon, lat, prob 0-100]
}

let cached: { data: unknown; ts: number } | null = null;
const TTL = 300_000;

export async function GET() {
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data, { headers: { "Cache-Control": "no-store", "X-Cache": "hit" } });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(URL_OVATION, {
      headers: { "User-Agent": "IonosphereLive3D-Web/1.0" },
      signal: ctrl.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return NextResponse.json({ error: "upstream " + res.status, cells: [] }, { status: 200 });
    }
    const ov = (await res.json()) as OvationResponse;

    // Downsample: el grid original es lon 0..359 (paso 1) × lat -90..90 (paso 1).
    // Agrupamos a celdas de 2° para compactar (~180×45 relevantes del anillo).
    const agg = new Map<number, { sum: number; n: number; lat: number; lon: number }>();
    for (const [lon, lat, p] of ov.coordinates) {
      const lat2 = Math.round(lat / 2) * 2;
      const lon2 = Math.round(lon / 2) * 2;
      const k = (lat2 + 90) * 1000 + lon2;
      const e = agg.get(k) ?? { sum: 0, n: 0, lat: lat2, lon: lon2 };
      e.sum += p;
      e.n += 1;
      agg.set(k, e);
    }
    const cells: { lat: number; lon: number; p: number }[] = [];
    for (const e of agg.values()) {
      const p = e.sum / e.n;
      if (p > 8) cells.push({ lat: e.lat, lon: e.lon, p: Math.round(p) });
    }

    const data = {
      updated: Date.now(),
      observationTime: ov["Observation Time"],
      forecastTime: ov["Forecast Time"],
      cells, // ~1500-4000 celdas en anillo auroral
      source: "NOAA SWPC Ovation (live)",
    };
    cached = { data, ts: Date.now() };
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store", "X-Cache": "miss" } });
  } catch {
    return NextResponse.json(
      { error: "fetch_failed", cells: [], updated: Date.now() },
      { status: 200 }
    );
  }
}
