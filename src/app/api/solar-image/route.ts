import { NextResponse } from "next/server";

/**
 * Proxy de imagen solar SDO (HMI continuo + AIA 304 según ?type=).
 * Devuelve la imagen JPEG cacheada 15 min como array buffer.
 *   ?type=hmi  -> latest_512_HMIIF.jpg (disco visible + manchas)
 *   ?type=aia304 -> latest_512_0304.jpg (cromosfera, fulguraciones)
 */

export const revalidate = 0;

const URLS: Record<string, string> = {
  hmi: "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_HMIIF.jpg",
  aia304: "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0304.jpg",
  aia193: "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0193.jpg",
};

const cache = new Map<string, { buf: ArrayBuffer; ct: string; ts: number }>();
const TTL = 15 * 60_000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "hmi";
  const target = URLS[type] ?? URLS.hmi;

  const hit = cache.get(type);
  if (hit && Date.now() - hit.ts < TTL) {
    return new NextResponse(hit.buf, {
      headers: {
        "Content-Type": hit.ct,
        "Cache-Control": "no-store",
        "X-Cache": "hit",
      },
    });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(target, {
      headers: { "User-Agent": "IonosphereLive3D-Web/1.0" },
      signal: ctrl.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return NextResponse.json({ error: "upstream " + res.status }, { status: 502 });
    }
    const buf = await res.arrayBuffer();
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    cache.set(type, { buf, ct, ts: Date.now() });
    return new NextResponse(buf, {
      headers: { "Content-Type": ct, "Cache-Control": "no-store", "X-Cache": "miss" },
    });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
