import { NextResponse } from "next/server";
import { selectMagSource } from "@/lib/iono/parker";

/**
 * Agregador de clima espacial NOAA SWPC con caché en memoria (90 s).
 * Fuentes verificadas desde el sandbox:
 *   - Kp 1-min:          /json/planetary_k_index_1m.json
 *   - F10.7:             /json/f107_cm_flux.json
 *   - Viento solar:      /products/summary/solar-wind-speed.json + solar-wind-mag-field.json
 *   - GOES X-ray:        /json/goes/primary/xrays-6-hour.json (+ xrays-1-day.json W-4 F2a #2)
 *   - Protones GOES:     /json/goes/primary/integral-protons-1-day.json (sat 18, W-4 F2a #2)
 *   - Manchas solares:   /json/sunspot_report.json
 *   - Forecast 3 días:   /text/3-day-forecast.txt
 */

export const revalidate = 0;

const UA = "IonosphereLive3D-Web/1.0 (exploration demo)";
const BASE = "https://services.swpc.noaa.gov";

const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 90_000;

async function fetchJson<T>(path: string, timeoutMs = 12000): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${BASE}${path}`, {
      headers: { "User-Agent": UA },
      signal: ctrl.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchText(path: string, timeoutMs = 12000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${BASE}${path}`, {
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

function xrayClass(flux: number): string {
  if (flux >= 1e-4) return "X" + (flux / 1e-4).toFixed(1);
  if (flux >= 1e-5) return "M" + (flux / 1e-5).toFixed(1);
  if (flux >= 1e-6) return "C" + (flux / 1e-6).toFixed(1);
  if (flux >= 1e-7) return "B" + (flux / 1e-7).toFixed(1);
  return "A" + (flux / 1e-8).toFixed(1);
}

function gScale(kp: number): number {
  if (kp >= 9) return 5;
  if (kp >= 8) return 4;
  if (kp >= 7) return 3;
  if (kp >= 6) return 2;
  if (kp >= 5) return 1;
  return 0;
}

interface KpRow { time_tag: string; estimated_kp: number; kp_index: number }
interface FRow { time_tag: string; flux: number }
interface WindSpeedRow { time_tag: string; proton_speed: number }
interface WindMagRow { time_tag: string; bt: number; bz_gsm: number }
interface WindDensityRow { time_tag: string; proton_density: number }
interface Mag1mRow { time_tag: string; bx_gse: number; bt: number; active: boolean }
interface XrayRow { time_tag: string; flux: number; energy: string }
interface ProtonRow { time_tag: string; satellite: number; flux: number; energy: string }
interface SunspotRow { time_tag: string; Region: number; Latitude: number; Longitude: number; Location?: string; Report_Location?: string }

export async function GET() {
  const hit = cache.get("sw");
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json(hit.data, { headers: { "Cache-Control": "no-store", "X-Cache": "hit" } });
  }

  const [kpArr, f107Arr, windSpeed, windMag, windDensity, xrayArr, xrayDayArr, protonArr, mag1mArr, sunspots, forecastTxt] = await Promise.all([
    fetchJson<KpRow[]>("/json/planetary_k_index_1m.json"),
    fetchJson<FRow[]>("/json/f107_cm_flux.json"),
    fetchJson<WindSpeedRow[]>("/products/summary/solar-wind-speed.json"),
    fetchJson<WindMagRow[]>("/products/summary/solar-wind-mag-field.json"),
    // W-4 #4: densidad de protones (rtsw 1-min, mismo host/cortesía SWPC).
    fetchJson<WindDensityRow[]>("/json/rtsw/rtsw_wind_1m.json"),
    fetchJson<XrayRow[]>("/json/goes/primary/xrays-6-hour.json"),
    // W-4 F2a #2: XRS 1 día + protones integrales 1 día (verdad de entrada O2).
    fetchJson<XrayRow[]>("/json/goes/primary/xrays-1-day.json"),
    fetchJson<ProtonRow[]>("/json/goes/primary/integral-protons-1-day.json"),
    // W-4 F2b #12: vector mag 1-min (Bx para polaridad de sector, O12).
    fetchJson<Mag1mRow[]>("/json/rtsw/rtsw_mag_1m.json"),
    fetchJson<SunspotRow[]>("/json/sunspot_report.json"),
    fetchText("/text/3-day-forecast.txt"),
  ]);

  const now = Date.now();

  // P1-284: fuente ACTIVA + extremo NUEVO (el feed es descendente y
  // multi-nave; leer [length-1] daba la muestra más vieja de nave
  // arbitraria). Serie ascendente de una sola fuente para los cruces.
  const magRows = (mag1mArr ?? []).map((e) => ({
    t: new Date(e.time_tag + "Z").getTime(),
    bx: e.bx_gse ?? null,
    active: e.active === true,
  }));
  const magSel = selectMagSource(magRows, 3, now);
  const bxNow = magSel.length ? magSel[magSel.length - 1].bx : 0;

  // Kp actual + serie (últimas 24 h remuestreada)
  let kpNow = 0;
  const kpSeries: { t: number; kp: number }[] = [];
  if (kpArr && kpArr.length) {
    const latest = kpArr[kpArr.length - 1];
    kpNow = latest.estimated_kp ?? latest.kp_index ?? 0;
    const cut = now - 24 * 3600_000;
    const pts = kpArr.filter((k) => new Date(k.time_tag + "Z").getTime() >= cut);
    const step = Math.max(1, Math.floor(pts.length / 96));
    for (let i = 0; i < pts.length; i += step) {
      kpSeries.push({
        t: new Date(pts[i].time_tag + "Z").getTime(),
        kp: pts[i].estimated_kp ?? pts[i].kp_index ?? 0,
      });
    }
    kpSeries.push({ t: new Date(latest.time_tag + "Z").getTime(), kp: kpNow });
  }

  // F10.7 (último no nulo) + serie
  let f107Now = 0;
  const f107Series: { t: number; f: number }[] = [];
  if (f107Arr && f107Arr.length) {
    for (const e of f107Arr) {
      if (e.flux != null && e.flux > 0) {
        f107Series.push({ t: new Date(e.time_tag + "Z").getTime(), f: e.flux });
      }
    }
    f107Now = f107Series.length ? f107Series[f107Series.length - 1].f : 0;
  }

  // Viento solar
  const wind = {
    speed: windSpeed?.length ? windSpeed[windSpeed.length - 1].proton_speed ?? 0 : 0,
    bt: windMag?.length ? windMag[windMag.length - 1].bt ?? 0 : 0,
    bz: windMag?.length ? windMag[windMag.length - 1].bz_gsm ?? 0 : 0,
    bx: bxNow,
    density: windDensity?.length
      ? windDensity[windDensity.length - 1].proton_density ?? 0
      : 0,
    t: windMag?.length ? windMag[windMag.length - 1].time_tag : null,
  };

  // Bx 1-min 3 h de la fuente activa (polaridad de sector O12).
  const magSeries = magSel.filter((_, i) => i % 5 === 0).slice(-216);

  // X-ray GOES (serie 0.1-0.8nm + clase actual)
  const xrSeries: { t: number; f: number }[] = [];
  let xrNow = 0;
  if (xrayArr) {
    for (const e of xrayArr) {
      if (e.energy === "0.1-0.8nm" && e.flux != null) {
        xrSeries.push({ t: new Date(e.time_tag).getTime(), f: e.flux });
        if (e.flux > 0) xrNow = e.flux;
      }
    }
  }

  // X-ray GOES 1 día (verdad de entrada O2; la serie 6 h sigue intacta abajo).
  const xrDay: { t: number; f: number }[] = [];
  if (xrayDayArr) {
    for (const e of xrayDayArr) {
      if (e.energy === "0.1-0.8nm" && e.flux != null && e.flux > 0) {
        xrDay.push({ t: new Date(e.time_tag).getTime(), f: e.flux });
      }
    }
  }

  // Protones integrales GOES (sat 18): serie >=10 MeV + último flujo.
  const prSeries: { t: number; f: number }[] = [];
  let prNow = 0;
  if (protonArr) {
    for (const e of protonArr) {
      if (e.energy === ">=10 MeV" && e.flux != null && e.flux >= 0) {
        const t = new Date(e.time_tag).getTime();
        prSeries.push({ t, f: e.flux });
        prNow = e.flux;
      }
    }
  }

  // Manchas solares (regiones activas únicas, más recientes)
  const regions: { region: number; lat: number; lon: number; loc: string }[] = [];
  if (sunspots) {
    const seen = new Map<number, { region: number; lat: number; lon: number; loc: string; t: number }>();
    for (const s of sunspots) {
      if (!s.Region) continue;
      const t = new Date(s.time_tag).getTime();
      const prev = seen.get(s.Region);
      if (!prev || t > prev.t) {
        seen.set(s.Region, {
          region: s.Region,
          lat: s.Latitude,
          lon: s.Longitude,
          loc: s.Location ?? s.Report_Location ?? "",
          t,
        });
      }
    }
    for (const v of seen.values()) {
      regions.push({ region: v.region, lat: v.lat, lon: v.lon, loc: v.loc });
    }
  }

  // Forecast 3 días
  let forecastMaxKp: number | null = null;
  let forecastNote = "";
  if (forecastTxt) {
    const m = forecastTxt.match(/greatest expected 3 hr Kp[^]*?is ([\d.]+)/);
    if (m) forecastMaxKp = parseFloat(m[1]);
    const r = forecastTxt.match(/Rationale:(.+)/);
    if (r) forecastNote = r[1].trim().replace(/\s+/g, " ").slice(0, 260);
  }

  const data = {
    updated: now,
    utc: new Date(now).toISOString(),
    kp: {
      now: kpNow,
      gScale: gScale(kpNow),
      series: kpSeries.slice(-96),
      source: kpArr ? "NOAA SWPC (live)" : "unavailable",
    },
    f107: {
      now: f107Now,
      series: f107Series.slice(-72),
      source: f107Arr ? "NOAA (live)" : "unavailable",
    },
    wind: { ...wind, source: windMag && windSpeed ? "NOAA DSCOVR (live)" : "unavailable" },
    mag: {
      series: magSeries.filter((_, i) => i % 5 === 0).slice(-216),
      source: mag1mArr ? "DSCOVR mag 1-min (live)" : "unavailable",
    },
    xray: {
      now: xrNow,
      class: xrNow > 0 ? xrayClass(xrNow) : "—",
      series: xrSeries.slice(-360),
      seriesDay: xrDay.slice(-1440),
      source: xrayArr ? "GOES primario (live)" : "unavailable",
    },
    protons: {
      now: prNow,
      series: prSeries.slice(-1440),
      satellite: 18,
      source: protonArr ? "GOES-18 protones (live)" : "unavailable",
    },
    sunspots: { regions, source: sunspots ? "NOAA SWPC (live)" : "unavailable" },
    forecast: {
      maxKp: forecastMaxKp,
      note: forecastNote,
      source: forecastTxt ? "NOAA 3-day (live)" : "unavailable",
    },
  };

  cache.set("sw", { data, ts: now });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store", "X-Cache": "miss" } });
}
