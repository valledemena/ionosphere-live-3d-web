import { NextResponse } from "next/server";
import { parseHorizons, pickCurrentRow, friisReceivedW, lightTimeSec } from "@/lib/iono/voyager";

/**
 * W-4 F2b #7: rango Voyager 1 fresco (JPL Horizons, O7).
 * El pin del catalogo (172.4869 AU del 14-oct) NO es eterno: se
 * refresca al ejecutar. Cache 6 h (la deriva es ~0.01 UA/dia).
 */

export const revalidate = 0;

const UA = "IonosphereLive3D-Web/1.0 (exploration demo)";
const TTL = 21600_000;

let cached: { data: unknown; ts: number } | null = null;

function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data, { headers: { "Cache-Control": "no-store", "X-Cache": "hit" } });
  }
  const now = Date.now();
  const end = new Date(now + 2 * 86400_000);
  const body = new URLSearchParams({
    format: "text",
    COMMAND: "'-31'",
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'500@399'",
    START_TIME: `'${day(new Date(now))}'`,
    STOP_TIME: `'${day(end)}'`,
    STEP_SIZE: "'1d'",
    QUANTITIES: "'20'",
  });
  let text: string | null = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch("https://ssd.jpl.nasa.gov/api/horizons.api", {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: ctrl.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error("upstream " + res.status);
    text = await res.text();
  } catch {
    text = null;
  }
  // Sin red -> honesto sin rango (jamas rango ficticio).
  // P1-286: fila pasada mas cercana (nunca la futura de la ventana).
  const fix = text ? pickCurrentRow(parseHorizons(text), now) : null;
  const payload = fix
    ? {
        au: fix.au,
        date: fix.date,
        lightHours: lightTimeSec(fix.au) / 3600,
        prW: friisReceivedW(fix.au),
        checkedAt: now,
        source: "JPL Horizons (live)",
      }
    : {
        au: null,
        date: null,
        lightHours: null,
        prW: null,
        checkedAt: now,
        source: "unavailable",
      };
  // Observación 293 §5.3: el fallback honesto NO se cachea (un throttle
  // transitorio no congela 'unavailable' 6 h; reintenta en cada llamada).
  if (fix) cached = { data: payload, ts: now };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store", "X-Cache": "miss" } });
}
