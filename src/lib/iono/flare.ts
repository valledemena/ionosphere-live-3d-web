/**
 * W-4 #3 flare -> SID (ruling 252, oraculos O3.1-O3.5). Puro: sin DOM ni red.
 *
 * REFERENCIA PINEADA (regla 252, ANTES de codigo):
 * (a) XRS vivo: la serie `xray.series` de /api/space-weather ya consumida
 *     (GOES primario 0.1-0.8nm, forma {t, f} verificada viva).
 * (b) Fisica D: `dRegionAbsorptionDb` de ionomath.ts (demo `abs`, idea
 *     "Absorcion D (Sauer-Wilkinson)": A = 4.5*(F/1e-6)^0.75 dB de dia).
 *     La escena y el panel consumen ESA funcion — cero curvas inventadas
 *     (O3.2). Nota de precision: el ruling la llama "perfil Wait-Spies";
 *     lo portado es Sauer-Wilkinson simplificado — se cita lo que hay.
 * (c) DONKI FLR: `GET ccmc.gsfc.nasa.gov/DONKI-API/get/FLR` (verificado
 *     vivo 2026-10-14): [{flrID, beginTime, peakTime, endTime, classType
 *     ("C7.9"/"M1.2"), sourceLocation ("N10W04"), activeRegionNum, link}].
 *
 * Determinismo (O3.1/O3.3): todo es funcion pura de (serie, epoch) — en
 * replay, mismo XRS -> mismo efecto; la recuperacion en horas sale de la
 * propia serie GOES (el flujo decae solo), sin relojes inventados.
 */

export const FLUX_M1 = 1e-5; // W/m2: umbral de evento del ruling
export const FLUX_C1 = 1e-6;
export const FLUX_X1 = 1e-4;

/** Clase letra+magnitud ("M5.0", espejo del xrayClass de la ruta). */
export function flareClass(flux: number): string {
  if (!(flux > 0)) return "\u2014";
  if (flux >= FLUX_X1) return "X" + (flux / FLUX_X1).toFixed(1);
  if (flux >= FLUX_M1) return "M" + (flux / FLUX_M1).toFixed(1);
  if (flux >= FLUX_C1) return "C" + (flux / FLUX_C1).toFixed(1);
  if (flux >= 1e-7) return "B" + (flux / 1e-7).toFixed(1);
  return "A" + (flux / 1e-8).toFixed(1);
}

export interface XrayPt {
  t: number; // ms
  f: number; // W/m2
}

/** Muestreo de la serie GOES en un epoch (lerp; espejo sampleStationAt). */
export function sampleXrayAt(series: XrayPt[], epochMs: number): number {
  if (!series.length) return 0;
  if (epochMs <= series[0].t) return series[0].f;
  const last = series[series.length - 1];
  if (epochMs >= last.t) return last.f;
  let lo = 0;
  let hi = series.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (series[m].t <= epochMs) lo = m;
    else hi = m;
  }
  const a = series[lo];
  const b = series[hi];
  const f = (epochMs - a.t) / (b.t - a.t || 1);
  return a.f + f * (b.f - a.f);
}

export interface FlareState {
  /** 0..1 (mapa log C1->0, X1->1): intensidad para el flash. */
  level: number;
  /** Pico de la ventana (W/m2) y su instante. */
  peak: number;
  peakTime: number | null;
  /** true si el pico >= M1 (gatillo del ruling O3.1). */
  isEvent: boolean;
  cls: string;
}

/**
 * Estado del flare sobre la ventana [nowMs-3h, nowMs] de la serie viva.
 * Nivel continuo (el flash respira con el dato); el evento es >= M1.
 */
export function flareState(series: XrayPt[], nowMs: number): FlareState {
  const cut = nowMs - 3 * 3600_000;
  let peak = 0;
  let peakTime: number | null = null;
  for (const p of series) {
    if (p.t < cut || p.t > nowMs) continue;
    if (p.f > peak) {
      peak = p.f;
      peakTime = p.t;
    }
  }
  const level =
    peak <= 0
      ? 0
      : Math.min(
          1,
          Math.max(0, (Math.log10(peak) - Math.log10(FLUX_C1)) / 2)
        );
  return {
    level,
    peak,
    peakTime,
    isEvent: peak >= FLUX_M1,
    cls: flareClass(peak),
  };
}

export interface FlrEvent {
  flrId: string;
  begin: number | null;
  peak: number | null;
  end: number | null;
  classType: string | null;
  srcLoc: string | null;
  ar: number | null;
  link: string | null;
}

function toMs(v: unknown): number | null {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v.length === 16 ? v + ":00Z" : v);
  return Number.isFinite(t) ? t : null;
}

/** Parseo defensivo de la respuesta DONKI FLR (unknown -> []). */
export function parseFlr(raw: unknown): FlrEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: FlrEvent[] = [];
  for (const e of raw) {
    if (e == null || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    const ar = typeof r.activeRegionNum === "number" ? r.activeRegionNum : null;
    out.push({
      flrId: typeof r.flrID === "string" ? r.flrID : "",
      begin: toMs(r.beginTime),
      peak: toMs(r.peakTime),
      end: toMs(r.endTime),
      classType: typeof r.classType === "string" ? r.classType : null,
      srcLoc: typeof r.sourceLocation === "string" ? r.sourceLocation : null,
      ar,
      link: typeof r.link === "string" ? r.link : null,
    });
  }
  return out;
}

/**
 * Cross-check O3.4: eventos FLR con pico dentro de la ventana [t0, t1]
 * (ventana del replay o ultimas 24 h en vivo).
 */
export function matchFlr(flares: FlrEvent[], t0ms: number, t1ms: number): FlrEvent[] {
  return flares.filter((f) => f.peak != null && f.peak >= t0ms && f.peak <= t1ms);
}
