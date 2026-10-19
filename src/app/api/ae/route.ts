import { NextResponse } from "next/server";
import { parseKyotoAe, aeFileName } from "@/lib/iono/electrojets";

/**
 * W-4 F2a #17: AE realtime de Kyoto WDC (digital desde dic-2024).
 * Patron MENSUAL fijado por este drop (O17):
 *   https://wdc.kugi.kyoto-u.ac.jp/ae_realtime/data_dir/YYYY/MM/DD/aeYYMMDD
 * P1-279: el repositorio publica con lag de HASTA 3 SEMANAS POR DISENO
 * (00readme.pdf oficial) — hoy+ayer dan 404 siempre. Walk-back dia a
 * dia (cap 35) hasta el ultimo disponible; ventana 24 h relativa AL
 * DATO y edad visible en el payload. Uso no-comercial + cita obligatoria.
 */

export const revalidate = 0;

const UA = "IonosphereLive3D-Web/1.0 (exploration demo)";
const BASE = "https://wdc.kugi.kyoto-u.ac.jp/ae_realtime/data_dir";
const TTL = 900_000;

let cached: { data: unknown; ts: number } | null = null;

async function fetchText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
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

export async function GET() {
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data, { headers: { "Cache-Control": "no-store", "X-Cache": "hit" } });
  }
  const now = Date.now();
  // P1-279 walk-back: el ultimo dia disponible (cap 35 dias por el lag
  // documentado de 3 semanas; los 404 son rapidos, el hit trae ~9 KB).
  let text: string | null = null;
  let found: { y: number; m: number; d: number } | null = null;
  for (let k = 0; k < 35 && text == null; k++) {
    const dt = new Date(now - k * 86400_000);
    const dd = { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
    const mm = String(dd.m).padStart(2, "0");
    const dd2 = String(dd.d).padStart(2, "0");
    text = await fetchText(`${BASE}/${dd.y}/${mm}/${dd2}/${aeFileName(dd.y, dd.m, dd.d)}`);
    if (text) found = dd;
  }
  if (!text || !found) {
    const payload = {
      now: 0, max24h: 0, series: [], count: 0, checkedAt: now,
      ageDays: -1, latestDate: null,
      source: "unavailable",
    };
    cached = { data: payload, ts: now };
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store", "X-Cache": "miss" } });
  }
  const pts = parseKyotoAe(text, found.y, found.m, found.d);
  const latest = pts.length ? pts[pts.length - 1].t : now;
  const ageDays = Math.max(0, Math.round((now - latest) / 86400_000));
  // Ventana 24 h relativa AL ULTIMO DATO (no a hoy).
  const cut = latest - 24 * 3600_000;
  const win = pts.filter((p) => p.t >= cut && p.t <= latest);
  const series: { t: number; ae: number }[] = [];
  for (let i = 0; i < win.length; i += 5) series.push(win[i]);
  const live = win.length > 0;
  const payload = {
    now: live ? win[win.length - 1].ae : 0,
    max24h: live ? Math.max(...win.map((p) => p.ae)) : 0,
    series,
    count: win.length,
    checkedAt: now,
    ageDays,
    latestDate: new Date(latest).toISOString().slice(0, 10),
    source: "Kyoto WDC AE realtime (live)",
  };
  cached = { data: payload, ts: now };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store", "X-Cache": "miss" } });
}
