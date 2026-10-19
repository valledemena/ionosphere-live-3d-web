/**
 * Física ionosférica — port de src/Ionosphere/LayerProfile.h + DensityVolume.h
 * Perfil Ne(h) por capas: D sintética (Chapman + flare GOES), E/F1 Chapman-α,
 * F2 Epstein-Bilitza (bottomside) + topside difusivo.
 */

import { solarZenithDeg } from "./solar";
import { idwInterpolate, greatCircleDeg } from "./geo";

// ─── Constantes físicas ───
export const FO_TO_NM = 1.24e10; // Nm = 1.24e10 · fo²  (fo MHz -> m^-3)
export const TECU = 1e16; // 1 TECU = 1e16 el/m²

export interface LayerParams {
  foE: number; // MHz (0 = sin capa)
  foF1: number;
  foF2: number;
  hmF2: number; // km
  B0: number; // km (saneado 20..300)
  B1: number; // adimensional (saneado 1.7..4.0)
}

export const DEFAULT_PARAMS: LayerParams = {
  foE: 0,
  foF1: 0,
  foF2: 0,
  hmF2: 280,
  B0: 90,
  B1: 3,
};

export function sanitizeB0(b: number): number {
  if (!isFinite(b) || b <= 0) return 90;
  return Math.min(300, Math.max(20, b));
}
export function sanitizeB1(b: number): number {
  if (!isFinite(b) || b <= 0) return 3;
  return Math.min(4.0, Math.max(1.7, b));
}

/** Densidad de la capa D (sintética, con boost por flare X GOES — factor ilustrativo) */
export function neD(h: number, cosChi: number, xrayFlux: number): number {
  if (cosChi <= 0 && xrayFlux < 1e-6) return 0;
  const flare = 1 + 20 * Math.max(0, Math.log10(Math.max(xrayFlux, 1e-9) / 1e-6));
  const nm = 1e9 * Math.sqrt(Math.max(0, cosChi)) * Math.max(1, flare);
  const hm = 75,
    H = 10;
  const x = (h - hm) / H;
  return nm * Math.exp(0.5 * (1 - x - Math.exp(-x)));
}

/** Capa E — Chapman-α */
export function neE(h: number, foE: number, hmE = 110, HE = 10): number {
  if (foE <= 0) return 0;
  const nm = FO_TO_NM * foE * foE;
  const x = (h - hmE) / HE;
  return nm * Math.exp(0.5 * (1 - x - Math.exp(-x)));
}

/** Capa F1 — Chapman-α */
export function neF1(h: number, foF1: number, hmF1: number, HF1 = 25): number {
  if (foF1 <= 0) return 0;
  const nm = FO_TO_NM * foF1 * foF1;
  const x = (h - hmF1) / HF1;
  return nm * Math.exp(0.5 * (1 - x - Math.exp(-x)));
}

/**
 * Capa F2 — Epstein modificado de Bilitza & Rawer:
 *   Ne = NmF2 · exp(−x^B1 / cosh x),  x = (hmF2−h)/B0
 * Con clamp x≤1.6 + taper exponencial (análisis del mínimo x^B1/cosh x).
 * Topside: exponencial con H creciente (difusión ambipolar).
 */
export function neF2(h: number, foF2: number, hmF2: number, B0: number, B1: number): number {
  if (foF2 <= 0) return 0;
  const nm = FO_TO_NM * foF2 * foF2;
  if (h <= hmF2) {
    const x = (hmF2 - h) / Math.max(B0, 1);
    if (x <= 1.6) {
      const xp = Math.pow(x, B1);
      return nm * Math.exp(-xp / Math.cosh(x));
    } else {
      // taper: continúa cayendo de forma exponencial desde x=1.6
      const xp16 = Math.pow(1.6, B1);
      const val16 = Math.exp(-xp16 / Math.cosh(1.6));
      return nm * val16 * Math.exp(-(x - 1.6) / 1.2);
    }
  } else {
    // topside difusivo
    const H = 60 * (1 + (h - hmF2) / 300);
    return nm * Math.exp(-(h - hmF2) / H);
  }
}

/** Ne total (m⁻³) — combinación por max() como en el C++ */
export function neTotal(
  h: number,
  p: LayerParams,
  cosChi: number,
  xrayFlux: number,
  hmF1?: number
): number {
  const hmF1v = hmF1 ?? Math.max(150, 0.8 * p.hmF2);
  const dayFactor = smoothstep(-0.05, 0.25, cosChi);
  let best = 0;
  // D
  const d = neD(h, cosChi, xrayFlux);
  if (d > best) best = d;
  // E (atenuada de noche)
  const e = neE(h, p.foE) * dayFactor;
  if (e > best) best = e;
  // F1 (atenuada de noche)
  const f1 = neF1(h, p.foF1, hmF1v) * dayFactor;
  if (f1 > best) best = f1;
  // F2 (persiste de noche, algo reducida)
  const f2 = neF2(h, p.foF2, p.hmF2, p.B0, p.B1) * (0.25 + 0.75 * dayFactor);
  if (f2 > best) best = f2;
  return best;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** TEC (TECU) integrando trapezoidalmente de 60 a 1000 km */
export function integrateTEC(p: LayerParams, cosChi: number, xrayFlux: number): number {
  const hMin = 60,
    hMax = 1000,
    n = 80;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const h0 = hMin + ((hMax - hMin) * i) / n;
    const h1 = hMin + ((hMax - hMin) * (i + 1)) / n;
    const n0 = neTotal(h0, p, cosChi, xrayFlux);
    const n1 = neTotal(h1, p, cosChi, xrayFlux);
    acc += ((n0 + n1) / 2) * (h1 - h0) * 1000; // km->m
  }
  return acc / TECU;
}

// ─── Modelo foF2/hmF2 empírico (fondo cuando no hay GIRO, estilo CCIR simplificado) ───

/**
 * foF2 climatológico (MHz): dependencia diurna (seno del ángulo horario),
 * latitud (anomalía ecuatorial aproximada), ciclo solar (F10.7) y estación.
 * Ajustado para reproducir rango realista 1.5 (noche polar) .. 14 (mediodía ecuatorial).
 */
export function modelFoF2(
  latDeg: number,
  lonDeg: number,
  utcSeconds: number,
  f107: number
): number {
  const zen = solarZenithDeg(latDeg, lonDeg, utcSeconds);
  const cosChi = Math.cos(zen * Math.PI / 180);
  const lat = Math.abs(latDeg);
  // Actividad solar: F10.7 70 (mínimo) -> 1.0x, 200 -> 1.55x
  const solar = 0.62 + 0.0046 * Math.max(60, Math.min(220, f107));
  // Base diurna + reserva nocturna
  const dayBase = 3.2 + 7.8 * Math.pow(Math.max(cosChi, 0), 0.7);
  const nightBase = 1.6 + 1.8 * Math.exp(-lat / 40);
  // Transición crepuscular suave
  const t = smoothstep(-0.12, 0.15, cosChi);
  let fo = (1 - t) * nightBase + t * dayBase;
  // Anomalía ecuatorial (cresta a ±15° con valle en el ecuador geomagnético)
  const eq = Math.exp(-Math.pow((lat - 16) / 12, 2)) - 0.55 * Math.exp(-Math.pow(lat / 20, 2));
  fo *= 1 + 0.32 * eq * t;
  // Depresión de invierno (hemisferio N; opuesto en S por la inclinación de la F2)
  const doy = dayOfYear(utcSeconds);
  const seasonal = Math.cos(((doy - 172) / 365) * 2 * Math.PI) * (latDeg > 0 ? 1 : -1);
  fo *= 1 + 0.06 * seasonal * (lat / 90);
  return fo * solar;
}

/** hmF2 climatológico (km): sube de noche, baja de día, más alto en bajas latitudes */
export function modelHmF2(latDeg: number, lonDeg: number, utcSeconds: number): number {
  const zen = solarZenithDeg(latDeg, lonDeg, utcSeconds);
  const cosChi = Math.cos(zen * Math.PI / 180);
  const lat = Math.abs(latDeg);
  const dayH = 250 - 0.35 * lat;
  const nightH = 300 + 0.2 * lat;
  const t = smoothstep(-0.12, 0.15, cosChi);
  return (1 - t) * nightH + t * dayH;
}

export function dayOfYear(utcSeconds: number): number {
  const d = new Date(utcSeconds * 1000);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86400000);
}

// ─── Radio: MUF / FOT / LUF / absorción ───

/**
 * MUF(D) para un circuito: MUF ≈ foF2 · sec(i) con factor de distancia.
 * i = ángulo de incidencia en la reflexión. Para D=3000 km el factor clásico ~3.5.
 */
export function mufForHop(foF2: number, incidenceDeg: number): number {
  const sec = 1 / Math.max(0.25, Math.cos(incidenceDeg * Math.PI / 180));
  return foF2 * Math.min(sec, 3.8);
}

/** FOT = 0.85·MUF (definición operacional ITU) */
export const fotOf = (muf: number) => 0.85 * muf;

/**
 * LUF (MHz) — heurística "estilo ITU" del C++ con absorción D dependiente
 * del flujo X-ray (Sauer-Wilkinson simplificado: A ∝ F^0.75).
 */
export function lufEstimate(
  muf: number,
  cosChi: number,
  xrayFlux: number,
  foF2: number
): number {
  const dayFactor = Math.max(0, cosChi);
  const absorb = 1.2 + 2.8 * dayFactor * 0.7;
  const flareAbsorb =
    xrayFlux > 1e-7 ? 2.5 * Math.pow(xrayFlux / 1e-6, 0.75) * (0.3 + 0.7 * dayFactor) : 0;
  let luf = 0.35 * muf + 0.5 * (absorb + flareAbsorb);
  luf = Math.min(luf, Math.max(2, 0.9 * foF2));
  return Math.max(2, luf);
}

/** Absorción D (dB) en un punto — para el mapa global de absorción (Sauer-Wilkinson simpl.) */
export function dRegionAbsorptionDb(cosChi: number, xrayFlux: number, kp: number): number {
  const dayFactor = Math.max(0, cosChi);
  // X-ray (SID): A = 4.5·(F/1e-6)^0.75 dB para F>=1e-6, solo de día
  const sid =
    xrayFlux >= 1e-7
      ? 4.5 * Math.pow(Math.max(xrayFlux, 1e-7) / 1e-6, 0.75) * dayFactor
      : 0;
  // Absorción geomagnética auroral (capa D polar, escala con Kp)
  const auroral = 0.35 * Math.max(0, Math.pow(Math.max(kp, 0), 2.1));
  return sid + auroral;
}

// ─── Grid global desde estaciones GIRO (o modelo) ───

export interface StationDatum {
  code: string;
  name: string;
  lat: number;
  lon: number;
  foF2?: number;
  hmF2?: number;
  muf3000?: number;
  history?: { t: number; foF2: number }[];
}

export interface GridField {
  w: number;
  h: number;
  /** valores por fila (lat 90..-90) y columna (lon -180..180), NaN = sin dato */
  values: Float32Array;
  min: number;
  max: number;
}

export const GRID_W = 72;
export const GRID_H = 36;

/**
 * Construye el grid foF2 combinando GIRO (IDW + fondo mediana) y modelo
 * climatológico como fondo cuando no hay estaciones cerca.
 * Modo "blended": GIRO tiene prioridad absoluta dentro del radio,
 * el modelo rellena océanos con ponderación.
 */
export function buildFoF2Grid(
  stations: StationDatum[],
  utcSeconds: number,
  f107: number,
  blendWithModel = true
): GridField {
  const values = new Float32Array(GRID_W * GRID_H);
  const valid = stations.filter((s) => (s.foF2 ?? 0) > 0.5).map((s) => ({
    lat: s.lat,
    lon: s.lon,
    value: s.foF2!,
  }));
  let min = Infinity,
    max = -Infinity;
  for (let j = 0; j < GRID_H; j++) {
    const lat = 90 - ((j + 0.5) * 180) / GRID_H;
    for (let i = 0; i < GRID_W; i++) {
      const lon = -180 + ((i + 0.5) * 360) / GRID_W;
      let v: number;
      if (valid.length >= 8) {
        const gi = idwInterpolate(valid, lat, lon, 50, 0.004);
        if (!blendWithModel) v = gi ?? 0;
        else {
          const mo = modelFoF2(lat, lon, utcSeconds, f107);
          // mezcla suave: GIRO dentro de su radio, modelo lejos de estaciones
          const near = nearestStationDist(valid, lat, lon);
          const wG = smoothstep(55, 25, near); // 1 cerca de estaciones, 0 lejos
          v = (gi ?? mo) * wG + mo * (1 - wG);
        }
      } else {
        v = modelFoF2(lat, lon, utcSeconds, f107);
      }
      values[j * GRID_W + i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return { w: GRID_W, h: GRID_H, values, min, max };
}

/** Grid hmF2 similar (para alturas de capa) */
export function buildHmF2Grid(
  stations: StationDatum[],
  utcSeconds: number
): GridField {
  const values = new Float32Array(GRID_W * GRID_H);
  const valid = stations.filter((s) => (s.hmF2 ?? 0) > 100).map((s) => ({
    lat: s.lat,
    lon: s.lon,
    value: s.hmF2!,
  }));
  let min = Infinity,
    max = -Infinity;
  for (let j = 0; j < GRID_H; j++) {
    const lat = 90 - ((j + 0.5) * 180) / GRID_H;
    for (let i = 0; i < GRID_W; i++) {
      const lon = -180 + ((i + 0.5) * 360) / GRID_W;
      const mo = modelHmF2(lat, lon, utcSeconds);
      let v = mo;
      if (valid.length >= 8) {
        const gi = idwInterpolate(valid, lat, lon, 50, 0.004);
        if (gi !== null) {
          const near = nearestStationDist(valid, lat, lon);
          const wG = smoothstep(55, 25, near);
          v = gi * wG + mo * (1 - wG);
        }
      }
      values[j * GRID_W + i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return { w: GRID_W, h: GRID_H, values, min, max };
}

function nearestStationDist(
  valid: { lat: number; lon: number; value: number }[],
  lat: number,
  lon: number
): number {
  let best = 999;
  for (const s of valid) {
    const d = greatCircleDeg({ lat, lon }, s);
    if (d < best) best = d;
  }
  return best;
}

/** Muestrear un grid en lat/lon (bilineal) */
export function sampleGrid(grid: GridField, lat: number, lon: number): number {
  const fi = ((lon + 180) / 360) * grid.w - 0.5;
  const fj = ((90 - lat) / 180) * grid.h - 0.5;
  const i0 = Math.floor(fi),
    j0 = Math.floor(fj);
  const fx = fi - i0,
    fjx = fj - j0;
  const at = (i: number, j: number) => {
    const ii = ((i % grid.w) + grid.w) % grid.w;
    const jj = Math.min(grid.h - 1, Math.max(0, j));
    return grid.values[jj * grid.w + ii];
  };
  const v00 = at(i0, j0), v10 = at(i0 + 1, j0), v01 = at(i0, j0 + 1), v11 = at(i0 + 1, j0 + 1);
  return v00 * (1 - fx) * (1 - fjx) + v10 * fx * (1 - fjx) + v01 * (1 - fx) * fjx + v11 * fx * fjx;
}
