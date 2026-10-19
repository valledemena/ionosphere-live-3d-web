import { NextResponse } from "next/server";
import { parseDstWdc, parseGst } from "@/lib/iono/dst";

/**
 * W-4 F2a #18: Dst realtime de Kyoto WDC + tormentas GST del DONKI.
 * Patrones verificados vivos el 2026-10-15:
 *   https://wdc.kugi.kyoto-u.ac.jp/dst_realtime/presentmonth/dstYYMM.for.request
 *   (alias del mes en curso; forma WDC `DST2610*DD` + 24 horarios)
 *   https://ccmc.gsfc.nasa.gov/DONKI-API/get/GST (complemento declarado)
 * Kyoto advierte: valores crudos sin verificar (declarado en el panel).
 */

export const revalidate = 0;

const UA = "IonosphereLive3D-Web/1.0 (exploration demo)";
const TTL = 900_000;

let cached: { data: unknown; ts: number } | null = null;

async function fetchText(url: string, timeoutMs = 20000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json, text/plain, */*" },
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
  const dt = new Date(now);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + 1;
  const tag = String(y).slice(2) + String(m).padStart(2, "0");
  // P1-281: el AE digital vive con lag de semanas; el diagrama de fase
  // necesita Dst del rango del AE -> tambien el mes anterior.
  const pm = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const ptag = String(pm.y).slice(2) + String(pm.m).padStart(2, "0");
  const end = new Date(now + 24 * 3600_000);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const [dstTxt, dstPrevTxt, gstTxt] = await Promise.all([
    fetchText(`https://wdc.kugi.kyoto-u.ac.jp/dst_realtime/presentmonth/dst${tag}.for.request`),
    fetchText(`https://wdc.kugi.kyoto-u.ac.jp/dst_realtime/${pm.y}${String(pm.m).padStart(2, "0")}/dst${ptag}.for.request`),
    fetchText(
      `https://ccmc.gsfc.nasa.gov/DONKI-API/get/GST?startDate=${day(new Date(now - 30 * 86400_000))}&endDate=${day(end)}`
    ),
  ]);
  let gst: unknown = null;
  if (gstTxt) {
    try {
      gst = JSON.parse(gstTxt) as unknown;
    } catch {
      gst = null;
    }
  }
  const pts = dstTxt ? parseDstWdc(dstTxt, y, m) : [];
  if (dstPrevTxt) pts.push(...parseDstWdc(dstPrevTxt, pm.y, pm.m));
  pts.sort((a, b) => a.t - b.t);
  // Ventana larga (45 d) para el diagrama de fase con el AE con lag;
  // min7d y now siguen sobre los ultimos 7 dias.
  const cut = now - 45 * 86400_000;
  const cut7 = now - 7 * 86400_000;
  const win = pts.filter((p) => p.t >= cut && p.t <= now);
  const win7 = win.filter((p) => p.t >= cut7);
  const live = win7.length > 0;
  const payload = {
    now: live ? win7[win7.length - 1].dst : 0,
    min7d: live ? Math.min(...win7.map((p) => p.dst)) : 0,
    series: win.filter((_, i) => i % 3 === 0).map((p) => ({ t: p.t, dst: p.dst })),
    count: win.length,
    gst: parseGst(gst).map((g) => ({ id: g.id, start: g.start, kpMax: g.kpMax, link: g.link })),
    checkedAt: now,
    source: dstTxt ? "Kyoto WDC Dst realtime (live)" : "unavailable",
  };
  cached = { data: payload, ts: now };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store", "X-Cache": "miss" } });
}
